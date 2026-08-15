# ShiDao V2 — deployment runbook

**Статус:** current production-контур
**Ветка:** `main`
**Web:** один Coolify application
**Database/Auth/Storage:** текущий self-hosted Supabase

Этот runbook описывает обычный V2 release/hotfix. Полное восстановление V1 —
другая операция и выполняется только по
[`v1-recovery-runbook.md`](./v1-recovery-runbook.md).

## 1. Топология

- `shidao.ru`, `www.shidao.ru` — landing-only;
- `v2.shidao.ru` — рабочее приложение и Auth;
- `brand.shidao.ru` — root brand reference;
- `model.shidao.ru` — root public product model;
- `demo.shidao.ru` — отдельный historical UI-прототип с фиктивными данными,
  Guest session, clean-path rewrite и без V2 API/persistence;
- один repository/branch `main`;
- один текущий Coolify application для web;
- один текущий self-hosted Supabase для Postgres/Auth/Storage/SMTP.

V2 deployment не создаёт новый repository или Supabase project.

Current deployed contour закрывает прежний host debt explicit allowlist:
app-routed non-root `brand`/`model`, unknown hosts и mismatched
Host/X-Forwarded-Host получают `421`; unrouteable unknown/deep landing hosts
закрываются edge proxy до app текущим `503`. Unsafe V2 requests принимают только
exact `https://v2.shidao.ru` Origin. Boundary подтверждена exact roleless deploy
и HTTP/browser regression.

## 2. Private operational config

Локальные подключения находятся в ignored project-local files:

```text
.codex/coolify.local.toml
.codex/ssh.local.toml
.codex/ssh-db.local.toml
```

Никогда не печатать их значения, passwords, environment, JWT/API keys или
SMTP credentials в logs/ответ. Не заменять эти подключения глобальным MCP.

## 3. Release gate

Перед push/deploy:

```bash
npm ci
npm run typecheck
npm run lint
npm test
npm run build
npm run test:browser:ci
npm run format:check
git diff --check
```

Для learner-identity release дополнительно обязательны isolated fresh/upgrade
PostgreSQL и multi-session concurrency harnesses:

```bash
./scripts/db-identity-tests.sh
./scripts/db-identity-concurrency-tests.sh
```

Harness должен покрывать signup/bootstrap/reset/claim exactly-one, два Account
на один profile, один Account на два profiles, repeat accept, concurrent merge,
overlapping Group/Course links, finalized same-Run conflict, open/draft blocker
и erasure всей lineage. Простая последовательная SQL transaction не заменяет
multi-session race test.

Provider tests в AI-release используют только fake credentials и локальный
mock. CI/build не получают реальный `ROUTERAI_API_KEY`; если сборка требует
production secret, release останавливается как нарушение server-runtime
boundary.

Исторический teacher-only release `/schedule` и `/students` дополнительно
проверял route guard для Guest, adult без профиля, Parent и transitional
Student, а также desktop/mobile primary navigation. Shell-only release
`fea7f80` не содержал migration. LessonRun release зависит от
`20260806190044_lesson_runs_learning_records.sql`, а Groups/mixed audience — от
следующей forward migration
`20260806220726_learner_groups_mixed_course_audience.sql`; случайное DDL вне
них должно остановить release.

Canonical learner identity release является coupled DB+web change: repository
перестаёт читать teacher ownership/name/archive из `learner_profile`, использует
`teacher_learner`, а LearningRecord требует `recorded_by_account_id`. Release
`757044c` применён после migration
`20260807033034_canonical_learner_profile.sql`; её checksum и postflight
зафиксированы в `docs/project-state.md`. При повторении процедуры migration
должна предшествовать новому web image: старый web нельзя считать автоматически
совместимым с contracted schema после удаления прежних columns.

Release standalone demo обязан проверить root и прямые `/students`, `/courses`,
Course/Lesson deep links, reload без redirect, OG asset, `robots.txt`/noindex и
отказ unsafe methods. Demo source не должен получать imports application
services/Supabase или новую schema.

Обычный `npm run test:browser` может пропустить smoke, если browser недоступен;
он не заменяет строгий release gate.

Worktree должен содержать только изменения текущей задачи. Нельзя включать
чужие локальные правки или `.local-backups`.

## 4. Если release содержит DB migration

### AV1 Account avatars — production DB execution record

Forward migration `20260814050347_account_profile_avatars.sql` применена к
production ShiDao DB с `COMMIT` 14 августа 2026 года. Она является DB-first
expand contract: старый web игнорирует добавленные поля, а зависимый avatar
web/API нельзя разворачивать до успешного postflight.

Production evidence:

- project-local read-only sanity подтвердил PostgreSQL `15.8`, owner
  `supabase_admin`, canonical Account/Course/Lesson/Component и исходные counts
  `19/6/22/84`; пять avatar columns, setter и bucket до apply отсутствовали;
- первая rollback-only rehearsal обнаружила pending event у initially-deferred
  Account/Profile constraint trigger и полностью откатилась. Migration получила
  явный `SET CONSTRAINTS` после backfill; повторная exact rehearsal прошла до
  `NOTIFY` и завершилась `ROLLBACK`;
- final migration SHA-256 —
  `001f6d9161ce53797456e0e886486fce1a9aa9ab13fe1cd769f764b9f2025201`;
- verified full-format backup
  `/root/shidao-db-backups/shidao-before-account-profile-avatars-20260814T054813Z.dump`
  имеет size `1325301`, mode `600`, `1610` restore-list entries и SHA-256
  `2f434b64fffc8a96c4e2cf78e3d2997917f43a500ebfe3991b4f2da3fd4a5838`;
- exact tracked SQL применён owner `supabase_admin` через
  `psql -X -v ON_ERROR_STOP=1`; output завершился `COMMIT`;
- read-only postflight сохранил counts `19/6/22/84`, подтвердил пять validated
  avatar constraints, `19/19` валидных preset Accounts с revision `1`, ноль
  custom objects и сохранённый `account.updated_at` для всех backfilled rows;
- `profile-avatars` приватен, имеет limit `1048576` и allowlist
  `{image/webp}`; browser Storage policies равны `0`;
- setter остаётся `SECURITY DEFINER`, owner `supabase_admin`, пустой
  `search_path`; `EXECUTE` есть только у `postgres/service_role`, у
  `PUBLIC/anon/authenticated` отсутствует. Auth context содержит все пять AV1
  полей;
- штатный read-only snapshot снят в `2026-08-14T05:53:08Z`, strict stage
  `contract`, SHA-256
  `3ca847164526568def44d2deed9a6b1d6cd1742e168462376b4f41fe6383ef97`.

Self-hosted contour по-прежнему не содержит
`supabase_migrations.schema_migrations`; evidence применения — exact tracked
checksum, наблюдаемый `COMMIT` и измеримый postflight. При дефекте использовать
совместимый web rollback или новую forward migration; восстановление backup —
отдельная остановленная операция.

### Unified Profile и Account avatar — production web execution record

Dependent UI/API/routing slice развёрнут exact application commit
`4462da2248dd97bf6ab5c0a35f9a781844473874` 14 августа 2026 года.

- release gate: `640/640` unit/API, `24/24` strict production-mode browser
  scenarios, typecheck, test compile, repository-wide format check и production
  build внутри browser gate;
- Coolify deployment `960` (`mtsryny7vgiyw6622cc6b77l`) завершён
  `2026-08-14T08:18:23Z`; running container
  `g9x4d9zn60jv35r7zf0xl6xj-081541652045` имеет matching image/
  `SOURCE_COMMIT`, image ID
  `sha256:b7ba6d8a0484e0521456dd33c2c027b1f08306ecd7c4db4e43c7d6066f873b43`
  и restart count `0`;
- Guest `/profile`, `/profile?tab=settings` и legacy
  `/learning-profile?tab=settings` вернули `307 → /login`; authenticated
  redirect semantics покрыты strict browser gate, но не выдаются за отдельный
  guest production postflight;
- exact deployed Profile chunk содержит canonical `/profile`, команды
  «Выбрать аватар» и «Загрузить фото»;
- все 20 preset assets отвечают прямым `200 image/webp`, без redirect и без
  участия `/_next/image`; runtime error-log filter по profile/avatar пуст.

При следующем Profile/avatar rollout повторять этот gate вместе с AV1 DB
postflight: новый web не должен ослаблять private Storage, explicit-save modal
flow или compatibility redirects.

### Primary navigation glyph contrast — production postflight

Functional follow-up source `1d4e5deff83cbdc1b479b16e4220cf799327009f`
оставляет прежний moving-pill contract, но задаёт opaque-white isolated
nav-track и убирает отдельный stacking context у nav-list. Публичный production
HTML ссылается на `/_next/static/css/4bc8e9a9d672cadc.css`; этот bundle содержит
`.site-header-nav-track` с `background:#fff` и `isolation:isolate`, а Guest
`/profile` возвращает `307 → /login`. Это bounded public-bundle/HTTP smoke, а
не заявление о separately inspected authenticated session или container
metadata; полный Profile/avatar matching-container record остаётся выше.

### E1 educator Course / attestation — full production execution record

Database, dependent web/API и отдельный Chinese-course bootstrap являются
current production.

Production DB execution, 12 августа 2026 года:

- project-local preflight подтвердил PostgreSQL 15.8, canonical ShiDao
  Account/Course/Lesson/publication objects, A1 head, отсутствие `lesson_step`
  и отсутствие E1 objects до apply;
- initial counts: `19` Account, `5` Course, `16` Lesson, `90` Component,
  `0` publication и `0` revision;
- verified full-format backup
  `/root/shidao-db-backups/shidao-before-educator-attestations-20260812T023442Z.dump`
  имеет size `1158743` bytes, mode `600`, `1441` restore-list entries и
  SHA-256
  `eb7654393262d51642ff5b9cfb24d80df9a55608426ee02a7fb49e0bf9985ab6`;
- exact migration `20260812113000_educator_course_attestations.sql` имеет
  SHA-256
  `f5aa1d3cee3e170f48e3ba2b0b3a564b31ad826b79e61efcaf7f342c3f2ff164`;
- exact rollback probe прошёл; неизменённый tracked SQL применён owner
  `supabase_admin` с `psql -X -v ON_ERROR_STOP=1` и завершился `COMMIT` в
  `2026-08-12T02:35:45Z`;
- postflight сохранил исходные counts, backfilled все `5` Course как
  `children`, подтвердил RLS и closed browser ACL на четырёх новых tables,
  `10` E1 RPC и `8` E1 triggers;
- rollback-only functional probe подтвердил privacy-safe pre-pass projection,
  stale revision с SQLSTATE `40001` и server-derived `9/10 = 90%` atomic
  award; probe rows откатаны, поэтому publication/revision counts остались `0`;
