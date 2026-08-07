# Lesson workflow model

**Статус:** canonical V2 product architecture

**Дата решения:** 5 августа 2026 года

**Актуально на:** 7 августа 2026 года

**Область:** Course Builder / Lesson / Components / Student Screen / audience / scheduling / learning history / course materials / homework

**Implementation state:** authoring, persisted Slides, preview и RouterAI
Course/Lesson/assistant surfaces развёрнуты на `v2.shidao.ru`; runtime API key
настроен server-side. Release `0276aed` и authenticated no-write postflight
подтвердили `google/gemini-2.5-flash-lite`. В current repository реализованы
LearnerProfile, reusable LearnerGroup, смешанная Course audience, LessonRun и
LearningRecord. Базовый LessonRun release `fa91371` и group/audience release
`9393080` развёрнуты и проверены. Current repository дополнительно разделяет
canonical LearnerProfile и teacher-local `teacher_learner`, а provenance
LearningRecord фиксирует `recorded_by_account_id`. Homework, account claim и
live Student Screen sync остаются будущими срезами.

## Product decision

Каноническая авторская модель ShiDao V2:

```text
Account
├── claimed LearnerProfile 0..1 (optional; claim flow later)
├── TeacherLearner 0..N → LearnerProfile
├── LearnerGroup 0..N → LearnerProfile 0..N
└── Course
    ├── audience sources
    │   ├── direct LearnerProfile 0..N
    │   └── LearnerGroup 0..N
    ├── effective audience → unique active LearnerProfile 0..N
    ├── course-wide attachments
    └── Lesson 1..N
        ├── ordered Components 1..N
        ├── Student Screen projection
        │   └── ordered Slides 1..N → component references
        └── LessonRun 0..N
            └── LearningRecord 0..N → LearnerProfile + recorded-by Account
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

Lesson остаётся одной сущностью содержания и точкой назначения. `LessonRun` не
копирует её content и не является вторым «runtime-уроком»: это только одно
конкретное время/проведение и его общий отчёт. Закрытые Runs образуют историю,
а новый Run позволяет повторить ту же Lesson для всей аудитории или её части.

## Vocabulary

- **Course / Курс** — личный persisted-документ владельца с уроками и
  course-wide вложениями.
- **Lesson / Урок** — редактируемый документ внутри Course. Название обязательно
  и хранится в самой Lesson; комментарий преподавателя хранится в `summary`.
  Эту же Lesson можно назначать и проводить многократно.
- **LearnerProfile / Учебный профиль** — canonical identity, на которой
  накапливается индивидуальная история; она не принадлежит преподавателю и не
  является legacy Student. Nullable unique `account_id` предназначен для
  будущего claim, но current slice не реализует linking/login.
- **TeacherLearner / Ученик преподавателя** — связь Account преподавателя с
  LearnerProfile, содержащая локальное имя и archive state только в его
  справочнике.
- **LearnerGroup / Группа учеников** — Account-owned именованный набор уже
  существующих LearnerProfile. Профиль может состоять в нескольких группах.
- **Course audience / Аудитория курса** — два независимых набора источников:
  отдельные LearnerProfile и LearnerGroup. Эффективная аудитория — их
  дедуплицированное объединение без архивных профилей.
- **LessonRun / Проведение урока** — одно назначение той же Lesson с
  `scheduled/started/ended/cancelled` timestamps и общим teacher report.
- **LearningRecord / Учебная запись** — ожидаемый участник Run до завершения и
  его компактный индивидуальный результат после завершения; recorder Account
  сохраняется явно и определяет текущую teacher-history boundary.
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
`Methodology` как активная V2-модель не используются. Также нет отдельной
`LessonRunParticipant`, persisted run status или таблицы Lesson snapshots.

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

Минимальное проведение и индивидуальная запись:

```text
lesson_run
- lesson_id
- scheduled_at
- planned_duration_minutes
- started_at | ended_at | cancelled_at
- teacher_report

