begin;

-- P1.3: one mutable common Homework draft per Lesson. Homework authoring is a
-- separate Lesson surface; it does not reuse lesson_component rows and does
-- not create learner assignment, issuance, attempt, evidence, or LessonRun
-- state. Raw relations stay closed. Authenticated callers use the two narrow
-- owner-scoped RPCs at the end of this migration.

do $preflight$
declare
  v_table_count integer;
  v_function_count integer;
begin
  if current_database() not in (
      'postgres',
      'shidao_homework_authoring_test'
    )
    or current_user <> 'supabase_admin'
    or current_setting('server_version_num')::integer not between 150000 and 159999
    or to_regclass('public.account') is null
    or to_regclass('public.course') is null
    or to_regclass('public.lesson') is null
    or to_regclass('public.lesson_component') is null
    or to_regclass('public.choice_quiz_issue') is null
    or to_regclass('public.choice_quiz_attempt') is null
    or to_regclass('public.choice_quiz_response') is null
    or to_regclass('public.choice_quiz_evaluation') is null
    or to_regclass('public.choice_quiz_feedback_delivery') is null
    or to_regclass('public.methodology_lesson_homework') is not null
    or to_regclass('public.scheduled_lesson_homework_assignment') is not null
    or to_regclass('public.student_homework_assignment') is not null
    or to_regprocedure(
      'public.current_active_session_account_id()'
    ) is null
    or to_regprocedure(
      'public.lock_current_account_session_authority(uuid)'
    ) is null
    or to_regprocedure('public.delete_lesson_with_history(uuid)') is null
    or not exists (
      select 1
      from information_schema.columns as column_definition
      where column_definition.table_schema = 'public'
        and column_definition.table_name = 'learning_evidence'
        and column_definition.column_name =
          'source_choice_quiz_evaluation_id'
    )
  then
    raise exception 'shidao_homework_schema_sanity_check_failed'
      using errcode = '55000';
  end if;

  if to_regclass('public.lesson_homework') is not null
    or to_regclass('public.lesson_homework_item') is not null
    or to_regprocedure('public.get_my_lesson_homework(uuid)') is not null
    or to_regprocedure(
      'public.replace_my_lesson_homework(uuid,integer,jsonb)'
    ) is not null
  then
    raise exception 'lesson_homework_contract_already_exists'
      using errcode = '55000';
  end if;

  select count(*)::integer
  into v_table_count
  from pg_class as relation
  join pg_namespace as namespace on namespace.oid = relation.relnamespace
  where namespace.nspname = 'public'
    and relation.relkind in ('r', 'p');

  select count(*)::integer
  into v_function_count
  from pg_proc as procedure
  join pg_namespace as namespace on namespace.oid = procedure.pronamespace
  where namespace.nspname = 'public';

  if v_table_count <> 74 or v_function_count <> 275 then
    raise exception
      'lesson_homework_unexpected_la_m5_inventory:%/%',
      v_table_count,
      v_function_count
      using errcode = '55000';
  end if;
end
$preflight$;

create table public.lesson_homework (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null
    references public.lesson(id) on delete cascade,
  revision integer not null default 1,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint lesson_homework_lesson_unique unique (lesson_id),
  constraint lesson_homework_revision_positive check (revision > 0),
  constraint lesson_homework_updated_after_created check (
    updated_at >= created_at
  )
);

create table public.lesson_homework_item (
  id uuid primary key,
  lesson_homework_id uuid not null
    references public.lesson_homework(id) on delete cascade,
  position integer not null,
  type_key text not null,
  schema_version integer not null,
  payload jsonb not null,
  placement_config jsonb not null,
  constraint lesson_homework_item_position_positive check (position > 0),
  constraint lesson_homework_item_type_allowlist check (
    type_key in ('rich_text', 'image', 'external_link', 'file')
  ),
  constraint lesson_homework_item_schema_version_v1 check (
    schema_version = 1
  ),
  constraint lesson_homework_item_payload_object check (
    jsonb_typeof(payload) = 'object'
  ),
  constraint lesson_homework_item_placement_object check (
    jsonb_typeof(placement_config) = 'object'
  ),
  constraint lesson_homework_item_position_unique
    unique (lesson_homework_id, position)
    deferrable initially deferred
);

