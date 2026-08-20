#!/usr/bin/env bash
set -euo pipefail

# Transactional acceptance harness for LA-M1 learning activities.
#
# This script is deliberately impossible to point at the live ShiDao database:
# the connected database name must be exactly `shidao_learning_activity_test`.
# Every fixture and mutation lives in one transaction. The successful path ends
# with ROLLBACK; ON_ERROR_STOP closes a failed psql session and PostgreSQL rolls
# the transaction back on every unexpected error.

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is required for the isolated learning-activity test database." >&2
  exit 2
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "psql is required to run the learning-activity database acceptance suite." >&2
  exit 2
fi

db_name="$(
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -Atqc \
    'select current_database()'
)"
if [[ "$db_name" != "shidao_learning_activity_test" ]]; then
  echo "Refusing LA-M1 fixtures for database '$db_name'; expected exactly 'shidao_learning_activity_test'." >&2
  exit 2
fi

schema_marker="$(
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -Atqc \
    "select case when
       to_regclass('public.account') is not null
       and to_regclass('public.course') is not null
       and to_regclass('public.lesson') is not null
       and to_regclass('public.lesson_component') is not null
       and to_regclass('public.lesson_run') is not null
       and to_regclass('public.learning_record') is not null
       and to_regclass('public.lesson_component_observation') is not null
       and to_regprocedure(
         'public.save_lesson_component_observations(uuid,uuid,text,text,text,jsonb)'
       ) is not null
       and to_regprocedure(
         'public.complete_lesson_run_v2(uuid,jsonb,text,timestamp with time zone,integer)'
       ) is not null
       and position(
         'lesson_run_absent_learner_has_observation'
         in pg_get_functiondef(to_regprocedure(
           'public.complete_lesson_run_v2(uuid,jsonb,text,timestamp with time zone,integer)'
         ))
       ) > 0
     then 'shidao-learning-activity-la-m1' else '' end"
)"
if [[ "$schema_marker" != "shidao-learning-activity-la-m1" ]]; then
  echo "Refusing fixtures: '$db_name' is not a fully migrated ShiDao LA-M1 test database." >&2
  exit 2
fi

psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 <<'SQL'
\set VERBOSITY verbose
begin;
set constraints all deferred;

-- A minimal isolated auth.users clone can omit Supabase's bootstrap ACL. The
-- grant is transaction-local and only restores the production capability that
-- authenticated RLS/RPC evaluation needs for auth.uid().
grant usage on schema auth to authenticated;

do $guard$
begin
  if current_database() <> 'shidao_learning_activity_test' then
    raise exception
      'learning_activity_acceptance_wrong_database:%',
      current_database()
      using errcode = '42501';
  end if;

  if to_regclass('public.account') is null
    or to_regclass('public.course') is null
    or to_regclass('public.lesson') is null
    or to_regclass('public.lesson_component') is null
    or to_regclass('public.lesson_run') is null
    or to_regclass('public.learning_record') is null
    or to_regclass('public.lesson_component_observation') is null
    or to_regprocedure(
      'public.save_lesson_component_observations(uuid,uuid,text,text,text,jsonb)'
    ) is null
    or to_regprocedure(
      'public.complete_lesson_run_v2(uuid,jsonb,text,timestamp with time zone,integer)'
    ) is null
  then
    raise exception 'learning_activity_acceptance_wrong_schema'
      using errcode = '42501';
  end if;
end
$guard$;

create function pg_temp.assert_true(p_value boolean, p_message text)
returns void
language plpgsql
as $$
begin
  if not coalesce(p_value, false) then
    raise exception 'learning_activity_acceptance_failed: %', p_message;
  end if;
end
$$;

create function pg_temp.assert_raises(
  p_statement text,
  p_expected_sqlstate text,
  p_expected_message text,
  p_message text
)
returns void
language plpgsql
as $$
declare
  v_actual_sqlstate text;
  v_actual_message text;
begin
  begin
    execute p_statement;
  exception when others then
    get stacked diagnostics
      v_actual_sqlstate = returned_sqlstate,
      v_actual_message = message_text;
    if v_actual_sqlstate = p_expected_sqlstate
      and (
        p_expected_message is null
        or v_actual_message = p_expected_message
      )
    then
      return;
    end if;
    raise exception
      'learning_activity_acceptance_failed: % (expected SQLSTATE % / %, got % / %)',
      p_message,
      p_expected_sqlstate,
      coalesce(p_expected_message, '<any>'),
      v_actual_sqlstate,
      v_actual_message;
  end;
  raise exception
    'learning_activity_acceptance_failed: % (statement did not fail)',
    p_message;
end
$$;

