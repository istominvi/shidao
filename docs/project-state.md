# Текущее состояние ShiDao V2

**Статус:** главный входной документ для разработки
**Актуально на:** 7 августа 2026 года
**Активная ветка:** `main`
**Рабочее приложение:** `https://v2.shidao.ru`
**Текущий функциональный application release:** `757044c`
**Последний полный automated/browser gate:** `757044c`

**Current deployed slice:** поверх group/audience baseline введены canonical
`LearnerProfile`, teacher-local relation `teacher_learner` и явный provenance
`learning_record.recorded_by_account_id`. Существующие профили сохраняются 1:1,
но teacher ownership/name/archive перенесены в relation; account claim, merge и
observer access не добавлены.

Forward migration `20260807033034_canonical_learner_profile.sql` применена к
production ShiDao DB 7 августа 2026 года после создания backup и прошла
DB/RLS/ACL/PostgREST postflight. Coolify развернул точный application SHA
`757044cf6f8c70aca329e52d48915f6d5b5b5844`; authenticated browser postflight
подтвердил вкладки и реальные данные Students, формы ученика и группы без
изменения пользовательских данных и без console warning/error.

Предыдущий reusable Groups/mixed audience baseline был развёрнут в release
`9393080` с migration
`20260806220726_learner_groups_mixed_course_audience.sql`.

Базовый LessonRun/LearningRecord slice был развёрнут ранее в release `fa91371`
с migration `20260806190044_lesson_runs_learning_records.sql`.

Двухуровневая навигация Course → Lesson, teacher-only `/schedule` и `/students`
и обновлённый визуальный язык app routes развёрнуты и проверены на release
`fea7f80`: сплошной бежевый фон без цветных градиентов, sticky demo header,
единые контролы и облегчённая типографика заголовков.

Release `fea7f80` добавляет пункты «Расписание / Ученики / Курсы» в меню
преподавателя и честные UI-shells для двух новых разделов. Он не добавляет
Schedule events, LessonSession, LearnerProfile, Group или новую
persistence/schema.

Release `3a94878` первоначально развернул RouterAI-срез: preview/apply для
программы Course и наполнения Lesson, а также read-only ephemeral AI-assistant.
Release `0276aed` переключил runtime на `google/gemini-2.5-flash-lite` и добавил
provider-flat transport для быстрой генерации Lesson с последующей canonical
validation. Production runtime получает `ROUTERAI_API_KEY` только из
server-side secret environment; browser и repository значения ключа не
содержат. Authenticated postflight подтвердил assistant и Lesson preview через
`v2.shidao.ru`; Apply не нажимался, тестовые данные не сохранялись. Подробная
граница зафиксирована в
[`docs/architecture/ai-provider-integration.md`](./architecture/ai-provider-integration.md).

Releases `8514441` и `7021801` снова обслуживают `demo.shidao.ru` как отдельный
исторический кликабельный UI-прототип вместо redirect в Course Builder. Он
использует только локальные фиктивные данные и React state, сохраняет clean-path
навигацию после reload, работает с Guest session и не вызывает V2 API/Supabase.
Это reference surface для дизайна, а не active V2 domain, compatibility fallback
или доказательство реализации показанных в нём будущих возможностей. Финальный
release дополнительно снимает ранее закэшированный permanent `308` через
одноразовый `/?restored=1`.

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
├── claimed LearnerProfile 0..1 (optional; claim later)
├── TeacherLearner 0..N → LearnerProfile
├── LearnerGroup 0..N → LearnerProfile 0..N
└── Course
    ├── audience sources → direct LearnerProfile + LearnerGroup
    ├── effective audience → unique active LearnerProfile 0..N
    ├── course-wide Attachments
    └── Lesson 1..N
        ├── ordered Components 1..N
        ├── Student Screen projection
        │   └── ordered Slides 1..N → ссылки на Components
        └── LessonRun 0..N
            └── LearningRecord 0..N → LearnerProfile + recorded-by Account
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
- Lesson является и редактируемым содержанием, и точкой назначения. LessonRun
  хранит только конкретное время/проведение, а не копию контента или второй
  runtime-урок.