create index lesson_homework_item_homework_id_id_idx
on public.lesson_homework_item (lesson_homework_id, id);

alter table public.lesson_homework enable row level security;
alter table public.lesson_homework_item enable row level security;

revoke all on table public.lesson_homework
  from public, anon, authenticated, service_role;
revoke all on table public.lesson_homework_item
  from public, anon, authenticated, service_role;

comment on table public.lesson_homework is
  'P1.3 mutable common teacher-authored Homework draft; at most one per Lesson.';
comment on table public.lesson_homework_item is
  'P1.3 ordered Homework authoring item using an allowlisted definition from the single component registry.';

create function public.build_lesson_homework_projection(
  p_lesson_homework_id uuid
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $function$
  select jsonb_build_object(
    'id', homework.id,
    'lessonId', homework.lesson_id,
    'revision', homework.revision,
    'createdAt', homework.created_at,
    'updatedAt', homework.updated_at,
    'items', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', item.id,
            'position', item.position,
            'typeKey', item.type_key,
            'schemaVersion', item.schema_version,
            'payload', item.payload,
            'placement', item.placement_config
          )
          order by item.position
        )
        from public.lesson_homework_item as item
        where item.lesson_homework_id = homework.id
      ),
      '[]'::jsonb
    )
  )
  from public.lesson_homework as homework
  where homework.id = p_lesson_homework_id;
$function$;

