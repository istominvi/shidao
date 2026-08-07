# Roadmap ShiDao V2

**Статус:** приоритеты после первого работающего Course Builder milestone
**Актуально на:** 7 августа 2026 года

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
  `AppPageHeader` с общим крупным H1, подзаголовком, optional backlink и правой
  action-секцией. Course, Lesson, Students и profile dialog используют один
  `WorkspaceTabs`: 40 px, roving keyboard/ARIA, horizontal scroll и квадратный
  чёрный active-сегмент 3 px поверх общей baseline.
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

Текущий snapshot честно фиксирует, что `user_preference` и `user_security` не
имеют RLS и сохраняют слишком широкие legacy grants. Перед расширением
identity, learner access или внешних интеграций необходимо:

CSRF guard пока допускает configured landing host как Origin для unsafe V2
requests. Перед расширением identity/external access нужны строгая app-host
boundary и cross-subdomain regression test; явный production allowlist для
routed hosts также остаётся P0-задачей.

- инвентаризировать все server callers login/onboarding/profile/PIN/session и
  legacy `SECURITY DEFINER` RPC с caller-supplied `p_user_id`/`anon` execute;
- проверить фактический Data API exposure read-only и составить negative tests;
- отдельной approved ops-задачей ротировать historical plaintext credentials
  из ignored `enviromnent/db-mcp-cheatsheet.md`, затем оставить только safe
  deprecation stub; не печатать текущие значения;
- заменить broad table/function grants узкими authenticated/service
  boundaries и owner checks;
- включить RLS там, где прямой доступ действительно нужен, либо полностью
  закрыть direct table access;
- закрыть middleware host boundary явным production allowlist: non-root
  `brand`/`model` и неизвестные routed hosts не должны получать app/API;
- определить Prettier baseline: исключить immutable archive и отдельно
  отформатировать active source, чтобы repository-wide `format:check` стал
  честным gate;
- доставить исправление новой forward migration с Auth regression smoke.

Этот пункт не разрешает менять Auth/SMTP/JWT или применять migration без
read-only ShiDao sanity check и отдельного deployed-contour postflight.

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

Текущие `teacher/parent/student/school/class` сохранены только для
compatibility login/profile flows.

**Current repository slice:**

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
  пока не реализованы;
- `LearningRecord.recorded_by_account_id` фиксируется при scheduling;
  teacher-history и текущий AI context читают только записи текущего recorder;
- изменение membership прикреплённой группы влияет на новые назначения и AI
  context, но не переписывает состав уже открытого LessonRun;
- Course Builder остаётся owner-only, а старые Class/School не используются.

**Next:**

- invitation/claim flow для привязки существующего offline profile к одному
  Account без эвристики по имени/email;
- subject-controlled visibility и Guardian/observer relation с grant/revoke
  audit;
- безопасный merge duplicate profiles только после определения authorization и
  конфликтов двух records одного LessonRun;
- learner-facing кабинет и явный доступ к Course/Student Screen;
- cross-provider history и AI context только поверх отдельного разрешения, а не
  автоматически из canonical profile ID.

Нельзя использовать старую Class/School как новый parent Course только ради
быстрого enrollment. Learner login/access не следует ни из наличия
LearnerProfile, ни из nullable `learner_profile.account_id` до завершённого
claim/access slice. Заполненный `account_id` позволяет Account выбрать только
собственную canonical identity row; Course, records и teacher-local data этим не
открываются. Полный current/next/later boundary находится в
[`docs/architecture/learner-identity-access-model.md`](./architecture/learner-identity-access-model.md).

## P2: LessonRun и live lesson

**Current repository slice:**

- `/schedule` проецирует LessonRun по календарному дню без параллельной таблицы
  Schedule events;
- Lesson остаётся единственным content entity; один открытый LessonRun является
  изменяемым назначением, а закрытые Runs — историей;
- Lesson можно проводить многократно, в том числе повторно для subset audience;
- completion сохраняет teacher report и точные LearningRecord каждого
  ожидаемого ученика;
- UI state выводится из timestamps, persisted status отсутствует.

**Next — live:**

- основной runtime cursor указывает на Student Screen Slide и не создаёт
  authored Step; внутреннее состояние интерактивного Component при
  необходимости хранится отдельно;
- teacher управляет learner screen по умолчанию;
- Realtime используется после явной authorization модели;
- Realtime/presence и learner authorization проектируются поверх открытого
  LessonRun, а не через второй content-bearing LessonSession.

## P3: richer learning history, communication и product scale

- автоматические subject metrics и измеримые progress models поверх текущих
  finalized LearningRecord;
- pagination/aggregation для длинной Lesson/Course/Profile history;
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
