# Migration history policy

ShiDao хранит два обязательных слоя:

1. `docs/database/current-schema.md` и
   `supabase/schema/current-schema.sql` — текущее состояние;
2. `supabase/migrations/*` — реальный forward upgrade path.

## Почему оба слоя остаются

- Current snapshot уменьшает контекст для ежедневной разработки.
- Migration chain воспроизводит production upgrade, backfill и compatibility
  решения.
- Старые migrations не описывают current model по отдельности, но остаются
  необходимой историей текущей базы.

## Правило использования

Для обычной current-state задачи читать snapshots. Migrations читать, только
если нужно:

- написать новый migration;
- понять backfill/constraint/lock history;
- проверить upgrade существующей базы;
- исследовать rollback/reset;
- отладить расхождение migration history и live schema.

## Неизменяемость

- Старый migration после применения не редактируется.
- Chain не squash'ится и не заменяется baseline в рамках обычных milestone.
- Удалённые V1 таблицы всё равно остаются в ранних migration files как
  исторические upgrade records.
- Ошибка исправляется следующей forward migration.
- Snapshot не применяется к базе и не считается migration.

## Последние архитектурные переходы

- `20260803142924_v2_course_builder_vertical_slice.sql` — Account, Course,
  initial Lesson authoring, private StoredFile/CourseAttachment.
- `20260804033421_course_lesson_components_remove_legacy_methodology.sql` —
  direct Lesson Components; удаление active Methodology/Step/runtime schema.
- `20260804044955_add_lesson_student_slides.sql` — persisted Student Screen
  Slides, atomic assignment/reorder/delete и tightened RLS/ACL.

Backfill details являются историей этих migrations и не должны повторяться в
current-schema guide как действующая domain model.

## Новый migration

Следовать полному checklist:
[`docs/database/migration-guidelines.md`](./migration-guidelines.md).

Минимальный hand-off содержит:

- read-only ShiDao sanity evidence;
- migration filename;
- affected tables/functions/policies;
- backfill/invariant counts;
- RLS/ACL negative tests;
- synchronized current-schema snapshots;
- application tests/build и production postflight.
