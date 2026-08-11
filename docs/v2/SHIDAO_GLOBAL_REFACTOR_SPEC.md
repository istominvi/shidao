# ShiDao V2 — актуальная глобальная спецификация

**Статус:** нормативные границы текущей архитектуры и будущего развития
**Актуально на:** 12 августа 2026 года
**Repository/branch:** `istominvi/shidao`, `main`
**Рабочее приложение:** `v2.shidao.ru`
**Публичный домен:** `shidao.ru` — landing-only

## 1. Как читать документ

В документе используются три статуса:

- **CURRENT** — реализовано и должно совпадать с кодом/schema;
- **NEXT** — согласованный near-term roadmap, ещё не реализованный; конкретный
  приоритет P0/P1 указывается в заголовке;
- **LATER** — целевая модель, не существующая сейчас.

Факты о deployed и ещё не развёрнутом repository scope находятся в
[`docs/project-state.md`](../project-state.md). Порядок следующих работ — в
[`docs/roadmap.md`](../roadmap.md). Если будущая модель ниже отсутствует в
project-state/current schema, она не реализована.

Обязательные связанные документы:

- [`docs/architecture/lesson-workflow-model.md`](../architecture/lesson-workflow-model.md)
- [`docs/architecture/learner-identity-access-model.md`](../architecture/learner-identity-access-model.md)
- [`docs/database/current-schema.md`](../database/current-schema.md)
- [`docs/v2/COURSE_BUILDER_MCP.md`](./COURSE_BUILDER_MCP.md)
- [`docs/operations/v2-deployment-runbook.md`](../operations/v2-deployment-runbook.md)
- [`docs/operations/v1-recovery-runbook.md`](../operations/v1-recovery-runbook.md)

## 2. Цель V2

ShiDao развивается как персональная образовательная система, в которой человек
может создать Course, подготовить Lessons вручную или с AI, провести обучение
сам либо передать часть работы AI и сохранить долгосрочную учебную историю.

Текущий продукт уже содержит roleless Account foundation: owner-scoped Course
Builder с реальными данными, private materials, code-first Components и Student
Screen preview; canonical learner directory, Groups, Course audience,
LessonRun/history; learner-safe self/observer profile и consented AI context;
RouterAI preview/assistant и internal MCP. Primary navigation содержит
«Расписание / Ученики / Курсы», Account menu — «Учебный профиль / Настройки /
Выход», а `/courses` поддерживает поиск, фильтры, сортировку и режимы «Плитки /
Таблица».

## 3. Неподвижные границы реконструкции

### CURRENT

- разработка продолжается в текущем repository и `main`;
- используется текущий Coolify application;
- используется текущий self-hosted Supabase/PostgreSQL/Auth/Storage/SMTP;
- существующие `auth.users`, password hashes и email flow сохраняются;
- schema меняется только forward migrations;
- старые migrations не удаляются, не переписываются и не squash'ятся;
- массовый reset `public` не является обычной стратегией разработки;
- отдельный V2 repository/Supabase project не создаётся;
- `shidao.ru` остаётся landing-only, приложение работает на `v2.shidao.ru`;
- V1 refs/recovery snapshot не меняются и не восстанавливаются без явной
  команды владельца.
- `Account` является единственной login identity; преподавание, обучение и
  наблюдение задаются relations/capabilities, а не глобальной ролью;
- каждый `active | provisional` Account имеет ровно один linked
  LearnerProfile; offline profiles сохраняют `account_id IS NULL` до
  recipient-bound claim/activation.

### LATER

Отдельный staging пока не настроен. Если он появится, он должен иметь отдельные
logical data, Auth, Storage, secrets и синтетические данные.

## 4. Архивная граница

V1 сохранена:

- branch `archive/v1-2026-08-03`;
- tag `v1-snapshot-2026-08-03`;
- private `.local-backups/v1-snapshot-2026-08-03`;
- tracked content archive `archive/content/world-around-me-2026-08-04/`.

Архив «Мир вокруг меня» содержит Markdown, lossless exports, source documents,
assets, manifests и checksums. Он не является fixture или runtime dependency.

