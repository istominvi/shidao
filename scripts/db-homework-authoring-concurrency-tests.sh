#!/usr/bin/env bash
set -euo pipefail

# Real multi-session P1.3 Homework races. Fixtures are committed only inside
# the exact disposable clone and are removed by the EXIT trap.

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is required for the isolated Homework test database." >&2
  exit 2
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "psql is required to run the Homework concurrency suite." >&2
  exit 2
fi

db_name="$(
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -Atqc \
    'select current_database()'
)"
if [[ "$db_name" != "shidao_homework_authoring_test" ]]; then
  echo "Refusing Homework concurrency fixtures for database '$db_name'; expected exactly 'shidao_homework_authoring_test'." >&2
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
       and position(
         'set revision = homework.revision + 1'
         in pg_get_functiondef(to_regprocedure(
           'public.replace_my_lesson_homework(uuid,integer,jsonb)'
         ))
       ) > 0
       and position(
         'public.lesson_homework as homework'
         in pg_get_functiondef(to_regprocedure(
           'public.delete_lesson_with_history(uuid)'
         ))
       ) > 0
     then 'shidao-homework-p1-3-concurrency' else '' end"
)"
if [[ "$schema_marker" != "shidao-homework-p1-3-concurrency" ]]; then
  echo "Refusing races: '$db_name' is not at the ABA-safe P1.3 schema." >&2
  exit 2
fi

task_log_dir="$(
  mktemp -d "${TMPDIR:-/tmp}/shidao-homework-concurrency.XXXXXX"
)"
create_first_log="$task_log_dir/create-first.log"
create_stale_log="$task_log_dir/create-stale.log"
update_first_log="$task_log_dir/update-first.log"
update_stale_log="$task_log_dir/update-stale.log"
clear_first_log="$task_log_dir/clear-first.log"
clear_stale_log="$task_log_dir/clear-stale.log"
delete_first_log="$task_log_dir/delete-first.log"
delete_stale_log="$task_log_dir/delete-stale.log"
archive_first_log="$task_log_dir/archive-first.log"
archive_stale_log="$task_log_dir/archive-stale.log"

cleanup_fixtures() {
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 >/dev/null <<'SQL'
begin;

do $guard$
begin
  if current_database() <> 'shidao_homework_authoring_test' then
    raise exception
      'homework_concurrency_wrong_database:%',
      current_database()
      using errcode = '42501';
  end if;
end
$guard$;

set local session_replication_role = replica;

delete from public.lesson_homework_item
where lesson_homework_id in (
  select homework.id
  from public.lesson_homework as homework
  where homework.lesson_id in (
    'f4500000-0000-4000-8000-000000000001',
    'f4500000-0000-4000-8000-000000000002',
    'f4500000-0000-4000-8000-000000000003'
  )
)
  or id in (
    'f4600000-0000-4000-8000-000000000001',
    'f4600000-0000-4000-8000-000000000002',
    'f4600000-0000-4000-8000-000000000003',
    'f4600000-0000-4000-8000-000000000004',
    'f4600000-0000-4000-8000-000000000005',
    'f4600000-0000-4000-8000-000000000006',
    'f4600000-0000-4000-8000-000000000007'
  );

delete from public.lesson_homework
where lesson_id in (
  'f4500000-0000-4000-8000-000000000001',
  'f4500000-0000-4000-8000-000000000002',
  'f4500000-0000-4000-8000-000000000003'
);

delete from public.lesson
where id in (
  'f4500000-0000-4000-8000-000000000001',
  'f4500000-0000-4000-8000-000000000002',
  'f4500000-0000-4000-8000-000000000003'
);

delete from public.course
where id in (
  'f4400000-0000-4000-8000-000000000001',
  'f4400000-0000-4000-8000-000000000002',
  'f4400000-0000-4000-8000-000000000003'
);

delete from public.account_security
where account_id = 'f4200000-0000-4000-8000-000000000001';
delete from public.account
where id = 'f4200000-0000-4000-8000-000000000001';
delete from auth.sessions
where id = 'f4110000-0000-4000-8000-000000000001';
delete from auth.users
where id = 'f4100000-0000-4000-8000-000000000001';

commit;
SQL
}

