begin;

-- A Lesson is both the authored document and the reusable event definition.
-- lesson_run stores one concrete scheduling/conducting attempt, while
-- learning_record is both the expected-learner row before completion and the
-- durable per-learner memory afterwards. No Lesson content snapshot is kept.

-- -----------------------------------------------------------------------------
-- ShiDao/source-shape preflight. Fail before the first persistent write when
-- the migration is pointed at another project or an unexpected schema head.
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
      ('lesson_component'),
      ('lesson_student_slide'),
      ('stored_file'),
      ('course_attachment')
  ) as expected(name)
  where to_regclass('public.' || expected.name) is null;

  if v_missing_tables is not null then
    raise exception
      'shidao_schema_sanity_failed: missing expected tables: %',
      v_missing_tables;
  end if;

  if to_regclass('public.learner_profile') is not null
    or to_regclass('public.course_learner') is not null
    or to_regclass('public.lesson_run') is not null
    or to_regclass('public.learning_record') is not null
  then
    raise exception
      'shidao_schema_sanity_failed: lesson-run tables already exist';
  end if;

  if to_regclass('public.lesson_step') is not null
    or to_regclass('public.methodology') is not null
    or to_regclass('public.scheduled_lesson') is not null
  then
    raise exception
      'shidao_schema_sanity_failed: removed legacy lesson runtime is present';
  end if;

  if to_regprocedure(
    'public.set_lesson_component_student_screen(uuid,text,uuid)'
  ) is null
    or to_regprocedure(
      'public.reorder_lesson_component(uuid,integer)'
    ) is null
    or to_regprocedure(
      'public.delete_lesson_component(uuid)'
    ) is null
  then
    raise exception
      'shidao_schema_sanity_failed: canonical Lesson functions are missing';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'course'
      and column_name = 'audience_type'
      and data_type = 'text'
      and is_nullable = 'NO'
  ) or not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.course'::regclass
      and conname = 'course_audience_type_check'
      and contype = 'c'
  ) then
    raise exception
      'shidao_schema_sanity_failed: canonical Course audience marker is missing';
  end if;

  if to_regclass('storage.buckets') is null
    or not exists (
      select 1
      from storage.buckets
      where id = 'course-assets'
        and name = 'course-assets'
        and public is false
    )
  then
    raise exception
      'shidao_schema_sanity_failed: private course-assets bucket marker is missing';
  end if;
end
$$;

-- Serialize the new audience/run layer with concurrent Course/Lesson writes
-- while its constraints and triggers are installed. Reads remain available.
lock table public.course, public.lesson in share row exclusive mode;

-- -----------------------------------------------------------------------------
-- Neutral learner identity and Course audience.
-- -----------------------------------------------------------------------------

alter table public.course
  drop constraint course_audience_type_check,
  add constraint course_audience_type_check
    check (audience_type in ('none', 'learner_profile'));