Будущий importer может создать обычные Course/Lesson/Component/Attachment через
валидируемый application layer. Он не возвращает Methodology domain или старые
IDs в active model.

# CURRENT architecture

## 5. Current product hierarchy

```text
Auth User
└── Account
    ├── linked LearnerProfile exactly 1 for active/provisional Account
    ├── TeacherLearner 0..N → LearnerProfile
    ├── ObserverGrant 0..N → LearnerProfile
    ├── LearnerGroup 0..N → LearnerProfile 0..N
    └── Course
        ├── direct CourseLearner → LearnerProfile
        ├── CourseLearnerGroup → LearnerGroup
        ├── CourseAttachment → StoredFile
        └── Lesson 1..N
            ├── LessonComponent 1..N
            ├── LessonStudentSlide 1..N
            └── LessonRun 0..N → LearningRecord 0..N
                └── recorded-by Account

Offline LearnerProfile
└── account_id IS NULL до recipient-bound claim/activation
```

Каноническая authored hierarchy:

```text
Course → Lesson → ordered Components
```

Student Screen Slide является только persisted presentation projection. Он не
является authored parent, Step или вторым component list.

## 6. Course

Course:

- принадлежит одному Account;
- сейчас отображается в domain как `draft`; физически active row определяется
  через `archived_at IS NULL`, отдельной колонки `status` нет;
- хранит title, subject, goal, level, audience description,
  target lesson count и teacher preferences;
- может существовать без Lessons;
- открывает Settings и course-scoped Materials отдельными actions;
- не принадлежит Teacher/School/Class/Methodology.

`audience_description` остаётся текстовым teacher input. Persisted audience
содержит независимые direct `course_learner` и group `course_learner_group`
sources; effective audience является distinct union активных TeacherLearner
relations.

Current `/courses` каталог выполняет client-side поиск по публичным Course
полям, фильтрует по предмету, уровню и наполнению, сортирует результаты и
переключается между «Плитки / Таблица». Это не добавляет новую schema или
параллельный Course API.

## 7. Lesson

Lesson:

- принадлежит Course;
- имеет `position`; supported service path поддерживает плотность, а
  concurrency-safe append ещё входит в P0 hardening;
- имеет обязательный `title`;
- имеет teacher-only `summary`;
- может оставаться пустой;
- непосредственно владеет одним ordered Component list.

Нет `Lesson Step`, root Step, group/placement parent или compatibility layer.

## 8. Lesson Component

Current physical contract:

```text
lesson_component
- id
- lesson_id
- type_key
- schema_version
- position
- payload
- placement_config
- visibility: staff_only | learner_visible
- student_slide_id: uuid | null
- created_at
- updated_at
```

- `position` — единственный authored order.
- Новый Component всегда `staff_only`/unassigned.
- Payload и placement валидируются code-first registry.
- Update payload/placement, delete, reorder и Student Screen assignment идут
  через application service.
- Registry type не становится отдельной таблицей.

## 9. Student Screen Slides

Current projection:

```text
lesson_student_slide
- id
- lesson_id
- position
- created_at
- updated_at
```

Slide не имеет title, payload, instructions или порядка внутри себя.

Student Screen строится:

```text
Slides by slide.position
→ learner_visible Components assigned to Slide
→ preserve lesson_component.position
→ render one active Slide
```

Инварианты:

- private Component не имеет Slide;
- learner-visible Component имеет ровно один Slide той же Lesson;
- Slide numbers плотные, пустые Slides удаляются;
- Slide position не уменьшается по ходу Component order;
- assignment предлагает только legal range между видимыми соседями;
- reorder при необходимости clamp'ит moved Component к legal Slide.

Lesson title показывается ученику автоматически. Lesson summary и private
Components отсутствуют в learner response, а не скрываются CSS.

## 10. Lesson surfaces

Для выбранной Lesson доступны:

1. **План урока** — полный ordered Component list;
2. **Экран ученика** — текущая Slide projection;
3. **Домашнее задание** — отдельная поверхность.

Homework сейчас является честной заглушкой. Materials находятся на Course
header, а не четвёртой Lesson tab.

