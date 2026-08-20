#!/usr/bin/env bash
set -euo pipefail

# Real multi-session concurrency acceptance harness for LA-M1.
#
# This suite commits deliberately disposable fixtures so that independent psql
# sessions can see them. It is guarded by the exact database name below and a
# trap removes the fixtures on success, failure, interruption, or timeout.

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is required for the isolated learning-activity test database." >&2
  exit 2
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "psql is required to run the learning-activity concurrency suite." >&2
  exit 2
fi

db_name="$(
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -Atqc \
    'select current_database()'
)"
if [[ "$db_name" != "shidao_learning_activity_test" ]]; then
  echo "Refusing LA-M1 concurrency fixtures for database '$db_name'; expected exactly 'shidao_learning_activity_test'." >&2
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
     then 'shidao-learning-activity-la-m1' else '' end"
)"
if [[ "$schema_marker" != "shidao-learning-activity-la-m1" ]]; then
  echo "Refusing fixtures: '$db_name' is not a fully migrated ShiDao LA-M1 test database." >&2
  exit 2
fi

task_log_dir="$(mktemp -d "${TMPDIR:-/tmp}/shidao-la-concurrency.XXXXXX")"
race_one_save_log="$task_log_dir/race-one-save.log"
race_one_completion_log="$task_log_dir/race-one-completion.log"
race_two_completion_log="$task_log_dir/race-two-completion.log"
race_two_save_log="$task_log_dir/race-two-save.log"
race_three_delete_log="$task_log_dir/race-three-delete.log"
race_three_completion_log="$task_log_dir/race-three-completion.log"
race_four_completion_log="$task_log_dir/race-four-completion.log"
race_four_delete_log="$task_log_dir/race-four-delete.log"

race_one_save_pid=""
race_one_completion_pid=""
race_two_completion_pid=""
race_two_save_pid=""
race_three_delete_pid=""
race_three_completion_pid=""
race_four_completion_pid=""
race_four_delete_pid=""

cleanup_fixtures() {
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 >/dev/null <<'SQL'
begin;

do $guard$
begin
  if current_database() <> 'shidao_learning_activity_test' then
    raise exception
      'learning_activity_concurrency_wrong_database:%',
      current_database()
      using errcode = '42501';
  end if;
end
$guard$;

set local session_replication_role = replica;

delete from public.lesson_component_observation
where learning_record_id in (
  'ca800000-0000-4000-8000-000000000001',
  'ca800000-0000-4000-8000-000000000002',
  'ca800000-0000-4000-8000-000000000003',
  'ca800000-0000-4000-8000-000000000004'
);

delete from public.learning_record
where id in (
  'ca800000-0000-4000-8000-000000000001',
  'ca800000-0000-4000-8000-000000000002',
  'ca800000-0000-4000-8000-000000000003',
  'ca800000-0000-4000-8000-000000000004'
);

delete from public.lesson_run
where id in (
  'ca700000-0000-4000-8000-000000000001',
  'ca700000-0000-4000-8000-000000000002',
  'ca700000-0000-4000-8000-000000000003',
  'ca700000-0000-4000-8000-000000000004'
);

delete from public.lesson_component
where id in (
  'ca600000-0000-4000-8000-000000000001',
  'ca600000-0000-4000-8000-000000000002',
  'ca600000-0000-4000-8000-000000000003',
  'ca600000-0000-4000-8000-000000000004'
);

delete from public.lesson
where id in (
  'ca500000-0000-4000-8000-000000000001',
  'ca500000-0000-4000-8000-000000000002',
  'ca500000-0000-4000-8000-000000000003',
  'ca500000-0000-4000-8000-000000000004'
);

delete from public.course
where id = 'ca400000-0000-4000-8000-000000000001';

delete from public.learner_profile
where id = 'ca300000-0000-4000-8000-000000000001';

delete from public.account
where id = 'ca200000-0000-4000-8000-000000000001';

delete from auth.users
where id = 'ca100000-0000-4000-8000-000000000001';

commit;
SQL
}

stop_background_session() {
  local process_id="$1"
  if [[ -n "$process_id" ]] && kill -0 "$process_id" 2>/dev/null; then
    kill "$process_id" 2>/dev/null || true
    wait "$process_id" 2>/dev/null || true
  fi
}

