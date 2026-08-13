# Lesson workflow model

**Статус:** canonical V2 product architecture

**Дата решения:** 5 августа 2026 года

**Актуально на:** 13 августа 2026 года

**Область:** Course Builder / Lesson / Components / Student Screen / audience / scheduling / learning history / course materials / homework

**Implementation state:** deployed baseline включает authoring, persisted
Slides/preview, RouterAI, groups/audience, LessonRun и recorder-scoped history.
Current production дополнительно содержит roleless learner identity:
exactly-one Account profile, claim/merge/observer, learner-safe
history/progress, explicit shared comments, actual duration и consented
cross-provider AI. Phased M1–M6 migrations, exact Coolify deploy и postflight
завершены. Account-scoped самостоятельное прохождение approved educator
publications с revision progress и аттестацией также является current
production. Homework, enrollment/consumption детских Course через
LearnerProfile и live Student Screen sync остаются later.

Current deployed follow-up добавляет global System Assistant в
protected `(app)` layout. Он не меняет Lesson hierarchy или schema: по
allowlisted page context читает bounded authorized проекции, а после отдельного
explicit Apply может создать Course draft, пустую или наполненную Lesson,
дополнить существующую Lesson либо удалить exact Lesson. Наполнение
переиспользует canonical Lesson plan/preview/apply и не создаёт Step или второй
Component order; удаление вызывает тот же history-preserving `deleteLesson`.
Base release `b7c6cfe`, exact conversational follow-up `246cf49` и quick-reply
follow-up `69a74a7` развёрнуты; новая Lesson/Component schema для этого не
потребовалась.

## Product decision

Каноническая авторская модель ShiDao V2:

```text
Account
├── canonical LearnerProfile exactly 1
├── ObserverGrant 0..N → LearnerProfile
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

Offline LearnerProfile 0..N (account_id IS NULL до recipient-bound claim)
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
- **Курс в каталоге** — опубликованная immutable редакция
  authored Course. В UI это всё ещё «курс», а не отдельный
  «шаблон». Добавление создаёт новый независимый Course с
  новыми внутренними ID.
- **Lesson / Урок** — редактируемый документ внутри Course. Название обязательно
  и хранится в самой Lesson; комментарий преподавателя хранится в `summary`.
  Эту же Lesson можно назначать и проводить многократно.
- **LearnerProfile / Учебный профиль** — canonical identity, на которой
  накапливается индивидуальная история; она не принадлежит преподавателю и не
  является legacy Student. Каждый active/provisional Account имеет ровно один
  linked profile; offline profiles остаются unclaimed до recipient-bound claim.
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
- **ObserverGrant / Наблюдение** — explicit read-only capability на learner-safe
  projection конкретного LearnerProfile; не Parent/Guardian role.
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
- started_at_is_actual
- actual_duration_minutes | null
- teacher_report

learning_record
- learner_profile_id
- recorded_by_account_id
- lesson_run_id | source_course_id | source_lesson_id
- occurred_at
- was_present | needs_repeat
- teacher_comment
- shared_with_learner_at | null
- actual_duration_minutes_at_time | null
- superseded_by_record_id | null
- course_title_at_time | lesson_title_at_time | subject_at_time
```

Минимальный справочник и аудитория:

```text
learner_profile
- account_id (nullable unique; exactly one linked profile per active Account)
- display_name

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

learner_observer_grant
- learner_profile_id | subject_account_id | observer_account_id
- relationship_label | status | granted_at | revoked_at

learner_ai_consent
- learner_profile_id | course_id | owner_account_id
- purpose | status | revision | expires_at
```

Группа не копирует LearnerProfile и не становится runtime-участником. Источник
аудитории не записывается в LearningRecord: конкретный состав открытого Run уже
зафиксирован его draft LearningRecords. При этом recorder не выводится из
mutable Course/profile links: `recorded_by_account_id` записывается при
scheduling.

Subject/observer history не расширяет raw LearningRecord RLS. Отдельная safe
projection возвращает только finalized non-superseded rows, opaque key,
attendance/repeat/titles-at-time, known actual duration и explicit shared
comment. Merge conflict сохраняет losing record как superseded provenance, но
не считает его вторым pedagogical outcome.

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

UI, application service и MCP используют эти же contracts. Runtime registry
остаётся полным для чтения и изменения уже сохранённых данных, а отдельная
authored-create projection генерирует JSON Schema только для создаваемых типов.
Добавление типа компонента не требует новой таблицы и не создаёт отдельную
React-страницу для конкретной Lesson.

Текущий production registry содержит 20 активных типов:

```text
heading
rich_text
callout
quote
image
video
audio
slideshow
single_choice_poll
matching_game
choice_quiz
fill_blanks
word_bank
sequence
categorize
free_response
external_link
word_builder
vocabulary_list
file
```

Layout-only `divider` не входит в registry: порядок и группировку задают
Lesson/Slides, а визуальное разделение не требует самостоятельного authored
content. `video`, `audio` и `external_link` принимают только HTTPS URL.
Интерактивные renderers в этом срезе дают preview-local самопроверку;
ответ `free_response`, попытки, scoring и teacher review не хранятся.
Voice recording, arbitrary third-party embed и image matching отложены до
отдельных Storage/CSP/persistence контрактов. Матрица выбора описана в
[`docs/product/course-component-catalog.md`](../product/course-component-catalog.md).

Authored-create set содержит 19 типов и исключает отдельный `heading` не только
из ручного picker, но и из REST `POST`, development MCP, AI planning и
deterministic assembler. Сам key остаётся двадцатым runtime contract для
чтения, renderer, modal editor/PATCH и immutable publication revisions.

