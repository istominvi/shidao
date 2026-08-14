# Current database schema

**Статус:** current production learner-identity M6 + Course publication
catalog + Course Component D1 + A1 atomic Course archive + E1 educator Course
и Account attestation + E2 educator governance/self-learning + E2A authenticated
content-guard correction + U1 unified Text authored data + AV1 Account avatars.
AV1 DB-first contract применён; зависимый web/API contract сохраняется в
текущем functional source `1d4e5deff83cbdc1b479b16e4220cf799327009f`.

**Production schema head:**
`20260814050347_account_profile_avatars.sql`. Она применена к production с
exact `COMMIT` 14 августа 2026 года после read-only sanity, полного rollback
rehearsal и verified backup. Migration добавляет обязательное состояние avatar
в `account`, приватный server-only Storage bucket `profile-avatars` и
revision-aware setter RPC. Exact SHA-256 —
`001f6d9161ce53797456e0e886486fce1a9aa9ab13fe1cd769f764b9f2025201`.

**Последняя применённая authored-data-only migration:**
exact tracked `20260813063716_unify_heading_rich_text_components.sql` применён
production; `psql` зафиксировал `COMMIT`, а maximum `updated_at`
преобразованных строк — `2026-08-13T07:05:50.169297Z`. Self-hosted contour не
содержит relation `supabase_migrations.schema_migrations`, поэтому history row
не заявляется. Migration не меняет table shape; generated snapshot теперь
фиксирует E2A function definition и ACL поверх тех же U1 authored rows.

**Legacy contract migration:**
`20260807065038_learner_identity_legacy_contract_cleanup.sql` — применена после
двух подтверждённых roleless web releases и read-only dependency audit

**Production Auth hardening head:**
`20260809090000_learner_identity_provisional_auth_metadata_sync.sql` — применена
после M5 deferred-invariant fix, отдельных verified backups и реального GoTrue
Admin create/delete probe

**SQL snapshot:**
[`supabase/schema/current-schema.sql`](../../supabase/schema/current-schema.sql)
содержит live production dump после AV1, снятый штатным script через read-only
SSH transport в `2026-08-14T05:53:08Z`. Strict signature осталась
`shidao-v2-contract`, SHA-256 snapshot —
`3ca847164526568def44d2deed9a6b1d6cd1742e168462376b4f41fe6383ef97`.
Локальный PostgreSQL 16 dump не принимается как замена production 15.8
snapshot из-за version/encoding/default-ACL drift.

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
| A1    | `20260811231505_atomic_course_archive.sql`                             | atomic owner-scoped Course soft archive, reverse publication/Run guards, immutable Lesson parent и narrow Course/Lesson browser ACL            |
| E1    | `20260812113000_educator_course_attestations.sql`                      | `children \| educators`, immutable publication attestation, server-side scoring, Account attempts/awards и audience-scoped catalog             |
| E2    | `20260812150745_educator_course_governance_progress.sql`               | trusted educator author capability, exact revision review/approval, self-learning progress, attestation gate и official no-copy invariants     |
| U1    | `20260813063716_unify_heading_rich_text_components.sql`                | applied production data-only unified Text cleanup без physical-schema и immutable-publication changes                                          |
| E2A   | `20260813113041_fix_educator_course_content_guard_acl.sql`             | applied production invoker guard correction с inlined predicate и неизменным закрытым helper ACL                                               |
| AV1   | `20260814050347_account_profile_avatars.sql`                           | applied production required Account avatar, 20 preset keys, private server-only WebP Storage и optimistic setter RPC                           |

M1–M3 являются additive/compatible expand для roleless web. M4 была withheld из
первого deploy и применена только после доказательства, что running и rollback
images не зависят от старого contract. M5 и M6 — атомарные forward security
fixes поверх post-M4 contract; они не восстанавливают legacy role/ACL surface.

U1 был применён только после compatible web deployment и verified full-format
backup. Он перевёл authored `heading` в title-only `rich_text` и объединил
только непосредственные `heading → rich_text` при одинаковых visibility,
`student_slide_id` и placement. Immutable `course_publication_revision`
snapshots остались неизменными.

### Production U1 unified Text authored-data cleanup

Web-first/DB-second rollout завершён 13 августа 2026 года:

- compatible source `dea92ca2c9af99fd5738e95fa9ca511aa10ca3da` был развёрнут
  Coolify deployment `xivwq5nkaak141mc0tw5ysce` до DB apply; running container
  `g9x4d9zn60jv35r7zf0xl6xj-065823494924`, image ID
  `sha256:f0f07ffd8b18ee5faadff5a1f01d0ea5e663807ec6f83754b16d43b64e18379d`,
  restart count `0`;
- preflight: `19` Account, `6` Course, `22` Lesson, `96` Components,
  `heading=17`, `rich_text=38`, safe adjacent pairs `11`, remaining headings
  `6`;
- verified backup
  `/root/shidao-db-backups/shidao-before-unify-heading-rich-text-20260813T070512Z.dump`:
  size `1324116`, mode `600`, `1610` restore entries, SHA-256
  `ee169345af886fd97a3060273b03d20f37dec380a82bbc43eb759e8f098ed775`;
- migration SHA-256
  `874251c80e2a82bbf79897cb12755d606f9e1b546a9a3f51951dfaae89c5e1a3`;
  exact SQL завершил `COMMIT`, maximum `updated_at` преобразованных строк —
  `2026-08-13T07:05:50.169297Z`;
- postflight: `85` Components, `heading=0`, `rich_text=44`; shapes
  `combined=11`, `title-only=6`, `body-only=27`, invalid `0`; `12` Slides,
  empty `0`, dense violations `0`, enabled Component triggers `6`; registry
  parser принял все `85` PostgREST rows;
- immutable publication осталась одной revision: `9056` snapshot bytes,
  content hash
  `0c4aa4246c6b5fb0ac4f136c5387496b531ed0988956d45312471feb9268d32e`,
  `6` snapshot Components, все `rich_text`.

Physical schema, ACL/RLS/functions/triggers shape и generated SQL snapshot не
изменились. Production HTTP postflight был guest-only; authenticated browser
coverage подтверждена exact local strict suite, а authenticated production
browser smoke не заявляется.

### Production E2A authenticated content-guard correction

E2A изменила только definition invoker guard: встроила эквивалентный
join `course → account` и predicate `children OR (active AND capability)`, а
helper сохраняет прежний closed ACL. RLS, column/table grants, trigger set и
authored rows не изменены. Migration checksum —
`f159188b067bb8a8a6bfe837a3d366a68ab40e42876a79db88dd54d1f01b322f`;
rehearsal под `supabase_admin` дошла до `NOTIFY` и откатилась. Перед exact
`COMMIT` создан verified backup
`/root/shidao-db-backups/shidao-before-educator-content-guard-fix-20260813T113940Z.dump`:
size `1324276`, mode `600`, `1595` restore entries, SHA-256
`0b3a6c2d9d5100d721ccd1988a8494a4719e9323f2b13838abfc5011148ae6a7`.
Postflight `12/12` подтвердил `SECURITY INVOKER`, пустой `search_path`,
отсутствие nested helper call, closed helper ACL, семь enabled triggers и
отсутствие policy drift. Counts `19/6/22/85` не изменились; authenticated
educator `rich_text` same-value update прошёл с `rollback_verified=true`.

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

### Production A1 atomic Course archive

Final tracked migration
`20260811231505_atomic_course_archive.sql` имеет SHA-256
`7b43b023dd7692a39c1ab3702f0972c5d2252766a1093c3905b8c80fce24e8f8`.
Reviewer дал GO после clean apply и runtime smoke на production-like clone.
Неизменённый tracked SQL применён к production с `COMMIT` 12 августа 2026 года.

Production evidence:

- verified full-format backup
  `/root/shidao-db-backups/shidao-before-atomic-course-archive-20260811T233315Z.dump`
  имеет size `1146274` bytes, mode `600`, `1427` restore-list entries и
  SHA-256
  `86610eac53eee82ddba0943247876f77c16ec52c076ca1f93945d64bd4900812`;
- exact postflight и rollback probe прошли успешно;
- counts не изменились: `5` active и `0` archived Course, `16` Lessons,
  `90` Components, `6` Slides, `2` attachments/files, `2` Runs/records,
  `0` publications/revisions; invalid invariants — `0`;
- PostgREST видит RPC; anonymous HTTP-вызов закрыт с `401` / `42501`;
- live snapshot снят в `2026-08-12T00:22:27Z`, SHA-256
  `055b3c3ab47afc3c3db86d92c6c7530b3735841e34e4b475101ac96056d853ec`.

