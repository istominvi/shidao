# Lesson three-part model (Step 6)

Дата: 10 апреля 2026

## Каноническая модель урока

Каждый урок теперь состоит из 3 частей:

1. **Сценарий преподавателя** (source: `methodology_lesson_block`)
2. **Контент для ученика** (source: `methodology_lesson_student_content`)
3. **Домашнее задание** (source: `methodology_lesson_homework`)

## Source/runtime

- Source остаётся в методике (`methodology_lesson` + связанные таблицы).
- Runtime остаётся в `scheduled_lesson`.
- Для student/parent используется единая learner-projection (без дублирования моделей).

## Новая таблица

`methodology_lesson_student_content`:

- one-to-one с `methodology_lesson`
- typed JSON payload (`content_payload`) с секциями:
  - `lesson_focus`
  - `vocabulary_cards`
  - `phrase_cards`
  - `media_asset`
  - `action_cards`
  - `worksheet`
  - `recap`

## UX

- Teacher workspace (`/lessons/[scheduledLessonId]`) явно показывает 3 части:
  - `Сценарий урока`
  - `Контент для ученика`
  - `Домашнее задание`
- Student route: `/lesson-room/[scheduledLessonId]`
- Parent route: `/children/[studentId]/lesson-room/[scheduledLessonId]`
- Parent и student видят один и тот же learner-content.

## Отложено

- authoring/CMS для student content
- slides/editor
- media pipeline с upload/streaming
- расширенные show/share controls
- teacher-authored homework
