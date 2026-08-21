begin;

-- LA-M3 adds immutable typed evidence, a deterministic learner-objective
-- projection and explainable next-step recommendations.  It deliberately
-- keeps LessonRun/LearningRecord as the lifecycle source of truth and does not
-- introduce a Step model, a second Component order, a generic event lake or
-- LearningRecord.metrics.

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
      ('teacher_learner'),
      ('learning_record'),
      ('lesson_component_observation'),
      ('learning_objective'),
      ('learner_observer_grant')
  ) as expected(name)
  where to_regclass('public.' || expected.name) is null;

  if v_missing is not null then
    raise exception
      'shidao_learning_activity_m3_schema_sanity_failed: missing tables: %',
      v_missing;
  end if;

  if to_regclass('public.learning_evidence') is not null
    or to_regclass('public.learner_objective_state') is not null
    or to_regclass('public.learner_objective_state_evidence') is not null
    or to_regclass('public.learner_recommendation_override') is not null
    or to_regprocedure(
      'public.correct_finalized_lesson_component_observation(uuid,uuid,uuid,text,text,text,uuid,timestamp with time zone)'
    ) is not null
    or to_regprocedure(
      'public.rebuild_learner_objective_states(uuid,uuid,timestamp with time zone)'
    ) is not null
    or to_regprocedure(
      'public.get_teacher_learning_record_correction_history(uuid[])'
    ) is not null
  then
    raise exception
      'shidao_learning_activity_m3_schema_sanity_failed: unexpected LA-M3 objects';
  end if;

  if to_regprocedure(
      'public.save_lesson_component_observations(uuid,uuid,text,text,text,jsonb)'
    ) is null
    or to_regprocedure(
      'public.complete_lesson_run_v2(uuid,jsonb,text,timestamp with time zone,integer)'
    ) is null
    or to_regprocedure(
      'public.execute_learner_profile_merge_for_actor(uuid,uuid,text)'
    ) is null
    or to_regprocedure(
      'public.confirm_my_learning_data_erasure(uuid,text)'
    ) is null
    or to_regprocedure(
      'public.learner_erasure_state_for_actor(uuid,uuid)'
    ) is null
    or to_regprocedure(
      'public.build_cross_provider_learner_context(uuid,uuid)'
    ) is null
    or not has_function_privilege(
      'service_role',
      'public.build_cross_provider_learner_context(uuid,uuid)',
      'EXECUTE'
    )
    or has_function_privilege(
      'authenticated',
      'public.build_cross_provider_learner_context(uuid,uuid)',
      'EXECUTE'
    )
    or has_function_privilege(
      'anon',
      'public.build_cross_provider_learner_context(uuid,uuid)',
      'EXECUTE'
    )
    or not exists (
      select 1
      from pg_constraint
      where conrelid = 'public.learning_record'::regclass
        and conname = 'learning_record_run_learner_unique'
        and contype = 'u'
    )
  then
    raise exception
      'shidao_learning_activity_m3_schema_sanity_failed: canonical LA-M2/identity head missing';
  end if;
end
$preflight$;

create temporary table learning_activity_m3_baseline
on commit drop
as
select
  (select count(*) from public.learning_record) as learning_record_count,
  (select count(*) from public.lesson_component_observation)
    as observation_count;

-- Existing identity preview DTOs stay byte-for-byte compatible.  A second
-- internal fingerprint binds merge/erasure confirmation to the LA-M3 rows
-- without exposing their IDs or counts to the browser.
alter table public.learner_profile_merge
  add column learning_activity_scope_fingerprint bytea null,
  add constraint learner_profile_merge_learning_activity_scope_check check (
    learning_activity_scope_fingerprint is null
    or octet_length(learning_activity_scope_fingerprint) = 32
  );

alter table public.learner_erasure_request
  add column learning_activity_scope_fingerprint bytea null,
  add constraint learner_erasure_learning_activity_scope_check check (
    learning_activity_scope_fingerprint is null
    or octet_length(learning_activity_scope_fingerprint) = 32
  );

-- Stable identity is separate from the nullable live FKs.  Existing rows are
-- populated only from their still-present canonical source; no identity or
-- evidence is invented for already detached legacy history.
alter table public.learning_record
  add column source_course_id_at_time uuid null,
  add column source_lesson_id_at_time uuid null,
  add column source_lesson_run_id_at_time uuid null,
  add column corrected_from_record_id uuid null,
  add column correction_reason text null,
  add column correction_idempotency_key uuid null,
  add column corrected_at timestamptz null,
  add constraint learning_record_corrected_from_fkey
    foreign key (corrected_from_record_id)
    references public.learning_record(id)
    on delete no action
    deferrable initially deferred,
  add constraint learning_record_correction_shape_check check (
    (
      corrected_from_record_id is null
      and correction_reason is null
      and correction_idempotency_key is null
      and corrected_at is null
    )
    or (
      corrected_from_record_id is not null
      and corrected_from_record_id <> id
      and correction_reason is not null
      and btrim(correction_reason) <> ''
      and char_length(btrim(correction_reason)) <= 500
      and correction_idempotency_key is not null
      and corrected_at is not null
      and occurred_at is not null
    )
  );

-- Evidence carries the same learner/recorder identity as its authoritative
-- LearningRecord.  A composite key makes that invariant physical and lets a
-- supported canonical merge cascade the learner identity without temporarily
-- leaving evidence attached to the deleted source profile.
alter table public.learning_record
  add constraint learning_record_id_learner_recorder_unique
  unique (id, learner_profile_id, recorded_by_account_id);

update public.learning_record as record
set source_course_id_at_time = record.source_course_id,
    source_lesson_id_at_time = record.source_lesson_id,
    source_lesson_run_id_at_time = record.lesson_run_id
where record.source_course_id_at_time is null
  and record.source_lesson_id_at_time is null
  and record.source_lesson_run_id_at_time is null;

alter table public.learning_record
  drop constraint learning_record_run_learner_unique;

create unique index learning_record_active_run_learner_unique
  on public.learning_record (lesson_run_id, learner_profile_id)
  where lesson_run_id is not null
    and superseded_by_record_id is null;

create unique index learning_record_correction_idempotency_unique
  on public.learning_record (
    recorded_by_account_id,
    correction_idempotency_key
  )
  where correction_idempotency_key is not null;

create unique index learning_record_corrected_from_unique
  on public.learning_record (corrected_from_record_id)
  where corrected_from_record_id is not null;

create function public.capture_learning_record_source_identity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if tg_op = 'INSERT' then
    new.source_course_id_at_time := coalesce(
      new.source_course_id_at_time,
      new.source_course_id
    );
    new.source_lesson_id_at_time := coalesce(
      new.source_lesson_id_at_time,
      new.source_lesson_id
    );
    new.source_lesson_run_id_at_time := coalesce(
      new.source_lesson_run_id_at_time,
      new.lesson_run_id
    );
  else
    if new.source_course_id_at_time is distinct from
      old.source_course_id_at_time
    then
      raise exception 'learning_record_source_identity_immutable'
        using errcode = '55000';
    end if;
    if new.source_lesson_id_at_time is distinct from
      old.source_lesson_id_at_time
    then
      raise exception 'learning_record_source_identity_immutable'
        using errcode = '55000';
    end if;
    if new.source_lesson_run_id_at_time is distinct from
      old.source_lesson_run_id_at_time
    then
      raise exception 'learning_record_source_identity_immutable'
        using errcode = '55000';
    end if;
  end if;
  return new;
end
$function$;

revoke all on function public.capture_learning_record_source_identity()
from public, anon, authenticated, service_role;
grant execute on function public.capture_learning_record_source_identity()
to postgres;

create trigger trg_learning_record_source_identity
before insert or update of
  lesson_run_id,
  source_course_id,
  source_lesson_id,
  source_course_id_at_time,
  source_lesson_id_at_time,
  source_lesson_run_id_at_time
on public.learning_record
for each row execute function public.capture_learning_record_source_identity();

alter table public.lesson_component_observation
  add column corrected_from_observation_id uuid null,
  add column superseded_by_observation_id uuid null,
  add column component_visibility_at_time text null,
  add constraint lesson_component_observation_corrected_from_fkey
    foreign key (corrected_from_observation_id)
    references public.lesson_component_observation(id)
    on delete no action
    deferrable initially deferred,
  add constraint lesson_component_observation_superseded_by_fkey
    foreign key (superseded_by_observation_id)
    references public.lesson_component_observation(id)
    on delete no action
    deferrable initially deferred,
  add constraint lesson_component_observation_correction_shape_check check (
    (corrected_from_observation_id is null
      or corrected_from_observation_id <> id)
    and (superseded_by_observation_id is null
      or superseded_by_observation_id <> id)
  ),
  add constraint lesson_component_observation_visibility_at_time_check check (
    component_visibility_at_time is null
    or component_visibility_at_time in ('learner_visible', 'staff_only')
  );

alter table public.lesson_component_observation
  add constraint lesson_component_observation_id_record_recorder_unique
  unique (id, learning_record_id, recorded_by_account_id);

create unique index lesson_component_observation_corrected_from_unique
  on public.lesson_component_observation (corrected_from_observation_id)
  where corrected_from_observation_id is not null;

create unique index lesson_component_observation_superseded_by_unique
  on public.lesson_component_observation (superseded_by_observation_id)
  where superseded_by_observation_id is not null;

-- Draft saves snapshot the visibility of the locked live Component. Legacy
-- rows remain nullable/fail-private, while a correction explicitly carries
-- forward the original at-time value instead of consulting mutable content.
create function public.capture_observation_component_visibility()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_visibility text;
begin
  if tg_op = 'INSERT'
    and new.corrected_from_observation_id is not null
  then
    return new;
  end if;

  if new.lesson_component_id is null then
    if tg_op = 'UPDATE' then
      new.component_visibility_at_time := old.component_visibility_at_time;
    end if;
    return new;
  end if;

  select component.visibility
  into v_visibility
  from public.lesson_component as component
  where component.id = new.lesson_component_id;

  if not found or v_visibility not in ('learner_visible', 'staff_only') then
    raise exception 'lesson_component_observation_visibility_invalid'
      using errcode = '55000';
  end if;

  new.component_visibility_at_time := v_visibility;
  return new;
end
$function$;

revoke all on function public.capture_observation_component_visibility()
from public, anon, authenticated, service_role;
grant execute on function public.capture_observation_component_visibility()
to postgres;

create trigger trg_observation_component_visibility
before insert or update of
  lesson_component_id,
  component_label_at_time,
  observable_criterion_at_time,
  rating,
  entry_method
on public.lesson_component_observation
for each row execute function public.capture_observation_component_visibility();

create table public.learning_evidence (
  id uuid primary key default gen_random_uuid(),
  learner_profile_id uuid not null
    references public.learner_profile(id) on delete restrict,
  recorded_by_account_id uuid not null
    references public.account(id) on delete restrict,
  learning_record_id uuid not null,
  source_observation_id uuid not null unique,
  source_course_id_at_time uuid not null,
  source_lesson_id_at_time uuid not null,
  source_lesson_run_id_at_time uuid not null,
  source_component_id_at_time uuid not null,
  source_learning_objective_id_at_time uuid not null,
  lesson_component_id uuid null
    references public.lesson_component(id) on delete set null,
  learning_objective_id uuid null
    references public.learning_objective(id) on delete set null,
  course_title_at_time text not null,
  lesson_title_at_time text not null,
  subject_at_time text null,
  component_type_at_time text not null,
  component_label_at_time text not null,
  component_visibility_at_time text not null,
  objective_title_at_time text not null,
  criterion_at_time text not null,
  direction text not null,
  support text null,
  observed_at timestamptz not null,
  finalized_at timestamptz not null,
  materialized_at timestamptz not null,
  evidence_version integer not null,
  eligibility_policy_version integer not null,
  reason_code text not null,
  supersedes_evidence_id uuid null,
  superseded_by_evidence_id uuid null,
  created_at timestamptz not null default now(),
  constraint learning_evidence_live_component_check check (
    lesson_component_id is null
    or lesson_component_id = source_component_id_at_time
  ),
  constraint learning_evidence_live_objective_check check (
    learning_objective_id is null
    or learning_objective_id = source_learning_objective_id_at_time
  ),
  constraint learning_evidence_context_bounds_check check (
    char_length(btrim(course_title_at_time)) between 1 and 240
    and char_length(btrim(lesson_title_at_time)) between 1 and 240
    and (
      subject_at_time is null
      or char_length(btrim(subject_at_time)) between 1 and 240
    )
    and char_length(btrim(component_type_at_time)) between 1 and 80
    and char_length(btrim(component_label_at_time)) between 1 and 500
    and component_visibility_at_time in ('learner_visible', 'staff_only')
    and char_length(btrim(objective_title_at_time)) between 1 and 240
    and char_length(btrim(criterion_at_time)) between 1 and 500
  ),
  constraint learning_evidence_version_check check (
    evidence_version = 1 and eligibility_policy_version = 1
  ),
  constraint learning_evidence_semantics_check check (
    (
      direction = 'positive'
      and support = 'independent'
      and reason_code = 'independent_positive_evidence'
    )
    or (
      direction = 'positive'
      and support = 'with_support'
      and reason_code = 'supported_positive_evidence'
    )
    or (
      direction = 'negative'
      and support is null
      and reason_code = 'not_yet_negative_evidence'
    )
  ),
  constraint learning_evidence_time_check check (
    observed_at <= materialized_at
    and finalized_at <= materialized_at
  ),
  constraint learning_evidence_not_self_superseded_check check (
    (supersedes_evidence_id is null or supersedes_evidence_id <> id)
    and (superseded_by_evidence_id is null
      or superseded_by_evidence_id <> id)
  ),
  constraint learning_evidence_supersedes_fkey
    foreign key (supersedes_evidence_id)
    references public.learning_evidence(id)
    on delete no action
    deferrable initially deferred,
  constraint learning_evidence_superseded_by_fkey
    foreign key (superseded_by_evidence_id)
    references public.learning_evidence(id)
    on delete no action
    deferrable initially deferred,
  constraint learning_evidence_record_identity_fkey
    foreign key (
      learning_record_id,
      learner_profile_id,
      recorded_by_account_id
    ) references public.learning_record(
      id,
      learner_profile_id,
      recorded_by_account_id
    ) on update cascade on delete cascade,
  constraint learning_evidence_observation_identity_fkey
    foreign key (
      source_observation_id,
      learning_record_id,
      recorded_by_account_id
    ) references public.lesson_component_observation(
      id,
      learning_record_id,
      recorded_by_account_id
    ) on delete cascade,
  constraint learning_evidence_state_identity_unique unique (
    id,
    recorded_by_account_id,
    learner_profile_id,
    source_course_id_at_time,
    source_learning_objective_id_at_time
  )
);

create index learning_evidence_objective_projection_idx
  on public.learning_evidence (
    recorded_by_account_id,
    learner_profile_id,
    source_course_id_at_time,
    source_learning_objective_id_at_time,
    observed_at desc,
    id desc
  )
  where superseded_by_evidence_id is null;

create index learning_evidence_record_idx
  on public.learning_evidence (learning_record_id, id);

create unique index learning_evidence_supersedes_unique
  on public.learning_evidence (supersedes_evidence_id)
  where supersedes_evidence_id is not null;

create unique index learning_evidence_superseded_by_unique
  on public.learning_evidence (superseded_by_evidence_id)
  where superseded_by_evidence_id is not null;

-- Evidence facts are append-only.  The only supported mutations are explicit
-- supersession during materialization and the canonical learner-id cascade
-- during merge.  Erasure is the sole supported delete path.
create function public.guard_learning_evidence_immutable()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if tg_op = 'DELETE' then
    if coalesce(
      current_setting('app.learner_identity_erasure', true), ''
    ) <> 'on' then
      raise exception 'learning_evidence_immutable'
        using errcode = '55000';
    end if;
    return old;
  end if;

  if (new.id,
      new.recorded_by_account_id,
      new.learning_record_id,
      new.source_observation_id,
      new.source_course_id_at_time,
      new.source_lesson_id_at_time,
      new.source_lesson_run_id_at_time,
      new.source_component_id_at_time,
      new.source_learning_objective_id_at_time,
      new.course_title_at_time,
      new.lesson_title_at_time,
      new.subject_at_time,
      new.component_type_at_time,
      new.component_label_at_time,
      new.component_visibility_at_time,
      new.objective_title_at_time,
      new.criterion_at_time,
      new.direction,
      new.support,
      new.observed_at,
      new.finalized_at,
      new.materialized_at,
      new.evidence_version,
      new.eligibility_policy_version,
      new.reason_code,
      new.supersedes_evidence_id,
      new.created_at)
    is distinct from
      (old.id,
       old.recorded_by_account_id,
       old.learning_record_id,
       old.source_observation_id,
       old.source_course_id_at_time,
       old.source_lesson_id_at_time,
       old.source_lesson_run_id_at_time,
       old.source_component_id_at_time,
       old.source_learning_objective_id_at_time,
       old.course_title_at_time,
       old.lesson_title_at_time,
       old.subject_at_time,
       old.component_type_at_time,
       old.component_label_at_time,
       old.component_visibility_at_time,
       old.objective_title_at_time,
       old.criterion_at_time,
       old.direction,
       old.support,
       old.observed_at,
       old.finalized_at,
       old.materialized_at,
       old.evidence_version,
       old.eligibility_policy_version,
       old.reason_code,
       old.supersedes_evidence_id,
       old.created_at)
  then
    raise exception 'learning_evidence_immutable'
      using errcode = '55000';
  end if;

  -- Live references are deliberately disposable.  Their FK actions may only
  -- clear a reference when the authored Component/Objective is deleted; no
  -- workflow may retarget a fact or resurrect a cleared live reference.
  if new.lesson_component_id is distinct from old.lesson_component_id
    and not (
      old.lesson_component_id is not null
      and new.lesson_component_id is null
    )
  then
    raise exception 'learning_evidence_immutable'
      using errcode = '55000';
  end if;

  if new.learning_objective_id is distinct from old.learning_objective_id
    and not (
      old.learning_objective_id is not null
      and new.learning_objective_id is null
    )
  then
    raise exception 'learning_evidence_immutable'
      using errcode = '55000';
  end if;

  if new.learner_profile_id is distinct from old.learner_profile_id
    and coalesce(
      current_setting('app.learner_identity_merge', true), ''
    ) <> 'on'
  then
    raise exception 'learning_evidence_immutable'
      using errcode = '55000';
  end if;

  if new.superseded_by_evidence_id is distinct from
      old.superseded_by_evidence_id
    and coalesce(
      current_setting('app.learning_activity_materialization', true), ''
    ) <> 'on'
  then
    raise exception 'learning_evidence_immutable'
      using errcode = '55000';
  end if;

  return new;
