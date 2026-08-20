#!/usr/bin/env bash
set -euo pipefail

# Real multi-session concurrency acceptance harness for LA-M2.
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
  echo "Refusing LA-M2 concurrency fixtures for database '$db_name'; expected exactly 'shidao_learning_activity_test'." >&2
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
       and exists (
         select 1
         from information_schema.columns
         where table_schema = 'public'
           and table_name = 'lesson_component'
           and column_name in (
             'primary_learning_objective_id',
             'activity_role'
           )
         group by table_schema, table_name
         having count(*) = 2
       )
       and exists (
         select 1
         from information_schema.columns
         where table_schema = 'public'
           and table_name = 'lesson_component_observation'
           and column_name in (
             'learning_objective_id',
             'source_learning_objective_id_at_time',
             'learning_objective_title_at_time'
           )
         group by table_schema, table_name
         having count(*) = 3
       )
       and to_regprocedure(
         'public.update_learning_objective(uuid,text,boolean,text,boolean)'
       ) is not null
       and to_regprocedure(
         'public.create_learning_objective(uuid,text,text)'
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
         'public.publish_course_revision_admin(uuid,uuid,uuid,uuid,text,jsonb,jsonb,boolean)'
       ) is not null
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
         'for share of objective'
         in lower(pg_get_functiondef(to_regprocedure(
           'public.publish_course_revision_admin(uuid,uuid,uuid,uuid,text,jsonb,jsonb,boolean)'
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
       and position(
         'for update of component'
         in lower(pg_get_functiondef(to_regprocedure(
           'public.update_lesson_component_v2(uuid,jsonb,boolean,jsonb,boolean,uuid,boolean,text,boolean)'
         )))
       ) > position(
         'for update of lesson'
         in lower(pg_get_functiondef(to_regprocedure(
           'public.update_lesson_component_v2(uuid,jsonb,boolean,jsonb,boolean,uuid,boolean,text,boolean)'
         )))
       )
       and position(
         'for key share of objective'
         in lower(pg_get_functiondef(to_regprocedure(
           'public.update_lesson_component_v2(uuid,jsonb,boolean,jsonb,boolean,uuid,boolean,text,boolean)'
         )))
       ) > position(
         'for update of component'
         in lower(pg_get_functiondef(to_regprocedure(
           'public.update_lesson_component_v2(uuid,jsonb,boolean,jsonb,boolean,uuid,boolean,text,boolean)'
         )))
       )
       and exists (
         select 1
         from pg_constraint as constraint_row
         where constraint_row.conrelid =
             'public.course_publication_revision'::regclass
           and constraint_row.conname =
             'course_publication_revision_snapshot_check'
           and pg_get_constraintdef(constraint_row.oid) like '%schemaVersion%2%'
       )
     then 'shidao-learning-activity-la-m2-publication-v2' else '' end"
)"
if [[ "$schema_marker" != "shidao-learning-activity-la-m2-publication-v2" ]]; then
  echo "Refusing fixtures: '$db_name' is not a fully migrated ShiDao LA-M2/publication-V2 test database." >&2
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
race_five_alignment_log="$task_log_dir/race-five-alignment.log"
race_five_save_log="$task_log_dir/race-five-save.log"
race_six_save_log="$task_log_dir/race-six-save.log"
race_six_alignment_log="$task_log_dir/race-six-alignment.log"
race_seven_publish_log="$task_log_dir/race-seven-publish.log"
race_seven_objective_log="$task_log_dir/race-seven-objective.log"
race_eight_objective_log="$task_log_dir/race-eight-objective.log"
race_eight_publish_log="$task_log_dir/race-eight-publish.log"

race_one_save_pid=""
race_one_completion_pid=""
race_two_completion_pid=""
race_two_save_pid=""
race_three_delete_pid=""
race_three_completion_pid=""
race_four_completion_pid=""
race_four_delete_pid=""
race_five_alignment_pid=""
race_five_save_pid=""
race_six_save_pid=""
race_six_alignment_pid=""
race_seven_publish_pid=""
race_seven_objective_pid=""
race_eight_objective_pid=""
race_eight_publish_pid=""

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
  'ca800000-0000-4000-8000-000000000004',
  'ca800000-0000-4000-8000-000000000005',
  'ca800000-0000-4000-8000-000000000006'
);

delete from public.learning_record
where id in (
  'ca800000-0000-4000-8000-000000000001',
  'ca800000-0000-4000-8000-000000000002',
  'ca800000-0000-4000-8000-000000000003',
  'ca800000-0000-4000-8000-000000000004',
  'ca800000-0000-4000-8000-000000000005',
  'ca800000-0000-4000-8000-000000000006'
);

delete from public.lesson_run
where id in (
  'ca700000-0000-4000-8000-000000000001',
  'ca700000-0000-4000-8000-000000000002',
  'ca700000-0000-4000-8000-000000000003',
  'ca700000-0000-4000-8000-000000000004',
  'ca700000-0000-4000-8000-000000000005',
  'ca700000-0000-4000-8000-000000000006'
);

delete from public.lesson_component
where id in (
  'ca600000-0000-4000-8000-000000000001',
  'ca600000-0000-4000-8000-000000000002',
  'ca600000-0000-4000-8000-000000000003',
  'ca600000-0000-4000-8000-000000000004',
  'ca600000-0000-4000-8000-000000000005',
  'ca600000-0000-4000-8000-000000000006'
);

delete from public.lesson
where id in (
  'ca500000-0000-4000-8000-000000000001',
  'ca500000-0000-4000-8000-000000000002',
  'ca500000-0000-4000-8000-000000000003',
  'ca500000-0000-4000-8000-000000000004',
  'ca500000-0000-4000-8000-000000000005',
  'ca500000-0000-4000-8000-000000000006',
  'cb500000-0000-4000-8000-000000000001',
  'cb500000-0000-4000-8000-000000000002'
);

delete from public.course_publication_asset
where revision_id in (
  'cbb00000-0000-4000-8000-000000000001',
  'cbb00000-0000-4000-8000-000000000002'
);

delete from public.course_publication_revision
where id in (
  'cbb00000-0000-4000-8000-000000000001',
  'cbb00000-0000-4000-8000-000000000002'
);

delete from public.course_publication
where id in (
  'cba00000-0000-4000-8000-000000000001',
  'cba00000-0000-4000-8000-000000000002'
);

delete from public.learning_objective
where id in (
  'ca410000-0000-4000-8000-000000000001',
  'ca410000-0000-4000-8000-000000000002',
  'cb410000-0000-4000-8000-000000000001',
  'cb410000-0000-4000-8000-000000000002'
);

delete from public.course
where id in (
  'ca400000-0000-4000-8000-000000000001',
  'cb400000-0000-4000-8000-000000000001',
  'cb400000-0000-4000-8000-000000000002'
);

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

print_session_log() {
  local label="$1"
  local log_file="$2"

  if [[ -s "$log_file" ]]; then
    echo "--- $label (disposable fixture session) ---" >&2
    sed -n '1,160p' "$log_file" >&2
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
  stop_background_session "$race_five_alignment_pid"
  stop_background_session "$race_five_save_pid"
  stop_background_session "$race_six_save_pid"
  stop_background_session "$race_six_alignment_pid"
  stop_background_session "$race_seven_publish_pid"
  stop_background_session "$race_seven_objective_pid"
  stop_background_session "$race_eight_objective_pid"
  stop_background_session "$race_eight_publish_pid"

  if ! cleanup_fixtures; then
    echo "LA-M2 concurrency fixture cleanup failed." >&2
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
    "$race_four_delete_log" \
    "$race_five_alignment_log" \
    "$race_five_save_log" \
    "$race_six_save_log" \
    "$race_six_alignment_log" \
    "$race_seven_publish_log" \
    "$race_seven_objective_log" \
    "$race_eight_objective_log" \
    "$race_eight_publish_log"
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
  goal,
  level,
  audience_description,
  target_lesson_count,
  audience_type,
  learning_audience
)
values
  (
    'ca400000-0000-4000-8000-000000000001',
    'ca200000-0000-4000-8000-000000000001',
    'LA-M2 concurrency course',
    'Русский язык',
    'Concurrency acceptance goal',
    'A1',
    'Disposable concurrency learners',
    6,
    'learner_profile',
    'children'
  ),
  (
    'cb400000-0000-4000-8000-000000000001',
    'ca200000-0000-4000-8000-000000000001',
    'LA-M2 publication-first course',
    'Русский язык',
    'Publication-first consistency goal',
    'A1',
    'Disposable publication learners',
    1,
    'learner_profile',
    'children'
  ),
  (
    'cb400000-0000-4000-8000-000000000002',
    'ca200000-0000-4000-8000-000000000001',
    'LA-M2 objective-first course',
    'Русский язык',
    'Objective-first consistency goal',
    'A1',
    'Disposable publication learners',
    1,
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
  ),
  (
    'ca500000-0000-4000-8000-000000000005',
    'ca400000-0000-4000-8000-000000000001',
    5,
    'Alignment wins before observation save'
  ),
  (
    'ca500000-0000-4000-8000-000000000006',
    'ca400000-0000-4000-8000-000000000001',
    6,
    'Observation save wins before alignment'
  ),
  (
    'cb500000-0000-4000-8000-000000000001',
    'cb400000-0000-4000-8000-000000000001',
    1,
    'Publication-first lesson'
  ),
  (
    'cb500000-0000-4000-8000-000000000002',
    'cb400000-0000-4000-8000-000000000002',
    1,
    'Objective-first lesson'
  );

insert into public.learning_objective (
  id,
  course_id,
  title,
  description,
  archived_at
)
values
  (
    'ca410000-0000-4000-8000-000000000001',
    'ca400000-0000-4000-8000-000000000001',
    'Concurrency objective A',
    null,
    null
  ),
  (
    'ca410000-0000-4000-8000-000000000002',
    'ca400000-0000-4000-8000-000000000001',
    'Concurrency objective B',
    null,
    null
  ),
  (
    'cb410000-0000-4000-8000-000000000001',
    'cb400000-0000-4000-8000-000000000001',
    'Publication objective before update',
    null,
    null
  ),
  (
    'cb410000-0000-4000-8000-000000000002',
    'cb400000-0000-4000-8000-000000000002',
    'Objective pending update',
    null,
    null
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
  ),
  (
    'ca600000-0000-4000-8000-000000000005',
    'ca500000-0000-4000-8000-000000000005',
    1,
    'discussion',
    '{}'::jsonb,
    '{}'::jsonb,
    'staff_only'
  ),
  (
    'ca600000-0000-4000-8000-000000000006',
    'ca500000-0000-4000-8000-000000000006',
    1,
    'discussion',
    '{}'::jsonb,
    '{}'::jsonb,
    'staff_only'
  );

update public.lesson_component
set primary_learning_objective_id =
  'ca410000-0000-4000-8000-000000000001'
where id = 'ca600000-0000-4000-8000-000000000006';

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
  ),
  (
    'ca700000-0000-4000-8000-000000000005',
    'ca500000-0000-4000-8000-000000000005',
    '2026-08-20 14:00:00+09',
    45,
    '2026-08-20 14:05:00+09',
    true
  ),
  (
    'ca700000-0000-4000-8000-000000000006',
    'ca500000-0000-4000-8000-000000000006',
    '2026-08-20 15:00:00+09',
    45,
    '2026-08-20 15:05:00+09',
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
  ),
  (
    'ca800000-0000-4000-8000-000000000005',
    'ca300000-0000-4000-8000-000000000001',
    'ca700000-0000-4000-8000-000000000005',
    'ca400000-0000-4000-8000-000000000001',
    'ca500000-0000-4000-8000-000000000005',
    'ca200000-0000-4000-8000-000000000001'
  ),
  (
    'ca800000-0000-4000-8000-000000000006',
    'ca300000-0000-4000-8000-000000000001',
    'ca700000-0000-4000-8000-000000000006',
    'ca400000-0000-4000-8000-000000000001',
    'ca500000-0000-4000-8000-000000000006',
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
race_five_alignment_app="la_m2_${session_suffix}_alignment_before_save"
race_five_save_app="la_m2_${session_suffix}_save_after_alignment"
race_six_save_app="la_m2_${session_suffix}_save_before_alignment"
race_six_alignment_app="la_m2_${session_suffix}_alignment_after_save"
race_seven_publish_app="la_m2_${session_suffix}_publish_before_objective"
race_seven_objective_app="la_m2_${session_suffix}_objective_after_publish"
race_eight_objective_app="la_m2_${session_suffix}_objective_before_publish"
race_eight_publish_app="la_m2_${session_suffix}_publish_after_objective"

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

# Race 5: canonical alignment owns Course -> Lesson -> Component until commit.
# Observation save must wait, then snapshot the committed aligned objective
# from server-owned state.
PGAPPNAME="$race_five_alignment_app" \
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 \
  >"$race_five_alignment_log" 2>&1 <<'SQL' &
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
set local role authenticated;
select count(*)
from public.update_lesson_component_v2(
  'ca600000-0000-4000-8000-000000000005',
  null,
  false,
  null,
  false,
  'ca410000-0000-4000-8000-000000000001',
  true,
  null,
  false
);
select pg_sleep(6);
commit;
SQL
race_five_alignment_pid=$!

if ! wait_for_sleeping_session \
  "$race_five_alignment_app" \
  "$race_five_alignment_pid"; then
  echo "Race 5 alignment did not reach its canonical lock hold." >&2
  exit 1
fi

PGAPPNAME="$race_five_save_app" \
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 \
  >"$race_five_save_log" 2>&1 <<'SQL' &
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
set local role authenticated;
select count(*)
from public.save_lesson_component_observations(
  'ca700000-0000-4000-8000-000000000005',
  'ca600000-0000-4000-8000-000000000005',
  'Alignment-first context',
  'Snapshots committed alignment',
  'direct',
  '[{"learningRecordId":"ca800000-0000-4000-8000-000000000005","rating":"independent"}]'::jsonb
);
commit;
SQL
race_five_save_pid=$!

if ! wait_for_blocked_pair \
  "$race_five_save_app" \
  "$race_five_alignment_app" \
  "$race_five_save_pid"; then
  echo "Race 5 observation save was not observed waiting on alignment." >&2
  exit 1
fi

set +e
wait "$race_five_alignment_pid"
race_five_alignment_status=$?
race_five_alignment_pid=""
wait "$race_five_save_pid"
race_five_save_status=$?
race_five_save_pid=""
set -e

if [[ "$race_five_alignment_status" -ne 0 ]] \
  || [[ "$race_five_save_status" -ne 0 ]]; then
  echo "Race 5 alignment/save transactions did not both succeed." >&2
  exit 1
fi

race_five_state="$(
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -Atqc \
    "select case when
       exists (
         select 1
         from public.lesson_component
         where id = 'ca600000-0000-4000-8000-000000000005'
           and primary_learning_objective_id =
             'ca410000-0000-4000-8000-000000000001'
       )
       and exists (
         select 1
         from public.lesson_component_observation
         where learning_record_id =
             'ca800000-0000-4000-8000-000000000005'
           and learning_objective_id =
             'ca410000-0000-4000-8000-000000000001'
           and source_learning_objective_id_at_time =
             'ca410000-0000-4000-8000-000000000001'
           and learning_objective_title_at_time =
             'Concurrency objective A'
           and rating = 'independent'
       )
     then 'serialized' else '' end"
)"
if [[ "$race_five_state" != "serialized" ]]; then
  echo "Race 5 did not snapshot the committed Component alignment." >&2
  exit 1
