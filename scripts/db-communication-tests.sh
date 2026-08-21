#!/usr/bin/env bash
set -euo pipefail

# Transactional acceptance harness for the unified Communication Center.
#
# This script is deliberately impossible to point at the live ShiDao database:
# the connected database name must be exactly `shidao_communication_test`.
# Every fixture and mutation lives in one transaction. The successful path ends
# with ROLLBACK; ON_ERROR_STOP closes the failed psql session and PostgreSQL
# rolls the transaction back on every unexpected error.

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is required for the isolated communication test database." >&2
  exit 2
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "psql is required to run the communication database acceptance suite." >&2
  exit 2
fi

db_name="$(psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -Atqc 'select current_database()')"
if [[ "$db_name" != "shidao_communication_test" ]]; then
  echo "Refusing Communication Center fixtures for database '$db_name'; expected exactly 'shidao_communication_test'." >&2
  exit 2
fi

schema_marker="$(
  psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -Atqc \
    "select case when
       to_regclass('public.account') is not null
       and to_regclass('public.course') is not null
       and to_regclass('public.lesson') is not null
       and to_regclass('public.communication_thread') is not null
       and to_regclass('public.assistant_conversation') is not null
       and to_regclass('public.system_notification') is not null
       and to_regprocedure(
         'public.list_my_communication_inbox(timestamp with time zone,text,text,integer)'
       ) is not null
       and to_regprocedure(
         'public.append_system_notification_admin(uuid,text,text,text,text,jsonb,text,timestamp with time zone)'
       ) is not null
       and to_regprocedure(
         'public.schedule_lesson_run_if_unchanged(uuid,timestamp with time zone,integer,uuid,timestamp with time zone,uuid[])'
       ) is not null
     then 'shidao-communication-v2' else '' end"
)"
if [[ "$schema_marker" != "shidao-communication-v2" ]]; then
  echo "Refusing fixtures: '$db_name' is not a fully migrated ShiDao Communication Center test database." >&2
  exit 2
fi

psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 <<'SQL'
begin;
set constraints all deferred;

-- The isolated auth.users stub intentionally contains no Supabase bootstrap
-- ACL. Real Supabase grants browser roles schema usage for auth.uid(); add only
-- that baseline capability transaction-locally so RLS-policy evaluation in
-- nested canonical LessonRun writes matches production. ROLLBACK removes it.
grant usage on schema auth to authenticated;

do $guard$
begin
  if current_database() <> 'shidao_communication_test' then
    raise exception 'communication_acceptance_wrong_database:%', current_database()
      using errcode = '42501';
  end if;

  if to_regclass('public.account') is null
    or to_regclass('public.course') is null
    or to_regclass('public.lesson') is null
    or to_regclass('public.communication_thread') is null
    or to_regclass('public.assistant_conversation') is null
    or to_regclass('public.system_notification') is null
    or to_regprocedure(
      'public.list_my_communication_inbox(timestamp with time zone,text,text,integer)'
    ) is null
    or to_regprocedure(
      'public.append_system_notification_admin(uuid,text,text,text,text,jsonb,text,timestamp with time zone)'
    ) is null
    or to_regprocedure(
      'public.schedule_lesson_run_if_unchanged(uuid,timestamp with time zone,integer,uuid,timestamp with time zone,uuid[])'
    ) is null
  then
    raise exception 'communication_acceptance_wrong_schema'
      using errcode = '42501';
  end if;
end
$guard$;

create function pg_temp.assert_true(p_value boolean, p_message text)
returns void
language plpgsql
as $$
begin
  if not coalesce(p_value, false) then
    raise exception 'communication_acceptance_failed: %', p_message;
  end if;
end
$$;

create function pg_temp.assert_raises(
  p_statement text,
  p_expected_sqlstate text,
  p_message text
)
returns void
language plpgsql
as $$
declare
  v_actual_sqlstate text;
  v_actual_message text;
begin
  begin
    execute p_statement;
  exception when others then
    get stacked diagnostics
      v_actual_sqlstate = returned_sqlstate,
      v_actual_message = message_text;
    if v_actual_sqlstate = p_expected_sqlstate then
      return;
    end if;
    raise exception
      'communication_acceptance_failed: % (expected SQLSTATE %, got %: %)',
      p_message,
      p_expected_sqlstate,
      v_actual_sqlstate,
      v_actual_message;
  end;
  raise exception
    'communication_acceptance_failed: % (statement did not fail)',
    p_message;
end
$$;

select pg_temp.assert_true(
  current_database() = 'shidao_communication_test',
  'database identity changed after the shell guard'
);

select pg_temp.assert_true(
  to_regclass('public.communication_thread') is not null
    and to_regclass('public.communication_message') is not null
    and to_regclass('public.communication_read_state') is not null
    and to_regclass('public.assistant_conversation') is not null
    and to_regclass('public.assistant_turn') is not null
    and to_regclass('public.system_notification') is not null
    and to_regprocedure(
      'public.list_my_communication_inbox(timestamp with time zone,text,text,integer)'
    ) is not null
    and to_regprocedure(
      'public.append_system_notification_admin(uuid,text,text,text,text,jsonb,text,timestamp with time zone)'
    ) is not null
    and to_regprocedure(
      'public.schedule_lesson_run_if_unchanged(uuid,timestamp with time zone,integer,uuid,timestamp with time zone,uuid[])'
    ) is not null,
  'Communication Center migration is not fully applied'
);

select pg_temp.assert_true(
  bool_and(relation.relrowsecurity),
  'a Communication Center table does not have RLS enabled'
)
from pg_class as relation
join pg_namespace as namespace on namespace.oid = relation.relnamespace
where namespace.nspname = 'public'
  and relation.relname in (
    'communication_thread',
    'communication_message',
    'communication_read_state',
    'assistant_conversation',
    'assistant_turn',
    'system_notification'
  );

