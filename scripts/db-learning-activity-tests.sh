#!/usr/bin/env bash
set -euo pipefail

# Transactional acceptance harness through LA-M4 learning activities.
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
  echo "Refusing LA-M4 fixtures for database '$db_name'; expected exactly 'shidao_learning_activity_test'." >&2
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
       and to_regclass('public.learning_objective') is not null
       and to_regclass('public.learning_evidence') is not null
       and to_regclass('public.learner_objective_state') is not null
       and to_regclass('public.learner_objective_state_evidence') is not null
       and to_regclass('public.learner_recommendation_override') is not null
       and to_regclass('public.course_learner_enrollment') is not null
       and to_regclass('public.lesson_run_execution_capability') is not null
       and to_regclass('public.lesson_run_presentation_state') is not null
       and to_regclass('auth.sessions') is not null
       and exists (
         select 1
         from information_schema.columns
         where table_schema = 'auth'
           and table_name = 'sessions'
           and column_name = 'not_after'
           and data_type = 'timestamp with time zone'
       )
       and exists (
         select 1
         from information_schema.columns
         where table_schema = 'public'
           and table_name = 'lesson_component_observation'
           and column_name = 'component_visibility_at_time'
       )
       and exists (
         select 1
         from information_schema.columns
         where table_schema = 'public'
           and table_name = 'learning_evidence'
           and column_name = 'component_visibility_at_time'
       )
       and exists (
         select 1
         from information_schema.columns
         where table_schema = 'public'
           and table_name = 'lesson_component'
           and column_name = 'primary_learning_objective_id'
       )
       and exists (
         select 1
         from information_schema.columns
         where table_schema = 'public'
           and table_name = 'lesson_component'
           and column_name = 'activity_role'
       )
       and (
         select count(*)
         from information_schema.columns
         where table_schema = 'public'
           and table_name = 'lesson_component_observation'
           and column_name in (
             'learning_objective_id',
             'source_learning_objective_id_at_time',
             'learning_objective_title_at_time'
           )
       ) = 3
       and to_regprocedure(
         'public.create_learning_objective(uuid,text,text)'
       ) is not null
       and to_regprocedure(
         'public.update_learning_objective(uuid,text,boolean,text,boolean)'
       ) is not null
       and to_regprocedure(
         'public.archive_learning_objective(uuid)'
       ) is not null
       and to_regprocedure(
         'public.update_lesson_component_v2(uuid,jsonb,boolean,jsonb,boolean,uuid,boolean,text,boolean)'
       ) is not null
       and to_regprocedure(
         'public.save_lesson_component_observations(uuid,uuid,text,text,text,jsonb)'
       ) is not null
       and to_regprocedure(
         'public.complete_lesson_run_v2(uuid,jsonb,text,timestamp with time zone,integer)'
       ) is not null
       and to_regprocedure(
         'public.correct_finalized_lesson_component_observation(uuid,uuid,uuid,text,text,text,uuid,timestamp with time zone)'
       ) is not null
       and to_regprocedure(
         'public.get_teacher_learning_record_correction_history(uuid[])'
       ) is not null
       and to_regprocedure(
         'public.get_teacher_learner_activity_profile(uuid)'
       ) is not null
       and to_regprocedure(
         'public.get_my_learning_activity_profile()'
       ) is not null
       and to_regprocedure(
         'public.get_observed_learner_activity_profile(uuid)'
       ) is not null
       and to_regprocedure(
         'public.build_course_learning_activity_context(uuid,uuid)'
       ) is not null
       and to_regprocedure(
         'public.build_cross_provider_learner_context(uuid,uuid)'
       ) is not null
       and to_regprocedure(
         'public.get_lesson_run_live_delivery_admin(uuid)'
       ) is not null
       and to_regprocedure(
         'public.set_lesson_run_live_access(uuid,uuid,boolean,boolean)'
       ) is not null
       and to_regprocedure(
         'public.set_lesson_run_presentation_cursor(uuid,uuid,bigint)'
       ) is not null
       and to_regprocedure(
         'public.resolve_lesson_run_live_source_admin(uuid,uuid,uuid)'
       ) is not null
       and to_regprocedure(
         'public.revoke_live_access_after_account_deactivation()'
       ) is not null
       and position(
         'lesson_run_absent_learner_has_observation'
         in pg_get_functiondef(to_regprocedure(
           'public.complete_lesson_run_v2(uuid,jsonb,text,timestamp with time zone,integer)'
         ))
       ) > 0
       and position(
         'for update of component'
         in lower(pg_get_functiondef(to_regprocedure(
           'public.save_lesson_component_observations(uuid,uuid,text,text,text,jsonb)'
         )))
       ) > 0
       and position(
         'for key share of objective'
         in lower(pg_get_functiondef(to_regprocedure(
           'public.save_lesson_component_observations(uuid,uuid,text,text,text,jsonb)'
         )))
       ) > 0
       and position(
         'for update of course'
         in lower(pg_get_functiondef(to_regprocedure(
           'public.update_lesson_component_v2(uuid,jsonb,boolean,jsonb,boolean,uuid,boolean,text,boolean)'
         )))
       ) > 0
       and position(
         'for update of lesson'
         in lower(pg_get_functiondef(to_regprocedure(
           'public.update_lesson_component_v2(uuid,jsonb,boolean,jsonb,boolean,uuid,boolean,text,boolean)'
         )))
       ) > position(
         'for update of course'
         in lower(pg_get_functiondef(to_regprocedure(
           'public.update_lesson_component_v2(uuid,jsonb,boolean,jsonb,boolean,uuid,boolean,text,boolean)'
         )))
       )
     then 'shidao-learning-activity-la-m4' else '' end"
)"
if [[ "$schema_marker" != "shidao-learning-activity-la-m4" ]]; then
  echo "Refusing fixtures: '$db_name' is not a fully migrated ShiDao LA-M4 test database." >&2
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
    or to_regclass('public.learning_objective') is null
    or to_regclass('public.learning_evidence') is null
    or to_regclass('public.learner_objective_state') is null
    or to_regclass('public.learner_objective_state_evidence') is null
    or to_regclass('public.learner_recommendation_override') is null
    or to_regclass('public.course_learner_enrollment') is null
    or to_regclass('public.lesson_run_execution_capability') is null
    or to_regclass('public.lesson_run_presentation_state') is null
    or to_regclass('auth.sessions') is null
    or not exists (
      select 1
      from information_schema.columns
      where table_schema = 'auth'
        and table_name = 'sessions'
        and column_name = 'not_after'
        and data_type = 'timestamp with time zone'
    )
    or not exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'lesson_component'
        and column_name = 'primary_learning_objective_id'
    )
    or not exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'lesson_component'
        and column_name = 'activity_role'
    )
    or (
      select count(*)
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'lesson_component_observation'
        and column_name in (
          'learning_objective_id',
          'source_learning_objective_id_at_time',
          'learning_objective_title_at_time'
        )
    ) <> 3
    or to_regprocedure(
      'public.create_learning_objective(uuid,text,text)'
    ) is null
    or to_regprocedure(
      'public.update_learning_objective(uuid,text,boolean,text,boolean)'
    ) is null
    or to_regprocedure(
      'public.archive_learning_objective(uuid)'
    ) is null
    or to_regprocedure(
      'public.update_lesson_component_v2(uuid,jsonb,boolean,jsonb,boolean,uuid,boolean,text,boolean)'
    ) is null
    or to_regprocedure(
      'public.save_lesson_component_observations(uuid,uuid,text,text,text,jsonb)'
    ) is null
    or to_regprocedure(
      'public.complete_lesson_run_v2(uuid,jsonb,text,timestamp with time zone,integer)'
    ) is null
    or to_regprocedure(
      'public.correct_finalized_lesson_component_observation(uuid,uuid,uuid,text,text,text,uuid,timestamp with time zone)'
    ) is null
    or to_regprocedure(
      'public.get_teacher_learner_activity_profile(uuid)'
    ) is null
    or to_regprocedure(
      'public.get_my_learning_activity_profile()'
    ) is null
    or to_regprocedure(
      'public.get_observed_learner_activity_profile(uuid)'
    ) is null
    or to_regprocedure(
      'public.build_course_learning_activity_context(uuid,uuid)'
    ) is null
    or to_regprocedure(
      'public.get_lesson_run_live_delivery_admin(uuid)'
    ) is null
    or to_regprocedure(
      'public.set_lesson_run_live_access(uuid,uuid,boolean,boolean)'
    ) is null
    or to_regprocedure(
      'public.set_lesson_run_presentation_cursor(uuid,uuid,bigint)'
    ) is null
    or to_regprocedure(
      'public.resolve_lesson_run_live_source_admin(uuid,uuid,uuid)'
    ) is null
    or to_regprocedure(
      'public.revoke_live_access_after_account_deactivation()'
    ) is null
    or position(
      'for update of component'
      in lower(pg_get_functiondef(to_regprocedure(
        'public.save_lesson_component_observations(uuid,uuid,text,text,text,jsonb)'
      )))
    ) = 0
    or position(
      'for key share of objective'
      in lower(pg_get_functiondef(to_regprocedure(
        'public.save_lesson_component_observations(uuid,uuid,text,text,text,jsonb)'
      )))
    ) = 0
    or position(
      'for update of course'
      in lower(pg_get_functiondef(to_regprocedure(
        'public.update_lesson_component_v2(uuid,jsonb,boolean,jsonb,boolean,uuid,boolean,text,boolean)'
      )))
    ) = 0
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
  not exists (
    select 1
    from (
      values
        ('course_learner_enrollment'),
        ('lesson_run_execution_capability'),
        ('lesson_run_presentation_state')
    ) as expected(table_name)
    where not exists (
      select 1
      from pg_class as relation
      join pg_namespace as namespace on namespace.oid = relation.relnamespace
      where namespace.nspname = 'public'
        and relation.relname = expected.table_name
        and relation.relrowsecurity
    )
      or exists (
        select 1
        from pg_policies as policy
        where policy.schemaname = 'public'
          and policy.tablename = expected.table_name
      )
      or has_table_privilege(
        'anon', 'public.' || expected.table_name, 'SELECT'
      )
      or has_table_privilege(
        'authenticated', 'public.' || expected.table_name, 'SELECT'
      )
      or has_table_privilege(
        'service_role', 'public.' || expected.table_name, 'SELECT'
      )
      or has_table_privilege(
        'authenticated', 'public.' || expected.table_name, 'INSERT'
      )
      or has_table_privilege(
        'service_role', 'public.' || expected.table_name, 'UPDATE'
      )
  ),
  'LA-M4 raw table RLS/ACL is not closed'
);

select pg_temp.assert_true(
  has_function_privilege(
    'authenticated',
    'public.get_lesson_run_live_delivery_admin(uuid)',
    'EXECUTE'
  )
    and has_function_privilege(
      'authenticated',
      'public.set_lesson_run_live_access(uuid,uuid,boolean,boolean)',
      'EXECUTE'
    )
    and has_function_privilege(
      'authenticated',
      'public.set_lesson_run_presentation_cursor(uuid,uuid,bigint)',
      'EXECUTE'
    )
    and not has_function_privilege(
      'authenticated',
      'public.resolve_lesson_run_live_source_admin(uuid,uuid,uuid)',
      'EXECUTE'
    )
    and has_function_privilege(
      'service_role',
      'public.resolve_lesson_run_live_source_admin(uuid,uuid,uuid)',
      'EXECUTE'
    )
    and not has_function_privilege(
      'service_role',
      'public.get_lesson_run_live_delivery_admin(uuid)',
      'EXECUTE'
    )
    and not has_function_privilege(
      'anon',
      'public.resolve_lesson_run_live_source_admin(uuid,uuid,uuid)',
      'EXECUTE'
    ),
  'LA-M4 teacher/service resolver RPC ACL is wrong'
);

select pg_temp.assert_true(
  not exists (
    select 1
    from unnest(array[
      'public.guard_course_learner_enrollment()',
      'public.guard_lesson_run_execution_capability()',
      'public.guard_lesson_run_presentation_state()',
      'public.clear_deleted_lesson_run_presentation_cursor()',
      'public.revoke_course_learner_live_access(uuid,uuid,uuid,text)',
      'public.revoke_live_access_after_learner_account_change()',
      'public.guard_course_owner_change_with_live_access()',
      'public.revoke_live_access_after_course_archive()',
      'public.revoke_live_access_after_account_deactivation()'
    ]) as helper(signature)
    cross join unnest(array['anon', 'authenticated', 'service_role'])
      as actor(role_name)
    where has_function_privilege(
      actor.role_name,
      helper.signature,
      'EXECUTE'
    )
  ),
  'LA-M4 internal trigger/helper EXECUTE ACL is open'
);

select pg_temp.assert_true(
  (
    select count(*) = 4
      and bool_and(procedure.prosecdef)
      and bool_and(
        procedure.proconfig @> array['search_path=""']::text[]
      )
    from pg_proc as procedure
    where procedure.oid in (
      to_regprocedure('public.get_lesson_run_live_delivery_admin(uuid)'),
      to_regprocedure(
        'public.set_lesson_run_live_access(uuid,uuid,boolean,boolean)'
      ),
      to_regprocedure(
        'public.set_lesson_run_presentation_cursor(uuid,uuid,bigint)'
      ),
      to_regprocedure(
        'public.resolve_lesson_run_live_source_admin(uuid,uuid,uuid)'
      )
    )
  ),
  'LA-M4 RPC SECURITY DEFINER/search_path contract is wrong'
);

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
  exists (
    select 1
    from pg_class as relation
    where relation.oid = 'public.learning_objective'::regclass
      and relation.relrowsecurity
  ),
  'learning-objective RLS is not enabled'
);

select pg_temp.assert_true(
  not exists (
    select 1
    from (
      values
        ('learning_evidence'),
        ('learner_objective_state'),
        ('learner_objective_state_evidence'),
        ('learner_recommendation_override')
    ) as expected(table_name)
    where not exists (
      select 1
      from pg_class as relation
      join pg_namespace as namespace on namespace.oid = relation.relnamespace
      where namespace.nspname = 'public'
        and relation.relname = expected.table_name
        and relation.relrowsecurity
    )
  ),
  'one or more LA-M3 evidence/profile tables lack RLS'
);

select pg_temp.assert_true(
  not exists (
    select 1
    from (
      values
        ('learning_evidence'),
        ('learner_objective_state'),
        ('learner_objective_state_evidence'),
        ('learner_recommendation_override')
    ) as expected(table_name)
    where has_table_privilege(
      'service_role', 'public.' || expected.table_name, 'SELECT'
    )
      or has_table_privilege(
        'authenticated', 'public.' || expected.table_name, 'INSERT'
      )
      or has_table_privilege(
        'authenticated', 'public.' || expected.table_name, 'UPDATE'
      )
      or has_table_privilege(
        'authenticated', 'public.' || expected.table_name, 'DELETE'
      )
      or not has_table_privilege(
        'authenticated', 'public.' || expected.table_name, 'SELECT'
      )
  ),
  'LA-M3 raw table ACL is broader than recorder-scoped SELECT'
);

select pg_temp.assert_true(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.learning_evidence'::regclass
      and conname = 'learning_evidence_record_identity_fkey'
      and contype = 'f'
      and convalidated
  )
    and exists (
      select 1
      from pg_constraint
      where conrelid =
        'public.learner_objective_state_evidence'::regclass
        and conname =
          'learner_objective_state_evidence_state_identity_fkey'
        and contype = 'f'
        and convalidated
    )
    and exists (
      select 1
      from pg_constraint
      where conrelid =
        'public.learner_objective_state_evidence'::regclass
        and conname =
          'learner_objective_state_evidence_fact_identity_fkey'
        and contype = 'f'
        and convalidated
    ),
  'LA-M3 evidence/state identity constraints are absent'
);

