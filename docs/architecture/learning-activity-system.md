# Learning Activity System

**Статус:** каноническое архитектурное решение; CURRENT / NEXT / LATER
**Актуально на:** 20 августа 2026 года
**Область:** Course components, учебные цели, ответы, наблюдения, evidence,
учебный профиль, адаптивность, offline/live и языковые активности

Этот документ отвечает на вопрос, как из компонентов ShiDao собирать не просто
красивые страницы, а проверяемое обучение. Фактическая реализация по-прежнему
фиксируется в [`project-state.md`](../project-state.md), а порядок работ — в
[`roadmap.md`](../roadmap.md). Каноническая authored-структура Lesson описана в
[`lesson-workflow-model.md`](./lesson-workflow-model.md).

## Решение в одном абзаце

ShiDao сохраняет простую структуру:

```text
Course → Lesson → ordered Components
```

Не каждый Component проверяет знания. Текст, изображение или видео могут только
объяснять материал. Интерактивный Component дополнительно получает учебный
контракт: какую цель он проверяет, что делает учащийся, как оценивается ответ,
какая помощь разрешена и какое доказательство можно записать. Результат очного
занятия учитель фиксирует тем же языком наблюдений. Аудируемая история занятий и
ответов является источником истины, а текущее состояние навыков — вычисляемой и
перестраиваемой проекцией поверх этой истории.

## TARGET: как это будет выглядеть для пользователя

### Преподаватель создаёт компонент вручную

Преподаватель выбирает привычный тип, например «Тест с вариантами», и видит
форму на обычном языке:

1. **Что ученик должен научиться делать?** — выбрать существующую цель Course
   или быстро создать новую.
2. **Для чего это задание?** — практика, проверка или опрос без оценки знания.
3. **Что увидит ученик?** — инструкция, вопрос, варианты, медиа.
4. **Что считается успешным ответом?** — правильный вариант, правило проверки
   или критерии преподавателя.
5. **Как помочь?** — подсказки и содержательная обратная связь.
6. **Когда показать решение?** — в рамках выбранного режима выполнения.

Технические версии схем, evaluator keys, fingerprints и веса evidence в этой
форме не показываются. Они принадлежат платформе.

### AI создаёт тот же компонент

AI не создаёт второй вид курса или скрытый JSON, который нельзя отредактировать.
Он заполняет тот же контракт и показывает черновик. Преподаватель проверяет
цель, формулировку, ответ, подсказки и только затем сохраняет обычный Component.

### Учащийся выполняет онлайн-активность

Учащийся получает только безопасную learner-проекцию без ключа ответа. После
отправки сервер проверяет ответ или создаёт задачу ручной проверки. Система
сохраняет не весь снимок страницы, а компактную историческую запись: что именно
было показано, что ответил учащийся, как был оценён ответ, использовались ли
подсказки и к какой цели относится результат.

### Преподаватель ведёт очный урок

На планшете открыт режим «Проведение»: текущий Component и список учащихся. Для
structured observation учитель сначала подтверждает короткий общий критерий —
что именно должно быть наблюдаемо. После этого для каждого доступны быстрые
отметки:

- **самостоятельно**;
- **с помощью**;
- **пока не получилось**;
- **не наблюдал**.

Учитель может создать bulk-черновик «все самостоятельно», изменить исключения и
подтвердить, кого он действительно наблюдал по общему критерию. Каждая
содержательная отметка сразу сохраняется; в конце LessonRun система показывает
детерминированную сводку рядом с отдельным ручным отчётом. Это первый
приоритетный runtime, потому что значительная часть занятий проходит очно.

### Учащийся и преподаватель смотрят учебный профиль

Профиль не сводится к одному проценту. В нём есть три понятных раздела:

- **История** — какие Course и Lessons проходились, когда и с какими
  результатами;
- **Навыки** — что подтверждено, что только формируется и что пора проверить
  снова;
