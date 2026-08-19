# Каталог компонентов Course Builder

**Статус:** CURRENT registry + NEXT/LATER product catalog
**Актуально на:** 19 августа 2026 года

Этот документ отвечает на три вопроса:

1. какие Component types уже существуют в ShiDao;
2. какую учебную роль они могут выполнять;
3. какие engines и recipes следует развивать дальше.

Педагогический и data contract находится в
[`Learning Activity System`](../architecture/learning-activity-system.md).
Канонический список runtime keys хранится только в code-first registry. Таблицы
ниже являются продуктовой проекцией и не создают второй registry.

## Главный принцип каталога

Количество карточек в palette не равно количеству технических engines.
Преподавателю можно предложить много понятных шаблонов, но внутри платформы
должно оставаться немного хорошо проверенных primitives:

```text
content/media
choice
cloze/text input
matching/classification/order
constructed response
media response
```

Например, «Верно/неверно», «Один вариант» и «Несколько вариантов» могут быть
presets одного choice engine. Worked example, self-explanation и exit ticket
могут быть recipes из общих content/response/feedback primitives. Так scoring,
telemetry, accessibility и исправления не расходятся между десятками похожих
реализаций.

## CURRENT: 20 runtime types

### Content и resources

| Type              | Назначение                          | Current boundary                                   | Создаёт learning evidence |
| ----------------- | ----------------------------------- | -------------------------------------------------- | ------------------------- |
| `rich_text`       | Заголовок и/или Markdown-текст      | Ручное создание и редактирование                   | Нет                       |
| `callout`         | Пояснение, правило, заметный акцент | Ручное создание и редактирование                   | Нет                       |
| `quote`           | Цитата с optional автором           | Ручное создание и редактирование                   | Нет                       |
| `heading`         | Legacy отдельный заголовок          | Runtime/edit compatibility; новое создание закрыто | Нет                       |
| `image`           | Одно изображение                    | Existing Storage/reference contract                | Нет                       |
| `video`           | Видео по HTTPS URL                  | Без upload/transcoding                             | Нет                       |
| `audio`           | Аудио с optional transcript         | Только HTTPS URL                                   | Нет                       |
| `slideshow`       | Галерея изображений                 | Existing asset contract                            | Нет                       |
| `vocabulary_list` | Термины и переводы/определения      | Не обновляет learner vocabulary state              | Нет                       |
| `external_link`   | Ссылка на внешний материал          | Только HTTPS; без embed telemetry                  | Нет                       |
| `file`            | Attachment                          | Existing Storage/reference contract                | Нет                       |

### Survey

| Type                 | Назначение                           | Current boundary        | Создаёт learning evidence |
| -------------------- | ------------------------------------ | ----------------------- | ------------------------- |
| `single_choice_poll` | Мнение, выбор, быстрый вопрос группе | Local interactive state | Нет; это survey           |

### Deterministic practice

| Type            | Учебное действие                   | Current boundary                    | NEXT evaluator role        |
| --------------- | ---------------------------------- | ----------------------------------- | -------------------------- |
| `choice_quiz`   | Выбрать один или несколько ответов | Самопроверка только в preview state | Recognition/discrimination |
| `fill_blanks`   | Ввести ответы в пропуски           | Самопроверка только в preview state | Cued production            |
| `word_bank`     | Заполнить пропуски из банка        | Самопроверка только в preview state | Cued selection             |
| `matching_game` | Сопоставить пары                   | Local interactive state             | Association/discrimination |
| `sequence`      | Восстановить порядок               | Local interactive state             | Ordered procedure          |
| `categorize`    | Распределить по категориям         | Local interactive state             | Classification             |
| `word_builder`  | Собрать слово из букв              | Самопроверка только в preview state | Constrained production     |

### Constructed response

| Type            | Учебное действие                        | Current boundary                              | NEXT evaluator role          |
| --------------- | --------------------------------------- | --------------------------------------------- | ---------------------------- |
| `free_response` | Написать короткий или развёрнутый ответ | Текст только в preview; review не сохраняется | Teacher rubric/manual review |

CURRENT palette показывает 19 вариантов создания и исключает legacy
`heading`. UI, service и renderer используют registry contracts. AI provider
adapter выдаёт ограниченный structured draft, который повторно валидируется
тем же registry/application contract; development MCP вызывает те же services.
Это adapters, а не второй registry. Интерактивные ответы пока не сохраняются и
не меняют учебный профиль.

