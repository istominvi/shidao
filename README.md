# ShiDao V2

ShiDao V2 — работающее roleless Account-приложение с Course Builder на Next.js
и текущем self-hosted Supabase. Current production содержит разделы «Расписание»,
«Ученики», «Курсы» и UI-only demo «Магазин», reusable Groups, смешанную аудиторию детского Course,
историю проведений, learner identity/self/observer surfaces и official
educator Course с Account-scoped самообучением, progress и аттестацией.
Каноническая модель:

```text
Account → TeacherLearner → canonical LearnerProfile
        ├── LearnerGroup
        └── Course → Lesson → ordered Components
                            ├── Student Screen Slides
                            └── LessonRun → LearningRecord

Account → approved educator Course revision
        └── self-enrollment → Lesson completion → Attestation attempt/award
```

Фактическое состояние приложения и карта кода:
[`docs/project-state.md`](docs/project-state.md). Следующие этапы:
[`docs/roadmap.md`](docs/roadmap.md). Границы магазина:
[`docs/product/store-demo.md`](docs/product/store-demo.md).

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
если окружение к нему не готово. Текущий deployed source —
`8e5d169dab72dc285c0fdfe8991646152d9904c7`; этот exact deployed release прошёл
`579/579` unit/API и `23/23` strict production-mode browser scenarios,
typecheck, lint, format и production build.
Functional E2 release
`22b486a7163453019d9720cb4fe0f36ed7c0228d` сохранён как исторический baseline,
а exact gate и running-container evidence находятся в
[`docs/project-state.md`](docs/project-state.md).

## Канонические пользовательские поверхности

- Публично: `/`, `/login`, `/join`, `/join/check-email`,
  `/forgot-password`, `/reset-password`, `/auth/confirm`.
- Приложение: `/onboarding`, `/schedule`, `/students`, `/store`, `/courses`,
  `/courses/new`, `/courses/[courseId]`,
  `/courses/catalog/[publicationId]`,
  `/courses/[courseId]/student-preview`, `/learning-profile`,
  `/settings/profile`, `/settings/security`, `/settings/observers` и
  `/identity/invitations/[invitationId]`. Все эти shells используют Account
  session; resource access остаётся relation/ownership-scoped.
- Canonical observer surface — `/students?tab=observing`; `/observing` сохранён
  как protected compatibility redirect.
- Рабочий app-домен: `v2.shidao.ru` — active production-контур.
- `shidao.ru` остаётся landing-only.
- `brand.shidao.ru` и `model.shidao.ru` — отдельные публичные reference
  surfaces.
- `demo.shidao.ru` обслуживает восстановленный standalone UI-прототип с
  фиктивными данными. Его clean paths работают после reload, но он не читает и
  не записывает данные V2 и не является описанием текущей domain model.

## Текущее состояние продукта

Lesson непосредственно владеет одним упорядоченным списком компонентов:

- `План урока` показывает полный список;
- новые Components приватны по умолчанию;
- `Экран ученика` получает только явно назначенные `learner_visible`
  Components, сгруппированные в persisted Slides без второго component order;
- заголовок и комментарий преподавателя являются полями Lesson;
- материалы хранятся как course-wide attachments в private Storage;
- сущности Lesson Step/root Step в активной V2 нет.

Current production primary Account navigation содержит «Расписание / Ученики /
Курсы / Магазин». `/store` является client-state UI-only demo: реального
заказа, оплаты, доставки, API или schema для commerce нет.
`/schedule` и `/students` используют persisted LessonRun, canonical LearnerProfile,
teacher-local `teacher_learner`, Groups и LearningRecord. В Course независимо
прикрепляются отдельные ученики и группы; пересечения дедуплицируются. Один
профиль может быть связан с несколькими преподавателями, но локальные имена,
архивирование, история и AI-context каждого преподавателя изолированы через
`teacher_learner` и `recorded_by_account_id`. Transitional
`student/class/class_student` для этой модели не используются.

Account claim, invitations, observers, duplicate-profile merge, learner-safe
history/progress и consented cross-provider AI context реализованы в roleless
Account/learner identity slice. Current production primary navigation содержит
«Расписание / Ученики / Курсы / Магазин». Учебный профиль находится в Account
menu, а observer projection —
во вкладке «Наблюдение» внутри «Ученики».

Двадцать типов компонентов определены в code-first registry. UI, application
service и development-only MCP используют общие Zod contracts; MCP не работает
s таблицами напрямую и не опубликован как внешний endpoint. Server-only
RouterAI preview/apply и global System Assistant с подтверждаемым mutation
allowlist уже реализованы; parsing/RAG,
persisted Homework, live sessions и LearnerProfile-scoped consumption детского
Course пока отсутствуют. Account-scoped самостоятельное прохождение approved
educator Course, revision progress и аттестация уже являются current
production.

Подробная каноническая модель: `docs/architecture/lesson-workflow-model.md`.

## Документация: порядок чтения

- Текущее состояние: `docs/project-state.md`
- Roadmap: `docs/roadmap.md`
- Auth и routing: `docs/authorization-routing.md`
- Модель урока: `docs/architecture/lesson-workflow-model.md`
- Identity и доступ: `docs/architecture/learner-identity-access-model.md`
- Курсы для педагогов и аттестация:
  `docs/product/educator-courses-and-attestation.md`
- Каталог типов компонентов: `docs/product/course-component-catalog.md`
- Демо-магазин: `docs/product/store-demo.md`
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
