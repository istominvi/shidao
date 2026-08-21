begin;

-- LA-M5: one complete persisted online activity for the existing choice_quiz
-- registry type. Raw activity tables are deliberately closed; browser access
-- is only through the narrow service-role RPCs below and application-safe
-- projections.

-- `auth.uid()` alone outlives both a Supabase sign-out and ShiDao's own
-- Account session cutoff for the remaining JWT lifetime. Keep the deployed
-- broad Account helper byte-compatible, and add a scoped resolver for the
-- sensitive evidence read boundary. It accepts only the exact Supabase
-- session named by the signed `session_id` claim and a live Account. Existing
-- authenticated profile readers treat both active and provisional as live;
-- suspended/deleted Accounts fail closed.
create function public.current_active_session_account_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $function$
  with request_context as materialized (
    select
      (select auth.uid()) as auth_user_id,
      lower(coalesce(
        (select auth.jwt() ->> 'session_id'),
        ''
      )) as session_id
  )
  select account.id
  from request_context
  join public.account as account
    on account.auth_user_id = request_context.auth_user_id
   and account.status in ('active', 'provisional')
  join public.account_security as security
    on security.account_id = account.id
  join auth.sessions as session
    on session.user_id = request_context.auth_user_id
   and session.id::text = request_context.session_id
  where request_context.auth_user_id is not null
    and request_context.session_id ~ (
      '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-'
      || '[0-9a-f]{4}-[0-9a-f]{12}$'
    )
    and session.created_at is not null
    and (
      session.not_after is null
      or session.not_after > statement_timestamp()
    )
    and (
      security.sessions_invalid_before is null
      or session.created_at >= security.sessions_invalid_before
    )
  limit 1;
$function$;

revoke all on function public.current_active_session_account_id()
  from public, anon, authenticated, service_role;
grant execute on function public.current_active_session_account_id()
  to authenticated, postgres;

drop policy learning_evidence_recorder_select on public.learning_evidence;
create policy learning_evidence_recorder_select
on public.learning_evidence
for select
to authenticated
using (
  recorded_by_account_id = (
    select public.current_active_session_account_id()
  )
);

drop policy learner_objective_state_recorder_select
  on public.learner_objective_state;
create policy learner_objective_state_recorder_select
on public.learner_objective_state
for select
to authenticated
using (
  recorded_by_account_id = (
    select public.current_active_session_account_id()
  )
);

drop policy learner_objective_state_evidence_recorder_select
  on public.learner_objective_state_evidence;
create policy learner_objective_state_evidence_recorder_select
on public.learner_objective_state_evidence
for select
to authenticated
using (
  exists (
    select 1
    from public.learner_objective_state as state
    where state.id = learner_objective_state_evidence.learner_objective_state_id
      and state.recorded_by_account_id = (
        select public.current_active_session_account_id()
      )
  )
);

drop policy learner_recommendation_override_recorder_select
  on public.learner_recommendation_override;
create policy learner_recommendation_override_recorder_select
on public.learner_recommendation_override
for select
to authenticated
using (
  recorded_by_account_id = (
    select public.current_active_session_account_id()
  )
);

