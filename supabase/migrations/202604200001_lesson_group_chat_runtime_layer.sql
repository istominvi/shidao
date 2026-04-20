begin;

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
  author_user_id uuid null references auth.users(id) on delete set null,
  author_role text not null check (author_role in ('teacher', 'student')),
  author_teacher_id uuid null references public.teacher(id) on delete set null,
  author_student_id uuid null references public.student(id) on delete set null,
  author_login text not null,
  author_name text not null,
  body text not null check (length(btrim(body)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists lesson_group_conversation_class_idx
  on public.lesson_group_conversation (class_id);

create index if not exists lesson_group_message_conversation_created_idx
  on public.lesson_group_message (conversation_id, created_at asc);
create index if not exists lesson_group_message_author_user_idx
  on public.lesson_group_message (author_user_id);
create index if not exists lesson_group_message_author_student_idx
  on public.lesson_group_message (author_student_id);
create index if not exists lesson_group_message_author_teacher_idx
  on public.lesson_group_message (author_teacher_id);

alter table public.lesson_group_conversation enable row level security;
alter table public.lesson_group_message enable row level security;

drop trigger if exists trg_lesson_group_conversation_updated_at on public.lesson_group_conversation;
create trigger trg_lesson_group_conversation_updated_at
before update on public.lesson_group_conversation
for each row execute function public.set_updated_at();

drop trigger if exists trg_lesson_group_message_updated_at on public.lesson_group_message;
create trigger trg_lesson_group_message_updated_at
before update on public.lesson_group_message
for each row execute function public.set_updated_at();

commit;
