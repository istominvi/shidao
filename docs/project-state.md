# Текущее состояние ShiDao V2

**Статус:** главный входной документ для разработки
**Актуально на:** 13 августа 2026 года
**Активная ветка:** `main`
**Рабочее приложение:** `https://v2.shidao.ru`
**Текущий deployed application source / последний release gate:**
`9e66fb548bef176486673149f466b269fd436b21`
(`575/575` unit/API, `23/23` strict production-mode browser scenarios,
typecheck, lint, format и production build)
**Исторический functional E2 baseline:**
`22b486a7163453019d9720cb4fe0f36ed7c0228d`

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
пороге `80%`. Current snapshot снят `2026-08-12T07:46:11Z`, SHA-256
`a34a5a5919ea406050a5c0cb7f39310d1a9e807725e608166f63becb8f2260a4`, `71`
schema-contract tests green. Зависимый E2 web/API source развёрнут из exact
functional baseline `22b486a7163453019d9720cb4fe0f36ed7c0228d`: deployment завершён
`2026-08-12T07:58:39Z`, image ID
`sha256:214e954aed0355c1881ea778e65dcb7f4c4cabcde4d7ac2e3f6022322bd8e027`,
`SOURCE_COMMIT` exact, restart count `0`, HTTP host/CSRF/auth postflight green.

**Current production contract stage:** реализована и развёрнута полная roleless
learner identity / observer программа. Migrations M1–M6 применены к production
после четырёх проверенных backup и добавили atomic exactly-one
Account/Profile bootstrap, Account login/PIN
boundary, safe discovery/recipient-bound claim и child activation, physical
merge/lineage, archive/restore, self/observer history/progress, subject erasure
и consented cross-provider AI. Application/API/UI находятся в
`src/modules/learner-identity/`, `src/components/learner-identity/` и новых
routes `/learning-profile`, `/students?tab=observing`, `/settings/observers`,
`/identity/invitations/[invitationId]`; прежний `/observing` сохранён только как
protected compatibility redirect. Security slice также закрывает production
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
[`docs/product/store-demo.md`](./product/store-demo.md). Current source gate:
typecheck, lint, format, production build, `575/575` unit/API и `23/23` strict
production-mode browser scenarios, включая Store deep link, cart/checkout,
focus return и mobile no-overflow.

Authenticated production browser postflight подтвердил roleless navigation и
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

**Current source component-authoring refinement (next production deployment):**
runtime registry по-прежнему поддерживает все 20 Component types, а ручная
palette показывает 19 создаваемых карточек с коротким назначением и статическим
неинтерактивным мини-образцом. Отдельный `heading` скрыт только из ручного
выбора, но старые Components этого типа продолжают рендериться и редактироваться.
`rich_text` с тем же schema version `1` принимает необязательный plain-text
`title` перед обязательным `content`; прежние payload без `title` остаются
валидными. Образцы не используют production renderer и не создают вложенные
controls. Выбор типа переключает тот же dialog на локальный draft: persisted
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
с canonical `.88rem/400` типографикой. API routes, physical DB schema,
migrations и authored order не меняются; production rollout/postflight ещё не
заявлены.

**Current source page-header action-button refinement (next production
deployment):** белые secondary actions внутри `AppPageHeader` сохраняют общий
внешний размер `40 px` и border `1 px`, поэтому внутренняя белая область имеет
высоту `38 px`. Рамка использует тот же 50%-black token
`rgba(20, 20, 20, 0.5)`, что и подзаголовок, а
`background-clip: padding-box` не рисует белую заливку под полупрозрачным
пикселем: цвет рамки смешивается с фоном страницы. Lesson action «Удалить»
переходит с `ghost` на тот же bordered secondary geometry, сохраняя красные
текст/иконку и confirmation flow. Scope ограничен action-секцией заголовка;
menu items и обычные ghost controls остаются borderless. Это UI-only source
change без API, schema, migration или реализации выбора фона Course;
локально подтверждены typecheck, lint, format, production build, `578/578`
unit/API и `23/23` strict production-mode browser scenarios. Production
rollout/postflight ещё не заявлены.

