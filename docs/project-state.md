# Текущее состояние ShiDao V2

**Статус:** главный входной документ для разработки
**Актуально на:** 5 августа 2026 года
**Активная ветка:** `main`
**Рабочее приложение:** `https://v2.shidao.ru`
**Последний проверенный application release:** `1e92ed4`

Двухуровневая навигация Course → Lesson и обновлённый визуальный язык Course
routes развёрнуты и проверены на release `1e92ed4`: сплошной бежевый фон без
цветных градиентов, sticky demo header, единые контролы и облегчённая
типографика заголовков.

Текущий локальный source дополнительно добавляет teacher-only UI-shells
`/schedule` и `/students` и пункты «Расписание / Ученики / Курсы» в меню
преподавателя. Этот slice ещё не считается deployed до push, Coolify deploy и
postflight. Он не добавляет Schedule events, LessonSession, LearnerProfile,
Group или новую persistence/schema.

`v2.shidao.ru` — active deployed customer-demo contour на production-mode
build, но публичный production launch и отдельный staging ещё не выполнены.

Этот документ отвечает только на два вопроса: что действительно работает
сейчас и где это находится. Целевое развитие вынесено в
[`docs/roadmap.md`](./roadmap.md), а долгосрочная продуктовая модель — в
[`docs/v2/SHIDAO_PRODUCT_MODEL_AND_VISION.md`](./v2/SHIDAO_PRODUCT_MODEL_AND_VISION.md).

Если описание в roadmap или стратегическом документе выглядит как уже
реализованная возможность, но отсутствует здесь, считать его будущим, а не
текущим состоянием.

## 1. Каноническая модель текущего Course Builder

```text
Account
└── Course
    ├── course-wide Attachments
    └── Lesson 1..N
        ├── ordered Components 1..N
        └── Student Screen projection
            └── ordered Slides 1..N → ссылки на Components
```

- Lesson непосредственно владеет одним упорядоченным списком Components.
- `Lesson Step`, root Step, `stepId` и активной сущности Methodology нет.
- Название Lesson обязательно и хранится в самой Lesson.
- Комментарий преподавателя хранится в `lesson.summary` и не попадает в
  learner-проекцию.
- Student Screen Slide только группирует видимые ученику Components. У него
  нет собственного контента, названия или второго порядка компонентов.
- Homework является отдельной поверхностью Lesson. Сейчас это честная
  заглушка без сохранения данных.
- Материалы принадлежат Course целиком, а не отдельной Lesson.

Полные инварианты зафиксированы в
[`docs/architecture/lesson-workflow-model.md`](./architecture/lesson-workflow-model.md).

## 2. Что реализовано в текущем коде

### Auth и домены

- `shidao.ru` и `www.shidao.ru` показывают только landing.
- Любая внутренняя page/API-ссылка на основном домене закрыта middleware.
- `v2.shidao.ru` обслуживает Auth и рабочее приложение.
- `v2.shidao.ru` закрыт от индексации.
- Email signup, confirm, login, recovery и reset используют существующий
  self-hosted Supabase Auth и SMTP.
- После первого взрослого входа без профиля открывается `/onboarding`, затем
  пользователь попадает в `/courses`.
- Существующая app-session поддерживает глобальную и пользовательскую
  инвалидизацию.

### Курсы

- `/courses` показывает реальные Course текущего Account.
- `/courses/new` создаёт пустой persisted draft или запускает простой
  детерминированный assembler.
- Форма сохраняет название, тему, цель, уровень, описание аудитории,
  планируемое число уроков и приватные пожелания преподавателя.
- На форме можно загрузить изображения и документы до 10 MiB в private bucket
  `course-assets`.
- Успешная загрузка означает только «прикреплено». Parsing, OCR, embeddings и
  RAG не реализованы.
- Настройки существующего Course редактируются в модальном окне.
- Course открывается без автоматического выбора первого Lesson и содержит
  вкладки «Уроки / Описание / Источники / Материалы / История».
- «Материалы» показывают course-wide список уже прикреплённых файлов.
- «Источники» и «История» честно показывают пустое состояние: parsing/RAG и
  change history ещё не реализованы.
- В текущем source страницы `/courses`, Course и Lesson используют один
  сплошной фон `#f5f1e8`; marketing noise и цветные page gradients на этих
  маршрутах отсутствуют.
- Course header следует demo-контракту: sticky shell высотой 68 px, белая
  полупрозрачная поверхность, радиус 20 px и контролы 40 px с радиусом 12 px.
- Заголовочные секции Course и Lesson остаются прозрачными; заголовки списка,
  Course и Lesson используют системный sans-serif с demo-размерами и весом
  400, а кнопки и вкладки — единый шрифт `.88rem/500`.