## 11. Course materials

Product term: **Материалы курса**. Current physical model:

```text
stored_file
course_attachment
private Storage bucket: course-assets
```

- StoredFile принадлежит Account.
- CourseAttachment связывает same-owner Course и file.
- Object path начинается с Account UUID.
- Bucket private; access signed и ownership-checked.
- Max size 10 MiB; MIME/checksum/status валидируются.
- Student preview получает только files, referenced learner-visible
  Components.
- «Прикреплён» не означает «проанализирован».

Физической/canonical entity `course_asset` сейчас нет. TypeScript read-model
alias `CourseAsset` представляет linked StoredFile в Course attachments, а не
отдельный persisted object. Будущая reusable source library не должна
подменять current CourseAttachment незаметно.

## 12. Code-first Component platform

Current source P0 keys:

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

Registry содержит 20 active keys. Layout-only `divider` исключён; порядок
задаёт Lesson, а learner grouping — Student Screen Slides. Продуктовые
границы типов и сопоставление с ProgressMe см. в
[`docs/product/course-component-catalog.md`](../product/course-component-catalog.md).

Registry является источником key/version, category/title, Zod payload and
placement schemas, defaults и capabilities. MCP JSON Schema генерируется из
этих contracts.

Текущий React payload editor использует единый switch по `ComponentTypeKey`, а
teacher/student renderers — exhaustive typed map. Оба используют registry
contracts. Renderer не зависит от ID Course/Lesson и не использует archive
fixture.

Future keys добавляются отдельными definition/editor/renderer/test changes без
новой таблицы и без универсального абстрактного `game`.

## 13. Application architecture

```text
UI / route handler / internal MCP
→ canonical Zod contract
→ CourseBuilderApplicationService
→ user-JWT repository / Storage adapter
→ Supabase Data/Storage API
→ RLS + explicit ownership boundaries
```

Запрещено:

- SQL из React component;
- parallel hand-written schemas для UI/MCP/AI;
- service role в обычном browser/MCP flow;
- direct table access из MCP;
- lesson-specific renderer;
- fixture/localStorage persistence для domain data.

## 14. Current MCP

Development-only local `stdio` server регистрирует ровно шесть tools:

```text
course.create_draft
course.get
course.add_lesson
lesson.add_component
lesson.set_component_student_screen
lesson.reorder_component
```

Он использует user access token, session cutoff, application service и те же
contracts. External endpoint отсутствует. Production RouterAI вызывается
server-side AI service напрямую и не использует MCP transport.

## 15. CURRENT roleless Account and canonical learner identity

`Account` — единственная login identity, один на `auth.users`. Auth bootstrap
атомарно создаёт Account, AccountSecurity/Preference и ровно один linked
LearnerProfile; deterministic backfill обеспечивает тот же invariant для
existing `active | provisional` Accounts. Nullable unique
`learner_profile.account_id` разрешает offline profiles, но не второй linked
profile одному Account.

`teacher_learner` хранит отдельную teacher-local relation, display name и
archive state. `learning_record.recorded_by_account_id` сохраняет recorder
provenance. Subject и active observer читают только learner-safe projections;
teacher raw history остаётся recorder-scoped.

Active login/PIN/onboarding/profile/session используют Account boundary. Legacy
`parent`, `teacher`, `student`, `school`, membership, `user_preference` и
`user_security` физически сохранены только как dormant recovery data: active
web callers и Data API grants после M4 от них не зависят.

## 16. Current security

- Course documents owner-scoped through Account and RLS.
- Canonical LearnerProfile teacher-visible only through `teacher_learner`;
  teacher-local directory rows are scoped by `teacher_account_id`.
- Linked subject Account может выбирать свою canonical identity row и читать
  self history/progress только через learner-safe RPC; active observer получает
  ту же safe projection по отдельному grant. Ни link, ни observer grant не
  открывают Course, teacher directory или raw LearningRecord.
- Group/Course audience accepts only profiles with an active relation of the
  same owner Account; LearningRecord history is scoped by
  `recorded_by_account_id`.