select pg_temp.assert_true(
  current_database() = 'shidao_learning_activity_test',
  'database identity changed after the shell guard'
);

-- -------------------------------------------------------------------------
-- Physical security and lifecycle contract.
-- -------------------------------------------------------------------------

select pg_temp.assert_true(
  exists (
    select 1
    from pg_class as relation
    where relation.oid = 'public.lesson_component_observation'::regclass
      and relation.relrowsecurity
  ),
  'observation RLS is not enabled'
);

select pg_temp.assert_true(
  (
    select count(*)
    from pg_policies as policy
    where policy.schemaname = 'public'
      and policy.tablename = 'lesson_component_observation'
      and policy.policyname = 'lesson_component_observation_recorder_select'
      and policy.cmd = 'SELECT'
  ) = 1,
  'recorder SELECT policy is missing or duplicated'
);

select pg_temp.assert_true(
  has_table_privilege(
    'authenticated',
    'public.lesson_component_observation',
    'SELECT'
  )
    and not has_table_privilege(
      'authenticated',
      'public.lesson_component_observation',
      'INSERT'
    )
    and not has_table_privilege(
      'authenticated',
      'public.lesson_component_observation',
      'UPDATE'
    )
    and not has_table_privilege(
      'authenticated',
      'public.lesson_component_observation',
      'DELETE'
    )
    and not has_table_privilege(
      'anon',
      'public.lesson_component_observation',
      'SELECT'
    ),
  'raw table ACL is broader than authenticated recorder SELECT'
);

select pg_temp.assert_true(
  exists (
    select 1
    from pg_proc as procedure
    where procedure.oid = to_regprocedure(
        'public.save_lesson_component_observations(uuid,uuid,text,text,text,jsonb)'
      )
      and procedure.prosecdef
      and procedure.proretset
      and procedure.proconfig @> array['search_path=""']::text[]
  )
    and has_function_privilege(
      'authenticated',
      'public.save_lesson_component_observations(uuid,uuid,text,text,text,jsonb)',
      'EXECUTE'
    )
    and not has_function_privilege(
      'anon',
      'public.save_lesson_component_observations(uuid,uuid,text,text,text,jsonb)',
      'EXECUTE'
    )
    and not has_function_privilege(
      'service_role',
      'public.save_lesson_component_observations(uuid,uuid,text,text,text,jsonb)',
      'EXECUTE'
    ),
  'save RPC SECURITY DEFINER or EXECUTE ACL is wrong'
);

select pg_temp.assert_true(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.learning_record'::regclass
      and conname = 'learning_record_id_recorded_by_unique'
      and contype = 'u'
      and convalidated
  )
    and exists (
      select 1
      from pg_constraint
      where conrelid = 'public.lesson_component_observation'::regclass
        and conname = 'lesson_component_observation_record_recorder_fkey'
        and contype = 'f'
        and confdeltype = 'c'
        and convalidated
    )
    and exists (
      select 1
      from pg_constraint
      where conrelid = 'public.lesson_component_observation'::regclass
        and conname = 'lesson_component_observation_live_component_fkey'
        and contype = 'f'
        and confdeltype = 'n'
        and convalidated
    ),
  'recorder, erasure, or live-component FK contract is wrong'
);

select pg_temp.assert_true(
  position(
    'for update of run'
    in lower(pg_get_functiondef(to_regprocedure(
      'public.save_lesson_component_observations(uuid,uuid,text,text,text,jsonb)'
    )))
  ) > 0
    and position(
      'for update of record'
      in lower(pg_get_functiondef(to_regprocedure(
        'public.save_lesson_component_observations(uuid,uuid,text,text,text,jsonb)'
      )))
    ) > 0
    and position(
      'lesson_run_absent_learner_has_observation'
      in pg_get_functiondef(to_regprocedure(
        'public.complete_lesson_run_v2(uuid,jsonb,text,timestamp with time zone,integer)'
      ))
    ) > 0,
  'save/completion serialization contract is absent'
);

-- -------------------------------------------------------------------------
-- Canonical, rollback-only fixtures.
-- -------------------------------------------------------------------------

set local session_replication_role = replica;

insert into auth.users (
  id,
  email,
  email_confirmed_at,
  raw_user_meta_data,
  raw_app_meta_data
)
values
  (
    'b1000000-0000-4000-8000-000000000001',
    'la-owner@test.invalid',
    clock_timestamp(),
    '{}'::jsonb,
    '{}'::jsonb
  ),
  (
    'b1000000-0000-4000-8000-000000000002',
    'la-foreign@test.invalid',
    clock_timestamp(),
    '{}'::jsonb,
    '{}'::jsonb
  ),
  (
    'b1000000-0000-4000-8000-000000000003',
    'la-subject@test.invalid',
    clock_timestamp(),
    '{}'::jsonb,
    '{}'::jsonb
  );

