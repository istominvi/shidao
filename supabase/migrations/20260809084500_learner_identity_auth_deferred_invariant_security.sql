-- Forward fix for the real GoTrue transaction boundary.
--
-- handle_auth_user_account() is SECURITY DEFINER, but its exactly-one
-- constraint triggers are DEFERRABLE INITIALLY DEFERRED. PostgreSQL executes
-- those deferred triggers when GoTrue commits, after the bootstrap function
-- has returned and the effective role is supabase_auth_admin again. The
-- invariant function therefore needs its own narrow SECURITY DEFINER boundary;
-- granting Auth direct access to Account/LearnerProfile would be broader.

begin;

do $$
declare
  v_function_oid oid := to_regprocedure(
    'public.enforce_account_exactly_one_learner_profile()'
  );
begin
  if to_regclass('public.account') is null
    or to_regclass('public.learner_profile') is null
    or v_function_oid is null
    or to_regprocedure('public.handle_auth_user_account()') is null
  then
    raise exception 'learner_identity_auth_deferred_invariant_preflight_missing';
  end if;

  if (
    select count(*)
    from pg_trigger as trg
    where trg.tgfoid = v_function_oid
      and (
        (
          trg.tgrelid = 'public.account'::regclass
          and trg.tgname = 'trg_account_exactly_one_learner_profile'
        )
        or (
          trg.tgrelid = 'public.learner_profile'::regclass
          and trg.tgname = 'trg_learner_profile_exactly_one_account'
        )
      )
      and trg.tgconstraint <> 0
      and trg.tgdeferrable
      and trg.tginitdeferred
      and not trg.tgisinternal
  ) <> 2 then
    raise exception 'learner_identity_auth_deferred_invariant_trigger_mismatch';
  end if;
end
$$;

alter function public.enforce_account_exactly_one_learner_profile()
  security definer;
alter function public.enforce_account_exactly_one_learner_profile()
  set search_path = '';

revoke all on function public.enforce_account_exactly_one_learner_profile()
  from public, anon, authenticated, service_role;

do $$
begin
  if exists (
    select 1 from pg_roles where rolname = 'supabase_auth_admin'
  ) then
    execute $revoke$
      revoke all on function
        public.enforce_account_exactly_one_learner_profile()
      from supabase_auth_admin
    $revoke$;
  end if;
end
$$;

do $$
declare
  v_function_oid oid := to_regprocedure(
    'public.enforce_account_exactly_one_learner_profile()'
  );
  v_function_owner name;
begin
  select pg_get_userbyid(procedure.proowner)
  into v_function_owner
  from pg_proc as procedure
  where procedure.oid = v_function_oid
    and procedure.prosecdef
    and procedure.proconfig @> array['search_path=""'];

  if v_function_owner is null
    or not has_table_privilege(v_function_owner, 'public.account', 'SELECT')
    or not has_table_privilege(
      v_function_owner, 'public.learner_profile', 'SELECT'
    )
    or exists (
      select 1
      from pg_class as relation
      where relation.oid in (
        'public.account'::regclass,
        'public.learner_profile'::regclass
      )
        and (
          relation.relowner <> (
            select procedure.proowner
            from pg_proc as procedure
            where procedure.oid = v_function_oid
          )
          or relation.relforcerowsecurity
        )
    )
  then
    raise exception 'learner_identity_auth_deferred_invariant_owner_boundary';
  end if;

  if exists (
    select 1
    from pg_proc as procedure
    cross join lateral aclexplode(
      coalesce(
        procedure.proacl,
        acldefault('f', procedure.proowner)
      )
    ) as acl_entry
    where procedure.oid = v_function_oid
      and acl_entry.grantee = 0
      and acl_entry.privilege_type = 'EXECUTE'
  )
    or has_function_privilege(
      'anon',
      'public.enforce_account_exactly_one_learner_profile()',
      'EXECUTE'
    )
    or has_function_privilege(
      'authenticated',
      'public.enforce_account_exactly_one_learner_profile()',
      'EXECUTE'
    )
    or has_function_privilege(
      'service_role',
      'public.enforce_account_exactly_one_learner_profile()',
      'EXECUTE'
    )
    or exists (
      select 1
      from pg_roles
      where rolname = 'supabase_auth_admin'
        and has_function_privilege(
          'supabase_auth_admin',
          'public.enforce_account_exactly_one_learner_profile()',
          'EXECUTE'
        )
    )
  then
    raise exception 'learner_identity_auth_deferred_invariant_acl_open';
  end if;
end
$$;

notify pgrst, 'reload schema';

commit;
