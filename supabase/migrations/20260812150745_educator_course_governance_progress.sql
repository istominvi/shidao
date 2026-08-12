begin;

do $migration$
begin
  if to_regclass('public.account') is null
    or to_regclass('public.course') is null
    or to_regclass('public.course_publication') is null
    or to_regclass('public.course_publication_revision') is null
    or to_regclass('public.course_publication_attestation') is null
    or to_regclass('public.course_attestation_award') is null
    or to_regprocedure(
      'public.publish_course_revision_with_attestation_admin(uuid,uuid,uuid,uuid,text,jsonb,jsonb,boolean,text,jsonb)'
    ) is null
    or to_regrole('authenticated') is null
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

  if exists (
    select 1
    from pg_attribute as attribute
    where attribute.attrelid = 'public.account'::regclass
      and attribute.attname = 'can_author_educator_courses'
      and attribute.attnum > 0
      and not attribute.attisdropped
  )
    or exists (
      select 1
      from pg_attribute as attribute
      where attribute.attrelid = 'public.course_publication'::regclass
        and attribute.attname = 'approved_revision_id'
        and attribute.attnum > 0
        and not attribute.attisdropped
    )
    or to_regclass('public.educator_course_revision_review') is not null
    or to_regclass('public.course_publication_self_enrollment') is not null
    or to_regclass('public.course_publication_lesson_completion') is not null
    or to_regprocedure(
      'public.get_my_course_publication_progress(uuid)'
    ) is not null
    or to_regprocedure(
      'public.set_my_course_publication_lesson_progress(uuid,uuid,uuid,boolean)'
    ) is not null
  then
    raise exception 'educator_course_governance_objects_already_exist'
      using errcode = '55000';
  end if;

  if not exists (
    select 1
    from pg_trigger as trigger
    where trigger.tgrelid = 'public.course_publication_revision'::regclass
      and trigger.tgname = 'trg_course_publication_revision_immutable'
      and not trigger.tgisinternal
      and trigger.tgenabled = 'O'
      and trigger.tgfoid =
        'public.reject_course_publication_immutable_update()'::regprocedure
  ) then
    raise exception 'course_publication_revision_immutable_trigger_missing'
      using errcode = '55000';
  end if;
end
$migration$;
lock table public.account in share row exclusive mode;
lock table public.course in share row exclusive mode;
lock table public.course_publication in share row exclusive mode;
lock table public.course_publication_revision in share row exclusive mode;
lock table public.course_publication_attestation in share row exclusive mode;
lock table public.course_attestation_award in share row exclusive mode;

alter table public.account
  add column can_author_educator_courses boolean not null default false;

revoke update (can_author_educator_courses) on table public.account
from public, anon, authenticated;

alter table public.course_publication
  add column approved_revision_id uuid null;

alter table public.course_publication_revision
  drop constraint course_publication_revision_license_code_check;

alter table public.course_publication_revision
  add constraint course_publication_revision_license_code_check check (
    license_code in (
      'shidao_catalog_reuse_v1',
      'shidao_official_learning_v1'
    )
  );

-- The generic publisher persists the legacy reusable license explicitly. A
-- BEFORE INSERT guard derives the canonical audience from the source Course,
-- including the first-publish transition where the listing still has its
-- children default, and writes the immutable revision correctly at birth.
create function public.set_course_publication_revision_license_on_insert()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_learning_audience text;
begin
  select course.learning_audience
  into v_learning_audience
  from public.course_publication as publication
  join public.course as course
    on course.id = publication.source_course_id
   and course.owner_account_id = publication.owner_account_id
  join public.account as account
    on account.id = publication.owner_account_id
   and account.status = 'active'
  where publication.id = new.publication_id
    and course.archived_at is null
    and (
      course.learning_audience = 'children'
      or account.can_author_educator_courses
    )
  for share of publication, course, account;

  if not found then
    raise exception 'course_publication_revision_source_not_authorized'
      using errcode = '42501';
  end if;

  if v_learning_audience = 'educators' then
    new.license_code := 'shidao_official_learning_v1';
  elsif v_learning_audience = 'children' then
    if new.license_code <> 'shidao_catalog_reuse_v1' then
      raise exception 'child_course_publication_license_invalid'
        using errcode = '23514';
    end if;
  else
    raise exception 'course_publication_learning_audience_invalid'
      using errcode = '23514';
  end if;

  return new;
end
$function$;

revoke all on function
public.set_course_publication_revision_license_on_insert()
from public, anon, authenticated, service_role;
grant execute on function
public.set_course_publication_revision_license_on_insert()
to postgres;

create trigger trg_course_publication_revision_license_insert
before insert on public.course_publication_revision
for each row execute function
public.set_course_publication_revision_license_on_insert();

alter table public.course_publication
  add constraint course_publication_approved_revision_fkey
  foreign key (id, approved_revision_id)
  references public.course_publication_revision(publication_id, id)
  deferrable initially deferred;

alter table public.course_publication
  add constraint educator_course_publication_official_check check (
    learning_audience <> 'educators' or is_shidao
  ) not valid;

alter table public.course_publication
  add constraint course_publication_approved_revision_audience_check check (
    approved_revision_id is null or learning_audience = 'educators'
  );

create table public.educator_course_revision_review (
  revision_id uuid primary key,
  publication_id uuid not null,
  status text not null check (status in ('pending', 'approved', 'rejected')),
  submitted_by_account_id uuid not null
    references public.account(id) on delete restrict,
  reviewed_by_account_id uuid null
    references public.account(id) on delete restrict,
  review_feedback text null check (
    review_feedback is null
    or (
      review_feedback = btrim(review_feedback)
      and char_length(review_feedback) between 1 and 2000
    )
  ),
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz null,
  updated_at timestamptz not null default now(),
  constraint educator_course_revision_review_identity_fkey
    foreign key (publication_id, revision_id)
    references public.course_publication_revision(publication_id, id)
    on delete cascade,
  constraint educator_course_revision_review_shape_check check (
    (status = 'pending'
      and reviewed_by_account_id is null
      and reviewed_at is null
      and review_feedback is null)
    or (status = 'approved'
      and reviewed_at is not null
      and review_feedback is null)
    or (status = 'rejected'
      and reviewed_at is not null)
  )
);

create index educator_course_revision_review_publication_status_idx
  on public.educator_course_revision_review (
    publication_id,
    status,
    submitted_at desc,
    revision_id
  );

create table public.course_publication_self_enrollment (
  account_id uuid not null
    references public.account(id) on delete cascade,
  publication_id uuid not null,
  revision_id uuid not null,
  last_opened_lesson_ref uuid null,
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint course_publication_self_enrollment_pkey
    primary key (account_id, publication_id, revision_id),
  constraint course_publication_self_enrollment_revision_fkey
    foreign key (publication_id, revision_id)
    references public.course_publication_revision(publication_id, id)
    on delete cascade
);

create index course_publication_self_enrollment_revision_idx
  on public.course_publication_self_enrollment (
    publication_id,
    revision_id,
    updated_at desc,
    account_id
  );

create table public.course_publication_lesson_completion (
  account_id uuid not null,
  publication_id uuid not null,
  revision_id uuid not null,
  lesson_ref uuid not null,
  completed_at timestamptz not null default now(),
  constraint course_publication_lesson_completion_pkey
    primary key (account_id, publication_id, revision_id, lesson_ref),
  constraint course_publication_lesson_completion_enrollment_fkey
    foreign key (account_id, publication_id, revision_id)
    references public.course_publication_self_enrollment(
      account_id,
      publication_id,
      revision_id
    ) on delete cascade
);

create index course_publication_lesson_completion_revision_idx
  on public.course_publication_lesson_completion (
    publication_id,
    revision_id,
    account_id,
    completed_at
  );

alter table public.educator_course_revision_review enable row level security;
alter table public.course_publication_self_enrollment enable row level security;
alter table public.course_publication_lesson_completion enable row level security;

revoke all on table public.educator_course_revision_review
from public, anon, authenticated;
revoke all on table public.course_publication_self_enrollment
from public, anon, authenticated;
revoke all on table public.course_publication_lesson_completion
from public, anon, authenticated;

grant all on table public.educator_course_revision_review
to postgres, service_role;
grant all on table public.course_publication_self_enrollment
to postgres, service_role;
grant all on table public.course_publication_lesson_completion
to postgres, service_role;

-- Existing educator publications are the already-live ShiDao demo. Preserve
-- their visibility by approving the exact immutable revision already served.
update public.course_publication as publication
set is_shidao = true
where publication.learning_audience = 'educators';

-- Validate before approved_revision_id creates a deferred FK event on the
-- same table; PostgreSQL intentionally refuses ALTER TABLE while such events
-- are pending inside this transaction.
alter table public.course_publication
  validate constraint educator_course_publication_official_check;

do $migration$
begin
  if exists (
    select 1
    from public.course_publication_origin as origin
    join public.course_publication as publication
      on publication.id = origin.publication_id
    where publication.learning_audience = 'educators'
  ) then
    raise exception 'educator_course_legacy_copy_origin_exists'
      using errcode = '55000';
  end if;
end
$migration$;

-- Legacy educator revisions predate the official-learning license. They are
-- immutable application rows, so this one locked migration backfill disables
-- only their exact UPDATE rejection trigger, changes only the license column,
-- and immediately restores and verifies the trigger in the same transaction.
alter table public.course_publication_revision
  disable trigger trg_course_publication_revision_immutable;

update public.course_publication_revision as revision
set license_code = 'shidao_official_learning_v1'
where revision.license_code = 'shidao_catalog_reuse_v1'
  and exists (
  select 1
  from public.course_publication as publication
  where publication.id = revision.publication_id
    and publication.learning_audience = 'educators'
);

alter table public.course_publication_revision
  enable trigger trg_course_publication_revision_immutable;

do $migration$
begin
  if not exists (
    select 1
    from pg_trigger as trigger
    where trigger.tgrelid = 'public.course_publication_revision'::regclass
      and trigger.tgname = 'trg_course_publication_revision_immutable'
      and not trigger.tgisinternal
      and trigger.tgenabled = 'O'
      and trigger.tgfoid =
        'public.reject_course_publication_immutable_update()'::regprocedure
  ) or exists (
    select 1
    from public.course_publication_revision as revision
    join public.course_publication as publication
      on publication.id = revision.publication_id
    where publication.learning_audience = 'educators'
      and revision.license_code <> 'shidao_official_learning_v1'
  ) then
    raise exception 'educator_course_legacy_license_backfill_failed'
      using errcode = '55000';
  end if;
end
$migration$;

update public.course_publication as publication
set approved_revision_id = publication.current_revision_id
where publication.learning_audience = 'educators';

insert into public.educator_course_revision_review (
  revision_id,
  publication_id,
  status,
  submitted_by_account_id,
  reviewed_by_account_id,
  submitted_at,
  reviewed_at,
  updated_at
)
select
  publication.current_revision_id,
  publication.id,
  'approved',
  publication.owner_account_id,
  null,
  revision.published_at,
  revision.published_at,
  revision.published_at
from public.course_publication as publication
join public.course_publication_revision as revision
  on revision.publication_id = publication.id
 and revision.id = publication.current_revision_id
where publication.learning_audience = 'educators'
on conflict (revision_id) do nothing;

update public.account as account
set can_author_educator_courses = true,
    updated_at = clock_timestamp()
where exists (
  select 1
  from public.course as course
  where course.owner_account_id = account.id
    and course.learning_audience = 'educators'
);

