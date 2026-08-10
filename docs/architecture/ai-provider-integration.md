# AI provider integration

**Статус:** canonical contract для deployed Course AI и current unreleased
global System Assistant

**Актуально на:** 10 августа 2026 года

**Deployment state:** AI application slice развёрнут на `v2.shidao.ru` в release
`0276aed`; server runtime получает `ROUTERAI_API_KEY` из production secret
environment и использует `google/gemini-2.5-flash-lite`. Provider и
authenticated no-write postflight завершены. History-aware context реализован
и развёрнут в release `9393080` вместе с mixed Course audience; production
schema и read-only UI postflight завершены. Provider smoke с непустой учебной
историей ещё не выполнялся. Consent-gated cross-provider projection развёрнута
в roleless functional release `01aa88a` после M1–M6 и identity/browser
postflight.

Global System Assistant, protected floating UI и routes
`/api/v2/assistant*` реализованы в current source, но ещё не объявлены
развёрнутыми и не имеют production postflight. Все deployment утверждения ниже
относятся только к перечисленным released Course/Lesson AI baselines.

**Schema state:** AI authoring не добавляет provider/quota persistence; он читает
bounded projection из `teacher_learner`, `lesson_run` и `learning_record`.
Identity slice отдельно хранит course-scoped authorization в
`learner_ai_consent`; это не открывает provider raw history или teacher API.
Unreleased System Assistant также не меняет PostgreSQL schema и не добавляет
таблицу dialog/action/idempotency.

## Граница текущего среза

Текущий production slice подключает RouterAI к существующему Course Builder и
даёт преподавателю три отдельные возможности:

1. получить программу нового Course и явно применить её после preview;
2. получить план новой или существующей Lesson и явно применить его после
   preview;
3. обсудить Course или выбранную Lesson с read-only ассистентом.

Это authoring assistance, а не AI-преподаватель и не автономный агент. Ассистент
не проводит занятия, не управляет Student Screen, не вызывает tools и не меняет
Course из чата.

Current unreleased follow-up заменяет course-owned dialog в UI одним global
System Assistant внутри protected Account layout. Он отвечает по bounded
authorized данным текущего Account и открытой страницы и имеет ровно две
подтверждаемые команды: создать обычный Course draft или добавить пустую Lesson
без Components/Slides. Provider только формирует proposal; mutation начинается
после отдельного явного Apply пользователя. Это не generalized tool calling и
не автономная запись из текста чата.

## Архитектурный поток

```text
authenticated browser
→ Node.js /api/v2/courses/[courseId]/ai-* route
→ per-request actor from getCourseBuilderContext()
→ AiCourseBuilderService
→ recorder-scoped LessonRunsApplicationService (completed history only)
  + consent-gated sharedHistoryProvider learner-safe projection
→ server-only RouterAI adapter
→ provider-compatible structured output
→ transport conversion + canonical Zod/registry validation
→ preview returned to browser
→ explicit teacher Apply
→ existing CourseBuilderApplicationService commands
→ existing repository + user JWT / ownership / RLS
```

Production web не запускает локальный `stdio` MCP и не передаёт ему статический
actor. MCP остаётся development adapter над тем же application service; AI-срез
переиспользует domain/service contracts напрямую.

Unreleased global flow:

```text
protected (app) layout + floating widget
→ strict allowlisted page context + bounded React-state dialog
→ POST /api/v2/assistant
→ universal active/provisional Account gate
→ per-request actor + user-JWT Course/LessonRuns services
→ bounded owner/recorder/consent-scoped context
→ RouterAI strict JSON turn
→ text reply OR one create proposal (no write)
→ explicit Apply in action card
→ POST /api/v2/assistant/actions/apply
→ strict action validation + process-local replay/mutex guard
→ CourseBuilderApplicationService.createDraft | addLesson
→ user JWT / ownership / RLS
```

