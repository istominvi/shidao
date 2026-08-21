#!/usr/bin/env bash
set -euo pipefail

# Transactional P1.3 Homework acceptance harness. It is intentionally locked
# to one disposable clone name, and every fixture/mutation ends in ROLLBACK.

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is required for the isolated Homework test database." >&2
  exit 2
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "psql is required to run the Homework database acceptance suite." >&2
  exit 2
fi

db_name="$(
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -Atqc \
    'select current_database()'
)"
if [[ "$db_name" != "shidao_homework_authoring_test" ]]; then
  echo "Refusing Homework fixtures for database '$db_name'; expected exactly 'shidao_homework_authoring_test'." >&2
  exit 2
fi

schema_marker="$(
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -Atqc \
    "select case when
       to_regclass('public.lesson_homework') is not null
       and to_regclass('public.lesson_homework_item') is not null
       and to_regprocedure('public.get_my_lesson_homework(uuid)') is not null
       and to_regprocedure(
         'public.replace_my_lesson_homework(uuid,integer,jsonb)'
       ) is not null
       and to_regprocedure(
         'public.build_lesson_homework_projection(uuid)'
       ) is not null
       and to_regprocedure(
         'public.delete_lesson_with_history(uuid)'
       ) is not null
     then 'shidao-homework-p1-3' else '' end"
)"
if [[ "$schema_marker" != "shidao-homework-p1-3" ]]; then
  echo "Refusing fixtures: '$db_name' is not at the P1.3 Homework schema." >&2
  exit 2
fi

psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 <<'SQL'
\set VERBOSITY verbose
begin;
set constraints all deferred;

grant usage on schema auth to authenticated;

do $guard$
begin
  if current_database() <> 'shidao_homework_authoring_test' then
    raise exception
      'homework_acceptance_wrong_database:%',
      current_database()
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
    raise exception 'homework_acceptance_failed:%', p_message;
  end if;
end
$$;

create function pg_temp.assert_error(
  p_statement text,
  p_expected_sqlstate text,
  p_expected_message text,
  p_message text
)
returns void
language plpgsql
as $$
declare
  v_sqlstate text;
  v_message text;
begin
  begin
    execute p_statement;
  exception when others then
    get stacked diagnostics
      v_sqlstate = returned_sqlstate,
      v_message = message_text;
    if v_sqlstate = p_expected_sqlstate
      and (
        p_expected_message is null
        or v_message = p_expected_message
      )
    then
      return;
    end if;
    raise exception
      'homework_acceptance_failed:% expected %/%, got %/%',
      p_message,
      p_expected_sqlstate,
      coalesce(p_expected_message, '<any>'),
      v_sqlstate,
      v_message;
  end;
  raise exception
    'homework_acceptance_failed:% statement did not fail',
    p_message;
end
$$;

create function pg_temp.set_authenticated_session(
  p_auth_user_id uuid,
  p_session_id uuid
)
returns void
language plpgsql
as $$
begin
  perform set_config(
    'request.jwt.claim.sub',
    p_auth_user_id::text,
    true
  );
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'sub', p_auth_user_id,
      'session_id', p_session_id,
      'role', 'authenticated'
    )::text,
    true
  );
end
$$;

create function pg_temp.learner_state_counts()
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'lessonRun', (select count(*) from public.lesson_run),
    'learningRecord', (select count(*) from public.learning_record),
    'observation', (
      select count(*) from public.lesson_component_observation
    ),
    'evidence', (select count(*) from public.learning_evidence),
    'objectiveState', (
      select count(*) from public.learner_objective_state
    ),
    'objectiveStateEvidence', (
      select count(*) from public.learner_objective_state_evidence
    ),
    'recommendationOverride', (
      select count(*) from public.learner_recommendation_override
    ),
    'enrollment', (
      select count(*) from public.course_learner_enrollment
    ),
    'executionCapability', (
      select count(*) from public.lesson_run_execution_capability
    ),
    'presentationState', (
      select count(*) from public.lesson_run_presentation_state
    ),
    'quizIssue', (select count(*) from public.choice_quiz_issue),
    'quizAttempt', (select count(*) from public.choice_quiz_attempt),
    'quizResponse', (select count(*) from public.choice_quiz_response),
    'quizEvaluation', (
      select count(*) from public.choice_quiz_evaluation
    ),
    'quizFeedback', (
      select count(*) from public.choice_quiz_feedback_delivery
    )
  );
