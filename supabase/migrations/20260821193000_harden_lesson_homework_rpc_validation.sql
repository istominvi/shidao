begin;

-- P1.3 follow-up hardening discovered by the final direct-RPC audit. The
-- initial migration deliberately closed raw tables, but its authenticated
-- replace RPC still accepted arbitrary object-shaped registry payloads. Keep
-- the same three-function/two-table surface and make the exposed mutation
-- boundary enforce the four canonical V1 shapes plus Course attachment scope.
do $preflight$
declare
  v_table_count integer;
  v_function_count integer;
begin
  if current_database() not in ('postgres', 'shidao_homework_authoring_test')
    or current_user <> 'supabase_admin'
    or current_setting('server_version') <> '15.8'
  then
    raise exception 'lesson_homework_hardening_target_mismatch'
      using errcode = '55000';
  end if;

  select count(*)::integer into v_table_count
  from pg_class as relation
  join pg_namespace as namespace on namespace.oid = relation.relnamespace
  where namespace.nspname = 'public'
    and relation.relkind in ('r', 'p');

  select count(*)::integer into v_function_count
  from pg_proc as procedure
  join pg_namespace as namespace on namespace.oid = procedure.pronamespace
  where namespace.nspname = 'public';

  if v_table_count <> 76 or v_function_count <> 278
    or to_regclass('public.lesson_homework') is null
    or to_regclass('public.lesson_homework_item') is null
    or to_regprocedure(
      'public.replace_my_lesson_homework(uuid,integer,jsonb)'
    ) is null
    or to_regclass('public.methodology_lesson_homework') is not null
    or to_regclass('public.scheduled_lesson_homework_assignment') is not null
    or to_regclass('public.student_homework_assignment') is not null
  then
    raise exception 'lesson_homework_hardening_head_mismatch:%/%',
      v_table_count,
      v_function_count
      using errcode = '55000';
  end if;
end
$preflight$;

