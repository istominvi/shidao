# ShiDao V2 — первый демонстрационный milestone

- **Статус:** реализован, развёрнут и проверен 4 августа 2026 года
- **Роль:** acceptance baseline перед AI/RAG/Homework/live
- **Целевая аудитория демонстрации:** заказчик
- **Рабочий адрес:** `v2.shidao.ru`
- **Проверенный application release:** `0c426ff`
- **Current visual refinement:** единые `AppPageHeader` и `WorkspaceTabs`
  развёрнуты в Coolify и прошли authenticated production postflight

## 1. Результат для заказчика

Deployed customer-demo contour демонстрирует короткий реальный workflow
преподавателя:

```text
Курсы → Новый курс → заполнить форму → прикрепить материалы
→ собрать черновик → получить настоящий сохранённый курс
→ открыть урок → увидеть и отредактировать готовые компоненты
→ открыть Student Screen preview
```

Это не статический макет и не hardcoded demo. После перезагрузки страницы
Course, Lesson, course-wide материалы и единый порядок компонентов остаются в
базе. Пересекающиеся операции минимального MCP-subset используют те же
application service и contracts; полный UI workflow через MCP не заявляется.

## 2. Принцип реализации

Реализованная первая версия элементарна, но архитектурно честна:

- курс и уроки хранятся как данные;
- урок не является отдельной захардкоженной React-страницей;
- типы компонентов задаются code-first registry;
- payload каждого типа проходит одну каноническую schema-валидацию;
- UI и MCP вызывают один application service и общие schemas для операций,
  которые входят в намеренно ограниченный MCP-subset;
- renderers не зависят от ID конкретного курса или урока;
- вложения действительно сохраняются в Storage и связываются с курсом;
- неподдерживаемый файл не объявляется «проанализированным»;
- teacher-private инструкции не попадают на Student Screen;
- добавление следующего типа компонента не требует новой таблицы.
- active V2 не использует Methodology entity, fixture fallback или
  lesson-specific renderer; архив V1 не является runtime dependency.

Сложность добавляется после работающего vertical slice, а не до него.

## 3. Каноническая структура урока

Этот milestone подчиняется `docs/architecture/lesson-workflow-model.md`.

```text
Course
├── course-wide attachments
└── Lesson 1..N
    ├── ordered Components 1..N
    └── ordered Student Screen Slides 1..N
```

У Lesson один канонический список компонентов:

- План урока показывает все компоненты;
- каждый новый компонент по умолчанию остаётся `staff_only`;
- преподаватель явно назначает компонент на existing или new Slide;
- Student Screen показывает один active Slide и сохраняет единый
  относительный component order;
- teacher-private компоненты отсутствуют в learner API, а не только скрыты в
  интерфейсе.

Между Lesson и Component нет `Lesson Step`, скрытого/root Step или compatibility
group. Student Screen Slide хранит только grouping/позицию проекции и не
является Step: у него нет title, content, instructions или второго
component order. Во время будущего live-урока learner surface управляется teacher;
свободная learner-навигация не является поведением по умолчанию.

## 4. Workflow «Курсы → Новый»

### 4.1 Список курсов

Страница «Курсы» содержит:

- список личных курсов текущего Account;
- пустое состояние;
- кнопку «Новый курс»;
- переход в созданный Course workspace.

### 4.2 Форма нового курса

Минимальные поля:

- название;
- предмет или тема;
- цель курса;
- уровень/исходная подготовка;
- целевая аудитория или краткое описание учащегося;
- планируемое количество уроков;
- дополнительные пожелания преподавателя;
- необязательные файлы/изображения.

В первом vertical slice допускается `audience_type=none`: наличие заранее созданного LearnerProfile или Group не должно блокировать демонстрацию конструктора.

### 4.3 Создание

Кнопка «Создать курс» создаёт пустой draft Course и открывает workspace.

Кнопка «Собрать черновик» использует отдельный application service и создаёт минимально осмысленную структуру из введённых данных:

- Course;
- минимум один Lesson;
- ordered Components, непосредственно принадлежащие Lesson;
- image/file component для подходящих вложений;
- Student Screen preview.

Для первого показа допустим простой детерминированный assembler. Он должен честно использовать данные формы, создавать реальные записи и проходить те же schemas, что будущий AI. Позднее AI добавляется как альтернативная auto-assembly strategy без замены Course/Lesson/registry контрактов; ручной путь остаётся доступен всегда.

Если semantic parsing вложений ещё не реализован, UI явно показывает, что файл «прикреплён», а не «проанализирован».

## 5. Первый registry компонентов

Обязательный демонстрационный набор:

| Key                  | Название в UI     | Назначение                                    |
| -------------------- | ----------------- | --------------------------------------------- |
| `heading`            | Заголовок         | Необязательный заголовок внутри Lesson        |
| `rich_text`          | Текст             | Абзацы и базовое форматирование               |
| `callout`            | Сноска            | Короткое выделенное пояснение/заметка         |
| `quote`              | Цитата            | Цитата с необязательным автором               |
| `divider`            | Разделитель       | Визуальное разделение блоков                  |
| `image`              | Картинка          | Изображение, alt-текст и подпись              |
| `slideshow`          | Слайдшоу          | Упорядоченный набор изображений/слайдов       |
| `single_choice_poll` | Опрос             | Один вопрос без обязательной оценки           |
| `matching_game`      | Игра «Найди пару» | Одна простая настоящая интерактивная механика |
| `file`               | Файл              | Скачиваемое/открываемое вложение              |

`game` не должен быть абстрактным универсальным типом. Для первой версии реализуется одна законченная механика `matching_game`; следующие игры получают отдельные type keys и schemas.

Каждое определение registry содержит:

- стабильный `key`;
- `version`;
- название и категорию;
- payload schema;
- placement schema;
- capabilities;
- JSON Schema, генерируемую из того же источника для MCP.

Текущий payload editor реализован единым switch по `ComponentTypeKey`, а
teacher/Student Screen renderers — отдельной exhaustive typed map. Оба слоя
используют registry contracts.

## 6. Минимальный Course workspace

Владелец курса может:

- открыть Course на вкладке «Уроки» без автоматического выбора первого Lesson;
- переключаться между «Уроки / Описание / Источники / Материалы / История»;
- открыть «Настройки» и изменить основные поля Course;
- просмотреть course-wide attachments на вкладке «Материалы»;
- добавить, переименовать и удалить Lesson;
- открыть Lesson с backlink по названию Course и заголовком
  `Урок {position}. {title}`;
- добавить компонент прямо в Lesson;
- выбрать компонент в palette по категории;
- заполнить payload компонента;
- изменить порядок компонентов;
- назначить компонент на допустимый Slide, создать new Slide или убрать
  компонент с Student Screen;
- удалить компонент;
- переключаться между «План / Экран ученика / Домашнее задание / Материалы /
  История»;
- открыть Student Screen preview внутри курса или на весь экран;
- обновить страницу и получить то же сохранённое состояние.

Component хранит прямой `lesson_id`; первый и последующие компоненты не создают
скрытых сущностей или групп. Раздел «Домашнее задание» в этом milestone
является честной навигационной заглушкой без fixture/localStorage; persisted
homework editor остаётся отдельным будущим P1 slice.

Lesson-вкладка «Материалы» показывает только course-wide catalog и не создаёт
lesson-owned files. «Источники» и обе «Истории» остаются честными пустыми
состояниями до появления соответствующих application/storage contracts.

Page headers `/courses`, `/students`, `/schedule`, Course и Lesson используют
один прозрачный `AppPageHeader` без белой или градиентной карточки: H1 с
максимумом 48 px на desktop и 32 px на mobile, подзаголовок, optional
backlink и правая action-секция. Минимальная высота header равна 200 px,
больший контент расширяет его, а actions вертикально центрированы. Page background active
routes является сплошным `#f5f1e8`: marketing noise и цветные gradients
удалены. Sticky product header повторяет demo shell 68 px / 20 px; кнопки и
header controls — 40 px / 12 px / `.88rem 500`.