fi

# Race 6: observation save owns Lesson -> Component first and snapshots
# objective A. Canonical alignment owns Course and waits on Lesson, then moves
# only live Component state to B; persisted at-time provenance remains A.
PGAPPNAME="$race_six_save_app" \
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 \
  >"$race_six_save_log" 2>&1 <<'SQL' &
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
set local role authenticated;
select count(*)
from public.save_lesson_component_observations(
  'ca700000-0000-4000-8000-000000000006',
  'ca600000-0000-4000-8000-000000000006',
  'Save-first context',
  'Retains objective at observation time',
  'bulk_confirmed',
  '[{"learningRecordId":"ca800000-0000-4000-8000-000000000006","rating":"not_yet"}]'::jsonb
);
select pg_sleep(6);
commit;
SQL
race_six_save_pid=$!

if ! wait_for_sleeping_session \
  "$race_six_save_app" \
  "$race_six_save_pid"; then
  echo "Race 6 save did not reach its Lesson/Component lock hold." >&2
  exit 1
fi

PGAPPNAME="$race_six_alignment_app" \
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 \
  >"$race_six_alignment_log" 2>&1 <<'SQL' &
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
set local role authenticated;
select count(*)
from public.update_lesson_component_v2(
  'ca600000-0000-4000-8000-000000000006',
  null,
  false,
  null,
  false,
  'ca410000-0000-4000-8000-000000000002',
  true,
  null,
  false
);
commit;
SQL
race_six_alignment_pid=$!

