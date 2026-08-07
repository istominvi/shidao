-- One canonical learner profile with teacher-scoped directory relationships.
--
-- The canonical learner identity and learning history must survive removal from
-- one teacher's directory. Teacher-local naming and archive state therefore
-- move to teacher_learner, while LearningRecord keeps immutable producer
-- provenance independently of Course/Lesson lifetime.

begin;

do $$
begin
  if to_regclass('public.account') is null
    or to_regclass('public.course') is null
    or to_regclass('public.learner_profile') is null
    or to_regclass('public.learner_group') is null
    or to_regclass('public.learner_group_member') is null
    or to_regclass('public.course_learner') is null
    or to_regclass('public.course_learner_group') is null
    or to_regclass('public.lesson_run') is null
    or to_regclass('public.learning_record') is null
  then
    raise exception 'canonical_learner_profile_preflight_schema_mismatch';
  end if;

  if to_regclass('public.teacher_learner') is not null
    or exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'learner_profile'
        and column_name = 'account_id'
    )
    or exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'learning_record'
        and column_name = 'recorded_by_account_id'
    )
  then
    raise exception 'canonical_learner_profile_preflight_already_applied';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'learner_profile'
      and column_name = 'owner_account_id'
      and is_nullable = 'NO'
  ) or not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'learner_profile'
      and column_name = 'archived_at'
  ) or to_regprocedure(
    'public.schedule_lesson_run(uuid,timestamptz,integer,uuid[],uuid)'
  ) is null then
    raise exception 'canonical_learner_profile_preflight_wrong_head';
  end if;
end
$$;

create table public.teacher_learner (
  teacher_account_id uuid not null,
  learner_profile_id uuid not null,
  display_name text not null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint teacher_learner_pkey
    primary key (teacher_account_id, learner_profile_id),
  constraint teacher_learner_display_name_check
    check (
      btrim(display_name) <> ''
      and char_length(display_name) <= 160
    ),
  constraint teacher_learner_teacher_account_id_fkey
    foreign key (teacher_account_id)
    references public.account(id)
    on delete cascade,
  constraint teacher_learner_learner_profile_id_fkey
    foreign key (learner_profile_id)
    references public.learner_profile(id)
    on delete cascade
);

alter table public.learner_profile
  add column account_id uuid;

alter table public.learning_record
  add column recorded_by_account_id uuid;

insert into public.teacher_learner (
  teacher_account_id,
  learner_profile_id,
  display_name,
  archived_at,
  created_at,
  updated_at
)
select
  profile.owner_account_id,
  profile.id,
  profile.display_name,
  profile.archived_at,
  profile.created_at,
  profile.updated_at
from public.learner_profile as profile;

-- Backfilling provenance is not a product edit. Keep every historical
-- LearningRecord.updated_at value intact instead of firing set_updated_at().
alter table public.learning_record
  disable trigger trg_learning_record_updated_at;

update public.learning_record as record
set recorded_by_account_id = profile.owner_account_id
from public.learner_profile as profile
where profile.id = record.learner_profile_id;

alter table public.learning_record
  enable trigger trg_learning_record_updated_at;

do $$
begin
  if (select count(*) from public.teacher_learner)
    <> (select count(*) from public.learner_profile)
  then
    raise exception 'canonical_learner_profile_teacher_backfill_mismatch';
  end if;

  if exists (
    select 1
    from public.learning_record
    where recorded_by_account_id is null
  ) then
    raise exception 'canonical_learner_profile_record_provenance_backfill_failed';
  end if;
end
$$;

alter table public.learner_profile
  add constraint learner_profile_account_id_key unique (account_id),
  add constraint learner_profile_account_id_fkey
    foreign key (account_id)
    references public.account(id)
    on delete set null;

alter table public.learning_record
  alter column recorded_by_account_id set not null,
  add constraint learning_record_recorded_by_account_id_fkey
    foreign key (recorded_by_account_id)
    references public.account(id)
    on delete restrict;

create index teacher_learner_active_display_name_idx
  on public.teacher_learner (
    teacher_account_id,
    display_name,
    learner_profile_id
  )
  where archived_at is null;

create index teacher_learner_profile_id_idx
  on public.teacher_learner (learner_profile_id, teacher_account_id);

create index learning_record_teacher_learner_history_idx
  on public.learning_record (
    recorded_by_account_id,
    learner_profile_id,
    occurred_at desc,
    id
  )
  where occurred_at is not null;

