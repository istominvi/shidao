-- Universal roleless Account bootstrap and default-deny learner-identity
-- primitives.  Secret-bearing browser flows intentionally stop at the web
-- server: this schema stores only keyed 32-byte digests for bearer tokens and
-- recipient e-mail addresses.

begin;

do $$
begin
  if to_regclass('public.account') is null
    or to_regclass('public.learner_profile') is null
    or to_regclass('public.teacher_learner') is null
    or to_regclass('public.learning_record') is null
    or to_regclass('public.user_preference') is null
    or to_regclass('public.user_security') is null
    or to_regprocedure('public.current_account_id()') is null
    or to_regprocedure('extensions.crypt(text,text)') is null
    or to_regprocedure('extensions.gen_salt(text)') is null
    or to_regprocedure('extensions.digest(text,text)') is null
  then
    raise exception 'learner_identity_primitives_preflight_schema_mismatch';
  end if;

  if to_regclass('public.account_login_alias') is not null
    or to_regclass('public.learner_profile_merge') is not null
    or to_regprocedure('public.current_account_auth_context()') is not null
  then
    raise exception 'learner_identity_primitives_preflight_already_applied';
  end if;
end
$$;

lock table public.account in share row exclusive mode;
lock table public.learner_profile in share row exclusive mode;
lock table public.teacher_learner in share row exclusive mode;

alter table public.account
  drop constraint account_status_check,
  add constraint account_status_check
    check (status in ('active', 'provisional', 'suspended', 'deleted'));

create table public.account_login_alias (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null
    references public.account(id) on delete cascade,
  normalized_login text not null,
  kind text not null default 'login',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  revoked_at timestamptz,
  constraint account_login_alias_normalized_login_key
    unique (normalized_login),
  constraint account_login_alias_account_kind_key
    unique (account_id, kind),
  constraint account_login_alias_login_check
    check (
      normalized_login = lower(btrim(normalized_login))
      and char_length(normalized_login) between 3 and 80
      and normalized_login ~ '^[[:alnum:]_.-]+$'
    ),
  constraint account_login_alias_kind_check
    check (kind = 'login')
);

create index account_login_alias_account_id_idx
  on public.account_login_alias (account_id);

create table public.account_security (
  account_id uuid primary key
    references public.account(id) on delete cascade,
  pin_hash text,
  pin_failed_attempts integer not null default 0,
  pin_locked_until timestamptz,
  pin_created_at timestamptz,
  pin_updated_at timestamptz,
  last_pin_login_at timestamptz,
  sessions_invalid_before timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint account_security_pin_failed_attempts_check
    check (pin_failed_attempts between 0 and 100)
);

create index account_security_pin_locked_until_idx
  on public.account_security (pin_locked_until)
  where pin_locked_until is not null;

create table public.account_preference (
  account_id uuid primary key
    references public.account(id) on delete cascade,
  last_selected_school_id uuid
    references public.school(id) on delete set null,
  theme text,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint account_preference_settings_check
    check (jsonb_typeof(settings) = 'object')
);

create index account_preference_last_selected_school_idx
  on public.account_preference (last_selected_school_id)
  where last_selected_school_id is not null;

create table public.learner_profile_share_code (
  id uuid primary key default gen_random_uuid(),
  learner_profile_id uuid not null
    references public.learner_profile(id) on delete cascade,
  code_digest bytea not null,
  status text not null default 'active',
  expires_at timestamptz not null,
  used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  constraint learner_profile_share_code_digest_key unique (code_digest),
  constraint learner_profile_share_code_digest_check
    check (octet_length(code_digest) = 32),
  constraint learner_profile_share_code_status_check
    check (status in ('active', 'used', 'revoked', 'expired')),
  constraint learner_profile_share_code_expiry_check
    check (expires_at > created_at),
  constraint learner_profile_share_code_state_check
    check (
      (status = 'active' and used_at is null and revoked_at is null)
      or (status = 'used' and used_at is not null and revoked_at is null)
      or (status = 'revoked' and revoked_at is not null)
      or status = 'expired'
    )
);

create unique index learner_profile_share_code_one_active_idx
  on public.learner_profile_share_code (learner_profile_id)
  where status = 'active';
create index learner_profile_share_code_profile_idx
  on public.learner_profile_share_code (learner_profile_id, created_at desc);

create table public.learner_connection_request (
  id uuid primary key default gen_random_uuid(),
  teacher_account_id uuid not null
    references public.account(id) on delete cascade,
  learner_profile_id uuid
    references public.learner_profile(id) on delete cascade,
  share_code_id uuid
    references public.learner_profile_share_code(id) on delete set null,
  recipient_account_id uuid
    references public.account(id) on delete restrict,
  method text not null,
  recipient_email_digest bytea,
  token_digest bytea,
  local_display_name text not null,
  status text not null default 'pending',
  expires_at timestamptz not null,
  accepted_at timestamptz,
  acted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint learner_connection_request_method_check
    check (method in ('share_code', 'email', 'exact_handle')),
  constraint learner_connection_request_email_digest_check
    check (
      recipient_email_digest is null
      or octet_length(recipient_email_digest) = 32
    ),
  constraint learner_connection_request_token_digest_check
    check (token_digest is null or octet_length(token_digest) = 32),
  constraint learner_connection_request_local_name_check
    check (
      btrim(local_display_name) <> ''
      and char_length(local_display_name) <= 160
    ),
  constraint learner_connection_request_status_check
    check (status in ('pending', 'accepted', 'rejected', 'cancelled', 'expired')),
  constraint learner_connection_request_method_shape_check
    check (
      (method = 'share_code' and share_code_id is not null
        and recipient_email_digest is null and token_digest is null
        and learner_profile_id is not null)
      or (method = 'email' and share_code_id is null
        and recipient_email_digest is not null
        and (status <> 'pending' or token_digest is not null))
      or (method = 'exact_handle' and share_code_id is null
        and recipient_email_digest is null and token_digest is null
        and learner_profile_id is not null)
    ),
  constraint learner_connection_request_expiry_check
    check (expires_at > created_at)
);

create index learner_connection_request_teacher_idx
  on public.learner_connection_request (teacher_account_id, status, created_at desc);
create index learner_connection_request_profile_idx
  on public.learner_connection_request (learner_profile_id, status, created_at desc)
  where learner_profile_id is not null;
