begin;

-- ShiDao V2 lesson authoring is component-first: components belong directly to
-- a Lesson. This forward-only migration flattens the short-lived Lesson Step
-- model without changing component IDs or component data. It also removes the
-- archived V1 methodology/runtime tables whose recovery copy lives outside the
-- active schema.
--
-- Deliberately absent here: public-schema resets, Auth/SMTP/Storage changes,
-- edits to historical migrations, and DROP ... CASCADE.

-- -----------------------------------------------------------------------------
-- Project and source-shape preflight. Fail before the first persistent write if
-- this is not the expected ShiDao database or if the source shape drifted.
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
      ('lesson_step'),
      ('lesson_step_component'),
      ('stored_file'),
      ('course_attachment'),
      ('parent'),
      ('teacher'),
      ('school'),
      ('class'),
      ('student'),
      ('methodology'),
      ('methodology_lesson'),
      ('methodology_lesson_block'),
      ('methodology_lesson_block_asset'),
      ('methodology_lesson_homework'),
      ('methodology_lesson_student_content'),
      ('reusable_asset'),
      ('scheduled_lesson'),
      ('scheduled_lesson_homework_assignment'),
      ('student_homework_assignment'),
      ('group_student_conversation'),
      ('group_student_message'),
      ('lesson_group_conversation'),
      ('lesson_group_message'),
      ('communication_message_attachment'),
      ('notification')
  ) as expected(name)
  where to_regclass('public.' || expected.name) is null;

  if v_missing_tables is not null then
    raise exception
      'shidao_schema_sanity_failed: missing expected tables: %',
      v_missing_tables;
  end if;

  if to_regclass('public.lesson_component') is not null then
    raise exception
      'shidao_schema_sanity_failed: public.lesson_component already exists';
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

  if to_regprocedure(
    'public.assemble_course_draft(uuid,text,text,text,text,text,jsonb)'
  ) is null then
    raise exception
      'shidao_schema_sanity_failed: legacy course assembler signature is missing';
  end if;

  if to_regprocedure(
    'public.assemble_course_draft(uuid,text,text,jsonb)'
  ) is not null then
    raise exception
      'shidao_schema_sanity_failed: component-first course assembler already exists';
  end if;

  if to_regprocedure(
    'public.reorder_lesson_step_component(uuid,integer)'
  ) is null
    or to_regprocedure('public.compact_lesson_step_positions()') is null
    or to_regprocedure('public.compact_step_component_positions()') is null
    or to_regprocedure('public.enforce_class_methodology_invariants()') is null
    or to_regprocedure('public.scheduled_homework_class_id(uuid)') is null
  then
    raise exception
      'shidao_schema_sanity_failed: expected legacy functions are missing';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'class'
      and column_name = 'methodology_id'
  ) then
    raise exception
      'shidao_schema_sanity_failed: public.class.methodology_id is missing';
  end if;
end
$$;

-- Freeze the source document layer for the remainder of this transaction. A
-- writer that started earlier finishes before this lock is granted; later Step
-- writes wait and then fail cleanly after the old tables are removed. Reads stay
-- available while the migration plans and verifies the backfill.
lock table
  public.lesson_step,
  public.lesson_step_component
in share row exclusive mode;

