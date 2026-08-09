# Roadmap ShiDao V2

**Статус:** приоритеты после первого работающего Course Builder milestone
**Актуально на:** 9 августа 2026 года

Фактически реализованное состояние находится в
[`docs/project-state.md`](./project-state.md). Этот документ описывает только
направление движения. Он не является текущей schema/API документацией.

## Принципы последовательности

1. Каждый этап завершается рабочим vertical slice на реальных данных.
2. Новая возможность переиспользует Course Builder service/contracts и
   code-first registry, а не создаёт параллельную модель.
3. Учитель может работать вручную без обязательного расхода AI tokens.
4. AI не получает SQL или service-role credentials.
5. Attachment не считается прочитанным до фактического parsing результата.
6. Homework остаётся отдельной Lesson surface; LessonRun/LearningRecord
   расширяют Lesson без второго authored/runtime content model и не возвращают
   Lesson Step.
7. Новая schema появляется только forward migration; current-schema snapshots
   обновляются в том же изменении.
8. Нельзя расширять scope за счёт Auth, SMTP, JWT/API keys, базового Storage или
   recovery V1 без отдельного решения.

## Выполненный фундамент

- V1 зафиксирована в immutable Git refs и private recovery snapshot.
- «Мир вокруг меня» сохранён в repository archive с Markdown, raw exports,
  source documents, assets, manifests и checksums.
- `shidao.ru` переведён в landing-only, V2 работает на `v2.shidao.ru`.
- Старый Methodology/Step/runtime код удалён из активного приложения.
- Каноническая модель стала `Course → Lesson → ordered Components`.
- Реализованы persisted Course, Lesson, 10 Component types и private
  course-wide attachments.
- Реализована двухуровневая Course → Lesson навигация в визуальном языке demo:
  пять Course tabs, пять Lesson tabs, прозрачные headers и отдельный список
  Lesson до открытия редактора.
- `/courses`, `/students`, `/schedule`, Course и Lesson используют один
  `AppPageHeader` с H1 не крупнее 48 px на desktop и 32 px на mobile,
  подзаголовком, optional backlink и правой action-секцией. Header имеет
  `min-height: 200px`, растёт по контенту и вертикально центрирует actions.
  Course, Lesson, Students и profile dialog используют один `WorkspaceTabs`:
  40 px, roving keyboard/ARIA, horizontal scroll, чёрная baseline 1 px с
  inline-inset 12 px и квадратный чёрный active-сегмент 4 px без radius.
  Follow-up развёрнут и подтверждён browser postflight в release `77870e3`.
- Active app routes приведены к плоскому demo-фону `#f5f1e8` без marketing
  gradients; header, кнопки, вкладки и заголовочная типографика используют
  scoped demo-размеры и веса, не затрагивая landing/Auth.
- На release `fea7f80` развёрнуты teacher-only `/schedule` и `/students` и
  пункты «Расписание / Ученики / Курсы» как исходные shells.
- Эти shells превращены в deployed vertical slice: нейтральные
  LearnerProfile, переиспользуемые группы, смешанная Course audience,
  LessonRun, LearningRecord,
  расписание, повторное проведение и Lesson/Course/Profile history. Срез не
  читает старые `student/class/class_student`; migration применена к production
  ShiDao DB и прошла DB/RLS/ACL/PostgREST postflight 7 августа 2026 года.
  Базовый LessonRun был выпущен в `fa91371`, а reusable Groups, mixed audience
  и history-aware AI-context — в `9393080`; оба release прошли
  HTTP/authenticated browser postflight без записи тестовых данных.
- Deployed release `757044c` поверх этого baseline разделяет canonical
  `learner_profile` и teacher-local `teacher_learner`, а
  `learning_record.recorded_by_account_id` сохраняет recorder. Существующие
  profiles backfilled 1:1; account claim, merge и observer access не входят в
  этот slice.
- Current production contract release поверх deployed baseline завершает P0.Identity:
  roleless exactly-one Account profile, Account login/PIN, discovery/claim/
  child activation/merge, archive/restore, self/observer history/progress,
  erasure и consented AI. M1–M6, четыре verified backup, два exact roleless
  Coolify SHA, финальный DB/RLS/ACL/PostgREST postflight и реальный GoTrue
  create/delete probe подтверждены; exact functional web SHA `01aa88a` и
  authenticated production browser postflight завершены. P0.Identity закрыт.