- **Рекомендации** — следующий понятный шаг и причина рекомендации.

Если человек год не практиковался, история не исчезает. Состояние навыка
получает признак «нужна повторная проверка», но система не утверждает без нового
наблюдения, что человек всё забыл.

## CURRENT: что уже существует

В подтверждённом current production baseline:

- Course напрямую владеет Lessons, а Lesson — одним ordered списком Components;
- Student Screen Slides являются только learner-facing presentation projection;
- code-first registry содержит 20 runtime types, из них 19 доступны для нового
  ручного создания;
- payload, placement, defaults и capabilities валидируются общими Zod
  contracts;
- ответы интерактивных renderer сейчас живут только в локальном preview state;
- learner attempts, objective alignment, component evidence и skill state ещё
  не сохраняются;
- current Component payload/read models могут содержать answer keys и являются
  authoring/preview contracts, а не безопасным learner assessment delivery;
- LessonRun и compact LearningRecord уже сохраняют факт занятия, посещаемость,
  teacher comment и рекомендацию повторения;
- learner-safe history/progress уже отделены от teacher-private raw history;
- current production LA-M1 добавляет recorder-owned component-level observations
  открытого фактически started LessonRun, focused teacher workspace и
  read-only Lesson/Course/Learner history;
- observation хранится отдельной строкой на LearningRecord + source Component
  и не расширяет compact LearningRecord, learner-safe history или Component
  payload;
- persisted Homework и детский learner runtime ещё не реализованы.

LA-M1 доставлен DB-first 20 августа 2026 года: exact migration применена с
`COMMIT`, dependent source `25d7855831273ff5feea14473c2870b729ac39b3`
развёрнут Coolify deployment `1001`, а DB/HTTP/API/CSRF/browser postflight
завершён. Полный execution record находится в deployment runbook.

Поэтому ни локально правильный ответ в preview, ни просмотр видео сейчас не
изменяют учебный профиль. Нельзя показывать выдуманный mastery на основании
этих сигналов.

## Неподвижные архитектурные границы

1. **Course → Lesson → ordered Components остаётся единственной authored-
   иерархией.** Learning Activity System не вводит Lesson Step, root Step,
   `stepId` или второй порядок контента.
2. **Slides остаются проекцией.** Адаптивность и live runtime не переставляют
   Components и не создают скрытый порядок внутри Slides.
3. **Homework остаётся отдельной Lesson surface.** Можно переиспользовать
   engines и registry contracts, но не сами mutable `lesson_component` как
   выданную домашнюю работу.
4. **LearningRecord остаётся компактным итогом LessonRun.** Ответы, попытки и
   подробные наблюдения не складываются в один generic JSON этого объекта.
5. **Один code-first registry.** UI, application services, AI и MCP не получают
   конкурирующие каталоги типов.
6. **Manual-first.** Любую базовую настройку можно выполнить без AI и без
   provider tokens.
7. **Preview ничего не пишет в learner history.** Учебные данные появляются
   только в явно авторизованном execution context.

## Главные понятия

Это логические границы. Не каждая из них обязана стать отдельной таблицей в
первой migration. Раздел описывает TARGET contract; отсутствие слова NEXT у
термина ниже не означает, что соответствующая persistence уже существует.

### Component Definition

Описание типа в registry: схемы author payload и learner response,
возможности renderer/editor, допустимые способы проверки, offline/media/
accessibility capabilities и migrations схемы.

У Definition может быть optional `activityFacet`:

```text
ComponentDefinition
├── authoring + rendering contract
└── optional activityFacet
    ├── response modes
    ├── evaluator modes
    ├── evidence rule
    └── meaningful telemetry
```

В target у `rich_text` этот facet отсутствует. У `choice_quiz` он появится, а
poll будет помечен как survey и не будет обновлять предметное знание.

### Component Instance

