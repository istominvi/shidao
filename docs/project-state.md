# Текущее состояние ShiDao V2

**Статус:** главный входной документ для разработки
**Актуально на:** 17 августа 2026 года
**Активная ветка:** `main`
**Рабочее приложение:** `https://v2.shidao.ru`
**Initial Communication Center functional application source:**
`2efaa86851fffc7e444af904fb900d9984caa6a8`
(`704/704` unit/API, `27/27` strict production-mode browser scenarios,
typecheck, lint, repository-wide format check и production build)
**Exact matching-container Profile/avatar rollout:**
`4462da2248dd97bf6ab5c0a35f9a781844473874`
**Исторический functional E2 baseline:**
`22b486a7163453019d9720cb4fe0f36ed7c0228d`

**Current production — единый центр «Сообщения»:** protected
`(app)` layout теперь монтирует одну глобальную кнопку с общим unread badge
вместо отдельных AI-launcher, колокольчика и пункта навигации. Она открывает
единый inbox с четырьмя явно маркированными источниками: direct-диалоги,
Course chat, read-only лента **ShiDao · Система** и несколько persisted
диалогов с видимой маркировкой **ИИ** и global/Course/Lesson context. Contextual actions
«Написать» в Students и «Чат курса» открывают тот же центр сразу на нужном
диалоге; отдельного параллельного messaging flow нет. Desktop panel использует
один узкий режим: inbox и выбранный диалог сменяют друг друга внутри
той же поверхности. Mobile использует полноэкранную поверхность. Текущая
panel полностью непрозрачна и белая: header и composer отделены full-bleed
линиями без боковых зазоров. Угол, из которого визуально исходит реплика, имеет
радиус `1 px`: нижний левый у входящего и нижний правый у исходящего сообщения;
остальные углы остаются скруглёнными. На fine pointer время сохраняет место под сообщением, но скрыто
до hover/focus и проявляется за `250 ms`; на touch/coarse pointer оно всегда
видимо, а reduced-motion убирает transition. ShiDao system
source имеет чёрный avatar с белой `S`, а ИИ — чёрный avatar с белой
Sparkles icon. Постоянные system/AI callout-плашки удалены: пояснение system
feed открывается через маленькую нейтральную `?` рядом с ShiDao, а пустой AI
dialogue сразу показывает контекстный набор фактически доступных prompt chips
без второй центральной иконки.

Persisted ответы ИИ и тела system events теперь отображают безопасное
подмножество CommonMark, поэтому `**акцент**`, абзацы, списки, цитаты и code
render семантически, а не как видимые служебные маркеры. Raw HTML полностью
игнорируется; изображения и model-authored links не активируются. System title,
AI user turns и direct/Course human messages сохраняют literal plain-text
рендер. Это UI-only изменение: формат persisted body, API и physical schema не
изменялись, поэтому уже сохранённые ответы также получают форматирование.

Direct target задаётся только через `LearnerProfile` и требует active accepted
teacher/learner relation с linked Account; archived/pending relation запрещает
новое чтение и отправку, но restore возвращает доступ к полной истории.
Course owner и linked Account текущей effective audience видят всю историю
Course thread, в том числе сообщения до присоединения; выход из current
audience сразу закрывает capability. Browser не передаёт Account/Auth UUID или
sender ID. Каждое human message отправляется только явным действием в composer:
ИИ не может автоматически написать ученику или в Course chat.

AI conversations, turns и read cursors persisted. Один turn выполняется как
единый server-orchestrated exchange: user turn сохраняется, bounded history
и allowlisted context читаются server-side, существующий Assistant формирует
ответ/proposal, затем trusted boundary сохраняет assistant turn. Existing
signed proposal/apply semantics сохранены. В частности,
`lesson.schedule_run` показывает карточку «Назначить урок» или «Перенести
урок» и меняет LessonRun только после отдельного подтверждения пользователя.
Apply использует production-current A2 RPC
`schedule_lesson_run_if_unchanged`: create атомарно проверяет отсутствие open
Run и exact current Course audience, reschedule — exact Run id/`updated_at` и
draft roster; mismatch возвращает stale action до canonical scheduler write.
Account/Auth UUID в browser action contract не входят.
Все proposal, загруженные из persisted history после hydration, fail closed как
устаревшие; actionable может быть только карточка, полученная в текущем mounted
exchange. Durable action/job ledger, distributed exactly-once и background AI
worker остаются **later**.

В footer AI-диалога raw token count заменён full-width progress track высотой
`4 px`: тёмно-зелёная часть показывает оставшуюся долю тестового месячного
объёма `2 000 000` токенов на Account. Server вычисляет использование текущего
календарного месяца UTC из валидных persisted assistant-reply payloads во всех
owner-scoped сохранённых диалогах, включая архивные, в пределах текущего
bounded contract до `50` диалогов; чтение и пагинация turns идут через уже
существующие authenticated user-JWT RPC. Это информационный тестовый meter, а
не hard quota: он не резервирует объём перед provider call, не выполняет
settlement конкурентных запросов, не блокирует composer и не является balance
или billing enforcement. Отдельное quota-read не блокирует turns или POST
exchange; при его временной ошибке UI скрывает только meter. Новая migration,
таблица или physical schema для него не добавлялись; durable usage ledger с
reservation/settlement остаётся **later**.

Unified inbox обновляется bounded polling раз в 30 секунд и при возврате focus;
read cursor выбранного диалога учитывает `visibilitychange`. Realtime,
presence, push/email, attachments, richer metric producers и generalized
background notifications в первый production slice не входят. Production DB
CC1 + A2 применены, DB postflight и contract snapshot current. Dependent
web/API initial rollout развёрнут exact source
`2efaa86851fffc7e444af904fb900d9984caa6a8`: Coolify deployment
`otekp2zseg5ig2r05v6taabu` завершён `finished`; initial functional rollout container
`g9x4d9zn60jv35r7zf0xl6xj-075303148584` использует matching image и
`SOURCE_COMMIT`, restart count `0`. HTTP postflight подтвердил V2 login/robots,
guest redirect, новые unauthenticated inbox/assistant boundaries, landing-only
изоляцию и exact Origin CSRF boundary.

Current application query boundary нормализует полностью отсутствующие
параметры всех communication GET в canonical defaults до repository/RPC.
Поэтому первый `GET /api/v2/inbox` без query, а также первые страницы targets,
messages, AI conversations/turns и system notifications не требуют, чтобы
browser явно отправлял `null` и default `limit`. Internal Zod diagnostics не
выводятся пользователю: non-custom validation failure получает локализованное
сообщение. Browser regression проходит реальный parameterless inbox route,
проверяет default RPC args, `200`, empty state и отсутствие `role=alert`.

**Current production — page headers and motion:** supporting
copy в `AppPageHeader` теперь действительно optional и допускает только
метрику выбранной сущности; поясняющий, рекламный и инструктивный текст из
заголовков удалён. Header action rail показывает не больше одной основной
кнопки, а остальные действия Lesson находятся в общем квадратном
`MoreVertical` menu с сохранением destructive, keyboard и focus-return
семантики. Persistent navigation-motion boundary сохраняет направление:
движение `Расписание → Ученики → Курсы → Магазин` и drill-in уводит старый
header влево, обратное движение/backlink — вправо. Асинхронная route navigation
и ожидание RSC/data выполняются вне `document.startViewTransition`; после
commit готового header включается отменяемый CSS entrance. Единственным
допустимым named element для синхронного native update остаётся
`app-page-header`. Чёрный active-pill
primary navigation остаётся одним локальным измеряемым indicator: нажатие
синхронно отправляет route navigation и одновременно перенаправляет его
`width/transform` к выбранному пункту; локальная анимация длится `180 ms`, но
никогда не gate-ит router dispatch. Быстрый следующий primary intent немедленно
supersede-ит предыдущий pre-commit/pending route, сразу перенаправляет тот же
pill и становится единственным актуальным target; stale response больше не
может commit-ить прежний URL. Для pill не используется
отдельный named/native View Transition, поэтому параллельные серый ghost,
второй чёрный слой и snapshot-scale отсутствуют. Один слой glyphs визуально
остаётся строго `#000` вне чёрного pill и `#fff` внутри него без запаздывающей
смены цвета: nav-track задаёт непрозрачный белый isolated backdrop, а nav-list
не создаёт вложенный stacking context, который отрезал бы glyphs от backdrop и
оставлял неактивный текст белым. Handoff и route load не создают блокирующий
overlay: cursor, links, keyboard focus и повторные клики остаются интерактивными.
Асинхронная метрика резервирует строку уже в первом frame. Current source
follow-up сразу показывает известные H1, meta, actions и вкладки, а только
metric мягко проявляется внутри зарезервированной строки `1lh`; bounded observer
ожидает committed header, не блокируется metric/content и игнорирует
superseded intent. Фиксированный
`min-height: 200px` удалён:
высота `AppPageHeader` определяется только фактическим содержимым и padding.
Временные owner/published Course loading cards удалены, error surfaces
сохранены. `prefers-reduced-motion` оставляет все переходы мгновенными. Это
UI-only изменение в `src/components/app/`, `src/components/navigation/`,
`src/components/site-header.tsx`, `src/components/ui/workspace-tabs.tsx` и
`src/app/styles/`; API, schema, migrations и Lesson hierarchy не меняются.
Follow-up source `1d4e5deff83cbdc1b479b16e4220cf799327009f` исправляет контраст
glyphs без изменения геометрии: public production CSS
`/_next/static/css/4bc8e9a9d672cadc.css` содержит opaque-white
`.site-header-nav-track` с `isolation:isolate`, а nav-list не имеет отдельного
`z-index`. Guest `/profile` продолжает fail closed через `307 → /login`.
Это public-bundle/HTTP postflight; он не подменяет matching-container evidence
Profile/avatar release `4462da2`, зафиксированное ниже.

**Current source / next production — TopNav, стабильный backlink rhythm и
title-row alignment:**
на desktop product TopNav остаётся в normal document flow, не использует
`position: sticky` или `fixed` и уходит за верхнюю границу вместе с остальным
контентом при scroll. Белый shell имеет внешнюю высоту ровно `64 px`. Его общий
внутренний container-row с brand, navigation и actions/avatar имеет exact
высоту `40 px`, вертикально центрирован с `12 px` сверху и снизу и задаёт всем
трём зонам одну centerline; nav/action wrappers не увеличивают высоту ряда.
Неактивный пункт главной навигации на hover получает exact
5%-black background `rgba(0, 0, 0, 0.05)` даже после готовности измеряемого
active-pill; выбранный пункт сохраняет чёрный active surface. `AppPageHeader`
всегда резервирует одну backlink-row и её вертикальный rhythm. При отсутствии
`back` строка остаётся пустой и не создаёт фиктивные link, button или текст;
поэтому heading начинается на той же высоте, что и на странице с настоящим
backlink. H1 и правая action-секция `AppPageHeader` образуют одну title-row:
нижняя граница action rail совпадает с нижней границей H1. Зарезервированная
backlink-row остаётся выше только в content-column, а metric/meta находятся
ниже title-row; эти строки не участвуют в вертикальном выравнивании actions.
При реальной нехватке ширины intrinsic action rail переносится в отдельный ряд.
На mobile до `767 px` тот же TopNav становится `position: sticky; top: 0`:
бежевый внешний слой учитывает safe-area и сохраняет по `12 px` от краёв
viewport, а белый shell остаётся `64 px` и содержит увеличенный `48 px` ряд.
Этот UI-only source contract supersede-ит deployed `68 px`/sticky геометрию
только для desktop, условную backlink-row и центрирование actions по всей
высоте header; API, schema, migrations и Lesson hierarchy не меняются.

**Current source / next production — instant primary-section chrome:**
protected Account shell заранее выполняет full RSC prefetch пяти главных
маршрутов `/schedule`, `/students`, `/courses`, `/store` и `/profile` и в том
же persistent boundary прогревает компактные header summaries. Известные
`title`, `meta`, actions и вкладки не зависят от metric или page-content;
поздний summary не меняет высоту и не сдвигает H1/actions. Account-scoped
summary хранится только в памяти текущей app session, дедуплицирует
параллельный warmup, использует bounded TTL со stale-while-revalidate и
очищается при смене или завершении session. Schedule и Students считаются
лёгкими RLS-backed `HEAD`/`count=exact` проекциями без гидратации полных
LessonRun и directory rows. Он ускоряет повторный вход в раздел, но не
подменяет page-content: Schedule, Students, Courses и Profile продолжают
независимо читать актуальный content через свои `no-store` loaders; mutations
Schedule, Students, Profile и LessonRun schedule/reschedule/cancel/complete из
Course обновляют summary.
Store metric остаётся
синхронной производной статического demo-каталога и локальной корзины; честная
отсутствующая metric Courses не изобретается ради заполнения строки. Это
application-only contract: database schema, migrations, Storage, Auth и Lesson
hierarchy не меняются.

**Current source / next production — compact toolbar controls:** Course и
Store больше не показывают disclosure-кнопку «Фильтры» и не сохраняют скрытое
advanced-filter state. В owned Course остаются поиск, table-header sorting и
переключатель вида; published catalog сохраняет поиск, направление обучения,
cursor и вид. Его server-side `subject`/`level`/facet contract не удаляется,
но текущий web UI эти параметры больше не отправляет. Store сохраняет category
tabs, поиск, сортировку и виды; audience/price/availability filter menu и его
client predicates удалены. Сортировка Store открывает не системный macOS
`select`, а канонический product dropdown без focus halo на trigger. Category
tabs и сортировка применяются сразу и не создают toolbar-кнопку сброса;
toolbar-action «Очистить поиск» появляется только при непустом запросе и не
меняет выбранные category, sort или view.

В `/students` прежний disclosure с status, Account и конкретной группой
заменён видимым inline `SegmentedControl` **Все / В группе / Без группы**.
Membership narrowing относится только к active teacher relations; режим
«Все» по-прежнему оставляет в общем справочнике archived relations и pending
requests с их restore/cancel actions. Поиск, sortable table headers и
**Таблица / Карточки** не меняются. Membership toggle обновляет projection
сразу и не создаёт toolbar reset-action; «Очистить поиск» зависит только от текста и
не возвращает toggle в «Все». Canonical text/search inputs сохраняют
2 px focus halo, но он начинается сразу за control border (`outline-offset:
0`); product dropdown triggers, включая Store sort, этот halo не получают.
Schedule date navigator использует тот же product border, clipped white
background, radius и base shadow, что остальные статичные controls, без
прежней inset-рамки и отдельной двухслойной тени. Calendar panel продолжает
использовать universal dropdown surface. Slice UI-only: API authorization,
schema, migrations, Lesson hierarchy и learner identity relations не меняются.

**Current source / next production — mobile responsive polish:** общий
`AppPageHeader` ниже `1280 px` использует content-aware wrapping row: короткие
title/metric и intrinsic action остаются в одной строке, action прижат к правому
краю, а при реальной нехватке места безопасно переносится вниз. Общий
`WorkspaceTabs` сохраняет touch/swipe и `overflow-x: auto`, но скрывает native
scrollbar во всех браузерах; доступное продолжение обозначают fade и отдельные
chevron-кнопки с прокруткой (`40 px` desktop, `48 px` mobile), direction-aware
состоянием и возвратом фокуса. Product shell клипует только transient
document-level horizontal overflow route entrance, не внутренние scroll
containers. В protected mobile
header вместо аватара показан burger; он открывает единственный navigation
dropdown в Account chrome с именем, допустимым email и ровно «Расписание /
Ученики / Курсы / Магазин / Профиль». На protected desktop и authenticated
landing выбранный avatar остаётся видимым, но является прямой ссылкой на
`/profile`; прежний Account/avatar dropdown удалён. Изменение UI-only в
`src/components/app/page-header.tsx`, `src/components/ui/workspace-tabs.tsx`,
`src/components/session-nav-actions.tsx` и соответствующих styles/tests; API,
session projection, schema, migrations и Lesson hierarchy не меняются.

Follow-up превращает этот responsive слой из уменьшенной desktop-проекции в
touch-first application layout. App `theme-color`, manifest, `html`, `body` и
`.course-demo-shell` используют один непрозрачный `#f5f1e8`; app viewport
включает `viewport-fit=cover`, shell покрывает минимум `100dvh`, а safe-area
insets защищают верхнюю навигацию и нижний край. Поэтому iOS Safari окрашивает
browser chrome и elastic overscroll в цвет приложения без отключения нативного
bounce. Текущий source refinement делает скруглённый mobile TopNav полностью
непрозрачным белым surface без background image/blur, увеличивает wordmark до
`26 px` и оставляет закрытый burger на чистом белом фоне без залипающего
touch-hover/focus halo. Mobile burger имеет target `48 × 48 px` и icon `24 px`;
открытый panel занимает ширину viewport с inset `12 px`, gap `12 px`, радиусом
`16 px`, показывает `48 px` Account avatar, отделяет одинаково отцентрованный
profile header full-bleed светлым divider и использует строки `68 px`, текст
`20 px` и иконки `24 px`. Pointer-open не переводит фокус на первый пункт;
keyboard-open, стрелки, Home/End, Escape, outside-click и focus-return остаются
полностью доступны с компактным inset focus indicator вместо внешнего halo.

На ширине до `767 px` и при любом coarse/touch pointer Course toolbars, search,
основные actions и tabs получают touch target не меньше `48 px`; compound
segmented controls имеют общую внешнюю высоту `48 px` и внутренние options
`44 px`, подписи `16 px` и glyphs `20 px`, поэтому они совпадают по масштабу с
соседними controls, в том числе в landscape на iPhone. Все редактируемые app
`input` / `select` / `textarea`
вычисляются не меньше `16 px`, чтобы iOS не увеличивал страницу при focus;
pinch zoom при этом не запрещается через viewport. Global launcher
«Сообщения» в том же narrow/coarse contract увеличен до `56 × 56 px` с glyph
не меньше `24 px` и сохраняет safe-area inset; non-fullscreen panel остаётся
ровно на `12 px` выше увеличенного launcher. Desktop Course table/card
переключатель и
исходный table mode сохраняются, но до `767 px` широкая таблица не масштабируется
и не создаёт page-level horizontal scroll: текущая projection отображается
семантическим списком компактных белых карточек с полными Course actions и
метаданными. Выбранный presentation mode, query, API и persisted data не
меняются; это только responsive projection без schema или migration work.

**Current production Course catalog slice:** реализует reusable Course catalog,
immutable publication revisions, независимое копирование детских Course и
private publication assets. Forward migration применена и проверена; Coolify
deployment `891` развернул exact functional SHA
`9a553085487c8fd514cc716f5beec5eab3324af3`.

**Current production E1 vertical slice:** migration
`20260812113000_educator_course_attestations.sql` применена owner
`supabase_admin` с `COMMIT` в `2026-08-12T02:35:45Z`; rollback, RLS/ACL и
functional scoring probes прошли. Live snapshot `2026-08-12T02:53:14Z` имеет
SHA-256
`d96a357a8b55caa80a831b37b7e289c17025c572d79483d28ae7515b30bcf9e2`.
Dependent web deployed from exact functional commit
`28387a9863afeccf4a6ad332dcf0f01048a69e67`; release postflight подтвердил
exact `SOURCE_COMMIT`/image, restart count `0` и live host/CSRF/API boundaries.
Gates: typecheck, lint, format, build, unit `522/522`, strict browser
`22/22`. Production bootstrap завершился `COMMIT` в
`2026-08-12T03:10:45Z`; итоговый read-only DB/RPC postflight подтвердил один
educator Course, реальный passed result `9/10 = 90%` и одну profile
credential.

**Current production E1 incident hotfix:** authenticated
production диагностика подтвердила, что catalog RPC возвращает один educator Course, а
profile RPC — одну credential с `certified=true`; сеть и E1 database contract
исправны. Ошибки каталога и вкладки «Аттестация» возникали в application
projection: допустимые PostgreSQL UUID, полученные bootstrap через
`md5(...)::uuid`, отклонялись RFC-strict проверкой `z.uuid`. Current production
переводит publication/revision/snapshot IDs на общий PostgreSQL UUID contract
через `z.guid`, добавляет regression coverage, сбрасывает masked error state
при переключении направления каталога и ставит audience toggle в одну
toolbar-строку с поиском, фильтрами и выбором вида. Release gate: typecheck,
lint, format, build, unit `527/527`, strict production-mode browser `22/22` с
educator catalog, reload и profile credential. Coolify deployment
`ikw0bj347reelzotaqo15a39` развернул exact functional commit
`22b486a7163453019d9720cb4fe0f36ed7c0228d`; `SOURCE_COMMIT`, image tag,
restart `0` и HTTP boundaries подтверждены.

**Current production E2 database and web/API:** forward migration
`20260812150745_educator_course_governance_progress.sql` применена с `COMMIT` в
`2026-08-12T07:34:36Z`. Она реализует trusted-author capability, обязательный
admin review exact educator revision, catalog по `approved_revision_id`,
Account-scoped revision progress, server-side `100%` attestation gate и
official no-copy/no-roster/no-LessonRun invariants. Postflight подтвердил
`19` Account, `6` Course, одну publication/revision/attempt/award, educator
catalog `1` и derived progress `6/6 = 100%`; аттестация осталась `90%` при
пороге `80%`. Historical E2 snapshot снят `2026-08-12T07:46:11Z`, SHA-256
`a34a5a5919ea406050a5c0cb7f39310d1a9e807725e608166f63becb8f2260a4`, `71`
schema-contract tests green. Зависимый E2 web/API source развёрнут из exact
functional baseline `22b486a7163453019d9720cb4fe0f36ed7c0228d`: deployment завершён
`2026-08-12T07:58:39Z`, image ID
`sha256:214e954aed0355c1881ea778e65dcb7f4c4cabcde4d7ac2e3f6022322bd8e027`,
`SOURCE_COMMIT` exact, restart count `0`, HTTP host/CSRF/auth postflight green.

