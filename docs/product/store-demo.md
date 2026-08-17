# Демо-магазин ShiDao

**Статус:** current production UI-only demo; responsive-фото, карточная
галерея, product detail dialog и два карточных режима — current source / next
production
**Актуально на:** 17 августа 2026 года

## Назначение

Магазин — простой защищённый раздел ShiDao для учебных товаров: учебников,
методических материалов, рабочих тетрадей и прописей, карточек, развивающих
игр и канцелярии. Каталог не должен превращаться в универсальный маркетплейс:
его ассортимент связан с подготовкой и проведением занятий.

## Current: доступ и каталог

- `/store` находится внутри текущего защищённого app-контура и недоступен
  гостю как публичная витрина.
- «Магазин» — четвёртый пункт primary navigation после «Расписание»,
  «Ученики» и «Курсы»; пункт использует простую иконку `ShoppingBag`.
- Страница использует общий `AppPageHeader`; кнопка «Корзина» с количеством
  позиций находится в его action-секции.
- Источник товаров — статический demo-каталог в application code. Current
  source оставляет category tabs, поиск и сортировку над этим локальным
  набором; прежняя отдельная filter-кнопка и audience/price/availability
  predicates удалены. Один и тот же результат можно смотреть крупными или
  компактными карточками. Сортировка открывает product dropdown ShiDao, а не
  системный native `select` платформы. Category tabs и sort сразу обновляют
  локальную projection и не создают generic toolbar reset-action. «Очистить
  поиск» появляется только для непустого query и сохраняет category, sort и
  выбранный вид.
- У каждого товара есть стабильный в текущем demo-каталоге человекочитаемый
  `slug`. Ссылка
  `/store?product=<slug>` открывает тот же каталог и переводит внимание к
  указанному товару; она не добавляет товар в корзину и не создаёт заказ.
  Неизвестный `slug` безопасно оставляет пользователя в каталоге.

## Current source / next production: фотографии, карточки и detail dialog

- Девять demo-товаров ссылаются на 19 квадратных WebP masters: у прописей три
  кадра, у остальных товаров по два. Файлы `1254 × 1254`, WebP quality `90`,
  находятся в `public/store/products/<slug>/` и называются `cover.webp`,
  `detail-01.webp` и, где нужен третий кадр, `detail-02.webp`.
- Public masters не отправляются всем viewport как один и тот же файл.
  Встроенный `next/image` runtime optimizer с уже установленным Sharp строит
  responsive WebP: карточка запрашивает quality `75`, detail dialog — `85`, а
  thumbnails — `75`. Контекстные `sizes` описывают крупную/compact сетку,
  mobile и dialog; разрешённые local paths ограничены `images.localPatterns`,
  а minimum cache TTL равен семи дням. Новый image dependency или внешний
  image service не добавлен. Полный общий boundary описан в
  [`docs/architecture/image-delivery.md`](../architecture/image-delivery.md).
- Каждая карточка показывает квадратную галерею только с фотографиями товара,
  без прежних декоративных Lucide-иконок и иероглифов. Горизонтальный
  touch-жест и отдельные кнопки «Предыдущее фото» / «Следующее фото» листают
  галерею; индекс хранится локально для каждой карточки. Стрелки используют
  общий с overflow-навигацией вкладок `FadeChevronButton`: без границы,
  круглой белой подложки и тени, с мягким radial fade по краю фотографии.
  Индикатор кадров использует приглушённый белый fade без тени.
- Обычный click/tap по фотографии, названию или свободной non-control области
  карточки открывает product detail, а не листает следующий кадр. Arrow/cart
  controls выполняют только собственное действие. Detail использует
  `DialogShell` размером до `56rem × 42rem`, показывает большую галерею,
  thumbnails всех кадров, полное существующее описание, цену и действия
  «В корзину» / «Оформить сразу». Кнопка закрытия находится справа сверху;
  Escape/backdrop закрывают dialog и возвращают пользователя к каталогу.
