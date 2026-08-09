-- Forward fix for GoTrue's two-phase Admin user creation.
--
-- GoTrue first inserts auth.users with provider metadata, then writes the
-- caller-supplied app_metadata in the same database transaction.  The normal
-- Account bootstrap remains INSERT-only; this second, narrow trigger observes
-- only the provisional metadata transition.  It can downgrade an Account only
-- when a live child-activation invitation and pristine bootstrap rows prove
-- that both Auth and Account were created in the current transaction.

begin;

do $$
begin
  if to_regclass('auth.users') is null
    or to_regclass('public.account') is null
    or to_regclass('public.account_login_alias') is null
    or to_regclass('public.account_security') is null
    or to_regclass('public.account_preference') is null
    or to_regclass('public.learner_profile') is null
    or to_regclass('public.learner_claim_invitation') is null
    or to_regprocedure('public.handle_auth_user_account()') is null
    or to_regprocedure(
      'public.enforce_account_exactly_one_learner_profile()'
    ) is null
  then
    raise exception 'learner_identity_provisional_auth_sync_preflight_missing';
  end if;

  if (
    select count(*)
    from pg_trigger as trigger
    where trigger.tgrelid = 'auth.users'::regclass
      and trigger.tgname = 'trg_auth_user_create_account'
      and trigger.tgfoid = to_regprocedure('public.handle_auth_user_account()')
      and not trigger.tgisinternal
  ) <> 1
    or not exists (
      select 1
      from pg_proc as procedure
      where procedure.oid = to_regprocedure(
        'public.enforce_account_exactly_one_learner_profile()'
      )
        and procedure.prosecdef
        and procedure.proconfig @> array['search_path=""']
    )
    or (
      select count(*)
      from pg_trigger as trigger
      where trigger.tgfoid = to_regprocedure(
        'public.enforce_account_exactly_one_learner_profile()'
      )
        and trigger.tgrelid in (
          'public.account'::regclass,
          'public.learner_profile'::regclass
        )
        and trigger.tgconstraint <> 0
        and trigger.tgdeferrable
        and trigger.tginitdeferred
        and not trigger.tgisinternal
    ) <> 2
    or to_regprocedure(
      'public.sync_provisional_account_from_auth_metadata()'
    ) is not null
    or exists (
      select 1
      from pg_trigger as trigger
      where trigger.tgrelid = 'auth.users'::regclass
        and trigger.tgname = 'trg_auth_user_sync_provisional_account'
        and not trigger.tgisinternal
    )
  then
    raise exception 'learner_identity_provisional_auth_sync_preflight_shape';
  end if;
end
$$;

create function public.sync_provisional_account_from_auth_metadata()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_raw_invitation_id text :=
    new.raw_app_meta_data ->> 'activation_invitation_id';
  v_invitation_id uuid;
  v_auth_xmin xid;
  v_updated_count integer;
