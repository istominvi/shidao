# AI provider integration

**Статус:** canonical contract для deployed Course AI, backend signed
conversational System Assistant и current persisted Communication Center UI

**Актуально на:** 18 августа 2026 года

**Deployment state:** AI application slice развёрнут на `v2.shidao.ru` в release
`0276aed`; server runtime получает `ROUTERAI_API_KEY` из production secret
environment и использует `google/gemini-2.5-flash-lite`. Provider и
authenticated no-write postflight завершены. History-aware context реализован
и развёрнут в release `9393080` вместе с mixed Course audience; production
schema и read-only UI postflight завершены. Provider smoke с непустой учебной
историей ещё не выполнялся. Consent-gated cross-provider projection развёрнута
в roleless functional release `01aa88a` после M1–M6 и identity/browser
postflight.

Historical Global System Assistant, его прежний protected floating UI и routes
`/api/v2/assistant*` были развёрнуты в exact functional release `b7c6cfe`.
Coolify/running-container SHA и HTTP/guest/API boundary postflight подтверждены;
RouterAI no-write smoke с synthetic current Course подтверждён, authenticated
production Apply ещё не выполнен и не заявляется пройденным. Dedicated floating
UI этого release superseded в current source единым persisted
`CommunicationCenter`; backend contracts, routes и service boundary System
Assistant сохранены.
Conversational action follow-up расширяет allowlist наполнением и удалением
Lesson, подписывает proposal и вводит one-active confirmation state machine;
exact release `246cf49d2cd07bc7109b83acec46296be874312c` развёрнут. Running image и
HTTP/guest boundary postflight подтверждены, authenticated production action
postflight пока не выполнялся.

**Schema state:** AI authoring не добавляет отдельный provider accounting/quota
ledger; он читает bounded projection из `teacher_learner`, `lesson_run` и
`learning_record`.
Identity slice отдельно хранит course-scoped authorization в
`learner_ai_consent`; это не открывает provider raw history или teacher API.
Historical standalone System Assistant slice сам не менял PostgreSQL schema.
Current Communication Center сохраняет Account-owned AI-диалоги и turns в
`assistant_conversation` / `assistant_turn`; отдельной durable таблицы
action-execution/idempotency и billing ledger по-прежнему нет.

## Граница текущего среза

Base production slice подключает RouterAI к существующему Course Builder и
даёт преподавателю три отдельные возможности:

1. получить программу нового Course и явно применить её после preview;
2. получить план новой или существующей Lesson и явно применить его после
   preview;
3. обсудить Course или выбранную Lesson с read-only ассистентом.

Это authoring assistance, а не AI-преподаватель и не автономный агент. Ассистент
не проводит занятия и не управляет Student Screen.

Historical base follow-up заменил course-owned dialog одним global System
Assistant внутри protected Account layout. Current source сохраняет тот же
bounded conversational/action boundary внутри persisted Communication Center:
пользователь создаёт или открывает Account-owned AI-диалог, а turns переживают
закрытие panel и reload. Strict proposal allowlist разрешает создать Course
draft, добавить пустую или наполненную Lesson, дополнить открытую Lesson либо
удалить exact Lesson. Provider только формирует validated reply/proposal;
Course/Lesson mutation начинается после отдельного явного подтверждения
пользователя и вызывает canonical application service. Это не generalized tool
calling и не автономная запись из свободного текста чата.

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

Current persisted assistant flow:

```text
protected (app) layout
→ AssistantPageContextProvider (strict allowlisted page context only)
→ one persisted CommunicationCenter + AssistantConversationView
→ POST /api/v2/assistant/conversations/{conversationId}/turns
→ communication orchestration + universal active/provisional Account gate
→ owner-scoped persisted conversation/history
→ per-request actor + user-JWT Course/LessonRuns services
→ bounded owner/recorder/consent-scoped context
→ RouterAI strict JSON turn
→ text reply OR one signed strict proposal (no Course/Lesson write)
→ persisted assistant turn
→ explicit Apply in action card
→ POST /api/v2/assistant/actions/apply
→ signature + strict action validation + process-local replay/mutex guard
→ canonical createDraft | addLesson | applyLessonPlan | deleteLesson
→ user JWT / ownership / RLS
```

Current Communication Center не вызывает legacy `POST /api/v2/assistant` для
нового turn, не запускает MCP и не конструирует publication service-role
adapters. Backend route остаётся compatibility boundary.

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
существующей. Допустимы 3–20 Components из ограниченного authored-create
подмножества:

```text
rich_text
callout
single_choice_poll
matching_game
```

