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
- `/onboarding` — создание первого взрослого профиля / добавление второго профиля.
- `/dashboard` — единый приватный кабинет.
- `/settings/profile` — профиль и email.
- `/settings/security` — PIN и параметры безопасности.
- `/settings/team` — команда и приглашения (доступно только взрослому профилю).

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
3. Клиент может только revalidate (`/api/auth/session` через `refetchSession`) после login/logout/profile switch, но не определяет контракт сам.

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
