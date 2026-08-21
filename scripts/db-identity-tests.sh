#!/usr/bin/env bash
set -euo pipefail

# Executable learner-identity DB acceptance harness.
#
# The main matrix is destructive only inside a transaction which is rolled
# back. A small xmin matrix crosses commits, uses fixed fixture UUIDs, and has
# an EXIT cleanup trap. Point this only at an isolated upgraded clone, never
# production. The explicit name guard makes an accidental invocation fail
# closed.

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is required (isolated upgraded test database)." >&2
  exit 2
fi

db_name="$(psql "$DATABASE_URL" -Atqc 'select current_database()')"
if [[ ! "$db_name" =~ (test|tmp|ci|clone) ]] && [[ "${ALLOW_IDENTITY_DB_TESTS:-}" != "yes" ]]; then
  echo "Refusing mutation harness for database '$db_name'. Use a test/clone DB." >&2
  exit 2
fi

psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 <<'SQL'
begin;

create function pg_temp.assert_true(p_value boolean, p_message text)
returns void language plpgsql as $$
begin
  if not coalesce(p_value, false) then
    raise exception 'identity_acceptance_failed: %', p_message;
  end if;
end
$$;

-- Production auth.users intentionally has RLS with no policies.  GoTrue's
-- trusted Auth writer reaches it as the table owner/BYPASSRLS; model that
-- boundary with an isolated NOLOGIN role instead of changing auth.users RLS.
-- Role attributes and grants are transactional and roll back with this matrix.
do $$
declare
  v_role oid;
begin
  select role.oid
  into v_role
  from pg_roles as role
  where role.rolname = 'shidao_identity_auth_harness';

  if v_role is not null and (
    exists (
      select 1
      from pg_roles as role
      where role.oid = v_role
        and (
          role.rolcanlogin
          or role.rolsuper
          or role.rolcreatedb
          or role.rolcreaterole
          or role.rolreplication
        )
    )
    or exists (
      select 1
      from pg_auth_members as membership
      where membership.roleid = v_role
        or membership.member = v_role
    )
  ) then
    raise exception
      'identity_acceptance_failed: reserved Auth harness role is not isolated';
  end if;

  if v_role is null then
    execute 'create role shidao_identity_auth_harness nologin nosuperuser nocreatedb nocreaterole noinherit noreplication bypassrls';
  else
    execute 'alter role shidao_identity_auth_harness nologin nosuperuser nocreatedb nocreaterole noinherit noreplication bypassrls';
  end if;
end
$$;
grant usage on schema auth, public to shidao_identity_auth_harness;
grant select, insert, delete on auth.users to shidao_identity_auth_harness;
grant update (raw_app_meta_data, email) on auth.users
  to shidao_identity_auth_harness;

select pg_temp.assert_true(
  to_regprocedure('public.build_cross_provider_learner_context(uuid,uuid)') is not null,
  'workflow migration is not applied'
);
select pg_temp.assert_true(
  not has_function_privilege(
    'authenticated',
    'public.build_cross_provider_learner_context(uuid,uuid)',
    'EXECUTE'
  ),
  'cross-provider context is browser executable'
);
select pg_temp.assert_true(
  not has_function_privilege(
    'authenticated',
    'public.confirm_my_learning_data_erasure(uuid,uuid,text)',
    'EXECUTE'
  )
  and to_regprocedure(
    'public.confirm_my_learning_data_erasure(uuid,text)'
  ) is null,
  'erasure confirm is browser executable'
);
select pg_temp.assert_true(
  not has_function_privilege(
    'authenticated',
    'public.confirm_my_learner_profile_unlink(uuid,text)',
    'EXECUTE'
  ),
  'unlink confirm is browser executable'
);
select pg_temp.assert_true(
  not has_function_privilege(
    'authenticated',
    'public.activate_offline_learner_account(uuid,uuid,bytea,bytea,text,text,uuid,boolean,boolean)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'authenticated',
    'public.activate_verified_offline_learner_account(uuid,uuid,bytea,text,text,uuid,boolean,boolean)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'authenticated',
    'public.list_recoverable_learner_credentials(uuid)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'authenticated',
    'public.reset_recoverable_learner_credentials(uuid,uuid,text,text,timestamptz,uuid)',
    'EXECUTE'
  ),
  'child activation/recovery service boundary is browser executable'
);
select pg_temp.assert_true(
  has_function_privilege(
    'authenticated',
    'public.list_my_learner_credential_recovery_delegates()',
    'EXECUTE'
  )
  and has_function_privilege(
    'authenticated',
    'public.revoke_my_learner_credential_recovery_delegate(uuid)',
    'EXECUTE'
  ),
  'learner recovery self-service boundary is not executable'
);
select pg_temp.assert_true(
  has_function_privilege(
    'authenticated',
    'public.get_observed_learner_history(uuid,text,integer)',
    'EXECUTE'
  )
  and has_function_privilege(
    'authenticated',
    'public.get_observed_learner_progress(uuid)',
    'EXECUTE'
  ),
  'observer history/progress read boundary is not executable'
);
select pg_temp.assert_true(
  bool_and(relation.relrowsecurity),
  'identity primitive without RLS'
)
from pg_class as relation
join pg_namespace as namespace on namespace.oid = relation.relnamespace
where namespace.nspname = 'public'
  and relation.relname in (
    'account_login_alias', 'account_security', 'learner_profile_share_code',
    'learner_connection_request', 'learner_claim_invitation',
    'learner_profile_merge', 'learner_profile_alias',
    'learner_observer_invitation', 'learner_observer_grant',
    'learner_ai_consent', 'learner_identity_audit_event',
    'learner_credential_recovery_delegate', 'learner_erasure_request',
    'learner_identity_reconciliation', 'learner_identity_rate_limit'
  );

-- GoTrue executes deferred constraint triggers as supabase_auth_admin after
-- the SECURITY DEFINER bootstrap function has returned. Exercise that exact
-- commit boundary instead of only inserting auth.users as the database owner.
set local role shidao_identity_auth_harness;
insert into auth.users (
  id, email, email_confirmed_at, raw_user_meta_data, raw_app_meta_data
) values (
  'f1000000-0000-0000-0000-000000000099',
  'restricted-auth@test.invalid',
  now(),
  '{"full_name":"Restricted Auth Actor"}',
  '{"identity_status":"provisional"}'
);
set constraints all immediate;
reset role;
set constraints all deferred;

select pg_temp.assert_true(
  exists (
    select 1
    from public.account as account
    where account.auth_user_id = 'f1000000-0000-0000-0000-000000000099'
      and account.status = 'provisional'
      and (
        select count(*)
        from public.learner_profile as profile
        where profile.account_id = account.id
      ) = 1
  ),
  'restricted Auth bootstrap did not create exactly one canonical profile'
);

set local role shidao_identity_auth_harness;
delete from auth.users
where id = 'f1000000-0000-0000-0000-000000000099';
set constraints all immediate;
reset role;
set constraints all deferred;

select pg_temp.assert_true(
  not exists (
    select 1
    from public.account as account
    where account.auth_user_id = 'f1000000-0000-0000-0000-000000000099'
  )
  and not exists (
    select 1
    from public.learner_profile as profile
    where profile.display_name = 'Restricted Auth Actor'
  ),
  'restricted Auth cleanup left provisional Account/Profile data'
);

insert into auth.users (
  id, email, email_confirmed_at, raw_user_meta_data, raw_app_meta_data
) values
  ('f1000000-0000-0000-0000-000000000001', 'teacher@test.invalid', now(), '{"full_name":"Teacher A"}', '{}'),
  ('f1000000-0000-0000-0000-000000000002', 'subject@test.invalid', now(), '{"full_name":"Subject"}', '{}'),
  ('f1000000-0000-0000-0000-000000000003', 'observer@test.invalid', now(), '{"full_name":"Observer"}', '{}'),
  ('f1000000-0000-0000-0000-000000000004', 'outsider@test.invalid', now(), '{"full_name":"Outsider"}', '{}');

insert into auth.sessions (
  id, user_id, created_at, updated_at, not_after
) values (
  'f1100000-0000-4000-8000-000000000002',
  'f1000000-0000-0000-0000-000000000002',
  clock_timestamp(), clock_timestamp(), null
);

select pg_temp.assert_true(
  not exists (
    select 1
    from public.account as account
    where account.auth_user_id in (
      'f1000000-0000-0000-0000-000000000001',
      'f1000000-0000-0000-0000-000000000002',
      'f1000000-0000-0000-0000-000000000003',
      'f1000000-0000-0000-0000-000000000004'
    ) and (
      select count(*) from public.learner_profile as profile
      where profile.account_id = account.id
    ) <> 1
  ),
  'Auth bootstrap did not create exactly one canonical profile'
);

-- Session revocation must remain rollback-safe even for an Account that had
-- no legacy user_security row before the expand release.
select public.revoke_user_sessions(
  'f1000000-0000-0000-0000-000000000004',
  '2032-01-01T00:00:00Z'::timestamptz
);
select pg_temp.assert_true(
  exists (
    select 1
    from public.account_security as security
    join public.account as account on account.id = security.account_id
    where account.auth_user_id = 'f1000000-0000-0000-0000-000000000004'
      and security.sessions_invalid_before = '2032-01-01T00:00:00Z'
  )
  and case
    when to_regprocedure('public.verify_user_pin(uuid,text)') is not null then
      exists (
        select 1 from public.user_security as security
        where security.user_id = 'f1000000-0000-0000-0000-000000000004'
          and security.sessions_invalid_before = '2032-01-01T00:00:00Z'
      )
    else
      not exists (
        select 1 from public.user_security as security
        where security.user_id = 'f1000000-0000-0000-0000-000000000004'
      )
      and not exists (
        select 1
        from pg_proc as procedure
        join pg_namespace as namespace
          on namespace.oid = procedure.pronamespace
        where namespace.nspname = 'public'
          and lower(procedure.prosrc) like '%user_security%'
      )
  end,
  'session revocation violated the current expand/contract boundary'
);

