# Lesson workflow model

**Статус:** Canonical product architecture (documentation baseline)  
**Дата:** 18 апреля 2026  
**Область:** lesson plan / student screen / materials / homework / runtime execution

## Product decision

ShiDao — methodology-driven продукт. Канонический урок в онлайн/оффлайн формате описывается как **единая упорядоченная последовательность Lesson Step (Шаг)**.

Каждый Шаг имеет две согласованные стороны:

1. **Teacher Side** — приватный методический план преподавателя (как вести шаг).
2. **Learner Side (Student Screen / Экран ученика)** — что видит ученик на текущем шаге.

Ключевая продуктовая договорённость:

- у Teacher Side и Learner Side одинаковые номера шагов;
- у Teacher Side и Learner Side одинаковые названия шагов;
- teacher управляет переходами между шагами во время live-урока;
- learner может взаимодействовать только внутри текущего шага (если шаг это разрешает).

## Vocabulary

- **Lesson Step / Шаг** — каноническая продуктовая единица урока.
- **Teacher Side** — педагогические инструкции и сценарий для преподавателя.
- **Learner Side / Student Screen / Экран ученика** — экран ученика для live и review режимов.
- **Materials Library / Материалы** — библиотека открываемых/скачиваемых ресурсов (PDF, презентации, видео, аудио, карточки, worksheet и т.д.).
- **Live Lesson Mode / Live-урок** — teacher-controlled режим проведения scheduled lesson.
- **Review Mode / Повторение после урока** — режим после завершения урока, где ученик может свободно переходить между шагами.
- **Source Layer** — методический read-only слой (методология, канонические шаги, learner content, homework definition).
- **Runtime Layer** — scheduled lesson исполнение (status, teacher actions, future current step sync, homework issue/review, communication, future attendance/telemetry).

## Canonical teacher tabs

Канонические teacher-facing вкладки для урока:

1. **План урока** — Teacher Side (приватная методическая опора, шаги, инструкции).
2. **Экран ученика** — Learner Side player (что показывается ученикам шаг за шагом).
3. **Материалы** — библиотека файлов/ресурсов урока.
4. **Домашнее задание** — post-lesson задание и проверка.

Дополнительные runtime-вкладки (например, чат, проведение) допустимы по контексту, но не заменяют четыре базовые педагогические поверхности.

Термин **«Контент / Content» как название learner-facing вкладки является deprecated** для этого продуктового сценария.

## Lesson step model

Каноническая модель урока:

- урок = ordered list of Steps (`1..N`);
- каждый Step имеет `title` и `order`;
- у каждого Step есть Teacher Side и Learner Side;
- обе стороны описывают один и тот же педагогический момент, а не разные независимые структуры.

Недопустимо по умолчанию:

- разрывать parity (например, 16 teacher steps против 8 несвязанных learner scenes);
- менять названия шагов между teacher и learner представлениями;
- смешивать teacher-private инструкции прямо на learner экране.

## Teacher-side step

Teacher Side шага включает:

- педагогическую цель шага;
- действия преподавателя;
- ожидаемые ответы/реакции учеников;
- методические подсказки;
- список нужных материалов для шага.

Teacher Side остаётся приватным представлением для преподавателя и не копируется дословно в Student Screen.

## Learner-side step / Student Screen

Learner Side шага включает:

- текущий номер и название шага;
- визуальные и аудио блоки для ученика;
- интерактивные блоки (когда предусмотрено): play/pause/rewind, выбор ответов, нажатия на изображения, прослушивание аудио и т.д.;
- краткую понятную формулировку задания на текущий шаг.

Даже если шаг преимущественно офлайн/физический, в Student Screen всё равно должен быть learner-side блок-плейсхолдер с тем же номером и названием шага (например: «Шаг 6 · Игра с карточками»).

## Live lesson mode

В live mode (во время scheduled lesson):

