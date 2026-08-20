begin;

-- Publication snapshot V2 adds Course objectives and Component pedagogy while
-- keeping legacy V1 rows immutable/readable. Existing RPC names stay stable
-- for DB-first rolling deployment; V1 and legacy three-section id maps remain
-- accepted where they cannot discard LA-M2 data.

do $preflight$
begin
  if to_regclass('public.learning_objective') is null
    or to_regclass('public.course_publication_revision') is null
    or to_regprocedure(
      'public.publish_course_revision_admin(uuid,uuid,uuid,uuid,text,jsonb,jsonb,boolean)'
    ) is null
    or to_regprocedure(
      'public.clone_course_publication_admin(uuid,uuid,uuid,text,jsonb,jsonb)'
    ) is null
    or to_regprocedure(
      'public.duplicate_course_admin(uuid,uuid,uuid,text,jsonb)'
    ) is null
    or to_regprocedure(
      'public.update_lesson_component_v2(uuid,jsonb,boolean,jsonb,boolean,uuid,boolean,text,boolean)'
    ) is null
    or not exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'lesson_component'
        and column_name = 'primary_learning_objective_id'
    )
    or not exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'lesson_component'
        and column_name = 'activity_role'
    )
    or (
      select count(*)
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'lesson_component_observation'
        and column_name in (
          'learning_objective_id',
          'source_learning_objective_id_at_time',
          'learning_objective_title_at_time'
        )
    ) <> 3
  then
    raise exception 'course_publication_v2_schema_sanity_failed';
  end if;

  if not exists (
    select 1
    from pg_constraint as constraint_row
    where constraint_row.conrelid =
        'public.course_publication_revision'::regclass
      and constraint_row.conname =
        'course_publication_revision_snapshot_check'
      and pg_get_constraintdef(constraint_row.oid) like '%schemaVersion%1%'
  ) then
    raise exception 'course_publication_v2_legacy_constraint_missing';
  end if;
end
$preflight$;

create temporary table course_publication_v2_revision_baseline
on commit drop
as
select revision.id, md5(revision.snapshot::text) as snapshot_md5
from public.course_publication_revision as revision;

alter table public.course_publication_revision
  drop constraint course_publication_revision_snapshot_check;

alter table public.course_publication_revision
  add constraint course_publication_revision_snapshot_check check (
    jsonb_typeof(snapshot) = 'object'
    and snapshot ->> 'schemaVersion' in ('1', '2')
    and jsonb_typeof(snapshot -> 'course') = 'object'
    and jsonb_typeof(snapshot -> 'lessons') = 'array'
    and jsonb_typeof(snapshot -> 'materials') = 'array'
    and (
      snapshot ->> 'schemaVersion' = '1'
      or jsonb_typeof(snapshot -> 'objectives') = 'array'
    )
    and octet_length(snapshot::text) <= 16777216
  );

-- PUBLISH_FUNCTION_V2
CREATE OR REPLACE FUNCTION public.publish_course_revision_admin(p_actor_account_id uuid, p_source_course_id uuid, p_publication_id uuid, p_revision_id uuid, p_content_sha256 text, p_snapshot jsonb, p_asset_manifest jsonb, p_rights_confirmed boolean) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $_$
declare
  v_course public.course%rowtype;
  v_publisher_display_name text;
  v_publication public.course_publication%rowtype;
  v_revision public.course_publication_revision%rowtype;
  v_revision_number integer;
  v_lesson_count integer;
  v_component_count integer;
  v_objective_count integer;
  v_slide_count integer;
  v_asset_count integer;
  v_asset_total_bytes bigint;
  v_existing_snapshot_bytes bigint;
  v_existing_asset_bytes bigint;
  v_candidate_storage_bytes bigint;
  v_asset_id_map jsonb;
  v_snapshot_course jsonb;
  v_snapshot_version integer;
