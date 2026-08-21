# Правила изменений базы ShiDao

**Статус:** обязательная политика для всех новых DB changes
**Текущий подтверждённый production schema head:**
P1.3 состоит из применённой base migration
`20260821181832_lesson_homework_authoring.sql` (`806` строк, SHA-256
`c5fe2d972ef69679f54a2d2a7409e82f75c3bbaa8b7030a632d6d2c4b7b03567`) и
обязательной forward-only repair
`20260821193000_harden_lesson_homework_rpc_validation.sql` (`607` строк,
SHA-256
`423fec96d0623684ca61d8fa3b40cfbe96322b848ca11e7130fbe725092983a2`).
Обе owner apply завершились отдельными наблюдаемыми `COMMIT` после exact
production-derived replay и verified backup
`/root/shidao-db-backups/shidao-before-homework-authoring-20260821T190751Z.dump`
(size `1972249`, mode `600`, `2104` restore-list entries, SHA-256
`d82c8fdd7d435dd6b04310c1d75f88e72556dc916574a0570934a18928cffdde`).
Current PostgreSQL `15.8` snapshot сгенерирован `2026-08-21T19:38:04Z`, имеет
SHA-256
`7f7741ca126e90bdadfbc151de4fbd2e57bf4a0c808c5f52f1fbf2ebe18d42c0`,
`36204` строки, `76` public tables и `278` functions; normalized public body —
`36080` строк, SHA-256
`c922ccbb52093a286f8cb967acd8258f6ba276eaf68a8fb86591444f69dbcdec`, exact
совпал с clean production-derived replay. P1.3 является CURRENT production
DB/source/web.

**Исторический LA-M3 execution record:**
`20260820132725_learning_activity_profile_history_skills_recommendations.sql`,
exact SHA-256
`a7e7dad7db4632f98cf0857597dae99b58cf653bd39ec57d0eb91f540c9793f8`,
`5335` строк. Production-derived PostgreSQL `15.8` clone из source dump
SHA-256
`6db636b32c1256efaf7b70321a031e3e93196788d265368561d4dbe239b456c1`
(`1801` restore-list entries) прошёл exact apply с наблюдаемым `COMMIT`, `85`
functional assertions, `11/11` LA races и identity functional/concurrency.
После project-local read-only sanity создан verified backup
`/root/shidao-db-backups/shidao-before-learning-activity-profile-20260821T002135Z.dump`
(size `1552941`, mode `600`, `1801` restore-list entries, SHA-256
`0d89e0be74aba44f20b0ee82ad5cafb6f887da1f55821350e84959a502f8a88e`).
Production owner apply завершился наблюдаемым `COMMIT`; canonical tuple
`19/6/22/84/2/2/0/0`, publication
`1/9056/2832fcf2ee1a4c3ccdf01501fc4f60f3` и LA-M3 rows `0/0/0/0` не изменились;
обе source LearningRecord сохранили empty correction/supersession metadata. RLS
`4/4`, `4` policies, ACL/RPC/security, `0` identity violations подтверждены.
PostgREST raw probes вернули anon
`401/42501` и service role `403/42501`; narrow service RPC достиг ожидаемого
domain `P0002` (`500`), а не schema-cache `PGRST202`. LA-M3 production-head
PostgreSQL `15.8` snapshot был сгенерирован `2026-08-21T00:25:53Z`, имел SHA-256
`a1768f22f829d58c01a5846b68cdb7be60a363ebb771869ed90fb83dd316cbc2`,
`29533` строки, `66` public tables и `235` functions; body побайтово совпадает
с snapshot, replayed из production-derived clone.
**Последняя применённая authored-data-only migration:**
exact tracked `20260813063716_unify_heading_rich_text_components.sql` применён
production; `psql` зафиксировал `COMMIT`, а maximum `updated_at`
преобразованных строк — `2026-08-13T07:05:50.169297Z`. Она не меняла
physical schema; последующие E2A, AV1, CC1, A2 и LA-M1–LA-M3 schema rollout
отражены в production contract и execution record выше.
**Предыдущий LA-M5 deployed application baseline перед P1.3:**
deployed functional source
`b8f62a635ad3bd77933e71decffe2a5616de26d5` доставлен normal fast-forward push в
`origin/main`. Local gates: `991/991` tests, strict Chromium `31/31`, production
build `73/73`, typecheck/lint/format/diff-check green. Основной Coolify
deployment `1009` (`cpeh1gokla9hpng8z57woj96`) доставил LA-M5 application;
после исправления отсутствующего Coolify Domains entry для `www.shidao.ru`
выполнен config redeploy `1010` (`m7depyulpqt0ka943ewajt10`). Final container
`g9x4d9zn60jv35r7zf0xl6xj-162236082905` использует image
`sha256:1458de67a667584f4863ad712ed25d64bb59ede12faba9f52959fe4424ce9045`
и matching `SOURCE_COMMIT`, running с restart count `0`; проверенные логи не
содержат error/exception/unhandled/fatal/panic. `www.shidao.ru` имеет valid TLS
и отвечает `302` на `https://shidao.ru/login`; external/container-local
host/API/CSRF/guest probes прошли. Authenticated production teacher/learner
lifecycle **NOT RUN**: safe existing session/Run отсутствовали, credentials и
fixtures не создавались. Disposable clone и временные файлы удалены, verified
production backups сохранены. P1.3 application/API/UI и guest web postflight
доставлены последующим task release; authenticated production Homework smoke
**NOT RUN**.