### Teacher navigation, Расписание и Ученики

- В текущем локальном source основная навигация активного teacher profile
  содержит пункты «Расписание / Ученики / Курсы». Parent profile и
  transitional Student продолжают видеть только «Курсы».
- `/schedule` и `/students` находятся под отдельным teacher-required layout.
  Guest/degraded session перенаправляется в `/login`, взрослый без профиля — в
  `/onboarding`, Parent и transitional Student — в `/courses`.
- `/schedule` показывает навигацию по календарной дате и честное пустое
  состояние занятий. Ни выбранная дата, ни Schedule event не сохраняются.
- В нижней части `/schedule` читаются реальные owner-scoped Course summaries
  через существующий `GET /api/v2/courses`: преподаватель может найти Course и
  открыть его список Lessons. Course/Lesson не выдаются за запланированное
  занятие.
- `/students` показывает нулевые счётчики новых учебных профилей и групп и
  отдельно выводит реальные Course summaries, для которых audience ещё не
  назначена.
- `/students` не читает transitional `student`, `class` или `class_student`, не
  создаёт приглашения/профили/группы и не показывает фиктивные progress/history
  данные.
- Оба shell используют тот же плоский бежевый demo visual language, header,
  кнопки, карточки и типографику, что и Course routes.

### Уроки и компоненты

- На Course → «Уроки» отображается полный список Lessons и кнопка «Добавить
  урок»; редактор не открывается до явного выбора Lesson.
- После выбора Lesson backlink содержит название Course, а заголовок имеет
  формат `Урок {position}. {title}`.
- Lesson содержит вкладки «План / Экран ученика / Домашнее задание / Материалы
  / История».
- Lesson → «Материалы» является read-only проекцией course-wide attachments и
  не вводит владение файлами на уровне Lesson; «История» пока заглушка.
- Создание вручную требует только название и создаёт пустую Lesson без AI и
  без списания токенов.
- Кнопка AI в модальном окне намеренно disabled: OpenRouter ещё не подключён.
- Название и комментарий Lesson редактируются отдельной модалкой.
- Карточку Lesson нельзя перемещать или назначать на Student Screen.
- Lesson можно удалить; оставшиеся позиции уплотняются.
- Компоненты добавляются прямо в Lesson через palette по категориям.
- Компонент можно редактировать, удалить или переместить кнопками
  «выше/ниже».
- Новый Component всегда создаётся `staff_only` и не показывается ученику,
  пока преподаватель явно не назначит его на Slide.

### Экран ученика

- Голубая кнопка видимости остаётся видимой у назначенного Component.
- Меню видимости предлагает только существующие Slides, допустимые с учётом
  соседей в плане, и при допустимости — «Новый слайд».
- На одном Slide может находиться несколько соседних Components.
- Порядок Slides не может идти назад относительно единого порядка Lesson.
- При reorder видимого Component его Slide автоматически ограничивается
  ближайшим допустимым диапазоном.
- Пустые Slides удаляются, позиции Slides уплотняются.
- Встроенный и полноэкранный preview показывают один активный Slide.
- Заголовок Lesson показывается всегда; `lesson.summary`, `staff_only`
  Components и непривязанные course attachments отсутствуют в learner-ответе.
- Preview позволяет преподавателю проверить Lessons и Slides. Это не модель
  навигации будущего live-ученика.

### Component registry

Текущий code-first registry содержит ровно десять типов:

```text
heading
rich_text
callout
quote
divider
image
slideshow
single_choice_poll
matching_game
file
```

Для каждого типа registry определяет key/version, русское название, категорию,
Zod payload/placement schemas, defaults и capabilities. Текущий payload editor
использует один switch по `ComponentTypeKey`, а teacher/Student Screen
renderers — отдельную exhaustive typed map. JSON Schema для MCP генерируется из
registry contracts.

### Development MCP

В репозитории есть локальный `stdio` MCP server. Он не является HTTP endpoint и
не опубликован наружу. Зарегистрированы шесть tools:

```text
course.create_draft
course.get
course.add_lesson
lesson.add_component
lesson.set_component_student_screen
lesson.reorder_component
```

MCP вызывает `CourseBuilderApplicationService`, использует проверенный
пользовательский JWT и не обращается к таблицам напрямую. OpenRouter к нему
пока не подключён.

## 3. Что ещё не реализовано

- рабочая AI-генерация Lesson/Course и выбор модели;
- token quota, billing units и AI change sets;
- parsing/RAG прикреплённых материалов;
- добавление новых материалов из модалки существующего Course;
- persisted Homework editor;
- Learner-facing кабинет, enrollment и настоящий доступ ученика к Course;
- persisted Groups, новое нейтральное LearnerProfile и Guardian relations;
- persisted Schedule events, LessonSession, live sync и teacher-controlled
  runtime cursor;
