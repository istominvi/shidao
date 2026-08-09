# Current database schema

**Статус:** agent-first guide для production learner-identity contract stage

**Production schema head:**
`20260807065038_learner_identity_legacy_contract_cleanup.sql`

**Repository contract head:**
`20260807065038_learner_identity_legacy_contract_cleanup.sql`

**Final contract migration:**
`20260807065038_learner_identity_legacy_contract_cleanup.sql` — применена после
двух подтверждённых roleless web releases и read-only dependency audit

**SQL snapshot:**
[`supabase/schema/current-schema.sql`](../../supabase/schema/current-schema.sql)
в repository зафиксирован из проверенной post-M4 production базы. Strict
signature `shidao-v2-contract` подтверждена 9 августа 2026 года; snapshot
SHA-256 — `a9c983f8c6403d0816fda9afc7f42241be7cfa9a661abf5f8dde22f502fab30c`.

## Read order для DB-задач

1. этот документ;
2. `supabase/schema/current-schema.sql` для последнего подтверждённого snapshot;
3. четыре learner-identity migrations ниже, если задача касается candidate,
   rollout/backfill или contract cleanup;
4. остальные `supabase/migrations/*` только для compatibility, rollback или
   debugging history.

Политика изменений:
[`docs/database/migration-guidelines.md`](./migration-guidelines.md).

## Release sequence и migration set

| Stage | Migration                                                            | Назначение                                                                                                                                     |
| ----- | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| M1    | `20260807065017_identity_security_hardening.sql`                     | RLS/ACL hardening `user_preference`/`user_security`, сужение legacy table/function grants                                                      |
| M2    | `20260807065026_learner_identity_primitives_backfill_invariant.sql`  | roleless Account, Account credential boundary, exactly-one profile bootstrap/backfill и default-deny identity primitives                       |
| M3    | `20260807065032_learner_identity_workflows_progress_observer_ai.sql` | discovery/claim/merge, archive/restore, self/observer projections, erasure, actual duration и AI consent                                       |
| M4    | `20260807065038_learner_identity_legacy_contract_cleanup.sql`        | final RESTRICT cleanup dormant role helpers/types/Data API grants и rollback-only legacy security dual-writes; без удаления legacy rows/tables |

M1–M3 являются additive/compatible expand для roleless web. M4 была withheld из
первого deploy и применена только после доказательства, что running и rollback
images не зависят от старого contract.

Production expand evidence 9 августа 2026 года:

- verified full-format backup:
  `/root/shidao-db-backups/shidao-before-learner-identity-20260809T081005Z.dump`;
- backup size `671605` bytes, SHA-256
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

## Current repository tables

### Course Builder, audience и history

| Table                  | Назначение                                                                                                      |
| ---------------------- | --------------------------------------------------------------------------------------------------------------- |
| `account`              | единая roleless login identity; status active, provisional, suspended или deleted                               |
| `course`               | Account-owned authoring Course                                                                                  |
| `lesson`               | ordered Lesson с обязательным title и teacher-only summary                                                      |
| `lesson_component`     | единственный ordered component list Lesson                                                                      |
| `lesson_student_slide` | persisted learner presentation grouping без собственного content                                                |
| `stored_file`          | Account-owned metadata private Storage object                                                                   |
| `course_attachment`    | ownership-checked Course ↔ StoredFile                                                                           |
| `learner_profile`      | canonical учебная identity; один linked profile на active/provisional Account либо offline `account_id IS NULL` |
| `teacher_learner`      | teacher-local display name и reversible archive relation                                                        |
| `learner_group`        | reusable Account-owned group                                                                                    |
| `learner_group_member` | group ↔ canonical profile                                                                                       |
| `course_learner`       | direct Course audience source                                                                                   |
| `course_learner_group` | group Course audience source                                                                                    |
| `lesson_run`           | конкретное назначение/проведение Lesson                                                                         |
| `learning_record`      | expected learner, затем finalized individual result и recorder provenance                                       |

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

После M2:

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
  lifecycle workflow.

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
взрослого в learner target. Observer invitation — отдельное opt-in действие.

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

| Surface                                        | `authenticated` direct access                            | Supported boundary           |
| ---------------------------------------------- | -------------------------------------------------------- | ---------------------------- |
| Course/Lesson/Component/Slide/File             | existing owner-scoped permissions                        | RLS + owner service/RPC      |
| `learner_profile`                              | own canonical row `SELECT`; no direct mutation           | supported identity workflows |
| `teacher_learner`, groups, audience, runs      | existing teacher-scoped read; mutation via aggregate RPC | actor ownership              |
| raw `learning_record`                          | recorder-scoped teacher `SELECT` only                    | lifecycle RPC                |
| Account credential/identity/observer/AI tables | none for `anon/authenticated`                            | narrow RPC/server adapter    |
| learner-safe self/observer history             | no raw table access                                      | safe projection RPC          |

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
- private bucket `storage.buckets.course-assets`;
- owner policies `storage.objects` SELECT/INSERT/UPDATE/DELETE;
- grants/default ACL.

## Absent from active model

В candidate по-прежнему нет Methodology, Lesson Step/root Step,
`lesson_run_participant`, Lesson snapshot, persisted Run/Record status,
Homework persistence, parsing/RAG, learner Course consumption/enrollment или
live Student Screen. Observer capability не является Parent/Guardian role, а
AI consent не является Course access.

## Snapshot refresh workflow

`scripts/refresh-schema-snapshot.sh` принимает ровно два строгих stage:
`expand` после M1–M3 и `contract` после M4. В обоих signature проверяет:

- все M1–M3 tables/functions/columns и exactly-one invariant;
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
меняет migrations. Первый roleless release фиксирует проверенный M1–M3
`expand` snapshot. После успешного contract rollout тот же script фиксирует
финальный `contract` snapshot; ручное редактирование dump вместо refresh не
допускается.