- Один открытый LessonRun можно переносить; после completion/cancel ту же
  Lesson можно назначить повторно всей аудитории или её части.
- LearningRecord до completion является ожидаемым участником, а после —
  долговечной индивидуальной историей. `recorded_by_account_id` фиксирует автора
  записи и ограничивает текущую teacher history. Отдельных
  participant/snapshot/status tables нет.
- LearnerProfile — canonical learning identity без teacher owner. Nullable
  unique `account_id` является только точкой будущего claim; текущие профили с
  login автоматически не связываются.
- TeacherLearner хранит связь преподавателя с canonical profile, локальное имя
  и archive state. LearnerGroup — переиспользуемый teacher-owned набор этих же
  профилей, а не второй вид ученика. Профиль может не иметь группы или входить в
  несколько групп одного преподавателя.
- Course хранит direct learners и groups как независимые источники; scheduling
  и AI используют их дедуплицированную эффективную аудиторию.
- Состав уже открытого LessonRun зафиксирован draft LearningRecords. Изменение
  группы влияет на будущие назначения, но не переписывает существующее.
- Открытый/завершённый Run имеет хотя бы одну запись; cancel удаляет drafts,
  поэтому сохранённый отменённый Run может иметь ноль LearningRecord.

Полные Lesson/Run invariants зафиксированы в
[`docs/architecture/lesson-workflow-model.md`](./architecture/lesson-workflow-model.md),
а identity/access boundary — в
[`docs/architecture/learner-identity-access-model.md`](./architecture/learner-identity-access-model.md).

## 2. Что реализовано в текущем коде

### Auth и домены

- `shidao.ru` и `www.shidao.ru` показывают только landing.
- Любая внутренняя page/API-ссылка на основном домене закрыта middleware.
- `v2.shidao.ru` обслуживает Auth и рабочее приложение.
- `v2.shidao.ru` закрыт от индексации.
- `demo.shidao.ru` внутренне переписывает root и clean deep links на
  standalone `/demo`, закрыт от индексации и не принимает unsafe HTTP methods.
- Standalone demo использует Guest session и фиктивное client-only состояние;
  V2 API, Supabase и persistence к нему не подключены.
- Email signup, confirm, login, recovery и reset используют существующий
  self-hosted Supabase Auth и SMTP.
- После первого взрослого входа без профиля открывается `/onboarding`, затем
  пользователь попадает в `/courses`.
- Существующая app-session поддерживает глобальную и пользовательскую
  инвалидизацию.

### Курсы

- `/courses` показывает реальные Course текущего Account.
- `/courses/new` создаёт пустой persisted draft, запускает простой
  детерминированный assembler или позволяет запросить AI-программу, проверить
  preview и отдельно применить её.
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
- «Источники» честно показывают пустое состояние до parsing/RAG. «История»
  показывает завершённые проведения всех Lessons; change history авторских
  правок ещё не реализована.
- В текущем source страницы `/courses`, `/students`, `/schedule`, Course и
  Lesson используют один сплошной фон `#f5f1e8`; marketing noise и цветные page
  gradients на этих маршрутах отсутствуют.
- Course header следует demo-контракту: sticky shell высотой 68 px, белая
  полупрозрачная поверхность, радиус 20 px и контролы 40 px с радиусом 12 px.
- Один `AppPageHeader` задаёт прозрачную заголовочную секцию, единый крупный H1,
  подзаголовок, optional backlink и правую action-секцию для `/courses`,
  `/students`, `/schedule`, Course и Lesson. Course/Lesson сохраняют backlink,
  а top-level разделы не создают искусственную обратную ссылку.
- Один `WorkspaceTabs` используется в Course, Lesson, Students и profile dialog,
  сохраняет roving keyboard/ARIA contract и горизонтальный scroll. Выбранная
  вкладка утолщает общую нижнюю линию квадратным чёрным сегментом 3 px без
  скруглённой рамки; кнопки и вкладки используют шрифт `.88rem/500`.

### Teacher navigation, Расписание, Ученики и аудитория

- Начиная с release `fea7f80` основная навигация активного teacher profile
  содержит пункты «Расписание / Ученики / Курсы». Parent profile и
  transitional Student продолжают видеть только «Курсы».
