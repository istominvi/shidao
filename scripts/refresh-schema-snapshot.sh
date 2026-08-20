#!/usr/bin/env bash
set -euo pipefail

# Refreshes the current schema reference from a verified live/clone database.
# It never applies DDL and never edits migration history.
#
# The public pg_dump does not include ShiDao-owned objects attached to
# auth.users/storage.*. Their reviewed section is preserved from the existing
# snapshot and must be updated deliberately when those objects change.
#
# The signature accepts exactly two learner-identity compatibility stages. Both
# must contain every M1-M3 object/invariant plus the M5/M6 Auth hardening. The
# expand stage also requires the complete, known legacy compatibility contract;
# the final stage requires the complete M4 helper/type/ACL cleanup. A partial
# stage is rejected.

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
      with legacy_helper(signature) as (
        select unnest(array[
          'public.can_read_class(uuid)',
          'public.is_class_student(uuid)',
          'public.is_class_teacher(uuid)',
          'public.is_my_child(uuid)',
          'public.parent_in_class(uuid)',
          'public.parent_in_school(uuid)',
          'public.teaches_student(uuid)',
          'public.current_parent_id()',
          'public.current_student_id()',
          'public.current_teacher_id()',
          'public.clear_user_pin(uuid)',
          'public.ensure_user_preference(uuid)',
          'public.ensure_user_security(uuid)',
          'public.get_last_active_profile(uuid)',
          'public.merge_user_settings(uuid,jsonb)',
          'public.onboard_parent(uuid,text)',
          'public.onboard_teacher(uuid,text)',
          'public.reset_pin_attempts(uuid)',
          'public.set_last_active_profile(uuid,text)',
          'public.set_last_selected_school(uuid,uuid)',
          'public.set_user_pin(uuid,text)',
          'public.upsert_user_theme(uuid,text)',
          'public.verify_user_pin(uuid,text)'
        ])
      ), legacy_table(table_name) as (
        values
          ('class'), ('class_student'), ('class_teacher'), ('parent'),
          ('school'), ('school_teacher'), ('student'), ('teacher'),
          ('user_preference'), ('user_security')
      ), compatibility_dual_write(signature) as (
        select unnest(array[
          'public.set_current_account_pin(uuid,text)',
          'public.revoke_user_sessions(uuid,timestamptz)',
          'public.activate_offline_learner_account(uuid,uuid,bytea,bytea,text,text,uuid,boolean,boolean)',
          'public.reset_recoverable_learner_credentials(uuid,uuid,text,text,timestamptz,uuid)'
        ])
      ), contract_clean_function(signature) as (
        select unnest(array[
          'public.set_current_account_pin(uuid,text)',
          'public.set_current_account_pin_impl(uuid,text)',
          'public.revoke_user_sessions(uuid,timestamptz)',
          'public.revoke_user_sessions_impl(uuid,timestamptz)',
          'public.activate_offline_learner_account(uuid,uuid,bytea,bytea,text,text,uuid,boolean,boolean)',
          'public.activate_offline_learner_account_impl(uuid,uuid,bytea,bytea,text,text,uuid,boolean,boolean)',
          'public.reset_recoverable_learner_credentials(uuid,uuid,text,text,timestamptz,uuid)',
          'public.reset_recoverable_learner_credentials_impl(uuid,uuid,text,text,timestamptz,uuid)'
        ])
      ), contract_edge(root_signature, callee_name) as (
        values
          ('public.set_current_account_pin(uuid,text)', 'set_current_account_pin_impl'),
          ('public.revoke_user_sessions(uuid,timestamptz)', 'revoke_user_sessions_impl'),
          ('public.activate_offline_learner_account(uuid,uuid,bytea,bytea,text,text,uuid,boolean,boolean)', 'activate_offline_learner_account_impl'),
          ('public.reset_recoverable_learner_credentials(uuid,uuid,text,text,timestamptz,uuid)', 'reset_recoverable_learner_credentials_impl')
      ), contract_internal_function(signature) as (
        select unnest(array[
          'public.set_current_account_pin_impl(uuid,text)',
          'public.revoke_user_sessions_impl(uuid,timestamptz)',
          'public.activate_offline_learner_account_impl(uuid,uuid,bytea,bytea,text,text,uuid,boolean,boolean)',
          'public.reset_recoverable_learner_credentials_impl(uuid,uuid,text,text,timestamptz,uuid)'
        ])
      ), expand_authenticated_grant(table_name, privilege_name) as (
        values
          ('class', 'SELECT'),
          ('class_student', 'SELECT'),
          ('class_teacher', 'SELECT'),
          ('parent', 'SELECT'), ('parent', 'UPDATE'),
          ('school', 'SELECT'),
          ('school_teacher', 'SELECT'),
          ('student', 'SELECT'), ('student', 'UPDATE'),
          ('teacher', 'SELECT'), ('teacher', 'UPDATE')
      ), checked_table_privilege(privilege_name) as (
        values
          ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE'),
          ('REFERENCES'), ('TRIGGER')
      ), communication_table(table_name) as (
        values
          ('communication_thread'),
          ('communication_message'),
          ('communication_read_state'),
          ('assistant_conversation'),
          ('assistant_turn'),
          ('system_notification')
      ), communication_user_rpc(signature) as (
        values
          ('public.list_my_communication_inbox(timestamp with time zone,text,text,integer)'),
          ('public.list_my_message_targets(text,integer)'),
          ('public.open_direct_communication_thread(uuid)'),
          ('public.open_course_communication_thread(uuid)'),
          ('public.list_my_communication_messages(uuid,bigint,integer)'),
          ('public.send_communication_message(uuid,text,uuid)'),
          ('public.mark_communication_thread_read(uuid,bigint)'),
          ('public.list_my_assistant_conversations(boolean,integer)'),
          ('public.get_my_assistant_conversation(uuid)'),
          ('public.create_my_assistant_conversation(text,uuid,uuid)'),
          ('public.update_my_assistant_conversation(uuid,text,boolean)'),
          ('public.list_my_assistant_turns(uuid,bigint,integer)'),
          ('public.append_my_assistant_turn(uuid,text,uuid)'),
          ('public.mark_my_assistant_conversation_read(uuid,bigint)'),
          ('public.list_my_system_notifications(bigint,integer)'),
          ('public.mark_my_system_notifications_read(bigint)'),
          ('public.schedule_lesson_run_if_unchanged(uuid,timestamp with time zone,integer,uuid,timestamp with time zone,uuid[])')
      ), communication_admin_rpc(signature) as (
        values
          ('public.append_assistant_turn_admin(uuid,uuid,text,jsonb,text,text)'),
          ('public.append_system_notification_admin(uuid,text,text,text,text,jsonb,text,timestamp with time zone)')
      ), communication_trigger(
        table_name,
        trigger_name,
        function_signature,
        trigger_type,
        is_deferrable,
        is_initially_deferred
      ) as (
        values
          (
            'lesson_run',
            'trg_lesson_run_communication_notifications',
            'public.emit_lesson_run_communication_notifications()',
            21::smallint,
            true,
            true
          ),
          (
            'communication_message',
            'trg_communication_message_recompute_thread_after_delete',
            'public.recompute_communication_thread_after_message_delete()',
            9::smallint,
            false,
            false
          )
      ), attestation_table(table_name) as (
        values
          ('course_attestation'),
          ('course_publication_attestation'),
          ('course_attestation_attempt'),
          ('course_attestation_award')
      ), attestation_user_rpc(signature) as (
        values
          ('public.get_my_authored_course_attestation(uuid)'),
          ('public.replace_my_course_attestation(uuid,text,text,integer,jsonb)'),
          ('public.get_my_course_publication_attestation(uuid)'),
          ('public.submit_my_course_publication_attestation(uuid,uuid,jsonb)'),
          ('public.list_my_course_publication_attestations()')
      ), attestation_admin_rpc(signature) as (
        values
          ('public.list_course_publication_catalog_v2_admin(uuid,text,text,text,text,integer,integer)'),
          ('public.assert_course_publication_copy_eligible_admin(uuid,uuid)')
      ), educator_governance_definer_admin_rpc(signature) as (
        values
          ('public.publish_course_revision_with_attestation_admin(uuid,uuid,uuid,uuid,text,jsonb,jsonb,boolean,text,jsonb)'),
          ('public.clone_course_publication_with_attestation_admin(uuid,uuid,uuid,text,jsonb,jsonb)'),
          ('public.duplicate_course_with_attestation_admin(uuid,uuid,uuid,text,jsonb)')
      ), educator_governance_table(table_name) as (
        values
          ('educator_course_revision_review'),
          ('course_publication_self_enrollment'),
          ('course_publication_lesson_completion')
      ), educator_governance_user_rpc(signature) as (
        values
          ('public.get_my_course_publication_progress(uuid)'),
          ('public.set_my_course_publication_lesson_progress(uuid,uuid,uuid,boolean)')
      ), educator_governance_admin_rpc(signature) as (
        values
          ('public.approve_educator_course_revision_admin(uuid,uuid,uuid)'),
          ('public.reject_educator_course_revision_admin(uuid,uuid,uuid,text)'),
          ('public.unpublish_course_publication_admin(uuid,uuid)')
      ), educator_course_content_guard_trigger(table_name, trigger_name) as (
        values
          ('course', 'trg_course_educator_content_mutation'),
          ('course_attachment', 'trg_course_attachment_educator_content_mutation'),
          ('course_attestation', 'trg_course_attestation_educator_content_mutation'),
          ('lesson', 'trg_lesson_educator_content_mutation'),
          ('lesson_component', 'trg_lesson_component_educator_content_mutation'),
          ('lesson_student_slide', 'trg_lesson_student_slide_educator_content_mutation'),
          ('stored_file', 'trg_stored_file_educator_content_mutation')
      )
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
         and to_regclass('public.lesson_component_observation') is not null
         and to_regclass('public.account_login_alias') is not null
         and to_regclass('public.account_security') is not null
         and to_regclass('public.account_preference') is not null
         and to_regclass('public.learner_profile_share_code') is not null
         and to_regclass('public.learner_connection_request') is not null
         and to_regclass('public.learner_claim_invitation') is not null
         and to_regclass('public.learner_profile_merge') is not null
         and to_regclass('public.learner_profile_merge_conflict') is not null
         and to_regclass('public.learner_profile_merge_private_detail') is not null
         and to_regclass('public.learner_profile_alias') is not null
         and to_regclass('public.learner_observer_invitation') is not null
         and to_regclass('public.learner_observer_grant') is not null
         and to_regclass('public.learner_ai_consent') is not null
         and to_regclass('public.learner_identity_audit_event') is not null
         and to_regclass('public.learner_identity_rate_limit') is not null
         and to_regclass('public.learner_erasure_request') is not null
         and to_regclass('public.learner_credential_recovery_delegate') is not null
         and to_regclass('public.learner_identity_reconciliation') is not null
         and to_regclass('public.course_attestation') is not null
         and to_regclass('public.course_publication_attestation') is not null
         and to_regclass('public.course_attestation_attempt') is not null
         and to_regclass('public.course_attestation_award') is not null
         and to_regclass('public.educator_course_revision_review') is not null
         and to_regclass('public.course_publication_self_enrollment') is not null
         and to_regclass('public.course_publication_lesson_completion') is not null
         and not exists (
           select 1
           from communication_table as required_table
           left join pg_class as relation
             on relation.oid = to_regclass(
               'public.' || required_table.table_name
             )
           where relation.oid is null
              or not relation.relrowsecurity
         )
         and not exists (
           select 1
           from communication_table as required_table
           join pg_class as relation
             on relation.oid = to_regclass(
               'public.' || required_table.table_name
             )
           cross join unnest(array['anon', 'authenticated'])
             as actor(role_name)
           cross join checked_table_privilege
           where has_table_privilege(
             actor.role_name,
             relation.oid,
             checked_table_privilege.privilege_name
           )
         )
         and not exists (
           select 1
           from communication_user_rpc as required_rpc
           left join pg_proc as procedure
             on procedure.oid = to_regprocedure(required_rpc.signature)
           where procedure.oid is null
              or not procedure.prosecdef
              or procedure.proconfig is null
              or not (procedure.proconfig @> array['search_path=\"\"'])
         )
         and not exists (
           select 1
           from communication_user_rpc as required_rpc
           join pg_proc as procedure
             on procedure.oid = to_regprocedure(required_rpc.signature)
           where not has_function_privilege(
             'authenticated',
             procedure.oid,
             'EXECUTE'
           )
         )
         and not exists (
           select 1
           from communication_user_rpc as required_rpc
           join pg_proc as procedure
             on procedure.oid = to_regprocedure(required_rpc.signature)
           cross join unnest(array['anon', 'service_role'])
             as actor(role_name)
           where has_function_privilege(
             actor.role_name,
             procedure.oid,
             'EXECUTE'
           )
         )
         and not exists (
           select 1
           from communication_admin_rpc as required_rpc
           left join pg_proc as procedure
             on procedure.oid = to_regprocedure(required_rpc.signature)
           where procedure.oid is null
              or not procedure.prosecdef
              or procedure.proconfig is null
              or not (procedure.proconfig @> array['search_path=\"\"'])
         )
         and not exists (
           select 1
           from communication_admin_rpc as required_rpc
           join pg_proc as procedure
             on procedure.oid = to_regprocedure(required_rpc.signature)
           where not has_function_privilege(
             'service_role',
             procedure.oid,
             'EXECUTE'
           )
         )
         and not exists (
           select 1
           from communication_admin_rpc as required_rpc
           join pg_proc as procedure
             on procedure.oid = to_regprocedure(required_rpc.signature)
           cross join unnest(array['anon', 'authenticated'])
             as actor(role_name)
           where has_function_privilege(
             actor.role_name,
             procedure.oid,
             'EXECUTE'
           )
         )
         and not exists (
           select 1
           from communication_trigger as required_trigger
           left join pg_trigger as database_trigger
             on database_trigger.tgrelid = to_regclass(
               'public.' || required_trigger.table_name
             )
            and database_trigger.tgname = required_trigger.trigger_name
            and not database_trigger.tgisinternal
           left join pg_proc as procedure
             on procedure.oid = database_trigger.tgfoid
           where database_trigger.oid is null
              or database_trigger.tgenabled <> 'O'
              or database_trigger.tgfoid <>
                to_regprocedure(required_trigger.function_signature)
              or database_trigger.tgtype <> required_trigger.trigger_type
              or database_trigger.tgdeferrable is distinct from
                required_trigger.is_deferrable
              or database_trigger.tginitdeferred is distinct from
                required_trigger.is_initially_deferred
              or procedure.oid is null
              or not procedure.prosecdef
              or procedure.proconfig is null
              or not (procedure.proconfig @> array['search_path=\"\"'])
         )
         and to_regclass('public.methodology') is null
         and to_regclass('public.lesson_step') is null
         and to_regclass('public.lesson_run_participant') is null
         and to_regclass('public.lesson_snapshot') is null
         and (
           select count(*)
           from information_schema.columns
           where table_schema = 'public'
             and (table_name, column_name) in (
               ('course', 'learning_audience'),
               ('course_publication', 'learning_audience')
             )
             and data_type = 'text'
             and is_nullable = 'NO'
             and column_default = '''children''::text'
         ) = 2
         and has_column_privilege(
           'authenticated',
           'public.course',
           'learning_audience',
           'UPDATE'
         )
         and not has_column_privilege(
           'authenticated',
           'public.course_publication',
           'learning_audience',
           'UPDATE'
         )
         and exists (
           select 1
           from information_schema.columns
           where table_schema = 'public'
             and table_name = 'account'
             and column_name = 'can_author_educator_courses'
             and data_type = 'boolean'
             and is_nullable = 'NO'
             and column_default = 'false'
         )
         and (
           select count(*)
           from information_schema.columns
           where table_schema = 'public'
             and table_name = 'account'
             and (
               (
                 column_name = 'avatar_kind'
                 and data_type = 'text'
                 and is_nullable = 'NO'
                 and column_default = '''preset''::text'
               )
               or (
                 column_name = 'avatar_preset_key'
                 and data_type = 'text'
                 and is_nullable = 'YES'
                 and column_default = '''sd-avatar-v1-01''::text'
               )
               or (
                 column_name = 'avatar_storage_path'
                 and data_type = 'text'
                 and is_nullable = 'YES'
                 and column_default is null
               )
               or (
                 column_name = 'avatar_revision'
                 and data_type = 'integer'
                 and is_nullable = 'NO'
                 and column_default = '1'
               )
               or (
                 column_name = 'avatar_updated_at'
                 and data_type = 'timestamp with time zone'
                 and is_nullable = 'NO'
                 and column_default = 'now()'
               )
             )
         ) = 5
         and not has_column_privilege(
           'authenticated',
           'public.account',
           'avatar_kind',
           'UPDATE'
         )
         and exists (
           select 1
           from pg_proc as procedure
           where procedure.oid = to_regprocedure(
             'public.set_current_account_avatar(uuid,text,text,text,integer)'
           )
             and procedure.prosecdef
             and procedure.proconfig @> array['search_path=\"\"']
             and procedure.proowner = (
               select relation.relowner
               from pg_class as relation
               where relation.oid = 'public.account'::regclass
             )
             and not exists (
               select 1
               from aclexplode(
                 coalesce(
                   procedure.proacl,
                   acldefault('f', procedure.proowner)
                 )
               ) as acl_entry
               where acl_entry.grantee = 0
                 and acl_entry.privilege_type = 'EXECUTE'
             )
         )
         and has_function_privilege(
           'postgres',
           'public.set_current_account_avatar(uuid,text,text,text,integer)',
           'EXECUTE'
         )
         and has_function_privilege(
           'service_role',
           'public.set_current_account_avatar(uuid,text,text,text,integer)',
           'EXECUTE'
         )
         and not exists (
           select 1
           from unnest(array['anon', 'authenticated']) as actor(role_name)
           where has_function_privilege(
             actor.role_name,
             'public.set_current_account_avatar(uuid,text,text,text,integer)',
             'EXECUTE'
           )
         )
         and exists (
           select 1
           from storage.buckets as bucket
           where bucket.id = 'profile-avatars'
             and bucket.name = 'profile-avatars'
             and not bucket.public
             and bucket.file_size_limit = 1048576
             and bucket.allowed_mime_types = array['image/webp']::text[]
         )
         and not exists (
           select 1
           from pg_policies as policy
           where policy.schemaname = 'storage'
             and policy.tablename = 'objects'
             and (
               policy.policyname like 'profile_avatars_%'
               or coalesce(policy.qual, '') like '%profile-avatars%'
               or coalesce(policy.with_check, '') like '%profile-avatars%'
             )
         )
         and exists (
           select 1
           from information_schema.columns
           where table_schema = 'public'
             and table_name = 'course_publication'
             and column_name = 'approved_revision_id'
             and data_type = 'uuid'
             and is_nullable = 'YES'
         )
         and exists (
           select 1
           from pg_proc as procedure
           where procedure.oid = to_regprocedure(
             'public.guard_educator_course_content_mutation()'
           )
             and not procedure.prosecdef
             and procedure.proconfig @> array['search_path=\"\"']
             and position(
               'educator_course_author_can_mutate'
               in pg_get_functiondef(procedure.oid)
             ) = 0
             and position(
               'course.learning_audience = ''children'''
               in pg_get_functiondef(procedure.oid)
             ) > 0
             and position(
               'account.can_author_educator_courses'
               in pg_get_functiondef(procedure.oid)
             ) > 0
         )
         and not exists (
           select 1
           from educator_course_content_guard_trigger as required_trigger
           where not exists (
             select 1
             from pg_trigger as trigger
             where trigger.tgrelid = to_regclass(
                 'public.' || required_trigger.table_name
               )
               and trigger.tgname = required_trigger.trigger_name
               and trigger.tgfoid = to_regprocedure(
                 'public.guard_educator_course_content_mutation()'
               )
               and not trigger.tgisinternal
               and trigger.tgenabled = 'O'
           )
         )
         and has_function_privilege(
           'postgres',
           'public.guard_educator_course_content_mutation()',
           'EXECUTE'
         )
         and not exists (
           select 1
           from unnest(array['anon', 'authenticated', 'service_role'])
             as actor(role_name)
           where has_function_privilege(
             actor.role_name,
             'public.guard_educator_course_content_mutation()',
             'EXECUTE'
           )
         )
         and not exists (
           select 1
           from unnest(array['anon', 'authenticated']) as actor(role_name)
           where has_function_privilege(
             actor.role_name,
             'public.educator_course_author_can_mutate(uuid)',
             'EXECUTE'
           )
         )
         and not exists (
           select 1
           from unnest(array['postgres', 'service_role']) as actor(role_name)
           where not has_function_privilege(
             actor.role_name,
             'public.educator_course_author_can_mutate(uuid)',
             'EXECUTE'
           )
         )
         and exists (
           select 1
           from pg_trigger as trigger
           join pg_proc as procedure on procedure.oid = trigger.tgfoid
           where trigger.tgrelid =
               'public.course_publication_revision'::regclass
             and trigger.tgname =
               'trg_course_publication_revision_license_insert'
             and not trigger.tgisinternal
             and trigger.tgenabled = 'O'
             and trigger.tgtype = 7
             and not procedure.prosecdef
             and procedure.proconfig @> array['search_path=\"\"']
         )
         and exists (
           select 1
           from pg_trigger as trigger
           where trigger.tgrelid =
               'public.course_publication_revision'::regclass
             and trigger.tgname =
               'trg_course_publication_revision_immutable'
             and not trigger.tgisinternal
             and trigger.tgenabled = 'O'
             and trigger.tgfoid = to_regprocedure(
               'public.reject_course_publication_immutable_update()'
             )
         )
         and has_function_privilege(
           'postgres',
           'public.set_course_publication_revision_license_on_insert()',
           'EXECUTE'
         )
         and not exists (
           select 1
           from unnest(array['anon', 'authenticated', 'service_role'])
             as actor(role_name)
           where has_function_privilege(
             actor.role_name,
             'public.set_course_publication_revision_license_on_insert()',
             'EXECUTE'
           )
         )
         and not exists (
           select 1
           from public.course_publication_revision as revision
           join public.course_publication as publication
             on publication.id = revision.publication_id
           where publication.learning_audience = 'educators'
             and revision.license_code <>
               'shidao_official_learning_v1'
         )
         and not exists (
           select 1
           from educator_governance_table
           join pg_class as relation
             on relation.oid = to_regclass(
               'public.' || educator_governance_table.table_name
             )
           where not relation.relrowsecurity
         )
         and not exists (
           select 1
           from educator_governance_table
           cross join unnest(array['anon', 'authenticated'])
             as actor(role_name)
           cross join checked_table_privilege
           where has_table_privilege(
             actor.role_name,
             'public.' || educator_governance_table.table_name,
             checked_table_privilege.privilege_name
           )
         )
         and not exists (
           select 1
           from educator_governance_user_rpc
           left join pg_proc as procedure
             on procedure.oid = to_regprocedure(
               educator_governance_user_rpc.signature
             )
           where procedure.oid is null
              or not procedure.prosecdef
              or procedure.proconfig is null
              or not (procedure.proconfig @> array['search_path=\"\"'])
         )
         and not exists (
           select 1
           from educator_governance_user_rpc
           cross join unnest(array['anon', 'service_role'])
             as actor(role_name)
           where has_function_privilege(
             actor.role_name,
             educator_governance_user_rpc.signature,
             'EXECUTE'
           )
         )
         and not exists (
           select 1
           from educator_governance_user_rpc
           cross join unnest(array['postgres', 'authenticated'])
             as actor(role_name)
           where not has_function_privilege(
             actor.role_name,
             educator_governance_user_rpc.signature,
             'EXECUTE'
           )
         )
         and not exists (
           select 1
           from educator_governance_admin_rpc
           left join pg_proc as procedure
             on procedure.oid = to_regprocedure(
               educator_governance_admin_rpc.signature
             )
           where procedure.oid is null
              or procedure.prosecdef
              or procedure.proconfig is null
              or not (procedure.proconfig @> array['search_path=\"\"'])
         )
         and not exists (
           select 1
           from educator_governance_admin_rpc
           cross join unnest(array['anon', 'authenticated'])
             as actor(role_name)
           where has_function_privilege(
             actor.role_name,
             educator_governance_admin_rpc.signature,
             'EXECUTE'
           )
         )
         and not exists (
           select 1
           from educator_governance_definer_admin_rpc
           left join pg_proc as procedure
             on procedure.oid = to_regprocedure(
               educator_governance_definer_admin_rpc.signature
             )
           where procedure.oid is null
              or not procedure.prosecdef
              or procedure.proconfig is null
              or not (procedure.proconfig @> array['search_path=\"\"'])
         )
         and not exists (
           select 1
           from educator_governance_definer_admin_rpc
           cross join unnest(array['anon', 'authenticated'])
             as actor(role_name)
           where has_function_privilege(
             actor.role_name,
             educator_governance_definer_admin_rpc.signature,
             'EXECUTE'
           )
         )
         and not exists (
           select 1
           from educator_governance_definer_admin_rpc
           cross join unnest(array['postgres', 'service_role'])
             as actor(role_name)
           where not has_function_privilege(
             actor.role_name,
             educator_governance_definer_admin_rpc.signature,
             'EXECUTE'
           )
         )
         and not exists (
           select 1
           from educator_governance_admin_rpc
           cross join unnest(array['postgres', 'service_role'])
             as actor(role_name)
           where not has_function_privilege(
             actor.role_name,
             educator_governance_admin_rpc.signature,
             'EXECUTE'
           )
         )
         and not exists (
           select 1
           from attestation_table
           join pg_class as relation
             on relation.oid = to_regclass(
               'public.' || attestation_table.table_name
             )
           where not relation.relrowsecurity
         )
         and not exists (
           select 1
           from attestation_table
           cross join unnest(array['anon', 'authenticated'])
             as actor(role_name)
           cross join checked_table_privilege
           where has_table_privilege(
             actor.role_name,
             'public.' || attestation_table.table_name,
             checked_table_privilege.privilege_name
           )
         )
         and not exists (
           select 1
           from attestation_table
           cross join checked_table_privilege
           where not has_table_privilege(
             'service_role',
             'public.' || attestation_table.table_name,
             checked_table_privilege.privilege_name
           )
         )
         and exists (
           select 1
           from pg_policy as policy
           where policy.polrelid = 'public.course_attestation'::regclass
             and policy.polname = 'course_attestation_owner_all'
             and policy.polroles = array[
               (select oid from pg_roles where rolname = 'authenticated')
             ]
         )
         and not exists (
           select 1
           from attestation_user_rpc
           left join pg_proc as procedure
             on procedure.oid = to_regprocedure(
               attestation_user_rpc.signature
             )
           where procedure.oid is null
              or not procedure.prosecdef
              or procedure.proconfig is null
              or not (procedure.proconfig @> array['search_path=\"\"'])
         )
         and not exists (
           select 1
           from attestation_user_rpc
           cross join unnest(array['anon', 'service_role'])
             as actor(role_name)
           where has_function_privilege(
             actor.role_name,
             attestation_user_rpc.signature,
             'EXECUTE'
           )
         )
         and not exists (
           select 1
           from attestation_user_rpc
           cross join unnest(array['postgres', 'authenticated'])
             as actor(role_name)
           where not has_function_privilege(
             actor.role_name,
             attestation_user_rpc.signature,
             'EXECUTE'
           )
         )
         and not exists (
           select 1
           from attestation_admin_rpc
           left join pg_proc as procedure
             on procedure.oid = to_regprocedure(
               attestation_admin_rpc.signature
             )
           where procedure.oid is null
              or procedure.prosecdef
              or procedure.proconfig is null
              or not (procedure.proconfig @> array['search_path=\"\"'])
         )
         and not exists (
           select 1
           from attestation_admin_rpc
           cross join unnest(array['anon', 'authenticated'])
             as actor(role_name)
           where has_function_privilege(
             actor.role_name,
             attestation_admin_rpc.signature,
             'EXECUTE'
           )
         )
         and not exists (
           select 1
           from attestation_admin_rpc
           cross join unnest(array['postgres', 'service_role'])
             as actor(role_name)
           where not has_function_privilege(
             actor.role_name,
             attestation_admin_rpc.signature,
             'EXECUTE'
           )
         )
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
           'public.complete_lesson_run_v2(uuid,jsonb,text,timestamptz,integer)'
         ) is not null
         and to_regprocedure(
           'public.save_lesson_component_observations(uuid,uuid,text,text,text,jsonb)'
         ) is not null
         and to_regprocedure(
           'public.delete_draft_observations_for_lesson_component()'
         ) is not null
         and to_regprocedure(
           'public.delete_lesson_component(uuid)'
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
         and to_regprocedure(
           'public.archive_course(uuid)'
         ) is not null
         and to_regprocedure(
           'public.guard_course_archive_invariants()'
         ) is not null
         and to_regprocedure(
           'public.guard_course_publication_active_source()'
         ) is not null
         and to_regprocedure(
           'public.guard_lesson_course_immutable()'
         ) is not null
         and to_regprocedure(
           'public.guard_lesson_run_active_course()'
         ) is not null
         and to_regprocedure(
           'public.current_account_auth_context()'
         ) is not null
         and to_regprocedure(
           'public.get_my_learning_profile()'
         ) is not null
         and to_regprocedure(
           'public.get_my_learning_history(text,integer)'
         ) is not null
         and to_regprocedure(
           'public.get_my_learning_progress()'
         ) is not null
         and to_regprocedure(
           'public.list_teacher_learner_directory(text)'
         ) is not null
         and to_regprocedure(
           'public.restore_teacher_learner(uuid)'
         ) is not null
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
           'public.confirm_my_learning_data_erasure(uuid,text)'
         ) is not null
         and to_regprocedure(
           'public.list_my_learner_observer_overview()'
         ) is not null
         and to_regprocedure(
           'public.get_observed_learner_history(uuid,text,integer)'
         ) is not null
         and to_regprocedure(
           'public.get_observed_learner_progress(uuid)'
         ) is not null
         and to_regprocedure(
           'public.request_learner_ai_consent(uuid,uuid,text,integer)'
         ) is not null
         and to_regprocedure(
           'public.build_cross_provider_learner_context(uuid,uuid)'
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
         and exists (
           select 1
           from information_schema.columns
           where table_schema = 'public'
             and table_name = 'lesson_run'
             and column_name = 'actual_duration_minutes'
             and data_type = 'integer'
             and is_nullable = 'YES'
         )
         and exists (
           select 1
           from information_schema.columns
           where table_schema = 'public'
             and table_name = 'lesson_run'
             and column_name = 'started_at_is_actual'
             and data_type = 'boolean'
             and is_nullable = 'NO'
         )
         and not exists (
           select 1
           from information_schema.columns
           where table_schema = 'public'
             and table_name = 'learning_record'
             and column_name in (
               'shared_with_learner_at',
               'actual_duration_minutes_at_time',
               'superseded_by_record_id'
             )
             and is_nullable <> 'YES'
         )
         and (
           select count(*)
           from information_schema.columns
           where table_schema = 'public'
             and table_name = 'learning_record'
             and column_name in (
               'shared_with_learner_at',
               'actual_duration_minutes_at_time',
               'superseded_by_record_id'
             )
         ) = 3
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
         and not exists (
           select 1
           from (values
             ('learner_profile'), ('teacher_learner')
           ) as protected_table(table_name)
           cross join unnest(array['INSERT', 'UPDATE', 'DELETE'])
             as protected_privilege(privilege_name)
           where has_table_privilege(
             'authenticated',
             'public.' || protected_table.table_name,
             protected_privilege.privilege_name
           )
         )
         and not exists (
           select 1
           from unnest(array[
             'account_login_alias', 'account_security', 'account_preference',
             'learner_profile_share_code', 'learner_connection_request',
             'learner_claim_invitation', 'learner_profile_merge',
             'learner_profile_merge_conflict',
             'learner_profile_merge_private_detail', 'learner_profile_alias',
             'learner_observer_invitation', 'learner_observer_grant',
             'learner_ai_consent', 'learner_identity_audit_event',
             'learner_identity_rate_limit', 'learner_erasure_request',
             'learner_credential_recovery_delegate',
             'learner_identity_reconciliation'
           ]) as identity_table(table_name)
           cross join unnest(array['anon', 'authenticated']) as actor(role_name)
           cross join unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE'])
             as checked_privilege(privilege_name)
           where has_table_privilege(
             actor.role_name,
             'public.' || identity_table.table_name,
             checked_privilege.privilege_name
           )
         )
         and not exists (
           select 1
           from public.account as account
           where account.status in ('active', 'provisional')
             and (
               select count(*)
               from public.learner_profile as profile
               where profile.account_id = account.id
             ) <> 1
         )
         and exists (
           select 1
           from pg_proc as procedure
           where procedure.oid = to_regprocedure(
             'public.archive_course(uuid)'
           )
             and procedure.prosecdef
             and procedure.proconfig @> array['search_path=\"\"']
             and procedure.proowner = (
               select relation.relowner
               from pg_class as relation
               where relation.oid = 'public.course'::regclass
             )
             and not exists (
               select 1
               from aclexplode(
                 coalesce(
                   procedure.proacl,
                   acldefault('f', procedure.proowner)
                 )
               ) as acl_entry
               where acl_entry.grantee = 0
                 and acl_entry.privilege_type = 'EXECUTE'
             )
         )
         and not exists (
           select 1
           from unnest(array['anon', 'service_role']) as actor(role_name)
           where has_function_privilege(
             actor.role_name,
             'public.archive_course(uuid)',
             'EXECUTE'
           )
         )
         and has_function_privilege(
           'authenticated',
           'public.archive_course(uuid)',
           'EXECUTE'
         )
         and not exists (
           select 1
           from pg_proc as procedure
           where procedure.oid in (
             to_regprocedure('public.guard_course_archive_invariants()'),
             to_regprocedure('public.guard_course_publication_active_source()'),
             to_regprocedure('public.guard_lesson_course_immutable()'),
             to_regprocedure('public.guard_lesson_run_active_course()')
           )
             and (
               procedure.prosecdef
               or procedure.proconfig is null
               or not (procedure.proconfig @> array['search_path=\"\"'])
               or procedure.proowner <> (
                 select relation.relowner
                 from pg_class as relation
                 where relation.oid = 'public.course'::regclass
               )
             )
         )
         and not exists (
           select 1
           from unnest(array[
             'public.guard_course_archive_invariants()',
             'public.guard_course_publication_active_source()',
             'public.guard_lesson_course_immutable()',
             'public.guard_lesson_run_active_course()'
           ]) as guarded(signature)
           cross join unnest(array['anon', 'authenticated', 'service_role'])
             as actor(role_name)
           where has_function_privilege(
             actor.role_name,
             guarded.signature,
             'EXECUTE'
           )
         )
         and not exists (
           select 1
           from pg_proc as procedure
           where procedure.oid in (
             to_regprocedure('public.touch_course_from_authoring_child()'),
             to_regprocedure('public.touch_courses_from_stored_file()')
           )
             and (
               not procedure.prosecdef
               or procedure.proconfig is null
               or not (procedure.proconfig @> array['search_path=\"\"'])
               or procedure.proowner <> (
                 select relation.relowner
                 from pg_class as relation
                 where relation.oid = 'public.course'::regclass
               )
             )
         )
         and not exists (
           select 1
           from unnest(array[
             'public.touch_course_from_authoring_child()',
             'public.touch_courses_from_stored_file()'
           ]) as guarded(signature)
           cross join unnest(array['anon', 'authenticated', 'service_role'])
             as actor(role_name)
           where has_function_privilege(
             actor.role_name,
             guarded.signature,
             'EXECUTE'
           )
         )
         and not has_table_privilege(
           'authenticated', 'public.course', 'UPDATE'
         )
         and not has_table_privilege(
           'authenticated', 'public.course', 'DELETE'
         )
         and not has_column_privilege(
           'authenticated', 'public.course', 'archived_at', 'UPDATE'
         )
         and (
           select bool_and(
             has_column_privilege(
               'authenticated', 'public.course', allowed.column_name, 'UPDATE'
             )
           )
           from unnest(array[
             'title', 'subject', 'goal', 'level', 'audience_description',
             'target_lesson_count', 'teacher_preferences', 'audience_type',
             'learning_audience', 'settings', 'assembled_at'
           ]) as allowed(column_name)
         )
         and not exists (
           select 1
           from pg_attribute as attribute
           where attribute.attrelid = 'public.course'::regclass
             and attribute.attnum > 0
             and not attribute.attisdropped
             and attribute.attname <> all(array[
               'title', 'subject', 'goal', 'level', 'audience_description',
               'target_lesson_count', 'teacher_preferences', 'audience_type',
               'learning_audience', 'settings', 'assembled_at'
             ])
             and has_column_privilege(
               'authenticated',
               'public.course',
               attribute.attname,
               'UPDATE'
             )
         )
         and not has_table_privilege(
           'authenticated', 'public.lesson', 'UPDATE'
         )
         and not has_table_privilege(
           'authenticated', 'public.lesson', 'DELETE'
         )
         and not has_column_privilege(
           'authenticated', 'public.lesson', 'course_id', 'UPDATE'
         )
         and (
           select bool_and(
             has_column_privilege(
               'authenticated', 'public.lesson', allowed.column_name, 'UPDATE'
             )
           )
           from unnest(array[
             'position', 'title', 'summary',
             'estimated_duration_minutes', 'settings'
           ]) as allowed(column_name)
         )
         and not exists (
           select 1
           from pg_attribute as attribute
           where attribute.attrelid = 'public.lesson'::regclass
             and attribute.attnum > 0
             and not attribute.attisdropped
             and attribute.attname <> all(array[
               'position', 'title', 'summary',
               'estimated_duration_minutes', 'settings'
             ])
             and has_column_privilege(
               'authenticated',
               'public.lesson',
               attribute.attname,
               'UPDATE'
             )
         )
         and not exists (
           select 1
           from (values
             (
               'public.course'::regclass,
               'trg_course_archive_invariants',
               to_regprocedure('public.guard_course_archive_invariants()'),
               19::smallint,
               array['archived_at']::text[]
             ),
             (
               'public.course_publication'::regclass,
               'trg_course_publication_active_source',
               to_regprocedure('public.guard_course_publication_active_source()'),
               23::smallint,
               array['status', 'source_course_id']::text[]
             ),
             (
               'public.lesson'::regclass,
               'trg_lesson_course_immutable',
               to_regprocedure('public.guard_lesson_course_immutable()'),
               19::smallint,
               array['course_id']::text[]
             ),
             (
               'public.lesson_run'::regclass,
               'trg_lesson_run_active_course',
               to_regprocedure('public.guard_lesson_run_active_course()'),
               23::smallint,
               array['lesson_id', 'ended_at', 'cancelled_at']::text[]
             )
           ) as required_trigger(
             relation_id,
             trigger_name,
             function_id,
             trigger_type,
             column_names
           )
           where not exists (
             select 1
             from pg_trigger as trigger
             where trigger.tgrelid = required_trigger.relation_id
               and trigger.tgname = required_trigger.trigger_name
               and trigger.tgfoid = required_trigger.function_id
               and trigger.tgtype = required_trigger.trigger_type
               and not trigger.tgisinternal
               and trigger.tgenabled = 'O'
               and trigger.tgqual is null
               and (
                 select array_agg(
                   attribute.attname::text
                   order by attribute.attname::text
                 )
                 from unnest(trigger.tgattr::smallint[]) as column_ref(attnum)
                 join pg_attribute as attribute
                   on attribute.attrelid = trigger.tgrelid
                  and attribute.attnum = column_ref.attnum
               ) = (
                 select array_agg(column_name order by column_name)
                 from unnest(required_trigger.column_names) as column_name
               )
           )
         )
         and not exists (
           select 1
           from public.course as course
           join public.course_publication as publication
             on publication.source_course_id = course.id
           where course.archived_at is not null
             and publication.status = 'published'
         )
         and not exists (
           select 1
           from public.course as course
           join public.lesson as lesson on lesson.course_id = course.id
           join public.lesson_run as run on run.lesson_id = lesson.id
           where course.archived_at is not null
             and run.ended_at is null
             and run.cancelled_at is null
         )
         and exists (
           select 1
           from pg_trigger as trigger
           where trigger.tgrelid = 'auth.users'::regclass
             and trigger.tgname = 'trg_auth_user_create_account'
             and trigger.tgfoid = to_regprocedure(
               'public.handle_auth_user_account()'
             )
             and not trigger.tgisinternal
             and trigger.tgenabled = 'O'
             -- ROW + AFTER INSERT, with no other event bits or WHEN clause.
             and trigger.tgtype = 5
             and trigger.tgqual is null
         )
         and exists (
           select 1
           from pg_trigger as trg
           where trg.tgrelid = 'public.account'::regclass
             and trg.tgname = 'trg_account_exactly_one_learner_profile'
             and not trg.tgisinternal
             and trg.tgenabled = 'O'
             -- ROW + AFTER INSERT/DELETE/UPDATE, no other event bits.
             and trg.tgtype = 29
             and trg.tgconstraint <> 0
             and trg.tgfoid = to_regprocedure(
               'public.enforce_account_exactly_one_learner_profile()'
             )
             and trg.tgdeferrable
             and trg.tginitdeferred
         )
         and exists (
           select 1
           from pg_trigger as trg
           where trg.tgrelid = 'public.learner_profile'::regclass
             and trg.tgname = 'trg_learner_profile_exactly_one_account'
             and not trg.tgisinternal
             and trg.tgenabled = 'O'
             -- ROW + AFTER INSERT/DELETE/UPDATE, no other event bits.
             and trg.tgtype = 29
             and trg.tgconstraint <> 0
             and trg.tgfoid = to_regprocedure(
               'public.enforce_account_exactly_one_learner_profile()'
             )
             and trg.tgdeferrable
             and trg.tginitdeferred
         )
         and exists (
           select 1
           from pg_proc as procedure
           where procedure.oid = to_regprocedure(
             'public.enforce_account_exactly_one_learner_profile()'
           )
             and procedure.prosecdef
             and procedure.proconfig @> array['search_path=\"\"']
             and not exists (
               select 1
               from pg_class as relation
               where relation.oid in (
                 'public.account'::regclass,
                 'public.learner_profile'::regclass
               )
                 and (
                   relation.relowner <> procedure.proowner
                   or relation.relforcerowsecurity
                 )
             )
             and not exists (
               select 1
               from aclexplode(
                 coalesce(
                   procedure.proacl,
                   acldefault('f', procedure.proowner)
                 )
               ) as acl_entry
               where acl_entry.grantee = 0
                 and acl_entry.privilege_type = 'EXECUTE'
             )
         )
         and not exists (
           select 1
           from unnest(
             array['anon', 'authenticated', 'service_role'] || case
               when exists (
                 select 1 from pg_roles
                 where rolname = 'supabase_auth_admin'
               ) then array['supabase_auth_admin']
               else array[]::text[]
             end
           )
             as actor(role_name)
           where has_function_privilege(
             actor.role_name,
             'public.enforce_account_exactly_one_learner_profile()',
             'EXECUTE'
           )
         )
         and exists (
           select 1
           from pg_proc as procedure
           join pg_roles as owner on owner.oid = procedure.proowner
           where procedure.oid = to_regprocedure(
             'public.sync_provisional_account_from_auth_metadata()'
           )
             and procedure.prosecdef
             and procedure.proconfig @> array['search_path=\"\"']
             and has_table_privilege(owner.rolname, 'auth.users', 'SELECT')
             and (
               owner.rolsuper
               or owner.rolbypassrls
               or exists (
                 select 1
                 from pg_class as auth_relation
                 where auth_relation.oid = 'auth.users'::regclass
                   and auth_relation.relowner = procedure.proowner
                 and not auth_relation.relforcerowsecurity
               )
             )
             and not exists (
               select 1
               from pg_class as relation
               where relation.oid in (
                 'public.account'::regclass,
                 'public.account_login_alias'::regclass,
                 'public.account_security'::regclass,
                 'public.account_preference'::regclass,
                 'public.learner_profile'::regclass,
                 'public.learner_claim_invitation'::regclass
               )
                 and (
                   relation.relowner <> procedure.proowner
                   or relation.relforcerowsecurity
                 )
             )
             and lower(procedure.prosrc) like
               '%account.xmin = v_auth_xmin%'
             and lower(procedure.prosrc) like
               '%learner_identity_provisional_auth_sync_pristine_mismatch%'
             and not exists (
               select 1
               from aclexplode(
                 coalesce(
                   procedure.proacl,
                   acldefault('f', procedure.proowner)
                 )
               ) as acl_entry
               where acl_entry.grantee = 0
                 and acl_entry.privilege_type = 'EXECUTE'
             )
         )
         and exists (
           select 1
           from pg_trigger as trigger
           where trigger.tgrelid = 'auth.users'::regclass
             and trigger.tgname = 'trg_auth_user_sync_provisional_account'
             and trigger.tgfoid = to_regprocedure(
               'public.sync_provisional_account_from_auth_metadata()'
             )
             and not trigger.tgisinternal
             and trigger.tgenabled = 'O'
             and trigger.tgtype = 17
             and trigger.tgattr::text = (
               select attribute.attnum::text
               from pg_attribute as attribute
               where attribute.attrelid = 'auth.users'::regclass
                 and attribute.attname = 'raw_app_meta_data'
                 and not attribute.attisdropped
             )
             and trigger.tgqual is not null
             and lower(pg_get_triggerdef(trigger.oid, true)) like
               '%identity_status%'
             and lower(pg_get_triggerdef(trigger.oid, true)) like
               '%activation_invitation_id%'
             and (
               select count(*)
               from regexp_matches(
                 lower(pg_get_triggerdef(trigger.oid, true)),
                 'is distinct from',
                 'g'
               )
             ) = 2
         )
         and not exists (
           select 1
           from unnest(
             array['anon', 'authenticated', 'service_role'] || case
               when exists (
                 select 1 from pg_roles
                 where rolname = 'supabase_auth_admin'
               ) then array['supabase_auth_admin']
               else array[]::text[]
             end
           ) as actor(role_name)
           where has_function_privilege(
             actor.role_name,
             'public.sync_provisional_account_from_auth_metadata()',
             'EXECUTE'
           )
         )
         and not exists (
           select 1
           from public.account as account
           join auth.users as auth_user on auth_user.id = account.auth_user_id
           join public.learner_claim_invitation as invitation
             on invitation.id::text =
               auth_user.raw_app_meta_data ->> 'activation_invitation_id'
           join public.learner_profile as source
             on source.id = invitation.source_learner_profile_id
           where account.status = 'active'
             and auth_user.raw_app_meta_data ->> 'identity_status' = 'provisional'
             and coalesce(lower(auth_user.email), '')
               ~ '^[0-9a-f]{64}@learners[.]shidao[.]internal$'
             and invitation.kind = 'child_activation'
             and invitation.status in ('pending', 'bound')
             and invitation.expires_at > clock_timestamp()
             and source.account_id is null
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
           to_regprocedure(
             'public.complete_lesson_run_v2(uuid,jsonb,text,timestamptz,integer)'
           )
         ) like '%shareWithLearner%'
         and pg_get_functiondef(
           to_regprocedure(
             'public.complete_lesson_run_v2(uuid,jsonb,text,timestamptz,integer)'
           )
         ) like '%started_at_is_actual%'
         and pg_get_functiondef(
           to_regprocedure(
             'public.complete_lesson_run_v2(uuid,jsonb,text,timestamptz,integer)'
           )
         ) like '%lesson_run_absent_learner_has_observation%'
         and pg_get_functiondef(
           to_regprocedure(
             'public.complete_lesson_run_v2(uuid,jsonb,text,timestamptz,integer)'
           )
         ) like '%lesson_component_observation%'
         and position(
           'for update of component'
           in lower(pg_get_functiondef(to_regprocedure(
             'public.complete_lesson_run_v2(uuid,jsonb,text,timestamptz,integer)'
           )))
         ) > position(
           'for update of lesson'
           in lower(pg_get_functiondef(to_regprocedure(
             'public.complete_lesson_run_v2(uuid,jsonb,text,timestamptz,integer)'
           )))
         )
         and position(
           'for update of run'
           in lower(pg_get_functiondef(to_regprocedure(
             'public.complete_lesson_run_v2(uuid,jsonb,text,timestamptz,integer)'
           )))
         ) > position(
           'for update of component'
           in lower(pg_get_functiondef(to_regprocedure(
             'public.complete_lesson_run_v2(uuid,jsonb,text,timestamptz,integer)'
           )))
         )
         and position(
           'for update of record'
           in lower(pg_get_functiondef(to_regprocedure(
             'public.complete_lesson_run_v2(uuid,jsonb,text,timestamptz,integer)'
           )))
         ) > position(
           'for update of run'
           in lower(pg_get_functiondef(to_regprocedure(
             'public.complete_lesson_run_v2(uuid,jsonb,text,timestamptz,integer)'
           )))
         )
         and exists (
           select 1
           from pg_class as relation
           where relation.oid = 'public.lesson_component_observation'::regclass
             and relation.relrowsecurity
         )
         and exists (
           select 1
           from pg_policies as policy
           where policy.schemaname = 'public'
             and policy.tablename = 'lesson_component_observation'
             and policy.policyname =
               'lesson_component_observation_recorder_select'
             and policy.cmd = 'SELECT'
             and policy.roles = array['authenticated'::name]
             and policy.qual like '%current_account_id()%'
         )
         and has_table_privilege(
           'authenticated',
           'public.lesson_component_observation',
           'SELECT'
         )
         and not exists (
           select 1
           from unnest(array['anon', 'authenticated']) as actor(role_name)
           cross join unnest(array[
             'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'
           ]) as checked(privilege_name)
           where has_table_privilege(
             actor.role_name,
             'public.lesson_component_observation',
             checked.privilege_name
           )
         )
         and not has_table_privilege(
           'anon',
           'public.lesson_component_observation',
           'SELECT'
         )
         and not exists (
           select 1
           from pg_class as relation
           cross join lateral aclexplode(
             coalesce(
               relation.relacl,
               acldefault('r', relation.relowner)
             )
           ) as acl_entry
           where relation.oid =
               'public.lesson_component_observation'::regclass
             and acl_entry.grantee = 0
         )
         and exists (
           select 1
           from pg_proc as procedure
           where procedure.oid = to_regprocedure(
             'public.save_lesson_component_observations(uuid,uuid,text,text,text,jsonb)'
           )
             and procedure.prosecdef
             and procedure.proretset
             and procedure.proconfig @> array['search_path=\"\"']
             and not exists (
               select 1
               from aclexplode(
                 coalesce(
                   procedure.proacl,
                   acldefault('f', procedure.proowner)
                 )
               ) as acl_entry
               where acl_entry.grantee = 0
                 and acl_entry.privilege_type = 'EXECUTE'
             )
         )
         and has_function_privilege(
           'authenticated',
           'public.save_lesson_component_observations(uuid,uuid,text,text,text,jsonb)',
           'EXECUTE'
         )
         and not exists (
           select 1
           from unnest(array['anon', 'service_role']) as actor(role_name)
           where has_function_privilege(
             actor.role_name,
             'public.save_lesson_component_observations(uuid,uuid,text,text,text,jsonb)',
             'EXECUTE'
           )
         )
         and exists (
           select 1
           from pg_constraint
           where conrelid =
               'public.lesson_component_observation'::regclass
             and conname =
               'lesson_component_observation_record_recorder_fkey'
             and contype = 'f'
             and confdeltype = 'c'
             and convalidated
         )
         and exists (
           select 1
           from pg_constraint
           where conrelid =
               'public.lesson_component_observation'::regclass
             and conname =
               'lesson_component_observation_live_component_fkey'
             and contype = 'f'
             and confdeltype = 'n'
             and convalidated
         )
         and exists (
           select 1
           from pg_proc as procedure
           where procedure.oid = to_regprocedure(
             'public.delete_draft_observations_for_lesson_component()'
           )
             and procedure.prosecdef
             and procedure.proconfig @> array['search_path=\"\"']
             and position(
               'delete from public.lesson_component_observation'
               in lower(pg_get_functiondef(procedure.oid))
             ) > 0
             and position(
               'record.occurred_at is null'
               in lower(pg_get_functiondef(procedure.oid))
             ) > 0
             and position(
               'observation.lesson_component_id = old.id'
               in lower(pg_get_functiondef(procedure.oid))
             ) > 0
             and not exists (
               select 1
               from aclexplode(
                 coalesce(
                   procedure.proacl,
                   acldefault('f', procedure.proowner)
                 )
               ) as acl_entry
               where acl_entry.grantee = 0
                 and acl_entry.privilege_type = 'EXECUTE'
             )
         )
         and has_function_privilege(
           'postgres',
           'public.delete_draft_observations_for_lesson_component()',
           'EXECUTE'
         )
         and not exists (
           select 1
           from unnest(array['anon', 'authenticated', 'service_role'])
             as actor(role_name)
           where has_function_privilege(
             actor.role_name,
             'public.delete_draft_observations_for_lesson_component()',
             'EXECUTE'
           )
         )
         and exists (
           select 1
           from pg_trigger as trigger
           where trigger.tgrelid = 'public.lesson_component'::regclass
             and trigger.tgname =
               'trg_lesson_component_delete_draft_observations'
             and not trigger.tgisinternal
             and trigger.tgenabled = 'O'
             and trigger.tgtype = 11
             and trigger.tgfoid = to_regprocedure(
               'public.delete_draft_observations_for_lesson_component()'
             )
         )
         and position(
           'for update of lesson'
           in lower(pg_get_functiondef(
             'public.delete_lesson_component(uuid)'::regprocedure
           ))
         ) > 0
         and position(
           'for update of component'
           in lower(pg_get_functiondef(
             'public.delete_lesson_component(uuid)'::regprocedure
           ))
         ) > position(
           'for update of lesson'
           in lower(pg_get_functiondef(
             'public.delete_lesson_component(uuid)'::regprocedure
           ))
         )
         and position(
           'for update of run'
           in lower(pg_get_functiondef(
             'public.delete_lesson_component(uuid)'::regprocedure
           ))
         ) > position(
           'for update of component'
           in lower(pg_get_functiondef(
             'public.delete_lesson_component(uuid)'::regprocedure
           ))
         )
         and position(
           'for update of record'
           in lower(pg_get_functiondef(
             'public.delete_lesson_component(uuid)'::regprocedure
           ))
         ) > position(
           'for update of run'
           in lower(pg_get_functiondef(
             'public.delete_lesson_component(uuid)'::regprocedure
           ))
         )
         and position(
           'for update of component'
           in lower(pg_get_functiondef(
             'public.delete_lesson_with_history(uuid)'::regprocedure
           ))
         ) > position(
           'for update of lesson'
           in lower(pg_get_functiondef(
             'public.delete_lesson_with_history(uuid)'::regprocedure
           ))
         )
         and position(
           'for update of run'
           in lower(pg_get_functiondef(
             'public.delete_lesson_with_history(uuid)'::regprocedure
           ))
         ) > position(
           'for update of component'
           in lower(pg_get_functiondef(
             'public.delete_lesson_with_history(uuid)'::regprocedure
           ))
         )
         and position(
           'for update of record'
           in lower(pg_get_functiondef(
             'public.delete_lesson_with_history(uuid)'::regprocedure
           ))
         ) > position(
           'for update of run'
           in lower(pg_get_functiondef(
             'public.delete_lesson_with_history(uuid)'::regprocedure
           ))
         )
         and position(
           'set lesson_run_id = null,'
           in lower(pg_get_functiondef(
             'public.delete_lesson_with_history(uuid)'::regprocedure
           ))
         ) > 0
         and position(
           'source_lesson_id = null'
           in lower(pg_get_functiondef(
             'public.delete_lesson_with_history(uuid)'::regprocedure
           ))
         ) > 0
         and position(
           'record.occurred_at is not null'
           in lower(pg_get_functiondef(
             'public.delete_lesson_with_history(uuid)'::regprocedure
           ))
         ) > 0
         and pg_get_function_result(
           'public.create_learner_profile_with_groups(text,uuid[])'::regprocedure
         ) like '%teacher_learner%'
         and pg_get_function_result(
           'public.update_learner_profile_with_groups(uuid,text,uuid[])'::regprocedure
         ) like '%teacher_learner%'
         and pg_get_function_result(
           'public.archive_learner_profile(uuid)'::regprocedure
         ) like '%teacher_learner%'
         and (
           -- Strict M1-M3 expand stage: every compatibility helper/type and
           -- the exact temporary authenticated grants are still present.
           (
             to_regtype('public.guardian_relation') is not null
             and to_regtype('public.guardian_status') is not null
             and not exists (
               select 1 from legacy_helper
               where to_regprocedure(legacy_helper.signature) is null
             )
             and not exists (
               select 1 from compatibility_dual_write
               where to_regprocedure(compatibility_dual_write.signature) is null
                  or pg_get_functiondef(
                    to_regprocedure(compatibility_dual_write.signature)
                  ) not like '%public.user_security%'
             )
             and not exists (
               select 1 from contract_internal_function
               where to_regprocedure(contract_internal_function.signature) is null
                  or lower(pg_get_functiondef(
                    to_regprocedure(contract_internal_function.signature)
                  )) like '%user_security%'
             )
             and not exists (
               select 1
               from contract_edge
               where position(
                 contract_edge.callee_name in coalesce(
                   pg_get_functiondef(
                     to_regprocedure(contract_edge.root_signature)
                   ),
                   ''
                 )
               ) = 0
             )
             and not exists (
               select 1
               from contract_internal_function
               cross join unnest(array['anon', 'authenticated', 'service_role'])
                 as actor(role_name)
               where has_function_privilege(
                 actor.role_name,
                 contract_internal_function.signature,
                 'EXECUTE'
               )
             )
             and not exists (
               select 1
               from legacy_table
               cross join checked_table_privilege
               where has_table_privilege(
                 'anon',
                 'public.' || legacy_table.table_name,
                 checked_table_privilege.privilege_name
               )
             )
             and not exists (
               select 1
               from legacy_table
               cross join checked_table_privilege
               left join expand_authenticated_grant
                 on expand_authenticated_grant.table_name = legacy_table.table_name
                and expand_authenticated_grant.privilege_name =
                  checked_table_privilege.privilege_name
               where has_table_privilege(
                 'authenticated',
                 'public.' || legacy_table.table_name,
                 checked_table_privilege.privilege_name
               ) is distinct from (expand_authenticated_grant.table_name is not null)
             )
           )
           or
           -- Strict M4 contract stage: the whole helper/type/ACL set is gone.
           (
             to_regtype('public.guardian_relation') is null
             and to_regtype('public.guardian_status') is null
             and not exists (
               select 1 from legacy_helper
               where to_regprocedure(legacy_helper.signature) is not null
             )
             and not exists (
               select 1 from compatibility_dual_write
               where to_regprocedure(compatibility_dual_write.signature) is null
                  or pg_get_functiondef(
                    to_regprocedure(compatibility_dual_write.signature)
                  ) like '%public.user_security%'
             )
             and not exists (
               select 1 from contract_clean_function
               where to_regprocedure(contract_clean_function.signature) is null
                  or lower(pg_get_functiondef(
                    to_regprocedure(contract_clean_function.signature)
                  )) like '%user_security%'
             )
             and not exists (
               select 1
               from contract_edge
               where position(
                 contract_edge.callee_name in coalesce(
                   pg_get_functiondef(
                     to_regprocedure(contract_edge.root_signature)
                   ),
                   ''
                 )
               ) = 0
             )
             and not exists (
               select 1
               from pg_proc as procedure
               join pg_namespace as namespace
                 on namespace.oid = procedure.pronamespace
               where namespace.nspname = 'public'
                 and lower(procedure.prosrc) like '%user_security%'
             )
             and not exists (
               select 1
               from contract_internal_function
               cross join unnest(array['anon', 'authenticated', 'service_role'])
                 as actor(role_name)
               where has_function_privilege(
                 actor.role_name,
                 contract_internal_function.signature,
                 'EXECUTE'
               )
             )
             and not exists (
               select 1
               from legacy_table
               cross join unnest(array['anon', 'authenticated']) as actor(role_name)
               cross join checked_table_privilege
               where has_table_privilege(
                 actor.role_name,
                 'public.' || legacy_table.table_name,
                 checked_table_privilege.privilege_name
               )
             )
           )
         )
        then case
          when to_regtype('public.guardian_relation') is null
            then 'shidao-v2-contract'
          else 'shidao-v2-expand'
        end
        else 'schema-mismatch'
      end;
    "
} | tr -d '[:space:]')"