do $$
begin
  if exists (
    select 1
    from public.lesson_step
    group by lesson_id
    having min(position) <> 1
      or max(position) <> count(*)
      or count(distinct position) <> count(*)
  ) then
    raise exception
      'lesson_step_source_positions_are_not_dense';
  end if;

  if exists (
    select 1
    from public.lesson_step_component
    group by lesson_step_id
    having min(position) <> 1
      or max(position) <> count(*)
      or count(distinct position) <> count(*)
  ) then
    raise exception
      'lesson_step_component_source_positions_are_not_dense';
  end if;

  if exists (
    select 1
    from public.lesson_step_component
    where visibility not in ('staff_only', 'learner_visible')
  ) then
    raise exception
      'lesson_step_component_source_visibility_is_not_supported';
  end if;

  if exists (
    select 1
    from public.lesson_step
    where (
        teacher_content ? 'teacherInstructions'
        and jsonb_typeof(teacher_content -> 'teacherInstructions')
          not in ('string', 'null')
      )
      or (
        settings ? 'learnerInstruction'
        and jsonb_typeof(settings -> 'learnerInstruction')
          not in ('string', 'null')
      )
  ) then
    raise exception
      'lesson_step_instruction_values_must_be_strings';
  end if;

  if exists (
    with step_context as (
      select
        step.*,
        count(*) over (partition by step.lesson_id) as step_count,
        btrim(coalesce(
          step.teacher_content ->> 'teacherInstructions',
          ''
        )) as teacher_instructions,
        btrim(coalesce(
          step.settings ->> 'learnerInstruction',
          ''
        )) as learner_instruction
      from public.lesson_step as step
    )
    select 1
    from step_context
    where (
        step_count > 1
        or teacher_instructions <> ''
        or learner_instruction <> ''
      )
      and char_length(btrim(title)) > 240
  ) then
    raise exception
      'lesson_step_title_exceeds_heading_registry_limit';
  end if;

  if exists (
    select 1
    from public.lesson_step
    where char_length(btrim(coalesce(
      teacher_content ->> 'teacherInstructions',
      ''
    ))) > 4000
      or char_length(btrim(coalesce(
        settings ->> 'learnerInstruction',
        ''
      ))) > 4000
  ) then
    raise exception
      'lesson_step_instruction_exceeds_callout_registry_limit';
  end if;
end
$$;

-- Build the complete migration plan in a transaction-local table first. The
-- source components retain every field and ID. Synthetic IDs are deterministic
-- UUID-v3-shaped values derived from (step ID, semantic kind), and a primary-key
-- collision aborts the migration instead of silently changing data.

create temporary table lesson_component_migration_plan (
  id uuid primary key,
  lesson_id uuid not null,
  position integer not null check (position > 0),
  type_key text not null,
  schema_version integer not null,
  payload jsonb not null,
  placement_config jsonb not null,
  visibility text not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  source_kind text not null,
  source_component_id uuid null unique,
  unique (lesson_id, position)
) on commit drop;

with step_context as (
  select
    step.*,
    count(*) over (partition by step.lesson_id) as step_count,
    btrim(coalesce(
      step.teacher_content ->> 'teacherInstructions',
      ''
    )) as teacher_instructions,
    btrim(coalesce(
      step.settings ->> 'learnerInstruction',
      ''
    )) as learner_instruction
  from public.lesson_step as step
),
synthetic_seed as (
  select
    step.id as step_id,
    step.lesson_id,
    step.position as step_position,
    10 as kind_order,
    0 as source_position,
    'step_heading'::text as source_kind,
    'heading'::text as type_key,
    1 as schema_version,
    jsonb_build_object(
      'text', btrim(step.title),
      'level', 'h2'
    ) as payload,
    jsonb_build_object(
      'width', 'content',
      'textAlign', 'start'
    ) as placement_config,
    'learner_visible'::text as visibility,
    step.created_at,
    step.updated_at
  from step_context as step
  where step.step_count > 1
    or step.teacher_instructions <> ''
    or step.learner_instruction <> ''

  union all

  select
    step.id,
    step.lesson_id,
    step.position,
    20,
    0,
    'teacher_instruction',
    'callout',
    1,
    jsonb_build_object(
      'title', 'Комментарий преподавателя',
      'text', step.teacher_instructions,
      'tone', 'neutral'
    ),
    jsonb_build_object(
      'width', 'content',
      'emphasis', 'soft'
    ),
    'staff_only',
    step.created_at,
    step.updated_at
  from step_context as step
  where step.teacher_instructions <> ''

  union all

  select
    step.id,
    step.lesson_id,
    step.position,
    30,
    0,
    'learner_instruction',
    'callout',
    1,
    jsonb_build_object(
      'title', 'Инструкция ученику',
      'text', step.learner_instruction,
      'tone', 'info'
    ),
    jsonb_build_object(
      'width', 'content',
      'emphasis', 'soft'
    ),
    'learner_visible',
    step.created_at,
    step.updated_at
  from step_context as step
  where step.learner_instruction <> ''
),
synthetic_hashed as (
  select
    seed.*,
    md5(
      'shidao:v2:lesson-component:'
      || seed.step_id::text
      || ':'
      || seed.source_kind
    ) as id_hash
  from synthetic_seed as seed
),
synthetic_components as (
  select
    (
      substr(id_hash, 1, 8)
      || '-'
      || substr(id_hash, 9, 4)
      || '-3'
      || substr(id_hash, 14, 3)
      || '-8'
      || substr(id_hash, 18, 3)
      || '-'
      || substr(id_hash, 21, 12)
    )::uuid as id,
    lesson_id,
    step_position,
    kind_order,
    source_position,
    source_kind,
    source_kind as stable_key,
    type_key,
    schema_version,
    payload,
    placement_config,
    visibility,
    created_at,
    updated_at,
    null::uuid as source_component_id
  from synthetic_hashed
),
source_components as (
  select
    component.id,
    step.lesson_id,
    step.position as step_position,
    40 as kind_order,
    component.position as source_position,
    'source_component'::text as source_kind,
    component.id::text as stable_key,
    component.type_key,
    component.schema_version,
    component.payload,
    component.placement_config,
    component.visibility,
    component.created_at,
    component.updated_at,
    component.id as source_component_id
  from public.lesson_step_component as component
  join public.lesson_step as step
    on step.id = component.lesson_step_id
),
candidates as (
  select * from synthetic_components
  union all
  select * from source_components
),
ranked as (
  select
    candidate.*,
    row_number() over (
      partition by candidate.lesson_id
      order by
        candidate.step_position,
        candidate.kind_order,
        candidate.source_position,
        candidate.stable_key
    )::integer as new_position
  from candidates as candidate
)
insert into lesson_component_migration_plan (
  id,
  lesson_id,
  position,
  type_key,
  schema_version,
  payload,
  placement_config,
  visibility,
  created_at,
  updated_at,
  source_kind,
  source_component_id
)
select
  ranked.id,
  ranked.lesson_id,
  ranked.new_position,
  ranked.type_key,
  ranked.schema_version,
  ranked.payload,
  ranked.placement_config,
  ranked.visibility,
  ranked.created_at,
  ranked.updated_at,
  ranked.source_kind,
  ranked.source_component_id
