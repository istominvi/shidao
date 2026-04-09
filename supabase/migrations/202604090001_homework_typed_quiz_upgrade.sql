begin;

alter table public.methodology_lesson_homework
  add column if not exists kind text not null default 'practice_text',
  add column if not exists estimated_minutes integer null,
  add column if not exists quiz_payload jsonb null;

alter table public.methodology_lesson_homework
  drop constraint if exists methodology_lesson_homework_kind_check;
alter table public.methodology_lesson_homework
  add constraint methodology_lesson_homework_kind_check
  check (kind in ('practice_text', 'quiz_single_choice'));

alter table public.scheduled_lesson_homework_assignment
  add column if not exists assignment_comment text null;

alter table public.student_homework_assignment
  add column if not exists submission_payload jsonb null,
  add column if not exists auto_score integer null,
  add column if not exists auto_max_score integer null,
  add column if not exists auto_checked_at timestamptz null;

update public.methodology_lesson_homework mh
set
  title = 'Мини-тест: Животные на ферме',
  kind = 'quiz_single_choice',
  instructions = 'Короткая игра на повторение слов и фраз урока. Выбери правильный ответ в каждом вопросе.',
  material_links = '["Рабочая тетрадь, стр. 3–4", "Карточки животных из урока"]'::jsonb,
  answer_format_hint = 'Тест из 5 вопросов, один ответ в каждом.',
  estimated_minutes = 5,
  quiz_payload = '{
    "id": "world-around-me-lesson-1-quiz",
    "version": 1,
    "questions": [
      {
        "id": "q1",
        "prompt": "Как по-китайски «собака»?",
        "helperText": "Выбери карточку со словом.",
        "options": [
          { "id": "a", "label": "狗" },
          { "id": "b", "label": "猫" },
          { "id": "c", "label": "马" }
        ],
        "correctOptionId": "a"
      },
      {
        "id": "q2",
        "prompt": "Как по-китайски «кролик»?",
        "options": [
          { "id": "a", "label": "兔子" },
          { "id": "b", "label": "农场" },
          { "id": "c", "label": "狗" }
        ],
        "correctOptionId": "a"
      },
      {
        "id": "q3",
        "prompt": "Что значит «农场»?",
        "options": [
          { "id": "a", "label": "кошка" },
          { "id": "b", "label": "ферма" },
          { "id": "c", "label": "лошадь" }
        ],
        "correctOptionId": "b"
      },
      {
        "id": "q4",
        "prompt": "Выбери фразу «Это…»",
        "options": [
          { "id": "a", "label": "我是…" },
          { "id": "b", "label": "这是…" },
          { "id": "c", "label": "我们…吧！" }
        ],
        "correctOptionId": "b"
      },
      {
        "id": "q5",
        "prompt": "Какое слово значит «прыгать»?",
        "options": [
          { "id": "a", "label": "跑" },
          { "id": "b", "label": "在" },
          { "id": "c", "label": "跳" }
        ],
        "correctOptionId": "c"
      }
    ]
  }'::jsonb,
  updated_at = now()
from public.methodology_lesson ml
join public.methodology m on m.id = ml.methodology_id
where mh.methodology_lesson_id = ml.id
  and m.slug = 'world-around-me'
  and ml.title = 'Урок 1. Животные на ферме';

commit;