if ! wait_for_blocked_pair \
  "$race_six_alignment_app" \
  "$race_six_save_app" \
  "$race_six_alignment_pid"; then
  echo "Race 6 alignment was not observed waiting on observation save." >&2
  exit 1
fi

set +e
wait "$race_six_save_pid"
race_six_save_status=$?
race_six_save_pid=""
wait "$race_six_alignment_pid"
race_six_alignment_status=$?
race_six_alignment_pid=""
set -e

if [[ "$race_six_save_status" -ne 0 ]] \
  || [[ "$race_six_alignment_status" -ne 0 ]]; then
  echo "Race 6 save/alignment transactions did not both succeed." >&2
  exit 1
fi

race_six_state="$(
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -Atqc \
    "select case when
       exists (
         select 1
         from public.lesson_component
         where id = 'ca600000-0000-4000-8000-000000000006'
           and primary_learning_objective_id =
             'ca410000-0000-4000-8000-000000000002'
       )
       and exists (
         select 1
         from public.lesson_component_observation
         where learning_record_id =
             'ca800000-0000-4000-8000-000000000006'
           and learning_objective_id =
             'ca410000-0000-4000-8000-000000000001'
           and source_learning_objective_id_at_time =
             'ca410000-0000-4000-8000-000000000001'
           and learning_objective_title_at_time =
             'Concurrency objective A'
           and rating = 'not_yet'
           and entry_method = 'bulk_confirmed'
       )
     then 'serialized' else '' end"
)"
if [[ "$race_six_state" != "serialized" ]]; then
  echo "Race 6 rewrote objective-at-time provenance after alignment changed." >&2
  exit 1