Конкретный Component в Lesson: вопрос, варианты, контент, primary objective,
роль активности, feedback и optional authored difficulty metadata. Авторская
сложность не становится multiplier evidence без item calibration. В NEXT у
одного Component достаточно одной primary Course objective. Поддержку
нескольких целей нельзя добавлять, пока реальный workflow не докажет
необходимость.

### Learning Objective

Короткое проверяемое умение, принадлежащее Course, например:

> Различает второй и третий тон в знакомых китайских словах.

Тип Component не содержит конкретный навык навсегда. Registry знает, что
`choice_quiz` умеет проверять выбор, а преподаватель или AI связывает конкретный
экземпляр с конкретной Course objective.

В первом objective slice objectives плоские и Course-scoped. Глобальный граф
стандартов, эквивалентности и prerequisites — LATER.

### Issued Activity / execution context

Условия одного реального выполнения: practice/assessment, разрешённые попытки,
reveal policy, deadline, accommodations и источник. Один и тот же authored
quiz может быть мягкой практикой на уроке и строгой проверкой в Homework.

Эти правила нельзя навсегда зашивать в Component Definition. Они могут
принадлежать Component Instance, LessonRun или immutable Homework/publication
assignment в зависимости от контекста.

Instructional hints, раскрывающие часть целевого знания, и accessibility
accommodations хранятся раздельно. Screen reader, captions, extra time или
alternative input не ослабляют evidence автоматически, если проверяемый
construct сохранился.

### Attempt и Response

Attempt — одна отправка ответа учащимся. Response — сам ответ. Первая отправка
до подсказки не перезаписывается исправленным вариантом: исправление является
новой попыткой.

### Evaluation

Результат проверки: correctness, score, rubric outcome и версия
правила/модели, которое приняло решение. Автопроверка выполняется server-side.
Ручная правка преподавателя создаёт новую superseding evaluation и не стирает
первоначальный результат.

### Feedback Delivery

Содержимое обратной связи и факт/время её показа хранятся отдельно от
Evaluation. Одна и та же оценка может получить immediate feedback в practice,
delayed feedback в review или withheld feedback до завершения assessment.

### Teacher Observation

Структурированная отметка преподавателя во время очного или online занятия.
Она имеет learner, LessonRun, Component context, значение, время и автора.
После появления objective alignment новые наблюдения также получают objective
context и могут стать evidence с provenance `teacher_observation`. Старые
component-only наблюдения остаются честной историей и автоматически в mastery
не переосмысливаются.

Bulk entry остаётся способом создать draft, а не автоматической гарантией
evidence. Для влияния на objective state должны быть зафиксированы
objective-aligned opportunity, наблюдаемое действие, понятный критерий,
самостоятельность и teacher confirmation того, что оставшиеся после exceptions
learners действительно наблюдались. LA-M1 сохраняет entry method; confidence
становится отдельным signal только если будущий evidence policy объяснит его
шкалу и назначение.

Current LA-M1 реализует только первый component-level слой этого понятия:

- ровно одна текущая строка на `LearningRecord + source Component`;
- nullable live Component FK и стабильный source UUID-at-time;
- position/type/bounded label/observable criterion-at-time без полного
  Component, Slide или Lesson snapshot;
- `independent | with_support | not_yet`, отсутствие строки как
  `not_observed`, `direct | bulk_confirmed` и optional private note;
- recorder равен recorder родительского LearningRecord; draft меняется только
  пока Run фактически started и открыт, finalized history read-only;
- наблюдение не является objective evidence/mastery до отдельного LA-M2/LA-M3
  policy.

### Learning Evidence

Нормализованное педагогическое доказательство, полученное из evaluation или
teacher observation. Оно отвечает не на вопрос «что нажали», а на вопрос
«какое проверяемое умение и с какой самостоятельностью наблюдалось».

Минимальное evidence rule описывает:

- `claim` — что именно утверждается об objective;
- `observable` — какое действие должно быть реально наблюдено;
- `interpretation` — как response/evaluation превращается в evidence;
- independence rule — какие hints раскрывают целевое знание;
- evaluator/rubric reliability и version;
- delay/transfer context, если он действительно проверялся;
- `learnerStateUpdateGate` — может ли эта запись менять current state.

Correctness и выбранная objective сами по себе ещё не делают задание валидным
доказательством.

### Learner Objective State

Перестраиваемая текущая оценка по одной objective. Это projection из evidence,
а не первичный журнал. В простом варианте достаточно состояний вроде:

```text
нет данных → формируется → подтверждено → пора перепроверить
```

Причина и дата последнего evidence всегда доступны. Ложная точность вроде
«знает на 83%» не показывается без валидированной модели.

### Recommendation

Понятный следующий шаг: повторить, попробовать без подсказки, применить в новом
контексте или перейти дальше. Рекомендация хранит reason code и допускает
teacher override.

## Три разных уровня настройки

Чтобы форма не превратилась в сотню полей, свойства разделяются:

| Уровень    | Что ему принадлежит               | Пример                                                                      |
| ---------- | --------------------------------- | --------------------------------------------------------------------------- |
| Definition | Возможности типа                  | `choice_quiz` поддерживает single/multiple choice и deterministic evaluator |
| Instance   | Содержание и педагогический смысл | вопрос, варианты, primary objective, feedback                               |
| Execution  | Условия конкретной выдачи         | практика или assessment, число попыток, reveal, deadline                    |

Так один и тот же Component engine переиспользуется без копирования логики, а
учитель видит только поля, которые нужны в текущем контексте.

## Контракт ручного и AI-редактора

### Основная форма

Для assessable Component форма обязана позволять настроить:

- primary learning objective;
- activity role: `practice | assessment | survey`;
- learner-facing instruction/prompt;
- response options или допустимый response format;
- correct answer, evaluator rule или teacher rubric;
- feedback для успеха и типичных ошибок;
- hint ladder, если тип её поддерживает;
- базовую reveal/retry policy для выбранного контекста;
- learner accessibility: alt, transcript, captions, keyboard alternatives.

### Progressive disclosure

Сначала показываются необходимые поля. «Дополнительно» открывает варианты
нормализации ответа, partial credit, randomization и другие редкие настройки.
Платформа даёт разумные defaults и сразу показывает learner preview.

### Единый contract

Manual editor, deterministic templates, AI preview/apply и development MCP
вызывают одни application contracts. AI-результат всегда остаётся editable
draft. Provider-specific поля в persisted Component не попадают.

## Компоненты и педагогические роли

Полный текущий и планируемый каталог находится в
[`course-component-catalog.md`](../product/course-component-catalog.md). На
уровне архитектуры важны пять семейств.

### 1. Content и resources

Текст, callout, quote, image, audio, video, slideshow, vocabulary list, file и
external link объясняют или показывают материал. Их просмотр может дать
product/context telemetry, но не mastery evidence.

### 2. Survey

Poll, reflection и opinion prompts собирают мнение, уверенность или обратную
связь. Самоотчёт «я понял», уверенность или мнение не доказывают предметное
владение даже при наличии rubric. Если exit ticket содержит отдельное решение
или объяснение, evidence может дать только эта constructed response, а не
self-report часть.

### 3. Deterministic practice

Choice, fill blanks, word bank, matching, sequence, categorize и word builder
имеют однозначный или частично однозначный evaluator. Общие response/evaluation
engines важнее десятков почти одинаковых React-компонентов.

### 4. Constructed response и teacher review

Free response, voice response, file/project response и устное выступление
требуют rubric, review workflow или проверенного специализированного evaluator.

### 5. Учебные recipes

Следующие сущности лучше строить как конфигурации общих primitives, а не как
независимые runtime engines:

- worked example и partially completed example;
- self-explanation;
- error analysis;
- scenario application;
- transfer challenge;
- confidence calibration;
- reflection / exit ticket;
- spaced retrieval card;
- interactive media checkpoint.

`learning_goal` является метаданными Lesson/objective, `hint_ladder` — support
policy, а gate/branch/review queue — orchestration. Они не становятся скрытыми
Lesson Components или Steps.

## Что именно хранить после ответа

### Не полный снимок страницы

Для истории не нужен полный JSON Component с layout, цветами и всеми полями.
Нужен компактный at-time envelope, достаточный для ответа на вопросы «что видел
учащийся?» и «почему система поставила такой результат?»:

- learner и actor/provenance;
- Course, Lesson, optional LessonRun/assignment и objective context;
- source Component/revision/fingerprint и type;
- точная инструкция или вопрос, показанные учащемуся;
- относящиеся к ответу варианты/значения, если без них ответ непонятен;
- фактический response: выбранный id и текст, введённое значение или asset ref;
- correctness/score/rubric result;
- попытка, подсказка, reveal и уровень поддержки;
- evaluator/rubric/model version;
- server-private evaluator config at time, необходимый для воспроизводимости,
  либо ссылка на immutable issued definition revision; answer key не входит в
  learner delivery;
- время и supersession link при исправлении оценки.

Стабильные поля, по которым выполняются доступ и основные запросы, должны быть
типизированы. Различающаяся по типам часть prompt/response может быть
валидируемым versioned JSON. Giant untyped event lake в первом срезе не нужен.

### Почему одного current Component id недостаточно

Преподаватель может изменить или удалить вопрос. Тогда старый ответ всё равно
должен оставаться понятным. Поэтому сохраняется компактный prompt/response
envelope либо ссылка на действительно immutable publication/assignment
revision. Fingerprint без содержимого помогает обнаружить изменение, но не
объясняет старый результат.

### Безопасная learner projection

Author payload и evaluator payload могут содержать правильный ответ. Learner
delivery payload его не содержит. Нельзя отдавать текущий raw Component JSON и
надеяться скрыть ключ CSS или JavaScript. Сервер принимает response, выполняет
проверку и возвращает только разрешённый feedback/reveal.

## История и текущее состояние — разные данные

### История

Finalized история является логически append-only источником истины:

```text
Course → Lesson → LessonRun/assignment → Attempt или Observation → Evaluation
```

Она сохраняет, что изучалось, когда, в каком контексте и с какой поддержкой.
История нескольких Course остаётся общей историей LearnerProfile, но доступ к
raw teacher observations сохраняет recorder/subject/observer boundary.

Draft observations могут изменяться или удаляться до completion. После
finalization исправление создаёт superseding record, а не тихо переписывает
старую оценку. Retention, законное удаление и subject erasure могут физически
удалить или обезличить данные; `append-only` не означает «хранить PII вечно».

### Текущее состояние

Objective state вычисляется из истории детерминированным policy и может быть
полностью перестроено после merge, correction, erasure или изменения policy.
В начале достаточно простых объяснимых правил. AI не перечитывает все сырые
ответы после каждого Lesson и не записывает «истину» напрямую.

### Роль AI

AI может:

- суммировать структурированную историю понятным языком;
- предложить следующий шаг и объяснить его;
- распознать teacher dictation и подготовить черновик наблюдений;
- предложить rubric evaluation для подтверждения преподавателем.

AI inference маркируется как предложение, содержит evidence references и не
перезаписывает исходные записи.

## Очное проведение как первый runtime

### Первый полезный runtime — current production LA-M1

Первый implementation slice использует существующий started LessonRun и его
конкретный roster. Scheduled Run сначала запускается, а started Run можно
возобновить; до `started_at` observations не записываются. Slice сохраняет
component-level teacher observations, но ещё не объявляет их objective mastery.
Режим «Проведение» идёт по полному authored Component order, а не по Slides:
преподаватель может вести занятие с проектором, без экрана у детей или вообще
только с собственным планшетом.