cleanup() {
  local exit_status=$?
  local cleanup_status=0
  trap - EXIT INT TERM

  stop_background_session "$race_one_save_pid"
  stop_background_session "$race_one_completion_pid"
  stop_background_session "$race_two_completion_pid"
  stop_background_session "$race_two_save_pid"
  stop_background_session "$race_three_delete_pid"
  stop_background_session "$race_three_completion_pid"
  stop_background_session "$race_four_completion_pid"
  stop_background_session "$race_four_delete_pid"

  if ! cleanup_fixtures; then
    echo "LA-M1 concurrency fixture cleanup failed." >&2
    cleanup_status=1
  fi

  rm -f \
    "$race_one_save_log" \
    "$race_one_completion_log" \
    "$race_two_completion_log" \
    "$race_two_save_log" \
    "$race_three_delete_log" \
    "$race_three_completion_log" \
    "$race_four_completion_log" \
    "$race_four_delete_log"
  rmdir "$task_log_dir" 2>/dev/null || true

  if [[ "$exit_status" -eq 0 && "$cleanup_status" -eq 0 ]]; then
    echo "Learning-activity concurrency suite passed; committed fixtures were removed."
  fi

  if [[ "$exit_status" -eq 0 ]]; then
    exit_status=$cleanup_status
  fi
  exit "$exit_status"
}

trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

# Remove fixture IDs left by an untrappable prior SIGKILL, then create and
# commit the two isolated Runs used by the independent sessions below.
cleanup_fixtures

psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 >/dev/null <<'SQL'
begin;

do $guard$
begin
  if current_database() <> 'shidao_learning_activity_test' then
    raise exception
      'learning_activity_concurrency_wrong_database:%',
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
  'ca100000-0000-4000-8000-000000000001',
  'la-concurrency-owner@test.invalid',
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
values (
  'ca200000-0000-4000-8000-000000000001',
  'ca100000-0000-4000-8000-000000000001',
  'LA Concurrency Owner',
  'active'
);

insert into public.learner_profile (id, display_name, account_id)
values (
  'ca300000-0000-4000-8000-000000000001',
  'LA Concurrency Learner',
  null
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
  'ca400000-0000-4000-8000-000000000001',
  'ca200000-0000-4000-8000-000000000001',
  'LA-M1 concurrency course',
  'Русский язык',
  'learner_profile',
  'children'
);