from ranked;

do $$
declare
  v_source_count bigint;
  v_expected_synthetic_count bigint;
  v_planned_source_count bigint;
  v_planned_count bigint;
begin
  select count(*)
  into v_source_count
  from public.lesson_step_component;

  with step_context as (
    select
      step.*,
      count(*) over (partition by step.lesson_id) as step_count,
      btrim(coalesce(
        step.teacher_content ->> 'teacherInstructions',
        ''
      )) as teacher_instructions,
      btrim(coalesce(
        step.settings ->> 'learnerInstruction',
        ''
      )) as learner_instruction
    from public.lesson_step as step
  )
  select coalesce(sum(
    case
      when step_count > 1
        or teacher_instructions <> ''
        or learner_instruction <> ''
      then 1
      else 0
    end
    + case when teacher_instructions <> '' then 1 else 0 end
    + case when learner_instruction <> '' then 1 else 0 end
  ), 0)
  into v_expected_synthetic_count
  from step_context;

  select count(*)
  into v_planned_source_count
  from lesson_component_migration_plan
  where source_component_id is not null;

  select count(*)
  into v_planned_count
  from lesson_component_migration_plan;

  if v_planned_source_count <> v_source_count then
    raise exception
      'lesson_component_plan_source_count_mismatch: expected %, got %',
      v_source_count,
      v_planned_source_count;
  end if;

  if v_planned_count <> v_source_count + v_expected_synthetic_count then
    raise exception
      'lesson_component_plan_total_count_mismatch: expected %, got %',
      v_source_count + v_expected_synthetic_count,
      v_planned_count;
  end if;

  if exists (
    select 1
    from public.lesson_step_component as source
    join public.lesson_step as step
      on step.id = source.lesson_step_id
    left join lesson_component_migration_plan as planned
      on planned.source_component_id = source.id
    where planned.id is null
      or planned.id <> source.id
      or planned.lesson_id <> step.lesson_id
      or planned.type_key is distinct from source.type_key
      or planned.schema_version is distinct from source.schema_version
      or planned.payload is distinct from source.payload
      or planned.placement_config is distinct from source.placement_config
      or planned.visibility is distinct from source.visibility
      or planned.created_at is distinct from source.created_at
      or planned.updated_at is distinct from source.updated_at
  ) then
    raise exception
      'lesson_component_plan_did_not_preserve_source_component';
  end if;

  if exists (
    select 1
    from lesson_component_migration_plan
    group by lesson_id
    having min(position) <> 1
      or max(position) <> count(*)
      or count(distinct position) <> count(*)
  ) then
    raise exception
      'lesson_component_plan_positions_are_not_dense';
  end if;