if [[ "${SHIDAO_SCHEMA_SIGNATURE}" != "shidao-v2-expand" \
  && "${SHIDAO_SCHEMA_SIGNATURE}" != "shidao-v2-contract" ]]; then
  echo "Refusing to refresh: the target does not match the current ShiDao V2 schema signature." >&2
  exit 1
fi

SCHEMA_STAGE="${SHIDAO_SCHEMA_SIGNATURE#shidao-v2-}"

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

for required_cross_schema_line in \
  "CREATE TRIGGER trg_auth_user_create_account" \
  "AFTER INSERT ON auth.users" \
  "FOR EACH ROW EXECUTE FUNCTION public.handle_auth_user_account();" \
  "CREATE TRIGGER trg_auth_user_sync_provisional_account" \
  "AFTER UPDATE OF raw_app_meta_data ON auth.users" \
  "(OLD.raw_app_meta_data ->> 'identity_status') IS DISTINCT FROM" \
  "(OLD.raw_app_meta_data ->> 'activation_invitation_id') IS DISTINCT FROM" \
  "EXECUTE FUNCTION public.sync_provisional_account_from_auth_metadata();" \
  "'profile-avatars'," \
  "ARRAY['image/webp']::text[]" \
  "No storage.objects policy exists for profile-avatars"; do
  if ! grep -Fq -- "${required_cross_schema_line}" "${TMP_CROSS}"; then
    echo "Refusing to refresh: reviewed cross-schema section is missing ${required_cross_schema_line}." >&2
    exit 1
  fi
