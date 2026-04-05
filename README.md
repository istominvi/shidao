# ShiDao MVP

Продуктовый MVP на Next.js + self-hosted Supabase (Auth + Postgres). Текущее состояние: auth и routing унифицированы, приватная зона живёт в едином app-контуре, а session-navigation state собирается server-first.

## Запуск

```bash
npm install
npm run dev
```

Перед запуском обязательно задайте `APP_SESSION_SECRET` (и в dev, и в prod):

```bash
# Пример: сгенерировать 32 байта (64 hex-символа) секрета
openssl rand -hex 32
```

```bash
APP_SESSION_SECRET=<your-generated-secret>
```

Требования:

- переменная обязательна, fallback-значений нет;
- минимальная длина — `32` символа;
- используйте криптографически случайный секрет с высокой энтропией.

## Deploy notes (Coolify / self-hosted CI)

- Репозиторий содержит production `Dockerfile` (multi-stage, Next standalone). В Coolify лучше использовать Dockerfile build mode, чтобы не зависеть от Nixpacks base image из `ghcr.io/railwayapp/nixpacks`.
- Проект не требует внешней загрузки Google Fonts на этапе `next build` (используются системные font stacks), поэтому сборка подходит для сред с ограниченным egress.
- Для pull-request deploy в Coolify всё равно нужен исходящий HTTPS-доступ к `api.github.com` (helper проверяет GitHub API до старта сборки).
- Для Dockerfile-сборки нужен доступ к Docker Hub для `node:22-alpine`.

## Маршруты, route groups и layouts

### Route groups

- `src/app/(marketing)` — публичный маркетинговый слой (`/`).
- `src/app/(auth)` — auth-страницы и callback (`/login`, `/join`, `/join/check-email`, `/auth/confirm`, восстановление пароля).
- `src/app/(app)` — приватный продуктовый слой (`/onboarding`, `/dashboard`, `/settings/*`).

### Layout responsibility

- `src/app/layout.tsx` (root layout):
  - читает session view на сервере;
  - прокидывает его в `SessionViewProvider` как `initialState`.
- `src/app/(auth)/layout.tsx` (auth-guard layout):
  - применяет guard только к `/login` и `/join`;
  - если пользователь уже авторизован, redirect по access policy (`/onboarding` или `/dashboard`).
- `src/app/(app)/layout.tsx` (private guard layout):
  - не пускает `guest`/`degraded` в приватную зону (redirect на `/login`);
  - для `adult-without-profile` принудительно ведёт на `/onboarding` (кроме самого `/onboarding`).

### Канонические маршруты

- `/` — лэндинг.
- `/join` — регистрация взрослого аккаунта.
- `/join/check-email` — экран «проверьте почту» (когда нужно email confirmation).
- `/auth/confirm` — callback подтверждения email/инвайта/восстановления.
- `/login` — единый вход взрослого или ученика.
- `/forgot-password` — запрос на восстановление пароля.
- `/reset-password` — установка нового пароля после recovery flow.
- `/onboarding` — создание первого взрослого профиля / добавление второго профиля.
- `/dashboard` — единый приватный кабинет.
- `/settings/profile` — профиль и email.
- `/settings/security` — PIN и параметры безопасности.
- `/settings/team` — команда и приглашения (доступно только взрослому профилю).

### Route/source-of-truth helpers

- `src/lib/auth.ts` — канонические URL-константы (`ROUTES`).
- `src/lib/routes.ts` — route-aware helpers (`isProtectedAppRoute`, `isSettingsRoute`, `isGuardedAuthRoute`, `isSafeRelativePath`).
- `src/lib/navigation-contract.ts` — session/navigation contract helpers для TopNav, Landing и server-first security gating.
- UI и redirect-политика используют эти helper'ы вместо строковых префиксов в компонентах.

## Protected/private зона и redirect policy

### Access policy statuses

