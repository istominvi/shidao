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
- `demo.shidao.ru` — redirect на V2 Course Builder;
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

Обе optional переменные имеют эти defaults в коде. Явный
`APP_SESSION_VERSION` нужен для управляемой глобальной invalidation, а явный
TTL не позволяет незаметно зависеть от смены default.

- `NEXT_PUBLIC_SITE_URL` описывает landing/canonical public URL.
- `NEXT_PUBLIC_APP_URL` должен указывать на `https://v2.shidao.ru` и имеет
  приоритет для Auth callback.
- Любая `NEXT_PUBLIC_*` переменная доступна browser bundle; secret key туда не
  помещается.
- `NEXT_PUBLIC_*` должны быть доступны на build stage. Их изменение требует
  нового build/redeploy; runtime-only смена environment не переписывает уже
  inlined client bundle.

SMTP/GoTrue переменные настраиваются в Supabase environment, а не в Next.js.

## 7. Smoke после deploy

### Host boundary

- `https://shidao.ru/` → landing;
- `https://shidao.ru/login` → maintenance 503;
- `https://shidao.ru/api/...` → JSON 503;
- `https://v2.shidao.ru/robots.txt` запрещает indexing;
- V2 responses имеют `X-Robots-Tag`.

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
- известные ограничения;
- какие current-state/roadmap/docs обновлены.