Новый текст создаётся как `rich_text` schema version `1`: допускаются
plain-text `title`, Markdown `content` или оба поля, но не payload, где оба поля
пусты. Это сохраняет чтение прежних body-only payload. Tracked data migration
`20260813063716_unify_heading_rich_text_components.sql` преобразует authored
`heading` в title-only `rich_text`; непосредственные `heading → rich_text`
сливаются только при одинаковых visibility, `student_slide_id` и placement,
чтобы приватное содержимое не пересекало learner projection. Immutable
publication revisions остаются точными историческими snapshots. Physical DB
schema не меняется. Current production data postflight: `17` authored headings
преобразованы, `11` safe adjacent pairs объединены, итог — `85` Components,
`heading=0`, `rich_text=44` (`11` combined / `6` title-only / `27` body-only),
invalid shapes, empty Slides и density violations равны `0`. Immutable
publication revision и её content hash не изменились. Coupled rollout соблюдал
web-first порядок: exact compatible source
`dea92ca2c9af99fd5738e95fa9ca511aa10ca3da` был развёрнут до verified backup и
DB apply; старый image больше не является допустимым rollback target.

Current production Store demo не меняет registry или Lesson schema. Пока
преподаватель может использовать обычный `external_link` с абсолютным HTTPS URL
вида `https://v2.shidao.ru/store?product=<slug>`; Store выбирает и фокусирует
известный товар, но ссылка не является persisted Product relation и не
гарантирует наличие. Типизированная Lesson Component → Product связь остаётся
later и должна пройти через этот же registry/application-service/MCP boundary.

## Teacher plan

План выбранной Lesson показывает `lesson.components` в ascending `position`.
Преподаватель может:

- добавить компонент из palette;
- изменить его payload и placement;
- переместить выше или ниже во всём списке Lesson;
- удалить компонент;
- назначить компонент на допустимый Slide, создать для него новый
  Slide или убрать его с Student Screen.

Palette является одним dialog с постоянной responsive geometry. Header и
category tabs находятся вне scroll container, а список Component cards
занимает оставшуюся высоту и прокручивается независимо. Выбранная категория
задаётся `aria-pressed`; отдельные heading/description с тем же названием не
дублируются.

Current production дополняет каждую из 19 вручную создаваемых palette cards коротким
назначением и representative статическим mini-preview. Preview является только
неинтерактивной presentation-подсказкой: он не сохраняется в payload, не
использует production teacher/learner renderer и не создаёт второй Component
registry или order. Поэтому interactive и media samples не содержат реальных
controls, playback или network requests.

Текстовая категория ручного picker содержит «Текст», «Сноска» и «Цитата».
«Текст» заранее показывает сочетание заголовка и абзацев; отдельный `heading`
не предлагается для нового Component ни одним authoring entry point, но
сохранённые блоки этого типа остаются доступными для просмотра и modal editing.

Presentation отдельно показывает «Ссылки» и «Файлы», хотя оба типа сохраняют
registry category `attachment`. Category rail не имеет разделителя, а
auto-sized cards прижаты к началу grid и не растягиваются до высоты dialog.
Category controls и доступные cards используют pointer.

Выбор Component type не является mutation. Тот же dialog переключается из
каталога в локальный draft, созданный из `defaultPayload/defaultPlacement`
registry; до явного «Сохранить компонент» persisted row и позиция в Lesson не
возникают. Возврат в каталог, отмена или закрытие отбрасывают только этот draft.
Save отправляет существующий `POST /api/v2/lessons/:lessonId/components`, после
чего application service повторно валидирует type-specific payload/placement и
создаёт обычный `staff_only` Component. Ошибка сохраняет draft открытым для
исправления; picker не вводит параллельный create contract.

На поверхности «План» нет дополнительной card-подложки или повторного
заголовка. Прозрачный toolbar показывает поиск по названиям уже добавленных
Components слева (если список непустой) и действия AI/добавления справа.
Authored Component card использует 12 px element radius, белый фон без border и
чёрную тень `0 3px 6px #0000000d`; на hover/focus тень сохраняет offset `3px`,
но плавно становится `0 3px 12px #0000001a`, не двигая layout, а при
reduced-motion transition отключается. Фильтрация не меняет canonical
`position` и не создаёт второй порядок. В current production карточка содержит
только production teacher renderer; номер/type остаются доступным именем, но не
образуют отдельный
видимый normal-flow header. Группа 32 px действий располагается в overlay,
раскрывается на hover/focus-within и остаётся доступной на устройствах без
hover. Overlay и его кнопки не имеют border/box-shadow; общая белая подложка —
`rgba(255, 255, 255, 0.5)`. Pencil открывает отдельный modal editor поверх
неизменённого renderer. Единственное desktop-исключение из скрытия rail —
активное действие Student Screen: его голубая кнопка `MonitorPlay` размером
32 px видна постоянно, а неактивная кнопка скрывается вместе с остальными
действиями.
Отмена/закрытие отбрасывают локальные изменения, а только явное сохранение
отправляет существующий `PATCH /api/v2/components/:componentId` с
payload/placement. Form labels используют canonical `.88rem/400`, однострочные
input/select — 40 px. Поля `rich_text` подписаны ровно «Заголовок» и «Текст»,
без «(необязательно)»; каждое можно оставить пустым отдельно, но Save отклоняет
одновременную пустоту обоих. Эти scoped presentation rules не меняют learner
renderer, authored order или physical DB schema; code-first `rich_text`
extension описано выше отдельно.

На карточке teacher видит не абстрактное состояние «видимый/невидимый», а
назначение Component на Student Screen. Кнопка использует тот же Lucide
`MonitorPlay`, что и вкладка «Экран ученика», и публикует прямое состояние через
`aria-pressed`. Для `staff_only` нажатие выбирает Slide ближайшего предыдущего
learner-visible соседа, затем ближайшего следующего, а при отсутствии обоих
создаёт новый Slide. Для уже назначенного Component повторное нажатие снимает
назначение. Mutation сохраняет `visibility`/`student_slide_id`, поэтому
состояние переживает reload. `staff_only` Component остаётся частью плана
преподавателя, но отсутствует в learner API; приватность обеспечивается server
projection и authorization, а не только CSS.

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
показывается Course header и таблица уроков. Это presentation projection над
тем же authored Lesson order, а не новый порядок или persisted representation.

