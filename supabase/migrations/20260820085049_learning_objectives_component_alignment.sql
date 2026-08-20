begin;

-- LA-M2 adds flat Course objectives, one optional primary alignment per
-- Component, and objective-at-time provenance for new teacher observations.
-- Existing Components, observations and immutable publication revisions are
-- intentionally left byte-for-byte/data-for-data unchanged by this migration.

do $preflight$
declare
  v_missing text;
begin
  select string_agg(expected.name, ', ' order by expected.name)
  into v_missing
  from (
    values
      ('account'),
      ('course'),
      ('lesson'),
      ('lesson_component'),
      ('lesson_component_observation'),
      ('lesson_run'),
      ('learning_record'),
      ('course_publication_revision')
  ) as expected(name)
  where to_regclass('public.' || expected.name) is null;

  if v_missing is not null then
    raise exception
      'shidao_learning_objective_schema_sanity_failed: missing tables: %',
      v_missing;
  end if;

  if to_regclass('public.lesson_step') is not null
    or to_regclass('public.learning_objective') is not null
    or to_regprocedure(
      'public.update_lesson_component_v2(uuid,jsonb,boolean,jsonb,boolean,uuid,boolean,text,boolean)'
    ) is not null
    or exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'lesson_component'
        and column_name in (
          'primary_learning_objective_id',
          'activity_role'
        )
    )
    or exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'lesson_component_observation'
        and column_name in (
          'learning_objective_id',
          'source_learning_objective_id_at_time',
          'learning_objective_title_at_time'
        )
    )
  then
    raise exception
      'shidao_learning_objective_schema_sanity_failed: unexpected LA-M2 objects';
  end if;

  if to_regprocedure(
      'public.save_lesson_component_observations(uuid,uuid,text,text,text,jsonb)'
    ) is null
    or to_regprocedure('public.current_account_id()') is null
    or to_regprocedure('public.set_updated_at()') is null
    or not exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'course'
        and column_name = 'publication_content_updated_at'
    )
    or not exists (
      select 1
      from pg_policies as policy
      where policy.schemaname = 'public'
        and policy.tablename = 'lesson_component_observation'
        and policy.policyname = 'lesson_component_observation_recorder_select'
        and policy.cmd = 'SELECT'
    )
  then
    raise exception
      'shidao_learning_objective_schema_sanity_failed: LA-M1 head missing';
  end if;
end
$preflight$;

create temporary table learning_objective_migration_baseline
on commit drop
as
select
  (select count(*) from public.lesson_component) as component_count,
  (select count(*) from public.lesson_component_observation)
    as observation_count,
  (select count(*) from public.course_publication_revision)
    as revision_count;

create table public.learning_objective (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null
    references public.course(id) on delete cascade,
  title text not null,
  description text null,
  archived_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint learning_objective_title_check check (
    char_length(btrim(title)) between 2 and 240
  ),
  constraint learning_objective_description_check check (
    description is null
    or (
      btrim(description) <> ''
      and char_length(btrim(description)) <= 2000
    )
  )
);

create index learning_objective_course_active_idx
  on public.learning_objective (course_id, created_at, id)
  where archived_at is null;

create index learning_objective_course_all_idx
  on public.learning_objective (course_id, created_at, id);

alter table public.learning_objective enable row level security;

create policy learning_objective_course_owner_select
on public.learning_objective
for select to authenticated
using (
  exists (
    select 1
    from public.course as course
    where course.id = learning_objective.course_id
      and course.owner_account_id = (select public.current_account_id())
  )
);

revoke all on table public.learning_objective
from public, anon, authenticated, service_role;
grant select on table public.learning_objective to authenticated, service_role;

create trigger trg_learning_objective_updated_at
before update on public.learning_objective
for each row execute function public.set_updated_at();

create function public.touch_course_from_learning_objective()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_old_course_id uuid;
  v_new_course_id uuid;
begin
  if tg_op <> 'INSERT' then
    v_old_course_id := old.course_id;
  end if;
  if tg_op <> 'DELETE' then
    v_new_course_id := new.course_id;
  end if;

  update public.course as course
  set updated_at = clock_timestamp(),
      publication_content_updated_at = clock_timestamp()
  where course.id in (v_old_course_id, v_new_course_id);

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end
$function$;

revoke all on function public.touch_course_from_learning_objective()
from public, anon, authenticated, service_role;
grant execute on function public.touch_course_from_learning_objective()
to postgres;

create trigger trg_learning_objective_touch_course
after insert or update or delete on public.learning_objective
for each row execute function public.touch_course_from_learning_objective();

create function public.create_learning_objective(
  p_course_id uuid,
  p_title text,
  p_description text default null
)
returns setof public.learning_objective
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor_user_id uuid := (select auth.uid());
  v_objective public.learning_objective%rowtype;
