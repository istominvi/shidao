begin;

alter table public.group_student_message
  alter column body drop not null;

alter table public.lesson_group_message
  alter column body drop not null;

alter table public.lesson_group_message
  drop constraint if exists lesson_group_message_body_check;

create table if not exists public.communication_message_attachment (
  id uuid primary key default gen_random_uuid(),
  group_student_message_id uuid null references public.group_student_message(id) on delete cascade,
  lesson_group_message_id uuid null references public.lesson_group_message(id) on delete cascade,
  kind text not null check (kind in ('voice', 'file')),
  storage_bucket text not null,
  storage_path text not null unique,
  mime_type text not null,
  size_bytes integer not null check (size_bytes > 0),
  duration_ms integer null check (duration_ms is null or duration_ms >= 0),
  original_filename text null,
  created_by_user_id uuid null references auth.users(id) on delete set null,
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

create index if not exists communication_message_attachment_group_student_message_idx
  on public.communication_message_attachment (group_student_message_id);

create index if not exists communication_message_attachment_lesson_group_message_idx
  on public.communication_message_attachment (lesson_group_message_id);

create index if not exists communication_message_attachment_created_by_user_idx
  on public.communication_message_attachment (created_by_user_id);

create index if not exists communication_message_attachment_kind_created_at_idx
  on public.communication_message_attachment (kind, created_at);

alter table public.communication_message_attachment enable row level security;

commit;