- Реализованы private-by-default Components и persisted Student Screen Slides.
- Реализован fullscreen Student Screen preview.
- Реализован development-only MCP из шести tools поверх application service.
- Lesson planning и read-only Assistant получают состав выбранных групп и
  отдельных учеников, а также bounded finalized learning history эффективной
  аудитории без технических IDs; отсутствие не трактуется как непонимание.
- В release `0276aed` развёрнуты и проверены RouterAI provider adapter,
  Course/Lesson
  preview → explicit apply и read-only ephemeral assistant; production runtime
  получает API key из server-side secret environment и использует проверенный
  default `google/gemini-2.5-flash-lite`.
- Browser-smoke переведён на актуальную AES-GCM app-session; строгий
  production-mode gate покрывает guest/auth redirects, Course → Lesson →
  backlink, computed visual contract и mobile overflow без обращения к
  рабочей базе.
- Первый Course Builder milestone проверен на deployed customer-demo контуре.
- На release `7021801` восстановлен отдельный `demo.shidao.ru` с прежним интерактивным
  client-only UI-прототипом и clean-path навигацией. Это изолированная
  reference surface с фиктивными данными, а не возврат Step/Methodology в V2,
  не runtime fallback и не реализация schedule/learner/AI milestones.

## P0.1: legacy identity/security hardening

**Current production contract:** M1 включает RLS/ACL hardening
`user_preference`/`user_security`, active callers перенесены на Account
boundary, production middleware использует explicit host allowlist и exact
`v2.shidao.ru` CSRF Origin. Negative Auth/host/output tests входят в release
gate. **Production status:** M1–M6, четыре verified backup, два exact roleless
web deployment, contract DB postflight, Auth Admin lifecycle probe, exact
functional SHA `01aa88a` и authenticated browser postflight завершены 9 августа
2026 года.

- [x] инвентаризировать server callers login/onboarding/profile/PIN/session и
      legacy `SECURITY DEFINER` RPC с caller-supplied `p_user_id`/`anon` execute;
- [x] проверить фактический Data API exposure read-only и составить negative
      tests;
- отдельной approved ops-задачей ротировать historical plaintext credentials
  из ignored `enviromnent/db-mcp-cheatsheet.md`, затем оставить только safe
  deprecation stub; не печатать текущие значения;
- [x] заменить broad table/function grants узкими authenticated/service
      boundaries и owner checks;
- [x] включить RLS там, где прямой доступ действительно нужен, либо полностью
      закрыть direct table access;
- [x] закрыть middleware host boundary явным production allowlist: non-root
      `brand`/`model` и неизвестные routed hosts не должны получать app/API;
- [x] определить Prettier baseline: исключить immutable archive и отдельно
      отформатировать active source, чтобы repository-wide `format:check` стал
      честным gate;
- [x] доставить M5/M6 forward hardening с restricted Auth regression, backup,
      production GoTrue lifecycle smoke и exact web/browser verification.

Этот пункт не разрешает менять Auth/SMTP/JWT или применять migration без
read-only ShiDao sanity check и отдельного deployed-contour postflight.

## P0.Identity: завершить universal Account и canonical learner ecosystem

**Current production contract:** все vertical slices реализованы через M1–M6,
`src/modules/learner-identity/`, API/UI и roleless navigation. Четыре verified
backup, два roleless deploy, dependency audit, contract cleanup, Auth hardening,
final snapshot, DB/API/GoTrue postflight, exact functional web SHA `01aa88a` и
authenticated browser acceptance завершены. Identity program complete.
Homework, RAG, billing, templates и live Student Screen по-прежнему не входят.

Согласованный target:

- один roleless Account может одновременно преподавать, учиться и наблюдать;
- каждый active Account имеет ровно один canonical LearnerProfile как
  transaction-safe DB invariant, а offline profiles остаются unclaimed до
  consented connection;
- преподавание и observer access являются отношениями, а не глобальными ролями;
- teacher raw history остаётся recorder-scoped;
- subject/observer получают learner-safe finalized history и progress;
- cross-provider AI использует deterministic sanitized projection только по
  отдельному отзываемому consent на `profile + Course + owner` с проверкой
  current owner и не
  открывает teacher browser чужие raw records;
- duplicate profiles физически сводятся к одному active target с lineage/audit,
  без потери LearningRecord и teacher-local names;
- full Lesson snapshot и `lesson_run_participant` не возвращаются.

Реализованная последовательность vertical slices:

1. **Security gate:** закрыты legacy ACL, host allowlist и app-origin CSRF из
   P0.1 с Auth regression и negative actor tests.
