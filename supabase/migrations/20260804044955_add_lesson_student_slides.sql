begin;

-- Student Screen groups the canonical ordered Lesson components into ordered
-- presentation slides. A slide is not a Lesson Step: it has no title, content,
-- teacher instructions, or independent component ordering. The Lesson's
-- component.position remains the only authored order.

-- -----------------------------------------------------------------------------
-- ShiDao/source-shape preflight. This must fail before the first persistent
-- write when pointed at anything except the expected post-cutover database.
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
      ('stored_file'),
      ('course_attachment'),
      ('parent'),
      ('teacher'),
      ('school'),
      ('class'),
      ('student')
  ) as expected(name)
  where to_regclass('public.' || expected.name) is null;

  if v_missing_tables is not null then
    raise exception
      'shidao_schema_sanity_failed: missing expected tables: %',
      v_missing_tables;
  end if;

  if to_regclass('public.lesson_student_slide') is not null then
    raise exception
      'shidao_schema_sanity_failed: lesson_student_slide already exists';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'lesson_component'
      and column_name = 'student_slide_id'
  ) then
    raise exception
      'shidao_schema_sanity_failed: lesson_component.student_slide_id already exists';
  end if;

  if to_regclass('public.lesson_step') is not null
    or to_regclass('public.methodology') is not null
  then
    raise exception
      'shidao_schema_sanity_failed: legacy Lesson Step or Methodology tables remain';
  end if;

  if to_regprocedure(
    'public.assemble_course_draft(uuid,text,text,jsonb)'
  ) is null
    or to_regprocedure(
      'public.reorder_lesson_component(uuid,integer)'
    ) is null
  then
    raise exception
      'shidao_schema_sanity_failed: canonical Course Builder functions are missing';
  end if;

  if exists (
    select 1
    from pg_depend as dependency
    where dependency.refclassid = 'pg_proc'::regclass
      and dependency.refobjid =
        'public.reorder_lesson_component(uuid,integer)'::regprocedure
  ) then
    raise exception
      'shidao_schema_sanity_failed: reorder_lesson_component has dependents';
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

-- Serialize schema/backfill setup with authored document mutations.
lock table public.lesson, public.lesson_component in share row exclusive mode;

-- -----------------------------------------------------------------------------
-- Ordered Student Screen slide projection.
-- -----------------------------------------------------------------------------

create table public.lesson_student_slide (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lesson(id) on delete cascade,
  position integer not null check (position > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lesson_student_slide_id_lesson_unique
    unique (id, lesson_id),
  constraint lesson_student_slide_lesson_position_unique
    unique (lesson_id, position) deferrable initially deferred
);

alter table public.lesson_component
  add column student_slide_id uuid null;

-- Preserve the learner projection that existed before slides: every Lesson
-- with learner-visible content receives slide 1 and all of its visible
-- components are linked to it. Staff-only components remain unassigned.
insert into public.lesson_student_slide (lesson_id, position)
select distinct component.lesson_id, 1
from public.lesson_component as component
where component.visibility = 'learner_visible'
order by component.lesson_id;

update public.lesson_component as component
set student_slide_id = slide.id
from public.lesson_student_slide as slide
where slide.lesson_id = component.lesson_id
  and slide.position = 1
  and component.visibility = 'learner_visible';

alter table public.lesson_component
  alter column visibility set default 'staff_only',
  add constraint lesson_component_student_screen_assignment_check
    check (
      (visibility = 'staff_only' and student_slide_id is null)
      or
      (visibility = 'learner_visible' and student_slide_id is not null)
    ),
  add constraint lesson_component_student_slide_id_fkey
    foreign key (student_slide_id, lesson_id)
    references public.lesson_student_slide(id, lesson_id)
    deferrable initially deferred;

create index lesson_component_student_slide_id_idx
  on public.lesson_component (student_slide_id)
  where student_slide_id is not null;

alter table public.lesson_student_slide enable row level security;

create policy lesson_student_slide_course_owner_select
on public.lesson_student_slide
for select to authenticated
using (
  exists (
    select 1
    from public.lesson
    join public.course on course.id = lesson.course_id
    where lesson.id = lesson_student_slide.lesson_id
      and course.owner_account_id = (select public.current_account_id())
  )
);

revoke all on table public.lesson_student_slide
from public, anon, authenticated;
grant select on table public.lesson_student_slide to authenticated;
grant all on table public.lesson_student_slide to service_role;

-- Authenticated callers may create only private components through the table
-- API. Student Screen assignment is reserved for the serialized RPC below.
create policy lesson_component_staff_only_insert_guard
on public.lesson_component
as restrictive
for insert to authenticated
with check (
  visibility = 'staff_only'
  and student_slide_id is null
);

revoke all on table public.lesson_component
from public, anon, authenticated;
grant select on table public.lesson_component to authenticated;
grant insert (
  lesson_id,
  type_key,
  schema_version,
  position,
  payload,
  placement_config
) on table public.lesson_component to authenticated;
grant update (payload, placement_config)
on table public.lesson_component to authenticated;

-- A Lesson/Course cascade does not need sibling compaction after the parent
-- Lesson has disappeared. Returning early also keeps that cascade compatible
-- with the deliberately narrow authenticated column UPDATE grant above.
create or replace function public.compact_lesson_component_positions()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.lesson as lesson
    where lesson.id = old.lesson_id
  ) then
    return old;
  end if;

  update public.lesson_component
  set position = position - 1
  where lesson_id = old.lesson_id
    and position > old.position;
  return old;