begin
  if p_actor_account_id is null
    or p_source_course_id is null
    or p_publication_id is null
    or p_revision_id is null
    or p_content_sha256 is null
    or p_content_sha256 !~ '^[0-9a-f]{64}$'
    or p_rights_confirmed is distinct from true
    or p_snapshot is null
    or jsonb_typeof(p_snapshot) <> 'object'
    or p_asset_manifest is null
    or jsonb_typeof(p_asset_manifest) <> 'array'
  then
    raise exception 'course_publication_publish_invalid'
      using errcode = '22023';
  end if;

  v_snapshot_version := case
    when p_snapshot ->> 'schemaVersion' in ('1', '2')
      then (p_snapshot ->> 'schemaVersion')::integer
    else null
  end;

  if v_snapshot_version is null
    or (
      v_snapshot_version = 1
      and (
        (p_snapshot - array['schemaVersion', 'course', 'lessons', 'materials'])
          <> '{}'::jsonb
        or not (p_snapshot ?& array[
          'schemaVersion', 'course', 'lessons', 'materials'
        ])
      )
    )
    or (
      v_snapshot_version = 2
      and (
        (p_snapshot - array[
          'schemaVersion', 'course', 'objectives', 'lessons', 'materials'
        ]) <> '{}'::jsonb
        or not (p_snapshot ?& array[
          'schemaVersion', 'course', 'objectives', 'lessons', 'materials'
        ])
        or jsonb_typeof(p_snapshot -> 'objectives') <> 'array'
      )
    )
    or jsonb_typeof(p_snapshot -> 'course') <> 'object'
    or jsonb_typeof(p_snapshot -> 'lessons') <> 'array'
    or jsonb_typeof(p_snapshot -> 'materials') <> 'array'
  then
    raise exception 'course_publication_snapshot_shape_invalid'
      using errcode = '22023';
  end if;

  select course.*
  into v_course
  from public.course as course
  where course.id = p_source_course_id
    and course.owner_account_id = p_actor_account_id
  for update;

  if not found then
    raise exception 'course_publication_source_not_found'
      using errcode = 'P0002';
  end if;

  select account.display_name
  into v_publisher_display_name
  from public.account as account
  where account.id = p_actor_account_id
    and account.status = 'active'
  for update;

  if not found then
    raise exception 'course_publication_actor_not_active'
      using errcode = '42501';
  end if;

  select publication.*
  into v_publication
  from public.course_publication as publication
  where publication.source_course_id = p_source_course_id
  for update;

  if found and v_publication.id <> p_publication_id then
    raise exception 'course_publication_id_conflict'
      using errcode = '23505';
  end if;

  if v_publication.id is not null then
    select revision.*
    into strict v_revision
    from public.course_publication_revision as revision
    where revision.id = v_publication.current_revision_id;
  end if;

  perform 1
  from public.lesson as lesson
  where lesson.course_id = p_source_course_id
  order by lesson.id
  for update;

  perform 1
  from public.lesson_component as component
  join public.lesson as lesson on lesson.id = component.lesson_id
  where lesson.course_id = p_source_course_id
  order by component.id
  for update of component;

  perform 1
  from public.learning_objective as objective
  where objective.course_id = p_source_course_id
  order by objective.created_at, objective.id
  for share of objective;

  perform 1
  from public.lesson_student_slide as slide
  join public.lesson as lesson on lesson.id = slide.lesson_id
  where lesson.course_id = p_source_course_id
  order by slide.id
  for update of slide;

  perform 1
  from public.course_attachment as attachment
  where attachment.course_id = p_source_course_id
  order by attachment.id
  for update;

  perform 1
  from public.stored_file as stored_file
  join public.course_attachment as attachment
    on attachment.stored_file_id = stored_file.id
  where attachment.course_id = p_source_course_id
  order by stored_file.id
  for share of stored_file;

  v_snapshot_course := p_snapshot -> 'course';

  if (v_snapshot_course - array[
      'title',
      'subject',
      'goal',
      'level',
      'audienceDescription',
      'targetLessonCount'
    ]) <> '{}'::jsonb
    or not (v_snapshot_course ?& array[
      'title',
      'subject',
      'goal',
      'level',
      'audienceDescription',
      'targetLessonCount'
    ])
    or v_snapshot_course ->> 'title' is distinct from v_course.title
    or coalesce(v_snapshot_course ->> 'subject', '')
      is distinct from coalesce(v_course.subject, '')
    or coalesce(v_snapshot_course ->> 'goal', '')
      is distinct from coalesce(v_course.goal, '')
    or coalesce(v_snapshot_course ->> 'level', '')
      is distinct from coalesce(v_course.level, '')
    or coalesce(v_snapshot_course ->> 'audienceDescription', '')
      is distinct from coalesce(v_course.audience_description, '')
    or coalesce(v_snapshot_course -> 'targetLessonCount', 'null'::jsonb)
      is distinct from coalesce(to_jsonb(v_course.target_lesson_count), 'null'::jsonb)
  then
    raise exception 'course_publication_course_snapshot_mismatch'
      using errcode = '23514';
  end if;

  select count(*)::integer
  into v_objective_count
  from public.learning_objective as objective
  where objective.course_id = p_source_course_id;

  if v_snapshot_version = 1 then
    if v_objective_count <> 0
      or exists (
        select 1
        from public.lesson_component as component
        join public.lesson as lesson on lesson.id = component.lesson_id
        where lesson.course_id = p_source_course_id
          and (
            component.primary_learning_objective_id is not null
            or component.activity_role is not null
          )
      )
    then
      raise exception 'course_publication_snapshot_version_too_old'
        using errcode = '23514';
    end if;
  elsif jsonb_array_length(p_snapshot -> 'objectives') <> v_objective_count
    or exists (
      select 1
      from jsonb_array_elements(p_snapshot -> 'objectives')
        as submitted(value)
      where jsonb_typeof(submitted.value) <> 'object'
        or (submitted.value - array[
          'ref',
          'position',
          'title',
          'description',
          'archivedAt'
        ]) <> '{}'::jsonb
        or not (submitted.value ?& array[
          'ref',
          'position',
          'title',
          'description',
          'archivedAt'
        ])
        or jsonb_typeof(submitted.value -> 'ref') <> 'string'
        or jsonb_typeof(submitted.value -> 'position') <> 'number'
        or jsonb_typeof(submitted.value -> 'title') <> 'string'
        or coalesce(jsonb_typeof(submitted.value -> 'description'), 'null')
          not in ('string', 'null')
        or coalesce(jsonb_typeof(submitted.value -> 'archivedAt'), 'null')
          not in ('string', 'null')
        or char_length(btrim(submitted.value ->> 'title'))
          not between 2 and 240
        or (
          jsonb_typeof(submitted.value -> 'description') = 'string'
          and (
            btrim(submitted.value ->> 'description') = ''
            or char_length(btrim(submitted.value ->> 'description')) > 2000
          )
        )
    )
    or (
      select count(distinct (submitted.value ->> 'ref')::uuid)
      from jsonb_array_elements(p_snapshot -> 'objectives')
        as submitted(value)
    ) <> v_objective_count
    or (
      select count(distinct (submitted.value ->> 'position')::integer)
      from jsonb_array_elements(p_snapshot -> 'objectives')
        as submitted(value)
    ) <> v_objective_count
    or exists (
      with ordered_objective as (
        select
          objective.*,
          row_number() over (
            order by objective.created_at, objective.id
          )::integer as position
        from public.learning_objective as objective
        where objective.course_id = p_source_course_id
      )
      select 1
      from ordered_objective as objective
      left join lateral (
        select submitted.value
        from jsonb_array_elements(p_snapshot -> 'objectives')
          as submitted(value)
        where (submitted.value ->> 'position')::integer = objective.position
        limit 1
      ) as submitted on true
      where submitted.value is null
        or submitted.value ->> 'title' is distinct from objective.title
        or nullif(submitted.value ->> 'description', '')
          is distinct from objective.description
        or case
          when jsonb_typeof(submitted.value -> 'archivedAt') = 'string'
            then (submitted.value ->> 'archivedAt')::timestamptz
          else null
        end is distinct from objective.archived_at
    )
  then
    raise exception 'course_publication_objective_snapshot_mismatch'
      using errcode = '23514';
  end if;

  select count(*)::integer
  into v_lesson_count
  from public.lesson as lesson
  where lesson.course_id = p_source_course_id;

  if v_lesson_count < 1
    or jsonb_array_length(p_snapshot -> 'lessons') <> v_lesson_count
  then
    raise exception 'course_publication_requires_lessons'
      using errcode = '23514';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_snapshot -> 'lessons') as submitted(value)
    where jsonb_typeof(submitted.value) <> 'object'
      or (submitted.value - array[
        'ref',
        'position',
        'title',
        'summary',
        'estimatedDurationMinutes',
        'components',
        'slides'
      ]) <> '{}'::jsonb
      or not (submitted.value ?& array[
        'ref',
        'position',
        'title',
        'summary',
        'estimatedDurationMinutes',
        'components',
        'slides'
      ])
      or jsonb_typeof(submitted.value -> 'components') <> 'array'
      or jsonb_typeof(submitted.value -> 'slides') <> 'array'
  ) then
    raise exception 'course_publication_lesson_snapshot_invalid'
      using errcode = '22023';
  end if;

  if (
    select count(distinct (submitted.value ->> 'ref')::uuid)
    from jsonb_array_elements(p_snapshot -> 'lessons') as submitted(value)
  ) <> v_lesson_count
  or exists (
    select 1
    from public.lesson as lesson
    left join lateral (
      select submitted.value
      from jsonb_array_elements(p_snapshot -> 'lessons') as submitted(value)
      where (submitted.value ->> 'position')::integer = lesson.position
      limit 1
    ) as submitted on true
    where lesson.course_id = p_source_course_id
      and (
        submitted.value is null
        or (submitted.value ->> 'position')::integer <> lesson.position
        or submitted.value ->> 'title' is distinct from lesson.title
        or coalesce(submitted.value ->> 'summary', '')
          is distinct from coalesce(lesson.summary, '')
        or coalesce(
          submitted.value -> 'estimatedDurationMinutes',
          'null'::jsonb
        ) is distinct from coalesce(
          to_jsonb(lesson.estimated_duration_minutes),
          'null'::jsonb
        )
      )
  ) then
    raise exception 'course_publication_lesson_snapshot_mismatch'
      using errcode = '23514';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_snapshot -> 'lessons') as submitted_lesson(value)
    cross join lateral jsonb_array_elements(
      submitted_lesson.value -> 'components'
    ) as submitted_component(value)
    where jsonb_typeof(submitted_component.value) <> 'object'
      or (
        v_snapshot_version = 1
        and (
          (submitted_component.value - array[
            'ref',
            'position',
            'typeKey',
            'schemaVersion',
            'payload',
            'placement',
            'visibility',
            'studentSlideRef'
          ]) <> '{}'::jsonb
          or not (submitted_component.value ?& array[
            'ref',
            'position',
            'typeKey',
            'schemaVersion',
            'payload',
            'placement',
            'visibility',
            'studentSlideRef'
          ])
        )
      )
      or (
        v_snapshot_version = 2
        and (
          (submitted_component.value - array[
            'ref',
            'position',
            'typeKey',
            'schemaVersion',
            'payload',
            'placement',
            'visibility',
            'studentSlideRef',
            'primaryObjectiveRef',
            'activityRole'
          ]) <> '{}'::jsonb
          or not (submitted_component.value ?& array[
            'ref',
            'position',
            'typeKey',
            'schemaVersion',
            'payload',
            'placement',
            'visibility',
            'studentSlideRef',
            'primaryObjectiveRef',
            'activityRole'
          ])
          or coalesce(
            jsonb_typeof(submitted_component.value -> 'primaryObjectiveRef'),
            'null'
          ) not in ('string', 'null')
          or coalesce(
            jsonb_typeof(submitted_component.value -> 'activityRole'),
            'null'
          ) not in ('string', 'null')
          or (
            jsonb_typeof(submitted_component.value -> 'activityRole') =
              'string'
            and submitted_component.value ->> 'activityRole'
              not in ('practice', 'assessment', 'survey')
          )
        )
      )
      or jsonb_typeof(submitted_component.value -> 'payload') <> 'object'
      or jsonb_typeof(submitted_component.value -> 'placement') <> 'object'
  ) then
    raise exception 'course_publication_component_snapshot_invalid'
      using errcode = '22023';
  end if;

  select count(*)::integer
  into v_component_count
  from public.lesson_component as component
  join public.lesson as lesson on lesson.id = component.lesson_id
  where lesson.course_id = p_source_course_id;

  if (
    select count(*)
    from jsonb_array_elements(p_snapshot -> 'lessons') as submitted_lesson(value)
    cross join lateral jsonb_array_elements(
      submitted_lesson.value -> 'components'
    ) as submitted_component(value)
  ) <> v_component_count
  or (
    select count(distinct (submitted_component.value ->> 'ref')::uuid)
    from jsonb_array_elements(p_snapshot -> 'lessons') as submitted_lesson(value)
    cross join lateral jsonb_array_elements(
      submitted_lesson.value -> 'components'
    ) as submitted_component(value)
  ) <> v_component_count
  or exists (
    select 1
    from public.lesson_component as component
    join public.lesson as lesson on lesson.id = component.lesson_id
    left join lateral (
      select submitted_component.value
      from jsonb_array_elements(p_snapshot -> 'lessons') as submitted_lesson(value)
      cross join lateral jsonb_array_elements(
        submitted_lesson.value -> 'components'
      ) as submitted_component(value)
      where (submitted_lesson.value ->> 'position')::integer = lesson.position
        and (submitted_component.value ->> 'position')::integer
          = component.position
      limit 1
    ) as submitted on true
    left join public.lesson_student_slide as source_slide
      on source_slide.id = component.student_slide_id
    left join lateral (
      select submitted_slide.value
      from jsonb_array_elements(p_snapshot -> 'lessons') as submitted_lesson(value)
      cross join lateral jsonb_array_elements(
        submitted_lesson.value -> 'slides'
      ) as submitted_slide(value)
      where source_slide.id is not null
        and (submitted_lesson.value ->> 'position')::integer = lesson.position
        and (submitted_slide.value ->> 'position')::integer
          = source_slide.position
      limit 1
    ) as submitted_slide on true
    left join lateral (
      select ordered.position
      from (
        select
          objective.id,
          row_number() over (
            order by objective.created_at, objective.id
          )::integer as position
        from public.learning_objective as objective
        where objective.course_id = p_source_course_id
      ) as ordered
      where ordered.id = component.primary_learning_objective_id
      limit 1
    ) as source_objective on true
    left join lateral (
      select submitted_objective.value
      from jsonb_array_elements(
        case
          when v_snapshot_version = 2 then p_snapshot -> 'objectives'
          else '[]'::jsonb
        end
      ) as submitted_objective(value)
      where source_objective.position is not null
        and (submitted_objective.value ->> 'position')::integer
          = source_objective.position
      limit 1
    ) as submitted_objective on true
    where lesson.course_id = p_source_course_id
      and (
        submitted.value is null
        or (submitted.value ->> 'position')::integer <> component.position
        or submitted.value ->> 'typeKey' is distinct from component.type_key
        or (submitted.value ->> 'schemaVersion')::integer
          <> component.schema_version
        or submitted.value -> 'placement'
          is distinct from component.placement_config
        or submitted.value ->> 'visibility'
          is distinct from component.visibility
        or coalesce(submitted.value ->> 'studentSlideRef', '')
          is distinct from coalesce(
            submitted_slide.value ->> 'ref',
            ''
          )
        or (
          v_snapshot_version = 2
          and coalesce(submitted.value ->> 'primaryObjectiveRef', '')
            is distinct from coalesce(
              submitted_objective.value ->> 'ref',
              ''
            )
        )
        or (
          v_snapshot_version = 2
          and nullif(submitted.value ->> 'activityRole', '')
            is distinct from component.activity_role
        )
        or (
          component.type_key not in ('image', 'slideshow', 'file')
          and submitted.value -> 'payload' is distinct from component.payload
        )
      )
  ) then
    raise exception 'course_publication_component_snapshot_mismatch'
      using errcode = '23514';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_snapshot -> 'lessons') as submitted_lesson(value)
    cross join lateral jsonb_array_elements(
      submitted_lesson.value -> 'slides'
    ) as submitted_slide(value)
    where jsonb_typeof(submitted_slide.value) <> 'object'
      or (submitted_slide.value - array['ref', 'position']) <> '{}'::jsonb
      or not (submitted_slide.value ?& array['ref', 'position'])
  ) then
    raise exception 'course_publication_slide_snapshot_invalid'
      using errcode = '22023';
  end if;

  select count(*)::integer
  into v_slide_count
  from public.lesson_student_slide as slide
  join public.lesson as lesson on lesson.id = slide.lesson_id
  where lesson.course_id = p_source_course_id;

  if (
    select count(*)
    from jsonb_array_elements(p_snapshot -> 'lessons') as submitted_lesson(value)
    cross join lateral jsonb_array_elements(
      submitted_lesson.value -> 'slides'
    ) as submitted_slide(value)
  ) <> v_slide_count
  or (
    select count(distinct (submitted_slide.value ->> 'ref')::uuid)
    from jsonb_array_elements(p_snapshot -> 'lessons') as submitted_lesson(value)
    cross join lateral jsonb_array_elements(
      submitted_lesson.value -> 'slides'
    ) as submitted_slide(value)
  ) <> v_slide_count
  or exists (
    select 1
    from public.lesson_student_slide as slide
    join public.lesson as lesson on lesson.id = slide.lesson_id
    left join lateral (
      select submitted_slide.value
      from jsonb_array_elements(p_snapshot -> 'lessons') as submitted_lesson(value)
      cross join lateral jsonb_array_elements(
        submitted_lesson.value -> 'slides'
      ) as submitted_slide(value)
      where (submitted_lesson.value ->> 'position')::integer = lesson.position
        and (submitted_slide.value ->> 'position')::integer = slide.position
      limit 1
    ) as submitted on true
    where lesson.course_id = p_source_course_id
      and (
        submitted.value is null
        or (submitted.value ->> 'position')::integer <> slide.position
      )
  ) then
    raise exception 'course_publication_slide_snapshot_mismatch'
      using errcode = '23514';
  end if;

  if (
    select count(*) <> count(distinct authored.ref)
    from (
      select (submitted_objective.value ->> 'ref')::uuid as ref
      from jsonb_array_elements(
        case
          when v_snapshot_version = 2 then p_snapshot -> 'objectives'
          else '[]'::jsonb
        end
      ) as submitted_objective(value)
      union all
      select (submitted_lesson.value ->> 'ref')::uuid as ref
      from jsonb_array_elements(p_snapshot -> 'lessons') as submitted_lesson(value)
      union all
      select (submitted_component.value ->> 'ref')::uuid
      from jsonb_array_elements(p_snapshot -> 'lessons') as submitted_lesson(value)
      cross join lateral jsonb_array_elements(
        submitted_lesson.value -> 'components'
      ) as submitted_component(value)
      union all
      select (submitted_slide.value ->> 'ref')::uuid
      from jsonb_array_elements(p_snapshot -> 'lessons') as submitted_lesson(value)
      cross join lateral jsonb_array_elements(
        submitted_lesson.value -> 'slides'
      ) as submitted_slide(value)
    ) as authored(ref)
  ) then
    raise exception 'course_publication_authored_refs_not_unique'
      using errcode = '22023';
  end if;

  -- Republish the immutable current revision without requiring a second set of
  -- copied objects. Equality of both the caller hash and canonical snapshot is
  -- required so a forged hash cannot select stale catalog content.
  if v_publication.id is not null
    and v_revision.content_sha256 = p_content_sha256
    and v_revision.snapshot = p_snapshot
  then
    v_asset_count := jsonb_array_length(p_snapshot -> 'materials');

    if jsonb_array_length(p_asset_manifest) <> 0
      or v_asset_count > 24
      or exists (
        select 1
        from jsonb_array_elements(p_snapshot -> 'materials') as material(value)
        where jsonb_typeof(material.value) <> 'object'
          or (material.value - array[
            'ref',
            'originalFilename',
            'mimeType',
            'sizeBytes',
            'checksumSha256'
          ]) <> '{}'::jsonb
          or not (material.value ?& array[
            'ref',
            'originalFilename',
            'mimeType',
            'sizeBytes',
            'checksumSha256'
          ])
      )
    then
      raise exception 'course_publication_idempotent_assets_invalid'
        using errcode = '22023';
    end if;

    -- A byte-equal snapshot is acknowledged only if the live Course still has
    -- exactly the attachment set and ready StoredFile metadata captured by the
    -- immutable revision. This closes the service-read -> RPC detach race.
    if (
      select count(*)
      from public.course_publication_asset as asset
      where asset.revision_id = v_revision.id
    ) <> v_asset_count
    or (
      select count(*)
      from public.course_attachment as attachment
      where attachment.course_id = p_source_course_id
    ) <> v_asset_count
    or (
      select count(distinct (material.value ->> 'ref')::uuid)
      from jsonb_array_elements(p_snapshot -> 'materials') as material(value)
    ) <> v_asset_count
    or exists (
      select 1
      from public.course_publication_asset as asset
      left join public.course_attachment as attachment
        on attachment.course_id = p_source_course_id
        and attachment.stored_file_id = asset.source_stored_file_id
      left join public.stored_file as stored_file
        on stored_file.id = asset.source_stored_file_id
      left join lateral (
        select material.value
        from jsonb_array_elements(p_snapshot -> 'materials') as material(value)
        where (material.value ->> 'ref')::uuid = asset.id
        limit 1
      ) as material on true
      where asset.revision_id = v_revision.id
        and (
          asset.source_stored_file_id is null
          or attachment.id is null
          or stored_file.id is null
          or stored_file.owner_account_id <> p_actor_account_id
          or stored_file.status <> 'ready'
          or stored_file.original_filename
            is distinct from asset.original_filename
          or stored_file.mime_type is distinct from asset.mime_type
          or stored_file.size_bytes is distinct from asset.size_bytes
          or stored_file.checksum_sha256
            is distinct from asset.checksum_sha256
          or material.value is null
          or material.value ->> 'originalFilename'
            is distinct from asset.original_filename
          or material.value ->> 'mimeType' is distinct from asset.mime_type
          or (material.value ->> 'sizeBytes')::bigint
            is distinct from asset.size_bytes
          or material.value ->> 'checksumSha256'
            is distinct from asset.checksum_sha256
          or not exists (
            select 1
            from storage.objects as object
            where object.bucket_id = asset.storage_bucket
              and object.name = asset.storage_path
          )
        )
    )
    then
      raise exception 'course_publication_idempotent_assets_mismatch'
        using errcode = '23514';
    end if;

    select coalesce(
      jsonb_object_agg(
        asset.source_stored_file_id::text,
        to_jsonb(asset.id::text)
      ) filter (where asset.source_stored_file_id is not null),
      '{}'::jsonb
    )
    into v_asset_id_map
    from public.course_publication_asset as asset
    where asset.revision_id = v_revision.id;

    if not public.course_publication_snapshot_payloads_match(
      p_source_course_id,
      p_snapshot,
      v_asset_id_map
    ) then
      raise exception 'course_publication_component_payload_mismatch'
        using errcode = '23514';
    end if;

    update public.course_publication as publication
    set title = v_snapshot_course ->> 'title',
        subject = v_snapshot_course ->> 'subject',
        goal = v_snapshot_course ->> 'goal',
        level = v_snapshot_course ->> 'level',
        audience_description = v_snapshot_course ->> 'audienceDescription',
        target_lesson_count =
          (v_snapshot_course ->> 'targetLessonCount')::integer,
        lesson_count = v_lesson_count,
        material_count = jsonb_array_length(p_snapshot -> 'materials'),
        source_content_updated_at =
          v_course.publication_content_updated_at,
        status = 'published',
        unpublished_at = null,
        updated_at = clock_timestamp()
    where publication.id = v_publication.id
    returning publication.* into v_publication;

    return jsonb_build_object(
      'publicationId', v_publication.id,
      'sourceCourseId', v_publication.source_course_id,
      'status', v_publication.status,
      'currentRevisionId', v_revision.id,
      'publishedAt', v_publication.published_at,
      'updatedAt', v_publication.updated_at,
      'sourceCourseUpdatedAt', v_revision.source_course_updated_at,
      'sourceContentUpdatedAt', v_publication.source_content_updated_at,
      'contentSha256', v_revision.content_sha256
    );
  end if;

  if v_publication.id is not null
    and v_revision.content_sha256 = p_content_sha256
  then
    raise exception 'course_publication_current_hash_snapshot_mismatch'
      using errcode = '23514';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_snapshot -> 'materials') as material(value)
    where jsonb_typeof(material.value) <> 'object'
      or (material.value - array[
        'ref',
        'originalFilename',
        'mimeType',
        'sizeBytes',
        'checksumSha256'
      ]) <> '{}'::jsonb
      or not (material.value ?& array[
        'ref',
        'originalFilename',
        'mimeType',
        'sizeBytes',
        'checksumSha256'
      ])
  ) or exists (
    select 1
    from jsonb_array_elements(p_asset_manifest) as asset(value)
    where jsonb_typeof(asset.value) <> 'object'
      or (asset.value - array[
        'publicationAssetId',
        'sourceStoredFileId',
        'originalFilename',
        'mimeType',
        'sizeBytes',
        'checksumSha256',
        'storageBucket',
        'storagePath'
      ]) <> '{}'::jsonb
      or not (asset.value ?& array[
        'publicationAssetId',
        'sourceStoredFileId',
        'originalFilename',
        'mimeType',
        'sizeBytes',
        'checksumSha256',
        'storageBucket',
        'storagePath'
      ])
  ) then
    raise exception 'course_publication_asset_manifest_shape_invalid'
      using errcode = '22023';
  end if;

  v_asset_count := jsonb_array_length(p_asset_manifest);
  if v_asset_count > 24
    or jsonb_array_length(p_snapshot -> 'materials') <> v_asset_count
    or (
      select count(*)
      from public.course_attachment as attachment
      where attachment.course_id = p_source_course_id
    ) <> v_asset_count
  then
    raise exception 'course_publication_asset_limit_exceeded'
      using errcode = '54000';
  end if;

  select coalesce(sum(asset."sizeBytes"), 0)
  into v_asset_total_bytes
  from jsonb_to_recordset(p_asset_manifest) as asset(
    "publicationAssetId" uuid,
    "sourceStoredFileId" uuid,
    "originalFilename" text,
    "mimeType" text,
    "sizeBytes" bigint,
    "checksumSha256" text,
    "storageBucket" text,
    "storagePath" text
  );

  if v_asset_total_bytes > 125829120
    or (
      select count(distinct asset."publicationAssetId")
      from jsonb_to_recordset(p_asset_manifest) as asset(
        "publicationAssetId" uuid,
        "sourceStoredFileId" uuid
      )
    ) <> v_asset_count
    or (
      select count(distinct asset."sourceStoredFileId")
      from jsonb_to_recordset(p_asset_manifest) as asset(
        "publicationAssetId" uuid,
        "sourceStoredFileId" uuid
      )
    ) <> v_asset_count
  then
    raise exception 'course_publication_asset_manifest_not_exact'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_asset_manifest) as asset(
      "publicationAssetId" uuid,
      "sourceStoredFileId" uuid,
      "originalFilename" text,
      "mimeType" text,
      "sizeBytes" bigint,
      "checksumSha256" text,
      "storageBucket" text,
      "storagePath" text
    )
    left join public.course_attachment as attachment
      on attachment.course_id = p_source_course_id
      and attachment.stored_file_id = asset."sourceStoredFileId"
    left join public.stored_file as stored_file
      on stored_file.id = asset."sourceStoredFileId"
    left join lateral (
      select material.value
      from jsonb_array_elements(p_snapshot -> 'materials') as material(value)
      where (material.value ->> 'ref')::uuid = asset."publicationAssetId"
      limit 1
    ) as material on true
    where attachment.id is null
      or stored_file.id is null
      or stored_file.owner_account_id <> p_actor_account_id
      or stored_file.status <> 'ready'
      or stored_file.original_filename is distinct from asset."originalFilename"
      or stored_file.mime_type is distinct from asset."mimeType"
      or stored_file.size_bytes is distinct from asset."sizeBytes"
      or stored_file.checksum_sha256 is distinct from asset."checksumSha256"
      or asset."sizeBytes" <= 0
      or asset."sizeBytes" > 10485760
      or asset."checksumSha256" !~ '^[0-9a-f]{64}$'
      or asset."storageBucket" <> 'course-publication-assets'
      or asset."storagePath" <> concat(
        p_publication_id::text,
        '/revisions/',
        p_revision_id::text,
        '/assets/',
        asset."publicationAssetId"::text
      )
      or material.value is null
      or material.value ->> 'originalFilename'
        is distinct from asset."originalFilename"
      or material.value ->> 'mimeType' is distinct from asset."mimeType"
      or (material.value ->> 'sizeBytes')::bigint
        is distinct from asset."sizeBytes"
      or material.value ->> 'checksumSha256'
        is distinct from asset."checksumSha256"
      or not exists (
        select 1
        from storage.objects as object
        where object.bucket_id = 'course-publication-assets'
          and object.name = asset."storagePath"
      )
  ) then
    raise exception 'course_publication_asset_manifest_mismatch'
      using errcode = '23514';
  end if;

  if (
    select count(distinct (material.value ->> 'ref')::uuid)
    from jsonb_array_elements(p_snapshot -> 'materials') as material(value)
  ) <> v_asset_count
  or (
    select count(*) <> count(distinct all_ref.ref)
    from (
      select (submitted_objective.value ->> 'ref')::uuid as ref
      from jsonb_array_elements(
        case
          when v_snapshot_version = 2 then p_snapshot -> 'objectives'
          else '[]'::jsonb
        end
      ) as submitted_objective(value)
      union all
      select (submitted_lesson.value ->> 'ref')::uuid as ref
      from jsonb_array_elements(p_snapshot -> 'lessons') as submitted_lesson(value)
      union all
      select (submitted_component.value ->> 'ref')::uuid
      from jsonb_array_elements(p_snapshot -> 'lessons') as submitted_lesson(value)
      cross join lateral jsonb_array_elements(
        submitted_lesson.value -> 'components'
      ) as submitted_component(value)
      union all
      select (submitted_slide.value ->> 'ref')::uuid
      from jsonb_array_elements(p_snapshot -> 'lessons') as submitted_lesson(value)
      cross join lateral jsonb_array_elements(
        submitted_lesson.value -> 'slides'
      ) as submitted_slide(value)
      union all
      select (material.value ->> 'ref')::uuid
      from jsonb_array_elements(p_snapshot -> 'materials') as material(value)
    ) as all_ref(ref)
  )
  then
    raise exception 'course_publication_material_manifest_not_exact'
      using errcode = '22023';
  end if;

  select coalesce(
    jsonb_object_agg(
      asset."sourceStoredFileId"::text,
      to_jsonb(asset."publicationAssetId"::text)
    ),
    '{}'::jsonb
  )
  into v_asset_id_map
  from jsonb_to_recordset(p_asset_manifest) as asset(
    "publicationAssetId" uuid,
    "sourceStoredFileId" uuid
  );

  if not public.course_publication_snapshot_payloads_match(
    p_source_course_id,
    p_snapshot,
    v_asset_id_map
  ) then
    raise exception 'course_publication_component_payload_mismatch'
      using errcode = '23514';
  end if;

  -- The Account row was locked above, so concurrent publications for this
  -- owner cannot both observe the same remaining quota. This branch is only
  -- reached for a new immutable revision; idempotent republish returned before
  -- it and consumes no additional quota.
  v_candidate_storage_bytes :=
    octet_length(p_snapshot::text)::bigint + v_asset_total_bytes;

  select coalesce(
    sum(octet_length(revision.snapshot::text)::bigint),
    0
  )
  into v_existing_snapshot_bytes
  from public.course_publication_revision as revision
  join public.course_publication as publication
    on publication.id = revision.publication_id
  where publication.owner_account_id = p_actor_account_id;

  select coalesce(sum(asset.size_bytes), 0)
  into v_existing_asset_bytes
  from public.course_publication_asset as asset
  join public.course_publication_revision as revision
    on revision.id = asset.revision_id
  join public.course_publication as publication
    on publication.id = revision.publication_id
  where publication.owner_account_id = p_actor_account_id;

  if v_existing_snapshot_bytes
      + v_existing_asset_bytes
      + v_candidate_storage_bytes > 5368709120
  then
    raise exception 'course_publication_account_quota_exceeded'
      using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.course_publication_revision as revision
    where revision.id = p_revision_id
  ) then
    raise exception 'course_publication_revision_id_conflict'
      using errcode = '23505';
  end if;

  select coalesce(max(revision.revision_number), 0) + 1
  into v_revision_number
  from public.course_publication_revision as revision
  where revision.publication_id = p_publication_id;

  if v_publication.id is null then
    insert into public.course_publication (
      id,
      source_course_id,
      owner_account_id,
      publisher_display_name,
      is_shidao,
      title,
      subject,
      goal,
      level,
      audience_description,
      target_lesson_count,
      lesson_count,
      material_count,
      status,
      current_revision_id,
      source_content_updated_at,
      published_at,
      unpublished_at,
      created_at,
      updated_at
    )
    values (
      p_publication_id,
      p_source_course_id,
      p_actor_account_id,
      v_publisher_display_name,
      false,
      v_snapshot_course ->> 'title',
      v_snapshot_course ->> 'subject',
      v_snapshot_course ->> 'goal',
      v_snapshot_course ->> 'level',
      v_snapshot_course ->> 'audienceDescription',
      (v_snapshot_course ->> 'targetLessonCount')::integer,
      v_lesson_count,
      v_asset_count,
      'published',
      p_revision_id,
      v_course.publication_content_updated_at,
      clock_timestamp(),
      null,
      clock_timestamp(),
      clock_timestamp()
    )
    returning * into v_publication;
  end if;

  insert into public.course_publication_revision (
    id,
    publication_id,
    revision_number,
    source_course_updated_at,
    content_sha256,
    snapshot,
    rights_confirmed_at,
    license_code,
    published_at
  )
  values (
    p_revision_id,
    p_publication_id,
    v_revision_number,
    v_course.publication_content_updated_at,
    p_content_sha256,
    p_snapshot,
    clock_timestamp(),
    'shidao_catalog_reuse_v1',
    clock_timestamp()
  )
  returning * into v_revision;

  insert into public.course_publication_asset (
    id,
    revision_id,
    source_stored_file_id,
    storage_bucket,
    storage_path,
    original_filename,
    mime_type,
    size_bytes,
    checksum_sha256
  )
  select
    asset."publicationAssetId",
    p_revision_id,
    asset."sourceStoredFileId",
    asset."storageBucket",
    asset."storagePath",
    asset."originalFilename",
    asset."mimeType",
    asset."sizeBytes",
    asset."checksumSha256"
  from jsonb_to_recordset(p_asset_manifest) as asset(
    "publicationAssetId" uuid,
    "sourceStoredFileId" uuid,
    "originalFilename" text,
    "mimeType" text,
    "sizeBytes" bigint,
    "checksumSha256" text,
    "storageBucket" text,
    "storagePath" text
  );

  update public.course_publication as publication
  set title = v_snapshot_course ->> 'title',
      subject = v_snapshot_course ->> 'subject',
      goal = v_snapshot_course ->> 'goal',
      level = v_snapshot_course ->> 'level',
      audience_description = v_snapshot_course ->> 'audienceDescription',
      target_lesson_count =
        (v_snapshot_course ->> 'targetLessonCount')::integer,
      lesson_count = v_lesson_count,
      material_count = v_asset_count,
      current_revision_id = p_revision_id,
      source_content_updated_at = v_course.publication_content_updated_at,
      status = 'published',
      unpublished_at = null,
      updated_at = clock_timestamp()
  where publication.id = p_publication_id
    and publication.owner_account_id = p_actor_account_id
  returning publication.* into v_publication;

  if not found then
    raise exception 'course_publication_update_conflict'
      using errcode = '40001';
  end if;

  return jsonb_build_object(
    'publicationId', v_publication.id,
    'sourceCourseId', v_publication.source_course_id,
    'status', v_publication.status,
    'currentRevisionId', v_revision.id,
    'publishedAt', v_publication.published_at,
    'updatedAt', v_publication.updated_at,
    'sourceCourseUpdatedAt', v_revision.source_course_updated_at,
    'sourceContentUpdatedAt', v_publication.source_content_updated_at,
    'contentSha256', v_revision.content_sha256
  );