learning_record
- learner_profile_id
- recorded_by_account_id
- lesson_run_id | source_course_id | source_lesson_id
- occurred_at
- was_present | needs_repeat
- teacher_comment
- course_title_at_time | lesson_title_at_time | subject_at_time
```

Минимальный справочник и аудитория:

```text
learner_profile
- account_id (nullable unique) | display_name

teacher_learner
- teacher_account_id | learner_profile_id
- display_name | archived_at

learner_group
- owner_account_id | name

learner_group_member
- learner_group_id | learner_profile_id

course_learner
- course_id | learner_profile_id

course_learner_group
- course_id | learner_group_id
```

Группа не копирует LearnerProfile и не становится runtime-участником. Источник
аудитории не записывается в LearningRecord: конкретный состав открытого Run уже
зафиксирован его draft LearningRecords. При этом recorder не выводится из
mutable Course/profile links: `recorded_by_account_id` записывается при
scheduling.

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
5. **История** — завершённые проведения всех Lessons; change log авторских
   правок по-прежнему не реализован.

После явного выбора Lesson header показывает backlink с названием Course и
заголовок `Урок {position}. {lesson.title}`. Вкладки Lesson:

1. **План**;
2. **Экран ученика**;
3. **Домашнее задание**;
4. **Материалы**;
5. **История**.

Lesson-вкладка **Материалы** является только read-only проекцией того же
course-wide каталога. Она не создаёт lesson attachment, не копирует StoredFile
и не означает, что материал назначен конкретному Lesson. **История** показывает
только завершённые LessonRun с teacher report и результатами; Homework остаётся
отдельной честной заглушкой.

Текущий slice не добавляет отдельный Lesson URL или schema: Course/Lesson view
и вкладки переключаются внутри `/courses/[courseId]`. После reload снова
открывается Course → **Уроки**.

Visual contract Course routes не меняет эту навигационную или доменную модель:

- page background — сплошной `#f5f1e8` без цветных marketing gradients;
- product header — sticky demo shell высотой 68 px с радиусом 20 px;
- `AppPageHeader` задаёт один прозрачный layout для `/courses`, `/students`,
  `/schedule`, Course и Lesson: системный H1 веса 400 с максимумом 48 px
  на desktop и 32 px на mobile, подзаголовок, optional backlink и правую
  action-секцию; header имеет минимальную высоту 200 px, растёт по контенту,
  а actions вертикально центрированы;
- основные кнопки и header controls — высотой 40 px с радиусом 12 px и шрифтом
  `.88rem/500`;
- `WorkspaceTabs` задаёт общий 40 px tab/tabpanel contract для Course, Lesson,
  Students и profile dialog: roving keyboard focus, horizontal scroll, базовая
  чёрная линия 1 px с inline-inset 12 px и квадратный чёрный active-
  сегмент 4 px без radius на этой же линии;
- visual tokens не меняют landing, Auth, Settings или полноэкранный Student
  Screen.

Этот visual contract описывает current source implementation; production
release и authenticated browser postflight для follow-up ещё pending.

## Teaching hub navigation boundary

Current repository развивает teacher-only `/schedule` и `/students`, впервые
добавленные как shells в `fea7f80`, в реальный teacher-scoped workflow:

- server layout допускает только active teacher profile; Parent и transitional
  Student перенаправляются в `/courses`;
- `/schedule` проецирует LessonRun выбранного дня; отдельной таблицы Schedule
  event нет; action перехода к назначению находится в общей header
  action-секции, а date navigator — ниже;
- `/students` является единым справочником TeacherLearner/LearnerProfile и
  LearnerGroup: вкладки «Ученики / Группы», поиск, фильтр по группе, сортировка
  и управление relation не создают второй тип ученика; строка ученика показывает
  до двух групп и «ещё N», а имя и archive state принадлежат relation конкретного
  преподавателя; ученика можно создать, изменить и убрать из списка, а для групп
  доступен CRUD; header action меняется между «Новый ученик» и «Новая группа»
  вместе с выбранной вкладкой;
