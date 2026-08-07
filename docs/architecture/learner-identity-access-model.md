# Learner identity and access model

**Статус:** canonical V2 architecture для учебной identity, teacher directory и
learning history

**Дата решения:** 7 августа 2026 года

**Область:** LearnerProfile / TeacherLearner / LearnerGroup / Course audience /
LearningRecord / AI context / будущий learner access

**Implementation state:** deployed release `757044c` реализует physical
relation, backfill, RPC/RLS и teacher read model. Точный running image и
postflight всегда сверяются по `docs/project-state.md`; будущие разделы этого
документа не доказывают наличие schema/API в production.

## Product decision

`LearnerProfile` обозначает одного учащегося в образовательной памяти ShiDao.
Он больше не принадлежит конкретному преподавателю. Контекст работы конкретного
преподавателя хранится в отдельной связи `TeacherLearner`.

```text
Account (преподаватель)
└── TeacherLearner 0..N
    ├── local display name
    ├── active | archived для этого преподавателя
    └── LearnerProfile
        └── LearningRecord 0..N
            └── recorded by Account

Account (сам учащийся, позже после claim)
└── LearnerProfile 0..1 через nullable unique account_id
```

Это разделяет три разных факта:

- `learner_profile` отвечает на вопрос «о каком человеке накапливается учебная
  история?»;
- `teacher_learner` отвечает на вопрос «с каким учеником работает этот
  преподаватель и как он называет его в своём справочнике?»;
- `learning_record.recorded_by_account_id` отвечает на вопрос «кто зафиксировал
  это наблюдение?».

Один и тот же canonical profile сможет позднее быть связан с несколькими
преподавателями без копирования учебной identity. Текущий slice не пытается
угадать такие совпадения и не объединяет существующие профили автоматически.

## Target completion contract — next, not current

Целевая модель фиксирует договорённости для следующей реализации и не является
описанием уже доступного UI.

### Один Account без глобальной роли

- `Account` — единственная login identity.
- В active V2 нет взаимоисключающих ролей Teacher/Parent/Student/Observer.
- Любой Account может одновременно владеть Course, работать с учениками,
  учиться сам и наблюдать несколько других LearnerProfile.
- «Преподаватель» означает, что Account владеет Course и/или имеет
  `teacher_learner`; «наблюдатель» означает active read-only access grant. Это
  отношения и capabilities, а не типы пользователя.
- Каждый active Account после bootstrap имеет ровно один linked canonical
  LearnerProfile. Offline LearnerProfile продолжает существовать с
  `account_id IS NULL` до claim. Это превращает правило «один Account — один
  учебный профиль» в проверяемый invariant, а не только unique upper bound.
- Invariant обеспечивается в DB: Account и profile создаются атомарно, deferred
  constraint trigger или эквивалентная transaction-safe проверка требует ровно
  один profile на commit, а direct unlink/delete запрещён. Bootstrap, merge и
  reset используют lock-safe RPC; postflight проверяет нулевое число active
  Account без ровно одного profile.

### Добавление ученика и claim

Product flow «Добавить ученика» сначала предлагает безопасно подключить
существующий Account и только затем создать offline profile.

- Основной способ discovery — rotating one-time share code/QR; opt-in exact
  handle допустим с rate limit. Fuzzy search по имени запрещён. Код только
  создаёт pending connection request и никогда сам не активирует relation.
- Email создаёт blind invitation и не сообщает, зарегистрирован ли адрес.
- Teacher connection становится active только после consent получателя.
- Offline profile получает expiring one-time claim link. Teacher не создаёт
  пароль и не заполняет `account_id` от имени учащегося. Claim invitation всегда
  recipient-bound к verified email digest или target Account; unbound bearer
  claim запрещён.
- Для offline learner без email recipient может активировать отдельный
  provisional learner Account и задать ему unique login + PIN/password через
  Account credential/recovery boundary. Уже открытый Account взрослого никогда
  не используется как learner merge target; observer request оформляется
  отдельно. Teacher не получает secrets, а provisional Account/profile
  активируются атомарно.
