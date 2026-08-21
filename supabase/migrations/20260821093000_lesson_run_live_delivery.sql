begin;

-- LA-M4 adds an explicit, revocable learner delivery authority for the
-- existing Course -> Lesson -> ordered Components model.  Slides remain only
-- a learner presentation projection.  This migration deliberately does not
-- add learner navigation, attempts, responses, Realtime, a second Run state
-- machine, content snapshots, or backfill capabilities for already-started
-- Runs.

do $preflight$
declare
  v_missing text;
begin
  select string_agg(expected.name, ', ' order by expected.name)
  into v_missing
  from (
    values
      ('account'),
      ('account_security'),
      ('course'),
      ('course_learner'),
      ('course_learner_group'),
      ('learner_group_member'),
      ('learner_profile'),
      ('lesson'),
      ('lesson_component'),
      ('lesson_student_slide'),
      ('lesson_run'),
      ('learning_record')
  ) as expected(name)
  where to_regclass('public.' || expected.name) is null;

  if v_missing is not null
    or to_regclass('auth.sessions') is null
  then
    raise exception
      'shidao_lesson_run_live_delivery_schema_sanity_failed: missing tables: %',
      concat_ws(', ', v_missing, case
        when to_regclass('auth.sessions') is null then 'auth.sessions'
        else null
      end);
  end if;

  if to_regclass('public.course_learner_enrollment') is not null
    or to_regclass('public.lesson_run_execution_capability') is not null
    or to_regclass('public.lesson_run_presentation_state') is not null
    or to_regprocedure(
      'public.get_lesson_run_live_delivery_admin(uuid)'
    ) is not null
    or to_regprocedure(
      'public.set_lesson_run_live_access(uuid,uuid,boolean,boolean)'
    ) is not null
    or to_regprocedure(
      'public.set_lesson_run_presentation_cursor(uuid,uuid,bigint)'
    ) is not null
    or to_regprocedure(
      'public.resolve_lesson_run_live_source_admin(uuid,uuid,uuid)'
    ) is not null
  then
    raise exception
      'shidao_lesson_run_live_delivery_schema_sanity_failed: unexpected LA-M4 objects';
  end if;

  if to_regprocedure(
      'public.start_lesson_run(uuid,timestamp with time zone)'
    ) is null
    or to_regprocedure('public.set_updated_at()') is null
    or not exists (
      select 1
      from pg_catalog.pg_proc as procedure
      where procedure.oid = to_regprocedure(
        'public.cleanup_empty_lesson_student_slide()'
      )
        and not procedure.prosecdef
        and procedure.proconfig @> array['search_path=""']::text[]
        and pg_get_userbyid(procedure.proowner) = 'supabase_admin'
    )
    or not exists (
      select 1
      from pg_catalog.pg_trigger as database_trigger
      where database_trigger.tgrelid =
          to_regclass('public.lesson_component')
        and database_trigger.tgname =
          'trg_lesson_component_cleanup_empty_student_slide'
        and not database_trigger.tgisinternal
        and database_trigger.tgenabled = 'O'
        and database_trigger.tgfoid = to_regprocedure(
          'public.cleanup_empty_lesson_student_slide()'
        )
        and database_trigger.tgtype = 25::smallint
        and coalesce((
          select array_agg(
            attribute.attname::text
            order by attribute.attname::text
          )
          from unnest(database_trigger.tgattr::smallint[])
            as column_ref(attnum)
          join pg_catalog.pg_attribute as attribute
            on attribute.attrelid = database_trigger.tgrelid
           and attribute.attnum = column_ref.attnum
        ), array[]::text[]) = array[
          'lesson_id',
          'student_slide_id',
          'visibility'
        ]::text[]
        and database_trigger.tgqual is null
    )
    or not exists (
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
      where table_schema = 'auth'
        and table_name = 'sessions'
        and column_name = 'id'
        and data_type = 'uuid'
    )
    or not exists (
      select 1
      from information_schema.columns
      where table_schema = 'auth'
        and table_name = 'sessions'
        and column_name = 'user_id'
        and data_type = 'uuid'
    )
    or not exists (
      select 1
      from information_schema.columns
      where table_schema = 'auth'
        and table_name = 'sessions'
        and column_name = 'created_at'
        and data_type = 'timestamp with time zone'
    )
    or not exists (
      select 1
      from information_schema.columns
      where table_schema = 'auth'
        and table_name = 'sessions'
        and column_name = 'not_after'
        and data_type = 'timestamp with time zone'
    )
  then
    raise exception
      'shidao_lesson_run_live_delivery_schema_sanity_failed: canonical head missing';
  end if;
end
$preflight$;

create table public.course_learner_enrollment (
  course_id uuid not null,
  learner_profile_id uuid not null,
  status text not null default 'active',
  revision bigint not null default 1,
  granted_by_account_id uuid not null,
  granted_at timestamptz not null default clock_timestamp(),
  revoked_by_account_id uuid null,
  revoked_at timestamptz null,
  revocation_reason text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint course_learner_enrollment_pkey
    primary key (course_id, learner_profile_id),
  constraint course_learner_enrollment_course_fkey
    foreign key (course_id)
    references public.course(id)
    on delete cascade,
  constraint course_learner_enrollment_profile_fkey
    foreign key (learner_profile_id)
    references public.learner_profile(id)
    on delete cascade,
  constraint course_learner_enrollment_granted_by_fkey
    foreign key (granted_by_account_id)
    references public.account(id)
    on delete restrict,
  constraint course_learner_enrollment_revoked_by_fkey
    foreign key (revoked_by_account_id)
    references public.account(id)
    on delete restrict,
  constraint course_learner_enrollment_status_check check (
    status in ('active', 'revoked')
  ),
  constraint course_learner_enrollment_revision_check check (revision >= 1),
  constraint course_learner_enrollment_revocation_reason_check check (
    revocation_reason is null
    or (
      btrim(revocation_reason) <> ''
      and char_length(btrim(revocation_reason)) <= 80
    )
  ),
  constraint course_learner_enrollment_lifecycle_check check (
    (
      status = 'active'
      and revoked_by_account_id is null
      and revoked_at is null
      and revocation_reason is null
    )
    or (
      status = 'revoked'
      and revoked_at is not null
      and revocation_reason is not null
    )
  )
);

comment on table public.course_learner_enrollment is
  'Explicit revocable Course learner delivery authority; Course audience alone is never authority.';
comment on column public.course_learner_enrollment.revision is
  'Monotonic authority revision; every grant/revoke transition increments it.';

create table public.lesson_run_execution_capability (
  lesson_run_id uuid not null,
  course_id uuid not null,
  learner_profile_id uuid not null,
  enrollment_revision bigint not null,
  status text not null default 'active',
  revision bigint not null default 1,
  granted_by_account_id uuid not null,
  granted_at timestamptz not null default clock_timestamp(),
  revoked_by_account_id uuid null,
  revoked_at timestamptz null,
  revocation_reason text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lesson_run_execution_capability_pkey
    primary key (lesson_run_id, learner_profile_id),
  constraint lesson_run_execution_capability_run_fkey
    foreign key (lesson_run_id)
    references public.lesson_run(id)
    on delete cascade,
  constraint lesson_run_execution_capability_profile_fkey
    foreign key (learner_profile_id)
    references public.learner_profile(id)
    on delete cascade,
  constraint lesson_run_execution_capability_enrollment_fkey
    foreign key (course_id, learner_profile_id)
    references public.course_learner_enrollment(
      course_id,
      learner_profile_id
    )
    on delete cascade,
  constraint lesson_run_execution_capability_granted_by_fkey
    foreign key (granted_by_account_id)
    references public.account(id)
    on delete restrict,
  constraint lesson_run_execution_capability_revoked_by_fkey
    foreign key (revoked_by_account_id)
    references public.account(id)
    on delete restrict,
  constraint lesson_run_execution_capability_status_check check (
    status in ('active', 'revoked')
  ),
  constraint lesson_run_execution_capability_enrollment_revision_check
    check (enrollment_revision >= 1),
  constraint lesson_run_execution_capability_revision_check
    check (revision >= 1),
  constraint lesson_run_execution_capability_revocation_reason_check check (
    revocation_reason is null
    or (
      btrim(revocation_reason) <> ''
      and char_length(btrim(revocation_reason)) <= 80
    )
  ),
  constraint lesson_run_execution_capability_lifecycle_check check (
    (
      status = 'active'
      and revoked_by_account_id is null
      and revoked_at is null
      and revocation_reason is null
    )
    or (
      status = 'revoked'
      and revoked_at is not null
      and revocation_reason is not null
    )
  )
);

comment on table public.lesson_run_execution_capability is
  'Explicit learner execution authority for one frozen LessonRun roster member; a revoked pre-start row is only an exact membership tombstone and never authority.';

create table public.lesson_run_presentation_state (
  lesson_run_id uuid primary key,
  student_slide_id uuid null,
  cursor_version bigint not null default 0,
  changed_by_account_id uuid null,
  changed_at timestamptz not null default clock_timestamp(),
  created_at timestamptz not null default now(),
  constraint lesson_run_presentation_state_run_fkey
    foreign key (lesson_run_id)
    references public.lesson_run(id)
    on delete cascade,
  constraint lesson_run_presentation_state_slide_fkey
    foreign key (student_slide_id)
    references public.lesson_student_slide(id)
    on delete set null,
  constraint lesson_run_presentation_state_changed_by_fkey
    foreign key (changed_by_account_id)
    references public.account(id)
    on delete restrict,
  constraint lesson_run_presentation_state_cursor_version_check
    check (cursor_version >= 0),
  constraint lesson_run_presentation_state_initial_shape_check check (
    cursor_version <> 0
    or (
      student_slide_id is null
      and changed_by_account_id is null
    )
  )
);

