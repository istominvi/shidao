# ShiDao MVP

Продуктовый MVP на Next.js + self-hosted Supabase (Auth + Postgres). Текущее состояние: auth и routing унифицированы, приватная зона живёт в едином app-контуре, а session-navigation state собирается server-first.

## Запуск

```bash
npm install
npm run dev
```

Перед запуском задайте env-переменные (минимум):

```bash
cp .env.example .env.local
```

Обязательные для runtime:

- `APP_SESSION_SECRET` — минимум 32 символа, криптостойкий случайный секрет (используется для шифрования cookie-сессии).
- `APP_SESSION_VERSION` — версия app-session для массовой инвалидизации токенов (по умолчанию `1`).
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
- `NEXT_PUBLIC_SITE_URL` (или `SITE_URL`) — canonical base URL для redirect/metadata.

Генерация секрета:

```bash
openssl rand -hex 32
```

## Заметки по деплою (Coolify / self-hosted CI)

- Репозиторий содержит production `Dockerfile` (multi-stage, Next standalone). В Coolify лучше использовать Dockerfile build mode, чтобы не зависеть от Nixpacks base image из `ghcr.io/railwayapp/nixpacks`.
- Проект не требует внешней загрузки Google Fonts на этапе `next build` (используются системные font stacks), поэтому сборка подходит для сред с ограниченным egress.
- Для pull-request deploy в Coolify всё равно нужен исходящий HTTPS-доступ к `api.github.com` (helper проверяет GitHub API до старта сборки).
- Для Dockerfile-сборки нужен доступ к Docker Hub для `node:22-alpine`.
- Перед стартом приложения в любом окружении обязательно применяйте все Supabase migrations (например, `supabase db push` или эквивалентный SQL migration job), иначе onboarding/RPC-ветки могут падать из-за schema drift.

## Маршруты, route groups и layout-слои

### Route groups (группы маршрутов)

- `src/app/(marketing)` — публичный маркетинговый слой (`/`).
- `src/app/(auth)` — auth-страницы и callback (`/login`, `/join`, `/join/check-email`, `/auth/confirm`, восстановление пароля).
- `src/app/(app)` — приватный продуктовый слой (`/onboarding`, `/dashboard`, `/groups/*`, `/lessons/*`, `/settings/*`).

### Ответственность layout-слоёв

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
- `/dashboard` — операционный дашборд преподавателя (быстрые действия, таблица групп, недельное расписание, attention summary).
- `/groups` — полный индекс teacher-групп (primary teacher context).
- `/groups/new` — создание группы преподавателем.
- `/groups/[groupId]` — teacher workspace уровня конкретной группы.
- `/students/new` — создание ученика и добавление в группу.
- `/methodologies` — индекс методик как педагогического source layer.
- `/methodologies/[methodologySlug]` — страница выбранной методики со списком её уроков.
- `/methodologies/[methodologySlug]/lessons/[lessonId]` — страница урока методики (без привязки к группе и расписанию) с возможностью назначения.
- `/settings/profile` — профиль и email.
- `/settings/security` — PIN и параметры безопасности.
- `/settings/team` — команда и приглашения (доступно только взрослому профилю).

### Teacher IA (Step 1: group-centric модель)

- Для преподавателя primary navigation смещена к `group/class` контексту.
- Основной маршрутный поток: `/dashboard` → `/groups` → `/groups/[groupId]` → `/lessons` → `/lessons/[scheduledLessonId]`.
- `/lessons` остаётся полезным, но теперь это secondary global lessons index across groups.
- Каноническая lesson-content архитектура не меняется: methodology = source of truth, scheduled lesson = runtime unit, workspace = execution screen.
- Подробности: `docs/architecture/teacher-group-centric-ia.md`.

### Teacher IA (Step 2: operations dashboard)

- `/dashboard` теперь является рабочим экраном преподавателя, а не hero-обзором.
- Дашборд включает:
  - row быстрых действий (`Добавить группу`, `Добавить ученика`, `Открыть группы`, `Открыть занятия`);
  - table-first секцию `Мои группы` с поиском/фильтрами (группа, ученики, методология, прогресс, следующее занятие, статус);
  - недельную agenda-секцию расписания по всем группам;
  - compact attention summary (группы без учеников/методологии/ближайших занятий, занятия сегодня).
- `/groups` — полный структурированный индекс групп преподавателя.
- `/lessons` сохраняется как secondary cross-group lessons index.
- `/methodologies` — педагогический source layer c входом в уроки методики и назначение в runtime.
- Преподаватель может открыть урок методики, нажать «Назначить урок», создать `scheduled_lesson` и перейти в `/lessons/[scheduledLessonId]`.
- В этом шаге намеренно **не** внедряются homework/thread/attendance/full-calendar/editor/AI.

