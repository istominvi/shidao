# Промпт: завершить learner identity и observer ecosystem

**Статус:** copy-paste hand-off для новой Codex-сессии

**Актуально на:** 7 августа 2026 года

Скопируйте весь текст ниже, начиная со слов «Работай в репозитории», в новую
сессию. Промпт намеренно требует не очередной фундамент, а законченные
пользовательские workflows, production migration и deployment.

---

Работай в репозитории `/Users/user/Documents/shidao`.

Цель задачи — полностью реализовать оставшуюся learner identity / observer
ecosystem ShiDao V2, проверить её, актуализировать документацию, применить
production migrations и запушить `main`, чтобы Coolify развернул точный итоговый
commit. Не ограничивайся обсуждением, схемой или одним промежуточным vertical
slice.

Продолжай до terminal condition из конца этого промпта. Не проси пользователя
выбирать очевидные технические детали: принимай минимальные, безопасные и
аргументированные решения самостоятельно. Вопрос нужен только тогда, когда без
нового внешнего полномочия, недоступного секрета или необратимого продуктового
решения действительно нельзя продолжать.

## Обязательная ориентация

Перед изменениями:

1. Прочитай корневой `AGENTS.md`.
2. Затем строго в этом порядке прочитай полностью:
   - `docs/project-state.md`;
   - `docs/roadmap.md`;
   - `docs/architecture/learner-identity-access-model.md`;
   - `docs/architecture/lesson-workflow-model.md`;
   - `docs/database/current-schema.md`;
   - `supabase/schema/current-schema.sql`.
3. Проверь `git status`, ветку, последние commits, routes, services и фактическую
   схему. Функциональный hand-off baseline — canonical-profile release
   `757044c`, но источником истины являются текущие code/schema/docs.
4. Используй Supabase и Postgres best-practices skills, если они доступны.
5. Для независимых аудитов и тестов используй subagents, но обязательные
   документы и skill-инструкции прочитай сам.
6. Составь рабочий план и обновляй его, но после ориентации сразу приступай к
   реализации.

## Что уже работает и не должно быть переделано второй архитектурой

- `Course → Lesson → ordered Components`;
- Lesson одновременно является содержанием и назначаемой единицей;
- `LessonRun` хранит конкретное проведение и может повторяться для всей
  аудитории или subset;
- `LearningRecord` хранит per-learner attendance, repeat recommendation,
  комментарий и provenance преподавателя;
- отдельные `lesson_run_participant`, snapshot урока и persisted status machine
  не нужны;
- canonical `learner_profile` уже не принадлежит преподавателю;
- nullable unique `learner_profile.account_id` уже резервирует one-to-one link;
- `teacher_learner` хранит teacher-local имя и archive state;
- группы и смешанная Course audience уже используют canonical profiles;
- teacher history и текущий AI context ограничены
  `learning_record.recorded_by_account_id`;
- `/students` уже имеет вкладки «Ученики / Группы», CRUD, фильтры, группы и
  teacher-scoped history;
- production migration `20260807033034_canonical_learner_profile.sql` уже
  применена.

## Согласованные продуктовые и архитектурные решения

1. `Account` — единственная login identity. У него нет взаимоисключающей
   продуктовой роли. Один Account может одновременно создавать курсы, учиться,
   наблюдать нескольких людей и иметь нескольких наблюдателей.
2. Не вводи доменные роли «родитель», «ребёнок», «бабушка», «тренер».
   «Наблюдатель» — read-only relationship/capability между Account и
   LearnerProfile, а не тип Account.
3. После завершения identity bootstrap каждый активный Account имеет ровно один
   linked canonical LearnerProfile. Offline LearnerProfile без Account
   разрешены. Один Account нельзя связать с двумя active canonical profiles.
   Это DB invariant, а не только application convention: Account + profile
   создаются атомарно, deferred constraint trigger или эквивалентная
   transaction-safe проверка требует ровно одну связь на commit, а прямые
   unlink/delete обходы запрещены. После backfill postflight обязан показать
   `active_accounts_without_exactly_one_profile = 0`.
4. Учитель, создавший или пригласивший ученика, не становится наблюдателем и не
   получает глобальную историю. Он видит raw LearningRecord только тех занятий,
   которые записал сам.
