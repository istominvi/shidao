#!/usr/bin/env bash
set -euo pipefail

# Refreshes the current schema reference from a verified live/clone database.
# It never applies DDL and never edits migration history.
#
# The public pg_dump does not include ShiDao-owned objects attached to
# auth.users/storage.*. Their reviewed section is preserved from the existing
# snapshot and must be updated deliberately when those objects change.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
OUT_FILE="${PROJECT_ROOT}/supabase/schema/current-schema.sql"
CROSS_SCHEMA_MARKER="-- Cross-schema Supabase objects owned by the active Course Builder model"

for required_command in pg_dump psql; do
  if ! command -v "${required_command}" >/dev/null 2>&1; then
    echo "${required_command} is required to refresh the schema snapshot." >&2
    exit 1
  fi
done

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is not set." >&2
  echo "Run only after the read-only ShiDao sanity check described in docs/database/migration-guidelines.md." >&2
  exit 1
fi

if [[ ! -f "${OUT_FILE}" ]]; then
  echo "Existing snapshot is required so the reviewed Auth/Storage section can be preserved." >&2
  exit 1
fi

SHIDAO_SCHEMA_SIGNATURE="$({
  psql \
    --no-psqlrc \
    --tuples-only \
    --no-align \
    --set=ON_ERROR_STOP=1 \
    "${DATABASE_URL}" \
    --command="
      select case
        when to_regclass('public.account') is not null
         and to_regclass('public.course') is not null
         and to_regclass('public.lesson') is not null
         and to_regclass('public.lesson_component') is not null
         and to_regclass('public.lesson_student_slide') is not null
         and to_regclass('public.learner_profile') is not null
         and to_regclass('public.teacher_learner') is not null
         and to_regclass('public.course_learner') is not null
         and to_regclass('public.learner_group') is not null
         and to_regclass('public.learner_group_member') is not null
         and to_regclass('public.course_learner_group') is not null
         and to_regclass('public.lesson_run') is not null
         and to_regclass('public.learning_record') is not null
         and to_regclass('public.methodology') is null
         and to_regclass('public.lesson_run_participant') is null
         and to_regclass('public.lesson_snapshot') is null
         and to_regprocedure(
           'public.set_lesson_component_student_screen(uuid,text,uuid)'
         ) is not null
         and to_regprocedure(
           'public.schedule_lesson_run(uuid,timestamptz,integer,uuid[],uuid)'
         ) is not null
         and to_regprocedure(
           'public.complete_lesson_run(uuid,jsonb,text,timestamptz)'
         ) is not null
         and to_regprocedure(
           'public.replace_course_audience(uuid,uuid[],uuid[])'
         ) is not null
         and to_regprocedure(
           'public.archive_learner_profile(uuid)'
         ) is not null
         and to_regprocedure(
           'public.delete_lesson_with_history(uuid)'
         ) is not null
         and exists (
           select 1
           from information_schema.columns
           where table_schema = 'public'
             and table_name = 'lesson_component'
             and column_name = 'student_slide_id'
         )
         and exists (
           select 1
           from information_schema.columns
           where table_schema = 'public'
             and table_name = 'learner_profile'
             and column_name = 'account_id'
             and data_type = 'uuid'
             and is_nullable = 'YES'
         )
         and not exists (
           select 1
           from information_schema.columns
           where table_schema = 'public'
             and table_name = 'learner_profile'
             and column_name in ('owner_account_id', 'archived_at')
         )
         and exists (
           select 1
           from information_schema.columns
           where table_schema = 'public'
             and table_name = 'learning_record'
             and column_name = 'recorded_by_account_id'
             and data_type = 'uuid'
             and is_nullable = 'NO'
         )
         and not exists (
           select 1
           from information_schema.columns
           where table_schema = 'public'
             and table_name in ('lesson_run', 'learning_record')
             and column_name = 'status'
         )
         and exists (
           select 1
           from pg_constraint
           where conrelid = 'public.lesson_run'::regclass
             and conname = 'lesson_run_cancellation_time_check'
         )
         and not has_table_privilege(
           'authenticated',
           'public.learner_profile',
           'INSERT,UPDATE,DELETE'
         )
         and not has_table_privilege(
           'authenticated',
           'public.teacher_learner',
           'INSERT,UPDATE,DELETE'
         )
         and pg_get_functiondef(
           'public.schedule_lesson_run(uuid,timestamptz,integer,uuid[],uuid)'::regprocedure
         ) like '%lesson_run_changed%'
         and pg_get_functiondef(
           'public.schedule_lesson_run(uuid,timestamptz,integer,uuid[],uuid)'::regprocedure
         ) like '%public.teacher_learner%'
         and pg_get_functiondef(
           'public.schedule_lesson_run(uuid,timestamptz,integer,uuid[],uuid)'::regprocedure
         ) like '%recorded_by_account_id%'
         and pg_get_functiondef(
           'public.schedule_lesson_run(uuid,timestamptz,integer,uuid[],uuid)'::regprocedure
         ) like '%p_learner_profile_ids is null and v_run.id is not null%'
         and pg_get_functiondef(
           'public.complete_lesson_run(uuid,jsonb,text,timestamptz)'::regprocedure
         ) like '%jsonb_array_length(p_records) = 0%'
         and pg_get_function_result(
           'public.create_learner_profile_with_groups(text,uuid[])'::regprocedure
         ) like '%teacher_learner%'
         and pg_get_function_result(
           'public.update_learner_profile_with_groups(uuid,text,uuid[])'::regprocedure
         ) like '%teacher_learner%'
         and pg_get_function_result(
           'public.archive_learner_profile(uuid)'::regprocedure
         ) like '%teacher_learner%'
        then 'shidao-v2-current'
        else 'schema-mismatch'
      end;
    "
} | tr -d '[:space:]')"