insert into public.lesson (id, course_id, position, title)
values
  (
    'ca500000-0000-4000-8000-000000000001',
    'ca400000-0000-4000-8000-000000000001',
    1,
    'Save blocks absent completion'
  ),
  (
    'ca500000-0000-4000-8000-000000000002',
    'ca400000-0000-4000-8000-000000000001',
    2,
    'Completion blocks save'
  ),
  (
    'ca500000-0000-4000-8000-000000000003',
    'ca400000-0000-4000-8000-000000000001',
    3,
    'Component deletion wins before completion'
  ),
  (
    'ca500000-0000-4000-8000-000000000004',
    'ca400000-0000-4000-8000-000000000001',
    4,
    'Completion wins before component deletion'
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
values
  (
    'ca600000-0000-4000-8000-000000000001',
    'ca500000-0000-4000-8000-000000000001',
    1,
    'discussion',
    '{}'::jsonb,
    '{}'::jsonb,
    'staff_only'
  ),
  (
    'ca600000-0000-4000-8000-000000000002',
    'ca500000-0000-4000-8000-000000000002',
    1,
    'discussion',
    '{}'::jsonb,
    '{}'::jsonb,
    'staff_only'
  ),
  (
    'ca600000-0000-4000-8000-000000000003',
    'ca500000-0000-4000-8000-000000000003',
    1,
    'discussion',
    '{}'::jsonb,
    '{}'::jsonb,
    'staff_only'
  ),
  (
    'ca600000-0000-4000-8000-000000000004',
    'ca500000-0000-4000-8000-000000000004',
    1,
    'discussion',
    '{}'::jsonb,
    '{}'::jsonb,
    'staff_only'
  );

insert into public.lesson_run (
  id,
  lesson_id,
  scheduled_at,
  planned_duration_minutes,
  started_at,
  started_at_is_actual
)
values
  (
    'ca700000-0000-4000-8000-000000000001',
    'ca500000-0000-4000-8000-000000000001',
    '2026-08-20 10:00:00+09',
    45,
    '2026-08-20 10:05:00+09',
    true
  ),
  (
    'ca700000-0000-4000-8000-000000000002',
    'ca500000-0000-4000-8000-000000000002',
    '2026-08-20 11:00:00+09',
    45,
    '2026-08-20 11:05:00+09',
    true
  ),
  (
    'ca700000-0000-4000-8000-000000000003',
    'ca500000-0000-4000-8000-000000000003',
    '2026-08-20 12:00:00+09',
    45,
    '2026-08-20 12:05:00+09',
    true
  ),
  (
    'ca700000-0000-4000-8000-000000000004',
    'ca500000-0000-4000-8000-000000000004',
    '2026-08-20 13:00:00+09',
    45,
    '2026-08-20 13:05:00+09',
    true
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
    'ca800000-0000-4000-8000-000000000001',
    'ca300000-0000-4000-8000-000000000001',
    'ca700000-0000-4000-8000-000000000001',
    'ca400000-0000-4000-8000-000000000001',
    'ca500000-0000-4000-8000-000000000001',
    'ca200000-0000-4000-8000-000000000001'
  ),
  (
    'ca800000-0000-4000-8000-000000000002',
    'ca300000-0000-4000-8000-000000000001',
    'ca700000-0000-4000-8000-000000000002',
    'ca400000-0000-4000-8000-000000000001',
    'ca500000-0000-4000-8000-000000000002',
    'ca200000-0000-4000-8000-000000000001'
  ),
  (
    'ca800000-0000-4000-8000-000000000003',
    'ca300000-0000-4000-8000-000000000001',
    'ca700000-0000-4000-8000-000000000003',
    'ca400000-0000-4000-8000-000000000001',
    'ca500000-0000-4000-8000-000000000003',
    'ca200000-0000-4000-8000-000000000001'
  ),
  (
    'ca800000-0000-4000-8000-000000000004',
    'ca300000-0000-4000-8000-000000000001',
    'ca700000-0000-4000-8000-000000000004',
    'ca400000-0000-4000-8000-000000000001',
    'ca500000-0000-4000-8000-000000000004',
    'ca200000-0000-4000-8000-000000000001'
  );

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
values
  (
    'ca900000-0000-4000-8000-000000000003',
    'ca800000-0000-4000-8000-000000000003',
    'ca600000-0000-4000-8000-000000000003',
    'ca600000-0000-4000-8000-000000000003',
    1,
    'discussion',
    'Deletion-first context',
    'Draft evidence is removed before completion',
    'independent',
    'direct',
    'Deletion-first private note',
    '2026-08-20 12:10:00+09',
    'ca200000-0000-4000-8000-000000000001'
  ),
  (
    'ca900000-0000-4000-8000-000000000004',
    'ca800000-0000-4000-8000-000000000004',
    'ca600000-0000-4000-8000-000000000004',
    'ca600000-0000-4000-8000-000000000004',
    1,
    'discussion',
    'Completion-first context',
    'Final evidence survives authored deletion',
    'with_support',
    'direct',
    'Completion-first private note',
    '2026-08-20 13:10:00+09',
    'ca200000-0000-4000-8000-000000000001'
  );

commit;
SQL

session_suffix="$$"
race_one_save_app="la_m1_${session_suffix}_save_holds_run"
race_one_completion_app="la_m1_${session_suffix}_absent_completion"
race_two_completion_app="la_m1_${session_suffix}_completion_holds_run"
race_two_save_app="la_m1_${session_suffix}_save_after_completion"
race_three_delete_app="la_m1_${session_suffix}_delete_before_completion"
race_three_completion_app="la_m1_${session_suffix}_completion_after_delete"
race_four_completion_app="la_m1_${session_suffix}_completion_before_delete"
race_four_delete_app="la_m1_${session_suffix}_delete_after_completion"

wait_for_sleeping_session() {
  local application_name="$1"
  local process_id="$2"
  local observed=""
  local attempt

  for ((attempt = 0; attempt < 100; attempt += 1)); do
    observed="$(
      psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -Atqc \
        "select exists (
           select 1
           from pg_catalog.pg_stat_activity
           where application_name = '$application_name'
             and state = 'active'
             and wait_event = 'PgSleep'
         )"
    )"
    if [[ "$observed" == "t" ]]; then
      return 0
    fi
    if ! kill -0 "$process_id" 2>/dev/null; then
      return 1
    fi
    sleep 0.05
  done
  return 1
}

