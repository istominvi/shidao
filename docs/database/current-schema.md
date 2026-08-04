# Current database schema

**Статус:** agent-first current-state guide
**Schema head:** `20260804044955_add_lesson_student_slides.sql`
**SQL snapshot:** [`supabase/schema/current-schema.sql`](../../supabase/schema/current-schema.sql)

Этот документ описывает только текущую физическую модель. История переходов и
backfill находится в migrations; будущие таблицы — в roadmap/spec и не должны
предполагаться существующими.

## Read order для DB-задач

1. этот документ;
2. `supabase/schema/current-schema.sql`;
3. `supabase/migrations/*` только для нового migration, compatibility/backfill,
   rollback или debugging history.

Политика изменений:
[`docs/database/migration-guidelines.md`](./migration-guidelines.md).

## Current public tables

### V2 Course Builder

| Table                  | Назначение                                                           |
| ---------------------- | -------------------------------------------------------------------- |
| `account`              | один V2 owner identity на `auth.users`                               |
| `course`               | Account-owned draft Course и teacher input                           |
| `lesson`               | упорядоченная Lesson с обязательным `title` и teacher-only `summary` |
| `lesson_component`     | единственный ordered component list Lesson                           |
| `lesson_student_slide` | бесконтентная persisted grouping для Student Screen                  |
| `stored_file`          | Account-owned metadata private Storage object                        |
| `course_attachment`    | ownership-checked связь Course ↔ StoredFile                          |

`lesson_component` физически хранит:

```text
id
lesson_id
type_key
schema_version
position
payload
placement_config
visibility
student_slide_id
created_at
updated_at
```

В TypeScript/API поле `placement_config` отображается как `placement`.
`student_slide_id` nullable: `null` для private Component, Slide ID той же
Lesson для learner-visible Component.

### Transitional identity/profile compatibility

Эти таблицы пока обслуживают существующий login/onboarding/profile/session
контур:

```text
parent
teacher
student
school
school_teacher
class
class_teacher
class_student
user_preference
user_security
```

Они не являются родителями Course Builder content. `course` принадлежит
`account`, а не Teacher/School/Class. Их будущая замена новой
Account/LearnerProfile моделью требует отдельного milestone.

## Account fields

`account` хранит уникальный `auth_user_id`, `display_name`, `locale`, `timezone`,
status `active | suspended | deleted` и timestamps. Обычный authenticated JWT
может читать только свой Account; bootstrap выполняет trigger на `auth.users`.

## Course fields

`course` хранит:

- `owner_account_id`;
- `title`, `subject`, `goal`, `level`;
- `audience_description`;
- `target_lesson_count`;
- `teacher_preferences`;
- `audience_type`, сейчас constraint допускает только `none`;
- reserved object `settings`, сейчас по умолчанию `{}`;
- `assembled_at`, `archived_at`, timestamps.

Отдельной физической колонки `status` сейчас нет. Repository выбирает только
`archived_at IS NULL` и возвращает такой активный Course как domain status
`draft`.

Audience сейчас является описательным текстом, не persisted
LearnerProfile/Group assignment.

## Current invariants

### Lessons

- DB гарантирует положительную и уникальную в Course position через deferrable
  constraint; supported service path добавляет в конец.
- Delete уплотняет позиции trigger/function, но отдельного DB constraint на
  отсутствие gaps после произвольного direct INSERT нет.
- `title` обязателен; `summary` teacher-only.
- `estimated_duration_minutes` nullable и положителен при наличии;
  `settings` — reserved JSON object.
- Пустая Lesson допустима.

### Components

- Component напрямую принадлежит Lesson; Step/root Step отсутствует.
- DB гарантирует положительную и уникальную в Lesson position. Supported
  service/RPC path поддерживает плотный порядок; direct INSERT сам по себе
  может создать gap, а concurrent append сейчас может столкнуться по позиции.
- `type_key` остаётся code-first string, не database enum.
- Payload/placement проверяются application registry до обычной записи.
- Visibility только `staff_only | learner_visible`.
- `staff_only` обязан иметь `student_slide_id IS NULL`.
- `learner_visible` обязан ссылаться на Slide той же Lesson.

### Student Screen Slides

- Slide position положительная, плотная и уникальная в Lesson.
- Пустые Slides автоматически удаляются.
- При проходе Components по `component.position` Slide position не может
  уменьшаться.
- Slide не содержит title/payload/instructions/собственный component order.
- `set_lesson_component_student_screen` выполняет `hide | existing | new`
  атомарно и не позволяет разорвать соседей, уже сгруппированных на одном
  Slide.
- `reorder_lesson_component` атомарно меняет общий порядок и ограничивает Slide
  перемещённого learner-visible Component допустимым диапазоном соседей.
- `delete_lesson_component` сериализует delete, compaction и cleanup через
  единый Lesson-first lock order.

### Deterministic assembler

`assemble_course_draft(course_id, lesson_title, lesson_summary, components)`:

- работает как `SECURITY INVOKER`;
- создаёт одну Lesson и validated Components атомарно;
- оставляет новые Components `staff_only` без Slide assignment;
- идемпотентно возвращает Course/Lesson/Component IDs после `assembled_at`;
- не имеет Step arguments или `stepIds`.

## Files and private Storage

- Bucket: `course-assets`, `public=false`.
- Max object size: 10 MiB.
- Allowed MIME types совпадают с application contract.
- `stored_file` имеет status `pending | ready`, размер, MIME, lowercase SHA-256,
  bucket/path, metadata JSON object и Account owner.
- Path начинается с Account UUID; Storage policies проверяют первый segment.
- `course_attachment` связывает только Course и file одного Account.
- Upload/download выполняются signed operations пользовательского JWT.
- Student preview получает только attachments, на которые ссылаются видимые
  image/slideshow/file Components.

Успешная загрузка не означает parsing/RAG.

## Auth/session helpers

- Trigger на `auth.users` создаёт `account` для нового Auth user.
- `current_account_id()` — authenticated `SECURITY INVOKER` helper.
- `current_session_invalid_before()` возвращает только cutoff текущего
  `auth.uid()`; `PUBLIC/anon` execute revoked, ordinary caller —
  `authenticated`, а `service_role` administrative grant сохранён.
- `revoke_user_sessions()` и `APP_SESSION_VERSION` обеспечивают per-user и
  global invalidation.
- Старые profile/PIN helpers остаются частью transitional identity flow.

## RLS and ACL: V2 tables

RLS включён на Account/Course/Lesson/Component/Slide/File/Attachment и основных
transitional profile/membership tables. Исключение текущего snapshot:
`user_preference` и `user_security` не имеют RLS и сохраняют широкие legacy
table/function grants, включая `anon`/`authenticated`. Application обращается к
ним через существующие server-side privileged helpers, но сам ACL остаётся
высокоприоритетным compatibility security debt. Его нужно исправить отдельной
forward migration после инвентаризации login/onboarding/PIN/session callers.
Аудит должен охватить не только две таблицы, но и legacy `SECURITY DEFINER` RPC
с caller-supplied `p_user_id` и `anon` execute, включая preference/security,
onboarding/settings и PIN helper families. Это не образец для новых таблиц.

| Object                 | `authenticated` direct access                                                   | Дополнительная граница                           |
| ---------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------ |
| `account`              | own `SELECT`                                                                    | Auth insert trigger; direct mutation отсутствует |
| `course`               | owner-scoped CRUD                                                               | `current_account_id()`                           |
| `lesson`               | owner-scoped CRUD                                                               | ownership через Course/Account                   |
| `lesson_component`     | `SELECT`, restricted INSERT columns, UPDATE только `payload`/`placement_config` | visibility/order/delete через RPC                |
| `lesson_student_slide` | owner-scoped `SELECT`                                                           | direct mutations revoked; только RPC             |
| `stored_file`          | owner-scoped CRUD                                                               | Storage object policy отдельно                   |
| `course_attachment`    | owner-scoped CRUD                                                               | Course/File same-owner check                     |

`anon` не имеет table privileges на V2 Course Builder documents/files.

Student Screen assignment, reorder и delete используют узкие
`SECURITY DEFINER` functions с:

- empty `search_path`;
- explicit `auth.uid() → account → course` ownership check;
- одинаковым not-found результатом для чужого ID;
- revoked `PUBLIC/anon` execute;
- authenticated-only execute;
- сериализованным Lesson-first lock order.

## Cross-schema objects в snapshot

Snapshot дополнительно фиксирует объекты, которые не попадают в обычный
`public` dump:

- `trg_auth_user_create_account` на `auth.users`;
- row/invariant private bucket `storage.buckets.course-assets`;
- owner policies на `storage.objects` для SELECT/INSERT/UPDATE/DELETE.

Любой refresh snapshot обязан сохранить этот раздел и ACL/default privileges.

## Absent from active model

В current public schema нет Methodology, methodology lessons/blocks,
scheduled-lesson runtime, старого homework/communication/notification слоя,
`lesson_step` или `lesson_step_component`.

Старые migration files остаются неизменяемой forward history, а полный V1 — в
recovery. Они не являются current schema и не должны импортироваться в runtime.

## Snapshot refresh workflow

Перед refresh обязательно выполнить read-only ShiDao sanity check.

```bash
DATABASE_URL='postgresql://...' npm run db:snapshot
```

После команды обязательно review полного diff. Snapshot считается пригодным,
только если не потеряны grants/default ACL, cross-schema Auth trigger,
Storage bucket/policies и все current functions/RLS. Скрипт не применяет DDL и
не меняет migrations. Перед `pg_dump` он сам выполняет read-only signature
check обязательных ShiDao V2 tables/columns и отказывается перезаписывать файл
при несовпадении; signature также проверяет current Student Screen RPC и
отсутствие active Methodology table.

Если целевая migration ещё не применена, snapshot обновляется через
изолированный schema clone и review, а не копированием предположительной
таблицы из roadmap.
