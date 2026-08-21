# Learner identity and access model

**Статус:** canonical V2 architecture для roleless Account, canonical learning
identity, teacher directory, observer access и consented AI history

**Дата решения:** 9 августа 2026 года

**Актуально на:** 21 августа 2026 года

**Implementation state:** production содержит полный application/API/UI slice,
M1–M6 contract schema и Account-avatar contract. Четыре verified backup, strict
expand/contract postflight, два roleless Coolify images (`5944d31`, `5d650a3`),
read-only dependency audit и production Auth-trigger postflight завершены.
Identity completion baseline с exact functional SHA `01aa88a` и authenticated
production browser postflight остаётся историческим evidence; текущий
functional application source
`1d4e5deff83cbdc1b479b16e4220cf799327009f` дополнительно содержит единый
`/profile`, compatibility redirects, обязательный avatar и modal
selection/upload. Точные deployed SHA и migration stage сверяются по
[`docs/project-state.md`](../project-state.md).

Current source / next production упрощает только header presentation: прежний
Account/avatar dropdown удалён; avatar protected desktop и authenticated
landing является прямой ссылкой `/profile`, а единственный navigation dropdown
остаётся за burger-кнопкой protected mobile header. Это не меняет Account,
LearnerProfile, session projection или authorization boundary и ещё не
заявляется deployed behavior.

**CURRENT production DB/source/web — LA-M4:** identity boundary имеет отдельные explicit
`Course enrollment → per-Run execution capability` для child live delivery.
Production identity schema и deployed application содержат additive contract.

## Product decision

`Account` — единственная login identity. «Преподаватель», «учащийся» и
«наблюдатель» определяются отношениями/capabilities, а не взаимоисключающей
глобальной ролью.

```text
Account
├── exactly one linked canonical LearnerProfile
├── owns Course 0..N
├── TeacherLearner 0..N → LearnerProfile
├── ObserverGrant 0..N → LearnerProfile
└── explicit Course enrollment 0..N
    └── explicit LessonRun execution capability 0..N

Offline LearnerProfile
└── account_id IS NULL до recipient-bound claim/activation
```

Модель разделяет четыре факта:

- `learner_profile` — о каком человеке накапливается учебная история;
- `teacher_learner` — с каким человеком работает конкретный Account и как он
  называет его в своём справочнике;
- `learning_record.recorded_by_account_id` — кто записал raw observation;
- `learner_observer_grant` — кому subject явно дал learner-safe read access.

Canonical identity сама по себе не открывает Course, чужой teacher directory,
raw history или cross-provider AI. Каждая capability имеет отдельный explicit
boundary.

## Universal Account invariant

Current production contract обеспечивает:

- Auth trigger атомарно создаёт Account, AccountSecurity/Preference и один
  linked LearnerProfile;
- deterministic backfill добавляет профиль каждому existing
  `active | provisional` Account без fuzzy matching;
- nullable unique `learner_profile.account_id` разрешает много offline profiles,
  но не два linked profiles одному Account;
- deferred constraint triggers на `account` и `learner_profile` требуют ровно
  одну связь на commit для active/provisional Account;
- M5 выполняет exactly-one deferred invariant через узкий internal
  `SECURITY DEFINER`: GoTrue достигает commit boundary уже после возврата из
  Auth bootstrap и снова работает как непривилегированный Auth DB actor;
  владелец invariant-функции обязан владеть обеими таблицами, `FORCE RLS`
  запрещён, `search_path` пуст, а direct `EXECUTE` закрыт для `PUBLIC`,
  `anon`, `authenticated`, `service_role` и `supabase_auth_admin`;
- direct link/unlink/delete обход запрещён trigger guard;
- merge, safe unlink, subject erasure/reset и Auth bootstrap используют
  lock-safe supported transaction boundary;
- postflight `active_accounts_without_exactly_one_profile` обязан быть `0`, в
  том числе после concurrent signup/bootstrap/reset/claim.