`rich_text` schema version `1` позволяет модели заполнить `title`, `content`
или оба поля и отклоняет одновременную пустоту обоих. Legacy `heading` остаётся
в runtime registry только для чтения/render/edit/PATCH уже сохранённых Lessons
и immutable publication revisions; AI provider schema и Apply больше не могут
создать его.

Provider allowlist намеренно не расширяется вместе с ручным registry:
`quote`, `image`, `video`, `audio`, `slideshow`, `choice_quiz`, `fill_blanks`,
`word_bank`, `sequence`, `categorize`, `free_response`, `external_link`,
`word_builder`, `vocabulary_list` и `file` не выдаются модели в этом срезе.
План использует каноническую иерархию `Course → Lesson → ordered
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

Прежний Course/Lesson dialog удалён из current deployed UI. Сам route пока
может оставаться для compatibility, но current Communication Center его не
вызывает. История этого старого dialog по контракту была ephemeral:

- сообщения не записываются в PostgreSQL, Storage или browser persistence;
- закрытие dialog или reload начинает новый диалог;
- server принимает не более 16 сообщений и 24 000 символов истории;
- обычный ответ содержит usage provider request; filled-Lesson orchestration
  агрегирует usage intent turn и отдельного canonical planner request.

Следовательно, это **read-only ephemeral assistant**, а не persisted Course chat,
change history или автономный editor.

## Persisted Communication Center — current source boundary

`src/app/(app)/layout.tsx` после Account guard использует
`AssistantPageContextProvider` только как typed allowlisted page-context
provider.
Он больше не рендерит отдельный assistant launcher или panel. В том же protected
layout один раз монтируются `CommunicationCenterProvider` и единственный
`CommunicationCenter`; public landing, Auth и standalone demo этот UI не
получают.

AI conversation UI принадлежит
`src/components/communication/assistant-conversation.tsx`, а подтверждаемая
action card — `src/components/communication/assistant-action-card.tsx`. Новый
диалог, его title/archive state и turns сохраняются через Communication API;
закрытие panel и reload их не удаляют. Локальными остаются transient composer,
in-flight/error и открытое состояние panel. Styles этого UI живут в
`src/app/styles/communication-center.css`. Прежние floating
`src/components/assistant/system-assistant.tsx` и
`src/app/styles/system-assistant.css` удалены из current source.

Это изменение UI ownership не удаляет `src/modules/ai/system-assistant-*`,
strict provider/context contracts, compatibility routes или explicit Apply
boundary. Persisted turn orchestration переиспользует System Assistant service,
а Course/Lesson mutation по-прежнему возможна только через отдельно
подтверждённую action card.

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
add_lesson_with_plan → course.add_lesson_with_plan
fill_lesson    → lesson.fill
delete_lesson  → lesson.delete
```

Chat route ничего не записывает. Server преобразует provider fields в strict
canonical Course/Lesson contracts и разрешает цели только по opaque references
из текущего owner-scoped Course/Lesson context. Filled flows вызывают уже
существующий `planLesson` и вкладывают canonical
`AiLessonPlanApplyRequest` в preview card; планирование проходит отдельный
lesson-plan rate limit. Action card получает UUID idempotency key и HMAC-
подпись, связанную с actor, exact action и key на 10 минут.

На Course surface server-issued ref `current_course` является единственным
допустимым fallback для пустого `courseRef`: raw Course UUID/title, fuzzy match,
case-folded alias или индекс не принимаются. Если provider преждевременно вернул
`add_lesson` без обязательного title, server не превращает это в 502 и не
создаёт proposal, а возвращает детерминированное уточнение названия. Следующий
turn с title может подготовить обычную action card; до explicit Apply ни один
Course Builder command не вызывается. Неизвестный непустой ref отклоняется fail
closed даже при пустом title.

Простое «сделай урок» без явного пустого/наполненного режима возвращает
уточнение и не выбирает пустой Lesson по умолчанию. На Lesson surface «заполни
этот урок» привязывается к server-resolved current Lesson; defense-in-depth
guard не позволяет ошибочному provider `add_lesson` снова создать пустой урок.
`lesson.fill` показывает новый teacher comment и все 3–20 Components, сохраняет
existing Components/Slides и добавляет новые Components в конец.

Для этого конкретного бинарного уточнения server-authored reply содержит два
bounded варианта «Пустой урок / Готовый урок». Это не отдельный command API:
UI показывает кнопки только под последним assistant turn в том же page context,
а выбор добавляет обычное user message в историю и снова проходит provider и
всю action orchestration. При отправке, новом ответе или смене Course/Lesson
старые варианты недоступны; модель не может произвольно сформировать эти
structured quick replies.

