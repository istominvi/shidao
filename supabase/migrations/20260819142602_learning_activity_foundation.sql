begin;

-- LA-M1 stores one current component-level teacher observation for an
-- expected learner. Draft/final lifecycle continues to belong to the parent
-- LearningRecord; no second Run state, Lesson Step, content snapshot, or
-- generic event payload is introduced here.

-- ---------------------------------------------------------------------------
-- Fail closed when this is not the current canonical ShiDao schema head.
-- ---------------------------------------------------------------------------

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
      ('lesson_run'),
      ('learner_profile'),
      ('learning_record')
  ) as expected(name)
  where to_regclass('public.' || expected.name) is null;

  if v_missing is not null then
    raise exception
      'shidao_learning_activity_schema_sanity_failed: missing tables: %',
      v_missing;
  end if;

  if to_regclass('public.lesson_step') is not null
    or to_regclass('public.lesson_run_participant') is not null
    or to_regclass('public.lesson_component_observation') is not null
    or to_regprocedure(
      'public.save_lesson_component_observations(uuid,uuid,text,text,text,jsonb)'
    ) is not null
    or to_regprocedure(
      'public.delete_draft_observations_for_lesson_component()'
    ) is not null
  then
    raise exception
      'shidao_learning_activity_schema_sanity_failed: unexpected runtime objects';
  end if;

  if to_regprocedure(
      'public.complete_lesson_run_v2(uuid,jsonb,text,timestamp with time zone,integer)'
    ) is null
    or to_regprocedure(
      'public.cancel_lesson_run(uuid,timestamp with time zone)'
    ) is null
    or to_regprocedure('public.start_lesson_run(uuid,timestamp with time zone)')
      is null
    or to_regprocedure('public.delete_lesson_component(uuid)') is null
    or to_regprocedure('public.current_account_id()') is null
  then
    raise exception
      'shidao_learning_activity_schema_sanity_failed: canonical RPC missing';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'lesson_run'
      and column_name = 'started_at_is_actual'
      and data_type = 'boolean'
      and is_nullable = 'NO'
  )
    or not exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'learning_record'
        and column_name = 'recorded_by_account_id'
        and data_type = 'uuid'
        and is_nullable = 'NO'
    )
    or not exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'learning_record'
        and column_name = 'occurred_at'
        and data_type = 'timestamp with time zone'
    )
    or not exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'lesson_component'
        and column_name = 'position'
        and data_type = 'integer'
    )
    or not exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'lesson_component'
        and column_name = 'type_key'
        and data_type = 'text'
    )
  then
    raise exception
      'shidao_learning_activity_schema_sanity_failed: canonical columns missing';
  end if;

  if exists (
    select 1
    from pg_constraint
    where conrelid = 'public.learning_record'::regclass
      and conname = 'learning_record_id_recorded_by_unique'
  ) then
    raise exception
      'shidao_learning_activity_schema_sanity_failed: recorder key already exists';
  end if;
end
$preflight$;

-- The redundant key lets the observation recorder invariant remain a physical
-- composite FK instead of application-only convention.
alter table public.learning_record
  add constraint learning_record_id_recorded_by_unique
  unique (id, recorded_by_account_id);

