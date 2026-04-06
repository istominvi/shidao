begin;

create extension if not exists pgcrypto;

create table if not exists public.methodology (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  short_description text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.methodology_lesson (
  id uuid primary key default gen_random_uuid(),
  methodology_id uuid not null references public.methodology(id) on delete cascade,
  title text not null,
  module_index integer not null,
  unit_index integer null,
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
      'media_file'
    )
  ),
  slug text null,
  title text not null,
  description text null,
  source_url text null,
  file_ref text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (slug)
);

create table if not exists public.methodology_lesson_block (
  id uuid primary key default gen_random_uuid(),
  methodology_lesson_id uuid not null references public.methodology_lesson(id) on delete cascade,
  block_type text not null check (
    block_type in (
      'intro_framing',
      'video_segment',
      'song_segment',
      'vocabulary_focus',
      'teacher_prompt_pattern',
      'guided_activity',
      'materials_prep',
      'worksheet_task',
      'wrap_up_closure'
    )
  ),
  sort_order integer not null,
  title text null,
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

create table if not exists public.scheduled_lesson (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public."class"(id) on delete cascade,
  methodology_lesson_id uuid not null references public.methodology_lesson(id) on delete restrict,
  starts_at timestamptz not null,
  format text not null check (format in ('online', 'offline')),
  meeting_link text null,
  place text null,
  runtime_status text not null check (
    runtime_status in ('planned', 'in_progress', 'completed', 'cancelled')
  ),
  runtime_notes_summary text null,
  runtime_notes text null,
  outcome_notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint scheduled_lesson_format_location_check check (
    (format = 'online' and meeting_link is not null and place is null)
    or
    (format = 'offline' and place is not null and meeting_link is null)
  )
);

create index if not exists methodology_lesson_methodology_id_idx
  on public.methodology_lesson (methodology_id);
create index if not exists methodology_lesson_position_idx
  on public.methodology_lesson (methodology_id, module_index, unit_index, lesson_index);
create index if not exists methodology_lesson_block_lesson_order_idx
  on public.methodology_lesson_block (methodology_lesson_id, sort_order);
create index if not exists methodology_lesson_block_asset_block_order_idx
  on public.methodology_lesson_block_asset (methodology_lesson_block_id, sort_order);
create index if not exists scheduled_lesson_class_starts_at_idx
  on public.scheduled_lesson (class_id, starts_at);
create index if not exists scheduled_lesson_methodology_lesson_id_idx
  on public.scheduled_lesson (methodology_lesson_id);

alter table public.methodology enable row level security;
alter table public.methodology_lesson enable row level security;
alter table public.reusable_asset enable row level security;
alter table public.methodology_lesson_block enable row level security;
alter table public.methodology_lesson_block_asset enable row level security;
alter table public.scheduled_lesson enable row level security;

drop trigger if exists trg_methodology_updated_at on public.methodology;
create trigger trg_methodology_updated_at
before update on public.methodology
for each row execute function public.set_updated_at();

drop trigger if exists trg_methodology_lesson_updated_at on public.methodology_lesson;
create trigger trg_methodology_lesson_updated_at
before update on public.methodology_lesson
for each row execute function public.set_updated_at();

drop trigger if exists trg_reusable_asset_updated_at on public.reusable_asset;
create trigger trg_reusable_asset_updated_at
before update on public.reusable_asset
for each row execute function public.set_updated_at();

drop trigger if exists trg_methodology_lesson_block_updated_at on public.methodology_lesson_block;
create trigger trg_methodology_lesson_block_updated_at
before update on public.methodology_lesson_block
for each row execute function public.set_updated_at();

drop trigger if exists trg_scheduled_lesson_updated_at on public.scheduled_lesson;
create trigger trg_scheduled_lesson_updated_at
before update on public.scheduled_lesson
for each row execute function public.set_updated_at();

commit;
