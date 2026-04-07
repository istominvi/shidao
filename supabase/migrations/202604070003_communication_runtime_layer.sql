begin;

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
  author_user_id uuid null references auth.users(id) on delete set null,
  author_role text not null check (author_role in ('teacher','student','parent')),
  body text not null,
  scheduled_lesson_id uuid null references public.scheduled_lesson(id) on delete set null,
  scheduled_lesson_homework_assignment_id uuid null references public.scheduled_lesson_homework_assignment(id) on delete set null,
  topic_kind text null check (topic_kind in ('general','lesson','homework','progress','organizational')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists group_student_conversation_class_idx
  on public.group_student_conversation (class_id);
create index if not exists group_student_conversation_student_idx
  on public.group_student_conversation (student_id);

create index if not exists group_student_message_conversation_idx
  on public.group_student_message (conversation_id, created_at asc);
create index if not exists group_student_message_lesson_idx
  on public.group_student_message (scheduled_lesson_id);
create index if not exists group_student_message_homework_idx
  on public.group_student_message (scheduled_lesson_homework_assignment_id);
create index if not exists group_student_message_topic_idx
  on public.group_student_message (topic_kind);

alter table public.group_student_conversation enable row level security;
alter table public.group_student_message enable row level security;

drop trigger if exists trg_group_student_conversation_updated_at on public.group_student_conversation;
create trigger trg_group_student_conversation_updated_at
before update on public.group_student_conversation
for each row execute function public.set_updated_at();

drop trigger if exists trg_group_student_message_updated_at on public.group_student_message;
create trigger trg_group_student_message_updated_at
before update on public.group_student_message
for each row execute function public.set_updated_at();

commit;