begin
  if v_actor_user_id is null
    or p_course_id is null
    or p_title is null
    or char_length(btrim(p_title)) not between 2 and 240
    or (
      p_description is not null
      and (
        btrim(p_description) = ''
        or char_length(btrim(p_description)) > 2000
      )
    )
  then
    raise exception 'learning_objective_invalid'
      using errcode = '22023';
  end if;

  perform 1
  from public.course as course
  join public.account as account on account.id = course.owner_account_id
  where course.id = p_course_id
    and course.archived_at is null
    and account.auth_user_id = v_actor_user_id
  for update of course;

  if not found then
    raise exception 'learning_objective_not_found'
      using errcode = 'P0002';
  end if;

  insert into public.learning_objective (
    course_id,
    title,
    description
  ) values (
    p_course_id,
    btrim(p_title),
    nullif(btrim(p_description), '')
  )
  returning * into v_objective;

  return next v_objective;
end
$function$;

create function public.update_learning_objective(
  p_objective_id uuid,
  p_title text,
  p_update_title boolean,
  p_description text,
  p_update_description boolean
)
returns setof public.learning_objective
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor_user_id uuid := (select auth.uid());
  v_course_id uuid;
  v_objective public.learning_objective%rowtype;
begin
  if v_actor_user_id is null
    or p_objective_id is null
    or coalesce(p_update_title, false) = false
       and coalesce(p_update_description, false) = false
    or (
      coalesce(p_update_title, false)
      and (
        p_title is null
        or char_length(btrim(p_title)) not between 2 and 240
      )
    )
    or (
      coalesce(p_update_description, false)
      and p_description is not null
      and (
        btrim(p_description) = ''
        or char_length(btrim(p_description)) > 2000
      )
    )
  then
    raise exception 'learning_objective_invalid'
      using errcode = '22023';
  end if;

  select objective.course_id
  into v_course_id
  from public.learning_objective as objective
  join public.course as course on course.id = objective.course_id
  join public.account as account on account.id = course.owner_account_id
  where objective.id = p_objective_id
    and course.archived_at is null
    and account.auth_user_id = v_actor_user_id;

  if not found then
    raise exception 'learning_objective_not_found'
      using errcode = 'P0002';
  end if;

  perform 1
  from public.course as course
  where course.id = v_course_id
  for update of course;

  select objective.*
  into v_objective
  from public.learning_objective as objective
  where objective.id = p_objective_id
    and objective.course_id = v_course_id
  for update of objective;

  if not found then
    raise exception 'learning_objective_not_found'
      using errcode = 'P0002';
  end if;

  update public.learning_objective as objective
  set title = case
        when p_update_title then btrim(p_title)
        else objective.title
      end,
      description = case
        when p_update_description then nullif(btrim(p_description), '')
        else objective.description
      end
  where objective.id = p_objective_id
  returning objective.* into v_objective;

  return next v_objective;
end
$function$;

create function public.archive_learning_objective(
  p_objective_id uuid
)
returns setof public.learning_objective
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor_user_id uuid := (select auth.uid());
  v_course_id uuid;
  v_objective public.learning_objective%rowtype;
begin
  if v_actor_user_id is null or p_objective_id is null then
    raise exception 'learning_objective_invalid'
      using errcode = '22023';
  end if;

  select objective.course_id
  into v_course_id
  from public.learning_objective as objective
  join public.course as course on course.id = objective.course_id
  join public.account as account on account.id = course.owner_account_id
  where objective.id = p_objective_id
    and course.archived_at is null
    and account.auth_user_id = v_actor_user_id;

  if not found then
    raise exception 'learning_objective_not_found'
      using errcode = 'P0002';
  end if;

  perform 1
  from public.course as course
  where course.id = v_course_id
  for update of course;

  select objective.*
  into v_objective
  from public.learning_objective as objective
  where objective.id = p_objective_id
    and objective.course_id = v_course_id
  for update of objective;

  if not found then
    raise exception 'learning_objective_not_found'
      using errcode = 'P0002';
  end if;

  update public.learning_objective as objective
  set archived_at = coalesce(objective.archived_at, clock_timestamp())
  where objective.id = p_objective_id
  returning objective.* into v_objective;

  return next v_objective;
end
$function$;

revoke all on function public.create_learning_objective(uuid, text, text)
from public, anon, authenticated, service_role;
revoke all on function public.update_learning_objective(
  uuid, text, boolean, text, boolean
) from public, anon, authenticated, service_role;
revoke all on function public.archive_learning_objective(uuid)
from public, anon, authenticated, service_role;

grant execute on function public.create_learning_objective(uuid, text, text)
to postgres, authenticated;
grant execute on function public.update_learning_objective(
  uuid, text, boolean, text, boolean
) to postgres, authenticated;
grant execute on function public.archive_learning_objective(uuid)
to postgres, authenticated;

