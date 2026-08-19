# Copy-paste prompt: LA-M1 очные наблюдения преподавателя

Скопируйте текст ниже в новую Codex-сессию.

```text
Продолжи работу над ShiDao в /Users/user/Documents/shidao.

Цель этой сессии: полностью реализовать только LA-M1 из плана Learning Activity
System — быстрые наблюдения преподавателя во время очного проведения уже
существующего LessonRun. Детского learner runtime пока нет и создавать его в
этой задаче не нужно.

Перед изменениями обязательно прочитай полностью:

1. AGENTS.md
2. docs/project-state.md
3. docs/roadmap.md
4. docs/architecture/lesson-workflow-model.md
5. docs/architecture/learning-activity-system.md
6. docs/plans/learning-activity-system-implementation.md
7. docs/architecture/learner-identity-access-model.md
8. docs/database/current-schema.md
9. docs/database/migration-guidelines.md
10. docs/operations/v2-deployment-runbook.md
11. релевантные части supabase/schema/current-schema.sql

Сначала проверь git status и реальное текущее устройство Course Builder,
LessonRun, LearningRecord, teacher history, learner-safe projections и schema.
Не доверяй future docs как доказательству существующего кода. Сохрани все
посторонние изменения пользователя.

Реализуй такой пользовательский сценарий:

- преподаватель запускает scheduled LessonRun через существующий start flow либо
  возобновляет уже started LessonRun; observation writes разрешены только после
  `started_at`;
- режим «Проведение» показывает полный ordered list Components исходной Lesson,
  а не Slides и не новый Lesson Step;
- преподаватель выбирает текущий Component и подтверждает один короткий общий
  observable criterion — что именно learners сейчас должны сделать; полный
  navigator показывает и passive Components, но без критерия rating недоступен;
  UI может предложить editable draft из Component instruction, но teacher
  подтверждает его явно;
- после задания критерия напротив каждого ожидаемого learner можно одним
  нажатием отметить:
  - самостоятельно;
  - с помощью;
  - пока не получилось;
  - не наблюдал — это отсутствие/очистка draft observation;
- bulk action «Все самостоятельно» создаёт только черновик: преподаватель
  меняет исключения и явно подтверждает остальных действительно наблюдавшихся
  learners; одна bulk-команда сама по себе не является evidence;
- у отметки есть optional короткая private note;
- изменения сохраняются сразу, UI показывает pending/saved/error и reload не
  теряет данные;
- перед completion виден короткий summary наблюдений;
- completion не выводит из отметок автоматически attendance, needsRepeat или
  teacher report;
- после completion observations read-only и видны в teacher-owned Lesson/
  learner history.

Архитектурные ограничения:

- каноническая структура остаётся Course → Lesson → ordered Components;
- не добавляй Lesson Step, stepId, hidden root Step или второй component order;
- Student Screen Slides остаются только learner presentation projection;
- Homework остаётся отдельной Lesson surface;
- LessonRun не получает копию Lesson content и не превращается в LessonSession;
- LearningRecord остаётся компактным итогом Run: не добавляй в него responses,
  observations, events или generic metrics JSON;
- не создавай generic event lake и второй Component/activity registry;
- не добавляй в этот slice Course objectives, mastery, learner attempts,
  learner runtime, Realtime, AI, voice recording, TTS или adaptivity;
- не меняй существующие interactive Component payloads и не расширяй learner
  projection;
- teacher notes остаются private и не попадают subject/observer payload;
- component-level observation в LA-M1 является историей наблюдения, а не
  автоматически доказанным mastery.

Создай отдельный типизированный observation module/contract и необходимую
forward migration. Migration в этой задаче явно разрешена. Предпочтительный
минимальный data contract — одна текущая draft/final observation на
LearningRecord + source Component:

- связь с существующим learning_record;
- nullable FK на lesson_component;
- стабильный source component UUID-at-time;
- `component_position_at_time`, component type и bounded label-at-time:
  registry title + optional короткий canonical prompt excerpt;
- обязательный для rating короткий observable criterion-at-time: что именно
  teacher наблюдает у learners на этой activity opportunity;
- rating только independent / with_support / not_yet;
- отсутствие строки означает not_observed;
- `entry_method: direct | bulk_confirmed`; bulk UI draft не становится
  persisted observation до explicit confirmation;
- optional private note;
- observed_at, recorded_by_account_id, created_at, updated_at.

Сначала проверь current naming и deletion semantics, затем выбери точную
physical shape. Не копируй полный Component payload, placement, Slide или Lesson
snapshot. Не вводи table/field только потому, что оно перечислено в prompt,
если существующий audited contract позволяет проще сохранить те же инварианты.

Инварианты:

- observation recorder совпадает с
  `LearningRecord.recorded_by_account_id`, а доступ следует существующей
  LessonRun ownership/application-service boundary;
- Component принадлежит Lesson данного Run;
- LearningRecord принадлежит этому Run и ожидаемому learner;
- mutation разрешена только когда Run уже started и ещё не
  completed/cancelled;
- «не наблюдал» может удалить только draft observation открытого Run;
- cancel удаляет draft LearningRecords и связанные observations;
- completed LearningRecord и observation переживают удаление Lesson/Component
  благодаря compact at-time context;
- в LA-M1 correction разрешена только пока observation draft; post-completion
  superseding correction является отдельным later slice;
- absent learner нельзя финализировать с observation без явного исправления;
- concurrent save/completion не оставляют противоречивое состояние;
- identity merge/erasure, recorder scoping и существующие learner relations
  остаются корректными;
- чужой teacher не может прочитать или изменить observation.

React не обращается к таблице напрямую. API route является adapter над
application service, а repository соблюдает actor/RLS boundary. Development MCP
в этой задаче расширять не нужно.

UI должен быть пригоден для группы примерно из 10 учащихся на планшете:

- переиспользуй существующие LessonRun start/resume entry points и teacher
  Component renderers;
- добавь один focused observation workspace, а не новую навигационную систему;
- расширь существующие teacher-owned `RunHistoryList` и
  `LearnerHistoryDialog` для read-only history;
- не добавляй новые `/profile` tabs и learner-facing history в LA-M1;
- крупные быстрые controls;
- bulk action и exceptions без отдельной modal form на каждого learner;
- keyboard/focus/screen-reader semantics;
- понятное active Component и progress по Lesson;
- полный navigator показывает passive Components, но structured rating нельзя
  создать без явно подтверждённого observable criterion;
- никакой ложной mastery-индикации;
- понятный save/error/retry state.

Первая версия предназначена для очного урока при наличии интернета. Настоящую
network-offline очередь синхронизации не симулируй: это отдельный follow-up.

Production DB-first rollout этой LA-M1 migration явно разрешён только для текущей
ShiDao database и только после успешных проверок. До любой реальной DB write
выполни обязательную project-local read-only identity/schema sanity check,
положительно подтверди canonical ShiDao Account/Course/Lesson/Component/
LessonRun schema и сверяйся с `docs/operations/v2-deployment-runbook.md`. Не
используй случайный глобальный Supabase connection. Старые migrations не меняй.
Migration должна быть forward, additive и совместимой с ещё работающим web.
Вместе со schema change обнови:

- docs/database/current-schema.md;
- supabase/schema/current-schema.sql.

Обязательные проверки:

- migration и current-schema/RLS/ACL contract tests;
- domain/Zod contracts;
- repository/application service/API tests;
- auth, CSRF и cross-account denial;
- open/completed/cancelled Run behavior;
- denial observation write до `started_at` и без observable criterion;
- bulk draft → exceptions → explicit confirm → reload → completion;
- cancel cascade;
- Component from another Lesson denial;
- сохранение понятной history после удаления Component/Lesson;
- отсутствие private note в learner/observer projections;
- regressions Course → Lesson → Components, Slides projection, publication
  revisions, identity merge/erasure и compact LearningRecord;
- repository format check для затронутых файлов, git diff --check, typecheck,
  task-relevant tests и production build.

После реализации обнови в том же change:

- docs/project-state.md;
- docs/roadmap.md;
- docs/architecture/lesson-workflow-model.md;
- docs/architecture/learning-activity-system.md;
- docs/plans/learning-activity-system-implementation.md;
- schema docs/snapshot.

Используй честные CURRENT / NEXT / LATER статусы. Не объявляй LA-M2 objectives,
mastery, learner runtime, voice или offline sync реализованными.

Terminal condition: LA-M1 полностью работает на persisted data, проходит
проверки и documentation/schema snapshots синхронизированы. Production delivery входит
в задачу: новый DB contract применён и проверен, dependent web exact SHA
развёрнут, production API/browser postflight пройден. Не останавливайся на
плане, mock UI или одной migration, если нет реального блокера.

Порядок доставки для coupled DB+web change:

1. реализуй additive compatible slice, прогони все локальные проверки и
   внимательно проверь diff на scope, secrets и generated artifacts;
2. stage только файлы этой задачи и создай один описательный локальный commit;
3. зафиксируй checksum exact migration, выполни rollback rehearsal, создай и
   проверь production backup по current runbook;
4. примени exact migration к подтверждённой production ShiDao DB с
   stop-on-error, затем выполни DB/RLS/ACL/PostgREST postflight;
5. только после успешного DB postflight выполни обычный fast-forward push
   текущей `main`, дождись Coolify exact SHA и пройди API/browser smoke.

Если production DB нельзя положительно идентифицировать, безопасно применить
migration или проверить backup/postflight, не push зависимый web: сохрани
готовый commit локально и сообщи точный blocker. Не создавай PR, не force-push,
не переписывай историю и не восстанавливай backup без отдельного явного
решения.
```