Новый flow не вызывает старый HTTP route изнутри приложения, не запускает MCP и
не конструирует publication service-role adapters.

## Provider contract

`src/modules/ai/routerai.ts` реализует server-only OpenAI-compatible вызов
`POST /chat/completions`:

- default base URL — `https://routerai.ru/api/v1`;
- default model — `google/gemini-2.5-flash-lite`;
- обязательный secret — `ROUTERAI_API_KEY`;
- `ROUTERAI_MODEL`, `ROUTERAI_BASE_URL` и `ROUTERAI_TIMEOUT_MS` позволяют
  изменить модель, endpoint и timeout без изменения domain model;
- production base URL обязан использовать HTTPS;
- запросы ограничены по числу сообщений, общему размеру и output tokens;
- timeout и disconnect/caller abort прекращают provider request;
- structured planning использует JSON Schema, затем результат повторно
  валидируется Zod contracts;
- усечённый `finish_reason=length`, пустой content и невалидный provider output
  не применяются как частичный план.

API key существует только в server environment. Browser, provider context,
ответ API и application logs не должны содержать secret, JWT или service-role
credentials. На текущем production-контуре secret уже настроен как runtime-only
переменная и не фиксируется в repository. Значение, однажды опубликованное в
чате, логе или issue, необходимо немедленно ротировать.

### Provider transport schema и canonical validation

JSON Schema, отправляемая конкретному provider, является transport adapter, а
не новым источником истины для Component domain. Lesson transport использует
плоский список `blocks`, где у каждого блока обязательны одинаковые поля
`kind`, `title`, `body`, `choices` и `matches`; неиспользуемые поля остаются
пустыми. Provider-facing schema не содержит сложной discriminated union и
удаляет несовместимые transport keywords длины/размера, но runtime Zod limits
остаются обязательными.

После ответа AI-layer преобразует transport blocks в канонический
`AiLessonComponentPlan`, проверяет discriminated Zod contracts по `typeKey`, а
перед первой записью строит обычный `lessonAddComponentInputSchema` с registry
payload schema и default placement. UUID для poll options и matching pairs
создаёт server conversion layer, а не provider.

Таким образом, provider-flat schema не ослабляет application boundary:
неизвестный type, несовместимый payload или лишние поля отклоняются до Apply.
UI, application service и development MCP продолжают использовать canonical
registry contracts; provider transport не копируется в MCP и не становится
вторым Component registry.

## Course generation: preview → apply

`POST /api/v2/courses/[courseId]/ai-plan` сначала проверяет authenticated actor
и доступ к Course, а затем просит модель вернуть ровно `targetLessonCount`
элементов `title + summary`. Provider call не записывает Course.

В текущем New Course flow базовые поля Course и attachments сохраняются до
вызова модели. AI planning разрешён только пока у Course нет Lessons. UI
показывает программу, модель и фактический usage; только отдельное подтверждение
вызывает `POST .../ai-apply`.

Apply повторно валидирует план и текущее состояние Course, создаёт обычные
Lesson через `CourseBuilderApplicationService.addLesson` и допускает безопасный
retry уже совпадающего префикса. При конфликте после preview операция
останавливается как stale plan; при ошибке поддерживаемый path компенсирует
созданные в этом apply Lessons.

Preview несёт SHA-256 fingerprint переданного модели Course context. Apply
сравнивает его с текущими полями Course/attachment metadata, поэтому ручное
изменение контекста после preview требует новой генерации.

Course generation в этом срезе создаёт программу из Lesson titles/comments. Он
не генерирует все Components каждого урока одним скрытым действием.

## Lesson generation: preview → apply

`POST .../ai-lesson-plan` строит preview для новой Lesson или дополнения
существующей. Допустимы 3–20 Components из ограниченного registry-подмножества:

```text
heading
rich_text
callout
divider
single_choice_poll
matching_game
```