alter table public.lesson_component
  add column primary_learning_objective_id uuid null,
  add column activity_role text null,
  add constraint lesson_component_primary_learning_objective_fkey
    foreign key (primary_learning_objective_id)
    references public.learning_objective(id)
    on delete set null,
  add constraint lesson_component_activity_role_check check (
    activity_role is null
    or activity_role in ('practice', 'assessment', 'survey')
  );

grant insert(primary_learning_objective_id),
  update(primary_learning_objective_id),
  insert(activity_role),
  update(activity_role)
on table public.lesson_component to authenticated;

create index lesson_component_primary_learning_objective_idx
  on public.lesson_component (primary_learning_objective_id)
  where primary_learning_objective_id is not null;

create function public.guard_lesson_component_learning_alignment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_component_course_id uuid;
  v_objective_course_id uuid;
  v_objective_archived_at timestamptz;
begin
  select lesson.course_id
  into v_component_course_id
  from public.lesson as lesson
  where lesson.id = new.lesson_id;

  if not found then
    raise exception 'lesson_component_learning_alignment_invalid'
      using errcode = '23503';
  end if;

  if new.primary_learning_objective_id is not null then
    select objective.course_id, objective.archived_at
    into v_objective_course_id, v_objective_archived_at
    from public.learning_objective as objective
    where objective.id = new.primary_learning_objective_id
    for key share of objective;

    if not found then
      raise exception 'lesson_component_learning_objective_not_found'
        using errcode = '23503';
    end if;

    if v_objective_course_id <> v_component_course_id then
      raise exception 'lesson_component_learning_objective_cross_course'
        using errcode = '23514';
    end if;

    if v_objective_archived_at is not null
      and (
        tg_op = 'INSERT'
        or old.primary_learning_objective_id
          is distinct from new.primary_learning_objective_id
      )
    then
      raise exception 'lesson_component_learning_objective_archived'
        using errcode = '23514';
    end if;
  end if;

  if new.activity_role = 'survey'
    and new.type_key <> 'single_choice_poll'
  then
    raise exception 'lesson_component_activity_role_unsupported'
      using errcode = '23514';
  end if;

  if new.activity_role in ('practice', 'assessment')
    and new.type_key not in (
      'matching_game',
      'choice_quiz',
      'fill_blanks',
      'word_bank',
      'sequence',
      'categorize',
      'free_response',
      'word_builder'
    )
  then
    raise exception 'lesson_component_activity_role_unsupported'
      using errcode = '23514';
  end if;

  return new;
end
$function$;

revoke all on function public.guard_lesson_component_learning_alignment()
from public, anon, authenticated, service_role;
grant execute on function public.guard_lesson_component_learning_alignment()
to postgres;

create trigger trg_lesson_component_learning_alignment
before insert or update of
  lesson_id,
  type_key,
  primary_learning_objective_id,
  activity_role
on public.lesson_component
for each row execute function public.guard_lesson_component_learning_alignment();

-- Component edits historically used direct REST PATCHes. The V2 application
-- uses this RPC so its canonical path acquires Course -> Lesson -> Component
-- before alignment/objective work. Existing column UPDATE grants remain during
-- the DB-first rolling deploy so the previous web image stays compatible.
create function public.update_lesson_component_v2(
  p_component_id uuid,
  p_payload jsonb,
  p_update_payload boolean,
  p_placement_config jsonb,
  p_update_placement_config boolean,
  p_primary_learning_objective_id uuid,
  p_update_primary_learning_objective_id boolean,
  p_activity_role text,
  p_update_activity_role boolean
)
returns setof public.lesson_component
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor_user_id uuid := (select auth.uid());
  v_course_id uuid;
  v_lesson_id uuid;
  v_component public.lesson_component%rowtype;
  v_primary_learning_objective_id uuid;
  v_activity_role text;
  v_objective_course_id uuid;
  v_objective_archived_at timestamptz;
