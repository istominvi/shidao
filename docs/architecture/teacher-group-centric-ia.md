# Teacher IA: group-centric операционная модель (Steps 1–5)

**Статус:** Реализовано (Steps 1–5)  
**Дата актуализации:** 8 апреля 2026

## Назначение документа

Документ фиксирует текущее рабочее состояние teacher-side IA и runtime-слоёв:

- primary operational context для преподавателя — `group/class`;
- `methodology` остаётся каноническим педагогическим source of truth;
- `scheduled_lesson` остаётся runtime-единицей исполнения;
- реализованы post-lesson runtime-слои homework и communication.

## Каноническая модель source/runtime

Архитектурные инварианты:

- **Methodology** — канонический источник педагогического содержания.
- **Methodology lesson** и **scheduled lesson** — разные сущности.
- **Scheduled lesson** — runtime-объект конкретного урока для конкретной группы и времени.
- `/lessons/[scheduledLessonId]` — экран исполнения (runtime workspace) с обратной ссылкой на исходный урок методики.

## Поверхности преподавателя: primary / secondary

### Основные поверхности

1. `/dashboard` — операционный центр преподавателя.
2. `/groups` — полный индекс групп преподавателя.
3. `/groups/[groupId]` — рабочее пространство конкретной группы.

### Вторичные поверхности

4. `/lessons` — глобальный кросс-групповой индекс scheduled lessons.
5. `/methodologies` — педагогический source layer с операционным входом в расписание.
6. `/methodologies/[methodologySlug]` — просмотр структуры методики и уроков.
7. `/methodologies/[methodologySlug]/lessons/[lessonId]` — просмотр исходного урока методики без группы/расписания + назначение урока в группу.

### Стабильная поверхность исполнения

8. `/lessons/[scheduledLessonId]` — runtime execution screen занятия.

## Step 1: IA alignment — реализовано

- Навигация преподавателя выровнена вокруг группы и исполнения уроков.
- Маршрутный каркас стабилизирован: `/dashboard` → `/groups` → `/groups/[groupId]` → `/lessons/[scheduledLessonId]`.
- Зафиксировано server-first направление read-model слоя.

## Step 2: operations dashboard — реализовано

- `/dashboard` переведён в формат ежедневного рабочего экрана.
- Добавлены быстрые операционные entry points (`/groups`, `/students/new`, `/lessons`, `/methodologies`).
- `My groups` — table-first блок с фильтрами и операционными сигналами.
- Weekly schedule + attention summary встроены как operational read model.

## Step 3: group setup + methodology binding + contextual scheduling — реализовано

- `class.methodology_id` стал явным source of truth для методики группы.
- Новая группа создаётся только с выбранной методикой (`methodology_id` обязателен при создании).
- После создания группы `class.methodology_id` неизменяем (`immutable`).
- Текущее UI-поведение не поддерживает свободную смену методики существующей группы.
- Legacy/backfill-группы могут сохранять `class.methodology_id = null`; для них scheduling в контексте группы заблокирован.
- Group-scoped scheduling ограничен уроками назначенной методики.
- Прогресс группы:
  - numerator = только `scheduled_lesson.runtime_status = completed`;
  - denominator = количество `methodology_lesson` в назначенной методике.

## Step 4: homework runtime layer — реализовано

- `methodology_lesson_homework` — канонический контент homework.
- Преподаватель в runtime не редактирует контент homework, а только выдаёт и проверяет.
- Runtime-выдача: `scheduled_lesson_homework_assignment`.
- Персонифицированное состояние: `student_homework_assignment`.
- `/lessons/[scheduledLessonId]` включает выдачу (all/selected), due date, review-state и review note.

## Step 5: communication runtime layer — реализовано

- Непрерывный контейнер: `group_student_conversation` (один на пару `class + student`).
- Сообщения: `group_student_message` с optional runtime-ссылками (`scheduled_lesson_id`, `scheduled_lesson_homework_assignment_id`, `topic_kind`).
- Полный поток преподавателя: `/groups/[groupId]/students/[studentId]/communication`.
- `/lessons/[scheduledLessonId]` показывает lesson/homework-scoped проекции того же conversation контейнера.
- Student отвечает в том же контейнере; Parent видит read-only проекцию.

## Что намеренно отложено

- attachments/files/voice в коммуникации;
- advanced unread/notifications;
- attendance subsystem;
- full calendar subsystem;
- редакторы методик/блоков и AI-слой.