Onboarding редактирует общие `display_name/locale/timezone` Account и не просит
выбрать постоянную роль. `/courses`, `/schedule`, `/students` и `/profile`
доступны любому authenticated Account; `/learning-profile` сохранён как
protected compatibility redirect на `/profile`, а `/observing` — на
`/students?tab=observing`. Authoring Course по-прежнему owner-only и не
означает learner enrollment.

## Account avatar boundary

Avatar принадлежит login identity `Account`, а не `LearnerProfile`: offline
profiles без Account не обязаны иметь avatar, а observer/teacher relations не
создают собственную копию изображения. Auth metadata, `account_preference` и
Course `stored_file` не являются authority.

Каждый Account имеет ровно одно валидное состояние:

- `preset` с allowlisted key `sd-avatar-v1-01` … `sd-avatar-v1-20` и `NULL`
  Storage path;
- `custom` с `NULL` preset key и owner-scoped UUID WebP path.

Existing Accounts получают deterministic preset backfill, новые — preset
default в той же Account row, поэтому signup и provisional activation не могут
создать avatar-less Account. UI не предлагает действие «убрать avatar».

Custom upload использует отдельный private bucket `profile-avatars`. Browser
принимает JPEG/PNG/WebP до 5 MiB, но server повторно проверяет magic bytes и
decode metadata, запрещает animation/pixel bombs, применяет EXIF orientation,
center crop `512 × 512` и сохраняет только opaque WebP без source metadata.
Каждая версия имеет новый UUID path. У bucket нет browser Storage policies;
после app-session/revocation проверки same-origin server route использует
service credential для Storage и narrow server-only RPC. RPC получает
проверенный server-ом Auth user id, под row lock проверяет expected revision,
exact Account folder и существование object. Pointer switch атомарен. При
неоднозначном результате route повторно читает canonical state и не удаляет
новый object без доказательства, что он не current; cleanup прежнего object
выполняется только после подтверждённого switch.

Public `SessionView` содержит только `{ kind, presetKey, revision }`. Storage
path, Account UUID и signed token в avatar projection не входят; current custom
image отдаёт same-origin authenticated route. Подробный визуальный и
accessibility контракт находится в
[`docs/product/account-avatars.md`](../product/account-avatars.md).

## Account credential boundary

Existing learner login/PIN перенесены из active legacy Student path в:

```text
account_login_alias(normalized_login, account_id)
account_security(pin_hash, lockout, sessions_invalid_before, ...)
account_preference(...)
```

- alias lookup и PIN verification выполняются server-only;
- PIN хранится только как bcrypt hash, после пяти ошибок действует lockout;
- internal Auth email не возвращается browser;
- one-time activation/reset secrets не пишутся в audit/logs;
- session invalidation читает AccountSecurity;
- M1 закрывает direct browser access; expand сохраняет только необходимую
  server-side rollback compatibility;
- M4 удаляет active legacy helpers/grants и rollback-only security dual-write
  только после roleless cutover.

## Discovery и teacher connection

«Добавить ученика» предлагает два безопасных пути до создания offline profile:

1. rotating share code/QR;
2. blind email invitation.

Share code — expiring one-time digest. Он только создаёт pending
`learner_connection_request`; subject сам принимает или отклоняет request.
Email token и recipient email хранятся только как keyed digests; один и тот же
generic response используется независимо от наличия Account. Pending request
не входит в Course audience.

После accept создаётся/активируется только `teacher_learner` с local display
name этого teacher. Teacher не становится observer и не получает raw records
других recorder Accounts.

Если connection невозможен, teacher создаёт обычный offline LearnerProfile и
может отправить recipient-bound приглашение:

- `claim` — recipient подтверждает merge offline source в свой existing
  canonical profile;
- `child_activation` — доверенный recipient активирует отдельный learner
  Account, а не превращает собственный взрослый Account в target.