end
$$;

create trigger trg_lesson_student_slide_updated_at
before update on public.lesson_student_slide
for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Deferred whole-Lesson invariant. This permits atomic multi-row reorder and
-- slide insertion while rejecting any final state with cross-Lesson links,
-- empty/gapped slides, or decreasing slide positions in component plan order.
-- -----------------------------------------------------------------------------

create function public.enforce_lesson_student_screen_invariants()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_lesson_id uuid;
begin
  for v_lesson_id in
    select distinct candidate.lesson_id
    from (
      select case when tg_op <> 'DELETE' then new.lesson_id end as lesson_id
      union all
      select case when tg_op <> 'INSERT' then old.lesson_id end
    ) as candidate
    where candidate.lesson_id is not null
  loop
    -- During ON DELETE CASCADE the parent Lesson may already be gone.
    if not exists (
      select 1 from public.lesson where lesson.id = v_lesson_id
    ) then
      continue;
    end if;

    if exists (
      select 1
      from public.lesson_component as component
      left join public.lesson_student_slide as slide
        on slide.id = component.student_slide_id
      where component.lesson_id = v_lesson_id
        and (
          (component.visibility = 'staff_only'
            and component.student_slide_id is not null)
          or
          (component.visibility = 'learner_visible'
            and (
              component.student_slide_id is null
              or slide.id is null
              or slide.lesson_id <> component.lesson_id
            ))
        )
    ) then
      raise exception
        'lesson_student_screen_assignment_inconsistent'
        using errcode = '23514';
    end if;

    if exists (
      select 1
      from public.lesson_student_slide as slide
      where slide.lesson_id = v_lesson_id
        and not exists (
          select 1
          from public.lesson_component as component
          where component.student_slide_id = slide.id
            and component.visibility = 'learner_visible'
        )
    ) then
      raise exception
        'lesson_student_screen_contains_empty_slide'
        using errcode = '23514';
    end if;

    if exists (
      select 1
      from public.lesson_student_slide as slide
      where slide.lesson_id = v_lesson_id
      group by slide.lesson_id
      having min(slide.position) <> 1
        or max(slide.position) <> count(*)
        or count(distinct slide.position) <> count(*)
    ) then
      raise exception
        'lesson_student_slide_positions_are_not_dense'
        using errcode = '23514';
    end if;

    if exists (
      with visible_components as (
        select
          component.position,
          slide.position as slide_position,
          lag(slide.position) over (
            order by component.position
          ) as previous_slide_position
        from public.lesson_component as component
        join public.lesson_student_slide as slide
          on slide.id = component.student_slide_id
        where component.lesson_id = v_lesson_id
          and component.visibility = 'learner_visible'
      )
      select 1
      from visible_components
      where previous_slide_position > slide_position
    ) then
      raise exception
        'lesson_student_slide_order_conflict'
        using errcode = '23514';
    end if;
  end loop;

  return null;
