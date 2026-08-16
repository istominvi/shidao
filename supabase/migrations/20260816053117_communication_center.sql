begin;

-- Unified product entry point, separate persistence contracts. Human messages,
-- assistant turns and trusted system facts deliberately do not share one
-- polymorphic message table.

do $preflight$
declare
  v_existing_objects integer;
begin
  if to_regclass('public.account') is null
    or to_regclass('public.learner_profile') is null
    or to_regclass('public.teacher_learner') is null
    or to_regclass('public.course') is null
    or to_regclass('public.course_learner') is null
    or to_regclass('public.course_learner_group') is null
    or to_regclass('public.learner_group_member') is null
    or to_regclass('public.lesson') is null
    or to_regclass('public.lesson_run') is null
    or to_regclass('public.learning_record') is null
    or to_regprocedure('public.current_account_id()') is null
    or to_regprocedure(
      'public.complete_lesson_run_v2(uuid,jsonb,text,timestamp with time zone,integer)'
    ) is null
    or not exists (
      select 1
      from pg_trigger as trigger
      where trigger.tgrelid = 'public.lesson_run'::regclass
        and trigger.tgname = 'trg_lesson_run_updated_at'
        and not trigger.tgisinternal
        and trigger.tgenabled = 'O'
    )
  then
    raise exception 'shidao_communication_schema_sanity_check_failed'
      using errcode = 'P0001';
  end if;

  select count(*)
  into v_existing_objects
  from (
    select to_regclass(object_name) is not null as present
    from unnest(array[
      'public.communication_thread',
      'public.communication_message',
      'public.communication_read_state',
      'public.assistant_conversation',
      'public.assistant_turn',
      'public.system_notification'
    ]) as object_name
    union all
    select to_regprocedure(object_name) is not null
    from unnest(array[
      'public.list_my_communication_inbox(timestamp with time zone,text,text,integer)',
      'public.list_my_message_targets(text,integer)',
      'public.open_direct_communication_thread(uuid)',
      'public.open_course_communication_thread(uuid)',
      'public.list_my_communication_messages(uuid,bigint,integer)',
      'public.send_communication_message(uuid,text,uuid)',
      'public.mark_communication_thread_read(uuid,bigint)',
      'public.list_my_assistant_conversations(boolean,integer)',
      'public.get_my_assistant_conversation(uuid)',
      'public.create_my_assistant_conversation(text,uuid,uuid)',
      'public.update_my_assistant_conversation(uuid,text,boolean)',
      'public.list_my_assistant_turns(uuid,bigint,integer)',
      'public.append_my_assistant_turn(uuid,text,uuid)',
      'public.mark_my_assistant_conversation_read(uuid,bigint)',
      'public.append_assistant_turn_admin(uuid,uuid,text,jsonb,text,text)',
      'public.list_my_system_notifications(bigint,integer)',
      'public.mark_my_system_notifications_read(bigint)',
      'public.append_system_notification_admin(uuid,text,text,text,text,jsonb,text,timestamp with time zone)'
    ]) as object_name
  ) as objects
  where objects.present;

  if v_existing_objects <> 0
    or exists (
      select 1
      from pg_trigger as trigger
      where trigger.tgrelid = 'public.lesson_run'::regclass
        and trigger.tgname = 'trg_lesson_run_communication_notifications'
        and not trigger.tgisinternal
    )
  then
    raise exception 'shidao_communication_objects_already_exist'
      using errcode = '42P07';
  end if;
end
$preflight$;

create table public.communication_thread (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  direct_account_low_id uuid,
  direct_account_high_id uuid,
  course_id uuid,
  last_message_id bigint,
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  constraint communication_thread_kind_check check (
    kind in ('direct', 'course')
  ),
  constraint communication_thread_shape_check check (
    (
      kind = 'direct'
      and direct_account_low_id is not null
      and direct_account_high_id is not null
      and direct_account_low_id < direct_account_high_id
      and course_id is null
    )
    or (
      kind = 'course'
      and direct_account_low_id is null
      and direct_account_high_id is null
      and course_id is not null
    )
  ),
  constraint communication_thread_last_message_shape_check check (
    (last_message_id is null and last_message_at is null)
    or (last_message_id is not null and last_message_at is not null)
  ),
  constraint communication_thread_direct_low_fkey foreign key (
    direct_account_low_id
  ) references public.account(id) on delete cascade,
  constraint communication_thread_direct_high_fkey foreign key (
    direct_account_high_id
  ) references public.account(id) on delete cascade,
  constraint communication_thread_course_fkey foreign key (course_id)
    references public.course(id) on delete cascade
);

create unique index communication_thread_direct_pair_unique
  on public.communication_thread (
    direct_account_low_id,
    direct_account_high_id
  )
  where kind = 'direct';

create unique index communication_thread_course_unique
  on public.communication_thread (course_id)
  where kind = 'course';

create index communication_thread_direct_low_activity_idx
  on public.communication_thread (
    direct_account_low_id,
    last_message_at desc,
    id
  )
  where kind = 'direct' and last_message_id is not null;

create index communication_thread_direct_high_activity_idx
  on public.communication_thread (
    direct_account_high_id,
    last_message_at desc,
    id
  )
  where kind = 'direct' and last_message_id is not null;

create table public.communication_message (
  id bigint generated always as identity primary key,
  thread_id uuid not null references public.communication_thread(id)
    on delete cascade,
  sender_account_id uuid not null references public.account(id)
    on delete cascade,
  client_message_id uuid not null,
  body text not null,
  created_at timestamptz not null default now(),
  constraint communication_message_body_check check (
    btrim(body) <> '' and char_length(body) <= 6000
  ),
  constraint communication_message_sender_client_unique unique (
    sender_account_id,
    client_message_id
  )
);

create index communication_message_thread_cursor_idx
  on public.communication_message (thread_id, id desc);

create table public.communication_read_state (
  thread_id uuid not null references public.communication_thread(id)
    on delete cascade,
  account_id uuid not null references public.account(id) on delete cascade,
  last_read_message_id bigint not null default 0,
  updated_at timestamptz not null default now(),
  primary key (thread_id, account_id),
  constraint communication_read_state_cursor_check check (
    last_read_message_id >= 0
  )
);

create index communication_read_state_account_idx
  on public.communication_read_state (account_id, thread_id);

create table public.assistant_conversation (
  id uuid primary key default gen_random_uuid(),
  owner_account_id uuid not null references public.account(id)
    on delete cascade,
  title text not null,
  context_course_id uuid references public.course(id) on delete set null,
  context_lesson_id uuid references public.lesson(id) on delete set null,
  last_turn_id bigint,
  last_assistant_turn_id bigint,
  last_read_assistant_turn_id bigint not null default 0,
  last_turn_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint assistant_conversation_title_check check (
    btrim(title) <> '' and char_length(title) <= 160
  ),
  constraint assistant_conversation_cursor_check check (
    coalesce(last_turn_id, 0) >= 0
    and coalesce(last_assistant_turn_id, 0) >= 0
    and last_read_assistant_turn_id >= 0
    and last_read_assistant_turn_id <= coalesce(last_assistant_turn_id, 0)
  ),
  constraint assistant_conversation_last_turn_shape_check check (
    (last_turn_id is null and last_turn_at is null)
    or (last_turn_id is not null and last_turn_at is not null)
  )
);

create index assistant_conversation_owner_activity_idx
  on public.assistant_conversation (
    owner_account_id,
    last_turn_at desc nulls last,
    created_at desc,
    id
  )
  where archived_at is null;

create table public.assistant_turn (
  id bigint generated always as identity primary key,
  conversation_id uuid not null references public.assistant_conversation(id)
    on delete cascade,
  role text not null,
  delivery_kind text not null default 'interactive',
  body text not null,
  payload jsonb not null default '{}'::jsonb,
  client_turn_id uuid,
  source_key text,
  created_at timestamptz not null default now(),
  constraint assistant_turn_role_check check (role in ('user', 'assistant')),
  constraint assistant_turn_delivery_kind_check check (
    delivery_kind in ('interactive', 'background_result', 'insight')
  ),
  constraint assistant_turn_role_shape_check check (
    (
      role = 'user'
      and delivery_kind = 'interactive'
      and client_turn_id is not null
      and source_key is null
      and payload = '{}'::jsonb
    )
    or (
      role = 'assistant'
      and client_turn_id is null
    )
  ),
  constraint assistant_turn_body_check check (
    btrim(body) <> '' and char_length(body) <= 6000
  ),
  constraint assistant_turn_payload_check check (
    jsonb_typeof(payload) = 'object'
    and pg_column_size(payload) <= 65536
  ),
  constraint assistant_turn_source_key_check check (
    source_key is null
    or (btrim(source_key) <> '' and char_length(source_key) <= 240)
  )
);

create index assistant_turn_conversation_cursor_idx
  on public.assistant_turn (conversation_id, id desc);

create unique index assistant_turn_client_unique
  on public.assistant_turn (conversation_id, client_turn_id)
  where client_turn_id is not null;

create unique index assistant_turn_source_unique
  on public.assistant_turn (conversation_id, source_key)
  where source_key is not null;

create table public.system_notification (
  id bigint generated always as identity primary key,
  recipient_account_id uuid not null references public.account(id)
    on delete cascade,
  event_type text not null,
  severity text not null default 'info',
  title text not null,
  body text not null,
  payload jsonb not null default '{}'::jsonb,
  dedupe_key text not null,
  occurred_at timestamptz not null default now(),
  read_at timestamptz,
  constraint system_notification_event_type_check check (
    event_type ~ '^[a-z][a-z0-9_.]{1,99}$'
  ),
  constraint system_notification_severity_check check (
    severity in ('info', 'success', 'warning', 'error', 'action_required')
  ),
  constraint system_notification_title_check check (
    btrim(title) <> '' and char_length(title) <= 160
  ),
  constraint system_notification_body_check check (
    btrim(body) <> '' and char_length(body) <= 6000
  ),
  constraint system_notification_payload_check check (
    jsonb_typeof(payload) = 'object'
    and pg_column_size(payload) <= 16384
  ),
  constraint system_notification_dedupe_key_check check (
    btrim(dedupe_key) <> '' and char_length(dedupe_key) <= 240
  ),
  constraint system_notification_read_at_check check (
    read_at is null or read_at >= occurred_at
  ),
  constraint system_notification_recipient_dedupe_unique unique (
    recipient_account_id,
    dedupe_key
  )
);

create index system_notification_recipient_cursor_idx
  on public.system_notification (recipient_account_id, id desc);

create index system_notification_recipient_activity_idx
  on public.system_notification (
    recipient_account_id,
    occurred_at desc,
    id desc
  );

create index system_notification_unread_idx
  on public.system_notification (
    recipient_account_id,
    occurred_at desc,
    id desc
  )
  where read_at is null;