Серверная `resolveAccessPolicy()` нормализует состояние до одного из статусов:

- `guest`
- `student`
- `adult-with-profile`
- `adult-without-profile`
- `degraded`

### Redirect policy (единая)

- Гость (`guest`):
  - доступ к `(app)` запрещён → `/login`.
- Degraded (`degraded`):
  - в `(app)` трактуется как невалидная сессия → `/login`.
- Взрослый без профиля (`adult-without-profile`):
  - из любых приватных страниц (кроме `/onboarding`) → `/onboarding`.
- Взрослый с профилем (`adult-with-profile`) и ученик (`student`):
  - при заходе на guarded auth-страницы (`/login`, `/join`) → `/dashboard`.
- Взрослый без профиля на guarded auth-страницах:
  - `/login` и `/join` → `/onboarding`.

### Поведение `/login` и `/join` для уже авторизованных

- Guard в `(auth)/layout` срабатывает только для двух путей: `/login` и `/join`.
- Если пользователь уже авторизован:
  - `adult-without-profile` всегда уходит на `/onboarding`;
  - `adult-with-profile` и `student` всегда уходят на `/dashboard`.
- Query-success сценарии на `/login` (`?registered=1`, `?confirmed=1`, `?passwordReset=1`) сохраняются для **гостя** и показывают success hint.
- Если авторизованный пользователь открывает `/login?...` или `/join?...`, то сначала выполняется redirect guard, и success query не отображается (ожидаемое поведение, чтобы не показывать auth-экран в активной сессии).

## Session-navigation state: единый контракт (server-first)

### Контракт `SessionView`

Навигация и UI опираются на единый union-контракт:

- `guest`: `{ kind: 'guest', authenticated: false }`
- `student`: `{ kind: 'student', authenticated: true, identity..., hasPin }`
- `adult`: `{ kind: 'adult', authenticated: true, identity..., hasPin, activeProfile, availableProfiles }`
- `degraded`: `{ kind: 'degraded', authenticated: true, reason?, identity... }`

### Где формируется состояние

1. Server-first источник истины: `readSessionViewServer()`
   - читает app-session cookie;
   - достраивает user context через server/admin слой;
   - возвращает нормализованный `SessionView`.
2. Root layout выполняет этот шаг на сервере и передаёт `initialState` в клиентский provider.
3. Клиент может только revalidate (`/api/auth/session` через `refetchSession`) после login/logout/profile switch, а runtime-normalization (`toSessionView`) удерживает UI в рамках канонического union-контракта.
4. Страница `/settings/security` получает `hasPin` server-first через `readSessionViewServer()` и не делает отдельный client-side fetch сессии.

Итог: первичная навигационная развилка происходит на сервере, а клиентский state — это проекция и актуализация уже серверного решения.

## Короткие flow-схемы

### 1) Guest flow

```text
Guest
  ├─ opens /(marketing) → stays public
  ├─ opens /login or /join → auth pages
  └─ opens /(app) route → redirect /login
```

### 2) Adult flow

```text
Adult login success
  ├─ has profile(s) → /dashboard
  └─ has no profile → /onboarding

Adult on /login|/join while authenticated
  ├─ with profile → /dashboard
  └─ without profile → /onboarding
```

### 3) Student flow

```text
Student login success → /dashboard
Student opens /login|/join while authenticated → /dashboard
Student cannot enter adult onboarding branch (no adult profile state)
```

### 4) Onboarding / profile-switch flow

```text
Adult without profile
  ├─ any /(app) page except /onboarding → redirect /onboarding
  └─ completes onboarding → profile appears → /dashboard

Adult with one profile
  ├─ switch menu offers missing profile via /onboarding?mode=add-profile
  └─ after adding/switching profile → /dashboard (activeProfile updated)
```

## Единый login flow (`POST /api/auth/login`)

Вход принимает:

- `identifier`: email взрослого или логин ученика;
- `secret`: пароль или PIN.