Вкладки Course:

1. **Уроки** — полный ordered набор Lesson в `ProductTable` и создание нового
   Lesson. Исходная projection следует `position ASC`; клики по заголовкам
   меняют только локальный view-sort и не переставляют Lessons в authored
   модели;
2. **О курсе** — одна растущая карточка без собственного вертикального scroll.
   В ней inline находятся основные настройки Course, фактическая аудитория из
   групп/отдельных учеников и источники. Секция источников сохраняет честное
   пустое состояние до parsing/RAG;
3. **Материалы** — агрегирующая библиотека всех course-wide attachments. Она
   разделяет используемые Components и пока не используемые материалы,
   показывает Lesson usage и learner-visible projection;
4. **История** — завершённые проведения всех Lessons; change log авторских
   правок по-прежнему не реализован.

`/courses/new` показывает ту же четырёхвкладочную структуру с активной
**О курсе**. До persistence **Уроки** и **История** являются честными
placeholder surfaces, **Материалы** показывают staging picker, а сама форма
остаётся mounted при переключении вкладок. Обычное сохранение открывает
`/courses/[courseId]?tab=about`; deterministic assemble и успешный AI Apply —
канонический `/courses/[courseId]` с активными **Уроками**.

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
и вкладки переключаются внутри `/courses/[courseId]`. Без `tab` Course открывает
**Уроки**; `tab=about|materials|history` сохраняет выбранную Course surface при
reload. Перестройка navigation, inline settings/audience и pre-persistence shell
не меняют Course/Audience/attachment contracts или физическую schema.

Current deployed UI не размещает отдельную кнопку assistant в Course или
Lesson header. Один floating widget смонтирован выше этих workspace в protected
Account layout; Course workspace регистрирует только typed `courseId` и
optional selected `lessonId`, а fullscreen preview — текущую preview Lesson.
Произвольный URL, DOM, search/hash и несохранённые поля Lesson в page context не
передаются. Старый course-scoped assistant route может временно оставаться как
compatibility, но его dialog больше не является частью Course/Lesson UI.

## Course catalog and publication boundary

`/courses` разделяет рабочие Course и каталог вкладками **Мои** и
**Каталог**. Действие «Создать курс» всегда начинает пустой pre-persistence
draft в Course shell и создаёт Course только после явного сохранения, а
«Добавить в мои курсы» для детской published revision создаёт независимую
owner-scoped копию. Копия сразу редактируется как обычный Course; ни адаптация,
ни AI-перегенерация не запускаются автоматически. Official educator
publication открывается напрямую в read-only self-learning workspace и никогда
не копируется или не дублируется, включая состояние после аттестации.

Назначение Course хранится в `course.learning_audience` (`children |
educators`) и не совпадает с roster-полем `audience_type`. Educator authoring
доступен только active Account с DB-backed
`can_author_educator_courses`; отправленная revision проходит server-side admin
review и попадает в каталог только через `approved_revision_id` с official
license. В `/courses/catalog/[publicationId]` Account читает learner-safe
approved snapshot, сохраняет revision-scoped last opened/completed Lessons и
получает доступ к аттестации только после `100%` уроков. Roster, groups,
scheduling и LessonRun для educator Course закрыты DB и application guards.
Полный contract: [«Курсы для педагогов и аттестация»](../product/educator-courses-and-attestation.md).

Публикация не открывает live owner tables. Application service создаёт
allowlisted immutable snapshot текущей authored-редакции:

- generic Course fields, Lesson title/summary, ordered Components, visibility
  и Student Screen Slides входят;
- ready attachments физически копируются в private immutable
  publication Storage; signed URLs и исходные paths в snapshot не входят;
- `teacher_preferences`, Course audience, groups/learners, schedules,
  LessonRuns, LearningRecords, reports/history и AI consent не входят;
- source Course/Lesson/Component/Slide/StoredFile IDs заменяются
  publication-local keys.

Перед первой публикацией и обновлением есть один confirmation dialog с
обязательным подтверждением прав на материалы. Для детского Course consent
разрешает другим пользователям ShiDao копировать и изменять published content;
для educator Course consent покрывает official публикацию ShiDao, а revision
проходит обязательное admin review и остаётся no-copy. Отдельного preview
wizard, PII/name scanner и второго confirmation step нет.
Обновление publication создаёт новую immutable revision; старые
уже добавленные Course не меняются. Unpublish скрывает listing, но не
удаляет owner Course и чужие копии.

Catalog list использует компактную DB projection: фильтры и cursor применяются
до чтения snapshot, facet arrays ограничены. Публикация доступна только active
Account; переход publisher в non-active атомарно снимает его listings, а
reactivation не публикует их снова. Allowlisted authored changes имеют
отдельный publication content clock, поэтому audience, private preferences и
другая operational персонализация не создают ложный dirty state.

Одна revision ограничена 24 файлами, 10 MiB на файл и 120 MiB суммарно;
immutable history одного Account — 5 GiB. Process-local guard сериализует
Storage-writing mutation одного Account и ограничивает частоту, но не заменяет
DB quota. При network/5xx/invalid-response commit считается unknown: сервис не
удаляет возможно committed bytes. Persisted orphan reconciliation остаётся
обязательным operational шагом до широкого rollout. Current
`DELETE /api/v2/courses/[courseId]` не выполняет physical deletion: он ставит
существующий `course.archived_at`. Поэтому authored Lessons/Components,
attachments, LessonRuns и LearningRecords сохраняются. Published Course должен
быть явно снят с публикации до архивации (`409 course_is_published`), а Course
с открытым LessonRun — завершён или отменён (`409
course_has_open_lesson_runs`). User-JWT RPC `archive_course` проверяет active
ownership, оба conflict-условия и ставит `archived_at` в одной DB-транзакции;
reverse guards сериализуют archive, publish и open Run на одной Course row, а
Lesson parent становится immutable. API не принимает решение по раздельным
publication/Run reads. A1 database contract и зависимый API/UI уже current
production после rollout PR #242. Отдельного restore UI пока нет, permanent
delete остаётся later policy, а не неявным поведением этого endpoint.