fi

# Race 7: publication V2 locks Course and the exact objective graph first. The
# subsequent objective update must wait; after both commit the immutable
# revision keeps the old title and the live Course is explicitly dirty.
PGAPPNAME="$race_seven_publish_app" \
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 \
  >"$race_seven_publish_log" 2>&1 <<'SQL' &
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
select public.publish_course_revision_admin(
  'ca200000-0000-4000-8000-000000000001',
  'cb400000-0000-4000-8000-000000000001',
  'cba00000-0000-4000-8000-000000000001',
  'cbb00000-0000-4000-8000-000000000001',
  '1111111111111111111111111111111111111111111111111111111111111111',
  $snapshot$
  {
    "schemaVersion": 2,
    "course": {
      "title": "LA-M2 publication-first course",
      "subject": "Русский язык",
      "goal": "Publication-first consistency goal",
      "level": "A1",
      "audienceDescription": "Disposable publication learners",
      "targetLessonCount": 1
    },
    "objectives": [
      {
        "ref": "cb410000-0000-4000-8000-000000000001",
        "position": 1,
        "title": "Publication objective before update",
        "description": null,
        "archivedAt": null
      }
    ],
    "lessons": [
      {
        "ref": "cb500000-0000-4000-8000-000000000001",
        "position": 1,
        "title": "Publication-first lesson",
        "summary": null,
        "estimatedDurationMinutes": null,
        "components": [],
        "slides": []
      }
    ],
    "materials": []
  }
  $snapshot$::jsonb,
  '[]'::jsonb,
  true
);
select pg_sleep(6);
commit;
SQL
race_seven_publish_pid=$!