end
$function$;

revoke all on function public.guard_learning_evidence_immutable()
from public, anon, authenticated, service_role;
grant execute on function public.guard_learning_evidence_immutable()
to postgres;

create trigger trg_learning_evidence_immutable
before update or delete on public.learning_evidence
for each row execute function public.guard_learning_evidence_immutable();

create function public.assert_learning_evidence_supersession_chain()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if new.supersedes_evidence_id is not null
    and not exists (
      select 1
      from public.learning_evidence as prior
      where prior.id = new.supersedes_evidence_id
        and prior.superseded_by_evidence_id = new.id
        and prior.recorded_by_account_id = new.recorded_by_account_id
        and prior.learner_profile_id = new.learner_profile_id
        and prior.source_course_id_at_time = new.source_course_id_at_time
        and prior.source_learning_objective_id_at_time =
          new.source_learning_objective_id_at_time
    )
  then
    raise exception 'learning_evidence_supersession_inconsistent'
      using errcode = '23514';
  end if;

  if new.superseded_by_evidence_id is not null
    and not exists (
      select 1
      from public.learning_evidence as replacement
      where replacement.id = new.superseded_by_evidence_id
        and replacement.supersedes_evidence_id = new.id
        and replacement.recorded_by_account_id = new.recorded_by_account_id
        and replacement.learner_profile_id = new.learner_profile_id
        and replacement.source_course_id_at_time = new.source_course_id_at_time
        and replacement.source_learning_objective_id_at_time =
          new.source_learning_objective_id_at_time
    )
  then
    raise exception 'learning_evidence_supersession_inconsistent'
      using errcode = '23514';
  end if;

  return null;
end
$function$;

revoke all on function public.assert_learning_evidence_supersession_chain()
from public, anon, authenticated, service_role;
grant execute on function public.assert_learning_evidence_supersession_chain()
to postgres;

create constraint trigger trg_learning_evidence_supersession_chain
after insert or update of
  supersedes_evidence_id,
  superseded_by_evidence_id,
  recorded_by_account_id,
  learner_profile_id,
  source_course_id_at_time,
  source_learning_objective_id_at_time
on public.learning_evidence
deferrable initially deferred
for each row execute function public.assert_learning_evidence_supersession_chain();

create table public.learner_objective_state (
  id uuid primary key default gen_random_uuid(),
  recorded_by_account_id uuid not null
    references public.account(id) on delete restrict,
  learner_profile_id uuid not null
    references public.learner_profile(id) on delete restrict,
  learning_objective_id uuid null
    references public.learning_objective(id) on delete set null,
  source_learning_objective_id_at_time uuid not null,
  source_course_id_at_time uuid not null,
  course_title_at_time text not null,
  subject_at_time text null,
  objective_title_at_time text not null,
  status text not null,
  reason_code text not null,
  reason_text text not null,
  policy_version integer not null,
  evaluated_at timestamptz not null,
  last_evidence_at timestamptz not null,
  freshness_due_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint learner_objective_state_key_unique unique (
    recorded_by_account_id,
    learner_profile_id,
    source_course_id_at_time,
    source_learning_objective_id_at_time
  ),
  constraint learner_objective_state_link_identity_unique unique (
    id,
    recorded_by_account_id,
    learner_profile_id,
    source_course_id_at_time,
    source_learning_objective_id_at_time
  ),
  constraint learner_objective_state_live_objective_check check (
    learning_objective_id is null
    or learning_objective_id = source_learning_objective_id_at_time
  ),
  constraint learner_objective_state_context_bounds_check check (
    char_length(btrim(course_title_at_time)) between 1 and 240
    and (
      subject_at_time is null
      or char_length(btrim(subject_at_time)) between 1 and 240
    )
    and char_length(btrim(objective_title_at_time)) between 1 and 240
    and char_length(btrim(reason_text)) between 1 and 1000
  ),
  constraint learner_objective_state_policy_check check (policy_version = 1),
  constraint learner_objective_state_semantics_check check (
    (
      status = 'forming'
      and reason_code in (
        'latest_not_yet',
        'latest_with_support',
        'independent_opportunities_missing'
      )
      and freshness_due_at is null
    )
    or (
      status = 'confirmed'
      and reason_code = 'multiple_independent_opportunities'
      and freshness_due_at = last_evidence_at + interval '90 days'
    )
    or (
      status = 'recheck_due'
      and reason_code = 'confirmed_evidence_stale'
      and freshness_due_at = last_evidence_at + interval '90 days'
      and evaluated_at >= freshness_due_at
    )
  )
);

create index learner_objective_state_learner_idx
  on public.learner_objective_state (
    learner_profile_id,
    evaluated_at desc,
    id
  );

create trigger trg_learner_objective_state_updated_at
before update on public.learner_objective_state
for each row execute function public.set_updated_at();

create table public.learner_objective_state_evidence (
  learner_objective_state_id uuid not null,
  learning_evidence_id uuid not null,
  recorded_by_account_id uuid not null,
  learner_profile_id uuid not null,
  source_course_id_at_time uuid not null,
  source_learning_objective_id_at_time uuid not null,
  position integer not null,
  created_at timestamptz not null default now(),
  primary key (learner_objective_state_id, learning_evidence_id),
  constraint learner_objective_state_evidence_position_unique
    unique (learner_objective_state_id, position),
  constraint learner_objective_state_evidence_position_check
    check (position between 1 and 20),
  constraint learner_objective_state_evidence_state_identity_fkey
    foreign key (
      learner_objective_state_id,
      recorded_by_account_id,
      learner_profile_id,
      source_course_id_at_time,
      source_learning_objective_id_at_time
    ) references public.learner_objective_state(
      id,
      recorded_by_account_id,
      learner_profile_id,
      source_course_id_at_time,
      source_learning_objective_id_at_time
    ) on update cascade on delete cascade,
  constraint learner_objective_state_evidence_fact_identity_fkey
    foreign key (
      learning_evidence_id,
      recorded_by_account_id,
      learner_profile_id,
      source_course_id_at_time,
      source_learning_objective_id_at_time
    ) references public.learning_evidence(
      id,
      recorded_by_account_id,
      learner_profile_id,
      source_course_id_at_time,
      source_learning_objective_id_at_time
    ) on update cascade on delete cascade
);

create table public.learner_recommendation_override (
  id uuid primary key default gen_random_uuid(),
  learner_objective_state_id uuid null unique
    references public.learner_objective_state(id) on delete set null,
  recorded_by_account_id uuid not null
    references public.account(id) on delete restrict,
  learner_profile_id uuid not null
    references public.learner_profile(id) on delete cascade,
  source_course_id_at_time uuid not null,
  source_learning_objective_id_at_time uuid not null,
  action text not null,
  recommendation_type text null,
  private_reason text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint learner_recommendation_override_key_unique unique (
    recorded_by_account_id,
    learner_profile_id,
    source_course_id_at_time,
    source_learning_objective_id_at_time
  ),
  constraint learner_recommendation_override_action_check check (
    (
      action = 'replace'
      and recommendation_type in (
        'repeat',
        'try_without_support',
        'apply_in_new_context',
        'move_forward',
        'recheck_freshness'
      )
    )
    or (action = 'dismiss' and recommendation_type is null)
  ),
  constraint learner_recommendation_override_reason_check check (
    char_length(btrim(private_reason)) between 1 and 500
  )
);

create trigger trg_learner_recommendation_override_updated_at
before update on public.learner_recommendation_override
for each row execute function public.set_updated_at();

alter table public.learning_evidence enable row level security;
alter table public.learner_objective_state enable row level security;
alter table public.learner_objective_state_evidence enable row level security;
alter table public.learner_recommendation_override enable row level security;

create policy learning_evidence_recorder_select
on public.learning_evidence
for select to authenticated
using (recorded_by_account_id = (select public.current_account_id()));

create policy learner_objective_state_recorder_select
on public.learner_objective_state
for select to authenticated
using (recorded_by_account_id = (select public.current_account_id()));

create policy learner_objective_state_evidence_recorder_select
on public.learner_objective_state_evidence
for select to authenticated
using (
  exists (
    select 1
    from public.learner_objective_state as state
    where state.id = learner_objective_state_id
      and state.recorded_by_account_id =
        (select public.current_account_id())
  )
);

create policy learner_recommendation_override_recorder_select
on public.learner_recommendation_override
for select to authenticated
using (recorded_by_account_id = (select public.current_account_id()));

revoke all on table
  public.learning_evidence,
  public.learner_objective_state,
  public.learner_objective_state_evidence,
  public.learner_recommendation_override
from public, anon, authenticated, service_role;

grant all on table
  public.learning_evidence,
  public.learner_objective_state,
  public.learner_objective_state_evidence,
  public.learner_recommendation_override
to postgres;

grant select on table
  public.learning_evidence,
  public.learner_objective_state,
  public.learner_objective_state_evidence,
  public.learner_recommendation_override
to authenticated;

-- Every workflow which can change the evidence set takes these advisory locks
-- before its authoritative row locks.  UUID order is the one global order
-- shared by completion, correction, rebuild, merge and erasure.
create function public.lock_learning_activity_learners(
  p_learner_profile_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_learner_profile_id uuid;
begin
  if p_learner_profile_ids is null
    or array_position(p_learner_profile_ids, null) is not null
  then
    raise exception 'learning_activity_learner_lock_invalid'
      using errcode = '22023';
  end if;

  for v_learner_profile_id in
    select distinct submitted.id
    from unnest(p_learner_profile_ids) as submitted(id)
    order by submitted.id
  loop
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(
        'shidao-learning-activity-v1:' || v_learner_profile_id::text,
        0
      )
    );
  end loop;
end
$function$;

revoke all on function public.lock_learning_activity_learners(uuid[])
from public, anon, authenticated, service_role;
grant execute on function public.lock_learning_activity_learners(uuid[])
to postgres;

create function public.learning_activity_scope_fingerprint(
  p_learner_profile_ids uuid[]
)
returns bytea
language sql
stable
security definer
set search_path = ''
as $function$
  with profiles as materialized (
    select distinct submitted.id
    from unnest(coalesce(p_learner_profile_ids, '{}'::uuid[]))
      as submitted(id)
    where submitted.id is not null
  ), entries as (
    select 'record:' || record.id::text || ':'
      || record.learner_profile_id::text || ':'
      || coalesce(record.lesson_run_id::text, '-') || ':'
      || coalesce(record.superseded_by_record_id::text, '-') || ':'
      || coalesce(record.corrected_from_record_id::text, '-') || ':'
      || record.updated_at::text as entry
    from public.learning_record as record
    join profiles on profiles.id = record.learner_profile_id
    union all
    select 'observation:' || observation.id::text || ':'
      || observation.learning_record_id::text || ':'
      || coalesce(observation.superseded_by_observation_id::text, '-') || ':'
      || coalesce(observation.corrected_from_observation_id::text, '-') || ':'
      || observation.updated_at::text
    from public.lesson_component_observation as observation
    join public.learning_record as record
      on record.id = observation.learning_record_id
    join profiles on profiles.id = record.learner_profile_id
    union all
    select 'evidence:' || evidence.id::text || ':'
      || evidence.learner_profile_id::text || ':'
      || coalesce(evidence.superseded_by_evidence_id::text, '-') || ':'
      || coalesce(evidence.supersedes_evidence_id::text, '-')
    from public.learning_evidence as evidence
    join profiles on profiles.id = evidence.learner_profile_id
    union all
    select 'state:' || state.id::text || ':'
      || state.learner_profile_id::text || ':'
      || state.source_course_id_at_time::text || ':'
      || state.source_learning_objective_id_at_time::text || ':'
      || state.policy_version::text || ':' || state.updated_at::text
    from public.learner_objective_state as state
    join profiles on profiles.id = state.learner_profile_id
    union all
    select 'override:' || override_row.id::text || ':'
      || override_row.learner_profile_id::text || ':'
      || override_row.source_course_id_at_time::text || ':'
      || override_row.source_learning_objective_id_at_time::text || ':'
      || override_row.action || ':'
      || coalesce(override_row.recommendation_type, '-') || ':'
      || override_row.updated_at::text
    from public.learner_recommendation_override as override_row
    join profiles on profiles.id = override_row.learner_profile_id
  )
  select extensions.digest(
    coalesce(string_agg(entries.entry, E'\n' order by entries.entry), ''),
    'sha256'
  )
  from entries;
$function$;

revoke all on function public.learning_activity_scope_fingerprint(uuid[])
from public, anon, authenticated, service_role;
grant execute on function public.learning_activity_scope_fingerprint(uuid[])
to postgres;

create function public.capture_merge_learning_activity_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if new.preview_fingerprint is null then
    new.learning_activity_scope_fingerprint := null;
  else
    new.learning_activity_scope_fingerprint :=
      public.learning_activity_scope_fingerprint(array[
        new.source_learner_profile_id,
        new.target_learner_profile_id
      ]);
  end if;
  return new;
end
$function$;

revoke all on function public.capture_merge_learning_activity_scope()
from public, anon, authenticated, service_role;
grant execute on function public.capture_merge_learning_activity_scope()
to postgres;

create trigger trg_learner_profile_merge_learning_activity_scope
before insert or update of
  preview_fingerprint,
  source_learner_profile_id,
  target_learner_profile_id
on public.learner_profile_merge
for each row execute function public.capture_merge_learning_activity_scope();

create function public.capture_erasure_learning_activity_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_lineage_ids uuid[];
begin
  if new.preview_fingerprint is null then
    new.learning_activity_scope_fingerprint := null;
  else
    select array_agg(lineage.id order by lineage.id)
    into v_lineage_ids
    from (
      select new.current_learner_profile_id as id
      union
      select alias.source_learner_profile_id
      from public.learner_profile_alias as alias
      where alias.target_learner_profile_id =
        new.current_learner_profile_id
    ) as lineage;
    new.learning_activity_scope_fingerprint :=
      public.learning_activity_scope_fingerprint(v_lineage_ids);
  end if;
  return new;
end
$function$;

revoke all on function public.capture_erasure_learning_activity_scope()
from public, anon, authenticated, service_role;
grant execute on function public.capture_erasure_learning_activity_scope()
to postgres;

create trigger trg_learner_erasure_learning_activity_scope
before insert or update of
  preview_fingerprint,
  current_learner_profile_id
on public.learner_erasure_request
for each row execute function public.capture_erasure_learning_activity_scope();

-- Bind any still-open pre-migration preview to the current LA-M3-empty scope.
update public.learner_profile_merge
set preview_fingerprint = preview_fingerprint
where preview_fingerprint is not null;

update public.learner_erasure_request
set preview_fingerprint = preview_fingerprint
where preview_fingerprint is not null
  and consumed_at is null;