- Token хранится только как digest, является one-time, revocable и auditable.
- Email invitation привязан к digest verified адреса либо конкретному recipient
  Account и не может быть перепривязан после accept. Claim screen явно сообщает,
  что пользователь подтверждает отдельную identity учащегося; другой Account
  получает generic fail-closed response.
- Если Account уже имеет canonical profile, claim обязательно переходит в
  merge preview; второго active profile у Account не появляется.
- Pending invitations не входят в Course audience.

### Physical canonical merge

Merge физически переносит active data в один target profile и удаляет source
profile row. Старый UUID сохраняется только в immutable alias/lineage metadata
для idempotency, audit и разрешения старых ссылок.

- Обычный target — linked profile Account, подтвердившего claim/merge; source
  обязан быть unclaimed. Claimed → claimed merge запрещён в этом scope и требует
  отдельного dual-reauth/dual-consent recovery процесса.
- Teacher relations, group membership и Course audience дедуплицируются. Если
  один teacher связан с обоими profiles, target name сохраняется, relation
  active при хотя бы одной active связи, а source name остаётся только в private
  merge audit.
- Unclaimed source не может иметь observer/AI grants; неожиданное наличие fail
  closed, а target grants не изменяются.
- LearningRecord переносятся с неизменным recorder и timestamps.
- Конфликт двух finalized records одного LessonRun всегда показывается в
  preview. Primary сохраняет `lesson_run_id`; losing record переносится в target
  с `lesson_run_id = NULL` и `superseded_by_record_id = primary.id`. Его
  pedagogical/provenance поля сохраняются, metadata-only conflict audit хранит
  record IDs, исходный LessonRun ID и resolution, а history/progress/AI
  исключают superseded record.
- Open/draft Run, stale preview, concurrent merge, cycle и merge чужих claimed
  profiles должны fail closed. Пользователь сначала завершает/отменяет Run и
  finalize/discard draft; rejected merge ничего в них не меняет.
- Auto-merge по имени, email, телефону или похожести запрещён.
- До merge claim можно cancel без mutation. Subject-only unlink допустим только
  для ошибочной direct link без merge lineage, records и dependent grants; в той
  же transaction Account получает новый пустой profile. После physical merge
  generic split/unlink запрещён: данные source уже смешаны с target, а erasure
  всей lineage не является undo.

### Observer и self access

Observer — Account с отзываемым read-only grant на конкретный LearnerProfile.

- Только Account, связанный с profile через `learner_profile.account_id`, может
  выдать или отозвать observer access.
- Teacher relation никогда не создаёт observer access автоматически.
- Один Account может наблюдать несколько profiles; один profile может иметь
  несколько observers.
- Subject может дать связи свободную подпись вроде «мама», «бабушка» или
  «тренер». Это только display label и никогда не участвует в authorization.
- Recipient может принять/отклонить invitation и отказаться от собственного
  observer access; это lifecycle своей relation, а не право менять учебные
  данные.
- Subject/observer видят finalized attendance, repeat, titles-at-time,
  actual-duration/progress и только comments с explicit
  `shared_with_learner_at` всей canonical lineage. Existing comments остаются
  private после migration. Completion UI
  обязан называть явное действие «Комментарий в учебный профиль» и объяснять
  преподавателю видимость до публикации.
- Это сознательная privacy-граница: recorder-scoped AI teacher может использовать
  собственные private comments, но self/observer/cross-provider projection —
  только explicit shared comments.
- Observer не видит drafts, непубличные comments, recorder/Auth IDs,
  teacher-local directory, групповой `lesson_run.teacher_report`, roster или
  данные других учащихся и не имеет mutation capabilities.
- Subject/observer reads идут через узкую learner-safe projection/RPC; нельзя
  просто расширить raw `learning_record SELECT` условием `OR subject/observer`.

