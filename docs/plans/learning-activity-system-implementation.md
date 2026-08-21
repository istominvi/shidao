# План реализации Learning Activity System

**Статус:** LA-M0 — CURRENT architecture; LA-M1–LA-M3 — CURRENT production;
LA-M4–LA-M5 — CURRENT production DB/source/web; P1.3 Homework authoring —
CURRENT production DB/source/web; LA-M6 — NEXT; LA-M7–LA-M9 — LATER.
**Актуально на:** 22 августа 2026 года
**Архитектура:**
[`learning-activity-system.md`](../architecture/learning-activity-system.md)

План намеренно разбит на небольшие vertical slices. Каждый этап должен давать
законченный пользовательский workflow, проходить проверки и не требовать
одновременного создания всей будущей модели.

## Постоянные правила

- authored hierarchy остаётся `Course → Lesson → ordered Components`;
- Slides не становятся Steps или вторым порядком;
- Homework остаётся отдельной Lesson surface;
- существующий code-first registry остаётся единственным registry;
- `LearningRecord` остаётся компактным итогом LessonRun;
- история ответов/наблюдений и вычисляемое состояние навыка разделены;
- manual authoring работает без AI;
- preview не пишет learner data;
- current/next/later не смешиваются в документации;
- каждый implementation milestone завершается production-ready кодом, docs и
  проверками.

## LA-M0 — канонизация решения (**CURRENT**)

**Статус:** выполнено этим documentation slice.

Результат:

- определены Definition, Instance, execution policy, Attempt, Evaluation,
  Teacher Observation, Evidence и Objective State;
- отделены content, survey, assessable activities и orchestration;
- зафиксирован compact historical envelope вместо полного Component snapshot;
- зафиксированы offline classroom, voice и pronunciation boundaries;
- определена последовательность от простых правил к адаптивным моделям.

Schema и runtime в LA-M0 не меняются.

## LA-M1 — очное проведение и быстрые наблюдения (**CURRENT**)

**Статус:** законченный production vertical slice. DB-first migration применена
с `COMMIT`; dependent source
`25d7855831273ff5feea14473c2870b729ac39b3` развёрнут Coolify deployment
`1001`; DB/HTTP/API/CSRF/browser postflight завершён 20 августа 2026 года.
Подробный execution record находится в deployment runbook.

Текущий implementation map:

- typed domain/contracts/repository/service:
  `src/modules/learning-activities/`;
- authenticated application adapter:
  `GET|PUT /api/v2/lesson-runs/[lessonRunId]/observations`;
- focused teacher workspace:
  `/courses/[courseId]/runs/[lessonRunId]` и
  `src/components/learning-activities/`;
- recorder-owned Lesson/Course/Learner history расширена отдельной observation
  projection; learner/observer safe projection не расширялась;
- additive forward contract:
  `20260819142602_learning_activity_foundation.sql`.

### Цель

Во время существующего LessonRun преподаватель быстро отмечает, как каждый
учащийся справился с текущим Component. Это полезно уже сейчас и не зависит от
отсутствующего детского learner runtime.

LA-M1 сохраняет историю component-level наблюдений, но ещё не объявляет их
objective mastery.

### Пользовательский сценарий

1. Преподаватель запускает scheduled LessonRun либо возобновляет уже started
   Run. Observation writes доступны только после `started_at`.
2. Режим «Проведение» показывает полный ordered list Components выбранной
   Lesson, а не только Slides.
3. Преподаватель выбирает текущий Component и подтверждает короткий общий
   наблюдаемый критерий: что именно учащийся должен сейчас сделать. Full Lesson
   navigator показывает и passive Components, но без критерия structured rating
   не создаётся. UI может предложить editable draft из Component instruction,
   но teacher подтверждает его явно.
4. После задания критерия напротив каждого ожидаемого учащегося доступно одно
   быстрое состояние:
   `самостоятельно`, `с помощью`, `пока не получилось`, `не наблюдал`.
5. Можно создать bulk-черновик «Все самостоятельно», изменить исключения и
   подтвердить оставшихся действительно наблюдавшихся learners.
6. Optional короткая private note сохраняется у конкретного наблюдения.
7. Видны `сохраняется / сохранено / ошибка`; reload восстанавливает данные.
8. Перед завершением LessonRun виден краткий summary наблюдений.
9. После completion наблюдения read-only и доступны в teacher-owned history.

### Минимальный data contract

Нужна отдельная типизированная сущность, логически
`LessonComponentObservation`:

- связь с существующим `LearningRecord` ожидаемого learner;
- nullable ссылка на source `LessonComponent`;
- стабильный source component UUID-at-time;
- `component_position_at_time`, component type и bounded label-at-time:
  registry title + optional короткий canonical prompt excerpt;
- обязательный для rating короткий `observable_criterion_at_time`, общий для
  текущей activity opportunity;
- rating: `independent | with_support | not_yet`;
- отсутствие строки означает `not_observed`;
- `entry_method: direct | bulk_confirmed`; bulk UI draft не становится
  persisted observation до explicit confirmation;
- optional private note;
- `observed_at`, recorder Account и timestamps.

Полный Component payload, placement, Slide, Lesson snapshot и event array не
копируются. Наблюдение связывается с `LearningRecord`, но не хранится в его JSON.

### Инварианты

- observation recorder совпадает с
  `LearningRecord.recorded_by_account_id`, а доступ следует существующей
  LessonRun ownership/application-service boundary;
- Component обязан принадлежать Lesson данного Run;
- LearningRecord обязан принадлежать этому Run и ожидаемому learner;
- изменение разрешено только когда Run started и ещё не completed/cancelled;
- cancel удаляет draft LearningRecords и связанные observations;
- completed observation переживает удаление Component/Lesson благодаря at-time
  полям;
- LA-M1 correction разрешена только пока observation draft; post-completion
  superseding correction является отдельным later slice;
- отсутствующий learner не получает observation при completion без явного
  исправления;
- teacher-private note не попадает в learner/observer safe projection;
- concurrent save/completion не создаёт противоречивое состояние;
- identity merge/erasure и recorder scoping остаются корректными.