if ! wait_for_sleeping_session \
  "$race_seven_publish_app" \
  "$race_seven_publish_pid"; then
  echo "Race 7 publication did not reach its Course/objective lock hold." >&2
  print_session_log "Race 7 publication log" "$race_seven_publish_log"
  exit 1
fi

PGAPPNAME="$race_seven_objective_app" \
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 \
  >"$race_seven_objective_log" 2>&1 <<'SQL' &
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
set local role authenticated;
select count(*)
from public.update_learning_objective(
  'cb410000-0000-4000-8000-000000000001',
  'Publication objective updated after publish',
  true,
  null,
  false
);
commit;
SQL
race_seven_objective_pid=$!

if ! wait_for_blocked_pair \
  "$race_seven_objective_app" \
  "$race_seven_publish_app" \
  "$race_seven_objective_pid"; then
  echo "Race 7 objective update was not observed waiting on publication." >&2
  exit 1
fi

set +e
wait "$race_seven_publish_pid"
race_seven_publish_status=$?
race_seven_publish_pid=""
wait "$race_seven_objective_pid"
race_seven_objective_status=$?
race_seven_objective_pid=""
set -e

if [[ "$race_seven_publish_status" -ne 0 ]] \
  || [[ "$race_seven_objective_status" -ne 0 ]]; then
  echo "Race 7 publication/objective transactions did not both succeed." >&2
  print_session_log "Race 7 publication log" "$race_seven_publish_log"
  print_session_log "Race 7 objective log" "$race_seven_objective_log"
  exit 1