2. **Universal Account bootstrap:** один profile на каждый Account, roleless
   onboarding/navigation и отсутствие active dependency от
   `teacher/parent/student`.
3. **Discovery/connection:** rotating one-time share code/QR и blind email
   exact handle, blind recipient-bound email invitation, accept/revoke/expiry и
   flow «сначала найти Account, затем создать offline profile». Discovery
   создаёт только pending request; active relation требует accept subject. Для
   learner без email recipient активирует отдельный learner Account с login/PIN,
   а не использует собственный взрослый Account.
4. **Claim и physical merge:** merge preview, conflicts одного LessonRun,
   transactional locks, lineage alias, audit и один canonical target. Обычный
   путь — только unclaimed source в actor-owned target; open Run/draft и
   claimed-to-claimed merge fail closed.
5. **Archive/lifecycle:** архивный список, restore без скрытого возврата прежних
   memberships, permanent delete только пустого unclaimed profile и
   subject-only learning-data erasure/reset.
6. **Observer:** self-managed invite/accept/revoke, раздел «Наблюдение» и узкая
   read-only finalized projection. Teacher relation не выдаёт observer access.
7. **Progress:** nullable verified actual duration, pagination и aggregate
   projection из реальных LearningRecord по canonical lineage. Scheduled
   fallback не считается фактическим start; generic learner metrics ждут
   реального Component/runtime producer.
8. **AI consent:** request + grant на `profile + Course + owner`, безопасная
   metadata projection без Course access, deterministic bounded sanitized
   context, immediate revoke/expiry/owner-change invalidation, audit и
   stale-preview protection.
9. **Legacy cutover:** active role switch/callers удалены; final role
   helpers/types/grants и rollback-only security dual-writes удалены отдельной
   M4 после доказанного отсутствия зависимостей.
10. **Auth transaction hardening:** M5 выполняет deferred exactly-one invariant
    под закрытой owner boundary; M6 распознаёт только trusted pristine
    child-activation metadata в той же GoTrue creation transaction и запрещает
    late `active → provisional` downgrade.

Каждый slice проходит цепочку contracts → service → repository → API → UI →
tests → migration/snapshot → docs → production postflight. Нельзя объявлять
программу завершённой после одной схемы или claim UI.

Definition of Done программы:

- новый пользователь автоматически получает Account и один canonical profile;
- DB postflight подтверждает exactly-one invariant, включая concurrent
  signup/claim/reset;
- один и тот же profile безопасно используется несколькими преподавателями;
- «Добавить ученика» поддерживает existing Account и offline path;
- offline learner без email получает отдельный Account/login/PIN; взрослый
  recipient не становится learner identity;
- invitation/claim/merge/archive/restore доступны в UI и конкурентно безопасны;
- stale merged UUID в одиночных teacher URLs actor-scoped резолвится в target;
  bulk Group/Course/Run UUID fail generic и требуют reload/reselect, а erasure
  удаляет alias полностью;
- subject управляет наблюдателями, observer ничего не мутирует;
- subject/observer видят всю разрешённую finalized lineage, teacher — только
  свои raw observations;
- self-profile/history и observer projection работают независимо; progress и
  actual duration основаны только на сохранённых данных;
- AI без consent не получает foreign history, с consent получает только
  безопасную projection, а revoke действует немедленно;
- role choice больше не определяет active V2 navigation/access;
- существующие student login/PIN работают через Account credential boundary без
  active dependency от legacy role tables;
- migrations, RLS/ACL actor matrix, Auth/browser regression, docs и production
  postflight зелёные.

Полный execution/acceptance prompt:
[`LEARNER_IDENTITY_COMPLETION_PROMPT.md`](./v2/LEARNER_IDENTITY_COMPLETION_PROMPT.md).

## P0.2: завершить базовый teacher authoring

Цель — превратить рабочий технический редактор в уверенный ежедневный
инструмент преподавателя без изменения доменной модели.

- продолжить responsive/accessibility полировку обновлённого Course workspace;
- добавить загрузку новых материалов из открытого существующего Course;
- улучшить выбор/поиск Components в palette;
- проверить все десять editors/renderers отдельными production-safe сценариями;
- добавить drag-and-drop только если он не ухудшает доступность и надёжность;
- завершить поведение удаления Course; Lesson уже предупреждает об удалении
  Runs и сохраняет finalized LearningRecord в учебных профилях;
- добавить autosave/draft feedback там, где это уменьшает риск потери ввода;
- сериализовать append Lesson/Component на owner parent, чтобы concurrent
  create не сталкивался по position и supported path всегда оставался dense;