select pg_temp.assert_true(
  not exists (
    select 1
    from pg_class as relation
    join pg_namespace as namespace on namespace.oid = relation.relnamespace
    cross join (values ('anon'), ('authenticated')) as browser_role(name)
    cross join (
      values
        ('SELECT'),
        ('INSERT'),
        ('UPDATE'),
        ('DELETE'),
        ('TRUNCATE'),
        ('REFERENCES'),
        ('TRIGGER')
    ) as privilege(name)
    where namespace.nspname = 'public'
      and relation.relname in (
        'communication_thread',
        'communication_message',
        'communication_read_state',
        'assistant_conversation',
        'assistant_turn',
        'system_notification'
      )
      and has_table_privilege(
        browser_role.name,
        relation.oid,
        privilege.name
      )
  ),
  'anon/authenticated received a raw Communication Center table grant'
);

with user_rpc(signature) as (
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
)
select pg_temp.assert_true(
  bool_and(
    to_regprocedure(user_rpc.signature) is not null
    and has_function_privilege(
      'authenticated',
      to_regprocedure(user_rpc.signature),
      'EXECUTE'
    )
    and not has_function_privilege(
      'anon',
      to_regprocedure(user_rpc.signature),
      'EXECUTE'
    )
  ),
  'user-JWT RPC grant matrix is incorrect'
)
from user_rpc;

with admin_rpc(signature) as (
  values
    ('public.append_assistant_turn_admin(uuid,uuid,text,jsonb,text,text)'),
    ('public.append_system_notification_admin(uuid,text,text,text,text,jsonb,text,timestamp with time zone)')
)
select pg_temp.assert_true(
  bool_and(
    to_regprocedure(admin_rpc.signature) is not null
    and has_function_privilege(
      'service_role',
      to_regprocedure(admin_rpc.signature),
      'EXECUTE'
    )
    and not has_function_privilege(
      'authenticated',
      to_regprocedure(admin_rpc.signature),
      'EXECUTE'
    )
    and not has_function_privilege(
      'anon',
      to_regprocedure(admin_rpc.signature),
      'EXECUTE'
    )
  ),
  'trusted producer RPC grant matrix is incorrect'
)
from admin_rpc;

select pg_temp.assert_true(
  has_function_privilege(
    'authenticated',
    'public.schedule_lesson_run_if_unchanged(uuid,timestamp with time zone,integer,uuid,timestamp with time zone,uuid[])',
    'EXECUTE'
  )
    and not has_function_privilege(
      'anon',
      'public.schedule_lesson_run_if_unchanged(uuid,timestamp with time zone,integer,uuid,timestamp with time zone,uuid[])',
      'EXECUTE'
    )
    and not has_function_privilege(
      'service_role',
      'public.schedule_lesson_run_if_unchanged(uuid,timestamp with time zone,integer,uuid,timestamp with time zone,uuid[])',
      'EXECUTE'
    )
    and not exists (
      select 1
      from pg_proc as procedure
      cross join lateral aclexplode(
        coalesce(
          procedure.proacl,
          acldefault('f', procedure.proowner)
        )
      ) as acl_entry
      where procedure.oid = to_regprocedure(
        'public.schedule_lesson_run_if_unchanged(uuid,timestamp with time zone,integer,uuid,timestamp with time zone,uuid[])'
      )
        and acl_entry.grantee = 0
        and acl_entry.privilege_type = 'EXECUTE'
    ),
  'atomic assistant schedule RPC grant matrix is incorrect'
);

-- Auth rows satisfy the Account FK and authenticated RPC context. Keep the
-- fixture compatible with the deliberately minimal auth.users stub while the
-- hardened Run cancellation path also receives an exact live Session claim.
-- Disabling triggers for these six inserts avoids unrelated signup bootstrap.
set local session_replication_role = replica;
insert into auth.users (id)
values
  ('c1000000-0000-4000-8000-000000000001'),
  ('c1000000-0000-4000-8000-000000000002'),
  ('c1000000-0000-4000-8000-000000000003'),
  ('c1000000-0000-4000-8000-000000000004'),
  ('c1000000-0000-4000-8000-000000000005'),
  ('c1000000-0000-4000-8000-000000000006');
set local session_replication_role = origin;

insert into auth.sessions (
  id,
  user_id,
  created_at,
  updated_at,
  not_after
)
values (
  'c1100000-0000-4000-8000-000000000001',
  'c1000000-0000-4000-8000-000000000001',
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
    'c2000000-0000-4000-8000-000000000001',
    'c1000000-0000-4000-8000-000000000001',
    'Communication Teacher',
    'active'
  ),
  (
    'c2000000-0000-4000-8000-000000000002',
    'c1000000-0000-4000-8000-000000000002',
    'Direct Learner',
    'active'
  ),
  (
    'c2000000-0000-4000-8000-000000000003',
    'c1000000-0000-4000-8000-000000000003',
    'Group Learner',
    'active'
  ),
  (
    'c2000000-0000-4000-8000-000000000004',
    'c1000000-0000-4000-8000-000000000004',
    'Future Learner',
    'active'
  ),
  (
    'c2000000-0000-4000-8000-000000000005',
    'c1000000-0000-4000-8000-000000000005',
    'Provisional Learner',
    'provisional'
  ),
  (
    'c2000000-0000-4000-8000-000000000006',
    'c1000000-0000-4000-8000-000000000006',
    'Assistant Outsider',
    'active'
  );

-- Manual Account fixtures bypass the Auth bootstrap trigger, so provision the
-- canonical security companion rows required by exact-session boundaries.
insert into public.account_security (
  account_id,
  sessions_invalid_before
)
values
  ('c2000000-0000-4000-8000-000000000001', null),
  ('c2000000-0000-4000-8000-000000000002', null),
  ('c2000000-0000-4000-8000-000000000003', null),
  ('c2000000-0000-4000-8000-000000000004', null),
  ('c2000000-0000-4000-8000-000000000005', null),
  ('c2000000-0000-4000-8000-000000000006', null);