A1 добавляет один authenticated `SECURITY DEFINER` RPC
`archive_course(uuid) -> text`. При одном Course row lock он проверяет active
owner через `auth.uid()`, published listing и открытые LessonRun, затем ставит
`course.archived_at`. Stable outcomes: `archived`, `not_found`,
`course_is_published`, `course_has_open_lesson_runs`; чужой и отсутствующий ID
не различаются.

Четыре закрытых trigger guard защищают все пути записи и обратные гонки:

- `trg_course_archive_invariants` запрещает архивировать published Course или
  Course с открытым Run даже privileged direct SQL;
- `trg_course_publication_active_source` сериализует publish на той же Course
  row и не позволяет опубликовать уже архивный source;
- `trg_lesson_run_active_course` не позволяет создать/снова открыть Run у
  архивного Course;
- `trg_lesson_course_immutable` запрещает перенос существующего Lesson между
  Course, который иначе менял бы смысл durable Runs/records и обходил lock
  graph.

Browser ACL сужается: у `authenticated` больше нет table-level `UPDATE` или
`DELETE` на `course`/`lesson`, `course.archived_at` и `lesson.course_id` не
обновляются напрямую. Разрешены только явные authored columns. Trigger-only
`touch_course_from_authoring_child()` и `touch_courses_from_stored_file()`
остаются с пустым `search_path`, получают owner-matched `SECURITY DEFINER` и
закрытый EXECUTE ACL, чтобы child authoring продолжал менять freshness clocks
после сужения parent ACL.

Current SQL snapshot подтверждает RPC/guards/triggers, exact ACL и отсутствие
archived Course с published listing или открытым Run. Зависимый web UI/API
развёрнут production release PR #242 на exact commit
`84ffefecda99d3b0a9da82bf1eaf8ce76d9c6ea1`; это не меняет приведённые выше
DB apply/snapshot evidence.

### Production E1 educator Course / attestation contract

Forward migration `20260812113000_educator_course_attestations.sql` остаётся
историческим E1-слоем под current E2 database contract. Dependent E1 web
deployment и explicit Chinese-course bootstrap также были выполнены. E1 adds:

- `course.learning_audience` and the denormalized
  `course_publication.learning_audience`, default/backfilled to `children`;
- one mutable owner-authored `course_attestation` definition per educator
  Course and an immutable `course_publication_attestation` sidecar per exact
  publication revision;
- immutable `course_attestation_attempt` and `course_attestation_award` rows
  scoped to the active Account and exact revision;
- authenticated aggregate RPC for owner definition replacement, safe test
  projection, stale-revision-checked and rate-limited server-side scoring, and
  profile awards;
- service-only publication/clone/duplicate/catalog wrappers that preserve the
  audience and definition but never copy attempts or awards. В историческом E1
  educator clone разрешался только после award на current revision. Current E2
  supersedes этот compatibility rule: educator Course нельзя copy, clone или
  duplicate независимо от award; reuse остаётся только для `children`.

Correct answer keys stay in closed authored/publication tables. Browser roles
have no direct read or write privilege on definition/result tables; pre-pass
projection omits correct choices and scoring derives both the percentage and
award atomically in SQL. The separate explicit Chinese-course bootstrap is
product data and therefore is not part of the E1 migration.

Production DB execution evidence, 12 августа 2026 года:

- exact migration SHA-256
  `f5aa1d3cee3e170f48e3ba2b0b3a564b31ad826b79e61efcaf7f342c3f2ff164`;
- verified full-format backup
  `/root/shidao-db-backups/shidao-before-educator-attestations-20260812T023442Z.dump`
  имеет size `1158743` bytes, mode `600`, `1441` restore-list entries и
  SHA-256
  `eb7654393262d51642ff5b9cfb24d80df9a55608426ee02a7fb49e0bf9985ab6`;
- exact rollback probe прошёл; неизменённый tracked SQL применён owner
  `supabase_admin` с `ON_ERROR_STOP` и завершился `COMMIT` в
  `2026-08-12T02:35:45Z`;
- preflight: `19` Account, `5` Course, `16` Lesson, `90` Component,
  `0` publication и `0` revision; postflight сохранил counts, все `5` Course
  backfilled как `children`;
