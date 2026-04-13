# ShiDao

ShiDao — Next.js-приложение для операционной работы школы/преподавателя: методики, группы, уроки, домашние задания и role-aware кабинеты (teacher/parent/student).

## Быстрый старт

```bash
npm install
cp .env.example .env.local
npm run dev
```

Откройте `http://localhost:3000`.

## Обязательные переменные окружения

- `APP_SESSION_SECRET`
- `APP_SESSION_VERSION`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_SITE_URL` (или `SITE_URL`)

## Команды

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

## Канонические пользовательские поверхности

- Публично: `/`, `/login`, `/join`, `/forgot-password`, `/reset-password`, `/auth/confirm`.
- Приложение: `/onboarding`, `/dashboard`, `/groups`, `/lessons`, `/methodologies`, `/settings/*`.
- Канонический runtime-урок для всех ролей: `/lessons/[scheduledLessonId]`.

## Документация

> Do not use legacy aliases/duplicate docs as the current source of truth.

- Индекс: `docs/index.md`
- Auth и routing: `docs/authorization-routing.md`
- Доменная модель: `docs/domain-model.md`
- Текущая схема БД: `docs/database/current-schema.md`, `supabase/schema/current-schema.sql`
- Migration guidelines: `docs/database/migration-guidelines.md`
- История миграций: `docs/database/migration-history.md`, `supabase/migrations/*`
- Архив/устаревшее: `docs/archive/*`, `docs/refactors/archive/*`

## Технический стек

- Next.js App Router
- React 19 + TypeScript
- Supabase (Auth + Postgres + RLS)