Token одноразовый, expiring и bound к verified email digest либо заранее
определённому recipient Account. Другой Account получает generic fail-closed
error. Auth callback переносит identity intent в короткоживущий encrypted
HttpOnly handoff cookie; raw invitation token удаляется из URL до page work и
не попадает в Referer.

### Separate learner Account activation

Child activation требует recent reauthentication и явного подтверждения, что
recipient получает отдельное право восстановления login/PIN:

1. server создаёт deterministic provisional Auth user;
2. Auth trigger создаёт его empty target profile;
3. recipient задаёт unique login и PIN, которые teacher не видит;
4. offline source проходит обычный merge в новый target;
5. provisional Account становится active;
6. recovery-delegate grant создаётся атомарно;
7. optional observer invitation создаётся отдельно и требует accept.

Retry идемпотентен: потерянный response не создаёт второй Account и не
реактивирует отозванного recovery delegate. Delegate может reset login/PIN
только после recent reauth; learner может отозвать delegate немедленно.

GoTrue Admin создаёт такого пользователя двумя SQL-действиями в одной
transaction: initial `auth.users INSERT` содержит provider metadata, а custom
`raw_app_meta_data` появляется последующим `UPDATE`. M6 не расширяет обычный
INSERT bootstrap и не считает произвольный metadata field authority. Отдельный
`AFTER UPDATE OF raw_app_meta_data` trigger синхронизирует
`Account.status: active → provisional` только при одновременном выполнении всех
условий:

- `identity_status = provisional`, exact internal learner email и валидный
  `activation_invitation_id`;
- invitation существует, имеет kind `child_activation`, остаётся
  `pending | bound`, не истёк и указывает на offline source profile;
- `auth.users.xmin = account.xmin`, то есть обе строки созданы текущей
  GoTrue transaction;
- bootstrap остаётся pristine: Account не менялся после создания, связан ровно
  с одним profile, не имеет login alias, а AccountSecurity/Preference содержат
  только начальные пустые значения.

Функция trigger — `SECURITY DEFINER` с пустым `search_path`, согласованным
owner/RLS boundary и закрытым direct `EXECUTE`. Trigger реагирует только на
изменение `identity_status` либо `activation_invitation_id`; external email,
отсутствующий/malformed marker, claim invitation, expired invitation или
non-pristine Account не дают provisional capability. Если trusted
same-transaction marker найден, но pristine shape нарушен, вся Auth transaction
abort-ится, а не оставляет частично созданный active Account.

Late downgrade невозможен: после commit любое новое Auth metadata UPDATE
получает другой `auth.users.xmin`, тогда как `account.xmin` сохраняет creation
transaction. Дополнительно established Account уже не pristine, а после
activation invitation/source переходят в terminal state. Повторное добавление
marker поэтому не меняет active Account. M6 backfill применяет тот же exact
predicate и fail closed при unsafe pre-existing mismatch; fuzzy или массового
metadata-driven исправления нет.

## Physical canonical merge

Обычный merge разрешён только `unclaimed source → actor-owned claimed target`.
Claimed → claimed требует отдельного dual-consent recovery contract и в current
scope запрещён.

Preview под locks возвращает fingerprint, counts, blockers и explicit
same-LessonRun conflict resolutions. Confirm повторно проверяет fingerprint и:

- переносит LearningRecord без изменения recorder/pedagogical timestamps;
- дедуплицирует teacher relations, group membership и Course audience;
- сохраняет target teacher-local name, source local name только в private
  metadata audit;
- переносит source data в target и физически удаляет source profile;
- LA-M4 Course enrollment и Run capabilities source profile удаляются по
  canonical FK cascade и намеренно не переносятся на target;
- создаёт immutable `learner_profile_alias` для старого UUID;
- не изменяет observer/AI grants target;
- fail closed, если source неожиданно имеет grants, open/running Run или draft
  records.