- учебная история, прогресс и аналитика;
- chat и notifications;
- templates/marketplace;
- внешний remote MCP/API для сторонних агентов;
- отдельный staging-контур.

Перечень не является разрешением реализовать всё сразу. Приоритеты и границы
следующих срезов находятся в [`docs/roadmap.md`](./roadmap.md).

## 4. Переходное состояние identity

Новая Course-модель уже использует `account`, связанный один-к-одному с
`auth.users`. При этом старые таблицы `teacher`, `parent`, `student`, `school`,
`school_teacher`, `class`, `class_teacher` и `class_student` временно сохранены
для текущего login/onboarding/profile/session поведения.

Это compatibility identity scope, а не новая иерархия Course. Новый код
Course Builder не должен делать Course дочерним объектом School, Class,
Teacher или Methodology. Удаление или замена этих таблиц требует отдельного
identity milestone и forward migration.

Известный приоритетный security debt: `user_preference` и `user_security` в
текущем snapshot не имеют RLS и унаследовали широкие legacy grants. Новый код
не должен копировать эту модель. До расширения identity/security функций нужен
отдельный compatibility-аудит callers и tightening forward migration без
поломки login/onboarding/PIN/session invalidation.

## 5. Что удалено из активной V2

- Methodology domain и связанные страницы/API;
- `lesson_step` и `lesson_step_component`;
- scheduled-lesson, старый homework/runtime и коммуникационный слой;
- dashboard, старые groups/schedule/runtime pages, notifications и старые
  lesson workspaces;
- fixture fallback и renderers, зависящие от конкретной методики или Lesson ID.

Старая методика «Мир вокруг меня» сохранена отдельно:

- человекочитаемая и lossless-копия:
  `archive/content/world-around-me-2026-08-04/`;
- полный V1-контур: Git refs и private recovery snapshot из
  [`docs/operations/v1-recovery-runbook.md`](./operations/v1-recovery-runbook.md).

Архив не является runtime dependency. Его будущий импорт должен создать
обычные Course, Lesson, Component и attachment entities через отдельный
валидируемый importer.

## 6. Фактическая схема и migrations

Текущие V2 document tables:

```text
account
course
lesson
lesson_component
lesson_student_slide
stored_file
course_attachment
```

Последние структурные migrations:

- `20260804033421_course_lesson_components_remove_legacy_methodology.sql` —
  удаление активного Methodology/Step/runtime слоя и переход к direct Lesson
  Components;
- `20260804044955_add_lesson_student_slides.sql` — persisted Student Screen
  Slides, assignment/reorder/delete RPC и RLS/ACL.

Источники истины для текущего состояния:

1. [`docs/database/current-schema.md`](./database/current-schema.md)
2. [`supabase/schema/current-schema.sql`](../supabase/schema/current-schema.sql)

Старые migrations не переписываются и не удаляются. Все дальнейшие изменения
выполняются только новыми forward migrations после read-only sanity check
целевой базы.

Known ordering debt: DB constraints гарантируют positive+unique Lesson/Component
positions, а плотность поддерживают текущие service/delete/reorder paths.
Обычный append пока вычисляет следующую позицию перед direct INSERT, поэтому
конкурентные добавления могут столкнуться, а произвольный direct INSERT —
создать gap. Сериализация append относится к следующему integrity hardening,
не к возврату Step.

## 7. Карта реализации

| Область                     | Каноническое место                                                                                 |
| --------------------------- | -------------------------------------------------------------------------------------------------- |
| Course/Lesson contracts     | `src/modules/course-builder/contracts.ts`                                                          |
| Domain/read models          | `src/modules/course-builder/domain.ts`                                                             |
| Application service         | `src/modules/course-builder/service.ts`                                                            |
| Supabase repository         | `src/modules/course-builder/repository.ts`                                                         |
| Storage adapter             | `src/modules/course-builder/storage.ts`                                                            |
| Component registry          | `src/modules/course-builder/registry/contracts.ts`                                                 |
| MCP tools/server            | `src/modules/course-builder/mcp/`                                                                  |
| Course browser client       | `src/components/course-builder/course-builder-client.ts`                                           |
| New Course flow             | `src/components/course-builder/new-course-form.tsx`                                                |
| Course workspace            | `src/components/course-builder/course-workspace.tsx`                                               |
| Course/Lesson navigation    | `src/components/course-builder/course-workspace-navigation.ts`                                     |
| Workspace tabs/materials    | `src/components/ui/workspace-tabs.tsx`, `src/components/course-builder/course-materials-panel.tsx` |
| Lesson editor/Slides        | `src/components/course-builder/lesson-authoring-workspace.tsx`                                     |
| Component editors/renderers | `src/components/course-builder/component-payload-editor.tsx`, `component-renderers.tsx`            |
| Fullscreen preview          | `src/components/course-builder/student-screen-preview.tsx`                                         |
| Teacher Schedule shell      | `src/app/(app)/(teacher-required)/schedule/`, `src/components/teaching-hub/schedule-workspace.tsx` |
| Teacher Students shell      | `src/app/(app)/(teacher-required)/students/`, `src/components/teaching-hub/students-workspace.tsx` |
| Teacher route boundary      | `src/app/(app)/(teacher-required)/layout.tsx`, `src/lib/server/access-guards.ts`                   |
| V2 API routes               | `src/app/api/v2/`                                                                                  |
| Host boundary               | `src/middleware.ts`, `src/lib/deployment-access.ts`                                                |
| Auth/session                | `src/lib/auth.ts`, `src/lib/server/`                                                               |
| Current schema              | `supabase/schema/current-schema.sql`                                                               |
| Forward history             | `supabase/migrations/`                                                                             |