drop trigger if exists trg_learner_profile_detach_on_archive
  on public.learner_profile;
drop trigger if exists trg_course_learner_same_owner
  on public.course_learner;
drop trigger if exists trg_learner_group_member_same_owner
  on public.learner_group_member;

drop function public.archive_learner_profile(uuid);
drop function public.create_learner_profile_with_groups(text, uuid[]);
drop function public.update_learner_profile_with_groups(uuid, text, uuid[]);
drop function public.replace_course_learners(uuid, uuid[]);
drop function public.detach_archived_learner_profile_links();
drop function public.enforce_course_learner_same_owner();
drop function public.enforce_learner_group_member_same_owner();

create function public.detach_archived_teacher_learner_links()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.archived_at is null and new.archived_at is not null then
    delete from public.course_learner as course_learner
    using public.course as course
    where course.id = course_learner.course_id
      and course.owner_account_id = new.teacher_account_id
      and course_learner.learner_profile_id = new.learner_profile_id;

    delete from public.learner_group_member as member
    using public.learner_group as learner_group
    where learner_group.id = member.learner_group_id
      and learner_group.owner_account_id = new.teacher_account_id
      and member.learner_profile_id = new.learner_profile_id;
  end if;

  return new;
end
$$;

create function public.enforce_course_learner_teacher_relation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.course as course
    join public.teacher_learner as teacher_learner
      on teacher_learner.teacher_account_id = course.owner_account_id
     and teacher_learner.learner_profile_id = new.learner_profile_id
     and teacher_learner.archived_at is null
    where course.id = new.course_id
  ) then
    raise exception
      'course_learner_teacher_relation_missing'
      using errcode = '23514';
  end if;

  return new;
end
$$;

create function public.enforce_learner_group_member_teacher_relation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.learner_group as learner_group
    join public.teacher_learner as teacher_learner
      on teacher_learner.teacher_account_id = learner_group.owner_account_id
     and teacher_learner.learner_profile_id = new.learner_profile_id
     and teacher_learner.archived_at is null
    where learner_group.id = new.learner_group_id
  ) then
    raise exception
      'learner_group_member_teacher_relation_missing'
      using errcode = '23514';
  end if;

  return new;
end
$$;

create function public.enforce_learning_record_producer_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.recorded_by_account_id is distinct from old.recorded_by_account_id then
    raise exception
      'learning_record_producer_is_immutable'
      using errcode = '23514';
  end if;

  return new;
end
$$;

create function public.archive_learner_profile(
  p_learner_profile_id uuid
)
returns public.teacher_learner
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_user_id uuid := (select auth.uid());
  v_teacher_account_id uuid;
  v_relation public.teacher_learner%rowtype;
begin
  if v_actor_user_id is null then
    raise exception 'learner_profile_not_found' using errcode = 'P0002';
  end if;

  select account.id
  into v_teacher_account_id
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
    and course.owner_account_id = v_teacher_account_id
  order by course.id
  for update of course;

  select teacher_learner.*
  into v_relation
  from public.teacher_learner as teacher_learner
  where teacher_learner.teacher_account_id = v_teacher_account_id
    and teacher_learner.learner_profile_id = p_learner_profile_id
  for update of teacher_learner;

  if not found then
    raise exception 'learner_profile_not_found' using errcode = 'P0002';
  end if;

  update public.teacher_learner as teacher_learner
  set archived_at = coalesce(teacher_learner.archived_at, now())
  where teacher_learner.teacher_account_id = v_teacher_account_id
    and teacher_learner.learner_profile_id = p_learner_profile_id
  returning teacher_learner.* into v_relation;

  return v_relation;
end
$$;