-- Auth trigger intentionally uses a transaction-local trusted mutation flag;
-- clear it in this long, synthetic test transaction before adversarial checks.
select set_config('app.learner_profile_link_mutation', 'off', true);

do $$
declare v_profile_id uuid;
begin
  select profile.id into v_profile_id
  from public.learner_profile as profile
  join public.account as account on account.id = profile.account_id
  where account.auth_user_id = 'f1000000-0000-0000-0000-000000000002';
  begin
    update public.learner_profile set account_id = null where id = v_profile_id;
    raise exception 'direct unlink unexpectedly succeeded';
  exception when insufficient_privilege then null;
  end;
end
$$;

-- Recipient-bound child activation: adult is never the learner target, the
-- provisional Account gets the offline history, and retry is idempotent.
insert into public.learner_profile (id, display_name)
values ('f2000000-0000-0000-0000-000000000001', 'Offline Child');
insert into public.teacher_learner (
  teacher_account_id, learner_profile_id, display_name
)
select account.id, 'f2000000-0000-0000-0000-000000000001', 'Offline Child'
from public.account as account
where account.auth_user_id = 'f1000000-0000-0000-0000-000000000001';

select public.create_learner_profile_invitation(
  'f1000000-0000-0000-0000-000000000001',
  'f2000000-0000-0000-0000-000000000001',
  'child_activation', decode(repeat('11', 32), 'hex'),
  decode(repeat('12', 32), 'hex'), now() + interval '1 day'
) as child_invitation \gset child_

-- Wrong-kind and expired invitations remain negative Auth-sync evidence.
insert into public.learner_profile (id, display_name)
values
  ('f2000000-0000-0000-0000-000000000020', 'Claim-only Source'),
  ('f2000000-0000-0000-0000-000000000021', 'Expired Child Source');
insert into public.teacher_learner (
  teacher_account_id, learner_profile_id, display_name
)
select
  account.id,
  fixture.learner_profile_id,
  fixture.display_name
from public.account as account
cross join (
  values
    ('f2000000-0000-0000-0000-000000000020'::uuid, 'Claim-only Source'),
    ('f2000000-0000-0000-0000-000000000021'::uuid, 'Expired Child Source')
) as fixture(learner_profile_id, display_name)
where account.auth_user_id = 'f1000000-0000-0000-0000-000000000001';

select public.create_learner_profile_invitation(
  'f1000000-0000-0000-0000-000000000001',
  'f2000000-0000-0000-0000-000000000020',
  'claim', decode(repeat('13', 32), 'hex'),
  decode(repeat('14', 32), 'hex'), now() + interval '1 day'
) as claim_only_invitation \gset claim_only_
select public.create_learner_profile_invitation(
  'f1000000-0000-0000-0000-000000000001',
  'f2000000-0000-0000-0000-000000000021',
  'child_activation', decode(repeat('15', 32), 'hex'),
  decode(repeat('16', 32), 'hex'), now() + interval '1 day'
) as expired_child_invitation \gset expired_child_
update public.learner_claim_invitation
set created_at = clock_timestamp() - interval '2 days',
    expires_at = clock_timestamp() - interval '1 day'
where id = (:'expired_child_expired_child_invitation'::jsonb ->> 'id')::uuid;

-- Reproduce GoTrue Admin create exactly: INSERT first carries only provider
-- metadata, then the custom app_metadata arrives in an UPDATE in the same
-- transaction.  Only a strict internal address plus this live child-activation
-- invitation may turn the pristine bootstrap Account provisional.
set local role shidao_identity_auth_harness;

-- A normal external Account cannot borrow a valid invitation marker.
update auth.users
set raw_app_meta_data = raw_app_meta_data || jsonb_build_object(
  'identity_status', 'provisional',
  'activation_invitation_id',
  :'child_child_invitation'::jsonb ->> 'id'
)
where id = 'f1000000-0000-0000-0000-000000000004';

-- Malformed invitation metadata must fail closed without breaking signup.
insert into auth.users (
  id, email, email_confirmed_at, raw_user_meta_data, raw_app_meta_data
) values (
  'f1000000-0000-0000-0000-000000000007',
  repeat('c', 64) || '@learners.shidao.internal', now(),
  '{"full_name":"Malformed provisional marker"}',
  '{"provider":"email","providers":["email"]}'
);
update auth.users
set raw_app_meta_data = raw_app_meta_data || jsonb_build_object(
  'identity_status', 'provisional',
  'activation_invitation_id', 'not-a-uuid'
)
where id = 'f1000000-0000-0000-0000-000000000007';

-- A valid live invitation without the explicit provisional marker must stay
-- active; SQL NULL from a missing JSON key is never treated as authorization.
insert into auth.users (
  id, email, email_confirmed_at, raw_user_meta_data, raw_app_meta_data
) values (
  'f1000000-0000-0000-0000-000000000011',
  repeat('7', 64) || '@learners.shidao.internal', now(),
  '{"full_name":"Marker-less internal actor"}',
  '{"provider":"email","providers":["email"]}'
);
update auth.users
set raw_app_meta_data = raw_app_meta_data || jsonb_build_object(
  'activation_invitation_id',
  :'child_child_invitation'::jsonb ->> 'id'
)
where id = 'f1000000-0000-0000-0000-000000000011';

-- A valid UUID is still untrusted when it points to the wrong invitation kind.
insert into auth.users (
  id, email, email_confirmed_at, raw_user_meta_data, raw_app_meta_data
) values (
  'f1000000-0000-0000-0000-000000000008',
  repeat('d', 64) || '@learners.shidao.internal', now(),
  '{"full_name":"Claim marker actor"}',
  '{"provider":"email","providers":["email"]}'
);
update auth.users
set raw_app_meta_data = raw_app_meta_data || jsonb_build_object(
  'identity_status', 'provisional',
  'activation_invitation_id',
  :'claim_only_claim_only_invitation'::jsonb ->> 'id'
)
where id = 'f1000000-0000-0000-0000-000000000008';

-- An expired child invitation cannot provision a learner Account.
insert into auth.users (
  id, email, email_confirmed_at, raw_user_meta_data, raw_app_meta_data
) values (
  'f1000000-0000-0000-0000-000000000009',
  repeat('e', 64) || '@learners.shidao.internal', now(),
  '{"full_name":"Expired marker actor"}',
  '{"provider":"email","providers":["email"]}'
);
update auth.users
set raw_app_meta_data = raw_app_meta_data || jsonb_build_object(
  'identity_status', 'provisional',
  'activation_invitation_id',
  :'expired_child_expired_child_invitation'::jsonb ->> 'id'
)
where id = 'f1000000-0000-0000-0000-000000000009';

insert into auth.users (
  id, email, email_confirmed_at, raw_user_meta_data, raw_app_meta_data
) values (
  'f1000000-0000-0000-0000-000000000005',
  repeat('a', 64) || '@learners.shidao.internal', now(),
  '{"full_name":"Child"}',
  '{"provider":"email","providers":["email"]}'
);
update auth.users
set raw_app_meta_data = raw_app_meta_data || jsonb_build_object(
  'identity_status', 'provisional',
  'activation_invitation_id',
  :'child_child_invitation'::jsonb ->> 'id'
)
where id = 'f1000000-0000-0000-0000-000000000005';

-- Create a second provisional user before the invitation becomes terminal.
-- It exercises compensating Auth deletion after the winner consumes the flow.
insert into auth.users (
  id, email, email_confirmed_at, raw_user_meta_data, raw_app_meta_data
) values (
  'f1000000-0000-0000-0000-000000000006',
  repeat('b', 64) || '@learners.shidao.internal', now(),
  '{"full_name":"Losing provisional"}',
  '{"provider":"email","providers":["email"]}'
);
update auth.users
set raw_app_meta_data = raw_app_meta_data || jsonb_build_object(
  'identity_status', 'provisional',
  'activation_invitation_id',
  :'child_child_invitation'::jsonb ->> 'id'
)
where id = 'f1000000-0000-0000-0000-000000000006';

set constraints all immediate;
reset role;
set constraints all deferred;

select pg_temp.assert_true(
  (select account.status = 'active'
   from public.account as account
   where account.auth_user_id = 'f1000000-0000-0000-0000-000000000004')
  and (select account.status = 'active'
       from public.account as account
       where account.auth_user_id = 'f1000000-0000-0000-0000-000000000007')
  and (select account.status = 'active'
       from public.account as account
       where account.auth_user_id = 'f1000000-0000-0000-0000-000000000011')
  and not exists (
    select 1
    from public.account as account
    where account.auth_user_id in (
      'f1000000-0000-0000-0000-000000000008',
      'f1000000-0000-0000-0000-000000000009'
    )
      and account.status <> 'active'
  )
  and (
    select count(*) = 2
    from public.account as account
    where account.auth_user_id in (
      'f1000000-0000-0000-0000-000000000008',
      'f1000000-0000-0000-0000-000000000009'
    )
  )
  and not exists (
    select 1
    from public.account as account
    where account.auth_user_id in (
      'f1000000-0000-0000-0000-000000000005',
      'f1000000-0000-0000-0000-000000000006'
    )
      and (
        account.status <> 'provisional'
        or (
          select count(*)
          from public.learner_profile as profile
          where profile.account_id = account.id
        ) <> 1
      )
  ),
  'two-phase Auth metadata sync widened trust or missed a provisional Account'
);