- production schema snapshot сгенерирован в `2026-08-12T02:53:14Z`, SHA-256
  `d96a357a8b55caa80a831b37b7e289c17025c572d79483d28ae7515b30bcf9e2`.

Dependent web execution:

- typecheck, lint, format и build прошли; unit suite `522/522`, strict
  production-mode browser suite `22/22`;
- Coolify deployment exact functional commit
  `28387a9863afeccf4a6ad332dcf0f01048a69e67` завершён; release postflight
  подтвердил exact `SOURCE_COMMIT`, соответствующий image и restart count `0`;
- live host/CSRF/API postflight прошёл.

Production product-data execution:

- отдельный idempotent bootstrap, не входящий в migration, завершился
  `COMMIT` в `2026-08-12T03:10:45Z`; account/auth identifiers в tracked
  evidence не фиксируются;
- финальный read-only DB/RPC postflight: active target `1`, educator Course
  `1`, Lessons/Components/Slides `6/6/6`, authored definition `1`, questions
  `10`, published publication/immutable definition `1/1`, attempts/awards
  `1/1`;
- scoring RPC вывел `9/10 = 90%` при threshold `80%`, `passed=true`;
  authenticated projection показала `certified=true` и раскрыла все `10`
  review keys только после award; профиль содержит одну credential и exact
  Course «Современный урок китайского языка для детей: произношение,
  иероглифика и формирующее оценивание».

При будущем неуспехе web rollback не переписывает применённую migration:
использовать совместимый image rollback или новую forward migration.

### E2 educator governance / self-learning — full production execution record

Forward migration
`20260812150745_educator_course_governance_progress.sql` применена к production
ShiDao DB с `COMMIT` в `2026-08-12T07:34:36Z`. SHA-256 exact migration:
`ccd0ac3a40df305bb43c095733663ca03ff854ae6ffc1cca9e59fd3485ea2c26`.
Dependent E2 web/API также развёрнут и является current production.

Production DB execution evidence, 12 августа 2026 года:

1. Project-local read-only sanity подтвердил canonical ShiDao
   Account/Course/Lesson/publication objects и applied E1 head.
2. До записи создан full-format backup
   `/root/shidao-db-backups/shidao-before-educator-governance-20260812T071511Z.dump`:
   `1 259 425` bytes, mode `600`, `1541` restore-list entries, SHA-256
   `cf8e68638f79c631c714ebed43a17a58ceedb508faa96d4de62a8f414a5a3f98`.
3. Первый rollback-only probe безопасно обнаружил conflict legacy license
   backfill с immutable revision trigger; транзакция полностью откатилась, а
   прежние counts и reuse license сохранились. Исправленный probe v2 прошёл и
   снова сохранил исходные counts/license до production `COMMIT`.
4. Postflight подтвердил `19` Account, `6` Course, одну publication, одну
   revision, одну attempt и один award. Educator publication является official,
   имеет approved revision и одна строка видна в educator catalog.
5. Historical awarded Account получил derived progress `6/6 = 100%` по exact
   approved revision. Аттестация сохранила `90%` при threshold `80%`.
6. Origin/copy, roster, group assignment и LessonRun для educator publication
   отсутствуют. RLS, closed ACL, capability/review/license triggers и
   authenticated progress/attestation RPC прошли postflight.
7. Read-only current-schema refresh завершён в `2026-08-12T07:46:11Z`; SHA-256
   snapshot
   `a34a5a5919ea406050a5c0cb7f39310d1a9e807725e608166f63becb8f2260a4`, все
   `71` schema-contract tests прошли.

Dependent web/API execution evidence:

- exact functional commit и `SOURCE_COMMIT`:
  `22b486a7163453019d9720cb4fe0f36ed7c0228d`;
- Coolify deployment `ikw0bj347reelzotaqo15a39` начался
  `2026-08-12T07:56:00Z` и завершился `2026-08-12T07:58:39Z` со status
  `Success`; duration `2m39s`;
- container `g9x4d9zn60jv35r7zf0xl6xj-075600861579` запущен с image tag exact
  commit и image ID
  `sha256:214e954aed0355c1881ea778e65dcb7f4c4cabcde4d7ac2e3f6022322bd8e027`;
  restart count `0`;
- V2 `/login` и `/robots.txt` вернули `200`; guest `/courses` вернул `307` в
  login;
- landing root вернул `200`, а landing `/login` и `/api/*` — `503`;
- unsafe request без Origin и с wrong Origin вернул `403`; запрос с exact
  `https://v2.shidao.ru` Origin без session дошёл до auth boundary и вернул
  `401`.

Superseded deployed source follow-up:

- exact repository commit и `SOURCE_COMMIT`:
  `0c8946f95ebeb31e02955a110fc057f761f07ea9`;
- running container `g9x4d9zn60jv35r7zf0xl6xj-083519444597` использует
  image tag
  `g9x4d9zn60jv35r7zf0xl6xj:0c8946f95ebeb31e02955a110fc057f761f07ea9`
  и image ID
  `sha256:8119de725edeb042eaf1fcecb38d3fa5052aaf44e81e9fb3965d6c594b1731d1`;
- container имеет status `running`, restart count `0` и started at
  `2026-08-12T08:37:57.909983639Z`;
- повторный HTTP smoke подтвердил V2 `/login` и `/robots.txt` `200`, guest
  `/courses` `307` в `https://v2.shidao.ru/login` и landing root `200`.
- release gate exact source прошёл `560/560` unit/API и `22/22` strict
  production-mode browser scenarios.

Superseded application rollout evidence, 12 августа 2026 года:

- Store release `6135c07` добавил protected `/store`, четвёртый primary nav
  item и client-state cart/checkout без commerce API/schema/migration;
- последующие UI-only commits `aa0fbb6` и `9e66fb5` добавили общий
  table/header/Lesson-authoring polish и fixed-layout Course overflow fix;
- running container `g9x4d9zn60jv35r7zf0xl6xj-115759805389` использует
  exact image tag
  `g9x4d9zn60jv35r7zf0xl6xj:9e66fb548bef176486673149f466b269fd436b21`
  и image ID
  `sha256:8b2eb3609531ba08fca946dde633dc1946821ade3ec1b408be09bafd4ef172d7`;
- container имеет status `running`, restart count `0` и started at
  `2026-08-12T12:00:37.589103216Z`;
- read-only HTTP postflight подтвердил V2 `/login` `200`, `/robots.txt` `200`
  с `Disallow: /` и guest `/store` `307` в `/login`;
- exact deployed source `9e66fb548bef176486673149f466b269fd436b21` повторно
  прошёл `575/575` unit/API, `23/23` strict production-mode browser scenarios,
  typecheck, lint, format и production build. Browser scenarios покрывают authenticated
  catalog/cart/checkout локально; отдельный authenticated production order
  smoke не заявлен, потому что demo не отправляет и не сохраняет заказ.

E2 database, web/API release и HTTP host/CSRF/auth boundaries являются current
production.

При неуспехе dependent web после committed migration не переписывать migration
и не восстанавливать старую E1-схему поверх новых progress данных. Использовать
только заранее проверенный совместимый image rollback либо новую forward
migration.

### Unified Text authored-data migration — production execution record

Exact tracked migration
`20260813063716_unify_heading_rich_text_components.sql` является data-only
cleanup поверх неизменной physical schema. Она переводит каждый authored
`lesson_component.type_key='heading'` в title-only `rich_text` и объединяет
только непосредственно следующий body-only `rich_text`, если совпадают
visibility, `student_slide_id` и placement. Пары с разной teacher/learner
видимостью или Slide остаются двумя `rich_text` Components. Immutable
`course_publication_revision` snapshots не переписываются и продолжают
читаться legacy runtime renderer.

Web-first rollout выполнен полностью:

- release gate exact source `dea92ca2c9af99fd5738e95fa9ca511aa10ca3da`
  прошёл typecheck, lint, format, production build, `581/581` unit/API,
  `23/23` strict production-mode browser scenarios и `72/72`
  schema/migration subset;
- Coolify deployment `xivwq5nkaak141mc0tw5ysce` (`id=943`) создан
  `2026-08-13T06:58:23Z` и завершён `2026-08-13T07:01:09Z`;
- container `g9x4d9zn60jv35r7zf0xl6xj-065823494924` использует matching
  image/`SOURCE_COMMIT`, image ID
  `sha256:f0f07ffd8b18ee5faadff5a1f01d0ea5e663807ec6f83754b16d43b64e18379d`,
  status running, restart count `0`;
- production HTTP postflight: V2 `/login` `200`, guest `/courses` `307` в
  login, landing root `200`, landing `/login` `503`. In-app production session
  была unauthenticated, поэтому authenticated production browser smoke не
  заявляется; functional evidence — exact local strict browser suite `23/23`.

DB execution после подтверждения compatible web:

- read-only ShiDao sanity подтвердил `19` Account, `6` Course, `22` Lesson,
  `96` Components, из них `heading=17`, `rich_text=38`; safe adjacent pairs —
  `11`, remaining headings — `6`;
- verified full-format backup
  `/root/shidao-db-backups/shidao-before-unify-heading-rich-text-20260813T070512Z.dump`
  имеет size `1324116`, mode `600`, `1610` restore entries и SHA-256
  `ee169345af886fd97a3060273b03d20f37dec380a82bbc43eb759e8f098ed775`;
- exact migration SHA-256 —
  `874251c80e2a82bbf79897cb12755d606f9e1b546a9a3f51951dfaae89c5e1a3`;
  `psql` зафиксировал `COMMIT`, maximum `updated_at` преобразованных строк —
  `2026-08-13T07:05:50.169297Z`;
- postflight: `85` Components, `heading=0`, `rich_text=44`, shapes
  `combined=11 / title-only=6 / body-only=27 / invalid=0`; `12` Slides,
  empty Slides `0`, dense-position violations `0`, enabled Component triggers
  `6`. Exact runtime registry parser принял все `85` PostgREST rows;
- publication осталась `1` revision, snapshot bytes `9056`, content hash
  `0c4aa4246c6b5fb0ac4f136c5387496b531ed0988956d45312471feb9268d32e`,
  `6` snapshot Components, все `rich_text`. Physical schema и generated
  `supabase/schema/current-schema.sql` не изменились.

Self-hosted contour не содержит relation
`supabase_migrations.schema_migrations`. Поэтому не заявляется несуществующая
migration-history row: доказательство применения — exact tracked SQL checksum,
наблюдаемый `COMMIT` и измеримый read-only postflight.
Старый image после DB apply не является допустимым rollback target; при дефекте
нужен совместимый forward fix, а восстановление backup возможно только как
отдельный согласованный rollback с остановленной записью.