- «В корзину» из detail добавляет одну единицу и оставляет dialog открытым.
  «Оформить сразу» сначала гарантирует количество товара не меньше единицы,
  затем закрывает detail и открывает шаг доставки существующего demo checkout;
  два `DialogShell` одновременно не остаются открытыми.
- Открытие и закрытие использует View Transition от конкретной карточки к
  dialog и обратно. При отсутствии API, ошибке transition или
  `prefers-reduced-motion: reduce` применяется немедленный функциональный
  fallback без shared-element анимации.
- Выбор вида переключает одну projection между крупными и компактными
  карточками. На широком экране это соответственно три и шесть колонок, на
  tablet — две и четыре, на mobile — одна и две. Обе плотности сохраняют верхние
  pills категории и аудитории (`Для ученика` / `Для преподавателя`) сразу под
  фото. Compact mode скрывает вторичное описание, но сохраняет pills, фото,
  название, цену и действие корзины. Нижние tag-pills вроде «методика» или
  «письмо» на карточке больше не показываются.
- Строки «В наличии / Нет в наличии» и stock-based блокировка удалены: в этом
  demo нет Inventory. Цена стала заметнее и выровнена по общей вертикальной
  оси с кнопкой «В корзину». В card CTA используется понятная иконка
  `ShoppingCart`, а разделителя над footer нет. Header-chip «Демо · без оплаты»
  удалён; честная demo-маркировка остаётся в detail, на платёжном и финальном
  шагах checkout.
- Эти изображения — source-controlled public assets текущего UI-only demo, а
  не Supabase Storage, Product media model или свидетельство фактического
  остатка. Управляемые product media остаются частью будущего commerce slice.

## Current: корзина и demo checkout

Корзина открывается модальным диалогом поверх каталога. В ней можно увидеть
выбранные товары, изменить количество, удалить позицию и перейти к оформлению.
Checkout запрашивает только имя, телефон, email и адрес доставки и проверяет
обязательные поля до перехода к демонстрационному финальному состоянию.

Корзина и форма живут только в локальном React state текущей страницы. Они не
используют API, cookies, `localStorage` или другую персистентность; reload
полностью сбрасывает корзину и введённые данные. Платёжный шаг является явно
подписанной заглушкой: полей карты нет, сетевых запросов нет, деньги не
списываются и запись заказа не создаётся.

## Явная граница current

- database schema, API, Supabase Storage и migrations не меняются;
- реальных заказа, оплаты, доставки, резервирования и учёта остатков нет;
- demo-статус не должен называться успешной покупкой или подтверждённым
  заказом;
- типизированная ссылка Lesson Component → Product ещё не реализована;
- преподаватель уже может вручную использовать обычный `external_link` с
  абсолютным HTTPS URL `https://v2.shidao.ru/store?product=<slug>`, но это не
  Product relation и не гарантия наличия;
- teacher-private данные Lesson, Course, roster и LearningRecord не попадают в
  витрину или URL товара.

## Accessibility и responsive contract

- Категории и выбор вида имеют клавиатурное управление, видимый focus и
  доступные имена; поиск и поля checkout связаны с явными label, а ошибки — с
  соответствующими полями.
- Галерея имеет осмысленный `alt` для каждого кадра, отдельные доступные имена
  у open/arrow/thumbnail controls и live-status «Фото N из M». Горизонтальный
  жест не блокирует вертикальный scroll страницы; на карточке обычная
  активация фотографии открывает detail, а в detail клавиши-стрелки и swipe
  меняют кадр.
- Product detail и cart/checkout dialog объявлены семантически, удерживают
  focus внутри, закрываются по `Escape` и после закрытия возвращают focus на
  вызвавший control. Shared-element motion не является условием выполнения
  действия и отключается при `prefers-reduced-motion: reduce`.
- Изменение количества и удаление не зависят только от иконки или цвета:
  controls имеют понятные accessible names, а итог и количество доступны
  screen reader.