create or replace function public.create_learner_group(
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
  v_teacher_account_id uuid;
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
  into v_teacher_account_id
  from public.account as account
  where account.auth_user_id = v_actor_user_id
  for update of account;

  if not found then
    raise exception 'learner_group_not_found' using errcode = 'P0002';
  end if;

  if exists (
    select 1
    from public.learner_group as learner_group
    where learner_group.owner_account_id = v_teacher_account_id
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
  from public.teacher_learner as teacher_learner
  where teacher_learner.teacher_account_id = v_teacher_account_id
    and teacher_learner.learner_profile_id = any(v_profile_ids)
    and teacher_learner.archived_at is null
  order by teacher_learner.learner_profile_id
  for update of teacher_learner;

  if cardinality(v_profile_ids) <> (
    select count(*)
    from public.teacher_learner as teacher_learner
    where teacher_learner.teacher_account_id = v_teacher_account_id
      and teacher_learner.learner_profile_id = any(v_profile_ids)
      and teacher_learner.archived_at is null
  ) then
    raise exception 'learner_profile_not_found' using errcode = 'P0002';
  end if;

  insert into public.learner_group (owner_account_id, name)
  values (v_teacher_account_id, btrim(p_name))
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

create function public.create_learner_profile_with_groups(
  p_display_name text,
  p_learner_group_ids uuid[] default '{}'::uuid[]
)
returns public.teacher_learner
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_user_id uuid := (select auth.uid());
  v_teacher_account_id uuid;
  v_group_ids uuid[];
  v_profile public.learner_profile%rowtype;
  v_relation public.teacher_learner%rowtype;
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
  into v_teacher_account_id
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
      and learner_group.owner_account_id = v_teacher_account_id
  ) then
    raise exception 'learner_group_not_found' using errcode = 'P0002';
  end if;

  perform 1
  from public.course as course
  join public.course_learner_group as course_group
    on course_group.course_id = course.id
  where course_group.learner_group_id = any(v_group_ids)
    and course.owner_account_id = v_teacher_account_id
  order by course.id
  for update of course;

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
        join public.teacher_learner as teacher_learner
          on teacher_learner.teacher_account_id = v_teacher_account_id
         and teacher_learner.learner_profile_id = course_learner.learner_profile_id
         and teacher_learner.archived_at is null
        where course_learner.course_id = target_course.course_id
        union
        select member.learner_profile_id
        from public.course_learner_group as linked_group
        join public.learner_group_member as member
          on member.learner_group_id = linked_group.learner_group_id
        join public.teacher_learner as teacher_learner
          on teacher_learner.teacher_account_id = v_teacher_account_id
         and teacher_learner.learner_profile_id = member.learner_profile_id
         and teacher_learner.archived_at is null
        where linked_group.course_id = target_course.course_id
      ) as effective
    ) >= 200
  ) then
    raise exception 'course_audience_too_large' using errcode = '22023';
  end if;

  perform 1
  from public.learner_group as learner_group
  where learner_group.id = any(v_group_ids)
    and learner_group.owner_account_id = v_teacher_account_id
  order by learner_group.id
  for update of learner_group;

  insert into public.learner_profile (display_name)
  values (btrim(p_display_name))
  returning * into v_profile;

  insert into public.teacher_learner (
    teacher_account_id,
    learner_profile_id,
    display_name
  )
  values (
    v_teacher_account_id,
    v_profile.id,
    btrim(p_display_name)
  )
  returning * into v_relation;

  insert into public.learner_group_member (
    learner_group_id,
    learner_profile_id
  )
  select requested.id, v_profile.id
  from unnest(v_group_ids) as requested(id);

  return v_relation;
end
$$;