- не делать AI обязательным для создания или редактирования Lesson.

Definition of Done:

- Course можно полноценно поддерживать после первоначального создания;
- teacher понимает видимость и Slide каждого Component без скрытых правил;
- keyboard/focus/dialog behavior проходит accessibility smoke;
- reload и повторный вход не меняют состояние.

## P0.3: RouterAI Course/Lesson authoring

Цель — дать преподавателю работающую AI-сборку Course/Lesson без второй
архитектуры урока и без неконтролируемой записи из чата.

**Current production boundary:**

- server-only OpenAI-compatible RouterAI adapter с default
  `google/gemini-2.5-flash-lite`, конфигурируемой моделью, timeout и abort;
- bounded provider input и provider-compatible flat structured output, который
  преобразуется в canonical AI plan и повторно валидируется теми же
  Zod/registry contracts перед первой записью;
- Course outline ровно на `targetLessonCount` Lessons;
- создание новой или дополнение существующей Lesson ограниченным набором
  registry Components;
- отдельные preview и explicit Apply; provider planning не выполняет записи;
- stale-plan checks, idempotent Course retry и compensating cleanup для
  поддерживаемых apply paths;
- новые AI Components private-by-default и не публикуются на Student Screen;
- read-only ephemeral assistant с Course/selected Lesson context, без tools,
  mutation commands и persisted chat history;
- понятные provider errors и сохранение ручного workflow;
- фактические request ID/model/token usage в ответе и metadata-only server log;
- process-local rate/concurrency limit без новой persistence;
- attachment metadata без скачивания/парсинга file contents;
- отсутствие schema migration, quota/ledger и billing.

**Next — operational hardening:**

- наблюдать первый реальный teacher Apply по metadata-only logs; не создавать
  отдельные production test entities без явной необходимости;
- проверить provider-error fallback во время планового fault-injection окна, не
  нарушая доступность demo-контура;
- ротировать временный demo key до публичного production launch, особенно если
  его значение когда-либо передавалось через чат, log или screenshot;
- при нескольких application replicas заменить process-local protection
  распределённым rate limit;
- спроектировать persistent quota/usage ledger до введения платного ограничения,
  но не выдавать текущий metadata usage за balance или billing.

MCP остаётся development adapter. Production web вызывает application
service/contracts напрямую и не поднимает внешний MCP endpoint или статический
MCP actor. Полный current/source/deployment contract находится в
[`docs/architecture/ai-provider-integration.md`](./architecture/ai-provider-integration.md).

На этом этапе attachment используется только как metadata и явно введённый
teacher context. Нельзя писать «AI изучил файл», пока отдельный parsing pipeline
не вернул подтверждённый extracted text.

## P1.1: persisted Homework

Цель — заменить текущую заглушку отдельным Lesson-owned редактором.

- собственные Homework contracts/service/repository;
- отдельный ordered list homework components или отдельный ограниченный
  registry context — решение фиксируется до migration;
- teacher preview и learner projection;
- due/assignment model добавляется только вместе с LearnerProfile/audience;
- Homework не смешивается с `lesson.components` и Student Screen Slides.

Первый срез может сохранять одно общее Homework на Lesson без индивидуальных
override. Overrides и immutable issued snapshots добавляются после появления
новой audience-модели.

## P1.2: Sources и parsing/RAG

Цель — сделать материалы реальными источниками AI.

- SourceDocument поверх существующего StoredFile, без дублирования объекта;
- безопасное извлечение текста сначала для PDF с text layer, DOCX, TXT и MD;
- status pipeline `uploaded → extracting → ready | failed`;
- chunks, provenance и checksum/version;
- embeddings и retrieval только после измеримого extraction baseline;
- UI всегда различает «прикреплён», «обрабатывается», «проанализирован» и
  «ошибка».

OCR, web crawling и audio transcription не входят в первый parsing slice.

## P2: audience и learning identity

Legacy `teacher/parent/student/school/class` rows сохраняются только как dormant
compatibility/recovery data; active roleless contract их не читает.

**Current deployed slice:**

- canonical `LearnerProfile` без teacher owner: nullable unique `account_id`
  резервирует one-to-one claim point, а global `display_name` остаётся
  canonical/offline fallback;
- `teacher_learner` хранит teacher-local display name и archive state; создание,
  редактирование и product delete ученика продолжают использовать существующие
  learner-profile routes/RPC, но меняют relation конкретного преподавателя;
- reusable `learner_group` с many-to-many membership: один LearnerProfile может
  быть без группы или входить сразу в несколько;