begin
  if (new.raw_app_meta_data ->> 'identity_status')
      is distinct from 'provisional'
    or coalesce(lower(new.email), '')
      !~ '^[0-9a-f]{64}@learners[.]shidao[.]internal$'
    or coalesce(v_raw_invitation_id, '')
      !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  then
    return new;
  end if;

  v_invitation_id := v_raw_invitation_id::uuid;

  if not exists (
    select 1
    from public.learner_claim_invitation as invitation
    join public.learner_profile as source
      on source.id = invitation.source_learner_profile_id
    where invitation.id = v_invitation_id
      and invitation.kind = 'child_activation'
      and invitation.status in ('pending', 'bound')
      and invitation.expires_at > clock_timestamp()
      and source.account_id is null
  ) then
    return new;
  end if;

  select auth_user.xmin into v_auth_xmin
  from auth.users as auth_user
  where auth_user.id = new.id;

  update public.account as account
  set status = 'provisional'
  where account.auth_user_id = new.id
    and account.status = 'active'
    -- GoTrue's two writes share one transaction ID.  Once Auth creation
    -- commits, the Auth row receives a new xmin on every later UPDATE while
    -- Account.xmin retains its creation transaction.
    and account.xmin = v_auth_xmin
    and account.created_at = account.updated_at
    and (
      select count(*)
      from public.learner_profile as profile
      where profile.account_id = account.id
    ) = 1
    and not exists (
      select 1
      from public.account_login_alias as alias
      where alias.account_id = account.id
    )
    and exists (
      select 1
      from public.account_security as security
      where security.account_id = account.id
        and security.pin_hash is null
        and security.pin_failed_attempts = 0
        and security.pin_locked_until is null
        and security.pin_created_at is null
        and security.pin_updated_at is null
        and security.last_pin_login_at is null
        and security.sessions_invalid_before is null
        and security.created_at = security.updated_at
    )
    and exists (
      select 1
      from public.account_preference as preference
      where preference.account_id = account.id
        and preference.last_selected_school_id is null
        and preference.theme is null
        and preference.settings = '{}'::jsonb
        and preference.created_at = preference.updated_at
    );

  get diagnostics v_updated_count = row_count;

  if v_updated_count = 0
    and exists (
      select 1
      from public.account as account
      where account.auth_user_id = new.id
        and account.status = 'active'
        and account.xmin = v_auth_xmin
    )
  then
    -- A trusted marker in the creation transaction must either consume the
    -- pristine bootstrap or abort the Auth create.  Silently accepting a
    -- partially initialized active Account would strand the activation flow.
    raise exception 'learner_identity_provisional_auth_sync_pristine_mismatch'
      using errcode = '55000';
  end if;

  return new;
end
$$;

revoke all on function public.sync_provisional_account_from_auth_metadata()
  from public, anon, authenticated, service_role;

do $$
begin
  if exists (
    select 1 from pg_roles where rolname = 'supabase_auth_admin'
  ) then
    execute $revoke$
      revoke all on function
        public.sync_provisional_account_from_auth_metadata()
      from supabase_auth_admin
    $revoke$;
  end if;
end
$$;

create trigger trg_auth_user_sync_provisional_account
  after update of raw_app_meta_data on auth.users
  for each row
  when (
    (old.raw_app_meta_data ->> 'identity_status') is distinct from
      (new.raw_app_meta_data ->> 'identity_status')
    or (old.raw_app_meta_data ->> 'activation_invitation_id') is distinct from
      (new.raw_app_meta_data ->> 'activation_invitation_id')
  )
  execute function public.sync_provisional_account_from_auth_metadata();

-- A pre-existing trusted mismatch is repairable only when it has the exact
-- creation-transaction and pristine-bootstrap shape enforced by the trigger.
-- Anything else needs explicit reconciliation instead of an unsafe backfill.
do $$
begin
  if exists (
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
      and not (
        account.xmin = auth_user.xmin
        and account.created_at = account.updated_at
        and (
          select count(*)
          from public.learner_profile as profile
          where profile.account_id = account.id
        ) = 1
        and not exists (
          select 1 from public.account_login_alias as alias
          where alias.account_id = account.id
        )
        and exists (
          select 1 from public.account_security as security
          where security.account_id = account.id
            and security.pin_hash is null
            and security.pin_failed_attempts = 0
            and security.pin_locked_until is null
            and security.pin_created_at is null
            and security.pin_updated_at is null
            and security.last_pin_login_at is null
            and security.sessions_invalid_before is null
            and security.created_at = security.updated_at
        )
        and exists (
          select 1 from public.account_preference as preference
          where preference.account_id = account.id
            and preference.last_selected_school_id is null
            and preference.theme is null
            and preference.settings = '{}'::jsonb
            and preference.created_at = preference.updated_at
        )
      )
  ) then
    raise exception 'learner_identity_provisional_auth_sync_unsafe_backfill';
  end if;