- четыре новые table имеют RLS и closed browser ACL; postflight подтвердил
  `10` E1 RPC и `8` E1 triggers;
- rollback-only functional probe подтвердил safe projection без answer key,
  stale-revision rejection с SQLSTATE `40001` и server-derived результат
  `9/10 = 90%` с atomic award; тестовые строки были откатаны;
- live snapshot сгенерирован в `2026-08-12T02:53:14Z`, SHA-256
  `d96a357a8b55caa80a831b37b7e289c17025c572d79483d28ae7515b30bcf9e2`.

Dependent web и bootstrap production evidence:

- typecheck, lint, format и build прошли; unit suite `522/522`, strict
  production-mode browser suite `22/22`;
- Coolify завершил deployment exact functional commit
  `28387a9863afeccf4a6ad332dcf0f01048a69e67`; release postflight подтвердил
  exact `SOURCE_COMMIT`, соответствующий image и restart count `0`;
- live host/CSRF/API postflight прошёл;
- production bootstrap завершился `COMMIT` в `2026-08-12T03:10:45Z`;
- финальный read-only postflight подтвердил один active target, один educator
  Course «Современный урок китайского языка для детей: произношение,
  иероглифика и формирующее оценивание», `6/6/6` Lessons/Components/Slides,
  одно authored definition и `10` questions, одну publication с одним
  immutable definition, одну attempt и одну award;
- server-derived result равен `9/10 = 90%` при threshold `80%`,
  `passed=true`; authenticated projection вернула `certified=true` и `10`
  post-award review keys, профиль содержит одну credential по этому Course.

### Production E2 educator governance / self-learning database contract

Forward migration
`20260812150745_educator_course_governance_progress.sql` является базой
текущего educator contract под последующими E2A и AV1 migrations. Она
добавляет trusted-author capability
`account.can_author_educator_courses`, exact review/approval educator revision,
`approved_revision_id`, revision-scoped self-enrollment/Lesson completion и
server-side `100%` attestation gate. Educator revisions имеют official-learning
license и не участвуют в catalog copy/duplicate, roster, group assignment или
LessonRun. Зависимый E2 web/API впервые развёрнут из exact functional commit
`22b486a7163453019d9720cb4fe0f36ed7c0228d`; текущий application release
`1d4e5deff83cbdc1b479b16e4220cf799327009f` сохраняет этот contract.

Production DB execution evidence, 12 августа 2026 года:

- exact migration SHA-256
  `ccd0ac3a40df305bb43c095733663ca03ff854ae6ffc1cca9e59fd3485ea2c26`;
- verified full-format backup
  `/root/shidao-db-backups/shidao-before-educator-governance-20260812T071511Z.dump`
  имеет size `1259425` bytes, mode `600`, `1541` restore-list entries и SHA-256
  `cf8e68638f79c631c714ebed43a17a58ceedb508faa96d4de62a8f414a5a3f98`;
- первый rollback probe выявил конфликт legacy license backfill с immutable
  revision trigger и полностью откатился. Повторная проверка подтвердила
  прежние counts и reuse license; исправленный rollback probe v2 прошёл;
- exact tracked migration завершилась `COMMIT` в
  `2026-08-12T07:34:36Z`;
- postflight сохранил `19` Account, `6` Course, одну publication, одну revision,
  одну attempt и одну award. Existing educator publication осталась official и
  approved; связанный award получил complete progress `6/6 = 100%`;
- authored attestation result сохранился как `90%` при threshold `80%`, catalog
  возвращает одну approved educator publication;
- educator origin, direct/group roster и LessonRun равны `0`; RLS, closed ACL,
  revision license/immutable triggers и authenticated progress/attestation RPC
  прошли postflight;
- live snapshot сгенерирован в `2026-08-12T07:46:11Z`, SHA-256
  `a34a5a5919ea406050a5c0cb7f39310d1a9e807725e608166f63becb8f2260a4`.

