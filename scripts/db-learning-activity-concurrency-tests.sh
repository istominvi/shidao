#!/usr/bin/env bash
set -euo pipefail

# Real multi-session concurrency acceptance harness through LA-M5.
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
  echo "Refusing LA-M5 concurrency fixtures for database '$db_name'; expected exactly 'shidao_learning_activity_test'." >&2
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
       and to_regclass('public.choice_quiz_issue') is not null
       and to_regclass('public.choice_quiz_attempt') is not null
       and to_regclass('public.choice_quiz_response') is not null
       and to_regclass('public.choice_quiz_evaluation') is not null
       and to_regclass('public.choice_quiz_feedback_delivery') is not null
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
         'public.correct_finalized_lesson_component_observation(uuid,uuid,uuid,text,text,text,uuid,timestamp with time zone)'
       ) is not null
       and to_regprocedure(
         'public.get_teacher_learner_activity_profile(uuid)'
       ) is not null
       and to_regprocedure(
         'public.build_course_learning_activity_context(uuid,uuid)'
       ) is not null
       and to_regprocedure(
         'public.build_course_learning_activity_context(uuid,uuid,uuid)'
       ) is not null
       and has_function_privilege(
         'service_role',
         'public.build_course_learning_activity_context(uuid,uuid,uuid)',
         'EXECUTE'
       )
       and position(
         'learning_activity_context_session_required'
         in lower(pg_get_functiondef(to_regprocedure(
           'public.build_course_learning_activity_context(uuid,uuid)'
         )))
       ) > 0
       and to_regprocedure(
         'public.preview_learner_profile_merge(uuid)'
       ) is not null
       and to_regprocedure(
         'public.confirm_learner_profile_merge(uuid,text)'
       ) is not null
       and to_regprocedure(
         'public.preview_my_learning_data_erasure()'
       ) is not null
       and to_regprocedure(
         'public.confirm_my_learning_data_erasure(uuid,uuid,text)'
       ) is not null
       and to_regprocedure(
         'public.current_active_session_account_id()'
       ) is not null
       and to_regprocedure(
         'public.lock_current_account_session_authority(uuid)'
       ) is not null
       and to_regprocedure(
         'public.publish_course_revision_admin(uuid,uuid,uuid,uuid,text,jsonb,jsonb,boolean)'
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
         'public.resolve_lesson_run_live_source_choice_quiz_admin(uuid,uuid,uuid)'
       ) is not null
       and has_function_privilege(
         'service_role',
         'public.resolve_lesson_run_live_source_choice_quiz_admin(uuid,uuid,uuid)',
         'EXECUTE'
       )
       and not has_function_privilege(
         'anon',
         'public.resolve_lesson_run_live_source_choice_quiz_admin(uuid,uuid,uuid)',
         'EXECUTE'
       )
       and not has_function_privilege(
         'authenticated',
         'public.resolve_lesson_run_live_source_choice_quiz_admin(uuid,uuid,uuid)',
         'EXECUTE'
       )
       and position(
         'resolve_lesson_run_live_source_choice_quiz_admin'
         in lower(pg_get_functiondef(to_regprocedure(
           'public.resolve_lesson_run_live_source_admin(uuid,uuid,uuid)'
         )))
       ) > 0
       and position(
         'component.value - array'
         in lower(pg_get_functiondef(to_regprocedure(
           'public.resolve_lesson_run_live_source_admin(uuid,uuid,uuid)'
         )))
       ) > 0
       and position(
         'for share of session'
         in lower(pg_get_functiondef(to_regprocedure(
           'public.resolve_lesson_run_live_source_admin(uuid,uuid,uuid)'
         )))
       ) = 0
       and position(
         'perform public.lock_learning_activity_learners'
         in lower(pg_get_functiondef(to_regprocedure(
           'public.resolve_lesson_run_live_source_choice_quiz_admin(uuid,uuid,uuid)'
         )))
       ) > 0
       and position(
         'for share of session'
         in lower(pg_get_functiondef(to_regprocedure(
           'public.resolve_lesson_run_live_source_choice_quiz_admin(uuid,uuid,uuid)'
         )))
       ) > position(
         'perform public.lock_learning_activity_learners'
         in lower(pg_get_functiondef(to_regprocedure(
           'public.resolve_lesson_run_live_source_choice_quiz_admin(uuid,uuid,uuid)'
         )))
       )
       and to_regprocedure(
         'public.issue_choice_quiz_definition_admin(uuid,uuid,uuid,uuid,bigint,timestamp with time zone,jsonb,jsonb)'
       ) is not null
       and to_regprocedure(
         'public.submit_choice_quiz_attempt_admin(uuid,uuid,uuid,text,bigint,uuid,uuid[])'
       ) is not null
       and to_regprocedure(
         'public.list_choice_quiz_run_history_admin(uuid,uuid,uuid)'
       ) is not null
       and (
         select procedure.provolatile = 'v'
         from pg_proc as procedure
         where procedure.oid = to_regprocedure(
           'public.list_choice_quiz_run_history_admin(uuid,uuid,uuid)'
         )
       )
       and has_function_privilege(
         'service_role',
         'public.list_choice_quiz_run_history_admin(uuid,uuid,uuid)',
         'EXECUTE'
       )
       and not has_function_privilege(
         'anon',
         'public.list_choice_quiz_run_history_admin(uuid,uuid,uuid)',
         'EXECUTE'
       )
       and not has_function_privilege(
         'authenticated',
         'public.list_choice_quiz_run_history_admin(uuid,uuid,uuid)',
         'EXECUTE'
       )
       and to_regprocedure(
         'public.correct_choice_quiz_evaluation_admin(uuid,uuid,uuid,boolean,text,uuid)'
       ) is not null
       and has_function_privilege(
         'service_role',
         'public.correct_choice_quiz_evaluation_admin(uuid,uuid,uuid,boolean,text,uuid)',
         'EXECUTE'
       )
       and not has_function_privilege(
         'anon',
         'public.correct_choice_quiz_evaluation_admin(uuid,uuid,uuid,boolean,text,uuid)',
         'EXECUTE'
       )
       and not has_function_privilege(
         'authenticated',
         'public.correct_choice_quiz_evaluation_admin(uuid,uuid,uuid,boolean,text,uuid)',
         'EXECUTE'
       )
       and to_regprocedure(
         'public.get_teacher_learner_activity_profile_v2(uuid)'
       ) is not null
       and has_function_privilege(
         'authenticated',
         'public.get_teacher_learner_activity_profile_v2(uuid)',
         'EXECUTE'
       )
       and not has_function_privilege(
         'anon',
         'public.get_teacher_learner_activity_profile_v2(uuid)',
         'EXECUTE'
       )
       and not has_function_privilege(
         'service_role',
         'public.get_teacher_learner_activity_profile_v2(uuid)',
         'EXECUTE'
       )
       and exists (
         select 1
         from information_schema.columns
         where table_schema = 'public'
           and table_name = 'learning_evidence'
           and column_name = 'source_choice_quiz_evaluation_id'
           and data_type = 'uuid'
       )
       and to_regprocedure(
         'public.revoke_live_access_after_account_deactivation()'
       ) is not null
       and position(
         'for share of account'
         in lower(pg_get_functiondef(to_regprocedure(
           'public.set_lesson_run_live_access(uuid,uuid,boolean,boolean)'
         )))
       ) > 0
       and position(
         'lesson_run_live_learner_not_eligible'
         in lower(pg_get_functiondef(to_regprocedure(
           'public.set_lesson_run_live_access(uuid,uuid,boolean,boolean)'
         )))
       ) > position(
         'perform record.id'
         in lower(pg_get_functiondef(to_regprocedure(
           'public.set_lesson_run_live_access(uuid,uuid,boolean,boolean)'
         )))
       )
       and position(
         'for share of account'
         in lower(pg_get_functiondef(to_regprocedure(
           'public.start_lesson_run(uuid,timestamptz)'
         )))
       ) > 0
       and position(
         'v_learner_account_ids'
         in lower(pg_get_functiondef(to_regprocedure(
           'public.start_lesson_run(uuid,timestamptz)'
         )))
       ) > 0
       and position(
         'for share of account'
         in lower(pg_get_functiondef(to_regprocedure(
           'public.set_lesson_run_presentation_cursor(uuid,uuid,bigint)'
         )))
       ) > 0
       and position(
         'for update of slide'
         in lower(pg_get_functiondef(to_regprocedure(
           'public.set_lesson_run_presentation_cursor(uuid,uuid,bigint)'
         )))
       ) < position(
         'for update of state'
         in lower(pg_get_functiondef(to_regprocedure(
           'public.set_lesson_run_presentation_cursor(uuid,uuid,bigint)'
         )))
       )
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
         'pg_advisory_xact_lock'
         in lower(pg_get_functiondef(to_regprocedure(
           'public.submit_choice_quiz_attempt_admin(uuid,uuid,uuid,text,bigint,uuid,uuid[])'
         )))
       ) > 0
       and position(
         'for update of issue'
         in lower(pg_get_functiondef(to_regprocedure(
           'public.submit_choice_quiz_attempt_admin(uuid,uuid,uuid,text,bigint,uuid,uuid[])'
         )))
       ) > 0
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
     then 'shidao-learning-activity-la-m5-choice-quiz' else '' end"
)"
if [[ "$schema_marker" != "shidao-learning-activity-la-m5-choice-quiz" ]]; then
  echo "Refusing fixtures: '$db_name' is not a fully migrated ShiDao LA-M5 Choice Quiz test database." >&2
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
race_nine_refresh_log="$task_log_dir/race-nine-refresh.log"
race_nine_correction_log="$task_log_dir/race-nine-correction.log"
race_ten_refresh_log="$task_log_dir/race-ten-refresh.log"
race_ten_merge_log="$task_log_dir/race-ten-merge.log"
race_ten_live_read_log="$task_log_dir/race-ten-live-read.log"
race_eleven_refresh_log="$task_log_dir/race-eleven-refresh.log"
race_eleven_erasure_log="$task_log_dir/race-eleven-erasure.log"
race_eleven_live_read_log="$task_log_dir/race-eleven-live-read.log"
race_twelve_cursor_first_log="$task_log_dir/race-twelve-cursor-first.log"
race_twelve_cursor_stale_log="$task_log_dir/race-twelve-cursor-stale.log"
race_thirteen_start_log="$task_log_dir/race-thirteen-start.log"
race_thirteen_revoke_log="$task_log_dir/race-thirteen-revoke.log"
race_fourteen_grant_log="$task_log_dir/race-fourteen-grant.log"
race_fourteen_read_log="$task_log_dir/race-fourteen-read.log"
race_fifteen_revoke_log="$task_log_dir/race-fifteen-revoke.log"
race_fifteen_read_log="$task_log_dir/race-fifteen-read.log"
race_fifteen_grant_status_log="$task_log_dir/race-fifteen-grant-status.log"
race_fifteen_status_after_grant_log="$task_log_dir/race-fifteen-status-after-grant.log"
race_sixteen_cursor_log="$task_log_dir/race-sixteen-cursor.log"
race_sixteen_completion_log="$task_log_dir/race-sixteen-completion.log"
race_seventeen_cancel_log="$task_log_dir/race-seventeen-cancel.log"
race_seventeen_cursor_log="$task_log_dir/race-seventeen-cursor.log"
race_seventeen_read_log="$task_log_dir/race-seventeen-read.log"
race_seventeen_access_cancel_log="$task_log_dir/race-seventeen-access-cancel.log"
race_seventeen_access_log="$task_log_dir/race-seventeen-access.log"
race_seventeen_start_cancel_log="$task_log_dir/race-seventeen-start-cancel.log"
race_seventeen_start_log="$task_log_dir/race-seventeen-start.log"
race_eighteen_cursor_log="$task_log_dir/race-eighteen-cursor.log"
race_eighteen_reorder_log="$task_log_dir/race-eighteen-reorder.log"
race_nineteen_cursor_log="$task_log_dir/race-nineteen-cursor.log"
race_nineteen_delete_log="$task_log_dir/race-nineteen-delete.log"
race_twenty_status_log="$task_log_dir/race-twenty-status.log"
race_twenty_read_log="$task_log_dir/race-twenty-read.log"
race_twenty_b_session_log="$task_log_dir/race-twenty-b-session.log"
race_twenty_b_read_log="$task_log_dir/race-twenty-b-read.log"
race_twenty_one_cutoff_log="$task_log_dir/race-twenty-one-cutoff.log"
race_twenty_one_read_log="$task_log_dir/race-twenty-one-read.log"
race_twenty_two_owner_status_log="$task_log_dir/race-twenty-two-owner-status.log"
race_twenty_two_cursor_log="$task_log_dir/race-twenty-two-cursor.log"
race_twenty_three_archive_log="$task_log_dir/race-twenty-three-archive.log"
race_twenty_three_cursor_log="$task_log_dir/race-twenty-three-cursor.log"
race_twenty_four_first_log="$task_log_dir/race-twenty-four-first.log"
race_twenty_four_dedupe_log="$task_log_dir/race-twenty-four-dedupe.log"
race_twenty_five_replay_log="$task_log_dir/race-twenty-five-replay.log"
race_twenty_five_conflict_log="$task_log_dir/race-twenty-five-conflict.log"
race_twenty_six_first_log="$task_log_dir/race-twenty-six-first.log"
race_twenty_six_retry_log="$task_log_dir/race-twenty-six-retry.log"
race_twenty_seven_submit_log="$task_log_dir/race-twenty-seven-submit.log"
race_twenty_seven_cursor_log="$task_log_dir/race-twenty-seven-cursor.log"
race_twenty_eight_submit_log="$task_log_dir/race-twenty-eight-submit.log"
race_twenty_eight_edit_log="$task_log_dir/race-twenty-eight-edit.log"
race_twenty_eight_b_submit_log="$task_log_dir/race-twenty-eight-b-submit.log"
race_twenty_eight_b_completion_log="$task_log_dir/race-twenty-eight-b-completion.log"
race_twenty_eight_c_submit_log="$task_log_dir/race-twenty-eight-c-submit.log"
race_twenty_eight_c_cancel_log="$task_log_dir/race-twenty-eight-c-cancel.log"
race_twenty_eight_d_cancel_log="$task_log_dir/race-twenty-eight-d-cancel.log"
race_twenty_eight_d_submit_log="$task_log_dir/race-twenty-eight-d-submit.log"
race_twenty_eight_e_completion_log="$task_log_dir/race-twenty-eight-e-completion.log"
race_twenty_eight_e_submit_log="$task_log_dir/race-twenty-eight-e-submit.log"
race_twenty_eight_f_edit_log="$task_log_dir/race-twenty-eight-f-edit.log"
race_twenty_eight_f_submit_log="$task_log_dir/race-twenty-eight-f-submit.log"
race_twenty_eight_g_delete_log="$task_log_dir/race-twenty-eight-g-delete.log"
race_twenty_eight_g_submit_log="$task_log_dir/race-twenty-eight-g-submit.log"
race_twenty_nine_submit_log="$task_log_dir/race-twenty-nine-submit.log"
race_twenty_nine_revoke_log="$task_log_dir/race-twenty-nine-revoke.log"
race_thirty_correction_log="$task_log_dir/race-thirty-correction.log"
race_thirty_cutoff_log="$task_log_dir/race-thirty-cutoff.log"
race_thirty_one_correction_log="$task_log_dir/race-thirty-one-correction.log"
race_thirty_one_deactivate_log="$task_log_dir/race-thirty-one-deactivate.log"
race_thirty_two_history_log="$task_log_dir/race-thirty-two-history.log"
race_thirty_two_cutoff_log="$task_log_dir/race-thirty-two-cutoff.log"
race_thirty_three_history_log="$task_log_dir/race-thirty-three-history.log"
race_thirty_three_deactivate_log="$task_log_dir/race-thirty-three-deactivate.log"
race_thirty_three_b_history_log="$task_log_dir/race-thirty-three-b-history.log"
race_thirty_three_b_issue_log="$task_log_dir/race-thirty-three-b-issue.log"
race_thirty_three_c_correction_log="$task_log_dir/race-thirty-three-c-correction.log"
race_thirty_three_c_transfer_log="$task_log_dir/race-thirty-three-c-transfer.log"
race_thirty_four_history_log="$task_log_dir/race-thirty-four-history.log"
race_thirty_four_erasure_log="$task_log_dir/race-thirty-four-erasure.log"
race_thirty_five_erasure_log="$task_log_dir/race-thirty-five-erasure.log"
race_thirty_five_history_log="$task_log_dir/race-thirty-five-history.log"

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
race_nine_refresh_pid=""
race_nine_correction_pid=""
race_ten_refresh_pid=""
race_ten_merge_pid=""
race_ten_live_read_pid=""
race_eleven_refresh_pid=""
race_eleven_erasure_pid=""
race_eleven_live_read_pid=""
race_twelve_cursor_first_pid=""
race_twelve_cursor_stale_pid=""
race_thirteen_start_pid=""
race_thirteen_revoke_pid=""
race_fourteen_grant_pid=""
race_fourteen_read_pid=""
race_fifteen_revoke_pid=""
race_fifteen_read_pid=""
race_fifteen_grant_status_pid=""
race_fifteen_status_after_grant_pid=""
race_sixteen_cursor_pid=""
race_sixteen_completion_pid=""
race_seventeen_cancel_pid=""
race_seventeen_cursor_pid=""
race_seventeen_read_pid=""
race_seventeen_access_cancel_pid=""
race_seventeen_access_pid=""
race_seventeen_start_cancel_pid=""
race_seventeen_start_pid=""
race_eighteen_cursor_pid=""
race_eighteen_reorder_pid=""
race_nineteen_cursor_pid=""
race_nineteen_delete_pid=""
race_twenty_status_pid=""
race_twenty_read_pid=""
race_twenty_b_session_pid=""
race_twenty_b_read_pid=""
race_twenty_one_cutoff_pid=""
race_twenty_one_read_pid=""
race_twenty_two_owner_status_pid=""
race_twenty_two_cursor_pid=""
race_twenty_three_archive_pid=""
race_twenty_three_cursor_pid=""
race_twenty_four_first_pid=""
race_twenty_four_dedupe_pid=""
race_twenty_five_replay_pid=""
race_twenty_five_conflict_pid=""
race_twenty_six_first_pid=""
race_twenty_six_retry_pid=""
race_twenty_seven_submit_pid=""
race_twenty_seven_cursor_pid=""
race_twenty_eight_submit_pid=""
race_twenty_eight_edit_pid=""
race_twenty_eight_b_submit_pid=""
race_twenty_eight_b_completion_pid=""
race_twenty_eight_c_submit_pid=""
race_twenty_eight_c_cancel_pid=""
race_twenty_eight_d_cancel_pid=""
race_twenty_eight_d_submit_pid=""
race_twenty_eight_e_completion_pid=""
race_twenty_eight_e_submit_pid=""
race_twenty_eight_f_edit_pid=""
race_twenty_eight_f_submit_pid=""
race_twenty_eight_g_delete_pid=""
race_twenty_eight_g_submit_pid=""
race_twenty_nine_submit_pid=""
race_twenty_nine_revoke_pid=""
race_thirty_correction_pid=""
race_thirty_cutoff_pid=""
race_thirty_one_correction_pid=""
race_thirty_one_deactivate_pid=""
race_thirty_two_history_pid=""
race_thirty_two_cutoff_pid=""
race_thirty_three_history_pid=""
race_thirty_three_deactivate_pid=""
race_thirty_three_b_history_pid=""
race_thirty_three_b_issue_pid=""
race_thirty_three_c_correction_pid=""
race_thirty_three_c_transfer_pid=""
race_thirty_four_history_pid=""
race_thirty_four_erasure_pid=""
race_thirty_five_erasure_pid=""
race_thirty_five_history_pid=""

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

delete from public.lesson_run_presentation_state
where lesson_run_id in (
  'cf700000-0000-4000-8000-000000000001',
  'cf700000-0000-4000-8000-000000000002',
  'cf700000-0000-4000-8000-000000000003',
  'cf700000-0000-4000-8000-000000000004',
  'cf700000-0000-4000-8000-000000000005',
  'd5700000-0000-4000-8000-000000000001',
  'd5700000-0000-4000-8000-000000000002',
  'd5700000-0000-4000-8000-000000000003',
  'd5700000-0000-4000-8000-000000000004',
  'd5700000-0000-4000-8000-000000000005',
  'd5700000-0000-4000-8000-000000000006',
  'd5700000-0000-4000-8000-000000000007',
  'd5700000-0000-4000-8000-000000000008',
  'd5700000-0000-4000-8000-000000000009',
  'd5700000-0000-4000-8000-000000000010',
  'd5700000-0000-4000-8000-000000000011'
);

delete from public.lesson_run_execution_capability
where lesson_run_id in (
  'cf700000-0000-4000-8000-000000000001',
  'cf700000-0000-4000-8000-000000000002',
  'cf700000-0000-4000-8000-000000000003',
  'cf700000-0000-4000-8000-000000000004',
  'cf700000-0000-4000-8000-000000000005',
  'd5700000-0000-4000-8000-000000000001',
  'd5700000-0000-4000-8000-000000000002',
  'd5700000-0000-4000-8000-000000000003',
  'd5700000-0000-4000-8000-000000000004',
  'd5700000-0000-4000-8000-000000000005',
  'd5700000-0000-4000-8000-000000000006',
  'd5700000-0000-4000-8000-000000000007',
  'd5700000-0000-4000-8000-000000000008',
  'd5700000-0000-4000-8000-000000000009',
  'd5700000-0000-4000-8000-000000000010',
  'd5700000-0000-4000-8000-000000000011'
)
   or learner_profile_id =
    'cf300000-0000-4000-8000-000000000001';

delete from public.course_learner_enrollment
where course_id in (
    'cf400000-0000-4000-8000-000000000001',
    'd5400000-0000-4000-8000-000000000001'
  )
   or learner_profile_id =
    'cf300000-0000-4000-8000-000000000001';

delete from auth.sessions
where id in (
  'ca110000-0000-4000-8000-000000000001',
  'ca110000-0000-4000-8000-000000000002',
  'cf110000-0000-4000-8000-000000000001',
  'cf110000-0000-4000-8000-000000000002',
  'cd110000-0000-4000-8000-000000000001'
);

-- session_replication_role=replica disables FK cascade triggers, so remove
-- explicitly provisioned security rows instead of assuming Account cleanup
-- will cascade them.
delete from public.account_security
where account_id in (
  'ca200000-0000-4000-8000-000000000001',
  'ca200000-0000-4000-8000-000000000002',
  'cf200000-0000-4000-8000-000000000001',
  'ce200000-0000-4000-8000-000000000001',
  'cd200000-0000-4000-8000-000000000001'
);

delete from public.learner_objective_state_evidence as link
using public.learner_objective_state as state
where link.learner_objective_state_id = state.id
  and state.recorded_by_account_id =
    'ca200000-0000-4000-8000-000000000001';

delete from public.learner_recommendation_override
where recorded_by_account_id =
  'ca200000-0000-4000-8000-000000000001';

delete from public.learner_objective_state
where recorded_by_account_id =
  'ca200000-0000-4000-8000-000000000001';

delete from public.learning_evidence
where recorded_by_account_id =
  'ca200000-0000-4000-8000-000000000001';

-- LA-M5 attempts are append-only under ordinary triggers. Cleanup is already
-- guarded, disposable, and running with replication triggers disabled, so
-- remove the persisted quiz graph explicitly from leaves to roots.
delete from public.choice_quiz_feedback_delivery as feedback
using public.choice_quiz_issue as issue
where feedback.issue_id = issue.id
  and issue.source_lesson_run_id_at_time in (
    'd5700000-0000-4000-8000-000000000001',
    'd5700000-0000-4000-8000-000000000002',
    'd5700000-0000-4000-8000-000000000003',
    'd5700000-0000-4000-8000-000000000004',
    'd5700000-0000-4000-8000-000000000005',
    'd5700000-0000-4000-8000-000000000006',
    'd5700000-0000-4000-8000-000000000007',
    'd5700000-0000-4000-8000-000000000008',
    'd5700000-0000-4000-8000-000000000009',
    'd5700000-0000-4000-8000-000000000010',
    'd5700000-0000-4000-8000-000000000011'
  );

delete from public.choice_quiz_evaluation as evaluation
using public.choice_quiz_issue as issue
where evaluation.issue_id = issue.id
  and issue.source_lesson_run_id_at_time in (
    'd5700000-0000-4000-8000-000000000001',
    'd5700000-0000-4000-8000-000000000002',
    'd5700000-0000-4000-8000-000000000003',
    'd5700000-0000-4000-8000-000000000004',
    'd5700000-0000-4000-8000-000000000005',
    'd5700000-0000-4000-8000-000000000006',
    'd5700000-0000-4000-8000-000000000007',
    'd5700000-0000-4000-8000-000000000008',
    'd5700000-0000-4000-8000-000000000009',
    'd5700000-0000-4000-8000-000000000010',
    'd5700000-0000-4000-8000-000000000011'
  );

delete from public.choice_quiz_response as response
using public.choice_quiz_issue as issue
where response.issue_id = issue.id
  and issue.source_lesson_run_id_at_time in (
    'd5700000-0000-4000-8000-000000000001',
    'd5700000-0000-4000-8000-000000000002',
    'd5700000-0000-4000-8000-000000000003',
    'd5700000-0000-4000-8000-000000000004',
    'd5700000-0000-4000-8000-000000000005',
    'd5700000-0000-4000-8000-000000000006',
    'd5700000-0000-4000-8000-000000000007',
    'd5700000-0000-4000-8000-000000000008',
    'd5700000-0000-4000-8000-000000000009',
    'd5700000-0000-4000-8000-000000000010',
    'd5700000-0000-4000-8000-000000000011'
  );

delete from public.choice_quiz_attempt as attempt
using public.choice_quiz_issue as issue
where attempt.issue_id = issue.id
  and issue.source_lesson_run_id_at_time in (
    'd5700000-0000-4000-8000-000000000001',
    'd5700000-0000-4000-8000-000000000002',
    'd5700000-0000-4000-8000-000000000003',
    'd5700000-0000-4000-8000-000000000004',
    'd5700000-0000-4000-8000-000000000005',
    'd5700000-0000-4000-8000-000000000006',
    'd5700000-0000-4000-8000-000000000007',
    'd5700000-0000-4000-8000-000000000008',
    'd5700000-0000-4000-8000-000000000009',
    'd5700000-0000-4000-8000-000000000010',
    'd5700000-0000-4000-8000-000000000011'
  );

delete from public.choice_quiz_issue
where source_lesson_run_id_at_time in (
  'd5700000-0000-4000-8000-000000000001',
  'd5700000-0000-4000-8000-000000000002',
  'd5700000-0000-4000-8000-000000000003',
  'd5700000-0000-4000-8000-000000000004',
  'd5700000-0000-4000-8000-000000000005',
  'd5700000-0000-4000-8000-000000000006',
  'd5700000-0000-4000-8000-000000000007',
  'd5700000-0000-4000-8000-000000000008',
  'd5700000-0000-4000-8000-000000000009',
  'd5700000-0000-4000-8000-000000000010',
  'd5700000-0000-4000-8000-000000000011'
);

delete from public.learner_profile_merge_conflict
where merge_operation_id =
  'cac00000-0000-4000-8000-000000000001';

delete from public.learner_profile_merge_private_detail
where merge_operation_id =
  'cac00000-0000-4000-8000-000000000001';

delete from public.learner_profile_merge
where id = 'cac00000-0000-4000-8000-000000000001';

delete from public.learner_erasure_request
where account_id in (
  'ca200000-0000-4000-8000-000000000002',
  'cf200000-0000-4000-8000-000000000001'
);

delete from public.learner_profile_alias
where source_learner_profile_id in (
    'ca300000-0000-4000-8000-000000000001',
    'ca300000-0000-4000-8000-000000000002'
  )
   or target_learner_profile_id in (
    'ca300000-0000-4000-8000-000000000001',
    'ca300000-0000-4000-8000-000000000002'
  );

delete from public.learner_identity_audit_event
where actor_account_id in (
    'ca200000-0000-4000-8000-000000000001',
    'ca200000-0000-4000-8000-000000000002',
    'cf200000-0000-4000-8000-000000000001',
    'ce200000-0000-4000-8000-000000000001',
    'cd200000-0000-4000-8000-000000000001'
  )
   or subject_account_id in (
    'ca200000-0000-4000-8000-000000000001',
    'ca200000-0000-4000-8000-000000000002',
    'cf200000-0000-4000-8000-000000000001',
    'ce200000-0000-4000-8000-000000000001',
    'cd200000-0000-4000-8000-000000000001'
  );

delete from public.lesson_component_observation
where recorded_by_account_id =
  'ca200000-0000-4000-8000-000000000001';

delete from public.learning_record
where recorded_by_account_id =
  'ca200000-0000-4000-8000-000000000001';

-- Cleanup runs with replication triggers disabled so it cannot rely on FK
-- cascades after a merge/erasure rewrites or removes the original profiles.
delete from public.course_learner
where course_id in (
    'ca400000-0000-4000-8000-000000000001',
    'cb400000-0000-4000-8000-000000000001',
    'cb400000-0000-4000-8000-000000000002'
  )
   or learner_profile_id in (
    'ca300000-0000-4000-8000-000000000001',
    'ca300000-0000-4000-8000-000000000002'
  )
   or learner_profile_id in (
    select profile.id
    from public.learner_profile as profile
    where profile.account_id =
      'ca200000-0000-4000-8000-000000000002'
  );

delete from public.lesson_run
where id in (
  'ca700000-0000-4000-8000-000000000001',
  'ca700000-0000-4000-8000-000000000002',
  'ca700000-0000-4000-8000-000000000003',
  'ca700000-0000-4000-8000-000000000004',
  'ca700000-0000-4000-8000-000000000005',
  'ca700000-0000-4000-8000-000000000006',
  'cf700000-0000-4000-8000-000000000001',
  'cf700000-0000-4000-8000-000000000002',
  'cf700000-0000-4000-8000-000000000003',
  'cf700000-0000-4000-8000-000000000004',
  'cf700000-0000-4000-8000-000000000005',
  'd5700000-0000-4000-8000-000000000001',
  'd5700000-0000-4000-8000-000000000002',
  'd5700000-0000-4000-8000-000000000003',
  'd5700000-0000-4000-8000-000000000004',
  'd5700000-0000-4000-8000-000000000005',
  'd5700000-0000-4000-8000-000000000006',
  'd5700000-0000-4000-8000-000000000007',
  'd5700000-0000-4000-8000-000000000008',
  'd5700000-0000-4000-8000-000000000009',
  'd5700000-0000-4000-8000-000000000010',
  'd5700000-0000-4000-8000-000000000011'
);

delete from public.lesson_component
where id in (
  'ca600000-0000-4000-8000-000000000001',
  'ca600000-0000-4000-8000-000000000002',
  'ca600000-0000-4000-8000-000000000003',
  'ca600000-0000-4000-8000-000000000004',
  'ca600000-0000-4000-8000-000000000005',
  'ca600000-0000-4000-8000-000000000006',
  'cf600000-0000-4000-8000-000000000001',
  'cf600000-0000-4000-8000-000000000002',
  'cf600000-0000-4000-8000-000000000003',
  'cf600000-0000-4000-8000-000000000004',
  'd5600000-0000-4000-8000-000000000001',
  'd5600000-0000-4000-8000-000000000002',
  'd5600000-0000-4000-8000-000000000003',
  'd5600000-0000-4000-8000-000000000004',
  'd5600000-0000-4000-8000-000000000005',
  'd5600000-0000-4000-8000-000000000006',
  'd5600000-0000-4000-8000-000000000007',
  'd5600000-0000-4000-8000-000000000008',
  'd5600000-0000-4000-8000-000000000009',
  'd5600000-0000-4000-8000-000000000010',
  'd5600000-0000-4000-8000-000000000011',
  'd5600000-0000-4000-8000-000000000012'
);

delete from public.lesson_student_slide
where id in (
  'cf550000-0000-4000-8000-000000000001',
  'cf550000-0000-4000-8000-000000000002',
  'cf550000-0000-4000-8000-000000000003',
  'cf550000-0000-4000-8000-000000000004',
  'd5550000-0000-4000-8000-000000000001',
  'd5550000-0000-4000-8000-000000000002',
  'd5550000-0000-4000-8000-000000000003',
  'd5550000-0000-4000-8000-000000000004',
  'd5550000-0000-4000-8000-000000000005',
  'd5550000-0000-4000-8000-000000000006',
  'd5550000-0000-4000-8000-000000000007',
  'd5550000-0000-4000-8000-000000000008',
  'd5550000-0000-4000-8000-000000000009',
  'd5550000-0000-4000-8000-000000000010',
  'd5550000-0000-4000-8000-000000000011',
  'd5550000-0000-4000-8000-000000000012'
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
  'cb500000-0000-4000-8000-000000000002',
  'cf500000-0000-4000-8000-000000000001',
  'cf500000-0000-4000-8000-000000000002',
  'cf500000-0000-4000-8000-000000000003',
  'cf500000-0000-4000-8000-000000000004',
  'cf500000-0000-4000-8000-000000000005',
  'd5500000-0000-4000-8000-000000000001',
  'd5500000-0000-4000-8000-000000000002',
  'd5500000-0000-4000-8000-000000000003',
  'd5500000-0000-4000-8000-000000000004',
  'd5500000-0000-4000-8000-000000000005',
  'd5500000-0000-4000-8000-000000000006',
  'd5500000-0000-4000-8000-000000000007',
  'd5500000-0000-4000-8000-000000000008',
  'd5500000-0000-4000-8000-000000000009',
  'd5500000-0000-4000-8000-000000000010',
  'd5500000-0000-4000-8000-000000000011'
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
  'cb400000-0000-4000-8000-000000000002',
  'cf400000-0000-4000-8000-000000000001',
  'd5400000-0000-4000-8000-000000000001'
);

delete from public.teacher_learner
where (
  teacher_account_id = 'ca200000-0000-4000-8000-000000000001'
  and (
    learner_profile_id in (
      'ca300000-0000-4000-8000-000000000001',
      'ca300000-0000-4000-8000-000000000002',
      'cf300000-0000-4000-8000-000000000001',
      'ce300000-0000-4000-8000-000000000001'
    )
    or learner_profile_id in (
      select profile.id
      from public.learner_profile as profile
      where profile.account_id =
        'ca200000-0000-4000-8000-000000000002'
    )
  ))
  or teacher_account_id = 'cd200000-0000-4000-8000-000000000001'
  or learner_profile_id = 'cd300000-0000-4000-8000-000000000001';

delete from public.learner_profile
where id in (
    'ca300000-0000-4000-8000-000000000001',
    'ca300000-0000-4000-8000-000000000002',
    'ca300000-0000-4000-8000-000000000003',
    'cf300000-0000-4000-8000-000000000001',
    'ce300000-0000-4000-8000-000000000001',
    'cd300000-0000-4000-8000-000000000001'
  )
   or account_id in (
     'ca200000-0000-4000-8000-000000000002',
     'cf200000-0000-4000-8000-000000000001',
     'ce200000-0000-4000-8000-000000000001',
     'cd200000-0000-4000-8000-000000000001'
   );

delete from public.account
where id in (
  'ca200000-0000-4000-8000-000000000001',
  'ca200000-0000-4000-8000-000000000002',
  'cf200000-0000-4000-8000-000000000001',
  'ce200000-0000-4000-8000-000000000001',
  'cd200000-0000-4000-8000-000000000001'
);