- `/schedule` и `/students` находятся под отдельным teacher-required layout.
  Guest/degraded session перенаправляется в `/login`, взрослый без профиля — в
  `/onboarding`, Parent и transitional Student — в `/courses`.
- `/schedule` показывает реальные LessonRun выбранного локального дня. Это
  проекция тех же проведений, а не отдельная таблица Schedule events.
- Action «Назначить урок в курсе» находится в общей page-header action-секции;
  переключение дня остаётся отдельным toolbar ниже заголовка.
- `/students` показывает единый teacher-scoped projection
  `TeacherLearner + LearnerProfile` во вкладках «Ученики / Группы». Таблица
  учеников поддерживает поиск, фильтр по группе и сортировку; в строке видны до
  двух групп и счётчик «ещё N». Отдельная вкладка групп показывает только
  reusable groups и их состав.
- Клик по строке ученика открывает dialog «Профиль / История»: здесь можно
  изменить локальное имя и membership в нескольких группах, а история
  ограничена LearningRecord текущего преподавателя. Ученика можно создать,
  изменить и убрать из своего списка; для групп доступен полный CRUD. Видимое
  имя принадлежит relation текущего преподавателя, а не глобальной identity.
- Header action на `/students` следует выбранной вкладке: «Новый ученик» или
  «Новая группа»; поиск, фильтры и сортировка остаются в directory toolbar.
- Product delete ученика архивирует только `teacher_learner` текущего Account:
  relation исчезает из активного справочника, групп и будущих Course audiences,
  а canonical LearnerProfile, его LearningRecord и состав уже назначенного Run
  сохраняются. Список архива и восстановление relation пока не реализованы.
  Удаление группы не удаляет учеников или историю.
- Course header независимо прикрепляет группы и отдельных учеников; overlap
  учитывается один раз, а header показывает число уникальных effective learners.
- Legacy `student`, `class`, `class_student` не читаются. Nullable
  `learner_profile.account_id` уже резервирует one-to-one claim point, но
  linking/invitation, duplicate merge, Guardian/observer и learner access не
  реализованы.
- Если `account_id` будет заполнен будущим trusted flow, RLS уже позволяет
  Account выбрать только свою canonical profile row. Teacher relation, Course и
  LearningRecord этим не открываются.
- Из Course/Lesson можно назначить или перенести время, выбрать subset
  аудитории, начать, завершить постфактум или отменить проведение.
- Completion сохраняет общий teacher report и для каждого ожидаемого ученика:
  attendance, repeat recommendation и индивидуальный comment.
- Каждый draft/finalized LearningRecord сразу получает
  `recorded_by_account_id`; текущие history и AI reads возвращают только записи
  этого преподавателя, а не глобальную историю всех будущих связей profile.
- Attendance нельзя сохранить значением по умолчанию: преподаватель явно
  выбирает «Был» или «Не был» для каждого ожидаемого ученика. Активный Run
  можно отменить, а закрытие заполненного отчёта требует подтверждения.
- Статусы интерфейса вычисляются из timestamps; отдельной persisted state
  machine нет.
- Все surfaces используют тот же плоский бежевый demo visual language, header,
  кнопки, карточки и типографику, что и Course routes.

### Уроки и компоненты

- На Course → «Уроки» отображается полный список Lessons и кнопка «Добавить
  урок»; редактор не открывается до явного выбора Lesson.
- После выбора Lesson backlink содержит название Course, а заголовок имеет
  формат `Урок {position}. {title}`.
- Lesson содержит вкладки «План / Экран ученика / Домашнее задание / Материалы
  / История».
- Lesson → «Материалы» является read-only проекцией course-wide attachments и
  не вводит владение файлами на уровне Lesson; «История» показывает реально
  завершённые LessonRun.
- Создание вручную требует только название и создаёт пустую Lesson без AI и
  без списания токенов.
- В текущем production UI кнопка AI открывает preview/apply для новой Lesson или
  дополнения существующей; ручное создание пустой Lesson остаётся доступным.