Dependent web/API rollout завершён Coolify deployment
`ikw0bj347reelzotaqo15a39` (`2026-08-12T07:56:00Z` —
`2026-08-12T07:58:39Z`, Success, `2m39s`). Container
`g9x4d9zn60jv35r7zf0xl6xj-075600861579` использует image tag exact functional
commit и image ID
`sha256:214e954aed0355c1881ea778e65dcb7f4c4cabcde4d7ac2e3f6022322bd8e027`;
`SOURCE_COMMIT` совпал, restart count `0`. HTTP postflight подтвердил V2
login/robots `200`, guest `/courses` `307` в login, landing root `200`,
landing login/API `503`, missing/wrong CSRF Origin `403` и exact V2 Origin без
session `401`.

Superseded deployed source был подтверждён отдельным read-only runtime
postflight:

- exact repository commit и `SOURCE_COMMIT`:
  `0c8946f95ebeb31e02955a110fc057f761f07ea9`;
- running container `g9x4d9zn60jv35r7zf0xl6xj-083519444597` использует
  image tag
  `g9x4d9zn60jv35r7zf0xl6xj:0c8946f95ebeb31e02955a110fc057f761f07ea9`
  и image ID
  `sha256:8119de725edeb042eaf1fcecb38d3fa5052aaf44e81e9fb3965d6c594b1731d1`;
- container имеет status `running`, restart count `0` и started at
  `2026-08-12T08:37:57.909983639Z`;
- повторный HTTP smoke подтвердил V2 `/login` и `/robots.txt` `200`, guest
  `/courses` `307` в `https://v2.shidao.ru/login` и landing root `200`.

Исторический U1-compatible application source
`dea92ca2c9af99fd5738e95fa9ca511aa10ca3da` подтверждён matching running image
и guest HTTP postflight. Unified Text data cleanup не добавлял database
objects, Storage buckets или physical-schema shape. Текущий application
source `1d4e5deff83cbdc1b479b16e4220cf799327009f` сохраняет этот contract, а
актуальные AV1 schema head и generated snapshot зафиксированы в начале
документа.

## Current repository tables

### Course Builder, audience и history

| Table                                  | Назначение                                                                                                       |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `account`                              | единая roleless login identity; status, trusted educator-author capability и обязательное canonical avatar state |
| `course`                               | Account-owned authoring Course; `learning_audience`, publication clock и recoverable `archived_at` lifecycle     |
| `lesson`                               | ordered Lesson с обязательным title/teacher-only summary и immutable Course parent                               |
| `lesson_component`                     | единственный ordered component list Lesson                                                                       |
| `lesson_student_slide`                 | persisted learner presentation grouping без собственного content                                                 |
| `stored_file`                          | Account-owned metadata private Storage object                                                                    |
| `course_attachment`                    | ownership-checked Course ↔ StoredFile                                                                            |
| `course_publication`                   | stable catalog listing; audience, current candidate и nullable exact approved educator revision                  |
| `course_publication_revision`          | immutable allowlisted snapshot, hash, rights audit и reuse/official-learning license                             |
| `educator_course_revision_review`      | service-reviewed pending/approved/rejected audit exact educator revision                                         |
| `course_publication_self_enrollment`   | Account progress/resume parent для exact approved publication revision                                           |
| `course_publication_lesson_completion` | completed Lesson refs для exact Account/publication revision                                                     |
| `course_attestation`                   | owner-authored current test definition for an educator Course                                                    |
| `course_publication_attestation`       | immutable answer-key sidecar for one publication revision                                                        |
| `course_attestation_attempt`           | immutable Account answer/score audit for one exact publication revision                                          |
| `course_attestation_award`             | durable Account credential issued only from a passed attempt                                                     |
| `course_publication_asset`             | immutable private publication copy metadata; nullable live StoredFile provenance                                 |
| `course_publication_origin`            | immutable provenance установленного из каталога рабочего Course                                                  |
| `learner_profile`                      | canonical учебная identity; один linked profile на active/provisional Account либо offline `account_id IS NULL`  |
| `teacher_learner`                      | teacher-local display name и reversible archive relation                                                         |
| `learner_group`                        | reusable Account-owned group                                                                                     |
| `learner_group_member`                 | group ↔ canonical profile                                                                                        |
| `course_learner`                       | direct Course audience source                                                                                    |
| `course_learner_group`                 | group Course audience source                                                                                     |
| `lesson_run`                           | конкретное назначение/проведение Lesson; новый/open Run требует active parent Course                             |
| `learning_record`                      | expected learner, затем finalized individual result и recorder provenance                                        |

