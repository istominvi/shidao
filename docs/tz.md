# ТЗ (актуализация доменной модели)

Дата: **8 апреля 2026**.

## Текущая целевая модель (срез на main)

### 1) Базовая identity/school/group модель

- `parent`
- `teacher`
- `student`
- `school`
- `school_teacher`
- `class`
- `class_teacher`
- `class_student`

Ограничения core-модели:

- `student` не содержит `teacher_id` и `school_id`.
- Привязка ученика к школе идёт через `class_student -> class -> school`.
- `parent` и `teacher` — отдельные сущности, не «роли в одной таблице».

### 2) Методический source layer + runtime-уроков

- `methodology`
- `methodology_lesson`
- `reusable_asset`
- `methodology_lesson_block`
- `methodology_lesson_block_asset`
- `scheduled_lesson`

Принцип:

- `methodology`/`methodology_lesson` — педагогический source of truth.
- `scheduled_lesson` — runtime-сущность исполнения.

### 3) Homework runtime-слой

- `methodology_lesson_homework`
- `scheduled_lesson_homework_assignment`
- `student_homework_assignment`

### 4) Communication runtime-слой

- `group_student_conversation`
- `group_student_message`

## Инвариант методики группы (`class.methodology_id`)

- Для новых групп `class.methodology_id` обязателен при создании.
- После создания группы `class.methodology_id` неизменяем (immutable).
- Legacy/backfill-группы из старого состояния могут иметь `class.methodology_id = null`.
- Текущее UI/маршруты не предоставляют свободную смену методики существующей группы.

## Онбординг преподавателя

При первом создании `teacher` автоматически создаются:

- школа,
- связь `school_teacher` с ролью `owner`,
- первый класс,
- связь `class_teacher`.

## Совместимость student auth

`student.internal_auth_email` сохранён как внутреннее инфраструктурное поле для безопасного перехода со старого login-flow.

## Teacher IA и runtime-слои (актуальное состояние)

### Step 1: group-centric IA — реализовано

- Основной teacher-контекст: `/dashboard`, `/groups`, `/groups/[groupId]`.
- `/lessons` остаётся secondary global индексом.

### Step 2: operations dashboard — реализовано

- `/dashboard` работает как command center.
- Добавлены рабочие entry points: `/groups/new`, `/students/new`, `/methodologies`.
- `/groups` усилен до полного индексного списка с поиском/фильтрами.

### Step 3: group setup + methodology binding + contextual scheduling — реализовано

- Источник методики группы: `class.methodology_id`.
- Новая группа создаётся сразу с методикой; дальнейшее изменение методики запрещено.
- `/groups/[groupId]` покрывает roster + group-scoped scheduling.
- При `class.methodology_id = null` (legacy) scheduling блокируется.
- Прогресс: `completed scheduled lessons / total lessons in assigned methodology`.

### Step 4: homework runtime layer — реализовано

- Канонический homework-контент хранится в методике.
- `/lessons/[scheduledLessonId]` — выдача, контроль и ревью homework в runtime.
- Homework V2 (09.04.2026):
  - typed model `practice_text | quiz_single_choice`;
  - teacher issuance modal (`Задать ДЗ`) + due date + assignment comment;
  - student quiz auto-checking (`submission_payload`, `auto_score`, `auto_max_score`, `auto_checked_at`);
  - parent read-only projection со статусом, результатом и комментариями.
- Student dashboard — submission, Parent dashboard — read-only проекция статусов.

### Step 5: communication runtime layer — реализовано

- Непрерывная коммуникация строится вокруг `group_student_conversation`.
- Сообщения связываются с lesson/homework runtime-контекстом через optional ссылки.
- Teacher получает полный поток в `/groups/[groupId]/students/[studentId]/communication`.


### 6) Three-part lesson model (реализовано)

- Урок формализован как 3 части: teacher scenario + student lesson content + homework.
- Добавлена таблица `methodology_lesson_student_content` (one-to-one к `methodology_lesson`).
- Для student/parent внедрён общий learner-facing lesson room.
- Teacher workspace показывает отдельный раздел `Контент для ученика` с переходом в ученическую версию.