### Educator Course content-guard ACL hotfix — production execution record

Production symptom: authenticated сохранение Text Component возвращает
`42501 permission denied for function educator_course_author_can_mutate`.
Current E2 `SECURITY INVOKER` trigger guard достигает закрытого helper раньше
audience/capability predicate. Это не требует выдавать browser `EXECUTE` и не
оправдывает перевод guard в `SECURITY DEFINER`.

Applied forward migration:
`20260813113041_fix_educator_course_content_guard_acl.sql`. Она переписывает
только `guard_educator_course_content_mutation()` как invoker function с
inlined predicate, сохраняет `educator_course_author_can_mutate(uuid)` закрытым
для `PUBLIC`/`anon`/`authenticated`, не меняет RLS/table grants и не делает
backfill. Execution evidence:

- migration SHA-256
  `f159188b067bb8a8a6bfe837a3d366a68ab40e42876a79db88dd54d1f01b322f`;
- rehearsal под `supabase_admin` прошла до `NOTIFY`, затем `ROLLBACK`;
- verified backup
  `/root/shidao-db-backups/shidao-before-educator-content-guard-fix-20260813T113940Z.dump`:
  size `1324276`, mode `600`, `1595` restore entries, SHA-256
  `0b3a6c2d9d5100d721ccd1988a8494a4719e9323f2b13838abfc5011148ae6a7`;
- exact migration применена с `COMMIT`;
- postflight `12/12` подтвердил owner/invoker/search-path, closed helper ACL,
  inline predicate, семь enabled triggers и отсутствие policy drift;
- counts Account/Course/Lesson/Component сохранились `19/6/22/85`;
- authenticated educator `rich_text` same-value `UPDATE` прошёл внутри
  rollback, `rollback_verified=true`;
- current snapshot снят `2026-08-13T11:43:48Z`, SHA-256
  `0a6eab37e1bbecc0084e281496346e5436fcbd1ac2b42e102e89951e71ff258e`.

Fix полностью DB-side и вступил в силу для уже запущенного compatible web
image; отдельный Coolify deployment не требовался.

### Course Component contract cleanup

Для exact migration
`20260811154138_remove_divider_components.sql` release является coupled
DB+web contract: production DB cleanup применён 11 августа 2026 года, а
новый registry больше не читает `divider`. До переключения Coolify на
зависимый image старый web продолжает читать Course, но попытка снова
создать `divider` получит CHECK violation. Успешный DB rollout не является
доказательством web deployment.

Порядок выполнения:

1. Через project-local `.codex/ssh-db.local.toml` выполнить read-only sanity:
   проверить canonical таблицы/RPC, отсутствие `lesson_step`, counts
   Component/Slide, `divider`, publication snapshot и плотность positions.
2. Создать timestamped full-format `pg_dump -Fc`; подтвердить nonzero size,
   `pg_restore -l` и SHA-256. Backup не заменяется schema-only snapshot.
3. Остановить rollout, если хотя бы одна immutable publication revision
   содержит `typeKey='divider'`; исторические revisions нельзя переписывать
   неявно.
4. Применить точный tracked SQL через owner `psql -X -v ON_ERROR_STOP=1`.
   Migration сама открывает и завершает transaction; внешний `-1` не добавлять.
5. Postflight должен показать `divider=0`, плотные Component/Slide positions,
   ноль пустых Slides, ноль publication dividers и ноль exactly-one violations;
   Course/Lesson counts сохраняются.
6. Через read-only SSH tunnel запустить `npm run db:snapshot`, проверить полный
   diff и зафиксировать новый SHA-256 snapshot в database docs.
7. Merge/push нового web release выполнить сразу после успешного postflight;
   затем подтвердить exact running `SOURCE_COMMIT`, image, restart count,
   HTTPS/guest/CSRF и authenticated Course Builder smoke.

Production DB execution record, 11 августа 2026 года:

- preflight подтвердил PostgreSQL 15.8, canonical ShiDao identity,
  5 Course, 16 Lesson, 104 Component, 6 Slides, `divider=15` в 12 Lesson/
  4 Course, из них 2 learner-visible; publication divider, non-dense
  Component/Slide positions и exactly-one violations равны `0`;
- verified full-format backup
  `/root/shidao-db-backups/shidao-before-remove-divider-20260811T160822Z.dump`
  имеет size `1146321` bytes, 1427 restore-list entries и SHA-256
  `b82027b25a7c0d96471fe46da07d9795a64c1924ba3e7522368c379755e78449`;
- migration checksum:
  `21791932067f8f45a5ab9fde8d2ef6db08ca661f7489a28f333c8dc52c206bd5`;
- первый запуск под non-owner `postgres` завершился ошибкой и полным
  rollback. Read-only repeat подтвердил неизменные `104/15` и
  прежний CHECK, поэтому эта попытка не считается partial apply;
- read-only owner check подтвердил `supabase_admin`; неизменённый
  tracked SQL под этим owner с `ON_ERROR_STOP` завершился `COMMIT`;
- postflight: 5 Course, 16 Lesson, 89 Component, 6 Slides, `divider=0`,
  publication divider `0`, non-dense Component/Slide positions `0`, empty
  Slides `0`, exactly-one violations `0`;
- active CHECK требует `btrim(type_key) <> ''` и
  `lower(btrim(type_key)) <> 'divider'`;
- production snapshot сгенерирован в `2026-08-11T16:15:55Z`, SHA-256
  `c6da0f149f29be13cb1a4cd0d5e4642e8ce24edc04558b2431e2dbbc4728b23c`;
  diff от предыдущего snapshot ограничен generated timestamp и CHECK.

Зависимый web merge/deploy позже вошёл в production release PR #242; exact
running-image/HTTP evidence зафиксирован в A1 record ниже.

### A1 atomic Course archive — production execution record

Exact migration `20260811231505_atomic_course_archive.sql`, SHA-256
`7b43b023dd7692a39c1ab3702f0972c5d2252766a1093c3905b8c80fce24e8f8`,
применена к production с `COMMIT` 12 августа 2026 года. Database half этого
DB+web contract current; зависимый web вызывает `archive_course` и также
развёрнут production release PR #242.

Production evidence:

- verified full-format backup
  `/root/shidao-db-backups/shidao-before-atomic-course-archive-20260811T233315Z.dump`
  имеет size `1146274` bytes, mode `600`, `1427` restore-list entries и
  SHA-256
  `86610eac53eee82ddba0943247876f77c16ec52c076ca1f93945d64bd4900812`;
- неизменённый tracked SQL завершился `COMMIT`; exact postflight и rollback
  probe прошли успешно;
- counts не изменились: `5` active и `0` archived Course, `16` Lessons,
  `90` Components, `6` Slides, `2` attachments/files, `2` Runs/records,
  `0` publications/revisions; invalid invariants — `0`;
- postflight подтвердил owner-matched `SECURITY DEFINER` RPC с закрытым ACL,
  четыре enabled guard triggers, private owner-matched touch-helper и exact
  column-only Course/Lesson UPDATE grants без table-level UPDATE/DELETE;
- PostgREST видит RPC, anonymous HTTP-вызов закрыт с `401` / `42501`;
- штатный live snapshot снят в `2026-08-12T00:22:27Z`, SHA-256
  `055b3c3ab47afc3c3db86d92c6c7530b3735841e34e4b475101ac96056d853ec`.

Web rollout evidence:

- PR #242 merged в `main` exact commit
  `84ffefecda99d3b0a9da82bf1eaf8ce76d9c6ea1`;
- Coolify deployment `l56b73xj6mfblc0ni8u7yf2g` для application
  `g9x4d9zn60jv35r7zf0xl6xj` создан в `2026-08-12 00:34:51Z` и завершён в
  `00:38:42Z`; trigger metadata: `pull_request_id=0`, `webhook=true`,
  `api=false`;
- exact image и `SOURCE_COMMIT` совпадают с merge commit; image ID —
  `sha256:e4a22e34c1ed1bd8b37db8087b6bbafac693414ea357798e3ddf75e3c3684d57`;
  container running, restart count `0`, второго active production deployment
  нет;
- V2 `/login` и `/robots.txt` вернули `200`, Guest `/courses` — `307` на
  login; landing root — `200`, landing `/login` и API — `503`; demo root и
  `/students` — `200`; brand/model deep route — `421`;
- Guest `DELETE` fake Course UUID вернул `403` без Origin, `403` с неверным
  Origin и `401` с exact V2 Origin: CSRF-before-auth boundary подтверждён без
  Course mutation;
- `X-Robots-Tag` равен `noindex, nofollow, noarchive`; release error-log filter
  пуст.

При будущем неуспехе совместимого web rollout не откатывать migration
разрушительно: исправлять новой forward change или возвращать web, использующий
RPC.

Web с Groups/mixed audience нельзя выпускать раньше последовательного успешного
применения `20260806190044_lesson_runs_learning_records.sql` и
`20260806220726_learner_groups_mixed_course_audience.sql`: students/audience
routes вызывают новые aggregate RPC и читают новые group tables.

Для canonical learner identity поверх этого baseline дополнительно обязательны:

- 1:1 backfill `teacher_learner` для каждого существующего LearnerProfile без
  дедупликации и без заполнения `learner_profile.account_id`;
- полный backfill `learning_record.recorded_by_account_id` до `NOT NULL`;
- сохранность Course/group links, draft/finalized records и teacher-local names;
- FK/trigger contract: subject Account delete sets `account_id` NULL, canonical
  profile/recorder hard delete is restricted by history, recorder mutation
  rejected;
- RLS/ACL negative probes для второго Account: canonical profile не становится
  общедоступным, relation/history другого recorder возвращают ноль rows; linked
  subject видит только свою canonical row и по-прежнему не видит records;
- PostgREST schema reload и проверка новых relation/table/RPC return shapes;
- согласованный rollout web, который читает teacher directory projection.

Current learner-identity rollout использует exact files:

```text
M1 20260807065017_identity_security_hardening.sql
M2 20260807065026_learner_identity_primitives_backfill_invariant.sql
M3 20260807065032_learner_identity_workflows_progress_observer_ai.sql
M4 20260807065038_learner_identity_legacy_contract_cleanup.sql
M5 20260809084500_learner_identity_auth_deferred_invariant_security.sql
M6 20260809090000_learner_identity_provisional_auth_metadata_sync.sql
```

M1–M3 применяются одним протестированным expand set после backup. M4 физически
не удаляет legacy rows/tables, но завершает cutover: удаляет helpers/types/
grants и rollback-only `user_security` dual-write dependency из поддерживаемых
Account RPC. Поэтому он withheld из первого commit/deploy. M5 и M6 являются
последовательными forward security fixes поверх post-M4 contract: M5 закрывает
real-GoTrue deferred invariant boundary, M6 обрабатывает двухфазную запись
trusted provisional `app_metadata`, не разрешая post-commit
`active -> provisional` downgrade. Каждый этап обязан дополнительно подтвердить:

- actor matrix `anon / teacher A / teacher B / subject / active observer /
revoked observer / outsider`;
- отсутствие Account/email enumeration и raw invitation tokens в DB/logs;
- claim invitations recipient-bound; share code создаёт pending request, а не
  active relation;
- merge с open/running Run или draft record fail closed и оставляет их без
  изменений; после явного завершения/отмены сохраняются counts,
  recorder/timestamps и group/Course links;
- migration не публикует historical `teacher_comment`: subject/observer читают
  только learner-safe projection и explicit `shared_with_learner_at`;
- historical/scheduled-fallback timestamps не backfill в
  `actual_duration_minutes`; unknown остаётся `NULL`, а positive test покрывает
  explicit start и explicit post-factum duration;
- немедленный revoke observer/AI consent по DB-state;
- erasure всей lineage удаляет aliases/PII linkage и не резолвит старый UUID в
  новый пустой profile;
- отсутствие foreign raw LearningRecord в teacher browser/API;
- Auth/session/onboarding regression до удаления active role dependencies.

Phased rollout для этого exact migration set:

1. read-only production identity/schema sanity; подтвердить ShiDao tables и
   текущий migration head;
2. timestamped full-format backup; проверить nonzero size, `pg_restore --list`
   и SHA-256;
3. применить exact M1–M3 owner connection с `ON_ERROR_STOP`;
4. DB/RLS/ACL/PostgREST postflight, включая
   `active_accounts_without_exactly_one_profile = 0`;
5. refresh `expand` snapshot через `scripts/refresh-schema-snapshot.sh`;
6. push/deploy exact roleless web SHA A, дождаться health и подтвердить running
   container/image SHA;
7. push/deploy второй exact roleless SHA B и повторить postflight, чтобы
   допустимый rollback image тоже был roleless;
8. выполнить read-only dependency audit всех 23 удаляемых helpers, 13 policies,
   двух enums и legacy grants;
9. только затем применить exact M4 `DROP ... RESTRICT` contract;
10. сделать отдельный verified backup и применить exact M5; проверить deferred
    function owner/search-path/ACL boundary и реальный GoTrue commit;
11. сделать новый verified backup и применить exact M6; проверить точную форму
    Auth UPDATE trigger, pristine/xmin guard, ACL/RLS и trusted mismatch count;
12. выполнить disposable real GoTrue Admin create/delete probe и доказать нулевой
    остаток Auth/Account/bootstrap Profile fixtures;
13. refresh финального `contract` snapshot, затем push/deploy final exact web SHA
    и повторить DB/API/HTTP/authenticated browser postflight.

Production execution log, 9 августа 2026 года (current M6 stage):

- read-only sanity подтвердил ShiDao tables, PostgreSQL 15.8 и owner
  `supabase_admin`;
- full-format backup
  `/root/shidao-db-backups/shidao-before-learner-identity-20260809T081005Z.dump`
  проверен: size `671605`, 1014 restore-list entries и SHA-256
  `3974af7cffd2c5e7e62d872be5923ccf64638640d56160a947a2d68011e70ae7`;
- exact M1–M3 применены, strict signature вернула `shidao-v2-expand`, exactly-one
  postflight вернул `0` нарушений;
- Coolify завершил первый roleless deployment exact SHA
  `5944d31f86f7d3795ec9f17928cb311ecbdfdd21`;
- Coolify завершил второй roleless deployment exact SHA
  `5d650a390abcc944780a716f909248f5493c10a9`; оба roleless images сохранены;
- read-only dependency audit подтвердил полный expected set и ноль внешних
  dependencies;
- pre-contract backup
  `/root/shidao-db-backups/shidao-before-identity-contract-20260809T082938Z.dump`
  имеет size `883168`, 1041 restore-list entries и SHA-256
  `257d6a6f4a102e630ca9d6321c86beb67b1cea0befa7049865a8bfb4e511b0b4`;
- exact M4 применена одной транзакцией; strict signature вернула
  `shidao-v2-contract`, PostgREST cache подтвердил новые и удаление legacy RPC;
- verified pre-M5 full-format backup
  `/root/shidao-db-backups/shidao-before-auth-deferred-invariant-fix-20260809T085613Z.dump`
  (local mirror
  `/Users/user/Documents/shidao/.local-backups/shidao-before-auth-deferred-invariant-fix-20260809T085613Z.dump`)
  имеет size `858088`, 1003 restore-list entries и SHA-256
  `a0c67c77cfc5d819678d4682dd340e4ed052cefcf4d4d4a985758b34d7894dcc`;
- exact M5 checksum
  `126e412c3949a8e649638522e52e1d98288c7b779b3fbc13dcd2747d9aa31e7c`
  применена одной транзакцией. Postflight подтвердил `SECURITY DEFINER`, пустой
  `search_path`, корректного owner, две привязки deferred constraint triggers и
  отсутствие execute у browser/service/Auth roles;
- real GoTrue Admin create после M5 успешно прошёл deferred exactly-one commit.
  Наблюдение, что GoTrue записывает caller `app_metadata` отдельным UPDATE после
  INSERT и bootstrap Account остаётся `active`, стало основанием для узкого M6,
  а не для расширения Auth privileges или ослабления invariant;
- verified pre-M6 full-format backup
  `/root/shidao-db-backups/shidao-before-provisional-auth-sync-20260809T093520Z.dump`
  (local mirror
  `/Users/user/Documents/shidao/.local-backups/shidao-before-provisional-auth-sync-20260809T093520Z.dump`)
  имеет size `1013144`, 1339 restore-list entries и SHA-256
  `f56df63680abbc10b1b0eafa686800a7a2cddd34430185d566462d38ce04be41`;
- exact M6 checksum
  `133dafcea4ff4f54bfeb3e58bb7eb2bf98947b79d422ab44f7e90a6430ecaada`
  применена одной транзакцией. Postflight подтвердил enabled row-level
  `AFTER UPDATE OF raw_app_meta_data` trigger с key-change predicate,
  `SECURITY DEFINER`/empty-search-path owner boundary, закрытый ACL,
  pristine/same-creation-`xmin` guard, ноль trusted active/provisional
  mismatches и exactly-one count `0`;
- реальный GoTrue Admin create с strict internal learner email, explicit
  `identity_status=provisional`, `activation_invitation_id` и live
  child-activation invitation успешно создал
  `provisional` Account с одним bootstrap Profile. Auth Admin delete затем
  удалил disposable Auth/Account/Profile fixture; post-cleanup counts равны `0`;
- финальный проверенный post-M6 production snapshot SHA-256:
  `584ebb96dc8d96f1eb508e7eae836edb8125a9fefe2a59e9cb362af54bba5a26`;
- Coolify deployment `887` exact functional SHA
  `01aa88a042ad38d744c6f33a44bc216c91815e59` завершился `finished`; running
  container имеет совпадающий image tag и `SOURCE_COMMIT`, image digest
  `sha256:cf8b6400187d880ab6c6f73a9af037b92cb476b09dd4832e6fd52ea13a132389`,
  restart count `0`, HTTPS `200`;
- navigation/catalog deployment `889` exact SHA
  `bafc984d0bc7bfb6cb795170a09ba2aabfb98441` завершился `finished`; running
  container имеет совпадающий image tag и `SOURCE_COMMIT`, image digest
  `sha256:06e273096fcf2f385782aeb6e1552235e1ac516b2a9dfd45f65f6f9a056b02cd`,
  restart count `0`, HTTPS `200`; DB/API/schema этот follow-up не менял;
- Course publication deployment `891` exact functional SHA
  `9a553085487c8fd514cc716f5beec5eab3324af3` завершился `finished`; running
  container имеет совпадающий image tag и `SOURCE_COMMIT`, image digest
  `sha256:ad6274440d57972420978cd26a9fb46ee2063235f5a435d9be32f9f5a0f4c457`,
  restart count `0`. Перед deploy migration
  `20260810035033_course_publication_catalog.sql` применена после full-format
  backup; HTTP postflight сохранил landing/demo/guest/CSRF boundaries и не
  обнаружил runtime warning/error;
- System Assistant exact functional SHA
  `8912dac0def7c2ba67bb4eeb240c52bfd0a55192` автоматически подхвачен после
  push `main`; Coolify завершил rolling update со статусом `Finished`. Running
  container имеет совпадающие image tag и `SOURCE_COMMIT`, image digest
  `sha256:5c6870c2513ea4075664026207db9b80db9fbdefd89e419a96ddbda38b4c2bb9`,
  restart count `0`. `/login` и `robots.txt` отвечают `200`, guest `/courses`
  перенаправляется в `/login`, оба новых assistant POST routes без Account
  session возвращают `401`; authenticated provider/action smoke не выполнялся;
- System Assistant clarification fix exact SHA
  `b7c6cfe73809d2006d7fb4fafc833a93a905f4af` автоматически подхвачен webhook;
  deployment `nl5p1nuxnvdi392vwfopmab2` завершился `Success` за 2 мин 31 с.
  Running container имеет совпадающие image tag и `SOURCE_COMMIT`, image digest
  `sha256:42e0767f3848f6d61322b893edf528c79fab9c2e450de0fa303231202f61d8e8`,
  restart count `0`. `/login` и `robots.txt` отвечают `200`, guest `/courses`
  возвращает redirect, оба assistant POST routes без Account session — `401`;
  real RouterAI no-write smoke с synthetic current Course подтвердил
  clarification → follow-up proposal без mutation;
- authenticated browser postflight прошёл roleless courses/schedule/students,
  self-profile, observer и settings surfaces без console errors. Disposable
  Account удалён после dependency audit: fixture counts `0/0/0`, production
  Auth/Account/Profile counts `19/19/20`, exactly-one и trusted mismatch counts
  `0`; stale session перенаправлена на `/login`;
- host/CSRF postflight: app-level non-root brand/model routes закрыты `421`,
  unrouteable unknown/deep landing hosts закрыты edge proxy до app (`503`),
  cross-subdomain/missing Origin отклонены `403`, same-origin malformed request
  дошёл до application validation `400`.

Snapshot helper auto-detects only two complete states. `expand` requires every
M1–M3 identity object/invariant plus полный known compatibility helper/type/ACL
set. Обе допустимые signature требуют M5/M6 Auth hardening; `contract`
дополнительно требует полное отсутствие M4 targets. Частично применённый
cleanup или Auth hardening отклоняется. Current `contract` также требует C1,
D1, A1, E1 и E2 invariants, включая exact review/progress/official-license
shape, no-copy educator guards и current E2 wrapper signatures; наличие только
исторических C1 RPC не считается достаточным.