- teacher определяет текущий step;
- ожидается, что все ученики находятся на одном текущем step;
- learner previous/next navigation отключена по умолчанию;
- learner взаимодействует только внутри текущего шага;
- teacher может вести урок из двух control surfaces:
  - из **Плана урока** (например, «Показать этот шаг ученикам», «Следующий шаг»);
  - из **Экрана ученика** (presentation-like режим);
- обе control surfaces управляют одним и тем же runtime current step (target architecture).

## Post-lesson review mode

После завершения урока:

- тот же Student Screen открывается ученику как материал повторения;
- learner получает свободную навигацию по шагам (previous/next);
- содержание шага не дублируется в отдельный «другой» экран: используется тот же Learner Side, но в другом режиме доступа.

## Materials library

**Материалы (Materials Library)** — отдельный продуктовый контур от Student Screen.

Материалы включают:

- презентации;
- PDF-карточки;
- видео/аудио файлы;
- песни;
- worksheet/appendix.

Материалы — это ресурсная библиотека для открытия/скачивания и подготовки к уроку. Это не равно live/review player для ученика.

## Runtime state and future live sync

Текущий runtime слой хранит scheduled lesson и связанные runtime-сущности (homework assignments, communication). В целевой архитектуре live execution дополнительно потребует runtime-состояние синхронизации шага.

Target direction (план):

- runtime `current_step_index`/`current_step_id` для live lesson;
- режимные флаги live vs review;
- аудит изменений шага и управляющих действий teacher;
- права доступа к навигации в зависимости от режима.

В рамках этого документа изменения БД **не выполняются**.

## Telemetry and teacher monitoring

Планируемые (future) возможности teacher monitoring:

- присутствие учащихся на уроке;
- какой шаг открыт у каждого ученика;
- события взаимодействия (просмотр видео, выбранные ответы, отправленные действия);
- агрегированные interaction events по шагам.

Это описано как целевая архитектура. Не следует утверждать, что полноценная live-аналитика уже реализована, если она не подтверждена кодом/схемой.

## Source layer vs runtime layer

- **Source Layer (methodology):** определяет канонические шаги урока, teacher guidance, learner-side наполнение, homework definition, материалы.
- **Runtime Layer (scheduled lesson):** хранит исполнение урока (status, teacher operations, future live current-step state, homework issuance/review, коммуникации, future attendance/telemetry).

Source слой read-only для MVP-проведения, runtime слой — изменяемый операционный контур.

## Current implementation notes

На текущем срезе кода и схемы:

- teacher tabs в runtime workspace ещё содержат историческое имя `content` / «Контент»;
- source learner content хранится в `methodology_lesson_student_content`;
- learner deck в реализации группирует секции по `sceneId`.

Это допустимо как внутреннее текущее состояние, но продуктовая терминология в документации должна использовать **Шаг / Student Screen**, а не «Контент» как имя вкладки.

## Non-goals for MVP

- встроенный видео-провайдер внутри ShiDao (Zoom/Meet/Telegram не интегрируются нативно);
- обещание production-ready live sync/analytics при отсутствии полной реализации;
- свободное learner переключение шагов во время live урока по умолчанию;
- смешивание teacher-private методики и learner UI в одну неразделённую поверхность.

## Acceptance criteria for future implementation

Считаем целевую модель реализованной, когда одновременно соблюдены условия:

1. Teacher и learner используют один и тот же ordered Lesson Step list (номер + заголовок).
2. В live mode teacher контролирует переход шагов для всех учеников.
3. Ученик не может по умолчанию произвольно переключать шаги в live mode.
4. В review mode после completion ученик получает свободную навигацию.
5. План урока и Экран ученика управляют одним runtime current step.
6. Материалы остаются отдельной библиотекой ресурсов, не подменяющей Student Screen.
7. Для офлайн/физических шагов есть learner-side placeholder c тем же номером/заголовком.
8. Telemetry/monitoring документированы как capability roadmap и внедряются через runtime слой.
9. Видео-звонок остаётся внешним: ShiDao хранит/открывает meeting link, teacher может screen-share Student Screen.