### UI building blocks

- `RunObservationWorkspace`;
- `LessonComponentNavigator`;
- `LearnerObservationGrid`;
- `ObservationStatusControl`;
- `BulkObservationBar`;
- `ObservationSaveState`;
- `ObservationHistorySummary`.

Названия файлов не являются обязательными. Важны роли и отсутствие десяти
отдельных modal forms для группы.

LA-M1 переиспользует существующие start/resume entry points и teacher Component
renderers, добавляет один focused observation workspace и расширяет current
teacher Run/Learner history surfaces. Новые `/profile` tabs и learner-facing
history в этот slice не входят.

### Не входит

- Course objectives и mastery;
- learner screen/runtime, Realtime и attempts;
- true network-offline sync queue;
- AI, voice recording и TTS;
- изменение текущих interactive Component payloads;
- автоматическое изменение attendance, `needs_repeat` или teacher report.

### Definition of Done

- workflow удобен для группы примерно из 10 учащихся на планшете;
- scheduled Run нельзя размечать до явного start;
- passive Component без подтверждённого observable criterion не создаёт
  structured rating;
- bulk action и exceptions выполняются без открытия карточки каждого learner;
- saved data переживает reload;
- navigation использует только `lesson_component.position`;
- completed/cancelled Run закрыт для mutation;
- after-delete history остаётся понятной;
- cross-account read/write запрещён;
- learner/observer projections не содержат private notes;
- не появились Step, второй component order или content-bearing LessonSession.

### Проверки

- read-only DB identity/schema sanity до write;
- forward migration, RLS/ACL и current-schema snapshots;
- Zod/domain/application/repository tests;
- open/completed/cancelled Run и cancel cascade;
- cross-account и Component-from-another-Lesson denial;
- atomic bulk save и save-versus-completion race;
- bulk draft → exceptions → explicit confirm → reload → completion UI flow;
- deletion retention;
- identity merge/erasure and learner-safe projection regressions;
- Course/Lesson/Slides/publication/LearningRecord regressions;
- format, `git diff --check`, typecheck, targeted tests и build.

Изолированный DB workflow запускается через
`scripts/db-learning-activity-tests.sh` только на базе с точным именем
`shidao_learning_activity_test`; script fail closed при другом database/schema
identity и завершает fixture transaction через `ROLLBACK`. Concurrent
save-versus-completion проверяется отдельным
`scripts/db-learning-activity-concurrency-tests.sh`: реальные sessions
доказывают оба lock order исхода, а не имитируют race последовательными
statements одной transaction.

## LA-M2 — Course objectives и Component alignment (**CURRENT**)

**Статус:** законченный production vertical slice. DB-first apply/postflight,
exact source `014aee43bb82aa2ce486fe8e8f9d60ddc58c87c0`, Coolify deployment `1003` и
deployed-SHA HTTP/API/CSRF/browser guest smoke завершены.

Текущий implementation map:

- flat Course objectives, owner-scoped RPC/RLS и Component alignment:
  `20260820085049_learning_objectives_component_alignment.sql`;
- immutable publication snapshot V2 и V1/V2-compatible copy/duplicate:
  `20260820090529_course_publication_snapshot_v2.sql`;
- authenticated Course objective API и единый application service:
  `src/app/api/v2/courses/[courseId]/learning-objectives/` и
  `src/modules/course-builder/`;
- manual editor, AI и development MCP используют тот же service contract;
- единственный registry содержит optional `activityFacet`, learner-safe
  delivery и server-private evaluator projection;
- observation objective-at-time provenance и pure evidence-eligibility
  projection находятся в `src/modules/learning-activities/`.

### Цель

Преподаватель явно задаёт, какое проверяемое умение связано с Component.

### Scope

- Course-scoped `LearningObjective` с понятным title и optional description;
- для MVP — одна optional primary objective на Component;
- create/select/archive objective из обычного Component editor;
- optional `activityFacet` в существующем registry;
- activity role `practice | assessment | survey` только для поддерживаемых
  типов;
- definition-level contracts разделяют author/evaluator payload и learner-safe
  delivery shape; read-only learner runtime реализован в current production LA-M4,
  а current production LA-M5 добавляет response persistence/server evaluation
  только для `choice_quiz`;
- manual и AI используют один application contract;
- новая publication snapshot version копирует objective definitions и
  Component alignments с remap IDs; старые immutable revisions продолжают
  читаться без этих полей;
- новые teacher observations получают objective id/title-at-time;
- evidence eligibility требует observable criterion, independence/support и
  explicit confirmation; один bulk draft сам current state не меняет;
- старые component-only observations не переосмысливаются автоматически.

LA-M2 не создаёт learner attempts/evaluations, durable typed evidence,
objective state, mastery percentage или recommendations. Evidence eligibility
лишь классифицирует сохранённое наблюдение по objective alignment,
наблюдаемому критерию, подтверждению и уровню поддержки/самостоятельности; она
ничего не пишет в учебный профиль.

### Definition of Done

- objective нельзя связать с Component другого Course;
- archive не уничтожает alignment/history;
- форма использует обычный язык, а не технические schema fields;
- legacy Components продолжают читаться;
- старые immutable publication revisions продолжают работать;
- learner-safe delivery contract для assessable definition не допускает answer
  key, но ещё не создаёт execution records;
- registry остаётся единственным источником type capabilities.

### Выполненные compatibility и retention guarantees

- новая публикация строится как snapshot schema V2 с objective definitions,
  Component `primaryObjectiveRef`/`activityRole` и deterministic ID remap;
- immutable V1 revisions читаются и копируются без переписывания checksum или
  payload; V1 не может молча отбросить уже существующие LA-M2 данные;
- архивирование objective не разрывает существующие Component alignment и
  history, но новое назначение архивной objective запрещено;
- новые observations получают nullable live objective FK и стабильные
  objective ID/title-at-time; удаление live relation сохраняет at-time
  provenance, а прежние observations остаются с `NULL` без backfill;
- `practice | assessment | survey` разрешены только registry types, которые
  явно поддерживают соответствующую роль;
