# Демо-магазин ShiDao

**Статус:** current production UI-only demo; compact-toolbar follow-up готовится
к следующему production rollout
**Актуально на:** 15 августа 2026 года

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
  predicates удалены. Один и тот же результат можно смотреть как карточки или
  таблицу. Сортировка открывает product dropdown ShiDao, а не системный native
  `select` платформы. Category tabs и sort сразу обновляют локальную projection
  и не создают generic toolbar reset-action. «Очистить поиск» появляется только для
  непустого query и сохраняет category, sort и выбранный вид.
- У каждого товара есть стабильный в текущем demo-каталоге человекочитаемый
  `slug`. Ссылка
  `/store?product=<slug>` открывает тот же каталог и переводит внимание к
  указанному товару; она не добавляет товар в корзину и не создаёт заказ.
  Неизвестный `slug` безопасно оставляет пользователя в каталоге.

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

- database schema, API, Storage и migrations не меняются;
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
- Модальный диалог объявлен семантически, удерживает focus внутри, закрывается
  по `Escape` и после закрытия возвращает focus на вызвавшую его кнопку.
- Изменение количества и удаление не зависят только от иконки или цвета:
  controls имеют понятные accessible names, а итог и количество доступны
  screen reader.
- На узком экране header actions сохраняют intrinsic width, toolbar переносится
  без горизонтального overflow, карточки перестраиваются в одну колонку, а
  таблица получает контролируемый horizontal scroll. Диалог корзины и checkout
  остаётся внутри viewport и допускает вертикальный scroll содержимого.

## Acceptance checks current-среза

1. Гость при открытии `/store` попадает в действующий auth flow; Account видит
   четвёртый nav item «Магазин» с active state на странице магазина.
2. Категории, поиск и сортировка дают детерминированный результат, а
   «Карточки / Таблица» показывают один и тот же набор товаров. Отдельной
   кнопки фильтров нет; сортировка использует product dropdown ShiDao вместо
   native platform `select`. Смена category/sort не показывает toolbar-кнопку сброса;
   query-only очистка не меняет остальные параметры каталога.
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
`0 18px 46px rgba(20, 20, 20, 0.18)` и `backdrop-filter: none`. Выбранное
значение, keyboard navigation, Escape и focus return сохраняются, а системное
macOS menu больше не используется. В forced-colors тень заменяется системной
границей `1px solid CanvasText` на `Canvas`. Category tabs, cards/table
segmented toggle, cart quantity icon-actions и `DialogShell` не становятся
ordinary raised CTA или dropdown surfaces. Обычные CTA магазина остаются на
shared `Button`; follow-up не меняет cart/checkout state machine.

Store product cards и canonical table wrapper используют статический
`--product-raised-surface-shadow`, равный базовой тени кнопки
`0 1px 6px 0px oklch(0% 0 0 / 0.05)`, без card hover/pressed lift, transform или
shadow-transition. Plain cards/table также используют
`--product-surface-border: 1px solid oklch(0 0 0 / 0.1)` и
`background-clip: padding-box`, поэтому рамка смешивается с фоном каталога, а
не с белой заливкой. Semantic/dashed `SurfaceCard` borders при этом не
перезаписываются. Deep-link и programmatic focus товара сохраняют отдельный
3 px outline поверх неизменной base-тени; existing white background, card/table
radius, table row hover и horizontal scroll не меняются. В `forced-colors`
surface shadow заменяется системным outline.

Base `.product-control` / `.field-input`, включая многострочный адрес,
получают общий border и clipped background. Поиск каталога и
однострочные поля checkout «Получатель / Телефон / Email» дополнительно
получают белый surface, внешние `40 px`, внутренние `38 px` и статическую тень
`0 1px 6px 0px oklch(0% 0 0 / 0.05)`, canonical foreground/типографику,
непрозрачные placeholder/icon и отдельный 2 px focus halo с
`outline-offset: 0`: halo начинается сразу за рамкой, не создавая визуального
зазора. Hover не меняет тень, border или геометрию. Многострочный адрес
доставки сохраняет base boundary, но не получает single-line height/entry
shadow. Native `select`, standalone `DialogShell` и demo-only surfaces исключены
из universal dropdown contract; Store sort намеренно использует product
dropdown вместо native `select`. Compound toggles
остаются borderless. Это UI-only acceptance без Product/Order/Inventory, API,
persistence, schema, migration,
оплаты или delivery integration. Этот follow-up является current source / next
production и ещё не подменяет historical rollout evidence выше.

## Next

Следующий полноценный vertical slice должен отдельно спроектировать Product,
Order и Inventory, изображения и документы в Storage, управление каталогом и
заказами для администратора. До реализации выбираются платёжный провайдер,
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