- Название и комментарий Lesson редактируются отдельной модалкой.
- Карточку Lesson нельзя перемещать или назначать на Student Screen.
- Lesson можно удалить; оставшиеся позиции уплотняются. UI предупреждает, что
  Components/Slides/Runs и незавершённые records будут удалены, а finalized
  LearningRecord сохранятся в LearnerProfile с компактным title/subject
  context.
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
пользовательский JWT и не обращается к таблицам напрямую. RouterAI не
подключается к `stdio` transport: production AI orchestration вызывает те же
application service/contracts внутри authenticated web request.

### AI provider integration — current production boundary

- Server-only adapter вызывает OpenAI-compatible RouterAI endpoint. Default
  model в source — `google/gemini-2.5-flash-lite`; key, model, base URL и timeout
  задаются server environment и не отправляются browser. Runtime release
  `0276aed` проверен с этой моделью без вывода secret.
- New Course flow сначала сохраняет обычный пустой Course и attachments, затем
  получает ровно `targetLessonCount` titles/comments. Provider call ничего не
  записывает; UI показывает preview, model и token usage, а Lessons появляются
  только после отдельного Apply.
- Lesson planning поддерживает новую или существующую Lesson. Provider output
  ограничен типами `heading`, `rich_text`, `callout`, `divider`,
  `single_choice_poll`, `matching_game` и повторно валидируется registry/Zod
  contracts до первой записи.
- Provider-facing structured-output schema является плоским transport adapter.
  После ответа она преобразуется в canonical AI plan, а payload каждого
  Component повторно проходит соответствующую registry schema и обычный
  `lessonAddComponentInputSchema`; transport shape не становится вторым
  Component registry.
- Lesson Apply проверяет, что Course/Lesson не изменились после preview. Для
  существующей Lesson он обновляет teacher comment и добавляет Components, не
  заменяя уже существующие. Новые Components остаются `staff_only`; Student
  Screen не публикуется автоматически.
- Course/Lesson apply использует существующий `CourseBuilderApplicationService`
  с per-request actor, ownership и пользовательским JWT. SQL, service role,
  отдельная AI-таблица или migration не добавлены.
- Assistant читает bounded Course/selected Lesson context и отвечает текстом,
  но не вызывает mutation commands, MCP tools или apply routes. История живёт
  только в React state dialog и исчезает после close/reload.
- Lesson planning и Assistant дополнительно читают direct learners, группы и
  дедуплицированную effective audience с teacher-local именами, до 8 завершённых
  Runs текущего Course и до 40 finalized LearningRecords, записанных текущим
  преподавателем об этих учениках по его курсам. Canonical profile не открывает
  AI observations другого преподавателя. Технические IDs исключены; отсутствие
  не трактуется как непонимание. Audience/history входят в Lesson preview
  fingerprint. Полный provider context имеет единый hard budget 96 000 символов
  и детерминированно сокращает только oversized значения.
- Attachment contents, signed URLs и Storage identifiers модели не передаются:
  доступны только filename/MIME/status. Parsing, OCR, embeddings и RAG не
  реализованы.
- Provider request ID/model/usage возвращаются UI и попадают в ограниченный
  server log event. Persistent quota/ledger, billing, balance и AI change sets
  отсутствуют; process-local rate limit не является пользовательской квотой.

Routes, UI, server-only secret boundary и provider postflight no-write flows
этого среза развёрнуты и проверены в production. Release acceptance описан в
[`docs/architecture/ai-provider-integration.md`](./architecture/ai-provider-integration.md).
Это утверждение относится к base RouterAI flow release `0276aed`.
History-aware context развёрнут в release `9393080`; production provider smoke
с непустой учебной историей ещё не выполнялся.

## 3. Что ещё не реализовано

- пользовательский выбор модели и persisted provider settings;
- persistent assistant/Course chat, write-capable assistant и tool calling;
- persistent token quota/ledger, billing units, balance и AI change sets/undo;
- parsing/RAG прикреплённых материалов;
- добавление новых материалов из модалки существующего Course;
- persisted Homework editor;
- Learner-facing кабинет, enrollment и настоящий доступ ученика к Course;
- Guardian/observer relations, invitation/claim, duplicate-profile merge и
  перенос legacy identity в canonical profile;
- cross-provider history/AI access без явной subject-controlled grant model;
- live Student Screen sync, realtime presence и teacher-controlled runtime
  cursor поверх открытого LessonRun;