**Current production authenticated authoring ACL hotfix:** E2 оставил
`guard_educator_course_content_mutation()` в режиме `SECURITY INVOKER`, но
внутри guard вызывал закрытый
`educator_course_author_can_mutate(uuid)`. Поэтому разрешённый RLS/ACL
authenticated write к Component или другой дочерней Course content table
останавливался до проверки audience/capability с PostgreSQL `42501`:
`permission denied for function educator_course_author_can_mutate`. Forward
migration `20260813113041_fix_educator_course_content_guard_acl.sql` применена
production с `COMMIT`: guard остаётся invoker-функцией, тот же predicate
встроен непосредственно в trigger, а helper не открыт для
`authenticated`/`anon`. Migration checksum —
`f159188b067bb8a8a6bfe837a3d366a68ab40e42876a79db88dd54d1f01b322f`;
rollback rehearsal дошла до `NOTIFY` и завершилась `ROLLBACK`. Verified backup
имеет size `1324276`, mode `600`, `1595` restore entries и SHA-256
`0b3a6c2d9d5100d721ccd1988a8494a4719e9323f2b13838abfc5011148ae6a7`.
Postflight `12/12` подтвердил owner/invoker/search-path, closed ACL, inline
predicate, семь triggers и отсутствие policy drift; counts
Account/Course/Lesson/Component остались `19/6/22/85`. Authenticated educator
`rich_text` same-value `UPDATE` прошёл внутри rollback
(`rollback_verified=true`). Historical E2A snapshot снят
`2026-08-13T11:43:48Z`, SHA-256
`0a6eab37e1bbecc0084e281496346e5436fcbd1ac2b42e102e89951e71ff258e`.
Это DB-only исправление уже действует для существующего web image; отдельный
Coolify deployment не требовался.

**Current production contract stage:** реализована и развёрнута полная roleless
learner identity / observer программа. Migrations M1–M6 применены к production
после четырёх проверенных backup и добавили atomic exactly-one
Account/Profile bootstrap, Account login/PIN
boundary, safe discovery/recipient-bound claim и child activation, physical
merge/lineage, archive/restore, self/observer history/progress, subject erasure
и consented cross-provider AI. Application/API/UI находятся в
`src/modules/learner-identity/`, `src/components/learner-identity/` и routes
`/profile`, `/students?tab=observing`,
`/identity/invitations/[invitationId]`; прежние `/learning-profile`,
`/observing` и `/settings/*` сохранены только как protected compatibility
redirects. Security slice также
закрывает production
host allowlist и CSRF до exact `v2.shidao.ru` Origin. Coolify завершил roleless
deployments точных SHA `5944d31f86f7d3795ec9f17928cb311ecbdfdd21` и
`5d650a390abcc944780a716f909248f5493c10a9`. После read-only dependency audit
применена M4 contract cleanup. M5 закрыла deferred exactly-one trigger на
реальном GoTrue commit через owner-only `SECURITY DEFINER`; M6 добавила узкую
same-transaction синхронизацию trusted provisional child metadata без
post-commit downgrade. Strict DB/RLS/ACL/PostgREST postflight и реальный
disposable GoTrue Admin create/delete probe зелёные; production snapshot
SHA-256 —
`584ebb96dc8d96f1eb508e7eae836edb8125a9fefe2a59e9cb362af54bba5a26`.

Coolify deployment `887` завершил exact functional SHA
`01aa88a042ad38d744c6f33a44bc216c91815e59`; running container использует тот
же `SOURCE_COMMIT`, image digest
`sha256:cf8b6400187d880ab6c6f73a9af037b92cb476b09dd4832e6fd52ea13a132389`,
restart count `0`, HTTPS `200`.

**Current production profile navigation:** собственный профиль и Account settings
собраны в одном разделе `/profile` с адресуемыми вкладками `Профиль /
История / Аттестация / Наблюдатели / Настройки`. Account menu повторяет этот
порядок и завершает список действием `Выход`; trigger показывает только
квадратный avatar `40 × 40 px` с радиусом `12 px`, а dropdown header — ФИО и
email без второй avatar. Заголовок раздела использует ФИО Account, метрику
активной вкладки и действие `Выход`. Метрика `Профиль` показывает завершённые
занятия и предметы, `История` — записи и посещённые занятия, `Аттестация` —
число credentials, `Наблюдатели` — active observers и pending исходящие
приглашения, `Настройки` — состояние PIN. `Наблюдатели` показывает grants направления
`observed_by` первыми; входящие приглашения наблюдать за другим профилем отделены
ниже. Прежние `/learning-profile`, `/settings`, `/settings/profile`,
`/settings/security` и `/settings/observers` сохранены как compatibility
redirects с переносом query; security redirect сохраняет `#security`. Отдельные вкладки
`Данные` и `Связи и помощник` удалены: teacher connection requests перенесены в
`Профиль`, AI consents и subject-only unlink/erasure — в `Настройки`. UI/API
используют прежние audited identity boundaries; schema и migrations не менялись.
Все пять вкладок используют один profile-surface contract: непрозрачный белый
фон, радиус `20 px`, тонкую product border и одну мягкую тень только у верхнего
уровня. Вложенные строки остаются белыми с тем же радиусом и border, но без
повторной тени. Настройка аватара компактна: текущий avatar и две кнопки;
двадцать presets открываются в modal picker, а локальный файл — в отдельном
preview dialog до явного сохранения.

**Current source / next production navigation refinement:** Account/avatar
dropdown удалён. Avatar в protected desktop header и на authenticated landing
ведёт напрямую в `/profile`; он не открывает список profile tabs или `Выход`.
На protected mobile avatar заменён burger-кнопкой, и только она открывает
navigation dropdown: header содержит Account name и privacy-safe email, а
список ограничен пятью пунктами «Расписание / Ученики / Курсы / Магазин /
Профиль». Это presentation-only изменение без нового session field, API,
schema или migration; production rollout и authenticated postflight ещё
предстоят.

Этот UI/routing slice развёрнут exact release
`4462da2248dd97bf6ab5c0a35f9a781844473874`. Coolify deployment `960`
(`mtsryny7vgiyw6622cc6b77l`) завершён `2026-08-14T08:18:23Z`; running
container `g9x4d9zn60jv35r7zf0xl6xj-081541652045` использует matching image и
`SOURCE_COMMIT`, image ID
`sha256:b7ba6d8a0484e0521456dd33c2c027b1f08306ecd7c4db4e43c7d6066f873b43`,
restart count `0`. Guest `/profile`, `/profile?tab=settings` и legacy
`/learning-profile?tab=settings` fail closed через `307 → /login`; все 20
preset WebP отвечают прямым `200 image/webp` без redirect. Exact deployed
profile chunk содержит `/profile`, «Выбрать аватар» и «Загрузить фото».
Authenticated compatibility redirect отдельно не заявляется из guest
postflight; функциональный contract покрыт strict browser suite `24/24`.

**Current production Account avatar follow-up:** AV1 DB-first contract применён к
production, а avatar теперь является обязательным
состоянием `Account`, а не декоративными initials. В настройках единого профиля
можно выбрать один из 20 оригинальных ShiDao presets либо загрузить JPEG/PNG/
WebP до 5 MiB. Сервер декодирует untrusted input, ограничивает исходник
`4096 × 4096`, применяет orientation и center crop, сохраняет только opaque
`512 × 512` WebP без исходных metadata в private `profile-avatars`. Смена
versioned: server-only upload → optimistic Account pointer switch → проверенный
cleanup прежнего object; у bucket/setter нет browser write policy/EXECUTE, а
commit-unknown сверяется повторным canonical read. Browser SessionView не
получает Storage path или token. Header показывает выбранное изображение
`40 × 40 px`/`12 px`, а при
ошибке загрузки безопасно возвращается к initials. Existing и новые Accounts
получают валидный preset на DB boundary; exact-one state хранится в
`public.account`. Typed manifest и 20 оптимизированных assets находятся в
`src/lib/account-avatar.ts` и `public/avatars/presets/`, визуальный/privacy
контракт — в `docs/product/account-avatars.md`.

**Current source / next production image delivery:** public preset avatars
переведены на built-in `next/image` + существующий Sharp с responsive `sizes`,
quality `75`, explicit local allowlist и общим minimum cache TTL `7d`. Private
custom avatar не проходит через default `/_next/image`: custom loader вызывает
authenticated same-origin route с allowlisted width, exact revision и opaque
domain-separated HMAC delivery key из server SessionView. Route повторно
проверяет Account, revision/key/width до Storage/resize; cacheable exact URL
получает `private, max-age=31536000, immutable`, `Vary: Cookie` и ETag, а
совместимый URL без key остаётся `private, no-store`. Одинаковая numeric
revision у разных Accounts не создаёт общий cache address; SessionView/URL не
раскрывает identity, Storage path или signed token. Initials видимы до load и
при ошибке, reduced-motion отключает fade. Private Course/Lesson signed images
намеренно остаются `unoptimized` до отдельного authenticated derivative slice;
Communication использует initials/Lucide и не получает message attachments.
Общий current/next/later boundary зафиксирован в
[`docs/architecture/image-delivery.md`](./architecture/image-delivery.md).

Navigation/catalog follow-up `bafc984d0bc7bfb6cb795170a09ba2aabfb98441`
упростил primary Account navigation до «Расписание / Ученики / Курсы», перенёс
«Учебный профиль» в Account menu, а observer projection — в третью вкладку
«Наблюдение» внутри `/students`. `/courses` получил поиск по публичным полям,
реальные фильтры по предмету/уровню/наполнению, сортировку и режимы «Плитки /
Таблица». DB/API/schema не менялись. Automated gate прошёл `326/326` unit и
`19/19` production-mode browser scenarios. Coolify deployment `889` завершился
`finished`; image tag и `SOURCE_COMMIT` совпадают с exact SHA, image digest
`sha256:06e273096fcf2f385782aeb6e1552235e1ac516b2a9dfd45f65f6f9a056b02cd`,
restart count `0`. Production `/` и `/login` отвечают `200`, guest `/observing`
fail-closed перенаправляется в `/login`, browser console пуста.

**Current production Store demo:** защищённая Account-страница
`/store` добавляет четвёртый primary nav item «Магазин» с иконкой
`ShoppingBag`. Страница использует общие `AppPageHeader`, `WorkspaceTabs`,
toolbar, cards/table и `DialogShell`: статический каталог учебных товаров можно
искать, фильтровать, сортировать и просматривать в двух режимах; кнопка
«Корзина» находится в header action-секции. Корзина, контактная форма и
последовательность `cart → delivery → payment demo → success` существуют
только в React state. Полей банковской карты, сетевой отправки, записи заказа,
оплаты, доставки, новой API/schema/migration нет; финал явно сообщает, что
заказ не создан. Стабильный в текущем demo-каталоге product slug уже
поддерживает deep link вида
`/store?product=<slug>` без изменения Lesson contracts. Канонический
контракт с current/next/later границами находится в
[`docs/product/store-demo.md`](./product/store-demo.md). Historical Store release gate:
typecheck, lint, format, production build, `581/581` unit/API, `23/23` strict
production-mode browser scenarios и `72/72` schema/migration subset, включая
Store deep link, cart/checkout, focus return и mobile no-overflow.

**Current source / next production Store photo/detail catalog:** девять
статических demo-товаров используют 19 square WebP masters `1254 × 1254`
quality `90` из `public/store/products/<slug>/`: три кадра у прописей и по два
у остальных. Built-in `next/image` + существующий Sharp выдаёт responsive
WebP по explicit local allowlist/`sizes`: quality `75` для card/thumbnail и
`85` для detail, shared minimum cache TTL `7d`; новая dependency не добавлена.
Независимая галерея листается horizontal swipe и общими
`FadeChevronButton`-стрелками с borderless radial fade; dots приглушены и не
имеют shadow. Tap/click фото, title или свободной non-control области теперь
открывает `56rem × 42rem` product `DialogShell` с большой gallery/thumbnails,
полным существующим description, price, «В корзину» и «Оформить сразу».
Buy-now гарантирует quantity `>= 1`, закрывает detail и открывает delivery без
двух dialog одновременно. View Transition расширяет конкретную card и
реверсируется при закрытии; unsupported/reduced-motion получает немедленный
fallback. Deep link сохраняет прежнюю scroll/focus semantics и не открывает
dialog автоматически.

Обе плотности сохраняют category/audience pills, включая compact; нижние
tag-pills, decorative icons/glyphs, availability, stock gating, card
`ShoppingBag`, footer divider и header-chip «Демо · без оплаты» удалены. Card
CTA использует `ShoppingCart`, а checkout/detail честно сохраняют demo
boundary. Сетка остаётся `3/6` desktop, `2/4` tablet и `1/2` mobile.
Изображения — source-controlled UI assets, а не Product/Inventory или Supabase
Storage; API, schema, migrations и Lesson contracts не меняются.

Historical identity-program acceptance на прежнем совместимом production
release подтвердила authenticated browser postflight: roleless navigation и
реальные пустые состояния `/courses`, `/schedule`, `/students`, всех вкладок
`/learning-profile`, `/students?tab=observing`, `/settings/profile`,
`/settings/security` и `/settings/observers`; browser console пуста. CSRF
отклонил cross-subdomain и missing Origin (`403`), same-origin malformed body
дошёл до validation (`400`). Disposable Account после полного dependency audit
удалён поддерживаемым Auth cleanup flow: fixture Auth/Account/Profile counts
`0/0/0`, production counts вернулись к `19/19/20`, exactly-one violations и
trusted provisional mismatches `0`, старая session перенаправлена на `/login`.
Terminal condition identity программы закрыт.