Если два finalized records относятся к одному LessonRun, primary сохраняет
`lesson_run_id`. Losing row получает `lesson_run_id = NULL` и
`superseded_by_record_id = primary.id`; остальные поля и recorder сохраняются.
Metadata-only conflict audit хранит IDs/resolution без private text. Обычные
history/progress/AI исключают superseded row.

До confirm recipient может cancel без data mutation. Generic split после
physical merge не обещается.

### Stale UUID behavior

- Одиночные поддерживаемые teacher URLs — profile PATCH/archive/history,
  invitation list/create и permanent delete — резолвят source UUID только
  через actor-scoped alias RPC. Чужой source UUID не раскрывает target.
- Restore резолвит alias внутри DB под тем же teacher boundary.
- Bulk Group/Course/Run payloads не принимают произвольный alias. Старый UUID
  возвращает generic «профиль недоступен»; UI должен reload directory и
  reselect learners.
- Subject erasure удаляет alias физически. После reset старый UUID не резолвит
  и не раскрывает новый profile.

## Teacher directory lifecycle

`/students` показывает `TeacherLearner + LearnerProfile` во вкладках
«Ученики / Группы» и отдельную learner-safe вкладку «Наблюдение» по active
observer grants. Active и archived relations, а также исходящие pending
connection requests находятся в одном teacher directory list: состояние
показывается inline и не скрывается самим lifecycle status. Current source /
next production оставляет рядом с поиском один постоянно видимый membership
toggle **Все / В группе / Без группы**. `В группе` и `Без группы` применяются
только к active teacher relations; archived relations и pending requests
остаются в режиме `Все` и доступны поиском. Прежний disclosure, status,
concrete-group и Account-state filter controls удалены. Отдельного sort select
нет: headers таблиц Students и Groups переключают ascending/descending
повторным кликом. Full-width Students controls используют
`padding-inline: 0`, а 40 px table показывает
`Ученик / Статус / Аккаунт / Группы / Добавлен / actions`. Это UI-only
presentation над теми же actor-scoped rows. Рядом расположен icon-only
presentation control: **Таблица** слева и выбрана изначально, **Карточки**
справа. Табличный и карточный виды используют одну narrowed/sorted выборку,
одинаковые identity/status labels и тот же набор
допустимых contextual actions; на вкладке «Группы» переключатель работает над
тем же `LearnerGroup[]`. Выбор вида не создаёт persisted preference или
отдельный API.

- «Убрать из списка» архивирует только relation данного Account и удаляет его
  mutable Group/Course links; canonical profile, finalized history и roster
  уже открытого Run сохраняются.
- Contextual `MoreVertical` menu active profile может открыть профиль,
  изменить membership и запустить реальный «Добавить в курс…». Course picker
  сохраняет существующую group/direct audience, добавляет learner как direct
  audience только в доступном actor-owned Course и не создаёт observer grant
  или доступ к чужой raw history.
- «Написать сообщение» остаётся disabled и явно недоступным: эта поверхность
  не вводит communication write boundary.
- Restore активирует только relation. Старые Group/Course memberships скрыто
  не возвращаются; действие доступно в архивной строке общего списка.
- Archive/restore одного teacher не меняет relation другого.
- Permanent delete разрешён только для действительно пустого unclaimed
  profile без records, Account link, invitations, grants или других teacher
  relations.

## Self history, progress и comments

Teacher raw history остаётся recorder-scoped. Subject и active observer читают
только отдельную learner-safe projection:

```text
finalized + non-superseded LearningRecord
→ attendance/repeat/titles-at-time
→ known actual duration
→ teacher comment только если shared_with_learner_at IS NOT NULL
→ opaque projection key + cursor pagination
```

Historical comments остаются private. Completion UI использует одно comment
field и отдельное явное действие «Добавить в учебный профиль»; только оно
выставляет `shared_with_learner_at`. Group `teacher_report`, drafts, recorder
identity, teacher-local directory, roster и другие learners не входят в safe
projection.