cleanup_on_exit() {
  local status=$?
  trap - EXIT INT TERM
  if ! cleanup_fixtures; then
    echo "Homework concurrency fixture cleanup failed." >&2
    status=1
  fi
  if [[ $status -eq 0 ]]; then
    rm -rf -- "$task_log_dir"
  else
    echo "Homework concurrency logs retained at $task_log_dir" >&2
  fi
  exit "$status"
}
trap cleanup_on_exit EXIT INT TERM

wait_for_sleeping_session() {
  local application_name=$1
  local process_id=$2
  local sleeping
  for _attempt in {1..100}; do
    if ! kill -0 "$process_id" 2>/dev/null; then
      return 1
    fi
    sleeping="$(
      psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -Atqc \
        "select count(*) from pg_stat_activity
         where application_name = '$application_name'
           and wait_event = 'PgSleep'"
    )"
    if [[ "$sleeping" == "1" ]]; then
      return 0
    fi
    sleep 0.05
  done
  return 1
}

assert_expected_failure() {
  local log_path=$1
  local token=$2
  if ! grep -q "$token" "$log_path"; then
    echo "Expected database error '$token' was not observed." >&2
    sed -n '1,160p' "$log_path" >&2
    exit 1
  fi
}

learner_state_counts() {
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -Atqc \
    "select concat_ws(':',
       (select count(*) from public.lesson_run),
       (select count(*) from public.learning_record),
       (select count(*) from public.lesson_component_observation),
       (select count(*) from public.learning_evidence),
       (select count(*) from public.learner_objective_state),
       (select count(*) from public.learner_objective_state_evidence),
       (select count(*) from public.learner_recommendation_override),
       (select count(*) from public.course_learner_enrollment),
       (select count(*) from public.lesson_run_execution_capability),
       (select count(*) from public.lesson_run_presentation_state),
       (select count(*) from public.choice_quiz_issue),
       (select count(*) from public.choice_quiz_attempt),
       (select count(*) from public.choice_quiz_response),
       (select count(*) from public.choice_quiz_evaluation),
       (select count(*) from public.choice_quiz_feedback_delivery)
     )"
}

# Remove residue from an untrappable prior SIGKILL, then commit only the
# minimal isolated authority and three Lesson lifecycle fixtures.
cleanup_fixtures

psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 >/dev/null <<'SQL'
begin;

do $guard$
begin
  if current_database() <> 'shidao_homework_authoring_test' then
    raise exception
      'homework_concurrency_wrong_database:%',
      current_database()
      using errcode = '42501';
  end if;
end
$guard$;

set local session_replication_role = replica;

insert into auth.users (
  id,
  email,
  email_confirmed_at,
  raw_user_meta_data,
  raw_app_meta_data
)
values (
  'f4100000-0000-4000-8000-000000000001',
  'homework-concurrency@test.invalid',
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
values (
  'f4110000-0000-4000-8000-000000000001',
  'f4100000-0000-4000-8000-000000000001',
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
values (
  'f4200000-0000-4000-8000-000000000001',
  'f4100000-0000-4000-8000-000000000001',
  'Homework Concurrency Owner',
  'active'
);

insert into public.account_security (account_id, sessions_invalid_before)
values ('f4200000-0000-4000-8000-000000000001', null);

insert into public.course (
  id,
  owner_account_id,
  title,
  learning_audience
)
values
  (
    'f4400000-0000-4000-8000-000000000001',
    'f4200000-0000-4000-8000-000000000001',
    'Homework CAS races',
    'children'
  ),
  (
    'f4400000-0000-4000-8000-000000000002',
    'f4200000-0000-4000-8000-000000000001',
    'Homework delete race',
    'children'
  ),
  (
    'f4400000-0000-4000-8000-000000000003',
    'f4200000-0000-4000-8000-000000000001',
    'Homework archive race',
    'children'
  );

insert into public.lesson (id, course_id, position, title)
values
  (
    'f4500000-0000-4000-8000-000000000001',
    'f4400000-0000-4000-8000-000000000001',
    1,
    'CAS race'
  ),
  (
    'f4500000-0000-4000-8000-000000000002',
    'f4400000-0000-4000-8000-000000000002',
    1,
    'Delete race'
  ),
  (
    'f4500000-0000-4000-8000-000000000003',
    'f4400000-0000-4000-8000-000000000003',
    1,
    'Archive race'
  );

commit;
SQL

learner_state_baseline="$(learner_state_counts)"

# Prepare independent lifecycle aggregates; the CAS Lesson stays empty for the
# concurrent-create race below.
psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 >/dev/null <<'SQL'
begin;
select set_config(
  'request.jwt.claim.sub',
  'f4100000-0000-4000-8000-000000000001',
  true
);
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', 'f4100000-0000-4000-8000-000000000001',
    'session_id', 'f4110000-0000-4000-8000-000000000001',
    'role', 'authenticated'
  )::text,
  true
);
set local role authenticated;
select public.replace_my_lesson_homework(
  'f4500000-0000-4000-8000-000000000002',
  null,
  '[{
    "id":"f4600000-0000-4000-8000-000000000006",
    "typeKey":"rich_text",
    "schemaVersion":1,
    "payload":{"content":"Удаление","format":"markdown"},
    "placement":{"width":"content","textAlign":"start"}
  }]'::jsonb
);
select public.replace_my_lesson_homework(
  'f4500000-0000-4000-8000-000000000003',
  null,
  '[{
    "id":"f4600000-0000-4000-8000-000000000007",
    "typeKey":"rich_text",
    "schemaVersion":1,
    "payload":{"content":"Архив","format":"markdown"},
    "placement":{"width":"content","textAlign":"start"}
  }]'::jsonb
);
commit;
SQL

