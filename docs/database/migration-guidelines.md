# Правила изменений базы ShiDao

**Статус:** обязательная политика для всех новых DB changes
**Текущий production schema head:**
`20260812150745_educator_course_governance_progress.sql`
**Текущий authored-data / repository migration head:**
exact tracked `20260813063716_unify_heading_rich_text_components.sql` применён
production; `psql` зафиксировал `COMMIT`, а maximum `updated_at`
преобразованных строк — `2026-08-13T07:05:50.169297Z`. Physical schema не
изменилась, поэтому current generated snapshot остаётся E2 snapshot
`2026-08-12T07:46:11Z`, SHA-256
`a34a5a5919ea406050a5c0cb7f39310d1a9e807725e608166f63becb8f2260a4`.
**Совместимый functional rollout source:**
`dea92ca2c9af99fd5738e95fa9ca511aa10ca3da`; running container
`g9x4d9zn60jv35r7zf0xl6xj-065823494924` имеет matching image/
`SOURCE_COMMIT`, image ID
`sha256:f0f07ffd8b18ee5faadff5a1f01d0ea5e663807ec6f83754b16d43b64e18379d`,
restart count `0`. Он был развёрнут и проверен до U1 backup/apply.

U1 execution evidence: backup
`/root/shidao-db-backups/shidao-before-unify-heading-rich-text-20260813T070512Z.dump`
имеет size `1324116`, mode `600`, `1610` restore entries и SHA-256
`ee169345af886fd97a3060273b03d20f37dec380a82bbc43eb759e8f098ed775`;
migration SHA-256 —
`874251c80e2a82bbf79897cb12755d606f9e1b546a9a3f51951dfaae89c5e1a3`.
Self-hosted contour не имеет relation
`supabase_migrations.schema_migrations`, поэтому не следует выдумывать history
row: использовать checksum, наблюдаемый `COMMIT`, timestamp преобразованных
строк и измеримый postflight. Для U1 он равен `96 → 85` Components,
`heading 17 → 0`, `rich_text 38 → 44`, invalid shapes/empty Slides/dense
violations `0`; immutable publication revision не изменилась.

## 1. Источники истины

Для current-state reasoning читать в таком порядке:

1. [`docs/database/current-schema.md`](./current-schema.md)
2. [`supabase/schema/current-schema.sql`](../../supabase/schema/current-schema.sql)
3. `supabase/migrations/*` — только когда задача зависит от upgrade/backfill/
   rollback/history.

Migration history не заменяет current snapshot, а snapshot не заменяет
forward history.

## 2. Перед любой записью

1. Убедиться, что используется доступ только текущего workspace, а не
   глобальный database MCP.
2. Выполнить read-only sanity check.
3. Подтвердить признаки ShiDao:
   - ожидаемые `account`, `course`, `lesson`, `lesson_component`;
   - текущий migration head/ожидаемые columns;
   - домен/host подключения относится к ShiDao;
   - нет признаков другого проекта.
4. Снять минимальные counts/invariants, которые будут использованы в
   postflight.
5. Для destructive или широкого backfill отдельно согласовать backup и окно.

Если sanity check не подтверждает ShiDao однозначно, запись запрещена.

## 3. Только forward migrations

- Не удалять, не переименовывать и не переписывать существующие migration
  files.
- Не squash'ить chain в обычной разработке.
- Не выполнять массовый reset `public` ради отдельного milestone.
- Создавать новый файл через `supabase migration new <name>` после проверки
  доступной версии CLI и `--help`.
- Одна migration должна иметь ясный forward intent, sanity preflight и
  проверяемый postflight.
- Data backfill разрешён внутри migration, когда он необходим для нового
  invariant и детерминирован. Product fixtures/демо-контент не добавляются в
  schema migration.

## 4. Структура безопасной migration

Рекомендуемый порядок:

1. fail-fast schema identity/precondition checks;
2. DDL новых объектов/columns;
3. детерминированный backfill;
4. constraints/indexes;
5. functions/triggers;
6. RLS policies;
7. explicit `REVOKE`/`GRANT`;
8. PostgREST schema-cache reload при изменении REST-visible shape;
9. postflight assertions;
10. `COMMIT` только после всех проверок.

Для multi-row reorder/compaction заранее определять единый lock order. Если
invariant связывает несколько entry points (например archive, publish и open
Run), все прямые и обратные пути должны сериализоваться на одном parent row и
повторно проверять состояние после ожидания lock. Не исправлять race condition
только preflight-read или retry в UI.