comment on table public.lesson_run_presentation_state is
  'Teacher-controlled persisted Student Screen cursor. NULL at revision zero is the explicit waiting state.';

create index course_learner_enrollment_profile_idx
  on public.course_learner_enrollment (learner_profile_id, course_id);
create index lesson_run_execution_capability_profile_idx
  on public.lesson_run_execution_capability (
    learner_profile_id,
    lesson_run_id
  );
create index lesson_run_execution_capability_course_active_idx
  on public.lesson_run_execution_capability (
    course_id,
    learner_profile_id,
    lesson_run_id
  )
  where status = 'active';
create index lesson_run_presentation_state_slide_idx
  on public.lesson_run_presentation_state (student_slide_id)
  where student_slide_id is not null;

alter table public.course_learner_enrollment enable row level security;
alter table public.lesson_run_execution_capability enable row level security;
alter table public.lesson_run_presentation_state enable row level security;

create trigger trg_course_learner_enrollment_updated_at
before update on public.course_learner_enrollment
for each row execute function public.set_updated_at();

create trigger trg_lesson_run_execution_capability_updated_at
before update on public.lesson_run_execution_capability
for each row execute function public.set_updated_at();

create function public.guard_course_learner_enrollment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner_account_id uuid;
  v_owner_account_status text;
  v_course_archived_at timestamptz;
begin
  select
    course.owner_account_id,
    owner_account.status,
    course.archived_at
  into
    v_owner_account_id,
    v_owner_account_status,
    v_course_archived_at
  from public.course as course
  join public.account as owner_account
    on owner_account.id = course.owner_account_id
  where course.id = new.course_id;

  if not found
    or (
      new.status = 'active'
      and new.granted_by_account_id <> v_owner_account_id
    )
    or (
      new.status = 'revoked'
      and new.revoked_by_account_id is not null
      and new.revoked_by_account_id <> v_owner_account_id
    )
  then
    raise exception 'course_live_access_context_invalid'
      using errcode = '23514';
  end if;

  if new.status = 'active'
    and (
      v_course_archived_at is not null
      or v_owner_account_status <> 'active'
      or not exists (
        select 1
        from public.learner_profile as profile
        join public.account as learner_account
          on learner_account.id = profile.account_id
         and learner_account.status = 'active'
        where profile.id = new.learner_profile_id
      )
    )
  then
    raise exception 'course_live_access_learner_not_eligible'
      using errcode = '23514';
  end if;

  return new;
end
$$;

create trigger trg_course_learner_enrollment_guard
before insert or update on public.course_learner_enrollment
for each row execute function public.guard_course_learner_enrollment();

create function public.guard_lesson_run_execution_capability()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'revoked' then
    return new;
  end if;

  if not exists (
    select 1
    from public.lesson_run as run
    join public.lesson as lesson on lesson.id = run.lesson_id
    join public.course as course on course.id = lesson.course_id
    join public.account as owner_account
      on owner_account.id = course.owner_account_id
     and owner_account.status = 'active'
    join public.learning_record as record
      on record.lesson_run_id = run.id
     and record.learner_profile_id = new.learner_profile_id
    join public.course_learner_enrollment as enrollment
      on enrollment.course_id = course.id
     and enrollment.learner_profile_id = new.learner_profile_id
     and enrollment.status = 'active'
     and enrollment.revision = new.enrollment_revision
    join public.learner_profile as profile
      on profile.id = new.learner_profile_id
    join public.account as learner_account
      on learner_account.id = profile.account_id
     and learner_account.status = 'active'
    where run.id = new.lesson_run_id
      and course.id = new.course_id
      and course.archived_at is null
      and run.started_at_is_actual
      and run.started_at is not null
      and run.ended_at is null
      and run.cancelled_at is null
      and record.superseded_by_record_id is null
  ) then
    raise exception 'lesson_run_live_capability_context_invalid'
      using errcode = '23514';
  end if;

  return new;
end
$$;

create trigger trg_lesson_run_execution_capability_guard
before insert or update of
  lesson_run_id,
  course_id,
  learner_profile_id,
  enrollment_revision,
  status
on public.lesson_run_execution_capability
for each row execute function public.guard_lesson_run_execution_capability();

create function public.guard_lesson_run_presentation_state()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.student_slide_id is not null
    and not exists (
      select 1
      from public.lesson_run as run
      join public.lesson_student_slide as slide
        on slide.lesson_id = run.lesson_id
      where run.id = new.lesson_run_id
        and slide.id = new.student_slide_id
    )
  then
    raise exception 'lesson_run_live_slide_context_invalid'
      using errcode = '23514';
  end if;

  return new;
end
$$;

create trigger trg_lesson_run_presentation_state_guard
before insert or update of lesson_run_id, student_slide_id
on public.lesson_run_presentation_state
for each row execute function public.guard_lesson_run_presentation_state();

create function public.clear_deleted_lesson_run_presentation_cursor()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.lesson_run_presentation_state as state
  set student_slide_id = null,
      cursor_version = state.cursor_version + 1,
      changed_by_account_id = null,
      changed_at = clock_timestamp()
  where state.student_slide_id = old.id;

  return old;
end
$$;

create trigger trg_lesson_student_slide_clear_live_cursor
before delete on public.lesson_student_slide
for each row execute function
  public.clear_deleted_lesson_run_presentation_cursor();