begin
  if v_actor_user_id is null
    or p_component_id is null
    or p_update_payload is null
    or p_update_placement_config is null
    or p_update_primary_learning_objective_id is null
    or p_update_activity_role is null
    or not (
      p_update_payload
      or p_update_placement_config
      or p_update_primary_learning_objective_id
      or p_update_activity_role
    )
    or (
      p_update_payload
      and (
        p_payload is null
        or jsonb_typeof(p_payload) <> 'object'
      )
    )
    or (not p_update_payload and p_payload is not null)
    or (
      p_update_placement_config
      and (
        p_placement_config is null
        or jsonb_typeof(p_placement_config) <> 'object'
      )
    )
    or (
      not p_update_placement_config
      and p_placement_config is not null
    )
    or (
      not p_update_primary_learning_objective_id
      and p_primary_learning_objective_id is not null
    )
    or (
      p_update_activity_role
      and p_activity_role is not null
      and p_activity_role not in ('practice', 'assessment', 'survey')
    )
    or (not p_update_activity_role and p_activity_role is not null)
  then
    raise exception 'lesson_component_update_invalid'
      using errcode = '22023';
  end if;

  -- The first lookup is authorization/discovery only. Every authoritative
  -- value is read again under the canonical parent-to-child locks below.
  select lesson.course_id, lesson.id
  into v_course_id, v_lesson_id
  from public.lesson_component as component
  join public.lesson as lesson on lesson.id = component.lesson_id
  join public.course as course on course.id = lesson.course_id
  join public.account as account on account.id = course.owner_account_id
  where component.id = p_component_id
    and account.auth_user_id = v_actor_user_id;

  if not found then
    raise exception 'lesson_component_update_not_found'
      using errcode = 'P0002';
  end if;

  perform 1
  from public.course as course
  join public.account as account on account.id = course.owner_account_id
  where course.id = v_course_id
    and account.auth_user_id = v_actor_user_id
  for update of course;

  if not found then
    raise exception 'lesson_component_update_not_found'
      using errcode = 'P0002';
  end if;

  perform 1
  from public.lesson as lesson
  where lesson.id = v_lesson_id
    and lesson.course_id = v_course_id
  for update of lesson;

  if not found then
    raise exception 'lesson_component_update_not_found'
      using errcode = 'P0002';
  end if;

  select component.*
  into v_component
  from public.lesson_component as component
  where component.id = p_component_id
    and component.lesson_id = v_lesson_id
  for update of component;

  if not found then
    raise exception 'lesson_component_update_not_found'
      using errcode = 'P0002';
  end if;

  v_primary_learning_objective_id := case
    when p_update_primary_learning_objective_id
      then p_primary_learning_objective_id
    else v_component.primary_learning_objective_id
  end;
  v_activity_role := case
    when p_update_activity_role then p_activity_role
    else v_component.activity_role
  end;

  if v_primary_learning_objective_id is not null then
    select objective.course_id, objective.archived_at
    into v_objective_course_id, v_objective_archived_at
    from public.learning_objective as objective
    where objective.id = v_primary_learning_objective_id
    for key share of objective;

    if not found then
      raise exception 'lesson_component_learning_objective_not_found'
        using errcode = '23503';
    end if;

    if v_objective_course_id <> v_course_id then
      raise exception 'lesson_component_learning_objective_cross_course'
        using errcode = '23514';
    end if;

    if v_objective_archived_at is not null
      and v_component.primary_learning_objective_id
        is distinct from v_primary_learning_objective_id
    then
      raise exception 'lesson_component_learning_objective_archived'
        using errcode = '23514';
    end if;
  end if;

  if v_activity_role = 'survey'
    and v_component.type_key <> 'single_choice_poll'
  then
    raise exception 'lesson_component_activity_role_unsupported'
      using errcode = '23514';
  end if;

  if v_activity_role in ('practice', 'assessment')
    and v_component.type_key not in (
      'matching_game',
      'choice_quiz',
      'fill_blanks',
      'word_bank',
      'sequence',
      'categorize',
      'free_response',
      'word_builder'
    )
  then
    raise exception 'lesson_component_activity_role_unsupported'
      using errcode = '23514';
  end if;

  update public.lesson_component as component
  set payload = case
        when p_update_payload then p_payload
        else component.payload
      end,
      placement_config = case
        when p_update_placement_config then p_placement_config
        else component.placement_config
      end,
      primary_learning_objective_id =
        v_primary_learning_objective_id,
      activity_role = v_activity_role
  where component.id = p_component_id
    and component.lesson_id = v_lesson_id
  returning component.* into v_component;

  return next v_component;
end
$function$;

revoke all on function public.update_lesson_component_v2(
  uuid, jsonb, boolean, jsonb, boolean, uuid, boolean, text, boolean
) from public, anon, authenticated, service_role;
grant execute on function public.update_lesson_component_v2(
  uuid, jsonb, boolean, jsonb, boolean, uuid, boolean, text, boolean
) to postgres, authenticated;

alter table public.lesson_component_observation
  add column learning_objective_id uuid null,
  add column source_learning_objective_id_at_time uuid null,
  add column learning_objective_title_at_time text null,
  add constraint lesson_component_observation_live_objective_fkey
    foreign key (learning_objective_id)
    references public.learning_objective(id)
    on delete set null,
  add constraint lesson_component_observation_objective_context_check check (
    (
      source_learning_objective_id_at_time is null
      and learning_objective_title_at_time is null
      and learning_objective_id is null
    )
    or (
      source_learning_objective_id_at_time is not null
      and learning_objective_title_at_time is not null
      and btrim(learning_objective_title_at_time) <> ''
      and char_length(btrim(learning_objective_title_at_time)) <= 240
      and (
        learning_objective_id is null
        or learning_objective_id = source_learning_objective_id_at_time
      )
    )
  );