end
$$;

revoke all on function public.enforce_lesson_student_screen_invariants()
from public, anon, authenticated;

create constraint trigger trg_lesson_component_student_screen_invariants
after insert or update of lesson_id, position, visibility, student_slide_id
or delete on public.lesson_component
deferrable initially deferred
for each row execute function public.enforce_lesson_student_screen_invariants();

create constraint trigger trg_lesson_student_slide_invariants
after insert or update of lesson_id, position
or delete on public.lesson_student_slide
deferrable initially deferred
for each row execute function public.enforce_lesson_student_screen_invariants();

-- Any mutation that unlinks the final visible component from a slide removes
-- that empty projection row and compacts the remaining slide positions.
create function public.cleanup_empty_lesson_student_slide()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.student_slide_id is null
    or not exists (
      select 1 from public.lesson where lesson.id = old.lesson_id
    )
  then
    return old;
  end if;

  delete from public.lesson_student_slide as slide
  where slide.id = old.student_slide_id
    and slide.lesson_id = old.lesson_id
    and not exists (
      select 1
      from public.lesson_component as component
      where component.student_slide_id = slide.id
        and component.visibility = 'learner_visible'
    );

  if found then
    with ordered as (
      select
        slide.id,
        row_number() over (order by slide.position, slide.id)::integer
          as new_position
      from public.lesson_student_slide as slide
      where slide.lesson_id = old.lesson_id
    )
    update public.lesson_student_slide as slide
    set position = ordered.new_position
    from ordered
    where slide.id = ordered.id
      and slide.position <> ordered.new_position;
  end if;

  return old;
end
$$;

revoke all on function public.cleanup_empty_lesson_student_slide()
from public, anon, authenticated;

create trigger trg_lesson_component_cleanup_empty_student_slide
after delete or update of lesson_id, visibility, student_slide_id
on public.lesson_component
for each row execute function public.cleanup_empty_lesson_student_slide();

-- -----------------------------------------------------------------------------
-- Assign/hide a component on Student Screen. Existing targets are legal only
-- inside the nearest visible predecessor/successor slide range. A new slide is
-- inserted between those ranges; it cannot split neighbors already grouped on
-- one slide.
-- -----------------------------------------------------------------------------