end
$_$;


--

-- CLONE_FUNCTION_V2
CREATE OR REPLACE FUNCTION public.clone_course_publication_admin(p_actor_account_id uuid, p_publication_id uuid, p_target_course_id uuid, p_target_title text, p_id_map jsonb, p_asset_manifest jsonb) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
declare
  v_publication public.course_publication%rowtype;
  v_revision public.course_publication_revision%rowtype;
  v_catalog_owner_account_id uuid;
  v_lesson_count integer;
  v_component_count integer;
  v_slide_count integer;
  v_objective_count integer;
  v_asset_count integer;
  v_asset_total_bytes bigint;
  v_asset_id_map jsonb;
  v_snapshot_version integer;
  v_objective_created_at timestamptz;
begin
  if p_actor_account_id is null
    or p_publication_id is null
    or p_target_course_id is null
    or (
      p_target_title is not null
      and (
        btrim(p_target_title) = ''
        or char_length(btrim(p_target_title)) > 160
      )
    )
    or p_id_map is null
    or jsonb_typeof(p_id_map) <> 'object'
    or p_asset_manifest is null
    or jsonb_typeof(p_asset_manifest) <> 'array'
  then
    raise exception 'course_publication_clone_invalid'
      using errcode = '22023';
  end if;

  select publication.owner_account_id
  into v_catalog_owner_account_id
  from public.course_publication as publication
  where publication.id = p_publication_id;

  if not found then
    raise exception 'course_publication_not_published'
      using errcode = 'P0002';
  end if;

  -- Lock actor and catalog owner in one deterministic order. Account status
  -- transitions therefore serialize with cloning without cross-owner deadlocks.
  perform 1
  from public.account as account
  where account.id in (p_actor_account_id, v_catalog_owner_account_id)
  order by account.id
  for share;

  perform 1
  from public.account as account
  where account.id = p_actor_account_id
    and account.status = 'active';

  if not found then
    raise exception 'course_publication_clone_actor_not_active'
      using errcode = '42501';
  end if;

  perform 1
  from public.account as account
  where account.id = v_catalog_owner_account_id
    and account.status = 'active';

  if not found then
    raise exception 'course_publication_not_published'
      using errcode = 'P0002';
  end if;

  if exists (
    select 1
    from public.course as course
    where course.id = p_target_course_id
  ) then
    raise exception 'course_publication_clone_course_id_conflict'
      using errcode = '23505';
  end if;

  select publication.*
  into v_publication
  from public.course_publication as publication
  where publication.id = p_publication_id
    and publication.status = 'published'
    and publication.owner_account_id = v_catalog_owner_account_id
  for share;

  if not found then
    raise exception 'course_publication_not_published'
      using errcode = 'P0002';
  end if;

  select revision.*
  into strict v_revision
  from public.course_publication_revision as revision
  where revision.publication_id = v_publication.id
    and revision.id = v_publication.current_revision_id
  for share;

  v_snapshot_version := (v_revision.snapshot ->> 'schemaVersion')::integer;
  if not (p_id_map ? 'objectives') then
    p_id_map := p_id_map || jsonb_build_object('objectives', '[]'::jsonb);
  end if;

  if (p_id_map - array[
      'objectives', 'lessons', 'components', 'slides'
    ]) <> '{}'::jsonb
    or jsonb_typeof(p_id_map -> 'objectives') <> 'array'
    or jsonb_typeof(p_id_map -> 'lessons') <> 'array'
    or jsonb_typeof(p_id_map -> 'components') <> 'array'
    or jsonb_typeof(p_id_map -> 'slides') <> 'array'
  then
    raise exception 'course_publication_clone_id_map_shape_invalid'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_id_map -> 'objectives') as item(value)
    where jsonb_typeof(item.value) <> 'object'
      or (item.value - array['ref', 'id']) <> '{}'::jsonb
      or not (item.value ? 'ref')
      or not (item.value ? 'id')
  ) or exists (
    select 1
    from jsonb_array_elements(p_id_map -> 'lessons') as item(value)
    where jsonb_typeof(item.value) <> 'object'
      or (item.value - array['ref', 'id']) <> '{}'::jsonb
      or not (item.value ? 'ref')
      or not (item.value ? 'id')
  ) or exists (
    select 1
    from jsonb_array_elements(p_id_map -> 'components') as item(value)
    where jsonb_typeof(item.value) <> 'object'
      or (item.value - array['ref', 'id']) <> '{}'::jsonb
      or not (item.value ? 'ref')
      or not (item.value ? 'id')
  ) or exists (
    select 1
    from jsonb_array_elements(p_id_map -> 'slides') as item(value)
    where jsonb_typeof(item.value) <> 'object'
      or (item.value - array['ref', 'id']) <> '{}'::jsonb
      or not (item.value ? 'ref')
      or not (item.value ? 'id')
  ) then
    raise exception 'course_publication_clone_id_map_shape_invalid'
      using errcode = '22023';
  end if;

  v_objective_count := case
    when v_snapshot_version = 2
      then jsonb_array_length(v_revision.snapshot -> 'objectives')
    else 0
  end;
  v_lesson_count := jsonb_array_length(v_revision.snapshot -> 'lessons');

  select count(*)::integer
  into v_component_count
  from jsonb_array_elements(v_revision.snapshot -> 'lessons') as lesson(value)
  cross join lateral jsonb_array_elements(
    lesson.value -> 'components'
  ) as component(value);

  select count(*)::integer
  into v_slide_count
  from jsonb_array_elements(v_revision.snapshot -> 'lessons') as lesson(value)
  cross join lateral jsonb_array_elements(
    lesson.value -> 'slides'
  ) as slide(value);

  if jsonb_array_length(p_id_map -> 'objectives') <> v_objective_count
    or jsonb_array_length(p_id_map -> 'lessons') <> v_lesson_count
    or jsonb_array_length(p_id_map -> 'components') <> v_component_count
    or jsonb_array_length(p_id_map -> 'slides') <> v_slide_count
    or (
      select count(distinct (item.value ->> 'ref')::uuid)
      from jsonb_array_elements(p_id_map -> 'objectives') as item(value)
    ) <> v_objective_count
    or (
      select count(distinct (item.value ->> 'id')::uuid)
      from jsonb_array_elements(p_id_map -> 'objectives') as item(value)
    ) <> v_objective_count
    or (
      select count(distinct (item.value ->> 'ref')::uuid)
      from jsonb_array_elements(p_id_map -> 'lessons') as item(value)
    ) <> v_lesson_count
    or (
      select count(distinct (item.value ->> 'id')::uuid)
      from jsonb_array_elements(p_id_map -> 'lessons') as item(value)
    ) <> v_lesson_count
    or (
      select count(distinct (item.value ->> 'ref')::uuid)
      from jsonb_array_elements(p_id_map -> 'components') as item(value)
    ) <> v_component_count
    or (
      select count(distinct (item.value ->> 'id')::uuid)
      from jsonb_array_elements(p_id_map -> 'components') as item(value)
    ) <> v_component_count
    or (
      select count(distinct (item.value ->> 'ref')::uuid)
      from jsonb_array_elements(p_id_map -> 'slides') as item(value)
    ) <> v_slide_count
    or (
      select count(distinct (item.value ->> 'id')::uuid)
      from jsonb_array_elements(p_id_map -> 'slides') as item(value)
    ) <> v_slide_count
  then
    raise exception 'course_publication_clone_id_map_not_exact'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(
      case
        when v_snapshot_version = 2
          then v_revision.snapshot -> 'objectives'
        else '[]'::jsonb
      end
    ) as objective(value)
    where not exists (
      select 1
      from jsonb_array_elements(p_id_map -> 'objectives') as item(value)
      where item.value ->> 'ref' = objective.value ->> 'ref'
    )
  ) or exists (
    select 1
    from jsonb_array_elements(v_revision.snapshot -> 'lessons') as lesson(value)
    where not exists (
      select 1
      from jsonb_array_elements(p_id_map -> 'lessons') as item(value)
      where item.value ->> 'ref' = lesson.value ->> 'ref'
    )
  ) or exists (
    select 1
    from jsonb_array_elements(v_revision.snapshot -> 'lessons') as lesson(value)
    cross join lateral jsonb_array_elements(
      lesson.value -> 'components'
    ) as component(value)
    where not exists (
      select 1
      from jsonb_array_elements(p_id_map -> 'components') as item(value)
      where item.value ->> 'ref' = component.value ->> 'ref'
    )
  ) or exists (
    select 1
    from jsonb_array_elements(v_revision.snapshot -> 'lessons') as lesson(value)
    cross join lateral jsonb_array_elements(
      lesson.value -> 'slides'
    ) as slide(value)
    where not exists (
      select 1
      from jsonb_array_elements(p_id_map -> 'slides') as item(value)
      where item.value ->> 'ref' = slide.value ->> 'ref'
    )
  ) then
    raise exception 'course_publication_clone_id_map_not_exact'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_id_map -> 'objectives') as item(value)
    join public.learning_objective as objective
      on objective.id = (item.value ->> 'id')::uuid
  ) or exists (
    select 1
    from jsonb_array_elements(p_id_map -> 'lessons') as item(value)
    join public.lesson as lesson
      on lesson.id = (item.value ->> 'id')::uuid
  ) or exists (
    select 1
    from jsonb_array_elements(p_id_map -> 'components') as item(value)
    join public.lesson_component as component
      on component.id = (item.value ->> 'id')::uuid
  ) or exists (
    select 1
    from jsonb_array_elements(p_id_map -> 'slides') as item(value)
    join public.lesson_student_slide as slide
      on slide.id = (item.value ->> 'id')::uuid
  ) then
    raise exception 'course_publication_clone_target_id_conflict'
      using errcode = '23505';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_asset_manifest) as asset(value)
    where jsonb_typeof(asset.value) <> 'object'
      or (asset.value - array[
        'publicationAssetId',
        'targetStoredFileId',
        'originalFilename',
        'mimeType',
        'sizeBytes',
        'checksumSha256',
        'storageBucket',
        'storagePath'
      ]) <> '{}'::jsonb
      or not (asset.value ?& array[
        'publicationAssetId',
        'targetStoredFileId',
        'originalFilename',
        'mimeType',
        'sizeBytes',
        'checksumSha256',
        'storageBucket',
        'storagePath'
      ])
  ) then
    raise exception 'course_publication_clone_asset_manifest_shape_invalid'
      using errcode = '22023';
  end if;

  select count(*)::integer, coalesce(sum(asset.size_bytes), 0)
  into v_asset_count, v_asset_total_bytes
  from public.course_publication_asset as asset
  where asset.revision_id = v_revision.id;

  if v_asset_count > 24
    or v_asset_total_bytes > 125829120
    or jsonb_array_length(p_asset_manifest) <> v_asset_count
    or (
      select count(distinct asset."publicationAssetId")
      from jsonb_to_recordset(p_asset_manifest) as asset(
        "publicationAssetId" uuid,
        "targetStoredFileId" uuid
      )
    ) <> v_asset_count
    or (
      select count(distinct asset."targetStoredFileId")
      from jsonb_to_recordset(p_asset_manifest) as asset(
        "publicationAssetId" uuid,
        "targetStoredFileId" uuid
      )
    ) <> v_asset_count
  then
    raise exception 'course_publication_clone_asset_manifest_not_exact'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_asset_manifest) as submitted(
      "publicationAssetId" uuid,
      "targetStoredFileId" uuid,
      "originalFilename" text,
      "mimeType" text,
      "sizeBytes" bigint,
      "checksumSha256" text,
      "storageBucket" text,
      "storagePath" text
    )
    left join public.course_publication_asset as asset
      on asset.revision_id = v_revision.id
      and asset.id = submitted."publicationAssetId"
    left join public.stored_file as existing_file
      on existing_file.id = submitted."targetStoredFileId"
    where asset.id is null
      or existing_file.id is not null
      or submitted."originalFilename" is distinct from asset.original_filename
      or submitted."mimeType" is distinct from asset.mime_type
      or submitted."sizeBytes" is distinct from asset.size_bytes
      or submitted."checksumSha256" is distinct from asset.checksum_sha256
      or submitted."storageBucket" <> 'course-assets'
      or public.course_publication_asset_extension(submitted."mimeType") is null
      or submitted."storagePath" <> concat(
        p_actor_account_id::text,
        '/courses/',
        p_target_course_id::text,
        '/assets/',
        submitted."targetStoredFileId"::text,
        '/',
        submitted."targetStoredFileId"::text,
        '.',
        public.course_publication_asset_extension(submitted."mimeType")
      )
      or not exists (
        select 1
        from storage.objects as object
        where object.bucket_id = 'course-assets'
          and object.name = submitted."storagePath"
      )
  ) then
    raise exception 'course_publication_clone_asset_manifest_mismatch'
      using errcode = '23514';
  end if;

  select coalesce(
    jsonb_object_agg(
      asset."publicationAssetId"::text,
      to_jsonb(asset."targetStoredFileId"::text)
    ),
    '{}'::jsonb
  )
  into v_asset_id_map
  from jsonb_to_recordset(p_asset_manifest) as asset(
    "publicationAssetId" uuid,
    "targetStoredFileId" uuid
  );

  insert into public.course (
    id,
    owner_account_id,
    title,
    subject,
    goal,
    level,
    audience_description,
    target_lesson_count,
    teacher_preferences,
    audience_type,
    settings,
    assembled_at,
    archived_at,
    created_at,
    updated_at
  )
  values (
    p_target_course_id,
    p_actor_account_id,
    coalesce(
      btrim(p_target_title),
      v_revision.snapshot -> 'course' ->> 'title'
    ),
    v_revision.snapshot -> 'course' ->> 'subject',
    v_revision.snapshot -> 'course' ->> 'goal',
    v_revision.snapshot -> 'course' ->> 'level',
    v_revision.snapshot -> 'course' ->> 'audienceDescription',
    (v_revision.snapshot -> 'course' ->> 'targetLessonCount')::integer,
    '',
    'none',
    '{}'::jsonb,
    clock_timestamp(),
    null,
    clock_timestamp(),
    clock_timestamp()
  );

  v_objective_created_at := clock_timestamp();

  insert into public.learning_objective (
    id,
    course_id,
    title,
    description,
    archived_at,
    created_at,
    updated_at
  )
  select
    objective_map.id,
    p_target_course_id,
    submitted.title,
    submitted.description,
    null,
    v_objective_created_at
      + interval '1 microsecond' * (submitted.position - 1),
    v_objective_created_at
      + interval '1 microsecond' * (submitted.position - 1)
  from jsonb_to_recordset(
    case
      when v_snapshot_version = 2
        then v_revision.snapshot -> 'objectives'
      else '[]'::jsonb
    end
  ) as submitted(
    ref uuid,
    position integer,
    title text,
    description text,
    "archivedAt" timestamptz
  )
  join jsonb_to_recordset(p_id_map -> 'objectives') as objective_map(
    ref uuid,
    id uuid
  ) on objective_map.ref = submitted.ref
  order by submitted.position;

  insert into public.stored_file (
    id,
    owner_account_id,
    storage_bucket,
    storage_path,
    original_filename,
    mime_type,
    size_bytes,
    checksum_sha256,
    status,
    metadata,
    created_at,
    updated_at
  )
  select
    asset."targetStoredFileId",
    p_actor_account_id,
    'course-assets',
    asset."storagePath",
    asset."originalFilename",
    asset."mimeType",
    asset."sizeBytes",
    asset."checksumSha256",
    'ready',
    jsonb_build_object(
      'coursePublicationId', p_publication_id,
      'coursePublicationRevisionId', v_revision.id,
      'coursePublicationAssetId', asset."publicationAssetId"
    ),
    clock_timestamp(),
    clock_timestamp()
  from jsonb_to_recordset(p_asset_manifest) as asset(
    "publicationAssetId" uuid,
    "targetStoredFileId" uuid,
    "originalFilename" text,
    "mimeType" text,
    "sizeBytes" bigint,
    "checksumSha256" text,
    "storageBucket" text,
    "storagePath" text
  );

  insert into public.course_attachment (
    course_id,
    stored_file_id,
    created_at,
    updated_at
  )
  select
    p_target_course_id,
    asset."targetStoredFileId",
    clock_timestamp(),
    clock_timestamp()
  from jsonb_to_recordset(p_asset_manifest) as asset(
    "publicationAssetId" uuid,
    "targetStoredFileId" uuid
  );

  insert into public.lesson (
    id,
    course_id,
    position,
    title,
    summary,
    estimated_duration_minutes,
    settings,
    created_at,
    updated_at
  )
  select
    lesson_map.id,
    p_target_course_id,
    submitted.position,
    submitted.title,
    submitted.summary,
    submitted."estimatedDurationMinutes",
    '{}'::jsonb,
    clock_timestamp(),
    clock_timestamp()
  from jsonb_to_recordset(v_revision.snapshot -> 'lessons') as submitted(
    ref uuid,
    position integer,
    title text,
    summary text,
    "estimatedDurationMinutes" integer,
    components jsonb,
    slides jsonb
  )
  join jsonb_to_recordset(p_id_map -> 'lessons') as lesson_map(
    ref uuid,
    id uuid
  ) on lesson_map.ref = submitted.ref;

  insert into public.lesson_student_slide (
    id,
    lesson_id,
    position,
    created_at,
    updated_at
  )
  select
    slide_map.id,
    lesson_map.id,
    submitted_slide.position,
    clock_timestamp(),
    clock_timestamp()
  from jsonb_to_recordset(v_revision.snapshot -> 'lessons') as submitted_lesson(
    ref uuid,
    components jsonb,
    slides jsonb
  )
  join jsonb_to_recordset(p_id_map -> 'lessons') as lesson_map(
    ref uuid,
    id uuid
  ) on lesson_map.ref = submitted_lesson.ref
  cross join lateral jsonb_to_recordset(submitted_lesson.slides)
    as submitted_slide(ref uuid, position integer)
  join jsonb_to_recordset(p_id_map -> 'slides') as slide_map(
    ref uuid,
    id uuid
  ) on slide_map.ref = submitted_slide.ref;

  insert into public.lesson_component (
    id,
    lesson_id,
    position,
    type_key,
    schema_version,
    payload,
    placement_config,
    visibility,
    student_slide_id,
    primary_learning_objective_id,
    activity_role,
    created_at,
    updated_at
  )
  select
    component_map.id,
    lesson_map.id,
    submitted_component.position,
    submitted_component."typeKey",
    submitted_component."schemaVersion",
    public.remap_course_publication_component_assets(
      submitted_component."typeKey",
      submitted_component.payload,
      v_asset_id_map
    ),
    submitted_component.placement,
    submitted_component.visibility,
    case
      when submitted_component.visibility = 'learner_visible'
        then slide_map.id
      else null
    end,
    objective_map.id,
    submitted_component."activityRole",
    clock_timestamp(),
    clock_timestamp()
  from jsonb_to_recordset(v_revision.snapshot -> 'lessons') as submitted_lesson(
    ref uuid,
    components jsonb,
    slides jsonb
  )
  join jsonb_to_recordset(p_id_map -> 'lessons') as lesson_map(
    ref uuid,
    id uuid
  ) on lesson_map.ref = submitted_lesson.ref
  cross join lateral jsonb_to_recordset(submitted_lesson.components)
    as submitted_component(
      ref uuid,
      position integer,
      "typeKey" text,
      "schemaVersion" integer,
      payload jsonb,
      placement jsonb,
      visibility text,
      "studentSlideRef" uuid,
      "primaryObjectiveRef" uuid,
      "activityRole" text
    )
  join jsonb_to_recordset(p_id_map -> 'components') as component_map(
    ref uuid,
    id uuid
  ) on component_map.ref = submitted_component.ref
  left join jsonb_to_recordset(p_id_map -> 'slides') as slide_map(
    ref uuid,
    id uuid
  ) on slide_map.ref = submitted_component."studentSlideRef"
  left join jsonb_to_recordset(p_id_map -> 'objectives') as objective_map(
    ref uuid,
    id uuid
  ) on objective_map.ref = submitted_component."primaryObjectiveRef";

  update public.learning_objective as objective
  set archived_at = submitted."archivedAt"
  from jsonb_to_recordset(
    case
      when v_snapshot_version = 2
        then v_revision.snapshot -> 'objectives'
      else '[]'::jsonb
    end
  ) as submitted(ref uuid, "archivedAt" timestamptz)
  join jsonb_to_recordset(p_id_map -> 'objectives') as objective_map(
    ref uuid,
    id uuid
  ) on objective_map.ref = submitted.ref
  where objective.id = objective_map.id
    and submitted."archivedAt" is not null;

  insert into public.course_publication_origin (
    course_id,
    publication_id,
    revision_id,
    created_at
  )
  values (
    p_target_course_id,
    p_publication_id,
    v_revision.id,
    clock_timestamp()
  );

  return jsonb_build_object('courseId', p_target_course_id);