delete from auth.users
where id in (
  'ca100000-0000-4000-8000-000000000001',
  'ca100000-0000-4000-8000-000000000002',
  'cf100000-0000-4000-8000-000000000001',
  'ce100000-0000-4000-8000-000000000001',
  'cd100000-0000-4000-8000-000000000001'
);

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
  stop_background_session "$race_nine_refresh_pid"
  stop_background_session "$race_nine_correction_pid"
  stop_background_session "$race_ten_refresh_pid"
  stop_background_session "$race_ten_merge_pid"
  stop_background_session "$race_ten_live_read_pid"
  stop_background_session "$race_eleven_refresh_pid"
  stop_background_session "$race_eleven_erasure_pid"
  stop_background_session "$race_eleven_live_read_pid"
  stop_background_session "$race_twelve_cursor_first_pid"
  stop_background_session "$race_twelve_cursor_stale_pid"
  stop_background_session "$race_thirteen_start_pid"
  stop_background_session "$race_thirteen_revoke_pid"
  stop_background_session "$race_fourteen_grant_pid"
  stop_background_session "$race_fourteen_read_pid"
  stop_background_session "$race_fifteen_revoke_pid"
  stop_background_session "$race_fifteen_read_pid"
  stop_background_session "$race_fifteen_grant_status_pid"
  stop_background_session "$race_fifteen_status_after_grant_pid"
  stop_background_session "$race_sixteen_cursor_pid"
  stop_background_session "$race_sixteen_completion_pid"
  stop_background_session "$race_seventeen_cancel_pid"
  stop_background_session "$race_seventeen_cursor_pid"
  stop_background_session "$race_seventeen_read_pid"
  stop_background_session "$race_seventeen_access_cancel_pid"
  stop_background_session "$race_seventeen_access_pid"
  stop_background_session "$race_seventeen_start_cancel_pid"
  stop_background_session "$race_seventeen_start_pid"
  stop_background_session "$race_eighteen_cursor_pid"
  stop_background_session "$race_eighteen_reorder_pid"
  stop_background_session "$race_nineteen_cursor_pid"
  stop_background_session "$race_nineteen_delete_pid"
  stop_background_session "$race_twenty_status_pid"
  stop_background_session "$race_twenty_read_pid"
  stop_background_session "$race_twenty_b_session_pid"
  stop_background_session "$race_twenty_b_read_pid"
  stop_background_session "$race_twenty_one_cutoff_pid"
  stop_background_session "$race_twenty_one_read_pid"
  stop_background_session "$race_twenty_two_owner_status_pid"
  stop_background_session "$race_twenty_two_cursor_pid"
  stop_background_session "$race_twenty_three_archive_pid"
  stop_background_session "$race_twenty_three_cursor_pid"
  stop_background_session "$race_twenty_four_first_pid"
  stop_background_session "$race_twenty_four_dedupe_pid"
  stop_background_session "$race_twenty_five_replay_pid"
  stop_background_session "$race_twenty_five_conflict_pid"
  stop_background_session "$race_twenty_six_first_pid"
  stop_background_session "$race_twenty_six_retry_pid"
  stop_background_session "$race_twenty_seven_submit_pid"
  stop_background_session "$race_twenty_seven_cursor_pid"
  stop_background_session "$race_twenty_eight_submit_pid"
  stop_background_session "$race_twenty_eight_edit_pid"
  stop_background_session "$race_twenty_eight_b_submit_pid"
  stop_background_session "$race_twenty_eight_b_completion_pid"
  stop_background_session "$race_twenty_eight_c_submit_pid"
  stop_background_session "$race_twenty_eight_c_cancel_pid"
  stop_background_session "$race_twenty_eight_d_cancel_pid"
  stop_background_session "$race_twenty_eight_d_submit_pid"
  stop_background_session "$race_twenty_eight_e_completion_pid"
  stop_background_session "$race_twenty_eight_e_submit_pid"
  stop_background_session "$race_twenty_eight_f_edit_pid"
  stop_background_session "$race_twenty_eight_f_submit_pid"
  stop_background_session "$race_twenty_eight_g_delete_pid"
  stop_background_session "$race_twenty_eight_g_submit_pid"
  stop_background_session "$race_twenty_nine_submit_pid"
  stop_background_session "$race_twenty_nine_revoke_pid"
  stop_background_session "$race_thirty_correction_pid"
  stop_background_session "$race_thirty_cutoff_pid"
  stop_background_session "$race_thirty_one_correction_pid"
  stop_background_session "$race_thirty_one_deactivate_pid"
  stop_background_session "$race_thirty_two_history_pid"
  stop_background_session "$race_thirty_two_cutoff_pid"
  stop_background_session "$race_thirty_three_history_pid"
  stop_background_session "$race_thirty_three_deactivate_pid"
  stop_background_session "$race_thirty_three_b_history_pid"
  stop_background_session "$race_thirty_three_b_issue_pid"
  stop_background_session "$race_thirty_three_c_correction_pid"
  stop_background_session "$race_thirty_three_c_transfer_pid"
  stop_background_session "$race_thirty_four_history_pid"
  stop_background_session "$race_thirty_four_erasure_pid"
  stop_background_session "$race_thirty_five_erasure_pid"
  stop_background_session "$race_thirty_five_history_pid"

  if ! cleanup_fixtures; then
    echo "LA-M5 concurrency fixture cleanup failed." >&2
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
    "$race_eight_publish_log" \
    "$race_nine_refresh_log" \
    "$race_nine_correction_log" \
    "$race_ten_refresh_log" \
    "$race_ten_merge_log" \
    "$race_ten_live_read_log" \
    "$race_eleven_refresh_log" \
    "$race_eleven_erasure_log" \
    "$race_eleven_live_read_log" \
    "$race_twelve_cursor_first_log" \
    "$race_twelve_cursor_stale_log" \
    "$race_thirteen_start_log" \
    "$race_thirteen_revoke_log" \
    "$race_fourteen_grant_log" \
    "$race_fourteen_read_log" \
    "$race_fifteen_revoke_log" \
    "$race_fifteen_read_log" \
    "$race_fifteen_grant_status_log" \
    "$race_fifteen_status_after_grant_log" \
    "$race_sixteen_cursor_log" \
    "$race_sixteen_completion_log" \
    "$race_seventeen_cancel_log" \
    "$race_seventeen_cursor_log" \
    "$race_seventeen_read_log" \
    "$race_seventeen_access_cancel_log" \
    "$race_seventeen_access_log" \
    "$race_seventeen_start_cancel_log" \
    "$race_seventeen_start_log" \
    "$race_eighteen_cursor_log" \
    "$race_eighteen_reorder_log" \
    "$race_nineteen_cursor_log" \
    "$race_nineteen_delete_log" \
    "$race_twenty_status_log" \
    "$race_twenty_read_log" \
    "$race_twenty_b_session_log" \
    "$race_twenty_b_read_log" \
    "$race_twenty_one_cutoff_log" \
    "$race_twenty_one_read_log" \
    "$race_twenty_two_owner_status_log" \
    "$race_twenty_two_cursor_log" \
    "$race_twenty_three_archive_log" \
    "$race_twenty_three_cursor_log" \
    "$race_twenty_four_first_log" \
    "$race_twenty_four_dedupe_log" \
    "$race_twenty_five_replay_log" \
    "$race_twenty_five_conflict_log" \
    "$race_twenty_six_first_log" \
    "$race_twenty_six_retry_log" \
    "$race_twenty_seven_submit_log" \
    "$race_twenty_seven_cursor_log" \
    "$race_twenty_eight_submit_log" \
    "$race_twenty_eight_edit_log" \
    "$race_twenty_eight_b_submit_log" \
    "$race_twenty_eight_b_completion_log" \
    "$race_twenty_eight_c_submit_log" \
    "$race_twenty_eight_c_cancel_log" \
    "$race_twenty_eight_d_cancel_log" \
    "$race_twenty_eight_d_submit_log" \
    "$race_twenty_eight_e_completion_log" \
    "$race_twenty_eight_e_submit_log" \
    "$race_twenty_eight_f_edit_log" \
    "$race_twenty_eight_f_submit_log" \
    "$race_twenty_eight_g_delete_log" \
    "$race_twenty_eight_g_submit_log" \
    "$race_twenty_nine_submit_log" \
    "$race_twenty_nine_revoke_log" \
    "$race_thirty_correction_log" \
    "$race_thirty_cutoff_log" \
    "$race_thirty_one_correction_log" \
    "$race_thirty_one_deactivate_log" \
    "$race_thirty_two_history_log" \
    "$race_thirty_two_cutoff_log" \
    "$race_thirty_three_history_log" \
    "$race_thirty_three_deactivate_log" \
    "$race_thirty_three_b_history_log" \
    "$race_thirty_three_b_issue_log" \
    "$race_thirty_three_c_correction_log" \
    "$race_thirty_three_c_transfer_log" \
    "$race_thirty_four_history_log" \
    "$race_thirty_four_erasure_log" \
    "$race_thirty_five_erasure_log" \
    "$race_thirty_five_history_log"
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
values
  (
    'ca100000-0000-4000-8000-000000000001',
    'la-concurrency-owner@test.invalid',
    clock_timestamp(),
    '{}'::jsonb,
    '{}'::jsonb
  ),
  (
    'ca100000-0000-4000-8000-000000000002',
    'la-concurrency-subject@test.invalid',
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
) values
  (
    'ca110000-0000-4000-8000-000000000001',
    'ca100000-0000-4000-8000-000000000002',
    clock_timestamp(),
    clock_timestamp(),
    null
  ),
  (
    'ca110000-0000-4000-8000-000000000002',
    'ca100000-0000-4000-8000-000000000001',
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
    'ca200000-0000-4000-8000-000000000001',
    'ca100000-0000-4000-8000-000000000001',
    'LA Concurrency Owner',
    'active'
  ),
  (
    'ca200000-0000-4000-8000-000000000002',
    'ca100000-0000-4000-8000-000000000002',
    'LA Concurrency Subject',
    'active'
  );

insert into public.account_security (
  account_id,
  sessions_invalid_before
) values
  ('ca200000-0000-4000-8000-000000000001', null),
  ('ca200000-0000-4000-8000-000000000002', null);

insert into public.learner_profile (id, display_name, account_id)
values
  (
    'ca300000-0000-4000-8000-000000000001',
    'LA Concurrency Merge Source',
    null
  ),
  (
    'ca300000-0000-4000-8000-000000000002',
    'LA Concurrency Subject',
    'ca200000-0000-4000-8000-000000000002'
  ),
  (
    'ca300000-0000-4000-8000-000000000003',
    'LA Concurrency Owner',
    'ca200000-0000-4000-8000-000000000001'
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

insert into public.teacher_learner (
  teacher_account_id,
  learner_profile_id,
  display_name
)
values
  (
    'ca200000-0000-4000-8000-000000000001',
    'ca300000-0000-4000-8000-000000000001',
    'LA Concurrency Merge Source'
  ),
  (
    'ca200000-0000-4000-8000-000000000001',
    'ca300000-0000-4000-8000-000000000002',
    'LA Concurrency Subject'
  );

insert into public.course_learner (course_id, learner_profile_id)
values
  (
    'ca400000-0000-4000-8000-000000000001',
    'ca300000-0000-4000-8000-000000000001'
  ),
  (
    'ca400000-0000-4000-8000-000000000001',
    'ca300000-0000-4000-8000-000000000002'
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
where id in (
  'ca600000-0000-4000-8000-000000000004',
  'ca600000-0000-4000-8000-000000000006'
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

update public.learning_record as record
set source_course_id_at_time = record.source_course_id,
    source_lesson_id_at_time = record.source_lesson_id,
    source_lesson_run_id_at_time = record.lesson_run_id
where record.recorded_by_account_id =
  'ca200000-0000-4000-8000-000000000001'
  and record.source_course_id =
    'ca400000-0000-4000-8000-000000000001';

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
  component_visibility_at_time,
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
    null,
    null,
    null,
    1,
    'discussion',
    'Deletion-first context',
    'staff_only',
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
    'ca410000-0000-4000-8000-000000000001',
    'ca410000-0000-4000-8000-000000000001',
    'Concurrency objective A',
    1,
    'discussion',
    'LA_M3_STAFF_ONLY_CONCURRENCY_SENTINEL',
    'staff_only',
    'Final evidence survives authored deletion',
    'with_support',
    'direct',
    'Completion-first private note',
    '2026-08-20 13:10:00+09',
    'ca200000-0000-4000-8000-000000000001'
  );

commit;
SQL

run_late_races_sixteen_and_seventeen() {
# Race 16: cursor update owns the Run/state rows before a canonical completion.
# Completion must visibly wait, then commit the ended state without losing the
# cursor CAS. The learner resolver must normalize the committed Run to ended.
PGAPPNAME="$race_sixteen_cursor_app" \
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 \
  >"$race_sixteen_cursor_log" 2>&1 <<'SQL' &
begin;
set local statement_timeout = '15s';
select set_config(
  'request.jwt.claim.sub',
  'ca100000-0000-4000-8000-000000000001',
  true
);
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', 'ca100000-0000-4000-8000-000000000001',
    'session_id', 'ca110000-0000-4000-8000-000000000002',
    'role', 'authenticated'
  )::text,
  true
);
set local role authenticated;
select public.set_lesson_run_presentation_cursor(
  'cf700000-0000-4000-8000-000000000001',
  null,
  1
);
select pg_sleep(6);
commit;
SQL
race_sixteen_cursor_pid=$!

if ! wait_for_sleeping_session \
  "$race_sixteen_cursor_app" \
  "$race_sixteen_cursor_pid"; then
  echo "Race 16 cursor did not reach its Run/state lock hold." >&2
  print_session_log "Race 16 cursor log" "$race_sixteen_cursor_log"
  exit 1
fi

PGAPPNAME="$race_sixteen_completion_app" \
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 \
  >"$race_sixteen_completion_log" 2>&1 <<'SQL' &
begin;
set local statement_timeout = '15s';
select set_config(
  'request.jwt.claim.sub',
  'ca100000-0000-4000-8000-000000000001',
  true
);
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', 'ca100000-0000-4000-8000-000000000001',
    'session_id', 'ca110000-0000-4000-8000-000000000002',
    'role', 'authenticated'
  )::text,
  true
);
set local role authenticated;
select public.complete_lesson_run_v2(
  'cf700000-0000-4000-8000-000000000001',
  '[{"learnerProfileId":"cf300000-0000-4000-8000-000000000001","wasPresent":true}]'::jsonb,
  'Race 16 completion after cursor',
  '2026-08-21 10:50:00+09',
  45
);
commit;
SQL
race_sixteen_completion_pid=$!

if ! wait_for_blocked_pair \
  "$race_sixteen_completion_app" \
  "$race_sixteen_cursor_app" \
  "$race_sixteen_completion_pid"; then
  echo "Race 16 completion was not observed waiting on cursor." >&2
  print_session_log "Race 16 cursor log" "$race_sixteen_cursor_log"
  print_session_log "Race 16 completion log" "$race_sixteen_completion_log"
  exit 1
fi

set +e
wait "$race_sixteen_cursor_pid"
race_sixteen_cursor_status=$?
race_sixteen_cursor_pid=""
wait "$race_sixteen_completion_pid"
race_sixteen_completion_status=$?
race_sixteen_completion_pid=""
set -e

if [[ "$race_sixteen_cursor_status" -ne 0 ]] \
  || [[ "$race_sixteen_completion_status" -ne 0 ]]; then
  echo "Race 16 cursor/completion transactions did not both commit." >&2
  print_session_log "Race 16 cursor log" "$race_sixteen_cursor_log"
  print_session_log "Race 16 completion log" "$race_sixteen_completion_log"
  exit 1
fi

race_sixteen_state="$(
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -Atqc \
    "select case when
       exists (
         select 1
         from public.lesson_run
         where id = 'cf700000-0000-4000-8000-000000000001'
           and ended_at = '2026-08-21 10:50:00+09'::timestamptz
           and cancelled_at is null
       )
       and exists (
         select 1
         from public.lesson_run_presentation_state
         where lesson_run_id =
             'cf700000-0000-4000-8000-000000000001'
           and student_slide_id is null
           and cursor_version = 2
       )
       and public.resolve_lesson_run_live_source_admin(
         'cf100000-0000-4000-8000-000000000001',
         'cf110000-0000-4000-8000-000000000001',
         'cf700000-0000-4000-8000-000000000001'
       ) = '{\"state\": \"ended\"}'::jsonb
     then 'serialized' else '' end"
)"
if [[ "$race_sixteen_state" != "serialized" ]]; then
  echo "Race 16 lost cursor revision or exact ended normalization." >&2
  exit 1
fi

# Race 17: cancel_lesson_run performs a non-key Run UPDATE and retains its row
# locks through commit. The cursor writer must wait and reject the closed Run;
# a concurrent resolver must also wait (FOR SHARE, not KEY SHARE), then return
# the exact ended state after draft attendance deletion.
PGAPPNAME="$race_seventeen_cancel_app" \
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 \
  >"$race_seventeen_cancel_log" 2>&1 <<'SQL' &
begin;
set local statement_timeout = '15s';
select set_config(
  'request.jwt.claim.sub',
  'ca100000-0000-4000-8000-000000000001',
  true
);
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', 'ca100000-0000-4000-8000-000000000001',
    'session_id', 'ca110000-0000-4000-8000-000000000002',
    'role', 'authenticated'
  )::text,
  true
);
set local role authenticated;
select public.cancel_lesson_run(
  'cf700000-0000-4000-8000-000000000002',
  '2026-08-21 11:30:00+09'
);
select pg_sleep(6);
commit;
SQL
race_seventeen_cancel_pid=$!

if ! wait_for_sleeping_session \
  "$race_seventeen_cancel_app" \
  "$race_seventeen_cancel_pid"; then
  echo "Race 17 cancel did not reach its Run lock hold." >&2
  print_session_log "Race 17 cancel log" "$race_seventeen_cancel_log"
  exit 1
fi

PGAPPNAME="$race_seventeen_cursor_app" \
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 \
  >"$race_seventeen_cursor_log" 2>&1 <<'SQL' &
begin;
set local statement_timeout = '15s';
select set_config(
  'request.jwt.claim.sub',
  'ca100000-0000-4000-8000-000000000001',
  true
);
set local role authenticated;
do $cursor$
begin
  begin
    perform public.set_lesson_run_presentation_cursor(
      'cf700000-0000-4000-8000-000000000002',
      'cf550000-0000-4000-8000-000000000002',
      0
    );
    raise exception 'race_17_expected_closed_run_rejection';
  exception
    when sqlstate '55000' then
      if sqlerrm <> 'lesson_run_live_not_open' then
        raise;
      end if;
  end;
end
$cursor$;
commit;
SQL
race_seventeen_cursor_pid=$!

if ! wait_for_blocked_pair \
  "$race_seventeen_cursor_app" \
  "$race_seventeen_cancel_app" \
  "$race_seventeen_cursor_pid"; then
  echo "Race 17 cursor was not observed waiting on cancel." >&2
  print_session_log "Race 17 cancel log" "$race_seventeen_cancel_log"
  print_session_log "Race 17 cursor log" "$race_seventeen_cursor_log"
  exit 1
fi

PGAPPNAME="$race_seventeen_read_app" \
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 \
  >"$race_seventeen_read_log" 2>&1 <<'SQL' &
begin;
set local statement_timeout = '15s';
set local role service_role;
do $read$
declare
  v_source jsonb;
begin
  v_source := public.resolve_lesson_run_live_source_admin(
    'cf100000-0000-4000-8000-000000000001',
    'cf110000-0000-4000-8000-000000000001',
    'cf700000-0000-4000-8000-000000000002'
  );
  if v_source <> '{"state":"ended"}'::jsonb then
    raise exception 'race_17_ended_source_mismatch:%', v_source;
  end if;
end
$read$;
commit;
SQL
race_seventeen_read_pid=$!

# The cursor's read-only Account/Course/Lesson revalidation uses FOR SHARE so
# deferred cancellation notifications can take their FK KEY SHARE locks
# without an Account<->Run deadlock. Both cursor and resolver must wait on the
# cancelling transaction's Lesson/Run locks, then observe the committed close.
if ! wait_for_blocked_pair \
  "$race_seventeen_read_app" \
  "$race_seventeen_cancel_app" \
  "$race_seventeen_read_pid"; then
  echo "Race 17 resolver was not observed waiting on cancel." >&2
  print_session_log "Race 17 cancel log" "$race_seventeen_cancel_log"
  print_session_log "Race 17 cursor log" "$race_seventeen_cursor_log"
  print_session_log "Race 17 live-read log" "$race_seventeen_read_log"
  exit 1
fi

set +e
wait "$race_seventeen_cancel_pid"
race_seventeen_cancel_status=$?
race_seventeen_cancel_pid=""
wait "$race_seventeen_cursor_pid"
race_seventeen_cursor_status=$?
race_seventeen_cursor_pid=""
wait "$race_seventeen_read_pid"
race_seventeen_read_status=$?
race_seventeen_read_pid=""
set -e

if [[ "$race_seventeen_cancel_status" -ne 0 ]] \
  || [[ "$race_seventeen_cursor_status" -ne 0 ]] \
  || [[ "$race_seventeen_read_status" -ne 0 ]]; then
  echo "Race 17 cancel/cursor/live-read transactions did not finish safely." >&2
  print_session_log "Race 17 cancel log" "$race_seventeen_cancel_log"
  print_session_log "Race 17 cursor log" "$race_seventeen_cursor_log"
  print_session_log "Race 17 live-read log" "$race_seventeen_read_log"
  exit 1
fi

race_seventeen_state="$(
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -Atqc \
    "select case when
       exists (
         select 1
         from public.lesson_run
         where id = 'cf700000-0000-4000-8000-000000000002'
           and cancelled_at = '2026-08-21 11:30:00+09'::timestamptz
           and ended_at is null
       )
       and not exists (
         select 1
         from public.learning_record
         where lesson_run_id =
           'cf700000-0000-4000-8000-000000000002'
       )
       and exists (
         select 1
         from public.lesson_run_presentation_state
         where lesson_run_id =
             'cf700000-0000-4000-8000-000000000002'
           and student_slide_id is null
           and cursor_version = 0
       )
     then 'serialized' else '' end"
)"
if [[ "$race_seventeen_state" != "serialized" ]]; then
  echo "Race 17 mutated the cursor or retained cancelled draft attendance." >&2
  exit 1
fi

# Race 17b: cancel owns Lesson/Run before its deferred notification references
# Account. setAccess locks owner+learner Accounts before Lesson/Run. Its
# read-only Account SHARE locks must be FK-compatible so cancellation commits,
# then access revalidation rejects the now-deleted canonical roster record.
PGAPPNAME="$race_seventeen_access_cancel_app" \
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 \
  >"$race_seventeen_access_cancel_log" 2>&1 <<'SQL' &
begin;
set local statement_timeout = '15s';
select set_config(
  'request.jwt.claim.sub',
  'ca100000-0000-4000-8000-000000000001',
  true
);
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', 'ca100000-0000-4000-8000-000000000001',
    'session_id', 'ca110000-0000-4000-8000-000000000002',
    'role', 'authenticated'
  )::text,
  true
);
set local role authenticated;
select public.cancel_lesson_run(
  'cf700000-0000-4000-8000-000000000004',
  '2026-08-21 13:30:00+09'
);
select pg_sleep(6);
commit;
SQL
race_seventeen_access_cancel_pid=$!

if ! wait_for_sleeping_session \
  "$race_seventeen_access_cancel_app" \
  "$race_seventeen_access_cancel_pid"; then
  echo "Race 17b cancel did not reach its Run lock hold." >&2
  print_session_log \
    "Race 17b cancel log" \
    "$race_seventeen_access_cancel_log"
  exit 1
fi

PGAPPNAME="$race_seventeen_access_app" \
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 \
  >"$race_seventeen_access_log" 2>&1 <<'SQL' &
begin;
set local statement_timeout = '15s';
select set_config(
  'request.jwt.claim.sub',
  'ca100000-0000-4000-8000-000000000001',
  true
);
set local role authenticated;
do $access$
begin
  begin
    perform public.set_lesson_run_live_access(
      'cf700000-0000-4000-8000-000000000004',
      'cf300000-0000-4000-8000-000000000001',
      true,
      false
    );
    raise exception 'race_17b_expected_cancelled_access_rejection';
  exception
    when sqlstate 'P0002' then
      if sqlerrm <> 'lesson_run_live_not_found' then
        raise;
      end if;
  end;
end
$access$;
commit;
SQL
race_seventeen_access_pid=$!

if ! wait_for_blocked_pair \
  "$race_seventeen_access_app" \
  "$race_seventeen_access_cancel_app" \
  "$race_seventeen_access_pid"; then
  echo "Race 17b access did not wait on cancel." >&2
  print_session_log \
    "Race 17b cancel log" \
    "$race_seventeen_access_cancel_log"
  print_session_log "Race 17b access log" "$race_seventeen_access_log"
  exit 1
fi

set +e
wait "$race_seventeen_access_cancel_pid"
race_seventeen_access_cancel_status=$?
race_seventeen_access_cancel_pid=""
wait "$race_seventeen_access_pid"
race_seventeen_access_status=$?
race_seventeen_access_pid=""
set -e

if [[ "$race_seventeen_access_cancel_status" -ne 0 ]] \
  || [[ "$race_seventeen_access_status" -ne 0 ]]; then
  echo "Race 17b cancel/access transactions did not finish safely." >&2
  print_session_log \
    "Race 17b cancel log" \
    "$race_seventeen_access_cancel_log"
  print_session_log "Race 17b access log" "$race_seventeen_access_log"
  exit 1
fi

race_seventeen_access_state="$(
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -Atqc \
    "select case when
       exists (
         select 1 from public.lesson_run
         where id = 'cf700000-0000-4000-8000-000000000004'
           and cancelled_at = '2026-08-21 13:30:00+09'::timestamptz
       )
       and not exists (
         select 1 from public.learning_record
         where lesson_run_id = 'cf700000-0000-4000-8000-000000000004'
       )
       and not exists (
         select 1 from public.lesson_run_execution_capability
         where lesson_run_id = 'cf700000-0000-4000-8000-000000000004'
       )
     then 'serialized' else '' end"
)"
if [[ "$race_seventeen_access_state" != "serialized" ]]; then
  echo "Race 17b left cancelled access state inconsistent." >&2
  exit 1
fi

# Race 17c: exercise the same notification edge against start_lesson_run.
# Start SHARE-locks owner+linked learner Accounts in UUID order before Profile,
# then waits on Lesson/Run and rejects the committed cancellation without a
# notification FK deadlock or partial LA-M4 materialization.
PGAPPNAME="$race_seventeen_start_cancel_app" \
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 \
  >"$race_seventeen_start_cancel_log" 2>&1 <<'SQL' &
begin;
set local statement_timeout = '15s';
select set_config(
  'request.jwt.claim.sub',
  'ca100000-0000-4000-8000-000000000001',
  true
);
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', 'ca100000-0000-4000-8000-000000000001',
    'session_id', 'ca110000-0000-4000-8000-000000000002',
    'role', 'authenticated'
  )::text,
  true
);
set local role authenticated;
select public.cancel_lesson_run(
  'cf700000-0000-4000-8000-000000000005',
  '2026-08-21 14:30:00+09'
);
select pg_sleep(6);
commit;
SQL
race_seventeen_start_cancel_pid=$!

if ! wait_for_sleeping_session \
  "$race_seventeen_start_cancel_app" \
  "$race_seventeen_start_cancel_pid"; then
  echo "Race 17c cancel did not reach its Run lock hold." >&2
  print_session_log \
    "Race 17c cancel log" \
    "$race_seventeen_start_cancel_log"
  exit 1
fi

PGAPPNAME="$race_seventeen_start_app" \
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 \
  >"$race_seventeen_start_log" 2>&1 <<'SQL' &
begin;
set local statement_timeout = '15s';
select set_config(
  'request.jwt.claim.sub',
  'ca100000-0000-4000-8000-000000000001',
  true
);
set local role authenticated;
do $start$
begin
  begin
    perform public.start_lesson_run(
      'cf700000-0000-4000-8000-000000000005',
      '2026-08-21 14:05:00+09'
    );
    raise exception 'race_17c_expected_cancelled_start_rejection';
  exception
    when sqlstate '55000' then
      if sqlerrm <> 'lesson_run_not_open' then
        raise;
      end if;
  end;
end
$start$;
commit;
SQL
race_seventeen_start_pid=$!

if ! wait_for_blocked_pair \
  "$race_seventeen_start_app" \
  "$race_seventeen_start_cancel_app" \
  "$race_seventeen_start_pid"; then
  echo "Race 17c start did not wait on cancel." >&2
  print_session_log \
    "Race 17c cancel log" \
    "$race_seventeen_start_cancel_log"
  print_session_log "Race 17c start log" "$race_seventeen_start_log"
  exit 1
fi

set +e
wait "$race_seventeen_start_cancel_pid"
race_seventeen_start_cancel_status=$?
race_seventeen_start_cancel_pid=""
wait "$race_seventeen_start_pid"
race_seventeen_start_status=$?
race_seventeen_start_pid=""
set -e

if [[ "$race_seventeen_start_cancel_status" -ne 0 ]] \
  || [[ "$race_seventeen_start_status" -ne 0 ]]; then
  echo "Race 17c cancel/start transactions did not finish safely." >&2
  print_session_log \
    "Race 17c cancel log" \
    "$race_seventeen_start_cancel_log"
  print_session_log "Race 17c start log" "$race_seventeen_start_log"
  exit 1
fi

race_seventeen_start_state="$(
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -Atqc \
    "select case when
       exists (
         select 1 from public.lesson_run
         where id = 'cf700000-0000-4000-8000-000000000005'
           and cancelled_at = '2026-08-21 14:30:00+09'::timestamptz
           and not started_at_is_actual
       )
       and not exists (
         select 1 from public.learning_record
         where lesson_run_id = 'cf700000-0000-4000-8000-000000000005'
       )
       and not exists (
         select 1 from public.lesson_run_presentation_state
         where lesson_run_id = 'cf700000-0000-4000-8000-000000000005'
       )
       and not exists (
         select 1 from public.lesson_run_execution_capability
         where lesson_run_id = 'cf700000-0000-4000-8000-000000000005'
       )
     then 'serialized' else '' end"
)"
if [[ "$race_seventeen_start_state" != "serialized" ]]; then
  echo "Race 17c partially started a cancelled Run." >&2
  exit 1
fi
}

# Dedicated LA-M4/LA-M5 fixtures stay independent from the LA-M3
# merge/erasure identities. LA-M4 Run 1 starts with a NULL cursor for the CAS
# race; the separate d5* Course carries only Choice Quiz submission races.
psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 >/dev/null <<'SQL'
begin;

do $guard$
begin
  if current_database() <> 'shidao_learning_activity_test' then
    raise exception 'learning_activity_concurrency_wrong_database'
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
) values (
  'cf100000-0000-4000-8000-000000000001',
  'la-m4-concurrency-learner@test.invalid',
  clock_timestamp(),
  '{}'::jsonb,
  '{}'::jsonb
), (
  'ce100000-0000-4000-8000-000000000001',
  'race-13-linked-learner@test.invalid',
  clock_timestamp(),
  '{}'::jsonb,
  '{}'::jsonb
), (
  'cd100000-0000-4000-8000-000000000001',
  'session-race-teacher@test.invalid',
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
) values (
  'cf110000-0000-4000-8000-000000000001',
  'cf100000-0000-4000-8000-000000000001',
  clock_timestamp(),
  clock_timestamp(),
  null
), (
  'cf110000-0000-4000-8000-000000000002',
  'cf100000-0000-4000-8000-000000000001',
  clock_timestamp(),
  clock_timestamp(),
  null
), (
  'cd110000-0000-4000-8000-000000000001',
  'cd100000-0000-4000-8000-000000000001',
  clock_timestamp(),
  clock_timestamp(),
  null
);

insert into public.account (
  id,
  auth_user_id,
  display_name,
  status
) values (
  'cf200000-0000-4000-8000-000000000001',
  'cf100000-0000-4000-8000-000000000001',
  'LA-M4 Concurrency Learner',
  'active'
), (
  'ce200000-0000-4000-8000-000000000001',
  'ce100000-0000-4000-8000-000000000001',
  'Race 13 Linked Learner',
  'active'
), (
  'cd200000-0000-4000-8000-000000000001',
  'cd100000-0000-4000-8000-000000000001',
  'Session Race Teacher',
  'active'
);

insert into public.account_security (
  account_id,
  sessions_invalid_before
) values (
  'cf200000-0000-4000-8000-000000000001',
  null
), (
  'ce200000-0000-4000-8000-000000000001',
  null
), (
  'cd200000-0000-4000-8000-000000000001',
  null
);

insert into public.learner_profile (id, display_name, account_id)
values (
  'cf300000-0000-4000-8000-000000000001',
  'LA-M4 Concurrency Learner',
  'cf200000-0000-4000-8000-000000000001'
), (
  'ce300000-0000-4000-8000-000000000001',
  'Race 13 Linked Learner',
  'ce200000-0000-4000-8000-000000000001'
), (
  'cd300000-0000-4000-8000-000000000001',
  'Session Race Teacher',
  'cd200000-0000-4000-8000-000000000001'
);

insert into public.teacher_learner (
  teacher_account_id,
  learner_profile_id,
  display_name
) values (
  'ca200000-0000-4000-8000-000000000001',
  'cf300000-0000-4000-8000-000000000001',
  'LA-M4 Concurrency Learner'
), (
  'ca200000-0000-4000-8000-000000000001',
  'ce300000-0000-4000-8000-000000000001',
  'Race 13 Linked Learner'
), (
  'cd200000-0000-4000-8000-000000000001',
  'cf300000-0000-4000-8000-000000000001',
  'Session Race Target'
);

insert into public.course (
  id,
  owner_account_id,
  title,
  subject,
  audience_type,
  learning_audience
) values
  (
    'cf400000-0000-4000-8000-000000000001',
    'ca200000-0000-4000-8000-000000000001',
    'LA-M4 concurrency adult course',
    'Русский язык',
    'none',
    'children'
  ),
  (
    'd5400000-0000-4000-8000-000000000001',
    'ca200000-0000-4000-8000-000000000001',
    'LA-M5 Choice Quiz concurrency course',
    'Русский язык',
    'none',
    'children'
  );

insert into public.lesson (id, course_id, position, title)
values
  (
    'cf500000-0000-4000-8000-000000000001',
    'cf400000-0000-4000-8000-000000000001',
    1,
    'Cursor CAS race'
  ),
  (
    'cf500000-0000-4000-8000-000000000002',
    'cf400000-0000-4000-8000-000000000001',
    2,
    'Start versus identity revoke race'
  ),
  (
    'cf500000-0000-4000-8000-000000000003',
    'cf400000-0000-4000-8000-000000000001',
    3,
    'Cursor versus Slide mutation races'
  ),
  (
    'cf500000-0000-4000-8000-000000000004',
    'cf400000-0000-4000-8000-000000000001',
    4,
    'Access versus cancellation lock order'
  ),
  (
    'cf500000-0000-4000-8000-000000000005',
    'cf400000-0000-4000-8000-000000000001',
    5,
    'Start versus cancellation lock order'
  ),
  (
    'd5500000-0000-4000-8000-000000000001',
    'd5400000-0000-4000-8000-000000000001',
    1,
    'Choice Quiz same-key races'
  ),
  (
    'd5500000-0000-4000-8000-000000000002',
    'd5400000-0000-4000-8000-000000000001',
    2,
    'Choice Quiz different-key retry race'
  ),
  (
    'd5500000-0000-4000-8000-000000000003',
    'd5400000-0000-4000-8000-000000000001',
    3,
    'Choice Quiz submit versus cursor race'
  ),
  (
    'd5500000-0000-4000-8000-000000000004',
    'd5400000-0000-4000-8000-000000000001',
    4,
    'Choice Quiz submit versus component edit race'
  ),
  (
    'd5500000-0000-4000-8000-000000000005',
    'd5400000-0000-4000-8000-000000000001',
    5,
    'Choice Quiz submit versus revoke race'
  ),
  (
    'd5500000-0000-4000-8000-000000000006',
    'd5400000-0000-4000-8000-000000000001',
    6,
    'Choice Quiz submit versus completion race'
  ),
  (
    'd5500000-0000-4000-8000-000000000007',
    'd5400000-0000-4000-8000-000000000001',
    7,
    'Choice Quiz submit versus cancellation race'
  ),
  (
    'd5500000-0000-4000-8000-000000000008',
    'd5400000-0000-4000-8000-000000000001',
    8,
    'Choice Quiz cancellation before submit race'
  ),
  (
    'd5500000-0000-4000-8000-000000000009',
    'd5400000-0000-4000-8000-000000000001',
    9,
    'Choice Quiz completion before submit race'
  ),
  (
    'd5500000-0000-4000-8000-000000000010',
    'd5400000-0000-4000-8000-000000000001',
    10,
    'Choice Quiz component edit before submit race'
  ),
  (
    'd5500000-0000-4000-8000-000000000011',
    'd5400000-0000-4000-8000-000000000001',
    11,
    'Choice Quiz component delete before submit race'
  );

insert into public.lesson_student_slide (id, lesson_id, position)
values
  (
    'cf550000-0000-4000-8000-000000000001',
    'cf500000-0000-4000-8000-000000000001',
    1
  ),
  (
    'cf550000-0000-4000-8000-000000000002',
    'cf500000-0000-4000-8000-000000000002',
    1
  ),
  (
    'cf550000-0000-4000-8000-000000000003',
    'cf500000-0000-4000-8000-000000000003',
    1
  ),
  (
    'cf550000-0000-4000-8000-000000000004',
    'cf500000-0000-4000-8000-000000000003',
    2
  ),
  (
    'd5550000-0000-4000-8000-000000000001',
    'd5500000-0000-4000-8000-000000000001',
    1
  ),
  (
    'd5550000-0000-4000-8000-000000000002',
    'd5500000-0000-4000-8000-000000000002',
    1
  ),
  (
    'd5550000-0000-4000-8000-000000000003',
    'd5500000-0000-4000-8000-000000000003',
    1
  ),
  (
    'd5550000-0000-4000-8000-000000000004',
    'd5500000-0000-4000-8000-000000000003',
    2
  ),
  (
    'd5550000-0000-4000-8000-000000000005',
    'd5500000-0000-4000-8000-000000000004',
    1
  ),
  (
    'd5550000-0000-4000-8000-000000000006',
    'd5500000-0000-4000-8000-000000000005',
    1
  ),
  (
    'd5550000-0000-4000-8000-000000000007',
    'd5500000-0000-4000-8000-000000000006',
    1
  ),
  (
    'd5550000-0000-4000-8000-000000000008',
    'd5500000-0000-4000-8000-000000000007',
    1
  ),
  (
    'd5550000-0000-4000-8000-000000000009',
    'd5500000-0000-4000-8000-000000000008',
    1
  ),
  (
    'd5550000-0000-4000-8000-000000000010',
    'd5500000-0000-4000-8000-000000000009',
    1
  ),
  (
    'd5550000-0000-4000-8000-000000000011',
    'd5500000-0000-4000-8000-000000000010',
    1
  ),
  (
    'd5550000-0000-4000-8000-000000000012',
    'd5500000-0000-4000-8000-000000000011',
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
    'cf600000-0000-4000-8000-000000000001',
    'cf500000-0000-4000-8000-000000000001',
    1,
    'rich_text',
    '{"content":"LA_M4_CURSOR_RACE"}'::jsonb,
    '{}'::jsonb,
    'learner_visible',
    'cf550000-0000-4000-8000-000000000001'
  ),
  (
    'cf600000-0000-4000-8000-000000000002',
    'cf500000-0000-4000-8000-000000000002',
    1,
    'rich_text',
    '{"content":"LA_M4_START_REVOKE_RACE"}'::jsonb,
    '{}'::jsonb,
    'learner_visible',
    'cf550000-0000-4000-8000-000000000002'
  ),
  (
    'cf600000-0000-4000-8000-000000000003',
    'cf500000-0000-4000-8000-000000000003',
    1,
    'rich_text',
    '{"content":"LA_M4_SLIDE_MUTATION_A"}'::jsonb,
    '{}'::jsonb,
    'learner_visible',
    'cf550000-0000-4000-8000-000000000003'
  ),
  (
    'cf600000-0000-4000-8000-000000000004',
    'cf500000-0000-4000-8000-000000000003',
    2,
    'rich_text',
    '{"content":"LA_M4_SLIDE_MUTATION_B"}'::jsonb,
    '{}'::jsonb,
    'learner_visible',
    'cf550000-0000-4000-8000-000000000004'
  );