- learner-facing Student Screen/catalog projections строятся на серверной
  learner-safe projection и не содержат objective IDs, role metadata,
  evaluator config или answer keys.

### Production gate (**COMPLETE**)

DB-first часть выполнена: повторный read-only identity/schema sanity подтвердил
ShiDao PostgreSQL `15.8`, verified backup создан и проверен, обе exact
migrations завершились `COMMIT`, а RLS/ACL/RPC/FK/trigger/lock-order,
PostgREST visibility и unchanged legacy V1 snapshot прошли postflight без
production fixtures. Normal fast-forward `main` rollout, Coolify exact-image
verification и deployed-SHA HTTP/API/CSRF/browser guest smoke также завершены;
exact local strict production-mode suite прошёл `30/30`, включая mandatory
scenario `#29`. Authenticated production no-write editor smoke не выполнен из-за
отсутствия authenticated browser session и остаётся явно не заявленным.

## LA-M3 — учебный профиль: история, навыки, рекомендации (**CURRENT PRODUCTION**)

Application/API/manual UI доставлены deployed functional source по
зафиксированному ниже contract. Physical DB gate завершён: frozen migration
`20260820132725_learning_activity_profile_history_skills_recommendations.sql`
имеет `5335` строк и SHA-256
`a7e7dad7db4632f98cf0857597dae99b58cf653bd39ec57d0eb91f540c9793f8`.
Production-derived PostgreSQL `15.8` clone из source dump SHA-256
`6db636b32c1256efaf7b70321a031e3e93196788d265368561d4dbe239b456c1`
(`1801` restore-list entries) прошёл exact `COMMIT`, `85` functional
assertions, `11/11` LA races и identity functional/concurrency.

Verified production backup
`/root/shidao-db-backups/shidao-before-learning-activity-profile-20260821T002135Z.dump`
имеет size `1552941`, mode `600`, `1801` restore-list entries и SHA-256
`0d89e0be74aba44f20b0ee82ad5cafb6f887da1f55821350e84959a502f8a88e`.
Production owner apply завершился наблюдаемым `COMMIT`; postflight сохранил
canonical tuple `19/6/22/84/2/2/0/0`, publication
`1/9056/2832fcf2ee1a4c3ccdf01501fc4f60f3` и пустые LA-M3 relations `0/0/0/0`;
обе source LearningRecord сохранили empty correction/supersession metadata.
RLS `4/4`, `4` policies, ACL/RPC/security и `0` identity violations
подтверждены. PostgREST raw probes вернули anon
`401/42501` и service role `403/42501`; narrow service RPC достиг domain
`P0002` (`500`), а не schema-cache `PGRST202`.

Final production-head PostgreSQL `15.8` snapshot сгенерирован
`2026-08-21T00:25:53Z`: SHA-256
`a1768f22f829d58c01a5846b68cdb7be60a363ebb771869ed90fb83dd316cbc2`,
`29533` строки, `66` public tables и `235` functions; body побайтово совпадает
с snapshot, replayed из production-derived clone. Functional task commit
`6e3f97c230f688663abaa06a126a56d0d0e2c9c6` прошёл `893/893` unit/API,
`30/30` strict browser и build `73/73`, затем доставлен normal fast-forward
push `main` из `3582dc8` и Coolify deployment `1005`
(`bgw36mvk1fz6opacg080drx2`). Exact image/`SOURCE_COMMIT`, running container,
restart count `0` и production guest HTTP/API/CSRF/host postflight подтверждены.
Authenticated production no-write LA-M3 smoke недоступен и не заявляется;
последующий execution-record docs-only commit runtime не меняет.

### Цель

Разделить «что человек изучал» и «что система сейчас может осторожно сказать о
навыке».

### Scope

- **История:** Course → Lesson → Run → component/objective observations;
- **Навыки:** rebuildable state только из objective-aligned evidence;
- **Рекомендации:** простые versioned rules и понятные reason codes;
- freshness: давнее evidence помечается «нужно перепроверить», а не «забыл»;
- correction/merge/erasure запускают deterministic rebuild;
- AI получает bounded structured projection и может только объяснять или
  предлагать.

Первая state policy не использует скрытые веса или mastery percentage. Одно
наблюдение не делает objective «полностью освоенной».

### Зафиксированный vertical-slice contract

LA-M3 расширяет существующие recorder-owned LessonRun history и `/profile` /
`/students` surfaces. Он не создаёт второй профильный shell, новый activity
registry, `Lesson Step`, второй Component order или `LearningRecord.metrics`.
`/learning-profile` остаётся только compatibility redirect на `/profile`.

**История и correction.** Finalized `LearningRecord` и его observations остаются
append-only источником истины. Draft observation по-прежнему можно заменить или
очистить только пока Run фактически started и открыт. Исправление finalized
observation создаёт replacement `LearningRecord`, копирует все его immutable
at-time поля и observations, меняет только явно выбранную отметку/teacher-only
note, связывает старый и новый result/observation/evidence через reciprocal
supersession и сохраняет обязательные reason, actor, time и idempotency key.
Старый результат не обновляется in-place и остаётся в correction chain; active
history/state использует только несуперседированную вершину. Stable Course,
Lesson, Run, Component и objective provenance переживает удаление live-ссылок.
Старые LA-M1 observations с `NULL` objective остаются component-only history:
objective/evidence backfill для них запрещён.

**Durable `LearningEvidence` v1.** Одна immutable typed row материализуется в той
же транзакции, в которой parent result становится finalized, только если parent
`LearningRecord` и observation active/non-superseded, learner присутствовал,
objective ID/title-at-time и observable criterion заполнены, а entry method —
`direct | bulk_confirmed`. `independent` и `with_support` дают positive evidence
с разным support; `not_yet` даёт negative evidence, но не «нулевой процент».
Evidence хранит learner/recorder, stable Course/Lesson/Run/Component/objective
references, bounded at-time titles/label/criterion, direction/support,
observed/finalized/materialized times, source record/observation, evidence и
eligibility policy versions/reason code и supersession links. В нём нет полного
Component snapshot, private note, evaluator payload, произвольного event JSON
или `LearningRecord.metrics`. Migration материализует уже существующие eligible
finalized objective-aligned observations, но не строки с `NULL` objective.

