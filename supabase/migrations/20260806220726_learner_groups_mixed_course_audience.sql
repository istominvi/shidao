begin;

-- Learner groups are reusable owner-scoped collections. Course audience keeps
-- two unordered source sets (direct learners and groups); the effective set is
-- their distinct union. LessonRun still freezes only learner_profile IDs in
-- draft learning_record rows and gains no participant/status/snapshot table.

-- -----------------------------------------------------------------------------
-- ShiDao/source-shape preflight.
-- -----------------------------------------------------------------------------

do $$
declare
  v_missing_tables text;
begin
  select string_agg(expected.name, ', ' order by expected.name)
  into v_missing_tables
  from (
    values
      ('account'),
      ('course'),
      ('lesson'),
      ('learner_profile'),
      ('course_learner'),
      ('lesson_run'),
      ('learning_record')
  ) as expected(name)
  where to_regclass('public.' || expected.name) is null;

  if v_missing_tables is not null then
    raise exception
      'shidao_schema_sanity_failed: missing expected tables: %',
      v_missing_tables;
  end if;

  if to_regclass('public.learner_group') is not null
    or to_regclass('public.learner_group_member') is not null
    or to_regclass('public.course_learner_group') is not null
    or exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'learner_profile'
        and column_name = 'archived_at'
    )
  then
    raise exception
      'shidao_schema_sanity_failed: learner groups already exist';
  end if;

  if to_regprocedure(
    'public.replace_course_learners(uuid,uuid[])'
  ) is null
    or to_regprocedure(
      'public.schedule_lesson_run(uuid,timestamptz,integer,uuid[],uuid)'
    ) is null
    or to_regprocedure(
      'public.complete_lesson_run(uuid,jsonb,text,timestamptz)'
    ) is null
  then
    raise exception
      'shidao_schema_sanity_failed: current audience/run RPCs are missing';
  end if;

  if to_regclass('public.lesson_run_participant') is not null
    or to_regclass('public.lesson_snapshot') is not null
    or exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name in ('lesson_run', 'learning_record')
        and column_name = 'status'
    )
  then
    raise exception
      'shidao_schema_sanity_failed: parallel lesson runtime model exists';
  end if;
end
$$;

-- All audience-directory RPCs lock Account first. The remaining common order
-- is Course rows (UUID order), Group rows, Lesson, Run, LearningRecord, then
-- LearnerProfile rows (UUID order). Existing run lifecycle RPCs still use the
-- narrower Lesson -> Run -> LearningRecord order.
lock table
  public.account,
  public.course,
  public.lesson,
  public.learner_profile,
  public.course_learner,
  public.lesson_run,
  public.learning_record
in share row exclusive mode;

-- -----------------------------------------------------------------------------
-- Active learner directory and reusable groups.
-- -----------------------------------------------------------------------------

alter table public.learner_profile
  add column archived_at timestamptz null;

create index learner_profile_owner_active_display_name_idx
  on public.learner_profile (owner_account_id, display_name, id)
  where archived_at is null;

