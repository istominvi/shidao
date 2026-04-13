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

Источник истины по таблицам и ограничениям: `supabase/schema/current-schema.sql`.

## 2) Продуктовые инварианты

- Роль в URL не кодируется: основной вход — `/dashboard`.
- Teacher/parent переключаются через `user_preference.last_active_profile`.
- Ученик логинится по `student.login` (с internal auth email внутри контура).
- Канонический runtime-маршрут урока для всех ролей: `/lessons/[scheduledLessonId]`.
- Parent видит read-only проекции по своим детям.

## 3) Source vs runtime

- Методика и уроки методики — неизменяемый педагогический source.
- `scheduled_lesson` и связанные homework/communication — runtime-исполнение.
- Teacher workspace работает с runtime-объектом, а не редактирует source урока в обход методики.

## 4) Что считать историческим слоем

- `supabase/migrations/*` — журнал эволюции и совместимости.
- Исторические волны изменений и их причины — в `docs/database/migration-history.md`.
- Для текущей разработки читать сначала snapshot: `docs/database/current-schema.md` и `supabase/schema/current-schema.sql`.