**Current source WorkspaceTabs fractional-baseline refinement (next production
deployment):** общий разделитель под вкладками сохраняет визуальную толщину
`1.5 px`, но больше не полагается на дробную высоту paint-box, которую Chromium
может растеризовать как целый пиксель. Псевдоэлемент рисуется высотой `3 px` и
сжимается по вертикали через `scaleY(0.5)` от нижней грани; итоговая толщина
остаётся `1.5 px`, линия не сдвигается относительно контента, а 4 px active
segment продолжает лежать над ней. Изменение действует через единый
`WorkspaceTabs` на всех его product consumers, не меняет 40 px tab geometry,
horizontal scroll, ARIA/keyboard contract, API, schema или migrations.
Локально подтверждены typecheck, lint, format, production build, `578/578`
unit/API и `23/23` strict production-mode browser scenarios. Production
rollout/postflight ещё не заявлены.

**Current source contextual ActionMenu refinement (next production
deployment):** все контекстные меню, открываемые горизонтальным или вертикальным
троеточием в Course, Lesson rows, Schedule и Students, используют один
канонический surface contract: `--product-context-menu-surface: #fff`, общий
12 px radius и `--product-context-menu-shadow: 0 18px 46px rgba(20, 20, 20,
0.18)`. У панели нет обычной рамки, а `separatorBefore`, визуальный divider и
его DOM/ARIA-узел удалены из shared `ActionMenu`, поэтому отдельный consumer не
может вернуть разделитель. Порядок и состав действий, 40 px menu items,
destructive/disabled states, portal positioning, keyboard navigation и focus
restore не меняются. Filter/calendar popovers, Account menu и native `select`
не являются contextual `ActionMenu` и этим scoped slice не затрагиваются; API,
schema и migrations также не меняются. Локально подтверждены typecheck, lint,
format, production build, `579/579` unit/API и `23/23` strict production-mode
browser scenarios. Production rollout/postflight ещё не заявлены.

**Current production application evidence:** running container
`g9x4d9zn60jv35r7zf0xl6xj-115759805389` использует exact image tag
`9e66fb548bef176486673149f466b269fd436b21` и image ID
`sha256:8b2eb3609531ba08fca946dde633dc1946821ade3ec1b408be09bafd4ef172d7`.
Container запущен `2026-08-12T12:00:37.589103216Z`, имеет restart count `0` и
остаётся running. Read-only HTTP postflight подтвердил `/login` `200`,
`/robots.txt` `200` с `Disallow: /` и guest `/store` `307` в `/login`. Store,
page-header/directory refinements, общий table/authoring polish и Course table
overflow fix входят в этот exact source; database schema/migrations ими не
менялись.

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
внутри popover. Белая таблица не имеет внешней обводки, её светло-серая строка
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
без blur. Active V2 buttons и header controls используют единый flat-contract
`40 px / 12 px / .88rem / 400`: primary не имеет блика, подъёма или тени,
иконки полностью непрозрачны и наследуют контрастный цвет, белые кнопки
сохраняют тонкую серую рамку, а пункты меню остаются без неё. Authenticated
`/settings/profile`, `/settings/security` и `/settings/observers` теперь
переиспользуют тот же `course-demo-shell`, demo TopNav, canonical side
navigation и shared Button variants; прежние raw action-button forks из
Profile/Security удалены, включая secondary и destructive semantics. Landing,
Auth и полноэкранный Student Screen намеренно не входят в этот selector scope.
Это UI-only изменение: LessonRun API, System Assistant boundary, schema и
migrations не меняются; assistant по-прежнему получает только опорную локальную
дату, а не всё видимое окно. Последняя корректировка cell/action spacing
развёрнута в production release PR #242; exact rollout evidence приведён ниже.

**Current production Schedule micro-polish:** подзаголовок
«Здесь все назначенные уроки за выбранный период» больше не заканчивается
точкой. В sortable header только активная колонка показывает одну стрелку
текущего направления; у остальных колонок индикатора нет. В трёхпунктовом
меню ожидающего Run удалён разделитель между «Изменить» и «Отменить», а радиус
hover-подсветки каждого пункта уменьшен до канонических 8 px — как у выбранной
кнопки переключателя вида. Это UI-only изменение без API, schema или migration.

**Current deployed Students/Courses controls slice:** панели
управления `/students` и обеих вкладок `/courses` больше не создают отдельную
toolbar-card: компактные 40 px controls расположены прямо на page background в
том же визуальном контракте, что Schedule. На Students состояния «Активные /
Архив / Ожидают ответа» больше не переключают отдельные проекции: активные
профили, архивные relations и исходящие pending-запросы находятся в одной
таблице с inline status/text и contextual actions. Подзаголовок раздела —
«Ученики и группы, с которыми вы работаете или за которыми наблюдаете». Поиск
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
content/sort controls не добавлены. Подзаголовок `/courses` — «Создавайте свои
курсы с нуля или добавляйте готовые из каталога» без завершающей точки.

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
#242, а fixed-layout Course overflow fix — в текущем exact source `9e66fb5`.

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
«Написать сообщение» видим, но disabled и явно помечен как недоступный:
communication layer в current product не заявляется. Archived profile и
pending request получают свои restore/permanent-delete или cancel actions.
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