insert into public.account (
  id,
  auth_user_id,
  display_name,
  status
)
values
  (
    'b2000000-0000-4000-8000-000000000001',
    'b1000000-0000-4000-8000-000000000001',
    'LA Owner',
    'active'
  ),
  (
    'b2000000-0000-4000-8000-000000000002',
    'b1000000-0000-4000-8000-000000000002',
    'LA Foreign',
    'active'
  ),
  (
    'b2000000-0000-4000-8000-000000000003',
    'b1000000-0000-4000-8000-000000000003',
    'LA Subject',
    'active'
  );

insert into public.learner_profile (id, display_name, account_id)
values
  (
    'b3000000-0000-4000-8000-000000000010',
    'LA Owner',
    'b2000000-0000-4000-8000-000000000001'
  ),
  (
    'b3000000-0000-4000-8000-000000000011',
    'LA Foreign',
    'b2000000-0000-4000-8000-000000000002'
  ),
  (
    'b3000000-0000-4000-8000-000000000001',
    'LA Learner One',
    null
  ),
  (
    'b3000000-0000-4000-8000-000000000002',
    'LA Learner Two',
    null
  ),
  (
    'b3000000-0000-4000-8000-000000000003',
    'LA Subject',
    'b2000000-0000-4000-8000-000000000003'
  );

insert into public.course (
  id,
  owner_account_id,
  title,
  subject,
  audience_type,
  learning_audience
)
values (
  'b4000000-0000-4000-8000-000000000001',
  'b2000000-0000-4000-8000-000000000001',
  'LA-M1 acceptance course',
  'Русский язык',
  'learner_profile',
  'children'
);

insert into public.lesson (id, course_id, position, title)
values
  (
    'b5000000-0000-4000-8000-000000000001',
    'b4000000-0000-4000-8000-000000000001',
    1,
    'Pre-start denial'
  ),
  (
    'b5000000-0000-4000-8000-000000000002',
    'b4000000-0000-4000-8000-000000000001',
    2,
    'Save and reload'
  ),
  (
    'b5000000-0000-4000-8000-000000000003',
    'b4000000-0000-4000-8000-000000000001',
    3,
    'Wrong component'
  ),
  (
    'b5000000-0000-4000-8000-000000000004',
    'b4000000-0000-4000-8000-000000000001',
    4,
    'Cancel cascade'
  ),
  (
    'b5000000-0000-4000-8000-000000000005',
    'b4000000-0000-4000-8000-000000000001',
    5,
    'Completion conflict'
  ),
  (
    'b5000000-0000-4000-8000-000000000006',
    'b4000000-0000-4000-8000-000000000001',
    6,
    'At-time retention'
  ),
  (
    'b5000000-0000-4000-8000-000000000007',
    'b4000000-0000-4000-8000-000000000001',
    7,
    'Erasure cascade'
  );

insert into public.lesson_component (
  id,
  lesson_id,
  position,
  type_key,
  payload,
  placement_config,
  visibility
)
select
  ('b6000000-0000-4000-8000-' || lpad(component.ordinal::text, 12, '0'))::uuid,
  ('b5000000-0000-4000-8000-' || lpad(component.ordinal::text, 12, '0'))::uuid,
  1,
  'discussion',
  '{}'::jsonb,
  '{}'::jsonb,
  'staff_only'
from generate_series(1, 7) as component(ordinal);

insert into public.teacher_learner (
  teacher_account_id,
  learner_profile_id,
  display_name
)
values
  (
    'b2000000-0000-4000-8000-000000000001',
    'b3000000-0000-4000-8000-000000000001',
    'LA Learner One'
  ),
  (
    'b2000000-0000-4000-8000-000000000001',
    'b3000000-0000-4000-8000-000000000002',
    'LA Learner Two'
  ),
  (
    'b2000000-0000-4000-8000-000000000001',
    'b3000000-0000-4000-8000-000000000003',
    'LA Subject'
  );

insert into public.course_learner (course_id, learner_profile_id)
values
  (
    'b4000000-0000-4000-8000-000000000001',
    'b3000000-0000-4000-8000-000000000001'
  ),
  (
    'b4000000-0000-4000-8000-000000000001',
    'b3000000-0000-4000-8000-000000000002'
  ),
  (
    'b4000000-0000-4000-8000-000000000001',
    'b3000000-0000-4000-8000-000000000003'
  );

insert into public.learner_observer_grant (
  id,
  learner_profile_id,
  subject_account_id,
  observer_account_id,
  relationship_label
)
values (
  'b3500000-0000-4000-8000-000000000001',
  'b3000000-0000-4000-8000-000000000003',
  'b2000000-0000-4000-8000-000000000003',
  'b2000000-0000-4000-8000-000000000002',
  'Наблюдатель LA-M1'
);