Visual contract Course routes не меняет эту навигационную или доменную модель:

- page background — сплошной `#f5f1e8` без цветных marketing gradients;
- product header — sticky demo shell высотой 68 px с радиусом 20 px и
  непрозрачным белым фоном без blur; Account dropdown использует тот же
  сплошной белый surface;
- `AppPageHeader` задаёт один прозрачный layout для `/courses`, `/students`,
  `/schedule`, authenticated `/settings/*`, Course и Lesson: системный H1 веса
  400 с максимумом 48 px на desktop и 32 px на mobile, подзаголовок canonical
  цвета `rgba(20, 20, 20, 0.5)` через
  `--app-page-header-description-color`, optional backlink и правую
  action-секцию; header имеет минимальную высоту 200 px,
  растёт по контенту, heading получает всю оставшуюся ширину, а actions
  вертикально центрированы и имеют intrinsic ширину по содержимому с
  ограничением шириной контейнера. В current production сам H1 больше
  не имеет лимита `24ch` и заполняет heading-колонку; desktop column-gap равен
  24 px. Backlink и стрелка используют непрозрачный `#141414`, label остаётся в
  одной строке и обрезается ellipsis, а интервалы над и под backlink совпадают с
  page-header block-inset (20 px desktop, 16 px mobile). Этот UI-only follow-up
  не меняет Lesson hierarchy, API или schema.
  Надзаголовок/eyebrow не входит в `AppPageHeader` API и не может появиться на
  отдельном product route;
- основные кнопки и header controls — высотой 40 px с радиусом 12 px и шрифтом
  `.88rem/400`; primary flat без inset-блика, подъёма или тени, иконки имеют
  единый 16 px rhythm, полную непрозрачность и наследуют контрастный цвет,
  белые кнопки сохраняют тонкую серую рамку, а menu items остаются borderless;
- в current production все product buttons внутри `AppPageHeader` уточняют этот
  контракт для будущих page backgrounds: белый surface остаётся высотой
  `40 px`, получает border `0` и общий двухслойный
  `--product-raised-control-shadow`, совпадающий с selected-состоянием
  переключателя вида Расписания. Primary header actions получают чёрные
  текст/иконку, Lesson «Удалить» сохраняет danger-цвет, hover — геометрию и
  тень, а keyboard focus дополнительно получает 2 px outline. В
  `forced-colors` вместо исчезающей тени возвращается системная рамка. Правило
  применяется к непосредственным action-кнопкам и вложенному menu trigger, но
  не затрагивает buttons открываемого из header dialog, menu items или controls
  вне header actions. Сам пользовательский выбор фона Course этим UI-only
  slice не реализован;
- в current production общий contextual `ActionMenu`, открываемый
  `MoreHorizontal`/`MoreVertical` в Course actions, Lesson rows, Schedule и
  Students, использует токенизированные белый surface, element-radius 12 px и
  одну тень `0 18px 46px rgba(20, 20, 20, 0.18)` без обычной рамки. Shared item
  contract больше не содержит `separatorBefore`, divider или separator DOM;
  состав/порядок действий, 40 px item geometry, destructive/disabled states,
  portal positioning, keyboard navigation и focus restore сохраняются.
  Filter/calendar popovers, Account menu и native `select` остаются отдельными
  компонентами; этот UI slice не меняет API/schema/migrations;
- radius tokens отделяют card surface 20 px от element/control/table/menu
  surface 12 px. Активные `ProductTable` wrappers используют table token,
  сплошной белый фон и не имеют внешней рамки. Students и обе Courses tables
  используют Schedule-плотность 40 px для header и data rows, однострочный
  ellipsis, 12 px обычный cell inset и 4 px action-cell inset. Shared header
  белый, а row dividers используют один `--product-table-divider-color`.
  Все body cells и их видимые text descendants используют один Schedule-derived
  typography contract `#141414 / .88rem / 400 / line-height 1.3`; header row и
  action-cell намеренно не входят в этот selector;
- сохранённый Course → **Уроки** продолжает неизменённый полноширинный
  `WorkspaceTabs` прозрачной search/create toolbar без horizontal inset. Таблица
  `№ / Урок / План / Экран ученика / Проведение / Обновлён / actions`
  переиспользует ту же Schedule-геометрию. Шесть заголовков сортируют только
  view projection, default остаётся `position ASC`. Последняя cell имеет 4 px
  inset и один `MoreVertical` 32 × 32 px; portal-menu содержит «Открыть урок» и
  контекстное действие проведения, но не delete. Прежний карточный
  `workspace-lesson-*` layout удалён. Completed-only bounded history
  проецируется как «Проводился ранее» без ложного total, а `Обновлён`
  вычисляется как newest timestamp Lesson и сохранившихся Components и
  Student Slides;
- `WorkspaceTabs` задаёт общий 40 px tab/tabpanel contract для Course, Lesson,
  Students и profile dialog: roving keyboard focus, horizontal scroll, базовая
  линия 1.2 px и inactive label используют общий
  `rgba(20, 20, 20, 0.5)` token; container, scroll-row и baseline канонически
  занимают всю ширину с `inline-inset: 0`. Между tab-кнопками gap 12 px, верхние
  углы имеют control-radius 12 px, а baseline рисуется отдельным слоем поверх
  светлого hover-фона. Квадратный непрозрачный чёрный active-сегмент 4 px лежит
  выше baseline. Каждый tab имеет 16 px Lucide icon; только positive numeric
  count показывается маленьким приподнятым `sup` с weight 500, а `0` отсутствует. Каждый tab
  ссылается на постоянный matching `tabpanel`, который возвращает его id через
  `aria-labelledby`;
