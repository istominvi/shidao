-- FINAL CONTRACT RELEASE ONLY.
--
-- This migration is intentionally separate from the expand/web cutover. It
-- must be withheld until the exact roleless web image is deployed and the
-- read-only dependency audit below succeeds. It removes no legacy rows and
-- uses no CASCADE; an unexpected dependency aborts the transaction.

begin;

do $$
declare
  v_drop_signatures constant text[] := array[
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
  ];
  v_drop_oids oid[];
  v_signature text;
  v_dependency record;
begin
  if to_regclass('public.account_security') is null
    or to_regclass('public.learner_observer_grant') is null
    or to_regprocedure('public.current_account_auth_context()') is null
    or to_regprocedure('public.get_my_learning_profile()') is null
    or to_regprocedure('public.build_cross_provider_learner_context(uuid,uuid)') is null
    or to_regprocedure('public.set_current_account_pin_impl(uuid,text)') is null
    or to_regprocedure('public.revoke_user_sessions_impl(uuid,timestamptz)') is null
    or to_regprocedure('public.activate_offline_learner_account_impl(uuid,uuid,bytea,bytea,text,text,uuid,boolean,boolean)') is null
    or to_regprocedure('public.reset_recoverable_learner_credentials_impl(uuid,uuid,text,text,timestamptz,uuid)') is null
  then
    raise exception 'learner_identity_contract_cleanup_preflight_expand_missing';
  end if;

  foreach v_signature in array v_drop_signatures loop
    if to_regprocedure(v_signature) is null then
      raise exception
        'learner_identity_contract_cleanup_preflight_helper_missing: %',
        v_signature;
    end if;
  end loop;

  select array_agg(to_regprocedure(signature)::oid order by signature)
  into v_drop_oids
  from unnest(v_drop_signatures) as signature;

  -- Every helper has an explicit dependency audit. Dependencies between
  -- helpers in this same contract set are expected; every other database
  -- object is a release blocker and DROP ... RESTRICT remains the final guard.
  for v_dependency in
    select
      pg_describe_object(
        dependency.classid, dependency.objid, dependency.objsubid
      ) as dependent_object,
      pg_describe_object(
        dependency.refclassid, dependency.refobjid,
        dependency.refobjsubid
      ) as referenced_helper
    from pg_depend as dependency
    where dependency.refclassid = 'pg_proc'::regclass
      and dependency.refobjid = any(v_drop_oids)
      and not (
        dependency.classid = 'pg_proc'::regclass
        and dependency.objid = any(v_drop_oids)
      )
      and not (
        dependency.classid = 'pg_policy'::regclass
        and exists (
          select 1
          from pg_policy as policy
          join pg_class as relation on relation.oid = policy.polrelid
          join pg_namespace as namespace on namespace.oid = relation.relnamespace
          join (values
            ('class', 'class_parent_context_select'),
            ('class', 'class_teacher_or_student_select'),
            ('class_student', 'class_student_related_select'),
            ('class_teacher', 'class_teacher_self_or_student_select'),
            ('parent', 'parent_self_select'),
            ('parent', 'parent_self_update'),
            ('school', 'school_parent_context_select'),
            ('school', 'school_teacher_membership_select'),
            ('school_teacher', 'school_teacher_self_select'),
            ('student', 'student_self_parent_teacher_select'),
            ('student', 'student_self_update'),
            ('teacher', 'teacher_self_select'),
            ('teacher', 'teacher_self_update')
          ) as removed_policy(table_name, policy_name)
            on removed_policy.table_name = relation.relname
           and removed_policy.policy_name = policy.polname
          where policy.oid = dependency.objid
            and namespace.nspname = 'public'
        )
      )
    order by referenced_helper, dependent_object
  loop
    raise exception
      'learner_identity_contract_cleanup_unexpected_dependency: % depends on %',
      v_dependency.dependent_object,
      v_dependency.referenced_helper;
  end loop;
end
$$;