Минимальный UX:

1. текущая Lesson и Component; primary objective добавляется следующим
   отдельным срезом;
2. короткий общий observable criterion-at-time; passive Component остаётся в
   navigator, но без критерия structured rating не создаётся; UI может
   предложить editable draft из Component instruction, но teacher явно его
   подтверждает;
3. компактный roster;
4. одно нажатие на состояние learner;
5. bulk-черновик «все самостоятельно», быстрые исключения и явное
   подтверждение оставшихся наблюдавшихся learners;
6. optional короткая заметка;
7. мгновенное сохранение и понятное состояние сохранения или ошибки;
8. deterministic summary рядом с существующим ручным teacher report при
   завершении LessonRun.

Первая версия поддерживает очное занятие при наличии сети. Настоящая
network-offline очередь и синхронизация являются отдельным улучшением.

Current application boundary — `src/modules/learning-activities/`.
Authenticated
`GET|PUT /api/v2/lesson-runs/[lessonRunId]/observations` остаётся adapter над
service; React не пишет в таблицу напрямую. Один narrow batch RPC сериализует
lock order `Lesson → Component → LessonRun → LearningRecord`, проверяет actor,
ownership, actual start, открытый Run, Component той же Lesson и expected draft
records. Authenticated имеет recorder-scoped raw `SELECT`, но не raw
`INSERT|UPDATE|DELETE`; mutation разрешена только через RPC. Completion
блокирует комбинацию `absent + observation`, не вычисляя attendance,
`needs_repeat` или teacher report из rating.

`не наблюдал` означает отсутствие педагогического evidence, а не нулевой балл.
Отсутствие на Lesson также не означает непонимание.

### Голосовая фиксация

После устойчивого manual flow добавляется push-to-talk:

> «Серёжа сделал самостоятельно. Наташе и Кате нужна помощь с третьим тоном».

Pipeline:

```text
record on explicit press
→ speech-to-text
→ parser proposes learner/objective/status/note
→ teacher reviews or edits
→ explicit confirm
→ structured observations are saved
```

Непрерывная запись класса не входит в первый срез: детские данные, шум,
speaker diarization, consent, retention и стоимость делают её отдельным
privacy-reviewed решением. Система не идентифицирует ребёнка по голосу.

## Языки, reference audio и произношение

Нужно разделять две разные задачи.

### Reference audio

Преподаватель вводит текст, язык, голос и скорость, генерирует audio, слушает и
подтверждает результат. После подтверждения сохраняется versioned asset; его не
нужно генерировать заново при каждом воспроизведении.

### Learner speech

Учащийся записывает свой ответ. Первый реалистичный slice:

1. запись и безопасная загрузка;
2. воспроизведение рядом с reference audio;
3. manual teacher rubric/comment;
4. optional AI transcription/evaluation proposal;
5. teacher-confirmed evidence.

Специализированная автоматическая оценка произношения — LATER. Обычная speech-
to-text модель не доказывает качество произношения. Для китайского отдельно
важны content, initials/finals, tones и prosody; один «магический процент» это
не объясняет.

TTS, transcription и pronunciation scoring вызываются через provider-neutral
adapters. Provider выбирается benchmark по языку, возрасту, classroom noise,
latency, privacy и стоимости, а не зашивается в доменную модель.

## Telemetry: собирать только то, что можно объяснить

Сигналы разделяются:

| Класс    | Примеры                                                 | Может сам обновить objective state        |
| -------- | ------------------------------------------------------- | ----------------------------------------- |
| Evidence | evaluated response, delayed recall, teacher observation | Да, по versioned policy                   |
| Context  | попытки, подсказки, latency, pause/seek, abandon        | Нет; только квалифицирует evidence или UX |
| Product  | открытие, scroll, video completion, streak              | Нет                                       |