create function public.revoke_course_learner_live_access(
  p_course_id uuid,
  p_learner_profile_id uuid,
  p_revoked_by_account_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_revoked_at timestamptz := clock_timestamp();
begin
  if p_course_id is null
    or p_learner_profile_id is null
    or p_revoked_by_account_id is null
    or p_reason is null
    or btrim(p_reason) = ''
    or char_length(btrim(p_reason)) > 80
  then
    raise exception 'course_live_access_revoke_invalid'
      using errcode = '22023';
  end if;

  update public.course_learner_enrollment as enrollment
  set status = 'revoked',
      revision = enrollment.revision + 1,
      revoked_by_account_id = p_revoked_by_account_id,
      revoked_at = v_revoked_at,
      revocation_reason = btrim(p_reason)
  where enrollment.course_id = p_course_id
    and enrollment.learner_profile_id = p_learner_profile_id
    and enrollment.status = 'active';

  update public.lesson_run_execution_capability as capability
  set status = 'revoked',
      revision = capability.revision + 1,
      revoked_by_account_id = p_revoked_by_account_id,
      revoked_at = v_revoked_at,
      revocation_reason = btrim(p_reason)
  where capability.course_id = p_course_id
    and capability.learner_profile_id = p_learner_profile_id
    and capability.status = 'active';
end
$$;

create function public.guard_course_owner_change_with_live_access()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.owner_account_id is distinct from new.owner_account_id
    and exists (
      select 1
      from public.course_learner_enrollment as enrollment
      where enrollment.course_id = old.id
        and enrollment.status = 'active'
    )
  then
    raise exception 'course_live_access_owner_change_blocked'
      using errcode = '55000';
  end if;

  return new;
end
$$;

create function public.revoke_live_access_after_learner_account_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_enrollment record;
begin
  if old.account_id is distinct from new.account_id then
    for v_enrollment in
      select enrollment.course_id, course.owner_account_id
      from public.course_learner_enrollment as enrollment
      join public.course as course on course.id = enrollment.course_id
      where enrollment.learner_profile_id = new.id
        and enrollment.status = 'active'
      order by enrollment.course_id
    loop
      perform public.revoke_course_learner_live_access(
        v_enrollment.course_id,
        new.id,
        v_enrollment.owner_account_id,
        'learner_account_changed'
      );
    end loop;
  end if;

  return new;
end
$$;

create trigger trg_learner_profile_revoke_live_access_on_account_change
after update of account_id
on public.learner_profile
for each row
when (old.account_id is distinct from new.account_id)
execute function public.revoke_live_access_after_learner_account_change();

create trigger trg_course_guard_live_access_owner_change
before update of owner_account_id
on public.course
for each row execute function
  public.guard_course_owner_change_with_live_access();

create function public.revoke_live_access_after_course_archive()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_enrollment record;
begin
  if old.archived_at is null and new.archived_at is not null then
    for v_enrollment in
      select enrollment.learner_profile_id
      from public.course_learner_enrollment as enrollment
      where enrollment.course_id = new.id
        and enrollment.status = 'active'
      order by enrollment.learner_profile_id
    loop
      perform public.revoke_course_learner_live_access(
        new.id,
        v_enrollment.learner_profile_id,
        new.owner_account_id,
        'course_archived'
      );
    end loop;
  end if;

  return new;
end
$$;

create trigger trg_course_revoke_live_access_on_archive
after update of archived_at
on public.course
for each row execute function
  public.revoke_live_access_after_course_archive();

create function public.revoke_live_access_after_account_deactivation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_enrollment record;
begin
  if old.status = 'active' and new.status <> 'active' then
    -- An inactive Course owner cannot leave dormant grants that silently
    -- revive if the Account is later reactivated.
    for v_enrollment in
      select
        enrollment.course_id,
        enrollment.learner_profile_id
      from public.course as course
      join public.course_learner_enrollment as enrollment
        on enrollment.course_id = course.id
       and enrollment.status = 'active'
      where course.owner_account_id = new.id
      order by enrollment.course_id, enrollment.learner_profile_id
    loop
      perform public.revoke_course_learner_live_access(
        v_enrollment.course_id,
        v_enrollment.learner_profile_id,
        new.id,
        'course_owner_account_deactivated'
      );
    end loop;

    -- A linked learner Account becoming provisional/suspended/deleted is an
    -- authority transition, not merely a projection change. Reactivation
    -- therefore requires a fresh explicit owner grant.
    for v_enrollment in
      select
        enrollment.course_id,
        enrollment.learner_profile_id,
        course.owner_account_id
      from public.learner_profile as profile
      join public.course_learner_enrollment as enrollment
        on enrollment.learner_profile_id = profile.id
       and enrollment.status = 'active'
      join public.course as course on course.id = enrollment.course_id
      where profile.account_id = new.id
      order by enrollment.course_id, enrollment.learner_profile_id
    loop
      perform public.revoke_course_learner_live_access(
        v_enrollment.course_id,
        v_enrollment.learner_profile_id,
        v_enrollment.owner_account_id,
        'learner_account_deactivated'
      );
    end loop;
  end if;

  return new;
end
$$;

create trigger trg_account_revoke_live_access_on_deactivation
after update of status
on public.account
for each row
when (old.status = 'active' and new.status <> 'active')
execute function public.revoke_live_access_after_account_deactivation();

create function public.get_lesson_run_live_delivery_admin(
  p_lesson_run_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if p_lesson_run_id is null or (select auth.uid()) is null then
    raise exception 'lesson_run_live_not_found' using errcode = 'P0002';
  end if;

  select jsonb_build_object(
    'run', jsonb_build_object(
      'started', run.started_at_is_actual and run.started_at is not null,
      'ended', run.ended_at is not null or run.cancelled_at is not null
    ),
    'cursor', jsonb_build_object(
      'slideId', presentation.student_slide_id,
      'revision', coalesce(presentation.cursor_version, 0)
    ),
    'slides', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', slide.id,
          'position', slide.position,
          'componentCount', (
            select count(*)::integer
            from public.lesson_component as component
            where component.lesson_id = lesson.id
              and component.student_slide_id = slide.id
              and component.visibility = 'learner_visible'
          )
        )
        order by slide.position
      )
      from public.lesson_student_slide as slide
      where slide.lesson_id = lesson.id
        and exists (
          select 1
          from public.lesson_component as component
          where component.lesson_id = lesson.id
            and component.student_slide_id = slide.id
            and component.visibility = 'learner_visible'
        )
    ), '[]'::jsonb),
    'learners', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'learnerProfileId', member.learner_profile_id,
          'displayName', coalesce(
            teacher_learner.display_name,
            profile.display_name
          ),
          'identityState', case
            when learner_account.status = 'active' then 'claimed'
            else 'offline'
          end,
          'courseAccessEnabled',
            coalesce(
              learner_account.status = 'active'
              and enrollment.status = 'active',
              false
            ),
          'runCapabilityEnabled',
            coalesce(
              learner_account.status = 'active'
              and capability.status = 'active'
              and enrollment.status = 'active'
              and capability.enrollment_revision = enrollment.revision,
              false
            )
        )
        order by
          coalesce(teacher_learner.display_name, profile.display_name),
          member.learner_profile_id
      )
      from (
        select record.learner_profile_id
        from public.learning_record as record
        where record.lesson_run_id = run.id
          and record.superseded_by_record_id is null
        union
        select capability_member.learner_profile_id
        from public.lesson_run_execution_capability as capability_member
        where capability_member.lesson_run_id = run.id
      ) as member
      join public.learner_profile as profile
        on profile.id = member.learner_profile_id
      left join public.account as learner_account
        on learner_account.id = profile.account_id
      left join public.teacher_learner as teacher_learner
        on teacher_learner.teacher_account_id = course.owner_account_id
       and teacher_learner.learner_profile_id = member.learner_profile_id
      left join public.course_learner_enrollment as enrollment
        on enrollment.course_id = course.id
       and enrollment.learner_profile_id = member.learner_profile_id
      left join public.lesson_run_execution_capability as capability
        on capability.lesson_run_id = run.id
       and capability.learner_profile_id = member.learner_profile_id
    ), '[]'::jsonb)
  )
  into v_result
  from public.lesson_run as run
  join public.lesson as lesson on lesson.id = run.lesson_id
  join public.course as course on course.id = lesson.course_id
  join public.account as owner_account
    on owner_account.id = course.owner_account_id
   and owner_account.auth_user_id = (select auth.uid())
   and owner_account.status = 'active'
  left join public.lesson_run_presentation_state as presentation
    on presentation.lesson_run_id = run.id
  where run.id = p_lesson_run_id
    and course.archived_at is null;

  if v_result is null then
    raise exception 'lesson_run_live_not_found' using errcode = 'P0002';
  end if;

  return v_result;
end
$$;

