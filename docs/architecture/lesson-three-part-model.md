# Three-part lesson model (Step 6)

**Дата:** 10 апреля 2026  
**Статус:** Реализовано (source + runtime + role projections)

## Каноническая модель урока

Каждый урок в ShiDao теперь описывается тремя педагогическими частями:

1. **Сценарий для преподавателя**
   - source: `methodology_lesson` + `methodology_lesson_block*`;
   - runtime: teacher workspace на `/lessons/[scheduledLessonId]`.
2. **Контент**
   - source: `methodology_lesson_student_content` (1 запись на урок методики);
   - runtime: role-aware projection на каноническом маршруте `/lessons/[scheduledLessonId]` (student и parent).
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

Расширенные секции для card/slide-like learner flow (backward-compatible):

- `hero_banner`
- `goal_cards`
- `story_scene`
- `vocabulary_gallery`
- `phrase_drill`
- `movement_mission`
- `counting_task`
- `media_stage`
- `farm_scene`
- `worksheet_preview`
- `song_stage`
- `home_recap`
- `parent_tip`

## Runtime-проекции по ролям

- **Teacher**:
  - source-layer страница урока методики `/methodologies/[methodologySlug]/lessons/[lessonId]` использует 3 вкладки:
    - `План урока`
    - `Контент`
    - `Домашнее задание`
  - runtime workspace `/lessons/[scheduledLessonId]` использует 5 вкладок:
    - `План урока`
    - `Контент` (встроенный предпросмотр)
    - `Домашнее задание`
    - `Проведение занятия`
    - `Чат`
  - Оба teacher lesson pages используют общий metadata-pill rail в header; отдельные context-chip (`source/runtime`) не используются.
- **Student**: learner-facing content + own homework block (actionable) на `/lessons/[scheduledLessonId]`.
- **Parent**: тот же learner-facing content + read-only `childrenRuntime[]` блоки для всех детей в этом уроке на `/lessons/[scheduledLessonId]`.

Важно: parent/student используют **одну и ту же** learner-content projection; различается только runtime-обвязка.

## Что намеренно отложено

- редактор student-content для методистов;
- полноценный слайд/презентационный редактор;
- несколько learner-template на один урок;
- file-heavy media pipeline;
- advanced presentation/sharing controls;
- teacher-authored runtime homework;
- новые permission-модели для homework submit.

## Публикация learner-content для реального lesson-1 (world-around-me)

Для production-safe upsert (без demo-маршрута) доступен отдельный admin endpoint:

- `POST /api/admin/methodology/publish-world-around-me-content`
- Заголовок: `x-publish-token: $METHODOLOGY_CONTENT_PUBLISH_TOKEN`

Endpoint идемпотентно находит lesson 1 (сначала exact id, затем fallback по позиции/названию)
и upsert-ит `methodology_lesson_student_content` + `methodology_lesson_homework`.
