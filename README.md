# ShiDao

ShiDao — Next.js продукт для методико-ориентированного обучения: маркетинговая витрина, auth-контур, защищённый продуктовый контур с ролевыми кабинетами (teacher/parent/student), и Supabase-backed data/auth слой.

## Быстрый старт

```bash
npm install
cp .env.example .env.local
npm run dev
```

Откройте `http://localhost:3000`.

## Runtime env (минимум)

- `APP_SESSION_SECRET` — минимум 32 символа.
- `APP_SESSION_VERSION` — версия инвалидации app-session cookie.
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_SITE_URL` (или `SITE_URL`)

Сгенерировать секрет:

```bash
openssl rand -hex 32
```

## Команды

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

## Основные поверхности приложения

- `/(marketing)` — публичный лендинг.
- `/(auth)` — login/join/recovery/confirm.
- `/(app)` — onboarding + защищённые product-маршруты.
- `/dashboard` — role-aware дашборд.
- `/groups`, `/lessons`, `/methodologies`, `/settings/*` — основной teacher runtime.

## Где что документировано

См. единый индекс документации: [`docs/index.md`](docs/index.md).

Ключевые документы:

- Архитектура: `docs/architecture/*`
- Auth и routing: `docs/authorization-routing.md`
- Доменная модель: `docs/domain-model.md`
- Email auth runbook: `docs/email-auth-selfhosted-supabase.md`
- Миграции и hygiene заметки: `supabase/migrations/*`, `docs/database/*`
- Отчёты рефакторинга: `docs/refactors/*`

## База данных и миграции

- SQL-миграции: `supabase/migrations`.
- Перед запуском в окружении применяйте **все** миграции.
- Seed/демо-данные, оставшиеся в миграциях раннего MVP, отражены в `docs/database/schema-hygiene-2026-04-12.md`.

## Технологии

- Next.js App Router
- React 19
- TypeScript
- Supabase (Auth + Postgres + RLS)