-- Direct Account/Profile linkage is guarded even for database owners. The
-- transaction-local workflow flag is the same narrow path used by Auth sync.
select set_config('app.learner_profile_link_mutation', 'on', true);
insert into public.learner_profile (id, display_name, account_id)
values
  (
    'c3000000-0000-4000-8000-000000000001',
    'Communication Teacher',
    'c2000000-0000-4000-8000-000000000001'
  ),
  (
    'c3000000-0000-4000-8000-000000000002',
    'Direct Learner',
    'c2000000-0000-4000-8000-000000000002'
  ),
  (
    'c3000000-0000-4000-8000-000000000003',
    'Group Learner',
    'c2000000-0000-4000-8000-000000000003'
  ),
  (
    'c3000000-0000-4000-8000-000000000004',
    'Future Learner',
    'c2000000-0000-4000-8000-000000000004'
  ),
  (
    'c3000000-0000-4000-8000-000000000005',
    'Provisional Learner',
    'c2000000-0000-4000-8000-000000000005'
  ),
  (
    'c3000000-0000-4000-8000-000000000006',
    'Offline Learner',
    null
  ),
  (
    'c3000000-0000-4000-8000-000000000007',
    'Assistant Outsider',
    'c2000000-0000-4000-8000-000000000006'
  );
select set_config('app.learner_profile_link_mutation', 'off', true);

insert into public.teacher_learner (
  teacher_account_id,
  learner_profile_id,
  display_name
)
values
  (
    'c2000000-0000-4000-8000-000000000001',
    'c3000000-0000-4000-8000-000000000002',
    'Direct Learner'
  ),
  (
    'c2000000-0000-4000-8000-000000000001',
    'c3000000-0000-4000-8000-000000000003',
    'Group Learner'
  ),
  (
    'c2000000-0000-4000-8000-000000000001',
    'c3000000-0000-4000-8000-000000000004',
    'Future Learner'
  ),
  (
    'c2000000-0000-4000-8000-000000000001',
    'c3000000-0000-4000-8000-000000000005',
    'Provisional Learner'
  ),
  (
    'c2000000-0000-4000-8000-000000000001',
    'c3000000-0000-4000-8000-000000000006',
    'Offline Learner'
  );

insert into public.course (
  id,
  owner_account_id,
  title,
  learning_audience
)
values (
  'c4000000-0000-4000-8000-000000000001',
  'c2000000-0000-4000-8000-000000000001',
  'Communication Course',
  'children'
);

insert into public.lesson (id, course_id, position, title)
values (
  'c5000000-0000-4000-8000-000000000001',
  'c4000000-0000-4000-8000-000000000001',
  1,
  'Communication Lesson'
);

insert into public.learner_group (id, owner_account_id, name)
values (
  'c6000000-0000-4000-8000-000000000001',
  'c2000000-0000-4000-8000-000000000001',
  'Communication Group'
);

insert into public.learner_group_member (
  learner_group_id,
  learner_profile_id
)
values (
  'c6000000-0000-4000-8000-000000000001',
  'c3000000-0000-4000-8000-000000000003'
);

insert into public.course_learner (course_id, learner_profile_id)
values (
  'c4000000-0000-4000-8000-000000000001',
  'c3000000-0000-4000-8000-000000000002'
);

insert into public.course_learner_group (course_id, learner_group_id)
values (
  'c4000000-0000-4000-8000-000000000001',
  'c6000000-0000-4000-8000-000000000001'
);

-- Browser roles cannot bypass RPC projections through raw table access.
select set_config(
  'request.jwt.claim.sub',
  'c1000000-0000-4000-8000-000000000001',
  true
);
set local role authenticated;
select pg_temp.assert_raises(
  'select count(*) from public.communication_message',
  '42501',
  'authenticated read a raw communication table'
);
reset role;
set local role anon;
select pg_temp.assert_raises(
  'select count(*) from public.communication_message',
  '42501',
  'anon read a raw communication table'
);
reset role;

-- Direct thread: active relation, stable idempotency and per-actor read state.
select set_config(
  'request.jwt.claim.sub',
  'c1000000-0000-4000-8000-000000000001',
  true
);
set local role authenticated;
select public.open_direct_communication_thread(
  'c3000000-0000-4000-8000-000000000002'
) as value \gset direct_open_
select (:'direct_open_value'::jsonb ->> 'id')::uuid as value
\gset direct_thread_
select pg_temp.assert_true(
  :'direct_open_value'::jsonb ->> 'kind' = 'direct'
    and :'direct_open_value'::jsonb ->> 'directLearnerProfileId'
      = 'c3000000-0000-4000-8000-000000000002'
    and not (:'direct_open_value'::jsonb ? 'directAccountId'),
  'direct open projection is wrong or leaks an Account id'
);

select public.send_communication_message(
  :'direct_thread_value'::uuid,
  'Direct hello',
  'c7000000-0000-4000-8000-000000000001'
) as value \gset direct_send_
select (:'direct_send_value'::jsonb ->> 'id')::bigint as value
\gset direct_message_
select pg_temp.assert_true(
  public.send_communication_message(
    :'direct_thread_value'::uuid,
    'Direct hello',
    'c7000000-0000-4000-8000-000000000001'
  ) = :'direct_send_value'::jsonb,
  'direct message retry changed its projection'
);
select pg_temp.assert_raises(
  format(
    'select public.send_communication_message(%L::uuid,%L,%L::uuid)',
    :'direct_thread_value',
    'Changed direct body',
    'c7000000-0000-4000-8000-000000000001'
  ),
  '23505',
  'direct message idempotency key accepted a different body'
);
reset role;

