# Three-part lesson model (Step 6)

> **Superseded note (2026-04-18):** Product-canonical lesson workflow terminology is now documented in `docs/architecture/lesson-workflow-model.md` (use `Шаг`, `Экран ученика`, `Материалы`). This document is kept for historical implementation context.

**Дата:** 10 апреля 2026  
**Статус:** Реализовано (source + runtime + role projections)

## Каноническая модель урока

Каждый урок в ShiDao теперь описывается тремя педагогическими частями:

1. **Сценарий для преподавателя**
   - source: `methodology_lesson` + `methodology_lesson_block*`;
   - runtime: teacher workspace на `/lessons/[scheduledLessonId]`.
2. **Экран ученика** (historically named `Контент` in implementation)
   - source: `methodology_lesson_student_content` (1 запись на урок методики);
   - runtime: role-aware projection на каноническом маршруте `/lessons/[scheduledLessonId]` (student и parent).
3. **Домашнее задание**
   - source: `methodology_lesson_homework`;
   - runtime: `scheduled_lesson_homework_assignment` + `student_homework_assignment`.

## Source-layer таблица learner-side content

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

- **Teacher**:
  - source-layer страница урока методики `/methodologies/[methodologySlug]/lessons/[lessonId]` использует 3 вкладки:
    - `План урока`
    - `Контент` (historical label in current UI implementation; target product label: `Экран ученика`)
    - `Домашнее задание`
  - runtime workspace `/lessons/[scheduledLessonId]` использует 5 вкладок:
    - `План урока`
    - `Контент` (встроенный предпросмотр; historical label, target: `Экран ученика`)
    - `Домашнее задание`
    - `Проведение занятия`
    - `Чат`
  - Оба teacher lesson pages используют общий metadata-pill rail в header; отдельные context-chip (`source/runtime`) не используются.
- **Student**: learner-facing `Экран ученика` + own homework block (actionable) на `/lessons/[scheduledLessonId]`.
- **Parent**: тот же learner-facing `Экран ученика` + read-only `childrenRuntime[]` блоки для всех детей в этом уроке на `/lessons/[scheduledLessonId]`.

Важно: parent/student используют **одну и ту же** learner-side projection; различается только runtime-обвязка.

## Что намеренно отложено

- редактор student-content для методистов;
- полноценный слайд/презентационный редактор;
- несколько learner-template на один урок;
- file-heavy media pipeline;
- advanced presentation/sharing controls;
- teacher-authored runtime homework;
- новые permission-модели для homework submit.