- authenticated Settings переиспользуют тот же product shell, demo TopNav,
  settings-navigation и shared Button variants; visual tokens не меняют
  landing, Auth или полноэкранный Student Screen.

Базовый layout contract был подтверждён authenticated browser postflight на
точном application release `77870e3`. Flat controls, Settings-расширение,
intrinsic header-actions, 20%-black tabs baseline, plain inline counts и
full-width container/baseline с нулевым inset теперь current production после
rollout PR #242 exact commit
`84ffefecda99d3b0a9da82bf1eaf8ce76d9c6ea1`. Physical schema и migrations
этим visual refinement не меняются; отдельный Course soft-archive endpoint
описан выше.

Предыдущий deployed tabs refinement exact source
`0c8946f95ebeb31e02955a110fc057f761f07ea9` ввёл общий 50%-black token,
baseline 1.5 px, gap и верхние радиусы 12 px, 16 px icons и только положительные
counts в `sup`. Physical schema и API этим rollout не менялись.

Current production follow-up уменьшает прежний baseline `1.5 px` до визуальных
`1.2 px` и устраняет зависимость от растеризации дробной высоты Chromium:
отдельный paint-layer имеет высоту `3 px`, `scaleY(0.4)` и transform-origin на
нижней грани. Поэтому линия остаётся привязана к низу tab row и не влияет на 40 px
layout; active segment 4 px по-прежнему перекрывает её через более высокий
z-index. Это общий `WorkspaceTabs` UI-only contract без route-specific forks,
API, schema или migration; он развёрнут exact source
`dea92ca2c9af99fd5738e95fa9ca511aa10ca3da`.

## Roleless teaching hub navigation boundary

Current production делает `/schedule` и `/students` доступными
любому authenticated Account. «Преподаватель» здесь означает владельца Course
и/или `teacher_learner`, а не legacy role:

- server layout проверяет только Account session; Guest/degraded session
  перенаправляется в `/login`;
- current production `/schedule` проецирует LessonRun выбранной локальной недели
  или календарного месяца; отдельной таблицы Schedule event нет. Action
  перехода к назначению находится в общей header action-секции, сокращён до
  «Назначить урок» и использует calendar-plus icon. Ниже прямо на page
  background расположен right-aligned date picker шириной 300 px на desktop и
  icon-only «Таблица / Карточки»; внешней toolbar-card и отдельного
  переключателя периода нет. Date picker объединяет короткую русскую подпись
  периода без точки после сокращения месяца, календарный popover и
  внутренний selector «День / Неделя / Месяц»; полное доступное имя даты
  сохраняется, а стрелки сдвигают назад или вперёд именно выбранный период.
  Рядом остаётся icon-only «Таблица / Карточки». Прозрачная Schedule
  controls-панель использует всю ширину content-row без горизонтального inset;
  controls остаются прижаты к её правой границе. Непустая projection после
  controls не повторяет период, заголовок «Занятия» или видимый result count,
  но сохраняет доступное имя секции и caption таблицы. Белая Table projection
  не имеет внешней рамки и использует table radius 12 px; header и data-row
  имеют exact 40 px. Header использует тот же белый фон, что data rows; его
  нижний divider 1 px входит в высоту header и через общий
  `--product-table-divider-color` совпадает с разделителями между строками,
  weight 500 и более светлый текст. Обычные header/data cells имеют
  канонический inline-padding 12 px. Только последняя body action-cell
  использует inline-inset 4 px:
  единственный `MoreVertical` trigger имеет размер 32 × 32 px и радиус 8 px,
  поэтому внутри точной 40 px строки сохраняет по 4 px сверху, справа и снизу
  и совпадает с геометрией active option переключателя вида. Контентные по
  ширине `Дата / Время` прижаты слева,
  `Ученики / Статус` и действия — справа, а `Урок / Курс` делят оставшуюся
  ширину. Все данные чёрные и однострочные, используют ellipsis и полные title;
  дата имеет вид `Среда · 12 авг`, время — `12:00 · 60 мин`, scheduled state
  остаётся plain «Ожидается». Видимые data-заголовки являются кнопками
  сортировки: первый клик включает возрастание, повторный — убывание, а
  направление публикуется через `aria-sort`. Последняя колонка не имеет видимого заголовка:
  строка назначенного урока показывает pointer при наведении, а постоянно
  доступное вертикальное троеточие ожидающего Run открывает точные действия
  «Начать урок / Изменить / Отменить»; active Run получает «Завершить урок /
  Отменить», а completed — «Результаты». Start и cancel используют
  существующие LessonRun mutations через общий reload/busy/error boundary,
  cancel требует подтверждения, а edit открывает dialog назначения сразу в
  режиме редактирования. Других action-кнопок в
  строке нет; взаимодействие с trigger/menu не превращается в неявный row
  click. Пункты portal-menu имеют 40 px, вертикально центрированы и используют
  `.88rem/400`.
  Этот current production polish меняет только UI: LessonRun API/schema и
  migrations не меняются; последняя корректировка cell/action spacing
  развёрнута и прошла running-image/HTTP boundary postflight в PR #242;
- current production follow-up убирает завершающую точку из Schedule subtitle,
  оставляет одну стрелку только у активной sortable-колонки и убирает
  разделитель между «Изменить / Отменить» в трёхпунктовом меню. Радиус
  hover-подсветки menu item равен 8 px и совпадает с active view option. Этот
  follow-up не меняет LessonRun API, schema или migrations;