`quote`, `image`, `slideshow` и `file` намеренно не выдаются модели в этом
срезе. План использует каноническую иерархию `Course → Lesson → ordered
Components`; Step, root Step и Methodology не создаются.

До первой записи `POST .../ai-lesson-apply`:

- сравнивает исходный ordered list Lesson IDs;
- для существующей Lesson сравнивает исходный list Component IDs;
- сравнивает fingerprint bounded Course/Lesson/component context, поэтому
  правка title/comment/payload или появление нового финального LearningRecord
  при прежних IDs также делает preview stale;
- валидирует каждый payload теми же registry contracts и default placement,
  которые использует ручной редактор.

Apply создаёт обычную Lesson либо обновляет её teacher comment и добавляет
Components в конец существующего плана. Существующие Components не заменяются.
Все новые Components остаются `staff_only`; назначение на Student Screen Slide
— отдельное явное действие преподавателя. Ошибка поддерживаемого apply path
запускает компенсационное удаление созданных сущностей и восстановление
предыдущего comment, когда это возможно.

## Assistant boundary

Развёрнутый `POST /api/v2/courses/[courseId]/assistant` выполняет только provider
completion после owner-scoped `getCourse` и чтения завершённой learning history.
У AI-service этого compatibility flow нет вызова mutation command, tool
execution или MCP transport. System contract прямо запрещает утверждать, что
ассистент уже изменил Course.

Прежний Course/Lesson dialog удалён из current unreleased UI. Сам route пока
может оставаться для compatibility, но global widget его не вызывает. История
этого старого dialog по контракту была ephemeral:

- сообщения не записываются в PostgreSQL, Storage или browser persistence;
- закрытие dialog или reload начинает новый диалог;
- server принимает не более 16 сообщений и 24 000 символов истории;
- ответ содержит usage только последнего provider request.

Следовательно, это **read-only ephemeral assistant**, а не persisted Course chat,
change history или автономный editor.

## Global System Assistant — current unreleased boundary

`SystemAssistantProvider` и единственный floating `SystemAssistant` монтируются
в `src/app/(app)/layout.tsx` после Account guard. Public landing, Auth и
standalone demo его не получают. Panel остаётся non-modal, поддерживает Escape,
focus return, mobile safe area и reduced motion. Диалог хранится только в React
state protected layout: закрытие panel его не удаляет, явный «Новый диалог» или
reload сбрасывает; PostgreSQL, localStorage и durable browser persistence не
используются.

### Allowlisted page context

Browser request обязан пройти strict schema и содержит только:

```text
surface
view | null
courseId | null
lessonId | null
localDate
utcOffsetMinutes
```

`surface` выбирается из закрытого списка Schedule, Students, Courses, new
Course, Course, Lesson, Student preview, learning/profile/security/observer
settings, onboarding или other. `view` — также закрытый enum текущей вкладки
Courses/Course/Lesson/Students и обязан соответствовать surface. Lesson требует
Course; Course/Lesson IDs запрещены на несвязанных surfaces. Arbitrary `href`,
pathname/search/hash, DOM, innerText, unsaved form values и page label не
являются provider context.

Client registration улучшает подсказку открытой поверхности, но не является
authorization. Server повторно вызывает owner-scoped `getCourse`; выбранная
Lesson ищется только внутри уже разрешённого Course. Foreign Course/Lesson
останавливается до provider call.

### Bounded authorized reads

Каждый turn получает compact account Course catalog максимум из 60 Course без
технических IDs в provider projection. Дополнительные данные загружаются только
по surface:

- Course/Lesson/Student preview: current owner Course, selected Lesson, до 8
  completed Runs и 40 recorder-scoped finalized records, effective audience и
  consent-gated sanitized shared history;
- Students Learners/Groups views: до 100 active teacher-local learner names, 40
  groups и 25 names на группу; Observing view не открывает модели observer/self
  history;