Каждое событие получает заранее определённые purpose, producer, consumer,
privacy class и retention. Не собираются по умолчанию pointer trails,
поклавишные логи, gaze, emotion, постоянный microphone/camera stream или
выводы «ленивый», «невнимательный», «visual learner».

Completion, performance, mastery и engagement никогда не являются синонимами.
Видео, просмотренное до конца, подтверждает просмотр, но не понимание.

## Педагогические принципы

1. **Сначала цель и наблюдение, потом задание.** Activity должна быть способна
   породить evidence именно для заявленной objective.
2. **Retrieval укрепляет уже понятый материал.** После первичного объяснения
   самостоятельное извлечение обычно полезнее простого повторного просмотра;
   первая попытка до подсказки сохраняется отдельно.
3. **Feedback объясняет расхождение и следующий шаг.** Одного «неверно» или
   похвалы недостаточно.
4. **Instructional support квалифицирует evidence.** Успех с подсказкой,
   раскрывающей целевое знание, полезен, но не равен самостоятельному delayed
   recall. Construct-irrelevant accessibility accommodation его не ослабляет.
5. **Mastery требует нескольких наблюдений.** Последний балл, completion или
   одна попытка не доказывают устойчивое владение.
6. **Spacing зависит от цели удержания.** Универсального интервала для всех
   навыков нет.
7. **Interleaving используется осмысленно.** Перемешиваются задания, где нужно
   различать похожие категории или процедуры, а не весь Course случайно.
8. **Worked examples и progressive support помогают новичку.** Уровень
   поддержки может адаптироваться по evidence конкретной objective, но политика
   fading проверяется на результатах и не считается универсальным правилом.
9. **Один ясный фокус.** Декоративный шум, split attention и лишние действия
   ухудшают обучение.
10. **Учащийся понимает решение системы.** Рекомендация показывает причину и
    допускает teacher override.

## Адаптивность по этапам

### NEXT: прозрачные правила

- предложить повтор после `пока не получилось`;
- предложить попытку без подсказки после успеха с помощью;
- поставить objective в review queue по freshness;
- рекомендовать следующий Lesson, не меняя authored Component/Slide order;
- сохранить reason code и разрешить teacher override.

### LATER: spaced review и модели

После evidence-quality audit можно вводить versioned scheduler, item
calibration, BKT/IRT/Elo/Half-Life и model-assisted recommendations. Они
оцениваются по delayed retention, transfer, fairness и достижению учебной цели,
а не только по clicks, session count или prediction accuracy.

## Design и accessibility contract

Компонент высокого уровня обязан:

- иметь один главный вопрос или действие на поверхности;
- одинаково понятно работать на телефоне, планшете, desktop и проекторе;
- поддерживать keyboard/focus и screen reader semantics;
- иметь alt/captions/transcript и не полагаться только на цвет;
- сохранять touch targets и читаемость при zoom;
- явно показывать состояние: не начато, ввод, отправлено, проверяется, feedback;
- сохранять введённый ответ при временной ошибке сети;
- использовать спокойную визуальную иерархию без лишней геймификации;
- объяснять ошибку и следующий шаг рядом с действием.

Accessibility и responsive behavior являются частью registry contract и
contract tests, а не финальной косметической проверкой.

## Что сознательно откладывается

- глобальный граф навыков и внешние стандарты objectives;
- сложные веса evidence и один универсальный mastery percentage;
- скрытая перестройка Course AI-моделью;
- generic event lake;
- десятки новых component types до проверки общих engines;
- continuous classroom recording и voice biometrics;
- fully automatic high-stakes essay/pronunciation grading;
- BKT, IRT и другие статистические модели до накопления качественных данных;
- xAPI, Caliper, QTI и SCORM как внутренняя доменная модель.

Стандарты могут появиться как adapters вокруг собственного versioned contract.