Course, Lesson, Students и profile dialog используют один `WorkspaceTabs`.
Tabs имеют высоту 40 px, roving keyboard navigation, horizontal scroll и явные
`tab` → `tabpanel` ARIA-связи. Общая нижняя линия чёрная, имеет толщину 1 px и
inline-inset 12 px; active tab утолщает её квадратным чёрным сегментом 4 px без
radius. Это current deployed acceptance contract, подтверждённый browser
postflight точного application release `77870e3`.
Переход Course ↔ Lesson переносит focus в новый рабочий контекст и
восстанавливает его на строке Lesson при возврате. Эти токены не меняют landing
или auth screens.

Drag-and-drop не обязателен для первого показа. Кнопки «выше/ниже» допустимы, если они надёжнее и быстрее дают законченный workflow.

## 7. Вложения

Минимальный контракт:

- файл загружается в существующий private Storage-контур;
- создаётся Account-owned `StoredFile`;
- Course хранит `CourseAttachment` к этому file;
- image можно добавить как `image` или элемент `slideshow`;
- другой файл можно добавить как `file`;
- проверяются размер, MIME type, ownership и signed access;
- service role не используется в обычном browser flow.

OCR, parsing PDF/DOCX, embeddings и RAG не входят в первый milestone.

## 8. Минимальный MCP

MCP является тонким адаптером над теми же application commands, что использует UI. Он не обращается к таблицам напрямую и не обходит ownership/RLS/validation; сериализованные component RPC дополнительно проверяют actor ownership по `auth.uid()` внутри транзакции.

Минимальные tools:

```text
course.create_draft
course.get
course.add_lesson
lesson.add_component
lesson.set_component_student_screen
lesson.reorder_component
```

Для первого milestone:

- MCP используется только внутренне/development-only;
- публичный внешний endpoint не включается;
- schemas генерируются из registry/application contracts;
- destructive tool не нужен;
- каждое изменение возвращает IDs и краткий результат;
- действия логируются без secrets и полного содержимого private-вложений.

`lesson.add_component` принимает `lessonId` и registry payload/placement,
создаёт Component в ordered list Lesson и оставляет его `staff_only`.
`lesson.set_component_student_screen` выполняет `hide | existing | new`.
`lesson.reorder_component` меняет позицию во всём списке выбранной Lesson и
сохраняет допустимый Slide order.
MCP не принимает `stepId` и не регистрирует tool добавления шага.

OAuth, scoped external tokens, quotas, approvals/change sets и публичный remote MCP реализуются позднее.

## 9. Что не входит в первую демонстрацию

- полноценная AI-генерация большого курса;
- RAG и semantic parsing документов;
- универсальный no-code editor;
- десятки типов игр;
- совместное редактирование;
- scheduling и live sync;
- homework;
- progress/analytics;
- marketplace/templates;
- публикация курса наружу;
- внешний MCP-доступ;
- массовый reset текущей базы или удаление старых миграций.

## 10. Технические ограничения первого этапа

- Работа ведётся в `main`, но небольшими законченными коммитами.
- Используется текущий self-hosted Supabase/Auth/SMTP/Storage-контур.
- `shidao.ru` остаётся landing-only; рабочий интерфейс находится на `v2.shidao.ru`.
- Recovery refs и `.local-backups/v1-snapshot-2026-08-03` не меняются.
- До любого DB write выполняется read-only schema sanity check по `docs/database/current-schema.md` и `supabase/schema/current-schema.sql`.
- Первая реализация использует только новые forward migrations; удаление/перезапись старых migrations не входит в этот milestone.
- При изменении схемы обновляются оба current-schema snapshot.
- Нельзя сохранять demo course только в TypeScript fixtures, localStorage или fallback-массивах.