## 8. Активные пользовательские маршруты

```text
/
/login
/join
/join/check-email
/forgot-password
/reset-password
/auth/confirm
/onboarding
/schedule                         # только active teacher profile
/students                         # только active teacher profile
/courses
/courses/new
/courses/[courseId]
/courses/[courseId]/student-preview
/settings/profile
/settings/security
```

V2 Course API находится под `/api/v2/`. У `/schedule` и `/students` нет новых
mutation API: оба shell переиспользуют только существующее owner-scoped чтение
Course summaries. Старые dashboard/methodology/group/scheduled-lesson routes не
поддерживаются как compatibility URL.

Дополнительные project surfaces:

- `brand.shidao.ru` → brand reference;
- `model.shidao.ru` → публичное объяснение модели;
- `demo.shidao.ru` → redirect на `v2.shidao.ru/courses`.

Known host-boundary debt: middleware переписывает только `/` у `brand`/`model`
и пропускает unknown hosts; noindex применяется только к exact V2 host.
Изоляция дополнительных paths сейчас зависит от proxy/DNS. До публичного
launch нужен explicit production host allowlist или закрытие non-canonical
hosts/paths. Кроме того, CSRF guard сейчас включает configured landing host
`shidao.ru` в allowlist запроса к V2, поэтому cross-subdomain Origin не
отклоняется как strict cross-origin. P0 должен привязать guard к actual app host
и добавить negative regression test.

## 9. Проверка текущего состояния

Стандартный локальный набор:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

Дополнительно:

```bash
npm run test:browser
npm run test:browser:ci
npm run format:check
npm run mcp:course-builder
```

`test:browser` допускает локальный skip без browser, а `test:browser:ci`
является строгим production-mode gate.

Текущий browser-smoke helper использует актуальную AES-GCM app-session с
Supabase access/refresh tokens. Строгий gate сам собирает production-приложение
против локального mock Supabase, поэтому build-time `NEXT_PUBLIC_*` и runtime
конфигурация совпадают и тест не обращается к рабочей базе. Воспроизводимый
результат `npm run test:browser:ci` для текущего source candidate: 8 сценариев
pass, включая teacher-навигацию Schedule → Students, мобильное меню
«Расписание / Ученики / Курсы», авторизованный переход Course → Lesson →
backlink обратно к Course, computed visual contract и mobile 375 px без
document-level overflow.

Repository-wide `npm run format:check` также пока не является зелёным baseline:
он сообщает десятки ранее существовавших файлов, включая immutable content
archive и unrelated application sources. Все изменённые в этом documentation slice
Markdown files проходят targeted Prettier check и `git diff --check`. Перед
обязательным global format gate нужен отдельный baseline/ignore change без
переформатирования archive.

На application release `1e92ed4` подтверждены typecheck, lint, 175 unit tests,
production build и строгие 6/6 browser smoke, включая Course → Lesson →
backlink, computed visual contract и mobile viewport. Teacher-only
`/schedule`/`/students` source candidate отдельно прошёл typecheck, lint, 183
unit tests, production build и строгие 8/8 browser smoke. До push и deployed
authorization/navigation postflight он не входит в подтверждённый deployed
baseline.

## 10. Правило обновления этого документа

После каждого законченного vertical slice агент обязан:

1. перенести реализованные пункты из roadmap в этот документ;
2. обновить карту реализации, routes, tools и schema state;
3. отметить честные ограничения и заглушки;
4. обновить связанные канонические документы;
5. не описывать запланированную возможность в прошедшем времени до проверки в
   deployed или согласованном тестовом окружении.