-- Call only after the relevant learner advisory lock. This volatile helper
-- takes and retains the canonical Session -> Account/account_security SHARE
-- locks, closing cutoff/deactivation TOCTOU for authenticated mutations and
-- profile refreshes without accepting a browser-supplied authority UUID.
create function public.lock_current_account_session_authority(
  p_expected_account_id uuid
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_auth_user_id uuid := (select auth.uid());
  v_session_id text := lower(coalesce(
    (select auth.jwt() ->> 'session_id'),
    ''
  ));
  v_session_created_at timestamptz;
  v_session_not_after timestamptz;
begin
  if p_expected_account_id is null
    or v_auth_user_id is null
    or v_session_id !~ (
      '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-'
      || '[0-9a-f]{4}-[0-9a-f]{12}$'
    )
  then
    return false;
  end if;

  select session.created_at, session.not_after
  into v_session_created_at, v_session_not_after
  from auth.sessions as session
  where session.id::text = v_session_id
    and session.user_id = v_auth_user_id
  for share of session;
  if not found
    or v_session_created_at is null
    or (
      v_session_not_after is not null
      and v_session_not_after <= clock_timestamp()
    )
  then
    return false;
  end if;

  perform 1
  from public.account as account
  join public.account_security as security
    on security.account_id = account.id
  where account.id = p_expected_account_id
    and account.auth_user_id = v_auth_user_id
    and account.status in ('active', 'provisional')
    and (
      security.sessions_invalid_before is null
      or v_session_created_at >= security.sessions_invalid_before
    )
  for share of account, security;
  return found;
end
$function$;

revoke all on function public.lock_current_account_session_authority(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.lock_current_account_session_authority(uuid)
  to postgres;

create function public.choice_quiz_learner_definition_is_valid(
  p_definition jsonb
)
returns boolean
language sql
immutable
set search_path = ''
as $function$
  select
    jsonb_typeof(p_definition) = 'object'
    and not exists (
      select 1
      from jsonb_object_keys(coalesce(p_definition, '{}'::jsonb)) as key(value)
      where key.value not in ('question', 'options', 'allowMultiple')
    )
    and jsonb_typeof(p_definition -> 'question') = 'string'
    and char_length(btrim(p_definition ->> 'question')) between 1 and 2000
    and jsonb_typeof(p_definition -> 'allowMultiple') = 'boolean'
    and jsonb_typeof(p_definition -> 'options') = 'array'
    and jsonb_array_length(p_definition -> 'options') between 2 and 20
    and not exists (
      select 1
      from jsonb_array_elements(p_definition -> 'options') as option(value)
      where jsonb_typeof(option.value) <> 'object'
        or not (option.value ? 'id' and option.value ? 'label')
        or exists (
          select 1
          from jsonb_object_keys(option.value) as option_key(value)
          where option_key.value not in ('id', 'label')
        )
        or jsonb_typeof(option.value -> 'id') <> 'string'
        or not ((option.value ->> 'id') ~* (
          '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-'
          || '[0-9a-f]{4}-[0-9a-f]{12}$'
        ))
        or jsonb_typeof(option.value -> 'label') <> 'string'
        or char_length(btrim(option.value ->> 'label')) not between 1 and 500
    )
    and (
      select count(*) = count(distinct lower(option.value ->> 'id'))
      from jsonb_array_elements(p_definition -> 'options') as option(value)
    );
$function$;

create function public.choice_quiz_evaluator_config_is_valid(
  p_definition jsonb,
  p_config jsonb
)
returns boolean
language sql
immutable
set search_path = ''
as $function$
  select
    public.choice_quiz_learner_definition_is_valid(p_definition)
    and jsonb_typeof(p_config) = 'object'
    and not exists (
      select 1
      from jsonb_object_keys(coalesce(p_config, '{}'::jsonb)) as key(value)
      where key.value not in (
        'correctOptionIds', 'allowMultiple', 'explanation'
      )
    )
    and jsonb_typeof(p_config -> 'correctOptionIds') = 'array'
    and jsonb_array_length(p_config -> 'correctOptionIds') between 1 and 20
    and jsonb_typeof(p_config -> 'allowMultiple') = 'boolean'
    and (p_config ->> 'allowMultiple')::boolean =
      (p_definition ->> 'allowMultiple')::boolean
    and (
      (p_config ->> 'allowMultiple')::boolean
      or jsonb_array_length(p_config -> 'correctOptionIds') = 1
    )
    and (
      not (p_config ? 'explanation')
      or p_config -> 'explanation' = 'null'::jsonb
      or (
        jsonb_typeof(p_config -> 'explanation') = 'string'
        and char_length(btrim(p_config ->> 'explanation')) between 1 and 4000
      )
    )
    and not exists (
      select 1
      from jsonb_array_elements(p_config -> 'correctOptionIds') as answer(value)
      where jsonb_typeof(answer.value) <> 'string'
        or not ((answer.value #>> '{}') ~* (
          '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-'
          || '[0-9a-f]{4}-[0-9a-f]{12}$'
        ))
        or not exists (
          select 1
          from jsonb_array_elements(p_definition -> 'options') as option(value)
          where lower(option.value ->> 'id') =
            lower(answer.value #>> '{}')
        )
    )
    and (
      select count(*) = count(distinct lower(answer.value #>> '{}'))
      from jsonb_array_elements(p_config -> 'correctOptionIds') as answer(value)
    );
$function$;

revoke all on function public.choice_quiz_learner_definition_is_valid(jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.choice_quiz_learner_definition_is_valid(jsonb)
  to postgres;
revoke all on function public.choice_quiz_evaluator_config_is_valid(jsonb, jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.choice_quiz_evaluator_config_is_valid(jsonb, jsonb)
  to postgres;

create table public.choice_quiz_issue (
  id uuid primary key default gen_random_uuid(),
  learner_ref text not null default (
    'cqi_' || encode(extensions.gen_random_bytes(32), 'hex')
  ),
  learning_record_id uuid,
  learner_profile_id uuid not null,
  recorded_by_account_id uuid not null,
  source_course_id_at_time uuid not null,
  source_lesson_id_at_time uuid not null,
  source_lesson_run_id_at_time uuid not null,
  source_component_id_at_time uuid not null,
  source_learning_objective_id_at_time uuid,
  lesson_component_id uuid,
  learning_objective_id uuid,
  course_title_at_time text not null,
  lesson_title_at_time text not null,
  subject_at_time text,
  component_type_at_time text not null,
  component_position_at_time integer not null,
  component_schema_version integer not null,
  component_updated_at timestamp with time zone not null,
  objective_title_at_time text,
  activity_role text not null,
  cursor_revision bigint not null,
  learner_definition jsonb not null,
  evaluator_config jsonb not null,
  definition_revision text not null,
  evaluator_version text not null default 'choice_quiz_exact_set_v1',
  evaluator_fingerprint text not null,
  execution_policy_version integer not null default 1,
  evidence_policy_version integer not null default 2,
  max_attempts integer not null,
  issued_at timestamp with time zone not null default clock_timestamp(),
  constraint choice_quiz_issue_learner_ref_check
    check (learner_ref ~ '^cqi_[0-9a-f]{64}$'),
  constraint choice_quiz_issue_learner_ref_unique unique (learner_ref),
  constraint choice_quiz_issue_context_check check (
    char_length(btrim(course_title_at_time)) between 1 and 240
    and char_length(btrim(lesson_title_at_time)) between 1 and 240
    and (
      subject_at_time is null
      or char_length(btrim(subject_at_time)) between 1 and 240
    )
    and component_type_at_time = 'choice_quiz'
    and component_position_at_time > 0
    and component_schema_version = 1
    and (
      objective_title_at_time is null
      or char_length(btrim(objective_title_at_time)) between 1 and 240
    )
  ),
  constraint choice_quiz_issue_role_policy_check check (
    (activity_role = 'practice' and max_attempts = 3)
    or (activity_role = 'assessment' and max_attempts = 1)
  ),
  constraint choice_quiz_issue_cursor_check check (cursor_revision >= 1),
  constraint choice_quiz_issue_definition_check check (
    public.choice_quiz_evaluator_config_is_valid(
      learner_definition,
      evaluator_config
    )
  ),
  constraint choice_quiz_issue_fingerprint_check check (
    definition_revision ~ '^cqd_v1_[0-9a-f]{64}$'
    and evaluator_fingerprint ~ '^cqef_v1_[0-9a-f]{64}$'
  ),
  constraint choice_quiz_issue_version_check check (
    evaluator_version = 'choice_quiz_exact_set_v1'
    and execution_policy_version = 1
    and evidence_policy_version = 2
  ),
  constraint choice_quiz_issue_live_component_check check (
    lesson_component_id is null
    or lesson_component_id = source_component_id_at_time
  ),
  constraint choice_quiz_issue_live_objective_check check (
    learning_objective_id is null
    or learning_objective_id = source_learning_objective_id_at_time
  ),
  constraint choice_quiz_issue_objective_shape_check check (
    (source_learning_objective_id_at_time is null
      and objective_title_at_time is null
      and learning_objective_id is null)
    or (source_learning_objective_id_at_time is not null
      and objective_title_at_time is not null)
  ),
  constraint choice_quiz_issue_record_identity_fkey foreign key (
    learning_record_id,
    learner_profile_id,
    recorded_by_account_id
  ) references public.learning_record(
    id,
    learner_profile_id,
    recorded_by_account_id
  ) on update cascade on delete cascade,
  constraint choice_quiz_issue_learner_profile_id_fkey foreign key (
    learner_profile_id
  ) references public.learner_profile(id) on delete restrict,
  constraint choice_quiz_issue_recorded_by_account_id_fkey foreign key (
    recorded_by_account_id
  ) references public.account(id) on delete restrict,
  constraint choice_quiz_issue_lesson_component_id_fkey foreign key (
    lesson_component_id
  ) references public.lesson_component(id) on delete set null,
  constraint choice_quiz_issue_learning_objective_id_fkey foreign key (
    learning_objective_id
  ) references public.learning_objective(id) on delete set null,
  constraint choice_quiz_issue_stable_definition_unique unique (
    learning_record_id,
    source_component_id_at_time,
    definition_revision
  ),
  constraint choice_quiz_issue_id_learner_unique unique (
    id,
    learner_profile_id
  )
);

create table public.choice_quiz_attempt (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid not null,
  learner_profile_id uuid not null,
  attempt_number integer not null,
  idempotency_key uuid not null,
  request_fingerprint text not null,
  cursor_revision bigint not null,
  support text not null,
  hint_available boolean not null default false,
  hint_count integer not null default 0,
  submitted_at timestamp with time zone not null default clock_timestamp(),
  constraint choice_quiz_attempt_issue_learner_fkey foreign key (
    issue_id,
    learner_profile_id
  ) references public.choice_quiz_issue(id, learner_profile_id)
    on update cascade on delete cascade,
  constraint choice_quiz_attempt_number_check check (
    attempt_number between 1 and 3
  ),
  constraint choice_quiz_attempt_idempotency_unique unique (idempotency_key),
  constraint choice_quiz_attempt_issue_number_unique unique (
    issue_id,
    attempt_number
  ),
  constraint choice_quiz_attempt_request_fingerprint_check check (
    request_fingerprint ~ '^[0-9a-f]{64}$'
  ),
  constraint choice_quiz_attempt_cursor_check check (cursor_revision >= 1),
  constraint choice_quiz_attempt_support_check check (
    (attempt_number = 1 and support = 'independent')
    or (attempt_number > 1 and support = 'with_support')
  ),
  constraint choice_quiz_attempt_hint_check check (
    not hint_available and hint_count = 0
  ),
  constraint choice_quiz_attempt_id_issue_unique unique (id, issue_id)
);

create table public.choice_quiz_response (
  attempt_id uuid primary key,
  issue_id uuid not null,
  selected_option_ids uuid[] not null,
  selected_options jsonb not null,
  response_version integer not null default 1,
  created_at timestamp with time zone not null default clock_timestamp(),
  constraint choice_quiz_response_attempt_issue_fkey foreign key (
    attempt_id,
    issue_id
  ) references public.choice_quiz_attempt(id, issue_id) on delete cascade,
  constraint choice_quiz_response_option_ids_check check (
    cardinality(selected_option_ids) between 1 and 20
    and array_position(selected_option_ids, null) is null
  ),
  constraint choice_quiz_response_selected_options_check check (
    jsonb_typeof(selected_options) = 'array'
    and jsonb_array_length(selected_options) = cardinality(selected_option_ids)
  ),
  constraint choice_quiz_response_version_check check (response_version = 1)
);

create table public.choice_quiz_evaluation (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null,
  issue_id uuid not null,
  evaluation_source text not null,
  is_correct boolean not null,
  score smallint not null,
  evaluator_version text not null,
  evaluator_fingerprint text not null,
  evaluator_config jsonb not null,
  supersedes_evaluation_id uuid,
  superseded_by_evaluation_id uuid,
  corrected_by_account_id uuid,
  correction_reason text,
  correction_idempotency_key uuid,
  evaluated_at timestamp with time zone not null default clock_timestamp(),
  constraint choice_quiz_evaluation_attempt_issue_fkey foreign key (
    attempt_id,
    issue_id
  ) references public.choice_quiz_attempt(id, issue_id) on delete cascade,
  constraint choice_quiz_evaluation_source_check check (
    evaluation_source in ('initial', 'teacher_correction')
  ),
  constraint choice_quiz_evaluation_score_check check (
    score in (0, 1)
    and is_correct = (score = 1)
  ),
  constraint choice_quiz_evaluation_version_check check (
    evaluator_version = 'choice_quiz_exact_set_v1'
    and evaluator_fingerprint ~ '^cqef_v1_[0-9a-f]{64}$'
    and jsonb_typeof(evaluator_config) = 'object'
  ),
  constraint choice_quiz_evaluation_correction_shape_check check (
    (evaluation_source = 'initial'
      and supersedes_evaluation_id is null
      and corrected_by_account_id is null
      and correction_reason is null
      and correction_idempotency_key is null)
    or (evaluation_source = 'teacher_correction'
      and supersedes_evaluation_id is not null
      and corrected_by_account_id is not null
      and char_length(btrim(correction_reason)) between 1 and 500
      and correction_idempotency_key is not null)
  ),
  constraint choice_quiz_evaluation_not_self_superseded_check check (
    (supersedes_evaluation_id is null or supersedes_evaluation_id <> id)
    and (
      superseded_by_evaluation_id is null
      or superseded_by_evaluation_id <> id
    )
  ),
  constraint choice_quiz_evaluation_supersedes_fkey foreign key (
    supersedes_evaluation_id
  ) references public.choice_quiz_evaluation(id)
    deferrable initially deferred,
  constraint choice_quiz_evaluation_superseded_by_fkey foreign key (
    superseded_by_evaluation_id
  ) references public.choice_quiz_evaluation(id)
    deferrable initially deferred,
  constraint choice_quiz_evaluation_corrected_by_fkey foreign key (
    corrected_by_account_id
  ) references public.account(id) on delete restrict,
  constraint choice_quiz_evaluation_id_attempt_unique unique (id, attempt_id)
);

create unique index choice_quiz_evaluation_initial_unique
  on public.choice_quiz_evaluation(attempt_id)
  where evaluation_source = 'initial';
create unique index choice_quiz_evaluation_supersedes_unique
  on public.choice_quiz_evaluation(supersedes_evaluation_id)
  where supersedes_evaluation_id is not null;
create unique index choice_quiz_evaluation_correction_idempotency_unique
  on public.choice_quiz_evaluation(
    corrected_by_account_id,
    correction_idempotency_key
  ) where correction_idempotency_key is not null;

create table public.choice_quiz_feedback_delivery (
  id uuid primary key default gen_random_uuid(),
  evaluation_id uuid not null,
  attempt_id uuid not null,
  issue_id uuid not null,
  correctness_delivered boolean not null,
  score_delivered smallint not null,
  can_retry boolean not null,
  answer_revealed boolean not null,
  revealed_correct_option_ids uuid[],
  revealed_explanation text,
  feedback_policy_version integer not null default 1,
  delivered_at timestamp with time zone not null default clock_timestamp(),
  constraint choice_quiz_feedback_evaluation_attempt_fkey foreign key (
    evaluation_id,
    attempt_id
  ) references public.choice_quiz_evaluation(id, attempt_id) on delete cascade,
  constraint choice_quiz_feedback_attempt_issue_fkey foreign key (
    attempt_id,
    issue_id
  ) references public.choice_quiz_attempt(id, issue_id) on delete cascade,
  constraint choice_quiz_feedback_evaluation_unique unique (evaluation_id),
  constraint choice_quiz_feedback_score_check check (
    score_delivered in (0, 1)
    and correctness_delivered = (score_delivered = 1)
  ),
  constraint choice_quiz_feedback_reveal_check check (
    (not answer_revealed
      and revealed_correct_option_ids is null
      and revealed_explanation is null)
    or (answer_revealed
      and cardinality(revealed_correct_option_ids) between 1 and 20
      and array_position(revealed_correct_option_ids, null) is null)
  ),
  constraint choice_quiz_feedback_explanation_check check (
    revealed_explanation is null
    or char_length(btrim(revealed_explanation)) between 1 and 4000
  ),
  constraint choice_quiz_feedback_version_check check (
    feedback_policy_version = 1
  )
);

create index choice_quiz_issue_history_idx
  on public.choice_quiz_issue(
    recorded_by_account_id,
    source_lesson_run_id_at_time,
    issued_at,
    id
  );
create index choice_quiz_issue_learner_history_idx
  on public.choice_quiz_issue(learner_profile_id, issued_at, id);
create index choice_quiz_attempt_issue_idx
  on public.choice_quiz_attempt(issue_id, attempt_number);
create index choice_quiz_evaluation_attempt_idx
  on public.choice_quiz_evaluation(attempt_id, evaluated_at, id);

alter table public.choice_quiz_issue enable row level security;
alter table public.choice_quiz_attempt enable row level security;
alter table public.choice_quiz_response enable row level security;
alter table public.choice_quiz_evaluation enable row level security;
alter table public.choice_quiz_feedback_delivery enable row level security;

revoke all on table public.choice_quiz_issue
  from public, anon, authenticated, service_role;
revoke all on table public.choice_quiz_attempt
  from public, anon, authenticated, service_role;
revoke all on table public.choice_quiz_response
  from public, anon, authenticated, service_role;
revoke all on table public.choice_quiz_evaluation
  from public, anon, authenticated, service_role;
revoke all on table public.choice_quiz_feedback_delivery
  from public, anon, authenticated, service_role;
grant all on table public.choice_quiz_issue to postgres;
grant all on table public.choice_quiz_attempt to postgres;
grant all on table public.choice_quiz_response to postgres;
grant all on table public.choice_quiz_evaluation to postgres;
grant all on table public.choice_quiz_feedback_delivery to postgres;

create function public.guard_choice_quiz_issue_immutable()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if tg_op = 'DELETE' then
    if coalesce(current_setting('app.learner_identity_erasure', true), '') <> 'on'
    then
      raise exception 'choice_quiz_issue_immutable' using errcode = '55000';
    end if;
    return old;
  end if;

  if (to_jsonb(new) - array[
        'learning_record_id',
        'learner_profile_id', 'lesson_component_id', 'learning_objective_id'
      ]) is distinct from
     (to_jsonb(old) - array[
        'learning_record_id',
        'learner_profile_id', 'lesson_component_id', 'learning_objective_id'
      ])
  then
    raise exception 'choice_quiz_issue_immutable' using errcode = '55000';
  end if;

  if new.learning_record_id is distinct from old.learning_record_id
    and not (
      old.learning_record_id is not null
      and new.learning_record_id is null
      and coalesce(
        current_setting('app.choice_quiz_record_detach', true), ''
      ) = 'on'
    )
  then
    raise exception 'choice_quiz_issue_immutable' using errcode = '55000';
  end if;

  if new.learner_profile_id is distinct from old.learner_profile_id
    and coalesce(current_setting('app.learner_identity_merge', true), '') <> 'on'
  then
    raise exception 'choice_quiz_issue_immutable' using errcode = '55000';
  end if;

  if new.lesson_component_id is distinct from old.lesson_component_id
    and not (
      old.lesson_component_id is not null
      and new.lesson_component_id is null
    )
  then
    raise exception 'choice_quiz_issue_immutable' using errcode = '55000';
  end if;

  if new.learning_objective_id is distinct from old.learning_objective_id
    and not (
      old.learning_objective_id is not null
      and new.learning_objective_id is null
    )
  then
    raise exception 'choice_quiz_issue_immutable' using errcode = '55000';
  end if;

  return new;
end
$function$;

create function public.guard_choice_quiz_attempt_immutable()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if tg_op = 'DELETE' then
    if coalesce(current_setting('app.learner_identity_erasure', true), '') <> 'on'
    then
      raise exception 'choice_quiz_attempt_immutable' using errcode = '55000';
    end if;
    return old;
  end if;

  if (to_jsonb(new) - 'learner_profile_id') is distinct from
     (to_jsonb(old) - 'learner_profile_id')
    or (
      new.learner_profile_id is distinct from old.learner_profile_id
      and coalesce(current_setting('app.learner_identity_merge', true), '') <> 'on'
    )
  then
    raise exception 'choice_quiz_attempt_immutable' using errcode = '55000';
  end if;
  return new;
end
$function$;

create function public.guard_choice_quiz_strictly_immutable()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if tg_op = 'DELETE'
    and coalesce(current_setting('app.learner_identity_erasure', true), '') = 'on'
  then
    return old;
  end if;
  raise exception 'choice_quiz_history_immutable' using errcode = '55000';
end
$function$;

create function public.guard_choice_quiz_evaluation_immutable()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if tg_op = 'DELETE' then
    if coalesce(current_setting('app.learner_identity_erasure', true), '') <> 'on'
    then
      raise exception 'choice_quiz_evaluation_immutable' using errcode = '55000';
    end if;
    return old;
  end if;

  if (to_jsonb(new) - 'superseded_by_evaluation_id') is distinct from
      (to_jsonb(old) - 'superseded_by_evaluation_id')
    or (
      new.superseded_by_evaluation_id is distinct from
        old.superseded_by_evaluation_id
      and coalesce(current_setting('app.choice_quiz_correction', true), '') <> 'on'
    )
  then
    raise exception 'choice_quiz_evaluation_immutable' using errcode = '55000';
  end if;
  return new;
end
$function$;

create function public.assert_choice_quiz_evaluation_supersession_chain()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_other public.choice_quiz_evaluation%rowtype;
begin
  if new.supersedes_evaluation_id is not null then
    select evaluation.* into strict v_other
    from public.choice_quiz_evaluation as evaluation
    where evaluation.id = new.supersedes_evaluation_id;
    if v_other.attempt_id <> new.attempt_id
      or v_other.issue_id <> new.issue_id
      or v_other.superseded_by_evaluation_id is distinct from new.id
    then
      raise exception 'choice_quiz_evaluation_supersession_invalid'
        using errcode = '23514';
    end if;
  end if;

  if new.superseded_by_evaluation_id is not null then
    select evaluation.* into strict v_other
    from public.choice_quiz_evaluation as evaluation
    where evaluation.id = new.superseded_by_evaluation_id;
    if v_other.attempt_id <> new.attempt_id
      or v_other.issue_id <> new.issue_id
      or v_other.supersedes_evaluation_id is distinct from new.id
    then
      raise exception 'choice_quiz_evaluation_supersession_invalid'
        using errcode = '23514';
    end if;
  end if;
  return null;
exception
  when no_data_found then
    raise exception 'choice_quiz_evaluation_supersession_invalid'
      using errcode = '23514';
end
$function$;

create trigger trg_choice_quiz_issue_immutable
before delete or update on public.choice_quiz_issue
for each row execute function public.guard_choice_quiz_issue_immutable();
create trigger trg_choice_quiz_attempt_immutable
before delete or update on public.choice_quiz_attempt
for each row execute function public.guard_choice_quiz_attempt_immutable();
create trigger trg_choice_quiz_response_immutable
before delete or update on public.choice_quiz_response
for each row execute function public.guard_choice_quiz_strictly_immutable();
create trigger trg_choice_quiz_evaluation_immutable
before delete or update on public.choice_quiz_evaluation
for each row execute function public.guard_choice_quiz_evaluation_immutable();
create trigger trg_choice_quiz_feedback_immutable
before delete or update on public.choice_quiz_feedback_delivery
for each row execute function public.guard_choice_quiz_strictly_immutable();
create constraint trigger trg_choice_quiz_evaluation_supersession_chain
after insert or update of
  supersedes_evaluation_id,
  superseded_by_evaluation_id,
  attempt_id,
  issue_id
on public.choice_quiz_evaluation
deferrable initially deferred
for each row execute function
  public.assert_choice_quiz_evaluation_supersession_chain();

revoke all on function public.guard_choice_quiz_issue_immutable()
  from public, anon, authenticated, service_role;
revoke all on function public.guard_choice_quiz_attempt_immutable()
  from public, anon, authenticated, service_role;
revoke all on function public.guard_choice_quiz_strictly_immutable()
  from public, anon, authenticated, service_role;
revoke all on function public.guard_choice_quiz_evaluation_immutable()
  from public, anon, authenticated, service_role;
revoke all on function public.assert_choice_quiz_evaluation_supersession_chain()
  from public, anon, authenticated, service_role;
grant execute on function public.guard_choice_quiz_issue_immutable() to postgres;
grant execute on function public.guard_choice_quiz_attempt_immutable() to postgres;
grant execute on function public.guard_choice_quiz_strictly_immutable() to postgres;
grant execute on function public.guard_choice_quiz_evaluation_immutable() to postgres;
grant execute on function
  public.assert_choice_quiz_evaluation_supersession_chain() to postgres;

create function public.guard_learning_record_choice_quiz_presence()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if new.occurred_at is not null
    and new.was_present is false
    and exists (
      select 1
      from public.choice_quiz_issue as issue
      join public.choice_quiz_attempt as attempt on attempt.issue_id = issue.id
      where issue.learner_profile_id = new.learner_profile_id
        and issue.source_lesson_run_id_at_time = coalesce(
          new.source_lesson_run_id_at_time,
          new.lesson_run_id
        )
    )
  then
    raise exception 'learning_record_absent_has_choice_quiz_attempt'
      using errcode = '55000';
  end if;
  return new;
end
$function$;

revoke all on function public.guard_learning_record_choice_quiz_presence()
  from public, anon, authenticated, service_role;
grant execute on function public.guard_learning_record_choice_quiz_presence()
  to postgres;

create trigger trg_learning_record_choice_quiz_presence
before insert or update of
  occurred_at,
  was_present,
  learner_profile_id,
  lesson_run_id,
  source_lesson_run_id_at_time
on public.learning_record
for each row execute function public.guard_learning_record_choice_quiz_presence();

-- Cancelling a Run must not erase an already issued durable activity envelope.
-- Detach Choice Quiz history from its temporary roster anchor before removing
-- every unfinalized LearningRecord; a cancelled run must not leave an eternal
-- draft that blocks identity merge or Lesson deletion.
create or replace function public.cancel_lesson_run(
  p_lesson_run_id uuid,
  p_cancelled_at timestamptz default now()
)
returns public.lesson_run
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor_user_id uuid := (select auth.uid());
  v_actor_account_id uuid;
  v_course_id uuid;
  v_lesson_id uuid;
  v_run public.lesson_run%rowtype;
begin
  if v_actor_user_id is null then
    raise exception 'lesson_run_not_found' using errcode = 'P0002';
  end if;

  if p_cancelled_at is null then
    raise exception
      'lesson_run_cancelled_at_required'
      using errcode = '22023';
  end if;

  select course.id, run.lesson_id, account.id
  into v_course_id, v_lesson_id, v_actor_account_id
  from public.lesson_run as run
  join public.lesson as lesson on lesson.id = run.lesson_id
  join public.course as course on course.id = lesson.course_id
  join public.account as account on account.id = course.owner_account_id
  where run.id = p_lesson_run_id
    and account.auth_user_id = v_actor_user_id;

  if not found then
    raise exception 'lesson_run_not_found' using errcode = 'P0002';
  end if;

  if not public.lock_current_account_session_authority(
    v_actor_account_id
  ) then
    raise exception 'lesson_run_not_found' using errcode = 'P0002';
  end if;

  perform 1
  from public.course as course
  join public.account as account on account.id = course.owner_account_id
  where course.id = v_course_id
    and account.auth_user_id = v_actor_user_id
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

  if v_run.cancelled_at is not null then
    return v_run;
  end if;

  if v_run.ended_at is not null then
    raise exception
      'lesson_run_already_completed'
      using errcode = '55000';
  end if;

  if v_run.started_at is not null
    and p_cancelled_at < v_run.started_at
  then
    raise exception
      'lesson_run_cancelled_before_start'
      using errcode = '22007';
  end if;

  perform 1
  from public.learning_record as record
  where record.lesson_run_id = p_lesson_run_id
  order by record.id
  for update;

  if exists (
    select 1
    from public.learning_record as record
    where record.lesson_run_id = p_lesson_run_id
      and record.occurred_at is not null
  ) then
    raise exception
      'lesson_run_contains_finalized_records'
      using errcode = '55000';
  end if;

  perform public.detach_choice_quiz_history_from_learning_records(
    array(
      select record.id
      from public.learning_record as record
      where record.lesson_run_id = p_lesson_run_id
        and record.occurred_at is null
      order by record.id
    )
  );

  delete from public.learning_record as record
  where record.lesson_run_id = p_lesson_run_id
    and record.occurred_at is null;

  update public.lesson_run as run
  set cancelled_at = p_cancelled_at
  where run.id = p_lesson_run_id
  returning run.* into v_run;

  return v_run;
end
$function$;

alter table public.learning_evidence
  alter column learning_record_id drop not null;
alter table public.learning_evidence
  alter column source_observation_id drop not null;
alter table public.learning_evidence
  add column source_choice_quiz_evaluation_id uuid;
alter table public.learning_evidence
  add constraint learning_evidence_choice_quiz_evaluation_id_key
    unique (source_choice_quiz_evaluation_id);
alter table public.learning_evidence
  add constraint learning_evidence_choice_quiz_evaluation_fkey
    foreign key (source_choice_quiz_evaluation_id)
    references public.choice_quiz_evaluation(id) on delete cascade;
-- Keep the deployed LA-M3 record-scoped raw history observation-only during
-- DB-first rollout and application rollback. Quiz evidence has its own frozen
-- Run/Component/objective context and immutable source Evaluation, while the
-- Issue retains the temporary LearningRecord lifecycle anchor.
alter table public.learning_evidence
  add constraint learning_evidence_exact_source_check check (
    (
      source_observation_id is not null
      and source_choice_quiz_evaluation_id is null
      and learning_record_id is not null
    )
    or (
      source_observation_id is null
      and source_choice_quiz_evaluation_id is not null
      and learning_record_id is null
    )
  );
alter table public.learning_evidence
  drop constraint learning_evidence_semantics_check;
alter table public.learning_evidence
  add constraint learning_evidence_semantics_check check (
    (source_observation_id is not null
      and source_choice_quiz_evaluation_id is null
      and (
        (direction = 'positive'
          and support = 'independent'
          and reason_code = 'independent_positive_evidence')
        or (direction = 'positive'
          and support = 'with_support'
          and reason_code = 'supported_positive_evidence')
        or (direction = 'negative'
          and support is null
          and reason_code = 'not_yet_negative_evidence')
      ))
    or (source_observation_id is null
      and source_choice_quiz_evaluation_id is not null
      and (
        (direction = 'positive'
          and support = 'independent'
          and reason_code = 'choice_quiz_independent_positive_evidence')
        or (direction = 'positive'
          and support = 'with_support'
          and reason_code = 'choice_quiz_supported_positive_evidence')
        or (direction = 'negative'
          and support is null
          and reason_code = 'choice_quiz_not_yet_negative_evidence')
      ))
  );
alter table public.learning_evidence
  drop constraint learning_evidence_version_check;
alter table public.learning_evidence
  add constraint learning_evidence_version_check check (
    evidence_version = 1
    and (
      (source_observation_id is not null and eligibility_policy_version = 1)
      or (
        source_choice_quiz_evaluation_id is not null
        and eligibility_policy_version = 2
      )
    )
  );

create or replace function public.guard_learning_evidence_immutable()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if tg_op = 'DELETE' then
    if coalesce(current_setting('app.learner_identity_erasure', true), '') <> 'on'
    then
      raise exception 'learning_evidence_immutable' using errcode = '55000';
    end if;
    return old;
  end if;

  if (to_jsonb(new) - array[
        'learner_profile_id',
        'lesson_component_id',
        'learning_objective_id',
        'superseded_by_evidence_id'
      ]) is distinct from
     (to_jsonb(old) - array[
        'learner_profile_id',
        'lesson_component_id',
        'learning_objective_id',
        'superseded_by_evidence_id'
      ])
  then
    raise exception 'learning_evidence_immutable' using errcode = '55000';
  end if;

  if new.lesson_component_id is distinct from old.lesson_component_id
    and not (
      old.lesson_component_id is not null
      and new.lesson_component_id is null
    )
  then
    raise exception 'learning_evidence_immutable' using errcode = '55000';
  end if;
  if new.learning_objective_id is distinct from old.learning_objective_id
    and not (
      old.learning_objective_id is not null
      and new.learning_objective_id is null
    )
  then
    raise exception 'learning_evidence_immutable' using errcode = '55000';
  end if;
  if new.learner_profile_id is distinct from old.learner_profile_id
    and coalesce(current_setting('app.learner_identity_merge', true), '') <> 'on'
  then
    raise exception 'learning_evidence_immutable' using errcode = '55000';
  end if;
  if new.superseded_by_evidence_id is distinct from
      old.superseded_by_evidence_id
    and coalesce(
      current_setting('app.learning_activity_materialization', true), ''
    ) <> 'on'
  then
    raise exception 'learning_evidence_immutable' using errcode = '55000';
  end if;
  return new;
end
$function$;

create function public.detach_choice_quiz_history_from_learning_records(
  p_learning_record_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_previous_mode text := coalesce(
    current_setting('app.choice_quiz_record_detach', true),
    ''
  );
begin
  if p_learning_record_ids is null
    or cardinality(p_learning_record_ids) = 0
  then
    return;
  end if;
  if array_position(p_learning_record_ids, null) is not null then
    raise exception 'choice_quiz_record_detach_invalid' using errcode = '22023';
  end if;

  perform set_config('app.choice_quiz_record_detach', 'on', true);

  -- Every cross-graph writer uses Evidence -> Issue after the common Record
  -- barrier. Do not rely on FK trigger order for component/lifecycle cleanup.
  update public.learning_evidence as evidence
  set lesson_component_id = null,
      learning_objective_id = null
  from public.choice_quiz_evaluation as evaluation
  join public.choice_quiz_issue as issue
    on issue.id = evaluation.issue_id
  where evidence.source_choice_quiz_evaluation_id = evaluation.id
    and issue.learning_record_id = any(p_learning_record_ids);

  update public.choice_quiz_issue as issue
  set learning_record_id = null,
      lesson_component_id = null,
      learning_objective_id = null
  where issue.learning_record_id = any(p_learning_record_ids);

  perform set_config(
    'app.choice_quiz_record_detach',
    v_previous_mode,
    true
  );
end
$function$;

revoke all on function public.detach_choice_quiz_history_from_learning_records(
  uuid[]
) from public, anon, authenticated, service_role;
grant execute on function public.detach_choice_quiz_history_from_learning_records(
  uuid[]
) to postgres;

-- Canonical authoring deletion now takes Course -> Lesson and the shared
-- Record -> Evidence -> Issue child order explicitly. A merged/superseded
-- record can have lesson_run_id = NULL, so the old Record-only barrier was not
-- sufficient to define FK SET NULL ordering for retained quiz history.
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
  v_actor_account_id uuid;
  v_course_id uuid;
  v_lesson_id uuid;
  v_deleted_count integer;
begin
  if v_actor_user_id is null then
    return false;
  end if;

  select course.id, lesson.id, account.id
  into v_course_id, v_lesson_id, v_actor_account_id
  from public.lesson_component as component
  join public.lesson as lesson on lesson.id = component.lesson_id
  join public.course as course on course.id = lesson.course_id
  join public.account as account on account.id = course.owner_account_id
  where component.id = p_component_id
    and account.auth_user_id = v_actor_user_id;

  if not found then
    return false;
  end if;

  if not public.lock_current_account_session_authority(
    v_actor_account_id
  ) then
    return false;
  end if;

  perform 1
  from public.course as course
  join public.account as account on account.id = course.owner_account_id
  where course.id = v_course_id
    and account.auth_user_id = v_actor_user_id
  for update of course;
  if not found then
    return false;
  end if;

  perform 1
  from public.lesson as lesson
  where lesson.id = v_lesson_id
    and lesson.course_id = v_course_id
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

  perform evidence.id
  from public.learning_evidence as evidence
  where evidence.lesson_component_id = p_component_id
  order by evidence.id
  for update of evidence;

  perform issue.id
  from public.choice_quiz_issue as issue
  where issue.lesson_component_id = p_component_id
  order by issue.id
  for update of issue;

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
  v_actor_account_id uuid;
  v_course_id uuid;
begin
  if v_actor_user_id is null then
    raise exception 'lesson_not_found' using errcode = 'P0002';
  end if;

  select course.id, account.id
  into v_course_id, v_actor_account_id
  from public.lesson as lesson
  join public.course as course on course.id = lesson.course_id
  join public.account as account on account.id = course.owner_account_id
  where lesson.id = p_lesson_id
    and account.auth_user_id = v_actor_user_id;
  if not found then
    raise exception 'lesson_not_found' using errcode = 'P0002';
  end if;

  if not public.lock_current_account_session_authority(
    v_actor_account_id
  ) then
    raise exception 'lesson_not_found' using errcode = 'P0002';
  end if;

  perform 1
  from public.course as course
  join public.account as account on account.id = course.owner_account_id
  where course.id = v_course_id
    and account.auth_user_id = v_actor_user_id
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

  perform evidence.id
  from public.learning_evidence as evidence
  join public.lesson_component as component
    on component.id = evidence.lesson_component_id
  where component.lesson_id = p_lesson_id
  order by evidence.id
  for update of evidence;

  perform issue.id
  from public.choice_quiz_issue as issue
  join public.lesson_component as component
    on component.id = issue.lesson_component_id
  where component.lesson_id = p_lesson_id
  order by issue.id
  for update of issue;

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

create or replace function public.delete_draft_learning_records_for_lesson_run()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  perform public.detach_choice_quiz_history_from_learning_records(
    array(
      select record.id
      from public.learning_record as record
      where record.lesson_run_id = old.id
        and record.occurred_at is null
      order by record.id
    )
  );

  delete from public.learning_record as record
  where record.lesson_run_id = old.id
    and record.occurred_at is null;

  return old;
end
$function$;

create function public.choice_quiz_projection_matches_payload(
  p_payload jsonb,
  p_learner_definition jsonb,
  p_evaluator_config jsonb
)
returns boolean
language sql
immutable
set search_path = ''
as $function$
  select
    public.choice_quiz_evaluator_config_is_valid(
      p_learner_definition,
      p_evaluator_config
    )
    and jsonb_typeof(p_payload) = 'object'
    and p_payload ->> 'question' = p_learner_definition ->> 'question'
    and p_payload -> 'allowMultiple' =
      p_learner_definition -> 'allowMultiple'
    and jsonb_typeof(p_payload -> 'options') = 'array'
    and jsonb_array_length(p_payload -> 'options') =
      jsonb_array_length(p_learner_definition -> 'options')
    and not exists (
      select 1
      from jsonb_array_elements(
        p_learner_definition -> 'options'
      ) as delivered(value)
      where not exists (
        select 1
        from jsonb_array_elements(p_payload -> 'options') as authored(value)
        where lower(authored.value ->> 'id') =
            lower(delivered.value ->> 'id')
          and authored.value ->> 'label' = delivered.value ->> 'label'
      )
    )
    and not exists (
      select 1
      from jsonb_array_elements(p_payload -> 'options') as authored(value)
      where (authored.value ->> 'isCorrect')::boolean is distinct from
        exists (
          select 1
          from jsonb_array_elements(
            p_evaluator_config -> 'correctOptionIds'
          ) as answer(value)
          where lower(answer.value #>> '{}') =
            lower(authored.value ->> 'id')
        )
    )
    and coalesce(p_payload -> 'explanation', 'null'::jsonb) =
      coalesce(p_evaluator_config -> 'explanation', 'null'::jsonb);
$function$;

create function public.choice_quiz_execution_payload_at_attempt(
  p_issue_id uuid,
  p_attempt_count integer
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_issue public.choice_quiz_issue%rowtype;
  v_latest jsonb;
  v_can_submit boolean;
begin
  select issue.* into strict v_issue
  from public.choice_quiz_issue as issue
  where issue.id = p_issue_id;

  if p_attempt_count is null
    or p_attempt_count < 0
    or p_attempt_count > v_issue.max_attempts
  then
    raise exception 'choice_quiz_execution_invalid' using errcode = '22023';
  end if;

  select jsonb_build_object(
    'attemptNumber', attempt.attempt_number,
    'selectedOptionIds', to_jsonb(response.selected_option_ids),
    'isCorrect', feedback.correctness_delivered,
    'score', feedback.score_delivered,
    'submittedAt', attempt.submitted_at,
    'canRetry', feedback.can_retry,
    'reveal', case
      when feedback.answer_revealed then
        jsonb_strip_nulls(jsonb_build_object(
          'correctOptionIds', to_jsonb(feedback.revealed_correct_option_ids),
          'explanation', feedback.revealed_explanation
        ))
      else null
    end
  )
  into v_latest
  from public.choice_quiz_attempt as attempt
  join public.choice_quiz_response as response
    on response.attempt_id = attempt.id
  join public.choice_quiz_evaluation as evaluation
    on evaluation.attempt_id = attempt.id
   and evaluation.evaluation_source = 'initial'
  join public.choice_quiz_feedback_delivery as feedback
    on feedback.evaluation_id = evaluation.id
  where attempt.issue_id = v_issue.id
    and attempt.attempt_number = p_attempt_count;

  if p_attempt_count > 0 and v_latest is null then
    raise exception 'choice_quiz_execution_invalid' using errcode = '22023';
  end if;

  v_can_submit := case
    when p_attempt_count = 0 then true
    when p_attempt_count >= v_issue.max_attempts then false
    else coalesce((v_latest ->> 'canRetry')::boolean, false)
  end;

  return jsonb_build_object(
    'issueRef', v_issue.learner_ref,
    'definitionRevision', v_issue.definition_revision,
    'attemptCount', p_attempt_count,
    'maxAttempts', v_issue.max_attempts,
    'remainingAttempts', greatest(v_issue.max_attempts - p_attempt_count, 0),
    'canSubmit', v_can_submit,
    'hintAvailable', false,
    'hintCount', 0,
    'latestFeedback', v_latest
  );
end
$function$;

create function public.choice_quiz_execution_payload(p_issue_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_attempt_count integer;
begin
  select count(*)::integer
  into v_attempt_count
  from public.choice_quiz_attempt as attempt
  where attempt.issue_id = p_issue_id;

  return public.choice_quiz_execution_payload_at_attempt(
    p_issue_id,
    v_attempt_count
  );
end
$function$;

revoke all on function public.choice_quiz_projection_matches_payload(
  jsonb, jsonb, jsonb
) from public, anon, authenticated, service_role;
grant execute on function public.choice_quiz_projection_matches_payload(
  jsonb, jsonb, jsonb
) to postgres;
revoke all on function public.choice_quiz_execution_payload_at_attempt(
  uuid, integer
) from public, anon, authenticated, service_role;
grant execute on function public.choice_quiz_execution_payload_at_attempt(
  uuid, integer
) to postgres;
revoke all on function public.choice_quiz_execution_payload(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.choice_quiz_execution_payload(uuid)
  to postgres;

create function public.issue_choice_quiz_definition_admin(
  p_auth_user_id uuid,
  p_session_id uuid,
  p_lesson_run_id uuid,
  p_component_id uuid,
  p_cursor_revision bigint,
  p_expected_component_updated_at timestamp with time zone,
  p_learner_definition jsonb,
  p_evaluator_config jsonb
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_live jsonb;
  v_account_id uuid;
  v_learner_profile_id uuid;
  v_locked_learner_profile_id uuid;
  v_course_id uuid;
  v_sessions_invalid_before timestamptz;
  v_session_created_at timestamptz;
  v_session_not_after timestamptz;
  v_source record;
  v_objective_title text;
  v_definition_revision text;
  v_evaluator_fingerprint text;
  v_issue_id uuid;
begin
  if p_lesson_run_id is null
    or p_component_id is null
    or p_cursor_revision is null
    or p_cursor_revision < 1
    or p_expected_component_updated_at is null
    or not public.choice_quiz_evaluator_config_is_valid(
      p_learner_definition,
      p_evaluator_config
    )
  then
    raise exception 'choice_quiz_issue_invalid' using errcode = '22023';
  end if;

  -- Follow the canonical writer order: learner advisory, identity, Course,
  -- Lesson, then resolver/Run. Course-first prevents the reverse Course edit
  -- path from forming Course <-> Lesson cycles.
  select profile.id
  into v_locked_learner_profile_id
  from public.account as account
  join public.learner_profile as profile on profile.account_id = account.id
  where account.auth_user_id = p_auth_user_id
    and account.status = 'active';
  if not found then
    raise exception 'choice_quiz_issue_not_found' using errcode = 'P0002';
  end if;

  perform public.lock_learning_activity_learners(
    array[v_locked_learner_profile_id]
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
    raise exception 'choice_quiz_session_revoked' using errcode = '42501';
  end if;

  select account.id, profile.id
  into v_account_id, v_learner_profile_id
  from public.account as account
  join public.learner_profile as profile on profile.account_id = account.id
  where account.auth_user_id = p_auth_user_id
    and account.status = 'active'
    and profile.id = v_locked_learner_profile_id
  for share of account, profile;
  if not found then
    raise exception 'choice_quiz_issue_not_found' using errcode = 'P0002';
  end if;

  select security.sessions_invalid_before
  into v_sessions_invalid_before
  from public.account_security as security
  where security.account_id = v_account_id
  for share of security;
  if not found
    or (
      v_sessions_invalid_before is not null
      and v_session_created_at < v_sessions_invalid_before
    )
  then
    raise exception 'choice_quiz_session_revoked' using errcode = '42501';
  end if;

  select course.id
  into v_course_id
  from public.lesson_run as run
  join public.lesson as lesson on lesson.id = run.lesson_id
  join public.course as course on course.id = lesson.course_id
  where run.id = p_lesson_run_id;
  if not found then
    raise exception 'choice_quiz_issue_stale' using errcode = '40001';
  end if;

  perform 1
  from public.course as course
  where course.id = v_course_id
  for share of course;
  if not found then
    raise exception 'choice_quiz_issue_stale' using errcode = '40001';
  end if;

  perform 1
  from public.lesson_run as run
  join public.lesson as lesson on lesson.id = run.lesson_id
  where run.id = p_lesson_run_id
    and lesson.course_id = v_course_id
  for share of lesson;
  if not found then
    raise exception 'choice_quiz_issue_stale' using errcode = '40001';
  end if;

  v_live := public.resolve_lesson_run_live_source_admin(
    p_auth_user_id,
    p_session_id,
    p_lesson_run_id
  );
  if v_live ->> 'state' <> 'live'
    or (v_live ->> 'cursorRevision')::bigint <> p_cursor_revision
  then
    raise exception 'choice_quiz_issue_stale' using errcode = '40001';
  end if;

  select
    component.id as component_id,
    component.payload as component_payload,
    component.position as component_position,
    component.schema_version as component_schema_version,
    component.updated_at as component_updated_at,
    component.primary_learning_objective_id,
    component.activity_role,
    course.id as course_id,
    course.title as course_title,
    course.subject as course_subject,
    lesson.id as lesson_id,
    lesson.title as lesson_title,
    record.id as learning_record_id,
    record.recorded_by_account_id
  into v_source
  from public.lesson_run as run
  join public.lesson as lesson on lesson.id = run.lesson_id
  join public.course as course on course.id = lesson.course_id
  join public.lesson_run_presentation_state as presentation
    on presentation.lesson_run_id = run.id
  join public.lesson_component as component
    on component.lesson_id = lesson.id
   and component.student_slide_id = presentation.student_slide_id
  join public.learning_record as record
    on record.lesson_run_id = run.id
   and record.learner_profile_id = v_learner_profile_id
   and record.superseded_by_record_id is null
  where run.id = p_lesson_run_id
    and presentation.cursor_version = p_cursor_revision
    and component.id = p_component_id
    and component.type_key = 'choice_quiz'
    and component.schema_version = 1
    and component.visibility = 'learner_visible'
    and component.activity_role in ('practice', 'assessment')
    and component.updated_at = p_expected_component_updated_at
  for share of run, lesson, course, presentation, component, record;

  if not found then
    raise exception 'choice_quiz_issue_stale' using errcode = '40001';
  end if;
  if not public.choice_quiz_projection_matches_payload(
    v_source.component_payload,
    p_learner_definition,
    p_evaluator_config
  ) then
    raise exception 'choice_quiz_issue_projection_invalid'
      using errcode = '23514';
  end if;

  if v_source.primary_learning_objective_id is not null then
    select objective.title into v_objective_title
    from public.learning_objective as objective
    where objective.id = v_source.primary_learning_objective_id;
    if not found then
      raise exception 'choice_quiz_issue_stale' using errcode = '40001';
    end if;
  end if;

  v_evaluator_fingerprint := 'cqef_v1_' || encode(extensions.digest(
    jsonb_build_object(
      'evaluatorVersion', 'choice_quiz_exact_set_v1',
      'componentSchemaVersion', v_source.component_schema_version,
      'executionPolicyVersion', 1,
      'evidencePolicyVersion', 2,
      'config', p_evaluator_config
    )::text,
    'sha256'
  ), 'hex');
  v_definition_revision := 'cqd_v1_' || encode(extensions.digest(
    jsonb_build_object(
      'sourceComponentId', v_source.component_id,
      'componentUpdatedAt', v_source.component_updated_at,
      'componentSchemaVersion', v_source.component_schema_version,
      'activityRole', v_source.activity_role,
      'sourceLearningObjectiveId',
        v_source.primary_learning_objective_id,
      'learnerDefinition', p_learner_definition,
      'evaluatorFingerprint', v_evaluator_fingerprint
    )::text,
    'sha256'
  ), 'hex');

  insert into public.choice_quiz_issue (
    learning_record_id,
    learner_profile_id,
    recorded_by_account_id,
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
    component_position_at_time,
    component_schema_version,
    component_updated_at,
    objective_title_at_time,
    activity_role,
    cursor_revision,
    learner_definition,
    evaluator_config,
    definition_revision,
    evaluator_fingerprint,
    max_attempts
  ) values (
    v_source.learning_record_id,
    v_learner_profile_id,
    v_source.recorded_by_account_id,
    v_source.course_id,
    v_source.lesson_id,
    p_lesson_run_id,
    v_source.component_id,
    v_source.primary_learning_objective_id,
    v_source.component_id,
    v_source.primary_learning_objective_id,
    v_source.course_title,
    v_source.lesson_title,
    v_source.course_subject,
    'choice_quiz',
    v_source.component_position,
    v_source.component_schema_version,
    v_source.component_updated_at,
    v_objective_title,
    v_source.activity_role,
    p_cursor_revision,
    p_learner_definition,
    p_evaluator_config,
    v_definition_revision,
    v_evaluator_fingerprint,
    case when v_source.activity_role = 'practice' then 3 else 1 end
  )
  on conflict (
    learning_record_id,
    source_component_id_at_time,
    definition_revision
  ) do nothing
  returning id into v_issue_id;

  if v_issue_id is null then
    select issue.id into strict v_issue_id
    from public.choice_quiz_issue as issue
    where issue.learning_record_id = v_source.learning_record_id
      and issue.source_component_id_at_time = v_source.component_id
      and issue.definition_revision = v_definition_revision;
  end if;

  return jsonb_build_object(
    'learnerDefinition', (
      select issue.learner_definition
      from public.choice_quiz_issue as issue
      where issue.id = v_issue_id
    ),
    'execution', public.choice_quiz_execution_payload(v_issue_id)
  );
end
$function$;

revoke all on function public.issue_choice_quiz_definition_admin(
  uuid, uuid, uuid, uuid, bigint, timestamptz, jsonb, jsonb
) from public, anon, authenticated;
grant execute on function public.issue_choice_quiz_definition_admin(
  uuid, uuid, uuid, uuid, bigint, timestamptz, jsonb, jsonb
) to service_role, postgres;

create function public.submit_choice_quiz_attempt_admin(
  p_auth_user_id uuid,
  p_session_id uuid,
  p_lesson_run_id uuid,
  p_issue_ref text,
  p_cursor_revision bigint,
  p_idempotency_key uuid,
  p_selected_option_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_live jsonb;
  v_account_id uuid;
  v_learner_profile_id uuid;
  v_locked_learner_profile_id uuid;
  v_course_id uuid;
  v_sessions_invalid_before timestamp with time zone;
  v_session_created_at timestamp with time zone;
  v_session_not_after timestamp with time zone;
  v_issue public.choice_quiz_issue%rowtype;
  v_component public.lesson_component%rowtype;
  v_selected_option_ids uuid[];
  v_correct_option_ids uuid[];
  v_selected_options jsonb;
  v_request_fingerprint text;
  v_existing_attempt public.choice_quiz_attempt%rowtype;
  v_attempt_count integer;
  v_attempt_number integer;
  v_previous_correct boolean;
  v_attempt_id uuid;
  v_evaluation_id uuid;
  v_is_correct boolean;
  v_can_retry boolean;
  v_answer_revealed boolean;
  v_explanation text;
  v_now timestamp with time zone := clock_timestamp();
  v_evidence_id uuid;
  v_current_definition_revision text;
begin
  if p_auth_user_id is null
    or p_session_id is null
    or p_lesson_run_id is null
    or p_issue_ref is null
    or p_issue_ref !~ '^cqi_[0-9a-f]{64}$'
    or p_cursor_revision is null
    or p_cursor_revision < 1
    or p_idempotency_key is null
    or p_selected_option_ids is null
    or cardinality(p_selected_option_ids) not between 1 and 20
    or array_position(p_selected_option_ids, null) is not null
  then
    raise exception 'choice_quiz_attempt_invalid' using errcode = '22023';
  end if;

  select array_agg(selected.id order by selected.id)
  into v_selected_option_ids
  from (
    select distinct submitted.id
    from unnest(p_selected_option_ids) as submitted(id)
  ) as selected;
  if cardinality(v_selected_option_ids) <>
      cardinality(p_selected_option_ids)
  then
    raise exception 'choice_quiz_attempt_invalid' using errcode = '22023';
  end if;

  -- A committed idempotent result remains replayable after cursor/lifecycle
  -- changes, but never after session cutoff or canonical identity loss. Match
  -- the canonical learner -> Session -> identity/security lock order, then
  -- take Lesson/Run only for a genuinely new attempt. The first session read
  -- is deliberately lock-free; authority is re-read after the learner lock.
  select session.created_at, session.not_after
  into v_session_created_at, v_session_not_after
  from auth.sessions as session
  where session.id = p_session_id
    and session.user_id = p_auth_user_id;
  if not found
    or v_session_created_at is null
    or (
      v_session_not_after is not null
      and v_session_not_after <= clock_timestamp()
    )
  then
    raise exception 'choice_quiz_session_revoked' using errcode = '42501';
  end if;

  select profile.id
  into v_locked_learner_profile_id
  from public.account as account
  join public.learner_profile as profile on profile.account_id = account.id
  where account.auth_user_id = p_auth_user_id
    and account.status = 'active';
  if not found then
    raise exception 'choice_quiz_attempt_not_found' using errcode = 'P0002';
  end if;

  perform public.lock_learning_activity_learners(
    array[v_locked_learner_profile_id]
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
    raise exception 'choice_quiz_session_revoked' using errcode = '42501';
  end if;

  select account.id, profile.id
  into v_account_id, v_learner_profile_id
  from public.account as account
  join public.learner_profile as profile on profile.account_id = account.id
  where account.auth_user_id = p_auth_user_id
    and account.status = 'active'
    and profile.id = v_locked_learner_profile_id
  for share of account, profile;
  if not found then
    raise exception 'choice_quiz_attempt_not_found' using errcode = 'P0002';
  end if;

  select security.sessions_invalid_before
  into v_sessions_invalid_before
  from public.account_security as security
  where security.account_id = v_account_id
  for share of security;
  if not found then
    raise exception 'choice_quiz_session_revoked' using errcode = '42501';
  end if;
  if v_sessions_invalid_before is not null
    and v_session_created_at < v_sessions_invalid_before
  then
    raise exception 'choice_quiz_session_revoked' using errcode = '42501';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'shidao-choice-quiz-idempotency-v1:' || p_idempotency_key::text,
      0
    )
  );

  select issue.* into v_issue
  from public.choice_quiz_issue as issue
  where issue.learner_ref = p_issue_ref
    and issue.learner_profile_id = v_learner_profile_id
    and issue.source_lesson_run_id_at_time = p_lesson_run_id;
  if not found then
    raise exception 'choice_quiz_attempt_not_found' using errcode = 'P0002';
  end if;

  v_request_fingerprint := encode(extensions.digest(
    jsonb_build_object(
      'issueRef', p_issue_ref,
      'cursorRevision', p_cursor_revision,
      'selectedOptionIds', to_jsonb(v_selected_option_ids)
    )::text,
    'sha256'
  ), 'hex');

  select course.id
  into v_course_id
  from public.lesson_run as run
  join public.lesson as lesson on lesson.id = run.lesson_id
  join public.course as course on course.id = lesson.course_id
  where run.id = p_lesson_run_id;
  if not found then
    raise exception 'choice_quiz_attempt_stale' using errcode = '40001';
  end if;

  perform 1
  from public.course as course
  where course.id = v_course_id
  for share of course;
  if not found then
    raise exception 'choice_quiz_attempt_stale' using errcode = '40001';
  end if;

  perform 1
  from public.lesson_run as run
  join public.lesson as lesson on lesson.id = run.lesson_id
  where run.id = p_lesson_run_id
    and lesson.course_id = v_course_id
  for share of lesson;
  if not found then
    raise exception 'choice_quiz_attempt_stale' using errcode = '40001';
  end if;

  v_live := public.resolve_lesson_run_live_source_admin(
    p_auth_user_id,
    p_session_id,
    p_lesson_run_id
  );

  -- Replays may outlive cursor movement or an ended Run, but never current
  -- enrollment/capability/Course authority: the resolver above revalidates
  -- those rows before any persisted feedback crosses the learner boundary.
  select attempt.* into v_existing_attempt
  from public.choice_quiz_attempt as attempt
  where attempt.idempotency_key = p_idempotency_key;
  if found then
    if v_existing_attempt.issue_id <> v_issue.id
      or v_existing_attempt.request_fingerprint <> v_request_fingerprint
    then
      raise exception 'choice_quiz_idempotency_conflict'
        using errcode = '23505';
    end if;
    return jsonb_build_object(
      'execution', public.choice_quiz_execution_payload_at_attempt(
        v_issue.id,
        v_existing_attempt.attempt_number
      )
    );
  end if;

  if v_live ->> 'state' <> 'live'
    or (v_live ->> 'cursorRevision')::bigint <> p_cursor_revision
  then
    raise exception 'choice_quiz_attempt_stale' using errcode = '40001';
  end if;

  if not (
    case
      when (v_issue.learner_definition ->> 'allowMultiple')::boolean
        then true
      else cardinality(v_selected_option_ids) = 1
    end
  )
    or exists (
      select 1
      from unnest(v_selected_option_ids) as selected(id)
      where not exists (
        select 1
        from jsonb_array_elements(
          v_issue.learner_definition -> 'options'
        ) as option(value)
        where (option.value ->> 'id')::uuid = selected.id
      )
    )
  then
    raise exception 'choice_quiz_response_invalid' using errcode = '22023';
  end if;

  -- The replay probe above is deliberately lock-free. A new attempt locks
  -- hierarchy first, then authoritatively re-locks the issue so Component
  -- delete cannot form Lesson <-> Issue cycles and attempt numbering remains
  -- serialized per immutable issued definition.
  select issue.* into v_issue
  from public.choice_quiz_issue as issue
  where issue.learner_ref = p_issue_ref
    and issue.learner_profile_id = v_learner_profile_id
    and issue.source_lesson_run_id_at_time = p_lesson_run_id
  for update of issue;
  if not found then
    raise exception 'choice_quiz_attempt_not_found' using errcode = 'P0002';
  end if;

  select component.* into v_component
  from public.lesson_run as run
  join public.lesson_run_presentation_state as presentation
    on presentation.lesson_run_id = run.id
  join public.lesson as lesson on lesson.id = run.lesson_id
  join public.lesson_component as component
    on component.lesson_id = lesson.id
   and component.student_slide_id = presentation.student_slide_id
  where run.id = p_lesson_run_id
    and presentation.cursor_version = p_cursor_revision
    and component.id = v_issue.lesson_component_id
    and component.id = v_issue.source_component_id_at_time
    and component.type_key = 'choice_quiz'
    and component.schema_version = v_issue.component_schema_version
    and component.updated_at = v_issue.component_updated_at
    and component.visibility = 'learner_visible'
    and component.activity_role = v_issue.activity_role
    and component.primary_learning_objective_id is not distinct from
      v_issue.source_learning_objective_id_at_time
  for share of run, presentation, lesson, component;
  if not found then
    raise exception 'choice_quiz_attempt_stale' using errcode = '40001';
  end if;
  if not public.choice_quiz_projection_matches_payload(
    v_component.payload,
    v_issue.learner_definition,
    v_issue.evaluator_config
  ) then
    raise exception 'choice_quiz_attempt_stale' using errcode = '40001';
  end if;

  v_current_definition_revision := 'cqd_v1_' || encode(extensions.digest(
    jsonb_build_object(
      'sourceComponentId', v_component.id,
      'componentUpdatedAt', v_component.updated_at,
      'componentSchemaVersion', v_component.schema_version,
      'activityRole', v_component.activity_role,
      'sourceLearningObjectiveId',
        v_component.primary_learning_objective_id,
      'learnerDefinition', v_issue.learner_definition,
      'evaluatorFingerprint', v_issue.evaluator_fingerprint
    )::text,
    'sha256'
  ), 'hex');
  if v_current_definition_revision <> v_issue.definition_revision then
    raise exception 'choice_quiz_attempt_stale' using errcode = '40001';
  end if;

  select
    count(*)::integer,
    coalesce((
      select evaluation.is_correct
      from public.choice_quiz_attempt as last_attempt
      join public.choice_quiz_evaluation as evaluation
        on evaluation.attempt_id = last_attempt.id
       and evaluation.evaluation_source = 'initial'
      where last_attempt.issue_id = v_issue.id
      order by last_attempt.attempt_number desc
      limit 1
    ), false)
  into v_attempt_count, v_previous_correct
  from public.choice_quiz_attempt as attempt
  where attempt.issue_id = v_issue.id;

  if v_attempt_count >= v_issue.max_attempts
    or v_previous_correct
    or (v_issue.activity_role = 'assessment' and v_attempt_count > 0)
  then
    raise exception 'choice_quiz_attempt_not_allowed' using errcode = '55000';
  end if;
  v_attempt_number := v_attempt_count + 1;

  select array_agg(
    (answer.value #>> '{}')::uuid
    order by (answer.value #>> '{}')::uuid
  )
  into v_correct_option_ids
  from jsonb_array_elements(
    v_issue.evaluator_config -> 'correctOptionIds'
  ) as answer(value);
  v_is_correct := v_selected_option_ids = v_correct_option_ids;
  v_can_retry := v_issue.activity_role = 'practice'
    and not v_is_correct
    and v_attempt_number < v_issue.max_attempts;
  v_answer_revealed := v_issue.activity_role = 'practice'
    and (v_is_correct or v_attempt_number = v_issue.max_attempts);
  v_explanation := case
    when v_answer_revealed
      and jsonb_typeof(v_issue.evaluator_config -> 'explanation') = 'string'
      then v_issue.evaluator_config ->> 'explanation'
    else null
  end;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', option.value ->> 'id',
      'label', option.value ->> 'label'
    ) order by option.position
  ), '[]'::jsonb)
  into v_selected_options
  from jsonb_array_elements(
    v_issue.learner_definition -> 'options'
  ) with ordinality as option(value, position)
  where (option.value ->> 'id')::uuid = any(v_selected_option_ids);

  insert into public.choice_quiz_attempt (
    issue_id,
    learner_profile_id,
    attempt_number,
    idempotency_key,
    request_fingerprint,
    cursor_revision,
    support,
    submitted_at
  ) values (
    v_issue.id,
    v_issue.learner_profile_id,
    v_attempt_number,
    p_idempotency_key,
    v_request_fingerprint,
    p_cursor_revision,
    case when v_attempt_number = 1 then 'independent' else 'with_support' end,
    v_now
  ) returning id into v_attempt_id;

  insert into public.choice_quiz_response (
    attempt_id,
    issue_id,
    selected_option_ids,
    selected_options,
    created_at
  ) values (
    v_attempt_id,
    v_issue.id,
    v_selected_option_ids,
    v_selected_options,
    v_now
  );

  insert into public.choice_quiz_evaluation (
    attempt_id,
    issue_id,
    evaluation_source,
    is_correct,
    score,
    evaluator_version,
    evaluator_fingerprint,
    evaluator_config,
    evaluated_at
  ) values (
    v_attempt_id,
    v_issue.id,
    'initial',
    v_is_correct,
    case when v_is_correct then 1 else 0 end,
    v_issue.evaluator_version,
    v_issue.evaluator_fingerprint,
    v_issue.evaluator_config,
    v_now
  ) returning id into v_evaluation_id;

  insert into public.choice_quiz_feedback_delivery (
    evaluation_id,
    attempt_id,
    issue_id,
    correctness_delivered,
    score_delivered,
    can_retry,
    answer_revealed,
    revealed_correct_option_ids,
    revealed_explanation,
    delivered_at
  ) values (
    v_evaluation_id,
    v_attempt_id,
    v_issue.id,
    v_is_correct,
    case when v_is_correct then 1 else 0 end,
    v_can_retry,
    v_answer_revealed,
    case when v_answer_revealed then v_correct_option_ids else null end,
    v_explanation,
    v_now
  );

  if v_issue.source_learning_objective_id_at_time is not null
    and v_issue.learning_objective_id is not null
    and exists (
      select 1
      from public.learning_objective as objective
      where objective.id = v_issue.learning_objective_id
        and objective.id = v_issue.source_learning_objective_id_at_time
        and objective.course_id = v_issue.source_course_id_at_time
        and objective.archived_at is null
    )
  then
    insert into public.learning_evidence (
      learner_profile_id,
      recorded_by_account_id,
      learning_record_id,
      source_observation_id,
      source_choice_quiz_evaluation_id,
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
      reason_code
    ) values (
      v_issue.learner_profile_id,
      v_issue.recorded_by_account_id,
      null,
      null,
      v_evaluation_id,
      v_issue.source_course_id_at_time,
      v_issue.source_lesson_id_at_time,
      v_issue.source_lesson_run_id_at_time,
      v_issue.source_component_id_at_time,
      v_issue.source_learning_objective_id_at_time,
      v_issue.lesson_component_id,
      v_issue.learning_objective_id,
      v_issue.course_title_at_time,
      v_issue.lesson_title_at_time,
      v_issue.subject_at_time,
      'choice_quiz',
      left(v_issue.learner_definition ->> 'question', 500),
      'learner_visible',
      v_issue.objective_title_at_time,
      left(v_issue.learner_definition ->> 'question', 500),
      case when v_is_correct then 'positive' else 'negative' end,
      case
        when not v_is_correct then null
        when v_attempt_number = 1 then 'independent'
        else 'with_support'
      end,
      v_now,
      v_now,
      v_now,
      1,
      2,
      case
        when not v_is_correct
          then 'choice_quiz_not_yet_negative_evidence'
        when v_attempt_number = 1
          then 'choice_quiz_independent_positive_evidence'
        else 'choice_quiz_supported_positive_evidence'
      end
    )
    returning id into v_evidence_id;

    perform public.refresh_learning_activity_states_for_profile(
      v_issue.learner_profile_id,
      v_issue.recorded_by_account_id,
      v_now
    );
  end if;

  return jsonb_build_object(
    'execution', public.choice_quiz_execution_payload(v_issue.id)
  );
end
$function$;

revoke all on function public.submit_choice_quiz_attempt_admin(
  uuid, uuid, uuid, text, bigint, uuid, uuid[]
) from public, anon, authenticated;
grant execute on function public.submit_choice_quiz_attempt_admin(
  uuid, uuid, uuid, text, bigint, uuid, uuid[]
) to service_role, postgres;

create function public.choice_quiz_history_item(p_evaluation_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $function$
  select jsonb_build_object(
    'issueRef', issue.learner_ref,
    'evaluationId', evaluation.id,
    'supersedesEvaluationId', evaluation.supersedes_evaluation_id,
    'supersededByEvaluationId', evaluation.superseded_by_evaluation_id,
    'learnerProfileId', issue.learner_profile_id,
    'learnerDisplayName', profile.display_name,
    'componentLabelAtTime', issue.learner_definition ->> 'question',
    'objectiveTitleAtTime', issue.objective_title_at_time,
    'activityRole', issue.activity_role,
    'question', issue.learner_definition ->> 'question',
    'shownOptions', issue.learner_definition -> 'options',
    'attemptNumber', attempt.attempt_number,
    'selectedOptions', response.selected_options,
    'isCorrect', evaluation.is_correct,
    'score', evaluation.score,
    'supportContext', attempt.support,
    'hintCount', attempt.hint_count,
    'revealAvailable', coalesce(feedback.answer_revealed, false),
    'evaluatorVersion', evaluation.evaluator_version,
    'evaluatorFingerprint', evaluation.evaluator_fingerprint,
    'evaluatedAt', evaluation.evaluated_at,
    'correctionReason', evaluation.correction_reason
  )
  from public.choice_quiz_evaluation as evaluation
  join public.choice_quiz_attempt as attempt on attempt.id = evaluation.attempt_id
  join public.choice_quiz_issue as issue on issue.id = attempt.issue_id
  join public.learner_profile as profile on profile.id = issue.learner_profile_id
  join public.choice_quiz_response as response on response.attempt_id = attempt.id
  left join public.choice_quiz_feedback_delivery as feedback
    on feedback.evaluation_id = evaluation.id
  where evaluation.id = p_evaluation_id;
$function$;

revoke all on function public.choice_quiz_history_item(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.choice_quiz_history_item(uuid) to postgres;

create function public.correct_choice_quiz_evaluation_admin(
  p_actor_auth_user_id uuid,
  p_session_id uuid,
  p_evaluation_id uuid,
  p_is_correct boolean,
  p_reason text,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor_account_id uuid;
  v_learner_profile_id uuid;
  v_source_course_id uuid;
  v_source_lesson_id uuid;
  v_sessions_invalid_before timestamp with time zone;
  v_session_created_at timestamp with time zone;
  v_session_not_after timestamp with time zone;
  v_old public.choice_quiz_evaluation%rowtype;
  v_replay public.choice_quiz_evaluation%rowtype;
  v_attempt public.choice_quiz_attempt%rowtype;
  v_issue public.choice_quiz_issue%rowtype;
  v_old_evidence public.learning_evidence%rowtype;
  v_has_old_evidence boolean := false;
  v_new_evaluation_id uuid;
  v_new_evidence_id uuid;
  v_corrected_at timestamp with time zone := clock_timestamp();
begin
  if p_actor_auth_user_id is null
    or p_session_id is null
    or p_evaluation_id is null
    or p_is_correct is null
    or p_reason is null
    or char_length(btrim(p_reason)) not between 1 and 500
    or p_idempotency_key is null
  then
    raise exception 'choice_quiz_correction_invalid' using errcode = '22023';
  end if;

  select session.created_at, session.not_after
  into v_session_created_at, v_session_not_after
  from auth.sessions as session
  where session.id = p_session_id
    and session.user_id = p_actor_auth_user_id;
  if not found
    or v_session_created_at is null
    or (
      v_session_not_after is not null
      and v_session_not_after <= clock_timestamp()
    )
  then
    raise exception 'choice_quiz_session_revoked' using errcode = '42501';
  end if;

  select account.id into v_actor_account_id
  from public.account as account
  where account.auth_user_id = p_actor_auth_user_id
    and account.status = 'active';
  if not found then
    raise exception 'choice_quiz_evaluation_not_found' using errcode = 'P0002';
  end if;

  select security.sessions_invalid_before
  into v_sessions_invalid_before
  from public.account_security as security
  where security.account_id = v_actor_account_id;
  if not found
    or (
      v_sessions_invalid_before is not null
      and v_session_created_at < v_sessions_invalid_before
    )
  then
    raise exception 'choice_quiz_session_revoked' using errcode = '42501';
  end if;

  select
    issue.learner_profile_id,
    issue.source_course_id_at_time,
    issue.source_lesson_id_at_time
  into
    v_learner_profile_id,
    v_source_course_id,
    v_source_lesson_id
  from public.choice_quiz_evaluation as evaluation
  join public.choice_quiz_attempt as attempt on attempt.id = evaluation.attempt_id
  join public.choice_quiz_issue as issue on issue.id = attempt.issue_id
  where evaluation.id = p_evaluation_id
    and issue.recorded_by_account_id = v_actor_account_id;
  if not found then
    raise exception 'choice_quiz_evaluation_not_found' using errcode = 'P0002';
  end if;

  perform public.lock_learning_activity_learners(
    array[v_learner_profile_id]
  );

  select session.created_at, session.not_after
  into v_session_created_at, v_session_not_after
  from auth.sessions as session
  where session.id = p_session_id
    and session.user_id = p_actor_auth_user_id
  for share of session;
  if not found
    or v_session_created_at is null
    or (
      v_session_not_after is not null
      and v_session_not_after <= clock_timestamp()
    )
  then
    raise exception 'choice_quiz_session_revoked' using errcode = '42501';
  end if;

  perform 1
  from public.account as account
  where account.id = v_actor_account_id
    and account.auth_user_id = p_actor_auth_user_id
    and account.status = 'active'
  for share of account;
  if not found then
    raise exception 'choice_quiz_evaluation_not_found' using errcode = 'P0002';
  end if;

  select security.sessions_invalid_before
  into v_sessions_invalid_before
  from public.account_security as security
  where security.account_id = v_actor_account_id
  for share of security;
  if not found
    or (
      v_sessions_invalid_before is not null
      and v_session_created_at < v_sessions_invalid_before
    )
  then
    raise exception 'choice_quiz_session_revoked' using errcode = '42501';
  end if;

  perform 1
  from public.learner_profile as profile
  where profile.id = v_learner_profile_id
  for share of profile;
  if not found then
    raise exception 'choice_quiz_evaluation_not_found' using errcode = 'P0002';
  end if;

  -- Correction is a current teacher write, not a durable capability granted
  -- by possession of a historical Evaluation UUID. Recheck and hold current
  -- Course ownership through commit, then take the same Course -> Lesson
  -- barrier as component writers before the
  -- Evidence -> Evaluation -> Attempt -> Issue child order.
  perform 1
  from public.course as course
  where course.id = v_source_course_id
    and course.owner_account_id = v_actor_account_id
  for share of course;
  if not found then
    raise exception 'choice_quiz_evaluation_not_found' using errcode = 'P0002';
  end if;

  perform 1
  from public.lesson as lesson
  where lesson.id = v_source_lesson_id
    and lesson.course_id = v_source_course_id
  for share of lesson;
  if not found then
    raise exception 'choice_quiz_evaluation_not_found' using errcode = 'P0002';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'shidao-choice-quiz-correction-v1:' || p_idempotency_key::text,
      0
    )
  );

  select evaluation.* into v_replay
  from public.choice_quiz_evaluation as evaluation
  where evaluation.corrected_by_account_id = v_actor_account_id
    and evaluation.correction_idempotency_key = p_idempotency_key;
  if found then
    if v_replay.supersedes_evaluation_id <> p_evaluation_id
      or v_replay.is_correct <> p_is_correct
      or v_replay.correction_reason <> btrim(p_reason)
    then
      raise exception 'choice_quiz_correction_idempotency_conflict'
        using errcode = '23505';
    end if;
    return jsonb_build_object(
      'evaluation', public.choice_quiz_history_item(v_replay.id)
    );
  end if;

  -- Keep the shared child order Evidence -> Issue. The learner and
  -- Course/Lesson barriers above make this authoritative even when the
  -- historical component has just been detached.
  select evidence.* into v_old_evidence
  from public.learning_evidence as evidence
  where evidence.source_choice_quiz_evaluation_id = p_evaluation_id
    and evidence.superseded_by_evidence_id is null
  for update of evidence;
  v_has_old_evidence := found;

  select evaluation.*
  into v_old
  from public.choice_quiz_evaluation as evaluation
  join public.choice_quiz_attempt as attempt on attempt.id = evaluation.attempt_id
  join public.choice_quiz_issue as issue on issue.id = attempt.issue_id
  where evaluation.id = p_evaluation_id
    and evaluation.superseded_by_evaluation_id is null
    and issue.recorded_by_account_id = v_actor_account_id
    and issue.learner_profile_id = v_learner_profile_id
  for update of evaluation;
  if not found then
    raise exception 'choice_quiz_evaluation_not_found' using errcode = 'P0002';
  end if;

  select attempt.* into strict v_attempt
  from public.choice_quiz_attempt as attempt
  where attempt.id = v_old.attempt_id
  for share of attempt;
  select issue.* into strict v_issue
  from public.choice_quiz_issue as issue
  where issue.id = v_attempt.issue_id
  for share of issue;

  insert into public.choice_quiz_evaluation (
    attempt_id,
    issue_id,
    evaluation_source,
    is_correct,
    score,
    evaluator_version,
    evaluator_fingerprint,
    evaluator_config,
    supersedes_evaluation_id,
    corrected_by_account_id,
    correction_reason,
    correction_idempotency_key,
    evaluated_at
  ) values (
    v_attempt.id,
    v_issue.id,
    'teacher_correction',
    p_is_correct,
    case when p_is_correct then 1 else 0 end,
    v_old.evaluator_version,
    v_old.evaluator_fingerprint,
    v_old.evaluator_config,
    v_old.id,
    v_actor_account_id,
    btrim(p_reason),
    p_idempotency_key,
    v_corrected_at
  ) returning id into v_new_evaluation_id;

  perform set_config('app.choice_quiz_correction', 'on', true);
  update public.choice_quiz_evaluation as evaluation
  set superseded_by_evaluation_id = v_new_evaluation_id
  where evaluation.id = v_old.id;

  if v_has_old_evidence then
    insert into public.learning_evidence (
      learner_profile_id,
      recorded_by_account_id,
      learning_record_id,
      source_observation_id,
      source_choice_quiz_evaluation_id,
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
    ) values (
      v_old_evidence.learner_profile_id,
      v_old_evidence.recorded_by_account_id,
      null,
      null,
      v_new_evaluation_id,
      v_old_evidence.source_course_id_at_time,
      v_old_evidence.source_lesson_id_at_time,
      v_old_evidence.source_lesson_run_id_at_time,
      v_old_evidence.source_component_id_at_time,
      v_old_evidence.source_learning_objective_id_at_time,
      v_old_evidence.lesson_component_id,
      v_old_evidence.learning_objective_id,
      v_old_evidence.course_title_at_time,
      v_old_evidence.lesson_title_at_time,
      v_old_evidence.subject_at_time,
      v_old_evidence.component_type_at_time,
      v_old_evidence.component_label_at_time,
      v_old_evidence.component_visibility_at_time,
      v_old_evidence.objective_title_at_time,
      v_old_evidence.criterion_at_time,
      case when p_is_correct then 'positive' else 'negative' end,
      case
        when not p_is_correct then null
        when v_attempt.attempt_number = 1 then 'independent'
        else 'with_support'
      end,
      v_old_evidence.observed_at,
      v_corrected_at,
      v_corrected_at,
      1,
      2,
      case
        when not p_is_correct
          then 'choice_quiz_not_yet_negative_evidence'
        when v_attempt.attempt_number = 1
          then 'choice_quiz_independent_positive_evidence'
        else 'choice_quiz_supported_positive_evidence'
      end,
      v_old_evidence.id
    ) returning id into v_new_evidence_id;

    perform set_config('app.learning_activity_materialization', 'on', true);
    update public.learning_evidence as evidence
    set superseded_by_evidence_id = v_new_evidence_id
    where evidence.id = v_old_evidence.id;

    perform public.refresh_learning_activity_states_for_profile(
      v_issue.learner_profile_id,
      v_issue.recorded_by_account_id,
      v_corrected_at
    );
  end if;

  return jsonb_build_object(
    'evaluation', public.choice_quiz_history_item(v_new_evaluation_id)
  );
end
$function$;

revoke all on function public.correct_choice_quiz_evaluation_admin(
  uuid, uuid, uuid, boolean, text, uuid
) from public, anon, authenticated;
grant execute on function public.correct_choice_quiz_evaluation_admin(
  uuid, uuid, uuid, boolean, text, uuid
) to service_role, postgres;

create or replace function public.rebuild_learner_objective_state_for_actor(p_recorded_by_account_id uuid, p_learner_profile_id uuid, p_source_learning_objective_id_at_time uuid, p_as_of timestamp with time zone) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
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
  left join public.learning_record as record
    on record.id = evidence.learning_record_id
   and record.recorded_by_account_id = evidence.recorded_by_account_id
  where evidence.recorded_by_account_id = p_recorded_by_account_id
    and evidence.learner_profile_id = p_learner_profile_id
    and evidence.source_learning_objective_id_at_time =
      p_source_learning_objective_id_at_time
    and evidence.superseded_by_evidence_id is null
    and (
      (
        evidence.source_observation_id is not null
        and record.occurred_at is not null
        and record.superseded_by_record_id is null
      )
      or evidence.source_choice_quiz_evaluation_id is not null
    )
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
  left join public.learning_record as record
    on record.id = evidence.learning_record_id
   and record.recorded_by_account_id = evidence.recorded_by_account_id
  where evidence.recorded_by_account_id = p_recorded_by_account_id
    and evidence.learner_profile_id = p_learner_profile_id
    and evidence.source_learning_objective_id_at_time =
      p_source_learning_objective_id_at_time
    and evidence.superseded_by_evidence_id is null
    and (
      (
        evidence.source_observation_id is not null
        and record.superseded_by_record_id is null
      )
      or evidence.source_choice_quiz_evaluation_id is not null
    )
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
        left join public.learning_record as record
          on record.id = evidence.learning_record_id
         and record.recorded_by_account_id = evidence.recorded_by_account_id
        where evidence.recorded_by_account_id = p_recorded_by_account_id
          and evidence.learner_profile_id = p_learner_profile_id
          and evidence.source_learning_objective_id_at_time =
            p_source_learning_objective_id_at_time
          and evidence.superseded_by_evidence_id is null
          and (
            (
              evidence.source_observation_id is not null
              and record.superseded_by_record_id is null
            )
            or evidence.source_choice_quiz_evaluation_id is not null
          )
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
$$;

create function public.transfer_detached_choice_quiz_history_on_profile_merge()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_target_profile_id uuid;
  v_projection record;
  v_projection_at timestamp with time zone := clock_timestamp();
begin
  if coalesce(current_setting('app.learner_identity_merge', true), '') <> 'on'
  then
    return old;
  end if;

  select alias.target_learner_profile_id
  into v_target_profile_id
  from public.learner_profile_alias as alias
  where alias.source_learner_profile_id = old.id;
  if not found then
    return old;
  end if;

  update public.learning_evidence as evidence
  set learner_profile_id = v_target_profile_id
  where evidence.learner_profile_id = old.id
    and evidence.source_choice_quiz_evaluation_id is not null;

  update public.choice_quiz_issue as issue
  set learner_profile_id = v_target_profile_id
  where issue.learner_profile_id = old.id;

  for v_projection in
    select distinct
      evidence.recorded_by_account_id,
      evidence.source_learning_objective_id_at_time
    from public.learning_evidence as evidence
    where evidence.learner_profile_id = v_target_profile_id
      and evidence.source_choice_quiz_evaluation_id is not null
      and evidence.superseded_by_evidence_id is null
    order by
      evidence.recorded_by_account_id,
      evidence.source_learning_objective_id_at_time
  loop
    perform public.rebuild_learner_objective_state_for_actor(
      v_projection.recorded_by_account_id,
      v_target_profile_id,
      v_projection.source_learning_objective_id_at_time,
      v_projection_at
    );
  end loop;

  return old;
end
$function$;

revoke all on function
  public.transfer_detached_choice_quiz_history_on_profile_merge()
  from public, anon, authenticated, service_role;
grant execute on function
  public.transfer_detached_choice_quiz_history_on_profile_merge()
  to postgres;

create trigger trg_learner_profile_transfer_detached_choice_quiz
before delete on public.learner_profile
for each row
execute function
  public.transfer_detached_choice_quiz_history_on_profile_merge();

create function public.guard_choice_quiz_profile_unlink()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if tg_op = 'DELETE' then
    if exists (
      select 1
      from public.choice_quiz_issue as issue
      where issue.learner_profile_id = old.id
    )
      and coalesce(
        current_setting('app.learner_identity_merge', true), ''
      ) <> 'on'
      and coalesce(
        current_setting('app.learner_identity_erasure', true), ''
      ) <> 'on'
    then
      raise exception 'learner_profile_not_empty' using errcode = '55000';
    end if;
    return old;
  end if;

  if old.account_id is not null
    and new.account_id is null
    and exists (
      select 1
      from public.choice_quiz_issue as issue
      where issue.learner_profile_id = old.id
    )
  then
    raise exception 'learner_profile_not_empty' using errcode = '55000';
  end if;
  return new;
end
$function$;

revoke all on function public.guard_choice_quiz_profile_unlink()
  from public, anon, authenticated, service_role;
grant execute on function public.guard_choice_quiz_profile_unlink() to postgres;

create trigger trg_learner_profile_choice_quiz_unlink_guard
before update of account_id on public.learner_profile
for each row execute function public.guard_choice_quiz_profile_unlink();

create trigger trg_learner_profile_choice_quiz_delete_guard
before delete on public.learner_profile
for each row execute function public.guard_choice_quiz_profile_unlink();

create or replace function public.learner_safe_unlink_preview_for_actor(
  p_actor_account_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
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

  if exists (
    select 1 from public.learning_record
    where learner_profile_id = v_profile_id
  ) or exists (
    select 1 from public.choice_quiz_issue
    where learner_profile_id = v_profile_id
      and learning_record_id is null
  ) then
    v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
      'code', 'learning_history_exists',
      'message', 'В профиле есть учебная история.',
      'count',
        (select count(*) from public.learning_record
          where learner_profile_id = v_profile_id)
        + (select count(*) from public.choice_quiz_issue
          where learner_profile_id = v_profile_id
            and learning_record_id is null)
    ));
  end if;

  if exists (
    select 1 from public.learner_profile_alias
    where target_learner_profile_id = v_profile_id
  ) or exists (
    select 1 from public.learner_profile_merge
    where target_learner_profile_id = v_profile_id
      and status = 'completed'
  ) then
    v_blockers := v_blockers || jsonb_build_array(jsonb_build_object(
      'code', 'merge_lineage_exists',
      'message', 'Объединённый профиль нельзя разделить.',
      'count', null
    ));
  end if;

  if exists (select 1 from public.learner_group_member
      where learner_profile_id = v_profile_id)
    or exists (select 1 from public.course_learner
      where learner_profile_id = v_profile_id)
    or exists (select 1 from public.learner_observer_grant
      where learner_profile_id = v_profile_id and status = 'active')
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
      'code', 'dependent_access_exists',
      'message', 'Сначала удалите назначения, наблюдателей и согласия.',
      'count', null
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
$function$;

create or replace function public.learning_activity_scope_fingerprint(
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
    select 'quiz-issue:' || issue.id::text || ':'
      || issue.learner_profile_id::text || ':'
      || coalesce(issue.learning_record_id::text, '-') || ':'
      || issue.source_lesson_run_id_at_time::text || ':'
      || issue.source_component_id_at_time::text || ':'
      || issue.definition_revision || ':'
      || issue.issued_at::text
    from public.choice_quiz_issue as issue
    join profiles on profiles.id = issue.learner_profile_id
    union all
    select 'quiz-attempt:' || attempt.id::text || ':'
      || attempt.issue_id::text || ':'
      || attempt.attempt_number::text || ':'
      || attempt.idempotency_key::text || ':'
      || attempt.submitted_at::text
    from public.choice_quiz_attempt as attempt
    join public.choice_quiz_issue as issue on issue.id = attempt.issue_id
    join profiles on profiles.id = issue.learner_profile_id
    union all
    select 'quiz-response:' || response.attempt_id::text || ':'
      || response.selected_option_ids::text || ':'
      || response.created_at::text
    from public.choice_quiz_response as response
    join public.choice_quiz_attempt as attempt on attempt.id = response.attempt_id
    join public.choice_quiz_issue as issue on issue.id = attempt.issue_id
    join profiles on profiles.id = issue.learner_profile_id
    union all
    select 'quiz-evaluation:' || evaluation.id::text || ':'
      || evaluation.attempt_id::text || ':'
      || evaluation.score::text || ':'
      || coalesce(evaluation.supersedes_evaluation_id::text, '-') || ':'
      || coalesce(evaluation.superseded_by_evaluation_id::text, '-') || ':'
      || evaluation.evaluated_at::text
    from public.choice_quiz_evaluation as evaluation
    join public.choice_quiz_attempt as attempt on attempt.id = evaluation.attempt_id
    join public.choice_quiz_issue as issue on issue.id = attempt.issue_id
    join profiles on profiles.id = issue.learner_profile_id
    union all
    select 'quiz-feedback:' || feedback.id::text || ':'
      || feedback.evaluation_id::text || ':'
      || feedback.answer_revealed::text || ':'
      || feedback.delivered_at::text
    from public.choice_quiz_feedback_delivery as feedback
    join public.choice_quiz_attempt as attempt on attempt.id = feedback.attempt_id
    join public.choice_quiz_issue as issue on issue.id = attempt.issue_id
    join profiles on profiles.id = issue.learner_profile_id
    union all
    select 'evidence:' || evidence.id::text || ':'
      || evidence.learner_profile_id::text || ':'
      || coalesce(evidence.learning_record_id::text, '-') || ':'
      || coalesce(evidence.source_observation_id::text, '-') || ':'
      || coalesce(evidence.source_choice_quiz_evaluation_id::text, '-') || ':'
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

-- Keep the deployed LA-M4 resolver byte-compatible during DB-first rollout.
-- LA-M5 consumes this additive resolver with the extra server-only Component
-- authority needed to issue a durable Choice Quiz definition.
create function public.resolve_lesson_run_live_source_choice_quiz_admin(p_auth_user_id uuid, p_session_id uuid, p_lesson_run_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $_$
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
    and session.user_id = p_auth_user_id;

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
      component.id,
      component.type_key,
      component.schema_version,
      component.position,
      component.payload,
      component.placement_config,
      component.primary_learning_objective_id,
      component.activity_role,
      component.updated_at
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
            'id', component.id,
            'typeKey', component.type_key,
            'schemaVersion', component.schema_version,
            'position', component.position,
            'payload', component.payload,
            'placement', component.placement_config,
            'primaryLearningObjectiveId',
              component.primary_learning_objective_id,
            'activityRole', component.activity_role,
            'updatedAt', component.updated_at
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
$_$;

revoke all on function public.resolve_lesson_run_live_source_choice_quiz_admin(
  uuid, uuid, uuid
)
  from public, anon, authenticated;
grant execute on function public.resolve_lesson_run_live_source_choice_quiz_admin(
  uuid, uuid, uuid
)
  to service_role, postgres;

-- Keep the deployed LA-M4 JSON byte-compatible while moving its authority
-- reads onto the same learner -> Session lock order as LA-M5. This wrapper
-- delegates to the additive resolver and strips exactly the four M5-only
-- Component keys before an older strict application can observe them.
create or replace function public.resolve_lesson_run_live_source_admin(
  p_auth_user_id uuid,
  p_session_id uuid,
  p_lesson_run_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_source jsonb;
  v_legacy_components jsonb;
begin
  v_source := public.resolve_lesson_run_live_source_choice_quiz_admin(
    p_auth_user_id,
    p_session_id,
    p_lesson_run_id
  );

  if v_source ->> 'state' <> 'live' then
    return v_source;
  end if;

  select coalesce(jsonb_agg(
    component.value - array[
      'id',
      'primaryLearningObjectiveId',
      'activityRole',
      'updatedAt'
    ]
    order by component.position
  ), '[]'::jsonb)
  into v_legacy_components
  from jsonb_array_elements(
    coalesce(v_source #> '{slide,components}', '[]'::jsonb)
  ) with ordinality as component(value, position);

  return jsonb_set(
    v_source,
    '{slide,components}',
    v_legacy_components,
    false
  );
end
$function$;

revoke all on function public.resolve_lesson_run_live_source_admin(
  uuid, uuid, uuid
) from public, anon, authenticated;
grant execute on function public.resolve_lesson_run_live_source_admin(
  uuid, uuid, uuid
) to service_role, postgres;

create or replace function public.list_choice_quiz_run_history_admin(
  p_actor_auth_user_id uuid,
  p_session_id uuid,
  p_lesson_run_id uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_actor_account_id uuid;
  v_sessions_invalid_before timestamp with time zone;
  v_session_created_at timestamp with time zone;
  v_session_not_after timestamp with time zone;
  v_course_id uuid;
  v_lesson_id uuid;
  v_initial_learner_profile_ids uuid[];
  v_current_learner_profile_ids uuid[];
  v_items jsonb;
  v_truncated boolean;
begin
  if p_actor_auth_user_id is null
    or p_session_id is null
    or p_lesson_run_id is null
  then
    raise exception 'choice_quiz_history_not_found' using errcode = 'P0002';
  end if;

  -- The first pass is deliberately lock-free. Learner identity locks must be
  -- the first durable barrier so this private read cannot deadlock with or
  -- escape a concurrent merge/erasure. Every authority value is re-read and
  -- locked after the learner set is serialized.
  select session.created_at, session.not_after
  into v_session_created_at, v_session_not_after
  from auth.sessions as session
  where session.id = p_session_id
    and session.user_id = p_actor_auth_user_id;
  if not found
    or v_session_created_at is null
    or (
      v_session_not_after is not null
      and v_session_not_after <= clock_timestamp()
    )
  then
    raise exception 'choice_quiz_session_revoked' using errcode = '42501';
  end if;

  select account.id into v_actor_account_id
  from public.account as account
  where account.auth_user_id = p_actor_auth_user_id
    and account.status = 'active';
  if not found then
    raise exception 'choice_quiz_history_not_found' using errcode = 'P0002';
  end if;

  select security.sessions_invalid_before
  into v_sessions_invalid_before
  from public.account_security as security
  where security.account_id = v_actor_account_id;
  if not found
    or (
      v_sessions_invalid_before is not null
      and v_session_created_at < v_sessions_invalid_before
    )
  then
    raise exception 'choice_quiz_session_revoked' using errcode = '42501';
  end if;

  select course.id, lesson.id
  into v_course_id, v_lesson_id
  from public.lesson_run as run
  join public.lesson as lesson on lesson.id = run.lesson_id
  join public.course as course on course.id = lesson.course_id
  where run.id = p_lesson_run_id
    and course.owner_account_id = v_actor_account_id;
  if not found then
    raise exception 'choice_quiz_history_not_found' using errcode = 'P0002';
  end if;

  select coalesce(
    array_agg(candidate.learner_profile_id order by candidate.learner_profile_id),
    '{}'::uuid[]
  )
  into v_initial_learner_profile_ids
  from (
    select issue.learner_profile_id
    from public.choice_quiz_issue as issue
    where issue.recorded_by_account_id = v_actor_account_id
      and issue.source_lesson_run_id_at_time = p_lesson_run_id
    union
    select record.learner_profile_id
    from public.learning_record as record
    where record.recorded_by_account_id = v_actor_account_id
      and record.lesson_run_id = p_lesson_run_id
  ) as candidate;

  perform public.lock_learning_activity_learners(
    v_initial_learner_profile_ids
  );

  select session.created_at, session.not_after
  into v_session_created_at, v_session_not_after
  from auth.sessions as session
  where session.id = p_session_id
    and session.user_id = p_actor_auth_user_id
  for share of session;
  if not found
    or v_session_created_at is null
    or (
      v_session_not_after is not null
      and v_session_not_after <= clock_timestamp()
    )
  then
    raise exception 'choice_quiz_session_revoked' using errcode = '42501';
  end if;

  perform 1
  from public.account as account
  where account.id = v_actor_account_id
    and account.auth_user_id = p_actor_auth_user_id
    and account.status = 'active'
  for share of account;
  if not found then
    raise exception 'choice_quiz_history_not_found' using errcode = 'P0002';
  end if;

  select security.sessions_invalid_before
  into v_sessions_invalid_before
  from public.account_security as security
  where security.account_id = v_actor_account_id
  for share of security;
  if not found
    or (
      v_sessions_invalid_before is not null
      and v_session_created_at < v_sessions_invalid_before
    )
  then
    raise exception 'choice_quiz_session_revoked' using errcode = '42501';
  end if;

  perform 1 from public.course as course
  where course.id = v_course_id
    and course.owner_account_id = v_actor_account_id
  for share of course;
  if not found then
    raise exception 'choice_quiz_history_not_found' using errcode = 'P0002';
  end if;

  perform 1 from public.lesson as lesson
  where lesson.id = v_lesson_id
    and lesson.course_id = v_course_id
  for share of lesson;
  if not found then
    raise exception 'choice_quiz_history_not_found' using errcode = 'P0002';
  end if;

  perform 1 from public.lesson_run as run
  where run.id = p_lesson_run_id
    and run.lesson_id = v_lesson_id
  for share of run;
  if not found then
    raise exception 'choice_quiz_history_not_found' using errcode = 'P0002';
  end if;

  select coalesce(
    array_agg(candidate.learner_profile_id order by candidate.learner_profile_id),
    '{}'::uuid[]
  )
  into v_current_learner_profile_ids
  from (
    select issue.learner_profile_id
    from public.choice_quiz_issue as issue
    where issue.recorded_by_account_id = v_actor_account_id
      and issue.source_lesson_run_id_at_time = p_lesson_run_id
    union
    select record.learner_profile_id
    from public.learning_record as record
    where record.recorded_by_account_id = v_actor_account_id
      and record.lesson_run_id = p_lesson_run_id
  ) as candidate;

  if v_current_learner_profile_ids is distinct from
    v_initial_learner_profile_ids
  then
    raise exception 'choice_quiz_history_stale' using errcode = '40001';
  end if;

  -- Bound one response independently of client validation. Keep the newest
  -- 5,000 evaluation/correction events, then restore chronological display
  -- order and explicitly tell the teacher when older history was omitted.
  with ranked as materialized (
    select
      evaluation.id as evaluation_id,
      issue.issued_at,
      issue.id as issue_id,
      attempt.attempt_number,
      evaluation.evaluated_at
    from public.choice_quiz_issue as issue
    join public.choice_quiz_attempt as attempt on attempt.issue_id = issue.id
    join public.choice_quiz_evaluation as evaluation
      on evaluation.attempt_id = attempt.id
    where issue.recorded_by_account_id = v_actor_account_id
      and issue.source_lesson_run_id_at_time = p_lesson_run_id
    order by
      evaluation.evaluated_at desc,
      evaluation.id desc
    limit 5001
  ), selected as materialized (
    select ranked.*
    from ranked
    order by
      ranked.evaluated_at desc,
      ranked.evaluation_id desc
    limit 5000
  )
  select
    coalesce(jsonb_agg(
      public.choice_quiz_history_item(selected.evaluation_id)
      order by
        selected.evaluated_at,
        selected.evaluation_id
    ), '[]'::jsonb),
    (select count(*) > 5000 from ranked)
  into v_items, v_truncated
  from selected;

  return jsonb_build_object(
    'items', v_items,
    'truncated', v_truncated
  );
end
$function$;

revoke all on function public.list_choice_quiz_run_history_admin(
  uuid, uuid, uuid
)
  from public, anon, authenticated;
grant execute on function public.list_choice_quiz_run_history_admin(
  uuid, uuid, uuid
)
  to service_role, postgres;

-- Preserve the deployed LA-M3 teacher projection for DB-first compatibility.
-- The additive V2 boundary carries the exact Choice Quiz evidence source union.
create function public.teacher_learning_activity_profile_projection_v2(p_learner_profile_id uuid, p_recorded_by_account_id uuid, p_generated_at timestamp with time zone) RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
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
            'sourceKind', case
              when evidence.source_observation_id is not null
                then 'observation'
              else 'choice_quiz_evaluation'
            end,
            'sourceObservationId', evidence.source_observation_id,
            'sourceChoiceQuizEvaluationId',
              evidence.source_choice_quiz_evaluation_id,
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
$$;

revoke all on function
  public.teacher_learning_activity_profile_projection_v2(
    uuid, uuid, timestamptz
  ) from public, anon, authenticated, service_role;
grant execute on function
  public.teacher_learning_activity_profile_projection_v2(
    uuid, uuid, timestamptz
  ) to postgres;

-- Mixed-version workers may still call the deployed LA-M3 helper after quiz
-- evidence exists. Recompute each legacy state from observation evidence only:
-- merely stripping quiz links would leave status/recommendation fields derived
-- from a source that the old strict client cannot see.
create function public.teacher_learning_activity_legacy_observation_state(
  p_learner_profile_id uuid,
  p_recorded_by_account_id uuid,
  p_source_learning_objective_id_at_time uuid,
  p_generated_at timestamp with time zone,
  p_fallback_state jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_latest public.learning_evidence%rowtype;
  v_state_id uuid;
  v_independent_run_count integer;
  v_status text;
  v_reason_code text;
  v_reason_text text;
  v_state_evaluated_at timestamptz;
  v_legacy_evaluated_at timestamptz;
  v_freshness_due_at timestamptz;
  v_evidence_ids uuid[];
  v_evidence_items jsonb;
  v_evidence_ids_json jsonb;
  v_recommendation_type text;
  v_recommendation_reason_code text;
  v_recommendation_reason_text text;
  v_override jsonb;
begin
  if p_learner_profile_id is null
    or p_recorded_by_account_id is null
    or p_source_learning_objective_id_at_time is null
    or p_generated_at is null
    or p_fallback_state is null
    or jsonb_typeof(p_fallback_state) <> 'object'
  then
    raise exception 'learner_activity_legacy_projection_invalid'
      using errcode = '22023';
  end if;

  select evidence.*
  into v_latest
  from public.learning_evidence as evidence
  join public.learning_record as record
    on record.id = evidence.learning_record_id
   and record.recorded_by_account_id = evidence.recorded_by_account_id
   and record.learner_profile_id = evidence.learner_profile_id
  where evidence.recorded_by_account_id = p_recorded_by_account_id
    and evidence.learner_profile_id = p_learner_profile_id
    and evidence.source_learning_objective_id_at_time =
      p_source_learning_objective_id_at_time
    and evidence.source_observation_id is not null
    and evidence.source_choice_quiz_evaluation_id is null
    and evidence.evidence_version = 1
    and evidence.eligibility_policy_version = 1
    and evidence.superseded_by_evidence_id is null
    and record.occurred_at is not null
    and record.was_present
    and record.superseded_by_record_id is null
  order by evidence.observed_at desc, evidence.id desc
  limit 1;

  if not found then
    return jsonb_build_object(
      'stateId', null,
      'learningObjectiveId', p_fallback_state -> 'learningObjectiveId',
      'sourceLearningObjectiveIdAtTime',
        p_fallback_state -> 'sourceLearningObjectiveIdAtTime',
      'sourceCourseIdAtTime', p_fallback_state -> 'sourceCourseIdAtTime',
      'courseTitleAtTime', p_fallback_state -> 'courseTitleAtTime',
      'subjectAtTime', p_fallback_state -> 'subjectAtTime',
      'objectiveTitleAtTime', p_fallback_state -> 'objectiveTitleAtTime',
      'status', 'no_data',
      'reasonCode', 'no_eligible_evidence',
      'reasonText',
        'Пока нет подходящих наблюдений по этой учебной цели.',
      'policyVersion', 1,
      'evaluatedAt', p_generated_at,
      'lastEvidenceAt', null,
      'freshnessDueAt', null,
      'evidence', '[]'::jsonb,
      'recommendation', null
    );
  end if;

  select state.id
  into v_state_id
  from public.learner_objective_state as state
  where state.recorded_by_account_id = p_recorded_by_account_id
    and state.learner_profile_id = p_learner_profile_id
    and state.source_course_id_at_time = v_latest.source_course_id_at_time
    and state.source_learning_objective_id_at_time =
      p_source_learning_objective_id_at_time
  limit 1;

  -- The public wrapper is normally called after the canonical refresh. If an
  -- internal caller skips that refresh, retain the deployed no-data behavior
  -- rather than inventing a persisted state identifier.
  if v_state_id is null then
    return jsonb_build_object(
      'stateId', null,
      'learningObjectiveId', p_fallback_state -> 'learningObjectiveId',
      'sourceLearningObjectiveIdAtTime',
        p_fallback_state -> 'sourceLearningObjectiveIdAtTime',
      'sourceCourseIdAtTime', p_fallback_state -> 'sourceCourseIdAtTime',
      'courseTitleAtTime', p_fallback_state -> 'courseTitleAtTime',
      'subjectAtTime', p_fallback_state -> 'subjectAtTime',
      'objectiveTitleAtTime', p_fallback_state -> 'objectiveTitleAtTime',
      'status', 'no_data',
      'reasonCode', 'no_eligible_evidence',
      'reasonText',
        'Пока нет подходящих наблюдений по этой учебной цели.',
      'policyVersion', 1,
      'evaluatedAt', p_generated_at,
      'lastEvidenceAt', null,
      'freshnessDueAt', null,
      'evidence', '[]'::jsonb,
      'recommendation', null
    );
  end if;

  v_state_evaluated_at := coalesce(
    nullif(p_fallback_state ->> 'evaluatedAt', '')::timestamptz,
    p_generated_at
  );

  select jsonb_build_object(
    'action', override_row.action,
    'recommendationType', override_row.recommendation_type,
    'privateReason', override_row.private_reason,
    'updatedAt', override_row.updated_at
  )
  into v_override
  from public.learner_recommendation_override as override_row
  where override_row.recorded_by_account_id = p_recorded_by_account_id
    and override_row.learner_profile_id = p_learner_profile_id
    and override_row.source_course_id_at_time =
      v_latest.source_course_id_at_time
    and override_row.source_learning_objective_id_at_time =
      p_source_learning_objective_id_at_time;

  select count(distinct evidence.source_lesson_run_id_at_time)
  into v_independent_run_count
  from public.learning_evidence as evidence
  join public.learning_record as record
    on record.id = evidence.learning_record_id
   and record.recorded_by_account_id = evidence.recorded_by_account_id
   and record.learner_profile_id = evidence.learner_profile_id
  where evidence.recorded_by_account_id = p_recorded_by_account_id
    and evidence.learner_profile_id = p_learner_profile_id
    and evidence.source_learning_objective_id_at_time =
      p_source_learning_objective_id_at_time
    and evidence.source_observation_id is not null
    and evidence.source_choice_quiz_evaluation_id is null
    and evidence.evidence_version = 1
    and evidence.eligibility_policy_version = 1
    and evidence.superseded_by_evidence_id is null
    and record.occurred_at is not null
    and record.was_present
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
    if p_generated_at >= v_freshness_due_at then
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
         and record.learner_profile_id = evidence.learner_profile_id
        where evidence.recorded_by_account_id = p_recorded_by_account_id
          and evidence.learner_profile_id = p_learner_profile_id
          and evidence.source_learning_objective_id_at_time =
            p_source_learning_objective_id_at_time
          and evidence.source_observation_id is not null
          and evidence.source_choice_quiz_evaluation_id is null
          and evidence.evidence_version = 1
          and evidence.eligibility_policy_version = 1
          and evidence.superseded_by_evidence_id is null
          and record.occurred_at is not null
          and record.was_present
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
    ) as selected;
  end if;

  v_legacy_evaluated_at := case
    when v_status = 'recheck_due' then
      greatest(v_state_evaluated_at, v_freshness_due_at)
    else v_state_evaluated_at
  end;

  select
    coalesce(jsonb_agg(
      jsonb_build_object(
        'id', evidence.id,
        'learnerProfileId', evidence.learner_profile_id,
        'recordedByAccountId', evidence.recorded_by_account_id,
        'learningRecordId', evidence.learning_record_id,
        'sourceObservationId', evidence.source_observation_id,
        'sourceCourseIdAtTime', evidence.source_course_id_at_time,
        'sourceLessonIdAtTime', evidence.source_lesson_id_at_time,
        'sourceLessonRunIdAtTime', evidence.source_lesson_run_id_at_time,
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
        'eligibilityPolicyVersion', evidence.eligibility_policy_version,
        'reasonCode', evidence.reason_code,
        'supersedesEvidenceId', evidence.supersedes_evidence_id,
        'supersededByEvidenceId', evidence.superseded_by_evidence_id
      ) order by selected.position
    ), '[]'::jsonb),
    coalesce(jsonb_agg(
      to_jsonb(evidence.id) order by selected.position
    ), '[]'::jsonb)
  into v_evidence_items, v_evidence_ids_json
  from unnest(v_evidence_ids) with ordinality as selected(id, position)
  join public.learning_evidence as evidence on evidence.id = selected.id;

  v_recommendation_type := case v_reason_code
    when 'latest_not_yet' then 'repeat'
    when 'latest_with_support' then 'try_without_support'
    when 'independent_opportunities_missing' then 'apply_in_new_context'
    when 'multiple_independent_opportunities' then 'move_forward'
    else 'recheck_freshness'
  end;
  v_recommendation_reason_code := case v_reason_code
    when 'latest_not_yet' then 'repeat_after_not_yet'
    when 'latest_with_support' then
      'try_without_support_after_supported_success'
    when 'independent_opportunities_missing' then
      'apply_in_new_context_after_one_independent_opportunity'
    when 'multiple_independent_opportunities' then
      'move_forward_after_confirmation'
    else 'recheck_due_to_freshness'
  end;
  v_recommendation_reason_text := case v_reason_code
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
  end;

  return jsonb_build_object(
    'stateId', v_state_id,
    'learningObjectiveId', v_latest.learning_objective_id,
    'sourceLearningObjectiveIdAtTime',
      v_latest.source_learning_objective_id_at_time,
    'sourceCourseIdAtTime', v_latest.source_course_id_at_time,
    'courseTitleAtTime', v_latest.course_title_at_time,
    'subjectAtTime', v_latest.subject_at_time,
    'objectiveTitleAtTime', v_latest.objective_title_at_time,
    'status', v_status,
    'reasonCode', v_reason_code,
    'reasonText', v_reason_text,
    'policyVersion', 1,
    'evaluatedAt', v_legacy_evaluated_at,
    'lastEvidenceAt', v_latest.observed_at,
    'freshnessDueAt', v_freshness_due_at,
    'evidence', v_evidence_items,
    'recommendation', jsonb_build_object(
      'recommendationId', v_state_id,
      'type', v_recommendation_type,
      'reasonCode', v_recommendation_reason_code,
      'reasonText', v_recommendation_reason_text,
      'ruleVersion', 1,
      'generatedAt', v_legacy_evaluated_at,
      'evidenceIds', v_evidence_ids_json,
      'effectiveType', case
        when v_override ->> 'action' = 'dismiss' then null
        when v_override ->> 'action' = 'replace' then
          v_override ->> 'recommendationType'
        else v_recommendation_type
      end,
      'effectiveReasonText', case
        when v_override ->> 'action' = 'dismiss' then null
        when v_override ->> 'action' = 'replace' then
          v_override ->> 'privateReason'
        else v_recommendation_reason_text
      end,
      'source', case when v_override is null
        then 'rule' else 'teacher_override' end,
      'override', v_override
    )
  );
end
$function$;

revoke all on function
  public.teacher_learning_activity_legacy_observation_state(
    uuid, uuid, uuid, timestamptz, jsonb
  ) from public, anon, authenticated, service_role;
grant execute on function
  public.teacher_learning_activity_legacy_observation_state(
    uuid, uuid, uuid, timestamptz, jsonb
  ) to postgres;

create function public.teacher_learning_activity_legacy_override_token_is_valid(
  p_recorded_by_account_id uuid,
  p_learner_profile_id uuid,
  p_source_learning_objective_id_at_time uuid,
  p_current_state_evaluated_at timestamp with time zone,
  p_expected_evaluated_at timestamp with time zone
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  with eligible as materialized (
    select evidence.*
    from public.learning_evidence as evidence
    join public.learning_record as record
      on record.id = evidence.learning_record_id
     and record.recorded_by_account_id = evidence.recorded_by_account_id
     and record.learner_profile_id = evidence.learner_profile_id
    where evidence.recorded_by_account_id = p_recorded_by_account_id
      and evidence.learner_profile_id = p_learner_profile_id
      and evidence.source_learning_objective_id_at_time =
        p_source_learning_objective_id_at_time
      and evidence.source_observation_id is not null
      and evidence.source_choice_quiz_evaluation_id is null
      and evidence.evidence_version = 1
      and evidence.eligibility_policy_version = 1
      and evidence.superseded_by_evidence_id is null
      and record.occurred_at is not null
      and record.was_present
      and record.superseded_by_record_id is null
  ), latest as (
    select eligible.*
    from eligible
    order by eligible.observed_at desc, eligible.id desc
    limit 1
  ), independent_runs as (
    select count(distinct eligible.source_lesson_run_id_at_time) as count
    from eligible
    where eligible.direction = 'positive'
      and eligible.support = 'independent'
  )
  select coalesce((
    select
      p_current_state_evaluated_at < p_expected_evaluated_at
      and p_expected_evaluated_at <= statement_timestamp()
      and latest.direction = 'positive'
      and latest.support = 'independent'
      and independent_runs.count >= 2
      and p_expected_evaluated_at =
        latest.observed_at + interval '90 days'
    from latest cross join independent_runs
  ), false);
$function$;

revoke all on function
  public.teacher_learning_activity_legacy_override_token_is_valid(
    uuid, uuid, uuid, timestamptz, timestamptz
  ) from public, anon, authenticated, service_role;
grant execute on function
  public.teacher_learning_activity_legacy_override_token_is_valid(
    uuid, uuid, uuid, timestamptz, timestamptz
  ) to postgres;

-- The deployed LA-M3 mutation uses evaluatedAt as its optimistic token. A
-- legacy observation-only projection normally returns the persisted union
-- state token. When freshness crosses 90 days without changing the newer quiz
-- state, it returns the deterministic freshness boundary instead; accept only
-- that exact boundary while the locked observation source is still unchanged.
create or replace function public.set_learner_recommendation_override(
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

  if not public.lock_current_account_session_authority(
    v_actor_account_id
  ) then
    raise exception 'learner_recommendation_override_not_found'
      using errcode = 'P0002';
  end if;

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
  for update of state;

  if not found
    or (
      v_state.evaluated_at <> p_expected_state_updated_at
      and not public.teacher_learning_activity_legacy_override_token_is_valid(
        v_actor_account_id,
        p_learner_profile_id,
        p_source_learning_objective_id_at_time,
        v_state.evaluated_at,
        p_expected_state_updated_at
      )
    )
  then
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

create or replace function public.teacher_learning_activity_profile_projection(
  p_learner_profile_id uuid,
  p_recorded_by_account_id uuid,
  p_generated_at timestamp with time zone
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $function$
  with candidate as materialized (
    select
      state.id as state_id,
      state.source_learning_objective_id_at_time,
      state.source_course_id_at_time,
      state.course_title_at_time,
      state.subject_at_time,
      state.objective_title_at_time,
      state.learning_objective_id,
      state.evaluated_at,
      true as has_observation
    from public.learner_objective_state as state
    where state.recorded_by_account_id = p_recorded_by_account_id
      and state.learner_profile_id = p_learner_profile_id
      and exists (
        select 1
        from public.learning_evidence as evidence
        join public.learning_record as record
          on record.id = evidence.learning_record_id
         and record.recorded_by_account_id = evidence.recorded_by_account_id
         and record.learner_profile_id = evidence.learner_profile_id
        where evidence.recorded_by_account_id = p_recorded_by_account_id
          and evidence.learner_profile_id = p_learner_profile_id
          and evidence.source_learning_objective_id_at_time =
            state.source_learning_objective_id_at_time
          and evidence.source_observation_id is not null
          and evidence.source_choice_quiz_evaluation_id is null
          and evidence.evidence_version = 1
          and evidence.eligibility_policy_version = 1
          and evidence.superseded_by_evidence_id is null
          and record.occurred_at is not null
          and record.was_present
          and record.superseded_by_record_id is null
      )

    union all

    select
      null::uuid,
      objective.id,
      course.id,
      btrim(course.title),
      nullif(btrim(course.subject), ''),
      btrim(objective.title),
      objective.id,
      p_generated_at,
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
          and exists (
            select 1
            from public.learning_evidence as evidence
            join public.learning_record as record
              on record.id = evidence.learning_record_id
             and record.recorded_by_account_id =
               evidence.recorded_by_account_id
             and record.learner_profile_id = evidence.learner_profile_id
            where evidence.recorded_by_account_id =
                p_recorded_by_account_id
              and evidence.learner_profile_id = p_learner_profile_id
              and evidence.source_learning_objective_id_at_time = objective.id
              and evidence.source_observation_id is not null
              and evidence.source_choice_quiz_evaluation_id is null
              and evidence.evidence_version = 1
              and evidence.eligibility_policy_version = 1
              and evidence.superseded_by_evidence_id is null
              and record.occurred_at is not null
              and record.was_present
              and record.superseded_by_record_id is null
          )
      )
  ), bounded as materialized (
    select candidate.*
    from candidate
    order by
      candidate.has_observation desc,
      case when candidate.has_observation
        then candidate.evaluated_at else p_generated_at end desc,
      candidate.course_title_at_time,
      candidate.objective_title_at_time,
      candidate.source_course_id_at_time,
      candidate.source_learning_objective_id_at_time,
      candidate.state_id nulls last
    limit 200
  ), projected as materialized (
    select
      bounded.*,
      public.teacher_learning_activity_legacy_observation_state(
        p_learner_profile_id,
        p_recorded_by_account_id,
        bounded.source_learning_objective_id_at_time,
        p_generated_at,
        jsonb_build_object(
          'stateId', bounded.state_id,
          'learningObjectiveId', bounded.learning_objective_id,
          'sourceLearningObjectiveIdAtTime',
            bounded.source_learning_objective_id_at_time,
          'sourceCourseIdAtTime', bounded.source_course_id_at_time,
          'courseTitleAtTime', bounded.course_title_at_time,
          'subjectAtTime', bounded.subject_at_time,
          'objectiveTitleAtTime', bounded.objective_title_at_time,
          'evaluatedAt', bounded.evaluated_at
        )
      ) as state_payload
    from bounded
  )
  select jsonb_build_object(
    'projectionVersion', 1,
    'learnerProfileId', p_learner_profile_id,
    'generatedAt', p_generated_at,
    'states', coalesce(jsonb_agg(
      projected.state_payload
      order by
        projected.has_observation desc,
        case when projected.has_observation
          then projected.evaluated_at else p_generated_at end desc,
        projected.course_title_at_time,
        projected.objective_title_at_time,
        projected.source_course_id_at_time,
        projected.source_learning_objective_id_at_time,
        projected.state_id nulls last
    ), '[]'::jsonb)
  )
  from projected;
$function$;

revoke all on function public.teacher_learning_activity_profile_projection(
  uuid, uuid, timestamptz
) from public, anon, authenticated, service_role;
grant execute on function public.teacher_learning_activity_profile_projection(
  uuid, uuid, timestamptz
) to postgres;

create or replace function public.get_my_learning_activity_profile()
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
  select profile.id
  into v_profile_id
  from public.learner_profile as profile
  where profile.account_id = v_actor_account_id;
  if not found then
    raise exception 'learner_profile_not_found' using errcode = 'P0002';
  end if;

  perform public.lock_learning_activity_learners(array[v_profile_id]);
  if not public.lock_current_account_session_authority(
    v_actor_account_id
  ) then
    raise exception 'learner_profile_not_found' using errcode = 'P0002';
  end if;
  perform 1
  from public.learner_profile as profile
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
  from public, anon, service_role;
grant execute on function public.get_my_learning_activity_profile()
  to authenticated, postgres;

create or replace function public.get_observed_learner_activity_profile(
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

  perform public.lock_learning_activity_learners(
    array[p_learner_profile_id]
  );
  if not public.lock_current_account_session_authority(
    v_actor_account_id
  ) then
    raise exception 'observed_learner_profile_not_found'
      using errcode = 'P0002';
  end if;
  perform 1
  from public.learner_profile as profile
  where profile.id = p_learner_profile_id
  for update of profile;
  if not found then
    raise exception 'observed_learner_profile_not_found'
      using errcode = 'P0002';
  end if;
  select grant_row.id
  into v_grant_id
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
  from public, anon, service_role;
grant execute on function public.get_observed_learner_activity_profile(uuid)
  to authenticated, postgres;

-- Preserve the deployed LA-M3 authenticated surface during rolling app
-- upgrades, but bind it to the same exact live Supabase session as V2. The
-- learner advisory is deliberately first; the retained authority and
-- relation locks are then acquired before any refresh writes or projection.
create or replace function public.get_teacher_learner_activity_profile(
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
  if not public.lock_current_account_session_authority(
    v_actor_account_id
  ) then
    raise exception 'learner_activity_profile_not_found'
      using errcode = 'P0002';
  end if;
  perform 1
  from public.learner_profile as profile
  where profile.id = v_profile_id
  for update of profile;
  if not found then
    raise exception 'learner_activity_profile_not_found'
      using errcode = 'P0002';
  end if;

  perform 1
  from public.teacher_learner as relation
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
  from public, anon, service_role;
grant execute on function public.get_teacher_learner_activity_profile(uuid)
  to authenticated, postgres;

create function public.get_teacher_learner_activity_profile_v2(
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
  if not public.lock_current_account_session_authority(
    v_actor_account_id
  ) then
    raise exception 'learner_activity_profile_not_found'
      using errcode = 'P0002';
  end if;
  perform 1
  from public.learner_profile as profile
  where profile.id = v_profile_id
  for update of profile;
  if not found then
    raise exception 'learner_activity_profile_not_found'
      using errcode = 'P0002';
  end if;

  perform 1
  from public.teacher_learner as relation
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
  return public.teacher_learning_activity_profile_projection_v2(
    v_profile_id,
    v_actor_account_id,
    v_generated_at
  );
end
$function$;

revoke all on function public.get_teacher_learner_activity_profile_v2(uuid)
  from public, anon, service_role;
grant execute on function public.get_teacher_learner_activity_profile_v2(uuid)
  to authenticated, postgres;

create or replace function public.learner_erasure_state_for_actor(p_actor_account_id uuid, p_learner_profile_id uuid) RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
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
    select 'quiz-issue:' || issue.id::text || ':' || issue.definition_revision
      from public.choice_quiz_issue as issue
      join lineage on lineage.id = issue.learner_profile_id
    union all
    select 'quiz-attempt:' || attempt.id::text || ':'
      || attempt.idempotency_key::text
      from public.choice_quiz_attempt as attempt
      join public.choice_quiz_issue as issue on issue.id = attempt.issue_id
      join lineage on lineage.id = issue.learner_profile_id
    union all
    select 'quiz-evaluation:' || evaluation.id::text || ':'
      || evaluation.score::text || ':'
      || coalesce(evaluation.superseded_by_evaluation_id::text, '-')
      from public.choice_quiz_evaluation as evaluation
      join public.choice_quiz_attempt as attempt on attempt.id = evaluation.attempt_id
      join public.choice_quiz_issue as issue on issue.id = attempt.issue_id
      join lineage on lineage.id = issue.learner_profile_id
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
    'choiceQuizIssueCount', (
      select count(*) from public.choice_quiz_issue as issue
      join lineage on lineage.id = issue.learner_profile_id
    ),
    'choiceQuizAttemptCount', (
      select count(*) from public.choice_quiz_attempt as attempt
      join public.choice_quiz_issue as issue on issue.id = attempt.issue_id
      join lineage on lineage.id = issue.learner_profile_id
    ),
    'choiceQuizResponseCount', (
      select count(*) from public.choice_quiz_response as response
      join public.choice_quiz_attempt as attempt on attempt.id = response.attempt_id
      join public.choice_quiz_issue as issue on issue.id = attempt.issue_id
      join lineage on lineage.id = issue.learner_profile_id
    ),
    'choiceQuizEvaluationCount', (
      select count(*) from public.choice_quiz_evaluation as evaluation
      join public.choice_quiz_attempt as attempt on attempt.id = evaluation.attempt_id
      join public.choice_quiz_issue as issue on issue.id = attempt.issue_id
      join lineage on lineage.id = issue.learner_profile_id
    ),
    'choiceQuizFeedbackDeliveryCount', (
      select count(*) from public.choice_quiz_feedback_delivery as feedback
      join public.choice_quiz_attempt as attempt on attempt.id = feedback.attempt_id
      join public.choice_quiz_issue as issue on issue.id = attempt.issue_id
      join lineage on lineage.id = issue.learner_profile_id
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

-- Keep the authenticated LA-M3 preview response byte-compatible during the
-- DB-first window. Choice Quiz counts remain in the signed internal scope and
-- the final audit event, but are not added to the strict browser DTO.
create or replace function public.preview_my_learning_data_erasure()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor_account_id uuid := public.current_account_id();
  v_profile_id uuid := public.current_owned_learner_profile_id();
  v_current_profile_id uuid;
  v_base jsonb;
  v_payload jsonb;
  v_fingerprint bytea;
begin
  if v_actor_account_id is null or v_profile_id is null then
    raise exception 'learner_profile_not_found' using errcode = 'P0002';
  end if;

  perform public.lock_learning_activity_learners(array[v_profile_id]);
  if not public.lock_current_account_session_authority(
    v_actor_account_id
  ) then
    raise exception 'learner_profile_not_found' using errcode = 'P0002';
  end if;

  select profile.id
  into v_current_profile_id
  from public.learner_profile as profile
  where profile.account_id = v_actor_account_id
  for share of profile;
  if not found or v_current_profile_id is distinct from v_profile_id then
    raise exception 'learner_profile_not_found' using errcode = 'P0002';
  end if;

  delete from public.learner_erasure_request
  where account_id = v_actor_account_id
    and consumed_at is null;

  v_base := public.learner_erasure_state_for_actor(
    v_actor_account_id,
    v_profile_id
  );
  v_fingerprint := extensions.digest(v_base::text, 'sha256');
  v_payload := (
    v_base
      - 'accountId'
      - 'currentLearnerProfileId'
      - 'scopeState'
      - 'choiceQuizIssueCount'
      - 'choiceQuizAttemptCount'
      - 'choiceQuizResponseCount'
      - 'choiceQuizEvaluationCount'
      - 'choiceQuizFeedbackDeliveryCount'
  ) || jsonb_build_object(
    'previewFingerprint', encode(v_fingerprint, 'hex'),
    'generatedAt', now()
  );

  insert into public.learner_erasure_request (
    account_id,
    current_learner_profile_id,
    preview_fingerprint,
    preview_payload,
    expires_at
  ) values (
    v_actor_account_id,
    v_profile_id,
    v_fingerprint,
    v_payload,
    now() + interval '15 minutes'
  );

  perform public.append_learner_identity_audit(
    'learning_data_erasure_previewed',
    v_actor_account_id,
    v_actor_account_id,
    v_profile_id,
    null,
    null,
    jsonb_build_object('projectionVersion', 1)
  );
  return v_payload;
end
$function$;

-- The service-role erasure confirmation used to trust only an actor UUID from
-- the application. Replace that boundary with the exact Supabase session from
-- the already verified app JWT. During the DB-first/web-second rolling window
-- the old two-argument call fails closed instead of retaining a revocation
-- race.
drop function public.confirm_my_learning_data_erasure(uuid, text);

create function public.confirm_my_learning_data_erasure(
  p_actor_auth_user_id uuid,
  p_session_id uuid,
  p_preview_fingerprint text
) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    as $function$
declare
  v_actor_account_id uuid :=
    public.account_id_for_auth_user(p_actor_auth_user_id);
  v_account public.account%rowtype;
  v_session_created_at timestamptz;
  v_session_not_after timestamptz;
  v_sessions_invalid_before timestamptz;
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
    or p_session_id is null
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

  -- Match the canonical learner -> Supabase Session -> Account/security order
  -- used by live delivery. All authority values are re-read after the learner
  -- advisory lock and held through commit, so cutoff/deactivation cannot race
  -- a destructive confirmation.
  select session.created_at, session.not_after
  into v_session_created_at, v_session_not_after
  from auth.sessions as session
  where session.id = p_session_id
    and session.user_id = p_actor_auth_user_id
  for share of session;
  if not found
    or v_session_created_at is null
    or (
      v_session_not_after is not null
      and v_session_not_after <= clock_timestamp()
    )
  then
    raise exception 'learning_data_erasure_session_revoked'
      using errcode = '42501';
  end if;

  select account.* into v_account
  from public.account as account
  where account.id = v_actor_account_id
    and account.auth_user_id = p_actor_auth_user_id
    and account.status = 'active'
  for update of account;
  if not found then
    raise exception 'learning_data_erasure_session_revoked'
      using errcode = '42501';
  end if;

  select security.sessions_invalid_before
  into v_sessions_invalid_before
  from public.account_security as security
  where security.account_id = v_actor_account_id
  for share of security;
  if not found
    or (
      v_sessions_invalid_before is not null
      and v_session_created_at < v_sessions_invalid_before
    )
  then
    raise exception 'learning_data_erasure_session_revoked'
      using errcode = '42501';
  end if;

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
  perform 1 from public.choice_quiz_issue
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
  v_counts := v_current_base;

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
  delete from public.choice_quiz_issue
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
      'choiceQuizIssueCount', v_counts -> 'choiceQuizIssueCount',
      'choiceQuizAttemptCount', v_counts -> 'choiceQuizAttemptCount',
      'choiceQuizResponseCount', v_counts -> 'choiceQuizResponseCount',
      'choiceQuizEvaluationCount', v_counts -> 'choiceQuizEvaluationCount',
      'choiceQuizFeedbackDeliveryCount',
        v_counts -> 'choiceQuizFeedbackDeliveryCount',
      'learningEvidenceCount', v_learning_evidence_count,
      'objectiveStateCount', v_objective_state_count,
      'recommendationOverrideCount', v_recommendation_override_count,
      'learningActivityProjectionVersion', 2,
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

revoke all on function public.confirm_my_learning_data_erasure(
  uuid, uuid, text
) from public, anon, authenticated, service_role;
grant execute on function public.confirm_my_learning_data_erasure(
  uuid, uuid, text
) to service_role, postgres;

-- The bounded AI projection crosses a service-role adapter, so neither
-- auth.uid() nor the service JWT can establish the human actor. Bind the
-- explicit Auth user to the exact server-decoded Supabase session instead.
-- Initial audience discovery is used only to acquire the canonical learner
-- advisory locks; all authority and mutable scope are re-read afterwards.
create function public.build_course_learning_activity_context(
  p_actor_auth_user_id uuid,
  p_actor_session_id uuid,
  p_course_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor_account_id uuid;
  v_session_created_at timestamptz;
  v_session_not_after timestamptz;
  v_sessions_invalid_before timestamptz;
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
  from effective_audience;

  if coalesce(cardinality(v_initial_profile_ids), 0) > 0 then
    perform public.lock_learning_activity_learners(v_initial_profile_ids);
  end if;

  select session.created_at, session.not_after
  into v_session_created_at, v_session_not_after
  from auth.sessions as session
  where session.id = p_actor_session_id
    and session.user_id = p_actor_auth_user_id
  for share of session;
  if not found
    or v_session_created_at is null
    or (
      v_session_not_after is not null
      and v_session_not_after <= clock_timestamp()
    )
  then
    raise exception 'learning_activity_context_session_revoked'
      using errcode = '42501';
  end if;

  select account.id, security.sessions_invalid_before
  into v_actor_account_id, v_sessions_invalid_before
  from public.account as account
  join public.account_security as security
    on security.account_id = account.id
  where account.auth_user_id = p_actor_auth_user_id
    and account.status in ('active', 'provisional')
  for share of account, security;
  if not found
    or (
      v_sessions_invalid_before is not null
      and v_session_created_at < v_sessions_invalid_before
    )
  then
    raise exception 'learning_activity_context_session_revoked'
      using errcode = '42501';
  end if;

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
  if coalesce(cardinality(v_initial_profile_ids), 0) > 0 then
    perform profile.id
    from public.learner_profile as profile
    where profile.id = any(v_initial_profile_ids)
    order by profile.id
    for update of profile;
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

  if coalesce(cardinality(v_profile_ids), 0) = 0 then
    return v_unused;
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
  uuid, uuid, uuid
) from public, anon, authenticated, service_role;
grant execute on function public.build_course_learning_activity_context(
  uuid, uuid, uuid
) to postgres, service_role;

-- Keep the old PostgREST overload during the DB-first/application-second
-- rollout, but never let it bypass exact-session authority. Existing app code
-- already degrades an unavailable AI projection to the explicit empty shape.
create or replace function public.build_course_learning_activity_context(
  p_actor_auth_user_id uuid,
  p_course_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
begin
  raise exception 'learning_activity_context_session_required'
    using errcode = '42501';
end
$function$;

revoke all on function public.build_course_learning_activity_context(
  uuid, uuid
) from public, anon, authenticated, service_role;
grant execute on function public.build_course_learning_activity_context(
  uuid, uuid
) to postgres, service_role;

commit;
