begin;

do $$
begin
  if to_regclass('public.account') is null
    or to_regclass('public.course') is null
    or to_regclass('public.lesson') is null
    or to_regclass('public.lesson_component') is null
    or to_regclass('public.lesson_student_slide') is null
    or to_regclass('public.course_publication_revision') is null
    or to_regclass('public.lesson_step') is not null
  then
    raise exception 'shidao_schema_sanity_check_failed'
      using errcode = '55000';
  end if;

  if (
    select count(*)
    from pg_trigger as trigger_row
    where trigger_row.tgrelid = 'public.lesson_component'::regclass
      and trigger_row.tgname in (
        'trg_lesson_component_cleanup_empty_student_slide',
        'trg_lesson_component_compact_positions',
        'trg_lesson_component_educator_content_mutation',
        'trg_lesson_component_student_screen_invariants',
        'trg_lesson_component_touch_course',
        'trg_lesson_component_updated_at'
      )
      and trigger_row.tgenabled <> 'D'
  ) <> 6 then
    raise exception 'lesson_component_required_triggers_missing'
      using errcode = '55000';
  end if;
end
$$;

-- Keep the authored hierarchy stable while the compatibility type is folded
-- into rich_text. Immutable publication revisions are intentionally left
-- untouched, so an already-published revision remains an exact historical
-- snapshot and continues to use the legacy runtime renderer when necessary.
lock table public.course in share row exclusive mode;
lock table public.lesson in share row exclusive mode;
lock table public.lesson_component in share row exclusive mode;
lock table public.lesson_student_slide in share row exclusive mode;
lock table public.course_publication_revision in share row exclusive mode;

create temporary table heading_component_source
on commit drop
as
select
  component.id,
  component.lesson_id,
  component.position,
  btrim(component.payload ->> 'text') as title
from public.lesson_component as component
where component.type_key = 'heading';

do $$
begin
  if exists (
    select 1
    from public.lesson_component as component
    where component.type_key = 'heading'
      and (
        component.schema_version <> 1
        or coalesce(component.payload ->> 'level', '') not in ('h2', 'h3', 'h4')
        or nullif(btrim(component.payload ->> 'text'), '') is null
      )
  ) then
    raise exception 'unsupported_heading_component_payload'
      using errcode = '55000';
  end if;
end
$$;

-- Merge only a directly adjacent body whose audience, Student Screen slide,
-- and placement are identical. A visually adjacent private/public pair must
-- remain two components so that no teacher-only content crosses projections.
create temporary table heading_rich_text_merge
on commit drop
as
select
  heading.id as heading_id,
  body.id as body_id,
  heading.lesson_id,
  body.position as body_position,
  body.payload ->> 'content' as body_content
from public.lesson_component as heading
join public.lesson_component as body
  on body.lesson_id = heading.lesson_id
  and body.position = heading.position + 1
where heading.type_key = 'heading'
  and body.type_key = 'rich_text'
  and heading.visibility = body.visibility
  and heading.student_slide_id is not distinct from body.student_slide_id
  and heading.placement_config = body.placement_config
  and body.schema_version = 1
  and body.payload ->> 'format' = 'markdown'
  and nullif(btrim(body.payload ->> 'content'), '') is not null
  and nullif(btrim(body.payload ->> 'title'), '') is null;

create temporary table heading_component_migration_stats
on commit drop
as
select
  (select count(*) from public.lesson_component)::bigint as component_count_before,
  (select count(*) from heading_component_source)::bigint as heading_count_before,
  (select count(*) from heading_rich_text_merge)::bigint as merge_count;

update public.lesson_component as heading
set
  type_key = 'rich_text',
  schema_version = 1,
  payload = jsonb_build_object(
    'title', btrim(heading.payload ->> 'text'),
    'content', merge_row.body_content,
    'format', 'markdown'
  )
from heading_rich_text_merge as merge_row
where heading.id = merge_row.heading_id
  and heading.type_key = 'heading';

-- Lone headings and privacy-separated adjacent headings become title-only
-- rich_text rows while retaining their IDs, placement, visibility, and Slide.
update public.lesson_component as component
set
  type_key = 'rich_text',
  schema_version = 1,
  payload = jsonb_build_object(
    'title', btrim(component.payload ->> 'text'),
    'format', 'markdown'
  )
where component.type_key = 'heading';

-- Delete merged body rows in descending position order so the existing
-- compaction trigger remains deterministic when a Lesson contains many pairs.
do $$
declare
  v_body record;
begin
  for v_body in
    select merge_row.body_id
    from heading_rich_text_merge as merge_row
    order by merge_row.lesson_id, merge_row.body_position desc, merge_row.body_id
  loop
    delete from public.lesson_component as component
    where component.id = v_body.body_id;

    if not found then
      raise exception 'merged_rich_text_component_delete_failed'
        using errcode = '55000';
    end if;
  end loop;
end
$$;

-- Reconcile positions explicitly under the existing deferrable uniqueness
-- contract and then flush deferred Student Screen invariant checks.
with ordered_components as (
  select
    component.id,
    row_number() over (
      partition by component.lesson_id
      order by component.position, component.id
    )::integer as new_position
  from public.lesson_component as component
  where component.lesson_id in (
    select distinct source.lesson_id
    from heading_component_source as source
  )
)
update public.lesson_component as component
set position = ordered_components.new_position
from ordered_components
where component.id = ordered_components.id
  and component.position <> ordered_components.new_position;

set constraints all immediate;

do $$
begin
  if exists (
    select 1
    from public.lesson_component as component
    where component.type_key = 'heading'
  ) then
    raise exception 'heading_components_remain'
      using errcode = '55000';
  end if;

  if exists (
    select 1
    from heading_component_source as source
    left join public.lesson_component as component on component.id = source.id
    where component.id is null
      or component.type_key <> 'rich_text'
      or component.schema_version <> 1
      or component.payload ->> 'format' <> 'markdown'
      or component.payload ->> 'title' is distinct from source.title
  ) then
    raise exception 'heading_component_conversion_mismatch'
      using errcode = '55000';
  end if;

  if exists (
    select 1
    from heading_rich_text_merge as merge_row
    join public.lesson_component as component
      on component.id = merge_row.heading_id
    where component.payload ->> 'content'
      is distinct from merge_row.body_content
  ) then
    raise exception 'heading_component_merge_content_mismatch'
      using errcode = '55000';
  end if;

  if exists (
    select 1
    from heading_rich_text_merge as merge_row
    join public.lesson_component as body on body.id = merge_row.body_id
  ) then
    raise exception 'merged_rich_text_components_remain'
      using errcode = '55000';
  end if;

  if (
    select count(*)
    from public.lesson_component
  ) <> (
    select component_count_before - merge_count
    from heading_component_migration_stats
  ) then
    raise exception 'lesson_component_count_mismatch'
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
end
$$;

commit;