create or replace function public.replace_course_audience(
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
  v_teacher_account_id uuid;
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
  into v_teacher_account_id
  from public.account as account
  where account.auth_user_id = v_actor_user_id
  for update of account;

  if not found then
    raise exception 'course_not_found' using errcode = 'P0002';
  end if;

  perform 1
  from public.course as course
  where course.id = p_course_id
    and course.owner_account_id = v_teacher_account_id
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
    and learner_group.owner_account_id = v_teacher_account_id
  order by learner_group.id
  for update of learner_group;

  if cardinality(v_group_ids) <> (
    select count(*)
    from public.learner_group as learner_group
    where learner_group.id = any(v_group_ids)
      and learner_group.owner_account_id = v_teacher_account_id
  ) then
    raise exception 'learner_group_not_found' using errcode = 'P0002';
  end if;

  perform 1
  from public.teacher_learner as teacher_learner
  where teacher_learner.teacher_account_id = v_teacher_account_id
    and teacher_learner.learner_profile_id = any(v_direct_ids)
    and teacher_learner.archived_at is null
  order by teacher_learner.learner_profile_id
  for update of teacher_learner;

  if cardinality(v_direct_ids) <> (
    select count(*)
    from public.teacher_learner as teacher_learner
    where teacher_learner.teacher_account_id = v_teacher_account_id
      and teacher_learner.learner_profile_id = any(v_direct_ids)
      and teacher_learner.archived_at is null
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
    join public.teacher_learner as teacher_learner
      on teacher_learner.teacher_account_id = v_teacher_account_id
     and teacher_learner.learner_profile_id = member.learner_profile_id
     and teacher_learner.archived_at is null
    where member.learner_group_id = any(v_group_ids)
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

create function public.replace_course_learners(
  p_course_id uuid,
  p_learner_profile_ids uuid[]
)
returns setof public.teacher_learner
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_group_ids uuid[];
  v_teacher_account_id uuid;
begin
  select course.owner_account_id
  into v_teacher_account_id
  from public.course as course
  where course.id = p_course_id;

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
  select teacher_learner.*
  from public.teacher_learner as teacher_learner
  join public.course_learner as course_learner
    on course_learner.learner_profile_id = teacher_learner.learner_profile_id
  where course_learner.course_id = p_course_id
    and teacher_learner.teacher_account_id = v_teacher_account_id
    and teacher_learner.archived_at is null
  order by teacher_learner.display_name, teacher_learner.learner_profile_id;
end
$$;

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
  v_teacher_account_id uuid;
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

  select course.owner_account_id, course.id
  into v_teacher_account_id, v_course_id
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
  where account.id = v_teacher_account_id
    and account.auth_user_id = v_actor_user_id
  for update of account;

  if not found then
    raise exception 'lesson_not_found' using errcode = 'P0002';
  end if;

  perform 1
  from public.course as course
  where course.id = v_course_id
    and course.owner_account_id = v_teacher_account_id
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
      join public.teacher_learner as teacher_learner
        on teacher_learner.teacher_account_id = v_teacher_account_id
       and teacher_learner.learner_profile_id = course_learner.learner_profile_id
       and teacher_learner.archived_at is null
      where course_learner.course_id = v_course_id
      union
      select member.learner_profile_id as id
      from public.course_learner_group as course_group
      join public.learner_group_member as member
        on member.learner_group_id = course_group.learner_group_id
      join public.teacher_learner as teacher_learner
        on teacher_learner.teacher_account_id = v_teacher_account_id
       and teacher_learner.learner_profile_id = member.learner_profile_id
       and teacher_learner.archived_at is null
      where course_group.course_id = v_course_id
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
        join public.teacher_learner as teacher_learner
          on teacher_learner.teacher_account_id = v_teacher_account_id
         and teacher_learner.learner_profile_id = course_learner.learner_profile_id
         and teacher_learner.archived_at is null
        where course_learner.course_id = v_course_id
        union
        select member.learner_profile_id as id
        from public.course_learner_group as course_group
        join public.learner_group_member as member
          on member.learner_group_id = course_group.learner_group_id
        join public.teacher_learner as teacher_learner
          on teacher_learner.teacher_account_id = v_teacher_account_id
         and teacher_learner.learner_profile_id = member.learner_profile_id
         and teacher_learner.archived_at is null
        where course_group.course_id = v_course_id
        union
        select record.learner_profile_id as id
        from public.learning_record as record
        where v_run.id is not null
          and record.lesson_run_id = v_run.id
          and record.occurred_at is null
          and record.recorded_by_account_id = v_teacher_account_id
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
  from public.teacher_learner as teacher_learner
  where teacher_learner.teacher_account_id = v_teacher_account_id
    and teacher_learner.learner_profile_id = any(v_selected_ids)
  order by teacher_learner.learner_profile_id
  for key share of teacher_learner;

  if cardinality(v_selected_ids) <> (
    select count(*)
    from public.teacher_learner as teacher_learner
    where teacher_learner.teacher_account_id = v_teacher_account_id
      and teacher_learner.learner_profile_id = any(v_selected_ids)
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
    recorded_by_account_id,
    lesson_run_id,
    source_course_id,
    source_lesson_id
  )
  select
    selected.id,
    v_teacher_account_id,
    v_run.id,
    v_course_id,
    p_lesson_id
  from unnest(v_selected_ids) as selected(id);

  return v_run;
end
$$;

create or replace function public.update_learner_group(
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
  v_teacher_account_id uuid;
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
  into v_teacher_account_id
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
    and course.owner_account_id = v_teacher_account_id
  order by course.id
  for update of course;

  select learner_group.*
  into v_group
  from public.learner_group as learner_group
  where learner_group.id = p_learner_group_id
    and learner_group.owner_account_id = v_teacher_account_id
  for update of learner_group;

  if not found then
    raise exception 'learner_group_not_found' using errcode = 'P0002';
  end if;

  if exists (
    select 1
    from public.learner_group as learner_group
    where learner_group.owner_account_id = v_teacher_account_id
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
  from public.teacher_learner as teacher_learner
  where teacher_learner.teacher_account_id = v_teacher_account_id
    and teacher_learner.learner_profile_id = any(v_profile_ids)
    and teacher_learner.archived_at is null
  order by teacher_learner.learner_profile_id
  for update of teacher_learner;

  if cardinality(v_profile_ids) <> (
    select count(*)
    from public.teacher_learner as teacher_learner
    where teacher_learner.teacher_account_id = v_teacher_account_id
      and teacher_learner.learner_profile_id = any(v_profile_ids)
      and teacher_learner.archived_at is null
  ) then
    raise exception 'learner_profile_not_found' using errcode = 'P0002';
  end if;

  if exists (
    select 1
    from public.course_learner_group as target_link
    where target_link.learner_group_id = p_learner_group_id
      and (
        select count(*)
        from (
          select course_learner.learner_profile_id
          from public.course_learner as course_learner
          join public.teacher_learner as teacher_learner
            on teacher_learner.teacher_account_id = v_teacher_account_id
           and teacher_learner.learner_profile_id = course_learner.learner_profile_id
           and teacher_learner.archived_at is null
          where course_learner.course_id = target_link.course_id
          union
          select member.learner_profile_id
          from public.course_learner_group as course_group
          join public.learner_group_member as member
            on member.learner_group_id = course_group.learner_group_id
          join public.teacher_learner as teacher_learner
            on teacher_learner.teacher_account_id = v_teacher_account_id
           and teacher_learner.learner_profile_id = member.learner_profile_id
           and teacher_learner.archived_at is null
          where course_group.course_id = target_link.course_id
            and course_group.learner_group_id <> p_learner_group_id
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

create function public.update_learner_profile_with_groups(
  p_learner_profile_id uuid,
  p_display_name text,
  p_learner_group_ids uuid[] default '{}'::uuid[]
)
returns public.teacher_learner
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_user_id uuid := (select auth.uid());
  v_teacher_account_id uuid;
  v_group_ids uuid[];
  v_relation public.teacher_learner%rowtype;
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
  into v_teacher_account_id
  from public.account as account
  where account.auth_user_id = v_actor_user_id
  for update of account;

  if not found then
    raise exception 'learner_profile_not_found' using errcode = 'P0002';
  end if;

  if not exists (
    select 1
    from public.teacher_learner as teacher_learner
    where teacher_learner.teacher_account_id = v_teacher_account_id
      and teacher_learner.learner_profile_id = p_learner_profile_id
      and teacher_learner.archived_at is null
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
      and learner_group.owner_account_id = v_teacher_account_id
  ) then
    raise exception 'learner_group_not_found' using errcode = 'P0002';
  end if;

  perform 1
  from public.course as course
  join public.course_learner_group as course_group
    on course_group.course_id = course.id
  where course_group.learner_group_id = any(v_group_ids)
    and course.owner_account_id = v_teacher_account_id
  order by course.id
  for update of course;

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
        join public.teacher_learner as teacher_learner
          on teacher_learner.teacher_account_id = v_teacher_account_id
         and teacher_learner.learner_profile_id = course_learner.learner_profile_id
         and teacher_learner.archived_at is null
        where course_learner.course_id = target_course.course_id
        union
        select member.learner_profile_id
        from public.course_learner_group as linked_group
        join public.learner_group_member as member
          on member.learner_group_id = linked_group.learner_group_id
        join public.teacher_learner as teacher_learner
          on teacher_learner.teacher_account_id = v_teacher_account_id
         and teacher_learner.learner_profile_id = member.learner_profile_id
         and teacher_learner.archived_at is null
        where linked_group.course_id = target_course.course_id
      ) as current_effective
      where current_effective.learner_profile_id = p_learner_profile_id
    )
      and (
        select count(*)
        from (
          select course_learner.learner_profile_id
          from public.course_learner as course_learner
          join public.teacher_learner as teacher_learner
            on teacher_learner.teacher_account_id = v_teacher_account_id
           and teacher_learner.learner_profile_id = course_learner.learner_profile_id
           and teacher_learner.archived_at is null
          where course_learner.course_id = target_course.course_id
          union
          select member.learner_profile_id
          from public.course_learner_group as linked_group
          join public.learner_group_member as member
            on member.learner_group_id = linked_group.learner_group_id
          join public.teacher_learner as teacher_learner
            on teacher_learner.teacher_account_id = v_teacher_account_id
           and teacher_learner.learner_profile_id = member.learner_profile_id
           and teacher_learner.archived_at is null
          where linked_group.course_id = target_course.course_id
        ) as effective
      ) >= 200
  ) then
    raise exception 'course_audience_too_large' using errcode = '22023';
  end if;

  perform 1
  from public.learner_group as learner_group
  where learner_group.id = any(v_group_ids)
    and learner_group.owner_account_id = v_teacher_account_id
  order by learner_group.id
  for update of learner_group;

  select teacher_learner.*
  into v_relation
  from public.teacher_learner as teacher_learner
  where teacher_learner.teacher_account_id = v_teacher_account_id
    and teacher_learner.learner_profile_id = p_learner_profile_id
    and teacher_learner.archived_at is null
  for update of teacher_learner;

  if not found then
    raise exception 'learner_profile_not_found' using errcode = 'P0002';
  end if;

  update public.teacher_learner as teacher_learner
  set display_name = btrim(p_display_name)
  where teacher_learner.teacher_account_id = v_teacher_account_id
    and teacher_learner.learner_profile_id = p_learner_profile_id
  returning teacher_learner.* into v_relation;

  delete from public.learner_group_member as member
  using public.learner_group as learner_group
  where learner_group.id = member.learner_group_id
    and learner_group.owner_account_id = v_teacher_account_id
    and member.learner_profile_id = p_learner_profile_id
    and not (member.learner_group_id = any(v_group_ids));

  insert into public.learner_group_member (
    learner_group_id,
    learner_profile_id
  )
  select requested.id, p_learner_profile_id
  from unnest(v_group_ids) as requested(id)
  on conflict (learner_group_id, learner_profile_id) do nothing;

  return v_relation;
end
$$;

drop policy if exists learner_profile_owner_all
  on public.learner_profile;
drop policy if exists learning_record_profile_owner_select
  on public.learning_record;

drop index if exists public.learner_profile_owner_active_display_name_idx;
drop index if exists public.learner_profile_owner_display_name_idx;

alter table public.learner_profile
  drop constraint learner_profile_owner_account_id_fkey,
  drop column owner_account_id,
  drop column archived_at;

alter table public.learning_record
  drop constraint learning_record_learner_profile_id_fkey,
  add constraint learning_record_learner_profile_id_fkey
    foreign key (learner_profile_id)
    references public.learner_profile(id)
    on delete restrict;

create trigger trg_teacher_learner_detach_on_archive
after update of archived_at on public.teacher_learner
for each row
execute function public.detach_archived_teacher_learner_links();

create trigger trg_teacher_learner_updated_at
before update on public.teacher_learner
for each row
execute function public.set_updated_at();

create trigger trg_course_learner_teacher_relation
before insert or update of course_id, learner_profile_id
on public.course_learner
for each row
execute function public.enforce_course_learner_teacher_relation();

create trigger trg_learner_group_member_teacher_relation
before insert or update of learner_group_id, learner_profile_id
on public.learner_group_member
for each row
execute function public.enforce_learner_group_member_teacher_relation();

create trigger trg_learning_record_producer_immutable
before update of recorded_by_account_id on public.learning_record
for each row
execute function public.enforce_learning_record_producer_immutable();

alter table public.teacher_learner enable row level security;

create policy teacher_learner_teacher_select
on public.teacher_learner
for select
to authenticated
using (
  teacher_account_id = (select public.current_account_id())
);

create policy learner_profile_account_select
on public.learner_profile
for select
to authenticated
using (
  account_id = (select public.current_account_id())
);

create policy learning_record_producer_select
on public.learning_record
for select
to authenticated
using (
  recorded_by_account_id = (select public.current_account_id())
);

revoke all on table public.teacher_learner from public, anon, authenticated;
grant select on table public.teacher_learner to authenticated;
grant all on table public.teacher_learner to service_role;

revoke all on table public.learner_profile from authenticated;
grant select on table public.learner_profile to authenticated;
grant all on table public.learner_profile to service_role;

revoke insert, update, delete on table public.learning_record
  from authenticated;
grant select on table public.learning_record to authenticated;
grant all on table public.learning_record to service_role;

revoke all on function public.archive_learner_profile(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.archive_learner_profile(uuid)
  to authenticated;
revoke all on function public.create_learner_group(text, uuid[])
  from public, anon, authenticated, service_role;
grant execute on function public.create_learner_group(text, uuid[])
  to authenticated;
revoke all on function public.create_learner_profile_with_groups(text, uuid[])
  from public, anon, authenticated, service_role;
grant execute on function public.create_learner_profile_with_groups(text, uuid[])
  to authenticated;
revoke all on function public.replace_course_audience(uuid, uuid[], uuid[])
  from public, anon, authenticated, service_role;
grant execute on function public.replace_course_audience(uuid, uuid[], uuid[])
  to authenticated;
revoke all on function public.replace_course_learners(uuid, uuid[])
  from public, anon, authenticated, service_role;
grant execute on function public.replace_course_learners(uuid, uuid[])
  to authenticated;
revoke all on function public.schedule_lesson_run(
  uuid,
  timestamptz,
  integer,
  uuid[],
  uuid
) from public, anon, authenticated, service_role;
grant execute on function public.schedule_lesson_run(
  uuid,
  timestamptz,
  integer,
  uuid[],
  uuid
) to authenticated;
revoke all on function public.update_learner_group(uuid, text, uuid[])
  from public, anon, authenticated, service_role;
grant execute on function public.update_learner_group(uuid, text, uuid[])
  to authenticated;
revoke all on function public.update_learner_profile_with_groups(
  uuid,
  text,
  uuid[]
) from public, anon, authenticated, service_role;
grant execute on function public.update_learner_profile_with_groups(
  uuid,
  text,
  uuid[]
) to authenticated;

revoke all on function public.detach_archived_teacher_learner_links()
  from public, anon, authenticated, service_role;
revoke all on function public.enforce_course_learner_teacher_relation()
  from public, anon, authenticated, service_role;
revoke all on function public.enforce_learner_group_member_teacher_relation()
  from public, anon, authenticated, service_role;
revoke all on function public.enforce_learning_record_producer_immutable()
  from public, anon, authenticated, service_role;

do $$
begin
  if to_regclass('public.teacher_learner') is null
    or not exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'learner_profile'
        and column_name = 'account_id'
        and is_nullable = 'YES'
    )
    or exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'learner_profile'
        and column_name in ('owner_account_id', 'archived_at')
    )
    or not exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'learning_record'
        and column_name = 'recorded_by_account_id'
        and is_nullable = 'NO'
    )
  then
    raise exception 'canonical_learner_profile_postflight_shape_mismatch';
  end if;

  if exists (
    select 1
    from public.learning_record
    where recorded_by_account_id is null
  ) or exists (
    select 1
    from public.learner_profile as profile
    where not exists (
      select 1
      from public.teacher_learner as teacher_learner
      where teacher_learner.learner_profile_id = profile.id
    )
  ) then
    raise exception 'canonical_learner_profile_postflight_backfill_mismatch';
  end if;

  if pg_get_function_result(
    'public.create_learner_profile_with_groups(text,uuid[])'::regprocedure
  ) <> 'teacher_learner'
    or pg_get_function_result(
      'public.update_learner_profile_with_groups(uuid,text,uuid[])'::regprocedure
    ) <> 'teacher_learner'
    or pg_get_function_result(
      'public.archive_learner_profile(uuid)'::regprocedure
    ) <> 'teacher_learner'
  then
    raise exception 'canonical_learner_profile_postflight_rpc_mismatch';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.learning_record'::regclass
      and conname = 'learning_record_recorded_by_account_id_fkey'
      and pg_get_constraintdef(oid) like '%ON DELETE RESTRICT%'
  ) or not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.learner_profile'::regclass
      and conname = 'learner_profile_account_id_fkey'
      and pg_get_constraintdef(oid) like '%ON DELETE SET NULL%'
  ) then
    raise exception 'canonical_learner_profile_postflight_fk_mismatch';
  end if;

  if has_table_privilege(
    'authenticated',
    'public.teacher_learner',
    'INSERT,UPDATE,DELETE'
  ) or has_table_privilege(
    'authenticated',
    'public.learner_profile',
    'INSERT,UPDATE,DELETE'
  ) then
    raise exception 'canonical_learner_profile_postflight_acl_mismatch';
  end if;
end
$$;

notify pgrst, 'reload schema';

commit;