end
$$;


--

-- DUPLICATE_FUNCTION_V2
CREATE OR REPLACE FUNCTION public.duplicate_course_admin(p_actor_account_id uuid, p_source_course_id uuid, p_target_course_id uuid, p_target_title text, p_id_map jsonb) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
declare
  v_source_course public.course%rowtype;
  v_lesson_count integer;
  v_component_count integer;
  v_slide_count integer;
  v_objective_count integer;
  v_objective_created_at timestamptz;
begin
  if p_actor_account_id is null
    or p_source_course_id is null
    or p_target_course_id is null
    or (
      p_target_title is not null
      and (
        btrim(p_target_title) = ''
        or char_length(btrim(p_target_title)) > 160
      )
    )
    or p_id_map is null
    or jsonb_typeof(p_id_map) <> 'object'
  then
    raise exception 'course_duplicate_invalid'
      using errcode = '22023';
  end if;

  select course.*
  into v_source_course
  from public.course as course
  where course.id = p_source_course_id
    and course.owner_account_id = p_actor_account_id
  for update;

  if not found then
    raise exception 'course_duplicate_source_not_found'
      using errcode = 'P0002';
  end if;

  -- Match publication and all LA-M2 authoring mutations: the source Course is
  -- the parent serialization lock, followed by Account and descendants.
  perform 1
  from public.account as account
  where account.id = p_actor_account_id
    and account.status = 'active'
  for update;

  if not found then
    raise exception 'course_duplicate_actor_not_active'
      using errcode = '42501';
  end if;

  if exists (
    select 1
    from public.course as course
    where course.id = p_target_course_id
  ) then
    raise exception 'course_duplicate_target_id_conflict'
      using errcode = '23505';
  end if;

  perform 1
  from public.lesson as lesson
  where lesson.course_id = p_source_course_id
  order by lesson.id
  for update;

  perform 1
  from public.lesson_student_slide as slide
  join public.lesson as lesson on lesson.id = slide.lesson_id
  where lesson.course_id = p_source_course_id
  order by slide.id
  for update of slide;

  perform 1
  from public.lesson_component as component
  join public.lesson as lesson on lesson.id = component.lesson_id
  where lesson.course_id = p_source_course_id
  order by component.id
  for update of component;

  perform 1
  from public.learning_objective as objective
  where objective.course_id = p_source_course_id
  order by objective.created_at, objective.id
  for share of objective;

  perform 1
  from public.course_attachment as attachment
  where attachment.course_id = p_source_course_id
  order by attachment.id
  for update;

  if exists (
    select 1
    from public.course_attachment as attachment
    join public.stored_file as stored_file
      on stored_file.id = attachment.stored_file_id
    where attachment.course_id = p_source_course_id
      and stored_file.owner_account_id <> p_actor_account_id
  ) then
    raise exception 'course_duplicate_attachment_owner_mismatch'
      using errcode = '42501';
  end if;

  if not (p_id_map ? 'objectives') then
    p_id_map := p_id_map || jsonb_build_object('objectives', '[]'::jsonb);
  end if;

  if (p_id_map - array[
      'objectives', 'lessons', 'components', 'slides'
    ]) <> '{}'::jsonb
    or jsonb_typeof(p_id_map -> 'objectives') <> 'array'
    or jsonb_typeof(p_id_map -> 'lessons') <> 'array'
    or jsonb_typeof(p_id_map -> 'components') <> 'array'
    or jsonb_typeof(p_id_map -> 'slides') <> 'array'
  then
    raise exception 'course_duplicate_id_map_shape_invalid'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_id_map -> 'objectives') as item(value)
    where jsonb_typeof(item.value) <> 'object'
      or (item.value - array['ref', 'id']) <> '{}'::jsonb
      or not (item.value ? 'ref')
      or not (item.value ? 'id')
  ) or exists (
    select 1
    from jsonb_array_elements(p_id_map -> 'lessons') as item(value)
    where jsonb_typeof(item.value) <> 'object'
      or (item.value - array['ref', 'id']) <> '{}'::jsonb
      or not (item.value ? 'ref')
      or not (item.value ? 'id')
  ) or exists (
    select 1
    from jsonb_array_elements(p_id_map -> 'components') as item(value)
    where jsonb_typeof(item.value) <> 'object'
      or (item.value - array['ref', 'id']) <> '{}'::jsonb
      or not (item.value ? 'ref')
      or not (item.value ? 'id')
  ) or exists (
    select 1
    from jsonb_array_elements(p_id_map -> 'slides') as item(value)
    where jsonb_typeof(item.value) <> 'object'
      or (item.value - array['ref', 'id']) <> '{}'::jsonb
      or not (item.value ? 'ref')
      or not (item.value ? 'id')
  ) then
    raise exception 'course_duplicate_id_map_shape_invalid'
      using errcode = '22023';
  end if;

  select count(*)::integer
  into v_objective_count
  from public.learning_objective as objective
  where objective.course_id = p_source_course_id;

  select count(*)::integer
  into v_lesson_count
  from public.lesson as lesson
  where lesson.course_id = p_source_course_id;

  select count(*)::integer
  into v_component_count
  from public.lesson_component as component
  join public.lesson as lesson on lesson.id = component.lesson_id
  where lesson.course_id = p_source_course_id;

  select count(*)::integer
  into v_slide_count
  from public.lesson_student_slide as slide
  join public.lesson as lesson on lesson.id = slide.lesson_id
  where lesson.course_id = p_source_course_id;

  if jsonb_array_length(p_id_map -> 'objectives') <> v_objective_count
    or jsonb_array_length(p_id_map -> 'lessons') <> v_lesson_count
    or jsonb_array_length(p_id_map -> 'components') <> v_component_count
    or jsonb_array_length(p_id_map -> 'slides') <> v_slide_count
    or (
      select count(distinct (item.value ->> 'ref')::uuid)
      from jsonb_array_elements(p_id_map -> 'objectives') as item(value)
    ) <> v_objective_count
    or (
      select count(distinct (item.value ->> 'id')::uuid)
      from jsonb_array_elements(p_id_map -> 'objectives') as item(value)
    ) <> v_objective_count
    or (
      select count(distinct (item.value ->> 'ref')::uuid)
      from jsonb_array_elements(p_id_map -> 'lessons') as item(value)
    ) <> v_lesson_count
    or (
      select count(distinct (item.value ->> 'id')::uuid)
      from jsonb_array_elements(p_id_map -> 'lessons') as item(value)
    ) <> v_lesson_count
    or (
      select count(distinct (item.value ->> 'ref')::uuid)
      from jsonb_array_elements(p_id_map -> 'components') as item(value)
    ) <> v_component_count
    or (
      select count(distinct (item.value ->> 'id')::uuid)
      from jsonb_array_elements(p_id_map -> 'components') as item(value)
    ) <> v_component_count
    or (
      select count(distinct (item.value ->> 'ref')::uuid)
      from jsonb_array_elements(p_id_map -> 'slides') as item(value)
    ) <> v_slide_count
    or (
      select count(distinct (item.value ->> 'id')::uuid)
      from jsonb_array_elements(p_id_map -> 'slides') as item(value)
    ) <> v_slide_count
  then
    raise exception 'course_duplicate_id_map_not_exact'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.learning_objective as source_objective
    where source_objective.course_id = p_source_course_id
      and not exists (
        select 1
        from jsonb_array_elements(p_id_map -> 'objectives') as item(value)
        where (item.value ->> 'ref')::uuid = source_objective.id
      )
  ) or exists (
    select 1
    from public.lesson as source_lesson
    where source_lesson.course_id = p_source_course_id
      and not exists (
        select 1
        from jsonb_array_elements(p_id_map -> 'lessons') as item(value)
        where (item.value ->> 'ref')::uuid = source_lesson.id
      )
  ) or exists (
    select 1
    from public.lesson_component as source_component
    join public.lesson as source_lesson
      on source_lesson.id = source_component.lesson_id
    where source_lesson.course_id = p_source_course_id
      and not exists (
        select 1
        from jsonb_array_elements(p_id_map -> 'components') as item(value)
        where (item.value ->> 'ref')::uuid = source_component.id
      )
  ) or exists (
    select 1
    from public.lesson_student_slide as source_slide
    join public.lesson as source_lesson
      on source_lesson.id = source_slide.lesson_id
    where source_lesson.course_id = p_source_course_id
      and not exists (
        select 1
        from jsonb_array_elements(p_id_map -> 'slides') as item(value)
        where (item.value ->> 'ref')::uuid = source_slide.id
      )
  ) then
    raise exception 'course_duplicate_id_map_not_exact'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_id_map -> 'objectives') as item(value)
    join public.learning_objective as objective
      on objective.id = (item.value ->> 'id')::uuid
  ) or exists (
    select 1
    from jsonb_array_elements(p_id_map -> 'lessons') as item(value)
    join public.lesson as lesson
      on lesson.id = (item.value ->> 'id')::uuid
  ) or exists (
    select 1
    from jsonb_array_elements(p_id_map -> 'components') as item(value)
    join public.lesson_component as component
      on component.id = (item.value ->> 'id')::uuid
  ) or exists (
    select 1
    from jsonb_array_elements(p_id_map -> 'slides') as item(value)
    join public.lesson_student_slide as slide
      on slide.id = (item.value ->> 'id')::uuid
  ) then
    raise exception 'course_duplicate_target_id_conflict'
      using errcode = '23505';
  end if;

  insert into public.course (
    id,
    owner_account_id,
    title,
    subject,
    goal,
    level,
    audience_description,
    target_lesson_count,
    teacher_preferences,
    audience_type,
    settings,
    assembled_at,
    archived_at,
    created_at,
    updated_at
  )
  values (
    p_target_course_id,
    p_actor_account_id,
    coalesce(
      btrim(p_target_title),
      concat(left(v_source_course.title, 150), ' — копия')
    ),
    v_source_course.subject,
    v_source_course.goal,
    v_source_course.level,
    v_source_course.audience_description,
    v_source_course.target_lesson_count,
    v_source_course.teacher_preferences,
    'none',
    v_source_course.settings,
    v_source_course.assembled_at,
    null,
    clock_timestamp(),
    clock_timestamp()
  );

  v_objective_created_at := clock_timestamp();

  insert into public.learning_objective (
    id,
    course_id,
    title,
    description,
    archived_at,
    created_at,
    updated_at
  )
  select
    objective_map.id,
    p_target_course_id,
    source_objective.title,
    source_objective.description,
    null,
    v_objective_created_at
      + interval '1 microsecond' * (source_objective.copy_position - 1),
    v_objective_created_at
      + interval '1 microsecond' * (source_objective.copy_position - 1)
  from (
    select
      objective.*,
      row_number() over (
        order by objective.created_at, objective.id
      )::integer as copy_position
    from public.learning_objective as objective
    where objective.course_id = p_source_course_id
  ) as source_objective
  join jsonb_to_recordset(p_id_map -> 'objectives') as objective_map(
    ref uuid,
    id uuid
  ) on objective_map.ref = source_objective.id
  order by source_objective.copy_position;

  insert into public.course_attachment (
    course_id,
    stored_file_id,
    created_at,
    updated_at
  )
  select
    p_target_course_id,
    source_attachment.stored_file_id,
    clock_timestamp(),
    clock_timestamp()
  from public.course_attachment as source_attachment
  where source_attachment.course_id = p_source_course_id;

  insert into public.lesson (
    id,
    course_id,
    position,
    title,
    summary,
    estimated_duration_minutes,
    settings,
    created_at,
    updated_at
  )
  select
    lesson_map.id,
    p_target_course_id,
    source_lesson.position,
    source_lesson.title,
    source_lesson.summary,
    source_lesson.estimated_duration_minutes,
    source_lesson.settings,
    clock_timestamp(),
    clock_timestamp()
  from public.lesson as source_lesson
  join jsonb_to_recordset(p_id_map -> 'lessons') as lesson_map(
    ref uuid,
    id uuid
  ) on lesson_map.ref = source_lesson.id
  where source_lesson.course_id = p_source_course_id;

  insert into public.lesson_student_slide (
    id,
    lesson_id,
    position,
    created_at,
    updated_at
  )
  select
    slide_map.id,
    lesson_map.id,
    source_slide.position,
    clock_timestamp(),
    clock_timestamp()
  from public.lesson_student_slide as source_slide
  join public.lesson as source_lesson
    on source_lesson.id = source_slide.lesson_id
  join jsonb_to_recordset(p_id_map -> 'lessons') as lesson_map(
    ref uuid,
    id uuid
  ) on lesson_map.ref = source_lesson.id
  join jsonb_to_recordset(p_id_map -> 'slides') as slide_map(
    ref uuid,
    id uuid
  ) on slide_map.ref = source_slide.id
  where source_lesson.course_id = p_source_course_id;

  insert into public.lesson_component (
    id,
    lesson_id,
    position,
    type_key,
    schema_version,
    payload,
    placement_config,
    visibility,
    student_slide_id,
    primary_learning_objective_id,
    activity_role,
    created_at,
    updated_at
  )
  select
    component_map.id,
    lesson_map.id,
    source_component.position,
    source_component.type_key,
    source_component.schema_version,
    source_component.payload,
    source_component.placement_config,
    source_component.visibility,
    slide_map.id,
    objective_map.id,
    source_component.activity_role,
    clock_timestamp(),
    clock_timestamp()
  from public.lesson_component as source_component
  join public.lesson as source_lesson
    on source_lesson.id = source_component.lesson_id
  join jsonb_to_recordset(p_id_map -> 'lessons') as lesson_map(
    ref uuid,
    id uuid
  ) on lesson_map.ref = source_lesson.id
  join jsonb_to_recordset(p_id_map -> 'components') as component_map(
    ref uuid,
    id uuid
  ) on component_map.ref = source_component.id
  left join jsonb_to_recordset(p_id_map -> 'slides') as slide_map(
    ref uuid,
    id uuid
  ) on slide_map.ref = source_component.student_slide_id
  left join jsonb_to_recordset(p_id_map -> 'objectives') as objective_map(
    ref uuid,
    id uuid
  ) on objective_map.ref = source_component.primary_learning_objective_id
  where source_lesson.course_id = p_source_course_id;

  update public.learning_objective as objective
  set archived_at = source_objective.archived_at
  from public.learning_objective as source_objective
  join jsonb_to_recordset(p_id_map -> 'objectives') as objective_map(
    ref uuid,
    id uuid
  ) on objective_map.ref = source_objective.id
  where source_objective.course_id = p_source_course_id
    and source_objective.archived_at is not null
    and objective.id = objective_map.id;

  return jsonb_build_object('courseId', p_target_course_id);
