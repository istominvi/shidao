# ShiDao

ShiDao V2 — Next.js-приложение для создания курсов и уроков преподавателем.
Рабочая модель: `Course → Lesson → ordered Components`.

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
- Приложение: `/onboarding`, `/courses`, `/courses/new`,
  `/courses/[courseId]`, `/courses/[courseId]/student-preview`, `/settings/*`.
- Рабочий production-домен: `v2.shidao.ru`.
- `shidao.ru` остаётся landing-only.


## Product architecture (lesson workflow)

Lesson непосредственно владеет одним упорядоченным списком компонентов:

- `План урока` показывает полный список;
- `Экран ученика` получает только `learner_visible` компоненты в том же
  относительном порядке;
- заголовок и комментарий преподавателя являются полями Lesson;
- материалы хранятся как course-wide attachments в private Storage;
- сущности Lesson Step/root Step в активной V2 нет.

Десять типов компонентов определены в code-first registry. UI, application
service и development-only MCP используют общие Zod contracts; MCP не работает
с таблицами напрямую.

Подробная каноническая модель: `docs/architecture/lesson-workflow-model.md`.

## Документация

- Индекс: `docs/index.md`
- Auth и routing: `docs/authorization-routing.md`
- Модель урока: `docs/architecture/lesson-workflow-model.md`
- Первый milestone: `docs/v2/TEACHER_COURSE_BUILDER_DEMO_MILESTONE.md`
- Development MCP: `docs/v2/COURSE_BUILDER_MCP.md`
- Текущая схема БД: `docs/database/current-schema.md`, `supabase/schema/current-schema.sql`
- История миграций: `docs/database/migration-history.md`, `supabase/migrations/*`

## Технический стек

- Next.js App Router
- React 19 + TypeScript
- Supabase (Auth + Postgres + RLS)
