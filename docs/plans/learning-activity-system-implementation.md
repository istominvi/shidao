# План реализации Learning Activity System

**Статус:** LA-M0–LA-M1 CURRENT; LA-M2–LA-M6 NEXT; LA-M7–LA-M9 LATER
**Актуально на:** 20 августа 2026 года
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

## LA-M2 — Course objectives и Component alignment (**NEXT**)

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
  delivery shape; реальный learner runtime и server evaluation остаются LA-M4/
  LA-M5;
- manual и AI используют один application contract;
- новая publication snapshot version копирует objective definitions и
  Component alignments с remap IDs; старые immutable revisions продолжают
  читаться без этих полей;
- новые teacher observations получают objective id/title-at-time;
- evidence eligibility требует observable criterion, independence/support и
  explicit confirmation; один bulk draft сам current state не меняет;
- старые component-only observations не переосмысливаются автоматически.

### Definition of Done

- objective нельзя связать с Component другого Course;
- archive не уничтожает alignment/history;
- форма использует обычный язык, а не технические schema fields;
- legacy Components продолжают читаться;
- старые immutable publication revisions продолжают работать;
- learner-safe delivery contract для assessable definition не допускает answer
  key, но ещё не создаёт execution records;
- registry остаётся единственным источником type capabilities.

## LA-M3 — учебный профиль: история, навыки, рекомендации (**NEXT**)

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

## Execution contexts

Learning Activity runtime не должен случайно смешать уже существующие и будущие
режимы:

| Context                        | Definition source                       | LA attempt/evaluation boundary                                                          |
| ------------------------------ | --------------------------------------- | --------------------------------------------------------------------------------------- |
| Teacher preview                | mutable Lesson Component                | preview-only; не пишет learner data                                                     |
| Current educator self-learning | immutable approved publication revision | текущие Lesson completions остаются progress-only; attestation использует свой contract |
| Child live LessonRun           | Lesson + Student Screen projection      | появляется в LA-M4; отдельный authorized learner context                                |
| Homework                       | immutable issued Homework snapshot      | появляется в LA-M6                                                                      |

Обычные educator Course Components не становятся assessable attempts незаметно.
Их перевод на общий activity runtime требует отдельного совместимого slice;
current educator attestation при этом не переписывается задним числом.

## LA-M4 — learner authorization и live delivery (**NEXT**)

### Цель

Создать настоящий, явно авторизованный child learner execution context поверх
open LessonRun.

### Scope

- learner access/enrollment capability для конкретного Course/Run;
- teacher-controlled cursor указывает на persisted Student Screen Slide;
- learner видит только assigned `learner_visible` Components;
- teacher-private fields и answer keys отсутствуют в delivery payload;
- обычные request/polling достаточно для первого slice; Realtime — follow-up;
- free learner navigation не включается по умолчанию.

Activity response state хранится отдельно от presentation cursor и не меняет
authored Component/Slide order.

## LA-M5 — первый полный online activity: `choice_quiz` (**NEXT**)

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

### Обязательно сохраняется

- exact question/instruction shown;
- relevant shown choices;
- selected id и text;
- correctness/score;
- attempts, hints, reveal и support level;
- evaluator version/fingerprint и server-private evaluator-config-at-time
  (например, correct option IDs/normalization), либо обязательная ссылка на
  immutable issued definition revision;
- source Course/Lesson/Component/revision context и time.

Полный layout/Component snapshot не копируется. Ключ ответа не отправляется
learner. Изменение teacher question после попытки не делает старый результат
непонятным.

После `choice_quiz` shared deterministic engine доказывается на `fill_blanks`,
затем на matching/sequence/categorize/word-bank/word-builder.

## LA-M6 — Homework и `free_response` (**NEXT**)

Homework получает собственный ordered owner/items, authorization и immutable
issued snapshot, но переиспользует activity/evaluator primitives единственного
registry.

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