-- Contract cutover: replace every supported expand wrapper that still
-- performs a rollback-only legacy sync. The canonical implementations have
-- no reference to user_security, and the postflight below proves that no
-- function body in public retains such a reference after old helpers drop.
create or replace function public.set_current_account_pin(
  p_actor_auth_user_id uuid,
  p_raw_pin text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.set_current_account_pin_impl(p_actor_auth_user_id, p_raw_pin);
end
$$;

create or replace function public.revoke_user_sessions(
  p_user_id uuid,
  p_cutoff timestamptz default now()
)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
begin
  return public.revoke_user_sessions_impl(p_user_id, p_cutoff);
end
$$;

create or replace function public.activate_offline_learner_account(
  p_actor_auth_user_id uuid,
  p_invitation_id uuid,
  p_token_digest bytea,
  p_recipient_email_digest bytea,
  p_learner_login text,
  p_raw_pin text,
  p_provisional_auth_user_id uuid,
  p_acknowledge_recovery_delegate boolean,
  p_request_observer_invitation boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  return public.activate_offline_learner_account_impl(
    p_actor_auth_user_id, p_invitation_id,
    p_token_digest, p_recipient_email_digest,
    p_learner_login, p_raw_pin, p_provisional_auth_user_id,
    p_acknowledge_recovery_delegate, p_request_observer_invitation
  );
end
$$;

create or replace function public.reset_recoverable_learner_credentials(
  p_actor_auth_user_id uuid,
  p_grant_id uuid,
  p_new_child_login text,
  p_raw_pin text,
  p_reauthenticated_at timestamptz,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  return public.reset_recoverable_learner_credentials_impl(
    p_actor_auth_user_id, p_grant_id,
    p_new_child_login, p_raw_pin,
    p_reauthenticated_at, p_idempotency_key
  );
end
$$;

-- Compatibility data stays intact but is no longer reachable through the Data
-- API after the roleless web cutover.
revoke all on table
  public.class,
  public.class_student,
  public.class_teacher,
  public.parent,
  public.school,
  public.school_teacher,
  public.student,
  public.teacher,
  public.user_preference,
  public.user_security
from anon, authenticated;

drop policy if exists class_parent_context_select on public.class;
drop policy if exists class_teacher_or_student_select on public.class;
drop policy if exists class_student_related_select on public.class_student;
drop policy if exists class_teacher_self_or_student_select on public.class_teacher;
drop policy if exists parent_self_select on public.parent;
drop policy if exists parent_self_update on public.parent;
drop policy if exists school_parent_context_select on public.school;
drop policy if exists school_teacher_membership_select on public.school;
drop policy if exists school_teacher_self_select on public.school_teacher;
drop policy if exists student_self_parent_teacher_select on public.student;
drop policy if exists student_self_update on public.student;
drop policy if exists teacher_self_select on public.teacher;
drop policy if exists teacher_self_update on public.teacher;

drop function public.can_read_class(uuid) restrict;
drop function public.is_class_student(uuid) restrict;
drop function public.is_class_teacher(uuid) restrict;
drop function public.is_my_child(uuid) restrict;
drop function public.parent_in_class(uuid) restrict;
drop function public.parent_in_school(uuid) restrict;
drop function public.teaches_student(uuid) restrict;
drop function public.current_parent_id() restrict;
drop function public.current_student_id() restrict;
drop function public.current_teacher_id() restrict;

drop function public.clear_user_pin(uuid) restrict;
drop function public.ensure_user_preference(uuid) restrict;
drop function public.ensure_user_security(uuid) restrict;
drop function public.get_last_active_profile(uuid) restrict;
drop function public.merge_user_settings(uuid,jsonb) restrict;
drop function public.onboard_parent(uuid,text) restrict;
drop function public.onboard_teacher(uuid,text) restrict;
drop function public.reset_pin_attempts(uuid) restrict;
drop function public.set_last_active_profile(uuid,text) restrict;
drop function public.set_last_selected_school(uuid,uuid) restrict;
drop function public.set_user_pin(uuid,text) restrict;
drop function public.upsert_user_theme(uuid,text) restrict;
drop function public.verify_user_pin(uuid,text) restrict;

drop type public.guardian_relation restrict;
drop type public.guardian_status restrict;

do $$
declare
  v_drop_signatures constant text[] := array[
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
  ];
  v_legacy_tables constant text[] := array[
    'class', 'class_student', 'class_teacher', 'parent', 'school',
    'school_teacher', 'student', 'teacher', 'user_preference',
    'user_security'
  ];
  v_contract_impl_signatures constant text[] := array[
    'public.set_current_account_pin_impl(uuid,text)',
    'public.revoke_user_sessions_impl(uuid,timestamptz)',
    'public.activate_offline_learner_account_impl(uuid,uuid,bytea,bytea,text,text,uuid,boolean,boolean)',
    'public.reset_recoverable_learner_credentials_impl(uuid,uuid,text,text,timestamptz,uuid)'
  ];
  v_signature text;
  v_table_name text;
  v_role_name text;
  v_contract_edge record;
  v_contract_source text;
  v_legacy_function_sources text;
begin
  foreach v_signature in array v_drop_signatures loop
    if to_regprocedure(v_signature) is not null then
      raise exception
        'learner_identity_contract_cleanup_postflight_helper_remains: %',
        v_signature;
    end if;
  end loop;

  if to_regtype('public.guardian_relation') is not null
    or to_regtype('public.guardian_status') is not null
  then
    raise exception 'learner_identity_contract_cleanup_postflight_type_remains';
  end if;

  if exists (
    select 1
    from pg_policy as policy
    join pg_class as relation on relation.oid = policy.polrelid
    join pg_namespace as namespace on namespace.oid = relation.relnamespace
    join (values
      ('class', 'class_parent_context_select'),
      ('class', 'class_teacher_or_student_select'),
      ('class_student', 'class_student_related_select'),
      ('class_teacher', 'class_teacher_self_or_student_select'),
      ('parent', 'parent_self_select'),
      ('parent', 'parent_self_update'),
      ('school', 'school_parent_context_select'),
      ('school', 'school_teacher_membership_select'),
      ('school_teacher', 'school_teacher_self_select'),
      ('student', 'student_self_parent_teacher_select'),
      ('student', 'student_self_update'),
      ('teacher', 'teacher_self_select'),
      ('teacher', 'teacher_self_update')
    ) as removed_policy(table_name, policy_name)
      on removed_policy.table_name = relation.relname
     and removed_policy.policy_name = policy.polname
    where namespace.nspname = 'public'
  ) then
    raise exception 'learner_identity_contract_cleanup_postflight_policy_remains';
  end if;

  -- The four supported contract RPCs must call their canonical-only workers,
  -- not retain an expand implementation or become accidental no-ops.
  for v_contract_edge in
    select * from (values
      (
        'public.set_current_account_pin(uuid,text)',
        'set_current_account_pin_impl'
      ),
      (
        'public.revoke_user_sessions(uuid,timestamptz)',
        'revoke_user_sessions_impl'
      ),
      (
        'public.activate_offline_learner_account(uuid,uuid,bytea,bytea,text,text,uuid,boolean,boolean)',
        'activate_offline_learner_account_impl'
      ),
      (
        'public.reset_recoverable_learner_credentials(uuid,uuid,text,text,timestamptz,uuid)',
        'reset_recoverable_learner_credentials_impl'
      )
    ) as contract_edge(root_signature, callee_name)
  loop
    select procedure.prosrc
    into v_contract_source
    from pg_proc as procedure
    where procedure.oid = to_regprocedure(v_contract_edge.root_signature);
    if v_contract_source is null
      or position(v_contract_edge.callee_name in v_contract_source) = 0
    then
      raise exception
        'learner_identity_contract_cleanup_postflight_canonical_edge_missing: % -> %',
        v_contract_edge.root_signature,
        v_contract_edge.callee_name;
    end if;
  end loop;

  -- Stronger than an ACL-only check: after the contract cutover no remaining
  -- public function definition may reference the compatibility table at all.
  -- This proves that a supported RPC cannot reach it through a definer helper.
  select string_agg(procedure.oid::regprocedure::text, ', ' order by procedure.oid::regprocedure::text)
  into v_legacy_function_sources
  from pg_proc as procedure
  join pg_namespace as namespace on namespace.oid = procedure.pronamespace
  where namespace.nspname = 'public'
    and lower(procedure.prosrc) like '%user_security%';
  if v_legacy_function_sources is not null then
    raise exception
      'learner_identity_contract_cleanup_postflight_legacy_function_source: %',
      v_legacy_function_sources;
  end if;

  foreach v_signature in array v_contract_impl_signatures loop
    foreach v_role_name in array array['anon', 'authenticated', 'service_role'] loop
      if has_function_privilege(v_role_name, v_signature, 'EXECUTE') then
        raise exception
          'learner_identity_contract_cleanup_postflight_impl_grant: % -> %',
          v_role_name, v_signature;
      end if;
    end loop;
  end loop;

  foreach v_role_name in array array['anon', 'authenticated'] loop
    foreach v_table_name in array v_legacy_tables loop
      if has_table_privilege(v_role_name, 'public.' || v_table_name, 'SELECT')
        or has_table_privilege(v_role_name, 'public.' || v_table_name, 'INSERT')
        or has_table_privilege(v_role_name, 'public.' || v_table_name, 'UPDATE')
        or has_table_privilege(v_role_name, 'public.' || v_table_name, 'DELETE')
        or has_table_privilege(v_role_name, 'public.' || v_table_name, 'TRUNCATE')
        or has_table_privilege(v_role_name, 'public.' || v_table_name, 'REFERENCES')
        or has_table_privilege(v_role_name, 'public.' || v_table_name, 'TRIGGER')
      then
        raise exception
          'learner_identity_contract_cleanup_postflight_legacy_grant: %.%',
          v_role_name, v_table_name;
      end if;
    end loop;
  end loop;
end
$$;

notify pgrst, 'reload schema';

commit;
