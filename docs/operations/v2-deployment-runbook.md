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
cleanup или Auth hardening отклоняется.

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
- `/courses`, Course и Lesson показывают одинаковые computed H1/description
  metrics через один `AppPageHeader`: H1 не крупнее 48 px на desktop и 32 px
  на mobile, `min-height: 200px` с ростом по контенту, actions вертикально
  центрированы; Course/Lesson сохраняют backlink;
- Course и Lesson tabs используют чёрную baseline 1 px с inline-inset 12 px и
  квадратный чёрный active segment 4 px без radius, а на mobile скроллятся внутри
  strip без document overflow;
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

После smoke disposable Course удалить только через обычный подтверждённый UI,
если такой delete flow входит в текущий release; иначе оставить его явно
помеченным как smoke, не удаляя данные напрямую из БД.

### Roleless navigation and learner identity

- любой authenticated Account видит primary navigation `Расписание / Ученики /
Курсы`, а Account menu — `Учебный профиль / Настройки / Выход`; Guest на
  каждом private route уходит в login;
- `/schedule` и `/students` сохраняют единый computed page-header contract с
  `/courses`, Course и Lesson; contextual actions находятся в header, а
  date/view controls — ниже него справа прямо на page background без внешней
  toolbar-card. Для Schedule проверить, что отдельного внешнего «Неделя /
  Месяц» нет: центральная кнопка compact date control открывает календарный
  popover с «День / Неделя / Месяц», выбор даты меняет опорную дату, а стрелки
  сдвигают назад/вперёд активный целый день, неделю либо месяц. Проверить
  desktop width date control ровно 300 px, короткие русские подписи вроде
  `Неделя · 10–16 авг` без завершающей точки у сокращения месяца и полное
  доступное имя. Проверить закрытие Escape с
  возвратом focus, клавиатурную навигацию календаря, local timezone и отсутствие
  document-level overflow на 375 и 320 px. Рядом должны оставаться оба
  icon-only вида «Таблица / Карточки». Header показывает точный подзаголовок
  «Здесь все назначенные уроки за выбранный период.» и Action «Назначить урок»
  с calendar-plus icon; authenticated top header и profile dropdown имеют
  computed `rgb(255, 255, 255)` и `backdrop-filter: none`. При непустом
  результате сразу после controls идёт таблица или карточки без summary
  «Выбранная неделя / Занятия» и count-chip. В table view дополнительно
  проверить solid-white surface без outer border; exact 40 px header вместе с
  нижним divider 1 px, weight 500 и более светлый цвет; видимые `Дата / Время /
Урок / Курс / Ученики / Статус` и пустой action heading. Проверить компактные
  фиксированные rails для даты, времени, учеников, статуса и действий: первые
  два прижаты слева, последние три — справа, `Урок / Курс` делят оставшуюся
  ширину. Текст и иконки data-row должны иметь computed `#141414`/opacity `1`,
  дата — `Среда · 12 авг`, время — `12:00 · 60 мин`; текст остаётся в одну
  строку с ellipsis и полным `title`, clock + «Ожидается» не повторяет
  дату/время. Вертикальное троеточие постоянно доступно с клавиатуры
  и touch, его portal-menu не обрезается горизонтальным scroll wrapper,
  содержит все действия, поддерживает arrows/Escape/focus restore; быстрые
  icon-only actions появляются при hover/focus строки. Отдельно проверить
  canonical active V2 controls: exact `40 px / 12 px / .88rem / 400`, flat
  primary и active navigation без inset/shadow/translate, icon opacity `1` и
  contrast-aware `currentColor`, тонкую рамку белых buttons и border `0` у
  menu items. Повторить этот visual check на authenticated `/settings/profile`,
  `/settings/security` и `/settings/observers`: все три используют beige
  product shell и solid-white demo TopNav; user/header и active side-nav имеют
  `40 px / 12 px / .88rem / 400`, а primary/secondary/destructive actions —
  shared Button contrast без raw Tailwind visual fork. Landing, Auth и
  полноэкранный Student Screen при этом не должны измениться;
- вкладки «Ученики / Группы / Наблюдение» сохраняют общий black 1 px baseline и square
  active-segment; directory toolbar остаётся прозрачной и без outer card,
  active/archive/pending находятся в одной таблице с inline-чипами и
  contextual restore/cancel actions, а поиск, group filter, sorting и reset
  остаются одновременно видимыми и сохраняют значения после mutation/reload;
  keyboard focus и dialogs проверяются без возврата teacher-only route gate;
- `/observing` перенаправляет на `/students?tab=observing`, reload сохраняет
  выбранную вкладку, а main navigation подсвечивает «Ученики»;
- `/courses` проверяется в режимах «Карточки / Таблица»: controls лежат прямо
  на page background без toolbar-card, поиск и disclosure subject/level/content
  меняют только client projection owner-scoped списка, icon-only view control
  имеет доступные имена, reset возвращает все курсы, filtered-empty не
  подменяется пустым persisted каталогом. Во вкладке published «Каталог» отдельно
  проверяются только реальные server-side search/subject/level и cursor, такой
  же icon-only cards/table presentation, отсутствие повторного заголовка,
  пояснения и видимого result count; client-only sort/content не добавляются;
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
- `/learning-profile` показывает self safe history/progress; private comment
  отсутствует, explicit shared comment виден; known duration не подменяет
  unknown нулём;
- `/settings/observers` создаёт/accepts/revokes invitation, вкладка
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
