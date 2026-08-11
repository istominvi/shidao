# Current database schema

**Статус:** current production learner-identity M6 + Course publication
catalog + Course Component D1 contract schema

**Production schema head:**
`20260811154138_remove_divider_components.sql` — применена к production
11 августа 2026 года

**Repository schema head:**
`20260811154138_remove_divider_components.sql` — совпадает с current
production head

**Legacy contract migration:**
`20260807065038_learner_identity_legacy_contract_cleanup.sql` — применена после
двух подтверждённых roleless web releases и read-only dependency audit

**Production Auth hardening head:**
`20260809090000_learner_identity_provisional_auth_metadata_sync.sql` — применена
после M5 deferred-invariant fix, отдельных verified backups и реального GoTrue
Admin create/delete probe

**SQL snapshot:**
[`supabase/schema/current-schema.sql`](../../supabase/schema/current-schema.sql)
содержит production dump после D1, снятый штатным script через
read-only SSH tunnel 11 августа 2026 года в `16:15:55Z`. Strict signature
осталась `shidao-v2-contract`, SHA-256 snapshot —
`c6da0f149f29be13cb1a4cd0d5e4642e8ce24edc04558b2431e2dbbc4728b23c`.

## Read order для DB-задач

1. этот документ;
2. `supabase/schema/current-schema.sql` для последнего подтверждённого snapshot;
3. шесть learner-identity migrations ниже, если задача касается
   rollout/backfill, compatibility или contract cleanup;
4. остальные `supabase/migrations/*` только для compatibility, rollback или
   debugging history.

Политика изменений:
[`docs/database/migration-guidelines.md`](./migration-guidelines.md).

## Release sequence и migration set

| Stage | Migration                                                              | Назначение                                                                                                                                     |
| ----- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| M1    | `20260807065017_identity_security_hardening.sql`                       | RLS/ACL hardening `user_preference`/`user_security`, сужение legacy table/function grants                                                      |
| M2    | `20260807065026_learner_identity_primitives_backfill_invariant.sql`    | roleless Account, Account credential boundary, exactly-one profile bootstrap/backfill и default-deny identity primitives                       |
| M3    | `20260807065032_learner_identity_workflows_progress_observer_ai.sql`   | discovery/claim/merge, archive/restore, self/observer projections, erasure, actual duration и AI consent                                       |
| M4    | `20260807065038_learner_identity_legacy_contract_cleanup.sql`          | final RESTRICT cleanup dormant role helpers/types/Data API grants и rollback-only legacy security dual-writes; без удаления legacy rows/tables |
| M5    | `20260809084500_learner_identity_auth_deferred_invariant_security.sql` | узкий `SECURITY DEFINER` boundary для deferred exactly-one invariant при реальном GoTrue commit; без расширения Auth table privileges          |
| M6    | `20260809090000_learner_identity_provisional_auth_metadata_sync.sql`   | trusted two-phase GoTrue `app_metadata` sync для pristine provisional child Account с fail-closed защитой от позднего downgrade                |
| C1    | `20260810035033_course_publication_catalog.sql`                        | immutable Course publication revisions, private publication Storage, independent catalog copy/duplicate и closed admin RPC                     |
| D1    | `20260811154138_remove_divider_components.sql`                         | удаление layout-only `divider`, повторная нумерация Component/Slide и CHECK-запрет повторного создания                                         |

M1–M3 являются additive/compatible expand для roleless web. M4 была withheld из
первого deploy и применена только после доказательства, что running и rollback
images не зависят от старого contract. M5 и M6 — атомарные forward security
fixes поверх post-M4 contract; они не восстанавливают legacy role/ACL surface.

Production expand evidence 9 августа 2026 года:

- verified full-format backup:
  `/root/shidao-db-backups/shidao-before-learner-identity-20260809T081005Z.dump`;
- backup size `671605` bytes, 1014 restore-list entries, SHA-256
  `3974af7cffd2c5e7e62d872be5923ccf64638640d56160a947a2d68011e70ae7`;