insert into public.lesson_component (
  id,
  lesson_id,
  position,
  type_key,
  schema_version,
  payload,
  placement_config,
  visibility,
  student_slide_id,
  activity_role
) values
  (
    'd5600000-0000-4000-8000-000000000001',
    'd5500000-0000-4000-8000-000000000001',
    1,
    'choice_quiz',
    1,
    '{"question":"Choose Alpha.","allowMultiple":false,"options":[{"id":"D5100000-0000-4000-8000-000000000001","label":"Alpha","isCorrect":true},{"id":"D5100000-0000-4000-8000-000000000002","label":"Beta","isCorrect":false}],"explanation":"Alpha is the exact answer."}'::jsonb,
    '{}'::jsonb,
    'learner_visible',
    'd5550000-0000-4000-8000-000000000001',
    'practice'
  ),
  (
    'd5600000-0000-4000-8000-000000000002',
    'd5500000-0000-4000-8000-000000000002',
    1,
    'choice_quiz',
    1,
    '{"question":"Choose Alpha.","allowMultiple":false,"options":[{"id":"d5100000-0000-4000-8000-000000000001","label":"Alpha","isCorrect":true},{"id":"d5100000-0000-4000-8000-000000000002","label":"Beta","isCorrect":false}],"explanation":"Alpha is the exact answer."}'::jsonb,
    '{}'::jsonb,
    'learner_visible',
    'd5550000-0000-4000-8000-000000000002',
    'practice'
  ),
  (
    'd5600000-0000-4000-8000-000000000003',
    'd5500000-0000-4000-8000-000000000003',
    1,
    'choice_quiz',
    1,
    '{"question":"Choose Alpha.","allowMultiple":false,"options":[{"id":"d5100000-0000-4000-8000-000000000001","label":"Alpha","isCorrect":true},{"id":"d5100000-0000-4000-8000-000000000002","label":"Beta","isCorrect":false}],"explanation":"Alpha is the exact answer."}'::jsonb,
    '{}'::jsonb,
    'learner_visible',
    'd5550000-0000-4000-8000-000000000003',
    'practice'
  ),
  (
    'd5600000-0000-4000-8000-000000000004',
    'd5500000-0000-4000-8000-000000000003',
    2,
    'rich_text',
    1,
    '{"content":"LA_M5_CURSOR_AFTER_SUBMIT"}'::jsonb,
    '{}'::jsonb,
    'learner_visible',
    'd5550000-0000-4000-8000-000000000004',
    null
  ),
  (
    'd5600000-0000-4000-8000-000000000005',
    'd5500000-0000-4000-8000-000000000004',
    1,
    'choice_quiz',
    1,
    '{"question":"Choose Alpha.","allowMultiple":false,"options":[{"id":"d5100000-0000-4000-8000-000000000001","label":"Alpha","isCorrect":true},{"id":"d5100000-0000-4000-8000-000000000002","label":"Beta","isCorrect":false}],"explanation":"Alpha is the exact answer."}'::jsonb,
    '{}'::jsonb,
    'learner_visible',
    'd5550000-0000-4000-8000-000000000005',
    'practice'
  ),
  (
    'd5600000-0000-4000-8000-000000000006',
    'd5500000-0000-4000-8000-000000000005',
    1,
    'choice_quiz',
    1,
    '{"question":"Choose Alpha.","allowMultiple":false,"options":[{"id":"d5100000-0000-4000-8000-000000000001","label":"Alpha","isCorrect":true},{"id":"d5100000-0000-4000-8000-000000000002","label":"Beta","isCorrect":false}],"explanation":"Alpha is the exact answer."}'::jsonb,
    '{}'::jsonb,
    'learner_visible',
    'd5550000-0000-4000-8000-000000000006',
    'practice'
  ),
  (
    'd5600000-0000-4000-8000-000000000007',
    'd5500000-0000-4000-8000-000000000006',
    1,
    'choice_quiz',
    1,
    '{"question":"Choose Alpha.","allowMultiple":false,"options":[{"id":"d5100000-0000-4000-8000-000000000001","label":"Alpha","isCorrect":true},{"id":"d5100000-0000-4000-8000-000000000002","label":"Beta","isCorrect":false}],"explanation":"Alpha is the exact answer."}'::jsonb,
    '{}'::jsonb,
    'learner_visible',
    'd5550000-0000-4000-8000-000000000007',
    'practice'
  ),
  (
    'd5600000-0000-4000-8000-000000000008',
    'd5500000-0000-4000-8000-000000000007',
    1,
    'choice_quiz',
    1,
    '{"question":"Choose Alpha.","allowMultiple":false,"options":[{"id":"d5100000-0000-4000-8000-000000000001","label":"Alpha","isCorrect":true},{"id":"d5100000-0000-4000-8000-000000000002","label":"Beta","isCorrect":false}],"explanation":"Alpha is the exact answer."}'::jsonb,
    '{}'::jsonb,
    'learner_visible',
    'd5550000-0000-4000-8000-000000000008',
    'practice'
  ),
  (
    'd5600000-0000-4000-8000-000000000009',
    'd5500000-0000-4000-8000-000000000008',
    1,
    'choice_quiz',
    1,
    '{"question":"Choose Alpha.","allowMultiple":false,"options":[{"id":"d5100000-0000-4000-8000-000000000001","label":"Alpha","isCorrect":true},{"id":"d5100000-0000-4000-8000-000000000002","label":"Beta","isCorrect":false}],"explanation":"Alpha is the exact answer."}'::jsonb,
    '{}'::jsonb,
    'learner_visible',
    'd5550000-0000-4000-8000-000000000009',
    'practice'
  ),
  (
    'd5600000-0000-4000-8000-000000000010',
    'd5500000-0000-4000-8000-000000000009',
    1,
    'choice_quiz',
    1,
    '{"question":"Choose Alpha.","allowMultiple":false,"options":[{"id":"d5100000-0000-4000-8000-000000000001","label":"Alpha","isCorrect":true},{"id":"d5100000-0000-4000-8000-000000000002","label":"Beta","isCorrect":false}],"explanation":"Alpha is the exact answer."}'::jsonb,
    '{}'::jsonb,
    'learner_visible',
    'd5550000-0000-4000-8000-000000000010',
    'practice'
  ),
  (
    'd5600000-0000-4000-8000-000000000011',
    'd5500000-0000-4000-8000-000000000010',
    1,
    'choice_quiz',
    1,
    '{"question":"Choose Alpha.","allowMultiple":false,"options":[{"id":"d5100000-0000-4000-8000-000000000001","label":"Alpha","isCorrect":true},{"id":"d5100000-0000-4000-8000-000000000002","label":"Beta","isCorrect":false}],"explanation":"Alpha is the exact answer."}'::jsonb,
    '{}'::jsonb,
    'learner_visible',
    'd5550000-0000-4000-8000-000000000011',
    'practice'
  ),
  (
    'd5600000-0000-4000-8000-000000000012',
    'd5500000-0000-4000-8000-000000000011',
    1,
    'choice_quiz',
    1,
    '{"question":"Choose Alpha.","allowMultiple":false,"options":[{"id":"d5100000-0000-4000-8000-000000000001","label":"Alpha","isCorrect":true},{"id":"d5100000-0000-4000-8000-000000000002","label":"Beta","isCorrect":false}],"explanation":"Alpha is the exact answer."}'::jsonb,
    '{}'::jsonb,
    'learner_visible',
    'd5550000-0000-4000-8000-000000000012',
    'practice'
  );

insert into public.lesson_run (
  id,
  lesson_id,
  scheduled_at,
  planned_duration_minutes
) values
  (
    'cf700000-0000-4000-8000-000000000001',
    'cf500000-0000-4000-8000-000000000001',
    '2026-08-21 10:00:00+09',
    45
  ),
  (
    'cf700000-0000-4000-8000-000000000002',
    'cf500000-0000-4000-8000-000000000002',
    '2026-08-21 11:00:00+09',
    45
  ),
  (
    'cf700000-0000-4000-8000-000000000003',
    'cf500000-0000-4000-8000-000000000003',
    '2026-08-21 12:00:00+09',
    45
  ),
  (
    'cf700000-0000-4000-8000-000000000004',
    'cf500000-0000-4000-8000-000000000004',
    '2026-08-21 13:00:00+09',
    45
  ),
  (
    'cf700000-0000-4000-8000-000000000005',
    'cf500000-0000-4000-8000-000000000005',
    '2026-08-21 14:00:00+09',
    45
  ),
  (
    'd5700000-0000-4000-8000-000000000001',
    'd5500000-0000-4000-8000-000000000001',
    '2026-08-21 15:00:00+09',
    45
  ),
  (
    'd5700000-0000-4000-8000-000000000002',
    'd5500000-0000-4000-8000-000000000002',
    '2026-08-21 16:00:00+09',
    45
  ),
  (
    'd5700000-0000-4000-8000-000000000003',
    'd5500000-0000-4000-8000-000000000003',
    '2026-08-21 17:00:00+09',
    45
  ),
  (
    'd5700000-0000-4000-8000-000000000004',
    'd5500000-0000-4000-8000-000000000004',
    '2026-08-21 18:00:00+09',
    45
  ),
  (
    'd5700000-0000-4000-8000-000000000005',
    'd5500000-0000-4000-8000-000000000005',
    '2026-08-21 19:00:00+09',
    45
  ),
  (
    'd5700000-0000-4000-8000-000000000006',
    'd5500000-0000-4000-8000-000000000006',
    '2026-08-21 20:00:00+09',
    45
  ),
  (
    'd5700000-0000-4000-8000-000000000007',
    'd5500000-0000-4000-8000-000000000007',
    '2026-08-21 21:00:00+09',
    45
  ),
  (
    'd5700000-0000-4000-8000-000000000008',
    'd5500000-0000-4000-8000-000000000008',
    '2026-08-21 22:00:00+09',
    45
  ),
  (
    'd5700000-0000-4000-8000-000000000009',
    'd5500000-0000-4000-8000-000000000009',
    '2026-08-21 23:00:00+09',
    45
  ),
  (
    'd5700000-0000-4000-8000-000000000010',
    'd5500000-0000-4000-8000-000000000010',
    '2026-08-22 00:00:00+09',
    45
  ),
  (
    'd5700000-0000-4000-8000-000000000011',
    'd5500000-0000-4000-8000-000000000011',
    '2026-08-22 01:00:00+09',
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
    'cf800000-0000-4000-8000-000000000001',
    'cf300000-0000-4000-8000-000000000001',
    'cf700000-0000-4000-8000-000000000001',
    'cf400000-0000-4000-8000-000000000001',
    'cf500000-0000-4000-8000-000000000001',
    'cf400000-0000-4000-8000-000000000001',
    'cf500000-0000-4000-8000-000000000001',
    'cf700000-0000-4000-8000-000000000001',
    'ca200000-0000-4000-8000-000000000001'
  ),
  (
    'cf800000-0000-4000-8000-000000000002',
    'cf300000-0000-4000-8000-000000000001',
    'cf700000-0000-4000-8000-000000000002',
    'cf400000-0000-4000-8000-000000000001',
    'cf500000-0000-4000-8000-000000000002',
    'cf400000-0000-4000-8000-000000000001',
    'cf500000-0000-4000-8000-000000000002',
    'cf700000-0000-4000-8000-000000000002',
    'ca200000-0000-4000-8000-000000000001'
  ),
  (
    'ce800000-0000-4000-8000-000000000001',
    'ce300000-0000-4000-8000-000000000001',
    'cf700000-0000-4000-8000-000000000002',
    'cf400000-0000-4000-8000-000000000001',
    'cf500000-0000-4000-8000-000000000002',
    'cf400000-0000-4000-8000-000000000001',
    'cf500000-0000-4000-8000-000000000002',
    'cf700000-0000-4000-8000-000000000002',
    'ca200000-0000-4000-8000-000000000001'
  ),
  (
    'cf800000-0000-4000-8000-000000000003',
    'cf300000-0000-4000-8000-000000000001',
    'cf700000-0000-4000-8000-000000000003',
    'cf400000-0000-4000-8000-000000000001',
    'cf500000-0000-4000-8000-000000000003',
    'cf400000-0000-4000-8000-000000000001',
    'cf500000-0000-4000-8000-000000000003',
    'cf700000-0000-4000-8000-000000000003',
    'ca200000-0000-4000-8000-000000000001'
  ),
  (
    'cf800000-0000-4000-8000-000000000004',
    'cf300000-0000-4000-8000-000000000001',
    'cf700000-0000-4000-8000-000000000004',
    'cf400000-0000-4000-8000-000000000001',
    'cf500000-0000-4000-8000-000000000004',
    'cf400000-0000-4000-8000-000000000001',
    'cf500000-0000-4000-8000-000000000004',
    'cf700000-0000-4000-8000-000000000004',
    'ca200000-0000-4000-8000-000000000001'
  ),
  (
    'cf800000-0000-4000-8000-000000000005',
    'cf300000-0000-4000-8000-000000000001',
    'cf700000-0000-4000-8000-000000000005',
    'cf400000-0000-4000-8000-000000000001',
    'cf500000-0000-4000-8000-000000000005',
    'cf400000-0000-4000-8000-000000000001',
    'cf500000-0000-4000-8000-000000000005',
    'cf700000-0000-4000-8000-000000000005',
    'ca200000-0000-4000-8000-000000000001'
  ),
  (
    'd5800000-0000-4000-8000-000000000001',
    'cf300000-0000-4000-8000-000000000001',
    'd5700000-0000-4000-8000-000000000001',
    'd5400000-0000-4000-8000-000000000001',
    'd5500000-0000-4000-8000-000000000001',
    'd5400000-0000-4000-8000-000000000001',
    'd5500000-0000-4000-8000-000000000001',
    'd5700000-0000-4000-8000-000000000001',
    'ca200000-0000-4000-8000-000000000001'
  ),
  (
    'd5800000-0000-4000-8000-000000000002',
    'cf300000-0000-4000-8000-000000000001',
    'd5700000-0000-4000-8000-000000000002',
    'd5400000-0000-4000-8000-000000000001',
    'd5500000-0000-4000-8000-000000000002',
    'd5400000-0000-4000-8000-000000000001',
    'd5500000-0000-4000-8000-000000000002',
    'd5700000-0000-4000-8000-000000000002',
    'ca200000-0000-4000-8000-000000000001'
  ),
  (
    'd5800000-0000-4000-8000-000000000003',
    'cf300000-0000-4000-8000-000000000001',
    'd5700000-0000-4000-8000-000000000003',
    'd5400000-0000-4000-8000-000000000001',
    'd5500000-0000-4000-8000-000000000003',
    'd5400000-0000-4000-8000-000000000001',
    'd5500000-0000-4000-8000-000000000003',
    'd5700000-0000-4000-8000-000000000003',
    'ca200000-0000-4000-8000-000000000001'
  ),
  (
    'd5800000-0000-4000-8000-000000000004',
    'cf300000-0000-4000-8000-000000000001',
    'd5700000-0000-4000-8000-000000000004',
    'd5400000-0000-4000-8000-000000000001',
    'd5500000-0000-4000-8000-000000000004',
    'd5400000-0000-4000-8000-000000000001',
    'd5500000-0000-4000-8000-000000000004',
    'd5700000-0000-4000-8000-000000000004',
    'ca200000-0000-4000-8000-000000000001'
  ),
  (
    'd5800000-0000-4000-8000-000000000005',
    'cf300000-0000-4000-8000-000000000001',
    'd5700000-0000-4000-8000-000000000005',
    'd5400000-0000-4000-8000-000000000001',
    'd5500000-0000-4000-8000-000000000005',
    'd5400000-0000-4000-8000-000000000001',
    'd5500000-0000-4000-8000-000000000005',
    'd5700000-0000-4000-8000-000000000005',
    'ca200000-0000-4000-8000-000000000001'
  ),
  (
    'd5800000-0000-4000-8000-000000000006',
    'cf300000-0000-4000-8000-000000000001',
    'd5700000-0000-4000-8000-000000000006',
    'd5400000-0000-4000-8000-000000000001',
    'd5500000-0000-4000-8000-000000000006',
    'd5400000-0000-4000-8000-000000000001',
    'd5500000-0000-4000-8000-000000000006',
    'd5700000-0000-4000-8000-000000000006',
    'ca200000-0000-4000-8000-000000000001'
  ),
  (
    'd5800000-0000-4000-8000-000000000007',
    'cf300000-0000-4000-8000-000000000001',
    'd5700000-0000-4000-8000-000000000007',
    'd5400000-0000-4000-8000-000000000001',
    'd5500000-0000-4000-8000-000000000007',
    'd5400000-0000-4000-8000-000000000001',
    'd5500000-0000-4000-8000-000000000007',
    'd5700000-0000-4000-8000-000000000007',
    'ca200000-0000-4000-8000-000000000001'
  ),
  (
    'd5800000-0000-4000-8000-000000000008',
    'cf300000-0000-4000-8000-000000000001',
    'd5700000-0000-4000-8000-000000000008',
    'd5400000-0000-4000-8000-000000000001',
    'd5500000-0000-4000-8000-000000000008',
    'd5400000-0000-4000-8000-000000000001',
    'd5500000-0000-4000-8000-000000000008',
    'd5700000-0000-4000-8000-000000000008',
    'ca200000-0000-4000-8000-000000000001'
  ),
  (
    'd5800000-0000-4000-8000-000000000009',
    'cf300000-0000-4000-8000-000000000001',
    'd5700000-0000-4000-8000-000000000009',
    'd5400000-0000-4000-8000-000000000001',
    'd5500000-0000-4000-8000-000000000009',
    'd5400000-0000-4000-8000-000000000001',
    'd5500000-0000-4000-8000-000000000009',
    'd5700000-0000-4000-8000-000000000009',
    'ca200000-0000-4000-8000-000000000001'
  ),
  (
    'd5800000-0000-4000-8000-000000000010',
    'cf300000-0000-4000-8000-000000000001',
    'd5700000-0000-4000-8000-000000000010',
    'd5400000-0000-4000-8000-000000000001',
    'd5500000-0000-4000-8000-000000000010',
    'd5400000-0000-4000-8000-000000000001',
    'd5500000-0000-4000-8000-000000000010',
    'd5700000-0000-4000-8000-000000000010',
    'ca200000-0000-4000-8000-000000000001'
  ),
  (
    'd5800000-0000-4000-8000-000000000011',
    'cf300000-0000-4000-8000-000000000001',
    'd5700000-0000-4000-8000-000000000011',
    'd5400000-0000-4000-8000-000000000001',
    'd5500000-0000-4000-8000-000000000011',
    'd5400000-0000-4000-8000-000000000001',
    'd5500000-0000-4000-8000-000000000011',
    'd5700000-0000-4000-8000-000000000011',
    'ca200000-0000-4000-8000-000000000001'
  );

set local session_replication_role = origin;
select set_config(
  'request.jwt.claim.sub',
  'ca100000-0000-4000-8000-000000000001',
  true
);
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', 'ca100000-0000-4000-8000-000000000001',
    'session_id', 'ca110000-0000-4000-8000-000000000002',
    'role', 'authenticated'
  )::text,
  true
);
set local role authenticated;
select public.set_lesson_run_live_access(
  'cf700000-0000-4000-8000-000000000001',
  'cf300000-0000-4000-8000-000000000001',
  true,
  false
);
select public.start_lesson_run(
  'cf700000-0000-4000-8000-000000000001',
  '2026-08-21 10:05:00+09'
);
select public.start_lesson_run(
  'cf700000-0000-4000-8000-000000000003',
  '2026-08-21 12:05:00+09'
);
select public.set_lesson_run_live_access(
  'cf700000-0000-4000-8000-000000000002',
  'ce300000-0000-4000-8000-000000000001',
  true,
  false
);

select public.set_lesson_run_live_access(
  'd5700000-0000-4000-8000-000000000001',
  'cf300000-0000-4000-8000-000000000001',
  true,
  false
);
select public.start_lesson_run(
  'd5700000-0000-4000-8000-000000000001',
  '2026-08-21 15:05:00+09'
);
select public.set_lesson_run_presentation_cursor(
  'd5700000-0000-4000-8000-000000000001',
  'd5550000-0000-4000-8000-000000000001',
  0
);

select public.set_lesson_run_live_access(
  'd5700000-0000-4000-8000-000000000002',
  'cf300000-0000-4000-8000-000000000001',
  true,
  false
);
select public.start_lesson_run(
  'd5700000-0000-4000-8000-000000000002',
  '2026-08-21 16:05:00+09'
);
select public.set_lesson_run_presentation_cursor(
  'd5700000-0000-4000-8000-000000000002',
  'd5550000-0000-4000-8000-000000000002',
  0
);

select public.set_lesson_run_live_access(
  'd5700000-0000-4000-8000-000000000003',
  'cf300000-0000-4000-8000-000000000001',
  true,
  false
);
select public.start_lesson_run(
  'd5700000-0000-4000-8000-000000000003',
  '2026-08-21 17:05:00+09'
);
select public.set_lesson_run_presentation_cursor(
  'd5700000-0000-4000-8000-000000000003',
  'd5550000-0000-4000-8000-000000000003',
  0
);

select public.set_lesson_run_live_access(
  'd5700000-0000-4000-8000-000000000004',
  'cf300000-0000-4000-8000-000000000001',
  true,
  false
);
select public.start_lesson_run(
  'd5700000-0000-4000-8000-000000000004',
  '2026-08-21 18:05:00+09'
);
select public.set_lesson_run_presentation_cursor(
  'd5700000-0000-4000-8000-000000000004',
  'd5550000-0000-4000-8000-000000000005',
  0
);

select public.set_lesson_run_live_access(
  'd5700000-0000-4000-8000-000000000005',
  'cf300000-0000-4000-8000-000000000001',
  true,
  false
);
select public.start_lesson_run(
  'd5700000-0000-4000-8000-000000000005',
  '2026-08-21 19:05:00+09'
);
select public.set_lesson_run_presentation_cursor(
  'd5700000-0000-4000-8000-000000000005',
  'd5550000-0000-4000-8000-000000000006',
  0
);

select public.set_lesson_run_live_access(
  'd5700000-0000-4000-8000-000000000006',
  'cf300000-0000-4000-8000-000000000001',
  true,
  false
);
select public.start_lesson_run(
  'd5700000-0000-4000-8000-000000000006',
  '2026-08-21 20:05:00+09'
);
select public.set_lesson_run_presentation_cursor(
  'd5700000-0000-4000-8000-000000000006',
  'd5550000-0000-4000-8000-000000000007',
  0
);

select public.set_lesson_run_live_access(
  'd5700000-0000-4000-8000-000000000007',
  'cf300000-0000-4000-8000-000000000001',
  true,
  false
);
select public.start_lesson_run(
  'd5700000-0000-4000-8000-000000000007',
  '2026-08-21 21:05:00+09'
);
select public.set_lesson_run_presentation_cursor(
  'd5700000-0000-4000-8000-000000000007',
  'd5550000-0000-4000-8000-000000000008',
  0
);

select public.set_lesson_run_live_access(
  'd5700000-0000-4000-8000-000000000008',
  'cf300000-0000-4000-8000-000000000001',
  true,
  false
);
select public.start_lesson_run(
  'd5700000-0000-4000-8000-000000000008',
  '2026-08-21 22:05:00+09'
);
select public.set_lesson_run_presentation_cursor(
  'd5700000-0000-4000-8000-000000000008',
  'd5550000-0000-4000-8000-000000000009',
  0
);

select public.set_lesson_run_live_access(
  'd5700000-0000-4000-8000-000000000009',
  'cf300000-0000-4000-8000-000000000001',
  true,
  false
);
select public.start_lesson_run(
  'd5700000-0000-4000-8000-000000000009',
  '2026-08-21 23:05:00+09'
);
select public.set_lesson_run_presentation_cursor(
  'd5700000-0000-4000-8000-000000000009',
  'd5550000-0000-4000-8000-000000000010',
  0
);

select public.set_lesson_run_live_access(
  'd5700000-0000-4000-8000-000000000010',
  'cf300000-0000-4000-8000-000000000001',
  true,
  false
);
select public.start_lesson_run(
  'd5700000-0000-4000-8000-000000000010',
  '2026-08-22 00:05:00+09'
);
select public.set_lesson_run_presentation_cursor(
  'd5700000-0000-4000-8000-000000000010',
  'd5550000-0000-4000-8000-000000000011',
  0
);

select public.set_lesson_run_live_access(
  'd5700000-0000-4000-8000-000000000011',
  'cf300000-0000-4000-8000-000000000001',
  true,
  false
);
select public.start_lesson_run(
  'd5700000-0000-4000-8000-000000000011',
  '2026-08-22 01:05:00+09'
);
select public.set_lesson_run_presentation_cursor(
  'd5700000-0000-4000-8000-000000000011',
  'd5550000-0000-4000-8000-000000000012',
  0
);
reset role;

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
race_nine_refresh_app="la_m3_${session_suffix}_refresh_before_correction"
race_nine_correction_app="la_m3_${session_suffix}_correction_after_refresh"
race_ten_refresh_app="la_m3_${session_suffix}_refresh_before_merge"
race_ten_merge_app="la_m3_${session_suffix}_merge_after_refresh"
race_ten_live_read_app="la_m4_${session_suffix}_read_after_merge"
race_eleven_refresh_app="la_m3_${session_suffix}_refresh_before_erasure"
race_eleven_erasure_app="la_m3_${session_suffix}_erasure_after_refresh"
race_eleven_live_read_app="la_m4_${session_suffix}_read_after_erasure"
race_twelve_cursor_first_app="la_m4_${session_suffix}_cursor_first"
race_twelve_cursor_stale_app="la_m4_${session_suffix}_cursor_stale"
race_thirteen_start_app="la_m4_${session_suffix}_start_before_identity_change"
race_thirteen_revoke_app="la_m4_${session_suffix}_identity_change_after_start"
race_fourteen_grant_app="la_m4_${session_suffix}_grant_before_read"
race_fourteen_read_app="la_m4_${session_suffix}_read_after_grant"
race_fifteen_revoke_app="la_m4_${session_suffix}_revoke_before_read"
race_fifteen_read_app="la_m4_${session_suffix}_read_after_revoke"
race_fifteen_grant_status_app="la_m4_${session_suffix}_grant_before_status"
race_fifteen_status_after_grant_app="la_m4_${session_suffix}_status_after_grant"
race_sixteen_cursor_app="la_m4_${session_suffix}_cursor_before_completion"
race_sixteen_completion_app="la_m4_${session_suffix}_completion_after_cursor"
race_seventeen_cancel_app="la_m4_${session_suffix}_cancel_before_cursor"
race_seventeen_cursor_app="la_m4_${session_suffix}_cursor_after_cancel"
race_seventeen_read_app="la_m4_${session_suffix}_read_after_cancel"
race_seventeen_access_cancel_app="la_m4_${session_suffix}_cancel_before_access"
race_seventeen_access_app="la_m4_${session_suffix}_access_after_cancel"
race_seventeen_start_cancel_app="la_m4_${session_suffix}_cancel_before_start"
race_seventeen_start_app="la_m4_${session_suffix}_start_after_cancel"
race_eighteen_cursor_app="la_m4_${session_suffix}_cursor_before_reorder"
race_eighteen_reorder_app="la_m4_${session_suffix}_reorder_after_cursor"
race_nineteen_cursor_app="la_m4_${session_suffix}_cursor_before_delete"
race_nineteen_delete_app="la_m4_${session_suffix}_delete_after_cursor"
race_twenty_status_app="la_m4_${session_suffix}_status_before_read"
race_twenty_read_app="la_m4_${session_suffix}_read_after_status"
race_twenty_b_session_app="la_m5_${session_suffix}_session_delete_before_read"
race_twenty_b_read_app="la_m5_${session_suffix}_read_after_session_delete"
race_twenty_one_cutoff_app="la_m4_${session_suffix}_cutoff_before_read"
race_twenty_one_read_app="la_m4_${session_suffix}_read_after_cutoff"
race_twenty_two_owner_status_app="la_m4_${session_suffix}_owner_status_before_cursor"
race_twenty_two_cursor_app="la_m4_${session_suffix}_cursor_after_owner_status"
race_twenty_three_archive_app="la_m4_${session_suffix}_archive_before_cursor"
race_twenty_three_cursor_app="la_m4_${session_suffix}_cursor_after_archive"
race_twenty_four_first_app="la_m5_${session_suffix}_same_key_first"
race_twenty_four_dedupe_app="la_m5_${session_suffix}_same_key_dedupe"
race_twenty_five_replay_app="la_m5_${session_suffix}_same_key_replay"
race_twenty_five_conflict_app="la_m5_${session_suffix}_same_key_conflict"
race_twenty_six_first_app="la_m5_${session_suffix}_different_key_first"
race_twenty_six_retry_app="la_m5_${session_suffix}_different_key_retry"
race_twenty_seven_submit_app="la_m5_${session_suffix}_submit_before_cursor"
race_twenty_seven_cursor_app="la_m5_${session_suffix}_cursor_after_submit"
race_twenty_eight_submit_app="la_m5_${session_suffix}_submit_before_edit"
race_twenty_eight_edit_app="la_m5_${session_suffix}_edit_after_submit"
race_twenty_eight_b_submit_app="la_m5_${session_suffix}_submit_before_completion"
race_twenty_eight_b_completion_app="la_m5_${session_suffix}_completion_after_submit"
race_twenty_eight_c_submit_app="la_m5_${session_suffix}_submit_before_cancel"
race_twenty_eight_c_cancel_app="la_m5_${session_suffix}_cancel_after_submit"
race_twenty_eight_d_cancel_app="la_m5_${session_suffix}_cancel_holds_course"
race_twenty_eight_d_submit_app="la_m5_${session_suffix}_submit_after_cancel"
race_twenty_eight_e_completion_app="la_m5_${session_suffix}_completion_holds_learner"
race_twenty_eight_e_submit_app="la_m5_${session_suffix}_submit_after_completion"
race_twenty_eight_f_edit_app="la_m5_${session_suffix}_edit_before_submit"
race_twenty_eight_f_submit_app="la_m5_${session_suffix}_submit_after_edit"
race_twenty_eight_g_delete_app="la_m5_${session_suffix}_delete_before_submit"
race_twenty_eight_g_submit_app="la_m5_${session_suffix}_submit_after_delete"
race_twenty_nine_submit_app="la_m5_${session_suffix}_submit_before_revoke"
race_twenty_nine_revoke_app="la_m5_${session_suffix}_revoke_after_submit"
race_thirty_correction_app="la_m5_${session_suffix}_correction_before_cutoff"
race_thirty_cutoff_app="la_m5_${session_suffix}_cutoff_after_correction"
race_thirty_one_correction_app="la_m5_${session_suffix}_correction_before_deactivate"
race_thirty_one_deactivate_app="la_m5_${session_suffix}_deactivate_after_correction"
race_thirty_two_history_app="la_m5_${session_suffix}_history_before_cutoff"
race_thirty_two_cutoff_app="la_m5_${session_suffix}_cutoff_after_history"
race_thirty_three_history_app="la_m5_${session_suffix}_history_before_deactivate"
race_thirty_three_deactivate_app="la_m5_${session_suffix}_deactivate_after_history"
race_thirty_three_b_history_app="la_m5_${session_suffix}_history_before_new_issue"
race_thirty_three_b_issue_app="la_m5_${session_suffix}_new_issue_after_history"
race_thirty_three_c_correction_app="la_m5_${session_suffix}_correction_before_owner_transfer"
race_thirty_three_c_transfer_app="la_m5_${session_suffix}_owner_transfer_after_correction"
race_thirty_four_history_app="la_m5_${session_suffix}_history_before_erasure"
race_thirty_four_erasure_app="la_m5_${session_suffix}_erasure_after_history"
race_thirty_five_erasure_app="la_m5_${session_suffix}_erasure_before_history"
race_thirty_five_history_app="la_m5_${session_suffix}_history_after_erasure"

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

issue_choice_quiz_fixture() {
  local lesson_run_id="$1"
  local component_id="$2"
  local actor_auth_user_id="${3:-cf100000-0000-4000-8000-000000000001}"
  local session_id="${4:-cf110000-0000-4000-8000-000000000001}"

  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -Atq \
    -v lesson_run_id="$lesson_run_id" \
    -v component_id="$component_id" \
    -v actor_auth_user_id="$actor_auth_user_id" \
    -v session_id="$session_id" <<'SQL'
begin;
select component.updated_at::text as component_updated_at
from public.lesson_component as component
where component.id = :'component_id'::uuid
\gset
set local role service_role;
select public.issue_choice_quiz_definition_admin(
  :'actor_auth_user_id'::uuid,
  :'session_id'::uuid,
  :'lesson_run_id'::uuid,
  :'component_id'::uuid,
  1,
  :'component_updated_at'::timestamptz,
  '{"question":"Choose Alpha.","allowMultiple":false,"options":[{"id":"d5100000-0000-4000-8000-000000000001","label":"Alpha"},{"id":"d5100000-0000-4000-8000-000000000002","label":"Beta"}]}'::jsonb,
  '{"correctOptionIds":["d5100000-0000-4000-8000-000000000001"],"allowMultiple":false,"explanation":"Alpha is the exact answer."}'::jsonb
) #>> '{execution,issueRef}';
commit;
SQL
}

race_choice_quiz_same_key_ref="$(
  issue_choice_quiz_fixture \
    'd5700000-0000-4000-8000-000000000001' \
    'd5600000-0000-4000-8000-000000000001'
)"
race_choice_quiz_retry_ref="$(
  issue_choice_quiz_fixture \
    'd5700000-0000-4000-8000-000000000002' \
    'd5600000-0000-4000-8000-000000000002'
)"
race_choice_quiz_cursor_ref="$(
  issue_choice_quiz_fixture \
    'd5700000-0000-4000-8000-000000000003' \
    'd5600000-0000-4000-8000-000000000003'
)"
race_choice_quiz_edit_ref="$(
  issue_choice_quiz_fixture \
    'd5700000-0000-4000-8000-000000000004' \
    'd5600000-0000-4000-8000-000000000005'
)"
race_choice_quiz_revoke_ref="$(
  issue_choice_quiz_fixture \
    'd5700000-0000-4000-8000-000000000005' \
    'd5600000-0000-4000-8000-000000000006'
)"
race_choice_quiz_completion_ref="$(
  issue_choice_quiz_fixture \
    'd5700000-0000-4000-8000-000000000006' \
    'd5600000-0000-4000-8000-000000000007'
)"
race_choice_quiz_cancel_ref="$(
  issue_choice_quiz_fixture \
    'd5700000-0000-4000-8000-000000000007' \
    'd5600000-0000-4000-8000-000000000008'
)"
race_choice_quiz_cancel_first_ref="$(
  issue_choice_quiz_fixture \
    'd5700000-0000-4000-8000-000000000008' \
    'd5600000-0000-4000-8000-000000000009'
)"
race_choice_quiz_completion_first_ref="$(
  issue_choice_quiz_fixture \
    'd5700000-0000-4000-8000-000000000009' \
    'd5600000-0000-4000-8000-000000000010'
)"
race_choice_quiz_edit_first_ref="$(
  issue_choice_quiz_fixture \
    'd5700000-0000-4000-8000-000000000010' \
    'd5600000-0000-4000-8000-000000000011'
)"
race_choice_quiz_delete_first_ref="$(
  issue_choice_quiz_fixture \
    'd5700000-0000-4000-8000-000000000011' \
    'd5600000-0000-4000-8000-000000000012'
)"

if [[ ! "$race_choice_quiz_same_key_ref" =~ ^cqi_[0-9a-f]{64}$ ]] \
  || [[ ! "$race_choice_quiz_retry_ref" =~ ^cqi_[0-9a-f]{64}$ ]] \
  || [[ ! "$race_choice_quiz_cursor_ref" =~ ^cqi_[0-9a-f]{64}$ ]] \
  || [[ ! "$race_choice_quiz_edit_ref" =~ ^cqi_[0-9a-f]{64}$ ]] \
  || [[ ! "$race_choice_quiz_revoke_ref" =~ ^cqi_[0-9a-f]{64}$ ]] \
  || [[ ! "$race_choice_quiz_completion_ref" =~ ^cqi_[0-9a-f]{64}$ ]] \
  || [[ ! "$race_choice_quiz_cancel_ref" =~ ^cqi_[0-9a-f]{64}$ ]] \
  || [[ ! "$race_choice_quiz_cancel_first_ref" =~ ^cqi_[0-9a-f]{64}$ ]] \
  || [[ ! "$race_choice_quiz_completion_first_ref" =~ ^cqi_[0-9a-f]{64}$ ]] \
  || [[ ! "$race_choice_quiz_edit_first_ref" =~ ^cqi_[0-9a-f]{64}$ ]] \
  || [[ ! "$race_choice_quiz_delete_first_ref" =~ ^cqi_[0-9a-f]{64}$ ]]; then
  echo "LA-M5 Choice Quiz fixtures did not issue exact opaque references." >&2
  exit 1
fi

# Race 24: two real service-role sessions submit the exact same request and
# idempotency key. The waiter must serialize and replay the first result,
# leaving one append-only attempt graph rather than a duplicate.
PGAPPNAME="$race_twenty_four_first_app" \
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 \
  -v issue_ref="$race_choice_quiz_same_key_ref" \
  >"$race_twenty_four_first_log" 2>&1 <<'SQL' &
begin;
set local statement_timeout = '15s';
set local role service_role;
select public.submit_choice_quiz_attempt_admin(
  'cf100000-0000-4000-8000-000000000001',
  'cf110000-0000-4000-8000-000000000001',
  'd5700000-0000-4000-8000-000000000001',
  :'issue_ref',
  1,
  'd5a00000-0000-4000-8000-000000000024',
  array['d5100000-0000-4000-8000-000000000001'::uuid]
);
select pg_sleep(6);
commit;
SQL
race_twenty_four_first_pid=$!

if ! wait_for_sleeping_session \
  "$race_twenty_four_first_app" \
  "$race_twenty_four_first_pid"; then
  echo "Race 24 first submit did not reach its idempotency lock hold." >&2
  print_session_log "Race 24 first-submit log" "$race_twenty_four_first_log"
  exit 1
fi

PGAPPNAME="$race_twenty_four_dedupe_app" \
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 \
  -v issue_ref="$race_choice_quiz_same_key_ref" \
  >"$race_twenty_four_dedupe_log" 2>&1 <<'SQL' &
begin;
set local statement_timeout = '15s';
set local role service_role;
select public.submit_choice_quiz_attempt_admin(
  'cf100000-0000-4000-8000-000000000001',
  'cf110000-0000-4000-8000-000000000001',
  'd5700000-0000-4000-8000-000000000001',
  :'issue_ref',
  1,
  'd5a00000-0000-4000-8000-000000000024',
  array['d5100000-0000-4000-8000-000000000001'::uuid]
);
commit;
SQL
race_twenty_four_dedupe_pid=$!

if ! wait_for_blocked_pair \
  "$race_twenty_four_dedupe_app" \
  "$race_twenty_four_first_app" \
  "$race_twenty_four_dedupe_pid"; then
  echo "Race 24 same-key replay was not observed waiting." >&2
  print_session_log "Race 24 first-submit log" "$race_twenty_four_first_log"
  print_session_log "Race 24 dedupe log" "$race_twenty_four_dedupe_log"
  exit 1
fi

set +e
wait "$race_twenty_four_first_pid"
race_twenty_four_first_status=$?
race_twenty_four_first_pid=""
wait "$race_twenty_four_dedupe_pid"
race_twenty_four_dedupe_status=$?
race_twenty_four_dedupe_pid=""
set -e

if [[ "$race_twenty_four_first_status" -ne 0 ]] \
  || [[ "$race_twenty_four_dedupe_status" -ne 0 ]]; then
  echo "Race 24 same-key submissions did not both finish safely." >&2
  print_session_log "Race 24 first-submit log" "$race_twenty_four_first_log"
  print_session_log "Race 24 dedupe log" "$race_twenty_four_dedupe_log"
  exit 1
