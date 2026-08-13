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
- `20260806190044_lesson_runs_learning_records.sql` — scheduling, LessonRun и
  recorder-scoped LearningRecord history.
- `20260806220726_learner_groups_mixed_course_audience.sql` — reusable Groups
  и deduplicated direct+group Course audience.
- `20260807033034_canonical_learner_profile.sql` — canonical LearnerProfile,
  teacher-local directory relation и explicit record provenance.
- `20260807065017_identity_security_hardening.sql` —
  `20260807065038_learner_identity_legacy_contract_cleanup.sql`: M1–M4
  roleless identity expand/backfill/workflows/contract cutover.
- `20260809084500_learner_identity_auth_deferred_invariant_security.sql` — M5
  Auth-safe exactly-one deferred invariant boundary.
- `20260809090000_learner_identity_provisional_auth_metadata_sync.sql` — M6
  trusted two-phase GoTrue provisional metadata synchronization.
- `20260810035033_course_publication_catalog.sql` — C1 immutable Course
  publication revisions, private publication assets и independent catalog
  clone/duplicate boundary.
- `20260811154138_remove_divider_components.sql` — D1 удаление
  layout-only `divider`, уплотнение Component/Slide positions и CHECK-запрет
  повторного создания.
- `20260812113000_educator_course_attestations.sql` — E1 назначение Course
  `children | educators`, immutable publication-attestation sidecar,
  server-scored Account attempts/awards и profile credentials.
- `20260812150745_educator_course_governance_progress.sql` — E2 trusted-author
  capability, обязательный admin review exact educator revision,
  `approved_revision_id`, official license, Account-scoped self-learning
  progress и абсолютные no-copy/no-roster/no-LessonRun guards.
- `20260813063716_unify_heading_rich_text_components.sql` — applied production
  data-only перевод authored `heading` в title-only `rich_text` и объединение
  только непосредственных `heading → rich_text` с одинаковыми visibility,
  `student_slide_id` и placement. Compatible web был развёрнут до verified
  backup/apply; postflight: `96 → 85` Components, `heading 17 → 0`,
  `rich_text 38 → 44`, invalid/empty/density violations `0`. Immutable
  publication revision и physical schema не изменились. Self-hosted contour не
  имеет relation `supabase_migrations.schema_migrations`, поэтому применение
  подтверждают exact SQL SHA-256
  `874251c80e2a82bbf79897cb12755d606f9e1b546a9a3f51951dfaae89c5e1a3`,
  наблюдаемый `COMMIT`, maximum `updated_at` преобразованных строк
  `2026-08-13T07:05:50.169297Z` и read-only postflight, а не history row.

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
- synchronized current-schema docs и generated SQL snapshot, когда меняется
  physical schema; для data-only migration — явное подтверждение неизменной
  physical shape вместо ложного dump refresh;
- application tests/build и production postflight.
