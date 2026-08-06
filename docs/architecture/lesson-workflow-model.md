# Lesson workflow model

**Статус:** canonical V2 product architecture

**Дата решения:** 5 августа 2026 года

**Актуально на:** 6 августа 2026 года

**Область:** Course Builder / Lesson / Components / Student Screen / course materials / homework

**Implementation state:** authoring, persisted Slides, preview и RouterAI
Course/Lesson/assistant surfaces развёрнуты на `v2.shidao.ru`; runtime API key
настроен server-side. Release `0276aed` и authenticated no-write postflight
подтвердили `google/gemini-2.5-flash-lite`; Homework/live остаются будущими
срезами

## Product decision

Каноническая авторская модель ShiDao V2:

```text
Course
├── course-wide attachments
└── Lesson 1..N
    ├── ordered Components 1..N
    └── Student Screen projection
        └── ordered Slides 1..N → component references
```

`Lesson` непосредственно владеет одним упорядоченным списком компонентов.
Между Lesson и Component нет сущности `Lesson Step`, скрытого/root step,
группы совместимости или второго порядка компонентов. `Student Screen Slide` —
это persisted-проекция: он только группирует learner-visible компоненты
для показа и не имеет title, content, teacher instructions или
независимого component order.

Это решение относится к domain model, базе, UI, application service, MCP и
AI-orchestration. Упрощённое отображение без шагов — не временная UI-проекция,
а каноническая структура V2.

## Vocabulary

- **Course / Курс** — личный persisted-документ владельца с уроками и
  course-wide вложениями.
- **Lesson / Урок** — редактируемый документ внутри Course. Название обязательно
  и хранится в самой Lesson; комментарий преподавателя хранится в `summary`.
- **Lesson Component / Компонент урока** — элемент единого ordered list Lesson.
- **Student Screen Slide / Слайд экрана ученика** — упорядоченная
  группа соседних по плану learner-visible компонентов; не является
  Step или авторским блоком.
- **План урока** — teacher-facing редактор полного списка компонентов.
- **Student Screen / Экран ученика** — learner-facing проекция той же Lesson,
  содержащая только разрешённые ученику компоненты.
- **Материалы курса** — course-wide файлы и изображения, загруженные в private
  Storage и связанные с Course.
- **Домашнее задание** — отдельная поверхность выбранной Lesson.
- **Preview / Предпросмотр** — режим проверки Student Screen внутри Course или
  на отдельной полноэкранной странице.

Термины `Content` для Student Screen, `Lesson Step`, `root step`, `stepId` и
`Methodology` как активная V2-модель не используются.

## Canonical data contract

Минимальная Lesson:

```text
lesson
- id
- course_id
- position
- title
- summary
- created_at
- updated_at
```

Минимальный Component:

```text
lesson_component
- id
- lesson_id
- type_key
- schema_version
- position
- payload
- placement (`placement_config` в PostgreSQL)
- visibility: staff_only | learner_visible
- student_slide_id: uuid | null
- created_at
- updated_at
```

Минимальная Student Screen Slide:

```text
lesson_student_slide
- id
- lesson_id
- position
- created_at
- updated_at
```

Инварианты:

1. `lesson_id` указывает непосредственно на Lesson.
2. `position` задаёт единственный порядок компонентов внутри Lesson.
3. Позиции после mutation остаются плотными и уникальными в пределах Lesson.
4. Payload и placement валидируются schema выбранного registry type.
5. Заголовок Lesson не создаётся автоматически как компонент `heading`.
6. Пустая Lesson допустима.
7. Component не может существовать без Lesson или одновременно принадлежать
   нескольким Lesson.
8. `staff_only` всегда имеет `student_slide_id = null`, а `learner_visible`
   всегда ссылается на Slide той же Lesson.
9. Slide positions плотные и уникальные; пустых Slides нет.
10. При проходе компонентов по `component.position` номер Slide не
    может уменьшаться.

Это invariants поддерживаемого application/RPC path. Для Lesson/Component DB
напрямую гарантирует positive+unique position; gapless append и concurrency
пока зависят от service path и требуют запланированной сериализации.

## Code-first component registry

Каждый тип компонента определяется один раз в code-first registry. Определение
содержит стабильный key/version, категорию и русское название, payload schema,
placement schema, default payload/placement и capabilities.

Текущий payload editor является единым switch-based React editor по
`ComponentTypeKey`; teacher/Student Screen renderers собраны в отдельной
exhaustive typed map. Оба слоя используют registry schemas/types и проверяются
contract tests. Registry остаётся источником contracts/JSON Schema, а React
implementation не встраивается в serializable definition.

