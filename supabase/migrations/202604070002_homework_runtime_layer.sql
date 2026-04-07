begin;

create table if not exists public.methodology_lesson_homework (
  id uuid primary key default gen_random_uuid(),
  methodology_lesson_id uuid not null unique references public.methodology_lesson(id) on delete cascade,
  title text not null,
  instructions text not null,
  material_links jsonb not null default '[]'::jsonb,
  answer_format_hint text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.scheduled_lesson_homework_assignment (
  id uuid primary key default gen_random_uuid(),
  scheduled_lesson_id uuid not null unique references public.scheduled_lesson(id) on delete cascade,
  methodology_homework_id uuid not null references public.methodology_lesson_homework(id) on delete restrict,
  assigned_by_teacher_id uuid not null references public.teacher(id) on delete restrict,
  recipient_mode text not null check (recipient_mode in ('all','selected')),
  due_at timestamptz null,
  issued_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.student_homework_assignment (
  id uuid primary key default gen_random_uuid(),
  scheduled_homework_assignment_id uuid not null references public.scheduled_lesson_homework_assignment(id) on delete cascade,
  student_id uuid not null references public.student(id) on delete cascade,
  status text not null check (status in ('assigned','submitted','reviewed','needs_revision')),
  submission_text text null,
  submitted_at timestamptz null,
  review_note text null,
  reviewed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (scheduled_homework_assignment_id, student_id)
);

create index if not exists methodology_lesson_homework_lesson_idx
  on public.methodology_lesson_homework (methodology_lesson_id);
create index if not exists scheduled_lesson_homework_assignment_scheduled_idx
  on public.scheduled_lesson_homework_assignment (scheduled_lesson_id);
create index if not exists student_homework_assignment_student_idx
  on public.student_homework_assignment (student_id);
create index if not exists student_homework_assignment_assignment_idx
  on public.student_homework_assignment (scheduled_homework_assignment_id);

alter table public.methodology_lesson_homework enable row level security;
alter table public.scheduled_lesson_homework_assignment enable row level security;
alter table public.student_homework_assignment enable row level security;

drop trigger if exists trg_methodology_lesson_homework_updated_at on public.methodology_lesson_homework;
create trigger trg_methodology_lesson_homework_updated_at
before update on public.methodology_lesson_homework
for each row execute function public.set_updated_at();

drop trigger if exists trg_scheduled_lesson_homework_assignment_updated_at on public.scheduled_lesson_homework_assignment;
create trigger trg_scheduled_lesson_homework_assignment_updated_at
before update on public.scheduled_lesson_homework_assignment
for each row execute function public.set_updated_at();

drop trigger if exists trg_student_homework_assignment_updated_at on public.student_homework_assignment;
create trigger trg_student_homework_assignment_updated_at
before update on public.student_homework_assignment
for each row execute function public.set_updated_at();

insert into public.methodology_lesson_homework (
  methodology_lesson_id,
  title,
  instructions,
  material_links,
  answer_format_hint
)
select
  ml.id,
  'Домашняя практика: Животные на ферме',
  'Повтори слова 狗, 猫, 兔子, 马 и фразы «这是…», «我是…». Нарисуй 2 любимых животных с фермы и подпиши их по-китайски с помощью взрослого. Затем произнеси вслух минимум 3 фразы по шаблону «这是…».',
  '["Рабочая тетрадь, стр. 3–4", "Карточки животных из урока"]'::jsonb,
  'Текст + устный ответ на следующем уроке.'
from public.methodology_lesson ml
join public.methodology m on m.id = ml.methodology_id
where m.slug = 'world-around-me'
  and ml.title = 'Урок 1. Животные на ферме'
  and not exists (
    select 1
    from public.methodology_lesson_homework mh
    where mh.methodology_lesson_id = ml.id
  );

commit;