5. Сам учащийся и его активный наблюдатель видят learner-safe finalized историю:
   attendance, repeat, titles-at-time, actual-duration/progress и только
   комментарии с explicit `shared_with_learner_at`. Исторические
   `teacher_comment` остаются private по умолчанию. Completion UI должен явно
   предлагать «Комментарий в учебный профиль» и до публикации объяснять
   преподавателю его видимость. Они не видят drafts, непубличные comments,
   teacher-local directory, Auth/security data или групповые
   `lesson_run.teacher_report`, способные раскрыть других учеников.
   Это сознательная privacy-граница: AI текущего преподавателя может использовать
   его собственные recorder-scoped private comments, но subject, observer и
   cross-provider AI получают только явно опубликованные comments.
6. Cross-provider AI context разрешён только после отдельного явного согласия
   владельца LearnerProfile для ключа `profile + Course + owner`. Owner обязан
   совпадать с current Course owner. Согласие имеет expiry/revision и становится
   недействительным при
   revoke, смене owner или удалении profile из Course audience. Оно не открывает
   преподавателю raw records других преподавателей.
7. При AI consent provider получает только deterministic bounded sanitized
   projection всей canonical lineage: aggregates, allowlisted metrics и
   PII-redacted, de-attributed explicitly shared comments без row structure. Не
   передавай foreign Course/Lesson titles, exact timestamps, recorder identity,
   технические IDs, контакты или private teacher data. Comments не цитируются в
   teacher-facing результате. Teacher-facing API не возвращает чужие raw rows,
   а UI честно сообщает, что AI использовал разрешённую общую историю.
8. Учебный профиль остаётся проекцией над LearningRecord и lineage, а не копией
   уроков. Полный snapshot Lesson не вводить.
9. Duplicate merge не теряет историю. Active data физически переносится в один
   canonical target; source перестаёт существовать как профиль, а его старый
   UUID сохраняется только в immutable alias/lineage audit для idempotency и
   старых ссылок.
10. Если оба дубля имеют LearningRecord одного LessonRun, нельзя молча удалить
    один результат. Merge доступен только для finalized records. Выбранная
    primary запись сохраняет `lesson_run_id`; losing record переносится в target
    с `lesson_run_id = NULL` и `superseded_by_record_id = primary.id`.
    Pedagogical/provenance поля losing record остаются неизменными, а immutable
    conflict audit хранит record IDs, исходный LessonRun ID и resolution без
    private text. Обычные history/progress/AI projection исключают superseded
    records.
11. Повторный урок создаёт новый LessonRun/LearningRecord и дополняет историю,
    не перезаписывая старую.
12. Teacher-local имена не становятся глобальными. При merge сохраняй отдельный
    `teacher_learner.display_name` каждого преподавателя.
13. Не делай fuzzy-публичный поиск людей по имени. «Найти аккаунт» использует
    rotating one-time share code/QR; opt-in exact handle допустим как
    дополнительный exact-only способ. Код только находит subject и создаёт
    pending request — связь активируется самим получателем. Email можно
    использовать для отправки invitation, но ответ не должен превращаться в
    account-enumeration oracle.
14. Invitation, claim, observer и AI-consent tokens одноразовые, ограничены по
    сроку, хранятся только как digest, поддерживают revoke/accept audit и не
    попадают в logs. Email token привязан к digest подтверждённого адреса или
    конкретному Account recipient и после accept не может быть перепривязан.
    Claim screen явно предупреждает «Вы входите в аккаунт учащегося»; неверный
    Account получает generic error. Unbound bearer claim запрещён.
15. Преподаватель может предложить connection/claim/merge, но не может сам
    присоединить чужой Account, назначить наблюдателя или завершить merge без
    необходимого согласия владельца identity.
16. Новые таблицы и RPC default-deny: RLS, narrow grants, subject/actor checks и
    negative tests. Не копируй legacy broad ACL.
17. Активная V2 становится roleless, даже если compatibility tables временно
    остаются до безопасного удаления. Готовность определяется отсутствием
    зависимости active routes/services от `teacher/parent/student`, а не
    рискованным удалением исторических данных.

## Фаза 0. Identity/security hardening

До расширения identity-доступа закрой P0 debt из roadmap:

- инвентаризируй callers `user_preference`, `user_security`,
  login/onboarding/PIN/session invalidation и legacy `SECURITY DEFINER` RPC;