UI, application service и MCP используют эти же contracts. JSON Schema для MCP
генерируется из того же источника. Добавление типа компонента не требует новой
таблицы и не создаёт отдельную React-страницу для конкретной Lesson.

Обязательный первый registry:

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

## Teacher plan

План выбранной Lesson показывает `lesson.components` в ascending `position`.
Преподаватель может:

- добавить компонент из palette;
- изменить его payload и placement;
- переместить выше или ниже во всём списке Lesson;
- удалить компонент;
- назначить компонент на допустимый Slide, создать для него новый
  Slide или убрать его с Student Screen.

На карточке teacher видит состояние видимости. `staff_only` означает, что
компонент остаётся частью плана преподавателя, но отсутствует в learner API.
Приватность обеспечивается server projection и authorization, а не только CSS.

## Student Screen

Student Screen строится детерминированно:

```text
lesson.studentSlides by slide.position
→ components where student_slide_id == slide.id
→ preserve component.position inside every Slide
→ render one active Slide through the typed Student Screen renderer map
```

Обязательный `lesson.title` всегда показывается над active Slide и не
требует отдельного `heading` component. Teacher comment `lesson.summary`
никогда не включается в learner response и не рендерится на Student Screen.

Slide хранит только grouping и position самой группы. У Student Screen нет
собственной копии payload или параллельного component order. Изменение payload
или порядка сохраняется один раз и после reload одинаково отражается в
teacher preview и learner projection. Новый Component всегда создаётся
`staff_only`; публикация на Slide — отдельное явное действие.

Для назначения на existing Slide UI и service предлагают только диапазон
между ближайшими learner-visible соседями в плане. Новый Slide
вставляется между этими границами; он не может разделить двух соседов,
уже находящихся на одном Slide. Reorder оставляет `component.position`
каноническим и при необходимости автоматически переносит перемещённый
видимый компонент на ближайший допустимый Slide.

Если learner-visible компонентов нет, отображается честное пустое состояние.
Teacher-private компоненты и поля не должны присутствовать в learner response.

Полноэкранный preview может позволять преподавателю переключать Lesson для
проверки курса. Это не задаёт правила будущего live-режима для учащегося.

## Course workspace navigation

Course и Lesson образуют два последовательных уровня навигации. Открытие
`/courses/[courseId]` не выбирает первый Lesson автоматически: сначала
показывается Course header и список уроков.

Вкладки Course:

1. **Уроки** — полный ordered list Lesson и создание нового Lesson;
2. **Описание** — текущие поля Course;
3. **Источники** — честное пустое состояние до parsing/RAG;
4. **Материалы** — course-wide attachments;
5. **История** — честное пустое состояние до появления change history.

После явного выбора Lesson header показывает backlink с названием Course и
заголовок `Урок {position}. {lesson.title}`. Вкладки Lesson:

1. **План**;
2. **Экран ученика**;
3. **Домашнее задание**;
4. **Материалы**;
5. **История**.

Lesson-вкладка **Материалы** является только read-only проекцией того же
course-wide каталога. Она не создаёт lesson attachment, не копирует StoredFile
и не означает, что материал назначен конкретному Lesson. **История** пока не
записывает фиктивные события, а Homework остаётся отдельной честной заглушкой.

Текущий slice не добавляет отдельный Lesson URL или schema: Course/Lesson view
и вкладки переключаются внутри `/courses/[courseId]`. После reload снова
открывается Course → **Уроки**.

Visual contract Course routes не меняет эту навигационную или доменную модель:

- page background — сплошной `#f5f1e8` без цветных marketing gradients;
- product header — sticky demo shell высотой 68 px с радиусом 20 px;
- основные кнопки, header controls и tabs — высотой 40 px с радиусом 12 px и
  единым шрифтом `.88rem/500`;
- заголовочные секции Course и Lesson прозрачны, а их H1 используют
  системный sans-serif, вес 400 и отдельный detail scale;
- visual tokens переиспользуются Course routes и teacher teaching-hub shells,
  но не меняют landing, Auth, Settings или полноэкранный Student Screen.

## Teaching hub navigation boundary

Release `fea7f80` добавляет teacher-only `/schedule` и `/students` рядом с
`/courses`. Это навигационный и визуальный slice, а не изменение canonical
Course/Lesson model:

- server layout допускает только active teacher profile; Parent и transitional
  Student перенаправляются в `/courses`;
- оба shell читают реальные owner-scoped Course summaries через существующий
  Course Builder API;
- `/schedule` показывает выбранную календарную дату и пустое состояние, но не
  сохраняет Schedule event и не создаёт `LessonSession`;
- Course и Lesson в очереди будущего планирования остаются авторскими
  документами и не становятся проведёнными занятиями;