alter table public.course
  add constraint educator_course_audience_type_check check (
    learning_audience <> 'educators' or audience_type = 'none'
  );

-- A historical award proves that every lesson of that exact published
-- revision had been completed under the pre-governance demo contract.
insert into public.course_publication_self_enrollment (
  account_id,
  publication_id,
  revision_id,
  last_opened_lesson_ref,
  started_at,
  updated_at
)
select
  award.account_id,
  award.publication_id,
  award.revision_id,
  last_lesson.lesson_ref,
  award.issued_at,
  award.issued_at
from public.course_attestation_award as award
join public.course_publication as publication
  on publication.id = award.publication_id
 and publication.learning_audience = 'educators'
 and publication.approved_revision_id = award.revision_id
join public.course_publication_revision as revision
  on revision.publication_id = award.publication_id
 and revision.id = award.revision_id
left join lateral (
  select (lesson.value ->> 'ref')::uuid as lesson_ref
  from jsonb_array_elements(revision.snapshot -> 'lessons')
    with ordinality as lesson(value, position)
  order by lesson.position desc
  limit 1
) as last_lesson on true
on conflict (account_id, publication_id, revision_id) do nothing;

insert into public.course_publication_lesson_completion (
  account_id,
  publication_id,
  revision_id,
  lesson_ref,
  completed_at
)
select
  award.account_id,
  award.publication_id,
  award.revision_id,
  (lesson.value ->> 'ref')::uuid,
  award.issued_at
from public.course_attestation_award as award
join public.course_publication as publication
  on publication.id = award.publication_id
 and publication.learning_audience = 'educators'
 and publication.approved_revision_id = award.revision_id
join public.course_publication_revision as revision
  on revision.publication_id = award.publication_id
 and revision.id = award.revision_id
cross join lateral jsonb_array_elements(revision.snapshot -> 'lessons')
  as lesson(value)
on conflict (account_id, publication_id, revision_id, lesson_ref) do nothing;

create function public.course_publication_revision_has_lesson_ref(
  p_publication_id uuid,
  p_revision_id uuid,
  p_lesson_ref uuid
)
returns boolean
language sql
stable
set search_path = ''
as $function$
  select exists (
    select 1
    from public.course_publication_revision as revision
    cross join lateral jsonb_array_elements(revision.snapshot -> 'lessons')
      as lesson(value)
    where revision.publication_id = p_publication_id
      and revision.id = p_revision_id
      and lesson.value ->> 'ref' = p_lesson_ref::text
  );
$function$;

revoke all on function public.course_publication_revision_has_lesson_ref(
  uuid,
  uuid,
  uuid
)
from public, anon, authenticated, service_role;
grant execute on function public.course_publication_revision_has_lesson_ref(
  uuid,
  uuid,
  uuid
)
to postgres, service_role;

create function public.guard_course_publication_progress_integrity()
returns trigger
language plpgsql
set search_path = ''
as $function$
declare
  v_publication_id uuid := new.publication_id;
  v_revision_id uuid := new.revision_id;
  v_lesson_ref uuid;
begin
  if tg_table_name = 'course_publication_self_enrollment' then
    v_lesson_ref := new.last_opened_lesson_ref;
  else
    v_lesson_ref := new.lesson_ref;
  end if;

  perform 1
  from public.course_publication as publication
  join public.account as owner_account
    on owner_account.id = publication.owner_account_id
  join public.educator_course_revision_review as review
    on review.publication_id = publication.id
   and review.revision_id = v_revision_id
   and review.status = 'approved'
  where publication.id = v_publication_id
    and publication.approved_revision_id = v_revision_id
    and publication.status = 'published'
    and publication.learning_audience = 'educators'
    and publication.is_shidao
    and owner_account.status = 'active';

  if not found then
    raise exception 'educator_course_revision_not_available'
      using errcode = 'P0002';
  end if;

  if v_lesson_ref is not null
    and not public.course_publication_revision_has_lesson_ref(
      v_publication_id,
      v_revision_id,
      v_lesson_ref
    )
  then
    raise exception 'course_publication_lesson_not_found'
      using errcode = 'P0002';
  end if;

  return new;
end
$function$;

revoke all on function public.guard_course_publication_progress_integrity()
from public, anon, authenticated, service_role;
grant execute on function public.guard_course_publication_progress_integrity()
to postgres;

create trigger trg_course_publication_self_enrollment_integrity
before insert or update of publication_id, revision_id, last_opened_lesson_ref
on public.course_publication_self_enrollment
for each row execute function public.guard_course_publication_progress_integrity();

create trigger trg_course_publication_lesson_completion_integrity
before insert or update of publication_id, revision_id, lesson_ref
on public.course_publication_lesson_completion
for each row execute function public.guard_course_publication_progress_integrity();

create function public.build_course_publication_progress_admin(
  p_account_id uuid,
  p_publication_id uuid,
  p_revision_id uuid
)
returns jsonb
language sql
stable
set search_path = ''
as $function$
  with revision_lessons as (
    select
      (lesson.value ->> 'ref')::uuid as lesson_ref,
      lesson.position
    from public.course_publication_revision as revision
    cross join lateral jsonb_array_elements(revision.snapshot -> 'lessons')
      with ordinality as lesson(value, position)
    where revision.publication_id = p_publication_id
      and revision.id = p_revision_id
  ),
  completed as (
    select lesson.lesson_ref, lesson.position
    from revision_lessons as lesson
    join public.course_publication_lesson_completion as completion
      on completion.account_id = p_account_id
     and completion.publication_id = p_publication_id
     and completion.revision_id = p_revision_id
     and completion.lesson_ref = lesson.lesson_ref
  ),
  counts as (
    select
      (select count(*)::integer from revision_lessons) as total_count,
      (select count(*)::integer from completed) as completed_count
  )
  select jsonb_build_object(
    'publicationId', p_publication_id,
    'revisionId', p_revision_id,
    'lastOpenedLessonRef', enrollment.last_opened_lesson_ref,
    'completedLessonRefs', coalesce((
      select jsonb_agg(completed.lesson_ref order by completed.position)
      from completed
    ), '[]'::jsonb),
    'completedLessonCount', counts.completed_count,
    'totalLessonCount', counts.total_count,
    'percent', case
      when counts.total_count = 0 then 0
      else floor(
        counts.completed_count::numeric * 100 / counts.total_count
      )::integer
    end,
    'complete', counts.total_count > 0
      and counts.completed_count = counts.total_count
  )
  from counts
  left join public.course_publication_self_enrollment as enrollment
    on enrollment.account_id = p_account_id
   and enrollment.publication_id = p_publication_id
   and enrollment.revision_id = p_revision_id;
$function$;

revoke all on function public.build_course_publication_progress_admin(
  uuid,
  uuid,
  uuid
)
from public, anon, authenticated, service_role;
grant execute on function public.build_course_publication_progress_admin(
  uuid,
  uuid,
  uuid
)
to postgres, service_role;

create function public.get_my_course_publication_progress(
  p_publication_id uuid
)
returns jsonb
language plpgsql
security definer
stable
set search_path = ''
as $function$
declare
  v_account_id uuid;
  v_revision_id uuid;
begin
  if p_publication_id is null then
    raise exception 'educator_course_revision_not_available'
      using errcode = 'P0002';
  end if;

  select account.id
  into v_account_id
  from public.account as account
  where account.auth_user_id = (select auth.uid())
    and account.status = 'active';

  if not found then
    raise exception 'course_progress_account_not_active'
      using errcode = '42501';
  end if;

  select publication.approved_revision_id
  into v_revision_id
  from public.course_publication as publication
  join public.account as owner_account
    on owner_account.id = publication.owner_account_id
  join public.educator_course_revision_review as review
    on review.publication_id = publication.id
   and review.revision_id = publication.approved_revision_id
   and review.status = 'approved'
  where publication.id = p_publication_id
    and publication.status = 'published'
    and publication.learning_audience = 'educators'
    and publication.is_shidao
    and publication.approved_revision_id is not null
    and owner_account.status = 'active';

  if not found then
    raise exception 'educator_course_revision_not_available'
      using errcode = 'P0002';
  end if;

  return public.build_course_publication_progress_admin(
    v_account_id,
    p_publication_id,
    v_revision_id
  );
end
$function$;

revoke all on function public.get_my_course_publication_progress(uuid)
from public, anon, authenticated, service_role;
grant execute on function public.get_my_course_publication_progress(uuid)
to postgres, authenticated;

