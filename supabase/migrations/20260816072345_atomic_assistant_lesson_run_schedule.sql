begin;

-- CC1 exposes signed assistant scheduling proposals. This narrow optimistic
-- boundary turns the proposal's exact Run/audience snapshot into one atomic
-- compare-and-schedule transaction without changing the canonical scheduler.

do $preflight$
begin
  if to_regclass('public.account') is null
    or to_regclass('public.course') is null
    or to_regclass('public.lesson') is null
    or to_regclass('public.lesson_run') is null
    or to_regclass('public.learning_record') is null
    or to_regclass('public.assistant_conversation') is null
    or to_regprocedure(
      'public.schedule_lesson_run(uuid,timestamp with time zone,integer,uuid[],uuid)'
    ) is null
    or to_regprocedure(
      'public.schedule_lesson_run_if_unchanged(uuid,timestamp with time zone,integer,uuid,timestamp with time zone,uuid[])'
    ) is not null
  then
    raise exception 'shidao_atomic_assistant_schedule_preflight_failed'
      using errcode = 'P0001';
  end if;
end
$preflight$;

create function public.schedule_lesson_run_if_unchanged(
  p_lesson_id uuid,
  p_scheduled_at timestamptz,
  p_planned_duration_minutes integer,
  p_expected_lesson_run_id uuid,
  p_expected_lesson_run_updated_at timestamptz,
  p_expected_learner_profile_ids uuid[]
)
returns public.lesson_run
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_actor_user_id uuid := (select auth.uid());
  v_teacher_account_id uuid;
  v_course_id uuid;
  v_expected_learner_profile_ids uuid[];
  v_current_learner_profile_ids uuid[];
  v_run public.lesson_run%rowtype;
  v_result public.lesson_run%rowtype;
begin
  if v_actor_user_id is null then
    raise exception 'lesson_not_found' using errcode = 'P0002';
  end if;

  if p_lesson_id is null
    or p_scheduled_at is null
    or p_planned_duration_minutes is null
    or p_planned_duration_minutes not between 5 and 480
    or p_expected_learner_profile_ids is null
    or array_position(p_expected_learner_profile_ids, null) is not null
    or cardinality(p_expected_learner_profile_ids) > 200
    or (
      (p_expected_lesson_run_id is null)
      <> (p_expected_lesson_run_updated_at is null)
    )
  then
    raise exception 'lesson_run_guard_invalid' using errcode = '22023';
  end if;

  select coalesce(
    array_agg(requested.id order by requested.id),
    '{}'::uuid[]
  )
  into v_expected_learner_profile_ids
  from unnest(p_expected_learner_profile_ids) as requested(id);

  if cardinality(v_expected_learner_profile_ids) <> (
    select count(distinct requested.id)
    from unnest(p_expected_learner_profile_ids) as requested(id)
  ) then
    raise exception 'lesson_run_guard_invalid' using errcode = '22023';
  end if;

  select course.owner_account_id, course.id
  into v_teacher_account_id, v_course_id
  from public.lesson as lesson
  join public.course as course on course.id = lesson.course_id
  join public.account as account on account.id = course.owner_account_id
  where lesson.id = p_lesson_id
    and account.auth_user_id = v_actor_user_id;

  if not found then
    raise exception 'lesson_not_found' using errcode = 'P0002';
  end if;

  -- Match schedule_lesson_run's lock order. Supported Course audience and
  -- group-member mutations take the same Account/Course locks, while the Run
  -- row plus its FK-protected records freeze the existing draft roster.
  perform 1
  from public.account as account
  where account.id = v_teacher_account_id
    and account.auth_user_id = v_actor_user_id
  for update of account;

  if not found then
    raise exception 'lesson_not_found' using errcode = 'P0002';
  end if;

  perform 1
  from public.course as course
  where course.id = v_course_id
    and course.owner_account_id = v_teacher_account_id
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

  select run.*
  into v_run
  from public.lesson_run as run
  where run.lesson_id = p_lesson_id
    and run.ended_at is null
    and run.cancelled_at is null
  for update of run;

  if v_run.id is not null then
    perform record.id
    from public.learning_record as record
    where record.lesson_run_id = v_run.id
    order by record.id
    for update of record;

    select coalesce(
      array_agg(record.learner_profile_id order by record.learner_profile_id),
      '{}'::uuid[]
    )
    into v_current_learner_profile_ids
    from public.learning_record as record
    where record.lesson_run_id = v_run.id
      and record.occurred_at is null;
  else
    -- The Course row serializes direct/group link replacement. Locking every
    -- currently linked Group blocks new member inserts through its FK, while
    -- member/relation row locks also close legacy delete/archive paths that do
    -- not acquire the old Course lock before changing effective membership.
    perform learner_group.id
    from public.learner_group as learner_group
    join public.course_learner_group as course_group
      on course_group.learner_group_id = learner_group.id
    where course_group.course_id = v_course_id
    order by learner_group.id
    for update of learner_group;

    perform member.learner_group_id, member.learner_profile_id
    from public.learner_group_member as member
    join public.course_learner_group as course_group
      on course_group.learner_group_id = member.learner_group_id
    where course_group.course_id = v_course_id
    order by member.learner_group_id, member.learner_profile_id
    for update of member;

    perform teacher_learner.learner_profile_id
    from public.teacher_learner as teacher_learner
    where teacher_learner.teacher_account_id = v_teacher_account_id
      and teacher_learner.learner_profile_id in (
        select course_learner.learner_profile_id
        from public.course_learner as course_learner
        where course_learner.course_id = v_course_id
        union
        select member.learner_profile_id
        from public.course_learner_group as course_group
        join public.learner_group_member as member
          on member.learner_group_id = course_group.learner_group_id
        where course_group.course_id = v_course_id
      )
    order by teacher_learner.learner_profile_id
    for update of teacher_learner;

    select coalesce(
      array_agg(effective.id order by effective.id),
      '{}'::uuid[]
    )
    into v_current_learner_profile_ids
    from (
      select course_learner.learner_profile_id as id
      from public.course_learner as course_learner
      join public.teacher_learner as teacher_learner
        on teacher_learner.teacher_account_id = v_teacher_account_id
       and teacher_learner.learner_profile_id =
         course_learner.learner_profile_id
       and teacher_learner.archived_at is null
      where course_learner.course_id = v_course_id
      union
      select member.learner_profile_id as id
      from public.course_learner_group as course_group
      join public.learner_group_member as member
        on member.learner_group_id = course_group.learner_group_id
      join public.teacher_learner as teacher_learner
        on teacher_learner.teacher_account_id = v_teacher_account_id
       and teacher_learner.learner_profile_id = member.learner_profile_id
       and teacher_learner.archived_at is null
      where course_group.course_id = v_course_id
    ) as effective;
  end if;

  if p_expected_lesson_run_id is null then
    if v_run.id is not null
      or v_current_learner_profile_ids is distinct from
        v_expected_learner_profile_ids
    then
      raise exception 'lesson_run_changed' using errcode = '55000';
    end if;

    select scheduled.*
    into v_result
    from public.schedule_lesson_run(
      p_lesson_id,
      p_scheduled_at,
      p_planned_duration_minutes,
      v_expected_learner_profile_ids,
      null
    ) as scheduled;
  else
    if v_run.id is null
      or v_run.id <> p_expected_lesson_run_id
      or v_run.updated_at is distinct from p_expected_lesson_run_updated_at
      or v_run.started_at is not null
      or v_current_learner_profile_ids is distinct from
        v_expected_learner_profile_ids
    then
      raise exception 'lesson_run_changed' using errcode = '55000';
    end if;

    select scheduled.*
    into v_result
    from public.schedule_lesson_run(
      p_lesson_id,
      p_scheduled_at,
      p_planned_duration_minutes,
      null,
      p_expected_lesson_run_id
    ) as scheduled;
  end if;

  return v_result;
