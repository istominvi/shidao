-- Harden the transitional identity surface before adding learner identity
-- capabilities.  This migration is deliberately compatible with the current
-- application image: server-side compatibility calls still use service_role,
-- while browser roles lose caller-supplied-user-id RPCs and broad table ACLs.

begin;

do $$
begin
  if to_regclass('public.account') is null
    or to_regclass('public.user_preference') is null
    or to_regclass('public.user_security') is null
    or to_regprocedure('public.current_account_id()') is null
    or to_regprocedure('public.handle_auth_user_account()') is null
  then
    raise exception 'identity_security_hardening_preflight_schema_mismatch';
  end if;
end
$$;

alter table public.user_preference enable row level security;
alter table public.user_security enable row level security;

drop policy if exists user_preference_self_select on public.user_preference;
drop policy if exists user_preference_self_update on public.user_preference;
drop policy if exists user_security_self_select on public.user_security;

-- These policies are defense in depth.  No browser role receives direct table
-- privileges below; self reads/writes use narrow functions instead.
create policy user_preference_self_select
on public.user_preference
for select
to authenticated
using (user_id = (select auth.uid()));

create policy user_preference_self_update
on public.user_preference
for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy user_security_self_select
on public.user_security
for select
to authenticated
using (user_id = (select auth.uid()));

revoke all on table public.user_preference
  from public, anon, authenticated;
revoke all on table public.user_security
  from public, anon, authenticated;
grant all on table public.user_preference to service_role;
grant all on table public.user_security to service_role;

-- Remove anonymous reachability from the complete transitional identity graph.
revoke all on table public.parent from anon;
revoke all on table public.teacher from anon;
revoke all on table public.student from anon;
revoke all on table public.school from anon;
revoke all on table public.school_teacher from anon;
revoke all on table public.class from anon;
revoke all on table public.class_teacher from anon;
revoke all on table public.class_student from anon;

-- Keep only the RLS-protected operations needed by a rollback image.
revoke all on table public.parent from authenticated;
grant select, update on table public.parent to authenticated;
revoke all on table public.teacher from authenticated;
grant select, update on table public.teacher to authenticated;
revoke all on table public.student from authenticated;
grant select, update on table public.student to authenticated;
revoke all on table public.school from authenticated;
grant select on table public.school to authenticated;
revoke all on table public.school_teacher from authenticated;
grant select on table public.school_teacher to authenticated;
revoke all on table public.class from authenticated;
grant select on table public.class to authenticated;
revoke all on table public.class_teacher from authenticated;
grant select on table public.class_teacher to authenticated;
revoke all on table public.class_student from authenticated;
grant select on table public.class_student to authenticated;

-- Caller supplied user IDs are trusted only across the server/service boundary
-- until the account-scoped replacements in the next migration are live.
revoke all on function public.clear_user_pin(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.clear_user_pin(uuid) to service_role;

revoke all on function public.ensure_user_preference(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.ensure_user_preference(uuid) to service_role;

revoke all on function public.ensure_user_security(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.ensure_user_security(uuid) to service_role;

revoke all on function public.get_last_active_profile(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.get_last_active_profile(uuid) to service_role;

revoke all on function public.merge_user_settings(uuid, jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.merge_user_settings(uuid, jsonb)
  to service_role;

revoke all on function public.onboard_parent(uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.onboard_parent(uuid, text) to service_role;

revoke all on function public.onboard_teacher(uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.onboard_teacher(uuid, text) to service_role;

revoke all on function public.reset_pin_attempts(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.reset_pin_attempts(uuid) to service_role;

revoke all on function public.revoke_user_sessions(uuid, timestamptz)
  from public, anon, authenticated, service_role;
grant execute on function public.revoke_user_sessions(uuid, timestamptz)
  to service_role;

revoke all on function public.set_last_active_profile(uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.set_last_active_profile(uuid, text)
  to service_role;

revoke all on function public.set_last_selected_school(uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.set_last_selected_school(uuid, uuid)
  to service_role;

revoke all on function public.set_user_pin(uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.set_user_pin(uuid, text) to service_role;

revoke all on function public.upsert_user_theme(uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.upsert_user_theme(uuid, text) to service_role;

revoke all on function public.verify_user_pin(uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.verify_user_pin(uuid, text) to service_role;

-- Auth-derived legacy helpers remain authenticated-only until the application
-- no longer has any role-table dependency.
revoke all on function public.can_read_class(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.can_read_class(uuid) to authenticated;
revoke all on function public.current_parent_id()
  from public, anon, authenticated, service_role;
grant execute on function public.current_parent_id() to authenticated;
revoke all on function public.current_student_id()
  from public, anon, authenticated, service_role;
grant execute on function public.current_student_id() to authenticated;
revoke all on function public.current_teacher_id()
  from public, anon, authenticated, service_role;
grant execute on function public.current_teacher_id() to authenticated;
revoke all on function public.is_class_student(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.is_class_student(uuid) to authenticated;
revoke all on function public.is_class_teacher(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.is_class_teacher(uuid) to authenticated;
revoke all on function public.is_my_child(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.is_my_child(uuid) to authenticated;
revoke all on function public.parent_in_class(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.parent_in_class(uuid) to authenticated;
revoke all on function public.parent_in_school(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.parent_in_school(uuid) to authenticated;
revoke all on function public.teaches_student(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.teaches_student(uuid) to authenticated;

revoke all on function public.set_updated_at()
  from public, anon, authenticated, service_role;

-- New raw-SQL objects are opt-in to the Data API.  Run for every creator role
-- the migration owner is allowed to alter; each new migration still performs
-- explicit object-level REVOKE/GRANT as the authoritative boundary.
do $$
declare
  v_role text;
begin
  foreach v_role in array array['postgres', 'supabase_admin'] loop
    if exists (select 1 from pg_roles where rolname = v_role)
      and (
        current_user = v_role
        or pg_has_role(current_user, v_role, 'MEMBER')
      )
    then
      execute format(
        'alter default privileges for role %I in schema public revoke all on tables from anon, authenticated, service_role',
        v_role
      );
      execute format(
        'alter default privileges for role %I in schema public revoke all on sequences from anon, authenticated, service_role',
        v_role
      );
      execute format(
        'alter default privileges for role %I in schema public revoke execute on functions from public, anon, authenticated, service_role',
        v_role
      );
    end if;
  end loop;
end
$$;

do $$
begin
  if not (select relrowsecurity from pg_class where oid = 'public.user_preference'::regclass)
    or not (select relrowsecurity from pg_class where oid = 'public.user_security'::regclass)
    or has_table_privilege('anon', 'public.user_preference', 'SELECT')
    or has_table_privilege('authenticated', 'public.user_security', 'SELECT')
    or has_function_privilege(
      'anon',
      'public.verify_user_pin(uuid,text)',
      'EXECUTE'
    )
    or has_function_privilege(
      'authenticated',
      'public.revoke_user_sessions(uuid,timestamptz)',
      'EXECUTE'
    )
  then
    raise exception 'identity_security_hardening_postflight_failed';
  end if;
end
$$;

notify pgrst, 'reload schema';

commit;