- `/students` показывает нулевое состояние будущих LearnerProfile/Group и
  Courses без persisted audience;
- старые `student`, `class` и `class_student` не используются как источник
  новой learning identity;
- новых таблиц, migrations, API mutation или MCP tools этот slice не добавляет.

## Lesson creation

Кнопка «Добавить урок» открывает modal. Текущий manual create требует название
Lesson и создаёт пустую Lesson. Teacher comment редактируется затем в модалке
настроек Lesson и сохраняется в `summary`.

Ручное создание сохраняет пустую Lesson и не расходует AI tokens. Начиная с
release `3a94878` production UI включает два AI-flow:

- новая Lesson: provider готовит preview comment + Components, а Lesson
  создаётся только после отдельного Apply;
- существующая Lesson: provider готовит preview дополнения, а Apply обновляет
  teacher comment и добавляет Components в конец текущего ordered list, не
  заменяя существующие.

До Apply provider call не выполняет persistence mutation. Provider-compatible
flat transport output сначала преобразуется в canonical AI plan, затем payload
повторно валидируется registry contracts, сверяется с исходными
Lesson/Component IDs и создаёт те же Lesson/Component entities через application
service. Новые Components остаются `staff_only`; AI не создаёт Student Screen
Slide и не публикует материал ученику автоматически.

## Course materials and Storage

Course attachment:

- загружается в существующий private Storage;
- имеет owner/course relation, MIME type, размер и checksum;
- открывается через ограниченный signed access;
- может быть указан в payload `image`, `slideshow` или `file` после проверки
  ownership;
- не считается проанализированным только из-за успешной загрузки.

OCR, parsing, embeddings и RAG — отдельный pipeline. Отсутствие этого pipeline
не блокирует ручное использование файла в Lesson.

В текущем UI новые attachments загружаются при создании Course; modal
существующего Course пока только показывает уже прикреплённые материалы.
Добавление материалов после создания — следующий authoring slice.

## Homework

Homework принадлежит выбранной Lesson, но не входит в `lesson.components`.
Текущий deployed UI содержит честную заглушку редактора без fixture или
localStorage. Persisted homework получит отдельные contracts, authorization и
storage model без возврата групп/шагов в Lesson.

## Application service and MCP

Канонические минимальные commands/tools:

```text
course.create_draft
course.get
course.add_lesson
lesson.add_component
lesson.set_component_student_screen
lesson.reorder_component
```

`lesson.add_component` принимает `lessonId`, registry type, payload и placement,
создаёт Component в конце Lesson и не публикует его ученику.
`lesson.set_component_student_screen` выполняет `hide | existing | new` через
тот же application service. Reorder работает в пределах всего ordered list
выбранной Lesson и сохраняет Slide invariants.

MCP — development/internal thin adapter над теми же application services. Он:

- не обращается к таблицам напрямую;
- не принимает и не возвращает `stepId`;
- не регистрирует tool добавления шага;
- использует actor JWT, ownership/RLS для обычных операций и явную
  Auth → Account → Course ownership-проверку в сериализованных component RPC;
- сейчас не публикуется как внешний endpoint.

Implementation map:

- contracts/registry: `src/modules/course-builder/registry/contracts.ts`;
- application service: `src/modules/course-builder/service.ts`;
- repository: `src/modules/course-builder/repository.ts`;
- MCP: `src/modules/course-builder/mcp/`;
- AI provider/contracts/service: `src/modules/ai/`;
- AI routes: `src/app/api/v2/courses/[courseId]/ai-*/` и `assistant/`;
- authoring UI: `src/components/course-builder/lesson-authoring-workspace.tsx`;
- current schema: `supabase/schema/current-schema.sql`;
- Slide migration: `20260804044955_add_lesson_student_slides.sql`.

## AI boundary

AI не получает SQL/service-role доступ. Текущий production AI-срез использует
server-only RouterAI adapter и per-request actor из authenticated Course Builder
context. Production web не запускает локальный `stdio` MCP: после explicit
teacher Apply AI-service вызывает typed application commands напрямую.
Детерминированный assembler, ручной редактор и AI создают одинаковые
Lesson/Component entities; смена planning strategy не меняет domain model или
renderer contracts.

Course/Lesson generation строго разделяет read-only planning и persistence:

```text
provider call → validated preview → teacher confirmation → application commands
```

Assistant является отдельным read-only ephemeral flow. Он может видеть
ограниченный Course context и выбранную Lesson, но не вызывает commands/tools и
не утверждает, что изменил данные. Dialog history хранится только в React state
и не переживает close/reload.