**Current System Assistant conversational action slice:** реализован один
глобальный floating widget «ИИ» внутри protected `(app)` layout. Он доступен на
Account surfaces, сохраняет диалог только в React state до reload/явного сброса
и получает не DOM/URL, а строгий allowlisted page context. Server-side
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
  содержит «Расписание / Ученики / Курсы / Магазин»; «Учебный профиль» остаётся в
  меню Account справа перед «Настройки / Выход», а observer projection —
  третьей вкладкой «Наблюдение» внутри «Ученики».
- Существующая app-session поддерживает глобальную и пользовательскую
  инвалидизацию; destructive identity/credential flows дополнительно требуют
  recent reauthentication из sealed session.

### Магазин

- **Current production:** `/store` — Account-level UI-only
  demo учебного магазина. Каталог содержит учебники и методические книги,
  прописи и тетради, карточки, канцелярию и обучающие игры. Категории, поиск,
  audience/price/availability filters, сортировка и режимы «Карточки / Таблица»
  вычисляются над типизированными fixtures в application code.
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
- Вкладка **Мои** сохраняет поиск по открытым Course fields,
  динамические фильтры по предмету/уровню/наполнению, сортировку и
  режимы «Карточки / Таблица». В current production эти controls собраны в одну
  компактную строку прямо на page background: три категориальных поля находятся
  в disclosure «Фильтры», view выбирается icon-only segmented control, а
  видимый счётчик результатов не занимает место между ними.
  Приватные пожелания преподавателя в поиск не входят.
- **Каталог** имеет server-side audience/search/subject/level filtering.
  Карточка и строка списка показывают компактные публичные метаданные, автора и
  counts; Lesson outline, описание и материалы открываются в отдельном
  published workspace, а не разворачиваются внутри списка. Current production
  показывает search и реальные subject/level facets без внешней toolbar-card,
  повторного заголовка/пояснения и видимого count. Presentation переключается
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
- Course header следует demo-контракту: sticky shell высотой 68 px, сплошная
  белая поверхность без blur, радиус 20 px и контролы 40 px с радиусом 12 px.
  Персональное dropdown-меню также использует непрозрачный белый фон.
- Один `AppPageHeader` задаёт прозрачную заголовочную секцию, единый H1 с
  максимумом 48 px на desktop и 32 px на mobile, подзаголовок, optional
  backlink и правую action-секцию для `/courses`, `/students`, `/schedule`, Course
  и Lesson. Контейнер имеет минимальную высоту 200 px, растёт по контенту, а
  actions вертикально центрированы. Заголовочная колонка занимает всё
  оставшееся место, а actions имеют intrinsic ширину по содержимому и не
  растягивают кнопки даже при узком viewport. В current production сам
  H1 заполняет эту колонку без прежнего лимита `24ch`; desktop column-gap равен
  24 px. Course/Lesson backlink и его стрелка непрозрачно чёрные, label
  однострочный с ellipsis, а вертикальные интервалы над и под ним равны
  page-header inset. Top-level разделы не создают искусственную обратную ссылку.
- Один `WorkspaceTabs` используется во всех product consumers, включая Courses
  index, owner/new/published Course, Lesson, Students, learning/observing profile
  и learner dialog,
  сохраняет roving keyboard/ARIA contract и горизонтальный scroll. Выбранная
  вкладка перекрывает full-width baseline 1.5 px цвета
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
  control-полировка развёрнута production release PR #242. Текущий
  tab-refinement развёрнут exact source `0c8946f95ebeb31e02955a110fc057f761f07ea9`.

### Roleless navigation, Расписание, Ученики и аудитория

- В current production основная навигация любого Account содержит «Расписание /
  Ученики / Курсы / Магазин» без role switch. Персональное меню справа содержит
  «Учебный профиль / Настройки / Выход».
- «Магазин» остаётся тем же universal Account route и не вводит роль продавца
  или покупателя.
- `/schedule` и `/students` filesystem-совместимо остаются под прежним route
  group, но layout проверяет только Account session. Guest/degraded session
  перенаправляется в `/login`.
