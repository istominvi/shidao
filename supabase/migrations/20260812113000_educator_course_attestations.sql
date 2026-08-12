begin;

do $migration$
begin
  if to_regclass('public.account') is null
    or to_regclass('public.course') is null
    or to_regclass('public.course_publication') is null
    or to_regclass('public.course_publication_revision') is null
    or to_regprocedure(
      'public.publish_course_revision_admin(uuid,uuid,uuid,uuid,text,jsonb,jsonb,boolean)'
    ) is null
    or to_regprocedure(
      'public.clone_course_publication_admin(uuid,uuid,uuid,text,jsonb,jsonb)'
    ) is null
    or to_regprocedure(
      'public.duplicate_course_admin(uuid,uuid,uuid,text,jsonb)'
    ) is null
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

  if exists (
    select 1
    from pg_attribute as attribute
    where attribute.attrelid in (
      'public.course'::regclass,
      'public.course_publication'::regclass
    )
      and attribute.attname = 'learning_audience'
      and attribute.attnum > 0
      and not attribute.attisdropped
  )
    or to_regclass('public.course_attestation') is not null
    or to_regclass('public.course_publication_attestation') is not null
    or to_regclass('public.course_attestation_attempt') is not null
    or to_regclass('public.course_attestation_award') is not null
    or to_regprocedure(
      'public.publish_course_revision_with_attestation_admin(uuid,uuid,uuid,uuid,text,jsonb,jsonb,boolean,text,jsonb)'
    ) is not null
    or to_regprocedure(
      'public.clone_course_publication_with_attestation_admin(uuid,uuid,uuid,text,jsonb,jsonb)'
    ) is not null
    or to_regprocedure(
      'public.duplicate_course_with_attestation_admin(uuid,uuid,uuid,text,jsonb)'
    ) is not null
    or to_regprocedure(
      'public.list_course_publication_catalog_v2_admin(uuid,text,text,text,text,integer,integer)'
    ) is not null
    or to_regprocedure(
      'public.assert_course_publication_copy_eligible_admin(uuid,uuid)'
    ) is not null
    or to_regprocedure(
      'public.get_my_course_publication_attestation(uuid)'
    ) is not null
    or to_regprocedure(
      'public.submit_my_course_publication_attestation(uuid,uuid,jsonb)'
    ) is not null
    or to_regprocedure(
      'public.list_my_course_publication_attestations()'
    ) is not null
    or to_regprocedure(
      'public.replace_my_course_attestation(uuid,text,text,integer,jsonb)'
    ) is not null
  then
    raise exception 'educator_course_attestation_objects_already_exist'
      using errcode = '55000';
  end if;
end
$migration$;

-- Freeze the authored/publication roots while the audience discriminator is
-- backfilled and its cross-table invariants are installed.
lock table public.course in share row exclusive mode;
lock table public.course_publication in share row exclusive mode;
lock table public.course_publication_revision in share row exclusive mode;
lock table public.account in share row exclusive mode;

alter table public.course
  add column learning_audience text not null default 'children';

alter table public.course
  add constraint course_learning_audience_check
  check (learning_audience in ('children', 'educators'));

alter table public.course_publication
  add column learning_audience text not null default 'children';

alter table public.course_publication
  add constraint course_publication_learning_audience_check
  check (learning_audience in ('children', 'educators'));

create function public.course_attestation_questions_are_valid(
  p_questions jsonb
)
returns boolean
language plpgsql
immutable
set search_path = ''
as $function$
declare
  v_question jsonb;
  v_option jsonb;
  v_count integer;
  v_distinct_count integer;