- автоматические предметные metrics, progress aggregation и аналитика сверх
  текущих attendance/repeat/comments;
- persisted communication chat и notifications;
- templates/marketplace;
- внешний remote MCP/API для сторонних агентов;
- отдельный staging-контур.

Перечень не является разрешением реализовать всё сразу. Приоритеты и границы
следующих срезов находятся в [`docs/roadmap.md`](./roadmap.md).

## 4. Переходное состояние identity

Новая Course-модель использует `account`, связанный один-к-одному с
`auth.users`. Canonical `learner_profile` больше не принадлежит teacher Account:
nullable unique `account_id` является будущей связью самого учащегося, а
`teacher_learner` хранит текущую teacher relation, локальное имя и archive state.
Все существующие профили backfilled 1:1 без автоматического linking/merge.
`learner_group` и Course audience остаются teacher-owned и принимают только
profiles с активной relation этого преподавателя. Полный current/later contract
находится в
[`learner-identity-access-model.md`](./architecture/learner-identity-access-model.md).

При этом старые таблицы `teacher`, `parent`, `student`, `school`,
`school_teacher`, `class`, `class_teacher` и `class_student` временно сохранены
для текущего login/onboarding/profile/session поведения.

Это compatibility identity scope, а не новая иерархия Course. Новый код
Course Builder не делает Course дочерним объектом School, Class, Teacher или
Methodology и не превращает legacy Student в LearnerProfile. Удаление или
замена compatibility tables требует отдельного identity milestone и forward
migration.

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
learner_profile
teacher_learner
learner_group
learner_group_member
course_learner
course_learner_group
lesson_run
learning_record
```

Эти tables принадлежат identity/audience/scheduling/history slice, а не
provider accounting. `learner_profile` является canonical identity,
`teacher_learner` — teacher-local directory relation. `lesson_run` не содержит
Lesson content; один partial unique index допускает один открытый Run на Lesson.
`learning_record` заменяет participant table: `occurred_at IS NULL` означает
expected row, non-null — finalized durable result, а
`recorded_by_account_id` сохраняет recorder. Persisted status и full Lesson
snapshot отсутствуют. Recorder immutable; `learning_record` и recorder Account
используют restrictive deletion boundary, а удаление linked subject Account
только обнуляет nullable `learner_profile.account_id`.

Текущий AI-срез читает bounded finalized history, но по-прежнему не сохраняет
provider requests, assistant dialog history или quota state в БД.

Последние структурные migrations:

- `20260804033421_course_lesson_components_remove_legacy_methodology.sql` —
  удаление активного Methodology/Step/runtime слоя и переход к direct Lesson
  Components;
- `20260804044955_add_lesson_student_slides.sql` — persisted Student Screen
  Slides, assignment/reorder/delete RPC и RLS/ACL;
- `20260806190044_lesson_runs_learning_records.sql` — neutral LearnerProfile,
  direct Course audience, LessonRun/LearningRecord, lifecycle RPC, deletion
  retention, RLS/ACL.
- `20260806220726_learner_groups_mixed_course_audience.sql` — reusable Groups,
  mixed/deduplicated Course audience, safe LearnerProfile archive, group CRUD,
  dynamic future scheduling и RLS/ACL.
- `20260807033034_canonical_learner_profile.sql` — canonical LearnerProfile,
  teacher-local `teacher_learner`, recorder provenance/backfill, relation-scoped
  archive и обновлённые RLS/ACL/RPC contracts.

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

| Область                      | Каноническое место                                                                                                       |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Course/Lesson contracts      | `src/modules/course-builder/contracts.ts`                                                                                |
| Domain/read models           | `src/modules/course-builder/domain.ts`                                                                                   |
| Application service          | `src/modules/course-builder/service.ts`                                                                                  |
| Supabase repository          | `src/modules/course-builder/repository.ts`                                                                               |
| Storage adapter              | `src/modules/course-builder/storage.ts`                                                                                  |
| Component registry           | `src/modules/course-builder/registry/contracts.ts`                                                                       |
| MCP tools/server             | `src/modules/course-builder/mcp/`                                                                                        |
| AI provider adapter          | `src/modules/ai/routerai.ts`                                                                                             |
| AI provider transport        | `src/modules/ai/lesson-provider-contracts.ts`                                                                            |
| AI request/contracts         | `src/modules/ai/course-builder-contracts.ts`                                                                             |
| AI context/service           | `src/modules/ai/course-context.ts`, `src/modules/ai/course-builder-service.ts`                                           |
| AI API/error boundary        | `src/app/api/v2/courses/[courseId]/ai-*/`, `assistant/`, `src/modules/ai/server-context.ts`                              |
| AI dialogs                   | `src/components/course-builder/ai-course-plan-dialog.tsx`, `ai-lesson-plan-dialog.tsx`, `ai-course-assistant-dialog.tsx` |
| LessonRun domain/contracts   | `src/modules/lesson-runs/domain.ts`, `contracts.ts`                                                                      |
| LessonRun service/repository | `src/modules/lesson-runs/service.ts`, `repository.ts`, `server-context.ts`                                               |
| LessonRun API                | `src/app/api/v2/lesson-runs/`, `learner-profiles/`, `learner-groups/`, Course/Lesson audience/history/runs routes        |
| LessonRun UI                 | `src/components/lesson-runs/`                                                                                            |
| Learner identity/access      | `docs/architecture/learner-identity-access-model.md`, `src/modules/lesson-runs/`                                         |
| Course browser client        | `src/components/course-builder/course-builder-client.ts`                                                                 |
| New Course flow              | `src/components/course-builder/new-course-form.tsx`                                                                      |
| Course workspace             | `src/components/course-builder/course-workspace.tsx`                                                                     |
| Course/Lesson navigation     | `src/components/course-builder/course-workspace-navigation.ts`                                                           |
| Workspace tabs/materials     | `src/components/ui/workspace-tabs.tsx`, `src/components/course-builder/course-materials-panel.tsx`                       |
| Lesson editor/Slides         | `src/components/course-builder/lesson-authoring-workspace.tsx`                                                           |
| Component editors/renderers  | `src/components/course-builder/component-payload-editor.tsx`, `component-renderers.tsx`                                  |
| Fullscreen preview           | `src/components/course-builder/student-screen-preview.tsx`                                                               |
| Teacher Schedule             | `src/app/(app)/(teacher-required)/schedule/`, `src/components/teaching-hub/schedule-workspace.tsx`                       |
| Teacher Students             | `src/app/(app)/(teacher-required)/students/`, `src/components/teaching-hub/students-workspace.tsx`                       |
| Teacher route boundary       | `src/app/(app)/(teacher-required)/layout.tsx`, `src/lib/server/access-guards.ts`                                         |
| V2 API routes                | `src/app/api/v2/`                                                                                                        |
| Standalone historical demo   | `src/app/demo/`, `public/og-demo-v2.png`                                                                                 |
| Host boundary                | `src/middleware.ts`, `src/lib/deployment-access.ts`                                                                      |
| Auth/session                 | `src/lib/auth.ts`, `src/lib/server/`                                                                                     |
| Current schema               | `supabase/schema/current-schema.sql`                                                                                     |
| Forward history              | `supabase/migrations/`                                                                                                   |

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

V2 API находится под `/api/v2/` и включает `learner-profiles`, Course
`audience|history`, Lesson `runs|history` и `lesson-runs` schedule/lifecycle
routes. Canonical learner slice сохраняет эти URL и product RPC names, меняя их
backing projection на `teacher_learner`. Все используют per-request actor,
application service и user JWT/RLS; старые dashboard/methodology/group/
scheduled-lesson routes не поддерживаются как compatibility URL.

Schedule reads ограничены 500 Runs на окно. Lesson/Course/Profile history
возвращает последние 100 элементов; Course read всегда включает открытые Runs.
Длинные `IN` hydration-запросы разбиваются на bounded batches.

Текущий production AI-срез добавляет authenticated `POST` routes `ai-plan`,
`ai-apply`, `ai-lesson-plan`, `ai-lesson-apply` и `assistant` под
`/api/v2/courses/[courseId]/`. Planning/chat routes вызывают provider; apply
routes только валидируют preview и выполняют существующие application commands.

Дополнительные project surfaces:

- `brand.shidao.ru` → brand reference;
- `model.shidao.ru` → публичное объяснение модели;
- `demo.shidao.ru` → изолированный исторический UI-прототип с clean-path
  навигацией (`/`, `/students`, `/courses`, Course/Lesson и `/lesson/live`).

Demo не импортируется активными Course/Lesson routes, не вызывает application
services/API и не сохраняет изменения. Его локальные Step/Methodology,
schedule/group и AI fixtures не входят в текущую V2-модель и не могут
использоваться как acceptance evidence.

Known host-boundary debt: middleware переписывает только `/` у `brand`/`model`
и пропускает unknown hosts; noindex применяется к exact V2 и demo hosts.
Standalone demo имеет собственную read-only границу, но изоляция остальных
дополнительных paths всё ещё зависит от proxy/DNS. До публичного launch нужен
explicit production host allowlist или закрытие non-canonical hosts/paths.
CSRF guard пока допускает configured landing host как Origin для unsafe V2
requests. Строгая app-host boundary и cross-subdomain regression test остаются
P0-задачей вместе с явным production host allowlist.

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

Для базового LessonRun slice локально подтверждены:

- typecheck и lint;
- 256/256 unit/contract tests;
- production build;
- 9/9 browser smoke с mock Supabase, включая новые пустые
  `/schedule`/`students` и Course history/audience reads;
- isolated PostgreSQL 16 apply и owner flow
  `audience → schedule → reschedule → complete → repeat → cancel → delete`;
- после удаления Lesson 3/3 finalized LearningRecord сохранились, draft rows
  удалились; cross-owner, empty-audience, stale reschedule, empty completion и
  cancel-before-start paths были отклонены; authenticated Profile DELETE
  отсутствует.

Это acceptance current repository и isolated clone. Production migration
дополнительно применена 7 августа 2026 года: четыре таблицы и шесть RPC видны
PostgREST, RLS/ACL прошли проверку, owner workflow прошёл внутри rollback-probe,
а cross-account probe увидел 0 чужих строк. Coolify deployment точного SHA
`fa91371` завершился за 224 секунды; deployed browser postflight подтвердил
реальные Course, пустые Schedule/Students, Course audience/run/history UI и
чистую console без создания тестовых данных.

Текущий browser-smoke helper использует актуальную AES-GCM app-session с
Supabase access/refresh tokens. Строгий gate сам собирает production-приложение
против локального mock Supabase, поэтому build-time `NEXT_PUBLIC_*` и runtime
конфигурация совпадают и тест не обращается к рабочей базе. Воспроизводимый
результат `npm run test:browser:ci` для release `fea7f80`: 8 сценариев pass,
включая teacher-навигацию Schedule → Students, мобильное меню
«Расписание / Ученики / Курсы», авторизованный переход Course → Lesson →
backlink обратно к Course, computed visual contract и mobile 375 px без
document-level overflow.

Repository-wide `npm run format:check` также пока не является зелёным baseline:
он сообщает десятки ранее существовавших файлов, включая immutable content
archive и unrelated application sources. Все изменённые в этом documentation slice
Markdown files проходят targeted Prettier check и `git diff --check`. Перед
обязательным global format gate нужен отдельный baseline/ignore change без
переформатирования archive.

На application release `fea7f80` подтверждены typecheck, lint, 183 unit tests,
production build и строгие 8/8 browser smoke. Coolify deployment точного SHA
завершился со статусом Success; deployed postflight подтвердил guest redirect
`/schedule` → `/login`, teacher-only меню «Расписание / Ученики / Курсы», обе
новые страницы, чтение реальных Course summaries, прозрачный page header,
плоский фон `#f5f1e8` и переход обратно в `/courses`.

