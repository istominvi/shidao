begin;

do $preflight$
declare
  v_existing_avatar_columns integer;
begin
  if to_regclass('public.account') is null
    or to_regclass('public.course') is null
    or to_regclass('public.lesson') is null
    or to_regclass('public.lesson_component') is null
    or to_regclass('storage.buckets') is null
    or to_regclass('storage.objects') is null
    or to_regprocedure('public.current_account_auth_context()') is null
    or to_regprocedure('public.current_account_id()') is null
    or not exists (
      select 1
      from pg_trigger as trigger
      where trigger.tgrelid = 'public.account'::regclass
        and trigger.tgname = 'trg_account_updated_at'
        and not trigger.tgisinternal
        and trigger.tgenabled = 'O'
    )
  then
    raise exception 'shidao_schema_sanity_check_failed'
      using errcode = 'P0001';
  end if;

  select count(*)
  into v_existing_avatar_columns
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'account'
    and column_name in (
      'avatar_kind',
      'avatar_preset_key',
      'avatar_storage_path',
      'avatar_revision',
      'avatar_updated_at'
    );

  if v_existing_avatar_columns <> 0
    or to_regprocedure(
      'public.set_current_account_avatar(uuid,text,text,text,integer)'
    ) is not null
    or exists (
      select 1
      from storage.buckets as bucket
      where bucket.id = 'profile-avatars'
         or bucket.name = 'profile-avatars'
    )
    or exists (
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
  then
    raise exception 'account_profile_avatar_objects_already_exist'
      using errcode = '42P07';
  end if;

  if not has_table_privilege(
      'supabase_admin',
      'storage.objects',
      'SELECT'
    )
    or not has_table_privilege(
      'supabase_admin',
      'storage.buckets',
      'INSERT'
    )
    or not exists (
      select 1
      from pg_roles as role
      where role.rolname = 'supabase_admin'
        and role.rolbypassrls
    )
  then
    raise exception 'account_profile_avatar_storage_contract_missing'
      using errcode = '42501';
  end if;
end
$preflight$;

alter table public.account
  add column avatar_kind text,
  add column avatar_preset_key text,
  add column avatar_storage_path text,
  add column avatar_revision integer,
  add column avatar_updated_at timestamptz;

-- Existing Accounts receive a deterministic preset without changing their
-- canonical profile updated_at timestamp. This preserves the pristine
-- provisional-account marker used by the Auth bootstrap hardening.
alter table public.account disable trigger trg_account_updated_at;

update public.account as account
set avatar_kind = 'preset',
    avatar_preset_key = 'sd-avatar-v1-' || lpad(
      (
        (
          get_byte(decode(md5(account.id::text), 'hex'), 0)::integer % 20
        ) + 1
      )::text,
      2,
      '0'
    ),
    avatar_storage_path = null,
    avatar_revision = 1,
    avatar_updated_at = account.updated_at;

-- The Account/Profile invariant is enforced by an initially-deferred
-- constraint trigger. Flush its pending events before the next ALTER TABLE;
-- PostgreSQL otherwise refuses to alter Account while those events exist.
set constraints trg_account_exactly_one_learner_profile immediate;

alter table public.account enable trigger trg_account_updated_at;

alter table public.account
  alter column avatar_kind set default 'preset',
  alter column avatar_kind set not null,
  alter column avatar_preset_key set default 'sd-avatar-v1-01',
  alter column avatar_revision set default 1,
  alter column avatar_revision set not null,
  alter column avatar_updated_at set default now(),
  alter column avatar_updated_at set not null,
  add constraint account_avatar_kind_check check (
    avatar_kind in ('preset', 'custom')
  ),
  add constraint account_avatar_preset_key_check check (
    avatar_preset_key is null
    or avatar_preset_key in (
      'sd-avatar-v1-01',
      'sd-avatar-v1-02',
      'sd-avatar-v1-03',
      'sd-avatar-v1-04',
      'sd-avatar-v1-05',
      'sd-avatar-v1-06',
      'sd-avatar-v1-07',
      'sd-avatar-v1-08',
      'sd-avatar-v1-09',
      'sd-avatar-v1-10',
      'sd-avatar-v1-11',
      'sd-avatar-v1-12',
      'sd-avatar-v1-13',
      'sd-avatar-v1-14',
      'sd-avatar-v1-15',
      'sd-avatar-v1-16',
      'sd-avatar-v1-17',
      'sd-avatar-v1-18',
      'sd-avatar-v1-19',
      'sd-avatar-v1-20'
    )
  ),
  add constraint account_avatar_storage_path_check check (
    avatar_storage_path is null
    or avatar_storage_path ~ (
      '^' || id::text ||
      '/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.webp$'
    )
  ),
  add constraint account_avatar_revision_check check (
    avatar_revision >= 1
  ),
  add constraint account_avatar_selection_check check (
    (
      avatar_kind = 'preset'
      and avatar_preset_key is not null
      and avatar_storage_path is null
    )
    or (
      avatar_kind = 'custom'
      and avatar_preset_key is null
      and avatar_storage_path is not null
    )
  );

comment on column public.account.avatar_kind is
  'Required Account avatar source: preset or private custom image.';
comment on column public.account.avatar_preset_key is
  'Allowlisted ShiDao preset key when avatar_kind is preset.';
comment on column public.account.avatar_storage_path is
  'Account-scoped private profile-avatars object path when avatar_kind is custom.';
comment on column public.account.avatar_revision is
  'Monotonic optimistic-concurrency revision for avatar updates.';
comment on column public.account.avatar_updated_at is
  'Timestamp of the latest committed avatar selection.';

-- Account remains directly read-only for authenticated users. Avatar writes
-- are supported only through the narrow revision-aware RPC below.
revoke update (
  avatar_kind,
  avatar_preset_key,
  avatar_storage_path,
  avatar_revision,
  avatar_updated_at
) on table public.account from public, anon, authenticated;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'profile-avatars',
  'profile-avatars',
  false,
  1048576,
  array['image/webp']::text[]
);