fi

race_twenty_four_state="$(
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -Atqc \
    "select case when
       (select count(*) from public.choice_quiz_attempt as attempt
        join public.choice_quiz_issue as issue on issue.id = attempt.issue_id
        where issue.learner_ref = '$race_choice_quiz_same_key_ref') = 1
       and (select count(*) from public.choice_quiz_response as response
        join public.choice_quiz_issue as issue on issue.id = response.issue_id
        where issue.learner_ref = '$race_choice_quiz_same_key_ref') = 1
       and (select count(*) from public.choice_quiz_evaluation as evaluation
        join public.choice_quiz_issue as issue on issue.id = evaluation.issue_id
        where issue.learner_ref = '$race_choice_quiz_same_key_ref') = 1
       and (select count(*) from public.choice_quiz_feedback_delivery as feedback
        join public.choice_quiz_issue as issue on issue.id = feedback.issue_id
        where issue.learner_ref = '$race_choice_quiz_same_key_ref') = 1
       and exists (
         select 1
         from public.choice_quiz_attempt as attempt
         join public.choice_quiz_issue as issue on issue.id = attempt.issue_id
         join public.lesson_component as component
           on component.id = issue.lesson_component_id
         where issue.learner_ref = '$race_choice_quiz_same_key_ref'
           and attempt.idempotency_key =
             'd5a00000-0000-4000-8000-000000000024'
           and component.payload #>> '{options,0,id}' =
             'D5100000-0000-4000-8000-000000000001'
           and component.payload #>> '{options,1,id}' =
             'D5100000-0000-4000-8000-000000000002'
           and issue.learner_definition #>> '{options,0,id}' =
             'd5100000-0000-4000-8000-000000000001'
           and issue.learner_definition #>> '{options,1,id}' =
             'd5100000-0000-4000-8000-000000000002'
           and issue.evaluator_config #>> '{correctOptionIds,0}' =
             'd5100000-0000-4000-8000-000000000001'
           and public.choice_quiz_execution_payload(issue.id)
             #>> '{attemptCount}' = '1'
           and public.choice_quiz_execution_payload(issue.id)
             #>> '{canSubmit}' = 'false'
           and public.choice_quiz_execution_payload(issue.id)
             #>> '{latestFeedback,isCorrect}' = 'true'
       )
     then 'serialized' else '' end"
)"
if [[ "$race_twenty_four_state" != "serialized" ]]; then
  echo "Race 24 lost UUID normalization or split the same-key attempt graph." >&2
  exit 1
fi

# Race 25: a committed same-key replay still owns the transaction-scoped
# idempotency lock. A conflicting payload must wait, then fail with the stable
# conflict token without changing the prior result.
PGAPPNAME="$race_twenty_five_replay_app" \
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 \
  -v issue_ref="$race_choice_quiz_same_key_ref" \
  >"$race_twenty_five_replay_log" 2>&1 <<'SQL' &
begin;
set local statement_timeout = '15s';
set local role service_role;
select public.submit_choice_quiz_attempt_admin(
  'cf100000-0000-4000-8000-000000000001',
  'cf110000-0000-4000-8000-000000000001',
  'd5700000-0000-4000-8000-000000000001',
  :'issue_ref',
  1,
  'd5a00000-0000-4000-8000-000000000024',
  array['d5100000-0000-4000-8000-000000000001'::uuid]
);
select pg_sleep(6);
commit;
SQL
race_twenty_five_replay_pid=$!

if ! wait_for_sleeping_session \
  "$race_twenty_five_replay_app" \
  "$race_twenty_five_replay_pid"; then
  echo "Race 25 replay did not reach its idempotency lock hold." >&2
  print_session_log "Race 25 replay log" "$race_twenty_five_replay_log"
  exit 1
fi

PGAPPNAME="$race_twenty_five_conflict_app" \
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 \
  -v issue_ref="$race_choice_quiz_same_key_ref" \
  >"$race_twenty_five_conflict_log" 2>&1 <<'SQL' &
begin;
set local statement_timeout = '15s';
set local role service_role;
select set_config('shidao.test_issue_ref', :'issue_ref', true);
do $conflict$
begin
  begin
    perform public.submit_choice_quiz_attempt_admin(
      'cf100000-0000-4000-8000-000000000001',
      'cf110000-0000-4000-8000-000000000001',
      'd5700000-0000-4000-8000-000000000001',
      current_setting('shidao.test_issue_ref'),
      1,
      'd5a00000-0000-4000-8000-000000000024',
      array['d5100000-0000-4000-8000-000000000002'::uuid]
    );
    raise exception 'race_25_expected_idempotency_conflict';
  exception
    when sqlstate '23505' then
      if sqlerrm <> 'choice_quiz_idempotency_conflict' then
        raise;
      end if;
  end;
end
$conflict$;
commit;
SQL
race_twenty_five_conflict_pid=$!

if ! wait_for_blocked_pair \
  "$race_twenty_five_conflict_app" \
  "$race_twenty_five_replay_app" \
  "$race_twenty_five_conflict_pid"; then
  echo "Race 25 conflicting payload was not observed waiting." >&2
  print_session_log "Race 25 replay log" "$race_twenty_five_replay_log"
  print_session_log "Race 25 conflict log" "$race_twenty_five_conflict_log"
  exit 1
fi

set +e
wait "$race_twenty_five_replay_pid"
race_twenty_five_replay_status=$?
race_twenty_five_replay_pid=""
wait "$race_twenty_five_conflict_pid"
race_twenty_five_conflict_status=$?
race_twenty_five_conflict_pid=""
set -e

if [[ "$race_twenty_five_replay_status" -ne 0 ]] \
  || [[ "$race_twenty_five_conflict_status" -ne 0 ]]; then
  echo "Race 25 replay/conflict sessions did not finish safely." >&2
  print_session_log "Race 25 replay log" "$race_twenty_five_replay_log"
  print_session_log "Race 25 conflict log" "$race_twenty_five_conflict_log"
  exit 1
fi

race_twenty_five_state="$(
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -Atqc \
    "select case when
       (select count(*) from public.choice_quiz_attempt as attempt
        join public.choice_quiz_issue as issue on issue.id = attempt.issue_id
        where issue.learner_ref = '$race_choice_quiz_same_key_ref') = 1
       and exists (
         select 1
         from public.choice_quiz_response as response
         join public.choice_quiz_issue as issue on issue.id = response.issue_id
         where issue.learner_ref = '$race_choice_quiz_same_key_ref'
           and response.selected_option_ids =
             array['d5100000-0000-4000-8000-000000000001'::uuid]
       )
     then 'serialized' else '' end"
)"
if [[ "$race_twenty_five_state" != "serialized" ]]; then
  echo "Race 25 changed the original request after an idempotency conflict." >&2
  exit 1
fi

# Race 26: different keys for the same practice issue serialize on the issue.
# The first incorrect attempt commits, then the waiting correct retry appends
# attempt 2 with supported-retry semantics rather than overwriting attempt 1.
PGAPPNAME="$race_twenty_six_first_app" \
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 \
  -v issue_ref="$race_choice_quiz_retry_ref" \
  >"$race_twenty_six_first_log" 2>&1 <<'SQL' &
begin;
set local statement_timeout = '15s';
set local role service_role;
select public.submit_choice_quiz_attempt_admin(
  'cf100000-0000-4000-8000-000000000001',
  'cf110000-0000-4000-8000-000000000001',
  'd5700000-0000-4000-8000-000000000002',
  :'issue_ref',
  1,
  'd5a00000-0000-4000-8000-000000000261',
  array['d5100000-0000-4000-8000-000000000002'::uuid]
);
select pg_sleep(6);
commit;
SQL
race_twenty_six_first_pid=$!

if ! wait_for_sleeping_session \
  "$race_twenty_six_first_app" \
  "$race_twenty_six_first_pid"; then
  echo "Race 26 first attempt did not reach its issue lock hold." >&2
  print_session_log "Race 26 first-attempt log" "$race_twenty_six_first_log"
  exit 1
fi

PGAPPNAME="$race_twenty_six_retry_app" \
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 \
  -v issue_ref="$race_choice_quiz_retry_ref" \
  >"$race_twenty_six_retry_log" 2>&1 <<'SQL' &
begin;
set local statement_timeout = '15s';
set local role service_role;
select public.submit_choice_quiz_attempt_admin(
  'cf100000-0000-4000-8000-000000000001',
  'cf110000-0000-4000-8000-000000000001',
  'd5700000-0000-4000-8000-000000000002',
  :'issue_ref',
  1,
  'd5a00000-0000-4000-8000-000000000262',
  array['d5100000-0000-4000-8000-000000000001'::uuid]
);
commit;
SQL
race_twenty_six_retry_pid=$!

if ! wait_for_blocked_pair \
  "$race_twenty_six_retry_app" \
  "$race_twenty_six_first_app" \
  "$race_twenty_six_retry_pid"; then
  echo "Race 26 different-key retry was not observed waiting." >&2
  print_session_log "Race 26 first-attempt log" "$race_twenty_six_first_log"
  print_session_log "Race 26 retry log" "$race_twenty_six_retry_log"
  exit 1
fi

set +e
wait "$race_twenty_six_first_pid"
race_twenty_six_first_status=$?
race_twenty_six_first_pid=""
wait "$race_twenty_six_retry_pid"
race_twenty_six_retry_status=$?
race_twenty_six_retry_pid=""
set -e

if [[ "$race_twenty_six_first_status" -ne 0 ]] \
  || [[ "$race_twenty_six_retry_status" -ne 0 ]]; then
  echo "Race 26 different-key attempts did not both commit." >&2
  print_session_log "Race 26 first-attempt log" "$race_twenty_six_first_log"
  print_session_log "Race 26 retry log" "$race_twenty_six_retry_log"
  exit 1
fi

race_twenty_six_state="$(
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -Atqc \
    "select case when
       (select count(*) from public.choice_quiz_attempt as attempt
        join public.choice_quiz_issue as issue on issue.id = attempt.issue_id
        where issue.learner_ref = '$race_choice_quiz_retry_ref') = 2
       and exists (
         select 1
         from public.choice_quiz_attempt as attempt
         join public.choice_quiz_issue as issue on issue.id = attempt.issue_id
         join public.choice_quiz_evaluation as evaluation
           on evaluation.attempt_id = attempt.id
          and evaluation.evaluation_source = 'initial'
         where issue.learner_ref = '$race_choice_quiz_retry_ref'
           and attempt.attempt_number = 1
           and attempt.support = 'independent'
           and not evaluation.is_correct
       )
       and exists (
         select 1
         from public.choice_quiz_attempt as attempt
         join public.choice_quiz_issue as issue on issue.id = attempt.issue_id
         join public.choice_quiz_evaluation as evaluation
           on evaluation.attempt_id = attempt.id
          and evaluation.evaluation_source = 'initial'
         where issue.learner_ref = '$race_choice_quiz_retry_ref'
           and attempt.attempt_number = 2
           and attempt.support = 'with_support'
           and evaluation.is_correct
           and public.choice_quiz_execution_payload(issue.id)
             #>> '{attemptCount}' = '2'
           and public.choice_quiz_execution_payload(issue.id)
             #>> '{latestFeedback,attemptNumber}' = '2'
           and public.choice_quiz_execution_payload(issue.id)
             #>> '{latestFeedback,isCorrect}' = 'true'
       )
     then 'serialized' else '' end"
)"
if [[ "$race_twenty_six_state" != "serialized" ]]; then
  echo "Race 26 lost append-only retry ordering or support semantics." >&2
  exit 1
fi

# Race 27: submit holds the live Run/presentation/component snapshot through
# commit. A teacher cursor advance must wait and may only become visible after
# the attempt graph is durable, with neither transaction losing its revision.
PGAPPNAME="$race_twenty_seven_submit_app" \
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 \
  -v issue_ref="$race_choice_quiz_cursor_ref" \
  >"$race_twenty_seven_submit_log" 2>&1 <<'SQL' &
begin;
set local statement_timeout = '15s';
set local role service_role;
select public.submit_choice_quiz_attempt_admin(
  'cf100000-0000-4000-8000-000000000001',
  'cf110000-0000-4000-8000-000000000001',
  'd5700000-0000-4000-8000-000000000003',
  :'issue_ref',
  1,
  'd5a00000-0000-4000-8000-000000000027',
  array['d5100000-0000-4000-8000-000000000001'::uuid]
);
select pg_sleep(6);
commit;
SQL
race_twenty_seven_submit_pid=$!

if ! wait_for_sleeping_session \
  "$race_twenty_seven_submit_app" \
  "$race_twenty_seven_submit_pid"; then
  echo "Race 27 submit did not reach its live snapshot lock hold." >&2
  print_session_log "Race 27 submit log" "$race_twenty_seven_submit_log"
  exit 1
fi

PGAPPNAME="$race_twenty_seven_cursor_app" \
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 \
  >"$race_twenty_seven_cursor_log" 2>&1 <<'SQL' &
begin;
set local statement_timeout = '15s';
select set_config(
  'request.jwt.claim.sub',
  'ca100000-0000-4000-8000-000000000001',
  true
);
set local role authenticated;
select public.set_lesson_run_presentation_cursor(
  'd5700000-0000-4000-8000-000000000003',
  'd5550000-0000-4000-8000-000000000004',
  1
);
commit;
SQL
race_twenty_seven_cursor_pid=$!

if ! wait_for_blocked_pair \
  "$race_twenty_seven_cursor_app" \
  "$race_twenty_seven_submit_app" \
  "$race_twenty_seven_cursor_pid"; then
  echo "Race 27 cursor was not observed waiting on Choice Quiz submit." >&2
  print_session_log "Race 27 submit log" "$race_twenty_seven_submit_log"
  print_session_log "Race 27 cursor log" "$race_twenty_seven_cursor_log"
  exit 1
fi

set +e
wait "$race_twenty_seven_submit_pid"
race_twenty_seven_submit_status=$?
race_twenty_seven_submit_pid=""
wait "$race_twenty_seven_cursor_pid"
race_twenty_seven_cursor_status=$?
race_twenty_seven_cursor_pid=""
set -e

if [[ "$race_twenty_seven_submit_status" -ne 0 ]] \
  || [[ "$race_twenty_seven_cursor_status" -ne 0 ]]; then
  echo "Race 27 submit/cursor transactions did not both commit." >&2
  print_session_log "Race 27 submit log" "$race_twenty_seven_submit_log"
  print_session_log "Race 27 cursor log" "$race_twenty_seven_cursor_log"
  exit 1
fi

psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 \
  -v issue_ref="$race_choice_quiz_cursor_ref" >/dev/null <<'SQL'
begin;
set local role service_role;
-- The client lost the committed response while the cursor advanced. The
-- exact persisted key/body replays before current cursor gates.
select public.submit_choice_quiz_attempt_admin(
  'cf100000-0000-4000-8000-000000000001',
  'cf110000-0000-4000-8000-000000000001',
  'd5700000-0000-4000-8000-000000000003',
  :'issue_ref',
  1,
  'd5a00000-0000-4000-8000-000000000027',
  array['d5100000-0000-4000-8000-000000000001'::uuid]
);
select set_config('shidao.test_issue_ref', :'issue_ref', true);
do $new_key_stale$
begin
  begin
    perform public.submit_choice_quiz_attempt_admin(
      'cf100000-0000-4000-8000-000000000001',
      'cf110000-0000-4000-8000-000000000001',
      'd5700000-0000-4000-8000-000000000003',
      current_setting('shidao.test_issue_ref'),
      1,
      'd5a00000-0000-4000-8000-000000000272',
      array['d5100000-0000-4000-8000-000000000001'::uuid]
    );
    raise exception 'race_27_expected_new_key_cursor_stale';
  exception
    when sqlstate '40001' then
      if sqlerrm <> 'choice_quiz_attempt_stale' then
        raise;
      end if;
  end;
end
$new_key_stale$;
commit;
SQL

race_twenty_seven_state="$(
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -Atqc \
    "select case when
       (select count(*) from public.choice_quiz_attempt as attempt
        join public.choice_quiz_issue as issue on issue.id = attempt.issue_id
        where issue.learner_ref = '$race_choice_quiz_cursor_ref') = 1
       and exists (
         select 1
         from public.lesson_run_presentation_state as state
         where state.lesson_run_id =
             'd5700000-0000-4000-8000-000000000003'
           and state.student_slide_id =
             'd5550000-0000-4000-8000-000000000004'
           and state.cursor_version = 2
       )
       and public.resolve_lesson_run_live_source_admin(
         'cf100000-0000-4000-8000-000000000001',
         'cf110000-0000-4000-8000-000000000001',
         'd5700000-0000-4000-8000-000000000003'
       ) #>> '{slide,components,0,payload,content}' =
         'LA_M5_CURSOR_AFTER_SUBMIT'
     then 'serialized' else '' end"
)"
if [[ "$race_twenty_seven_state" != "serialized" ]]; then
  echo "Race 27 lost the attempt graph or committed cursor revision." >&2
  exit 1
fi

# Race 28: submit's shared authored snapshot conflicts with the canonical
# Course -> Lesson -> Component edit order. The edit waits, then commits a new
# component revision; the finished attempt remains immutable and the old issue
# is rejected as stale for any later request.
PGAPPNAME="$race_twenty_eight_submit_app" \
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 \
  -v issue_ref="$race_choice_quiz_edit_ref" \
  >"$race_twenty_eight_submit_log" 2>&1 <<'SQL' &
begin;
set local statement_timeout = '15s';
set local role service_role;
select public.submit_choice_quiz_attempt_admin(
  'cf100000-0000-4000-8000-000000000001',
  'cf110000-0000-4000-8000-000000000001',
  'd5700000-0000-4000-8000-000000000004',
  :'issue_ref',
  1,
  'd5a00000-0000-4000-8000-000000000028',
  array['d5100000-0000-4000-8000-000000000001'::uuid]
);
select pg_sleep(6);
commit;
SQL
race_twenty_eight_submit_pid=$!

if ! wait_for_sleeping_session \
  "$race_twenty_eight_submit_app" \
  "$race_twenty_eight_submit_pid"; then
  echo "Race 28 submit did not reach its component snapshot lock hold." >&2
  print_session_log "Race 28 submit log" "$race_twenty_eight_submit_log"
  exit 1
fi

PGAPPNAME="$race_twenty_eight_edit_app" \
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 \
  >"$race_twenty_eight_edit_log" 2>&1 <<'SQL' &
begin;
set local statement_timeout = '15s';
select set_config(
  'request.jwt.claim.sub',
  'ca100000-0000-4000-8000-000000000001',
  true
);
set local role authenticated;
select count(*)
from public.update_lesson_component_v2(
  'd5600000-0000-4000-8000-000000000005',
  '{"question":"Choose Alpha after the edit.","allowMultiple":false,"options":[{"id":"d5100000-0000-4000-8000-000000000001","label":"Alpha","isCorrect":true},{"id":"d5100000-0000-4000-8000-000000000002","label":"Beta","isCorrect":false}],"explanation":"Alpha remains the exact answer."}'::jsonb,
  true,
  null,
  false,
  null,
  false,
  null,
  false
);
commit;
SQL
race_twenty_eight_edit_pid=$!

if ! wait_for_blocked_pair \
  "$race_twenty_eight_edit_app" \
  "$race_twenty_eight_submit_app" \
  "$race_twenty_eight_edit_pid"; then
  echo "Race 28 component edit was not observed waiting on submit." >&2
  print_session_log "Race 28 submit log" "$race_twenty_eight_submit_log"
  print_session_log "Race 28 edit log" "$race_twenty_eight_edit_log"
  exit 1
fi

set +e
wait "$race_twenty_eight_submit_pid"
race_twenty_eight_submit_status=$?
race_twenty_eight_submit_pid=""
wait "$race_twenty_eight_edit_pid"
race_twenty_eight_edit_status=$?
race_twenty_eight_edit_pid=""
set -e

if [[ "$race_twenty_eight_submit_status" -ne 0 ]] \
  || [[ "$race_twenty_eight_edit_status" -ne 0 ]]; then
  echo "Race 28 submit/component-edit transactions did not both commit." >&2
  print_session_log "Race 28 submit log" "$race_twenty_eight_submit_log"
  print_session_log "Race 28 edit log" "$race_twenty_eight_edit_log"
  exit 1
fi

psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 \
  -v issue_ref="$race_choice_quiz_edit_ref" >/dev/null <<'SQL'
begin;
set local role service_role;
select set_config('shidao.test_issue_ref', :'issue_ref', true);
do $stale$
begin
  begin
    perform public.submit_choice_quiz_attempt_admin(
      'cf100000-0000-4000-8000-000000000001',
      'cf110000-0000-4000-8000-000000000001',
      'd5700000-0000-4000-8000-000000000004',
      current_setting('shidao.test_issue_ref'),
      1,
      'd5a00000-0000-4000-8000-000000000281',
      array['d5100000-0000-4000-8000-000000000002'::uuid]
    );
    raise exception 'race_28_expected_stale_issue';
  exception
    when sqlstate '40001' then
      if sqlerrm <> 'choice_quiz_attempt_stale' then
        raise;
      end if;
  end;
end
$stale$;
commit;
SQL

race_twenty_eight_state="$(
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -Atqc \
    "select case when
       (select count(*) from public.choice_quiz_attempt as attempt
        join public.choice_quiz_issue as issue on issue.id = attempt.issue_id
        where issue.learner_ref = '$race_choice_quiz_edit_ref') = 1
       and exists (
         select 1
         from public.choice_quiz_issue as issue
         join public.lesson_component as component
           on component.id = issue.lesson_component_id
         where issue.learner_ref = '$race_choice_quiz_edit_ref'
           and component.payload ->> 'question' =
             'Choose Alpha after the edit.'
           and component.updated_at <> issue.component_updated_at
       )
     then 'serialized' else '' end"
)"
if [[ "$race_twenty_eight_state" != "serialized" ]]; then
  echo "Race 28 lost history or failed to commit a distinct authored revision." >&2
  exit 1
fi

# Race 28b: an accepted submit holds the learner and Run snapshot until
# commit. Canonical completion must wait, then finalize the Run and attendance
# without losing the immutable quiz history. Its exact lost-response replay
# remains available, while every later new-key submit sees ended state and
# fails with the stable stale token.
PGAPPNAME="$race_twenty_eight_b_submit_app" \
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 \
  -v issue_ref="$race_choice_quiz_completion_ref" \
  >"$race_twenty_eight_b_submit_log" 2>&1 <<'SQL' &
begin;
set local statement_timeout = '15s';
set local role service_role;
select public.submit_choice_quiz_attempt_admin(
  'cf100000-0000-4000-8000-000000000001',
  'cf110000-0000-4000-8000-000000000001',
  'd5700000-0000-4000-8000-000000000006',
  :'issue_ref',
  1,
  'd5a00000-0000-4000-8000-000000000282',
  array['d5100000-0000-4000-8000-000000000001'::uuid]
);
select pg_sleep(6);
commit;
SQL
race_twenty_eight_b_submit_pid=$!

if ! wait_for_sleeping_session \
  "$race_twenty_eight_b_submit_app" \
  "$race_twenty_eight_b_submit_pid"; then
  echo "Race 28b submit did not reach its Run snapshot lock hold." >&2
  print_session_log \
    "Race 28b submit log" \
    "$race_twenty_eight_b_submit_log"
  exit 1
fi

PGAPPNAME="$race_twenty_eight_b_completion_app" \
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 \
  >"$race_twenty_eight_b_completion_log" 2>&1 <<'SQL' &
begin;
set local statement_timeout = '15s';
select set_config(
  'request.jwt.claim.sub',
  'ca100000-0000-4000-8000-000000000001',
  true
);
set local role authenticated;
select public.complete_lesson_run_v2(
  'd5700000-0000-4000-8000-000000000006',
  '[{"learnerProfileId":"cf300000-0000-4000-8000-000000000001","wasPresent":true}]'::jsonb,
  'Race 28b completion after accepted Choice Quiz submit',
  '2026-08-21 20:50:00+09',
  45
);
commit;
SQL
race_twenty_eight_b_completion_pid=$!

if ! wait_for_blocked_pair \
  "$race_twenty_eight_b_completion_app" \
  "$race_twenty_eight_b_submit_app" \
  "$race_twenty_eight_b_completion_pid"; then
  echo "Race 28b completion was not observed waiting on submit." >&2
  print_session_log \
    "Race 28b submit log" \
    "$race_twenty_eight_b_submit_log"
  print_session_log \
    "Race 28b completion log" \
    "$race_twenty_eight_b_completion_log"
  exit 1
fi

set +e
wait "$race_twenty_eight_b_submit_pid"
race_twenty_eight_b_submit_status=$?
race_twenty_eight_b_submit_pid=""
wait "$race_twenty_eight_b_completion_pid"
race_twenty_eight_b_completion_status=$?
race_twenty_eight_b_completion_pid=""
set -e

if [[ "$race_twenty_eight_b_submit_status" -ne 0 ]] \
  || [[ "$race_twenty_eight_b_completion_status" -ne 0 ]]; then
  echo "Race 28b submit/completion transactions did not both commit." >&2
  print_session_log \
    "Race 28b submit log" \
    "$race_twenty_eight_b_submit_log"
  print_session_log \
    "Race 28b completion log" \
    "$race_twenty_eight_b_completion_log"
  exit 1
fi

psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 \
  -v issue_ref="$race_choice_quiz_completion_ref" >/dev/null <<'SQL'
begin;
set local role service_role;
-- Replay the response lost while completion waited; persisted identity and
-- fingerprint match, so ended-Run gates do not apply to this exact key/body.
select public.submit_choice_quiz_attempt_admin(
  'cf100000-0000-4000-8000-000000000001',
  'cf110000-0000-4000-8000-000000000001',
  'd5700000-0000-4000-8000-000000000006',
  :'issue_ref',
  1,
  'd5a00000-0000-4000-8000-000000000282',
  array['d5100000-0000-4000-8000-000000000001'::uuid]
);
select set_config('shidao.test_issue_ref', :'issue_ref', true);
do $ended$
begin
  begin
    perform public.submit_choice_quiz_attempt_admin(
      'cf100000-0000-4000-8000-000000000001',
      'cf110000-0000-4000-8000-000000000001',
      'd5700000-0000-4000-8000-000000000006',
      current_setting('shidao.test_issue_ref'),
      1,
      'd5a00000-0000-4000-8000-000000000284',
      array['d5100000-0000-4000-8000-000000000002'::uuid]
    );
    raise exception 'race_28b_expected_ended_submit_denial';
  exception
    when sqlstate '40001' then
      if sqlerrm <> 'choice_quiz_attempt_stale' then
        raise;
      end if;
  end;
end
$ended$;
commit;
SQL

race_twenty_eight_b_state="$(
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -Atqc \
    "select case when
       exists (
         select 1
         from public.lesson_run as run
         where run.id = 'd5700000-0000-4000-8000-000000000006'
           and run.ended_at = '2026-08-21 20:50:00+09'::timestamptz
           and run.cancelled_at is null
       )
       and exists (
         select 1
         from public.learning_record as record
         where record.id = 'd5800000-0000-4000-8000-000000000006'
           and record.occurred_at =
             '2026-08-21 20:50:00+09'::timestamptz
       )
       and (select count(*) from public.choice_quiz_attempt as attempt
        join public.choice_quiz_issue as issue on issue.id = attempt.issue_id
        where issue.learner_ref = '$race_choice_quiz_completion_ref') = 1
       and exists (
         select 1
         from public.choice_quiz_evaluation as evaluation
         join public.choice_quiz_issue as issue
           on issue.id = evaluation.issue_id
         where issue.learner_ref = '$race_choice_quiz_completion_ref'
           and evaluation.evaluation_source = 'initial'
           and evaluation.is_correct
       )
       and public.resolve_lesson_run_live_source_admin(
         'cf100000-0000-4000-8000-000000000001',
         'cf110000-0000-4000-8000-000000000001',
         'd5700000-0000-4000-8000-000000000006'
       ) = '{\"state\": \"ended\"}'::jsonb
       and public.list_choice_quiz_run_history_admin(
         'ca100000-0000-4000-8000-000000000001',
         'ca110000-0000-4000-8000-000000000002',
         'd5700000-0000-4000-8000-000000000006'
       ) #>> '{items,0,issueRef}' = '$race_choice_quiz_completion_ref'
       and public.list_choice_quiz_run_history_admin(
         'ca100000-0000-4000-8000-000000000001',
         'ca110000-0000-4000-8000-000000000002',
         'd5700000-0000-4000-8000-000000000006'
       ) #>> '{items,0,isCorrect}' = 'true'
       and jsonb_array_length(public.list_choice_quiz_run_history_admin(
         'ca100000-0000-4000-8000-000000000001',
         'ca110000-0000-4000-8000-000000000002',
         'd5700000-0000-4000-8000-000000000006'
       ) -> 'items') = 1
     then 'serialized' else '' end"
)"
if [[ "$race_twenty_eight_b_state" != "serialized" ]]; then
  echo "Race 28b lost completion state or teacher history." >&2
  exit 1
fi

# Race 28c: the same accepted-submit-first schedule forces cancellation to
# wait. Cancellation then detaches the issued activity, removes the draft
# LearningRecord, closes the Run, and preserves append-only quiz history. The
# first answer is deliberately wrong, so the later distinct-key denial proves
# ended-Run lifecycle validation rather than correct-answer or max-attempt
# policy.
PGAPPNAME="$race_twenty_eight_c_submit_app" \
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 \
  -v issue_ref="$race_choice_quiz_cancel_ref" \
  >"$race_twenty_eight_c_submit_log" 2>&1 <<'SQL' &
begin;
set local statement_timeout = '15s';
set local role service_role;
select public.submit_choice_quiz_attempt_admin(
  'cf100000-0000-4000-8000-000000000001',
  'cf110000-0000-4000-8000-000000000001',
  'd5700000-0000-4000-8000-000000000007',
  :'issue_ref',
  1,
  'd5a00000-0000-4000-8000-000000000283',
  array['d5100000-0000-4000-8000-000000000002'::uuid]
);
select pg_sleep(6);
commit;
SQL
race_twenty_eight_c_submit_pid=$!

if ! wait_for_sleeping_session \
  "$race_twenty_eight_c_submit_app" \
  "$race_twenty_eight_c_submit_pid"; then
  echo "Race 28c submit did not reach its Run/record lock hold." >&2
  print_session_log \
    "Race 28c submit log" \
    "$race_twenty_eight_c_submit_log"
  exit 1
fi

PGAPPNAME="$race_twenty_eight_c_cancel_app" \
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 \
  >"$race_twenty_eight_c_cancel_log" 2>&1 <<'SQL' &
begin;
set local statement_timeout = '15s';
select set_config(
  'request.jwt.claim.sub',
  'ca100000-0000-4000-8000-000000000001',
  true
);
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', 'ca100000-0000-4000-8000-000000000001',
    'session_id', 'ca110000-0000-4000-8000-000000000002',
    'role', 'authenticated'
  )::text,
  true
);
set local role authenticated;
select public.cancel_lesson_run(
  'd5700000-0000-4000-8000-000000000007',
  '2026-08-21 21:30:00+09'
);
commit;
SQL
race_twenty_eight_c_cancel_pid=$!

if ! wait_for_blocked_pair \
  "$race_twenty_eight_c_cancel_app" \
  "$race_twenty_eight_c_submit_app" \
  "$race_twenty_eight_c_cancel_pid"; then
  echo "Race 28c cancellation was not observed waiting on submit." >&2
  print_session_log \
    "Race 28c submit log" \
    "$race_twenty_eight_c_submit_log"
  print_session_log \
    "Race 28c cancellation log" \
    "$race_twenty_eight_c_cancel_log"
  exit 1
fi

set +e
wait "$race_twenty_eight_c_submit_pid"
race_twenty_eight_c_submit_status=$?
race_twenty_eight_c_submit_pid=""
wait "$race_twenty_eight_c_cancel_pid"
race_twenty_eight_c_cancel_status=$?
race_twenty_eight_c_cancel_pid=""
set -e

if [[ "$race_twenty_eight_c_submit_status" -ne 0 ]] \
  || [[ "$race_twenty_eight_c_cancel_status" -ne 0 ]]; then
  echo "Race 28c submit/cancellation transactions did not both commit." >&2
  print_session_log \
    "Race 28c submit log" \
    "$race_twenty_eight_c_submit_log"
  print_session_log \
    "Race 28c cancellation log" \
    "$race_twenty_eight_c_cancel_log"
  exit 1
fi

psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 \
  -v issue_ref="$race_choice_quiz_cancel_ref" >/dev/null <<'SQL'
begin;
set local role service_role;
-- Cancellation won after the original wrong attempt committed. Its exact
-- lost-response replay succeeds, while the distinct key below remains stale.
select public.submit_choice_quiz_attempt_admin(
  'cf100000-0000-4000-8000-000000000001',
  'cf110000-0000-4000-8000-000000000001',
  'd5700000-0000-4000-8000-000000000007',
  :'issue_ref',
  1,
  'd5a00000-0000-4000-8000-000000000283',
  array['d5100000-0000-4000-8000-000000000002'::uuid]
);
select set_config('shidao.test_issue_ref', :'issue_ref', true);
do $retry$
begin
  begin
    perform public.submit_choice_quiz_attempt_admin(
      'cf100000-0000-4000-8000-000000000001',
      'cf110000-0000-4000-8000-000000000001',
      'd5700000-0000-4000-8000-000000000007',
      current_setting('shidao.test_issue_ref'),
      1,
      'd5a00000-0000-4000-8000-000000000285',
      array['d5100000-0000-4000-8000-000000000002'::uuid]
    );
    raise exception 'race_28c_expected_retry_denial';
  exception
    when sqlstate '40001' then
      if sqlerrm <> 'choice_quiz_attempt_stale' then
        raise;
      end if;
  end;
end
$retry$;
commit;
SQL

race_twenty_eight_c_state="$(
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -Atqc \
    "select case when
       exists (
         select 1
         from public.lesson_run as run
         where run.id = 'd5700000-0000-4000-8000-000000000007'
           and run.ended_at is null
           and run.cancelled_at =
             '2026-08-21 21:30:00+09'::timestamptz
       )
       and not exists (
         select 1
         from public.learning_record as record
         where record.id = 'd5800000-0000-4000-8000-000000000007'
       )
       and exists (
         select 1
         from public.choice_quiz_issue as issue
         where issue.learner_ref = '$race_choice_quiz_cancel_ref'
           and issue.learning_record_id is null
           and issue.lesson_component_id is null
           and issue.learning_objective_id is null
       )
       and (select count(*) from public.choice_quiz_attempt as attempt
        join public.choice_quiz_issue as issue on issue.id = attempt.issue_id
        where issue.learner_ref = '$race_choice_quiz_cancel_ref') = 1
       and exists (
         select 1
         from public.choice_quiz_evaluation as evaluation
         join public.choice_quiz_issue as issue
           on issue.id = evaluation.issue_id
         where issue.learner_ref = '$race_choice_quiz_cancel_ref'
           and evaluation.evaluation_source = 'initial'
           and not evaluation.is_correct
       )
       and public.resolve_lesson_run_live_source_admin(
         'cf100000-0000-4000-8000-000000000001',
         'cf110000-0000-4000-8000-000000000001',
         'd5700000-0000-4000-8000-000000000007'
       ) = '{\"state\": \"ended\"}'::jsonb
       and public.list_choice_quiz_run_history_admin(
         'ca100000-0000-4000-8000-000000000001',
         'ca110000-0000-4000-8000-000000000002',
         'd5700000-0000-4000-8000-000000000007'
       ) #>> '{items,0,issueRef}' = '$race_choice_quiz_cancel_ref'
       and public.list_choice_quiz_run_history_admin(
         'ca100000-0000-4000-8000-000000000001',
         'ca110000-0000-4000-8000-000000000002',
         'd5700000-0000-4000-8000-000000000007'
       ) #>> '{items,0,isCorrect}' = 'false'
       and jsonb_array_length(public.list_choice_quiz_run_history_admin(
         'ca100000-0000-4000-8000-000000000001',
         'ca110000-0000-4000-8000-000000000002',
         'd5700000-0000-4000-8000-000000000007'
       ) -> 'items') = 1
     then 'serialized' else '' end"
)"
if [[ "$race_twenty_eight_c_state" != "serialized" ]]; then
  echo "Race 28c lost cancellation state or durable teacher history." >&2
  exit 1
fi

# Race 28d: instrument the current canonical cancel-first hierarchy by holding
# the exact Course row before cancel reaches Lesson/Run. Submit must wait on
# Course without first owning Lesson/Run; after cancellation commits it resumes
# and rejects stale, proving the Course -> Lesson -> Run order serializes both.
PGAPPNAME="$race_twenty_eight_d_cancel_app" \
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 \
  >"$race_twenty_eight_d_cancel_log" 2>&1 <<'SQL' &
begin;
set local statement_timeout = '15s';
select course.id
from public.course as course
where course.id = 'd5400000-0000-4000-8000-000000000001'
for update of course;
select pg_sleep(6);
select set_config(
  'request.jwt.claim.sub',
  'ca100000-0000-4000-8000-000000000001',
  true
);
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', 'ca100000-0000-4000-8000-000000000001',
    'session_id', 'ca110000-0000-4000-8000-000000000002',
    'role', 'authenticated'
  )::text,
  true
);
set local role authenticated;
select public.cancel_lesson_run(
  'd5700000-0000-4000-8000-000000000008',
  '2026-08-21 22:30:00+09'
);
commit;
SQL
race_twenty_eight_d_cancel_pid=$!

if ! wait_for_sleeping_session \
  "$race_twenty_eight_d_cancel_app" \
  "$race_twenty_eight_d_cancel_pid"; then
  echo "Race 28d cancellation did not reach its Course-only lock hold." >&2
  print_session_log \
    "Race 28d cancellation log" \
    "$race_twenty_eight_d_cancel_log"
  exit 1
fi

PGAPPNAME="$race_twenty_eight_d_submit_app" \
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 \
  -v issue_ref="$race_choice_quiz_cancel_first_ref" \
  >"$race_twenty_eight_d_submit_log" 2>&1 <<'SQL' &
\set VERBOSITY verbose
begin;
set local statement_timeout = '15s';
set local role service_role;
select public.submit_choice_quiz_attempt_admin(
  'cf100000-0000-4000-8000-000000000001',
  'cf110000-0000-4000-8000-000000000001',
  'd5700000-0000-4000-8000-000000000008',
  :'issue_ref',
  1,
  'd5a00000-0000-4000-8000-000000000286',
  array['d5100000-0000-4000-8000-000000000001'::uuid]
);
commit;
SQL
race_twenty_eight_d_submit_pid=$!