end
$$;

revoke all on function public.schedule_lesson_run_if_unchanged(
  uuid,
  timestamptz,
  integer,
  uuid,
  timestamptz,
  uuid[]
) from public, anon, authenticated, service_role;

grant execute on function public.schedule_lesson_run_if_unchanged(
  uuid,
  timestamptz,
  integer,
  uuid,
  timestamptz,
  uuid[]
) to postgres, authenticated;

do $postflight$
declare
  v_function_oid oid := to_regprocedure(
    'public.schedule_lesson_run_if_unchanged(uuid,timestamp with time zone,integer,uuid,timestamp with time zone,uuid[])'
  );
  v_function record;
begin
  if v_function_oid is null then
    raise exception 'atomic_assistant_schedule_postflight_missing'
      using errcode = 'P0001';
  end if;

  select
    procedure.prosecdef,
    procedure.provolatile,
    procedure.proconfig,
    procedure.prorettype,
    pg_get_functiondef(procedure.oid) as definition
  into v_function
  from pg_proc as procedure
  where procedure.oid = v_function_oid;

  if not v_function.prosecdef
    or v_function.provolatile <> 'v'
    or not v_function.proconfig @> array['search_path=""']::text[]
    or v_function.prorettype <> 'public.lesson_run'::regtype
    or position(
      'schedule_lesson_run(' in v_function.definition
    ) = 0
  then
    raise exception 'atomic_assistant_schedule_postflight_shape_failed'
      using errcode = 'P0001';
  end if;

  if not has_function_privilege(
      'authenticated',
      v_function_oid,
      'EXECUTE'
    )
    or not has_function_privilege('postgres', v_function_oid, 'EXECUTE')
    or has_function_privilege('anon', v_function_oid, 'EXECUTE')
    or has_function_privilege('service_role', v_function_oid, 'EXECUTE')
    or exists (
      select 1
      from pg_proc as procedure
      cross join lateral aclexplode(
        coalesce(
          procedure.proacl,
          acldefault('f', procedure.proowner)
        )
      ) as acl_entry
      where procedure.oid = v_function_oid
        and acl_entry.grantee = 0
        and acl_entry.privilege_type = 'EXECUTE'
    )
  then
    raise exception 'atomic_assistant_schedule_postflight_acl_failed'
      using errcode = 'P0001';
  end if;
end
$postflight$;

notify pgrst, 'reload schema';

commit;