### Teacher IA (Step 3: настройка группы + привязка методики + контекстное планирование)

- `class` получает явную связь с методикой через `class.methodology_id`.
- Новая группа создаётся сразу с выбранной методикой (`methodology_id` обязателен при создании).
- После создания группы `class.methodology_id` считается неизменяемым (immutable).
- `/groups/[groupId]` становится реальным teaching container:
  - roster группы + контекстный вход в `students/new?groupId=...`;
  - планирование занятия из контекста группы (без повторного выбора группы).
- Для legacy/backfill-групп возможен `class.methodology_id = null`; в таком случае group-scoped scheduling блокируется.
- Прогресс группы теперь считается честно:
  - numerator = только `completed` занятия группы;
  - denominator = количество уроков в назначенной методике.
- `/dashboard` и `/groups` используют явное назначение методики (без эвристики от ближайших занятий).
- `/lessons` сохраняется как secondary global lessons index; `/lessons/[scheduledLessonId]` остаётся execution workspace.
- Runtime workspace `/lessons/[scheduledLessonId]` хранит исполнение занятия и даёт ссылку назад на исходный source-урок методики.

### Teacher IA (Step 4: homework runtime layer, привязанный к scheduled lesson)

- Домашнее задание теперь строго следует модели `methodology -> scheduled lesson runtime -> student submission`.
- Canonical homework хранится в методике (`methodology_lesson_homework`) и отображается преподавателю только в режиме read-only.
- В `/lessons/[scheduledLessonId]` преподаватель может:
  - выдать homework всей группе или выбранным ученикам;
  - задать дедлайн;
  - видеть статус по каждому ученику;
  - отмечать review-state и оставлять комментарий по проверке.
- Преподаватель **не может** редактировать title/instructions/methodology-content homework.
- Homework V2 поддерживает typed-модель:
  - `practice_text` (backward compatible),
  - `quiz_single_choice` (пошаговый мини-тест с авто-проверкой).
- В выдаче teacher может добавить `assignment comment`; выдача перенесена в модальное окно `Задать ДЗ`.
- Ученик видит дружелюбные карточки на `/dashboard`; для quiz — 1 вопрос на экран + прогресс + авто-результат.
- Родительский `/dashboard` получает read-only карточки со статусом, comment и результатом (`score/max` для quiz).
- Детали: `docs/architecture/homework-runtime-model.md`.

### Teacher IA (Step 5: runtime-коммуникация с непрерывностью контекста)

- Добавлена непрерывная коммуникация `teacher ↔ student` в контексте конкретной группы.
- Основной контейнер: `group_student_conversation` (1 conversation на пару `group + student`).
- Сообщения (`group_student_message`) поддерживают опциональные runtime-ссылки:
  - `scheduled_lesson_id` (lesson-scoped projection),
  - `scheduled_lesson_homework_assignment_id` (homework-scoped projection),
  - `topic_kind` (`general`, `lesson`, `homework`, `progress`, `organizational`).
- Полный непрерывный поток: `/groups/[groupId]/students/[studentId]/communication`.
- `/lessons/[scheduledLessonId]` показывает scoped-проекции того же conversation слоя (не отдельный silo-thread subsystem).
- Student dashboard может отвечать в том же слое (general + homework-scoped).
- Parent dashboard получает read-only проекцию сообщений по детям.
- Детали: `docs/architecture/communication-runtime-model.md`.

### Route/source-of-truth helpers

- `src/lib/auth.ts` — канонические URL-константы (`ROUTES`).
- `src/lib/routes.ts` — route-aware helpers (`isProtectedAppRoute`, `isSettingsRoute`, `isGuardedAuthRoute`, `isSafeRelativePath`).
- `src/lib/navigation-contract.ts` — session/navigation contract helpers для TopNav, Landing и server-first security gating.
- UI и redirect-политика используют эти helper'ы вместо строковых префиксов в компонентах.

## Защищённая/private зона и redirect policy

### Статусы access policy

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
Ключевые для текущего состояния auth/routing/prefs/security + lesson/runtime слоёв:

- `202603260001_init_auth_and_roles.sql`
- `202603270002_auth_onboarding_unified_signin.sql`
- `202604020001_parent_teacher_school_model.sql`
- `202604030001_user_preference_and_security.sql`
- `202604060002_lesson_content_storage.sql`
- `202604070001_group_methodology_binding.sql`
- `202604070002_homework_runtime_layer.sql`
- `202604090001_homework_typed_quiz_upgrade.sql`
- `202604070003_communication_runtime_layer.sql`
- `202604080001_enforce_group_methodology_immutability.sql`