wait_for_blocked_pair() {
  local waiter_application_name="$1"
  local blocker_application_name="$2"
  local waiter_process_id="$3"
  local observed=""
  local attempt

  for ((attempt = 0; attempt < 100; attempt += 1)); do
    observed="$(
      psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -Atqc \
        "select exists (
           select 1
           from pg_catalog.pg_stat_activity as waiter
           join pg_catalog.pg_stat_activity as blocker
             on blocker.pid = any(pg_catalog.pg_blocking_pids(waiter.pid))
           where waiter.application_name = '$waiter_application_name'
             and blocker.application_name = '$blocker_application_name'
             and waiter.wait_event_type = 'Lock'
         )"
    )"
    if [[ "$observed" == "t" ]]; then
      return 0
    fi
    if ! kill -0 "$waiter_process_id" 2>/dev/null; then
      return 1
    fi
    sleep 0.05
  done
  return 1
}

# Race 1: the successful save owns the Run lock until commit. An absent
# completion must visibly wait on that session and then reject the now-committed
# observation rather than finalizing an absent LearningRecord.
PGAPPNAME="$race_one_save_app" \
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 \
  >"$race_one_save_log" 2>&1 <<'SQL' &
begin;
set local statement_timeout = '15s';
do $guard$
begin
  if current_database() <> 'shidao_learning_activity_test' then
    raise exception 'learning_activity_concurrency_wrong_database'
      using errcode = '42501';
  end if;
end
$guard$;
select set_config(
  'request.jwt.claim.sub',
  'ca100000-0000-4000-8000-000000000001',
  true
);
select count(*)
from public.save_lesson_component_observations(
  'ca700000-0000-4000-8000-000000000001',
  'ca600000-0000-4000-8000-000000000001',
  'Concurrency save',
  'Observation must serialize before absence',
  'direct',
  '[{"learningRecordId":"ca800000-0000-4000-8000-000000000001","rating":"independent"}]'::jsonb
);
select pg_sleep(6);
commit;
SQL
race_one_save_pid=$!

if ! wait_for_sleeping_session "$race_one_save_app" "$race_one_save_pid"; then
  echo "Race 1 save session did not reach its post-save lock hold." >&2
  exit 1
fi

PGAPPNAME="$race_one_completion_app" \
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 \
  >"$race_one_completion_log" 2>&1 <<'SQL' &
\set VERBOSITY verbose
begin;
set local statement_timeout = '15s';
do $guard$
begin
  if current_database() <> 'shidao_learning_activity_test' then
    raise exception 'learning_activity_concurrency_wrong_database'
      using errcode = '42501';
  end if;
end
$guard$;
select set_config(
  'request.jwt.claim.sub',
  'ca100000-0000-4000-8000-000000000001',
  true
);
select public.complete_lesson_run_v2(
  'ca700000-0000-4000-8000-000000000001',
  '[{"learnerProfileId":"ca300000-0000-4000-8000-000000000001","wasPresent":false}]'::jsonb,
  null,
  '2026-08-20 10:25:00+09',
  20
);
commit;
SQL
race_one_completion_pid=$!

if ! wait_for_blocked_pair \
  "$race_one_completion_app" \
  "$race_one_save_app" \
  "$race_one_completion_pid"; then
  echo "Race 1 absent completion was not observed waiting on the save session." >&2
  exit 1
fi

set +e
wait "$race_one_save_pid"
race_one_save_status=$?
race_one_save_pid=""
wait "$race_one_completion_pid"
race_one_completion_status=$?
race_one_completion_pid=""
set -e

race_one_completion_output="$(<"$race_one_completion_log")"
if [[ "$race_one_save_status" -ne 0 ]]; then
  echo "Race 1 save transaction failed unexpectedly." >&2
  exit 1