- смешанная Course audience через независимые direct learner и group links;
  effective audience — дедуплицированное объединение активных профилей;
- teacher-only `/students` как единый sortable/filterable справочник: ученика
  можно создать, изменить и убрать из своего списка, для групп доступен CRUD, а
  dialog ученика показывает индивидуальную историю;
- безопасное product delete ученика архивирует только teacher relation и
  отсоединяет её от будущих аудиторий этого Account, не удаляя canonical
  LearnerProfile, LearningRecord и уже назначенные Runs; archive list/restore
  реализованы;
- `LearningRecord.recorded_by_account_id` фиксируется при scheduling;
  teacher-history и текущий AI context читают только записи текущего recorder;
- изменение membership прикреплённой группы влияет на новые назначения и AI
  context, но не переписывает состав уже открытого LessonRun;
- Course Builder остаётся owner-only, а старые Class/School не используются.

**Current production contract:**

- exactly-one Account/profile invariant, roleless navigation и Account
  login/PIN boundary;
- share-code/email connection, offline claim/child activation и physical merge;
- archive list/restore, permanent empty-offline delete, safe unlink и subject
  erasure;
- self/observer learner-safe history/progress и explicit shared comments;
- subject-controlled cross-provider AI consent с bounded sanitized projection;
- stale source UUID actor-scoped resolution для одиночных teacher URLs; bulk
  UUID fail generic + reload/reselect; erasure deletes alias.

Нельзя использовать старую Class/School как новый parent Course только ради
быстрого enrollment. Learner login/access не следует ни из наличия
LearnerProfile, ни из nullable `learner_profile.account_id` до завершённого
claim/access slice. Заполненный `account_id` позволяет Account выбрать только
собственную canonical identity row; Course, records и teacher-local data этим не
открываются. Полный current/next/later boundary находится в
[`docs/architecture/learner-identity-access-model.md`](./architecture/learner-identity-access-model.md).
Learner Course consumption и live Student Screen остаются отдельным later slice
и не входят в P0.Identity. Наличие linked profile/observer grant/AI consent не
создаёт Course enrollment.

## P2: LessonRun и live lesson

**Current deployed slice:**

- `/schedule` проецирует LessonRun по календарному дню без параллельной таблицы
  Schedule events;
- Lesson остаётся единственным content entity; один открытый LessonRun является
  изменяемым назначением, а закрытые Runs — историей;
- Lesson можно проводить многократно, в том числе повторно для subset audience;
- completion сохраняет teacher report и точные LearningRecord каждого
  ожидаемого ученика;
- UI state выводится из timestamps, persisted status отсутствует.

**Current production contract дополнительно:** verified actual duration,
explicit shared individual comment, cursor-paginated self/observer history и
real-record progress без speculative metrics.

**Next — live:**

- основной runtime cursor указывает на Student Screen Slide и не создаёт
  authored Step; внутреннее состояние интерактивного Component при
  необходимости хранится отдельно;
- teacher управляет learner screen по умолчанию;
- Realtime используется после явной authorization модели;
- Realtime/presence и learner authorization проектируются поверх открытого
  LessonRun, а не через второй content-bearing LessonSession.

## P3: richer learning history, communication и product scale

- Component/runtime-produced subject metrics и richer progress signals поверх
  текущих finalized LearningRecord;
- common/individual Homework assignment snapshots;
- course chat и notifications;
- templates и контролируемый importer repository archive;
- AI change sets, undo, quotas и billing;
- optional staging перед публичным production;
- внешний MCP только после OAuth/scoped tokens, permissions, rate limits,
  audit и revocation.

## Не планируется возвращать

- Methodology как runtime/domain parent;
- Lesson Step или скрытый root Step;
- fixture fallback;
- renderer по ID конкретной Lesson/Course;
- service role в обычном browser/MCP flow;
- массовый reset `public` как обычный способ разработки;
- удаление или переписывание старых migrations;
- восстановление V1 без отдельной явной команды владельца.

## Как выбирать следующий milestone

Перед реализацией следующая сессия должна:

1. прочитать `AGENTS.md`, `docs/project-state.md` и релевантный canonical doc;
2. проверить текущий код/routes/schema вместо доверия roadmap;
3. выбрать один демонстрируемый workflow;
4. зафиксировать минимальный data/application/UI contract;
5. выполнить schema sanity check перед DB write;
6. реализовать, протестировать, развернуть и пройти сценарий;
7. обновить `project-state.md`, roadmap и связанные документы в том же наборе
   коммитов.