Фактический порядок обработки:

1. Нормализация `identifier`.
2. Если это email-формат — попытка взрослого входа по паролю.
3. Если не email — server-side lookup ученика в `student.internal_auth_email`.
4. Сначала всегда проверяется пароль.
5. Если пароль не подошёл и распознан ученик — используется PIN fallback через `verify_user_pin`.
6. После успеха: устанавливается app-session cookie, выполняется best-effort `user_preference`/context resolution, затем routing на `/onboarding` (если нужно) или `/dashboard`.

## Signup и email confirmation

### Режим 1: `ENABLE_EMAIL_AUTOCONFIRM=true`

- Подтверждение email отключено.
- После signup пользователь направляется на `/login?registered=1`.
- SMTP для этого режима не обязателен.

### Режим 2: `ENABLE_EMAIL_AUTOCONFIRM=false`

- Подтверждение email обязательно.
- После signup пользователь направляется на `/join/check-email`.
- До подтверждения вход недоступен.
- После подтверждения через `/auth/confirm` вход становится доступен.

**Текущий рабочий production/self-hosted режим:**

- `ENABLE_EMAIL_AUTOCONFIRM=false`
- SMTP включён
- confirm flow работает end-to-end

## Self-hosted email auth (кратко)

- SMTP provider: VK WorkSpace
- SMTP host: `smtp.mail.ru`
- Рабочий SMTP порт для текущего VPS: `2525`
- Signup → email → confirm → login работает фактически в текущей конфигурации
- Детальный runbook: `docs/email-auth-selfhosted-supabase.md`

## Preference и Security

### `user_preference`

Основные поля:

- `last_active_profile`
- `last_selected_school_id`
- `theme`
- `settings` (jsonb)

Helpers/RPC:

- `ensure_user_preference`
- `set_last_active_profile`
- `get_last_active_profile`
- `set_last_selected_school`
- `upsert_user_theme`
- `merge_user_settings`

Если RPC недоступны в self-hosted инсталляции, используется fallback через PostgREST upsert/patch.

### `user_security`

Основные поля:

- `pin_hash` (PIN хранится только в hash-виде)
- `pin_failed_attempts`
- `pin_locked_until`
- служебные timestamp-поля жизненного цикла PIN

Helpers/RPC:

- `set_user_pin`
- `verify_user_pin`
- `clear_user_pin`
- `reset_pin_attempts`

## Миграции

Миграции находятся в `supabase/migrations`.
Ключевые для текущего auth/routing/prefs/security состояния:

- `202603260001_init_auth_and_roles.sql`
- `202603270002_auth_onboarding_unified_signin.sql`
- `202604020001_parent_teacher_school_model.sql`
- `202604030001_user_preference_and_security.sql`

## Безопасность секретов

- Не коммитьте реальные `.env`.
- Не храните SMTP credentials в документации.
- Используйте только placeholders (`<app-password>`, `<secret>`) и secret store.
- Если секреты могли попасть в логи/чаты/скриншоты — ротируйте их.

## Formatting и quality gates

- `npm run format` — применяет форматирование Prettier ко всему репозиторию.
- `npm run format:check` — проверяет, что рабочее дерево уже отформатировано.
- Базовый pre-merge набор: `npm run format:check && npm run lint && npm run build && npm run test`.
- Полный прогон (включая браузерный smoke-слой): `npm run test:all`.
- В репозитории добавлен реальный CI workflow: `.github/workflows/ci.yml`.
- CI на каждый `push` и `pull_request` запускает quality gates в фиксированном порядке:
  1. `npm ci`
  2. `npm run format:check`
  3. `npm run lint`
  4. `npm run build`
  5. `npm run test`
  6. `npx playwright install --with-deps chromium`
  7. `npm run test:browser:ci`

## Test strategy (MVP)