$$;

-- Physical contract: closed raw relations and two authenticated owner RPCs.
select pg_temp.assert_true(
  (
    select count(*) = 2
    from pg_class as relation
    join pg_namespace as namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relname in (
        'lesson_homework',
        'lesson_homework_item'
      )
      and relation.relrowsecurity
  ),
  'Homework raw relations must have RLS enabled'
);

select pg_temp.assert_true(
  not exists (
    select 1
    from pg_policies as policy
    where policy.schemaname = 'public'
      and policy.tablename in (
        'lesson_homework',
        'lesson_homework_item'
      )
  ),
  'Homework raw relations must not expose policies'
);

select pg_temp.assert_true(
  not exists (
    select 1
    from unnest(array[
      'anon',
      'authenticated',
      'service_role'
    ]) as actor(role_name)
    cross join unnest(array[
      'public.lesson_homework',
      'public.lesson_homework_item'
    ]) as relation(name)
    cross join unnest(array[
      'SELECT',
      'INSERT',
      'UPDATE',
      'DELETE',
      'TRUNCATE',
      'REFERENCES',
      'TRIGGER'
    ]) as privilege(name)
    where has_table_privilege(
      actor.role_name,
      relation.name,
      privilege.name
    )
  ),
  'Homework raw ACL must be closed'
);

select pg_temp.assert_true(
  has_function_privilege(
    'authenticated',
    'public.get_my_lesson_homework(uuid)',
    'EXECUTE'
  )
    and has_function_privilege(
      'authenticated',
      'public.replace_my_lesson_homework(uuid,integer,jsonb)',
      'EXECUTE'
    )
    and not has_function_privilege(
      'anon',
      'public.get_my_lesson_homework(uuid)',
      'EXECUTE'
    )
    and not has_function_privilege(
      'service_role',
      'public.replace_my_lesson_homework(uuid,integer,jsonb)',
      'EXECUTE'
    )
    and not has_function_privilege(
      'authenticated',
      'public.build_lesson_homework_projection(uuid)',
      'EXECUTE'
    ),
  'Homework RPC ACL is not narrow'
);

-- Disposable authority and Course/Lesson graph.
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
    'f3100000-0000-4000-8000-000000000001',
    'homework-owner@test.invalid',
    clock_timestamp(),
    '{}'::jsonb,
    '{}'::jsonb
  ),
  (
    'f3100000-0000-4000-8000-000000000002',
    'homework-outsider@test.invalid',
    clock_timestamp(),
    '{}'::jsonb,
    '{}'::jsonb
  );

insert into auth.sessions (
  id,
  user_id,
  created_at,
  updated_at,
  not_after
)
values
  (
    'f3110000-0000-4000-8000-000000000001',
    'f3100000-0000-4000-8000-000000000001',
    clock_timestamp(),
    clock_timestamp(),
    null
  ),
  (
    'f3110000-0000-4000-8000-000000000002',
    'f3100000-0000-4000-8000-000000000002',
    clock_timestamp(),
    clock_timestamp(),
    null
  );

insert into public.account (
  id,
  auth_user_id,
  display_name,
  status
)
values
  (
    'f3200000-0000-4000-8000-000000000001',
    'f3100000-0000-4000-8000-000000000001',
    'Homework Owner',
    'active'
  ),
  (
    'f3200000-0000-4000-8000-000000000002',
    'f3100000-0000-4000-8000-000000000002',
    'Homework Outsider',
    'active'
  );

insert into public.account_security (account_id, sessions_invalid_before)
values
  ('f3200000-0000-4000-8000-000000000001', null),
  ('f3200000-0000-4000-8000-000000000002', null);