### Course publication repository contract and current A1 archive lifecycle

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
- rights audit сохраняет timestamp и внутренний license code: child catalog
  reuse использует `shidao_catalog_reuse_v1`, educator revision —
  `shidao_official_learning_v1`. Это не выбранная Creative Commons лицензия;
  official educator license не разрешает copy/clone/duplicate;
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
- A1 сериализует publish и archive на одной Course row. Published listing
  блокирует archive с `course_is_published`, а publication guard не позволяет
  снова опубликовать уже архивный source;
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

Все publication/review/progress tables имеют RLS, но не имеют прямого
browser-access сверх явно описанных self projections. `postgres` и
`service_role` получают необходимые table privileges; browser работает через
authenticated application route.

Исторический C1 implementation boundary сохранён в snapshot для child catalog:

- `publish_course_revision_admin(...)`;
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

Current E2 application boundary использует audience/attestation-aware wrappers:

- `publish_course_revision_with_attestation_admin(...)` и E2-overridden
  `unpublish_course_publication_admin(...)`; educator publish создаёт exact
  review candidate, а unpublish закрывает pending review как withdrawal;
- `list_course_publication_catalog_v2_admin(...)` показывает educator listing
  только по exact `approved_revision_id`;
- `clone_course_publication_with_attestation_admin(...)` и
  `duplicate_course_with_attestation_admin(...)` сохраняют child reuse, но
  fail closed для educator Course;
- `approve_educator_course_revision_admin(...)` и
  `reject_educator_course_revision_admin(...)` являются service-only exact
  revision review boundary.

### Account avatar persistence (current AV1)

`account` владеет avatar независимо от Auth metadata и learner identity:

```text
avatar_kind: preset | custom, default preset
avatar_preset_key: sd-avatar-v1-01 .. sd-avatar-v1-20 | null
avatar_storage_path: <account UUID>/<object UUID-v4>.webp | null
avatar_revision: integer >= 1
avatar_updated_at: timestamptz
```

CHECK-инвариант требует ровно один источник: preset имеет allowlisted key и
не имеет Storage path; custom имеет Account-scoped path и не имеет preset key.
Existing Account backfill детерминированно распределяется по 20 ключам через
digest Account UUID, сохраняя прежний `account.updated_at`; новые Account
получают `sd-avatar-v1-01` как обязательный fallback до последующей замены.

`set_current_account_avatar(uuid,text,text,text,integer)` — server-only
`SECURITY DEFINER` с пустым `search_path`. Same-origin route сначала проверяет
пользовательскую сессию, затем передаёт её Auth user UUID как
`p_actor_auth_user_id` через service role. Setter отклоняет null actor, находит
только `active | provisional` Account, блокирует строку, сравнивает
`p_expected_revision`, возвращает `40001/account_avatar_stale` при конфликте и
увеличивает revision только внутри commit. Для custom он требует уже
существующий object в `profile-avatars` и exact folder найденного Account;
`owner_id` не является authority, потому что object загружает service-role
route. Возврат содержит новый безопасный avatar state и previous Storage path
для server cleanup. `EXECUTE` есть только у `postgres/service_role`; он явно
отозван у `PUBLIC/anon/authenticated`. Direct UPDATE avatar columns у браузера
также отсутствует.

`current_account_auth_context()` сохраняет прежние поля и их порядок, затем
добавляет `avatar_kind`, `avatar_preset_key`, `avatar_storage_path`,
`avatar_revision`, `avatar_updated_at`, что допускает DB-first rollout старого
web и даёт новому server canonical state.

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
set_current_account_avatar                   # service_role only, revision-aware actor
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

| Surface                                        | `authenticated` direct access                                                                                                   | Supported boundary                                           |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Course/Lesson                                  | owner `SELECT/INSERT` + allowlisted authored-column `UPDATE`; no direct `DELETE`, `archived_at` или `course_id` update после A1 | RLS + owner service, `archive_course` и Lesson lifecycle RPC |
| Component/Slide/File                           | existing owner-scoped permissions                                                                                               | RLS + owner service/RPC                                      |
| Publication/revision/asset/origin              | none                                                                                                                            | server-only service-role adapter + closed admin RPC          |
| Attestation definition/attempt/award           | none; `course.learning_audience` задаётся при create и затем immutable                                                          | owner/self aggregate RPC + service-only publication wrappers |
| `learner_profile`                              | own canonical row `SELECT`; no direct mutation                                                                                  | supported identity workflows                                 |
| `teacher_learner`, groups, audience, runs      | existing teacher-scoped read; mutation via aggregate RPC                                                                        | actor ownership                                              |
| raw `learning_record`                          | recorder-scoped teacher `SELECT` only                                                                                           | lifecycle RPC                                                |
| Account credential/identity/observer/AI tables | none for `anon/authenticated`                                                                                                   | narrow RPC/server adapter                                    |
| learner-safe self/observer history             | no raw table access                                                                                                             | safe projection RPC                                          |