end
$$;


--

-- POSTFLIGHT_V2
revoke all on function public.publish_course_revision_admin(
  uuid, uuid, uuid, uuid, text, jsonb, jsonb, boolean
) from public, anon, authenticated, service_role;
revoke all on function public.clone_course_publication_admin(
  uuid, uuid, uuid, text, jsonb, jsonb
) from public, anon, authenticated, service_role;
revoke all on function public.duplicate_course_admin(
  uuid, uuid, uuid, text, jsonb
) from public, anon, authenticated, service_role;

grant execute on function public.publish_course_revision_admin(
  uuid, uuid, uuid, uuid, text, jsonb, jsonb, boolean
) to postgres;
grant execute on function public.clone_course_publication_admin(
  uuid, uuid, uuid, text, jsonb, jsonb
) to postgres;
grant execute on function public.duplicate_course_admin(
  uuid, uuid, uuid, text, jsonb
) to postgres;

do $postflight$
declare
  v_publish oid := to_regprocedure(
    'public.publish_course_revision_admin(uuid,uuid,uuid,uuid,text,jsonb,jsonb,boolean)'
  );
  v_clone oid := to_regprocedure(
    'public.clone_course_publication_admin(uuid,uuid,uuid,text,jsonb,jsonb)'
  );
  v_duplicate oid := to_regprocedure(
    'public.duplicate_course_admin(uuid,uuid,uuid,text,jsonb)'
  );