Current raw Component payload может содержать correct-answer configuration.
Поэтому существующий preview/read model нельзя считать learner-safe assessment
delivery; этот serializer и server evaluator появляются отдельным slice.

## NEXT: что обязательно описывает тип

### Для каждого Component Definition

- стабильный key и schema version;
- author payload schema, defaults и migration strategy;
- placement и доступные Lesson contexts;
- editor и renderer capabilities;
- teacher plan, Student Screen, preview и future Homework projections;
- responsive/accessibility contract;
- privacy/media/storage classification;
- fixtures и contract tests.

### Дополнительно для assessable activity

- response modes и versioned response schema;
- learner-safe delivery projection без answer key;
- допустимые evaluator modes и их версии;
- server-private evaluator-config-at-time или immutable issued definition
  revision для воспроизводимости старой оценки;
- practice/assessment/survey capability;
- feedback, hints, retry и reveal capabilities;
- какие at-time данные нужны для понятной истории;
- evidence rule: claim, observable, interpretation, independence/support и
  learner-state update gate;
- allowlisted telemetry с purpose и retention;
- offline/reload/idempotency behavior.

Конкретная objective, вопрос и правильный ответ принадлежат Component Instance,
а попытки/deadline/reveal конкретной выдачи — execution policy. Тип описывает
возможности, но не зашивает один навык и один режим навсегда.

## NEXT: ручной authoring UX

Для обычного преподавателя contract отображается не как JSON, а как
последовательная форма:

1. **Учебная цель** — выбрать или создать Course objective.
2. **Режим** — практика, проверка или опрос.
3. **Задание** — инструкция, вопрос, content/media.
4. **Ответ** — варианты, правильный ответ или rubric.
5. **Помощь** — hints и содержательный feedback.
6. **Выполнение** — попытки и reveal только там, где они реально нужны.
7. **Предпросмотр** — точная learner-safe поверхность.

Advanced-поля скрываются до раскрытия. AI заполняет ту же форму и создаёт
редактируемый draft; teacher может выполнить весь workflow вручную.

## NEXT: план развития существующих engines

### Foundation

1. Добавить optional `activityFacet` в существующий registry, не создавая
   второй каталог.
2. Добавить Course-scoped objectives и один optional primary objective на
   Component.
3. Разделить author/evaluator payload и learner delivery payload.
4. Ввести единый `ActivityFrame`: instruction, response area, submit/status,
   feedback, hint/retry и accessible announcements.
5. Добавить contract tests: no answer leak, keyboard/focus, responsive states,
   idempotent submit и reload behavior.

### Первый online engine: `choice_quiz`

Он должен пройти полный путь:

```text
manual/AI authoring
→ learner-safe delivery
→ persisted attempt
→ server evaluation
→ feedback delivery
→ compact history
→ learning evidence
```

Только после этого shared deterministic engine доказывается на `fill_blanks`,
а затем на matching/sequence/categorize/word-bank/word-builder.

### Первый review engine: `free_response`

Отдельный slice добавляет autosave, final submit, rubric version, teacher review,
return for revision, superseding evaluation и privacy/retention raw response.
Его нельзя незаметно включить в первый choice slice: это другой state machine.

## NEXT: offline classroom observation

Teacher observation не является визуальным learner Component type. Это runtime
surface поверх существующих Lesson Components/objectives и LessonRun roster.
Full Lesson navigator показывает и passive Components, но structured rating
требует короткого подтверждённого observable criterion-at-time.

Первый набор действий:

- `самостоятельно`;
- `с помощью`;
- `пока не получилось`;
- `не наблюдал`;
- bulk draft + exceptions + teacher confirmation наблюдавшихся learners;
- optional note;
- push-to-talk proposal после устойчивого manual flow.

Так offline и online evidence сходятся в профиле, не вынуждая учителя давать
каждому ребёнку устройство.

## NEXT recipes поверх общих primitives