create or replace function public.replace_my_lesson_homework(
  p_lesson_id uuid,
  p_expected_revision integer,
  p_items jsonb
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_actor_user_id uuid := (select auth.uid());
  v_actor_account_id uuid := (
    select public.current_active_session_account_id()
  );
  v_course_id uuid;
  v_homework public.lesson_homework%rowtype;
  v_homework_exists boolean := false;
  v_item_count integer;
  v_now timestamptz := statement_timestamp();
begin
  if p_lesson_id is null
    or v_actor_user_id is null
    or v_actor_account_id is null
    or p_items is null
    or jsonb_typeof(p_items) <> 'array'
  then
    raise exception 'lesson_homework_input_invalid' using errcode = '22023';
  end if;

  v_item_count := jsonb_array_length(p_items);
  if v_item_count > 50
    or octet_length(p_items::text) > 524288
    or p_expected_revision is not null
      and p_expected_revision <= 0
  then
    raise exception 'lesson_homework_input_invalid' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_items) as entry(value)
    where jsonb_typeof(entry.value) <> 'object'
      or not entry.value ?& array[
        'id',
        'typeKey',
        'schemaVersion',
        'payload',
        'placement'
      ]
      or exists (
        select 1
        from jsonb_object_keys(entry.value) as item_key(value)
        where item_key.value not in (
          'id',
          'typeKey',
          'schemaVersion',
          'payload',
          'placement'
        )
      )
      or jsonb_typeof(entry.value -> 'id') <> 'string'
      or not ((entry.value ->> 'id') ~* (
        '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-'
        || '[0-9a-f]{4}-[0-9a-f]{12}$'
      ))
      or jsonb_typeof(entry.value -> 'typeKey') <> 'string'
      or entry.value ->> 'typeKey' not in (
        'rich_text',
        'image',
        'external_link',
        'file'
      )
      or jsonb_typeof(entry.value -> 'schemaVersion') <> 'number'
      or entry.value ->> 'schemaVersion' <> '1'
      or jsonb_typeof(entry.value -> 'payload') <> 'object'
      or jsonb_typeof(entry.value -> 'placement') <> 'object'
  )
  then
    raise exception 'lesson_homework_item_invalid' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_items) as entry(value)
    where case entry.value ->> 'typeKey'
      when 'rich_text' then not (
        entry.value -> 'payload' ? 'format'
        and entry.value -> 'payload' ->> 'format' = 'markdown'
        and not exists (
          select 1
          from jsonb_object_keys(entry.value -> 'payload') as key(value)
          where key.value not in ('title', 'content', 'format')
        )
        and (
          entry.value -> 'payload' ? 'title'
          or entry.value -> 'payload' ? 'content'
        )
        and (
          not entry.value -> 'payload' ? 'title'
          or (
            jsonb_typeof(entry.value -> 'payload' -> 'title') = 'string'
            and entry.value -> 'payload' ->> 'title'
              = btrim(entry.value -> 'payload' ->> 'title')
            and char_length(entry.value -> 'payload' ->> 'title')
              between 1 and 240
          )
        )
        and (
          not entry.value -> 'payload' ? 'content'
          or (
            jsonb_typeof(entry.value -> 'payload' -> 'content') = 'string'
            and entry.value -> 'payload' ->> 'content'
              = btrim(entry.value -> 'payload' ->> 'content')
            and char_length(entry.value -> 'payload' ->> 'content')
              between 1 and 20000
          )
        )
        and entry.value -> 'placement' ?& array['width', 'textAlign']
        and not exists (
          select 1
          from jsonb_object_keys(entry.value -> 'placement') as key(value)
          where key.value not in ('width', 'textAlign')
        )
        and entry.value -> 'placement' ->> 'width'
          in ('content', 'wide', 'full')
        and entry.value -> 'placement' ->> 'textAlign'
          in ('start', 'center', 'end')
      )
      when 'image' then not (
        entry.value -> 'payload' ?& array['storedFileId', 'alt']
        and not exists (
          select 1
          from jsonb_object_keys(entry.value -> 'payload') as key(value)
          where key.value not in ('storedFileId', 'alt', 'caption')
        )
        and (
          jsonb_typeof(entry.value -> 'payload' -> 'storedFileId') = 'null'
          or (
            jsonb_typeof(entry.value -> 'payload' -> 'storedFileId')
              = 'string'
            and entry.value -> 'payload' ->> 'storedFileId' ~* (
              '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-'
              || '[0-9a-f]{4}-[0-9a-f]{12}$'
            )
          )
        )
        and jsonb_typeof(entry.value -> 'payload' -> 'alt') = 'string'
        and entry.value -> 'payload' ->> 'alt'
          = btrim(entry.value -> 'payload' ->> 'alt')
        and char_length(entry.value -> 'payload' ->> 'alt') <= 500
        and (
          not entry.value -> 'payload' ? 'caption'
          or (
            jsonb_typeof(entry.value -> 'payload' -> 'caption') = 'string'
            and entry.value -> 'payload' ->> 'caption'
              = btrim(entry.value -> 'payload' ->> 'caption')
            and char_length(entry.value -> 'payload' ->> 'caption')
              between 1 and 1000
          )
        )
        and entry.value -> 'placement' ?& array[
          'width', 'align', 'fit', 'aspectRatio'
        ]
        and not exists (
          select 1
          from jsonb_object_keys(entry.value -> 'placement') as key(value)
          where key.value not in ('width', 'align', 'fit', 'aspectRatio')
        )
        and entry.value -> 'placement' ->> 'width'
          in ('content', 'wide', 'full')
        and entry.value -> 'placement' ->> 'align'
          in ('start', 'center', 'end', 'stretch')
        and entry.value -> 'placement' ->> 'fit'
          in ('contain', 'cover')
        and entry.value -> 'placement' ->> 'aspectRatio'
          in ('auto', 'square', '4:3', '16:9')
      )
      when 'external_link' then not (
        entry.value -> 'payload' ?& array[
          'url', 'label', 'openInNewTab'
        ]
        and not exists (
          select 1
          from jsonb_object_keys(entry.value -> 'payload') as key(value)
          where key.value not in (
            'url', 'label', 'description', 'openInNewTab'
          )
        )
        and jsonb_typeof(entry.value -> 'payload' -> 'url') = 'string'
        and entry.value -> 'payload' ->> 'url'
          = btrim(entry.value -> 'payload' ->> 'url')
        and entry.value -> 'payload' ->> 'url'
          ~ '^https://[^[:space:]]+$'
        and jsonb_typeof(entry.value -> 'payload' -> 'label') = 'string'
        and entry.value -> 'payload' ->> 'label'
          = btrim(entry.value -> 'payload' ->> 'label')
        and char_length(entry.value -> 'payload' ->> 'label')
          between 1 and 240
        and (
          not entry.value -> 'payload' ? 'description'
          or (
            jsonb_typeof(entry.value -> 'payload' -> 'description') = 'string'
            and entry.value -> 'payload' ->> 'description'
              = btrim(entry.value -> 'payload' ->> 'description')
            and char_length(entry.value -> 'payload' ->> 'description')
              between 1 and 2000
          )
        )
        and jsonb_typeof(entry.value -> 'payload' -> 'openInNewTab')
          = 'boolean'
        and entry.value -> 'placement' ?& array['width', 'align', 'style']
        and not exists (
          select 1
          from jsonb_object_keys(entry.value -> 'placement') as key(value)
          where key.value not in ('width', 'align', 'style')
        )
        and entry.value -> 'placement' ->> 'width'
          in ('content', 'wide', 'full')
        and entry.value -> 'placement' ->> 'align'
          in ('start', 'center', 'end', 'stretch')
        and entry.value -> 'placement' ->> 'style'
          in ('card', 'button', 'text')
      )
      when 'file' then not (
        entry.value -> 'payload' ?& array[
          'storedFileId', 'label', 'openMode'
        ]
        and not exists (
          select 1
          from jsonb_object_keys(entry.value -> 'payload') as key(value)
          where key.value not in (
            'storedFileId', 'label', 'description', 'openMode'
          )
        )
        and (
          jsonb_typeof(entry.value -> 'payload' -> 'storedFileId') = 'null'
          or (
            jsonb_typeof(entry.value -> 'payload' -> 'storedFileId')
              = 'string'
            and entry.value -> 'payload' ->> 'storedFileId' ~* (
              '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-'
              || '[0-9a-f]{4}-[0-9a-f]{12}$'
            )
          )
        )
        and jsonb_typeof(entry.value -> 'payload' -> 'label') = 'string'
        and entry.value -> 'payload' ->> 'label'
          = btrim(entry.value -> 'payload' ->> 'label')
        and char_length(entry.value -> 'payload' ->> 'label')
          between 1 and 240
        and (
          not entry.value -> 'payload' ? 'description'
          or (
            jsonb_typeof(entry.value -> 'payload' -> 'description') = 'string'
            and entry.value -> 'payload' ->> 'description'
              = btrim(entry.value -> 'payload' ->> 'description')
            and char_length(entry.value -> 'payload' ->> 'description')
              between 1 and 2000
          )
        )
        and entry.value -> 'payload' ->> 'openMode'
          in ('download', 'preview')
        and entry.value -> 'placement' ?& array['width', 'display']
        and not exists (
          select 1
          from jsonb_object_keys(entry.value -> 'placement') as key(value)
          where key.value not in ('width', 'display')
        )
        and entry.value -> 'placement' ->> 'width'
          in ('content', 'wide', 'full')
        and entry.value -> 'placement' ->> 'display'
          in ('card', 'link')
      )
      else true
    end
  )
  then
    raise exception 'lesson_homework_item_invalid' using errcode = '22023';
  end if;

  if (
    select count(*)
    from (
      select distinct (entry.value ->> 'id')::uuid
      from jsonb_array_elements(p_items) as entry(value)
    ) as unique_item
  ) <> v_item_count
  then
    raise exception 'lesson_homework_item_id_duplicate'
      using errcode = '22023';
  end if;

  if not public.lock_current_account_session_authority(
    v_actor_account_id
  ) then
    raise exception 'lesson_homework_not_found' using errcode = 'P0002';
  end if;

  select lesson.course_id
  into v_course_id
  from public.lesson as lesson
  where lesson.id = p_lesson_id;

  if v_course_id is null then
    raise exception 'lesson_homework_not_found' using errcode = 'P0002';
  end if;

  perform 1
  from public.course as course
  join public.account as account on account.id = course.owner_account_id
  where course.id = v_course_id
    and course.owner_account_id = v_actor_account_id
    and account.auth_user_id = v_actor_user_id
    and course.archived_at is null
    and (
      course.learning_audience = 'children'
      or (
        course.learning_audience = 'educators'
        and account.can_author_educator_courses
      )
    )
  for update of course;
  if not found then
    raise exception 'lesson_homework_not_found' using errcode = 'P0002';
  end if;

  perform 1
  from public.lesson as lesson
  where lesson.id = p_lesson_id
    and lesson.course_id = v_course_id
  for update of lesson;
  if not found then
    raise exception 'lesson_homework_not_found' using errcode = 'P0002';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_items) as entry(value)
    where entry.value ->> 'typeKey' in ('image', 'file')
      and jsonb_typeof(
        entry.value -> 'payload' -> 'storedFileId'
      ) = 'string'
      and not exists (
        select 1
        from public.course_attachment as attachment
        join public.stored_file as stored_file
          on stored_file.id = attachment.stored_file_id
        where attachment.course_id = v_course_id
          and stored_file.id = (
            entry.value -> 'payload' ->> 'storedFileId'
          )::uuid
          and stored_file.owner_account_id = v_actor_account_id
          and stored_file.status = 'ready'
          and (
            entry.value ->> 'typeKey' <> 'image'
            or stored_file.mime_type like 'image/%'
          )
      )
  )
  then
    raise exception 'lesson_homework_item_invalid' using errcode = '22023';
  end if;

  select homework.*
  into v_homework
  from public.lesson_homework as homework
  where homework.lesson_id = p_lesson_id
  for update of homework;
  v_homework_exists := found;

  if v_homework_exists then
    perform item.id
    from public.lesson_homework_item as item
    where item.lesson_homework_id = v_homework.id
    order by item.id
    for update of item;
  end if;

  if not v_homework_exists then
    if p_expected_revision is not null then
      raise exception 'lesson_homework_revision_conflict'
        using errcode = '40001';
    end if;
    if v_item_count = 0 then
      return jsonb_build_object(
        'courseId', v_course_id,
        'lessonId', p_lesson_id,
        'homework', null
      );
    end if;

    insert into public.lesson_homework (
      lesson_id,
      revision,
      created_at,
      updated_at
    )
    values (p_lesson_id, 1, v_now, v_now)
    returning * into v_homework;
  else
    if p_expected_revision is null
      or p_expected_revision <> v_homework.revision
    then
      raise exception 'lesson_homework_revision_conflict'
        using errcode = '40001';
    end if;

    if v_item_count = 0 then
      update public.lesson_homework as homework
      set revision = homework.revision + 1,
          updated_at = v_now
      where homework.id = v_homework.id
      returning * into v_homework;

      delete from public.lesson_homework_item as item
      where item.lesson_homework_id = v_homework.id;

      return jsonb_build_object(
        'courseId', v_course_id,
        'lessonId', p_lesson_id,
        'homework', public.build_lesson_homework_projection(v_homework.id)
      );
    end if;

    update public.lesson_homework as homework
    set revision = homework.revision + 1,
        updated_at = v_now
    where homework.id = v_homework.id
    returning * into v_homework;

    delete from public.lesson_homework_item as item
    where item.lesson_homework_id = v_homework.id;
  end if;

  insert into public.lesson_homework_item (
    id,
    lesson_homework_id,
    position,
    type_key,
    schema_version,
    payload,
    placement_config
  )
  select
    (entry.value ->> 'id')::uuid,
    v_homework.id,
    entry.position::integer,
    entry.value ->> 'typeKey',
    (entry.value ->> 'schemaVersion')::integer,
    entry.value -> 'payload',
    entry.value -> 'placement'
  from jsonb_array_elements(p_items)
    with ordinality as entry(value, position)
  order by entry.position;

  return jsonb_build_object(
    'courseId', v_course_id,
    'lessonId', p_lesson_id,
    'homework', public.build_lesson_homework_projection(v_homework.id)
  );