fi

race_seven_state="$(
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -Atqc \
    "select case when
       objective.title = 'Publication objective updated after publish'
       and revision.snapshot ->> 'schemaVersion' = '2'
       and revision.snapshot #>> '{objectives,0,title}' =
         'Publication objective before update'
       and publication.current_revision_id = revision.id
       and publication.source_content_updated_at =
         revision.source_course_updated_at
       and course.publication_content_updated_at >
         publication.source_content_updated_at
     then 'serialized' else '' end
     from public.course as course
     join public.learning_objective as objective
       on objective.course_id = course.id
     join public.course_publication as publication
       on publication.source_course_id = course.id
     join public.course_publication_revision as revision
       on revision.id = publication.current_revision_id
     where course.id = 'cb400000-0000-4000-8000-000000000001'
       and objective.id = 'cb410000-0000-4000-8000-000000000001'"
)"
if [[ "$race_seven_state" != "serialized" ]]; then
  echo "Race 7 did not preserve the published snapshot and mark live content dirty." >&2
  exit 1
fi

# Race 8: objective update owns Course and Objective first. Publication must
# wait, then validate the strict V2 snapshot against the newly committed title
# and capture the same publication-content clock.
PGAPPNAME="$race_eight_objective_app" \
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 \
  >"$race_eight_objective_log" 2>&1 <<'SQL' &
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
set local role authenticated;
select count(*)
from public.update_learning_objective(
  'cb410000-0000-4000-8000-000000000002',
  'Objective committed before publication',
  true,
  null,
  false
);
select pg_sleep(6);
commit;
SQL
race_eight_objective_pid=$!