select set_config(
  'request.jwt.claim.sub',
  'f1000000-0000-0000-0000-000000000005',
  true
);
select pg_temp.assert_true(
  (select verified_email is null from public.current_account_auth_context()),
  'synthetic learner Auth e-mail leaked as verified recipient e-mail'
);

do $$
begin
  begin
    perform public.activate_offline_learner_account(
      'f1000000-0000-0000-0000-000000000003',
      (select id from public.learner_claim_invitation
       where token_digest = decode(repeat('12', 32), 'hex')),
      decode(repeat('12', 32), 'hex'), decode(repeat('11', 32), 'hex'),
      'child.login', '1234', 'f1000000-0000-0000-0000-000000000005',
      false, false
    );
    raise exception 'child activation bypassed recovery acknowledgement';
  exception when sqlstate '55000' then null;
  end;
  begin
    perform public.activate_verified_offline_learner_account(
      'f1000000-0000-0000-0000-000000000004',
      (select id from public.learner_claim_invitation
       where token_digest = decode(repeat('12', 32), 'hex')),
      decode(repeat('13', 32), 'hex'), 'wrong.child', '1234',
      'f1000000-0000-0000-0000-000000000005', true, false
    );
    raise exception 'wrong verified recipient accepted child activation';
  exception when sqlstate 'P0002' then null;
  end;
end
$$;

select public.activate_verified_offline_learner_account(
  'f1000000-0000-0000-0000-000000000003',
  (:'child_child_invitation'::jsonb ->> 'id')::uuid,
  decode(repeat('11', 32), 'hex'), 'child.login', '1234',
  'f1000000-0000-0000-0000-000000000005', true, true
) as child_activation \gset activation_

select pg_temp.assert_true(
  (:'activation_child_activation'::jsonb ->> 'completed')::boolean
    and :'activation_child_activation'::jsonb ->> 'childAccountLogin' = 'child.login'
    and (:'activation_child_activation'::jsonb ->> 'observerInvitationId') is not null
    and (:'activation_child_activation'::jsonb ->> 'provisionalAuthUserConsumed')::boolean
    and (:'activation_child_activation'::jsonb ->> 'recoveryDelegateActive')::boolean
    and (:'activation_child_activation'::jsonb ->> 'recoveryDelegateId') is not null,
  'child activation did not complete/bind recovery and observer boundaries'
);
select pg_temp.assert_true(
  (select account.status = 'active'
     from public.account as account
     where account.auth_user_id = 'f1000000-0000-0000-0000-000000000005')
  and (select profile.account_id <> adult.id
       from public.learner_profile as profile
       join public.account as child on child.id = profile.account_id
       cross join public.account as adult
       where child.auth_user_id = 'f1000000-0000-0000-0000-000000000005'
         and adult.auth_user_id = 'f1000000-0000-0000-0000-000000000003'),
  'adult Account became child learner identity'
);
select pg_temp.assert_true(
  (public.activate_offline_learner_account(
    'f1000000-0000-0000-0000-000000000003',
    (:'child_child_invitation'::jsonb ->> 'id')::uuid,
    decode(repeat('12', 32), 'hex'), decode(repeat('11', 32), 'hex'),
    'child.login', '1234', 'f1000000-0000-0000-0000-000000000005',
    true, true
  ) ->> 'recoveryDelegateActive')::boolean,
  'token child activation retry lost recovery parity'
);

-- Reintroducing the same Auth marker after activation is terminal must never
-- downgrade the now-established child Account.  Toggling the invitation key
-- forces both guarded UPDATE-trigger branches in this synthetic transaction.
set local role shidao_identity_auth_harness;
update auth.users
set raw_app_meta_data = raw_app_meta_data - 'activation_invitation_id'
where id = 'f1000000-0000-0000-0000-000000000005';
update auth.users
set raw_app_meta_data = raw_app_meta_data || jsonb_build_object(
  'activation_invitation_id',
  :'child_child_invitation'::jsonb ->> 'id',
  'post_activation_refresh', true
)
where id = 'f1000000-0000-0000-0000-000000000005';
set constraints all immediate;
reset role;
set constraints all deferred;
select pg_temp.assert_true(
  exists (
    select 1
    from public.account as account
    where account.auth_user_id = 'f1000000-0000-0000-0000-000000000005'
      and account.status = 'active'
      and (
        select count(*)
        from public.learner_profile as profile
        where profile.account_id = account.id
      ) = 1
  ),
  'terminal Auth metadata refresh downgraded the active child Account'
);

-- A racing/losing provisional Auth user is not reported as consumed and Auth
-- Admin cleanup removes its empty bootstrap Account/profile without producing
-- a stray offline learner.
select public.activate_verified_offline_learner_account(
  'f1000000-0000-0000-0000-000000000003',
  (:'child_child_invitation'::jsonb ->> 'id')::uuid,
  decode(repeat('11', 32), 'hex'), 'loser.login', '9999',
  'f1000000-0000-0000-0000-000000000006', true, true
) as losing_activation \gset losing_
select pg_temp.assert_true(
  not (:'losing_losing_activation'::jsonb ->> 'provisionalAuthUserConsumed')::boolean,
  'terminal child activation incorrectly consumed the racing loser'
);
set local role shidao_identity_auth_harness;
delete from auth.users
where id = 'f1000000-0000-0000-0000-000000000006';
set constraints all immediate;
reset role;
set constraints all deferred;
select pg_temp.assert_true(
  not exists (
    select 1 from public.account
    where auth_user_id = 'f1000000-0000-0000-0000-000000000006'
  )
  and not exists (
    select 1 from public.learner_profile
    where display_name = 'Losing provisional'
  ),
  'losing provisional Auth cleanup left an Account/offline profile'
);
select set_config('app.learner_profile_link_mutation', 'off', true);

-- Recovery delegates are explicit, narrow, reauthentication-gated and
-- idempotent. Browser DTOs never expose Auth IDs, internal email, PIN hashes,
-- or session-cutoff metadata.
select public.list_recoverable_learner_credentials(
  'f1000000-0000-0000-0000-000000000003'
) as recovery_list \gset recovery_
select pg_temp.assert_true(
  jsonb_array_length(:'recovery_recovery_list'::jsonb) = 1
    and (:'recovery_recovery_list'::jsonb -> 0 ->> 'grantId')
      = :'activation_child_activation'::jsonb ->> 'recoveryDelegateId'
    and :'recovery_recovery_list'::text not like '%authUser%'
    and :'recovery_recovery_list'::text not like '%@learners.shidao.internal%'
    and :'recovery_recovery_list'::text not like '%pinHash%',
  'recovery list is missing its grant or leaked credential identity data'
);
select public.reset_recoverable_learner_credentials(
  'f1000000-0000-0000-0000-000000000003',
  (:'activation_child_activation'::jsonb ->> 'recoveryDelegateId')::uuid,
  'child.renamed', '5678', clock_timestamp(),
  'f6000000-0000-0000-0000-000000000001'
) as recovery_reset \gset reset_
select pg_temp.assert_true(
  (:'reset_recovery_reset'::jsonb ->> 'completed')::boolean
    and :'reset_recovery_reset'::jsonb ->> 'grantId'
      = :'activation_child_activation'::jsonb ->> 'recoveryDelegateId'
    and :'reset_recovery_reset'::jsonb ->> 'childAccountLogin' = 'child.renamed'
    and not (:'reset_recovery_reset'::jsonb ? 'sessionsInvalidBefore')
    and not (:'reset_recovery_reset'::jsonb ? 'sessionsRevokedBefore')
    and exists (
      select 1
      from public.account_login_alias as alias
      join public.account as account on account.id = alias.account_id
      where account.auth_user_id = 'f1000000-0000-0000-0000-000000000005'
        and alias.normalized_login = 'child.renamed'
        and alias.revoked_at is null
    )
    and exists (
      select 1
      from public.account_security as security
      join public.account as account on account.id = security.account_id
      where account.auth_user_id = 'f1000000-0000-0000-0000-000000000005'
        and extensions.crypt('5678', security.pin_hash) = security.pin_hash
        and security.sessions_invalid_before is not null
    )
    and case
      when to_regprocedure('public.verify_user_pin(uuid,text)') is not null then
        exists (
          select 1
          from public.user_security as security
          where security.user_id = 'f1000000-0000-0000-0000-000000000005'
            and extensions.crypt('5678', security.pin_hash) = security.pin_hash
            and security.sessions_invalid_before is not null
        )
      else
        not exists (
          select 1
          from public.user_security as security
          where security.user_id = 'f1000000-0000-0000-0000-000000000005'
        )
    end,
  'credential recovery did not rotate alias/PIN/session state safely'
);
select pg_temp.assert_true(
  public.reset_recoverable_learner_credentials(
    'f1000000-0000-0000-0000-000000000003',
    (:'activation_child_activation'::jsonb ->> 'recoveryDelegateId')::uuid,
    'child.renamed', '5678', clock_timestamp(),
    'f6000000-0000-0000-0000-000000000001'
  ) = :'reset_recovery_reset'::jsonb,
  'credential recovery idempotency key changed the terminal result'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'f1000000-0000-0000-0000-000000000005', true);