- M1–M3 применены owner connection с `ON_ERROR_STOP`;
- `active_accounts_without_exactly_one_profile = 0`, все 18 новых identity
  tables имеют RLS, sensitive `PUBLIC EXECUTE = 0`;
- PostgREST schema cache видит Account/self/observer/AI RPC;
- первый roleless image: exact SHA
  `5944d31f86f7d3795ec9f17928cb311ecbdfdd21`, Coolify status `finished`.

Production contract evidence 9 августа 2026 года:

- второй roleless image: exact SHA
  `5d650a390abcc944780a716f909248f5493c10a9`, Coolify status `finished`;
- read-only audit подтвердил 23 expected helpers, 13 policies и 2 enums без
  внешних dependencies;
- verified pre-contract backup:
  `/root/shidao-db-backups/shidao-before-identity-contract-20260809T082938Z.dump`;
- backup size `883168` bytes, 1041 restore-list entries, SHA-256
  `257d6a6f4a102e630ca9d6321c86beb67b1cea0befa7049865a8bfb4e511b0b4`;
- M4 checksum
  `4539025f2b109addf4296ec3b60430648ac086ed33969dcccfd17e3c0d05eaae`
  применена owner connection с `ON_ERROR_STOP` одной транзакцией;
- helpers/types/policies/legacy Data API grants и public function references к
  `user_security` отсутствуют; 4 root→impl edges сохранены, impl ACL закрыты;
- `active_accounts_without_exactly_one_profile = 0`, duplicate links `0`,
  PostgREST cache видит новые RPC и не видит удалённые legacy RPC.

Production Auth hardening evidence 9 августа 2026 года:

- verified pre-M5 full-format backup
  `/root/shidao-db-backups/shidao-before-auth-deferred-invariant-fix-20260809T085613Z.dump`:
  size `858088` bytes, 1003 restore-list entries, SHA-256
  `a0c67c77cfc5d819678d4682dd340e4ed052cefcf4d4d4a985758b34d7894dcc`;
- M5 checksum
  `126e412c3949a8e649638522e52e1d98288c7b779b3fbc13dcd2747d9aa31e7c`
  применена owner connection с `ON_ERROR_STOP` одной транзакцией;
- M5 postflight подтвердил `SECURITY DEFINER` и пустой `search_path` у
  `enforce_account_exactly_one_learner_profile`, owner/RLS boundary, ровно два
  deferred constraint triggers и отсутствие `EXECUTE` у `PUBLIC`, `anon`,
  `authenticated`, `service_role`, `supabase_auth_admin`;
- verified pre-M6 full-format backup
  `/root/shidao-db-backups/shidao-before-provisional-auth-sync-20260809T093520Z.dump`:
  size `1013144` bytes, 1339 restore-list entries, SHA-256
  `f56df63680abbc10b1b0eafa686800a7a2cddd34430185d566462d38ce04be41`;
- M6 checksum
  `133dafcea4ff4f54bfeb3e58bb7eb2bf98947b79d422ab44f7e90a6430ecaada`
  применена owner connection с `ON_ERROR_STOP` одной транзакцией;
- M6 postflight подтвердил enabled row-level
  `AFTER UPDATE OF raw_app_meta_data` trigger с key-change predicate, закрытый
  function ACL, owner/RLS boundary, fail-closed pristine/xmin guard, ноль
  trusted `Auth provisional / Account active` mismatches и exactly-one count `0`;
- реальный GoTrue Admin create с internal learner email, explicit
  `identity_status=provisional` и live child-activation invitation завершился
  успешно: Account стал `provisional` и получил ровно один bootstrap Profile;
  последующий Auth Admin delete удалил disposable Auth user и его пустые
  provisional Account/Profile rows, post-cleanup counts равны `0`;
- финальный проверенный post-M6 production snapshot имеет SHA-256
  `584ebb96dc8d96f1eb508e7eae836edb8125a9fefe2a59e9cb362af54bba5a26`.

