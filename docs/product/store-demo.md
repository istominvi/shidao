# Демо-магазин ShiDao

**Статус:** current production UI-only demo; фото-каталог и два карточных
режима — current source / next production
**Актуально на:** 16 августа 2026 года

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

## Current source / next production: фотографии и плотность

- Девять demo-товаров ссылаются на 19 оптимизированных квадратных WebP:
  у прописей три кадра, у остальных товаров по два. Файлы размером
  `1000 × 1000` находятся в `public/store/products/<slug>/` и называются
  `cover.webp`, `detail-01.webp` и, где нужен третий кадр,
  `detail-02.webp`.
- Каждая карточка показывает квадратную галерею только с фотографиями товара,
  без прежних декоративных Lucide-иконок и иероглифов. Тап или клавиатурная
  активация изображения листает вперёд, горизонтальный touch-жест листает в
  соответствующую сторону, а отдельные кнопки «Предыдущее фото» и «Следующее
  фото» доступны постоянно. Индекс хранится локально для каждой карточки.
- Выбор вида переключает одну projection между крупными и компактными
  карточками. На широком экране это соответственно три и шесть колонок, на
  tablet — две и четыре, на mobile — одна и две. Compact mode скрывает
  вторичное описание и chips, но сохраняет фото, название, цену и действие
  корзины.
- Строки «В наличии / Нет в наличии» и stock-based блокировка удалены: в этом
  demo нет Inventory. Цена стала заметнее и выровнена по общей вертикальной
  оси с кнопкой «В корзину». Header-chip «Демо · без оплаты» удалён; честная
  demo-маркировка остаётся на платёжном и финальном шагах checkout.
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
- Галерея имеет осмысленный `alt` для каждого кадра, доступные имена у tap и
  arrow controls и live-status «Фото N из M». Горизонтальный жест не блокирует
  вертикальный scroll страницы.
- Модальный диалог объявлен семантически, удерживает focus внутри, закрывается
  по `Escape` и после закрытия возвращает focus на вызвавшую его кнопку.
- Изменение количества и удаление не зависят только от иконки или цвета:
  controls имеют понятные accessible names, а итог и количество доступны
  screen reader.
- На узком экране header actions сохраняют intrinsic width, toolbar переносится
  без горизонтального overflow, а крупный и компактный виды перестраиваются в
  одну и две колонки. Диалог корзины и checkout остаётся внутри viewport и
  допускает вертикальный scroll содержимого.

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
8. Все 19 изображений загружаются в квадратной области; tap, swipe и обе
   стрелки меняют только текущую карточку. Availability-текста и недоступной
   из-за stock кнопки в каталоге нет.

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
границей `1px solid CanvasText` на `Canvas`. Category tabs, density segmented
toggle, cart quantity icon-actions и `DialogShell` не становятся
ordinary raised CTA или dropdown surfaces. Обычные CTA магазина остаются на
shared `Button`; follow-up не меняет cart/checkout state machine.

Store product cards используют статический
`--product-raised-surface-shadow`, равный базовой тени кнопки
`0 1px 6px 0px oklch(0% 0 0 / 0.05)`, без card hover/pressed lift, transform или
shadow-transition. Plain cards также используют
`--product-surface-border: 1px solid oklch(0 0 0 / 0.1)` и
`background-clip: padding-box`, поэтому рамка смешивается с фоном каталога, а
не с белой заливкой. Semantic/dashed `SurfaceCard` borders при этом не
перезаписываются. Deep-link и programmatic focus товара сохраняют отдельный
3 px outline поверх неизменной base-тени. Фото занимает квадратную область с
`object-fit: cover`; overlay-кнопки галереи имеют контрастный focus. Крупная
сетка использует три колонки, compact — шесть, с responsive fallbacks,
описанными выше. Footer сохраняет одну строку с vertically centered ценой
`1.18rem` и кнопкой корзины. В `forced-colors` surface shadow заменяется
системным outline.

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