fi
if [[ "$race_one_completion_status" -eq 0 ]] \
  || [[ "$race_one_completion_output" != *"23514: lesson_run_absent_learner_has_observation"* ]]; then
  echo "Race 1 completion did not fail with the expected absent-observation contract." >&2
  exit 1
fi

race_one_state="$(
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -Atqc \
    "select case when
       exists (
         select 1 from public.lesson_component_observation
         where learning_record_id = 'ca800000-0000-4000-8000-000000000001'
       )
       and exists (
         select 1 from public.lesson_run
         where id = 'ca700000-0000-4000-8000-000000000001'
           and ended_at is null
       )
       and exists (
         select 1 from public.learning_record
         where id = 'ca800000-0000-4000-8000-000000000001'
           and occurred_at is null
       )
     then 'serialized' else '' end"
)"
if [[ "$race_one_state" != "serialized" ]]; then
  echo "Race 1 left a partially completed Run or lost the committed observation." >&2
  exit 1
fi

# Race 2: completion owns the same Run lock until commit. A save must visibly
# wait and then fail closed after it can observe the completed Run.
PGAPPNAME="$race_two_completion_app" \
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 \
  >"$race_two_completion_log" 2>&1 <<'SQL' &
begin;
set local statement_timeout = '15s';
do $guard$
begin
  if current_database() <> 'shidao_learning_activity_test' then
    raise exception 'learning_activity_concurrency_wrong_database'
      using errcode = '42501';
  end if;
end
$guard$;
select set_config(
  'request.jwt.claim.sub',
  'ca100000-0000-4000-8000-000000000001',
  true
);
select public.complete_lesson_run_v2(
  'ca700000-0000-4000-8000-000000000002',
  '[{"learnerProfileId":"ca300000-0000-4000-8000-000000000001","wasPresent":true,"needsRepeat":false}]'::jsonb,
  'Concurrency completion',
  '2026-08-20 11:25:00+09',
  20
);
select pg_sleep(6);
commit;
SQL
race_two_completion_pid=$!

if ! wait_for_sleeping_session \
  "$race_two_completion_app" \
  "$race_two_completion_pid"; then
  echo "Race 2 completion session did not reach its post-completion lock hold." >&2
  exit 1
fi

PGAPPNAME="$race_two_save_app" \
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 \
  >"$race_two_save_log" 2>&1 <<'SQL' &
\set VERBOSITY verbose
begin;
set local statement_timeout = '15s';
do $guard$
begin
  if current_database() <> 'shidao_learning_activity_test' then
    raise exception 'learning_activity_concurrency_wrong_database'
      using errcode = '42501';
  end if;
end
$guard$;
select set_config(
  'request.jwt.claim.sub',
  'ca100000-0000-4000-8000-000000000001',
  true
);
select count(*)
from public.save_lesson_component_observations(
  'ca700000-0000-4000-8000-000000000002',
  'ca600000-0000-4000-8000-000000000002',
  'Save after completion',
  'Must not mutate finalized evidence',
  'direct',
  '[{"learningRecordId":"ca800000-0000-4000-8000-000000000002","rating":"with_support"}]'::jsonb
);
commit;
SQL
race_two_save_pid=$!

if ! wait_for_blocked_pair \
  "$race_two_save_app" \
  "$race_two_completion_app" \
  "$race_two_save_pid"; then
  echo "Race 2 save was not observed waiting on the completion session." >&2
  exit 1
fi

set +e
wait "$race_two_completion_pid"
race_two_completion_status=$?
race_two_completion_pid=""
wait "$race_two_save_pid"
race_two_save_status=$?
race_two_save_pid=""
set -e

race_two_save_output="$(<"$race_two_save_log")"
if [[ "$race_two_completion_status" -ne 0 ]]; then
  echo "Race 2 completion transaction failed unexpectedly." >&2
  exit 1
fi
if [[ "$race_two_save_status" -eq 0 ]] \
  || [[ "$race_two_save_output" != *"55000: lesson_run_not_open"* ]]; then
  echo "Race 2 save did not fail with the expected closed-Run contract." >&2
  exit 1
fi