Production Course publication evidence 10 августа 2026 года:

- verified full-format backup
  `/root/shidao-db-backups/shidao-postgres-before-course-catalog-20260810T052807Z.dump`:
  size `1018939` bytes, SHA-256
  `b76de93b2d139873628ba067a56d45b7f80a959da7fbf82d2c8334cc0fd867db`;
- migration checksum
  `d260e37bf420e2c9777586777318e84b1768b3bd347ccfe05d49b5c675d40c0d`
  применена `supabase_admin` с `ON_ERROR_STOP` и завершилась `COMMIT`;
- исходные counts сохранились: Account `19`, Course `5`, Lesson `13`,
  Component `80`; у всех Course заполнен publication content clock;
- четыре publication table пусты до первого пользовательского publish, имеют
  RLS и закрыты для `anon`/`authenticated`; пять admin RPC доступны только
  `postgres`/`service_role`;
- private bucket `course-publication-assets` создан с лимитом 10 MiB и без
  user Storage policies; PostgREST schema cache видит четыре table и catalog/
  publish/clone RPC, прямой anon read получает `401/42501`;
- service-role catalog RPC вернул пустой catalog/facets, свежий production
  snapshot имеет SHA-256
  `2b1a3f475074940e69e1dee6ba12edc8d3103a23a01c640ec342e3cb31f0af46`.

### Production Course Component contract cleanup

Read-only production audit перед D1 подтвердил PostgreSQL 15.8 и canonical
ShiDao signature по таблицам `course`, `lesson`, `lesson_component`,
`lesson_student_slide`, `course_publication_revision`, RPC
`delete_lesson_component(uuid)` и отсутствию `lesson_step`. Preflight counts:
5 Course, 16 Lesson, 104 Component и 6 Slides.

- 15 строк `type_key='divider'` в 12 Lesson и 4 Course;
- 2 из них learner-visible; publication divider count равен 0;
- Component/Slide positions плотные, exactly-one profile violations равны 0.

Production execution 11 августа 2026 года:

- verified full-format backup
  `/root/shidao-db-backups/shidao-before-remove-divider-20260811T160822Z.dump`:
  size `1146321` bytes, 1427 restore-list entries, SHA-256
  `b82027b25a7c0d96471fe46da07d9795a64c1924ba3e7522368c379755e78449`;
- migration checksum
  `21791932067f8f45a5ab9fde8d2ef6db08ca661f7489a28f333c8dc52c206bd5`;
- первый запуск под non-owner `postgres` завершился ошибкой и полным
  transaction rollback. Повторный read-only preflight подтвердил
  исходные `104/15` Component/divider и прежний CHECK;
- read-only owner check подтвердил canonical owner `supabase_admin`.
  Повторный запуск неизменённого tracked SQL от этого owner с
  `ON_ERROR_STOP` завершился `COMMIT`;
- postflight counts: 5 Course, 16 Lesson, 89 Component, 6 Slides;
  `divider=0`, publication divider `0`, non-dense Component/Slide positions `0`,
  empty Slides `0`, exactly-one violations `0`;
- `lesson_component_type_key_check` требует
  `btrim(type_key) <> ''` и `lower(btrim(type_key)) <> 'divider'`;
- snapshot сгенерирован в `2026-08-11T16:15:55Z`, SHA-256
  `c6da0f149f29be13cb1a4cd0d5e4642e8ce24edc04558b2431e2dbbc4728b23c`.
  Review показал только generated timestamp и новый CHECK относительно
  предыдущего schema snapshot.

## Current repository tables

### Course Builder, audience и history