create table public.learner_profile (
  id uuid primary key default gen_random_uuid(),
  owner_account_id uuid not null
    references public.account(id) on delete cascade,
  display_name text not null check (
    btrim(display_name) <> '' and char_length(display_name) <= 160
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.course_learner (
  course_id uuid not null
    references public.course(id) on delete cascade,
  learner_profile_id uuid not null
    references public.learner_profile(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (course_id, learner_profile_id)
);

create index learner_profile_owner_display_name_idx
  on public.learner_profile (owner_account_id, display_name, id);

create index course_learner_learner_profile_id_idx
  on public.course_learner (learner_profile_id, course_id);

create trigger trg_learner_profile_updated_at
before update on public.learner_profile
for each row execute function public.set_updated_at();

-- The relationship itself carries no duplicated owner column. This trigger is
-- the physical same-owner invariant even for privileged maintenance writes.
create function public.enforce_course_learner_same_owner()
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

create trigger trg_course_learner_same_owner
before insert or update of course_id, learner_profile_id
on public.course_learner
for each row execute function public.enforce_course_learner_same_owner();

-- course.audience_type remains a small derived compatibility marker. The link
-- rows are the source of truth; callers cannot set a contradictory value.
create function public.guard_course_audience_type()
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

create trigger trg_course_audience_type_guard
before insert or update of audience_type on public.course
for each row execute function public.guard_course_audience_type();

create function public.sync_course_audience_type_from_links()
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
  loop
    update public.course as course
    set audience_type = case
      when exists (
        select 1
        from public.course_learner as course_learner
        where course_learner.course_id = v_course_id
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

create trigger trg_course_learner_sync_audience_type
after insert or update of course_id or delete on public.course_learner
for each row execute function public.sync_course_audience_type_from_links();

-- -----------------------------------------------------------------------------
-- Concrete Lesson runs and durable per-learner memory.
-- -----------------------------------------------------------------------------

create table public.lesson_run (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null
    references public.lesson(id) on delete cascade,
  scheduled_at timestamptz not null,
  planned_duration_minutes integer not null check (
    planned_duration_minutes between 5 and 480
  ),
  started_at timestamptz null,
  ended_at timestamptz null,
  cancelled_at timestamptz null,
  teacher_report text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lesson_run_closed_once_check check (
    ended_at is null or cancelled_at is null
  ),
  constraint lesson_run_completion_time_check check (
    ended_at is null
    or (started_at is not null and ended_at >= started_at)
  ),
  constraint lesson_run_cancellation_time_check check (
    cancelled_at is null
    or started_at is null
    or cancelled_at >= started_at
  ),
  constraint lesson_run_teacher_report_check check (
    teacher_report is null
    or (
      ended_at is not null
      and btrim(teacher_report) <> ''
      and char_length(teacher_report) <= 4000
    )
  )
);

-- An open row is the Lesson's current alarm. Closed runs are its history.
create unique index lesson_run_one_open_per_lesson_idx
  on public.lesson_run (lesson_id)
  where ended_at is null and cancelled_at is null;

create index lesson_run_lesson_scheduled_at_idx
  on public.lesson_run (lesson_id, scheduled_at desc, id);

create index lesson_run_scheduled_at_open_idx
  on public.lesson_run (scheduled_at, id)
  where cancelled_at is null;

create table public.learning_record (
  id uuid primary key default gen_random_uuid(),
  learner_profile_id uuid not null
    references public.learner_profile(id) on delete cascade,
  lesson_run_id uuid null
    references public.lesson_run(id) on delete set null,
  source_course_id uuid null
    references public.course(id) on delete set null,
  source_lesson_id uuid null
    references public.lesson(id) on delete set null,
  occurred_at timestamptz null,
  was_present boolean null,
  needs_repeat boolean null,
  teacher_comment text null check (
    teacher_comment is null
    or (
      btrim(teacher_comment) <> ''
      and char_length(teacher_comment) <= 2000
    )
  ),
  course_title_at_time text null,
  lesson_title_at_time text null,
  subject_at_time text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint learning_record_run_learner_unique
    unique (lesson_run_id, learner_profile_id),
  constraint learning_record_repeat_requires_presence_check check (
    needs_repeat is not true or was_present is true
  ),
  constraint learning_record_draft_or_final_check check (
    (
      occurred_at is null
      and lesson_run_id is not null
      and was_present is null
      and needs_repeat is null
      and teacher_comment is null
      and course_title_at_time is null
      and lesson_title_at_time is null
      and subject_at_time is null
    )
    or
    (
      occurred_at is not null
      and was_present is not null
      and course_title_at_time is not null
      and btrim(course_title_at_time) <> ''
      and lesson_title_at_time is not null
      and btrim(lesson_title_at_time) <> ''
    )
  )
);

create index learning_record_learner_history_idx
  on public.learning_record (learner_profile_id, occurred_at desc, id)
  where occurred_at is not null;

create index learning_record_source_course_id_idx
  on public.learning_record (source_course_id)
  where source_course_id is not null;

create index learning_record_source_lesson_id_idx
  on public.learning_record (source_lesson_id)
  where source_lesson_id is not null;

create trigger trg_lesson_run_updated_at
before update on public.lesson_run
for each row execute function public.set_updated_at();

create trigger trg_learning_record_updated_at
before update on public.learning_record
for each row execute function public.set_updated_at();

-- lesson_run_id uses ON DELETE SET NULL so finalized memory survives. Drafts
-- have no historical meaning and are removed first in the same transaction.
create function public.delete_draft_learning_records_for_lesson_run()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.learning_record as record
  where record.lesson_run_id = old.id
    and record.occurred_at is null;

  return old;
end
$$;

revoke all on function public.delete_draft_learning_records_for_lesson_run()
from public, anon, authenticated, service_role;

create trigger trg_lesson_run_delete_drafts
before delete on public.lesson_run
for each row execute function public.delete_draft_learning_records_for_lesson_run();

-- -----------------------------------------------------------------------------
-- Row-level ownership and explicit Data API surface.
-- -----------------------------------------------------------------------------

alter table public.learner_profile enable row level security;
alter table public.course_learner enable row level security;
alter table public.lesson_run enable row level security;
alter table public.learning_record enable row level security;

create policy learner_profile_owner_all
on public.learner_profile
for all to authenticated
using (
  owner_account_id = (select public.current_account_id())
)
with check (
  owner_account_id = (select public.current_account_id())
);

create policy course_learner_course_owner_select
on public.course_learner
for select to authenticated
using (
  exists (
    select 1
    from public.course as course
    where course.id = course_learner.course_id
      and course.owner_account_id = (select public.current_account_id())
  )
);

create policy lesson_run_course_owner_select
on public.lesson_run
for select to authenticated
using (
  exists (
    select 1
    from public.lesson as lesson
    join public.course as course on course.id = lesson.course_id
    where lesson.id = lesson_run.lesson_id
      and course.owner_account_id = (select public.current_account_id())
  )
);

-- A finalized record belongs to LearnerProfile even after all source foreign
-- keys have been nulled by deletion, so authorization follows that profile.
create policy learning_record_profile_owner_select
on public.learning_record
for select to authenticated
using (
  exists (
    select 1
    from public.learner_profile as profile
    where profile.id = learning_record.learner_profile_id
      and profile.owner_account_id = (select public.current_account_id())
  )
);

revoke all on table
  public.learner_profile,
  public.course_learner,
  public.lesson_run,
  public.learning_record
from public, anon, authenticated, service_role;

grant select, insert, update
on table public.learner_profile
to authenticated;

grant select
on table
  public.course_learner,
  public.lesson_run,
  public.learning_record
to authenticated;

grant all
on table
  public.learner_profile,
  public.course_learner,
  public.lesson_run,
  public.learning_record
to service_role;

-- -----------------------------------------------------------------------------
-- Audience replacement. All mutating relationship/run operations are narrow
-- owner-checked RPCs; direct authenticated table mutation stays unavailable.
-- -----------------------------------------------------------------------------

create function public.replace_course_learners(
  p_course_id uuid,
  p_learner_profile_ids uuid[]
)
returns setof public.learner_profile
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_user_id uuid := (select auth.uid());
  v_owner_account_id uuid;
  v_requested_ids uuid[];
begin
  if v_actor_user_id is null then
    raise exception 'course_not_found' using errcode = 'P0002';
  end if;

  select course.owner_account_id
  into v_owner_account_id
  from public.course as course
  join public.account as account on account.id = course.owner_account_id
  where course.id = p_course_id
    and account.auth_user_id = v_actor_user_id
  for update of course;

  if not found then
    raise exception 'course_not_found' using errcode = 'P0002';
  end if;

  if array_position(p_learner_profile_ids, null) is not null then
    raise exception
      'learner_profile_ids_must_not_contain_null'
      using errcode = '22023';
  end if;

  if cardinality(coalesce(p_learner_profile_ids, '{}'::uuid[])) > 200 then
    raise exception
      'course_audience_too_large'
      using errcode = '22023';
  end if;

  select coalesce(
    array_agg(requested.id order by requested.id),
    '{}'::uuid[]
  )
  into v_requested_ids
  from (
    select distinct requested_id as id
    from unnest(
      coalesce(p_learner_profile_ids, '{}'::uuid[])
    ) as requested(requested_id)
  ) as requested;

  if exists (
    select 1
    from unnest(v_requested_ids) as requested(id)
    left join public.learner_profile as profile
      on profile.id = requested.id
      and profile.owner_account_id = v_owner_account_id
    where profile.id is null
  ) then
    -- Do not distinguish another owner's profile from a missing UUID.
    raise exception 'learner_profile_not_found' using errcode = 'P0002';
  end if;

  delete from public.course_learner as course_learner
  where course_learner.course_id = p_course_id
    and not (
      course_learner.learner_profile_id = any(v_requested_ids)
    );

  insert into public.course_learner (course_id, learner_profile_id)
  select p_course_id, requested.id
  from unnest(v_requested_ids) as requested(id)
  on conflict (course_id, learner_profile_id) do nothing;

  return query
  select profile.*
  from public.learner_profile as profile
  join public.course_learner as course_learner
    on course_learner.learner_profile_id = profile.id
  where course_learner.course_id = p_course_id
  order by profile.display_name, profile.id;
end
$$;

-- -----------------------------------------------------------------------------
-- Schedule or reschedule the Lesson's sole open run.
--
-- p_learner_profile_ids = NULL takes the current Course audience. An explicit
-- array selects a subset of that audience for an individual/small-group repeat.
-- A reschedule passes p_expected_lesson_run_id so a stale caller cannot mutate
-- a replacement Run created after its read; initial scheduling passes NULL.
-- -----------------------------------------------------------------------------

create function public.schedule_lesson_run(
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

  -- Lesson is the parent lock for schedule/start/complete/cancel/delete.
  select
    lesson.course_id,
    coalesce(
      p_planned_duration_minutes,
      case
        when lesson.estimated_duration_minutes between 5 and 480
          then lesson.estimated_duration_minutes
        else null
      end,
      60
    )
  into v_course_id, v_duration_minutes
  from public.lesson as lesson
  join public.course as course on course.id = lesson.course_id
  join public.account as account on account.id = course.owner_account_id
  where lesson.id = p_lesson_id
    and account.auth_user_id = v_actor_user_id
  for update of lesson;

  if not found then
    raise exception 'lesson_not_found' using errcode = 'P0002';
  end if;

  -- A PATCH addressed to a concrete Run must never mutate a newer open Run
  -- created after the application read. NULL preserves create/schedule behavior.
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

  if p_learner_profile_ids is null then
    select coalesce(
      array_agg(
        course_learner.learner_profile_id
        order by course_learner.learner_profile_id
      ),
      '{}'::uuid[]
    )
    into v_selected_ids
    from public.course_learner as course_learner
    where course_learner.course_id = v_course_id;
  else
    select coalesce(
      array_agg(requested.id order by requested.id),
      '{}'::uuid[]
    )
    into v_selected_ids
    from (
      select distinct requested_id as id
      from unnest(p_learner_profile_ids) as requested(requested_id)
    ) as requested;

    if exists (
      select 1
      from unnest(v_selected_ids) as requested(id)
      left join public.course_learner as course_learner
        on course_learner.course_id = v_course_id
        and course_learner.learner_profile_id = requested.id
      where course_learner.learner_profile_id is null
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

  if v_run.id is not null then
    perform 1
    from public.learning_record as record
    where record.lesson_run_id = v_run.id
    order by record.id
    for update;

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
-- Start, complete, cancel and delete. Every path uses the same parent-first
-- lock order: Lesson, then Run, then LearningRecord rows by UUID.
-- -----------------------------------------------------------------------------

create function public.start_lesson_run(
  p_lesson_run_id uuid,
  p_started_at timestamptz default now()
)
returns public.lesson_run
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_user_id uuid := (select auth.uid());
  v_lesson_id uuid;
  v_run public.lesson_run%rowtype;
begin
  if v_actor_user_id is null then
    raise exception 'lesson_run_not_found' using errcode = 'P0002';
  end if;

  if p_started_at is null then
    raise exception
      'lesson_run_started_at_required'
      using errcode = '22023';
  end if;

  select run.lesson_id
  into v_lesson_id
  from public.lesson_run as run
  join public.lesson as lesson on lesson.id = run.lesson_id
  join public.course as course on course.id = lesson.course_id
  join public.account as account on account.id = course.owner_account_id
  where run.id = p_lesson_run_id
    and account.auth_user_id = v_actor_user_id;

  if not found then
    raise exception 'lesson_run_not_found' using errcode = 'P0002';
  end if;

  perform 1
  from public.lesson as lesson
  join public.course as course on course.id = lesson.course_id
  join public.account as account on account.id = course.owner_account_id
  where lesson.id = v_lesson_id
    and account.auth_user_id = v_actor_user_id
  for update of lesson;

  if not found then
    raise exception 'lesson_run_not_found' using errcode = 'P0002';
  end if;

  select run.*
  into v_run
  from public.lesson_run as run
  where run.id = p_lesson_run_id
    and run.lesson_id = v_lesson_id
  for update of run;

  if not found then
    raise exception 'lesson_run_not_found' using errcode = 'P0002';
  end if;

  if v_run.cancelled_at is not null or v_run.ended_at is not null then
    raise exception
      'lesson_run_not_open'
      using errcode = '55000';
  end if;

  if v_run.started_at is null then
    update public.lesson_run as run
    set started_at = p_started_at
    where run.id = p_lesson_run_id
    returning run.* into v_run;
  end if;

  return v_run;
end
$$;

create function public.complete_lesson_run(
  p_lesson_run_id uuid,
  p_records jsonb,
  p_teacher_report text default null,
  p_ended_at timestamptz default now()
)
returns public.lesson_run
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_user_id uuid := (select auth.uid());
  v_lesson_id uuid;
  v_course_id uuid;
  v_course_title text;
  v_lesson_title text;
  v_subject text;
  v_run public.lesson_run%rowtype;
begin
  if v_actor_user_id is null then
    raise exception 'lesson_run_not_found' using errcode = 'P0002';
  end if;

  if p_ended_at is null then
    raise exception
      'lesson_run_ended_at_required'
      using errcode = '22023';
  end if;

  if p_records is null or jsonb_typeof(p_records) <> 'array' then
    raise exception
      'lesson_run_records_must_be_array'
      using errcode = '22023';
  end if;

  if jsonb_array_length(p_records) > 200 then
    raise exception
      'lesson_run_records_too_large'
      using errcode = '22023';
  end if;

  if jsonb_array_length(p_records) = 0 then
    raise exception
      'lesson_run_requires_expected_learner'
      using errcode = '23514';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_records) as submitted(value)
    where jsonb_typeof(submitted.value) is distinct from 'object'
      or jsonb_typeof(
        submitted.value -> 'learnerProfileId'
      ) is distinct from 'string'
      or jsonb_typeof(
        submitted.value -> 'wasPresent'
      ) is distinct from 'boolean'
      or (
        submitted.value ? 'needsRepeat'
        and coalesce(
          jsonb_typeof(submitted.value -> 'needsRepeat'),
          'null'
        ) not in ('boolean', 'null')
      )
      or (
        submitted.value ? 'teacherComment'
        and coalesce(
          jsonb_typeof(submitted.value -> 'teacherComment'),
          'null'
        ) not in ('string', 'null')
      )
  ) then
    raise exception
      'lesson_run_record_shape_invalid'
      using errcode = '22023';
  end if;

  if (
    select count(*)
    from jsonb_array_elements(p_records) as submitted(value)
  ) <> (
    select count(distinct (submitted.value ->> 'learnerProfileId')::uuid)
    from jsonb_array_elements(p_records) as submitted(value)
  ) then
    raise exception
      'lesson_run_record_learner_duplicate'
      using errcode = '22023';
  end if;

  select run.lesson_id
  into v_lesson_id
  from public.lesson_run as run
  join public.lesson as lesson on lesson.id = run.lesson_id
  join public.course as course on course.id = lesson.course_id
  join public.account as account on account.id = course.owner_account_id
  where run.id = p_lesson_run_id
    and account.auth_user_id = v_actor_user_id;

  if not found then
    raise exception 'lesson_run_not_found' using errcode = 'P0002';
  end if;

  select
    course.id,
    course.title,
    lesson.title,
    course.subject
  into
    v_course_id,
    v_course_title,
    v_lesson_title,
    v_subject
  from public.lesson as lesson
  join public.course as course on course.id = lesson.course_id
  join public.account as account on account.id = course.owner_account_id
  where lesson.id = v_lesson_id
    and account.auth_user_id = v_actor_user_id
  for update of lesson;

  if not found then
    raise exception 'lesson_run_not_found' using errcode = 'P0002';
  end if;

  select run.*
  into v_run
  from public.lesson_run as run
  where run.id = p_lesson_run_id
    and run.lesson_id = v_lesson_id
  for update of run;

  if not found then
    raise exception 'lesson_run_not_found' using errcode = 'P0002';
  end if;

  -- A successful completion may be retried safely; finalized history remains
  -- immutable through this RPC.
  if v_run.ended_at is not null then
    return v_run;
  end if;

  if v_run.cancelled_at is not null then
    raise exception
      'lesson_run_not_open'
      using errcode = '55000';
  end if;

  if v_run.started_at is not null and p_ended_at < v_run.started_at then
    raise exception
      'lesson_run_ended_before_start'
      using errcode = '22007';
  end if;

  perform 1
  from public.learning_record as record
  where record.lesson_run_id = p_lesson_run_id
  order by record.id
  for update;

  if exists (
    select 1
    from public.learning_record as record
    where record.lesson_run_id = p_lesson_run_id
      and record.occurred_at is not null
  ) then
    raise exception
      'lesson_run_contains_finalized_records'
      using errcode = '55000';
  end if;

  -- Completion must cover exactly the expected rows: no omitted, duplicated,
  -- foreign, or newly injected learner ID is accepted.
  if (
    select count(*)
    from public.learning_record as record
    where record.lesson_run_id = p_lesson_run_id
  ) <> jsonb_array_length(p_records)
    or exists (
      select 1
      from jsonb_array_elements(p_records) as submitted(value)
      left join public.learning_record as record
        on record.lesson_run_id = p_lesson_run_id
        and record.learner_profile_id =
          (submitted.value ->> 'learnerProfileId')::uuid
      where record.id is null
    )
  then
    raise exception
      'lesson_run_records_do_not_match_expected_learners'
      using errcode = '23514';
  end if;

  update public.learning_record as record
  set occurred_at = p_ended_at,
      was_present = (submitted.value ->> 'wasPresent')::boolean,
      needs_repeat = case
        when jsonb_typeof(submitted.value -> 'needsRepeat') = 'boolean'
          then (submitted.value ->> 'needsRepeat')::boolean
        else null
      end,
      teacher_comment = case
        when jsonb_typeof(submitted.value -> 'teacherComment') = 'string'
          then nullif(btrim(submitted.value ->> 'teacherComment'), '')
        else null
      end,
      course_title_at_time = v_course_title,
      lesson_title_at_time = v_lesson_title,
      subject_at_time = v_subject
  from jsonb_array_elements(p_records) as submitted(value)
  where record.lesson_run_id = p_lesson_run_id
    and record.learner_profile_id =
      (submitted.value ->> 'learnerProfileId')::uuid;

  update public.lesson_run as run
  set started_at = coalesce(
        run.started_at,
        least(run.scheduled_at, p_ended_at)
      ),
      ended_at = p_ended_at,
      teacher_report = nullif(btrim(p_teacher_report), '')
  where run.id = p_lesson_run_id
  returning run.* into v_run;

  return v_run;
end
$$;

create function public.cancel_lesson_run(
  p_lesson_run_id uuid,
  p_cancelled_at timestamptz default now()
)
returns public.lesson_run
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_user_id uuid := (select auth.uid());
  v_lesson_id uuid;
  v_run public.lesson_run%rowtype;
begin
  if v_actor_user_id is null then
    raise exception 'lesson_run_not_found' using errcode = 'P0002';
  end if;

  if p_cancelled_at is null then
    raise exception
      'lesson_run_cancelled_at_required'
      using errcode = '22023';
  end if;

  select run.lesson_id
  into v_lesson_id
  from public.lesson_run as run
  join public.lesson as lesson on lesson.id = run.lesson_id
  join public.course as course on course.id = lesson.course_id
  join public.account as account on account.id = course.owner_account_id
  where run.id = p_lesson_run_id
    and account.auth_user_id = v_actor_user_id;

  if not found then
    raise exception 'lesson_run_not_found' using errcode = 'P0002';
  end if;

  perform 1
  from public.lesson as lesson
  join public.course as course on course.id = lesson.course_id
  join public.account as account on account.id = course.owner_account_id
  where lesson.id = v_lesson_id
    and account.auth_user_id = v_actor_user_id
  for update of lesson;

  if not found then
    raise exception 'lesson_run_not_found' using errcode = 'P0002';
  end if;

  select run.*
  into v_run
  from public.lesson_run as run
  where run.id = p_lesson_run_id
    and run.lesson_id = v_lesson_id
  for update of run;

  if not found then
    raise exception 'lesson_run_not_found' using errcode = 'P0002';
  end if;

  if v_run.cancelled_at is not null then
    return v_run;
  end if;

  if v_run.ended_at is not null then
    raise exception
      'lesson_run_already_completed'
      using errcode = '55000';
  end if;

  if v_run.started_at is not null
    and p_cancelled_at < v_run.started_at
  then
    raise exception
      'lesson_run_cancelled_before_start'
      using errcode = '22007';
  end if;

  perform 1
  from public.learning_record as record
  where record.lesson_run_id = p_lesson_run_id
  order by record.id
  for update;

  if exists (
    select 1
    from public.learning_record as record
    where record.lesson_run_id = p_lesson_run_id
      and record.occurred_at is not null
  ) then
    raise exception
      'lesson_run_contains_finalized_records'
      using errcode = '55000';
  end if;

  delete from public.learning_record as record
  where record.lesson_run_id = p_lesson_run_id
    and record.occurred_at is null;

  update public.lesson_run as run
  set cancelled_at = p_cancelled_at
  where run.id = p_lesson_run_id
  returning run.* into v_run;

  return v_run;
end
$$;

create function public.delete_lesson_with_history(
  p_lesson_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_user_id uuid := (select auth.uid());
begin
  if v_actor_user_id is null then
    raise exception 'lesson_not_found' using errcode = 'P0002';
  end if;

  perform 1
  from public.lesson as lesson
  join public.course as course on course.id = lesson.course_id
  join public.account as account on account.id = course.owner_account_id
  where lesson.id = p_lesson_id
    and account.auth_user_id = v_actor_user_id
  for update of lesson;

  if not found then
    raise exception 'lesson_not_found' using errcode = 'P0002';
  end if;

  -- Cascades delete Components, Slides and Runs. The Run BEFORE DELETE trigger
  -- removes drafts; finalized records retain learner data and course source,
  -- while lesson_run_id/source_lesson_id become NULL through their FKs.
  delete from public.lesson as lesson
  where lesson.id = p_lesson_id;

  return true;
end
$$;

-- SECURITY DEFINER functions are closed by default despite legacy broad
-- default privileges in this project. Only a signed-in owner may execute them.
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
revoke all on function public.start_lesson_run(uuid, timestamptz)
from public, anon, authenticated, service_role;
revoke all on function public.complete_lesson_run(
  uuid,
  jsonb,
  text,
  timestamptz
)
from public, anon, authenticated, service_role;
revoke all on function public.cancel_lesson_run(uuid, timestamptz)
from public, anon, authenticated, service_role;
revoke all on function public.delete_lesson_with_history(uuid)
from public, anon, authenticated, service_role;

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
grant execute on function public.start_lesson_run(uuid, timestamptz)
to authenticated;
grant execute on function public.complete_lesson_run(
  uuid,
  jsonb,
  text,
  timestamptz
)
to authenticated;
grant execute on function public.cancel_lesson_run(uuid, timestamptz)
to authenticated;
grant execute on function public.delete_lesson_with_history(uuid)
to authenticated;

-- Refresh PostgREST relationships and RPC signatures after commit.
notify pgrst, 'reload schema';

-- -----------------------------------------------------------------------------
-- Migration postflight: shape, RLS, ACL, and the deliberately absent parallel
-- participant/status/snapshot models.
-- -----------------------------------------------------------------------------

do $$
declare
  v_table text;
  v_function regprocedure;
begin
  foreach v_table in array array[
    'learner_profile',
    'course_learner',
    'lesson_run',
    'learning_record'
  ]
  loop
    if to_regclass('public.' || v_table) is null then
      raise exception
        'lesson_run_postflight_failed: missing table %',
        v_table;
    end if;

    if not exists (
      select 1
      from pg_class
      where oid = to_regclass('public.' || v_table)
        and relrowsecurity
    ) then
      raise exception
        'lesson_run_postflight_failed: RLS disabled on %',
        v_table;
    end if;

    if has_table_privilege('anon', 'public.' || v_table, 'SELECT') then
      raise exception
        'lesson_run_postflight_failed: anon can select %',
        v_table;
    end if;
  end loop;

  if not has_table_privilege(
    'authenticated',
    'public.learner_profile',
    'SELECT,INSERT,UPDATE'
  ) or not has_table_privilege(
    'authenticated',
    'public.course_learner',
    'SELECT'
  ) or not has_table_privilege(
    'authenticated',
    'public.lesson_run',
    'SELECT'
  ) or not has_table_privilege(
    'authenticated',
    'public.learning_record',
    'SELECT'
  ) then
    raise exception
      'lesson_run_postflight_failed: authenticated grants are incomplete';
  end if;

  if has_table_privilege(
    'authenticated',
    'public.learner_profile',
    'DELETE'
  ) then
    raise exception
      'lesson_run_postflight_failed: direct learner profile deletion is exposed';
  end if;

  if has_table_privilege(
    'authenticated',
    'public.course_learner',
    'INSERT,UPDATE,DELETE'
  ) or has_table_privilege(
    'authenticated',
    'public.lesson_run',
    'INSERT,UPDATE,DELETE'
  ) or has_table_privilege(
    'authenticated',
    'public.learning_record',
    'INSERT,UPDATE,DELETE'
  ) then
    raise exception
      'lesson_run_postflight_failed: direct runtime mutation is exposed';
  end if;

  foreach v_function in array array[
    'public.replace_course_learners(uuid,uuid[])'::regprocedure,
    'public.schedule_lesson_run(uuid,timestamptz,integer,uuid[],uuid)'::regprocedure,
    'public.start_lesson_run(uuid,timestamptz)'::regprocedure,
    'public.complete_lesson_run(uuid,jsonb,text,timestamptz)'::regprocedure,
    'public.cancel_lesson_run(uuid,timestamptz)'::regprocedure,
    'public.delete_lesson_with_history(uuid)'::regprocedure
  ]
  loop
    if not has_function_privilege(
      'authenticated',
      v_function,
      'EXECUTE'
    ) or has_function_privilege('anon', v_function, 'EXECUTE') then
      raise exception
        'lesson_run_postflight_failed: bad execute ACL on %',
        v_function;
    end if;
  end loop;

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
      'lesson_run_postflight_failed: parallel participant/status/snapshot model exists';
  end if;

  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and indexname = 'lesson_run_one_open_per_lesson_idx'
      and indexdef ilike '%where ((ended_at is null) and (cancelled_at is null))%'
  ) then
    raise exception
      'lesson_run_postflight_failed: one-open-run invariant is missing';
  end if;
end
$$;

commit;