select pg_temp.assert_true(
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'lesson_component_observation'
      and column_name = 'component_visibility_at_time'
      and is_nullable = 'YES'
  )
    and exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'learning_evidence'
        and column_name = 'component_visibility_at_time'
        and is_nullable = 'NO'
    )
    and exists (
      select 1
      from pg_trigger
      where tgrelid = 'public.lesson_component_observation'::regclass
        and tgname = 'trg_observation_component_visibility'
        and not tgisinternal
    ),
  'LA-M3 visibility-at-time capture contract is absent'
);

select pg_temp.assert_true(
  has_function_privilege(
    'service_role',
    'public.complete_lesson_run_v2(uuid,jsonb,text,timestamp with time zone,integer)',
    'EXECUTE'
  )
    and has_function_privilege(
    'authenticated',
    'public.get_teacher_learner_activity_profile(uuid)',
    'EXECUTE'
  )
    and has_function_privilege(
      'authenticated',
      'public.get_teacher_learning_record_correction_history(uuid[])',
      'EXECUTE'
    )
    and not has_function_privilege(
      'service_role',
      'public.get_teacher_learning_record_correction_history(uuid[])',
      'EXECUTE'
    )
    and has_function_privilege(
      'authenticated',
      'public.get_my_learning_activity_profile()',
      'EXECUTE'
    )
    and has_function_privilege(
      'authenticated',
      'public.get_observed_learner_activity_profile(uuid)',
      'EXECUTE'
    )
    and not has_function_privilege(
      'authenticated',
      'public.build_course_learning_activity_context(uuid,uuid)',
      'EXECUTE'
    )
    and has_function_privilege(
      'service_role',
      'public.build_course_learning_activity_context(uuid,uuid)',
      'EXECUTE'
    )
    and has_function_privilege(
      'service_role',
      'public.build_cross_provider_learner_context(uuid,uuid)',
      'EXECUTE'
    )
    and not has_function_privilege(
      'authenticated',
      'public.build_cross_provider_learner_context(uuid,uuid)',
      'EXECUTE'
    )
    and not has_function_privilege(
      'authenticated',
      'public.rebuild_learner_objective_states(uuid,uuid,timestamp with time zone)',
      'EXECUTE'
    ),
  'LA-M3 completion/profile/provider/rebuild RPC ACL is wrong'
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
  (
    select count(*)
    from pg_policies as policy
    where policy.schemaname = 'public'
      and policy.tablename = 'learning_objective'
      and policy.policyname = 'learning_objective_course_owner_select'
      and policy.cmd = 'SELECT'
  ) = 1,
  'Course-owner learning-objective SELECT policy is missing or duplicated'
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
  has_table_privilege(
    'authenticated',
    'public.learning_objective',
    'SELECT'
  )
    and not has_table_privilege(
      'authenticated',
      'public.learning_objective',
      'INSERT'
    )
    and not has_table_privilege(
      'authenticated',
      'public.learning_objective',
      'UPDATE'
    )
    and not has_table_privilege(
      'authenticated',
      'public.learning_objective',
      'DELETE'
    )
    and not has_table_privilege(
      'anon',
      'public.learning_objective',
      'SELECT'
    ),
  'learning-objective table ACL is broader than owner-scoped SELECT'
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
  (
    select count(*) = 3
      and bool_and(procedure.prosecdef)
      and bool_and(
        procedure.proconfig @> array['search_path=""']::text[]
      )
      and bool_and(
        has_function_privilege(
          'authenticated',
          procedure.oid,
          'EXECUTE'
        )
      )
      and bool_and(
        not has_function_privilege('anon', procedure.oid, 'EXECUTE')
      )
      and bool_and(
        not has_function_privilege('service_role', procedure.oid, 'EXECUTE')
      )
    from pg_proc as procedure
    where procedure.oid in (
      to_regprocedure('public.create_learning_objective(uuid,text,text)'),
      to_regprocedure(
        'public.update_learning_objective(uuid,text,boolean,text,boolean)'
      ),
      to_regprocedure('public.archive_learning_objective(uuid)')
    )
  ),
  'learning-objective RPC SECURITY DEFINER or EXECUTE ACL is wrong'
);

select pg_temp.assert_true(
  exists (
    select 1
    from pg_proc as procedure
    where procedure.oid = to_regprocedure(
        'public.update_lesson_component_v2(uuid,jsonb,boolean,jsonb,boolean,uuid,boolean,text,boolean)'
      )
      and procedure.prosecdef
      and procedure.proretset
      and procedure.proconfig @> array['search_path=""']::text[]
  )
    and has_function_privilege(
      'authenticated',
      'public.update_lesson_component_v2(uuid,jsonb,boolean,jsonb,boolean,uuid,boolean,text,boolean)',
      'EXECUTE'
    )
    and not has_function_privilege(
      'anon',
      'public.update_lesson_component_v2(uuid,jsonb,boolean,jsonb,boolean,uuid,boolean,text,boolean)',
      'EXECUTE'
    )
    and not has_function_privilege(
      'service_role',
      'public.update_lesson_component_v2(uuid,jsonb,boolean,jsonb,boolean,uuid,boolean,text,boolean)',
      'EXECUTE'
    ),
  'Component update RPC SECURITY DEFINER or EXECUTE ACL is wrong'
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
    )
    and exists (
      select 1
      from pg_constraint
      where conrelid = 'public.lesson_component'::regclass
        and conname = 'lesson_component_primary_learning_objective_fkey'
        and contype = 'f'
        and confdeltype = 'n'
        and convalidated
    )
    and exists (
      select 1
      from pg_constraint
      where conrelid = 'public.lesson_component_observation'::regclass
        and conname = 'lesson_component_observation_live_objective_fkey'
        and contype = 'f'
        and confdeltype = 'n'
        and convalidated
    )
    and exists (
      select 1
      from pg_constraint
      where conrelid = 'public.lesson_component_observation'::regclass
        and conname = 'lesson_component_observation_objective_context_check'
        and contype = 'c'
        and convalidated
    )
    and exists (
      select 1
      from pg_constraint
      where conrelid = 'public.lesson_component'::regclass
        and conname = 'lesson_component_activity_role_check'
        and contype = 'c'
        and convalidated
    ),
  'recorder, erasure, alignment, or objective provenance constraints are wrong'
);

with definition as (
  select lower(pg_get_functiondef(to_regprocedure(
    'public.save_lesson_component_observations(uuid,uuid,text,text,text,jsonb)'
  ))) as body
)
select pg_temp.assert_true(
  position('for update of lesson' in body) > 0
    and position('for update of component' in body)
      > position('for update of lesson' in body)
    and position('for key share of objective' in body)
      > position('for update of component' in body)
    and position('for update of run' in body)
      > position('for key share of objective' in body)
    and position('for update of record' in body)
      > position('for update of run' in body)
    and position(
      'lesson_run_absent_learner_has_observation'
      in pg_get_functiondef(to_regprocedure(
        'public.complete_lesson_run_v2(uuid,jsonb,text,timestamp with time zone,integer)'
      ))
    ) > 0,
  'Lesson/Component/Objective/Run/Record serialization contract is absent'
)
from definition;

select pg_temp.assert_true(
  position(
    'for update of course'
    in lower(pg_get_functiondef(to_regprocedure(
      'public.update_learning_objective(uuid,text,boolean,text,boolean)'
    )))
  ) > 0
    and position(
      'for update of objective'
      in lower(pg_get_functiondef(to_regprocedure(
        'public.update_learning_objective(uuid,text,boolean,text,boolean)'
      )))
    ) > position(
      'for update of course'
      in lower(pg_get_functiondef(to_regprocedure(
        'public.update_learning_objective(uuid,text,boolean,text,boolean)'
      )))
    )
    and position(
      'for update of objective'
      in lower(pg_get_functiondef(to_regprocedure(
        'public.archive_learning_objective(uuid)'
      )))
    ) > position(
      'for update of course'
      in lower(pg_get_functiondef(to_regprocedure(
        'public.archive_learning_objective(uuid)'
      )))
    ),
  'objective RPC Course-before-Objective lock order is absent'
);