if ! wait_for_blocked_pair \
  "$race_twenty_eight_d_submit_app" \
  "$race_twenty_eight_d_cancel_app" \
  "$race_twenty_eight_d_submit_pid"; then
  echo "Race 28d submit was not observed waiting on cancellation's Course lock." >&2
  print_session_log \
    "Race 28d cancellation log" \
    "$race_twenty_eight_d_cancel_log"
  print_session_log \
    "Race 28d submit log" \
    "$race_twenty_eight_d_submit_log"
  exit 1
fi

set +e
wait "$race_twenty_eight_d_cancel_pid"
race_twenty_eight_d_cancel_status=$?
race_twenty_eight_d_cancel_pid=""
wait "$race_twenty_eight_d_submit_pid"
race_twenty_eight_d_submit_status=$?
race_twenty_eight_d_submit_pid=""
set -e

race_twenty_eight_d_submit_output="$(<"$race_twenty_eight_d_submit_log")"
if [[ "$race_twenty_eight_d_cancel_status" -ne 0 ]]; then
  echo "Race 28d cancellation transaction failed unexpectedly." >&2
  print_session_log \
    "Race 28d cancellation log" \
    "$race_twenty_eight_d_cancel_log"
  print_session_log \
    "Race 28d submit log" \
    "$race_twenty_eight_d_submit_log"
  exit 1
fi
if [[ "$race_twenty_eight_d_submit_status" -eq 0 ]] \
  || [[ "$race_twenty_eight_d_submit_output" != \
    *"40001: choice_quiz_attempt_stale"* ]]; then
  echo "Race 28d submit did not fail with the post-cancel stale contract." >&2
  print_session_log \
    "Race 28d cancellation log" \
    "$race_twenty_eight_d_cancel_log"
  print_session_log \
    "Race 28d submit log" \
    "$race_twenty_eight_d_submit_log"
  exit 1
fi

race_twenty_eight_d_state="$(
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -Atqc \
    "select case when
       exists (
         select 1
         from public.lesson_run as run
         where run.id = 'd5700000-0000-4000-8000-000000000008'
           and run.ended_at is null
           and run.cancelled_at =
             '2026-08-21 22:30:00+09'::timestamptz
       )
       and not exists (
         select 1
         from public.learning_record as record
         where record.id = 'd5800000-0000-4000-8000-000000000008'
       )
       and exists (
         select 1
         from public.choice_quiz_issue as issue
         where issue.learner_ref = '$race_choice_quiz_cancel_first_ref'
           and issue.learning_record_id is null
           and issue.lesson_component_id is null
           and issue.learning_objective_id is null
       )
       and not exists (
         select 1
         from public.choice_quiz_attempt as attempt
         join public.choice_quiz_issue as issue on issue.id = attempt.issue_id
         where issue.learner_ref = '$race_choice_quiz_cancel_first_ref'
       )
       and not exists (
         select 1
         from public.choice_quiz_evaluation as evaluation
         join public.choice_quiz_issue as issue
           on issue.id = evaluation.issue_id
         where issue.learner_ref = '$race_choice_quiz_cancel_first_ref'
       )
       and public.resolve_lesson_run_live_source_admin(
         'cf100000-0000-4000-8000-000000000001',
         'cf110000-0000-4000-8000-000000000001',
         'd5700000-0000-4000-8000-000000000008'
       ) = '{\"state\": \"ended\"}'::jsonb
       and jsonb_array_length(public.list_choice_quiz_run_history_admin(
         'ca100000-0000-4000-8000-000000000001',
         'ca110000-0000-4000-8000-000000000002',
         'd5700000-0000-4000-8000-000000000008'
       ) -> 'items') = 0
     then 'serialized' else '' end"
)"
if [[ "$race_twenty_eight_d_state" != "serialized" ]]; then
  echo "Race 28d lost cancellation state or appended a rejected attempt." >&2
  exit 1
fi

# Race 28e: instrument the reverse completion-first order by holding the exact
# learner advisory before completion reaches Lesson/Run. Submit must wait on
# that advisory without retaining Lesson; completion then finalizes the Run,
# and the resumed submit rejects stale instead of forming an advisory/Lesson
# deadlock or appending a response after completion.
PGAPPNAME="$race_twenty_eight_e_completion_app" \
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 \
  >"$race_twenty_eight_e_completion_log" 2>&1 <<'SQL' &
begin;
set local statement_timeout = '15s';
select public.lock_learning_activity_learners(
  array['cf300000-0000-4000-8000-000000000001'::uuid]
);
select pg_sleep(6);
select set_config(
  'request.jwt.claim.sub',
  'ca100000-0000-4000-8000-000000000001',
  true
);
set local role authenticated;
select public.complete_lesson_run_v2(
  'd5700000-0000-4000-8000-000000000009',
  '[{"learnerProfileId":"cf300000-0000-4000-8000-000000000001","wasPresent":true}]'::jsonb,
  'Race 28e completion before Choice Quiz submit',
  '2026-08-21 23:50:00+09',
  45
);
commit;
SQL
race_twenty_eight_e_completion_pid=$!

if ! wait_for_sleeping_session \
  "$race_twenty_eight_e_completion_app" \
  "$race_twenty_eight_e_completion_pid"; then
  echo "Race 28e completion did not reach its learner-advisory hold." >&2
  print_session_log \
    "Race 28e completion log" \
    "$race_twenty_eight_e_completion_log"
  exit 1
fi

PGAPPNAME="$race_twenty_eight_e_submit_app" \
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 \
  -v issue_ref="$race_choice_quiz_completion_first_ref" \
  >"$race_twenty_eight_e_submit_log" 2>&1 <<'SQL' &
\set VERBOSITY verbose
begin;
set local statement_timeout = '15s';
set local role service_role;
select public.submit_choice_quiz_attempt_admin(
  'cf100000-0000-4000-8000-000000000001',
  'cf110000-0000-4000-8000-000000000001',
  'd5700000-0000-4000-8000-000000000009',
  :'issue_ref',
  1,
  'd5a00000-0000-4000-8000-000000000287',
  array['d5100000-0000-4000-8000-000000000001'::uuid]
);
commit;
SQL
race_twenty_eight_e_submit_pid=$!

if ! wait_for_blocked_pair \
  "$race_twenty_eight_e_submit_app" \
  "$race_twenty_eight_e_completion_app" \
  "$race_twenty_eight_e_submit_pid"; then
  echo "Race 28e submit was not observed waiting on completion's learner advisory." >&2
  print_session_log \
    "Race 28e completion log" \
    "$race_twenty_eight_e_completion_log"
  print_session_log \
    "Race 28e submit log" \
    "$race_twenty_eight_e_submit_log"
  exit 1
fi

set +e
wait "$race_twenty_eight_e_completion_pid"
race_twenty_eight_e_completion_status=$?
race_twenty_eight_e_completion_pid=""
wait "$race_twenty_eight_e_submit_pid"
race_twenty_eight_e_submit_status=$?
race_twenty_eight_e_submit_pid=""
set -e

race_twenty_eight_e_submit_output="$(<"$race_twenty_eight_e_submit_log")"
if [[ "$race_twenty_eight_e_completion_status" -ne 0 ]]; then
  echo "Race 28e completion transaction failed unexpectedly." >&2
  print_session_log \
    "Race 28e completion log" \
    "$race_twenty_eight_e_completion_log"
  print_session_log \
    "Race 28e submit log" \
    "$race_twenty_eight_e_submit_log"
  exit 1
fi
if [[ "$race_twenty_eight_e_submit_status" -eq 0 ]] \
  || [[ "$race_twenty_eight_e_submit_output" != \
    *"40001: choice_quiz_attempt_stale"* ]]; then
  echo "Race 28e submit did not fail with the post-completion stale contract." >&2
  print_session_log \
    "Race 28e completion log" \
    "$race_twenty_eight_e_completion_log"
  print_session_log \
    "Race 28e submit log" \
    "$race_twenty_eight_e_submit_log"
  exit 1
fi

race_twenty_eight_e_state="$(
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -Atqc \
    "select case when
       exists (
         select 1
         from public.lesson_run as run
         where run.id = 'd5700000-0000-4000-8000-000000000009'
           and run.ended_at =
             '2026-08-21 23:50:00+09'::timestamptz
           and run.cancelled_at is null
       )
       and exists (
         select 1
         from public.learning_record as record
         where record.id = 'd5800000-0000-4000-8000-000000000009'
           and record.occurred_at =
             '2026-08-21 23:50:00+09'::timestamptz
       )
       and exists (
         select 1
         from public.choice_quiz_issue as issue
         where issue.learner_ref = '$race_choice_quiz_completion_first_ref'
           and issue.learning_record_id =
             'd5800000-0000-4000-8000-000000000009'
       )
       and not exists (
         select 1
         from public.choice_quiz_attempt as attempt
         join public.choice_quiz_issue as issue on issue.id = attempt.issue_id
         where issue.learner_ref = '$race_choice_quiz_completion_first_ref'
       )
       and not exists (
         select 1
         from public.choice_quiz_evaluation as evaluation
         join public.choice_quiz_issue as issue
           on issue.id = evaluation.issue_id
         where issue.learner_ref = '$race_choice_quiz_completion_first_ref'
       )
       and public.resolve_lesson_run_live_source_admin(
         'cf100000-0000-4000-8000-000000000001',
         'cf110000-0000-4000-8000-000000000001',
         'd5700000-0000-4000-8000-000000000009'
       ) = '{\"state\": \"ended\"}'::jsonb
       and jsonb_array_length(public.list_choice_quiz_run_history_admin(
         'ca100000-0000-4000-8000-000000000001',
         'ca110000-0000-4000-8000-000000000002',
         'd5700000-0000-4000-8000-000000000009'
       ) -> 'items') = 0
     then 'serialized' else '' end"
)"
if [[ "$race_twenty_eight_e_state" != "serialized" ]]; then
  echo "Race 28e lost completion state or appended a rejected attempt." >&2
  exit 1
fi

# Race 28f: reverse the authored-edit overlap. The canonical edit owns Course,
# Lesson and Component before submit begins. Submit must wait without holding
# Issue, then observe the committed definition revision and fail stale rather
# than deadlocking or appending a response against the old issued definition.
PGAPPNAME="$race_twenty_eight_f_edit_app" \
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 \
  >"$race_twenty_eight_f_edit_log" 2>&1 <<'SQL' &
begin;
set local statement_timeout = '15s';
select set_config(
  'request.jwt.claim.sub',
  'ca100000-0000-4000-8000-000000000001',
  true
);
set local role authenticated;
select count(*)
from public.update_lesson_component_v2(
  'd5600000-0000-4000-8000-000000000011',
  '{"question":"Choose Alpha after the edit-first commit.","allowMultiple":false,"options":[{"id":"d5100000-0000-4000-8000-000000000001","label":"Alpha","isCorrect":true},{"id":"d5100000-0000-4000-8000-000000000002","label":"Beta","isCorrect":false}],"explanation":"The committed edit invalidates the old issue."}'::jsonb,
  true,
  null,
  false,
  null,
  false,
  null,
  false
);
select pg_sleep(6);
commit;
SQL
race_twenty_eight_f_edit_pid=$!

if ! wait_for_sleeping_session \
  "$race_twenty_eight_f_edit_app" \
  "$race_twenty_eight_f_edit_pid"; then
  echo "Race 28f edit did not reach its canonical authored lock hold." >&2
  print_session_log \
    "Race 28f edit log" \
    "$race_twenty_eight_f_edit_log"
  exit 1
fi

PGAPPNAME="$race_twenty_eight_f_submit_app" \
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 \
  -v issue_ref="$race_choice_quiz_edit_first_ref" \
  >"$race_twenty_eight_f_submit_log" 2>&1 <<'SQL' &
\set VERBOSITY verbose
begin;
set local statement_timeout = '15s';
set local role service_role;
select public.submit_choice_quiz_attempt_admin(
  'cf100000-0000-4000-8000-000000000001',
  'cf110000-0000-4000-8000-000000000001',
  'd5700000-0000-4000-8000-000000000010',
  :'issue_ref',
  1,
  'd5a00000-0000-4000-8000-000000000288',
  array['d5100000-0000-4000-8000-000000000001'::uuid]
);
commit;
SQL
race_twenty_eight_f_submit_pid=$!

if ! wait_for_blocked_pair \
  "$race_twenty_eight_f_submit_app" \
  "$race_twenty_eight_f_edit_app" \
  "$race_twenty_eight_f_submit_pid"; then
  echo "Race 28f submit was not observed waiting on edit-first locks." >&2
  print_session_log \
    "Race 28f edit log" \
    "$race_twenty_eight_f_edit_log"
  print_session_log \
    "Race 28f submit log" \
    "$race_twenty_eight_f_submit_log"
  exit 1
fi

set +e
wait "$race_twenty_eight_f_edit_pid"
race_twenty_eight_f_edit_status=$?
race_twenty_eight_f_edit_pid=""
wait "$race_twenty_eight_f_submit_pid"
race_twenty_eight_f_submit_status=$?
race_twenty_eight_f_submit_pid=""
set -e

race_twenty_eight_f_submit_output="$(<"$race_twenty_eight_f_submit_log")"
if [[ "$race_twenty_eight_f_edit_status" -ne 0 ]]; then
  echo "Race 28f authored edit transaction failed unexpectedly." >&2
  print_session_log \
    "Race 28f edit log" \
    "$race_twenty_eight_f_edit_log"
  print_session_log \
    "Race 28f submit log" \
    "$race_twenty_eight_f_submit_log"
  exit 1
fi
if [[ "$race_twenty_eight_f_submit_status" -eq 0 ]] \
  || [[ "$race_twenty_eight_f_submit_output" != \
    *"40001: choice_quiz_attempt_stale"* ]]; then
  echo "Race 28f submit did not fail with committed-edit stale state." >&2
  print_session_log \
    "Race 28f edit log" \
    "$race_twenty_eight_f_edit_log"
  print_session_log \
    "Race 28f submit log" \
    "$race_twenty_eight_f_submit_log"
  exit 1
fi

race_twenty_eight_f_state="$(
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -Atqc \
    "select case when
       exists (
         select 1
         from public.choice_quiz_issue as issue
         join public.lesson_component as component
           on component.id = issue.lesson_component_id
         where issue.learner_ref = '$race_choice_quiz_edit_first_ref'
           and component.payload ->> 'question' =
             'Choose Alpha after the edit-first commit.'
           and component.updated_at <> issue.component_updated_at
       )
       and not exists (
         select 1
         from public.choice_quiz_attempt as attempt
         join public.choice_quiz_issue as issue on issue.id = attempt.issue_id
         where issue.learner_ref = '$race_choice_quiz_edit_first_ref'
       )
       and not exists (
         select 1
         from public.choice_quiz_evaluation as evaluation
         join public.choice_quiz_issue as issue on issue.id = evaluation.issue_id
         where issue.learner_ref = '$race_choice_quiz_edit_first_ref'
       )
       and jsonb_array_length(public.list_choice_quiz_run_history_admin(
         'ca100000-0000-4000-8000-000000000001',
         'ca110000-0000-4000-8000-000000000002',
         'd5700000-0000-4000-8000-000000000010'
       ) -> 'items') = 0
     then 'serialized' else '' end"
)"
if [[ "$race_twenty_eight_f_state" != "serialized" ]]; then
  echo "Race 28f lost the edit or appended a stale submission." >&2
  exit 1
fi

# Race 28g: delete-first owns the same authored hierarchy before submit. The
# issue's FK becomes NULL while its immutable snapshots remain; submit waits,
# then rejects stale without a Course/Component/Issue deadlock or history row.
PGAPPNAME="$race_twenty_eight_g_delete_app" \
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 \
  >"$race_twenty_eight_g_delete_log" 2>&1 <<'SQL' &
begin;
set local statement_timeout = '15s';
select set_config(
  'request.jwt.claim.sub',
  'ca100000-0000-4000-8000-000000000001',
  true
);
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', 'ca100000-0000-4000-8000-000000000001',
    'session_id', 'ca110000-0000-4000-8000-000000000002',
    'role', 'authenticated'
  )::text,
  true
);
set local role authenticated;
select public.delete_lesson_component(
  'd5600000-0000-4000-8000-000000000012'
);
select pg_sleep(6);
commit;
SQL
race_twenty_eight_g_delete_pid=$!

if ! wait_for_sleeping_session \
  "$race_twenty_eight_g_delete_app" \
  "$race_twenty_eight_g_delete_pid"; then
  echo "Race 28g delete did not reach its canonical authored lock hold." >&2
  print_session_log \
    "Race 28g delete log" \
    "$race_twenty_eight_g_delete_log"
  exit 1
fi

PGAPPNAME="$race_twenty_eight_g_submit_app" \
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 \
  -v issue_ref="$race_choice_quiz_delete_first_ref" \
  >"$race_twenty_eight_g_submit_log" 2>&1 <<'SQL' &
\set VERBOSITY verbose
begin;
set local statement_timeout = '15s';
set local role service_role;
select public.submit_choice_quiz_attempt_admin(
  'cf100000-0000-4000-8000-000000000001',
  'cf110000-0000-4000-8000-000000000001',
  'd5700000-0000-4000-8000-000000000011',
  :'issue_ref',
  1,
  'd5a00000-0000-4000-8000-000000000289',
  array['d5100000-0000-4000-8000-000000000001'::uuid]
);
commit;
SQL
race_twenty_eight_g_submit_pid=$!

if ! wait_for_blocked_pair \
  "$race_twenty_eight_g_submit_app" \
  "$race_twenty_eight_g_delete_app" \
  "$race_twenty_eight_g_submit_pid"; then
  echo "Race 28g submit was not observed waiting on delete-first locks." >&2
  print_session_log \
    "Race 28g delete log" \
    "$race_twenty_eight_g_delete_log"
  print_session_log \
    "Race 28g submit log" \
    "$race_twenty_eight_g_submit_log"
  exit 1
fi

set +e
wait "$race_twenty_eight_g_delete_pid"
race_twenty_eight_g_delete_status=$?
race_twenty_eight_g_delete_pid=""
wait "$race_twenty_eight_g_submit_pid"
race_twenty_eight_g_submit_status=$?
race_twenty_eight_g_submit_pid=""
set -e

race_twenty_eight_g_submit_output="$(<"$race_twenty_eight_g_submit_log")"
if [[ "$race_twenty_eight_g_delete_status" -ne 0 ]]; then
  echo "Race 28g authored delete transaction failed unexpectedly." >&2
  print_session_log \
    "Race 28g delete log" \
    "$race_twenty_eight_g_delete_log"
  print_session_log \
    "Race 28g submit log" \
    "$race_twenty_eight_g_submit_log"
  exit 1
fi
if [[ "$race_twenty_eight_g_submit_status" -eq 0 ]] \
  || [[ "$race_twenty_eight_g_submit_output" != \
    *"40001: choice_quiz_attempt_stale"* ]]; then
  echo "Race 28g submit did not fail with committed-delete stale state." >&2
  print_session_log \
    "Race 28g delete log" \
    "$race_twenty_eight_g_delete_log"
  print_session_log \
    "Race 28g submit log" \
    "$race_twenty_eight_g_submit_log"
  exit 1
fi

race_twenty_eight_g_state="$(
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -Atqc \
    "select case when
       not exists (
         select 1
         from public.lesson_component
         where id = 'd5600000-0000-4000-8000-000000000012'
       )
       and exists (
         select 1
         from public.choice_quiz_issue as issue
         where issue.learner_ref = '$race_choice_quiz_delete_first_ref'
           and issue.lesson_component_id is null
       )
       and not exists (
         select 1
         from public.choice_quiz_attempt as attempt
         join public.choice_quiz_issue as issue on issue.id = attempt.issue_id
         where issue.learner_ref = '$race_choice_quiz_delete_first_ref'
       )
       and not exists (
         select 1
         from public.choice_quiz_evaluation as evaluation
         join public.choice_quiz_issue as issue on issue.id = evaluation.issue_id
         where issue.learner_ref = '$race_choice_quiz_delete_first_ref'
       )
       and jsonb_array_length(public.list_choice_quiz_run_history_admin(
         'ca100000-0000-4000-8000-000000000001',
         'ca110000-0000-4000-8000-000000000002',
         'd5700000-0000-4000-8000-000000000011'
       ) -> 'items') = 0
     then 'serialized' else '' end"
)"
if [[ "$race_twenty_eight_g_state" != "serialized" ]]; then
  echo "Race 28g lost the retained issue or appended a stale submission." >&2
  exit 1
fi

# Race 29: a successful submit owns the learner/authority snapshot while the
# owner revokes Course access. Revoke must wait, then close all exact-Run
# capabilities; the durable attempt survives and all later submission fails
# closed against the committed authority state.
PGAPPNAME="$race_twenty_nine_submit_app" \
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 \
  -v issue_ref="$race_choice_quiz_revoke_ref" \
  >"$race_twenty_nine_submit_log" 2>&1 <<'SQL' &
begin;
set local statement_timeout = '15s';
set local role service_role;
select public.submit_choice_quiz_attempt_admin(
  'cf100000-0000-4000-8000-000000000001',
  'cf110000-0000-4000-8000-000000000001',
  'd5700000-0000-4000-8000-000000000005',
  :'issue_ref',
  1,
  'd5a00000-0000-4000-8000-000000000029',
  array['d5100000-0000-4000-8000-000000000001'::uuid]
);
select pg_sleep(6);
commit;
SQL
race_twenty_nine_submit_pid=$!

if ! wait_for_sleeping_session \
  "$race_twenty_nine_submit_app" \
  "$race_twenty_nine_submit_pid"; then
  echo "Race 29 submit did not reach its learner/authority lock hold." >&2
  print_session_log "Race 29 submit log" "$race_twenty_nine_submit_log"
  exit 1
fi

PGAPPNAME="$race_twenty_nine_revoke_app" \
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 \
  >"$race_twenty_nine_revoke_log" 2>&1 <<'SQL' &
begin;
set local statement_timeout = '15s';
select set_config(
  'request.jwt.claim.sub',
  'ca100000-0000-4000-8000-000000000001',
  true
);
set local role authenticated;
select public.set_lesson_run_live_access(
  'd5700000-0000-4000-8000-000000000005',
  'cf300000-0000-4000-8000-000000000001',
  false,
  false
);
commit;
SQL
race_twenty_nine_revoke_pid=$!

if ! wait_for_blocked_pair \
  "$race_twenty_nine_revoke_app" \
  "$race_twenty_nine_submit_app" \
  "$race_twenty_nine_revoke_pid"; then
  echo "Race 29 revoke was not observed waiting on Choice Quiz submit." >&2
  print_session_log "Race 29 submit log" "$race_twenty_nine_submit_log"
  print_session_log "Race 29 revoke log" "$race_twenty_nine_revoke_log"
  exit 1
fi

set +e
wait "$race_twenty_nine_submit_pid"
race_twenty_nine_submit_status=$?
race_twenty_nine_submit_pid=""
wait "$race_twenty_nine_revoke_pid"
race_twenty_nine_revoke_status=$?
race_twenty_nine_revoke_pid=""
set -e

if [[ "$race_twenty_nine_submit_status" -ne 0 ]] \
  || [[ "$race_twenty_nine_revoke_status" -ne 0 ]]; then
  echo "Race 29 submit/revoke transactions did not both commit." >&2
  print_session_log "Race 29 submit log" "$race_twenty_nine_submit_log"
  print_session_log "Race 29 revoke log" "$race_twenty_nine_revoke_log"
  exit 1
fi

psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 \
  -v issue_ref="$race_choice_quiz_revoke_ref" >/dev/null <<'SQL'
begin;
set local role service_role;
select set_config('shidao.test_issue_ref', :'issue_ref', true);
do $denied$
begin
  begin
    perform public.submit_choice_quiz_attempt_admin(
      'cf100000-0000-4000-8000-000000000001',
      'cf110000-0000-4000-8000-000000000001',
      'd5700000-0000-4000-8000-000000000005',
      current_setting('shidao.test_issue_ref'),
      1,
      'd5a00000-0000-4000-8000-000000000291',
      array['d5100000-0000-4000-8000-000000000002'::uuid]
    );
    raise exception 'race_29_expected_authority_denial';
  exception
    when sqlstate 'P0002' then
      if sqlerrm <> 'lesson_run_live_not_found' then
        raise;
      end if;
  end;
end
$denied$;
commit;
SQL

race_twenty_nine_state="$(
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -Atqc \
    "select case when
       (select count(*) from public.choice_quiz_attempt as attempt
        join public.choice_quiz_issue as issue on issue.id = attempt.issue_id
        where issue.learner_ref = '$race_choice_quiz_revoke_ref') = 1
       and exists (
         select 1
         from public.course_learner_enrollment as enrollment
         where enrollment.course_id =
             'd5400000-0000-4000-8000-000000000001'
           and enrollment.learner_profile_id =
             'cf300000-0000-4000-8000-000000000001'
           and enrollment.status = 'revoked'
           and enrollment.revocation_reason =
             'teacher_revoked_course_access'
       )
       and not exists (
         select 1
         from public.lesson_run_execution_capability as capability
         where capability.course_id =
             'd5400000-0000-4000-8000-000000000001'
           and capability.learner_profile_id =
             'cf300000-0000-4000-8000-000000000001'
           and capability.status = 'active'
       )
     then 'serialized' else '' end"
)"
if [[ "$race_twenty_nine_state" != "serialized" ]]; then
  echo "Race 29 lost the attempt or retained learner execution authority." >&2
  exit 1
fi

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
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', 'ca100000-0000-4000-8000-000000000001',
    'session_id', 'ca110000-0000-4000-8000-000000000002',
    'role', 'authenticated'
  )::text,
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
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', 'ca100000-0000-4000-8000-000000000001',
    'session_id', 'ca110000-0000-4000-8000-000000000002',
    'role', 'authenticated'
  )::text,
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
           and component_label_at_time =
             'LA_M3_STAFF_ONLY_CONCURRENCY_SENTINEL'
           and component_visibility_at_time = 'staff_only'
           and observable_criterion_at_time =
             'Final evidence survives authored deletion'
           and rating = 'with_support'
           and private_note = 'Completion-first private note'
       )
       and exists (
         select 1
         from public.learning_evidence as evidence
         where evidence.learning_record_id =
             'ca800000-0000-4000-8000-000000000004'
           and evidence.source_observation_id =
             'ca900000-0000-4000-8000-000000000004'
           and evidence.lesson_component_id is null
           and evidence.source_learning_objective_id_at_time =
             'ca410000-0000-4000-8000-000000000001'
           and evidence.component_visibility_at_time = 'staff_only'
           and evidence.support = 'with_support'
       )
       and exists (
         select 1
         from public.learner_objective_state as state
         where state.learner_profile_id =
             'ca300000-0000-4000-8000-000000000001'
           and state.recorded_by_account_id =
             'ca200000-0000-4000-8000-000000000001'
           and state.source_learning_objective_id_at_time =
             'ca410000-0000-4000-8000-000000000001'
           and state.status = 'forming'
           and state.reason_code = 'latest_with_support'
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

# Race 9: an authenticated teacher profile refresh rebuilds the persisted
# projection and retains the learner transaction lock until commit. A
# correction must visibly wait, then atomically supersede record, observation,
# evidence and state without a deadlock or stale post-refresh projection.
PGAPPNAME="$race_nine_refresh_app" \
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 \
  >"$race_nine_refresh_log" 2>&1 <<'SQL' &
begin;
set local statement_timeout = '15s';
select set_config(
  'request.jwt.claim.sub',
  'ca100000-0000-4000-8000-000000000001',
  true
);
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', 'ca100000-0000-4000-8000-000000000001',
    'session_id', 'ca110000-0000-4000-8000-000000000002',
    'role', 'authenticated'
  )::text,
  true
);
set local role authenticated;
select public.get_teacher_learner_activity_profile(
  'ca300000-0000-4000-8000-000000000001'
);
select pg_sleep(6);
commit;
SQL
race_nine_refresh_pid=$!

if ! wait_for_sleeping_session \
  "$race_nine_refresh_app" \
  "$race_nine_refresh_pid"; then
  echo "Race 9 refresh did not reach its learner-lock hold." >&2
  print_session_log "Race 9 refresh log" "$race_nine_refresh_log"
  exit 1
fi

PGAPPNAME="$race_nine_correction_app" \
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 \
  >"$race_nine_correction_log" 2>&1 <<'SQL' &
begin;
set local statement_timeout = '15s';
select set_config(
  'request.jwt.claim.sub',
  'ca100000-0000-4000-8000-000000000001',
  true
);
set local role authenticated;
select public.correct_finalized_lesson_component_observation(
  'ca900000-0000-4000-8000-000000000004',
  'ca300000-0000-4000-8000-000000000001',
  'ca800000-0000-4000-8000-000000000004',
  'not_yet',
  'Race 9 corrected private note',
  'Race 9 correction after refresh',
  'cae00000-0000-4000-8000-000000000009',
  '2099-01-01 00:00:00+00'
);
commit;
SQL
race_nine_correction_pid=$!

if ! wait_for_blocked_pair \
  "$race_nine_correction_app" \
  "$race_nine_refresh_app" \
  "$race_nine_correction_pid"; then
  echo "Race 9 correction was not observed waiting on refresh." >&2
  print_session_log "Race 9 refresh log" "$race_nine_refresh_log"
  print_session_log "Race 9 correction log" "$race_nine_correction_log"
  exit 1
fi

set +e
wait "$race_nine_refresh_pid"
race_nine_refresh_status=$?
race_nine_refresh_pid=""
wait "$race_nine_correction_pid"
race_nine_correction_status=$?
race_nine_correction_pid=""
set -e

if [[ "$race_nine_refresh_status" -ne 0 ]] \
  || [[ "$race_nine_correction_status" -ne 0 ]]; then
  echo "Race 9 refresh/correction transactions did not both commit." >&2
  print_session_log "Race 9 refresh log" "$race_nine_refresh_log"
  print_session_log "Race 9 correction log" "$race_nine_correction_log"
  exit 1
fi

race_nine_state="$(
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -Atqc \
    "select case when
       exists (
         select 1
         from public.learning_record as source_record
         join public.learning_record as corrected_record
           on corrected_record.id = source_record.superseded_by_record_id
          and corrected_record.corrected_from_record_id = source_record.id
         join public.lesson_component_observation as corrected_observation
           on corrected_observation.learning_record_id = corrected_record.id
          and corrected_observation.corrected_from_observation_id =
            'ca900000-0000-4000-8000-000000000004'
         where source_record.id =
             'ca800000-0000-4000-8000-000000000004'
           and corrected_record.correction_idempotency_key =
             'cae00000-0000-4000-8000-000000000009'
           and corrected_record.superseded_by_record_id is null
           and corrected_observation.rating = 'not_yet'
           and corrected_observation.private_note =
             'Race 9 corrected private note'
           and corrected_observation.component_visibility_at_time =
             'staff_only'
       )
       and exists (
         select 1
         from public.learning_evidence as prior_evidence
         join public.learning_evidence as corrected_evidence
           on corrected_evidence.id =
             prior_evidence.superseded_by_evidence_id
          and corrected_evidence.supersedes_evidence_id = prior_evidence.id
         where prior_evidence.source_observation_id =
             'ca900000-0000-4000-8000-000000000004'
           and corrected_evidence.direction = 'negative'
           and corrected_evidence.support is null
           and corrected_evidence.component_visibility_at_time = 'staff_only'
       )
       and exists (
         select 1
         from public.learner_objective_state as state
         join public.learner_objective_state_evidence as link
           on link.learner_objective_state_id = state.id
         join public.learning_evidence as evidence
           on evidence.id = link.learning_evidence_id
         where state.learner_profile_id =
             'ca300000-0000-4000-8000-000000000001'
           and state.recorded_by_account_id =
             'ca200000-0000-4000-8000-000000000001'
           and state.source_learning_objective_id_at_time =
             'ca410000-0000-4000-8000-000000000001'
           and state.status = 'forming'
           and state.reason_code = 'latest_not_yet'
           and evidence.direction = 'negative'
           and evidence.superseded_by_evidence_id is null
       )
     then 'serialized' else '' end"
)"
if [[ "$race_nine_state" != "serialized" ]]; then
  echo "Race 9 left a stale or split correction projection." >&2
  exit 1
fi

# Prepare a canonical merge into an account-owned subject profile. Preview is
# committed first so the race tests the real fingerprinted confirmation path.
psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 >/dev/null <<'SQL'
begin;

-- Earlier lifecycle races deliberately leave open draft attendance rows. They
-- are unrelated to the finalized LA-M3 projection under test and are a
-- documented canonical-merge blocker, so close that fixture-only surface
-- before previewing the dedicated merge race.
delete from public.learning_record
where learner_profile_id = 'ca300000-0000-4000-8000-000000000001'
  and occurred_at is null;

-- LA-M4 intentionally never transfers authority across identity merge.  The
-- offline source cannot receive a real owner grant, so this narrowly scoped
-- identity-edge fixture bypasses triggers while preserving every FK/check.
-- Confirmation must cascade these rows rather than retargeting them.
set local session_replication_role = replica;

insert into public.course_learner_enrollment (
  course_id,
  learner_profile_id,
  status,
  revision,
  granted_by_account_id,
  granted_at
) values (
  'cf400000-0000-4000-8000-000000000001',
  'ca300000-0000-4000-8000-000000000001',
  'active',
  1,
  'ca200000-0000-4000-8000-000000000001',
  clock_timestamp()
);

insert into public.lesson_run_execution_capability (
  lesson_run_id,
  course_id,
  learner_profile_id,
  enrollment_revision,
  status,
  revision,
  granted_by_account_id,
  granted_at
) values (
  'cf700000-0000-4000-8000-000000000003',
  'cf400000-0000-4000-8000-000000000001',
  'ca300000-0000-4000-8000-000000000001',
  1,
  'active',
  1,
  'ca200000-0000-4000-8000-000000000001',
  clock_timestamp()
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
  'cac00000-0000-4000-8000-000000000001',
  'ca300000-0000-4000-8000-000000000001',
  'ca300000-0000-4000-8000-000000000002',
  'ca200000-0000-4000-8000-000000000001',
  'ca200000-0000-4000-8000-000000000002',
  clock_timestamp() + interval '1 day'
);

commit;
SQL

race_ten_merge_fingerprint="$(
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -Atqc \
    "with configured as materialized (
       select set_config(
         'request.jwt.claims',
         jsonb_build_object(
           'sub', 'ca100000-0000-4000-8000-000000000002',
           'session_id', 'ca110000-0000-4000-8000-000000000001',
           'role', 'authenticated'
         )::text,
         false
       )
     )
     select public.preview_learner_profile_merge(
       'cac00000-0000-4000-8000-000000000001'
     ) ->> 'previewFingerprint'
     from configured"
)"
if [[ -z "$race_ten_merge_fingerprint" ]]; then
  echo "Race 10 merge preview did not produce a fingerprint." >&2
  exit 1
fi

race_ten_merge_can_confirm="$(
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -Atqc \
    "select preview_payload ->> 'canConfirm'
     from public.learner_profile_merge
     where id = 'cac00000-0000-4000-8000-000000000001'"
)"
if [[ "$race_ten_merge_can_confirm" != "true" ]]; then
  echo "Race 10 merge preview unexpectedly retained blockers." >&2
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -Atqc \
    "select preview_payload -> 'blockers'
     from public.learner_profile_merge
     where id = 'cac00000-0000-4000-8000-000000000001'" >&2
  exit 1
fi

# Race 10: a teacher refresh owns the source learner lock. Canonical merge
# confirmation must wait, then move every active/corrected LA-M3 row while
# dropping (never transferring) source LA-M4 authority. A live read started
# after confirmation but before commit must wait on the same learner lock and
# fail closed against the committed target state.
PGAPPNAME="$race_ten_refresh_app" \
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 \
  >"$race_ten_refresh_log" 2>&1 <<'SQL' &
begin;
set local statement_timeout = '15s';
select set_config(
  'request.jwt.claim.sub',
  'ca100000-0000-4000-8000-000000000001',
  true
);
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', 'ca100000-0000-4000-8000-000000000001',
    'session_id', 'ca110000-0000-4000-8000-000000000002',
    'role', 'authenticated'
  )::text,
  true
);
set local role authenticated;
select public.get_teacher_learner_activity_profile(
  'ca300000-0000-4000-8000-000000000001'
);
select pg_sleep(6);
commit;
SQL
race_ten_refresh_pid=$!

if ! wait_for_sleeping_session \
  "$race_ten_refresh_app" \
  "$race_ten_refresh_pid"; then
  echo "Race 10 refresh did not reach its learner-lock hold." >&2
  print_session_log "Race 10 refresh log" "$race_ten_refresh_log"
  exit 1
fi

PGAPPNAME="$race_ten_merge_app" \
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 \
  >"$race_ten_merge_log" 2>&1 <<SQL &
begin;
set local statement_timeout = '15s';
select set_config(
  'request.jwt.claim.sub',
  'ca100000-0000-4000-8000-000000000002',
  true
);
set local role authenticated;
select public.confirm_learner_profile_merge(
  'cac00000-0000-4000-8000-000000000001',
  '$race_ten_merge_fingerprint'
);
select pg_sleep(6);
commit;
SQL
race_ten_merge_pid=$!

if ! wait_for_blocked_pair \
  "$race_ten_merge_app" \
  "$race_ten_refresh_app" \
  "$race_ten_merge_pid"; then
  echo "Race 10 merge was not observed waiting on refresh." >&2
  print_session_log "Race 10 refresh log" "$race_ten_refresh_log"
  print_session_log "Race 10 merge log" "$race_ten_merge_log"
  exit 1
fi

set +e
wait "$race_ten_refresh_pid"
race_ten_refresh_status=$?
race_ten_refresh_pid=""
set -e

if [[ "$race_ten_refresh_status" -ne 0 ]]; then
  echo "Race 10 refresh transaction did not commit." >&2
  print_session_log "Race 10 refresh log" "$race_ten_refresh_log"
  print_session_log "Race 10 merge log" "$race_ten_merge_log"
  exit 1
fi

if ! wait_for_sleeping_session \
  "$race_ten_merge_app" \
  "$race_ten_merge_pid"; then
  echo "Race 10 merge did not reach its post-confirm lock hold." >&2
  print_session_log "Race 10 merge log" "$race_ten_merge_log"
  exit 1
fi

PGAPPNAME="$race_ten_live_read_app" \
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 \
  >"$race_ten_live_read_log" 2>&1 <<'SQL' &