create function public.materialize_learning_evidence_for_records(
  p_learning_record_ids uuid[],
  p_materialized_at timestamptz default clock_timestamp()
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if p_learning_record_ids is null
    or p_materialized_at is null
    or array_position(p_learning_record_ids, null) is not null
  then
    raise exception 'learning_evidence_materialization_invalid'
      using errcode = '22023';
  end if;

  if cardinality(p_learning_record_ids) = 0 then
    return;
  end if;

  perform set_config(
    'app.learning_activity_materialization',
    'on',
    true
  );

  insert into public.learning_evidence (
    learner_profile_id,
    recorded_by_account_id,
    learning_record_id,
    source_observation_id,
    source_course_id_at_time,
    source_lesson_id_at_time,
    source_lesson_run_id_at_time,
    source_component_id_at_time,
    source_learning_objective_id_at_time,
    lesson_component_id,
    learning_objective_id,
    course_title_at_time,
    lesson_title_at_time,
    subject_at_time,
    component_type_at_time,
    component_label_at_time,
    component_visibility_at_time,
    objective_title_at_time,
    criterion_at_time,
    direction,
    support,
    observed_at,
    finalized_at,
    materialized_at,
    evidence_version,
    eligibility_policy_version,
    reason_code,
    supersedes_evidence_id
  )
  select
    record.learner_profile_id,
    record.recorded_by_account_id,
    record.id,
    observation.id,
    record.source_course_id_at_time,
    record.source_lesson_id_at_time,
    record.source_lesson_run_id_at_time,
    observation.source_lesson_component_id_at_time,
    observation.source_learning_objective_id_at_time,
    observation.lesson_component_id,
    observation.learning_objective_id,
    btrim(record.course_title_at_time),
    btrim(record.lesson_title_at_time),
    nullif(btrim(record.subject_at_time), ''),
    btrim(observation.component_type_key_at_time),
    btrim(observation.component_label_at_time),
    case when observation.component_visibility_at_time = 'learner_visible'
      then 'learner_visible' else 'staff_only' end,
    btrim(observation.learning_objective_title_at_time),
    btrim(observation.observable_criterion_at_time),
    case when observation.rating = 'not_yet'
      then 'negative' else 'positive' end,
    case observation.rating
      when 'independent' then 'independent'
      when 'with_support' then 'with_support'
      else null
    end,
    observation.observed_at,
    record.occurred_at,
    greatest(
      p_materialized_at,
      observation.observed_at,
      record.occurred_at
    ),
    1,
    1,
    case observation.rating
      when 'independent' then 'independent_positive_evidence'
      when 'with_support' then 'supported_positive_evidence'
      else 'not_yet_negative_evidence'
    end,
    prior_evidence.id
  from public.learning_record as record
  join public.lesson_component_observation as observation
    on observation.learning_record_id = record.id
   and observation.recorded_by_account_id = record.recorded_by_account_id
  left join public.learning_evidence as prior_evidence
    on prior_evidence.source_observation_id =
      observation.corrected_from_observation_id
  where record.id = any(p_learning_record_ids)
    and record.occurred_at is not null
    and record.was_present
    and record.superseded_by_record_id is null
    and observation.superseded_by_observation_id is null
    and record.source_course_id_at_time is not null
    and record.source_lesson_id_at_time is not null
    and record.source_lesson_run_id_at_time is not null
    and record.course_title_at_time is not null
    and char_length(btrim(record.course_title_at_time)) between 1 and 240
    and record.lesson_title_at_time is not null
    and char_length(btrim(record.lesson_title_at_time)) between 1 and 240
    and (
      record.subject_at_time is null
      or char_length(btrim(record.subject_at_time)) between 1 and 240
    )
    and observation.source_learning_objective_id_at_time is not null
    and observation.learning_objective_title_at_time is not null
    and char_length(
      btrim(observation.learning_objective_title_at_time)
    ) between 1 and 240
    and char_length(
      btrim(observation.observable_criterion_at_time)
    ) between 1 and 500
    and observation.entry_method in ('direct', 'bulk_confirmed')
    and observation.rating in ('independent', 'with_support', 'not_yet')
  order by record.id, observation.id
  on conflict (source_observation_id) do nothing;

  update public.learning_evidence as old_evidence
  set superseded_by_evidence_id = new_evidence.id
  from public.learning_evidence as new_evidence
  where new_evidence.learning_record_id = any(p_learning_record_ids)
    and new_evidence.supersedes_evidence_id = old_evidence.id
    and old_evidence.superseded_by_evidence_id is distinct from new_evidence.id;
end
$function$;

revoke all on function public.materialize_learning_evidence_for_records(
  uuid[], timestamptz
) from public, anon, authenticated, service_role;
grant execute on function public.materialize_learning_evidence_for_records(
  uuid[], timestamptz
) to postgres;

create function public.rebuild_learner_objective_state_for_actor(
  p_recorded_by_account_id uuid,
  p_learner_profile_id uuid,
  p_source_learning_objective_id_at_time uuid,
  p_as_of timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_latest public.learning_evidence%rowtype;
  v_independent_run_count integer;
  v_status text;
  v_reason_code text;
  v_reason_text text;
  v_freshness_due_at timestamptz;
  v_state_id uuid;
  v_evidence_ids uuid[];
  v_current_evidence_ids uuid[];
begin
  if p_recorded_by_account_id is null
    or p_learner_profile_id is null
    or p_source_learning_objective_id_at_time is null
    or p_as_of is null
  then
    raise exception 'learner_objective_state_rebuild_invalid'
      using errcode = '22023';
  end if;

  perform public.lock_learning_activity_learners(
    array[p_learner_profile_id]
  );

  perform 1
  from public.learner_profile as profile
  where profile.id = p_learner_profile_id
  for update of profile;

  if not found then
    delete from public.learner_objective_state as state
    where state.recorded_by_account_id = p_recorded_by_account_id
      and state.learner_profile_id = p_learner_profile_id
      and state.source_learning_objective_id_at_time =
        p_source_learning_objective_id_at_time;
    return null;
  end if;

  select evidence.*
  into v_latest
  from public.learning_evidence as evidence
  join public.learning_record as record
    on record.id = evidence.learning_record_id
   and record.recorded_by_account_id = evidence.recorded_by_account_id
  where evidence.recorded_by_account_id = p_recorded_by_account_id
    and evidence.learner_profile_id = p_learner_profile_id
    and evidence.source_learning_objective_id_at_time =
      p_source_learning_objective_id_at_time
    and evidence.superseded_by_evidence_id is null
    and record.occurred_at is not null
    and record.superseded_by_record_id is null
  order by evidence.observed_at desc, evidence.id desc
  limit 1;

  if not found then
    delete from public.learner_objective_state as state
    where state.recorded_by_account_id = p_recorded_by_account_id
      and state.learner_profile_id = p_learner_profile_id
      and state.source_learning_objective_id_at_time =
        p_source_learning_objective_id_at_time;
    return null;
  end if;

  select count(distinct evidence.source_lesson_run_id_at_time)
  into v_independent_run_count
  from public.learning_evidence as evidence
  join public.learning_record as record
    on record.id = evidence.learning_record_id
   and record.recorded_by_account_id = evidence.recorded_by_account_id
  where evidence.recorded_by_account_id = p_recorded_by_account_id
    and evidence.learner_profile_id = p_learner_profile_id
    and evidence.source_learning_objective_id_at_time =
      p_source_learning_objective_id_at_time
    and evidence.superseded_by_evidence_id is null
    and record.superseded_by_record_id is null
    and evidence.direction = 'positive'
    and evidence.support = 'independent';

  if v_latest.direction = 'negative' then
    v_status := 'forming';
    v_reason_code := 'latest_not_yet';
    v_reason_text :=
      'В последнем наблюдении пока не получилось — навык ещё формируется.';
    v_freshness_due_at := null;
    v_evidence_ids := array[v_latest.id];
  elsif v_latest.support = 'with_support' then
    v_status := 'forming';
    v_reason_code := 'latest_with_support';
    v_reason_text :=
      'В последнем наблюдении получилось с поддержкой — навык ещё формируется.';
    v_freshness_due_at := null;
    v_evidence_ids := array[v_latest.id];
  elsif v_independent_run_count < 2 then
    v_status := 'forming';
    v_reason_code := 'independent_opportunities_missing';
    v_reason_text :=
      'Есть самостоятельное выполнение, но нужно подтверждение в другом занятии.';
    v_freshness_due_at := null;
    v_evidence_ids := array[v_latest.id];
  else
    v_freshness_due_at := v_latest.observed_at + interval '90 days';
    if p_as_of >= v_freshness_due_at then
      v_status := 'recheck_due';
      v_reason_code := 'confirmed_evidence_stale';
      v_reason_text :=
        'Подтверждение навыка устарело по сроку свежести — его пора перепроверить.';
    else
      v_status := 'confirmed';
      v_reason_code := 'multiple_independent_opportunities';
      v_reason_text :=
        'Навык подтверждён самостоятельными наблюдениями в разных занятиях.';
    end if;

    select array_agg(
      selected.id order by selected.observed_at desc, selected.id desc
    )
    into v_evidence_ids
    from (
      select per_run.id, per_run.observed_at
      from (
        select distinct on (evidence.source_lesson_run_id_at_time)
          evidence.id,
          evidence.observed_at,
          evidence.source_lesson_run_id_at_time
        from public.learning_evidence as evidence
        join public.learning_record as record
          on record.id = evidence.learning_record_id
         and record.recorded_by_account_id = evidence.recorded_by_account_id
        where evidence.recorded_by_account_id = p_recorded_by_account_id
          and evidence.learner_profile_id = p_learner_profile_id
          and evidence.source_learning_objective_id_at_time =
            p_source_learning_objective_id_at_time
          and evidence.superseded_by_evidence_id is null
          and record.superseded_by_record_id is null
          and evidence.direction = 'positive'
          and evidence.support = 'independent'
        order by
          evidence.source_lesson_run_id_at_time,
          evidence.observed_at desc,
          evidence.id desc
      ) as per_run
      order by per_run.observed_at desc, per_run.id desc
      limit 2
    ) as selected
    ;
  end if;

  insert into public.learner_objective_state (
    recorded_by_account_id,
    learner_profile_id,
    learning_objective_id,
    source_learning_objective_id_at_time,
    source_course_id_at_time,
    course_title_at_time,
    subject_at_time,
    objective_title_at_time,
    status,
    reason_code,
    reason_text,
    policy_version,
    evaluated_at,
    last_evidence_at,
    freshness_due_at
  ) values (
    p_recorded_by_account_id,
    p_learner_profile_id,
    v_latest.learning_objective_id,
    v_latest.source_learning_objective_id_at_time,
    v_latest.source_course_id_at_time,
    v_latest.course_title_at_time,
    v_latest.subject_at_time,
    v_latest.objective_title_at_time,
    v_status,
    v_reason_code,
    v_reason_text,
    1,
    p_as_of,
    v_latest.observed_at,
    v_freshness_due_at
  )
  on conflict (
    recorded_by_account_id,
    learner_profile_id,
    source_course_id_at_time,
    source_learning_objective_id_at_time
  ) do update
  set learning_objective_id = excluded.learning_objective_id,
      course_title_at_time = excluded.course_title_at_time,
      subject_at_time = excluded.subject_at_time,
      objective_title_at_time = excluded.objective_title_at_time,
      status = excluded.status,
      reason_code = excluded.reason_code,
      reason_text = excluded.reason_text,
      policy_version = excluded.policy_version,
      evaluated_at = excluded.evaluated_at,
      last_evidence_at = excluded.last_evidence_at,
      freshness_due_at = excluded.freshness_due_at
  where (
    learner_objective_state.learning_objective_id,
    learner_objective_state.course_title_at_time,
    learner_objective_state.subject_at_time,
    learner_objective_state.objective_title_at_time,
    learner_objective_state.status,
      learner_objective_state.reason_code,
      learner_objective_state.reason_text,
      learner_objective_state.policy_version,
      learner_objective_state.last_evidence_at,
      learner_objective_state.freshness_due_at
  ) is distinct from (
    excluded.learning_objective_id,
    excluded.course_title_at_time,
    excluded.subject_at_time,
    excluded.objective_title_at_time,
    excluded.status,
      excluded.reason_code,
      excluded.reason_text,
      excluded.policy_version,
      excluded.last_evidence_at,
      excluded.freshness_due_at
  )
  returning id into v_state_id;

  if v_state_id is null then
    select state.id
    into v_state_id
    from public.learner_objective_state as state
    where state.recorded_by_account_id = p_recorded_by_account_id
      and state.learner_profile_id = p_learner_profile_id
      and state.source_course_id_at_time =
        v_latest.source_course_id_at_time
      and state.source_learning_objective_id_at_time =
        p_source_learning_objective_id_at_time
    for update of state;
  end if;

  select array_agg(link.learning_evidence_id order by link.position)
  into v_current_evidence_ids
  from public.learner_objective_state_evidence as link
  where link.learner_objective_state_id = v_state_id;

  if coalesce(v_current_evidence_ids, '{}'::uuid[])
    is distinct from coalesce(v_evidence_ids, '{}'::uuid[])
  then
    update public.learner_objective_state as state
    set evaluated_at = p_as_of
    where state.id = v_state_id
      and state.evaluated_at is distinct from p_as_of;

    delete from public.learner_objective_state_evidence as link
    where link.learner_objective_state_id = v_state_id;

    insert into public.learner_objective_state_evidence (
      learner_objective_state_id,
      learning_evidence_id,
      recorded_by_account_id,
      learner_profile_id,
      source_course_id_at_time,
      source_learning_objective_id_at_time,
      position
    )
    select
      v_state_id,
      submitted.id,
      p_recorded_by_account_id,
      p_learner_profile_id,
      v_latest.source_course_id_at_time,
      p_source_learning_objective_id_at_time,
      submitted.position::integer
    from unnest(v_evidence_ids) with ordinality as submitted(id, position)
    order by submitted.position;
  end if;

  update public.learner_recommendation_override as override_row
  set learner_objective_state_id = v_state_id
  where override_row.recorded_by_account_id = p_recorded_by_account_id
    and override_row.learner_profile_id = p_learner_profile_id
    and override_row.source_course_id_at_time =
      v_latest.source_course_id_at_time
    and override_row.source_learning_objective_id_at_time =
      p_source_learning_objective_id_at_time
    and override_row.learner_objective_state_id is distinct from v_state_id;

  return v_state_id;
end
$function$;

revoke all on function public.rebuild_learner_objective_state_for_actor(
  uuid, uuid, uuid, timestamptz
) from public, anon, authenticated, service_role;
grant execute on function public.rebuild_learner_objective_state_for_actor(
  uuid, uuid, uuid, timestamptz
) to postgres;

create function public.rebuild_learner_objective_states(
  p_learner_profile_id uuid,
  p_source_learning_objective_id_at_time uuid,
  p_as_of timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor_account_id uuid := public.current_account_id();
  v_state_id uuid;
  v_as_of timestamptz := clock_timestamp();
begin
  if v_actor_account_id is null
    or p_learner_profile_id is null
    or p_source_learning_objective_id_at_time is null
    or p_as_of is null
  then
    raise exception 'learner_objective_state_not_found'
      using errcode = 'P0002';
  end if;

  if not exists (
    select 1
    from public.teacher_learner as relation
    where relation.teacher_account_id = v_actor_account_id
      and relation.learner_profile_id = p_learner_profile_id
  ) then
    raise exception 'learner_objective_state_not_found'
      using errcode = 'P0002';
  end if;

  v_state_id := public.rebuild_learner_objective_state_for_actor(
    v_actor_account_id,
    p_learner_profile_id,
    p_source_learning_objective_id_at_time,
    v_as_of
  );

  return jsonb_build_object(
    'rebuilt', true,
    'stateId', v_state_id,
    'policyVersion', 1,
    'evaluatedAt', v_as_of
  );
end
$function$;

revoke all on function public.rebuild_learner_objective_states(
  uuid, uuid, timestamptz
) from public, anon, authenticated, service_role;
grant execute on function public.rebuild_learner_objective_states(
  uuid, uuid, timestamptz
) to postgres;

create function public.set_learner_recommendation_override(
  p_learner_profile_id uuid,
  p_source_learning_objective_id_at_time uuid,
  p_action text,
  p_recommendation_type text,
  p_private_reason text,
  p_expected_state_updated_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor_account_id uuid := public.current_account_id();
  v_state public.learner_objective_state%rowtype;
  v_updated_at timestamptz := clock_timestamp();
  v_persisted_updated_at timestamptz;
begin
  if v_actor_account_id is null
    or p_learner_profile_id is null
    or p_source_learning_objective_id_at_time is null
    or p_action not in ('replace', 'dismiss', 'clear')
    or p_expected_state_updated_at is null
    or (
      p_action = 'replace'
      and (
        p_recommendation_type not in (
          'repeat',
          'try_without_support',
          'apply_in_new_context',
          'move_forward',
          'recheck_freshness'
        )
        or p_private_reason is null
        or char_length(btrim(p_private_reason)) not between 1 and 500
      )
    )
    or (
      p_action = 'dismiss'
      and (
        p_recommendation_type is not null
        or p_private_reason is null
        or char_length(btrim(p_private_reason)) not between 1 and 500
      )
    )
    or (
      p_action = 'clear'
      and (p_recommendation_type is not null or p_private_reason is not null)
    )
  then
    raise exception 'learner_recommendation_override_invalid'
      using errcode = '22023';
  end if;

  perform public.lock_learning_activity_learners(
    array[p_learner_profile_id]
  );

  if not exists (
    select 1
    from public.teacher_learner as relation
    where relation.teacher_account_id = v_actor_account_id
      and relation.learner_profile_id = p_learner_profile_id
  ) then
    raise exception 'learner_recommendation_override_not_found'
      using errcode = 'P0002';
  end if;

  select state.*
  into v_state
  from public.learner_objective_state as state
  where state.recorded_by_account_id = v_actor_account_id
    and state.learner_profile_id = p_learner_profile_id
    and state.source_learning_objective_id_at_time =
      p_source_learning_objective_id_at_time
    -- The rolling client calls this token `updatedAt`, while the public
    -- teacher DTO exposes it as `evaluatedAt`.  Rebuild changes the token only
    -- when status/reason/evidence membership changes, including freshness.
    and state.evaluated_at = p_expected_state_updated_at
  for update of state;

  if not found then
    raise exception 'learner_recommendation_override_state_changed'
      using errcode = '40001';
  end if;

  if p_action = 'clear' then
    delete from public.learner_recommendation_override as override_row
    where override_row.learner_objective_state_id = v_state.id
      and override_row.recorded_by_account_id = v_actor_account_id;
  else
    insert into public.learner_recommendation_override (
      learner_objective_state_id,
      recorded_by_account_id,
      learner_profile_id,
      source_course_id_at_time,
      source_learning_objective_id_at_time,
      action,
      recommendation_type,
      private_reason
    ) values (
      v_state.id,
      v_actor_account_id,
      v_state.learner_profile_id,
      v_state.source_course_id_at_time,
      v_state.source_learning_objective_id_at_time,
      p_action,
      p_recommendation_type,
      btrim(p_private_reason)
    )
    on conflict (
      recorded_by_account_id,
      learner_profile_id,
      source_course_id_at_time,
      source_learning_objective_id_at_time
    ) do update
    set learner_objective_state_id = excluded.learner_objective_state_id,
        action = excluded.action,
        recommendation_type = excluded.recommendation_type,
        private_reason = excluded.private_reason,
        recorded_by_account_id = excluded.recorded_by_account_id,
        learner_profile_id = excluded.learner_profile_id,
        source_course_id_at_time = excluded.source_course_id_at_time,
        source_learning_objective_id_at_time =
          excluded.source_learning_objective_id_at_time,
        updated_at = v_updated_at
    returning learner_recommendation_override.updated_at
    into v_persisted_updated_at;
  end if;

  return jsonb_build_object(
    'action', p_action,
    'stateId', v_state.id,
    'updatedAt', coalesce(v_persisted_updated_at, v_updated_at)
  );
end
$function$;

revoke all on function public.set_learner_recommendation_override(
  uuid, uuid, text, text, text, timestamptz
) from public, anon, authenticated, service_role;
grant execute on function public.set_learner_recommendation_override(
  uuid, uuid, text, text, text, timestamptz
) to postgres, authenticated;

create function public.correct_finalized_lesson_component_observation(
  p_observation_id uuid,
  p_learner_profile_id uuid,
  p_expected_learning_record_id uuid,
  p_rating text,
  p_private_note text,
  p_correction_reason text,
  p_idempotency_key uuid,
  p_corrected_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor_user_id uuid := (select auth.uid());
  v_actor_account_id uuid;
  v_source_record public.learning_record%rowtype;
  v_source_observation public.lesson_component_observation%rowtype;
  v_old_observation public.lesson_component_observation%rowtype;
  v_new_record_id uuid := gen_random_uuid();
  v_new_observation_id uuid;
  v_candidate_observation_id uuid;
  v_replay_record_id uuid;
  v_replay_observation_id uuid;
  v_replay_record public.learning_record%rowtype;
  v_replay_observation public.lesson_component_observation%rowtype;
  v_objective_id uuid;
  -- p_corrected_at remains in the rolling application signature, but is not
  -- authoritative.  Direct PostgREST callers cannot backdate or future-date
  -- durable history; the database linearizes the correction itself.
  v_corrected_at timestamptz := clock_timestamp();
begin
  if v_actor_user_id is null
    or p_observation_id is null
    or p_learner_profile_id is null
    or p_expected_learning_record_id is null
    or p_rating not in ('independent', 'with_support', 'not_yet')
    or (
      p_private_note is not null
      and (
        btrim(p_private_note) = ''
        or char_length(btrim(p_private_note)) > 500
      )
    )
    or p_correction_reason is null
    or char_length(btrim(p_correction_reason)) not between 1 and 500
    or p_idempotency_key is null
    or p_corrected_at is null
  then
    raise exception 'finalized_observation_correction_invalid'
      using errcode = '22023';
  end if;

  select account.id
  into v_actor_account_id
  from public.account as account
  where account.auth_user_id = v_actor_user_id;

  if not found then
    raise exception 'finalized_observation_not_found'
      using errcode = 'P0002';
  end if;

  select replacement.*
  into v_replay_record
  from public.learning_record as replacement
  where replacement.recorded_by_account_id = v_actor_account_id
    and replacement.correction_idempotency_key = p_idempotency_key
  limit 1;

  if found then
    select replacement_observation.*
    into v_replay_observation
    from public.lesson_component_observation as replacement_observation
    where replacement_observation.learning_record_id = v_replay_record.id
      and replacement_observation.corrected_from_observation_id =
        p_observation_id
    limit 1;
    if not found
      or v_replay_record.corrected_from_record_id is distinct from
        p_expected_learning_record_id
      or v_replay_record.learner_profile_id is distinct from
        p_learner_profile_id
      or v_replay_record.correction_reason is distinct from
        btrim(p_correction_reason)
      or v_replay_observation.rating is distinct from p_rating
      or v_replay_observation.private_note is distinct from
        nullif(btrim(p_private_note), '')
    then
      raise exception 'correction_idempotency_conflict'
        using errcode = '23505';
    end if;
    v_replay_record_id := v_replay_record.id;
    v_replay_observation_id := v_replay_observation.id;
    return jsonb_build_object(
      'idempotencyKey', p_idempotency_key,
      'newLearningRecordId', v_replay_record_id,
      'newObservationId', v_replay_observation_id,
      'correctedAt', (
        select record.corrected_at
        from public.learning_record as record
        where record.id = v_replay_record_id
      ),
      'replayed', true
    );
  end if;

  -- Discovery is read-only.  The profile advisory lock is acquired before any
  -- authoritative row lock and all values are re-read below.
  select record.*
  into v_source_record
  from public.lesson_component_observation as observation
  join public.learning_record as record
    on record.id = observation.learning_record_id
   and record.recorded_by_account_id = observation.recorded_by_account_id
  where observation.id = p_observation_id
    and record.id = p_expected_learning_record_id
    and record.learner_profile_id = p_learner_profile_id
    and record.recorded_by_account_id = v_actor_account_id
    and record.occurred_at is not null
    and record.superseded_by_record_id is null;

  if not found then
    raise exception 'finalized_observation_not_found'
      using errcode = 'P0002';
  end if;

  select observation.*
  into v_source_observation
  from public.lesson_component_observation as observation
  where observation.id = p_observation_id
    and observation.learning_record_id = v_source_record.id
    and observation.recorded_by_account_id = v_actor_account_id;
  if not found then
    raise exception 'finalized_observation_not_found'
      using errcode = 'P0002';
  end if;

  perform public.lock_learning_activity_learners(
    array[v_source_record.learner_profile_id]
  );

  perform 1
  from public.learner_profile as profile
  where profile.id = v_source_record.learner_profile_id
  for update of profile;

  if not found or not exists (
    select 1
    from public.teacher_learner as relation
    where relation.teacher_account_id = v_actor_account_id
      and relation.learner_profile_id = v_source_record.learner_profile_id
  ) then
    raise exception 'finalized_observation_not_found'
      using errcode = 'P0002';
  end if;

  -- A concurrent retry may have committed while this transaction waited for
  -- the shared learner lock.
  select replacement.*
  into v_replay_record
  from public.learning_record as replacement
  where replacement.recorded_by_account_id = v_actor_account_id
    and replacement.correction_idempotency_key = p_idempotency_key
  limit 1;

  if found then
    select replacement_observation.*
    into v_replay_observation
    from public.lesson_component_observation as replacement_observation
    where replacement_observation.learning_record_id = v_replay_record.id
      and replacement_observation.corrected_from_observation_id =
        p_observation_id
    limit 1;
    if not found
      or v_replay_record.corrected_from_record_id is distinct from
        p_expected_learning_record_id
      or v_replay_record.learner_profile_id is distinct from
        p_learner_profile_id
      or v_replay_record.correction_reason is distinct from
        btrim(p_correction_reason)
      or v_replay_observation.rating is distinct from p_rating
      or v_replay_observation.private_note is distinct from
        nullif(btrim(p_private_note), '')
    then
      raise exception 'correction_idempotency_conflict'
        using errcode = '23505';
    end if;
    v_replay_record_id := v_replay_record.id;
    v_replay_observation_id := v_replay_observation.id;
    return jsonb_build_object(
      'idempotencyKey', p_idempotency_key,
      'newLearningRecordId', v_replay_record_id,
      'newObservationId', v_replay_observation_id,
      'correctedAt', (
        select record.corrected_at
        from public.learning_record as record
        where record.id = v_replay_record_id
      ),
      'replayed', true
    );
  end if;

  select record.*
  into v_source_record
  from public.learning_record as record
  where record.id = p_expected_learning_record_id
    and record.recorded_by_account_id = v_actor_account_id
    and record.learner_profile_id = p_learner_profile_id
    and record.occurred_at is not null
    and record.superseded_by_record_id is null
  for update of record;

  if not found then
    raise exception 'finalized_observation_changed'
      using errcode = '40001';
  end if;

  perform observation.id
  from public.lesson_component_observation as observation
  where observation.learning_record_id = v_source_record.id
    and observation.recorded_by_account_id = v_actor_account_id
  order by observation.id
  for update of observation;

  select observation.*
  into v_source_observation
  from public.lesson_component_observation as observation
  where observation.id = p_observation_id
    and observation.learning_record_id = v_source_record.id
    and observation.superseded_by_observation_id is null;

  if not found then
    raise exception 'finalized_observation_changed'
      using errcode = '40001';
  end if;

  if p_rating is not distinct from v_source_observation.rating
    and nullif(btrim(p_private_note), '') is not distinct from
      v_source_observation.private_note
  then
    raise exception 'learning_observation_correction_no_change'
      using errcode = '22023';
  end if;

  -- The self-FK is deferred.  Marking the source first removes it from the
  -- active partial Run+learner key without detaching the stable Run chain.
  update public.learning_record as record
  set superseded_by_record_id = v_new_record_id
  where record.id = v_source_record.id;

  insert into public.learning_record (
    id,
    learner_profile_id,
    recorded_by_account_id,
    lesson_run_id,
    source_course_id,
    source_lesson_id,
    source_course_id_at_time,
    source_lesson_id_at_time,
    source_lesson_run_id_at_time,
    occurred_at,
    was_present,
    needs_repeat,
    teacher_comment,
    shared_with_learner_at,
    actual_duration_minutes_at_time,
    course_title_at_time,
    lesson_title_at_time,
    subject_at_time,
    corrected_from_record_id,
    correction_reason,
    correction_idempotency_key,
    corrected_at
  ) values (
    v_new_record_id,
    v_source_record.learner_profile_id,
    v_source_record.recorded_by_account_id,
    v_source_record.lesson_run_id,
    v_source_record.source_course_id,
    v_source_record.source_lesson_id,
    v_source_record.source_course_id_at_time,
    v_source_record.source_lesson_id_at_time,
    v_source_record.source_lesson_run_id_at_time,
    v_source_record.occurred_at,
    v_source_record.was_present,
    v_source_record.needs_repeat,
    v_source_record.teacher_comment,
    v_source_record.shared_with_learner_at,
    v_source_record.actual_duration_minutes_at_time,
    v_source_record.course_title_at_time,
    v_source_record.lesson_title_at_time,
    v_source_record.subject_at_time,
    v_source_record.id,
    btrim(p_correction_reason),
    p_idempotency_key,
    v_corrected_at
  );

  for v_old_observation in
    select observation.*
    from public.lesson_component_observation as observation
    where observation.learning_record_id = v_source_record.id
      and observation.recorded_by_account_id = v_actor_account_id
    order by observation.id
  loop
    v_candidate_observation_id := gen_random_uuid();

    update public.lesson_component_observation as observation
    set superseded_by_observation_id = v_candidate_observation_id
    where observation.id = v_old_observation.id;

    insert into public.lesson_component_observation (
      id,
      learning_record_id,
      lesson_component_id,
      source_lesson_component_id_at_time,
      learning_objective_id,
      source_learning_objective_id_at_time,
      learning_objective_title_at_time,
      component_position_at_time,
      component_type_key_at_time,
      component_label_at_time,
      component_visibility_at_time,
      observable_criterion_at_time,
      rating,
      entry_method,
      private_note,
      observed_at,
      recorded_by_account_id,
      corrected_from_observation_id
    ) values (
      v_candidate_observation_id,
      v_new_record_id,
      v_old_observation.lesson_component_id,
      v_old_observation.source_lesson_component_id_at_time,
      v_old_observation.learning_objective_id,
      v_old_observation.source_learning_objective_id_at_time,
      v_old_observation.learning_objective_title_at_time,
      v_old_observation.component_position_at_time,
      v_old_observation.component_type_key_at_time,
      v_old_observation.component_label_at_time,
      v_old_observation.component_visibility_at_time,
      v_old_observation.observable_criterion_at_time,
      case when v_old_observation.id = p_observation_id
        then p_rating else v_old_observation.rating end,
      v_old_observation.entry_method,
      case when v_old_observation.id = p_observation_id
        then nullif(btrim(p_private_note), '')
        else v_old_observation.private_note end,
      v_old_observation.observed_at,
      v_old_observation.recorded_by_account_id,
      v_old_observation.id
    );

    if v_old_observation.id = p_observation_id then
      v_new_observation_id := v_candidate_observation_id;
    end if;
  end loop;

  perform public.materialize_learning_evidence_for_records(
    array[v_new_record_id],
    v_corrected_at
  );

  for v_objective_id in
    select distinct observation.source_learning_objective_id_at_time
    from public.lesson_component_observation as observation
    where observation.learning_record_id = v_new_record_id
      and observation.source_learning_objective_id_at_time is not null
    order by observation.source_learning_objective_id_at_time
  loop
    perform public.rebuild_learner_objective_state_for_actor(
      v_actor_account_id,
      v_source_record.learner_profile_id,
      v_objective_id,
      v_corrected_at
    );
  end loop;

  return jsonb_build_object(
    'idempotencyKey', p_idempotency_key,
    'newLearningRecordId', v_new_record_id,
    'newObservationId', v_new_observation_id,
    'correctedAt', v_corrected_at,
    'replayed', false
  );
end
$function$;

revoke all on function public.correct_finalized_lesson_component_observation(
  uuid, uuid, uuid, text, text, text, uuid, timestamptz
) from public, anon, authenticated, service_role;
grant execute on function public.correct_finalized_lesson_component_observation(
  uuid, uuid, uuid, text, text, text, uuid, timestamptz
) to postgres, authenticated;

-- Teacher-only correction audit for Course/Lesson/learner history routes.
-- Callers submit only the already-authorized active record IDs returned by
-- core history reads; the database revalidates the complete batch against the
-- authenticated recorder and returns changed observation pairs only.
create function public.get_teacher_learning_record_correction_history(
  p_active_learning_record_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor_account_id uuid := public.current_account_id();
  v_learner_profile_ids uuid[];
  v_input_count integer;
  v_visible_count integer;
  v_items jsonb;
  v_event_count integer;
begin
  v_input_count := cardinality(p_active_learning_record_ids);
  if v_actor_account_id is null
    or p_active_learning_record_ids is null
    or v_input_count not between 1 and 200
    or array_position(p_active_learning_record_ids, null) is not null
    or (
      select count(distinct submitted.id)
      from unnest(p_active_learning_record_ids) as submitted(id)
    ) <> v_input_count
  then
    raise exception 'learning_record_correction_history_invalid'
      using errcode = '22023';
  end if;

  select
    count(*),
    array_agg(
      distinct record.learner_profile_id
      order by record.learner_profile_id
    )
  into v_visible_count, v_learner_profile_ids
  from public.learning_record as record
  where record.id = any(p_active_learning_record_ids)
    and record.recorded_by_account_id = v_actor_account_id
    and record.occurred_at is not null
    and record.superseded_by_record_id is null;

  if v_visible_count <> v_input_count then
    raise exception 'learning_record_correction_history_not_found'
      using errcode = 'P0002';
  end if;

  perform public.lock_learning_activity_learners(v_learner_profile_ids);

  perform profile.id
  from public.learner_profile as profile
  where profile.id = any(v_learner_profile_ids)
  order by profile.id
  for share of profile;

  select count(*)
  into v_visible_count
  from public.learning_record as record
  where record.id = any(p_active_learning_record_ids)
    and record.recorded_by_account_id = v_actor_account_id
    and record.occurred_at is not null
    and record.superseded_by_record_id is null;

  if v_visible_count <> v_input_count then
    raise exception 'learning_record_correction_history_not_found'
      using errcode = 'P0002';
  end if;

  with recursive lineage as (
    select
      active.id as active_learning_record_id,
      active.id as learning_record_id,
      0 as depth
    from public.learning_record as active
    where active.id = any(p_active_learning_record_ids)
      and active.recorded_by_account_id = v_actor_account_id
      and active.superseded_by_record_id is null

    union all

    select
      lineage.active_learning_record_id,
      current_record.corrected_from_record_id,
      lineage.depth + 1
    from lineage
    join public.learning_record as current_record
      on current_record.id = lineage.learning_record_id
     and current_record.recorded_by_account_id = v_actor_account_id
    where current_record.corrected_from_record_id is not null
      -- Return cap 200 plus one explicit ancestor/event lookahead so a chain
      -- longer than the visible window cannot report truncated=false.
      and lineage.depth < 201
  ), events as materialized (
    select
      lineage.active_learning_record_id,
      corrected_record.id as learning_record_id,
      corrected_record.corrected_from_record_id,
      corrected_observation.id as observation_id,
      corrected_observation.corrected_from_observation_id,
      corrected_observation.component_position_at_time,
      corrected_observation.component_label_at_time,
      prior_observation.rating as old_rating,
      corrected_observation.rating as new_rating,
      prior_observation.private_note as old_private_note,
      corrected_observation.private_note as new_private_note,
      corrected_record.correction_reason,
      corrected_record.corrected_at
    from lineage
    join public.learning_record as corrected_record
      on corrected_record.id = lineage.learning_record_id
     and corrected_record.recorded_by_account_id = v_actor_account_id
    join public.lesson_component_observation as corrected_observation
      on corrected_observation.learning_record_id = corrected_record.id
     and corrected_observation.recorded_by_account_id =
       v_actor_account_id
     and corrected_observation.corrected_from_observation_id is not null
    join public.lesson_component_observation as prior_observation
      on prior_observation.id =
        corrected_observation.corrected_from_observation_id
     and prior_observation.recorded_by_account_id = v_actor_account_id
    where corrected_record.corrected_from_record_id is not null
      and (
        corrected_observation.rating,
        corrected_observation.private_note
      ) is distinct from (
        prior_observation.rating,
        prior_observation.private_note
      )
  ), bounded as materialized (
    select events.*
    from events
    order by
      events.corrected_at desc,
      events.learning_record_id,
      events.observation_id
    limit 201
  )
  select
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'activeLearningRecordId', bounded.active_learning_record_id,
          'learningRecordId', bounded.learning_record_id,
          'correctedFromLearningRecordId',
            bounded.corrected_from_record_id,
          'observationId', bounded.observation_id,
          'correctedFromObservationId',
            bounded.corrected_from_observation_id,
          'componentPositionAtTime', bounded.component_position_at_time,
          'componentLabelAtTime', bounded.component_label_at_time,
          'oldRating', bounded.old_rating,
          'newRating', bounded.new_rating,
          'oldPrivateNote', bounded.old_private_note,
          'newPrivateNote', bounded.new_private_note,
          'correctionReason', bounded.correction_reason,
          'correctedAt', bounded.corrected_at
        )
        order by
          bounded.corrected_at desc,
          bounded.learning_record_id,
          bounded.observation_id
      ) filter (where bounded.ordinal <= 200),
      '[]'::jsonb
    ),
    count(*)
  into v_items, v_event_count
  from (
    select
      bounded.*,
      row_number() over (
        order by
          bounded.corrected_at desc,
          bounded.learning_record_id,
          bounded.observation_id
      ) as ordinal
    from bounded
  ) as bounded;

  return jsonb_build_object(
    'items', v_items,
    'truncated', v_event_count > 200
  );
end
$function$;

revoke all on function public.get_teacher_learning_record_correction_history(
  uuid[]
) from public, anon, authenticated, service_role;
grant execute on function public.get_teacher_learning_record_correction_history(
  uuid[]
) to postgres, authenticated;

-- Completion is the only ordinary materialization boundary.  The advisory
-- learner locks precede the existing Lesson -> Components -> Run -> Records
-- lifecycle order, so identity merge/erasure cannot interleave with evidence
-- creation for the same learner.
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
  v_learner_profile_ids uuid[];
  v_learning_record_ids uuid[];
  v_projection_at timestamptz;
  v_projection_key record;
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
      or jsonb_typeof(submitted.value -> 'learnerProfileId')
        is distinct from 'string'
      or jsonb_typeof(submitted.value -> 'wasPresent')
        is distinct from 'boolean'
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

  select
    run.lesson_id,
    array_agg(
      (submitted.value ->> 'learnerProfileId')::uuid
      order by (submitted.value ->> 'learnerProfileId')::uuid
    )
  into v_lesson_id, v_learner_profile_ids
  from public.lesson_run as run
  join public.lesson as lesson on lesson.id = run.lesson_id
  join public.course as course on course.id = lesson.course_id
  join public.account as account on account.id = course.owner_account_id
  cross join jsonb_array_elements(p_records) as submitted(value)
  where run.id = p_lesson_run_id
    and account.auth_user_id = (select auth.uid())
  group by run.lesson_id;

  if not found then
    raise exception 'lesson_run_not_found' using errcode = 'P0002';
  end if;

  perform public.lock_learning_activity_learners(v_learner_profile_ids);

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

  if (select count(*) from public.learning_record
      where lesson_run_id = p_lesson_run_id)
      <> jsonb_array_length(p_records)
    or exists (
      select 1
      from jsonb_array_elements(p_records) as submitted(value)
      left join public.learning_record as record
        on record.lesson_run_id = p_lesson_run_id
       and record.learner_profile_id =
         (submitted.value ->> 'learnerProfileId')::uuid
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
     and observation.recorded_by_account_id = record.recorded_by_account_id
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
        when coalesce(
          (submitted.value ->> 'shareWithLearner')::boolean,
          false
        )
          and nullif(
            btrim(submitted.value ->> 'teacherComment'), ''
          ) is not null
          then p_ended_at
        else null
      end,
      actual_duration_minutes_at_time = v_actual_duration,
      course_title_at_time = v_course_title,
      lesson_title_at_time = v_lesson_title,
      subject_at_time = v_subject
  from jsonb_array_elements(p_records) as submitted(value)
  where record.lesson_run_id = p_lesson_run_id
    and record.learner_profile_id =
      (submitted.value ->> 'learnerProfileId')::uuid;

  select array_agg(record.id order by record.id)
  into v_learning_record_ids
  from public.learning_record as record
  where record.lesson_run_id = p_lesson_run_id;

  update public.lesson_run as run
  set ended_at = p_ended_at,
      actual_duration_minutes = v_actual_duration,
      teacher_report = nullif(btrim(p_teacher_report), '')
  where run.id = p_lesson_run_id
  returning run.* into v_run;

  v_projection_at := clock_timestamp();
  perform public.materialize_learning_evidence_for_records(
    v_learning_record_ids,
    v_projection_at
  );

  for v_projection_key in
    select distinct
      evidence.recorded_by_account_id,
      evidence.learner_profile_id,
      evidence.source_learning_objective_id_at_time
    from public.learning_evidence as evidence
    where evidence.learning_record_id = any(v_learning_record_ids)
      and evidence.superseded_by_evidence_id is null
    order by
      evidence.recorded_by_account_id,
      evidence.learner_profile_id,
      evidence.source_learning_objective_id_at_time
  loop
    perform public.rebuild_learner_objective_state_for_actor(
      v_projection_key.recorded_by_account_id,
      v_projection_key.learner_profile_id,
      v_projection_key.source_learning_objective_id_at_time,
      v_projection_at
    );
  end loop;

  return v_run;
end
$function$;

revoke all on function public.complete_lesson_run_v2(
  uuid, jsonb, text, timestamptz, integer
) from public, anon, authenticated, service_role;
grant execute on function public.complete_lesson_run_v2(
  uuid, jsonb, text, timestamptz, integer
) to postgres, authenticated, service_role;

-- LA-M2 preview treated every historical correction vertex as a competing
-- Run record.  Only the active vertex in each reciprocal correction chain can
-- conflict during merge; ancestors remain immutable lineage.
create or replace function public.learner_profile_merge_preview_for_actor(
  p_merge_operation_id uuid,
  p_actor_account_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
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
  v_initial_source_id uuid;
  v_initial_target_id uuid;
  v_update_count integer;
begin
  select operation.* into v_operation
  from public.learner_profile_merge as operation
  where operation.id = p_merge_operation_id;

  if not found or v_operation.subject_account_id <> p_actor_account_id then
    raise exception 'learner_profile_merge_not_found'
      using errcode = 'P0002';
  end if;
  v_initial_source_id := v_operation.source_learner_profile_id;
  v_initial_target_id := v_operation.target_learner_profile_id;
  if v_operation.status = 'completed' then
    return v_operation.preview_payload;
  end if;
  if v_operation.status = 'cancelled' or v_operation.expires_at <= now() then
    raise exception 'learner_profile_merge_not_available'
      using errcode = '55000';
  end if;

  perform 1
  from public.learner_profile as profile
  where profile.id in (
    v_operation.source_learner_profile_id,
    v_operation.target_learner_profile_id
  )
  order by profile.id
  for update of profile;

  -- Cancellation locks the operation first.  Preview deliberately follows
  -- the established Profile -> Operation order, then re-reads terminal state
  -- under the row lock so a concurrent cancel can never be resurrected.
  select operation.* into v_operation
  from public.learner_profile_merge as operation
  where operation.id = p_merge_operation_id
  for update of operation;
  if not found
    or v_operation.subject_account_id <> p_actor_account_id
    or v_operation.source_learner_profile_id <> v_initial_source_id
    or v_operation.target_learner_profile_id <> v_initial_target_id
  then
    raise exception 'learner_profile_merge_not_found'
      using errcode = 'P0002';
  end if;
  if v_operation.status = 'completed' then
    return v_operation.preview_payload;
  end if;
  if v_operation.status = 'cancelled' or v_operation.expires_at <= now() then
    raise exception 'learner_profile_merge_not_available'
      using errcode = '55000';
  end if;

  if not exists (
    select 1 from public.learner_profile as source
    where source.id = v_operation.source_learner_profile_id
  ) then
    v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
      'code', 'source_missing',
      'message', 'Исходный профиль уже недоступен.',
      'count', null
    ));
  elsif exists (
    select 1 from public.learner_profile as source
    where source.id = v_operation.source_learner_profile_id
      and source.account_id is not null
  ) then
    v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
      'code', 'source_is_claimed',
      'message', 'Объединение двух аккаунтов недоступно.',
      'count', 1
    ));
  end if;

  if not exists (
    select 1 from public.learner_profile as target
    where target.id = v_operation.target_learner_profile_id
      and target.account_id = p_actor_account_id
  ) then
    v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
      'code', 'target_not_owned',
      'message', 'Целевой профиль не принадлежит вам.',
      'count', 1
    ));
  end if;

  if exists (
    select 1 from public.learner_profile_alias as alias
    where alias.target_learner_profile_id =
      v_operation.source_learner_profile_id
  ) then
    v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
      'code', 'source_has_merge_lineage',
      'message', 'Профиль уже содержит объединённую историю.',
      'count', null
    ));
  end if;

  if exists (
    select 1 from public.learning_record as record
    where record.learner_profile_id in (
      v_operation.source_learner_profile_id,
      v_operation.target_learner_profile_id
    )
      and record.occurred_at is null
  ) then
    v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
      'code', 'draft_records',
      'message', 'Сначала завершите или отмените открытые проведения.',
      'count', (
        select count(*)
        from public.learning_record as record
        where record.learner_profile_id in (
          v_operation.source_learner_profile_id,
          v_operation.target_learner_profile_id
        )
          and record.occurred_at is null
      )
    ));
  end if;

  if exists (
    select 1
    from public.learning_record as record
    join public.lesson_run as run on run.id = record.lesson_run_id
    where record.learner_profile_id in (
      v_operation.source_learner_profile_id,
      v_operation.target_learner_profile_id
    )
      and run.ended_at is null
      and run.cancelled_at is null
  ) then
    v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
      'code', 'open_lesson_runs',
      'message', 'Сначала закройте все проведения.',
      'count', null
    ));
  end if;

  if exists (
    select 1 from public.learner_observer_grant as grant_row
    where grant_row.learner_profile_id =
      v_operation.source_learner_profile_id
      and grant_row.status = 'active'
  ) or exists (
    select 1 from public.learner_ai_consent as consent
    where consent.learner_profile_id =
      v_operation.source_learner_profile_id
      and consent.status in ('pending', 'active')
  ) then
    v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
      'code', 'source_has_dependent_grants',
      'message', 'Отзовите доступы и согласия исходного профиля.',
      'count', null
    ));
  end if;

  select count(*)::integer into v_finalized_count
  from public.learning_record as record
  where record.learner_profile_id = v_operation.source_learner_profile_id
    and record.occurred_at is not null;
  select count(*)::integer into v_teacher_count
  from public.teacher_learner
  where learner_profile_id = v_operation.source_learner_profile_id;
  select count(*)::integer into v_group_count
  from public.learner_group_member
  where learner_profile_id = v_operation.source_learner_profile_id;
  select count(*)::integer into v_course_count
  from public.course_learner
  where learner_profile_id = v_operation.source_learner_profile_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'occurredOn', source_record.occurred_at::date,
    'resolution', 'keep_target_primary'
  ) order by source_record.occurred_at, source_record.id), '[]'::jsonb)
  into v_conflicts
  from public.learning_record as source_record
  join public.learning_record as target_record
    on target_record.lesson_run_id = source_record.lesson_run_id
   and target_record.learner_profile_id =
     v_operation.target_learner_profile_id
   and target_record.superseded_by_record_id is null
  where source_record.learner_profile_id =
      v_operation.source_learner_profile_id
    and source_record.lesson_run_id is not null
    and source_record.occurred_at is not null
    and source_record.superseded_by_record_id is null
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
      status = case when jsonb_array_length(v_blockers) = 0
        then 'ready' else 'pending' end
  where operation.id = v_operation.id
    and operation.status in ('pending', 'ready');
  get diagnostics v_update_count = row_count;
  if v_update_count <> 1 then
    raise exception 'learner_profile_merge_not_available'
      using errcode = '55000';
  end if;

  return v_payload;