# Race 1: two expectedRevision=null creates serialize on Course -> Lesson.
create_first_app="shidao-homework-create-first"
PGAPPNAME="$create_first_app" \
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 \
  >"$create_first_log" 2>&1 <<'SQL' &
begin;
set local statement_timeout = '10s';
select set_config(
  'request.jwt.claim.sub',
  'f4100000-0000-4000-8000-000000000001',
  true
);
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', 'f4100000-0000-4000-8000-000000000001',
    'session_id', 'f4110000-0000-4000-8000-000000000001',
    'role', 'authenticated'
  )::text,
  true
);
set local role authenticated;
select public.replace_my_lesson_homework(
  'f4500000-0000-4000-8000-000000000001',
  null,
  '[{
    "id":"f4600000-0000-4000-8000-000000000001",
    "typeKey":"rich_text",
    "schemaVersion":1,
    "payload":{"content":"first create","format":"markdown"},
    "placement":{"width":"content","textAlign":"start"}
  }]'::jsonb
);
select pg_sleep(2);
commit;
SQL
create_first_pid=$!

if ! wait_for_sleeping_session "$create_first_app" "$create_first_pid"; then
  echo "Concurrent create winner did not reach its lock hold." >&2
  sed -n '1,160p' "$create_first_log" >&2
  exit 1
fi

if psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 \
  >"$create_stale_log" 2>&1 <<'SQL'
begin;
set local statement_timeout = '10s';
select set_config(
  'request.jwt.claim.sub',
  'f4100000-0000-4000-8000-000000000001',
  true
);
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', 'f4100000-0000-4000-8000-000000000001',
    'session_id', 'f4110000-0000-4000-8000-000000000001',
    'role', 'authenticated'
  )::text,
  true
);
set local role authenticated;
select public.replace_my_lesson_homework(
  'f4500000-0000-4000-8000-000000000001',
  null,
  '[{
    "id":"f4600000-0000-4000-8000-000000000002",
    "typeKey":"rich_text",
    "schemaVersion":1,
    "payload":{"content":"second create","format":"markdown"},
    "placement":{"width":"content","textAlign":"start"}
  }]'::jsonb
);
commit;
SQL
then
  echo "Both concurrent Homework creates succeeded." >&2
  exit 1
fi

wait "$create_first_pid"
assert_expected_failure "$create_stale_log" \
  "lesson_homework_revision_conflict"

create_state="$(
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -Atqc \
    "select homework.revision || ':' || count(item.id)
     from public.lesson_homework as homework
     left join public.lesson_homework_item as item
       on item.lesson_homework_id = homework.id
     where homework.lesson_id =
       'f4500000-0000-4000-8000-000000000001'
     group by homework.id"
)"
if [[ "$create_state" != "1:1" ]]; then
  echo "Concurrent create did not leave exactly one revision-1 aggregate: $create_state" >&2
  exit 1