| Table                         | Назначение                                                                                                      |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `account`                     | единая roleless login identity; status active, provisional, suspended или deleted                               |
| `course`                      | Account-owned authoring Course; отдельный publication-content clock                                             |
| `lesson`                      | ordered Lesson с обязательным title и teacher-only summary                                                      |
| `lesson_component`            | единственный ordered component list Lesson                                                                      |
| `lesson_student_slide`        | persisted learner presentation grouping без собственного content                                                |
| `stored_file`                 | Account-owned metadata private Storage object                                                                   |
| `course_attachment`           | ownership-checked Course ↔ StoredFile                                                                           |
| `course_publication`          | stable catalog listing; nullable live source, publisher name snapshot, Shidao/status/current revision           |
| `course_publication_revision` | immutable allowlisted Course/Lesson/Component/Slide/material snapshot, hash и rights audit                      |
| `course_publication_asset`    | immutable private publication copy metadata; nullable live StoredFile provenance                                |
| `course_publication_origin`   | immutable provenance установленного из каталога рабочего Course                                                 |
| `learner_profile`             | canonical учебная identity; один linked profile на active/provisional Account либо offline `account_id IS NULL` |
| `teacher_learner`             | teacher-local display name и reversible archive relation                                                        |
| `learner_group`               | reusable Account-owned group                                                                                    |
| `learner_group_member`        | group ↔ canonical profile                                                                                       |
| `course_learner`              | direct Course audience source                                                                                   |
| `course_learner_group`        | group Course audience source                                                                                    |
| `lesson_run`                  | конкретное назначение/проведение Lesson                                                                         |
| `learning_record`             | expected learner, затем finalized individual result и recorder provenance                                       |

### Course publication repository contract (current production schema)

В UI остаётся одна сущность Course. Storage разделяет редактируемый owner
Course и immutable catalog representation:

- `course_publication.source_course_id` nullable с `ON DELETE SET NULL`, поэтому
  публикация и её revisions переживают удаление рабочего Course; partial unique
  index сохраняет one-publication-per-live-source;
- revision хранит `schemaVersion=1`, public Course fields и иерархию
  `Course → Lesson → ordered Components`; Slides остаются presentation
  projection, Lesson Step отсутствует;
- lesson/component/slide/material `ref` являются publication-local UUID и
  валидируются против source graph по canonical positions, а не равенству live
  row UUID; `studentSlideRef` сверяется через position соответствующего Slide;
- для image/file/slideshow SQL строит exact
  `sourceStoredFileId → publicationAssetId` map, remap-ит исходный payload и
  сравнивает весь JSONB. Поэтому `storedFileId:null` сохраняется, а подмена
  `alt`, label, openMode или slideshow metadata отклоняется;
- snapshot исключает teacher preferences, audience/groups/learners,
  schedules, runs, records, reports/history и consent. `staff_only` Components
  входят как authored teacher content, но не становятся learner projection;
- каждое обновление создаёт новую immutable revision. Равный текущей revision
  hash + byte-equal snapshot идемпотентно переопубликует её без копирования;
  перед acknowledgement SQL заново сверяет exact live attachments, ready
  StoredFile metadata и наличие immutable Storage objects. Поэтому stale
  snapshot после detach не может ложно очистить dirty state. Возврат контента
  A→B→A разрешён как новая revision;
- rights audit сохраняет timestamp и внутренний code
  `shidao_catalog_reuse_v1`. Это не выбранная Creative Commons лицензия;
- publication asset `id` локален внутри revision (composite primary key
  `(revision_id, id)`), поэтому повторно используемый deterministic material ref
  безопасно встречается в нескольких revisions; assets физически копируются в
  private bucket, максимум 24 файла,
  каждый до 10 MiB, суммарно до 120 MiB. Live StoredFile provenance nullable
  `ON DELETE SET NULL`, immutable publication blob и metadata сохраняются;
- cumulative immutable history одного Account ограничена 5 GiB
  (`octet_length(snapshot::text) + asset.size_bytes` по всем revisions).
  Publish сериализуется на Account row; те же quota triggers защищают
  privileged direct inserts. Same-current idempotent republish не добавляет
  bytes и не расходует quota. Отказ имеет стабильный token
  `course_publication_account_quota_exceeded`; retention или blob deletion эта
  migration не добавляет;