create table public.lesson_component_observation (
  id uuid primary key default gen_random_uuid(),
  learning_record_id uuid not null,
  lesson_component_id uuid null,
  source_lesson_component_id_at_time uuid not null,
  component_position_at_time integer not null,
  component_type_key_at_time text not null,
  component_label_at_time text not null,
  observable_criterion_at_time text not null,
  rating text not null,
  entry_method text not null,
  private_note text null,
  observed_at timestamptz not null default clock_timestamp(),
  recorded_by_account_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lesson_component_observation_record_source_unique
    unique (learning_record_id, source_lesson_component_id_at_time),
  constraint lesson_component_observation_record_recorder_fkey
    foreign key (learning_record_id, recorded_by_account_id)
    references public.learning_record(id, recorded_by_account_id)
    on delete cascade,
  constraint lesson_component_observation_live_component_fkey
    foreign key (lesson_component_id)
    references public.lesson_component(id)
    on delete set null,
  constraint lesson_component_observation_live_source_check check (
    lesson_component_id is null
    or lesson_component_id = source_lesson_component_id_at_time
  ),
  constraint lesson_component_observation_position_check check (
    component_position_at_time > 0
  ),
  constraint lesson_component_observation_type_key_check check (
    btrim(component_type_key_at_time) <> ''
    and char_length(btrim(component_type_key_at_time)) <= 80
  ),
  constraint lesson_component_observation_label_check check (
    btrim(component_label_at_time) <> ''
    and char_length(btrim(component_label_at_time)) <= 500
  ),
  constraint lesson_component_observation_criterion_check check (
    btrim(observable_criterion_at_time) <> ''
    and char_length(btrim(observable_criterion_at_time)) <= 500
  ),
  constraint lesson_component_observation_rating_check check (
    rating in ('independent', 'with_support', 'not_yet')
  ),
  constraint lesson_component_observation_entry_method_check check (
    entry_method in ('direct', 'bulk_confirmed')
  ),
  constraint lesson_component_observation_private_note_check check (
    private_note is null
    or (
      btrim(private_note) <> ''
      and char_length(btrim(private_note)) <= 500
    )
  )
);

create index lesson_component_observation_live_component_idx
  on public.lesson_component_observation (lesson_component_id)
  where lesson_component_id is not null;

create index lesson_component_observation_recorder_observed_idx
  on public.lesson_component_observation (
    recorded_by_account_id,
    observed_at desc,
    id
  );

create trigger trg_lesson_component_observation_updated_at
before update on public.lesson_component_observation
for each row execute function public.set_updated_at();

-- A Component can still be edited while a Run is open. Deleting it removes
-- only mutable draft observations; finalized evidence keeps its compact
-- at-time context and the live FK is nulled by ON DELETE SET NULL.
create function public.delete_draft_observations_for_lesson_component()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  delete from public.lesson_component_observation as observation
  using public.learning_record as record
  where record.id = observation.learning_record_id
    and record.occurred_at is null
    and observation.lesson_component_id = old.id;

  return old;
end
$function$;

revoke all on function
  public.delete_draft_observations_for_lesson_component()
from public, anon, authenticated, service_role;

grant execute on function
  public.delete_draft_observations_for_lesson_component()
to postgres;

create trigger trg_lesson_component_delete_draft_observations
before delete on public.lesson_component
for each row execute function
  public.delete_draft_observations_for_lesson_component();