select public.list_my_learner_credential_recovery_delegates()
  as self_recovery_list \gset self_
select pg_temp.assert_true(
  jsonb_array_length(:'self_self_recovery_list'::jsonb) = 1
    and :'self_self_recovery_list'::jsonb -> 0 ->> 'grantId'
      = :'activation_child_activation'::jsonb ->> 'recoveryDelegateId',
  'child cannot inspect its recovery delegate'
);
select public.revoke_my_learner_credential_recovery_delegate(
  (:'activation_child_activation'::jsonb ->> 'recoveryDelegateId')::uuid
) as self_revoke \gset revoke_
select pg_temp.assert_true(
  public.revoke_my_learner_credential_recovery_delegate(
    (:'activation_child_activation'::jsonb ->> 'recoveryDelegateId')::uuid
  ) = :'revoke_self_revoke'::jsonb,
  'recovery delegate revoke retry changed terminal state'
);
reset role;
do $$
begin
  begin
    perform public.reset_recoverable_learner_credentials(
      'f1000000-0000-0000-0000-000000000003',
      (select id from public.learner_credential_recovery_delegate
       where subject_account_id = public.account_id_for_auth_user(
         'f1000000-0000-0000-0000-000000000005'
       )),
      'child.after-revoke', '2468', clock_timestamp(),
      'f6000000-0000-0000-0000-000000000002'
    );
    raise exception 'revoked recovery delegate still reset credentials';
  exception when sqlstate 'P0002' then null;
  end;
end
$$;

-- Verified-email connection binding is tokenless, blocks safe unlink while
-- pending/bound, and has a stable terminal projection on retry.
select public.create_learner_connection_request(
  'f1000000-0000-0000-0000-000000000001', 'email',
  decode(repeat('31', 32), 'hex'), decode(repeat('32', 32), 'hex'),
  null, 'Outsider Local', now() + interval '1 day'
) as email_connection \gset connection_
select public.preview_verified_email_learner_connection_request(
  'f1000000-0000-0000-0000-000000000004',
  (:'connection_email_connection'::jsonb ->> 'id')::uuid,
  decode(repeat('31', 32), 'hex')
);
set local role authenticated;
select set_config('request.jwt.claim.sub', 'f1000000-0000-0000-0000-000000000004', true);
select pg_temp.assert_true(
  not (public.preview_my_learner_profile_unlink() ->> 'canUnlink')::boolean,
  'verified pending connection did not block safe unlink'
);
reset role;
select public.act_on_verified_email_learner_connection_request(
  'f1000000-0000-0000-0000-000000000004',
  (:'connection_email_connection'::jsonb ->> 'id')::uuid,
  'reject', decode(repeat('31', 32), 'hex')
) as rejected_connection \gset rejected_
select pg_temp.assert_true(
  public.act_on_verified_email_learner_connection_request(
    'f1000000-0000-0000-0000-000000000004',
    (:'connection_email_connection'::jsonb ->> 'id')::uuid,
    'reject', decode(repeat('31', 32), 'hex')
  ) = :'rejected_rejected_connection'::jsonb,
  'verified connection terminal retry changed projection'
);
set local role authenticated;
select set_config('request.jwt.claim.sub', 'f1000000-0000-0000-0000-000000000004', true);
select pg_temp.assert_true(
  (public.preview_my_learner_profile_unlink() ->> 'canUnlink')::boolean,
  'terminal rejected connection still blocked safe unlink'
);
reset role;
insert into public.learner_identity_reconciliation (
  observer_account_id, learner_profile_id, legacy_parent_id,
  legacy_student_id, status, reason
)
select observer.id, profile.id,
  'f8000000-0000-0000-0000-000000000001',
  'f8000000-0000-0000-0000-000000000002',
  'needs_review', 'ambiguous_legacy_identity'
from public.account as observer
cross join public.learner_profile as profile
join public.account as subject on subject.id = profile.account_id
where observer.auth_user_id = 'f1000000-0000-0000-0000-000000000001'
  and subject.auth_user_id = 'f1000000-0000-0000-0000-000000000004';
set local role authenticated;
select set_config('request.jwt.claim.sub', 'f1000000-0000-0000-0000-000000000004', true);
select pg_temp.assert_true(
  not (public.preview_my_learner_profile_unlink() ->> 'canUnlink')::boolean,
  'unresolved legacy reconciliation did not block safe unlink'
);
reset role;
delete from public.learner_identity_reconciliation
where legacy_parent_id = 'f8000000-0000-0000-0000-000000000001';

select pg_temp.assert_true(
  public.learner_identity_rate_limit_hit(
    'acceptance_probe', decode(repeat('39', 32), 'hex'),
    2, interval '1 hour', interval '1 hour'
  )
  and public.learner_identity_rate_limit_hit(
    'acceptance_probe', decode(repeat('39', 32), 'hex'),
    2, interval '1 hour', interval '1 hour'
  )
  and not public.learner_identity_rate_limit_hit(
    'acceptance_probe', decode(repeat('39', 32), 'hex'),
    2, interval '1 hour', interval '1 hour'
  ),
  'server-side identity rate limit did not fail closed'
);

-- Expired pending/bound rows are swept before re-invitation, audited, and the
-- old identity handoff can no longer be previewed.
insert into public.learner_profile (id, display_name)
values ('f2000000-0000-0000-0000-000000000003', 'Expiry Offline');
insert into public.teacher_learner (
  teacher_account_id, learner_profile_id, display_name
)
select account.id, 'f2000000-0000-0000-0000-000000000003', 'Expiry Offline'
from public.account as account
where account.auth_user_id = 'f1000000-0000-0000-0000-000000000001';
select public.create_learner_profile_invitation(
  'f1000000-0000-0000-0000-000000000001',
  'f2000000-0000-0000-0000-000000000003', 'claim',
  decode(repeat('41', 32), 'hex'), decode(repeat('42', 32), 'hex'),
  now() + interval '1 day'
) as expired_claim \gset expired_claim_
update public.learner_claim_invitation
set created_at = now() - interval '2 days',
    expires_at = now() - interval '1 day'
where id = (:'expired_claim_expired_claim'::jsonb ->> 'id')::uuid;
select public.create_learner_profile_invitation(
  'f1000000-0000-0000-0000-000000000001',
  'f2000000-0000-0000-0000-000000000003', 'claim',
  decode(repeat('41', 32), 'hex'), decode(repeat('43', 32), 'hex'),
  now() + interval '1 day'
) as replacement_claim \gset replacement_claim_

select public.create_learner_observer_invitation(
  'f1000000-0000-0000-0000-000000000004',
  decode(repeat('44', 32), 'hex'), decode(repeat('45', 32), 'hex'),
  'Expiry observer', now() + interval '1 day'
) as expired_observer \gset expired_observer_
update public.learner_observer_invitation
set created_at = now() - interval '2 days',
    expires_at = now() - interval '1 day'
where id = (:'expired_observer_expired_observer'::jsonb ->> 'createdInvitationId')::uuid;
select public.create_learner_observer_invitation(
  'f1000000-0000-0000-0000-000000000004',
  decode(repeat('44', 32), 'hex'), decode(repeat('46', 32), 'hex'),
  'Expiry observer', now() + interval '1 day'
) as replacement_observer \gset replacement_observer_

select public.create_learner_connection_request(
  'f1000000-0000-0000-0000-000000000001', 'email',
  decode(repeat('47', 32), 'hex'), decode(repeat('48', 32), 'hex'),
  null, 'Expiry Connection', now() + interval '1 day'
) as expired_connection \gset expired_connection_
update public.learner_connection_request
set created_at = now() - interval '2 days',
    expires_at = now() - interval '1 day'
where id = (:'expired_connection_expired_connection'::jsonb ->> 'id')::uuid;
select public.create_learner_connection_request(
  'f1000000-0000-0000-0000-000000000001', 'email',
  decode(repeat('47', 32), 'hex'), decode(repeat('49', 32), 'hex'),
  null, 'Expiry Connection', now() + interval '1 day'
) as replacement_connection \gset replacement_connection_

select pg_temp.assert_true(
  (select status = 'expired' from public.learner_claim_invitation
   where id = (:'expired_claim_expired_claim'::jsonb ->> 'id')::uuid)
  and (select status = 'expired' from public.learner_observer_invitation
   where id = (:'expired_observer_expired_observer'::jsonb ->> 'createdInvitationId')::uuid)
  and (select status = 'expired' from public.learner_connection_request
   where id = (:'expired_connection_expired_connection'::jsonb ->> 'id')::uuid)
  and (select count(*) from public.learner_identity_audit_event
       where event_type in (
         'learner_profile_invitation_expired',
         'learner_observer_invitation_expired',
         'learner_connection_expired'
       )) >= 3,
  'expiry-to-reinvite did not terminalize and audit old handoffs'
);
do $$
begin
  begin
    perform public.preview_verified_learner_profile_invitation(
      'f1000000-0000-0000-0000-000000000004',
      (select id from public.learner_claim_invitation
       where token_digest = decode(repeat('42', 32), 'hex')),
      decode(repeat('41', 32), 'hex')
    );
    raise exception 'expired claim invitation remained usable';
  exception when sqlstate 'P0002' then null;
  end;
  begin
    perform public.preview_verified_email_learner_observer_invitation(
      'f1000000-0000-0000-0000-000000000003',
      (select id from public.learner_observer_invitation
       where token_digest = decode(repeat('45', 32), 'hex')),
      decode(repeat('44', 32), 'hex')
    );
    raise exception 'expired observer invitation remained usable';
  exception when sqlstate 'P0002' then null;
  end;
  begin
    perform public.preview_verified_email_learner_connection_request(
      'f1000000-0000-0000-0000-000000000004',
      (select id from public.learner_connection_request
       where token_digest = decode(repeat('48', 32), 'hex')),
      decode(repeat('47', 32), 'hex')
    );
    raise exception 'expired email connection remained usable';
  exception when sqlstate 'P0002' then null;
  end;