select set_config(
  'request.jwt.claim.sub',
  'c1000000-0000-4000-8000-000000000002',
  true
);
set local role authenticated;
select pg_temp.assert_true(
  exists (
    select 1
    from jsonb_array_elements(
      public.list_my_communication_inbox(
        null::timestamptz,
        null::text,
        null::text,
        30
      ) -> 'items'
    ) as item(value)
    where item.value ->> 'threadId' = :'direct_thread_value'
      and (item.value ->> 'unreadCount')::integer = 1
      and (item.value ->> 'lastMessageId')::bigint
        = :'direct_message_value'::bigint
  ),
  'direct recipient inbox unread/last-message projection is wrong'
);
select public.list_my_communication_messages(
  :'direct_thread_value'::uuid,
  null,
  50
) as value \gset direct_history_
select pg_temp.assert_true(
  jsonb_array_length(:'direct_history_value'::jsonb -> 'items') = 1
    and :'direct_history_value'::jsonb -> 'items' -> 0 ->> 'body'
      = 'Direct hello'
    and not (
      :'direct_history_value'::jsonb -> 'items' -> 0
      ? 'senderAccountId'
    ),
  'direct recipient cannot read the safe message history'
);
select public.mark_communication_thread_read(
  :'direct_thread_value'::uuid,
  :'direct_message_value'::bigint
) as value \gset direct_read_
select pg_temp.assert_true(
  (:'direct_read_value'::jsonb ->> 'markedThroughId')::bigint
      = :'direct_message_value'::bigint
    and (:'direct_read_value'::jsonb ->> 'unreadCount')::integer = 0,
  'direct read cursor did not clear unread messages'
);
reset role;

-- Archiving the current teacher/learner relation hides and locks the thread;
-- restoring that same relation restores the complete persisted history.
update public.teacher_learner
set archived_at = clock_timestamp(), updated_at = clock_timestamp()
where teacher_account_id = 'c2000000-0000-4000-8000-000000000001'
  and learner_profile_id = 'c3000000-0000-4000-8000-000000000002';

select set_config(
  'request.jwt.claim.sub',
  'c1000000-0000-4000-8000-000000000001',
  true
);
set local role authenticated;
select pg_temp.assert_raises(
  format(
    'select public.send_communication_message(%L::uuid,%L,%L::uuid)',
    :'direct_thread_value',
    'Archived relation must not send',
    'c7000000-0000-4000-8000-000000000006'
  ),
  'P0002',
  'archived direct relation still allowed the teacher to send'
);
reset role;

select set_config(
  'request.jwt.claim.sub',
  'c1000000-0000-4000-8000-000000000002',
  true
);
set local role authenticated;
select pg_temp.assert_raises(
  format(
    'select public.list_my_communication_messages(%L::uuid,null,50)',
    :'direct_thread_value'
  ),
  'P0002',
  'archived direct relation still exposed history'
);
select pg_temp.assert_true(
  not exists (
    select 1
    from jsonb_array_elements(
      public.list_my_communication_inbox(
        null::timestamptz,
        null::text,
        null::text,
        30
      ) -> 'items'
    ) as item(value)
    where item.value ->> 'threadId' = :'direct_thread_value'
  ),
  'archived direct relation remained in inbox'
);
reset role;

update public.teacher_learner
set archived_at = null, updated_at = clock_timestamp()
where teacher_account_id = 'c2000000-0000-4000-8000-000000000001'
  and learner_profile_id = 'c3000000-0000-4000-8000-000000000002';

select set_config(
  'request.jwt.claim.sub',
  'c1000000-0000-4000-8000-000000000002',
  true
);
set local role authenticated;
select pg_temp.assert_true(
  jsonb_array_length(
    public.list_my_communication_messages(
      :'direct_thread_value'::uuid,
      null,
      50
    ) -> 'items'
  ) = 1,
  'restored direct relation did not recover full history'
);
reset role;

-- Offline Profiles and provisional Accounts are never message targets.
select set_config(
  'request.jwt.claim.sub',
  'c1000000-0000-4000-8000-000000000001',
  true
);
set local role authenticated;
select pg_temp.assert_raises(
  $$select public.open_direct_communication_thread(
    'c3000000-0000-4000-8000-000000000006'
  )$$,
  'P0002',
  'offline learner Profile opened a direct thread'
);
select pg_temp.assert_raises(
  $$select public.open_direct_communication_thread(
    'c3000000-0000-4000-8000-000000000005'
  )$$,
  'P0002',
  'provisional Account opened a direct thread'
);
select pg_temp.assert_true(
  not exists (
    select 1
    from jsonb_array_elements(
      public.list_my_message_targets(null, 50) -> 'direct'
    ) as target(value)
    where target.value ->> 'learnerProfileId' in (
      'c3000000-0000-4000-8000-000000000005',
      'c3000000-0000-4000-8000-000000000006'
    )
  ),
  'offline/provisional learner leaked into direct targets'
);
reset role;

select set_config(
  'request.jwt.claim.sub',
  'c1000000-0000-4000-8000-000000000005',
  true
);
set local role authenticated;
select pg_temp.assert_raises(
  $$select public.list_my_communication_inbox(
    null::timestamptz,
    null::text,
    null::text,
    30
  )$$,
  'P0002',
  'provisional Account entered the Communication Center'
);
reset role;

-- Child Course membership is dynamic for both direct and group audiences.
-- Archiving the directory relation above correctly removed that learner from
-- future Course audiences; add them back explicitly before testing Course ACL.
insert into public.course_learner (course_id, learner_profile_id)
values (
  'c4000000-0000-4000-8000-000000000001',
  'c3000000-0000-4000-8000-000000000002'
)
on conflict do nothing;

