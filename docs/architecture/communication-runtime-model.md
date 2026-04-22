# Модель communication runtime (Step 5)

**Дата:** 8 апреля 2026  
**Статус:** Реализовано (MVP communication layer)

## Ключевое решение

Коммуникация построена в двух слоях:

1. **Непрерывный контейнер:** один `group_student_conversation` на пару `class(group) + student`.
2. **Scoped-проекции:** каждое сообщение может содержать optional ссылки на:
   - `scheduled_lesson_id`,
   - `scheduled_lesson_homework_assignment_id`,
   - `topic_kind` (`general`, `lesson`, `homework`, `progress`, `organizational`).

Это избегает двух крайностей:

- не отдельные lesson-silo чаты,
- не один глобальный неструктурированный чат.

## Хранилище

- `group_student_conversation`
  - уникальность по `(class_id, student_id)`.
- `group_student_message`
  - принадлежит conversation,
  - хранит `author_role` (`teacher` / `student` / `parent`) и текст,
  - может хранить optional lesson/homework runtime-ссылки.
- `communication_message_attachment`
  - хранит только metadata вложений сообщения (MVP: `kind='voice'`),
  - аудио бинарь хранится в приватном Supabase Storage bucket `communication-media`,
  - рекомендованные лимиты: `audio/webm|ogg|mp4|mpeg|wav`, до 10 MB.

## Runtime-поведение

- Conversation создаётся лениво (`ensureConversationByClassAndStudentAdmin`) при первом обращении/сообщении.
- Полный поток преподавателя доступен в:
  - `/groups/[groupId]/students/[studentId]/communication`.
- `/lessons/[scheduledLessonId]` показывает **lesson-scoped** и **homework-scoped** срезы того же conversation контейнера.
- Student dashboard позволяет отвечать в:
  - homework-scoped контексте,
  - general group-scoped контексте.
- Parent dashboard показывает read-only последние сообщения по каждому ребёнку.

## Ограничения доступа

- Teacher: только в пределах назначенных ему групп.
- Student: только собственное membership-пространство.
- Parent: только read-only проекция по привязанным детям.
- Нет смешивания сообщений между группами и между учениками.

## Что отложено

- file-вложения (non-voice),
- расширенные media-функции (волна/транскрипция/модерация),
- уведомления,
- advanced unread state,
- attendance-coupling,
- parent write participation.

## Ops заметка по Storage (MVP voice)

- bucket: `communication-media`;
- privacy: private bucket (без public read);
- MIME allowlist: `audio/webm`, `audio/ogg`, `audio/mp4`, `audio/mpeg`, `audio/wav`;
- suggested max file size: 10 MB.