- Account direct mutation обычному JWT закрыта.
- Component direct UPDATE ограничен payload/placement.
- Slide mutations и visibility/order/delete выполняются narrow RPC.
- RPC имеют explicit `auth.uid()` ownership check, empty search path, narrow
  execute grants и Lesson-first locks.
- `anon` не имеет privileges на V2 document/file tables.
- Storage policy проверяет bucket и Account path.
- Production middleware использует explicit routed-host allowlist, а unsafe V2
  requests принимает только с exact Origin `https://v2.shidao.ru`;
  landing/cross-subdomain/missing Origin fail closed и покрыты regression tests.
- V2 не индексируется.
- Browser-smoke использует current AES-GCM app-session; latest functional gate
  прошёл `326/326` unit tests и `19/19` production-mode scenarios, включая
  roleless navigation, identity/observer flows и Course catalog.
- M1 закрыла broad `user_preference`/`user_security` ACL и active callers
  перенесены на `account_preference`/`account_security`; M4 отозвала legacy Data
  API grants и оставила legacy rows только для recovery.

# Current hardening and NEXT architecture

## 17. CURRENT P0.1 Legacy identity/security hardening

P0.1 завершён: M1 закрыла legacy preference/security ACL, active callers
перенесены на Account boundary; M4 удалила active role helpers/types/grants;
M5/M6 закрыли deferred Auth invariant и trusted provisional metadata sync.
Production host allowlist, exact app-origin CSRF, Auth/negative actor tests,
DB/RLS/ACL/PostgREST postflight и GoTrue lifecycle probe зелёные.

Отдельной approved operations-задачей остаётся ротация historical plaintext
credentials из ignored legacy cheatsheet; это не расширяет Auth/SMTP/JWT scope.

## 18. CURRENT navigation/catalog; NEXT P0.2 authoring completion

CURRENT primary navigation: «Расписание / Ученики / Курсы». «Учебный профиль»
находится в Account menu перед «Настройки / Выход», observer projection —
третья вкладка «Наблюдение» внутри `/students`; `/observing` является protected
compatibility redirect. `/courses` уже имеет поиск, реальные фильтры, сортировку
и «Плитки / Таблица» без новой schema/API.

NEXT улучшает существующий Course Builder, не меняя hierarchy:

- upload Materials из existing Course;
- дальнейший visual/responsive/accessibility polish;
- более удобный Component palette/search;
- ясные destructive confirmations;
- optional drag-and-drop только поверх canonical reorder service.

## 19. CURRENT RouterAI adapter; NEXT operational hardening

CURRENT AI integration использует server-only OpenAI-compatible RouterAI adapter
с default `google/gemini-2.5-flash-lite`, validated preview → explicit Apply и
read-only ephemeral Assistant:

- provider/model adapter находится вне domain contracts;
- structured output повторно валидируется registry/application schemas;
- provider не получает SQL/service-role access;
- manual authoring всегда доступен;
- preview fingerprint, stale checks и supported compensation покрывают Apply;
- request/model/token usage возвращаются честно, но persistent quota/billing нет;
- attachment не считается прочитанным до отдельного parsing result.

NEXT operational hardening добавляет distributed rate limit/usage ledger только
когда они действительно нужны, наблюдает первый real Apply по metadata-only logs
и не превращает Assistant в write-capable agent без отдельного change-set
contract.

Internal AI может переиспользовать tool definitions/contracts. Production web
не обязан публиковать MCP transport.

## 20. P1 Persisted Homework

Homework принадлежит Lesson, но не `lesson.components` и не Student Screen
Slide group.

Первый slice может поддержать одно common Homework на Lesson. Individual
override и assignment snapshot добавляются в отдельном persisted Homework /
learner-consumption contract поверх уже существующей canonical identity.

Решение о reuse Component registry фиксируется отдельным contract: Homework
получает собственный ordered owner, authorization и learner projection.

## 21. P1 Sources and parsing

NEXT source pipeline начинается поверх StoredFile:

```text
uploaded → extracting → ready | failed
```

