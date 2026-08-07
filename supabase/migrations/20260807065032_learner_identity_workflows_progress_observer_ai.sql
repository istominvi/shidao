-- Complete learner identity workflows, safe history/progress projections,
-- observer capability, and subject-controlled cross-provider AI context.

begin;

do $$
begin
  if to_regclass('public.learner_profile_merge') is null
    or to_regclass('public.learner_observer_grant') is null
    or to_regclass('public.learner_ai_consent') is null
    or to_regprocedure('public.current_account_auth_context()') is null
    or to_regprocedure('extensions.digest(text,text)') is null
    or to_regprocedure('extensions.crypt(text,text)') is null
  then
    raise exception 'learner_identity_workflows_preflight_schema_mismatch';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'learning_record'
      and column_name = 'shared_with_learner_at'
  ) or to_regprocedure('public.get_my_learning_profile()') is not null then
    raise exception 'learner_identity_workflows_preflight_already_applied';
  end if;
end
$$;

alter table public.lesson_run
  add column actual_duration_minutes integer,
  add column started_at_is_actual boolean not null default false,
  add constraint lesson_run_actual_duration_minutes_check
    check (
      actual_duration_minutes is null
      or actual_duration_minutes between 1 and 720
    ),
  add constraint lesson_run_actual_start_shape_check
    check (not started_at_is_actual or started_at is not null);

alter table public.lesson_run
  drop constraint lesson_run_completion_time_check,
  add constraint lesson_run_completion_time_check
    check (
      ended_at is null
      or started_at is null
      or ended_at >= started_at
    );

alter table public.learning_record
  add column shared_with_learner_at timestamptz,
  add column actual_duration_minutes_at_time integer,
  add column superseded_by_record_id uuid,
  add constraint learning_record_shared_comment_shape_check
    check (
      shared_with_learner_at is null
      or (
        occurred_at is not null
        and teacher_comment is not null
        and btrim(teacher_comment) <> ''
      )
    ),
  add constraint learning_record_actual_duration_check
    check (
      actual_duration_minutes_at_time is null
      or (
        occurred_at is not null
        and actual_duration_minutes_at_time between 1 and 720
      )
    ),
  add constraint learning_record_not_self_superseded_check
    check (superseded_by_record_id is null or superseded_by_record_id <> id),
  add constraint learning_record_superseded_by_record_id_fkey
    foreign key (superseded_by_record_id)
    references public.learning_record(id)
    on delete no action
    deferrable initially deferred;

create index learning_record_superseded_by_idx
  on public.learning_record (superseded_by_record_id)
  where superseded_by_record_id is not null;

create index learning_record_learner_safe_history_idx
  on public.learning_record (
    learner_profile_id,
    occurred_at desc,
    id desc
  )
  where occurred_at is not null
    and superseded_by_record_id is null;

create index learning_record_teacher_safe_history_idx
  on public.learning_record (
    recorded_by_account_id,
    learner_profile_id,
    occurred_at desc,
    id desc
  )
  where occurred_at is not null
    and superseded_by_record_id is null;

create function public.append_learner_identity_audit(
  p_event_type text,
  p_actor_account_id uuid default null,
  p_subject_account_id uuid default null,
  p_learner_profile_id uuid default null,
  p_related_learner_profile_id uuid default null,
  p_related_entity_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id bigint;
begin
  insert into public.learner_identity_audit_event (
    event_type,
    actor_account_id,
    subject_account_id,
    learner_profile_id,
    related_learner_profile_id,
    related_entity_id,
    metadata
  ) values (
    p_event_type,
    p_actor_account_id,
    p_subject_account_id,
    p_learner_profile_id,
    p_related_learner_profile_id,
    p_related_entity_id,
    coalesce(p_metadata, '{}'::jsonb)
  ) returning id into v_id;
  return v_id;
end
$$;

create function public.account_id_for_auth_user(p_auth_user_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select account.id
  from public.account as account
  where account.auth_user_id = p_auth_user_id
    and account.status in ('active', 'provisional')
  limit 1;
$$;

create function public.current_owned_learner_profile_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select profile.id
  from public.account as account
  join public.learner_profile as profile on profile.account_id = account.id
  where account.auth_user_id = (select auth.uid())
    and account.status = 'active'
  limit 1;
$$;

create function public.resolve_learner_profile_alias(
  p_learner_profile_id uuid
)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select alias.target_learner_profile_id
      from public.learner_profile_alias as alias
      where alias.source_learner_profile_id = p_learner_profile_id
    ),
    (
      select profile.id
      from public.learner_profile as profile
      where profile.id = p_learner_profile_id
    )
  );
$$;

create function public.learner_safe_history_projection(
  p_learner_profile_id uuid,
  p_cursor text default null,
  p_limit integer default 25
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 25), 1), 50);
  v_cursor_occurred_at timestamptz;
  v_cursor_id uuid;
  v_items jsonb;
  v_next_cursor text;
begin
  if p_cursor is not null then
    select record.occurred_at, record.id
    into v_cursor_occurred_at, v_cursor_id
    from public.learning_record as record
    where record.learner_profile_id = p_learner_profile_id
      and record.occurred_at is not null
      and record.superseded_by_record_id is null
      and encode(
        extensions.digest(record.id::text || ':' || record.occurred_at::text, 'sha256'),
        'hex'
      ) = p_cursor
    limit 1;

    if not found then
      raise exception 'learning_history_cursor_invalid' using errcode = '22023';
    end if;
  end if;

  with page as (
    select record.*
    from public.learning_record as record
    where record.learner_profile_id = p_learner_profile_id
      and record.occurred_at is not null
      and record.superseded_by_record_id is null
      and (
        v_cursor_id is null
        or (record.occurred_at, record.id) < (v_cursor_occurred_at, v_cursor_id)
      )
    order by record.occurred_at desc, record.id desc
    limit v_limit + 1
  ), visible as (
    select * from page
    order by occurred_at desc, id desc
    limit v_limit
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'key', encode(
          extensions.digest(id::text || ':' || occurred_at::text, 'sha256'),
          'hex'
        ),
        'occurredAt', occurred_at,
        'courseTitle', course_title_at_time,
        'lessonTitle', lesson_title_at_time,
        'subject', subject_at_time,
        'wasPresent', was_present,
        'needsRepeat', needs_repeat,
        'actualDurationMinutes', actual_duration_minutes_at_time,
        'comment', case
          when shared_with_learner_at is not null then jsonb_build_object(
            'text', teacher_comment,
            'sharedAt', shared_with_learner_at
          )
          else 'null'::jsonb
        end
      ) order by occurred_at desc, id desc
    ),
    '[]'::jsonb
  ) into v_items
  from visible;

  with page as (
    select record.id, record.occurred_at,
      row_number() over (order by record.occurred_at desc, record.id desc) as rn
    from public.learning_record as record
    where record.learner_profile_id = p_learner_profile_id
      and record.occurred_at is not null
      and record.superseded_by_record_id is null
      and (
        v_cursor_id is null
        or (record.occurred_at, record.id) < (v_cursor_occurred_at, v_cursor_id)
      )
    order by record.occurred_at desc, record.id desc
    limit v_limit + 1
  )
  select encode(
    extensions.digest(previous.id::text || ':' || previous.occurred_at::text, 'sha256'),
    'hex'
  ) into v_next_cursor
  from page as overflow
  join page as previous on previous.rn = v_limit
  where overflow.rn = v_limit + 1;

  return jsonb_build_object(
    'items', v_items,
    'nextCursor', v_next_cursor
  );
end
$$;

create function public.learner_progress_projection(
  p_learner_profile_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with records as (
    select record.*
    from public.learning_record as record
    where record.learner_profile_id = p_learner_profile_id
      and record.occurred_at is not null
      and record.superseded_by_record_id is null
  ), subjects as (
    select
      coalesce(nullif(btrim(subject_at_time), ''), 'Без предмета') as subject,
      count(*)::integer as completed_run_count,
      count(*) filter (where was_present)::integer as attended_run_count,
      count(*) filter (where needs_repeat is true)::integer as repeat_recommended_count,
      case
        when count(actual_duration_minutes_at_time) filter (where was_present) = 0 then null
        else sum(actual_duration_minutes_at_time) filter (where was_present)::integer
      end as known_actual_duration_minutes
    from records
    group by coalesce(nullif(btrim(subject_at_time), ''), 'Без предмета')
  )
  select jsonb_build_object(
    'finalizedRunCount', count(*)::integer,
    'attendedRunCount', count(*) filter (where was_present)::integer,
    'repeatRecommendedCount', count(*) filter (where needs_repeat is true)::integer,
    'knownActualDurationMinutes', case
      when count(actual_duration_minutes_at_time) filter (where was_present) = 0 then null
      else sum(actual_duration_minutes_at_time) filter (where was_present)::integer
    end,
    'knownActualDurationRunCount', count(actual_duration_minutes_at_time)
      filter (where was_present)::integer,
    'lastActivityAt', max(occurred_at),
    'subjects', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'subject', subject,
          'completedRunCount', completed_run_count,
          'attendedRunCount', attended_run_count,
          'repeatRecommendedCount', repeat_recommended_count,
          'knownActualDurationMinutes', known_actual_duration_minutes
        ) order by subject
      ) from subjects
    ), '[]'::jsonb)
  )
  from records;
$$;

create or replace function public.start_lesson_run(
  p_lesson_run_id uuid,
  p_started_at timestamptz default now()
)
returns public.lesson_run
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_run public.lesson_run%rowtype;
begin
  if (select auth.uid()) is null or p_started_at is null then
    raise exception 'lesson_run_not_found' using errcode = 'P0002';
  end if;

  select run.* into v_run
  from public.lesson_run as run
  join public.lesson as lesson on lesson.id = run.lesson_id
  join public.course as course on course.id = lesson.course_id
  join public.account as account on account.id = course.owner_account_id
  where run.id = p_lesson_run_id
    and account.auth_user_id = (select auth.uid())
  for update of run;

  if not found then
    raise exception 'lesson_run_not_found' using errcode = 'P0002';
  end if;
  if v_run.cancelled_at is not null or v_run.ended_at is not null then
    raise exception 'lesson_run_not_open' using errcode = '55000';
  end if;

  if v_run.started_at is null or not v_run.started_at_is_actual then
    update public.lesson_run as run
    set started_at = p_started_at,
        started_at_is_actual = true
    where run.id = p_lesson_run_id
    returning run.* into v_run;
  end if;
  return v_run;
end
$$;

create function public.complete_lesson_run_v2(
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
as $$
declare
  v_actor_account_id uuid;
  v_course_id uuid;
  v_course_title text;
  v_lesson_title text;
  v_subject text;
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

  select run.* into v_run
  from public.lesson_run as run
  join public.lesson as lesson on lesson.id = run.lesson_id
  join public.course as course on course.id = lesson.course_id
  join public.account as account on account.id = course.owner_account_id
  where run.id = p_lesson_run_id
    and account.auth_user_id = (select auth.uid())
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
  for update;

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
$$;

create or replace function public.complete_lesson_run(
  p_lesson_run_id uuid,
  p_records jsonb,
  p_teacher_report text default null,
  p_ended_at timestamptz default now()
)
returns public.lesson_run
language sql
security definer
set search_path = ''
as $$
  select public.complete_lesson_run_v2(
    p_lesson_run_id,
    p_records,
    p_teacher_report,
    p_ended_at,
    null
  );
$$;

create function public.learner_profile_merge_preview_for_actor(
  p_merge_operation_id uuid,
  p_actor_account_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_operation public.learner_profile_merge%rowtype;
  v_payload jsonb;
  v_blockers jsonb := '[]'::jsonb;
  v_conflicts jsonb;
  v_fingerprint bytea;
  v_finalized_count integer;
  v_teacher_count integer;
  v_group_count integer;
  v_course_count integer;
begin
  select operation.* into v_operation
  from public.learner_profile_merge as operation
  where operation.id = p_merge_operation_id;

  if not found or v_operation.subject_account_id <> p_actor_account_id then
    raise exception 'learner_profile_merge_not_found' using errcode = 'P0002';
  end if;

  if v_operation.status = 'completed' then
    return v_operation.preview_payload;
  end if;
  if v_operation.status = 'cancelled' or v_operation.expires_at <= now() then
    raise exception 'learner_profile_merge_not_available' using errcode = '55000';
  end if;

  perform 1
  from public.learner_profile as profile
  where profile.id in (
    v_operation.source_learner_profile_id,
    v_operation.target_learner_profile_id
  )
  order by profile.id
  for update of profile;

  if not exists (
    select 1 from public.learner_profile as source
    where source.id = v_operation.source_learner_profile_id
  ) then
    v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
      'code', 'source_missing', 'message', 'Исходный профиль уже недоступен.', 'count', null
    ));
  elsif exists (
    select 1 from public.learner_profile as source
    where source.id = v_operation.source_learner_profile_id
      and source.account_id is not null
  ) then
    v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
      'code', 'source_is_claimed', 'message', 'Объединение двух аккаунтов недоступно.', 'count', 1
    ));
  end if;

  if not exists (
    select 1 from public.learner_profile as target
    where target.id = v_operation.target_learner_profile_id
      and target.account_id = p_actor_account_id
  ) then
    v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
      'code', 'target_not_owned', 'message', 'Целевой профиль не принадлежит вам.', 'count', 1
    ));
  end if;

  if exists (
    select 1 from public.learner_profile_alias as alias
    where alias.target_learner_profile_id = v_operation.source_learner_profile_id
  ) then
    v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
      'code', 'source_has_merge_lineage', 'message', 'Профиль уже содержит объединённую историю.', 'count', null
    ));
  end if;

  if exists (
    select 1 from public.learning_record as record
    where record.learner_profile_id in (
      v_operation.source_learner_profile_id,
      v_operation.target_learner_profile_id
    ) and record.occurred_at is null
  ) then
    v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
      'code', 'draft_records', 'message', 'Сначала завершите или отмените открытые проведения.',
      'count', (select count(*) from public.learning_record as record
        where record.learner_profile_id in (v_operation.source_learner_profile_id, v_operation.target_learner_profile_id)
          and record.occurred_at is null)
    ));
  end if;

  if exists (
    select 1
    from public.learning_record as record
    join public.lesson_run as run on run.id = record.lesson_run_id
    where record.learner_profile_id in (
      v_operation.source_learner_profile_id,
      v_operation.target_learner_profile_id
    ) and run.ended_at is null and run.cancelled_at is null
  ) then
    v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
      'code', 'open_lesson_runs', 'message', 'Сначала закройте все проведения.', 'count', null
    ));
  end if;

  if exists (
    select 1 from public.learner_observer_grant as grant_row
    where grant_row.learner_profile_id = v_operation.source_learner_profile_id
      and grant_row.status = 'active'
  ) or exists (
    select 1 from public.learner_ai_consent as consent
    where consent.learner_profile_id = v_operation.source_learner_profile_id
      and consent.status in ('pending', 'active')
  ) then
    v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
      'code', 'source_has_dependent_grants', 'message', 'Отзовите доступы и согласия исходного профиля.', 'count', null
    ));
  end if;

  select count(*)::integer into v_finalized_count
  from public.learning_record as record
  where record.learner_profile_id = v_operation.source_learner_profile_id
    and record.occurred_at is not null;
  select count(*)::integer into v_teacher_count
  from public.teacher_learner where learner_profile_id = v_operation.source_learner_profile_id;
  select count(*)::integer into v_group_count
  from public.learner_group_member where learner_profile_id = v_operation.source_learner_profile_id;
  select count(*)::integer into v_course_count
  from public.course_learner where learner_profile_id = v_operation.source_learner_profile_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'occurredOn', source_record.occurred_at::date,
    'resolution', 'keep_target_primary'
  ) order by source_record.occurred_at, source_record.id), '[]'::jsonb)
  into v_conflicts
  from public.learning_record as source_record
  join public.learning_record as target_record
    on target_record.lesson_run_id = source_record.lesson_run_id
   and target_record.learner_profile_id = v_operation.target_learner_profile_id
  where source_record.learner_profile_id = v_operation.source_learner_profile_id
    and source_record.lesson_run_id is not null
    and source_record.occurred_at is not null
    and target_record.occurred_at is not null;

  v_payload := jsonb_build_object(
    'operationId', v_operation.id,
    'sourceLearnerProfileId', v_operation.source_learner_profile_id,
    'targetLearnerProfileId', v_operation.target_learner_profile_id,
    'finalizedRecordCount', v_finalized_count,
    'teacherRelationCount', v_teacher_count,
    'groupMembershipCount', v_group_count,
    'courseAudienceCount', v_course_count,
    'conflicts', v_conflicts,
    'blockers', v_blockers,
    'canConfirm', jsonb_array_length(v_blockers) = 0,
    'expiresAt', v_operation.expires_at
  );
  v_fingerprint := extensions.digest(v_payload::text, 'sha256');
  v_payload := v_payload || jsonb_build_object(
    'previewFingerprint', encode(v_fingerprint, 'hex')
  );

  update public.learner_profile_merge as operation
  set preview_fingerprint = v_fingerprint,
      preview_payload = v_payload,
      status = case when jsonb_array_length(v_blockers) = 0 then 'ready' else 'pending' end
  where operation.id = v_operation.id;

  return v_payload;
end
$$;