- На узком экране header actions сохраняют intrinsic width, toolbar переносится
  без горизонтального overflow, а крупный и компактный виды перестраиваются в
  одну и две колонки. Product detail, корзина и checkout остаются внутри
  viewport и допускают вертикальный scroll содержимого.

## Acceptance checks current-среза

1. Гость при открытии `/store` попадает в действующий auth flow; Account видит
   четвёртый nav item «Магазин» с active state на странице магазина.
2. Категории, поиск и сортировка дают детерминированный результат, а крупные и
   компактные карточки показывают один и тот же набор в том же порядке.
   Отдельной кнопки фильтров нет; сортировка использует product dropdown ShiDao
   вместо native platform `select`. Смена category/sort не показывает
   toolbar-кнопку сброса; query-only очистка не меняет остальные параметры.
3. Добавление, изменение количества и удаление синхронно обновляют badge,
   состав корзины и итог; пустая корзина имеет понятное empty state.
4. Checkout валидирует имя, телефон, email и адрес. Платёжная заглушка не
   показывает реквизиты карты, не выполняет network request и честно сообщает,
   что заказ не создан.
5. Reload сбрасывает корзину и форму. В repository slice отсутствуют новый API,
   migration и физическая schema для магазина.
6. `/store?product=<known-slug>` переводит focus к нужному товару, а неизвестный
   slug не ломает страницу и не меняет корзину.
7. Основной путь доступен с клавиатуры; dialog focus/return-focus работает, а
   mobile viewport не получает page-level horizontal overflow.
8. Все 19 masters имеют `1254 × 1254`; карточка и detail получают responsive
   `/_next/image` variants из разрешённых local paths с подходящим `sizes`, а
   не безусловно скачивают master. Квадратная область и `object-fit: cover`
   сохраняются.
9. Swipe и обе стрелки меняют только текущую галерею; click/tap по фото,
   заголовку или свободной non-control области открывает detail. Нажатие
   стрелки или кнопки корзины detail не открывает.
10. Detail показывает все кадры и thumbnails, существующее полное описание,
    цену и два действия. «В корзину» обновляет badge; «Оформить сразу» не
    дублирует позицию при уже положительном количестве и открывает delivery без
    одновременного второго dialog.
11. Верхние category/audience pills присутствуют в обеих плотностях; нижних
    tag-pills, availability-текста, stock gating, card `ShoppingBag` и footer
    divider в каталоге нет. View Transition имеет функциональный
    reduced-motion/unsupported fallback.

Historical Store baseline был подтверждён running source
`9e66fb548bef176486673149f466b269fd436b21`: guest `/store` следовал текущему
auth boundary (`307 → /login`). Полный authenticated checkout остаётся
покрытым release browser suite; отдельный authenticated production order smoke
не требуется, поскольку order/payment request в этом demo отсутствует.

## Current source / next production visual acceptance

Отдельных filter trigger/panel в Store больше нет. Sort trigger использует
каноническую 40 px product-control геометрию, но не entry-field focus halo; его
список входит в universal `.product-dropdown-surface`: внутренний inset ровно
`6 px`, белый фон, element-radius `12 px`, обычный `border: 0`, одна тень
`0 24px 32px -24px rgba(20, 20, 20, 0.24)` и `backdrop-filter: none`. Выбранное
значение, keyboard navigation, Escape и focus return сохраняются, а системное
macOS menu больше не используется. В forced-colors тень заменяется системной
границей `1px solid CanvasText` на `Canvas`. Category tabs, density segmented
toggle, cart quantity icon-actions и `DialogShell` не становятся
ordinary raised CTA или dropdown surfaces. Обычные CTA магазина остаются на
shared `Button`; follow-up не меняет cart/checkout state machine.

