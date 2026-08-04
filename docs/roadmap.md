# Roadmap ShiDao V2

**Статус:** приоритеты после первого работающего Course Builder milestone
**Актуально на:** 4 августа 2026 года

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
6. Homework, live runtime и learning history остаются отдельными доменами и не
   возвращают Lesson Step.
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
- Реализованы Course settings/materials actions и русская навигация Lesson.
- Реализованы private-by-default Components и persisted Student Screen Slides.
- Реализован fullscreen Student Screen preview.
- Реализован development-only MCP из шести tools поверх application service.
- Первый Course Builder milestone проверен на deployed customer-demo контуре.

## P0.1: legacy identity/security hardening

Текущий snapshot честно фиксирует, что `user_preference` и `user_security` не
имеют RLS и сохраняют слишком широкие legacy grants. Перед расширением
identity, learner access или внешних интеграций необходимо:

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
- исправить CSRF allowlist: landing origin не должен считаться same-origin для
  unsafe V2 request; добавить cross-subdomain negative test;
- обновить browser-smoke session helper под актуальный AES-GCM cookie contract
  и вернуть строгий `test:browser:ci` в зелёное состояние;
- определить Prettier baseline: исключить immutable archive и отдельно
  отформатировать active source, чтобы repository-wide `format:check` стал
  честным gate;
- доставить исправление новой forward migration с Auth regression smoke.

Этот пункт не разрешает менять Auth/SMTP/JWT или применять migration без
read-only ShiDao sanity check и отдельного deployed-contour postflight.

## P0.2: завершить базовый teacher authoring

Цель — превратить рабочий технический редактор в уверенный ежедневный
инструмент преподавателя без изменения доменной модели.

- последовательно улучшить visual design и responsive layout Course workspace;
- добавить загрузку новых материалов из открытого существующего Course;
- улучшить выбор/поиск Components в palette;
- проверить все десять editors/renderers отдельными production-safe сценариями;
- добавить drag-and-drop только если он не ухудшает доступность и надёжность;
- определить поведение удаления Lesson/Course с понятным подтверждением;
- добавить autosave/draft feedback там, где это уменьшает риск потери ввода;
- сериализовать append Lesson/Component на owner parent, чтобы concurrent
  create не сталкивался по position и supported path всегда оставался dense;
- не делать AI обязательным для создания или редактирования Lesson.

Definition of Done:

- Course можно полноценно поддерживать после первоначального создания;
- teacher понимает видимость и Slide каждого Component без скрытых правил;
- keyboard/focus/dialog behavior проходит accessibility smoke;
- reload и повторный вход не меняют состояние.

## P0.3: OpenRouter lesson assembler

Цель — включить кнопку «Заполнить с помощью ИИ» без создания второй архитектуры
урока.

- server-only OpenRouter-compatible provider adapter;
- конфигурируемая модель, таймауты и отмена;
- structured planning output, валидируемый теми же Zod/registry contracts;
- вызовы только application service commands;
- preview предлагаемых изменений до применения при массовой генерации;
- idempotency и аудит IDs без private payload/secrets;
- понятная ошибка и возможность продолжить вручную;
- фактический token usage и quota ledger до появления платного ограничения.

MCP остаётся development adapter. Внутренний AI может переиспользовать его
tool definitions/contracts, но не обязан поднимать внешний MCP endpoint внутри
production web.

На этом этапе attachment может использоваться только как метаданные и явно
введённый teacher context. Нельзя писать «AI изучил файл», пока следующий
pipeline не вернул подтверждённый extracted text.

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

## P2: новая audience и learning identity

Текущие `teacher/parent/student/school/class` сохранены только для
compatibility login/profile flows. Новая модель проектируется отдельно:

- один `Account` на человека без глобального типа пользователя;
- независимый `LearnerProfile`;
- Guardian relation;
- Group и Course audience `none | learner_profile | group`;
- invitation/claim flow;
- миграция существующих identity данных отдельным планом.

До этого этапа Course Builder остаётся owner-only. Нельзя использовать старую
Class/School как новый parent Course только ради быстрого enrollment.

## P2: Session и live lesson

- `LessonSession` отделена от редактируемой Lesson;
- один Lesson можно проводить многократно;
- основной runtime cursor указывает на Student Screen Slide и не создаёт
  authored Step; внутреннее состояние интерактивного Component при
  необходимости хранится отдельно;
- teacher управляет learner screen по умолчанию;
- Realtime используется после явной authorization модели;
- результаты записываются как отдельные immutable learning events.

## P3: learning history, communication и product scale

- LearningRecord/LearningEvent и измеримые предметные progress models;
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