Первый scope: PDF text layer, DOCX, TXT, Markdown. Every extracted chunk хранит
provenance/version/checksum. Embeddings и retrieval добавляются после
измеримого extraction baseline.

OCR, broad web crawling, DRM и audio transcription — LATER.

# Audience, scheduling и дальнейшая target model

## 22. CURRENT roleless Account and canonical LearnerProfile

- `Account` — единственная login identity; global role не определяет navigation
  или access.
- Каждый `active | provisional` Account transaction-safe связан ровно с одним
  canonical LearnerProfile; offline profiles имеют `account_id IS NULL`.
- Auth bootstrap и deterministic backfill обеспечивают exactly-one invariant
  без fuzzy matching.
- `teacher_learner` хранит teacher-local name и reversible archive relation;
  Group/Course audience принимает только active relation того же owner.
- Discovery использует one-time share code/QR или blind email request.
  Recipient-bound `claim` физически сводит offline source с actor-owned target;
  `child_activation` создаёт отдельный provisional learner Account.
- Physical merge, conflict resolution, lineage alias, archive/restore,
  permanent delete пустого unclaimed profile и subject erasure реализованы.
- Subject управляет observer invitations/grants; subject и active observer
  получают только learner-safe finalized history/progress.
- Cross-provider AI требует отдельного consent `profile + Course + owner`;
  teacher raw history остаётся recorder-scoped.
- Legacy role tables не участвуют в active identity/navigation contract.

[`LEARNER_IDENTITY_COMPLETION_PROMPT.md`](./LEARNER_IDENTITY_COMPLETION_PROMPT.md)
теперь является историческим execution/acceptance contract с выполненным
terminal condition, а не описанием NEXT schema.

NEXT/LATER вне identity completion: learner Course consumption/enrollment, live
Student Screen runtime и richer Component-produced learner metrics.

## 23. CURRENT Group and mixed audience

- Course остаётся документом одного owner.
- Он хранит direct learners и Groups как два независимых source sets; effective
  audience — их distinct union.
- Один LearnerProfile может быть без Group или состоять в нескольких Groups.
- Group может участвовать в нескольких Courses одного owner.
- Изменение membership влияет на будущие назначения/AI context, но не
  переписывает draft LearningRecord уже открытого Run.
- Direct/group overlap учитывается один раз; effective audience ограничена 200
  profiles.
- Shared Course ownership/multiple teachers не входят в current target.

## 24. CURRENT LessonRun; LATER live runtime

Lesson одновременно является editable content и точкой планирования. LessonRun
хранит только отдельное проведение:

- одна Lesson может проводиться многократно;
- планирование можно повторить для всей audience или её подмножества;
- состояние выводится из `scheduled_at`, `started_at`, `ended_at` и
  `cancelled_at`; persisted status отсутствует;
- при планировании создаётся по одному draft LearningRecord на ожидаемого
  учащегося;
- при завершении преподаватель фиксирует отчёт, посещаемость, per-learner
  comment и `needs_repeat`;
- finalized LearningRecord переживает удаление Lesson, а LessonRun и drafts
  удаляются;
- история не хранит snapshot содержимого Lesson: только минимальный title/subject
  context, необходимый после удаления;
- AI authoring получает ограниченную выборку завершённых результатов.

Открытый/завершённый Run имеет хотя бы одну LearningRecord; отменённый Run
может иметь ноль, потому что cancellation удаляет draft rows.

Live runtime остаётся LATER:

- runtime cursor ориентирован на Student Screen Slide;
- teacher управляет learner screen по умолчанию;
- review может разрешить learner navigation;
- runtime cursor не создаёт authored Step entity.

## 25. Homework assignments

Target Homework поддерживает:

- common definition;
- full learner override;
- effective resolution `override → common → none`;
- immutable assignment snapshot при выдаче;
- изменение definition не переписывает issued work.

## 26. CURRENT base history/progress; LATER richer learner metrics

Learning history относится к canonical LearnerProfile и переживает удаление
Lesson. `learning_record` хранит recorder Account, attendance, comment,
`needs_repeat`, minimal Course/Lesson context, `shared_with_learner_at`,
`actual_duration_minutes_at_time` и merge provenance
`superseded_by_record_id`.