Модель получает teacher context, но не file contents, signed URLs или Storage
credentials. Для attachments передаются только filename/MIME/status; parsing,
OCR, embeddings и RAG отсутствуют. Поэтому нельзя утверждать, что attachment
прочитан или использован моделью.

Provider request ID/model/token usage возвращаются UI и пишутся в ограниченный
metadata log. Persistent quota/ledger, billing и AI change sets не реализованы;
process-local rate limit не является балансом пользователя. AI-срез не добавляет
таблицы, RPC или migration.

Полный provider, security, preview/apply и deployment contract находится в
[`ai-provider-integration.md`](./ai-provider-integration.md).

## Runtime and future live mode

Shipped milestone реализовал persisted authoring и preview, а не live sync.
Будущий `LessonSession` остаётся отдельным исполнением Lesson. Live-mode
presentation cursor может ссылаться на текущий Student Screen Slide, не меняя
authored hierarchy и не создавая Step entity.

В live mode по умолчанию teacher управляет learner surface; свободная
предыдущая/следующая навигация учащегося не включается автоматически. Review
может разрешить свободное изучение learner-visible компонентов.

## Active V2 versus archive

Активная V2 не содержит Methodology domain, methodology tables, fixture
fallback или lesson-specific renderer. Исторический источник сохранён в трёх
границах:

- tracked content archive `archive/content/world-around-me-2026-08-04/`;
- immutable V1 Git refs;
- private `.local-backups` recovery snapshot.

Ни одна из них не является runtime dependency.

Импорт архивного содержания, если он будет отдельно одобрен, обязан создать
обычные Course, Lesson, Component и attachment entities через валидируемый
import/application layer. Он не возвращает Methodology в активную модель.

### Standalone demo boundary

`demo.shidao.ru` отдельно обслуживает восстановленный исторический
кликабельный UI-прототип. Его фиктивные Course/Lesson, локальные Lesson Step,
Methodology, schedule/group, AI и live-сценарии существуют только в
`src/app/demo/demo-experience.tsx` и React state. Demo использует Guest session,
не обращается к V2 API/Supabase и после reload теряет локальные изменения.

Этот public reference surface не является частью active V2 domain, runtime
fallback, importer или acceptance evidence. Активные Course/Lesson routes,
application services и MCP не импортируют demo fixtures; все новые product
возможности по-прежнему обязаны следовать canonical
`Course → Lesson → ordered Components` contract.

## Not implemented yet

- write-capable AI assistant, persisted assistant history и tool calling;
- persistent AI quota/ledger, billing и change sets/undo;
- parsing/RAG загруженных файлов;
- persisted homework editor;
- persisted scheduling, LessonSession и live sync;
- drag-and-drop, если надёжные кнопки «выше/ниже» уже обеспечивают reorder;
- внешняя публикация MCP;
- compatibility layer для Step/Methodology не планируется;
- отдельные renderers по Course/Lesson ID.

## Shipped acceptance baseline

На release `fea7f80` проверено:

1. Course, Lesson, ordered Components и attachments сохраняются в реальной
   базе/Storage и переживают reload.
2. Lesson создаётся без Step/root Step и может оставаться пустой.
3. Component создаётся непосредственно по `lessonId`.
4. Teacher plan показывает весь единый ordered list.
5. Student Screen показывает только явно назначенные components,
   сгруппированные в упорядоченные Slides без второго component order.
6. Teacher-private данные отсутствуют в learner projection.
7. Reorder изменяет порядок во всей Lesson и автоматически не допускает
   обратный порядок Slides.
8. UI, service и MCP валидируют данные общими registry contracts.
9. В активном V2 нет Methodology/fixture/lesson-specific fallback.
10. Fullscreen preview сохраняет выбранную Lesson, показывает один
    active Slide и после refresh читает persisted state.
11. Course сначала показывает пять собственных вкладок и список Lessons;
    выбранная Lesson показывает отдельный H1, backlink с названием Course и
    пять Lesson-вкладок.
12. Teacher header показывает «Расписание / Ученики / Курсы», а server guard
    не открывает teacher-only shells Guest, Parent или transitional Student.

Также прошли typecheck, lint, 183 unit tests, production build и строгие 8/8
browser smoke, включая teacher navigation, computed-style и mobile contracts.
Coolify и deployed browser postflight подтвердили точный SHA `fea7f80`, guest
redirect и авторизованные `/schedule`, `/students` и `/courses`.

Release `0276aed` дополнительно подтвердил RouterAI routes/UI, server-only
runtime configuration и model `google/gemini-2.5-flash-lite`. Provider smoke
проверил строгие Course/Lesson outputs, а authenticated `v2.shidao.ru` smoke —
assistant и Lesson preview без Apply. Preview был отменён, поэтому production
Course data не изменились.