-- Component deletion must serialize with save and completion before the
-- trigger decides whether an observation is still a draft. The canonical RPC
-- already locks the Lesson and its Components; extend that order through all
-- Runs and LearningRecords of the Lesson. If deletion wins, only draft
-- observations disappear. If completion wins, the finalized observation is
-- retained and ON DELETE SET NULL detaches only its live Component pointer.
create or replace function public.delete_lesson_component(
  p_component_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
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

  perform component.id
  from public.lesson_component as component
  where component.lesson_id = v_lesson_id
  order by component.id
  for update of component;

  perform run.id
  from public.lesson_run as run
  where run.lesson_id = v_lesson_id
  order by run.id
  for update of run;

  perform record.id
  from public.learning_record as record
  join public.lesson_run as run on run.id = record.lesson_run_id
  where run.lesson_id = v_lesson_id
  order by record.id
  for update of record;

  perform slide.id
  from public.lesson_student_slide as slide
  where slide.lesson_id = v_lesson_id
  order by slide.id
  for update of slide;

  delete from public.lesson_component as component
  where component.id = p_component_id
    and component.lesson_id = v_lesson_id;

  get diagnostics v_deleted_count = row_count;
  return v_deleted_count = 1;
end
$function$;

-- Detach finalized memory explicitly before deleting its authored Lesson.
-- The new observation FK adds another child edge to LearningRecord; doing the
-- two nullable detachments in one locked update avoids relying on cascading
-- FK trigger order while drafts still follow the existing Run cleanup.
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

alter table public.lesson_component_observation enable row level security;

create policy lesson_component_observation_recorder_select
on public.lesson_component_observation
for select
to authenticated
using (
  recorded_by_account_id = (select public.current_account_id())
);

revoke all on table public.lesson_component_observation
from public, anon, authenticated, service_role;

grant all on table public.lesson_component_observation
to postgres, service_role;

grant select on table public.lesson_component_observation
to authenticated;

-- One RPC covers direct autosave, an explicitly confirmed bulk batch, and
-- clearing back to not_observed. The batch entry method is intentionally
-- top-level: an unconfirmed bulk draft has no representable persisted value.
create function public.save_lesson_component_observations(
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
  v_run public.lesson_run%rowtype;
  v_locked_record_count integer;
  v_observed_at timestamptz := clock_timestamp();
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

  -- Supported Lesson/component deletion and cancellation lock the Lesson
  -- before their children. Keep that parent-first order here.
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

  -- Criterion and compact source context are common to this component
  -- opportunity. While the Run is open they move atomically with an explicit
  -- rated save; completion freezes them through the parent record lifecycle.
  if v_has_rating then
    update public.lesson_component_observation as observation
    set lesson_component_id = v_component.id,
        component_position_at_time = v_component.position,
        component_type_key_at_time = btrim(v_component.type_key),
        component_label_at_time = btrim(p_component_label_at_time),
        observable_criterion_at_time =
          btrim(p_observable_criterion_at_time)
    from public.learning_record as record
    where record.id = observation.learning_record_id
      and record.lesson_run_id = v_run.id
      and observation.recorded_by_account_id = v_actor_account_id
      and observation.source_lesson_component_id_at_time = v_component.id;
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
  uuid,
  uuid,
  text,
  text,
  text,
  jsonb
) from public, anon, authenticated, service_role;

grant execute on function public.save_lesson_component_observations(
  uuid,
  uuid,
  text,
  text,
  text,
  jsonb
) to postgres, authenticated;

-- Preserve the existing compact LearningRecord completion contract. The one
-- LA-M1 addition rejects an absent learner while a component observation still
-- exists. Attendance, repeat and teacher report remain explicit input only.
create or replace function public.complete_lesson_run_v2(
  p_lesson_run_id uuid,
  p_records jsonb,
  p_teacher_report text default null,
  p_ended_at timestamptz default now(),
  p_actual_duration_minutes integer default null
)
returns public.lesson_run
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor_account_id uuid;
  v_course_id uuid;
  v_course_title text;
  v_lesson_title text;
  v_subject text;
  v_lesson_id uuid;
  v_run public.lesson_run%rowtype;
  v_actual_duration integer;
begin
  if (select auth.uid()) is null then
    raise exception 'lesson_run_not_found' using errcode = 'P0002';
  end if;
  if p_ended_at is null then
    raise exception 'lesson_run_ended_at_required' using errcode = '22023';
  end if;
  if p_records is null or jsonb_typeof(p_records) <> 'array'
    or jsonb_array_length(p_records) not between 1 and 200
  then
    raise exception 'lesson_run_records_must_be_nonempty_bounded_array'
      using errcode = '22023';
  end if;
  if p_actual_duration_minutes is not null
    and p_actual_duration_minutes not between 1 and 720
  then
    raise exception 'lesson_run_actual_duration_invalid' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_records) as submitted(value)
    where jsonb_typeof(submitted.value) is distinct from 'object'
      or jsonb_typeof(submitted.value -> 'learnerProfileId') is distinct from 'string'
      or jsonb_typeof(submitted.value -> 'wasPresent') is distinct from 'boolean'
      or (submitted.value ? 'needsRepeat' and coalesce(
        jsonb_typeof(submitted.value -> 'needsRepeat'), 'null'
      ) not in ('boolean', 'null'))
      or (submitted.value ? 'teacherComment' and coalesce(
        jsonb_typeof(submitted.value -> 'teacherComment'), 'null'
      ) not in ('string', 'null'))
      or (submitted.value ? 'shareWithLearner' and coalesce(
        jsonb_typeof(submitted.value -> 'shareWithLearner'), 'null'
      ) not in ('boolean', 'null'))
      or (
        coalesce((submitted.value ->> 'shareWithLearner')::boolean, false)
        and nullif(btrim(submitted.value ->> 'teacherComment'), '') is null
      )
  ) then
    raise exception 'lesson_run_record_shape_invalid' using errcode = '22023';
  end if;

  if (select count(*) from jsonb_array_elements(p_records)) <>
     (select count(distinct (value ->> 'learnerProfileId')::uuid)
      from jsonb_array_elements(p_records))
  then
    raise exception 'lesson_run_record_learner_duplicate' using errcode = '22023';
  end if;

  select run.lesson_id into v_lesson_id
  from public.lesson_run as run
  join public.lesson as lesson on lesson.id = run.lesson_id
  join public.course as course on course.id = lesson.course_id
  join public.account as account on account.id = course.owner_account_id
  where run.id = p_lesson_run_id
    and account.auth_user_id = (select auth.uid());

  if not found then
    raise exception 'lesson_run_not_found' using errcode = 'P0002';
  end if;

  -- Keep the same parent-first lifecycle lock order as Component deletion and
  -- observation save. Locking all Components makes the draft/final decision
  -- in the delete trigger stable for the remainder of either transaction.
  perform 1
  from public.lesson as lesson
  join public.course as course on course.id = lesson.course_id
  join public.account as account on account.id = course.owner_account_id
  where lesson.id = v_lesson_id
    and account.auth_user_id = (select auth.uid())
  for update of lesson;

  if not found then
    raise exception 'lesson_run_not_found' using errcode = 'P0002';
  end if;

  perform component.id
  from public.lesson_component as component
  where component.lesson_id = v_lesson_id
  order by component.id
  for update of component;

  select run.* into v_run
  from public.lesson_run as run
  where run.id = p_lesson_run_id
    and run.lesson_id = v_lesson_id
  for update of run;

  if not found then
    raise exception 'lesson_run_not_found' using errcode = 'P0002';
  end if;

  select
    course.owner_account_id,
    course.id,
    course.title,
    lesson.title,
    course.subject
  into
    v_actor_account_id,
    v_course_id,
    v_course_title,
    v_lesson_title,
    v_subject
  from public.lesson as lesson
  join public.course as course on course.id = lesson.course_id
  where lesson.id = v_run.lesson_id;

  if v_run.ended_at is not null then return v_run; end if;
  if v_run.cancelled_at is not null then
    raise exception 'lesson_run_not_open' using errcode = '55000';
  end if;
  if v_run.started_at_is_actual and p_ended_at < v_run.started_at then
    raise exception 'lesson_run_ended_before_start' using errcode = '22007';
  end if;

  perform 1 from public.learning_record as record
  where record.lesson_run_id = p_lesson_run_id
  order by record.id
  for update of record;

  if exists (
    select 1 from public.learning_record as record
    where record.lesson_run_id = p_lesson_run_id
      and record.occurred_at is not null
  ) then
    raise exception 'lesson_run_contains_finalized_records' using errcode = '55000';
  end if;

  if (select count(*) from public.learning_record where lesson_run_id = p_lesson_run_id)
      <> jsonb_array_length(p_records)
    or exists (
      select 1
      from jsonb_array_elements(p_records) as submitted(value)
      left join public.learning_record as record
        on record.lesson_run_id = p_lesson_run_id
       and record.learner_profile_id = (submitted.value ->> 'learnerProfileId')::uuid
      where record.id is null
    )
  then
    raise exception 'lesson_run_records_do_not_match_expected_learners'
      using errcode = '23514';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_records) as submitted(value)
    join public.learning_record as record
      on record.lesson_run_id = p_lesson_run_id
     and record.learner_profile_id =
       (submitted.value ->> 'learnerProfileId')::uuid
    join public.lesson_component_observation as observation
      on observation.learning_record_id = record.id
     and observation.recorded_by_account_id =
       record.recorded_by_account_id
    where not (submitted.value ->> 'wasPresent')::boolean
  ) then
    raise exception 'lesson_run_absent_learner_has_observation'
      using errcode = '23514';
  end if;

  v_actual_duration := p_actual_duration_minutes;
  if v_actual_duration is null and v_run.started_at_is_actual then
    v_actual_duration := greatest(
      1,
      ceil(extract(epoch from (p_ended_at - v_run.started_at)) / 60.0)::integer
    );
    if v_actual_duration not between 1 and 720 then
      raise exception 'lesson_run_actual_duration_invalid' using errcode = '22023';
    end if;
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
      shared_with_learner_at = case
        when coalesce((submitted.value ->> 'shareWithLearner')::boolean, false)
          and nullif(btrim(submitted.value ->> 'teacherComment'), '') is not null
          then p_ended_at
        else null
      end,
      actual_duration_minutes_at_time = v_actual_duration,
      course_title_at_time = v_course_title,
      lesson_title_at_time = v_lesson_title,
      subject_at_time = v_subject
  from jsonb_array_elements(p_records) as submitted(value)
  where record.lesson_run_id = p_lesson_run_id
    and record.learner_profile_id = (submitted.value ->> 'learnerProfileId')::uuid;

  update public.lesson_run as run
  set ended_at = p_ended_at,
      actual_duration_minutes = v_actual_duration,
      teacher_report = nullif(btrim(p_teacher_report), '')
  where run.id = p_lesson_run_id
  returning run.* into v_run;

  return v_run;