insert into public.lesson_run (
  id,
  lesson_id,
  scheduled_at,
  planned_duration_minutes
)
values
  (
    'b7000000-0000-4000-8000-000000000001',
    'b5000000-0000-4000-8000-000000000001',
    '2026-08-19 10:00:00+09',
    45
  ),
  (
    'b7000000-0000-4000-8000-000000000002',
    'b5000000-0000-4000-8000-000000000002',
    '2026-08-19 10:00:00+09',
    45
  ),
  (
    'b7000000-0000-4000-8000-000000000004',
    'b5000000-0000-4000-8000-000000000004',
    '2026-08-19 10:00:00+09',
    45
  ),
  (
    'b7000000-0000-4000-8000-000000000005',
    'b5000000-0000-4000-8000-000000000005',
    '2026-08-19 10:00:00+09',
    45
  ),
  (
    'b7000000-0000-4000-8000-000000000006',
    'b5000000-0000-4000-8000-000000000006',
    '2026-08-19 10:00:00+09',
    45
  ),
  (
    'b7000000-0000-4000-8000-000000000007',
    'b5000000-0000-4000-8000-000000000007',
    '2026-08-19 10:00:00+09',
    45
  );

insert into public.learning_record (
  id,
  learner_profile_id,
  lesson_run_id,
  source_course_id,
  source_lesson_id,
  recorded_by_account_id
)
values
  (
    'b8000000-0000-4000-8000-000000000001',
    'b3000000-0000-4000-8000-000000000001',
    'b7000000-0000-4000-8000-000000000001',
    'b4000000-0000-4000-8000-000000000001',
    'b5000000-0000-4000-8000-000000000001',
    'b2000000-0000-4000-8000-000000000001'
  ),
  (
    'b8000000-0000-4000-8000-000000000002',
    'b3000000-0000-4000-8000-000000000001',
    'b7000000-0000-4000-8000-000000000002',
    'b4000000-0000-4000-8000-000000000001',
    'b5000000-0000-4000-8000-000000000002',
    'b2000000-0000-4000-8000-000000000001'
  ),
  (
    'b8000000-0000-4000-8000-000000000003',
    'b3000000-0000-4000-8000-000000000002',
    'b7000000-0000-4000-8000-000000000002',
    'b4000000-0000-4000-8000-000000000001',
    'b5000000-0000-4000-8000-000000000002',
    'b2000000-0000-4000-8000-000000000001'
  ),
  (
    'b8000000-0000-4000-8000-000000000004',
    'b3000000-0000-4000-8000-000000000001',
    'b7000000-0000-4000-8000-000000000004',
    'b4000000-0000-4000-8000-000000000001',
    'b5000000-0000-4000-8000-000000000004',
    'b2000000-0000-4000-8000-000000000001'
  ),
  (
    'b8000000-0000-4000-8000-000000000005',
    'b3000000-0000-4000-8000-000000000001',
    'b7000000-0000-4000-8000-000000000005',
    'b4000000-0000-4000-8000-000000000001',
    'b5000000-0000-4000-8000-000000000005',
    'b2000000-0000-4000-8000-000000000001'
  ),
  (
    'b8000000-0000-4000-8000-000000000006',
    'b3000000-0000-4000-8000-000000000001',
    'b7000000-0000-4000-8000-000000000006',
    'b4000000-0000-4000-8000-000000000001',
    'b5000000-0000-4000-8000-000000000006',
    'b2000000-0000-4000-8000-000000000001'
  ),
  (
    'b8000000-0000-4000-8000-000000000007',
    'b3000000-0000-4000-8000-000000000003',
    'b7000000-0000-4000-8000-000000000007',
    'b4000000-0000-4000-8000-000000000001',
    'b5000000-0000-4000-8000-000000000007',
    'b2000000-0000-4000-8000-000000000001'
  );

set local session_replication_role = origin;

select set_config(
  'request.jwt.claim.sub',
  'b1000000-0000-4000-8000-000000000001',
  true
);
set local role authenticated;

select (public.start_lesson_run(
  run_id,
  '2026-08-19 10:05:00+09'::timestamptz
)).id
from unnest(array[
  'b7000000-0000-4000-8000-000000000002'::uuid,
  'b7000000-0000-4000-8000-000000000004'::uuid,
  'b7000000-0000-4000-8000-000000000005'::uuid,
  'b7000000-0000-4000-8000-000000000006'::uuid,
  'b7000000-0000-4000-8000-000000000007'::uuid
]) as started(run_id);