Progress вычисляется из реальных finalized non-superseded records: число
проведений/посещений/повторов, last activity, subject breakdown и сумма только
известной actual duration. `NULL` не превращается в ноль; speculative mastery,
понимание и generic metrics JSON не создаются.

`lesson_run.started_at_is_actual` отличает explicit start от старого scheduled
fallback. Duration вычисляется из explicit start → end либо вводится teacher
для post-factum completion; existing/unknown values остаются `NULL`.

## Observer ecosystem

Observer — explicit read-only grant, не Parent/Guardian role.

- только linked subject создаёт/revokes invitations и меняет free display label;
- recipient принимает/отклоняет invitation либо позже leaves grant;
- один Account может наблюдать несколько profiles, один profile — иметь
  несколько observers;
- teacher relation ничего не выдаёт observer автоматически;
- observer видит те же safe history/progress fields, что subject;
- observer не создаёт Course, relation, Run или learning data от имени subject;
- revoke проверяется по DB-state и действует на следующий request немедленно;
- invitation/accept/reject/revoke/leave/read события дают metadata-only audit.

UI surfaces:

- `/profile?tab=observers` — grants `observed_by` (люди, наблюдающие
  за subject), управление их подписями и отзывом, а также исходящие invitations;
  входящие invitations наблюдать за другим profile отделены ниже и не входят в
  count собственных observers;
- `/students?tab=observing` — profiles, на которые текущему Account дан active
  grant; прежний `/observing` перенаправляет сюда;
- `/profile` — единый раздел с вкладками `Профиль / История /
Аттестация / Наблюдатели / Настройки`: self history/progress/share code,
  Account settings, AI consents и destructive self lifecycle;
- прежние `/learning-profile`, `/settings`, `/settings/profile`,
  `/settings/security` и `/settings/observers` — только compatibility redirects
  в этот раздел;
- current source / next production protected mobile navigation открывается
  burger-кнопкой вместо avatar. Это единственный navigation dropdown: menu
  header использует browser-safe Account projection — trimmed имя с fallback и
  email только если он не скрыт internal-auth boundary, — а visible
  destinations ограничены пунктами «Расписание / Ученики / Курсы / Магазин /
  Профиль». На protected desktop и authenticated landing avatar ведёт напрямую
  в `/profile`; прежний Account/avatar dropdown, включая shortcuts и sign-out,
  удалён. Account/Auth IDs и private Storage path в browser projection для
  этого не добавляются.

## Subject-only unlink и erasure

Safe unlink — узкий recovery для ошибочной direct link. Он возможен только без
merge lineage, LearningRecord и существующих identity/observer/consent/audience
blockers. LA-M4 grants намеренно не переносятся и не становятся отдельным
unlink blocker: в одной transaction Account-link-change trigger отзывает их у
прежнего profile, прежний profile становится offline, а Account получает новый
empty profile без enrollment/capability, сохраняя exactly-one.

Learning-data erasure/reset требует recent reauthentication, preview counts,
expiring fingerprint и повторного confirm. Оно охватывает current target и всю
source lineage:

- удаляет subject LearningRecord, teacher/group/Course links, invitations,
  observer grants, AI consents, LA-M4 enrollments/Run capabilities и
  credential-recovery grants;
- физически удаляет aliases;
- удаляет/pseudonymizes subject/profile IDs в audit без PII/private text;
- не удаляет LearningRecord других learners, где Account был recorder;
- создаёт новый empty linked profile в той же lock-safe transaction.

Account/Auth deletion, owned Course/File и legal retention не смешиваются с
этим reset.

## Subject-controlled cross-provider AI

AI consent — отдельный grant для `profile + Course + current owner`.

1. Course owner может запросить consent только для effective audience.
2. Subject видит bounded Course title/owner metadata, purpose и expiry, но не
   Course content/enrollment/Student Screen.