create function public.set_my_course_publication_lesson_progress(
  p_publication_id uuid,
  p_expected_revision_id uuid,
  p_lesson_ref uuid,
  p_completed boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_account_id uuid;
  v_revision_id uuid;
begin
  if p_publication_id is null
    or p_expected_revision_id is null
    or p_lesson_ref is null
    or p_completed is null
  then
    raise exception 'course_progress_input_invalid'
      using errcode = '22023';
  end if;

  select account.id
  into v_account_id
  from public.account as account
  where account.auth_user_id = (select auth.uid())
    and account.status = 'active'
  for update;

  if not found then
    raise exception 'course_progress_account_not_active'
      using errcode = '42501';
  end if;

  select publication.approved_revision_id
  into v_revision_id
  from public.course_publication as publication
  join public.account as owner_account
    on owner_account.id = publication.owner_account_id
  join public.educator_course_revision_review as review
    on review.publication_id = publication.id
   and review.revision_id = publication.approved_revision_id
   and review.status = 'approved'
  where publication.id = p_publication_id
    and publication.status = 'published'
    and publication.learning_audience = 'educators'
    and publication.is_shidao
    and publication.approved_revision_id is not null
    and owner_account.status = 'active'
  for update of publication;

  if not found then
    raise exception 'educator_course_revision_not_available'
      using errcode = 'P0002';
  end if;

  if v_revision_id <> p_expected_revision_id then
    raise exception 'course_progress_revision_stale'
      using errcode = '40001';
  end if;

  if not public.course_publication_revision_has_lesson_ref(
    p_publication_id,
    v_revision_id,
    p_lesson_ref
  ) then
    raise exception 'course_publication_lesson_not_found'
      using errcode = 'P0002';
  end if;

  insert into public.course_publication_self_enrollment (
    account_id,
    publication_id,
    revision_id,
    last_opened_lesson_ref,
    updated_at
  )
  values (
    v_account_id,
    p_publication_id,
    v_revision_id,
    p_lesson_ref,
    clock_timestamp()
  )
  on conflict (account_id, publication_id, revision_id) do update
  set last_opened_lesson_ref = excluded.last_opened_lesson_ref,
      updated_at = excluded.updated_at;

  if p_completed then
    insert into public.course_publication_lesson_completion (
      account_id,
      publication_id,
      revision_id,
      lesson_ref
    )
    values (
      v_account_id,
      p_publication_id,
      v_revision_id,
      p_lesson_ref
    )
    on conflict (account_id, publication_id, revision_id, lesson_ref)
      do nothing;
  else
    delete from public.course_publication_lesson_completion as completion
    where completion.account_id = v_account_id
      and completion.publication_id = p_publication_id
      and completion.revision_id = v_revision_id
      and completion.lesson_ref = p_lesson_ref;
  end if;

  return public.build_course_publication_progress_admin(
    v_account_id,
    p_publication_id,
    v_revision_id
  );
end
$function$;

revoke all on function public.set_my_course_publication_lesson_progress(
  uuid,
  uuid,
  uuid,
  boolean
)
from public, anon, authenticated, service_role;
grant execute on function public.set_my_course_publication_lesson_progress(
  uuid,
  uuid,
  uuid,
  boolean
)
to postgres, authenticated;

-- The authoring capability is canonical Account state. It is deliberately not
-- copied into Auth metadata or trusted from a JWT claim.
drop function public.current_account_auth_context();

create function public.current_account_auth_context()
returns table (
  account_id uuid,
  auth_user_id uuid,
  display_name text,
  locale text,
  timezone text,
  has_pin boolean,
  sessions_invalid_before timestamptz,
  verified_email text,
  can_author_educator_courses boolean
)
language sql
stable
security definer
set search_path = ''
as $function$
  select
    account.id,
    account.auth_user_id,
    account.display_name,
    account.locale,
    account.timezone,
    security.pin_hash is not null,
    security.sessions_invalid_before,
    case
      when auth_user.email_confirmed_at is not null
        and lower(coalesce(auth_user.email, ''))
          not like '%@learners.shidao.internal'
        and lower(coalesce(auth_user.email, ''))
          not like '%.shidao.internal'
        then auth_user.email::text
      else null
    end,
    account.can_author_educator_courses
  from public.account as account
  left join public.account_security as security
    on security.account_id = account.id
  join auth.users as auth_user
    on auth_user.id = account.auth_user_id
  where account.auth_user_id = (select auth.uid())
    and account.status in ('active', 'provisional')
  limit 1;
$function$;

revoke all on function public.current_account_auth_context()
from public, anon, authenticated, service_role;
grant execute on function public.current_account_auth_context()
to postgres, authenticated, service_role;

create function public.guard_course_educator_authoring()
returns trigger
language plpgsql
set search_path = ''
as $function$
declare
  v_owner_account_id uuid;
  v_learning_audience text;
begin
  if tg_op = 'INSERT' then
    v_owner_account_id := new.owner_account_id;
    v_learning_audience := new.learning_audience;
  else
    if new.learning_audience <> old.learning_audience then
      raise exception 'course_learning_audience_immutable'
        using errcode = '23514';
    end if;

    v_owner_account_id := new.owner_account_id;
    v_learning_audience := new.learning_audience;
  end if;

  if v_learning_audience = 'educators' and not exists (
    select 1
    from public.account as account
    where account.id = v_owner_account_id
      and account.status = 'active'
      and account.can_author_educator_courses
  ) then
    raise exception 'educator_course_authoring_not_allowed'
      using errcode = '42501';
  end if;

  return new;
end
$function$;

revoke all on function public.guard_course_educator_authoring()
from public, anon, authenticated, service_role;
grant execute on function public.guard_course_educator_authoring()
to postgres;

create trigger trg_course_educator_authoring_insert
before insert on public.course
for each row execute function public.guard_course_educator_authoring();

create trigger trg_course_learning_audience_immutable
before update of learning_audience on public.course
for each row execute function public.guard_course_educator_authoring();

create function public.educator_course_author_can_mutate(
  p_course_id uuid
)
returns boolean
language sql
stable
set search_path = ''
as $function$
  select coalesce((
    select course.learning_audience = 'children'
      or (
        account.status = 'active'
        and account.can_author_educator_courses
      )
    from public.course as course
    join public.account as account on account.id = course.owner_account_id
    where course.id = p_course_id
  ), false);
$function$;

revoke all on function public.educator_course_author_can_mutate(uuid)
from public, anon, authenticated, service_role;
grant execute on function public.educator_course_author_can_mutate(uuid)
to postgres, service_role;

create function public.guard_educator_course_content_mutation()
returns trigger
language plpgsql
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
    and not public.educator_course_author_can_mutate(v_course_id)
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

create trigger trg_course_educator_content_mutation
before update of
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
on public.course
for each row execute function public.guard_educator_course_content_mutation();

create trigger trg_lesson_educator_content_mutation
before insert or update or delete on public.lesson
for each row execute function public.guard_educator_course_content_mutation();

create trigger trg_lesson_component_educator_content_mutation
before insert or update or delete on public.lesson_component
for each row execute function public.guard_educator_course_content_mutation();

create trigger trg_lesson_student_slide_educator_content_mutation
before insert or update or delete on public.lesson_student_slide
for each row execute function public.guard_educator_course_content_mutation();

create trigger trg_course_attachment_educator_content_mutation
before insert or update or delete on public.course_attachment
for each row execute function public.guard_educator_course_content_mutation();

create trigger trg_course_attestation_educator_content_mutation
before insert or update or delete on public.course_attestation
for each row execute function public.guard_educator_course_content_mutation();

create trigger trg_stored_file_educator_content_mutation
before update or delete on public.stored_file
for each row execute function public.guard_educator_course_content_mutation();

create function public.guard_educator_course_audience_assignment()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if exists (
    select 1
    from public.course as course
    where course.id = new.course_id
      and course.learning_audience = 'educators'
  ) then
    raise exception 'educator_course_roster_forbidden'
      using errcode = '23514';
  end if;

  return new;
end
$function$;

revoke all on function public.guard_educator_course_audience_assignment()
from public, anon, authenticated, service_role;
grant execute on function public.guard_educator_course_audience_assignment()
to postgres;

create trigger trg_course_learner_educator_forbidden
before insert or update of course_id on public.course_learner
for each row execute function public.guard_educator_course_audience_assignment();

create trigger trg_course_learner_group_educator_forbidden
before insert or update of course_id on public.course_learner_group
for each row execute function public.guard_educator_course_audience_assignment();

create or replace function public.guard_lesson_run_active_course()
returns trigger
language plpgsql
set search_path = ''
as $function$
declare
  v_course_id uuid;
  v_archived_at timestamptz;
  v_learning_audience text;
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

    select course.archived_at, course.learning_audience
    into v_archived_at, v_learning_audience
    from public.course as course
    where course.id = v_course_id
    for update of course;

    if not found or v_archived_at is not null then
      raise exception 'lesson_not_found'
        using errcode = 'P0002';
    end if;

    if v_learning_audience = 'educators' then
      raise exception 'educator_course_lesson_run_forbidden'
        using errcode = '23514';
    end if;
  end if;

  return new;
end
$function$;

revoke all on function public.guard_lesson_run_active_course()
from public, anon, authenticated, service_role;
grant execute on function public.guard_lesson_run_active_course()
to postgres;

do $migration$
begin
  if exists (
    select 1
    from public.course as course
    where course.learning_audience = 'educators'
      and (
        exists (
          select 1
          from public.course_learner as learner
          where learner.course_id = course.id
        )
        or exists (
          select 1
          from public.course_learner_group as learner_group
          where learner_group.course_id = course.id
        )
        or exists (
          select 1
          from public.lesson as lesson
          join public.lesson_run as run on run.lesson_id = lesson.id
          where lesson.course_id = course.id
        )
      )
  ) then
    raise exception 'educator_course_teaching_state_exists'
      using errcode = '55000';
  end if;
end
$migration$;

create function public.guard_course_publication_approved_revision()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if new.approved_revision_id is null then
    return new;
  end if;

  if new.learning_audience <> 'educators'
    or not new.is_shidao
    or not exists (
      select 1
      from public.educator_course_revision_review as review
      join public.course_publication_attestation as attestation
        on attestation.publication_id = review.publication_id
       and attestation.revision_id = review.revision_id
      where review.publication_id = new.id
        and review.revision_id = new.approved_revision_id
        and review.status = 'approved'
    )
  then
    raise exception 'educator_course_approved_revision_invalid'
      using errcode = '23514';
  end if;

  return new;
end
$function$;

revoke all on function public.guard_course_publication_approved_revision()
from public, anon, authenticated, service_role;
grant execute on function public.guard_course_publication_approved_revision()
to postgres;

create trigger trg_course_publication_approved_revision
before insert or update of approved_revision_id, learning_audience, is_shidao
on public.course_publication
for each row execute function public.guard_course_publication_approved_revision();

create function public.guard_educator_course_revision_review_audit()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if tg_op = 'DELETE' then
    raise exception 'educator_course_review_audit_immutable'
      using errcode = '55000';
  end if;

  if old.publication_id <> new.publication_id
    or old.revision_id <> new.revision_id
    or old.submitted_by_account_id <> new.submitted_by_account_id
  then
    raise exception 'educator_course_review_audit_immutable'
      using errcode = '55000';
  end if;

  if old.status = 'approved' and new is distinct from old then
    raise exception 'educator_course_review_audit_immutable'
      using errcode = '55000';
  end if;

  if (old.status = 'pending' and new.status not in ('pending', 'approved', 'rejected'))
    or (old.status = 'rejected' and new.status <> 'pending')
  then
    raise exception 'educator_course_review_transition_invalid'
      using errcode = '23514';
  end if;

  return new;
end
$function$;

revoke all on function public.guard_educator_course_revision_review_audit()
from public, anon, authenticated, service_role;
grant execute on function public.guard_educator_course_revision_review_audit()
to postgres;

create trigger trg_educator_course_revision_review_audit
before update or delete on public.educator_course_revision_review
for each row execute function public.guard_educator_course_revision_review_audit();

create or replace function public.replace_my_course_attestation(
  p_course_id uuid,
  p_title text,
  p_description text,
  p_passing_score_percent integer,
  p_questions jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_account_id uuid;
  v_existing public.course_attestation%rowtype;
  v_attestation public.course_attestation%rowtype;
  v_next_version integer;
  v_title text := btrim(p_title);
  v_description text := btrim(p_description);
begin
  if p_course_id is null then
    raise exception 'course_attestation_input_invalid'
      using errcode = '22023';
  end if;

  select account.id
  into v_account_id
  from public.account as account
  where account.auth_user_id = (select auth.uid())
    and account.status = 'active'
    and account.can_author_educator_courses
  for update;

  if not found then
    raise exception 'educator_course_authoring_not_allowed'
      using errcode = '42501';
  end if;

  perform 1
  from public.course as course
  where course.id = p_course_id
    and course.owner_account_id = v_account_id
    and course.archived_at is null
    and course.learning_audience = 'educators'
  for update of course;

  if not found then
    raise exception 'course_attestation_course_not_found'
      using errcode = 'P0002';
  end if;

  select attestation.*
  into v_existing
  from public.course_attestation as attestation
  where attestation.course_id = p_course_id
  for update;

  v_next_version := case when found then v_existing.version + 1 else 1 end;

  if not public.course_attestation_definition_is_valid(
    v_next_version,
    v_title,
    v_description,
    p_passing_score_percent,
    p_questions
  ) then
    raise exception 'course_attestation_definition_invalid'
      using errcode = '22023';
  end if;

  insert into public.course_attestation (
    course_id,
    version,
    title,
    description,
    passing_score_percent,
    questions,
    created_at,
    updated_at
  )
  values (
    p_course_id,
    v_next_version,
    v_title,
    v_description,
    p_passing_score_percent,
    p_questions,
    clock_timestamp(),
    clock_timestamp()
  )
  on conflict (course_id) do update
  set version = excluded.version,
      title = excluded.title,
      description = excluded.description,
      passing_score_percent = excluded.passing_score_percent,
      questions = excluded.questions,
      updated_at = excluded.updated_at
  returning * into v_attestation;

  return jsonb_build_object(
    'version', v_attestation.version,
    'title', v_attestation.title,
    'description', v_attestation.description,
    'passingScorePercent', v_attestation.passing_score_percent,
    'questions', v_attestation.questions
  );
end
$function$;

revoke all on function public.replace_my_course_attestation(
  uuid,
  text,
  text,
  integer,
  jsonb
)
from public, anon, authenticated, service_role;
grant execute on function public.replace_my_course_attestation(
  uuid,
  text,
  text,
  integer,
  jsonb
)
to postgres, authenticated;

create or replace function public.get_my_authored_course_attestation(
  p_course_id uuid
)
returns jsonb
language plpgsql
security definer
stable
set search_path = ''
as $function$
declare
  v_account_id uuid;
  v_attestation public.course_attestation%rowtype;
begin
  select account.id
  into v_account_id
  from public.account as account
  where account.auth_user_id = (select auth.uid())
    and account.status = 'active'
    and account.can_author_educator_courses;

  if not found then
    raise exception 'educator_course_authoring_not_allowed'
      using errcode = '42501';
  end if;

  perform 1
  from public.course as course
  where course.id = p_course_id
    and course.owner_account_id = v_account_id
    and course.archived_at is null
    and course.learning_audience = 'educators';

  if not found then
    raise exception 'course_attestation_course_not_found'
      using errcode = 'P0002';
  end if;

  select attestation.*
  into v_attestation
  from public.course_attestation as attestation
  where attestation.course_id = p_course_id;

  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'version', v_attestation.version,
    'title', v_attestation.title,
    'description', v_attestation.description,
    'passingScorePercent', v_attestation.passing_score_percent,
    'questions', v_attestation.questions
  );
end
$function$;

revoke all on function public.get_my_authored_course_attestation(uuid)
from public, anon, authenticated, service_role;
grant execute on function public.get_my_authored_course_attestation(uuid)
to postgres, authenticated;


create or replace function public.publish_course_revision_with_attestation_admin(
  p_actor_account_id uuid,
  p_source_course_id uuid,
  p_publication_id uuid,
  p_revision_id uuid,
  p_content_sha256 text,
  p_snapshot jsonb,
  p_asset_manifest jsonb,
  p_rights_confirmed boolean,
  p_learning_audience text,
  p_attestation jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_course public.course%rowtype;
  v_live public.course_attestation%rowtype;
  v_persisted public.course_publication_attestation%rowtype;
  v_publication public.course_publication%rowtype;
  v_live_json jsonb;
  v_result jsonb;
  v_actual_revision_id uuid;
  v_review_status text;
begin
  if p_learning_audience not in ('children', 'educators') then
    raise exception 'course_learning_audience_invalid'
      using errcode = '22023';
  end if;

  select course.*
  into v_course
  from public.course as course
  join public.account as account
    on account.id = course.owner_account_id
  where course.id = p_source_course_id
    and course.owner_account_id = p_actor_account_id
    and course.archived_at is null
    and account.status = 'active'
    and (
      p_learning_audience = 'children'
      or account.can_author_educator_courses
    )
  for update of course, account;

  if not found then
    if p_learning_audience = 'educators' then
      raise exception 'educator_course_authoring_not_allowed'
        using errcode = '42501';
    end if;
    raise exception 'course_publication_source_not_found'
      using errcode = 'P0002';
  end if;

  if v_course.learning_audience <> p_learning_audience then
    raise exception 'course_publication_learning_audience_mismatch'
      using errcode = '23514';
  end if;

  if p_learning_audience = 'educators' and exists (
    select 1
    from public.course_publication as publication
    join public.course_publication_revision as revision
      on revision.publication_id = publication.id
     and revision.id = publication.current_revision_id
    join public.educator_course_revision_review as review
      on review.publication_id = publication.id
     and review.revision_id = publication.current_revision_id
    where publication.source_course_id = p_source_course_id
      and publication.owner_account_id = p_actor_account_id
      and review.status = 'pending'
      and (
        revision.content_sha256 <> p_content_sha256
        or revision.snapshot is distinct from p_snapshot
      )
  ) then
    raise exception 'educator_course_review_already_pending'
      using errcode = '55000';
  end if;

  select attestation.*
  into v_live
  from public.course_attestation as attestation
  where attestation.course_id = p_source_course_id
  for share;

  if found then
    v_live_json := jsonb_build_object(
      'version', v_live.version,
      'title', v_live.title,
      'description', v_live.description,
      'passingScorePercent', v_live.passing_score_percent,
      'questions', v_live.questions
    );
  end if;

  if p_learning_audience = 'children' then
    if v_live.course_id is not null
      or (
        p_attestation is not null
        and jsonb_typeof(p_attestation) <> 'null'
      )
    then
      raise exception 'child_course_attestation_forbidden'
        using errcode = '23514';
    end if;
  elsif v_live.course_id is null
    or p_attestation is null
    or jsonb_typeof(p_attestation) <> 'object'
    or (p_attestation - array[
      'version',
      'title',
      'description',
      'passingScorePercent',
      'questions'
    ]) <> '{}'::jsonb
    or not (p_attestation ?& array[
      'version',
      'title',
      'description',
      'passingScorePercent',
      'questions'
    ])
    or not public.course_attestation_definition_is_valid(
      (p_attestation ->> 'version')::integer,
      p_attestation ->> 'title',
      p_attestation ->> 'description',
      (p_attestation ->> 'passingScorePercent')::integer,
      p_attestation -> 'questions'
    )
    or p_attestation is distinct from v_live_json
  then
    raise exception 'course_publication_attestation_mismatch'
      using errcode = '23514';
  end if;

  v_result := public.publish_course_revision_admin(
    p_actor_account_id,
    p_source_course_id,
    p_publication_id,
    p_revision_id,
    p_content_sha256,
    p_snapshot,
    p_asset_manifest,
    p_rights_confirmed
  );
  v_actual_revision_id := (v_result ->> 'currentRevisionId')::uuid;

  if p_learning_audience = 'educators' then
    perform 1
    from public.course_publication_revision as revision
    where revision.publication_id = p_publication_id
      and revision.id = v_actual_revision_id
      and revision.license_code = 'shidao_official_learning_v1';

    if not found then
      raise exception 'educator_course_revision_license_invalid'
        using errcode = '23514';
    end if;

    insert into public.course_publication_attestation (
      revision_id,
      publication_id,
      version,
      title,
      description,
      passing_score_percent,
      questions,
      created_at
    )
    values (
      v_actual_revision_id,
      p_publication_id,
      v_live.version,
      v_live.title,
      v_live.description,
      v_live.passing_score_percent,
      v_live.questions,
      clock_timestamp()
    )
    on conflict (revision_id) do nothing;

    select attestation.*
    into strict v_persisted
    from public.course_publication_attestation as attestation
    where attestation.revision_id = v_actual_revision_id;

    if v_persisted.publication_id <> p_publication_id
      or v_persisted.version <> v_live.version
      or v_persisted.title <> v_live.title
      or v_persisted.description <> v_live.description
      or v_persisted.passing_score_percent <> v_live.passing_score_percent
      or v_persisted.questions is distinct from v_live.questions
    then
      raise exception 'course_publication_attestation_revision_conflict'
        using errcode = '23514';
    end if;

    insert into public.educator_course_revision_review (
      revision_id,
      publication_id,
      status,
      submitted_by_account_id,
      submitted_at,
      updated_at
    )
    values (
      v_actual_revision_id,
      p_publication_id,
      'pending',
      p_actor_account_id,
      clock_timestamp(),
      clock_timestamp()
    )
    on conflict (revision_id) do update
    set status = case
          when educator_course_revision_review.status = 'approved'
            then 'approved'
          else 'pending'
        end,
        submitted_by_account_id = excluded.submitted_by_account_id,
        reviewed_by_account_id = case
          when educator_course_revision_review.status = 'approved'
            then educator_course_revision_review.reviewed_by_account_id
          else null
        end,
        review_feedback = case
          when educator_course_revision_review.status = 'approved'
            then educator_course_revision_review.review_feedback
          else null
        end,
        submitted_at = case
          when educator_course_revision_review.status = 'approved'
            then educator_course_revision_review.submitted_at
          else excluded.submitted_at
        end,
        reviewed_at = case
          when educator_course_revision_review.status = 'approved'
            then educator_course_revision_review.reviewed_at
          else null
        end,
        updated_at = excluded.updated_at
    where educator_course_revision_review.status <> 'approved';

    update public.course_publication as publication
    set learning_audience = 'educators',
        is_shidao = true
    where publication.id = p_publication_id
      and publication.current_revision_id = v_actual_revision_id;

    if not found then
      raise exception 'course_publication_update_conflict'
        using errcode = '40001';
    end if;

    select review.status
    into strict v_review_status
    from public.educator_course_revision_review as review
    where review.revision_id = v_actual_revision_id;
  else
    if exists (
      select 1
      from public.course_publication_attestation as attestation
      where attestation.revision_id = v_actual_revision_id
    ) then
      raise exception 'course_publication_attestation_revision_conflict'
        using errcode = '23514';
    end if;

    update public.course_publication as publication
    set learning_audience = 'children'
    where publication.id = p_publication_id
      and publication.current_revision_id = v_actual_revision_id;

    if not found then
      raise exception 'course_publication_update_conflict'
        using errcode = '40001';
    end if;
  end if;

  select publication.*
  into strict v_publication
  from public.course_publication as publication
  where publication.id = p_publication_id;

  return v_result || jsonb_build_object(
    'status', v_publication.status,
    'learningAudience', p_learning_audience,
    'reviewStatus', v_review_status,
    'reviewRevisionId', case
      when p_learning_audience = 'educators'
        then v_actual_revision_id
      else null
    end,
    'approvedRevisionId', v_publication.approved_revision_id
  );
exception
  when invalid_text_representation or numeric_value_out_of_range then
    raise exception 'course_publication_attestation_mismatch'
      using errcode = '23514';
end
$function$;

revoke all on function public.publish_course_revision_with_attestation_admin(
  uuid,
  uuid,
  uuid,
  uuid,
  text,
  jsonb,
  jsonb,
  boolean,
  text,
  jsonb
)
from public, anon, authenticated, service_role;
grant execute on function public.publish_course_revision_with_attestation_admin(
  uuid,
  uuid,
  uuid,
  uuid,
  text,
  jsonb,
  jsonb,
  boolean,
  text,
  jsonb
)
to postgres, service_role;

create function public.approve_educator_course_revision_admin(
  p_publication_id uuid,
  p_revision_id uuid,
  p_reviewer_account_id uuid default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_publication public.course_publication%rowtype;
  v_review public.educator_course_revision_review%rowtype;
  v_revision public.course_publication_revision%rowtype;
begin
  if p_publication_id is null or p_revision_id is null then
    raise exception 'educator_course_review_input_invalid'
      using errcode = '22023';
  end if;

  if p_reviewer_account_id is not null and not exists (
    select 1
    from public.account as account
    where account.id = p_reviewer_account_id
      and account.status = 'active'
  ) then
    raise exception 'educator_course_reviewer_not_active'
      using errcode = '42501';
  end if;

  select publication.*
  into v_publication
  from public.course_publication as publication
  where publication.id = p_publication_id
    and publication.learning_audience = 'educators'
    and publication.is_shidao
  for update;

  if not found then
    raise exception 'educator_course_review_not_found'
      using errcode = 'P0002';
  end if;

  if v_publication.current_revision_id <> p_revision_id then
    raise exception 'educator_course_review_revision_stale'
      using errcode = '40001';
  end if;

  select review.*
  into v_review
  from public.educator_course_revision_review as review
  where review.publication_id = p_publication_id
    and review.revision_id = p_revision_id
  for update;

  if not found then
    raise exception 'educator_course_review_not_found'
      using errcode = 'P0002';
  end if;

  if v_review.status <> 'pending' then
    raise exception 'educator_course_review_not_pending'
      using errcode = '55000';
  end if;

  select revision.*
  into strict v_revision
  from public.course_publication_revision as revision
  join public.course_publication_attestation as attestation
    on attestation.publication_id = revision.publication_id
   and attestation.revision_id = revision.id
  where revision.publication_id = p_publication_id
    and revision.id = p_revision_id
    and revision.license_code = 'shidao_official_learning_v1'
  for share of revision, attestation;

  update public.educator_course_revision_review as review
  set status = 'approved',
      reviewed_by_account_id = p_reviewer_account_id,
      review_feedback = null,
      reviewed_at = clock_timestamp(),
      updated_at = clock_timestamp()
  where review.revision_id = p_revision_id
    and review.status = 'pending'
  returning review.* into v_review;

  if not found then
    raise exception 'educator_course_review_not_pending'
      using errcode = '40001';
  end if;

  update public.course_publication as publication
  set approved_revision_id = p_revision_id,
      title = v_revision.snapshot -> 'course' ->> 'title',
      subject = v_revision.snapshot -> 'course' ->> 'subject',
      goal = v_revision.snapshot -> 'course' ->> 'goal',
      level = v_revision.snapshot -> 'course' ->> 'level',
      audience_description =
        v_revision.snapshot -> 'course' ->> 'audienceDescription',
      target_lesson_count = (
        v_revision.snapshot -> 'course' ->> 'targetLessonCount'
      )::integer,
      lesson_count = jsonb_array_length(v_revision.snapshot -> 'lessons'),
      material_count = jsonb_array_length(v_revision.snapshot -> 'materials'),
      status = 'published',
      unpublished_at = null,
      published_at = clock_timestamp(),
      updated_at = clock_timestamp()
  where publication.id = p_publication_id
    and publication.current_revision_id = p_revision_id
  returning publication.* into v_publication;

  if not found then
    raise exception 'educator_course_review_revision_stale'
      using errcode = '40001';
  end if;

  return jsonb_build_object(
    'publicationId', v_publication.id,
    'status', v_publication.status,
    'reviewStatus', v_review.status,
    'reviewRevisionId', v_review.revision_id,
    'approvedRevisionId', v_publication.approved_revision_id
  );
end
$function$;

revoke all on function public.approve_educator_course_revision_admin(
  uuid,
  uuid,
  uuid
)
from public, anon, authenticated, service_role;
grant execute on function public.approve_educator_course_revision_admin(
  uuid,
  uuid,
  uuid
)
to postgres, service_role;

create function public.reject_educator_course_revision_admin(
  p_publication_id uuid,
  p_revision_id uuid,
  p_reviewer_account_id uuid default null,
  p_review_feedback text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_publication public.course_publication%rowtype;
  v_review public.educator_course_revision_review%rowtype;
  v_feedback text := nullif(btrim(p_review_feedback), '');
begin
  if p_publication_id is null
    or p_revision_id is null
    or (v_feedback is not null and char_length(v_feedback) > 2000)
  then
    raise exception 'educator_course_review_input_invalid'
      using errcode = '22023';
  end if;

  if p_reviewer_account_id is not null and not exists (
    select 1
    from public.account as account
    where account.id = p_reviewer_account_id
      and account.status = 'active'
  ) then
    raise exception 'educator_course_reviewer_not_active'
      using errcode = '42501';
  end if;

  select publication.*
  into v_publication
  from public.course_publication as publication
  where publication.id = p_publication_id
    and publication.learning_audience = 'educators'
    and publication.is_shidao
  for update;

  if not found then
    raise exception 'educator_course_review_not_found'
      using errcode = 'P0002';
  end if;

  if v_publication.current_revision_id <> p_revision_id then
    raise exception 'educator_course_review_revision_stale'
      using errcode = '40001';
  end if;

  update public.educator_course_revision_review as review
  set status = 'rejected',
      reviewed_by_account_id = p_reviewer_account_id,
      review_feedback = v_feedback,
      reviewed_at = clock_timestamp(),
      updated_at = clock_timestamp()
  where review.publication_id = p_publication_id
    and review.revision_id = p_revision_id
    and review.status = 'pending'
  returning review.* into v_review;

  if not found then
    raise exception 'educator_course_review_not_pending'
      using errcode = '55000';
  end if;

  return jsonb_build_object(
    'publicationId', v_publication.id,
    'status', v_publication.status,
    'reviewStatus', v_review.status,
    'reviewRevisionId', v_review.revision_id,
    'approvedRevisionId', v_publication.approved_revision_id,
    'reviewFeedback', v_review.review_feedback
  );
end
$function$;

revoke all on function public.reject_educator_course_revision_admin(
  uuid,
  uuid,
  uuid,
  text
)
from public, anon, authenticated, service_role;
grant execute on function public.reject_educator_course_revision_admin(
  uuid,
  uuid,
  uuid,
  text
)
to postgres, service_role;

create or replace function public.unpublish_course_publication_admin(
  p_actor_account_id uuid,
  p_source_course_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_publication public.course_publication%rowtype;
  v_revision public.course_publication_revision%rowtype;
  v_review public.educator_course_revision_review%rowtype;
begin
  if p_actor_account_id is null or p_source_course_id is null then
    raise exception 'course_publication_unpublish_invalid'
      using errcode = '22023';
  end if;

  perform 1
  from public.course as course
  where course.id = p_source_course_id
    and course.owner_account_id = p_actor_account_id
  for update;

  if not found then
    raise exception 'course_publication_source_not_found'
      using errcode = 'P0002';
  end if;

  select publication.*
  into v_publication
  from public.course_publication as publication
  where publication.source_course_id = p_source_course_id
    and publication.owner_account_id = p_actor_account_id
  for update;

  if not found then
    raise exception 'course_publication_not_found'
      using errcode = 'P0002';
  end if;

  if v_publication.learning_audience = 'educators' then
    select review.*
    into v_review
    from public.educator_course_revision_review as review
    where review.publication_id = v_publication.id
      and review.revision_id = v_publication.current_revision_id
    for update;

    if found and v_review.status = 'pending' then
      update public.educator_course_revision_review as review
      set status = 'rejected',
          reviewed_by_account_id = null,
          review_feedback = 'withdrawn_by_author',
          reviewed_at = clock_timestamp(),
          updated_at = clock_timestamp()
      where review.revision_id = v_publication.current_revision_id
        and review.status = 'pending';

      if v_publication.approved_revision_id is not null then
        update public.course_publication as publication
        set status = 'published',
            unpublished_at = null,
            updated_at = clock_timestamp()
        where publication.id = v_publication.id
        returning publication.* into v_publication;
      else
        update public.course_publication as publication
        set status = 'unpublished',
            unpublished_at = clock_timestamp(),
            updated_at = clock_timestamp()
        where publication.id = v_publication.id
        returning publication.* into v_publication;
      end if;
    else
      update public.course_publication as publication
      set status = 'unpublished',
          unpublished_at = clock_timestamp(),
          updated_at = clock_timestamp()
      where publication.id = v_publication.id
      returning publication.* into v_publication;
    end if;
  else
    update public.course_publication as publication
    set status = 'unpublished',
        unpublished_at = clock_timestamp(),
        updated_at = clock_timestamp()
    where publication.id = v_publication.id
    returning publication.* into v_publication;
  end if;

  select revision.*
  into strict v_revision
  from public.course_publication_revision as revision
  where revision.id = v_publication.current_revision_id;

  select review.*
  into v_review
  from public.educator_course_revision_review as review
  where review.publication_id = v_publication.id
    and review.revision_id = v_publication.current_revision_id;

  return jsonb_build_object(
    'publicationId', v_publication.id,
    'sourceCourseId', v_publication.source_course_id,
    'status', v_publication.status,
    'currentRevisionId', v_revision.id,
    'publishedAt', v_publication.published_at,
    'updatedAt', v_publication.updated_at,
    'sourceCourseUpdatedAt', v_revision.source_course_updated_at,
    'sourceContentUpdatedAt', v_publication.source_content_updated_at,
    'contentSha256', v_revision.content_sha256,
    'reviewStatus', v_review.status,
    'reviewRevisionId', v_review.revision_id,
    'approvedRevisionId', v_publication.approved_revision_id
  );
end
$function$;

revoke all on function public.unpublish_course_publication_admin(uuid, uuid)
from public, anon, authenticated, service_role;
grant execute on function public.unpublish_course_publication_admin(uuid, uuid)
to postgres, service_role;

create or replace function public.assert_course_publication_copy_eligible_admin(
  p_actor_account_id uuid,
  p_publication_id uuid
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $function$
begin
  if p_actor_account_id is null or p_publication_id is null then
    raise exception 'course_publication_copy_eligibility_invalid'
      using errcode = '22023';
  end if;

  perform 1
  from public.account as actor_account
  where actor_account.id = p_actor_account_id
    and actor_account.status = 'active';

  if not found then
    raise exception 'course_publication_catalog_actor_not_active'
      using errcode = '42501';
  end if;

  perform 1
  from public.course_publication as publication
  join public.account as owner_account
    on owner_account.id = publication.owner_account_id
  where publication.id = p_publication_id
    and publication.status = 'published'
    and owner_account.status = 'active';

  if not found then
    raise exception 'course_publication_not_published'
      using errcode = 'P0002';
  end if;

  if exists (
    select 1
    from public.course_publication as publication
    where publication.id = p_publication_id
      and publication.learning_audience = 'educators'
  ) then
    raise exception 'educator_course_copy_forbidden'
      using errcode = '42501';
  end if;

  return jsonb_build_object('eligible', true);
end
$function$;

revoke all on function public.assert_course_publication_copy_eligible_admin(
  uuid,
  uuid
)
from public, anon, authenticated, service_role;
grant execute on function public.assert_course_publication_copy_eligible_admin(
  uuid,
  uuid
)
to postgres, service_role;

create or replace function public.clone_course_publication_with_attestation_admin(
  p_actor_account_id uuid,
  p_publication_id uuid,
  p_target_course_id uuid,
  p_target_title text,
  p_id_map jsonb,
  p_asset_manifest jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_result jsonb;
begin
  if exists (
    select 1
    from public.course_publication as publication
    where publication.id = p_publication_id
      and publication.learning_audience = 'educators'
  ) then
    raise exception 'educator_course_copy_forbidden'
      using errcode = '42501';
  end if;

  v_result := public.clone_course_publication_admin(
    p_actor_account_id,
    p_publication_id,
    p_target_course_id,
    p_target_title,
    p_id_map,
    p_asset_manifest
  );

  return v_result || jsonb_build_object('learningAudience', 'children');
end
$function$;

revoke all on function public.clone_course_publication_with_attestation_admin(
  uuid,
  uuid,
  uuid,
  text,
  jsonb,
  jsonb
)
from public, anon, authenticated, service_role;
grant execute on function public.clone_course_publication_with_attestation_admin(
  uuid,
  uuid,
  uuid,
  text,
  jsonb,
  jsonb
)
to postgres, service_role;

create or replace function public.duplicate_course_with_attestation_admin(
  p_actor_account_id uuid,
  p_source_course_id uuid,
  p_target_course_id uuid,
  p_target_title text,
  p_id_map jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_result jsonb;
begin
  if exists (
    select 1
    from public.course as course
    where course.id = p_source_course_id
      and course.owner_account_id = p_actor_account_id
      and course.learning_audience = 'educators'
  ) then
    raise exception 'educator_course_duplicate_forbidden'
      using errcode = '42501';
  end if;

  v_result := public.duplicate_course_admin(
    p_actor_account_id,
    p_source_course_id,
    p_target_course_id,
    p_target_title,
    p_id_map
  );

  return v_result || jsonb_build_object('learningAudience', 'children');
end
$function$;

revoke all on function public.duplicate_course_with_attestation_admin(
  uuid,
  uuid,
  uuid,
  text,
  jsonb
)
from public, anon, authenticated, service_role;
grant execute on function public.duplicate_course_with_attestation_admin(
  uuid,
  uuid,
  uuid,
  text,
  jsonb
)
to postgres, service_role;

revoke execute on function public.publish_course_revision_admin(
  uuid, uuid, uuid, uuid, text, jsonb, jsonb, boolean
) from service_role;
revoke execute on function public.clone_course_publication_admin(
  uuid, uuid, uuid, text, jsonb, jsonb
) from service_role;
revoke execute on function public.duplicate_course_admin(
  uuid, uuid, uuid, text, jsonb
) from service_role;

create or replace function public.list_course_publication_catalog_v2_admin(
  p_actor_account_id uuid,
  p_q text,
  p_learning_audience text,
  p_subject text,
  p_level text,
  p_offset integer,
  p_limit integer
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $function$
declare
  v_result jsonb;
begin
  if p_actor_account_id is null
    or p_q is null
    or char_length(btrim(p_q)) > 160
    or p_learning_audience not in ('children', 'educators')
    or p_subject is null
    or char_length(btrim(p_subject)) > 160
    or p_level is null
    or char_length(btrim(p_level)) > 240
    or p_offset is null
    or p_offset < 0
    or p_limit is null
    or p_limit < 1
    or p_limit > 50
  then
    raise exception 'course_publication_catalog_query_invalid'
      using errcode = '22023';
  end if;

  perform 1
  from public.account as account
  where account.id = p_actor_account_id
    and account.status = 'active';

  if not found then
    raise exception 'course_publication_catalog_actor_not_active'
      using errcode = '42501';
  end if;

  with catalog_rows as materialized (
    select
      publication.id,
      publication.source_course_id,
      publication.owner_account_id,
      publication.publisher_display_name,
      publication.is_shidao,
      publication.learning_audience,
      case
        when publication.learning_audience = 'educators'
          then revision.published_at
        else publication.published_at
      end as published_at,
      revision.id as revision_id,
      revision.snapshot -> 'course' ->> 'title' as title,
      revision.snapshot -> 'course' ->> 'subject' as subject,
      revision.snapshot -> 'course' ->> 'goal' as goal,
      revision.snapshot -> 'course' ->> 'level' as level,
      revision.snapshot -> 'course' ->> 'audienceDescription'
        as audience_description,
      (revision.snapshot -> 'course' ->> 'targetLessonCount')::integer
        as target_lesson_count,
      jsonb_array_length(revision.snapshot -> 'lessons') as lesson_count,
      jsonb_array_length(revision.snapshot -> 'materials') as material_count
    from public.course_publication as publication
    join public.account as owner_account
      on owner_account.id = publication.owner_account_id
     and owner_account.status = 'active'
    join public.course_publication_revision as revision
      on revision.publication_id = publication.id
     and revision.id = case
       when publication.learning_audience = 'educators'
         then publication.approved_revision_id
       else publication.current_revision_id
     end
    left join public.educator_course_revision_review as review
      on review.publication_id = publication.id
     and review.revision_id = revision.id
    where publication.status = 'published'
      and publication.learning_audience = p_learning_audience
      and (
        publication.learning_audience = 'children'
        or (
          publication.is_shidao
          and publication.approved_revision_id is not null
          and review.status = 'approved'
          and revision.license_code = 'shidao_official_learning_v1'
          and exists (
            select 1
            from public.course_publication_attestation as attestation
            where attestation.publication_id = publication.id
              and attestation.revision_id = revision.id
          )
        )
      )
  ),
  filtered as materialized (
    select catalog.*
    from catalog_rows as catalog
    where (
      btrim(p_q) = ''
      or position(
        lower(btrim(p_q)) in lower(concat_ws(
          ' ',
          catalog.title,
          catalog.subject,
          catalog.goal,
          catalog.level,
          catalog.audience_description,
          catalog.publisher_display_name
        ))
      ) > 0
    )
      and (
        btrim(p_subject) = ''
        or lower(btrim(catalog.subject)) = lower(btrim(p_subject))
      )
      and (
        btrim(p_level) = ''
        or lower(btrim(catalog.level)) = lower(btrim(p_level))
      )
  ),
  page_plus_one as materialized (
    select catalog.*
    from filtered as catalog
    order by catalog.is_shidao desc, catalog.published_at desc, catalog.id desc
    offset p_offset
    limit p_limit + 1
  ),
  page_rows as materialized (
    select catalog.*
    from page_plus_one as catalog
    order by catalog.is_shidao desc, catalog.published_at desc, catalog.id desc
    limit p_limit
  ),
  subject_values as materialized (
    select min(btrim(catalog.subject)) as value
    from catalog_rows as catalog
    where btrim(catalog.subject) <> ''
    group by lower(btrim(catalog.subject))
    order by lower(min(btrim(catalog.subject))), min(btrim(catalog.subject))
    limit 100
  ),
  level_values as materialized (
    select min(btrim(catalog.level)) as value
    from catalog_rows as catalog
    where btrim(catalog.level) <> ''
    group by lower(btrim(catalog.level))
    order by lower(min(btrim(catalog.level))), min(btrim(catalog.level))
    limit 100
  )
  select jsonb_build_object(
    'courses', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'publicationId', catalog.id,
          'sourceCourseId', case
            when catalog.owner_account_id = p_actor_account_id
              then catalog.source_course_id
            else null
          end,
          'learningAudience', catalog.learning_audience,
          'title', catalog.title,
          'subject', catalog.subject,
          'goal', catalog.goal,
          'level', catalog.level,
          'audienceDescription', catalog.audience_description,
          'targetLessonCount', catalog.target_lesson_count,
          'lessonCount', catalog.lesson_count,
          'materialCount', catalog.material_count,
          'publishedAt', catalog.published_at,
          'author', jsonb_build_object(
            'displayName', catalog.publisher_display_name,
            'isShiDao', catalog.is_shidao,
            'isCurrentUser', catalog.owner_account_id = p_actor_account_id
          )
        )
        order by catalog.is_shidao desc,
          catalog.published_at desc,
          catalog.id desc
      )
      from page_rows as catalog
    ), '[]'::jsonb),
    'facets', jsonb_build_object(
      'subjects', coalesce((
        select jsonb_agg(value order by lower(value), value)
        from subject_values
      ), '[]'::jsonb),
      'levels', coalesce((
        select jsonb_agg(value order by lower(value), value)
        from level_values
      ), '[]'::jsonb)
    ),
    'nextOffset', case
      when (select count(*) from page_plus_one) > p_limit
        then p_offset + p_limit
      else null
    end
  )
  into v_result;

  return v_result;
end
$function$;

revoke all on function public.list_course_publication_catalog_v2_admin(
  uuid,
  text,
  text,
  text,
  text,
  integer,
  integer
)
from public, anon, authenticated, service_role;
grant execute on function public.list_course_publication_catalog_v2_admin(
  uuid,
  text,
  text,
  text,
  text,
  integer,
  integer
)
to postgres, service_role;

create or replace function public.get_my_course_publication_attestation(
  p_publication_id uuid
)
returns jsonb
language plpgsql
security definer
stable
set search_path = ''
as $function$
declare
  v_account_id uuid;
  v_publication public.course_publication%rowtype;
  v_attestation public.course_publication_attestation%rowtype;
  v_attempt public.course_attestation_attempt%rowtype;
  v_award public.course_attestation_award%rowtype;
  v_certified boolean := false;
  v_attempt_found boolean := false;
  v_questions jsonb;
begin
  if p_publication_id is null then
    raise exception 'course_attestation_not_found'
      using errcode = 'P0002';
  end if;

  select account.id
  into v_account_id
  from public.account as account
  where account.auth_user_id = (select auth.uid())
    and account.status = 'active';

  if not found then
    raise exception 'course_attestation_account_not_active'
      using errcode = '42501';
  end if;

  select publication.*
  into v_publication
  from public.course_publication as publication
  join public.account as owner_account
    on owner_account.id = publication.owner_account_id
  where publication.id = p_publication_id
    and publication.status = 'published'
    and publication.learning_audience = 'educators'
    and publication.is_shidao
    and publication.approved_revision_id is not null
    and owner_account.status = 'active'
    and exists (
      select 1
      from public.educator_course_revision_review as review
      where review.publication_id = publication.id
        and review.revision_id = publication.approved_revision_id
        and review.status = 'approved'
    );

  if not found then
    raise exception 'course_attestation_not_found'
      using errcode = 'P0002';
  end if;

  select attestation.*
  into v_attestation
  from public.course_publication_attestation as attestation
  where attestation.publication_id = v_publication.id
    and attestation.revision_id = v_publication.approved_revision_id;

  if not found then
    raise exception 'course_attestation_not_found'
      using errcode = 'P0002';
  end if;

  if not coalesce((
    public.build_course_publication_progress_admin(
      v_account_id,
      v_publication.id,
      v_attestation.revision_id
    ) ->> 'complete'
  )::boolean, false) then
    raise exception 'course_attestation_lessons_incomplete'
      using errcode = '55000';
  end if;

  select award.*
  into v_award
  from public.course_attestation_award as award
  where award.account_id = v_account_id
    and award.publication_id = v_publication.id
    and award.revision_id = v_attestation.revision_id;
  v_certified := found;

  if v_certified then
    select attempt.*
    into strict v_attempt
    from public.course_attestation_attempt as attempt
    where attempt.id = v_award.attempt_id;
    v_attempt_found := true;
  else
    select attempt.*
    into v_attempt
    from public.course_attestation_attempt as attempt
    where attempt.account_id = v_account_id
      and attempt.publication_id = v_publication.id
      and attempt.revision_id = v_attestation.revision_id
    order by attempt.completed_at desc, attempt.id desc
    limit 1;
    v_attempt_found := found;
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', question.value ->> 'id',
        'prompt', question.value ->> 'prompt',
        'options', question.value -> 'options',
        'selectedOptionId', case
          when v_attempt_found then
            v_attempt.selected_option_by_question_id
              ->> (question.value ->> 'id')
          else null
        end,
        'correctOptionId', case
          when v_certified then question.value ->> 'correctOptionId'
          else null
        end,
        'explanation', case
          when v_certified then question.value ->> 'explanation'
          else null
        end
      )
      order by question.position
    ),
    '[]'::jsonb
  )
  into v_questions
  from jsonb_array_elements(v_attestation.questions) with ordinality
    as question(value, position);

  return jsonb_build_object(
    'publicationId', v_publication.id,
    'revisionId', v_attestation.revision_id,
    'title', v_attestation.title,
    'description', v_attestation.description,
    'passingScorePercent', v_attestation.passing_score_percent,
    'version', v_attestation.version,
    'questions', v_questions,
    'attempt', case
      when v_attempt_found then jsonb_build_object(
        'id', v_attempt.id,
        'scorePercent', v_attempt.score_percent,
        'passed', v_attempt.passed,
        'completedAt', v_attempt.completed_at,
        'selectedOptionByQuestionId',
          v_attempt.selected_option_by_question_id
      )
      else null
    end,
    'certified', v_certified
  );
end
$function$;

revoke all on function public.get_my_course_publication_attestation(uuid)
from public, anon, authenticated, service_role;
grant execute on function public.get_my_course_publication_attestation(uuid)
to postgres, authenticated;

create or replace function public.submit_my_course_publication_attestation(
  p_publication_id uuid,
  p_expected_revision_id uuid,
  p_selected_option_by_question_id jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_account_id uuid;
  v_publication public.course_publication%rowtype;
  v_attestation public.course_publication_attestation%rowtype;
  v_revision public.course_publication_revision%rowtype;
  v_existing_award_id uuid;
  v_attempt public.course_attestation_attempt%rowtype;
  v_question_count integer;
  v_correct_answer_count integer;
  v_score_percent integer;
  v_passed boolean;
begin
  if p_publication_id is null
    or p_expected_revision_id is null
    or p_selected_option_by_question_id is null
    or jsonb_typeof(p_selected_option_by_question_id) <> 'object'
  then
    raise exception 'course_attestation_answers_invalid'
      using errcode = '22023';
  end if;

  select account.id
  into v_account_id
  from public.account as account
  where account.auth_user_id = (select auth.uid())
    and account.status = 'active'
  for update;

  if not found then
    raise exception 'course_attestation_account_not_active'
      using errcode = '42501';
  end if;

  select publication.*
  into v_publication
  from public.course_publication as publication
  join public.account as owner_account
    on owner_account.id = publication.owner_account_id
  where publication.id = p_publication_id
    and publication.status = 'published'
    and publication.learning_audience = 'educators'
    and publication.is_shidao
    and publication.approved_revision_id is not null
    and owner_account.status = 'active'
    and exists (
      select 1
      from public.educator_course_revision_review as review
      where review.publication_id = publication.id
        and review.revision_id = publication.approved_revision_id
        and review.status = 'approved'
    )
  for update of publication;

  if not found then
    raise exception 'course_attestation_not_found'
      using errcode = 'P0002';
  end if;

  if v_publication.approved_revision_id <> p_expected_revision_id then
    raise exception 'course_attestation_revision_stale'
      using errcode = '40001';
  end if;

  select attestation.*
  into v_attestation
  from public.course_publication_attestation as attestation
  where attestation.publication_id = v_publication.id
    and attestation.revision_id = v_publication.approved_revision_id
  for share;

  if not found then
    raise exception 'course_attestation_not_found'
      using errcode = 'P0002';
  end if;

  if v_attestation.revision_id <> p_expected_revision_id then
    raise exception 'course_attestation_revision_stale'
      using errcode = '40001';
  end if;

  select revision.*
  into strict v_revision
  from public.course_publication_revision as revision
  where revision.publication_id = v_publication.id
    and revision.id = v_attestation.revision_id
  for share;

  if not coalesce((
    public.build_course_publication_progress_admin(
      v_account_id,
      v_publication.id,
      v_attestation.revision_id
    ) ->> 'complete'
  )::boolean, false) then
    raise exception 'course_attestation_lessons_incomplete'
      using errcode = '55000';
  end if;

  select award.id
  into v_existing_award_id
  from public.course_attestation_award as award
  where award.account_id = v_account_id
    and award.publication_id = v_publication.id
    and award.revision_id = v_attestation.revision_id;

  if found then
    return public.get_my_course_publication_attestation(p_publication_id);
  end if;

  if (
    select count(*)
    from public.course_attestation_attempt as attempt
    where attempt.account_id = v_account_id
      and attempt.revision_id = v_attestation.revision_id
      and attempt.completed_at >= clock_timestamp() - interval '15 minutes'
  ) >= 5 then
    raise exception 'course_attestation_attempt_rate_limited'
      using errcode = 'P0004';
  end if;

  v_question_count := jsonb_array_length(v_attestation.questions);

  if not public.course_attestation_selected_answers_are_valid(
    p_selected_option_by_question_id,
    v_question_count
  )
    or exists (
      select 1
      from jsonb_array_elements(v_attestation.questions) as question(value)
      where not (
        p_selected_option_by_question_id ? (question.value ->> 'id')
      )
        or not exists (
          select 1
          from jsonb_array_elements(
            question.value -> 'options'
          ) as option(value)
          where option.value ->> 'id'
            = p_selected_option_by_question_id
              ->> (question.value ->> 'id')
        )
    )
    or exists (
      select 1
      from jsonb_object_keys(
        p_selected_option_by_question_id
      ) as submitted(question_id)
      where not exists (
        select 1
        from jsonb_array_elements(v_attestation.questions) as question(value)
        where question.value ->> 'id' = submitted.question_id
      )
    )
  then
    raise exception 'course_attestation_answers_invalid'
      using errcode = '22023';
  end if;

  select count(*)::integer
  into v_correct_answer_count
  from jsonb_array_elements(v_attestation.questions) as question(value)
  where p_selected_option_by_question_id ->> (question.value ->> 'id')
    = question.value ->> 'correctOptionId';

  v_score_percent := floor(
    v_correct_answer_count::numeric * 100 / v_question_count
  )::integer;
  v_passed := v_score_percent >= v_attestation.passing_score_percent;

  insert into public.course_attestation_attempt (
    account_id,
    publication_id,
    revision_id,
    assessment_version,
    selected_option_by_question_id,
    question_count,
    correct_answer_count,
    score_percent,
    passed,
    course_title,
    course_subject,
    assessment_title,
    publisher_display_name,
    passing_score_percent,
    completed_at
  )
  values (
    v_account_id,
    v_publication.id,
    v_attestation.revision_id,
    v_attestation.version,
    p_selected_option_by_question_id,
    v_question_count,
    v_correct_answer_count,
    v_score_percent,
    v_passed,
    v_revision.snapshot -> 'course' ->> 'title',
    v_revision.snapshot -> 'course' ->> 'subject',
    v_attestation.title,
    v_publication.publisher_display_name,
    v_attestation.passing_score_percent,
    clock_timestamp()
  )
  returning * into v_attempt;

  if v_passed then
    insert into public.course_attestation_award (
      account_id,
      publication_id,
      revision_id,
      attempt_id,
      assessment_version,
      course_title,
      course_subject,
      assessment_title,
      publisher_display_name,
      score_percent,
      passing_score_percent,
      issued_at
    )
    values (
      v_account_id,
      v_publication.id,
      v_attestation.revision_id,
      v_attempt.id,
      v_attestation.version,
      v_revision.snapshot -> 'course' ->> 'title',
      v_revision.snapshot -> 'course' ->> 'subject',
      v_attestation.title,
      v_publication.publisher_display_name,
      v_score_percent,
      v_attestation.passing_score_percent,
      v_attempt.completed_at
    );
  end if;

  return public.get_my_course_publication_attestation(p_publication_id);
end
$function$;

revoke all on function public.submit_my_course_publication_attestation(
  uuid,
  uuid,
  jsonb
)
from public, anon, authenticated, service_role;
grant execute on function public.submit_my_course_publication_attestation(
  uuid,
  uuid,
  jsonb
)
to postgres, authenticated;

create or replace function public.list_my_course_publication_attestations()
returns jsonb
language plpgsql
security definer
stable
set search_path = ''
as $function$
declare
  v_account_id uuid;
  v_result jsonb;
begin
  select account.id
  into v_account_id
  from public.account as account
  where account.auth_user_id = (select auth.uid())
    and account.status = 'active';

  if not found then
    raise exception 'course_attestation_account_not_active'
      using errcode = '42501';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'publicationId', award.publication_id,
        'revisionId', award.revision_id,
        'courseTitle', award.course_title,
        'courseSubject', award.course_subject,
        'assessmentTitle', award.assessment_title,
        'publisherDisplayName', award.publisher_display_name,
        'scorePercent', award.score_percent,
        'passingScorePercent', award.passing_score_percent,
        'completedAt', attempt.completed_at,
        'assessmentVersion', award.assessment_version,
        'isCurrentRevision',
          publication.approved_revision_id = award.revision_id,
        'publicationAvailable',
          publication.status = 'published'
          and publication.learning_audience = 'educators'
          and publication.is_shidao
          and publication.approved_revision_id = award.revision_id
          and owner_account.status = 'active'
      )
      order by award.issued_at desc, award.id desc
    ),
    '[]'::jsonb
  )
  into v_result
  from (
    select award.*
    from public.course_attestation_award as award
    where award.account_id = v_account_id
    order by award.issued_at desc, award.id desc
    limit 200
  ) as award
  join public.course_attestation_attempt as attempt
    on attempt.id = award.attempt_id
  join public.course_publication as publication
    on publication.id = award.publication_id
  join public.account as owner_account
    on owner_account.id = publication.owner_account_id;

  return v_result;