-- -------------------------------------------------------------------------
-- Lifecycle, ownership, RLS and compact batch semantics.
-- -------------------------------------------------------------------------

select pg_temp.assert_raises(
  $sql$
    select *
    from public.save_lesson_component_observations(
      'b7000000-0000-4000-8000-000000000001',
      'b6000000-0000-4000-8000-000000000001',
      'До начала',
      'Формулирует ответ',
      'direct',
      '[{"learningRecordId":"b8000000-0000-4000-8000-000000000001","rating":"independent"}]'::jsonb
    )
  $sql$,
  '55000',
  'lesson_run_not_started',
  'pre-start save was accepted'
);

select pg_temp.assert_raises(
  $sql$
    select *
    from public.save_lesson_component_observations(
      'b7000000-0000-4000-8000-000000000002',
      'b6000000-0000-4000-8000-000000000002',
      'Устный ответ',
      null,
      'direct',
      '[{"learningRecordId":"b8000000-0000-4000-8000-000000000002","rating":"independent"}]'::jsonb
    )
  $sql$,
  '22023',
  'lesson_component_observation_criterion_required',
  'rated save without a criterion was accepted'
);

select pg_temp.assert_raises(
  $sql$
    select *
    from public.save_lesson_component_observations(
      'b7000000-0000-4000-8000-000000000002',
      'b6000000-0000-4000-8000-000000000003',
      'Чужой компонент',
      'Не относится к Run',
      'direct',
      '[{"learningRecordId":"b8000000-0000-4000-8000-000000000002","rating":"independent"}]'::jsonb
    )
  $sql$,
  'P0002',
  'lesson_component_observation_not_found',
  'component from another Lesson was accepted'
);

select pg_temp.assert_true(
  (
    select count(*)
    from public.save_lesson_component_observations(
      'b7000000-0000-4000-8000-000000000002',
      'b6000000-0000-4000-8000-000000000002',
      'Устный ответ',
      'Формулирует полный ответ',
      'direct',
      '[
        {
          "learningRecordId":"b8000000-0000-4000-8000-000000000002",
          "rating":"independent"
        },
        {
          "learningRecordId":"b8000000-0000-4000-8000-000000000003",
          "rating":"with_support",
          "privateNote":"Нужна опора"
        }
      ]'::jsonb
    )
  ) = 2,
  'direct batch did not return its complete persisted component set'
);

select pg_temp.assert_true(
  count(*) = 2
    and bool_and(
      recorded_by_account_id =
        'b2000000-0000-4000-8000-000000000001'::uuid
    )
    and bool_and(
      lesson_component_id =
        'b6000000-0000-4000-8000-000000000002'::uuid
    )
    and bool_and(
      source_lesson_component_id_at_time =
        'b6000000-0000-4000-8000-000000000002'::uuid
    )
    and bool_and(component_position_at_time = 1)
    and bool_and(component_type_key_at_time = 'discussion')
    and bool_and(component_label_at_time = 'Устный ответ')
    and bool_and(observable_criterion_at_time = 'Формулирует полный ответ')
    and bool_and(entry_method = 'direct'),
  'owner reload lost compact at-time context or recorder identity'
)
from public.lesson_component_observation
where learning_record_id in (
  'b8000000-0000-4000-8000-000000000002',
  'b8000000-0000-4000-8000-000000000003'
);

reset role;
select set_config(
  'request.jwt.claim.sub',
  'b1000000-0000-4000-8000-000000000002',
  true
);
set local role authenticated;

select pg_temp.assert_true(
  (
    select count(*)
    from public.lesson_component_observation
    where learning_record_id in (
      'b8000000-0000-4000-8000-000000000002',
      'b8000000-0000-4000-8000-000000000003'
    )
  ) = 0,
  'foreign authenticated recorder read crossed RLS'
);

select pg_temp.assert_raises(
  $sql$
    select *
    from public.save_lesson_component_observations(
      'b7000000-0000-4000-8000-000000000002',
      'b6000000-0000-4000-8000-000000000002',
      'Устный ответ',
      'Формулирует полный ответ',
      'direct',
      '[{"learningRecordId":"b8000000-0000-4000-8000-000000000002","rating":"not_yet"}]'::jsonb
    )
  $sql$,
  'P0002',
  'lesson_component_observation_not_found',
  'foreign authenticated writer reached the SECURITY DEFINER mutation'
);

reset role;
set local role anon;

select pg_temp.assert_raises(
  $sql$
    select * from public.lesson_component_observation
  $sql$,
  '42501',
  null,
  'anon raw SELECT was accepted'
);

