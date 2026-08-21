# Roadmap ShiDao V2

**Статус:** current / next / later priorities после production identity release
**Актуально на:** 22 августа 2026 года

Фактически реализованное состояние находится в
[`docs/project-state.md`](./project-state.md). Этот документ описывает только
направление движения. Он не является текущей schema/API документацией.

## Принципы последовательности

1. Каждый этап завершается рабочим vertical slice на реальных данных.
2. Новая возможность переиспользует canonical contracts и code-first registry,
   а не создаёт параллельную content model. Authoring остаётся в Course Builder
   services; learner execution/evaluation получает отдельный application
   boundary.
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
9. LearningRecord остаётся compact LessonRun outcome; attempts, observations,
   evidence и derived objective state не складываются в его generic JSON.

## Current source / next production — frontend structural cleanup

- **Current:** весь Account entry contour (`/login`, `/join`, check-email,
  recovery, reset и onboarding) приведён к одной плоской product design system.
  Public Auth владеет route-scoped `auth.css` и общим `AuthPage`; onboarding
  использует existing app chrome. Legacy `ProductShell`, glass hero/form,
  raw Auth fields и misleading `.auth-checkbox` удалены. Auth/session/API/SMTP
  и schema contracts не менялись.
- **Current:** feedback использует accessible `Alert`, поля — shared
  `FormField`/`Input`, checkbox — shared `Checkbox`, а единственный сильный
  submit — явный `Button` variant `inverse`. Source и production-browser gates
  защищают desktop/mobile geometry, focus, forced colors и reduced motion.
- **Current verification:** `742/742` unit/API/contract tests и `29/29` strict
  production-mode browser scenarios проходят вместе с typecheck, lint и
  repository-wide format check; Auth scenario проверяет 1280 и 320 px.
- **Current:** shared `SegmentedControl` выражает visual variant через
  `data-variant`, selection через `aria-pressed` и имеет одну option class;
  измеряемый indicator, exact geometry и accessibility contracts сохранены.
- **Current:** compact `ActionMenu` является явным `triggerSize="compact"`
  primitive variant вместо Course/Lesson/Schedule/Students specificity forks.
- **Current:** `AppPageHeader` не содержит redundant heading wrapper или state
  classes; Communication Center владеет единственным current assistant action
  UI, а несмонтированные floating launcher/panel и глобальный stylesheet
  удалены.
- **Current:** удалены только selectors/tokens/components с подтверждённым
  отсутствием production references; marketing reduced-motion override
  ограничен своей landing surface. Schema, API и Lesson workflow не меняются.
- **Current:** production naming больше не наследует demo-era vocabulary:
  каноничны `app-page-shell`, `app-top-nav`, `site-header-shell-app` и
  `--product-*` tokens. Assistant page context принадлежит Communication
  Center; misleading `(teacher-required)` / `(profile-required)` route groups
  и повторные Account guards удалены без изменения URL/access policy.
- **Current:** Communication Center/page-motion CSS загружается только в
  protected app, Store CSS — только на `/store`. Общие file/checksum, JSON
  request, error/surface helpers и module-level date formatters имеют одного
  владельца; неиспользуемые UI abstractions удалены.
- **Current verification:** `727/727` unit/contract, `28/28` strict
  production-mode browser scenarios, typecheck, lint, repository-wide format
  check и production build проходят.
- **Next:** канонизировать буквальную общую table geometry через существующий
  `ProductTable`, вернуть portal geometry `ActionMenu` самому primitive и затем
  route-scope remaining teaching/navigation/marketing CSS. Каждый slice имеет
  independent browser visual-parity gate.
- **Later:** включить automated CSS ownership/specificity/dead-token checks
  после разделения route boundaries; dynamic variants нельзя удалять только по
  статическому совпадению.

Канонические правила находятся в
[`docs/architecture/frontend-style-system.md`](./architecture/frontend-style-system.md).

## Current source / next production — TopNav, backlink rhythm и title-row

- На desktop Product TopNav возвращён в normal document flow: он не
  sticky/fixed и при scroll уходит вверх вместе с content. До `767 px` TopNav
  становится viewport-fixed, учитывает safe-area и остаётся у верхнего края;
  его точная высота заранее зарезервирована в app shell. Прозрачный внешний
  слой не блокирует content, а pointer-transparent gradient начинается на
  `12 px` ниже белого shell и плавно набирает opacity к верхней границе
  viewport. Root `scroll-padding` использует ту же динамическую высоту, поэтому
  anchors, focus и `scrollIntoView()` остаются ниже fixed stack при любом
  safe-area.
- Белый product shell имеет точную высоту `64 px`. Общий inner container-row с
  brand, navigation и actions/avatar на desktop имеет exact высоту `40 px`,
  вертикально центрирован с `12 px` сверху и снизу и задаёт всем трём зонам одну
  centerline; nav/action wrappers не увеличивают высоту ряда. Mobile inner row
  и burger target равны `48 px`. Радиус и однослойная тень не меняются.
- Hover неактивного пункта main navigation использует exact 5%-black background
  `rgba(0, 0, 0, 0.05)` и остаётся видимым при готовом measured active-pill.
- Направление движения page header использует полный линейный порядок
  `Расписание → Ученики → Курсы → Магазин → Профиль`: avatar открывает Profile
  вперёд, а возврат из Profile в любой основной раздел движется назад.
- `AppPageHeader` всегда сохраняет backlink-row и одинаковую высоту начала
  heading. Настоящий link/button/text появляется только при переданном `back`;
  top-level page не получает фиктивный интерактивный элемент.
- H1 и правая action-секция образуют одну title-row: нижняя граница action rail
  совпадает с нижней границей H1. Зарезервированная backlink-row выше и
  metric/meta ниже остаются только в content-column и не сдвигают actions. При
  реальной нехватке ширины intrinsic action rail переносится в отдельный ряд.
- Slice UI-only: API, schema, migrations и Lesson hierarchy не меняются.
  Следующий release step — UI gates, обычный Coolify rollout и authenticated
  desktop/mobile scroll/hover postflight с проверкой `64 px` shell, desktop
  inner row `40 px`, protected-mobile inner row и burger target `48 px`, равных
  `12 px` отступов, общей вертикальной centerline TopNav и
  совпадения нижних границ H1/action rail в `AppPageHeader` с пустой и
  заполненной backlink-row.

## Current source / next production — mobile responsive polish

- `AppPageHeader` теперь оставляет короткий H1 и intrinsic action в одной
  title-row на узком экране, пока они действительно помещаются, сохраняет их
  общее block-end выравнивание и переносит action отдельным intrinsic-width
  рядом только при нехватке ширины.
- `WorkspaceTabs` сохраняет горизонтальный swipe, скрывает системный scrollbar
  и показывает только доступные fade-chevron направления; кнопки прокручивают
  ленту, не выбирая вкладку, а keyboard/ARIA/indicator остаются прежними.
- Protected mobile header использует непрозрачный белый shell, wordmark
  `26 px` и burger `48 × 48 px` с каноническим Lucide glyph `16 px / 2 px` и
  стандартным vector rendering без `non-scaling-stroke`.
  Закрытый burger остаётся
  белым без sticky touch-hover/focus halo; pointer-open не фокусирует первый
  пункт, а keyboard-open сохраняет видимый inset focus, стрелки, Home/End,
  Escape и focus return. Короткое главное меню
  «Расписание / Ученики / Курсы / Магазин / Профиль» с именем и допустимым
  email. Это единственный navigation dropdown: прежний Account/avatar dropdown
  удалён, а avatar на protected desktop и authenticated landing ведёт напрямую
  в `/profile`. Panel занимает viewport с inset `12 px`, gap `12 px`, радиусом
  `16 px`; Account header показывает `48 px` avatar, имеет равные block-insets
  и full-bleed светлый divider. Menu rows равны `68 px`; label имеет
  `14 px / 400`, имя профиля — `14 px / 600`, email — `12 px / 400`, а
  avatar fallback — `.72rem`. Burger/menu glyphs остаются `16 px / 2 px` со
  стандартным `vector-effect`.
- App viewport использует `viewport-fit=cover`; app `theme-color`, manifest,
  `html`, `body` и shell согласованы на `#f5f1e8`, а shell покрывает минимум
  `100dvh`. iOS browser chrome и elastic overscroll получают тот же цвет без
  отключения нативного bounce; safe-area применяется к fixed header и нижнему
  краю content.