create table public.learner_group (
  id uuid primary key default gen_random_uuid(),
  owner_account_id uuid not null
    references public.account(id) on delete cascade,
  name text not null check (
    btrim(name) <> '' and char_length(name) <= 160
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index learner_group_owner_normalized_name_idx
  on public.learner_group (owner_account_id, lower(btrim(name)));

create table public.learner_group_member (
  learner_group_id uuid not null
    references public.learner_group(id) on delete cascade,
  learner_profile_id uuid not null
    references public.learner_profile(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (learner_group_id, learner_profile_id)
);

create index learner_group_member_profile_id_idx
  on public.learner_group_member (learner_profile_id, learner_group_id);

create table public.course_learner_group (
  course_id uuid not null
    references public.course(id) on delete cascade,
  learner_group_id uuid not null
    references public.learner_group(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (course_id, learner_group_id)
);

create index course_learner_group_group_id_idx
  on public.course_learner_group (learner_group_id, course_id);

create trigger trg_learner_group_updated_at
before update on public.learner_group
for each row execute function public.set_updated_at();

create function public.enforce_learner_group_member_same_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.learner_group as learner_group
    join public.learner_profile as profile
      on profile.id = new.learner_profile_id
    where learner_group.id = new.learner_group_id
      and learner_group.owner_account_id = profile.owner_account_id
      and profile.archived_at is null
  ) then
    raise exception
      'learner_group_member_owner_mismatch'
      using errcode = '23514';
  end if;

  return new;
end
$$;

revoke all on function public.enforce_learner_group_member_same_owner()
from public, anon, authenticated, service_role;

create trigger trg_learner_group_member_same_owner
before insert or update of learner_group_id, learner_profile_id
on public.learner_group_member
for each row execute function public.enforce_learner_group_member_same_owner();

create function public.enforce_course_learner_group_same_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.course as course
    join public.learner_group as learner_group
      on learner_group.id = new.learner_group_id
    where course.id = new.course_id
      and course.owner_account_id = learner_group.owner_account_id
  ) then
    raise exception
      'course_learner_group_owner_mismatch'
      using errcode = '23514';
  end if;

  return new;
end
$$;

revoke all on function public.enforce_course_learner_group_same_owner()
from public, anon, authenticated, service_role;

create trigger trg_course_learner_group_same_owner
before insert or update of course_id, learner_group_id
on public.course_learner_group
for each row execute function public.enforce_course_learner_group_same_owner();

-- Existing direct Course links must also reject archived profiles.
create or replace function public.enforce_course_learner_same_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.course as course
    join public.learner_profile as profile
      on profile.id = new.learner_profile_id
    where course.id = new.course_id
      and course.owner_account_id = profile.owner_account_id
      and profile.archived_at is null
  ) then
    raise exception
      'course_learner_owner_mismatch'
      using errcode = '23514';
  end if;

  return new;
end
$$;

revoke all on function public.enforce_course_learner_same_owner()
from public, anon, authenticated, service_role;

-- Archiving is a reversible identity tombstone, not history deletion. It
-- detaches only mutable audience/group links. Existing draft/final records keep
-- their learner_profile FK and display name hydration.
create function public.detach_archived_learner_profile_links()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.archived_at is null and new.archived_at is not null then
    delete from public.course_learner as course_learner
    where course_learner.learner_profile_id = new.id;

    delete from public.learner_group_member as member
    where member.learner_profile_id = new.id;
  end if;

  return new;
end
$$;

revoke all on function public.detach_archived_learner_profile_links()
from public, anon, authenticated, service_role;

create trigger trg_learner_profile_detach_on_archive
after update of archived_at on public.learner_profile
for each row execute function public.detach_archived_learner_profile_links();

-- -----------------------------------------------------------------------------
-- Mixed Course audience marker. It remains a compatibility marker only; the
-- two link tables and their effective union are the source of truth.
-- -----------------------------------------------------------------------------

create or replace function public.guard_course_audience_type()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_expected_type text;
begin
  v_expected_type := case
    when exists (
      select 1
      from public.course_learner as course_learner
      where course_learner.course_id = new.id
    ) or exists (
      select 1
      from public.course_learner_group as course_group
      where course_group.course_id = new.id
    ) then 'learner_profile'
    else 'none'
  end;

  if new.audience_type <> v_expected_type then
    raise exception
      'course_audience_type_is_derived'
      using errcode = '23514';
  end if;

  return new;
end
$$;

revoke all on function public.guard_course_audience_type()
from public, anon, authenticated, service_role;

create or replace function public.sync_course_audience_type_from_links()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_course_id uuid;
begin
  for v_course_id in
    select distinct candidate.course_id
    from (
      select case when tg_op <> 'DELETE' then new.course_id end as course_id
      union all
      select case when tg_op <> 'INSERT' then old.course_id end
    ) as candidate
    where candidate.course_id is not null
    order by candidate.course_id
  loop
    update public.course as course
    set audience_type = case
      when exists (
        select 1
        from public.course_learner as course_learner
        where course_learner.course_id = v_course_id
      ) or exists (
        select 1
        from public.course_learner_group as course_group
        where course_group.course_id = v_course_id
      ) then 'learner_profile'
      else 'none'
    end
    where course.id = v_course_id;
  end loop;

  return null;
end
$$;

revoke all on function public.sync_course_audience_type_from_links()
from public, anon, authenticated, service_role;

create trigger trg_course_learner_group_sync_audience_type
after insert or update of course_id or delete on public.course_learner_group
for each row execute function public.sync_course_audience_type_from_links();

-- -----------------------------------------------------------------------------
-- RLS and explicit Data API surface.
-- -----------------------------------------------------------------------------

alter table public.learner_group enable row level security;
alter table public.learner_group_member enable row level security;
alter table public.course_learner_group enable row level security;

create policy learner_group_owner_select
on public.learner_group
for select to authenticated
using (
  owner_account_id = (select public.current_account_id())
);

create policy learner_group_member_owner_select
on public.learner_group_member
for select to authenticated
using (
  exists (
    select 1
    from public.learner_group as learner_group
    where learner_group.id = learner_group_member.learner_group_id
      and learner_group.owner_account_id =
        (select public.current_account_id())
  )
);

create policy course_learner_group_course_owner_select
on public.course_learner_group
for select to authenticated
using (
  exists (
    select 1
    from public.course as course
    where course.id = course_learner_group.course_id
      and course.owner_account_id = (select public.current_account_id())
  )
);

revoke all on table
  public.learner_group,
  public.learner_group_member,
  public.course_learner_group
from public, anon, authenticated, service_role;

grant select on table
  public.learner_group,
  public.learner_group_member,
  public.course_learner_group
to authenticated;

grant all on table
  public.learner_group,
  public.learner_group_member,
  public.course_learner_group
to service_role;

-- Keep old create/rename HTTP calls operational while archived_at remains an
-- RPC-only mutation. Column grants are sufficient for PostgREST.
revoke insert, update on table public.learner_profile from authenticated;
grant insert (owner_account_id, display_name)
on table public.learner_profile to authenticated;
grant update (display_name)
on table public.learner_profile to authenticated;

-- -----------------------------------------------------------------------------
-- Learner and Group mutation RPCs.
-- -----------------------------------------------------------------------------

create function public.create_learner_profile_with_groups(
  p_display_name text,
  p_learner_group_ids uuid[] default '{}'::uuid[]
)
returns public.learner_profile
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_user_id uuid := (select auth.uid());
  v_owner_account_id uuid;
  v_group_ids uuid[];
  v_profile public.learner_profile%rowtype;
begin
  if v_actor_user_id is null then
    raise exception 'learner_profile_not_found' using errcode = 'P0002';
  end if;

  if p_display_name is null
    or btrim(p_display_name) = ''
    or char_length(btrim(p_display_name)) > 160
  then
    raise exception 'learner_profile_name_invalid' using errcode = '22023';
  end if;

  if array_position(p_learner_group_ids, null) is not null
    or cardinality(coalesce(p_learner_group_ids, '{}'::uuid[])) > 200
  then
    raise exception 'learner_group_ids_invalid' using errcode = '22023';
  end if;

  select account.id
  into v_owner_account_id
  from public.account as account
  where account.auth_user_id = v_actor_user_id
  for update of account;

  if not found then
    raise exception 'learner_profile_not_found' using errcode = 'P0002';
  end if;

  select coalesce(array_agg(requested.id order by requested.id), '{}'::uuid[])
  into v_group_ids
  from (
    select distinct requested_id as id
    from unnest(coalesce(p_learner_group_ids, '{}'::uuid[]))
      as requested(requested_id)
  ) as requested;

  if cardinality(v_group_ids) <> (
    select count(*)
    from public.learner_group as learner_group
    where learner_group.id = any(v_group_ids)
      and learner_group.owner_account_id = v_owner_account_id
  ) then
    raise exception 'learner_group_not_found' using errcode = 'P0002';
  end if;

  perform 1
  from public.course as course
  join public.course_learner_group as course_group
    on course_group.course_id = course.id
  where course_group.learner_group_id = any(v_group_ids)
    and course.owner_account_id = v_owner_account_id
  order by course.id
  for update of course;

  -- The new profile would add exactly one effective learner to every Course
  -- reached by any selected Group, regardless of Group overlap.
  if exists (
    select 1
    from (
      select distinct course_group.course_id
      from public.course_learner_group as course_group
      where course_group.learner_group_id = any(v_group_ids)
    ) as target_course
    where (
      select count(*)
      from (
        select course_learner.learner_profile_id
        from public.course_learner as course_learner
        join public.learner_profile as profile
          on profile.id = course_learner.learner_profile_id
        where course_learner.course_id = target_course.course_id
          and profile.archived_at is null
        union
        select member.learner_profile_id
        from public.course_learner_group as linked_group
        join public.learner_group_member as member
          on member.learner_group_id = linked_group.learner_group_id
        join public.learner_profile as profile
          on profile.id = member.learner_profile_id
        where linked_group.course_id = target_course.course_id
          and profile.archived_at is null
      ) as effective
    ) >= 200
  ) then
    raise exception 'course_audience_too_large' using errcode = '22023';
  end if;

  perform 1
  from public.learner_group as learner_group
  where learner_group.id = any(v_group_ids)
    and learner_group.owner_account_id = v_owner_account_id
  order by learner_group.id
  for update of learner_group;

  insert into public.learner_profile (owner_account_id, display_name)
  values (v_owner_account_id, btrim(p_display_name))
  returning * into v_profile;

  insert into public.learner_group_member (
    learner_group_id,
    learner_profile_id
  )
  select requested.id, v_profile.id
  from unnest(v_group_ids) as requested(id);

  return v_profile;
end
$$;

create function public.update_learner_profile_with_groups(
  p_learner_profile_id uuid,
  p_display_name text,
  p_learner_group_ids uuid[] default '{}'::uuid[]
)
returns public.learner_profile
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_user_id uuid := (select auth.uid());
  v_owner_account_id uuid;
  v_group_ids uuid[];
  v_profile public.learner_profile%rowtype;
begin
  if v_actor_user_id is null then
    raise exception 'learner_profile_not_found' using errcode = 'P0002';
  end if;

  if p_display_name is null
    or btrim(p_display_name) = ''
    or char_length(btrim(p_display_name)) > 160
  then
    raise exception 'learner_profile_name_invalid' using errcode = '22023';
  end if;

  if array_position(p_learner_group_ids, null) is not null
    or cardinality(coalesce(p_learner_group_ids, '{}'::uuid[])) > 200
  then
    raise exception 'learner_group_ids_invalid' using errcode = '22023';
  end if;

  select account.id
  into v_owner_account_id
  from public.account as account
  where account.auth_user_id = v_actor_user_id
  for update of account;

  if not found then
    raise exception 'learner_profile_not_found' using errcode = 'P0002';
  end if;

  if not exists (
    select 1
    from public.learner_profile as profile
    where profile.id = p_learner_profile_id
      and profile.owner_account_id = v_owner_account_id
      and profile.archived_at is null
  ) then
    raise exception 'learner_profile_not_found' using errcode = 'P0002';
  end if;

  select coalesce(array_agg(requested.id order by requested.id), '{}'::uuid[])
  into v_group_ids
  from (
    select distinct requested_id as id
    from unnest(coalesce(p_learner_group_ids, '{}'::uuid[]))
      as requested(requested_id)
  ) as requested;

  if cardinality(v_group_ids) <> (
    select count(*)
    from public.learner_group as learner_group
    where learner_group.id = any(v_group_ids)
      and learner_group.owner_account_id = v_owner_account_id
  ) then
    raise exception 'learner_group_not_found' using errcode = 'P0002';
  end if;

  perform 1
  from public.course as course
  join public.course_learner_group as course_group
    on course_group.course_id = course.id
  where course_group.learner_group_id = any(v_group_ids)
    and course.owner_account_id = v_owner_account_id
  order by course.id
  for update of course;

  -- Adding an already-effective learner through another Group does not grow
  -- the distinct Course audience. Only genuinely new effective membership is
  -- constrained by the 200-person Run cap.
  if exists (
    select 1
    from (
      select distinct course_group.course_id
      from public.course_learner_group as course_group
      where course_group.learner_group_id = any(v_group_ids)
    ) as target_course
    where not exists (
      select 1
      from (
        select course_learner.learner_profile_id
        from public.course_learner as course_learner
        join public.learner_profile as profile
          on profile.id = course_learner.learner_profile_id
        where course_learner.course_id = target_course.course_id
          and profile.archived_at is null
        union
        select member.learner_profile_id
        from public.course_learner_group as linked_group
        join public.learner_group_member as member
          on member.learner_group_id = linked_group.learner_group_id
        join public.learner_profile as profile
          on profile.id = member.learner_profile_id
        where linked_group.course_id = target_course.course_id
          and profile.archived_at is null
      ) as current_effective
      where current_effective.learner_profile_id = p_learner_profile_id
    )
      and (
        select count(*)
        from (
          select course_learner.learner_profile_id
          from public.course_learner as course_learner
          join public.learner_profile as profile
            on profile.id = course_learner.learner_profile_id
          where course_learner.course_id = target_course.course_id
            and profile.archived_at is null
          union
          select member.learner_profile_id
          from public.course_learner_group as linked_group
          join public.learner_group_member as member
            on member.learner_group_id = linked_group.learner_group_id
          join public.learner_profile as profile
            on profile.id = member.learner_profile_id
          where linked_group.course_id = target_course.course_id
            and profile.archived_at is null
        ) as effective
      ) >= 200
  ) then
    raise exception 'course_audience_too_large' using errcode = '22023';
  end if;

  perform 1
  from public.learner_group as learner_group
  where learner_group.id = any(v_group_ids)
    and learner_group.owner_account_id = v_owner_account_id
  order by learner_group.id
  for update of learner_group;

  select profile.*
  into v_profile
  from public.learner_profile as profile
  where profile.id = p_learner_profile_id
    and profile.owner_account_id = v_owner_account_id
    and profile.archived_at is null
  for update of profile;

  if not found then
    raise exception 'learner_profile_not_found' using errcode = 'P0002';
  end if;

  update public.learner_profile as profile
  set display_name = btrim(p_display_name)
  where profile.id = p_learner_profile_id
  returning profile.* into v_profile;

  delete from public.learner_group_member as member
  where member.learner_profile_id = p_learner_profile_id
    and not (member.learner_group_id = any(v_group_ids));

  insert into public.learner_group_member (
    learner_group_id,
    learner_profile_id
  )
  select requested.id, p_learner_profile_id
  from unnest(v_group_ids) as requested(id)
  on conflict (learner_group_id, learner_profile_id) do nothing;

  return v_profile;
end
$$;

create function public.archive_learner_profile(
  p_learner_profile_id uuid
)
returns public.learner_profile
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_user_id uuid := (select auth.uid());
  v_owner_account_id uuid;
  v_profile public.learner_profile%rowtype;
begin
  if v_actor_user_id is null then
    raise exception 'learner_profile_not_found' using errcode = 'P0002';
  end if;

  select account.id
  into v_owner_account_id
  from public.account as account
  where account.auth_user_id = v_actor_user_id
  for update of account;

  if not found then
    raise exception 'learner_profile_not_found' using errcode = 'P0002';
  end if;

  perform 1
  from public.course as course
  join public.course_learner as course_learner
    on course_learner.course_id = course.id
  where course_learner.learner_profile_id = p_learner_profile_id
    and course.owner_account_id = v_owner_account_id
  order by course.id
  for update of course;

  select profile.*
  into v_profile
  from public.learner_profile as profile
  where profile.id = p_learner_profile_id
    and profile.owner_account_id = v_owner_account_id
  for update of profile;

  if not found then
    raise exception 'learner_profile_not_found' using errcode = 'P0002';
  end if;

  update public.learner_profile as profile
  set archived_at = coalesce(profile.archived_at, now())
  where profile.id = p_learner_profile_id
  returning profile.* into v_profile;

  return v_profile;
end
$$;

create function public.create_learner_group(
  p_name text,
  p_learner_profile_ids uuid[] default '{}'::uuid[]
)
returns public.learner_group
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_user_id uuid := (select auth.uid());
  v_owner_account_id uuid;
  v_profile_ids uuid[];
  v_group public.learner_group%rowtype;
begin
  if v_actor_user_id is null then
    raise exception 'learner_group_not_found' using errcode = 'P0002';
  end if;

  if p_name is null
    or btrim(p_name) = ''
    or char_length(btrim(p_name)) > 160
  then
    raise exception 'learner_group_name_invalid' using errcode = '22023';
  end if;

  if array_position(p_learner_profile_ids, null) is not null
    or cardinality(coalesce(p_learner_profile_ids, '{}'::uuid[])) > 200
  then
    raise exception 'learner_profile_ids_invalid' using errcode = '22023';
  end if;

  select account.id
  into v_owner_account_id
  from public.account as account
  where account.auth_user_id = v_actor_user_id
  for update of account;

  if not found then
    raise exception 'learner_group_not_found' using errcode = 'P0002';
  end if;

  if exists (
    select 1
    from public.learner_group as learner_group
    where learner_group.owner_account_id = v_owner_account_id
      and lower(btrim(learner_group.name)) = lower(btrim(p_name))
  ) then
    raise exception 'learner_group_name_taken' using errcode = '23505';
  end if;

  select coalesce(array_agg(requested.id order by requested.id), '{}'::uuid[])
  into v_profile_ids
  from (
    select distinct requested_id as id
    from unnest(coalesce(p_learner_profile_ids, '{}'::uuid[]))
      as requested(requested_id)
  ) as requested;

  perform 1
  from public.learner_profile as profile
  where profile.id = any(v_profile_ids)
    and profile.owner_account_id = v_owner_account_id
    and profile.archived_at is null
  order by profile.id
  for update of profile;

  if cardinality(v_profile_ids) <> (
    select count(*)
    from public.learner_profile as profile
    where profile.id = any(v_profile_ids)
      and profile.owner_account_id = v_owner_account_id
      and profile.archived_at is null
  ) then
    raise exception 'learner_profile_not_found' using errcode = 'P0002';
  end if;

  insert into public.learner_group (owner_account_id, name)
  values (v_owner_account_id, btrim(p_name))
  returning * into v_group;

  insert into public.learner_group_member (
    learner_group_id,
    learner_profile_id
  )
  select v_group.id, requested.id
  from unnest(v_profile_ids) as requested(id);

  return v_group;
end
$$;

create function public.update_learner_group(
  p_learner_group_id uuid,
  p_name text,
  p_learner_profile_ids uuid[] default '{}'::uuid[]
)
returns public.learner_group
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_user_id uuid := (select auth.uid());
  v_owner_account_id uuid;
  v_profile_ids uuid[];
  v_group public.learner_group%rowtype;
begin
  if v_actor_user_id is null then
    raise exception 'learner_group_not_found' using errcode = 'P0002';
  end if;

  if p_name is null
    or btrim(p_name) = ''
    or char_length(btrim(p_name)) > 160
  then
    raise exception 'learner_group_name_invalid' using errcode = '22023';
  end if;

  if array_position(p_learner_profile_ids, null) is not null
    or cardinality(coalesce(p_learner_profile_ids, '{}'::uuid[])) > 200
  then
    raise exception 'learner_profile_ids_invalid' using errcode = '22023';
  end if;

  select account.id
  into v_owner_account_id
  from public.account as account
  where account.auth_user_id = v_actor_user_id
  for update of account;

  if not found then
    raise exception 'learner_group_not_found' using errcode = 'P0002';
  end if;

  perform 1
  from public.course as course
  join public.course_learner_group as course_group
    on course_group.course_id = course.id
  where course_group.learner_group_id = p_learner_group_id
    and course.owner_account_id = v_owner_account_id
  order by course.id
  for update of course;

  select learner_group.*
  into v_group
  from public.learner_group as learner_group
  where learner_group.id = p_learner_group_id
    and learner_group.owner_account_id = v_owner_account_id
  for update of learner_group;

  if not found then
    raise exception 'learner_group_not_found' using errcode = 'P0002';
  end if;

  if exists (
    select 1
    from public.learner_group as learner_group
    where learner_group.owner_account_id = v_owner_account_id
      and learner_group.id <> p_learner_group_id
      and lower(btrim(learner_group.name)) = lower(btrim(p_name))
  ) then
    raise exception 'learner_group_name_taken' using errcode = '23505';
  end if;

  select coalesce(array_agg(requested.id order by requested.id), '{}'::uuid[])
  into v_profile_ids
  from (
    select distinct requested_id as id
    from unnest(coalesce(p_learner_profile_ids, '{}'::uuid[]))
      as requested(requested_id)
  ) as requested;

  perform 1
  from public.learner_profile as profile
  where profile.id = any(v_profile_ids)
    and profile.owner_account_id = v_owner_account_id
    and profile.archived_at is null
  order by profile.id
  for update of profile;

  if cardinality(v_profile_ids) <> (
    select count(*)
    from public.learner_profile as profile
    where profile.id = any(v_profile_ids)
      and profile.owner_account_id = v_owner_account_id
      and profile.archived_at is null
  ) then
    raise exception 'learner_profile_not_found' using errcode = 'P0002';
  end if;

  -- A Course cannot be left with an effective audience larger than the same
  -- 200-person LessonRun cap.
  if exists (
    select 1
    from public.course_learner_group as target_link
    where target_link.learner_group_id = p_learner_group_id
      and (
        select count(*)
        from (
          select course_learner.learner_profile_id
          from public.course_learner as course_learner
          join public.learner_profile as profile
            on profile.id = course_learner.learner_profile_id
          where course_learner.course_id = target_link.course_id
            and profile.archived_at is null
          union
          select member.learner_profile_id
          from public.course_learner_group as course_group
          join public.learner_group_member as member
            on member.learner_group_id = course_group.learner_group_id
          join public.learner_profile as profile
            on profile.id = member.learner_profile_id
          where course_group.course_id = target_link.course_id
            and course_group.learner_group_id <> p_learner_group_id
            and profile.archived_at is null
          union
          select requested.id
          from unnest(v_profile_ids) as requested(id)
        ) as effective
      ) > 200
  ) then
    raise exception 'course_audience_too_large' using errcode = '22023';
  end if;

  update public.learner_group as learner_group
  set name = btrim(p_name)
  where learner_group.id = p_learner_group_id
  returning learner_group.* into v_group;

  delete from public.learner_group_member as member
  where member.learner_group_id = p_learner_group_id
    and not (member.learner_profile_id = any(v_profile_ids));

  insert into public.learner_group_member (
    learner_group_id,
    learner_profile_id
  )
  select p_learner_group_id, requested.id
  from unnest(v_profile_ids) as requested(id)
  on conflict (learner_group_id, learner_profile_id) do nothing;

  return v_group;
end
$$;

create function public.delete_learner_group(
  p_learner_group_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_user_id uuid := (select auth.uid());
  v_owner_account_id uuid;
begin
  if v_actor_user_id is null then
    raise exception 'learner_group_not_found' using errcode = 'P0002';
  end if;

  select account.id
  into v_owner_account_id
  from public.account as account
  where account.auth_user_id = v_actor_user_id
  for update of account;

  if not found then
    raise exception 'learner_group_not_found' using errcode = 'P0002';
  end if;

  perform 1
  from public.course as course
  join public.course_learner_group as course_group
    on course_group.course_id = course.id
  where course_group.learner_group_id = p_learner_group_id
    and course.owner_account_id = v_owner_account_id
  order by course.id
  for update of course;

  perform 1
  from public.learner_group as learner_group
  where learner_group.id = p_learner_group_id
    and learner_group.owner_account_id = v_owner_account_id
  for update of learner_group;

  if not found then
    raise exception 'learner_group_not_found' using errcode = 'P0002';
  end if;

  -- Cascades remove only this collection's member and Course links. Learner
  -- profiles, LearningRecords, and frozen LessonRun drafts remain untouched.
  delete from public.learner_group as learner_group
  where learner_group.id = p_learner_group_id;

  return true;
end
$$;

create function public.replace_course_audience(
  p_course_id uuid,
  p_direct_learner_profile_ids uuid[] default '{}'::uuid[],
  p_learner_group_ids uuid[] default '{}'::uuid[]
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_user_id uuid := (select auth.uid());
  v_owner_account_id uuid;
  v_direct_ids uuid[];
  v_group_ids uuid[];
  v_effective_count integer;
begin
  if v_actor_user_id is null then
    raise exception 'course_not_found' using errcode = 'P0002';
  end if;

  if array_position(p_direct_learner_profile_ids, null) is not null
    or array_position(p_learner_group_ids, null) is not null
    or cardinality(coalesce(p_direct_learner_profile_ids, '{}'::uuid[])) > 200
    or cardinality(coalesce(p_learner_group_ids, '{}'::uuid[])) > 200
  then
    raise exception 'course_audience_ids_invalid' using errcode = '22023';
  end if;

  select account.id
  into v_owner_account_id
  from public.account as account
  where account.auth_user_id = v_actor_user_id
  for update of account;

  if not found then
    raise exception 'course_not_found' using errcode = 'P0002';
  end if;

  perform 1
  from public.course as course
  where course.id = p_course_id
    and course.owner_account_id = v_owner_account_id
  for update of course;

  if not found then
    raise exception 'course_not_found' using errcode = 'P0002';
  end if;

  select coalesce(array_agg(requested.id order by requested.id), '{}'::uuid[])
  into v_direct_ids
  from (
    select distinct requested_id as id
    from unnest(coalesce(p_direct_learner_profile_ids, '{}'::uuid[]))
      as requested(requested_id)
  ) as requested;

  select coalesce(array_agg(requested.id order by requested.id), '{}'::uuid[])
  into v_group_ids
  from (
    select distinct requested_id as id
    from unnest(coalesce(p_learner_group_ids, '{}'::uuid[]))
      as requested(requested_id)
  ) as requested;

  perform 1
  from public.learner_group as learner_group
  where learner_group.id = any(v_group_ids)
    and learner_group.owner_account_id = v_owner_account_id
  order by learner_group.id
  for update of learner_group;

  if cardinality(v_group_ids) <> (
    select count(*)
    from public.learner_group as learner_group
    where learner_group.id = any(v_group_ids)
      and learner_group.owner_account_id = v_owner_account_id
  ) then
    raise exception 'learner_group_not_found' using errcode = 'P0002';
  end if;

  perform 1
  from public.learner_profile as profile
  where profile.id = any(v_direct_ids)
    and profile.owner_account_id = v_owner_account_id
    and profile.archived_at is null
  order by profile.id
  for update of profile;

  if cardinality(v_direct_ids) <> (
    select count(*)
    from public.learner_profile as profile
    where profile.id = any(v_direct_ids)
      and profile.owner_account_id = v_owner_account_id
      and profile.archived_at is null
  ) then
    raise exception 'learner_profile_not_found' using errcode = 'P0002';
  end if;

  select count(*)
  into v_effective_count
  from (
    select requested.id
    from unnest(v_direct_ids) as requested(id)
    union
    select member.learner_profile_id
    from public.learner_group_member as member
    join public.learner_profile as profile
      on profile.id = member.learner_profile_id
    where member.learner_group_id = any(v_group_ids)
      and profile.archived_at is null
  ) as effective;

  if v_effective_count > 200 then
    raise exception 'course_audience_too_large' using errcode = '22023';
  end if;

  delete from public.course_learner as course_learner
  where course_learner.course_id = p_course_id
    and not (course_learner.learner_profile_id = any(v_direct_ids));

  insert into public.course_learner (course_id, learner_profile_id)
  select p_course_id, requested.id
  from unnest(v_direct_ids) as requested(id)
  on conflict (course_id, learner_profile_id) do nothing;

  delete from public.course_learner_group as course_group
  where course_group.course_id = p_course_id
    and not (course_group.learner_group_id = any(v_group_ids));

  insert into public.course_learner_group (course_id, learner_group_id)
  select p_course_id, requested.id
  from unnest(v_group_ids) as requested(id)
  on conflict (course_id, learner_group_id) do nothing;

  return true;
end
$$;

-- Backward-compatible direct-audience RPC. It replaces only direct links and
-- deliberately preserves attached groups during a rolling application deploy.
create or replace function public.replace_course_learners(
  p_course_id uuid,
  p_learner_profile_ids uuid[]
)
returns setof public.learner_profile
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_group_ids uuid[];
begin
  select coalesce(
    array_agg(course_group.learner_group_id order by course_group.learner_group_id),
    '{}'::uuid[]
  )
  into v_group_ids
  from public.course_learner_group as course_group
  where course_group.course_id = p_course_id;

  perform public.replace_course_audience(
    p_course_id,
    coalesce(p_learner_profile_ids, '{}'::uuid[]),
    v_group_ids
  );

  return query
  select profile.*
  from public.learner_profile as profile
  join public.course_learner as course_learner
    on course_learner.learner_profile_id = profile.id
  where course_learner.course_id = p_course_id
    and profile.archived_at is null
  order by profile.display_name, profile.id;
end
$$;

-- Resolve mixed Course audience only when creating a Run. Once draft
-- LearningRecords exist, they are the frozen expected set. A time-only
-- reschedule (NULL audience) preserves them; an explicit reschedule may keep
-- frozen learners even if they were later detached/archived, while additions
-- must belong to the current effective Course audience.
create or replace function public.schedule_lesson_run(
  p_lesson_id uuid,
  p_scheduled_at timestamptz,
  p_planned_duration_minutes integer default null,
  p_learner_profile_ids uuid[] default null,
  p_expected_lesson_run_id uuid default null
)
returns public.lesson_run
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_user_id uuid := (select auth.uid());
  v_owner_account_id uuid;
  v_course_id uuid;
  v_duration_minutes integer;
  v_selected_ids uuid[];
  v_run public.lesson_run%rowtype;
begin
  if v_actor_user_id is null then
    raise exception 'lesson_not_found' using errcode = 'P0002';
  end if;

  if p_scheduled_at is null then
    raise exception
      'lesson_run_scheduled_at_required'
      using errcode = '22023';
  end if;

  if p_planned_duration_minutes is not null
    and p_planned_duration_minutes not between 5 and 480
  then
    raise exception
      'lesson_run_duration_invalid'
      using errcode = '22023';
  end if;

  if p_learner_profile_ids is not null
    and array_position(p_learner_profile_ids, null) is not null
  then
    raise exception
      'learner_profile_ids_must_not_contain_null'
      using errcode = '22023';
  end if;

  if cardinality(coalesce(p_learner_profile_ids, '{}'::uuid[])) > 200 then
    raise exception
      'lesson_run_audience_too_large'
      using errcode = '22023';
  end if;

  -- Resolve identity read-only, then acquire the shared audience-directory
  -- mutex before Course/Lesson locks.
  select course.owner_account_id, course.id
  into v_owner_account_id, v_course_id
  from public.lesson as lesson
  join public.course as course on course.id = lesson.course_id
  join public.account as account on account.id = course.owner_account_id
  where lesson.id = p_lesson_id
    and account.auth_user_id = v_actor_user_id;

  if not found then
    raise exception 'lesson_not_found' using errcode = 'P0002';
  end if;

  perform 1
  from public.account as account
  where account.id = v_owner_account_id
    and account.auth_user_id = v_actor_user_id
  for update of account;

  if not found then
    raise exception 'lesson_not_found' using errcode = 'P0002';
  end if;

  perform 1
  from public.course as course
  where course.id = v_course_id
    and course.owner_account_id = v_owner_account_id
  for update of course;

  if not found then
    raise exception 'lesson_not_found' using errcode = 'P0002';
  end if;

  select coalesce(
    p_planned_duration_minutes,
    case
      when lesson.estimated_duration_minutes between 5 and 480
        then lesson.estimated_duration_minutes
      else null
    end,
    60
  )
  into v_duration_minutes
  from public.lesson as lesson
  where lesson.id = p_lesson_id
    and lesson.course_id = v_course_id
  for update of lesson;

  if not found then
    raise exception 'lesson_not_found' using errcode = 'P0002';
  end if;

  select run.*
  into v_run
  from public.lesson_run as run
  where run.lesson_id = p_lesson_id
    and run.ended_at is null
    and run.cancelled_at is null
  for update of run;

  if p_expected_lesson_run_id is not null
    and (
      v_run.id is null
      or v_run.id <> p_expected_lesson_run_id
    )
  then
    raise exception
      'lesson_run_changed'
      using errcode = '55000';
  end if;

  if v_run.id is not null and v_run.started_at is not null then
    raise exception
      'lesson_run_already_started'
      using errcode = '55000';
  end if;

  if v_run.id is not null then
    perform 1
    from public.learning_record as record
    where record.lesson_run_id = v_run.id
    order by record.id
    for update of record;

    if exists (
      select 1
      from public.learning_record as record
      where record.lesson_run_id = v_run.id
        and record.occurred_at is not null
    ) then
      raise exception
        'lesson_run_contains_finalized_records'
        using errcode = '55000';
    end if;
  end if;

  if p_learner_profile_ids is null and v_run.id is not null then
    select coalesce(
      array_agg(record.learner_profile_id order by record.learner_profile_id),
      '{}'::uuid[]
    )
    into v_selected_ids
    from public.learning_record as record
    where record.lesson_run_id = v_run.id
      and record.occurred_at is null;
  elsif p_learner_profile_ids is null then
    select coalesce(array_agg(effective.id order by effective.id), '{}'::uuid[])
    into v_selected_ids
    from (
      select course_learner.learner_profile_id as id
      from public.course_learner as course_learner
      join public.learner_profile as profile
        on profile.id = course_learner.learner_profile_id
      where course_learner.course_id = v_course_id
        and profile.archived_at is null
      union
      select member.learner_profile_id as id
      from public.course_learner_group as course_group
      join public.learner_group_member as member
        on member.learner_group_id = course_group.learner_group_id
      join public.learner_profile as profile
        on profile.id = member.learner_profile_id
      where course_group.course_id = v_course_id
        and profile.archived_at is null
    ) as effective;
  else
    select coalesce(array_agg(requested.id order by requested.id), '{}'::uuid[])
    into v_selected_ids
    from (
      select distinct requested_id as id
      from unnest(p_learner_profile_ids) as requested(requested_id)
    ) as requested;

    if exists (
      select 1
      from unnest(v_selected_ids) as requested(id)
      left join (
        select course_learner.learner_profile_id as id
        from public.course_learner as course_learner
        join public.learner_profile as profile
          on profile.id = course_learner.learner_profile_id
        where course_learner.course_id = v_course_id
          and profile.archived_at is null
        union
        select member.learner_profile_id as id
        from public.course_learner_group as course_group
        join public.learner_group_member as member
          on member.learner_group_id = course_group.learner_group_id
        join public.learner_profile as profile
          on profile.id = member.learner_profile_id
        where course_group.course_id = v_course_id
          and profile.archived_at is null
        union
        select record.learner_profile_id as id
        from public.learning_record as record
        where v_run.id is not null
          and record.lesson_run_id = v_run.id
          and record.occurred_at is null
      ) as allowed on allowed.id = requested.id
      where allowed.id is null
    ) then
      raise exception
        'learner_profile_not_in_course'
        using errcode = 'P0002';
    end if;
  end if;

  if cardinality(v_selected_ids) = 0 then
    raise exception
      'lesson_run_requires_expected_learner'
      using errcode = '23514';
  end if;

  if cardinality(v_selected_ids) > 200 then
    raise exception
      'lesson_run_audience_too_large'
      using errcode = '22023';
  end if;

  perform 1
  from public.learner_profile as profile
  where profile.id = any(v_selected_ids)
    and profile.owner_account_id = v_owner_account_id
  order by profile.id
  for key share of profile;

  if cardinality(v_selected_ids) <> (
    select count(*)
    from public.learner_profile as profile
    where profile.id = any(v_selected_ids)
      and profile.owner_account_id = v_owner_account_id
  ) then
    raise exception 'learner_profile_not_found' using errcode = 'P0002';
  end if;

  if v_run.id is not null then
    update public.lesson_run as run
    set scheduled_at = p_scheduled_at,
        planned_duration_minutes = v_duration_minutes
    where run.id = v_run.id
    returning run.* into v_run;

    delete from public.learning_record as record
    where record.lesson_run_id = v_run.id
      and record.occurred_at is null;
  else
    insert into public.lesson_run (
      lesson_id,
      scheduled_at,
      planned_duration_minutes
    )
    values (
      p_lesson_id,
      p_scheduled_at,
      v_duration_minutes
    )
    returning * into v_run;
  end if;

  insert into public.learning_record (
    learner_profile_id,
    lesson_run_id,
    source_course_id,
    source_lesson_id
  )
  select
    selected.id,
    v_run.id,
    v_course_id,
    p_lesson_id
  from unnest(v_selected_ids) as selected(id);

  return v_run;
end
$$;

-- -----------------------------------------------------------------------------
-- Closed-by-default RPC ACL.
-- -----------------------------------------------------------------------------

revoke all on function public.create_learner_profile_with_groups(text, uuid[])
from public, anon, authenticated, service_role;
revoke all on function public.update_learner_profile_with_groups(uuid, text, uuid[])
from public, anon, authenticated, service_role;
revoke all on function public.archive_learner_profile(uuid)
from public, anon, authenticated, service_role;
revoke all on function public.create_learner_group(text, uuid[])
from public, anon, authenticated, service_role;
revoke all on function public.update_learner_group(uuid, text, uuid[])
from public, anon, authenticated, service_role;
revoke all on function public.delete_learner_group(uuid)
from public, anon, authenticated, service_role;
revoke all on function public.replace_course_audience(uuid, uuid[], uuid[])
from public, anon, authenticated, service_role;
revoke all on function public.replace_course_learners(uuid, uuid[])
from public, anon, authenticated, service_role;
revoke all on function public.schedule_lesson_run(
  uuid,
  timestamptz,
  integer,
  uuid[],
  uuid
)
from public, anon, authenticated, service_role;

grant execute on function public.create_learner_profile_with_groups(text, uuid[])
to authenticated;
grant execute on function public.update_learner_profile_with_groups(uuid, text, uuid[])
to authenticated;
grant execute on function public.archive_learner_profile(uuid)
to authenticated;
grant execute on function public.create_learner_group(text, uuid[])
to authenticated;
grant execute on function public.update_learner_group(uuid, text, uuid[])
to authenticated;
grant execute on function public.delete_learner_group(uuid)
to authenticated;
grant execute on function public.replace_course_audience(uuid, uuid[], uuid[])
to authenticated;
grant execute on function public.replace_course_learners(uuid, uuid[])
to authenticated;
grant execute on function public.schedule_lesson_run(
  uuid,
  timestamptz,
  integer,
  uuid[],
  uuid
)
to authenticated;

notify pgrst, 'reload schema';

-- -----------------------------------------------------------------------------
-- Migration postflight.
-- -----------------------------------------------------------------------------

do $$
declare
  v_table text;
  v_function regprocedure;
begin
  foreach v_table in array array[
    'learner_group',
    'learner_group_member',
    'course_learner_group'
  ]
  loop
    if to_regclass('public.' || v_table) is null then
      raise exception
        'learner_groups_postflight_failed: missing table %',
        v_table;
    end if;

    if not exists (
      select 1
      from pg_class
      where oid = to_regclass('public.' || v_table)
        and relrowsecurity
    ) then
      raise exception
        'learner_groups_postflight_failed: RLS disabled on %',
        v_table;
    end if;

    if has_table_privilege('anon', 'public.' || v_table, 'SELECT')
      or not has_table_privilege(
        'authenticated',
        'public.' || v_table,
        'SELECT'
      )
      or has_table_privilege(
        'authenticated',
        'public.' || v_table,
        'INSERT,UPDATE,DELETE'
      )
    then
      raise exception
        'learner_groups_postflight_failed: bad table ACL on %',
        v_table;
    end if;
  end loop;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'learner_profile'
      and column_name = 'archived_at'
      and data_type = 'timestamp with time zone'
      and is_nullable = 'YES'
  ) then
    raise exception
      'learner_groups_postflight_failed: archived_at is missing';
  end if;

  if has_table_privilege(
    'authenticated',
    'public.learner_profile',
    'DELETE'
  ) or has_table_privilege(
    'authenticated',
    'public.learner_profile',
    'UPDATE'
  ) or has_column_privilege(
    'authenticated',
    'public.learner_profile',
    'archived_at',
    'UPDATE'
  ) or not has_column_privilege(
    'authenticated',
    'public.learner_profile',
    'display_name',
    'UPDATE'
  ) then
    raise exception
      'learner_groups_postflight_failed: learner profile ACL is unsafe';
  end if;

  foreach v_function in array array[
    'public.create_learner_profile_with_groups(text,uuid[])'::regprocedure,
    'public.update_learner_profile_with_groups(uuid,text,uuid[])'::regprocedure,
    'public.archive_learner_profile(uuid)'::regprocedure,
    'public.create_learner_group(text,uuid[])'::regprocedure,
    'public.update_learner_group(uuid,text,uuid[])'::regprocedure,
    'public.delete_learner_group(uuid)'::regprocedure,
    'public.replace_course_audience(uuid,uuid[],uuid[])'::regprocedure,
    'public.replace_course_learners(uuid,uuid[])'::regprocedure,
    'public.schedule_lesson_run(uuid,timestamptz,integer,uuid[],uuid)'::regprocedure
  ]
  loop
    if not has_function_privilege(
      'authenticated',
      v_function,
      'EXECUTE'
    ) or has_function_privilege('anon', v_function, 'EXECUTE')
      or has_function_privilege('service_role', v_function, 'EXECUTE')
    then
      raise exception
        'learner_groups_postflight_failed: bad execute ACL on %',
        v_function;
    end if;
  end loop;

  if pg_get_functiondef(
    'public.schedule_lesson_run(uuid,timestamptz,integer,uuid[],uuid)'::regprocedure
  ) not like '%public.course_learner_group%'
    or pg_get_functiondef(
      'public.schedule_lesson_run(uuid,timestamptz,integer,uuid[],uuid)'::regprocedure
    ) not like '%public.learner_group_member%'
    or pg_get_functiondef(
      'public.schedule_lesson_run(uuid,timestamptz,integer,uuid[],uuid)'::regprocedure
    ) not like '%p_learner_profile_ids is null and v_run.id is not null%'
  then
    raise exception
      'learner_groups_postflight_failed: schedule effective/frozen contract is missing';
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.learner_profile'::regclass
      and tgname = 'trg_learner_profile_detach_on_archive'
      and not tgisinternal
  ) or not exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.course_learner_group'::regclass
      and tgname = 'trg_course_learner_group_sync_audience_type'
      and not tgisinternal
  ) then
    raise exception
      'learner_groups_postflight_failed: required triggers are missing';
  end if;

  if to_regclass('public.lesson_run_participant') is not null
    or to_regclass('public.lesson_snapshot') is not null
    or exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name in ('lesson_run', 'learning_record')
        and column_name = 'status'
    )
  then
    raise exception
      'learner_groups_postflight_failed: parallel runtime model exists';
  end if;
end
$$;

commit;