- `/students` объединяет справочник TeacherLearner/LearnerProfile и
  LearnerGroup во вкладках «Ученики / Группы» с learner-safe observer
  projection во вкладке «Наблюдение»; подзаголовок страницы — «Ученики и
  группы, с которыми вы работаете или за которыми наблюдаете». Active
  profiles, archived relations и исходящие pending requests показаны в одной
  таблице: archive/pending отмечаются inline, а допустимые actions остаются в
  этой же строке. Search расположен отдельно; status, membership «В группе /
  Без группы», конкретная группа и Account connection собраны в disclosure
  «Фильтр». Отдельного sort select нет: headers таблиц Students и Groups
  переключают ascending/descending повторным кликом и используют
  `aria-sort`. Controls лежат прямо на page background без toolbar-card,
  занимают всю ширину с `padding-inline: 0` и не меняются от статуса;
  обе Courses compact toolbars используют тот же нулевой inset. Students table повторяет
  Schedule-геометрию с 40 px header/data rows и колонками
  `Ученик / Статус / Аккаунт / Группы / Добавлен / actions`. «Статус»
  показывает lifecycle relation/request, «Аккаунт» — identity connection, а
  «Добавлен» — teacher-local дату relation или запроса. Имя и archive state
  принадлежат relation конкретного преподавателя; управление relation не
  создаёт второй тип ученика. Header action меняется между «Новый ученик» и
  «Новая группа», а на вкладке «Наблюдение» mutation action отсутствует;
- один `MoreVertical` в конце Students-row открывает contextual portal-menu.
  Active profile можно открыть, изменить группы, добавить в выбранный Course
  реальным flow с сохранением существующей group/direct audience или «Убрать
  из списка». Пункт
  «Написать сообщение» disabled и явно помечен как недоступный, поэтому
  communication layer не заявляется реализованным. Archived profile и pending
  request получают только допустимые restore/permanent-delete или cancel
  actions; trigger/menu не превращаются в неявный row click. Это current
  production UI/application refinement поверх существующих Group/Course
  audience boundaries без новой schema или migration;
- `/courses` использует общий edge-to-edge `WorkspaceTabs`; подзаголовок —
  «Создавайте свои курсы с нуля или добавляйте готовые из каталога» без
  завершающей точки. Controls обеих вкладок прозрачны и полноширинны. Таблица
  **Мои** имеет колонки `Курс / Предмет / Уроки / Публикация / Обновлён /
actions`; пять data headers сортируют полную client-loaded projection с
  ascending/descending и `aria-sort`. Таблица **Каталог** имеет
  `Курс / Предмет / Автор / Уроки / Материалы / actions` и сохраняет
  server-side cursor order, не сортируя только загруженную страницу локально.
  Обе таблицы используют fixed layout; все содержательные ячейки имеют
  однострочный ellipsis, поэтому action column остаётся внутри surface.
  Icon-only presentation control обеих вкладок расположен в порядке **Таблица
  / Карточки** и изначально выбирает таблицу; смена вида не меняет Course query,
  filters или persisted данные.
  Owned-row заканчивается одним `MoreVertical` portal-menu 32 × 32 px:
  unpublished Course получает «Дублировать / Опубликовать / Удалить», а
  publication states сохраняют update/open/unpublish actions. «Удалить»
  destructive только по оформлению и требует подтверждения; технически это
  описанный выше soft archive с published/open-Run guards;
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
- Account credential boundary обслуживает existing login/PIN без active чтения
  legacy Student; invitation/claim, physical merge, archive/restore,
  self/observer surfaces и subject lifecycle реализованы отдельным
  learner-identity service/API, не внутри Course Builder.

Current production primary navigation для roleless Account содержит
«Расписание / Ученики / Курсы / Магазин». «Учебный профиль» находится в Account menu, а
«Наблюдение» — третья вкладка `/students`; `/observing` служит compatibility redirect. Пустой
`/courses` позволяет начать authoring; он не является Course enrollment
учащегося. Owner-scoped CourseSummary поддерживает поиск, subject/level/content
filters, сортировку и режимы «Карточки / Таблица» без второй модели; current
controls используют direct page-background toolbar с `padding-inline: 0`,
disclosure с native
selects и icon-only view control; видимый result count не является control.
Published paginated Catalog отдельно поддерживает server-side
audience/search/subject/level из catalog RPC, не имитирует недоступные
content/sort capabilities и переключает карточки/таблицу лишь как presentation
уже загруженной cursor-последовательности. Audience toggle находится только в
toolbar списка; открытый item имеет собственный Course header и tabs.

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

Explicit `start_lesson_run` помечает `started_at_is_actual=true`. Completion
вычисляет `actual_duration_minutes` только из такого start либо принимает
явное post-factum значение teacher. Старый scheduled-time fallback фактическим
start не считается; unknown остаётся `NULL`. Точная duration копируется в
finalized LearningRecord как at-time outcome.

Индивидуальный comment private по умолчанию. Только явное действие completion
«Добавить в учебный профиль» выставляет `shared_with_learner_at`; historical
comments автоматически не публикуются. Subject/observer projection никогда не
возвращает общий `teacher_report`, roster или private comments.

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
назначенных Runs сохраняются. Он не архивирует identity глобально. Archive
filter показывает relation отдельно, а restore активирует только relation без
скрытого восстановления прежних Group/Course links. Удаление
LearnerGroup физическое и удаляет только membership/Course links, не учеников и
не историю. Permanent delete разрешён только для пустого unclaimed profile;
subject erasure/reset — отдельный recent-reauth flow всей canonical lineage.

Полного snapshot Lesson нет. После удаления Lesson её Components, Slides, Runs
и незавершённые LearningRecords удаляются. Завершённые LearningRecords остаются
в LearnerProfile, теряют Run/Lesson FK и сохраняют только дату, attendance,
repeat/comment и компактные Course/Lesson/subject titles. UI предупреждает об
этом до удаления.

## Lesson creation