if ! wait_for_sleeping_session \
  "$race_eight_objective_app" \
  "$race_eight_objective_pid"; then
  echo "Race 8 objective update did not reach its Course/objective lock hold." >&2
  print_session_log "Race 8 objective log" "$race_eight_objective_log"
  exit 1
fi

PGAPPNAME="$race_eight_publish_app" \
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 \
  >"$race_eight_publish_log" 2>&1 <<'SQL' &
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
select public.publish_course_revision_admin(
  'ca200000-0000-4000-8000-000000000001',
  'cb400000-0000-4000-8000-000000000002',
  'cba00000-0000-4000-8000-000000000002',
  'cbb00000-0000-4000-8000-000000000002',
  '2222222222222222222222222222222222222222222222222222222222222222',
  $snapshot$
  {
    "schemaVersion": 2,
    "course": {
      "title": "LA-M2 objective-first course",
      "subject": "Русский язык",
      "goal": "Objective-first consistency goal",
      "level": "A1",
      "audienceDescription": "Disposable publication learners",
      "targetLessonCount": 1
    },
    "objectives": [
      {
        "ref": "cb410000-0000-4000-8000-000000000002",
        "position": 1,
        "title": "Objective committed before publication",
        "description": null,
        "archivedAt": null
      }
    ],
    "lessons": [
      {
        "ref": "cb500000-0000-4000-8000-000000000002",
        "position": 1,
        "title": "Objective-first lesson",
        "summary": null,
        "estimatedDurationMinutes": null,
        "components": [],
        "slides": []
      }
    ],
    "materials": []
  }
  $snapshot$::jsonb,
  '[]'::jsonb,
  true
);
commit;
SQL
race_eight_publish_pid=$!

if ! wait_for_blocked_pair \
  "$race_eight_publish_app" \
  "$race_eight_objective_app" \
  "$race_eight_publish_pid"; then
  echo "Race 8 publication was not observed waiting on objective update." >&2
  exit 1
fi

set +e
wait "$race_eight_objective_pid"
race_eight_objective_status=$?
race_eight_objective_pid=""
wait "$race_eight_publish_pid"
race_eight_publish_status=$?
race_eight_publish_pid=""
set -e

if [[ "$race_eight_objective_status" -ne 0 ]] \
  || [[ "$race_eight_publish_status" -ne 0 ]]; then
  echo "Race 8 objective/publication transactions did not both succeed." >&2
  print_session_log "Race 8 objective log" "$race_eight_objective_log"
  print_session_log "Race 8 publication log" "$race_eight_publish_log"
  exit 1
fi

race_eight_state="$(
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -Atqc \
    "select case when
       objective.title = 'Objective committed before publication'
       and revision.snapshot ->> 'schemaVersion' = '2'
       and revision.snapshot #>> '{objectives,0,title}' = objective.title
       and publication.current_revision_id = revision.id
       and publication.source_content_updated_at =
         revision.source_course_updated_at
       and publication.source_content_updated_at =
         course.publication_content_updated_at
     then 'serialized' else '' end
     from public.course as course
     join public.learning_objective as objective
       on objective.course_id = course.id
     join public.course_publication as publication
       on publication.source_course_id = course.id
     join public.course_publication_revision as revision
       on revision.id = publication.current_revision_id
     where course.id = 'cb400000-0000-4000-8000-000000000002'
       and objective.id = 'cb410000-0000-4000-8000-000000000002'"
)"
if [[ "$race_eight_state" != "serialized" ]]; then
  echo "Race 8 publication did not capture the committed objective graph." >&2
  exit 1
fi