end
$function$;

revoke all on function public.replace_my_lesson_homework(
  uuid,
  integer,
  jsonb
)
  from public, anon, authenticated, service_role;
grant execute on function public.replace_my_lesson_homework(
  uuid,
  integer,
  jsonb
)
  to authenticated, postgres;

comment on function public.replace_my_lesson_homework(uuid, integer, jsonb) is
  'P1.3 authenticated owner CAS replace/clear with strict registry payload and Course attachment validation.';

do $postflight$
declare
  v_definition text := pg_get_functiondef(
    'public.replace_my_lesson_homework(uuid,integer,jsonb)'::regprocedure
  );
begin
  if (
    select count(*)
    from pg_class as relation
    join pg_namespace as namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relkind in ('r', 'p')
  ) <> 76
    or (
      select count(*)
      from pg_proc as procedure
      join pg_namespace as namespace
        on namespace.oid = procedure.pronamespace
      where namespace.nspname = 'public'
    ) <> 278
  then
    raise exception 'lesson_homework_hardening_inventory_mismatch'
      using errcode = '55000';
  end if;

  if position('public.course_attachment as attachment' in v_definition) = 0
    or position('public.stored_file as stored_file' in v_definition) = 0
    or position('stored_file.status = ''ready''' in v_definition) = 0
    or position('stored_file.mime_type like ''image/%''' in v_definition) = 0
    or position('''rich_text'' then not' in v_definition) = 0
    or position('''external_link'' then not' in v_definition) = 0
  then
    raise exception 'lesson_homework_hardening_definition_incomplete'
      using errcode = '55000';
  end if;

  if not exists (
    select 1
    from pg_proc as procedure
    where procedure.oid = to_regprocedure(
      'public.replace_my_lesson_homework(uuid,integer,jsonb)'
    )
      and pg_get_userbyid(procedure.proowner) = 'supabase_admin'
      and procedure.prosecdef
      and procedure.provolatile = 'v'
      and procedure.proconfig = array['search_path=""']::text[]
  )
    or not has_function_privilege(
      'authenticated',
      'public.replace_my_lesson_homework(uuid,integer,jsonb)',
      'EXECUTE'
    )
    or has_function_privilege(
      'anon',
      'public.replace_my_lesson_homework(uuid,integer,jsonb)',
      'EXECUTE'
    )
    or has_function_privilege(
      'service_role',
      'public.replace_my_lesson_homework(uuid,integer,jsonb)',
      'EXECUTE'
    )
  then
    raise exception 'lesson_homework_hardening_rpc_contract_invalid'
      using errcode = '55000';
  end if;

  if (select count(*) from public.lesson_homework) <> 0
    or (select count(*) from public.lesson_homework_item) <> 0
  then
    raise exception 'lesson_homework_hardening_created_product_data'
      using errcode = '55000';
  end if;
end
$postflight$;

commit;