revoke all on function public.build_lesson_homework_projection(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.build_lesson_homework_projection(uuid)
  to postgres;

create function public.get_my_lesson_homework(
  p_lesson_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_actor_account_id uuid := (
    select public.current_active_session_account_id()
  );
  v_course_id uuid;
  v_homework_id uuid;
begin
  if p_lesson_id is null or v_actor_account_id is null then
    raise exception 'lesson_homework_not_found' using errcode = 'P0002';
  end if;

  select course.id, homework.id
  into v_course_id, v_homework_id
  from public.lesson as lesson
  join public.course as course on course.id = lesson.course_id
  join public.account as account on account.id = course.owner_account_id
  left join public.lesson_homework as homework
    on homework.lesson_id = lesson.id
  where lesson.id = p_lesson_id
    and course.owner_account_id = v_actor_account_id
    and course.archived_at is null
    and (
      course.learning_audience = 'children'
      or (
        course.learning_audience = 'educators'
        and account.can_author_educator_courses
      )
    );

  if not found then
    raise exception 'lesson_homework_not_found' using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'courseId', v_course_id,
    'lessonId', p_lesson_id,
    'homework', case
      when v_homework_id is null then null
      else public.build_lesson_homework_projection(v_homework_id)
    end
  );
end
$function$;

revoke all on function public.get_my_lesson_homework(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.get_my_lesson_homework(uuid)
  to authenticated, postgres;

create function public.replace_my_lesson_homework(
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

comment on function public.get_my_lesson_homework(uuid) is
  'P1.3 authenticated owner read for one separate Lesson Homework draft.';
comment on function public.replace_my_lesson_homework(uuid, integer, jsonb) is
  'P1.3 authenticated owner CAS replace/clear for the full ordered Homework draft.';

-- Lesson deletion already owns the Course -> Lesson lock order. Extend the
-- graph lock before Component/Run history cleanup so a concurrent Homework
-- replace either commits first and is cascaded, or observes the missing Lesson.
create or replace function public.delete_lesson_with_history(
  p_lesson_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor_user_id uuid := (select auth.uid());
  v_actor_account_id uuid;
  v_course_id uuid;
begin
  if v_actor_user_id is null then
    raise exception 'lesson_not_found' using errcode = 'P0002';
  end if;

  select course.id, account.id
  into v_course_id, v_actor_account_id
  from public.lesson as lesson
  join public.course as course on course.id = lesson.course_id
  join public.account as account on account.id = course.owner_account_id
  where lesson.id = p_lesson_id
    and account.auth_user_id = v_actor_user_id;
  if not found then
    raise exception 'lesson_not_found' using errcode = 'P0002';
  end if;

  if not public.lock_current_account_session_authority(
    v_actor_account_id
  ) then
    raise exception 'lesson_not_found' using errcode = 'P0002';
  end if;

  perform 1
  from public.course as course
  join public.account as account on account.id = course.owner_account_id
  where course.id = v_course_id
    and account.auth_user_id = v_actor_user_id
  for update of course;
  if not found then
    raise exception 'lesson_not_found' using errcode = 'P0002';
  end if;

  perform 1
  from public.lesson as lesson
  where lesson.id = p_lesson_id
    and lesson.course_id = v_course_id
  for update of lesson;
  if not found then
    raise exception 'lesson_not_found' using errcode = 'P0002';
  end if;

  perform homework.id
  from public.lesson_homework as homework
  where homework.lesson_id = p_lesson_id
  order by homework.id
  for update of homework;

  perform item.id
  from public.lesson_homework_item as item
  join public.lesson_homework as homework
    on homework.id = item.lesson_homework_id
  where homework.lesson_id = p_lesson_id
  order by item.id
  for update of item;

  perform component.id
  from public.lesson_component as component
  where component.lesson_id = p_lesson_id
  order by component.id
  for update of component;

  perform run.id
  from public.lesson_run as run
  where run.lesson_id = p_lesson_id
  order by run.id
  for update of run;

  perform record.id
  from public.learning_record as record
  where record.source_lesson_id = p_lesson_id
    or record.lesson_run_id in (
      select run.id
      from public.lesson_run as run
      where run.lesson_id = p_lesson_id
    )
  order by record.id
  for update of record;

  perform evidence.id
  from public.learning_evidence as evidence
  join public.lesson_component as component
    on component.id = evidence.lesson_component_id
  where component.lesson_id = p_lesson_id
  order by evidence.id
  for update of evidence;

  perform issue.id
  from public.choice_quiz_issue as issue
  join public.lesson_component as component
    on component.id = issue.lesson_component_id
  where component.lesson_id = p_lesson_id
  order by issue.id
  for update of issue;

  update public.learning_record as record
  set lesson_run_id = null,
      source_lesson_id = null
  where record.occurred_at is not null
    and (
      record.source_lesson_id = p_lesson_id
      or record.lesson_run_id in (
        select run.id
        from public.lesson_run as run
        where run.lesson_id = p_lesson_id
      )
    );

  delete from public.lesson as lesson
  where lesson.id = p_lesson_id;

  return true;
end
$function$;

do $postflight$
declare
  v_table_count integer;
  v_function_count integer;
  v_delete_definition text;
begin
  select count(*)::integer
  into v_table_count
  from pg_class as relation
  join pg_namespace as namespace on namespace.oid = relation.relnamespace
  where namespace.nspname = 'public'
    and relation.relkind in ('r', 'p');

  select count(*)::integer
  into v_function_count
  from pg_proc as procedure
  join pg_namespace as namespace on namespace.oid = procedure.pronamespace
  where namespace.nspname = 'public';

  if v_table_count <> 76 or v_function_count <> 278 then
    raise exception
      'lesson_homework_postflight_inventory_mismatch:%/%',
      v_table_count,
      v_function_count
      using errcode = '55000';
  end if;

  if exists (
    select 1
    from unnest(array[
      'public.get_my_lesson_homework(uuid)',
      'public.replace_my_lesson_homework(uuid,integer,jsonb)',
      'public.build_lesson_homework_projection(uuid)'
    ]) as required_function(signature)
    left join pg_proc as procedure
      on procedure.oid = to_regprocedure(required_function.signature)
    where procedure.oid is null
      or pg_get_userbyid(procedure.proowner) <> 'supabase_admin'
      or procedure.proconfig is distinct from array['search_path=""']::text[]
  )
  then
    raise exception 'lesson_homework_function_owner_config_invalid'
      using errcode = '55000';
  end if;

  if (
    select count(*)
    from pg_class as relation
    join pg_namespace as namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relname in ('lesson_homework', 'lesson_homework_item')
      and relation.relkind = 'r'
      and relation.relrowsecurity
  ) <> 2
  then
    raise exception 'lesson_homework_rls_contract_invalid'
      using errcode = '55000';
  end if;

  if exists (
    select 1
    from pg_policies as policy
    where policy.schemaname = 'public'
      and policy.tablename in ('lesson_homework', 'lesson_homework_item')
  )
  then
    raise exception 'lesson_homework_raw_policy_unexpected'
      using errcode = '55000';
  end if;

  if exists (
    select 1
    from unnest(array['anon', 'authenticated', 'service_role']) as role(name)
    cross join unnest(
      array['lesson_homework', 'lesson_homework_item']
    ) as relation(name)
    cross join unnest(
      array['SELECT', 'INSERT', 'UPDATE', 'DELETE']
    ) as privilege(name)
    where has_table_privilege(
      role.name,
      format('public.%I', relation.name),
      privilege.name
    )
  )
  then
    raise exception 'lesson_homework_raw_acl_unexpected'
      using errcode = '55000';
  end if;

  if not exists (
    select 1
    from pg_proc as procedure
    where procedure.oid = to_regprocedure(
      'public.get_my_lesson_homework(uuid)'
    )
      and procedure.prosecdef
      and procedure.provolatile = 's'
      and procedure.proconfig @> array['search_path=""']::text[]
  )
    or not exists (
      select 1
      from pg_proc as procedure
      where procedure.oid = to_regprocedure(
        'public.replace_my_lesson_homework(uuid,integer,jsonb)'
      )
        and procedure.prosecdef
        and procedure.provolatile = 'v'
        and procedure.proconfig @> array['search_path=""']::text[]
    )
  then
    raise exception 'lesson_homework_rpc_security_invalid'
      using errcode = '55000';
  end if;

  if not has_function_privilege(
    'authenticated',
    'public.get_my_lesson_homework(uuid)',
    'EXECUTE'
  )
    or not has_function_privilege(
      'authenticated',
      'public.replace_my_lesson_homework(uuid,integer,jsonb)',
      'EXECUTE'
    )
    or has_function_privilege(
      'anon',
      'public.get_my_lesson_homework(uuid)',
      'EXECUTE'
    )
    or has_function_privilege(
      'service_role',
      'public.get_my_lesson_homework(uuid)',
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
    or has_function_privilege(
      'authenticated',
      'public.build_lesson_homework_projection(uuid)',
      'EXECUTE'
    )
  then
    raise exception 'lesson_homework_rpc_acl_invalid'
      using errcode = '55000';
  end if;

  select pg_get_functiondef(
    to_regprocedure('public.delete_lesson_with_history(uuid)')
  )
  into v_delete_definition;
  if position('public.lesson_homework as homework' in v_delete_definition) = 0
    or position(
      'public.lesson_homework_item as item' in v_delete_definition
    ) = 0
  then
    raise exception 'lesson_homework_delete_lifecycle_lock_missing'
      using errcode = '55000';
  end if;

  if (select count(*) from public.lesson_homework) <> 0
    or (select count(*) from public.lesson_homework_item) <> 0
  then
    raise exception 'lesson_homework_migration_created_product_data'
      using errcode = '55000';
  end if;
end
$postflight$;

commit;