create function public.set_lesson_run_live_access(
  p_lesson_run_id uuid,
  p_learner_profile_id uuid,
  p_course_access_enabled boolean,
  p_run_capability_enabled boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_account_id uuid;
  v_learner_account_id uuid;
  v_course_id uuid;
  v_lesson_id uuid;
  v_run public.lesson_run%rowtype;
  v_enrollment public.course_learner_enrollment%rowtype;
  v_capability public.lesson_run_execution_capability%rowtype;
  v_has_current_record boolean := false;
  v_changed_at timestamptz := clock_timestamp();
begin
  if p_lesson_run_id is null
    or p_learner_profile_id is null
    or p_course_access_enabled is null
    or p_run_capability_enabled is null
    or (not p_course_access_enabled and p_run_capability_enabled)
    or (select auth.uid()) is null
  then
    raise exception 'lesson_run_live_access_invalid'
      using errcode = '22023';
  end if;

  select owner_account.id, course.id, lesson.id
  into v_actor_account_id, v_course_id, v_lesson_id
  from public.lesson_run as run
  join public.lesson as lesson on lesson.id = run.lesson_id
  join public.course as course on course.id = lesson.course_id
  join public.account as owner_account
    on owner_account.id = course.owner_account_id
  where run.id = p_lesson_run_id
    and owner_account.auth_user_id = (select auth.uid())
    and owner_account.status = 'active'
    and course.archived_at is null;

  if not found then
    raise exception 'lesson_run_live_not_found' using errcode = 'P0002';
  end if;

  -- Share the canonical learner transaction lock with merge, erasure,
  -- correction, start materialization and learner reads. All authoritative
  -- values are re-read below after this lock is acquired.
  perform public.lock_learning_activity_learners(
    array[p_learner_profile_id]
  );

  -- Discover the current link without a row lock, then take every Account row
  -- in deterministic UUID order before Profile. Canonical unlink/merge also
  -- use Account -> Profile, so this cannot form a Profile <-> Account cycle.
  select profile.account_id
  into v_learner_account_id
  from public.learner_profile as profile
  where profile.id = p_learner_profile_id;

  if not found then
    raise exception 'lesson_run_live_not_found' using errcode = 'P0002';
  end if;

  perform account.id
  from public.account as account
  where account.id = any(array[
    v_actor_account_id,
    v_learner_account_id
  ])
  order by account.id
  -- Account authority is read-only here. FOR SHARE still serializes status and
  -- identity UPDATEs, while remaining compatible with the FK KEY SHARE locks
  -- used by deferred lesson-run notifications after cancel/complete.
  for share of account;

  if not exists (
    select 1
    from public.account as account
    where account.id = v_actor_account_id
      and account.auth_user_id = (select auth.uid())
      and account.status = 'active'
  ) then
    raise exception 'lesson_run_live_not_found' using errcode = 'P0002';
  end if;

  perform 1
  from public.learner_profile as profile
  where profile.id = p_learner_profile_id
    and profile.account_id is not distinct from v_learner_account_id
  for update of profile;

  if not found then
    raise exception 'lesson_run_live_not_found' using errcode = 'P0002';
  end if;

  perform 1
  from public.course as course
  where course.id = v_course_id
    and course.owner_account_id = v_actor_account_id
    and course.archived_at is null
  for update of course;

  if not found then
    raise exception 'lesson_run_live_not_found' using errcode = 'P0002';
  end if;

  perform 1
  from public.lesson as lesson
  where lesson.id = v_lesson_id
    and lesson.course_id = v_course_id
  for update of lesson;

  if not found then
    raise exception 'lesson_run_live_not_found' using errcode = 'P0002';
  end if;

  select run.*
  into v_run
  from public.lesson_run as run
  where run.id = p_lesson_run_id
    and run.lesson_id = v_lesson_id
  for update of run;

  if not found then
    raise exception 'lesson_run_live_not_found' using errcode = 'P0002';
  end if;

  perform record.id
  from public.learning_record as record
  where record.lesson_run_id = v_run.id
    and record.learner_profile_id = p_learner_profile_id
    and record.superseded_by_record_id is null
  for update of record;

  v_has_current_record := found;

  -- Enrollment is always locked before capability, matching every revocation
  -- helper. A retained exact-Run capability is a narrow membership tombstone
  -- after canonical cancellation deletes the draft LearningRecord.
  select enrollment.*
  into v_enrollment
  from public.course_learner_enrollment as enrollment
  where enrollment.course_id = v_course_id
    and enrollment.learner_profile_id = p_learner_profile_id
  for update of enrollment;

  select capability.*
  into v_capability
  from public.lesson_run_execution_capability as capability
  where capability.lesson_run_id = v_run.id
    and capability.learner_profile_id = p_learner_profile_id
  for update of capability;

  if not v_has_current_record
    and not (
      not p_course_access_enabled
      and not p_run_capability_enabled
      and v_capability.lesson_run_id is not null
    )
  then
    raise exception 'lesson_run_live_not_found' using errcode = 'P0002';
  end if;

  -- Eligibility is intentionally checked only after exact Run membership has
  -- been locked. Otherwise an owner could distinguish an arbitrary existing
  -- offline Profile from a nonexistent/out-of-roster UUID through the 55000
  -- response. The retained-capability path above permits only a full revoke,
  -- never a post-cancellation grant or Run-capability revival.
  if p_course_access_enabled and not exists (
    select 1
    from public.account as learner_account
    where learner_account.id = v_learner_account_id
      and learner_account.status = 'active'
  ) then
    raise exception 'lesson_run_live_learner_not_eligible'
      using errcode = '55000';
  end if;

  if p_course_access_enabled then
    if v_enrollment.course_id is null then
      insert into public.course_learner_enrollment (
        course_id,
        learner_profile_id,
        status,
        revision,
        granted_by_account_id,
        granted_at
      ) values (
        v_course_id,
        p_learner_profile_id,
        'active',
        1,
        v_actor_account_id,
        v_changed_at
      )
      returning * into v_enrollment;
    elsif v_enrollment.status <> 'active' then
      update public.course_learner_enrollment as enrollment
      set status = 'active',
          revision = enrollment.revision + 1,
          granted_by_account_id = v_actor_account_id,
          granted_at = v_changed_at,
          revoked_by_account_id = null,
          revoked_at = null,
          revocation_reason = null
      where enrollment.course_id = v_course_id
        and enrollment.learner_profile_id = p_learner_profile_id
      returning enrollment.* into v_enrollment;
    end if;
  else
    if v_enrollment.course_id is not null
      and v_enrollment.status = 'active'
    then
      perform public.revoke_course_learner_live_access(
        v_course_id,
        p_learner_profile_id,
        v_actor_account_id,
        'teacher_revoked_course_access'
      );
    end if;

    return public.get_lesson_run_live_delivery_admin(p_lesson_run_id);
  end if;

  if p_run_capability_enabled then
    if not v_run.started_at_is_actual
      or v_run.started_at is null
      or v_run.ended_at is not null
      or v_run.cancelled_at is not null
    then
      raise exception 'lesson_run_live_not_open' using errcode = '55000';
    end if;

    insert into public.lesson_run_presentation_state (lesson_run_id)
    values (v_run.id)
    on conflict (lesson_run_id) do nothing;

    if v_capability.lesson_run_id is null then
      insert into public.lesson_run_execution_capability (
        lesson_run_id,
        course_id,
        learner_profile_id,
        enrollment_revision,
        status,
        revision,
        granted_by_account_id,
        granted_at
      ) values (
        v_run.id,
        v_course_id,
        p_learner_profile_id,
        v_enrollment.revision,
        'active',
        1,
        v_actor_account_id,
        v_changed_at
      );
    elsif v_capability.status <> 'active'
      or v_capability.enrollment_revision <> v_enrollment.revision
    then
      update public.lesson_run_execution_capability as capability
      set course_id = v_course_id,
          enrollment_revision = v_enrollment.revision,
          status = 'active',
          revision = capability.revision + 1,
          granted_by_account_id = v_actor_account_id,
          granted_at = v_changed_at,
          revoked_by_account_id = null,
          revoked_at = null,
          revocation_reason = null
      where capability.lesson_run_id = v_run.id
        and capability.learner_profile_id = p_learner_profile_id;
    end if;
  elsif v_capability.lesson_run_id is null then
    -- Preserve exact scheduled-Run membership even if canonical cancellation
    -- later deletes the draft LearningRecord. This revoked row is not learner
    -- authority; actual start must explicitly activate it against the current
    -- enrollment revision.
    insert into public.lesson_run_execution_capability (
      lesson_run_id,
      course_id,
      learner_profile_id,
      enrollment_revision,
      status,
      revision,
      granted_by_account_id,
      granted_at,
      revoked_by_account_id,
      revoked_at,
      revocation_reason
    ) values (
      v_run.id,
      v_course_id,
      p_learner_profile_id,
      v_enrollment.revision,
      'revoked',
      1,
      v_actor_account_id,
      v_changed_at,
      v_actor_account_id,
      v_changed_at,
      'run_capability_not_granted'
    );
  elsif v_capability.status = 'active' then
    update public.lesson_run_execution_capability as capability
    set status = 'revoked',
        revision = capability.revision + 1,
        revoked_by_account_id = v_actor_account_id,
        revoked_at = v_changed_at,
        revocation_reason = 'teacher_revoked_run_access'
    where capability.lesson_run_id = v_run.id
      and capability.learner_profile_id = p_learner_profile_id;
  elsif v_capability.enrollment_revision <> v_enrollment.revision then
    update public.lesson_run_execution_capability as capability
    set course_id = v_course_id,
        enrollment_revision = v_enrollment.revision,
        revision = capability.revision + 1,
        granted_by_account_id = v_actor_account_id,
        granted_at = v_changed_at,
        revoked_by_account_id = v_actor_account_id,
        revoked_at = v_changed_at,
        revocation_reason = 'run_capability_not_granted'
    where capability.lesson_run_id = v_run.id
      and capability.learner_profile_id = p_learner_profile_id;
  end if;

  return public.get_lesson_run_live_delivery_admin(p_lesson_run_id);
end
$$;

create function public.set_lesson_run_presentation_cursor(
  p_lesson_run_id uuid,
  p_student_slide_id uuid,
  p_expected_revision bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_account_id uuid;
  v_course_id uuid;
  v_lesson_id uuid;
  v_run public.lesson_run%rowtype;
  v_state public.lesson_run_presentation_state%rowtype;
begin
  if p_lesson_run_id is null
    or p_expected_revision is null
    or p_expected_revision < 0
    or (select auth.uid()) is null
  then
    raise exception 'lesson_run_cursor_invalid' using errcode = '22023';
  end if;

  select owner_account.id, course.id, lesson.id
  into v_actor_account_id, v_course_id, v_lesson_id
  from public.lesson_run as run
  join public.lesson as lesson on lesson.id = run.lesson_id
  join public.course as course on course.id = lesson.course_id
  join public.account as owner_account
    on owner_account.id = course.owner_account_id
  where run.id = p_lesson_run_id
    and owner_account.auth_user_id = (select auth.uid())
    and owner_account.status = 'active'
    and course.archived_at is null;

  if not found then
    raise exception 'lesson_run_live_not_found' using errcode = 'P0002';
  end if;

  perform 1
  from public.account as account
  where account.id = v_actor_account_id
    and account.auth_user_id = (select auth.uid())
    and account.status = 'active'
  -- Read-only authority rows use FOR SHARE: this blocks ordinary non-key
  -- status/archive/context updates, but remains compatible with the FK KEY
  -- SHARE locks taken by deferred lesson-run notification inserts. Holding an
  -- exclusive Account lock while waiting on Run would deadlock with
  -- cancel/complete, which own Run before their deferred notifications refer
  -- back to the owner Account.
  for share of account;

  if not found then
    raise exception 'lesson_run_live_not_found' using errcode = 'P0002';
  end if;

  perform 1
  from public.course as course
  where course.id = v_course_id
    and course.owner_account_id = v_actor_account_id
    and course.archived_at is null
  for share of course;

  if not found then
    raise exception 'lesson_run_live_not_found' using errcode = 'P0002';
  end if;

  perform 1
  from public.lesson as lesson
  where lesson.id = v_lesson_id
    and lesson.course_id = v_course_id
  for share of lesson;

  if not found then
    raise exception 'lesson_run_live_not_found' using errcode = 'P0002';
  end if;

  select run.*
  into v_run
  from public.lesson_run as run
  where run.id = p_lesson_run_id
    and run.lesson_id = v_lesson_id
  for update of run;

  if not found then
    raise exception 'lesson_run_live_not_found' using errcode = 'P0002';
  end if;

  if not v_run.started_at_is_actual
    or v_run.started_at is null
    or v_run.ended_at is not null
    or v_run.cancelled_at is not null
  then
    raise exception 'lesson_run_live_not_open' using errcode = '55000';
  end if;

  -- Slide rows are always locked before presentation state. Direct/supported
  -- Slide deletion already owns the Slide row and its BEFORE trigger then
  -- clears state, so this order removes the previous state<->Slide deadlock.
  if p_student_slide_id is not null then
    perform 1
    from public.lesson_student_slide as slide
    where slide.id = p_student_slide_id
      and slide.lesson_id = v_lesson_id
      and exists (
        select 1
        from public.lesson_component as component
        where component.lesson_id = v_lesson_id
          and component.student_slide_id = slide.id
          and component.visibility = 'learner_visible'
      )
    for update of slide;

    if not found then
      raise exception 'lesson_run_live_slide_not_found'
        using errcode = 'P0002';
    end if;
  end if;

  select state.*
  into v_state
  from public.lesson_run_presentation_state as state
  where state.lesson_run_id = v_run.id
  for update of state;

  if not found then
    raise exception 'lesson_run_live_not_initialized'
      using errcode = 'P0002';
  end if;

  if v_state.cursor_version <> p_expected_revision then
    raise exception 'lesson_run_cursor_stale' using errcode = '40001';
  end if;

  update public.lesson_run_presentation_state as state
  set student_slide_id = p_student_slide_id,
      cursor_version = state.cursor_version + 1,
      changed_by_account_id = v_actor_account_id,
      changed_at = clock_timestamp()
  where state.lesson_run_id = v_run.id
  returning state.* into v_state;

  return jsonb_build_object(
    'slideId', v_state.student_slide_id,
    'revision', v_state.cursor_version
  );
end
$$;

create function public.resolve_lesson_run_live_source_admin(
  p_auth_user_id uuid,
  p_session_id uuid,
  p_lesson_run_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_account_id uuid;
  v_learner_profile_id uuid;
  v_sessions_invalid_before timestamptz;
  v_session_created_at timestamptz;
  v_session_not_after timestamptz;
  v_lesson_id uuid;
  v_course_id uuid;
  v_course_owner_account_id uuid;
  v_run_ended_at timestamptz;
  v_run_cancelled_at timestamptz;
  v_presentation_lesson_run_id uuid;
  v_student_slide_id uuid;
  v_cursor_version bigint;
  v_slide_position integer;
  v_result jsonb;
begin
  if p_auth_user_id is null or p_session_id is null then
    raise exception 'live_delivery_session_revoked' using errcode = '42501';
  end if;

  select session.created_at, session.not_after
  into v_session_created_at, v_session_not_after
  from auth.sessions as session
  where session.id = p_session_id
    and session.user_id = p_auth_user_id
  for share of session;

  if not found
    or v_session_created_at is null
    or (
      v_session_not_after is not null
      and v_session_not_after <= clock_timestamp()
    )
  then
    raise exception 'live_delivery_session_revoked' using errcode = '42501';
  end if;

  select profile.id
  into v_learner_profile_id
  from public.account as account
  join public.learner_profile as profile
    on profile.account_id = account.id
  where account.auth_user_id = p_auth_user_id
    and account.status = 'active';

  if not found then
    raise exception 'lesson_run_live_not_found' using errcode = 'P0002';
  end if;

  -- Merge, erasure, unlink, grants, revocations and actual-start
  -- materialization use this same transaction-scoped learner lock. Re-read
  -- the Supabase session and canonical Account/Profile mapping after waiting.
  perform public.lock_learning_activity_learners(
    array[v_learner_profile_id]
  );

  select session.created_at, session.not_after
  into v_session_created_at, v_session_not_after
  from auth.sessions as session
  where session.id = p_session_id
    and session.user_id = p_auth_user_id
  for share of session;

  if not found
    or v_session_created_at is null
    or (
      v_session_not_after is not null
      and v_session_not_after <= clock_timestamp()
    )
  then
    raise exception 'live_delivery_session_revoked' using errcode = '42501';
  end if;

  select
    account.id,
    profile.id
  into
    v_account_id,
    v_learner_profile_id
  from public.account as account
  join public.learner_profile as profile
    on profile.account_id = account.id
  where account.auth_user_id = p_auth_user_id
    and account.status = 'active'
    and profile.id = v_learner_profile_id
  -- FOR SHARE (not KEY SHARE) is required: status and account_id are
  -- non-key authority columns, and their UPDATE writers must serialize with
  -- this read through commit.
  for share of account, profile;

  if not found then
    raise exception 'lesson_run_live_not_found' using errcode = 'P0002';
  end if;

  -- account_security is provisioned with the Account, but keep the nullable
  -- legacy shape fail-closed-safe.  When present, FOR SHARE serializes the
  -- non-key session-cutoff UPDATE through the end of this source read.
  v_sessions_invalid_before := null;
  select security.sessions_invalid_before
  into v_sessions_invalid_before
  from public.account_security as security
  where security.account_id = v_account_id
  for share of security;

  if not found then
    raise exception 'live_delivery_session_revoked' using errcode = '42501';
  end if;

  if v_sessions_invalid_before is not null
    and v_session_created_at < v_sessions_invalid_before
  then
    raise exception 'live_delivery_session_revoked' using errcode = '42501';
  end if;

  select
    run.ended_at,
    run.cancelled_at,
    lesson.id,
    course.id,
    course.owner_account_id,
    presentation.lesson_run_id,
    presentation.student_slide_id,
    presentation.cursor_version
  into
    v_run_ended_at,
    v_run_cancelled_at,
    v_lesson_id,
    v_course_id,
    v_course_owner_account_id,
    v_presentation_lesson_run_id,
    v_student_slide_id,
    v_cursor_version
  from public.lesson_run as run
  join public.lesson as lesson on lesson.id = run.lesson_id
  join public.course as course on course.id = lesson.course_id
  join public.account as owner_account
    on owner_account.id = course.owner_account_id
   and owner_account.status = 'active'
  join public.course_learner_enrollment as enrollment
    on enrollment.course_id = course.id
   and enrollment.learner_profile_id = v_learner_profile_id
   and enrollment.status = 'active'
  join public.lesson_run_execution_capability as capability
    on capability.lesson_run_id = run.id
   and capability.course_id = course.id
   and capability.learner_profile_id = v_learner_profile_id
   and capability.status = 'active'
   and capability.enrollment_revision = enrollment.revision
  left join public.lesson_run_presentation_state as presentation
    on presentation.lesson_run_id = run.id
  where run.id = p_lesson_run_id
    and run.started_at_is_actual
    and run.started_at is not null
    and course.archived_at is null
  -- These are authority/state rows, so ordinary non-key UPDATEs (archive,
  -- completion/cancellation and grant/revoke) must conflict with the read.
  for share of
    owner_account,
    course,
    run,
    enrollment,
    capability;

  if not found then
    raise exception 'lesson_run_live_not_found' using errcode = 'P0002';
  end if;

  if v_run_ended_at is not null or v_run_cancelled_at is not null then
    return jsonb_build_object('state', 'ended');
  end if;

  if v_presentation_lesson_run_id is null or v_student_slide_id is null then
    return jsonb_build_object(
      'state', 'waiting',
      'cursorRevision', coalesce(v_cursor_version, 0)
    );
  end if;

  select slide.position
  into v_slide_position
  from public.lesson_student_slide as slide
  where slide.id = v_student_slide_id
    and slide.lesson_id = v_lesson_id
    and exists (
      select 1
      from public.lesson_component as component
      where component.lesson_id = v_lesson_id
        and component.student_slide_id = slide.id
        and component.visibility = 'learner_visible'
    );

  if not found then
    return jsonb_build_object(
      'state', 'waiting',
      'cursorRevision', v_cursor_version
    );
  end if;

  with current_components as materialized (
    select
      component.type_key,
      component.schema_version,
      component.position,
      component.payload,
      component.placement_config
    from public.lesson_component as component
    where component.lesson_id = v_lesson_id
      and component.student_slide_id = v_student_slide_id
      and component.visibility = 'learner_visible'
    order by component.position
  ), referenced_file_text as materialized (
    select component.payload ->> 'storedFileId' as stored_file_id
    from current_components as component
    where jsonb_typeof(component.payload -> 'storedFileId') = 'string'
    union
    select slide_ref.value ->> 'storedFileId'
    from current_components as component
    cross join lateral jsonb_array_elements(
      case
        when jsonb_typeof(component.payload -> 'slides') = 'array'
          then component.payload -> 'slides'
        else '[]'::jsonb
      end
    ) as slide_ref(value)
    where jsonb_typeof(slide_ref.value -> 'storedFileId') = 'string'
  ), referenced_file as materialized (
    select distinct referenced.stored_file_id::uuid as id
    from referenced_file_text as referenced
    where referenced.stored_file_id ~* (
      '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-'
      || '[0-9a-f]{4}-[0-9a-f]{12}$'
    )
  )
  select jsonb_build_object(
    'state', 'live',
    'cursorRevision', v_cursor_version,
    'slide', jsonb_build_object(
      'position', v_slide_position,
      'components', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'typeKey', component.type_key,
            'schemaVersion', component.schema_version,
            'position', component.position,
            'payload', component.payload,
            'placement', component.placement_config
          )
          order by component.position
        )
        from current_components as component
      ), '[]'::jsonb)
    ),
    'assets', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', stored_file.id,
          'storageBucket', stored_file.storage_bucket,
          'storagePath', stored_file.storage_path,
          'originalFilename', stored_file.original_filename,
          'mimeType', stored_file.mime_type,
          'sizeBytes', stored_file.size_bytes
        )
        order by stored_file.id
      )
      from referenced_file
      join public.course_attachment as attachment
        on attachment.course_id = v_course_id
       and attachment.stored_file_id = referenced_file.id
      join public.stored_file as stored_file
        on stored_file.id = referenced_file.id
       and stored_file.owner_account_id = v_course_owner_account_id
       and stored_file.status = 'ready'
    ), '[]'::jsonb)
  )
  into v_result;

  return v_result;