insert into public.course (
  id,
  owner_account_id,
  title,
  learning_audience,
  archived_at
)
values
  (
    'f3400000-0000-4000-8000-000000000001',
    'f3200000-0000-4000-8000-000000000001',
    'Homework acceptance',
    'children',
    null
  ),
  (
    'f3400000-0000-4000-8000-000000000002',
    'f3200000-0000-4000-8000-000000000002',
    'Other owner Homework',
    'children',
    null
  ),
  (
    'f3400000-0000-4000-8000-000000000003',
    'f3200000-0000-4000-8000-000000000001',
    'Archived Homework',
    'children',
    clock_timestamp()
  );

insert into public.lesson (id, course_id, position, title)
values
  (
    'f3500000-0000-4000-8000-000000000001',
    'f3400000-0000-4000-8000-000000000001',
    1,
    'Authoring lifecycle'
  ),
  (
    'f3500000-0000-4000-8000-000000000002',
    'f3400000-0000-4000-8000-000000000002',
    1,
    'Other owner'
  ),
  (
    'f3500000-0000-4000-8000-000000000003',
    'f3400000-0000-4000-8000-000000000003',
    1,
    'Archived Course'
  ),
  (
    'f3500000-0000-4000-8000-000000000004',
    'f3400000-0000-4000-8000-000000000001',
    2,
    'Delete lifecycle'
  ),
  (
    'f3500000-0000-4000-8000-000000000005',
    'f3400000-0000-4000-8000-000000000001',
    3,
    'Empty no-op'
  );

insert into public.stored_file (
  id,
  owner_account_id,
  storage_path,
  original_filename,
  mime_type,
  size_bytes,
  checksum_sha256,
  status
)
values
  (
    'f3700000-0000-4000-8000-000000000001',
    'f3200000-0000-4000-8000-000000000001',
    'f3200000-0000-4000-8000-000000000001/homework/image.png',
    'image.png',
    'image/png',
    128,
    repeat('a', 64),
    'ready'
  ),
  (
    'f3700000-0000-4000-8000-000000000002',
    'f3200000-0000-4000-8000-000000000001',
    'f3200000-0000-4000-8000-000000000001/homework/file.pdf',
    'file.pdf',
    'application/pdf',
    256,
    repeat('b', 64),
    'ready'
  );

insert into public.course_attachment (id, course_id, stored_file_id)
values
  (
    'f3710000-0000-4000-8000-000000000001',
    'f3400000-0000-4000-8000-000000000001',
    'f3700000-0000-4000-8000-000000000001'
  ),
  (
    'f3710000-0000-4000-8000-000000000002',
    'f3400000-0000-4000-8000-000000000001',
    'f3700000-0000-4000-8000-000000000002'
  );

set local session_replication_role = origin;

create temp table learner_state_baseline (value jsonb not null)
on commit drop;
insert into learner_state_baseline values (pg_temp.learner_state_counts());

-- Direct table and anonymous RPC access fail before any product mutation.
set local role authenticated;
select pg_temp.assert_error(
  $statement$select count(*) from public.lesson_homework$statement$,
  '42501',
  null,
  'authenticated raw table read was accepted'
);
reset role;
set local role anon;
select pg_temp.assert_error(
  $statement$select public.get_my_lesson_homework(
    'f3500000-0000-4000-8000-000000000001'
  )$statement$,
  '42501',
  null,
  'anonymous Homework RPC was accepted'
);
reset role;

-- Owner create/read/reload, full-list update, deterministic reorder and CAS.
select pg_temp.set_authenticated_session(
  'f3100000-0000-4000-8000-000000000001',
  'f3110000-0000-4000-8000-000000000001'
);
set local role authenticated;

select pg_temp.assert_true(
  public.get_my_lesson_homework(
    'f3500000-0000-4000-8000-000000000001'
  ) -> 'homework' = 'null'::jsonb,
  'new Lesson did not expose an honest null Homework state'
);

do $create$
declare
  v_result jsonb;
