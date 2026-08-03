-- CURRENT SCHEMA SNAPSHOT (read-only reference)
-- -----------------------------------------------------------------------------
-- This file describes the CURRENT database structure for developer/agent context.
-- It is NOT a replacement for migration history and should not be treated as one.
--
-- Canonical migration history remains in: supabase/migrations/*
-- Refresh workflow: see scripts/refresh-schema-snapshot.sh and docs/database/current-schema.md
-- -----------------------------------------------------------------------------

create extension if not exists pgcrypto;

-- Shared helper trigger function
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Identity and school scope
-- -----------------------------------------------------------------------------

create table if not exists public.parent (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  full_name text,
  timezone text default 'Europe/Moscow',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.teacher (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  full_name text,
  timezone text default 'Europe/Moscow',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.school (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  kind text not null default 'personal' check (kind in ('personal', 'organization')),
  owner_teacher_id uuid references public.teacher(id) on delete set null,
  teacher_limit integer not null default 1 check (teacher_limit > 0),
  plan_code text not null default 'demo',
  subscription_status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.school_teacher (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.school(id) on delete cascade,
  teacher_id uuid not null references public.teacher(id) on delete cascade,
  role text not null check (role in ('owner', 'teacher')),
  created_at timestamptz not null default now(),
  unique (school_id, teacher_id)
);

create table if not exists public.class (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.school(id) on delete cascade,
  methodology_id uuid null references public.methodology(id) on delete set null,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, name)
);

create table if not exists public.class_teacher (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.class(id) on delete cascade,
  teacher_id uuid not null references public.teacher(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (class_id, teacher_id)
);

create table if not exists public.student (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete set null,
  parent_id uuid references public.parent(id) on delete set null,
  first_name text not null,
  last_name text,
  birth_date date,
  status text not null default 'active',
  login text not null,
  internal_auth_email text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (login),
  unique (internal_auth_email)
);

create table if not exists public.class_student (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.class(id) on delete cascade,
  student_id uuid not null references public.student(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (class_id, student_id)
);

-- -----------------------------------------------------------------------------
-- User preference and security
-- -----------------------------------------------------------------------------

create table if not exists public.user_preference (
  user_id uuid primary key references auth.users(id) on delete cascade,
  last_active_profile text null check (last_active_profile in ('parent', 'teacher')),
  last_selected_school_id uuid null references public.school(id) on delete set null,
  theme text null,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_security (
  user_id uuid primary key references auth.users(id) on delete cascade,
  pin_hash text null,
  pin_failed_attempts integer not null default 0,
  pin_locked_until timestamptz null,
  pin_created_at timestamptz null,
  pin_updated_at timestamptz null,
  last_pin_login_at timestamptz null,
  sessions_invalid_before timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- V2 account + teacher course-builder vertical slice
-- -----------------------------------------------------------------------------

create table if not exists public.account (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  display_name text not null check (btrim(display_name) <> ''),
  locale text not null default 'ru',
  timezone text not null default 'Europe/Moscow',
  status text not null default 'active' check (status in ('active', 'suspended', 'deleted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.course (
  id uuid primary key default gen_random_uuid(),
  owner_account_id uuid not null references public.account(id) on delete cascade,
  title text not null check (btrim(title) <> ''),
  subject text,
  goal text,
  level text,
  audience_description text,
  target_lesson_count integer check (target_lesson_count is null or target_lesson_count > 0),
  teacher_preferences text,
  audience_type text not null default 'none' check (audience_type = 'none'),
  settings jsonb not null default '{}'::jsonb check (jsonb_typeof(settings) = 'object'),
  assembled_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lesson (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.course(id) on delete cascade,
  position integer not null check (position > 0),
  title text not null check (btrim(title) <> ''),
  summary text,
  estimated_duration_minutes integer check (
    estimated_duration_minutes is null or estimated_duration_minutes > 0
  ),
  settings jsonb not null default '{}'::jsonb check (jsonb_typeof(settings) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lesson_course_position_unique
    unique (course_id, position) deferrable initially deferred
);

create table if not exists public.lesson_step (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lesson(id) on delete cascade,
  position integer not null check (position > 0),
  title text not null check (btrim(title) <> ''),
  teacher_content jsonb not null default '{}'::jsonb check (
    jsonb_typeof(teacher_content) = 'object'
  ),
  settings jsonb not null default '{}'::jsonb check (jsonb_typeof(settings) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lesson_step_lesson_position_unique
    unique (lesson_id, position) deferrable initially deferred
);

create table if not exists public.lesson_step_component (
  id uuid primary key default gen_random_uuid(),
  lesson_step_id uuid not null references public.lesson_step(id) on delete cascade,
  position integer not null check (position > 0),
  type_key text not null check (btrim(type_key) <> ''),
  schema_version integer not null default 1 check (schema_version > 0),
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  placement_config jsonb not null default '{}'::jsonb check (
    jsonb_typeof(placement_config) = 'object'
  ),
  visibility text not null default 'learner_visible' check (
    visibility in ('staff_only', 'learner_visible', 'guardian_visible')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lesson_step_component_step_position_unique
    unique (lesson_step_id, position) deferrable initially deferred
);

create table if not exists public.stored_file (
  id uuid primary key default gen_random_uuid(),
  owner_account_id uuid not null references public.account(id) on delete cascade,
  storage_bucket text not null default 'course-assets' check (storage_bucket = 'course-assets'),
  storage_path text not null unique check (btrim(storage_path) <> ''),
  original_filename text not null check (btrim(original_filename) <> ''),
  mime_type text not null check (btrim(mime_type) <> ''),
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 10485760),
  checksum_sha256 text check (
    checksum_sha256 is null or checksum_sha256 ~ '^[0-9a-f]{64}$'
  ),
  status text not null default 'pending' check (status in ('pending', 'ready')),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint stored_file_owner_path_check check (
    split_part(storage_path, '/', 1) = owner_account_id::text
  ),
  constraint stored_file_ready_checksum_check check (
    status = 'pending' or checksum_sha256 is not null
  )
);

create table if not exists public.course_attachment (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.course(id) on delete cascade,
  stored_file_id uuid not null references public.stored_file(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (course_id, stored_file_id)
);

-- V2 document/file tables above have owner-scoped authenticated CRUD RLS;
-- Account itself is self-readable only for ordinary authenticated requests.
-- Ordered Lesson, Lesson Step, and component positions are deferrable unique
-- constraints. The private `course-assets` Storage bucket accepts approved
-- files up to 10 MiB; storage.objects policies require the owning Account UUID
-- as path segment 1.

-- -----------------------------------------------------------------------------
-- Methodology source layer + lesson runtime layer
-- -----------------------------------------------------------------------------

create table if not exists public.methodology (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  short_description text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.methodology_lesson (
  id uuid primary key default gen_random_uuid(),
  methodology_id uuid not null references public.methodology(id) on delete cascade,
  title text not null,
  module_index integer not null,
  unit_index integer,
  lesson_index integer not null,
  vocabulary_summary jsonb not null default '[]'::jsonb,
  phrase_summary jsonb not null default '[]'::jsonb,
  estimated_duration_minutes integer not null check (estimated_duration_minutes > 0),
  readiness_status text not null check (readiness_status in ('draft', 'ready', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (methodology_id, module_index, unit_index, lesson_index)
);

create table if not exists public.reusable_asset (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (
    kind in (
      'video',
      'song',
      'worksheet',
      'vocabulary_set',
      'activity_template',
      'media_file',
      'presentation',
      'flashcards_pdf',
      'lesson_video',
      'worksheet_pdf',
      'song_audio',
      'song_video',
      'pronunciation_audio'
    )
  ),
  slug text unique,
  title text not null,
  description text,
  source_url text,
  file_ref text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.methodology_lesson_block (
  id uuid primary key default gen_random_uuid(),
  methodology_lesson_id uuid not null references public.methodology_lesson(id) on delete cascade,
  block_type text not null,
  sort_order integer not null,
  title text,
  content jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (methodology_lesson_id, sort_order)
);

create table if not exists public.methodology_lesson_block_asset (
  id uuid primary key default gen_random_uuid(),
  methodology_lesson_block_id uuid not null references public.methodology_lesson_block(id) on delete cascade,
  reusable_asset_id uuid not null references public.reusable_asset(id) on delete restrict,
  sort_order integer not null default 0,
  unique (methodology_lesson_block_id, reusable_asset_id)
);

create table if not exists public.methodology_lesson_student_content (
  id uuid primary key default gen_random_uuid(),
  methodology_lesson_id uuid not null unique references public.methodology_lesson(id) on delete cascade,
  title text not null,
  subtitle text,
  content_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.scheduled_lesson (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.class(id) on delete cascade,
  methodology_lesson_id uuid not null references public.methodology_lesson(id) on delete restrict,
  starts_at timestamptz not null,
  format text not null check (format in ('online', 'offline')),
  meeting_link text,
  place text,
  runtime_status text not null check (runtime_status in ('planned', 'in_progress', 'completed', 'cancelled')),
  runtime_current_step_id text,
  runtime_current_step_order integer,
  runtime_student_navigation_locked boolean not null default true,
  runtime_step_updated_at timestamptz,
  runtime_started_at timestamptz,
  runtime_completed_at timestamptz,
  runtime_notes_summary text,
  runtime_notes text,
  outcome_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Homework runtime layer
-- -----------------------------------------------------------------------------

create table if not exists public.methodology_lesson_homework (
  id uuid primary key default gen_random_uuid(),
  methodology_lesson_id uuid not null unique references public.methodology_lesson(id) on delete cascade,
  title text not null,
  instructions text not null,
  material_links jsonb not null default '[]'::jsonb,
  answer_format_hint text,
  kind text not null default 'practice_text' check (kind in ('practice_text', 'quiz_single_choice')),
  estimated_minutes integer,
  quiz_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.scheduled_lesson_homework_assignment (
  id uuid primary key default gen_random_uuid(),
  scheduled_lesson_id uuid not null unique references public.scheduled_lesson(id) on delete cascade,
  methodology_homework_id uuid not null references public.methodology_lesson_homework(id) on delete restrict,
  assigned_by_teacher_id uuid not null references public.teacher(id) on delete restrict,
  recipient_mode text not null check (recipient_mode in ('all', 'selected')),
  assignment_comment text,
  due_at timestamptz,
  issued_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.student_homework_assignment (
  id uuid primary key default gen_random_uuid(),
  scheduled_homework_assignment_id uuid not null references public.scheduled_lesson_homework_assignment(id) on delete cascade,
  student_id uuid not null references public.student(id) on delete cascade,
  status text not null check (status in ('assigned', 'submitted', 'reviewed', 'needs_revision')),
  submission_text text,
  submission_payload jsonb,
  auto_score integer,
  auto_max_score integer,
  auto_checked_at timestamptz,
  submitted_at timestamptz,
  review_note text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (scheduled_homework_assignment_id, student_id)
);

-- -----------------------------------------------------------------------------
-- Communication runtime layer
-- -----------------------------------------------------------------------------

create table if not exists public.group_student_conversation (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.class(id) on delete cascade,
  student_id uuid not null references public.student(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (class_id, student_id)
);

create table if not exists public.group_student_message (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.group_student_conversation(id) on delete cascade,
  author_user_id uuid references auth.users(id) on delete set null,
  author_role text not null check (author_role in ('teacher', 'student', 'parent')),
  body text,
  scheduled_lesson_id uuid references public.scheduled_lesson(id) on delete set null,
  scheduled_lesson_homework_assignment_id uuid references public.scheduled_lesson_homework_assignment(id) on delete set null,
  topic_kind text check (topic_kind in ('general', 'lesson', 'homework', 'progress', 'organizational')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lesson_group_conversation (
  id uuid primary key default gen_random_uuid(),
  scheduled_lesson_id uuid not null unique references public.scheduled_lesson(id) on delete cascade,
  class_id uuid not null references public.class(id) on delete cascade,
  title text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lesson_group_message (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.lesson_group_conversation(id) on delete cascade,
  author_user_id uuid references auth.users(id) on delete set null,
  author_role text not null check (author_role in ('teacher', 'student')),
  author_teacher_id uuid references public.teacher(id) on delete set null,
  author_student_id uuid references public.student(id) on delete set null,
  author_login text not null,
  author_name text not null,
  body text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.communication_message_attachment (
  id uuid primary key default gen_random_uuid(),
  group_student_message_id uuid references public.group_student_message(id) on delete cascade,
  lesson_group_message_id uuid references public.lesson_group_message(id) on delete cascade,
  kind text not null check (kind in ('voice', 'file')),
  storage_bucket text not null,
  storage_path text not null unique,
  mime_type text not null,
  size_bytes integer not null check (size_bytes > 0),
  duration_ms integer check (duration_ms is null or duration_ms >= 0),
  original_filename text,
  created_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint communication_message_attachment_one_parent_check check (
    (
      group_student_message_id is not null
      and lesson_group_message_id is null
    )
    or (
      group_student_message_id is null
      and lesson_group_message_id is not null
    )
  )
);

-- -----------------------------------------------------------------------------
-- Notification runtime layer
-- -----------------------------------------------------------------------------

create table if not exists public.notification (
  id uuid primary key default gen_random_uuid(),
  recipient_user_id uuid null references auth.users(id) on delete cascade,
  recipient_role text not null check (recipient_role in ('teacher', 'parent', 'student')),
  recipient_teacher_id uuid null references public.teacher(id) on delete cascade,
  recipient_parent_id uuid null references public.parent(id) on delete cascade,
  recipient_student_id uuid null references public.student(id) on delete cascade,
  actor_user_id uuid null references auth.users(id) on delete set null,
  actor_role text null check (actor_role in ('teacher', 'parent', 'student', 'system')),
  event_type text not null check (
    event_type in (
      'homework_assigned',
      'homework_submitted',
      'homework_reviewed',
      'homework_needs_revision',
      'message_created',
      'lesson_group_message_created',
      'lesson_status_changed'
    )
  ),
  title text not null,
  body text,
  href text not null,
  scheduled_lesson_id uuid null references public.scheduled_lesson(id) on delete set null,
  scheduled_homework_assignment_id uuid null references public.scheduled_lesson_homework_assignment(id) on delete set null,
  student_homework_assignment_id uuid null references public.student_homework_assignment(id) on delete set null,
  conversation_id uuid null,
  message_id uuid null,
  metadata jsonb not null default '{}'::jsonb,
  dedupe_key text null,
  read_at timestamptz null,
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Key DB functions used by app flows (non-exhaustive)
-- -----------------------------------------------------------------------------

-- V2 Account bootstrap for every future Supabase Auth user. EXECUTE is revoked
-- from PUBLIC/anon/authenticated; the auth.users trigger invokes it.
create or replace function public.handle_auth_user_account()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.account (auth_user_id, display_name)
  values (
    new.id,
    coalesce(
      nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(btrim(new.raw_user_meta_data ->> 'name'), ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'Пользователь'
    )
  )
  on conflict (auth_user_id) do nothing;

  return new;
end
$$;

drop trigger if exists trg_auth_user_create_account on auth.users;
create trigger trg_auth_user_create_account
after insert on auth.users
for each row execute function public.handle_auth_user_account();

-- Authenticated-only SECURITY INVOKER helper. Account's own RLS policy resolves
-- auth.uid() without trusting user-editable JWT metadata.
create or replace function public.current_account_id()
returns uuid
language sql
stable
security invoker
set search_path = ''
as $$
  select account.id
  from public.account
  where account.auth_user_id = (select auth.uid())
  limit 1;
$$;

-- Authenticated callers can read only their own app-session revocation cutoff;
-- the helper avoids a service-role authorization read in V2 Course routes.
create or replace function public.current_session_invalid_before()
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select security.sessions_invalid_before
  from public.user_security as security
  where security.user_id = (select auth.uid())
  limit 1;
$$;

-- Validated deterministic Course draft persistence boundary. The application
-- service creates the registry plan; this SECURITY INVOKER function commits
-- its Lesson, Lesson Step, components and assembled marker atomically.
create or replace function public.assemble_course_draft(
  p_course_id uuid,
  p_lesson_title text,
  p_lesson_summary text,
  p_step_title text,
  p_teacher_instructions text,
  p_learner_instruction text,
  p_components jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_assembled_at timestamptz;
  v_lesson_id uuid;
  v_step_id uuid;
  v_component_id uuid;
  v_component jsonb;
  v_position integer := 0;
  v_lesson_ids uuid[] := '{}'::uuid[];
  v_step_ids uuid[] := '{}'::uuid[];
  v_component_ids uuid[] := '{}'::uuid[];
begin
  if p_components is null or jsonb_typeof(p_components) <> 'array' then
    raise exception 'course_components_must_be_array' using errcode = '22023';
  end if;

  select course.assembled_at into v_assembled_at
  from public.course
  where course.id = p_course_id
  for update;

  if not found then
    raise exception 'course_not_found' using errcode = 'P0002';
  end if;

  if v_assembled_at is not null then
    select coalesce(array_agg(lesson.id order by lesson.position), '{}'::uuid[])
    into v_lesson_ids from public.lesson where lesson.course_id = p_course_id;

    select coalesce(array_agg(step.id order by lesson.position, step.position), '{}'::uuid[])
    into v_step_ids
    from public.lesson_step as step
    join public.lesson on lesson.id = step.lesson_id
    where lesson.course_id = p_course_id;

    select coalesce(
      array_agg(component.id order by lesson.position, step.position, component.position),
      '{}'::uuid[]
    )
    into v_component_ids
    from public.lesson_step_component as component
    join public.lesson_step as step on step.id = component.lesson_step_id
    join public.lesson on lesson.id = step.lesson_id
    where lesson.course_id = p_course_id;

    return jsonb_build_object(
      'courseId', p_course_id,
      'lessonIds', to_jsonb(v_lesson_ids),
      'stepIds', to_jsonb(v_step_ids),
      'componentIds', to_jsonb(v_component_ids),
      'alreadyAssembled', true
    );
  end if;

  if exists (select 1 from public.lesson where lesson.course_id = p_course_id) then
    raise exception 'course_contains_manual_content' using errcode = '23505';
  end if;

  insert into public.lesson (course_id, position, title, summary)
  values (p_course_id, 1, p_lesson_title, p_lesson_summary)
  returning id into v_lesson_id;

  insert into public.lesson_step (lesson_id, position, title, teacher_content, settings)
  values (
    v_lesson_id,
    1,
    p_step_title,
    jsonb_build_object('teacherInstructions', coalesce(p_teacher_instructions, '')),
    jsonb_build_object('learnerInstruction', coalesce(p_learner_instruction, ''))
  )
  returning id into v_step_id;

  for v_component in
    select component.value
    from jsonb_array_elements(p_components) as component(value)
  loop
    v_position := v_position + 1;
    insert into public.lesson_step_component (
      lesson_step_id,
      position,
      type_key,
      schema_version,
      payload,
      placement_config,
      visibility
    )
    values (
      v_step_id,
      v_position,
      v_component ->> 'typeKey',
      (v_component ->> 'schemaVersion')::integer,
      v_component -> 'payload',
      v_component -> 'placement',
      'learner_visible'
    )
    returning id into v_component_id;
    v_component_ids := array_append(v_component_ids, v_component_id);
  end loop;

  update public.course set assembled_at = now() where id = p_course_id;

  return jsonb_build_object(
    'courseId', p_course_id,
    'lessonIds', jsonb_build_array(v_lesson_id),
    'stepIds', jsonb_build_array(v_step_id),
    'componentIds', to_jsonb(v_component_ids),
    'alreadyAssembled', false
  );
end
$$;

-- Ordered Course document children stay dense after any delete.
create or replace function public.compact_course_lesson_positions()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  update public.lesson set position = position - 1
  where course_id = old.course_id and position > old.position;
  return old;
end
$$;

create or replace function public.compact_lesson_step_positions()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  update public.lesson_step set position = position - 1
  where lesson_id = old.lesson_id and position > old.position;
  return old;
end
$$;

create or replace function public.compact_step_component_positions()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  update public.lesson_step_component set position = position - 1
  where lesson_step_id = old.lesson_step_id and position > old.position;
  return old;
end
$$;

-- Atomic reorder RPC used by the shared Course Builder application service.
-- SECURITY INVOKER means lesson_step_component ownership RLS remains active.
create or replace function public.reorder_lesson_step_component(
  p_component_id uuid,
  p_new_position integer
)
returns table (component_id uuid, "position" integer)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_lesson_step_id uuid;
  v_old_position integer;
  v_component_count integer;
begin
  if p_new_position is null or p_new_position < 1 then
    raise exception 'component_position_out_of_range' using errcode = '22023';
  end if;

  select component.lesson_step_id, component.position
  into v_lesson_step_id, v_old_position
  from public.lesson_step_component as component
  where component.id = p_component_id
  for update;

  if not found then
    raise exception 'component_not_found' using errcode = 'P0002';
  end if;

  perform 1
  from public.lesson_step_component as component
  where component.lesson_step_id = v_lesson_step_id
  for update;

  select count(*)::integer
  into v_component_count
  from public.lesson_step_component as component
  where component.lesson_step_id = v_lesson_step_id;

  if p_new_position > v_component_count then
    raise exception 'component_position_out_of_range' using errcode = '22023';
  end if;

  if p_new_position < v_old_position then
    update public.lesson_step_component as component
    set position = component.position + 1
    where component.lesson_step_id = v_lesson_step_id
      and component.position >= p_new_position
      and component.position < v_old_position;
  elsif p_new_position > v_old_position then
    update public.lesson_step_component as component
    set position = component.position - 1
    where component.lesson_step_id = v_lesson_step_id
      and component.position > v_old_position
      and component.position <= p_new_position;
  end if;

  update public.lesson_step_component
  set position = p_new_position
  where id = p_component_id;

  return query
  select component.id, component.position
  from public.lesson_step_component as component
  where component.lesson_step_id = v_lesson_step_id
  order by component.position;
end
$$;

-- Identity + membership helpers for RLS. ALL are SECURITY DEFINER (their internal
-- reads bypass RLS) so policies built on them never read the mutually-recursive
-- graph tables (class_teacher/class_student/student) directly. See migration
-- 202606300002.
create or replace function public.current_teacher_id() returns uuid language sql stable security definer set search_path = public as $$
  select t.id from public.teacher t where t.user_id = auth.uid() limit 1;
$$;

create or replace function public.current_parent_id() returns uuid language sql stable security definer set search_path = public as $$
  select p.id from public.parent p where p.user_id = auth.uid() limit 1;
$$;

create or replace function public.current_student_id() returns uuid language sql stable security definer set search_path = public as $$
  select s.id from public.student s where s.user_id = auth.uid() limit 1;
$$;

create or replace function public.is_class_teacher(p_class_id uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.class_teacher ct where ct.class_id = p_class_id and ct.teacher_id = public.current_teacher_id());
$$;

create or replace function public.is_class_student(p_class_id uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.class_student cs where cs.class_id = p_class_id and cs.student_id = public.current_student_id());
$$;

create or replace function public.parent_in_class(p_class_id uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.class_student cs join public.student s on s.id = cs.student_id where cs.class_id = p_class_id and s.parent_id = public.current_parent_id());
$$;

create or replace function public.can_read_class(p_class_id uuid) returns boolean language sql stable security definer set search_path = public as $$
  select public.is_class_teacher(p_class_id) or public.is_class_student(p_class_id) or public.parent_in_class(p_class_id);
$$;

create or replace function public.is_my_child(p_student_id uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.student s where s.id = p_student_id and s.parent_id = public.current_parent_id());
$$;

create or replace function public.teaches_student(p_student_id uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.class_student cs join public.class_teacher ct on ct.class_id = cs.class_id where cs.student_id = p_student_id and ct.teacher_id = public.current_teacher_id());
$$;

create or replace function public.parent_in_school(p_school_id uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.class_student cs join public.student s on s.id = cs.student_id join public.class c on c.id = cs.class_id where c.school_id = p_school_id and s.parent_id = public.current_parent_id());
$$;

create or replace function public.scheduled_homework_class_id(p_slha_id uuid) returns uuid language sql stable security definer set search_path = public as $$
  select sl.class_id from public.scheduled_lesson_homework_assignment sha join public.scheduled_lesson sl on sl.id = sha.scheduled_lesson_id where sha.id = p_slha_id;
$$;

-- Note: RLS is enabled on all 24 application tables and (since 202606300002) every
-- RLS table has SELECT policies — runtime/content tables are membership-scoped via
-- the helpers above; methodology/content is a shared catalog (USING(true) to
-- authenticated). Full policy text, all indexes, and operational RPCs live in
-- migrations. This snapshot is optimized for CURRENT model readability.
