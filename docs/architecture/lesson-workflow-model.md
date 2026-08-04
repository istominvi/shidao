# Lesson workflow model

**Статус:** canonical V2 product architecture

**Дата решения:** 4 августа 2026 года

**Область:** Course Builder / Lesson / Components / Student Screen / course materials / homework

## Product decision

Каноническая авторская модель ShiDao V2:

```text
Course
├── course-wide attachments
└── Lesson 1..N
    └── ordered Components 1..N
```

`Lesson` непосредственно владеет одним упорядоченным списком компонентов.
Между Lesson и Component нет сущности `Lesson Step`, скрытого/root step,
группы совместимости или второго списка для Student Screen.

Это решение относится к domain model, базе, UI, application service, MCP и
AI-orchestration. Упрощённое отображение без шагов — не временная UI-проекция,
а каноническая структура V2.

## Vocabulary

- **Course / Курс** — личный persisted-документ владельца с уроками и
  course-wide вложениями.
- **Lesson / Урок** — редактируемый документ внутри Course. Название обязательно
  и хранится в самой Lesson; комментарий преподавателя хранится в `summary`.
- **Lesson Component / Компонент урока** — элемент единого ordered list Lesson.
- **План урока** — teacher-facing редактор полного списка компонентов.
- **Student Screen / Экран ученика** — learner-facing проекция той же Lesson,
  содержащая только разрешённые ученику компоненты.
- **Материалы курса** — course-wide файлы и изображения, загруженные в private
  Storage и связанные с Course.
- **Домашнее задание** — отдельная поверхность выбранной Lesson.
- **Preview / Предпросмотр** — режим проверки Student Screen внутри Course или
  на отдельной полноэкранной странице.

Термины `Content` для Student Screen, `Lesson Step`, `root step`, `stepId` и
`Methodology` как активная V2-модель не используются.

## Canonical data contract

Минимальная Lesson:

```text
lesson
- id
- course_id
- position
- title
- summary
- created_at
- updated_at
```

Минимальный Component:

```text
lesson_component
- id
- lesson_id
- type_key
- schema_version
- position
- payload
- placement
- visibility: staff_only | learner_visible
- created_at
- updated_at
```

Инварианты:

1. `lesson_id` указывает непосредственно на Lesson.
2. `position` задаёт единственный порядок компонентов внутри Lesson.
3. Позиции после mutation остаются плотными и уникальными в пределах Lesson.
4. Payload и placement валидируются schema выбранного registry type.
5. Заголовок Lesson не создаётся автоматически как компонент `heading`.
6. Пустая Lesson допустима.
7. Component не может существовать без Lesson или одновременно принадлежать
   нескольким Lesson.

## Code-first component registry

Каждый тип компонента определяется один раз в code-first registry. Определение
содержит стабильный key/version, категорию и русское название, payload schema,
placement schema, default payload/placement, capabilities и renderers для
teacher preview и Student Screen.

UI, application service и MCP используют эти же contracts. JSON Schema для MCP
генерируется из того же источника. Добавление типа компонента не требует новой
таблицы и не создаёт отдельную React-страницу для конкретной Lesson.

Обязательный первый registry:

```text
heading
rich_text
callout
quote
divider
image
slideshow
single_choice_poll
matching_game
file
```

## Teacher plan

План выбранной Lesson показывает `lesson.components` в ascending `position`.
Преподаватель может:

- добавить компонент из palette;
- изменить его payload и placement;
- переместить выше или ниже во всём списке Lesson;
- удалить компонент;
- включить или выключить отображение на Student Screen.

На карточке teacher видит состояние видимости. `staff_only` означает, что
компонент остаётся частью плана преподавателя, но отсутствует в learner API.
Приватность обеспечивается server projection и authorization, а не только CSS.

## Student Screen

Student Screen строится детерминированно:

```text
lesson.components
→ filter visibility == learner_visible
→ preserve relative position
→ render through registry Student Screen renderer
```

У Student Screen нет собственной копии порядка, инструкции группы или
параллельной структуры. Изменение payload или порядка сохраняется один раз и
после reload одинаково отражается в teacher preview и learner projection.

Если learner-visible компонентов нет, отображается честное пустое состояние.
Teacher-private компоненты и поля не должны присутствовать в learner response.

Полноэкранный preview может позволять преподавателю переключать Lesson для
проверки курса. Это не задаёт правила будущего live-режима для учащегося.

## Course workspace navigation

В header Course находятся отдельные действия:

- **Настройки** — редактирование основных полей Course;
- **Материалы курса** — просмотр и добавление course-wide attachments.

Для выбранной Lesson используется переключатель:

1. **План урока**;
2. **Экран ученика**;
3. **Домашнее задание**.

Список Lesson остаётся course navigation. Course materials не становятся
четвёртой вкладкой конкретной Lesson.

## Lesson creation

Кнопка «Добавить урок» открывает modal. Обязательное поле — название Lesson;
дополнительный teacher comment сохраняется в `summary`.

Ручное создание сохраняет пустую Lesson и не расходует AI tokens. Будущая
кнопка AI-generation вызывает orchestrator, который создаёт те же Component
entities через application service. Она не создаёт альтернативный тип урока.

До фактического подключения provider UI не утверждает, что Lesson
сгенерирована AI.

## Course materials and Storage

Course attachment:

- загружается в существующий private Storage;
- имеет owner/course relation, MIME type, размер и checksum;
- открывается через ограниченный signed access;
- может быть указан в payload `image`, `slideshow` или `file` после проверки
  ownership;
- не считается проанализированным только из-за успешной загрузки.

OCR, parsing, embeddings и RAG — отдельный pipeline. Отсутствие этого pipeline
не блокирует ручное использование файла в Lesson.

## Homework

Homework принадлежит выбранной Lesson, но не входит в `lesson.components`.
Первая демонстрация может содержать честную заглушку редактора. Когда
persisted homework будет реализовано, оно получит отдельные contracts,
authorization и storage model без возврата групп/шагов в Lesson.

## Application service and MCP

Канонические минимальные commands/tools:

```text
course.create_draft
course.get
course.add_lesson
lesson.add_component
lesson.reorder_component
```

`lesson.add_component` принимает `lessonId`, registry type, payload, placement
и visibility и создаёт Component непосредственно в конце Lesson. Reorder
работает в пределах всего ordered list выбранной Lesson.

MCP — development/internal thin adapter над теми же application services. Он:

- не обращается к таблицам напрямую;
- не принимает и не возвращает `stepId`;
- не регистрирует tool добавления шага;
- использует actor JWT, ownership/RLS и общую schema validation;
- не публикуется как внешний endpoint в первом milestone.

## AI boundary

AI не получает SQL/service-role доступ. Future OpenRouter adapter планирует
Lesson и вызывает typed application commands. Детерминированный assembler и AI
создают одинаковые Lesson/Component entities; смена planning strategy не меняет
domain model или renderer contracts.

Без реально выполненного parsing нельзя утверждать, что attachment был
прочитан или использован моделью. Без provider call нельзя списывать tokens и
называть операцию AI-generation.

## Runtime and future live mode

Текущий milestone реализует persisted authoring и preview, а не live sync.
Будущий `LessonSession` остаётся отдельным исполнением Lesson. Если live mode
потребует presentation cursor, runtime может хранить текущий component id или
индекс, не меняя authored hierarchy и не создавая Step entity.

В live mode по умолчанию teacher управляет learner surface; свободная
предыдущая/следующая навигация учащегося не включается автоматически. Review
может разрешить свободное изучение learner-visible компонентов.

## Active V2 versus archive

Активная V2 не содержит Methodology domain, methodology tables, fixture
fallback или lesson-specific renderer. V1 methodology и её recovery snapshot
остаются неизменяемым историческим источником в архивных Git refs и
`.local-backups`; они не являются runtime dependency.

Импорт архивного содержания, если он будет отдельно одобрен, обязан создать
обычные Course, Lesson, Component и attachment entities через валидируемый
import/application layer. Он не возвращает Methodology в активную модель.

## Non-goals for the first milestone

- обязательная AI-генерация;
- parsing/RAG загруженных файлов;
- persisted homework editor;
- scheduling и live sync;
- drag-and-drop, если надёжные кнопки «выше/ниже» уже обеспечивают reorder;
- внешняя публикация MCP;
- compatibility layer для Step/Methodology;
- отдельные renderers по Course/Lesson ID.

## Acceptance criteria

Канонический vertical slice считается работающим, когда:

1. Course, Lesson, ordered Components и attachments сохраняются в реальной
   базе/Storage и переживают reload.
2. Lesson создаётся без Step/root Step и может оставаться пустой.
3. Component создаётся непосредственно по `lessonId`.
4. Teacher plan показывает весь единый ordered list.
5. Student Screen показывает только `learner_visible` components в том же
   относительном порядке.
6. Teacher-private данные отсутствуют в learner projection.
7. Reorder изменяет порядок во всей Lesson, а не внутри скрытой группы.
8. UI, service и MCP валидируют данные общими registry contracts.
9. В активном V2 нет Methodology/fixture/lesson-specific fallback.
10. Fullscreen preview сохраняет выбранную Lesson и после refresh читает
    persisted state.