**`objective-state-v1`.** Projection имеет controlled `asOf` clock, atomic
rebuild и один current row на recorder + learner + stable Course objective.
`no_data` синтезируется для доступной live objective без evidence; persisted
состояния имеют только `forming | confirmed | recheck_due`:

1. zero active evidence → `no_data / no_eligible_evidence`;
2. latest evidence `not_yet` → `forming / latest_not_yet`;
3. latest positive `with_support` → `forming / latest_with_support`;
4. latest independent positive, но меньше двух independent positives из двух
   разных stable LessonRun opportunities →
   `forming / independent_opportunities_missing`;
5. latest independent positive и как минимум две independent positives из двух
   разных stable LessonRun opportunities →
   `confirmed / multiple_independent_opportunities`;
6. тот же confirmed набор при `asOf >= latestEvidenceAt + 90 days` →
   `recheck_due / confirmed_evidence_stale`.

Равенство на freshness boundary намеренно включает `recheck_due`. Negative или
supported latest evidence никогда не подтверждает objective; одно observation
и несколько Components одного Run тоже не подтверждают её. Projection хранит
policy version, evaluated/last-evidence/freshness dates, public reason code и
детерминированный bounded набор evidence references, реально определивших
результат. Никаких процентов, score weights или скрытой статистики нет.

Rebuild полностью пересчитывает row и evidence links из active durable evidence,
делает atomic upsert и остаётся idempotent. Completion, correction, merge,
subject erasure и explicit policy rebuild используют общий ранний advisory lock
по отсортированным learner UUID, затем сортируют objective keys. Это исключает
duplicate/mixed-policy state и задаёт общий lock order для multi-session races.
Merge переносит evidence и explicit overrides на canonical target, исключает
superseded same-Run results и перестраивает target. Erasure включает все LA-M3
rows в fingerprint/locks и удаляет их до создания нового пустого subject profile.

**`recommendation-rules-v1`.** Базовая рекомендация является детерминированной
projection, а не scheduler:

- `latest_not_yet` → `repeat`;
- `latest_with_support` → `try_without_support`;
- единственная independent opportunity → `apply_in_new_context`;
- `confirmed` → `move_forward`;
- `recheck_due` → `recheck_freshness`;
- `no_data` → рекомендация отсутствует.

Каждая recommendation содержит source state, bounded evidence references,
versioned public rule/reason code, обычный русский reason text и generation
time. Teacher может явным manual action заменить или скрыть её и затем очистить
override; override хранит actor/time и private teacher reason, переживает reload
и rebuild, но learner/observer получает только standardized safe indication,
не private override note. Recommendation не меняет Lesson/Component/Slide order
и не создаёт очередь автоматического показа.

**Application/UI boundary.** Existing Course/Lesson/Learner history routes
получают teacher-only evidence/correction data через application service;
browser не пишет raw tables. Recorder видит Course → Lesson → Run → Observation
→ Evidence, отдельные skills/recommendations и correction/override actions в
существующем learner dialog/history. Self `/profile` и active observer в
`/students?tab=observing` получают отдельный strict learner-safe DTO с opaque
references, at-time labels, state/recommendation reason и evidence dates.
Private observation notes, override note, Account/recorder IDs, raw UUIDs,
policy inputs, evaluator data и internal reason payloads в safe DTO отсутствуют.
Revoked observer RPC повторно проверяет и блокирует active grant и fail closed;
UI очищает ранее загруженную projection после отказа.

**AI boundary.** LA-M3 добавляет новый additive versioned provider/RPC для
bounded logical read, не меняя strict existing shared-history v1 response во
время DB-first rollout. Перед ответом server-side RPC детерминированно обновляет
derived activity-state projection и пишет audit; модель не управляет этим
refresh и не получает прямого mutation action. Provider передаёт только bounded
history summary, safe objective state, public recommendation reason и opaque
permitted evidence references с жёсткими caps.
Private note, evaluator config, чужие raw recorder rows и unbounded history не
передаются. Evidence/state/recommendation/override отсутствуют в AI action union:
AI может объяснить или предложить следующий шаг как текст, но запись возможна
только отдельным application-service action после teacher confirmation. Manual
workflow полностью работает без AI.

### Definition of Done LA-M3

- correction сохраняет original finalized chain, а reload и удаление live
  Component/objective не теряют at-time history/evidence;
- durable evidence появляется только у finalized, present, eligible,
  objective-aligned и active observations; LA-M1 `NULL` objective остаётся
  history-only;
- fixed-clock policy точно различает positive/negative, independent/support,
  одну и несколько distinct LessonRun opportunities и 90-day freshness;
- synthesized `no_data` имеет nullable state ID/last-evidence, пустые evidence
  links и не показывает recommendation/teacher override action; persisted state
  остаётся только evidence-backed;
- rebuild повторяем, idempotent, policy-versioned и даёт тот же результат после
  correction, concurrent rebuild, merge и erasure; state не содержит mastery
  percentage;
- recommendation имеет state/evidence references, rule/reason code, русский
  reason text и persisted replace/dismiss/clear teacher override;
- recorder, subject и active observer получают только разрешённые projections;
  cross-account/cross-recorder/revoked-observer reads fail closed, private notes
  и internal evaluator/policy payloads не утекли;
- `/profile`, `/students` learner dialog, Course/Lesson/Run history и observer
  surface демонстрируют history/skills/recommendations без AI и восстанавливают
  данные/override после reload;
- AI projection ограничена по shape/size, не содержит private data и не имеет
  прямого mutation action;
- domain/Zod/repository/service/API/UI/schema tests, production-derived isolated
  clone functional suite, реальные rebuild/correction/merge/erasure races,
  strict browser regression, typecheck/lint/format/diff/full relevant tests и
  production build проходят до rollout;
- verified backup, exact owner migration и
  RLS/ACL/PostgREST/data-preservation postflight записаны в execution record;
  production fixtures не создаются;