done

if [[ "$(grep -Fc -- "IS DISTINCT FROM" "${TMP_CROSS}")" -ne 2 ]]; then
  echo "Refusing to refresh: reviewed provisional Auth trigger predicate is not exact." >&2
  exit 1
fi

if grep -Fq -- "CREATE POLICY profile_avatars_" "${TMP_CROSS}" \
  || grep -Fq -- "bucket_id = 'profile-avatars'" "${TMP_CROSS}"; then
  echo "Refusing to refresh: reviewed profile avatar Storage boundary is not server-only." >&2
  exit 1
fi

if pg_dump --help 2>&1 | grep -Fq -- "--restrict-key"; then
  pg_dump \
    --schema-only \
    --no-owner \
    --restrict-key=shidaoSchemaSnapshot20260807 \
    --schema=public \
    "${DATABASE_URL}" > "${TMP_PUBLIC}"
else
  # macOS still ships Bash 3.2, where expanding an empty array under `set -u`
  # raises an unbound-variable error. Keep the no-restrict-key branch explicit.
  pg_dump \
    --schema-only \
    --no-owner \
    --schema=public \
    "${DATABASE_URL}" > "${TMP_PUBLIC}"
fi

{
  echo "-- CURRENT SCHEMA SNAPSHOT (post-migration reference)"
  echo "-- Generated by scripts/refresh-schema-snapshot.sh on $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  echo "-- Learner identity release stage: ${SCHEMA_STAGE}"
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
  "trg_auth_user_sync_provisional_account" \
  "course_assets_owner_select" \
  "No storage.objects policy exists for profile-avatars" \
  "avatar_kind text" \
  "avatar_preset_key text" \
  "avatar_storage_path text" \
  "avatar_revision integer" \
  "avatar_updated_at timestamp with time zone" \
  "CREATE TABLE public.lesson_run" \
  "CREATE TABLE public.learning_record" \
  "CREATE TABLE public.lesson_component_observation" \
  "learning_record_id_recorded_by_unique" \
  "lesson_component_observation_record_source_unique" \
  "lesson_component_observation_record_recorder_fkey" \
  "lesson_component_observation_live_component_fkey" \
  "CREATE INDEX lesson_component_observation_live_component_idx" \
  "CREATE INDEX lesson_component_observation_recorder_observed_idx" \
  "CREATE TRIGGER trg_lesson_component_observation_updated_at" \
  "CREATE TABLE public.teacher_learner" \
  "CREATE TABLE public.learner_group" \
  "CREATE TABLE public.learner_group_member" \
  "CREATE TABLE public.course_learner_group" \
  "CREATE TABLE public.account_login_alias" \
  "CREATE TABLE public.account_security" \
  "CREATE TABLE public.account_preference" \
  "CREATE TABLE public.learner_profile_share_code" \
  "CREATE TABLE public.learner_connection_request" \
  "CREATE TABLE public.learner_claim_invitation" \
  "CREATE TABLE public.learner_profile_merge" \
  "CREATE TABLE public.learner_profile_merge_conflict" \
  "CREATE TABLE public.learner_profile_merge_private_detail" \
  "CREATE TABLE public.learner_profile_alias" \
  "CREATE TABLE public.learner_observer_invitation" \
  "CREATE TABLE public.learner_observer_grant" \
  "CREATE TABLE public.learner_ai_consent" \
  "CREATE TABLE public.learner_identity_audit_event" \
  "CREATE TABLE public.learner_identity_rate_limit" \
  "CREATE TABLE public.learner_erasure_request" \
  "CREATE TABLE public.learner_credential_recovery_delegate" \
  "CREATE TABLE public.learner_identity_reconciliation" \
  "CREATE TABLE public.course_attestation" \
  "CREATE TABLE public.course_publication_attestation" \
  "CREATE TABLE public.course_attestation_attempt" \
  "CREATE TABLE public.course_attestation_award" \
  "CREATE TABLE public.communication_thread" \
  "CREATE TABLE public.communication_message" \
  "CREATE TABLE public.communication_read_state" \
  "CREATE TABLE public.assistant_conversation" \
  "CREATE TABLE public.assistant_turn" \
  "CREATE TABLE public.system_notification" \
  "learning_audience text" \
  "CREATE POLICY course_attestation_owner_all" \
  "CREATE FUNCTION public.get_my_authored_course_attestation" \
  "CREATE FUNCTION public.replace_my_course_attestation" \
  "CREATE FUNCTION public.get_my_course_publication_attestation" \
  "CREATE FUNCTION public.submit_my_course_publication_attestation" \
  "CREATE FUNCTION public.list_my_course_publication_attestations" \
  "CREATE FUNCTION public.publish_course_revision_with_attestation_admin" \
  "CREATE FUNCTION public.clone_course_publication_with_attestation_admin" \
  "CREATE FUNCTION public.duplicate_course_with_attestation_admin" \
  "CREATE FUNCTION public.list_course_publication_catalog_v2_admin" \
  "CREATE FUNCTION public.assert_course_publication_copy_eligible_admin" \
  "CREATE FUNCTION public.replace_course_audience" \
  "CREATE FUNCTION public.archive_learner_profile" \
  "CREATE FUNCTION public.detach_archived_teacher_learner_links" \
  "CREATE FUNCTION public.enforce_course_learner_teacher_relation" \
  "CREATE FUNCTION public.enforce_learner_group_member_teacher_relation" \
  "CREATE FUNCTION public.enforce_learning_record_producer_immutable" \
  "CREATE FUNCTION public.enforce_account_exactly_one_learner_profile" \
  "CREATE FUNCTION public.sync_provisional_account_from_auth_metadata" \
  "CREATE FUNCTION public.current_account_auth_context" \
  "CREATE FUNCTION public.set_current_account_avatar" \
  "CREATE FUNCTION public.resolve_account_login_alias" \
  "CREATE FUNCTION public.verify_account_pin_credential" \
  "CREATE FUNCTION public.list_teacher_learner_directory" \
  "CREATE FUNCTION public.restore_teacher_learner" \
  "CREATE FUNCTION public.preview_learner_profile_merge" \
  "CREATE FUNCTION public.confirm_learner_profile_merge" \
  "CREATE FUNCTION public.get_my_learning_profile" \
  "CREATE FUNCTION public.get_my_learning_history" \
  "CREATE FUNCTION public.get_my_learning_progress" \
  "CREATE FUNCTION public.preview_my_learning_data_erasure" \
  "CREATE FUNCTION public.confirm_my_learning_data_erasure" \
  "CREATE FUNCTION public.list_my_learner_observer_overview" \
  "CREATE FUNCTION public.get_observed_learner_history" \
  "CREATE FUNCTION public.get_observed_learner_progress" \
  "CREATE FUNCTION public.request_learner_ai_consent" \
  "CREATE FUNCTION public.build_cross_provider_learner_context" \
  "CREATE FUNCTION public.schedule_lesson_run" \
  "CREATE FUNCTION public.complete_lesson_run_v2" \
  "CREATE FUNCTION public.save_lesson_component_observations" \
  "CREATE POLICY lesson_component_observation_recorder_select" \
  "CREATE FUNCTION public.delete_draft_observations_for_lesson_component" \
  "CREATE TRIGGER trg_lesson_component_delete_draft_observations" \
  "CREATE FUNCTION public.delete_lesson_component" \
  "CREATE FUNCTION public.delete_lesson_with_history" \
  "lesson_run_absent_learner_has_observation" \
  "set lesson_run_id = null," \
  "source_lesson_id = null" \
  "CREATE FUNCTION public.archive_course" \
  "CREATE FUNCTION public.guard_course_archive_invariants" \
  "CREATE FUNCTION public.guard_course_publication_active_source" \
  "CREATE FUNCTION public.guard_lesson_course_immutable" \
  "CREATE FUNCTION public.guard_lesson_run_active_course" \
  "CREATE FUNCTION public.schedule_lesson_run_if_unchanged" \
  "CREATE FUNCTION public.list_my_communication_inbox" \
  "CREATE FUNCTION public.open_direct_communication_thread" \
  "CREATE FUNCTION public.list_my_assistant_conversations" \
  "CREATE FUNCTION public.append_assistant_turn_admin" \
  "CREATE FUNCTION public.append_system_notification_admin" \
  "CREATE TRIGGER trg_course_archive_invariants" \
  "CREATE TRIGGER trg_course_publication_active_source" \
  "CREATE TRIGGER trg_lesson_course_immutable" \
  "CREATE TRIGGER trg_lesson_run_active_course" \
  "CREATE CONSTRAINT TRIGGER trg_lesson_run_communication_notifications" \
  "CREATE TRIGGER trg_communication_message_recompute_thread_after_delete"; do
  if ! grep -Fq "${required}" "${TMP_RESULT}"; then
    echo "Refusing to replace snapshot: generated result is missing ${required}." >&2
    exit 1
  fi
done

if grep -Eq 'CREATE TABLE public[.]lesson_step([ (]|$)' "${TMP_RESULT}"; then
  echo "Refusing to replace snapshot: generated result restores forbidden Lesson Step storage." >&2
  exit 1
fi

if [[ "${SCHEMA_STAGE}" == "expand" ]]; then
  for required_compatibility in \
    "CREATE TYPE public.guardian_relation" \
    "CREATE TYPE public.guardian_status" \
    "CREATE FUNCTION public.current_parent_id" \
    "CREATE FUNCTION public.current_student_id" \
    "CREATE FUNCTION public.current_teacher_id" \
    "CREATE FUNCTION public.verify_user_pin"; do
    if ! grep -Fq "${required_compatibility}" "${TMP_RESULT}"; then
      echo "Refusing to replace snapshot: expand result is missing ${required_compatibility}." >&2
      exit 1
    fi
  done
else
  for forbidden_contract_object in \
    "CREATE TYPE public.guardian_relation" \
    "CREATE TYPE public.guardian_status" \
    "CREATE FUNCTION public.current_parent_id" \
    "CREATE FUNCTION public.current_student_id" \
    "CREATE FUNCTION public.current_teacher_id" \
    "CREATE FUNCTION public.verify_user_pin"; do
    if grep -Fq "${forbidden_contract_object}" "${TMP_RESULT}"; then
      echo "Refusing to replace snapshot: contract result still contains ${forbidden_contract_object}." >&2
      exit 1
    fi
  done
fi

mv "${TMP_RESULT}" "${OUT_FILE}"
echo "Updated ${OUT_FILE} from the verified ${SCHEMA_STAGE} stage. Review git diff before committing."
