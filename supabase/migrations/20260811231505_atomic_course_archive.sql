begin;

do $migration$
declare
  v_touch_authoring_proc oid := to_regprocedure(
    'public.touch_course_from_authoring_child()'
  );
  v_touch_stored_file_proc oid := to_regprocedure(
    'public.touch_courses_from_stored_file()'
  );
begin
  if to_regclass('public.account') is null
    or to_regclass('public.course') is null
    or to_regclass('public.lesson') is null
    or to_regclass('public.lesson_run') is null
    or to_regclass('public.course_publication') is null
    or to_regclass('public.lesson_step') is not null
    or to_regprocedure(
      'public.publish_course_revision_admin(uuid,uuid,uuid,uuid,text,jsonb,jsonb,boolean)'
    ) is null
    or to_regprocedure(
      'public.schedule_lesson_run(uuid,timestamp with time zone,integer,uuid[],uuid)'
    ) is null
    or v_touch_authoring_proc is null
    or v_touch_stored_file_proc is null
    or to_regrole('authenticated') is null
    or to_regrole('anon') is null
    or to_regrole('service_role') is null
    or pg_get_userbyid(
      (
        select relation.relowner
        from pg_class as relation
        where relation.oid = 'public.course'::regclass
      )
    ) <> current_user
  then
    raise exception 'shidao_schema_sanity_check_failed'
      using errcode = '55000';
  end if;

  if to_regprocedure('public.archive_course(uuid)') is not null
    or to_regprocedure('public.guard_course_archive_invariants()') is not null
    or to_regprocedure('public.guard_course_publication_active_source()') is not null
    or to_regprocedure('public.guard_lesson_course_immutable()') is not null
    or to_regprocedure('public.guard_lesson_run_active_course()') is not null
  then
    raise exception 'atomic_course_archive_objects_already_exist'
      using errcode = '55000';
  end if;

  if not has_table_privilege('authenticated', 'public.course', 'UPDATE')
    or not has_table_privilege('authenticated', 'public.course', 'DELETE')
    or not has_column_privilege(
      'authenticated',
      'public.course',
      'archived_at',
      'UPDATE'
    )
  then
    raise exception 'course_acl_precondition_failed'
      using errcode = '55000';
  end if;

  if not has_table_privilege('authenticated', 'public.lesson', 'UPDATE')
    or not has_table_privilege('authenticated', 'public.lesson', 'DELETE')
    or not has_column_privilege(
      'authenticated',
      'public.lesson',
      'course_id',
      'UPDATE'
    )
  then
    raise exception 'lesson_acl_precondition_failed'
      using errcode = '55000';
  end if;

  if exists (
    select 1
    from pg_proc as procedure
    where procedure.oid in (
      v_touch_authoring_proc,
      v_touch_stored_file_proc
    )
      and (
        procedure.proconfig is null
        or not (procedure.proconfig @> array['search_path=""']::text[])
        or procedure.proowner <> (
          select relation.relowner
          from pg_class as relation
          where relation.oid = 'public.course'::regclass
        )
      )
  )
    or exists (
      select 1
      from pg_proc as procedure
      cross join lateral aclexplode(
        coalesce(procedure.proacl, acldefault('f', procedure.proowner))
      ) as privilege
      where procedure.oid in (
        v_touch_authoring_proc,
        v_touch_stored_file_proc
      )
        and privilege.grantee = 0
        and privilege.privilege_type = 'EXECUTE'
    )
    or has_function_privilege(
      'anon',
      v_touch_authoring_proc,
      'EXECUTE'
    )
    or has_function_privilege(
      'anon',
      v_touch_stored_file_proc,
      'EXECUTE'
    )
    or has_function_privilege(
      'authenticated',
      v_touch_authoring_proc,
      'EXECUTE'
    )
    or has_function_privilege(
      'authenticated',
      v_touch_stored_file_proc,
      'EXECUTE'
    )
    or has_function_privilege(
      'service_role',
      v_touch_authoring_proc,
      'EXECUTE'
    )
    or has_function_privilege(
      'service_role',
      v_touch_stored_file_proc,
      'EXECUTE'
    )
  then
    raise exception 'course_touch_function_precondition_failed'
      using errcode = '55000';
  end if;

end
$migration$;