end
$$;

-- Preserve the exact public function signature and return type.  Only the
-- first transition to an actual start creates LA-M4 state.  A Run that was
-- already actual before this migration remains unbackfilled and needs the
-- explicit post-start set_lesson_run_live_access path.
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
  v_actor_user_id uuid := (select auth.uid());
  v_actor_account_id uuid;
  v_course_id uuid;
  v_lesson_id uuid;
  v_learner_profile_ids uuid[];
  v_learner_account_ids uuid[];
  v_run public.lesson_run%rowtype;
  v_was_actual boolean;
begin
  if v_actor_user_id is null or p_started_at is null then
    raise exception 'lesson_run_not_found' using errcode = 'P0002';
  end if;

  select owner_account.id, course.id, lesson.id
  into v_actor_account_id, v_course_id, v_lesson_id
  from public.lesson_run as run
  join public.lesson as lesson on lesson.id = run.lesson_id
  join public.course as course on course.id = lesson.course_id
  join public.account as owner_account
    on owner_account.id = course.owner_account_id
  where run.id = p_lesson_run_id
    and owner_account.auth_user_id = v_actor_user_id
    and owner_account.status = 'active'
    and course.archived_at is null;

  if not found then
    raise exception 'lesson_run_not_found' using errcode = 'P0002';
  end if;

  -- Discover the exact Profile -> Account mapping without row locks. Accounts
  -- are locked first in UUID order, matching unlink/merge, and the mapping is
  -- then revalidated under Profile locks below.
  select
    coalesce(
      array_agg(record.learner_profile_id order by record.learner_profile_id),
      array[]::uuid[]
    ),
    coalesce(
      array_agg(profile.account_id order by record.learner_profile_id),
      array[]::uuid[]
    )
  into v_learner_profile_ids, v_learner_account_ids
  from public.learning_record as record
  join public.learner_profile as profile
    on profile.id = record.learner_profile_id
  where record.lesson_run_id = p_lesson_run_id
    and record.superseded_by_record_id is null;

  perform public.lock_learning_activity_learners(v_learner_profile_ids);

  perform account.id
  from public.account as account
  where account.id = v_actor_account_id
     or account.id = any(v_learner_account_ids)
  order by account.id
  -- SHARE blocks Account status transitions but is compatible with the
  -- notification FK locks taken by a concurrent cancel transaction.
  for share of account;

  if not exists (
    select 1
    from public.account as account
    where account.id = v_actor_account_id
      and account.auth_user_id = v_actor_user_id
      and account.status = 'active'
  ) then
    raise exception 'lesson_run_not_found' using errcode = 'P0002';
  end if;

  perform profile.id
  from unnest(v_learner_profile_ids, v_learner_account_ids)
    as expected(profile_id, account_id)
  join public.learner_profile as profile
    on profile.id = expected.profile_id
   and profile.account_id is not distinct from expected.account_id
  order by profile.id
  for update of profile;

  if exists (
    select 1
    from unnest(v_learner_profile_ids, v_learner_account_ids)
      as expected(profile_id, account_id)
    left join public.learner_profile as profile
      on profile.id = expected.profile_id
     and profile.account_id is not distinct from expected.account_id
    where profile.id is null
  ) then
    raise exception 'lesson_run_not_found' using errcode = 'P0002';
  end if;

  perform 1
  from public.course as course
  where course.id = v_course_id
    and course.owner_account_id = v_actor_account_id
    and course.archived_at is null
  for update of course;

  if not found then
    raise exception 'lesson_run_not_found' using errcode = 'P0002';
  end if;

  perform 1
  from public.lesson as lesson
  where lesson.id = v_lesson_id
    and lesson.course_id = v_course_id
  for update of lesson;

  if not found then
    raise exception 'lesson_run_not_found' using errcode = 'P0002';
  end if;

  select run.*
  into v_run
  from public.lesson_run as run
  where run.id = p_lesson_run_id
    and run.lesson_id = v_lesson_id
  for update of run;

  if not found then
    raise exception 'lesson_run_not_found' using errcode = 'P0002';
  end if;

  perform record.id
  from public.learning_record as record
  where record.lesson_run_id = v_run.id
    and record.superseded_by_record_id is null
  order by record.id
  for update of record;

  if v_run.cancelled_at is not null or v_run.ended_at is not null then
    raise exception 'lesson_run_not_open' using errcode = '55000';
  end if;

  v_was_actual := v_run.started_at_is_actual;

  if v_run.started_at is null or not v_run.started_at_is_actual then
    update public.lesson_run as run
    set started_at = p_started_at,
        started_at_is_actual = true
    where run.id = p_lesson_run_id
    returning run.* into v_run;
  end if;

  if not v_was_actual then
    insert into public.lesson_run_presentation_state (lesson_run_id)
    values (v_run.id)
    on conflict (lesson_run_id) do nothing;

    perform enrollment.course_id
    from public.course_learner_enrollment as enrollment
    join public.learning_record as record
      on record.lesson_run_id = v_run.id
     and record.learner_profile_id = enrollment.learner_profile_id
     and record.superseded_by_record_id is null
    where enrollment.course_id = v_course_id
      and enrollment.status = 'active'
    order by enrollment.learner_profile_id
    for update of enrollment;

    insert into public.lesson_run_execution_capability as capability (
      lesson_run_id,
      course_id,
      learner_profile_id,
      enrollment_revision,
      status,
      revision,
      granted_by_account_id,
      granted_at
    )
    select
      v_run.id,
      v_course_id,
      record.learner_profile_id,
      enrollment.revision,
      'active',
      1,
      v_actor_account_id,
      clock_timestamp()
    from public.learning_record as record
    join public.course_learner_enrollment as enrollment
      on enrollment.course_id = v_course_id
     and enrollment.learner_profile_id = record.learner_profile_id
     and enrollment.status = 'active'
    join public.learner_profile as profile
      on profile.id = record.learner_profile_id
    join public.account as learner_account
      on learner_account.id = profile.account_id
     and learner_account.status = 'active'
    join public.account as owner_account
      on owner_account.id = v_actor_account_id
     and owner_account.status = 'active'
    join public.course as course
      on course.id = v_course_id
     and course.archived_at is null
    where record.lesson_run_id = v_run.id
      and record.occurred_at is null
      and record.superseded_by_record_id is null
    order by record.learner_profile_id
    on conflict (lesson_run_id, learner_profile_id) do update
    set course_id = excluded.course_id,
        enrollment_revision = excluded.enrollment_revision,
        status = 'active',
        revision = capability.revision + 1,
        granted_by_account_id = excluded.granted_by_account_id,
        granted_at = excluded.granted_at,
        revoked_by_account_id = null,
        revoked_at = null,
        revocation_reason = null
    where capability.status <> 'active'
      or capability.enrollment_revision <> excluded.enrollment_revision;
  end if;

  return v_run;