## Безопасность секретов

- Не коммитьте реальные `.env`.
- Не храните SMTP credentials в документации.
- Используйте только placeholders (`<app-password>`, `<secret>`) и secret store.
- Если секреты могли попасть в логи/чаты/скриншоты — ротируйте их.

## Форматирование и quality gates

- `npm run format` — применяет форматирование Prettier ко всему репозиторию.
- `npm run format:check` — проверяет, что рабочее дерево уже отформатировано.
- `npm run typecheck` — строгая проверка TypeScript (`tsc --noEmit`).
- Базовый pre-merge набор: `npm run typecheck && npm run lint && npm run test && npm run build`.
- Полный прогон (включая браузерный smoke-слой): `npm run test:all`.

## CI

В репозитории добавлен workflow `.github/workflows/ci.yml`:

- `npm ci`
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`

## Стратегия тестирования (MVP)

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

### Browser smoke слой

- Добавлен минимальный browser-smoke набор: `src/lib/__tests__/auth-navigation-browser-smoke.test.ts`.
- Сценарии:
  - guest открывает `/` и видит гостевые CTA;
  - авторизованный пользователь на `/` видит auth-aware header;
  - guest на protected route (`/dashboard`) перенаправляется на `/login`;
  - авторизованный пользователь на `/login` уходит по access policy на `/dashboard`.
- Тесты запускаются в реальном браузере через `playwright`.
  - Local-friendly режим (`npm run test:browser`): если пакет `playwright` не установлен или отсутствуют browser binaries, тесты помечаются как `skip` с понятной причиной.
  - CI-strict режим (`npm run test:browser:ci`, либо `CI=true`/`REQUIRE_BROWSER_SMOKE=1`): такие же условия дают **fail**, чтобы в CI нельзя было «тихо» пропустить browser smoke.
  - Для browser server mode:
    - по умолчанию используется `BROWSER_SMOKE_SERVER_MODE=prod` (то есть `next start` на уже собранном приложении);
    - если локально сборка отсутствует, тест раннер печатает предупреждение и использует `next dev`;
    - в strict режиме fallback запрещён — сначала нужен `npm run build`.

## Teacher lesson workspace (MVP, runtime-экран исполнения)

Новый приватный teacher-only маршрут:

- `/lessons/[scheduledLessonId]`

Для быстрой dev-навигации из teacher dashboard можно указать env:

- `DEV_TEACHER_WORKSPACE_SCHEDULED_LESSON_ID=<scheduled_lesson.id>`

Минимальный путь получить рабочие данные в БД:

1. Применить миграции lesson-content.
2. Запустить bootstrap методологического контента (если используете текущий internal bootstrap flow).
3. Создать один `scheduled_lesson`, связанный с существующим `methodology_lesson` и `class`.

Пример SQL (адаптируйте `starts_at`/format):

```sql
insert into public.scheduled_lesson (
  class_id,
  methodology_lesson_id,
  starts_at,
  format,
  meeting_link,
  place,
  runtime_status,
  runtime_notes_summary,
  runtime_notes,
  outcome_notes
)
select
  c.id,
  ml.id,
  now() + interval '1 day',
  'online',
  'https://meet.example.local/dev-lesson',
  null,
  'planned',
  'Подготовить карточки и повторение тонов.',
  'Фокус на повторении приветствий.',
  'Итоговые заметки пока пустые.'
from public.class c
cross join public.methodology_lesson ml
order by c.created_at asc, ml.module_index asc, ml.lesson_index asc
limit 1
returning id;
```

После этого откройте `/lessons/<id>` под teacher-профилем.

### Teacher IA (Step 6: canonical lesson = scenario + student content + homework)

- Канонический урок теперь явно состоит из 3 частей:
  - `Сценарий урока` (teacher-only methodology execution),
  - `Контент для ученика` (learner-facing projection),
  - `Домашнее задание` (runtime issuance/submission/review).
- Добавлен source-layer для learner content: `methodology_lesson_student_content`.
- Teacher workspace `/lessons/[scheduledLessonId]` показывает 3 верхних раздела (scenario/student-content/homework).
- Добавлены learner-facing lesson room routes:
  - Student: `/lesson-room/[scheduledLessonId]`
  - Parent: `/children/[studentId]/lesson-room/[scheduledLessonId]`
- Parent видит тот же learner-facing контент, что и ученик (без teacher-only методических внутренних полей).
- Архитектурные детали: `docs/architecture/lesson-three-part-model.md`.
