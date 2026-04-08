# Модель homework runtime (Step 4)

**Дата:** 8 апреля 2026  
**Статус:** Реализовано (MVP runtime-цикл)

## Базовое правило

Homework-контент определяется в методике. Преподаватель не редактирует канонический контент homework.

Преподаватель может только:

- просматривать homework из методики (read-only),
- выдавать его в runtime-контексте `scheduled_lesson`,
- выбирать получателей (all / selected),
- задавать due date,
- проверять ответы и выставлять review-state.

## Слои хранения

1. `methodology_lesson_homework`
   - каноническая педагогическая база homework для урока методики (сейчас 0..1 на урок).
2. `scheduled_lesson_homework_assignment`
   - runtime-выдача homework, привязанная к конкретному `scheduled_lesson`.
3. `student_homework_assignment`
   - состояние по ученику (`assigned`/`submitted`/`reviewed`/`needs_revision`), submission text, review note.

## Runtime-поток

1. Преподаватель открывает `/lessons/[scheduledLessonId]`.
2. Видит homework из методики в read-only.
3. Выдаёт homework всей группе или выбранным ученикам и задаёт срок.
4. Ученик видит задание на `/dashboard` и отправляет текстовый ответ.
5. Преподаватель проверяет и переводит в `reviewed` или `needs_revision` с комментарием.
6. Родительский `/dashboard` получает минимальную read-only проекцию статусов по детям.

## Связь с source/runtime-моделью

- `methodology_lesson_homework` — source layer.
- `scheduled_lesson_homework_assignment` + `student_homework_assignment` — runtime layer.
- `/lessons/[scheduledLessonId]` остаётся execution screen и не превращается в редактор методики.

## Что отложено

- редактирование homework-контента преподавателем,
- freeform homework authoring в runtime,
- file-heavy submissions,
- расширенные student/parent UX-сценарии.

## Кросс-ссылка на коммуникацию (Step 5)

Homework-обсуждение показывается как scoped-проекция единого `group_student_conversation`, а не как отдельный isolated chat-thread.
См. `docs/architecture/communication-runtime-model.md`.