## 11. Delivered implementation chain

- `20260803142924_v2_course_builder_vertical_slice.sql` — persisted Course,
  Lesson authoring, StoredFile/CourseAttachment и private Storage.
- `20260804033421_course_lesson_components_remove_legacy_methodology.sql` —
  direct Lesson Components и удаление active Methodology/Step/runtime.
- `20260804044955_add_lesson_student_slides.sql` — persisted Slides,
  assignment/reorder/delete RPC и tightened RLS/ACL.
- `99dc9ea` + `db5e50b` — полный tracked archive «Мир вокруг меня».
- `15a00c7` + `9b254b9` — flatten/active legacy cleanup.
- `f5b9a57` — lesson/component card UX.
- `808510e` — persisted Student Screen Slides и deployed application release.
- `65edf0d` — двухуровневая Course → Lesson навигация и проверенный deployed
  application release.

Архив находится в `archive/content/world-around-me-2026-08-04/` и не
подключён к runtime.

## 12. Definition of Done — выполнено

На проверенном release выполнены условия:

1. Преподаватель входит существующим аккаунтом на `v2.shidao.ru`.
2. Нажимает «Курсы» → «Новый курс».
3. Заполняет форму и прикрепляет минимум один файл или изображение.
4. Создаёт Course и получает настоящий persisted draft.
5. «Собрать черновик» создаёт минимум один Lesson и его ordered Components
   непосредственно по `lesson_id`, без Step/root Step.
6. В Course workspace видны ordered components из registry.
7. Преподаватель может добавить, отредактировать, переставить и удалить компонент.
8. Преподаватель назначает компоненты на Slides; Student Screen preview
   показывает один Slide за раз и не возвращает teacher-private данные.
9. После reload всё состояние сохраняется.
10. Другой пользователь не может открыть или изменить чужой Course.
11. Development MCP регистрирует ровно шесть утверждённых tools;
    `lesson.add_component` и `lesson.set_component_student_screen` проверены
    через тот же application service и schema contract, что UI.
12. В коде нет условий по ID demo Course/Lesson, Methodology dependency или
    fixture fallback.
13. Typecheck, unit/integration tests и production build проходят.
14. `shidao.ru` остаётся landing-only, а демонстрация доступна только на `v2.shidao.ru`.

Verification evidence:

- typecheck — pass;
- lint — pass;
- 169 tests — pass;
- production build — pass;
- deployed-contour E2E: create/edit/persist, private-by-default, two Slides, reorder
  through Slide boundary, fullscreen preview, reload — pass;
- deployed-contour browser console warning/error — none.

## 13. Честные ограничения после milestone

- AI button disabled; OpenRouter/provider call отсутствует.
- MCP local/internal only.
- Homework surface не сохраняет данные.
- Course materials после создания можно просматривать, но пока нельзя
  дозагрузить из workspace.
- Attachments не parsed и не indexed.
- Student Screen — owner preview, не learner enrollment/live runtime.

## 14. Сценарий повторной проверки

```text
1. Войти на v2.shidao.ru.
2. Открыть «Курсы» и показать пустой/реальный список.
3. Нажать «Новый курс».
4. Заполнить тему, цель, уровень и число уроков; прикрепить изображение.
5. Нажать «Собрать черновик».
6. Открыть созданный урок и показать ordered components.
7. Добавить цитату, опрос и игру «Найди пару».
8. Поменять два компонента местами.
9. Назначить два компонента на один Slide, ещё один — на new Slide;
   открыть Student Screen preview и пройти оба Slides.
10. Обновить страницу и доказать, что это реальные сохранённые данные.
11. Опционально вызвать MCP tool и показать новый компонент в том же Course после refresh.
```

Цель показа: продемонстрировать не «магию AI», а работающую расширяемую систему — форма, данные, registry, Storage, renderer и MCP соединены в один вертикальный workflow.