E2A устранила прежнюю техническую блокировку owner-scoped
Course/Component/Slide/File mutations nested helper ACL, не расширив целевую
RLS-модель.

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
- private bucket `storage.buckets.profile-avatars` с лимитом
  1 MiB и единственным MIME `image/webp`;
- Course asset owner policies `storage.objects`
  SELECT/INSERT/UPDATE/DELETE;
- для `profile-avatars` нет ни одной browser Storage policy: same-origin route
  после проверки сессии выполняет SELECT/INSERT/DELETE только через service
  role; каждый custom avatar получает новый immutable exact
  `<account UUID>/<UUID-v4>.webp` path;
- grants/default ACL.

Current AV1 public snapshot дополнительно сохраняет `archive_course`, все
четыре guard functions/triggers, `SECURITY DEFINER` у двух private touch-helper,
закрытые function ACL и column-only Course/Lesson update grants.

## Absent from active model

В active model по-прежнему нет Methodology, Lesson Step/root Step,
`lesson_run_participant`, operational LessonRun snapshot, persisted Run/Record
status, Homework persistence, parsing/RAG, learner enrollment/consumption
детского Course или live Student Screen. E2 educator self-learning progress —
отдельный Account-scoped contract без roster/Run. Observer capability не
является Parent/Guardian role, а
AI consent не является Course access.

## Snapshot refresh workflow

`scripts/refresh-schema-snapshot.sh` принимает ровно два строгих compatibility
stage: `expand` сохраняет полный legacy compatibility contract, `contract`
требует завершённый M4 cleanup. Оба stage дополнительно требуют полный M1–M3
identity contract, M5/M6 Auth hardening и current A1/E1/E2 database contract.
В обоих
signature проверяет:

- все M1–M3 tables/functions/columns и exactly-one invariant;
- M5/M6 `SECURITY DEFINER` owner/ACL boundaries, exact Auth trigger shape и
  отсутствие trusted live provisional mismatch;
- default-deny identity tables;
- полный известный compatibility helper/type/ACL set на `expand` либо его
  полное отсутствие на `contract`; частично применённый cleanup отклоняется;
- отсутствие Step/Methodology/participant/snapshot/status;
- atomic Course archive RPC, четыре reverse-path guard trigger, immutable
  Lesson parent, exact Course/Lesson column ACL и закрытые touch-helper;
- E1 attestation tables/RPC/ACL и E2 trusted-author/review/progress tables,
  official revision license trigger, approved-revision invariants и closed
  browser ACL;
- AV1 Account avatar columns/checks, server-only setter ACL, private
  `profile-avatars` bucket и полное отсутствие Storage policies для него;
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
publication schema этот script зафиксировал D1 cleanup в current `contract`
snapshot. После production A1 тот же workflow зафиксировал snapshot
`2026-08-12T00:22:27Z` с archive RPC, guards и narrowed ACL. После production
E1 current snapshot `2026-08-12T02:53:14Z` дополнительно фиксирует Course
audience, четыре attestation tables, их RLS/ACL, `10` RPC и `8` triggers. После
production E2 current snapshot `2026-08-12T07:46:11Z` фиксирует trusted-author
capability, exact review/approval, revision-scoped progress, official license
и no-copy/no-roster/no-Run guards; SHA-256
`a34a5a5919ea406050a5c0cb7f39310d1a9e807725e608166f63becb8f2260a4`.
После E2A тот же workflow зафиксировал исправленный content-guard contract, а
после production AV1 — обязательное Account avatar state, private
`profile-avatars` bucket и server-only setter. Текущий snapshot снят
`2026-08-14T05:53:08Z`, SHA-256
`3ca847164526568def44d2deed9a6b1d6cd1742e168462376b4f41fe6383ef97`.