Release `0276aed` прошёл typecheck, lint, 218 unit/contract tests, production
build и строгие 8/8 browser smoke. Coolify развернул точный SHA; runtime check
подтвердил наличие закрытого key и model
`google/gemini-2.5-flash-lite`. Bounded provider smoke вернул Course outline из
трёх Lessons за 2,8 с и Lesson из шести canonical Component types за 3,8 с.
Authenticated `v2.shidao.ru` smoke получил ответ assistant примерно за 7,3 с и
Lesson preview со всеми шестью Component types примерно за 8,3 с. Apply не
нажимался: число Lessons до и после проверки осталось равным 1. Live Apply и
искусственно вызванный provider-error fallback не выполнялись на пользовательских
данных; их validation, stale protection и compensation покрыты automated tests.

Release `7021801` прошёл typecheck, lint, 224 unit/contract tests, production
build и строгие 9/9 browser smoke. Coolify развернул exact SHA со статусом
Success. HTTP postflight подтвердил demo root/deep-link `200` без `Location`,
`image/png` для OG asset, `robots.txt`/noindex, read-only `405`, сохранность
landing `503` и V2 guest redirect. В browser profile с реально закэшированным
старым `308` вход `/?restored=1` очистил cache и заменил адрес на `/`; обычный
root после этого не редиректит. Интерактивно проверены «Расписание / Ученики /
Курсы», reload `/courses`, прямой Lesson deep link и его reload; browser console
не содержит warning/error.