Кнопка «Добавить урок» находится в прозрачной полноширинной Course Lessons
toolbar и открывает modal. Текущий manual create требует название Lesson и
создаёт пустую Lesson. Teacher comment редактируется затем в модалке настроек
Lesson и сохраняется в `summary`.

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

Current System Assistant orchestration не создаёт параллельный AI-owned Lesson
flow. Пустая Lesson по-прежнему вызывает canonical `addLesson`; наполненная
новая или существующая Lesson сначала проходит existing `planLesson`, показывает
полный preview и только после подтверждения вызывает `applyLessonPlan`.
Existing Components/Slides сохраняются, новые Components добавляются в конец
того же ordered list и остаются `staff_only`. Аналогично создание Course через
assistant создаёт только обычный Course draft, а не скрыто собранную программу.

Если пользователь просит добавить Lesson внутри открытого Course без названия,
server связывает запрос только с opaque `current_course` и возвращает уточнение
title без proposal или записи. Ответ с названием может подготовить action card;
сам Lesson всё равно появляется только после explicit Apply. Неизвестный
непустой Course ref отклоняется fail closed и не подменяется текущим Course.
Неоднозначный запрос с названием Lesson сначала уточняет, нужен пустой или
наполненный результат. Для этого выбора current UI показывает одноразовые
«Пустой урок / Готовый урок»; нажатие остаётся обычной репликой диалога и само
по себе не вызывает `addLesson`/`applyLessonPlan`. Fill/delete используют exact
opaque Lesson ref внутри уже owner-validated Course. Delete card сообщает impact, signed proposal
связывает actor/action/key, а Apply повторно сравнивает authored Lesson
fingerprint и вызывает canonical history-preserving `deleteLesson`.

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

В текущем UI новые attachments выбираются во вкладке **Материалы** при создании
Course. В сохранённом Course одноимённая вкладка агрегирует course-wide
attachments, строит usage по валидированным Component payloads, разделяет
используемые и пока не используемые файлы и не создаёт отдельную Lesson
attachment relation. Надёжное добавление новых файлов после создания Course с
возобновлением и компенсацией незавершённой загрузки остаётся следующим срезом.

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

Roleless identity, observer и learner-safe projections находятся в отдельном
`src/modules/learner-identity/` service/repository. Teacher raw history по-
прежнему обслуживает LessonRuns service и `recorded_by_account_id`; self и
observer не получают direct raw records.

Schedule window имеет hard limit 500 Runs. Lesson/Course/Profile history
teacher-scoped projection ограничена последними 100 строками; Course read
всегда резервирует место для открытых Runs. Learner-safe self/observer history
имеет opaque cursor pagination до 50 items, а progress — bounded aggregate по
canonical lineage.

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
- AI routes: `src/app/api/v2/courses/[courseId]/ai-*/`, compatibility
  `assistant/` и deployed `src/app/api/v2/assistant/`;
- System Assistant UI/context: `src/components/assistant/`,
  `src/app/(app)/layout.tsx`, `src/app/styles/system-assistant.css`;
- authoring UI: `src/components/course-builder/lesson-authoring-workspace.tsx`;
- publication/catalog: `src/modules/course-publications/`,
  `src/components/course-builder/course-catalog-panel.tsx`;
- published self-learning workspace: `src/app/(app)/courses/catalog/[publicationId]/`,
  `src/components/course-builder/published-course-workspace.tsx`;
- revision progress и attestation: `src/modules/course-consumption/`,
  `src/modules/course-attestations/`, `src/app/api/v2/course-catalog/`;
- scheduling domain/service: `src/modules/lesson-runs/`;
- scheduling/history UI: `src/components/lesson-runs/`,
  `src/components/teaching-hub/`; integrated Schedule period/date control —
  `schedule-date-picker.tsx` и `schedule-period.ts`;
- scheduling API: `src/app/api/v2/lesson-runs/`, `learner-profiles/` и
  `learner-groups/`, Course/Lesson `audience|history|runs` routes;
- identity contracts/service/repositories: `src/modules/learner-identity/`;
- identity/self/observer UI: `src/components/learner-identity/`,
  `/learning-profile`, `/students?tab=observing`, `/settings/observers`;
  `/observing` — compatibility redirect;
- consented AI projection: `src/modules/ai/shared-history.ts`;
- canonical learner identity/access contract:
  `docs/architecture/learner-identity-access-model.md`;
- current schema: `supabase/schema/current-schema.sql`;
- Slide migration: `20260804044955_add_lesson_student_slides.sql`;
- LessonRun migration: `20260806190044_lesson_runs_learning_records.sql`.
- educator governance/progress migration:
  `20260812150745_educator_course_governance_progress.sql`.
- Groups/mixed audience migration:
  `20260806220726_learner_groups_mixed_course_audience.sql`.
- Canonical learner identity migration:
  `20260807033034_canonical_learner_profile.sql`.
- Roleless identity expand migrations:
  `20260807065017_identity_security_hardening.sql`,
  `20260807065026_learner_identity_primitives_backfill_invariant.sql`,
  `20260807065032_learner_identity_workflows_progress_observer_ai.sql`.
- Final contract cleanup after verified roleless releases:
  `20260807065038_learner_identity_legacy_contract_cleanup.sql`.
- Auth deferred-invariant and two-phase metadata fixes:
  `20260809084500_learner_identity_auth_deferred_invariant_security.sql`,
  `20260809090000_learner_identity_provisional_auth_metadata_sync.sql`.

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

Развёрнутый course-scoped Assistant является отдельным read-only ephemeral
flow. Он может видеть ограниченный Course context и выбранную Lesson, но не
вызывает commands/tools и не утверждает, что изменил данные. Его старый route
может временно оставаться compatibility boundary, но Course/Lesson dialog и
header actions удалены из current deployed UI.