end
$$;

-- Finalized duplicate records for one LessonRun exercise conflict retention,
-- supersession, safe history, and present-only duration accounting.
insert into public.course (id, owner_account_id, title, subject)
select 'f3000000-0000-0000-0000-000000000001', account.id, 'Test Course', 'Math'
from public.account as account
where account.auth_user_id = 'f1000000-0000-0000-0000-000000000001';
insert into public.lesson (id, course_id, position, title)
values ('f3100000-0000-0000-0000-000000000001', 'f3000000-0000-0000-0000-000000000001', 1, 'Test Lesson');
insert into public.lesson_run (
  id, lesson_id, scheduled_at, planned_duration_minutes,
  started_at, started_at_is_actual, ended_at, actual_duration_minutes
) values (
  'f3200000-0000-0000-0000-000000000001',
  'f3100000-0000-0000-0000-000000000001', now() - interval '1 hour', 60,
  now() - interval '40 minutes', true, now() - interval '30 minutes', 10
);
insert into public.lesson_run (
  id, lesson_id, scheduled_at, planned_duration_minutes, ended_at, actual_duration_minutes
) values (
  'f3200000-0000-0000-0000-000000000002',
  'f3100000-0000-0000-0000-000000000001', now() - interval '20 minutes', 60,
  now() - interval '10 minutes', 20
);
insert into public.learner_profile (id, display_name)
values ('f2000000-0000-0000-0000-000000000002', 'Merge Source');
insert into public.teacher_learner (teacher_account_id, learner_profile_id, display_name)
select account.id, 'f2000000-0000-0000-0000-000000000002', 'Teacher Local Source'
from public.account as account
where account.auth_user_id = 'f1000000-0000-0000-0000-000000000001';

insert into public.learning_record (
  id, learner_profile_id, lesson_run_id, source_course_id, source_lesson_id,
  occurred_at, was_present, needs_repeat, teacher_comment,
  shared_with_learner_at, actual_duration_minutes_at_time,
  course_title_at_time, lesson_title_at_time, subject_at_time,
  recorded_by_account_id
)
select
  'f4000000-0000-0000-0000-000000000001', profile.id,
  'f3200000-0000-0000-0000-000000000001',
  'f3000000-0000-0000-0000-000000000001',
  'f3100000-0000-0000-0000-000000000001', now(), true, false,
  'Анна Иванова живёт: улица Ленина, дом 10. Заметен прогресс. person@example.test +7 999 123-45-67 https://bad.test ffffffff-ffff-4fff-8fff-ffffffffffff',
  now(), 10, 'Foreign Course', 'Foreign Lesson', 'Math', teacher.id
from public.learner_profile as profile
join public.account as subject on subject.id = profile.account_id
cross join public.account as teacher
where subject.auth_user_id = 'f1000000-0000-0000-0000-000000000002'
  and teacher.auth_user_id = 'f1000000-0000-0000-0000-000000000001';

insert into public.learning_record (
  id, learner_profile_id, lesson_run_id, source_course_id, source_lesson_id,
  occurred_at, was_present, needs_repeat, teacher_comment,
  actual_duration_minutes_at_time, course_title_at_time,
  lesson_title_at_time, subject_at_time, recorded_by_account_id
)
select
  'f4000000-0000-0000-0000-000000000002',
  'f2000000-0000-0000-0000-000000000002',
  'f3200000-0000-0000-0000-000000000001',
  'f3000000-0000-0000-0000-000000000001',
  'f3100000-0000-0000-0000-000000000001', now(), false, false,
  'private losing comment', 10, 'Foreign Course', 'Foreign Lesson', 'Math', account.id
from public.account as account
where account.auth_user_id = 'f1000000-0000-0000-0000-000000000001';

insert into public.learning_record (
  id, learner_profile_id, lesson_run_id, source_course_id, source_lesson_id,
  occurred_at, was_present, needs_repeat, actual_duration_minutes_at_time,
  course_title_at_time, lesson_title_at_time, subject_at_time,
  recorded_by_account_id
)
select
  'f4000000-0000-0000-0000-000000000003', profile.id,
  'f3200000-0000-0000-0000-000000000002',
  'f3000000-0000-0000-0000-000000000001',
  'f3100000-0000-0000-0000-000000000001', now(), false, false, 20,
  'Foreign Course', 'Foreign Lesson', 'Math', teacher.id
from public.learner_profile as profile
join public.account as subject on subject.id = profile.account_id
cross join public.account as teacher
where subject.auth_user_id = 'f1000000-0000-0000-0000-000000000002'
  and teacher.auth_user_id = 'f1000000-0000-0000-0000-000000000001';

insert into public.learner_profile_merge (
  id, source_learner_profile_id, target_learner_profile_id,
  requested_by_account_id, subject_account_id, expires_at
)
select
  'f5000000-0000-0000-0000-000000000001',
  'f2000000-0000-0000-0000-000000000002', profile.id,
  teacher.id, subject.id, now() + interval '1 day'
from public.account as teacher
cross join public.account as subject
join public.learner_profile as profile on profile.account_id = subject.id
where teacher.auth_user_id = 'f1000000-0000-0000-0000-000000000001'
  and subject.auth_user_id = 'f1000000-0000-0000-0000-000000000002';

select set_config('request.jwt.claim.sub', 'f1000000-0000-0000-0000-000000000002', true);
select public.preview_learner_profile_merge(
  'f5000000-0000-0000-0000-000000000001'
) as merge_preview \gset merge_
select public.confirm_learner_profile_merge(
  'f5000000-0000-0000-0000-000000000001',
  :'merge_merge_preview'::jsonb ->> 'previewFingerprint'
) as merge_result \gset merged_
select pg_temp.assert_true(
  not exists (select 1 from public.learner_profile where id = 'f2000000-0000-0000-0000-000000000002')
    and exists (select 1 from public.learner_profile_alias where source_learner_profile_id = 'f2000000-0000-0000-0000-000000000002')
    and exists (select 1 from public.learning_record where id = 'f4000000-0000-0000-0000-000000000002' and lesson_run_id is null and superseded_by_record_id = 'f4000000-0000-0000-0000-000000000001'),
  'merge did not preserve conflict/alias or delete source'
);
select pg_temp.assert_true(
  public.confirm_learner_profile_merge(
    'f5000000-0000-0000-0000-000000000001',
    :'merge_merge_preview'::jsonb ->> 'previewFingerprint'
  ) = :'merged_merge_result'::jsonb,
  'merge confirmation retry changed terminal result'
);
select pg_temp.assert_true(
  (public.get_my_learning_progress() ->> 'finalizedRunCount')::integer = 2
  and (public.get_my_learning_progress() ->> 'knownActualDurationMinutes')::integer = 10,
  'superseded row or absent duration polluted progress'
);

-- Direct RLS actor matrix: producer sees own raw rows; subject and unrelated
-- Account do not. Subject-safe RPC still sees all non-superseded finalized rows.
set local role authenticated;
select set_config('request.jwt.claim.sub', 'f1000000-0000-0000-0000-000000000002', true);
select pg_temp.assert_true((select count(*) from public.learning_record) = 0, 'subject read raw records');
select pg_temp.assert_true(
  jsonb_array_length(public.get_my_learning_history(null, 25) -> 'items') = 2,
  'subject safe history omitted canonical finalized rows'
);
select set_config('request.jwt.claim.sub', 'f1000000-0000-0000-0000-000000000004', true);
select pg_temp.assert_true((select count(*) from public.learning_record) = 0, 'outsider read raw records');
select set_config('request.jwt.claim.sub', 'f1000000-0000-0000-0000-000000000001', true);
select pg_temp.assert_true((select count(*) from public.learning_record) >= 3, 'producer lost recorder-scoped raw rows');
reset role;