select set_config(
  'request.jwt.claim.sub',
  'c1000000-0000-4000-8000-000000000001',
  true
);
set local role authenticated;
select public.open_course_communication_thread(
  'c4000000-0000-4000-8000-000000000001'
) as value \gset course_open_
select (:'course_open_value'::jsonb ->> 'id')::uuid as value
\gset course_thread_
select public.send_communication_message(
  :'course_thread_value'::uuid,
  'Old course history',
  'c7000000-0000-4000-8000-000000000002'
) as value \gset course_old_
select (:'course_old_value'::jsonb ->> 'id')::bigint as value
\gset course_old_message_
reset role;

select pg_temp.assert_true(
  public.communication_course_account_is_member(
    'c4000000-0000-4000-8000-000000000001',
    'c2000000-0000-4000-8000-000000000002'
  )
    and public.communication_course_account_is_member(
      'c4000000-0000-4000-8000-000000000001',
      'c2000000-0000-4000-8000-000000000003'
    ),
  'direct/group Course membership guard rejected current audience'
);
select pg_temp.assert_true(
  exists (
    select 1
    from public.communication_thread as thread
    where thread.id = :'course_thread_value'::uuid
      and thread.kind = 'course'
      and thread.course_id = 'c4000000-0000-4000-8000-000000000001'
  ),
  'course open returned a thread for another Course'
);

select set_config(
  'request.jwt.claim.sub',
  'c1000000-0000-4000-8000-000000000002',
  true
);
set local role authenticated;
select pg_temp.assert_true(
  jsonb_array_length(
    public.list_my_communication_messages(
      :'course_thread_value'::uuid,
      null,
      50
    ) -> 'items'
  ) = 1,
  'direct Course audience member cannot read history'
);
reset role;

select set_config(
  'request.jwt.claim.sub',
  'c1000000-0000-4000-8000-000000000003',
  true
);
set local role authenticated;
select pg_temp.assert_true(
  jsonb_array_length(
    public.list_my_communication_messages(
      :'course_thread_value'::uuid,
      null,
      50
    ) -> 'items'
  ) = 1,
  'group Course audience member cannot read history'
);
reset role;

delete from public.course_learner
where course_id = 'c4000000-0000-4000-8000-000000000001'
  and learner_profile_id = 'c3000000-0000-4000-8000-000000000002';

select set_config(
  'request.jwt.claim.sub',
  'c1000000-0000-4000-8000-000000000002',
  true
);
set local role authenticated;
select pg_temp.assert_raises(
  format(
    'select public.list_my_communication_messages(%L::uuid,null,50)',
    :'course_thread_value'
  ),
  'P0002',
  'departed direct Course member retained access'
);
reset role;

insert into public.course_learner (course_id, learner_profile_id)
values (
  'c4000000-0000-4000-8000-000000000001',
  'c3000000-0000-4000-8000-000000000002'
);
select set_config(
  'request.jwt.claim.sub',
  'c1000000-0000-4000-8000-000000000002',
  true
);
set local role authenticated;
select pg_temp.assert_true(
  jsonb_array_length(
    public.list_my_communication_messages(
      :'course_thread_value'::uuid,
      null,
      50
    ) -> 'items'
  ) = 1,
  'rejoined direct Course member did not recover full history'
);
reset role;

delete from public.learner_group_member
where learner_group_id = 'c6000000-0000-4000-8000-000000000001'
  and learner_profile_id = 'c3000000-0000-4000-8000-000000000003';

select set_config(
  'request.jwt.claim.sub',
  'c1000000-0000-4000-8000-000000000003',
  true
);
set local role authenticated;
select pg_temp.assert_raises(
  format(
    'select public.list_my_communication_messages(%L::uuid,null,50)',
    :'course_thread_value'
  ),
  'P0002',
  'departed group Course member retained access'
);
reset role;

insert into public.learner_group_member (
  learner_group_id,
  learner_profile_id
)
values (
  'c6000000-0000-4000-8000-000000000001',
  'c3000000-0000-4000-8000-000000000003'
);
select set_config(
  'request.jwt.claim.sub',
  'c1000000-0000-4000-8000-000000000003',
  true
);
set local role authenticated;
select pg_temp.assert_true(
  jsonb_array_length(
    public.list_my_communication_messages(
      :'course_thread_value'::uuid,
      null,
      50
    ) -> 'items'
  ) = 1,
  'rejoined group Course member did not recover full history'
);
reset role;

-- A future member sees all old history but starts with old unread=0. The next
-- message seeds its read baseline at the old cursor and becomes unread=1.
select set_config(
  'request.jwt.claim.sub',
  'c1000000-0000-4000-8000-000000000004',
  true
);
set local role authenticated;
select pg_temp.assert_raises(
  format(
    'select public.list_my_communication_messages(%L::uuid,null,50)',
    :'course_thread_value'
  ),
  'P0002',
  'future Course learner had access before joining'
);
reset role;

insert into public.course_learner (course_id, learner_profile_id)
values (
  'c4000000-0000-4000-8000-000000000001',
  'c3000000-0000-4000-8000-000000000004'
);

select set_config(
  'request.jwt.claim.sub',
  'c1000000-0000-4000-8000-000000000004',
  true
);
set local role authenticated;
select pg_temp.assert_true(
  jsonb_array_length(
    public.list_my_communication_messages(
      :'course_thread_value'::uuid,
      null,
      50
    ) -> 'items'
  ) = 1,
  'future Course member cannot see old history after joining'
);
select pg_temp.assert_true(
  exists (
    select 1
    from jsonb_array_elements(
      public.list_my_communication_inbox(
        null::timestamptz,
        null::text,
        null::text,
        30
      ) -> 'items'
    ) as item(value)
    where item.value ->> 'threadId' = :'course_thread_value'
      and (item.value ->> 'unreadCount')::integer = 0
      and (item.value ->> 'lastMessageId')::bigint
        = :'course_old_message_value'::bigint
  ),
  'new member old Course inbox baseline/last-message projection is wrong'
);
reset role;