race_two_state="$(
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -Atqc \
    "select case when
       exists (
         select 1 from public.lesson_run
         where id = 'ca700000-0000-4000-8000-000000000002'
           and ended_at = '2026-08-20 11:25:00+09'::timestamptz
       )
       and exists (
         select 1 from public.learning_record
         where id = 'ca800000-0000-4000-8000-000000000002'
           and occurred_at = '2026-08-20 11:25:00+09'::timestamptz
           and was_present
       )
       and not exists (
         select 1 from public.lesson_component_observation
         where learning_record_id = 'ca800000-0000-4000-8000-000000000002'
       )
     then 'serialized' else '' end"
)"
if [[ "$race_two_state" != "serialized" ]]; then
  echo "Race 2 lost completion state or allowed a post-completion observation." >&2
  exit 1
fi

# Race 3: supported Component deletion owns the Lesson-first lifecycle locks
# until commit. Completion must visibly wait, then finalize the still-open Run
# after the deletion has removed only its draft observation.
PGAPPNAME="$race_three_delete_app" \
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 \
  >"$race_three_delete_log" 2>&1 <<'SQL' &
begin;
set local statement_timeout = '15s';
do $guard$
begin
  if current_database() <> 'shidao_learning_activity_test' then
    raise exception 'learning_activity_concurrency_wrong_database'
      using errcode = '42501';
  end if;
end
$guard$;
select set_config(
  'request.jwt.claim.sub',
  'ca100000-0000-4000-8000-000000000001',
  true
);
select public.delete_lesson_component(
  'ca600000-0000-4000-8000-000000000003'
);
select pg_sleep(6);
commit;
SQL
race_three_delete_pid=$!

if ! wait_for_sleeping_session \
  "$race_three_delete_app" \
  "$race_three_delete_pid"; then
  echo "Race 3 Component deletion did not reach its lifecycle-lock hold." >&2
  exit 1
fi

PGAPPNAME="$race_three_completion_app" \
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 \
  >"$race_three_completion_log" 2>&1 <<'SQL' &
begin;
set local statement_timeout = '15s';
do $guard$
begin
  if current_database() <> 'shidao_learning_activity_test' then
    raise exception 'learning_activity_concurrency_wrong_database'
      using errcode = '42501';
  end if;
end
$guard$;
select set_config(
  'request.jwt.claim.sub',
  'ca100000-0000-4000-8000-000000000001',
  true
);
select public.complete_lesson_run_v2(
  'ca700000-0000-4000-8000-000000000003',
  '[{"learnerProfileId":"ca300000-0000-4000-8000-000000000001","wasPresent":true,"needsRepeat":false}]'::jsonb,
  'Deletion won before completion',
  '2026-08-20 12:25:00+09',
  20
);
commit;
SQL
race_three_completion_pid=$!

if ! wait_for_blocked_pair \
  "$race_three_completion_app" \
  "$race_three_delete_app" \
  "$race_three_completion_pid"; then
  echo "Race 3 completion was not observed waiting on Component deletion." >&2
  exit 1
fi

set +e
wait "$race_three_delete_pid"
race_three_delete_status=$?
race_three_delete_pid=""
wait "$race_three_completion_pid"
race_three_completion_status=$?
race_three_completion_pid=""
set -e

if [[ "$race_three_delete_status" -ne 0 ]]; then
  echo "Race 3 Component deletion failed unexpectedly." >&2
  exit 1
fi
if [[ "$race_three_completion_status" -ne 0 ]]; then
  echo "Race 3 completion failed after serialized Component deletion." >&2
  exit 1
fi

race_three_state="$(
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -Atqc \
    "select case when
       not exists (
         select 1 from public.lesson_component
         where id = 'ca600000-0000-4000-8000-000000000003'
       )
       and not exists (
         select 1 from public.lesson_component_observation
         where id = 'ca900000-0000-4000-8000-000000000003'
       )
       and exists (
         select 1 from public.lesson_run
         where id = 'ca700000-0000-4000-8000-000000000003'
           and ended_at = '2026-08-20 12:25:00+09'::timestamptz
       )
       and exists (
         select 1 from public.learning_record
         where id = 'ca800000-0000-4000-8000-000000000003'
           and occurred_at = '2026-08-20 12:25:00+09'::timestamptz
           and was_present
       )
     then 'serialized' else '' end"
)"
if [[ "$race_three_state" != "serialized" ]]; then
  echo "Race 3 did not remove only the draft observation before completion." >&2
  exit 1