**LA-M3 delivery boundary:** physical production DB, functional source/web и
release postflight current. Последующий execution-record docs-only commit не
меняет runtime; его SHA нельзя подставлять вместо exact deployed functional
source `6e3f97c230f688663abaa06a126a56d0d0e2c9c6`.

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

P1.3 является обязательным примером этого правила: после production `COMMIT`
base Homework migration финальный audit выявил direct-RPC validation gap.
Применённый файл не переписывался; исправление доставлено отдельной migration
`20260821193000_harden_lesson_homework_rpc_validation.sql`. Любой replay обязан
применять обе migrations в исходном порядке.

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
- для current LA-M3 — stable LearningRecord correction provenance,
  reciprocal observation/evidence supersession, evidence/state/link/override
  tables, closed raw mutation ACL, narrow correction/profile/override RPC,
  completion/merge/erasure rebuild hooks, safe self/observer projections и
  единый learner-first/objective-sorted lock order. Synthesized `no_data` не
  должен появляться как persisted state row.
- после P1.3 — exact two Homework tables и three functions, four-type allowlist,
  one-per-Lesson/dense-order constraints, RLS без policies/raw browser grants,
  direct-RPC payload/placement validation, retained-empty CAS clear и отсутствие
  learner Homework relations/triggers/FK.

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

Для P1.3 отдельно обязательны exact database
`shidao_homework_authoring_test`, functional и real multi-session concurrency
harnesses, оба forward migrations, owner/cross-owner/direct-RPC validation,
CAS/ABA clear, archive/delete lifecycle, closed raw ACL и доказательство
отсутствия learner effects. Production DB postflight фиксирует inventory,
tuples, row counts, function grants и PostgREST codes; local/clone results не
подменяют production evidence.

Фактически выполненный LA-M3 production gate дополнительно включал:

- migration была отрепетирована на production-derived isolated clone; old
  LA-M1 `NULL` objective rows остаются history-only, а существующие eligible
  finalized LA-M2 rows материализуются без production fixtures;
- functional harness проверил draft/finalized/absent lifecycle, все три
  ratings, missing objective/criterion/confirmation, stable deleted provenance,
  correction chain/idempotent retry, deterministic fixed-clock rebuild,
  distinct Run opportunities, точную 90-day freshness boundary и
  replace/dismiss/clear override/reload;
- identity harness проверил transfer/rebuild при merge, исключение superseded
  same-Run result и полное включение LA-M3 rows в erasure fingerprint/cleanup;
- реальные multi-session sessions доказали completion↔save,
  completion↔rebuild, correction↔correction/rebuild, merge↔correction/rebuild и
  erasure↔rebuild в явно зафиксированных harness lock/overlap orders с
  наблюдаемым ожиданием блокировки; знак `↔` обозначает boundary overlap, а не
  обязательность обоих порядков. Последовательная transaction или UI retry этот
  gate не заменяет;
- RLS/ACL/PostgREST postflight проверил recorder, subject, active/revoked observer,
  cross-account/cross-recorder и anon. Safe DTO/AI projection не содержат raw
  UUID/Account IDs, private observation/override notes или evaluator/internal
  policy payloads;
- application history отфильтровывает superseded LearningRecord при
  Run hydration, а rebuild читает полный authoritative evidence set, не
  ограниченный UI history window;
- production apply принял exact tracked checksum и завершился наблюдаемым
  `COMMIT`; snapshot/checksum/counts/backup и deployed functional source
  evidence записаны только после фактической проверки.

Записать измеримые результаты в commit/hand-off, а не только «migration
успешна».

## 9. Rollback

Forward migration по умолчанию не получает автоматический destructive
down-script. Ошибку исправлять следующей forward migration.

V1 recovery из snapshot не является rollback обычной V2 migration. Он
выполняется только по отдельной явной команде и по
[`docs/operations/v1-recovery-runbook.md`](../operations/v1-recovery-runbook.md).