end
$$;

revoke all on table
  public.course_learner_enrollment,
  public.lesson_run_execution_capability,
  public.lesson_run_presentation_state
from public, anon, authenticated, service_role;

grant all on table
  public.course_learner_enrollment,
  public.lesson_run_execution_capability,
  public.lesson_run_presentation_state
to postgres;

do $close_function_acl$
declare
  v_signature text;
begin
  foreach v_signature in array array[
    'public.guard_course_learner_enrollment()',
    'public.guard_lesson_run_execution_capability()',
    'public.guard_lesson_run_presentation_state()',
    'public.clear_deleted_lesson_run_presentation_cursor()',
    'public.revoke_course_learner_live_access(uuid,uuid,uuid,text)',
    'public.revoke_live_access_after_learner_account_change()',
    'public.guard_course_owner_change_with_live_access()',
    'public.revoke_live_access_after_course_archive()',
    'public.revoke_live_access_after_account_deactivation()',
    'public.get_lesson_run_live_delivery_admin(uuid)',
    'public.set_lesson_run_live_access(uuid,uuid,boolean,boolean)',
    'public.set_lesson_run_presentation_cursor(uuid,uuid,bigint)',
    'public.resolve_lesson_run_live_source_admin(uuid,uuid,uuid)',
    'public.start_lesson_run(uuid,timestamp with time zone)'
  ]
  loop
    execute format(
      'revoke all on function %s from public, anon, authenticated, service_role',
      v_signature
    );
  end loop;
end
$close_function_acl$;

grant execute on function
  public.get_lesson_run_live_delivery_admin(uuid),
  public.set_lesson_run_live_access(uuid,uuid,boolean,boolean),
  public.set_lesson_run_presentation_cursor(uuid,uuid,bigint)
to authenticated;

grant execute on function
  public.resolve_lesson_run_live_source_admin(uuid,uuid,uuid)
to service_role;

-- Preserve the existing lifecycle adapter ACL while the new raw delivery
-- tables remain closed even to service_role.
grant execute on function
  public.start_lesson_run(uuid,timestamp with time zone)
to authenticated, service_role;

grant execute on function
  public.guard_course_learner_enrollment(),
  public.guard_lesson_run_execution_capability(),
  public.guard_lesson_run_presentation_state(),
  public.clear_deleted_lesson_run_presentation_cursor(),
  public.revoke_course_learner_live_access(uuid,uuid,uuid,text),
  public.revoke_live_access_after_learner_account_change(),
  public.guard_course_owner_change_with_live_access(),
  public.revoke_live_access_after_course_archive(),
  public.revoke_live_access_after_account_deactivation(),
  public.get_lesson_run_live_delivery_admin(uuid),
  public.set_lesson_run_live_access(uuid,uuid,boolean,boolean),
  public.set_lesson_run_presentation_cursor(uuid,uuid,bigint),
  public.resolve_lesson_run_live_source_admin(uuid,uuid,uuid),
  public.start_lesson_run(uuid,timestamp with time zone)
to postgres;

do $postflight$
declare
  v_table_name text;
  v_signature regprocedure;