end
$$;

update public.account as account
set status = 'provisional'
from auth.users as auth_user
where account.auth_user_id = auth_user.id
  and account.status = 'active'
  and account.xmin = auth_user.xmin
  and account.created_at = account.updated_at
  and auth_user.raw_app_meta_data ->> 'identity_status' = 'provisional'
  and coalesce(lower(auth_user.email), '')
    ~ '^[0-9a-f]{64}@learners[.]shidao[.]internal$'
  and (
    select count(*)
    from public.learner_profile as profile
    where profile.account_id = account.id
  ) = 1
  and not exists (
    select 1 from public.account_login_alias as alias
    where alias.account_id = account.id
  )
  and exists (
    select 1
    from public.account_security as security
    where security.account_id = account.id
      and security.pin_hash is null
      and security.pin_failed_attempts = 0
      and security.pin_locked_until is null
      and security.pin_created_at is null
      and security.pin_updated_at is null
      and security.last_pin_login_at is null
      and security.sessions_invalid_before is null
      and security.created_at = security.updated_at
  )
  and exists (
    select 1
    from public.account_preference as preference
    where preference.account_id = account.id
      and preference.last_selected_school_id is null
      and preference.theme is null
      and preference.settings = '{}'::jsonb
      and preference.created_at = preference.updated_at
  )
  and exists (
    select 1
    from public.learner_claim_invitation as invitation
    join public.learner_profile as source
      on source.id = invitation.source_learner_profile_id
    where invitation.id::text =
      auth_user.raw_app_meta_data ->> 'activation_invitation_id'
      and invitation.kind = 'child_activation'
      and invitation.status in ('pending', 'bound')
      and invitation.expires_at > clock_timestamp()
      and source.account_id is null
  );

do $$
declare
  v_function_oid oid := to_regprocedure(
    'public.sync_provisional_account_from_auth_metadata()'
  );
begin
  if v_function_oid is null
    or not exists (
      select 1
      from pg_proc as procedure
      join pg_roles as owner on owner.oid = procedure.proowner
      where procedure.oid = v_function_oid
        and procedure.prosecdef
        and procedure.proconfig @> array['search_path=""']
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
    )
    or not exists (
      select 1
      from pg_trigger as trigger
      where trigger.tgrelid = 'auth.users'::regclass
        and trigger.tgname = 'trg_auth_user_sync_provisional_account'
        and trigger.tgfoid = v_function_oid
        and not trigger.tgisinternal
        and trigger.tgenabled = 'O'
        -- ROW + UPDATE, with no BEFORE/INSERT/DELETE/TRUNCATE/INSTEAD bits.
        and trigger.tgtype = 17
        and trigger.tgattr::text = (
          select attribute.attnum::text
          from pg_attribute as attribute
          where attribute.attrelid = 'auth.users'::regclass
            and attribute.attname = 'raw_app_meta_data'
            and not attribute.attisdropped
        )
        and trigger.tgqual is not null
    )
  then
    raise exception 'learner_identity_provisional_auth_sync_postflight_shape';
  end if;

  if exists (
    select 1
    from pg_proc as procedure
    cross join lateral aclexplode(
      coalesce(procedure.proacl, acldefault('f', procedure.proowner))
    ) as acl_entry
    where procedure.oid = v_function_oid
      and acl_entry.grantee = 0
      and acl_entry.privilege_type = 'EXECUTE'
  )
    or exists (
      select 1
      from unnest(
        array['anon', 'authenticated', 'service_role'] || case
          when exists (
            select 1 from pg_roles where rolname = 'supabase_auth_admin'
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
  then
    raise exception 'learner_identity_provisional_auth_sync_acl_open';
  end if;

  if exists (
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
  ) then
    raise exception 'learner_identity_provisional_auth_sync_backfill_incomplete';
  end if;
end
$$;

notify pgrst, 'reload schema';

commit;