- переход Account из `active` в любой non-active status атомарно переводит все
  его published listings в `unpublished`. Возврат Account в `active` ничего не
  публикует автоматически; catalog list и clone дополнительно требуют active
  publication owner;
- `course.publication_content_updated_at` меняется только для allowlisted
  Course fields и authored Lesson/Component/Slide/attachment/material
  mutations. Excluded teacher preferences и operational fields меняют обычный
  `updated_at`, но не publication clock;
- immutable revision фиксирует publication clock как audit в
  `source_course_updated_at`. Mutable listing подтверждает реально
  опубликованное состояние в `source_content_updated_at`; оба publish paths,
  включая idempotent acknowledgement после локального edit→revert к текущему
  snapshot, обновляют listing clock.
  `hasUnpublishedChanges` сравнивает два Course/publication clocks, не generic
  `updated_at` и не immutable revision timestamp;
- compact Course fields и counts денормализованы в `course_publication` и
  атомарно обновляются при publish. Catalog list не переносит 16 MiB snapshot;
  subject и level facets ограничены 100 distinct case-insensitive значениями
  каждая. Текущий выбранный filter включается в bounded facet, если такое
  опубликованное значение существует.

Все четыре publication table имеют RLS, но не имеют policies/grants для
`anon`/`authenticated`. `postgres` и `service_role` получают table privileges;
browser работает только через authenticated application route. Mutation
boundary — closed `SECURITY INVOKER`, `search_path=''` RPC:

- `publish_course_revision_admin(...)` и
  `unpublish_course_publication_admin(...)`;
- `list_course_publication_catalog_admin(...)` — DB-side query/filter/order,
  `limit+1`, owner-only `sourceCourseId`, bounded global subject/level facets и
  только compact listing DTO без snapshot/owner Account UUID; inactive
  publication owners fail closed;
- `clone_course_publication_admin(...)` — exact current published revision,
  exact target ID/file maps, новые owner StoredFiles и origin, без operational
  или private Course state;
- `duplicate_course_admin(...)` — same-owner deep copy authored graph с
  teacher preferences и безопасным reuse существующих StoredFile links, без
  audience/history/publication state.

### Account credential boundary

| Table                 | Назначение                                                               |
| --------------------- | ------------------------------------------------------------------------ |
| `account_login_alias` | unique normalized learner login; internal Auth email browser не получает |
| `account_security`    | bcrypt PIN hash, lockout, PIN timestamps и session cutoff по Account     |
| `account_preference`  | Account-owned preference/settings replacement для active V2              |

Новый login/PIN flow резолвит alias и проверяет PIN только server-side
service-role RPC. Raw PIN, internal Auth email, token/email digests и Auth UUID
не входят в public DTO или logs. Existing однозначные legacy student login/PIN
backfill переносятся в Account boundary без plaintext secret; неоднозначные
связи не угадываются.

### Discovery, claim и merge

| Table                                  | Назначение                                                           |
| -------------------------------------- | -------------------------------------------------------------------- |
| `learner_profile_share_code`           | rotating expiring one-time code digest                               |
| `learner_connection_request`           | pending share-code/email connection, recipient binding и lifecycle   |
| `learner_claim_invitation`             | recipient-bound claim или child activation, token/email digests only |
| `learner_profile_merge`                | lock-safe preview/fingerprint/confirm operation                      |
| `learner_profile_merge_conflict`       | metadata resolution двух finalized records одного LessonRun          |
| `learner_profile_merge_private_detail` | private discarded teacher-local name per teacher                     |
| `learner_profile_alias`                | immutable source UUID → canonical target lineage до subject erasure  |

Share code создаёт только pending request. Email response одинаков для
существующего/нового получателя и не является enumeration oracle. Обычный merge
разрешён только из unclaimed source в actor-owned target; claimed → claimed,
open/draft Run и stale fingerprint fail closed.