begin
  foreach v_table_name in array array[
    'course_learner_enrollment',
    'lesson_run_execution_capability',
    'lesson_run_presentation_state'
  ]
  loop
    if not exists (
      select 1
      from pg_catalog.pg_class as relation
      join pg_catalog.pg_namespace as namespace
        on namespace.oid = relation.relnamespace
      where namespace.nspname = 'public'
        and relation.relname = v_table_name
        and relation.relkind = 'r'
        and relation.relrowsecurity
        and pg_get_userbyid(relation.relowner) = 'supabase_admin'
    )
      or exists (
        select 1
        from pg_catalog.pg_policies as policy
        where policy.schemaname = 'public'
          and policy.tablename = v_table_name
      )
      or exists (
        select 1
        from unnest(array['anon', 'authenticated', 'service_role'])
          as actor(role_name)
        cross join unnest(array[
          'SELECT',
          'INSERT',
          'UPDATE',
          'DELETE',
          'TRUNCATE',
          'REFERENCES',
          'TRIGGER'
        ]) as checked(privilege_name)
        where has_table_privilege(
          actor.role_name,
          'public.' || v_table_name,
          checked.privilege_name
        )
      )
    then
      raise exception
        'lesson_run_live_delivery_postflight_table_acl:%',
        v_table_name;
    end if;
  end loop;

  foreach v_signature in array array[
    'public.get_lesson_run_live_delivery_admin(uuid)'::regprocedure,
    'public.set_lesson_run_live_access(uuid,uuid,boolean,boolean)'::regprocedure,
    'public.set_lesson_run_presentation_cursor(uuid,uuid,bigint)'::regprocedure,
    'public.resolve_lesson_run_live_source_admin(uuid,uuid,uuid)'::regprocedure,
    'public.start_lesson_run(uuid,timestamp with time zone)'::regprocedure
  ]
  loop
    if not exists (
      select 1
      from pg_catalog.pg_proc as procedure
      where procedure.oid = v_signature
        and procedure.prosecdef
        and procedure.proconfig @> array['search_path=""']::text[]
        and pg_get_userbyid(procedure.proowner) = 'supabase_admin'
    )
      or has_function_privilege('anon', v_signature, 'EXECUTE')
    then
      raise exception
        'lesson_run_live_delivery_postflight_function_security:%',
        v_signature::text;
    end if;
  end loop;

  if not has_function_privilege(
      'authenticated',
      'public.get_lesson_run_live_delivery_admin(uuid)',
      'EXECUTE'
    )
    or not has_function_privilege(
      'authenticated',
      'public.set_lesson_run_live_access(uuid,uuid,boolean,boolean)',
      'EXECUTE'
    )
    or not has_function_privilege(
      'authenticated',
      'public.set_lesson_run_presentation_cursor(uuid,uuid,bigint)',
      'EXECUTE'
    )
    or has_function_privilege(
      'authenticated',
      'public.resolve_lesson_run_live_source_admin(uuid,uuid,uuid)',
      'EXECUTE'
    )
    or not has_function_privilege(
      'service_role',
      'public.resolve_lesson_run_live_source_admin(uuid,uuid,uuid)',
      'EXECUTE'
    )
    or has_function_privilege(
      'service_role',
      'public.get_lesson_run_live_delivery_admin(uuid)',
      'EXECUTE'
    )
    or has_function_privilege(
      'service_role',
      'public.set_lesson_run_live_access(uuid,uuid,boolean,boolean)',
      'EXECUTE'
    )
    or has_function_privilege(
      'service_role',
      'public.set_lesson_run_presentation_cursor(uuid,uuid,bigint)',
      'EXECUTE'
    )
    or not has_function_privilege(
      'authenticated',
      'public.start_lesson_run(uuid,timestamp with time zone)',
      'EXECUTE'
    )
    or not has_function_privilege(
      'service_role',
      'public.start_lesson_run(uuid,timestamp with time zone)',
      'EXECUTE'
    )
    or exists (
      select 1
      from unnest(array[
        'public.guard_course_learner_enrollment()',
        'public.guard_lesson_run_execution_capability()',
        'public.guard_lesson_run_presentation_state()',
        'public.clear_deleted_lesson_run_presentation_cursor()',
        'public.revoke_course_learner_live_access(uuid,uuid,uuid,text)',
        'public.revoke_live_access_after_learner_account_change()',
        'public.guard_course_owner_change_with_live_access()',
        'public.revoke_live_access_after_course_archive()',
        'public.revoke_live_access_after_account_deactivation()'
      ]) as helper(signature)
      left join pg_catalog.pg_proc as procedure
        on procedure.oid = to_regprocedure(helper.signature)
      where procedure.oid is null
        or not procedure.prosecdef
        or not (
          procedure.proconfig @> array['search_path=""']::text[]
        )
        or pg_get_userbyid(procedure.proowner) <> 'supabase_admin'
    )
    or exists (
      select 1
      from unnest(array[
        'public.guard_course_learner_enrollment()',
        'public.guard_lesson_run_execution_capability()',
        'public.guard_lesson_run_presentation_state()',
        'public.clear_deleted_lesson_run_presentation_cursor()',
        'public.revoke_course_learner_live_access(uuid,uuid,uuid,text)',
        'public.revoke_live_access_after_learner_account_change()',
        'public.guard_course_owner_change_with_live_access()',
        'public.revoke_live_access_after_course_archive()',
        'public.revoke_live_access_after_account_deactivation()'
      ]) as helper(signature)
      cross join unnest(array['anon', 'authenticated', 'service_role'])
        as actor(role_name)
      where has_function_privilege(
        actor.role_name,
        helper.signature,
        'EXECUTE'
      )
    )
  then
    raise exception 'lesson_run_live_delivery_postflight_rpc_acl';
  end if;

  if exists (
    select 1
    from (
      values
        (
          'course_learner_enrollment',
          'trg_course_learner_enrollment_updated_at',
          'public.set_updated_at()',
          19::smallint,
          array[]::text[],
          false
        ),
        (
          'lesson_run_execution_capability',
          'trg_lesson_run_execution_capability_updated_at',
          'public.set_updated_at()',
          19::smallint,
          array[]::text[],
          false
        ),
        (
          'course_learner_enrollment',
          'trg_course_learner_enrollment_guard',
          'public.guard_course_learner_enrollment()',
          23::smallint,
          array[]::text[],
          false
        ),
        (
          'lesson_run_execution_capability',
          'trg_lesson_run_execution_capability_guard',
          'public.guard_lesson_run_execution_capability()',
          23::smallint,
          array[
            'course_id',
            'enrollment_revision',
            'learner_profile_id',
            'lesson_run_id',
            'status'
          ]::text[],
          false
        ),
        (
          'lesson_run_presentation_state',
          'trg_lesson_run_presentation_state_guard',
          'public.guard_lesson_run_presentation_state()',
          23::smallint,
          array['lesson_run_id', 'student_slide_id']::text[],
          false
        ),
        (
          'lesson_student_slide',
          'trg_lesson_student_slide_clear_live_cursor',
          'public.clear_deleted_lesson_run_presentation_cursor()',
          11::smallint,
          array[]::text[],
          false
        ),
        (
          'learner_profile',
          'trg_learner_profile_revoke_live_access_on_account_change',
          'public.revoke_live_access_after_learner_account_change()',
          17::smallint,
          array['account_id']::text[],
          true
        ),
        (
          'course',
          'trg_course_guard_live_access_owner_change',
          'public.guard_course_owner_change_with_live_access()',
          19::smallint,
          array['owner_account_id']::text[],
          false
        ),
        (
          'course',
          'trg_course_revoke_live_access_on_archive',
          'public.revoke_live_access_after_course_archive()',
          17::smallint,
          array['archived_at']::text[],
          false
        ),
        (
          'account',
          'trg_account_revoke_live_access_on_deactivation',
          'public.revoke_live_access_after_account_deactivation()',
          17::smallint,
          array['status']::text[],
          true
        )
    ) as required_trigger(
      table_name,
      trigger_name,
      function_signature,
      trigger_type,
      column_names,
      has_when_clause
    )
    left join pg_catalog.pg_trigger as database_trigger
      on database_trigger.tgrelid = to_regclass(
        'public.' || required_trigger.table_name
      )
     and database_trigger.tgname = required_trigger.trigger_name
     and not database_trigger.tgisinternal
    where database_trigger.oid is null
      or database_trigger.tgenabled <> 'O'
      or database_trigger.tgfoid <>
        to_regprocedure(required_trigger.function_signature)
      or database_trigger.tgtype <> required_trigger.trigger_type
      or coalesce((
        select array_agg(
          attribute.attname::text
          order by attribute.attname::text
        )
        from unnest(database_trigger.tgattr::smallint[])
          as column_ref(attnum)
        join pg_catalog.pg_attribute as attribute
          on attribute.attrelid = database_trigger.tgrelid
         and attribute.attnum = column_ref.attnum
      ), array[]::text[]) <> required_trigger.column_names
      or (database_trigger.tgqual is not null) is distinct from
        required_trigger.has_when_clause
  ) then
    raise exception 'lesson_run_live_delivery_postflight_trigger_contract';
  end if;

  -- LA-M4 cursor cleanup deliberately composes with the canonical authored
  -- hierarchy cleanup: the last learner-visible Component deletes its now
  -- empty Slide, whose BEFORE DELETE trigger above clears every live cursor.
  if not exists (
      select 1
      from pg_catalog.pg_proc as procedure
      where procedure.oid = to_regprocedure(
        'public.cleanup_empty_lesson_student_slide()'
      )
        and not procedure.prosecdef
        and procedure.proconfig @> array['search_path=""']::text[]
        and pg_get_userbyid(procedure.proowner) = 'supabase_admin'
    )
    or not exists (
      select 1
      from pg_catalog.pg_trigger as database_trigger
      where database_trigger.tgrelid =
          to_regclass('public.lesson_component')
        and database_trigger.tgname =
          'trg_lesson_component_cleanup_empty_student_slide'
        and not database_trigger.tgisinternal
        and database_trigger.tgenabled = 'O'
        and database_trigger.tgfoid = to_regprocedure(
          'public.cleanup_empty_lesson_student_slide()'
        )
        and database_trigger.tgtype = 25::smallint
        and coalesce((
          select array_agg(
            attribute.attname::text
            order by attribute.attname::text
          )
          from unnest(database_trigger.tgattr::smallint[])
            as column_ref(attnum)
          join pg_catalog.pg_attribute as attribute
            on attribute.attrelid = database_trigger.tgrelid
           and attribute.attnum = column_ref.attnum
        ), array[]::text[]) = array[
          'lesson_id',
          'student_slide_id',
          'visibility'
        ]::text[]
        and database_trigger.tgqual is null
    )
    or position(
      'delete from public.lesson_student_slide as slide'
      in lower(pg_get_functiondef(to_regprocedure(
        'public.cleanup_empty_lesson_student_slide()'
      )))
    ) = 0
    or position(
      'component.visibility = ''learner_visible'''
      in lower(pg_get_functiondef(to_regprocedure(
        'public.cleanup_empty_lesson_student_slide()'
      )))
    ) = 0
  then
    raise exception
      'lesson_run_live_delivery_postflight_empty_slide_dependency';
  end if;

  if exists (select 1 from public.course_learner_enrollment)
    or exists (select 1 from public.lesson_run_execution_capability)
    or exists (select 1 from public.lesson_run_presentation_state)
  then
    raise exception 'lesson_run_live_delivery_postflight_unexpected_backfill';
  end if;

  if position(
      'insert into public.lesson_run_presentation_state'
      in lower(pg_get_functiondef(to_regprocedure(
        'public.start_lesson_run(uuid,timestamp with time zone)'
      )))
    ) = 0
    or position(
      'insert into public.lesson_run_execution_capability'
      in lower(pg_get_functiondef(to_regprocedure(
        'public.start_lesson_run(uuid,timestamp with time zone)'
      )))
    ) = 0
    or position(
      'on conflict (lesson_run_id, learner_profile_id) do update'
      in lower(pg_get_functiondef(to_regprocedure(
        'public.start_lesson_run(uuid,timestamp with time zone)'
      )))
    ) = 0
    or position(
      'record.superseded_by_record_id is null'
      in lower(pg_get_functiondef(to_regprocedure(
        'public.get_lesson_run_live_delivery_admin(uuid)'
      )))
    ) = 0
    or position(
      'capability_member.lesson_run_id = run.id'
      in lower(pg_get_functiondef(to_regprocedure(
        'public.get_lesson_run_live_delivery_admin(uuid)'
      )))
    ) = 0
    or position(
      'from auth.sessions as session'
      in lower(pg_get_functiondef(to_regprocedure(
        'public.resolve_lesson_run_live_source_admin(uuid,uuid,uuid)'
      )))
    ) = 0
    or position(
      'session.not_after'
      in lower(pg_get_functiondef(to_regprocedure(
        'public.resolve_lesson_run_live_source_admin(uuid,uuid,uuid)'
      )))
    ) = 0
    or position(
      'lock_learning_activity_learners'
      in lower(pg_get_functiondef(to_regprocedure(
        'public.resolve_lesson_run_live_source_admin(uuid,uuid,uuid)'
      )))
    ) = 0
    or position(
      'owner_account.status = ''active'''
      in lower(pg_get_functiondef(to_regprocedure(
        'public.resolve_lesson_run_live_source_admin(uuid,uuid,uuid)'
      )))
    ) = 0
    or regexp_count(
      lower(pg_get_functiondef(to_regprocedure(
        'public.resolve_lesson_run_live_source_admin(uuid,uuid,uuid)'
      ))),
      'for share of session'
    ) <> 2
    or position(
      'for share of account, profile'
      in lower(pg_get_functiondef(to_regprocedure(
        'public.resolve_lesson_run_live_source_admin(uuid,uuid,uuid)'
      )))
    ) = 0
    or position(
      'for share of security'
      in lower(pg_get_functiondef(to_regprocedure(
        'public.resolve_lesson_run_live_source_admin(uuid,uuid,uuid)'
      )))
    ) = 0
    or not (
      lower(pg_get_functiondef(to_regprocedure(
        'public.resolve_lesson_run_live_source_admin(uuid,uuid,uuid)'
      ))) ~ (
        'for share of[[:space:]]+owner_account,'
        || '[[:space:]]+course,[[:space:]]+run,'
        || '[[:space:]]+enrollment,[[:space:]]+capability'
      )
    )
    or not (
      lower(pg_get_functiondef(to_regprocedure(
        'public.resolve_lesson_run_live_source_admin(uuid,uuid,uuid)'
      ))) ~ (
        'for share of security;[[:space:]]+if not found then'
        || '[[:space:]]+raise exception '
        || '''live_delivery_session_revoked'''
      )
    )
    or position(
      'order by account.id'
      in lower(pg_get_functiondef(to_regprocedure(
        'public.set_lesson_run_live_access(uuid,uuid,boolean,boolean)'
      )))
    ) = 0
    or position(
      'for share of account'
      in lower(pg_get_functiondef(to_regprocedure(
        'public.set_lesson_run_live_access(uuid,uuid,boolean,boolean)'
      )))
    ) = 0
    or position(
      'profile.account_id is not distinct from v_learner_account_id'
      in lower(pg_get_functiondef(to_regprocedure(
        'public.set_lesson_run_live_access(uuid,uuid,boolean,boolean)'
      )))
    ) = 0
    or position(
      'run_capability_not_granted'
      in lower(pg_get_functiondef(to_regprocedure(
        'public.set_lesson_run_live_access(uuid,uuid,boolean,boolean)'
      )))
    ) = 0
    or position(
      'not p_course_access_enabled'
      in lower(pg_get_functiondef(to_regprocedure(
        'public.set_lesson_run_live_access(uuid,uuid,boolean,boolean)'
      )))
    ) = 0
    or position(
      'v_capability.lesson_run_id is not null'
      in lower(pg_get_functiondef(to_regprocedure(
        'public.set_lesson_run_live_access(uuid,uuid,boolean,boolean)'
      )))
    ) = 0
    or position(
      'lesson_run_live_learner_not_eligible'
      in lower(pg_get_functiondef(to_regprocedure(
        'public.set_lesson_run_live_access(uuid,uuid,boolean,boolean)'
      )))
    ) <= position(
      'perform record.id'
      in lower(pg_get_functiondef(to_regprocedure(
        'public.set_lesson_run_live_access(uuid,uuid,boolean,boolean)'
      )))
    )
    or regexp_count(
      lower(pg_get_functiondef(to_regprocedure(
        'public.set_lesson_run_presentation_cursor(uuid,uuid,bigint)'
      ))),
      'if not found then'
    ) < 7
    or position(
      'for share of account'
      in lower(pg_get_functiondef(to_regprocedure(
        'public.set_lesson_run_presentation_cursor(uuid,uuid,bigint)'
      )))
    ) = 0
    or position(
      'for share of course'
      in lower(pg_get_functiondef(to_regprocedure(
        'public.set_lesson_run_presentation_cursor(uuid,uuid,bigint)'
      )))
    ) = 0
    or position(
      'for share of lesson'
      in lower(pg_get_functiondef(to_regprocedure(
        'public.set_lesson_run_presentation_cursor(uuid,uuid,bigint)'
      )))
    ) = 0
    or position(
      'for update of slide'
      in lower(pg_get_functiondef(to_regprocedure(
        'public.set_lesson_run_presentation_cursor(uuid,uuid,bigint)'
      )))
    ) = 0
    or position(
      'for update of slide'
      in lower(pg_get_functiondef(to_regprocedure(
        'public.set_lesson_run_presentation_cursor(uuid,uuid,bigint)'
      )))
    ) >= position(
      'for update of state'
      in lower(pg_get_functiondef(to_regprocedure(
        'public.set_lesson_run_presentation_cursor(uuid,uuid,bigint)'
      )))
    )
    or position(
      'v_learner_account_ids'
      in lower(pg_get_functiondef(to_regprocedure(
        'public.start_lesson_run(uuid,timestamptz)'
      )))
    ) = 0
    or position(
      'for share of account'
      in lower(pg_get_functiondef(to_regprocedure(
        'public.start_lesson_run(uuid,timestamptz)'
      )))
    ) = 0
    or position(
      'profile.account_id is not distinct from expected.account_id'
      in lower(pg_get_functiondef(to_regprocedure(
        'public.start_lesson_run(uuid,timestamptz)'
      )))
    ) = 0
    or not exists (
      select 1
      from pg_catalog.pg_trigger as trigger
      where trigger.tgrelid = 'public.account'::regclass
        and trigger.tgname =
          'trg_account_revoke_live_access_on_deactivation'
        and trigger.tgfoid = to_regprocedure(
          'public.revoke_live_access_after_account_deactivation()'
        )
        and not trigger.tgisinternal
    )
  then
    raise exception 'lesson_run_live_delivery_postflight_function_contract';
  end if;
end
$postflight$;

notify pgrst, 'reload schema';

commit;
