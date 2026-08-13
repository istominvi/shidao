begin;

do $migration$
declare
  v_expected_trigger_count constant integer := 7;
  v_guard_owner oid;
begin
  if to_regclass('public.account') is null
    or to_regclass('public.course') is null
    or to_regclass('public.lesson') is null
    or to_regclass('public.lesson_component') is null
    or to_regclass('public.lesson_student_slide') is null
    or to_regclass('public.course_attachment') is null
    or to_regclass('public.course_attestation') is null
    or to_regclass('public.stored_file') is null
    or to_regprocedure(
      'public.educator_course_author_can_mutate(uuid)'
    ) is null
    or to_regprocedure(
      'public.guard_educator_course_content_mutation()'
    ) is null
    or to_regrole('authenticated') is null
    or to_regrole('service_role') is null
  then
    raise exception 'shidao_schema_sanity_check_failed'
      using errcode = '55000';
  end if;

  select procedure.proowner
  into v_guard_owner
  from pg_proc as procedure
  where procedure.oid =
    'public.guard_educator_course_content_mutation()'::regprocedure;

  if v_guard_owner is distinct from (
      select relation.relowner
      from pg_class as relation
      where relation.oid = 'public.course'::regclass
    )
    or exists (
      select 1
      from unnest(array[
        'public.account'::regclass,
        'public.lesson'::regclass,
        'public.lesson_component'::regclass,
        'public.lesson_student_slide'::regclass,
        'public.course_attachment'::regclass,
        'public.course_attestation'::regclass,
        'public.stored_file'::regclass
      ]) as required_relation(relation_id)
      join pg_class as relation on relation.oid = required_relation.relation_id
      where relation.relowner <> v_guard_owner
    )
    or exists (
      select 1
      from pg_proc as procedure
      where procedure.oid =
          'public.educator_course_author_can_mutate(uuid)'::regprocedure
        and procedure.proowner <> v_guard_owner
    )
  then
    raise exception 'educator_course_content_guard_owner_precondition_failed'
      using errcode = '55000';
  end if;

  if not exists (
    select 1
    from pg_proc as procedure
    where procedure.oid =
        'public.educator_course_author_can_mutate(uuid)'::regprocedure
      and not procedure.prosecdef
      and procedure.proconfig @> array['search_path=""']
  )
    or not exists (
      select 1
      from pg_proc as procedure
      where procedure.oid =
          'public.guard_educator_course_content_mutation()'::regprocedure
        and not procedure.prosecdef
        and procedure.proconfig @> array['search_path=""']
    )
  then
    raise exception 'educator_course_content_guard_mode_precondition_failed'
      using errcode = '55000';
  end if;

  if has_function_privilege(
      'authenticated',
      'public.educator_course_author_can_mutate(uuid)',
      'EXECUTE'
    )
    or has_function_privilege(
      'anon',
      'public.educator_course_author_can_mutate(uuid)',
      'EXECUTE'
    )
    or not has_function_privilege(
      'service_role',
      'public.educator_course_author_can_mutate(uuid)',
      'EXECUTE'
    )
    or not has_function_privilege(
      'postgres',
      'public.educator_course_author_can_mutate(uuid)',
      'EXECUTE'
    )
  then
    raise exception 'educator_course_author_helper_acl_precondition_failed'
      using errcode = '55000';
  end if;

  if (
    select count(*)
    from pg_trigger as trigger_row
    join pg_class as relation on relation.oid = trigger_row.tgrelid
    where not trigger_row.tgisinternal
      and trigger_row.tgfoid =
        'public.guard_educator_course_content_mutation()'::regprocedure
      and trigger_row.tgenabled = 'O'
      and (relation.relname, trigger_row.tgname) in (
        ('course', 'trg_course_educator_content_mutation'),
        ('course_attachment', 'trg_course_attachment_educator_content_mutation'),
        ('course_attestation', 'trg_course_attestation_educator_content_mutation'),
        ('lesson', 'trg_lesson_educator_content_mutation'),
        ('lesson_component', 'trg_lesson_component_educator_content_mutation'),
        ('lesson_student_slide', 'trg_lesson_student_slide_educator_content_mutation'),
        ('stored_file', 'trg_stored_file_educator_content_mutation')
      )
  ) <> v_expected_trigger_count then
    raise exception 'educator_course_content_guard_trigger_set_invalid'
      using errcode = '55000';
  end if;