- Current production `/schedule` показывает реальные LessonRun выбранной
  локальной недели или календарного месяца. Это проекция тех же проведений, а
  не отдельная таблица Schedule events.
- В current production краткий Action «Назначить урок» с иконкой добавления в
  календарь находится в общей page-header action-секции, а подзаголовок прямо
  объясняет, что здесь находятся все назначенные уроки за выбранный период.
  Справа под header находятся 300 px compact date picker и icon-only control
  «Таблица / Карточки». Короткая подпись использует русское сокращение месяца
  без завершающей точки, но доступное имя сохраняет полную дату. Отдельного
  переключателя периода на
  странице больше нет: календарный popover объединяет выбор опорной даты и
  режимы «День / Неделя / Месяц», а стрелки date control двигают именно
  выбранный период.
  Непустой результат начинается сразу с выбранного вида, без повторного
  «Выбранная неделя / Занятия» и count-chip. Table projection — сплошная белая
  поверхность без внешней рамки и с element/table radius 12 px; header и
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
  одной таблице, поэтому controls не исчезают и не сбрасываются из-за смены
  статуса. Поиск остаётся отдельным, а status, membership «В группе / Без
  группы», конкретная группа и связь с Account собраны в disclosure «Фильтр».
  Separate sort select удалён: sortable headers таблиц Students и Groups
  переключают ascending/descending повторным кликом. Students table имеет
  40 px header/rows и колонки
  `Ученик / Статус / Аккаунт / Группы / Добавлен / actions`. «Статус»
  описывает lifecycle relation/request, «Аккаунт» — состояние identity
  connection, а «Добавлен» — teacher-local дату relation или запроса. Архив и
  ожидание ответа отмечены прямо в строке. Вся compact
  toolbar расположена на page background во всю ширину без horizontal inset;
  справа от «Фильтр» находится icon-only переключатель **Таблица / Карточки**.
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
  показывается disabled с явной пометкой о недоступности. Archived/pending rows
  получают только допустимые restore/permanent-delete или cancel actions.
  Видимое имя принадлежит relation текущего преподавателя, а не глобальной identity.
- Header action на `/students` следует выбранной вкладке: «Новый ученик» или
  «Новая группа»; поиск и единый «Фильтр» остаются в full-width directory toolbar.
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
- Все surfaces используют тот же плоский бежевый demo visual language, header,
  кнопки, карточки и типографику, что и Course routes.

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
- `/learning-profile` показывает linked self profile, cursor-paginated
  learner-safe history, real-record progress, share code, AI consents и
  preview/confirm destructive actions.
- `/settings/observers` управляет pending/active observers, free display labels
  и revoke; вкладка `/students?tab=observing` показывает несколько observed
  profiles и только read-only learner-safe history/progress. `/observing`
  перенаправляет на эту вкладку. Teacher relation и observer grant не создают
  друг друга.
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
  source её panel имеет стабильный desktop-размер `56rem × 42rem`, остаётся
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
  Ручной каталог показывает 19 вариантов: legacy `heading` из него исключён,
  а «Текст» (`rich_text`) объединяет необязательный заголовок и обязательный
  основной текст. Сохранённые `heading` и прежние `rich_text` без заголовка
  остаются совместимыми с renderer/editor и schema version `1`.
- Компонент можно редактировать, удалить или переместить кнопками
  «выше/ниже». В current source persisted card всегда показывает только
  production teacher renderer. Группа 32 px actions располагается поверх
  карточки и раскрывается через hover/focus-within; на touch/coarse-pointer она
  остаётся доступной без hover. Pencil открывает отдельный modal editor, а не
  заменяет renderer внутри карточки. Отмена/закрытие не отправляют mutation;
  `PATCH` с payload/placement выполняется только по явному сохранению. Editor
  labels используют `.88rem/400`, а однострочные controls — canonical 40 px.
  Сама authored card белая, без внешней обводки; её чёрная тень меняется с
  `0 3px 6px #0000000d` на `0 3px 12px #0000001a` при hover/focus с анимацией,
  но без смещения layout. Overlay actions не имеют border/box-shadow и лежат на
  общей белой подложке `rgba(255, 255, 255, 0.5)`.
- Новый Component всегда создаётся `staff_only` и не показывается ученику,
  пока преподаватель явно не назначит его на Slide.

### Экран ученика