if [[ "${SHIDAO_SCHEMA_SIGNATURE}" != "shidao-v2-current" ]]; then
  echo "Refusing to refresh: the target does not match the current ShiDao V2 schema signature." >&2
  exit 1
fi

TMP_PUBLIC="$(mktemp)"
TMP_CROSS="$(mktemp)"
TMP_RESULT="$(mktemp)"

cleanup() {
  rm -f "${TMP_PUBLIC}" "${TMP_CROSS}" "${TMP_RESULT}"
}
trap cleanup EXIT

awk -v marker="${CROSS_SCHEMA_MARKER}" '
  $0 == marker { keep = 1 }
  keep && ($0 == "-- PostgreSQL database dump complete" ||
    $0 == "-- PostgreSQL database dump complete --") { exit }
  keep { print }
' "${OUT_FILE}" > "${TMP_CROSS}"

if ! grep -Fq -- "${CROSS_SCHEMA_MARKER}" "${TMP_CROSS}"; then
  echo "Refusing to refresh: reviewed cross-schema Auth/Storage section is missing." >&2
  exit 1
fi

pg_dump \
  --schema-only \
  --no-owner \
  --restrict-key=shidaoSchemaSnapshot20260807 \
  --schema=public \
  "${DATABASE_URL}" > "${TMP_PUBLIC}"

{
  echo "-- CURRENT SCHEMA SNAPSHOT (post-migration reference)"
  echo "-- Generated by scripts/refresh-schema-snapshot.sh on $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  echo "-- Migration history remains in supabase/migrations/*."
  echo "-- Review the complete diff before committing; this file is not a migration."
  echo
  awk '
    /^\\(un)?restrict / { next }
    $0 == "-- PostgreSQL database dump complete" ||
      $0 == "-- PostgreSQL database dump complete --" { exit }
    { print }
  ' "${TMP_PUBLIC}"
  cat "${TMP_CROSS}"
  echo "-- PostgreSQL database dump complete"
  echo "--"
} > "${TMP_RESULT}"

for required in \
  "GRANT" \
  "ALTER DEFAULT PRIVILEGES" \
  "trg_auth_user_create_account" \
  "course_assets_owner_select" \
  "CREATE TABLE public.lesson_run" \
  "CREATE TABLE public.learning_record" \
  "CREATE TABLE public.teacher_learner" \
  "CREATE TABLE public.learner_group" \
  "CREATE TABLE public.learner_group_member" \
  "CREATE TABLE public.course_learner_group" \
  "CREATE FUNCTION public.replace_course_audience" \
  "CREATE FUNCTION public.archive_learner_profile" \
  "CREATE FUNCTION public.detach_archived_teacher_learner_links" \
  "CREATE FUNCTION public.enforce_course_learner_teacher_relation" \
  "CREATE FUNCTION public.enforce_learner_group_member_teacher_relation" \
  "CREATE FUNCTION public.enforce_learning_record_producer_immutable" \
  "CREATE FUNCTION public.schedule_lesson_run" \
  "CREATE FUNCTION public.delete_lesson_with_history"; do
  if ! grep -Fq "${required}" "${TMP_RESULT}"; then
    echo "Refusing to replace snapshot: generated result is missing ${required}." >&2
    exit 1
  fi
done

mv "${TMP_RESULT}" "${OUT_FILE}"
echo "Updated ${OUT_FILE}. Review git diff before committing."