Store product cards используют статический
`--product-raised-surface-shadow`, равный базовой тени кнопки
`0 1px 6px 0px oklch(0% 0 0 / 0.05)`, без card hover/pressed lift, transform или
shadow-transition. Plain cards также используют
`--product-surface-border-color: oklch(0 0 0 / 0.1)` и
`--product-surface-border: 1px solid var(--product-surface-border-color)` вместе с
`background-clip: padding-box`, поэтому рамка смешивается с фоном каталога, а
не с белой заливкой. Semantic/dashed `SurfaceCard` borders при этом не
перезаписываются. Deep-link и programmatic focus товара сохраняют отдельный
3 px outline поверх неизменной base-тени. Фото занимает квадратную область с
`object-fit: cover`; overlay-кнопка открытия и arrow controls имеют
контрастный focus. Стрелки — общий `FadeChevronButton` с borderless radial
fade, а dots — приглушённый white fade без shadow. Крупная сетка использует три
колонки, compact — шесть, с responsive fallbacks, описанными выше. Category и
audience pills сохраняются в обеих плотностях; отдельный ряд tag-pills на card
не возвращается. Footer без верхнего divider сохраняет одну строку с vertically
centered ценой `1.18rem` и кнопкой `ShoppingCart`. В `forced-colors` surface
shadow заменяется системным outline.

Product detail использует тот же `DialogShell`, но с panel до
`56rem × 42rem`; desktop layout делит gallery/copy, narrow viewport
перестраивает их вертикально. Большое фото и thumbnails используют responsive
`next/image`; dialog не меняет public/private image boundary. Для единственного
активного товара card surface и dialog panel временно получают общий
`view-transition-name`; имя снимается после завершения, а reduced-motion и
unsupported browser идут по немедленному fallback. Deep link
`/store?product=<slug>` по-прежнему только выбирает category, прокручивает и
фокусирует карточку: он не открывает detail автоматически и не меняет cart.

Base `.product-control` / `.field-input`, включая многострочный адрес,
получают общий border, clipped background и непрозрачную белую
заливку. Поиск каталога и однострочные поля checkout «Получатель /
Телефон / Email» дополнительно получают внешние `40 px`, внутренние
`38 px` и статическую тень
`0 1px 6px 0px oklch(0% 0 0 / 0.05)`, canonical foreground/типографику,
непрозрачные placeholder/icon и отдельный 2 px focus halo с
`outline-offset: 0`: halo начинается сразу за рамкой, не создавая визуального
зазора. Hover не меняет тень, border или геометрию. Многострочный адрес
доставки сохраняет base boundary, но не получает single-line height/entry
shadow. Native `select`, standalone `DialogShell` и demo-only surfaces исключены
из universal dropdown contract; Store sort намеренно использует product
dropdown вместо native `select`. На narrow/coarse viewport обычные Store
controls имеют внешнюю высоту `40 px` и action-glyph `20 px / 2 px`.
Compound toggles состоят из настоящих соседних `40 px` options без padding/gap;
selected option использует тот же белый surface, radius `12 px` и base shadow,
что обычная кнопка; её прозрачный `1 px` border пропускает один слой track того же
цвета, что product border. Это UI-only
acceptance без Product/Order/Inventory, API,
persistence, schema, migration,
оплаты или delivery integration. Этот follow-up является current source / next
production и ещё не подменяет historical rollout evidence выше.

## Next

Следующий полноценный vertical slice должен отдельно спроектировать Product,
Order и Inventory, управляемые изображения и документы в Storage, управление
каталогом и заказами для администратора. Текущие файлы в `public` не подменяют
эту модель. До реализации выбираются платёжный провайдер,
юридический checkout/delivery contract и security boundary. Физическая модель
добавляется только новой forward migration с обновлением current-schema
snapshot/docs, а все записи идут через canonical application services после
read-only проверки ShiDao database identity и schema.

## Later

Типизированная ссылка из Lesson на товар добавляется через общий component
registry и canonical Course Builder services; development MCP остаётся
адаптером над теми же services, а не получает прямой доступ к таблицам. Learner
projection такой ссылки содержит только публичные данные товара и никогда не
раскрывает teacher comment, private Components, roster или другие
teacher-private данные. Реальные платежи, доставка и интеграции с внешними
службами вводятся только после отдельного продуктового и security-решения.