- клик по строке открывает dialog «Профиль / История»; membership допускает
  несколько групп, а history panel читает только LearningRecord, записанные
  текущим преподавателем;
- Course выбирает группы и отдельных учеников независимо; пересечения
  отображаются и назначаются один раз;
- назначить/перенести Lesson можно из её строки или header; прошедшее назначение
  можно сразу завершить постфактум, не создавая обязательную live-session;
- завершение фиксирует общий отчёт и посещаемость/repeat/comment каждого
  ожидаемого ученика; присутствие выбирается явно, без положительного значения
  по умолчанию; повтор допускает subset Course audience;
- старые `student`, `class` и `class_student` не используются как источник
  новой learning identity;
- `learner_profile.account_id` уже является nullable unique точкой будущего
  claim, но observer, invitation/claim, merge и learner login этот slice не
  добавляет.

## Scheduling, completion and deletion

Один открытый LessonRun является редактируемым «будильником» Lesson. Его время
и состав можно менять; отдельный Run создаётся только после завершения или
отмены предыдущего. UI-метки «назначен / нужно отметить / идёт / проведён /
отменён» вычисляются из timestamps, а не сохраняются как state machine.

До завершения `LearningRecord.occurred_at IS NULL`, поэтому эти же rows задают
ожидаемый состав без `lesson_run_participant`. Completion обязан покрыть его
ровно один раз и превращает rows в долговечную историю. Отсутствие не считается
непониманием материала; repeat recommendation применима только к
присутствовавшему ученику.

Открытый и завершённый Run имеет хотя бы одну LearningRecord. Cancel удаляет
draft rows, поэтому сохранённый отменённый Run может иметь ноль записей.
Reschedule передаёт expected Run ID и проверяет его под Lesson lock: устаревший
PATCH не может изменить новый Run, созданный в другой вкладке. Время
completion/cancel не может предшествовать `started_at`.

Новый Run без явного subset получает текущую effective audience курса.
Direct/group overlap устраняется до создания LearningRecord. Изменение состава
или удаление группы влияет только на будущие Runs; существующие draft rows
остаются конкретным составом назначения. Reschedule без нового subset сохраняет
этот состав, а явный reschedule разрешает текущую аудиторию плюс уже
зафиксированных участников данного Run.

Product delete ученика является soft archive его `teacher_learner` relation:
direct Course links и group memberships этого преподавателя удаляются, но
canonical LearnerProfile, finalized LearningRecords и draft records уже
назначенных Runs сохраняются. Он не архивирует identity глобально. Удаление
LearnerGroup физическое и удаляет только membership/Course links, не учеников и
не историю. Active `/students` скрывает archived relation; archive list/restore
в current UI/API отсутствуют.

Полного snapshot Lesson нет. После удаления Lesson её Components, Slides, Runs
и незавершённые LearningRecords удаляются. Завершённые LearningRecords остаются
в LearnerProfile, теряют Run/Lesson FK и сохраняют только дату, attendance,
repeat/comment и компактные Course/Lesson/subject titles. UI предупреждает об
этом до удаления.

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

Scheduling/history web API использует отдельный `LessonRunsApplicationService`
и teacher-scoped repository. Он предоставляет TeacherLearner directory
projection, LearnerGroup, mixed Course audience,
schedule/reschedule/start/complete/cancel и Lesson/Course/Profile history.
Mutations выполняются узкими authenticated RPC; MCP остаётся Course authoring
adapter и не получает параллельный доступ к таблицам.

Schedule window имеет hard limit 500 Runs. Lesson/Course/Profile history
ограничена последними 100 строками; Course read всегда резервирует место для
открытых Runs. Более длинная pagination/aggregation остаётся следующим слоем.

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
- scheduling domain/service: `src/modules/lesson-runs/`;
- scheduling/history UI: `src/components/lesson-runs/`,
  `src/components/teaching-hub/`;