select set_config(
  'request.jwt.claim.sub',
  'c1000000-0000-4000-8000-000000000001',
  true
);
set local role authenticated;
select public.send_communication_message(
  :'course_thread_value'::uuid,
  'New course message',
  'c7000000-0000-4000-8000-000000000003'
) as value \gset course_new_
select (:'course_new_value'::jsonb ->> 'id')::bigint as value
\gset course_new_message_
reset role;

select set_config(
  'request.jwt.claim.sub',
  'c1000000-0000-4000-8000-000000000004',
  true
);
set local role authenticated;
select pg_temp.assert_true(
  jsonb_array_length(
    public.list_my_communication_messages(
      :'course_thread_value'::uuid,
      null,
      50
    ) -> 'items'
  ) = 2,
  'future Course member lost old history after a new message'
);
select pg_temp.assert_true(
  exists (
    select 1
    from jsonb_array_elements(
      public.list_my_communication_inbox(
        null::timestamptz,
        null::text,
        null::text,
        30
      ) -> 'items'
    ) as item(value)
    where item.value ->> 'threadId' = :'course_thread_value'
      and (item.value ->> 'unreadCount')::integer = 1
      and (item.value ->> 'lastMessageId')::bigint
        = :'course_new_message_value'::bigint
  ),
  'new Course message unread/last-message inbox projection is wrong'
);
reset role;

-- Persisted assistant conversations are owner-only; user turns use the JWT
-- RPC while assistant turns require the trusted producer RPC.
select set_config(
  'request.jwt.claim.sub',
  'c1000000-0000-4000-8000-000000000001',
  true
);
set local role authenticated;
select public.create_my_assistant_conversation(
  'Acceptance AI',
  'c4000000-0000-4000-8000-000000000001',
  'c5000000-0000-4000-8000-000000000001'
) as value \gset assistant_conversation_
select (:'assistant_conversation_value'::jsonb ->> 'id')::uuid as value
\gset assistant_conversation_id_
select public.append_my_assistant_turn(
  :'assistant_conversation_id_value'::uuid,
  'Prepare tomorrow lesson',
  'c7000000-0000-4000-8000-000000000004'
) as value \gset assistant_user_
select (:'assistant_user_value'::jsonb ->> 'id')::bigint as value
\gset assistant_user_id_
select pg_temp.assert_true(
  public.append_my_assistant_turn(
    :'assistant_conversation_id_value'::uuid,
    'Prepare tomorrow lesson',
    'c7000000-0000-4000-8000-000000000004'
  ) = :'assistant_user_value'::jsonb,
  'assistant user-turn retry changed its projection'
);
select pg_temp.assert_raises(
  format(
    'select public.append_assistant_turn_admin(%L::uuid,%L::uuid,%L,%L::jsonb,%L,%L)',
    'c2000000-0000-4000-8000-000000000001',
    :'assistant_conversation_id_value',
    'Forbidden browser reply',
    '{}'::text,
    'interactive',
    'forbidden-browser-source'
  ),
  '42501',
  'authenticated executed the trusted assistant producer RPC'
);
reset role;

select set_config(
  'request.jwt.claim.sub',
  'c1000000-0000-4000-8000-000000000006',
  true
);
set local role authenticated;
select pg_temp.assert_raises(
  format(
    'select public.get_my_assistant_conversation(%L::uuid)',
    :'assistant_conversation_id_value'
  ),
  'P0002',
  'another Account read the assistant conversation'
);
select pg_temp.assert_raises(
  format(
    'select public.append_my_assistant_turn(%L::uuid,%L,%L::uuid)',
    :'assistant_conversation_id_value',
    'Outsider turn',
    'c7000000-0000-4000-8000-000000000005'
  ),
  'P0002',
  'another Account appended to the assistant conversation'
);
reset role;

set local role service_role;
select public.append_assistant_turn_admin(
  'c2000000-0000-4000-8000-000000000001',
  :'assistant_conversation_id_value'::uuid,
  'Prepared a proposal',
  jsonb_build_object(
    'replyToTurnId', :'assistant_user_id_value'::bigint,
    'reply', jsonb_build_object(
      'requestId', 'db-communication-test',
      'model', 'fixture-model',
      'provider', null,
      'usage', jsonb_build_object(
        'inputTokens', 10,
        'outputTokens', 5,
        'totalTokens', 15,
        'cachedInputTokens', 0,
        'reasoningTokens', 0
      ),
      'proposedAction', null,
      'quickReplies', '[]'::jsonb,
      'sharedHistoryUsed', false
    )
  ),
  'interactive',
  'db-test:user-turn-1'
) as value \gset assistant_reply_
select (:'assistant_reply_value'::jsonb ->> 'id')::bigint as value
\gset assistant_reply_id_
select pg_temp.assert_true(
  public.append_assistant_turn_admin(
    'c2000000-0000-4000-8000-000000000001',
    :'assistant_conversation_id_value'::uuid,
    'Prepared a proposal',
    :'assistant_reply_value'::jsonb -> 'payload',
    'interactive',
    'db-test:user-turn-1'
  ) = :'assistant_reply_value'::jsonb,
  'trusted assistant append retry changed its projection'
);
reset role;

select set_config(
  'request.jwt.claim.sub',
  'c1000000-0000-4000-8000-000000000001',
  true
);
set local role authenticated;
select pg_temp.assert_true(
  jsonb_array_length(
    public.list_my_assistant_turns(
      :'assistant_conversation_id_value'::uuid,
      null,
      50
    ) -> 'items'
  ) = 2
    and (
      public.get_my_assistant_conversation(
        :'assistant_conversation_id_value'::uuid
      ) ->> 'unreadCount'
    )::integer = 1,
  'owner assistant history/unread projection is wrong'
);
select public.mark_my_assistant_conversation_read(
  :'assistant_conversation_id_value'::uuid,
  :'assistant_reply_id_value'::bigint
) as value \gset assistant_read_
select pg_temp.assert_true(
  (:'assistant_read_value'::jsonb ->> 'unreadCount')::integer = 0
    and (:'assistant_read_value'::jsonb ->> 'markedThroughId')::bigint
      = :'assistant_reply_id_value'::bigint,
  'assistant read cursor did not clear the owner unread count'
);
reset role;