3. Subject grants/revokes с expected revision.
4. Owner change, audience removal, expiry или revoke инвалидируют consent.
5. Server-only function проверяет DB-state на каждый request.

Без consent teacher AI получает только собственную recorder-scoped history. С
consent provider получает deterministic bounded sanitized projection всей
canonical lineage:

- aggregates и coarse subject/month buckets;
- bounded categorical signals из explicitly shared comments после PII scrub;
- без row structure, raw IDs, contacts, exact timestamps, foreign Course/Lesson
  titles, recorder identity, private comments и какого-либо comment text/
  summary/quote.

Teacher browser/API не получает foreign raw rows. Assistant дополнительно
scrubs direct quotation of shared summaries. Preview сообщает
`sharedHistoryUsed` и revision; Apply с изменившейся consent revision fail
closed как stale.

## Authorization boundary

- Actor обычного browser request определяется через encrypted app session,
  current Supabase JWT и `auth.uid()`.
- Caller-supplied Auth/Account UUID не является authority.
- Learner live route не принимает profile UUID как subject selector. Он
  декодирует только trusted JWT `sub`/`session_id`, а service-only resolver
  подтверждает их через `auth.sessions`, active Account,
  `account_security.sessions_invalid_before` и exactly-one canonical profile.
- Live authority требует одновременно current explicit Course enrollment и
  matching active per-Run execution capability. Account/profile link,
  Course audience/Run roster, `teacher_learner`, observer grant и AI consent
  без этих capabilities не дают доступа. Course audience/groups не являются
  prerequisite; prerequisite для grant — exact frozen `learning_record` roster
  row и active linked Account.
- Identity/observer/AI/credential tables имеют RLS и нулевые direct privileges
  `anon/authenticated`.
- User-facing RPC возвращают strict allowlisted DTO. Repository валидирует
  nested output `.strict()` и fail closed при unexpected field, включая
  `auth_user_id`, email/token digest, internal email, PIN/session cutoff.
- Administrative RPC доступны только server-side service role и требуют
  explicit actor Auth UUID плюс recipient/secret digest, вычисленные сервером.
- Deferred exactly-one invariant и metadata-sync trigger functions не являются
  RPC surface: direct `EXECUTE` закрыт, table grants Auth actor не выдаются, а
  privileged boundary ограничен проверенным trigger shape и owner/RLS
  invariants. Bootstrap handler отдельно сохраняет узкий server-only
  `service_role EXECUTE` contract для поддерживаемого Auth/application flow.
- `learning_record SELECT` остаётся producer-scoped; self/observer используют
  projection RPC, а не расширенную raw policy.
- Email/link acceptance pages имеют `Cache-Control: no-store` и
  `Referrer-Policy: no-referrer`.
- LA-M4 raw enrollment/capability/presentation tables не получают direct
  `anon/authenticated` grants. Teacher использует owner-scoped narrow RPC;
  learner source resolver доступен только service role, имеет пустой
  `search_path` и повторяет exact session/profile/capability/Run checks.

## Physical implementation map

- migrations:
  `20260807065017_identity_security_hardening.sql`,
  `20260807065026_learner_identity_primitives_backfill_invariant.sql`,
  `20260807065032_learner_identity_workflows_progress_observer_ai.sql`;
- applied contract and Auth-trigger forward fixes:
  `20260807065038_learner_identity_legacy_contract_cleanup.sql`,
  `20260809084500_learner_identity_auth_deferred_invariant_security.sql`,
  `20260809090000_learner_identity_provisional_auth_metadata_sync.sql`;
- Account avatar contract:
  `20260814050347_account_profile_avatars.sql`;
- current production DB LA-M4 forward contract:
  `20260821093000_lesson_run_live_delivery.sql`;
- domain/contracts/service/repositories:
  `src/modules/learner-identity/`;