create index lesson_component_observation_live_objective_idx
  on public.lesson_component_observation (learning_objective_id)
  where learning_objective_id is not null;

create or replace function public.save_lesson_component_observations(
  p_lesson_run_id uuid,
  p_lesson_component_id uuid,
  p_component_label_at_time text,
  p_observable_criterion_at_time text,
  p_entry_method text,
  p_observations jsonb
)
returns setof public.lesson_component_observation
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor_user_id uuid := (select auth.uid());
  v_actor_account_id uuid;
  v_lesson_id uuid;
  v_component public.lesson_component%rowtype;
  v_objective public.learning_objective%rowtype;
  v_run public.lesson_run%rowtype;
  v_locked_record_count integer;
  v_observed_at timestamptz;
  v_has_rating boolean;
begin
  if v_actor_user_id is null
    or p_lesson_run_id is null
    or p_lesson_component_id is null
    or p_component_label_at_time is null
    or btrim(p_component_label_at_time) = ''
    or char_length(btrim(p_component_label_at_time)) > 500
    or p_entry_method is null
    or p_entry_method not in ('direct', 'bulk_confirmed')
    or p_observations is null
    or jsonb_typeof(p_observations) <> 'array'
    or jsonb_array_length(p_observations) not between 1 and 200
  then
    raise exception 'lesson_component_observations_invalid'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_observations) as submitted(value)
    where jsonb_typeof(submitted.value) is distinct from 'object'
      or (submitted.value - array[
        'learningRecordId', 'rating', 'privateNote'
      ]) <> '{}'::jsonb
      or not (submitted.value ? 'learningRecordId')
      or jsonb_typeof(submitted.value -> 'learningRecordId')
        is distinct from 'string'
      or (submitted.value ->> 'learningRecordId') !~*
        '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      or not (submitted.value ? 'rating')
      or coalesce(jsonb_typeof(submitted.value -> 'rating'), 'null')
        not in ('string', 'null')
      or (
        jsonb_typeof(submitted.value -> 'rating') = 'string'
        and submitted.value ->> 'rating'
          not in ('independent', 'with_support', 'not_yet')
      )
      or (
        submitted.value ? 'privateNote'
        and coalesce(jsonb_typeof(submitted.value -> 'privateNote'), 'null')
          not in ('string', 'null')
      )
      or (
        jsonb_typeof(submitted.value -> 'privateNote') = 'string'
        and char_length(btrim(submitted.value ->> 'privateNote')) > 500
      )
      or (
        coalesce(jsonb_typeof(submitted.value -> 'rating'), 'null') = 'null'
        and nullif(btrim(submitted.value ->> 'privateNote'), '') is not null
      )
  ) then
    raise exception 'lesson_component_observation_entry_invalid'
      using errcode = '22023';
  end if;

  if (
    select count(*)
    from jsonb_array_elements(p_observations)
  ) <> (
    select count(distinct (submitted.value ->> 'learningRecordId')::uuid)
    from jsonb_array_elements(p_observations) as submitted(value)
  ) then
    raise exception 'lesson_component_observation_record_duplicate'
      using errcode = '22023';
  end if;

  select exists (
    select 1
    from jsonb_array_elements(p_observations) as submitted(value)
    where jsonb_typeof(submitted.value -> 'rating') = 'string'
  ) into v_has_rating;

  if v_has_rating and (
    p_observable_criterion_at_time is null
    or btrim(p_observable_criterion_at_time) = ''
    or char_length(btrim(p_observable_criterion_at_time)) > 500
  ) then
    raise exception 'lesson_component_observation_criterion_required'
      using errcode = '22023';
  end if;

  select course.owner_account_id, lesson.id
  into v_actor_account_id, v_lesson_id
  from public.lesson_component as component
  join public.lesson as lesson on lesson.id = component.lesson_id
  join public.course as course on course.id = lesson.course_id
  join public.account as account on account.id = course.owner_account_id
  where component.id = p_lesson_component_id
    and account.auth_user_id = v_actor_user_id;

  if not found then
    raise exception 'lesson_component_observation_not_found'
      using errcode = 'P0002';
  end if;

  perform 1
  from public.lesson as lesson
  where lesson.id = v_lesson_id
  for update of lesson;

  select component.*
  into v_component
  from public.lesson_component as component
  where component.id = p_lesson_component_id
    and component.lesson_id = v_lesson_id
  for update of component;

  if not found then
    raise exception 'lesson_component_observation_not_found'
      using errcode = 'P0002';
  end if;

  if v_component.primary_learning_objective_id is not null then
    select objective.*
    into v_objective
    from public.learning_objective as objective
    where objective.id = v_component.primary_learning_objective_id
    for key share of objective;

    if not found then
      raise exception 'lesson_component_learning_objective_not_found'
        using errcode = '55000';
    end if;
  end if;

  select run.*
  into v_run
  from public.lesson_run as run
  where run.id = p_lesson_run_id
    and run.lesson_id = v_lesson_id
  for update of run;

  if not found then
    raise exception 'lesson_component_observation_not_found'
      using errcode = 'P0002';
  end if;

  if v_run.cancelled_at is not null or v_run.ended_at is not null then
    raise exception 'lesson_run_not_open' using errcode = '55000';
  end if;

  if v_run.started_at is null or not v_run.started_at_is_actual then
    raise exception 'lesson_run_not_started' using errcode = '55000';
  end if;

  perform record.id
  from public.learning_record as record
  join jsonb_array_elements(p_observations) as submitted(value)
    on record.id = (submitted.value ->> 'learningRecordId')::uuid
  where record.lesson_run_id = v_run.id
    and record.recorded_by_account_id = v_actor_account_id
    and record.occurred_at is null
  order by record.id
  for update of record;

  get diagnostics v_locked_record_count = row_count;
  if v_locked_record_count <> jsonb_array_length(p_observations) then
    raise exception 'lesson_component_observation_not_found'
      using errcode = 'P0002';
  end if;

  -- Linearize the at-time timestamp only after Lesson -> Component ->
  -- Objective -> Run -> LearningRecord state is locked and validated.
  v_observed_at := clock_timestamp();

  if v_has_rating then
    update public.lesson_component_observation as observation
    set lesson_component_id = v_component.id,
        component_position_at_time = v_component.position,
        component_type_key_at_time = btrim(v_component.type_key),
        component_label_at_time = btrim(p_component_label_at_time),
        observable_criterion_at_time =
          btrim(p_observable_criterion_at_time),
        learning_objective_id = v_objective.id,
        source_learning_objective_id_at_time = v_objective.id,
        learning_objective_title_at_time = btrim(v_objective.title)
    from jsonb_array_elements(p_observations) as submitted(value)
    where observation.learning_record_id =
        (submitted.value ->> 'learningRecordId')::uuid
      and observation.recorded_by_account_id = v_actor_account_id
      and observation.source_lesson_component_id_at_time = v_component.id
      and jsonb_typeof(submitted.value -> 'rating') = 'string';
  end if;

  delete from public.lesson_component_observation as observation
  using jsonb_array_elements(p_observations) as submitted(value)
  where observation.learning_record_id =
      (submitted.value ->> 'learningRecordId')::uuid
    and observation.recorded_by_account_id = v_actor_account_id
    and observation.source_lesson_component_id_at_time = v_component.id
    and coalesce(jsonb_typeof(submitted.value -> 'rating'), 'null') = 'null';

  if v_has_rating then
    insert into public.lesson_component_observation (
      learning_record_id,
      lesson_component_id,
      source_lesson_component_id_at_time,
      component_position_at_time,
      component_type_key_at_time,
      component_label_at_time,
      observable_criterion_at_time,
      learning_objective_id,
      source_learning_objective_id_at_time,
      learning_objective_title_at_time,
      rating,
      entry_method,
      private_note,
      observed_at,
      recorded_by_account_id
    )
    select
      (submitted.value ->> 'learningRecordId')::uuid,
      v_component.id,
      v_component.id,
      v_component.position,
      btrim(v_component.type_key),
      btrim(p_component_label_at_time),
      btrim(p_observable_criterion_at_time),
      v_objective.id,
      v_objective.id,
      case when v_objective.id is null then null else btrim(v_objective.title) end,
      submitted.value ->> 'rating',
      p_entry_method,
      nullif(btrim(submitted.value ->> 'privateNote'), ''),
      v_observed_at,
      v_actor_account_id
    from jsonb_array_elements(p_observations) as submitted(value)
    where jsonb_typeof(submitted.value -> 'rating') = 'string'
    on conflict (
      learning_record_id,
      source_lesson_component_id_at_time
    ) do update
    set lesson_component_id = excluded.lesson_component_id,
        component_position_at_time = excluded.component_position_at_time,
        component_type_key_at_time = excluded.component_type_key_at_time,
        component_label_at_time = excluded.component_label_at_time,
        observable_criterion_at_time =
          excluded.observable_criterion_at_time,
        learning_objective_id = excluded.learning_objective_id,
        source_learning_objective_id_at_time =
          excluded.source_learning_objective_id_at_time,
        learning_objective_title_at_time =
          excluded.learning_objective_title_at_time,
        rating = excluded.rating,
        entry_method = excluded.entry_method,
        private_note = excluded.private_note,
        observed_at = excluded.observed_at;
  end if;

  return query
  select observation.*
  from public.lesson_component_observation as observation
  join public.learning_record as record
    on record.id = observation.learning_record_id
  where record.lesson_run_id = v_run.id
    and observation.recorded_by_account_id = v_actor_account_id
    and observation.source_lesson_component_id_at_time = v_component.id
  order by observation.learning_record_id;
