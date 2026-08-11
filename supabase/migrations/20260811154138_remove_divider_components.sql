begin;

do $$
begin
  if to_regclass('public.account') is null
    or to_regclass('public.course') is null
    or to_regclass('public.lesson') is null
    or to_regclass('public.lesson_component') is null
    or to_regclass('public.lesson_student_slide') is null
    or to_regclass('public.course_publication_revision') is null
    or to_regprocedure('public.delete_lesson_component(uuid)') is null
    or to_regclass('public.lesson_step') is not null
  then
    raise exception 'shidao_schema_sanity_check_failed'
      using errcode = '55000';
  end if;

  if not exists (
    select 1
    from pg_constraint as constraint_row
    where constraint_row.conrelid = 'public.lesson_component'::regclass
      and constraint_row.conname = 'lesson_component_type_key_check'
      and constraint_row.contype = 'c'
  ) then
    raise exception 'lesson_component_type_key_constraint_missing'
      using errcode = '55000';
  end if;

  if (
    select count(*)
    from pg_trigger as trigger_row
    where trigger_row.tgrelid = 'public.lesson_component'::regclass
      and trigger_row.tgname in (
        'trg_lesson_component_cleanup_empty_student_slide',
        'trg_lesson_component_compact_positions',
        'trg_lesson_component_student_screen_invariants'
      )
      and trigger_row.tgenabled <> 'D'
  ) <> 3 then
    raise exception 'lesson_component_cleanup_triggers_missing'
      using errcode = '55000';
  end if;
end
$$;

-- Lock the authored hierarchy in parent-to-child order. This keeps the
-- destructive cleanup deterministic and prevents a concurrent publication
-- from freezing a divider into a new immutable revision during the check.
lock table public.course in share row exclusive mode;
lock table public.lesson in share row exclusive mode;
lock table public.lesson_component in share row exclusive mode;
lock table public.lesson_student_slide in share row exclusive mode;
lock table public.course_publication_revision in share row exclusive mode;

do $$
declare
  v_component record;
  v_expected_count integer;
  v_deleted_count integer := 0;
begin
  if exists (
    select 1
    from public.course_publication_revision as revision
    cross join lateral jsonb_array_elements(revision.snapshot -> 'lessons')
      as snapshot_lesson(value)
    cross join lateral jsonb_array_elements(snapshot_lesson.value -> 'components')
      as snapshot_component(value)
    where lower(btrim(snapshot_component.value ->> 'typeKey')) = 'divider'
  ) then
    raise exception 'course_publication_revision_contains_divider'
      using errcode = '55000';
  end if;

  select count(*)::integer
  into v_expected_count
  from public.lesson_component as component
  where lower(btrim(component.type_key)) = 'divider';

  -- Descending position order makes the existing AFTER DELETE compaction
  -- trigger safe when one Lesson contains more than one divider.
  for v_component in
    select component.id
    from public.lesson_component as component
    where lower(btrim(component.type_key)) = 'divider'
    order by component.lesson_id, component.position desc, component.id
  loop
    delete from public.lesson_component as component
    where component.id = v_component.id
      and lower(btrim(component.type_key)) = 'divider';

    if found then
      v_deleted_count := v_deleted_count + 1;
    end if;
  end loop;

  if v_deleted_count <> v_expected_count then
    raise exception 'divider_component_delete_count_mismatch'
      using errcode = '55000';
  end if;
end
$$;

-- Reconcile positions explicitly after the row-triggered cleanup. Under the
-- deferrable uniqueness constraints these updates are atomic and gap-free.
with ordered_components as (
  select
    component.id,
    row_number() over (
      partition by component.lesson_id
      order by component.position, component.id
    )::integer as new_position
  from public.lesson_component as component
)
update public.lesson_component as component
set position = ordered_components.new_position
from ordered_components
where component.id = ordered_components.id
  and component.position <> ordered_components.new_position;

with ordered_slides as (
  select
    slide.id,
    row_number() over (
      partition by slide.lesson_id
      order by slide.position, slide.id
    )::integer as new_position
  from public.lesson_student_slide as slide
)
update public.lesson_student_slide as slide
set position = ordered_slides.new_position
from ordered_slides
where slide.id = ordered_slides.id
  and slide.position <> ordered_slides.new_position;

-- The Student Screen invariant triggers are deferred constraint triggers.
-- Flush their queued events before ALTER TABLE, which PostgreSQL otherwise
-- rejects while the relation still has pending trigger events.
set constraints all immediate;

alter table public.lesson_component
  drop constraint lesson_component_type_key_check;

alter table public.lesson_component
  add constraint lesson_component_type_key_check
  check (
    btrim(type_key) <> ''
    and lower(btrim(type_key)) <> 'divider'
  );

do $$
begin
  if exists (
    select 1
    from public.lesson_component as component
    where lower(btrim(component.type_key)) = 'divider'
  ) then
    raise exception 'divider_components_remain'
      using errcode = '55000';
  end if;

  if exists (
    select 1
    from public.lesson_component as component
    group by component.lesson_id
    having min(component.position) <> 1
      or max(component.position) <> count(*)
      or count(distinct component.position) <> count(*)
  ) then
    raise exception 'lesson_component_positions_are_not_dense'
      using errcode = '55000';
  end if;

  if exists (
    select 1
    from public.lesson_student_slide as slide
    group by slide.lesson_id
    having min(slide.position) <> 1
      or max(slide.position) <> count(*)
      or count(distinct slide.position) <> count(*)
  ) then
    raise exception 'lesson_student_slide_positions_are_not_dense'
      using errcode = '55000';
  end if;

  if exists (
    select 1
    from public.lesson_student_slide as slide
    where not exists (
      select 1
      from public.lesson_component as component
      where component.student_slide_id = slide.id
        and component.lesson_id = slide.lesson_id
        and component.visibility = 'learner_visible'
    )
  ) then
    raise exception 'empty_lesson_student_slide_remains'
      using errcode = '55000';
  end if;

  if exists (
    select 1
    from public.course_publication_revision as revision
    cross join lateral jsonb_array_elements(revision.snapshot -> 'lessons')
      as snapshot_lesson(value)
    cross join lateral jsonb_array_elements(snapshot_lesson.value -> 'components')
      as snapshot_component(value)
    where lower(btrim(snapshot_component.value ->> 'typeKey')) = 'divider'
  ) then
    raise exception 'course_publication_revision_contains_divider'
      using errcode = '55000';
  end if;

  if not exists (
    select 1
    from pg_constraint as constraint_row
    where constraint_row.conrelid = 'public.lesson_component'::regclass
      and constraint_row.conname = 'lesson_component_type_key_check'
      and pg_get_constraintdef(constraint_row.oid)
        ilike '%divider%'
  ) then
    raise exception 'divider_component_constraint_not_installed'
      using errcode = '55000';
  end if;
end
$$;

commit;