end
$function$;

-- Canonical profile merge carries evidence and stable-key overrides into the
-- target profile, rebuilds projections, and rejects a confirmation if any
-- LA-M3 row changed after preview.  Conflicting overrides use deterministic
-- latest-updated/id ordering because the model intentionally keeps one
-- current teacher decision per stable objective key.
create or replace function public.execute_learner_profile_merge_for_actor(
  p_merge_operation_id uuid,
  p_actor_account_id uuid,
  p_preview_fingerprint text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_operation public.learner_profile_merge%rowtype;
  v_preview jsonb;
  v_source_id uuid;
  v_target_id uuid;
  v_pair record;
  v_projection_key record;
  v_projection_at timestamptz;
  v_override_conflict_count integer := 0;
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
  perform public.lock_learning_activity_learners(
    array[v_source_id, v_target_id]
  );

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
  if v_operation.subject_account_id <> p_actor_account_id
    or v_operation.source_learner_profile_id <> v_source_id
    or v_operation.target_learner_profile_id <> v_target_id
  then
    raise exception 'learner_profile_merge_preview_stale'
      using errcode = '40001';
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
  perform 1 from public.learning_evidence as evidence
  where evidence.learner_profile_id in (v_source_id, v_target_id)
  order by evidence.id
  for update of evidence;
  perform link.learning_evidence_id
  from public.learner_objective_state_evidence as link
  join public.learner_objective_state as state
    on state.id = link.learner_objective_state_id
  where state.learner_profile_id in (v_source_id, v_target_id)
  order by link.learner_objective_state_id, link.position
  for update of link;
  perform 1 from public.learner_objective_state as state
  where state.learner_profile_id in (v_source_id, v_target_id)
  order by
    state.recorded_by_account_id,
    state.source_course_id_at_time,
    state.source_learning_objective_id_at_time
  for update of state;
  perform 1 from public.learner_recommendation_override as override_row
  where override_row.learner_profile_id in (v_source_id, v_target_id)
  order by
    override_row.recorded_by_account_id,
    override_row.source_course_id_at_time,
    override_row.source_learning_objective_id_at_time,
    override_row.id
  for update of override_row;
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
    raise exception 'learner_profile_merge_preview_stale'
      using errcode = '40001';
  end if;
  if v_operation.learning_activity_scope_fingerprint is null
    or v_operation.learning_activity_scope_fingerprint is distinct from
      public.learning_activity_scope_fingerprint(
        array[v_source_id, v_target_id]
      )
  then
    raise exception 'learner_profile_merge_preview_stale'
      using errcode = '40001';
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

  insert into public.learner_group_member (
    learner_group_id,
    learner_profile_id
  )
  select learner_group_id, v_target_id
  from public.learner_group_member
  where learner_profile_id = v_source_id
  on conflict do nothing;
  delete from public.learner_group_member
  where learner_profile_id = v_source_id;

  insert into public.course_learner (course_id, learner_profile_id)
  select course_id, v_target_id
  from public.course_learner
  where learner_profile_id = v_source_id
  on conflict do nothing;
  delete from public.course_learner
  where learner_profile_id = v_source_id;

  -- Keep the most recent explicit decision for a duplicate stable key.
  with ranked as (
    select
      override_row.id,
      row_number() over (
        partition by
          override_row.recorded_by_account_id,
          override_row.source_course_id_at_time,
          override_row.source_learning_objective_id_at_time
        order by override_row.updated_at desc, override_row.id desc
      ) as preference_rank
    from public.learner_recommendation_override as override_row
    where override_row.learner_profile_id in (v_source_id, v_target_id)
  )
  delete from public.learner_recommendation_override as override_row
  using ranked
  where override_row.id = ranked.id
    and ranked.preference_rank > 1;
  get diagnostics v_override_conflict_count = row_count;

  update public.learner_recommendation_override as override_row
  set learner_objective_state_id = null
  where override_row.learner_profile_id in (v_source_id, v_target_id);

  delete from public.learner_objective_state as state
  where state.learner_profile_id in (v_source_id, v_target_id);

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
      and source_record.superseded_by_record_id is null
      and target_record.occurred_at is not null
      and target_record.superseded_by_record_id is null
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

  perform set_config('app.learner_identity_merge', 'on', true);
  update public.learning_record
  set learner_profile_id = v_target_id
  where learner_profile_id = v_source_id;

  update public.learner_recommendation_override
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

  v_projection_at := clock_timestamp();
  for v_projection_key in
    select distinct
      evidence.recorded_by_account_id,
      evidence.source_learning_objective_id_at_time
    from public.learning_evidence as evidence
    join public.learning_record as record
      on record.id = evidence.learning_record_id
    where evidence.learner_profile_id = v_target_id
      and evidence.superseded_by_evidence_id is null
      and record.superseded_by_record_id is null
    order by
      evidence.recorded_by_account_id,
      evidence.source_learning_objective_id_at_time
  loop
    perform public.rebuild_learner_objective_state_for_actor(
      v_projection_key.recorded_by_account_id,
      v_target_id,
      v_projection_key.source_learning_objective_id_at_time,
      v_projection_at
    );
  end loop;

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
      'learningActivityOverrideConflictCount', v_override_conflict_count,
      'learningActivityProjectionVersion', 1,
      'projectionVersion', 1
    )
  );

  return v_target_id;
