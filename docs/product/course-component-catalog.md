# Каталог компонентов Course Builder

**Статус:** current production registry + product decision
**Актуально на:** 13 августа 2026 года

Этот документ фиксирует проверенные публичные возможности ProgressMe,
нашу продуктовую интерпретацию и фактическую границу ShiDao. Текущий
20-типовый registry и D1 cleanup развёрнуты в production; сведения о стороннем
продукте не являются утверждением о его внутренней архитектуре.

## Что подтверждено официальными материалами ProgressMe

Открытая статья базы знаний «Собственные материалы на платформе»
перечисляет 28 именованных шаблонов и интеграционных блоков. Это счёт
пунктов публичного списка, а не утверждение о внутренней архитектуре или числе
типов в коде ProgressMe.

| Семейство                  | Подтверждённые публичные варианты                                                                                                                                                                                                                      |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Контент и медиа            | Изображение/карусель, GIF, видео, топик «текст + изображение», текст, аудио с транскриптом, PDF через Google Drive                                                                                                                                     |
| Автопроверяемые упражнения | Перенос слов в текст, тест с одним/несколькими ответами, пропуски, сопоставление описания и изображения, сборка предложения, выбор формы, истина/ложь/неизвестно, сопоставление двух колонок, сборка слова, категоризация, порядок предложений/абзацев |
| Свободный ответ и словарь  | Сочинение без автопроверки, запись голоса, список слов для словаря, кнопка-ссылка                                                                                                                                                                      |
| Служебные и внешние блоки  | Заметка учителю, интересный факт, разделяющая линия, Miro, Wordwall, LearningApps                                                                                                                                                                      |

Официальные инструкции также подтверждают:

- если в упражнении заданы правильные ответы, ProgressMe может проверять их
  автоматически; задания без ответов проверяет учитель;
- платформа показывает историю попыток для автопроверяемых заданий;
- в Wordwall/LearningApps-интеграциях ответы ученика не сохраняются у учителя;
- обновлённый конструктор делает акцент на preview карточки, ввод с клавиатуры,
  bulk paste и избранные шаблоны.

Источники:

- [«Собственные материалы на платформе»](https://help.progressme.ru/article/1237) —
  перечень шаблонов и краткие описания;
- [«Инструкция к ProgressMe для учеников»](https://help.progressme.ru/article/1266) —
  learner behavior и виды ответов;
- [«Работа с упражнениями»](https://help.progressme.ru/article/1233) —
  автопроверка, попытки и ручная проверка;
- [«Интеграция LearningApps и Wordwall»](https://help.progressme.ru/article/2641) —
  внешние игры и отсутствие сохранения ответов;
- [«Визуальный конструктор упражнений обновился»](https://help.progressme.ru/article/26665) —
  UX создания упражнений;
- [«8 инструментов ProgressMe»](https://blog.progressme.ru/resheniya/8-instrumentov-progressme-oblegchayushhih-rabotu-repetitorov/) —
  обзор более 30 шаблонов и продуктового контекста.

## Наша интерпретация

Все решения ниже — продуктовый выбор ShiDao, а не факты о ProgressMe. Мы
переносим учебную задачу, но не копируем названия, provider-specific payload или
внутреннюю модель стороннего продукта.

### Current runtime registry: 20 supported типов

| Тип ShiDao                            | Задача                                                     | Граница текущего среза                                                 |
| ------------------------------------- | ---------------------------------------------------------- | ---------------------------------------------------------------------- |
| `rich_text`, `callout`, `quote`       | Текст с заголовком и/или основным текстом, акцент и цитата | 3 варианта ручной текстовой категории                                  |
| `heading`                             | Совместимость отдельного заголовка                         | Только legacy runtime/editor/PATCH/publication; новое создание закрыто |
| `image`, `slideshow`, `file`          | Изображение, галерея и attachment                          | Существующие Storage/reference контракты                               |
| `video`, `audio`                      | Видео; аудио с optional transcript                         | Только прямой HTTPS URL, без upload/transcoding                        |
| `single_choice_poll`, `matching_game` | Один выбор и сопоставление пар                             | Текущие interactive блоки                                              |
| `choice_quiz`                         | Один или несколько правильных вариантов                    | Самопроверка только в preview state                                    |
| `fill_blanks`, `word_bank`            | Ввод ответов в пропуски и выбор из банка                   | Самопроверка только в preview state                                    |
| `sequence`, `categorize`              | Восстановление порядка и распределение по категориям       | Доступные select/move controls; самопроверка не персистится            |
| `free_response`                       | Короткий или развёрнутый свободный ответ                   | Текст живёт только в preview; teacher review нет                       |
| `external_link`                       | Кнопка на внешний материал                                 | Только HTTPS URL; контент не встраивается                              |
| `word_builder`                        | Сборка слова из букв                                       | Самопроверка только в preview state                                    |
| `vocabulary_list`                     | Список терминов с переводом/определением                   | Карточки/список; не добавляет слова в learner profile                  |

Всего в registry остаётся 20 типов: девять прежних содержательных типов
сохранены, добавлены 11 новых, а `divider` удалён. Точный канонический
список хранится в code-first registry, а не в этой матрице.

### Current production: 19 вариантов создания и локальный draft

Palette показывает короткое назначение и статический representative
mini-preview у 19 вручную создаваемых типов. В текстовой категории «Текст»
показывает заголовок вместе с обычными абзацами, рядом остаются
поясняющий callout и цитата с левой линией/автором. Отдельный `heading` не
показывается, чтобы преподавателю не приходилось собирать один смысловой
текстовый блок из двух Components. Он остаётся двадцатым runtime key только для
чтения, рендера, modal editing/PATCH уже сохранённых Lessons и immutable
publication revisions.

Presentation map остаётся exhaustive по 19 создаваемым типам, а runtime
renderer/editor — по всем 20 `ComponentTypeKey`. DOM picker не рендерит
настоящие input/button/media
внутри кнопки добавления, не делает network requests и не становится частью
serializable registry. Выбор образца открывает настоящий editor в том же dialog,
но пока только для локального draft из canonical defaults. Component
не создаётся и не занимает позицию до явного «Сохранить компонент»; возврат к
каталогу или закрытие ничего не записывает. Save создаёт обычный private
Component через существующий application-service contract.

`rich_text` schema version `1` принимает plain-text `title`, Markdown `content`
или оба поля одновременно, но отклоняет payload, где оба значения пусты.
Пустые поля не сохраняются; прежние payload `{ content, format }` остаются
валидными. В editor эти поля подписаны ровно «Заголовок» и «Текст», без
суффикса «(необязательно)»: необязательность задаёт общий contract, а не
дублирующая подпись.

Authored-create contract содержит 19 типов и исключает `heading` одинаково в
picker, REST `POST`, development MCP, AI provider/plan и deterministic
assembler. Tracked data migration
`20260813063716_unify_heading_rich_text_components.sql` переводит authored
`heading` в title-only `rich_text` и объединяет только непосредственную пару
`heading → rich_text`, когда совпадают visibility, `student_slide_id` и
placement. Immutable publication revisions не переписываются. Migration не
меняет physical DB schema и применена production после compatible web rollout и
verified backup. Pre/postflight: `96 → 85` authored Components,
`heading 17 → 0`, `rich_text 38 → 44`; итоговые формы — `11` combined,
`6` title-only, `27` body-only, invalid `0`. `12` Slides остаются непустыми,
positions плотными. Одна immutable publication revision сохранила прежние
`9056` bytes/content hash и все `6` snapshot Components.
Functional production source `dea92ca2c9af99fd5738e95fa9ca511aa10ca3da`
развёрнут до DB apply; production guest HTTP и полный local strict release gate
green. Authenticated production browser smoke отдельно не заявляется.

После создания teacher card остаётся renderer-only и не имеет внешнего border.
Едва заметная чёрная тень `0 3px 6px #0000000d` на hover/focus сохраняет offset,
но увеличивает blur до `12px` и alpha до `#0000001a`, не смещая content.
Управление не имеет border/box-shadow и показывается в hover/focus overlay на
общей белой подложке `rgba(255, 255, 255, 0.5)`, а Pencil открывает отдельный
modal editor. Cancel/close не
изменяют persisted payload/placement; существующий `PATCH` вызывается только по
явному сохранению. Это presentation/editor orchestration, а не новый registry,
API или storage contract.

### Почему `divider` не нужен

Это наше product inference. В ShiDao порядок задаёт единый ordered list Lesson,
а learner grouping — persisted Slides. Самостоятельный layout-only блок не несёт
учебного содержания, занимает позицию и усложняет palette, renderer, AI
и learner projection. Визуальный ритм должен решаться оформлением самих
карточек/слайдов, а не контентом-заглушкой.

### Later, не current

| Возможность                           | Почему отложена                                                                                               |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Voice response                        | Нужны microphone permission UX, Storage lifecycle, format/size limits, RLS и ответ teacher review             |
| Safe embed/Miro/Wordwall/LearningApps | Нужны allowlist, CSP, sandbox attributes, privacy contract и честная модель несохраняемых third-party results |
| Image matching                        | Нужны asset ownership, signed/public learner projection и publication remap для нескольких изображений        |
| Persisted answers/attempts/scoring    | Это отдельная learner activity model; её нельзя подменять local React state                                   |

## AI boundary

AI Lesson planning может предлагать только создаваемые типы:

```text
rich_text
callout
single_choice_poll
matching_game
```

`rich_text` может содержать заголовок, основной текст или оба поля. Каждый
provider payload повторно валидируется общими registry contracts до Apply.
Новые 11 типов не попадают в AI allowlist без отдельного provider-schema,
prompt, preview и fault-regression среза.