Mutation выполняется только после отдельного подтверждения пользователя и строгого
`POST /api/v2/assistant/actions/apply`. Apply повторно проходит Account/session
gate, проверяет proposal signature и вызывает canonical `createDraft`,
`addLesson`, `applyLessonPlan` либо history-preserving `deleteLesson`;
actor/account ID не являются action arguments. Delete card показывает, что
удаляются plan, assignments и run history, а finalized individual results
сохраняются; owner-scoped authored Lesson fingerprint проверяется повторно до
RPC. Auth/security, Students/Groups, audience, Schedule/Run creation,
publication, attachments и arbitrary API calls в allowlist отсутствуют.

Action result строится из фактического service commit и даёт ссылку на созданный
или изменённый Course/Lesson; текст provider не считается доказательством
mutation. Exact «да» и кнопка применяют только последнюю pending signed card без
нового provider turn; exact «нет», любой другой новый запрос или смена
Course/Lesson target отменяют её. Proposal не persisted: подпись предотвращает
подмену/replay под новым key в пределах TTL, но process-local result cache всё
ещё не является durable ledger или distributed exactly-once. Delete
fingerprint compare и delete RPC не образуют одну DB transaction, поэтому
узкое concurrent manual-edit TOCTOU окно остаётся известным debt.

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
durable action ledger или гарантией exactly-once. Signed proposal запрещает
подмену actor/action/key в пределах 10-минутного TTL, но не делает кеш
распределённым. `addLesson` дополнительно
сохраняет известный read-next-position ordering debt до отдельной DB/service
serialization.