| Recipe                       | Зачем нужен                                    | Из чего собирается                                 |
| ---------------------------- | ---------------------------------------------- | -------------------------------------------------- |
| Worked example               | Показать ход решения новичку                   | content + stages + explanation                     |
| Example completion           | Дать частично решённый пример                  | worked example + cloze/response                    |
| Self-explanation             | Попросить объяснить шаг или выбор              | prompt + free response + rubric                    |
| Error analysis               | Найти и исправить ошибку                       | scenario + choice/free response + feedback         |
| Retrieval card               | Вспомнить без повторного просмотра             | prompt + response + delayed scheduling             |
| Scenario application         | Применить правило в ситуации                   | content + choice/constructed response              |
| Transfer challenge           | Проверить применение в новом контексте         | scenario + described transfer distance             |
| Confidence calibration       | Сравнить уверенность до feedback с результатом | confidence survey + assessed response              |
| Reflection / exit ticket     | Зафиксировать понимание и вопрос               | self-report не mastery; assessed response отдельно |
| Interactive media checkpoint | Остановить media и спросить по смыслу          | video/audio + embedded activity orchestration      |

Recipe не обязан иметь отдельный database type. Если он использует те же
response/evaluation engines, его можно хранить как template/preset.

Название `transfer challenge` и authored difficulty сами не усиливают evidence.
Нужны сохранённый construct, описанная дистанция переноса и валидный evaluator.

## LATER domain packs

### Языки

- dictation;
- listening comprehension;
- reference audio generation;
- learner audio response;
- dialogue/role-play;
- pronunciation practice с teacher rubric;
- specialized pronunciation scoring после benchmark.

Reference TTS и learner speech evaluation являются разными services. Audio
после teacher approval сохраняется versioned asset. Обычный ASR не считается
полноценной оценкой произношения.

### Математика и естественные науки

- numeric/formula response;
- guided solution;
- graph/table interpretation;
- units and significant figures;
- simulation/lab observation;
- code runner только в изолированном sandbox.

### Проектное и социальное обучение

- file/project submission;
- rubric milestones;
- peer/self review;
- discussion/collaboration;
- portfolio evidence.

Эти packs добавляются после общих response/evaluation/review engines, а не
раньше них.

## Что не является Component

- `learning_goal` — Course/Lesson metadata и objective presentation;
- `hint_ladder` — support policy;
- `gate` и `branch` — transparent orchestration policy;
- `review_queue` — learner/teacher runtime surface;
- `question_bank` — reusable content source;
- `quiz assembler` — способ собрать issued activity;
- `teacher observation` — LessonRun evidence producer;
- `LearnerObjectiveState` — профильная projection.

Эти понятия не должны занять позиции в Lesson и вернуть скрытый Step.

## Внешние компоненты и embeds

Miro, Wordwall, LearningApps и произвольный iframe не добавляются как быстрый
способ расширить palette. До production нужны allowlist, CSP/sandbox,
authorization, privacy, accessibility и честная маркировка того, какие ответы
ShiDao действительно получает. Внешний completion нельзя автоматически считать
learning evidence.

## Чему учимся у других продуктов

- [ProgressMe](https://help.progressme.ru/article/1233) показывает ценность
  одного workflow для попыток, ручной проверки и занятия с преподавателем.
- [Articulate Rise](https://www.articulatesupport.com/article/Rise-Lesson-and-Block-Types)
  показывает, насколько простым может быть responsive authoring.
- [H5P](https://h5p.org/documentation/developers/h5p-specification) показывает
  пользу versioned schemas и отделения editor/runtime libraries.
- [Open edX XBlock](https://docs.openedx.org/projects/xblock/en/latest/xblock.html)
  разделяет definition, usage и user state.
- [Khan Academy](https://support.khanacademy.org/hc/en-us/articles/360007253831-Using-self-paced-practice-and-Mastery-in-the-classroom)
  не сводит mastery к одному последнему ответу.

Мы берём проверенные идеи, но не копируем внутренние названия, payload или
grade-centric иерархию сторонних систем.

## AI boundary

CURRENT RouterAI planning создаёт только ограниченный allowlist типов и
повторно валидирует provider output registry contracts перед Apply. Расширение
allowlist выполняется по одному проверенному recipe/type и требует:

- author schema и понятного manual editor;
- provider schema/prompt;
- preview и explicit teacher Apply;
- learner-safe projection;
- evaluator/evidence contract, если activity оценивается;
- fault, accessibility и security regression tests.

AI не получает отдельный «умный компонент», который невозможно создать,
исправить или проверить вручную.