-- Observer remains separate/read-only and revocation is immediate.
select public.create_learner_observer_invitation(
  'f1000000-0000-0000-0000-000000000002',
  decode(repeat('21', 32), 'hex'), decode(repeat('22', 32), 'hex'),
  'Coach', now() + interval '1 day'
) as observer_create \gset observer_
select public.preview_verified_email_learner_observer_invitation(
  'f1000000-0000-0000-0000-000000000003',
  (:'observer_observer_create'::jsonb ->> 'createdInvitationId')::uuid,
  decode(repeat('21', 32), 'hex')
);
select public.act_on_verified_email_learner_observer_invitation(
  'f1000000-0000-0000-0000-000000000003',
  (:'observer_observer_create'::jsonb ->> 'createdInvitationId')::uuid,
  'accept', decode(repeat('21', 32), 'hex'), null
) as observer_accept \gset accepted_
select pg_temp.assert_true(
  public.act_on_verified_email_learner_observer_invitation(
    'f1000000-0000-0000-0000-000000000003',
    (:'observer_observer_create'::jsonb ->> 'createdInvitationId')::uuid,
    'accept', decode(repeat('21', 32), 'hex'), null
  ) = :'accepted_observer_accept'::jsonb,
  'observer accept retry changed terminal result'
);
select set_config('request.jwt.claim.sub', 'f1000000-0000-0000-0000-000000000003', true);
select public.get_observed_learner_history(
  (select learner_profile_id from public.learner_observer_grant
    where observer_account_id = public.current_account_id() and status = 'active'),
  null, 25
) as observed_history \gset observed_
select pg_temp.assert_true(
  :'observed_observed_history'::text not like '%private losing comment%'
    and :'observed_observed_history'::text like '%person@example.test%',
  'observer safe history leaked private/suppressed or lost explicitly shared comment'
);
select public.act_on_learner_observer_relationship(
  (select id from public.learner_observer_grant
    where observer_account_id = public.current_account_id() and status = 'active'),
  'leave', null
);
do $$
declare v_profile uuid;
begin
  select profile.id into v_profile from public.learner_profile as profile
  join public.account as account on account.id = profile.account_id
  where account.auth_user_id = 'f1000000-0000-0000-0000-000000000002';
  begin
    perform public.get_observed_learner_history(v_profile, null, 25);
    raise exception 'revoked observer retained access';
  exception when sqlstate 'P0002' then null;
  end;
end
$$;

select public.create_learner_observer_invitation(
  'f1000000-0000-0000-0000-000000000002',
  decode(repeat('23', 32), 'hex'), decode(repeat('24', 32), 'hex'),
  'Pending observer', now() + interval '1 day'
) as pending_observer \gset pending_
select set_config('request.jwt.claim.sub', 'f1000000-0000-0000-0000-000000000002', true);
select public.act_on_learner_observer_relationship(
  (:'pending_pending_observer'::jsonb ->> 'createdInvitationId')::uuid,
  'revoke', null
) as pending_revoke \gset pending_revoke_
select pg_temp.assert_true(
  public.act_on_learner_observer_relationship(
    (:'pending_pending_observer'::jsonb ->> 'createdInvitationId')::uuid,
    'revoke', null
  ) = :'pending_revoke_pending_revoke'::jsonb
  and exists (
    select 1 from public.learner_observer_invitation
    where id = (:'pending_pending_observer'::jsonb ->> 'createdInvitationId')::uuid
      and status = 'revoked'
  ),
  'pending observer invitation revoke/retry was not terminal and idempotent'
);

-- Cross-provider AI is service-only, consent/current-owner/audience scoped,
-- present-duration only, bounded, and strips contact/URL/UUID data.
insert into public.course_learner (course_id, learner_profile_id)
select 'f3000000-0000-0000-0000-000000000001', profile.id
from public.learner_profile as profile
join public.account as account on account.id = profile.account_id
where account.auth_user_id = 'f1000000-0000-0000-0000-000000000002';
select pg_temp.assert_true(
  public.build_cross_provider_learner_context(
    'f1000000-0000-0000-0000-000000000001',
    'f3000000-0000-0000-0000-000000000001'
  ) ->> 'revision' = repeat('0', 64),
  'no-consent revision is not a 64-hex sentinel'
);
select set_config('request.jwt.claim.sub', 'f1000000-0000-0000-0000-000000000001', true);
select public.request_learner_ai_consent(
  'f3000000-0000-0000-0000-000000000001',
  (select profile.id from public.learner_profile as profile
    join public.account as account on account.id = profile.account_id
    where account.auth_user_id = 'f1000000-0000-0000-0000-000000000002'),
  'Personalization test', 30
) as ai_request \gset ai_
select set_config('request.jwt.claim.sub', 'f1000000-0000-0000-0000-000000000002', true);
select public.act_on_learner_ai_consent(
  (:'ai_ai_request'::jsonb ->> 'id')::uuid, 'grant',
  (:'ai_ai_request'::jsonb ->> 'revision')::integer, 30
);
select public.build_cross_provider_learner_context(
  'f1000000-0000-0000-0000-000000000001',
  'f3000000-0000-0000-0000-000000000001'
) as ai_context \gset context_
select pg_temp.assert_true(
  (:'context_ai_context'::jsonb ->> 'used')::boolean
    and (:'context_ai_context'::jsonb ->> 'revision') ~ '^[0-9a-f]{64}$'
    and (:'context_ai_context'::jsonb -> 'aggregates' ->> 'actualDurationMinutes')::integer = 10
    and :'context_ai_context'::jsonb -> 'sharedCommentSummaries'
      ? 'Отмечена положительная учебная динамика.'
    and length(:'context_ai_context'::jsonb -> 'sharedCommentSummaries' ->> 0) <= 240
    and :'context_ai_context'::text not like '%person@example.test%'
    and :'context_ai_context'::text not like '%999 123%'
    and :'context_ai_context'::text not like '%https://bad.test%'
    and :'context_ai_context'::text not like '%ffffffff-ffff-4fff-8fff-ffffffffffff%'
    and :'context_ai_context'::text not like '%Анна%'
    and :'context_ai_context'::text not like '%Иванова%'
    and :'context_ai_context'::text not like '%Ленина%'
    and :'context_ai_context'::text not like '%дом 10%'
    and :'context_ai_context'::text not like '%Foreign Course%'
    and :'context_ai_context'::text not like '%Foreign Lesson%',
  'AI context was unbounded, unsanitized, or leaked foreign titles'
);

-- Audience removal permanently invalidates the consent. Re-adding the same
-- profile does not silently resurrect it; a new revision and explicit grant
-- are required.
delete from public.course_learner
where course_id = 'f3000000-0000-0000-0000-000000000001'
  and learner_profile_id = (
    select profile.id from public.learner_profile as profile
    join public.account as account on account.id = profile.account_id
    where account.auth_user_id = 'f1000000-0000-0000-0000-000000000002'
  );
select pg_temp.assert_true(
  (select status = 'invalid'
   from public.learner_ai_consent
   where id = (:'ai_ai_request'::jsonb ->> 'id')::uuid)
  and not (public.build_cross_provider_learner_context(
    'f1000000-0000-0000-0000-000000000001',
    'f3000000-0000-0000-0000-000000000001'
  ) ->> 'used')::boolean,
  'audience removal did not invalidate AI consent immediately'
);
insert into public.course_learner (course_id, learner_profile_id)
select 'f3000000-0000-0000-0000-000000000001', profile.id
from public.learner_profile as profile
join public.account as account on account.id = profile.account_id
where account.auth_user_id = 'f1000000-0000-0000-0000-000000000002';
select pg_temp.assert_true(
  (select status = 'invalid'
   from public.learner_ai_consent
   where id = (:'ai_ai_request'::jsonb ->> 'id')::uuid)
  and not (public.build_cross_provider_learner_context(
    'f1000000-0000-0000-0000-000000000001',
    'f3000000-0000-0000-0000-000000000001'
  ) ->> 'used')::boolean,
  'audience re-add silently resurrected invalid AI consent'
);
select set_config('request.jwt.claim.sub', 'f1000000-0000-0000-0000-000000000001', true);
select public.request_learner_ai_consent(
  'f3000000-0000-0000-0000-000000000001',
  (select profile.id from public.learner_profile as profile
   join public.account as account on account.id = profile.account_id
   where account.auth_user_id = 'f1000000-0000-0000-0000-000000000002'),
  'Explicit re-consent after audience re-add', 30
) as ai_request_again \gset ai_again_
select set_config('request.jwt.claim.sub', 'f1000000-0000-0000-0000-000000000002', true);
select public.act_on_learner_ai_consent(
  (:'ai_again_ai_request_again'::jsonb ->> 'id')::uuid, 'grant',
  (:'ai_again_ai_request_again'::jsonb ->> 'revision')::integer, 30
);
select pg_temp.assert_true(
  (public.build_cross_provider_learner_context(
    'f1000000-0000-0000-0000-000000000001',
    'f3000000-0000-0000-0000-000000000001'
  ) ->> 'used')::boolean,
  'fresh explicit AI consent did not restore bounded context'
);

-- Archive is teacher-local. It removes only the acting teacher's direct/group
-- audience links; restore returns only the directory relation and preserves
-- canonical history plus every other teacher's relation/audience.
insert into public.teacher_learner (
  teacher_account_id, learner_profile_id, display_name
)
select teacher.id, profile.id, 'Teacher A Subject'
from public.account as teacher
cross join public.learner_profile as profile
join public.account as subject on subject.id = profile.account_id
where teacher.auth_user_id = 'f1000000-0000-0000-0000-000000000001'
  and subject.auth_user_id = 'f1000000-0000-0000-0000-000000000002'
on conflict (teacher_account_id, learner_profile_id) do update
  set archived_at = null;
insert into public.teacher_learner (
  teacher_account_id, learner_profile_id, display_name
)
select teacher.id, profile.id, 'Outsider Subject'
from public.account as teacher
cross join public.learner_profile as profile
join public.account as subject on subject.id = profile.account_id
where teacher.auth_user_id = 'f1000000-0000-0000-0000-000000000004'
  and subject.auth_user_id = 'f1000000-0000-0000-0000-000000000002';
insert into public.course (id, owner_account_id, title, subject)
select 'f3000000-0000-0000-0000-000000000002', account.id,
       'Outsider Course', 'Math'