end
$function$;

revoke all on function public.execute_learner_profile_merge_for_actor(
  uuid, uuid, text
) from public, anon, authenticated, service_role;
grant execute on function public.execute_learner_profile_merge_for_actor(
  uuid, uuid, text
) to postgres;

create or replace function public.confirm_my_learning_data_erasure(
  p_actor_auth_user_id uuid,
  p_preview_fingerprint text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor_account_id uuid :=
    public.account_id_for_auth_user(p_actor_auth_user_id);
  v_account public.account%rowtype;
  v_profile_id uuid;
  v_request public.learner_erasure_request%rowtype;
  v_lineage_ids uuid[];
  v_new_profile public.learner_profile%rowtype;
  v_counts jsonb;
  v_current_base jsonb;
  v_current_fingerprint bytea;
  v_learning_evidence_count integer;
  v_objective_state_count integer;
  v_recommendation_override_count integer;
begin
  if v_actor_account_id is null
    or p_preview_fingerprint !~ '^[0-9a-f]{64}$'
  then
    raise exception 'learning_data_erasure_not_found' using errcode = 'P0002';
  end if;

  -- Discovery is deliberately lock-free.  The shared learner advisory locks
  -- are first, and every authoritative value is re-read under row locks.
  select profile.id into v_profile_id
  from public.learner_profile as profile
  where profile.account_id = v_actor_account_id;
  if not found then
    raise exception 'learning_data_erasure_not_found' using errcode = 'P0002';
  end if;

  select array_agg(lineage.id order by lineage.id)
  into v_lineage_ids
  from (
    select v_profile_id as id
    union
    select alias.source_learner_profile_id
    from public.learner_profile_alias as alias
    where alias.target_learner_profile_id = v_profile_id
  ) as lineage;
  perform public.lock_learning_activity_learners(v_lineage_ids);

  select account.* into v_account
  from public.account as account
  where account.id = v_actor_account_id
  for update of account;
  select profile.id into v_profile_id
  from public.learner_profile as profile
  where profile.id = v_profile_id
    and profile.account_id = v_actor_account_id
  for update of profile;
  if not found then
    raise exception 'learning_data_erasure_not_found' using errcode = 'P0002';
  end if;

  select request.* into v_request
  from public.learner_erasure_request as request
  where request.account_id = v_actor_account_id
    and request.current_learner_profile_id = v_profile_id
    and request.preview_fingerprint = decode(p_preview_fingerprint, 'hex')
    and request.consumed_at is null
    and request.expires_at > now()
  order by request.created_at desc
  limit 1
  for update of request;
  if not found then
    raise exception 'learning_data_erasure_not_found' using errcode = 'P0002';
  end if;
  v_counts := v_request.preview_payload;

  -- Recompute lineage after the canonical Account/Profile locks.
  select array_agg(lineage.id order by lineage.id)
  into v_lineage_ids
  from (
    select v_profile_id as id
    union
    select alias.source_learner_profile_id
    from public.learner_profile_alias as alias
    where alias.target_learner_profile_id = v_profile_id
  ) as lineage;

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
  perform 1 from public.learning_evidence
    where learner_profile_id = any(v_lineage_ids)
    order by id for update;
  perform link.learning_evidence_id
  from public.learner_objective_state_evidence as link
  join public.learner_objective_state as state
    on state.id = link.learner_objective_state_id
  where state.learner_profile_id = any(v_lineage_ids)
  order by link.learner_objective_state_id, link.position
  for update of link;
  perform 1 from public.learner_objective_state
    where learner_profile_id = any(v_lineage_ids)
    order by
      recorded_by_account_id,
      source_course_id_at_time,
      source_learning_objective_id_at_time
    for update;
  perform 1 from public.learner_recommendation_override
    where learner_profile_id = any(v_lineage_ids)
    order by
      recorded_by_account_id,
      source_course_id_at_time,
      source_learning_objective_id_at_time,
      id
    for update;

  v_current_base := public.learner_erasure_state_for_actor(
    v_actor_account_id,
    v_profile_id
  );
  v_current_fingerprint := extensions.digest(v_current_base::text, 'sha256');
  if v_current_fingerprint <> v_request.preview_fingerprint
    or v_request.learning_activity_scope_fingerprint is null
    or v_request.learning_activity_scope_fingerprint is distinct from
      public.learning_activity_scope_fingerprint(v_lineage_ids)
  then
    raise exception 'learning_data_erasure_preview_stale'
      using errcode = '40001';
  end if;

  select count(*)::integer into v_learning_evidence_count
  from public.learning_evidence
  where learner_profile_id = any(v_lineage_ids);
  select count(*)::integer into v_objective_state_count
  from public.learner_objective_state
  where learner_profile_id = any(v_lineage_ids);
  select count(*)::integer into v_recommendation_override_count
  from public.learner_recommendation_override
  where learner_profile_id = any(v_lineage_ids);

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
  delete from public.learner_observer_invitation
  where learner_profile_id = any(v_lineage_ids);
  delete from public.learner_observer_grant
  where learner_profile_id = any(v_lineage_ids);
  delete from public.learner_ai_consent
  where learner_profile_id = any(v_lineage_ids);
  delete from public.learner_credential_recovery_delegate
  where subject_account_id = v_actor_account_id;
  delete from public.course_learner
  where learner_profile_id = any(v_lineage_ids);
  delete from public.learner_group_member
  where learner_profile_id = any(v_lineage_ids);
  delete from public.teacher_learner
  where learner_profile_id = any(v_lineage_ids);
  delete from public.learner_profile_share_code
  where learner_profile_id = any(v_lineage_ids);

  delete from public.learner_objective_state_evidence as link
  using public.learner_objective_state as state
  where state.id = link.learner_objective_state_id
    and state.learner_profile_id = any(v_lineage_ids);
  delete from public.learner_recommendation_override
  where learner_profile_id = any(v_lineage_ids);
  delete from public.learner_objective_state
  where learner_profile_id = any(v_lineage_ids);
  delete from public.learning_evidence
  where learner_profile_id = any(v_lineage_ids);
  delete from public.learning_record
  where learner_profile_id = any(v_lineage_ids);

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
    'learning_data_erased',
    v_actor_account_id,
    v_actor_account_id,
    null,
    null,
    null,
    jsonb_build_object(
      'lineageProfileCount', v_counts -> 'lineageProfileCount',
      'learningRecordCount', v_counts -> 'learningRecordCount',
      'learningEvidenceCount', v_learning_evidence_count,
      'objectiveStateCount', v_objective_state_count,
      'recommendationOverrideCount', v_recommendation_override_count,
      'learningActivityProjectionVersion', 1,
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
$function$;

revoke all on function public.confirm_my_learning_data_erasure(uuid, text)
from public, anon, authenticated, service_role;
grant execute on function public.confirm_my_learning_data_erasure(uuid, text)
to postgres, service_role;

create function public.refresh_learning_activity_states_for_profile(
  p_learner_profile_id uuid,
  p_recorded_by_account_id uuid,
  p_as_of timestamptz
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_key record;
begin
  if p_learner_profile_id is null or p_as_of is null then
    raise exception 'learning_activity_profile_refresh_invalid'
      using errcode = '22023';
  end if;

  perform public.lock_learning_activity_learners(
    array[p_learner_profile_id]
  );
  perform 1
  from public.learner_profile as profile
  where profile.id = p_learner_profile_id
  for update of profile;
  if not found then
    raise exception 'learner_profile_not_found' using errcode = 'P0002';
  end if;

  for v_key in
    select distinct candidate.recorded_by_account_id,
      candidate.source_learning_objective_id_at_time
    from (
      select
        evidence.recorded_by_account_id,
        evidence.source_learning_objective_id_at_time
      from public.learning_evidence as evidence
      where evidence.learner_profile_id = p_learner_profile_id
        and evidence.superseded_by_evidence_id is null
        and (
          p_recorded_by_account_id is null
          or evidence.recorded_by_account_id = p_recorded_by_account_id
        )
      union
      select
        state.recorded_by_account_id,
        state.source_learning_objective_id_at_time
      from public.learner_objective_state as state
      where state.learner_profile_id = p_learner_profile_id
        and (
          p_recorded_by_account_id is null
          or state.recorded_by_account_id = p_recorded_by_account_id
        )
    ) as candidate
    order by
      candidate.recorded_by_account_id,
      candidate.source_learning_objective_id_at_time
  loop
    perform public.rebuild_learner_objective_state_for_actor(
      v_key.recorded_by_account_id,
      p_learner_profile_id,
      v_key.source_learning_objective_id_at_time,
      p_as_of
    );
  end loop;
end
$function$;

revoke all on function public.refresh_learning_activity_states_for_profile(
  uuid, uuid, timestamptz
) from public, anon, authenticated, service_role;
grant execute on function public.refresh_learning_activity_states_for_profile(
  uuid, uuid, timestamptz
) to postgres;

create function public.teacher_learning_activity_profile_projection(
  p_learner_profile_id uuid,
  p_recorded_by_account_id uuid,
  p_generated_at timestamptz
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $function$
  with candidate as (
    select
      state.id as state_id,
      state.learning_objective_id,
      state.source_learning_objective_id_at_time,
      state.source_course_id_at_time,
      state.course_title_at_time,
      state.subject_at_time,
      state.objective_title_at_time,
      state.status,
      state.reason_code,
      state.reason_text,
      state.policy_version,
      state.evaluated_at,
      state.last_evidence_at,
      state.freshness_due_at,
      override_row.action as override_action,
      override_row.recommendation_type as override_type,
      override_row.private_reason as override_private_reason,
      override_row.updated_at as override_updated_at,
      true as has_data
    from public.learner_objective_state as state
    left join public.learner_recommendation_override as override_row
      on override_row.recorded_by_account_id =
        state.recorded_by_account_id
     and override_row.learner_profile_id = state.learner_profile_id
     and override_row.source_course_id_at_time =
        state.source_course_id_at_time
     and override_row.source_learning_objective_id_at_time =
        state.source_learning_objective_id_at_time
    where state.recorded_by_account_id = p_recorded_by_account_id
      and state.learner_profile_id = p_learner_profile_id

    union all

    select
      null::uuid,
      objective.id,
      objective.id,
      course.id,
      btrim(course.title),
      nullif(btrim(course.subject), ''),
      btrim(objective.title),
      'no_data'::text,
      'no_eligible_evidence'::text,
      'Пока нет подходящих наблюдений по этой учебной цели.'::text,
      1,
      p_generated_at,
      null::timestamptz,
      null::timestamptz,
      null::text,
      null::text,
      null::text,
      null::timestamptz,
      false
    from public.course as course
    join public.learning_objective as objective
      on objective.course_id = course.id
     and objective.archived_at is null
    where course.owner_account_id = p_recorded_by_account_id
      and course.archived_at is null
      and public.course_has_effective_learner(
        course.id,
        p_learner_profile_id
      )
      and not exists (
        select 1
        from public.learner_objective_state as state
        where state.recorded_by_account_id = p_recorded_by_account_id
          and state.learner_profile_id = p_learner_profile_id
          and state.source_course_id_at_time = course.id
          and state.source_learning_objective_id_at_time = objective.id
      )
  ), bounded as (
    select candidate.*
    from candidate
    order by
      candidate.has_data desc,
      candidate.evaluated_at desc,
      candidate.course_title_at_time,
      candidate.objective_title_at_time,
      candidate.source_course_id_at_time,
      candidate.source_learning_objective_id_at_time,
      candidate.state_id nulls last
    limit 200
  ), projected as (
    select
      bounded.*,
      coalesce(evidence_projection.items, '[]'::jsonb) as evidence_items,
      coalesce(evidence_projection.ids, '[]'::jsonb) as evidence_ids
    from bounded
    left join lateral (
      select
        jsonb_agg(
          jsonb_build_object(
            'id', evidence.id,
            'learnerProfileId', evidence.learner_profile_id,
            'recordedByAccountId', evidence.recorded_by_account_id,
            'learningRecordId', evidence.learning_record_id,
            'sourceObservationId', evidence.source_observation_id,
            'sourceCourseIdAtTime', evidence.source_course_id_at_time,
            'sourceLessonIdAtTime', evidence.source_lesson_id_at_time,
            'sourceLessonRunIdAtTime',
              evidence.source_lesson_run_id_at_time,
            'sourceComponentIdAtTime', evidence.source_component_id_at_time,
            'sourceLearningObjectiveIdAtTime',
              evidence.source_learning_objective_id_at_time,
            'lessonComponentId', evidence.lesson_component_id,
            'learningObjectiveId', evidence.learning_objective_id,
            'courseTitleAtTime', evidence.course_title_at_time,
            'lessonTitleAtTime', evidence.lesson_title_at_time,
            'subjectAtTime', evidence.subject_at_time,
            'componentTypeAtTime', evidence.component_type_at_time,
            'componentLabelAtTime', evidence.component_label_at_time,
            'objectiveTitleAtTime', evidence.objective_title_at_time,
            'criterionAtTime', evidence.criterion_at_time,
            'direction', evidence.direction,
            'support', evidence.support,
            'observedAt', evidence.observed_at,
            'finalizedAt', evidence.finalized_at,
            'materializedAt', evidence.materialized_at,
            'evidenceVersion', evidence.evidence_version,
            'eligibilityPolicyVersion',
              evidence.eligibility_policy_version,
            'reasonCode', evidence.reason_code,
            'supersedesEvidenceId', evidence.supersedes_evidence_id,
            'supersededByEvidenceId', evidence.superseded_by_evidence_id
          ) order by link.position
        ) as items,
        jsonb_agg(to_jsonb(evidence.id) order by link.position) as ids
      from public.learner_objective_state_evidence as link
      join public.learning_evidence as evidence
        on evidence.id = link.learning_evidence_id
      where link.learner_objective_state_id = bounded.state_id
    ) as evidence_projection on bounded.state_id is not null
  )
  select jsonb_build_object(
    'projectionVersion', 1,
    'learnerProfileId', p_learner_profile_id,
    'generatedAt', p_generated_at,
    'states', coalesce(
      jsonb_agg(
        jsonb_build_object(
          'stateId', projected.state_id,
          'learningObjectiveId', projected.learning_objective_id,
          'sourceLearningObjectiveIdAtTime',
            projected.source_learning_objective_id_at_time,
          'sourceCourseIdAtTime', projected.source_course_id_at_time,
          'courseTitleAtTime', projected.course_title_at_time,
          'subjectAtTime', projected.subject_at_time,
          'objectiveTitleAtTime', projected.objective_title_at_time,
          'status', projected.status,
          'reasonCode', projected.reason_code,
          'reasonText', projected.reason_text,
          'policyVersion', projected.policy_version,
          'evaluatedAt', projected.evaluated_at,
          'lastEvidenceAt', projected.last_evidence_at,
          'freshnessDueAt', projected.freshness_due_at,
          'evidence', projected.evidence_items,
          'recommendation', case
            when projected.state_id is null then null::jsonb
            else jsonb_build_object(
              'recommendationId', projected.state_id,
              'type', case projected.reason_code
                when 'latest_not_yet' then 'repeat'
                when 'latest_with_support' then 'try_without_support'
                when 'independent_opportunities_missing'
                  then 'apply_in_new_context'
                when 'multiple_independent_opportunities'
                  then 'move_forward'
                else 'recheck_freshness'
              end,
              'reasonCode', case projected.reason_code
                when 'latest_not_yet' then 'repeat_after_not_yet'
                when 'latest_with_support'
                  then 'try_without_support_after_supported_success'
                when 'independent_opportunities_missing'
                  then 'apply_in_new_context_after_one_independent_opportunity'
                when 'multiple_independent_opportunities'
                  then 'move_forward_after_confirmation'
                else 'recheck_due_to_freshness'
              end,
              'reasonText', case projected.reason_code
                when 'latest_not_yet' then
                  'Пока не получилось — повторите материал и попробуйте ещё раз.'
                when 'latest_with_support' then
                  'Получилось с поддержкой — следующим шагом попробуйте без подсказки.'
                when 'independent_opportunities_missing' then
                  'Получилось самостоятельно один раз — примените навык в новом контексте.'
                when 'multiple_independent_opportunities' then
                  'Навык подтверждён в нескольких занятиях — можно переходить дальше.'
                else
                  'Подтверждение давно не обновлялось — пора перепроверить навык.'
              end,
              'ruleVersion', 1,
              'generatedAt', projected.evaluated_at,
              'evidenceIds', projected.evidence_ids,
              'effectiveType', case projected.override_action
                when 'dismiss' then null
                when 'replace' then projected.override_type
                else case projected.reason_code
                  when 'latest_not_yet' then 'repeat'
                  when 'latest_with_support' then 'try_without_support'
                  when 'independent_opportunities_missing'
                    then 'apply_in_new_context'
                  when 'multiple_independent_opportunities'
                    then 'move_forward'
                  else 'recheck_freshness'
                end
              end,
              'effectiveReasonText', case projected.override_action
                when 'dismiss' then null
                when 'replace' then projected.override_private_reason
                else case projected.reason_code
                  when 'latest_not_yet' then
                    'Пока не получилось — повторите материал и попробуйте ещё раз.'
                  when 'latest_with_support' then
                    'Получилось с поддержкой — следующим шагом попробуйте без подсказки.'
                  when 'independent_opportunities_missing' then
                    'Получилось самостоятельно один раз — примените навык в новом контексте.'
                  when 'multiple_independent_opportunities' then
                    'Навык подтверждён в нескольких занятиях — можно переходить дальше.'
                  else
                    'Подтверждение давно не обновлялось — пора перепроверить навык.'
                end
              end,
              'source', case when projected.override_action is null
                then 'rule' else 'teacher_override' end,
              'override', case when projected.override_action is null
                then null::jsonb
                else jsonb_build_object(
                  'action', projected.override_action,
                  'recommendationType', projected.override_type,
                  'privateReason', projected.override_private_reason,
                  'updatedAt', projected.override_updated_at
                )
              end
            )
          end
        ) order by
          projected.has_data desc,
          projected.evaluated_at desc,
          projected.course_title_at_time,
          projected.objective_title_at_time,
          projected.source_course_id_at_time,
          projected.source_learning_objective_id_at_time,
          projected.state_id nulls last
      ),
      '[]'::jsonb
    )
  )
  from projected;
$function$;

revoke all on function public.teacher_learning_activity_profile_projection(
  uuid, uuid, timestamptz
) from public, anon, authenticated, service_role;
grant execute on function public.teacher_learning_activity_profile_projection(
  uuid, uuid, timestamptz
) to postgres;

create function public.safe_learning_activity_profile_projection(
  p_learner_profile_id uuid,
  p_generated_at timestamptz
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $function$
  with candidate as (
    select
      state.id as state_id,
      state.recorded_by_account_id,
      state.source_learning_objective_id_at_time,
      state.source_course_id_at_time,
      state.course_title_at_time,
      state.subject_at_time,
      state.objective_title_at_time,
      state.status,
      state.reason_code,
      state.reason_text,
      state.evaluated_at,
      state.last_evidence_at,
      state.freshness_due_at,
      override_row.action as override_action,
      override_row.recommendation_type as override_type,
      true as has_data
    from public.learner_objective_state as state
    left join public.learner_recommendation_override as override_row
      on override_row.recorded_by_account_id =
        state.recorded_by_account_id
     and override_row.learner_profile_id = state.learner_profile_id
     and override_row.source_course_id_at_time =
        state.source_course_id_at_time
     and override_row.source_learning_objective_id_at_time =
        state.source_learning_objective_id_at_time
    where state.learner_profile_id = p_learner_profile_id

    union all

    select
      null::uuid,
      course.owner_account_id,
      objective.id,
      course.id,
      btrim(course.title),
      nullif(btrim(course.subject), ''),
      btrim(objective.title),
      'no_data'::text,
      'no_eligible_evidence'::text,
      'Пока нет подходящих наблюдений по этой учебной цели.'::text,
      greatest(course.updated_at, objective.updated_at),
      null::timestamptz,
      null::timestamptz,
      null::text,
      null::text,
      false
    from public.course as course
    join public.learning_objective as objective
      on objective.course_id = course.id
     and objective.archived_at is null
    where course.archived_at is null
      and public.course_has_effective_learner(
        course.id,
        p_learner_profile_id
      )
      and not exists (
        select 1
        from public.learner_objective_state as state
        where state.learner_profile_id = p_learner_profile_id
          and state.source_course_id_at_time = course.id
          and state.source_learning_objective_id_at_time = objective.id
      )
  ), bounded as (
    select candidate.*
    from candidate
    order by
      candidate.has_data desc,
      candidate.evaluated_at desc,
      candidate.course_title_at_time,
      candidate.objective_title_at_time,
      candidate.recorded_by_account_id,
      candidate.source_course_id_at_time,
      candidate.source_learning_objective_id_at_time,
      candidate.state_id nulls last
    limit 200
  ), projected as (
    select
      bounded.*,
      'las_' || encode(
        extensions.digest(
          case when bounded.state_id is null
            then 'no-data-v1:' || p_learner_profile_id::text || ':'
              || bounded.source_course_id_at_time::text || ':'
              || bounded.source_learning_objective_id_at_time::text
            else 'state-v1:' || p_learner_profile_id::text || ':'
              || bounded.state_id::text
          end,
          'sha256'
        ),
        'hex'
      ) as opaque_state_key,
      coalesce(evidence_projection.items, '[]'::jsonb)
        as evidence_items,
      coalesce(evidence_projection.keys, '[]'::jsonb)
        as evidence_keys
    from bounded
    left join lateral (
      select
        jsonb_agg(item.payload order by item.position) as items,
        jsonb_agg(to_jsonb(item.opaque_key) order by item.position) as keys
      from (
        select
          link.position,
          'lae_' || encode(
            extensions.digest(
              'evidence-v1:' || p_learner_profile_id::text || ':'
                || evidence.id::text,
              'sha256'
            ),
            'hex'
          ) as opaque_key,
          jsonb_build_object(
            'key', 'lae_' || encode(
              extensions.digest(
                'evidence-v1:' || p_learner_profile_id::text || ':'
                  || evidence.id::text,
                'sha256'
              ),
              'hex'
            ),
            'direction', evidence.direction,
            'support', evidence.support,
            'observedAt', evidence.observed_at,
            'evidenceAt', evidence.materialized_at,
            'courseTitle', evidence.course_title_at_time,
            'lessonTitle', evidence.lesson_title_at_time,
            'componentLabel', case
              when evidence.component_visibility_at_time = 'learner_visible'
                then evidence.component_label_at_time
              else 'Служебный компонент преподавателя'
            end,
            'objectiveTitle', evidence.objective_title_at_time,
            'criterion', case
              when evidence.component_visibility_at_time = 'learner_visible'
                then evidence.criterion_at_time
              else 'Служебный критерий преподавателя'
            end
          ) as payload
        from public.learner_objective_state_evidence as link
        join public.learning_evidence as evidence
          on evidence.id = link.learning_evidence_id
        where link.learner_objective_state_id = bounded.state_id
        order by link.position
        limit 5
      ) as item
    ) as evidence_projection on bounded.state_id is not null
  )
  select jsonb_build_object(
    'projectionVersion', 1,
    'generatedAt', p_generated_at,
    'states', coalesce(
      jsonb_agg(
        jsonb_build_object(
          'key', projected.opaque_state_key,
          'courseTitle', projected.course_title_at_time,
          'subject', projected.subject_at_time,
          'objectiveTitle', projected.objective_title_at_time,
          'state', projected.status,
          'reasonCode', projected.reason_code,
          'reasonText', projected.reason_text,
          'evaluatedAt', projected.evaluated_at,
          'lastEvidenceAt', projected.last_evidence_at,
          'freshnessDueAt', projected.freshness_due_at,
          'evidenceReferences', projected.evidence_items,
          'recommendation', case
            when projected.state_id is null
              or projected.override_action = 'dismiss'
              then null::jsonb
            else jsonb_build_object(
              'type', case
                when projected.override_action = 'replace'
                  then projected.override_type
                when projected.reason_code = 'latest_not_yet' then 'repeat'
                when projected.reason_code = 'latest_with_support'
                  then 'try_without_support'
                when projected.reason_code =
                  'independent_opportunities_missing'
                  then 'apply_in_new_context'
                when projected.reason_code =
                  'multiple_independent_opportunities'
                  then 'move_forward'
                else 'recheck_freshness'
              end,
              'reasonCode', case projected.reason_code
                when 'latest_not_yet' then 'repeat_after_not_yet'
                when 'latest_with_support'
                  then 'try_without_support_after_supported_success'
                when 'independent_opportunities_missing'
                  then 'apply_in_new_context_after_one_independent_opportunity'
                when 'multiple_independent_opportunities'
                  then 'move_forward_after_confirmation'
                else 'recheck_due_to_freshness'
              end,
              'reasonText', case
                when projected.override_action = 'replace' then
                  case projected.override_type
                    when 'repeat' then
                      'Повторите материал и попробуйте ещё раз.'
                    when 'try_without_support' then
                      'Попробуйте выполнить навык без подсказки.'
                    when 'apply_in_new_context' then
                      'Примените навык в новом контексте.'
                    when 'move_forward' then
                      'Можно переходить к следующему материалу.'
                    else
                      'Перепроверьте навык, чтобы обновить подтверждение.'
                  end
                when projected.reason_code = 'latest_not_yet' then
                  'Пока не получилось — повторите материал и попробуйте ещё раз.'
                when projected.reason_code = 'latest_with_support' then
                  'Получилось с поддержкой — следующим шагом попробуйте без подсказки.'
                when projected.reason_code =
                  'independent_opportunities_missing' then
                  'Получилось самостоятельно один раз — примените навык в новом контексте.'
                when projected.reason_code =
                  'multiple_independent_opportunities' then
                  'Навык подтверждён в нескольких занятиях — можно переходить дальше.'
                else
                  'Подтверждение давно не обновлялось — пора перепроверить навык.'
              end,
              'source', case when projected.override_action = 'replace'
                then 'teacher_override' else 'rule' end,
              'generatedAt', projected.evaluated_at,
              'evidenceReferenceKeys', projected.evidence_keys
            )
          end
        ) order by
          projected.has_data desc,
          projected.evaluated_at desc,
          projected.course_title_at_time,
          projected.objective_title_at_time,
          projected.recorded_by_account_id,
          projected.source_course_id_at_time,
          projected.source_learning_objective_id_at_time,
          projected.state_id nulls last
      ),
      '[]'::jsonb
    )
  )
  from projected;
$function$;

revoke all on function public.safe_learning_activity_profile_projection(
  uuid, timestamptz
) from public, anon, authenticated, service_role;
grant execute on function public.safe_learning_activity_profile_projection(
  uuid, timestamptz
) to postgres;

create function public.get_teacher_learner_activity_profile(
  p_learner_profile_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor_account_id uuid := public.current_account_id();
  v_profile_id uuid :=
    public.resolve_learner_profile_alias(p_learner_profile_id);
  v_generated_at timestamptz := clock_timestamp();
begin
  if v_actor_account_id is null or v_profile_id is null then
    raise exception 'learner_activity_profile_not_found'
      using errcode = 'P0002';
  end if;

  perform public.lock_learning_activity_learners(array[v_profile_id]);
  perform 1 from public.learner_profile as profile
  where profile.id = v_profile_id
  for update of profile;
  if not found then
    raise exception 'learner_activity_profile_not_found'
      using errcode = 'P0002';
  end if;
  perform 1 from public.teacher_learner as relation
  where relation.teacher_account_id = v_actor_account_id
    and relation.learner_profile_id = v_profile_id
  for share of relation;
  if not found then
    raise exception 'learner_activity_profile_not_found'
      using errcode = 'P0002';
  end if;

  perform public.refresh_learning_activity_states_for_profile(
    v_profile_id,
    v_actor_account_id,
    v_generated_at
  );
  return public.teacher_learning_activity_profile_projection(
    v_profile_id,
    v_actor_account_id,
    v_generated_at
  );
end
$function$;

revoke all on function public.get_teacher_learner_activity_profile(uuid)
from public, anon, authenticated, service_role;
grant execute on function public.get_teacher_learner_activity_profile(uuid)
to postgres, authenticated;

create function public.get_my_learning_activity_profile()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor_account_id uuid := public.current_account_id();
  v_profile_id uuid;
  v_generated_at timestamptz := clock_timestamp();
begin
  select profile.id into v_profile_id
  from public.learner_profile as profile
  where profile.account_id = v_actor_account_id;
  if not found then
    raise exception 'learner_profile_not_found' using errcode = 'P0002';
  end if;

  perform public.lock_learning_activity_learners(array[v_profile_id]);
  perform 1 from public.learner_profile as profile
  where profile.id = v_profile_id
    and profile.account_id = v_actor_account_id
  for update of profile;
  if not found then
    raise exception 'learner_profile_not_found' using errcode = 'P0002';
  end if;

  perform public.refresh_learning_activity_states_for_profile(
    v_profile_id,
    null,
    v_generated_at
  );
  return public.safe_learning_activity_profile_projection(
    v_profile_id,
    v_generated_at
  );
end
$function$;

revoke all on function public.get_my_learning_activity_profile()
from public, anon, authenticated, service_role;
grant execute on function public.get_my_learning_activity_profile()
to postgres, authenticated;

create function public.get_observed_learner_activity_profile(
  p_learner_profile_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor_account_id uuid := public.current_account_id();
  v_grant_id uuid;
  v_generated_at timestamptz := clock_timestamp();
  v_result jsonb;
begin
  if v_actor_account_id is null or p_learner_profile_id is null then
    raise exception 'observed_learner_profile_not_found'
      using errcode = 'P0002';
  end if;

  -- The advisory lock comes before the canonical Profile; Profile remains
  -- before Grant, matching merge/erasure and closing revoke/read races.
  perform public.lock_learning_activity_learners(
    array[p_learner_profile_id]
  );
  perform 1
  from public.learner_profile as profile
  where profile.id = p_learner_profile_id
  for update of profile;
  if not found then
    raise exception 'observed_learner_profile_not_found'
      using errcode = 'P0002';
  end if;
  select grant_row.id into v_grant_id
  from public.learner_observer_grant as grant_row
  where grant_row.observer_account_id = v_actor_account_id
    and grant_row.learner_profile_id = p_learner_profile_id
    and grant_row.status = 'active'
  for share of grant_row;
  if not found then
    raise exception 'observed_learner_profile_not_found'
      using errcode = 'P0002';
  end if;

  perform public.refresh_learning_activity_states_for_profile(
    p_learner_profile_id,
    null,
    v_generated_at
  );
  v_result := public.safe_learning_activity_profile_projection(
    p_learner_profile_id,
    v_generated_at
  );
  perform public.append_learner_identity_audit(
    'learner_observer_activity_profile_read',
    v_actor_account_id,
    null,
    p_learner_profile_id,
    null,
    null,
    jsonb_build_object(
      'projectionVersion', 1,
      'stateCap', 200,
      'evidenceReferenceCap', 5
    )
  );
  return v_result;
end
$function$;

revoke all on function public.get_observed_learner_activity_profile(uuid)
from public, anon, authenticated, service_role;
grant execute on function public.get_observed_learner_activity_profile(uuid)
to postgres, authenticated;

create function public.course_learning_activity_projection(
  p_learner_profile_ids uuid[],
  p_recorded_by_account_id uuid,
  p_course_id uuid,
  p_generated_at timestamptz
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $function$
  with profiles as materialized (
    select distinct submitted.id
    from unnest(coalesce(p_learner_profile_ids, '{}'::uuid[]))
      as submitted(id)
    where submitted.id is not null
  ), candidate as materialized (
    select
      state.id as state_id,
      state.learner_profile_id,
      state.recorded_by_account_id,
      state.source_learning_objective_id_at_time,
      state.source_course_id_at_time,
      state.course_title_at_time,
      state.subject_at_time,
      state.objective_title_at_time,
      state.status,
      state.reason_code,
      state.reason_text,
      state.evaluated_at,
      state.last_evidence_at,
      state.freshness_due_at,
      override_row.action as override_action,
      override_row.recommendation_type as override_type,
      true as has_data
    from public.learner_objective_state as state
    join profiles on profiles.id = state.learner_profile_id
    left join public.learner_recommendation_override as override_row
      on override_row.recorded_by_account_id =
        state.recorded_by_account_id
     and override_row.learner_profile_id = state.learner_profile_id
     and override_row.source_course_id_at_time =
        state.source_course_id_at_time
     and override_row.source_learning_objective_id_at_time =
        state.source_learning_objective_id_at_time
    where state.recorded_by_account_id = p_recorded_by_account_id
      and state.source_course_id_at_time = p_course_id

    union all

    select
      null::uuid,
      profiles.id,
      course.owner_account_id,
      objective.id,
      course.id,
      btrim(course.title),
      nullif(btrim(course.subject), ''),
      btrim(objective.title),
      'no_data'::text,
      'no_eligible_evidence'::text,
      'Пока нет подходящих наблюдений по этой учебной цели.'::text,
      greatest(course.updated_at, objective.updated_at),
      null::timestamptz,
      null::timestamptz,
      null::text,
      null::text,
      false
    from profiles
    join public.course as course
      on course.id = p_course_id
     and course.owner_account_id = p_recorded_by_account_id
     and course.archived_at is null
     and public.course_has_effective_learner(course.id, profiles.id)
    join public.learning_objective as objective
      on objective.course_id = course.id
     and objective.archived_at is null
    where not exists (
      select 1
      from public.learner_objective_state as state
      where state.learner_profile_id = profiles.id
        and state.recorded_by_account_id = p_recorded_by_account_id
        and state.source_course_id_at_time = course.id
        and state.source_learning_objective_id_at_time = objective.id
    )
  ), bounded as materialized (
    select candidate.*
    from candidate
    order by
      candidate.has_data desc,
      candidate.evaluated_at desc,
      candidate.course_title_at_time,
      candidate.objective_title_at_time,
      candidate.learner_profile_id,
      candidate.recorded_by_account_id,
      candidate.source_course_id_at_time,
      candidate.source_learning_objective_id_at_time,
      candidate.state_id nulls last
    limit 80
  ), projected as (
    select
      bounded.*,
      'las_' || encode(
        extensions.digest(
          case when bounded.state_id is null
            then 'course-no-data-v1:' || bounded.learner_profile_id::text || ':'
              || bounded.source_course_id_at_time::text || ':'
              || bounded.source_learning_objective_id_at_time::text
            else 'course-state-v1:' || bounded.learner_profile_id::text || ':'
              || bounded.state_id::text
          end,
          'sha256'
        ),
        'hex'
      ) as opaque_state_key,
      coalesce(evidence_projection.items, '[]'::jsonb)
        as evidence_items,
      coalesce(evidence_projection.keys, '[]'::jsonb)
        as evidence_keys
    from bounded
    left join lateral (
      select
        jsonb_agg(item.payload order by item.position) as items,
        jsonb_agg(to_jsonb(item.opaque_key) order by item.position) as keys
      from (
        select
          link.position,
          'lae_' || encode(
            extensions.digest(
              'course-evidence-v1:' || bounded.learner_profile_id::text || ':'
                || evidence.id::text,
              'sha256'
            ),
            'hex'
          ) as opaque_key,
          jsonb_build_object(
            'key', 'lae_' || encode(
              extensions.digest(
                'course-evidence-v1:'
                  || bounded.learner_profile_id::text || ':'
                  || evidence.id::text,
                'sha256'
              ),
              'hex'
            ),
            'direction', evidence.direction,
            'support', evidence.support,
            'observedAt', evidence.observed_at,
            'evidenceAt', evidence.materialized_at,
            'courseTitle', evidence.course_title_at_time,
            'lessonTitle', evidence.lesson_title_at_time,
            'componentLabel', case
              when evidence.component_visibility_at_time = 'learner_visible'
                then evidence.component_label_at_time
              else 'Служебный компонент преподавателя'
            end,
            'objectiveTitle', evidence.objective_title_at_time,
            'criterion', case
              when evidence.component_visibility_at_time = 'learner_visible'
                then evidence.criterion_at_time
              else 'Служебный критерий преподавателя'
            end
          ) as payload
        from public.learner_objective_state_evidence as link
        join public.learning_evidence as evidence
          on evidence.id = link.learning_evidence_id
        where link.learner_objective_state_id = bounded.state_id
        order by link.position
        limit 3
      ) as item
    ) as evidence_projection on bounded.state_id is not null
  ), state_items as (
    select
      projected.*,
      jsonb_build_object(
        'key', projected.opaque_state_key,
        'courseTitle', projected.course_title_at_time,
        'subject', projected.subject_at_time,
        'objectiveTitle', projected.objective_title_at_time,
        'state', projected.status,
        'reasonCode', projected.reason_code,
        'reasonText', projected.reason_text,
        'evaluatedAt', projected.evaluated_at,
        'lastEvidenceAt', projected.last_evidence_at,
        'freshnessDueAt', projected.freshness_due_at,
        'evidenceReferences', projected.evidence_items,
        'recommendation', case
          when projected.state_id is null
            or projected.override_action = 'dismiss'
            then null::jsonb
          else jsonb_build_object(
            'type', case
              when projected.override_action = 'replace'
                then projected.override_type
              when projected.reason_code = 'latest_not_yet' then 'repeat'
              when projected.reason_code = 'latest_with_support'
                then 'try_without_support'
              when projected.reason_code =
                'independent_opportunities_missing'
                then 'apply_in_new_context'
              when projected.reason_code =
                'multiple_independent_opportunities'
                then 'move_forward'
              else 'recheck_freshness'
            end,
            'reasonCode', case projected.reason_code
              when 'latest_not_yet' then 'repeat_after_not_yet'
              when 'latest_with_support'
                then 'try_without_support_after_supported_success'
              when 'independent_opportunities_missing'
                then 'apply_in_new_context_after_one_independent_opportunity'
              when 'multiple_independent_opportunities'
                then 'move_forward_after_confirmation'
              else 'recheck_due_to_freshness'
            end,
            'reasonText', case
              when projected.override_action = 'replace' then
                case projected.override_type
                  when 'repeat' then
                    'Повторите материал и попробуйте ещё раз.'
                  when 'try_without_support' then
                    'Попробуйте выполнить навык без подсказки.'
                  when 'apply_in_new_context' then
                    'Примените навык в новом контексте.'
                  when 'move_forward' then
                    'Можно переходить к следующему материалу.'
                  else
                    'Перепроверьте навык, чтобы обновить подтверждение.'
                end
              when projected.reason_code = 'latest_not_yet' then
                'Пока не получилось — повторите материал и попробуйте ещё раз.'
              when projected.reason_code = 'latest_with_support' then
                'Получилось с поддержкой — следующим шагом попробуйте без подсказки.'
              when projected.reason_code =
                'independent_opportunities_missing' then
                'Получилось самостоятельно один раз — примените навык в новом контексте.'
              when projected.reason_code =
                'multiple_independent_opportunities' then
                'Навык подтверждён в нескольких занятиях — можно переходить дальше.'
              else
                'Подтверждение давно не обновлялось — пора перепроверить навык.'
            end,
            'source', case when projected.override_action = 'replace'
              then 'teacher_override' else 'rule' end,
            'generatedAt', projected.evaluated_at,
            'evidenceReferenceKeys', projected.evidence_keys
          )
        end
      ) as payload
    from projected
  )
  select jsonb_build_object(
    'totalStateCount', (select count(*)::integer from candidate),
    'states', coalesce(
      jsonb_agg(
        state_items.payload order by
          state_items.has_data desc,
          state_items.evaluated_at desc,
          state_items.course_title_at_time,
          state_items.objective_title_at_time,
          state_items.learner_profile_id,
          state_items.recorded_by_account_id,
          state_items.source_course_id_at_time,
          state_items.source_learning_objective_id_at_time,
          state_items.state_id nulls last
      ),
      '[]'::jsonb
    )
  )
  from state_items;
$function$;

revoke all on function public.course_learning_activity_projection(
  uuid[], uuid, uuid, timestamptz
) from public, anon, authenticated, service_role;
grant execute on function public.course_learning_activity_projection(
  uuid[], uuid, uuid, timestamptz
) to postgres;

create function public.build_course_learning_activity_context(
  p_actor_auth_user_id uuid,
  p_course_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor_account_id uuid :=
    public.account_id_for_auth_user(p_actor_auth_user_id);
  v_initial_profile_ids uuid[];
  v_profile_ids uuid[];
  v_initial_audience_boundary text;
  v_audience_boundary text;
  v_course_boundary text;
  v_generated_at timestamptz := clock_timestamp();
  v_profile_id uuid;
  v_projection jsonb;
  v_states jsonb := '[]'::jsonb;
  v_total_state_count integer := 0;
  v_included_state_count integer := 0;
  v_forming_count integer := 0;
  v_confirmed_count integer := 0;
  v_recheck_due_count integer := 0;
  v_evidence_reference_count integer := 0;
  v_revision text;
  v_summary jsonb;
  v_unused jsonb := jsonb_build_object(
    'used', false,
    'revision', repeat('0', 64),
    'projectionVersion', 1,
    'summary', jsonb_build_object(
      'totalStateCount', 0,
      'includedStateCount', 0,
      'formingCount', 0,
      'confirmedCount', 0,
      'recheckDueCount', 0,
      'evidenceReferenceCount', 0,
      'truncated', false
    ),
    'states', '[]'::jsonb
  );
begin
  if v_actor_account_id is null or not exists (
    select 1
    from public.course as course
    where course.id = p_course_id
      and course.owner_account_id = v_actor_account_id
      and course.archived_at is null
  ) then
    raise exception 'course_not_found' using errcode = 'P0002';
  end if;

  with effective_audience as (
    select direct.learner_profile_id
    from public.course_learner as direct
    where direct.course_id = p_course_id
    union
    select member.learner_profile_id
    from public.course_learner_group as course_group
    join public.learner_group_member as member
      on member.learner_group_id = course_group.learner_group_id
    where course_group.course_id = p_course_id
  )
  select
    array_agg(
      effective_audience.learner_profile_id
      order by effective_audience.learner_profile_id
    ),
    string_agg(
      effective_audience.learner_profile_id::text,
      ',' order by effective_audience.learner_profile_id
    )
  into v_initial_profile_ids, v_initial_audience_boundary
  from effective_audience
  join public.learner_profile as profile
    on profile.id = effective_audience.learner_profile_id;

  if coalesce(cardinality(v_initial_profile_ids), 0) = 0 then
    return v_unused;
  end if;

  perform public.lock_learning_activity_learners(v_initial_profile_ids);
  select
    course.id::text || ':' || course.owner_account_id::text || ':'
      || course.updated_at::text
  into v_course_boundary
  from public.course as course
  where course.id = p_course_id
    and course.owner_account_id = v_actor_account_id
    and course.archived_at is null
  for update of course;
  if not found then
    raise exception 'course_not_found' using errcode = 'P0002';
  end if;

  perform direct.learner_profile_id
  from public.course_learner as direct
  where direct.course_id = p_course_id
  order by direct.learner_profile_id
  for share of direct;
  perform course_group.learner_group_id
  from public.course_learner_group as course_group
  where course_group.course_id = p_course_id
  order by course_group.learner_group_id
  for share of course_group;
  perform member.learner_profile_id
  from public.course_learner_group as course_group
  join public.learner_group_member as member
    on member.learner_group_id = course_group.learner_group_id
  where course_group.course_id = p_course_id
  order by member.learner_group_id, member.learner_profile_id
  for share of member;
  perform profile.id
  from public.learner_profile as profile
  where profile.id = any(v_initial_profile_ids)
  order by profile.id
  for update of profile;

  with effective_audience as (
    select direct.learner_profile_id
    from public.course_learner as direct
    where direct.course_id = p_course_id
    union
    select member.learner_profile_id
    from public.course_learner_group as course_group
    join public.learner_group_member as member
      on member.learner_group_id = course_group.learner_group_id
    where course_group.course_id = p_course_id
  )
  select
    array_agg(
      effective_audience.learner_profile_id
      order by effective_audience.learner_profile_id
    ),
    string_agg(
      effective_audience.learner_profile_id::text,
      ',' order by effective_audience.learner_profile_id
    )
  into v_profile_ids, v_audience_boundary
  from effective_audience
  join public.learner_profile as profile
    on profile.id = effective_audience.learner_profile_id;

  if v_profile_ids is distinct from v_initial_profile_ids
    or v_audience_boundary is distinct from v_initial_audience_boundary
  then
    raise exception 'learning_activity_context_changed'
      using errcode = '40001';
  end if;

  foreach v_profile_id in array v_profile_ids
  loop
    perform public.refresh_learning_activity_states_for_profile(
      v_profile_id,
      v_actor_account_id,
      v_generated_at
    );
  end loop;

  v_projection := public.course_learning_activity_projection(
    v_profile_ids,
    v_actor_account_id,
    p_course_id,
    v_generated_at
  );
  v_states := coalesce(v_projection -> 'states', '[]'::jsonb);
  v_total_state_count := coalesce(
    (v_projection ->> 'totalStateCount')::integer,
    0
  );
  v_included_state_count := jsonb_array_length(v_states);

  if v_included_state_count = 0 then
    return v_unused;
  end if;

  select
    count(*) filter (where item.value ->> 'state' = 'forming')::integer,
    count(*) filter (where item.value ->> 'state' = 'confirmed')::integer,
    count(*) filter (where item.value ->> 'state' = 'recheck_due')::integer,
    coalesce(sum(jsonb_array_length(
      item.value -> 'evidenceReferences'
    )), 0)::integer
  into
    v_forming_count,
    v_confirmed_count,
    v_recheck_due_count,
    v_evidence_reference_count
  from jsonb_array_elements(v_states) as item(value);

  v_revision := encode(
    extensions.digest(
      coalesce(v_course_boundary, '') || ':'
        || coalesce(v_audience_boundary, '') || ':'
        || v_total_state_count::text || ':' || v_states::text,
      'sha256'
    ),
    'hex'
  );
  v_summary := jsonb_build_object(
    'totalStateCount', v_total_state_count,
    'includedStateCount', v_included_state_count,
    'formingCount', v_forming_count,
    'confirmedCount', v_confirmed_count,
    'recheckDueCount', v_recheck_due_count,
    'evidenceReferenceCount', v_evidence_reference_count,
    'truncated', v_total_state_count > v_included_state_count
  );

  perform public.append_learner_identity_audit(
    'course_learning_activity_context_used',
    v_actor_account_id,
    null,
    null,
    null,
    p_course_id,
    jsonb_build_object(
      'effectiveAudienceCount', cardinality(v_profile_ids),
      'includedStateCount', v_included_state_count,
      'evidenceReferenceCount', v_evidence_reference_count,
      'projectionVersion', 1,
      'revision', v_revision
    )
  );

  return jsonb_build_object(
    'used', true,
    'revision', v_revision,
    'projectionVersion', 1,
    'summary', v_summary,
    'states', v_states
  );
end
$function$;

revoke all on function public.build_course_learning_activity_context(
  uuid, uuid
) from public, anon, authenticated, service_role;
grant execute on function public.build_course_learning_activity_context(
  uuid, uuid
) to postgres, service_role;

-- Existing finalized LA-M2 rows are materialized exactly once.  Honest LA-M1
-- observations without objective-at-time provenance remain outside evidence.
do $initial_materialization$
declare
  v_learner_profile_ids uuid[];
  v_learning_record_ids uuid[];
  v_projection_at timestamptz := clock_timestamp();
  v_key record;
begin
  select
    array_agg(distinct record.learner_profile_id
      order by record.learner_profile_id),
    array_agg(distinct record.id order by record.id)
  into v_learner_profile_ids, v_learning_record_ids
  from public.learning_record as record
  join public.lesson_component_observation as observation
    on observation.learning_record_id = record.id
   and observation.recorded_by_account_id = record.recorded_by_account_id
  where record.occurred_at is not null
    and record.was_present
    and record.superseded_by_record_id is null
    and observation.superseded_by_observation_id is null
    and observation.source_learning_objective_id_at_time is not null;

  if cardinality(coalesce(v_learning_record_ids, '{}'::uuid[])) > 0 then
    perform public.lock_learning_activity_learners(v_learner_profile_ids);
    perform public.materialize_learning_evidence_for_records(
      v_learning_record_ids,
      v_projection_at
    );
  end if;

  for v_key in
    select distinct
      evidence.recorded_by_account_id,
      evidence.learner_profile_id,
      evidence.source_learning_objective_id_at_time
    from public.learning_evidence as evidence
    where evidence.superseded_by_evidence_id is null
    order by
      evidence.recorded_by_account_id,
      evidence.learner_profile_id,
      evidence.source_learning_objective_id_at_time
  loop
    perform public.rebuild_learner_objective_state_for_actor(
      v_key.recorded_by_account_id,
      v_key.learner_profile_id,
      v_key.source_learning_objective_id_at_time,
      v_projection_at
    );
  end loop;
end
$initial_materialization$;

do $postflight$
declare
  v_baseline learning_activity_m3_baseline%rowtype;
  v_missing text;
begin
  select * into v_baseline from learning_activity_m3_baseline;

  if (select count(*) from public.learning_record) <>
      v_baseline.learning_record_count
    or (select count(*) from public.lesson_component_observation) <>
      v_baseline.observation_count
  then
    raise exception 'learning_activity_m3_postflight_source_rows_changed';
  end if;

  select string_agg(expected.name, ', ' order by expected.name)
  into v_missing
  from (
    values
      ('learning_evidence'),
      ('learner_objective_state'),
      ('learner_objective_state_evidence'),
      ('learner_recommendation_override')
  ) as expected(name)
  where to_regclass('public.' || expected.name) is null;
  if v_missing is not null then
    raise exception
      'learning_activity_m3_postflight_missing_tables:%',
      v_missing;
  end if;

  if exists (
    select 1
    from (
      values
        ('learning_evidence'),
        ('learner_objective_state'),
        ('learner_objective_state_evidence'),
        ('learner_recommendation_override')
    ) as expected(name)
    where not exists (
      select 1
      from pg_catalog.pg_class as relation
      join pg_catalog.pg_namespace as namespace
        on namespace.oid = relation.relnamespace
      where namespace.nspname = 'public'
        and relation.relname = expected.name
        and relation.relrowsecurity
    )
  ) then
    raise exception 'learning_activity_m3_postflight_rls_missing';
  end if;

  if to_regprocedure(
      'public.correct_finalized_lesson_component_observation(uuid,uuid,uuid,text,text,text,uuid,timestamp with time zone)'
    ) is null
    or to_regprocedure(
      'public.correct_finalized_lesson_component_observation(uuid,uuid,text,text,text,uuid,timestamp with time zone)'
    ) is not null
    or to_regprocedure(
      'public.get_teacher_learner_activity_profile(uuid)'
    ) is null
    or to_regprocedure(
      'public.get_teacher_learning_record_correction_history(uuid[])'
    ) is null
    or to_regprocedure(
      'public.get_my_learning_activity_profile()'
    ) is null
    or to_regprocedure(
      'public.get_observed_learner_activity_profile(uuid)'
    ) is null
    or to_regprocedure(
      'public.build_course_learning_activity_context(uuid,uuid)'
    ) is null
    or to_regprocedure(
      'public.build_cross_provider_learner_context(uuid,uuid)'
    ) is null
    or to_regprocedure(
      'public.build_cross_provider_learning_activity_context(uuid,uuid)'
    ) is not null
  then
    raise exception 'learning_activity_m3_postflight_rpc_signature';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_proc as procedure
    where procedure.oid in (
      to_regprocedure(
        'public.complete_lesson_run_v2(uuid,jsonb,text,timestamp with time zone,integer)'
      ),
      to_regprocedure(
        'public.correct_finalized_lesson_component_observation(uuid,uuid,uuid,text,text,text,uuid,timestamp with time zone)'
      ),
      to_regprocedure(
        'public.get_teacher_learning_record_correction_history(uuid[])'
      ),
      to_regprocedure(
        'public.get_teacher_learner_activity_profile(uuid)'
      ),
      to_regprocedure('public.get_my_learning_activity_profile()'),
      to_regprocedure(
        'public.get_observed_learner_activity_profile(uuid)'
      ),
      to_regprocedure(
        'public.build_course_learning_activity_context(uuid,uuid)'
      ),
      to_regprocedure(
        'public.execute_learner_profile_merge_for_actor(uuid,uuid,text)'
      ),
      to_regprocedure(
        'public.confirm_my_learning_data_erasure(uuid,text)'
      )
    )
      and (
        not procedure.prosecdef
        or not (
          procedure.proconfig @> array['search_path=""']::text[]
        )
      )
  ) then
    raise exception 'learning_activity_m3_postflight_rpc_security';
  end if;

  if not has_function_privilege(
      'service_role',
      'public.complete_lesson_run_v2(uuid,jsonb,text,timestamp with time zone,integer)',
      'EXECUTE'
    )
    or not has_function_privilege(
      'authenticated',
      'public.get_teacher_learner_activity_profile(uuid)',
      'EXECUTE'
    )
    or not has_function_privilege(
      'authenticated',
      'public.get_teacher_learning_record_correction_history(uuid[])',
      'EXECUTE'
    )
    or has_function_privilege(
      'service_role',
      'public.get_teacher_learning_record_correction_history(uuid[])',
      'EXECUTE'
    )
    or has_function_privilege(
      'anon',
      'public.get_teacher_learning_record_correction_history(uuid[])',
      'EXECUTE'
    )
    or not has_function_privilege(
      'authenticated',
      'public.get_my_learning_activity_profile()',
      'EXECUTE'
    )
    or not has_function_privilege(
      'authenticated',
      'public.get_observed_learner_activity_profile(uuid)',
      'EXECUTE'
    )
    or has_function_privilege(
      'anon',
      'public.get_my_learning_activity_profile()',
      'EXECUTE'
    )
    or has_function_privilege(
      'service_role',
      'public.get_my_learning_activity_profile()',
      'EXECUTE'
    )
    or not has_function_privilege(
      'service_role',
      'public.build_course_learning_activity_context(uuid,uuid)',
      'EXECUTE'
    )
    or has_function_privilege(
      'authenticated',
      'public.build_course_learning_activity_context(uuid,uuid)',
      'EXECUTE'
    )
    or has_function_privilege(
      'anon',
      'public.build_course_learning_activity_context(uuid,uuid)',
      'EXECUTE'
    )
    or not has_function_privilege(
      'service_role',
      'public.build_cross_provider_learner_context(uuid,uuid)',
      'EXECUTE'
    )
    or has_function_privilege(
      'authenticated',
      'public.build_cross_provider_learner_context(uuid,uuid)',
      'EXECUTE'
    )
    or has_function_privilege(
      'anon',
      'public.build_cross_provider_learner_context(uuid,uuid)',
      'EXECUTE'
    )
  then
    raise exception 'learning_activity_m3_postflight_rpc_acl';
  end if;

  if has_table_privilege(
      'service_role', 'public.learning_evidence', 'SELECT'
    )
    or has_table_privilege(
      'service_role', 'public.learner_objective_state', 'SELECT'
    )
    or has_table_privilege(
      'service_role', 'public.learner_objective_state_evidence', 'SELECT'
    )
    or has_table_privilege(
      'service_role', 'public.learner_recommendation_override', 'SELECT'
    )
    or has_table_privilege(
      'authenticated', 'public.learning_evidence', 'INSERT'
    )
    or has_table_privilege(
      'authenticated', 'public.learner_objective_state', 'UPDATE'
    )
    or has_table_privilege(
      'anon', 'public.learning_evidence', 'SELECT'
    )
    or not has_table_privilege(
      'authenticated', 'public.learning_evidence', 'SELECT'
    )
  then
    raise exception 'learning_activity_m3_postflight_table_acl';
  end if;

  -- Learner-safe and provider-safe projections must never serialize the
  -- teacher-only override note, even if a future refactor adds a broad row
  -- alias to either builder.  The teacher projection intentionally retains
  -- that private field and is therefore excluded from this sentinel.
  if position(
      'private_reason' in lower(pg_get_functiondef(to_regprocedure(
        'public.safe_learning_activity_profile_projection(uuid,timestamp with time zone)'
      )))
    ) > 0
    or position(
      'private_reason' in lower(pg_get_functiondef(to_regprocedure(
        'public.course_learning_activity_projection(uuid[],uuid,uuid,timestamp with time zone)'
      )))
    ) > 0
  then
    raise exception 'learning_activity_m3_postflight_private_projection';
  end if;

  if not exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'lesson_component_observation'
        and column_name = 'component_visibility_at_time'
        and data_type = 'text'
        and is_nullable = 'YES'
    )
    or not exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'learning_evidence'
        and column_name = 'component_visibility_at_time'
        and data_type = 'text'
        and is_nullable = 'NO'
    )
    or not exists (
      select 1
      from pg_catalog.pg_trigger as trigger
      where trigger.tgrelid =
          'public.lesson_component_observation'::regclass
        and trigger.tgname = 'trg_observation_component_visibility'
        and not trigger.tgisinternal
    )
    or position(
      'Служебный компонент преподавателя'
      in pg_get_functiondef(to_regprocedure(
        'public.safe_learning_activity_profile_projection(uuid,timestamp with time zone)'
      ))
    ) = 0
    or position(
      'Служебный компонент преподавателя'
      in pg_get_functiondef(to_regprocedure(
        'public.course_learning_activity_projection(uuid[],uuid,uuid,timestamp with time zone)'
      ))
    ) = 0
    or position(
      'Служебный критерий преподавателя'
      in pg_get_functiondef(to_regprocedure(
        'public.safe_learning_activity_profile_projection(uuid,timestamp with time zone)'
      ))
    ) = 0
    or position(
      'Служебный критерий преподавателя'
      in pg_get_functiondef(to_regprocedure(
        'public.course_learning_activity_projection(uuid[],uuid,uuid,timestamp with time zone)'
      ))
    ) = 0
  then
    raise exception 'learning_activity_m3_postflight_visibility_projection';
  end if;

  if position(
      'state.recorded_by_account_id = p_recorded_by_account_id'
      in pg_get_functiondef(to_regprocedure(
        'public.course_learning_activity_projection(uuid[],uuid,uuid,timestamp with time zone)'
      ))
    ) = 0
    or position(
      'state.source_course_id_at_time = p_course_id'
      in pg_get_functiondef(to_regprocedure(
        'public.course_learning_activity_projection(uuid[],uuid,uuid,timestamp with time zone)'
      ))
    ) = 0
  then
    raise exception 'learning_activity_m3_postflight_course_context_scope';
  end if;

  if not exists (
      select 1 from pg_catalog.pg_constraint
      where conrelid = 'public.learning_evidence'::regclass
        and conname = 'learning_evidence_record_identity_fkey'
        and contype = 'f' and convalidated
    )
    or not exists (
      select 1 from pg_catalog.pg_constraint
      where conrelid =
        'public.learner_objective_state_evidence'::regclass
        and conname =
          'learner_objective_state_evidence_state_identity_fkey'
        and contype = 'f' and convalidated
    )
    or not exists (
      select 1 from pg_catalog.pg_constraint
      where conrelid =
        'public.learner_objective_state_evidence'::regclass
        and conname =
          'learner_objective_state_evidence_fact_identity_fkey'
        and contype = 'f' and convalidated
    )
  then
    raise exception 'learning_activity_m3_postflight_identity_fk';
  end if;

  if exists (
      select 1
      from public.learning_evidence as evidence
      join public.lesson_component_observation as observation
        on observation.id = evidence.source_observation_id
      where observation.source_learning_objective_id_at_time is null
    )
    or exists (
      select 1
      from public.learner_objective_state as state
      where not exists (
        select 1
        from public.learner_objective_state_evidence as link
        where link.learner_objective_state_id = state.id
      )
    )
    or exists (
      select 1
      from public.learner_objective_state_evidence as link
      join public.learner_objective_state as state
        on state.id = link.learner_objective_state_id
      join public.learning_evidence as evidence
        on evidence.id = link.learning_evidence_id
      where (
        link.recorded_by_account_id,
        link.learner_profile_id,
        link.source_course_id_at_time,
        link.source_learning_objective_id_at_time
      ) is distinct from (
        state.recorded_by_account_id,
        state.learner_profile_id,
        state.source_course_id_at_time,
        state.source_learning_objective_id_at_time
      )
        or (
          link.recorded_by_account_id,
          link.learner_profile_id,
          link.source_course_id_at_time,
          link.source_learning_objective_id_at_time
        ) is distinct from (
          evidence.recorded_by_account_id,
          evidence.learner_profile_id,
          evidence.source_course_id_at_time,
          evidence.source_learning_objective_id_at_time
        )
    )
    or exists (
      select 1
      from public.learning_evidence as evidence
      where evidence.supersedes_evidence_id is not null
        and not exists (
          select 1 from public.learning_evidence as prior
          where prior.id = evidence.supersedes_evidence_id
            and prior.superseded_by_evidence_id = evidence.id
        )
    )
    or exists (
      select 1
      from public.learning_evidence as evidence
      where evidence.superseded_by_evidence_id is not null
        and not exists (
          select 1 from public.learning_evidence as replacement
          where replacement.id = evidence.superseded_by_evidence_id
            and replacement.supersedes_evidence_id = evidence.id
        )
    )
  then
    raise exception 'learning_activity_m3_postflight_projection_invariant';
  end if;
end
$postflight$;

notify pgrst, 'reload schema';

commit;
