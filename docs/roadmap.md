# Roadmap ShiDao V2

**Статус:** current / next / later priorities после production identity release
**Актуально на:** 12 августа 2026 года

Фактически реализованное состояние находится в
[`docs/project-state.md`](./project-state.md). Этот документ описывает только
направление движения. Он не является текущей schema/API документацией.

## Принципы последовательности

1. Каждый этап завершается рабочим vertical slice на реальных данных.
2. Новая возможность переиспользует Course Builder service/contracts и
   code-first registry, а не создаёт параллельную модель.
3. Учитель может работать вручную без обязательного расхода AI tokens.
4. AI не получает SQL или service-role credentials.
5. Attachment не считается прочитанным до фактического parsing результата.
6. Homework остаётся отдельной Lesson surface; LessonRun/LearningRecord
   расширяют Lesson без второго authored/runtime content model и не возвращают
   Lesson Step.
7. Новая schema появляется только forward migration; current-schema snapshots
   обновляются в том же изменении.
8. Нельзя расширять scope за счёт Auth, SMTP, JWT/API keys, базового Storage или
   recovery V1 без отдельного решения.

## Выполненный фундамент

- V1 зафиксирована в immutable Git refs и private recovery snapshot.
- «Мир вокруг меня» сохранён в repository archive с Markdown, raw exports,
  source documents, assets, manifests и checksums.
- `shidao.ru` переведён в landing-only, V2 работает на `v2.shidao.ru`.
- Старый Methodology/Step/runtime код удалён из активного приложения.
- Каноническая модель стала `Course → Lesson → ordered Components`.
- Реализованы persisted Course, Lesson, 10 Component types и private
  course-wide attachments.
- Реализована двухуровневая Course → Lesson навигация в визуальном языке demo:
  четыре Course tabs («Уроки / О курсе / Материалы / История»), пять Lesson
  tabs, прозрачные headers и отдельная плотная таблица Lesson до открытия
  редактора. Её исходный порядок совпадает с authored `position`.
- **О курсе** объединяет inline-настройки, фактическую аудиторию и источники в
  одной растущей карточке без внутреннего вертикального scroll; **Материалы**
  являются отдельной агрегирующей course-wide библиотекой. `/courses/new`
  сохраняет ту же четырёхвкладочную модель и начинает с **О курсе**, не создавая
  отдельной draft-сущности или schema.