begin;
set local statement_timeout = '15s';
set local role service_role;
do $read$
begin
  begin
    perform public.resolve_lesson_run_live_source_admin(
      'ca100000-0000-4000-8000-000000000002',
      'ca110000-0000-4000-8000-000000000001',
      'cf700000-0000-4000-8000-000000000003'
    );
    raise exception 'race_10_expected_live_read_denial';
  exception
    when sqlstate 'P0002' then
      if sqlerrm <> 'lesson_run_live_not_found' then
        raise;
      end if;
  end;
end
$read$;
commit;
SQL
race_ten_live_read_pid=$!

if ! wait_for_blocked_pair \
  "$race_ten_live_read_app" \
  "$race_ten_merge_app" \
  "$race_ten_live_read_pid"; then
  echo "Race 10 live read was not observed waiting on merge." >&2
  print_session_log "Race 10 merge log" "$race_ten_merge_log"
  print_session_log "Race 10 live-read log" "$race_ten_live_read_log"
  exit 1
fi

set +e
wait "$race_ten_merge_pid"
race_ten_merge_status=$?
race_ten_merge_pid=""
wait "$race_ten_live_read_pid"
race_ten_live_read_status=$?
race_ten_live_read_pid=""
set -e

if [[ "$race_ten_merge_status" -ne 0 ]] \
  || [[ "$race_ten_live_read_status" -ne 0 ]]; then
  echo "Race 10 merge/live-read transactions did not both finish safely." >&2
  print_session_log "Race 10 merge log" "$race_ten_merge_log"
  print_session_log "Race 10 live-read log" "$race_ten_live_read_log"
  exit 1
fi

race_ten_state="$(
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -Atqc \
    "select case when
       not exists (
         select 1 from public.learner_profile
         where id = 'ca300000-0000-4000-8000-000000000001'
       )
       and exists (
         select 1 from public.learner_profile_merge
         where id = 'cac00000-0000-4000-8000-000000000001'
           and status = 'completed'
           and completed_at is not null
       )
       and not exists (
         select 1 from public.learning_record
         where learner_profile_id =
           'ca300000-0000-4000-8000-000000000001'
       )
       and not exists (
         select 1 from public.learning_evidence
         where learner_profile_id =
           'ca300000-0000-4000-8000-000000000001'
       )
       and not exists (
         select 1 from public.learner_objective_state
         where learner_profile_id =
           'ca300000-0000-4000-8000-000000000001'
       )
       and not exists (
         select 1
         from public.course_learner_enrollment
         where course_id = 'cf400000-0000-4000-8000-000000000001'
           and learner_profile_id in (
             'ca300000-0000-4000-8000-000000000001',
             'ca300000-0000-4000-8000-000000000002'
           )
       )
       and not exists (
         select 1
         from public.lesson_run_execution_capability
         where lesson_run_id = 'cf700000-0000-4000-8000-000000000003'
           and learner_profile_id in (
             'ca300000-0000-4000-8000-000000000001',
             'ca300000-0000-4000-8000-000000000002'
           )
       )
       and exists (
         select 1
         from public.learner_objective_state as state
         join public.learner_objective_state_evidence as link
           on link.learner_objective_state_id = state.id
         join public.learning_evidence as evidence
           on evidence.id = link.learning_evidence_id
         where state.learner_profile_id =
             'ca300000-0000-4000-8000-000000000002'
           and state.recorded_by_account_id =
             'ca200000-0000-4000-8000-000000000001'
           and state.source_learning_objective_id_at_time =
             'ca410000-0000-4000-8000-000000000001'
           and state.reason_code = 'latest_not_yet'
           and evidence.learner_profile_id = state.learner_profile_id
           and evidence.direction = 'negative'
       )
     then 'serialized' else '' end"
)"
if [[ "$race_ten_state" != "serialized" ]]; then
  echo "Race 10 left source LA-M3/LA-M4 rows or transferred authority." >&2
  exit 1
fi

# Give the still-linked target a disposable, FK-valid LA-M4 authority edge so
# erasure must remove it.  This is intentionally injected with triggers off:
# it isolates erasure cleanup from the teacher-grant races below, while the
# concurrent resolver still exercises the production service-only path.
psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 >/dev/null <<'SQL'
begin;
set local session_replication_role = replica;

insert into public.course_learner_enrollment (
  course_id,
  learner_profile_id,
  status,
  revision,
  granted_by_account_id,
  granted_at
) values (
  'cf400000-0000-4000-8000-000000000001',
  'ca300000-0000-4000-8000-000000000002',
  'active',
  1,
  'ca200000-0000-4000-8000-000000000001',
  clock_timestamp()
);

insert into public.lesson_run_execution_capability (
  lesson_run_id,
  course_id,
  learner_profile_id,
  enrollment_revision,
  status,
  revision,
  granted_by_account_id,
  granted_at
) values (
  'cf700000-0000-4000-8000-000000000003',
  'cf400000-0000-4000-8000-000000000001',
  'ca300000-0000-4000-8000-000000000002',
  1,
  'active',
  1,
  'ca200000-0000-4000-8000-000000000001',
  clock_timestamp()
);

commit;
SQL

race_eleven_erasure_fingerprint="$(
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -Atqc \
    "with configured as materialized (
       select set_config(
         'request.jwt.claims',
         jsonb_build_object(
           'sub', 'ca100000-0000-4000-8000-000000000002',
           'session_id', 'ca110000-0000-4000-8000-000000000001',
           'role', 'authenticated'
         )::text,
         false
       )
     )
     select public.preview_my_learning_data_erasure()
       ->> 'previewFingerprint'
     from configured"
)"
if [[ -z "$race_eleven_erasure_fingerprint" ]]; then
  echo "Race 11 erasure preview did not produce a fingerprint." >&2
  exit 1
fi

# Race 11: the subject-safe refresh holds the target profile lock after
# rebuilding all recorder projections. Service-side erasure must wait, remove
# LA-M3 plus LA-M4 authority, and create only the canonical fresh profile. A
# concurrent live read must wait on the erasure learner lock and then deny the
# now-fresh identity rather than return pre-erasure content.
PGAPPNAME="$race_eleven_refresh_app" \
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 \
  >"$race_eleven_refresh_log" 2>&1 <<'SQL' &
begin;
set local statement_timeout = '15s';
select set_config(
  'request.jwt.claim.sub',
  'ca100000-0000-4000-8000-000000000002',
  true
);
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', 'ca100000-0000-4000-8000-000000000002',
    'session_id', 'ca110000-0000-4000-8000-000000000001',
    'role', 'authenticated'
  )::text,
  true
);
set local role authenticated;
select public.get_my_learning_activity_profile();
select pg_sleep(6);
commit;
SQL
race_eleven_refresh_pid=$!

if ! wait_for_sleeping_session \
  "$race_eleven_refresh_app" \
  "$race_eleven_refresh_pid"; then
  echo "Race 11 refresh did not reach its learner-lock hold." >&2
  print_session_log "Race 11 refresh log" "$race_eleven_refresh_log"
  exit 1
fi

PGAPPNAME="$race_eleven_erasure_app" \
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 \
  >"$race_eleven_erasure_log" 2>&1 <<SQL &
begin;
set local statement_timeout = '15s';
set local role service_role;
select public.confirm_my_learning_data_erasure(
  'ca100000-0000-4000-8000-000000000002',
  'ca110000-0000-4000-8000-000000000001',
  '$race_eleven_erasure_fingerprint'
);
select pg_sleep(6);
commit;
SQL
race_eleven_erasure_pid=$!

if ! wait_for_blocked_pair \
  "$race_eleven_erasure_app" \
  "$race_eleven_refresh_app" \
  "$race_eleven_erasure_pid"; then
  echo "Race 11 erasure was not observed waiting on refresh." >&2
  print_session_log "Race 11 refresh log" "$race_eleven_refresh_log"
  print_session_log "Race 11 erasure log" "$race_eleven_erasure_log"
  exit 1
fi

set +e
wait "$race_eleven_refresh_pid"
race_eleven_refresh_status=$?
race_eleven_refresh_pid=""
set -e

if [[ "$race_eleven_refresh_status" -ne 0 ]]; then
  echo "Race 11 refresh transaction did not commit." >&2
  print_session_log "Race 11 refresh log" "$race_eleven_refresh_log"
  print_session_log "Race 11 erasure log" "$race_eleven_erasure_log"
  exit 1
fi

if ! wait_for_sleeping_session \
  "$race_eleven_erasure_app" \
  "$race_eleven_erasure_pid"; then
  echo "Race 11 erasure did not reach its post-confirm lock hold." >&2
  print_session_log "Race 11 erasure log" "$race_eleven_erasure_log"
  exit 1
fi

PGAPPNAME="$race_eleven_live_read_app" \
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 \
  >"$race_eleven_live_read_log" 2>&1 <<'SQL' &
begin;
set local statement_timeout = '15s';
set local role service_role;
do $read$
begin
  begin
    perform public.resolve_lesson_run_live_source_admin(
      'ca100000-0000-4000-8000-000000000002',
      'ca110000-0000-4000-8000-000000000001',
      'cf700000-0000-4000-8000-000000000003'
    );
    raise exception 'race_11_expected_live_read_denial';
  exception
    when sqlstate 'P0002' then
      if sqlerrm <> 'lesson_run_live_not_found' then
        raise;
      end if;
  end;
end
$read$;
commit;
SQL
race_eleven_live_read_pid=$!

if ! wait_for_blocked_pair \
  "$race_eleven_live_read_app" \
  "$race_eleven_erasure_app" \
  "$race_eleven_live_read_pid"; then
  echo "Race 11 live read was not observed waiting on erasure." >&2
  print_session_log "Race 11 erasure log" "$race_eleven_erasure_log"
  print_session_log "Race 11 live-read log" "$race_eleven_live_read_log"
  exit 1
fi

set +e
wait "$race_eleven_erasure_pid"
race_eleven_erasure_status=$?
race_eleven_erasure_pid=""
wait "$race_eleven_live_read_pid"
race_eleven_live_read_status=$?
race_eleven_live_read_pid=""
set -e

if [[ "$race_eleven_erasure_status" -ne 0 ]] \
  || [[ "$race_eleven_live_read_status" -ne 0 ]]; then
  echo "Race 11 erasure/live-read transactions did not both finish safely." >&2
  print_session_log "Race 11 erasure log" "$race_eleven_erasure_log"
  print_session_log "Race 11 live-read log" "$race_eleven_live_read_log"
  exit 1
fi

race_eleven_state="$(
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -Atqc \
    "select case when
       not exists (
         select 1 from public.learner_profile
         where id in (
           'ca300000-0000-4000-8000-000000000001',
           'ca300000-0000-4000-8000-000000000002'
         )
       )
       and (
         select count(*)
         from public.learner_profile
         where account_id =
           'ca200000-0000-4000-8000-000000000002'
       ) = 1
       and not exists (
         select 1 from public.learning_record
         where learner_profile_id in (
           'ca300000-0000-4000-8000-000000000001',
           'ca300000-0000-4000-8000-000000000002'
         )
       )
       and not exists (
         select 1 from public.learning_evidence
         where learner_profile_id in (
           'ca300000-0000-4000-8000-000000000001',
           'ca300000-0000-4000-8000-000000000002'
         )
       )
       and not exists (
         select 1 from public.learner_objective_state
         where learner_profile_id in (
           'ca300000-0000-4000-8000-000000000001',
           'ca300000-0000-4000-8000-000000000002'
         )
       )
       and not exists (
         select 1 from public.learner_recommendation_override
         where learner_profile_id in (
           'ca300000-0000-4000-8000-000000000001',
           'ca300000-0000-4000-8000-000000000002'
         )
       )
       and not exists (
         select 1
         from public.course_learner_enrollment as enrollment
         join public.learner_profile as profile
           on profile.id = enrollment.learner_profile_id
         where enrollment.course_id =
             'cf400000-0000-4000-8000-000000000001'
           and (
             enrollment.learner_profile_id in (
               'ca300000-0000-4000-8000-000000000001',
               'ca300000-0000-4000-8000-000000000002'
             )
             or profile.account_id =
               'ca200000-0000-4000-8000-000000000002'
           )
       )
       and not exists (
         select 1
         from public.lesson_run_execution_capability as capability
         join public.learner_profile as profile
           on profile.id = capability.learner_profile_id
         where capability.lesson_run_id =
             'cf700000-0000-4000-8000-000000000003'
           and (
             capability.learner_profile_id in (
               'ca300000-0000-4000-8000-000000000001',
               'ca300000-0000-4000-8000-000000000002'
             )
             or profile.account_id =
               'ca200000-0000-4000-8000-000000000002'
           )
       )
     then 'serialized' else '' end"
)"
if [[ "$race_eleven_state" != "serialized" ]]; then
  echo "Race 11 retained erased LA-M3/LA-M4 state or broke identity." >&2
  exit 1
fi

# Race 12: two teachers submit the same expected cursor revision.  The first
# transaction owns the presentation-state row until commit; the second must
# wait, then receive the stable serialization-failure token instead of
# overwriting the committed cursor.
PGAPPNAME="$race_twelve_cursor_first_app" \
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 \
  >"$race_twelve_cursor_first_log" 2>&1 <<'SQL' &
begin;
set local statement_timeout = '15s';
select set_config(
  'request.jwt.claim.sub',
  'ca100000-0000-4000-8000-000000000001',
  true
);
set local role authenticated;
select public.set_lesson_run_presentation_cursor(
  'cf700000-0000-4000-8000-000000000001',
  'cf550000-0000-4000-8000-000000000001',
  0
);
select pg_sleep(6);
commit;
SQL
race_twelve_cursor_first_pid=$!

if ! wait_for_sleeping_session \
  "$race_twelve_cursor_first_app" \
  "$race_twelve_cursor_first_pid"; then
  echo "Race 12 first cursor writer did not reach its state-lock hold." >&2
  print_session_log \
    "Race 12 first cursor log" \
    "$race_twelve_cursor_first_log"
  exit 1
fi

PGAPPNAME="$race_twelve_cursor_stale_app" \
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 \
  >"$race_twelve_cursor_stale_log" 2>&1 <<'SQL' &
begin;
set local statement_timeout = '15s';
select set_config(
  'request.jwt.claim.sub',
  'ca100000-0000-4000-8000-000000000001',
  true
);
set local role authenticated;
do $stale$
begin
  perform public.set_lesson_run_presentation_cursor(
    'cf700000-0000-4000-8000-000000000001',
    'cf550000-0000-4000-8000-000000000001',
    0
  );
  raise exception 'race_12_expected_stale_cursor_rejection';
exception
  when sqlstate '40001' then
    if sqlerrm <> 'lesson_run_cursor_stale' then
      raise;
    end if;
end
$stale$;
commit;
SQL
race_twelve_cursor_stale_pid=$!

if ! wait_for_blocked_pair \
  "$race_twelve_cursor_stale_app" \
  "$race_twelve_cursor_first_app" \
  "$race_twelve_cursor_stale_pid"; then
  echo "Race 12 stale cursor writer was not observed waiting." >&2
  print_session_log \
    "Race 12 first cursor log" \
    "$race_twelve_cursor_first_log"
  print_session_log \
    "Race 12 stale cursor log" \
    "$race_twelve_cursor_stale_log"
  exit 1
fi

set +e
wait "$race_twelve_cursor_first_pid"
race_twelve_cursor_first_status=$?
race_twelve_cursor_first_pid=""
wait "$race_twelve_cursor_stale_pid"
race_twelve_cursor_stale_status=$?
race_twelve_cursor_stale_pid=""
set -e

if [[ "$race_twelve_cursor_first_status" -ne 0 ]] \
  || [[ "$race_twelve_cursor_stale_status" -ne 0 ]]; then
  echo "Race 12 cursor transactions did not both finish as expected." >&2
  print_session_log \
    "Race 12 first cursor log" \
    "$race_twelve_cursor_first_log"
  print_session_log \
    "Race 12 stale cursor log" \
    "$race_twelve_cursor_stale_log"
  exit 1
fi

race_twelve_state="$(
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -Atqc \
    "select case when exists (
       select 1
       from public.lesson_run_presentation_state
       where lesson_run_id =
           'cf700000-0000-4000-8000-000000000001'
         and student_slide_id =
           'cf550000-0000-4000-8000-000000000001'
         and cursor_version = 1
     ) then 'serialized' else '' end"
)"
if [[ "$race_twelve_state" != "serialized" ]]; then
  echo "Race 12 lost the first CAS cursor or advanced it twice." >&2
  exit 1
fi

# Race 13: actual start locks the frozen learner identity while materializing
# its capability.  A concurrent unlink/relink waits, then the account-change
# trigger revokes Course access and every Run capability.  Relinking never
# transfers or silently restores authority.
PGAPPNAME="$race_thirteen_start_app" \
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 \
  >"$race_thirteen_start_log" 2>&1 <<'SQL' &
begin;
set local statement_timeout = '15s';
select set_config(
  'request.jwt.claim.sub',
  'ca100000-0000-4000-8000-000000000001',
  true
);
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', 'ca100000-0000-4000-8000-000000000001',
    'session_id', 'ca110000-0000-4000-8000-000000000002',
    'role', 'authenticated'
  )::text,
  true
);
set local role authenticated;
select public.start_lesson_run(
  'cf700000-0000-4000-8000-000000000002',
  '2026-08-21 11:05:00+09'
);
select pg_sleep(6);
commit;
SQL
race_thirteen_start_pid=$!

if ! wait_for_sleeping_session \
  "$race_thirteen_start_app" \
  "$race_thirteen_start_pid"; then
  echo "Race 13 start did not reach its identity-lock hold." >&2
  print_session_log "Race 13 start log" "$race_thirteen_start_log"
  exit 1
fi

PGAPPNAME="$race_thirteen_revoke_app" \
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 \
  >"$race_thirteen_revoke_log" 2>&1 <<'SQL' &
begin;
set local statement_timeout = '15s';
select set_config('app.learner_profile_link_mutation', 'on', true);
update public.learner_profile
set account_id = null
where id = 'ce300000-0000-4000-8000-000000000001';
update public.learner_profile
set account_id = 'ce200000-0000-4000-8000-000000000001'
where id = 'ce300000-0000-4000-8000-000000000001';
commit;
SQL
race_thirteen_revoke_pid=$!

if ! wait_for_blocked_pair \
  "$race_thirteen_revoke_app" \
  "$race_thirteen_start_app" \
  "$race_thirteen_revoke_pid"; then
  echo "Race 13 identity change was not observed waiting on start." >&2
  print_session_log "Race 13 start log" "$race_thirteen_start_log"
  print_session_log \
    "Race 13 identity-change log" \
    "$race_thirteen_revoke_log"
  exit 1
fi

set +e
wait "$race_thirteen_start_pid"
race_thirteen_start_status=$?
race_thirteen_start_pid=""
wait "$race_thirteen_revoke_pid"
race_thirteen_revoke_status=$?
race_thirteen_revoke_pid=""
set -e

if [[ "$race_thirteen_start_status" -ne 0 ]] \
  || [[ "$race_thirteen_revoke_status" -ne 0 ]]; then
  echo "Race 13 start/identity-change transactions did not both commit." >&2
  print_session_log "Race 13 start log" "$race_thirteen_start_log"
  print_session_log \
    "Race 13 identity-change log" \
    "$race_thirteen_revoke_log"
  exit 1
fi

race_thirteen_state="$(
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -Atqc \
    "select case when
       exists (
         select 1
         from public.lesson_run
         where id = 'cf700000-0000-4000-8000-000000000002'
           and started_at_is_actual
           and started_at = '2026-08-21 11:05:00+09'::timestamptz
       )
       and exists (
         select 1
         from public.lesson_run_presentation_state
         where lesson_run_id =
             'cf700000-0000-4000-8000-000000000002'
           and student_slide_id is null
           and cursor_version = 0
       )
       and exists (
         select 1
         from public.learner_profile
         where id = 'ce300000-0000-4000-8000-000000000001'
           and account_id =
             'ce200000-0000-4000-8000-000000000001'
       )
       and exists (
         select 1
         from public.course_learner_enrollment
         where course_id = 'cf400000-0000-4000-8000-000000000001'
           and learner_profile_id =
             'ce300000-0000-4000-8000-000000000001'
           and status = 'revoked'
           and revision = 2
           and revocation_reason = 'learner_account_changed'
       )
       and not exists (
         select 1
         from public.lesson_run_execution_capability
         where course_id = 'cf400000-0000-4000-8000-000000000001'
           and learner_profile_id =
             'ce300000-0000-4000-8000-000000000001'
           and status = 'active'
       )
       and exists (
         select 1
         from public.lesson_run_execution_capability
         where lesson_run_id =
             'cf700000-0000-4000-8000-000000000002'
           and learner_profile_id =
             'ce300000-0000-4000-8000-000000000001'
           and status = 'revoked'
           and revocation_reason = 'learner_account_changed'
       )
     then 'serialized' else '' end"
)"
if [[ "$race_thirteen_state" != "serialized" ]]; then
  echo "Race 13 restored or transferred live authority after identity change." >&2
  exit 1
fi

# Race 13 now uses an isolated linked learner so its identity mutation cannot
# revoke the Choice Quiz learner's separate Course authority. Recreate the
# original Race 14 precondition explicitly: the main learner's LA-M4 Course
# grant is revoked at revision 2, and the concurrent grant below must restore
# it at revision 3 together with the exact Run capability.
psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 >/dev/null <<'SQL'
begin;
select set_config(
  'request.jwt.claim.sub',
  'ca100000-0000-4000-8000-000000000001',
  true
);
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', 'ca100000-0000-4000-8000-000000000001',
    'session_id', 'ca110000-0000-4000-8000-000000000002',
    'role', 'authenticated'
  )::text,
  true
);
set local role authenticated;
select public.set_lesson_run_live_access(
  'cf700000-0000-4000-8000-000000000001',
  'cf300000-0000-4000-8000-000000000001',
  false,
  false
);
commit;
SQL

# Race 14: an explicit teacher grant owns the canonical learner advisory lock
# through commit. A service read started after the grant statement must wait,
# then observe exactly the newly committed live authority and cursor.
PGAPPNAME="$race_fourteen_grant_app" \
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 \
  >"$race_fourteen_grant_log" 2>&1 <<'SQL' &
begin;
set local statement_timeout = '15s';
select set_config(
  'request.jwt.claim.sub',
  'ca100000-0000-4000-8000-000000000001',
  true
);
set local role authenticated;
select public.set_lesson_run_live_access(
  'cf700000-0000-4000-8000-000000000001',
  'cf300000-0000-4000-8000-000000000001',
  true,
  true
);
select pg_sleep(6);
commit;
SQL
race_fourteen_grant_pid=$!

if ! wait_for_sleeping_session \
  "$race_fourteen_grant_app" \
  "$race_fourteen_grant_pid"; then
  echo "Race 14 grant did not reach its advisory-lock hold." >&2
  print_session_log "Race 14 grant log" "$race_fourteen_grant_log"
  exit 1
fi

PGAPPNAME="$race_fourteen_read_app" \
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 \
  >"$race_fourteen_read_log" 2>&1 <<'SQL' &
begin;
set local statement_timeout = '15s';
set local role service_role;
do $read$
declare
  v_source jsonb;
begin
  v_source := public.resolve_lesson_run_live_source_admin(
    'cf100000-0000-4000-8000-000000000001',
    'cf110000-0000-4000-8000-000000000001',
    'cf700000-0000-4000-8000-000000000001'
  );
  if v_source ->> 'state' <> 'live'
    or v_source ->> 'cursorRevision' <> '1'
    or v_source #>> '{slide,components,0,payload,content}' <>
      'LA_M4_CURSOR_RACE'
  then
    raise exception 'race_14_committed_live_source_mismatch:%', v_source;
  end if;
end
$read$;
commit;
SQL
race_fourteen_read_pid=$!

if ! wait_for_blocked_pair \
  "$race_fourteen_read_app" \
  "$race_fourteen_grant_app" \
  "$race_fourteen_read_pid"; then
  echo "Race 14 live read was not observed waiting on grant." >&2
  print_session_log "Race 14 grant log" "$race_fourteen_grant_log"
  print_session_log "Race 14 live-read log" "$race_fourteen_read_log"
  exit 1
fi

set +e
wait "$race_fourteen_grant_pid"
race_fourteen_grant_status=$?
race_fourteen_grant_pid=""
wait "$race_fourteen_read_pid"
race_fourteen_read_status=$?
race_fourteen_read_pid=""
set -e

if [[ "$race_fourteen_grant_status" -ne 0 ]] \
  || [[ "$race_fourteen_read_status" -ne 0 ]]; then
  echo "Race 14 grant/live-read transactions did not both succeed." >&2
  print_session_log "Race 14 grant log" "$race_fourteen_grant_log"
  print_session_log "Race 14 live-read log" "$race_fourteen_read_log"
  exit 1
fi

race_fourteen_state="$(
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -Atqc \
    "select case when
       exists (
         select 1
         from public.course_learner_enrollment
         where course_id = 'cf400000-0000-4000-8000-000000000001'
           and learner_profile_id =
             'cf300000-0000-4000-8000-000000000001'
           and status = 'active'
           and revision = 3
       )
       and exists (
         select 1
         from public.lesson_run_execution_capability
         where lesson_run_id =
             'cf700000-0000-4000-8000-000000000001'
           and learner_profile_id =
             'cf300000-0000-4000-8000-000000000001'
           and status = 'active'
           and enrollment_revision = 3
       )
     then 'serialized' else '' end"
)"
if [[ "$race_fourteen_state" != "serialized" ]]; then
  echo "Race 14 did not persist the explicit grant revisions." >&2
  exit 1
fi

# Race 15: explicit teacher revoke uses the same learner lock. A source read
# must wait until commit and then receive the stable authority-denial token;
# it may never return the content observed before the revoke.
PGAPPNAME="$race_fifteen_revoke_app" \
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 \
  >"$race_fifteen_revoke_log" 2>&1 <<'SQL' &
begin;
set local statement_timeout = '15s';
select set_config(
  'request.jwt.claim.sub',
  'ca100000-0000-4000-8000-000000000001',
  true
);
set local role authenticated;
select public.set_lesson_run_live_access(
  'cf700000-0000-4000-8000-000000000001',
  'cf300000-0000-4000-8000-000000000001',
  false,
  false
);
select pg_sleep(6);
commit;
SQL
race_fifteen_revoke_pid=$!

if ! wait_for_sleeping_session \
  "$race_fifteen_revoke_app" \
  "$race_fifteen_revoke_pid"; then
  echo "Race 15 revoke did not reach its advisory-lock hold." >&2
  print_session_log "Race 15 revoke log" "$race_fifteen_revoke_log"
  exit 1
fi

PGAPPNAME="$race_fifteen_read_app" \
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 \
  >"$race_fifteen_read_log" 2>&1 <<'SQL' &
begin;
set local statement_timeout = '15s';
set local role service_role;
do $read$
begin
  begin
    perform public.resolve_lesson_run_live_source_admin(
      'cf100000-0000-4000-8000-000000000001',
      'cf110000-0000-4000-8000-000000000001',
      'cf700000-0000-4000-8000-000000000001'
    );
    raise exception 'race_15_expected_live_read_denial';
  exception
    when sqlstate 'P0002' then
      if sqlerrm <> 'lesson_run_live_not_found' then
        raise;
      end if;
  end;
end
$read$;
commit;
SQL
race_fifteen_read_pid=$!

if ! wait_for_blocked_pair \
  "$race_fifteen_read_app" \
  "$race_fifteen_revoke_app" \
  "$race_fifteen_read_pid"; then
  echo "Race 15 live read was not observed waiting on revoke." >&2
  print_session_log "Race 15 revoke log" "$race_fifteen_revoke_log"
  print_session_log "Race 15 live-read log" "$race_fifteen_read_log"
  exit 1
fi

set +e
wait "$race_fifteen_revoke_pid"
race_fifteen_revoke_status=$?
race_fifteen_revoke_pid=""
wait "$race_fifteen_read_pid"
race_fifteen_read_status=$?
race_fifteen_read_pid=""
set -e

if [[ "$race_fifteen_revoke_status" -ne 0 ]] \
  || [[ "$race_fifteen_read_status" -ne 0 ]]; then
  echo "Race 15 revoke/live-read transactions did not finish safely." >&2
  print_session_log "Race 15 revoke log" "$race_fifteen_revoke_log"
  print_session_log "Race 15 live-read log" "$race_fifteen_read_log"
  exit 1
fi

race_fifteen_state="$(
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -Atqc \
    "select case when
       exists (
         select 1
         from public.course_learner_enrollment
         where course_id = 'cf400000-0000-4000-8000-000000000001'
           and learner_profile_id =
             'cf300000-0000-4000-8000-000000000001'
           and status = 'revoked'
           and revision = 4
           and revocation_reason = 'teacher_revoked_course_access'
       )
       and not exists (
         select 1
         from public.lesson_run_execution_capability
         where course_id = 'cf400000-0000-4000-8000-000000000001'
           and learner_profile_id =
             'cf300000-0000-4000-8000-000000000001'
           and status = 'active'
       )
       and exists (
         select 1
         from public.lesson_run_execution_capability
         where lesson_run_id =
             'cf700000-0000-4000-8000-000000000001'
           and learner_profile_id =
             'cf300000-0000-4000-8000-000000000001'
           and revocation_reason = 'teacher_revoked_course_access'
       )
     then 'serialized' else '' end"
)"
if [[ "$race_fifteen_state" != "serialized" ]]; then
  echo "Race 15 left learner authority active after revoke." >&2
  exit 1
fi

# Race 15b: start from a revoked enrollment, grant it in one transaction, then
# deactivate the linked learner Account concurrently. The status writer must
# block on the exact learner Account lock; after grant commit its trigger sees
# and revokes the new rows, so later reactivation cannot revive them.
PGAPPNAME="$race_fifteen_grant_status_app" \
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 \
  >"$race_fifteen_grant_status_log" 2>&1 <<'SQL' &
begin;
set local statement_timeout = '15s';
select set_config(
  'request.jwt.claim.sub',
  'ca100000-0000-4000-8000-000000000001',
  true
);
set local role authenticated;
select public.set_lesson_run_live_access(
  'cf700000-0000-4000-8000-000000000001',
  'cf300000-0000-4000-8000-000000000001',
  true,
  true
);
select pg_sleep(6);
commit;
SQL
race_fifteen_grant_status_pid=$!

if ! wait_for_sleeping_session \
  "$race_fifteen_grant_status_app" \
  "$race_fifteen_grant_status_pid"; then
  echo "Race 15b grant did not reach its learner-Account lock hold." >&2
  print_session_log "Race 15b grant log" "$race_fifteen_grant_status_log"
  exit 1
fi

PGAPPNAME="$race_fifteen_status_after_grant_app" \
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 \
  >"$race_fifteen_status_after_grant_log" 2>&1 <<'SQL' &
begin;
set local statement_timeout = '15s';
update public.account
set status = 'suspended'
where id = 'cf200000-0000-4000-8000-000000000001';
commit;
SQL
race_fifteen_status_after_grant_pid=$!

if ! wait_for_blocked_pair \
  "$race_fifteen_status_after_grant_app" \
  "$race_fifteen_grant_status_app" \
  "$race_fifteen_status_after_grant_pid"; then
  echo "Race 15b Account deactivation did not wait on the concurrent grant." >&2
  print_session_log "Race 15b grant log" "$race_fifteen_grant_status_log"
  print_session_log \
    "Race 15b status log" \
    "$race_fifteen_status_after_grant_log"
  exit 1
fi

set +e
wait "$race_fifteen_grant_status_pid"
race_fifteen_grant_status_status=$?
race_fifteen_grant_status_pid=""
wait "$race_fifteen_status_after_grant_pid"
race_fifteen_status_after_grant_status=$?
race_fifteen_status_after_grant_pid=""
set -e

if [[ "$race_fifteen_grant_status_status" -ne 0 ]] \
  || [[ "$race_fifteen_status_after_grant_status" -ne 0 ]]; then
  echo "Race 15b grant/account-deactivation transactions failed." >&2
  print_session_log "Race 15b grant log" "$race_fifteen_grant_status_log"
  print_session_log \
    "Race 15b status log" \
    "$race_fifteen_status_after_grant_log"
  exit 1
fi

race_fifteen_status_state="$(
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -Atqc \
    "select case when
       exists (
         select 1
         from public.account
         where id = 'cf200000-0000-4000-8000-000000000001'
           and status = 'suspended'
       )
       and exists (
         select 1
         from public.course_learner_enrollment
         where course_id = 'cf400000-0000-4000-8000-000000000001'
           and learner_profile_id =
             'cf300000-0000-4000-8000-000000000001'
           and status = 'revoked'
           and revision = 6
           and revocation_reason = 'learner_account_deactivated'
       )
       and not exists (
         select 1
         from public.lesson_run_execution_capability
         where course_id = 'cf400000-0000-4000-8000-000000000001'
           and learner_profile_id =
             'cf300000-0000-4000-8000-000000000001'
           and status = 'active'
       )
     then 'serialized' else '' end"
)"
if [[ "$race_fifteen_status_state" != "serialized" ]]; then
  echo "Race 15b left the concurrent grant active after deactivation." >&2
  exit 1
fi

update_status_reactivate="$(
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -Atqc \
    "update public.account
     set status = 'active'
     where id = 'cf200000-0000-4000-8000-000000000001'
     returning status"
)"
if [[ "$update_status_reactivate" != "active" ]]; then
  echo "Race 15b fixture could not reactivate the learner Account." >&2
  exit 1
fi

# Restore authority explicitly for all three already-actual Runs. This is a
# fixture transition, not implicit reactivation; ended/cancelled state races
# below start only after every capability is tied to revision 7.
psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 >/dev/null <<'SQL'
begin;
select set_config(
  'request.jwt.claim.sub',
  'ca100000-0000-4000-8000-000000000001',
  true
);
set local role authenticated;
select public.set_lesson_run_live_access(
  'cf700000-0000-4000-8000-000000000001',
  'cf300000-0000-4000-8000-000000000001',
  true,
  true
);
select public.set_lesson_run_live_access(
  'cf700000-0000-4000-8000-000000000002',
  'cf300000-0000-4000-8000-000000000001',
  true,
  true
);
select public.set_lesson_run_live_access(
  'cf700000-0000-4000-8000-000000000003',
  'cf300000-0000-4000-8000-000000000001',
  true,
  true
);
commit;
SQL

run_late_races_sixteen_and_seventeen

# Race 18: cursor selection locks the target Slide before state. A concurrent
# reorder of that same Slide must wait, then preserve the selected stable ID
# while the learner source observes its committed new position.
PGAPPNAME="$race_eighteen_cursor_app" \
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 \
  >"$race_eighteen_cursor_log" 2>&1 <<'SQL' &
begin;
set local statement_timeout = '15s';
select set_config(
  'request.jwt.claim.sub',
  'ca100000-0000-4000-8000-000000000001',
  true
);
set local role authenticated;
select public.set_lesson_run_presentation_cursor(
  'cf700000-0000-4000-8000-000000000003',
  'cf550000-0000-4000-8000-000000000003',
  0
);
select pg_sleep(6);
commit;
SQL
race_eighteen_cursor_pid=$!

if ! wait_for_sleeping_session \
  "$race_eighteen_cursor_app" \
  "$race_eighteen_cursor_pid"; then
  echo "Race 18 cursor did not reach its Slide/state lock hold." >&2
  print_session_log "Race 18 cursor log" "$race_eighteen_cursor_log"
  exit 1
fi

PGAPPNAME="$race_eighteen_reorder_app" \
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 \
  >"$race_eighteen_reorder_log" 2>&1 <<'SQL' &
begin;
set local statement_timeout = '15s';
set constraints all deferred;
update public.lesson_student_slide
set position = 3
where id = 'cf550000-0000-4000-8000-000000000003';
update public.lesson_student_slide
set position = 1
where id = 'cf550000-0000-4000-8000-000000000004';
update public.lesson_student_slide
set position = 2
where id = 'cf550000-0000-4000-8000-000000000003';
-- Slide order is a projection of learner-visible Component order. Reorder the
-- two Components in the same deferred transaction so the final authored
-- hierarchy remains valid while the target Slide row is genuinely updated.
update public.lesson_component
set position = 3
where id = 'cf600000-0000-4000-8000-000000000003';
update public.lesson_component
set position = 1
where id = 'cf600000-0000-4000-8000-000000000004';
update public.lesson_component
set position = 2
where id = 'cf600000-0000-4000-8000-000000000003';
commit;
SQL
race_eighteen_reorder_pid=$!

if ! wait_for_blocked_pair \
  "$race_eighteen_reorder_app" \
  "$race_eighteen_cursor_app" \
  "$race_eighteen_reorder_pid"; then
  echo "Race 18 reorder was not observed waiting on cursor's Slide lock." >&2
  print_session_log "Race 18 cursor log" "$race_eighteen_cursor_log"
  print_session_log "Race 18 reorder log" "$race_eighteen_reorder_log"
  exit 1
fi

set +e
wait "$race_eighteen_cursor_pid"
race_eighteen_cursor_status=$?
race_eighteen_cursor_pid=""
wait "$race_eighteen_reorder_pid"
race_eighteen_reorder_status=$?
race_eighteen_reorder_pid=""
set -e

if [[ "$race_eighteen_cursor_status" -ne 0 ]] \
  || [[ "$race_eighteen_reorder_status" -ne 0 ]]; then
  echo "Race 18 cursor/reorder transactions did not both commit." >&2
  print_session_log "Race 18 cursor log" "$race_eighteen_cursor_log"
  print_session_log "Race 18 reorder log" "$race_eighteen_reorder_log"
  exit 1
fi

race_eighteen_state="$(
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -Atqc \
    "select case when
       exists (
         select 1
         from public.lesson_run_presentation_state as state
         join public.lesson_student_slide as slide
           on slide.id = state.student_slide_id
         where state.lesson_run_id =
             'cf700000-0000-4000-8000-000000000003'
           and state.student_slide_id =
             'cf550000-0000-4000-8000-000000000003'
           and state.cursor_version = 1
           and slide.position = 2
       )
       and public.resolve_lesson_run_live_source_admin(
         'cf100000-0000-4000-8000-000000000001',
         'cf110000-0000-4000-8000-000000000001',
         'cf700000-0000-4000-8000-000000000003'
       ) #>> '{slide,position}' = '2'
       and public.resolve_lesson_run_live_source_admin(
         'cf100000-0000-4000-8000-000000000001',
         'cf110000-0000-4000-8000-000000000001',
         'cf700000-0000-4000-8000-000000000003'
       ) #>> '{slide,components,0,payload,content}' =
         'LA_M4_SLIDE_MUTATION_A'
     then 'serialized' else '' end"
)"
if [[ "$race_eighteen_state" != "serialized" ]]; then
  echo "Race 18 lost stable cursor identity across Slide reorder." >&2
  exit 1