end
$function$;

revoke all on function public.list_my_course_publication_attestations()
from public, anon, authenticated, service_role;
grant execute on function public.list_my_course_publication_attestations()
to postgres, authenticated;

create or replace function public.guard_course_attestation_attempt_insert()
returns trigger
language plpgsql
set search_path = ''
as $function$
declare
  v_publication public.course_publication%rowtype;
  v_revision public.course_publication_revision%rowtype;
  v_attestation public.course_publication_attestation%rowtype;
  v_question_count integer;
  v_correct_answer_count integer;
begin
  select publication.*
  into v_publication
  from public.course_publication as publication
  where publication.id = new.publication_id
    and publication.status = 'published'
    and publication.learning_audience = 'educators'
    and publication.is_shidao
    and publication.approved_revision_id = new.revision_id
  for share;

  select revision.*
  into v_revision
  from public.course_publication_revision as revision
  where revision.publication_id = new.publication_id
    and revision.id = new.revision_id
    and revision.license_code = 'shidao_official_learning_v1'
  for share;

  select attestation.*
  into v_attestation
  from public.course_publication_attestation as attestation
  where attestation.publication_id = new.publication_id
    and attestation.revision_id = new.revision_id
  for share;

  if v_publication.id is null
    or v_revision.id is null
    or v_attestation.revision_id is null
    or not exists (
      select 1
      from public.educator_course_revision_review as review
      where review.publication_id = new.publication_id
        and review.revision_id = new.revision_id
        and review.status = 'approved'
    )
    or new.assessment_version <> v_attestation.version
    or new.passing_score_percent <> v_attestation.passing_score_percent
    or new.course_title
      <> v_revision.snapshot -> 'course' ->> 'title'
    or new.course_subject
      <> v_revision.snapshot -> 'course' ->> 'subject'
    or new.assessment_title <> v_attestation.title
    or new.publisher_display_name <> v_publication.publisher_display_name
  then
    raise exception 'course_attestation_attempt_snapshot_mismatch'
      using errcode = '23514';
  end if;

  if not coalesce((
    public.build_course_publication_progress_admin(
      new.account_id,
      new.publication_id,
      new.revision_id
    ) ->> 'complete'
  )::boolean, false) then
    raise exception 'course_attestation_lessons_incomplete'
      using errcode = '55000';
  end if;

  v_question_count := jsonb_array_length(v_attestation.questions);
  if new.question_count <> v_question_count
    or not public.course_attestation_selected_answers_are_valid(
      new.selected_option_by_question_id,
      v_question_count
    )
    or exists (
      select 1
      from jsonb_array_elements(v_attestation.questions) as question(value)
      where not (
        new.selected_option_by_question_id ? (question.value ->> 'id')
      )
        or not exists (
          select 1
          from jsonb_array_elements(
            question.value -> 'options'
          ) as option(value)
          where option.value ->> 'id'
            = new.selected_option_by_question_id
              ->> (question.value ->> 'id')
        )
    )
    or exists (
      select 1
      from jsonb_object_keys(
        new.selected_option_by_question_id
      ) as submitted(question_id)
      where not exists (
        select 1
        from jsonb_array_elements(v_attestation.questions) as question(value)
        where question.value ->> 'id' = submitted.question_id
      )
    )
  then
    raise exception 'course_attestation_attempt_answers_mismatch'
      using errcode = '23514';
  end if;

  select count(*)::integer
  into v_correct_answer_count
  from jsonb_array_elements(v_attestation.questions) as question(value)
  where new.selected_option_by_question_id ->> (question.value ->> 'id')
    = question.value ->> 'correctOptionId';

  if new.correct_answer_count <> v_correct_answer_count then
    raise exception 'course_attestation_attempt_score_mismatch'
      using errcode = '23514';
  end if;

  return new;