begin
  v_result := public.replace_my_lesson_homework(
    'f3500000-0000-4000-8000-000000000001',
    null,
    jsonb_build_array(
      jsonb_build_object(
        'id', 'f3600000-0000-4000-8000-000000000001',
        'typeKey', 'rich_text',
        'schemaVersion', 1,
        'payload', jsonb_build_object(
          'content', 'Прочитайте текст',
          'format', 'markdown'
        ),
        'placement', jsonb_build_object(
          'width', 'content',
          'textAlign', 'start'
        )
      ),
      jsonb_build_object(
        'id', 'f3600000-0000-4000-8000-000000000002',
        'typeKey', 'external_link',
        'schemaVersion', 1,
        'payload', jsonb_build_object(
          'url', 'https://example.test/task',
          'label', 'Задание',
          'openInNewTab', true
        ),
        'placement', jsonb_build_object(
          'width', 'content',
          'align', 'start',
          'style', 'card'
        )
      ),
      jsonb_build_object(
        'id', 'f3600000-0000-4000-8000-000000000007',
        'typeKey', 'image',
        'schemaVersion', 1,
        'payload', jsonb_build_object(
          'storedFileId', 'f3700000-0000-4000-8000-000000000001',
          'alt', 'Проверенное изображение'
        ),
        'placement', jsonb_build_object(
          'width', 'content',
          'align', 'start',
          'fit', 'contain',
          'aspectRatio', 'auto'
        )
      )
    )
  );
  perform pg_temp.assert_true(
    v_result #>> '{homework,revision}' = '1'
      and jsonb_array_length(v_result #> '{homework,items}') = 3
      and v_result #>> '{homework,items,0,position}' = '1'
      and v_result #>> '{homework,items,1,position}' = '2'
      and v_result #>> '{homework,items,2,position}' = '3',
    'create projection was not revision 1 with dense order'
  );
  perform pg_temp.assert_true(
    public.get_my_lesson_homework(
      'f3500000-0000-4000-8000-000000000001'
    ) = v_result,
    'read-after-create did not reload the persisted aggregate'
  );
end
$create$;

select pg_temp.assert_error(
  $statement$select public.replace_my_lesson_homework(
    'f3500000-0000-4000-8000-000000000001',
    9,
    '[{
      "id":"f3600000-0000-4000-8000-000000000001",
      "typeKey":"rich_text",
      "schemaVersion":1,
      "payload":{"content":"Устаревшее","format":"markdown"},
      "placement":{"width":"content","textAlign":"start"}
    }]'::jsonb
  )$statement$,
  '40001',
  'lesson_homework_revision_conflict',
  'stale replace was accepted'
);

select pg_temp.assert_error(
  $statement$select public.replace_my_lesson_homework(
    'f3500000-0000-4000-8000-000000000001',
    1,
    '[{
      "id":"f3600000-0000-4000-8000-000000000003",
      "typeKey":"free_response",
      "schemaVersion":1,
      "payload":{},
      "placement":{}
    }]'::jsonb
  )$statement$,
  '22023',
  'lesson_homework_item_invalid',
  'activity type escaped the Homework allowlist'
);

select pg_temp.assert_error(
  $statement$select public.replace_my_lesson_homework(
    'f3500000-0000-4000-8000-000000000001',
    1,
    '[{
      "id":"f3600000-0000-4000-8000-000000000003",
      "typeKey":"rich_text",
      "schemaVersion":1,
      "payload":{"content":"Лишний ключ","format":"markdown"},
      "placement":{"width":"content","textAlign":"start"},
      "unexpected":true
    }]'::jsonb
  )$statement$,
  '22023',
  'lesson_homework_item_invalid',
  'unknown item key was accepted'
);

select pg_temp.assert_error(
  $statement$select public.replace_my_lesson_homework(
    'f3500000-0000-4000-8000-000000000001',
    1,
    '[{
      "id":"f3600000-0000-4000-8000-000000000003",
      "typeKey":"rich_text",
      "schemaVersion":1,
      "payload":{},
      "placement":{"width":"content","textAlign":"start"}
    }]'::jsonb
  )$statement$,
  '22023',
  'lesson_homework_item_invalid',
  'malformed registry payload bypassed the direct RPC boundary'
);