## 5. RLS и Data API

Для каждой новой таблицы в exposed schema:

- включить RLS;
- явно решить, какие роли имеют object-level privileges;
- выдать только нужные `GRANT`, не полагаясь на default exposure;
- добавить ownership/membership predicate, а не только `TO authenticated`;
- для `UPDATE` определить и `USING`, и `WITH CHECK`;
- проверить чужого пользователя и `anon` отрицательными тестами.

RLS и grants решают разные задачи: grant разрешает операцию объекту, policy
ограничивает строки. Оба слоя входят в Definition of Done.

`SECURITY DEFINER` допустим только для узкой операции, если обычный
`SECURITY INVOKER` не может безопасно выполнить invariant. В таком случае
обязательны:

- `SET search_path = ''`;
- explicit `auth.uid()` ownership chain;
- одинаковый результат для чужого и отсутствующего ID;
- `REVOKE ALL ... FROM PUBLIC, anon, authenticated, service_role` перед выдачей
  нового ACL, чтобы не унаследовать default execute;
- затем узкий `GRANT EXECUTE` только требуемой роли;
- review lock order и concurrency;
- тесты, что direct table mutation остаётся недоступной.

Для trigger-only helper без caller identity допустимо отсутствие собственного
`auth.uid()` predicate только когда одновременно доказано, что helper:

- принадлежит тому же owner, что защищаемая relation;
- имеет `SET search_path = ''`;
- не имеет `EXECUTE` у `PUBLIC`, `anon`, `authenticated` или `service_role`;
- вызывается только reviewed trigger graph;
- не расширяет browser table/column ACL.

Официальные ориентиры:

- <https://supabase.com/docs/guides/database/postgres/row-level-security>
- <https://supabase.com/docs/guides/api/securing-your-api>
- <https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically>

## 6. Auth и Storage границы

Обычная Course Builder migration не должна менять:

- `auth.users`, GoTrue/SMTP/JWT/API keys;
- базовые Supabase schemas;
- существующий Storage service/volume;
- bucket configuration, если изменение не относится прямо к файловому
  contract milestone.

Новая Storage policy проверяется вместе с bucket privacy, size/MIME limits,
owner path, signed access и отрицательным cross-account сценарием.

## 7. Snapshot после schema change

В том же изменении обновить:

- `supabase/schema/current-schema.sql`;
- `docs/database/current-schema.md`;
- `docs/project-state.md`, если изменился продуктовый capability;
- schema-contract tests.

Для чистой data migration без изменения tables/functions/triggers/RLS/ACL
generated SQL snapshot не переписывается только ради нового содержимого строк.
В таком случае обновляются migration history, current-state/application docs и
измеримый execution postflight; `docs/database/current-schema.md` явно
разделяет physical schema head и применённый data-only migration head.

`npm run db:snapshot` можно использовать только после read-only sanity check и
только если review diff подтверждает, что сохранены:

- ACL/default privileges;
- functions/triggers/RLS/policies;
- Auth Account bootstrap trigger;
- `course-assets` bucket invariant;
- Storage object policies;
- после A1 — atomic Course archive RPC, четыре guard triggers, immutable Lesson
  parent, private touch-helper flags/ACL и exact column-only Course/Lesson
  update grants.

Скрипт сначала проверяет read-only ShiDao schema signature, пишет во временный
файл и не должен менять migration history. Полученный snapshot не применяется
как migration.

## 8. Postflight

Минимум проверить:

- новая shape присутствует;
- старые строки backfilled без потерь;
- constraints/invariants не нарушены;
- RLS включён;
- ACL и function `EXECUTE` соответствуют модели;
- owner может выполнить разрешённый workflow;
- другой owner и `anon` не могут;
- PostgREST видит новые relationships/RPC;
- Storage/Auth остались работоспособны, если migration их косвенно затронула;
- application typecheck/tests/build проходят.

Записать измеримые результаты в commit/hand-off, а не только «migration
успешна».

## 9. Rollback

Forward migration по умолчанию не получает автоматический destructive
down-script. Ошибку исправлять следующей forward migration.

V1 recovery из snapshot не является rollback обычной V2 migration. Он
выполняется только по отдельной явной команде и по
[`docs/operations/v1-recovery-runbook.md`](../operations/v1-recovery-runbook.md).