Для каждого stage фиксируются commit SHA, migration set и production postflight.
Нельзя оставлять старый Coolify image как rollback-кандидат после применения
несовместимой contract migration.

Полный terminal condition:
[`LEARNER_IDENTITY_COMPLETION_PROMPT.md`](../v2/LEARNER_IDENTITY_COMPLETION_PROMPT.md).

Порядок строгий:

1. прочитать current schema snapshots;
2. выполнить read-only ShiDao sanity check;
3. проверить backup/impact и migration SQL;
4. применить forward migration к целевой ShiDao DB;
5. выполнить migration postflight, RLS/ACL и representative user-JWT tests;
6. подтвердить PostgREST schema cache/relationships;
7. только затем выпускать web, который зависит от новой shape.

После M4 нельзя откатывать web на legacy-role image. При ошибке остановить
rollout и доставить совместимый forward fix; применённые migration files не
редактировать.

Полная политика:
[`docs/database/migration-guidelines.md`](../database/migration-guidelines.md).

Если migration не прошла, web с зависимостью от неё не разворачивается.

## 5. Web deployment

### Student Screen component toggle — production execution record

UI-only rollout выполнен без DB migration и изменения API shape:

- exact functional source `288fac3d7ab909cab0e26bffb6a0c156f9e12d81`
  прошёл typecheck, lint, format, `585/585` unit/API и `23/23` strict
  production-mode browser scenarios;
- Coolify deployment `jf5f0j9yp1cwkkf2880d65f4` (`id=945`) создан
  `2026-08-13T07:54:17Z` и завершён `2026-08-13T07:56:55Z`;
- container `g9x4d9zn60jv35r7zf0xl6xj-075417820319` использует matching image tag и
  `SOURCE_COMMIT`, image ID
  `sha256:ede707702a94192ddce00f8830f4b79bcfa4eb77d6c2b43f397db5b0476b0587`,
  status running, restart count `0`;
- production HTTP postflight: V2 `/login` `200`, guest `/courses` `307` в
  `https://v2.shidao.ru/login`, landing root `200`, landing `/login` `503`.
  Authenticated production browser session отдельно не заявляется; functional
  evidence — exact local strict browser suite `23/23`.

1. Сделать небольшой законченный commit в `main`.
2. Push exact commit в `origin/main`.
3. Запустить deployment существующего Coolify application через
   project-local operational access.
4. Дождаться завершения build и health check.
5. На web host подтвердить, что running image/container относится к точному
   commit SHA, а не только имеет статус `running`.
6. Не менять environment и домены, если release этого явно не требует.

Конкретные credentials и server addresses намеренно не записываются в repo.

## 6. Application environment

Required, без значений/secrets:

```text
NEXT_PUBLIC_SITE_URL
NEXT_PUBLIC_APP_URL
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
APP_SESSION_SECRET
```

Optional, но рекомендуется явно закрепить в production:

```text
APP_SESSION_VERSION=1
APP_SESSION_TTL_HOURS=48
```

Для включения AI-поверхностей обязателен отдельный server-only secret:

```text
ROUTERAI_API_KEY
```

Optional RouterAI config с текущими defaults приложения:

```text
ROUTERAI_MODEL=google/gemini-2.5-flash-lite
ROUTERAI_BASE_URL=https://routerai.ru/api/v1
ROUTERAI_TIMEOUT_MS=300000
```

Обе optional app-session переменные имеют эти defaults в коде. Явный
`APP_SESSION_VERSION` нужен для управляемой глобальной invalidation, а явный
TTL не позволяет незаметно зависеть от смены default.

- `NEXT_PUBLIC_SITE_URL` описывает landing/canonical public URL.
- `NEXT_PUBLIC_APP_URL` должен указывать на `https://v2.shidao.ru` и имеет
  приоритет для Auth callback. Этот же app URL является configured origin для
  unsafe V2 requests; landing URL не должен попадать в этот allowlist.
- Любая `NEXT_PUBLIC_*` переменная доступна browser bundle; secret key туда не
  помещается.
- `NEXT_PUBLIC_*` должны быть доступны на build stage. Их изменение требует
  нового build/redeploy; runtime-only смена environment не переписывает уже
  inlined client bundle.
- Все `ROUTERAI_*` читаются только Node.js server runtime. Их нельзя добавлять
  с префиксом `NEXT_PUBLIC_`, передавать через Docker build arguments или
  включать в client config.
- `ROUTERAI_API_KEY` не нужен build stage. После его изменения нужен новый
  runtime container/redeploy, чтобы процесс получил новую environment.
- Production `ROUTERAI_BASE_URL` должен оставаться HTTPS URL без credentials,
  query и fragment. Модель и timeout можно менять отдельно от ключа.

SMTP/GoTrue переменные настраиваются в Supabase environment, а не в Next.js.

### RouterAI secret в Coolify

На текущем production-контуре `ROUTERAI_API_KEY` уже подключён как
server-only runtime secret, а AI routes/UI и default
`google/gemini-2.5-flash-lite` проверены в release `0276aed`. Значение secret не
проверяется выводом и не хранится в repository.

Первичная настройка выполняется только в environment editor существующего
ShiDao V2 application:

1. Для active production использовать отдельный ключ RouterAI только как locked
   runtime secret. Временный demo key в production не использовать; любой ключ,
   попавший в чат, issue, screenshot, shell history или открытый log,
   немедленно ротировать.
2. Добавить `ROUTERAI_API_KEY` в Coolify как masked/secret runtime variable.
   Не включать её как build variable и не сохранять значение в repository,
   Dockerfile, `.env.example` или operational runbook.
3. Явно закрепить `ROUTERAI_MODEL`, а при необходимости также base URL и
   timeout. Эти значения не являются credentials, но должны соответствовать
   проверенному release.
4. Сохранить environment и redeploy существующего application. Не создавать
   новый Coolify app и не менять домены, Supabase или Auth environment.
5. В terminal нового container проверить только наличие переменной, не её
   значение:

   ```bash
   node -e 'process.exit(process.env.ROUTERAI_API_KEY ? 0 : 1)'
   ```

   Команда при успехе ничего не печатает. Не использовать `env`, `printenv`,
   `docker inspect ...Config.Env`, `curl -v` или другие команды, выводящие
   credentials.

Плановая ротация без признаков компрометации:

1. создать новый RouterAI key;
2. заменить masked secret в Coolify и поднять новый runtime container;
3. пройти AI smoke ниже и сверить usage в RouterAI;
4. только после успешной проверки отозвать прежний ключ.

При раскрытии старый ключ отзывается сразу, до deploy. Если новый ключ не
проходит smoke, выпуск остаётся на ручном Course Builder; раскрытый или уже
отозванный ключ не возвращается ради rollback.

## 7. Smoke после deploy

### Host boundary

- `https://shidao.ru/` → landing;
- `https://shidao.ru/login` → maintenance 503;
- `https://shidao.ru/api/...` → JSON 503;
- `https://v2.shidao.ru/robots.txt` запрещает indexing;
- V2 responses имеют `X-Robots-Tag`;
- unknown Host и non-root `brand.shidao.ru`/`model.shidao.ru` получают 421;
- несовпадающие Host/X-Forwarded-Host получают 421;
- unsafe request с landing/cross-site/missing Origin отклоняется, exact
  `https://v2.shidao.ru` Origin проходит до route authorization;
- `https://demo.shidao.ru/` открывает прежний standalone UI без redirect;
- demo navigation ведёт на clean `/students`, `/courses` и Course/Lesson paths,
  а прямое открытие/reload этих URL остаётся внутри demo;
- demo responses и `robots.txt` запрещают indexing, `/og-demo-v2.png` имеет
  image content type, unsafe request получает 405;
- demo не читает V2 session/data и не отправляет API/Supabase requests.
- В браузере, ранее видевшем permanent `308`, один раз открыть
  `https://demo.shidao.ru/?restored=1`: response очищает cache origin, после
  hydration адрес становится `/`, а повторное открытие root не редиректит.

### Auth

- login page открывается;
- существующий пользователь входит;
- post-login route — `/courses` или safe relative `next`; permanent role
  selection отсутствует;
- signup/confirm/recovery проверяются при изменении Auth flow;
- секреты и токены не появляются в client/logs.

### Course Builder

- `/courses` читает реальные данные;
- `/courses`, Course и Lesson показывают одинаковые computed H1/optional metric
  через один `AppPageHeader`: H1 не крупнее 48 px на desktop и 32 px
  на mobile; искусственного `min-height` нет, высоту задают фактические
  title/metric/meta/actions и block padding. Actions вертикально центрированы,
  занимают только ширину содержимого и оставляют всю свободную ширину heading
  и H1; desktop gap между heading и actions равен 24 px. Асинхронная metric
  резервирует одну строку до ответа, но H1, metric, meta и actions впервые
  становятся видимыми вместе без изменения геометрии header. На 1120
  px Lesson с одной primary и одним square overflow складывается без document overflow,
  непрерывные title/metric переносятся, а back-label остаётся в одной
  строке и обрезается ellipsis;
  metric, когда она существует, получает один computed-цвет
  `oklch(0.19 0 0 / 0.6)` из canonical
  `--app-page-header-description-color`;
  Course/Lesson сохраняют backlink: link/button, стрелка, normal/hover/focus
  имеют computed `rgb(20, 20, 20)`, стрелка не сжимается, а расстояние от
  верхней границы page header до backlink совпадает с расстоянием от backlink
  до heading (`20 px` desktop, `16 px` mobile);
- на Schedule/Students/Courses shared `ProductTableHead` имеет computed white
  background, а row dividers используют один
  `--product-table-divider-color`;
- Course, Lesson и остальные active-product `WorkspaceTabs` используют
  edge-to-edge baseline 1.2 px цвета `oklch(0.19 0 0 / 0.4)` без внешнего
  inline-inset и квадратный чёрный active segment 4 px без radius. Inactive
  label и 16 px иконка имеют цвет `oklch(0.19 0 0 / 0.6)`, gap между tab-кнопками и верхний radius
  равны 12 px; светлый hover не перекрывает baseline. Каждый tab имеет 16 px
  иконку. Только positive numeric count показан маленьким приподнятым `sup` с
  weight 500, а ноль не рендерится; каждый `aria-controls` tab разрешается в matching
  `tabpanel` с обратным `aria-labelledby`, а на mobile вкладки скроллятся
  внутри strip без document overflow. При смене вкладки один общий indicator
  плавно меняет measured `left/width`, а active panel мягко проявляется в
  направлении выбора; после rapid clicks indicator точно совпадает с active
  tab. При reduced motion indicator и panel меняются мгновенно;