## Порядок реализации

Подробный план и Definition of Done находятся в
[`learning-activity-system-implementation.md`](../plans/learning-activity-system-implementation.md).
Коротко:

1. **CURRENT:** быстрые component-level teacher observations поверх
   существующего LessonRun, без заявления mastery;
2. **NEXT:** Course objectives, один primary objective на Component и optional registry
   activity facet;
3. **NEXT:** history/objective-state projection для objective-aligned
   observations;
4. **NEXT:** learner authorization и teacher-controlled live delivery;
5. **NEXT:** один полный `choice_quiz` через learner-safe delivery и server
   evaluation;
6. **NEXT:** Homework/free-response review;
7. **LATER:** reference audio, learner recording и teacher review;
8. **LATER:** только затем advanced sequencing, spaced review и статистические
   модели;
   простые reason-coded recommendations уже входят в profile slice.

## Уроки существующих систем

- **ProgressMe:** брать быстрый authoring, историю попыток, ручную проверку и
  teacher-led classroom workflow; не смешивать результаты Lesson и Homework.
- **Articulate Rise:** брать простоту stacked authoring, responsive defaults и
  progressive disclosure; не считать просмотр Course доказательством знания.
- **H5P:** брать versioned registry/schema и разделение editor/runtime; внутри
  ShiDao обязательный evidence contract должен быть строже неоднородных xAPI
  events отдельных типов.
- **Canvas и Moodle:** разделять completion, grade/outcome и правила доступа;
  начинать с объяснимых rules, не строить grade-centric LMS.
- **Open edX:** разделять content definition, placement, user state и aggregate
  state; не переносить тяжёлую plugin-иерархию.
- **Khan Academy:** mastery подтверждается несколькими видами и моментами
  проверки, может требовать повторной проверки.
- **Duolingo:** AI выбирает из ограниченного автором множества; memory models
  полезны как ориентир, но prediction recall и engagement сами по себе ещё не
  доказывают прирост долговременного обучения.

Полезные первичные источники:

- [ProgressMe: работа с упражнениями](https://help.progressme.ru/article/1233)
- [H5P specification](https://h5p.org/documentation/developers/h5p-specification)
- [H5P and xAPI](https://h5p.org/documentation/x-api)
- [Rise lesson and block types](https://www.articulatesupport.com/article/Rise-Lesson-and-Block-Types)
- [Khan Academy mastery](https://support.khanacademy.org/hc/en-us/articles/360007253831-Using-self-paced-practice-and-Mastery-in-the-classroom)
- [Duolingo Half-Life Regression paper](https://aclanthology.org/P16-1174/)
- [Retrieval practice meta-analysis](https://doi.org/10.1037/bul0000309)
- [Spacing meta-analysis](https://pubmed.ncbi.nlm.nih.gov/16719566/)
- [Feedback meta-analysis](https://pmc.ncbi.nlm.nih.gov/articles/PMC6987456/)
- [WCAG 2.2](https://www.w3.org/TR/WCAG22/)
- [UNESCO Recommendation on the Ethics of AI](https://www.unesco.org/en/legal-affairs/recommendation-ethics-artificial-intelligence)

## Правило изменения архитектуры

Любой новый assessable Component или execution context обязан до реализации
ответить на вопросы:

1. Какую objective он способен проверять?
2. Что является response и где его схема?
3. Кто и какой версией evaluator принимает решение?
4. Что увидит learner без утечки ключа?
5. Какой compact history envelope сохранится?
6. Какое evidence создаётся и что его ослабляет?
7. Кто имеет доступ и как работают correction/merge/erasure?
8. Какие события действительно нужны и каков их retention?
9. Как компонент работает с keyboard, screen reader, touch и offline failure?
10. Как учитель вручную создаст и проверит всё это без AI?

Если на эти вопросы нет ответа, это пока UI prototype, а не production Learning
Activity.