- Schedule: только локальный день, до 60 Runs и до 25 learner names на Run;
- остальные surfaces: Course catalog и безопасная page label без чтения DOM,
  account security fields или несохранённых форм.

Все проекции проходят общий hard budget 96 000 символов. Auth/account/recorder
IDs, JWT, PIN/email/security state, signed URLs, checksums, Storage paths и file
contents модели не передаются. Строки из Course, Lesson, comments, learner/group
names и filenames объявлены user data, а не инструкциями.

Оба global routes используют `getActiveCourseBuilderContext`: сначала
`resolveAccessPolicy` принимает только universal Account context
`active/provisional`, затем actor сверяется с app session и создаётся обычный
user-JWT/RLS Course service. Suspended/deleted, revoked или mismatched session
не доходят до provider/action.

### Proposal → explicit apply

Provider возвращает strict flat turn и может выбрать максимум один kind:

```text
answer
create_course  → course.create_draft
add_lesson     → course.add_lesson
```

Chat route ничего не записывает. Server преобразует provider fields в strict
canonical `courseDraftInputSchema` или `addLessonInputSchema`, разрешает
`add_lesson` только по opaque reference из текущего owner-scoped Course catalog
и перед возвратом применяет deterministic shared-comment redaction ко всему
proposal. Action card получает новый UUID idempotency key.

Mutation выполняется только после отдельного клика пользователя и строгого
`POST /api/v2/assistant/actions/apply`. Apply повторно проходит Account/session
gate и вызывает ровно `CourseBuilderApplicationService.createDraft` либо
`addLesson`; actor/account ID не являются action arguments. Lesson создаётся с
title и optional teacher comment, но без Components и Student Screen Slides.
Update/delete, Auth/security, Students/Groups, audience, Schedule/Run,
publication, attachments и arbitrary API calls в allowlist отсутствуют.

Action result строится из фактического service commit и даёт ссылку на созданный
Course/Lesson; текст provider не считается доказательством mutation.
Proposal и action сейчас не подписываются и не сохраняются server-side: Apply
строго валидирует body и заново проверяет actor/ownership, но UUID служит ключом
process-local replay cache, а не криптографической привязкой аргументов к
предыдущему provider turn. Такая привязка требует later durable action ledger.

## Контекст и attachments

Модель получает ограниченный teacher context: основные поля Course, course
outline, а для выбранной Lesson — comment и до 20 ordered Components. Из
component payload удаляются технические IDs, signed URLs, checksum и Storage
bucket/path; длинные строки и массивы сокращаются. Весь сериализованный context
имеет единый hard budget 96 000 символов, оставляя место system instructions и
bounded conversation в общем provider limit.

Для Lesson planning, compatibility course-scoped Assistant и global Course
surfaces дополнительно передаются:

- до 8 последних завершённых LessonRun с датой, названием, общим teacher
  report и агрегатами attendance/repeat;
- до 40 последних finalized LearningRecord, где
  `recorded_by_account_id` — текущий teacher Account, с его локальным
  TeacherLearner display name, минимальным Course/Lesson/subject context,
  attendance, repeat и индивидуальным teacher comment;
- surviving LearningRecord после удаления Lesson/Run, пока он связан с текущим
  Course.

ID LearnerProfile/Run/Record и Auth identity в provider context не попадают.
Draft expected-participant rows, будущие/активные/отменённые Runs исключены.
Canonical LearnerProfile не объединяет provider context разных преподавателей:
другой recorder остаётся невидимым без current course-scoped subject consent и
sanitized safe projection.
System и context boundary отдельно указывают, что `wasPresent=false` означает
только отсутствие и не доказывает непонимание; `needsRepeat` интерпретируется
только для присутствовавшего ученика.