Teacher raw reads остаются scoped по `recorded_by_account_id`. Subject и active
observer читают отдельную learner-safe projection только finalized,
non-superseded rows; private comments, recorder identity, roster и teacher-local
directory исключены. Comment появляется в учебном профиле только после explicit
share.

Current progress вычисляет реальные counts, attendance, repeat, last activity,
subject breakdown и сумму только известных actual durations. Duration берётся
из explicit start либо явного post-factum teacher input; scheduled fallback и
unknown не превращаются в ноль. Subject erasure/reset уже реализован; отдельными
решениями остаются Account/Auth deletion и legal retention.

LATER `LearningRecord.metrics` либо отдельные learning events появляются только
с первым реальным allowlisted Component/runtime producer и consumer. Пустой
generic metrics JSON не добавляется.

Позднее поверх базовой записи могут появиться:

```text
learning_event
learner_word_state
learner_inference
```

Полный snapshot Lesson/Components не добавляется. Постоянные AI inferences,
влияющие на персонализацию, должны иметь evidence/confidence и human
confirmation.

## 27. Chat and notifications

Target course thread включает owner и текущую audience; Observer не входит в
course chat автоматически. Membership history нужна для корректного доступа к
старым/новым сообщениям.

Notifications адресуются Account или LearnerProfile и строятся как отдельный
domain, а не возвращение V1 communication tables.

## 28. AI-native platform

Target AI capabilities:

- course/lesson planning;
- component creation/editing;
- teacher copilot;
- screen-based AI lesson;
- source retrieval;
- change set preview/apply/undo;
- account quota/usage ledger.

AI меняет продукт только typed tools. Destructive/mass operations требуют
preview/confirmation. Provider secrets, full private files и credentials не
попадают в browser/MCP inputs/logs.

External MCP допускается только после OAuth/scoped tokens, per-tool permissions,
rate limits, audit, revocation и abuse controls.

## 29. Background jobs and observability

Worker появляется с первой реальной background operation. Queue должна
поддерживать idempotency, retries/backoff, timeout, cancellation, progress и
dead-letter visibility.

Structured logs не содержат secrets/full prompts/private attachment bodies.
Минимальные future metrics: web errors/latency, job depth/age, provider
success/latency/usage, Storage/parsing failures, auth failures.

## 30. CURRENT lifecycle

- Delete Course/Lesson удаляет editable document children, но не finalized
  LearningRecord.
- Delete material не оставляет broken Component references.
- Archive/restore изменяет только TeacherLearner текущего Account; restore не
  возвращает прежние Group/Course links.
- Permanent delete разрешён только для пустого unclaimed profile.
- Physical merge удаляет source profile после переноса данных и сохраняет
  actor-safe lineage alias; generic split не обещается.
- Safe unlink разрешён только без lineage, records и dependent grants.
- Subject erasure/reset требует recent reauth + fingerprint, удаляет всю
  subject lineage/grants/consents и атомарно создаёт новый empty linked profile;
  Account/Auth deletion и legal retention остаются отдельными решениями.
- Current AI mutations требуют preview и explicit confirmation; persisted
  `ai_change_set` остаётся LATER.

## 31. CURRENT identity objects; LATER physical objects

Помимо Course/Lesson/audience/history tables, current M1–M6 contract содержит:

```text
account_login_alias
account_security
account_preference
learner_profile_share_code
learner_connection_request
learner_claim_invitation
learner_profile_merge
learner_profile_merge_conflict
learner_profile_merge_private_detail
learner_profile_alias
learner_observer_invitation
learner_observer_grant
learner_ai_consent
learner_identity_audit_event
learner_identity_rate_limit
learner_erasure_request
learner_credential_recovery_delegate
learner_identity_reconciliation
```

Следующие имена остаются direction:

```text
lesson_run_runtime
homework_definition
homework_component
learner_homework_assignment
learning_event
learner_word_state
learner_inference
chat_thread
chat_message
notification
source_document
source_chunk
background_job
ai_change_set
ai_usage_ledger
ai_quota_period
audit_event
```