### Progress и AI consent

- V1 не создаёт пустые generic metrics JSON. Nullable ordinary
  `lesson_run.actual_duration_minutes` заполняется только из explicit start до
  completion либо явного teacher input для post-factum отчёта. Scheduled-time
  fallback текущего RPC не считается реальным start; existing/unknown values
  остаются `NULL`. Run/Course/Profile history и progress UI — consumer и не
  подменяют unknown нулём.
- Per-learner progress использует finalized attendance/repeat/comment и
  `shared_with_learner_at`. `LearningRecord.metrics` появится только вместе с
  первым реальным allowlisted Component/runtime producer; richer learner metrics
  остаются later.
- Progress вычисляется из finalized, non-superseded records и canonical
  lineage; отдельная копия «профиля-истории» не нужна.
- Teacher по-прежнему видит raw records только своего recorder Account.
- Teacher может создать AI-consent request только для effective Course audience;
  subject видит узкую projection безопасных Course/owner metadata и controls,
  но не получает Course content/enrollment/Student Screen access.
- Cross-provider AI использует отдельный subject-controlled consent для ключа
  `profile + Course + owner`, с проверкой current Course owner, expiry и
  revision. Observer grant его не включает. Смена owner, удаление из audience,
  expiry или revoke делает consent недействительным; apply отклоняет stale
  preview revision.
- Internal server-only function строит deterministic bounded sanitized
  projection: aggregates, allowlisted metrics и PII-redacted, de-attributed
  explicitly shared comments без raw row structure, foreign Course/Lesson
  titles, exact timestamps, contacts, recorder identity, private teacher data и
  технических IDs. Comments не цитируются и не атрибутируются; foreign raw rows
  не возвращаются teacher browser/API.
- UI предупреждает, что разрешённые обобщённые сведения повлияют на материал,
  который увидит преподаватель; полностью скрыть такое влияние невозможно.
- Revoke проверяется по DB-state на каждый новый AI request и немедленно
  прекращает дальнейшее использование.

### Lifecycle

- «Убрать из списка» остаётся обратимым archive только teacher relation.
- Restore активирует relation без скрытого восстановления старых Group/Course
  links.
- Пустой unclaimed profile можно удалить физически только при отсутствии
  records, invitations, других teacher relations и Account link.
- Global learning-data erasure может инициировать только linked subject после
  recent reauthentication, preview и повторного подтверждения. Оно не должно
  каскадно удалять историю других learners, записанную тем же Account как
  teacher; recorder при необходимости остаётся обезличенным tombstone. Reset
  очищает current profile и всю source lineage, links/invitations/grants/consents
  и private content. Alias immutable для обычных операций; erasure-only RPC
  физически удаляет lineage aliases и удаляет либо необратимо псевдонимизирует
  source/target/profile IDs в audit без PII. Старый UUID не резолвится в новый
  profile. В той же lock-safe transaction Account получает новый пустой profile,
  чтобы exactly-one invariant выполнялся на commit.

## Current physical contract

```text
learner_profile
- id
- account_id: uuid | null, unique
- display_name: canonical/offline fallback name
- created_at
- updated_at

teacher_learner
- teacher_account_id
- learner_profile_id
- display_name: имя только в справочнике этого преподавателя
- archived_at: archive только для этого преподавателя
- created_at
- updated_at
- primary key (teacher_account_id, learner_profile_id)

learning_record
- learner_profile_id
- recorded_by_account_id
- lesson_run_id | source_course_id | source_lesson_id
- occurred_at
- was_present | needs_repeat
- teacher_comment
- course_title_at_time | lesson_title_at_time | subject_at_time
```

`learner_profile.account_id` является nullable one-to-one точкой будущего claim:
несколько неавторизованных/offline профилей могут иметь `NULL`, но один Account
не может быть связан с несколькими canonical LearnerProfile. Наличие колонки не
означает, что claim, invitation или learner login уже реализованы.