Deployed base global System Assistant монтируется один раз только в protected
`(app)` layout. Browser передаёт strict allowlisted surface и typed
view текущей вкладки, Course/Lesson IDs при допустимости, локальную дату и UTC offset; DOM,
произвольный URL/search/hash и несохранённые form values не передаются. Server
повторно проходит universal active/provisional Account gate, user-JWT/RLS и
owner check. Он даёт provider bounded compact Course catalog и только
surface-specific projection: current Course/Lesson с разрешённой history,
Students/Groups либо Schedule выбранного дня. Technical/Auth/Storage IDs и file
contents исключены.

Schedule day/week/month presentation не расширяет этот AI boundary: assistant
получает только опорную `localDate` integrated calendar control и server-side
по-прежнему читает один разрешённый день. Видимое календарное окно нельзя
описывать модели как полностью загруженный day/week/month context без отдельного
contract change.

Current deployed signed conversational follow-up возвращает ответ или максимум
одно strict proposal. Provider ничего не записывает. Action card и отдельный
explicit Apply разрешают
`course.create_draft`, пустой `course.add_lesson`, наполненный
`course.add_lesson_with_plan`, `lesson.fill` и `lesson.delete`. Это не open-ended
tool calling: произвольный update, Auth/security, audience, Students/Groups,
Schedule/Run creation, publication и Student Screen mutations не входят в
allowlist. Apply вызывает те же canonical application commands с per-request
actor, поэтому результат не вводит второй AI-owned Course/Lesson тип и не меняет
authored hierarchy.

Неполный `add_lesson` без title является conversational clarification, а не
mutation и не provider-output 502. Пустой ref может означать `current_course`
только на уже проверенной Course surface; неизвестный непустой ref остаётся
ошибкой строгого контракта.

История global dialog остаётся в React state до reload/явного сброса. Rate и
concurrency guard, actor+target mutex и 10-минутный idempotency result cache
живут только в одном Node process. Restart или другая replica их не видят;
durable action ledger, distributed exactly-once и сериализация concurrent
Lesson append остаются next hardening. Proposal HMAC действует 10 минут, но не
заменяет durable ledger; delete fingerprint compare и RPC имеют известное
неатомарное TOCTOU окно. Новая schema/migration в System Assistant slice
отсутствует. Exact conversational follow-up `246cf49` развёрнут и прошёл
running-image/HTTP/guest postflight.

Lesson planning, compatibility course-scoped Assistant и global Course context
получают выбранные direct learners, teacher-local
названия и состав групп, дедуплицированную effective audience, до 8 завершённых
Runs текущего Course и до 40 последних финальных LearningRecords, записанных
текущим преподавателем об этих учениках по его курсам. Canonical identity не
открывает AI чужие teacher records. Технические IDs не передаются;
индивидуальный context ограничен attendance, repeat и teacher comment. Audience
и история входят в Lesson preview fingerprint, поэтому изменение membership
после preview делает Apply stale.

Current production identity contract добавляет отдельный subject-controlled
consent `profile + Course + current owner`. Без него behavior выше не меняется. С
active consent server-only function добавляет только deterministic bounded
sanitized aggregates всей canonical lineage и categorical signals из explicit
shared comments после PII scrub. Comment text/summary/quote, foreign raw rows,
Course/Lesson titles, exact timestamps, recorder/profile/Auth IDs и private
comments не попадают ни provider, ни teacher API. Preview фиксирует consent revision, а Apply после
revoke/expiry/owner/audience change fail closed. UI показывает факт
использования общей истории; assistant scrubber не позволяет цитировать shared
comment как чужую реплику.

Модель получает teacher context, но не file contents, signed URLs или Storage
credentials. Для attachments передаются только filename/MIME/status; parsing,
OCR, embeddings и RAG отсутствуют. Поэтому нельзя утверждать, что attachment
прочитан или использован моделью.

Provider request ID/model/token usage возвращаются UI и пишутся в ограниченный
metadata log. Persistent quota/ledger, billing и AI change sets не реализованы;
process-local provider rate limit не является балансом пользователя.
Learner-identity consent/audit schema входит в отдельные M2–M3 migrations, а не
в RouterAI authoring baseline.

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

- persisted assistant history, generalized tool calling и mutations за
  пределами подтверждаемого allowlist Course draft / новая пустая или
  наполненная Lesson / fill exact Lesson / delete exact Lesson;
- distributed assistant rate/idempotency ledger и exactly-once mutations между
  replicas;
- persistent AI quota/ledger, billing и change sets/undo;
- parsing/RAG загруженных файлов;
- persisted homework editor;
- live Student Screen sync, realtime presence и runtime cursor;
- richer learner metrics без реального Component/runtime producer;
- enrollment/consumption детских Course через LearnerProfile и live Student
  Screen access; Account-scoped self-learning educator publications уже
  реализован;
- cross-provider history без явного subject grant (намеренно запрещена);
- drag-and-drop, если надёжные кнопки «выше/ниже» уже обеспечивают reorder;
- автоматическая адаптация каталожного Course под группу, merge новых
  publication revisions в уже добавленную копию и catalog ratings;
- внешняя публикация MCP;
- compatibility layer для Step/Methodology не планируется;
- отдельные renderers по Course/Lesson ID.

Roleless Account bootstrap, invitation/claim, physical profile merge,
self/observer history, real-record progress и consented cross-provider AI уже
реализованы в current production и не меняют authored hierarchy Lesson. Phased
release/postflight завершены. Enrollment/consumption детских Course через
LearnerProfile и live Student Screen остаются later; educator self-learning
является current production.

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
11. Course показывает четыре собственные вкладки; **О курсе** растёт по
    содержимому без внутреннего vertical scroll, а **Материалы** остаются
    course-wide библиотекой. Новый Course начинает с **О курсе**;
    **Уроки** показывают полноширинную search/create toolbar и плотную таблицу с
    view-only sort поверх default `position ASC`; выбранная Lesson показывает
    отдельный H1, backlink с названием Course и пять Lesson-вкладок.
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
