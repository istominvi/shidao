# Доменная модель ShiDao (текущий срез)

## 1) Канонические сущности

### Identity и доступ
- `parent`
- `teacher`
- `student`
- `user_preference`
- `user_security`

### School/group контекст
- `school`
- `school_teacher`
- `class`
- `class_teacher`
- `class_student`

### Методический source layer
- `methodology`
- `methodology_lesson`
- `methodology_lesson_block`
- `methodology_lesson_block_asset`
- `reusable_asset`
- `methodology_lesson_student_content`
- `methodology_lesson_homework`

### Runtime layer
- `scheduled_lesson`
- `scheduled_lesson_homework_assignment`
- `student_homework_assignment`
- `group_student_conversation`
- `group_student_message`
- `lesson_group_conversation`
- `lesson_group_message`

Источник истины по таблицам и ограничениям: `supabase/schema/current-schema.sql`.

## 2) Продуктовые инварианты

- Роль в URL не кодируется: основной вход — `/dashboard`.
- Teacher/parent переключаются через `user_preference.last_active_profile`.
- Для teacher дополнительно поддерживается режим работы:
  - `Лично` (personal school `school.kind='personal'`, `user_preference.last_selected_school_id = null`);
  - `Школа` (selected organization school id в `user_preference.last_selected_school_id`).
- Ученик логинится по `student.login` (с internal auth email внутри контура).
- Канонический runtime-маршрут урока для всех ролей: `/lessons/[scheduledLessonId]`.
- Parent видит read-only проекции по своим детям.

## 3) Source vs runtime

- Методический source определяет канонические Lesson Step (Шаги), teacher-side инструкции, learner-side наполнение (`Student Screen`), материалы и source-homework.
- `scheduled_lesson` и связанные runtime-сущности хранят/производят состояние исполнения: статус урока, выдачу и проверку homework, коммуникации; live current step, attendance и telemetry — целевое расширение runtime-слоя.
- Teacher workspace работает с runtime-объектом, а не редактирует source урока в обход методики.
- `План урока` (Teacher Side) и `Экран ученика` (Learner Side) — это две проекции одной и той же ordered последовательности шагов.
- `Экран ученика` не равен `Материалам`: learner player и ресурсная библиотека — отдельные продуктовые поверхности.

## 4) Что считать историческим слоем

- `supabase/migrations/*` — журнал эволюции и совместимости.
- Исторические волны изменений и их причины — в `docs/database/migration-history.md`.
- Для текущей разработки читать сначала snapshot: `docs/database/current-schema.md` и `supabase/schema/current-schema.sql`.


См. канонический workflow-документ: `docs/architecture/lesson-workflow-model.md`.
