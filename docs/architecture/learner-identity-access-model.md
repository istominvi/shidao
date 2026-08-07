# Learner identity and access model

**Статус:** canonical V2 architecture для учебной identity, teacher directory и
learning history

**Дата решения:** 7 августа 2026 года

**Область:** LearnerProfile / TeacherLearner / LearnerGroup / Course audience /
LearningRecord / AI context / будущий learner access

**Implementation state:** current repository реализует physical relation,
backfill, RPC/RLS и teacher read model. Последний подтверждённый deployed SHA и
postflight всегда сверяются по `docs/project-state.md`; этот документ не выдаёт
наличие schema в production без отдельной проверки.

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

Такой provenance нужен даже после появления learner/guardian access: связь
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
subject-controlled access contract и не входят в этот slice.

## Not implemented by this slice

- invitation или claim существующего offline profile;
- automatic link по имени, email, телефону или другому эвристическому признаку;
- merge RPC/UI и `merged_into` lifecycle;
- learner login/access к Course, Student Screen или LearningRecord;
- Guardian/observer relations и управление consent;
- доступ одного преподавателя к record другого преподавателя;
- общий cross-provider AI context;
- automatic subject metrics beyond attendance, repeat and comments.

## Next and later

**Next:** определить invitation/claim flow, subject-owned visibility grants и
observer/Guardian access; только после этого реализовать безопасный merge с
явным разрешением конфликтов Course/group links и уникальных per-Run records.
Любое расширение identity сначала закрывает legacy `user_preference` /
`user_security` ACL debt и получает negative RLS tests.

**Later:** learner-facing кабинет, cross-provider progress projection,
consent/revocation audit, расширенные metrics/inferences и AI, который использует
только явно разрешённую часть истории.

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
