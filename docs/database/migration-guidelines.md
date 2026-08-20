# Правила изменений базы ShiDao

**Статус:** обязательная политика для всех новых DB changes
**Последний подтверждённый production schema head:**
`20260820090529_course_publication_snapshot_v2.sql`, применённый после
`20260820085049_learning_objectives_component_alignment.sql` с SHA-256
`82734db13f473c011ae61b24fc67601ac84cca986bf64395ac9ddd98ce07988a`, затем
publication V2 migration с SHA-256
`19d4f9fddbed2beedd1b3ad60e0100e27d8d774852c4a4d95e23593fbf82e8f8`.
Production-derived clone прошёл exact rollback/apply, functional harness и
восемь multi-session races; contract snapshot снят
`2026-08-20T09:54:46Z`, SHA-256
`46aabae2c1a00723c2c4a3322060cb49bd48f40a0ac23d7f8a294c64c630b8b3`.
После project-local read-only sanity создан verified backup
`/root/shidao-db-backups/shidao-before-learning-objective-alignment-20260820T104240Z.dump`
(size `1507990`, mode `600`, `1771` restore-list entries, SHA-256
`d508626107c6dc5a4222a77c483db929778a06a1825b61ff3bd6d3df271743c1`).
Обе migrations завершились наблюдаемым `COMMIT`; RLS/ACL/RPC/FK/trigger,
lock-order, publication V2, PostgREST visibility, unchanged canonical counts и
legacy V1 bytes/checksum прошли postflight без production fixtures. Task
commit и dependent web rollout exact source
`014aee43bb82aa2ce486fe8e8f9d60ddc58c87c0` завершены; clone provenance
по-прежнему отделена от production execution record.
**Последняя применённая authored-data-only migration:**
exact tracked `20260813063716_unify_heading_rich_text_components.sql` применён
production; `psql` зафиксировал `COMMIT`, а maximum `updated_at`
преобразованных строк — `2026-08-13T07:05:50.169297Z`. Она не меняла
physical schema; последующие E2A, AV1, CC1, A2, LA-M1 и LA-M2 schema rollout
отражены в production contract и execution record выше.
**Последний документированный coupled application rollout source:**
`014aee43bb82aa2ce486fe8e8f9d60ddc58c87c0`; Coolify deployment `1003`
(`f93pn3ifoq4cehouec41793m`) завершён с exact source/image, restart count `0` и
зелёным HTTPS/API/CSRF/browser guest postflight. Exact local strict
production-mode browser suite прошёл `30/30`; authenticated production no-write
editor smoke не заявляется из-за отсутствия authenticated browser session.

Исторический U1-compatible source
`dea92ca2c9af99fd5738e95fa9ca511aa10ca3da` был развёрнут и проверен до U1
backup/apply. Его running container
`g9x4d9zn60jv35r7zf0xl6xj-065823494924` имел matching image/`SOURCE_COMMIT`,
image ID
`sha256:f0f07ffd8b18ee5faadff5a1f01d0ea5e663807ec6f83754b16d43b64e18379d`
и restart count `0`.

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

У `SECURITY INVOKER` trigger нужно отдельно проверить ACL всего nested call
graph. Сам trigger запускается PostgreSQL без runtime `EXECUTE` проверки роли
на trigger function, но вызванная из него обычная функция уже исполняется с
правами исходного DML caller. Поэтому закрытый helper нельзя просто вызвать из
invoker guard и нельзя открывать `EXECUTE` browser role только ради обхода
ошибки. Если predicate использует уже доступные caller grants/RLS, его следует
встроить в trigger; альтернативный `SECURITY DEFINER` boundary требует полного
review по правилам выше. Regression gate обязан выполнять реальный
`SET LOCAL ROLE authenticated` owner DML, а не только проверять
`pg_trigger.tgenabled` и function existence. Этот contract применяется к
E2A-исправлению educator Course content guard.

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
  update grants;
- после AV1 — mandatory Account avatar columns/check, revision-aware
  server-only setter ACL, private `profile-avatars` bucket и отсутствие
  browser Storage policies для него.
- после CC1/A2 — Communication Center tables/RPC/triggers/closed raw ACL и
  atomic Assistant LessonRun schedule guard;
- после LA-M1 — observation table, composite recorder FK, nullable live
  Component FK, recorder SELECT policy, закрытый raw mutation ACL, narrow batch
  RPC и absent-completion guard.
- после LA-M2 — objective table/RLS/closed raw mutation ACL, narrow objective
  RPC, canonical Component update RPC и parent-first lock order,
  same-Course/archive/role constraints, observation objective-at-time
  provenance и exact publication V1/V2 compatibility/remap.

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

Для LA-M1 дополнительно обязательны:

- `scripts/db-learning-activity-tests.sh` на isolated database с exact именем
  `shidao_learning_activity_test`;
- `scripts/db-learning-activity-concurrency-tests.sh` на той же disposable
  базе: реальные отдельные sessions должны доказать оба порядка гонки
  save/completion;
- denial до actual start, для foreign Component/record/owner и после
  complete/cancel; cancel cascade и readable at-time history после удаления
  live Component;
- отсутствие `private_note` в learner/observer safe projections;
- PostgREST RPC visibility после cache reload при сохранённом запрете raw
  mutation.

Для LA-M2 этот же gate расширяется:

- functional harness проверяет owner/cross-account/cross-Course access,
  create/update/archive, retained archived alignment, supported activity roles,
  objective-at-time observation provenance, отсутствие backfill старых rows и
  immutable publication V1/V2 copy/duplicate/remap;
- multi-session harness доказывает восемь реальных исходов: четыре LA-M1 races,
  оба alignment↔observation-save и оба publication↔objective-update; lock order
  нельзя заменять UI retry;
- learner-safe application projections не содержат answer keys, evaluator
  config, objective IDs или activity role; malformed projection fail closed;
- postflight отдельно подтверждает objective RLS/ACL/RPC, Component update RPC,
  observation retention, publication constraint/functions и неизменность
  legacy revision bytes/checksum;
- evidence eligibility остаётся pure projection и не создаёт persisted
  evidence, objective state или mastery.

Записать измеримые результаты в commit/hand-off, а не только «migration
успешна».

## 9. Rollback

Forward migration по умолчанию не получает автоматический destructive
down-script. Ошибку исправлять следующей forward migration.

V1 recovery из snapshot не является rollback обычной V2 migration. Он
выполняется только по отдельной явной команде и по
[`docs/operations/v1-recovery-runbook.md`](../operations/v1-recovery-runbook.md).