- learner-safe AI adapter:
  `src/modules/ai/shared-history.ts`, `course-context.ts`,
  `course-builder-service.ts`;
- profile/navigation UI: `src/app/(app)/profile/`, `src/components/profile/`,
  `src/components/learner-identity/learning-profile-workspace.tsx`,
  `src/lib/navigation/profile-nav.ts`, `src/components/session-nav-actions.tsx`;
- Account/avatar UI: `src/components/account/avatar-image.tsx`,
  `src/components/account/avatar-settings-form.tsx`,
  `src/components/account/account-settings-panel.tsx`;
- current routes: `/profile`, `/students?tab=observing`,
  `/identity/invitations/[invitationId]`; `/learning-profile`, `/settings/*` и
  `/observing` — protected compatibility redirects;
- API: `/api/v2/me/learning-profile/*`, `/api/v2/learner-directory/*`,
  `/api/v2/learner-connections/*`, `/api/v2/identity-invitations/*`,
  `/api/v2/learner-merges/*`, `/api/v2/observers/*`,
  `/api/v2/observations/*`, `/api/v2/ai-consents/*` and recipient email routes;
- Account avatar API/server boundary:
  `/api/settings/profile/avatar`, `src/lib/server/profile-avatar-image.ts`,
  `src/lib/server/profile-avatar-storage.ts` и
  `src/lib/server/profile-avatar-reconciliation.ts`;
- current schema guide: `docs/database/current-schema.md`;
- LA-M4 module/routes:
  `src/modules/live-delivery/`,
  `src/app/api/v2/me/live-runs/[lessonRunId]`,
  `src/app/api/v2/lesson-runs/[lessonRunId]/live-delivery/`;
- physical snapshot: `supabase/schema/current-schema.sql`, refreshed from the
  production LA-M5 head `2026-08-21T15:43:37Z` (`74` public tables / `275`
  functions, SHA-256
  `acd73762c061de56a4ae39ec81c25c0b2ce243d2000f04f877e952e2df67473e`).

## Production verification

M5 и M6 применены к production отдельными transactions и завершились
`COMMIT`. Strict production signature подтвердил:

- обе internal Auth-related функции — `SECURITY DEFINER`, owner
  `supabase_admin`, `search_path = ""`;
- `PUBLIC`, `anon`, `authenticated`, `service_role` и
  `supabase_auth_admin` не имеют direct `EXECUTE`;
- M6 trigger включён и имеет exact `AFTER UPDATE OF raw_app_meta_data` shape
  (`tgtype = 17`) с `WHEN` predicate;
- exactly-one violations и trusted live provisional mismatches равны `0`.

Реальный GoTrue Admin probe прошёл полный lifecycle disposable activation:
create вернул HTTP `200`, после чего DB показала одну Auth row, один
`provisional` Account, ровно один linked bootstrap profile и exact invitation
metadata. Admin delete также вернул HTTP `200`; cleanup assertions дали
`0|0|0|0`, без residue Auth/Account/bootstrap profile и disposable
source/invitation fixtures. Fresh install, production-shape upgrade,
concurrency, strict signature и DB acceptance matrices зелёные.

LA-M4 production DB identity/access gate также завершён. Exact migration
`20260821093000_lesson_run_live_delivery.sql` имеет `2535` строк и SHA-256
`7fb531bc199b8d6a24afeb1e01ff2730c8e5388a0cbbd233e2679d8e7825319c`.
Production-derived PostgreSQL `15.8` clone прошёл observed `COMMIT`, safe
rollback/unchanged replay, `134/134` functional assertions, `26/26` LA races и
identity functional/concurrency. После verified backup production owner apply
завершился observed `COMMIT`; LA-M4 relations остались `0/0/0`, все три имеют
RLS и закрытый raw ACL, а exact functions сохранили owner `supabase_admin`,
`SECURITY DEFINER`, empty `search_path` и узкие grants. PostgREST подтвердил
anon raw/teacher denial `401/42501`, service raw denial `403/42501` и service
resolver dummy-subject denial `403/42501`. Authenticated safe-session
application smoke пока не заявлен.