- Голубая кнопка видимости остаётся видимой у назначенного Component.
- Меню видимости предлагает только существующие Slides, допустимые с учётом
  соседей в плане, и при допустимости — «Новый слайд».
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

Manual picker является presentation-проекцией из 19 создаваемых вариантов, а
не вторым registry: `heading` сохранён в 20-типовом runtime/MCP contract для
совместимости существующих Lessons и AI, но не показывается при ручном
добавлении. Payload `rich_text` версии `1` обратно совместимо расширен
необязательным `title`; основной `content` остаётся обязательным.

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
  по-прежнему ограничен пятью типами `heading`, `rich_text`, `callout`,
  `single_choice_poll`, `matching_game` и повторно валидируется registry/Zod
  contracts до первой записи. Расширение ручного registry не расширяет
  provider allowlist автоматически.
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
  persistence этот authoring baseline не добавляет; identity consent/audit
  tables принадлежат отдельному M2–M3 contract.
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
  server log event. Persistent quota/ledger, billing, balance и AI change sets
  отсутствуют; process-local rate limit не является пользовательской квотой.

#### System Assistant — current deployed boundary

- `SystemAssistantProvider` и один floating `SystemAssistant` монтируются в
  protected `src/app/(app)/layout.tsx`, а не в public landing/Auth/demo и не в
  Course/Lesson header. Кнопки прежнего course-scoped dialog из Course и Lesson
  удалены.
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
- Диалог не persisted. Chat ограничен 30 turns, новые uncached Apply — 20
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
- persistent assistant/Course chat, durable action history и generalized
  tool calling за пределами allowlisted Course/Lesson actions;
- distributed rate limit, durable idempotency/action ledger и exactly-once
  assistant mutations между replicas;
- persistent token quota/ledger, billing units, balance и AI change sets/undo;
- parsing/RAG прикреплённых материалов;
- persisted Homework editor;
- LearnerProfile-scoped enrollment/consumption детского Course и настоящий live
  Student Screen access; current production Account-scoped self-learning
  educator Course описан отдельно и не является LessonRun/live flow;
- live Student Screen sync, realtime presence и teacher-controlled runtime
  cursor поверх открытого LessonRun;
- richer per-learner metrics ждут реального Component/runtime producer;
- persisted communication chat и notifications;
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

Текущий AI-срез читает bounded finalized history, но по-прежнему не сохраняет
provider requests, assistant dialog history или quota state в БД.

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
| Learner identity UI/routes           | `src/components/learner-identity/`, `/learning-profile`, `/students?tab=observing`, `/settings/observers`, `/identity/invitations/*`; `/observing` — compatibility redirect                                                                                                       |
| Learner identity access doc          | `docs/architecture/learner-identity-access-model.md`                                                                                                                                                                                                                              |
| Consented AI safe history            | `src/modules/ai/shared-history.ts`, `course-context.ts`, `course-builder-service.ts`                                                                                                                                                                                              |
| Historical identity execution prompt | `docs/v2/LEARNER_IDENTITY_COMPLETION_PROMPT.md`                                                                                                                                                                                                                                   |
| Course browser client                | `src/components/course-builder/course-builder-client.ts`                                                                                                                                                                                                                          |
| Course publication domain/service    | `src/modules/course-publications/`                                                                                                                                                                                                                                                |
| Course attestation domain/API        | `src/modules/course-attestations/`, `src/app/api/v2/course-catalog/[publicationId]/attestation/`, `src/app/api/v2/courses/[courseId]/attestation/`, `src/app/api/v2/me/attestations/`                                                                                             |
| Course consumption progress          | `src/modules/course-consumption/`, `src/app/api/v2/course-catalog/[publicationId]/progress/`                                                                                                                                                                                      |
| Course catalog/publication API       | `src/app/api/v2/course-catalog/`, `src/app/api/v2/courses/[courseId]/publication/`, `duplicate/`                                                                                                                                                                                  |
| Course catalog/owned UI              | `src/components/course-builder/courses-index.tsx`, `owned-courses-panel.tsx`, `course-catalog-panel.tsx`, `course-filter-menu.tsx`, `course-actions.tsx`, `src/components/ui/segmented-control.tsx`                                                                               |
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
| Account Store demo                   | `src/app/(app)/store/`, `src/components/store/`, `src/app/styles/store.css`, `docs/product/store-demo.md`                                                                                                                                                                         |
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
/learning-profile
/observing                        # compatibility redirect → /students?tab=observing
/settings/profile
/settings/security
/settings/observers
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
