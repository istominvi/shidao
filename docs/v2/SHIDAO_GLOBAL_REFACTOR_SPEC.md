# ShiDao V2 — актуальная глобальная спецификация

**Статус:** нормативные границы текущей архитектуры и будущего развития
**Актуально на:** 7 августа 2026 года
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

Текущий продукт доказывает первый фундамент: teacher Course Builder с реальными
данными, private materials, code-first Components, Student Screen preview,
canonical learner directory, scheduling/history, RouterAI preview/assistant и
internal MCP.

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

### LATER

Отдельный staging может появиться перед публичным production launch. Он должен
иметь отдельные logical data, Auth, Storage, secrets и синтетические данные.

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
    ├── claimed LearnerProfile 0..1 (optional; claim later)
    ├── TeacherLearner 0..N → LearnerProfile
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

Current P0 keys:

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

## 15. Current Auth and identity transition

Course owner identity — `account`, один на `auth.users`.

Canonical `learner_profile` не принадлежит Course owner. Optional unique
`account_id` является будущей one-to-one claim point, а `teacher_learner`
содержит relation, local display name и archive state конкретного teacher
Account. `learning_record.recorded_by_account_id` сохраняет provenance даже
после удаления Lesson. Current learner-profile API names остаются стабильными и
возвращают teacher-directory projection.

Старые `parent`, `teacher`, `student`, `school`, membership и preference/security
tables временно обслуживают login/onboarding/profile/session compatibility.
Они не являются целевой Account model и не должны проникать в новый Course
domain.

## 16. Current security

- Course documents owner-scoped through Account and RLS.
- Canonical LearnerProfile teacher-visible only through `teacher_learner`;
  teacher-local directory rows are scoped by `teacher_account_id`.
- Linked subject Account can select only its canonical LearnerProfile row;
  nullable `account_id` does not expose Course, TeacherLearner or
  LearningRecord.
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
- Origin/Sec-Fetch-Site guard пока допускает configured landing host как Origin
  для unsafe V2 requests; строгая app-host boundary и cross-subdomain regression
  test остаются P0 hardening debt.
- V2 не индексируется.
- Browser-smoke использует current AES-GCM app-session и проходит строгий
  production-mode gate на isolated mock Supabase, включая Course → Lesson →
  backlink.
- Legacy exception: `user_preference` и `user_security` пока не имеют RLS и
  сохраняют broad grants; это зафиксированный P0 debt, а не образец V2 ACL.

# Current hardening and NEXT architecture

## 17. P0.1 Legacy identity/security hardening

До расширения identity/learner/external access необходимо:

- инвентаризировать login/onboarding/profile/PIN/session callers и legacy
  `SECURITY DEFINER` user-id RPC с broad execute;
- проверить реальный Data API exposure и добавить negative tests;
- закрыть broad grants/RPC defaults;
- ввести owner-scoped RLS или полностью закрытые server boundaries;
- заменить proxy-dependent host routing на explicit production host allowlist;
- доставить compatible forward migration с Auth regression/postflight.

Это tightening существующей authorization boundary, а не redesign
Auth/SMTP/JWT.

## 18. P0.2 Teacher authoring completion

NEXT улучшает существующий Course Builder, не меняя hierarchy:

- upload Materials из existing Course;
- visual/responsive/accessibility polish;
- production coverage всех десяти component editors/renderers;
- более удобный palette/search;
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
override и assignment snapshot добавляются после новой audience identity.

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

## 22. CURRENT LearnerProfile

Текущий repository slice:

- LearnerProfile является canonical identity без teacher owner и может
  существовать без отдельного login;
- nullable unique `learner_profile.account_id` резервирует one-to-one claim
  point, но текущие rows не линкуются автоматически; linked Account может
  выбрать только собственную identity row, не Course/records;
- global `learner_profile.display_name` остаётся canonical/offline fallback;
- `teacher_learner` хранит teacher Account, local display name и archive state;
- existing profile CRUD route/RPC names сохранены, но teacher read model
  проецируется из `teacher_learner`, а edit/archive не меняет identity другого
  будущего teacher;
- базовая образовательная история хранится отдельно от editable Lesson и явно
  фиксирует `recorded_by_account_id`;
- один Account не может добавить profile в Group/Course без своей активной
  TeacherLearner relation.

NEXT/LATER:

- universal Account bootstrap создаёт ровно один linked LearnerProfile каждому
  active Account, а active navigation/access перестаёт зависеть от глобальной
  роли;
- invitation/claim связывает offline profile с Account без эвристики по
  имени/email;
- subject-controlled observer relation открывает только learner-safe read-only
  projection;
- physical merge получает отдельную authorization/conflict/lineage модель и не
  выполняется автоматически;
- self history открывается самому Account по canonical ownership; observer
  history и cross-provider AI context требуют разных узких явных grants. Learner
  Course consumption и live Student Screen остаются отдельным later slice.

Полный P0.Identity execution/acceptance contract находится в
[`LEARNER_IDENTITY_COMPLETION_PROMPT.md`](./LEARNER_IDENTITY_COMPLETION_PROMPT.md)
и описывает **NEXT**, а не current schema.

Текущие parent/teacher/student tables не объявляются этой моделью и не
расширяются как её shortcut.

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

## 26. CURRENT base history; NEXT progress; LATER learner metrics

Базовая Learning history относится к canonical LearnerProfile и переживает
удаление Lesson. Сейчас `learning_record` хранит recorder Account, attendance,
comment, `needs_repeat`, время проведения и минимальный Course/Lesson context.
Current teacher reads только rows собственного `recorded_by_account_id`;
canonical profile не означает cross-provider access. Archive teacher relation
не удаляет history. Global privacy/erasure lifecycle остаётся отдельным решением.

NEXT identity-program строит learner-safe self/observer progress из уже
сохранённых attendance/repeat/comments. Nullable actual duration фиксируется
только из explicit start либо явного teacher input; scheduled fallback и старые
rows остаются unknown. Пустой generic metrics JSON не добавляется. Отдельный
`LearningRecord.metrics` появится только одновременно с первым реальным
allowlisted Component/runtime producer и consumer.

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

## 30. Lifecycle

- Delete Course удаляет editable document children, но не finalized learning
  records.
- Delete Lesson не удаляет LearningRecord.
- Delete material не оставляет broken Component references.
- Product archive изменяет TeacherLearner конкретного teacher, а не canonical
  LearnerProfile; global privacy/erasure требует отдельного audited flow.
- Destructive AI actions требуют confirmation/change set.

## 31. Future physical objects

`learner_profile`, `teacher_learner`, `learner_group`,
`learner_group_member`, `course_learner`, `course_learner_group`, `lesson_run` и
`learning_record` уже входят в current repository schema. Следующие имена
остаются direction:

```text
teacher_learner_invitation
learner_profile_claim_invitation
learner_profile_merge_operation
learner_profile_alias
learner_observer_grant
learner_ai_consent
identity_access_event
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

parent / teacher / student
school / school_teacher
class / class_teacher / class_student
user_preference / user_security
```

Первая группа — active V2 Course Builder. Вторая — transitional identity
compatibility. Полная DDL/ACL/RLS shape находится только в current schema
snapshots.

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

## 38. Update rule

После каждого vertical slice:

1. обновить `docs/project-state.md`;
2. убрать выполненное из ближайшего roadmap и выбрать следующий slice;
3. обновить этот spec, если изменилось нормативное решение;
4. при schema change синхронизировать оба current-schema snapshots;
5. не оставлять fallback-фразу «верить другому документу» — устранить само
   противоречие.