fi

# Race 4: completion owns the same Lesson-first lifecycle locks until commit.
# Component deletion must visibly wait, then retain the now-final observation,
# nulling only its live Component FK while preserving compact at-time context.
PGAPPNAME="$race_four_completion_app" \
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 \
  >"$race_four_completion_log" 2>&1 <<'SQL' &
begin;
set local statement_timeout = '15s';
do $guard$
begin
  if current_database() <> 'shidao_learning_activity_test' then
    raise exception 'learning_activity_concurrency_wrong_database'
      using errcode = '42501';
  end if;
end
$guard$;
select set_config(
  'request.jwt.claim.sub',
  'ca100000-0000-4000-8000-000000000001',
  true
);
select public.complete_lesson_run_v2(
  'ca700000-0000-4000-8000-000000000004',
  '[{"learnerProfileId":"ca300000-0000-4000-8000-000000000001","wasPresent":true,"needsRepeat":false}]'::jsonb,
  'Completion won before deletion',
  '2026-08-20 13:25:00+09',
  20
);
select pg_sleep(6);
commit;
SQL
race_four_completion_pid=$!

if ! wait_for_sleeping_session \
  "$race_four_completion_app" \
  "$race_four_completion_pid"; then
  echo "Race 4 completion did not reach its lifecycle-lock hold." >&2
  exit 1
fi

PGAPPNAME="$race_four_delete_app" \
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 \
  >"$race_four_delete_log" 2>&1 <<'SQL' &
begin;
set local statement_timeout = '15s';
do $guard$
begin
  if current_database() <> 'shidao_learning_activity_test' then
    raise exception 'learning_activity_concurrency_wrong_database'
      using errcode = '42501';
  end if;
end
$guard$;
select set_config(
  'request.jwt.claim.sub',
  'ca100000-0000-4000-8000-000000000001',
  true
);
select public.delete_lesson_component(
  'ca600000-0000-4000-8000-000000000004'
);
commit;
SQL
race_four_delete_pid=$!

if ! wait_for_blocked_pair \
  "$race_four_delete_app" \
  "$race_four_completion_app" \
  "$race_four_delete_pid"; then
  echo "Race 4 Component deletion was not observed waiting on completion." >&2
  exit 1
fi

set +e
wait "$race_four_completion_pid"
race_four_completion_status=$?
race_four_completion_pid=""
wait "$race_four_delete_pid"
race_four_delete_status=$?
race_four_delete_pid=""
set -e

if [[ "$race_four_completion_status" -ne 0 ]]; then
  echo "Race 4 completion failed unexpectedly." >&2
  exit 1
fi
if [[ "$race_four_delete_status" -ne 0 ]]; then
  echo "Race 4 Component deletion failed after serialized completion." >&2
  exit 1
fi

race_four_state="$(
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -Atqc \
    "select case when
       not exists (
         select 1 from public.lesson_component
         where id = 'ca600000-0000-4000-8000-000000000004'
       )
       and exists (
         select 1 from public.lesson_run
         where id = 'ca700000-0000-4000-8000-000000000004'
           and ended_at = '2026-08-20 13:25:00+09'::timestamptz
       )
       and exists (
         select 1 from public.learning_record
         where id = 'ca800000-0000-4000-8000-000000000004'
           and occurred_at = '2026-08-20 13:25:00+09'::timestamptz
           and was_present
       )
       and exists (
         select 1
         from public.lesson_component_observation
         where id = 'ca900000-0000-4000-8000-000000000004'
           and learning_record_id = 'ca800000-0000-4000-8000-000000000004'
           and lesson_component_id is null
           and source_lesson_component_id_at_time =
             'ca600000-0000-4000-8000-000000000004'
           and component_position_at_time = 1
           and component_type_key_at_time = 'discussion'
           and component_label_at_time = 'Completion-first context'
           and observable_criterion_at_time =
             'Final evidence survives authored deletion'
           and rating = 'with_support'
           and private_note = 'Completion-first private note'
       )
     then 'serialized' else '' end"
)"
if [[ "$race_four_state" != "serialized" ]]; then
  echo "Race 4 did not retain finalized at-time evidence after Component deletion." >&2
  exit 1
fi