begin
  if exists (
    select 1
    from course_publication_v2_revision_baseline as baseline
    full join public.course_publication_revision as revision
      on revision.id = baseline.id
    where baseline.id is null
      or revision.id is null
      or baseline.snapshot_md5 is distinct from md5(revision.snapshot::text)
  ) then
    raise exception 'course_publication_v2_immutable_revision_changed';
  end if;

  if not exists (
    select 1
    from pg_constraint as constraint_row
    where constraint_row.conrelid =
        'public.course_publication_revision'::regclass
      and constraint_row.conname =
        'course_publication_revision_snapshot_check'
      and pg_get_constraintdef(constraint_row.oid) like '%schemaVersion%1%2%'
  ) then
    raise exception 'course_publication_v2_constraint_failed';
  end if;

  if v_publish is null
    or position(
      'course_publication_objective_snapshot_mismatch'
      in pg_get_functiondef(v_publish)
    ) = 0
    or position(
      'for share of objective'
      in lower(pg_get_functiondef(v_publish))
    ) = 0
    or position(
      'primaryobjectiveref'
      in lower(pg_get_functiondef(v_publish))
    ) = 0
    or v_clone is null
    or position(
      'insert into public.learning_objective'
      in lower(pg_get_functiondef(v_clone))
    ) = 0
    or position(
      'primary_learning_objective_id'
      in lower(pg_get_functiondef(v_clone))
    ) = 0
    or v_duplicate is null
    or position(
      'insert into public.learning_objective'
      in lower(pg_get_functiondef(v_duplicate))
    ) = 0
    or position(
      'primary_learning_objective_id'
      in lower(pg_get_functiondef(v_duplicate))
    ) = 0
    or position(
      'if not (p_id_map ? ''objectives'')'
      in lower(pg_get_functiondef(v_clone))
    ) = 0
    or position(
      'if not (p_id_map ? ''objectives'')'
      in lower(pg_get_functiondef(v_duplicate))
    ) = 0
    or position(
      'interval ''1 microsecond'' * (submitted.position - 1)'
      in lower(pg_get_functiondef(v_clone))
    ) = 0
    or position(
      'order by submitted.position'
      in lower(pg_get_functiondef(v_clone))
    ) = 0
    or position(
      'row_number() over'
      in lower(pg_get_functiondef(v_duplicate))
    ) = 0
    or position(
      'order by objective.created_at, objective.id'
      in lower(pg_get_functiondef(v_duplicate))
    ) = 0
    or position(
      'interval ''1 microsecond'' * (source_objective.copy_position - 1)'
      in lower(pg_get_functiondef(v_duplicate))
    ) = 0
  then
    raise exception 'course_publication_v2_rpc_contract_failed';
  end if;

  if not exists (
      select 1
      from pg_proc as procedure
      where procedure.oid = v_publish
        and not procedure.prosecdef
        and procedure.proconfig @> array['search_path=""']::text[]
    )
    or not exists (
      select 1
      from pg_proc as procedure
      where procedure.oid = v_clone
        and not procedure.prosecdef
        and procedure.proconfig @> array['search_path=""']::text[]
    )
    or not exists (
      select 1
      from pg_proc as procedure
      where procedure.oid = v_duplicate
        and not procedure.prosecdef
        and procedure.proconfig @> array['search_path=""']::text[]
    )
  then
    raise exception 'course_publication_v2_rpc_security_failed'
      using errcode = '42501';
  end if;

  if not has_function_privilege('postgres', v_publish, 'EXECUTE')
    or has_function_privilege('authenticated', v_publish, 'EXECUTE')
    or has_function_privilege('service_role', v_publish, 'EXECUTE')
    or not has_function_privilege('postgres', v_clone, 'EXECUTE')
    or has_function_privilege('authenticated', v_clone, 'EXECUTE')
    or has_function_privilege('service_role', v_clone, 'EXECUTE')
    or not has_function_privilege('postgres', v_duplicate, 'EXECUTE')
    or has_function_privilege('authenticated', v_duplicate, 'EXECUTE')
    or has_function_privilege('service_role', v_duplicate, 'EXECUTE')
  then
    raise exception 'course_publication_v2_rpc_acl_failed'
      using errcode = '42501';
  end if;
end
$postflight$;

notify pgrst, 'reload schema';

commit;