end
$migration$;

-- Keep the trigger and its helper SECURITY INVOKER. The original E2 guard
-- called a closed helper, so authenticated direct DML reached the trigger and
-- failed on the nested EXECUTE check before the capability predicate ran.
-- Inlining that read preserves the caller's existing grants/RLS boundary and
-- does not expose a new browser-callable authorization RPC.
create or replace function public.guard_educator_course_content_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_course_id uuid;
begin
  if tg_table_name = 'course' then
    v_course_id := case when tg_op = 'DELETE' then old.id else new.id end;
  elsif tg_table_name in ('lesson', 'course_attachment', 'course_attestation') then
    v_course_id := case
      when tg_op = 'DELETE' then old.course_id
      else new.course_id
    end;
  elsif tg_table_name in ('lesson_component', 'lesson_student_slide') then
    select lesson.course_id
    into v_course_id
    from public.lesson as lesson
    where lesson.id = case
      when tg_op = 'DELETE' then old.lesson_id
      else new.lesson_id
    end;
  elsif tg_table_name = 'stored_file' then
    if not exists (
      select 1
      from public.course_attachment as attachment
      join public.course as course on course.id = attachment.course_id
      join public.account as account on account.id = course.owner_account_id
      where attachment.stored_file_id = case
          when tg_op = 'DELETE' then old.id
          else new.id
        end
        and course.learning_audience = 'educators'
        and (
          account.status <> 'active'
          or not account.can_author_educator_courses
        )
    ) then
      if tg_op = 'DELETE' then return old; end if;
      return new;
    end if;

    raise exception 'educator_course_authoring_not_allowed'
      using errcode = '42501';
  end if;

  if v_course_id is not null
    and not coalesce((
      select course.learning_audience = 'children'
        or (
          account.status = 'active'
          and account.can_author_educator_courses
        )
      from public.course as course
      join public.account as account on account.id = course.owner_account_id
      where course.id = v_course_id
    ), false)
  then
    raise exception 'educator_course_authoring_not_allowed'
      using errcode = '42501';
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end
$function$;

revoke all on function public.guard_educator_course_content_mutation()
from public, anon, authenticated, service_role;
grant execute on function public.guard_educator_course_content_mutation()
to postgres;

do $migration$
declare
  v_guard_definition text;
  v_guard_owner oid;
begin
  select pg_get_functiondef(procedure.oid)
  into v_guard_definition
  from pg_proc as procedure
  where procedure.oid =
    'public.guard_educator_course_content_mutation()'::regprocedure;

  select procedure.proowner
  into v_guard_owner
  from pg_proc as procedure
  where procedure.oid =
    'public.guard_educator_course_content_mutation()'::regprocedure;

  if not exists (
    select 1
    from pg_proc as procedure
    where procedure.oid =
        'public.guard_educator_course_content_mutation()'::regprocedure
      and not procedure.prosecdef
      and procedure.proconfig @> array['search_path=""']
  )
    or v_guard_owner is distinct from (
      select relation.relowner
      from pg_class as relation
      where relation.oid = 'public.course'::regclass
    )
    or v_guard_definition like '%educator_course_author_can_mutate%'
    or v_guard_definition not like '%account.can_author_educator_courses%'
    or v_guard_definition not like '%course.learning_audience = ''children''%'
  then
    raise exception 'educator_course_content_guard_definition_invalid'
      using errcode = '55000';
  end if;

  if has_function_privilege(
      'authenticated',
      'public.guard_educator_course_content_mutation()',
      'EXECUTE'
    )
    or has_function_privilege(
      'anon',
      'public.guard_educator_course_content_mutation()',
      'EXECUTE'
    )
    or has_function_privilege(
      'service_role',
      'public.guard_educator_course_content_mutation()',
      'EXECUTE'
    )
    or not has_function_privilege(
      'postgres',
      'public.guard_educator_course_content_mutation()',
      'EXECUTE'
    )
    or has_function_privilege(
      'authenticated',
      'public.educator_course_author_can_mutate(uuid)',
      'EXECUTE'
    )
    or has_function_privilege(
      'anon',
      'public.educator_course_author_can_mutate(uuid)',
      'EXECUTE'
    )
  then
    raise exception 'educator_course_content_guard_acl_postcondition_failed'
      using errcode = '55000';
  end if;
end
$migration$;

notify pgrst, 'reload schema';

commit;
