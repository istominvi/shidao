# Frontend style system

**Статус:** current source contract
**Актуально на:** 19 августа 2026 года

Этот документ фиксирует канонические правила структуры React DOM и CSS в
ShiDao. Его цель — сохранять текущий внешний вид и доступность продукта без
накопления route-specific overrides, мёртвых selectors и неявных каскадных
зависимостей.

## Границы текущей системы

- Общие tokens, primitives и cross-surface contracts находятся в
  `src/app/globals.css` и `src/components/ui/`.
- Feature styles находятся в `src/app/styles/`. Они не должны переопределять
  внутреннюю геометрию shared primitive через route, table или page class.
- `communication-center.css` и `page-motion.css` загружаются из protected
  `(app)` layout, а `store.css` — только из `/store`. Root не доставляет
  feature CSS маршрутам, на которых соответствующий UI не существует.
- React component владеет своей семантикой и минимально необходимой DOM
  структурой. Обёртка допустима только для layout, interaction, semantics или
  измерения, которые нельзя выразить существующим узлом.
- Состояние интерактивного элемента выражается нативным ARIA атрибутом, если он
  существует. Стабильный визуальный вариант выражается одним `data-*`
  атрибутом. CSS modifier class не дублирует тот же state.
- Внешний `className` shared component предназначен для размещения component в
  consumer layout. Он не является способом переписать внутреннюю геометрию.

## Правила DOM и naming

1. Один элемент получает один канонический component class. Дополнительный
   class допустим только как consumer-owned layout hook с отдельной
   ответственностью.
2. Используем имена по роли, а не по месту первого появления:
   `action-menu-trigger`, `segmented-control-option`, `page-title-row`.
3. Не кодируем текущее состояние одновременно в class и ARIA/data attribute.
   Например, selected option определяется по `aria-pressed="true"`.
4. Не оставляем wrapper ради class, если его layout может без изменения
   выполнить parent или существующий semantic child.
5. Не добавляем пустые compatibility classes «на будущее». Переименование
   выполняется атомарным slice с обновлением consumers, styles и tests.
6. Основная продуктовая поверхность использует `app-page-shell`; слово
   `demo` зарезервировано за настоящим standalone `/demo` и явно
   демонстрационными product boundaries.

## Правила CSS

1. Shared primitive определяет собственные size, radius, typography, focus и
   state. Consumer выбирает объявленный prop/variant, а не повышает
   specificity контекстным selector.
2. Вариативные значения одного primitive задаются custom properties на root.
   Это предпочтительнее повторения полного rule для каждой модификации.
3. Selector должен быть настолько специфичным, насколько нужно для ownership,
   но не больше. Повторение class (`.product-btn.product-btn`) и длинные
   page-context chains требуют отдельного обоснования и regression test.
4. Feature stylesheet не содержит unscoped global reset. В частности,
   `prefers-reduced-motion` marketing surface ограничен
   `.landing-main-marketing`.
5. `forced-colors`, reduced motion, keyboard focus и coarse pointer являются
   частью component contract, а не поздним cosmetic override.
6. Rule или token без production reference удаляется после проверки dynamic
   construction. Regex source test сам по себе не считается production
   consumer.
7. Новый CSS не импортируется глобально, если он нужен только одной route
   boundary. Дальнейшее route-scoping выполняется отдельными безопасными
   slices с browser parity gate.

## Канонические shared contracts

### SegmentedControl

- Root использует `product-segmented-control` и `data-variant="icon|text"`.
- Moving plate остаётся единственным
  `product-segmented-control-indicator` и не участвует во flex layout.
- Каждая actual button использует только
  `product-segmented-control-option`; selection читается из `aria-pressed`.
- Видимая подпись находится в
  `product-segmented-control-option-label`, что позволяет text projection
  сжиматься с ellipsis без потери полного accessible name button.
- Icon/text geometry выражается root custom properties. Измерение,
  `ResizeObserver`, rapid retarget, reduced-motion и forced-colors semantics
  остаются единым component contract.
- Exact icon-only geometry сохраняется: shell `80 × 40 px`, две options
  `38 × 38 px`, shell radius `12 px`, option/indicator radius `11 px`.

### ActionMenu

- Базовая кнопка использует общий product control contract.
- Плотная табличная кнопка выбирается через `triggerSize="compact"`; component
  выставляет `data-trigger-size="compact"` на root.
- Course, Lesson, Schedule и Students не создают собственные forks геометрии
  trigger. Hover, focus и forced-colors описаны один раз рядом с primitive.
- Portal positioning, destructive/disabled states, keyboard navigation,
  Escape и focus return не зависят от visual variant.

### AppPageHeader

- `app-page-header-content` непосредственно владеет reserved backlink row,
  title row, metric и meta.
- Отдельная `app-page-heading` обёртка и classes, кодирующие наличие back/action,
  не используются: реальный DOM уже выражает это состояние.
- H1 и intrinsic action rail остаются в одной title row и переносятся только
  при фактической нехватке ширины.
- Supporting count/status называется `app-page-metric`; прежняя терминология
  `description` не используется для элемента, который не является описанием.

### Communication Center assistant UI

- Единственная current assistant surface находится внутри persisted
  Communication Center.
- Conversation и action rendering принадлежат
  `src/components/communication/assistant-conversation.tsx` и
  `assistant-action-card.tsx`; соответствующие styles принадлежат
  `communication-center.css`.
- `AssistantPageContextProvider` является узкой allowlisted page-context
  boundary и принадлежит Communication Center. Регистрация выполняется через
  `useRegisterAssistantPageContext`, чтение — через
  `useAssistantPageContext`; conversation state в provider не хранится.
  Старые floating launcher/panel component и stylesheet не являются current
  UI и удалены.

## Проверки изменений

Каждый structural cleanup, затрагивающий shared UI, должен пройти:

1. component/source contract tests на semantics и отсутствие возвращённых
   legacy hooks;
2. typecheck, lint, repository format check и production build;
3. production-mode browser scenarios на desktop и mobile;
4. отдельные assertions для keyboard focus, reduced motion и forced colors там,
   где изменяется интерактивный primitive;
5. review итогового CSS/DOM diff на визуально значимые geometry, stacking,
   overflow и responsive изменения.

Source-level regex tests защищают ownership и architecture, но не заменяют
browser computed-style/geometry checks.

## Последовательность дальнейшей работы

**Current:** завершены два cleanup slice. Shared primitives, page header и
Communication Center очищены от compatibility DOM/CSS. Исторический
`course-demo-*` production contract атомарно заменён на `app-page-shell` и
канонические `--product-*` tokens без alias-слоя. Ложные filesystem boundaries
`(teacher-required)` / `(profile-required)` удалены; все Account routes
защищает один `(app)` layout. App-only Communication Center/page-motion и
Store-only CSS доставляются только своим route boundaries. Exact helper,
surface structure и date-formatter duplicates сведены к одному владельцу;
неиспользуемые exports удалены. Внешняя геометрия и поведение не меняются.

**Next:** поднять буквальную общую геометрию Course/Schedule/Students tables в
существующий `ProductTable`, перенести portal geometry `ActionMenu` из teaching
styles к primitive и затем разделить remaining teaching/navigation/marketing
ownership. Каждый шаг проходит independent browser visual-parity gate.

**Later:** добавить автоматическую проверку запрещённых specificity patterns,
неиспользуемых tokens/selectors и глобальных reduced-motion leaks после того,
как route ownership станет однозначным. Статический инструмент не должен
удалять dynamic variant или status selectors без production-reference audit.
