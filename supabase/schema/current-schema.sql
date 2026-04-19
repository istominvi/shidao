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
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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
  body text not null,
  scheduled_lesson_id uuid references public.scheduled_lesson(id) on delete set null,
  scheduled_lesson_homework_assignment_id uuid references public.scheduled_lesson_homework_assignment(id) on delete set null,
  topic_kind text check (topic_kind in ('general', 'lesson', 'homework', 'progress', 'organizational')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Key DB functions used by app flows (non-exhaustive)
-- -----------------------------------------------------------------------------

create or replace function public.current_teacher_id() returns uuid language sql stable as $$
  select t.id from public.teacher t where t.user_id = auth.uid() limit 1;
$$;

create or replace function public.current_parent_id() returns uuid language sql stable as $$
  select p.id from public.parent p where p.user_id = auth.uid() limit 1;
$$;

create or replace function public.current_student_id() returns uuid language sql stable as $$
  select s.id from public.student s where s.user_id = auth.uid() limit 1;
$$;

-- Note: RLS policies, all indexes, and all operational functions/RPCs are defined in migrations.
-- This snapshot is optimized for CURRENT model readability.