-- No storage.objects policy is created for profile-avatars. Upload, read and
-- cleanup are server-only operations performed by the same-origin route with
-- the service role. Browser JWTs cannot address this bucket directly.

-- PostgreSQL cannot replace a RETURNS TABLE signature in place. Appending the
-- avatar fields keeps the existing field names/order intact for a DB-first
-- rollout while exposing the new canonical Account state to the new server.
drop function public.current_account_auth_context();

create function public.current_account_auth_context()
returns table (
  account_id uuid,
  auth_user_id uuid,
  display_name text,
  locale text,
  timezone text,
  has_pin boolean,
  sessions_invalid_before timestamptz,
  verified_email text,
  can_author_educator_courses boolean,
  avatar_kind text,
  avatar_preset_key text,
  avatar_storage_path text,
  avatar_revision integer,
  avatar_updated_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $function$
  select
    account.id,
    account.auth_user_id,
    account.display_name,
    account.locale,
    account.timezone,
    security.pin_hash is not null,
    security.sessions_invalid_before,
    case
      when auth_user.email_confirmed_at is not null
        and lower(coalesce(auth_user.email, ''))
          not like '%@learners.shidao.internal'
        and lower(coalesce(auth_user.email, ''))
          not like '%.shidao.internal'
        then auth_user.email::text
      else null
    end,
    account.can_author_educator_courses,
    account.avatar_kind,
    account.avatar_preset_key,
    account.avatar_storage_path,
    account.avatar_revision,
    account.avatar_updated_at
  from public.account as account
  left join public.account_security as security
    on security.account_id = account.id
  join auth.users as auth_user
    on auth_user.id = account.auth_user_id
  where account.auth_user_id = (select auth.uid())
    and account.status in ('active', 'provisional')
  limit 1;
$function$;

alter function public.current_account_auth_context()
  owner to supabase_admin;
revoke all on function public.current_account_auth_context()
  from public, anon, authenticated, service_role;
grant execute on function public.current_account_auth_context()
  to postgres, authenticated, service_role;

create function public.set_current_account_avatar(
  p_actor_auth_user_id uuid,
  p_avatar_kind text,
  p_avatar_preset_key text,
  p_avatar_storage_path text,
  p_expected_revision integer
)
returns table (
  avatar_kind text,
  avatar_preset_key text,
  avatar_revision integer,
  avatar_updated_at timestamptz,
  previous_storage_path text
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_account public.account%rowtype;
  v_previous_storage_path text;
begin
  if p_actor_auth_user_id is null then
    raise exception 'account_avatar_not_found' using errcode = 'P0002';
  end if;

  if p_expected_revision is null or p_expected_revision < 1 then
    raise exception 'account_avatar_invalid' using errcode = '22023';
  end if;

  select account.*
  into v_account
  from public.account as account
  where account.auth_user_id = p_actor_auth_user_id
    and account.status in ('active', 'provisional')
  for update of account;

  if not found then
    raise exception 'account_avatar_not_found' using errcode = 'P0002';
  end if;

  if v_account.avatar_revision <> p_expected_revision then
    raise exception 'account_avatar_stale' using errcode = '40001';
  end if;

  if p_avatar_kind = 'preset' then
    if p_avatar_preset_key is null
      or p_avatar_preset_key <> all(array[
        'sd-avatar-v1-01',
        'sd-avatar-v1-02',
        'sd-avatar-v1-03',
        'sd-avatar-v1-04',
        'sd-avatar-v1-05',
        'sd-avatar-v1-06',
        'sd-avatar-v1-07',
        'sd-avatar-v1-08',
        'sd-avatar-v1-09',
        'sd-avatar-v1-10',
        'sd-avatar-v1-11',
        'sd-avatar-v1-12',
        'sd-avatar-v1-13',
        'sd-avatar-v1-14',
        'sd-avatar-v1-15',
        'sd-avatar-v1-16',
        'sd-avatar-v1-17',
        'sd-avatar-v1-18',
        'sd-avatar-v1-19',
        'sd-avatar-v1-20'
      ]::text[])
      or p_avatar_storage_path is not null
    then
      raise exception 'account_avatar_invalid' using errcode = '22023';
    end if;
  elsif p_avatar_kind = 'custom' then
    if p_avatar_preset_key is not null
      or p_avatar_storage_path is null
      or p_avatar_storage_path !~ (
        '^' || v_account.id::text ||
        '/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.webp$'
      )
    then
      raise exception 'account_avatar_invalid' using errcode = '22023';
    end if;

    if not exists (
      select 1
      from storage.objects as object
      where object.bucket_id = 'profile-avatars'
        and object.name = p_avatar_storage_path
    ) then
      raise exception 'account_avatar_object_not_found'
        using errcode = 'P0002';
    end if;
  else
    raise exception 'account_avatar_invalid' using errcode = '22023';
  end if;

  v_previous_storage_path := v_account.avatar_storage_path;

  update public.account as account
  set avatar_kind = p_avatar_kind,
      avatar_preset_key = case
        when p_avatar_kind = 'preset' then p_avatar_preset_key
        else null
      end,
      avatar_storage_path = case
        when p_avatar_kind = 'custom' then p_avatar_storage_path
        else null
      end,
      avatar_revision = account.avatar_revision + 1,
      avatar_updated_at = clock_timestamp()
  where account.id = v_account.id
  returning account.* into v_account;

  return query
  select
    v_account.avatar_kind,
    v_account.avatar_preset_key,
    v_account.avatar_revision,
    v_account.avatar_updated_at,
    case
      when v_previous_storage_path is distinct from
        v_account.avatar_storage_path
        then v_previous_storage_path
      else null
    end;
end
$function$;

comment on function public.set_current_account_avatar(
  uuid,
  text,
  text,
  text,
  integer
) is
  'Revision-aware server-only Account avatar switch; validates actor, path and private object existence.';

alter function public.set_current_account_avatar(uuid, text, text, text, integer)
  owner to supabase_admin;
revoke all on function public.set_current_account_avatar(
  uuid,
  text,
  text,
  text,
  integer
) from public, anon, authenticated, service_role;
grant execute on function public.set_current_account_avatar(
  uuid,
  text,
  text,
  text,
  integer
) to postgres, service_role;

do $postflight$
declare
  v_setter_oid oid := to_regprocedure(
    'public.set_current_account_avatar(uuid,text,text,text,integer)'
  );
  v_context_oid oid := to_regprocedure(
    'public.current_account_auth_context()'
  );
begin
  if (
    select count(*)
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'account'
      and column_name in (
        'avatar_kind',
        'avatar_preset_key',
        'avatar_storage_path',
        'avatar_revision',
        'avatar_updated_at'
      )
  ) <> 5
    or exists (
      select 1
      from public.account as account
      where account.avatar_revision < 1
        or account.avatar_kind not in ('preset', 'custom')
        or not (
          (
            account.avatar_kind = 'preset'
            and account.avatar_preset_key is not null
            and account.avatar_storage_path is null
          )
          or (
            account.avatar_kind = 'custom'
            and account.avatar_preset_key is null
            and account.avatar_storage_path is not null
          )
        )
    )
    or (
      select count(*)
      from pg_constraint as constraint_row
      where constraint_row.conrelid = 'public.account'::regclass
        and constraint_row.conname in (
          'account_avatar_kind_check',
          'account_avatar_preset_key_check',
          'account_avatar_storage_path_check',
          'account_avatar_revision_check',
          'account_avatar_selection_check'
        )
        and constraint_row.convalidated
    ) <> 5
  then
    raise exception 'account_profile_avatar_account_postflight_failed'
      using errcode = 'P0001';
  end if;

  if not exists (
    select 1
    from pg_trigger as trigger
    where trigger.tgrelid = 'public.account'::regclass
      and trigger.tgname = 'trg_account_updated_at'
      and not trigger.tgisinternal
      and trigger.tgenabled = 'O'
  )
    or has_column_privilege(
      'authenticated',
      'public.account',
      'avatar_kind',
      'UPDATE'
    )
    or has_column_privilege(
      'authenticated',
      'public.account',
      'avatar_storage_path',
      'UPDATE'
    )
  then
    raise exception 'account_profile_avatar_account_acl_postflight_failed'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from storage.buckets as bucket
    where bucket.id = 'profile-avatars'
      and bucket.name = 'profile-avatars'
      and not bucket.public
      and bucket.file_size_limit = 1048576
      and bucket.allowed_mime_types = array['image/webp']::text[]
  )
    or exists (
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
  then
    raise exception 'account_profile_avatar_storage_postflight_failed'
      using errcode = 'P0001';
  end if;

  if v_setter_oid is null
    or not exists (
      select 1
      from pg_proc as procedure
      where procedure.oid = v_setter_oid
        and procedure.prosecdef
        and procedure.proconfig @> array['search_path=""']
        and pg_get_userbyid(procedure.proowner) = 'supabase_admin'
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
    or not has_function_privilege(
      'postgres',
      v_setter_oid,
      'EXECUTE'
    )
    or not has_function_privilege(
      'service_role',
      v_setter_oid,
      'EXECUTE'
    )
    or has_function_privilege('anon', v_setter_oid, 'EXECUTE')
    or has_function_privilege('authenticated', v_setter_oid, 'EXECUTE')
  then
    raise exception 'account_profile_avatar_rpc_acl_postflight_failed'
      using errcode = '42501';
  end if;

  if v_context_oid is null
    or not exists (
      select 1
      from pg_proc as procedure
      where procedure.oid = v_context_oid
        and procedure.prosecdef
        and procedure.proconfig @> array['search_path=""']
        and pg_get_userbyid(procedure.proowner) = 'supabase_admin'
        and position(
          'avatar_storage_path text'
          in pg_get_function_result(procedure.oid)
        ) > 0
    )
    or not has_function_privilege(
      'authenticated',
      v_context_oid,
      'EXECUTE'
    )
    or not has_function_privilege(
      'service_role',
      v_context_oid,
      'EXECUTE'
    )
    or has_function_privilege('anon', v_context_oid, 'EXECUTE')
  then
    raise exception 'account_profile_avatar_context_postflight_failed'
      using errcode = '42501';
  end if;
end
$postflight$;

notify pgrst, 'reload schema';

commit;