fi

# Race 19: the cursor locks Slide before state while an authored component
# DELETE empties that Slide. Cleanup must wait on the Slide, then delete it;
# the BEFORE Slide trigger clears the cursor and bumps exactly once without a
# state<->Slide deadlock.
PGAPPNAME="$race_nineteen_cursor_app" \
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 \
  >"$race_nineteen_cursor_log" 2>&1 <<'SQL' &
begin;
set local statement_timeout = '15s';
select set_config(
  'request.jwt.claim.sub',
  'ca100000-0000-4000-8000-000000000001',
  true
);
set local role authenticated;
select public.set_lesson_run_presentation_cursor(
  'cf700000-0000-4000-8000-000000000003',
  'cf550000-0000-4000-8000-000000000003',
  1
);
select pg_sleep(6);
commit;
SQL
race_nineteen_cursor_pid=$!

if ! wait_for_sleeping_session \
  "$race_nineteen_cursor_app" \
  "$race_nineteen_cursor_pid"; then
  echo "Race 19 cursor did not reach its Slide/state lock hold." >&2
  print_session_log "Race 19 cursor log" "$race_nineteen_cursor_log"
  exit 1
fi

PGAPPNAME="$race_nineteen_delete_app" \
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 \
  >"$race_nineteen_delete_log" 2>&1 <<'SQL' &
begin;
set local statement_timeout = '15s';
delete from public.lesson_component
where id = 'cf600000-0000-4000-8000-000000000003';
commit;
SQL
race_nineteen_delete_pid=$!

if ! wait_for_blocked_pair \
  "$race_nineteen_delete_app" \
  "$race_nineteen_cursor_app" \
  "$race_nineteen_delete_pid"; then
  echo "Race 19 empty-Slide cleanup was not observed waiting on cursor." >&2
  print_session_log "Race 19 cursor log" "$race_nineteen_cursor_log"
  print_session_log "Race 19 delete log" "$race_nineteen_delete_log"
  exit 1
fi

set +e
wait "$race_nineteen_cursor_pid"
race_nineteen_cursor_status=$?
race_nineteen_cursor_pid=""
wait "$race_nineteen_delete_pid"
race_nineteen_delete_status=$?
race_nineteen_delete_pid=""
set -e

if [[ "$race_nineteen_cursor_status" -ne 0 ]] \
  || [[ "$race_nineteen_delete_status" -ne 0 ]]; then
  echo "Race 19 cursor/delete transactions did not both commit." >&2
  print_session_log "Race 19 cursor log" "$race_nineteen_cursor_log"
  print_session_log "Race 19 delete log" "$race_nineteen_delete_log"
  exit 1
fi

race_nineteen_state="$(
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -Atqc \
    "select case when
       not exists (
         select 1 from public.lesson_component
         where id = 'cf600000-0000-4000-8000-000000000003'
       )
       and not exists (
         select 1 from public.lesson_student_slide
         where id = 'cf550000-0000-4000-8000-000000000003'
       )
       and exists (
         select 1
         from public.lesson_student_slide
         where id = 'cf550000-0000-4000-8000-000000000004'
           and position = 1
       )
       and exists (
         select 1
         from public.lesson_run_presentation_state
         where lesson_run_id =
             'cf700000-0000-4000-8000-000000000003'
           and student_slide_id is null
           and cursor_version = 3
       )
       and public.resolve_lesson_run_live_source_admin(
         'cf100000-0000-4000-8000-000000000001',
         'cf110000-0000-4000-8000-000000000001',
         'cf700000-0000-4000-8000-000000000003'
       ) = '{\"state\": \"waiting\", \"cursorRevision\": 3}'::jsonb
     then 'serialized' else '' end"
)"
if [[ "$race_nineteen_state" != "serialized" ]]; then
  echo "Race 19 deadlock-safe cleanup did not clear/bump exactly once." >&2
  exit 1
fi

# Race 20: Account.status is a non-key authority UPDATE. Its trigger revokes
# all Course/Run authority and retains the Account row lock through commit. A
# resolver that discovered the old active row must block on FOR SHARE, then
# fail closed; reactivation alone must not restore the revoked grants.
PGAPPNAME="$race_twenty_status_app" \
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 \
  >"$race_twenty_status_log" 2>&1 <<'SQL' &
begin;
set local statement_timeout = '15s';
update public.account
set status = 'suspended'
where id = 'cf200000-0000-4000-8000-000000000001';
select pg_sleep(6);
commit;
SQL
race_twenty_status_pid=$!

if ! wait_for_sleeping_session \
  "$race_twenty_status_app" \
  "$race_twenty_status_pid"; then
  echo "Race 20 Account status writer did not reach its lock hold." >&2
  print_session_log "Race 20 status log" "$race_twenty_status_log"
  exit 1
fi

PGAPPNAME="$race_twenty_read_app" \
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 \
  >"$race_twenty_read_log" 2>&1 <<'SQL' &
begin;
set local statement_timeout = '15s';
set local role service_role;
do $read$
begin
  begin
    perform public.resolve_lesson_run_live_source_admin(
      'cf100000-0000-4000-8000-000000000001',
      'cf110000-0000-4000-8000-000000000001',
      'cf700000-0000-4000-8000-000000000003'
    );
    raise exception 'race_20_expected_inactive_account_denial';
  exception
    when sqlstate 'P0002' then
      if sqlerrm <> 'lesson_run_live_not_found' then
        raise;
      end if;
  end;
end
$read$;
commit;
SQL
race_twenty_read_pid=$!

if ! wait_for_blocked_pair \
  "$race_twenty_read_app" \
  "$race_twenty_status_app" \
  "$race_twenty_read_pid"; then
  echo "Race 20 live read was not observed waiting on Account status." >&2
  print_session_log "Race 20 status log" "$race_twenty_status_log"
  print_session_log "Race 20 live-read log" "$race_twenty_read_log"
  exit 1
fi

set +e
wait "$race_twenty_status_pid"
race_twenty_status_status=$?
race_twenty_status_pid=""
wait "$race_twenty_read_pid"
race_twenty_read_status=$?
race_twenty_read_pid=""
set -e

if [[ "$race_twenty_status_status" -ne 0 ]] \
  || [[ "$race_twenty_read_status" -ne 0 ]]; then
  echo "Race 20 status/live-read transactions did not finish safely." >&2
  print_session_log "Race 20 status log" "$race_twenty_status_log"
  print_session_log "Race 20 live-read log" "$race_twenty_read_log"
  exit 1
fi

psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 >/dev/null <<'SQL'
begin;

do $assert$
begin
  if not exists (
      select 1
      from public.course_learner_enrollment
      where course_id = 'cf400000-0000-4000-8000-000000000001'
        and learner_profile_id =
          'cf300000-0000-4000-8000-000000000001'
        and status = 'revoked'
        and revision = 8
        and revocation_reason = 'learner_account_deactivated'
    )
    or exists (
      select 1
      from public.lesson_run_execution_capability
      where course_id = 'cf400000-0000-4000-8000-000000000001'
        and learner_profile_id =
          'cf300000-0000-4000-8000-000000000001'
        and status = 'active'
    )
  then
    raise exception 'race_20_account_deactivation_did_not_revoke';
  end if;
end
$assert$;

-- Reactivation deliberately leaves revision 8 revoked. Only this explicit
-- teacher action creates revision 9 and a new Run-3 capability.
update public.account
set status = 'active'
where id = 'cf200000-0000-4000-8000-000000000001';

select set_config(
  'request.jwt.claim.sub',
  'ca100000-0000-4000-8000-000000000001',
  true
);
set local role authenticated;
select public.set_lesson_run_live_access(
  'cf700000-0000-4000-8000-000000000003',
  'cf300000-0000-4000-8000-000000000001',
  true,
  true
);
commit;
SQL

# Race 20b: a Session delete that starts first leaves its old tuple visible to
# the resolver's optimistic discovery read, then holds that tuple through
# commit. The legacy wrapper must delegate to the new resolver, which acquires
# the learner advisory lock before waiting for the locked Session re-read. The
# committed delete must yield the exact denial without a 40P01 deadlock.
PGAPPNAME="$race_twenty_b_session_app" \
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 \
  >"$race_twenty_b_session_log" 2>&1 <<'SQL' &
begin;
set local statement_timeout = '15s';
delete from auth.sessions
where id = 'cf110000-0000-4000-8000-000000000002';
select pg_sleep(6);
commit;
SQL
race_twenty_b_session_pid=$!

if ! wait_for_sleeping_session \
  "$race_twenty_b_session_app" \
  "$race_twenty_b_session_pid"; then
  echo "Race 20b Session delete did not reach its tuple-lock hold." >&2
  print_session_log "Race 20b Session-delete log" \
    "$race_twenty_b_session_log"
  exit 1
fi

PGAPPNAME="$race_twenty_b_read_app" \
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 \
  >"$race_twenty_b_read_log" 2>&1 <<'SQL' &
begin;
set local statement_timeout = '15s';
set local role service_role;
do $read$
begin
  begin
    perform public.resolve_lesson_run_live_source_admin(
      'cf100000-0000-4000-8000-000000000001',
      'cf110000-0000-4000-8000-000000000002',
      'cf700000-0000-4000-8000-000000000003'
    );
    raise exception 'race_20b_expected_session_denial';
  exception
    when sqlstate '42501' then
      if sqlerrm <> 'live_delivery_session_revoked' then
        raise;
      end if;
  end;
end
$read$;
commit;
SQL
race_twenty_b_read_pid=$!

if ! wait_for_blocked_pair \
  "$race_twenty_b_read_app" \
  "$race_twenty_b_session_app" \
  "$race_twenty_b_read_pid"; then
  echo "Race 20b resolver was not observed waiting on Session." >&2
  print_session_log "Race 20b Session-delete log" \
    "$race_twenty_b_session_log"
  print_session_log "Race 20b resolver log" "$race_twenty_b_read_log"
  exit 1
fi

race_twenty_b_lock_state="$(
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -Atqc \
    "select case when exists (
       select 1
       from pg_catalog.pg_stat_activity as activity
       join pg_catalog.pg_locks as held_lock
         on held_lock.pid = activity.pid
       where activity.application_name = '$race_twenty_b_read_app'
         and held_lock.locktype = 'advisory'
         and held_lock.granted
     ) then 'learner-before-session' else '' end"
)"
if [[ "$race_twenty_b_lock_state" != "learner-before-session" ]]; then
  echo "Race 20b resolver did not hold learner lock while waiting on Session." >&2
  print_session_log "Race 20b Session-delete log" \
    "$race_twenty_b_session_log"
  print_session_log "Race 20b resolver log" "$race_twenty_b_read_log"
  exit 1
fi

set +e
wait "$race_twenty_b_session_pid"
race_twenty_b_session_status=$?
race_twenty_b_session_pid=""
wait "$race_twenty_b_read_pid"
race_twenty_b_read_status=$?
race_twenty_b_read_pid=""
set -e

if [[ "$race_twenty_b_session_status" -ne 0 ]] \
  || [[ "$race_twenty_b_read_status" -ne 0 ]]; then
  echo "Race 20b Session-delete/resolver transactions did not serialize." >&2
  print_session_log "Race 20b Session-delete log" \
    "$race_twenty_b_session_log"
  print_session_log "Race 20b resolver log" "$race_twenty_b_read_log"
  exit 1
fi

race_twenty_b_state="$(
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -Atqc \
    "select case when
       not exists (
         select 1 from auth.sessions
         where id = 'cf110000-0000-4000-8000-000000000002'
       )
       and exists (
         select 1 from auth.sessions
         where id = 'cf110000-0000-4000-8000-000000000001'
           and user_id = 'cf100000-0000-4000-8000-000000000001'
       )
       and exists (
         select 1
         from public.course_learner_enrollment
         where course_id = 'cf400000-0000-4000-8000-000000000001'
           and learner_profile_id =
             'cf300000-0000-4000-8000-000000000001'
           and status = 'active'
           and revision = 9
       )
       and exists (
         select 1
         from public.lesson_run_execution_capability
         where lesson_run_id =
             'cf700000-0000-4000-8000-000000000003'
           and learner_profile_id =
             'cf300000-0000-4000-8000-000000000001'
           and enrollment_revision = 9
           and status = 'active'
       )
     then 'serialized' else '' end"
)"
if [[ "$race_twenty_b_state" != "serialized" ]]; then
  echo "Race 20b Session denial mutated unrelated live authority." >&2
  exit 1
fi

# Race 21: session cutoff is another ordinary non-key UPDATE. The resolver's
# exact account_security SHARE lock must serialize with revoke_user_sessions;
# after commit it denies the old session but intentionally keeps grants intact.
PGAPPNAME="$race_twenty_one_cutoff_app" \
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 \
  >"$race_twenty_one_cutoff_log" 2>&1 <<'SQL' &
begin;
set local statement_timeout = '15s';
select public.revoke_user_sessions_impl(
  'cf100000-0000-4000-8000-000000000001',
  clock_timestamp()
);
select pg_sleep(6);
commit;
SQL
race_twenty_one_cutoff_pid=$!

if ! wait_for_sleeping_session \
  "$race_twenty_one_cutoff_app" \
  "$race_twenty_one_cutoff_pid"; then
  echo "Race 21 session cutoff did not reach its security-row lock hold." >&2
  print_session_log "Race 21 cutoff log" "$race_twenty_one_cutoff_log"
  exit 1
fi

PGAPPNAME="$race_twenty_one_read_app" \
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 \
  >"$race_twenty_one_read_log" 2>&1 <<'SQL' &
begin;
set local statement_timeout = '15s';
set local role service_role;
do $read$
begin
  begin
    perform public.resolve_lesson_run_live_source_admin(
      'cf100000-0000-4000-8000-000000000001',
      'cf110000-0000-4000-8000-000000000001',
      'cf700000-0000-4000-8000-000000000003'
    );
    raise exception 'race_21_expected_session_cutoff_denial';
  exception
    when sqlstate '42501' then
      if sqlerrm <> 'live_delivery_session_revoked' then
        raise;
      end if;
  end;
end
$read$;
commit;
SQL
race_twenty_one_read_pid=$!

if ! wait_for_blocked_pair \
  "$race_twenty_one_read_app" \
  "$race_twenty_one_cutoff_app" \
  "$race_twenty_one_read_pid"; then
  echo "Race 21 live read was not observed waiting on session cutoff." >&2
  print_session_log "Race 21 cutoff log" "$race_twenty_one_cutoff_log"
  print_session_log "Race 21 live-read log" "$race_twenty_one_read_log"
  exit 1
fi

set +e
wait "$race_twenty_one_cutoff_pid"
race_twenty_one_cutoff_status=$?
race_twenty_one_cutoff_pid=""
wait "$race_twenty_one_read_pid"
race_twenty_one_read_status=$?
race_twenty_one_read_pid=""
set -e

if [[ "$race_twenty_one_cutoff_status" -ne 0 ]] \
  || [[ "$race_twenty_one_read_status" -ne 0 ]]; then
  echo "Race 21 cutoff/live-read transactions did not finish safely." >&2
  print_session_log "Race 21 cutoff log" "$race_twenty_one_cutoff_log"
  print_session_log "Race 21 live-read log" "$race_twenty_one_read_log"
  exit 1
fi

race_twenty_one_state="$(
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -Atqc \
    "select case when
       exists (
         select 1
         from public.account_security as security
         join public.account as account
           on account.id = security.account_id
         join auth.sessions as session
           on session.user_id = account.auth_user_id
          and session.id = 'cf110000-0000-4000-8000-000000000001'
         where account.id = 'cf200000-0000-4000-8000-000000000001'
           and security.sessions_invalid_before > session.created_at
       )
       and exists (
         select 1
         from public.course_learner_enrollment
         where course_id = 'cf400000-0000-4000-8000-000000000001'
           and learner_profile_id =
             'cf300000-0000-4000-8000-000000000001'
           and status = 'active'
           and revision = 9
       )
       and exists (
         select 1
         from public.lesson_run_execution_capability
         where lesson_run_id =
             'cf700000-0000-4000-8000-000000000003'
           and learner_profile_id =
             'cf300000-0000-4000-8000-000000000001'
           and status = 'active'
           and enrollment_revision = 9
       )
     then 'serialized' else '' end"
)"
if [[ "$race_twenty_one_state" != "serialized" ]]; then
  echo "Race 21 changed grants or failed to persist the session cutoff." >&2
  exit 1
fi

# Race 22: Course-owner Account deactivation changes a non-key column after
# the cursor's initial lookup. The cursor must wait on its authoritative
# Account FOR SHARE revalidation and then fail closed without a revision bump.
PGAPPNAME="$race_twenty_two_owner_status_app" \
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 \
  >"$race_twenty_two_owner_status_log" 2>&1 <<'SQL' &
begin;
set local statement_timeout = '15s';
update public.account
set status = 'suspended'
where id = 'ca200000-0000-4000-8000-000000000001';
select pg_sleep(6);
commit;
SQL
race_twenty_two_owner_status_pid=$!

if ! wait_for_sleeping_session \
  "$race_twenty_two_owner_status_app" \
  "$race_twenty_two_owner_status_pid"; then
  echo "Race 22 owner status did not reach its Account lock hold." >&2
  print_session_log \
    "Race 22 owner-status log" \
    "$race_twenty_two_owner_status_log"
  exit 1
fi

PGAPPNAME="$race_twenty_two_cursor_app" \
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 \
  >"$race_twenty_two_cursor_log" 2>&1 <<'SQL' &
begin;
set local statement_timeout = '15s';
select set_config(
  'request.jwt.claim.sub',
  'ca100000-0000-4000-8000-000000000001',
  true
);
set local role authenticated;
do $cursor$
begin
  begin
    perform public.set_lesson_run_presentation_cursor(
      'cf700000-0000-4000-8000-000000000003',
      'cf550000-0000-4000-8000-000000000004',
      3
    );
    raise exception 'race_22_expected_owner_status_denial';
  exception
    when sqlstate 'P0002' then
      if sqlerrm <> 'lesson_run_live_not_found' then
        raise;
      end if;
  end;
end
$cursor$;
commit;
SQL
race_twenty_two_cursor_pid=$!

if ! wait_for_blocked_pair \
  "$race_twenty_two_cursor_app" \
  "$race_twenty_two_owner_status_app" \
  "$race_twenty_two_cursor_pid"; then
  echo "Race 22 cursor did not wait on Course-owner deactivation." >&2
  print_session_log \
    "Race 22 owner-status log" \
    "$race_twenty_two_owner_status_log"
  print_session_log "Race 22 cursor log" "$race_twenty_two_cursor_log"
  exit 1
fi

set +e
wait "$race_twenty_two_owner_status_pid"
race_twenty_two_owner_status_status=$?
race_twenty_two_owner_status_pid=""
wait "$race_twenty_two_cursor_pid"
race_twenty_two_cursor_status=$?
race_twenty_two_cursor_pid=""
set -e

if [[ "$race_twenty_two_owner_status_status" -ne 0 ]] \
  || [[ "$race_twenty_two_cursor_status" -ne 0 ]]; then
  echo "Race 22 owner-status/cursor transactions did not finish safely." >&2
  print_session_log \
    "Race 22 owner-status log" \
    "$race_twenty_two_owner_status_log"
  print_session_log "Race 22 cursor log" "$race_twenty_two_cursor_log"
  exit 1
fi

race_twenty_two_state="$(
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -Atqc \
    "select case when
       exists (
         select 1
         from public.course_learner_enrollment
         where course_id = 'cf400000-0000-4000-8000-000000000001'
           and learner_profile_id =
             'cf300000-0000-4000-8000-000000000001'
           and status = 'revoked'
           and revision = 10
           and revocation_reason = 'course_owner_account_deactivated'
       )
       and exists (
         select 1
         from public.lesson_run_presentation_state
         where lesson_run_id =
             'cf700000-0000-4000-8000-000000000003'
           and student_slide_id is null
           and cursor_version = 3
       )
     then 'serialized' else '' end"
)"
if [[ "$race_twenty_two_state" != "serialized" ]]; then
  echo "Race 22 cursor advanced or owner authority remained active." >&2
  exit 1
fi

psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -c \
  "update public.account
   set status = 'active'
   where id = 'ca200000-0000-4000-8000-000000000001'" \
  >/dev/null

# The canonical archive guard forbids a Course archive while any Run is open.
# Restore authority explicitly, then cancel the final open Run so Race 23 uses
# the supported archive path and its real revocation trigger.
psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 >/dev/null <<'SQL'
begin;
select set_config(
  'request.jwt.claim.sub',
  'ca100000-0000-4000-8000-000000000001',
  true
);
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', 'ca100000-0000-4000-8000-000000000001',
    'session_id', 'ca110000-0000-4000-8000-000000000002',
    'role', 'authenticated'
  )::text,
  true
);
set local role authenticated;
select public.set_lesson_run_live_access(
  'cf700000-0000-4000-8000-000000000003',
  'cf300000-0000-4000-8000-000000000001',
  true,
  true
);
select public.cancel_lesson_run(
  'cf700000-0000-4000-8000-000000000003',
  '2026-08-21 12:30:00+09'
);
commit;
SQL

# Race 23: Course archive changes a non-key authority column after the
# cursor's initial lookup. The archive transaction owns Course and runs the
# real enrollment/capability revocation trigger. Cursor revalidation must wait
# on Course FOR SHARE, reject the committed archive, and leave the already-
# waiting cursor untouched. The Run is deliberately already cancelled because
# that is a prerequisite of the canonical Course archive contract.
PGAPPNAME="$race_twenty_three_archive_app" \
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 \
  >"$race_twenty_three_archive_log" 2>&1 <<'SQL' &
begin;
set local statement_timeout = '15s';
update public.course
set archived_at = clock_timestamp()
where id = 'cf400000-0000-4000-8000-000000000001';
select pg_sleep(6);
commit;
SQL
race_twenty_three_archive_pid=$!

if ! wait_for_sleeping_session \
  "$race_twenty_three_archive_app" \
  "$race_twenty_three_archive_pid"; then
  echo "Race 23 archive did not reach its Course lock hold." >&2
  print_session_log "Race 23 archive log" "$race_twenty_three_archive_log"
  exit 1
fi

PGAPPNAME="$race_twenty_three_cursor_app" \
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 \
  >"$race_twenty_three_cursor_log" 2>&1 <<'SQL' &
begin;
set local statement_timeout = '15s';
select set_config(
  'request.jwt.claim.sub',
  'ca100000-0000-4000-8000-000000000001',
  true
);
set local role authenticated;
do $cursor$
begin
  begin
    perform public.set_lesson_run_presentation_cursor(
      'cf700000-0000-4000-8000-000000000003',
      'cf550000-0000-4000-8000-000000000004',
      3
    );
    raise exception 'race_23_expected_archive_denial';
  exception
    when sqlstate 'P0002' then
      if sqlerrm <> 'lesson_run_live_not_found' then
        raise;
      end if;
  end;
end
$cursor$;
commit;
SQL
race_twenty_three_cursor_pid=$!

if ! wait_for_blocked_pair \
  "$race_twenty_three_cursor_app" \
  "$race_twenty_three_archive_app" \
  "$race_twenty_three_cursor_pid"; then
  echo "Race 23 cursor did not wait on Course archive." >&2
  print_session_log "Race 23 archive log" "$race_twenty_three_archive_log"
  print_session_log "Race 23 cursor log" "$race_twenty_three_cursor_log"
  exit 1
fi

set +e
wait "$race_twenty_three_archive_pid"
race_twenty_three_archive_status=$?
race_twenty_three_archive_pid=""
wait "$race_twenty_three_cursor_pid"
race_twenty_three_cursor_status=$?
race_twenty_three_cursor_pid=""
set -e

if [[ "$race_twenty_three_archive_status" -ne 0 ]] \
  || [[ "$race_twenty_three_cursor_status" -ne 0 ]]; then
  echo "Race 23 archive/cursor transactions did not finish safely." >&2
  print_session_log "Race 23 archive log" "$race_twenty_three_archive_log"
  print_session_log "Race 23 cursor log" "$race_twenty_three_cursor_log"
  exit 1
fi

race_twenty_three_state="$(
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -Atqc \
    "select case when
       exists (
         select 1
         from public.course
         where id = 'cf400000-0000-4000-8000-000000000001'
           and archived_at is not null
       )
       and exists (
         select 1
         from public.course_learner_enrollment
         where course_id = 'cf400000-0000-4000-8000-000000000001'
           and learner_profile_id =
             'cf300000-0000-4000-8000-000000000001'
           and status = 'revoked'
           and revision = 12
           and revocation_reason = 'course_archived'
       )
       and exists (
         select 1
         from public.lesson_run_execution_capability
         where lesson_run_id =
             'cf700000-0000-4000-8000-000000000003'
           and learner_profile_id =
             'cf300000-0000-4000-8000-000000000001'
           and status = 'revoked'
           and revocation_reason = 'course_archived'
       )
       and exists (
         select 1
         from public.lesson_run_presentation_state
         where lesson_run_id =
             'cf700000-0000-4000-8000-000000000003'
           and student_slide_id is null
           and cursor_version = 3
       )
     then 'serialized' else '' end"
)"
if [[ "$race_twenty_three_state" != "serialized" ]]; then
  echo "Race 23 archive race advanced the cursor or left Course open." >&2
  exit 1
fi

# Race 30: teacher correction validates and holds the exact auth session,
# active Account and security cutoff through commit. A concurrent cutoff must
# wait for the append-only correction, then revoke the old session; an exact
# correction replay after that cutoff is denied before idempotency replay.
race_choice_quiz_cutoff_evaluation_id="$(
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -Atqc \
    "select evaluation.id
     from public.choice_quiz_evaluation as evaluation
     join public.choice_quiz_issue as issue on issue.id = evaluation.issue_id
     where issue.learner_ref = '$race_choice_quiz_same_key_ref'
       and evaluation.evaluation_source = 'initial'
     order by evaluation.evaluated_at, evaluation.id
     limit 1"
)"
if [[ ! "$race_choice_quiz_cutoff_evaluation_id" =~ \
  ^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$ ]]; then
  echo "Race 30 could not resolve its initial Choice Quiz evaluation." >&2
  exit 1
fi

PGAPPNAME="$race_thirty_correction_app" \
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 \
  -v evaluation_id="$race_choice_quiz_cutoff_evaluation_id" \
  >"$race_thirty_correction_log" 2>&1 <<'SQL' &
begin;
set local statement_timeout = '15s';
set local role service_role;
select public.correct_choice_quiz_evaluation_admin(
  'ca100000-0000-4000-8000-000000000001',
  'ca110000-0000-4000-8000-000000000002',
  :'evaluation_id'::uuid,
  false,
  'Race 30 correction before teacher session cutoff',
  'd5b00000-0000-4000-8000-000000000030'
);
select pg_sleep(6);
commit;
SQL
race_thirty_correction_pid=$!

if ! wait_for_sleeping_session \
  "$race_thirty_correction_app" \
  "$race_thirty_correction_pid"; then
  echo "Race 30 correction did not reach its session-authority hold." >&2
  print_session_log \
    "Race 30 correction log" \
    "$race_thirty_correction_log"
  exit 1
fi

PGAPPNAME="$race_thirty_cutoff_app" \
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 \
  >"$race_thirty_cutoff_log" 2>&1 <<'SQL' &
begin;
set local statement_timeout = '15s';
update public.account_security as security
set sessions_invalid_before = (
  select session.created_at + interval '1 microsecond'
  from auth.sessions as session
  where session.id = 'ca110000-0000-4000-8000-000000000002'
)
where security.account_id = 'ca200000-0000-4000-8000-000000000001';
commit;
SQL
race_thirty_cutoff_pid=$!

if ! wait_for_blocked_pair \
  "$race_thirty_cutoff_app" \
  "$race_thirty_correction_app" \
  "$race_thirty_cutoff_pid"; then
  echo "Race 30 session cutoff was not observed waiting on correction." >&2
  print_session_log \
    "Race 30 correction log" \
    "$race_thirty_correction_log"
  print_session_log \
    "Race 30 cutoff log" \
    "$race_thirty_cutoff_log"
  exit 1
fi

set +e
wait "$race_thirty_correction_pid"
race_thirty_correction_status=$?
race_thirty_correction_pid=""
wait "$race_thirty_cutoff_pid"
race_thirty_cutoff_status=$?
race_thirty_cutoff_pid=""
set -e

if [[ "$race_thirty_correction_status" -ne 0 ]] \
  || [[ "$race_thirty_cutoff_status" -ne 0 ]]; then
  echo "Race 30 correction/session-cutoff transactions did not serialize." >&2
  print_session_log \
    "Race 30 correction log" \
    "$race_thirty_correction_log"
  print_session_log \
    "Race 30 cutoff log" \
    "$race_thirty_cutoff_log"
  exit 1
fi

psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 \
  -v evaluation_id="$race_choice_quiz_cutoff_evaluation_id" >/dev/null <<'SQL'
begin;
set local role service_role;
select set_config('shidao.test_evaluation_id', :'evaluation_id', true);
do $cutoff$
begin
  begin
    perform public.correct_choice_quiz_evaluation_admin(
      'ca100000-0000-4000-8000-000000000001',
      'ca110000-0000-4000-8000-000000000002',
      current_setting('shidao.test_evaluation_id')::uuid,
      false,
      'Race 30 correction before teacher session cutoff',
      'd5b00000-0000-4000-8000-000000000030'
    );
    raise exception 'race_30_expected_session_cutoff_denial';
  exception
    when sqlstate '42501' then
      if sqlerrm <> 'choice_quiz_session_revoked' then
        raise;
      end if;
  end;
end
$cutoff$;
commit;
SQL

race_thirty_state="$(
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -Atqc \
    "select case when
       exists (
         select 1
         from public.choice_quiz_evaluation as original
         join public.choice_quiz_evaluation as correction
           on correction.id = original.superseded_by_evaluation_id
         where original.id = '$race_choice_quiz_cutoff_evaluation_id'
           and correction.supersedes_evaluation_id = original.id
           and correction.correction_idempotency_key =
             'd5b00000-0000-4000-8000-000000000030'
           and correction.evaluation_source = 'teacher_correction'
           and not correction.is_correct
       )
       and exists (
         select 1
         from public.account_security as security
         join auth.sessions as session
           on session.id = 'ca110000-0000-4000-8000-000000000002'
         where security.account_id =
             'ca200000-0000-4000-8000-000000000001'
           and security.sessions_invalid_before > session.created_at
       )
     then 'serialized' else '' end"
)"
if [[ "$race_thirty_state" != "serialized" ]]; then
  echo "Race 30 lost correction history or failed to commit session cutoff." >&2
  exit 1
fi

# Restore only the cutoff so the independent active-Account race starts from
# valid trusted teacher authority. The preceding correction remains immutable.
psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -c \
  "update public.account_security
   set sessions_invalid_before = null
   where account_id = 'ca200000-0000-4000-8000-000000000001'" \
  >/dev/null

# Race 31: a second correction holds the active teacher Account through
# commit. Account deactivation must wait, then become authoritative; the
# accepted correction remains durable and every later replay fails closed.
race_choice_quiz_deactivate_evaluation_id="$(
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -Atqc \
    "select evaluation.id
     from public.choice_quiz_evaluation as evaluation
     join public.choice_quiz_attempt as attempt
       on attempt.id = evaluation.attempt_id
     join public.choice_quiz_issue as issue on issue.id = evaluation.issue_id
     where issue.learner_ref = '$race_choice_quiz_retry_ref'
       and attempt.attempt_number = 2
       and evaluation.evaluation_source = 'initial'
     limit 1"
)"
if [[ ! "$race_choice_quiz_deactivate_evaluation_id" =~ \
  ^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$ ]]; then
  echo "Race 31 could not resolve its retry Choice Quiz evaluation." >&2
  exit 1
fi

PGAPPNAME="$race_thirty_one_correction_app" \
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 \
  -v evaluation_id="$race_choice_quiz_deactivate_evaluation_id" \
  >"$race_thirty_one_correction_log" 2>&1 <<'SQL' &
begin;
set local statement_timeout = '15s';
set local role service_role;
select public.correct_choice_quiz_evaluation_admin(
  'ca100000-0000-4000-8000-000000000001',
  'ca110000-0000-4000-8000-000000000002',
  :'evaluation_id'::uuid,
  false,
  'Race 31 correction before teacher Account deactivation',
  'd5b00000-0000-4000-8000-000000000031'
);
select pg_sleep(6);
commit;
SQL
race_thirty_one_correction_pid=$!

if ! wait_for_sleeping_session \
  "$race_thirty_one_correction_app" \
  "$race_thirty_one_correction_pid"; then
  echo "Race 31 correction did not reach its active-Account hold." >&2
  print_session_log \
    "Race 31 correction log" \
    "$race_thirty_one_correction_log"
  exit 1
fi

PGAPPNAME="$race_thirty_one_deactivate_app" \
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 \
  >"$race_thirty_one_deactivate_log" 2>&1 <<'SQL' &
begin;
set local statement_timeout = '15s';
update public.account
set status = 'suspended'
where id = 'ca200000-0000-4000-8000-000000000001';
commit;
SQL
race_thirty_one_deactivate_pid=$!

if ! wait_for_blocked_pair \
  "$race_thirty_one_deactivate_app" \
  "$race_thirty_one_correction_app" \
  "$race_thirty_one_deactivate_pid"; then
  echo "Race 31 Account deactivation was not observed waiting on correction." >&2
  print_session_log \
    "Race 31 correction log" \
    "$race_thirty_one_correction_log"
  print_session_log \
    "Race 31 deactivation log" \
    "$race_thirty_one_deactivate_log"
  exit 1
fi

set +e
wait "$race_thirty_one_correction_pid"
race_thirty_one_correction_status=$?
race_thirty_one_correction_pid=""
wait "$race_thirty_one_deactivate_pid"
race_thirty_one_deactivate_status=$?
race_thirty_one_deactivate_pid=""
set -e

if [[ "$race_thirty_one_correction_status" -ne 0 ]] \
  || [[ "$race_thirty_one_deactivate_status" -ne 0 ]]; then
  echo "Race 31 correction/Account-deactivation transactions did not serialize." >&2
  print_session_log \
    "Race 31 correction log" \
    "$race_thirty_one_correction_log"
  print_session_log \
    "Race 31 deactivation log" \
    "$race_thirty_one_deactivate_log"
  exit 1
fi

psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 \
  -v evaluation_id="$race_choice_quiz_deactivate_evaluation_id" >/dev/null <<'SQL'
begin;
set local role service_role;
select set_config('shidao.test_evaluation_id', :'evaluation_id', true);
do $inactive$
begin
  begin
    perform public.correct_choice_quiz_evaluation_admin(
      'ca100000-0000-4000-8000-000000000001',
      'ca110000-0000-4000-8000-000000000002',
      current_setting('shidao.test_evaluation_id')::uuid,
      false,
      'Race 31 correction before teacher Account deactivation',
      'd5b00000-0000-4000-8000-000000000031'
    );
    raise exception 'race_31_expected_inactive_account_denial';
  exception
    when sqlstate 'P0002' then
      if sqlerrm <> 'choice_quiz_evaluation_not_found' then
        raise;
      end if;
  end;
end
$inactive$;
commit;
SQL

race_thirty_one_state="$(
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -Atqc \
    "select case when
       exists (
         select 1
         from public.account
         where id = 'ca200000-0000-4000-8000-000000000001'
           and status = 'suspended'
       )
       and exists (
         select 1
         from public.choice_quiz_evaluation as original
         join public.choice_quiz_evaluation as correction
           on correction.id = original.superseded_by_evaluation_id
         where original.id = '$race_choice_quiz_deactivate_evaluation_id'
           and correction.supersedes_evaluation_id = original.id
           and correction.correction_idempotency_key =
             'd5b00000-0000-4000-8000-000000000031'
           and correction.evaluation_source = 'teacher_correction'
           and not correction.is_correct
       )
     then 'serialized' else '' end"
)"
if [[ "$race_thirty_one_state" != "serialized" ]]; then
  echo "Race 31 lost correction history or active-Account revocation." >&2
  exit 1
fi

# Reactivation never restores learner delivery grants, but teacher history
# needs only the active owner/session and exact Course ownership. Reset that
# actor authority so the two independent history security races are isolated.
psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -c \
  "update public.account
   set status = 'active'
   where id = 'ca200000-0000-4000-8000-000000000001'" \
  >/dev/null

# Race 32: history holds the trusted teacher session and security cutoff
# through commit. A concurrent cutoff waits, then commits; every later read
# with that old session is denied before any teacher history is returned.
PGAPPNAME="$race_thirty_two_history_app" \
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 \
  >"$race_thirty_two_history_log" 2>&1 <<'SQL' &
begin;
set local statement_timeout = '15s';
set local role service_role;
select public.list_choice_quiz_run_history_admin(
  'ca100000-0000-4000-8000-000000000001',
  'ca110000-0000-4000-8000-000000000002',
  'd5700000-0000-4000-8000-000000000001'
);
select pg_sleep(6);
commit;
SQL
race_thirty_two_history_pid=$!

if ! wait_for_sleeping_session \
  "$race_thirty_two_history_app" \
  "$race_thirty_two_history_pid"; then
  echo "Race 32 history did not reach its teacher-session lock hold." >&2
  print_session_log \
    "Race 32 history log" \
    "$race_thirty_two_history_log"
  exit 1
fi

PGAPPNAME="$race_thirty_two_cutoff_app" \
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 \
  >"$race_thirty_two_cutoff_log" 2>&1 <<'SQL' &
begin;
set local statement_timeout = '15s';
update public.account_security as security
set sessions_invalid_before = (
  select session.created_at + interval '1 microsecond'
  from auth.sessions as session
  where session.id = 'ca110000-0000-4000-8000-000000000002'
)
where security.account_id = 'ca200000-0000-4000-8000-000000000001';
commit;
SQL
race_thirty_two_cutoff_pid=$!

if ! wait_for_blocked_pair \
  "$race_thirty_two_cutoff_app" \
  "$race_thirty_two_history_app" \
  "$race_thirty_two_cutoff_pid"; then
  echo "Race 32 cutoff was not observed waiting on teacher history." >&2
  print_session_log \
    "Race 32 history log" \
    "$race_thirty_two_history_log"
  print_session_log \
    "Race 32 cutoff log" \
    "$race_thirty_two_cutoff_log"
  exit 1
fi

set +e
wait "$race_thirty_two_history_pid"
race_thirty_two_history_status=$?
race_thirty_two_history_pid=""
wait "$race_thirty_two_cutoff_pid"
race_thirty_two_cutoff_status=$?
race_thirty_two_cutoff_pid=""
set -e