create function public.execute_learner_profile_merge_for_actor(
  p_merge_operation_id uuid,
  p_actor_account_id uuid,
  p_preview_fingerprint text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_operation public.learner_profile_merge%rowtype;
  v_preview jsonb;
  v_source_id uuid;
  v_target_id uuid;
  v_pair record;
begin
  select operation.* into v_operation
  from public.learner_profile_merge as operation
  where operation.id = p_merge_operation_id;
  if not found or v_operation.subject_account_id <> p_actor_account_id then
    raise exception 'learner_profile_merge_not_found' using errcode = 'P0002';
  end if;
  if v_operation.status = 'completed' then
    return v_operation.target_learner_profile_id;
  end if;

  v_source_id := v_operation.source_learner_profile_id;
  v_target_id := v_operation.target_learner_profile_id;

  perform 1 from public.account as account
  where account.id = p_actor_account_id
  for update of account;
  perform 1 from public.learner_profile as profile
  where profile.id in (v_source_id, v_target_id)
  order by profile.id
  for update of profile;
  perform 1 from public.learner_profile_merge as operation
  where operation.id = p_merge_operation_id
  for update of operation;

  select operation.* into v_operation
  from public.learner_profile_merge as operation
  where operation.id = p_merge_operation_id;
  if v_operation.status = 'completed' then
    return v_operation.target_learner_profile_id;
  end if;

  perform course.id
  from public.course as course
  where course.id in (
    select direct.course_id
    from public.course_learner as direct
    where direct.learner_profile_id in (v_source_id, v_target_id)
    union
    select course_group.course_id
    from public.course_learner_group as course_group
    join public.learner_group_member as member
      on member.learner_group_id = course_group.learner_group_id
    where member.learner_profile_id in (v_source_id, v_target_id)
  )
  order by course.id
  for update of course;
  perform learner_group.id
  from public.learner_group as learner_group
  where learner_group.id in (
    select member.learner_group_id
    from public.learner_group_member as member
    where member.learner_profile_id in (v_source_id, v_target_id)
  )
  order by learner_group.id
  for update of learner_group;
  perform 1 from public.teacher_learner as relation
  where relation.learner_profile_id in (v_source_id, v_target_id)
  order by relation.teacher_account_id, relation.learner_profile_id
  for update of relation;
  perform 1 from public.course_learner as direct
  where direct.learner_profile_id in (v_source_id, v_target_id)
  order by direct.course_id, direct.learner_profile_id
  for update of direct;
  perform 1 from public.learner_group_member as member
  where member.learner_profile_id in (v_source_id, v_target_id)
  order by member.learner_group_id, member.learner_profile_id
  for update of member;
  perform run.id
  from public.lesson_run as run
  where run.id in (
    select record.lesson_run_id
    from public.learning_record as record
    where record.learner_profile_id in (v_source_id, v_target_id)
      and record.lesson_run_id is not null
  )
  order by run.id
  for update of run;
  perform 1 from public.learning_record as record
  where record.learner_profile_id in (v_source_id, v_target_id)
  order by coalesce(record.lesson_run_id, record.id), record.id
  for update of record;
  perform 1 from public.learner_observer_grant as grant_row
  where grant_row.learner_profile_id = v_source_id
  order by grant_row.id
  for update of grant_row;
  perform 1 from public.learner_ai_consent as consent
  where consent.learner_profile_id = v_source_id
  order by consent.id
  for update of consent;

  v_preview := public.learner_profile_merge_preview_for_actor(
    p_merge_operation_id,
    p_actor_account_id
  );
  if not coalesce((v_preview ->> 'canConfirm')::boolean, false) then
    raise exception 'learner_profile_merge_blocked' using errcode = '55000';
  end if;
  if p_preview_fingerprint is null
    or p_preview_fingerprint <> v_preview ->> 'previewFingerprint'
  then
    raise exception 'learner_profile_merge_preview_stale' using errcode = '40001';
  end if;

  insert into public.learner_profile_merge_private_detail (
    merge_operation_id,
    teacher_account_id,
    discarded_source_display_name
  )
  select p_merge_operation_id, source.teacher_account_id, source.display_name
  from public.teacher_learner as source
  join public.teacher_learner as target
    on target.teacher_account_id = source.teacher_account_id
   and target.learner_profile_id = v_target_id
  where source.learner_profile_id = v_source_id
  on conflict do nothing;

  update public.teacher_learner as target
  set archived_at = case
        when target.archived_at is null or source.archived_at is null then null
        else greatest(target.archived_at, source.archived_at)
      end
  from public.teacher_learner as source
  where target.learner_profile_id = v_target_id
    and source.learner_profile_id = v_source_id
    and source.teacher_account_id = target.teacher_account_id;

  delete from public.teacher_learner as source
  using public.teacher_learner as target
  where source.learner_profile_id = v_source_id
    and target.learner_profile_id = v_target_id
    and target.teacher_account_id = source.teacher_account_id;

  update public.teacher_learner
  set learner_profile_id = v_target_id
  where learner_profile_id = v_source_id;

  insert into public.learner_group_member (learner_group_id, learner_profile_id)
  select learner_group_id, v_target_id
  from public.learner_group_member
  where learner_profile_id = v_source_id
  on conflict do nothing;
  delete from public.learner_group_member where learner_profile_id = v_source_id;

  insert into public.course_learner (course_id, learner_profile_id)
  select course_id, v_target_id
  from public.course_learner
  where learner_profile_id = v_source_id
  on conflict do nothing;
  delete from public.course_learner where learner_profile_id = v_source_id;

  for v_pair in
    select
      source_record.id as source_record_id,
      target_record.id as target_record_id,
      source_record.lesson_run_id
    from public.learning_record as source_record
    join public.learning_record as target_record
      on target_record.lesson_run_id = source_record.lesson_run_id
     and target_record.learner_profile_id = v_target_id
    where source_record.learner_profile_id = v_source_id
      and source_record.lesson_run_id is not null
      and source_record.occurred_at is not null
      and target_record.occurred_at is not null
    order by source_record.lesson_run_id, source_record.id
  loop
    update public.learning_record
    set lesson_run_id = null,
        superseded_by_record_id = v_pair.target_record_id
    where id = v_pair.source_record_id;

    insert into public.learner_profile_merge_conflict (
      merge_operation_id,
      lesson_run_id,
      primary_record_id,
      superseded_record_id,
      resolution
    ) values (
      p_merge_operation_id,
      v_pair.lesson_run_id,
      v_pair.target_record_id,
      v_pair.source_record_id,
      'keep_target_primary'
    ) on conflict do nothing;
  end loop;

  update public.learning_record
  set learner_profile_id = v_target_id
  where learner_profile_id = v_source_id;

  update public.learner_claim_invitation
  set status = 'revoked', revoked_at = now()
  where source_learner_profile_id = v_source_id
    and id is distinct from v_operation.invitation_id
    and status in ('pending', 'bound');

  insert into public.learner_profile_alias (
    source_learner_profile_id,
    target_learner_profile_id,
    merge_operation_id
  ) values (
    v_source_id, v_target_id, p_merge_operation_id
  ) on conflict (source_learner_profile_id) do nothing;

  perform set_config('app.learner_profile_link_mutation', 'on', true);
  delete from public.learner_profile where id = v_source_id;

  update public.learner_profile_merge
  set status = 'completed', completed_at = now()
  where id = p_merge_operation_id;

  update public.learner_claim_invitation
  set status = 'accepted', accepted_at = now()
  where id = v_operation.invitation_id
    and status in ('pending', 'bound');

  perform public.append_learner_identity_audit(
    'learner_profile_merge_completed',
    p_actor_account_id,
    p_actor_account_id,
    v_target_id,
    v_source_id,
    p_merge_operation_id,
    jsonb_build_object(
      'conflictCount', jsonb_array_length(v_preview -> 'conflicts'),
      'projectionVersion', 1
    )
  );

  return v_target_id;
end
$$;

create function public.preview_learner_profile_merge(
  p_merge_operation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_account_id uuid;
begin
  v_actor_account_id := public.current_account_id();
  if v_actor_account_id is null then
    raise exception 'learner_profile_merge_not_found' using errcode = 'P0002';
  end if;
  return public.learner_profile_merge_preview_for_actor(
    p_merge_operation_id, v_actor_account_id
  );
end
$$;

create function public.confirm_learner_profile_merge(
  p_merge_operation_id uuid,
  p_preview_fingerprint text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_account_id uuid;
  v_target_id uuid;
begin
  v_actor_account_id := public.current_account_id();
  if v_actor_account_id is null then
    raise exception 'learner_profile_merge_not_found' using errcode = 'P0002';
  end if;
  v_target_id := public.execute_learner_profile_merge_for_actor(
    p_merge_operation_id, v_actor_account_id, p_preview_fingerprint
  );
  return jsonb_build_object(
    'operationId', p_merge_operation_id,
    'targetLearnerProfileId', v_target_id,
    'completed', true
  );
end
$$;

create function public.cancel_learner_profile_merge(
  p_merge_operation_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_account_id uuid := public.current_account_id();
  v_operation public.learner_profile_merge%rowtype;
begin
  select operation.* into v_operation
  from public.learner_profile_merge as operation
  where operation.id = p_merge_operation_id
    and operation.subject_account_id = v_actor_account_id
  for update of operation;
  if not found then
    raise exception 'learner_profile_merge_not_found' using errcode = 'P0002';
  end if;
  if v_operation.status = 'cancelled' then return; end if;
  if v_operation.status not in ('pending', 'ready') then
    raise exception 'learner_profile_merge_not_available' using errcode = '55000';
  end if;
  update public.learner_profile_merge as operation
  set status = 'cancelled', cancelled_at = now()
  where operation.id = p_merge_operation_id
    and operation.status in ('pending', 'ready');
  update public.learner_claim_invitation
  set status = 'rejected', rejected_at = now()
  where id = v_operation.invitation_id
    and status in ('pending', 'bound');
  perform public.append_learner_identity_audit(
    'learner_profile_merge_cancelled', v_actor_account_id,
    v_actor_account_id, null, null, p_merge_operation_id, '{}'::jsonb
  );
end
$$;

create function public.list_teacher_learner_directory(
  p_status text default 'active'
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor_account_id uuid := public.current_account_id();
  v_result jsonb;
begin
  if p_status not in ('active', 'archived') then
    raise exception 'teacher_learner_status_invalid' using errcode = '22023';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'learnerProfileId', relation.learner_profile_id,
    'teacherAccountId', relation.teacher_account_id,
    'displayName', relation.display_name,
    'archivedAt', relation.archived_at,
    'identityState', case
      when profile.account_id is not null and exists (
        select 1 from public.learner_profile_alias as alias
        where alias.target_learner_profile_id = profile.id
      ) then 'merged'
      when profile.account_id is not null then 'claimed'
      when exists (
        select 1 from public.learner_claim_invitation as invitation
        where invitation.source_learner_profile_id = profile.id
          and invitation.status in ('pending', 'bound')
      ) then 'pending'
      else 'offline'
    end,
    'pendingRequestCount', (
      select count(*)::integer from public.learner_claim_invitation as invitation
      where invitation.source_learner_profile_id = profile.id
        and invitation.status in ('pending', 'bound')
    ),
    'canInvite', profile.account_id is null,
    'canPermanentlyDelete', profile.account_id is null
      and not exists (select 1 from public.learning_record as record where record.learner_profile_id = profile.id)
      and not exists (select 1 from public.teacher_learner as other where other.learner_profile_id = profile.id and other.teacher_account_id <> v_actor_account_id)
      and not exists (select 1 from public.learner_group_member where learner_profile_id = profile.id)
      and not exists (select 1 from public.course_learner where learner_profile_id = profile.id)
      and not exists (select 1 from public.learner_profile_share_code where learner_profile_id = profile.id)
      and not exists (select 1 from public.learner_claim_invitation where source_learner_profile_id = profile.id)
      and not exists (select 1 from public.learner_connection_request where learner_profile_id = profile.id)
      and not exists (select 1 from public.learner_observer_invitation where learner_profile_id = profile.id)
      and not exists (select 1 from public.learner_observer_grant where learner_profile_id = profile.id)
      and not exists (select 1 from public.learner_ai_consent where learner_profile_id = profile.id)
      and not exists (select 1 from public.learner_identity_reconciliation where learner_profile_id = profile.id)
      and not exists (select 1 from public.learner_profile_alias where target_learner_profile_id = profile.id)
      and not exists (select 1 from public.learner_profile_merge where source_learner_profile_id = profile.id or target_learner_profile_id = profile.id),
    'createdAt', relation.created_at,
    'updatedAt', relation.updated_at
  ) order by lower(relation.display_name), relation.learner_profile_id), '[]'::jsonb)
  into v_result
  from public.teacher_learner as relation
  join public.learner_profile as profile on profile.id = relation.learner_profile_id
  where relation.teacher_account_id = v_actor_account_id
    and ((p_status = 'active' and relation.archived_at is null)
      or (p_status = 'archived' and relation.archived_at is not null));
  return v_result;
end
$$;

-- Archiving is a teacher-local detach operation.  It must remove only links
-- owned by the acting teacher and it must do so even on an idempotent retry;
-- restore intentionally recreates none of those audience selections.
create or replace function public.archive_learner_profile(
  p_learner_profile_id uuid
)
returns public.teacher_learner
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_account_id uuid := public.current_account_id();
  v_profile_id uuid := public.resolve_learner_profile_alias(p_learner_profile_id);
  v_relation public.teacher_learner%rowtype;
  v_was_archived boolean;
begin
  if v_actor_account_id is null or v_profile_id is null then
    raise exception 'learner_profile_not_found' using errcode = 'P0002';
  end if;

  -- Match the lock ordering used by audience mutation and merge: Account,
  -- profile, Courses, groups, then the teacher-local relation/link rows.
  perform 1 from public.account as account
  where account.id = v_actor_account_id
  for update of account;
  perform 1 from public.learner_profile as profile
  where profile.id = v_profile_id
  for update of profile;
  perform course.id
  from public.course as course
  where course.owner_account_id = v_actor_account_id
    and (
      exists (
        select 1 from public.course_learner as direct
        where direct.course_id = course.id
          and direct.learner_profile_id = v_profile_id
      )
      or exists (
        select 1
        from public.course_learner_group as course_group
        join public.learner_group_member as member
          on member.learner_group_id = course_group.learner_group_id
        where course_group.course_id = course.id
          and member.learner_profile_id = v_profile_id
      )
    )
  order by course.id
  for update of course;

  perform learner_group.id
  from public.learner_group as learner_group
  where learner_group.owner_account_id = v_actor_account_id
    and exists (
      select 1 from public.learner_group_member as member
      where member.learner_group_id = learner_group.id
        and member.learner_profile_id = v_profile_id
    )
  order by learner_group.id
  for update of learner_group;

  select relation.* into v_relation
  from public.teacher_learner as relation
  where relation.teacher_account_id = v_actor_account_id
    and relation.learner_profile_id = v_profile_id
  for update of relation;
  if not found then
    raise exception 'learner_profile_not_found' using errcode = 'P0002';
  end if;
  v_was_archived := v_relation.archived_at is not null;

  perform 1 from public.course_learner as direct
  where direct.learner_profile_id = v_profile_id
    and exists (
      select 1 from public.course as course
      where course.id = direct.course_id
        and course.owner_account_id = v_actor_account_id
    )
  order by direct.course_id, direct.learner_profile_id
  for update of direct;
  perform 1 from public.learner_group_member as member
  where member.learner_profile_id = v_profile_id
    and exists (
      select 1 from public.learner_group as learner_group
      where learner_group.id = member.learner_group_id
        and learner_group.owner_account_id = v_actor_account_id
    )
  order by member.learner_group_id, member.learner_profile_id
  for update of member;

  delete from public.course_learner as direct
  using public.course as course
  where course.id = direct.course_id
    and course.owner_account_id = v_actor_account_id
    and direct.learner_profile_id = v_profile_id;

  delete from public.learner_group_member as member
  using public.learner_group as learner_group
  where learner_group.id = member.learner_group_id
    and learner_group.owner_account_id = v_actor_account_id
    and member.learner_profile_id = v_profile_id;

  update public.teacher_learner as relation
  set archived_at = coalesce(relation.archived_at, now())
  where relation.teacher_account_id = v_actor_account_id
    and relation.learner_profile_id = v_profile_id
  returning relation.* into v_relation;

  if not v_was_archived then
    perform public.append_learner_identity_audit(
      'teacher_learner_archived', v_actor_account_id,
      (select profile.account_id from public.learner_profile as profile where profile.id = v_profile_id),
      v_profile_id, null, null,
      jsonb_build_object('projectionVersion', 1)
    );
  end if;

  return v_relation;
end
$$;

create function public.restore_teacher_learner(
  p_learner_profile_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_account_id uuid := public.current_account_id();
  v_relation public.teacher_learner%rowtype;
  v_profile public.learner_profile%rowtype;
begin
  update public.teacher_learner as relation
  set archived_at = null
  where relation.teacher_account_id = v_actor_account_id
    and relation.learner_profile_id = public.resolve_learner_profile_alias(p_learner_profile_id)
    and relation.archived_at is not null
  returning relation.* into v_relation;
  if not found then
    raise exception 'learner_profile_not_found' using errcode = 'P0002';
  end if;
  select * into v_profile from public.learner_profile where id = v_relation.learner_profile_id;
  perform public.append_learner_identity_audit(
    'teacher_learner_restored', v_actor_account_id, v_profile.account_id,
    v_profile.id, null, null, '{}'::jsonb
  );
  return jsonb_build_object(
    'learnerProfileId', v_relation.learner_profile_id,
    'teacherAccountId', v_relation.teacher_account_id,
    'displayName', v_relation.display_name,
    'archivedAt', v_relation.archived_at,
    'identityState', case
      when v_profile.account_id is null then 'offline'
      when exists (
        select 1 from public.learner_profile_alias as alias
        where alias.target_learner_profile_id = v_profile.id
      ) then 'merged'
      else 'claimed'
    end,
    'pendingRequestCount', 0,
    'canInvite', v_profile.account_id is null,
    'canPermanentlyDelete', false,
    'createdAt', v_relation.created_at,
    'updatedAt', v_relation.updated_at
  );
end
$$;

create function public.delete_empty_offline_learner_profile(
  p_learner_profile_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_account_id uuid := public.current_account_id();
  v_profile public.learner_profile%rowtype;
begin
  select profile.* into v_profile
  from public.learner_profile as profile
  join public.teacher_learner as relation
    on relation.learner_profile_id = profile.id
   and relation.teacher_account_id = v_actor_account_id
  where profile.id = p_learner_profile_id
  for update of profile;
  if not found then
    raise exception 'learner_profile_not_found' using errcode = 'P0002';
  end if;
  if v_profile.account_id is not null
    or exists (select 1 from public.learning_record where learner_profile_id = v_profile.id)
    or exists (select 1 from public.teacher_learner where learner_profile_id = v_profile.id and teacher_account_id <> v_actor_account_id)
    or exists (select 1 from public.learner_group_member where learner_profile_id = v_profile.id)
    or exists (select 1 from public.course_learner where learner_profile_id = v_profile.id)
    or exists (select 1 from public.learner_profile_share_code where learner_profile_id = v_profile.id)
    or exists (select 1 from public.learner_claim_invitation where source_learner_profile_id = v_profile.id)
    or exists (select 1 from public.learner_connection_request where learner_profile_id = v_profile.id)
    or exists (select 1 from public.learner_observer_invitation where learner_profile_id = v_profile.id)
    or exists (select 1 from public.learner_observer_grant where learner_profile_id = v_profile.id)
    or exists (select 1 from public.learner_ai_consent where learner_profile_id = v_profile.id)
    or exists (select 1 from public.learner_identity_reconciliation where learner_profile_id = v_profile.id)
    or exists (select 1 from public.learner_profile_alias where target_learner_profile_id = v_profile.id)
    or exists (select 1 from public.learner_profile_merge where source_learner_profile_id = v_profile.id or target_learner_profile_id = v_profile.id)
  then
    raise exception 'learner_profile_not_empty' using errcode = '55000';
  end if;
  perform public.append_learner_identity_audit(
    'offline_learner_profile_deleted', v_actor_account_id, null,
    v_profile.id, null, null, '{}'::jsonb
  );
  delete from public.learner_profile where id = v_profile.id;
end
$$;

create function public.resolve_teacher_learner_profile_alias(
  p_actor_auth_user_id uuid,
  p_learner_profile_id uuid
)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor_account_id uuid := public.account_id_for_auth_user(p_actor_auth_user_id);
  v_target_id uuid := public.resolve_learner_profile_alias(p_learner_profile_id);
begin
  if v_target_id is null or not exists (
    select 1 from public.teacher_learner as relation
    where relation.teacher_account_id = v_actor_account_id
      and relation.learner_profile_id = v_target_id
  ) then
    raise exception 'learner_profile_not_found' using errcode = 'P0002';
  end if;
  return v_target_id;
end
$$;

create function public.rotate_my_learner_share_code(
  p_actor_auth_user_id uuid,
  p_code_digest bytea,
  p_expires_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_account_id uuid := public.account_id_for_auth_user(p_actor_auth_user_id);
  v_profile_id uuid;
  v_row public.learner_profile_share_code%rowtype;
  v_expired_code public.learner_profile_share_code%rowtype;
begin
  if v_actor_account_id is null
    or p_code_digest is null or octet_length(p_code_digest) <> 32
    or p_expires_at <= now() or p_expires_at > now() + interval '30 days'
  then
    raise exception 'learner_share_code_invalid' using errcode = '22023';
  end if;
  select profile.id into v_profile_id
  from public.learner_profile as profile
  where profile.account_id = v_actor_account_id
  for update of profile;
  if not found then
    raise exception 'learner_profile_not_found' using errcode = 'P0002';
  end if;

  for v_expired_code in
    update public.learner_profile_share_code as code
    set status = 'expired'
    where code.learner_profile_id = v_profile_id
      and code.status = 'active' and code.expires_at <= now()
    returning code.*
  loop
    perform public.append_learner_identity_audit(
      'learner_share_code_expired', v_actor_account_id, v_actor_account_id,
      v_profile_id, null, v_expired_code.id,
      jsonb_build_object(
        'expiredAt', v_expired_code.expires_at,
        'projectionVersion', 1
      )
    );
  end loop;
  update public.learner_profile_share_code
  set status = 'revoked', revoked_at = now()
  where learner_profile_id = v_profile_id and status = 'active';
  insert into public.learner_profile_share_code (
    learner_profile_id, code_digest, expires_at
  ) values (v_profile_id, p_code_digest, p_expires_at)
  returning * into v_row;
  perform public.append_learner_identity_audit(
    'learner_share_code_rotated', v_actor_account_id, v_actor_account_id,
    v_profile_id, null, v_row.id,
    jsonb_build_object('expiresAt', p_expires_at, 'projectionVersion', 1)
  );
  return jsonb_build_object(
    'expiresAt', v_row.expires_at,
    'createdAt', v_row.created_at
  );
end
$$;

create function public.create_learner_connection_request(
  p_actor_auth_user_id uuid,
  p_method text,
  p_code_or_email_digest bytea,
  p_token_digest bytea,
  p_target_learner_profile_id uuid,
  p_local_display_name text,
  p_expires_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_account_id uuid := public.account_id_for_auth_user(p_actor_auth_user_id);
  v_target_profile_id uuid := p_target_learner_profile_id;
  v_recipient_account_id uuid;
  v_share_code_id uuid;
  v_request public.learner_connection_request%rowtype;
  v_expired_request public.learner_connection_request%rowtype;
begin
  if v_actor_account_id is null
    or p_method not in ('share_code', 'email', 'exact_handle')
    or p_code_or_email_digest is null or octet_length(p_code_or_email_digest) <> 32
    or p_local_display_name is null or btrim(p_local_display_name) = ''
    or char_length(btrim(p_local_display_name)) > 160
    or p_expires_at <= now() or p_expires_at > now() + interval '30 days'
    or (p_method = 'email' and (p_token_digest is null or octet_length(p_token_digest) <> 32))
    or (p_method <> 'email' and p_token_digest is not null)
  then
    raise exception 'learner_connection_request_invalid' using errcode = '22023';
  end if;

  if not public.learner_identity_rate_limit_hit(
    'connection_create', extensions.digest(v_actor_account_id::text, 'sha256'),
    20, interval '1 hour', interval '1 hour'
  ) then
    raise exception 'learner_identity_rate_limited' using errcode = 'P0001';
  end if;

  if p_method = 'share_code' then
    select code.id, code.learner_profile_id
    into v_share_code_id, v_target_profile_id
    from public.learner_profile_share_code as code
    where code.code_digest = p_code_or_email_digest
      and code.status = 'active'
      and code.expires_at > now()
    for update of code;
    if not found then
      raise exception 'learner_connection_target_unavailable' using errcode = 'P0002';
    end if;
    update public.learner_profile_share_code
    set status = 'used', used_at = now()
    where id = v_share_code_id;
  elsif p_method = 'exact_handle' then
    if v_target_profile_id is null then
      raise exception 'learner_connection_target_unavailable' using errcode = 'P0002';
    end if;
  end if;

  if v_target_profile_id is not null then
    select profile.account_id into v_recipient_account_id
    from public.learner_profile as profile
    where profile.id = v_target_profile_id
    for update of profile;
    if not found or v_recipient_account_id = v_actor_account_id then
      raise exception 'learner_connection_target_unavailable' using errcode = 'P0002';
    end if;
  end if;

  for v_expired_request in
    update public.learner_connection_request as request
    set status = 'expired', acted_at = now(), updated_at = now()
    where request.teacher_account_id = v_actor_account_id
      and request.status = 'pending'
      and request.expires_at <= now()
      and (
        (p_method = 'email' and request.method = 'email'
          and request.recipient_email_digest = p_code_or_email_digest)
        or (v_target_profile_id is not null
          and request.learner_profile_id = v_target_profile_id)
      )
    returning request.*
  loop
    perform public.append_learner_identity_audit(
      'learner_connection_expired', v_actor_account_id,
      v_expired_request.recipient_account_id,
      v_expired_request.learner_profile_id, null, v_expired_request.id,
      jsonb_build_object(
        'method', v_expired_request.method,
        'expiredAt', v_expired_request.expires_at,
        'projectionVersion', 1
      )
    );
  end loop;

  insert into public.learner_connection_request (
    teacher_account_id,
    learner_profile_id,
    share_code_id,
    recipient_account_id,
    method,
    recipient_email_digest,
    token_digest,
    local_display_name,
    expires_at
  ) values (
    v_actor_account_id,
    v_target_profile_id,
    v_share_code_id,
    v_recipient_account_id,
    p_method,
    case when p_method = 'email' then p_code_or_email_digest else null end,
    p_token_digest,
    btrim(p_local_display_name),
    p_expires_at
  ) returning * into v_request;

  perform public.append_learner_identity_audit(
    'learner_connection_requested', v_actor_account_id,
    v_recipient_account_id, v_target_profile_id, null, v_request.id,
    jsonb_build_object('method', p_method, 'projectionVersion', 1)
  );

  return jsonb_build_object(
    'id', v_request.id,
    'direction', 'outgoing',
    'status', v_request.status,
    'method', v_request.method,
    'counterpartyLabel', case when v_target_profile_id is null
      then 'Приглашение отправлено'
      else (select display_name from public.learner_profile where id = v_target_profile_id)
    end,
    'localDisplayName', v_request.local_display_name,
    'learnerProfileId', v_target_profile_id,
    'expiresAt', v_request.expires_at,
    'createdAt', v_request.created_at,
    'acceptedAt', v_request.accepted_at
  );
exception
  when unique_violation then
    raise exception 'learner_connection_request_already_pending' using errcode = '23505';
end
$$;

create function public.list_learner_connection_requests()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_account_id uuid := public.current_account_id();
  v_profile_id uuid := public.current_owned_learner_profile_id();
  v_result jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', request.id,
    'direction', case when request.teacher_account_id = v_actor_account_id then 'outgoing' else 'incoming' end,
    'status', case when request.status = 'pending' and request.expires_at <= now() then 'expired' else request.status end,
    'method', request.method,
    'counterpartyLabel', case
      when request.teacher_account_id = v_actor_account_id
        then coalesce(profile.display_name, 'Приглашение по email')
      else teacher.display_name
    end,
    'localDisplayName', request.local_display_name,
    'learnerProfileId', request.learner_profile_id,
    'expiresAt', request.expires_at,
    'createdAt', request.created_at,
    'acceptedAt', request.accepted_at
  ) order by request.created_at desc), '[]'::jsonb)
  into v_result
  from public.learner_connection_request as request
  join public.account as teacher on teacher.id = request.teacher_account_id
  left join public.learner_profile as profile on profile.id = request.learner_profile_id
  where request.teacher_account_id = v_actor_account_id
    or (request.learner_profile_id = v_profile_id and request.method <> 'email')
    or request.recipient_account_id = v_actor_account_id;
  return v_result;
end
$$;

create function public.act_on_learner_connection_request(
  p_connection_request_id uuid,
  p_action text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_account_id uuid := public.current_account_id();
  v_profile_id uuid := public.current_owned_learner_profile_id();
  v_request public.learner_connection_request%rowtype;
  v_direction text;
begin
  if not public.learner_identity_rate_limit_hit(
    'connection_action',
    extensions.digest(
      coalesce(v_actor_account_id::text, '') || ':' || p_connection_request_id::text,
      'sha256'
    ),
    60, interval '1 hour', interval '1 hour'
  ) then
    raise exception 'learner_identity_rate_limited' using errcode = 'P0001';
  end if;
  select request.* into v_request
  from public.learner_connection_request as request
  where request.id = p_connection_request_id
  for update of request;
  if not found then
    raise exception 'learner_connection_request_not_found' using errcode = 'P0002';
  end if;

  if v_request.status in ('accepted', 'rejected', 'cancelled') then
    if v_request.teacher_account_id = v_actor_account_id
      and v_request.status = 'cancelled' and p_action = 'cancel'
    then
      v_direction := 'outgoing';
    elsif v_request.learner_profile_id = v_profile_id
      and (v_request.method <> 'email'
        or v_request.recipient_account_id = v_actor_account_id)
      and ((v_request.status = 'accepted' and p_action = 'accept')
        or (v_request.status = 'rejected' and p_action = 'reject'))
    then
      v_direction := 'incoming';
    else
      raise exception 'learner_connection_request_not_found' using errcode = 'P0002';
    end if;
    return jsonb_build_object(
      'id', v_request.id, 'direction', v_direction, 'status', v_request.status,
      'method', v_request.method,
      'counterpartyLabel', case when v_direction = 'incoming'
        then (select display_name from public.account where id = v_request.teacher_account_id)
        else coalesce((select display_name from public.learner_profile where id = v_request.learner_profile_id), 'Приглашение') end,
      'localDisplayName', v_request.local_display_name,
      'learnerProfileId', v_request.learner_profile_id,
      'expiresAt', v_request.expires_at, 'createdAt', v_request.created_at,
      'acceptedAt', v_request.accepted_at
    );
  end if;

  if v_request.status <> 'pending' or v_request.expires_at <= now() then
    raise exception 'learner_connection_request_not_found' using errcode = 'P0002';
  end if;

  if v_request.teacher_account_id = v_actor_account_id then
    if p_action <> 'cancel' then
      raise exception 'learner_connection_action_not_allowed' using errcode = '42501';
    end if;
    v_direction := 'outgoing';
    update public.learner_connection_request
    set status = 'cancelled', acted_at = now()
    where id = v_request.id returning * into v_request;
  else
    if v_request.learner_profile_id is distinct from v_profile_id
      or (v_request.method = 'email'
        and v_request.recipient_account_id is distinct from v_actor_account_id)
      or p_action not in ('accept', 'reject')
    then
      raise exception 'learner_connection_request_not_found' using errcode = 'P0002';
    end if;
    v_direction := 'incoming';
    if p_action = 'accept' then
      insert into public.teacher_learner (
        teacher_account_id, learner_profile_id, display_name
      ) values (
        v_request.teacher_account_id, v_profile_id, v_request.local_display_name
      )
      on conflict (teacher_account_id, learner_profile_id) do update
        set archived_at = null;
      update public.learner_connection_request
      set status = 'accepted', accepted_at = now(), acted_at = now(),
          recipient_account_id = v_actor_account_id
      where id = v_request.id returning * into v_request;
    else
      update public.learner_connection_request
      set status = 'rejected', acted_at = now(),
          recipient_account_id = v_actor_account_id
      where id = v_request.id returning * into v_request;
    end if;
  end if;

  perform public.append_learner_identity_audit(
    'learner_connection_' || v_request.status,
    v_actor_account_id, v_request.recipient_account_id,
    v_request.learner_profile_id, null, v_request.id,
    jsonb_build_object('method', v_request.method, 'projectionVersion', 1)
  );
  return jsonb_build_object(
    'id', v_request.id, 'direction', v_direction, 'status', v_request.status,
    'method', v_request.method,
    'counterpartyLabel', case when v_direction = 'incoming'
      then (select display_name from public.account where id = v_request.teacher_account_id)
      else coalesce((select display_name from public.learner_profile where id = v_request.learner_profile_id), 'Приглашение') end,
    'localDisplayName', v_request.local_display_name,
    'learnerProfileId', v_request.learner_profile_id,
    'expiresAt', v_request.expires_at, 'createdAt', v_request.created_at,
    'acceptedAt', v_request.accepted_at
  );
end
$$;

create function public.preview_email_learner_connection_request(
  p_actor_auth_user_id uuid,
  p_connection_request_id uuid,
  p_token_digest bytea,
  p_recipient_email_digest bytea
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_account_id uuid := public.account_id_for_auth_user(p_actor_auth_user_id);
  v_profile_id uuid;
  v_request public.learner_connection_request%rowtype;
begin
  if octet_length(p_token_digest) <> 32 or octet_length(p_recipient_email_digest) <> 32 then
    raise exception 'learner_connection_request_not_found' using errcode = 'P0002';
  end if;
  if not public.learner_identity_rate_limit_hit(
    'connection_email_preview',
    extensions.digest(
      coalesce(v_actor_account_id::text, '') || ':' || p_connection_request_id::text,
      'sha256'
    ),
    60, interval '1 hour', interval '1 hour'
  ) then
    raise exception 'learner_identity_rate_limited' using errcode = 'P0001';
  end if;
  select profile.id into v_profile_id
  from public.learner_profile as profile
  where profile.account_id = v_actor_account_id
  for update of profile;
  select request.* into v_request
  from public.learner_connection_request as request
  where request.id = p_connection_request_id
    and request.method = 'email'
    and request.token_digest = p_token_digest
    and request.recipient_email_digest = p_recipient_email_digest
    and (request.recipient_account_id is null or request.recipient_account_id = v_actor_account_id)
  for update of request;
  if not found or v_profile_id is null then
    raise exception 'learner_connection_request_not_found' using errcode = 'P0002';
  end if;
  if v_request.status in ('accepted', 'rejected')
    and v_request.recipient_account_id = v_actor_account_id
  then
    return jsonb_build_object(
      'id', v_request.id,
      'kind', 'connection',
      'title', 'Добавление в список учеников',
      'status', v_request.status,
      'inviterLabel', (select display_name from public.account where id = v_request.teacher_account_id),
      'relationshipLabel', null,
      'expiresAt', v_request.expires_at,
      'canAccept', false
    );
  end if;
  if v_request.status <> 'pending' or v_request.expires_at <= now() then
    raise exception 'learner_connection_request_not_found' using errcode = 'P0002';
  end if;
  update public.learner_connection_request
  set recipient_account_id = v_actor_account_id,
      learner_profile_id = v_profile_id
  where id = v_request.id
  returning * into v_request;
  return jsonb_build_object(
    'id', v_request.id,
    'kind', 'connection',
    'title', 'Добавление в список учеников',
    'status', v_request.status,
    'inviterLabel', (select display_name from public.account where id = v_request.teacher_account_id),
    'relationshipLabel', null,
    'expiresAt', v_request.expires_at,
    'canAccept', true
  );
end
$$;

create function public.act_on_email_learner_connection_request(
  p_actor_auth_user_id uuid,
  p_connection_request_id uuid,
  p_action text,
  p_token_digest bytea,
  p_recipient_email_digest bytea
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_account_id uuid := public.account_id_for_auth_user(p_actor_auth_user_id);
  v_preview jsonb;
  v_profile_id uuid;
  v_request public.learner_connection_request%rowtype;
begin
  if p_action not in ('accept', 'reject') then
    raise exception 'learner_connection_action_not_allowed' using errcode = '22023';
  end if;
  if not public.learner_identity_rate_limit_hit(
    'connection_email_action',
    extensions.digest(
      coalesce(v_actor_account_id::text, '') || ':' || p_connection_request_id::text,
      'sha256'
    ),
    30, interval '1 hour', interval '1 hour'
  ) then
    raise exception 'learner_identity_rate_limited' using errcode = 'P0001';
  end if;
  select * into v_request
  from public.learner_connection_request
  where id = p_connection_request_id
    and method = 'email'
    and token_digest = p_token_digest
    and recipient_email_digest = p_recipient_email_digest
    and recipient_account_id = v_actor_account_id
  for update;
  if found and (
    (v_request.status = 'accepted' and p_action = 'accept')
    or (v_request.status = 'rejected' and p_action = 'reject')
  ) then
    return jsonb_build_object(
      'id', v_request.id, 'kind', 'connection',
      'title', 'Добавление в список учеников',
      'status', v_request.status,
      'inviterLabel', (select display_name from public.account where id = v_request.teacher_account_id),
      'relationshipLabel', null, 'expiresAt', v_request.expires_at,
      'canAccept', false
    );
  elsif found and v_request.status in ('accepted', 'rejected') then
    raise exception 'learner_connection_action_already_final' using errcode = '55000';
  end if;
  v_preview := public.preview_email_learner_connection_request(
    p_actor_auth_user_id, p_connection_request_id,
    p_token_digest, p_recipient_email_digest
  );
  select profile.id into v_profile_id from public.learner_profile as profile
  where profile.account_id = v_actor_account_id;
  select * into v_request from public.learner_connection_request
  where id = p_connection_request_id for update;
  if p_action = 'accept' then
    insert into public.teacher_learner (
      teacher_account_id, learner_profile_id, display_name
    ) values (
      v_request.teacher_account_id, v_profile_id, v_request.local_display_name
    ) on conflict (teacher_account_id, learner_profile_id) do update
      set archived_at = null;
  end if;
  update public.learner_connection_request
  set status = case when p_action = 'accept' then 'accepted' else 'rejected' end,
      accepted_at = case when p_action = 'accept' then now() else null end,
      acted_at = now()
  where id = p_connection_request_id returning * into v_request;
  perform public.append_learner_identity_audit(
    'learner_connection_' || v_request.status,
    v_actor_account_id, v_actor_account_id, v_profile_id, null,
    v_request.id, jsonb_build_object('method', 'email', 'projectionVersion', 1)
  );
  return v_preview || jsonb_build_object(
    'status', v_request.status,
    'canAccept', false
  );
end
$$;

create function public.preview_verified_email_learner_connection_request(
  p_actor_auth_user_id uuid,
  p_request_id uuid,
  p_recipient_email_digest bytea
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_account_id uuid := public.account_id_for_auth_user(p_actor_auth_user_id);
  v_request public.learner_connection_request%rowtype;
  v_was_unbound boolean;
begin
  if v_actor_account_id is null
    or p_recipient_email_digest is null
    or octet_length(p_recipient_email_digest) <> 32
  then
    raise exception 'learner_connection_request_not_found' using errcode = 'P0002';
  end if;
  select request.* into v_request
  from public.learner_connection_request as request
  where request.id = p_request_id
    and request.method = 'email'
    and request.recipient_email_digest = p_recipient_email_digest
    and (request.recipient_account_id is null
      or request.recipient_account_id = v_actor_account_id)
  for update of request;
  if not found then
    raise exception 'learner_connection_request_not_found' using errcode = 'P0002';
  end if;
  if v_request.status in ('accepted', 'rejected') then
    if v_request.recipient_account_id is distinct from v_actor_account_id then
      raise exception 'learner_connection_request_not_found' using errcode = 'P0002';
    end if;
  elsif v_request.status = 'pending' and v_request.expires_at > now() then
    v_was_unbound := v_request.recipient_account_id is null;
    update public.learner_connection_request as request
    set recipient_account_id = v_actor_account_id,
        updated_at = now()
    where request.id = v_request.id
      and (request.recipient_account_id is null
        or request.recipient_account_id = v_actor_account_id)
    returning request.* into v_request;
    if not found then
      raise exception 'learner_connection_request_not_found' using errcode = 'P0002';
    end if;
    if v_was_unbound then
      perform public.append_learner_identity_audit(
        'learner_connection_verified_email_bound', v_actor_account_id,
        v_actor_account_id, v_request.learner_profile_id,
        null, v_request.id,
        jsonb_build_object('method', 'email', 'projectionVersion', 1)
      );
    end if;
  else
    raise exception 'learner_connection_request_not_found' using errcode = 'P0002';
  end if;
  return public.preview_email_learner_connection_request(
    p_actor_auth_user_id, v_request.id,
    v_request.token_digest, p_recipient_email_digest
  );
end
$$;

create function public.act_on_verified_email_learner_connection_request(
  p_actor_auth_user_id uuid,
  p_request_id uuid,
  p_action text,
  p_recipient_email_digest bytea
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_account_id uuid := public.account_id_for_auth_user(p_actor_auth_user_id);
  v_request public.learner_connection_request%rowtype;
begin
  perform public.preview_verified_email_learner_connection_request(
    p_actor_auth_user_id, p_request_id,
    p_recipient_email_digest
  );
  select request.* into v_request
  from public.learner_connection_request as request
  where request.id = p_request_id
    and request.method = 'email'
    and request.recipient_account_id = v_actor_account_id
    and request.recipient_email_digest = p_recipient_email_digest
  for update of request;
  if not found then
    raise exception 'learner_connection_request_not_found' using errcode = 'P0002';
  end if;
  return public.act_on_email_learner_connection_request(
    p_actor_auth_user_id, p_request_id, p_action,
    v_request.token_digest, p_recipient_email_digest
  );
end
$$;

create function public.create_learner_profile_invitation(
  p_actor_auth_user_id uuid,
  p_learner_profile_id uuid,
  p_kind text,
  p_recipient_email_digest bytea,
  p_token_digest bytea,
  p_expires_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_account_id uuid := public.account_id_for_auth_user(p_actor_auth_user_id);
  v_profile public.learner_profile%rowtype;
  v_invitation public.learner_claim_invitation%rowtype;
  v_expired_invitation public.learner_claim_invitation%rowtype;
begin
  if p_kind not in ('claim', 'child_activation')
    or octet_length(p_recipient_email_digest) <> 32
    or octet_length(p_token_digest) <> 32
    or p_expires_at <= now() or p_expires_at > now() + interval '30 days'
  then
    raise exception 'learner_profile_invitation_invalid' using errcode = '22023';
  end if;
  if not public.learner_identity_rate_limit_hit(
    'profile_invitation_create', extensions.digest(v_actor_account_id::text, 'sha256'),
    20, interval '1 hour', interval '1 hour'
  ) then
    raise exception 'learner_identity_rate_limited' using errcode = 'P0001';
  end if;
  select profile.* into v_profile
  from public.learner_profile as profile
  join public.teacher_learner as relation
    on relation.learner_profile_id = profile.id
   and relation.teacher_account_id = v_actor_account_id
   and relation.archived_at is null
  where profile.id = p_learner_profile_id
  for update of profile;
  if not found or v_profile.account_id is not null then
    raise exception 'learner_profile_not_available' using errcode = 'P0002';
  end if;
  for v_expired_invitation in
    update public.learner_claim_invitation as invitation
    set status = 'expired', updated_at = now()
    where invitation.source_learner_profile_id = v_profile.id
      and invitation.kind = p_kind
      and invitation.status in ('pending', 'bound')
      and invitation.expires_at <= now()
    returning invitation.*
  loop
    update public.learner_profile_merge
    set status = 'cancelled', cancelled_at = now(), updated_at = now()
    where invitation_id = v_expired_invitation.id
      and status in ('pending', 'ready');
    perform public.append_learner_identity_audit(
      'learner_profile_invitation_expired', v_actor_account_id,
      v_expired_invitation.recipient_account_id,
      v_profile.id, null, v_expired_invitation.id,
      jsonb_build_object(
        'kind', v_expired_invitation.kind,
        'expiredAt', v_expired_invitation.expires_at,
        'projectionVersion', 1
      )
    );
  end loop;
  insert into public.learner_claim_invitation (
    source_learner_profile_id, inviter_account_id, recipient_email_digest,
    token_digest, kind, expires_at
  ) values (
    v_profile.id, v_actor_account_id, p_recipient_email_digest,
    p_token_digest, p_kind, p_expires_at
  ) returning * into v_invitation;
  perform public.append_learner_identity_audit(
    'learner_profile_invitation_created', v_actor_account_id, null,
    v_profile.id, null, v_invitation.id,
    jsonb_build_object('kind', p_kind, 'projectionVersion', 1)
  );
  return jsonb_build_object(
    'id', v_invitation.id, 'kind', v_invitation.kind,
    'status', v_invitation.status, 'learnerProfileId', v_profile.id,
    'learnerLabel', v_profile.display_name,
    'inviterLabel', (select display_name from public.account where id = v_actor_account_id),
    'expiresAt', v_invitation.expires_at, 'createdAt', v_invitation.created_at,
    'acceptedAt', v_invitation.accepted_at
  );
exception
  when unique_violation then
    raise exception 'learner_profile_invitation_already_pending' using errcode = '23505';
end
$$;

create function public.list_learner_profile_invitations(
  p_learner_profile_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor_account_id uuid := public.current_account_id();
  v_result jsonb;
begin
  if not exists (
    select 1 from public.teacher_learner as relation
    where relation.teacher_account_id = v_actor_account_id
      and relation.learner_profile_id = p_learner_profile_id
  ) then
    raise exception 'learner_profile_not_found' using errcode = 'P0002';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', invitation.id, 'kind', invitation.kind,
    'status', case when invitation.status in ('pending','bound') and invitation.expires_at <= now()
      then 'expired' else invitation.status end,
    'learnerProfileId', invitation.source_learner_profile_id,
    'learnerLabel', profile.display_name,
    'inviterLabel', inviter.display_name,
    'expiresAt', invitation.expires_at, 'createdAt', invitation.created_at,
    'acceptedAt', invitation.accepted_at
  ) order by invitation.created_at desc), '[]'::jsonb)
  into v_result
  from public.learner_claim_invitation as invitation
  join public.account as inviter on inviter.id = invitation.inviter_account_id
  left join public.learner_profile as profile on profile.id = invitation.source_learner_profile_id
  where invitation.source_learner_profile_id = p_learner_profile_id
    and invitation.inviter_account_id = v_actor_account_id;
  return v_result;
end
$$;

create function public.revoke_learner_profile_invitation(
  p_invitation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_account_id uuid := public.current_account_id();
  v_invitation public.learner_claim_invitation%rowtype;
begin
  if not public.learner_identity_rate_limit_hit(
    'profile_invitation_revoke',
    extensions.digest(
      coalesce(v_actor_account_id::text, '') || ':' || p_invitation_id::text,
      'sha256'
    ),
    30, interval '1 hour', interval '1 hour'
  ) then
    raise exception 'learner_identity_rate_limited' using errcode = 'P0001';
  end if;
  update public.learner_claim_invitation as invitation
  set status = 'revoked', revoked_at = now(), token_digest = token_digest
  where invitation.id = p_invitation_id
    and invitation.inviter_account_id = v_actor_account_id
    and invitation.status in ('pending', 'bound')
  returning invitation.* into v_invitation;
  if not found then
    raise exception 'learner_profile_invitation_not_found' using errcode = 'P0002';
  end if;
  update public.learner_profile_merge
  set status = 'cancelled', cancelled_at = now()
  where invitation_id = v_invitation.id and status in ('pending', 'ready');
  perform public.append_learner_identity_audit(
    'learner_profile_invitation_revoked', v_actor_account_id,
    v_invitation.recipient_account_id, v_invitation.source_learner_profile_id,
    null, v_invitation.id,
    jsonb_build_object('kind', v_invitation.kind, 'projectionVersion', 1)
  );
  return jsonb_build_object(
    'id', v_invitation.id, 'kind', v_invitation.kind,
    'status', v_invitation.status,
    'learnerProfileId', v_invitation.source_learner_profile_id,
    'learnerLabel', coalesce((select display_name from public.learner_profile where id = v_invitation.source_learner_profile_id), 'Учебный профиль'),
    'inviterLabel', (select display_name from public.account where id = v_actor_account_id),
    'expiresAt', v_invitation.expires_at, 'createdAt', v_invitation.created_at,
    'acceptedAt', v_invitation.accepted_at
  );
end
$$;

create function public.preview_learner_profile_invitation(
  p_actor_auth_user_id uuid,
  p_invitation_id uuid,
  p_token_digest bytea,
  p_recipient_email_digest bytea
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_account_id uuid := public.account_id_for_auth_user(p_actor_auth_user_id);
  v_target_profile_id uuid;
  v_source_profile public.learner_profile%rowtype;
  v_invitation public.learner_claim_invitation%rowtype;
  v_operation_id uuid;
  v_operation public.learner_profile_merge%rowtype;
  v_merge_preview jsonb;
begin
  if v_actor_account_id is null
    or octet_length(p_token_digest) <> 32
    or octet_length(p_recipient_email_digest) <> 32
  then
    raise exception 'learner_profile_invitation_not_found' using errcode = 'P0002';
  end if;
  if not public.learner_identity_rate_limit_hit(
    'profile_invitation_preview',
    extensions.digest(
      v_actor_account_id::text || ':' || p_invitation_id::text,
      'sha256'
    ),
    60, interval '1 hour', interval '1 hour'
  ) then
    raise exception 'learner_identity_rate_limited' using errcode = 'P0001';
  end if;
  select invitation.* into v_invitation
  from public.learner_claim_invitation as invitation
  where invitation.id = p_invitation_id
    and invitation.token_digest = p_token_digest
    and invitation.recipient_email_digest = p_recipient_email_digest
    and (invitation.recipient_account_id is null
      or invitation.recipient_account_id = v_actor_account_id)
  for update of invitation;
  if not found then
    raise exception 'learner_profile_invitation_not_found' using errcode = 'P0002';
  end if;

  if v_invitation.status in ('accepted', 'rejected')
    and v_invitation.recipient_account_id = v_actor_account_id
  then
    select operation.* into v_operation
    from public.learner_profile_merge as operation
    where operation.invitation_id = v_invitation.id;
    return jsonb_build_object(
      'invitation', jsonb_build_object(
        'id', v_invitation.id,
        'kind', v_invitation.kind,
        'status', v_invitation.status,
        'learnerProfileId', coalesce(
          v_operation.target_learner_profile_id,
          v_invitation.source_learner_profile_id
        ),
        'learnerLabel', coalesce((
          select profile.display_name from public.learner_profile as profile
          where profile.id = v_operation.target_learner_profile_id
        ), 'Учебный профиль'),
        'inviterLabel', (
          select account.display_name from public.account as account
          where account.id = v_invitation.inviter_account_id
        ),
        'expiresAt', v_invitation.expires_at,
        'createdAt', v_invitation.created_at,
        'acceptedAt', v_invitation.accepted_at
      ),
      'mergePreview', v_operation.preview_payload,
      'completed', v_invitation.status = 'accepted',
      'childAccountLogin', case when v_invitation.kind = 'child_activation' then (
        select alias.normalized_login
        from public.account_login_alias as alias
        where alias.account_id = v_operation.subject_account_id
          and alias.revoked_at is null
        order by alias.created_at desc limit 1
      ) else null end,
      'observerInvitationId', case when v_invitation.kind = 'child_activation' then (
        select observer_invitation.id
        from public.learner_observer_invitation as observer_invitation
        where observer_invitation.learner_profile_id = v_operation.target_learner_profile_id
          and observer_invitation.subject_account_id = v_operation.subject_account_id
          and observer_invitation.recipient_account_id = v_actor_account_id
        order by observer_invitation.created_at desc limit 1
      ) else null end
    );
  end if;

  if v_invitation.status not in ('pending', 'bound')
    or v_invitation.expires_at <= now()
  then
    raise exception 'learner_profile_invitation_not_found' using errcode = 'P0002';
  end if;
  select profile.* into v_source_profile
  from public.learner_profile as profile
  where profile.id = v_invitation.source_learner_profile_id
    and profile.account_id is null
  for update of profile;
  if not found then
    raise exception 'learner_profile_invitation_not_found' using errcode = 'P0002';
  end if;
  select profile.id into v_target_profile_id
  from public.learner_profile as profile
  where profile.account_id = v_actor_account_id
  for update of profile;
  if not found or v_target_profile_id = v_source_profile.id then
    raise exception 'learner_profile_invitation_not_found' using errcode = 'P0002';
  end if;

  update public.learner_claim_invitation
  set recipient_account_id = v_actor_account_id,
      status = 'bound'
  where id = v_invitation.id
  returning * into v_invitation;

  if v_invitation.kind = 'claim' then
    select operation.id into v_operation_id
    from public.learner_profile_merge as operation
    where operation.invitation_id = v_invitation.id;
    if not found then
      insert into public.learner_profile_merge (
        source_learner_profile_id, target_learner_profile_id,
        invitation_id, requested_by_account_id, subject_account_id,
        expires_at
      ) values (
        v_source_profile.id, v_target_profile_id,
        v_invitation.id, v_invitation.inviter_account_id, v_actor_account_id,
        least(v_invitation.expires_at, now() + interval '1 day')
      ) returning id into v_operation_id;
    end if;
    v_merge_preview := public.learner_profile_merge_preview_for_actor(
      v_operation_id, v_actor_account_id
    );
  end if;

  perform public.append_learner_identity_audit(
    'learner_profile_invitation_previewed', v_actor_account_id,
    v_actor_account_id, v_source_profile.id, v_target_profile_id,
    v_invitation.id,
    jsonb_build_object('kind', v_invitation.kind, 'projectionVersion', 1)
  );
  return jsonb_build_object(
    'invitation', jsonb_build_object(
      'id', v_invitation.id, 'kind', v_invitation.kind,
      'status', v_invitation.status,
      'learnerProfileId', v_source_profile.id,
      'learnerLabel', v_source_profile.display_name,
      'inviterLabel', (select display_name from public.account where id = v_invitation.inviter_account_id),
      'expiresAt', v_invitation.expires_at, 'createdAt', v_invitation.created_at,
      'acceptedAt', v_invitation.accepted_at
    ),
    'mergePreview', v_merge_preview,
    'completed', false,
    'childAccountLogin', null
  );
end
$$;

create function public.act_on_learner_profile_invitation(
  p_actor_auth_user_id uuid,
  p_invitation_id uuid,
  p_token_digest bytea,
  p_recipient_email_digest bytea,
  p_action text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_account_id uuid := public.account_id_for_auth_user(p_actor_auth_user_id);
  v_preview jsonb;
  v_invitation public.learner_claim_invitation%rowtype;
  v_operation public.learner_profile_merge%rowtype;
begin
  if p_action not in ('preview', 'accept', 'reject') then
    raise exception 'learner_profile_invitation_action_invalid' using errcode = '22023';
  end if;
  if not public.learner_identity_rate_limit_hit(
    'profile_invitation_action',
    extensions.digest(
      coalesce(v_actor_account_id::text, '') || ':' || p_invitation_id::text,
      'sha256'
    ),
    30, interval '1 hour', interval '1 hour'
  ) then
    raise exception 'learner_identity_rate_limited' using errcode = 'P0001';
  end if;
  select * into v_invitation
  from public.learner_claim_invitation
  where id = p_invitation_id
    and token_digest = p_token_digest
    and recipient_email_digest = p_recipient_email_digest
    and recipient_account_id = v_actor_account_id
  for update;
  if found and v_invitation.status in ('accepted', 'rejected') then
    if (v_invitation.status = 'accepted' and p_action in ('accept', 'preview'))
      or (v_invitation.status = 'rejected' and p_action = 'reject')
    then
      select * into v_operation from public.learner_profile_merge
      where invitation_id = v_invitation.id;
      return jsonb_build_object(
        'invitation', jsonb_build_object(
          'id', v_invitation.id, 'kind', v_invitation.kind,
          'status', v_invitation.status,
          'learnerProfileId', coalesce(v_operation.target_learner_profile_id, v_invitation.source_learner_profile_id),
          'learnerLabel', coalesce((select display_name from public.learner_profile where id = v_operation.target_learner_profile_id), 'Учебный профиль'),
          'inviterLabel', (select display_name from public.account where id = v_invitation.inviter_account_id),
          'expiresAt', v_invitation.expires_at,
          'createdAt', v_invitation.created_at,
          'acceptedAt', v_invitation.accepted_at
        ),
        'mergePreview', v_operation.preview_payload,
        'completed', v_invitation.status = 'accepted',
        'childAccountLogin', null
      );
    end if;
    raise exception 'learner_profile_invitation_action_already_final' using errcode = '55000';
  end if;
  v_preview := public.preview_learner_profile_invitation(
    p_actor_auth_user_id, p_invitation_id,
    p_token_digest, p_recipient_email_digest
  );
  if p_action = 'preview' then return v_preview; end if;
  select * into v_invitation from public.learner_claim_invitation
  where id = p_invitation_id for update;
  if p_action = 'reject' then
    update public.learner_claim_invitation
    set status = 'rejected', rejected_at = now()
    where id = p_invitation_id;
    update public.learner_profile_merge
    set status = 'cancelled', cancelled_at = now()
    where invitation_id = p_invitation_id and status in ('pending', 'ready');
    perform public.append_learner_identity_audit(
      'learner_profile_invitation_rejected', v_actor_account_id,
      v_actor_account_id, v_invitation.source_learner_profile_id,
      null, p_invitation_id,
      jsonb_build_object('kind', v_invitation.kind, 'projectionVersion', 1)
    );
    return jsonb_set(v_preview, '{invitation,status}', '"rejected"'::jsonb);
  end if;
  if v_invitation.kind <> 'claim' then
    raise exception 'child_activation_requires_separate_account' using errcode = '55000';
  end if;
  -- Accepting a claim only authorizes the already-bound preview. Physical
  -- merge still requires the explicit fingerprint confirmation.
  return v_preview;
end
$$;

create function public.activate_offline_learner_account_impl(
  p_actor_auth_user_id uuid,
  p_invitation_id uuid,
  p_token_digest bytea,
  p_recipient_email_digest bytea,
  p_learner_login text,
  p_raw_pin text,
  p_provisional_auth_user_id uuid,
  p_acknowledge_recovery_delegate boolean,
  p_request_observer_invitation boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_recipient_account_id uuid := public.account_id_for_auth_user(p_actor_auth_user_id);
  v_provisional_account public.account%rowtype;
  v_source_profile public.learner_profile%rowtype;
  v_target_profile public.learner_profile%rowtype;
  v_invitation public.learner_claim_invitation%rowtype;
  v_operation_id uuid;
  v_preview jsonb;
  v_target_id uuid;
  v_pin_hash text;
  v_observer_token_digest bytea;
  v_observer_invitation_id uuid;
  v_completed_operation public.learner_profile_merge%rowtype;
  v_recovery_delegate public.learner_credential_recovery_delegate%rowtype;
  v_recovery_delegate_created boolean := false;
begin
  if not coalesce(p_acknowledge_recovery_delegate, false) then
    raise exception 'learner_activation_recovery_acknowledgement_required'
      using errcode = '55000';
  end if;
  if v_recipient_account_id is null
    or p_provisional_auth_user_id is null
    or p_provisional_auth_user_id = p_actor_auth_user_id
    or octet_length(p_token_digest) <> 32
    or octet_length(p_recipient_email_digest) <> 32
    or p_learner_login is null
    or lower(btrim(p_learner_login)) !~ '^[[:alnum:]_.-]{3,80}$'
    or p_raw_pin !~ '^\d{4,8}$'
  then
    raise exception 'learner_activation_not_found' using errcode = 'P0002';
  end if;
  if not public.learner_identity_rate_limit_hit(
    'learner_activation',
    extensions.digest(
      v_recipient_account_id::text || ':' || p_invitation_id::text,
      'sha256'
    ),
    20, interval '1 hour', interval '1 hour'
  ) then
    raise exception 'learner_identity_rate_limited' using errcode = 'P0001';
  end if;

  select invitation.* into v_invitation
  from public.learner_claim_invitation as invitation
  where invitation.id = p_invitation_id
    and invitation.kind = 'child_activation'
    and invitation.token_digest = p_token_digest
    and invitation.recipient_email_digest = p_recipient_email_digest
    and invitation.recipient_account_id = v_recipient_account_id
    and invitation.status = 'accepted';
  if found then
    select * into v_completed_operation
    from public.learner_profile_merge
    where invitation_id = v_invitation.id and status = 'completed';
    if found then
      insert into public.learner_credential_recovery_delegate (
        subject_account_id, delegate_account_id, activation_invitation_id
      ) values (
        v_completed_operation.subject_account_id,
        v_recipient_account_id,
        v_invitation.id
      ) on conflict (subject_account_id, delegate_account_id) do nothing
      returning * into v_recovery_delegate;
      v_recovery_delegate_created := found;
      if not v_recovery_delegate_created then
        select delegate.* into v_recovery_delegate
        from public.learner_credential_recovery_delegate as delegate
        where delegate.subject_account_id = v_completed_operation.subject_account_id
          and delegate.delegate_account_id = v_recipient_account_id;
      else
        perform public.append_learner_identity_audit(
          'learner_credential_recovery_delegate_granted',
          v_recipient_account_id, v_completed_operation.subject_account_id,
          v_completed_operation.target_learner_profile_id, null,
          v_recovery_delegate.id,
          jsonb_build_object('projectionVersion', 1)
        );
      end if;
      return jsonb_build_object(
        'invitation', jsonb_build_object(
          'id', v_invitation.id, 'kind', v_invitation.kind,
          'status', 'accepted',
          'learnerProfileId', v_completed_operation.target_learner_profile_id,
          'learnerLabel', coalesce((select display_name from public.learner_profile where id = v_completed_operation.target_learner_profile_id), 'Учебный профиль'),
          'inviterLabel', (select display_name from public.account where id = v_invitation.inviter_account_id),
          'expiresAt', v_invitation.expires_at,
          'createdAt', v_invitation.created_at,
          'acceptedAt', v_invitation.accepted_at
        ),
        'mergePreview', v_completed_operation.preview_payload,
        'completed', true,
        'childAccountLogin', (
          select normalized_login from public.account_login_alias
          where account_id = v_completed_operation.subject_account_id
            and revoked_at is null limit 1
        ),
        'observerInvitationId', (
          select id from public.learner_observer_invitation
          where learner_profile_id = v_completed_operation.target_learner_profile_id
            and subject_account_id = v_completed_operation.subject_account_id
            and recipient_account_id = v_recipient_account_id
          order by created_at desc limit 1
        ),
        'provisionalAuthUserConsumed', coalesce((
          select account.auth_user_id = p_provisional_auth_user_id
          from public.account as account
          where account.id = v_completed_operation.subject_account_id
        ), false),
        'recoveryDelegateId', v_recovery_delegate.id,
        'recoveryDelegateActive', coalesce(
          v_recovery_delegate.status = 'active', false
        )
      );
    end if;
  end if;

  select invitation.* into v_invitation
  from public.learner_claim_invitation as invitation
  where invitation.id = p_invitation_id
    and invitation.kind = 'child_activation'
    and invitation.token_digest = p_token_digest
    and invitation.recipient_email_digest = p_recipient_email_digest
    and invitation.status in ('pending', 'bound')
    and invitation.expires_at > now()
    and (invitation.recipient_account_id is null
      or invitation.recipient_account_id = v_recipient_account_id)
  for update of invitation;
  if not found then
    raise exception 'learner_activation_not_found' using errcode = 'P0002';
  end if;

  select account.* into v_provisional_account
  from public.account as account
  where account.auth_user_id = p_provisional_auth_user_id
    and account.status = 'provisional'
    and account.id <> v_recipient_account_id
  for update of account;
  if not found then
    raise exception 'learner_activation_not_found' using errcode = 'P0002';
  end if;
  select profile.* into v_target_profile
  from public.learner_profile as profile
  where profile.account_id = v_provisional_account.id
  for update of profile;
  if not found
    or exists (select 1 from public.learning_record where learner_profile_id = v_target_profile.id)
    or exists (select 1 from public.teacher_learner where learner_profile_id = v_target_profile.id)
    or exists (select 1 from public.learner_profile_alias where target_learner_profile_id = v_target_profile.id)
  then
    raise exception 'learner_activation_target_not_empty' using errcode = '55000';
  end if;
  select profile.* into v_source_profile
  from public.learner_profile as profile
  where profile.id = v_invitation.source_learner_profile_id
    and profile.account_id is null
  for update of profile;
  if not found then
    raise exception 'learner_activation_not_found' using errcode = 'P0002';
  end if;

  insert into public.account_login_alias (account_id, normalized_login)
  values (v_provisional_account.id, lower(btrim(p_learner_login)));
  v_pin_hash := extensions.crypt(p_raw_pin, extensions.gen_salt('bf'));
  update public.account_security
  set pin_hash = v_pin_hash, pin_failed_attempts = 0,
      pin_locked_until = null,
      pin_created_at = coalesce(pin_created_at, now()),
      pin_updated_at = now()
  where account_id = v_provisional_account.id;
  update public.account
  set status = 'active', display_name = v_source_profile.display_name
  where id = v_provisional_account.id;
  update public.learner_profile
  set display_name = v_source_profile.display_name
  where id = v_target_profile.id;
  update public.learner_claim_invitation
  set recipient_account_id = v_recipient_account_id, status = 'bound'
  where id = v_invitation.id;

  insert into public.learner_profile_merge (
    source_learner_profile_id, target_learner_profile_id,
    invitation_id, requested_by_account_id, subject_account_id, expires_at
  ) values (
    v_source_profile.id, v_target_profile.id,
    v_invitation.id, v_invitation.inviter_account_id,
    v_provisional_account.id, least(v_invitation.expires_at, now() + interval '1 day')
  ) returning id into v_operation_id;
  v_preview := public.learner_profile_merge_preview_for_actor(
    v_operation_id, v_provisional_account.id
  );
  if not coalesce((v_preview ->> 'canConfirm')::boolean, false) then
    raise exception 'learner_activation_merge_blocked' using errcode = '55000';
  end if;
  v_target_id := public.execute_learner_profile_merge_for_actor(
    v_operation_id, v_provisional_account.id,
    v_preview ->> 'previewFingerprint'
  );

  insert into public.learner_credential_recovery_delegate (
    subject_account_id, delegate_account_id, activation_invitation_id
  ) values (
    v_provisional_account.id, v_recipient_account_id, v_invitation.id
  ) on conflict (subject_account_id, delegate_account_id) do nothing
  returning * into v_recovery_delegate;
  v_recovery_delegate_created := found;
  if not v_recovery_delegate_created then
    select delegate.* into v_recovery_delegate
    from public.learner_credential_recovery_delegate as delegate
    where delegate.subject_account_id = v_provisional_account.id
      and delegate.delegate_account_id = v_recipient_account_id;
  end if;
  if v_recovery_delegate.id is null
    or v_recovery_delegate.status <> 'active'
  then
    raise exception 'learner_activation_recovery_delegate_unavailable'
      using errcode = '55000';
  end if;
  if v_recovery_delegate_created then
    perform public.append_learner_identity_audit(
      'learner_credential_recovery_delegate_granted',
      v_recipient_account_id, v_provisional_account.id,
      v_target_id, null, v_recovery_delegate.id,
      jsonb_build_object('projectionVersion', 1)
    );
  end if;

  if coalesce(p_request_observer_invitation, false) then
    v_observer_token_digest := extensions.digest(
      encode(p_token_digest, 'hex') || ':observer', 'sha256'
    );
    insert into public.learner_observer_invitation (
      learner_profile_id, subject_account_id, recipient_account_id,
      recipient_email_digest, token_digest, status, expires_at
    ) values (
      v_target_id, v_provisional_account.id, v_recipient_account_id,
      p_recipient_email_digest, v_observer_token_digest, 'bound',
      least(v_invitation.expires_at, now() + interval '14 days')
    ) returning id into v_observer_invitation_id;
  end if;

  perform public.append_learner_identity_audit(
    'offline_learner_account_activated', v_recipient_account_id,
    v_provisional_account.id, v_target_id, v_source_profile.id,
    v_invitation.id,
    jsonb_build_object(
      'observerInvitationRequested', coalesce(p_request_observer_invitation, false),
      'projectionVersion', 1
    )
  );
  return jsonb_build_object(
    'invitation', jsonb_build_object(
      'id', v_invitation.id, 'kind', v_invitation.kind,
      'status', 'accepted', 'learnerProfileId', v_target_id,
      'learnerLabel', v_source_profile.display_name,
      'inviterLabel', (select display_name from public.account where id = v_invitation.inviter_account_id),
      'expiresAt', v_invitation.expires_at, 'createdAt', v_invitation.created_at,
      'acceptedAt', now()
    ),
    'mergePreview', v_preview,
    'completed', true,
    'childAccountLogin', lower(btrim(p_learner_login)),
    'observerInvitationId', v_observer_invitation_id,
    'provisionalAuthUserConsumed', true,
    'recoveryDelegateId', v_recovery_delegate.id,
    'recoveryDelegateActive', true
  );
exception
  when unique_violation then
    raise exception 'learner_activation_login_unavailable' using errcode = '23505';
end
$$;

revoke all on function public.activate_offline_learner_account_impl(
  uuid,uuid,bytea,bytea,text,text,uuid,boolean,boolean
) from public, anon, authenticated, service_role;

create function public.activate_offline_learner_account(
  p_actor_auth_user_id uuid,
  p_invitation_id uuid,
  p_token_digest bytea,
  p_recipient_email_digest bytea,
  p_learner_login text,
  p_raw_pin text,
  p_provisional_auth_user_id uuid,
  p_acknowledge_recovery_delegate boolean,
  p_request_observer_invitation boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  v_result := public.activate_offline_learner_account_impl(
    p_actor_auth_user_id, p_invitation_id,
    p_token_digest, p_recipient_email_digest,
    p_learner_login, p_raw_pin, p_provisional_auth_user_id,
    p_acknowledge_recovery_delegate, p_request_observer_invitation
  );

  -- Expand-release rollback compatibility. A losing provisional Account is
  -- never copied on an idempotent completed activation. The final contract
  -- migration replaces this wrapper with a canonical-only call.
  if coalesce((v_result ->> 'provisionalAuthUserConsumed')::boolean, false) then
    insert into public.user_security as legacy (
      user_id, pin_hash, pin_failed_attempts, pin_created_at, pin_updated_at
    )
    select
      p_provisional_auth_user_id, security.pin_hash, 0,
      security.pin_created_at, security.pin_updated_at
    from public.account as account
    join public.account_security as security on security.account_id = account.id
    where account.auth_user_id = p_provisional_auth_user_id
    on conflict (user_id) do update
      set pin_hash = excluded.pin_hash,
          pin_failed_attempts = 0,
          pin_locked_until = null,
          pin_created_at = coalesce(legacy.pin_created_at, now()),
          pin_updated_at = now();
  end if;

  return v_result;
end
$$;

-- GoTrue verified-email handoff variants.  They accept no bearer/token
-- material: a trusted server supplies the HMAC of the actor's verified email.
-- Binding is atomic NULL -> actor and an already-bound row is never rebound.
create function public.preview_verified_learner_profile_invitation(
  p_actor_auth_user_id uuid,
  p_invitation_id uuid,
  p_recipient_email_digest bytea
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_account_id uuid := public.account_id_for_auth_user(p_actor_auth_user_id);
  v_invitation public.learner_claim_invitation%rowtype;
  v_was_unbound boolean;
begin
  if v_actor_account_id is null
    or p_recipient_email_digest is null
    or octet_length(p_recipient_email_digest) <> 32
  then
    raise exception 'learner_profile_invitation_not_found' using errcode = 'P0002';
  end if;

  select invitation.* into v_invitation
  from public.learner_claim_invitation as invitation
  where invitation.id = p_invitation_id
    and invitation.recipient_email_digest = p_recipient_email_digest
    and (invitation.recipient_account_id is null
      or invitation.recipient_account_id = v_actor_account_id)
  for update of invitation;
  if not found then
    raise exception 'learner_profile_invitation_not_found' using errcode = 'P0002';
  end if;

  if v_invitation.status in ('accepted', 'rejected') then
    if v_invitation.recipient_account_id is distinct from v_actor_account_id then
      raise exception 'learner_profile_invitation_not_found' using errcode = 'P0002';
    end if;
  elsif v_invitation.status in ('pending', 'bound')
    and v_invitation.expires_at > now()
  then
    v_was_unbound := v_invitation.recipient_account_id is null;
    update public.learner_claim_invitation as invitation
    set recipient_account_id = v_actor_account_id,
        status = 'bound',
        updated_at = now()
    where invitation.id = v_invitation.id
      and (invitation.recipient_account_id is null
        or invitation.recipient_account_id = v_actor_account_id)
    returning invitation.* into v_invitation;
    if not found then
      raise exception 'learner_profile_invitation_not_found' using errcode = 'P0002';
    end if;
    if v_was_unbound then
      perform public.append_learner_identity_audit(
        'learner_profile_invitation_verified_email_bound',
        v_actor_account_id, v_actor_account_id,
        v_invitation.source_learner_profile_id, null, v_invitation.id,
        jsonb_build_object('kind', v_invitation.kind, 'projectionVersion', 1)
      );
    end if;
  else
    raise exception 'learner_profile_invitation_not_found' using errcode = 'P0002';
  end if;

  return public.preview_learner_profile_invitation(
    p_actor_auth_user_id, v_invitation.id,
    v_invitation.token_digest, p_recipient_email_digest
  );
end
$$;

create function public.act_on_verified_learner_profile_invitation(
  p_actor_auth_user_id uuid,
  p_invitation_id uuid,
  p_recipient_email_digest bytea,
  p_action text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_account_id uuid := public.account_id_for_auth_user(p_actor_auth_user_id);
  v_invitation public.learner_claim_invitation%rowtype;
begin
  perform public.preview_verified_learner_profile_invitation(
    p_actor_auth_user_id, p_invitation_id, p_recipient_email_digest
  );
  select invitation.* into v_invitation
  from public.learner_claim_invitation as invitation
  where invitation.id = p_invitation_id
    and invitation.recipient_account_id = v_actor_account_id
    and invitation.recipient_email_digest = p_recipient_email_digest
  for update of invitation;
  if not found then
    raise exception 'learner_profile_invitation_not_found' using errcode = 'P0002';
  end if;
  return public.act_on_learner_profile_invitation(
    p_actor_auth_user_id, p_invitation_id,
    v_invitation.token_digest, p_recipient_email_digest, p_action
  );
end
$$;

create function public.activate_verified_offline_learner_account(
  p_actor_auth_user_id uuid,
  p_invitation_id uuid,
  p_recipient_email_digest bytea,
  p_child_login text,
  p_raw_pin text,
  p_provisional_auth_user_id uuid,
  p_acknowledge_recovery_delegate boolean,
  p_request_observer_invitation boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_account_id uuid := public.account_id_for_auth_user(p_actor_auth_user_id);
  v_invitation public.learner_claim_invitation%rowtype;
  v_result jsonb;
begin
  if not coalesce(p_acknowledge_recovery_delegate, false) then
    raise exception 'learner_activation_recovery_acknowledgement_required'
      using errcode = '55000';
  end if;
  perform public.preview_verified_learner_profile_invitation(
    p_actor_auth_user_id, p_invitation_id, p_recipient_email_digest
  );
  select invitation.* into v_invitation
  from public.learner_claim_invitation as invitation
  where invitation.id = p_invitation_id
    and invitation.kind = 'child_activation'
    and invitation.recipient_account_id = v_actor_account_id
    and invitation.recipient_email_digest = p_recipient_email_digest
  for update of invitation;
  if not found then
    raise exception 'learner_activation_not_found' using errcode = 'P0002';
  end if;
  v_result := public.activate_offline_learner_account(
    p_actor_auth_user_id, p_invitation_id,
    v_invitation.token_digest, p_recipient_email_digest,
    p_child_login, p_raw_pin, p_provisional_auth_user_id,
    p_acknowledge_recovery_delegate, p_request_observer_invitation
  );
  return v_result;
end
$$;

create function public.list_recoverable_learner_credentials(
  p_actor_auth_user_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor_account_id uuid := public.account_id_for_auth_user(p_actor_auth_user_id);
  v_result jsonb;
begin
  if v_actor_account_id is null then
    raise exception 'learner_credential_recovery_not_found' using errcode = 'P0002';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'grantId', delegate.id,
    'learnerLabel', subject.display_name,
    'childAccountLogin', alias.normalized_login,
    'canReset', delegate.status = 'active' and subject.status = 'active',
    'grantedAt', delegate.granted_at
  ) order by subject.display_name, delegate.id), '[]'::jsonb)
  into v_result
  from public.learner_credential_recovery_delegate as delegate
  join public.account as subject on subject.id = delegate.subject_account_id
  left join public.account_login_alias as alias
    on alias.account_id = subject.id
   and alias.kind = 'login'
   and alias.revoked_at is null
  where delegate.delegate_account_id = v_actor_account_id
    and delegate.status = 'active';
  return v_result;
end
$$;

create function public.reset_recoverable_learner_credentials_impl(
  p_actor_auth_user_id uuid,
  p_grant_id uuid,
  p_new_child_login text,
  p_raw_pin text,
  p_reauthenticated_at timestamptz,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_account_id uuid := public.account_id_for_auth_user(p_actor_auth_user_id);
  v_delegate public.learner_credential_recovery_delegate%rowtype;
  v_subject public.account%rowtype;
  v_profile_id uuid;
  v_pin_hash text;
  v_cutoff timestamptz := clock_timestamp();
  v_result jsonb;
begin
  if v_actor_account_id is null
    or p_grant_id is null
    or p_idempotency_key is null
    or p_new_child_login is null
    or lower(btrim(p_new_child_login)) !~ '^[[:alnum:]_.-]{3,80}$'
    or p_raw_pin is null or p_raw_pin !~ '^\d{4,8}$'
    or p_reauthenticated_at is null
    or p_reauthenticated_at < clock_timestamp() - interval '5 minutes'
    or p_reauthenticated_at > clock_timestamp() + interval '1 minute'
  then
    raise exception 'learner_credential_recovery_not_found' using errcode = 'P0002';
  end if;

  select delegate.* into v_delegate
  from public.learner_credential_recovery_delegate as delegate
  where delegate.id = p_grant_id
    and delegate.delegate_account_id = v_actor_account_id
    and delegate.status = 'active'
  for update of delegate;
  if not found then
    raise exception 'learner_credential_recovery_not_found' using errcode = 'P0002';
  end if;

  if v_delegate.last_reset_idempotency_key = p_idempotency_key
    and v_delegate.last_reset_result is not null
  then
    return v_delegate.last_reset_result;
  end if;

  if not public.learner_identity_rate_limit_hit(
    'credential_recovery_reset',
    extensions.digest(
      v_actor_account_id::text || ':' || p_grant_id::text,
      'sha256'
    ),
    5, interval '1 hour', interval '1 hour'
  ) then
    raise exception 'learner_identity_rate_limited' using errcode = 'P0001';
  end if;

  select account.* into v_subject
  from public.account as account
  where account.id = v_delegate.subject_account_id
    and account.status = 'active'
  for update of account;
  if not found then
    raise exception 'learner_credential_recovery_not_found' using errcode = 'P0002';
  end if;
  select profile.id into v_profile_id
  from public.learner_profile as profile
  where profile.account_id = v_subject.id
  for update of profile;
  if not found then
    raise exception 'learner_credential_recovery_not_found' using errcode = 'P0002';
  end if;

  update public.account_login_alias as alias
  set normalized_login = lower(btrim(p_new_child_login)),
      revoked_at = null,
      updated_at = now()
  where alias.account_id = v_subject.id
    and alias.kind = 'login';
  if not found then
    insert into public.account_login_alias (
      account_id, normalized_login, kind
    ) values (
      v_subject.id, lower(btrim(p_new_child_login)), 'login'
    );
  end if;

  v_pin_hash := extensions.crypt(p_raw_pin, extensions.gen_salt('bf'));
  insert into public.account_security as security (
    account_id, pin_hash, pin_failed_attempts, pin_created_at,
    pin_updated_at, sessions_invalid_before
  ) values (
    v_subject.id, v_pin_hash, 0, now(), now(), v_cutoff
  ) on conflict (account_id) do update
    set pin_hash = excluded.pin_hash,
        pin_failed_attempts = 0,
        pin_locked_until = null,
        pin_created_at = coalesce(security.pin_created_at, now()),
        pin_updated_at = now(),
        sessions_invalid_before = greatest(
          coalesce(security.sessions_invalid_before, '-infinity'::timestamptz),
          v_cutoff
        );

  v_result := jsonb_build_object(
    'grantId', v_delegate.id,
    'learnerLabel', v_subject.display_name,
    'childAccountLogin', lower(btrim(p_new_child_login)),
    'completed', true
  );
  update public.learner_credential_recovery_delegate
  set last_reset_idempotency_key = p_idempotency_key,
      last_reset_result = v_result,
      updated_at = now()
  where id = v_delegate.id;
  perform public.append_learner_identity_audit(
    'learner_credentials_recovered', v_actor_account_id,
    v_subject.id, v_profile_id, null, v_delegate.id,
    jsonb_build_object('projectionVersion', 1)
  );
  return v_result;
exception
  when unique_violation then
    raise exception 'learner_recovery_login_unavailable' using errcode = '23505';
end
$$;

revoke all on function public.reset_recoverable_learner_credentials_impl(
  uuid,uuid,text,text,timestamptz,uuid
) from public, anon, authenticated, service_role;

create function public.reset_recoverable_learner_credentials(
  p_actor_auth_user_id uuid,
  p_grant_id uuid,
  p_new_child_login text,
  p_raw_pin text,
  p_reauthenticated_at timestamptz,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  v_result := public.reset_recoverable_learner_credentials_impl(
    p_actor_auth_user_id, p_grant_id,
    p_new_child_login, p_raw_pin,
    p_reauthenticated_at, p_idempotency_key
  );

  -- Expand-release rollback compatibility. The final contract migration
  -- replaces this wrapper with a canonical-only call.
  insert into public.user_security as legacy (
    user_id, pin_hash, pin_failed_attempts, pin_created_at,
    pin_updated_at, sessions_invalid_before
  )
  select
    subject.auth_user_id, security.pin_hash, 0,
    security.pin_created_at, security.pin_updated_at,
    security.sessions_invalid_before
  from public.learner_credential_recovery_delegate as delegate
  join public.account as subject on subject.id = delegate.subject_account_id
  join public.account_security as security on security.account_id = subject.id
  where delegate.id = p_grant_id
  on conflict (user_id) do update
    set pin_hash = excluded.pin_hash,
        pin_failed_attempts = 0,
        pin_locked_until = null,
        pin_created_at = coalesce(legacy.pin_created_at, now()),
        pin_updated_at = now(),
        sessions_invalid_before = greatest(
          coalesce(legacy.sessions_invalid_before, '-infinity'::timestamptz),
          excluded.sessions_invalid_before
        );

  return v_result;
end
$$;

create function public.list_my_learner_credential_recovery_delegates()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor_account_id uuid := public.current_account_id();
  v_result jsonb;
begin
  if v_actor_account_id is null then
    raise exception 'learner_credential_recovery_not_found' using errcode = 'P0002';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'grantId', delegate.id,
    'delegateLabel', account.display_name,
    'status', delegate.status,
    'grantedAt', delegate.granted_at,
    'revokedAt', delegate.revoked_at
  ) order by delegate.created_at desc), '[]'::jsonb)
  into v_result
  from public.learner_credential_recovery_delegate as delegate
  join public.account as account on account.id = delegate.delegate_account_id
  where delegate.subject_account_id = v_actor_account_id;
  return v_result;
end
$$;

create function public.revoke_my_learner_credential_recovery_delegate(
  p_grant_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_account_id uuid := public.current_account_id();
  v_delegate public.learner_credential_recovery_delegate%rowtype;
begin
  select delegate.* into v_delegate
  from public.learner_credential_recovery_delegate as delegate
  where delegate.id = p_grant_id
    and delegate.subject_account_id = v_actor_account_id
  for update of delegate;
  if not found then
    raise exception 'learner_credential_recovery_not_found' using errcode = 'P0002';
  end if;
  if v_delegate.status = 'active' then
    update public.learner_credential_recovery_delegate as delegate
    set status = 'revoked', revoked_at = now(), updated_at = now()
    where delegate.id = v_delegate.id
    returning delegate.* into v_delegate;
    perform public.append_learner_identity_audit(
      'learner_credential_recovery_delegate_revoked',
      v_actor_account_id, v_actor_account_id,
      public.current_owned_learner_profile_id(), null, v_delegate.id,
      jsonb_build_object('projectionVersion', 1)
    );
  end if;
  return jsonb_build_object(
    'grantId', v_delegate.id,
    'status', v_delegate.status,
    'revokedAt', v_delegate.revoked_at
  );
end
$$;

create function public.get_my_learning_profile()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor_account_id uuid := public.current_account_id();
  v_profile public.learner_profile%rowtype;
  v_pending jsonb;
  v_unlink_preview jsonb;
begin
  select profile.* into v_profile
  from public.learner_profile as profile
  where profile.account_id = v_actor_account_id;
  if not found then
    raise exception 'learner_profile_not_found' using errcode = 'P0002';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', request.id, 'direction', 'incoming', 'status', request.status,
    'method', request.method,
    'counterpartyLabel', teacher.display_name,
    'localDisplayName', request.local_display_name,
    'learnerProfileId', v_profile.id,
    'expiresAt', request.expires_at, 'createdAt', request.created_at,
    'acceptedAt', request.accepted_at
  ) order by request.created_at desc), '[]'::jsonb)
  into v_pending
  from public.learner_connection_request as request
  join public.account as teacher on teacher.id = request.teacher_account_id
  where request.learner_profile_id = v_profile.id
    and request.status in ('pending', 'bound')
    and request.expires_at > now();
  v_unlink_preview := public.learner_safe_unlink_preview_for_actor(
    v_actor_account_id
  );
  return jsonb_build_object(
    'learnerProfileId', v_profile.id,
    'displayName', v_profile.display_name,
    'createdAt', v_profile.created_at,
    'mergedLineageCount', (
      select count(*)::integer from public.learner_profile_alias as alias
      where alias.target_learner_profile_id = v_profile.id
    ),
    'canSafeUnlink', (v_unlink_preview ->> 'canUnlink')::boolean,
    'pendingConnections', v_pending
  );
end
$$;

create function public.get_my_learning_history(
  p_cursor text default null,
  p_limit integer default 25
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid := public.current_owned_learner_profile_id();
begin
  if v_profile_id is null then
    raise exception 'learner_profile_not_found' using errcode = 'P0002';
  end if;
  return public.learner_safe_history_projection(v_profile_id, p_cursor, p_limit);
end
$$;

create function public.get_my_learning_progress()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid := public.current_owned_learner_profile_id();
begin
  if v_profile_id is null then
    raise exception 'learner_profile_not_found' using errcode = 'P0002';
  end if;
  return public.learner_progress_projection(v_profile_id);
end
$$;

create function public.learner_safe_unlink_preview_for_actor(
  p_actor_account_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid;
  v_blockers jsonb := '[]'::jsonb;
  v_base jsonb;
  v_fingerprint text;
begin
  select profile.id into v_profile_id
  from public.learner_profile as profile
  where profile.account_id = p_actor_account_id;
  if not found then
    raise exception 'learner_profile_not_found' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.learning_record where learner_profile_id = v_profile_id) then
    v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
      'code', 'learning_history_exists', 'message', 'В профиле есть учебная история.',
      'count', (select count(*) from public.learning_record where learner_profile_id = v_profile_id)
    ));
  end if;
  if exists (select 1 from public.learner_profile_alias where target_learner_profile_id = v_profile_id)
    or exists (select 1 from public.learner_profile_merge where target_learner_profile_id = v_profile_id and status = 'completed')
  then
    v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
      'code', 'merge_lineage_exists', 'message', 'Объединённый профиль нельзя разделить.', 'count', null
    ));
  end if;
  if exists (select 1 from public.learner_group_member where learner_profile_id = v_profile_id)
    or exists (select 1 from public.course_learner where learner_profile_id = v_profile_id)
    or exists (select 1 from public.learner_observer_grant where learner_profile_id = v_profile_id and status = 'active')
    or exists (select 1 from public.learner_observer_invitation
      where learner_profile_id = v_profile_id
        and status in ('pending','bound') and expires_at > now())
    or exists (select 1 from public.learner_ai_consent
      where learner_profile_id = v_profile_id
        and status in ('pending','active') and expires_at > now())
    or exists (select 1 from public.learner_claim_invitation
      where source_learner_profile_id = v_profile_id
        and status in ('pending','bound') and expires_at > now())
    or exists (select 1 from public.learner_connection_request
      where learner_profile_id = v_profile_id
        and status in ('pending', 'bound') and expires_at > now())
    or exists (select 1 from public.learner_identity_reconciliation
      where learner_profile_id = v_profile_id
        and status in ('pending', 'needs_review'))
    or exists (select 1 from public.learner_profile_share_code
      where learner_profile_id = v_profile_id
        and status = 'active' and expires_at > now())
    or exists (select 1 from public.learner_profile_merge
      where (source_learner_profile_id = v_profile_id
          or target_learner_profile_id = v_profile_id)
        and status in ('pending','ready') and expires_at > now())
  then
    v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
      'code', 'dependent_access_exists', 'message', 'Сначала удалите назначения, наблюдателей и согласия.', 'count', null
    ));
  end if;
  v_base := jsonb_build_object(
    'accountId', p_actor_account_id,
    'learnerProfileId', v_profile_id,
    'blockers', v_blockers,
    'canUnlink', jsonb_array_length(v_blockers) = 0
  );
  v_fingerprint := encode(extensions.digest(v_base::text, 'sha256'), 'hex');
  return jsonb_build_object(
    'previewFingerprint', v_fingerprint,
    'canUnlink', jsonb_array_length(v_blockers) = 0,
    'blockers', v_blockers,
    'generatedAt', now()
  );
end
$$;

create function public.preview_my_learner_profile_unlink()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor_account_id uuid := public.current_account_id();
begin
  if v_actor_account_id is null then
    raise exception 'learner_profile_not_found' using errcode = 'P0002';
  end if;
  return public.learner_safe_unlink_preview_for_actor(v_actor_account_id);
end
$$;

create function public.confirm_my_learner_profile_unlink(
  p_actor_auth_user_id uuid,
  p_preview_fingerprint text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_account_id uuid := public.account_id_for_auth_user(p_actor_auth_user_id);
  v_old_profile public.learner_profile%rowtype;
  v_new_profile public.learner_profile%rowtype;
  v_account public.account%rowtype;
  v_preview jsonb;
begin
  if v_actor_account_id is null then
    raise exception 'learner_profile_not_found' using errcode = 'P0002';
  end if;
  select account.* into v_account from public.account as account
  where account.id = v_actor_account_id for update of account;
  select profile.* into v_old_profile from public.learner_profile as profile
  where profile.account_id = v_actor_account_id for update of profile;
  v_preview := public.learner_safe_unlink_preview_for_actor(v_actor_account_id);
  if not coalesce((v_preview ->> 'canUnlink')::boolean, false)
    or p_preview_fingerprint is null
    or p_preview_fingerprint <> v_preview ->> 'previewFingerprint'
  then
    raise exception 'learner_profile_unlink_preview_stale' using errcode = '40001';
  end if;
  perform set_config('app.learner_profile_link_mutation', 'on', true);
  update public.learner_profile set account_id = null
  where id = v_old_profile.id;
  insert into public.learner_profile (display_name, account_id)
  values (v_account.display_name, v_actor_account_id)
  returning * into v_new_profile;
  perform public.append_learner_identity_audit(
    'learner_profile_safely_unlinked', v_actor_account_id,
    v_actor_account_id, v_old_profile.id, null, null,
    jsonb_build_object('projectionVersion', 1)
  );
  return jsonb_build_object(
    'learnerProfileId', v_new_profile.id,
    'displayName', v_new_profile.display_name,
    'createdAt', v_new_profile.created_at,
    'mergedLineageCount', 0,
    'canSafeUnlink', true,
    'pendingConnections', '[]'::jsonb
  );
end
$$;

-- Internal canonical state used by both erasure preview and confirmation.
-- The exposed payload contains counts only; scopeState binds the fingerprint
-- to the exact rows and terminal states that confirmation will remove.
create function public.learner_erasure_state_for_actor(
  p_actor_account_id uuid,
  p_learner_profile_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with lineage as materialized (
    select p_learner_profile_id as id
    union
    select alias.source_learner_profile_id
    from public.learner_profile_alias as alias
    where alias.target_learner_profile_id = p_learner_profile_id
  ), scope_entries as (
    select 'profile:' || lineage.id::text as entry from lineage
    union all
    select 'record:' || record.id::text
      from public.learning_record as record
      join lineage on lineage.id = record.learner_profile_id
    union all
    select 'teacher:' || relation.teacher_account_id::text || ':'
      || relation.learner_profile_id::text || ':'
      || (relation.archived_at is not null)::text
      from public.teacher_learner as relation
      join lineage on lineage.id = relation.learner_profile_id
    union all
    select 'group:' || member.learner_group_id::text || ':'
      || member.learner_profile_id::text
      from public.learner_group_member as member
      join lineage on lineage.id = member.learner_profile_id
    union all
    select 'course:' || direct.course_id::text || ':'
      || direct.learner_profile_id::text
      from public.course_learner as direct
      join lineage on lineage.id = direct.learner_profile_id
    union all
    select 'share:' || code.id::text || ':' || code.status
      from public.learner_profile_share_code as code
      join lineage on lineage.id = code.learner_profile_id
    union all
    select 'claim:' || invitation.id::text || ':' || invitation.status
      from public.learner_claim_invitation as invitation
      join lineage on lineage.id = invitation.source_learner_profile_id
    union all
    select 'connection:' || request.id::text || ':' || request.status
      from public.learner_connection_request as request
      join lineage on lineage.id = request.learner_profile_id
    union all
    select 'observer-invitation:' || invitation.id::text || ':' || invitation.status
      from public.learner_observer_invitation as invitation
      join lineage on lineage.id = invitation.learner_profile_id
    union all
    select 'observer-grant:' || grant_row.id::text || ':' || grant_row.status
      from public.learner_observer_grant as grant_row
      join lineage on lineage.id = grant_row.learner_profile_id
    union all
    select 'ai:' || consent.id::text || ':' || consent.status || ':'
      || consent.revision::text
      from public.learner_ai_consent as consent
      join lineage on lineage.id = consent.learner_profile_id
    union all
    select 'recovery-delegate:' || delegate.id::text || ':' || delegate.status
      from public.learner_credential_recovery_delegate as delegate
      where delegate.subject_account_id = p_actor_account_id
    union all
    select 'alias:' || alias.source_learner_profile_id::text || ':'
      || alias.target_learner_profile_id::text || ':' || alias.merge_operation_id::text
      from public.learner_profile_alias as alias
      where alias.source_learner_profile_id in (select id from lineage)
        or alias.target_learner_profile_id = p_learner_profile_id
    union all
    select 'merge:' || operation.id::text || ':' || operation.status
      from public.learner_profile_merge as operation
      where operation.source_learner_profile_id in (select id from lineage)
        or operation.target_learner_profile_id = p_learner_profile_id
  )
  select jsonb_build_object(
    'accountId', p_actor_account_id,
    'currentLearnerProfileId', p_learner_profile_id,
    'lineageProfileCount', (select count(*) from lineage),
    'learningRecordCount', (
      select count(*) from public.learning_record as record
      join lineage on lineage.id = record.learner_profile_id
    ),
    'teacherRelationCount', (
      select count(*) from public.teacher_learner as relation
      join lineage on lineage.id = relation.learner_profile_id
    ),
    'groupMembershipCount', (
      select count(*) from public.learner_group_member as member
      join lineage on lineage.id = member.learner_profile_id
    ),
    'courseAudienceCount', (
      select count(*) from public.course_learner as direct
      join lineage on lineage.id = direct.learner_profile_id
    ),
    'invitationCount',
      (select count(*) from public.learner_claim_invitation as invitation
        join lineage on lineage.id = invitation.source_learner_profile_id)
      + (select count(*) from public.learner_connection_request as request
        join lineage on lineage.id = request.learner_profile_id)
      + (select count(*) from public.learner_observer_invitation as invitation
        join lineage on lineage.id = invitation.learner_profile_id),
    'observerGrantCount', (
      select count(*) from public.learner_observer_grant as grant_row
      join lineage on lineage.id = grant_row.learner_profile_id
    ),
    'aiConsentCount', (
      select count(*) from public.learner_ai_consent as consent
      join lineage on lineage.id = consent.learner_profile_id
    ),
    'recoveryDelegateCount', (
      select count(*)
      from public.learner_credential_recovery_delegate as delegate
      where delegate.subject_account_id = p_actor_account_id
    ),
    'scopeState', encode(extensions.digest(
      coalesce((select string_agg(entry, E'\n' order by entry) from scope_entries), ''),
      'sha256'
    ), 'hex')
  );
$$;

create function public.preview_my_learning_data_erasure()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_account_id uuid := public.current_account_id();
  v_profile_id uuid := public.current_owned_learner_profile_id();
  v_base jsonb;
  v_payload jsonb;
  v_fingerprint bytea;
begin
  if v_actor_account_id is null or v_profile_id is null then
    raise exception 'learner_profile_not_found' using errcode = 'P0002';
  end if;
  delete from public.learner_erasure_request
  where account_id = v_actor_account_id and consumed_at is null;
  v_base := public.learner_erasure_state_for_actor(
    v_actor_account_id, v_profile_id
  );
  v_fingerprint := extensions.digest(v_base::text, 'sha256');
  v_payload := (
    v_base - 'accountId' - 'currentLearnerProfileId' - 'scopeState'
  ) || jsonb_build_object(
    'previewFingerprint', encode(v_fingerprint, 'hex'),
    'generatedAt', now()
  );
  insert into public.learner_erasure_request (
    account_id, current_learner_profile_id, preview_fingerprint,
    preview_payload, expires_at
  ) values (
    v_actor_account_id, v_profile_id, v_fingerprint,
    v_payload, now() + interval '15 minutes'
  );
  perform public.append_learner_identity_audit(
    'learning_data_erasure_previewed', v_actor_account_id,
    v_actor_account_id, v_profile_id, null, null,
    jsonb_build_object('projectionVersion', 1)
  );
  return v_payload;
end
$$;

create function public.confirm_my_learning_data_erasure(
  p_actor_auth_user_id uuid,
  p_preview_fingerprint text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_account_id uuid := public.account_id_for_auth_user(p_actor_auth_user_id);
  v_account public.account%rowtype;
  v_profile_id uuid;
  v_request public.learner_erasure_request%rowtype;
  v_lineage_ids uuid[];
  v_new_profile public.learner_profile%rowtype;
  v_counts jsonb;
  v_current_base jsonb;
  v_current_fingerprint bytea;
begin
  if v_actor_account_id is null or p_preview_fingerprint !~ '^[0-9a-f]{64}$' then
    raise exception 'learning_data_erasure_not_found' using errcode = 'P0002';
  end if;
  select account.* into v_account from public.account as account
  where account.id = v_actor_account_id for update of account;
  select profile.id into v_profile_id from public.learner_profile as profile
  where profile.account_id = v_actor_account_id for update of profile;
  select request.* into v_request
  from public.learner_erasure_request as request
  where request.account_id = v_actor_account_id
    and request.current_learner_profile_id = v_profile_id
    and request.preview_fingerprint = decode(p_preview_fingerprint, 'hex')
    and request.consumed_at is null and request.expires_at > now()
  order by request.created_at desc limit 1
  for update of request;
  if not found then
    raise exception 'learning_data_erasure_not_found' using errcode = 'P0002';
  end if;
  v_counts := v_request.preview_payload;
  select array_agg(id order by id) into v_lineage_ids
  from (
    select v_profile_id as id
    union
    select source_learner_profile_id from public.learner_profile_alias
    where target_learner_profile_id = v_profile_id
  ) as lineage;

  -- The canonical profile row blocks new FK-backed dependencies.  Lock every
  -- existing row in the deletion scope before recomputing the exact state so
  -- updates/deletes cannot race the fingerprint check.  Supported writers of
  -- the legacy no-FK source references also lock the profile first.
  perform 1 from public.learner_profile_alias
    where source_learner_profile_id = any(v_lineage_ids)
      or target_learner_profile_id = v_profile_id
    order by source_learner_profile_id for update;
  perform 1 from public.learner_profile_merge
    where source_learner_profile_id = any(v_lineage_ids)
      or target_learner_profile_id = v_profile_id
    order by id for update;
  perform 1 from public.learner_claim_invitation
    where source_learner_profile_id = any(v_lineage_ids)
    order by id for update;
  perform 1 from public.learner_connection_request
    where learner_profile_id = any(v_lineage_ids)
    order by id for update;
  perform 1 from public.learner_observer_invitation
    where learner_profile_id = any(v_lineage_ids)
    order by id for update;
  perform 1 from public.learner_observer_grant
    where learner_profile_id = any(v_lineage_ids)
    order by id for update;
  perform 1 from public.learner_ai_consent
    where learner_profile_id = any(v_lineage_ids)
    order by id for update;
  perform 1 from public.learner_credential_recovery_delegate
    where subject_account_id = v_actor_account_id
    order by id for update;
  perform 1 from public.course_learner
    where learner_profile_id = any(v_lineage_ids)
    order by course_id, learner_profile_id for update;
  perform 1 from public.learner_group_member
    where learner_profile_id = any(v_lineage_ids)
    order by learner_group_id, learner_profile_id for update;
  perform 1 from public.teacher_learner
    where learner_profile_id = any(v_lineage_ids)
    order by teacher_account_id, learner_profile_id for update;
  perform 1 from public.learner_profile_share_code
    where learner_profile_id = any(v_lineage_ids)
    order by id for update;
  perform 1 from public.learning_record
    where learner_profile_id = any(v_lineage_ids)
    order by id for update;

  v_current_base := public.learner_erasure_state_for_actor(
    v_actor_account_id, v_profile_id
  );
  v_current_fingerprint := extensions.digest(v_current_base::text, 'sha256');
  if v_current_fingerprint <> v_request.preview_fingerprint then
    raise exception 'learning_data_erasure_preview_stale' using errcode = '40001';
  end if;

  perform set_config('app.learner_identity_erasure', 'on', true);
  perform set_config('app.learner_profile_link_mutation', 'on', true);

  delete from public.learner_profile_alias
  where source_learner_profile_id = any(v_lineage_ids)
    or target_learner_profile_id = v_profile_id;
  delete from public.learner_profile_merge
  where source_learner_profile_id = any(v_lineage_ids)
    or target_learner_profile_id = v_profile_id;
  delete from public.learner_claim_invitation
  where source_learner_profile_id = any(v_lineage_ids);
  delete from public.learner_connection_request
  where learner_profile_id = any(v_lineage_ids);
  delete from public.learner_observer_invitation where learner_profile_id = any(v_lineage_ids);
  delete from public.learner_observer_grant where learner_profile_id = any(v_lineage_ids);
  delete from public.learner_ai_consent where learner_profile_id = any(v_lineage_ids);
  delete from public.learner_credential_recovery_delegate
  where subject_account_id = v_actor_account_id;
  delete from public.course_learner where learner_profile_id = any(v_lineage_ids);
  delete from public.learner_group_member where learner_profile_id = any(v_lineage_ids);
  delete from public.teacher_learner where learner_profile_id = any(v_lineage_ids);
  delete from public.learner_profile_share_code where learner_profile_id = any(v_lineage_ids);
  delete from public.learning_record where learner_profile_id = any(v_lineage_ids);

  update public.learner_identity_audit_event
  set learner_profile_id = null,
      related_learner_profile_id = null,
      related_entity_id = case
        when related_entity_id = any(v_lineage_ids) then null
        else related_entity_id
      end
  where learner_profile_id = any(v_lineage_ids)
    or related_learner_profile_id = any(v_lineage_ids)
    or related_entity_id = any(v_lineage_ids);

  delete from public.learner_profile where id = v_profile_id;
  insert into public.learner_profile (display_name, account_id)
  values (v_account.display_name, v_actor_account_id)
  returning * into v_new_profile;

  perform public.append_learner_identity_audit(
    'learning_data_erased', v_actor_account_id, v_actor_account_id,
    null, null, null,
    jsonb_build_object(
      'lineageProfileCount', v_counts -> 'lineageProfileCount',
      'learningRecordCount', v_counts -> 'learningRecordCount',
      'projectionVersion', 1
    )
  );
  return jsonb_build_object(
    'learnerProfileId', v_new_profile.id,
    'displayName', v_new_profile.display_name,
    'createdAt', v_new_profile.created_at,
    'mergedLineageCount', 0,
    'canSafeUnlink', true,
    'pendingConnections', '[]'::jsonb
  );
end
$$;

create function public.create_learner_observer_invitation(
  p_actor_auth_user_id uuid,
  p_recipient_email_digest bytea,
  p_token_digest bytea,
  p_relationship_label text,
  p_expires_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_account_id uuid := public.account_id_for_auth_user(p_actor_auth_user_id);
  v_profile_id uuid;
  v_invitation public.learner_observer_invitation%rowtype;
  v_expired_invitation public.learner_observer_invitation%rowtype;
  v_overview jsonb;
begin
  if v_actor_account_id is null
    or octet_length(p_recipient_email_digest) <> 32
    or octet_length(p_token_digest) <> 32
    or (p_relationship_label is not null
      and (btrim(p_relationship_label) = '' or char_length(btrim(p_relationship_label)) > 80))
    or p_expires_at <= now() or p_expires_at > now() + interval '30 days'
  then
    raise exception 'learner_observer_invitation_invalid' using errcode = '22023';
  end if;
  if not public.learner_identity_rate_limit_hit(
    'observer_invitation_create', extensions.digest(v_actor_account_id::text, 'sha256'),
    20, interval '1 hour', interval '1 hour'
  ) then
    raise exception 'learner_identity_rate_limited' using errcode = 'P0001';
  end if;
  select profile.id into v_profile_id
  from public.learner_profile as profile
  where profile.account_id = v_actor_account_id
  for update of profile;
  if not found then
    raise exception 'learner_profile_not_found' using errcode = 'P0002';
  end if;
  for v_expired_invitation in
    update public.learner_observer_invitation as invitation
    set status = 'expired', updated_at = now()
    where invitation.learner_profile_id = v_profile_id
      and invitation.recipient_email_digest = p_recipient_email_digest
      and invitation.status in ('pending', 'bound')
      and invitation.expires_at <= now()
    returning invitation.*
  loop
    perform public.append_learner_identity_audit(
      'learner_observer_invitation_expired', v_actor_account_id,
      v_actor_account_id, v_profile_id, null, v_expired_invitation.id,
      jsonb_build_object(
        'expiredAt', v_expired_invitation.expires_at,
        'projectionVersion', 1
      )
    );
  end loop;
  insert into public.learner_observer_invitation (
    learner_profile_id, subject_account_id, recipient_email_digest,
    token_digest, relationship_label, expires_at
  ) values (
    v_profile_id, v_actor_account_id, p_recipient_email_digest,
    p_token_digest, nullif(btrim(p_relationship_label), ''), p_expires_at
  ) returning * into v_invitation;
  perform public.append_learner_identity_audit(
    'learner_observer_invitation_created', v_actor_account_id,
    v_actor_account_id, v_profile_id, null, v_invitation.id,
    jsonb_build_object('projectionVersion', 1)
  );
  v_overview := public.list_my_learner_observer_overview_for_actor(v_actor_account_id);
  return jsonb_build_object(
    'createdInvitationId', v_invitation.id,
    'overview', v_overview
  );
exception
  when unique_violation then
    raise exception 'learner_observer_invitation_already_pending' using errcode = '23505';
end
$$;

create function public.list_my_learner_observer_overview_for_actor(
  p_actor_account_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'grants', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', grant_row.id,
        'learnerProfileId', grant_row.learner_profile_id,
        'subjectLabel', subject.display_name,
        'observerLabel', observer.display_name,
        'relationshipLabel', grant_row.relationship_label,
        'direction', case when grant_row.observer_account_id = p_actor_account_id
          then 'observing' else 'observed_by' end,
        'createdAt', grant_row.created_at
      ) order by grant_row.created_at desc)
      from public.learner_observer_grant as grant_row
      join public.account as subject on subject.id = grant_row.subject_account_id
      join public.account as observer on observer.id = grant_row.observer_account_id
      where grant_row.status = 'active'
        and (grant_row.subject_account_id = p_actor_account_id
          or grant_row.observer_account_id = p_actor_account_id)
    ), '[]'::jsonb),
    'invitations', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', invitation.id,
        'direction', case when invitation.subject_account_id = p_actor_account_id
          then 'outgoing' else 'incoming' end,
        'status', case when invitation.status in ('pending','bound') and invitation.expires_at <= now()
          then 'expired' else invitation.status end,
        'subjectLabel', subject.display_name,
        'observerLabel', case when invitation.recipient_account_id is null
          then 'Приглашённый наблюдатель'
          else observer.display_name end,
        'relationshipLabel', invitation.relationship_label,
        'expiresAt', invitation.expires_at,
        'createdAt', invitation.created_at
      ) order by invitation.created_at desc)
      from public.learner_observer_invitation as invitation
      join public.account as subject on subject.id = invitation.subject_account_id
      left join public.account as observer on observer.id = invitation.recipient_account_id
      where invitation.subject_account_id = p_actor_account_id
        or invitation.recipient_account_id = p_actor_account_id
    ), '[]'::jsonb)
  );
$$;

create function public.list_my_learner_observer_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor_account_id uuid := public.current_account_id();
begin
  if v_actor_account_id is null then
    raise exception 'account_not_found' using errcode = 'P0002';
  end if;
  return public.list_my_learner_observer_overview_for_actor(v_actor_account_id);
end
$$;

create function public.preview_email_learner_observer_invitation(
  p_actor_auth_user_id uuid,
  p_invitation_id uuid,
  p_token_digest bytea,
  p_recipient_email_digest bytea
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_account_id uuid := public.account_id_for_auth_user(p_actor_auth_user_id);
  v_invitation public.learner_observer_invitation%rowtype;
begin
  if v_actor_account_id is null
    or octet_length(p_token_digest) <> 32
    or octet_length(p_recipient_email_digest) <> 32
  then
    raise exception 'learner_observer_invitation_not_found' using errcode = 'P0002';
  end if;
  if not public.learner_identity_rate_limit_hit(
    'observer_invitation_preview',
    extensions.digest(
      v_actor_account_id::text || ':' || p_invitation_id::text,
      'sha256'
    ),
    60, interval '1 hour', interval '1 hour'
  ) then
    raise exception 'learner_identity_rate_limited' using errcode = 'P0001';
  end if;
  select invitation.* into v_invitation
  from public.learner_observer_invitation as invitation
  where invitation.id = p_invitation_id
    and invitation.token_digest = p_token_digest
    and invitation.recipient_email_digest = p_recipient_email_digest
    and invitation.subject_account_id <> v_actor_account_id
    and (invitation.recipient_account_id is null
      or invitation.recipient_account_id = v_actor_account_id)
  for update of invitation;
  if not found then
    raise exception 'learner_observer_invitation_not_found' using errcode = 'P0002';
  end if;
  if v_invitation.status in ('accepted', 'rejected')
    and v_invitation.recipient_account_id = v_actor_account_id
  then
    return jsonb_build_object(
      'id', v_invitation.id,
      'kind', 'observer',
      'title', (select display_name from public.account where id = v_invitation.subject_account_id),
      'status', v_invitation.status,
      'inviterLabel', (select display_name from public.account where id = v_invitation.subject_account_id),
      'relationshipLabel', v_invitation.relationship_label,
      'expiresAt', v_invitation.expires_at,
      'canAccept', false
    );
  end if;
  if v_invitation.status not in ('pending', 'bound')
    or v_invitation.expires_at <= now()
  then
    raise exception 'learner_observer_invitation_not_found' using errcode = 'P0002';
  end if;
  update public.learner_observer_invitation
  set recipient_account_id = v_actor_account_id,
      status = 'bound'
  where id = v_invitation.id returning * into v_invitation;
  perform public.append_learner_identity_audit(
    'learner_observer_invitation_previewed', v_actor_account_id,
    v_invitation.subject_account_id, v_invitation.learner_profile_id,
    null, v_invitation.id, jsonb_build_object('projectionVersion', 1)
  );
  return jsonb_build_object(
    'id', v_invitation.id,
    'kind', 'observer',
    'title', (select display_name from public.account where id = v_invitation.subject_account_id),
    'status', v_invitation.status,
    'inviterLabel', (select display_name from public.account where id = v_invitation.subject_account_id),
    'relationshipLabel', v_invitation.relationship_label,
    'expiresAt', v_invitation.expires_at,
    'canAccept', true
  );
end
$$;

create function public.act_on_email_learner_observer_invitation(
  p_actor_auth_user_id uuid,
  p_invitation_id uuid,
  p_action text,
  p_token_digest bytea,
  p_recipient_email_digest bytea,
  p_relationship_label text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_account_id uuid := public.account_id_for_auth_user(p_actor_auth_user_id);
  v_preview jsonb;
  v_invitation public.learner_observer_invitation%rowtype;
begin
  if p_action not in ('accept', 'reject') then
    raise exception 'learner_observer_action_invalid' using errcode = '22023';
  end if;
  if not public.learner_identity_rate_limit_hit(
    'observer_invitation_action',
    extensions.digest(
      coalesce(v_actor_account_id::text, '') || ':' || p_invitation_id::text,
      'sha256'
    ),
    30, interval '1 hour', interval '1 hour'
  ) then
    raise exception 'learner_identity_rate_limited' using errcode = 'P0001';
  end if;
  select * into v_invitation
  from public.learner_observer_invitation
  where id = p_invitation_id
    and token_digest = p_token_digest
    and recipient_email_digest = p_recipient_email_digest
    and recipient_account_id = v_actor_account_id
  for update;
  if found and (
    (v_invitation.status = 'accepted' and p_action = 'accept')
    or (v_invitation.status = 'rejected' and p_action = 'reject')
  ) then
    return public.list_my_learner_observer_overview_for_actor(v_actor_account_id);
  elsif found and v_invitation.status in ('accepted', 'rejected') then
    raise exception 'learner_observer_action_already_final' using errcode = '55000';
  end if;
  v_preview := public.preview_email_learner_observer_invitation(
    p_actor_auth_user_id, p_invitation_id,
    p_token_digest, p_recipient_email_digest
  );
  select * into v_invitation from public.learner_observer_invitation
  where id = p_invitation_id for update;
  if p_action = 'accept' then
    insert into public.learner_observer_grant (
      learner_profile_id, subject_account_id, observer_account_id,
      invitation_id, relationship_label
    ) values (
      v_invitation.learner_profile_id, v_invitation.subject_account_id,
      v_actor_account_id, v_invitation.id,
      coalesce(nullif(btrim(p_relationship_label), ''), v_invitation.relationship_label)
    ) on conflict (learner_profile_id, observer_account_id) do update
      set status = 'active', revoked_at = null,
          relationship_label = excluded.relationship_label,
          invitation_id = excluded.invitation_id;
    update public.learner_observer_invitation
    set status = 'accepted', accepted_at = now()
    where id = v_invitation.id;
  else
    update public.learner_observer_invitation
    set status = 'rejected'
    where id = v_invitation.id;
  end if;
  perform public.append_learner_identity_audit(
    'learner_observer_invitation_' || case when p_action = 'accept' then 'accepted' else 'rejected' end,
    v_actor_account_id, v_invitation.subject_account_id,
    v_invitation.learner_profile_id, null, v_invitation.id,
    jsonb_build_object('projectionVersion', 1)
  );
  return public.list_my_learner_observer_overview_for_actor(v_actor_account_id);
end
$$;

create function public.preview_verified_email_learner_observer_invitation(
  p_actor_auth_user_id uuid,
  p_invitation_id uuid,
  p_recipient_email_digest bytea
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_account_id uuid := public.account_id_for_auth_user(p_actor_auth_user_id);
  v_invitation public.learner_observer_invitation%rowtype;
  v_was_unbound boolean;
begin
  if v_actor_account_id is null
    or p_recipient_email_digest is null
    or octet_length(p_recipient_email_digest) <> 32
  then
    raise exception 'learner_observer_invitation_not_found' using errcode = 'P0002';
  end if;
  select invitation.* into v_invitation
  from public.learner_observer_invitation as invitation
  where invitation.id = p_invitation_id
    and invitation.recipient_email_digest = p_recipient_email_digest
    and invitation.subject_account_id <> v_actor_account_id
    and (invitation.recipient_account_id is null
      or invitation.recipient_account_id = v_actor_account_id)
  for update of invitation;
  if not found then
    raise exception 'learner_observer_invitation_not_found' using errcode = 'P0002';
  end if;
  if v_invitation.status in ('accepted', 'rejected') then
    if v_invitation.recipient_account_id is distinct from v_actor_account_id then
      raise exception 'learner_observer_invitation_not_found' using errcode = 'P0002';
    end if;
  elsif v_invitation.status in ('pending', 'bound')
    and v_invitation.expires_at > now()
  then
    v_was_unbound := v_invitation.recipient_account_id is null;
    update public.learner_observer_invitation as invitation
    set recipient_account_id = v_actor_account_id,
        status = 'bound',
        updated_at = now()
    where invitation.id = v_invitation.id
      and (invitation.recipient_account_id is null
        or invitation.recipient_account_id = v_actor_account_id)
    returning invitation.* into v_invitation;
    if not found then
      raise exception 'learner_observer_invitation_not_found' using errcode = 'P0002';
    end if;
    if v_was_unbound then
      perform public.append_learner_identity_audit(
        'learner_observer_invitation_verified_email_bound',
        v_actor_account_id, v_invitation.subject_account_id,
        v_invitation.learner_profile_id, null, v_invitation.id,
        jsonb_build_object('projectionVersion', 1)
      );
    end if;
  else
    raise exception 'learner_observer_invitation_not_found' using errcode = 'P0002';
  end if;
  return public.preview_email_learner_observer_invitation(
    p_actor_auth_user_id, v_invitation.id,
    v_invitation.token_digest, p_recipient_email_digest
  );
end
$$;

create function public.act_on_verified_email_learner_observer_invitation(
  p_actor_auth_user_id uuid,
  p_invitation_id uuid,
  p_action text,
  p_recipient_email_digest bytea,
  p_relationship_label text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_account_id uuid := public.account_id_for_auth_user(p_actor_auth_user_id);
  v_invitation public.learner_observer_invitation%rowtype;
begin
  perform public.preview_verified_email_learner_observer_invitation(
    p_actor_auth_user_id, p_invitation_id, p_recipient_email_digest
  );
  select invitation.* into v_invitation
  from public.learner_observer_invitation as invitation
  where invitation.id = p_invitation_id
    and invitation.recipient_account_id = v_actor_account_id
    and invitation.recipient_email_digest = p_recipient_email_digest
  for update of invitation;
  if not found then
    raise exception 'learner_observer_invitation_not_found' using errcode = 'P0002';
  end if;
  return public.act_on_email_learner_observer_invitation(
    p_actor_auth_user_id, p_invitation_id, p_action,
    v_invitation.token_digest, p_recipient_email_digest,
    p_relationship_label
  );
end
$$;

create function public.act_on_learner_observer_relationship(
  p_relationship_id uuid,
  p_action text,
  p_relationship_label text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_account_id uuid := public.current_account_id();
  v_grant public.learner_observer_grant%rowtype;
  v_invitation public.learner_observer_invitation%rowtype;
begin
  if not public.learner_identity_rate_limit_hit(
    'observer_relationship_action',
    extensions.digest(
      coalesce(v_actor_account_id::text, '') || ':' || p_relationship_id::text,
      'sha256'
    ),
    30, interval '1 hour', interval '1 hour'
  ) then
    raise exception 'learner_identity_rate_limited' using errcode = 'P0001';
  end if;
  if p_action = 'revoke' then
    select invitation.* into v_invitation
    from public.learner_observer_invitation as invitation
    where invitation.id = p_relationship_id
      and invitation.subject_account_id = v_actor_account_id
      and invitation.status in ('pending', 'bound', 'revoked')
    for update of invitation;
    if found then
      if v_invitation.status <> 'revoked' then
        update public.learner_observer_invitation
        set status = 'revoked', revoked_at = now()
        where id = v_invitation.id;
        perform public.append_learner_identity_audit(
          'learner_observer_invitation_revoked', v_actor_account_id,
          v_actor_account_id, v_invitation.learner_profile_id,
          null, v_invitation.id, jsonb_build_object('projectionVersion', 1)
        );
      end if;
      return public.list_my_learner_observer_overview_for_actor(v_actor_account_id);
    end if;
  end if;

  if p_action in ('accept', 'reject') then
    select invitation.* into v_invitation
    from public.learner_observer_invitation as invitation
    where invitation.id = p_relationship_id
      and invitation.recipient_account_id = v_actor_account_id
      and invitation.status in ('bound', 'accepted', 'rejected')
      and invitation.expires_at > now()
    for update of invitation;
    if not found then
      raise exception 'learner_observer_relationship_not_found' using errcode = 'P0002';
    end if;
    if (v_invitation.status = 'accepted' and p_action = 'accept')
      or (v_invitation.status = 'rejected' and p_action = 'reject')
    then
      return public.list_my_learner_observer_overview_for_actor(v_actor_account_id);
    elsif v_invitation.status in ('accepted', 'rejected') then
      raise exception 'learner_observer_action_already_final' using errcode = '55000';
    end if;
    if p_action = 'accept' then
      insert into public.learner_observer_grant (
        learner_profile_id, subject_account_id, observer_account_id,
        invitation_id, relationship_label
      ) values (
        v_invitation.learner_profile_id, v_invitation.subject_account_id,
        v_actor_account_id, v_invitation.id,
        coalesce(nullif(btrim(p_relationship_label), ''), v_invitation.relationship_label)
      ) on conflict (learner_profile_id, observer_account_id) do update
        set status = 'active', revoked_at = null,
            relationship_label = excluded.relationship_label,
            invitation_id = excluded.invitation_id;
    end if;
    update public.learner_observer_invitation
    set status = case when p_action = 'accept' then 'accepted' else 'rejected' end,
        accepted_at = case when p_action = 'accept' then now() else null end
    where id = v_invitation.id;
    perform public.append_learner_identity_audit(
      'learner_observer_invitation_' || case when p_action = 'accept' then 'accepted' else 'rejected' end,
      v_actor_account_id, v_invitation.subject_account_id,
      v_invitation.learner_profile_id, null, v_invitation.id,
      jsonb_build_object('projectionVersion', 1)
    );
  else
    select grant_row.* into v_grant
    from public.learner_observer_grant as grant_row
    where grant_row.id = p_relationship_id
      and grant_row.status = 'active'
      and (grant_row.subject_account_id = v_actor_account_id
        or grant_row.observer_account_id = v_actor_account_id)
    for update of grant_row;
    if not found then
      raise exception 'learner_observer_relationship_not_found' using errcode = 'P0002';
    end if;
    if p_action = 'revoke' and v_grant.subject_account_id = v_actor_account_id then
      update public.learner_observer_grant
      set status = 'revoked', revoked_at = now()
      where id = v_grant.id;
    elsif p_action = 'leave' and v_grant.observer_account_id = v_actor_account_id then
      update public.learner_observer_grant
      set status = 'left', revoked_at = now()
      where id = v_grant.id;
    elsif p_action = 'rename' and v_grant.subject_account_id = v_actor_account_id
      and (p_relationship_label is null
        or char_length(btrim(p_relationship_label)) <= 80)
    then
      update public.learner_observer_grant
      set relationship_label = nullif(btrim(p_relationship_label), '')
      where id = v_grant.id;
    else
      -- Re-invitation always creates a fresh server-generated token through
      -- create_learner_observer_invitation; no tokenless direct action exists.
      raise exception 'learner_observer_action_not_allowed' using errcode = '42501';
    end if;
    perform public.append_learner_identity_audit(
      'learner_observer_grant_' || p_action, v_actor_account_id,
      v_grant.subject_account_id, v_grant.learner_profile_id,
      null, v_grant.id, jsonb_build_object('projectionVersion', 1)
    );
  end if;
  return public.list_my_learner_observer_overview_for_actor(v_actor_account_id);
end
$$;

create function public.list_my_observed_learner_profiles()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor_account_id uuid := public.current_account_id();
  v_result jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', grant_row.id,
    'learnerProfileId', grant_row.learner_profile_id,
    'subjectLabel', subject.display_name,
    'observerLabel', observer.display_name,
    'relationshipLabel', grant_row.relationship_label,
    'direction', 'observing',
    'createdAt', grant_row.created_at
  ) order by lower(subject.display_name), grant_row.id), '[]'::jsonb)
  into v_result
  from public.learner_observer_grant as grant_row
  join public.account as subject on subject.id = grant_row.subject_account_id
  join public.account as observer on observer.id = grant_row.observer_account_id
  where grant_row.observer_account_id = v_actor_account_id
    and grant_row.status = 'active';
  return v_result;
end
$$;

create function public.get_observed_learner_history(
  p_learner_profile_id uuid,
  p_cursor text default null,
  p_limit integer default 25
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_account_id uuid := public.current_account_id();
  v_grant_id uuid;
begin
  -- Hold the canonical profile before the grant, matching erasure's lock
  -- order. A read that wins completes and its audit row is subsequently
  -- pseudonymized by erasure; a read that loses observes the deleted profile
  -- and cannot append a post-erasure UUID.
  perform 1
  from public.learner_profile as profile
  where profile.id = p_learner_profile_id
  for share of profile;
  if not found then
    raise exception 'observed_learner_profile_not_found' using errcode = 'P0002';
  end if;
  select grant_row.id into v_grant_id
  from public.learner_observer_grant as grant_row
  where grant_row.observer_account_id = v_actor_account_id
    and grant_row.learner_profile_id = p_learner_profile_id
    and grant_row.status = 'active'
  for share of grant_row;
  if not found then
    raise exception 'observed_learner_profile_not_found' using errcode = 'P0002';
  end if;
  perform public.append_learner_identity_audit(
    'learner_observer_history_read', v_actor_account_id, null,
    p_learner_profile_id, null, null,
    jsonb_build_object('projectionVersion', 1)
  );
  return public.learner_safe_history_projection(p_learner_profile_id, p_cursor, p_limit);
end
$$;

create function public.get_observed_learner_progress(
  p_learner_profile_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_account_id uuid := public.current_account_id();
  v_grant_id uuid;
begin
  perform 1
  from public.learner_profile as profile
  where profile.id = p_learner_profile_id
  for share of profile;
  if not found then
    raise exception 'observed_learner_profile_not_found' using errcode = 'P0002';
  end if;
  select grant_row.id into v_grant_id
  from public.learner_observer_grant as grant_row
  where grant_row.observer_account_id = v_actor_account_id
    and grant_row.learner_profile_id = p_learner_profile_id
    and grant_row.status = 'active'
  for share of grant_row;
  if not found then
    raise exception 'observed_learner_profile_not_found' using errcode = 'P0002';
  end if;
  perform public.append_learner_identity_audit(
    'learner_observer_progress_read', v_actor_account_id, null,
    p_learner_profile_id, null, null,
    jsonb_build_object('projectionVersion', 1)
  );
  return public.learner_progress_projection(p_learner_profile_id);
end
$$;

create function public.course_has_effective_learner(
  p_course_id uuid,
  p_learner_profile_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.course_learner as direct
    where direct.course_id = p_course_id
      and direct.learner_profile_id = p_learner_profile_id
    union all
    select 1
    from public.course_learner_group as course_group
    join public.learner_group_member as member
      on member.learner_group_id = course_group.learner_group_id
    where course_group.course_id = p_course_id
      and member.learner_profile_id = p_learner_profile_id
  );
$$;

-- Consent never springs back to life when an audience path is removed and
-- later recreated.  Losing either Course ownership or the final effective
-- learner path permanently invalidates the existing revision; a teacher must
-- issue a new request before the subject can grant access again.
create function public.invalidate_learner_ai_consent_scope(
  p_course_id uuid,
  p_learner_profile_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_account_id uuid := public.current_account_id();
  v_subject_account_id uuid;
  v_consent public.learner_ai_consent%rowtype;
begin
  select profile.account_id into v_subject_account_id
  from public.learner_profile as profile
  where profile.id = p_learner_profile_id;

  for v_consent in
    update public.learner_ai_consent as consent
    set status = 'invalid',
        revision = consent.revision + 1,
        revoked_at = now(),
        updated_at = now()
    where consent.course_id = p_course_id
      and consent.learner_profile_id = p_learner_profile_id
      and consent.status in ('pending', 'active')
      and (
        not exists (
          select 1 from public.course as course
          where course.id = consent.course_id
            and course.owner_account_id = consent.owner_account_id
        )
        or not public.course_has_effective_learner(
          consent.course_id, consent.learner_profile_id
        )
      )
    returning consent.*
  loop
    perform public.append_learner_identity_audit(
      'learner_ai_consent_invalidated', v_actor_account_id,
      v_subject_account_id, v_consent.learner_profile_id,
      null, v_consent.id,
      jsonb_build_object(
        'revision', v_consent.revision,
        'projectionVersion', 1
      )
    );
  end loop;
end
$$;

create function public.invalidate_learner_ai_consent_on_course_owner_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid;
begin
  if new.owner_account_id is distinct from old.owner_account_id then
    for v_profile_id in
      select distinct consent.learner_profile_id
      from public.learner_ai_consent as consent
      where consent.course_id = new.id
        and consent.status in ('pending', 'active')
    loop
      perform public.invalidate_learner_ai_consent_scope(new.id, v_profile_id);
    end loop;
  end if;
  return new;
end
$$;

create function public.invalidate_learner_ai_consent_on_direct_audience_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    perform public.invalidate_learner_ai_consent_scope(
      old.course_id, old.learner_profile_id
    );
  elsif old.course_id is distinct from new.course_id
    or old.learner_profile_id is distinct from new.learner_profile_id
  then
    perform public.invalidate_learner_ai_consent_scope(
      old.course_id, old.learner_profile_id
    );
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end
$$;

create function public.invalidate_learner_ai_consent_on_course_group_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid;
begin
  if tg_op = 'DELETE' then
    for v_profile_id in
      select member.learner_profile_id
      from public.learner_group_member as member
      where member.learner_group_id = old.learner_group_id
    loop
      perform public.invalidate_learner_ai_consent_scope(
        old.course_id, v_profile_id
      );
    end loop;
  elsif old.course_id is distinct from new.course_id
    or old.learner_group_id is distinct from new.learner_group_id
  then
    for v_profile_id in
      select member.learner_profile_id
      from public.learner_group_member as member
      where member.learner_group_id = old.learner_group_id
    loop
      perform public.invalidate_learner_ai_consent_scope(
        old.course_id, v_profile_id
      );
    end loop;
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end
$$;

create function public.invalidate_learner_ai_consent_on_group_member_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_course_id uuid;
begin
  if tg_op = 'DELETE' then
    for v_course_id in
      select course_group.course_id
      from public.course_learner_group as course_group
      where course_group.learner_group_id = old.learner_group_id
    loop
      perform public.invalidate_learner_ai_consent_scope(
        v_course_id, old.learner_profile_id
      );
    end loop;
  elsif old.learner_group_id is distinct from new.learner_group_id
    or old.learner_profile_id is distinct from new.learner_profile_id
  then
    for v_course_id in
      select course_group.course_id
      from public.course_learner_group as course_group
      where course_group.learner_group_id = old.learner_group_id
    loop
      perform public.invalidate_learner_ai_consent_scope(
        v_course_id, old.learner_profile_id
      );
    end loop;
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end
$$;

create trigger trg_course_invalidate_learner_ai_consent_owner
after update of owner_account_id on public.course
for each row execute function public.invalidate_learner_ai_consent_on_course_owner_change();

create trigger trg_course_learner_invalidate_ai_consent
after delete or update of course_id, learner_profile_id on public.course_learner
for each row execute function public.invalidate_learner_ai_consent_on_direct_audience_change();

create trigger trg_course_learner_group_invalidate_ai_consent
after delete or update of course_id, learner_group_id on public.course_learner_group
for each row execute function public.invalidate_learner_ai_consent_on_course_group_change();

create trigger trg_learner_group_member_invalidate_ai_consent
after delete or update of learner_group_id, learner_profile_id on public.learner_group_member
for each row execute function public.invalidate_learner_ai_consent_on_group_member_change();

create function public.request_learner_ai_consent(
  p_course_id uuid,
  p_learner_profile_id uuid,
  p_purpose text,
  p_expires_in_days integer default 90
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_account_id uuid := public.current_account_id();
  v_subject_account_id uuid;
  v_consent public.learner_ai_consent%rowtype;
begin
  if p_purpose is null or btrim(p_purpose) = ''
    or char_length(btrim(p_purpose)) > 400
    or p_expires_in_days not between 1 and 365
  then
    raise exception 'learner_ai_consent_request_invalid' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.course as course
    where course.id = p_course_id and course.owner_account_id = v_actor_account_id
  ) or not public.course_has_effective_learner(p_course_id, p_learner_profile_id)
  then
    raise exception 'learner_ai_consent_scope_not_found' using errcode = 'P0002';
  end if;
  select profile.account_id into v_subject_account_id
  from public.learner_profile as profile
  where profile.id = p_learner_profile_id;
  if v_subject_account_id is null then
    raise exception 'learner_ai_consent_subject_unclaimed' using errcode = '55000';
  end if;
  insert into public.learner_ai_consent as target (
    learner_profile_id, course_id, owner_account_id, purpose,
    status, revision, expires_at
  ) values (
    p_learner_profile_id, p_course_id, v_actor_account_id, btrim(p_purpose),
    'pending', 1, now() + make_interval(days => p_expires_in_days)
  ) on conflict (learner_profile_id, course_id, owner_account_id) do update
    set purpose = excluded.purpose,
        status = 'pending',
        revision = target.revision + 1,
        expires_at = excluded.expires_at,
        granted_at = null,
        revoked_at = null
  returning * into v_consent;
  perform public.append_learner_identity_audit(
    'learner_ai_consent_requested', v_actor_account_id,
    v_subject_account_id, p_learner_profile_id, null, v_consent.id,
    jsonb_build_object('revision', v_consent.revision, 'projectionVersion', 1)
  );
  return jsonb_build_object(
    'id', v_consent.id,
    'learnerProfileId', v_consent.learner_profile_id,
    'courseId', v_consent.course_id,
    'courseTitle', (select title from public.course where id = v_consent.course_id),
    'ownerLabel', (select display_name from public.account where id = v_consent.owner_account_id),
    'purpose', v_consent.purpose,
    'status', v_consent.status,
    'revision', v_consent.revision,
    'expiresAt', v_consent.expires_at,
    'createdAt', v_consent.created_at,
    'grantedAt', v_consent.granted_at,
    'revokedAt', v_consent.revoked_at
  );
end
$$;

create function public.list_my_learner_ai_consents()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor_account_id uuid := public.current_account_id();
  v_profile_id uuid := public.current_owned_learner_profile_id();
  v_result jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', consent.id,
    'learnerProfileId', consent.learner_profile_id,
    'courseId', consent.course_id,
    'courseTitle', course.title,
    'ownerLabel', owner.display_name,
    'purpose', consent.purpose,
    'status', case
      when course.owner_account_id <> consent.owner_account_id
        or not public.course_has_effective_learner(consent.course_id, consent.learner_profile_id)
        then 'invalid'
      when consent.status in ('pending','active') and consent.expires_at <= now()
        then 'expired'
      else consent.status
    end,
    'revision', consent.revision,
    'expiresAt', consent.expires_at,
    'createdAt', consent.created_at,
    'grantedAt', consent.granted_at,
    'revokedAt', consent.revoked_at
  ) order by consent.created_at desc), '[]'::jsonb)
  into v_result
  from public.learner_ai_consent as consent
  join public.course as course on course.id = consent.course_id
  join public.account as owner on owner.id = consent.owner_account_id
  where consent.learner_profile_id = v_profile_id
    and v_actor_account_id is not null;
  return v_result;
end
$$;

create function public.act_on_learner_ai_consent(
  p_consent_id uuid,
  p_action text,
  p_expected_revision integer,
  p_expires_in_days integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_account_id uuid := public.current_account_id();
  v_consent public.learner_ai_consent%rowtype;
  v_course public.course%rowtype;
begin
  if p_action not in ('grant', 'revoke')
    or p_expected_revision is null or p_expected_revision < 1
    or (p_expires_in_days is not null and p_expires_in_days not between 1 and 365)
  then
    raise exception 'learner_ai_consent_action_invalid' using errcode = '22023';
  end if;
  select consent.* into v_consent
  from public.learner_ai_consent as consent
  join public.learner_profile as profile on profile.id = consent.learner_profile_id
  where consent.id = p_consent_id
    and profile.account_id = v_actor_account_id
  for update of consent;
  if not found then
    raise exception 'learner_ai_consent_not_found' using errcode = 'P0002';
  end if;
  if v_consent.revision <> p_expected_revision then
    raise exception 'learner_ai_consent_revision_stale' using errcode = '40001';
  end if;
  select course.* into v_course from public.course as course
  where course.id = v_consent.course_id for update of course;
  if p_action = 'grant' and (
    v_course.owner_account_id <> v_consent.owner_account_id
    or not public.course_has_effective_learner(v_consent.course_id, v_consent.learner_profile_id)
  ) then
    raise exception 'learner_ai_consent_scope_invalid' using errcode = '55000';
  end if;
  update public.learner_ai_consent
  set status = case when p_action = 'grant' then 'active' else 'revoked' end,
      revision = revision + 1,
      expires_at = case when p_action = 'grant'
        then now() + make_interval(days => coalesce(p_expires_in_days, 90))
        else expires_at end,
      granted_at = case when p_action = 'grant' then now() else granted_at end,
      revoked_at = case when p_action = 'revoke' then now() else null end
  where id = v_consent.id
  returning * into v_consent;
  perform public.append_learner_identity_audit(
    'learner_ai_consent_' || case when p_action = 'grant' then 'granted' else 'revoked' end,
    v_actor_account_id, v_actor_account_id, v_consent.learner_profile_id,
    null, v_consent.id,
    jsonb_build_object('revision', v_consent.revision, 'projectionVersion', 1)
  );
  return jsonb_build_object(
    'id', v_consent.id,
    'learnerProfileId', v_consent.learner_profile_id,
    'courseId', v_consent.course_id,
    'courseTitle', v_course.title,
    'ownerLabel', (select display_name from public.account where id = v_consent.owner_account_id),
    'purpose', v_consent.purpose,
    'status', v_consent.status,
    'revision', v_consent.revision,
    'expiresAt', v_consent.expires_at,
    'createdAt', v_consent.created_at,
    'grantedAt', v_consent.granted_at,
    'revokedAt', v_consent.revoked_at
  );
end
$$;

create function public.build_cross_provider_learner_context(
  p_actor_auth_user_id uuid,
  p_course_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_account_id uuid := public.account_id_for_auth_user(p_actor_auth_user_id);
  v_grant_count integer;
  v_revision text;
  v_aggregates jsonb;
  v_comments jsonb;
begin
  if v_actor_account_id is null or not exists (
    select 1 from public.course as course
    where course.id = p_course_id
      and course.owner_account_id = v_actor_account_id
  ) then
    raise exception 'course_not_found' using errcode = 'P0002';
  end if;

  with valid_consents as (
    select consent.*
    from public.learner_ai_consent as consent
    join public.course as course on course.id = consent.course_id
    where consent.course_id = p_course_id
      and consent.owner_account_id = v_actor_account_id
      and course.owner_account_id = consent.owner_account_id
      and consent.status = 'active'
      and consent.expires_at > now()
      and public.course_has_effective_learner(
        consent.course_id, consent.learner_profile_id
      )
  )
  select
    count(*)::integer,
    coalesce(encode(extensions.digest(
      string_agg(id::text || ':' || revision::text || ':' || expires_at::text, ',' order by id),
      'sha256'
    ), 'hex'), repeat('0', 64))
  into v_grant_count, v_revision
  from valid_consents;

  if v_grant_count = 0 then
    return jsonb_build_object(
      'used', false,
      'revision', repeat('0', 64),
      'projectionVersion', 1,
      'aggregates', jsonb_build_object(
        'conductedCount', 0,
        'presentCount', 0,
        'absentCount', 0,
        'repeatCount', 0,
        'knownDurationCount', 0,
        'actualDurationMinutes', 0,
        'subjectBreakdown', '[]'::jsonb
      ),
      'sharedCommentSummaries', '[]'::jsonb
    );
  end if;

  with valid_profiles as (
    select consent.learner_profile_id
    from public.learner_ai_consent as consent
    join public.course as course on course.id = consent.course_id
    where consent.course_id = p_course_id
      and consent.owner_account_id = v_actor_account_id
      and course.owner_account_id = consent.owner_account_id
      and consent.status = 'active' and consent.expires_at > now()
      and public.course_has_effective_learner(consent.course_id, consent.learner_profile_id)
  ), records as (
    select record.*,
      case
        when lower(coalesce(record.subject_at_time, '')) ~ '(матем|алгеб|геомет)' then 'Математика'
        when lower(coalesce(record.subject_at_time, '')) ~ '(русс|литерат|язык)' then 'Язык и литература'
        when lower(coalesce(record.subject_at_time, '')) ~ '(физик|хим|биол|естеств)' then 'Естественные науки'
        when lower(coalesce(record.subject_at_time, '')) ~ '(истор|обществ|геогр)' then 'Общественные науки'
        when lower(coalesce(record.subject_at_time, '')) ~ '(информ|програм)' then 'Технологии'
        when lower(coalesce(record.subject_at_time, '')) ~ '(музык|искус|рисов)' then 'Искусство'
        else 'Другое'
      end as subject_bucket
    from public.learning_record as record
    join valid_profiles on valid_profiles.learner_profile_id = record.learner_profile_id
    where record.occurred_at is not null
      and record.superseded_by_record_id is null
  ), subject_counts as (
    select subject_bucket, least(count(*), 10000)::integer as count
    from records group by subject_bucket
  )
  select jsonb_strip_nulls(jsonb_build_object(
    'conductedCount', least(count(*), 10000)::integer,
    'presentCount', least(count(*) filter (where was_present), 10000)::integer,
    'absentCount', least(count(*) filter (where not was_present), 10000)::integer,
    'repeatCount', least(count(*) filter (where needs_repeat is true), 10000)::integer,
    'knownDurationCount', least(count(actual_duration_minutes_at_time)
      filter (where was_present), 10000)::integer,
    'actualDurationMinutes', coalesce(
      least(
        sum(actual_duration_minutes_at_time) filter (where was_present),
        10000000
      ), 0
    )::integer,
    'lastActivityMonth', to_char(date_trunc('month', max(occurred_at)), 'YYYY-MM'),
    'subjectBreakdown', coalesce((select jsonb_agg(jsonb_build_object(
      'subjectBucket', subject_bucket, 'count', count
    ) order by subject_bucket) from subject_counts), '[]'::jsonb)
  )) into v_aggregates
  from records;

  with valid_profiles as (
    select consent.learner_profile_id
    from public.learner_ai_consent as consent
    join public.course as course on course.id = consent.course_id
    where consent.course_id = p_course_id
      and consent.owner_account_id = v_actor_account_id
      and course.owner_account_id = consent.owner_account_id
      and consent.status = 'active' and consent.expires_at > now()
      and public.course_has_effective_learner(consent.course_id, consent.learner_profile_id)
  ), safe_comment_categories as (
    -- Never quote or truncate the source comment. Even aggressive regex PII
    -- replacement leaves names, addresses, institutions and novel contacts.
    -- The cross-provider boundary emits one deterministic value from this
    -- closed vocabulary, with a non-informative fallback.
    select distinct case
      when lower(record.teacher_comment)
        ~ '(сложн|трудн|затруд|ошиб|не понима|поддержк)'
        then 'Требуется дополнительная учебная поддержка.'
      when lower(record.teacher_comment)
        ~ '(повтор|закреп|практик|тренир|упражнен)'
        then 'Рекомендовано повторение и дополнительная практика.'
      when lower(record.teacher_comment)
        ~ '(прогресс|улучш|успех|справил|верно|хорош)'
        then 'Отмечена положительная учебная динамика.'
      when lower(record.teacher_comment)
        ~ '(вниман|сосредоточ|концентрац)'
        then 'Отмечены особенности внимания и концентрации.'
      when lower(record.teacher_comment)
        ~ '(актив|участв|вовлеч|отвечал|инициатив)'
        then 'Отмечено активное участие в занятиях.'
      when lower(record.teacher_comment)
        ~ '(темп|медлен|быстр)'
        then 'Отмечен индивидуальный темп учебной работы.'
      else 'Есть опубликованное наблюдение преподавателя.'
    end as summary
    from public.learning_record as record
    join valid_profiles on valid_profiles.learner_profile_id = record.learner_profile_id
    where record.occurred_at is not null
      and record.superseded_by_record_id is null
      and record.shared_with_learner_at is not null
      and record.teacher_comment is not null
    order by summary
    limit 20
  )
  select coalesce(jsonb_agg(summary order by summary), '[]'::jsonb)
  into v_comments from safe_comment_categories;

  perform public.append_learner_identity_audit(
    'learner_ai_cross_provider_context_used', v_actor_account_id,
    null, null, null, p_course_id,
    jsonb_build_object(
      'grantCount', v_grant_count,
      'projectionVersion', 1,
      'revision', v_revision
    )
  );
  return jsonb_build_object(
    'used', true,
    'revision', v_revision,
    'projectionVersion', 1,
    'aggregates', v_aggregates,
    'sharedCommentSummaries', v_comments
  );
end
$$;

-- Explicit function capability matrix. PUBLIC is revoked first even on roles
-- that currently receive EXECUTE through no default privilege, so a future
-- owner/default change cannot widen this release accidentally.
do $$
declare
  v_signature text;
begin
  foreach v_signature in array array[
    'public.append_learner_identity_audit(text,uuid,uuid,uuid,uuid,uuid,jsonb)',
    'public.account_id_for_auth_user(uuid)',
    'public.current_owned_learner_profile_id()',
    'public.resolve_learner_profile_alias(uuid)',
    'public.learner_safe_history_projection(uuid,text,integer)',
    'public.learner_progress_projection(uuid)',
    'public.learner_profile_merge_preview_for_actor(uuid,uuid)',
    'public.execute_learner_profile_merge_for_actor(uuid,uuid,text)',
    'public.learner_safe_unlink_preview_for_actor(uuid)',
    'public.learner_erasure_state_for_actor(uuid,uuid)',
    'public.list_my_learner_observer_overview_for_actor(uuid)',
    'public.course_has_effective_learner(uuid,uuid)',
    'public.invalidate_learner_ai_consent_scope(uuid,uuid)',
    'public.invalidate_learner_ai_consent_on_course_owner_change()',
    'public.invalidate_learner_ai_consent_on_direct_audience_change()',
    'public.invalidate_learner_ai_consent_on_course_group_change()',
    'public.invalidate_learner_ai_consent_on_group_member_change()',
    'public.start_lesson_run(uuid,timestamptz)',
    'public.complete_lesson_run(uuid,jsonb,text,timestamptz)',
    'public.complete_lesson_run_v2(uuid,jsonb,text,timestamptz,integer)',
    'public.preview_learner_profile_merge(uuid)',
    'public.confirm_learner_profile_merge(uuid,text)',
    'public.cancel_learner_profile_merge(uuid)',
    'public.list_teacher_learner_directory(text)',
    'public.archive_learner_profile(uuid)',
    'public.restore_teacher_learner(uuid)',
    'public.delete_empty_offline_learner_profile(uuid)',
    'public.resolve_teacher_learner_profile_alias(uuid,uuid)',
    'public.rotate_my_learner_share_code(uuid,bytea,timestamptz)',
    'public.create_learner_connection_request(uuid,text,bytea,bytea,uuid,text,timestamptz)',
    'public.list_learner_connection_requests()',
    'public.act_on_learner_connection_request(uuid,text)',
    'public.preview_email_learner_connection_request(uuid,uuid,bytea,bytea)',
    'public.act_on_email_learner_connection_request(uuid,uuid,text,bytea,bytea)',
    'public.preview_verified_email_learner_connection_request(uuid,uuid,bytea)',
    'public.act_on_verified_email_learner_connection_request(uuid,uuid,text,bytea)',
    'public.create_learner_profile_invitation(uuid,uuid,text,bytea,bytea,timestamptz)',
    'public.list_learner_profile_invitations(uuid)',
    'public.revoke_learner_profile_invitation(uuid)',
    'public.preview_learner_profile_invitation(uuid,uuid,bytea,bytea)',
    'public.act_on_learner_profile_invitation(uuid,uuid,bytea,bytea,text)',
    'public.activate_offline_learner_account_impl(uuid,uuid,bytea,bytea,text,text,uuid,boolean,boolean)',
    'public.activate_offline_learner_account(uuid,uuid,bytea,bytea,text,text,uuid,boolean,boolean)',
    'public.preview_verified_learner_profile_invitation(uuid,uuid,bytea)',
    'public.act_on_verified_learner_profile_invitation(uuid,uuid,bytea,text)',
    'public.activate_verified_offline_learner_account(uuid,uuid,bytea,text,text,uuid,boolean,boolean)',
    'public.list_recoverable_learner_credentials(uuid)',
    'public.reset_recoverable_learner_credentials_impl(uuid,uuid,text,text,timestamptz,uuid)',
    'public.reset_recoverable_learner_credentials(uuid,uuid,text,text,timestamptz,uuid)',
    'public.list_my_learner_credential_recovery_delegates()',
    'public.revoke_my_learner_credential_recovery_delegate(uuid)',
    'public.get_my_learning_profile()',
    'public.get_my_learning_history(text,integer)',
    'public.get_my_learning_progress()',
    'public.preview_my_learner_profile_unlink()',
    'public.confirm_my_learner_profile_unlink(uuid,text)',
    'public.preview_my_learning_data_erasure()',
    'public.confirm_my_learning_data_erasure(uuid,text)',
    'public.create_learner_observer_invitation(uuid,bytea,bytea,text,timestamptz)',
    'public.list_my_learner_observer_overview()',
    'public.preview_email_learner_observer_invitation(uuid,uuid,bytea,bytea)',
    'public.act_on_email_learner_observer_invitation(uuid,uuid,text,bytea,bytea,text)',
    'public.preview_verified_email_learner_observer_invitation(uuid,uuid,bytea)',
    'public.act_on_verified_email_learner_observer_invitation(uuid,uuid,text,bytea,text)',
    'public.act_on_learner_observer_relationship(uuid,text,text)',
    'public.list_my_observed_learner_profiles()',
    'public.get_observed_learner_history(uuid,text,integer)',
    'public.get_observed_learner_progress(uuid)',
    'public.request_learner_ai_consent(uuid,uuid,text,integer)',
    'public.list_my_learner_ai_consents()',
    'public.act_on_learner_ai_consent(uuid,text,integer,integer)',
    'public.build_cross_provider_learner_context(uuid,uuid)'
  ]
  loop
    execute format(
      'revoke all on function %s from public, anon, authenticated, service_role',
      v_signature
    );
  end loop;
end
$$;

grant execute on function public.start_lesson_run(uuid,timestamptz)
  to authenticated, service_role;
grant execute on function public.complete_lesson_run(uuid,jsonb,text,timestamptz)
  to authenticated, service_role;
grant execute on function public.complete_lesson_run_v2(uuid,jsonb,text,timestamptz,integer)
  to authenticated, service_role;

grant execute on function public.preview_learner_profile_merge(uuid)
  to authenticated, service_role;
grant execute on function public.confirm_learner_profile_merge(uuid,text)
  to authenticated, service_role;
grant execute on function public.cancel_learner_profile_merge(uuid)
  to authenticated, service_role;
grant execute on function public.list_teacher_learner_directory(text)
  to authenticated, service_role;
grant execute on function public.archive_learner_profile(uuid)
  to authenticated, service_role;
grant execute on function public.restore_teacher_learner(uuid)
  to authenticated, service_role;
grant execute on function public.delete_empty_offline_learner_profile(uuid)
  to authenticated, service_role;
grant execute on function public.list_learner_connection_requests()
  to authenticated, service_role;
grant execute on function public.act_on_learner_connection_request(uuid,text)
  to authenticated, service_role;
grant execute on function public.list_learner_profile_invitations(uuid)
  to authenticated, service_role;
grant execute on function public.revoke_learner_profile_invitation(uuid)
  to authenticated, service_role;
grant execute on function public.get_my_learning_profile()
  to authenticated, service_role;
grant execute on function public.get_my_learning_history(text,integer)
  to authenticated, service_role;
grant execute on function public.get_my_learning_progress()
  to authenticated, service_role;
grant execute on function public.preview_my_learner_profile_unlink()
  to authenticated, service_role;
grant execute on function public.preview_my_learning_data_erasure()
  to authenticated, service_role;
grant execute on function public.list_my_learner_credential_recovery_delegates()
  to authenticated, service_role;
grant execute on function public.revoke_my_learner_credential_recovery_delegate(uuid)
  to authenticated, service_role;
grant execute on function public.list_my_learner_observer_overview()
  to authenticated, service_role;
grant execute on function public.act_on_learner_observer_relationship(uuid,text,text)
  to authenticated, service_role;
grant execute on function public.list_my_observed_learner_profiles()
  to authenticated, service_role;
grant execute on function public.get_observed_learner_history(uuid,text,integer)
  to authenticated, service_role;
grant execute on function public.get_observed_learner_progress(uuid)
  to authenticated, service_role;
grant execute on function public.request_learner_ai_consent(uuid,uuid,text,integer)
  to authenticated, service_role;
grant execute on function public.list_my_learner_ai_consents()
  to authenticated, service_role;
grant execute on function public.act_on_learner_ai_consent(uuid,text,integer,integer)
  to authenticated, service_role;

grant execute on function public.resolve_teacher_learner_profile_alias(uuid,uuid)
  to service_role;
grant execute on function public.rotate_my_learner_share_code(uuid,bytea,timestamptz)
  to service_role;
grant execute on function public.create_learner_connection_request(uuid,text,bytea,bytea,uuid,text,timestamptz)
  to service_role;
grant execute on function public.preview_email_learner_connection_request(uuid,uuid,bytea,bytea)
  to service_role;
grant execute on function public.act_on_email_learner_connection_request(uuid,uuid,text,bytea,bytea)
  to service_role;
grant execute on function public.preview_verified_email_learner_connection_request(uuid,uuid,bytea)
  to service_role;
grant execute on function public.act_on_verified_email_learner_connection_request(uuid,uuid,text,bytea)
  to service_role;
grant execute on function public.create_learner_profile_invitation(uuid,uuid,text,bytea,bytea,timestamptz)
  to service_role;
grant execute on function public.preview_learner_profile_invitation(uuid,uuid,bytea,bytea)
  to service_role;
grant execute on function public.act_on_learner_profile_invitation(uuid,uuid,bytea,bytea,text)
  to service_role;
grant execute on function public.activate_offline_learner_account(uuid,uuid,bytea,bytea,text,text,uuid,boolean,boolean)
  to service_role;
grant execute on function public.preview_verified_learner_profile_invitation(uuid,uuid,bytea)
  to service_role;
grant execute on function public.act_on_verified_learner_profile_invitation(uuid,uuid,bytea,text)
  to service_role;
grant execute on function public.activate_verified_offline_learner_account(uuid,uuid,bytea,text,text,uuid,boolean,boolean)
  to service_role;
grant execute on function public.list_recoverable_learner_credentials(uuid)
  to service_role;
grant execute on function public.reset_recoverable_learner_credentials(uuid,uuid,text,text,timestamptz,uuid)
  to service_role;
grant execute on function public.confirm_my_learner_profile_unlink(uuid,text)
  to service_role;
grant execute on function public.confirm_my_learning_data_erasure(uuid,text)
  to service_role;
grant execute on function public.create_learner_observer_invitation(uuid,bytea,bytea,text,timestamptz)
  to service_role;
grant execute on function public.preview_email_learner_observer_invitation(uuid,uuid,bytea,bytea)
  to service_role;
grant execute on function public.act_on_email_learner_observer_invitation(uuid,uuid,text,bytea,bytea,text)
  to service_role;
grant execute on function public.preview_verified_email_learner_observer_invitation(uuid,uuid,bytea)
  to service_role;
grant execute on function public.act_on_verified_email_learner_observer_invitation(uuid,uuid,text,bytea,text)
  to service_role;
grant execute on function public.build_cross_provider_learner_context(uuid,uuid)
  to service_role;

do $$
declare
  v_table_name text;
  v_signature text;
begin
  foreach v_table_name in array array[
    'account_login_alias', 'account_security', 'account_preference',
    'learner_profile_share_code', 'learner_connection_request',
    'learner_claim_invitation', 'learner_profile_merge',
    'learner_profile_merge_conflict', 'learner_profile_merge_private_detail',
    'learner_profile_alias', 'learner_observer_invitation',
    'learner_observer_grant', 'learner_ai_consent',
    'learner_identity_audit_event', 'learner_identity_rate_limit',
    'learner_erasure_request', 'learner_credential_recovery_delegate',
    'learner_identity_reconciliation'
  ]
  loop
    if not exists (
      select 1 from pg_class as relation
      join pg_namespace as namespace on namespace.oid = relation.relnamespace
      where namespace.nspname = 'public'
        and relation.relname = v_table_name
        and relation.relrowsecurity
    ) then
      raise exception 'learner_identity_workflows_postflight_rls_missing: %', v_table_name;
    end if;
    if has_table_privilege('anon', 'public.' || v_table_name, 'SELECT')
      or has_table_privilege('authenticated', 'public.' || v_table_name, 'SELECT')
      or has_table_privilege('anon', 'public.' || v_table_name, 'INSERT')
      or has_table_privilege('authenticated', 'public.' || v_table_name, 'INSERT')
    then
      raise exception 'learner_identity_workflows_postflight_table_grant_wide: %', v_table_name;
    end if;
  end loop;

  foreach v_signature in array array[
    'public.build_cross_provider_learner_context(uuid,uuid)',
    'public.confirm_my_learning_data_erasure(uuid,text)',
    'public.activate_offline_learner_account(uuid,uuid,bytea,bytea,text,text,uuid,boolean,boolean)',
    'public.preview_verified_learner_profile_invitation(uuid,uuid,bytea)',
    'public.act_on_verified_learner_profile_invitation(uuid,uuid,bytea,text)',
    'public.activate_verified_offline_learner_account(uuid,uuid,bytea,text,text,uuid,boolean,boolean)',
    'public.preview_verified_email_learner_connection_request(uuid,uuid,bytea)',
    'public.act_on_verified_email_learner_connection_request(uuid,uuid,text,bytea)',
    'public.preview_verified_email_learner_observer_invitation(uuid,uuid,bytea)',
    'public.act_on_verified_email_learner_observer_invitation(uuid,uuid,text,bytea,text)',
    'public.list_recoverable_learner_credentials(uuid)',
    'public.reset_recoverable_learner_credentials(uuid,uuid,text,text,timestamptz,uuid)'
  ]
  loop
    if has_function_privilege('authenticated', v_signature, 'EXECUTE')
      or has_function_privilege('anon', v_signature, 'EXECUTE')
    then
      raise exception
        'learner_identity_workflows_postflight_service_boundary_wide: %',
        v_signature;
    end if;
  end loop;

  if exists (
    select 1 from public.lesson_run
    where actual_duration_minutes is not null
  ) then
    raise exception 'learner_identity_workflows_postflight_duration_was_backfilled';
  end if;
  if exists (
    select 1 from public.learning_record
    where shared_with_learner_at is not null
      or actual_duration_minutes_at_time is not null
      or superseded_by_record_id is not null
  ) then
    raise exception 'learner_identity_workflows_postflight_record_fields_were_backfilled';
  end if;
end
$$;

notify pgrst, 'reload schema';

commit;