- `/courses`, `/students`, `/schedule`, Course и Lesson используют один
  `AppPageHeader` с H1 не крупнее 48 px на desktop и 32 px на mobile,
  подзаголовком canonical цвета `rgba(20, 20, 20, 0.5)`, optional backlink и
  правой action-секцией. Header имеет
  `min-height: 200px`, растёт по контенту и вертикально центрирует actions.
  В current production heading занимает всю оставшуюся ширину, а actions — только
  intrinsic ширину содержимого и не превращаются в full-width кнопки на mobile.
  Course, Lesson, Students и profile dialog используют один `WorkspaceTabs`:
  40 px, roving keyboard/ARIA, horizontal scroll, baseline 1 px цвета
  `rgba(20, 20, 20, 0.2)` с `inline-inset: 0` и квадратный чёрный
  active-сегмент 4 px без radius. Counts следуют сразу за названием обычным
  текстом без круглого badge.
  Базовый follow-up был подтверждён в release `77870e3`; full-width
  канонизация развёрнута exact merge commit
  `84ffefecda99d3b0a9da82bf1eaf8ce76d9c6ea1` (PR #242).
- Active app routes приведены к плоскому demo-фону `#f5f1e8` без marketing
  gradients; header, кнопки, вкладки и заголовочная типографика используют
  scoped demo-размеры и веса, не затрагивая landing/Auth.
- На release `fea7f80` развёрнуты teacher-only `/schedule` и `/students` и
  пункты «Расписание / Ученики / Курсы» как исходные shells.
- Эти shells превращены в deployed vertical slice: нейтральные
  LearnerProfile, переиспользуемые группы, смешанная Course audience,
  LessonRun, LearningRecord,
  расписание, повторное проведение и Lesson/Course/Profile history. Срез не
  читает старые `student/class/class_student`; migration применена к production
  ShiDao DB и прошла DB/RLS/ACL/PostgREST postflight 7 августа 2026 года.
  Базовый LessonRun был выпущен в `fa91371`, а reusable Groups, mixed audience
  и history-aware AI-context — в `9393080`; оба release прошли
  HTTP/authenticated browser postflight без записи тестовых данных.
- Deployed release `757044c` поверх этого baseline разделяет canonical
  `learner_profile` и teacher-local `teacher_learner`, а
  `learning_record.recorded_by_account_id` сохраняет recorder. Существующие
  profiles backfilled 1:1; account claim, merge и observer access не входят в
  этот slice.
- Current production contract release поверх deployed baseline завершает P0.Identity:
  roleless exactly-one Account profile, Account login/PIN, discovery/claim/
  child activation/merge, archive/restore, self/observer history/progress,
  erasure и consented AI. M1–M6, четыре verified backup, два exact roleless
  Coolify SHA, финальный DB/RLS/ACL/PostgREST postflight и реальный GoTrue
  create/delete probe подтверждены; exact functional web SHA `01aa88a` и
  authenticated production browser postflight завершены. P0.Identity закрыт.
- Реализованы private-by-default Components и persisted Student Screen Slides.
- Реализован fullscreen Student Screen preview.
- Реализован development-only MCP из шести tools поверх application service.
- Lesson planning и read-only Assistant получают состав выбранных групп и
  отдельных учеников, а также bounded finalized learning history эффективной
  аудитории без технических IDs; отсутствие не трактуется как непонимание.
- В release `0276aed` развёрнуты и проверены RouterAI provider adapter,
  Course/Lesson
  preview → explicit apply и read-only ephemeral assistant; production runtime
  получает API key из server-side secret environment и использует проверенный
  default `google/gemini-2.5-flash-lite`.
- **Current deployed follow-up:** один global System Assistant смонтирован в
  protected `(app)` layout вместо Course/Lesson header dialog. Он получает
  allowlisted page context, читает bounded authorized проекции Account и
  открытой страницы. Exact functional SHA `b7c6cfe` развёрнут в Coolify с двумя
  базовыми подтверждаемыми командами: Course draft и пустая Lesson.
  Conversational follow-up `246cf49` добавляет новую наполненную Lesson, дополнение
  открытой Lesson и удаление exact Lesson через canonical services, signed
  proposal и one-active confirmation state machine. Код и tests не меняют
  schema; exact SHA развёрнут Coolify и прошёл running-image/HTTP/guest boundary
  postflight. Base RouterAI no-write smoke зелёный; authenticated production
  action postflight ещё не выполнен.
- Browser-smoke переведён на актуальную AES-GCM app-session; строгий
  production-mode gate покрывает guest/auth redirects, Course → Lesson →
  backlink, computed visual contract и mobile overflow без обращения к
  рабочей базе.
- Первый Course Builder milestone проверен на deployed customer-demo контуре.
- На release `7021801` восстановлен отдельный `demo.shidao.ru` с прежним интерактивным
  client-only UI-прототипом и clean-path навигацией. Это изолированная
  reference surface с фиктивными данными, а не возврат Step/Methodology в V2,
  не runtime fallback и не реализация schedule/learner/AI milestones.

## P0.1: legacy identity/security hardening

**Current production contract:** M1 включает RLS/ACL hardening
`user_preference`/`user_security`, active callers перенесены на Account
boundary, production middleware использует explicit host allowlist и exact
`v2.shidao.ru` CSRF Origin. Negative Auth/host/output tests входят в release
gate. **Production status:** M1–M6, четыре verified backup, два exact roleless
web deployment, contract DB postflight, Auth Admin lifecycle probe, exact
functional SHA `01aa88a` и authenticated browser postflight завершены 9 августа
2026 года.

- [x] инвентаризировать server callers login/onboarding/profile/PIN/session и
      legacy `SECURITY DEFINER` RPC с caller-supplied `p_user_id`/`anon` execute;
- [x] проверить фактический Data API exposure read-only и составить negative
      tests;
- отдельной approved ops-задачей ротировать historical plaintext credentials
  из ignored `enviromnent/db-mcp-cheatsheet.md`, затем оставить только safe
  deprecation stub; не печатать текущие значения;
- [x] заменить broad table/function grants узкими authenticated/service
      boundaries и owner checks;
- [x] включить RLS там, где прямой доступ действительно нужен, либо полностью
      закрыть direct table access;
- [x] закрыть middleware host boundary явным production allowlist: non-root
      `brand`/`model` и неизвестные routed hosts не должны получать app/API;
- [x] определить Prettier baseline: исключить immutable archive и отдельно
      отформатировать active source, чтобы repository-wide `format:check` стал
      честным gate;
- [x] доставить M5/M6 forward hardening с restricted Auth regression, backup,
      production GoTrue lifecycle smoke и exact web/browser verification.

Этот пункт не разрешает менять Auth/SMTP/JWT или применять migration без
read-only ShiDao sanity check и отдельного deployed-contour postflight.

## P0.Identity: завершить universal Account и canonical learner ecosystem

**Current production contract:** все vertical slices реализованы через M1–M6,
`src/modules/learner-identity/`, API/UI и roleless navigation. Четыре verified
backup, два roleless deploy, dependency audit, contract cleanup, Auth hardening,
final snapshot, DB/API/GoTrue postflight, exact functional web SHA `01aa88a` и
authenticated browser acceptance завершены. Identity program complete.
Homework, RAG, billing, templates и live Student Screen по-прежнему не входят.

Согласованный target:

- один roleless Account может одновременно преподавать, учиться и наблюдать;
- каждый active Account имеет ровно один canonical LearnerProfile как
  transaction-safe DB invariant, а offline profiles остаются unclaimed до
  consented connection;
- преподавание и observer access являются отношениями, а не глобальными ролями;
- teacher raw history остаётся recorder-scoped;
- subject/observer получают learner-safe finalized history и progress;
- cross-provider AI использует deterministic sanitized projection только по
  отдельному отзываемому consent на `profile + Course + owner` с проверкой
  current owner и не
  открывает teacher browser чужие raw records;
- duplicate profiles физически сводятся к одному active target с lineage/audit,
  без потери LearningRecord и teacher-local names;
- full Lesson snapshot и `lesson_run_participant` не возвращаются.

Реализованная последовательность vertical slices:

1. **Security gate:** закрыты legacy ACL, host allowlist и app-origin CSRF из
   P0.1 с Auth regression и negative actor tests.
2. **Universal Account bootstrap:** один profile на каждый Account, roleless
   onboarding/navigation и отсутствие active dependency от
   `teacher/parent/student`.
3. **Discovery/connection:** rotating one-time share code/QR и blind email
   exact handle, blind recipient-bound email invitation, accept/revoke/expiry и
   flow «сначала найти Account, затем создать offline profile». Discovery
   создаёт только pending request; active relation требует accept subject. Для
   learner без email recipient активирует отдельный learner Account с login/PIN,
   а не использует собственный взрослый Account.
4. **Claim и physical merge:** merge preview, conflicts одного LessonRun,
   transactional locks, lineage alias, audit и один canonical target. Обычный
   путь — только unclaimed source в actor-owned target; open Run/draft и
   claimed-to-claimed merge fail closed.
5. **Archive/lifecycle:** архивный список, restore без скрытого возврата прежних
   memberships, permanent delete только пустого unclaimed profile и
   subject-only learning-data erasure/reset.
6. **Observer:** self-managed invite/accept/revoke, раздел «Наблюдение» и узкая
   read-only finalized projection. В current UI это третья вкладка раздела
   «Ученики», а не отдельный primary navigation item. Teacher relation не
   выдаёт observer access.
7. **Progress:** nullable verified actual duration, pagination и aggregate
   projection из реальных LearningRecord по canonical lineage. Scheduled
   fallback не считается фактическим start; generic learner metrics ждут
   реального Component/runtime producer.
8. **AI consent:** request + grant на `profile + Course + owner`, безопасная
   metadata projection без Course access, deterministic bounded sanitized
   context, immediate revoke/expiry/owner-change invalidation, audit и
   stale-preview protection.
9. **Legacy cutover:** active role switch/callers удалены; final role
   helpers/types/grants и rollback-only security dual-writes удалены отдельной
   M4 после доказанного отсутствия зависимостей.
10. **Auth transaction hardening:** M5 выполняет deferred exactly-one invariant
    под закрытой owner boundary; M6 распознаёт только trusted pristine
    child-activation metadata в той же GoTrue creation transaction и запрещает
    late `active → provisional` downgrade.

Каждый slice проходит цепочку contracts → service → repository → API → UI →
tests → migration/snapshot → docs → production postflight. Нельзя объявлять
программу завершённой после одной схемы или claim UI.

Definition of Done программы:

- новый пользователь автоматически получает Account и один canonical profile;
- DB postflight подтверждает exactly-one invariant, включая concurrent
  signup/claim/reset;
- один и тот же profile безопасно используется несколькими преподавателями;
- «Добавить ученика» поддерживает existing Account и offline path;
- offline learner без email получает отдельный Account/login/PIN; взрослый
  recipient не становится learner identity;
- invitation/claim/merge/archive/restore доступны в UI и конкурентно безопасны;
- stale merged UUID в одиночных teacher URLs actor-scoped резолвится в target;
  bulk Group/Course/Run UUID fail generic и требуют reload/reselect, а erasure
  удаляет alias полностью;
- subject управляет наблюдателями, observer ничего не мутирует;
- subject/observer видят всю разрешённую finalized lineage, teacher — только
  свои raw observations;
- self-profile/history и observer projection работают независимо; progress и
  actual duration основаны только на сохранённых данных;
- AI без consent не получает foreign history, с consent получает только
  безопасную projection, а revoke действует немедленно;
- role choice больше не определяет active V2 navigation/access;
- существующие student login/PIN работают через Account credential boundary без
  active dependency от legacy role tables;
- migrations, RLS/ACL actor matrix, Auth/browser regression, docs и production
  postflight зелёные.

Полный execution/acceptance prompt:
[`LEARNER_IDENTITY_COMPLETION_PROMPT.md`](./v2/LEARNER_IDENTITY_COMPLETION_PROMPT.md).

## P0.2: завершить базовый teacher authoring

Цель — превратить рабочий технический редактор в уверенный ежедневный
инструмент преподавателя без изменения доменной модели.

**Current:** primary navigation упрощена до «Расписание / Ученики / Курсы»;
учебный профиль перенесён в Account menu, observer projection — во вкладку
«Наблюдение» внутри «Ученики». Каталог `/courses` получил поиск, реальные
Course-фильтры, сортировку и переключение «Карточки / Таблица» без новой schema
или параллельного Course API. В current production Students и Courses controls
унифицированы с Schedule: outer toolbar-card удалена, Students показывает
active/archive/pending в одной таблице с inline status/text, full-width search и
единым disclosure «Фильтр» для status, group membership, конкретной группы и
Account connection. Подзаголовок страницы — «Ученики и группы, с которыми вы
работаете или за которыми наблюдаете». Отдельный sort select у
Students/Groups и Course **Мои** удалён: возрастающее/убывающее направление
переключается кликом по sortable headers, Course facets собраны в компактный
disclosure, а view — в две icon-only кнопки. Published Catalog показывает
только поддержанные server-side
subject/level filters, но использует тот же cards/table presentation; повторный
заголовок, пояснение и видимые result counts удалены. В current production Schedule
также сводит выбор даты и режимы «День / Неделя / Месяц» в один компактный
календарный popover справа от страницы: desktop-контрол имеет ровно 300 px,
короткие русские подписи периода без точки после сокращения месяца и оставляет
рядом только icon-only «Таблица / Карточки». Белая таблица без внешней рамки
получила компактные `Дата / Время` слева, `Ученики / Статус` и действия справа,
а `Урок / Курс` делят свободную ширину. Все данные чёрные, однострочные и
сокращаются ellipsis; header и data-row ровно 40 px, причём разделитель входит
в высоту header, его weight равен 500. Header имеет тот же белый фон, что data
rows, а его нижний divider и разделители между строками используют один
`--product-table-divider-color`. Обычные header/data cells получают
канонические 12 px слева и справа; последняя body action-cell использует 4 px,
а её единственный `MoreVertical` trigger имеет 32 × 32 px и радиус 8 px. Так
в 40 px строке остаются одинаковые 4 px сверху, справа и снизу, как у active
option в переключателе вида.
Последняя колонка не имеет видимого заголовка:
вертикальное троеточие ожидающего Run открывает точные действия «Начать урок /
Изменить / Отменить», active/completed Run получают соответствующие завершение
или результаты; других action-кнопок в строке нет. Пункты portal-menu имеют
40 px и `.88rem/400` с вертикальным центрированием. Строка назначенного урока
показывает pointer при наведении. Видимые data-заголовки Schedule также
переключают ascending/descending сортировку повторным кликом и отражают её
через `aria-sort`. Прозрачная Schedule controls-панель снова
занимает всю ширину строки без горизонтального inset, сохраняя controls справа;
Students controls и обе Courses controls-панели теперь тоже используют всю
ширину без horizontal inset.
Общие tokens различают карточки с радиусом 20 px и
elements/controls/tables/menus с радиусом 12 px; активные ProductTable wrappers
белые, borderless и используют table token. Students и обе Course-таблицы
получают такой же 40 px header/data-row contract. Students показывает
`Ученик / Статус / Аккаунт / Группы / Добавлен / actions`, Course **Мои** —
`Курс / Предмет / Уровень / Уроки / Публикация / Обновлён / actions`, а
**Каталог** — `Курс / Предмет / Уровень / Автор / Уроки / Материалы / actions`.
Их shared header белый, а row dividers используют один
`--product-table-divider-color`. Owned Course headers сортируют полную
client-loaded projection; cursor Catalog сохраняет server order. Один
`MoreVertical` в каждой Students-row
открывает contextual menu: профиль, управление группами, реальный
«Добавить в курс…» с сохранением существующей group/direct audience и
destructive «Убрать из списка». «Написать сообщение» остаётся disabled с явной пометкой о
недоступности; communication layer не объявляется current-возможностью.
Archived/pending rows получают только допустимые restore/permanent-delete или
cancel actions. Authenticated top header/profile menu стали
сплошными белыми поверхностями без blur. Active V2 buttons/header controls
унифицированы как flat `40 px / 12 px / .88rem / 400`: без inset-блика,
подъёма и тени, с полностью непрозрачными контрастными иконками; белые кнопки
сохраняют тонкую рамку, menu items остаются borderless. Authenticated Settings
(`profile / security / observers`) переиспользуют тот же product shell, demo
TopNav, canonical side navigation и shared Button variants вместо raw action
styles; landing, Auth и полноэкранный Student Screen не меняются. Эти visual
изменения сами не требуют schema. Course **Мои** также получил постоянный
`MoreVertical` portal-menu с реальными действиями публикации/дублирования и
подтверждённым «Удалить». `DELETE` здесь означает recoverable soft archive
через `course.archived_at`, а не physical delete: authored graph, attachments,
Runs и LearningRecords сохраняются. Published Course сначала требует unpublish
(`409 course_is_published`), Course с открытыми Runs — их завершения или отмены
(`409 course_has_open_lesson_runs`). Current `archive_course` RPC атомарно
проверяет эти условия вместе с active ownership и ставит `archived_at` в одной
DB-транзакции; A1 reverse guards сериализуют archive, publish и open Run на
одной Course row, а application больше не сочетает отдельные preflight-read с
PATCH. A1 migration уже применена к production, exact DB postflight и live
snapshot green. Restore UI и permanent deletion остаются later. Зависимая
application-корректировка развёрнута production release PR #242 и прошла
running-image/HTTP boundary postflight.
Current production polish
оставляет AppPageHeader actions шириной по содержимому, отдаёт свободное место
heading и унифицирует WorkspaceTabs: container и 20%-black baseline занимают
всю ширину с `inline-inset: 0`, а count остаётся простым inline-текстом без
кружка. Course workspace использует четыре вкладки;
настройки и audience редактируются inline на растущей **О курсе**, а
course-wide **Материалы** вынесены в отдельную агрегирующую библиотеку. Новый
Course начинает с **О курсе**; обычное сохранение возвращает туда же, тогда как
deterministic/AI-сборка открывает **Уроки**. Вкладка сохранённого Course
**Материалы** разделяет используемые и пока не используемые attachments и
показывает Lesson usage.
На **Уроках** неизменённый полноширинный `WorkspaceTabs` продолжает прозрачная
search/create toolbar без horizontal inset. Lesson проецируются в `ProductTable`
`№ / Урок / План / Экран ученика / Проведение / Обновлён / actions` с общей
Schedule-геометрией `40 px / 12 px / 4 px`; шесть заголовков меняют только
view-sort, начиная с `position ASC`. В action-cell остаётся один 32 px
`MoreVertical`: portal-menu открывает Lesson либо контекстный flow проведения и
не содержит удаления. Старый карточный `workspace-lesson-*` layout удалён.
В current production code-first Component registry расширен с 10 до 20 активных
типов: добавлены video/audio, расширенный quiz, пропуски, bank
слов, порядок, категории, свободный ответ, HTTPS-ссылка, сборка слова и
словарь; layout-only `divider` исключён. Текущая самопроверка живёт только
в preview state, а learner answer persistence/scoring остаются later. Продуктовый
выбор и границы зафиксированы в
[`docs/product/course-component-catalog.md`](./product/course-component-catalog.md).

- подтвердить production postflight responsive/accessibility контракта
  обновлённой Course Lessons table, включая mobile contained scroll, keyboard
  sort/menu и focus restore;
- добавить в сохранённый Course возобновляемую загрузку новых материалов с
  явной компенсацией незавершённых Storage operations;
- улучшить выбор/поиск Components в palette;
- проверить все 20 editors/renderers отдельными production-safe сценариями;
- добавить drag-and-drop только если он не ухудшает доступность и надёжность;
- добавить отдельный restore UI для soft-archived Course и только после
  согласованной publication/Storage retention policy решать permanent delete;
  текущий `DELETE` намеренно архивирует и сохраняет authored/history graph;
- добавить autosave/draft feedback там, где это уменьшает риск потери ввода;
- сериализовать append Lesson/Component на owner parent, чтобы concurrent
  create не сталкивался по position и supported path всегда оставался dense;
- не делать AI обязательным для создания или редактирования Lesson.

Definition of Done:

- Course можно полноценно поддерживать после первоначального создания;
- teacher понимает видимость и Slide каждого Component без скрытых правил;
- keyboard/focus/dialog behavior проходит accessibility smoke;
- reload и повторный вход не меняют состояние.

## P0.3: RouterAI Course/Lesson authoring

Цель — дать преподавателю работающую AI-сборку Course/Lesson без второй
архитектуры урока и без неконтролируемой записи из чата.

**Current production boundary:**

- server-only OpenAI-compatible RouterAI adapter с default
  `google/gemini-2.5-flash-lite`, конфигурируемой моделью, timeout и abort;
- bounded provider input и provider-compatible flat structured output, который
  преобразуется в canonical AI plan и повторно валидируется теми же
  Zod/registry contracts перед первой записью;
- Course outline ровно на `targetLessonCount` Lessons;
- создание новой или дополнение существующей Lesson ограниченным набором
  registry Components (`heading`, `rich_text`, `callout`,
  `single_choice_poll`, `matching_game`); расширение ручного registry не
  расширяет provider allowlist автоматически;
- отдельные preview и explicit Apply; provider planning не выполняет записи;
- stale-plan checks, idempotent Course retry и compensating cleanup для
  поддерживаемых apply paths;
- новые AI Components private-by-default и не публикуются на Student Screen;
- read-only ephemeral assistant с Course/selected Lesson context, без tools,
  mutation commands и persisted chat history;
- понятные provider errors и сохранение ручного workflow;
- фактические request ID/model/token usage в ответе и metadata-only server log;
- process-local rate/concurrency limit без новой persistence;
- attachment metadata без скачивания/парсинга file contents;
- отсутствие schema migration, quota/ledger и billing.

**Current System Assistant conversational action follow-up:**

- один floating widget живёт в protected Account layout и не показывается на
  landing/Auth/demo; прежние кнопки course-scoped assistant удалены из Course и
  Lesson headers, а старый Course route может пока оставаться compatibility;
- browser передаёт strict allowlisted surface, согласованный typed view и
  optional Course/Lesson IDs, локальную дату/UTC offset; arbitrary URL, DOM,
  search/hash и значения форм не входят в page context;
- server повторно проходит active/provisional Account gate, ownership и
  user-JWT/RLS, затем даёт модели bounded Course catalog и только нужную
  surface-проекцию: current Course/Lesson + разрешённую history, Students/Groups
  либо Schedule выбранного дня;
- provider может вести обычный bounded диалог или вернуть максимум одно strict
  proposal: `course.create_draft | course.add_lesson |
course.add_lesson_with_plan | lesson.fill | lesson.delete`; chat ничего не
  записывает;
- запрос добавить Lesson внутри открытого Course использует только server-issued
  `current_course`; отсутствующий title превращается в уточнение названия без
  502/proposal/write, а неизвестный непустой ref отклоняется fail closed;
- неоднозначное «сделай урок» уточняет пустой/наполненный режим. Filled new и
  existing Lesson переиспользуют canonical plan/preview/apply, показывают все
  Components и сохраняют существующий ordered list; delete показывает impact и
  проходит owner/fingerprint stale check;
- deployed release `69a74a7` сопровождает этот бинарный вопрос двумя structured
  quick replies «Пустой урок / Готовый урок»: click остаётся обычным user turn,
  варианты одноразовые и инвалидируются вместе с Course/Lesson context;
- proposal HMAC-подписан на actor + idempotency key + exact action на 10 минут.
  UI допускает только одну pending карточку: «да»/кнопка применяют её без LLM,
  «нет», новый запрос или смена target отменяют;
- dialog history остаётся только в React state. Rate/concurrency guard,
  actor+target mutex и 10-минутный idempotency result cache работают только в
  памяти одного process; restart/другая replica их не видят. Подпись не заменяет
  durable action ledger/distributed exactly-once; delete stale compare и RPC
  остаются неатомарными без отдельной migration;
- новая DB migration и provider/quota persistence в этот follow-up не входят;
  exact functional SHA `246cf49` развёрнут; authenticated production action
  postflight остаётся отдельным следующим operational шагом.

**Next — operational hardening:**

- наблюдать первый реальный teacher Apply по metadata-only logs; не создавать
  отдельные production test entities без явной необходимости;
- проверить provider-error fallback во время планового fault-injection окна, не
  нарушая доступность production-контура;
- использовать отдельный runtime-only production key и немедленно ротировать
  его, если значение когда-либо попало в чат, log, issue или screenshot;
- до нескольких application replicas заменить process-local rate/mutex и
  assistant replay cache на distributed limiter + durable idempotency/action
  ledger; отдельно сериализовать concurrent append Lesson;
- решить срок удаления compatibility Course assistant route после подтверждения
  отсутствия callers; не возвращать его dialog в Course/Lesson headers;
- расширять mutation allowlist только отдельными reversible slices с explicit
  confirmation; delete, Auth/security, audience, schedule и публикация не
  становятся общими tools автоматически;
- спроектировать persistent quota/usage ledger до введения платного ограничения,
  но не выдавать текущий metadata usage за balance или billing.

MCP остаётся development adapter. Production web вызывает application
service/contracts напрямую и не поднимает внешний MCP endpoint или статический
MCP actor. Полный current/source/deployment contract находится в
[`docs/architecture/ai-provider-integration.md`](./architecture/ai-provider-integration.md).

На этом этапе attachment используется только как metadata и явно введённый
teacher context. Нельзя писать «AI изучил файл», пока отдельный parsing pipeline
не вернул подтверждённый extracted text.

## P0.4: reusable Course catalog

**Current deployed slice:** в UI остаётся один объект «курс». `/courses` имеет
вкладки «Мои / Каталог»; отдельного пользовательского типа «шаблон» нет.
Forward migration применена после backup и DB/RLS/ACL/Storage/PostgREST
postflight; Coolify deployment `891` развернул exact functional SHA `9a55308`.

- publication создаёт immutable allowlisted revision, а не открывает
  live owner Course;
- в revision входят Course fields, Lessons, ordered Components, Student
  Screen Slides и ready attachments; learner/group/schedule/history/report/
  consent данные не входят;
- private material bytes копируются в immutable publication Storage, а
  при добавлении — в новые owner-scoped StoredFile;
- добавление и duplicate создают новые Course/Lesson/Component/Slide
  IDs без audience, Runs, records, reports и AI consent;
- publish/update имеют один confirmation dialog с подтверждением
  прав на материалы; preview wizard и name/PII scanner в этом slice
  намеренно отсутствуют;
- добавленная копия не адаптируется и не перегенерируется
  автоматически.
- отдельный publication content clock исключает operational/audience edits из
  dirty state, а idempotent acknowledgement повторно проверяет live materials;
- compact catalog RPC выполняет поиск/фильтры/cursor в БД и возвращает
  bounded facets; inactive owner атомарно снимается с публикации;
- immutable history защищена DB-квотой 5 GiB на Account, а Storage-writing
  mutations — process-local concurrency/rate guard.

**Next:** до широкого rollout добавить persisted orphan-Storage reconciliation.
Current Course `DELETE` является soft archive и требует явный unpublish;
permanent delete остаётся закрыт до согласованной publication/Storage retention
policy. Официальные Course от ShiDao требуют отдельно утверждённого учебного
контента; fixtures не публикуются.

## P1.1: persisted Homework

Цель — заменить текущую заглушку отдельным Lesson-owned редактором.

- собственные Homework contracts/service/repository;
- отдельный ordered list homework components или отдельный ограниченный
  registry context — решение фиксируется до migration;
- teacher preview и learner projection;
- due/assignment model добавляется только вместе с LearnerProfile/audience;
- Homework не смешивается с `lesson.components` и Student Screen Slides.

Первый срез может сохранять одно общее Homework на Lesson без индивидуальных
override. Overrides и immutable issued snapshots добавляются после появления
новой audience-модели.

## P1.2: Sources и parsing/RAG

Цель — сделать материалы реальными источниками AI.

- SourceDocument поверх существующего StoredFile, без дублирования объекта;
- безопасное извлечение текста сначала для PDF с text layer, DOCX, TXT и MD;
- status pipeline `uploaded → extracting → ready | failed`;
- chunks, provenance и checksum/version;
- embeddings и retrieval только после измеримого extraction baseline;
- UI всегда различает «прикреплён», «обрабатывается», «проанализирован» и
  «ошибка».

OCR, web crawling и audio transcription не входят в первый parsing slice.

## P2: audience и learning identity

Legacy `teacher/parent/student/school/class` rows сохраняются только как dormant
compatibility/recovery data; active roleless contract их не читает.

**Current deployed slice:**

- canonical `LearnerProfile` без teacher owner: nullable unique `account_id`
  резервирует one-to-one claim point, а global `display_name` остаётся
  canonical/offline fallback;
- `teacher_learner` хранит teacher-local display name и archive state; создание,
  редактирование и product delete ученика продолжают использовать существующие
  learner-profile routes/RPC, но меняют relation конкретного преподавателя;
- reusable `learner_group` с many-to-many membership: один LearnerProfile может
  быть без группы или входить сразу в несколько;
- смешанная Course audience через независимые direct learner и group links;
  effective audience — дедуплицированное объединение активных профилей;
- Account-accessible `/students` как единый sortable/filterable справочник с
  teacher-scoped данными: ученика можно создать, изменить и убрать из своего
  списка, для групп доступен CRUD, а dialog ученика показывает индивидуальную
  историю;
- безопасное product delete ученика архивирует только teacher relation и
  отсоединяет её от будущих аудиторий этого Account, не удаляя canonical
  LearnerProfile, LearningRecord и уже назначенные Runs; archive list/restore
  реализованы;
- `LearningRecord.recorded_by_account_id` фиксируется при scheduling;
  teacher-history и текущий AI context читают только записи текущего recorder;
- изменение membership прикреплённой группы влияет на новые назначения и AI
  context, но не переписывает состав уже открытого LessonRun;
- Course Builder остаётся owner-only, а старые Class/School не используются.

**Current production contract:**

- exactly-one Account/profile invariant, roleless navigation и Account
  login/PIN boundary;
- share-code/email connection, offline claim/child activation и physical merge;
- archive list/restore, permanent empty-offline delete, safe unlink и subject
  erasure;
- self/observer learner-safe history/progress и explicit shared comments;
- subject-controlled cross-provider AI consent с bounded sanitized projection;
- stale source UUID actor-scoped resolution для одиночных teacher URLs; bulk
  UUID fail generic + reload/reselect; erasure deletes alias.

Нельзя использовать старую Class/School как новый parent Course только ради
быстрого enrollment. Learner login/access не следует ни из наличия
LearnerProfile, ни из nullable `learner_profile.account_id` до завершённого
claim/access slice. Заполненный `account_id` позволяет Account выбрать только
собственную canonical identity row; Course, records и teacher-local data этим не
открываются. Полный current/next/later boundary находится в
[`docs/architecture/learner-identity-access-model.md`](./architecture/learner-identity-access-model.md).
Learner Course consumption и live Student Screen остаются отдельным later slice
и не входят в P0.Identity. Наличие linked profile/observer grant/AI consent не
создаёт Course enrollment.

## P2: LessonRun и live lesson

**Current deployed slice:**

- `/schedule` проецирует LessonRun по календарному дню без параллельной таблицы
  Schedule events;
- Lesson остаётся единственным content entity; один открытый LessonRun является
  изменяемым назначением, а закрытые Runs — историей;
- Lesson можно проводить многократно, в том числе повторно для subset audience;
- completion сохраняет teacher report и точные LearningRecord каждого
  ожидаемого ученика;
- UI state выводится из timestamps, persisted status отсутствует.

**Previously deployed follow-up (presentation superseded by PR #242):** Schedule UI проецирует те же
LessonRun за выбранную локальную неделю или календарный месяц. Панель без
внешней карточки повторяет demo-композицию: date navigator, «Неделя / Месяц» и
«Таблица / Карточки». API/schema не меняются; System Assistant остаётся
ограничен опорным выбранным днём. Coolify webhook deployment exact functional
SHA `587bb21` завершён со статусом Success; authenticated production browser
postflight этого follow-up ещё не выполнен.

**Current production polish:** page header использует подзаголовок «Здесь все
назначенные уроки за выбранный период.» с общим для всех `AppPageHeader`
computed-цветом `rgba(20, 20, 20, 0.5)` и короткий календарный Action
«Назначить урок». Отдельный внешний «Неделя / Месяц» удалён: компактный
right-aligned date control шириной 300 px на desktop показывает короткие
русские даты без точки после сокращения месяца, открывает календарь с «День /
Неделя / Месяц» и стрелками
сдвигает выбранный целый период. Рядом остаётся icon-only «Таблица / Карточки».
После controls непустая projection начинается сразу. Таблица сплошная белая,
без внешней рамки и с element/table radius 12 px; её header и data-row имеют
ровно 40 px. Header использует тот же белый фон, что data rows, а его нижний
divider 1 px входит в высоту header и через `--product-table-divider-color`
совпадает по цвету с разделителями между строками; weight равен 500 и текст
светлее. Обычные header/data cells используют inline-padding 12 px;
только последняя body action-cell получает inset 4 px вокруг единственного
`MoreVertical` trigger размером 32 × 32 px и радиусом 8 px. В точной 40 px
строке это даёт по 4 px сверху, справа и снизу и повторяет active option
переключателя вида. Контентные по ширине `Дата / Время` прижаты слева,
`Ученики / Статус` и действия — справа, а `Урок / Курс` делят свободную ширину.
Все данные чёрные и выводятся в одну строку с ellipsis; дата имеет вид
`Среда · 12 авг`, время — `12:00 · 60 мин`, scheduled state остаётся plain
«Ожидается». Видимые data-заголовки переключают ascending/descending
сортировку повторным кликом и публикуют направление через `aria-sort`.
Строка назначенного урока показывает pointer при наведении. В
последней колонке постоянное вертикальное троеточие ожидающего Run открывает
«Начать урок / Изменить / Отменить», а active/completed Run получают
соответствующие завершение или результаты; других action-кнопок в строке нет.
Start/cancel
переиспользуют существующие LessonRun mutations, cancel требует подтверждения,
edit открывает dialog назначения сразу в режиме редактирования. Пункты
portal-menu имеют 40 px, вертикальное
центрирование и `.88rem/400`. Прозрачные Schedule, Students и обе Courses
controls-панели используют всю ширину строки без горизонтального inset. Общие radius
tokens задают 20 px для карточек и 12 px для controls/tables/menus; активные
ProductTable surfaces Schedule/Students/Courses белые и borderless. Students и
обе Courses tables используют 40 px header/data rows; owned Course сортируется
через headers, Catalog сохраняет server-side cursor order. Students/Groups
сортируются через headers, а их единый «Фильтр»
объединяет status, group membership, конкретную группу и Account connection.
Сохранённый Course → **Уроки** также использует прозрачную full-width
search/create toolbar и белую borderless 40 px `ProductTable`; шесть data
headers сортируют только локальную projection с default `position ASC`.
Последняя колонка имеет 4 px inset и один 32 px `MoreVertical` с двумя
portal-actions: открыть Lesson и выполнить контекстное действие проведения.
Authenticated top header и profile dropdown тоже стали сплошными белыми
поверхностями без blur. Buttons/header controls используют единый flat
`40 px / 12 px / .88rem / 400` contract с fully opaque contrast-aware icons,
тонкой рамкой у белых кнопок и borderless menu items. Physical schema не
меняется; Course API добавляет recoverable soft archive с published/open-Run
guards. Refinement развёрнут exact merge commit
`84ffefecda99d3b0a9da82bf1eaf8ce76d9c6ea1` (PR #242); running image и
HTTP/CSRF/auth boundary postflight подтверждены.

**Current production contract дополнительно:** verified actual duration,
explicit shared individual comment, cursor-paginated self/observer history и
real-record progress без speculative metrics.

**Next — live:**

- основной runtime cursor указывает на Student Screen Slide и не создаёт
  authored Step; внутреннее состояние интерактивного Component при
  необходимости хранится отдельно;
- teacher управляет learner screen по умолчанию;
- Realtime используется после явной authorization модели;
- Realtime/presence и learner authorization проектируются поверх открытого
  LessonRun, а не через второй content-bearing LessonSession.

## P3: richer learning history, communication и product scale

- Component/runtime-produced subject metrics и richer progress signals поверх
  текущих finalized LearningRecord;
- common/individual Homework assignment snapshots;
- course chat и notifications;
- catalog moderation, ratings, official ShiDao content и контролируемый
  importer repository archive;
- AI change sets, undo, quotas и billing;
- optional staging перед публичным production;
- внешний MCP только после OAuth/scoped tokens, permissions, rate limits,
  audit и revocation.

## Не планируется возвращать

- Methodology как runtime/domain parent;
- Lesson Step или скрытый root Step;
- fixture fallback;
- renderer по ID конкретной Lesson/Course;
- service role в обычном browser/MCP flow;
- массовый reset `public` как обычный способ разработки;
- удаление или переписывание старых migrations;
- восстановление V1 без отдельной явной команды владельца.

## Как выбирать следующий milestone

Перед реализацией следующая сессия должна:

1. прочитать `AGENTS.md`, `docs/project-state.md` и релевантный canonical doc;
2. проверить текущий код/routes/schema вместо доверия roadmap;
3. выбрать один демонстрируемый workflow;
4. зафиксировать минимальный data/application/UI contract;
5. выполнить schema sanity check перед DB write;
6. реализовать, протестировать, развернуть и пройти сценарий;
7. обновить `project-state.md`, roadmap и связанные документы в том же наборе
   коммитов.