**Previously deployed visual baseline (superseded by PR #242):** `/courses`, `/students`, `/schedule`, Course
и Lesson используют единый `AppPageHeader` с H1 не крупнее 48 px на desktop и
32 px на mobile, `min-height: 200px` с ростом по контенту и вертикально
центрированными actions. Course, Lesson, Students и profile dialog используют
единый `WorkspaceTabs`: чёрная baseline 1 px с inline-inset 12 px и квадратный
чёрный active-сегмент 4 px без radius. Coolify развернул точный application SHA
`77870e37c361d9bc8e016defd331f630d85596de` со статусом Success за 3 минуты
47 секунд; authenticated browser postflight подтвердил `48px / 200px / 0px`
для title/header/action-center на пяти поверхностях, `12px / 1px / 4px`
для tabs и пустую browser console. Схема БД в visual slice не менялась.

**Superseded production page-header/tabs evidence:** на всех active product pages
заголовочная колонка `AppPageHeader` получает всё свободное место через
`minmax(0, 1fr)`, а action-секция занимает только ширину своего контента и не
растягивает кнопки на mobile. Подзаголовок использует canonical 50%-black
token. `WorkspaceTabs` получает тот же `--product-muted-foreground` для
inactive labels и baseline высотой 1.5 px; отдельный paint-layer оставляет
baseline видимой поверх hover-фона. Container и baseline занимают всю ширину с
`inline-inset: 0`, gap и верхние радиусы равны 12 px, каждый consumer передаёт
16 px Lucide icon, а непрозрачный active-сегмент имеет 4 px. Только
положительный count показывается уменьшенным приподнятым `sup`; `0` не
рендерится. Вкладка «Наблюдение» получает фактическое число доступных профилей и
обновляет его после отказа от доступа. Это UI-only изменение без API, schema
или migration. Exact source
`0c8946f95ebeb31e02955a110fc057f761f07ea9` работает в container
`g9x4d9zn60jv35r7zf0xl6xj-083519444597`: image tag и `SOURCE_COMMIT`
совпадают с source, image ID
`sha256:8119de725edeb042eaf1fcecb38d3fa5052aaf44e81e9fb3965d6c594b1731d1`,
restart count `0`, container started `2026-08-12T08:37:57.909983639Z`. Тогдашний
HTTP smoke подтвердил V2 `/login` и `/robots.txt` `200`, guest
`/courses` `307` в `https://v2.shidao.ru/login` и landing `/` `200`. Release
gate прошёл `560/560` unit/API и `22/22` strict production-mode browser
scenarios.

**Current production page-header refinement:** общий
`AppPageHeader` больше не ограничивает H1 значением `24ch`: на desktop
action-секция первой получает intrinsic ширину содержимого, между колонками
остаётся 24 px, а heading и сам title занимают всё остальное место. Link- и
button-варианты backlink используют непрозрачный `#141414` вместе со стрелкой
во всех состояниях. Label остаётся в одной строке, ограничен шириной header до
38 rem и обрезается через ellipsis; стрелка не сжимается. Расстояние от верхней
границы page header до backlink равно расстоянию от backlink до heading: 20 px
на desktop и 16 px на mobile. Это UI-only изменение без API, schema или
migration.

**Current production directory presentation refinement:**
уменьшенный `WorkspaceTabs` count сохраняет superscript-геометрию, но получает
`font-weight: 500`, на один шаг плотнее основного текста вкладки. `/students`
добавляет справа от disclosure «Фильтр» общий icon-only выбор вида: **Таблица**
слева и активна изначально, **Карточки** справа. Обе проекции используют те же
фильтры, сортировку и полный набор contextual actions для учеников; группы
получают тот же переключатель и открываются из таблицы или карточки. В обеих
вкладках `/courses` порядок также **Таблица / Карточки**, исходный вид —
таблица. Это UI-only изменение без API, schema или migration.

**Current production table/header/authoring refinement:**
все active `ProductTable` data rows, включая Course, Lessons, Schedule,
Students, Groups и subject progress, используют один Schedule-derived contract:
непрозрачный `#141414`, `.88rem`, weight `400` и line-height `1.3`.
Header rows и action cells сохраняют отдельную семантику. `AppPageHeader`
больше не принимает и не рендерит eyebrow: product page header состоит только
из backlink, H1, description, meta и actions. В заголовке собственного
published educator Course чёрный бренд-chip `ShiDao` удалён; статус
«Аттестован» расположен над author row, а author row использует текущий login
из Account session вместо display name. Для чужой публикации остаётся
immutable publisher label, поскольку отдельного публичного author handle в
current schema нет. Catalog toolbar располагает audience selector между
filters/reset и выбором вида. План Lesson больше не имеет внешней белой
`workspace-surface` и заголовков «Структура урока / План»: поиск компонентов
стоит слева, две actions — справа. Palette делит ссылки и файлы на отдельные
presentation-категории; category rail не имеет divider, а compact cards не
растягиваются по свободной высоте. Authored Component cards используют
element-radius 12 px и стандартную table-shadow. Это UI-only изменение без API,
schema или migration.

**Current production component-authoring and unified Text:**
runtime registry по-прежнему поддерживает все 20 Component types, а ручная
palette показывает 19 создаваемых карточек с коротким назначением и статическим
неинтерактивным мини-образцом. Отдельный `heading` исключён из authored-create
set во всех entry points: picker, REST `POST`, development MCP, AI planning и
deterministic assembler. Он остаётся двадцатым legacy runtime key для
read/render/modal edit/PATCH и immutable publication revisions. `rich_text` с
тем же schema version `1` принимает `title`, `content` или оба поля и отклоняет
payload, где оба значения пусты; прежние body-only payload остаются валидными.
Form labels — ровно «Заголовок» и «Текст», без «(необязательно)». Образцы не
используют production renderer и не создают вложенные controls. Выбор типа
переключает тот же dialog на локальный draft: persisted
Component ещё не существует, а единственный `POST` выполняется по явному
«Сохранить компонент». Persisted Component card остаётся renderer-only и теперь
является белой surface без border: базовая чёрная тень
`0 3px 6px #0000000d` на hover/focus сохраняет offset `3px`, но увеличивает
blur до `12px` и alpha до `#0000001a` с плавным переходом, не меняя геометрию;
reduced-motion отключает анимацию. 32 px action controls остаются в hover/focus
overlay без border/box-shadow на общей белой подложке `rgba(255, 255, 255, 0.5)`. Pencil
открывает отдельный modal editor, где
отмена не меняет Component, а явное сохранение отправляет `PATCH`. Оба editor
surface используют обычные labels и однострочные input/select высотой `40 px`
с canonical `.88rem/400` типографикой.

**Current production follow-up:** действие
Student Screen больше не использует семантику `Eye/EyeOff`. Оно показывает тот
же Lucide `MonitorPlay`, что и вкладка «Экран ученика», и является прямым
`aria-pressed` toggle. Неактивная кнопка скрыта вне hover/focus вместе с
остальными действиями; у назначенного Component активная голубая кнопка
размером `32 px` остаётся видимой постоянно. Включение назначает Component на
Slide ближайшего предыдущего learner-visible соседа, затем ближайшего
следующего, а при отсутствии обоих создаёт новый Slide. Повторное нажатие
убирает Component с Student Screen. Результат сохраняется существующей mutation
и остаётся тем же после reload; schema и API shape не меняются. Exact functional
source `288fac3d7ab909cab0e26bffb6a0c156f9e12d81` развёрнут Coolify deployment
`jf5f0j9yp1cwkkf2880d65f4` (`id=945`): matching container/image и
`SOURCE_COMMIT`, restart count `0`; release gate прошёл `585/585` unit/API и
`23/23` strict production-mode browser scenarios. Guest production HTTP
postflight green; authenticated production browser session отдельно не
заявляется.

Tracked data migration
`20260813063716_unify_heading_rich_text_components.sql` переводит authored
`heading` в title-only `rich_text` и объединяет только непосредственные пары
`heading → rich_text` с одинаковыми visibility, `student_slide_id` и placement.
Immutable publication revisions она намеренно не переписывает; physical DB
schema не меняется. Coupled rollout выполнен в безопасном порядке: сначала
развёрнут совместимый web image, затем создан verified full-format backup и
применён exact tracked migration. До migration production содержал `96`
Components (`17 heading`, `38 rich_text`): `11` безопасных непосредственных пар
объединены, ещё `6` headings стали title-only. Postflight показывает `85`
Components, `heading=0`, `rich_text=44` (`11` combined, `6` title-only, `27`
body-only, invalid `0`), `12` Slides, empty/dense violations `0` и `6` enabled
Component triggers. Registry parser прочитал все `85` PostgREST rows.
Immutable publication сохранила одну revision, `9056` snapshot bytes, прежний
content hash
`0c4aa4246c6b5fb0ac4f136c5387496b531ed0988956d45312471feb9268d32e` и `6`
snapshot Components, все `rich_text`; physical schema/snapshot не менялись.
Перед записью создан backup
`/root/shidao-db-backups/shidao-before-unify-heading-rich-text-20260813T070512Z.dump`:
size `1324116`, mode `600`, `1610` restore entries, SHA-256
`ee169345af886fd97a3060273b03d20f37dec380a82bbc43eb759e8f098ed775`.
Migration SHA-256
`874251c80e2a82bbf79897cb12755d606f9e1b546a9a3f51951dfaae89c5e1a3`;
`psql` зафиксировал `COMMIT`, а maximum `updated_at` преобразованных строк —
`2026-08-13T07:05:50.169297Z`.
Self-hosted contour не имеет relation
`supabase_migrations.schema_migrations`, поэтому отдельная history row не
заявляется: evidence — exact SQL checksum, transaction и измеримый postflight.

**Superseded production page-header-only action-button refinement:** все product buttons
внутри `AppPageHeader` имеют белую заливку,
внешнюю высоту `40 px` и border `0`. Их контур на белом или пользовательском
фоне задаёт общий `--product-raised-control-shadow`, дословно совпадающий с
тенью выбранной белой кнопки переключателя вида Расписания:
`0 1px 3px rgba(20, 20, 20, 0.1), 0 4px 12px rgba(20, 20, 20, 0.06)`.
Прежние primary header actions становятся белыми с чёрными текстом/иконкой;
Lesson action «Удалить» сохраняет danger-цвет и confirmation flow. Hover не
сдвигает surface и не убирает тень, а keyboard focus дополнительно обозначен
2 px outline. В `forced-colors` исчезающая системная тень заменяется системной
рамкой. Scope ограничен непосредственными action-кнопками заголовка и вложенным
trigger контекстного меню; buttons открываемого из header dialog, menu items и
обычные controls не меняются. Это UI-only change без API, schema, migration или
реализации выбора фона Course; rollout входит в exact deployed source ниже.

**Current production canonical control elevation and muted-color refinement:** текущий release применяет
один raised-surface contract ко всем каноническим `.product-btn`, а не только к
actions заголовка. Обычная кнопка имеет белый surface, общий
`--product-surface-border: 1px solid oklch(0 0 0 / .1)`,
`background-clip: padding-box` и exact однослойную тень
`0 1px 6px 0px oklch(0% 0 0 / 0.05)`. Поэтому полупрозрачная рамка смешивается
с непосредственным фоном страницы, а не с белой заливкой под ней. При
`box-sizing: border-box` фиксированная внешняя высота остаётся `40 px`, а
между двумя сторонами рамки остаётся `38 px` внутренней client-area. Все
ordinary buttons
получают rest/hover/pressed только из общего `.product-btn`, поэтому header и
toolbar/filter controls не имеют контекстных fork. На fine-pointer hover тень
становится `0 4px 10px -2px oklch(0% 0 0 / 0.16)`, а surface сдвигается через
`transform: translateY(-1px)` без scale или layout reflow; transient pressed
`:active` возвращает кнопку на исходную позицию и использует более плотную тень
`0 1px 3px 0px oklch(0% 0 0 / 0.14)`. Danger actions
сохраняют красный текст, keyboard focus —
отдельный 2 px outline, forced-colors — системный контур, а
`prefers-reduced-motion` отключает transition и вертикальный сдвиг. Плоские
служебные icon-actions
в строках таблиц и на Component cards намеренно остаются
transparent/borderless/no-shadow; contextual menu panels/items также не
получают product surface border. У составных тумблеров убрана постоянная
внешняя обводка; выбранная белая
option использует только базовую тень без button hover/pressed states,
сохраняет собственный focus outline, а фон compound shell задан отдельным
`oklch(0.19 0 0 / 0.1)` token. Подзаголовок `AppPageHeader`, inactive text и
16 px иконки `WorkspaceTabs` используют отдельный foreground
`oklch(0.19 0 0 / 0.6)`, тогда как baseline остаётся визуально `1.2 px`, но
получает независимый цвет `oklch(0.19 0 0 / 0.4)`. API, schema и migrations не
меняются. Deployed белый sticky product TopNav сохранял геометрию
`68 px / 20 px`, но вместо прежнего многослойного эффекта использовал одну
exact-тень `0px 6px 12px oklch(0 0 0 / 0.05)`. Этот production contract
зафиксирован в exact functional source
`1d4e5deff83cbdc1b479b16e4220cf799327009f`; его `68 px`/sticky геометрия
является историческим evidence и superseded current-source desktop
normal-flow/mobile sticky `64 px` contract, описанным выше.

**Current production ordinary-control, static-surface and entry-field
refinement:** поверх общего raised-control
контракта оставшиеся обычные CTA в Auth recovery/check-email, onboarding,
identity invitation/completion и retry-state переведены на shared `Button` /
`productButtonClassName`; raw text/password поля Account profile/security — на
shared `Input`, а onboarding select — на shared `Select`. Disclosure-trigger
«Фильтры» в Course, Students и Store также использует secondary `.product-btn`,
сохраняя `summary`,
`aria-expanded`, Escape/focus-return и отдельное disabled-состояние. Это не
меняет contextual menu items, flat row/component icon-actions, compound
toggles или сами filter popover panels.

Обычные кнопки, поля и plain статические surfaces используют один
`--product-surface-border: 1px solid oklch(0 0 0 / .1)` вместе с
`background-clip: padding-box`: белый background не рисуется под рамкой, и её
10%-ный чёрный цвет композится с непосредственным ancestor/page background.
Статические карточки и таблицы получают отдельный семантический alias
`--product-raised-surface-shadow`, равный базовому
`--product-raised-control-shadow`. Он применяется без hover/pressed lift,
transform или shadow-transition к shared `SurfaceCard`, всем canonical
`.product-table-wrap` (включая subject progress), Lesson Component и Run
history cards, Students cards, Store product cards и progress-stat cards.
Существующие background, radius, semantic/dashed `SurfaceCard` borders и
row-hover состояния не унифицируются: общий border применяется к plain
surfaces, но не перезаписывает смысловую или dashed-рамку. Focus-within
Component card и Store deep-link/focus highlight используют отдельный outline
поверх неизменной базовой тени; в `forced-colors`
исчезающую тень заменяет системный outline.

Базовые `.product-control` и `.field-input`, включая select и textarea,
получают общий surface border и `background-clip: padding-box`. Канонические
однострочные text/search entry controls дополнительно имеют белый surface,
внешнюю высоту `40 px`, внутреннюю client-area `38 px` и статический
`--product-entry-control-shadow`, являющийся alias той же базовой тени
`0 1px 6px 0px oklch(0% 0 0 / 0.05)`. Они не поднимаются и не
меняют тень на hover/pressed, сохраняют общий foreground/типографику,
непрозрачные placeholder и сопровождающие search/select icons через
`currentColor`; click/keyboard focus добавляет отдельный 2 px halo и не меняет
базовую тень, border или геометрию. Current source задаёт ему
`outline-offset: 0`, поэтому halo прилегает к рамке без дополнительного зазора.
В `forced-colors` декоративная тень и цвет
рамки уступают `Field` / `FieldText` и системному focus indicator. Select и
textarea сохраняют base boundary, но не получают single-line height или entry
shadow. Checkbox, radio, file input, dialog/menu/popover surfaces, Student
Screen content renderers и utility-only raw panels не получают entry или
static surface contract автоматически. Это UI-only production изменение без
API, schema или migrations; оно входит в exact current release и его strict
browser acceptance.

**Current production WorkspaceTabs fractional-baseline refinement:** общий
разделитель под вкладками уменьшен с прежнего baseline
`1.5 px` до визуальных `1.2 px`. Псевдоэлемент рисуется высотой `3 px` и
сжимается по вертикали через `scaleY(0.4)` от нижней грани; линия не сдвигается
относительно контента, а 4 px active
segment продолжает лежать над ней. Изменение действует через единый
`WorkspaceTabs` на всех его product consumers, не меняет 40 px tab geometry,
horizontal scroll, ARIA/keyboard contract, API, schema или migrations. Rollout
входит в exact deployed source ниже.

**Historical contextual ActionMenu baseline, retained in current source:**
release `8e5d169dab72dc285c0fdfe8991646152d9904c7` впервые убрал обычную рамку,
`separatorBefore`, визуальный divider и separator DOM/ARIA-узел у shared
`ActionMenu` для Course, Lesson rows, Schedule и Students. Порядок и состав
действий, 40 px menu items, destructive/disabled states, portal positioning,
keyboard navigation и focus restore не менялись. Тогда filter/calendar
popovers и Account menu ещё были отдельным visual scope; это ограничение
исторического release не описывает текущий universal contract ниже.

**Current source / next production universal dropdown refinement:** общий
`.product-dropdown-surface` канонизирует active product panels: shared
contextual `ActionMenu`, protected mobile navigation menu, product selection
dropdowns, включая Store sort, и Schedule calendar/date popover.
Course/Students/Store filter popovers удалены. Каждая оставшаяся панель имеет ровно
`6 px` внутреннего inset (`--product-dropdown-inset: 0.375rem`), белый фон, общий
element-radius `12 px`, обычный `border: 0`, `backdrop-filter: none` и одну
тень `0 18px 46px rgba(20, 20, 20, 0.18)`. Служебные separator/divider линии
удалены из contextual menus и calendar footer; единственное намеренное
исключение внутри mobile navigation panel — full-bleed светлый divider между
Account profile header и navigation items. Consumers не добавляют собственную
рамку, blur, вторую тень или отличающийся panel padding.
В forced-colors декоративная тень отключается, а границу панели восстанавливает
системный `1px solid CanvasText` на `Canvas`. Contextual `ActionMenu` сохраняет
destructive/disabled states и portal positioning; selection/date panels — свои
native semantics. Mobile navigation panel локально привязан к burger и
сохраняет keyboard/Escape/focus-return contract. Native `select`, самостоятельные modal dialogs и
reference/demo-only surfaces не получают universal dropdown class; calendar
panel остаётся в contract как dropdown, хотя использует dialog semantics. Это
UI-only изменение без API, schema или migrations.

**Historical production application evidence для U1 baseline:** Coolify deployment
`xivwq5nkaak141mc0tw5ysce` (`id=943`) создан
`2026-08-13T06:58:23Z` и завершён `2026-08-13T07:01:09Z`. Running container
`g9x4d9zn60jv35r7zf0xl6xj-065823494924` использует exact image/
`SOURCE_COMMIT` `dea92ca2c9af99fd5738e95fa9ca511aa10ca3da`, image ID
`sha256:f0f07ffd8b18ee5faadff5a1f01d0ea5e663807ec6f83754b16d43b64e18379d`,
имеет restart count `0` и status running. Read-only production HTTP postflight
подтвердил V2 `/login` `200`, guest `/courses` `307` в login, landing root
`200` и landing `/login` `503`. Authenticated production browser session не
была доступна; функциональная browser-проверка — exact локальный strict suite
`23/23`, поэтому authenticated production smoke здесь не заявляется.

**Previously deployed Schedule presentation baseline (superseded by PR #242):**
`/schedule` загружает реальные LessonRun за локальную неделю (понедельник–
понедельник) или календарный месяц. Внешняя поверхность toolbar удалена:
составные date navigator, переключатель «Неделя / Месяц» и независимый выбор
«Таблица / Карточки» расположены прямо на бежевом фоне страницы, как в
standalone demo. Стрелки двигают активный период, центральный native date
control выбирает опорную дату, а mutation reload сохраняет текущее окно. Это
application/UI change без новой таблицы Schedule events, schema или migration;
при достижении server hard limit в 500 Runs интерфейс честно предупреждает о
сокращённом окне, а в month mode предлагает сузить его переключением на неделю.
Coolify webhook deployment exact functional SHA `587bb21` завершён со статусом
Success за 2 минуты 33 секунды; running application указывает на тот же SHA.
Authenticated production browser postflight этого slice пока не выполнен.

**Current deployed Schedule calendar/table refinement:** отдельный
переключатель «Неделя / Месяц» удалён. Справа на фоне страницы компактный
составной date control шириной ровно 300 px на desktop стоит перед icon-only
выбором «Таблица / Карточки»: стрелки двигают назад или вперёд весь активный
день, неделю либо месяц, а центральная кнопка показывает короткую русскую
подпись с сокращённым месяцем без завершающей точки и открывает календарь.
Полная дата остаётся в
доступном имени и заголовке календаря; «День / Неделя / Месяц» находятся
внутри popover. Белая таблица имеет общий product surface border,
`background-clip: padding-box` и статическую raised-surface тень; её строка
заголовков и каждая строка данных имеют точную высоту 40 px; divider 1 px
входит в эти 40 px header, его weight равен 500, а текст стал светлее.
Обычные header/data cells используют канонический inline-padding 12 px.
Единственное исключение — последняя action-cell строки данных: её inline-inset
равен 4 px, а единственный `MoreVertical` trigger имеет размер 32 × 32 px и
радиус 8 px. Поэтому он центрирован внутри 40 px строки с отступами 4 px
сверху, справа и снизу и повторяет геометрию активной кнопки выбора вида.
Контентные по ширине колонки `Дата / Время` прижаты слева, `Ученики / Статус`
и действия — справа, а `Урок / Курс` делят оставшуюся ширину.
Строка заголовков теперь имеет тот же чисто-белый фон, что data rows; её
нижний divider и разделители между строками используют общий token
`--product-table-divider-color`, поэтому между header/body и соседними Runs
нет разного по тону шва. Данные выводятся чёрным в одну строку с ellipsis и
полным `title`; дата использует
формат `Среда · 12 авг`, время — `12:00 · 60 мин`, scheduled-состояние остаётся
plain «Ожидается». Видимые data-заголовки Schedule являются
кнопками сортировки: первый клик включает возрастание, повторный — убывание,
а текущее направление отражается в `aria-sort`. Видимый заголовок последней колонки
отсутствует: постоянная кнопка с вертикальным троеточием открывает все действия
в portal-menu; других кнопок действий в строке нет. Пункты portal-menu имеют
точную высоту 40 px, вертикально центрированные иконку и текст,
шрифт `.88rem/400` и канонические внутренние интервалы.
Authenticated top header и profile menu теперь используют сплошной белый фон
без blur. Active V2 buttons и header controls используют единый raised-contract
`40 px / 12 px / .88rem / 400`: белый surface, product border, базовая тень,
pointer hover lift и отдельный pressed/focus contract; иконки полностью
непрозрачны и наследуют контрастный цвет, а contextual menu items остаются
плоскими без обычной рамки. Отдельный Settings shell и side navigation удалены:
`/settings`, `/settings/profile`, `/settings/security` и
`/settings/observers` являются compatibility redirects в соответствующие
вкладки единого `/profile`, где используются общий product shell, TopNav и
shared controls. Landing,
Auth и полноэкранный Student Screen намеренно не входят в этот selector scope.
Это UI-only изменение: LessonRun API, System Assistant boundary, schema и
migrations не меняются; assistant по-прежнему получает только опорную локальную
дату, а не всё видимое окно. Последняя корректировка cell/action spacing
развёрнута в production release PR #242; exact rollout evidence приведён ниже.

**Current production Schedule header:** optional supporting line показывает
выбранный локальный период и точное число загруженных занятий; при достижении
hard limit она честно говорит «Показано», а не заявляет total. Прежнее
пояснение «Здесь все назначенные уроки…» удалено. В sortable header только
активная колонка показывает одну стрелку текущего направления; у остальных
колонок индикатора нет. В трёхпунктовом меню ожидающего Run нет разделителя
между «Изменить» и «Отменить», а радиус hover каждого пункта равен 8 px. Это
UI-only изменение без API, schema или migration.

**Current deployed Students/Courses controls slice:** панели
управления `/students` и обеих вкладок `/courses` больше не создают отдельную
toolbar-card: компактные 40 px controls расположены прямо на page background в
том же визуальном контракте, что Schedule. На Students состояния «Активные /
Архив / Ожидают ответа» больше не переключают отдельные проекции: активные
профили, архивные relations и исходящие pending-запросы находятся в одной
таблице с inline status/text и contextual actions. Current production header
показывает active/archive/pending counts, число Groups либо наблюдаемых
Profiles в зависимости от вкладки; прежний explanatory subtitle удалён. Поиск
остаётся отдельным контролом, а статус, наличие или отсутствие membership в
группах, конкретная группа и тип связи с Account собраны в едином disclosure
«Фильтр». Отдельного select «Сортировка» нет: Students, Groups и таблица
Course **Мои** сортируются кликом по заголовку столбца, повторный клик меняет
направление. Во вкладке Course **Мои** предмет, уровень и наполнение собраны в
disclosure «Фильтры», а «Карточки / Таблица» выбираются двумя icon-only
кнопками; видимый result count удалён. Published **Каталог**
использует тот же компактный поиск, disclosure только для реально поддержанных
server-side предмета/уровня и такой же icon-only выбор «Карточки / Таблица».
Повторный заголовок, поясняющий текст и видимый count удалены; фиктивные
content/sort controls не добавлены. `/courses` не показывает supporting line,
пока page-level честная метрика не доступна; прежний instructional subtitle
удалён.

**Current deployed content controls/table surfaces:**
прозрачные панели управления Schedule, обеих directory-вкладок Students и
обеих вкладок Courses используют всю ширину content-row с
`padding-inline: 0`. Date/view controls Schedule остаются справа и
заканчиваются по внешней границе строки. Ни одна из панелей не создаёт
отдельную toolbar-card. Общие tokens различают карточку с радиусом
20 px и вложенный element/control/table/menu с радиусом 12 px. Активные
`ProductTable` wrappers Schedule, Students и Courses используют table token,
сплошной белый фон и не имеют внешней рамки. Students и обе Course-таблицы
повторяют плотный Schedule-контракт: header и data rows имеют точную высоту
40 px, обычные cells — inline-padding 12 px, action-cell — 4 px. Students
показывает `Ученик / Статус / Аккаунт / Группы / Добавлен / actions`;
Course **Мои** — `Курс / Предмет / Уроки / Публикация / Обновлён / actions`, а
**Каталог** — `Курс / Предмет / Автор / Уроки / Материалы / actions`. Обе
Course-таблицы используют fixed layout, а текстовые ячейки обрезаются ellipsis,
не выталкивая последнюю колонку за контейнер. Shared header белый, а разделители
строк используют один
`--product-table-divider-color`. Сама table/toolbar geometry не меняет schema;
отдельный Course archive lifecycle ниже использует уже применённый production
A1 database contract. Базовая surface была развёрнута в production release PR
#242, а fixed-layout Course overflow fix впервые вошёл в exact source
`9e66fb5` и сохраняется в текущем deployed source.

Сохранённый Course применяет тот же контракт на вкладке **Уроки**: неизменённый
общий `WorkspaceTabs` остаётся полноширинным, а под ним прозрачная панель поиска
и «Добавить урок» занимает всю content-row без horizontal inset. Вместо
карточного списка рендерится `ProductTable` с колонками `№ / Урок / План / Экран
ученика / Проведение / Обновлён / actions`. Шесть data-заголовков переключают
view-only ascending/descending projection; исходное состояние — канонический
`position ASC`, сортировка не переписывает authored Lesson order. Header и
data-row имеют 40 px, обычные cells — 12 px, action-cell — 4 px, а единственный
`MoreVertical` trigger — 32 × 32 px. Его portal-menu содержит только «Открыть
урок» и контекстное действие проведения; удаления Lesson в этом меню нет.
Если открытого проведения нет, но в bounded Course history есть завершённое,
колонка честно показывает «Проводился ранее», не выдавая неполную выборку за
точный total. `Обновлён` берёт максимум timestamp самого Lesson и сохранившихся
Components и Student Slides, поэтому обычное изменение плана или экрана
ученика не оставляет в таблице устаревшую дату.
Прежние `workspace-lesson-*` card/list classes удалены.

В конце каждой строки Course **Мои** находится один `MoreVertical` trigger
32 × 32 px с portal-menu. Для неопубликованного Course меню содержит
«Дублировать / Опубликовать / Удалить»; publication-состояния сохраняют
действия обновления, открытия и снятия с публикации. «Удалить» требует
подтверждения и вызывает `DELETE /api/v2/courses/[courseId]`, который выполняет
recoverable soft archive через существующий `course.archived_at`: Course
исчезает из active list/get, но его Lessons, Components, attachments,
LessonRuns и LearningRecords физически сохраняются. Опубликованный Course
получает `409 course_is_published` до явного unpublish, а Course с открытым
LessonRun — `409 course_has_open_lesson_runs` до завершения или отмены Runs.
После owner-check application вызывает одну user-JWT RPC `archive_course`:
она в одной DB-транзакции повторно проверяет active ownership, публикацию и
открытые Runs, а при успехе ставит `archived_at`. Поэтому endpoint не делает
раздельных publication/open-run preflight-read и direct PATCH. Reverse guards
сериализуют archive, publish и создание/opening Run на одной Course row; это
по-прежнему не permanent delete. A1 database contract уже deployed/current;
этот API/UI flow также deployed/current в production release PR #242.

**Current deployed Students table/actions refinement:**
каждый data-заголовок таблиц Students и Groups переключает возрастающую и
убывающую сортировку и отражает её в `aria-sort`; actions-column не
сортируется. В конце каждой Students-row стоит один `MoreVertical` trigger с
contextual portal-menu. Для active profile меню открывает профиль, управление
группами, реальный flow «Добавить в курс…» с выбором Course, сохранением
существующей group/direct audience и добавлением direct learner, а также
destructive-действие «Убрать из списка». Пункт
«Написать сообщение» для active linked learner открывает current production
центр «Сообщения» через `learnerProfileId`; archived/pending rows по-прежнему
получают только допустимые restore/permanent-delete или cancel actions.
Trigger и пункты меню не активируют неявный row click. Это current production
UI/application flow поверх существующих Group/Course audience boundaries;
schema и migrations не меняются.

**Current deployed Schedule row actions:** каждая строка
назначенного LessonRun показывает `cursor: pointer` при наведении. Для
ожидающего назначения постоянное вертикальное троеточие открывает точный набор
действий «Начать урок / Изменить / Отменить»; active Run получает «Завершить
урок / Отменить», а completed — «Результаты». Start и cancel используют
существующие LessonRun mutations через общий reload/busy/error boundary,
cancel требует подтверждения, а edit открывает текущий dialog сразу в режиме
редактирования. Клик по action trigger или пункту меню не становится неявным
кликом по строке. Это deployed application/UI follow-up поверх существующих
API; schema и migrations не меняются.

**Historical production baseline, superseded by current Communication Center —
System Assistant conversational action slice:** прежний deployed baseline
использовал один глобальный floating widget «ИИ» и сохранял диалог только в
React state до reload/явного сброса. Current production заменил launcher и
ephemeral history единым persisted центром «Сообщения», описанным выше.
Server-side
orchestration читает bounded owner/recorder/consent-scoped проекции текущего
Account и открытой Course/Lesson, Students или выбранного дня Schedule.
Ассистент ведёт обычный model-authored диалог, а для записи может подготовить
одну из пяти strict карточек: Course draft, пустую Lesson, новую наполненную
Lesson, дополнение существующей Lesson или удаление Lesson. Неоднозначное
«сделай урок» детерминированно уточняет, нужен пустой или наполненный вариант;
deployed follow-up показывает под этим вопросом две одноразовые кнопки «Пустой
урок / Готовый урок». Выбор отправляется как обычная пользовательская реплика в
тот же model-authored диалог, доступен только у последнего ответа в неизменном
Course/Lesson context и исчезает после следующей реплики;
«заполни этот урок» использует exact server-resolved current Lesson и не
деградирует в создание ещё одной пустой Lesson. Filled flows переиспользуют
canonical `planLesson → preview → applyLessonPlan`, показывают все создаваемые
Components и до Apply ничего не записывают. Delete показывает полный impact и
повторно проверяет owner-scoped Lesson fingerprint. Каждая карточка HMAC-
подписана на actor, idempotency key и exact action на 10 минут. Точное «да» или
кнопка применяют только последнюю карточку без нового model turn; «нет», новый
запрос или смена Course/Lesson отменяют pending proposal. Срез не добавляет
migration или физическую schema. Exact release
`246cf49d2cd07bc7109b83acec46296be874312c` развёрнут Coolify deployment
`d5ov515oscti9n6c7x8fb3qf` со статусом `Success` за 4 мин 16 с; running
`SOURCE_COMMIT` и image tag совпадают с exact SHA, image ID
`sha256:21c7ab8c437d60a631e6fb68b474ec886f0c5fcf1dca1942207b5c85bab852ae`,
restart count `0`, state `running`. `/login` и `/robots.txt` отвечают `200`, оба
global assistant POST без Account session — `401`. Authenticated production
action postflight намеренно не выполнялся.

Quick-reply follow-up развернут exact functional SHA
`69a74a7c6a72f4491fef1314e32769c26fc72db7`: GitHub CI прошёл `438/438`,
production build и отдельный Playwright click/history scenario зелёные. Coolify
webhook deployment `qps8curjf688ndlmw95hdck2` завершился `Success` за 2 мин
29 с; контрольный manual deployment `mbxvql93z9ctvswb0lu07ca8` — `Success` за
22 с. Running container подтвердил тот же `SOURCE_COMMIT`, image tag и image ID
`sha256:ff300b42295b74685605a70b2dd25c29ea9e0758250be51e1f222af539f9690f`,
restart count `0`, state `running`; `/login` и `/robots.txt` отвечают `200`,
guest assistant POST — `401`.

**Previous deployed data baseline:** поверх group/audience baseline были введены canonical
`LearnerProfile`, teacher-local relation `teacher_learner` и явный provenance
`learning_record.recorded_by_account_id`. Существующие профили сохраняются 1:1,
но teacher ownership/name/archive перенесены в relation. В том historical
baseline account claim, merge и observer access отсутствовали; теперь они
входят в current production contract, описанный выше.

Forward migration `20260807033034_canonical_learner_profile.sql` применена к
production ShiDao DB 7 августа 2026 года после создания backup и прошла
DB/RLS/ACL/PostgREST postflight. Coolify развернул точный application SHA
`757044cf6f8c70aca329e52d48915f6d5b5b5844`; authenticated browser postflight
подтвердил вкладки и реальные данные Students, формы ученика и группы без
изменения пользовательских данных и без console warning/error.

Предыдущий reusable Groups/mixed audience baseline был развёрнут в release
`9393080` с migration
`20260806220726_learner_groups_mixed_course_audience.sql`.

Базовый LessonRun/LearningRecord slice был развёрнут ранее в release `fa91371`
с migration `20260806190044_lesson_runs_learning_records.sql`.

Двухуровневая навигация Course → Lesson, teacher-only `/schedule` и `/students`
и обновлённый визуальный язык app routes развёрнуты и проверены на release
`fea7f80`: сплошной бежевый фон без цветных градиентов, sticky demo header,
единые контролы и облегчённая типографика заголовков.

Release `fea7f80` добавляет пункты «Расписание / Ученики / Курсы» в меню
преподавателя и честные UI-shells для двух новых разделов. Он не добавляет
Schedule events, LessonSession, LearnerProfile, Group или новую
persistence/schema.

Release `3a94878` первоначально развернул RouterAI-срез: preview/apply для
программы Course и наполнения Lesson, а также read-only ephemeral AI-assistant.
Release `0276aed` переключил runtime на `google/gemini-2.5-flash-lite` и добавил
provider-flat transport для быстрой генерации Lesson с последующей canonical
validation. Production runtime получает `ROUTERAI_API_KEY` только из
server-side secret environment; browser и repository значения ключа не
содержат. Authenticated postflight подтвердил assistant и Lesson preview через
`v2.shidao.ru`; Apply не нажимался, тестовые данные не сохранялись. Подробная
граница зафиксирована в
[`docs/architecture/ai-provider-integration.md`](./architecture/ai-provider-integration.md).

Releases `8514441` и `7021801` снова обслуживают `demo.shidao.ru` как отдельный
исторический кликабельный UI-прототип вместо redirect в Course Builder. Он
использует только локальные фиктивные данные и React state, сохраняет clean-path
навигацию после reload, работает с Guest session и не вызывает V2 API/Supabase.
Это reference surface для дизайна, а не active V2 domain, compatibility fallback
или доказательство реализации показанных в нём будущих возможностей. Финальный
release дополнительно снимает ранее закэшированный permanent `308` через
одноразовый `/?restored=1`.

`v2.shidao.ru` — active production application. Landing остаётся на
`shidao.ru`; отдельный staging-контур пока не настроен.

Этот документ отвечает только на два вопроса: что действительно работает
сейчас и где это находится. Целевое развитие вынесено в
[`docs/roadmap.md`](./roadmap.md), а долгосрочная продуктовая модель — в
[`docs/v2/SHIDAO_PRODUCT_MODEL_AND_VISION.md`](./v2/SHIDAO_PRODUCT_MODEL_AND_VISION.md).

Если описание в roadmap или стратегическом документе выглядит как уже
реализованная возможность, но отсутствует здесь, считать его будущим, а не
текущим состоянием.

## 1. Каноническая модель текущего Course Builder

```text
Account
├── canonical LearnerProfile exactly 1
├── ObserverGrant 0..N → LearnerProfile
├── TeacherLearner 0..N → LearnerProfile
├── LearnerGroup 0..N → LearnerProfile 0..N
└── Course
    ├── audience sources → direct LearnerProfile + LearnerGroup
    ├── effective audience → unique active LearnerProfile 0..N
    ├── course-wide Attachments
    └── Lesson 1..N
        ├── ordered Components 1..N
        ├── Student Screen projection
        │   └── ordered Slides 1..N → ссылки на Components
        └── LessonRun 0..N
            └── LearningRecord 0..N → LearnerProfile + recorded-by Account

Offline LearnerProfile 0..N (account_id IS NULL до recipient-bound claim)
```

- Lesson непосредственно владеет одним упорядоченным списком Components.
- `Lesson Step`, root Step, `stepId` и активной сущности Methodology нет.
- Название Lesson обязательно и хранится в самой Lesson.
- Комментарий преподавателя хранится в `lesson.summary` и не попадает в
  learner-проекцию.
- Student Screen Slide только группирует видимые ученику Components. У него
  нет собственного контента, названия или второго порядка компонентов.
- Homework является отдельной поверхностью Lesson. Сейчас это честная
  заглушка без сохранения данных.
- Материалы принадлежат Course целиком, а не отдельной Lesson.
- Lesson является и редактируемым содержанием, и точкой назначения. LessonRun
  хранит только конкретное время/проведение, а не копию контента или второй
  runtime-урок.
- Один открытый LessonRun можно переносить; после completion/cancel ту же
  Lesson можно назначить повторно всей аудитории или её части.
- LearningRecord до completion является ожидаемым участником, а после —
  долговечной индивидуальной историей. `recorded_by_account_id` фиксирует автора
  записи и ограничивает teacher raw history. Subject/observer читают отдельную
  finalized safe projection с explicit shared comments. Отдельных
  participant/snapshot/status tables нет.
- LearnerProfile — canonical learning identity без teacher owner. Каждый
  active/provisional Account имеет ровно один linked profile как deferred DB
  invariant; offline profiles сохраняют `account_id IS NULL` до explicit claim.
- TeacherLearner хранит связь преподавателя с canonical profile, локальное имя
  и archive state. LearnerGroup — переиспользуемый teacher-owned набор этих же
  профилей, а не второй вид ученика. Профиль может не иметь группы или входить в
  несколько групп одного преподавателя.
- Course хранит direct learners и groups как независимые источники; scheduling
  и AI используют их дедуплицированную эффективную аудиторию.
- Состав уже открытого LessonRun зафиксирован draft LearningRecords. Изменение
  группы влияет на будущие назначения, но не переписывает существующее.
- Открытый/завершённый Run имеет хотя бы одну запись; cancel удаляет drafts,
  поэтому сохранённый отменённый Run может иметь ноль LearningRecord.

Полные Lesson/Run invariants зафиксированы в
[`docs/architecture/lesson-workflow-model.md`](./architecture/lesson-workflow-model.md),
а identity/access boundary — в
[`docs/architecture/learner-identity-access-model.md`](./architecture/learner-identity-access-model.md).

## 2. Что реализовано в текущем коде

### Auth и домены

- `shidao.ru` и `www.shidao.ru` показывают только landing.
- Любая внутренняя page/API-ссылка на основном домене закрыта middleware.
- `v2.shidao.ru` обслуживает Auth и рабочее приложение.
- `v2.shidao.ru` закрыт от индексации.
- `demo.shidao.ru` внутренне переписывает root и clean deep links на
  standalone `/demo`, закрыт от индексации и не принимает unsafe HTTP methods.
- Standalone demo использует Guest session и фиктивное client-only состояние;
  V2 API, Supabase и persistence к нему не подключены.
- Current production release использует explicit app host allowlist: routed
  non-root `brand`/`model` и routed unknown hosts получают `421`, mismatched
  Host/X-Forwarded-Host fail closed. Unrouteable unknown/deep landing hosts
  могут закрываться раньше edge proxy текущим `503`; app/API они не получают.
- Unsafe production requests принимают только exact app Origin
  `https://v2.shidao.ru`; landing/cross-subdomain/missing Origin отклоняются.
- Email signup, confirm, login, recovery и reset используют существующий
  self-hosted Supabase Auth и SMTP.
- Любой новый Auth user атомарно получает roleless Account и один canonical
  LearnerProfile. Onboarding меняет общие Account fields и не выбирает роль.
- Existing learner login/PIN работает через `account_login_alias` и
  `account_security`; active login path не читает legacy Student.
- В current production primary navigation одинакова для каждого Account и
  содержит «Расписание / Ученики / Курсы / Магазин»; «Профиль» находится в
  меню Account вместе с остальными вкладками раздела, а observer projection —
  третьей вкладкой «Наблюдение» внутри «Ученики».
- В current source / next production Account/avatar menu удалено: protected
  desktop и authenticated landing используют avatar как прямую ссылку
  `/profile`, а единственный navigation dropdown открывается burger-кнопкой
  protected mobile header и содержит name/email плюс пять основных маршрутов.
- Существующая app-session поддерживает глобальную и пользовательскую
  инвалидизацию; destructive identity/credential flows дополнительно требуют
  recent reauthentication из sealed session.

### Магазин

- **Current production baseline:** `/store` — Account-level UI-only demo
  учебного магазина. Каталог содержит учебники и методические книги, прописи и
  тетради, карточки, канцелярию и обучающие игры; category tabs, поиск и
  сортировка вычисляются над типизированными fixtures в application code.
  Отдельные audience/price/availability filters удалены, а sort использует
  product dropdown ShiDao вместо native platform `select`.
- **Current source / next production:** каждый из девяти товаров ссылается на
  ordered-массив из двух или трёх square WebP masters `1254 × 1254` quality
  `90`; все 19 находятся в `public/store/products/<slug>/`. Built-in
  `next/image` + Sharp выдаёт responsive variants по local allowlist и точному
  `sizes`: quality `75` на card/thumbnail и `85` в detail, cache floor `7d`.
  Swipe и borderless fade arrows листают только галерею, а click/tap фото,
  title или свободной non-control card area открывает product `DialogShell` до
  `56rem × 42rem` с gallery/thumbnails, полным description, price, add и
  buy-now. Последний гарантирует quantity `>= 1` и открывает delivery после
  закрытия detail. View Transition расширяет/сворачивает конкретную card с
  reduced-motion/unsupported fallback; deep link остаётся scroll/focus.
- Тумблер выбирает крупные (`3` desktop columns) или компактные (`6`) карточки
  вместо прежней таблицы; responsive projection — `2/4` на tablet и `1/2` на
  mobile. Category/audience pills видимы в обеих плотностях; нижние tag-pills,
  decorative visual icons/glyphs, availability, stock gating, card
  `ShoppingBag`, footer divider и header-chip удалены. Card CTA использует
  `ShoppingCart`; цена крупнее и стоит на одной centerline с кнопкой корзины.
- Кнопка «Корзина» находится в action-секции общего `AppPageHeader`. В одном
  `DialogShell` можно менять количество и удалять позиции, затем заполнить имя,
  телефон, email и адрес. Платёжный экран — честная заглушка без card fields и
  network request; завершение очищает локальную корзину и сообщает, что заказ
  не создан.
- Корзина и checkout не переживают reload и не используют cookies,
  `localStorage`, API, Supabase или Storage. Реальные Product/Order/Inventory,
  оплата, доставка и admin catalog остаются next после отдельного
  product/security/schema решения.
- У товара есть стабильный в текущем demo-каталоге slug.
  `/store?product=<slug>` выбирает категорию,
  прокручивает каталог и переводит focus к известному товару; Lesson registry и
  authored hierarchy в этом срезе не меняются.

### Курсы

- **Current production baseline:** Course и compact
  publication имеют `learningAudience` со значениями `children` / `educators`.
  Migration E1 backfilled все пять существующих Course как `children`; четыре
  новые attestation tables имеют RLS и closed browser ACL.
- **Current production:** в **Каталоге** тумблер «Обучение
  детей / Обучение педагогов» расположен в одной toolbar-строке с поиском,
  фильтрами и выбором вида. Фильтрация, facets и cursor выполняются server-side
  внутри выбранного направления; смена направления сбрасывает masked error
  state перед отображением нового результата.
- **Current production:**
  `account.can_author_educator_courses` с default `false` является
  DB-backed capability доверенного автора. Только active Account с этим флагом
  видит выбор направления при создании Course и может менять educator content;
  capability не даёт права одобрить собственную publication.
- **Current production:** отправка educator revision требует
  authored attestation и создаёт review `pending`. Только server-side admin
  review RPC переводит exact current revision в `approved` или `rejected`;
  отдельного admin UI ещё нет. До первого approval Course отсутствует в
  каталоге, а при pending update прежняя `approved_revision_id` остаётся
  learner-visible. Все educator publications имеют `is_shidao=true`; каталог,
  таблица и header показывают одновременно `ShiDao` и имя эксперта-автора.
- **Current production:** catalog item открывается отдельным
  route `/courses/catalog/[publicationId]` со своим header/backlink и вкладками
  **«Уроки / О курсе / Материалы / Аттестация»**. Audience toggle остаётся
  только фильтром toolbar списка и не рендерится внутри Course. Старый
  `?course=` служит compatibility redirect.
- **Current production:** published detail строится из
  immutable approved revision как learner-safe projection. Browser получает
  только `learner_visible` Components, назначенные на Slides, без Lesson
  `summary`, `staff_only`, teacher preferences, audience, runs/history и AI
  consent. Explicit publication materials доступны через краткоживущие signed
  URLs.
- **Current production:** Account progress хранится отдельно
  для exact publication revision: last opened Lesson, completed Lesson refs,
  counts, percent и complete. Workspace позволяет продолжить с сохранённого
  Lesson. Вкладка **«Аттестация»** видна, но и GET, и submit теста server-side
  заблокированы до `100%` Lessons текущей approved revision.
- **Current production:** educator Course нельзя добавить в
  «Мои», скопировать или дублировать даже после award. Для него запрещены
  groups/direct learners, roster, scheduling и LessonRun; это только
  самостоятельное обучение текущего Account. Детский catalog Course сохраняет
  прежний copy/open-source flow.
- Ответы аттестации проверяются против exact immutable approved revision; до
  успешного результата correct answer key не выходит в browser. Успешная
  транзакция создаёт Account-scoped attempt и award, показывает badge
  **«Аттестован»** в header и запись во вкладке **«Аттестация»** учебного
  профиля. Исторический award сохраняется после смены approved revision, но не
  считается current.
- Результат формулируется как внутренняя аттестация ShiDao, а не государственное
  удостоверение. Канонический contract:
  [`docs/product/educator-courses-and-attestation.md`](./product/educator-courses-and-attestation.md).
- **Current demonstration product data:** bootstrap transaction завершилась
  `COMMIT` в `2026-08-12T03:10:45Z` и создала курс «Современный урок китайского
  языка для детей: произношение, иероглифика и формирующее оценивание». Final
  read-only postflight: active target `1`, educator Course `1`,
  Lessons/Components/Slides `6/6/6`, definition/questions `1/10`, published
  publication/definition `1/1`, attempts/awards `1/1`; result `9/10 = 90%`
  при threshold `80%`, `passed=true`. Authenticated projection вернула
  `certified=true` и `10` post-award review keys; учебный профиль содержит одну
  credential по этому Course. Product data не входит в schema migration.

- **Current production slice:** `/courses` имеет две
  вкладки: **Мои** показывает owner-scoped
  рабочие Course, **Каталог** — только current published revisions.
  В UI нет отдельной сущности «шаблон».
- Вкладка **Мои** сохраняет поиск по открытым Course fields, сортировку
  заголовками таблицы и режимы «Карточки / Таблица». Current source удаляет
  subject/level/content disclosure и его client state; оставшиеся controls
  лежат в одной компактной строке прямо на page background, а view выбирается
  icon-only segmented control.
  Приватные пожелания преподавателя в поиск не входят.
- **Каталог** имеет server-side audience/search/subject/level filtering
  capability.
  Карточка и строка списка показывают компактные публичные метаданные, автора и
  counts; Lesson outline, описание и материалы открываются в отдельном
  published workspace, а не разворачиваются внутри списка. Current production
  Current source показывает search и audience direction без отдельной
  filter-кнопки; subject/level facets остаются backend contract, но active web
  UI их не отправляет. Внешней toolbar-card, повторного заголовка/пояснения и
  видимого count нет. Presentation переключается
  между карточками и таблицей для уже загруженной cursor-последовательности;
  content filter и произвольная сортировка не заявляются, потому что их нет в
  paginated catalog API/RPC.
  Для детского Course «Добавить в мои курсы» создаёт новый independent owner
  Course и не запускает AI/адаптацию автоматически; educator Course исключён
  из copy flow.
- Рабочий детский Course можно дублировать, опубликовать, обновить в
  каталоге или снять с публикации. Educator Course можно отправить на review,
  обновить или снять с публикации, но нельзя дублировать. Publish/update имеет
  один confirmation dialog и required rights/reuse checkbox; отдельного preview
  wizard и name/PII scan нет.
- Persistence разделяет stable `course_publication`, immutable
  `course_publication_revision`, её private `course_publication_asset` и
  provenance-only `course_publication_origin`. Таблицы и mutation RPC
  закрыты от `anon`/`authenticated` direct access; web API использует
  server-only broker после обычной Account/session authorization.
- Snapshot включает generic Course fields, Lessons, teacher summaries,
  ordered Components, visibility, Slides и ready materials. В него не входят
  `teacher_preferences`, audience/groups/learners, schedule, LessonRuns,
  LearningRecords, reports/history, AI consent и live source IDs.
- Ready files копируются в private bucket `course-publication-assets`;
  signed URLs короткоживущие. Добавление создаёт новые owner-scoped
  StoredFile и remap ссылок Component; изменение/удаление source не
  ломает уже созданную копию.
- Catalog list строится компактным DB RPC без загрузки snapshot: поиск,
  фильтры и cursor работают server-side, а facet-массивы ограничены 100
  значениями. Viewer и publisher должны оставаться active; переход Account в
  non-active атомарно снимает его Course с публикации.
- Отдельный publication content clock отмечает только изменения allowlisted
  authored tree. Excluded audience/preferences не создают ложный badge
  «Есть изменения», а idempotent update повторно сверяет live materials до
  acknowledgement.
- Immutable publication history ограничена DB-квотой 5 GiB на Account.
  Publish/update/catalog-copy дополнительно защищены process-local лимитом:
  одна concurrent mutation и не более 12 запусков за 60 секунд на Account.
  Ошибка cleanup логируется без Storage paths и пользовательского текста;
  при неоднозначном результате gateway committed objects намеренно не
  удаляются вслепую.
- `/courses/new` использует те же четыре вкладки, что и сохранённый Course, и
  начинает с активной вкладки **О курсе**. До первого сохранения **Уроки** и
  **История** показывают честные заглушки, а **Материалы** — staging-список
  выбранных файлов; переключение вкладок не размонтирует форму и не теряет draft.
- **Current production:** authorized educator authoring
  заменяет owner-вкладку **«История»** на **«Аттестация»**; здесь автор
  редактирует definition, а не проходит тест. У Account без trusted-author
  capability форма остаётся children-only и не показывает audience toggle.
- Обычное «Сохранить курс» создаёт persisted Course и открывает его на
  **О курсе**. Детерминированная сборка и успешное применение AI-preview
  открывают сохранённый Course на **Уроках**.
- Форма сохраняет название, тему, цель, уровень, описание аудитории,
  планируемое число уроков и приватные пожелания преподавателя.
- На форме можно загрузить изображения и документы до 10 MiB в private bucket
  `course-assets`.
- Успешная загрузка означает только «прикреплено». Parsing, OCR, embeddings и
  RAG не реализованы.
- Course открывается без автоматического выбора первого Lesson и содержит
  вкладки «Уроки / О курсе / Материалы / История». **Уроки** используют
  полноширинные search/create controls и плотную таблицу Schedule-геометрии;
  исходная projection следует authored `position`, а альтернативная сортировка
  заголовками остаётся только локальным представлением.
- **О курсе** — одна растущая вместе с содержимым карточка без собственного
  вертикального scroll. В ней inline редактируются основные настройки и
  фактическая аудитория из групп/отдельных учеников; здесь же остаётся секция
  источников.
- **Материалы** — отдельная агрегирующая библиотека всех course-wide
  attachments. Она разделяет используемые в Components и пока не используемые
  материалы, показывает связанные Lessons и learner-visible usage и не создаёт
  lesson attachment. Новые файлы в текущем UI выбираются при создании Course.
- «Источники» честно показывают пустое состояние до parsing/RAG. «История»
  показывает завершённые проведения всех Lessons; change history авторских
  правок ещё не реализована.
- Это изменение Course navigation/layout не добавляет новую schema, сущность
  или параллельный API: настройки, audience и attachments используют прежние
  persisted contracts.
- В текущем source страницы `/courses`, `/students`, `/schedule`, Course и
  Lesson используют один сплошной фон `#f5f1e8`; marketing noise и цветные page
  gradients на этих маршрутах отсутствуют.
- В current source / next production Course header следует обновлённому
  demo-контракту: на desktop normal-flow shell без sticky/fixed positioning, а
  до `767 px` sticky shell у safe-area края имеет высоту `64 px`, сплошную белую
  поверхность без blur и радиус `20 px`. Общий container-row с brand,
  navigation и actions/avatar имеет exact высоту `40 px` на desktop и `48 px`
  на mobile; desktop row сохраняет по `12 px` сверху и снизу, все три зоны лежат
  на одной вертикальной centerline, а nav/action wrappers не раздувают ряд.
  Controls сохраняют радиус `12 px`. Неактивный пункт main navigation на hover
  сохраняет exact 5%-black background `rgba(0, 0, 0, 0.05)` и при готовом
  measured active-pill.
  В current production персональное dropdown-меню также использует
  непрозрачный белый фон. В current source / next production этот dropdown
  остаётся только главным меню protected mobile burger; avatar на protected
  desktop и authenticated landing является прямой ссылкой `/profile`.
- Один `AppPageHeader` задаёт прозрачную заголовочную секцию, единый H1 с
  максимумом 48 px на desktop и 32 px на mobile, подзаголовок, всегда
  зарезервированную backlink-row с optional интерактивным backlink и правую
  action-секцию для `/courses`, `/students`, `/schedule`, Course и Lesson.
  Высота контейнера следует фактическому title/metric/meta/actions и padding без
  искусственного minimum. В current source H1 и правая action-секция находятся
  в одной title-row, причём их нижние границы совпадают. Зарезервированная
  backlink-row выше и metric/meta ниже остаются в content-column и не влияют на
  вертикальную позицию actions. Заголовочная колонка занимает всё оставшееся
  место, а actions имеют intrinsic ширину по содержимому, не растягивают кнопки
  даже при узком viewport и переносятся в отдельный ряд только при реальной
  нехватке ширины. Асинхронная метрика занимает будущую строку до ответа,
  но весь header становится видимым только вместе с её финальным значением или
  error-state. В current production сам
  H1 заполняет эту колонку без прежнего лимита `24ch`; desktop column-gap равен
  24 px. Course/Lesson backlink и его стрелка непрозрачно чёрные, label
  однострочный с ellipsis, а вертикальные интервалы над и под ним равны
  page-header inset. В current source backlink-row сохраняет эту же высоту и
  интервалы на top-level разделах, но без `back` не рендерит искусственные
  link, button или текст.
- Один `WorkspaceTabs` используется во всех product consumers, включая Courses
  index, owner/new/published Course, Lesson, Students, learning/observing profile
  и learner dialog,
  сохраняет roving keyboard/ARIA contract и горизонтальный scroll. Выбранная
  вкладка перекрывает full-width baseline 1.2 px цвета
  `rgba(20, 20, 20, 0.5)` квадратным чёрным сегментом 4 px без radius.
  Container, baseline и scroll-row используют канонический `inline-inset: 0`
  на всех поверхностях. Неактивный label использует тот же 50%-black token,
  tab-кнопки разделены gap 12 px и имеют верхние радиусы 12 px; baseline
  остаётся видимым поверх hover-фона. Каждый tab имеет 16 px иконку. Только
  положительный числовой count отображается маленьким приподнятым `sup`, без
  badge, с weight 500 — на один шаг плотнее основного текста вкладки;
  каждый tab владеет существующим persistent `tabpanel` через симметричные
  `aria-controls / aria-labelledby`. В current production кнопки,
  header controls и вкладки используют шрифт `.88rem/400`, flat primary без
  3D-блика/подъёма, fully opaque icons и единый 16 px icon rhythm; исходный
  layout-контракт подтверждён production postflight release `77870e3`, а
  control-полировка развёрнута production release PR #242. Предыдущий
  1.5 px tab-refinement вошёл в exact source
  `0c8946f95ebeb31e02955a110fc057f761f07ea9`; текущий 1.2 px paint-layer
  развёрнут functional source
  `dea92ca2c9af99fd5738e95fa9ca511aa10ca3da`.

### Roleless navigation, Расписание, Ученики и аудитория

- В current production основная навигация любого Account содержит «Расписание /
  Ученики / Курсы / Магазин» без role switch. Персональное меню справа содержит
  «Профиль / История / Аттестация / Наблюдатели / Настройки / Выход».
- В current source / next production это персональное Account/avatar menu
  удалено. Protected desktop и authenticated landing открывают `/profile`
  прямым нажатием на avatar. Protected mobile скрывает desktop primary rail и
  показывает burger — единственный navigation dropdown с Account name,
  privacy-safe email и пунктами «Расписание / Ученики / Курсы / Магазин /
  Профиль».
- «Магазин» остаётся тем же universal Account route и не вводит роль продавца
  или покупателя.
- `/schedule` и `/students` filesystem-совместимо остаются под прежним route
  group, но layout проверяет только Account session. Guest/degraded session
  перенаправляется в `/login`.
- Current production `/schedule` показывает реальные LessonRun выбранной
  локальной недели или календарного месяца. Это проекция тех же проведений, а
  не отдельная таблица Schedule events.
- В current production краткий Action «Назначить урок» с иконкой добавления в
  календарь находится в общей page-header action-секции, а строка под H1
  показывает выбранный период и точное число загруженных занятий (`Показано`
  при достижении hard limit), не объясняющий текст о назначении страницы.
  Справа под header находятся 300 px compact date picker и icon-only control
  «Таблица / Карточки». Короткая подпись использует русское сокращение месяца
  без завершающей точки, но доступное имя сохраняет полную дату. Отдельного
  переключателя периода на
  странице больше нет: календарный popover объединяет выбор опорной даты и
  режимы «День / Неделя / Месяц», а стрелки date control двигают именно
  выбранный период. В current source сам navigator использует общий product
  border, `background-clip: padding-box`, element radius и static base shadow
  без прежней inset-рамки и дополнительной тени; calendar panel сохраняет
  universal dropdown surface.
  Непустой результат начинается сразу с выбранного вида, без повторного
  «Выбранная неделя / Занятия» и count-chip. Table projection — сплошная белая
  поверхность с общим product border, `background-clip: padding-box`,
  статической raised-surface тенью и element/table radius 12 px; header и
  каждая data-row имеют ровно 40 px, причём нижний divider 1 px входит в
  высоту header; weight равен 500, а текст светлее. Обычные header/data cells
  имеют inline-padding 12 px; только последняя body action-cell использует
  inset 4 px, чтобы единственный `MoreVertical` trigger размером 32 × 32 px с
  радиусом 8 px имел по 4 px сверху, справа и снизу внутри 40 px строки и
  совпадал по геометрии с активной кнопкой выбора вида. Контентные по ширине
  `Дата / Время` прижаты слева, `Ученики / Статус` и действия — справа, а `Урок / Курс`
  делят свободную ширину. Все данные строки чёрные, однострочные и используют
  ellipsis; дата имеет вид `Среда · 12 авг`, время — `12:00 · 60 мин`. Статус
  остаётся plain «Ожидается». Все видимые data-заголовки переключают
  возрастающую/убывающую сортировку повторным кликом и публикуют направление
  через `aria-sort`; action header не сортируется. Последняя колонка без видимого заголовка
  показывает только постоянное вертикальное троеточие со всеми действиями.
  Других кнопок действий в строке нет; пункты portal-menu имеют 40 px,
  вертикально центрированы и используют `.88rem/400`. System Assistant намеренно
  продолжает получать только опорную локальную дату, а не всё видимое окно.
- `/students` показывает единый teacher-scoped projection
  `TeacherLearner + LearnerProfile` во вкладках «Ученики / Группы» и
  независимую learner-safe вкладку «Наблюдение». Canonical observer URL —
  `/students?tab=observing`; прежний `/observing` остаётся protected
  compatibility redirect. Подзаголовок страницы — «Ученики и группы, с
  которыми вы работаете или за которыми наблюдаете». Active profiles,
  archived relations и исходящие pending connection requests находятся в
  одной таблице. Поиск остаётся отдельным, а current source показывает один
  inline membership control **Все / В группе / Без группы**. `В группе` и
  `Без группы` применяются только к active relations; archived и pending
  остаются в режиме «Все» и доступны поиском. Прежний disclosure, status,
  concrete-group и Account-state filter controls удалены. Separate sort select
  отсутствует: sortable headers таблиц Students и Groups
  переключают ascending/descending повторным кликом. Students table имеет
  40 px header/rows и колонки
  `Ученик / Статус / Аккаунт / Группы / Добавлен / actions`. «Статус»
  описывает lifecycle relation/request, «Аккаунт» — состояние identity
  connection, а «Добавлен» — teacher-local дату relation или запроса. Архив и
  ожидание ответа отмечены прямо в строке. Вся compact
  toolbar расположена на page background во всю ширину без horizontal inset;
  рядом с membership control находится icon-only переключатель **Таблица /
  Карточки**.
  Таблица расположена слева и выбрана изначально; обе проекции используют одну
  filtered/sorted выборку и одинаковые contextual actions. На вкладке «Группы»
  тот же выбор переключает таблицу и карточки групп. Обе Course toolbars
  используют тот же нулевой horizontal inset.

- `/courses` использует общий полноширинный `WorkspaceTabs` и прозрачные
  full-width controls в обеих вкладках. Обе таблицы имеют 40 px header/rows и
  однострочный ellipsis. В обеих вкладках icon-only control расположен в
  порядке **Таблица / Карточки**, и таблица является исходным видом. В **Мои**
  шесть data-заголовков меняют
  ascending/descending сортировку и отражают её через `aria-sort`; action
  header не сортируется. **Каталог** сохраняет server-side cursor order и не
  сортирует только уже загруженную страницу на клиенте. Вертикальное меню
  owned-row переиспользует реальные duplicate/publication flows и подтверждённый
  soft archive с publication/open-Run guards.
- Клик по строке ученика открывает dialog «Профиль / История»: здесь можно
  изменить локальное имя и membership в нескольких группах, а история
  ограничена LearningRecord текущего преподавателя. Ученика можно создать,
  изменить и убрать из своего списка; для групп доступен полный CRUD. Один
  `MoreVertical` в каждой строке открывает contextual menu: active profile
  можно открыть, изменить группы, реально добавить в выбранный Course с
  сохранением существующей audience или «Убрать из списка». «Написать сообщение»
  для active linked learner открывает единый current production центр
  «Сообщения». Archived/pending rows получают
  только допустимые restore/permanent-delete или cancel actions.
  Видимое имя принадлежит relation текущего преподавателя, а не глобальной identity.
- Header action на `/students` следует выбранной вкладке: «Новый ученик» или
  «Новая группа»; поиск и inline-тумблер **Все / В группе / Без группы**
  остаются в full-width directory toolbar.
- «Убрать из списка» архивирует только `teacher_learner` текущего Account:
  relation остаётся в общей таблице с чипом «В архиве», но исчезает из групп и
  будущих Course audiences; canonical LearnerProfile, его LearningRecord и
  состав уже назначенного Run сохраняются. Restore выполняется из этой строки,
  возвращает только relation и не восстанавливает прежние Group/Course links.
  Permanent delete разрешён только для пустого unclaimed profile. Удаление
  группы не удаляет учеников или историю.
- Course header независимо прикрепляет группы и отдельных учеников; overlap
  учитывается один раз, а header показывает число уникальных effective learners.
- Legacy `student`, `class`, `class_student` не читаются active Course/identity
  services. Account/profile link создаётся trusted DB workflow; сама link по-
  прежнему не открывает Course, teacher relation или raw LearningRecord.
- Из Course/Lesson можно назначить или перенести время, выбрать subset
  аудитории, начать, завершить постфактум или отменить проведение.
- Completion сохраняет общий teacher report и для каждого ожидаемого ученика:
  attendance, repeat recommendation и индивидуальный comment. Только явное
  действие «Добавить в учебный профиль» публикует comment через
  `shared_with_learner_at`; historical comments остаются private.
- Каждый draft/finalized LearningRecord сразу получает
  `recorded_by_account_id`; текущие history и AI reads возвращают только записи
  этого преподавателя, а не глобальную историю всех будущих связей profile.
- Attendance нельзя сохранить значением по умолчанию: преподаватель явно
  выбирает «Был» или «Не был» для каждого ожидаемого ученика. Активный Run
  можно отменить, а закрытие заполненного отчёта требует подтверждения.
- Actual duration вычисляется только из explicit start либо explicit
  post-factum input; scheduled fallback и unknown не превращаются в duration.
- Статусы интерфейса вычисляются из timestamps; отдельной persisted state
  machine нет.
- Все surfaces используют тот же бежевый product language, opaque-white
  content surfaces, raised controls, карточки и типографику, что и Course
  routes.

### Learner identity, self profile и observer — current production contract

- `/students` → «Добавить ученика» сначала поддерживает rotating one-time share
  code/QR и blind email connection, затем explicit offline profile path. Share
  code создаёт pending request; subject принимает или отклоняет его сам.
- Offline profile получает recipient-bound `claim` либо `child_activation`
  invitation. Token/email хранятся только как digests; wrong Account получает
  generic response, а email delivery не раскрывает наличие Account.
- Child activation создаёт отдельный learner Account с unique login/PIN,
  требует recent reauth и explicit recovery-delegate acknowledgement; adult
  recipient Account не становится learner target. Optional observer request
  остаётся отдельным accept flow.
- Claim existing Account открывает merge preview. Physical merge переносит
  records/relations/memberships/audience, сохраняет teacher-local names,
  разрешает finalized same-Run conflict через superseded provenance и оставляет
  immutable alias старого UUID. Open/draft и claimed→claimed merge fail closed;
  pre-merge cancel ничего не меняет.
- Одиночные actor-scoped teacher URLs резолвят stale merged UUID. Bulk
  Group/Course/Run UUID fail generic и требуют reload/reselect; erasure удаляет
  alias, поэтому старый UUID больше не резолвится.
- `/profile` показывает linked self profile, cursor-paginated
  learner-safe history, real-record progress, share code, AI consents и
  preview/confirm destructive actions.
- `/profile?tab=observers` управляет pending/active observers, free display
  labels и revoke; прежний `/settings/observers` только перенаправляет туда.
  Вкладка `/students?tab=observing` показывает несколько observed profiles и
  только read-only learner-safe history/progress. `/observing` перенаправляет
  на эту вкладку. Teacher relation и observer grant не создают друг друга.
- Subject/observer не имеют raw `learning_record SELECT`; safe projection
  физически исключает drafts, superseded rows, private comments, recorder IDs,
  teacher-local directory, roster и group teacher report.
- Subject-only safe unlink работает только без merge lineage/records/grants.
  Learning-data erasure требует recent reauth + fingerprint, удаляет всю
  subject lineage/aliases/grants/consents и атомарно создаёт новый empty linked
  profile, не удаляя чужие learner records, записанные этим Account как teacher.
- Teacher может запросить отдельный AI consent только для effective Course
  audience. Active consent добавляет provider лишь bounded sanitized aggregate
  canonical history и categorical signals из explicitly shared comments после
  PII scrub; comment text/summary/quote не передаётся. Revoke/expiry/owner/
  audience change действуют немедленно; stale preview Apply отклоняется.

### Уроки и компоненты

- На Course → «Уроки» отображается полный ordered набор Lessons в таблице
  `№ / Урок / План / Экран ученика / Проведение / Обновлён / actions`; поиск и
  «Добавить урок» находятся в прозрачной полноширинной панели. Шесть заголовков
  меняют только view-sort с исходным `position ASC`. В конце строки один
  `MoreVertical` открывает «Открыть урок» и контекстное действие проведения;
  редактор не открывается до явного выбора Lesson.
- После выбора Lesson backlink содержит название Course, а заголовок имеет
  формат `Урок {position}. {title}`.
- Lesson содержит вкладки «План / Экран ученика / Домашнее задание / Материалы
  / История».
- Lesson → «Материалы» является read-only проекцией course-wide attachments и
  не вводит владение файлами на уровне Lesson; «История» показывает реально
  завершённые LessonRun.
- Создание вручную требует только название и создаёт пустую Lesson без AI и
  без списания токенов.
- В текущем production UI кнопка AI открывает preview/apply для новой Lesson или
  дополнения существующей; ручное создание пустой Lesson остаётся доступным.
- Название и комментарий Lesson редактируются отдельной модалкой.
- Карточку Lesson нельзя перемещать или назначать на Student Screen.
- Lesson можно удалить; оставшиеся позиции уплотняются. UI предупреждает, что
  Components/Slides/Runs и незавершённые records будут удалены, а finalized
  LearningRecord сохранятся в LearnerProfile с компактным title/subject
  context.
- Компоненты добавляются прямо в Lesson через palette по категориям. В current
  production её panel имеет стабильный desktop-размер `56rem × 42rem`, остаётся
  внутри mobile viewport, а прокрутка принадлежит только списку карточек:
  заголовок и category tabs не прыгают при переключении между 2, 4 и 10
  элементами. Каждая карточка до добавления показывает назначение и статический
  неинтерактивный образец своего типа; это presentation metadata, а не
  persisted payload или production renderer. Вводный subtitle и повторные
  category heading/description удалены; close остаётся доступной кнопкой без
  декоративной рамки. Выбор карточки открывает настоящий payload editor внутри
  того же dialog, но работает с локальной копией canonical defaults. До явного
  «Сохранить компонент» `POST` не отправляется и Component не занимает позицию;
  возврат в каталог или закрытие dialog удаляет только локальный draft.
  Каталог показывает 19 authored-create вариантов: legacy `heading` исключён
  также из REST `POST`, MCP, AI и deterministic assembler. «Текст» (`rich_text`)
  принимает заголовок, основной текст или оба поля, но не оба пустыми.
  Сохранённые `heading` и прежние body-only `rich_text` остаются совместимыми с
  runtime renderer/editor и schema version `1`.
- Компонент можно редактировать, удалить или переместить кнопками
  «выше/ниже». В current production persisted card всегда показывает только
  production teacher renderer. Группа 32 px actions располагается поверх
  карточки и раскрывается через hover/focus-within; на touch/coarse-pointer она
  остаётся доступной без hover. Pencil открывает отдельный modal editor, а не
  заменяет renderer внутри карточки. Отмена/закрытие не отправляют mutation;
  `PATCH` с payload/placement выполняется только по явному сохранению. Editor
  labels используют `.88rem/400`, а однострочные controls — canonical 40 px.
  Сама authored card белая, использует общий product surface border,
  `background-clip: padding-box` и статическую
  `--product-raised-surface-shadow`; hover не меняет тень и не смещает layout,
  а focus-within добавляет отдельный outline. Overlay actions не имеют
  border/box-shadow и лежат на общей белой подложке
  `rgba(255, 255, 255, 0.5)`. В current production активное
  действие Student Screen является исключением из скрытия rail: его голубая
  32 px кнопка `MonitorPlay` видна и вне hover/focus, тогда как неактивная
  кнопка и остальные действия остаются скрытыми.
- Новый Component всегда создаётся `staff_only` и не показывается ученику,
  пока преподаватель явно не назначит его на Slide.

### Экран ученика

- В current production кнопка «Экран ученика» использует ту же иконку `MonitorPlay`,
  что и одноимённая вкладка, и передаёт состояние через `aria-pressed`.
- У `staff_only` Component неактивная кнопка видна только при hover/focus.
  Нажатие назначает Component на Slide ближайшего предыдущего видимого соседа,
  затем ближайшего следующего, а если подходящего Slide нет — создаёт новый.
- У назначенного Component голубая 32 px кнопка остаётся видимой без наведения.
  Повторное нажатие снимает назначение и возвращает Component в `staff_only`.
- Выбранное состояние сохраняется на сервере и не меняется после reload.
- На одном Slide может находиться несколько соседних Components.
- Порядок Slides не может идти назад относительно единого порядка Lesson.
- При reorder видимого Component его Slide автоматически ограничивается
  ближайшим допустимым диапазоном.
- Пустые Slides удаляются, позиции Slides уплотняются.
- Встроенный и полноэкранный preview показывают один активный Slide.
- Заголовок Lesson показывается всегда; `lesson.summary`, `staff_only`
  Components и непривязанные course attachments отсутствуют в learner-ответе.
- Preview позволяет преподавателю проверить Lessons и Slides. Это не модель
  навигации будущего live-ученика.

### Component registry

Текущий source code-first registry содержит ровно 20 активных типов:

```text
heading
rich_text
callout
quote
image
video
audio
slideshow
single_choice_poll
matching_game
choice_quiz
fill_blanks
word_bank
sequence
categorize
free_response
external_link
word_builder
vocabulary_list
file
```

Для каждого типа registry определяет key/version, русское название, категорию,
Zod payload/placement schemas, defaults и capabilities. Текущий payload editor
использует один switch по `ComponentTypeKey`, а teacher/Student Screen
renderers — отдельную exhaustive typed map. JSON Schema для MCP генерируется из
registry contracts.

Authored-create projection содержит 19 вариантов и не является вторым registry:
`heading` сохранён в 20-типовом runtime contract для чтения, renderer,
modal edit/PATCH и immutable publication revisions, но исключён из picker,
REST `POST`, development MCP, AI и deterministic assembler. Payload `rich_text`
версии `1` принимает `title`, `content` или оба поля и требует хотя бы одно
непустое значение.

`video`, `audio` и `external_link` в этом срезе принимают только прямые
HTTPS URL; upload/transcoding медиа не заявлены. Самопроверка новых
интерактивных типов и ответ `free_response` живут только в React state
текущего preview: learner answer persistence, scoring, attempts и teacher review
ещё не реализованы. Отдельных voice-recording, arbitrary embed и
image-match типов в active registry нет. Продуктовое сопоставление с
ProgressMe и границы этого среза зафиксированы в
[`docs/product/course-component-catalog.md`](./product/course-component-catalog.md).

### Development MCP

В репозитории есть локальный `stdio` MCP server. Он не является HTTP endpoint и
не опубликован наружу. Зарегистрированы шесть tools:

```text
course.create_draft
course.get
course.add_lesson
lesson.add_component
lesson.set_component_student_screen
lesson.reorder_component
```

MCP вызывает `CourseBuilderApplicationService`, использует проверенный
пользовательский JWT и не обращается к таблицам напрямую. RouterAI не
подключается к `stdio` transport: production AI orchestration вызывает те же
application service/contracts внутри authenticated web request.

### AI provider integration — current production boundary

- Server-only adapter вызывает OpenAI-compatible RouterAI endpoint. Default
  model в source — `google/gemini-2.5-flash-lite`; key, model, base URL и timeout
  задаются server environment и не отправляются browser. Runtime release
  `0276aed` проверен с этой моделью без вывода secret.
- New Course flow сначала сохраняет обычный пустой Course и attachments, затем
  получает ровно `targetLessonCount` titles/comments. Provider call ничего не
  записывает; UI показывает preview, model и token usage, а Lessons появляются
  только после отдельного Apply.
- Lesson planning поддерживает новую или существующую Lesson. Provider output
  ограничен четырьмя создаваемыми типами `rich_text`, `callout`,
  `single_choice_poll`, `matching_game` и повторно валидируется registry/Zod
  contracts до первой записи. `rich_text` может быть title-only, body-only или
  содержать оба поля; legacy `heading` AI больше не создаёт. Расширение ручного
  registry не расширяет provider allowlist автоматически.
- Provider-facing structured-output schema является плоским transport adapter.
  После ответа она преобразуется в canonical AI plan, а payload каждого
  Component повторно проходит соответствующую registry schema и обычный
  `lessonAddComponentInputSchema`; transport shape не становится вторым
  Component registry.
- Lesson Apply проверяет, что Course/Lesson не изменились после preview. Для
  существующей Lesson он обновляет teacher comment и добавляет Components, не
  заменяя уже существующие. Новые Components остаются `staff_only`; Student
  Screen не публикуется автоматически.
- Course/Lesson apply использует существующий `CourseBuilderApplicationService`
  с per-request actor, ownership и пользовательским JWT. Provider/quota
  persistence этот authoring baseline не добавляет; информационный meter
  Communication Center отдельно выводится из уже сохранённых assistant replies,
  а identity consent/audit tables принадлежат отдельному M2–M3 contract.
- Развёрнутый course-scoped Assistant route читает bounded Course/selected
  Lesson context и отвечает текстом без mutation commands, MCP tools или apply
  routes. Его прежний Course/Lesson dialog удалён из current deployed UI;
  старый `/api/v2/courses/[courseId]/assistant` пока может оставаться
  compatibility route, но не является интерфейсом нового System Assistant.
- Lesson planning, compatibility course-scoped Assistant и global Course
  context дополнительно читают direct learners, группы и
  дедуплицированную effective audience с teacher-local именами, до 8 завершённых
  Runs текущего Course и до 40 finalized LearningRecords, записанных текущим
  преподавателем об этих учениках по его курсам. Canonical profile не открывает
  AI observations другого преподавателя. Технические IDs исключены; отсутствие
  не трактуется как непонимание. Audience/history входят в Lesson preview
  fingerprint. Полный provider context имеет единый hard budget 96 000 символов
  и детерминированно сокращает только oversized значения.
- Current identity adapter отдельно проверяет active `profile + Course + owner`
  consent server-only RPC. Без consent context выше остаётся recorder-scoped; с
  consent добавляются только bounded sanitized aggregates и categorical
  signals из explicit shared comments после PII scrub. Comment text/summary/
  quotes, foreign raw rows/IDs, titles, exact timestamps и private comments не
  возвращаются teacher API.
  Preview фиксирует consent revision, revoke/expiry/owner/audience change
  немедленно делает Apply stale.
- Attachment contents, signed URLs и Storage identifiers модели не передаются:
  доступны только filename/MIME/status. Parsing, OCR, embeddings и RAG не
  реализованы.
- Provider request ID/model/usage возвращаются UI и попадают в ограниченный
  server log event. Durable quota/usage ledger, reservation/settlement,
  billing, balance и AI change sets отсутствуют; process-local rate limit и
  информационный meter Communication Center не являются hard пользовательской
  квотой.

#### Communication Center — current production

- Один `CommunicationCenterProvider` в protected `(app)` layout заменяет
  отдельный System Assistant launcher. Общая кнопка «Сообщения» с unread badge
  открывает один inbox; direct, Course, system и assistant items остаются
  различимыми по type/provenance, а ShiDao system feed не имеет composer.
- Launcher — сплошной чёрный квадрат с белой Message/X icon; aggregate unread
  от system, AI и human sources показывается красным iOS-style badge на его
  верхнем правом углу. Desktop имеет только одну узкую panel без expand-mode:
  inbox, выбор адресата и диалог сменяют друг друга. Main header не содержит
  supporting subtitle, а initial open фокусирует dialog surface, не search.
  Retry в центральных error states использует общий `Button` contract. Panel
  имеет непрозрачный белый фон; header divider и footer divider над composer
  доходят до обеих границ, а после footer divider сохраняется `12 px` до
  composer content.
- System avatar использует белую wordmark-style `S` на чёрном фоне, assistant
  avatar — белую Sparkles icon на таком же чёрном фоне. Постоянные зелёные
  system/AI helper callouts отсутствуют: provenance system feed раскрывается
  маленькой доступной `?` рядом с ShiDao. Empty AI state не повторяет header
  avatar и показывает расширенные context-aware prompt chips обычным
  tab-weight шрифтом. Global dialogue не обещает directory/schedule context;
  Course/Lesson prompts соответствуют текущему closed action allowlist. В
  пользовательском UI assistant подписан кратко **«ИИ»**, без прежнего
  «ShiDao ИИ».
- Assistant turn body и system notification body используют общий memoized
  safe CommonMark renderer для абзацев, strong/emphasis, списков, цитат и code.
  Raw HTML, images и active Markdown links запрещены; headings сводятся к
  компактным text blocks. User turns, human messages и system title остаются
  literal plain text. Full assistant body больше не отправляется целиком в live
  region: screen reader получает короткое уведомление о новом ответе. Parser
  загружается отдельным lazy client chunk только при показе formatted body, а
  не увеличивает initial bundle каждой protected page.
- Direct conversation открывается из Students по `learnerProfileId`, только
  если у адресата есть linked Account и active accepted teacher/learner
  relation. После открытия browser использует opaque `threadId`; Account/Auth
  UUID, `sender_account_id` и глобальный поиск пользователей в browser contract
  не входят. Archive закрывает capability, restore возвращает доступ к полной
  истории.
- Course thread открывается из Course surface. Owner и linked Account текущей
  effective audience видят полную историю независимо от даты присоединения;
  удаление из audience немедленно закрывает read/send, а повторное добавление
  возвращает ту же историю. ObserverGrant сам по себе доступа не даёт.
- Human composer всегда требует отдельного Send. AI reply, system event или
  proposal не может неявно отправить сообщение человеку или Course audience;
  fake/local seeded messages и notifications отсутствуют.
- System feed принимает только trusted typed application events. Первый
  producer отражает назначение, перенос и отмену LessonRun, owner aggregate и
  собственный learner-safe результат после завершения; UI не исполняет
  произвольный `payload.href`. Richer Component/runtime metrics и background
  result producers остаются later.
- Account может создать, переименовать и архивировать несколько persisted AI
  conversations с immutable global/Course/Lesson context. Server сохраняет
  user turn, читает bounded persisted history/context, вызывает существующий
  Assistant и trusted append-ом сохраняет assistant reply/proposal в одном
  orchestrated exchange.
- Message bubbles используют радиус `1 px` только у исходящего угла реплики:
  bottom-left для incoming и bottom-right для own message. На fine pointer
  timestamp скрыт и плавно проявляется за `250 ms` при hover/focus-within;
  layout под ним не схлопывается. Touch/coarse pointer оставляет timestamp
  видимым, reduced-motion отключает transition.
- Footer AI conversation показывает semantic progressbar высотой `4 px` с
  тёмно-зелёной оставшейся долей тестового месячного объёма `2 000 000`.
  Server агрегирует текущий UTC-месяц из canonical persisted assistant-reply
  payloads owner-scoped сохранённых conversations, включая archived, через
  существующие user-JWT list-conversations/list-turns RPC. Отдельный quota GET
  подгружается независимо от turns/exchange и при ошибке убирает только meter.
  Meter информационный: hard enforcement, reservation/settlement, distributed
  reconciliation и billing отсутствуют. Срез не меняет physical schema и не
  добавляет migration.
- Existing HMAC-signed preview/explicit Apply сохраняется. Новый strict
  `lesson.schedule_run` показывает назначение или перенос и вызывает canonical
  LessonRun mutation только после подтверждения. A2
  `schedule_lesson_run_if_unchanged` атомарно сравнивает expected no-open-Run
  или exact Run id/`updated_at`, draft roster и current Course audience перед
  вызовом canonical scheduler; mismatch становится stale action. После reload
  все proposal из hydrated history получают stale-состояние «Подготовьте
  предложение заново»;
  только proposal текущего mounted exchange может быть actionable.
- Inbox/read model использует cursor pagination, polling каждые 30 секунд,
  refresh при focus и `visibilitychange` для read cursor выбранного диалога.
  Realtime/presence, push/email и visible receipts не заявляются.
- Parameterless communication GET нормализует отсутствующие cursor/filter/limit
  keys в canonical defaults до вызова repository. Это относится к inbox,
  targets, human/AI history и system feed; internal default Zod diagnostics не
  становятся пользовательским текстом ошибки.
- Source boundary находится в `src/modules/communication/`,
  `src/app/api/v2/{inbox,message-targets,communication-threads,system-notifications}`,
  `src/app/api/v2/assistant/conversations/`,
  `src/components/communication/` и current forward migration/schema.
  Production DB CC1 + A2 применены, DB postflight и contract snapshot current;
  initial dependent web/API deployment `otekp2zseg5ig2r05v6taabu` exact source
  `2efaa86851fffc7e444af904fb900d9984caa6a8` и production HTTP/auth/CSRF
  postflight завершены.
  Durable action/job ledger, distributed idempotency и reliable background
  worker — отдельный later slice.

#### System Assistant — historical production baseline, superseded in current production

- Historical baseline монтировал `SystemAssistantProvider` и один floating
  `SystemAssistant` в
  protected `src/app/(app)/layout.tsx`, а не в public landing/Auth/demo и не в
  Course/Lesson header. Кнопки прежнего course-scoped dialog из Course и Lesson
  удалены.
- **Superseded launcher refinement:** launcher имел exact размер
  `40 × 40 px`, стоит справа и снизу с inset `12 px` плюс mobile safe area,
  использует общий element radius `12 px` и не имеет border. Светлая опаловая
  поверхность перетекает из aqua/mint через молочно-белый в lavender/pink:
  два независимых turbulence/displacement-поля меняют геометрию волн с
  несоизмеримыми циклами, а не перемещают готовые radial gradients. Icon-only
  glyph остаётся тёмным и сохраняет accessible name через `aria-label`; при
  `prefers-reduced-motion` композиция статична. Non-modal panel выровнен по
  правому inset и открывается на `12 px` выше launcher; API, Assistant state
  machine и schema не меняются.
- Browser передаёт только strict поля `surface`, typed `view`, optional
  `courseId`/`lessonId`, `localDate` и `utcOffsetMinutes`. Surface и вкладка
  выбираются из закрытых согласованных списков;
  произвольный URL,
  DOM, search/hash, значения форм и page text в provider context не входят.
  Course/Lesson IDs повторно проверяются обычным owner-scoped application
  service до provider call.
- Каждому запросу доступен bounded compact Course catalog; full current Course,
  recorder-scoped finalized history и consented sanitized shared projection
  загружаются только для Course surfaces. Student directory/groups читаются
  только на Students Learners/Groups views; Observing не открывает модели
  observer/self history. Schedule читается только на выбранный локальный день.
  Технические IDs, JWT/Auth/Storage secrets и file contents в provider
  projection отсутствуют; общий context сохраняет hard budget 96 000 символов.
- Оба `/api/v2/assistant` routes проходят universal active/provisional Account
  gate через `resolveAccessPolicy`, затем используют только per-request user JWT,
  Course/Lesson ownership и RLS. Локальный `stdio` MCP и publication service-role
  adapters в этот flow не входят.
- Chat возвращает либо свободный model-authored текст, либо максимум одно strict
  proposal: `course.create_draft`, `course.add_lesson`,
  `course.add_lesson_with_plan`, `lesson.fill` или `lesson.delete`. Provider не
  пишет данные.
  На Course surface пустой provider `courseRef` однозначно нормализуется только
  в server-issued `current_course`. Если для `add_lesson` отсутствует title,
  server возвращает обычный уточняющий вопрос о названии без proposal/записи;
  после ответа пользователя следующий turn может подготовить action card.
  Для детерминированного вопроса о пустом или наполненном Lesson server также
  возвращает bounded `quickReplies`: UI показывает «Пустой урок / Готовый урок»
  только под последней актуальной assistant-репликой, а click добавляет выбранный
  текст в обычную историю и не вызывает mutation напрямую.
  Любой неизвестный непустой ref остаётся `ai_invalid_output`, без fuzzy lookup
  по UUID, title или индексу Course.
  Shared-comment scrubber применяется и к тексту, и ко всем полям proposal,
  поэтому consented чужая фраза не может быть процитирована или сохранена через
  action. Browser показывает параметры action card; только отдельный
  `POST /api/v2/assistant/actions/apply` после явного подтверждения вызывает
  canonical `createDraft`/`addLesson`, existing Lesson planner/apply либо
  history-preserving `deleteLesson`. Filled preview показывает summary и все
  3–20 Components; existing Components/Slides сохраняются, новые Components
  добавляются в конец и остаются `staff_only`.
- UI держит максимум одно active proposal. Exact «да» и кнопка применяют эту
  подписанную карточку без нового provider turn; exact «нет» отменяет её, любой
  другой новый запрос supersede-ит старую карточку, а смена Course/Lesson context
  делает pending proposal недоступным. Terminal stale/expired ответ требует
  сформировать новую карточку вместо бесконечного retry.
- В historical baseline диалог не persisted. Chat был ограничен 30 turns,
  новые uncached Apply — 20
  действиями на actor за 10 минут; concurrency guard, actor+target apply mutex и
  replay cache idempotency key существуют только в памяти одного Node process.
  Cache живёт до 10 минут и ограничен 500 результатами; restart или другая
  replica его не видит. Это не distributed quota, durable action ledger или
  гарантия exactly-once между replicas. Proposal не persisted, но HMAC-подпись
  связывает actor, exact action и idempotency key на 10 минут; Apply до mutation
  проверяет подпись, ownership и stale fingerprints. Cache остаётся
  process-local, а delete compare→RPC имеет известное неатомарное TOCTOU окно
  без новой migration. Обычный concurrent Lesson append также сохраняет
  известный ordering debt.
- Контракты/service/routes/UI и contract tests находятся в
  `src/modules/ai/system-assistant-*`, `src/app/api/v2/assistant/` и
  `src/components/assistant/`. Base global widget release `b7c6cfe` и signed
  conversational action follow-up `246cf49` развёрнуты. Для base release
  RouterAI no-write smoke с synthetic current Course пройден; для follow-up
  подтверждены exact running SHA/image и HTTP/guest boundary. Authenticated
  production Apply остаётся отдельным непройденным postflight и не
  подразумевается из HTTP availability.

Base RouterAI routes/UI, server-only secret boundary и provider postflight
no-write flows развёрнуты и проверены в production. Release acceptance описан в
[`docs/architecture/ai-provider-integration.md`](./architecture/ai-provider-integration.md).
Это утверждение относится к base RouterAI flow release `0276aed`.
History-aware context развёрнут в release `9393080`; production provider smoke
с непустой учебной историей ещё не выполнялся.

## 3. Что ещё не реализовано

- пользовательский выбор модели и persisted provider settings;
- durable assistant action/job history и generalized tool calling за пределами
  allowlisted Course/Lesson actions;
- distributed rate limit, durable idempotency/action ledger и exactly-once
  assistant mutations между replicas;
- durable token usage ledger, hard quota с reservation/settlement и concurrent
  enforcement, billing units, balance и AI change sets/undo; текущий
  `2 000 000` meter является только информационной тестовой проекцией;
- parsing/RAG прикреплённых материалов;
- persisted Homework editor;
- LearnerProfile-scoped enrollment/consumption детского Course и настоящий live
  Student Screen access; current production Account-scoped self-learning
  educator Course описан отдельно и не является LessonRun/live flow;
- live Student Screen sync, realtime presence и teacher-controlled runtime
  cursor поверх открытого LessonRun;
- richer per-learner metrics ждут реального Component/runtime producer;
- Realtime/presence для messaging, push/email delivery, attachments,
  moderation и reliable background notification/AI workers;
- реальные Product/Order/Inventory, admin catalog, persisted cart/checkout,
  оплата и доставка; current production `/store` является только client-state
  UI-demo и не создаёт заказ;
- общий catalog moderation UI, ratings, update merge в уже добавленный Course и
  additional official content за пределами educator review flow;
- persisted reconciliation для Storage objects, оставшихся после crash или
  commit-unknown; permanent physical Course deletion и пользовательский
  restore архивного Course остаются отдельными future lifecycle решениями;
- внешний remote MCP/API для сторонних агентов;
- отдельный staging-контур.

Перечень не является разрешением реализовать всё сразу. Приоритеты и границы
следующих срезов находятся в [`docs/roadmap.md`](./roadmap.md).

Identity/observer execution contract и actor matrix сохранены как acceptance
source:
[`LEARNER_IDENTITY_COMPLETION_PROMPT.md`](./v2/LEARNER_IDENTITY_COMPLETION_PROMPT.md).
В production contract-stage требования и полный terminal condition выполнены:
final exact functional web deploy, DB/API/HTTP и authenticated browser
postflight завершены 9 августа 2026 года.

## 4. Identity rollout state

M1–M3 production migrations сохранили legacy rows для recovery, но active web
releases `5944d31`, `5d650a3` и final functional `01aa88a` используют roleless
`account`, Account credential/preference boundary и
exactly-one canonical profile. Однозначные legacy student credentials
backfill-ятся без fuzzy matching; parent/student edges становятся pending
reconciliation, а не observer grant.

Все новые identity tables default-deny для `anon/authenticated`. M4 после двух
exact roleless releases и read-only dependency audit через `DROP ... RESTRICT`
отозвала legacy Data API grants, удалила 23 active helpers и unused guardian
enums. Сами legacy tables/rows не удалены; rollback-only `user_security`
dual-writes исчезли из supported Account RPC, а tables стали dormant recovery
data.

M5 не выдала GoTrue прямых прав на Account/Profile: deferred exactly-one
invariant получил собственную owner-only `SECURITY DEFINER` boundary с пустым
`search_path` и закрытым execute ACL. M6 учитывает фактический двухфазный GoTrue
Admin create (`INSERT`, затем custom `raw_app_meta_data UPDATE`) и переводит
bootstrap Account в `provisional` только для live `child_activation`, strict
internal email, pristine rows и совпадающего creation `xmin`. Поздний metadata
refresh не может понизить established active Account. Production probe создал
ровно один provisional Account/Profile и затем удалил все disposable fixtures.

Это не новая иерархия Course: Course не становится дочерним School/Class,
LearnerProfile не превращается в legacy Student, а observer не является Parent
role. Полный contract находится в
[`learner-identity-access-model.md`](./architecture/learner-identity-access-model.md).

## 5. Что удалено из активной V2

- Methodology domain и связанные страницы/API;
- `lesson_step` и `lesson_step_component`;
- scheduled-lesson, старый homework/runtime и коммуникационный слой;
- dashboard, старые groups/schedule/runtime pages, notifications и старые
  lesson workspaces;
- fixture fallback и renderers, зависящие от конкретной методики или Lesson ID.

Старая методика «Мир вокруг меня» сохранена отдельно:

- человекочитаемая и lossless-копия:
  `archive/content/world-around-me-2026-08-04/`;
- полный V1-контур: Git refs и private recovery snapshot из
  [`docs/operations/v1-recovery-runbook.md`](./operations/v1-recovery-runbook.md).

Архив не является runtime dependency. Его будущий импорт должен создать
обычные Course, Lesson, Component и attachment entities через отдельный
валидируемый importer.

## 6. Фактическая production contract-schema и migrations

Repository M1–M6 shape расширяет и затем безопасно завершает текущий V2
identity contract:

```text
account
course
lesson
lesson_component
lesson_student_slide
stored_file
course_attachment
learner_profile
teacher_learner
learner_group
learner_group_member
course_learner
course_learner_group
lesson_run
learning_record
account_login_alias
account_security
account_preference
learner_profile_share_code
learner_connection_request
learner_claim_invitation
learner_profile_merge
learner_profile_merge_conflict
learner_profile_merge_private_detail
learner_profile_alias
learner_observer_invitation
learner_observer_grant
learner_ai_consent
learner_identity_audit_event
learner_identity_rate_limit
learner_erasure_request
learner_credential_recovery_delegate
learner_identity_reconciliation
communication_thread
communication_message
communication_read_state
assistant_conversation
assistant_turn
system_notification
```

Эти tables принадлежат identity/audience/scheduling/history slice, а не
provider accounting. `learner_profile` является canonical identity,
`teacher_learner` — teacher-local directory relation. `lesson_run` не содержит
Lesson content; один partial unique index допускает один открытый Run на Lesson.
`learning_record` заменяет participant table: `occurred_at IS NULL` означает
expected row, non-null — finalized durable result, а
`recorded_by_account_id` сохраняет recorder. Persisted status и full Lesson
snapshot отсутствуют. `learning_record` дополнительно хранит explicit shared
comment timestamp, actual duration at time и superseded merge provenance.
Recorder immutable; subject reset использует explicit erasure workflow вместо
случайного cascade.

Current Communication Center читает bounded finalized history и сохраняет
несколько AI conversations/turns/read cursors; human threads/messages и system
notifications используют отдельные persistence contracts. Production DB CC1
и A2 atomic Assistant schedule guard, dependent web/API и boundary postflight
current. Информационный месячный meter `2 000 000` выводится application server
из валидных persisted assistant replies текущего UTC-месяца через существующие
user-JWT RPC и не добавляет migration/physical schema. Provider request
payloads, отдельный quota/billing ledger и durable action/job ledger по-прежнему
не сохраняются.

Последние структурные migrations:

- `20260804033421_course_lesson_components_remove_legacy_methodology.sql` —
  удаление активного Methodology/Step/runtime слоя и переход к direct Lesson
  Components;
- `20260804044955_add_lesson_student_slides.sql` — persisted Student Screen
  Slides, assignment/reorder/delete RPC и RLS/ACL;
- `20260806190044_lesson_runs_learning_records.sql` — neutral LearnerProfile,
  direct Course audience, LessonRun/LearningRecord, lifecycle RPC, deletion
  retention, RLS/ACL.
- `20260806220726_learner_groups_mixed_course_audience.sql` — reusable Groups,
  mixed/deduplicated Course audience, safe LearnerProfile archive, group CRUD,
  dynamic future scheduling и RLS/ACL.
- `20260807033034_canonical_learner_profile.sql` — canonical LearnerProfile,
  teacher-local `teacher_learner`, recorder provenance/backfill, relation-scoped
  archive и обновлённые RLS/ACL/RPC contracts.
- `20260807065017_identity_security_hardening.sql` — M1 RLS/ACL hardening и
  compatibility Auth negative boundary.
- `20260807065026_learner_identity_primitives_backfill_invariant.sql` — M2
  roleless Account credentials, atomic bootstrap/backfill, exactly-one DB
  invariant и default-deny identity primitives.
- `20260807065032_learner_identity_workflows_progress_observer_ai.sql` — M3
  discovery/claim/merge/lifecycle, safe history/progress, observer и separate
  AI consent workflows.
- `20260807065038_learner_identity_legacy_contract_cleanup.sql` — финальный M4,
  применённый после двух roleless releases/dependency audit; RESTRICT cleanup
  helpers, enums и legacy Data API grants без удаления rows/tables.
- `20260809084500_learner_identity_auth_deferred_invariant_security.sql` — M5
  owner-only deferred exactly-one trigger boundary для реального GoTrue commit.
- `20260809090000_learner_identity_provisional_auth_metadata_sync.sql` — M6
  trusted two-phase provisional metadata sync с pristine/same-`xmin`
  fail-closed guard и защитой от late downgrade.
- `20260810035033_course_publication_catalog.sql` — применённый production
  Course catalog/publication slice: immutable revisions, private publication
  assets, independent clone/duplicate и closed admin RPC.
- `20260811154138_remove_divider_components.sql` — применённый production
  D1 cleanup: удалены 15 layout-only `divider` Components из 12 Lessons/
  4 Courses, позиции Components/Slides остались плотными, а CHECK
  запрещает пустой `type_key` и case-insensitive `divider`. Postflight
  сохранил 5 Course, 16 Lesson и 6 Slides; Component count стал 89,
  publication divider, empty Slides, density и exactly-one violations равны
  `0`. Это DB-state; он не является доказательством нового web deploy.
- `20260811231505_atomic_course_archive.sql` — применённый production A1:
  owner-scoped `archive_course`, shared Course row lock для
  archive/publish/open Run, immutable Lesson parent, четыре закрытых guard
  trigger, column-only browser UPDATE и запрет прямого Course/Lesson DELETE.
  Final checksum
  `7b43b023dd7692a39c1ab3702f0972c5d2252766a1093c3905b8c80fce24e8f8`;
  production apply завершился `COMMIT`, exact postflight/rollback probe —
  green. Verified backup имеет size `1146274`, mode `600`, `1427` restore
  entries и SHA-256
  `86610eac53eee82ddba0943247876f77c16ec52c076ca1f93945d64bd4900812`.
  Counts сохранились: `5` active/`0` archived Course, `16` Lessons,
  `90` Components, `6` Slides, `2` attachments/files, `2` Runs/records,
  `0` publications/revisions; invalid invariants — `0`. PostgREST видит RPC,
  anonymous HTTP закрыт с `401` / `42501`. Live snapshot
  `2026-08-12T00:22:27Z` имеет SHA-256
  `055b3c3ab47afc3c3db86d92c6c7530b3735841e34e4b475101ac96056d853ec`.
  Зависимый web UI/API развёрнут exact release PR #242; DB evidence и snapshot
  остаются неизменными.
- `20260812113000_educator_course_attestations.sql` — применённый production
  E1 database contract: `children | educators`, четыре RLS-protected
  attestation tables, closed browser ACL, `10` RPC и `8` guards/triggers.
  Migration SHA-256
  `f5aa1d3cee3e170f48e3ba2b0b3a564b31ad826b79e61efcaf7f342c3f2ff164`
  применена owner `supabase_admin` с `COMMIT` в `2026-08-12T02:35:45Z` после
  verified backup и rollback probe. Counts сохранились: `19` Account,
  `5` Course, `16` Lesson, `90` Component, `0` publication/revision; все
  Course backfilled как `children`. Functional rollback probe подтвердил
  privacy, stale SQLSTATE `40001` и server-derived `9/10 = 90%` award. Latest
  live snapshot `2026-08-12T02:53:14Z` имеет SHA-256
  `d96a357a8b55caa80a831b37b7e289c17025c572d79483d28ae7515b30bcf9e2`.
  Dependent web/API и demonstration bootstrap также развёрнуты production;
  release/functional evidence зафиксированы в разделе «Курсы» выше и в
  deployment runbook.
- `20260812150745_educator_course_governance_progress.sql` — current production
  forward migration, применённая с `COMMIT` в `2026-08-12T07:34:36Z`. Она добавляет
  `account.can_author_educator_courses`, `approved_revision_id`, immutable
  educator revision review, revision-scoped self-enrollment/Lesson completion,
  progress RPC и `100%` attestation gate. DB guards запрещают educator
  copy/duplicate, roster и LessonRun; existing approved educator publication и
  historical award получили derived backfill без tracked Account identifiers.
  Production postflight и snapshot evidence зафиксированы в
  [`docs/database/current-schema.md`](./database/current-schema.md) и deployment
  runbook; dependent web/API rollout также current production.
- `20260813063716_unify_heading_rich_text_components.sql` — applied production
  data migration без physical-schema change: authored `heading` устранены,
  безопасные adjacent пары объединены, privacy/Slide/placement boundaries и
  immutable publication revision сохранены. Exact backup/checksum/counts и
  coupled web-first rollout зафиксированы выше и в database/runbook docs.
- `20260813113041_fix_educator_course_content_guard_acl.sql` — applied
  production forward fix: переписывает только
  `guard_educator_course_content_mutation()` как `SECURITY INVOKER` с
  inlined audience/capability predicate, сохраняя закрытый ACL helper
  `educator_course_author_can_mutate(uuid)`. Исправление предназначено для
  authenticated direct DML Course Builder, включая сохранение Text Component;
  exact apply завершился `COMMIT`, postflight `12/12` и rollback-verified
  authenticated educator `rich_text` update прошли. E2A snapshot на этом stage
  `2026-08-13T11:43:48Z` имеет SHA-256
  `0a6eab37e1bbecc0084e281496346e5436fcbd1ac2b42e102e89951e71ff258e`.
- `20260814050347_account_profile_avatars.sql` — applied production AV1.
  AV1 добавляет exact-one `preset | custom` avatar state в `public.account`,
  private server-only Storage bucket `profile-avatars`, revision-aware setter и
  расширение Account auth context. Exact migration применена `COMMIT` после
  read-only sanity, verified backup и rollback rehearsal; browser Storage
  policies равны `0`, setter `EXECUTE` закрыт для
  `PUBLIC`/`anon`/`authenticated`. Current snapshot снят
  `2026-08-14T05:53:08Z`, SHA-256
  `3ca847164526568def44d2deed9a6b1d6cd1742e168462376b4f41fe6383ef97`.
- `20260816053117_communication_center.sql` — current production CC1 base.
  Exact migration применена с `COMMIT` после read-only sanity, verified
  backup и exact rollback rehearsal. Postflight подтвердил шесть RLS tables с
  закрытым raw browser ACL, 16 authenticated user RPC, два service-only
  producer RPC и два trigger; canonical counts не изменились. Current contract
  snapshot `2026-08-16T07:08:18Z` имеет SHA-256
  `1e8d7ac420be9deb5018f37a20db82d2bb84c7aafd7e3e3ba361f43795c02060`.
  Dependent Communication Center web/API развёрнут exact source `2efaa86`;
  Coolify/HTTP/auth/CSRF postflight пройден, UI current на `v2.shidao.ru`.
- `20260816072345_atomic_assistant_lesson_run_schedule.sql` — current
  production A2 schema head. Exact migration SHA-256
  `61ddca91ad28d60aac5ebdbbbb12e0d8e0ef2b8b52a0501de792d416052c6834`
  применена с `COMMIT` после PostgreSQL `15.8` sanity, verified backup и exact
  rollback rehearsal. Postflight подтвердил authenticated-only
  `SECURITY DEFINER` atomic guard с пустым `search_path`; counts и пустые CC1
  rows не изменились. Current contract snapshot `2026-08-16T07:42:38Z` имеет
  SHA-256
  `a91aefb693fc5857e1ae921e7226bc688230d0dd3c7e9373197c1006b4314a7d`,
  authenticated user RPC total — `17`. Dependent Communication Center web/API
  rollout и production boundary postflight завершены exact source `2efaa86`.

Источники истины для текущего состояния:

1. [`docs/database/current-schema.md`](./database/current-schema.md)
2. [`supabase/schema/current-schema.sql`](../supabase/schema/current-schema.sql)
   после refresh конкретного verified `expand` или `contract` stage.

Старые migrations не переписываются и не удаляются. Все дальнейшие изменения
выполняются только новыми forward migrations после read-only sanity check
целевой базы.

Known ordering debt: DB constraints гарантируют positive+unique Lesson/Component
positions, а плотность поддерживают текущие service/delete/reorder paths.
Обычный append пока вычисляет следующую позицию перед direct INSERT, поэтому
конкурентные добавления могут столкнуться, а произвольный direct INSERT —
создать gap. Сериализация append относится к следующему integrity hardening,
не к возврату Step.

## 7. Карта реализации

| Область                              | Каноническое место                                                                                                                                                                                                                                                                |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Course/Lesson contracts              | `src/modules/course-builder/contracts.ts`                                                                                                                                                                                                                                         |
| Domain/read models                   | `src/modules/course-builder/domain.ts`                                                                                                                                                                                                                                            |
| Application service                  | `src/modules/course-builder/service.ts`                                                                                                                                                                                                                                           |
| Supabase repository                  | `src/modules/course-builder/repository.ts`                                                                                                                                                                                                                                        |
| Storage adapter                      | `src/modules/course-builder/storage.ts`                                                                                                                                                                                                                                           |
| Component registry                   | `src/modules/course-builder/registry/contracts.ts`                                                                                                                                                                                                                                |
| MCP tools/server                     | `src/modules/course-builder/mcp/`                                                                                                                                                                                                                                                 |
| AI provider adapter                  | `src/modules/ai/routerai.ts`                                                                                                                                                                                                                                                      |
| AI provider transport                | `src/modules/ai/lesson-provider-contracts.ts`                                                                                                                                                                                                                                     |
| AI request/contracts                 | `src/modules/ai/course-builder-contracts.ts`                                                                                                                                                                                                                                      |
| AI context/service                   | `src/modules/ai/course-context.ts`, `src/modules/ai/course-builder-service.ts`, `src/modules/ai/system-assistant-contracts.ts`, `src/modules/ai/system-assistant-service.ts`                                                                                                      |
| AI API/error boundary                | `src/app/api/v2/courses/[courseId]/ai-*/`, compatibility `assistant/`, `src/app/api/v2/assistant/`, `src/modules/ai/server-context.ts`                                                                                                                                            |
| AI UI                                | `src/components/course-builder/ai-course-plan-dialog.tsx`, `ai-lesson-plan-dialog.tsx`, `src/components/assistant/`, `src/app/styles/system-assistant.css`                                                                                                                        |
| LessonRun domain/contracts           | `src/modules/lesson-runs/domain.ts`, `contracts.ts`                                                                                                                                                                                                                               |
| LessonRun service/repository         | `src/modules/lesson-runs/service.ts`, `repository.ts`, `server-context.ts`                                                                                                                                                                                                        |
| LessonRun API                        | `src/app/api/v2/lesson-runs/`, `learner-profiles/`, `learner-groups/`, Course/Lesson audience/history/runs routes                                                                                                                                                                 |
| LessonRun UI                         | `src/components/lesson-runs/`                                                                                                                                                                                                                                                     |
| Learner identity contracts/service   | `src/modules/learner-identity/`                                                                                                                                                                                                                                                   |
| Learner identity UI/routes           | `src/app/(app)/profile/`, `src/components/profile/`, `src/components/learner-identity/`, `/profile`, `/students?tab=observing`, `/identity/invitations/*`; `/learning-profile`, `/settings/*` и `/observing` — compatibility redirects                                            |
| Account profile/avatar UI            | `src/components/account/`, `src/components/account/avatar-settings-form.tsx`, `src/lib/navigation/profile-nav.ts`                                                                                                                                                                 |
| Account avatar API/delivery          | `src/app/api/settings/profile/avatar/`, `src/lib/account-avatar.ts`, `src/lib/server/profile-avatar-delivery.ts`, `src/lib/server/profile-avatar-image.ts`, `src/lib/server/profile-avatar-storage.ts`, `src/lib/server/profile-avatar-reconciliation.ts`                         |
| Cross-surface image delivery         | `next.config.ts`, `src/lib/__tests__/image-delivery-contract.test.ts`, `docs/architecture/image-delivery.md`                                                                                                                                                                      |
| Learner identity access doc          | `docs/architecture/learner-identity-access-model.md`                                                                                                                                                                                                                              |
| Consented AI safe history            | `src/modules/ai/shared-history.ts`, `course-context.ts`, `course-builder-service.ts`                                                                                                                                                                                              |
| Historical identity execution prompt | `docs/v2/LEARNER_IDENTITY_COMPLETION_PROMPT.md`                                                                                                                                                                                                                                   |
| Course browser client                | `src/components/course-builder/course-builder-client.ts`                                                                                                                                                                                                                          |
| Course publication domain/service    | `src/modules/course-publications/`                                                                                                                                                                                                                                                |
| Course attestation domain/API        | `src/modules/course-attestations/`, `src/app/api/v2/course-catalog/[publicationId]/attestation/`, `src/app/api/v2/courses/[courseId]/attestation/`, `src/app/api/v2/me/attestations/`                                                                                             |
| Course consumption progress          | `src/modules/course-consumption/`, `src/app/api/v2/course-catalog/[publicationId]/progress/`                                                                                                                                                                                      |
| Course catalog/publication API       | `src/app/api/v2/course-catalog/`, `src/app/api/v2/courses/[courseId]/publication/`, `duplicate/`                                                                                                                                                                                  |
| Course catalog/owned UI              | `src/components/course-builder/courses-index.tsx`, `owned-courses-panel.tsx`, `course-catalog-panel.tsx`, `course-actions.tsx`, `src/components/ui/segmented-control.tsx`                                                                                                         |
| Published Course workspace           | `src/app/(app)/courses/catalog/[publicationId]/`, `src/components/course-builder/published-course-workspace.tsx`, `published-course-progress-queue.ts`                                                                                                                            |
| New Course flow                      | `src/components/course-builder/new-course-form.tsx`                                                                                                                                                                                                                               |
| Course workspace                     | `src/components/course-builder/course-workspace.tsx`                                                                                                                                                                                                                              |
| Course/Lesson navigation             | `src/components/course-builder/course-workspace-navigation.ts`                                                                                                                                                                                                                    |
| Workspace tabs/materials             | `src/components/ui/workspace-tabs.tsx`, `src/components/course-builder/course-materials-panel.tsx`, `src/components/course-builder/course-materials.ts`, `src/components/course-builder/course-material-file.ts`, `src/modules/course-builder/registry/stored-file-references.ts` |
| Lesson editor/Slides                 | `src/components/course-builder/lesson-authoring-workspace.tsx`                                                                                                                                                                                                                    |
| Component picker/editors/renderers   | `src/components/course-builder/component-picker-preview.tsx`, `component-payload-editor.tsx`, `component-renderers.tsx`                                                                                                                                                           |
| Fullscreen preview                   | `src/components/course-builder/student-screen-preview.tsx`                                                                                                                                                                                                                        |
| Account Schedule                     | `src/app/(app)/(teacher-required)/schedule/`, `src/components/teaching-hub/schedule-workspace.tsx`, `src/components/teaching-hub/schedule-date-picker.tsx`, `src/components/teaching-hub/schedule-period.ts`                                                                      |
| Account Students                     | `src/app/(app)/(teacher-required)/students/`, `src/components/teaching-hub/students-workspace.tsx`, `src/components/teaching-hub/student-directory-table.tsx`                                                                                                                     |
| Account Store demo                   | `src/app/(app)/store/`, `src/components/store/`, `src/app/styles/store.css`, `public/store/products/`, `docs/product/store-demo.md`                                                                                                                                               |
| Legacy-named Account route boundary  | `src/app/(app)/(teacher-required)/layout.tsx`, `src/lib/server/access-guards.ts`                                                                                                                                                                                                  |
| V2 API routes                        | `src/app/api/v2/`                                                                                                                                                                                                                                                                 |
| Standalone historical demo           | `src/app/demo/`, `public/og-demo-v2.png`                                                                                                                                                                                                                                          |
| Host boundary                        | `src/middleware.ts`, `src/lib/deployment-access.ts`                                                                                                                                                                                                                               |
| Auth/session                         | `src/lib/auth.ts`, `src/lib/server/`                                                                                                                                                                                                                                              |
| Current schema                       | `supabase/schema/current-schema.sql`                                                                                                                                                                                                                                              |
| Forward history                      | `supabase/migrations/`                                                                                                                                                                                                                                                            |

## 8. Активные пользовательские маршруты

```text
/
/login
/join
/join/check-email
/forgot-password
/reset-password
/auth/confirm
/identity/invitations/[invitationId]
/onboarding
/schedule                         # любой authenticated Account
/students                         # любой authenticated Account
/store                            # client-state UI-only demo для любого Account
/courses
/courses/new
/courses/[courseId]
/courses/catalog/[publicationId]     # отдельный published learning workspace
/courses/[courseId]/student-preview
/profile
/learning-profile                 # compatibility redirect → /profile
/observing                        # compatibility redirect → /students?tab=observing
/settings                         # compatibility redirect → /profile?tab=settings
/settings/profile                 # compatibility redirect → /profile?tab=settings
/settings/security                # compatibility redirect → /profile?tab=settings#security
/settings/observers               # compatibility redirect → /profile?tab=observers
```

V2 API находится под `/api/v2/` и включает `learner-profiles`, Course
`audience|history`, Lesson `runs|history` и `lesson-runs` schedule/lifecycle
routes. Canonical learner slice сохраняет эти URL и product RPC names, меняя их
backing projection на `teacher_learner`. Все используют per-request actor,
application service и user JWT/RLS; старые dashboard/methodology/group/
scheduled-lesson routes не поддерживаются как compatibility URL.

Current identity API добавляет namespaces `me/learning-profile`,
`learner-directory`, `learner-connections`, `identity-invitations`,
`learner-merges`, `learner-credential-recovery`, `observers`, `observations`,
`ai-consents` и recipient-bound email acceptance routes. Sensitive admin RPC
вызываются только server adapter; browser DTO проходят strict output schemas и
не содержат Auth IDs, token/email digests, internal email или credential state.

Current deployed catalog API добавляет authenticated
`GET /api/v2/course-catalog`, detail по publication ID, `POST .../copy`,
а также Course-owned `publication` и `duplicate` routes. Все elevated
table/Storage operations остаются за server context после обычной
Account/session authorization.

Current production consumption surface дополнительно включает separate
published route `/courses/catalog/[publicationId]`. Его API обслуживает
approved-revision-only educator detail, `GET|PUT .../progress` и published
`GET|POST .../attestation`; owner definition использует `GET|PUT
/api/v2/courses/[courseId]/attestation`. Эти routes развёрнуты вместе с coupled
E2 migration/web rollout.

Schedule reads ограничены 500 Runs на окно. Teacher Lesson/Course/Profile
history возвращает последние 100 элементов; Course read всегда включает
открытые Runs. Self/observer safe history имеет opaque cursor pagination до 50
items. Длинные `IN` hydration-запросы разбиваются на bounded batches.

Текущий production AI-срез добавляет authenticated `POST` routes `ai-plan`,
`ai-apply`, `ai-lesson-plan`, `ai-lesson-apply` и `assistant` под
`/api/v2/courses/[courseId]/`. Planning/chat routes вызывают provider; apply
routes только валидируют preview и выполняют существующие application commands.

Deployed System Assistant добавляет authenticated
`POST /api/v2/assistant` и `POST /api/v2/assistant/actions/apply`. Они не
заменяют Course/Lesson planning routes. В release `b7c6cfe` первый route отвечал
или возвращал подтверждаемое создание Course draft/пустой Lesson, а второй после
explicit Apply вызывал обычный Course Builder service. Текущий conversational
follow-up расширяет strict allowlist наполненной новой Lesson, дополнением
открытой Lesson и удалением exact Lesson, сохраняя тот же preview/confirmation/
canonical-service boundary. Follow-up `246cf49` развёрнут и прошёл
running-image/HTTP/guest postflight; authenticated production action postflight
пока не выполнен.

Дополнительные project surfaces:

- `brand.shidao.ru` → brand reference;
- `model.shidao.ru` → публичное объяснение модели;
- `demo.shidao.ru` → изолированный исторический UI-прототип с clean-path
  навигацией (`/`, `/students`, `/courses`, Course/Lesson и `/lesson/live`).

Demo не импортируется активными Course/Lesson routes, не вызывает application
services/API и не сохраняет изменения. Его локальные Step/Methodology,
schedule/group и AI fixtures не входят в текущую V2-модель и не могут
использоваться как acceptance evidence.

Current production release закрывает прежний host/CSRF debt: allowlist
принимает только canonical hosts, non-root `brand`/`model` и unknown hosts
получают 421, а unsafe V2 requests допускают только exact app Origin. Это
подтверждено deployed HTTP/browser regression, а не считается свойством только
proxy isolation.

## 9. Проверка текущего состояния

Стандартный локальный набор:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

Дополнительно:

```bash
npm run test:browser
npm run test:browser:ci
npm run format:check
npm run mcp:course-builder
./scripts/db-identity-tests.sh
./scripts/db-identity-concurrency-tests.sh
```

Current identity release прошёл fresh migration chain, upgrade от previous
production shape, RLS/ACL actor matrix, true multi-session
signup/claim/merge/reset concurrency, strict output-injection tests и browser
matrix discovery/child activation/merge/archive/observer/self/AI consent.
Повторный final gate дал 321/321 unit/API tests, 19/19 strict browser tests и
зелёный DB acceptance на M1–M6 clone. Production DB/GoTrue и authenticated
browser postflight exact functional SHA зафиксированы выше. Наличие scripts само
по себе acceptance result не заменяет.

`test:browser` допускает локальный skip без browser, а `test:browser:ci`
является строгим production-mode gate.

Полный Profile/avatar application release
`4462da2248dd97bf6ab5c0a35f9a781844473874` прошёл `640/640` unit/API,
`24/24` strict production-mode browser scenarios, typecheck, test compile,
repository-wide format check и production build внутри browser gate. Profile
acceptance проверяет canonical `/profile`, пять URL-addressable вкладок,
compatibility redirects с query/hash, единый opaque-white surface contract,
один H1 и честные метрики вкладок. Avatar acceptance подтверждает отсутствие
preset grid до открытия modal, прямую загрузку всех `20/20` static WebP без
`/_next/image`, explicit Save для preset и custom preview, Cancel/Escape с
возвратом фокуса и mobile layout `375 × 812` без document-level overflow.

Это no-`/_next/image` утверждение относится только к exact historical release
`4462da2248dd97bf6ab5c0a35f9a781844473874`. Current source / next production
намеренно переводит public presets на responsive `/_next/image`, но оставляет
private custom avatar за authenticated direct custom loader; rollout evidence
для нового delivery contract ещё не заявлено.

Для базового LessonRun slice локально подтверждены:

- typecheck и lint;
- 256/256 unit/contract tests;
- production build;
- 9/9 browser smoke с mock Supabase, включая новые пустые
  `/schedule`/`students` и Course history/audience reads;
- isolated PostgreSQL 16 apply и owner flow
  `audience → schedule → reschedule → complete → repeat → cancel → delete`;
- после удаления Lesson 3/3 finalized LearningRecord сохранились, draft rows
  удалились; cross-owner, empty-audience, stale reschedule, empty completion и
  cancel-before-start paths были отклонены; authenticated Profile DELETE
  отсутствует.

Это acceptance LessonRun release и isolated clone. Production migration
дополнительно применена 7 августа 2026 года: четыре таблицы и шесть RPC видны
PostgREST, RLS/ACL прошли проверку, owner workflow прошёл внутри rollback-probe,
а cross-account probe увидел 0 чужих строк. Coolify deployment точного SHA
`fa91371` завершился за 224 секунды; deployed browser postflight подтвердил
реальные Course, пустые Schedule/Students, Course audience/run/history UI и
чистую console без создания тестовых данных.

Текущий browser-smoke helper использует актуальную AES-GCM app-session с
Supabase access/refresh tokens. Строгий gate сам собирает production-приложение
против локального mock Supabase, поэтому build-time `NEXT_PUBLIC_*` и runtime
конфигурация совпадают и тест не обращается к рабочей базе. Воспроизводимый
результат `npm run test:browser:ci` для release `fea7f80`: 8 сценариев pass,
включая teacher-навигацию Schedule → Students, мобильное меню
«Расписание / Ученики / Курсы», авторизованный переход Course → Lesson →
backlink обратно к Course, computed visual contract и mobile 375 px без
document-level overflow.

Repository-wide `npm run format:check` проходит. Для historical
navigation/catalog release `bafc984` подтверждены `326/326` unit tests, `19/19`
production-mode browser scenarios и `git diff --check`.

Для Schedule presentation release локально подтверждены
typecheck, lint, format check, `git diff --check`, `411/411` unit/contract tests
и `21/21` strict production-mode browser scenarios. Browser gate собрал
production app, проверил прозрачный toolbar, реальные week/month API windows,
непустую таблицу, переключение на карточки и mobile 375 px без document-level
overflow. Coolify webhook deployment exact functional SHA `587bb21` завершён
Success за 2 минуты 33 секунды, running reference совпадает; authenticated
production browser postflight остаётся отдельным незавершённым gate.

Для deployed Students/Courses controls и Schedule cleanup slice локально подтверждены
typecheck, lint, format check, `git diff --check`, `439/439` unit/e2e tests и
`22/22` strict production-mode browser scenarios. Browser gate проверил
новую Schedule microcopy, calendar-plus Action и прямой переход от controls к
непустой таблице/карточкам без summary-strip; прозрачные Students/Courses
toolbars, единый Students list с inline status, Course disclosure/native
filters, reset, Escape с возвратом focus, icon-only cards/table и mobile 375 px
без document-level overflow. Schema/migration не менялись; slice развёрнут в
production release PR #242.

Для deployed Schedule dense-table/control refinement локально
подтверждены typecheck, lint, format check, `git diff --check`, `448/448`
unit/e2e tests и `22/22` strict production-mode browser scenarios. Browser
gate измерил desktop date control ровно 300 px и фактический `.88rem/400`,
компактные rails таблицы, чёрные data-row text/icons, точные значения даты
`Среда · 12 авг` и времени `12:00 · 60 мин`, header таблицы ровно 40 px вместе
с divider 1 px,
белые surface без outer border/blur, однострочный ellipsis,
необрезанный portal-menu вертикального троеточия с keyboard focus restore,
flat primary/active navigation, bordered white secondary, borderless menu items
и отсутствие document-level overflow на 375/320 px. API/schema/migrations не
менялись; slice развёрнут в production release PR #242.

Production rollout PR #242 завершён на merge commit
`84ffefecda99d3b0a9da82bf1eaf8ce76d9c6ea1`. Coolify deployment
`l56b73xj6mfblc0ni8u7yf2g` для application `g9x4d9zn60jv35r7zf0xl6xj`
создан webhook-ом (`pull_request_id=0`, `webhook=true`, `api=false`) в
`2026-08-12 00:34:51Z` и завершён в `00:38:42Z`. Running container использует
exact `SOURCE_COMMIT`/image commit
`84ffefecda99d3b0a9da82bf1eaf8ce76d9c6ea1`, image ID
`sha256:e4a22e34c1ed1bd8b37db8087b6bbafac693414ea357798e3ddf75e3c3684d57`,
restart count `0`; второго active production deployment нет. HTTP postflight:
V2 `/login` и `/robots.txt` — `200`, Guest `/courses` — `307` на login;
landing root — `200`, landing `/login` и API — `503`; demo root и `/students`
— `200`; brand/model deep route — `421`. Guest `DELETE` fake Course UUID
возвращает `403` без Origin, `403` с неверным Origin и `401` с exact V2 Origin,
подтверждая CSRF-before-auth boundary без data mutation. `X-Robots-Tag` —
`noindex, nofollow, noarchive`; release error-log filter пуст.

Для C1 Course publication/catalog release локально подтверждены
`381/381` unit tests, `19/19` строгих production-mode browser scenarios,
typecheck, lint, format check и production build. Schema parser прочитал
forward migration (`90` statements) и синхронный current-schema snapshot
(`1091` statements), их core projection совпадает. Изолированный PostgreSQL
проверил null material refs, forged-payload rejection, stale idempotent detach,
publication clocks, active→non-active unpublish, inactive-owner denial,
5 GiB quota boundary и bounded facets. Forward migration применена к рабочей
ShiDao DB после full-format backup; counts `19/5/13/80` сохранились, RLS/ACL,
private bucket, service-role catalog RPC и PostgREST cache проверены. Coolify
deployment `891` завершился `finished`: exact SHA `9a553085487c...`, image
digest `sha256:ad6274440d57972420978cd26a9fb46ee2063235f5a435d9be32f9f5a0f4c457`,
restart count `0`. HTTP postflight подтвердил V2 login `200`, guest Course/
catalog `307`, guest catalog API `401`, cross-origin publication `403`,
same-origin guest `401`, landing `/login` `503`, demo root `200` и ноль новых
runtime warning/error. Production authenticated publish/copy mutation не
создавалась: её выполняет владелец на реальном Course через UI.

На application release `fea7f80` подтверждены typecheck, lint, 183 unit tests,
production build и строгие 8/8 browser smoke. Coolify deployment точного SHA
завершился со статусом Success; deployed postflight подтвердил guest redirect
`/schedule` → `/login`, teacher-only меню «Расписание / Ученики / Курсы», обе
новые страницы, чтение реальных Course summaries, прозрачный page header,
плоский фон `#f5f1e8` и переход обратно в `/courses`.

Release `0276aed` прошёл typecheck, lint, 218 unit/contract tests, production
build и строгие 8/8 browser smoke. Coolify развернул точный SHA; runtime check
подтвердил наличие закрытого key и model
`google/gemini-2.5-flash-lite`. Bounded provider smoke вернул Course outline из
трёх Lessons за 2,8 с и Lesson из шести canonical Component types за 3,8 с.
Authenticated `v2.shidao.ru` smoke получил ответ assistant примерно за 7,3 с и
Lesson preview со всеми шестью Component types примерно за 8,3 с. Apply не
нажимался: число Lessons до и после проверки осталось равным 1. Live Apply и
искусственно вызванный provider-error fallback не выполнялись на пользовательских
данных; их validation, stale protection и compensation покрыты automated tests.

Release `7021801` прошёл typecheck, lint, 224 unit/contract tests, production
build и строгие 9/9 browser smoke. Coolify развернул exact SHA со статусом
Success. HTTP postflight подтвердил demo root/deep-link `200` без `Location`,
`image/png` для OG asset, `robots.txt`/noindex, read-only `405`, сохранность
landing `503` и V2 guest redirect. В browser profile с реально закэшированным
старым `308` вход `/?restored=1` очистил cache и заменил адрес на `/`; обычный
root после этого не редиректит. Интерактивно проверены «Расписание / Ученики /
Курсы», reload `/courses`, прямой Lesson deep link и его reload; browser console
не содержит warning/error.

Release `fa91371` прошёл typecheck, lint, 256 unit/contract tests, production
build и строгие 9/9 browser smoke до публикации. Production ShiDao migration
применена транзакционно и проверена через RLS/ACL, rollback owner/cross-account
probe и authenticated PostgREST OpenAPI. Coolify развернул exact SHA со статусом
`finished`; HTTP postflight сохранил landing/demo/guest/noindex boundaries, а
authenticated browser postflight подтвердил реальные `/courses`, `/schedule`,
`/students`, Course audience, назначение и историю без сохранения тестовых
данных. Browser console не содержит warning/error.

Release `9393080` прошёл typecheck, lint, 270/270 unit/contract tests,
production build и строгие 10/10 browser smoke. Миграция групп и смешанной
аудитории успешно применена к isolated PostgreSQL 16 и production ShiDao DB;
проверены ownership, RLS/ACL, лимит 200 уникальных учеников, дедупликация
пересекающихся групп, неизменность уже назначенной аудитории, мягкая архивация
ученика и сохранность finalized LearningRecord. Production rollback-probe
подтвердил authenticated CRUD без остаточных записей, а PostgREST OpenAPI и
relationship queries увидели все три новые таблицы. Coolify запустил exact image
`939308070323b6e920a870b503a2911dd32c654a` без restart; authenticated browser
прочитал каталог, формы ученика/группы и mixed Course audience без console или
runtime errors и без изменения пользовательских данных.

Release `757044c` прошёл typecheck, lint, 275/275 unit/contract tests,
production build и строгие 10/10 browser smoke. Canonical learner migration
проверена на isolated PostgreSQL, включая сохранение исторического
`learning_record.updated_at`, а затем применена транзакционно к production
PostgreSQL 15.8 от имени владельца таблиц. Перед изменением создан backup
`/root/shidao-db-backups/shidao-public-before-canonical-learner-20260807T042327Z.dump`;
SHA-256 применённого migration file —
`5cadc8e09834151dff0a2c05f3c24dca5a2c1d94fed9a3224bfb7e7ad43494b2`.
Postflight подтвердил `teacher_learner`, nullable unique
`learner_profile.account_id`, обязательный
`learning_record.recorded_by_account_id`, backfill существующей связи 1:1,
RLS/ACL и недоступность чужой relation/history для второго JWT. PostgREST
увидел новую relation и canonical profile shape. Coolify завершил deployment и
запустил exact image
`g9x4d9zn60jv35r7zf0xl6xj:757044cf6f8c70aca329e52d48915f6d5b5b5844`.
Authenticated browser прочитал реального ученика и группу, переключил обе
вкладки и открыл формы управления без сохранения данных; console warning/error
не обнаружены.

## 10. Правило обновления этого документа

После каждого законченного vertical slice агент обязан:

1. перенести реализованные пункты из roadmap в этот документ;
2. обновить карту реализации, routes, tools и schema state;
3. отметить честные ограничения и заглушки;
4. обновить связанные канонические документы;
5. не описывать запланированную возможность в прошедшем времени до проверки в
   deployed или согласованном тестовом окружении.