При конфликте finalized records primary сохраняет `lesson_run_id`, losing row
сохраняет pedagogical/provenance поля, получает `lesson_run_id = NULL` и
`superseded_by_record_id = primary.id`. History/progress/AI исключают
superseded rows.

### Observer, AI consent, audit и lifecycle

| Table                                  | Назначение                                                                 |
| -------------------------------------- | -------------------------------------------------------------------------- |
| `learner_observer_invitation`          | recipient-bound observer invitation                                        |
| `learner_observer_grant`               | explicit read-only subject → observer capability и free display label      |
| `learner_ai_consent`                   | отдельный consent `profile + Course + current owner`, expiry/revision      |
| `learner_identity_audit_event`         | append-only metadata audit без email/token/PIN/comments/display names      |
| `learner_identity_rate_limit`          | persistent bounded rate-limit counters по keyed digest                     |
| `learner_erasure_request`              | expiring preview fingerprint для recent-reauth reset                       |
| `learner_credential_recovery_delegate` | отдельное от observer право взрослого восстановить login/PIN child Account |
| `learner_identity_reconciliation`      | pending/review legacy parent-student edges; не active observer grant       |

Все таблицы этого раздела и credential/discovery tables имеют RLS и
default-deny Data API: `anon` и ordinary `authenticated` не имеют прямых table
privileges. Supported reads/mutations идут через узкие RPC с actor из
`auth.uid()` либо через server-only administrative adapter, когда нужны Auth
Admin, keyed digest или verified recipient email.

## Exactly-one Account/Profile invariant

После M2–M6:

- Auth trigger атомарно создаёт `account`, `account_security`,
  `account_preference` и один linked `learner_profile`;
- deterministic backfill создаёт недостающий profile каждому
  `active | provisional` Account без fuzzy matching;
- unique `learner_profile.account_id` сохраняет upper bound;
- deferred constraint triggers на обеих сторонах требуют на commit ровно одну
  linked row для каждого active/provisional Account;
- guard запрещает direct link/unlink/delete; merge, safe unlink и erasure
  включают узкий transaction-local mutation mode;
- удаление действительно пустого provisional Auth user очищает только его
  пустой bootstrap profile. Profile с application dependencies требует явного
  lifecycle workflow;
- M5 исполняет deferred exactly-one checks в собственном узком
  `SECURITY DEFINER` boundary, когда GoTrue на commit уже снова работает как
  `supabase_auth_admin`; прямые Account/Profile grants Auth-роли не выдаются;
- M6 наблюдает только изменение trusted provisional keys в
  `auth.users.raw_app_meta_data`. В `provisional` переводится лишь pristine
  bootstrap Account с тем же creation `xmin`, strict internal email и live
  `child_activation` invitation. Любой последующий metadata refresh после
  commit не может перевести established `active` Account обратно.

Обязательный postflight:

```sql
select count(*) as active_accounts_without_exactly_one_profile
from public.account as account
where account.status in ('active', 'provisional')
  and (
    select count(*)
    from public.learner_profile as profile
    where profile.account_id = account.id
  ) <> 1;
```

Ожидается `0`, включая concurrency signup/reset/claim tests.

## LessonRun и learner-safe history

`lesson_run` дополнительно хранит:

```text
actual_duration_minutes: integer | null, 1..720
started_at_is_actual: boolean, default false
```

`start_lesson_run` выставляет verified actual start. Completion вычисляет
duration только из такого start либо принимает явный post-factum value.
Scheduled fallback не является фактическим стартом; existing/unknown остаются
`NULL`.

`learning_record` дополнительно хранит:

```text
shared_with_learner_at: timestamptz | null
actual_duration_minutes_at_time: integer | null
superseded_by_record_id: uuid | null
```

Teacher completion использует одно comment field. `shareWithLearner=true`
явно фиксирует публикацию этого индивидуального comment; historical/private
comments остаются `shared_with_learner_at IS NULL`.

Actor boundaries:

- teacher raw history остаётся
  `recorded_by_account_id = current_account_id()`;