create index learner_connection_request_share_code_idx
  on public.learner_connection_request (share_code_id)
  where share_code_id is not null;
create index learner_connection_request_recipient_idx
  on public.learner_connection_request (recipient_account_id, status, created_at desc)
  where recipient_account_id is not null;
create unique index learner_connection_request_token_digest_key
  on public.learner_connection_request (token_digest)
  where token_digest is not null;
create unique index learner_connection_request_one_pending_idx
  on public.learner_connection_request (teacher_account_id, learner_profile_id)
  where status = 'pending' and learner_profile_id is not null;
create unique index learner_connection_request_one_pending_email_idx
  on public.learner_connection_request (teacher_account_id, recipient_email_digest)
  where status = 'pending' and method = 'email';

create table public.learner_claim_invitation (
  id uuid primary key default gen_random_uuid(),
  -- Kept as an audit reference after an accepted merge deletes the source.
  source_learner_profile_id uuid not null,
  inviter_account_id uuid not null
    references public.account(id) on delete cascade,
  recipient_account_id uuid
    references public.account(id) on delete restrict,
  recipient_email_digest bytea not null,
  token_digest bytea not null,
  kind text not null,
  status text not null default 'pending',
  expires_at timestamptz not null,
  accepted_at timestamptz,
  revoked_at timestamptz,
  rejected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint learner_claim_invitation_token_digest_key unique (token_digest),
  constraint learner_claim_invitation_token_digest_check
    check (octet_length(token_digest) = 32),
  constraint learner_claim_invitation_email_digest_check
    check (octet_length(recipient_email_digest) = 32),
  constraint learner_claim_invitation_kind_check
    check (kind in ('claim', 'child_activation')),
  constraint learner_claim_invitation_status_check
    check (status in ('pending', 'bound', 'accepted', 'rejected', 'revoked', 'expired')),
  constraint learner_claim_invitation_expiry_check
    check (expires_at > created_at)
);

create index learner_claim_invitation_source_idx
  on public.learner_claim_invitation (source_learner_profile_id, status, created_at desc);
create index learner_claim_invitation_inviter_idx
  on public.learner_claim_invitation (inviter_account_id, status, created_at desc);
create index learner_claim_invitation_recipient_idx
  on public.learner_claim_invitation (recipient_account_id, status, created_at desc)
  where recipient_account_id is not null;
create unique index learner_claim_invitation_one_pending_kind_idx
  on public.learner_claim_invitation (source_learner_profile_id, kind)
  where status in ('pending', 'bound');

create table public.learner_profile_merge (
  id uuid primary key default gen_random_uuid(),
  -- Deliberately no FK: successful merge physically deletes the source while
  -- this metadata-only operation retains its UUID for lineage audit.
  source_learner_profile_id uuid not null,
  target_learner_profile_id uuid not null
    references public.learner_profile(id) on delete restrict,
  invitation_id uuid
    references public.learner_claim_invitation(id) on delete set null,
  requested_by_account_id uuid not null
    references public.account(id) on delete restrict,
  subject_account_id uuid not null
    references public.account(id) on delete restrict,
  status text not null default 'pending',
  preview_fingerprint bytea,
  preview_payload jsonb,
  expires_at timestamptz not null,
  completed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint learner_profile_merge_distinct_profiles_check
    check (source_learner_profile_id <> target_learner_profile_id),
  constraint learner_profile_merge_status_check
    check (status in ('pending', 'ready', 'completed', 'cancelled', 'failed')),
  constraint learner_profile_merge_fingerprint_check
    check (preview_fingerprint is null or octet_length(preview_fingerprint) = 32),
  constraint learner_profile_merge_payload_check
    check (preview_payload is null or jsonb_typeof(preview_payload) = 'object'),
  constraint learner_profile_merge_expiry_check
    check (expires_at > created_at)
);

create index learner_profile_merge_source_idx
  on public.learner_profile_merge (source_learner_profile_id, status, created_at desc);
create index learner_profile_merge_target_idx
  on public.learner_profile_merge (target_learner_profile_id, status, created_at desc);
create unique index learner_profile_merge_invitation_idx
  on public.learner_profile_merge (invitation_id)
  where invitation_id is not null;
create index learner_profile_merge_requester_idx
  on public.learner_profile_merge (requested_by_account_id, created_at desc);
create index learner_profile_merge_subject_idx
  on public.learner_profile_merge (subject_account_id, created_at desc);
create unique index learner_profile_merge_one_open_source_idx
  on public.learner_profile_merge (source_learner_profile_id)
  where status in ('pending', 'ready');

create table public.learner_profile_merge_conflict (
  id uuid primary key default gen_random_uuid(),
  merge_operation_id uuid not null
    references public.learner_profile_merge(id) on delete cascade,
  lesson_run_id uuid not null
    references public.lesson_run(id) on delete restrict,
  primary_record_id uuid not null
    references public.learning_record(id) on delete restrict,
  superseded_record_id uuid not null
    references public.learning_record(id) on delete restrict,
  resolution text not null,
  created_at timestamptz not null default now(),
  constraint learner_profile_merge_conflict_records_check
    check (primary_record_id <> superseded_record_id),
  constraint learner_profile_merge_conflict_resolution_check
    check (resolution in ('keep_target_primary', 'keep_source_primary')),
  constraint learner_profile_merge_conflict_unique
    unique (merge_operation_id, lesson_run_id)
);

create index learner_profile_merge_conflict_run_idx
  on public.learner_profile_merge_conflict (lesson_run_id);
create index learner_profile_merge_conflict_primary_idx
  on public.learner_profile_merge_conflict (primary_record_id);
create index learner_profile_merge_conflict_superseded_idx
  on public.learner_profile_merge_conflict (superseded_record_id);

create table public.learner_profile_merge_private_detail (
  merge_operation_id uuid not null
    references public.learner_profile_merge(id) on delete cascade,
  teacher_account_id uuid not null
    references public.account(id) on delete restrict,
  discarded_source_display_name text not null,
  created_at timestamptz not null default now(),
  primary key (merge_operation_id, teacher_account_id),
  constraint learner_profile_merge_private_name_check
    check (
      btrim(discarded_source_display_name) <> ''
      and char_length(discarded_source_display_name) <= 160
    )
);

