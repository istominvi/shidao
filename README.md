# ShiDao V2

ShiDao V2 — работающий teacher Course Builder на Next.js и текущем
self-hosted Supabase. Текущий source также содержит teacher-only navigation
shells «Расписание» и «Ученики». Каноническая авторская модель:

```text
Course
└── Lesson
    ├── ordered Components
    └── Student Screen Slides (presentation projection)
```

Фактическое состояние приложения и карта кода:
[`docs/project-state.md`](docs/project-state.md). Следующие этапы:
[`docs/roadmap.md`](docs/roadmap.md).

## Быстрый старт

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Откройте `http://localhost:3000`.

## Переменные окружения

Обязательные runtime secrets/config:

- `APP_SESSION_SECRET`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Обязательная явная production-конфигурация доменов:

- `NEXT_PUBLIC_SITE_URL` — публичный landing (`https://shidao.ru`)
- `NEXT_PUBLIC_APP_URL` — рабочее приложение/Auth callback
  (`https://v2.shidao.ru`)

Optional values с defaults в коде:

- `APP_SESSION_VERSION=1`
- `APP_SESSION_TTL_HOURS=48`

`SUPABASE_SERVICE_ROLE_KEY` используется только в явно привилегированных
server boundaries. Обычный Course Builder и development MCP работают с
пользовательским JWT.

## Команды

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

Дополнительно:

```bash
npm run test:browser
npm run test:browser:ci
npm run test:all
npm run format:check
npm run mcp:course-builder
```

`test:browser` удобен локально и может пропустить smoke без доступного browser;
`test:browser:ci` требует полноценного production-mode browser smoke и падает,
если окружение к нему не готово. Известный текущий harness debt описан в
[`docs/project-state.md`](docs/project-state.md); до исправления этот gate нельзя
считать пройденным. Там же зафиксирован существующий repository-wide Prettier
baseline debt; изменённую документацию проверяйте targeted `prettier --check`.

## Канонические пользовательские поверхности

- Публично: `/`, `/login`, `/join`, `/join/check-email`,
  `/forgot-password`, `/reset-password`, `/auth/confirm`.
- Приложение: `/onboarding`, `/courses`, `/courses/new`,
  `/courses/[courseId]`, `/courses/[courseId]/student-preview`,
  `/settings/profile`, `/settings/security`.
- Только active teacher profile: `/schedule`, `/students`. Parent и
  transitional Student перенаправляются с этих routes в `/courses`.
- Рабочий app-домен: `v2.shidao.ru` — active deployed customer-demo contour.
- `shidao.ru` остаётся landing-only.
- `brand.shidao.ru` и `model.shidao.ru` — отдельные публичные reference
  surfaces; `demo.shidao.ru` перенаправляет в Course Builder.

## Текущее состояние продукта

Lesson непосредственно владеет одним упорядоченным списком компонентов:

- `План урока` показывает полный список;
- новые Components приватны по умолчанию;
- `Экран ученика` получает только явно назначенные `learner_visible`
  Components, сгруппированные в persisted Slides без второго component order;
- заголовок и комментарий преподавателя являются полями Lesson;
- материалы хранятся как course-wide attachments в private Storage;
- сущности Lesson Step/root Step в активной V2 нет.

Teacher navigation содержит «Расписание / Ученики / Курсы». `/schedule` и
`/students` используют реальные owner-scoped Course summaries и честные пустые
состояния для ещё отсутствующих данных. Schedule events/LessonSession,
LearnerProfile, Group, invitation и audience persistence не реализованы;
transitional `student/class/class_student` для этих shells не используются.
Новых таблиц или migrations этот UI-slice не добавляет.

Десять типов компонентов определены в code-first registry. UI, application
service и development-only MCP используют общие Zod contracts; MCP не работает
с таблицами напрямую и не опубликован как внешний endpoint. OpenRouter,
parsing/RAG, persisted Homework, live sessions и learner product пока не
реализованы.

Подробная каноническая модель: `docs/architecture/lesson-workflow-model.md`.

## Документация: порядок чтения

- Текущее состояние: `docs/project-state.md`
- Roadmap: `docs/roadmap.md`
- Auth и routing: `docs/authorization-routing.md`
- Модель урока: `docs/architecture/lesson-workflow-model.md`
- Реализованный первый milestone: `docs/v2/TEACHER_COURSE_BUILDER_DEMO_MILESTONE.md`
- Development MCP: `docs/v2/COURSE_BUILDER_MCP.md`
- Текущая схема БД: `docs/database/current-schema.md`, `supabase/schema/current-schema.sql`
- Правила migrations: `docs/database/migration-guidelines.md`
- Полный индекс: `docs/index.md`

## Технический стек

- Next.js App Router
- React 19 + TypeScript
- Zod code-first contracts
- Supabase Auth, Postgres, RLS и private Storage