- fast-forward `main`, exact Coolify SHA/image и production guest
  HTTP/API/CSRF/host/browser postflight записаны в execution record;
  authenticated production no-write LA-M3 smoke отдельно не заявляется из-за
  отсутствия authenticated browser session и не требует credentials/fixtures.

## Execution contexts

Learning Activity runtime не должен случайно смешать уже существующие и будущие
режимы:

| Context                        | Definition source                       | LA attempt/evaluation boundary                                                          |
| ------------------------------ | --------------------------------------- | --------------------------------------------------------------------------------------- |
| Teacher preview                | mutable Lesson Component                | preview-only; не пишет learner data                                                     |
| Current educator self-learning | immutable approved publication revision | текущие Lesson completions остаются progress-only; attestation использует свой contract |
| Child live LessonRun           | Lesson + Student Screen projection      | current production LA-M4; отдельный explicitly authorized learner context               |
| Homework authoring             | mutable Lesson-owned aggregate/items    | P1.3 current production DB/source/web; owner-only, без learner data                     |
| Issued Homework                | immutable issued Homework snapshot      | появляется в LA-M6                                                                      |

Обычные educator Course Components не становятся assessable attempts незаметно.
Их перевод на общий activity runtime требует отдельного совместимого slice;
current educator attestation при этом не переписывается задним числом.

## LA-M4 — learner authorization и live delivery (**CURRENT production DB/source/web**)

### Implementation state

Source vertical slice реализован в:

- migration
  `supabase/migrations/20260821093000_lesson_run_live_delivery.sql`;
- domain/Zod/repository/service/server boundary `src/modules/live-delivery/`;
- owner routes
  `src/app/api/v2/lesson-runs/[lessonRunId]/live-delivery/` и learner route
  `src/app/api/v2/me/live-runs/[lessonRunId]`;
- focused teacher Run workspace и learner `/live/[lessonRunId]` surface в
  `src/components/learning-activities/` и `src/app/(live)/`.

DB production gate завершён. Exact migration имеет `2535` строк и SHA-256
`7fb531bc199b8d6a24afeb1e01ff2730c8e5388a0cbbd233e2679d8e7825319c`.
Production-derived PostgreSQL `15.8` clone прошёл observed `COMMIT`, safe
drop/recreate rollback proof, unchanged replay, `134/134` functional assertions,
`26/26` LA races и identity functional/concurrency. Verified production backup
сохранён; production owner apply завершился observed `COMMIT`, сохранил
canonical/publication tuples и оставил LA-M4 relations `0/0/0`. RLS/ACL/
function-security и PostgREST raw-denial/narrow-RPC probes прошли.

Production snapshot `2026-08-21T07:56:01Z` из PostgreSQL `15.8` имеет `31440`
строк, `69` public tables, `248` functions и SHA-256
`15d4a432edf4737c189ab444699b15482c7dbb90b85eab4e1b6043f843b79f52`;
public body exact совпадает с clean clone/replay. Dependent functional
source `e09631d2fa00ad1c4b91ad0584392efb748cf235` доставлен normal
fast-forward push `9db3a1f..e09631d main -> main`. Coolify deployment `1007`
(`flg9786e15llusgj6kgz7pwk`) завершился `finished` с exact
image/`SOURCE_COMMIT`, running container, restart count `0` и чистыми runtime
logs. External/in-container guest/host/Origin/CSRF postflight, final DB
contract, retained backup и cleanup прошли. Independent final audit не нашёл
P0/P1/P2/blockers, secrets, leaks или unexpected generated artifacts.

Pre-rollout application gate прошёл: typecheck, lint без warnings/errors,
`936/936` unit/API, `31/31` strict production-mode Chromium и build `73/73`.
Безопасной existing authenticated production session/Run не было, поэтому
authenticated production UI smoke **NOT RUN** и не заявляется; credentials,
learners, Runs и fixtures не создавались. Локальный `31/31` покрывает
waiting/live/reload/reconnect/revoke/ended/privacy/mobile/accessibility, но не
подменяет этот production smoke. Это execution record LA-M4; LA-M5 стал current
только после собственного отдельного release ниже.

### Цель

Создать настоящий, явно авторизованный child learner execution context поверх
open LessonRun.

### Frozen authorization contract

Authority требует одновременно:

1. live authenticated Account/session;
2. его exactly-one canonical linked LearnerProfile;
3. active explicit `course_learner_enrollment` для Course;
4. active `lesson_run_execution_capability` для exact Run/profile, связанный с
   current enrollment revision;
5. фактически started и всё ещё open Run.

Course audience, frozen Run roster, Account/profile link, `teacher_learner`,
observer grant и AI consent сами по себе никогда не authority. Course
audience/groups также не prerequisite для explicit grant; exact frozen
LearningRecord roster row, active linked Account и явное teacher действие —
обязательны.
Browser не присылает Account или learner profile UUID для выбора subject:
service-only resolver начинает с trusted Auth `sub` + `session_id`, проверяет
`auth.sessions`, Account/session cutoff и только затем canonical profile и обе
capabilities.

Teacher может выдать Course access только active linked member frozen Run
roster. Course enrollment может быть выдан до start и переживает отдельный Run.
До start Course-only grant сохраняет exact-Run revoked tombstone, который не
является authority и нужен только для безопасного последующего revoke. Первый
actual start создаёт `NULL` presentation state и активирует tombstone либо
materialize-ит active per-Run capability только для active enrolled + linked
members exact frozen roster;
один enrollment или roster без второй строки доступа не даёт. Для Run, уже
actual-started до migration, teacher явно включает Run capability через focused
workspace. Scheduled Run остаётся недоступным. Revoke Course access
инвалидирует все его active Run capabilities. Course archive делает то же
автоматически; повторная выдача создаёт новую revision и не оживляет stale
capability. Audience/group membership не участвует в grant и её изменение не
создаёт, не отзывает и не переносит explicit authority. Смена Course owner
блокируется до explicit revoke всех active enrollments прежним owner.