- при primary navigation `Расписание → Ученики → Курсы → Магазин` old page
  header уходит влево с fade, new приходит справа; обратное движение зеркально.
  Открытие Course/Lesson — forward, backlink — back. Проверить именованный
  `app-page-header` View Transition, отсутствие root cross-fade/layout shift и
  промежуточных Course loading-cards. Native named View Transition должен быть
  только у `app-page-header`: primary-nav pill не имеет собственного
  `view-transition-name`. Каждый click должен синхронно dispatch-ить route
  navigation, пока один локальный чёрный indicator параллельно за `180 ms`
  перемещает `width/transform` к выбранному link; pill motion не должен
  gate-ить routing. Серый ghost, второй чёрный слой и snapshot-scale
  отсутствуют. Glyphs визуально остаются `#000` вне pill и `#fff` внутри даже
  во время motion.
  Проверить computed `background: rgb(255, 255, 255)` и `isolation: isolate` у
  nav-track, `z-index: auto` у nav-list и фактические тёмные пиксели inactive
  glyphs. С задержанным RSC/data response быстро нажать два-три разных primary
  links: каждый click должен отправить navigation синхронно, следующий intent —
  немедленно перецелить pill и supersede-ить предыдущий pre-commit/pending
  route. После завершения всех задержанных response только последний intent
  может commit-ить URL; active link и pill обязаны совпасть с ним, а stale
  response не должен кратко вернуть промежуточный route. В течение pill
  motion/load links и keyboard focus остаются рабочими, cursor не меняется на
  wait, а pointer-blocking overlay/disabled navigation не появляется.
  Зафиксировать, что async route load и ожидание ready header не находятся
  внутри native `document.startViewTransition`; native named element
  `app-page-header` используется только для синхронного update, а committed
  route получает interruptible CSS entrance. Superseded observer/entrance не
  должен срабатывать позже. При `prefers-reduced-motion: reduce` pill меняется
  без перехода, route dispatch остаётся синхронным, а page-header transition
  также отключён;
- на сохранённом Course открыть **Уроки** и проверить, что общий `WorkspaceTabs`
  не получил route-specific fork. Сразу под ним прозрачная toolbar поиска и
  «Добавить урок» занимает всю content-row: computed horizontal padding `0`,
  search начинается у левого края, action заканчивается у правого. Таблица имеет
  видимые `№ / Урок / План / Экран ученика / Проведение / Обновлён` и пустой
  action heading; wrapper белый, имеет общий product border,
  `background-clip: padding-box`, статическую raised-surface тень и radius
  12 px, header/data rows
  ровно 40 px, обычные cells имеют 12 px с обеих сторон, последняя action-cell —
  4 px. Белый header и data rows используют один divider color. Каждый из шести
  data headers при первом клике публикует `aria-sort="ascending"`, при повторном
  — `descending`; initial load и reload начинают с `№`/`position ASC`, а
  view-sort не отправляет mutation и не меняет authored order. Проверить поиск
  по title/summary, filtered-empty и «Очистить поиск». Для Lesson без открытого
  Run, но с completed history, проверить «Проводился ранее»; после изменения
  сохранившегося Component или Student Slide колонка `Обновлён` должна
  отражать newest child timestamp, а не только timestamp родительского Lesson;
- в каждой Course Lesson row проверить единственный постоянно доступный
  `MoreVertical` trigger 32 × 32 px с радиусом 8 px. Portal-menu не обрезается
  table scroll wrapper и содержит ровно два действия: «Открыть урок» и одно
  контекстное действие проведения (`Назначить урок`, `Изменить назначение`,
  `Отметить результаты` или `Завершить урок`). Delete/destructive item нет.
  Открытие Lesson и возврат восстанавливают focus на title-button; scheduling
  item открывает существующий LessonRun dialog и не выбирает Lesson. На 375 и
  320 px table overflow остаётся внутри wrapper, toolbar складывается без
  document-level overflow. Старые карточные `workspace-lesson-*` rows не должны
  присутствовать;
- после открытия Lesson supporting line содержит только counts Components,
  Slides и завершённых Runs, но не `lesson.summary`. В child Course видима одна
  primary кнопка проведения и справа один `MoreVertical` 40 × 40 px; menu
  содержит «Дополнить с ИИ / Настройки урока / Удалить», причём delete остаётся
  destructive и требует confirmation. Для educator Course primary — AI, menu
  содержит settings/delete. Arrow/Home/End/Escape и возврат focus к trigger
  после dialog обязательны;
- owner открывает Course, другой owner не может;
- Lesson/Components загружаются;
- private Component отсутствует в Student Screen;
- fullscreen preview открывается;
- reload сохраняет данные;
- signed attachment открывается только при разрешённом ownership/projection.

### RouterAI и AI-поверхности

- войти на `v2.shidao.ru` как Account-владелец Course и открыть `/courses/new`;
- на disposable Course выбрать «Создать с ИИ» и получить preview программы с
  ожидаемым числом Lessons, configured model и ненулевым token usage;
- подтвердить preview, открыть Course и после reload увидеть ту же persisted
  последовательность Lessons без дублей;
- создать или дополнить один Lesson через «Заполнить с помощью ИИ»: сначала
  проверить preview, затем применить и после reload увидеть Components;
- подтвердить, что AI Components созданы `staff_only` и не попали на Student
  Screen без явного назначения преподавателем;
- открыть global «ИИ» в правом нижнем углу защищённой страницы, проверить
  корректный context chip, отправить один безопасный вопрос и получить ответ с
  token usage;
- внутри disposable Course отправить «Добавь новый урок» без названия:
  assistant должен спросить только название, не показать ошибку/action card и
  не изменить число Lessons; ответить названием и проверить, что появился
  proposal, но до explicit Apply число Lessons всё ещё не изменилось;
- запросить создание disposable Course draft или пустой Lesson, убедиться, что
  до клика по action card данные не изменились, затем явно подтвердить и после
  reload проверить ровно один созданный объект и рабочую result-ссылку;
- AI-вызовы в browser Network должны идти только в same-origin `/api/v2/...`:
  RouterAI URL, Authorization header и API key не появляются в browser bundle,
  request или console;
- содержимое attachments не отправляется провайдеру и UI не утверждает, что
  файл проанализирован, пока parsing/RAG отдельно не реализован;
- не исчерпывать production rate limit намеренно: timeout/rate-limit paths
  покрываются release tests; если ошибка возникает в smoke, ручное
  редактирование остаётся доступно, а preview не применяется повторно;
- при наличии второго test owner подтвердить, что чужой Course недоступен и
  rejected request не создаёт новый RouterAI usage;
- в web logs допускается только ограниченная audit metadata: operation,
  actor/Course/Lesson IDs, provider/request ID, model и token usage. Не выводить
  совпавшие строки при secret scan; проверять только факт отсутствия API keys,
  Authorization/Cookie, full prompts и private payloads;
- в RouterAI dashboard сверить, что smoke создал ожидаемые запросы/usage и не
  вызвал неожиданный всплеск расхода.

После smoke disposable Course убирать только через обычный подтверждённый UI.
Проверить, что действие является soft archive: Course исчезает из active list,
но Lessons, attachments, Runs и LearningRecords не удаляются физически.
Published Course должен вернуть `409 course_is_published` до явного unpublish,
а Course с открытым Run — `409 course_has_open_lesson_runs` до завершения или
отмены занятия. Проверить, что application вызывает одну user-JWT RPC
`archive_course`, а не publication/open-run preflight-read плюс direct PATCH:
RPC атомарно проверяет active ownership и оба conflict-условия вместе с
установкой `archived_at`; A1 reverse guards сериализуют archive, publish и open
Run на одной Course row. Database contract и UI/API route deployed/current в
PR #242. Release postflight проверил CSRF/auth boundary на fake UUID без
mutation; он не выдаётся за authenticated owner archive smoke. Не трактовать
flow как permanent delete.

### Roleless navigation and learner identity

- любой authenticated Account видит четыре primary items: `Расписание`,
  `Ученики`, `Курсы`, `Магазин`; для current production проверить Account
  menu в порядке `Профиль`, `История`, `Аттестация`, `Наблюдатели`, `Настройки`,
  `Выход`. Guest на
  каждом private route уходит в login;
- `/store` открывает каталог, category tabs/search/custom product sort и оба
  вида; отдельной кнопки «Фильтры» и audience/price/availability predicates
  нет. Sort trigger не является native `select`; cart →
  delivery → payment-demo → success работает без unsafe network request,
  банковских полей или утверждения о созданном заказе. На 375 px нет
  document-level overflow; Guest `/store` уходит в login;
