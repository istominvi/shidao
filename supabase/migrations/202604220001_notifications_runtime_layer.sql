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

create index if not exists notification_recipient_user_created_idx
  on public.notification (recipient_user_id, created_at desc);

create index if not exists notification_recipient_user_unread_idx
  on public.notification (recipient_user_id, read_at)
  where read_at is null;

create unique index if not exists notification_dedupe_key_unique_idx
  on public.notification (dedupe_key)
  where dedupe_key is not null;

alter table public.notification enable row level security;

create policy notification_select_own on public.notification
  for select
  using (recipient_user_id = auth.uid());

create policy notification_update_own on public.notification
  for update
  using (recipient_user_id = auth.uid())
  with check (recipient_user_id = auth.uid());