Communication Center показывает monthly quota projection, агрегированную из
persisted assistant turns и их bounded usage metadata. Это не отдельный
authoritative billing ledger: balance, billing units и subscription enforcement
в текущем срезе отсутствуют. Нулевой или отсутствующий usage в provider response
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
assistant_conversation
assistant_turn
```

`lesson_run` и `learning_record` принадлежат scheduling/learning-history domain,
а `learner_ai_consent` — identity authorization, не provider accounting. Base
history ограничена `recorded_by_account_id`; foreign history входит только
через `build_cross_provider_learner_context` как consent-gated sanitized
projection. SQL и service-role credentials модели не доступны. Persisted
результат AI после Apply не отличается по domain contract от результата ручного
редактора. Raw provider request не архивируется. Communication domain сохраняет
Account-owned assistant conversation и user/assistant turns, включая bounded
reply payload/usage; monthly quota вычисляется из этих turns, а не хранится как
отдельный billing balance.

System Assistant не добавляет отдельного AI-owned Course/Lesson типа. Signed
proposal может сохраняться внутри assistant turn payload, но in-flight lock и
idempotency result остаются process-local; durable action-execution ledger и
exactly-once boundary отсутствуют. Созданные после Apply Course/Lesson являются
обычными существующими domain rows.

Identity, provenance и current access boundary зафиксированы в
[`learner-identity-access-model.md`](./learner-identity-access-model.md).
Current cross-provider flow допускает context только по отдельному
course-scoped subject consent и через sanitized server projection; teacher API
не получает foreign raw records. Historical execution contract находится в
[`LEARNER_IDENTITY_COMPLETION_PROMPT.md`](../v2/LEARNER_IDENTITY_COMPLETION_PROMPT.md).

## Не входит в текущий срез

- UI выбора модели пользователем;
- durable AI action-execution history/change sets/undo за пределами persisted
  conversation turns;
- generalized/native tool calling и mutations вне allowlisted Course/Lesson
  actions;
- distributed rate limit, durable idempotency/action ledger и exactly-once
  mutations между replicas;
- attachment parsing/OCR/RAG и citation provenance;
- Homework generation;
- learner-facing AI teacher, live lesson и Student Screen control;
- automatic subject metrics beyond current attendance/repeat/comments;
- persistent distributed quota, cost ledger, billing и subscriptions;
- внешний remote MCP/API.

## Карта реализации

| Область                             | Каноническое место                                                                                                  |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Provider adapter                    | `src/modules/ai/routerai.ts`                                                                                        |
| Provider lesson transport           | `src/modules/ai/lesson-provider-contracts.ts`                                                                       |
| AI request/response contracts       | `src/modules/ai/course-builder-contracts.ts`                                                                        |
| Bounded model context               | `src/modules/ai/course-context.ts`                                                                                  |
| Consented safe history              | `src/modules/ai/shared-history.ts`                                                                                  |
| Learning history service            | `src/modules/lesson-runs/service.ts`                                                                                |
| Planning/apply/chat service         | `src/modules/ai/course-builder-service.ts`                                                                          |
| System Assistant contracts/service  | `src/modules/ai/system-assistant-contracts.ts`, `src/modules/ai/system-assistant-service.ts`                        |
| Persisted assistant orchestration   | `src/modules/communication/assistant-orchestration.ts`, `src/modules/communication/assistant-runtime.ts`            |
| Rate/error boundary                 | `src/modules/ai/server-context.ts`                                                                                  |
| API routes                          | `src/app/api/v2/courses/[courseId]/ai-*/`, compatibility `assistant/`, `src/app/api/v2/assistant/`                  |
| Browser client                      | `src/components/course-builder/course-builder-client.ts`                                                            |
| Course preview UI                   | `src/components/course-builder/ai-course-plan-dialog.tsx`                                                           |
| Lesson preview UI                   | `src/components/course-builder/ai-lesson-plan-dialog.tsx`                                                           |
| Allowlisted page-context provider   | `src/components/communication/assistant-page-context.tsx`, `src/app/(app)/layout.tsx`                               |
| Assistant Apply browser client      | `src/components/communication/assistant-api-client.ts`                                                              |
| Persisted assistant conversation UI | `src/components/communication/assistant-conversation.tsx`, `src/components/communication/assistant-action-card.tsx` |
| Communication shell/styles          | `src/components/communication/communication-center.tsx`, `src/app/styles/communication-center.css`                  |

## Conversational System Assistant release acceptance — historical UI

Следующие acceptance-факты относятся к прежнему dedicated floating UI. Они
сохраняют release evidence backend conversational/action boundary, но не
описывают current source ownership UI после перехода в Communication Center.

Signed five-action conversational follow-up входит в exact functional release
`246cf49d2cd07bc7109b83acec46296be874312c`. Финальный gate прошёл 435/435
unit/contract tests, production build, 21/21 production-mode browser smoke,
format и diff checks. Coolify webhook deployment `d5ov515oscti9n6c7x8fb3qf`
завершился со статусом `Success` за 4 мин 16 с; running container подтвердил тот
же `SOURCE_COMMIT` и image tag, image ID
`sha256:21c7ab8c437d60a631e6fb68b474ec886f0c5fcf1dca1942207b5c85bab852ae`,
restart count `0`, state `running`. Production `/login` и `/robots.txt` отвечают
`200`, оба global assistant POST без Account session — `401`. Authenticated
production action не применялся: запись Course/Lesson остаётся только за явным
подтверждением владельца в обычной UI-сессии.

Quick-reply follow-up входит в exact functional release
`69a74a7c6a72f4491fef1314e32769c26fc72db7`. GitHub CI прошёл `438/438`,
production build и отдельный Playwright click/history scenario зелёные. Coolify
webhook deployment `qps8curjf688ndlmw95hdck2` завершился `Success` за 2 мин
29 с; контрольный manual deployment `mbxvql93z9ctvswb0lu07ca8` — `Success` за
22 с. Running container подтвердил exact `SOURCE_COMMIT`, image tag, image ID
`sha256:ff300b42295b74685605a70b2dd25c29ea9e0758250be51e1f222af539f9690f`,
restart count `0` и state `running`. HTTP login/robots — `200`, guest assistant
POST — `401`; authenticated mutation postflight не выполнялся.

## Base Global System Assistant release acceptance — historical UI

Global System Assistant входит в functional release
`b7c6cfe73809d2006d7fb4fafc833a93a905f4af`. Release gate прошёл typecheck,
lint, 407/407 unit/contract tests, production build, 21/21 browser smoke,
format и diff checks. Coolify deployment `nl5p1nuxnvdi392vwfopmab2` завершил
rollout со статусом `Success` за 2 мин 31 с; running container имеет тот же
`SOURCE_COMMIT`, image digest
`sha256:42e0767f3848f6d61322b893edf528c79fab9c2e450de0fa303231202f61d8e8` и
restart count `0`. Production `/login`/`robots.txt` отвечают `200`, guest
`/courses` перенаправляется в `/login`, а оба новых POST route без Account
session возвращают `401`. Реальный RouterAI no-write smoke с synthetic current
Course вернул уточнение title, затем proposal без Course Builder write;
authenticated production Apply не выполнялся и не считается пройденным.
Этот historical acceptance подтверждает base release с Course draft/пустой
Lesson; expanded signed follow-up подтверждён отдельным acceptance выше.

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