end
$function$;

revoke all on function public.save_lesson_component_observations(
  uuid, uuid, text, text, text, jsonb
) from public, anon, authenticated, service_role;
grant execute on function public.save_lesson_component_observations(
  uuid, uuid, text, text, text, jsonb
) to postgres, authenticated;

do $postflight$
declare
  v_objective_table oid := to_regclass('public.learning_objective');
  v_create_objective_rpc oid := to_regprocedure(
    'public.create_learning_objective(uuid,text,text)'
  );
  v_update_objective_rpc oid := to_regprocedure(
    'public.update_learning_objective(uuid,text,boolean,text,boolean)'
  );
  v_archive_objective_rpc oid := to_regprocedure(
    'public.archive_learning_objective(uuid)'
  );
  v_update_component_rpc oid := to_regprocedure(
    'public.update_lesson_component_v2(uuid,jsonb,boolean,jsonb,boolean,uuid,boolean,text,boolean)'
  );
  v_save_rpc oid := to_regprocedure(
    'public.save_lesson_component_observations(uuid,uuid,text,text,text,jsonb)'
  );
begin
  if v_objective_table is null
    or not exists (
      select 1 from pg_class as relation
      where relation.oid = v_objective_table
        and relation.relrowsecurity
    )
    or not exists (
      select 1 from pg_policies as policy
      where policy.schemaname = 'public'
        and policy.tablename = 'learning_objective'
        and policy.policyname = 'learning_objective_course_owner_select'
        and policy.cmd = 'SELECT'
    )
  then
    raise exception 'learning_objective_postflight_rls_failed';
  end if;

  if not has_table_privilege('authenticated', v_objective_table, 'SELECT')
    or has_table_privilege('authenticated', v_objective_table, 'INSERT')
    or has_table_privilege('authenticated', v_objective_table, 'UPDATE')
    or has_table_privilege('authenticated', v_objective_table, 'DELETE')
    or has_table_privilege('anon', v_objective_table, 'SELECT')
    or has_table_privilege('anon', v_objective_table, 'INSERT')
    or has_table_privilege('anon', v_objective_table, 'UPDATE')
    or has_table_privilege('anon', v_objective_table, 'DELETE')
    or not has_table_privilege('service_role', v_objective_table, 'SELECT')
    or has_table_privilege('service_role', v_objective_table, 'INSERT')
    or has_table_privilege('service_role', v_objective_table, 'UPDATE')
    or has_table_privilege('service_role', v_objective_table, 'DELETE')
  then
    raise exception 'learning_objective_postflight_acl_failed'
      using errcode = '42501';
  end if;

  if v_create_objective_rpc is null
    or v_update_objective_rpc is null
    or v_archive_objective_rpc is null
    or not exists (
      select 1
      from pg_proc as procedure
      where procedure.oid = v_create_objective_rpc
        and procedure.prosecdef
        and procedure.proconfig @> array['search_path=""']::text[]
    )
    or not exists (
      select 1
      from pg_proc as procedure
      where procedure.oid = v_update_objective_rpc
        and procedure.prosecdef
        and procedure.proconfig @> array['search_path=""']::text[]
    )
    or not exists (
      select 1
      from pg_proc as procedure
      where procedure.oid = v_archive_objective_rpc
        and procedure.prosecdef
        and procedure.proconfig @> array['search_path=""']::text[]
    )
    or not has_function_privilege(
      'authenticated', v_create_objective_rpc, 'EXECUTE'
    )
    or not has_function_privilege(
      'authenticated', v_update_objective_rpc, 'EXECUTE'
    )
    or not has_function_privilege(
      'authenticated', v_archive_objective_rpc, 'EXECUTE'
    )
    or has_function_privilege('anon', v_create_objective_rpc, 'EXECUTE')
    or has_function_privilege('anon', v_update_objective_rpc, 'EXECUTE')
    or has_function_privilege('anon', v_archive_objective_rpc, 'EXECUTE')
    or has_function_privilege(
      'service_role', v_create_objective_rpc, 'EXECUTE'
    )
    or has_function_privilege(
      'service_role', v_update_objective_rpc, 'EXECUTE'
    )
    or has_function_privilege(
      'service_role', v_archive_objective_rpc, 'EXECUTE'
    )
  then
    raise exception 'learning_objective_postflight_rpc_acl_failed'
      using errcode = '42501';
  end if;

  if v_update_component_rpc is null
    or not exists (
      select 1
      from pg_proc as procedure
      where procedure.oid = v_update_component_rpc
        and procedure.prosecdef
        and procedure.proconfig @> array['search_path=""']::text[]
    )
    or not has_function_privilege(
      'authenticated', v_update_component_rpc, 'EXECUTE'
    )
    or not has_function_privilege(
      'postgres', v_update_component_rpc, 'EXECUTE'
    )
    or has_function_privilege('anon', v_update_component_rpc, 'EXECUTE')
    or has_function_privilege(
      'service_role', v_update_component_rpc, 'EXECUTE'
    )
    or not has_column_privilege(
      'authenticated', 'public.lesson_component', 'payload', 'INSERT'
    )
    or not has_column_privilege(
      'authenticated', 'public.lesson_component', 'placement_config', 'INSERT'
    )
    or not has_column_privilege(
      'authenticated',
      'public.lesson_component',
      'primary_learning_objective_id',
      'INSERT'
    )
    or not has_column_privilege(
      'authenticated', 'public.lesson_component', 'activity_role', 'INSERT'
    )
    or not has_column_privilege(
      'authenticated', 'public.lesson_component', 'payload', 'UPDATE'
    )
    or not has_column_privilege(
      'authenticated', 'public.lesson_component', 'placement_config', 'UPDATE'
    )
    or not has_column_privilege(
      'authenticated',
      'public.lesson_component',
      'primary_learning_objective_id',
      'UPDATE'
    )
    or not has_column_privilege(
      'authenticated', 'public.lesson_component', 'activity_role', 'UPDATE'
    )
    or position(
      'for update of course'
      in lower(pg_get_functiondef(v_update_component_rpc))
    ) = 0
    or position(
      'for update of lesson'
      in lower(pg_get_functiondef(v_update_component_rpc))
    ) <= position(
      'for update of course'
      in lower(pg_get_functiondef(v_update_component_rpc))
    )
    or position(
      'for update of component'
      in lower(pg_get_functiondef(v_update_component_rpc))
    ) <= position(
      'for update of lesson'
      in lower(pg_get_functiondef(v_update_component_rpc))
    )
    or position(
      'for key share of objective'
      in lower(pg_get_functiondef(v_update_component_rpc))
    ) <= position(
      'for update of component'
      in lower(pg_get_functiondef(v_update_component_rpc))
    )
    or not exists (
      select 1
      from pg_trigger as trigger
      where trigger.tgrelid = 'public.lesson_component'::regclass
        and trigger.tgname = 'trg_lesson_component_learning_alignment'
        and not trigger.tgisinternal
        and trigger.tgenabled <> 'D'
    )
    or not exists (
      select 1
      from pg_constraint as constraint_row
      where constraint_row.conrelid = 'public.lesson_component'::regclass
        and constraint_row.conname =
          'lesson_component_primary_learning_objective_fkey'
        and constraint_row.confdeltype = 'n'
    )
  then
    raise exception 'learning_objective_postflight_component_rpc_failed'
      using errcode = '42501';
  end if;

  if v_save_rpc is null
    or not exists (
      select 1 from pg_proc as procedure
      where procedure.oid = v_save_rpc
        and procedure.prosecdef
        and procedure.proconfig @> array['search_path=""']::text[]
    )
    or position(
      'for update of component'
      in lower(pg_get_functiondef(v_save_rpc))
    ) = 0
    or position(
      'for key share of objective'
      in lower(pg_get_functiondef(v_save_rpc))
    ) = 0
    or position(
      'for update of lesson'
      in lower(pg_get_functiondef(v_save_rpc))
    ) >= position(
      'for update of component'
      in lower(pg_get_functiondef(v_save_rpc))
    )
    or position(
      'for update of component'
      in lower(pg_get_functiondef(v_save_rpc))
    ) >= position(
      'for key share of objective'
      in lower(pg_get_functiondef(v_save_rpc))
    )
  then
    raise exception 'learning_objective_postflight_observation_rpc_failed';
  end if;

  if exists (
      select 1
      from public.lesson_component as component
      where component.primary_learning_objective_id is not null
        or component.activity_role is not null
    )
    or exists (
      select 1
      from public.lesson_component_observation as observation
      where observation.learning_objective_id is not null
        or observation.source_learning_objective_id_at_time is not null
        or observation.learning_objective_title_at_time is not null
    )
    or (select count(*) from public.lesson_component)
      <> (select component_count from learning_objective_migration_baseline)
    or (select count(*) from public.lesson_component_observation)
      <> (select observation_count from learning_objective_migration_baseline)
    or (select count(*) from public.course_publication_revision)
      <> (select revision_count from learning_objective_migration_baseline)
  then
    raise exception 'learning_objective_postflight_legacy_data_changed';
  end if;
end
$postflight$;

notify pgrst, 'reload schema';

commit;