with definition as (
  select lower(pg_get_functiondef(to_regprocedure(
    'public.update_lesson_component_v2(uuid,jsonb,boolean,jsonb,boolean,uuid,boolean,text,boolean)'
  ))) as body
)
select pg_temp.assert_true(
  position('for update of course' in body) > 0
    and position('for update of lesson' in body)
      > position('for update of course' in body)
    and position('for update of component' in body)
      > position('for update of lesson' in body)
    and position('for key share of objective' in body)
      > position('for update of component' in body),
  'Component update RPC Course/Lesson/Component/Objective lock order is absent'
)
from definition;

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
values
  (
    'b4000000-0000-4000-8000-000000000001',
    'b2000000-0000-4000-8000-000000000001',
    'LA-M2 acceptance course',
    'Русский язык',
    'learner_profile',
    'children'
  ),
  (
    'b4000000-0000-4000-8000-000000000002',
    'b2000000-0000-4000-8000-000000000001',
    'LA-M2 cross-Course objective fixture',
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

insert into public.lesson_component (
  id,
  lesson_id,
  position,
  type_key,
  payload,
  placement_config,
  visibility
)
values
  (
    'b6000000-0000-4000-8000-000000000008',
    'b5000000-0000-4000-8000-000000000001',
    2,
    'choice_quiz',
    '{}'::jsonb,
    '{}'::jsonb,
    'staff_only'
  ),
  (
    'b6000000-0000-4000-8000-000000000009',
    'b5000000-0000-4000-8000-000000000001',
    3,
    'single_choice_poll',
    '{}'::jsonb,
    '{}'::jsonb,
    'staff_only'
  );

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

-- Fixture bootstrap runs with triggers disabled so the local auth clone does
-- not synthesize duplicate identities. Mirror the stable source fields that
-- the LA-M3 insert trigger captures on ordinary runtime-created records.
update public.learning_record as record
set source_course_id_at_time = record.source_course_id,
    source_lesson_id_at_time = record.source_lesson_id,
    source_lesson_run_id_at_time = record.lesson_run_id
where record.id in (
  'b8000000-0000-4000-8000-000000000001',
  'b8000000-0000-4000-8000-000000000002',
  'b8000000-0000-4000-8000-000000000003',
  'b8000000-0000-4000-8000-000000000004',
  'b8000000-0000-4000-8000-000000000005',
  'b8000000-0000-4000-8000-000000000006',
  'b8000000-0000-4000-8000-000000000007'
);

-- A pre-LA-M2-shaped row proves the additive columns remain all-null for
-- legacy observations. It deliberately omits every objective column.
insert into public.lesson_component_observation (
  id,
  learning_record_id,
  lesson_component_id,
  source_lesson_component_id_at_time,
  component_position_at_time,
  component_type_key_at_time,
  component_label_at_time,
  observable_criterion_at_time,
  rating,
  entry_method,
  private_note,
  observed_at,
  recorded_by_account_id
)
values (
  'b9000000-0000-4000-8000-000000000001',
  'b8000000-0000-4000-8000-000000000001',
  'b6000000-0000-4000-8000-000000000001',
  'b6000000-0000-4000-8000-000000000001',
  1,
  'discussion',
  'Legacy LA-M1 observation',
  'Legacy criterion',
  'independent',
  'direct',
  null,
  '2026-08-19 10:01:00+09',
  'b2000000-0000-4000-8000-000000000001'
);

-- LA-M4 uses a separate Course with no effective learner audience to prove
-- that explicit enrollment plus the frozen Run roster is authority; Course
-- audience is deliberately not consulted. One roster learner is linked to an
-- active Account and one remains offline.
insert into public.account_security (
  account_id,
  sessions_invalid_before
) values
  (
    'b2000000-0000-4000-8000-000000000002',
    null
  ),
  (
    'b2000000-0000-4000-8000-000000000003',
    null
  )
on conflict (account_id) do update
set sessions_invalid_before = null;

insert into auth.sessions (
  id,
  user_id,
  created_at,
  updated_at,
  not_after
)
values
  (
    'bf100000-0000-4000-8000-000000000001',
    'b1000000-0000-4000-8000-000000000003',
    '2026-08-19 09:00:00+09',
    '2026-08-19 09:00:00+09',
    null
  ),
  (
    'bf100000-0000-4000-8000-000000000002',
    'b1000000-0000-4000-8000-000000000002',
    '2026-08-19 09:00:00+09',
    '2026-08-19 09:00:00+09',
    null
  ),
  (
    'bf100000-0000-4000-8000-000000000003',
    'b1000000-0000-4000-8000-000000000003',
    '2026-08-19 08:00:00+09',
    '2026-08-19 08:00:00+09',
    '2026-08-19 08:30:00+09'
  );

insert into public.course (
  id,
  owner_account_id,
  title,
  subject,
  audience_type,
  learning_audience
) values (
  'bf400000-0000-4000-8000-000000000001',
  'b2000000-0000-4000-8000-000000000001',
  'LA-M4 no-audience live-delivery fixture',
  'Русский язык',
  'none',
  'children'
);

insert into public.lesson (id, course_id, position, title)
values
  (
    'bf500000-0000-4000-8000-000000000001',
    'bf400000-0000-4000-8000-000000000001',
    1,
    'LA-M4 live delivery'
  ),
  (
    'bf500000-0000-4000-8000-000000000002',
    'bf400000-0000-4000-8000-000000000001',
    2,
    'LA-M4 cancellation delivery'
  );

insert into public.lesson_student_slide (id, lesson_id, position)
values (
  'bf550000-0000-4000-8000-000000000001',
  'bf500000-0000-4000-8000-000000000001',
  1
);

insert into public.lesson_component (
  id,
  lesson_id,
  position,
  type_key,
  payload,
  placement_config,
  visibility,
  student_slide_id
) values
  (
    'bf600000-0000-4000-8000-000000000001',
    'bf500000-0000-4000-8000-000000000001',
    1,
    'rich_text',
    '{"content":"LA_M4_LEARNER_LIVE_SENTINEL"}'::jsonb,
    '{}'::jsonb,
    'learner_visible',
    'bf550000-0000-4000-8000-000000000001'
  ),
  (
    'bf600000-0000-4000-8000-000000000003',
    'bf500000-0000-4000-8000-000000000001',
    2,
    'discussion',
    '{"prompt":"LA_M4_STAFF_ONLY_SENTINEL"}'::jsonb,
    '{}'::jsonb,
    'staff_only',
    null
  );

insert into public.lesson_run (
  id,
  lesson_id,
  scheduled_at,
  planned_duration_minutes
) values
  (
    'bf700000-0000-4000-8000-000000000001',
    'bf500000-0000-4000-8000-000000000001',
    '2026-08-19 11:00:00+09',
    45
  ),
  (
    'bf700000-0000-4000-8000-000000000002',
    'bf500000-0000-4000-8000-000000000002',
    '2026-08-19 12:00:00+09',
    45
  );

insert into public.learning_record (
  id,
  learner_profile_id,
  lesson_run_id,
  source_course_id,
  source_lesson_id,
  source_course_id_at_time,
  source_lesson_id_at_time,
  source_lesson_run_id_at_time,
  recorded_by_account_id
) values
  (
    'bf800000-0000-4000-8000-000000000001',
    'b3000000-0000-4000-8000-000000000003',
    'bf700000-0000-4000-8000-000000000001',
    'bf400000-0000-4000-8000-000000000001',
    'bf500000-0000-4000-8000-000000000001',
    'bf400000-0000-4000-8000-000000000001',
    'bf500000-0000-4000-8000-000000000001',
    'bf700000-0000-4000-8000-000000000001',
    'b2000000-0000-4000-8000-000000000001'
  ),
  (
    'bf800000-0000-4000-8000-000000000002',
    'b3000000-0000-4000-8000-000000000002',
    'bf700000-0000-4000-8000-000000000001',
    'bf400000-0000-4000-8000-000000000001',
    'bf500000-0000-4000-8000-000000000001',
    'bf400000-0000-4000-8000-000000000001',
    'bf500000-0000-4000-8000-000000000001',
    'bf700000-0000-4000-8000-000000000001',
    'b2000000-0000-4000-8000-000000000001'
  ),
  (
    'bf800000-0000-4000-8000-000000000003',
    'b3000000-0000-4000-8000-000000000003',
    'bf700000-0000-4000-8000-000000000002',
    'bf400000-0000-4000-8000-000000000001',
    'bf500000-0000-4000-8000-000000000002',
    'bf400000-0000-4000-8000-000000000001',
    'bf500000-0000-4000-8000-000000000002',
    'bf700000-0000-4000-8000-000000000002',
    'b2000000-0000-4000-8000-000000000001'
  );

-- Preserve a superseded row on the live Run, as LA-M3 correction does.  The
-- teacher workspace and start roster must project only the canonical-current
-- replacement, never duplicate the learner because history remains attached
-- to the same Run/profile.
update public.learning_record
set superseded_by_record_id =
  'bf800000-0000-4000-8000-000000000004'
where id = 'bf800000-0000-4000-8000-000000000001';

insert into public.learning_record (
  id,
  learner_profile_id,
  lesson_run_id,
  source_course_id,
  source_lesson_id,
  source_course_id_at_time,
  source_lesson_id_at_time,
  source_lesson_run_id_at_time,
  recorded_by_account_id
) values (
  'bf800000-0000-4000-8000-000000000004',
  'b3000000-0000-4000-8000-000000000003',
  'bf700000-0000-4000-8000-000000000001',
  'bf400000-0000-4000-8000-000000000001',
  'bf500000-0000-4000-8000-000000000001',
  'bf400000-0000-4000-8000-000000000001',
  'bf500000-0000-4000-8000-000000000001',
  'bf700000-0000-4000-8000-000000000001',
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
-- LA-M2 objective ownership, alignment and activity-role semantics.
-- -------------------------------------------------------------------------

select id::text as active_objective_id
from public.create_learning_objective(
  'b4000000-0000-4000-8000-000000000001',
  '  Формулирует доказательство  ',
  '  Исходное описание  '
)
\gset

select pg_temp.assert_true(
  exists (
    select 1
    from public.learning_objective
    where id = :'active_objective_id'::uuid
      and course_id = 'b4000000-0000-4000-8000-000000000001'
      and title = 'Формулирует доказательство'
      and description = 'Исходное описание'
      and archived_at is null
  ),
  'owner create RPC lost normalized objective fields'
);

select id
from public.update_learning_objective(
  :'active_objective_id'::uuid,
  '  Объясняет решение по шагам  ',
  true,
  null,
  false
);

select pg_temp.assert_true(
  exists (
    select 1
    from public.learning_objective
    where id = :'active_objective_id'::uuid
      and title = 'Объясняет решение по шагам'
      and description = 'Исходное описание'
      and archived_at is null
  ),
  'owner update RPC cleared an omitted description or lost the title'
);

select id::text as archived_objective_id
from public.create_learning_objective(
  'b4000000-0000-4000-8000-000000000001',
  'Архивная цель',
  null
)
\gset

select pg_temp.assert_true(
  archived_at is not null,
  'owner archive RPC did not archive its objective'
)
from public.archive_learning_objective(:'archived_objective_id'::uuid);

select id::text as cross_course_objective_id
from public.create_learning_objective(
  'b4000000-0000-4000-8000-000000000002',
  'Цель другого курса',
  null
)
\gset

select pg_temp.assert_true(
  learning_objective_id is null
    and source_learning_objective_id_at_time is null
    and learning_objective_title_at_time is null,
  'legacy LA-M1 observation gained objective provenance'
)
from public.lesson_component_observation
where id = 'b9000000-0000-4000-8000-000000000001';

select id
from public.update_lesson_component_v2(
  'b6000000-0000-4000-8000-000000000008',
  null,
  false,
  null,
  false,
  null,
  false,
  'practice',
  true
);

select id
from public.update_lesson_component_v2(
  'b6000000-0000-4000-8000-000000000008',
  null,
  false,
  null,
  false,
  null,
  false,
  'assessment',
  true
);

select id
from public.update_lesson_component_v2(
  'b6000000-0000-4000-8000-000000000009',
  null,
  false,
  null,
  false,
  null,
  false,
  'survey',
  true
);

select pg_temp.assert_true(
  exists (
    select 1
    from public.lesson_component
    where id = 'b6000000-0000-4000-8000-000000000008'
      and type_key = 'choice_quiz'
      and activity_role = 'assessment'
  )
    and exists (
      select 1
      from public.lesson_component
      where id = 'b6000000-0000-4000-8000-000000000009'
        and type_key = 'single_choice_poll'
        and activity_role = 'survey'
    ),
  'supported activity roles were not persisted'
);

select pg_temp.assert_raises(
  $sql$
    select *
    from public.update_lesson_component_v2(
      'b6000000-0000-4000-8000-000000000001',
      null, false, null, false, null, false, 'assessment', true
    )
  $sql$,
  '23514',
  'lesson_component_activity_role_unsupported',
  'passive Component accepted an assessable activity role'
);

select pg_temp.assert_raises(
  $sql$
    select *
    from public.update_lesson_component_v2(
      'b6000000-0000-4000-8000-000000000008',
      null, false, null, false, null, false, 'survey', true
    )
  $sql$,
  '23514',
  'lesson_component_activity_role_unsupported',
  'assessable Component accepted survey role'
);

select pg_temp.assert_raises(
  $sql$
    select *
    from public.update_lesson_component_v2(
      'b6000000-0000-4000-8000-000000000009',
      null, false, null, false, null, false, 'practice', true
    )
  $sql$,
  '23514',
  'lesson_component_activity_role_unsupported',
  'poll Component accepted practice role'
);

select pg_temp.assert_raises(
  format(
    'select * from public.update_lesson_component_v2(%L::uuid, null, false, null, false, %L::uuid, true, null, false)',
    'b6000000-0000-4000-8000-000000000008',
    :'cross_course_objective_id'
  ),
  '23514',
  'lesson_component_learning_objective_cross_course',
  'Component accepted an objective from another Course'
);

select pg_temp.assert_raises(
  format(
    'select * from public.update_lesson_component_v2(%L::uuid, null, false, null, false, %L::uuid, true, null, false)',
    'b6000000-0000-4000-8000-000000000008',
    :'archived_objective_id'
  ),
  '23514',
  'lesson_component_learning_objective_archived',
  'new Component alignment accepted an archived objective'
);

select id
from public.update_lesson_component_v2(
  'b6000000-0000-4000-8000-000000000002',
  null,
  false,
  null,
  false,
  :'active_objective_id'::uuid,
  true,
  null,
  false
);

select pg_temp.assert_true(
  primary_learning_objective_id = :'active_objective_id'::uuid
    and activity_role is null,
  'active same-Course objective alignment was not persisted'
)
from public.lesson_component
where id = 'b6000000-0000-4000-8000-000000000002';

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
    and bool_and(entry_method = 'direct')
    and bool_and(
      learning_objective_id = :'active_objective_id'::uuid
    )
    and bool_and(
      source_learning_objective_id_at_time = :'active_objective_id'::uuid
    )
    and bool_and(
      learning_objective_title_at_time = 'Объясняет решение по шагам'
    ),
  'owner reload lost compact context, objective provenance, or recorder identity'
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

select pg_temp.assert_true(
  (
    select count(*)
    from public.learning_objective
    where course_id in (
      'b4000000-0000-4000-8000-000000000001',
      'b4000000-0000-4000-8000-000000000002'
    )
  ) = 0,
  'foreign authenticated account read another owner''s objectives'
);

select pg_temp.assert_raises(
  $sql$
    select *
    from public.create_learning_objective(
      'b4000000-0000-4000-8000-000000000001',
      'Чужая цель',
      null
    )
  $sql$,
  'P0002',
  'learning_objective_not_found',
  'foreign account created an objective in the owner Course'
);

select pg_temp.assert_raises(
  format(
    'select * from public.update_learning_objective(%L::uuid, %L, true, null, false)',
    :'active_objective_id',
    'Чужое изменение'
  ),
  'P0002',
  'learning_objective_not_found',
  'foreign account updated the owner objective'
);

select pg_temp.assert_raises(
  format(
    'select * from public.archive_learning_objective(%L::uuid)',
    :'active_objective_id'
  ),
  'P0002',
  'learning_objective_not_found',
  'foreign account archived the owner objective'
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
  archived_at is not null,
  'owner could not archive the objective captured by observations'
)
from public.archive_learning_objective(:'active_objective_id'::uuid);

select pg_temp.assert_true(
  count(*) = 2
    and bool_and(learning_objective_id = :'active_objective_id'::uuid)
    and bool_and(
      source_learning_objective_id_at_time = :'active_objective_id'::uuid
    )
    and bool_and(
      learning_objective_title_at_time = 'Объясняет решение по шагам'
    ),
  'objective archival changed persisted observation provenance'
)
from public.lesson_component_observation
where learning_record_id in (
  'b8000000-0000-4000-8000-000000000002',
  'b8000000-0000-4000-8000-000000000003'
);

reset role;
delete from public.learning_objective
where id = :'active_objective_id'::uuid;

select set_config(
  'request.jwt.claim.sub',
  'b1000000-0000-4000-8000-000000000001',
  true
);
set local role authenticated;

select pg_temp.assert_true(
  count(*) = 2
    and bool_and(learning_objective_id is null)
    and bool_and(
      source_learning_objective_id_at_time = :'active_objective_id'::uuid
    )
    and bool_and(
      learning_objective_title_at_time = 'Объясняет решение по шагам'
    )
    and not exists (
      select 1
      from public.lesson_component
      where id = 'b6000000-0000-4000-8000-000000000002'
        and primary_learning_objective_id is not null
    ),
  'objective deletion did not null live FKs while retaining at-time provenance'
)
from public.lesson_component_observation
where learning_record_id in (
  'b8000000-0000-4000-8000-000000000002',
  'b8000000-0000-4000-8000-000000000003'
);

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

-- Keep one live LA-M3 objective aligned to the three finalized-run fixtures
-- below.  The earlier LA-M2 objective is deliberately archived/deleted above
-- to prove at-time retention, so it cannot drive the M3 materializer.
select id::text as m3_objective_id
from public.create_learning_objective(
  'b4000000-0000-4000-8000-000000000001',
  'Цель профиля LA-M3',
  null
)
\gset

select id::text as m3_no_data_objective_id
from public.create_learning_objective(
  'b4000000-0000-4000-8000-000000000001',
  'Цель без данных LA-M3',
  null
)
\gset

select (public.update_lesson_component_v2(
  component_id,
  null,
  false,
  null,
  false,
  :'m3_objective_id'::uuid,
  true,
  null,
  false
)).id
from unnest(array[
  'b6000000-0000-4000-8000-000000000005'::uuid,
  'b6000000-0000-4000-8000-000000000006'::uuid,
  'b6000000-0000-4000-8000-000000000007'::uuid
]) as aligned(component_id);

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

select pg_temp.assert_true(
  exists (
    select 1
    from public.learning_evidence as evidence
    where evidence.learning_record_id =
        'b8000000-0000-4000-8000-000000000005'
      and evidence.learner_profile_id =
        'b3000000-0000-4000-8000-000000000001'
      and evidence.recorded_by_account_id =
        'b2000000-0000-4000-8000-000000000001'
      and evidence.source_course_id_at_time =
        'b4000000-0000-4000-8000-000000000001'
      and evidence.source_learning_objective_id_at_time =
        :'m3_objective_id'::uuid
      and evidence.direction = 'positive'
      and evidence.support = 'with_support'
      and evidence.reason_code = 'supported_positive_evidence'
      and evidence.component_visibility_at_time = 'staff_only'
      and evidence.evidence_version = 1
      and evidence.eligibility_policy_version = 1
  )
  ,
  'completion did not materialize objective evidence'
);

select pg_temp.assert_true(
  exists (
      select 1
      from public.learner_objective_state as state
      where state.learner_profile_id =
          'b3000000-0000-4000-8000-000000000001'
        and state.recorded_by_account_id =
          'b2000000-0000-4000-8000-000000000001'
        and state.source_learning_objective_id_at_time =
          :'m3_objective_id'::uuid
        and state.status = 'forming'
        and state.reason_code = 'latest_with_support'
        and state.policy_version = 1
        and (
          select count(*)
          from public.learner_objective_state_evidence as link
          join public.learning_evidence as evidence
            on evidence.id = link.learning_evidence_id
          where link.learner_objective_state_id = state.id
            and link.recorded_by_account_id = state.recorded_by_account_id
            and link.learner_profile_id = state.learner_profile_id
            and link.source_course_id_at_time =
              state.source_course_id_at_time
            and link.source_learning_objective_id_at_time =
              state.source_learning_objective_id_at_time
            and evidence.learning_record_id =
              'b8000000-0000-4000-8000-000000000005'
        ) = 1
  ),
  'completion did not rebuild the forming objective state'
);

reset role;
select pg_temp.assert_raises(
  $sql$
    update public.learning_evidence
    set criterion_at_time = 'Подмена неизменяемого доказательства'
    where learning_record_id =
      'b8000000-0000-4000-8000-000000000005'
  $sql$,
  '55000',
  'learning_evidence_immutable',
  'materialized evidence accepted an in-place semantic rewrite'
);
select set_config(
  'request.jwt.claim.sub',
  'b1000000-0000-4000-8000-000000000001',
  true
);
set local role authenticated;

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
  'STAFF_ONLY_COMPONENT_SENTINEL_LA_M3',
  'STAFF_ONLY_CRITERION_SENTINEL_LA_M3',
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

select id::text as m3_source_observation_id
from public.lesson_component_observation
where learning_record_id = 'b8000000-0000-4000-8000-000000000006'
\gset

select pg_temp.assert_raises(
  format(
    'select public.correct_finalized_lesson_component_observation(%L::uuid,%L::uuid,%L::uuid,%L,%L,%L,%L::uuid,%L::timestamptz)',
    :'m3_source_observation_id',
    'b3000000-0000-4000-8000-000000000001',
    'b8000000-0000-4000-8000-000000000006',
    'independent',
    'Сохранить заметку',
    'Ничего фактически не изменилось',
    'ba900000-0000-4000-8000-000000000002',
    '2099-01-01 00:00:00+00'
  ),
  '22023',
  'learning_observation_correction_no_change',
  'no-op correction created an ambiguous copied-observation lineage'
);

select public.correct_finalized_lesson_component_observation(
  :'m3_source_observation_id'::uuid,
  'b3000000-0000-4000-8000-000000000001',
  'b8000000-0000-4000-8000-000000000006',
  'not_yet',
  'Закрытая заметка коррекции LA-M3',
  'Исправлена ошибочная оценка',
  'ba900000-0000-4000-8000-000000000001',
  '2099-01-01 00:00:00+00'
)::text as m3_correction_result
\gset

select pg_temp.assert_true(
  (:'m3_correction_result'::jsonb ->> 'correctedAt')::timestamptz
      < '2099-01-01 00:00:00+00'::timestamptz
    and not (:'m3_correction_result'::jsonb ->> 'replayed')::boolean
    and exists (
      select 1
      from public.learning_record as source_record
      join public.learning_record as replacement_record
        on replacement_record.id =
          (:'m3_correction_result'::jsonb
            ->> 'newLearningRecordId')::uuid
       and replacement_record.corrected_from_record_id = source_record.id
       and source_record.superseded_by_record_id = replacement_record.id
      join public.lesson_component_observation as source_observation
        on source_observation.id = :'m3_source_observation_id'::uuid
       and source_observation.learning_record_id = source_record.id
      join public.lesson_component_observation as replacement_observation
        on replacement_observation.id =
          (:'m3_correction_result'::jsonb ->> 'newObservationId')::uuid
       and replacement_observation.corrected_from_observation_id =
          source_observation.id
       and source_observation.superseded_by_observation_id =
          replacement_observation.id
       and replacement_observation.rating = 'not_yet'
      where source_record.id =
        'b8000000-0000-4000-8000-000000000006'
    )
    and exists (
      select 1
      from public.learning_evidence as old_evidence
      join public.learning_evidence as new_evidence
        on new_evidence.supersedes_evidence_id = old_evidence.id
       and old_evidence.superseded_by_evidence_id = new_evidence.id
       and new_evidence.direction = 'negative'
       and new_evidence.support is null
      where old_evidence.learning_record_id =
        'b8000000-0000-4000-8000-000000000006'
        and old_evidence.learner_profile_id = new_evidence.learner_profile_id
        and old_evidence.recorded_by_account_id =
          new_evidence.recorded_by_account_id
        and old_evidence.source_course_id_at_time =
          new_evidence.source_course_id_at_time
        and old_evidence.source_learning_objective_id_at_time =
          new_evidence.source_learning_objective_id_at_time
    )
    and exists (
      select 1
      from public.learner_objective_state as state
      where state.learner_profile_id =
          'b3000000-0000-4000-8000-000000000001'
        and state.source_learning_objective_id_at_time =
          :'m3_objective_id'::uuid
        and state.status = 'forming'
        and state.reason_code = 'latest_not_yet'
    ),
  'DB-clock correction did not supersede history/evidence or rebuild state'
);

select public.get_teacher_learning_record_correction_history(array[
  (:'m3_correction_result'::jsonb ->> 'newLearningRecordId')::uuid
])::text as m3_correction_history
\gset

select pg_temp.assert_true(
  :'m3_correction_history'::jsonb ->> 'truncated' = 'false'
    and jsonb_array_length(
      :'m3_correction_history'::jsonb -> 'items'
    ) = 1
    and (
      select count(*) = 13
        and bool_and(key in (
          'activeLearningRecordId', 'learningRecordId',
          'correctedFromLearningRecordId', 'observationId',
          'correctedFromObservationId', 'componentPositionAtTime',
          'componentLabelAtTime', 'oldRating', 'newRating',
          'oldPrivateNote', 'newPrivateNote', 'correctionReason',
          'correctedAt'
        ))
      from jsonb_object_keys(
        :'m3_correction_history'::jsonb -> 'items' -> 0
      ) as field(key)
    )
    and :'m3_correction_history'::jsonb #>>
      '{items,0,activeLearningRecordId}' =
        :'m3_correction_result'::jsonb ->> 'newLearningRecordId'
    and :'m3_correction_history'::jsonb #>>
      '{items,0,correctedFromLearningRecordId}' =
        'b8000000-0000-4000-8000-000000000006'
    and :'m3_correction_history'::jsonb #>> '{items,0,oldRating}' =
      'independent'
    and :'m3_correction_history'::jsonb #>> '{items,0,newRating}' =
      'not_yet'
    and :'m3_correction_history'::jsonb #>>
      '{items,0,oldPrivateNote}' = 'Сохранить заметку'
    and :'m3_correction_history'::jsonb #>>
      '{items,0,newPrivateNote}' = 'Закрытая заметка коррекции LA-M3'
    and :'m3_correction_history'::jsonb #>>
      '{items,0,componentLabelAtTime}' =
        'STAFF_ONLY_COMPONENT_SENTINEL_LA_M3'
    and :'m3_correction_history'::jsonb #>>
      '{items,0,correctionReason}' = 'Исправлена ошибочная оценка',
  'bounded teacher correction-history RPC omitted or reshaped the audit pair'
);

-- A 201-event chain proves the 200-item teacher audit cap reports truncation
-- instead of silently treating the bounded recursion window as complete.
reset role;
set local session_replication_role = replica;

insert into public.learning_record (
  id,
  learner_profile_id,
  lesson_run_id,
  source_course_id,
  source_lesson_id,
  source_course_id_at_time,
  source_lesson_id_at_time,
  source_lesson_run_id_at_time,
  occurred_at,
  was_present,
  needs_repeat,
  course_title_at_time,
  lesson_title_at_time,
  subject_at_time,
  recorded_by_account_id,
  corrected_from_record_id,
  superseded_by_record_id,
  correction_reason,
  correction_idempotency_key,
  corrected_at
)
select
  md5('m3-history-record-' || generated.ordinal::text)::uuid,
  'b3000000-0000-4000-8000-000000000001',
  null,
  'b4000000-0000-4000-8000-000000000001',
  'b5000000-0000-4000-8000-000000000006',
  'b4000000-0000-4000-8000-000000000001',
  'b5000000-0000-4000-8000-000000000006',
  md5('m3-history-run')::uuid,
  '2026-01-01 00:00:00+00'::timestamptz
    + generated.ordinal * interval '1 second',
  true,
  false,
  'LA-M3 correction history cap',
  'Bounded correction chain',
  'Русский язык',
  'b2000000-0000-4000-8000-000000000001',
  case when generated.ordinal = 1 then null
    else md5(
      'm3-history-record-' || (generated.ordinal - 1)::text
    )::uuid end,
  case when generated.ordinal = 202 then null
    else md5(
      'm3-history-record-' || (generated.ordinal + 1)::text
    )::uuid end,
  case when generated.ordinal = 1 then null
    else 'Bounded history correction ' || generated.ordinal::text end,
  case when generated.ordinal = 1 then null
    else md5('m3-history-key-' || generated.ordinal::text)::uuid end,
  case when generated.ordinal = 1 then null
    else '2026-01-01 00:00:00+00'::timestamptz
      + generated.ordinal * interval '1 second' end
from generate_series(1, 202) as generated(ordinal);

insert into public.lesson_component_observation (
  id,
  learning_record_id,
  lesson_component_id,
  source_lesson_component_id_at_time,
  component_position_at_time,
  component_type_key_at_time,
  component_label_at_time,
  component_visibility_at_time,
  observable_criterion_at_time,
  rating,
  entry_method,
  private_note,
  observed_at,
  recorded_by_account_id,
  corrected_from_observation_id,
  superseded_by_observation_id
)
select
  md5('m3-history-observation-' || generated.ordinal::text)::uuid,
  md5('m3-history-record-' || generated.ordinal::text)::uuid,
  null,
  md5('m3-history-component')::uuid,
  1,
  'discussion',
  'Bounded correction audit component',
  'staff_only',
  'Bounded correction audit criterion',
  case when generated.ordinal % 2 = 0
    then 'independent' else 'not_yet' end,
  'direct',
  'Bounded private note ' || generated.ordinal::text,
  '2026-01-01 00:00:00+00'::timestamptz
    + generated.ordinal * interval '1 second',
  'b2000000-0000-4000-8000-000000000001',
  case when generated.ordinal = 1 then null
    else md5(
      'm3-history-observation-' || (generated.ordinal - 1)::text
    )::uuid end,
  case when generated.ordinal = 202 then null
    else md5(
      'm3-history-observation-' || (generated.ordinal + 1)::text
    )::uuid end
from generate_series(1, 202) as generated(ordinal);

set local session_replication_role = origin;
select set_config(
  'request.jwt.claim.sub',
  'b1000000-0000-4000-8000-000000000001',
  true
);
set local role authenticated;

select public.get_teacher_learning_record_correction_history(array[
  md5('m3-history-record-202')::uuid
])::text as m3_bounded_correction_history
\gset

select pg_temp.assert_true(
  (:'m3_bounded_correction_history'::jsonb ->> 'truncated')::boolean
    and jsonb_array_length(
      :'m3_bounded_correction_history'::jsonb -> 'items'
    ) = 200
    and :'m3_bounded_correction_history'::jsonb #>>
      '{items,0,activeLearningRecordId}' =
        md5('m3-history-record-202')::uuid::text,
  'teacher correction-history cap omitted the one-event truncation lookahead'
);

select pg_temp.assert_true(
  (
    public.correct_finalized_lesson_component_observation(
      :'m3_source_observation_id'::uuid,
      'b3000000-0000-4000-8000-000000000001',
      'b8000000-0000-4000-8000-000000000006',
      'not_yet',
      'Закрытая заметка коррекции LA-M3',
      'Исправлена ошибочная оценка',
      'ba900000-0000-4000-8000-000000000001',
      '2098-01-01 00:00:00+00'
    ) ->> 'replayed'
  )::boolean,
  'equivalent correction idempotency replay was not recognized'
);

select pg_temp.assert_raises(
  format(
    'select public.correct_finalized_lesson_component_observation(%L::uuid,%L::uuid,%L::uuid,%L,%L,%L,%L::uuid,%L::timestamptz)',
    :'m3_source_observation_id',
    'b3000000-0000-4000-8000-000000000001',
    'b8000000-0000-4000-8000-000000000006',
    'with_support',
    'Закрытая заметка коррекции LA-M3',
    'Исправлена ошибочная оценка',
    'ba900000-0000-4000-8000-000000000001',
    '2097-01-01 00:00:00+00'
  ),
  '23505',
  'correction_idempotency_conflict',
  'correction idempotency key accepted a mismatched payload'
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
      and component_label_at_time = 'STAFF_ONLY_COMPONENT_SENTINEL_LA_M3'
      and component_visibility_at_time = 'staff_only'
      and observable_criterion_at_time =
        'STAFF_ONLY_CRITERION_SENTINEL_LA_M3'
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

select pg_temp.assert_true(
  exists (
    select 1
    from public.learning_evidence as evidence
    where evidence.learning_record_id =
        (:'m3_correction_result'::jsonb
          ->> 'newLearningRecordId')::uuid
      and evidence.lesson_component_id is null
      and evidence.source_component_id_at_time =
        'b6000000-0000-4000-8000-000000000006'
      and evidence.source_lesson_id_at_time =
        'b5000000-0000-4000-8000-000000000006'
      and evidence.course_title_at_time = 'LA-M2 acceptance course'
      and evidence.lesson_title_at_time = 'At-time retention'
      and evidence.component_label_at_time =
        'STAFF_ONLY_COMPONENT_SENTINEL_LA_M3'
      and evidence.component_visibility_at_time = 'staff_only'
      and evidence.objective_title_at_time = 'Цель профиля LA-M3'
      and evidence.criterion_at_time =
        'STAFF_ONLY_CRITERION_SENTINEL_LA_M3'
      and evidence.direction = 'negative'
      and evidence.supersedes_evidence_id is not null
  ),
  'Component/Lesson deletion erased the corrected evidence snapshot'
);

select public.get_teacher_learner_activity_profile(
  'b3000000-0000-4000-8000-000000000001'
)::text as m3_teacher_profile
\gset

select pg_temp.assert_true(
  (:'m3_teacher_profile'::jsonb ->> 'projectionVersion')::integer = 1
    and jsonb_array_length(:'m3_teacher_profile'::jsonb -> 'states') <= 200
    and exists (
      select 1
      from jsonb_array_elements(
        :'m3_teacher_profile'::jsonb -> 'states'
      ) as item(value)
      where item.value ->> 'sourceLearningObjectiveIdAtTime' =
          :'m3_no_data_objective_id'
        and item.value ->> 'status' = 'no_data'
        and item.value -> 'stateId' = 'null'::jsonb
        and item.value -> 'lastEvidenceAt' = 'null'::jsonb
        and item.value -> 'freshnessDueAt' = 'null'::jsonb
        and item.value -> 'evidence' = '[]'::jsonb
        and item.value -> 'recommendation' = 'null'::jsonb
        and (item.value ->> 'policyVersion')::integer = 1
    )
    and exists (
      select 1
      from jsonb_array_elements(
        :'m3_teacher_profile'::jsonb -> 'states'
      ) as item(value)
      where item.value ->> 'sourceLearningObjectiveIdAtTime' =
          :'m3_objective_id'
        and item.value ->> 'status' = 'forming'
        and item.value ->> 'reasonCode' = 'latest_not_yet'
        and jsonb_array_length(item.value -> 'evidence') >= 1
    )
    and position(
      'STAFF_ONLY_COMPONENT_SENTINEL_LA_M3'
      in :'m3_teacher_profile'
    ) > 0
    and position(
      'STAFF_ONLY_CRITERION_SENTINEL_LA_M3'
      in :'m3_teacher_profile'
    ) > 0,
  'teacher profile omitted persisted evidence or synthesized no_data state'
);

select item.value ->> 'evaluatedAt' as m3_state_evaluated_at
from jsonb_array_elements(
  :'m3_teacher_profile'::jsonb -> 'states'
) as item(value)
where item.value ->> 'sourceLearningObjectiveIdAtTime' = :'m3_objective_id'
\gset

select public.get_teacher_learner_activity_profile(
  'b3000000-0000-4000-8000-000000000001'
)::text as m3_teacher_profile_repeat
\gset

select pg_temp.assert_true(
  exists (
    select 1
    from jsonb_array_elements(
      :'m3_teacher_profile_repeat'::jsonb -> 'states'
    ) as item(value)
    where item.value ->> 'sourceLearningObjectiveIdAtTime' =
        :'m3_objective_id'
      and item.value ->> 'evaluatedAt' = :'m3_state_evaluated_at'
  ),
  'semantically unchanged profile read invalidated the override token'
);

select public.set_learner_recommendation_override(
  'b3000000-0000-4000-8000-000000000001',
  :'m3_objective_id'::uuid,
  'replace',
  'repeat',
  'PRIVATE_OVERRIDE_SENTINEL_LA_M3',
  :'m3_state_evaluated_at'::timestamptz
)::text as m3_override_result
\gset

select pg_temp.assert_true(
  exists (
    select 1
    from public.learner_recommendation_override as override_row
    where override_row.learner_profile_id =
        'b3000000-0000-4000-8000-000000000001'
      and override_row.source_learning_objective_id_at_time =
        :'m3_objective_id'::uuid
      and override_row.updated_at =
        (:'m3_override_result'::jsonb ->> 'updatedAt')::timestamptz
      and override_row.private_reason = 'PRIVATE_OVERRIDE_SENTINEL_LA_M3'
  ),
  'override RPC returned a timestamp different from the persisted row'
);

reset role;
select pg_temp.assert_true(
  position(
    'PRIVATE_OVERRIDE_SENTINEL_LA_M3'
    in public.safe_learning_activity_profile_projection(
      'b3000000-0000-4000-8000-000000000001',
      clock_timestamp()
    )::text
  ) = 0,
  'private override reason leaked into the learner-safe projection'
);

-- A historical state from another recorder for this same learner/Course/live
-- objective must not suppress the current Course owner's synthesized no_data.
insert into public.learning_record (
  id,
  learner_profile_id,
  lesson_run_id,
  source_course_id,
  source_lesson_id,
  source_course_id_at_time,
  source_lesson_id_at_time,
  source_lesson_run_id_at_time,
  occurred_at,
  was_present,
  needs_repeat,
  course_title_at_time,
  lesson_title_at_time,
  subject_at_time,
  recorded_by_account_id
) values (
  'bad00000-0000-4000-8000-000000000001',
  'b3000000-0000-4000-8000-000000000001',
  null,
  'b4000000-0000-4000-8000-000000000001',
  'b5000000-0000-4000-8000-000000000005',
  'b4000000-0000-4000-8000-000000000001',
  'b5000000-0000-4000-8000-000000000005',
  'baf00000-0000-4000-8000-000000000001',
  '2026-08-18 10:25:00+09',
  true,
  false,
  'FOREIGN_COURSE_TITLE_SENTINEL',
  'FOREIGN_LESSON_TITLE_SENTINEL',
  'Русский язык',
  'b2000000-0000-4000-8000-000000000002'
);

insert into public.lesson_component_observation (
  id,
  learning_record_id,
  lesson_component_id,
  source_lesson_component_id_at_time,
  learning_objective_id,
  source_learning_objective_id_at_time,
  learning_objective_title_at_time,
  component_position_at_time,
  component_type_key_at_time,
  component_label_at_time,
  observable_criterion_at_time,
  rating,
  entry_method,
  observed_at,
  recorded_by_account_id
) values (
  'bae00000-0000-4000-8000-000000000001',
  'bad00000-0000-4000-8000-000000000001',
  'b6000000-0000-4000-8000-000000000005',
  'b6000000-0000-4000-8000-000000000005',
  :'m3_no_data_objective_id'::uuid,
  :'m3_no_data_objective_id'::uuid,
  'FOREIGN_OBJECTIVE_TITLE_SENTINEL',
  1,
  'discussion',
  'FOREIGN_COMPONENT_LABEL_SENTINEL',
  'FOREIGN_RECORDER_SENTINEL',
  'independent',
  'direct',
  '2026-08-18 10:20:00+09',
  'b2000000-0000-4000-8000-000000000002'
);

select public.materialize_learning_evidence_for_records(
  array['bad00000-0000-4000-8000-000000000001'::uuid],
  clock_timestamp()
);
select public.rebuild_learner_objective_state_for_actor(
  'b2000000-0000-4000-8000-000000000002',
  'b3000000-0000-4000-8000-000000000001',
  :'m3_no_data_objective_id'::uuid,
  clock_timestamp()
);

set local role service_role;
select public.build_course_learning_activity_context(
  'b1000000-0000-4000-8000-000000000001',
  'b4000000-0000-4000-8000-000000000001'
)::text as m3_course_context
\gset
select public.build_course_learning_activity_context(
  'b1000000-0000-4000-8000-000000000001',
  'b4000000-0000-4000-8000-000000000001'
)::text as m3_course_context_repeat
\gset
select public.build_course_learning_activity_context(
  'b1000000-0000-4000-8000-000000000001',
  'b4000000-0000-4000-8000-000000000002'
)::text as m3_course_context_unused
\gset
reset role;

select pg_temp.assert_true(
  (:'m3_course_context'::jsonb ->> 'used')::boolean
    and :'m3_course_context'::jsonb ->> 'revision'
      ~ '^[a-f0-9]{64}$'
    and :'m3_course_context'::jsonb ->> 'revision' =
      :'m3_course_context_repeat'::jsonb ->> 'revision'
    and (:'m3_course_context'::jsonb ->> 'projectionVersion')::integer = 1
    and (
      select count(*) = 5
        and bool_and(key in (
          'used', 'revision', 'projectionVersion', 'summary', 'states'
        ))
      from jsonb_object_keys(:'m3_course_context'::jsonb) as root(key)
    )
    and (
      select count(*) = 7
        and bool_and(key in (
          'totalStateCount', 'includedStateCount', 'formingCount',
          'confirmedCount', 'recheckDueCount', 'evidenceReferenceCount',
          'truncated'
        ))
      from jsonb_object_keys(
        :'m3_course_context'::jsonb -> 'summary'
      ) as summary(key)
    )
    and jsonb_array_length(:'m3_course_context'::jsonb -> 'states') between 1 and 80
    and (:'m3_course_context'::jsonb -> 'summary'
      ->> 'includedStateCount')::integer =
      jsonb_array_length(:'m3_course_context'::jsonb -> 'states')
    and (:'m3_course_context'::jsonb -> 'summary'
      ->> 'evidenceReferenceCount')::integer <= 240
    and not exists (
      select 1
      from jsonb_array_elements(
        :'m3_course_context'::jsonb -> 'states'
      ) as state(value)
      where state.value ->> 'key' !~ '^las_[a-f0-9]{64}$'
        or state.value ->> 'courseTitle' <> 'LA-M2 acceptance course'
        or state.value ->> 'state' not in (
          'no_data', 'forming', 'confirmed', 'recheck_due'
        )
        or jsonb_array_length(state.value -> 'evidenceReferences') > 3
        or (
          select count(*) <> 12
            or not bool_and(key in (
              'key', 'courseTitle', 'subject', 'objectiveTitle', 'state',
              'reasonCode', 'reasonText', 'evaluatedAt', 'lastEvidenceAt',
              'freshnessDueAt', 'evidenceReferences', 'recommendation'
            ))
          from jsonb_object_keys(state.value) as state_key(key)
        )
        or exists (
          select 1
          from jsonb_array_elements(
            state.value -> 'evidenceReferences'
          ) as evidence(value)
          where evidence.value ->> 'key' !~ '^lae_[a-f0-9]{64}$'
            or (
              select count(*) <> 10
                or not bool_and(key in (
                  'key', 'direction', 'support', 'observedAt', 'evidenceAt',
                  'courseTitle', 'lessonTitle', 'componentLabel',
                  'objectiveTitle', 'criterion'
                ))
              from jsonb_object_keys(evidence.value) as evidence_key(key)
            )
        )
        or (
          state.value -> 'recommendation' <> 'null'::jsonb
          and (
            jsonb_array_length(
              state.value -> 'recommendation' -> 'evidenceReferenceKeys'
            ) > 3
            or exists (
              select 1
              from jsonb_array_elements_text(
                state.value -> 'recommendation'
                  -> 'evidenceReferenceKeys'
              ) as evidence_key(value)
              where evidence_key.value !~ '^lae_[a-f0-9]{64}$'
            )
            or (
              select count(*) <> 6
                or not bool_and(key in (
                  'type', 'reasonCode', 'reasonText', 'source',
                  'generatedAt', 'evidenceReferenceKeys'
                ))
              from jsonb_object_keys(
                state.value -> 'recommendation'
              ) as recommendation_key(key)
            )
          )
        )
    )
    and position('PRIVATE_OVERRIDE_SENTINEL_LA_M3'
      in :'m3_course_context') = 0
    and position('LA-M2 cross-Course objective fixture'
      in :'m3_course_context') = 0
    and position('Цель другого курса' in :'m3_course_context') = 0
    and position('FOREIGN_RECORDER_SENTINEL'
      in :'m3_course_context') = 0
    and position('FOREIGN_COURSE_TITLE_SENTINEL'
      in :'m3_course_context') = 0
    and position('STAFF_ONLY_COMPONENT_SENTINEL_LA_M3'
      in :'m3_course_context') = 0
    and position('STAFF_ONLY_CRITERION_SENTINEL_LA_M3'
      in :'m3_course_context') = 0
    and position('Служебный компонент преподавателя'
      in :'m3_course_context') > 0
    and position('Служебный критерий преподавателя'
      in :'m3_course_context') > 0
    and position('b3000000-0000-4000-8000-000000000001'
      in :'m3_course_context') = 0,
  'Course activity context violated strict shape, cap, scope or privacy'
);

select pg_temp.assert_true(
  exists (
    select 1
    from jsonb_array_elements(
      :'m3_course_context'::jsonb -> 'states'
    ) as state(value)
    where state.value ->> 'objectiveTitle' = 'Цель без данных LA-M3'
      and state.value ->> 'state' = 'no_data'
      and state.value -> 'evidenceReferences' = '[]'::jsonb
  ),
  'foreign-recorder state suppressed the current recorder no_data state'
);

select pg_temp.assert_true(
  not (:'m3_course_context_unused'::jsonb ->> 'used')::boolean
    and :'m3_course_context_unused'::jsonb ->> 'revision' = repeat('0', 64)
    and :'m3_course_context_unused'::jsonb -> 'states' = '[]'::jsonb,
  'empty effective audience did not return the canonical unused payload'
);

select set_config(
  'request.jwt.claim.sub',
  'b1000000-0000-4000-8000-000000000001',
  true
);
set local role authenticated;

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
  'STAFF_ONLY_SELF_SENTINEL_LA_M3',
  'STAFF_ONLY_SELF_CRITERION_SENTINEL_LA_M3',
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

select public.get_my_learning_activity_profile()::text
  as m3_self_activity_profile
\gset

select pg_temp.assert_true(
  (:'m3_self_activity_profile'::jsonb
    ->> 'projectionVersion')::integer = 1
    and jsonb_array_length(
      :'m3_self_activity_profile'::jsonb -> 'states'
    ) <= 200
    and exists (
      select 1
      from jsonb_array_elements(
        :'m3_self_activity_profile'::jsonb -> 'states'
      ) as state(value)
      where state.value ->> 'key' ~ '^las_[a-f0-9]{64}$'
        and state.value ->> 'state' = 'forming'
        and state.value ->> 'reasonCode' = 'latest_not_yet'
        and jsonb_array_length(state.value -> 'evidenceReferences') = 1
    )
    and not exists (
      select 1
      from jsonb_array_elements(
        :'m3_self_activity_profile'::jsonb -> 'states'
      ) as state(value)
      where state.value ->> 'key' !~ '^las_[a-f0-9]{64}$'
        or jsonb_array_length(state.value -> 'evidenceReferences') > 5
        or exists (
          select 1
          from jsonb_array_elements(
            state.value -> 'evidenceReferences'
          ) as evidence(value)
          where evidence.value ->> 'key' !~ '^lae_[a-f0-9]{64}$'
        )
    )
    and position('Строго личная заметка LA-M1'
      in :'m3_self_activity_profile') = 0
    and position('STAFF_ONLY_SELF_SENTINEL_LA_M3'
      in :'m3_self_activity_profile') = 0
    and position('STAFF_ONLY_SELF_CRITERION_SENTINEL_LA_M3'
      in :'m3_self_activity_profile') = 0
    and position('Служебный компонент преподавателя'
      in :'m3_self_activity_profile') > 0
    and position('Служебный критерий преподавателя'
      in :'m3_self_activity_profile') > 0
    and position('b2000000-0000-4000-8000-000000000001'
      in :'m3_self_activity_profile') = 0,
  'self activity profile leaked private/raw data or violated safe DTO caps'
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

select public.get_observed_learner_activity_profile(
  'b3000000-0000-4000-8000-000000000003'
)::text as m3_observer_activity_profile
\gset

reset role;

select pg_temp.assert_true(
  :'m3_observer_activity_profile'::jsonb -> 'states' =
      :'m3_self_activity_profile'::jsonb -> 'states'
    and position('Строго личная заметка LA-M1'
      in :'m3_observer_activity_profile') = 0
    and position('STAFF_ONLY_SELF_SENTINEL_LA_M3'
      in :'m3_observer_activity_profile') = 0
    and position('STAFF_ONLY_SELF_CRITERION_SENTINEL_LA_M3'
      in :'m3_observer_activity_profile') = 0
    and position('Служебный компонент преподавателя'
      in :'m3_observer_activity_profile') > 0
    and position('Служебный критерий преподавателя'
      in :'m3_observer_activity_profile') > 0
    and exists (
      select 1
      from public.learner_identity_audit_event as event
      where event.event_type = 'learner_observer_activity_profile_read'
        and event.actor_account_id =
          'b2000000-0000-4000-8000-000000000002'
        and event.learner_profile_id =
          'b3000000-0000-4000-8000-000000000003'
    ),
  'observer profile diverged from safe self projection or missed audit'
);

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
      from public.learning_evidence
      where learner_profile_id =
        'b3000000-0000-4000-8000-000000000003'
    )
    and not exists (
      select 1
      from public.learner_objective_state
      where learner_profile_id =
        'b3000000-0000-4000-8000-000000000003'
    )
    and not exists (
      select 1
      from public.learner_recommendation_override
      where learner_profile_id =
        'b3000000-0000-4000-8000-000000000003'
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

delete from public.learning_objective
where id = :'m3_objective_id'::uuid;

select pg_temp.assert_true(
  exists (
    select 1
    from public.learning_evidence as evidence
    where evidence.learner_profile_id =
        'b3000000-0000-4000-8000-000000000001'
      and evidence.source_learning_objective_id_at_time =
        :'m3_objective_id'::uuid
      and evidence.learning_objective_id is null
      and evidence.objective_title_at_time = 'Цель профиля LA-M3'
  )
    and exists (
      select 1
      from public.learner_objective_state as state
      where state.learner_profile_id =
          'b3000000-0000-4000-8000-000000000001'
        and state.source_learning_objective_id_at_time =
          :'m3_objective_id'::uuid
        and state.learning_objective_id is null
        and state.objective_title_at_time = 'Цель профиля LA-M3'
        and exists (
          select 1
          from public.learner_objective_state_evidence as link
          where link.learner_objective_state_id = state.id
        )
    ),
  'Objective deletion did not monotonically clear live FKs and retain provenance'
);

-- A same-Run merge conflict with corrected histories must compare only the
-- two active vertices.  Both ancestor -> correction links must survive.
set local session_replication_role = replica;
insert into auth.users (
  id,
  email,
  email_confirmed_at,
  raw_user_meta_data,
  raw_app_meta_data
) values (
  'bc100000-0000-4000-8000-000000000001',
  'la-merge-target@test.invalid',
  clock_timestamp(),
  '{}'::jsonb,
  '{}'::jsonb
);

insert into public.account (id, auth_user_id, display_name, status)
values (
  'bc200000-0000-4000-8000-000000000001',
  'bc100000-0000-4000-8000-000000000001',
  'LA Merge Target',
  'active'
);

insert into public.learner_profile (id, display_name, account_id)
values
  (
    'bc300000-0000-4000-8000-000000000001',
    'LA Merge Source',
    null
  ),
  (
    'bc300000-0000-4000-8000-000000000002',
    'LA Merge Target',
    'bc200000-0000-4000-8000-000000000001'
  );

insert into public.learning_record (
  id,
  learner_profile_id,
  lesson_run_id,
  source_course_id,
  source_lesson_id,
  source_course_id_at_time,
  source_lesson_id_at_time,
  source_lesson_run_id_at_time,
  occurred_at,
  was_present,
  needs_repeat,
  course_title_at_time,
  lesson_title_at_time,
  subject_at_time,
  recorded_by_account_id,
  superseded_by_record_id,
  corrected_from_record_id,
  correction_reason,
  correction_idempotency_key,
  corrected_at
)
values
  (
    'bc800000-0000-4000-8000-000000000001',
    'bc300000-0000-4000-8000-000000000001',
    'b7000000-0000-4000-8000-000000000005',
    'b4000000-0000-4000-8000-000000000001',
    'b5000000-0000-4000-8000-000000000005',
    'b4000000-0000-4000-8000-000000000001',
    'b5000000-0000-4000-8000-000000000005',
    'b7000000-0000-4000-8000-000000000005',
    '2026-08-19 10:25:00+09',
    true,
    false,
    'LA-M2 acceptance course',
    'Completion conflict',
    'Русский язык',
    'b2000000-0000-4000-8000-000000000001',
    'bc800000-0000-4000-8000-000000000002',
    null,
    null,
    null,
    null
  ),
  (
    'bc800000-0000-4000-8000-000000000002',
    'bc300000-0000-4000-8000-000000000001',
    'b7000000-0000-4000-8000-000000000005',
    'b4000000-0000-4000-8000-000000000001',
    'b5000000-0000-4000-8000-000000000005',
    'b4000000-0000-4000-8000-000000000001',
    'b5000000-0000-4000-8000-000000000005',
    'b7000000-0000-4000-8000-000000000005',
    '2026-08-19 10:25:00+09',
    true,
    false,
    'LA-M2 acceptance course',
    'Completion conflict',
    'Русский язык',
    'b2000000-0000-4000-8000-000000000001',
    null,
    'bc800000-0000-4000-8000-000000000001',
    'Source correction',
    'bc900000-0000-4000-8000-000000000001',
    '2026-08-20 10:25:00+09'
  ),
  (
    'bc800000-0000-4000-8000-000000000003',
    'bc300000-0000-4000-8000-000000000002',
    'b7000000-0000-4000-8000-000000000005',
    'b4000000-0000-4000-8000-000000000001',
    'b5000000-0000-4000-8000-000000000005',
    'b4000000-0000-4000-8000-000000000001',
    'b5000000-0000-4000-8000-000000000005',
    'b7000000-0000-4000-8000-000000000005',
    '2026-08-19 10:25:00+09',
    true,
    false,
    'LA-M2 acceptance course',
    'Completion conflict',
    'Русский язык',
    'b2000000-0000-4000-8000-000000000001',
    'bc800000-0000-4000-8000-000000000004',
    null,
    null,
    null,
    null
  ),
  (
    'bc800000-0000-4000-8000-000000000004',
    'bc300000-0000-4000-8000-000000000002',
    'b7000000-0000-4000-8000-000000000005',
    'b4000000-0000-4000-8000-000000000001',
    'b5000000-0000-4000-8000-000000000005',
    'b4000000-0000-4000-8000-000000000001',
    'b5000000-0000-4000-8000-000000000005',
    'b7000000-0000-4000-8000-000000000005',
    '2026-08-19 10:25:00+09',
    true,
    false,
    'LA-M2 acceptance course',
    'Completion conflict',
    'Русский язык',
    'b2000000-0000-4000-8000-000000000001',
    null,
    'bc800000-0000-4000-8000-000000000003',
    'Target correction',
    'bc900000-0000-4000-8000-000000000002',
    '2026-08-20 10:25:00+09'
  );
set local session_replication_role = origin;

insert into public.learner_profile_merge (
  id,
  source_learner_profile_id,
  target_learner_profile_id,
  requested_by_account_id,
  subject_account_id,
  expires_at
) values (
  'bca00000-0000-4000-8000-000000000001',
  'bc300000-0000-4000-8000-000000000001',
  'bc300000-0000-4000-8000-000000000002',
  'bc200000-0000-4000-8000-000000000001',
  'bc200000-0000-4000-8000-000000000001',
  clock_timestamp() + interval '1 hour'
);

select public.learner_profile_merge_preview_for_actor(
  'bca00000-0000-4000-8000-000000000001',
  'bc200000-0000-4000-8000-000000000001'
)::text as m3_merge_preview
\gset

select pg_temp.assert_true(
  jsonb_array_length(:'m3_merge_preview'::jsonb -> 'conflicts') = 1,
  'merge preview counted correction ancestors as active Run conflicts'
);

select public.execute_learner_profile_merge_for_actor(
  'bca00000-0000-4000-8000-000000000001',
  'bc200000-0000-4000-8000-000000000001',
  :'m3_merge_preview'::jsonb ->> 'previewFingerprint'
);

select pg_temp.assert_true(
  not exists (
    select 1 from public.learner_profile
    where id = 'bc300000-0000-4000-8000-000000000001'
  )
    and exists (
      select 1 from public.learner_profile_alias
      where source_learner_profile_id =
          'bc300000-0000-4000-8000-000000000001'
        and target_learner_profile_id =
          'bc300000-0000-4000-8000-000000000002'
    )
    and exists (
      select 1
      from public.learner_profile_merge_conflict
      where merge_operation_id =
          'bca00000-0000-4000-8000-000000000001'
        and primary_record_id =
          'bc800000-0000-4000-8000-000000000004'
        and superseded_record_id =
          'bc800000-0000-4000-8000-000000000002'
    )
    and exists (
      select 1
      from public.learning_record as source_ancestor
      join public.learning_record as source_active
        on source_active.id =
          'bc800000-0000-4000-8000-000000000002'
       and source_active.corrected_from_record_id = source_ancestor.id
       and source_ancestor.superseded_by_record_id = source_active.id
      join public.learning_record as target_active
        on target_active.id = source_active.superseded_by_record_id
      join public.learning_record as target_ancestor
        on target_ancestor.id = target_active.corrected_from_record_id
       and target_ancestor.superseded_by_record_id = target_active.id
      where source_ancestor.id =
          'bc800000-0000-4000-8000-000000000001'
        and target_ancestor.id =
          'bc800000-0000-4000-8000-000000000003'
        and target_active.id =
          'bc800000-0000-4000-8000-000000000004'
        and source_active.lesson_run_id is null
        and source_ancestor.lesson_run_id =
          'b7000000-0000-4000-8000-000000000005'
        and target_ancestor.lesson_run_id =
          'b7000000-0000-4000-8000-000000000005'
        and source_ancestor.learner_profile_id =
          'bc300000-0000-4000-8000-000000000002'
        and source_active.learner_profile_id =
          'bc300000-0000-4000-8000-000000000002'
    ),
  'merge rewrote correction ancestry or selected a non-active conflict vertex'
);

-- The earlier erasure acceptance intentionally destroys the linked subject's
-- profile and every attached LearningRecord, including the predeclared M4
-- roster rows. Re-seed a fresh deterministic linked profile and only those M4
-- records after the erasure assertions, so live-delivery acceptance does not
-- accidentally depend on data that the erasure contract correctly removed.
set local session_replication_role = replica;

update public.learner_profile
set id = 'b3000000-0000-4000-8000-000000000003'
where account_id = 'b2000000-0000-4000-8000-000000000003';

-- Isolated lifecycle fixture: an actual Run cancellation removes its draft
-- LearningRecord, while the exact capability row must retain enough bounded
-- membership for the owner to perform a full Course revoke and unblock owner
-- transfer. It is independent of the main live-delivery Run assertions.
insert into public.course (
  id,
  owner_account_id,
  title,
  subject,
  audience_type,
  learning_audience
) values (
  'bf400000-0000-4000-8000-000000000002',
  'b2000000-0000-4000-8000-000000000001',
  'LA-M4 cancelled grant cleanup fixture',
  'Русский язык',
  'none',
  'children'
);

insert into public.lesson (id, course_id, position, title)
values (
  'bf500000-0000-4000-8000-000000000003',
  'bf400000-0000-4000-8000-000000000002',
  1,
  'Cancelled grant cleanup'
);

insert into public.lesson_run (
  id,
  lesson_id,
  scheduled_at,
  planned_duration_minutes
) values (
  'bf700000-0000-4000-8000-000000000003',
  'bf500000-0000-4000-8000-000000000003',
  '2026-08-19 13:00:00+09',
  45
);

insert into public.learning_record (
  id,
  learner_profile_id,
  lesson_run_id,
  source_course_id,
  source_lesson_id,
  source_course_id_at_time,
  source_lesson_id_at_time,
  source_lesson_run_id_at_time,
  recorded_by_account_id,
  superseded_by_record_id
) values
  (
    'bf800000-0000-4000-8000-000000000001',
    'b3000000-0000-4000-8000-000000000003',
    'bf700000-0000-4000-8000-000000000001',
    'bf400000-0000-4000-8000-000000000001',
    'bf500000-0000-4000-8000-000000000001',
    'bf400000-0000-4000-8000-000000000001',
    'bf500000-0000-4000-8000-000000000001',
    'bf700000-0000-4000-8000-000000000001',
    'b2000000-0000-4000-8000-000000000001',
    'bf800000-0000-4000-8000-000000000004'
  ),
  (
    'bf800000-0000-4000-8000-000000000003',
    'b3000000-0000-4000-8000-000000000003',
    'bf700000-0000-4000-8000-000000000002',
    'bf400000-0000-4000-8000-000000000001',
    'bf500000-0000-4000-8000-000000000002',
    'bf400000-0000-4000-8000-000000000001',
    'bf500000-0000-4000-8000-000000000002',
    'bf700000-0000-4000-8000-000000000002',
    'b2000000-0000-4000-8000-000000000001',
    null
  ),
  (
    'bf800000-0000-4000-8000-000000000004',
    'b3000000-0000-4000-8000-000000000003',
    'bf700000-0000-4000-8000-000000000001',
    'bf400000-0000-4000-8000-000000000001',
    'bf500000-0000-4000-8000-000000000001',
    'bf400000-0000-4000-8000-000000000001',
    'bf500000-0000-4000-8000-000000000001',
    'bf700000-0000-4000-8000-000000000001',
    'b2000000-0000-4000-8000-000000000001',
    null
  ),
  (
    'bf800000-0000-4000-8000-000000000005',
    'b3000000-0000-4000-8000-000000000003',
    'bf700000-0000-4000-8000-000000000003',
    'bf400000-0000-4000-8000-000000000002',
    'bf500000-0000-4000-8000-000000000003',
    'bf400000-0000-4000-8000-000000000002',
    'bf500000-0000-4000-8000-000000000003',
    'bf700000-0000-4000-8000-000000000003',
    'b2000000-0000-4000-8000-000000000001',
    null
  );

set local session_replication_role = origin;

-- -------------------------------------------------------------------------
-- LA-M4 explicit enrollment, Run capability and persisted cursor delivery.
-- -------------------------------------------------------------------------

set local role service_role;
select pg_temp.assert_raises(
  $sql$
    select public.resolve_lesson_run_live_source_admin(
      'b1000000-0000-4000-8000-000000000003',
      'bf100000-0000-4000-8000-000000000001',
      'bf700000-0000-4000-8000-000000000001'
    )
  $sql$,
  'P0002',
  'lesson_run_live_not_found',
  'scheduled Run was learner-readable before explicit execution authority'
);

select pg_temp.assert_raises(
  $sql$
    select public.resolve_lesson_run_live_source_admin(
      'b1000000-0000-4000-8000-000000000002',
      'bf100000-0000-4000-8000-000000000002',
      'bf700000-0000-4000-8000-000000000001'
    )
  $sql$,
  'P0002',
  'lesson_run_live_not_found',
  'observer grant was treated as live learner authority'
);

select pg_temp.assert_raises(
  $sql$
    select public.resolve_lesson_run_live_source_admin(
      'b1000000-0000-4000-8000-000000000003',
      'bf100000-0000-4000-8000-000000000002',
      'bf700000-0000-4000-8000-000000000001'
    )
  $sql$,
  '42501',
  'live_delivery_session_revoked',
  'session id belonging to another auth user was accepted'
);

select pg_temp.assert_raises(
  $sql$
    select public.resolve_lesson_run_live_source_admin(
      'b1000000-0000-4000-8000-000000000003',
      'bf100000-0000-4000-8000-000000000003',
      'bf700000-0000-4000-8000-000000000001'
    )
  $sql$,
  '42501',
  'live_delivery_session_revoked',
  'expired auth.sessions.not_after was accepted'
);
reset role;

select set_config(
  'request.jwt.claim.sub',
  'b1000000-0000-4000-8000-000000000002',
  true
);
set local role authenticated;
select pg_temp.assert_raises(
  $sql$
    select public.get_lesson_run_live_delivery_admin(
      'bf700000-0000-4000-8000-000000000001'
    )
  $sql$,
  'P0002',
  'lesson_run_live_not_found',
  'cross-owner teacher read the live delivery workspace'
);
select pg_temp.assert_raises(
  $sql$
    select public.set_lesson_run_live_access(
      'bf700000-0000-4000-8000-000000000001',
      'b3000000-0000-4000-8000-000000000003',
      true,
      false
    )
  $sql$,
  'P0002',
  'lesson_run_live_not_found',
  'cross-owner teacher changed live learner access'
);
select pg_temp.assert_raises(
  $sql$
    select public.set_lesson_run_presentation_cursor(
      'bf700000-0000-4000-8000-000000000001',
      null,
      0
    )
  $sql$,
  'P0002',
  'lesson_run_live_not_found',
  'cross-owner teacher changed the live cursor'
);
reset role;

select set_config(
  'request.jwt.claim.sub',
  'b1000000-0000-4000-8000-000000000001',
  true
);
set local role authenticated;

select pg_temp.assert_raises(
  $sql$
    select public.set_lesson_run_live_access(
      'bf700000-0000-4000-8000-000000000001',
      'b3000000-0000-4000-8000-000000000001',
      true,
      false
    )
  $sql$,
  'P0002',
  'lesson_run_live_not_found',
  'existing offline Profile outside the exact Run roster leaked eligibility'
);

select public.get_lesson_run_live_delivery_admin(
  'bf700000-0000-4000-8000-000000000001'
)::text as m4_initial_workspace
\gset

select pg_temp.assert_true(
  (
    select count(*) = 4
      and bool_and(key in ('run', 'cursor', 'slides', 'learners'))
    from jsonb_object_keys(:'m4_initial_workspace'::jsonb) as root(key)
  )
    and not (:'m4_initial_workspace'::jsonb -> 'run' ->> 'started')::boolean
    and not (:'m4_initial_workspace'::jsonb -> 'run' ->> 'ended')::boolean
    and :'m4_initial_workspace'::jsonb -> 'cursor' -> 'slideId' = 'null'::jsonb
    and (:'m4_initial_workspace'::jsonb -> 'cursor'
      ->> 'revision')::bigint = 0
    and jsonb_array_length(
      :'m4_initial_workspace'::jsonb -> 'slides'
    ) = 1
    and jsonb_array_length(
      :'m4_initial_workspace'::jsonb -> 'learners'
    ) = 2
    and (
      select count(*)
      from jsonb_array_elements(
        :'m4_initial_workspace'::jsonb -> 'learners'
      ) as learner(value)
      where learner.value ->> 'learnerProfileId' =
        'b3000000-0000-4000-8000-000000000003'
    ) = 1
    and exists (
      select 1
      from public.learning_record as source_record
      join public.learning_record as replacement_record
        on replacement_record.id = source_record.superseded_by_record_id
       and replacement_record.lesson_run_id = source_record.lesson_run_id
       and replacement_record.learner_profile_id =
         source_record.learner_profile_id
      where source_record.id =
        'bf800000-0000-4000-8000-000000000001'
        and replacement_record.id =
          'bf800000-0000-4000-8000-000000000004'
    )
    and exists (
      select 1
      from jsonb_array_elements(
        :'m4_initial_workspace'::jsonb -> 'learners'
      ) as learner(value)
      where learner.value ->> 'learnerProfileId' =
          'b3000000-0000-4000-8000-000000000003'
        and learner.value ->> 'identityState' = 'claimed'
        and not (learner.value ->> 'courseAccessEnabled')::boolean
        and not (learner.value ->> 'runCapabilityEnabled')::boolean
    )
    and exists (
      select 1
      from jsonb_array_elements(
        :'m4_initial_workspace'::jsonb -> 'learners'
      ) as learner(value)
      where learner.value ->> 'learnerProfileId' =
          'b3000000-0000-4000-8000-000000000002'
        and learner.value ->> 'identityState' = 'offline'
    ),
  'teacher live workspace violated its strict scheduled/offline DTO'
);

select public.set_lesson_run_live_access(
  'bf700000-0000-4000-8000-000000000001',
  'b3000000-0000-4000-8000-000000000003',
  true,
  false
);

select pg_temp.assert_raises(
  $sql$
    select * from public.course_learner_enrollment
  $sql$,
  '42501',
  'permission denied for table course_learner_enrollment',
  'authenticated role received raw enrollment table access'
);

reset role;

select pg_temp.assert_true(
  exists (
    select 1
    from public.course_learner_enrollment as enrollment
    where enrollment.course_id =
        'bf400000-0000-4000-8000-000000000001'
      and enrollment.learner_profile_id =
        'b3000000-0000-4000-8000-000000000003'
      and enrollment.status = 'active'
      and enrollment.revision = 1
  )
    and exists (
      select 1
      from public.lesson_run_execution_capability as capability
      where capability.lesson_run_id =
          'bf700000-0000-4000-8000-000000000001'
        and capability.learner_profile_id =
          'b3000000-0000-4000-8000-000000000003'
        and capability.status = 'revoked'
        and capability.enrollment_revision = 1
        and capability.revision = 1
        and capability.revocation_reason = 'run_capability_not_granted'
    )
    and not exists (
      select 1
      from public.lesson_run_presentation_state as state
      where state.lesson_run_id =
        'bf700000-0000-4000-8000-000000000001'
    ),
  'scheduled Course grant did not persist an exact revoked membership tombstone'
);

select set_config(
  'request.jwt.claim.sub',
  'b1000000-0000-4000-8000-000000000001',
  true
);
set local role authenticated;
select public.start_lesson_run(
  'bf700000-0000-4000-8000-000000000001',
  '2026-08-19 11:05:00+09'
);
reset role;

select pg_temp.assert_true(
  exists (
    select 1
    from public.lesson_run_presentation_state as state
    where state.lesson_run_id =
        'bf700000-0000-4000-8000-000000000001'
      and state.student_slide_id is null
      and state.cursor_version = 0
  )
    and (
      select count(*)
      from public.lesson_run_execution_capability as capability
      where capability.lesson_run_id =
        'bf700000-0000-4000-8000-000000000001'
        and capability.status = 'active'
    ) = 1
    and exists (
      select 1
      from public.lesson_run_execution_capability as capability
      where capability.lesson_run_id =
          'bf700000-0000-4000-8000-000000000001'
        and capability.learner_profile_id =
          'b3000000-0000-4000-8000-000000000003'
        and capability.status = 'active'
        and capability.enrollment_revision = 1
        and capability.revision = 2
        and capability.revocation_reason is null
    )
    and not exists (
      select 1
      from public.lesson_run_execution_capability as capability
      where capability.lesson_run_id =
          'bf700000-0000-4000-8000-000000000001'
        and capability.learner_profile_id =
          'b3000000-0000-4000-8000-000000000002'
    ),
  'actual start did not activate the exact enrollment/frozen-roster intersection'
);

-- A repeated actual start must not reset the cursor or duplicate capability.
select set_config(
  'request.jwt.claim.sub',
  'b1000000-0000-4000-8000-000000000001',
  true
);
set local role authenticated;
select public.start_lesson_run(
  'bf700000-0000-4000-8000-000000000001',
  '2026-08-19 11:06:00+09'
);
reset role;

select pg_temp.assert_true(
  (
    select count(*)
    from public.lesson_run_execution_capability as capability
    where capability.lesson_run_id =
      'bf700000-0000-4000-8000-000000000001'
  ) = 1
    and (
      select state.cursor_version = 0
      from public.lesson_run_presentation_state as state
      where state.lesson_run_id =
        'bf700000-0000-4000-8000-000000000001'
    ),
  'idempotent start duplicated capability or reset cursor'
);

-- The superseded pair above is a focused projection/start regression. Real
-- correction history is created only after completion, so canonical
-- completion never sees a superseded draft in an open Run. Remove the
-- synthetic ancestor now and retain the canonical-current replacement for
-- the remaining live lifecycle assertions.
delete from public.learning_record
where id = 'bf800000-0000-4000-8000-000000000001'
  and superseded_by_record_id =
    'bf800000-0000-4000-8000-000000000004';

set local role service_role;
select public.resolve_lesson_run_live_source_admin(
  'b1000000-0000-4000-8000-000000000003',
  'bf100000-0000-4000-8000-000000000001',
  'bf700000-0000-4000-8000-000000000001'
)::text as m4_waiting_source
\gset
reset role;

select pg_temp.assert_true(
  :'m4_waiting_source'::jsonb =
    '{"state":"waiting","cursorRevision":0}'::jsonb,
  'initial learner delivery was not the exact waiting DTO'
);

-- Cancel is a close transition, not an authorization revoke. The frozen Run
-- capability survives cancellation even though canonical cancellation removes
-- its draft LearningRecord, so the learner receives only the safe ended DTO.
select set_config(
  'request.jwt.claim.sub',
  'b1000000-0000-4000-8000-000000000001',
  true
);
set local role authenticated;
select public.start_lesson_run(
  'bf700000-0000-4000-8000-000000000002',
  '2026-08-19 12:05:00+09'
);
select public.cancel_lesson_run(
  'bf700000-0000-4000-8000-000000000002',
  '2026-08-19 12:10:00+09'
);
reset role;

set local role service_role;
select public.resolve_lesson_run_live_source_admin(
  'b1000000-0000-4000-8000-000000000003',
  'bf100000-0000-4000-8000-000000000001',
  'bf700000-0000-4000-8000-000000000002'
)::text as m4_cancelled_source
\gset
reset role;

select pg_temp.assert_true(
  :'m4_cancelled_source'::jsonb = '{"state":"ended"}'::jsonb
    and not exists (
      select 1
      from public.learning_record
      where lesson_run_id =
        'bf700000-0000-4000-8000-000000000002'
    ),
  'cancelled authorized Run did not return exact ended DTO'
);

-- Cancellation removes the draft LearningRecord, but the exact capability
-- remains a bounded membership record for the teacher workspace. It must not
-- permit any post-cancellation re-grant.
select set_config(
  'request.jwt.claim.sub',
  'b1000000-0000-4000-8000-000000000001',
  true
);
set local role authenticated;
select public.get_lesson_run_live_delivery_admin(
  'bf700000-0000-4000-8000-000000000002'
)::text as m4_cancelled_workspace
\gset

select pg_temp.assert_true(
  (:'m4_cancelled_workspace'::jsonb -> 'run' ->> 'ended')::boolean
    and jsonb_array_length(
      :'m4_cancelled_workspace'::jsonb -> 'learners'
    ) = 1
    and exists (
      select 1
      from jsonb_array_elements(
        :'m4_cancelled_workspace'::jsonb -> 'learners'
      ) as learner(value)
      where learner.value ->> 'learnerProfileId' =
          'b3000000-0000-4000-8000-000000000003'
        and (learner.value ->> 'courseAccessEnabled')::boolean
        and (learner.value ->> 'runCapabilityEnabled')::boolean
    ),
  'cancelled actual Run lost its exact retained learner membership'
);

select pg_temp.assert_raises(
  $sql$
    select public.set_lesson_run_live_access(
      'bf700000-0000-4000-8000-000000000002',
      'b3000000-0000-4000-8000-000000000003',
      true,
      true
    )
  $sql$,
  'P0002',
  'lesson_run_live_not_found',
  'cancelled exact capability allowed a post-cancellation re-grant'
);

-- A Course-only grant made before actual start creates no execution authority,
-- but does retain exact scheduled-Run membership as a revoked tombstone. After
-- canonical cancellation deletes the draft roster, the owner can still perform
-- the one supported operation: a full Course+Run revoke.
select public.set_lesson_run_live_access(
  'bf700000-0000-4000-8000-000000000003',
  'b3000000-0000-4000-8000-000000000003',
  true,
  false
);
select public.cancel_lesson_run(
  'bf700000-0000-4000-8000-000000000003',
  '2026-08-19 13:10:00+09'
);

select public.get_lesson_run_live_delivery_admin(
  'bf700000-0000-4000-8000-000000000003'
)::text as m4_scheduled_cancelled_workspace
\gset

select pg_temp.assert_true(
  (:'m4_scheduled_cancelled_workspace'::jsonb -> 'run'
    ->> 'ended')::boolean
    and jsonb_array_length(
      :'m4_scheduled_cancelled_workspace'::jsonb -> 'learners'
    ) = 1
    and exists (
      select 1
      from jsonb_array_elements(
        :'m4_scheduled_cancelled_workspace'::jsonb -> 'learners'
      ) as learner(value)
      where learner.value ->> 'learnerProfileId' =
          'b3000000-0000-4000-8000-000000000003'
        and (learner.value ->> 'courseAccessEnabled')::boolean
        and not (learner.value ->> 'runCapabilityEnabled')::boolean
    ),
  'scheduled cancellation lost its non-authoritative membership tombstone'
);

reset role;

select pg_temp.assert_true(
  not exists (
    select 1
    from public.learning_record as record
    where record.lesson_run_id =
      'bf700000-0000-4000-8000-000000000003'
  )
    and exists (
      select 1
      from public.lesson_run_execution_capability as capability
      where capability.lesson_run_id =
          'bf700000-0000-4000-8000-000000000003'
        and capability.learner_profile_id =
          'b3000000-0000-4000-8000-000000000003'
        and capability.status = 'revoked'
        and capability.revocation_reason = 'run_capability_not_granted'
    ),
  'scheduled cancellation deleted its exact membership tombstone'
);

select set_config(
  'request.jwt.claim.sub',
  'b1000000-0000-4000-8000-000000000001',
  true
);
set local role authenticated;
select public.set_lesson_run_live_access(
  'bf700000-0000-4000-8000-000000000003',
  'b3000000-0000-4000-8000-000000000003',
  false,
  false
);
reset role;

select pg_temp.assert_true(
  exists (
    select 1
    from public.course_learner_enrollment as enrollment
    where enrollment.course_id =
        'bf400000-0000-4000-8000-000000000002'
      and enrollment.learner_profile_id =
        'b3000000-0000-4000-8000-000000000003'
      and enrollment.status = 'revoked'
      and enrollment.revocation_reason = 'teacher_revoked_course_access'
  )
    and exists (
      select 1
      from public.lesson_run_execution_capability as capability
      where capability.lesson_run_id =
          'bf700000-0000-4000-8000-000000000003'
        and capability.learner_profile_id =
          'b3000000-0000-4000-8000-000000000003'
        and capability.status = 'revoked'
    ),
  'full revoke after scheduled cancellation left active delivery authority'
);

update public.course
set owner_account_id = 'b2000000-0000-4000-8000-000000000002'
where id = 'bf400000-0000-4000-8000-000000000002';

select pg_temp.assert_true(
  (
    select course.owner_account_id =
      'b2000000-0000-4000-8000-000000000002'
    from public.course as course
    where course.id = 'bf400000-0000-4000-8000-000000000002'
  ),
  'full revoke after scheduled cancellation did not unblock owner transfer'
);

update public.course
set owner_account_id = 'b2000000-0000-4000-8000-000000000001'
where id = 'bf400000-0000-4000-8000-000000000002';

select set_config(
  'request.jwt.claim.sub',
  'b1000000-0000-4000-8000-000000000001',
  true
);
set local role authenticated;
select public.set_lesson_run_presentation_cursor(
  'bf700000-0000-4000-8000-000000000001',
  'bf550000-0000-4000-8000-000000000001',
  0
)::text as m4_cursor_one
\gset

select pg_temp.assert_true(
  :'m4_cursor_one'::jsonb = jsonb_build_object(
    'slideId', 'bf550000-0000-4000-8000-000000000001'::uuid,
    'revision', 1
  ),
  'cursor CAS did not persist exact Slide/revision response'
);

select pg_temp.assert_raises(
  $sql$
    select public.set_lesson_run_presentation_cursor(
      'bf700000-0000-4000-8000-000000000001',
      null,
      0
    )
  $sql$,
  '40001',
  'lesson_run_cursor_stale',
  'stale cursor revision was accepted'
);
reset role;

set local role service_role;
select public.resolve_lesson_run_live_source_admin(
  'b1000000-0000-4000-8000-000000000003',
  'bf100000-0000-4000-8000-000000000001',
  'bf700000-0000-4000-8000-000000000001'
)::text as m4_live_source
\gset
reset role;

select pg_temp.assert_true(
  :'m4_live_source'::jsonb ->> 'state' = 'live'
    and (:'m4_live_source'::jsonb ->> 'cursorRevision')::bigint = 1
    and (
      select count(*) = 4
        and bool_and(key in (
          'state', 'cursorRevision', 'slide', 'assets'
        ))
      from jsonb_object_keys(:'m4_live_source'::jsonb) as root(key)
    )
    and jsonb_array_length(
      :'m4_live_source'::jsonb -> 'slide' -> 'components'
    ) = 1
    and :'m4_live_source'::jsonb -> 'slide' -> 'components' -> 0
      ->> 'typeKey' = 'rich_text'
    and :'m4_live_source'::jsonb -> 'slide' -> 'components' -> 0
      -> 'payload' ->> 'content' = 'LA_M4_LEARNER_LIVE_SENTINEL'
    and :'m4_live_source'::jsonb -> 'assets' = '[]'::jsonb
    and position('bf600000-0000-4000-8000-000000000001'
      in :'m4_live_source') = 0
    and position('bf550000-0000-4000-8000-000000000001'
      in :'m4_live_source') = 0
    and position('LA_M4_STAFF_ONLY_SENTINEL'
      in :'m4_live_source') = 0,
  'learner resolver leaked IDs/staff content or violated current-Slide DTO'
);

-- Reordering follows the stable selected Slide id while both Slide and
-- Component positions remain the one canonical Lesson order. Content assigned
-- to a different Slide must never enter the source projection.
insert into public.lesson_student_slide (id, lesson_id, position)
values (
  'bf550000-0000-4000-8000-000000000002',
  'bf500000-0000-4000-8000-000000000001',
  2
);

insert into public.lesson_component (
  id,
  lesson_id,
  position,
  type_key,
  payload,
  placement_config,
  visibility,
  student_slide_id
) values (
  'bf600000-0000-4000-8000-000000000002',
  'bf500000-0000-4000-8000-000000000001',
  3,
  'rich_text',
  '{"content":"LA_M4_OTHER_SLIDE_SENTINEL"}'::jsonb,
  '{}'::jsonb,
  'learner_visible',
  'bf550000-0000-4000-8000-000000000002'
);

select pg_temp.assert_true(
  exists (
    select 1
    from public.lesson_run_presentation_state as state
    where state.lesson_run_id =
        'bf700000-0000-4000-8000-000000000001'
      and state.student_slide_id =
        'bf550000-0000-4000-8000-000000000001'
      and state.cursor_version = 1
  ),
  'inserting/revealing another learner Slide changed cursor implicitly'
);

update public.lesson_student_slide
set position = 3
where id = 'bf550000-0000-4000-8000-000000000001';
update public.lesson_student_slide
set position = 1
where id = 'bf550000-0000-4000-8000-000000000002';
update public.lesson_student_slide
set position = 2
where id = 'bf550000-0000-4000-8000-000000000001';

set local role service_role;
select public.resolve_lesson_run_live_source_admin(
  'b1000000-0000-4000-8000-000000000003',
  'bf100000-0000-4000-8000-000000000001',
  'bf700000-0000-4000-8000-000000000001'
)::text as m4_reordered_source
\gset
reset role;

select pg_temp.assert_true(
  (:'m4_reordered_source'::jsonb #>> '{slide,position}')::integer = 2
    and position('LA_M4_LEARNER_LIVE_SENTINEL'
      in :'m4_reordered_source') > 0
    and position('LA_M4_OTHER_SLIDE_SENTINEL'
      in :'m4_reordered_source') = 0
    and position('LA_M4_STAFF_ONLY_SENTINEL'
      in :'m4_reordered_source') = 0,
  'Slide reorder changed cursor identity or leaked another/staff Slide'
);

-- Deleting the selected Slide deterministically returns the Run to waiting
-- and advances the persisted version instead of leaving a dangling cursor.
update public.lesson_component as component
set visibility = 'staff_only',
    student_slide_id = null
where component.id = 'bf600000-0000-4000-8000-000000000001';

select pg_temp.assert_true(
  exists (
    select 1
    from public.lesson_run_presentation_state as state
    where state.lesson_run_id =
        'bf700000-0000-4000-8000-000000000001'
      and state.student_slide_id is null
      and state.cursor_version = 2
  ),
  'empty selected Slide did not atomically clear and bump cursor'
);

delete from public.lesson_student_slide as slide
where slide.id = 'bf550000-0000-4000-8000-000000000001';

select pg_temp.assert_true(
  exists (
    select 1
    from public.lesson_run_presentation_state as state
    where state.lesson_run_id =
        'bf700000-0000-4000-8000-000000000001'
      and state.student_slide_id is null
      and state.cursor_version = 2
  ),
  'selected Slide deletion did not atomically clear and bump cursor'
);

select set_config(
  'request.jwt.claim.sub',
  'b1000000-0000-4000-8000-000000000001',
  true
);
set local role authenticated;
select public.set_lesson_run_live_access(
  'bf700000-0000-4000-8000-000000000001',
  'b3000000-0000-4000-8000-000000000003',
  true,
  false
);
reset role;

set local role service_role;
select pg_temp.assert_raises(
  $sql$
    select public.resolve_lesson_run_live_source_admin(
      'b1000000-0000-4000-8000-000000000003',
      'bf100000-0000-4000-8000-000000000001',
      'bf700000-0000-4000-8000-000000000001'
    )
  $sql$,
  'P0002',
  'lesson_run_live_not_found',
  'explicit Run capability revoke did not close learner delivery'
);
reset role;

select set_config(
  'request.jwt.claim.sub',
  'b1000000-0000-4000-8000-000000000001',
  true
);
set local role authenticated;
select public.set_lesson_run_live_access(
  'bf700000-0000-4000-8000-000000000001',
  'b3000000-0000-4000-8000-000000000003',
  true,
  true
);
select public.set_lesson_run_live_access(
  'bf700000-0000-4000-8000-000000000001',
  'b3000000-0000-4000-8000-000000000003',
  false,
  false
);
reset role;

select pg_temp.assert_true(
  exists (
    select 1
    from public.course_learner_enrollment as enrollment
    where enrollment.course_id =
        'bf400000-0000-4000-8000-000000000001'
      and enrollment.learner_profile_id =
        'b3000000-0000-4000-8000-000000000003'
      and enrollment.status = 'revoked'
      and enrollment.revision = 2
  )
    and exists (
      select 1
      from public.lesson_run_execution_capability as capability
      where capability.lesson_run_id =
          'bf700000-0000-4000-8000-000000000001'
        and capability.learner_profile_id =
          'b3000000-0000-4000-8000-000000000003'
        and capability.status = 'revoked'
        and capability.revocation_reason =
          'teacher_revoked_course_access'
    ),
  'Course enrollment revoke did not invalidate active Run capability'
);

-- A learner Account status transition revokes durable authority. Returning it
-- to active cannot silently revive either Course or Run access.
select set_config(
  'request.jwt.claim.sub',
  'b1000000-0000-4000-8000-000000000001',
  true
);
set local role authenticated;
select public.set_lesson_run_live_access(
  'bf700000-0000-4000-8000-000000000001',
  'b3000000-0000-4000-8000-000000000003',
  true,
  true
);
reset role;

update public.account
set status = 'suspended'
where id = 'b2000000-0000-4000-8000-000000000003';

select pg_temp.assert_true(
  exists (
    select 1
    from public.course_learner_enrollment as enrollment
    where enrollment.course_id =
        'bf400000-0000-4000-8000-000000000001'
      and enrollment.learner_profile_id =
        'b3000000-0000-4000-8000-000000000003'
      and enrollment.status = 'revoked'
      and enrollment.revocation_reason = 'learner_account_deactivated'
  )
    and not exists (
      select 1
      from public.lesson_run_execution_capability as capability
      where capability.lesson_run_id =
          'bf700000-0000-4000-8000-000000000001'
        and capability.learner_profile_id =
          'b3000000-0000-4000-8000-000000000003'
        and capability.status = 'active'
    ),
  'learner Account deactivation left live authority active'
);

select set_config(
  'request.jwt.claim.sub',
  'b1000000-0000-4000-8000-000000000001',
  true
);
set local role authenticated;
select public.get_lesson_run_live_delivery_admin(
  'bf700000-0000-4000-8000-000000000001'
)::text as m4_suspended_workspace
\gset
reset role;

select pg_temp.assert_true(
  exists (
    select 1
    from jsonb_array_elements(
      :'m4_suspended_workspace'::jsonb -> 'learners'
    ) as learner(value)
    where learner.value ->> 'learnerProfileId' =
        'b3000000-0000-4000-8000-000000000003'
      and learner.value ->> 'identityState' = 'offline'
      and not (learner.value ->> 'courseAccessEnabled')::boolean
      and not (learner.value ->> 'runCapabilityEnabled')::boolean
  ),
  'suspended learner DTO remained offline-but-enabled'
);

update public.account
set status = 'active'
where id = 'b2000000-0000-4000-8000-000000000003';

set local role service_role;
select pg_temp.assert_raises(
  $sql$
    select public.resolve_lesson_run_live_source_admin(
      'b1000000-0000-4000-8000-000000000003',
      'bf100000-0000-4000-8000-000000000001',
      'bf700000-0000-4000-8000-000000000001'
    )
  $sql$,
  'P0002',
  'lesson_run_live_not_found',
  'learner Account reactivation silently revived old authority'
);
reset role;

-- A fresh explicit owner grant is required after reactivation; subsequent
-- unlink/relink must revoke rather than transfer that grant.
select set_config(
  'request.jwt.claim.sub',
  'b1000000-0000-4000-8000-000000000001',
  true
);
set local role authenticated;
select public.set_lesson_run_live_access(
  'bf700000-0000-4000-8000-000000000001',
  'b3000000-0000-4000-8000-000000000003',
  true,
  true
);
reset role;

select set_config('app.learner_profile_link_mutation', 'on', true);
update public.learner_profile as profile
set account_id = null
where profile.id = 'b3000000-0000-4000-8000-000000000003';
select set_config('app.learner_profile_link_mutation', 'off', true);

select pg_temp.assert_true(
  exists (
    select 1
    from public.course_learner_enrollment as enrollment
    where enrollment.course_id =
        'bf400000-0000-4000-8000-000000000001'
      and enrollment.learner_profile_id =
        'b3000000-0000-4000-8000-000000000003'
      and enrollment.status = 'revoked'
      and enrollment.revocation_reason = 'learner_account_changed'
  )
    and not exists (
      select 1
      from public.lesson_run_execution_capability as capability
      where capability.lesson_run_id =
          'bf700000-0000-4000-8000-000000000001'
        and capability.learner_profile_id =
          'b3000000-0000-4000-8000-000000000003'
        and capability.status = 'active'
    ),
  'learner Account unlink left enrollment or Run capability active'
);

select set_config(
  'request.jwt.claim.sub',
  'b1000000-0000-4000-8000-000000000001',
  true
);
set local role authenticated;
select public.get_lesson_run_live_delivery_admin(
  'bf700000-0000-4000-8000-000000000001'
)::text as m4_unlinked_workspace
\gset
reset role;

select pg_temp.assert_true(
  exists (
    select 1
    from jsonb_array_elements(
      :'m4_unlinked_workspace'::jsonb -> 'learners'
    ) as learner(value)
    where learner.value ->> 'learnerProfileId' =
        'b3000000-0000-4000-8000-000000000003'
      and learner.value ->> 'identityState' = 'offline'
      and not (learner.value ->> 'courseAccessEnabled')::boolean
      and not (learner.value ->> 'runCapabilityEnabled')::boolean
  ),
  'teacher workspace retained enabled authority for unlinked profile'
);

set local role service_role;
select pg_temp.assert_raises(
  $sql$
    select public.resolve_lesson_run_live_source_admin(
      'b1000000-0000-4000-8000-000000000003',
      'bf100000-0000-4000-8000-000000000001',
      'bf700000-0000-4000-8000-000000000001'
    )
  $sql$,
  'P0002',
  'lesson_run_live_not_found',
  'unlinked Account retained learner delivery'
);
reset role;

select set_config('app.learner_profile_link_mutation', 'on', true);
update public.learner_profile as profile
set account_id = 'b2000000-0000-4000-8000-000000000003'
where profile.id = 'b3000000-0000-4000-8000-000000000003';
select set_config('app.learner_profile_link_mutation', 'off', true);

-- A relink does not restore authority; only a fresh explicit owner grant does.
select set_config(
  'request.jwt.claim.sub',
  'b1000000-0000-4000-8000-000000000001',
  true
);
set local role authenticated;
select public.set_lesson_run_live_access(
  'bf700000-0000-4000-8000-000000000001',
  'b3000000-0000-4000-8000-000000000003',
  true,
  true
);

-- Complete and retain only the safe ended state.
select public.complete_lesson_run_v2(
  'bf700000-0000-4000-8000-000000000001',
  '[
    {
      "learnerProfileId":"b3000000-0000-4000-8000-000000000002",
      "wasPresent":false
    },
    {
      "learnerProfileId":"b3000000-0000-4000-8000-000000000003",
      "wasPresent":true
    }
  ]'::jsonb,
  null,
  '2026-08-19 11:30:00+09',
  25
);
reset role;

set local role service_role;
select public.resolve_lesson_run_live_source_admin(
  'b1000000-0000-4000-8000-000000000003',
  'bf100000-0000-4000-8000-000000000001',
  'bf700000-0000-4000-8000-000000000001'
)::text as m4_ended_source
\gset
reset role;

select pg_temp.assert_true(
  :'m4_ended_source'::jsonb = '{"state":"ended"}'::jsonb,
  'completed authorized Run exposed content instead of exact ended DTO'
);

update public.account
set status = 'suspended'
where id = 'b2000000-0000-4000-8000-000000000001';

select pg_temp.assert_true(
  exists (
    select 1
    from public.course_learner_enrollment as enrollment
    where enrollment.course_id =
        'bf400000-0000-4000-8000-000000000001'
      and enrollment.learner_profile_id =
        'b3000000-0000-4000-8000-000000000003'
      and enrollment.status = 'revoked'
      and enrollment.revocation_reason =
        'course_owner_account_deactivated'
  ),
  'Course owner Account deactivation retained dormant live authority'
);

set local role service_role;
select pg_temp.assert_raises(
  $sql$
    select public.resolve_lesson_run_live_source_admin(
      'b1000000-0000-4000-8000-000000000003',
      'bf100000-0000-4000-8000-000000000001',
      'bf700000-0000-4000-8000-000000000001'
    )
  $sql$,
  'P0002',
  'lesson_run_live_not_found',
  'inactive Course owner left ended learner access readable'
);
reset role;

update public.account
set status = 'active'
where id = 'b2000000-0000-4000-8000-000000000001';

set local role service_role;
select pg_temp.assert_raises(
  $sql$
    select public.resolve_lesson_run_live_source_admin(
      'b1000000-0000-4000-8000-000000000003',
      'bf100000-0000-4000-8000-000000000001',
      'bf700000-0000-4000-8000-000000000001'
    )
  $sql$,
  'P0002',
  'lesson_run_live_not_found',
  'Course owner Account reactivation silently revived authority'
);
reset role;

-- Recreate Course authority explicitly so owner-transfer/archive guards are
-- still exercised on the ended Run. Run capability cannot be regranted after
-- close and remains revoked.
select set_config(
  'request.jwt.claim.sub',
  'b1000000-0000-4000-8000-000000000001',
  true
);
set local role authenticated;
select public.set_lesson_run_live_access(
  'bf700000-0000-4000-8000-000000000001',
  'b3000000-0000-4000-8000-000000000003',
  true,
  false
);
reset role;

select pg_temp.assert_raises(
  $sql$
    update public.course
    set owner_account_id = 'b2000000-0000-4000-8000-000000000002'
    where id = 'bf400000-0000-4000-8000-000000000001'
  $sql$,
  '55000',
  'course_live_access_owner_change_blocked',
  'Course owner transfer moved active learner authority'
);

update public.course as course
set archived_at = clock_timestamp()
where course.id = 'bf400000-0000-4000-8000-000000000001';

select pg_temp.assert_true(
  exists (
    select 1
    from public.course_learner_enrollment as enrollment
    where enrollment.course_id =
        'bf400000-0000-4000-8000-000000000001'
      and enrollment.status = 'revoked'
      and enrollment.revocation_reason = 'course_archived'
  )
    and not exists (
      select 1
      from public.lesson_run_execution_capability as capability
      where capability.course_id =
          'bf400000-0000-4000-8000-000000000001'
        and capability.status = 'active'
    ),
  'Course archive left live enrollment or Run capability active'
);

insert into public.account_security (
  account_id,
  sessions_invalid_before
) values (
  'b2000000-0000-4000-8000-000000000003',
  '2026-08-20 00:00:00+09'
)
on conflict (account_id) do update
set sessions_invalid_before = excluded.sessions_invalid_before;

set local role service_role;
select pg_temp.assert_raises(
  $sql$
    select public.resolve_lesson_run_live_source_admin(
      'b1000000-0000-4000-8000-000000000003',
      'bf100000-0000-4000-8000-000000000001',
      'bf700000-0000-4000-8000-000000000001'
    )
  $sql$,
  '42501',
  'live_delivery_session_revoked',
  'Supabase session cutoff did not produce the dedicated revocation token'
);

select pg_temp.assert_raises(
  $sql$
    select * from public.lesson_run_execution_capability
  $sql$,
  '42501',
  'permission denied for table lesson_run_execution_capability',
  'service_role received raw capability table access'
);
reset role;

delete from public.account_security
where account_id = 'b2000000-0000-4000-8000-000000000003';

set local role service_role;
select pg_temp.assert_raises(
  $sql$
    select public.resolve_lesson_run_live_source_admin(
      'b1000000-0000-4000-8000-000000000003',
      'bf100000-0000-4000-8000-000000000001',
      'bf700000-0000-4000-8000-000000000001'
    )
  $sql$,
  '42501',
  'live_delivery_session_revoked',
  'missing account_security row failed open'
);
reset role;

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