Dependent functional source `e09631d2fa00ad1c4b91ad0584392efb748cf235`
доставлен normal fast-forward push и Coolify deployment `1007`
(`flg9786e15llusgj6kgz7pwk`). Exact image/`SOURCE_COMMIT`, guest auth/host/
Origin/CSRF postflight, final DB identity violations `0/0`, session/profile/
capability negative boundary, ACL/grant matrix, cleanup и retained backup
подтверждены. Independent final audit не нашёл auth/privacy leaks или blockers.
Без safe existing authenticated production session/Run UI smoke **NOT RUN** и
не заявляется; credentials или fixtures не создавались.

## Current / next / later

**Current production contract:** весь identity/observer contract выше,
including roleless navigation, Account credential boundary, discovery,
recipient-bound claim/child activation, M5 deferred invariant boundary, M6
two-phase Auth metadata sync, merge, archive/restore, self/observer
history/progress, erasure, AI consent и exactly-one Account avatar.

**Current acceptance:** Profile/avatar release
`4462da2248dd97bf6ab5c0a35f9a781844473874` развернут и сохраняется в current
source `1d4e5deff83cbdc1b479b16e4220cf799327009f`. `/profile` содержит пять
адресуемых вкладок, а прежние profile/settings URLs остаются только
compatibility redirects. Strict production-build browser acceptance проверяет,
что preset dialog загружает двадцать direct WebP только после открытия,
применяет выбор только по явному `Сохранить`, отменяет его по close/backdrop/
Escape и возвращает focus; upload проходит отдельный preview/confirm flow.
Исторический identity baseline `01aa88a` по-прежнему подтверждает
authenticated self/observer/security navigation, удаление disposable fixture
без orphan rows и закрытие stale session. Identity terminal condition выполнен.

**Current production UI:** self profile, history, attestation, observer
management и Account settings объединены в адресуемые вкладки `/profile`;
compact avatar card открывает отдельные preset и upload dialogs. Это не меняет
observer, consent, credential или subject-lifecycle authorization boundaries.

**Current source / next production navigation:** protected desktop и
authenticated landing используют avatar как прямую ссылку `/profile` без
dropdown. Protected mobile burger открывает единственный navigation dropdown с
Account name/privacy-safe email и пятью основными маршрутами. Profile tabs и
sign-out остаются в самом `/profile`; production rollout ещё не заявлен.

**Current outside identity:** Account-scoped self-learning approved educator
publication хранит собственные revision progress и аттестацию; это не является
LearnerProfile enrollment и не расширяет Course audience.

**Current production DB/source/web LA-M4:** only active linked
canonical profile может получить teacher-issued Course enrollment и active
exact Run capability. Pre-start revoked exact-Run tombstone не является learner authority.
Offline profile остаётся видимым teacher как roster identity, но grant
отклоняется. Explicit revoke/Course archive инвалидируют authority; merge,
erasure и unlink не переносят её. Course owner change блокируется до explicit
revoke всех active enrollments. Audience/group не являются ни prerequisite, ни
authority. Logout/session revocation закрывает следующий
poll. Эти факты не расширяют observer или AI consent.

**Next / later, вне identity completion:** generalized child Course
consumption/attempts за пределами teacher-controlled live Run, persisted
Homework, communication delivery enhancements, billing and external MCP.
Teacher observations и objective/activity evidence уже current production
LA-M1–LA-M3.

Lesson/Run authored invariants remain canonical in
[`lesson-workflow-model.md`](./lesson-workflow-model.md). Provider transport and
budgets remain canonical in
[`ai-provider-integration.md`](./ai-provider-integration.md).
Learning Activity execution/profile state remains canonical in
[`learning-activity-system.md`](./learning-activity-system.md).