fi

# Race 2: two writers with revision 1; exactly one advances to revision 2.
update_first_app="shidao-homework-update-first"
PGAPPNAME="$update_first_app" \
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 \
  >"$update_first_log" 2>&1 <<'SQL' &
begin;
set local statement_timeout = '10s';
select set_config(
  'request.jwt.claim.sub',
  'f4100000-0000-4000-8000-000000000001',
  true
);
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', 'f4100000-0000-4000-8000-000000000001',
    'session_id', 'f4110000-0000-4000-8000-000000000001',
    'role', 'authenticated'
  )::text,
  true
);
set local role authenticated;
select public.replace_my_lesson_homework(
  'f4500000-0000-4000-8000-000000000001',
  1,
  '[{
    "id":"f4600000-0000-4000-8000-000000000003",
    "typeKey":"external_link",
    "schemaVersion":1,
    "payload":{"url":"https://example.test/a","label":"A","openInNewTab":true},
    "placement":{"width":"content","align":"start","style":"card"}
  },{
    "id":"f4600000-0000-4000-8000-000000000001",
    "typeKey":"rich_text",
    "schemaVersion":1,
    "payload":{"content":"winner","format":"markdown"},
    "placement":{"width":"content","textAlign":"start"}
  }]'::jsonb
);
select pg_sleep(2);
commit;
SQL
update_first_pid=$!

if ! wait_for_sleeping_session "$update_first_app" "$update_first_pid"; then
  echo "Concurrent update winner did not reach its lock hold." >&2
  sed -n '1,160p' "$update_first_log" >&2
  exit 1
fi

if psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 \
  >"$update_stale_log" 2>&1 <<'SQL'
begin;
set local statement_timeout = '10s';
select set_config(
  'request.jwt.claim.sub',
  'f4100000-0000-4000-8000-000000000001',
  true
);
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', 'f4100000-0000-4000-8000-000000000001',
    'session_id', 'f4110000-0000-4000-8000-000000000001',
    'role', 'authenticated'
  )::text,
  true
);
set local role authenticated;
select public.replace_my_lesson_homework(
  'f4500000-0000-4000-8000-000000000001',
  1,
  '[{
    "id":"f4600000-0000-4000-8000-000000000004",
    "typeKey":"rich_text",
    "schemaVersion":1,
    "payload":{"content":"loser","format":"markdown"},
    "placement":{"width":"content","textAlign":"start"}
  }]'::jsonb
);
commit;
SQL
then
  echo "Both same-revision Homework updates succeeded." >&2
  exit 1
fi

wait "$update_first_pid"
assert_expected_failure "$update_stale_log" \
  "lesson_homework_revision_conflict"

update_state="$(
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -Atqc \
    "select concat_ws(':',
       homework.revision,
       count(item.id),
       min(item.id::text) filter (where item.position = 1)
     )
     from public.lesson_homework as homework
     left join public.lesson_homework_item as item
       on item.lesson_homework_id = homework.id
     where homework.lesson_id =
       'f4500000-0000-4000-8000-000000000001'
     group by homework.id"
)"
if [[ "$update_state" != \
  "2:2:f4600000-0000-4000-8000-000000000003" ]]; then
  echo "Concurrent update lost CAS/order invariants: $update_state" >&2
  exit 1
fi

# Race 3: clear and replace from revision 2. Clear wins, retains the owner row,
# and no stale pre-clear revision can recreate an ABA-compatible revision.
clear_first_app="shidao-homework-clear-first"
PGAPPNAME="$clear_first_app" \
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 \
  >"$clear_first_log" 2>&1 <<'SQL' &
begin;
set local statement_timeout = '10s';
select set_config(
  'request.jwt.claim.sub',
  'f4100000-0000-4000-8000-000000000001',
  true
);
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', 'f4100000-0000-4000-8000-000000000001',
    'session_id', 'f4110000-0000-4000-8000-000000000001',
    'role', 'authenticated'
  )::text,
  true
);
set local role authenticated;
select public.replace_my_lesson_homework(
  'f4500000-0000-4000-8000-000000000001',
  2,
  '[]'::jsonb
);
select pg_sleep(2);
commit;
SQL
clear_first_pid=$!