create function public.set_lesson_component_student_screen(
  p_component_id uuid,
  p_mode text,
  p_slide_id uuid default null
)
returns table (
  id uuid,
  lesson_id uuid,
  type_key text,
  schema_version integer,
  "position" integer,
  payload jsonb,
  placement_config jsonb,
  visibility text,
  student_slide_id uuid,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_user_id uuid := (select auth.uid());
  v_lesson_id uuid;
  v_component_position integer;
  v_previous_slide_position integer;
  v_next_slide_position integer;
  v_target_slide_position integer;
  v_target_slide_id uuid;
  v_insert_position integer;
begin
  if v_actor_user_id is null then
    raise exception 'component_not_found' using errcode = 'P0002';
  end if;

  if p_mode is null or p_mode not in ('hide', 'existing', 'new') then
    raise exception
      'student_screen_mode_invalid'
      using errcode = '22023';
  end if;

  if (p_mode = 'existing' and p_slide_id is null)
    or (p_mode <> 'existing' and p_slide_id is not null)
  then
    raise exception
      'student_screen_slide_argument_invalid'
      using errcode = '22023';
  end if;

  select component.lesson_id
  into v_lesson_id
  from public.lesson_component as component
  join public.lesson as lesson on lesson.id = component.lesson_id
  join public.course as course on course.id = lesson.course_id
  join public.account as account on account.id = course.owner_account_id
  where component.id = p_component_id
    and account.auth_user_id = v_actor_user_id;

  if not found then
    raise exception 'component_not_found' using errcode = 'P0002';
  end if;

  -- Parent-row serialization gives assignment and reorder one lock order per
  -- Lesson, including when callers target different components.
  perform 1
  from public.lesson as lesson
  join public.course as course on course.id = lesson.course_id
  join public.account as account on account.id = course.owner_account_id
  where lesson.id = v_lesson_id
    and account.auth_user_id = v_actor_user_id
  for update of lesson;

  if not found then
    raise exception 'component_not_found' using errcode = 'P0002';
  end if;

  perform 1
  from public.lesson_component as component
  where component.lesson_id = v_lesson_id
  order by component.id
  for update;

  perform 1
  from public.lesson_student_slide as slide
  where slide.lesson_id = v_lesson_id
  order by slide.id
  for update;

  select component.position
  into v_component_position
  from public.lesson_component as component
  where component.id = p_component_id
    and component.lesson_id = v_lesson_id;

  if not found then
    raise exception 'component_not_found' using errcode = 'P0002';
  end if;

  if p_mode = 'hide' then
    update public.lesson_component as component
    set visibility = 'staff_only',
        student_slide_id = null
    where component.id = p_component_id;
  else
    select slide.position
    into v_previous_slide_position
    from public.lesson_component as component
    join public.lesson_student_slide as slide
      on slide.id = component.student_slide_id
    where component.lesson_id = v_lesson_id
      and component.id <> p_component_id
      and component.visibility = 'learner_visible'
      and component.position < v_component_position
    order by component.position desc
    limit 1;

    select slide.position
    into v_next_slide_position
    from public.lesson_component as component
    join public.lesson_student_slide as slide
      on slide.id = component.student_slide_id
    where component.lesson_id = v_lesson_id
      and component.id <> p_component_id
      and component.visibility = 'learner_visible'
      and component.position > v_component_position
    order by component.position
    limit 1;

    if p_mode = 'existing' then
      select slide.position
      into v_target_slide_position
      from public.lesson_student_slide as slide
      where slide.id = p_slide_id
        and slide.lesson_id = v_lesson_id;

      if not found then
        raise exception
          'student_slide_not_found'
          using errcode = 'P0002';
      end if;

      if (
        v_previous_slide_position is not null
        and v_target_slide_position < v_previous_slide_position
      ) or (
        v_next_slide_position is not null
        and v_target_slide_position > v_next_slide_position
      ) then
        raise exception
          'student_slide_target_out_of_order'
          using errcode = '23514';
      end if;

      v_target_slide_id := p_slide_id;
    else
      if v_previous_slide_position is not null
        and v_next_slide_position is not null
        and v_previous_slide_position = v_next_slide_position
      then
        raise exception
          'student_slide_cannot_split_group'
          using errcode = '23514';
      end if;

      v_insert_position := case
        when v_next_slide_position is not null
          then v_next_slide_position
        when v_previous_slide_position is not null
          then v_previous_slide_position + 1
        else 1
      end;

      update public.lesson_student_slide as slide
      set position = slide.position + 1
      where slide.lesson_id = v_lesson_id
        and slide.position >= v_insert_position;

      insert into public.lesson_student_slide as inserted_slide (
        lesson_id,
        position
      )
      values (v_lesson_id, v_insert_position)
      returning inserted_slide.id into v_target_slide_id;
    end if;

    update public.lesson_component as component
    set visibility = 'learner_visible',
        student_slide_id = v_target_slide_id
    where component.id = p_component_id;
  end if;

  return query
  select
    component.id,
    component.lesson_id,
    component.type_key,
    component.schema_version,
    component.position,
    component.payload,
    component.placement_config,
    component.visibility,
    component.student_slide_id,
    component.created_at,
    component.updated_at
  from public.lesson_component as component
  where component.id = p_component_id;
end
$$;

revoke all on function public.set_lesson_component_student_screen(
  uuid,
  text,
  uuid
) from public, anon, authenticated, service_role;
grant execute on function public.set_lesson_component_student_screen(
  uuid,
  text,
  uuid
) to authenticated;

-- -----------------------------------------------------------------------------
-- Reorder remains the one component-list mutation. A moved visible component
-- is clamped into the legal neighboring slide range, then normal cleanup
-- removes a slide it left empty and compacts slide positions.
-- -----------------------------------------------------------------------------

drop function public.reorder_lesson_component(uuid, integer);

create function public.reorder_lesson_component(
  p_component_id uuid,
  p_new_position integer
)
returns table (
  id uuid,
  lesson_id uuid,
  type_key text,
  schema_version integer,
  "position" integer,
  payload jsonb,
  placement_config jsonb,
  visibility text,
  student_slide_id uuid,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_user_id uuid := (select auth.uid());
  v_lesson_id uuid;
  v_old_position integer;
  v_component_count integer;
  v_visibility text;
  v_student_slide_id uuid;
  v_current_slide_position integer;
  v_previous_slide_position integer;
  v_next_slide_position integer;
  v_clamped_slide_position integer;
  v_clamped_slide_id uuid;
begin
  if v_actor_user_id is null then
    raise exception 'component_not_found' using errcode = 'P0002';
  end if;

  if p_new_position is null or p_new_position < 1 then
    raise exception
      'component_position_out_of_range'
      using errcode = '22023';
  end if;

  select component.lesson_id
  into v_lesson_id
  from public.lesson_component as component
  join public.lesson as lesson on lesson.id = component.lesson_id
  join public.course as course on course.id = lesson.course_id
  join public.account as account on account.id = course.owner_account_id
  where component.id = p_component_id
    and account.auth_user_id = v_actor_user_id;

  if not found then
    raise exception 'component_not_found' using errcode = 'P0002';
  end if;

  perform 1
  from public.lesson as lesson
  join public.course as course on course.id = lesson.course_id
  join public.account as account on account.id = course.owner_account_id
  where lesson.id = v_lesson_id
    and account.auth_user_id = v_actor_user_id
  for update of lesson;

  if not found then
    raise exception 'component_not_found' using errcode = 'P0002';
  end if;

  perform 1
  from public.lesson_component as component
  where component.lesson_id = v_lesson_id
  order by component.id
  for update;

  perform 1
  from public.lesson_student_slide as slide
  where slide.lesson_id = v_lesson_id
  order by slide.id
  for update;

  select
    component.position,
    component.visibility,
    component.student_slide_id
  into v_old_position, v_visibility, v_student_slide_id
  from public.lesson_component as component
  where component.id = p_component_id
    and component.lesson_id = v_lesson_id;

  if not found then
    raise exception 'component_not_found' using errcode = 'P0002';
  end if;

  select count(*)::integer
  into v_component_count
  from public.lesson_component as component
  where component.lesson_id = v_lesson_id;

  if p_new_position > v_component_count then
    raise exception
      'component_position_out_of_range'
      using errcode = '22023';
  end if;

  if p_new_position < v_old_position then
    update public.lesson_component as component
    set position = component.position + 1
    where component.lesson_id = v_lesson_id
      and component.position >= p_new_position
      and component.position < v_old_position;
  elsif p_new_position > v_old_position then
    update public.lesson_component as component
    set position = component.position - 1
    where component.lesson_id = v_lesson_id
      and component.position > v_old_position
      and component.position <= p_new_position;
  end if;

  update public.lesson_component as component
  set position = p_new_position
  where component.id = p_component_id;

  if v_visibility = 'learner_visible' then
    select slide.position
    into v_current_slide_position
    from public.lesson_student_slide as slide
    where slide.id = v_student_slide_id
      and slide.lesson_id = v_lesson_id;

    select slide.position
    into v_previous_slide_position
    from public.lesson_component as component
    join public.lesson_student_slide as slide
      on slide.id = component.student_slide_id
    where component.lesson_id = v_lesson_id
      and component.id <> p_component_id
      and component.visibility = 'learner_visible'
      and component.position < p_new_position
    order by component.position desc
    limit 1;

    select slide.position
    into v_next_slide_position
    from public.lesson_component as component
    join public.lesson_student_slide as slide
      on slide.id = component.student_slide_id
    where component.lesson_id = v_lesson_id
      and component.id <> p_component_id
      and component.visibility = 'learner_visible'
      and component.position > p_new_position
    order by component.position
    limit 1;

    v_clamped_slide_position := v_current_slide_position;

    if v_previous_slide_position is not null
      and v_clamped_slide_position < v_previous_slide_position
    then
      v_clamped_slide_position := v_previous_slide_position;
    end if;

    if v_next_slide_position is not null
      and v_clamped_slide_position > v_next_slide_position
    then
      v_clamped_slide_position := v_next_slide_position;
    end if;

    if v_clamped_slide_position <> v_current_slide_position then
      select slide.id
      into v_clamped_slide_id
      from public.lesson_student_slide as slide
      where slide.lesson_id = v_lesson_id
        and slide.position = v_clamped_slide_position;

      update public.lesson_component as component
      set student_slide_id = v_clamped_slide_id
      where component.id = p_component_id;
    end if;
  end if;

  return query
  select
    component.id,
    component.lesson_id,
    component.type_key,
    component.schema_version,
    component.position,
    component.payload,
    component.placement_config,
    component.visibility,
    component.student_slide_id,
    component.created_at,
    component.updated_at
  from public.lesson_component as component
  where component.id = p_component_id
    and component.lesson_id = v_lesson_id;
end
$$;

revoke all on function public.reorder_lesson_component(uuid, integer)
from public, anon, authenticated, service_role;
grant execute on function public.reorder_lesson_component(uuid, integer)
to authenticated;

-- -----------------------------------------------------------------------------
-- Delete under the same Lesson-first lock order as assignment and reorder.
-- This prevents two concurrent last-component removals from both observing a
-- non-empty slide and leaving an empty projection row behind.
-- -----------------------------------------------------------------------------

create function public.delete_lesson_component(p_component_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_user_id uuid := (select auth.uid());
  v_lesson_id uuid;
  v_deleted_count integer;
begin
  if v_actor_user_id is null then
    return false;
  end if;

  select component.lesson_id
  into v_lesson_id
  from public.lesson_component as component
  join public.lesson as lesson on lesson.id = component.lesson_id
  join public.course as course on course.id = lesson.course_id
  join public.account as account on account.id = course.owner_account_id
  where component.id = p_component_id
    and account.auth_user_id = v_actor_user_id;

  if not found then
    return false;
  end if;

  perform 1
  from public.lesson as lesson
  join public.course as course on course.id = lesson.course_id
  join public.account as account on account.id = course.owner_account_id
  where lesson.id = v_lesson_id
    and account.auth_user_id = v_actor_user_id
  for update of lesson;

  if not found then
    return false;
  end if;

  perform 1
  from public.lesson_component as component
  where component.lesson_id = v_lesson_id
  order by component.id
  for update;

  perform 1
  from public.lesson_student_slide as slide
  where slide.lesson_id = v_lesson_id
  order by slide.id
  for update;

  delete from public.lesson_component as component
  where component.id = p_component_id
    and component.lesson_id = v_lesson_id;

  get diagnostics v_deleted_count = row_count;
  return v_deleted_count = 1;
end
$$;

revoke all on function public.delete_lesson_component(uuid)
from public, anon, authenticated, service_role;
grant execute on function public.delete_lesson_component(uuid)
to authenticated;

-- Future generated drafts are private-by-default just like manually added
-- components. Existing learner-visible rows were preserved by the backfill;
-- publishing future content is an explicit Student Screen assignment.
create or replace function public.assemble_course_draft(
  p_course_id uuid,
  p_lesson_title text,
  p_lesson_summary text,
  p_components jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_assembled_at timestamptz;
  v_lesson_id uuid;
  v_component_id uuid;
  v_component jsonb;
  v_position integer := 0;
  v_lesson_ids uuid[] := '{}'::uuid[];
  v_component_ids uuid[] := '{}'::uuid[];
begin
  if p_components is null or jsonb_typeof(p_components) <> 'array' then
    raise exception
      'course_components_must_be_array'
      using errcode = '22023';
  end if;

  select course.assembled_at
  into v_assembled_at
  from public.course
  where course.id = p_course_id
  for update;

  if not found then
    raise exception 'course_not_found' using errcode = 'P0002';
  end if;

  if v_assembled_at is not null then
    select coalesce(
      array_agg(lesson.id order by lesson.position),
      '{}'::uuid[]
    )
    into v_lesson_ids
    from public.lesson
    where lesson.course_id = p_course_id;

    select coalesce(
      array_agg(
        component.id
        order by lesson.position, component.position
      ),
      '{}'::uuid[]
    )
    into v_component_ids
    from public.lesson_component as component
    join public.lesson on lesson.id = component.lesson_id
    where lesson.course_id = p_course_id;

    return jsonb_build_object(
      'courseId', p_course_id,
      'lessonIds', to_jsonb(v_lesson_ids),
      'componentIds', to_jsonb(v_component_ids),
      'alreadyAssembled', true
    );
  end if;

  if exists (
    select 1
    from public.lesson
    where lesson.course_id = p_course_id
  ) then
    raise exception
      'course_contains_manual_content'
      using errcode = '23505';
  end if;

  insert into public.lesson (course_id, position, title, summary)
  values (p_course_id, 1, p_lesson_title, p_lesson_summary)
  returning id into v_lesson_id;

  for v_component in
    select component.value
    from jsonb_array_elements(p_components) as component(value)
  loop
    v_position := v_position + 1;

    insert into public.lesson_component (
      lesson_id,
      position,
      type_key,
      schema_version,
      payload,
      placement_config
    )
    values (
      v_lesson_id,
      v_position,
      v_component ->> 'typeKey',
      (v_component ->> 'schemaVersion')::integer,
      v_component -> 'payload',
      v_component -> 'placement'
    )
    returning id into v_component_id;

    v_component_ids := array_append(v_component_ids, v_component_id);
  end loop;

  update public.course
  set assembled_at = now()
  where id = p_course_id;

  return jsonb_build_object(
    'courseId', p_course_id,
    'lessonIds', jsonb_build_array(v_lesson_id),
    'componentIds', to_jsonb(v_component_ids),
    'alreadyAssembled', false
  );
end
$$;

-- -----------------------------------------------------------------------------
-- Postflight: all persisted rows and exposed functions must satisfy the new
-- canonical shape. Any failure rolls the entire forward migration back.
-- -----------------------------------------------------------------------------

do $$
begin
  if to_regclass('public.lesson_student_slide') is null
    or not exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'lesson_component'
        and column_name = 'student_slide_id'
    )
  then
    raise exception
      'shidao_postflight_failed: Student Screen slide storage is missing';
  end if;

  if exists (
    select 1
    from public.lesson_component as component
    left join public.lesson_student_slide as slide
      on slide.id = component.student_slide_id
    where (component.visibility = 'staff_only'
        and component.student_slide_id is not null)
      or (component.visibility = 'learner_visible'
        and (
          component.student_slide_id is null
          or slide.lesson_id <> component.lesson_id
        ))
  ) then
    raise exception
      'shidao_postflight_failed: component assignment is inconsistent';
  end if;

  if exists (
    select 1
    from public.lesson_student_slide as slide
    where not exists (
      select 1
      from public.lesson_component as component
      where component.student_slide_id = slide.id
        and component.visibility = 'learner_visible'
    )
  ) then
    raise exception
      'shidao_postflight_failed: empty Student Screen slide remains';
  end if;

  if to_regprocedure(
    'public.set_lesson_component_student_screen(uuid,text,uuid)'
  ) is null
    or to_regprocedure(
      'public.delete_lesson_component(uuid)'
    ) is null
  then
    raise exception
      'shidao_postflight_failed: Student Screen assignment RPC is missing';
  end if;

  if not (
    select class.relrowsecurity
    from pg_class as class
    where class.oid = 'public.lesson_student_slide'::regclass
  ) then
    raise exception
      'shidao_postflight_failed: lesson_student_slide RLS is disabled';
  end if;

  if exists (
    select 1
    from pg_proc
    join pg_namespace on pg_namespace.oid = pg_proc.pronamespace
    where pg_namespace.nspname = 'public'
      and pg_proc.proname in (
        'assemble_course_draft',
        'enforce_lesson_student_screen_invariants',
        'cleanup_empty_lesson_student_slide'
      )
      and pg_proc.prosecdef
  ) then
    raise exception
      'shidao_postflight_failed: Student Screen function is SECURITY DEFINER';
  end if;

  if exists (
    select 1
    from pg_proc
    join pg_namespace on pg_namespace.oid = pg_proc.pronamespace
    where pg_namespace.nspname = 'public'
      and pg_proc.proname in (
        'set_lesson_component_student_screen',
        'reorder_lesson_component',
        'delete_lesson_component'
      )
      and not pg_proc.prosecdef
  ) then
    raise exception
      'shidao_postflight_failed: serialized component RPC is not SECURITY DEFINER';
  end if;

  if not has_function_privilege(
      'authenticated',
      'public.set_lesson_component_student_screen(uuid,text,uuid)',
      'execute'
    )
    or not has_function_privilege(
      'authenticated',
      'public.reorder_lesson_component(uuid,integer)',
      'execute'
    )
    or not has_function_privilege(
      'authenticated',
      'public.delete_lesson_component(uuid)',
      'execute'
    )
    or has_function_privilege(
      'anon',
      'public.set_lesson_component_student_screen(uuid,text,uuid)',
      'execute'
    )
    or has_function_privilege(
      'anon',
      'public.reorder_lesson_component(uuid,integer)',
      'execute'
    )
    or has_function_privilege(
      'anon',
      'public.delete_lesson_component(uuid)',
      'execute'
    )
    or has_function_privilege(
      'service_role',
      'public.set_lesson_component_student_screen(uuid,text,uuid)',
      'execute'
    )
    or has_function_privilege(
      'service_role',
      'public.reorder_lesson_component(uuid,integer)',
      'execute'
    )
    or has_function_privilege(
      'service_role',
      'public.delete_lesson_component(uuid)',
      'execute'
    )
  then
    raise exception
      'shidao_postflight_failed: serialized component RPC grants are unsafe';
  end if;

  if has_table_privilege(
      'authenticated',
      'public.lesson_component',
      'delete'
    )
    or has_table_privilege(
      'authenticated',
      'public.lesson_component',
      'update'
    )
    or has_column_privilege(
      'authenticated',
      'public.lesson_component',
      'visibility',
      'insert'
    )
    or has_column_privilege(
      'authenticated',
      'public.lesson_component',
      'student_slide_id',
      'update'
    )
    or has_table_privilege(
      'authenticated',
      'public.lesson_student_slide',
      'insert'
    )
    or has_table_privilege(
      'authenticated',
      'public.lesson_student_slide',
      'update'
    )
    or has_table_privilege(
      'authenticated',
      'public.lesson_student_slide',
      'delete'
    )
  then
    raise exception
      'shidao_postflight_failed: direct component or Slide mutation remains';
  end if;
end
$$;

-- PostgREST must discover the new relationship, return shapes, and RPC.
notify pgrst, 'reload schema';

commit;