select pg_temp.assert_error(
  $statement$select public.replace_my_lesson_homework(
    'f3500000-0000-4000-8000-000000000001',
    1,
    '[{
      "id":"f3600000-0000-4000-8000-000000000003",
      "typeKey":"image",
      "schemaVersion":1,
      "payload":{
        "storedFileId":"f3700000-0000-4000-8000-000000000002",
        "alt":"Не изображение"
      },
      "placement":{
        "width":"content",
        "align":"start",
        "fit":"contain",
        "aspectRatio":"auto"
      }
    }]'::jsonb
  )$statement$,
  '22023',
  'lesson_homework_item_invalid',
  'non-image Course attachment bypassed image MIME validation'
);

select pg_temp.assert_error(
  $statement$select public.replace_my_lesson_homework(
    'f3500000-0000-4000-8000-000000000001',
    1,
    '[{
      "id":"f3600000-0000-4000-8000-000000000003",
      "typeKey":"file",
      "schemaVersion":1,
      "payload":{
        "storedFileId":"f3700000-0000-4000-8000-000000000099",
        "label":"Чужой файл",
        "openMode":"download"
      },
      "placement":{"width":"content","display":"card"}
    }]'::jsonb
  )$statement$,
  '22023',
  'lesson_homework_item_invalid',
  'unattached storedFileId bypassed Course asset validation'
);

select pg_temp.assert_error(
  $statement$select public.replace_my_lesson_homework(
    'f3500000-0000-4000-8000-000000000001',
    1,
    '[{
      "id":"f3600000-0000-4000-8000-000000000003",
      "typeKey":"rich_text",
      "schemaVersion":1,
      "payload":{"content":"Первый","format":"markdown"},
      "placement":{"width":"content","textAlign":"start"}
    },{
      "id":"f3600000-0000-4000-8000-000000000003",
      "typeKey":"image",
      "schemaVersion":1,
      "payload":{"storedFileId":null,"alt":""},
      "placement":{"width":"content","align":"start","fit":"contain","aspectRatio":"auto"}
    }]'::jsonb
  )$statement$,
  '22023',
  'lesson_homework_item_id_duplicate',
  'duplicate item identifiers were accepted'
);

do $reorder$
declare
  v_result jsonb;
begin
  v_result := public.replace_my_lesson_homework(
    'f3500000-0000-4000-8000-000000000001',
    1,
    '[{
      "id":"f3600000-0000-4000-8000-000000000002",
      "typeKey":"external_link",
      "schemaVersion":1,
      "payload":{"url":"https://example.test/updated","label":"Новое","openInNewTab":true},
      "placement":{"width":"content","align":"start","style":"card"}
    },{
      "id":"f3600000-0000-4000-8000-000000000001",
      "typeKey":"rich_text",
      "schemaVersion":1,
      "payload":{"content":"Обновлено","format":"markdown"},
      "placement":{"width":"content","textAlign":"start"}
    }]'::jsonb
  );
  perform pg_temp.assert_true(
    v_result #>> '{homework,revision}' = '2'
      and v_result #>> '{homework,items,0,id}' =
        'f3600000-0000-4000-8000-000000000002'
      and v_result #>> '{homework,items,0,position}' = '1'
      and v_result #>> '{homework,items,1,id}' =
        'f3600000-0000-4000-8000-000000000001'
      and v_result #>> '{homework,items,1,position}' = '2',
    'full-list update/reorder was not atomic and dense'
  );
end
$reorder$;

reset role;

select pg_temp.assert_true(
  (
    select count(*) = 1
    from public.lesson_homework
    where lesson_id = 'f3500000-0000-4000-8000-000000000001'
  ),
  'Lesson did not retain exactly one Homework owner row'
);

select pg_temp.assert_error(
  $statement$insert into public.lesson_homework (lesson_id)
    values ('f3500000-0000-4000-8000-000000000001')$statement$,
  '23505',
  null,
  'database accepted a second Homework for one Lesson'
);

-- Clear advances the same aggregate; old revisions can never succeed by ABA.
set local role authenticated;
do $clear$
declare
  v_result jsonb;