begin
  if p_questions is null
    or jsonb_typeof(p_questions) <> 'array'
    or jsonb_array_length(p_questions) < 1
    or jsonb_array_length(p_questions) > 50
  then
    return false;
  end if;

  select count(*), count(distinct question.value ->> 'id')
  into v_count, v_distinct_count
  from jsonb_array_elements(p_questions) as question(value);

  if v_count <> v_distinct_count then
    return false;
  end if;

  for v_question in
    select question.value
    from jsonb_array_elements(p_questions) with ordinality
      as question(value, position)
    order by question.position
  loop
    if jsonb_typeof(v_question) <> 'object'
      or (v_question - array[
        'id',
        'prompt',
        'options',
        'correctOptionId',
        'explanation'
      ]) <> '{}'::jsonb
      or not (v_question ?& array[
        'id',
        'prompt',
        'options',
        'correctOptionId',
        'explanation'
      ])
      or jsonb_typeof(v_question -> 'id') <> 'string'
      or (v_question ->> 'id') !~ '^[A-Za-z0-9_-]{1,80}$'
      or jsonb_typeof(v_question -> 'prompt') <> 'string'
      or btrim(v_question ->> 'prompt') = ''
      or v_question ->> 'prompt' <> btrim(v_question ->> 'prompt')
      or char_length(v_question ->> 'prompt') > 2000
      or jsonb_typeof(v_question -> 'correctOptionId') <> 'string'
      or (v_question ->> 'correctOptionId') !~ '^[A-Za-z0-9_-]{1,80}$'
      or jsonb_typeof(v_question -> 'explanation') <> 'string'
      or v_question ->> 'explanation'
        <> btrim(v_question ->> 'explanation')
      or char_length(v_question ->> 'explanation') > 2000
      or jsonb_typeof(v_question -> 'options') <> 'array'
      or jsonb_array_length(v_question -> 'options') < 2
      or jsonb_array_length(v_question -> 'options') > 8
    then
      return false;
    end if;

    select count(*), count(distinct option.value ->> 'id')
    into v_count, v_distinct_count
    from jsonb_array_elements(v_question -> 'options') as option(value);

    if v_count <> v_distinct_count then
      return false;
    end if;

    for v_option in
      select option.value
      from jsonb_array_elements(v_question -> 'options') with ordinality
        as option(value, position)
      order by option.position
    loop
      if jsonb_typeof(v_option) <> 'object'
        or (v_option - array['id', 'label']) <> '{}'::jsonb
        or not (v_option ?& array['id', 'label'])
        or jsonb_typeof(v_option -> 'id') <> 'string'
        or (v_option ->> 'id') !~ '^[A-Za-z0-9_-]{1,80}$'
        or jsonb_typeof(v_option -> 'label') <> 'string'
        or btrim(v_option ->> 'label') = ''
        or v_option ->> 'label' <> btrim(v_option ->> 'label')
        or char_length(v_option ->> 'label') > 500
      then
        return false;
      end if;
    end loop;

    if not exists (
      select 1
      from jsonb_array_elements(v_question -> 'options') as option(value)
      where option.value ->> 'id' = v_question ->> 'correctOptionId'
    ) then
      return false;
    end if;
  end loop;

  return true;
exception
  when others then
    return false;
end
$function$;

create function public.course_attestation_definition_is_valid(
  p_version integer,
  p_title text,
  p_description text,
  p_passing_score_percent integer,
  p_questions jsonb
)
returns boolean
language sql
immutable
set search_path = ''
as $function$
  select coalesce(
    p_version > 0
    and p_title = btrim(p_title)
    and char_length(p_title) between 2 and 240
    and p_description = btrim(p_description)
    and char_length(p_description) <= 2000
    and p_passing_score_percent between 1 and 100
    and public.course_attestation_questions_are_valid(p_questions),
    false
  );
$function$;

create function public.course_attestation_selected_answers_are_valid(
  p_answers jsonb,
  p_expected_count integer
)
returns boolean
language plpgsql
immutable
set search_path = ''
as $function$
declare
  v_key text;
  v_value jsonb;
  v_count integer := 0;
