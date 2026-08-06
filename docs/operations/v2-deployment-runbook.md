# ShiDao V2 — deployment runbook

**Статус:** активный рабочий demo-контур
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

Known current debt: middleware ещё не закрывает non-root `brand`/`model` и
unknown routed hosts explicit allowlist. До hardening изоляция зависит от
Coolify/proxy/DNS, поэтому не добавлять новые host routes и проверять их при
каждом routing release.

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
git diff --check
```

Для auth/routing/browser-sensitive изменений дополнительно:

```bash
npm run test:browser:ci
```

Provider tests в AI-release используют только fake credentials и локальный
mock. CI/build не получают реальный `ROUTERAI_API_KEY`; если сборка требует
production secret, release останавливается как нарушение server-runtime
boundary.

Release с teacher-only `/schedule` и `/students` обязан дополнительно проверить
route guard для Guest, adult без профиля, Parent и transitional Student, а
также desktop/mobile primary navigation. Этот UI-slice не содержит migration;
появление schedule/student DDL в diff означает незапланированное расширение
scope и должно остановить release.

Release standalone demo обязан проверить root и прямые `/students`, `/courses`,
Course/Lesson deep links, reload без redirect, OG asset, `robots.txt`/noindex и
отказ unsafe methods. Demo source не должен получать imports application
services/Supabase или новую schema.

Обычный `npm run test:browser` может пропустить smoke, если browser недоступен;
он не заменяет строгий release gate.

Worktree должен содержать только изменения текущей задачи. Нельзя включать
чужие локальные правки или `.local-backups`.

## 4. Если release содержит DB migration

Порядок строгий:

1. прочитать current schema snapshots;
2. выполнить read-only ShiDao sanity check;
3. проверить backup/impact и migration SQL;
4. применить forward migration к целевой ShiDao DB;
5. выполнить migration postflight, RLS/ACL и representative user-JWT tests;
6. подтвердить PostgREST schema cache/relationships;
7. только затем выпускать web, который зависит от новой shape.

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

На текущем production demo-контуре `ROUTERAI_API_KEY` уже подключён как
server-only runtime secret, а AI routes/UI и default
`google/gemini-2.5-flash-lite` проверены в release `0276aed`. Значение secret не
проверяется выводом и не хранится в repository.

Первичная настройка выполняется только в environment editor существующего
ShiDao V2 application:

1. Для публичного production создать новый ключ в RouterAI. Временный demo key,
   использование которого явно одобрено владельцем, допустим только как locked
   runtime secret и подлежит ротации до публичного launch, если он когда-либо
   попадал в чат, issue, screenshot, shell history или открытый log.
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
- `https://demo.shidao.ru/` открывает прежний standalone UI без redirect;
- demo navigation ведёт на clean `/students`, `/courses` и Course/Lesson paths,
  а прямое открытие/reload этих URL остаётся внутри demo;
- demo responses и `robots.txt` запрещают indexing, `/og-demo-v2.png` имеет
  image content type, unsafe request получает 405;
- demo не читает V2 session/data и не отправляет API/Supabase requests.

### Auth

- login page открывается;
- существующий пользователь входит;
- post-login route — `/courses`, `/onboarding` для взрослого без legacy profile
  или safe relative `next`;
- signup/confirm/recovery проверяются при изменении Auth flow;
- секреты и токены не появляются в client/logs.

### Course Builder

- `/courses` читает реальные данные;
- owner открывает Course, другой owner не может;
- Lesson/Components загружаются;
- private Component отсутствует в Student Screen;
- fullscreen preview открывается;
- reload сохраняет данные;
- signed attachment открывается только при разрешённом ownership/projection.

### RouterAI и AI-поверхности

- войти на `v2.shidao.ru` как Teacher и открыть `/courses/new`;
- на disposable Course выбрать «Создать с ИИ» и получить preview программы с
  ожидаемым числом Lessons, configured model и ненулевым token usage;
- подтвердить preview, открыть Course и после reload увидеть ту же persisted
  последовательность Lessons без дублей;
- создать или дополнить один Lesson через «Заполнить с помощью ИИ»: сначала
  проверить preview, затем применить и после reload увидеть Components;
- подтвердить, что AI Components созданы `staff_only` и не попали на Student
  Screen без явного назначения преподавателем;
- открыть «ИИ-ассистент», отправить один безопасный вопрос и получить ответ с
  token usage; чат консультирует и не меняет Course/Lesson;
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

### Teacher navigation shells

- active Teacher видит меню `Расписание / Ученики / Курсы` и открывает
  `/schedule` и `/students`;
- Parent и transitional Student не видят teacher-only пункты и при прямом
  открытии этих routes возвращаются в `/courses`;
- взрослый без профиля уходит в `/onboarding`, Guest — в `/login`;
- оба shell читают только реальные owner-scoped Course summaries через
  существующий `/api/v2/courses`;
- Schedule показывает честное отсутствие занятий и не сохраняет выбранную
  дату как event/LessonSession;
- Students показывает нулевые LearnerProfile/Group и не читает legacy
  `student/class/class_student`;
- нет фиктивных учеников, групп, progress/history или новых mutation requests.

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