-- System notifications are trusted, recipient-bound, deduplicated and read in
-- cursor order. Another Account sees an empty feed.
set local role service_role;
select public.append_system_notification_admin(
  'c2000000-0000-4000-8000-000000000001',
  'course.acceptance_complete',
  'success',
  'Acceptance complete',
  'The isolated Communication Center test completed.',
  jsonb_build_object(
    'courseId', 'c4000000-0000-4000-8000-000000000001',
    'href', '/courses/c4000000-0000-4000-8000-000000000001'
  ),
  'db-communication:acceptance-complete',
  timestamptz '2026-08-16 06:00:00+00'
) as value \gset system_notification_
select (:'system_notification_value'::jsonb ->> 'id')::bigint as value
\gset system_notification_id_
select pg_temp.assert_true(
  public.append_system_notification_admin(
    'c2000000-0000-4000-8000-000000000001',
    'course.acceptance_complete',
    'success',
    'Acceptance complete',
    'The isolated Communication Center test completed.',
    :'system_notification_value'::jsonb -> 'payload',
    'db-communication:acceptance-complete',
    timestamptz '2026-08-16 06:00:00+00'
  ) = :'system_notification_value'::jsonb,
  'system notification dedupe retry changed its projection'
);
select pg_temp.assert_raises(
  $$select public.append_system_notification_admin(
    'c2000000-0000-4000-8000-000000000001',
    'course.acceptance_complete',
    'success',
    'Acceptance complete',
    'Conflicting body',
    '{}'::jsonb,
    'db-communication:acceptance-complete',
    timestamptz '2026-08-16 06:00:00+00'
  )$$,
  '23505',
  'system notification dedupe key accepted different content'
);
reset role;

select set_config(
  'request.jwt.claim.sub',
  'c1000000-0000-4000-8000-000000000006',
  true
);
set local role authenticated;
select pg_temp.assert_true(
  jsonb_array_length(
    public.list_my_system_notifications(null, 50) -> 'items'
  ) = 0,
  'system notification leaked to another Account'
);
reset role;

select set_config(
  'request.jwt.claim.sub',
  'c1000000-0000-4000-8000-000000000001',
  true
);
set local role authenticated;
select pg_temp.assert_true(
  jsonb_array_length(
    public.list_my_system_notifications(null, 50) -> 'items'
  ) = 1
    and not (
      public.list_my_system_notifications(null, 50)
        -> 'items' -> 0 ? 'recipientAccountId'
    ),
  'recipient system feed is missing or leaks its Account id'
);
select public.mark_my_system_notifications_read(
  :'system_notification_id_value'::bigint
) as value \gset system_read_
select pg_temp.assert_true(
  (:'system_read_value'::jsonb ->> 'markedThroughId')::bigint
      = :'system_notification_id_value'::bigint
    and (:'system_read_value'::jsonb ->> 'unreadCount')::integer = 0,
  'system notification read cursor did not clear unread state'
);
reset role;

-- A signed assistant schedule proposal is compared and applied inside one DB
-- transaction. Create expects no open Run plus the exact effective Course
-- audience; reschedule expects the exact open Run updated_at and draft roster.
select set_config(
  'request.jwt.claim.sub',
  'c1000000-0000-4000-8000-000000000001',
  true
);
set local role authenticated;
select scheduled.id, scheduled.updated_at
from public.schedule_lesson_run_if_unchanged(
  'c5000000-0000-4000-8000-000000000001',
  timestamptz '2026-08-17 09:00:00+00',
  45,
  null,
  null,
  array[
    'c3000000-0000-4000-8000-000000000002'::uuid,
    'c3000000-0000-4000-8000-000000000003'::uuid,
    'c3000000-0000-4000-8000-000000000004'::uuid
  ]
) as scheduled
\gset atomic_created_
select pg_temp.assert_true(
  (
    select array_agg(
      record.learner_profile_id
      order by record.learner_profile_id
    )
    from public.learning_record as record
    where record.lesson_run_id = :'atomic_created_id'::uuid
      and record.occurred_at is null
  ) = array[
    'c3000000-0000-4000-8000-000000000002'::uuid,
    'c3000000-0000-4000-8000-000000000003'::uuid,
    'c3000000-0000-4000-8000-000000000004'::uuid
  ],
  'atomic create did not persist the exact proposal audience'
);
select pg_temp.assert_raises(
  $$select public.schedule_lesson_run_if_unchanged(
    'c5000000-0000-4000-8000-000000000001',
    timestamptz '2026-08-17 10:00:00+00',
    45,
    null,
    null,
    array[
      'c3000000-0000-4000-8000-000000000002'::uuid,
      'c3000000-0000-4000-8000-000000000003'::uuid,
      'c3000000-0000-4000-8000-000000000004'::uuid
    ]
  )$$,
  '55000',
  'atomic create accepted a proposal after an open Run appeared'
);
reset role;

-- Force a different state token without relying on transaction-stable now().
set local session_replication_role = replica;
update public.lesson_run
set scheduled_at = timestamptz '2026-08-17 09:30:00+00',
    updated_at = clock_timestamp() + interval '1 second'
where id = :'atomic_created_id'::uuid;
set local session_replication_role = origin;

