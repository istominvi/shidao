alter table public.scheduled_lesson
  add column if not exists runtime_current_step_id text,
  add column if not exists runtime_current_step_order integer,
  add column if not exists runtime_student_navigation_locked boolean not null default true,
  add column if not exists runtime_step_updated_at timestamptz,
  add column if not exists runtime_started_at timestamptz,
  add column if not exists runtime_completed_at timestamptz;