-- Freeze the complete invariant graph in parent-to-child order before the
-- baseline check and DDL. This prevents a concurrent write from slipping
-- between preflight and trigger installation.
lock table public.course in share row exclusive mode;
lock table public.course_publication in share row exclusive mode;
lock table public.lesson in share row exclusive mode;
lock table public.lesson_run in share row exclusive mode;

do $migration$
begin
  if exists (
    select 1
    from public.course as course
    join public.course_publication as publication
      on publication.source_course_id = course.id
    where course.archived_at is not null
      and publication.status = 'published'
  ) then
    raise exception 'archived_course_has_published_listing'
      using errcode = '55000';
  end if;

  if exists (
    select 1
    from public.course as course
    join public.lesson as lesson on lesson.course_id = course.id
    join public.lesson_run as run on run.lesson_id = lesson.id
    where course.archived_at is not null
      and run.ended_at is null
      and run.cancelled_at is null
  ) then
    raise exception 'archived_course_has_open_lesson_run'
      using errcode = '55000';
  end if;
end
$migration$;

-- Every archive path, including privileged maintenance SQL, rechecks the
-- publication and open-Run invariants while the Course row is write-locked.
create function public.guard_course_archive_invariants()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if old.archived_at is null and new.archived_at is not null then
    if exists (
      select 1
      from public.course_publication as publication
      where publication.source_course_id = old.id
        and publication.status = 'published'
    ) then
      raise exception 'course_is_published'
        using errcode = '55000';
    end if;

    if exists (
      select 1
      from public.lesson as lesson
      join public.lesson_run as run on run.lesson_id = lesson.id
      where lesson.course_id = old.id
        and run.ended_at is null
        and run.cancelled_at is null
    ) then
      raise exception 'course_has_open_lesson_runs'
        using errcode = '55000';
    end if;
  end if;

  return new;
end
$function$;

revoke all on function public.guard_course_archive_invariants()
from public, anon, authenticated, service_role;
grant all on function public.guard_course_archive_invariants() to postgres;

create trigger trg_course_archive_invariants
before update of archived_at on public.course
for each row execute function public.guard_course_archive_invariants();

-- Publication and scheduling both serialize on the same Course row as the
-- archive RPC. These guards cover the reverse lock order too: an operation
-- that waited behind a successful archive cannot commit afterwards.
create function public.guard_course_publication_active_source()
returns trigger
language plpgsql
set search_path = ''
as $function$
declare
  v_archived_at timestamptz;
begin
  if new.status = 'published' and new.source_course_id is not null then
    select course.archived_at
    into v_archived_at
    from public.course as course
    where course.id = new.source_course_id
    for update of course;

    if not found or v_archived_at is not null then
      raise exception 'course_publication_source_not_found'
        using errcode = 'P0002';
    end if;
  end if;

  return new;
end
$function$;

revoke all on function public.guard_course_publication_active_source()
from public, anon, authenticated, service_role;
grant all on function public.guard_course_publication_active_source()
to postgres;

create trigger trg_course_publication_active_source
before insert or update of status, source_course_id
on public.course_publication
for each row execute function public.guard_course_publication_active_source();

-- A Lesson belongs to one Course for its whole lifetime. Moving it would also
-- move the meaning of durable Runs and records, and could bypass Course locks.
create function public.guard_lesson_course_immutable()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if old.course_id is distinct from new.course_id then
    raise exception 'lesson_course_move_forbidden'
      using errcode = '55000';
  end if;

  return new;
end
$function$;

revoke all on function public.guard_lesson_course_immutable()
from public, anon, authenticated, service_role;
grant all on function public.guard_lesson_course_immutable() to postgres;

create trigger trg_lesson_course_immutable
before update of course_id on public.lesson
for each row execute function public.guard_lesson_course_immutable();

create function public.guard_lesson_run_active_course()
returns trigger
language plpgsql
set search_path = ''
as $function$
declare
  v_course_id uuid;
  v_archived_at timestamptz;
begin
  if new.ended_at is null and new.cancelled_at is null then
    select lesson.course_id
    into v_course_id
    from public.lesson as lesson
    where lesson.id = new.lesson_id;

    if not found then
      raise exception 'lesson_not_found'
        using errcode = 'P0002';
    end if;

    select course.archived_at
    into v_archived_at
    from public.course as course
    where course.id = v_course_id
    for update of course;

    if not found or v_archived_at is not null then
      raise exception 'lesson_not_found'
        using errcode = 'P0002';
    end if;
  end if;

  return new;