if ! wait_for_sleeping_session "$clear_first_app" "$clear_first_pid"; then
  echo "Concurrent clear winner did not reach its lock hold." >&2
  sed -n '1,160p' "$clear_first_log" >&2
  exit 1
fi

if psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 \
  >"$clear_stale_log" 2>&1 <<'SQL'
begin;
set local statement_timeout = '10s';
select set_config(
  'request.jwt.claim.sub',
  'f4100000-0000-4000-8000-000000000001',
  true
);
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', 'f4100000-0000-4000-8000-000000000001',
    'session_id', 'f4110000-0000-4000-8000-000000000001',
    'role', 'authenticated'
  )::text,
  true
);
set local role authenticated;
select public.replace_my_lesson_homework(
  'f4500000-0000-4000-8000-000000000001',
  2,
  '[{
    "id":"f4600000-0000-4000-8000-000000000005",
    "typeKey":"rich_text",
    "schemaVersion":1,
    "payload":{"content":"stale after clear","format":"markdown"},
    "placement":{"width":"content","textAlign":"start"}
  }]'::jsonb
);
commit;
SQL
then
  echo "Clear and same-revision replace both succeeded." >&2
  exit 1
fi

wait "$clear_first_pid"
assert_expected_failure "$clear_stale_log" \
  "lesson_homework_revision_conflict"

clear_state="$(
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -Atqc \
    "select homework.revision || ':' || count(item.id)
     from public.lesson_homework as homework
     left join public.lesson_homework_item as item
       on item.lesson_homework_id = homework.id
     where homework.lesson_id =
       'f4500000-0000-4000-8000-000000000001'
     group by homework.id"
)"
if [[ "$clear_state" != "3:0" ]]; then
  echo "Clear did not retain the monotonic empty aggregate: $clear_state" >&2
  exit 1
fi

if psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 \
  >"$clear_stale_log" 2>&1 <<'SQL'
begin;
select set_config(
  'request.jwt.claim.sub',
  'f4100000-0000-4000-8000-000000000001',
  true
);
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', 'f4100000-0000-4000-8000-000000000001',
    'session_id', 'f4110000-0000-4000-8000-000000000001',
    'role', 'authenticated'
  )::text,
  true
);
set local role authenticated;
select public.replace_my_lesson_homework(
  'f4500000-0000-4000-8000-000000000001',
  1,
  '[{
    "id":"f4600000-0000-4000-8000-000000000005",
    "typeKey":"rich_text",
    "schemaVersion":1,
    "payload":{"content":"ABA","format":"markdown"},
    "placement":{"width":"content","textAlign":"start"}
  }]'::jsonb
);
commit;
SQL
then
  echo "A pre-clear revision succeeded after clear (ABA)." >&2
  exit 1
fi
assert_expected_failure "$clear_stale_log" \
  "lesson_homework_revision_conflict"

# Race 4: Lesson delete holds the full graph through commit. The waiting
# replacement observes the missing Lesson and no Homework survives the cascade.
delete_first_app="shidao-homework-delete-first"
PGAPPNAME="$delete_first_app" \
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 \
  >"$delete_first_log" 2>&1 <<'SQL' &
begin;
set local statement_timeout = '10s';
select set_config(
  'request.jwt.claim.sub',
  'f4100000-0000-4000-8000-000000000001',
  true
);
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', 'f4100000-0000-4000-8000-000000000001',
    'session_id', 'f4110000-0000-4000-8000-000000000001',
    'role', 'authenticated'
  )::text,
  true
);
set local role authenticated;
select public.delete_lesson_with_history(
  'f4500000-0000-4000-8000-000000000002'
);
select pg_sleep(2);
commit;
SQL
delete_first_pid=$!

if ! wait_for_sleeping_session "$delete_first_app" "$delete_first_pid"; then
  echo "Lesson delete did not reach its graph-lock hold." >&2
  sed -n '1,160p' "$delete_first_log" >&2
  exit 1
fi

if psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 \
  >"$delete_stale_log" 2>&1 <<'SQL'