end
$$;

-- -----------------------------------------------------------------------------
-- Component-first Lesson document model.
-- -----------------------------------------------------------------------------

create table public.lesson_component (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lesson(id) on delete cascade,
  position integer not null check (position > 0),
  type_key text not null check (btrim(type_key) <> ''),
  schema_version integer not null default 1 check (schema_version > 0),
  payload jsonb not null default '{}'::jsonb check (
    jsonb_typeof(payload) = 'object'
  ),
  placement_config jsonb not null default '{}'::jsonb check (
    jsonb_typeof(placement_config) = 'object'
  ),
  visibility text not null default 'learner_visible' check (
    visibility in ('staff_only', 'learner_visible')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lesson_component_lesson_position_unique
    unique (lesson_id, position) deferrable initially deferred
);

insert into public.lesson_component (
  id,
  lesson_id,
  position,
  type_key,
  schema_version,
  payload,
  placement_config,
  visibility,
  created_at,
  updated_at
)
select
  id,
  lesson_id,
  position,
  type_key,
  schema_version,
  payload,
  placement_config,
  visibility,
  created_at,
  updated_at
from lesson_component_migration_plan
order by lesson_id, position;

do $$
begin
  if (
    select count(*) from public.lesson_component
  ) <> (
    select count(*) from lesson_component_migration_plan
  ) then
    raise exception
      'lesson_component_persisted_count_mismatch';
  end if;

  if exists (
    select 1
    from lesson_component_migration_plan as planned
    full join public.lesson_component as persisted
      on persisted.id = planned.id
    where planned.id is null
      or persisted.id is null
      or persisted.lesson_id is distinct from planned.lesson_id
      or persisted.position is distinct from planned.position
      or persisted.type_key is distinct from planned.type_key
      or persisted.schema_version is distinct from planned.schema_version
      or persisted.payload is distinct from planned.payload
      or persisted.placement_config is distinct from planned.placement_config
      or persisted.visibility is distinct from planned.visibility
      or persisted.created_at is distinct from planned.created_at
      or persisted.updated_at is distinct from planned.updated_at
  ) then
    raise exception
      'lesson_component_persisted_data_mismatch';
  end if;

  if exists (
    select 1
    from public.lesson_component
    group by lesson_id
    having min(position) <> 1
      or max(position) <> count(*)
      or count(distinct position) <> count(*)
  ) then
    raise exception
      'lesson_component_persisted_positions_are_not_dense';
  end if;
end
$$;

create index lesson_component_lesson_position_idx
  on public.lesson_component (lesson_id, position);
create index lesson_component_type_key_idx
  on public.lesson_component (type_key);

alter table public.lesson_component enable row level security;

create policy lesson_component_course_owner_all
on public.lesson_component
for all to authenticated
using (
  exists (
    select 1
    from public.lesson
    join public.course on course.id = lesson.course_id
    where lesson.id = lesson_component.lesson_id
      and course.owner_account_id = (select public.current_account_id())
  )
)
with check (
  exists (
    select 1
    from public.lesson
    join public.course on course.id = lesson.course_id
    where lesson.id = lesson_component.lesson_id
      and course.owner_account_id = (select public.current_account_id())
  )
);

revoke all on table public.lesson_component
from public, anon, authenticated;
grant select, insert, update, delete on table public.lesson_component
to authenticated;
grant all on table public.lesson_component to service_role;

create trigger trg_lesson_component_updated_at
before update on public.lesson_component
for each row execute function public.set_updated_at();

create function public.compact_lesson_component_positions()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.lesson_component
  set position = position - 1
  where lesson_id = old.lesson_id
    and position > old.position;
  return old;
end
$$;

revoke all on function public.compact_lesson_component_positions()
from public, anon, authenticated;

create trigger trg_lesson_component_compact_positions
after delete on public.lesson_component
for each row execute function public.compact_lesson_component_positions();

-- -----------------------------------------------------------------------------
-- Atomic component reorder. SECURITY INVOKER keeps Course ownership RLS active.
-- -----------------------------------------------------------------------------

create function public.reorder_lesson_component(
  p_component_id uuid,
  p_new_position integer
)
returns table (component_id uuid, "position" integer)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_lesson_id uuid;
  v_old_position integer;
  v_component_count integer;
begin
  if p_new_position is null or p_new_position < 1 then
    raise exception
      'component_position_out_of_range'
      using errcode = '22023';
  end if;

  select component.lesson_id
  into v_lesson_id
  from public.lesson_component as component
  where component.id = p_component_id;

  if not found then
    raise exception 'component_not_found' using errcode = 'P0002';
  end if;

  -- Serialize every reorder for one Lesson on its parent row before locking any
  -- component. Two calls targeting different siblings therefore cannot acquire
  -- the same component set in opposite orders and deadlock.
  perform 1
  from public.lesson as lesson
  where lesson.id = v_lesson_id
  for update;

  if not found then
    raise exception 'component_not_found' using errcode = 'P0002';
  end if;

  select component.position
  into v_old_position
  from public.lesson_component as component
  where component.id = p_component_id
    and component.lesson_id = v_lesson_id
  for update;

  if not found then
    raise exception 'component_not_found' using errcode = 'P0002';
  end if;

  perform 1
  from public.lesson_component as component
  where component.lesson_id = v_lesson_id
  order by component.id
  for update;

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

  update public.lesson_component
  set position = p_new_position
  where id = p_component_id;

  return query
  select component.id, component.position
  from public.lesson_component as component
  where component.lesson_id = v_lesson_id
  order by component.position;
end
$$;

revoke all on function public.reorder_lesson_component(uuid, integer)
from public, anon;
grant execute on function public.reorder_lesson_component(uuid, integer)
to authenticated;

-- -----------------------------------------------------------------------------
-- Component-first atomic draft assembly. The application service still owns
-- registry validation; this persistence boundary receives the validated Lesson
-- and component list and commits them under caller RLS in one transaction.
-- -----------------------------------------------------------------------------

revoke all on function public.assemble_course_draft(
  uuid,
  text,
  text,
  text,
  text,
  text,
  jsonb
) from public, anon, authenticated;

drop function public.assemble_course_draft(
  uuid,
  text,
  text,
  text,
  text,
  text,
  jsonb
);

create function public.assemble_course_draft(
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
      placement_config,
      visibility
    )
    values (
      v_lesson_id,
      v_position,
      v_component ->> 'typeKey',
      (v_component ->> 'schemaVersion')::integer,
      v_component -> 'payload',
      v_component -> 'placement',
      'learner_visible'
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

revoke all on function public.assemble_course_draft(
  uuid,
  text,
  text,
  jsonb
) from public, anon;
grant execute on function public.assemble_course_draft(
  uuid,
  text,
  text,
  jsonb
) to authenticated;

-- -----------------------------------------------------------------------------
-- Remove the superseded Lesson Step API and tables explicitly, without CASCADE.
-- -----------------------------------------------------------------------------

revoke all on function public.reorder_lesson_step_component(uuid, integer)
from public, anon, authenticated;
drop function public.reorder_lesson_step_component(uuid, integer);

drop trigger trg_component_compact_positions
on public.lesson_step_component;
drop trigger trg_lesson_step_component_updated_at
on public.lesson_step_component;
drop policy lesson_step_component_course_owner_all
on public.lesson_step_component;

drop trigger trg_lesson_step_compact_positions
on public.lesson_step;
drop trigger trg_lesson_step_updated_at
on public.lesson_step;
drop policy lesson_step_course_owner_all
on public.lesson_step;

revoke all on function public.compact_step_component_positions()
from public, anon, authenticated;
drop function public.compact_step_component_positions();

revoke all on function public.compact_lesson_step_positions()
from public, anon, authenticated;
drop function public.compact_lesson_step_positions();

drop table public.lesson_step_component;
drop table public.lesson_step;

-- -----------------------------------------------------------------------------
-- Remove archived methodology and lesson runtime data leaf-first. The user
-- explicitly approved deletion of this active-schema copy; archived Git refs,
-- recovery snapshots, Auth, SMTP and Storage configuration remain untouched.
-- -----------------------------------------------------------------------------

drop trigger class_methodology_invariants_tg on public.class;
revoke all on function public.enforce_class_methodology_invariants()
from public, anon, authenticated;
drop function public.enforce_class_methodology_invariants();
alter table public.class drop constraint class_methodology_id_fkey;
alter table public.class drop column methodology_id;

drop table public.notification;

drop table public.communication_message_attachment;
drop table public.lesson_group_message;
drop table public.lesson_group_conversation;
drop table public.group_student_message;
drop table public.group_student_conversation;

drop table public.student_homework_assignment;

revoke all on function public.scheduled_homework_class_id(uuid)
from public, anon, authenticated;
drop function public.scheduled_homework_class_id(uuid);

drop table public.scheduled_lesson_homework_assignment;
drop table public.scheduled_lesson;

drop table public.methodology_lesson_block_asset;
drop table public.methodology_lesson_student_content;
drop table public.methodology_lesson_homework;
drop table public.methodology_lesson_block;
drop table public.methodology_lesson;
drop table public.reusable_asset;
drop table public.methodology;

-- -----------------------------------------------------------------------------
-- Final structural invariants. Any failure rolls the entire migration back.
-- -----------------------------------------------------------------------------

do $$
declare
  v_missing_preserved text;
  v_remaining_legacy text;
  v_new_assembler regprocedure := to_regprocedure(
    'public.assemble_course_draft(uuid,text,text,jsonb)'
  );
begin
  select string_agg(expected.name, ', ' order by expected.name)
  into v_missing_preserved
  from (
    values
      ('account'),
      ('parent'),
      ('teacher'),
      ('school'),
      ('school_teacher'),
      ('class'),
      ('class_teacher'),
      ('student'),
      ('class_student'),
      ('course'),
      ('lesson'),
      ('lesson_component'),
      ('stored_file'),
      ('course_attachment')
  ) as expected(name)
  where to_regclass('public.' || expected.name) is null;

  if v_missing_preserved is not null then
    raise exception
      'shidao_postflight_failed: missing preserved tables: %',
      v_missing_preserved;
  end if;

  select string_agg(legacy.name, ', ' order by legacy.name)
  into v_remaining_legacy
  from (
    values
      ('lesson_step'),
      ('lesson_step_component'),
      ('notification'),
      ('communication_message_attachment'),
      ('lesson_group_message'),
      ('lesson_group_conversation'),
      ('group_student_message'),
      ('group_student_conversation'),
      ('student_homework_assignment'),
      ('scheduled_lesson_homework_assignment'),
      ('scheduled_lesson'),
      ('methodology_lesson_block_asset'),
      ('methodology_lesson_student_content'),
      ('methodology_lesson_homework'),
      ('methodology_lesson_block'),
      ('methodology_lesson'),
      ('reusable_asset'),
      ('methodology')
  ) as legacy(name)
  where to_regclass('public.' || legacy.name) is not null;

  if v_remaining_legacy is not null then
    raise exception
      'shidao_postflight_failed: legacy tables remain: %',
      v_remaining_legacy;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'class'
      and column_name = 'methodology_id'
  ) then
    raise exception
      'shidao_postflight_failed: public.class.methodology_id remains';
  end if;

  if to_regprocedure(
    'public.assemble_course_draft(uuid,text,text,text,text,text,jsonb)'
  ) is not null
    or to_regprocedure(
      'public.reorder_lesson_step_component(uuid,integer)'
    ) is not null
    or to_regprocedure('public.compact_lesson_step_positions()') is not null
    or to_regprocedure('public.compact_step_component_positions()') is not null
    or to_regprocedure(
      'public.enforce_class_methodology_invariants()'
    ) is not null
    or to_regprocedure('public.scheduled_homework_class_id(uuid)') is not null
  then
    raise exception
      'shidao_postflight_failed: legacy functions remain';
  end if;

  if v_new_assembler is null
    or to_regprocedure(
      'public.reorder_lesson_component(uuid,integer)'
    ) is null
    or to_regprocedure(
      'public.compact_lesson_component_positions()'
    ) is null
  then
    raise exception
      'shidao_postflight_failed: component-first functions are missing';
  end if;

  if pg_get_functiondef(v_new_assembler::oid) like '%stepIds%' then
    raise exception
      'shidao_postflight_failed: new assembler still returns stepIds';
  end if;

  if not (
    select class.relrowsecurity
    from pg_class as class
    where class.oid = 'public.lesson_component'::regclass
  ) then
    raise exception
      'shidao_postflight_failed: lesson_component RLS is disabled';
  end if;

  if exists (
    select 1
    from public.lesson_component
    group by lesson_id
    having min(position) <> 1
      or max(position) <> count(*)
      or count(distinct position) <> count(*)
  ) then
    raise exception
      'shidao_postflight_failed: lesson_component positions are not dense';
  end if;
end
$$;

commit;