- сузь broad grants и включи корректный RLS либо закрой direct Data API access;
- actor должен определяться через `auth.uid()`, а не доверенный
  caller-supplied user ID;
- добавь positive/negative Auth regression tests;
- сделай явный production host allowlist;
- unsafe V2 requests должны принимать только app Origin, а landing/unknown
  routed hosts не должны проходить CSRF boundary;
- не меняй SMTP, JWT/API keys, базовый Storage или Auth configuration;
- не читай и не печатай ignored legacy credential cheat sheet.

## Фаза 1. Universal Account и canonical-profile bootstrap

- Создавай один canonical LearnerProfile атомарно для каждого нового Account.
- Закрепи exactly-one DB invariant deferred constraint trigger либо
  эквивалентной transaction-safe схемой на обеих сторонах связи. Direct
  link/unlink/delete запрещены; bootstrap, merge и reset идут через lock-safe
  RPC/transaction boundary.
- Backfill существующим Account без linked profile выполняй детерминированно.
- Если точное legacy соответствие неоднозначно, не объединяй людей эвристически.
- Onboarding собирает общие данные Account, а не постоянную роль.
- Любой authenticated Account может открыть пустые «Курсы», «Расписание» и
  «Ученики», начать преподавать, стать учащимся или наблюдателем.
- `/courses` в этой программе остаётся owner/authoring surface. Пустой раздел
  означает возможность начать преподавать, а не learner enrollment или доступ к
  чужому Course.
- Замени `teacher-required` gating на authenticated Account + ownership/relation
  checks.
- Добавь «Мой учебный профиль», «Наблюдение» и «Наблюдатели» по фактическим
  данным/связям, без role switch.
- Сохрани login, signup, recovery, PIN и session invalidation существующих
  пользователей.
- Перенеси legacy `student.login/internal_auth_email` и PIN/login lookup на
  Account-scoped alias/credential boundary без plaintext secrets. После cutover
  обычный login не должен читать `student` только ради определения actor kind.
- Однозначные legacy student → Auth user links backfill в Account/canonical
  profile. Legacy parent → student links не превращай молча в глобальный доступ:
  создай pending reconciliation/observer invitations, требующие consent
  владельца profile; неоднозначные связи оставь в review UI.
- Active Course Builder и identity services не читают legacy
  `student/class/parent/teacher` как источник новой модели.
- Если compatibility tables пока нельзя удалить безопасно, оставь их dormant,
  докажи отсутствие active dependencies тестами и опиши это честно.

## Фаза 2. Account discovery, connection и offline invitation/claim

Реализуй UI «Добавить ученика» в таком порядке:

1. Сначала «Найти аккаунт» по rotating one-time share code/QR или opt-in exact
   handle либо отправить invitation на email без раскрытия факта существования
   Account.
2. Любой найденный Account сначала получает pending connection request. Ни
   share code, ни QR, ни teacher action не активируют `teacher_learner` без
   accept самого получателя.
3. Если аккаунта нет или выбран offline workflow, создаётся offline profile.
4. В offline-профиле есть действие «Пригласить в ShiDao»: teacher указывает
   recipient email либо выбирает уже подтверждённый target Account. Expiring
   one-time link можно скопировать, но принять его способен только этот recipient
   после проверки verified identity; unbound bearer claim не создаётся.
5. Получатель использует существующий signup/login; преподаватель не создаёт и
   не рассылает пароль. Email invitation привязан к verified email digest или
   заранее определённому recipient Account; claim link показывает, какой тип
   identity сейчас будет подтверждён, и fail closed для другого Account.
6. Accept связывает teacher с canonical profile Account. Если у Account уже есть
   profile, показывается merge preview.
7. Pending invitation не попадает в active Course audience.
8. Неиспользованное приглашение можно отозвать; повторный accept идемпотентен.

Для ребёнка или другого offline learner без собственного email реализуй
recipient-bound activation отдельного learner Account:

- teacher создаёт только offline profile и отправляет activation invitation на
  verified email доверенного получателя;
- accept screen явно говорит, что активируется отдельный Account учащегося, и
  никогда не использует уже открытый Account родителя/получателя как merge
  target;
- recipient задаёт учащемуся уникальный login и PIN/password через
  Account-scoped credential alias/recovery boundary; teacher не видит secret;