Release `fa91371` прошёл typecheck, lint, 256 unit/contract tests, production
build и строгие 9/9 browser smoke до публикации. Production ShiDao migration
применена транзакционно и проверена через RLS/ACL, rollback owner/cross-account
probe и authenticated PostgREST OpenAPI. Coolify развернул exact SHA со статусом
`finished`; HTTP postflight сохранил landing/demo/guest/noindex boundaries, а
authenticated browser postflight подтвердил реальные `/courses`, `/schedule`,
`/students`, Course audience, назначение и историю без сохранения тестовых
данных. Browser console не содержит warning/error.

Release `9393080` прошёл typecheck, lint, 270/270 unit/contract tests,
production build и строгие 10/10 browser smoke. Миграция групп и смешанной
аудитории успешно применена к isolated PostgreSQL 16 и production ShiDao DB;
проверены ownership, RLS/ACL, лимит 200 уникальных учеников, дедупликация
пересекающихся групп, неизменность уже назначенной аудитории, мягкая архивация
ученика и сохранность finalized LearningRecord. Production rollback-probe
подтвердил authenticated CRUD без остаточных записей, а PostgREST OpenAPI и
relationship queries увидели все три новые таблицы. Coolify запустил exact image
`939308070323b6e920a870b503a2911dd32c654a` без restart; authenticated browser
прочитал каталог, формы ученика/группы и mixed Course audience без console или
runtime errors и без изменения пользовательских данных.