select pg_temp.assert_raises(
  $sql$
    select *
    from public.save_lesson_component_observations(
      'b7000000-0000-4000-8000-000000000002',
      'b6000000-0000-4000-8000-000000000002',
      'Устный ответ',
      'Формулирует полный ответ',
      'direct',
      '[{"learningRecordId":"b8000000-0000-4000-8000-000000000002","rating":"not_yet"}]'::jsonb
    )
  $sql$,
  '42501',
  null,
  'anon RPC call was accepted'
);

reset role;
select set_config(
  'request.jwt.claim.sub',
  'b1000000-0000-4000-8000-000000000001',
  true
);
set local role authenticated;

select pg_temp.assert_true(
  (
    select count(*)
    from public.save_lesson_component_observations(
      'b7000000-0000-4000-8000-000000000002',
      'b6000000-0000-4000-8000-000000000002',
      'Устный ответ — повторная проверка',
      'Применяет правило без подсказки',
      'bulk_confirmed',
      '[
        {
          "learningRecordId":"b8000000-0000-4000-8000-000000000002",
          "rating":"with_support",
          "privateNote":"Одна подсказка"
        },
        {
          "learningRecordId":"b8000000-0000-4000-8000-000000000003",
          "rating":null
        }
      ]'::jsonb
    )
  ) = 1,
  'confirmed bulk save did not atomically update and clear'
);

select pg_temp.assert_true(
  count(*) = 1
    and bool_and(
      learning_record_id =
        'b8000000-0000-4000-8000-000000000002'::uuid
    )
    and bool_and(entry_method = 'bulk_confirmed')
    and bool_and(rating = 'with_support')
    and bool_and(private_note = 'Одна подсказка')
    and bool_and(
      observable_criterion_at_time = 'Применяет правило без подсказки'
    )
    and bool_and(
      component_label_at_time = 'Устный ответ — повторная проверка'
    ),
  'bulk-confirmed reload is inconsistent'
)
from public.lesson_component_observation
where learning_record_id in (
  'b8000000-0000-4000-8000-000000000002',
  'b8000000-0000-4000-8000-000000000003'
);

with cleared as materialized (
  select *
  from public.save_lesson_component_observations(
    'b7000000-0000-4000-8000-000000000002',
    'b6000000-0000-4000-8000-000000000002',
    'Устный ответ — повторная проверка',
    null,
    'direct',
    '[{"learningRecordId":"b8000000-0000-4000-8000-000000000002","rating":null}]'::jsonb
  )
)
select pg_temp.assert_true(
  count(*) = 0,
  'null rating returned a stale component row'
)
from cleared;

select pg_temp.assert_true(
  not exists (
    select 1
    from public.lesson_component_observation
    where learning_record_id in (
      'b8000000-0000-4000-8000-000000000002',
      'b8000000-0000-4000-8000-000000000003'
    )
  ),
  'null rating did not clear the open draft'
);

select count(*)
from public.save_lesson_component_observations(
  'b7000000-0000-4000-8000-000000000002',
  'b6000000-0000-4000-8000-000000000002',
  'Удаляемый компонент',
  'Наблюдает до изменения плана',
  'direct',
  '[{"learningRecordId":"b8000000-0000-4000-8000-000000000002","rating":"independent"}]'::jsonb
);

select pg_temp.assert_true(
  public.delete_lesson_component(
    'b6000000-0000-4000-8000-000000000002'
  ),
  'owner could not delete the open-Run Component'
);

select pg_temp.assert_true(
  not exists (
    select 1
    from public.lesson_component
    where id = 'b6000000-0000-4000-8000-000000000002'
  )
    and not exists (
      select 1
      from public.lesson_component_observation
      where learning_record_id =
        'b8000000-0000-4000-8000-000000000002'
    )
    and exists (
      select 1
      from public.learning_record
      where id = 'b8000000-0000-4000-8000-000000000002'
        and occurred_at is null
    ),
  'Component deletion stranded a mutable draft observation'
);

-- -------------------------------------------------------------------------
-- Cancellation cascade and completion serialization.
-- -------------------------------------------------------------------------

select count(*)
from public.save_lesson_component_observations(
  'b7000000-0000-4000-8000-000000000004',
  'b6000000-0000-4000-8000-000000000004',
  'Перед отменой',
  'Отвечает по теме',
  'direct',
  '[{"learningRecordId":"b8000000-0000-4000-8000-000000000004","rating":"independent"}]'::jsonb
);

select (public.cancel_lesson_run(
  'b7000000-0000-4000-8000-000000000004',
  '2026-08-19 10:25:00+09'
)).id;