from public.account as account
where account.auth_user_id = 'f1000000-0000-0000-0000-000000000004';
insert into public.course_learner (course_id, learner_profile_id)
select 'f3000000-0000-0000-0000-000000000002', profile.id
from public.learner_profile as profile
join public.account as account on account.id = profile.account_id
where account.auth_user_id = 'f1000000-0000-0000-0000-000000000002';
insert into public.learner_group (id, owner_account_id, name)
select 'f7000000-0000-0000-0000-000000000001', account.id, 'Teacher group'
from public.account as account
where account.auth_user_id = 'f1000000-0000-0000-0000-000000000001';
insert into public.learner_group (id, owner_account_id, name)
select 'f7000000-0000-0000-0000-000000000002', account.id, 'Outsider group'
from public.account as account
where account.auth_user_id = 'f1000000-0000-0000-0000-000000000004';
insert into public.course_learner_group (course_id, learner_group_id) values
  ('f3000000-0000-0000-0000-000000000001', 'f7000000-0000-0000-0000-000000000001'),
  ('f3000000-0000-0000-0000-000000000002', 'f7000000-0000-0000-0000-000000000002');
insert into public.learner_group_member (learner_group_id, learner_profile_id)
select group_id, profile.id
from (values
  ('f7000000-0000-0000-0000-000000000001'::uuid),
  ('f7000000-0000-0000-0000-000000000002'::uuid)
) as groups(group_id)
cross join public.learner_profile as profile
join public.account as account on account.id = profile.account_id
where account.auth_user_id = 'f1000000-0000-0000-0000-000000000002';
select set_config('request.jwt.claim.sub', 'f1000000-0000-0000-0000-000000000001', true);
select public.archive_learner_profile(
  (select profile.id from public.learner_profile as profile
   join public.account as account on account.id = profile.account_id
   where account.auth_user_id = 'f1000000-0000-0000-0000-000000000002')
);
select pg_temp.assert_true(
  exists (
    select 1 from public.teacher_learner as relation
    join public.account as teacher on teacher.id = relation.teacher_account_id
    where teacher.auth_user_id = 'f1000000-0000-0000-0000-000000000001'
      and relation.archived_at is not null
  )
  and not exists (
    select 1 from public.course_learner
    where course_id = 'f3000000-0000-0000-0000-000000000001'
  )
  and not exists (
    select 1 from public.learner_group_member
    where learner_group_id = 'f7000000-0000-0000-0000-000000000001'
  )
  and exists (
    select 1 from public.teacher_learner as relation
    join public.account as teacher on teacher.id = relation.teacher_account_id
    where teacher.auth_user_id = 'f1000000-0000-0000-0000-000000000004'
      and relation.archived_at is null
  )
  and exists (
    select 1 from public.course_learner
    where course_id = 'f3000000-0000-0000-0000-000000000002'
  )
  and exists (
    select 1 from public.learner_group_member
    where learner_group_id = 'f7000000-0000-0000-0000-000000000002'
  )
  and (select count(*)
       from public.learning_record as record
       join public.learner_profile as profile
         on profile.id = record.learner_profile_id
       join public.account as subject on subject.id = profile.account_id
       where subject.auth_user_id = 'f1000000-0000-0000-0000-000000000002') >= 2,
  'archive crossed teacher boundary or removed canonical history'
);
select public.restore_teacher_learner(
  (select profile.id from public.learner_profile as profile
   join public.account as account on account.id = profile.account_id
   where account.auth_user_id = 'f1000000-0000-0000-0000-000000000002')
);
select pg_temp.assert_true(
  exists (
    select 1 from public.teacher_learner as relation
    join public.account as teacher on teacher.id = relation.teacher_account_id
    where teacher.auth_user_id = 'f1000000-0000-0000-0000-000000000001'
      and relation.archived_at is null
  )
  and not exists (
    select 1 from public.course_learner
    where course_id = 'f3000000-0000-0000-0000-000000000001'
  )
  and not exists (
    select 1 from public.learner_group_member
    where learner_group_id = 'f7000000-0000-0000-0000-000000000001'
  ),
  'restore silently recreated teacher audience links'
);

-- The service-only confirm boundary is bound to the exact Supabase session,
-- not just an app-supplied actor UUID. Use an isolated Account with no Course
-- authority so cutoff/deactivation coverage cannot perturb the erasure matrix.
insert into auth.users (
  id, email, email_confirmed_at, raw_user_meta_data, raw_app_meta_data
) values (
  'f1000000-0000-0000-0000-000000000006',
  'erasure-session-boundary@test.invalid',
  now(),
  '{"full_name":"Erasure Session Boundary"}',
  '{}'
);
insert into auth.sessions (
  id, user_id, created_at, updated_at, not_after
) values (
  'f1100000-0000-4000-8000-000000000006',
  'f1000000-0000-0000-0000-000000000006',
  clock_timestamp(), clock_timestamp(), null
);
select set_config(
  'request.jwt.claim.sub',
  'f1000000-0000-0000-0000-000000000006',
  true
);
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', 'f1000000-0000-0000-0000-000000000006',
    'session_id', 'f1100000-0000-4000-8000-000000000006',
    'role', 'authenticated'
  )::text,
  true
);
select public.preview_my_learning_data_erasure();

update public.account_security as security
set sessions_invalid_before = (
  select session.created_at + interval '1 microsecond'
  from auth.sessions as session
  where session.id = 'f1100000-0000-4000-8000-000000000006'
)
where security.account_id = public.account_id_for_auth_user(
  'f1000000-0000-0000-0000-000000000006'
);
do $cutoff$
begin
  begin
    perform public.confirm_my_learning_data_erasure(
      'f1000000-0000-0000-0000-000000000006',
      'f1100000-0000-4000-8000-000000000006',
      (
        select encode(request.preview_fingerprint, 'hex')
        from public.learner_erasure_request as request
        where request.account_id = public.account_id_for_auth_user(
          'f1000000-0000-0000-0000-000000000006'
        )
          and request.consumed_at is null
        order by request.created_at desc
        limit 1
      )
    );
    raise exception 'cut-off session erased learning data';
  exception when sqlstate '42501' then
    if sqlerrm <> 'learning_data_erasure_session_revoked' then
      raise;
    end if;
  end;
  begin
    perform public.preview_my_learning_data_erasure();
    raise exception 'cut-off session created erasure preview';
  exception when sqlstate 'P0002' then
    if sqlerrm <> 'learner_profile_not_found' then
      raise;
    end if;
  end;
end
$cutoff$;
update public.account_security
set sessions_invalid_before = null
where account_id = public.account_id_for_auth_user(
  'f1000000-0000-0000-0000-000000000006'
);

update public.account
set status = 'suspended'
where auth_user_id = 'f1000000-0000-0000-0000-000000000006';
do $deactivated$
begin
  begin
    perform public.confirm_my_learning_data_erasure(
      'f1000000-0000-0000-0000-000000000006',
      'f1100000-0000-4000-8000-000000000006',
      (
        select encode(request.preview_fingerprint, 'hex')
        from public.learner_erasure_request as request
        where request.account_id = public.account_id_for_auth_user(
          'f1000000-0000-0000-0000-000000000006'
        )
          and request.consumed_at is null
        order by request.created_at desc
        limit 1
      )
    );
    raise exception 'deactivated Account erased learning data';
  exception when sqlstate 'P0002' then
    -- account_id_for_auth_user intentionally hides suspended identities before
    -- the confirmation boundary can inspect the retained preview request.
    if sqlerrm <> 'learning_data_erasure_not_found' then
      raise;
    end if;
  end;
end
$deactivated$;
update public.account
set status = 'active'
where auth_user_id = 'f1000000-0000-0000-0000-000000000006';

-- Erasure spans merged lineage, leaves no alias backdoor, creates exactly one
-- fresh profile, and does not delete records merely authored by the Account for
-- another learner.
insert into public.learning_record (
  id, learner_profile_id, lesson_run_id, source_course_id, source_lesson_id,
  occurred_at, was_present, needs_repeat, teacher_comment,
  actual_duration_minutes_at_time, course_title_at_time,
  lesson_title_at_time, subject_at_time, recorded_by_account_id
)
select
  'f4000000-0000-0000-0000-000000000004', child_profile.id,
  'f3200000-0000-0000-0000-000000000001',
  'f3000000-0000-0000-0000-000000000001',
  'f3100000-0000-0000-0000-000000000001', now(), true, false,
  'Authored for another learner', 10, 'Own Course', 'Own Lesson', 'Math',
  recorder.id
from public.account as recorder
cross join public.account as child
join public.learner_profile as child_profile on child_profile.account_id = child.id
where recorder.auth_user_id = 'f1000000-0000-0000-0000-000000000002'
  and child.auth_user_id = 'f1000000-0000-0000-0000-000000000005';

select set_config(
  'request.jwt.claim.sub',
  'f1000000-0000-0000-0000-000000000002',
  true
);
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', 'f1000000-0000-0000-0000-000000000002',
    'session_id', 'f1100000-0000-4000-8000-000000000002',
    'role', 'authenticated'
  )::text,
  true
);
select public.preview_my_learning_data_erasure() as stale_erase_preview \gset stale_erase_
insert into public.learner_profile_share_code (
  learner_profile_id, code_digest, expires_at
)
select profile.id, decode(repeat('71', 32), 'hex'), now() + interval '1 day'
from public.learner_profile as profile
join public.account as account on account.id = profile.account_id
where account.auth_user_id = 'f1000000-0000-0000-0000-000000000002';
do $$
begin
  begin
    perform public.confirm_my_learning_data_erasure(
      'f1000000-0000-0000-0000-000000000002',
      'f1100000-0000-4000-8000-000000000002',
      (select encode(request.preview_fingerprint, 'hex')
       from public.learner_erasure_request as request
       where request.account_id = public.account_id_for_auth_user(
         'f1000000-0000-0000-0000-000000000002'
       ) and request.consumed_at is null
       order by request.created_at desc limit 1)
    );
    raise exception 'erasure accepted stale dependency fingerprint';
  exception when sqlstate '40001' then null;
  end;