begin
  if p_answers is null
    or jsonb_typeof(p_answers) <> 'object'
    or p_expected_count is null
    or p_expected_count < 1
    or p_expected_count > 50
  then
    return false;
  end if;

  for v_key, v_value in
    select answer.key, answer.value
    from jsonb_each(p_answers) as answer(key, value)
  loop
    v_count := v_count + 1;
    if v_key !~ '^[A-Za-z0-9_-]{1,80}$'
      or jsonb_typeof(v_value) <> 'string'
      or (v_value #>> '{}') !~ '^[A-Za-z0-9_-]{1,80}$'
    then
      return false;
    end if;
  end loop;

  return v_count = p_expected_count;
exception
  when others then
    return false;
end
$function$;

revoke all on function public.course_attestation_questions_are_valid(jsonb)
from public, anon, authenticated, service_role;
grant execute on function public.course_attestation_questions_are_valid(jsonb)
to postgres, service_role;

revoke all on function public.course_attestation_definition_is_valid(
  integer,
  text,
  text,
  integer,
  jsonb
)
from public, anon, authenticated, service_role;
grant execute on function public.course_attestation_definition_is_valid(
  integer,
  text,
  text,
  integer,
  jsonb
)
to postgres, service_role;

revoke all on function public.course_attestation_selected_answers_are_valid(
  jsonb,
  integer
)
from public, anon, authenticated, service_role;
grant execute on function public.course_attestation_selected_answers_are_valid(
  jsonb,
  integer
)
to postgres, service_role;

create table public.course_attestation (
  course_id uuid primary key
    references public.course(id) on delete cascade,
  version integer not null default 1,
  title text not null,
  description text not null default '',
  passing_score_percent integer not null,
  questions jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint course_attestation_definition_check check (
    public.course_attestation_definition_is_valid(
      version,
      title,
      description,
      passing_score_percent,
      questions
    )
  )
);

create table public.course_publication_attestation (
  revision_id uuid primary key,
  publication_id uuid not null
    references public.course_publication(id) on delete cascade,
  version integer not null,
  title text not null,
  description text not null,
  passing_score_percent integer not null,
  questions jsonb not null,
  created_at timestamptz not null default now(),
  constraint course_publication_attestation_publication_revision_unique
    unique (publication_id, revision_id),
  constraint course_publication_attestation_revision_identity_fkey
    foreign key (publication_id, revision_id)
    references public.course_publication_revision(publication_id, id)
    on delete cascade,
  constraint course_publication_attestation_definition_check check (
    public.course_attestation_definition_is_valid(
      version,
      title,
      description,
      passing_score_percent,
      questions
    )
  )
);

create table public.course_attestation_attempt (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null
    references public.account(id) on delete cascade,
  publication_id uuid not null,
  revision_id uuid not null,
  assessment_version integer not null check (assessment_version > 0),
  selected_option_by_question_id jsonb not null,
  question_count integer not null check (question_count between 1 and 50),
  correct_answer_count integer not null,
  score_percent integer not null check (score_percent between 0 and 100),
  passed boolean not null,
  course_title text not null,
  course_subject text not null,
  assessment_title text not null,
  publisher_display_name text not null,
  passing_score_percent integer not null
    check (passing_score_percent between 1 and 100),
  completed_at timestamptz not null default now(),
  constraint course_attestation_attempt_publication_revision_fkey
    foreign key (publication_id, revision_id)
    references public.course_publication_attestation(
      publication_id,
      revision_id
    ) on delete cascade,
  constraint course_attestation_attempt_identity_unique
    unique (id, account_id, publication_id, revision_id),
  constraint course_attestation_attempt_answers_check check (
    public.course_attestation_selected_answers_are_valid(
      selected_option_by_question_id,
      question_count
    )
  ),
  constraint course_attestation_attempt_correct_count_check check (
    correct_answer_count between 0 and question_count
  ),
  constraint course_attestation_attempt_score_consistency_check check (
    score_percent = floor(
      correct_answer_count::numeric * 100 / question_count
    )::integer
  ),
  constraint course_attestation_attempt_pass_check check (
    passed = (score_percent >= passing_score_percent)
  ),
  constraint course_attestation_attempt_course_title_check check (
    btrim(course_title) <> '' and char_length(course_title) <= 160
  ),
  constraint course_attestation_attempt_course_subject_check check (
    char_length(course_subject) <= 160
  ),
  constraint course_attestation_attempt_assessment_title_check check (
    btrim(assessment_title) <> '' and char_length(assessment_title) <= 240
  ),
  constraint course_attestation_attempt_publisher_name_check check (
    btrim(publisher_display_name) <> ''
    and char_length(publisher_display_name) <= 160
  )
);

create table public.course_attestation_award (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null
    references public.account(id) on delete cascade,
  publication_id uuid not null,
  revision_id uuid not null,
  attempt_id uuid not null,
  assessment_version integer not null check (assessment_version > 0),
  course_title text not null,
  course_subject text not null,
  assessment_title text not null,
  publisher_display_name text not null,
  score_percent integer not null check (score_percent between 0 and 100),
  passing_score_percent integer not null
    check (passing_score_percent between 1 and 100),
  issued_at timestamptz not null default now(),
  constraint course_attestation_award_account_revision_unique
    unique (account_id, revision_id),
  constraint course_attestation_award_attempt_unique unique (attempt_id),
  constraint course_attestation_award_attempt_identity_fkey
    foreign key (attempt_id, account_id, publication_id, revision_id)
    references public.course_attestation_attempt(
      id,
      account_id,
      publication_id,
      revision_id
    ) on delete cascade,
  constraint course_attestation_award_score_check check (
    score_percent >= passing_score_percent
  ),
  constraint course_attestation_award_course_title_check check (
    btrim(course_title) <> '' and char_length(course_title) <= 160
  ),
  constraint course_attestation_award_course_subject_check check (
    char_length(course_subject) <= 160
  ),
  constraint course_attestation_award_assessment_title_check check (
    btrim(assessment_title) <> '' and char_length(assessment_title) <= 240
  ),
  constraint course_attestation_award_publisher_name_check check (
    btrim(publisher_display_name) <> ''
    and char_length(publisher_display_name) <= 160
  )
);

create index course_publication_catalog_learning_audience_order_idx
on public.course_publication (
  learning_audience,
  is_shidao desc,
  published_at desc,
  id desc
)
where status = 'published';

create index course_publication_catalog_learning_audience_subject_idx
on public.course_publication (
  learning_audience,
  lower(btrim(subject))
)
where status = 'published';

create index course_publication_catalog_learning_audience_level_idx
on public.course_publication (
  learning_audience,
  lower(btrim(level))
)
where status = 'published';

create index course_attestation_attempt_account_completed_idx
on public.course_attestation_attempt (
  account_id,
  completed_at desc,
  id desc
);

create index course_attestation_attempt_account_revision_completed_idx
on public.course_attestation_attempt (
  account_id,
  revision_id,
  completed_at desc,
  id desc
);

create index course_attestation_award_account_issued_idx
on public.course_attestation_award (
  account_id,
  issued_at desc,
  id desc
);

alter table public.course_attestation enable row level security;
alter table public.course_publication_attestation enable row level security;
alter table public.course_attestation_attempt enable row level security;
alter table public.course_attestation_award enable row level security;

create policy course_attestation_owner_all
on public.course_attestation
to authenticated
using (
  exists (
    select 1
    from public.course as course
    join public.account as account
      on account.id = course.owner_account_id
    where course.id = course_attestation.course_id
      and course.owner_account_id = (
        select public.current_account_id()
      )
      and course.archived_at is null
      and account.status = 'active'
  )
)
with check (
  exists (
    select 1
    from public.course as course
    join public.account as account
      on account.id = course.owner_account_id
    where course.id = course_attestation.course_id
      and course.owner_account_id = (
        select public.current_account_id()
      )
      and course.archived_at is null
      and account.status = 'active'
  )
);

revoke all on table public.course_attestation
from public, anon, authenticated;
grant all on table public.course_attestation to postgres, service_role;

revoke all on table public.course_publication_attestation
from public, anon, authenticated;
grant all on table public.course_publication_attestation
to postgres, service_role;

revoke all on table public.course_attestation_attempt
from public, anon, authenticated;
grant all on table public.course_attestation_attempt
to postgres, service_role;

revoke all on table public.course_attestation_award
from public, anon, authenticated;
grant all on table public.course_attestation_award
to postgres, service_role;

-- Course authoring itself keeps its established column-only browser ACL.
grant update (learning_audience) on table public.course to authenticated;

create function public.guard_course_attestation_live_definition()
returns trigger
language plpgsql
set search_path = ''
as $function$
declare
  v_learning_audience text;
  v_archived_at timestamptz;
begin
  select course.learning_audience, course.archived_at
  into v_learning_audience, v_archived_at
  from public.course as course
  where course.id = new.course_id
  for update of course;

  if not found
    or v_archived_at is not null
    or v_learning_audience <> 'educators'
  then
    raise exception 'course_attestation_requires_active_educator_course'
      using errcode = '23514';
  end if;

  return new;
end
$function$;

revoke all on function public.guard_course_attestation_live_definition()
from public, anon, authenticated, service_role;
grant execute on function public.guard_course_attestation_live_definition()
to postgres;

create trigger trg_course_attestation_live_definition
before insert or update on public.course_attestation
for each row execute function public.guard_course_attestation_live_definition();

create function public.guard_course_learning_audience_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if old.learning_audience = 'educators'
    and new.learning_audience = 'children'
    and exists (
      select 1
      from public.course_attestation as attestation
      where attestation.course_id = old.id
    )
  then
    raise exception 'course_attestation_must_be_removed_first'
      using errcode = '23514';
  end if;

  return new;
end
$function$;

revoke all on function public.guard_course_learning_audience_change()
from public, anon, authenticated, service_role;
grant execute on function public.guard_course_learning_audience_change()
to postgres;

create trigger trg_course_learning_audience_change
before update of learning_audience on public.course
for each row execute function public.guard_course_learning_audience_change();

create function public.touch_course_from_attestation_child()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_course_id uuid;
begin
  if tg_op = 'DELETE' then
    v_course_id := old.course_id;
  else
    v_course_id := new.course_id;
  end if;

  update public.course as course
  set updated_at = clock_timestamp(),
      publication_content_updated_at = clock_timestamp()
  where course.id = v_course_id;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end
$function$;

revoke all on function public.touch_course_from_attestation_child()
from public, anon, authenticated, service_role;
grant execute on function public.touch_course_from_attestation_child()
to postgres;

create trigger trg_course_attestation_touch_course
after insert or update or delete on public.course_attestation
for each row execute function public.touch_course_from_attestation_child();

create or replace function public.set_course_publication_content_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if tg_op = 'INSERT' then
    new.publication_content_updated_at := clock_timestamp();
    return new;
  end if;

  if pg_trigger_depth() > 1 then
    return new;
  end if;

  new.publication_content_updated_at := old.publication_content_updated_at;

  if new.title is distinct from old.title
    or new.subject is distinct from old.subject
    or new.goal is distinct from old.goal
    or new.level is distinct from old.level
    or new.audience_description is distinct from old.audience_description
    or new.target_lesson_count is distinct from old.target_lesson_count
    or new.learning_audience is distinct from old.learning_audience
  then
    new.publication_content_updated_at := clock_timestamp();
  end if;

  return new;
end
$function$;

create function public.reject_course_attestation_immutable_update()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  raise exception 'course_attestation_immutable_row'
    using errcode = '55000';
end
$function$;

revoke all on function public.reject_course_attestation_immutable_update()
from public, anon, authenticated, service_role;
grant execute on function public.reject_course_attestation_immutable_update()
to postgres;

-- DELETE remains available only to privileged retention/Account-erasure paths;
-- every in-place mutation of an issued definition/result is rejected.
create trigger trg_course_publication_attestation_immutable
before update on public.course_publication_attestation
for each row execute function public.reject_course_attestation_immutable_update();

create trigger trg_course_attestation_attempt_immutable
before update on public.course_attestation_attempt
for each row execute function public.reject_course_attestation_immutable_update();

create trigger trg_course_attestation_award_immutable
before update on public.course_attestation_award
for each row execute function public.reject_course_attestation_immutable_update();

create function public.guard_course_attestation_award_insert()
returns trigger
language plpgsql
set search_path = ''
as $function$
declare
  v_attempt public.course_attestation_attempt%rowtype;
begin
  select attempt.*
  into v_attempt
  from public.course_attestation_attempt as attempt
  where attempt.id = new.attempt_id
    and attempt.account_id = new.account_id
    and attempt.publication_id = new.publication_id
    and attempt.revision_id = new.revision_id
  for share;

  if not found
    or not v_attempt.passed
    or new.assessment_version <> v_attempt.assessment_version
    or new.course_title <> v_attempt.course_title
    or new.course_subject <> v_attempt.course_subject
    or new.assessment_title <> v_attempt.assessment_title
    or new.publisher_display_name <> v_attempt.publisher_display_name
    or new.score_percent <> v_attempt.score_percent
    or new.passing_score_percent <> v_attempt.passing_score_percent
  then
    raise exception 'course_attestation_award_attempt_mismatch'
      using errcode = '23514';
  end if;

  return new;
end
$function$;

revoke all on function public.guard_course_attestation_award_insert()
from public, anon, authenticated, service_role;
grant execute on function public.guard_course_attestation_award_insert()
to postgres;

create trigger trg_course_attestation_award_insert
before insert on public.course_attestation_award
for each row execute function public.guard_course_attestation_award_insert();

create function public.guard_course_attestation_attempt_insert()
returns trigger
language plpgsql
set search_path = ''
as $function$
declare
  v_publication public.course_publication%rowtype;
  v_attestation public.course_publication_attestation%rowtype;
  v_question_count integer;
  v_correct_answer_count integer;
begin
  select publication.*
  into v_publication
  from public.course_publication as publication
  where publication.id = new.publication_id
  for share;

  select attestation.*
  into v_attestation
  from public.course_publication_attestation as attestation
  where attestation.publication_id = new.publication_id
    and attestation.revision_id = new.revision_id
  for share;

  if v_publication.id is null
    or v_attestation.revision_id is null
    or new.assessment_version <> v_attestation.version
    or new.passing_score_percent <> v_attestation.passing_score_percent
    or new.course_title <> v_publication.title
    or new.course_subject <> v_publication.subject
    or new.assessment_title <> v_attestation.title
    or new.publisher_display_name <> v_publication.publisher_display_name
  then
    raise exception 'course_attestation_attempt_snapshot_mismatch'
      using errcode = '23514';
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

create trigger trg_course_attestation_attempt_insert
before insert on public.course_attestation_attempt
for each row execute function public.guard_course_attestation_attempt_insert();

create function public.replace_my_course_attestation(
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
  for update;

  if not found then
    raise exception 'course_attestation_account_not_active'
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

create function public.get_my_authored_course_attestation(
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
    and account.status = 'active';

  if not found then
    raise exception 'course_attestation_account_not_active'
      using errcode = '42501';
  end if;

  perform 1
  from public.course as course
  where course.id = p_course_id
    and course.owner_account_id = v_account_id
    and course.archived_at is null;

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

create function public.publish_course_revision_with_attestation_admin(
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
security invoker
set search_path = ''
as $function$
declare
  v_course public.course%rowtype;
  v_live public.course_attestation%rowtype;
  v_persisted public.course_publication_attestation%rowtype;
  v_live_json jsonb;
  v_result jsonb;
  v_actual_revision_id uuid;
begin
  if p_learning_audience not in ('children', 'educators') then
    raise exception 'course_learning_audience_invalid'
      using errcode = '22023';
  end if;

  select course.*
  into v_course
  from public.course as course
  where course.id = p_source_course_id
    and course.owner_account_id = p_actor_account_id
    and course.archived_at is null
  for update;

  if not found or v_course.learning_audience <> p_learning_audience then
    raise exception 'course_publication_learning_audience_mismatch'
      using errcode = '23514';
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
  elsif exists (
    select 1
    from public.course_publication_attestation as attestation
    where attestation.revision_id = v_actual_revision_id
  ) then
    raise exception 'course_publication_attestation_revision_conflict'
      using errcode = '23514';
  end if;

  update public.course_publication as publication
  set learning_audience = p_learning_audience
  where publication.id = p_publication_id
    and publication.current_revision_id = v_actual_revision_id;

  if not found then
    raise exception 'course_publication_update_conflict'
      using errcode = '40001';
  end if;

  return v_result || jsonb_build_object(
    'learningAudience', p_learning_audience
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

create function public.assert_course_publication_copy_eligible_admin(
  p_actor_account_id uuid,
  p_publication_id uuid
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $function$
declare
  v_publication public.course_publication%rowtype;
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

  select publication.*
  into v_publication
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

  if v_publication.learning_audience = 'educators' and not exists (
    select 1
    from public.course_attestation_award as award
    where award.account_id = p_actor_account_id
      and award.publication_id = v_publication.id
      and award.revision_id = v_publication.current_revision_id
  ) then
    raise exception 'course_attestation_required_before_clone'
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

create function public.clone_course_publication_with_attestation_admin(
  p_actor_account_id uuid,
  p_publication_id uuid,
  p_target_course_id uuid,
  p_target_title text,
  p_id_map jsonb,
  p_asset_manifest jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_publication public.course_publication%rowtype;
  v_attestation public.course_publication_attestation%rowtype;
  v_result jsonb;
begin
  select publication.*
  into v_publication
  from public.course_publication as publication
  where publication.id = p_publication_id
    and publication.status = 'published'
  for share;

  if not found then
    raise exception 'course_publication_not_published'
      using errcode = 'P0002';
  end if;

  select attestation.*
  into v_attestation
  from public.course_publication_attestation as attestation
  where attestation.publication_id = p_publication_id
    and attestation.revision_id = v_publication.current_revision_id
  for share;

  if v_publication.learning_audience = 'educators' and not found then
    raise exception 'course_publication_attestation_not_found'
      using errcode = 'P0002';
  end if;

  if v_publication.learning_audience = 'educators' then
    perform 1
    from public.course_attestation_award as award
    where award.account_id = p_actor_account_id
      and award.publication_id = v_publication.id
      and award.revision_id = v_publication.current_revision_id;

    if not found then
      raise exception 'course_attestation_required_before_clone'
        using errcode = '42501';
    end if;
  end if;

  v_result := public.clone_course_publication_admin(
    p_actor_account_id,
    p_publication_id,
    p_target_course_id,
    p_target_title,
    p_id_map,
    p_asset_manifest
  );

  update public.course as course
  set learning_audience = v_publication.learning_audience
  where course.id = p_target_course_id
    and course.owner_account_id = p_actor_account_id;

  if not found then
    raise exception 'course_publication_clone_target_not_found'
      using errcode = 'P0002';
  end if;

  if v_publication.learning_audience = 'educators' then
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
      p_target_course_id,
      v_attestation.version,
      v_attestation.title,
      v_attestation.description,
      v_attestation.passing_score_percent,
      v_attestation.questions,
      clock_timestamp(),
      clock_timestamp()
    );
  end if;

  return v_result || jsonb_build_object(
    'learningAudience', v_publication.learning_audience
  );
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

create function public.duplicate_course_with_attestation_admin(
  p_actor_account_id uuid,
  p_source_course_id uuid,
  p_target_course_id uuid,
  p_target_title text,
  p_id_map jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_source public.course%rowtype;
  v_attestation public.course_attestation%rowtype;
  v_result jsonb;
begin
  v_result := public.duplicate_course_admin(
    p_actor_account_id,
    p_source_course_id,
    p_target_course_id,
    p_target_title,
    p_id_map
  );

  select course.*
  into strict v_source
  from public.course as course
  where course.id = p_source_course_id
    and course.owner_account_id = p_actor_account_id
  for share;

  select attestation.*
  into v_attestation
  from public.course_attestation as attestation
  where attestation.course_id = p_source_course_id
  for share;

  update public.course as course
  set learning_audience = v_source.learning_audience
  where course.id = p_target_course_id
    and course.owner_account_id = p_actor_account_id;

  if not found then
    raise exception 'course_duplicate_target_not_found'
      using errcode = 'P0002';
  end if;

  if v_attestation.course_id is not null then
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
      p_target_course_id,
      v_attestation.version,
      v_attestation.title,
      v_attestation.description,
      v_attestation.passing_score_percent,
      v_attestation.questions,
      clock_timestamp(),
      clock_timestamp()
    );
  end if;

  return v_result || jsonb_build_object(
    'learningAudience', v_source.learning_audience
  );
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

create function public.list_course_publication_catalog_v2_admin(
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

  with filtered as (
    select publication.*
    from public.course_publication as publication
    join public.account as owner_account
      on owner_account.id = publication.owner_account_id
    where publication.status = 'published'
      and owner_account.status = 'active'
      and publication.learning_audience = p_learning_audience
      and (
        btrim(p_q) = ''
        or position(
          lower(btrim(p_q)) in lower(concat_ws(
            ' ',
            publication.title,
            publication.subject,
            publication.goal,
            publication.level,
            publication.audience_description,
            publication.publisher_display_name
          ))
        ) > 0
      )
      and (
        btrim(p_subject) = ''
        or lower(btrim(publication.subject)) = lower(btrim(p_subject))
      )
      and (
        btrim(p_level) = ''
        or lower(btrim(publication.level)) = lower(btrim(p_level))
      )
  ),
  page_plus_one as materialized (
    select publication.*
    from filtered as publication
    order by
      publication.is_shidao desc,
      publication.published_at desc,
      publication.id desc
    offset p_offset
    limit p_limit + 1
  ),
  page_rows as (
    select publication.*
    from page_plus_one as publication
    order by
      publication.is_shidao desc,
      publication.published_at desc,
      publication.id desc
    limit p_limit
  ),
  subject_values_all as (
    select min(btrim(publication.subject)) as value
    from public.course_publication as publication
    join public.account as owner_account
      on owner_account.id = publication.owner_account_id
    where publication.status = 'published'
      and owner_account.status = 'active'
      and publication.learning_audience = p_learning_audience
      and btrim(publication.subject) <> ''
    group by lower(btrim(publication.subject))
  ),
  subject_values as materialized (
    select value
    from subject_values_all
    order by
      case
        when btrim(p_subject) <> ''
          and lower(value) = lower(btrim(p_subject))
          then 0
        else 1
      end,
      lower(value),
      value
    limit 100
  ),
  level_values_all as (
    select min(btrim(publication.level)) as value
    from public.course_publication as publication
    join public.account as owner_account
      on owner_account.id = publication.owner_account_id
    where publication.status = 'published'
      and owner_account.status = 'active'
      and publication.learning_audience = p_learning_audience
      and btrim(publication.level) <> ''
    group by lower(btrim(publication.level))
  ),
  level_values as materialized (
    select value
    from level_values_all
    order by
      case
        when btrim(p_level) <> ''
          and lower(value) = lower(btrim(p_level))
          then 0
        else 1
      end,
      lower(value),
      value
    limit 100
  )
  select jsonb_build_object(
    'courses', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'publicationId', publication.id,
          'sourceCourseId', case
            when publication.owner_account_id = p_actor_account_id
              then publication.source_course_id
            else null
          end,
          'learningAudience', publication.learning_audience,
          'title', publication.title,
          'subject', publication.subject,
          'goal', publication.goal,
          'level', publication.level,
          'audienceDescription', publication.audience_description,
          'targetLessonCount', publication.target_lesson_count,
          'lessonCount', publication.lesson_count,
          'materialCount', publication.material_count,
          'publishedAt', publication.published_at,
          'author', jsonb_build_object(
            'displayName', publication.publisher_display_name,
            'isShiDao', publication.is_shidao,
            'isCurrentUser',
              publication.owner_account_id = p_actor_account_id
          )
        )
        order by
          publication.is_shidao desc,
          publication.published_at desc,
          publication.id desc
      )
      from page_rows as publication
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

create function public.get_my_course_publication_attestation(
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
    and owner_account.status = 'active';

  if not found then
    raise exception 'course_attestation_not_found'
      using errcode = 'P0002';
  end if;

  select attestation.*
  into v_attestation
  from public.course_publication_attestation as attestation
  where attestation.publication_id = v_publication.id
    and attestation.revision_id = v_publication.current_revision_id;

  if not found then
    raise exception 'course_attestation_not_found'
      using errcode = 'P0002';
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

create function public.submit_my_course_publication_attestation(
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
    and owner_account.status = 'active'
  for update of publication;

  if not found then
    raise exception 'course_attestation_not_found'
      using errcode = 'P0002';
  end if;

  if v_publication.current_revision_id <> p_expected_revision_id then
    raise exception 'course_attestation_revision_stale'
      using errcode = '40001';
  end if;

  select attestation.*
  into v_attestation
  from public.course_publication_attestation as attestation
  where attestation.publication_id = v_publication.id
    and attestation.revision_id = v_publication.current_revision_id
  for share;

  if not found then
    raise exception 'course_attestation_not_found'
      using errcode = 'P0002';
  end if;

  if v_attestation.revision_id <> p_expected_revision_id then
    raise exception 'course_attestation_revision_stale'
      using errcode = '40001';
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
    v_publication.title,
    v_publication.subject,
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
      v_publication.title,
      v_publication.subject,
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

create function public.list_my_course_publication_attestations()
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
          publication.current_revision_id = award.revision_id,
        'publicationAvailable',
          publication.status = 'published'
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

do $migration$
declare
  v_user_function oid;
  v_admin_function oid;
  v_private_function oid;
begin
  if exists (
    select 1
    from public.course
    where learning_audience <> 'children'
  )
    or exists (
      select 1
      from public.course_publication
      where learning_audience <> 'children'
    )
  then
    raise exception 'course_learning_audience_backfill_failed'
      using errcode = '55000';
  end if;

  if not has_column_privilege(
    'authenticated',
    'public.course',
    'learning_audience',
    'UPDATE'
  )
    or has_table_privilege(
      'authenticated',
      'public.course_attestation',
      'SELECT'
    )
    or has_table_privilege(
      'authenticated',
      'public.course_publication_attestation',
      'SELECT'
    )
    or has_table_privilege(
      'authenticated',
      'public.course_attestation_attempt',
      'SELECT'
    )
    or has_table_privilege(
      'authenticated',
      'public.course_attestation_award',
      'SELECT'
    )
  then
    raise exception 'course_attestation_acl_postcondition_failed'
      using errcode = '55000';
  end if;

  foreach v_user_function in array array[
    to_regprocedure(
      'public.get_my_course_publication_attestation(uuid)'
    ),
    to_regprocedure(
      'public.submit_my_course_publication_attestation(uuid,uuid,jsonb)'
    ),
    to_regprocedure(
      'public.list_my_course_publication_attestations()'
    ),
    to_regprocedure(
      'public.replace_my_course_attestation(uuid,text,text,integer,jsonb)'
    ),
    to_regprocedure(
      'public.get_my_authored_course_attestation(uuid)'
    )
  ]
  loop
    if v_user_function is null
      or not has_function_privilege(
        'authenticated',
        v_user_function,
        'EXECUTE'
      )
      or has_function_privilege('anon', v_user_function, 'EXECUTE')
      or has_function_privilege('service_role', v_user_function, 'EXECUTE')
      or not exists (
        select 1
        from pg_proc as procedure
        where procedure.oid = v_user_function
          and procedure.prosecdef
          and procedure.proconfig @> array['search_path=""']::text[]
      )
    then
      raise exception 'course_attestation_user_rpc_contract_invalid'
        using errcode = '55000';
    end if;
  end loop;

  foreach v_admin_function in array array[
    to_regprocedure(
      'public.publish_course_revision_with_attestation_admin(uuid,uuid,uuid,uuid,text,jsonb,jsonb,boolean,text,jsonb)'
    ),
    to_regprocedure(
      'public.clone_course_publication_with_attestation_admin(uuid,uuid,uuid,text,jsonb,jsonb)'
    ),
    to_regprocedure(
      'public.duplicate_course_with_attestation_admin(uuid,uuid,uuid,text,jsonb)'
    ),
    to_regprocedure(
      'public.list_course_publication_catalog_v2_admin(uuid,text,text,text,text,integer,integer)'
    ),
    to_regprocedure(
      'public.assert_course_publication_copy_eligible_admin(uuid,uuid)'
    )
  ]
  loop
    if v_admin_function is null
      or not has_function_privilege(
        'service_role',
        v_admin_function,
        'EXECUTE'
      )
      or has_function_privilege(
        'authenticated',
        v_admin_function,
        'EXECUTE'
      )
      or has_function_privilege('anon', v_admin_function, 'EXECUTE')
      or not exists (
        select 1
        from pg_proc as procedure
        where procedure.oid = v_admin_function
          and not procedure.prosecdef
          and procedure.proconfig @> array['search_path=""']::text[]
      )
    then
      raise exception 'course_attestation_admin_rpc_contract_invalid'
        using errcode = '55000';
    end if;
  end loop;

  foreach v_private_function in array array[
    to_regprocedure(
      'public.guard_course_learning_audience_change()'
    ),
    to_regprocedure(
      'public.touch_course_from_attestation_child()'
    )
  ]
  loop
    if v_private_function is null
      or has_function_privilege(
        'anon',
        v_private_function,
        'EXECUTE'
      )
      or has_function_privilege(
        'authenticated',
        v_private_function,
        'EXECUTE'
      )
      or has_function_privilege(
        'service_role',
        v_private_function,
        'EXECUTE'
      )
      or not exists (
        select 1
        from pg_proc as procedure
        where procedure.oid = v_private_function
          and procedure.prosecdef
          and procedure.proconfig @> array['search_path=""']::text[]
      )
    then
      raise exception 'course_attestation_private_trigger_contract_invalid'
        using errcode = '55000';
    end if;
  end loop;

  if exists (
    select 1
    from (values
      ('public.course_attestation'::regclass),
      ('public.course_publication_attestation'::regclass),
      ('public.course_attestation_attempt'::regclass),
      ('public.course_attestation_award'::regclass)
    ) as required_table(relation_id)
    join pg_class as relation on relation.oid = required_table.relation_id
    where not relation.relrowsecurity
  ) then
    raise exception 'course_attestation_rls_postcondition_failed'
      using errcode = '55000';
  end if;

  if to_regprocedure(
    'public.set_course_publication_content_updated_at()'
  ) is null
    or to_regprocedure(
      'public.touch_course_from_attestation_child()'
    ) is null
    or not exists (
      select 1
      from pg_trigger as trigger_row
      where trigger_row.tgrelid = 'public.course_attestation'::regclass
        and trigger_row.tgname = 'trg_course_attestation_touch_course'
        and not trigger_row.tgisinternal
        and trigger_row.tgenabled = 'O'
    )
  then
    raise exception 'course_attestation_clock_contract_invalid'
      using errcode = '55000';
  end if;
end
$migration$;

notify pgrst, 'reload schema';

commit;