При действующем consent `profile + Course + current owner` shared projection
добавляет только агрегаты, month-level last activity, subject buckets и
closed-vocabulary categorical signals, derived from explicitly shared comments.
Raw LearningRecord, recorder, teacher-local names, roster, exact timestamps,
comment text/summary/quotes и private comments исключены.
Отсутствие consent даёт empty optional context; consent revision фиксируется в
preview, а revoke/expiry/owner/audience change делает Apply stale.

Для course-wide attachments передаются только filename, MIME type и текущий
status с явным предупреждением, что содержимое не извлекалось. AI-срез не
скачивает файл по signed URL и не выполняет parsing, OCR, embeddings или RAG.
Успешно прикреплённый файл нельзя описывать как прочитанный, изученный или
использованный моделью.

## Usage, rate limits и аудит

Provider metadata (`requestId`, фактическая model/provider и token usage)
возвращается для preview/chat UI и записывается как ограниченное server log
event без prompt, component payload или secret.

Planning/chat routes имеют authenticated-actor process-local rate limit и
ограничение одновременных provider requests. Apply дополнительно имеет
process-local mutex на actor + Course, чтобы двойной submit в одном container
не интерливил записи. Это защита одного application process, а не
распределённая квота или DB transaction; несколько replicas всё ещё требуют
отдельного distributed limiter/idempotency boundary.

Global assistant использует тот же process-local chat rate/concurrency guard
(сейчас 30 turns на 10 минут на actor, не более двух concurrent requests).
Новые uncached Apply ограничены 20 действиями на 10 минут на actor и
сериализуются в одном process по actor + target; create Course использует
отдельный actor lock. UUID idempotency key кеширует успешный result на 10 минут,
максимум 500 results на process, и объединяет concurrent retry только внутри
этого процесса. Cached retry возвращается до повторного списания action rate.
Restart, eviction или другая replica кеш не видят, поэтому механизм не является
durable action ledger или гарантией exactly-once. `addLesson` дополнительно
сохраняет известный read-next-position ordering debt до отдельной DB/service
serialization.

В текущем срезе **нет persistent quota/ledger, billing units, balance или
subscription enforcement**. Нулевой или отсутствующий usage в provider response
нормализуется для UI, но не превращается в подтверждённое списание. Платные
лимиты нельзя включать до отдельной persisted accounting model.

## Schema и persistence

AI authoring переиспользует существующие:

```text
course
lesson
lesson_component
lesson_student_slide
stored_file
course_attachment
learner_profile
teacher_learner
lesson_run
learning_record
learner_ai_consent
```

`lesson_run` и `learning_record` принадлежат scheduling/learning-history domain,
а `learner_ai_consent` — identity authorization, не provider accounting. Base
history ограничена `recorded_by_account_id`; foreign history входит только
через `build_cross_provider_learner_context` как consent-gated sanitized
projection. SQL и service-role credentials модели не доступны. Persisted
результат AI после Apply не отличается по domain contract от результата ручного
редактора. Provider request/response, assistant dialog history и quota state в
БД не сохраняются.

Global System Assistant также не добавляет физические сущности: proposal,
action UUID, in-flight lock и idempotency result существуют только в response,
React state или process memory. Созданные после Apply Course/Lesson являются
обычными существующими domain rows; отдельного AI-owned Course/Lesson типа нет.

Identity, provenance и current access boundary зафиксированы в
[`learner-identity-access-model.md`](./learner-identity-access-model.md).
Current cross-provider flow допускает context только по отдельному
course-scoped subject consent и через sanitized server projection; teacher API
не получает foreign raw records. Historical execution contract находится в
[`LEARNER_IDENTITY_COMPLETION_PROMPT.md`](../v2/LEARNER_IDENTITY_COMPLETION_PROMPT.md).

## Не входит в текущий срез

- UI выбора модели пользователем;
- persistent assistant history, Course chat и notifications;
- generalized/native tool calling, mutations кроме подтверждаемого Course draft
  и пустой Lesson, durable action history и AI change sets/undo;
- distributed rate limit, durable idempotency/action ledger и exactly-once
  mutations между replicas;