Source-profile merge/erasure удаляет enrollment/capability через canonical FK
cascade и не переносит authority на target/new profile. Safe unlink оставляет
старый profile offline, Account-link-change trigger отзывает его grants, а
Account получает новый пустой canonical profile без доступа. Session
logout/revocation и
`account_security.sessions_invalid_before` проверяются на каждом learner read,
поэтому доступ прекращается без ожидания UI reload.

### Frozen Run/cursor lifecycle

- `scheduled`, not-actual-started и cancelled-before-start не дают learner
  delivery или active Run authority; revoked tombstone сам по себе не
  capability доступа;
- actual-started open Run начинается с persisted `NULL` cursor revision `0` —
  learner видит waiting;
- teacher выбирает current non-empty Student Screen Slide через CAS
  `expectedRevision`; mismatch даёт deterministic conflict и никогда не
  откатывает более новый cursor;
- reload, reconnect и bounded polling читают persisted cursor заново; Realtime
  в первом slice отсутствует;
- удаление выбранного Slide атомарно ставит `NULL` и увеличивает revision;
  reorder сохраняет stable Slide identity и берёт current Slide/Component
  positions; пустой или переставший быть learner-visible Slide fail closed в
  waiting;
- completion/cancel возвращают ранее авторизованному learner terminal `ended`;
  capability не превращает закрытый Run обратно в live;
- cursor хранит только presentation state. Attempts, responses/evaluations и
  future activity execution state хранятся отдельно и не меняют authored
  Component/Slide order или compact `LearningRecord`.

### Frozen learner projection и UX

Learner получает только текущий Slide и его `learner_visible` Components в
relative canonical Lesson order. Registry serializer повторно валидирует
schema version, строит learner delivery, исключает server evaluator fields,
подменяет StoredFile IDs response-scoped refs и выдаёт только opaque
same-origin asset URLs. Каждый asset GET повторно проверяет session, explicit
Course/Run authority, current cursor и exact revision, затем server-side
проксирует bytes без redirect, signed token или Storage path. Projection fail
closed при неизвестном/unsafe payload.

Никогда не выдаются `staff_only`, другие Slides, Lesson summary/teacher
comments, answer keys/evaluator config, objective IDs/activity role, Account/
profile/Component/Slide/StoredFile authority IDs, private fields или raw unsafe
JSON. Run UUID уже является частью открытого learner route и повторяется только
в его same-origin asset URL; он не даёт authority. Synthetic component keys и
asset refs также не являются authority.

Teacher controls находятся внутри focused Run workspace. Learner surface имеет
явные loading, waiting, reconnecting, denied/reauthentication и ended states,
не показывает prev/next navigation, responsive на phone/tablet/desktop,
keyboard/focus/screen-reader friendly и отключает необязательное движение при
`prefers-reduced-motion`.

### Definition of Done — production execution record

- **DB COMPLETE:** migration прошла exact production-derived clone
  apply/rollback,
  functional lifecycle/ACL tests, multi-session access/cursor races и все
  identity functional/concurrency regressions;
- **DB COMPLETE:** raw Data API для трёх LA-M4 tables закрыт, узкие RPC имеют exact grants,
  `SECURITY DEFINER`, пустой `search_path` и внутренние actor/capability checks;
- **APP PRE-ROLLOUT COMPLETE:** typecheck, lint, `936/936` unit/API, `31/31`
  strict production-mode browser teacher+learner/outsider flow и build `73/73`;
- **FORMAT/DIFF COMPLETE:** Prettier по восьми LA-M4 Markdown-файлам и
  full-worktree `git diff --check` прошли после final execution-record edits;
- **FINAL AUDIT COMPLETE:** P0/P1/P2/blockers отсутствуют; scope, secrets,
  generated artifacts и learner privacy boundary зелёные;
- **DB COMPLETE:** до production apply создан verified backup; после него
  обновлены
  `docs/database/current-schema.md` и
  `supabase/schema/current-schema.sql`, фиксируются exact counts/checksums;
- **ROLLOUT COMPLETE:** normal fast-forward `main`, exact SHA/image/
  `SOURCE_COMMIT`, running container/restarts/logs, guest HTTP/auth/CSRF/host
  smoke, cleanup и retained backup подтверждены;
- **EXPLICITLY UNCLAIMED:** authenticated production UI smoke не выполнялся без
  безопасной existing session/Run; production fixtures не создавались.

LA-M4 boundary намеренно не реализует attempt/evaluation. Отдельный LA-M5
добавляет их только для `choice_quiz`; LA-M6 Homework/`free_response` остаётся
NEXT.

## LA-M5 — первый полный online activity: `choice_quiz`

(**FROZEN CONTRACT; CURRENT production DB/source/web**)

**Статус:** implementation contract заморожен, production DB apply/postflight и
production-generated snapshot завершены. Application/API/UI доставлены exact
release commit `b8f62a635ad3bd77933e71decffe2a5616de26d5` в `main` и
`origin/main`; LA-M5 является **CURRENT production DB/source/web**.

Production execution record:

- migration применена с наблюдаемым `COMMIT`; snapshot PostgreSQL `15.8`
  содержит `74` public tables, `275` functions, пять quiz tables и `35466`
  строк, file/normalized SHA-256 зафиксированы в current-schema/runbook;
- final gate: `991/991` unit/API, `31/31` strict Chromium, build `73/73`,
  typecheck/lint/format/diff-check green;
- основной Coolify deployment `1009` (`cpeh1gokla9hpng8z57woj96`); после
  исправления отсутствующего `www.shidao.ru` в Coolify Domains выполнен config
  redeploy `1010` (`m7depyulpqt0ka943ewajt10`);
- final container `g9x4d9zn60jv35r7zf0xl6xj-162236082905` running с restart
  count `0`, matching `SOURCE_COMMIT` и image ID
  `sha256:1458de67a667584f4863ad712ed25d64bb59ede12faba9f52959fe4424ce9045`;
  checked logs и external/container-local host/API/CSRF/guest probes green,
  `www.shidao.ru` имеет valid TLS и `302` на `https://shidao.ru/login`;