select pg_temp.assert_true(
  exists (
    select 1
    from public.lesson_run
    where id = 'b7000000-0000-4000-8000-000000000004'
      and cancelled_at = '2026-08-19 10:25:00+09'::timestamptz
  )
    and not exists (
      select 1
      from public.learning_record
      where id = 'b8000000-0000-4000-8000-000000000004'
    )
    and not exists (
      select 1
      from public.lesson_component_observation
      where learning_record_id =
        'b8000000-0000-4000-8000-000000000004'
    ),
  'cancellation did not cascade draft record and observation deletion'
);

select count(*)
from public.save_lesson_component_observations(
  'b7000000-0000-4000-8000-000000000005',
  'b6000000-0000-4000-8000-000000000005',
  'Перед завершением',
  'Объясняет решение',
  'direct',
  '[{"learningRecordId":"b8000000-0000-4000-8000-000000000005","rating":"with_support"}]'::jsonb
);

select pg_temp.assert_raises(
  $sql$
    select public.complete_lesson_run_v2(
      'b7000000-0000-4000-8000-000000000005',
      '[{"learnerProfileId":"b3000000-0000-4000-8000-000000000001","wasPresent":false}]'::jsonb,
      null,
      '2026-08-19 10:25:00+09',
      20
    )
  $sql$,
  '23514',
  'lesson_run_absent_learner_has_observation',
  'completion accepted absent learner with an observation'
);

select pg_temp.assert_true(
  exists (
    select 1
    from public.lesson_run
    where id = 'b7000000-0000-4000-8000-000000000005'
      and ended_at is null
  )
    and exists (
      select 1
      from public.learning_record
      where id = 'b8000000-0000-4000-8000-000000000005'
        and occurred_at is null
    )
    and exists (
      select 1
      from public.lesson_component_observation
      where learning_record_id =
        'b8000000-0000-4000-8000-000000000005'
    ),
  'failed absent completion partially finalized the Run'
);

select public.complete_lesson_run_v2(
  'b7000000-0000-4000-8000-000000000005',
  '[{"learnerProfileId":"b3000000-0000-4000-8000-000000000001","wasPresent":true,"needsRepeat":false}]'::jsonb,
  'Завершено',
  '2026-08-19 10:25:00+09',
  20
);

select pg_temp.assert_raises(
  $sql$
    select *
    from public.save_lesson_component_observations(
      'b7000000-0000-4000-8000-000000000005',
      'b6000000-0000-4000-8000-000000000005',
      'После завершения',
      'Не должно сохраниться',
      'direct',
      '[{"learningRecordId":"b8000000-0000-4000-8000-000000000005","rating":null}]'::jsonb
    )
  $sql$,
  '55000',
  'lesson_run_not_open',
  'completed Run accepted observation mutation'
);

-- -------------------------------------------------------------------------
-- Component/Lesson deletion retains at-time evidence; subject erasure does
-- the opposite and physically cascades through the parent LearningRecord.
-- -------------------------------------------------------------------------

select count(*)
from public.save_lesson_component_observations(
  'b7000000-0000-4000-8000-000000000006',
  'b6000000-0000-4000-8000-000000000006',
  'Снимок компонента',
  'Сохраняет критерий',
  'direct',
  '[{
    "learningRecordId":"b8000000-0000-4000-8000-000000000006",
    "rating":"independent",
    "privateNote":"Сохранить заметку"
  }]'::jsonb
);

select public.complete_lesson_run_v2(
  'b7000000-0000-4000-8000-000000000006',
  '[{"learnerProfileId":"b3000000-0000-4000-8000-000000000001","wasPresent":true}]'::jsonb,
  null,
  '2026-08-19 10:25:00+09',
  20
);

reset role;
delete from public.lesson_component
where id = 'b6000000-0000-4000-8000-000000000006';

select pg_temp.assert_true(
  exists (
    select 1
    from public.lesson_component_observation
    where learning_record_id =
        'b8000000-0000-4000-8000-000000000006'
      and lesson_component_id is null
      and source_lesson_component_id_at_time =
        'b6000000-0000-4000-8000-000000000006'
      and component_position_at_time = 1
      and component_type_key_at_time = 'discussion'
      and component_label_at_time = 'Снимок компонента'
      and observable_criterion_at_time = 'Сохраняет критерий'
      and rating = 'independent'
      and private_note = 'Сохранить заметку'
  ),
  'Component deletion erased or rewrote at-time evidence'
);

select pg_temp.assert_true(
  public.delete_lesson_with_history(
    'b5000000-0000-4000-8000-000000000006'
  ),
  'owner could not delete the finalized Lesson with history'
);