end
$function$;

revoke all on function public.guard_lesson_run_active_course()
from public, anon, authenticated, service_role;
grant all on function public.guard_lesson_run_active_course() to postgres;

create trigger trg_lesson_run_active_course
before insert or update of lesson_id, ended_at, cancelled_at
on public.lesson_run
for each row execute function public.guard_lesson_run_active_course();

create function public.archive_course(p_course_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor_user_id uuid := (select auth.uid());
  v_course_id uuid;
begin
  if v_actor_user_id is null or p_course_id is null then
    return 'not_found';
  end if;

  select course.id
  into v_course_id
  from public.course as course
  join public.account as account on account.id = course.owner_account_id
  where course.id = p_course_id
    and course.archived_at is null
    and account.auth_user_id = v_actor_user_id
    and account.status = 'active'
  for update of course;

  if not found then
    return 'not_found';
  end if;

  if exists (
    select 1
    from public.course_publication as publication
    where publication.source_course_id = v_course_id
      and publication.status = 'published'
  ) then
    return 'course_is_published';
  end if;

  if exists (
    select 1
    from public.lesson as lesson
    join public.lesson_run as run on run.lesson_id = lesson.id
    where lesson.course_id = v_course_id
      and run.ended_at is null
      and run.cancelled_at is null
  ) then
    return 'course_has_open_lesson_runs';
  end if;

  update public.course as course
  set archived_at = clock_timestamp()
  where course.id = v_course_id
    and course.archived_at is null;

  if not found then
    return 'not_found';
  end if;

  return 'archived';
end
$function$;

revoke all on function public.archive_course(uuid)
from public, anon, authenticated, service_role;
grant all on function public.archive_course(uuid) to postgres;
grant execute on function public.archive_course(uuid) to authenticated;

-- Child-authoring triggers must retain the ability to touch the protected
-- Course freshness clocks after browser Course UPDATE is narrowed below.
-- Their fixed empty search_path and closed EXECUTE ACL make the definer
-- boundary private to the trigger graph rather than a caller-facing API.
alter function public.touch_course_from_authoring_child() security definer;
alter function public.touch_courses_from_stored_file() security definer;

-- Browser Course edits keep only their actual column surface. In particular,
-- authenticated callers can no longer bypass the RPC with archived_at PATCH
-- or permanently delete the authored hierarchy through PostgREST.
revoke update, delete on table public.course from authenticated;
grant update (
  title,
  subject,
  goal,
  level,
  audience_description,
  target_lesson_count,
  teacher_preferences,
  audience_type,
  settings,
  assembled_at
) on public.course to authenticated;

revoke update, delete on table public.lesson from authenticated;
grant update (
  "position",
  title,
  summary,
  estimated_duration_minutes,
  settings
) on public.lesson to authenticated;

do $migration$
declare
  v_archive_proc oid := to_regprocedure('public.archive_course(uuid)');
  v_touch_authoring_proc oid := to_regprocedure(
    'public.touch_course_from_authoring_child()'
  );
  v_touch_stored_file_proc oid := to_regprocedure(
    'public.touch_courses_from_stored_file()'
  );
begin
  if v_archive_proc is null
    or not exists (
      select 1
      from pg_proc as procedure
      where procedure.oid = v_archive_proc
        and procedure.prosecdef
        and procedure.proconfig @> array['search_path=""']::text[]
        and procedure.proowner = (
          select relation.relowner
          from pg_class as relation
          where relation.oid = 'public.course'::regclass
        )
    )
  then
    raise exception 'archive_course_function_contract_invalid'
      using errcode = '55000';
  end if;

  if exists (
    select 1
    from pg_proc as procedure
    cross join lateral aclexplode(
      coalesce(procedure.proacl, acldefault('f', procedure.proowner))
    ) as privilege
    where procedure.oid = v_archive_proc
      and privilege.grantee = 0
      and privilege.privilege_type = 'EXECUTE'
  )
    or has_function_privilege('anon', v_archive_proc, 'EXECUTE')
    or has_function_privilege('service_role', v_archive_proc, 'EXECUTE')
    or not has_function_privilege('authenticated', v_archive_proc, 'EXECUTE')
  then
    raise exception 'archive_course_function_acl_invalid'
      using errcode = '55000';
  end if;

  if exists (
    select 1
    from unnest(array[
      'public.guard_course_archive_invariants()',
      'public.guard_course_publication_active_source()',
      'public.guard_lesson_course_immutable()',
      'public.guard_lesson_run_active_course()'
    ]) as guarded(signature)
    left join pg_proc as procedure
      on procedure.oid = to_regprocedure(guarded.signature)
    where procedure.oid is null
      or procedure.prosecdef
      or procedure.proconfig is null
      or not (procedure.proconfig @> array['search_path=""']::text[])
      or procedure.proowner <> (
        select relation.relowner
        from pg_class as relation
        where relation.oid = 'public.course'::regclass
      )
  )
    or exists (
      select 1
      from unnest(array[
        'public.guard_course_archive_invariants()',
        'public.guard_course_publication_active_source()',
        'public.guard_lesson_course_immutable()',
        'public.guard_lesson_run_active_course()'
      ]) as guarded(signature)
      join pg_proc as procedure
        on procedure.oid = to_regprocedure(guarded.signature)
      cross join lateral aclexplode(
        coalesce(procedure.proacl, acldefault('f', procedure.proowner))
      ) as privilege
      where privilege.grantee = 0
        and privilege.privilege_type = 'EXECUTE'
    )
    or exists (
      select 1
      from unnest(array[
        'public.guard_course_archive_invariants()',
        'public.guard_course_publication_active_source()',
        'public.guard_lesson_course_immutable()',
        'public.guard_lesson_run_active_course()'
      ]) as guarded(signature)
      cross join unnest(array['anon', 'authenticated', 'service_role'])
        as actor(role_name)
      where has_function_privilege(
        actor.role_name,
        guarded.signature,
        'EXECUTE'
      )
    )
  then
    raise exception 'course_archive_guard_function_contract_invalid'
      using errcode = '55000';
  end if;

  if v_touch_authoring_proc is null
    or v_touch_stored_file_proc is null
    or exists (
      select 1
      from pg_proc as procedure
      where procedure.oid in (
        v_touch_authoring_proc,
        v_touch_stored_file_proc
      )
        and (
          not procedure.prosecdef
          or procedure.proconfig is null
          or not (procedure.proconfig @> array['search_path=""']::text[])
          or procedure.proowner <> (
            select relation.relowner
            from pg_class as relation
            where relation.oid = 'public.course'::regclass
          )
        )
    )
    or exists (
      select 1
      from pg_proc as procedure
      cross join lateral aclexplode(
        coalesce(procedure.proacl, acldefault('f', procedure.proowner))
      ) as privilege
      where procedure.oid in (
        v_touch_authoring_proc,
        v_touch_stored_file_proc
      )
        and privilege.grantee = 0
        and privilege.privilege_type = 'EXECUTE'
    )
    or has_function_privilege(
      'anon',
      v_touch_authoring_proc,
      'EXECUTE'
    )
    or has_function_privilege(
      'anon',
      v_touch_stored_file_proc,
      'EXECUTE'
    )
    or has_function_privilege(
      'authenticated',
      v_touch_authoring_proc,
      'EXECUTE'
    )
    or has_function_privilege(
      'authenticated',
      v_touch_stored_file_proc,
      'EXECUTE'
    )
    or has_function_privilege(
      'service_role',
      v_touch_authoring_proc,
      'EXECUTE'
    )
    or has_function_privilege(
      'service_role',
      v_touch_stored_file_proc,
      'EXECUTE'
    )
  then
    raise exception 'course_touch_function_contract_invalid'
      using errcode = '55000';
  end if;

  if has_table_privilege('authenticated', 'public.course', 'UPDATE')
    or has_table_privilege('authenticated', 'public.course', 'DELETE')
    or has_column_privilege(
      'authenticated',
      'public.course',
      'archived_at',
      'UPDATE'
    )
    or not (
      select bool_and(
        has_column_privilege(
          'authenticated',
          'public.course',
          allowed.column_name,
          'UPDATE'
        )
      )
      from unnest(array[
        'title',
        'subject',
        'goal',
        'level',
        'audience_description',
        'target_lesson_count',
        'teacher_preferences',
        'audience_type',
        'settings',
        'assembled_at'
      ]) as allowed(column_name)
    )
    or exists (
      select 1
      from pg_attribute as attribute
      where attribute.attrelid = 'public.course'::regclass
        and attribute.attnum > 0
        and not attribute.attisdropped
        and attribute.attname <> all(array[
          'title',
          'subject',
          'goal',
          'level',
          'audience_description',
          'target_lesson_count',
          'teacher_preferences',
          'audience_type',
          'settings',
          'assembled_at'
        ])
        and has_column_privilege(
          'authenticated',
          'public.course',
          attribute.attname,
          'UPDATE'
        )
    )
  then
    raise exception 'course_acl_postcondition_failed'
      using errcode = '55000';
  end if;

  if has_table_privilege('authenticated', 'public.lesson', 'UPDATE')
    or has_table_privilege('authenticated', 'public.lesson', 'DELETE')
    or has_column_privilege(
      'authenticated',
      'public.lesson',
      'course_id',
      'UPDATE'
    )
    or not (
      select bool_and(
        has_column_privilege(
          'authenticated',
          'public.lesson',
          allowed.column_name,
          'UPDATE'
        )
      )
      from unnest(array[
        'position',
        'title',
        'summary',
        'estimated_duration_minutes',
        'settings'
      ]) as allowed(column_name)
    )
    or exists (
      select 1
      from pg_attribute as attribute
      where attribute.attrelid = 'public.lesson'::regclass
        and attribute.attnum > 0
        and not attribute.attisdropped
        and attribute.attname <> all(array[
          'position',
          'title',
          'summary',
          'estimated_duration_minutes',
          'settings'
        ])
        and has_column_privilege(
          'authenticated',
          'public.lesson',
          attribute.attname,
          'UPDATE'
        )
    )
  then
    raise exception 'lesson_acl_postcondition_failed'
      using errcode = '55000';
  end if;

  if exists (
    select 1
    from (values
      (
        'public.course'::regclass,
        'trg_course_archive_invariants',
        to_regprocedure('public.guard_course_archive_invariants()'),
        19::smallint,
        array['archived_at']::text[]
      ),
      (
        'public.course_publication'::regclass,
        'trg_course_publication_active_source',
        to_regprocedure('public.guard_course_publication_active_source()'),
        23::smallint,
        array['status', 'source_course_id']::text[]
      ),
      (
        'public.lesson'::regclass,
        'trg_lesson_course_immutable',
        to_regprocedure('public.guard_lesson_course_immutable()'),
        19::smallint,
        array['course_id']::text[]
      ),
      (
        'public.lesson_run'::regclass,
        'trg_lesson_run_active_course',
        to_regprocedure('public.guard_lesson_run_active_course()'),
        23::smallint,
        array['lesson_id', 'ended_at', 'cancelled_at']::text[]
      )
    ) as required_trigger(
      relation_id,
      trigger_name,
      function_id,
      trigger_type,
      column_names
    )
    where not exists (
      select 1
      from pg_trigger as trigger_row
      where trigger_row.tgrelid = required_trigger.relation_id
        and trigger_row.tgname = required_trigger.trigger_name
        and trigger_row.tgfoid = required_trigger.function_id
        and trigger_row.tgtype = required_trigger.trigger_type
        and not trigger_row.tgisinternal
        and trigger_row.tgenabled = 'O'
        and trigger_row.tgqual is null
        and (
          select array_agg(
            attribute.attname::text
            order by attribute.attname::text
          )
          from unnest(trigger_row.tgattr::smallint[])
            as column_ref(attnum)
          join pg_attribute as attribute
            on attribute.attrelid = trigger_row.tgrelid
           and attribute.attnum = column_ref.attnum
        ) = (
          select array_agg(column_name order by column_name)
          from unnest(required_trigger.column_names) as column_name
        )
    )
  ) then
    raise exception 'atomic_course_archive_triggers_missing'
      using errcode = '55000';
  end if;

  if exists (
    select 1
    from public.course as course
    join public.course_publication as publication
      on publication.source_course_id = course.id
    where course.archived_at is not null
      and publication.status = 'published'
  ) or exists (
    select 1
    from public.course as course
    join public.lesson as lesson on lesson.course_id = course.id
    join public.lesson_run as run on run.lesson_id = lesson.id
    where course.archived_at is not null
      and run.ended_at is null
      and run.cancelled_at is null
  ) then
    raise exception 'atomic_course_archive_postcondition_failed'
      using errcode = '55000';
  end if;
end
$migration$;

notify pgrst, 'reload schema';

commit;