if [[ "$race_thirty_two_history_status" -ne 0 ]] \
  || [[ "$race_thirty_two_cutoff_status" -ne 0 ]]; then
  echo "Race 32 history/session-cutoff transactions did not serialize." >&2
  print_session_log \
    "Race 32 history log" \
    "$race_thirty_two_history_log"
  print_session_log \
    "Race 32 cutoff log" \
    "$race_thirty_two_cutoff_log"
  exit 1
fi

psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 >/dev/null <<'SQL'
begin;
set local role service_role;
do $cutoff$
begin
  begin
    perform public.list_choice_quiz_run_history_admin(
      'ca100000-0000-4000-8000-000000000001',
      'ca110000-0000-4000-8000-000000000002',
      'd5700000-0000-4000-8000-000000000001'
    );
    raise exception 'race_32_expected_history_session_cutoff_denial';
  exception
    when sqlstate '42501' then
      if sqlerrm <> 'choice_quiz_session_revoked' then
        raise;
      end if;
  end;
end
$cutoff$;
commit;
SQL

race_thirty_two_state="$(
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -Atqc \
    "select case when
       exists (
         select 1
         from public.account_security as security
         join auth.sessions as session
           on session.id = 'ca110000-0000-4000-8000-000000000002'
         where security.account_id =
             'ca200000-0000-4000-8000-000000000001'
           and security.sessions_invalid_before > session.created_at
       )
       and exists (
         select 1
         from public.choice_quiz_evaluation as evaluation
         where evaluation.correction_idempotency_key =
           'd5b00000-0000-4000-8000-000000000030'
       )
     then 'serialized' else '' end"
)"
if [[ "$race_thirty_two_state" != "serialized" ]]; then
  echo "Race 32 lost history state or failed to commit session cutoff." >&2
  exit 1
fi

psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -c \
  "update public.account_security
   set sessions_invalid_before = null
   where account_id = 'ca200000-0000-4000-8000-000000000001'" \
  >/dev/null

# Race 33: history likewise holds active teacher Account authority. Owner
# deactivation waits through the read transaction, then makes every later
# history request indistinguishable from an unavailable Run.
PGAPPNAME="$race_thirty_three_history_app" \
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 \
  >"$race_thirty_three_history_log" 2>&1 <<'SQL' &
begin;
set local statement_timeout = '15s';
set local role service_role;
select public.list_choice_quiz_run_history_admin(
  'ca100000-0000-4000-8000-000000000001',
  'ca110000-0000-4000-8000-000000000002',
  'd5700000-0000-4000-8000-000000000001'
);
select pg_sleep(6);
commit;
SQL
race_thirty_three_history_pid=$!

if ! wait_for_sleeping_session \
  "$race_thirty_three_history_app" \
  "$race_thirty_three_history_pid"; then
  echo "Race 33 history did not reach its active-owner hold." >&2
  print_session_log \
    "Race 33 history log" \
    "$race_thirty_three_history_log"
  exit 1
fi

PGAPPNAME="$race_thirty_three_deactivate_app" \
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 \
  >"$race_thirty_three_deactivate_log" 2>&1 <<'SQL' &
begin;
set local statement_timeout = '15s';
update public.account
set status = 'suspended'
where id = 'ca200000-0000-4000-8000-000000000001';
commit;
SQL
race_thirty_three_deactivate_pid=$!

if ! wait_for_blocked_pair \
  "$race_thirty_three_deactivate_app" \
  "$race_thirty_three_history_app" \
  "$race_thirty_three_deactivate_pid"; then
  echo "Race 33 owner deactivation was not observed waiting on history." >&2
  print_session_log \
    "Race 33 history log" \
    "$race_thirty_three_history_log"
  print_session_log \
    "Race 33 deactivation log" \
    "$race_thirty_three_deactivate_log"
  exit 1
fi

set +e
wait "$race_thirty_three_history_pid"
race_thirty_three_history_status=$?
race_thirty_three_history_pid=""
wait "$race_thirty_three_deactivate_pid"
race_thirty_three_deactivate_status=$?
race_thirty_three_deactivate_pid=""
set -e

if [[ "$race_thirty_three_history_status" -ne 0 ]] \
  || [[ "$race_thirty_three_deactivate_status" -ne 0 ]]; then
  echo "Race 33 history/owner-deactivation transactions did not serialize." >&2
  print_session_log \
    "Race 33 history log" \
    "$race_thirty_three_history_log"
  print_session_log \
    "Race 33 deactivation log" \
    "$race_thirty_three_deactivate_log"
  exit 1
fi

psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 >/dev/null <<'SQL'
begin;
set local role service_role;
do $inactive$
begin
  begin
    perform public.list_choice_quiz_run_history_admin(
      'ca100000-0000-4000-8000-000000000001',
      'ca110000-0000-4000-8000-000000000002',
      'd5700000-0000-4000-8000-000000000001'
    );
    raise exception 'race_33_expected_inactive_owner_history_denial';
  exception
    when sqlstate 'P0002' then
      if sqlerrm <> 'choice_quiz_history_not_found' then
        raise;
      end if;
  end;
end
$inactive$;
commit;
SQL

race_thirty_three_state="$(
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -Atqc \
    "select case when
       exists (
         select 1
         from public.account
         where id = 'ca200000-0000-4000-8000-000000000001'
           and status = 'suspended'
       )
       and exists (
         select 1
         from public.choice_quiz_issue
         where learner_ref = '$race_choice_quiz_same_key_ref'
       )
     then 'serialized' else '' end"
)"
if [[ "$race_thirty_three_state" != "serialized" ]]; then
  echo "Race 33 lost immutable history or active-owner revocation." >&2
  exit 1
fi

# Restore the owner for the final identity races. Reuse the canonical fresh
# profile created by Race 11's first erasure as an independent second learner;
# give it one real issued/answered quiz on still-open Run 2.
psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -c \
  "update public.account
   set status = 'active'
   where id = 'ca200000-0000-4000-8000-000000000001'" \
  >/dev/null

# Race 33c: correction is authorized by the current Course owner after taking
# the learner advisory lock. The correction holds Course FOR SHARE through
# commit, so an ownership transfer must wait. Once transfer commits, even the
# exact correction key/body from the former owner is denied before replay.
race_choice_quiz_owner_transfer_evaluation_id="$(
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -Atqc \
    "select evaluation.id
     from public.choice_quiz_evaluation as evaluation
     join public.choice_quiz_issue as issue on issue.id = evaluation.issue_id
     where issue.learner_ref = '$race_choice_quiz_cursor_ref'
       and evaluation.evaluation_source = 'initial'
     limit 1"
)"
if [[ ! "$race_choice_quiz_owner_transfer_evaluation_id" =~ \
  ^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$ ]]; then
  echo "Race 33c could not resolve its Choice Quiz evaluation." >&2
  exit 1
fi

PGAPPNAME="$race_thirty_three_c_correction_app" \
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 \
  -v evaluation_id="$race_choice_quiz_owner_transfer_evaluation_id" \
  >"$race_thirty_three_c_correction_log" 2>&1 <<'SQL' &
begin;
set local statement_timeout = '15s';
set local role service_role;
select public.correct_choice_quiz_evaluation_admin(
  'ca100000-0000-4000-8000-000000000001',
  'ca110000-0000-4000-8000-000000000002',
  :'evaluation_id'::uuid,
  false,
  'Race 33c correction before Course ownership transfer',
  'd5b00000-0000-4000-8000-000000000033'
);
select pg_sleep(6);
commit;
SQL
race_thirty_three_c_correction_pid=$!

if ! wait_for_sleeping_session \
  "$race_thirty_three_c_correction_app" \
  "$race_thirty_three_c_correction_pid"; then
  echo "Race 33c correction did not reach its Course-owner hold." >&2
  print_session_log \
    "Race 33c correction log" \
    "$race_thirty_three_c_correction_log"
  exit 1
fi

PGAPPNAME="$race_thirty_three_c_transfer_app" \
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 \
  >"$race_thirty_three_c_transfer_log" 2>&1 <<'SQL' &
begin;
set local statement_timeout = '15s';
update public.course
set owner_account_id = 'ca200000-0000-4000-8000-000000000002'
where id = 'd5400000-0000-4000-8000-000000000001';
commit;
SQL
race_thirty_three_c_transfer_pid=$!

if ! wait_for_blocked_pair \
  "$race_thirty_three_c_transfer_app" \
  "$race_thirty_three_c_correction_app" \
  "$race_thirty_three_c_transfer_pid"; then
  echo "Race 33c ownership transfer did not wait on correction." >&2
  print_session_log \
    "Race 33c correction log" \
    "$race_thirty_three_c_correction_log"
  print_session_log \
    "Race 33c ownership-transfer log" \
    "$race_thirty_three_c_transfer_log"
  exit 1
fi

set +e
wait "$race_thirty_three_c_correction_pid"
race_thirty_three_c_correction_status=$?
race_thirty_three_c_correction_pid=""
wait "$race_thirty_three_c_transfer_pid"
race_thirty_three_c_transfer_status=$?
race_thirty_three_c_transfer_pid=""
set -e

if [[ "$race_thirty_three_c_correction_status" -ne 0 ]] \
  || [[ "$race_thirty_three_c_transfer_status" -ne 0 ]]; then
  echo "Race 33c correction/ownership-transfer transactions did not serialize." >&2
  print_session_log \
    "Race 33c correction log" \
    "$race_thirty_three_c_correction_log"
  print_session_log \
    "Race 33c ownership-transfer log" \
    "$race_thirty_three_c_transfer_log"
  exit 1
fi

psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 \
  -v evaluation_id="$race_choice_quiz_owner_transfer_evaluation_id" \
  >/dev/null <<'SQL'
begin;
set local role service_role;
select set_config('shidao.test_evaluation_id', :'evaluation_id', true);
do $former_owner$
begin
  begin
    perform public.correct_choice_quiz_evaluation_admin(
      'ca100000-0000-4000-8000-000000000001',
      'ca110000-0000-4000-8000-000000000002',
      current_setting('shidao.test_evaluation_id')::uuid,
      false,
      'Race 33c correction before Course ownership transfer',
      'd5b00000-0000-4000-8000-000000000033'
    );
    raise exception 'race_33c_expected_former_owner_replay_denial';
  exception
    when sqlstate 'P0002' then
      if sqlerrm <> 'choice_quiz_evaluation_not_found' then
        raise;
      end if;
  end;
end;
$former_owner$;
commit;
SQL

race_thirty_three_c_state="$(
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -Atqc \
    "select case when
       exists (
         select 1
         from public.course
         where id = 'd5400000-0000-4000-8000-000000000001'
           and owner_account_id =
             'ca200000-0000-4000-8000-000000000002'
       )
       and (
         select count(*)
         from public.choice_quiz_evaluation
         where correction_idempotency_key =
           'd5b00000-0000-4000-8000-000000000033'
       ) = 1
     then 'serialized' else '' end"
)"
if [[ "$race_thirty_three_c_state" != "serialized" ]]; then
  echo "Race 33c lost correction history or current ownership." >&2
  exit 1
fi

# No enrollment is active after Race 33's owner deactivation, so restoring the
# fixture owner is a supported owner-row transition before the fresh grant.
psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -c \
  "update public.course
   set owner_account_id = 'ca200000-0000-4000-8000-000000000001'
   where id = 'd5400000-0000-4000-8000-000000000001'" \
  >/dev/null

race_history_erasure_fresh_profile_id="$(
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -Atqc \
    "select profile.id
     from public.learner_profile as profile
     where profile.account_id = 'ca200000-0000-4000-8000-000000000002'"
)"
if [[ ! "$race_history_erasure_fresh_profile_id" =~ \
  ^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$ ]]; then
  echo "LA-M5 history erasure fixture could not resolve the fresh learner." >&2
  exit 1
fi

psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 \
  -v learner_profile_id="$race_history_erasure_fresh_profile_id" \
  >/dev/null <<'SQL'
begin;
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
  'd5e80000-0000-4000-8000-000000000001',
  :'learner_profile_id'::uuid,
  'd5700000-0000-4000-8000-000000000002',
  'd5400000-0000-4000-8000-000000000001',
  'd5500000-0000-4000-8000-000000000002',
  'd5400000-0000-4000-8000-000000000001',
  'd5500000-0000-4000-8000-000000000002',
  'd5700000-0000-4000-8000-000000000002',
  'ca200000-0000-4000-8000-000000000001'
);
select set_config(
  'request.jwt.claim.sub',
  'ca100000-0000-4000-8000-000000000001',
  true
);
set local role authenticated;
select public.set_lesson_run_live_access(
  'd5700000-0000-4000-8000-000000000002',
  :'learner_profile_id'::uuid,
  true,
  true
);
commit;
SQL

# Race 33b: history must include the current Run roster in its canonical
# learner-lock set, not only learners that already own an Issue. History reads
# Run 2 before this fresh roster learner has any quiz graph and holds the
# learner advisory lock; a real issue+submit transaction must wait, then append
# one graph that is absent from the first response and present on reload.
PGAPPNAME="$race_thirty_three_b_history_app" \
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 \
  >"$race_thirty_three_b_history_log" 2>&1 <<'SQL' &
begin;
set local statement_timeout = '15s';
set local role service_role;
select public.list_choice_quiz_run_history_admin(
  'ca100000-0000-4000-8000-000000000001',
  'ca110000-0000-4000-8000-000000000002',
  'd5700000-0000-4000-8000-000000000002'
);
select pg_sleep(6);
commit;
SQL
race_thirty_three_b_history_pid=$!

if ! wait_for_sleeping_session \
  "$race_thirty_three_b_history_app" \
  "$race_thirty_three_b_history_pid"; then
  echo "Race 33b history did not reach its roster-learner hold." >&2
  print_session_log \
    "Race 33b history log" \
    "$race_thirty_three_b_history_log"
  exit 1
fi

PGAPPNAME="$race_thirty_three_b_issue_app" \
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 \
  >"$race_thirty_three_b_issue_log" 2>&1 <<'SQL' &
begin;
set local statement_timeout = '15s';
select component.updated_at::text as component_updated_at
from public.lesson_component as component
where component.id = 'd5600000-0000-4000-8000-000000000002'
\gset
set local role service_role;
select public.issue_choice_quiz_definition_admin(
  'ca100000-0000-4000-8000-000000000002',
  'ca110000-0000-4000-8000-000000000001',
  'd5700000-0000-4000-8000-000000000002',
  'd5600000-0000-4000-8000-000000000002',
  1,
  :'component_updated_at'::timestamptz,
  '{"question":"Choose Alpha.","allowMultiple":false,"options":[{"id":"d5100000-0000-4000-8000-000000000001","label":"Alpha"},{"id":"d5100000-0000-4000-8000-000000000002","label":"Beta"}]}'::jsonb,
  '{"correctOptionIds":["d5100000-0000-4000-8000-000000000001"],"allowMultiple":false,"explanation":"Alpha is the exact answer."}'::jsonb
) #>> '{execution,issueRef}' as issue_ref
\gset
select public.submit_choice_quiz_attempt_admin(
  'ca100000-0000-4000-8000-000000000002',
  'ca110000-0000-4000-8000-000000000001',
  'd5700000-0000-4000-8000-000000000002',
  :'issue_ref',
  1,
  'd5a00000-0000-4000-8000-000000000352',
  array['d5100000-0000-4000-8000-000000000001'::uuid]
);
commit;
SQL
race_thirty_three_b_issue_pid=$!

if ! wait_for_blocked_pair \
  "$race_thirty_three_b_issue_app" \
  "$race_thirty_three_b_history_app" \
  "$race_thirty_three_b_issue_pid"; then
  echo "Race 33b new-learner issue was not observed waiting on history." >&2
  print_session_log \
    "Race 33b history log" \
    "$race_thirty_three_b_history_log"
  print_session_log \
    "Race 33b issue/submit log" \
    "$race_thirty_three_b_issue_log"
  exit 1
fi

set +e
wait "$race_thirty_three_b_history_pid"
race_thirty_three_b_history_status=$?
race_thirty_three_b_history_pid=""
wait "$race_thirty_three_b_issue_pid"
race_thirty_three_b_issue_status=$?
race_thirty_three_b_issue_pid=""
set -e

race_choice_quiz_erasure_first_ref="$(
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -Atq \
    -v learner_profile_id="$race_history_erasure_fresh_profile_id" <<'SQL'
select issue.learner_ref
from public.choice_quiz_issue as issue
where issue.learner_profile_id = :'learner_profile_id'::uuid
  and issue.source_lesson_run_id_at_time =
    'd5700000-0000-4000-8000-000000000002'
  and issue.source_component_id_at_time =
    'd5600000-0000-4000-8000-000000000002';
SQL
)"
race_thirty_three_b_history_output="$(<"$race_thirty_three_b_history_log")"
if [[ "$race_thirty_three_b_history_status" -ne 0 ]] \
  || [[ "$race_thirty_three_b_issue_status" -ne 0 ]] \
  || [[ ! "$race_choice_quiz_erasure_first_ref" =~ ^cqi_[0-9a-f]{64}$ ]] \
  || [[ "$race_thirty_three_b_history_output" = \
    *"$race_choice_quiz_erasure_first_ref"* ]] \
  || [[ "$race_thirty_three_b_history_output" != \
    *"$race_choice_quiz_retry_ref"* ]]; then
  echo "Race 33b did not serialize history before a new roster learner issue." >&2
  print_session_log \
    "Race 33b history log" \
    "$race_thirty_three_b_history_log"
  print_session_log \
    "Race 33b issue/submit log" \
    "$race_thirty_three_b_issue_log"
  exit 1
fi

race_thirty_three_b_state="$(
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -Atqc \
    "select case when
       (
         select count(*)
         from public.choice_quiz_issue as issue
         join public.choice_quiz_attempt as attempt
           on attempt.issue_id = issue.id
         join public.choice_quiz_evaluation as evaluation
           on evaluation.attempt_id = attempt.id
         where issue.learner_ref = '$race_choice_quiz_erasure_first_ref'
       ) = 1
       and position(
         '$race_choice_quiz_erasure_first_ref'
         in public.list_choice_quiz_run_history_admin(
           'ca100000-0000-4000-8000-000000000001',
           'ca110000-0000-4000-8000-000000000002',
           'd5700000-0000-4000-8000-000000000002'
         )::text
       ) > 0
     then 'serialized' else '' end"
)"
if [[ "$race_thirty_three_b_state" != "serialized" ]]; then
  echo "Race 33b lost the post-history issue graph or reload visibility." >&2
  exit 1
fi

# Session-authority Race A: V2 resolves the teacher before waiting on the
# learner advisory. A cutoff committed during that wait must be authoritative
# when the RPC resumes, and the refresh must fail without writing state.
session_profile_hold_app="la_m5_${session_suffix}_profile_session_hold"
session_profile_rpc_app="la_m5_${session_suffix}_profile_after_cutoff"
PGAPPNAME="$session_profile_hold_app" \
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 \
  >"$race_thirty_four_history_log" 2>&1 <<'SQL' &
begin;
set local statement_timeout = '15s';
select public.lock_learning_activity_learners(
  array['cf300000-0000-4000-8000-000000000001'::uuid]
);
select pg_sleep(6);
commit;
SQL
race_thirty_four_history_pid=$!

if ! wait_for_sleeping_session \
  "$session_profile_hold_app" \
  "$race_thirty_four_history_pid"; then
  echo "Session profile race did not reach its learner hold." >&2
  exit 1
fi

PGAPPNAME="$session_profile_rpc_app" \
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 \
  >"$race_thirty_four_erasure_log" 2>&1 <<'SQL' &
begin;
set local statement_timeout = '15s';
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', 'cd100000-0000-4000-8000-000000000001',
    'session_id', 'cd110000-0000-4000-8000-000000000001',
    'role', 'authenticated'
  )::text,
  true
);
set local role authenticated;
select public.get_teacher_learner_activity_profile_v2(
  'cf300000-0000-4000-8000-000000000001'
);
commit;
SQL
race_thirty_four_erasure_pid=$!

if ! wait_for_blocked_pair \
  "$session_profile_rpc_app" \
  "$session_profile_hold_app" \
  "$race_thirty_four_erasure_pid"; then
  echo "V2 profile was not observed waiting on the learner advisory." >&2
  exit 1
fi

psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -c "
  update public.account_security as security
  set sessions_invalid_before = (
    select session.created_at + interval '1 microsecond'
    from auth.sessions as session
    where session.id = 'cd110000-0000-4000-8000-000000000001'
  )
  where security.account_id = 'cd200000-0000-4000-8000-000000000001';
" >/dev/null

set +e
wait "$race_thirty_four_history_pid"
session_profile_hold_status=$?
race_thirty_four_history_pid=""
wait "$race_thirty_four_erasure_pid"
session_profile_rpc_status=$?
race_thirty_four_erasure_pid=""
set -e
if [[ "$session_profile_hold_status" -ne 0 ]] \
  || [[ "$session_profile_rpc_status" -eq 0 ]] \
  || ! grep -q "learner_activity_profile_not_found" \
    "$race_thirty_four_erasure_log"; then
  echo "Queued V2 profile did not fail closed after session cutoff." >&2
  print_session_log "Session profile RPC log" "$race_thirty_four_erasure_log"
  exit 1
fi

psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -c "
  update public.account_security
  set sessions_invalid_before = null
  where account_id = 'cd200000-0000-4000-8000-000000000001';
" >/dev/null

# Session-authority Race B: the override likewise waits on the learner before
# its retained Session/Account check. Suspending a relation-only teacher does
# not need that target learner lock, so the queued mutation must resume against
# the committed inactive Account and leave no private override.
session_override_hold_app="la_m5_${session_suffix}_override_session_hold"
session_override_rpc_app="la_m5_${session_suffix}_override_after_deactivate"
PGAPPNAME="$session_override_hold_app" \
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 \
  >"$race_thirty_five_erasure_log" 2>&1 <<'SQL' &
begin;
set local statement_timeout = '15s';
select public.lock_learning_activity_learners(
  array['cf300000-0000-4000-8000-000000000001'::uuid]
);
select pg_sleep(6);
commit;
SQL
race_thirty_five_erasure_pid=$!

if ! wait_for_sleeping_session \
  "$session_override_hold_app" \
  "$race_thirty_five_erasure_pid"; then
  echo "Session override race did not reach its learner hold." >&2
  exit 1
fi

PGAPPNAME="$session_override_rpc_app" \
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 \
  >"$race_thirty_five_history_log" 2>&1 <<'SQL' &
begin;
set local statement_timeout = '15s';
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', 'cd100000-0000-4000-8000-000000000001',
    'session_id', 'cd110000-0000-4000-8000-000000000001',
    'role', 'authenticated'
  )::text,
  true
);
set local role authenticated;
select public.set_learner_recommendation_override(
  'cf300000-0000-4000-8000-000000000001',
  'ca410000-0000-4000-8000-000000000001',
  'replace',
  'apply_in_new_context',
  'QUEUED_DEACTIVATION_PRIVATE_SENTINEL',
  clock_timestamp()
);
commit;
SQL
race_thirty_five_history_pid=$!

if ! wait_for_blocked_pair \
  "$session_override_rpc_app" \
  "$session_override_hold_app" \
  "$race_thirty_five_history_pid"; then
  echo "Override was not observed waiting on the learner advisory." >&2
  exit 1
fi

psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -c "
  set statement_timeout = '5s';
  update public.account
  set status = 'suspended'
  where id = 'cd200000-0000-4000-8000-000000000001';
" >/dev/null

set +e
wait "$race_thirty_five_erasure_pid"
session_override_hold_status=$?
race_thirty_five_erasure_pid=""
wait "$race_thirty_five_history_pid"
session_override_rpc_status=$?
race_thirty_five_history_pid=""
set -e
if [[ "$session_override_hold_status" -ne 0 ]] \
  || [[ "$session_override_rpc_status" -eq 0 ]] \
  || ! grep -q "learner_recommendation_override_not_found" \
    "$race_thirty_five_history_log"; then
  echo "Queued override did not fail closed after Account deactivation." >&2
  print_session_log "Session override RPC log" "$race_thirty_five_history_log"
  exit 1
fi

session_override_state="$(
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -Atqc \
    "select case when not exists (
       select 1
       from public.learner_recommendation_override
       where recorded_by_account_id =
           'cd200000-0000-4000-8000-000000000001'
     ) then 'closed' else '' end"
)"
if [[ "$session_override_state" != "closed" ]]; then
  echo "Queued deactivated override persisted private state." >&2
  exit 1
fi

psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -c "
  update public.account
  set status = 'active'
  where id = 'cd200000-0000-4000-8000-000000000001';
" >/dev/null

# The earlier canonical erasure race intentionally removes the original
# ca4 Course audience. Attach the still-live isolated learner so this final
# security race exercises the real non-empty audience/advisory path.
psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -c "
  insert into public.course_learner (course_id, learner_profile_id)
  values (
    'ca400000-0000-4000-8000-000000000001',
    'cf300000-0000-4000-8000-000000000001'
  )
  on conflict (course_id, learner_profile_id) do nothing;
" >/dev/null

# Session-authority Race C: the service-only AI context discovers the current
# Course audience and must acquire its learner advisory before the explicit
# Supabase Session and Account/security locks. A cutoff can therefore commit
# while the context waits; once released, that queued context must re-read the
# exact session authority, fail 42501 and emit no context-use audit.
context_session_hold_app="la_m5_${session_suffix}_context_learner_hold"
context_session_rpc_app="la_m5_${session_suffix}_context_after_cutoff"
PGAPPNAME="$context_session_hold_app" \
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 \
  >"$race_thirty_four_history_log" 2>&1 <<'SQL' &
begin;
set local statement_timeout = '15s';
select public.lock_learning_activity_learners(array(
  select audience.learner_profile_id
  from (
    select direct.learner_profile_id
    from public.course_learner as direct
    where direct.course_id = 'ca400000-0000-4000-8000-000000000001'
    union
    select member.learner_profile_id
    from public.course_learner_group as course_group
    join public.learner_group_member as member
      on member.learner_group_id = course_group.learner_group_id
    where course_group.course_id =
      'ca400000-0000-4000-8000-000000000001'
  ) as audience
  order by audience.learner_profile_id
));
select pg_sleep(6);
commit;
SQL
race_thirty_four_history_pid=$!

if ! wait_for_sleeping_session \
  "$context_session_hold_app" \
  "$race_thirty_four_history_pid"; then
  echo "AI context race did not reach its learner-advisory hold." >&2
  print_session_log \
    "AI context learner hold log" \
    "$race_thirty_four_history_log"
  exit 1
fi

PGAPPNAME="$context_session_rpc_app" \
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 \
  >"$race_thirty_four_erasure_log" 2>&1 <<'SQL' &
begin;
set local statement_timeout = '15s';
set local role service_role;
select public.build_course_learning_activity_context(
  'ca100000-0000-4000-8000-000000000001',
  'ca110000-0000-4000-8000-000000000002',
  'ca400000-0000-4000-8000-000000000001'
);
commit;
SQL
race_thirty_four_erasure_pid=$!

if ! wait_for_blocked_pair \
  "$context_session_rpc_app" \
  "$context_session_hold_app" \
  "$race_thirty_four_erasure_pid"; then
  echo "AI context was not observed waiting on its learner advisory." >&2
  print_session_log \
    "AI context learner hold log" \
    "$race_thirty_four_history_log"
  print_session_log \
    "AI context RPC log" \
    "$race_thirty_four_erasure_log"
  exit 1
fi

psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -c "
  update public.account_security as security
  set sessions_invalid_before = (
    select session.created_at + interval '1 microsecond'
    from auth.sessions as session
    where session.id = 'ca110000-0000-4000-8000-000000000002'
  )
  where security.account_id = 'ca200000-0000-4000-8000-000000000001';
" >/dev/null

set +e
wait "$race_thirty_four_history_pid"
context_session_hold_status=$?
race_thirty_four_history_pid=""
wait "$race_thirty_four_erasure_pid"
context_session_rpc_status=$?
race_thirty_four_erasure_pid=""
set -e
if [[ "$context_session_hold_status" -ne 0 ]] \
  || [[ "$context_session_rpc_status" -eq 0 ]] \
  || ! grep -q "learning_activity_context_session_revoked" \
    "$race_thirty_four_erasure_log"; then
  echo "Queued AI context did not fail closed after session cutoff." >&2
  print_session_log \
    "AI context learner hold log" \
    "$race_thirty_four_history_log"
  print_session_log \
    "AI context RPC log" \
    "$race_thirty_four_erasure_log"
  exit 1
fi

context_session_state="$(
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -Atqc \
    "select case when
       not exists (
         select 1
         from public.learner_identity_audit_event
         where event_type = 'course_learning_activity_context_used'
           and actor_account_id =
             'ca200000-0000-4000-8000-000000000001'
           and related_entity_id =
             'ca400000-0000-4000-8000-000000000001'
       )
       and exists (
         select 1
         from public.account_security as security
         join auth.sessions as session
           on session.id = 'ca110000-0000-4000-8000-000000000002'
         where security.account_id =
             'ca200000-0000-4000-8000-000000000001'
           and security.sessions_invalid_before > session.created_at
       )
     then 'closed' else '' end"
)"
if [[ "$context_session_state" != "closed" ]]; then
  echo "Queued AI context emitted state or missed the committed cutoff." >&2
  exit 1
fi

psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -c "
  update public.account_security
  set sessions_invalid_before = null
  where account_id = 'ca200000-0000-4000-8000-000000000001';
" >/dev/null

# Race 21 intentionally left the isolated learner's original session cut off.
# The final erasure/history races model a fresh authorized request, so restore
# that disposable session boundary before producing its confirmation preview.
psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -c "
  update public.account_security
  set sessions_invalid_before = null
  where account_id = 'cf200000-0000-4000-8000-000000000001';
" >/dev/null

race_thirty_four_erasure_fingerprint="$(
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -Atqc \
    "with configured as materialized (
       select set_config(
         'request.jwt.claims',
         jsonb_build_object(
           'sub', 'cf100000-0000-4000-8000-000000000001',
           'session_id', 'cf110000-0000-4000-8000-000000000001',
           'role', 'authenticated'
         )::text,
         false
       )
     )
     select public.preview_my_learning_data_erasure()
       ->> 'previewFingerprint'
     from configured"
)"
race_thirty_five_erasure_fingerprint="$(
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -Atqc \
    "with configured as materialized (
       select set_config(
         'request.jwt.claims',
         jsonb_build_object(
           'sub', 'ca100000-0000-4000-8000-000000000002',
           'session_id', 'ca110000-0000-4000-8000-000000000001',
           'role', 'authenticated'
         )::text,
         false
       )
     )
     select public.preview_my_learning_data_erasure()
       ->> 'previewFingerprint'
     from configured"
)"
if [[ -z "$race_thirty_four_erasure_fingerprint" ]] \
  || [[ -z "$race_thirty_five_erasure_fingerprint" ]]; then
  echo "LA-M5 history erasure previews did not produce fingerprints." >&2
  exit 1
fi

# Race 34: history-first discovers and locks the exact Run learner set before
# returning teacher rows. Canonical erasure must wait; after history commits,
# erasure removes the whole learner quiz graph and future history is empty.
PGAPPNAME="$race_thirty_four_history_app" \
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 \
  >"$race_thirty_four_history_log" 2>&1 <<'SQL' &
begin;
set local statement_timeout = '15s';
set local role service_role;
select public.list_choice_quiz_run_history_admin(
  'ca100000-0000-4000-8000-000000000001',
  'ca110000-0000-4000-8000-000000000002',
  'd5700000-0000-4000-8000-000000000001'
);
select pg_sleep(6);
commit;
SQL
race_thirty_four_history_pid=$!

if ! wait_for_sleeping_session \
  "$race_thirty_four_history_app" \
  "$race_thirty_four_history_pid"; then
  echo "Race 34 history did not reach its learner-advisory hold." >&2
  print_session_log \
    "Race 34 history log" \
    "$race_thirty_four_history_log"
  exit 1
fi

PGAPPNAME="$race_thirty_four_erasure_app" \
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 \
  >"$race_thirty_four_erasure_log" 2>&1 <<SQL &
begin;
set local statement_timeout = '15s';
set local role service_role;
select public.confirm_my_learning_data_erasure(
  'cf100000-0000-4000-8000-000000000001',
  'cf110000-0000-4000-8000-000000000001',
  '$race_thirty_four_erasure_fingerprint'
);
commit;
SQL
race_thirty_four_erasure_pid=$!

if ! wait_for_blocked_pair \
  "$race_thirty_four_erasure_app" \
  "$race_thirty_four_history_app" \
  "$race_thirty_four_erasure_pid"; then
  echo "Race 34 erasure was not observed waiting on teacher history." >&2
  print_session_log \
    "Race 34 history log" \
    "$race_thirty_four_history_log"
  print_session_log \
    "Race 34 erasure log" \
    "$race_thirty_four_erasure_log"
  exit 1
fi

set +e
wait "$race_thirty_four_history_pid"
race_thirty_four_history_status=$?
race_thirty_four_history_pid=""
wait "$race_thirty_four_erasure_pid"
race_thirty_four_erasure_status=$?
race_thirty_four_erasure_pid=""
set -e

race_thirty_four_history_output="$(<"$race_thirty_four_history_log")"
if [[ "$race_thirty_four_history_status" -ne 0 ]] \
  || [[ "$race_thirty_four_erasure_status" -ne 0 ]] \
  || [[ "$race_thirty_four_history_output" != \
    *"$race_choice_quiz_same_key_ref"* ]]; then
  echo "Race 34 did not serialize visible history before learner erasure." >&2
  print_session_log \
    "Race 34 history log" \
    "$race_thirty_four_history_log"
  print_session_log \
    "Race 34 erasure log" \
    "$race_thirty_four_erasure_log"
  exit 1
fi

race_thirty_four_state="$(
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -Atqc \
    "select case when
       not exists (
         select 1
         from public.choice_quiz_issue
         where learner_profile_id =
           'cf300000-0000-4000-8000-000000000001'
       )
       and not exists (
         select 1
         from public.learner_profile
         where id = 'cf300000-0000-4000-8000-000000000001'
       )
       and (
         select count(*)
         from public.learner_profile
         where account_id = 'cf200000-0000-4000-8000-000000000001'
       ) = 1
       and jsonb_array_length(public.list_choice_quiz_run_history_admin(
         'ca100000-0000-4000-8000-000000000001',
         'ca110000-0000-4000-8000-000000000002',
         'd5700000-0000-4000-8000-000000000001'
       ) -> 'items') = 0
     then 'serialized' else '' end"
)"
if [[ "$race_thirty_four_state" != "serialized" ]]; then
  echo "Race 34 retained erased quiz history or lost fresh identity." >&2
  exit 1
fi

# Race 35: reverse the order. Erasure deletes the second learner graph while
# holding its advisory lock. History begins against the pre-commit scope,
# waits, then must fail with the bounded stale-scope signal rather than return
# an erased learner row. A fresh post-commit history read must be empty.
PGAPPNAME="$race_thirty_five_erasure_app" \
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 \
  >"$race_thirty_five_erasure_log" 2>&1 <<SQL &
begin;
set local statement_timeout = '15s';
set local role service_role;
select public.confirm_my_learning_data_erasure(
  'ca100000-0000-4000-8000-000000000002',
  'ca110000-0000-4000-8000-000000000001',
  '$race_thirty_five_erasure_fingerprint'
);
select pg_sleep(6);
commit;
SQL
race_thirty_five_erasure_pid=$!

if ! wait_for_sleeping_session \
  "$race_thirty_five_erasure_app" \
  "$race_thirty_five_erasure_pid"; then
  echo "Race 35 erasure did not reach its post-delete learner lock hold." >&2
  print_session_log \
    "Race 35 erasure log" \
    "$race_thirty_five_erasure_log"
  exit 1
fi

PGAPPNAME="$race_thirty_five_history_app" \
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 \
  >"$race_thirty_five_history_log" 2>&1 <<'SQL' &
begin;
set local statement_timeout = '15s';
set local role service_role;
do $stale$
begin
  begin
    perform public.list_choice_quiz_run_history_admin(
      'ca100000-0000-4000-8000-000000000001',
      'ca110000-0000-4000-8000-000000000002',
      'd5700000-0000-4000-8000-000000000002'
    );
    raise exception 'race_35_expected_erasure_history_stale';
  exception
    when sqlstate '40001' then
      if sqlerrm <> 'choice_quiz_history_stale' then
        raise;
      end if;
  end;
end;
$stale$;
commit;
SQL
race_thirty_five_history_pid=$!

if ! wait_for_blocked_pair \
  "$race_thirty_five_history_app" \
  "$race_thirty_five_erasure_app" \
  "$race_thirty_five_history_pid"; then
  echo "Race 35 history was not observed waiting on learner erasure." >&2
  print_session_log \
    "Race 35 erasure log" \
    "$race_thirty_five_erasure_log"
  print_session_log \
    "Race 35 history log" \
    "$race_thirty_five_history_log"
  exit 1
fi

set +e
wait "$race_thirty_five_erasure_pid"
race_thirty_five_erasure_status=$?
race_thirty_five_erasure_pid=""
wait "$race_thirty_five_history_pid"
race_thirty_five_history_status=$?
race_thirty_five_history_pid=""
set -e

race_thirty_five_history_output="$(<"$race_thirty_five_history_log")"
if [[ "$race_thirty_five_erasure_status" -ne 0 ]] \
  || [[ "$race_thirty_five_history_status" -ne 0 ]] \
  || [[ "$race_thirty_five_history_output" = \
    *"$race_choice_quiz_erasure_first_ref"* ]]; then
  echo "Race 35 leaked history or missed its stale-scope serialization." >&2
  print_session_log \
    "Race 35 erasure log" \
    "$race_thirty_five_erasure_log"
  print_session_log \
    "Race 35 history log" \
    "$race_thirty_five_history_log"
  exit 1
fi

race_thirty_five_state="$(
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -Atqc \
    "select case when
       not exists (
         select 1
         from public.choice_quiz_issue
         where learner_ref = '$race_choice_quiz_erasure_first_ref'
       )
       and jsonb_array_length(public.list_choice_quiz_run_history_admin(
         'ca100000-0000-4000-8000-000000000001',
         'ca110000-0000-4000-8000-000000000002',
         'd5700000-0000-4000-8000-000000000002'
       ) -> 'items') = 0
     then 'serialized' else '' end"
)"
if [[ "$race_thirty_five_state" != "serialized" ]]; then
  echo "Race 35 retained erased learner history after serialization." >&2
  exit 1
fi