- `/schedule`, `/students`, `/store` и `/courses` сохраняют единый computed
  page-header contract с Course и Lesson; contextual actions находятся в header, а
  date/view controls — ниже него справа прямо на page background без внешней
  toolbar-card. У прозрачных Schedule, Students и обеих Courses controls-панелей проверить
  нулевой horizontal padding: controls остаются в пределах content-row, а
  крайний control совпадает с его внешней границей. Для Schedule
  проверить, что отдельного внешнего «Неделя /
  Месяц» нет: центральная кнопка compact date control открывает календарный
  popover с «День / Неделя / Месяц», выбор даты меняет опорную дату, а стрелки
  сдвигают назад/вперёд активный целый день, неделю либо месяц. Проверить
  desktop width date control ровно 300 px, короткие русские подписи вроде
  `Неделя · 10–16 авг` без завершающей точки у сокращения месяца и полное
  доступное имя. Весь navigator должен иметь общий product border,
  `background-clip: padding-box`, element radius и static base shadow без
  прежней inset-рамки или второй тени; внутренние arrow/trigger сегменты не
  получают button lift. Проверить закрытие Escape с
  возвратом focus, клавиатурную навигацию календаря, local timezone и отсутствие
  document-level overflow на 375 и 320 px. Рядом должны оставаться оба
  icon-only вида «Таблица / Карточки». Header показывает только фактическую
  метрику выбранного периода (`<короткий период> · занятий: N`, либо
  `показано: N` при hard limit), не прежнее объяснение назначения страницы, и
  Action «Назначить урок»
  с calendar-plus icon; authenticated top header и profile dropdown имеют
  computed `rgb(255, 255, 255)` и `backdrop-filter: none`. При непустом
  результате сразу после controls идёт таблица или карточки без summary
  «Выбранная неделя / Занятия» и count-chip. В table view дополнительно
  проверить solid-white surface без outer border и radius 12 px; exact 40 px
  header и data-row, причём header имеет computed white background, а нижний
  divider 1 px входит в высоту header и совпадает по computed-цвету с
  разделителем между соседними data rows через
  `--product-table-divider-color`; weight 500 и более светлый цвет; видимые
  `Дата / Время / Урок / Курс / Ученики / Статус` и пустой action heading.
  В header должна быть ровно одна стрелка направления и только у активной
  сортировки; после выбора другой колонки индикатор переносится на неё.
  Проверить компактные
  content-sized rails для даты и времени и компактные rails для учеников,
  статуса и действий: первые
  два прижаты слева, последние три — справа, `Урок / Курс` делят оставшуюся
  ширину. Текст и иконки data-row должны иметь computed `#141414`/opacity `1`,
  дата — `Среда · 12 авг`, время — `12:00 · 60 мин`; текст остаётся в одну
  строку с ellipsis и полным `title`, clock + «Ожидается» не повторяет
  дату/время. Измерить inline-padding обычных header/data cells: ровно 12 px
  слева и справа. Для последней body action-cell ожидать inset 4 px и
  единственный `MoreVertical` trigger 32 × 32 px с радиусом 8 px: внутри 40 px
  строки его отступы сверху, справа и снизу должны быть по 4 px, как у active
  option в 40 px переключателе вида. На hover строки назначенного урока
  computed cursor должен быть `pointer`. Вертикальное троеточие постоянно
  доступно с клавиатуры и touch, его portal-menu не обрезается горизонтальным
  scroll wrapper и для ожидающего Run содержит ровно «Начать урок / Изменить /
  Отменить» в этом порядке; active Run показывает «Завершить урок / Отменить»,
  completed — «Результаты». Проверить direct start mutation и reload, edit
  dialog текущего Run сразу в edit mode, confirmation перед cancel,
  arrows/Escape/focus restore и отсутствие
  неявного row-click при взаимодействии с меню; других action-кнопок в строке
  нет. Проверить единый `.product-dropdown-surface` на representative active
  panels: contextual `ActionMenu` Course/Lesson/Schedule/Students,
  Account/profile menu, Store sort и Schedule calendar/date popover. Course,
  Students и Store не должны содержать прежние filter popovers. Во всех
  случаях computed panel
  padding должен быть ровно `6 px`, фон — `rgb(255, 255, 255)`, radius —
  `12 px`, normal-mode border — `0`, `backdrop-filter` — `none`, а
  box-shadow — единственной
  `rgba(20, 20, 20, 0.18) 0px 18px 46px 0px`. Ни одно из четырёх семейств не
  содержит separator line/DOM: дополнительно проверить отсутствие линии после
  profile header и над calendar footer. Consumer не должен
  возвращать локальные panel padding, border, blur или вторую тень. В
  forced-colors тень отключается, а panel получает `Canvas` и системную рамку
  `1px solid CanvasText`. Native `select`, самостоятельный modal dialog и
  reference/demo-only surface не должны получать universal dropdown class;
  календарная panel остаётся в contract, несмотря на `role="dialog"`.
  Каждый пункт portal-menu имеет exact 40 px, радиус 8 px как у active view
  option, вертикально центрированные иконку и текст, `.88rem/400` и canonical inset/gap.
  Отдельно проверить
  canonical active V2 controls: exact `40 px / 12 px / .88rem / 400`, active
  navigation без inset/shadow/translate, icon opacity `1` и contrast-aware
  `currentColor`. Все канонические `.product-btn` должны быть белыми, иметь
  `--product-surface-border: 1px solid oklch(0 0 0 / .1)`, computed border
  `1px solid oklch(0 0 0 / 0.1)`, `background-clip: padding-box` и ту же
  computed base shadow
  `oklch(0 0 0 / 0.05) 0px 1px 6px 0px`, что selected button переключателя
  вида Расписания. Alpha-border должен смешиваться с ancestor/page background,
  а не с белым button background. Header и ordinary toolbar CTA должны
  использовать один
  `.product-btn` state-contract и сохранять одинаковые width/height во всех
  состояниях: внешний control остаётся `40 px`, внутренняя client-area —
  `38 px`, border не исчезает на hover, active или focus. Белый
  `.site-header-shell-demo` сохраняет `68 px / 20 px` и
  имеет единственную computed shadow
  `oklch(0 0 0 / 0.05) 0px 6px 12px 0px` без inset-слоёв. После завершения
  transition hover должен давать
  `oklch(0 0 0 / 0.16) 0px 4px 10px -2px` и
  `matrix(1, 0, 0, 1, 0, -1)` без scale, а pointer-down `:active` —
  `oklch(0 0 0 / 0.14) 0px 1px 3px 0px` и `transform: none`; при
  `prefers-reduced-motion` transition и translate отключены. Проверить,
  что row ellipsis и Component-card icon-actions остаются
  transparent/borderless/no-shadow, а contextual menu panels/items сохраняют
  border `0`.
  У compound toggles не должно быть постоянной внешней обводки, selected white
  option использует только base shadow и не получает hover/pressed button states,
  а shell имеет computed background `oklch(0.19 0 0 / 0.1)`; keyboard focus
  сохраняет видимый outline. Menu items сохраняют border `0`.
  Повторить этот visual check на authenticated `/profile` и вкладках
  `?tab=observers|settings`: единый раздел использует beige product shell и
  solid-white demo TopNav; Account trigger/avatar имеют ровно `40 × 40 px` и
  radius `12 px`, видимого имени рядом нет. Dropdown header содержит ФИО/email
  без avatar; divider под ним и между группами пунктов отсутствует. Tabs и
  primary/secondary/destructive actions используют shared product controls без
  raw Tailwind visual fork. Старые `/settings/*` должны перенаправлять в нужную
  вкладку и не рендерить отдельный side-nav. Auth-кнопки, построенные
  на canonical `.product-btn`, следуют тому же контракту; raw Landing controls
  и non-product controls полноэкранного Student Screen не должны измениться;
- для current source compact-toolbar follow-up проверить, что Course и Store
  не рендерят filter trigger/panel и не применяют удалённые advanced-filter
  predicates. Students рендерит один inline membership control **Все / В
  группе / Без группы**, без status, Account-state или concrete-group selects.
  Store sort использует product dropdown с keyboard navigation, Escape,
  selected state и focus return, но без entry-field halo. Contextual menu
  items, flat row/Component icon-actions и compound toggles не должны получить
  ordinary button lift;
- в том же acceptance проверить общий computed border
  `1px solid oklch(0 0 0 / 0.1)` и `background-clip: padding-box`, затем
  сравнить computed `box-shadow` с
  `oklch(0 0 0 / 0.05) 0px 1px 6px 0px` у shared `SurfaceCard`, Schedule,
  Students/Groups, owned/catalog Course, Course Lessons, Store и subject
  progress table wrappers, authored Component, Run-history, Students/Store и
  progress-stat cards. У поверхности нет hover/pressed transform или
  shadow-transition; после hover/focus Component card сохраняет ту же тень и
  rect, но action overlay раскрывается. Component focus-within и Store
  focus/deep-link highlight добавляют outline, не меняя base shadow. Existing
  backgrounds, radius, semantic/dashed `SurfaceCard` borders, row hover/focus
  и table scroll сохраняются: общий border не перезаписывает смысловую рамку.
  В `forced-colors` shadow исчезает, а boundary остаётся видимой
  через `CanvasText`/`Highlight` outline;
- для base `.product-control` / `.field-input`, включая select и textarea,
  проверить общий border и `background-clip: padding-box`. Для canonical
  однострочных `Input`, `input.field-input`, product search, Schedule/Students
  search и dialog picker search дополнительно проверить белый surface,
  `40 px` outer / `38 px` client-area, computed static shadow
  `oklch(0 0 0 / 0.05) 0px 1px 6px 0px`, scope
  typography/foreground и непрозрачные placeholder/icons. Hover не должен
  менять shadow, transform или rect; click/keyboard focus добавляет отдельный
  2 px halo с computed `outline-offset: 0`, сохраняя base shadow, border и
  геометрию. Select и textarea
  сохраняют base boundary, но не получают single-line height или entry shadow.
  Checkbox/radio/file, dialog/menu/popover surfaces, Student Screen content
  renderers и raw utility
  panels не должны получить entry/static-surface contract автоматически. В
  `forced-colors` entry control использует `Field`/`FieldText`, системную рамку
  и `Highlight` focus без box-shadow;
- `/students` показывает только метрику выбранной вкладки: active/archive/
  pending counts, число Groups или наблюдаемых Profiles; вкладки «Ученики / Группы /
  Наблюдение» сохраняют общий edge-to-edge 40%-black 1.2 px baseline без
  горизонтального inset, opaque active-segment, иконки и raised positive
  counts без badge. При отсутствии сущностей `0` не показывается; при наличии
  наблюдаемых профилей «Наблюдение» показывает их фактическое число и обновляет
  его после отказа от доступа;
- directory toolbar остаётся прозрачной, без outer card и без горизонтального
  inset. Рядом с поиском постоянно виден один membership
  `SegmentedControl` **Все / В группе / Без группы**; filter disclosure,
  status, Account-state и concrete-group controls отсутствуют. `В группе` и
  `Без группы` narrowing применяются только к active relations, а режим «Все»
  сохраняет active/archive/pending в одной таблице с contextual
  restore/cancel actions. Сортировка выполняется кнопками в заголовках, первый
  клик включает ascending, повторный — descending, а `aria-sort` отражает
  направление;
- рядом с Students membership control проверить icon-only control в порядке
  **Таблица / Карточки**: таблица активна при первом открытии, карточки
  показывают ту же narrowed выборку и те же contextual actions; повторить
  переключение на вкладке «Группы». На 375 px controls могут переноситься, но
  не создают document-level horizontal overflow;
- Students table имеет exact 40 px header/data rows и колонки `Ученик / Статус
/ Аккаунт / Группы / Добавлен / Действия`. В конце каждой строки расположен
  keyboard/touch-доступный `MoreVertical` portal-menu; для active learner он
  содержит профиль, учебную историю, группы, добавление в курс, связь с
  аккаунтом и безопасное «Убрать из списка». «Написать сообщение» явно
  disabled до появления messaging slice; добавление в курс сохраняет уже
  выбранные direct learners и groups. Keyboard focus и dialogs проверяются без
  возврата teacher-only route gate;
- `/observing` перенаправляет на `/students?tab=observing`, reload сохраняет
  выбранную вкладку, а main navigation подсвечивает «Ученики»;