create index system_notification_lesson_run_audience_idx
  on public.system_notification (
    event_type,
    ((payload ->> 'lessonRunId')),
    id desc
  )
  where event_type in (
    'lesson_run.scheduled',
    'lesson_run.rescheduled'
  );

alter table public.communication_thread enable row level security;
alter table public.communication_message enable row level security;
alter table public.communication_read_state enable row level security;
alter table public.assistant_conversation enable row level security;
alter table public.assistant_turn enable row level security;
alter table public.system_notification enable row level security;

revoke all on table
  public.communication_thread,
  public.communication_message,
  public.communication_read_state,
  public.assistant_conversation,
  public.assistant_turn,
  public.system_notification
from public, anon, authenticated;

grant all on table
  public.communication_thread,
  public.communication_message,
  public.communication_read_state,
  public.assistant_conversation,
  public.assistant_turn,
  public.system_notification
to postgres, service_role;

revoke all on sequence
  public.communication_message_id_seq,
  public.assistant_turn_id_seq,
  public.system_notification_id_seq
from public, anon, authenticated;

grant all on sequence
  public.communication_message_id_seq,
  public.assistant_turn_id_seq,
  public.system_notification_id_seq
to postgres, service_role;

create function public.communication_current_active_account_id()
returns uuid
language sql
stable
security definer
set search_path to ''
as $$
  select account.id
  from public.account as account
  where account.auth_user_id = (select auth.uid())
    and account.status = 'active'
  limit 1;
$$;

create function public.communication_direct_link_is_active(
  p_account_a_id uuid,
  p_account_b_id uuid
)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select p_account_a_id is not null
    and p_account_b_id is not null
    and p_account_a_id <> p_account_b_id
    and exists (
      select 1
      from public.teacher_learner as relation
      join public.learner_profile as profile
        on profile.id = relation.learner_profile_id
      join public.account as teacher_account
        on teacher_account.id = relation.teacher_account_id
       and teacher_account.status = 'active'
      join public.account as learner_account
        on learner_account.id = profile.account_id
       and learner_account.status = 'active'
      where relation.archived_at is null
        and (
          (
            relation.teacher_account_id = p_account_a_id
            and profile.account_id = p_account_b_id
          )
          or (
            relation.teacher_account_id = p_account_b_id
            and profile.account_id = p_account_a_id
          )
        )
    );
$$;

create function public.communication_course_account_is_member(
  p_course_id uuid,
  p_account_id uuid
)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select exists (
    select 1
    from public.course as course
    join public.account as owner_account
      on owner_account.id = course.owner_account_id
     and owner_account.status = 'active'
    where course.id = p_course_id
      and course.learning_audience = 'children'
      and (
        course.owner_account_id = p_account_id
        or exists (
          select 1
          from public.learner_profile as profile
          join public.account as learner_account
            on learner_account.id = profile.account_id
           and learner_account.status = 'active'
          join public.teacher_learner as relation
            on relation.teacher_account_id = course.owner_account_id
           and relation.learner_profile_id = profile.id
           and relation.archived_at is null
          where profile.account_id = p_account_id
            and (
              exists (
                select 1
                from public.course_learner as direct
                where direct.course_id = course.id
                  and direct.learner_profile_id = profile.id
              )
              or exists (
                select 1
                from public.course_learner_group as course_group
                join public.learner_group_member as member
                  on member.learner_group_id = course_group.learner_group_id
                where course_group.course_id = course.id
                  and member.learner_profile_id = profile.id
              )
            )
        )
      )
  );
$$;

create function public.communication_thread_is_accessible(
  p_thread_id uuid,
  p_account_id uuid,
  p_for_write boolean default false
)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select exists (
    select 1
    from public.communication_thread as thread
    where thread.id = p_thread_id
      and exists (
        select 1
        from public.account as actor
        where actor.id = p_account_id
          and actor.status = 'active'
      )
      and (
        (
          thread.kind = 'direct'
          and p_account_id in (
            thread.direct_account_low_id,
            thread.direct_account_high_id
          )
          and public.communication_direct_link_is_active(
            thread.direct_account_low_id,
            thread.direct_account_high_id
          )
        )
        or (
          thread.kind = 'course'
          and public.communication_course_account_is_member(
            thread.course_id,
            p_account_id
          )
          and (
            not p_for_write
            or exists (
              select 1
              from public.course as course
              where course.id = thread.course_id
                and course.archived_at is null
            )
          )
        )
      )
  );
$$;

create function public.communication_person_label(
  p_viewer_account_id uuid,
  p_person_account_id uuid
)
returns text
language sql
stable
security definer
set search_path to ''
as $$
  select case
    when p_viewer_account_id = p_person_account_id then person.display_name
    else coalesce(
      (
        select relation.display_name
        from public.teacher_learner as relation
        join public.learner_profile as profile
          on profile.id = relation.learner_profile_id
        where relation.teacher_account_id = p_viewer_account_id
          and profile.account_id = p_person_account_id
          and relation.archived_at is null
        limit 1
      ),
      person.display_name
    )
  end
  from public.account as person
  where person.id = p_person_account_id;
$$;