- subject/active observer не получают direct `learning_record SELECT`;
- `learner_safe_history_projection` возвращает finalized non-superseded rows,
  opaque projection key, titles-at-time, attendance/repeat, known duration и
  только explicitly shared comment;
- cursor pagination ограничена 1–50 items;
- progress агрегирует finalized non-superseded rows: counts, attendance,
  repeat, last activity, subject breakdown и только известную actual duration;
  неизвестное не превращается в ноль.

Отдельной history copy, Lesson snapshot, `lesson_run_participant`, persisted
Run status или speculative metrics JSON нет.

## Identity workflows и principal RPC groups

### Account/auth

```text
current_account_auth_context
resolve_account_login_alias                 # service_role only
verify_account_pin_credential                # service_role only
verify_current_account_pin
set_current_account_pin                      # service_role only
update_current_account_profile
current_session_invalid_before
revoke_user_sessions                         # service_role only
```

### Teacher directory/discovery/claim

```text
list_teacher_learner_directory
restore_teacher_learner
delete_empty_offline_learner_profile
resolve_teacher_learner_profile_alias
rotate_my_learner_share_code                 # keyed digest via server adapter
create_learner_connection_request
list_learner_connection_requests
act_on_*_learner_connection_request
create/list/revoke/preview/act_on learner profile invitations
activate_*_offline_learner_account
list/reset/revoke learner credential recovery
```

Child activation создаёт отдельный provisional learner Account, unique login и
PIN, переносит offline source в его canonical target, требует явного
подтверждения recovery-delegate authority и не превращает открытый Account
взрослого в learner target. GoTrue создаёт Auth row и записывает custom
`app_metadata` двумя операциями в одной transaction; M6 связывает их только для
trusted pristine child bootstrap и fail closed для malformed, expired,
wrong-kind или marker-less metadata. Observer invitation — отдельное opt-in
действие.

### Merge/archive/erasure

```text
preview_learner_profile_merge
confirm_learner_profile_merge
cancel_learner_profile_merge
archive_learner_profile
restore_teacher_learner
preview/confirm_my_learner_profile_unlink
preview/confirm_my_learning_data_erasure
```

Safe unlink доступен только без lineage, records и dependent grants; generic
split после physical merge отсутствует. Subject erasure требует recent reauth,
preview fingerprint и повторное подтверждение, очищает всю lineage и aliases,
но сохраняет records других learners, где Account был recorder. В той же
transaction создаётся новый пустой linked profile.

### Self/observer/AI

```text
get_my_learning_profile/history/progress
create/list/act_on learner observer invitations/grants
list_my_observed_learner_profiles
get_observed_learner_history/progress
request/list/act_on learner AI consent
build_cross_provider_learner_context          # service_role only
```

Cross-provider function проверяет current Course owner, effective audience,
active unexpired consent и revision на каждый request. Она возвращает только
deterministic bounded aggregates, coarse subject buckets/month и bounded
categorical signals, выведенные из explicitly shared comments после PII scrub.
Текст/summary/quotes comments, raw foreign rows, record/profile/Auth IDs,
contacts, exact timestamps, foreign titles и private comments не возвращаются.

## Stale merged UUID contract

- Поддерживаемые одиночные teacher URLs (profile PATCH/archive/history,
  invitation list/create и permanent delete) сначала вызывают actor-scoped
  `resolve_teacher_learner_profile_alias`; чужой source UUID не раскрывает
  target и остаётся generic not-found.
- Bulk payloads для Group/Course/Run не переписывают произвольные UUID через
  global alias. Устаревший merged UUID возвращает один generic
  «профиль недоступен» error; UI обязан обновить данные и заново выбрать
  learners.
- Restore резолвит alias внутри DB под actor boundary.
- Subject erasure физически удаляет lineage alias. После reset старый UUID не
  раскрывает и не резолвит новый пустой profile.

## RLS/ACL summary