end
$function$;

revoke all on function public.guard_course_attestation_attempt_insert()
from public, anon, authenticated, service_role;
grant execute on function public.guard_course_attestation_attempt_insert()
to postgres;

do $migration$
declare
  v_function oid;
begin
  if exists (
    select 1
    from public.course as course
    join public.account as account on account.id = course.owner_account_id
    where course.learning_audience = 'educators'
      and (
        course.audience_type <> 'none'
        or not account.can_author_educator_courses
      )
  )
    or exists (
      select 1
      from public.course_publication as publication
      left join public.educator_course_revision_review as review
        on review.publication_id = publication.id
       and review.revision_id = publication.approved_revision_id
      left join public.course_publication_revision as revision
        on revision.publication_id = publication.id
       and revision.id = publication.approved_revision_id
      where publication.learning_audience = 'educators'
        and (
          not publication.is_shidao
          or publication.approved_revision_id is null
          or review.status <> 'approved'
          or revision.license_code <> 'shidao_official_learning_v1'
        )
    )
    or exists (
      select 1
      from public.course_publication as publication
      where publication.learning_audience = 'children'
        and publication.approved_revision_id is not null
    )
    or exists (
      select 1
      from public.course_publication_revision as revision
      join public.course_publication as publication
        on publication.id = revision.publication_id
      where publication.learning_audience = 'educators'
        and revision.license_code <> 'shidao_official_learning_v1'
    )
  then
    raise exception 'educator_course_governance_backfill_failed'
      using errcode = '55000';
  end if;

  if exists (
    select 1
    from public.course_attestation_award as award
    join public.course_publication as publication
      on publication.id = award.publication_id
     and publication.learning_audience = 'educators'
     and publication.approved_revision_id = award.revision_id
    join public.course_publication_revision as revision
      on revision.publication_id = award.publication_id
     and revision.id = award.revision_id
    where jsonb_array_length(revision.snapshot -> 'lessons') <> (
      select count(*)
      from public.course_publication_lesson_completion as completion
      where completion.account_id = award.account_id
        and completion.publication_id = award.publication_id
        and completion.revision_id = award.revision_id
        and public.course_publication_revision_has_lesson_ref(
          completion.publication_id,
          completion.revision_id,
          completion.lesson_ref
        )
    )
  ) then
    raise exception 'educator_course_award_progress_backfill_failed'
      using errcode = '55000';
  end if;

  if exists (
    select 1
    from pg_class as relation
    where relation.oid in (
      'public.educator_course_revision_review'::regclass,
      'public.course_publication_self_enrollment'::regclass,
      'public.course_publication_lesson_completion'::regclass
    )
      and not relation.relrowsecurity
  ) then
    raise exception 'educator_course_governance_rls_postcondition_failed'
      using errcode = '55000';
  end if;

  if has_table_privilege(
      'authenticated',
      'public.educator_course_revision_review',
      'SELECT,INSERT,UPDATE,DELETE'
    )
    or has_table_privilege(
      'authenticated',
      'public.course_publication_self_enrollment',
      'SELECT,INSERT,UPDATE,DELETE'
    )
    or has_table_privilege(
      'authenticated',
      'public.course_publication_lesson_completion',
      'SELECT,INSERT,UPDATE,DELETE'
    )
  then
    raise exception 'educator_course_governance_acl_postcondition_failed'
      using errcode = '55000';
  end if;

  if not exists (
    select 1
    from pg_trigger as trigger
    join pg_proc as procedure on procedure.oid = trigger.tgfoid
    where trigger.tgrelid = 'public.course_publication_revision'::regclass
      and trigger.tgname = 'trg_course_publication_revision_license_insert'
      and not trigger.tgisinternal
      and trigger.tgenabled = 'O'
      and not procedure.prosecdef
      and procedure.proconfig @> array['search_path=""']
  )
    or not has_function_privilege(
      'postgres',
      'public.set_course_publication_revision_license_on_insert()',
      'EXECUTE'
    )
    or has_function_privilege(
      'service_role',
      'public.set_course_publication_revision_license_on_insert()',
      'EXECUTE'
    )
    or has_function_privilege(
      'authenticated',
      'public.set_course_publication_revision_license_on_insert()',
      'EXECUTE'
    )
    or has_function_privilege(
      'anon',
      'public.set_course_publication_revision_license_on_insert()',
      'EXECUTE'
    )
  then
    raise exception 'educator_course_revision_license_trigger_invalid'
      using errcode = '55000';
  end if;

  foreach v_function in array array[
    'public.get_my_course_publication_progress(uuid)'::regprocedure::oid,
    'public.set_my_course_publication_lesson_progress(uuid,uuid,uuid,boolean)'::regprocedure::oid,
    'public.get_my_course_publication_attestation(uuid)'::regprocedure::oid,
    'public.submit_my_course_publication_attestation(uuid,uuid,jsonb)'::regprocedure::oid,
    'public.list_my_course_publication_attestations()'::regprocedure::oid,
    'public.replace_my_course_attestation(uuid,text,text,integer,jsonb)'::regprocedure::oid,
    'public.get_my_authored_course_attestation(uuid)'::regprocedure::oid
  ]
  loop
    if not exists (
      select 1
      from pg_proc as procedure
      where procedure.oid = v_function
        and procedure.prosecdef
        and procedure.proconfig @> array['search_path=""']
    )
      or not has_function_privilege('authenticated', v_function, 'EXECUTE')
      or has_function_privilege('anon', v_function, 'EXECUTE')
    then
      raise exception 'educator_course_user_rpc_contract_invalid'
        using errcode = '55000';
    end if;
  end loop;

  foreach v_function in array array[
    'public.publish_course_revision_with_attestation_admin(uuid,uuid,uuid,uuid,text,jsonb,jsonb,boolean,text,jsonb)'::regprocedure::oid,
    'public.approve_educator_course_revision_admin(uuid,uuid,uuid)'::regprocedure::oid,
    'public.reject_educator_course_revision_admin(uuid,uuid,uuid,text)'::regprocedure::oid,
    'public.unpublish_course_publication_admin(uuid,uuid)'::regprocedure::oid,
    'public.assert_course_publication_copy_eligible_admin(uuid,uuid)'::regprocedure::oid,
    'public.clone_course_publication_with_attestation_admin(uuid,uuid,uuid,text,jsonb,jsonb)'::regprocedure::oid,
    'public.duplicate_course_with_attestation_admin(uuid,uuid,uuid,text,jsonb)'::regprocedure::oid,
    'public.list_course_publication_catalog_v2_admin(uuid,text,text,text,text,integer,integer)'::regprocedure::oid
  ]
  loop
    if not has_function_privilege('service_role', v_function, 'EXECUTE')
      or has_function_privilege('authenticated', v_function, 'EXECUTE')
      or has_function_privilege('anon', v_function, 'EXECUTE')
    then
      raise exception 'educator_course_admin_rpc_contract_invalid'
        using errcode = '55000';
    end if;
  end loop;

  foreach v_function in array array[
    'public.publish_course_revision_with_attestation_admin(uuid,uuid,uuid,uuid,text,jsonb,jsonb,boolean,text,jsonb)'::regprocedure::oid,
    'public.clone_course_publication_with_attestation_admin(uuid,uuid,uuid,text,jsonb,jsonb)'::regprocedure::oid,
    'public.duplicate_course_with_attestation_admin(uuid,uuid,uuid,text,jsonb)'::regprocedure::oid
  ]
  loop
    if not exists (
      select 1
      from pg_proc as procedure
      where procedure.oid = v_function
        and procedure.prosecdef
        and procedure.proconfig @> array['search_path=""']
    ) then
      raise exception 'educator_course_definer_admin_rpc_mode_invalid'
        using errcode = '55000';
    end if;
  end loop;

  foreach v_function in array array[
    'public.approve_educator_course_revision_admin(uuid,uuid,uuid)'::regprocedure::oid,
    'public.reject_educator_course_revision_admin(uuid,uuid,uuid,text)'::regprocedure::oid,
    'public.unpublish_course_publication_admin(uuid,uuid)'::regprocedure::oid,
    'public.assert_course_publication_copy_eligible_admin(uuid,uuid)'::regprocedure::oid,
    'public.list_course_publication_catalog_v2_admin(uuid,text,text,text,text,integer,integer)'::regprocedure::oid
  ]
  loop
    if not exists (
      select 1
      from pg_proc as procedure
      where procedure.oid = v_function
        and not procedure.prosecdef
        and procedure.proconfig @> array['search_path=""']
    ) then
      raise exception 'educator_course_invoker_admin_rpc_mode_invalid'
        using errcode = '55000';
    end if;
  end loop;

  if has_function_privilege(
      'service_role',
      'public.publish_course_revision_admin(uuid,uuid,uuid,uuid,text,jsonb,jsonb,boolean)',
      'EXECUTE'
    )
    or has_function_privilege(
      'service_role',
      'public.clone_course_publication_admin(uuid,uuid,uuid,text,jsonb,jsonb)',
      'EXECUTE'
    )
    or has_function_privilege(
      'service_role',
      'public.duplicate_course_admin(uuid,uuid,uuid,text,jsonb)',
      'EXECUTE'
    )
  then
    raise exception 'educator_course_generic_admin_bypass_open'
      using errcode = '55000';
  end if;

  if not exists (
    select 1
    from pg_attribute as attribute
    where attribute.attrelid = 'public.account'::regclass
      and attribute.attname = 'can_author_educator_courses'
      and attribute.attnotnull
      and attribute.atthasdef
  )
    or not exists (
      select 1
      from pg_attribute as attribute
      where attribute.attrelid = 'public.course_publication'::regclass
        and attribute.attname = 'approved_revision_id'
        and not attribute.attnotnull
    )
  then
    raise exception 'educator_course_governance_column_contract_invalid'
      using errcode = '55000';
  end if;

  if has_column_privilege(
    'authenticated',
    'public.account',
    'can_author_educator_courses',
    'UPDATE'
  ) then
    raise exception 'educator_course_capability_update_acl_open'
      using errcode = '55000';
  end if;
end
$migration$;

notify pgrst, 'reload schema';

commit;