end
$function$;

-- ---------------------------------------------------------------------------
-- Migration postflight: physical shape, RLS, ACL and lifecycle guard.
-- ---------------------------------------------------------------------------

do $postflight$
declare
  v_table_oid oid := to_regclass('public.lesson_component_observation');
  v_rpc_oid oid := to_regprocedure(
    'public.save_lesson_component_observations(uuid,uuid,text,text,text,jsonb)'
  );
  v_delete_guard_oid oid := to_regprocedure(
    'public.delete_draft_observations_for_lesson_component()'
  );
  v_component_delete_oid oid := to_regprocedure(
    'public.delete_lesson_component(uuid)'
  );
  v_completion_oid oid := to_regprocedure(
    'public.complete_lesson_run_v2(uuid,jsonb,text,timestamp with time zone,integer)'
  );
begin
  if v_table_oid is null
    or not exists (
      select 1
      from pg_class as relation
      where relation.oid = v_table_oid
        and relation.relrowsecurity
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
    raise exception 'learning_activity_postflight_rls_failed'
      using errcode = 'P0001';
  end if;

  if not exists (
      select 1
      from pg_constraint
      where conrelid = 'public.learning_record'::regclass
        and conname = 'learning_record_id_recorded_by_unique'
        and contype = 'u'
        and convalidated
    )
    or not exists (
      select 1
      from pg_constraint
      where conrelid = v_table_oid
        and conname = 'lesson_component_observation_record_recorder_fkey'
        and contype = 'f'
        and confdeltype = 'c'
        and convalidated
    )
    or not exists (
      select 1
      from pg_constraint
      where conrelid = v_table_oid
        and conname = 'lesson_component_observation_live_component_fkey'
        and contype = 'f'
        and confdeltype = 'n'
        and convalidated
    )
  then
    raise exception 'learning_activity_postflight_constraint_failed'
      using errcode = 'P0001';
  end if;

  if v_delete_guard_oid is null
    or v_component_delete_oid is null
    or not exists (
      select 1
      from pg_proc as procedure
      where procedure.oid = v_delete_guard_oid
        and procedure.prosecdef
        and procedure.proconfig @> array['search_path=""']::text[]
    )
    or has_function_privilege(
      'authenticated', v_delete_guard_oid, 'EXECUTE'
    )
    or has_function_privilege('anon', v_delete_guard_oid, 'EXECUTE')
    or has_function_privilege('service_role', v_delete_guard_oid, 'EXECUTE')
    or not exists (
      select 1
      from pg_trigger as trigger
      where trigger.tgrelid = 'public.lesson_component'::regclass
        and trigger.tgname =
          'trg_lesson_component_delete_draft_observations'
        and not trigger.tgisinternal
        and trigger.tgenabled = 'O'
        and trigger.tgfoid = v_delete_guard_oid
    )
    or position(
      'set lesson_run_id = null'
      in lower(pg_get_functiondef(to_regprocedure(
        'public.delete_lesson_with_history(uuid)'
      )))
    ) = 0
    or position(
      'source_lesson_id = null'
      in lower(pg_get_functiondef(to_regprocedure(
        'public.delete_lesson_with_history(uuid)'
      )))
    ) = 0
    or position(
      'for update of lesson'
      in lower(pg_get_functiondef(v_component_delete_oid))
    ) = 0
    or position(
      'for update of component'
      in lower(pg_get_functiondef(v_component_delete_oid))
    ) = 0
    or position(
      'for update of run'
      in lower(pg_get_functiondef(v_component_delete_oid))
    ) = 0
    or position(
      'for update of record'
      in lower(pg_get_functiondef(v_component_delete_oid))
    ) = 0
  then
    raise exception 'learning_activity_postflight_delete_lifecycle_failed'
      using errcode = 'P0001';
  end if;

  if not has_table_privilege(
      'authenticated', v_table_oid, 'SELECT'
    )
    or has_table_privilege('authenticated', v_table_oid, 'INSERT')
    or has_table_privilege('authenticated', v_table_oid, 'UPDATE')
    or has_table_privilege('authenticated', v_table_oid, 'DELETE')
    or has_table_privilege('anon', v_table_oid, 'SELECT')
    or has_table_privilege('anon', v_table_oid, 'INSERT')
    or has_table_privilege('anon', v_table_oid, 'UPDATE')
    or has_table_privilege('anon', v_table_oid, 'DELETE')
  then
    raise exception 'learning_activity_postflight_table_acl_failed'
      using errcode = '42501';
  end if;

  if v_rpc_oid is null
    or not exists (
      select 1
      from pg_proc as procedure
      where procedure.oid = v_rpc_oid
        and procedure.prosecdef
        and procedure.proretset
        and procedure.proconfig @> array['search_path=""']::text[]
    )
    or not has_function_privilege('authenticated', v_rpc_oid, 'EXECUTE')
    or not has_function_privilege('postgres', v_rpc_oid, 'EXECUTE')
    or has_function_privilege('anon', v_rpc_oid, 'EXECUTE')
    or has_function_privilege('service_role', v_rpc_oid, 'EXECUTE')
  then
    raise exception 'learning_activity_postflight_rpc_acl_failed'
      using errcode = '42501';
  end if;

  if v_completion_oid is null
    or position(
      'lesson_run_absent_learner_has_observation'
      in pg_get_functiondef(v_completion_oid)
    ) = 0
    or position(
      'lesson_component_observation'
      in pg_get_functiondef(v_completion_oid)
    ) = 0
    or position(
      'for update of lesson'
      in lower(pg_get_functiondef(v_completion_oid))
    ) = 0
    or position(
      'for update of component'
      in lower(pg_get_functiondef(v_completion_oid))
    ) = 0
    or position(
      'for update of run'
      in lower(pg_get_functiondef(v_completion_oid))
    ) = 0
    or position(
      'for update of record'
      in lower(pg_get_functiondef(v_completion_oid))
    ) = 0
  then
    raise exception 'learning_activity_postflight_completion_guard_failed'
      using errcode = 'P0001';
  end if;

  if exists (select 1 from public.lesson_component_observation) then
    raise exception 'learning_activity_postflight_unexpected_rows'
      using errcode = 'P0001';
  end if;
end
$postflight$;

notify pgrst, 'reload schema';

commit;
