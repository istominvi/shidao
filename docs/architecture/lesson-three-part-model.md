# Three-part lesson model (Step 6)

**Дата:** 10 апреля 2026  
**Статус:** Реализовано (source + runtime + role projections)

## Каноническая модель урока

Каждый урок в ShiDao теперь описывается тремя педагогическими частями:

1. **Сценарий для преподавателя**
   - source: `methodology_lesson` + `methodology_lesson_block*`;
   - runtime: teacher workspace на `/lessons/[scheduledLessonId]`.
2. **Контент для ученика**
   - source: `methodology_lesson_student_content` (1 запись на урок методики);
   - runtime: learner lesson room на `/lesson-room/[scheduledLessonId]` и `/children/[studentId]/lesson-room/[scheduledLessonId]`.
3. **Домашнее задание**
   - source: `methodology_lesson_homework`;
   - runtime: `scheduled_lesson_homework_assignment` + `student_homework_assignment`.

## Source-layer таблица student content

`public.methodology_lesson_student_content`

- `methodology_lesson_id` — unique FK на source-урок методики;
- `title`, `subtitle`;
- `content_payload` (`jsonb`) с typed-секциями (валидация в TypeScript);
- `created_at`, `updated_at`, trigger `set_updated_at`.

Секции первой реализации:

- `lesson_focus`
- `vocabulary_cards`
- `phrase_cards`
- `media_asset`
- `action_cards`
- `worksheet`
- `recap`

## Runtime-проекции по ролям

- **Teacher**: 3 верхних раздела в одном workspace:
  - `Сценарий урока`
  - `Контент для ученика` (preview + `Открыть ученическую версию`)
  - `Домашнее задание`
- **Student**: learner-facing lesson room + homework block (actionable).
- **Parent**: тот же learner-facing lesson room + homework в read-only.

Важно: parent/student используют **одну и ту же** learner-content projection.

## Что намеренно отложено

- редактор student-content для методистов;
- полноценный слайд/презентационный редактор;
- несколько learner-template на один урок;
- file-heavy media pipeline;
- advanced presentation/sharing controls;
- teacher-authored runtime homework;
- новые permission-модели для homework submit.