- provisional Account становится active и получает ровно один profile в той же
  transaction, после чего unclaimed source проходит обычный preview/merge в его
  пустой target;
- observer request для получателя создаётся отдельно и не активируется
  автоматически;
- UI предлагает switch/отдельный вход и fail closed при попытке принять детский
  claim текущим взрослым Account.

Нужны server-side rate limit, generic not-found response и audit
create/accept/revoke/expire. Не отдавай browser token digest, Auth ID или email
другого пользователя.

В этом expand-slice создай узкие primitives, нужные последующим flow:
invitation/claim, merge operation/alias, `learner_observer_grant`, отдельный
`learner_ai_consent` и metadata-only identity audit. Таблицы могут оставаться
dormant до своей фазы; не заменяй observer и AI consent одним универсальным
grant и не открывай capability раньше UI/service/RLS slice. Тогда merge/erasure
RPC не будут ссылаться на ещё не существующие таблицы.

## Фаза 3. Безопасный duplicate merge

Реализуй atomic, idempotent, lock-safe merge:

- один active canonical target;
- обычный пользовательский merge разрешён только из unclaimed source в
  actor-owned claimed target; claimed → claimed fail closed и остаётся вне этого
  scope, потому что требует отдельного dual-reauth/dual-consent recovery процесса;
- source data физически переносится в target; source profile удаляется, а его
  UUID остаётся только в immutable alias/lineage mapping;
- `teacher_learner`, group membership и direct Course audience объединяются без
  дублей. Если unclaimed source неожиданно имеет active observer/AI grant, merge
  fail closed; target grants не изменяются;
- если один teacher связан с обоими profiles, target local name сохраняется,
  relation active, если active хотя бы одна, а source local name попадает только
  в private merge audit;
- LearningRecord не теряются;
- merge разрешён только при отсутствии draft LearningRecord и open/running
  LessonRun у source и target; UI требует сначала завершить/отменить проведение
  и finalize/discard draft, а rejected merge не меняет Run/records;
- same-LessonRun conflict разрешается только между finalized records: primary
  сохраняет `lesson_run_id`, losing record получает `lesson_run_id = NULL` и
  `superseded_by_record_id = primary.id`; остальные значения, recorder и
  timestamps сохраняются, metadata-only audit фиксирует resolution, а обычные
  history/progress/AI исключают losing record;
- scheduling после merge использует target;
- cycle и повторный merge source в разные targets невозможны;
- immutable audit хранит actor, source, target, время и resolutions;
- любой старый source UUID либо резолвится через alias к target на всех
  поддерживаемых routes, либо возвращает один документированный redirect/error;
  это поведение покрыто API/browser tests;
- auto-merge по имени, email, телефону или похожести запрещён.

Teacher может инициировать предложение. Окончательное действие подтверждает
владелец canonical identity. До physical merge recipient может отклонить/cancel
claim без изменения обоих profiles. Audited subject-only unlink допустим только
для ошибочной direct link без merge lineage, records и dependent grants: старый
profile становится unclaimed, а Account атомарно получает новый пустой profile.
После подтверждённого physical merge generic split/unlink запрещён: source data
уже смешаны с target, и безопасно отделить их без отдельного reversible split
contract нельзя. Teacher не может unlink чужой Account; erasure удаляет всю
lineage и не является undo merge.

## Фаза 4. Archive и restore teacher relation

- Добавь архивный фильтр/list в `/students`.
- Restore возвращает только `teacher_learner` в активный справочник.
- Не восстанавливай молча прежние group/Course links; пользователь выбирает их
  заново.
- «Убрать из списка» остаётся relation-only archive и не удаляет canonical
  profile, finalized history или membership уже открытого Run.
- Archive/restore одного teacher не меняет relations другого.
- Разреши permanent delete только для unclaimed пустого profile без records,
  invitations, других teacher relations и Account link.
- Реализуй отдельный subject-only learning-data erasure/reset после recent
  reauthentication, preview counts и повторного подтверждения. Он охватывает
  current target и все source UUID его lineage: удаляет learner records,
  metrics/comments, teacher/group/Course links, invitations, observer grants и
  AI consents. Alias immutable при обычных операциях, но erasure-only RPC
  физически удаляет lineage aliases и удаляет либо необратимо псевдонимизирует
  profile/source/target IDs в audit без PII/private text. Старый UUID не
  раскрывает и не резолвит новый profile. LearningRecord других учащихся, где
  Account был recorder, сохраняются. В той же lock-safe transaction старый
  profile удаляется, а Account получает новый пустой profile, поэтому
  exactly-one invariant соблюдается на commit.