- attachment parsing/OCR/RAG и citation provenance;
- Homework generation;
- learner-facing AI teacher, live lesson и Student Screen control;
- automatic subject metrics beyond current attendance/repeat/comments;
- persistent distributed quota, cost ledger, billing и subscriptions;
- внешний remote MCP/API.

## Карта реализации

| Область                            | Каноническое место                                                                                 |
| ---------------------------------- | -------------------------------------------------------------------------------------------------- |
| Provider adapter                   | `src/modules/ai/routerai.ts`                                                                       |
| Provider lesson transport          | `src/modules/ai/lesson-provider-contracts.ts`                                                      |
| AI request/response contracts      | `src/modules/ai/course-builder-contracts.ts`                                                       |
| Bounded model context              | `src/modules/ai/course-context.ts`                                                                 |
| Consented safe history             | `src/modules/ai/shared-history.ts`                                                                 |
| Learning history service           | `src/modules/lesson-runs/service.ts`                                                               |
| Planning/apply/chat service        | `src/modules/ai/course-builder-service.ts`                                                         |
| System Assistant contracts/service | `src/modules/ai/system-assistant-contracts.ts`, `src/modules/ai/system-assistant-service.ts`       |
| Rate/error boundary                | `src/modules/ai/server-context.ts`                                                                 |
| API routes                         | `src/app/api/v2/courses/[courseId]/ai-*/`, compatibility `assistant/`, `src/app/api/v2/assistant/` |
| Browser client                     | `src/components/course-builder/course-builder-client.ts`                                           |
| Course preview UI                  | `src/components/course-builder/ai-course-plan-dialog.tsx`                                          |
| Lesson preview UI                  | `src/components/course-builder/ai-lesson-plan-dialog.tsx`                                          |
| System Assistant UI/context        | `src/components/assistant/`, `src/app/(app)/layout.tsx`, `src/app/styles/system-assistant.css`     |

## Release acceptance

Current global System Assistant code не входит в перечисленные ниже releases.
Для него добавлены strict contract/service/UI-boundary tests, но deployment,
production provider smoke и authenticated browser postflight пока не
заявляются.

Release `0276aed` подтвердил production routes/UI, server-only RouterAI
boundary и наличие runtime secret без раскрытия его значения. Runtime закреплён
на `google/gemini-2.5-flash-lite`.

Пройденный acceptance:

1. typecheck, lint, 218 unit/contract tests, production build и 8/8 browser
   smoke;
2. bounded provider smoke строгих Course и Lesson schemas с фактической
   задержкой 2,8–3,8 с;
3. authenticated assistant и Lesson preview через `v2.shidao.ru` с задержкой
   7,3–8,3 с, usage metadata и без provider errors;
4. preview вернул все шесть разрешённых Component types, после Cancel число
   Lessons осталось неизменным;
5. guest/auth/CSRF probes сохранили 405/401/403 и redirect/noindex contracts.

Release `9393080` tests дополнительно проверяют, что Lesson planning получает
bounded finalized history без технических IDs, draft/cancelled data не попадают
в context, а отсутствие не превращается в негативную учебную оценку. Код и
schema этого контекста развёрнуты; отдельный production provider postflight с
непустой учебной историей ещё не выполнялся.

Roleless functional release `01aa88a` и M1–M6 добавили course-scoped subject
consent, sanitized shared-history adapter, revision-pinned Apply и UI для
grant/revoke. Automated tests и authenticated browser postflight подтвердили,
что private/foreign raw rows не раскрываются. Отдельный реальный provider smoke
с непустой consented history по-прежнему не выполнялся.

Live Apply намеренно не запускался на пользовательских Course данных, а
configuration/provider failure не индуцировался на production. Apply validation,
stale protection, rollback compensation и safe error mapping покрыты automated
tests; первый реальный Apply следует наблюдать по metadata-only logs.
