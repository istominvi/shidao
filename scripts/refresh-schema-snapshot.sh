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
           'public.complete_lesson_run_v2(uuid,jsonb,text,timestamptz,integer)'
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
  "EXECUTE FUNCTION public.sync_provisional_account_from_auth_metadata();"; do
  if ! grep -Fq -- "${required_cross_schema_line}" "${TMP_CROSS}"; then
    echo "Refusing to refresh: reviewed cross-schema section is missing ${required_cross_schema_line}." >&2
    exit 1
  fi
done

if [[ "$(grep -Fc -- "IS DISTINCT FROM" "${TMP_CROSS}")" -ne 2 ]]; then
  echo "Refusing to refresh: reviewed provisional Auth trigger predicate is not exact." >&2
  exit 1
fi

PG_DUMP_RESTRICT_KEY_ARGS=()
if pg_dump --help 2>&1 | grep -Fq -- "--restrict-key"; then
  PG_DUMP_RESTRICT_KEY_ARGS+=(
    "--restrict-key=shidaoSchemaSnapshot20260807"
  )
fi

pg_dump \
  --schema-only \
  --no-owner \
  "${PG_DUMP_RESTRICT_KEY_ARGS[@]}" \
  --schema=public \
  "${DATABASE_URL}" > "${TMP_PUBLIC}"

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
  "CREATE TABLE public.lesson_run" \
  "CREATE TABLE public.learning_record" \
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
  "CREATE FUNCTION public.replace_course_audience" \
  "CREATE FUNCTION public.archive_learner_profile" \
  "CREATE FUNCTION public.detach_archived_teacher_learner_links" \
  "CREATE FUNCTION public.enforce_course_learner_teacher_relation" \
  "CREATE FUNCTION public.enforce_learner_group_member_teacher_relation" \
  "CREATE FUNCTION public.enforce_learning_record_producer_immutable" \
  "CREATE FUNCTION public.enforce_account_exactly_one_learner_profile" \
  "CREATE FUNCTION public.sync_provisional_account_from_auth_metadata" \
  "CREATE FUNCTION public.current_account_auth_context" \
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
  "CREATE FUNCTION public.delete_lesson_with_history"; do
  if ! grep -Fq "${required}" "${TMP_RESULT}"; then
    echo "Refusing to replace snapshot: generated result is missing ${required}." >&2
    exit 1
  fi
done

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