- Account/Auth deletion, Course/File ownership и legal retention не смешивай с
  learning-profile reset случайным cascade.

## Фаза 5. Observer ecosystem

- Settings Account → «Наблюдатели»: active/pending, add, accept, revoke,
  expiration и повторное приглашение.
- Account может наблюдать несколько LearnerProfile и иметь несколько
  наблюдателей.
- Владелец может дать связи свободную подпись «мама», «бабушка», «тренер» и
  изменить её; это display-only text, не permission и не роль Account.
- Раздел «Наблюдение» показывает доступных учащихся и read-only finalized
  history/progress.
- Observer ничего не создаёт, не редактирует, не удаляет, не назначает и не
  запускает.
- Observer может принять/отклонить адресованное ему приглашение и отказаться от
  собственного доступа; это управление своей identity relation, а не mutation
  учебных данных.
- Teacher relation не создаёт observer relation и наоборот.
- Только владелец claimed profile управляет своими наблюдателями.
- Unclaimed offline profile не получает self-managed observers до claim.
- Revoke действует немедленно на API/RLS/UI.
- Subject и observer видят только индивидуальный comment, который teacher явно
  опубликовал через `shared_with_learner_at`; исторические и непубличные comments,
  групповой teacher report и данные других участников не видны.
- Invitation/accept/revoke/read события имеют metadata-only audit.

Используй термин «Наблюдатель». Не вводи Guardian/Parent как новый domain role.

## Фаза 6. Честный v1 progress без копии урока

Не создавай пустые `lesson_run.metrics`/`learning_record.metrics` JSON columns
ради будущего. В текущем scope нет live/component producer индивидуального
результата, поэтому v1 использует только реальные сигналы:

- добавь nullable ordinary `lesson_run.actual_duration_minutes` с разумным
  физическим bounds;
- completion заполняет его автоматически только если Run был явно запущен до
  completion, либо принимает явное фактическое значение преподавателя для
  post-factum отчёта. Текущий scheduled-time fallback в `started_at` не является
  реальным start и никогда не используется как actual duration;
- existing rows и completion без достоверного start/input остаются `NULL`; не
  backfill длительность из `scheduled_at`;
- consumer — Run/Course/Profile history и progress UI, где показываются только
  известная фактическая длительность и aggregate без подмены неизвестного нулём;
- per-learner progress строится из обычных finalized
  attendance/repeat/comment/`shared_with_learner_at`; это outcomes, а не
  выдуманные generic metrics;
- `LearningRecord.metrics` появится отдельной forward migration только вместе с
  первым реальным allowlisted Component/runtime producer и consumer; richer
  learner metrics остаются later;
- не выдумывай mastery, оценку или понимание из отсутствующих данных;
- повтор дополняет, а не заменяет progress;
- progress вычисляется как read projection/view/service по canonical lineage;
- минимум: число проведений, посещения, повторы, последняя активность, subject
  breakdown, фактическая длительность и только действительно доступные
  числовые сигналы;
- добавь cursor pagination для длинной истории;
- subject/observer видят всю finalized lineage, teacher — только свои records;
- full Lesson snapshot, participant table и вторая profile history table не
  появляются.

## Фаза 7. Subject-controlled cross-provider AI

- Teacher запрашивает consent только для profile из effective audience своего
  Course. Subject получает узкую pending-request projection: безопасные Course
  title/owner metadata, цель, expiry и grant/revoke controls — без Course
  content, enrollment или Student Screen access.
- Владелец profile может дать/отозвать для ключа `profile + Course + owner`
  разрешение «Использовать общую учебную историю для персонализации» с expiry и
  revision; owner проверяется против current Course owner.
- Это отдельный grant, не observer access и не автоматическое следствие Course
  membership.
- Без grant Lesson planning/assistant видят только recorder-scoped history.
- Recorder-scoped context может использовать private comments этого же teacher;
  cross-provider projection включает только explicit shared comments.