- authenticated production teacher/learner lifecycle **NOT RUN**: safe existing
  session/Run не было, production credentials/fixtures не создавались. Это не
  failure/blocker, local Chromium не подменяет этот evidence;
- disposable clone/temp files удалены, production backups сохранены.

### Цель

Один существующий тип проходит весь реальный путь вместо одновременной
реализации десятка упражнений.

```text
manual/AI authoring
→ learner-safe delivery
→ persisted attempt/response
→ server evaluation
→ feedback
→ compact history envelope
→ evidence
→ profile projection
```

Это один законченный engine для existing `choice_quiz`, а не предварительная
generic abstraction для остальных deterministic activities.

### Frozen issued-delivery и privacy contract

1. Перед learner display server идемпотентно создаёт или возвращает persisted
   immutable `choice_quiz_issue` для learner + exact LessonRun + stable
   Component definition/revision. Повторный live poll не создаёт новую issue.
2. Issue хранит exact question, фактически показанные choices в shown order,
   public definition revision, private evaluator config, policy/evaluator
   versions и stable Course/Lesson/Run/Component/objective context. Full
   Component/Slide/placement/layout snapshot не хранится.
3. Learner DTO содержит opaque non-UUID `issueRef`, public
   `definitionRevision`, learner-safe question/options и public policy state.
   Raw stable Component/objective/profile/Account UUID, correct-answer config,
   evaluator config и authority metadata остаются server-only. UUID option IDs
   являются content IDs, а не authority.
4. Component edit создаёт новую definition revision и новую issue. Старые
   issue/attempt/evaluation rows остаются понятными после edit/delete source
   Component.

### Frozen submit и idempotency contract

Browser submit имеет strict shape:

```text
issueRef: opaque non-UUID string
cursorRevision: nonnegative integer
idempotencyKey: UUID
selectedOptionIds: unique UUID array
```

Другие поля запрещены. Browser не присылает Account/LearnerProfile UUID,
correctness, score, evaluator result, objective или source Component ID.

Server нормализует `selectedOptionIds` как set и проверяет, что каждый ID
существует в exact issue. Deterministic evaluation использует exact-set match:
selected set должен полностью совпасть с correct set. Результат бинарный,
`score = 0 | 1`; partial credit отсутствует.

Одинаковый `idempotencyKey` + тот же нормализованный
`issueRef/cursorRevision/selected set` возвращает persisted result. Тот же key с
другим нормализованным request даёт conflict и не создаёт Attempt, Evaluation
или Evidence. Deliberate retry использует новый key и создаёт новый append-only
Attempt; предыдущий Response/Evaluation не переписывается.

### Frozen practice/assessment policy

- `activity_role = NULL` означает presentation-only. Только
  `practice | assessment` executable.
- Practice: максимум три Attempts; immediate correctness; retry только после
  incorrect attempt 1 или 2. Correct answer и authored explanation раскрываются
  только после correct Attempt либо после exhausted third Attempt.
- Assessment: ровно один Attempt; immediate correctness и score; answer key,
  explanation и retry не возвращаются никогда.
- Hint field отсутствует в current `choice_quiz` author schema. Поэтому M5
  возвращает/хранит `hintAvailable = false`, `hintCount = 0` и не создаёт
  скрытый hint API.
- Missing, archived или noncurrent objective не блокирует issued attempt,
  Evaluation и разрешённый feedback, но делает Evidence ineligible для
  learner-state update.
- Первый Attempt одной issue — independent. Второй/третий practice Attempt
  support-qualified. Несколько Attempts одного LessonRun остаются одной stable
  objective opportunity и не могут сами подтвердить mastery.

Feedback Delivery хранится отдельно от Evaluation: correctness, answer reveal
и explanation имеют собственный immutable policy envelope и timestamp
устойчивой доступности. Это не HTTP/read receipt; Evaluation и delivery row не
считаются доказательством того, что learner увидел feedback.

### Evaluator, evidence и correction

- Evaluator имеет frozen version. `evaluatorFingerprint` — SHA-256 canonical
  versioned private config с correct option IDs и schema/policy versions.
  Reproducibility source хранится в immutable issue и никогда не выдаётся
  learner.
- Одна DB transaction выполняет actor/capability recheck, idempotency,
  Attempt/Response, Evaluation, Feedback Delivery, eligible typed Evidence и
  deterministic profile/objective-state refresh. Partial success запрещён.
- Online Evidence расширяет existing LA-M3 typed pipeline, а не имитирует
  Teacher Observation, не попадает в `LearningRecord.metrics` и не создаёт
  generic event JSON.
- Correct first Attempt с current objective может дать positive independent
  evidence, incorrect — negative; later practice success остаётся
  support-qualified. Versioned learner-state update gate учитывает role,
  objective validity, hint/reveal/support и source Run opportunity. Один
  правильный ответ не означает mastery.
- Correction требует explicit teacher action, reason и idempotency key. Она
  добавляет superseding Evaluation и superseding Evidence, затем rebuild, но не
  меняет Attempt/Response/original Evaluation. Уже сделанный доступным learner
  feedback сохраняется как historical policy audit.

### Lifecycle, concurrency и retention

Submit в установленном lock order повторно разрешает trusted Auth/session →
canonical profile → active Course enrollment → exact active Run capability и
проверяет actual-started open Run, current cursor revision, current
Slide/Component и exact current issued definition.

Cursor change, revoke/Course archive, completion/cancel, Component edit/delete
и submit сериализуются. Первая committed valid operation определяет state;
проигравший submit получает stale/denied без activity write, а проигравшая
cursor/lifecycle mutation не переписывает committed Attempt. Network retry с
тем же idempotency key безопасно читает committed result.

Compact activity history переживает source Component edit/delete. Identity
merge переносит learner lineage на тот же canonical target, который использует
LearningRecord, дедуплицирует согласно stable source/idempotency contracts и
запускает rebuild; enrollment/Run authority на target не переносится. Subject
erasure каскадно удаляет все связанные issue/Attempt/Response/Evaluation/
Feedback/Evidence rows. До erasure либо будущей отдельной explicit retention
policy данные хранятся вместе с learner history.

### Authoring и runtime UI