begin;
set local statement_timeout = '10s';
select set_config(
  'request.jwt.claim.sub',
  'f4100000-0000-4000-8000-000000000001',
  true
);
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', 'f4100000-0000-4000-8000-000000000001',
    'session_id', 'f4110000-0000-4000-8000-000000000001',
    'role', 'authenticated'
  )::text,
  true
);
set local role authenticated;
select public.replace_my_lesson_homework(
  'f4500000-0000-4000-8000-000000000002',
  1,
  '[{
    "id":"f4600000-0000-4000-8000-000000000006",
    "typeKey":"rich_text",
    "schemaVersion":1,
    "payload":{"content":"after delete","format":"markdown"},
    "placement":{"width":"content","textAlign":"start"}
  }]'::jsonb
);
commit;
SQL
then
  echo "Homework replacement succeeded after concurrent Lesson delete." >&2
  exit 1
fi

wait "$delete_first_pid"
assert_expected_failure "$delete_stale_log" "lesson_homework_not_found"

delete_state="$(
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -Atqc \
    "select concat_ws(':',
       (select count(*) from public.lesson
        where id = 'f4500000-0000-4000-8000-000000000002'),
       (select count(*) from public.lesson_homework
        where lesson_id = 'f4500000-0000-4000-8000-000000000002'),
       (select count(*) from public.lesson_homework_item
        where id = 'f4600000-0000-4000-8000-000000000006')
     )"
)"
if [[ "$delete_state" != "0:0:0" ]]; then
  echo "Lesson delete race left Homework graph rows: $delete_state" >&2
  exit 1
fi

# Race 5: Course archival holds the Course row; a waiting authoring mutation
# rechecks archived_at and fails closed after the archive commits.
archive_first_app="shidao-homework-archive-first"
PGAPPNAME="$archive_first_app" \
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 \
  >"$archive_first_log" 2>&1 <<'SQL' &
begin;
set local statement_timeout = '10s';
update public.course
set archived_at = clock_timestamp()
where id = 'f4400000-0000-4000-8000-000000000003';
select pg_sleep(2);
commit;
SQL
archive_first_pid=$!

if ! wait_for_sleeping_session "$archive_first_app" "$archive_first_pid"; then
  echo "Course archive did not reach its Course-lock hold." >&2
  sed -n '1,160p' "$archive_first_log" >&2
  exit 1
fi

if psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 \
  >"$archive_stale_log" 2>&1 <<'SQL'
begin;
set local statement_timeout = '10s';
select set_config(
  'request.jwt.claim.sub',
  'f4100000-0000-4000-8000-000000000001',
  true
);
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', 'f4100000-0000-4000-8000-000000000001',
    'session_id', 'f4110000-0000-4000-8000-000000000001',
    'role', 'authenticated'
  )::text,
  true
);
set local role authenticated;
select public.replace_my_lesson_homework(
  'f4500000-0000-4000-8000-000000000003',
  1,
  '[{
    "id":"f4600000-0000-4000-8000-000000000007",
    "typeKey":"rich_text",
    "schemaVersion":1,
    "payload":{"content":"after archive","format":"markdown"},
    "placement":{"width":"content","textAlign":"start"}
  }]'::jsonb
);
commit;
SQL
then
  echo "Homework replacement succeeded after concurrent Course archive." >&2
  exit 1
fi

wait "$archive_first_pid"
assert_expected_failure "$archive_stale_log" "lesson_homework_not_found"

archive_state="$(
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -Atqc \
    "select concat_ws(':',
       (select archived_at is not null from public.course
        where id = 'f4400000-0000-4000-8000-000000000003'),
       (select revision from public.lesson_homework
        where lesson_id = 'f4500000-0000-4000-8000-000000000003')
     )"
)"
if [[ "$archive_state" != "t:1" ]]; then
  echo "Course archive race mutated Homework unexpectedly: $archive_state" >&2
  exit 1
fi

learner_state_after="$(learner_state_counts)"
if [[ "$learner_state_after" != "$learner_state_baseline" ]]; then
  echo "Homework races changed learner issuance/attempt/evidence state." >&2
  exit 1
fi

echo "Homework P1.3 concurrency suite passed; committed fixtures will now be removed."