end
$$;
select public.preview_my_learning_data_erasure() as erase_preview \gset erase_
select public.confirm_my_learning_data_erasure(
  'f1000000-0000-0000-0000-000000000002',
  'f1100000-0000-4000-8000-000000000002',
  :'erase_erase_preview'::jsonb ->> 'previewFingerprint'
);
select pg_temp.assert_true(
  (select count(*) from public.learner_profile as profile
    join public.account as account on account.id = profile.account_id
    where account.auth_user_id = 'f1000000-0000-0000-0000-000000000002') = 1
  and not exists (
    select 1 from public.learner_profile_alias
    where source_learner_profile_id = 'f2000000-0000-0000-0000-000000000002'
  )
  and not exists (
    select 1 from public.learning_record
    where id in (
      'f4000000-0000-0000-0000-000000000001',
      'f4000000-0000-0000-0000-000000000002',
      'f4000000-0000-0000-0000-000000000003'
    )
  )
  and exists (
    select 1 from public.learning_record
    where id = 'f4000000-0000-0000-0000-000000000004'
  ),
  'lineage erasure/reset was incomplete'
);

rollback;
SQL

# The main matrix stays in one rollback-only transaction.  This compact second
# matrix deliberately crosses real commits to prove that a later Admin metadata
# refresh cannot reuse a still-live invitation to downgrade an active Account.
cleanup_identity_transaction_fixtures() {
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 >/dev/null 2>&1 <<'SQL' || true
begin;
delete from public.learner_claim_invitation
where id = 'f5000000-0000-0000-0000-000000000090';
delete from public.teacher_learner
where learner_profile_id = 'f2000000-0000-0000-0000-000000000090';
delete from public.account_login_alias
where normalized_login = 'rejected.nonpristine';
update public.account
set status = 'provisional'
where auth_user_id in (
  'f1000000-0000-0000-0000-000000000090',
  'f1000000-0000-0000-0000-000000000091',
  'f1000000-0000-0000-0000-000000000092'
);
delete from auth.users
where id in (
  'f1000000-0000-0000-0000-000000000090',
  'f1000000-0000-0000-0000-000000000091',
  'f1000000-0000-0000-0000-000000000092'
);
set constraints all immediate;
delete from public.learner_profile
where id = 'f2000000-0000-0000-0000-000000000090';
commit;
SQL
}
trap cleanup_identity_transaction_fixtures EXIT
cleanup_identity_transaction_fixtures

psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 <<'SQL'
begin;

create function pg_temp.assert_true(p_value boolean, p_message text)
returns void language plpgsql as $$
begin
  if not coalesce(p_value, false) then
    raise exception 'identity_acceptance_failed: %', p_message;
  end if;
end
$$;

insert into auth.users (
  id, email, email_confirmed_at, raw_user_meta_data, raw_app_meta_data
) values (
  'f1000000-0000-0000-0000-000000000090',
  'metadata-guard-teacher@test.invalid', now(),
  '{"full_name":"Metadata Guard Teacher"}', '{}'
);

insert into public.learner_profile (id, display_name)
values ('f2000000-0000-0000-0000-000000000090', 'Metadata Guard Source');
insert into public.teacher_learner (
  teacher_account_id, learner_profile_id, display_name
)
select
  account.id,
  'f2000000-0000-0000-0000-000000000090',
  'Metadata Guard Source'
from public.account as account
where account.auth_user_id = 'f1000000-0000-0000-0000-000000000090';
insert into public.learner_claim_invitation (
  id, source_learner_profile_id, inviter_account_id,
  recipient_email_digest, token_digest, kind, status, expires_at
)
select
  'f5000000-0000-0000-0000-000000000090',
  'f2000000-0000-0000-0000-000000000090',
  account.id,
  decode(repeat('81', 32), 'hex'),
  decode(repeat('82', 32), 'hex'),
  'child_activation', 'pending', now() + interval '1 day'
from public.account as account
where account.auth_user_id = 'f1000000-0000-0000-0000-000000000090';

commit;
SQL

if pristine_failure_output="$(
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 2>&1 <<'SQL'
begin;
insert into auth.users (
  id, email, email_confirmed_at, raw_user_meta_data, raw_app_meta_data
) values (
  'f1000000-0000-0000-0000-000000000092',
  repeat('8', 64) || '@learners.shidao.internal', now(),
  '{"full_name":"Rejected Non-pristine Child"}',
  '{"provider":"email","providers":["email"]}'
);
insert into public.account_login_alias (account_id, normalized_login)
select account.id, 'rejected.nonpristine'
from public.account as account
where account.auth_user_id = 'f1000000-0000-0000-0000-000000000092';
update auth.users
set raw_app_meta_data = raw_app_meta_data || jsonb_build_object(
  'identity_status', 'provisional',
  'activation_invitation_id',
  'f5000000-0000-0000-0000-000000000090'
)
where id = 'f1000000-0000-0000-0000-000000000092';
commit;
SQL
)"; then
  echo "Expected non-pristine provisional Auth sync to fail closed." >&2
  exit 1
fi
if [[ "$pristine_failure_output" != *"learner_identity_provisional_auth_sync_pristine_mismatch"* ]]; then
  echo "Non-pristine Auth sync failed for an unexpected reason." >&2
  exit 1
fi

psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 <<'SQL'
begin;

create function pg_temp.assert_true(p_value boolean, p_message text)
returns void language plpgsql as $$
begin
  if not coalesce(p_value, false) then
    raise exception 'identity_acceptance_failed: %', p_message;
  end if;
end
$$;

select pg_temp.assert_true(
  not exists (
    select 1 from auth.users
    where id = 'f1000000-0000-0000-0000-000000000092'
  )
  and not exists (
    select 1 from public.account
    where auth_user_id = 'f1000000-0000-0000-0000-000000000092'
  )
  and not exists (
    select 1 from public.learner_profile
    where display_name = 'Rejected Non-pristine Child'
  ),
  'failed non-pristine Auth transaction did not roll back completely'
);

insert into auth.users (
  id, email, email_confirmed_at, raw_user_meta_data, raw_app_meta_data
) values (
  'f1000000-0000-0000-0000-000000000091',
  repeat('f', 64) || '@learners.shidao.internal', now(),
  '{"full_name":"Metadata Guard Child"}',
  '{"provider":"email","providers":["email"]}'
);
update auth.users
set raw_app_meta_data = raw_app_meta_data || jsonb_build_object(
  'identity_status', 'provisional',
  'activation_invitation_id',
  'f5000000-0000-0000-0000-000000000090'
)
where id = 'f1000000-0000-0000-0000-000000000091';
set constraints all immediate;
select pg_temp.assert_true(
  exists (
    select 1
    from public.account as account
    where account.auth_user_id = 'f1000000-0000-0000-0000-000000000091'
      and account.status = 'provisional'
  ),
  'same-transaction metadata sync did not provision the Account'
);
commit;

begin;
update public.account
set status = 'active'
where auth_user_id = 'f1000000-0000-0000-0000-000000000091';
set constraints all immediate;
commit;

begin;
update auth.users
set raw_app_meta_data = raw_app_meta_data - 'activation_invitation_id'
where id = 'f1000000-0000-0000-0000-000000000091';
update auth.users
set raw_app_meta_data = raw_app_meta_data || jsonb_build_object(
  'activation_invitation_id',
  'f5000000-0000-0000-0000-000000000090'
)
where id = 'f1000000-0000-0000-0000-000000000091';
set constraints all immediate;
select pg_temp.assert_true(
  exists (
    select 1
    from public.account as account
    where account.auth_user_id = 'f1000000-0000-0000-0000-000000000091'
      and account.status = 'active'
  ),
  'post-commit metadata refresh downgraded an active Account'
);
commit;

begin;
update public.account
set status = 'provisional'
where auth_user_id in (
  'f1000000-0000-0000-0000-000000000090',
  'f1000000-0000-0000-0000-000000000091'
);
delete from auth.users
where id in (
  'f1000000-0000-0000-0000-000000000090',
  'f1000000-0000-0000-0000-000000000091'
);
set constraints all immediate;
delete from public.learner_profile
where id = 'f2000000-0000-0000-0000-000000000090';
select pg_temp.assert_true(
  not exists (
    select 1 from auth.users
    where id in (
      'f1000000-0000-0000-0000-000000000090',
      'f1000000-0000-0000-0000-000000000091'
    )
  )
  and not exists (
    select 1 from public.account
    where auth_user_id in (
      'f1000000-0000-0000-0000-000000000090',
      'f1000000-0000-0000-0000-000000000091'
    )
  )
  and not exists (
    select 1 from public.learner_profile
    where id = 'f2000000-0000-0000-0000-000000000090'
      or display_name in (
        'Metadata Guard Teacher',
        'Metadata Guard Child'
      )
  ),
  'metadata transaction guard cleanup left committed fixtures'
);
commit;
SQL

trap - EXIT

echo "Learner identity DB acceptance passed on $db_name"