FK lifecycle намеренно сохраняет образовательную память: удаление linked
subject Account обнуляет `learner_profile.account_id`; canonical profile нельзя
удалить, пока на него ссылается LearningRecord; recorder Account нельзя удалить,
пока существуют записанные им rows. `recorded_by_account_id` дополнительно
защищён от изменения trigger. Privacy erasure поэтому требует отдельного
явного flow, а не случайного cascade.

При создании ученика текущим teacher RPC создаются и `learner_profile`, и
`teacher_learner`; исходные global/local display names совпадают. Дальнейшее
редактирование в разделе «Ученики» меняет teacher-local display name, а не
переписывает имя для других будущих преподавателей. Существующие данные
мигрируются без дедупликации: каждому прежнему owner-scoped профилю соответствует
ровно одна backfilled `teacher_learner` relation, а `account_id` остаётся `NULL`.

## Teacher directory, groups and Course audience

`/students` остаётся единым teacher-only справочником. Его строка — projection
`teacher_learner + learner_profile`; UI и существующие learner-profile route/RPC
names сохранены как совместимый product/API boundary.

```text
LearnerProfile teacher read model
- id = teacher_learner.learner_profile_id
- teacherAccountId
- displayName = teacher_learner.display_name
- archivedAt
- createdAt
- updatedAt
```

Физические create/update/archive RPC сохраняют прежние имена, но возвращают row
`teacher_learner`; repository преобразует её в этот публичный read model и не
читает canonical table для teacher directory.

Current UI разделяет один справочник на вкладки «Ученики» и «Группы». Таблица
учеников поддерживает поиск, фильтр по группе и сортировку, показывает до двух
group chips и «ещё N»; отдельная вкладка показывает только reusable groups и их
состав. Клик по строке открывает dialog «Профиль / История», где membership
можно менять сразу для нескольких групп, а history ограничена текущим teacher.

- Активная строка имеет `teacher_learner.archived_at IS NULL`.
- Имя, сортировка и поиск используют `teacher_learner.display_name`.
- `LearnerGroup` по-прежнему принадлежит Account преподавателя.
- Group membership и direct Course audience хранят canonical
  `learner_profile_id`, но поддерживаемый DB/RPC path допускает только активную
  `teacher_learner` relation того же Account.
- Course effective audience остаётся distinct union direct learners и members
  выбранных groups.
- Изменение группы или архивация relation влияет на будущие назначения, но не
  переписывает draft LearningRecord уже открытого LessonRun.

Действие UI называется «Убрать из списка» и архивирует только
`teacher_learner` текущего преподавателя и удаляет только его mutable
group/Course links. Оно не архивирует canonical LearnerProfile глобально и не
удаляет его LearningRecord. Archived relation и локальное имя остаются в БД,
но current `/students` показывает только active relations; списка архива,
restore UI и unarchive RPC пока нет. Поэтому сохранность данных не означает,
что преподаватель может снова открыть убранного ученика через текущий UI.

Текущие operational limits не меняются: до 200 unique learners в effective
Course/Run audience, до 100 rows в Lesson/Course/Profile history и PostgREST
hydration batches по 50 IDs.

## LearningRecord authorship and history

`LearningRecord` остаётся единственной per-learner сущностью проведения: draft
row задаёт ожидаемого участника, finalized row хранит результат. Новая колонка
`recorded_by_account_id` фиксируется при scheduling вместе с
`learner_profile_id` и не выводится позднее из mutable Course/Profile relations.

Текущий history boundary teacher-scoped:

- преподаватель читает только rows, где `recorded_by_account_id` равен его
  Account;
- Course/Lesson/Profile history и AI context используют эту же границу;
- запись сохраняется после удаления Lesson и остаётся понятной благодаря
  компактным title/subject fields;
- archive teacher relation не удаляет уже назначенные или finalized rows;
- физического Lesson snapshot и отдельного `lesson_run_participant` по-прежнему
  нет.