- `/courses` не показывает instructional subtitle; tabs сохраняют общий edge-to-edge
  baseline 1.2 px цвета `oklch(0.19 0 0 / 0.4)`, а inactive text/icon —
  `oklch(0.19 0 0 / 0.6)`. Раздел проверяется в режимах «Карточки / Таблица»:
  controls обеих вкладок лежат прямо на page background без toolbar-card и без
  horizontal inset. В обеих вкладках icon-only control идёт **Таблица /
  Карточки** слева направо, и при первом открытии активна таблица;
  Отдельного filter trigger/panel нет ни в **Мои**, ни в **Каталог**. Owned
  поиск меняет только client projection owner-scoped списка, icon-only view
  control имеет доступные имена, reset очищает поиск, а search-empty не
  подменяется пустым persisted каталогом. Во вкладке published «Каталог» web UI
  проверяет server-side search, audience direction и cursor, такой же
  icon-only cards/table presentation, отсутствие повторного заголовка,
  пояснения и видимого result count. Subject/level/facet capability остаётся
  backend contract, но active UI не отправляет эти параметры; client-only
  sort/content не добавляются.
  В **Мои** отдельного sort select нет: headers `Курс / Предмет / Уроки /
Публикация / Обновлён` переключают ascending/descending и публикуют
  `aria-sort`; action heading остаётся пустым и несортируемым. Проверить, что
  fixed-layout таблица не шире desktop wrapper, длинные значения имеют computed
  ellipsis, а колонки «Уровень» нет ни в **Мои**, ни в **Каталог**. В конце
  owned-row проверить один `MoreVertical` trigger 32 × 32 px, portal-menu и для
  unpublished Course точные «Дублировать / Опубликовать / Удалить». Delete
  открывает confirmation; published item disabled с подсказкой сначала снять
  публикацию. У **Каталог** остаётся compact icon-open action и server cursor
  order без локальной сортировки неполного результата;
- на Schedule/Students/Courses table view измерить общий surface contract:
  активный `ProductTable` wrapper сплошной белый, имеет общий product border,
  `background-clip: padding-box`, статическую raised-surface тень и radius `12 px`;
  карточки сохраняют отдельный radius `20 px`. Schedule, Students и обе Course
  tables используют exact 40 px header/data rows, white header, общий divider,
  однострочный ellipsis, 12 px обычный cell inset и 4 px action-cell inset. Во
  всех sortable Schedule/Students/Groups/owned-Course заголовках сортируется
  реальная projection, action heading остаётся несортируемым;
- в каждой непустой data row Schedule, owned/catalog Course, Course Lessons,
  Students, Groups и subject progress проверить единый computed typography
  contract `rgb(20, 20, 20) / .88rem / 400 / line-height 1.3`; header rows и
  action cells проверяются отдельно;
- на published educator Course проверить отсутствие `.app-page-eyebrow` и
  чёрного `ShiDao` chip, вертикальный порядок «Аттестован» над author login;
  на Lesson plan — отсутствие внешней surface/повторного заголовка, прозрачный
  search/actions toolbar, content-sized palette cards без category divider и
  pointer на category/card controls. Для current production component-authoring
  slice
  дополнительно проверить representative preview у 19 вручную создаваемых
  типов: manual picker не содержит `heading`, а «Текст» показывает labels ровно
  «Заголовок» и «Текст» и принимает title-only, body-only или оба поля, но не
  оба пустыми. Authored-create contract picker/REST POST/MCP/AI/deterministic
  assembler содержит 19 keys, runtime renderer/editor — все 20. Старый fixture
  `heading` и `rich_text` без `title` должен по-прежнему рендериться и
  открываться в editor; новый title-only и combined `rich_text` должен
  переживать reload. Preview не содержит
  вложенных focusable controls. Выбор type должен открыть локальный draft editor
  внутри того же dialog без `POST`; возврат в каталог, Cancel, close/backdrop и
  Escape не меняют число Components. Только «Сохранить компонент» отправляет
  один `POST`, после reload появляется ровно один `staff_only` Component.
  Persisted card показывает только teacher renderer, имеет white background,
  общий product border, `background-clip: padding-box` и статическую
  `--product-raised-surface-shadow`. Hover сохраняет exact shadow и rect;
  focus-within добавляет отдельный outline без изменения base shadow. Action
  rail и каждая кнопка
  имеют border `0`, box-shadow `none`, rail background exact
  `rgba(255, 255, 255, 0.5)`. Группа actions не занимает
  normal-flow header, появляется на hover и focus-within, а на touch остаётся
  доступной. Единственное desktop-исключение — active Student Screen action:
  вне hover/focus на learner-visible card видна только голубая 32 px кнопка с
  тем же `MonitorPlay`, что у вкладки; inactive action скрыт, а `Eye/EyeOff` в
  card control отсутствуют. Проверить direct `aria-pressed` toggle: включение
  выбирает Slide ближайшего предыдущего learner-visible соседа, затем
  ближайшего следующего, иначе создаёт новый; повторное нажатие выполняет hide.
  После каждого действия reload сохраняет состояние, а learner preview/API
  соответственно включает или исключает Component. Pencil открывает отдельный
  modal editor: Cancel/close/Escape не
  отправляют `PATCH`, Save отправляет один `PATCH`, и после reload renderer
  показывает сохранённые payload/placement. В обоих editor flows labels имеют
  `.88rem/400`, однострочные input/select — exact 40 px; длинные формы скроллятся
  внутри dialog без desktop/mobile document overflow;
- existing email и learner login/PIN создают одну Account session и не выводят
  internal Auth email/browser secret;
- внутри directory-вкладок `/students` не скрывает archived/pending за
  отдельным переключателем; соседняя вкладка «Наблюдение» остаётся независимой
  learner-safe projection. Archive/restore одного teacher не меняет relation
  другого и не возвращает старые memberships;
- share code/QR создаёт только pending connection, recipient принимает сам;
- blind email invitation даёт одинаковый response для existing/new address;
  tokenless acceptance page имеет no-store/no-referrer и не оставляет token в
  URL/Referer;
- offline learner claim показывает recipient-bound preview. Cancel до merge не
  меняет profiles; confirm сохраняет counts/records и старый individual teacher
  URL actor-scoped открывает target;
- stale UUID в bulk Group/Course/Run request даёт generic inaccessible-profile;
  после reload/reselect текущий UUID работает;
- child activation создаёт отдельный learner Account с login/PIN, требует
  recovery acknowledgement; adult recipient Account не становится learner
  target; отдельный login открывает новый Account profile;
- `/profile` показывает один H1 с ФИО, вкладки `Профиль / История /
Аттестация / Наблюдатели / Настройки` и метрику активной вкладки; private
  comment отсутствует, explicit shared comment виден, known duration не
  подменяет unknown нулём;
- на каждой вкладке Profile верхнеуровневые content cards непрозрачно белые,
  имеют одинаковый radius `20 px`, общий product border,
  `background-clip: padding-box` и статическую raised-surface тень; вложенные
  rows сохраняют белый фон/radius/border без второй тени, а table/empty states
  не вводят отдельный полупрозрачный visual fork;
- в `?tab=settings` до открытия picker нет сетки presets и preset radio.
  Компактная avatar card показывает только текущий avatar и команды «Загрузить
  фото / Выбрать аватар». Preset dialog загружает `20/20` прямых
  `/avatars/presets/*.webp`, не вызывает `/_next/image`, держит Save disabled до
  выбора и не меняет Account до явного сохранения. Upload открывает native file
  picker, затем отдельный preview dialog; «Выбрать другое фото» / «Отмена» /
  Escape не сохраняют файл, focus возвращается trigger. На viewport
  `375 × 812` preset grid имеет
  четыре колонки, а прокрутка остаётся внутри modal без document overflow;
- `/learning-profile` переносит query в `/profile`, `/settings` и
  `/settings/profile` ведут в `?tab=settings`, `/settings/security` — в
  `?tab=settings#security`, `/settings/observers` — в `?tab=observers`; ни один
  legacy URL не рендерит отдельный settings shell;
- `/profile?tab=observers` первым показывает active `observed_by`,
  создаёт/accepts/revokes invitation, а вкладка
  `/students?tab=observing` показывает read-only profile; после revoke следующий
  read немедленно fail closed;
- subject может отозвать recovery delegate; delegate reset login/PIN требует
  recent reauth и инвалидирует прежние sessions;
- AI consent request виден subject, grant включает только sanitized aggregate
  shared history, revoke прекращает дальнейшее использование, stale preview
  Apply отклоняется;
- permanent delete работает только для empty unclaimed profile; destructive
  self erasure проверяется на disposable data через preview/recent-reauth/
  confirm и поддерживаемый cleanup. После него old alias не резолвится;
- teacher raw history другого recorder, observer mutations, raw token/email
  digests, Auth IDs и private comments не появляются в Network/API/console.

### Console/logs

- browser console без новых error/warning;
- web logs без repeated 5xx;
- Supabase/PostgREST/Storage без новых authorization/schema errors.

## 8. Обычный rollback/hotfix V2

Если новый web release сломан, но DB совместима:

- вернуть предыдущий проверенный web image/commit через Coolify;
- не делать `git reset --hard` в рабочем repository;
- сохранить логи и точный failed SHA;
- исправить `main` новым commit.

Если была применена несовместимая migration:

- остановить зависимый web rollout;
- оценить данные и написать корректирующую forward migration;
- не переписывать уже применённый migration file;
- не использовать V1 restore как быстрый rollback.

Полный destructive restore V1 требует явного решения владельца, maintenance,
fresh V2 snapshot и отдельного runbook.

## 9. Self-hosted Supabase version safety

Текущий recovery baseline содержит pinned PostgreSQL 15 и версии старого
self-hosted stack. Нельзя выполнять на активном контуре без отдельного плана:

```text
docker compose pull
docker compose up --force-recreate всех сервисов
замену pinned db image на новый default
замену gateway/Compose tree из свежего upstream
```

Причина: upstream self-hosted defaults меняются независимо от application
release, включая PostgreSQL 15 → 17, формат `API_EXTERNAL_URL` и переход с
Kong на Envoy. Перед platform upgrade нужно зафиксировать фактические image
versions, volumes, gateway name/config, создать проверенный backup и пройти
репетицию отдельно.

Официальные notices:

- <https://supabase.com/changelog/46080-self-hosted-supabase-upgrading-from-pg-15-to-17-breaking-change>
- <https://supabase.com/changelog/47093-self-hosted-supabase-api-external-url-to-include-auth-v1>
- <https://supabase.com/changelog/48048-self-hosted-supabase-envoy-becomes-the-default-api-gateway-b>

## 10. Hand-off release

В завершении указать:

- commit SHA и branch;
- прошедшие проверки;
- применённые migrations и их postflight;
- running deployed SHA/image;
- deployed-contour smoke results;
- configured RouterAI model/base URL/timeout без API key, provider request IDs
  и token usage от smoke;
- факт успешной ротации/отзыва старого ключа без значения secret;
- известные ограничения;
- какие current-state/roadmap/docs обновлены.