select pg_temp.assert_true(
  not exists (
    select 1
    from public.lesson_run
    where id = 'b7000000-0000-4000-8000-000000000006'
  )
    and exists (
      select 1
      from public.learning_record
      where id = 'b8000000-0000-4000-8000-000000000006'
        and lesson_run_id is null
        and source_lesson_id is null
        and source_course_id =
          'b4000000-0000-4000-8000-000000000001'
        and occurred_at = '2026-08-19 10:25:00+09'::timestamptz
    )
    and exists (
      select 1
      from public.lesson_component_observation
      where learning_record_id =
        'b8000000-0000-4000-8000-000000000006'
        and lesson_component_id is null
        and source_lesson_component_id_at_time =
          'b6000000-0000-4000-8000-000000000006'
    ),
  'Lesson deletion did not retain finalized record and observation snapshots'
);

select set_config(
  'request.jwt.claim.sub',
  'b1000000-0000-4000-8000-000000000001',
  true
);
set local role authenticated;

select count(*)
from public.save_lesson_component_observations(
  'b7000000-0000-4000-8000-000000000007',
  'b6000000-0000-4000-8000-000000000007',
  'До удаления данных',
  'Данные принадлежат субъекту',
  'direct',
  '[{"learningRecordId":"b8000000-0000-4000-8000-000000000007","rating":"not_yet","privateNote":"Строго личная заметка LA-M1"}]'::jsonb
);

select public.complete_lesson_run_v2(
  'b7000000-0000-4000-8000-000000000007',
  '[{"learnerProfileId":"b3000000-0000-4000-8000-000000000003","wasPresent":true}]'::jsonb,
  null,
  '2026-08-19 10:25:00+09',
  20
);

reset role;

select set_config(
  'request.jwt.claim.sub',
  'b1000000-0000-4000-8000-000000000003',
  true
);
set local role authenticated;

select pg_temp.assert_true(
  position(
    'Строго личная заметка LA-M1'
    in public.get_my_learning_history(null, 25)::text
  ) = 0,
  'private observation note leaked into learner history projection'
);

reset role;
select set_config(
  'request.jwt.claim.sub',
  'b1000000-0000-4000-8000-000000000002',
  true
);
set local role authenticated;

select pg_temp.assert_true(
  position(
    'Строго личная заметка LA-M1'
    in public.get_observed_learner_history(
      'b3000000-0000-4000-8000-000000000003',
      null,
      25
    )::text
  ) = 0,
  'private observation note leaked into observer history projection'
);

reset role;

do $erasure$
declare
  v_preview jsonb;
begin
  perform set_config(
    'request.jwt.claim.sub',
    'b1000000-0000-4000-8000-000000000003',
    true
  );
  v_preview := public.preview_my_learning_data_erasure();
  perform public.confirm_my_learning_data_erasure(
    'b1000000-0000-4000-8000-000000000003',
    v_preview ->> 'previewFingerprint'
  );
end
$erasure$;

select pg_temp.assert_true(
  not exists (
    select 1
    from public.learning_record
    where id = 'b8000000-0000-4000-8000-000000000007'
  )
    and not exists (
      select 1
      from public.lesson_component_observation
      where learning_record_id =
        'b8000000-0000-4000-8000-000000000007'
    )
    and not exists (
      select 1
      from public.learner_profile
      where id = 'b3000000-0000-4000-8000-000000000003'
    )
    and (
      select count(*)
      from public.learner_profile
      where account_id = 'b2000000-0000-4000-8000-000000000003'
    ) = 1,
  'canonical learner erasure did not cascade observation deletion'
);

-- Multi-session race recipe (intentionally not executed here because this
-- rollback-only transaction cannot expose fixtures to a second session):
--
-- 1. On an expendable clone, commit one started Run with one draft Record.
-- 2. Session A:
--      begin;
--      select * from public.save_lesson_component_observations(...);
--      select pg_sleep(5);
--      commit;
--    Session B concurrently calls complete_lesson_run_v2(...). It must block
--    on Run/Record locks and then observe the committed rating;
--    `wasPresent=false` must fail with
--    lesson_run_absent_learner_has_observation.
-- 3. Reverse the order: Session A completes (or cancels), sleeps before commit;
--    Session B calls save_lesson_component_observations(...). It must block and
--    then fail closed (`lesson_run_not_open`) or find the cancelled draft gone.
--
-- The pg_get_functiondef assertions above make the required Run/Record locks a
-- checked part of this harness while the two-session recipe remains explicit.

select pg_temp.assert_true(
  exists (
    select 1
    from public.lesson_component_observation
    where learning_record_id =
      'b8000000-0000-4000-8000-000000000005'
  )
    and exists (
      select 1
      from public.lesson_component_observation
      where learning_record_id =
        'b8000000-0000-4000-8000-000000000006'
    ),
  'successful completion/retention fixtures vanished before rollback'
);

rollback;
SQL

echo "Learning-activity database acceptance suite passed; all fixtures rolled back."