begin
  v_result := public.replace_my_lesson_homework(
    'f3500000-0000-4000-8000-000000000001',
    2,
    '[]'::jsonb
  );
  perform pg_temp.assert_true(
    v_result #>> '{homework,revision}' = '3'
      and v_result #> '{homework,items}' = '[]'::jsonb,
    'clear did not retain an empty revision-3 aggregate'
  );
  perform pg_temp.assert_true(
    public.get_my_lesson_homework(
      'f3500000-0000-4000-8000-000000000001'
    ) = v_result,
    'cleared aggregate did not persist across reload'
  );
end
$clear$;

select pg_temp.assert_error(
  $statement$select public.replace_my_lesson_homework(
    'f3500000-0000-4000-8000-000000000001',
    1,
    '[{
      "id":"f3600000-0000-4000-8000-000000000004",
      "typeKey":"rich_text",
      "schemaVersion":1,
      "payload":{"content":"ABA","format":"markdown"},
      "placement":{"width":"content","textAlign":"start"}
    }]'::jsonb
  )$statement$,
  '40001',
  'lesson_homework_revision_conflict',
  'pre-clear revision succeeded after clear (ABA)'
);

select pg_temp.assert_true(
  public.replace_my_lesson_homework(
    'f3500000-0000-4000-8000-000000000005',
    null,
    '[]'::jsonb
  ) -> 'homework' = 'null'::jsonb,
  'empty create was not a no-op'
);

-- Cross-owner and archived Courses are indistinguishable from not-found.
select pg_temp.assert_error(
  $statement$select public.get_my_lesson_homework(
    'f3500000-0000-4000-8000-000000000002'
  )$statement$,
  'P0002',
  'lesson_homework_not_found',
  'cross-owner Homework read was accepted'
);
select pg_temp.assert_error(
  $statement$select public.replace_my_lesson_homework(
    'f3500000-0000-4000-8000-000000000002',
    null,
    '[{
      "id":"f3600000-0000-4000-8000-000000000005",
      "typeKey":"rich_text",
      "schemaVersion":1,
      "payload":{"content":"Чужое","format":"markdown"},
      "placement":{"width":"content","textAlign":"start"}
    }]'::jsonb
  )$statement$,
  'P0002',
  'lesson_homework_not_found',
  'cross-owner Homework write was accepted'
);
select pg_temp.assert_error(
  $statement$select public.get_my_lesson_homework(
    'f3500000-0000-4000-8000-000000000003'
  )$statement$,
  'P0002',
  'lesson_homework_not_found',
  'archived-Course Homework read was accepted'
);

-- Lesson deletion cascades the separate Homework graph.
select public.replace_my_lesson_homework(
  'f3500000-0000-4000-8000-000000000004',
  null,
  '[{
    "id":"f3600000-0000-4000-8000-000000000006",
    "typeKey":"rich_text",
    "schemaVersion":1,
    "payload":{"content":"Удалить вместе с уроком","format":"markdown"},
    "placement":{"width":"content","textAlign":"start"}
  }]'::jsonb
);
select pg_temp.assert_true(
  public.delete_lesson_with_history(
    'f3500000-0000-4000-8000-000000000004'
  ),
  'Lesson lifecycle delete did not succeed'
);
reset role;

select pg_temp.assert_true(
  not exists (
    select 1
    from public.lesson
    where id = 'f3500000-0000-4000-8000-000000000004'
  )
    and not exists (
      select 1
      from public.lesson_homework
      where lesson_id = 'f3500000-0000-4000-8000-000000000004'
    )
    and not exists (
      select 1
      from public.lesson_homework_item
      where id = 'f3600000-0000-4000-8000-000000000006'
    ),
  'Lesson delete left Homework or item rows'
);

select pg_temp.assert_true(
  not exists (
    select 1
    from public.lesson_homework
    where lesson_id = 'f3500000-0000-4000-8000-000000000005'
  ),
  'empty create produced an owner row'
);

select pg_temp.assert_true(
  (select value from learner_state_baseline) =
    pg_temp.learner_state_counts(),
  'Homework authoring changed learner issuance/attempt/evidence state'
);

rollback;
SQL

echo "Homework P1.3 database acceptance suite passed; all fixtures rolled back."