- `npm run test:compile` — компиляция `src/**/*.test.ts` в `.test-dist` через `tsc -p tsconfig.test.json`.
- `scripts/run-node-tests.mjs` оставлен минимальным и управляемым: он только собирает `.test-dist/**/*.test.js` и применяет include/exclude фильтры без дополнительной магии.
- `npm run test` (основной стабильный pipeline) = `npm run test:unit`:
  - запускает все node:test сценарии **кроме** browser-smoke (`--exclude browser-smoke`);
  - сюда входят unit + integration/smoke без реального браузера (включая HTTP e2e-smoke слой на `fetch`).
- `npm run test:browser`:
  - запускает только browser-smoke тесты (`--include browser-smoke`);
  - использует реальный Chromium через Playwright;
  - по умолчанию пытается запускать приложение в production-like режиме (`next start`), если уже есть `.next/BUILD_ID`;
  - если production-сборка не найдена локально, автоматически и явно fallback-ится на `next dev`.
- `npm run test:browser:ci`:
  - включает strict режим browser smoke (`REQUIRE_BROWSER_SMOKE=1`) и требует production-like server mode;
  - если Playwright/Chromium недоступны или отсутствует production-сборка, это **ошибка**, а не `skip`.
- `npm run test:all`:
  - последовательно запускает `test:unit` и `test:browser`.
- Это сохраняет lightweight stack (`node:test` + TypeScript) и делает браузерный слой явным и управляемым.
- Покрытие по слоям:
  - `src/lib/__tests__`: route matching, safe redirect normalisation, auth redirect policy, smoke-level user-flow контракты;
  - `src/components/__tests__`: session-driven TopNav/landing branching и contract-ожидания гостевых/auth CTA;
  - `src/lib/server/__tests__`: private-layout redirect contract для `guest`/`degraded`/`adult-without-profile`.

### Browser smoke layer

- Добавлен минимальный browser-smoke набор: `src/lib/__tests__/auth-navigation-browser-smoke.test.ts`.
- Сценарии:
  - guest открывает `/` и видит гостевые CTA;
  - авторизованный пользователь на `/` видит auth-aware header;
  - guest на protected route (`/dashboard`) перенаправляется на `/login`;
  - авторизованный пользователь на `/login` уходит по access policy на `/dashboard`.
  - авторизованный пользователь открывает profile menu в header на `/` и видит auth-aware actions (`Профиль и email`, `Безопасность`);
  - авторизованный пользователь переходит из header menu в `/settings/security` и страница проходит базовый контракт (`PIN-код входа`, актуальный статус PIN).
- Тесты запускаются в реальном браузере через `playwright`.
  - Local-friendly режим (`npm run test:browser`): если пакет `playwright` не установлен или отсутствуют browser binaries, тесты помечаются как `skip` с понятной причиной.
  - CI-strict режим (`npm run test:browser:ci`, либо `CI=true`/`REQUIRE_BROWSER_SMOKE=1`): такие же условия дают **fail**, чтобы в CI нельзя было «тихо» пропустить browser smoke.
  - Для browser server mode:
    - по умолчанию используется `BROWSER_SMOKE_SERVER_MODE=prod` (то есть `next start` на уже собранном приложении);
    - если локально сборка отсутствует, тест раннер печатает предупреждение и использует `next dev`;
    - в strict режиме fallback запрещён — сначала нужен `npm run build`.
  - Оркестрация app server сделана более переносимой и предсказуемой:
    - тесты больше не полагаются на `detached` + `kill(-pid)` для process-group shutdown;
    - server запускается как обычный child process, readiness проверяется polling-запросами и early-exit детектом процесса;
    - при cleanup выполняется graceful `SIGTERM` с таймаутом, затем принудительный stop (`SIGKILL`, а на Windows — `taskkill /t /f`);
    - в ошибки старта добавляется хвост stdout/stderr, чтобы быстрее диагностировать падения CI/local.