- scheduling API: `src/app/api/v2/lesson-runs/`, `learner-profiles/` и
  `learner-groups/`, Course/Lesson `audience|history|runs` routes;
- canonical learner identity/access contract:
  `docs/architecture/learner-identity-access-model.md`;
- current schema: `supabase/schema/current-schema.sql`;
- Slide migration: `20260804044955_add_lesson_student_slides.sql`;
- LessonRun migration: `20260806190044_lesson_runs_learning_records.sql`.
- Groups/mixed audience migration:
  `20260806220726_learner_groups_mixed_course_audience.sql`.
- Canonical learner identity migration:
  `20260807033034_canonical_learner_profile.sql`.

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

Lesson planning и Assistant получают выбранные direct learners, teacher-local
названия и состав групп, дедуплицированную effective audience, до 8 завершённых
Runs текущего Course и до 40 последних финальных LearningRecords, записанных
текущим преподавателем об этих учениках по его курсам. Canonical identity не
открывает AI чужие teacher records. Технические IDs не передаются;
индивидуальный context ограничен attendance, repeat и teacher comment. Audience
и история входят в Lesson preview fingerprint, поэтому изменение membership
после preview делает Apply stale. Автоматических subject metrics пока нет.

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

Current repository реализует appointment/completion history, но не live sync.
Открытый LessonRun уже является конкретным проведением; второй content-bearing
`LessonSession` не нужен. Будущий operational presentation cursor может быть
связан с открытым Run и текущим Student Screen Slide, не меняя authored
hierarchy и не создавая Step entity.

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
- live Student Screen sync, realtime presence и runtime cursor;
- actual-duration/progress projection; richer learner metrics без реального
  Component/runtime producer не добавляются;
- account claim/invitation, duplicate-profile merge, observer/self history;
- learner Course consumption и live Student Screen access;
- cross-provider history projection или AI context без явного subject grant;
- drag-and-drop, если надёжные кнопки «выше/ниже» уже обеспечивают reorder;
- внешняя публикация MCP;
- compatibility layer для Step/Methodology не планируется;
- отдельные renderers по Course/Lesson ID.

Roleless Account bootstrap, invitation/claim, physical profile merge,
self/observer history, real-record progress и consented cross-provider AI входят в
следующую identity-программу, но не меняют authored hierarchy Lesson. Полный
execution contract находится в
[`LEARNER_IDENTITY_COMPLETION_PROMPT.md`](../v2/LEARNER_IDENTITY_COMPLETION_PROMPT.md).
Learner Course consumption и live Student Screen остаются later.

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

Release `7021801` отдельно подтвердил standalone demo boundary: 224
unit/contract tests, production build и строгие 9/9 browser smoke прошли;
deployed root/deep links, reload, Guest/read-only/noindex policy и cache recovery
старого `308` проверены без обращения к V2 persistence.

Current local LessonRun slice дополнительно прошёл 256/256 unit/contract tests,
typecheck, lint, production build, 9/9 browser smoke и isolated PostgreSQL 16
workflow `audience → schedule → reschedule → complete → repeat → cancel →
delete` с негативными stale/empty/timestamp/ACL checks. Production migration
применена отдельно и прошла owner/cross-account/PostgREST postflight. Coolify
развернул exact SHA `fa91371` со статусом `finished`; authenticated browser
подтвердил Course audience/run/history, `/schedule` и `/students` без записи
тестовых данных и без warning/error в console.

Group/mixed-audience release `9393080` прошёл 270/270 unit/contract tests,
typecheck, lint, production build, строгие 10/10 browser smoke и isolated
PostgreSQL 16 сценарии overlap/freeze/archive/capacity/ownership. Forward
migration применена к production, authenticated CRUD проверен внутри rollback,
PostgREST увидел новые relationships. Coolify запустил exact image
`939308070323b6e920a870b503a2911dd32c654a`; deployed browser подтвердил каталог
учеников, обе CRUD-формы и mixed Course audience без сохранения тестовых данных
и без console/runtime errors.