- На ширине до `767 px` и при любом coarse/touch pointer обычные Course
  search/input/select, actions, Schedule date navigator, WorkspaceTabs и
  segmented controls имеют одну внешнюю высоту `40 px`. Action-glyphs равны
  `16 px` со stroke `2 px` и стандартным SVG `vector-effect`; ordinary
  non-editable labels и segmented options используют один canonical
  product-control type `.88rem/400/1.2`. На всех плотностях segmented shell имеет
  реальную внешнюю product-рамку `1 px`, `padding: 0` и gap `2 px`; две actual
  icon-only options `38 × 38 px` внутри него дают ровно `80 × 40 px`.
  Shell использует radius `12 px`, options — концентрический radius `11 px`.
  В current source / next production selection рисует один реальный measured
  `.product-segmented-control-indicator` высотой `38 px` и radius `11 px`, а не
  per-option или pseudo plates. Он absolute, `aria-hidden`,
  `pointer-events: none`, не участвует в layout и получает pure-white surface с
  `border: 0` и только неизменной ordinary base/pressed outer shadow без hover
  elevation. Shell сохраняет `overflow: visible`, поэтому moving shadow выходит
  за его product-рамку и не обрезается геометрией group. Actual selected button
  сохраняет `aria-pressed`, focus/disabled semantics и белый borderless fallback
  с той же единственной base shadow до готовности indicator; после ready она
  прозрачна и без тени. Неактивная option прозрачна
  и не получает фон или тень при hover — меняется только цвет glyph.
  `ResizeObserver` следит за group/options, readiness не допускает initial
  fly-in, а rapid changes retarget тот же plate к последнему выбору. Motion
  использует общие с `WorkspaceTabs` tokens: `360ms`,
  `cubic-bezier(0.22, 1, 0.36, 1)` и `120ms` fade; reduced motion оставляет
  мгновенный перенос, forced colors скрывает plate и показывает actual selected
  button через `Highlight / HighlightText`. Все девять consumers — Schedule
  period/view, Students membership/view, Owned Courses view, Catalog
  audience/view, New Course audience и Store view — используют этот shared
  `SegmentedControl` без локальных fork; glyph остаётся `16 px / 2 px` на всех
  плотностях.
  Exact `80 × 40 px` относится только к двум icon-only cells. В current source /
  next production semantic text groups на narrow/coarse могут сжиматься в
  parent (`max-width: 100%`, `min-width: 0`, `flex-shrink: 1`), их options
  используют `min-width: 0` и `flex: 1 1 0`, а видимый однострочный label
  получает ellipsis без сокращения полного accessible name кнопки.
  Current source / next production не задаёт отдельный mobile type/icon token:
  ordinary non-editable controls сохраняют desktop visual parity. Native
  editable inputs/selects/textareas, включая authored Lesson/Component,
  упражнения и поля ответа, сохраняют content typography с независимым
  минимумом `16 px`, предотвращающим iOS focus zoom в portrait и landscape без
  запрета pinch zoom.
  Launcher
  «Сообщения» в том же narrow/coarse contract равен `56 × 56 px`, glyph —
  минимум `24 px`, safe-area сохранён; non-fullscreen panel сохраняет `12 px`
  зазор над launcher. Fullscreen mobile panel использует слой `110` поверх
  fixed TopNav `100` и ниже confirmation dialogs `120`. Authored Component-card
  actions `44 × 44 px` остаются отдельным touch/category exception. Portal
  `ActionMenu` сохраняет desktop parity и на mobile/coarse: row `40 px`, label
  `.88rem/400`, icon `16 px`.
  Широкая Course table остаётся
  desktop projection, а до `767 px` заменяется семантическим списком компактных
  карточек без page-level horizontal scroll. Query, presentation state и
  Course actions остаются общими с desktop.
- Канонические белые product surfaces используют один непрозрачный
  `--product-surface-background: #fff`: TopNav, dropdown, plain cards/workspaces,
  inputs/selects/textareas, Run history и published-Course surfaces. Semantic status,
  marketing glass, hover/overlay и header-fade fills остаются явными
  исключениями. Dropdown shadow направлена вниз и не затемняет
  белый header над панелью.
- Local UI gates завершены: `723/723` unit/contract и `28/28` strict
  production-mode browser scenarios, typecheck, lint, format check и production
  build прошли. Следующий release step — обычный Coolify rollout и
  authenticated real-iPhone postflight для Safari chrome/elastic overscroll;
  API, schema и migration work для этого среза не нужны.

## Current source / next production — compact toolbar controls

- Course и Store удаляют disclosure «Фильтры» вместе с неиспользуемым
  advanced-filter state. Поиск, category/audience direction, сортировка,
  cursor и представления сохраняются в тех разделах, где они уже являются
  отдельными controls. Catalog RPC по-прежнему умеет server-side
  subject/level filtering и facets, но current web UI не выставляет эти
  параметры.
- Students вместо dropdown показывает один inline toggle **Все / В группе /
  Без группы**. Status, Account-state и concrete-group controls удаляются;
  archived/pending строки остаются доступны в режиме «Все» и через поиск.
  Toggle применяет narrowing сразу и не вызывает toolbar reset-action; query-only
  «Очистить поиск» не меняет выбранный membership mode.
- Store sort становится канонической ShiDao-выпадашкой, а не native
  platform-select. Trigger не получает input halo; keyboard navigation,
  selected state, Escape и focus return остаются обязательными. Category и
  sort применяются сразу без toolbar reset-action; очистка появляется только для
  непустого поиска и сохраняет остальные параметры каталога.
- Focus halo text/search inputs прилегает к рамке (`outline-offset: 0`), а
  Schedule date navigator переиспользует общий product border/background-clip,
  radius и static base shadow без custom inset/двойной тени.
- Release step — UI gates, desktop/mobile browser acceptance, normal Coolify
  rollout и authenticated postflight. Новая schema или migration не нужны.

## Выполненный фундамент

- V1 зафиксирована в immutable Git refs и private recovery snapshot.
- «Мир вокруг меня» сохранён в repository archive с Markdown, raw exports,
  source documents, assets, manifests и checksums.