- С grant internal server-only context function строит deterministic bounded
  sanitized projection finalized non-superseded lineage: aggregates,
  allowlisted metrics и PII-redacted, de-attributed explicitly shared comments.
  Browser/anon и обычный authenticated client не могут вызвать эту функцию
  напрямую.
- Foreign raw rows не возвращаются teacher browser/API.
- Provider payload не содержит foreign Course/Lesson titles, exact timestamps,
  contacts, Auth/profile/record IDs, row structure, recorder identity или
  private teacher data; comments не цитируются и не атрибутируются
  преподавателю.
- Revoke немедленно прекращает дальнейшее использование.
- Grant становится недействительным при смене Course owner, удалении learner из
  audience, expiry или revoke. Preview возвращает grant revision; apply с
  устаревшей revision fail closed.
- Grant/revoke и фактическое использование имеют metadata-only audit.
- AI preview сообщает, использовалась ли общая история.
- Не создавай persistent hidden chat, второй AI domain или service-role browser
  flow.

## Фаза 8. UX и accessibility

Сохрани простой визуальный язык ShiDao:

- вкладки «Ученики / Группы» и dialogs по клику;
- не выводи длинный список из десяти групп в ячейке;
- account/offline/pending/claimed/merged/observer states понятны без знания
  архитектуры;
- destructive/irreversible actions имеют preview и ясное подтверждение;
- completion form разделяет private comment и публикацию без второго текстового
  поля: только явное действие «Добавить в учебный профиль» выставляет
  `shared_with_learner_at`; до этого comment, как и общий report, остаётся
  teacher-only. Старые comments автоматически не публикуются;
- mobile layout, keyboard navigation, focus return, dialog labels,
  loading/empty/error states проходят smoke;
- не создавай отдельные сложные кабинеты под каждую родственную или
  профессиональную роль.

## Обязательные tests и acceptance matrix

Добавь и прогони:

1. Domain/service/repository/API unit tests.
2. Schema-contract tests каждой новой migration/RPC/RLS/grant.
3. Isolated fresh/upgrade migration tests с данными предыдущего production
   shape.
4. Idempotency/concurrency: concurrent claim, два Account на один profile, один
   Account на два profiles, повторный accept, concurrent merge, overlapping
   group/Course membership, two finalized records одного LessonRun, merge при
   open Run/draft и erasure всей lineage. Отдельно проверь concurrent
   signup/bootstrap/reset/claim и postflight exactly-one invariant.
5. RLS/ACL actors: anon, teacher A, teacher B, subject, active observer, revoked
   observer, invitation recipient и посторонний authenticated Account.
6. Докажи, что:
   - teacher A не читает raw records teacher B;
   - subject видит всю finalized lineage;
   - observer read-only;
   - subject/observer не имеют direct raw `learning_record SELECT`, а читают
     только learner-safe projection;
   - старый или непубличный teacher comment не попадает subject/observer/AI;
   - explicit shared comment виден subject/observer и с consent входит в
     sanitized cross-provider AI projection;
   - revoked observer больше не читает;
   - AI без consent не видит foreign history;
   - AI с consent получает bounded redacted context;
   - teacher response всё равно не содержит foreign raw rows;
   - поиск не работает как массовый user directory;
   - share code создаёт только pending request;
   - recipient-bound tokens нельзя принять другим Account;
   - tokens одноразовые и истекают;
   - claimed → claimed merge запрещён;
   - superseded record не попадает в history/progress/AI;
   - старый alias после erasure не раскрывает и не резолвит новый profile.
7. Regression LessonRun/LearningRecord, Groups, mixed Course audience,
   Course/Lesson/Profile history и AI authoring.
8. Auth regression login/onboarding/recovery/PIN/session invalidation.
9. Browser smoke: add Account, create offline learner, recipient-bound
   learner-Account activation с login/PIN, запрет merge в Account взрослого,
   invite/claim, merge preview/confirm, pre-merge cancel, archive/restore,
   observer invite/accept/revoke, self profile/history, observed profile,
   published/private comment, roleless navigation и AI consent request/grant.
10. Запусти фактические package scripts, включая unit tests, typecheck, lint,
    production build, strict browser gate и targeted/global formatting по
    честному active-source baseline.

## Database и deployment safety