select set_config(
  'request.jwt.claim.sub',
  'c1000000-0000-4000-8000-000000000001',
  true
);
set local role authenticated;
select pg_temp.assert_raises(
  format(
    $statement$select public.schedule_lesson_run_if_unchanged(
      'c5000000-0000-4000-8000-000000000001',
      timestamptz '2026-08-17 11:00:00+00',
      50,
      %L::uuid,
      %L::timestamptz,
      array[
        'c3000000-0000-4000-8000-000000000002'::uuid,
        'c3000000-0000-4000-8000-000000000003'::uuid,
        'c3000000-0000-4000-8000-000000000004'::uuid
      ]
    )$statement$,
    :'atomic_created_id',
    :'atomic_created_updated_at'
  ),
  '55000',
  'atomic reschedule accepted a changed Run state token'
);
reset role;

select updated_at
from public.lesson_run
where id = :'atomic_created_id'::uuid
\gset atomic_changed_

select set_config(
  'request.jwt.claim.sub',
  'c1000000-0000-4000-8000-000000000001',
  true
);
set local role authenticated;
select scheduled.id, scheduled.updated_at
from public.schedule_lesson_run_if_unchanged(
  'c5000000-0000-4000-8000-000000000001',
  timestamptz '2026-08-17 11:00:00+00',
  50,
  :'atomic_created_id'::uuid,
  :'atomic_changed_updated_at'::timestamptz,
  array[
    'c3000000-0000-4000-8000-000000000002'::uuid,
    'c3000000-0000-4000-8000-000000000003'::uuid,
    'c3000000-0000-4000-8000-000000000004'::uuid
  ]
) as scheduled
\gset atomic_rescheduled_
select pg_temp.assert_true(
  :'atomic_rescheduled_id'::uuid = :'atomic_created_id'::uuid,
  'atomic reschedule replaced the expected open Run'
);
reset role;

delete from public.learning_record
where lesson_run_id = :'atomic_created_id'::uuid
  and learner_profile_id = 'c3000000-0000-4000-8000-000000000004';

select set_config(
  'request.jwt.claim.sub',
  'c1000000-0000-4000-8000-000000000001',
  true
);
set local role authenticated;
select pg_temp.assert_raises(
  format(
    $statement$select public.schedule_lesson_run_if_unchanged(
      'c5000000-0000-4000-8000-000000000001',
      timestamptz '2026-08-17 12:00:00+00',
      55,
      %L::uuid,
      %L::timestamptz,
      array[
        'c3000000-0000-4000-8000-000000000002'::uuid,
        'c3000000-0000-4000-8000-000000000003'::uuid,
        'c3000000-0000-4000-8000-000000000004'::uuid
      ]
    )$statement$,
    :'atomic_rescheduled_id',
    :'atomic_rescheduled_updated_at'
  ),
  '55000',
  'atomic reschedule accepted a changed draft roster'
);
reset role;

insert into public.learning_record (
  learner_profile_id,
  recorded_by_account_id,
  lesson_run_id,
  source_course_id,
  source_lesson_id
)
values (
  'c3000000-0000-4000-8000-000000000004',
  'c2000000-0000-4000-8000-000000000001',
  :'atomic_created_id'::uuid,
  'c4000000-0000-4000-8000-000000000001',
  'c5000000-0000-4000-8000-000000000001'
);

select set_config(
  'request.jwt.claim.sub',
  'c1000000-0000-4000-8000-000000000001',
  true
);
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub', 'c1000000-0000-4000-8000-000000000001',
    'session_id', 'c1100000-0000-4000-8000-000000000001',
    'role', 'authenticated'
  )::text,
  true
);
set local role authenticated;
select public.cancel_lesson_run(:'atomic_created_id'::uuid);
reset role;

delete from public.course_learner
where course_id = 'c4000000-0000-4000-8000-000000000001'
  and learner_profile_id = 'c3000000-0000-4000-8000-000000000004';

select set_config(
  'request.jwt.claim.sub',
  'c1000000-0000-4000-8000-000000000001',
  true
);
set local role authenticated;
select pg_temp.assert_raises(
  $$select public.schedule_lesson_run_if_unchanged(
    'c5000000-0000-4000-8000-000000000001',
    timestamptz '2026-08-18 09:00:00+00',
    45,
    null,
    null,
    array[
      'c3000000-0000-4000-8000-000000000002'::uuid,
      'c3000000-0000-4000-8000-000000000003'::uuid,
      'c3000000-0000-4000-8000-000000000004'::uuid
    ]
  )$$,
  '55000',
  'atomic create accepted a changed effective Course audience'
);
select pg_temp.assert_raises(
  $$select public.schedule_lesson_run_if_unchanged(
    'c5000000-0000-4000-8000-000000000001',
    timestamptz '2026-08-18 09:00:00+00',
    45,
    null,
    null,
    array[
      'c3000000-0000-4000-8000-000000000002'::uuid,
      'c3000000-0000-4000-8000-000000000002'::uuid,
      'c3000000-0000-4000-8000-000000000003'::uuid
    ]
  )$$,
  '22023',
  'atomic schedule accepted duplicate expected learner ids'
);
reset role;

insert into public.course_learner (course_id, learner_profile_id)
values (
  'c4000000-0000-4000-8000-000000000001',
  'c3000000-0000-4000-8000-000000000004'
);

-- Explicitly prove every deterministic fixture is still inside this open
-- transaction before the mandatory rollback.
set constraints all immediate;

select pg_temp.assert_true(
  exists (
    select 1
    from public.account
    where id = 'c2000000-0000-4000-8000-000000000001'
  )
    and exists (
      select 1
      from public.communication_thread
      where id = :'direct_thread_value'::uuid
    )
    and exists (
      select 1
      from public.assistant_conversation
      where id = :'assistant_conversation_id_value'::uuid
    ),
  'acceptance fixtures escaped or disappeared before rollback'
);

rollback;
SQL

echo "Communication database acceptance passed; all fixtures rolled back."