- Manual `choice_quiz` editor остаётся canonical. AI creation/editing
  включается только для `choice_quiz` через existing registry, planner output,
  preview validation и explicit teacher Apply. AI не может писать Attempts,
  Evaluations, Evidence или profile state.
- Teacher preview и обычный Course preview остаются no-write.
- Bounded Course AI activity projection привязана к exact server-decoded
  Supabase session: secure service-role overload принимает Auth user/session/
  Course, повторно проверяет live session и cutoff после learner advisory, а
  rolling двухаргументный overload всегда fail closed.
- LA-M5 live UI реализует instruction, radio/checkbox choice, submit/checking,
  разрешённый policy feedback/reveal/retry и retryable network error без потери
  selection/idempotency key. Reload читает persisted issue/attempt state.
- Keyboard/focus/screen-reader announcements, touch targets, zoom,
  phone/tablet/desktop и reduced motion обязательны. Passive/media Components и
  все остальные activity types сохраняют LA-M4 presentation-only behavior.

### Обязательно сохраняется

- exact question/instruction shown;
- relevant shown choice IDs/text в exact shown order;
- selected IDs и server-resolved text;
- correctness и binary score;
- attempt number, `hintAvailable=false`, `hintCount=0`, reveal и support level;
- evaluator/policy/schema versions, fingerprint и private evaluator config at
  time в immutable issue;
- source Course/Lesson/Run/Component/objective/definition context и timestamps;
- idempotency, supersession и durable feedback-availability/policy-envelope audit.

Полный layout/Component snapshot не копируется. Ключ ответа не отправляется
learner. Изменение teacher question после попытки не делает старый результат
непонятным.

P1.3 rollout завершён. Продуктовый этап **NEXT** — LA-M6 immutable Homework issuance/review и
`free_response`. Shared deterministic engine для `fill_blanks`, matching/
sequence/categorize/word-bank/word-builder относится к более позднему
расширению activity catalog.

## P1.3 — persisted Homework authoring (**CURRENT production DB/source/web**)

Current production DB добавляет максимум один mutable Homework aggregate на
Lesson и отдельный ordered список items. Он переиспользует schema V1 четырёх
allowlisted типов единственного registry: `rich_text`, `image`,
`external_link`, `file`.

- owner-only `GET/PUT/DELETE /api/v2/lessons/[lessonId]/homework` работает через
  application service/repository и authenticated owner RPC;
- `PUT` атомарно заменяет полный список по `expectedRevision`, а порядок
  выводится из ordinal входного массива;
- clear удаляет items, сохраняет пустой aggregate и повышает revision, закрывая
  ABA для stale clients;
- archived Course сохраняет aggregate/items, но owner read/mutation fail closed;
- Lesson delete блокирует Homework после Lesson и каскадно удаляет
  aggregate/items;
- preview read-only; assignment, issuance, due/override, answers/attempts,
  review, `free_response`, evidence/profile updates, notifications, LessonRun и
  Student Screen effects отсутствуют.

Base и mandatory forward-only direct-RPC validation repair migrations прошли
production-derived rehearsal, verified backup, DB apply/postflight и snapshot.
Exact source push, web deploy/image и postflight ещё pending и заполняются
только после фактического выполнения.

## LA-M6 — Homework и `free_response` (**NEXT**)

LA-M6 начинает с immutable issuance mutable P1.3 Homework и добавляет
learner authorization, assignment state, responses/attempts и review. Issued
snapshot переиспользует activity/evaluator primitives единственного registry,
но больше не зависит от последующего редактирования authoring aggregate.

Первый review workflow:

- autosave draft;
- final submit;
- teacher rubric/review;
- return for revision;
- comments;
- superseding evaluation;
- evidence/profile update.

Homework не становится group внутри `lesson.components` и не смешивается с
LessonRun.

## LA-M7 — голосовые заметки преподавателя (**LATER**)

- только explicit push-to-talk;
- speech-to-text;
- parser предлагает learner/component/objective/status/note;
- неоднозначное имя требует выбора;
- teacher подтверждает/исправляет draft до сохранения;
- после подтверждения используется тот же observation service;
- continuous classroom recording, hidden recording и voice identification
  детей не входят.

## LA-M8 — языковое аудио (**LATER**)

1. TTS reference audio как teacher-approved versioned asset.
2. Запись learner response.
3. Manual teacher rubric и feedback.
4. AI transcription/evaluation proposal с teacher confirmation.
5. Specialized pronunciation scoring только после benchmark.

Для китайского раздельно рассматриваются content, initials/finals, tones и
prosody. Единственный необъяснимый pronunciation percentage не используется.

## LA-M9 — advanced adaptivity и новые recipes (**LATER**)

Простые transparent recommendations с reason codes уже принадлежат LA-M3. После
доказательства online/review engines добавляются:

1. spaced review после проверки evidence quality;
2. advanced deterministic sequencing;
3. statistical models только после evidence-quality audit.

Worked example, example completion, self-explanation, error analysis, retrieval
card, scenario application, transfer challenge, confidence calibration и exit
ticket строятся из общего activity kernel. Gate/review queue/recommendation не
становятся Lesson Steps.

## Осознанно не делать заранее

- глобальный skill graph;
- complex evidence weights;
- generic `learning_event` JSON lake;
- `LearningRecord.metrics`;
- continuous classroom recording;
- automatic high-stakes pronunciation/essay verdict;
- hidden AI course restructuring;
- dozens of new runtime types;
- xAPI/QTI/Caliper как внутренний domain model.

## Правило перехода к следующему milestone

Следующий этап начинается только когда предыдущий:

1. работает на реальных persisted данных;
2. имеет manual UX;
3. защищён actor/learner/observer boundaries;
4. переживает reload/deletion и имеет явную correction policy;
5. имеет contract и user-flow tests;
6. обновил project-state, roadmap, canonical docs и schema snapshots;
7. доставлен обычным fast-forward push по правилам `AGENTS.md`.

Copy-paste задание для LA-M1 находится в
[`learning-activity-foundation.md`](../prompts/learning-activity-foundation.md).