Конкретная table shape утверждается только в milestone contract/migration и
после применения переносится в current-schema/project-state.

# Cross-cutting requirements

## 32. API and validation

- Next.js App Router/route handlers;
- Zod at every untrusted boundary;
- stable error codes;
- same-origin browser API;
- idempotency for retryable mutations;
- no table-shaped public API by accident;
- JSON Schema derived from canonical contracts.

## 33. Security

- least privilege grants + RLS;
- ownership/membership negative tests;
- no `TO authenticated` without authorization predicate;
- narrow `SECURITY DEFINER` only when justified;
- no user-editable metadata for authorization;
- no service-role secret in public client;
- private files and short-lived signed access;
- audit for destructive/AI/identity/security operations.

## 34. Accessibility and locale

- Russian UI first;
- architecture remains i18n-ready;
- semantic HTML, keyboard navigation and focus management;
- accessible dialogs/labels/status messages;
- adequate contrast;
- dates/timezones explicit when scheduling appears.

## 35. Quality gate

Every shipped vertical slice requires proportional checks:

```text
npm ci
typecheck
lint
unit/integration tests
build
browser smoke for affected user flow
RLS/ACL/schema postflight for DB changes
production smoke
documentation update
```

No feature is «готова» only because its UI renders; persisted data,
authorization, reload and error state must be demonstrated.

## 36. Current table map

Current authoritative objects:

```text
account
account_login_alias / account_security / account_preference
course
lesson
lesson_component
lesson_student_slide
stored_file
course_attachment
learner_profile / teacher_learner
learner_group / learner_group_member
course_learner / course_learner_group
lesson_run / learning_record
learner_profile_share_code / learner_connection_request
learner_claim_invitation
learner_profile_merge / learner_profile_merge_conflict
learner_profile_merge_private_detail / learner_profile_alias
learner_observer_invitation / learner_observer_grant
learner_ai_consent / learner_identity_audit_event
learner_identity_rate_limit / learner_erasure_request
learner_credential_recovery_delegate / learner_identity_reconciliation

parent / teacher / student
school / school_teacher
class / class_teacher / class_student
user_preference / user_security
```

Course/lesson/file, audience/history, Account credential и identity/
observer/AI-consent groups выше являются active V2 contract. Legacy
`parent`/`teacher`/`student`, school/class membership, `user_preference` и
`user_security` физически сохранены как dormant recovery data без active web
callers и ordinary Data API grants; это не active compatibility model. Полная
DDL/ACL/RLS shape находится только в current schema snapshots.

## 37. Decisions that require explicit owner approval to change

1. Repository/branch/Supabase остаются текущими.
2. Auth users, SMTP/JWT/API configuration и base Storage сохраняются.
3. Old migrations и V1 recovery не переписываются.
4. `shidao.ru` остаётся landing-only, V2 — на `v2.shidao.ru`.
5. Course имеет одного owner.
6. Lesson непосредственно владеет одним ordered Component list.
7. Step/root Step/Methodology не возвращаются в active domain.
8. Student Screen Slide остаётся бесконтентной projection без второго order.
9. Lesson title является Lesson field; teacher summary learner не получает.
10. New Components private by default.
11. Course materials private/course-scoped, пока отдельная reuse model не
    утверждена.
12. Homework и live runtime остаются отдельными domains.
13. AI не получает SQL/service-role и использует typed application commands.
14. External MCP не публикуется без полноценного security layer.
15. V1 restore выполняется только по отдельной явной команде владельца.
16. `Account` остаётся единственной login identity; global role switch не
    возвращается.
17. Каждый `active | provisional` Account имеет ровно один linked
    LearnerProfile; teacher и observer access остаются отдельными explicit
    relations.

## 38. Update rule

После каждого vertical slice:

1. обновить `docs/project-state.md`;
2. убрать выполненное из ближайшего roadmap и выбрать следующий slice;
3. обновить этот spec, если изменилось нормативное решение;
4. при schema change синхронизировать оба current-schema snapshots;
5. не оставлять fallback-фразу «верить другому документу» — устранить само
   противоречие.