| Surface                                        | `authenticated` direct access                            | Supported boundary                                  |
| ---------------------------------------------- | -------------------------------------------------------- | --------------------------------------------------- |
| Course/Lesson/Component/Slide/File             | existing owner-scoped permissions                        | RLS + owner service/RPC                             |
| Publication/revision/asset/origin              | none                                                     | server-only service-role adapter + closed admin RPC |
| `learner_profile`                              | own canonical row `SELECT`; no direct mutation           | supported identity workflows                        |
| `teacher_learner`, groups, audience, runs      | existing teacher-scoped read; mutation via aggregate RPC | actor ownership                                     |
| raw `learning_record`                          | recorder-scoped teacher `SELECT` only                    | lifecycle RPC                                       |
| Account credential/identity/observer/AI tables | none for `anon/authenticated`                            | narrow RPC/server adapter                           |
| learner-safe self/observer history             | no raw table access                                      | safe projection RPC                                 |

M1 включает RLS и полностью закрывает direct browser access к legacy
preference/security. Expand может сохранять только server-side rollback
compatibility; после roleless cutover M4:

- отзывает все privileges `anon/authenticated` у `class`, `class_student`,
  `class_teacher`, `parent`, `school`, `school_teacher`, `student`, `teacher`,
  `user_preference`, `user_security`;
- удаляет 23 active role/preference/PIN helpers через `DROP ... RESTRICT`;
- удаляет unused `guardian_relation` и `guardian_status` types;
- убирает rollback-only legacy security dual-write из поддерживаемых Account
  credential/session RPC;
- не удаляет и не переписывает legacy rows/tables/migrations.

## Cross-schema objects

Snapshot обязан сохранить:

- `trg_auth_user_create_account` на `auth.users`, вызывающий обновлённый
  atomic Account/profile bootstrap;
- `trg_auth_user_sync_provisional_account` на `auth.users.raw_app_meta_data`,
  вызывающий narrow trusted same-transaction M6 sync;
- private bucket `storage.buckets.course-assets`;
- private bucket `storage.buckets.course-publication-assets` с лимитом 10 MiB,
  allowlisted MIME и без browser policies;
- owner policies `storage.objects` SELECT/INSERT/UPDATE/DELETE;
- grants/default ACL.

## Absent from active model

В active model по-прежнему нет Methodology, Lesson Step/root Step,
`lesson_run_participant`, operational LessonRun snapshot, persisted Run/Record status,
Homework persistence, parsing/RAG, learner Course consumption/enrollment или
live Student Screen. Observer capability не является Parent/Guardian role, а
AI consent не является Course access.

## Snapshot refresh workflow

`scripts/refresh-schema-snapshot.sh` принимает ровно два строгих compatibility
stage: `expand` сохраняет полный legacy compatibility contract, `contract`
требует завершённый M4 cleanup. Оба stage дополнительно требуют полный M1–M3
identity contract и M5/M6 Auth hardening. В обоих signature проверяет:

- все M1–M3 tables/functions/columns и exactly-one invariant;
- M5/M6 `SECURITY DEFINER` owner/ACL boundaries, exact Auth trigger shape и
  отсутствие trusted live provisional mismatch;
- default-deny identity tables;
- полный известный compatibility helper/type/ACL set на `expand` либо его
  полное отсутствие на `contract`; частично применённый cleanup отклоняется;
- отсутствие Step/Methodology/participant/snapshot/status;
- сохранность cross-schema Auth/Storage section.

Перед refresh выполнить read-only ShiDao identity/schema sanity check:

```bash
DATABASE_URL='postgresql://...' npm run db:snapshot
```

После команды review полного diff обязателен. Скрипт не применяет DDL и не
меняет migrations. Course publication rollout снят тем же script после
production postflight; ручное редактирование dump вместо refresh не допускается.
Первый roleless release исторически зафиксировал проверенный M1–M3 `expand`
snapshot. После M4 contract rollout, M5/M6 Auth hardening и C1 Course
publication schema этот script также зафиксировал D1 cleanup в current
`contract` snapshot.