- Не удаляй и не переписывай старые migrations.
- Все schema changes — только новые forward migrations.
- В том же change обновляй `supabase/schema/current-schema.sql` и
  `docs/database/current-schema.md`.
- Каждый несовместимый переход разбивай на отдельные совместимые releases:
  schema expand, совместимый old/new web, verified backfill, переключение
  reads/writes в следующем exact image и только затем contract cleanup. Между
  этапами допустимы отдельные commits/push/Coolify deploy; зафиксируй exact SHA
  каждого этапа. Никогда не применяй contract schema, пока текущий или rollback
  image ещё зависит от удаляемого contract.
- Перед production write выполни read-only identity/schema sanity check и
  подтверди ShiDao DB.
- Используй только project-local connection/config, не глобальный случайный
  `supabase` MCP.
- Перед migration создай timestamped backup и проверь его размер.
- Применяй точные протестированные migration files от владельца таблиц.
- После apply проверь shape, counts, constraints, RLS, grants, RPC, PostgREST и
  actor matrix.
- Не mass-reset `public`; не меняй Auth/SMTP/JWT/API keys или базовый Storage.
- Сохраняй unrelated user changes в dirty worktree.
- После полного local gate сделай осмысленные commits в `main`, push и дождись
  Coolify.
- Подтверди exact running container/image итогового commit SHA.
- Выполни HTTP и authenticated browser postflight. Production mutation smoke
  использует только явно disposable data и поддерживаемый cleanup flow.

## Документация

В каждом завершённом slice обновляй:

- `docs/project-state.md`;
- `docs/roadmap.md`;
- `docs/architecture/learner-identity-access-model.md`;
- `docs/architecture/lesson-workflow-model.md`, если меняется history/AI;
- `docs/authorization-routing.md` при roleless routes;
- `docs/database/current-schema.md`;
- `supabase/schema/current-schema.sql`;
- релевантный deployment runbook и product vision.

Разделяй **current / next / later**. Не называй claim, observer, merge, metrics,
AI consent или deployment реализованными до фактического postflight. После
deployment укажи exact SHA, migrations, backup и ограничения.

## Out of scope

Не расширяй задачу на Homework, parsing/RAG, billing, marketplace/templates,
общий chat, внешний MCP, learner Course consumption/enrollment или live Student
Screen. `/courses` здесь остаётся authoring surface Account. Не возвращай
Methodology, Lesson Step, legacy Class/School как parent Course или второй
runtime Lesson.

## Terminal condition

Задача завершена только когда одновременно:

- active V2 использует roleless Account;
- existing student login/PIN работает через Account boundary без active
  dependency от legacy role tables;
- offline learner без email активируется как отдельный roleless Account с
  login/PIN; recipient adult Account не становится learner identity;
- каждый active Account имеет один canonical profile, offline flow работает;
- реализованы safe discovery/share code, invitation, claim, pre-merge cancel,
  ограниченный safe unlink без merge lineage и duplicate merge; generic split
  после physical merge не обещается;
- работает archive list/restore;
- self profile/history и observer invite/accept/revoke/read-only progress
  работают;
- subject-only learning-data erasure/reset и безопасное удаление пустого
  offline profile работают;
- teacher raw visibility остаётся recorder-scoped;
- subject-controlled cross-provider AI consent работает и отзывается;
- actual-duration/progress projection работает по canonical lineage без
  фиктивных learner metrics;
- security hardening и negative authorization tests пройдены;
- unit/typecheck/lint/build/browser/DB gates зелёные;
- обязательные docs актуальны;
- production migrations применены после backup;
- `main` запушен;
- Coolify развернул exact итоговый SHA;
- production DB/API/browser postflight успешен;
- в scope нет скрытых TODO, заглушек или schema-only возможностей.

В финальном legacy contract slice после read-only dependency audit удали
неиспользуемые `guardian_relation`/`guardian_status` enums и active role helpers
новой migration; старые migration files не переписывай.

Не заканчивай ответ формулировкой «фундамент готов, остальное позже». При
настоящем внешнем blocker сначала исчерпай безопасные альтернативы и заверши всё
независимое. Затем точно укажи одно требуемое внешнее действие.

В финальном ответе дай:

- что реализовано;
- migrations и production backup;
- результаты тестов;
- commit SHA и Coolify confirmation;
- ограничения только вне scope;
- пошаговый ручной UI-сценарий проверки.