create index learner_profile_merge_private_teacher_idx
  on public.learner_profile_merge_private_detail (teacher_account_id);

create table public.learner_profile_alias (
  source_learner_profile_id uuid primary key,
  target_learner_profile_id uuid not null
    references public.learner_profile(id) on delete restrict,
  merge_operation_id uuid not null unique
    references public.learner_profile_merge(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint learner_profile_alias_distinct_check
    check (source_learner_profile_id <> target_learner_profile_id)
);

create index learner_profile_alias_target_idx
  on public.learner_profile_alias (target_learner_profile_id, created_at);

create table public.learner_observer_invitation (
  id uuid primary key default gen_random_uuid(),
  learner_profile_id uuid not null
    references public.learner_profile(id) on delete cascade,
  subject_account_id uuid not null
    references public.account(id) on delete cascade,
  recipient_account_id uuid
    references public.account(id) on delete restrict,
  recipient_email_digest bytea not null,
  token_digest bytea not null,
  relationship_label text,
  status text not null default 'pending',
  expires_at timestamptz not null,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint learner_observer_invitation_token_digest_key unique (token_digest),
  constraint learner_observer_invitation_token_digest_check
    check (octet_length(token_digest) = 32),
  constraint learner_observer_invitation_email_digest_check
    check (octet_length(recipient_email_digest) = 32),
  constraint learner_observer_invitation_label_check
    check (relationship_label is null or char_length(btrim(relationship_label)) between 1 and 80),
  constraint learner_observer_invitation_status_check
    check (status in ('pending', 'bound', 'accepted', 'rejected', 'revoked', 'expired')),
  constraint learner_observer_invitation_expiry_check
    check (expires_at > created_at)
);

create index learner_observer_invitation_profile_idx
  on public.learner_observer_invitation (learner_profile_id, status, created_at desc);
create index learner_observer_invitation_subject_idx
  on public.learner_observer_invitation (subject_account_id, status, created_at desc);
create index learner_observer_invitation_recipient_idx
  on public.learner_observer_invitation (recipient_account_id, status, created_at desc)
  where recipient_account_id is not null;
create unique index learner_observer_invitation_one_pending_idx
  on public.learner_observer_invitation (learner_profile_id, recipient_email_digest)
  where status in ('pending', 'bound');

create table public.learner_observer_grant (
  id uuid primary key default gen_random_uuid(),
  learner_profile_id uuid not null
    references public.learner_profile(id) on delete cascade,
  subject_account_id uuid not null
    references public.account(id) on delete cascade,
  observer_account_id uuid not null
    references public.account(id) on delete cascade,
  invitation_id uuid
    references public.learner_observer_invitation(id) on delete set null,
  relationship_label text,
  status text not null default 'active',
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint learner_observer_grant_distinct_accounts_check
    check (subject_account_id <> observer_account_id),
  constraint learner_observer_grant_label_check
    check (relationship_label is null or char_length(btrim(relationship_label)) between 1 and 80),
  constraint learner_observer_grant_status_check
    check (status in ('active', 'revoked', 'left')),
  constraint learner_observer_grant_subject_unique
    unique (learner_profile_id, observer_account_id)
);

create index learner_observer_grant_subject_idx
  on public.learner_observer_grant (subject_account_id, status, created_at desc);
create index learner_observer_grant_observer_idx
  on public.learner_observer_grant (observer_account_id, status, created_at desc);
create index learner_observer_grant_invitation_idx
  on public.learner_observer_grant (invitation_id)
  where invitation_id is not null;

create table public.learner_ai_consent (
  id uuid primary key default gen_random_uuid(),
  learner_profile_id uuid not null
    references public.learner_profile(id) on delete cascade,
  course_id uuid not null
    references public.course(id) on delete cascade,
  owner_account_id uuid not null
    references public.account(id) on delete cascade,
  purpose text not null,
  status text not null default 'pending',
  revision integer not null default 1,
  expires_at timestamptz not null,
  granted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint learner_ai_consent_purpose_check
    check (btrim(purpose) <> '' and char_length(purpose) <= 400),
  constraint learner_ai_consent_status_check
    check (status in ('pending', 'active', 'revoked', 'expired', 'invalid')),
  constraint learner_ai_consent_revision_check check (revision > 0),
  constraint learner_ai_consent_expiry_check check (expires_at > created_at),
  constraint learner_ai_consent_scope_unique
    unique (learner_profile_id, course_id, owner_account_id)
);

create index learner_ai_consent_course_idx
  on public.learner_ai_consent (course_id, owner_account_id, status);
create index learner_ai_consent_owner_idx
  on public.learner_ai_consent (owner_account_id, status, created_at desc);

create table public.learner_identity_audit_event (
  id bigint generated always as identity primary key,
  event_type text not null,
  actor_account_id uuid
    references public.account(id) on delete set null,
  subject_account_id uuid
    references public.account(id) on delete set null,
  learner_profile_id uuid,
  related_learner_profile_id uuid,
  related_entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  constraint learner_identity_audit_event_type_check
    check (btrim(event_type) <> '' and char_length(event_type) <= 100),
  constraint learner_identity_audit_metadata_check
    check (
      jsonb_typeof(metadata) = 'object'
      and pg_column_size(metadata) <= 4096
      and not (metadata ?| array[
        'email', 'token', 'digest', 'pin', 'comment', 'displayName',
        'display_name', 'authUserId', 'auth_user_id'
      ])
    )
);

create index learner_identity_audit_actor_idx
  on public.learner_identity_audit_event (actor_account_id, occurred_at desc)
  where actor_account_id is not null;
create index learner_identity_audit_subject_idx
  on public.learner_identity_audit_event (subject_account_id, occurred_at desc)
  where subject_account_id is not null;
create index learner_identity_audit_profile_idx
  on public.learner_identity_audit_event (learner_profile_id, occurred_at desc)
  where learner_profile_id is not null;

create table public.learner_identity_rate_limit (
  scope text not null,
  key_digest bytea not null,
  window_started_at timestamptz not null,
  hit_count integer not null default 1,
  blocked_until timestamptz,
  updated_at timestamptz not null default now(),
  primary key (scope, key_digest, window_started_at),
  constraint learner_identity_rate_limit_scope_check
    check (btrim(scope) <> '' and char_length(scope) <= 80),
  constraint learner_identity_rate_limit_key_check
    check (octet_length(key_digest) = 32),
  constraint learner_identity_rate_limit_count_check
    check (hit_count between 1 and 100000)
);

create index learner_identity_rate_limit_cleanup_idx
  on public.learner_identity_rate_limit (window_started_at, blocked_until);

create table public.learner_erasure_request (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null
    references public.account(id) on delete cascade,
  current_learner_profile_id uuid not null
    references public.learner_profile(id) on delete cascade,
  preview_fingerprint bytea not null,
  preview_payload jsonb not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint learner_erasure_request_fingerprint_check
    check (octet_length(preview_fingerprint) = 32),
  constraint learner_erasure_request_payload_check
    check (jsonb_typeof(preview_payload) = 'object'),
  constraint learner_erasure_request_expiry_check
    check (expires_at > created_at)
);

create index learner_erasure_request_account_idx
  on public.learner_erasure_request (account_id, created_at desc);

-- Dedicated credential-recovery authority for an internal-login learner.
-- It is intentionally separate from observer/read access and is granted only
-- to the verified adult who completed child activation.
create table public.learner_credential_recovery_delegate (
  id uuid primary key default gen_random_uuid(),
  subject_account_id uuid not null
    references public.account(id) on delete cascade,
  delegate_account_id uuid not null
    references public.account(id) on delete cascade,
  activation_invitation_id uuid
    references public.learner_claim_invitation(id) on delete set null,
  status text not null default 'active',
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  last_reset_idempotency_key uuid,
  last_reset_result jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint learner_credential_recovery_distinct_accounts_check
    check (subject_account_id <> delegate_account_id),
  constraint learner_credential_recovery_status_check
    check (status in ('active', 'revoked')),
  constraint learner_credential_recovery_state_check
    check (
      (status = 'active' and revoked_at is null)
      or (status = 'revoked' and revoked_at is not null)
    ),
  constraint learner_credential_recovery_reset_result_check
    check (
      (last_reset_idempotency_key is null and last_reset_result is null)
      or (
        last_reset_idempotency_key is not null
        and jsonb_typeof(last_reset_result) = 'object'
        and pg_column_size(last_reset_result) <= 2048
      )
    ),
  constraint learner_credential_recovery_subject_delegate_key
    unique (subject_account_id, delegate_account_id)
);

create index learner_credential_recovery_delegate_idx
  on public.learner_credential_recovery_delegate (
    delegate_account_id, status, created_at desc
  );
create index learner_credential_recovery_subject_idx
  on public.learner_credential_recovery_delegate (
    subject_account_id, status, created_at desc
  );

create table public.learner_identity_reconciliation (
  id uuid primary key default gen_random_uuid(),
  observer_account_id uuid
    references public.account(id) on delete cascade,
  learner_profile_id uuid
    references public.learner_profile(id) on delete cascade,
  legacy_parent_id uuid,
  legacy_student_id uuid,
  status text not null default 'pending',
  reason text not null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  constraint learner_identity_reconciliation_status_check
    check (status in ('pending', 'accepted', 'rejected', 'needs_review')),
  constraint learner_identity_reconciliation_reason_check
    check (reason in ('exact_legacy_parent_student', 'ambiguous_legacy_identity')),
  constraint learner_identity_reconciliation_legacy_key
    unique (legacy_parent_id, legacy_student_id)
);

create index learner_identity_reconciliation_observer_idx
  on public.learner_identity_reconciliation (observer_account_id, status)
  where observer_account_id is not null;
create index learner_identity_reconciliation_profile_idx
  on public.learner_identity_reconciliation (learner_profile_id, status)
  where learner_profile_id is not null;

-- Every identity primitive is Data-API default-deny.  SECURITY DEFINER RPCs
-- below are the only supported mutation/read boundary.
do $$
declare
  v_table regclass;
begin
  foreach v_table in array array[
    'public.account_login_alias'::regclass,
    'public.account_security'::regclass,
    'public.account_preference'::regclass,
    'public.learner_profile_share_code'::regclass,
    'public.learner_connection_request'::regclass,
    'public.learner_claim_invitation'::regclass,
    'public.learner_profile_merge'::regclass,
    'public.learner_profile_merge_conflict'::regclass,
    'public.learner_profile_merge_private_detail'::regclass,
    'public.learner_profile_alias'::regclass,
    'public.learner_observer_invitation'::regclass,
    'public.learner_observer_grant'::regclass,
    'public.learner_ai_consent'::regclass,
    'public.learner_identity_audit_event'::regclass,
    'public.learner_identity_rate_limit'::regclass,
    'public.learner_erasure_request'::regclass,
    'public.learner_credential_recovery_delegate'::regclass,
    'public.learner_identity_reconciliation'::regclass
  ]
  loop
    execute format('alter table %s enable row level security', v_table);
    execute format('revoke all on table %s from anon, authenticated', v_table);
    execute format('grant all on table %s to service_role', v_table);
  end loop;
end
$$;

revoke all on sequence public.learner_identity_audit_event_id_seq
  from anon, authenticated;
grant usage, select on sequence public.learner_identity_audit_event_id_seq
  to service_role;

create trigger trg_account_login_alias_updated_at
  before update on public.account_login_alias
  for each row execute function public.set_updated_at();
create trigger trg_account_security_updated_at
  before update on public.account_security
  for each row execute function public.set_updated_at();
create trigger trg_account_preference_updated_at
  before update on public.account_preference
  for each row execute function public.set_updated_at();
create trigger trg_learner_connection_request_updated_at
  before update on public.learner_connection_request
  for each row execute function public.set_updated_at();
create trigger trg_learner_claim_invitation_updated_at
  before update on public.learner_claim_invitation
  for each row execute function public.set_updated_at();
create trigger trg_learner_profile_merge_updated_at
  before update on public.learner_profile_merge
  for each row execute function public.set_updated_at();
create trigger trg_learner_observer_invitation_updated_at
  before update on public.learner_observer_invitation
  for each row execute function public.set_updated_at();
create trigger trg_learner_observer_grant_updated_at
  before update on public.learner_observer_grant
  for each row execute function public.set_updated_at();
create trigger trg_learner_ai_consent_updated_at
  before update on public.learner_ai_consent
  for each row execute function public.set_updated_at();
create trigger trg_learner_credential_recovery_delegate_updated_at
  before update on public.learner_credential_recovery_delegate
  for each row execute function public.set_updated_at();

create function public.guard_learner_identity_audit_append_only()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if coalesce(current_setting('app.learner_identity_erasure', true), '') <> 'on' then
    raise exception 'learner_identity_audit_is_append_only' using errcode = '55000';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end
$$;

create trigger trg_learner_identity_audit_append_only
  before update or delete on public.learner_identity_audit_event
  for each row execute function public.guard_learner_identity_audit_append_only();

create function public.guard_learner_profile_alias_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if coalesce(current_setting('app.learner_identity_erasure', true), '') <> 'on' then
    raise exception 'learner_profile_alias_is_immutable' using errcode = '55000';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end
$$;

create trigger trg_learner_profile_alias_immutable
  before update or delete on public.learner_profile_alias
  for each row execute function public.guard_learner_profile_alias_immutable();

create function public.guard_account_profile_link_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if coalesce(current_setting('app.learner_profile_link_mutation', true), '') = 'on'
    or pg_trigger_depth() > 1
  then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if (tg_op = 'INSERT' and new.account_id is not null)
    or (tg_op = 'UPDATE' and new.account_id is distinct from old.account_id)
    or (tg_op = 'DELETE' and old.account_id is not null)
  then
    raise exception 'learner_profile_account_link_requires_supported_workflow'
      using errcode = '42501';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end
$$;

create trigger trg_learner_profile_account_link_guard
  before insert or delete or update of account_id on public.learner_profile
  for each row execute function public.guard_account_profile_link_mutation();

create function public.enforce_account_exactly_one_learner_profile()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_account_id uuid;
begin
  for v_account_id in
    select distinct candidate.account_id
    from (
      select case when tg_table_name = 'account' and tg_op <> 'DELETE'
        then (to_jsonb(new) ->> 'id')::uuid
        when tg_table_name = 'learner_profile' and tg_op <> 'DELETE'
        then (to_jsonb(new) ->> 'account_id')::uuid end as account_id
      union all
      select case when tg_table_name = 'account' and tg_op <> 'INSERT'
        then (to_jsonb(old) ->> 'id')::uuid
        when tg_table_name = 'learner_profile' and tg_op <> 'INSERT'
        then (to_jsonb(old) ->> 'account_id')::uuid end
    ) as candidate
    where candidate.account_id is not null
  loop
    if exists (
      select 1
      from public.account as account
      where account.id = v_account_id
        and account.status in ('active', 'provisional')
    ) and (
      select count(*)
      from public.learner_profile as profile
      where profile.account_id = v_account_id
    ) <> 1 then
      raise exception 'account_requires_exactly_one_learner_profile'
        using errcode = '23514';
    end if;
  end loop;

  return null;
end
$$;

create constraint trigger trg_account_exactly_one_learner_profile
  after insert or update or delete on public.account
  deferrable initially deferred
  for each row execute function public.enforce_account_exactly_one_learner_profile();

create constraint trigger trg_learner_profile_exactly_one_account
  after insert or update or delete on public.learner_profile
  deferrable initially deferred
  for each row execute function public.enforce_account_exactly_one_learner_profile();

-- Auth Admin cleanup of an unused provisional user must not leave the
-- bootstrap profile behind as a new offline learner.  Only a genuinely empty
-- provisional profile is removed; any profile that has acquired application
-- data is deliberately preserved for an explicit identity workflow.
create function public.cleanup_empty_provisional_profile_on_account_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid;
begin
  if old.status <> 'provisional' then
    return old;
  end if;

  select profile.id into v_profile_id
  from public.learner_profile as profile
  where profile.account_id = old.id
  for update of profile;

  if v_profile_id is null
    or exists (select 1 from public.learning_record where learner_profile_id = v_profile_id)
    or exists (select 1 from public.teacher_learner where learner_profile_id = v_profile_id)
    or exists (select 1 from public.learner_group_member where learner_profile_id = v_profile_id)
    or exists (select 1 from public.course_learner where learner_profile_id = v_profile_id)
    or exists (select 1 from public.learner_profile_share_code where learner_profile_id = v_profile_id)
    or exists (select 1 from public.learner_connection_request where learner_profile_id = v_profile_id)
    or exists (select 1 from public.learner_claim_invitation where source_learner_profile_id = v_profile_id)
    or exists (select 1 from public.learner_profile_merge where source_learner_profile_id = v_profile_id or target_learner_profile_id = v_profile_id)
    or exists (select 1 from public.learner_profile_alias where source_learner_profile_id = v_profile_id or target_learner_profile_id = v_profile_id)
    or exists (select 1 from public.learner_observer_invitation where learner_profile_id = v_profile_id)
    or exists (select 1 from public.learner_observer_grant where learner_profile_id = v_profile_id)
    or exists (select 1 from public.learner_ai_consent where learner_profile_id = v_profile_id)
    or exists (select 1 from public.learner_credential_recovery_delegate
      where subject_account_id = old.id or delegate_account_id = old.id)
    or exists (select 1 from public.learner_identity_reconciliation
      where learner_profile_id = v_profile_id)
  then
    return old;
  end if;

  perform set_config('app.learner_profile_link_mutation', 'on', true);
  delete from public.learner_profile where id = v_profile_id;
  return old;
end
$$;

create trigger trg_account_cleanup_empty_provisional_profile
  before delete on public.account
  for each row execute function public.cleanup_empty_provisional_profile_on_account_delete();

revoke all on function public.cleanup_empty_provisional_profile_on_account_delete()
  from public, anon, authenticated, service_role;

-- The Auth trigger is the only ordinary bootstrap path.  App metadata is set
-- only by trusted Auth Admin callers; user metadata never grants capability.
create or replace function public.handle_auth_user_account()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_account public.account%rowtype;
begin
  perform set_config('app.learner_profile_link_mutation', 'on', true);

  insert into public.account as target (
    auth_user_id,
    display_name,
    status
  )
  values (
    new.id,
    coalesce(
      nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(btrim(new.raw_user_meta_data ->> 'name'), ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'Пользователь'
    ),
    case
      when new.raw_app_meta_data ->> 'identity_status' = 'provisional'
        then 'provisional'
      else 'active'
    end
  )
  on conflict (auth_user_id) do update
    set display_name = target.display_name
  returning target.* into v_account;

  insert into public.account_security (account_id)
  values (v_account.id)
  on conflict (account_id) do nothing;

  insert into public.account_preference (account_id)
  values (v_account.id)
  on conflict (account_id) do nothing;

  if not exists (
    select 1 from public.learner_profile as profile
    where profile.account_id = v_account.id
  ) then
    insert into public.learner_profile (display_name, account_id)
    values (v_account.display_name, v_account.id);
  end if;

  return new;
end
$$;

revoke all on function public.handle_auth_user_account()
  from public, anon, authenticated, service_role;
grant execute on function public.handle_auth_user_account() to service_role;

-- Deterministic upgrade: preserve every existing account/profile link.  For a
-- missing link, use a legacy student name only when auth_user_id maps to exactly
-- one legacy student; otherwise use Account.display_name.  No name/e-mail fuzzy
-- matching is performed.
select set_config('app.learner_profile_link_mutation', 'on', true);

insert into public.account_security (
  account_id,
  pin_hash,
  pin_failed_attempts,
  pin_locked_until,
  pin_created_at,
  pin_updated_at,
  last_pin_login_at,
  sessions_invalid_before,
  created_at,
  updated_at
)
select
  account.id,
  security.pin_hash,
  least(greatest(coalesce(security.pin_failed_attempts, 0), 0), 100),
  security.pin_locked_until,
  security.pin_created_at,
  security.pin_updated_at,
  security.last_pin_login_at,
  security.sessions_invalid_before,
  coalesce(security.created_at, account.created_at),
  coalesce(security.updated_at, account.updated_at)
from public.account as account
left join public.user_security as security
  on security.user_id = account.auth_user_id
on conflict (account_id) do nothing;

insert into public.account_preference (
  account_id,
  last_selected_school_id,
  theme,
  settings,
  created_at,
  updated_at
)
select
  account.id,
  preference.last_selected_school_id,
  preference.theme,
  coalesce(preference.settings, '{}'::jsonb),
  coalesce(preference.created_at, account.created_at),
  coalesce(preference.updated_at, account.updated_at)
from public.account as account
left join public.user_preference as preference
  on preference.user_id = account.auth_user_id
on conflict (account_id) do nothing;

with exact_legacy_student as (
  select
    student.user_id,
    min(
      btrim(concat_ws(' ', student.first_name, student.last_name))
    ) as display_name
  from public.student as student
  where student.user_id is not null
  group by student.user_id
  having count(*) = 1
)
insert into public.learner_profile (display_name, account_id)
select
  coalesce(
    nullif(exact_legacy_student.display_name, ''),
    account.display_name
  ),
  account.id
from public.account as account
left join exact_legacy_student
  on exact_legacy_student.user_id = account.auth_user_id
where account.status in ('active', 'provisional')
  and not exists (
    select 1
    from public.learner_profile as profile
    where profile.account_id = account.id
  )
order by account.id;

with exact_legacy_alias as (
  select
    account.id as account_id,
    lower(btrim(min(student.login))) as normalized_login
  from public.account as account
  join public.student as student
    on student.user_id = account.auth_user_id
  where student.login is not null
    and btrim(student.login) <> ''
  group by account.id
  having count(*) = 1
), collision_free as (
  select normalized_login
  from exact_legacy_alias
  group by normalized_login
  having count(*) = 1
)
insert into public.account_login_alias (account_id, normalized_login)
select alias.account_id, alias.normalized_login
from exact_legacy_alias as alias
join collision_free using (normalized_login)
where char_length(alias.normalized_login) between 3 and 80
  and alias.normalized_login ~ '^[[:alnum:]_.-]+$'
on conflict do nothing;

insert into public.learner_identity_reconciliation (
  observer_account_id,
  learner_profile_id,
  legacy_parent_id,
  legacy_student_id,
  status,
  reason
)
select
  parent_account.id,
  child_profile.id,
  parent.id,
  student.id,
  'pending',
  'exact_legacy_parent_student'
from public.student as student
join public.parent as parent on parent.id = student.parent_id
join public.account as parent_account on parent_account.auth_user_id = parent.user_id
join public.account as child_account on child_account.auth_user_id = student.user_id
join public.learner_profile as child_profile on child_profile.account_id = child_account.id
where student.user_id is not null
  and (
    select count(*) from public.student as sibling
    where sibling.user_id = student.user_id
  ) = 1
on conflict (legacy_parent_id, legacy_student_id) do nothing;

-- Preserve every other legacy parent/student edge for explicit review.  Null
-- Account/profile references are intentional: ambiguity is never upgraded to
-- active observer access by inference.
insert into public.learner_identity_reconciliation (
  observer_account_id,
  learner_profile_id,
  legacy_parent_id,
  legacy_student_id,
  status,
  reason
)
select
  case
    when (select count(*) from public.account as a where a.auth_user_id = parent.user_id) = 1
      then (select a.id from public.account as a where a.auth_user_id = parent.user_id limit 1)
    else null
  end,
  case
    when student.user_id is not null
      and (select count(*) from public.student as s where s.user_id = student.user_id) = 1
      then (
        select profile.id
        from public.account as child_account
        join public.learner_profile as profile on profile.account_id = child_account.id
        where child_account.auth_user_id = student.user_id
        limit 1
      )
    else null
  end,
  parent.id,
  student.id,
  'needs_review',
  'ambiguous_legacy_identity'
from public.student as student
join public.parent as parent on parent.id = student.parent_id
on conflict (legacy_parent_id, legacy_student_id) do nothing;

create function public.current_account_auth_context()
returns table (
  account_id uuid,
  auth_user_id uuid,
  display_name text,
  locale text,
  timezone text,
  has_pin boolean,
  sessions_invalid_before timestamptz,
  verified_email text
)
language sql
stable
security definer
set search_path = ''
as $$
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
        and lower(coalesce(auth_user.email, '')) not like '%@learners.shidao.internal'
        and lower(coalesce(auth_user.email, '')) not like '%.shidao.internal'
        then auth_user.email::text
      else null
    end
  from public.account as account
  left join public.account_security as security
    on security.account_id = account.id
  join auth.users as auth_user on auth_user.id = account.auth_user_id
  where account.auth_user_id = (select auth.uid())
    and account.status in ('active', 'provisional')
  limit 1;
$$;

create function public.resolve_account_login_alias(p_identifier text)
returns table (
  auth_user_id uuid,
  auth_email text
)
language sql
stable
security definer
set search_path = ''
as $$
  select account.auth_user_id, auth_user.email::text
  from public.account_login_alias as alias
  join public.account as account on account.id = alias.account_id
  join auth.users as auth_user on auth_user.id = account.auth_user_id
  where alias.normalized_login = lower(btrim(p_identifier))
    and alias.revoked_at is null
    and account.status = 'active'
  limit 1;
$$;

create function public.verify_account_pin_credential(
  p_identifier text,
  p_raw_pin text
)
returns table (
  auth_user_id uuid,
  auth_email text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_alias public.account_login_alias%rowtype;
  v_account public.account%rowtype;
  v_security public.account_security%rowtype;
begin
  if p_identifier is null or p_raw_pin is null
    or p_raw_pin !~ '^\d{4,8}$'
  then
    return;
  end if;

  select alias.* into v_alias
  from public.account_login_alias as alias
  where alias.normalized_login = lower(btrim(p_identifier))
    and alias.revoked_at is null
  for update of alias;

  if not found then
    return;
  end if;

  select account.* into v_account
  from public.account as account
  where account.id = v_alias.account_id
    and account.status = 'active'
  for update of account;

  if not found then return; end if;

  insert into public.account_security (account_id)
  values (v_account.id)
  on conflict (account_id) do nothing;

  select security.* into v_security
  from public.account_security as security
  where security.account_id = v_account.id
  for update of security;

  if v_security.pin_locked_until is not null
    and v_security.pin_locked_until > now()
  then
    return;
  end if;

  if v_security.pin_hash is not null
    and extensions.crypt(p_raw_pin, v_security.pin_hash) = v_security.pin_hash
  then
    update public.account_security
    set pin_failed_attempts = 0,
        pin_locked_until = null,
        last_pin_login_at = now()
    where account_id = v_account.id;

    return query
      select v_account.auth_user_id, auth_user.email::text
      from auth.users as auth_user
      where auth_user.id = v_account.auth_user_id;
    return;
  end if;

  update public.account_security
  set pin_failed_attempts = least(pin_failed_attempts + 1, 100),
      pin_locked_until = case
        when pin_failed_attempts + 1 >= 5 then now() + interval '15 minutes'
        else null
      end
  where account_id = v_account.id;
end
$$;

create function public.verify_current_account_pin(p_raw_pin text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_account_id uuid;
  v_security public.account_security%rowtype;
begin
  if (select auth.uid()) is null
    or p_raw_pin is null
    or p_raw_pin !~ '^\d{4,8}$'
  then
    return false;
  end if;

  select account.id into v_account_id
  from public.account as account
  where account.auth_user_id = (select auth.uid())
    and account.status = 'active'
  for update of account;

  if not found then return false; end if;

  select security.* into v_security
  from public.account_security as security
  where security.account_id = v_account_id
  for update of security;

  if not found
    or v_security.pin_hash is null
    or (v_security.pin_locked_until is not null and v_security.pin_locked_until > now())
  then
    return false;
  end if;

  if extensions.crypt(p_raw_pin, v_security.pin_hash) = v_security.pin_hash then
    update public.account_security
    set pin_failed_attempts = 0,
        pin_locked_until = null,
        last_pin_login_at = now()
    where account_id = v_account_id;
    return true;
  end if;

  update public.account_security
  set pin_failed_attempts = least(pin_failed_attempts + 1, 100),
      pin_locked_until = case
        when pin_failed_attempts + 1 >= 5 then now() + interval '15 minutes'
        else null
      end
  where account_id = v_account_id;
  return false;
end
$$;

create function public.set_current_account_pin_impl(
  p_actor_auth_user_id uuid,
  p_raw_pin text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_account_id uuid;
  v_pin_hash text;
begin
  if p_actor_auth_user_id is null
    or p_raw_pin is null
    or p_raw_pin !~ '^\d{4,8}$'
  then
    raise exception 'account_pin_invalid' using errcode = '22023';
  end if;

  select account.id into v_account_id
  from public.account as account
  where account.auth_user_id = p_actor_auth_user_id
    and account.status in ('active', 'provisional')
  for update of account;

  if not found then
    raise exception 'account_not_found' using errcode = 'P0002';
  end if;

  v_pin_hash := extensions.crypt(p_raw_pin, extensions.gen_salt('bf'));

  insert into public.account_security as target (
    account_id, pin_hash, pin_created_at, pin_updated_at
  ) values (
    v_account_id, v_pin_hash, now(), now()
  )
  on conflict (account_id) do update
    set pin_hash = excluded.pin_hash,
        pin_failed_attempts = 0,
        pin_locked_until = null,
        pin_created_at = coalesce(target.pin_created_at, now()),
        pin_updated_at = now();

end
$$;

revoke all on function public.set_current_account_pin_impl(uuid,text)
  from public, anon, authenticated, service_role;

create function public.set_current_account_pin(
  p_actor_auth_user_id uuid,
  p_raw_pin text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.set_current_account_pin_impl(p_actor_auth_user_id, p_raw_pin);

  -- Expand-release rollback compatibility. The final contract migration
  -- replaces this wrapper with a canonical-only call.
  insert into public.user_security as legacy (
    user_id, pin_hash, pin_failed_attempts, pin_created_at, pin_updated_at
  )
  select
    p_actor_auth_user_id, security.pin_hash, 0,
    security.pin_created_at, security.pin_updated_at
  from public.account as account
  join public.account_security as security on security.account_id = account.id
  where account.auth_user_id = p_actor_auth_user_id
  on conflict (user_id) do update
    set pin_hash = excluded.pin_hash,
        pin_failed_attempts = 0,
        pin_locked_until = null,
        pin_created_at = coalesce(legacy.pin_created_at, now()),
        pin_updated_at = now();
end
$$;

create function public.update_current_account_profile(
  p_display_name text,
  p_locale text,
  p_timezone text
)
returns public.account
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_account public.account%rowtype;
begin
  if (select auth.uid()) is null
    or p_display_name is null
    or btrim(p_display_name) = ''
    or char_length(btrim(p_display_name)) > 160
    or p_locale is null
    or btrim(p_locale) = ''
    or char_length(btrim(p_locale)) > 35
    or p_timezone is null
    or btrim(p_timezone) = ''
    or char_length(btrim(p_timezone)) > 100
  then
    raise exception 'account_profile_invalid' using errcode = '22023';
  end if;

  update public.account as account
  set display_name = btrim(p_display_name),
      locale = btrim(p_locale),
      timezone = btrim(p_timezone)
  where account.auth_user_id = (select auth.uid())
    and account.status = 'active'
  returning account.* into v_account;

  if not found then
    raise exception 'account_not_found' using errcode = 'P0002';
  end if;

  -- Account-owned canonical name follows the Account profile.  Every
  -- teacher-local directory name remains untouched in teacher_learner.
  update public.learner_profile as profile
  set display_name = v_account.display_name
  where profile.account_id = v_account.id;

  return v_account;
end
$$;

create or replace function public.current_session_invalid_before()
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select security.sessions_invalid_before
  from public.account as account
  join public.account_security as security on security.account_id = account.id
  where account.auth_user_id = (select auth.uid())
  limit 1;
$$;

create function public.revoke_user_sessions_impl(
  p_user_id uuid,
  p_cutoff timestamptz
)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cutoff timestamptz;
begin
  if p_user_id is null or p_cutoff is null then
    raise exception 'session_revocation_invalid' using errcode = '22023';
  end if;

  update public.account_security as security
  set sessions_invalid_before = greatest(
        coalesce(security.sessions_invalid_before, '-infinity'::timestamptz),
        p_cutoff
      )
  from public.account as account
  where account.id = security.account_id
    and account.auth_user_id = p_user_id
  returning security.sessions_invalid_before into v_cutoff;

  return v_cutoff;
end
$$;

revoke all on function public.revoke_user_sessions_impl(uuid,timestamptz)
  from public, anon, authenticated, service_role;

create or replace function public.revoke_user_sessions(
  p_user_id uuid,
  p_cutoff timestamptz default now()
)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cutoff timestamptz;
begin
  v_cutoff := public.revoke_user_sessions_impl(p_user_id, p_cutoff);

  -- Expand-release rollback compatibility. The final contract migration
  -- replaces this wrapper with a canonical-only call.
  insert into public.user_security as security (
    user_id, sessions_invalid_before
  ) values (
    p_user_id, p_cutoff
  )
  on conflict (user_id) do update
    set sessions_invalid_before = greatest(
      coalesce(security.sessions_invalid_before, '-infinity'::timestamptz),
      excluded.sessions_invalid_before
    );

  return v_cutoff;
end
$$;

create function public.learner_identity_rate_limit_hit(
  p_scope text,
  p_key_digest bytea,
  p_limit integer,
  p_window interval,
  p_block interval
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_window_started_at timestamptz;
  v_hit_count integer;
  v_blocked_until timestamptz;
begin
  if p_scope is null or btrim(p_scope) = '' or char_length(p_scope) > 80
    or p_key_digest is null or octet_length(p_key_digest) <> 32
    or p_limit < 1 or p_limit > 10000
    or p_window <= interval '0 seconds'
    or p_window > interval '1 day'
    or p_block <= interval '0 seconds'
    or p_block > interval '7 days'
  then
    raise exception 'learner_identity_rate_limit_invalid' using errcode = '22023';
  end if;

  v_window_started_at := date_bin(p_window, clock_timestamp(), '2000-01-01'::timestamptz);

  insert into public.learner_identity_rate_limit as target (
    scope, key_digest, window_started_at, hit_count
  ) values (
    btrim(p_scope), p_key_digest, v_window_started_at, 1
  )
  on conflict (scope, key_digest, window_started_at) do update
    set hit_count = least(target.hit_count + 1, 100000),
        blocked_until = case
          when target.hit_count + 1 > p_limit
            then greatest(
              coalesce(target.blocked_until, '-infinity'::timestamptz),
              clock_timestamp() + p_block
            )
          else target.blocked_until
        end,
        updated_at = now()
  returning hit_count, blocked_until into v_hit_count, v_blocked_until;

  return v_hit_count <= p_limit
    and (v_blocked_until is null or v_blocked_until <= clock_timestamp());
end
$$;

-- The rate-limit helper is referenced by the PIN verifier above. PL/pgSQL
-- resolves it at execution time, after this migration has created it.

revoke all on function public.current_account_auth_context()
  from public, anon, authenticated, service_role;
grant execute on function public.current_account_auth_context() to authenticated, service_role;
revoke all on function public.resolve_account_login_alias(text)
  from public, anon, authenticated, service_role;
grant execute on function public.resolve_account_login_alias(text) to service_role;
revoke all on function public.verify_account_pin_credential(text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.verify_account_pin_credential(text, text) to service_role;
revoke all on function public.verify_current_account_pin(text)
  from public, anon, authenticated, service_role;
grant execute on function public.verify_current_account_pin(text) to authenticated, service_role;
revoke all on function public.set_current_account_pin(uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.set_current_account_pin(uuid, text) to service_role;
revoke all on function public.update_current_account_profile(text, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.update_current_account_profile(text, text, text) to authenticated, service_role;
revoke all on function public.current_session_invalid_before()
  from public, anon, authenticated, service_role;
grant execute on function public.current_session_invalid_before() to authenticated, service_role;
revoke all on function public.revoke_user_sessions(uuid, timestamptz)
  from public, anon, authenticated, service_role;
grant execute on function public.revoke_user_sessions(uuid, timestamptz) to service_role;
revoke all on function public.learner_identity_rate_limit_hit(text, bytea, integer, interval, interval)
  from public, anon, authenticated, service_role;
grant execute on function public.learner_identity_rate_limit_hit(text, bytea, integer, interval, interval)
  to service_role;

do $$
declare
  v_missing bigint;
begin
  select count(*) into v_missing
  from public.account as account
  where account.status in ('active', 'provisional')
    and (
      select count(*)
      from public.learner_profile as profile
      where profile.account_id = account.id
    ) <> 1;

  if v_missing <> 0 then
    raise exception
      'learner_identity_primitives_postflight_exactly_one_failed: %',
      v_missing;
  end if;

  if exists (
    select 1
    from public.account_login_alias
    where normalized_login <> lower(btrim(normalized_login))
  ) then
    raise exception 'learner_identity_primitives_postflight_alias_failed';
  end if;
end
$$;

notify pgrst, 'reload schema';

commit;