Такой provenance нужен даже после появления learner/observer access: связь
профиля с Account не должна превращать наблюдения разных преподавателей в
неразличимый общий поток.

## Current authorization boundary

Текущий browser workflow остаётся teacher-only и использует user JWT, narrow
`SECURITY DEFINER` RPC, explicit Account checks, RLS и закрытые table mutation
grants.

- Canonical `learner_profile` не становится публичным из-за отсутствия owner
  column; teacher directory получает только projection своей
  `teacher_learner` relation. Если `account_id` позднее заполнен, этот Account
  может выбрать собственную canonical identity row, но не teacher relation или
  LearningRecord.
- `teacher_learner` виден только своему `teacher_account_id`.
- `learner_group_member` и `course_learner` видны через owner Group/Course и
  принимают только canonical profile с активной relation этого teacher.
- `learning_record` виден преподавателю только по
  `recorded_by_account_id = current_account_id()`.
- `account_id`, даже если будет заполнен служебно, пока не открывает learner
  routes, Course, teacher comments или историю.
- `anon` не получает доступ к этим таблицам или RPC.

Прямой authenticated INSERT/UPDATE/DELETE identity rows не является product
API. Атомарные create/update/archive operations остаются RPC, чтобы profile,
teacher relation, memberships и audience invariants не расходились.

## AI boundary

Текущий Lesson planning и read-only Assistant получают только effective
audience текущего Course и teacher-scoped finalized history текущего Account.
Для имени используется teacher-local projection. Технические profile/account/
record IDs и Auth identity не передаются provider.

Canonical profile сам по себе не разрешает AI читать наблюдения другого
преподавателя. Cross-provider history и AI personalization требуют отдельного
subject-controlled consent и безопасной projection; они не входят в current
slice.

## Not implemented by this slice

- automatic exactly-one profile bootstrap для каждого Account;
- roleless onboarding/navigation/access вместо transitional role switch;
- safe Account discovery, invitation или claim существующего offline profile;
- automatic link по имени, email, телефону или другому эвристическому признаку;
- physical merge preview/RPC/UI, lineage alias и conflict resolution;
- self/observed finalized history UI и управление access;
- learner access к Course и live Student Screen;
- archive list/restore и subject-only erasure;
- доступ одного преподавателя к record другого преподавателя;
- subject-controlled cross-provider AI context;
- actual-duration/progress projection и pagination; richer per-learner metrics.

## Next and later

**Next execution program:** legacy identity/security hardening → universal
Account/profile bootstrap → discovery/invitation/claim → physical merge →
archive/restore → observer access → progress → cross-provider AI consent
→ legacy role cutover. Каждый этап требует forward migration, actor-matrix
tests, schema snapshot, docs и deployed postflight.

Полный copy-paste hand-off, acceptance matrix и terminal condition находятся в
[`LEARNER_IDENTITY_COMPLETION_PROMPT.md`](../v2/LEARNER_IDENTITY_COMPLETION_PROMPT.md).

**Later, вне этой программы:** learner Course consumption/live Student Screen,
persisted Homework, vocabulary/inferences, communication и billing.

## Canonical implementation map

- domain/contracts/service/repository: `src/modules/lesson-runs/`;
- teacher directory UI: `src/components/teaching-hub/`;
- history UI: `src/components/lesson-runs/`;
- API: `src/app/api/v2/learner-profiles/`, `learner-groups/` и Course/Lesson
  audience/history/run routes;
- physical schema snapshot: `supabase/schema/current-schema.sql`;
- schema documentation: `docs/database/current-schema.md`;
- forward migrations: `supabase/migrations/`.

Lesson/Run invariants remain canonical in
[`lesson-workflow-model.md`](./lesson-workflow-model.md). Provider handling and
context limits remain canonical in
[`ai-provider-integration.md`](./ai-provider-integration.md).