Release `757044c` прошёл typecheck, lint, 275/275 unit/contract tests,
production build и строгие 10/10 browser smoke. Canonical learner migration
проверена на isolated PostgreSQL, включая сохранение исторического
`learning_record.updated_at`, а затем применена транзакционно к production
PostgreSQL 15.8 от имени владельца таблиц. Перед изменением создан backup
`/root/shidao-db-backups/shidao-public-before-canonical-learner-20260807T042327Z.dump`;
SHA-256 применённого migration file —
`5cadc8e09834151dff0a2c05f3c24dca5a2c1d94fed9a3224bfb7e7ad43494b2`.
Postflight подтвердил `teacher_learner`, nullable unique
`learner_profile.account_id`, обязательный
`learning_record.recorded_by_account_id`, backfill существующей связи 1:1,
RLS/ACL и недоступность чужой relation/history для второго JWT. PostgREST
увидел новую relation и canonical profile shape. Coolify завершил deployment и
запустил exact image
`g9x4d9zn60jv35r7zf0xl6xj:757044cf6f8c70aca329e52d48915f6d5b5b5844`.
Authenticated browser прочитал реального ученика и группу, переключил обе
вкладки и открыл формы управления без сохранения данных; console warning/error
не обнаружены.

## 10. Правило обновления этого документа

После каждого законченного vertical slice агент обязан:

1. перенести реализованные пункты из roadmap в этот документ;
2. обновить карту реализации, routes, tools и schema state;
3. отметить честные ограничения и заглушки;
4. обновить связанные канонические документы;
5. не описывать запланированную возможность в прошедшем времени до проверки в
   deployed или согласованном тестовом окружении.
