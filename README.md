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


## Product architecture (lesson workflow)

ShiDao — methodology-driven платформа: урок строится как единая последовательность шагов, где синхронизированы:

- teacher side (`План урока`),
- learner side (`Экран ученика`).

В live-уроке переходы между шагами контролирует преподаватель; ученик не должен свободно переключать шаги по умолчанию. После завершения урока тот же `Экран ученика` становится режимом повторения с свободной навигацией. Видеозвонок сейчас внешний (Zoom/Meet/Telegram и т.д.): ShiDao хранит/открывает meeting link и поддерживает сценарий screen-share student screen.

Подробная каноническая модель: `docs/architecture/lesson-workflow-model.md`.

## Документация

- Индекс: `docs/index.md`
- Auth и routing: `docs/authorization-routing.md`
- Доменная модель: `docs/domain-model.md`
- Текущая схема БД: `docs/database/current-schema.md`, `supabase/schema/current-schema.sql`
- История миграций: `docs/database/migration-history.md`, `supabase/migrations/*`

## Технический стек

- Next.js App Router
- React 19 + TypeScript
- Supabase (Auth + Postgres + RLS)