create function public.communication_thread_projection(
  p_thread_id uuid,
  p_actor_account_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path to ''
as $$
  select jsonb_build_object(
    'id', thread.id,
    'kind', thread.kind,
    'title', case
      when thread.kind = 'course' then course.title
      else public.communication_person_label(
        p_actor_account_id,
        case
          when thread.direct_account_low_id = p_actor_account_id
            then thread.direct_account_high_id
          else thread.direct_account_low_id
        end
      )
    end,
    'courseId', case when thread.kind = 'course' then thread.course_id else null end,
    'directLearnerProfileId', case
      when thread.kind = 'direct' then (
        select profile.id
        from public.teacher_learner as relation
        join public.learner_profile as profile
          on profile.id = relation.learner_profile_id
        where relation.teacher_account_id = p_actor_account_id
          and relation.archived_at is null
          and profile.account_id = case
            when thread.direct_account_low_id = p_actor_account_id
              then thread.direct_account_high_id
            else thread.direct_account_low_id
          end
        limit 1
      )
      else null
    end,
    'preview', message.body,
    'lastMessageId', thread.last_message_id,
    'lastActivityAt', coalesce(thread.last_message_at, thread.created_at),
    'canSend', public.communication_thread_is_accessible(
      thread.id,
      p_actor_account_id,
      true
    ),
    'unreadCount', case
      when read_state.account_id is null then 0
      else (
        select count(*)
        from public.communication_message as unread_message
        where unread_message.thread_id = thread.id
          and unread_message.id > read_state.last_read_message_id
          and unread_message.sender_account_id <> p_actor_account_id
      )
    end
  )
  from public.communication_thread as thread
  left join public.course as course on course.id = thread.course_id
  left join public.communication_message as message
    on message.id = thread.last_message_id
   and message.thread_id = thread.id
  left join public.communication_read_state as read_state
    on read_state.thread_id = thread.id
   and read_state.account_id = p_actor_account_id
  where thread.id = p_thread_id
    and public.communication_thread_is_accessible(
      thread.id,
      p_actor_account_id,
      false
    );
$$;

create function public.recompute_communication_thread_after_message_delete()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_latest public.communication_message%rowtype;
  v_has_latest boolean;
begin
  select message.*
  into v_latest
  from public.communication_message as message
  where message.thread_id = old.thread_id
  order by message.id desc
  limit 1;

  v_has_latest := found;

  update public.communication_thread as thread
  set last_message_id = case when v_has_latest then v_latest.id else null end,
      last_message_at = case
        when v_has_latest then v_latest.created_at
        else null
      end
  where thread.id = old.thread_id
    and thread.last_message_id = old.id;

  return null;
end
$$;

create trigger trg_communication_message_recompute_thread_after_delete
after delete on public.communication_message
for each row
execute function public.recompute_communication_thread_after_message_delete();

create function public.communication_message_projection(
  p_message_id bigint,
  p_actor_account_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path to ''
as $$
  select jsonb_build_object(
    'id', message.id,
    'threadId', message.thread_id,
    'senderLabel', public.communication_person_label(
      p_actor_account_id,
      message.sender_account_id
    ),
    'body', message.body,
    'createdAt', message.created_at,
    'isOwn', message.sender_account_id = p_actor_account_id
  )
  from public.communication_message as message
  where message.id = p_message_id
    and public.communication_thread_is_accessible(
      message.thread_id,
      p_actor_account_id,
      false
    );
$$;

create function public.communication_seed_read_states(
  p_thread_id uuid,
  p_baseline_message_id bigint
)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_thread public.communication_thread%rowtype;
begin
  select thread.*
  into v_thread
  from public.communication_thread as thread
  where thread.id = p_thread_id;

  if not found then
    return;
  end if;

  if v_thread.kind = 'direct' then
    insert into public.communication_read_state (
      thread_id,
      account_id,
      last_read_message_id
    )
    values
      (
        v_thread.id,
        v_thread.direct_account_low_id,
        greatest(coalesce(p_baseline_message_id, 0), 0)
      ),
      (
        v_thread.id,
        v_thread.direct_account_high_id,
        greatest(coalesce(p_baseline_message_id, 0), 0)
      )
    on conflict (thread_id, account_id) do nothing;
  else
    insert into public.communication_read_state (
      thread_id,
      account_id,
      last_read_message_id
    )
    select
      v_thread.id,
      participant.account_id,
      greatest(coalesce(p_baseline_message_id, 0), 0)
    from (
      select course.owner_account_id as account_id
      from public.course as course
      join public.account as owner_account
        on owner_account.id = course.owner_account_id
       and owner_account.status = 'active'
      where course.id = v_thread.course_id
        and course.learning_audience = 'children'
      union
      select learner_account.id
      from public.course as course
      join public.teacher_learner as relation
        on relation.teacher_account_id = course.owner_account_id
       and relation.archived_at is null
      join public.learner_profile as profile
        on profile.id = relation.learner_profile_id
      join public.account as learner_account
        on learner_account.id = profile.account_id
       and learner_account.status = 'active'
      where course.id = v_thread.course_id
        and course.learning_audience = 'children'
        and (
          exists (
            select 1
            from public.course_learner as direct
            where direct.course_id = course.id
              and direct.learner_profile_id = profile.id
          )
          or exists (
            select 1
            from public.course_learner_group as course_group
            join public.learner_group_member as member
              on member.learner_group_id = course_group.learner_group_id
            where course_group.course_id = course.id
              and member.learner_profile_id = profile.id
          )
        )
    ) as participant
    on conflict (thread_id, account_id) do nothing;
  end if;
end
$$;

create function public.open_direct_communication_thread(
  p_learner_profile_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_actor_account_id uuid := public.communication_current_active_account_id();
  v_profile_id uuid;
  v_other_account_id uuid;
  v_low_account_id uuid;
  v_high_account_id uuid;
  v_thread_id uuid;
begin
  if v_actor_account_id is null or p_learner_profile_id is null then
    raise exception 'communication_target_not_found' using errcode = 'P0002';
  end if;

  v_profile_id := public.resolve_teacher_learner_profile_alias(
    (select auth.uid()),
    p_learner_profile_id
  );

  select profile.account_id
  into v_other_account_id
  from public.teacher_learner as relation
  join public.learner_profile as profile
    on profile.id = relation.learner_profile_id
  join public.account as learner_account
    on learner_account.id = profile.account_id
   and learner_account.status = 'active'
  where relation.teacher_account_id = v_actor_account_id
    and relation.learner_profile_id = v_profile_id
    and relation.archived_at is null;

  if not found or v_other_account_id = v_actor_account_id then
    raise exception 'communication_target_not_found' using errcode = 'P0002';
  end if;

  v_low_account_id := least(v_actor_account_id, v_other_account_id);
  v_high_account_id := greatest(v_actor_account_id, v_other_account_id);

  perform account.id
  from public.account as account
  where account.id in (v_low_account_id, v_high_account_id)
    and account.status = 'active'
  order by account.id
  for key share;

  if not public.communication_direct_link_is_active(
    v_low_account_id,
    v_high_account_id
  ) then
    raise exception 'communication_target_not_found' using errcode = 'P0002';
  end if;

  insert into public.communication_thread (
    kind,
    direct_account_low_id,
    direct_account_high_id
  )
  values ('direct', v_low_account_id, v_high_account_id)
  on conflict (direct_account_low_id, direct_account_high_id)
    where kind = 'direct'
  do nothing;

  select thread.id
  into v_thread_id
  from public.communication_thread as thread
  where thread.kind = 'direct'
    and thread.direct_account_low_id = v_low_account_id
    and thread.direct_account_high_id = v_high_account_id;

  perform public.communication_seed_read_states(v_thread_id, 0);

  return public.communication_thread_projection(
    v_thread_id,
    v_actor_account_id
  );
end
$$;

create function public.open_course_communication_thread(p_course_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_actor_account_id uuid := public.communication_current_active_account_id();
  v_thread_id uuid;
begin
  if v_actor_account_id is null or p_course_id is null then
    raise exception 'communication_course_not_found' using errcode = 'P0002';
  end if;

  perform course.id
  from public.course as course
  join public.account as owner_account
    on owner_account.id = course.owner_account_id
   and owner_account.status = 'active'
  where course.id = p_course_id
    and course.learning_audience = 'children'
  for key share of course;

  if not found
    or not public.communication_course_account_is_member(
      p_course_id,
      v_actor_account_id
    )
  then
    raise exception 'communication_course_not_found' using errcode = 'P0002';
  end if;

  insert into public.communication_thread (kind, course_id)
  values ('course', p_course_id)
  on conflict (course_id) where kind = 'course' do nothing;

  select thread.id
  into v_thread_id
  from public.communication_thread as thread
  where thread.kind = 'course'
    and thread.course_id = p_course_id;

  return public.communication_thread_projection(
    v_thread_id,
    v_actor_account_id
  );
end
$$;

create function public.list_my_message_targets(
  p_q text default null,
  p_limit integer default 50
)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v_actor_account_id uuid := public.communication_current_active_account_id();
  v_query text := lower(btrim(coalesce(p_q, '')));
  v_direct jsonb;
  v_courses jsonb;
begin
  if v_actor_account_id is null then
    raise exception 'communication_account_not_found' using errcode = 'P0002';
  end if;

  if p_limit is null or p_limit < 1 or p_limit > 50
    or char_length(v_query) > 160
  then
    raise exception 'communication_target_query_invalid' using errcode = '22023';
  end if;

  select coalesce(jsonb_agg(target.item order by target.label, target.profile_id), '[]'::jsonb)
  into v_direct
  from (
    select
      relation.display_name as label,
      profile.id as profile_id,
      jsonb_build_object(
        'learnerProfileId', profile.id,
        'title', relation.display_name,
        'existingThreadId', thread.id
      ) as item
    from public.teacher_learner as relation
    join public.learner_profile as profile
      on profile.id = relation.learner_profile_id
    join public.account as learner_account
      on learner_account.id = profile.account_id
     and learner_account.status = 'active'
    left join public.communication_thread as thread
      on thread.kind = 'direct'
     and thread.direct_account_low_id = least(
       v_actor_account_id,
       learner_account.id
     )
     and thread.direct_account_high_id = greatest(
       v_actor_account_id,
       learner_account.id
     )
    where relation.teacher_account_id = v_actor_account_id
      and relation.archived_at is null
      and learner_account.id <> v_actor_account_id
      and (
        v_query = ''
        or lower(relation.display_name) like '%' || v_query || '%'
      )
    order by relation.display_name, profile.id
    limit p_limit
  ) as target;

  select coalesce(jsonb_agg(target.item order by target.title, target.course_id), '[]'::jsonb)
  into v_courses
  from (
    select
      course.title,
      course.id as course_id,
      jsonb_build_object(
        'courseId', course.id,
        'title', course.title,
        'existingThreadId', thread.id
      ) as item
    from public.course as course
    left join public.communication_thread as thread
      on thread.kind = 'course'
     and thread.course_id = course.id
    where course.learning_audience = 'children'
      and course.archived_at is null
      and public.communication_course_account_is_member(
        course.id,
        v_actor_account_id
      )
      and (
        v_query = ''
        or lower(course.title) like '%' || v_query || '%'
      )
    order by course.title, course.id
    limit p_limit
  ) as target;

  return jsonb_build_object('direct', v_direct, 'courses', v_courses);
end
$$;

create function public.list_my_communication_messages(
  p_thread_id uuid,
  p_before_message_id bigint default null,
  p_limit integer default 50
)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v_actor_account_id uuid := public.communication_current_active_account_id();
  v_items jsonb;
  v_has_more boolean;
  v_next_cursor bigint;
begin
  if v_actor_account_id is null
    or p_thread_id is null
    or p_limit is null
    or p_limit < 1
    or p_limit > 50
    or (p_before_message_id is not null and p_before_message_id < 1)
    or not public.communication_thread_is_accessible(
      p_thread_id,
      v_actor_account_id,
      false
    )
  then
    raise exception 'communication_thread_not_found' using errcode = 'P0002';
  end if;

  with page as materialized (
    select message.id
    from public.communication_message as message
    where message.thread_id = p_thread_id
      and (
        p_before_message_id is null
        or message.id < p_before_message_id
      )
    order by message.id desc
    limit p_limit + 1
  ),
  visible as (
    select page.id
    from page
    order by page.id desc
    limit p_limit
  )
  select
    coalesce(
      jsonb_agg(
        public.communication_message_projection(
          visible.id,
          v_actor_account_id
        )
        order by visible.id
      ),
      '[]'::jsonb
    ),
    (select count(*) > p_limit from page),
    case
      when (select count(*) > p_limit from page) then min(visible.id)
      else null
    end
  into v_items, v_has_more, v_next_cursor
  from visible;

  return jsonb_build_object(
    'items', v_items,
    'nextCursor', case
      when v_has_more then to_jsonb(v_next_cursor)
      else 'null'::jsonb
    end
  );
end
$$;

create function public.send_communication_message(
  p_thread_id uuid,
  p_body text,
  p_client_message_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_actor_account_id uuid := public.communication_current_active_account_id();
  v_thread public.communication_thread%rowtype;
  v_existing public.communication_message%rowtype;
  v_message public.communication_message%rowtype;
begin
  if v_actor_account_id is null
    or p_thread_id is null
    or p_client_message_id is null
    or p_body is null
    or btrim(p_body) = ''
    or char_length(btrim(p_body)) > 6000
  then
    raise exception 'communication_message_invalid' using errcode = '22023';
  end if;

  select thread.*
  into v_thread
  from public.communication_thread as thread
  where thread.id = p_thread_id;

  if not found then
    raise exception 'communication_thread_not_found' using errcode = 'P0002';
  end if;

  if v_thread.kind = 'direct' then
    perform account.id
    from public.account as account
    where account.id in (
      v_thread.direct_account_low_id,
      v_thread.direct_account_high_id
    )
    order by account.id
    for key share;
  else
    perform course.id
    from public.course as course
    where course.id = v_thread.course_id
    for key share;
  end if;

  select thread.*
  into v_thread
  from public.communication_thread as thread
  where thread.id = p_thread_id
  for update;

  if not public.communication_thread_is_accessible(
    v_thread.id,
    v_actor_account_id,
    true
  ) then
    raise exception 'communication_thread_not_found' using errcode = 'P0002';
  end if;

  select message.*
  into v_existing
  from public.communication_message as message
  where message.sender_account_id = v_actor_account_id
    and message.client_message_id = p_client_message_id;

  if found then
    if v_existing.thread_id <> p_thread_id
      or v_existing.body <> btrim(p_body)
    then
      raise exception 'communication_message_idempotency_conflict'
        using errcode = '23505';
    end if;

    return public.communication_message_projection(
      v_existing.id,
      v_actor_account_id
    );
  end if;

  perform public.communication_seed_read_states(
    v_thread.id,
    coalesce(v_thread.last_message_id, 0)
  );

  insert into public.communication_message (
    thread_id,
    sender_account_id,
    client_message_id,
    body
  )
  values (
    v_thread.id,
    v_actor_account_id,
    p_client_message_id,
    btrim(p_body)
  )
  returning * into v_message;

  update public.communication_thread as thread
  set last_message_id = v_message.id,
      last_message_at = v_message.created_at
  where thread.id = v_thread.id;

  insert into public.communication_read_state (
    thread_id,
    account_id,
    last_read_message_id,
    updated_at
  )
  values (
    v_thread.id,
    v_actor_account_id,
    v_message.id,
    v_message.created_at
  )
  on conflict (thread_id, account_id) do update
    set last_read_message_id = greatest(
          public.communication_read_state.last_read_message_id,
          excluded.last_read_message_id
        ),
        updated_at = excluded.updated_at;

  return public.communication_message_projection(
    v_message.id,
    v_actor_account_id
  );
end
$$;

create function public.mark_communication_thread_read(
  p_thread_id uuid,
  p_through_message_id bigint default null
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_actor_account_id uuid := public.communication_current_active_account_id();
  v_target_message_id bigint;
begin
  if v_actor_account_id is null
    or p_thread_id is null
    or not public.communication_thread_is_accessible(
      p_thread_id,
      v_actor_account_id,
      false
    )
  then
    raise exception 'communication_thread_not_found' using errcode = 'P0002';
  end if;

  if p_through_message_id is null then
    select coalesce(thread.last_message_id, 0)
    into v_target_message_id
    from public.communication_thread as thread
    where thread.id = p_thread_id;
  else
    select message.id
    into v_target_message_id
    from public.communication_message as message
    where message.id = p_through_message_id
      and message.thread_id = p_thread_id;

    if not found then
      raise exception 'communication_message_not_found' using errcode = 'P0002';
    end if;
  end if;

  insert into public.communication_read_state (
    thread_id,
    account_id,
    last_read_message_id
  )
  values (p_thread_id, v_actor_account_id, v_target_message_id)
  on conflict (thread_id, account_id) do update
    set last_read_message_id = greatest(
          public.communication_read_state.last_read_message_id,
          excluded.last_read_message_id
        ),
        updated_at = now();

  select state.last_read_message_id
  into v_target_message_id
  from public.communication_read_state as state
  where state.thread_id = p_thread_id
    and state.account_id = v_actor_account_id;

  return jsonb_build_object(
    'markedThroughId', case
      when v_target_message_id = 0 then null
      else v_target_message_id
    end,
    'unreadCount', (
      select count(*)
      from public.communication_message as message
      where message.thread_id = p_thread_id
        and message.id > v_target_message_id
        and message.sender_account_id <> v_actor_account_id
    )
  );
end
$$;

create function public.assistant_conversation_projection(
  p_conversation_id uuid,
  p_actor_account_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path to ''
as $$
  select jsonb_build_object(
    'id', conversation.id,
    'title', conversation.title,
    'contextCourseId', conversation.context_course_id,
    'contextLessonId', conversation.context_lesson_id,
    'lastTurnId', conversation.last_turn_id,
    'lastActivityAt', coalesce(
      conversation.last_turn_at,
      conversation.created_at
    ),
    'unreadCount', (
      select count(*)
      from public.assistant_turn as turn
      where turn.conversation_id = conversation.id
        and turn.role = 'assistant'
        and turn.id > conversation.last_read_assistant_turn_id
    ),
    'archivedAt', conversation.archived_at,
    'createdAt', conversation.created_at,
    'updatedAt', conversation.updated_at
  )
  from public.assistant_conversation as conversation
  where conversation.id = p_conversation_id
    and conversation.owner_account_id = p_actor_account_id;
$$;

create function public.assistant_turn_projection(p_turn_id bigint)
returns jsonb
language sql
stable
security definer
set search_path to ''
as $$
  select jsonb_build_object(
    'id', turn.id,
    'role', turn.role,
    'deliveryKind', turn.delivery_kind,
    'body', turn.body,
    'payload', turn.payload,
    'createdAt', turn.created_at
  )
  from public.assistant_turn as turn
  where turn.id = p_turn_id;
$$;

create function public.get_my_assistant_conversation(
  p_conversation_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v_actor_account_id uuid := public.communication_current_active_account_id();
  v_result jsonb;
begin
  if v_actor_account_id is null or p_conversation_id is null then
    raise exception 'assistant_conversation_not_found' using errcode = 'P0002';
  end if;

  v_result := public.assistant_conversation_projection(
    p_conversation_id,
    v_actor_account_id
  );

  if v_result is null then
    raise exception 'assistant_conversation_not_found' using errcode = 'P0002';
  end if;

  return v_result;
end
$$;

create function public.list_my_assistant_conversations(
  p_include_archived boolean default false,
  p_limit integer default 50
)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v_actor_account_id uuid := public.communication_current_active_account_id();
  v_items jsonb;
begin
  if v_actor_account_id is null then
    raise exception 'assistant_account_not_found' using errcode = 'P0002';
  end if;

  if p_include_archived is null
    or p_limit is null
    or p_limit < 1
    or p_limit > 50
  then
    raise exception 'assistant_conversation_query_invalid'
      using errcode = '22023';
  end if;

  select coalesce(
    jsonb_agg(
      public.assistant_conversation_projection(
        conversation.id,
        v_actor_account_id
      )
      order by coalesce(
        conversation.last_turn_at,
        conversation.created_at
      ) desc,
      conversation.id desc
    ),
    '[]'::jsonb
  )
  into v_items
  from (
    select conversation.*
    from public.assistant_conversation as conversation
    where conversation.owner_account_id = v_actor_account_id
      and (p_include_archived or conversation.archived_at is null)
    order by coalesce(
      conversation.last_turn_at,
      conversation.created_at
    ) desc,
    conversation.id desc
    limit p_limit
  ) as conversation;

  return jsonb_build_object('items', v_items);
end
$$;

create function public.create_my_assistant_conversation(
  p_title text default 'Новый диалог',
  p_context_course_id uuid default null,
  p_context_lesson_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_actor_account_id uuid := public.communication_current_active_account_id();
  v_conversation public.assistant_conversation%rowtype;
begin
  if v_actor_account_id is null
    or p_title is null
    or btrim(p_title) = ''
    or char_length(btrim(p_title)) > 160
    or (p_context_lesson_id is not null and p_context_course_id is null)
  then
    raise exception 'assistant_conversation_invalid' using errcode = '22023';
  end if;

  if p_context_course_id is not null then
    perform course.id
    from public.course as course
    where course.id = p_context_course_id
      and course.owner_account_id = v_actor_account_id
      and course.archived_at is null
    for key share;

    if not found then
      raise exception 'assistant_context_not_found' using errcode = 'P0002';
    end if;
  end if;

  if p_context_lesson_id is not null
    and not exists (
      select 1
      from public.lesson as lesson
      where lesson.id = p_context_lesson_id
        and lesson.course_id = p_context_course_id
    )
  then
    raise exception 'assistant_context_not_found' using errcode = 'P0002';
  end if;

  insert into public.assistant_conversation (
    owner_account_id,
    title,
    context_course_id,
    context_lesson_id
  )
  values (
    v_actor_account_id,
    btrim(p_title),
    p_context_course_id,
    p_context_lesson_id
  )
  returning * into v_conversation;

  return public.assistant_conversation_projection(
    v_conversation.id,
    v_actor_account_id
  );
end
$$;

create function public.update_my_assistant_conversation(
  p_conversation_id uuid,
  p_title text,
  p_archived boolean
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_actor_account_id uuid := public.communication_current_active_account_id();
begin
  if v_actor_account_id is null
    or p_conversation_id is null
    or (p_title is null and p_archived is null)
    or (p_title is not null and p_archived is not null)
    or (
      p_title is not null
      and (btrim(p_title) = '' or char_length(btrim(p_title)) > 160)
    )
  then
    raise exception 'assistant_conversation_invalid' using errcode = '22023';
  end if;

  update public.assistant_conversation as conversation
  set title = coalesce(btrim(p_title), conversation.title),
      archived_at = case
        when p_archived is null then conversation.archived_at
        when p_archived then coalesce(conversation.archived_at, now())
        else null
      end,
      updated_at = now()
  where conversation.id = p_conversation_id
    and conversation.owner_account_id = v_actor_account_id;

  if not found then
    raise exception 'assistant_conversation_not_found' using errcode = 'P0002';
  end if;

  return public.assistant_conversation_projection(
    p_conversation_id,
    v_actor_account_id
  );
end
$$;

create function public.list_my_assistant_turns(
  p_conversation_id uuid,
  p_before_turn_id bigint default null,
  p_limit integer default 50
)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v_actor_account_id uuid := public.communication_current_active_account_id();
  v_items jsonb;
  v_has_more boolean;
  v_next_cursor bigint;
begin
  if v_actor_account_id is null
    or p_conversation_id is null
    or p_limit is null
    or p_limit < 1
    or p_limit > 50
    or (p_before_turn_id is not null and p_before_turn_id < 1)
    or not exists (
      select 1
      from public.assistant_conversation as conversation
      where conversation.id = p_conversation_id
        and conversation.owner_account_id = v_actor_account_id
    )
  then
    raise exception 'assistant_conversation_not_found' using errcode = 'P0002';
  end if;

  with page as materialized (
    select turn.id
    from public.assistant_turn as turn
    where turn.conversation_id = p_conversation_id
      and (p_before_turn_id is null or turn.id < p_before_turn_id)
    order by turn.id desc
    limit p_limit + 1
  ),
  visible as (
    select page.id
    from page
    order by page.id desc
    limit p_limit
  )
  select
    coalesce(
      jsonb_agg(
        public.assistant_turn_projection(visible.id)
        order by visible.id
      ),
      '[]'::jsonb
    ),
    (select count(*) > p_limit from page),
    case
      when (select count(*) > p_limit from page) then min(visible.id)
      else null
    end
  into v_items, v_has_more, v_next_cursor
  from visible;

  return jsonb_build_object(
    'items', v_items,
    'nextCursor', case
      when v_has_more then to_jsonb(v_next_cursor)
      else 'null'::jsonb
    end
  );
end
$$;

create function public.append_my_assistant_turn(
  p_conversation_id uuid,
  p_body text,
  p_client_turn_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_actor_account_id uuid := public.communication_current_active_account_id();
  v_conversation public.assistant_conversation%rowtype;
  v_existing public.assistant_turn%rowtype;
  v_turn public.assistant_turn%rowtype;
begin
  if v_actor_account_id is null
    or p_conversation_id is null
    or p_client_turn_id is null
    or p_body is null
    or btrim(p_body) = ''
    or char_length(btrim(p_body)) > 6000
  then
    raise exception 'assistant_turn_invalid' using errcode = '22023';
  end if;

  select conversation.*
  into v_conversation
  from public.assistant_conversation as conversation
  where conversation.id = p_conversation_id
    and conversation.owner_account_id = v_actor_account_id
    and conversation.archived_at is null
  for update;

  if not found then
    raise exception 'assistant_conversation_not_found' using errcode = 'P0002';
  end if;

  -- Context IDs are labels, never durable authority. Recheck ownership before
  -- accepting the next user turn; deleted contexts have already been nulled.
  if v_conversation.context_course_id is not null
    and not exists (
      select 1
      from public.course as course
      where course.id = v_conversation.context_course_id
        and course.owner_account_id = v_actor_account_id
        and course.archived_at is null
    )
  then
    raise exception 'assistant_context_not_found' using errcode = 'P0002';
  end if;

  if v_conversation.context_lesson_id is not null
    and not exists (
      select 1
      from public.lesson as lesson
      where lesson.id = v_conversation.context_lesson_id
        and lesson.course_id = v_conversation.context_course_id
    )
  then
    raise exception 'assistant_context_not_found' using errcode = 'P0002';
  end if;

  select turn.*
  into v_existing
  from public.assistant_turn as turn
  where turn.conversation_id = p_conversation_id
    and turn.client_turn_id = p_client_turn_id;

  if found then
    if v_existing.role <> 'user' or v_existing.body <> btrim(p_body) then
      raise exception 'assistant_turn_idempotency_conflict'
        using errcode = '23505';
    end if;

    return public.assistant_turn_projection(v_existing.id);
  end if;

  insert into public.assistant_turn (
    conversation_id,
    role,
    delivery_kind,
    body,
    payload,
    client_turn_id
  )
  values (
    p_conversation_id,
    'user',
    'interactive',
    btrim(p_body),
    '{}'::jsonb,
    p_client_turn_id
  )
  returning * into v_turn;

  update public.assistant_conversation as conversation
  set last_turn_id = v_turn.id,
      last_turn_at = v_turn.created_at,
      updated_at = v_turn.created_at
  where conversation.id = p_conversation_id;

  return public.assistant_turn_projection(v_turn.id);
end
$$;

create function public.append_assistant_turn_admin(
  p_owner_account_id uuid,
  p_conversation_id uuid,
  p_body text,
  p_payload jsonb default '{}'::jsonb,
  p_delivery_kind text default 'interactive',
  p_source_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_conversation public.assistant_conversation%rowtype;
  v_existing public.assistant_turn%rowtype;
  v_turn public.assistant_turn%rowtype;
begin
  if p_owner_account_id is null
    or p_conversation_id is null
    or p_body is null
    or btrim(p_body) = ''
    or char_length(btrim(p_body)) > 6000
    or p_payload is null
    or jsonb_typeof(p_payload) <> 'object'
    or pg_column_size(p_payload) > 65536
    or p_delivery_kind not in (
      'interactive',
      'background_result',
      'insight'
    )
    or (
      p_source_key is not null
      and (
        btrim(p_source_key) = ''
        or char_length(p_source_key) > 240
      )
    )
  then
    raise exception 'assistant_turn_invalid' using errcode = '22023';
  end if;

  select conversation.*
  into v_conversation
  from public.assistant_conversation as conversation
  join public.account as owner_account
    on owner_account.id = conversation.owner_account_id
   and owner_account.status = 'active'
  where conversation.id = p_conversation_id
    and conversation.owner_account_id = p_owner_account_id
    and conversation.archived_at is null
  for update of conversation;

  if not found then
    raise exception 'assistant_conversation_not_found' using errcode = 'P0002';
  end if;

  if p_source_key is not null then
    select turn.*
    into v_existing
    from public.assistant_turn as turn
    where turn.conversation_id = p_conversation_id
      and turn.source_key = btrim(p_source_key);

    if found then
      if v_existing.role <> 'assistant'
        or v_existing.body <> btrim(p_body)
        or v_existing.payload <> p_payload
        or v_existing.delivery_kind <> p_delivery_kind
      then
        raise exception 'assistant_turn_idempotency_conflict'
          using errcode = '23505';
      end if;

      return public.assistant_turn_projection(v_existing.id);
    end if;
  end if;

  insert into public.assistant_turn (
    conversation_id,
    role,
    delivery_kind,
    body,
    payload,
    source_key
  )
  values (
    p_conversation_id,
    'assistant',
    p_delivery_kind,
    btrim(p_body),
    p_payload,
    case when p_source_key is null then null else btrim(p_source_key) end
  )
  returning * into v_turn;

  update public.assistant_conversation as conversation
  set last_turn_id = v_turn.id,
      last_assistant_turn_id = v_turn.id,
      last_turn_at = v_turn.created_at,
      updated_at = v_turn.created_at
  where conversation.id = p_conversation_id;

  return public.assistant_turn_projection(v_turn.id);
end
$$;

create function public.mark_my_assistant_conversation_read(
  p_conversation_id uuid,
  p_through_turn_id bigint default null
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_actor_account_id uuid := public.communication_current_active_account_id();
  v_target_turn_id bigint;
  v_marked_turn_id bigint;
begin
  if v_actor_account_id is null or p_conversation_id is null then
    raise exception 'assistant_conversation_not_found' using errcode = 'P0002';
  end if;

  if p_through_turn_id is null then
    select coalesce(conversation.last_assistant_turn_id, 0)
    into v_target_turn_id
    from public.assistant_conversation as conversation
    where conversation.id = p_conversation_id
      and conversation.owner_account_id = v_actor_account_id
    for update;
  else
    select turn.id
    into v_target_turn_id
    from public.assistant_turn as turn
    join public.assistant_conversation as conversation
      on conversation.id = turn.conversation_id
    where turn.id = p_through_turn_id
      and turn.conversation_id = p_conversation_id
      and conversation.owner_account_id = v_actor_account_id;
  end if;

  if not found then
    raise exception 'assistant_conversation_not_found' using errcode = 'P0002';
  end if;

  select coalesce(max(turn.id), 0)
  into v_marked_turn_id
  from public.assistant_turn as turn
  where turn.conversation_id = p_conversation_id
    and turn.role = 'assistant'
    and turn.id <= v_target_turn_id;

  update public.assistant_conversation as conversation
  set last_read_assistant_turn_id = greatest(
        conversation.last_read_assistant_turn_id,
        v_marked_turn_id
      ),
      updated_at = now()
  where conversation.id = p_conversation_id
    and conversation.owner_account_id = v_actor_account_id
  returning conversation.last_read_assistant_turn_id
    into v_marked_turn_id;

  return jsonb_build_object(
    'markedThroughId', case when v_marked_turn_id = 0 then null else v_marked_turn_id end,
    'unreadCount', (
      select count(*)
      from public.assistant_turn as turn
      where turn.conversation_id = p_conversation_id
        and turn.role = 'assistant'
        and turn.id > v_marked_turn_id
    )
  );
end
$$;

create function public.append_system_notification_internal(
  p_recipient_account_id uuid,
  p_event_type text,
  p_severity text,
  p_title text,
  p_body text,
  p_payload jsonb,
  p_dedupe_key text,
  p_occurred_at timestamptz default now()
)
returns public.system_notification
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_notification public.system_notification%rowtype;
begin
  if p_recipient_account_id is null
    or p_event_type is null
    or p_event_type !~ '^[a-z][a-z0-9_.]{1,99}$'
    or p_severity not in (
      'info',
      'success',
      'warning',
      'error',
      'action_required'
    )
    or p_title is null
    or btrim(p_title) = ''
    or char_length(btrim(p_title)) > 160
    or p_body is null
    or btrim(p_body) = ''
    or char_length(btrim(p_body)) > 6000
    or p_payload is null
    or jsonb_typeof(p_payload) <> 'object'
    or pg_column_size(p_payload) > 16384
    or p_dedupe_key is null
    or btrim(p_dedupe_key) = ''
    or char_length(btrim(p_dedupe_key)) > 240
    or p_occurred_at is null
  then
    raise exception 'system_notification_invalid' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.account as recipient
    where recipient.id = p_recipient_account_id
      and recipient.status = 'active'
  ) then
    return null;
  end if;

  insert into public.system_notification (
    recipient_account_id,
    event_type,
    severity,
    title,
    body,
    payload,
    dedupe_key,
    occurred_at
  )
  values (
    p_recipient_account_id,
    p_event_type,
    p_severity,
    btrim(p_title),
    btrim(p_body),
    p_payload,
    btrim(p_dedupe_key),
    p_occurred_at
  )
  on conflict (recipient_account_id, dedupe_key) do nothing
  returning * into v_notification;

  if not found then
    select notification.*
    into v_notification
    from public.system_notification as notification
    where notification.recipient_account_id = p_recipient_account_id
      and notification.dedupe_key = btrim(p_dedupe_key);

    if v_notification.event_type <> p_event_type
      or v_notification.severity <> p_severity
      or v_notification.title <> btrim(p_title)
      or v_notification.body <> btrim(p_body)
      or v_notification.payload <> p_payload
    then
      raise exception 'system_notification_idempotency_conflict'
        using errcode = '23505';
    end if;
  end if;

  return v_notification;
end
$$;

create function public.system_notification_projection(
  p_notification_id bigint
)
returns jsonb
language sql
stable
security definer
set search_path to ''
as $$
  select jsonb_build_object(
    'id', notification.id,
    'eventType', notification.event_type,
    'severity', notification.severity,
    'title', notification.title,
    'body', notification.body,
    'payload', notification.payload,
    'occurredAt', notification.occurred_at,
    'readAt', notification.read_at
  )
  from public.system_notification as notification
  where notification.id = p_notification_id;
$$;

create function public.append_system_notification_admin(
  p_recipient_account_id uuid,
  p_event_type text,
  p_severity text,
  p_title text,
  p_body text,
  p_payload jsonb,
  p_dedupe_key text,
  p_occurred_at timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_notification public.system_notification%rowtype;
begin
  v_notification := public.append_system_notification_internal(
    p_recipient_account_id,
    p_event_type,
    p_severity,
    p_title,
    p_body,
    p_payload,
    p_dedupe_key,
    p_occurred_at
  );

  if v_notification.id is null then
    raise exception 'system_notification_recipient_not_found'
      using errcode = 'P0002';
  end if;

  return public.system_notification_projection(v_notification.id);
end
$$;

create function public.list_my_system_notifications(
  p_before_notification_id bigint default null,
  p_limit integer default 50
)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v_actor_account_id uuid := public.communication_current_active_account_id();
  v_items jsonb;
  v_has_more boolean;
  v_next_cursor bigint;
begin
  if v_actor_account_id is null
    or p_limit is null
    or p_limit < 1
    or p_limit > 50
    or (
      p_before_notification_id is not null
      and p_before_notification_id < 1
    )
  then
    raise exception 'system_notification_query_invalid' using errcode = '22023';
  end if;

  with page as materialized (
    select notification.id
    from public.system_notification as notification
    where notification.recipient_account_id = v_actor_account_id
      and (
        p_before_notification_id is null
        or notification.id < p_before_notification_id
      )
    order by notification.id desc
    limit p_limit + 1
  ),
  visible as (
    select page.id
    from page
    order by page.id desc
    limit p_limit
  )
  select
    coalesce(
      jsonb_agg(
        public.system_notification_projection(visible.id)
        order by visible.id
      ),
      '[]'::jsonb
    ),
    (select count(*) > p_limit from page),
    case
      when (select count(*) > p_limit from page) then min(visible.id)
      else null
    end
  into v_items, v_has_more, v_next_cursor
  from visible;

  return jsonb_build_object(
    'items', v_items,
    'nextCursor', case
      when v_has_more then to_jsonb(v_next_cursor)
      else 'null'::jsonb
    end
  );
end
$$;

create function public.mark_my_system_notifications_read(
  p_through_notification_id bigint default null
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_actor_account_id uuid := public.communication_current_active_account_id();
  v_target_notification_id bigint;
begin
  if v_actor_account_id is null then
    raise exception 'system_notification_account_not_found'
      using errcode = 'P0002';
  end if;

  if p_through_notification_id is null then
    select max(notification.id)
    into v_target_notification_id
    from public.system_notification as notification
    where notification.recipient_account_id = v_actor_account_id;
  else
    select notification.id
    into v_target_notification_id
    from public.system_notification as notification
    where notification.id = p_through_notification_id
      and notification.recipient_account_id = v_actor_account_id;

    if not found then
      raise exception 'system_notification_not_found' using errcode = 'P0002';
    end if;
  end if;

  if v_target_notification_id is not null then
    update public.system_notification as notification
    set read_at = coalesce(
      notification.read_at,
      greatest(now(), notification.occurred_at)
    )
    where notification.recipient_account_id = v_actor_account_id
      and notification.id <= v_target_notification_id
      and notification.read_at is null;
  end if;

  return jsonb_build_object(
    'markedThroughId', v_target_notification_id,
    'unreadCount', (
      select count(*)
      from public.system_notification as notification
      where notification.recipient_account_id = v_actor_account_id
        and notification.read_at is null
    )
  );
end
$$;

create function public.emit_lesson_run_communication_notifications()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_course_id uuid;
  v_course_title text;
  v_lesson_title text;
  v_owner_account_id uuid;
  v_event_revision text;
  v_audience_dedupe_key text;
  v_latest_audience_dedupe_key text;
  v_current_learner_account_ids uuid[] := '{}'::uuid[];
  v_previous_learner_account_ids uuid[] := '{}'::uuid[];
  v_schedule_fact_changed boolean := false;
  v_roster_changed boolean := false;
  v_removed_account_id uuid;
  v_learner_body text;
  v_recipient record;
  v_total_count integer;
  v_present_count integer;
  v_repeat_count integer;
  v_record record;
begin
  select
    course.id,
    course.title,
    lesson.title,
    course.owner_account_id
  into
    v_course_id,
    v_course_title,
    v_lesson_title,
    v_owner_account_id
  from public.lesson as lesson
  join public.course as course on course.id = lesson.course_id
  where lesson.id = new.lesson_id;

  if not found then
    return null;
  end if;

  select coalesce(
    array_agg(audience.account_id order by audience.account_id),
    '{}'::uuid[]
  )
  into v_current_learner_account_ids
  from (
    select distinct learner_account.id as account_id
    from public.learning_record as record
    join public.learner_profile as profile
      on profile.id = record.learner_profile_id
    join public.account as learner_account
      on learner_account.id = profile.account_id
     and learner_account.status = 'active'
    where record.lesson_run_id = new.id
      and record.superseded_by_record_id is null
      and learner_account.id <> v_owner_account_id
  ) as audience;

  select notification.dedupe_key
  into v_latest_audience_dedupe_key
  from public.system_notification as notification
  where notification.event_type in (
      'lesson_run.scheduled',
      'lesson_run.rescheduled'
    )
    and notification.payload ->> 'lessonRunId' = new.id::text
  order by notification.id desc
  limit 1;

  if v_latest_audience_dedupe_key is not null then
    select coalesce(
      array_agg(audience.account_id order by audience.account_id),
      '{}'::uuid[]
    )
    into v_previous_learner_account_ids
    from (
      select distinct notification.recipient_account_id as account_id
      from public.system_notification as notification
      join public.account as learner_account
        on learner_account.id = notification.recipient_account_id
       and learner_account.status = 'active'
      where notification.dedupe_key = v_latest_audience_dedupe_key
        and notification.event_type in (
          'lesson_run.scheduled',
          'lesson_run.rescheduled'
        )
        and notification.payload ->> 'recipientKind' = 'learner'
        and notification.recipient_account_id <> v_owner_account_id
    ) as audience;
  end if;

  if tg_op = 'UPDATE' then
    v_schedule_fact_changed :=
      new.scheduled_at is distinct from old.scheduled_at
      or new.planned_duration_minutes is distinct from
        old.planned_duration_minutes;
  end if;
  v_roster_changed := v_current_learner_account_ids is distinct from
    v_previous_learner_account_ids;

  v_event_revision := md5(
    concat_ws(
      ':',
      new.id::text,
      new.scheduled_at::text,
      new.planned_duration_minutes::text,
      new.cancelled_at::text,
      new.ended_at::text,
      new.updated_at::text,
      array_to_string(v_current_learner_account_ids, ',')
    )
  );

  if tg_op = 'INSERT' then
    v_audience_dedupe_key := 'lesson_run:scheduled:'
      || new.id::text || ':' || v_event_revision;

    for v_recipient in
      select participant.account_id, participant.recipient_kind
      from (
        select v_owner_account_id as account_id, 'owner'::text as recipient_kind
        union
        select learner.account_id, 'learner'::text
        from unnest(v_current_learner_account_ids) as learner(account_id)
      ) as participant
    loop
      perform public.append_system_notification_internal(
        v_recipient.account_id,
        'lesson_run.scheduled',
        'success',
        'Урок назначен',
        'Урок «' || v_lesson_title || '» назначен.',
        jsonb_build_object(
          'courseId', v_course_id,
          'lessonId', new.lesson_id,
          'lessonRunId', new.id,
          'courseTitle', v_course_title,
          'lessonTitle', v_lesson_title,
          'scheduledAt', new.scheduled_at,
          'plannedDurationMinutes', new.planned_duration_minutes,
          'recipientKind', v_recipient.recipient_kind
        ),
        v_audience_dedupe_key,
        new.created_at
      );
    end loop;
  elsif new.cancelled_at is null
    and new.ended_at is null
    and (v_schedule_fact_changed or v_roster_changed)
  then
    v_audience_dedupe_key := 'lesson_run:rescheduled:'
      || new.id::text || ':' || v_event_revision;

    for v_recipient in
      select participant.account_id, participant.recipient_kind
      from (
        select v_owner_account_id as account_id, 'owner'::text as recipient_kind
        union
        select learner.account_id, 'learner'::text
        from unnest(v_current_learner_account_ids) as learner(account_id)
      ) as participant
    loop
      perform public.append_system_notification_internal(
        v_recipient.account_id,
        'lesson_run.rescheduled',
        'info',
        'Урок изменён',
        'Параметры урока «' || v_lesson_title || '» обновлены.',
        jsonb_build_object(
          'courseId', v_course_id,
          'lessonId', new.lesson_id,
          'lessonRunId', new.id,
          'courseTitle', v_course_title,
          'lessonTitle', v_lesson_title,
          'scheduledAt', new.scheduled_at,
          'previousScheduledAt', old.scheduled_at,
          'plannedDurationMinutes', new.planned_duration_minutes,
          'previousPlannedDurationMinutes', old.planned_duration_minutes,
          'scheduledAtChanged',
            new.scheduled_at is distinct from old.scheduled_at,
          'plannedDurationChanged',
            new.planned_duration_minutes is distinct from
              old.planned_duration_minutes,
          'audienceChanged', v_roster_changed,
          'recipientKind', v_recipient.recipient_kind
        ),
        v_audience_dedupe_key,
        new.updated_at
      );
    end loop;

    for v_removed_account_id in
      select previous.account_id
      from unnest(v_previous_learner_account_ids) as previous(account_id)
      where not previous.account_id = any(v_current_learner_account_ids)
      order by previous.account_id
    loop
      perform public.append_system_notification_internal(
        v_removed_account_id,
        'lesson_run.removed_from_schedule',
        'warning',
        'Урок больше не назначен',
        'Урок «' || v_lesson_title || '» больше вам не назначен.',
        jsonb_build_object(
          'courseId', v_course_id,
          'lessonId', new.lesson_id,
          'lessonRunId', new.id,
          'courseTitle', v_course_title,
          'lessonTitle', v_lesson_title,
          'scheduledAt', new.scheduled_at,
          'previousScheduledAt', old.scheduled_at,
          'plannedDurationMinutes', new.planned_duration_minutes,
          'previousPlannedDurationMinutes', old.planned_duration_minutes,
          'recipientKind', 'removed_learner',
          'changeKind', 'removed_from_schedule'
        ),
        v_audience_dedupe_key,
        new.updated_at
      );
    end loop;
  end if;

  if tg_op = 'UPDATE'
    and new.cancelled_at is not null
    and old.cancelled_at is null
  then
    -- cancel_lesson_run intentionally removes draft LearningRecords before it
    -- updates the run. The latest committed scheduling fact is therefore the
    -- durable, exact audience snapshot for cancellation delivery.
    for v_recipient in
      select participant.account_id, participant.recipient_kind
      from (
        select v_owner_account_id as account_id, 'owner'::text as recipient_kind
        union
        select learner.account_id, 'learner'::text
        from unnest(v_previous_learner_account_ids) as learner(account_id)
      ) as participant
    loop
      perform public.append_system_notification_internal(
        v_recipient.account_id,
        'lesson_run.cancelled',
        'warning',
        'Урок отменён',
        'Урок «' || v_lesson_title || '» отменён.',
        jsonb_build_object(
          'courseId', v_course_id,
          'lessonId', new.lesson_id,
          'lessonRunId', new.id,
          'courseTitle', v_course_title,
          'lessonTitle', v_lesson_title,
          'scheduledAt', new.scheduled_at,
          'cancelledAt', new.cancelled_at,
          'recipientKind', v_recipient.recipient_kind
        ),
        'lesson_run:cancelled:' || new.id::text || ':' || v_event_revision,
        new.cancelled_at
      );
    end loop;
  end if;

  if tg_op = 'UPDATE'
    and new.ended_at is not null
    and old.ended_at is null
  then
    select
      count(*),
      count(*) filter (where record.was_present),
      count(*) filter (where record.was_present and record.needs_repeat)
    into v_total_count, v_present_count, v_repeat_count
    from public.learning_record as record
    where record.lesson_run_id = new.id
      and record.occurred_at is not null
      and record.superseded_by_record_id is null;

    perform public.append_system_notification_internal(
      v_owner_account_id,
      'lesson_run.completed_owner',
      'success',
      'Урок завершён',
      'Урок «' || v_lesson_title || '» завершён. Присутствовали '
        || v_present_count::text || ' из ' || v_total_count::text || '.',
      jsonb_build_object(
        'courseId', v_course_id,
        'lessonId', new.lesson_id,
        'lessonRunId', new.id,
        'courseTitle', v_course_title,
        'lessonTitle', v_lesson_title,
        'endedAt', new.ended_at,
        'actualDurationMinutes', new.actual_duration_minutes,
        'learnerCount', v_total_count,
        'presentCount', v_present_count,
        'needsRepeatCount', v_repeat_count,
        'recipientKind', 'owner'
      ),
      'lesson_run:completed_owner:' || new.id::text || ':' || v_event_revision,
      new.ended_at
    );

    for v_record in
      select
        learner_account.id as account_id,
        record.was_present,
        record.needs_repeat,
        record.actual_duration_minutes_at_time,
        case
          when record.shared_with_learner_at is not null
            then record.teacher_comment
          else null
        end as shared_comment
      from public.learning_record as record
      join public.learner_profile as profile
        on profile.id = record.learner_profile_id
      join public.account as learner_account
        on learner_account.id = profile.account_id
       and learner_account.status = 'active'
      where record.lesson_run_id = new.id
        and record.occurred_at is not null
        and record.superseded_by_record_id is null
        and learner_account.id <> v_owner_account_id
    loop
      v_learner_body := 'Урок «' || v_lesson_title || '» завершён. '
        || case
          when v_record.was_present then 'Вы присутствовали. '
          else 'Вы отсутствовали. '
        end
        || case
          when v_record.needs_repeat then 'Материал нужно повторить. '
          else 'Повторение не требуется. '
        end
        || case
          when v_record.actual_duration_minutes_at_time is null
            then 'Длительность не указана.'
          else 'Длительность: '
            || v_record.actual_duration_minutes_at_time::text || ' мин.'
        end
        || case
          when v_record.shared_comment is null
            or btrim(v_record.shared_comment) = ''
            then ''
          else ' Комментарий преподавателя: ' || v_record.shared_comment
        end;

      perform public.append_system_notification_internal(
        v_record.account_id,
        'lesson_run.completed_learner',
        'success',
        'Урок завершён',
        v_learner_body,
        jsonb_build_object(
          'courseId', v_course_id,
          'lessonId', new.lesson_id,
          'lessonRunId', new.id,
          'courseTitle', v_course_title,
          'lessonTitle', v_lesson_title,
          'endedAt', new.ended_at,
          'wasPresent', v_record.was_present,
          'needsRepeat', v_record.needs_repeat,
          'actualDurationMinutes', v_record.actual_duration_minutes_at_time,
          'sharedComment', v_record.shared_comment,
          'recipientKind', 'learner'
        ),
        'lesson_run:completed_learner:' || new.id::text || ':' || v_event_revision,
        new.ended_at
      );
    end loop;
  end if;

  return null;
end
$$;

create constraint trigger trg_lesson_run_communication_notifications
after insert or update on public.lesson_run
deferrable initially deferred
for each row
execute function public.emit_lesson_run_communication_notifications();

create function public.list_my_communication_inbox(
  p_cursor_activity_at timestamptz default null,
  p_cursor_kind text default null,
  p_cursor_id text default null,
  p_limit integer default 30
)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v_actor_account_id uuid := public.communication_current_active_account_id();
  v_actor_created_at timestamptz;
  v_items jsonb;
  v_system_item jsonb;
  v_has_more boolean;
  v_next_activity_at timestamptz;
  v_next_kind text;
  v_next_id text;
  v_total_unread bigint;
begin
  if v_actor_account_id is null then
    raise exception 'communication_account_not_found' using errcode = 'P0002';
  end if;

  if p_limit is null or p_limit < 1 or p_limit > 50
    or not (
      (
        p_cursor_activity_at is null
        and p_cursor_kind is null
        and p_cursor_id is null
      )
      or (
        p_cursor_activity_at is not null
        and p_cursor_kind in ('direct', 'course', 'assistant')
        and p_cursor_id is not null
        and btrim(p_cursor_id) <> ''
        and char_length(p_cursor_id) <= 80
      )
    )
  then
    raise exception 'communication_inbox_cursor_invalid' using errcode = '22023';
  end if;

  select account.created_at
  into v_actor_created_at
  from public.account as account
  where account.id = v_actor_account_id;

  with candidates as materialized (
    select
      coalesce(thread.last_message_at, thread.created_at) as activity_at,
      thread.kind,
      thread.id::text as item_id,
      case
        when thread.kind = 'direct' then jsonb_build_object(
          'id', thread.id,
          'kind', 'direct',
          'title', projection.value -> 'title',
          'preview', projection.value -> 'preview',
          'lastActivityAt', coalesce(thread.last_message_at, thread.created_at),
          'unreadCount', projection.value -> 'unreadCount',
          'pinned', false,
          'threadId', thread.id,
          'lastMessageId', thread.last_message_id,
          'canSend', projection.value -> 'canSend',
          'directLearnerProfileId',
            projection.value -> 'directLearnerProfileId'
        )
        else jsonb_build_object(
          'id', thread.id,
          'kind', 'course',
          'title', projection.value -> 'title',
          'preview', projection.value -> 'preview',
          'lastActivityAt', coalesce(thread.last_message_at, thread.created_at),
          'unreadCount', projection.value -> 'unreadCount',
          'pinned', false,
          'threadId', thread.id,
          'lastMessageId', thread.last_message_id,
          'canSend', projection.value -> 'canSend',
          'courseId', thread.course_id
        )
      end as item,
      coalesce((projection.value ->> 'unreadCount')::bigint, 0) as unread_count
    from public.communication_thread as thread
    cross join lateral (
      select public.communication_thread_projection(
        thread.id,
        v_actor_account_id
      ) as value
    ) as projection
    where public.communication_thread_is_accessible(
        thread.id,
        v_actor_account_id,
        false
      )
    union all
    select
      coalesce(conversation.last_turn_at, conversation.created_at),
      'assistant'::text,
      conversation.id::text,
      jsonb_build_object(
        'id', conversation.id,
        'kind', 'assistant',
        'title', conversation.title,
        'preview', last_turn.body,
        'lastActivityAt', coalesce(
          conversation.last_turn_at,
          conversation.created_at
        ),
        'unreadCount', (
          select count(*)
          from public.assistant_turn as unread_turn
          where unread_turn.conversation_id = conversation.id
            and unread_turn.role = 'assistant'
            and unread_turn.id > conversation.last_read_assistant_turn_id
        ),
        'pinned', false,
        'conversationId', conversation.id,
        'contextCourseId', conversation.context_course_id,
        'contextLessonId', conversation.context_lesson_id
      ),
      (
        select count(*)
        from public.assistant_turn as unread_turn
        where unread_turn.conversation_id = conversation.id
          and unread_turn.role = 'assistant'
          and unread_turn.id > conversation.last_read_assistant_turn_id
      )
    from public.assistant_conversation as conversation
    left join public.assistant_turn as last_turn
      on last_turn.id = conversation.last_turn_id
     and last_turn.conversation_id = conversation.id
    where conversation.owner_account_id = v_actor_account_id
      and conversation.archived_at is null
  ),
  filtered as (
    select candidates.*
    from candidates
    where p_cursor_activity_at is null
      or candidates.activity_at < p_cursor_activity_at
      or (
        candidates.activity_at = p_cursor_activity_at
        and candidates.kind < p_cursor_kind
      )
      or (
        candidates.activity_at = p_cursor_activity_at
        and candidates.kind = p_cursor_kind
        and candidates.item_id < p_cursor_id
      )
  ),
  page as materialized (
    select filtered.*
    from filtered
    order by activity_at desc, kind desc, item_id desc
    limit p_limit + 1
  ),
  visible as (
    select page.*
    from page
    order by activity_at desc, kind desc, item_id desc
    limit p_limit
  )
  select
    coalesce(
      jsonb_agg(
        visible.item
        order by visible.activity_at desc, visible.kind desc, visible.item_id desc
      ),
      '[]'::jsonb
    ),
    (select count(*) > p_limit from page)
  into v_items, v_has_more
  from visible;

  if v_has_more then
    with candidates as materialized (
      select
        coalesce(thread.last_message_at, thread.created_at) as activity_at,
        thread.kind,
        thread.id::text as item_id
      from public.communication_thread as thread
      where public.communication_thread_is_accessible(
          thread.id,
          v_actor_account_id,
          false
        )
      union all
      select
        coalesce(conversation.last_turn_at, conversation.created_at),
        'assistant'::text,
        conversation.id::text
      from public.assistant_conversation as conversation
      where conversation.owner_account_id = v_actor_account_id
        and conversation.archived_at is null
    ),
    filtered as (
      select candidates.*
      from candidates
      where p_cursor_activity_at is null
        or candidates.activity_at < p_cursor_activity_at
        or (
          candidates.activity_at = p_cursor_activity_at
          and candidates.kind < p_cursor_kind
        )
        or (
          candidates.activity_at = p_cursor_activity_at
          and candidates.kind = p_cursor_kind
          and candidates.item_id < p_cursor_id
        )
    ),
    visible as (
      select filtered.*
      from filtered
      order by activity_at desc, kind desc, item_id desc
      limit p_limit
    )
    select activity_at, kind, item_id
    into v_next_activity_at, v_next_kind, v_next_id
    from visible
    order by activity_at, kind, item_id
    limit 1;
  end if;

  select jsonb_build_object(
    'id', 'system',
    'kind', 'system',
    'title', 'ShiDao',
    'preview', latest.body,
    'lastActivityAt', coalesce(latest.occurred_at, v_actor_created_at),
    'lastNotificationId', latest.id,
    'unreadCount', (
      select count(*)
      from public.system_notification as notification
      where notification.recipient_account_id = v_actor_account_id
        and notification.read_at is null
    ),
    'pinned', true
  )
  into v_system_item
  from (select 1) as one
  left join lateral (
    select notification.id, notification.body, notification.occurred_at
    from public.system_notification as notification
    where notification.recipient_account_id = v_actor_account_id
    order by notification.id desc
    limit 1
  ) as latest on true;

  select
    coalesce((
      select sum(
        case
          when state.account_id is null then 0
          else (
            select count(*)
            from public.communication_message as message
            where message.thread_id = thread.id
              and message.id > state.last_read_message_id
              and message.sender_account_id <> v_actor_account_id
          )
        end
      )
      from public.communication_thread as thread
      left join public.communication_read_state as state
        on state.thread_id = thread.id
       and state.account_id = v_actor_account_id
      where public.communication_thread_is_accessible(
          thread.id,
          v_actor_account_id,
          false
        )
    ), 0)
    + coalesce((
      select count(*)
      from public.assistant_turn as turn
      join public.assistant_conversation as conversation
        on conversation.id = turn.conversation_id
      where conversation.owner_account_id = v_actor_account_id
        and conversation.archived_at is null
        and turn.role = 'assistant'
        and turn.id > conversation.last_read_assistant_turn_id
    ), 0)
    + coalesce((
      select count(*)
      from public.system_notification as notification
      where notification.recipient_account_id = v_actor_account_id
        and notification.read_at is null
    ), 0)
  into v_total_unread;

  if p_cursor_activity_at is null then
    v_items := jsonb_build_array(v_system_item) || v_items;
  end if;

  return jsonb_build_object(
    'items', v_items,
    'nextCursor', case
      when v_has_more then jsonb_build_object(
        'activityAt', v_next_activity_at,
        'kind', v_next_kind,
        'id', v_next_id
      )
      else 'null'::jsonb
    end,
    'totalUnread', v_total_unread
  );
end
$$;

-- Every new function is closed first. User-JWT RPCs and server-only producer
-- RPCs are granted separately below; trigger/projection helpers remain private.
revoke all on function public.communication_current_active_account_id()
  from public, anon, authenticated, service_role;
revoke all on function public.communication_direct_link_is_active(uuid, uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.communication_course_account_is_member(uuid, uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.communication_thread_is_accessible(uuid, uuid, boolean)
  from public, anon, authenticated, service_role;
revoke all on function public.communication_person_label(uuid, uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.communication_thread_projection(uuid, uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.recompute_communication_thread_after_message_delete()
  from public, anon, authenticated, service_role;
revoke all on function public.communication_message_projection(bigint, uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.communication_seed_read_states(uuid, bigint)
  from public, anon, authenticated, service_role;
revoke all on function public.assistant_conversation_projection(uuid, uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.assistant_turn_projection(bigint)
  from public, anon, authenticated, service_role;
revoke all on function public.append_system_notification_internal(
  uuid, text, text, text, text, jsonb, text, timestamptz
) from public, anon, authenticated, service_role;
revoke all on function public.system_notification_projection(bigint)
  from public, anon, authenticated, service_role;
revoke all on function public.emit_lesson_run_communication_notifications()
  from public, anon, authenticated, service_role;

grant execute on function public.communication_current_active_account_id()
  to postgres;
grant execute on function public.communication_direct_link_is_active(uuid, uuid)
  to postgres;
grant execute on function public.communication_course_account_is_member(uuid, uuid)
  to postgres;
grant execute on function public.communication_thread_is_accessible(uuid, uuid, boolean)
  to postgres;
grant execute on function public.communication_person_label(uuid, uuid)
  to postgres;
grant execute on function public.communication_thread_projection(uuid, uuid)
  to postgres;
grant execute on function public.recompute_communication_thread_after_message_delete()
  to postgres;
grant execute on function public.communication_message_projection(bigint, uuid)
  to postgres;
grant execute on function public.communication_seed_read_states(uuid, bigint)
  to postgres;
grant execute on function public.assistant_conversation_projection(uuid, uuid)
  to postgres;
grant execute on function public.assistant_turn_projection(bigint)
  to postgres;
grant execute on function public.append_system_notification_internal(
  uuid, text, text, text, text, jsonb, text, timestamptz
) to postgres;
grant execute on function public.system_notification_projection(bigint)
  to postgres;
grant execute on function public.emit_lesson_run_communication_notifications()
  to postgres;

revoke all on function public.list_my_communication_inbox(
  timestamptz, text, text, integer
) from public, anon, authenticated, service_role;
revoke all on function public.list_my_message_targets(text, integer)
  from public, anon, authenticated, service_role;
revoke all on function public.open_direct_communication_thread(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.open_course_communication_thread(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.list_my_communication_messages(uuid, bigint, integer)
  from public, anon, authenticated, service_role;
revoke all on function public.send_communication_message(uuid, text, uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.mark_communication_thread_read(uuid, bigint)
  from public, anon, authenticated, service_role;
revoke all on function public.list_my_assistant_conversations(boolean, integer)
  from public, anon, authenticated, service_role;
revoke all on function public.get_my_assistant_conversation(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.create_my_assistant_conversation(text, uuid, uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.update_my_assistant_conversation(uuid, text, boolean)
  from public, anon, authenticated, service_role;
revoke all on function public.list_my_assistant_turns(uuid, bigint, integer)
  from public, anon, authenticated, service_role;
revoke all on function public.append_my_assistant_turn(uuid, text, uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.mark_my_assistant_conversation_read(uuid, bigint)
  from public, anon, authenticated, service_role;
revoke all on function public.list_my_system_notifications(bigint, integer)
  from public, anon, authenticated, service_role;
revoke all on function public.mark_my_system_notifications_read(bigint)
  from public, anon, authenticated, service_role;

grant execute on function public.list_my_communication_inbox(
  timestamptz, text, text, integer
) to postgres, authenticated;
grant execute on function public.list_my_message_targets(text, integer)
  to postgres, authenticated;
grant execute on function public.open_direct_communication_thread(uuid)
  to postgres, authenticated;
grant execute on function public.open_course_communication_thread(uuid)
  to postgres, authenticated;
grant execute on function public.list_my_communication_messages(uuid, bigint, integer)
  to postgres, authenticated;
grant execute on function public.send_communication_message(uuid, text, uuid)
  to postgres, authenticated;
grant execute on function public.mark_communication_thread_read(uuid, bigint)
  to postgres, authenticated;
grant execute on function public.list_my_assistant_conversations(boolean, integer)
  to postgres, authenticated;
grant execute on function public.get_my_assistant_conversation(uuid)
  to postgres, authenticated;
grant execute on function public.create_my_assistant_conversation(text, uuid, uuid)
  to postgres, authenticated;
grant execute on function public.update_my_assistant_conversation(uuid, text, boolean)
  to postgres, authenticated;
grant execute on function public.list_my_assistant_turns(uuid, bigint, integer)
  to postgres, authenticated;
grant execute on function public.append_my_assistant_turn(uuid, text, uuid)
  to postgres, authenticated;
grant execute on function public.mark_my_assistant_conversation_read(uuid, bigint)
  to postgres, authenticated;
grant execute on function public.list_my_system_notifications(bigint, integer)
  to postgres, authenticated;
grant execute on function public.mark_my_system_notifications_read(bigint)
  to postgres, authenticated;

revoke all on function public.append_assistant_turn_admin(
  uuid, uuid, text, jsonb, text, text
) from public, anon, authenticated, service_role;
revoke all on function public.append_system_notification_admin(
  uuid, text, text, text, text, jsonb, text, timestamptz
) from public, anon, authenticated, service_role;

grant execute on function public.append_assistant_turn_admin(
  uuid, uuid, text, jsonb, text, text
) to postgres, service_role;
grant execute on function public.append_system_notification_admin(
  uuid, text, text, text, text, jsonb, text, timestamptz
) to postgres, service_role;

do $postflight$
declare
  v_table_name text;
  v_function_name text;
  v_function_oid oid;
begin
  foreach v_table_name in array array[
    'communication_thread',
    'communication_message',
    'communication_read_state',
    'assistant_conversation',
    'assistant_turn',
    'system_notification'
  ]
  loop
    if to_regclass('public.' || v_table_name) is null
      or not exists (
        select 1
        from pg_class as relation
        where relation.oid = to_regclass('public.' || v_table_name)
          and relation.relrowsecurity
      )
      or has_table_privilege(
        'anon',
        'public.' || v_table_name,
        'SELECT,INSERT,UPDATE,DELETE'
      )
      or has_table_privilege(
        'authenticated',
        'public.' || v_table_name,
        'SELECT,INSERT,UPDATE,DELETE'
      )
      or not has_table_privilege(
        'service_role',
        'public.' || v_table_name,
        'SELECT,INSERT,UPDATE,DELETE'
      )
      or exists (
        select 1
        from pg_policies as policy
        where policy.schemaname = 'public'
          and policy.tablename = v_table_name
      )
    then
      raise exception 'communication_table_acl_postflight_failed:%', v_table_name
        using errcode = '42501';
    end if;
  end loop;

  foreach v_function_name in array array[
    'public.list_my_communication_inbox(timestamp with time zone,text,text,integer)',
    'public.list_my_message_targets(text,integer)',
    'public.open_direct_communication_thread(uuid)',
    'public.open_course_communication_thread(uuid)',
    'public.list_my_communication_messages(uuid,bigint,integer)',
    'public.send_communication_message(uuid,text,uuid)',
    'public.mark_communication_thread_read(uuid,bigint)',
    'public.list_my_assistant_conversations(boolean,integer)',
    'public.get_my_assistant_conversation(uuid)',
    'public.create_my_assistant_conversation(text,uuid,uuid)',
    'public.update_my_assistant_conversation(uuid,text,boolean)',
    'public.list_my_assistant_turns(uuid,bigint,integer)',
    'public.append_my_assistant_turn(uuid,text,uuid)',
    'public.mark_my_assistant_conversation_read(uuid,bigint)',
    'public.list_my_system_notifications(bigint,integer)',
    'public.mark_my_system_notifications_read(bigint)'
  ]
  loop
    v_function_oid := to_regprocedure(v_function_name);
    if v_function_oid is null
      or not exists (
        select 1
        from pg_proc as procedure
        where procedure.oid = v_function_oid
          and procedure.prosecdef
          and procedure.proconfig @> array['search_path=""']
      )
      or not has_function_privilege(
        'authenticated',
        v_function_oid,
        'EXECUTE'
      )
      or has_function_privilege('anon', v_function_oid, 'EXECUTE')
      or exists (
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
    then
      raise exception 'communication_user_rpc_postflight_failed:%', v_function_name
        using errcode = '42501';
    end if;
  end loop;

  foreach v_function_name in array array[
    'public.append_assistant_turn_admin(uuid,uuid,text,jsonb,text,text)',
    'public.append_system_notification_admin(uuid,text,text,text,text,jsonb,text,timestamp with time zone)'
  ]
  loop
    v_function_oid := to_regprocedure(v_function_name);
    if v_function_oid is null
      or not exists (
        select 1
        from pg_proc as procedure
        where procedure.oid = v_function_oid
          and procedure.prosecdef
          and procedure.proconfig @> array['search_path=""']
      )
      or not has_function_privilege(
        'service_role',
        v_function_oid,
        'EXECUTE'
      )
      or has_function_privilege(
        'authenticated',
        v_function_oid,
        'EXECUTE'
      )
      or has_function_privilege('anon', v_function_oid, 'EXECUTE')
    then
      raise exception 'communication_admin_rpc_postflight_failed:%', v_function_name
        using errcode = '42501';
    end if;
  end loop;

  if not exists (
    select 1
    from pg_trigger as trigger
    where trigger.tgrelid = 'public.lesson_run'::regclass
      and trigger.tgname = 'trg_lesson_run_communication_notifications'
      and not trigger.tgisinternal
      and trigger.tgenabled = 'O'
      and trigger.tgdeferrable
      and trigger.tginitdeferred
  )
    or not exists (
      select 1
      from pg_trigger as trigger
      where trigger.tgrelid = 'public.communication_message'::regclass
        and trigger.tgname = 'trg_communication_message_recompute_thread_after_delete'
        and not trigger.tgisinternal
        and trigger.tgenabled = 'O'
    )
    or (
      select count(*)
      from pg_constraint as constraint_row
      where constraint_row.conrelid in (
        'public.communication_thread'::regclass,
        'public.communication_message'::regclass,
        'public.assistant_conversation'::regclass,
        'public.assistant_turn'::regclass,
        'public.system_notification'::regclass
      )
        and constraint_row.convalidated
        and constraint_row.contype in ('p', 'f', 'u', 'c')
    ) < 25
  then
    raise exception 'communication_shape_postflight_failed'
      using errcode = 'P0001';
  end if;
end
$postflight$;

notify pgrst, 'reload schema';

commit;