- `shidao.ru` переведён в landing-only, V2 работает на `v2.shidao.ru`.
- Старый Methodology/Step/runtime код удалён из активного приложения.
- Каноническая модель стала `Course → Lesson → ordered Components`.
- Реализованы persisted Course, Lesson, 20 Component types и private
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
  optional entity-metric, всегда зарезервированной backlink-row с optional
  интерактивным backlink и правой action-секцией. Метрика не заменяется
  пояснением назначения страницы; если честной метрики нет, supporting line
  отсутствует. Высота Header определяется содержимым и padding без
  искусственного minimum. В current source H1 и action rail образуют общую
  title-row с совпадающими нижними границами; зарезервированная backlink-row
  выше и metric/meta ниже не участвуют в выравнивании actions. При реальной
  нехватке ширины intrinsic action rail переносится в отдельный ряд.
  Асинхронные метрики заранее резервируют одну строку `1lh`; title, meta,
  actions и известные вкладки становятся видимыми сразу и не ждут ни metric,
  ни page-content. Поздняя metric проявляется только внутри зарезервированной
  строки без layout jump. В current production
  heading занимает всю оставшуюся ширину, а actions — только intrinsic ширину
  содержимого и не превращаются в full-width кнопки на mobile.
  Current production follow-up снимает внутренний лимит H1 `24ch`, сохраняет
  desktop gap 24 px и делает все backlinks непрозрачно чёрными, однострочными с
  ellipsis и равным page-header inset сверху и снизу. Current source сохраняет
  ту же backlink-row и начало heading даже без `back`, но не создаёт пустой
  link/button или текст.
  Все product consumers, включая Courses index, owner/new/published Course,
  Lesson, Students, learning/observing profile и learner dialog, используют
  один `WorkspaceTabs`: 40 px, roving keyboard/ARIA, horizontal scroll,
  baseline 1.2 px и inactive label общего 50%-black цвета с
  `inline-inset: 0`, gap 12 px, верхние радиусы 12 px и квадратный чёрный
  active-сегмент 4 px. Tab-glyph равен `16 px` с Lucide stroke `2 px` и
  стандартным vector rendering на desktop, narrow и coarse; только
  positive count показывается маленьким приподнятым `sup`, а `0` не рендерится.
  Current production motion follow-up заменяет отдельные active pseudo-elements
  одним измеряемым indicator: он мягко меняет ширину и положение, а новая
  tab-panel слегка проявляется по направлению выбора. Header action rail
  оставляет не больше одной основной кнопки; дополнительные Lesson actions
  находятся в квадратном `MoreVertical` menu. Persistent transition boundary
  анимирует направление primary navigation и Course drill-in/back, но route
  navigation и RSC/data wait выполняются вне native View Transition. После
  ready commit используется отменяемый CSS entrance; named native element
  остаётся только `app-page-header` для синхронных updates. Единственный
  локальный black indicator анимирует `width/transform` к выбранному primary
  button через общие с `WorkspaceTabs` и `SegmentedControl` tokens
  `--product-selection-motion-duration: 360ms` и
  `--product-selection-motion-easing: cubic-bezier(0.22, 1, 0.36, 1)`
  одновременно с синхронным route dispatch и никогда его не задерживает;
  `TopNav` принадлежит persistent `(app)/layout`, а не отдельным page, поэтому
  тот же DOM pill переживает route commit. Onboarding и Course
  `student-preview` остаются вне этого product chrome, а mobile session-меню
  закрывается при изменении pathname. Собственный named/native pill transition
  удалён, поэтому серый ghost, второй чёрный слой и snapshot-scale не возникают.
  Glyphs визуально остаются `#000` вне pill и `#fff` внутри: isolated nav-track
  имеет непрозрачный белый backdrop, а nav-list не создаёт отдельный stacking
  context. Новый быстрый intent
  немедленно supersede-ит прежний pre-commit/pending route, перецеливает тот же
  pill и синхронно dispatch-ит новый URL; stale response не может commit-ить
  старый target. Ожидание данных не блокирует cursor, links, focus или следующие
  клики.
  Current source follow-up дополнительно прогревает full RSC payload пяти
  главных Account routes (`/schedule`, `/students`, `/courses`, `/store`,
  `/profile`) и их компактные header summaries из persistent protected shell.
  Account-scoped in-memory cache использует request dedupe, bounded TTL и
  stale-while-revalidate, поэтому повторное открытие раздела не возвращает
  header в пустое pending-состояние. Это не cache содержимого страницы:
  content loaders остаются независимыми `no-store`, а mutations Schedule,
  Students, Profile и LessonRun schedule/reschedule/cancel/complete из Course
  инвалидируют соответствующий summary. Schedule/Students warmup использует
  лёгкие owner-scoped exact-count projections и не гидратирует полные списки.
  Store сохраняет синхронную локальную metric, а
  необязательная metric Courses не создаётся без честного измерения.
  Owner/published Course больше не подменяют готовый header текстовой
  loading-card; boundary bounded-временем ждёт real header.
  `prefers-reduced-motion` полностью отключает motion.
  Базовый follow-up был подтверждён в release `77870e3`; full-width
  канонизация развёрнута exact merge commit
  `84ffefecda99d3b0a9da82bf1eaf8ce76d9c6ea1` (PR #242).
  Текущий совокупный UI contract развёрнут exact source
  `1d4e5deff83cbdc1b479b16e4220cf799327009f`; Profile/avatar rollout evidence
  зафиксирован в [`docs/project-state.md`](./project-state.md).
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
- Lesson planning и compatibility course-scoped read-only Assistant получают
  состав выбранных групп и
  отдельных учеников, а также bounded finalized learning history эффективной
  аудитории без технических IDs; отсутствие не трактуется как непонимание.
- В release `0276aed` развёрнуты и проверены RouterAI provider adapter,
  Course/Lesson
  preview → explicit apply и compatibility course-scoped read-only assistant;
  production runtime
  получает API key из server-side secret environment и использует проверенный
  default `google/gemini-2.5-flash-lite`.
- **Current deployed follow-up:** единый persisted Communication Center в
  protected `(app)` layout заменил отдельный System Assistant launcher. Его AI
  conversations получают allowlisted page context и могут вернуть максимум
  одно signed proposal из Course/Lesson allowlist; mutation выполняет canonical
  service только после явного подтверждения. Current production boundary и
  postflight зафиксированы в `docs/architecture/communication-center.md` и
  `docs/project-state.md`.
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

**Current production UI follow-up:** `/profile` стал единым адресуемым
разделом с вкладками `Профиль / История / Аттестация / Наблюдатели / Настройки`.
Отдельный settings shell удалён; старые `/learning-profile` и `/settings/*`
остаются compatibility redirects. Teacher connection requests, AI consents и
subject lifecycle не
удалены, а перенесены в соответствующие вкладки. Это UI/routing slice без schema
или migration. Все вкладки используют единый opaque-white profile surface;
avatar settings показывают только текущий avatar и две основные команды, а
выбор preset и preview собственного файла выполняются в отдельных modal flows.

**Current Account avatar follow-up:** AV1 DB-first contract применён к
production; каждый Account имеет ровно одно
avatar state: один из 20 immutable ShiDao presets либо private custom WebP.
Обязательным является само Account avatar state; radio-selection появляется
только внутри модального выбора preset, а отдельный upload flow безопасно
нормализует собственное изображение. Account menu отображает результат вместо
initials. Preset fallback
и backfill закрепляют обязательность для signup/provisional/existing Accounts,
а private Storage/RPC/session boundary не открывает object path browser payload.
Этот vertical slice включает forward migration, typed manifest/assets,
server-side image normalization, API/UI, schema snapshot и regression tests;
он не превращает avatar в learner/observer capability и не расширяет Course
access.

**Current source / next production navigation follow-up:** avatar сохраняет
то же Account-owned изображение, но перестаёт быть dropdown-trigger на
protected desktop и authenticated landing: обе поверхности используют прямую
ссылку `/profile`. Единственный navigation dropdown остаётся в protected
mobile header за burger-кнопкой и содержит только Account name/privacy-safe
email и пять основных маршрутов. Sign-out и адресуемые profile tabs остаются
внутри `/profile`; rollout и authenticated production postflight ещё не
заявлены.

**Current source / next production image delivery follow-up:** public Store и
20 preset-avatar masters используют built-in `next/image` + уже установленный
Sharp, explicit local allowlist, surface-specific `sizes`/quality и public
cache floor `7d`. Private custom avatar остаётся за authenticated direct custom
loader: exact revision, allowlisted width и opaque HMAC delivery key проверяются
до Storage/resize; cache изолирован `private` + `Vary: Cookie` + ETag, initials
видимы во время load/error. Private Course/Lesson signed images намеренно
остаются `unoptimized` до отдельного authenticated derivative slice, потому что
общий cache не должен переживать expiry/revoke/access change. Communication
сейчас использует initials/Lucide; attachments остаются later. Новых dependency,
schema, migration, bucket или message API нет. Полный boundary:
[`docs/architecture/image-delivery.md`](./architecture/image-delivery.md).

**Current source / next production avatar rendering follow-up:** общий
`AvatarImage` больше не держит чёрный initials fallback под успешно загруженным
preset/custom изображением. Fallback виден только до `load` либо при ошибке;
после успеха он удаляется, поэтому скруглённые antialiased края цветного avatar
не показывают чёрные углы. Это UI-only исправление без schema, migration или
изменения Account avatar state.

Согласованный target:

- один roleless Account может одновременно преподавать, учиться и наблюдать;
- каждый active Account имеет ровно один canonical LearnerProfile как
  transaction-safe DB invariant, а offline profiles остаются unclaimed до
  consented connection;
- каждый Account имеет обязательный Account-owned avatar без зависимости от
  learner role/profile; custom photo остаётся private Account data;
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
6. **Observer:** self-managed invite/accept/revoke и узкая read-only finalized
   projection. Собственные наблюдатели находятся во вкладке `Наблюдатели`
   единого профиля; profiles, которые наблюдает текущий Account, остаются в
   третьей вкладке `Наблюдение` раздела `Ученики`. Teacher relation не выдаёт
   observer access.
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

## P0.2: завершить базовый teacher authoring

Цель — превратить рабочий технический редактор в уверенный ежедневный
инструмент преподавателя без изменения доменной модели.

**Current production:** primary navigation содержит «Расписание / Ученики /
Курсы / Магазин» без role switch. Account menu открывает пять
адресуемых вкладок единого профиля; observer projection чужих profiles остаётся
во вкладке «Наблюдение» внутри «Ученики». Каталог `/courses` получил поиск, реальные
Course-фильтры, сортировку и переключение «Карточки / Таблица» без новой schema
или параллельного Course API. В current production Students и Courses controls
унифицированы с Schedule: outer toolbar-card удалена, Students показывает
active/archive/pending в одной таблице с inline status/text, full-width search и
единым disclosure «Фильтр» для status, group membership, конкретной группы и
Account connection. Current production показывает в header только counts текущей
Students-вкладки; прежнее пояснение назначения раздела удалено. Отдельный sort select у
Students/Groups и Course **Мои** удалён: возрастающее/убывающее направление
переключается кликом по sortable headers, Course facets собраны в компактный
disclosure, а view — в две icon-only кнопки. Published Catalog показывает
только поддержанные server-side
subject/level filters, но использует тот же cards/table presentation; повторный
заголовок, пояснение и видимые result counts удалены. В current production Schedule
также сводит выбор даты и режимы «День / Неделя / Месяц» в один компактный
календарный popover справа от страницы: desktop-контрол имеет ровно 300 px,
короткие русские подписи периода без точки после сокращения месяца и оставляет
рядом только icon-only «Таблица / Карточки». Белая таблица использует общий
product border, clipped background и статическую surface-тень; компактные
`Дата / Время` находятся слева, `Ученики / Статус` и действия — справа,
а `Урок / Курс` делят свободную ширину. Все данные чёрные, однострочные и
сокращаются ellipsis; header и data-row ровно 40 px, причём разделитель входит
в высоту header, его weight равен 500. Header имеет тот же белый фон, что data
rows, а его нижний divider и разделители между строками используют один
`--product-table-divider-color`. Обычные header/data cells получают
канонические 12 px слева и справа; последняя body action-cell использует 4 px,
а её единственный `MoreVertical` trigger имеет 32 × 32 px и радиус 8 px. Так
в 40 px строке остаются одинаковые 4 px сверху, справа и снизу. Это отдельная
плотная action-категория, намеренно меньшая, чем actual option `38 × 38 px`
переключателя вида.
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
белые, используют общий product border, `background-clip: padding-box` и
статическую raised-surface тень. Students и обе Course-таблицы
получают такой же 40 px header/data-row contract. Students показывает
`Ученик / Статус / Аккаунт / Группы / Добавлен / actions`, Course **Мои** —
`Курс / Предмет / Уроки / Публикация / Обновлён / actions`, а **Каталог** —
`Курс / Предмет / Автор / Уроки / Материалы / actions`. Course tables используют
fixed column layout и ellipsis вместо вытеснения правой колонки за контейнер.
Их shared header белый, а row dividers используют один
`--product-table-divider-color`. Owned Course headers сортируют полную
client-loaded projection; cursor Catalog сохраняет server order. Один
`MoreVertical` в каждой Students-row
открывает contextual menu: профиль, управление группами, реальный
«Добавить в курс…» с сохранением существующей group/direct audience и
destructive «Убрать из списка». «Написать сообщение» для active linked learner
открывает единый current production центр «Сообщения» через
`learnerProfileId`.
Archived/pending rows получают только допустимые restore/permanent-delete или
cancel actions. Authenticated top header/profile menu стали
сплошными белыми поверхностями без blur. Active V2 buttons/header controls
унифицированы как raised `40 px / 12 px`: общий белый surface, product border,
base shadow, hover lift, pressed/focus и reduced-motion states. Base/desktop
ordinary non-editable controls и segmented labels используют один canonical
type `.88rem/400/1.2`; current-source / next production narrow/coarse наследует
его без font override, а полностью непрозрачные контрастные glyphs —
`16 px / 2 px` со стандартным vector rendering. Contextual menu items остаются
плоскими и на touch сохраняют desktop contract `40 px / .88rem/400`. Отдельный
Settings shell и side navigation удалены:
`/settings/*`
перенаправляет в соответствующие вкладки `/profile`, использующие тот же
product shell, TopNav и shared controls; landing, Auth и полноэкранный Student
Screen не меняются. Эти visual
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
heading и унифицирует WorkspaceTabs: container и 50%-black baseline толщиной
1.2 px занимают всю ширину с `inline-inset: 0`, а positive count показывается
маленьким `sup`. Course workspace использует четыре вкладки;
настройки и audience редактируются inline на растущей **О курсе**, а
course-wide **Материалы** вынесены в отдельную агрегирующую библиотеку. Новый
Course начинает с **О курсе**; обычное сохранение возвращает туда же, тогда как
deterministic/AI-сборка открывает **Уроки**. Вкладка сохранённого Course
**Материалы** разделяет используемые и пока не используемые attachments и
показывает Lesson usage.
Current production page-header follow-up отдаёт оставшуюся heading-колонку уже
самому H1 без `24ch`, фиксирует 24 px между ней и intrinsic actions и переводит
backlink в один непрозрачно-чёрный ряд с ellipsis; равный вертикальный rhythm
следует page-header inset. Тот же current refinement полностью
удаляет optional eyebrow из `AppPageHeader` API и product consumers.
Current production tabs refinement переводит inactive labels и baseline на
один 50%-black token, задаёт baseline 1.2 px, gap и верхние радиусы 12 px,
добавляет иконку каждому tab и показывает только positive count как маленький
приподнятый `sup`. Current production follow-up задаёт этому count weight 500,
чтобы уменьшенная цифра оставалась визуально сопоставимой с основным label.
`/students` получает справа от «Фильтр» общий icon-only выбор **Таблица /
Карточки**: таблица слева и выбрана изначально, обе проекции сохраняют текущую
filtered/sorted выборку и contextual actions; тот же режим работает для групп.
Обе вкладки `/courses` переходят на тот же порядок и исходный табличный вид.
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
словарь; layout-only `divider` исключён. Current deployed web самопроверка живёт
только в preview state, а LA-M4 доставляет только authorization/read-only live
projection. Current production LA-M5 доставляет learner answer persistence,
server scoring и web execution ровно для `choice_quiz`; остальные interactive
types остаются preview/presentation-only.
Продуктовый выбор и границы зафиксированы в
[`docs/product/course-component-catalog.md`](./product/course-component-catalog.md).
Current production palette больше не меняет размер между категориями: responsive
panel ограничена viewport, а отдельный внутренний scroll сохраняет header и
category tabs неподвижными; дублирующие category heading/description удалены.
Карточки используют content-sized auto rows и прижаты к верхнему левому краю;
category divider удалён, а tabs и доступные Component cards имеют pointer.
«Ссылки» и «Файлы» являются отдельными presentation-категориями над прежним
registry `attachment`. План Lesson больше не обёрнут в `workspace-surface` и не
дублирует «Структура урока / План»: прозрачный toolbar содержит реальный поиск
по названиям уже добавленных компонентов слева и actions справа. Component
cards используют element-radius и стандартную table-shadow.

**Current production:** palette получает
representative static preview и короткое назначение для 19 вручную создаваемых
вариантов поверх 20-типового runtime registry. Legacy `heading` остаётся
read/render/modal edit/PATCH/publication-compatible, но исключён из всех
authored-create entry points: picker, REST `POST`, development MCP, AI и
deterministic assembler. «Текст» (`rich_text`) принимает заголовок, основной
текст или оба поля, требует хотя бы одно непустое значение, не меняет schema
version `1` и сохраняет старые body-only payload. Labels — ровно «Заголовок» и
«Текст», без «(необязательно)». Выбор типа
открывает внутри того же dialog локальный draft из canonical defaults; возврат
или закрытие ничего не создают, а `POST` происходит только по «Сохранить
компонент». Persisted Component card остаётся renderer-only: белая surface не
имеет border, базовая чёрная тень `0 3px 6px #0000000d` на hover/focus сохраняет
offset `3px`, но плавно меняется до `0 3px 12px #0000001a` без изменения
геометрии. 32 px controls вынесены в borderless/shadowless overlay на общей
белой подложке `rgba(255, 255, 255, 0.5)`, а Pencil открывает отдельный modal payload editor. Отмена не отправляет
mutation, `PATCH` выполняет только явное сохранение. Оба editor surface
используют обычные labels и 40 px input/select с canonical `.88rem/400`.
Tracked data migration `20260813063716_unify_heading_rich_text_components.sql`
переводит authored heading в title-only text и безопасно объединяет только
непосредственные пары с одинаковыми visibility/Slide/placement; immutable
publication revisions остаются исторически точными. Physical schema не
меняется. Safe rollout завершён в порядке compatible web → verified backup →
migration apply/postflight: `96 → 85` Components, `heading 17 → 0`,
`rich_text 38 → 44`, invalid shapes/empty Slides/dense violations `0`.
Exact source `dea92ca2c9af99fd5738e95fa9ca511aa10ca3da` развёрнут Coolify deployment
`xivwq5nkaak141mc0tw5ysce`; gate прошёл `581/581` unit/API, `23/23` local
strict browser и `72/72` schema/migration tests. Production guest HTTP и DB
postflight green; authenticated production browser smoke не заявляется.

**Current production follow-up:** Student Screen action на
authored Component card использует тот же `MonitorPlay`, что и вкладка «Экран
ученика», и работает как прямой `aria-pressed` toggle. Неактивная кнопка
скрывается вне hover/focus; активная голубая кнопка остаётся видимой постоянно
при размере `32 px`. Включение переиспользует Slide ближайшего предыдущего
learner-visible соседа, затем ближайшего следующего, иначе создаёт новый;
повторное нажатие снимает назначение. Persisted результат переживает reload.
Это UI/application-service follow-up без schema или API-shape изменений;
exact functional source `288fac3d7ab909cab0e26bffb6a0c156f9e12d81`
развёрнут Coolify deployment `jf5f0j9yp1cwkkf2880d65f4` (`id=945`). Gate
прошёл typecheck, lint, format, `585/585` unit/API и `23/23` strict
production-mode browser scenarios; production guest HTTP postflight green.

**Current production — P0 authenticated authoring ACL hotfix:** регрессия E2
trigger graph, из-за которой разрешённое сохранение Text Component и другие
authenticated Course-child mutations получали `42501 permission denied for
function educator_course_author_can_mutate` раньше audience/capability-проверки,
устранена forward migration
`20260813113041_fix_educator_course_content_guard_acl.sql`. Trigger guard
остаётся `SECURITY INVOKER`, predicate встроен в его тело, helper закрыт для
`PUBLIC`, `anon` и `authenticated`, RLS/table grants не расширены. Exact apply
завершился `COMMIT`; `12/12` postflight, семь triggers и rollback-verified
authenticated educator `rich_text` update прошли, counts `19/6/22/85` не
изменились. Current snapshot `2026-08-13T11:43:48Z` имеет SHA-256
`0a6eab37e1bbecc0084e281496346e5436fcbd1ac2b42e102e89951e71ff258e`.
Исправление DB-only и уже действует без отдельного Coolify deployment.

**Superseded production baseline:** все product buttons в
`AppPageHeader` имеют белый surface высотой `40 px`, border `0` и общий
двухслойный `--product-raised-control-shadow`, совпадающий с selected-состоянием
переключателя вида Расписания. Primary header actions получают чёрные
текст/иконку, Lesson «Удалить» сохраняет danger-цвет, а keyboard focus —
отдельный 2 px outline поверх неизменной тени. Изменение scoped только к header
actions, не добавляет сам выбор фона Course и не меняет API/schema/migrations;
rollout входит в exact functional source
`dea92ca2c9af99fd5738e95fa9ca511aa10ca3da`.

**Current production baseline / current source next production:** единый
raised-control contract распространяется на все
канонические `.product-btn`: белый surface, общий
`--product-surface-border: 1px solid oklch(0 0 0 / .1)`,
`background-clip: padding-box` и однослойная базовая тень
`0 1px 6px 0px oklch(0% 0 0 / 0.05)`. Полупрозрачная рамка композится с
ancestor/page background, а не с белой заливкой; фиксированный control остаётся
`40 px` снаружи и получает `38 px` внутренней client-area. Один общий
`.product-btn` state-contract обслуживает header, toolbar и filter CTA без
контекстных shadow/transform fork.
Fine-pointer hover использует `0 4px 10px -2px oklch(0% 0 0 / 0.16)` и
поднимает surface через `translateY(-1px)` без scale, а pressed `:active`
возвращает его на исходную позицию с тенью
`0 1px 3px 0px oklch(0% 0 0 / 0.14)`; layout и размеры control не меняются.
Keyboard outline и forced-colors fallback остаются отдельными доступными
индикаторами, reduced-motion отключает transition и translate, danger actions сохраняют
красный текст. Строчные ellipsis и Component-card icon-actions остаются
transparent/borderless/no-shadow; contextual menu panels/items тоже исключены.
В current source / next production compound toggles получают настоящую внешнюю product-рамку `1 px`; shell
`40 px` содержит actual options `38 px` с gap `2 px`. Единственный real
`aria-hidden` / `pointer-events: none` indicator измеряет selected actual button и
рисует её чисто-белую surface с `border: 0` и только неизменной ordinary
base/pressed outer shadow без hover elevation. Shell имеет `overflow: visible`,
поэтому moving shadow выходит за его product-рамку и не ограничивается внешней
геометрией group; actual button остаётся semantic и служит белым borderless
fallback с той же единственной base shadow до ready, после чего прозрачна и без
тени. Inactive option
не получает фон или тень на hover — меняется только цвет. Readiness исключает
initial fly-in, `ResizeObserver` поддерживает responsive width, а общие с
`WorkspaceTabs` `360ms` / `cubic-bezier(0.22, 1, 0.36, 1)` tokens позволяют
interruptible rapid retarget; reduced motion переносит plate мгновенно, forced
colors скрывает его в пользу actual system-highlighted button. Shell использует фон
`--product-surface-border-color`. Подзаголовки страниц и inactive tab text/icon
получают `oklch(0.19 0 0 / 0.6)`, а отдельный 1.2 px tab baseline —
`oklch(0.19 0 0 / 0.4)`. В deployed baseline белый sticky product TopNav
сохранял `68 px / 20 px`, но получил одну тень
`0px 6px 12px oklch(0 0 0 / 0.05)` без inset-слоёв. Базовый UI-only
production contract развёрнут в release `10888d5` и зафиксирован exact source
`1d4e5deff83cbdc1b479b16e4220cf799327009f`; его `68 px`/sticky геометрия
историческая и superseded current-source desktop normal-flow/mobile fixed
`64 px` + `12 px` fade contract выше. Новая segmented-геометрия относится к
current source / next production и не приписывается этому historical hash.

**Current production acceptance:** обычные CTA Auth recovery,
check-email, onboarding, identity invitation/completion и retry-state
переиспользуют shared `Button`/`productButtonClassName`; disclosure-trigger
«Фильтры» в Course, Students и Store становится обычной secondary
`.product-btn`, не меняя семантику `summary`, popover или disabled/focus
contract. Contextual menu
items, row/Component icon-actions и compound toggles остаются отдельными
плоскими controls.

Current source / next production supersedes только filter часть этого
acceptance: Course/Store disclosures удалены, Students использует inline
membership toggle, а Store sort — product dropdown без native-select UI.

Кнопки, поля и plain content surfaces разделяют
`--product-surface-border: 1px solid oklch(0 0 0 / .1)` и
`background-clip: padding-box`, поэтому border смешивается с фоном под
элементом. Для неинтерактивной глубины добавлен
`--product-raised-surface-shadow: var(--product-raised-control-shadow)`: shared
cards, canonical `ProductTable` wrappers вместе с subject progress, authored
Component/Run-history/Students/Store cards и progress stats используют одну
статическую базовую тень без hover/pressed transform или shadow-transition.
Существующие radius/background, semantic/dashed `SurfaceCard` borders и
внутренние row hover/focus состояния сохраняются; общий border не
перезаписывает смысловую рамку. Component/Store focus обозначается отдельным
outline, а
`forced-colors` заменяет тень системным контуром.

Base `.product-control` / `.field-input`, включая select и textarea, получают
общую рамку и clipped background. Shared `Input` и canonical однострочные
text/search fields дополнительно получают белый surface, внешние `40 px`,
внутренние `38 px` и статический `--product-entry-control-shadow`, равный
базовым `0 1px 6px 0px oklch(0% 0 0 / 0.05)`, единые foreground/типографику и
непрозрачные placeholder/icons. Hover не меняет shadow/transform, а click или
keyboard focus добавляет отдельный 2 px halo без изменения border или
геометрии; current source задаёт `outline-offset: 0`, чтобы halo прилегал к
рамке. Select и textarea сохраняют base boundary, но не получают
single-line height/entry shadow; checkbox/radio/file, dialog/menu/popover
surfaces, Student Screen content и raw utility panels исключены. Изменение
остаётся UI-only, не меняет schema/API/Lesson hierarchy и входит в текущий
exact application release.

**Current production:** общий `WorkspaceTabs`
уменьшает visual baseline с `1.5 px` до `1.2 px`, рисуя paint-layer высотой
`3 px` и сжимая его `scaleY(0.4)` от нижней грани. Такой способ исключает округление
обычной дробной CSS-высоты до одного или двух пикселей, не меняет 40 px tab
layout, scroll, interaction или 4 px active segment и применяется сразу ко всем
product consumers. API/schema/migrations не меняются; rollout входит в exact
functional source `dea92ca2c9af99fd5738e95fa9ca511aa10ca3da`.

**Current source / next production:** один universal dropdown surface
обслуживает active product panels: contextual `ActionMenu` для Course, Lesson
rows, Schedule и Students; protected mobile navigation menu; product selection
dropdowns, включая Store sort; Schedule calendar/date popover.
Course/Students/Store filter popovers удалены. Панель использует общий
внутренний inset `6 px`, белый фон, base element-radius `12 px` (мобильная
navigation panel локально сохраняет `16 px`), обычный `border: 0`,
ровно одну
направленную вниз тень `0 24px 32px -24px rgba(20, 20, 20, 0.24)` и
`backdrop-filter: none`. Тень не затемняет белый header над панелью.
Служебные separator/divider линии отсутствуют в contextual panels и calendar
footer; единственное намеренное исключение — full-bleed светлый divider между
Account profile header и navigation items в mobile navigation panel. Локальные
padding, border, blur и дополнительные shadow forks удалены. Forced-colors отключает тень и
возвращает системную границу `1px solid CanvasText` на `Canvas`. Native
`select`, самостоятельные modal dialogs и reference/demo-only surfaces
исключены; calendar panel остаётся dropdown surface независимо от своей dialog
семантики. Contextual `ActionMenu` сохраняет destructive/disabled states и
portal positioning; mobile navigation panel остаётся локально привязанным к
burger и сохраняет keyboard/Escape/focus return. API/schema/migrations не
меняются. Исторический
ActionMenu-only baseline впервые был развёрнут exact release
`8e5d169dab72dc285c0fdfe8991646152d9904c7`; universal follow-up расширяет его
scope без ретроспективного изменения этого release.

Current production body typography закрепляет Schedule как канон для всех
active product tables: `#141414 / .88rem / 400 / 1.3`; различия primary-cell
weight и локальные muted colors удалены, header typography не меняется.

- подтвердить production postflight responsive/accessibility контракта
  обновлённой Course Lessons table, включая mobile contained scroll, keyboard
  sort/menu и focus restore;
- добавить в сохранённый Course возобновляемую загрузку новых материалов с
  явной компенсацией незавершённых Storage operations;
- проверить production usability поиска Components в длинном Lesson plan;
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
- teacher без hover видит, назначен ли Component на Student Screen, а
  детерминированный toggle выбирает Slide без скрытых правил;
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
  authored-create Components (`rich_text`, `callout`, `single_choice_poll`,
  `matching_game`); legacy `heading` AI не создаёт, а расширение ручного
  registry не расширяет provider allowlist автоматически;
- отдельные preview и explicit Apply; provider planning не выполняет записи;
- stale-plan checks, idempotent Course retry и compensating cleanup для
  поддерживаемых apply paths;
- новые AI Components private-by-default и не публикуются на Student Screen;
- compatibility course-scoped read-only assistant с Course/selected Lesson
  context, без tools, mutation commands и persisted chat history;
- понятные provider errors и сохранение ручного workflow;
- фактические request ID/model/token usage в ответе и metadata-only server log;
- process-local rate/concurrency limit без новой persistence;
- attachment metadata без скачивания/парсинга file contents;
- отсутствие schema migration, durable quota/usage ledger и billing; текущий
  информационный meter Communication Center описан отдельно в P0.3a.

**Historical System Assistant baseline; superseded in current production единым
центром из P0.3a:**

До Communication Center этот deployed System Assistant оставался React-state
baseline. Production CC1+A2, dependent web/API и release postflight теперь
current и заменили описанный ниже launcher/history flow.

- один floating widget живёт в protected Account layout и не показывается на
  landing/Auth/demo; прежние кнопки course-scoped assistant удалены из Course и
  Lesson headers, а старый Course route может пока оставаться compatibility;
- **Superseded source-only visual refinement:** icon-only launcher уменьшен до
  стандартных `40 × 40 px`, использует element radius `12 px`, светлую
  aqua/mint/milk/lavender/pink opal-поверхность без border и `12 px` inset
  справа/снизу плюс safe area. Два независимо деформируемых
  turbulence/displacement-поля перетекают волнами с несоизмеримыми циклами, а
  reduced-motion показывает статичную композицию. Panel перенесён к тому же
  правому краю и сохраняет `12 px` промежуток над launcher;
  behavior/API/schema не меняются;
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
- в historical baseline dialog history оставалась только в React state.
  Rate/concurrency guard,
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
  но не выдавать текущий derived informational meter за hard balance или
  billing.

MCP остаётся development adapter. Production web вызывает application
service/contracts напрямую и не поднимает внешний MCP endpoint или статический
MCP actor. Полный current/source/deployment contract находится в
[`docs/architecture/ai-provider-integration.md`](./architecture/ai-provider-integration.md).

На этом этапе attachment используется только как metadata и явно введённый
teacher context. Нельзя писать «AI изучил файл», пока отдельный parsing pipeline
не вернул подтверждённый extracted text.

## P0.3a: единый центр «Сообщения»

**Current production:** один global launcher с общим unread badge заменяет отдельные AI,
notification и messaging entry points. Он открывает unified inbox, но сохраняет
явный provenance четырёх типов: direct, Course, **ShiDao · Система** и один из
нескольких persisted диалогов с видимой маркировкой **ИИ**. Contextual actions Students и
Course только открывают этот же центр на нужном thread; второго messenger flow
нет.

- direct conversation использует `LearnerProfile` как teacher-side target и
  разрешена только для active accepted relation с linked Account; browser не
  получает Account/Auth UUID, а archive/restore relation закрывает и возвращает
  capability без потери полной истории;
- Course owner и linked Account current effective audience видят всю историю
  Course thread, включая период до присоединения. Выход из audience закрывает
  read/send, повторное добавление возвращает доступ;
- human composer отправляет сообщение только по явному Send. AI или system
  event не может автоматически написать ученику или Course audience;
- закреплённая лента **ShiDao · Система** read-only и принимает только trusted
  typed events. Первый producer покрывает назначение, перенос и отмену
  LessonRun, owner aggregate и собственный learner-safe результат после
  завершения; произвольный `payload.href` не превращается в CTA;
- Account может создавать, переименовывать и архивировать несколько persisted
  AI conversations с fixed global/Course/Lesson context. Server сохраняет user
  turn, читает bounded persisted history/context, вызывает existing Assistant и
  trusted append-ом сохраняет assistant reply/proposal как один exchange;
- existing signed preview/explicit Apply сохраняется. Strict
  `lesson.schedule_run` показывает «Назначить урок» или «Перенести урок» и
  выполняет canonical LessonRun mutation только после отдельного подтверждения.
  Production-current A2 `schedule_lesson_run_if_unchanged` атомарно сравнивает
  expected no-open-Run или exact Run id/`updated_at`, draft roster и current
  Course audience перед canonical scheduler write; mismatch становится stale
  action, а Account/Auth UUID не выходят в browser contract;
- все proposal, прочитанные из persisted history при hydration, stale и
  fail closed; actionable может быть только карточка, возвращённая текущим
  mounted exchange. Durable action/job ledger и distributed exactly-once —
  later;
- inbox использует cursor reads, polling раз в 30 секунд, focus refresh и
  `visibilitychange` для read cursor выбранного диалога. Realtime/presence,
  push/email, attachments и background AI worker в первый slice не входят;
- parameterless communication GET получает canonical cursor/filter/limit
  defaults server-side. Первый inbox и остальные первые страницы не требуют
  явных `undefined`/`null` keys от browser; internal default Zod diagnostics не
  показываются пользователю;
- global launcher использует black/white message/X state и красный aggregate
  iOS-style unread badge. Desktop остаётся одной узкой panel: inbox, new dialog
  и conversation заменяют друг друга без expand/two-column mode. Main header
  без subtitle, initial open не фокусирует search, а Retry использует общий
  canonical product button. Panel теперь полностью opaque white; header и
  footer dividers идут full-bleed до обеих границ, а composer начинается через
  `12 px` после footer divider;
- system и assistant avatars используют единый black/white visual contract:
  wordmark-style `S` и Sparkles соответственно. Persistent green context
  callouts удалены; system explanation доступно по neutral `?` disclosure рядом
  с ShiDao. Empty AI dialogue не дублирует icon и показывает расширенные,
  context-aware и allowlist-accurate prompt chips обычной tab typography;
- входящие/исходящие message bubbles имеют `1 px` только у угла, из которого
  визуально выходит реплика. На fine pointer timestamp занимает прежнее место,
  но проявляется при hover/focus за `250 ms`; на touch/coarse pointer он всегда
  видим, а reduced-motion убирает transition;
- assistant replies и system notification bodies отображают safe CommonMark
  для абзацев, emphasis, списков, цитат и code. Raw HTML, images и active
  model-authored links запрещены, headings компактны; human/user messages и
  system titles остаются literal plain text. Existing persisted strings не
  требуют миграции и получают форматирование при рендере;
- raw token count заменён semantic progressbar высотой `4 px`: тёмно-зелёная
  доля показывает остаток из тестового месячного объёма `2 000 000` на Account.
  Server выводит usage текущего UTC-месяца из валидных persisted
  assistant-reply payloads owner-scoped сохранённых conversations, включая
  archived, через существующие user-JWT RPC. Meter загружается отдельным GET и
  не блокирует turns/exchange; его временная ошибка скрывает только полоску. Это
  informational meter без hard enforcement, reservation/settlement,
  distributed reconciliation или billing; новая migration и physical schema
  не добавлялись;
- forward schema/migrations, RPC/application/API и responsive UI current.
  Production DB CC1 + A2, snapshot и postflight current; dependent web/API
  initial rollout развёрнут exact source
  `2efaa86851fffc7e444af904fb900d9984caa6a8`
  через Coolify deployment `otekp2zseg5ig2r05v6taabu`, а production
  HTTP/auth/CSRF boundary postflight пройден.

**Next:** отдельными slices добавить durable action/job и token-usage ledger,
quota reservation/settlement с distributed enforcement, reliable background
completion producers, Realtime/presence и push/email delivery. LA-M4
source/web rollout уже current production. Текущий тестовый meter не
используется как billing balance.

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
- для детских publications добавление и duplicate создают новые
  Course/Lesson/Component/Slide IDs без audience, Runs, records, reports и AI
  consent; educator Course исключён из обоих flows;
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
policy. Fixtures не публикуются.

## P0.5: educator Course и Account attestation

**Current production baseline.** E1 database contract хранит
`children | educators`, immutable assessment definition и Account
attempt/award, привязанные к exact revision; score никогда не принимается с
клиента. Migration, initial dependent web/API и demonstration product data
развёрнуты. Production содержит один educator Course для преподавателя
китайского языка и реальный DB/RPC passed result `9/10 = 90%` с credential.
UUID parsing/toolbar hotfix развёрнут в exact functional web commit
`22b486a7163453019d9720cb4fe0f36ed7c0228d`.

**Current production.** Forward migration
`20260812150745_educator_course_governance_progress.sql` применена с `COMMIT` в
`2026-08-12T07:34:36Z`; current snapshot снят `2026-08-12T07:46:11Z` и имеет
SHA-256
`a34a5a5919ea406050a5c0cb7f39310d1a9e807725e608166f63becb8f2260a4`.
Database contract и deployed dependent source реализуют окончательную
governance/consumption модель:

- `account.can_author_educator_courses` с default `false` является свежим
  DB-backed trusted-author capability; только такой active Account видит
  audience choice в create flow и может редактировать educator content;
- authored educator Course переиспользует обычные Lesson/Components/Slides и
  attachments, но вместо owner **«Истории»** имеет definition-вкладку
  **«Аттестация»**;
- каждая publication revision сначала получает review `pending`; до admin
  approval она не видна в каталоге. Approved content читается только по
  `approved_revision_id`; pending update не вытесняет прежнюю approved revision;
- отдельный admin UI остаётся later, но service-only approve/reject RPC и DB
  gate уже входят в repository contract;
- educator publication всегда official ShiDao content. Карточка, таблица и
  published header показывают `ShiDao` вместе с именем эксперта-автора;
- catalog audience toggle остаётся только в общей toolbar списка. Item
  открывает отдельный `/courses/catalog/[publicationId]` workspace с собственным
  header/backlink и вкладками **«Уроки / О курсе / Материалы / Аттестация»**;
- published API отдаёт learner-safe immutable projection: только
  `learner_visible` Components, назначенные на Slides, без Lesson summary,
  staff-only/operational data; course-wide publication materials получают
  краткоживущие signed URLs;
- Account self-enrollment и Lesson completion сохраняют last opened Lesson,
  completed refs/counts/percent и resume для exact approved revision;
- **«Аттестация»** блокируется до `100%` Lessons и UI, и обоими server RPC;
  успешный current-revision result показывает badge в header и credential в
  профиле, а historical award остаётся отдельной записью;
- educator Course никогда не копируется из каталога и не дублируется, включая
  состояние после award; DB/UI также запрещают roster, groups/direct learners,
  schedule и LessonRun. Это self-learning Course текущего Account, а не Course
  для проведения занятий.

Initial E2 web rollout завершён Coolify deployment `ikw0bj347reelzotaqo15a39`
в `2026-08-12T07:58:39Z`: `SOURCE_COMMIT` и image tag совпали с exact commit,
image ID —
`sha256:214e954aed0355c1881ea778e65dcb7f4c4cabcde4d7ac2e3f6022322bd8e027`,
restart count `0`, HTTP host/CSRF/auth postflight green. Это functional E2
baseline `22b486a7163453019d9720cb4fe0f36ed7c0228d`; текущий deployed application
source — `1d4e5deff83cbdc1b479b16e4220cf799327009f`. DB и web/API slice являются
current production.

**Later:** admin UI для capability/review, юридически значимые удостоверения,
proctoring, manual/free-response assessment, expiration/retake policy и
optional self-study deadlines.

## P1.0: учебный магазин и commerce boundary

Цель — дать преподавателю и ученику простой путь к физическим материалам для
занятий, не выдавая UI-прототип за работающую коммерцию.

**Current production:** `/store` добавлен четвёртым пунктом
universal Account navigation. Типизированный статический каталог поддерживает
категории, поиск, сортировку и два вида над одним результатом; отдельные
audience/price/availability filters удалены. Header action открывает локальную
корзину и checkout с именем, телефоном, email и адресом. Последний шаг явно
помечен как demo: card fields, network request, persisted order и оплата
отсутствуют. Стабильный в текущем demo-каталоге product slug позволяет открыть
`/store?product=<slug>`, но Lesson contracts пока не изменяются.

**Current source / next production:** 19 square WebP masters девяти товаров
нормализованы до `1254 × 1254` quality `90` в
`public/store/products/<slug>/` и связаны ordered-массивами с fixtures.
Built-in `next/image` + существующий Sharp отдаёт responsive variants по local
allowlist/`sizes`: quality `75` на card/thumbnail и `85` в detail, cache floor
`7d`, без новой dependency. Swipe и общие `FadeChevronButton` arrows листают
галерею; стрелки имеют borderless radial fade, dots приглушены без shadow.
Обычный click/tap фото, title или non-control card area открывает product
`DialogShell` до `56rem × 42rem` с gallery/thumbnails, полным description,
price, add и buy-now. Buy-now гарантирует quantity `>= 1` и переходит в
delivery после закрытия detail. Card → dialog → card использует View Transition
с unsupported/reduced-motion fallback; deep link остаётся scroll/focus.

Category/audience pills сохранены в обеих плотностях, включая compact. Нижние
tag-pills, placeholder icons/glyphs, availability, stock gating, card
`ShoppingBag`, footer divider и header demo chip удалены; card CTA использует
`ShoppingCart`, честная demo-маркировка detail/checkout сохранена. Прежняя
таблица заменена compact cards: широкий экран переключается между `3` и `6`
колонками, tablet — `2/4`, mobile — `1/2`. Цена увеличена и выровнена с кнопкой
корзины. Это application/public-assets slice без Product, Inventory, API,
Supabase Storage, schema или migration.

**Next:** отдельно спроектировать Product/Order/Inventory, admin catalog,
управляемые изображения и документы в Storage, delivery/legal contract и
платёжного провайдера. Текущие source-controlled demo-фото не подменяют эту
модель. Только после этого добавить forward migration, canonical services/API,
idempotent order/payment flow и reconciliation с обновлением current-schema
snapshot/docs.

**Later:** типизированная Lesson Component → Product ссылка через общий
component registry и Course Builder services/MCP adapter, а также реальная
доставка и внешние commerce integrations. Learner projection получает только
публичные сведения товара и не раскрывает teacher-private content.

Definition of Done текущего demo:

- guest `/store` fail-closed следует действующему login flow, Account видит
  четвёртый nav item и active state;
- category tabs, поиск, custom product sort и крупный/компактный виды используют
  один детерминированный набор; отдельной filter-кнопки и таблицы нет;
- все 19 masters имеют `1254 × 1254`, а Store card/detail получают responsive
  `/_next/image` width по `sizes`; swipe/обе fade-стрелки изменяют только
  текущую галерею;
- tap/click фото, title или non-control card area открывает detail, но arrow и
  cart controls его не открывают; thumbnails/description/price/add/buy-now и
  close/focus return работают, buy-now не дублирует уже добавленный товар и
  открывает delivery без второго dialog;
- category/audience pills остаются в обеих плотностях; нижние tag-pills,
  availability, stock gating, card `ShoppingBag` и footer divider отсутствуют;
  View Transition имеет reduced-motion/unsupported fallback;
- cart quantity/subtotal и checkout validation работают с клавиатуры и на
  mobile без page-level overflow;
- UI не запрашивает банковские реквизиты, не выполняет order/payment request и
  честно завершает сценарий сообщением «заказ не создан»;
- reload сбрасывает cart/form; API, schema, Storage и migrations не меняются.

Полный контракт:
[`docs/product/store-demo.md`](./product/store-demo.md).

## P1.1: очные teacher observations (**CURRENT**)

Первый Learning Activity vertical slice использует уже существующий LessonRun и
roster, не ожидая детского learner runtime. LA-M1 реализован и доставлен как
additive DB-first production slice: migration применена с `COMMIT`, dependent
source `25d7855831273ff5feea14473c2870b729ac39b3` развёрнут Coolify deployment
`1001`, production postflight завершён:

- scheduled Run сначала явно запускается; до `started_at` observation writes
  запрещены;
- teacher проходит по полному ordered Component list Lesson, не по Slides;
- structured rating создаётся только после подтверждения короткого общего
  observable criterion; passive Component без критерия остаётся навигацией;
- для каждого learner доступны быстрые состояния `самостоятельно / с помощью /
пока не получилось / не наблюдал`;
- bulk «все самостоятельно» создаёт draft; teacher меняет exceptions и явно
  подтверждает остальных действительно наблюдавшихся learners;
- observations хранятся отдельным типизированным contract рядом с
  LearningRecord, а не внутри него;
- compact component position/label/type/criterion-at-time сохраняет понятную
  историю без полного Lesson/Component snapshot;
- completed observations read-only и recorder-scoped;
- teacher-owned Lesson/Course/Learner history показывает observations
  отдельно от learner/observer safe projections; private note остаётся
  teacher-only;
- completion требует явно исправить absent learner с observation и не
  выводит attendance, repeat или report из rating;
- этот срез ещё не объявляет component-level отметку mastery.

Полный LA-M1 scope и DoD:
[`docs/plans/learning-activity-system-implementation.md`](./plans/learning-activity-system-implementation.md).

## P1.2: Course objectives и activity foundation (**CURRENT**)

Source/schema vertical slice и production DB/web rollout завершены: verified
backup, два exact `COMMIT`, read-only DB/PostgREST postflight, normal
fast-forward source `014aee43bb82aa2ce486fe8e8f9d60ddc58c87c0`, Coolify deployment `1003` и
deployed-SHA HTTP/API/CSRF/browser guest smoke подтверждены:

- плоские Course-scoped Learning Objectives;
- одна optional primary objective на Component;
- simple manual create/select/archive UX в Component editor;
- optional `activityFacet` в существующем registry, без второго каталога;
- разделение author/evaluator payload и learner-safe delivery contract;
- новые teacher observations получают objective context;
- старые component-only observations остаются историей и автоматически не
  переосмысливаются.

Current production обеспечивает:

- owner-scoped objective API/RPC/RLS, cross-Course denial и запрет нового
  назначения archived objective при сохранении существующих alignment/history;
- только поддерживаемые registry roles `practice | assessment | survey`;
- единый application-service path для manual editor, AI и development MCP;
- publication snapshot V2 с objective definitions и deterministic ID remap,
  сохраняя exact immutable/readable/copyable V1 revisions;
- nullable live objective relation и stable objective UUID/title-at-time у
  новых observations без backfill старых строк;
- pure evidence-eligibility projection с reason codes для objective,
  observable criterion, teacher confirmation и independence/support. Она не
  создаёт durable evidence или objective state.

Applied production migrations:
`20260820085049_learning_objectives_component_alignment.sql` и
`20260820090529_course_publication_snapshot_v2.sql`. Production DB postflight
подтвердил unchanged canonical counts, legacy V1 bytes/checksum,
RLS/ACL/RPC/FK/trigger/lock-order, publication V2 и PostgREST visibility без
production fixtures. Exact local strict production-mode browser suite прошёл
`30/30`, в том числе LA-M2 scenario `#29`. Authenticated production no-write
editor smoke не был выполнен из-за отсутствия authenticated browser session и
не подменяется guest smoke.

Rebuildable objective state и прозрачные recommendations уже входят в current
production DB/source/web LA-M3 после objective alignment; один score,
completion или eligible observation не считается mastery.

## P1.2A: учебный профиль, evidence и рекомендации (**CURRENT PRODUCTION**)

Deployed functional source реализует один manual-first vertical slice поверх
LA-M1/LA-M2:

- finalized Course → Lesson → LessonRun → observation history остаётся source of
  truth; correction создаёт explicit superseding chain, а не переписывает
  исходную запись;
- только finalized, present, objective-aligned, confirmed и active observation
  материализует typed evidence; старые LA-M1 строки с `NULL` objective остаются
  history-only;
- `objective-state-v1` различает `no_data | forming | confirmed |
recheck_due`, требует две independent opportunities из разных stable Runs и
  использует прозрачную 90-day freshness boundary без процентов/весов;
- persisted state существует только при evidence. `no_data` синтезируется в
  projection, имеет nullable state ID/last-evidence, пустой evidence list и не
  получает recommendation или override action;
- `recommendation-rules-v1` даёт объяснимый следующий шаг, а teacher может
  явно replace/dismiss/clear override без изменения authored Component/Slide
  order;
- recorder получает teacher projection; subject и active observer — отдельный
  strict safe DTO с opaque references; private note/override reason, Account IDs
  и evaluator/policy payloads не выдаются;
- manual `/profile`, `/students` learner dialog и observing surface не зависят
  от AI; AI boundary остаётся bounded, а server-side logical read может только
  детерминированно refresh-ить derived projection и писать audit без
  model-controlled/direct mutation action.

Frozen migration SHA-256
`a7e7dad7db4632f98cf0857597dae99b58cf653bd39ec57d0eb91f540c9793f8`
(`5335` строк) прошла exact `COMMIT` на production-derived PostgreSQL `15.8`
clone, `85` functional assertions, `11/11` LA races и identity
functional/concurrency. После verified production backup owner apply завершился
наблюдаемым `COMMIT`; canonical tuple `19/6/22/84/2/2/0/0`, publication
`1/9056/2832fcf2ee1a4c3ccdf01501fc4f60f3` и пустые LA-M3 relations `0/0/0/0`
не изменились; обе source LearningRecord сохранили empty
correction/supersession metadata. RLS `4/4`, `4` policies,
ACL/RPC/security, `0` identity violations и PostgREST denial/resolution probes
прошли. LA-M3 production-head PostgreSQL `15.8` snapshot на момент rollout имел SHA-256
`a1768f22f829d58c01a5846b68cdb7be60a363ebb771869ed90fb83dd316cbc2`,
`29533` строки, `66` public tables и `235` functions.

Functional task commit `6e3f97c230f688663abaa06a126a56d0d0e2c9c6` прошёл
`893/893` unit/API, `30/30` strict browser, typecheck, lint и build `73/73`,
затем доставлен normal fast-forward push `main` из `3582dc8`. Coolify deployment
`1005` (`bgw36mvk1fz6opacg080drx2`) завершился `finished` с exact image/
`SOURCE_COMMIT`, running container и restart count `0`. Production
HTTP/API/CSRF/host guest postflight прошёл; authenticated production no-write
LA-M3 smoke не выполнен из-за guest-only browser session и не заявляется.
Последующий execution-record docs commit runtime не меняет. LA-M4 и LA-M5
имеют статус **CURRENT PRODUCTION DB/SOURCE/WEB**; LA-M6 остаётся **NEXT**.

## P1.3: persisted Homework authoring (**CURRENT production DB/source/web**)

Production DB уже содержит отдельный owner-only Lesson-owned contract после
base migration и обязательного forward-only direct-RPC validation repair.
Current deployed UI остаётся заглушкой до exact source push, web deploy и
postflight; эти evidence пока не заявляются.

- отдельные `lesson_homework` mutable aggregate и ordered
  `lesson_homework_item`; максимум один aggregate на Lesson;
- reuse единственного registry с узким schema V1 allowlist из четырёх типов:
  `rich_text`, `image`, `external_link`, `file`;
- owner-only `GET/PUT/DELETE /api/v2/lessons/[lessonId]/homework` поверх
  authenticated `get_my_lesson_homework`/`replace_my_lesson_homework` RPC;
- atomic full-list replace с compare-and-swap по `expectedRevision` и
  deterministic order из array ordinal;
- clear удаляет items, но сохраняет пустой aggregate и повышает revision,
  поэтому stale client не проходит ABA; preview остаётся read-only;
- архивный Course сохраняет Homework, но read/mutation fail closed; delete
  Lesson берёт lock в canonical order и каскадно удаляет aggregate/items;
- Homework не смешивается с `lesson.components`, Student Screen Slides или
  LessonRun и не создаёт learner data.

Learner assignment/projection, immutable issuance, due date, individual
override, answers/attempts, review, `free_response`, evidence/profile updates и
notifications не входят в P1.3. Это LA-M6 **NEXT**; mutable
`lesson_component` не исполняется как выданная домашняя работа.

## P1.4: Sources и parsing/RAG

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
LearnerProfile-scoped Course/live authority current production в DB/source/web
LA-M4. Она не входит в P0.Identity: отдельный explicit Course enrollment и
отдельная per-Run execution capability обязательны одновременно. Наличие linked profile,
Course audience/Run roster,
`teacher_learner`, observer grant или AI consent ни одну capability не создаёт;
Course audience/groups не являются prerequisite для explicit grant.
Current Account-scoped self-learning educator Course — отдельный уже
реализованный flow и не выдаёт доступ к детскому Course.

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

**Current presentation boundary:** Schedule day/week/month, table/card views,
current product surfaces and learner-safe real-record progress are already
implemented. Superseded visual specifications and rollout hashes belong to Git
history and the deployment runbook, not to the forward roadmap.

**Current production DB/source/web — LA-M4 live:**

Exact production migration `20260821093000_lesson_run_live_delivery.sql`
(`2535` строк, SHA-256
`7fb531bc199b8d6a24afeb1e01ff2730c8e5388a0cbbd233e2679d8e7825319c`)
применена owner с наблюдаемым `COMMIT` после production-derived PostgreSQL
`15.8` clone gate и verified backup. Postflight сохранил canonical/publication
tuples, подтвердил закрытый RLS/ACL contract и пустые LA-M4 relations `0/0/0`.
Snapshot `2026-08-21T07:56:01Z` содержит `69` public tables, `248` functions,
`31440` строк и SHA-256
`15d4a432edf4737c189ab444699b15482c7dbb90b85eab4e1b6043f843b79f52`;
его public body exact совпадает с clean clone/replay. Final-tree pre-rollout
gate прошёл typecheck, lint с `0` warnings/errors, `936/936` unit/API, build
`73/73` и `31/31` strict production-mode Chromium teacher/authorized learner/
outsider scenarios. Prettier по восьми LA-M4 Markdown-файлам и full-worktree
`git diff --check` прошли. Independent final app/security audit не нашёл
P0/P1/P2/blockers, secret/leak или generated-artifact findings.

Functional commit `e09631d2fa00ad1c4b91ad0584392efb748cf235` доставлен
normal fast-forward push `9db3a1f..e09631d main -> main`; Coolify deployment
`1007` (`flg9786e15llusgj6kgz7pwk`) завершился `finished` с exact
image/`SOURCE_COMMIT`, running container и restart count `0`. External и
in-container guest/host/Origin/CSRF postflight прошёл, production DB contract
после cleanup остался exact, backup повторно verified. Безопасной existing
authenticated production session/Run не было: такой UI smoke **NOT RUN**, а
локальный strict Chromium `31/31` не выдаётся за authenticated production
evidence. Disposable DB/container/local LA-M4 temp counts равны `0`.

- explicit Course enrollment и отдельная per-Run execution capability дают
  authority только canonical profile текущего authenticated Account; browser не
  выбирает Account/profile UUID;
- grant требует active linked Account и exact frozen Run roster row, но не
  требует Course audience/group membership;
- capabilities выдаются teacher только active linked roster member и
  проверяются на каждом learner read вместе с live `auth.sessions` и Account
  session cutoff; explicit revoke/archive/merge/erasure/session
  invalidation прекращают доступ fail closed;
- смена Course owner блокируется, пока прежний owner не отозвал все active
  enrollments;
- Run допускается только после actual start и до completion/cancel; scheduled
  Run ничего не показывает. Course-only grant до start сохраняет revoked
  exact-Run tombstone без learner authority; первый actual start создаёт
  waiting state и активирует tombstone либо materialize-ит active exact-Run
  capabilities из active Course enrollments frozen roster. Уже started до
  migration Run требует explicit teacher enable;
- основной persisted cursor указывает на stable Student Screen Slide identity и
  не создаёт authored Step. `NULL` — waiting; update использует CAS revision,
  stale writer не откатывает более новый cursor;
- deletion выбранного Slide переводит cursor в waiting с новой revision,
  reorder использует ту же identity и current canonical positions, empty или
  invalid Slide fail closed;
- teacher управляет learner screen, а learner reload/reconnect и bounded
  polling читают persisted state; свободной learner navigation нет;
- registry serializer отдаёт только текущий Slide и его `learner_visible`
  Components. `staff_only`, другие Slides, teacher summary/comments, answer
  keys/evaluator config, objective/activity metadata, private IDs и raw unsafe
  JSON отсутствуют;
- presentation cursor отделён от response/evaluation state и compact
  `LearningRecord`; LA-M4 не добавляет attempts, scoring, Homework или
  `free_response`.

### LA-M5: первый full online `choice_quiz` (**CURRENT PRODUCTION DB/SOURCE/WEB**)

Frozen vertical slice полностью выпущен: physical contract применён к
production DB и отражён в generated snapshot, а application/API/UI доставлены
release commit `b8f62a635ad3bd77933e71decffe2a5616de26d5` в `main` и
`origin/main`.

Exact migration `20260821100000_choice_quiz_activity.sql` имеет `6372` строки,
SHA-256
`32e860c8d56e299a19c7a5a4d05103df008935ff9814c6d6c206c39f68242d44` и
завершила production owner apply видимым `COMMIT` вскоре после
`2026-08-21T15:34Z`. Verified backup
`/root/shidao-db-backups/shidao-before-choice-quiz-20260821T153411Z.dump`
имеет size `1804381`, mode `600`, `1985` restore-list entries и SHA-256
`bb4dcc56b379f5ef2f105478f426a2e05eb5e17100c08c0656967c3acf855211`.
Post-apply inventory — `74` public tables / `275` functions, включая `5` новых
закрытых Choice Quiz relations.

Snapshot сгенерирован `2026-08-21T15:43:37Z`: `35466` строк, SHA-256
`acd73762c061de56a4ae39ec81c25c0b2ce243d2000f04f877e952e2df67473e`,
timestamp-normalized SHA-256
`063ca4be6c0f76f9c2b95133763d39acfe932b5de84e64fd8c37942678333b44`.
Final local application gate прошёл `991/991` unit/API, production build
`73/73` и `31/31` strict production-mode Chromium scenarios.

Current production application доставляет:

- immutable issued learner definition и opaque learner reference поверх exact
  current Component revision;
- strict idempotent submit, exact-set server evaluation, append-only Attempt/
  Response/Evaluation и отдельный Feedback Delivery audit;
- practice `maxAttempts=3` с retry только после неверных попыток 1/2 и reveal
  после correct/exhausted; assessment `maxAttempts=1` без reveal/retry; hints
  честно выключены (`hintAvailable=false`, `hintCount=0`);
- exact-source online LearningEvidence с policy v2 и deterministic profile
  rebuild без записи raw responses/scores в `LearningRecord`;
- learner-safe accessible live UI с persisted reload и сохранением selection/
  idempotency key при transient error; roleless и все другие activity types
  остаются LA-M4 presentation-only;
- teacher-only compact Run history с learner/question/attempt/correctness/
  score/support/reveal и correction chain; teacher panel содержит явное
  исправление с обязательной причиной, stable idempotency retry и reload
  append-only audit chain;
- canonical manual editor и AI planner/provider/preview/explicit Apply только
  для `choice_quiz`; preview не создаёт issue/attempt/evidence.
- Course AI activity context использует exact server-decoded Supabase session
  и service-only трёхаргументный RPC; прежний двухаргументный overload в
  rolling deploy только fail closed и не возвращает learner projection.

Application gate прошёл `991/991` unit/API, `31/31` strict Chromium, build
`73/73`, typecheck/lint/format/diff-check green. Основной Coolify deployment —
`1009` (`cpeh1gokla9hpng8z57woj96`). После исправления отсутствующего
`www.shidao.ru` в Coolify Domains выполнен config redeploy `1010`
(`m7depyulpqt0ka943ewajt10`). Final container
`g9x4d9zn60jv35r7zf0xl6xj-162236082905` running с restart count `0`, exact
`SOURCE_COMMIT` и image ID
`sha256:1458de67a667584f4863ad712ed25d64bb59ede12faba9f52959fe4424ce9045`;
проверенные логи и external/container-local host/API/CSRF/guest probes green.
`www.shidao.ru` имеет valid TLS и отвечает `302` на
`https://shidao.ru/login`. Disposable clone/temp files удалены, production
backups сохранены.

Authenticated production teacher/learner lifecycle **NOT RUN**: safe existing
session/Run отсутствовали, credentials и fixtures ради smoke не создавались.
Это не failure и не blocker; local Chromium не подменяет authenticated
production evidence. P1.3 rollout завершён; **NEXT** идёт отдельный LA-M6
immutable Homework issuance/review
и `free_response`.

**Later transport поверх current LA-M5:** Realtime/presence может заменить
polling, не меняя authorization/cursor contract и не создавая content-bearing
`LessonSession`.

## P3: online activities, adaptive learning и product scale

- следующим выполнить отдельный LA-M6 immutable Homework
  issuance/review и `free_response`; не смешивать его state machine с current
  LA-M5;
- затем shared deterministic engine для fill/matching/sequence/categorize;
- history остаётся source of truth, а objective state — rebuildable projection
  рядом с compact LearningRecord, не внутри него;
- transparent rules и spaced review предшествуют statistical models;
- reference audio, learner recording, teacher rubric и только затем
  specialized pronunciation assessment;
- communication follow-ups поверх current-source direct/Course/system/AI
  baseline: Realtime/presence, push/email, attachments, moderation и reliable
  background notification/AI workers;
- общий catalog moderation UI за пределами educator review, ratings и
  контролируемый importer repository archive;
- AI change sets, undo, durable hard quotas и billing;
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
