# Урок 1. Животные на ферме

- ID: `methodology-lesson:world-around-me-01`
- Позиция: модуль 1, урок 1
- Длительность: 45 минут
- Статус: `ready`
- Шагов/блоков: 17
- Связанных fixture-материалов: 17

## Карточка урока

```json
{
  "id": "methodology-shell:world-around-me-01",
  "methodologyId": "methodology:world-around-me",
  "title": "Урок 1. Животные на ферме",
  "position": {
    "moduleIndex": 1,
    "unitIndex": 1,
    "lessonIndex": 1
  },
  "vocabularySummary": [
    "狗",
    "猫",
    "兔子",
    "马",
    "农场",
    "跑",
    "跳"
  ],
  "phraseSummary": [
    "你是谁？",
    "我是…",
    "这是…",
    "我们…吧！",
    "在…里"
  ],
  "estimatedDurationMinutes": 45,
  "mediaSummary": {
    "videos": 1,
    "songs": 1,
    "worksheets": 2,
    "other": 0
  },
  "readinessStatus": "ready"
}
```

## План и все шаги

## 1. Приветствие детей и героев курса

- ID: `block:step-01-greeting`
- Тип: `intro_framing`
- Порядок: 1
- Материалы: нет

```json
{
  "title": "Урок 1. Животные на ферме",
  "goal": "Мягко включить детей в китайскую речь и обозначить тему урока.",
  "teacherScriptShort": "Поприветствовать детей и героев курса, создать доброжелательный круг.",
  "timeboxMinutes": 3
}
```

## 2. Просмотр видео farm animals

- ID: `block:step-02-video`
- Тип: `video_segment`
- Порядок: 2
- Материалы: `video:farm-animals`

```json
{
  "promptBeforeWatch": "Смотрим видео farm animals и слушаем, как звучат названия животных.",
  "focusPoints": [
    "狗",
    "猫",
    "兔子",
    "马"
  ],
  "questionsAfterWatch": [
    "Кого ты услышал?",
    "Какое слово запомнилось лучше всего?"
  ]
}
```

## 3. Круг: «我是…» и вопрос «你是谁？»

- ID: `block:step-03-wo-shi`
- Тип: `teacher_prompt_pattern`
- Порядок: 3
- Материалы: нет

```json
{
  "promptPatterns": [
    "你是谁？",
    "我是…"
  ],
  "expectedStudentResponses": [
    "我是…"
  ],
  "fallbackRu": "Дайте ребёнку выбрать роль героя или животного и завершить фразу «我是…»."
}
```

## 4. Карточки животных в два прохода

- ID: `block:step-04-vocabulary-pass`
- Тип: `vocabulary_focus`
- Порядок: 4
- Материалы: нет

```json
{
  "items": [
    {
      "term": "狗",
      "pinyin": "gǒu",
      "meaning": "собака"
    },
    {
      "term": "猫",
      "pinyin": "māo",
      "meaning": "кот / кошка"
    },
    {
      "term": "兔子",
      "pinyin": "tùzi",
      "meaning": "кролик"
    },
    {
      "term": "马",
      "pinyin": "mǎ",
      "meaning": "лошадь"
    }
  ],
  "practiceMode": "cards_two_passes_then_actions",
  "miniDrill": "Проход 1: только слово. Проход 2: паттерн «这是…» с каждой карточкой."
}
```

## 5. Подражание животным по карточкам

- ID: `block:step-05-imitation`
- Тип: `guided_activity`
- Порядок: 5
- Материалы: нет

```json
{
  "activityType": "movement_imitation",
  "steps": [
    "Дети встают, педагог показывает карточку — группа изображает животное.",
    "Педагог комментирует действия в модели «我是狗» / «我是猫»."
  ],
  "successCriteria": [
    "Ребёнок связывает образ карточки и китайское слово.",
    "Ребёнок пробует говорить «我是…» в движении."
  ],
  "timeboxMinutes": 3
}
```

## 6. Карточки на стене + мяч

- ID: `block:step-06-wall-ball`
- Тип: `guided_activity`
- Порядок: 6
- Материалы: нет

```json
{
  "activityType": "target_throw_and_name",
  "steps": [
    "Закрепите карточки 狗/猫/兔子/马 на стене малярным скотчем.",
    "Педагог называет животное, ребёнок бросает мяч в нужную карточку.",
    "После броска ребёнок говорит «这是…» или слово животного."
  ],
  "successCriteria": [
    "Ребёнок точно выбирает карточку по аудиокоманде.",
    "Ребёнок проговаривает слово или модель «这是…»."
  ],
  "timeboxMinutes": 4
}
```

## 7. Счёт до 5 палочками

- ID: `block:step-07-counting-sticks`
- Тип: `guided_activity`
- Порядок: 7
- Материалы: нет

```json
{
  "activityType": "counting_sticks_to_five",
  "steps": [
    "Дети садятся в круг, педагог считает палочками до 5.",
    "Дети повторяют счёт с собственными палочками."
  ],
  "successCriteria": [
    "Группа синхронно считает до 5.",
    "Дети удерживают речевой ритм."
  ],
  "timeboxMinutes": 3
}
```

## 8. Приложение 1: показать, посчитать, назвать

- ID: `block:step-08-appendix`
- Тип: `guided_activity`
- Порядок: 8
- Материалы: `worksheet:appendix-1`

```json
{
  "activityType": "count_and_point",
  "steps": [
    "Откройте Приложение 1 и используйте указку.",
    "Дети по очереди показывают, считают и называют животных."
  ],
  "successCriteria": [
    "Ребёнок находит нужного животного по слову.",
    "Ребёнок проговаривает название после указания."
  ],
  "timeboxMinutes": 4
}
```

## 9. Введение 跑 / 跳 через команды

- ID: `block:step-09-run-jump`
- Тип: `teacher_prompt_pattern`
- Порядок: 9
- Материалы: нет

```json
{
  "promptPatterns": [
    "我们跑吧！",
    "我们跳吧！"
  ],
  "expectedStudentResponses": [
    "Дети выполняют движение и повторяют глагол."
  ]
}
```

## 10. Команды с мягкими игрушками

- ID: `block:step-10-toy-commands`
- Тип: `guided_activity`
- Порядок: 10
- Материалы: нет

```json
{
  "activityType": "movement_commands_with_toys",
  "steps": [
    "Разместите игрушки собаки, кошки, кролика и лошади по комнате.",
    "Давайте команды: «跑到狗！», «跳到兔子！», «跑到马！», «跳到猫！»."
  ],
  "successCriteria": [
    "Дети различают 跑 и 跳.",
    "Дети реагируют быстро и безопасно."
  ],
  "timeboxMinutes": 4
}
```

## 11. Вопрос-ответ о действии

- ID: `block:step-11-what-is-doing`
- Тип: `teacher_prompt_pattern`
- Порядок: 11
- Материалы: нет

```json
{
  "promptPatterns": [
    "狗在做什么？",
    "狗在跳"
  ],
  "expectedStudentResponses": [
    "狗在跳",
    "猫在跑"
  ],
  "fallbackRu": "Сначала моделируйте полный ответ, затем просите ребёнка повторить по образцу."
}
```

## 12. Рабочая тетрадь: страницы 3–4

- ID: `block:step-12-workbook`
- Тип: `worksheet_task`
- Порядок: 12
- Материалы: `worksheet:workbook-pages-3-4`

```json
{
  "taskInstruction": "Раскрась животных на стр. 3–4 и ответь на вопрос «这是什么？».",
  "completionMode": "in_class",
  "answerKeyHint": "Проверяйте устно: ребёнок показывает рисунок и говорит «这是…»."
}
```

## 13. Слово 农场

- ID: `block:step-13-farm-word`
- Тип: `vocabulary_focus`
- Порядок: 13
- Материалы: нет

```json
{
  "items": [
    {
      "term": "农场",
      "pinyin": "nóngchǎng",
      "meaning": "ферма"
    }
  ],
  "practiceMode": "single_card_with_context",
  "miniDrill": "Покажите карточку 农场 и попросите детей повторить в хоре."
}
```

## 14. Игрушечная ферма и модель «在…里»

- ID: `block:step-14-farm-pattern`
- Тип: `guided_activity`
- Порядок: 14
- Материалы: нет

```json
{
  "activityType": "toy_farm_language_reinforcement",
  "steps": [
    "Разместите животных в игрушечной ферме.",
    "Проговаривайте и повторяйте: «猫住在农场里。», «马在农场里。»."
  ],
  "successCriteria": [
    "Дети узнают слово 农场.",
    "Дети повторяют модель 在…里 с опорой на игрушки."
  ],
  "timeboxMinutes": 4
}
```

## 15. Песня farm animals

- ID: `block:step-15-song`
- Тип: `song_segment`
- Порядок: 15
- Материалы: `song:farm-animals`

```json
{
  "activityGoal": "Закрепить слова и завершить урок в знакомом ритуале.",
  "teacherActions": [
    "Включите песню farm animals и подпевайте вместе с детьми."
  ],
  "repeatCount": 1,
  "movementHint": "Поддерживайте знакомые движения на словах животных."
}
```

## 16. Прощание с детьми и героями

- ID: `block:step-16-goodbye`
- Тип: `wrap_up_closure`
- Порядок: 16
- Материалы: нет

```json
{
  "recapPoints": [
    "狗",
    "猫",
    "兔子",
    "马",
    "农场",
    "我是…",
    "这是…",
    "跑",
    "跳",
    "在…里"
  ],
  "exitCheck": "Перед прощанием попросите каждого ребёнка назвать 1 животное и 1 действие.",
  "teacherReflectionPrompt": "Завершите урок песней и дружелюбным прощанием героев курса."
}
```

## 17. Материалы урока

- ID: `block:materials-lesson-1`
- Тип: `materials_prep`
- Порядок: 17
- Материалы: `worksheet:appendix-1`

```json
{
  "materialsChecklist": [
    "герои курса",
    "карточки 狗/猫/兔子/马 и карточка 农场",
    "малярный скотч",
    "мяч",
    "палочки для счёта",
    "Приложение 1",
    "указка",
    "мягкие игрушки: собака, кот, кролик, лошадь",
    "рабочая тетрадь",
    "игрушечная ферма"
  ],
  "roomSetupNotes": "Подготовьте безопасные зоны для движения и заранее разложите игрушки для этапа команд."
}
```

## Экран ученика

```json
{
  "id": "methodology-student-content:world-around-me-01",
  "methodologyLessonId": "methodology-lesson:world-around-me-01",
  "title": "Урок 1. Животные на ферме",
  "subtitle": "Полноценный урок-хаб: презентация, карточки, счёт, движение, ферма и практика.",
  "sections": [
    {
      "type": "lesson_focus",
      "title": "Урок 1 · Животные на ферме",
      "subtitle": "Сяо Лон и Сяо Мей приглашают в фермерское приключение.",
      "body": "Поздороваемся, посмотрим презентацию, потренируем слова и команды, поработаем с приложением 1 и закрепим урок песней.",
      "chips": [
        "狗",
        "猫",
        "兔子",
        "马",
        "农场"
      ],
      "tone": "sky",
      "layout": "hero",
      "illustrationSrc": "/methodologies/world-around-me/lesson-1/visuals/hero-farm.png",
      "sceneId": "scene-hero"
    },
    {
      "type": "presentation",
      "title": "Презентация урока",
      "subtitle": "Онлайн-версия для просмотра во время занятия.",
      "tone": "sky",
      "layout": "presentation",
      "sceneId": "scene-presentation",
      "assetId": "presentation:world-around-me-lesson-1",
      "readOnly": true,
      "studentCtaLabel": "Открыть слайды",
      "note": "Материал только для просмотра. Скачать презентацию можно в кабинете преподавателя."
    },
    {
      "type": "vocabulary_cards",
      "title": "Большие карточки слов",
      "subtitle": "Листай карточки, слушай и повторяй.",
      "tone": "amber",
      "layout": "vocabulary",
      "sceneId": "scene-flashcards",
      "displayMode": "carousel",
      "items": [
        {
          "term": "狗",
          "pinyin": "gǒu",
          "meaning": "собака",
          "visualHint": "Скажи: 这是狗。",
          "illustrationSrc": "/methodologies/world-around-me/lesson-1/visuals/dog-card.png",
          "audioAssetId": "pronunciation:dog"
        },
        {
          "term": "猫",
          "pinyin": "māo",
          "meaning": "кошка",
          "visualHint": "Покажи мягкие лапки.",
          "illustrationSrc": "/methodologies/world-around-me/lesson-1/visuals/cat-card.png",
          "audioAssetId": "pronunciation:cat"
        },
        {
          "term": "兔子",
          "pinyin": "tùzi",
          "meaning": "кролик",
          "visualHint": "Прыгни как кролик.",
          "illustrationSrc": "/methodologies/world-around-me/lesson-1/visuals/rabbit-card.png",
          "audioAssetId": "pronunciation:rabbit"
        },
        {
          "term": "马",
          "pinyin": "mǎ",
          "meaning": "лошадь",
          "visualHint": "Покажи, как скачет лошадка.",
          "illustrationSrc": "/methodologies/world-around-me/lesson-1/visuals/horse-card.png",
          "audioAssetId": "pronunciation:horse"
        },
        {
          "term": "农场",
          "pinyin": "nóngchǎng",
          "meaning": "ферма",
          "visualHint": "Покажи ферму на картинке.",
          "illustrationSrc": "/methodologies/world-around-me/lesson-1/visuals/farm-barn.png",
          "audioAssetId": "pronunciation:farm"
        }
      ]
    },
    {
      "type": "phrase_cards",
      "title": "Диалог Сяо Лона и Сяо Мей",
      "subtitle": "Повторяем ключевые фразы урока.",
      "tone": "violet",
      "layout": "phrases",
      "sceneId": "scene-phrases",
      "displayMode": "dialogue",
      "items": [
        {
          "phrase": "你是谁？",
          "pinyin": "nǐ shì shéi?",
          "meaning": "Кто ты?",
          "speaker": "Сяо Лон"
        },
        {
          "phrase": "我是…",
          "pinyin": "wǒ shì…",
          "meaning": "Я…",
          "speaker": "Сяо Мей",
          "example": "我是小猫。",
          "audioAssetId": "pronunciation:wo-shi"
        },
        {
          "phrase": "这是…",
          "pinyin": "zhè shì…",
          "meaning": "Это…",
          "speaker": "Сяо Лон",
          "example": "这是狗。",
          "audioAssetId": "pronunciation:zhe-shi"
        }
      ]
    },
    {
      "type": "count_board",
      "title": "Приложение 1: считаем и называем",
      "subtitle": "Нажимай группы и проговаривай число + животное.",
      "tone": "sky",
      "layout": "counting",
      "sceneId": "scene-counting",
      "prompt": "Покажи группу, посчитай животных и назови их вслух.",
      "assetId": "worksheet:appendix-1",
      "groups": [
        {
          "id": "g1",
          "label": "1 × 狗",
          "count": 1,
          "cue": "一只狗"
        },
        {
          "id": "g2",
          "label": "2 × 猫",
          "count": 2,
          "cue": "两只猫"
        },
        {
          "id": "g3",
          "label": "3 × 兔子",
          "count": 3,
          "cue": "三只兔子"
        },
        {
          "id": "g4",
          "label": "4 × 马",
          "count": 4,
          "cue": "四匹马"
        },
        {
          "id": "g5",
          "label": "5 × 动物",
          "count": 5,
          "cue": "五只动物"
        }
      ]
    },
    {
      "type": "action_cards",
      "title": "Движение и команды",
      "subtitle": "Мини-дрилл по действиям и командам.",
      "tone": "emerald",
      "layout": "movement",
      "sceneId": "scene-actions",
      "displayMode": "slider",
      "items": [
        {
          "term": "跑",
          "pinyin": "pǎo",
          "meaning": "бежать",
          "movementHint": "Побежали вместе по команде.",
          "commandExample": "我们跑吧！ / 跑到狗！",
          "illustrationSrc": "/methodologies/world-around-me/lesson-1/visuals/run-action.png",
          "audioAssetId": "pronunciation:run"
        },
        {
          "term": "跳",
          "pinyin": "tiào",
          "meaning": "прыгать",
          "movementHint": "Прыгаем на месте и к карточке.",
          "commandExample": "我们跳吧！ / 跳到兔子！",
          "illustrationSrc": "/methodologies/world-around-me/lesson-1/visuals/jump-action.png",
          "audioAssetId": "pronunciation:jump"
        },
        {
          "term": "我们…吧!",
          "pinyin": "wǒmen … ba!",
          "meaning": "Давайте…!",
          "movementHint": "Скажи команду всей группе.",
          "commandExample": "我们跑吧！",
          "audioAssetId": "pronunciation:lets"
        }
      ]
    },
    {
      "type": "farm_placement",
      "title": "Кто живёт на ферме",
      "subtitle": "Выбери животное и собери фразу с 在…里.",
      "tone": "amber",
      "layout": "farm",
      "sceneId": "scene-farm",
      "illustrationSrc": "/methodologies/world-around-me/lesson-1/visuals/farm-barn.png",
      "targetPhraseTemplate": "{animal} 在{zone}。",
      "defaultZoneLabel": "农场里",
      "animals": [
        {
          "id": "dog",
          "hanzi": "狗",
          "pinyin": "gǒu",
          "meaning": "собака"
        },
        {
          "id": "cat",
          "hanzi": "猫",
          "pinyin": "māo",
          "meaning": "кошка"
        },
        {
          "id": "rabbit",
          "hanzi": "兔子",
          "pinyin": "tùzi",
          "meaning": "кролик"
        },
        {
          "id": "horse",
          "hanzi": "马",
          "pinyin": "mǎ",
          "meaning": "лошадь"
        }
      ]
    },
    {
      "type": "word_list",
      "title": "Новые слова и фразы",
      "subtitle": "Повтор перед домашней практикой.",
      "tone": "neutral",
      "layout": "recap",
      "sceneId": "scene-review",
      "groups": [
        {
          "id": "animals",
          "title": "Животные и ферма",
          "entries": [
            {
              "hanzi": "狗",
              "pinyin": "gǒu",
              "meaning": "собака",
              "audioAssetId": "pronunciation:dog"
            },
            {
              "hanzi": "猫",
              "pinyin": "māo",
              "meaning": "кошка",
              "audioAssetId": "pronunciation:cat"
            },
            {
              "hanzi": "兔子",
              "pinyin": "tùzi",
              "meaning": "кролик",
              "audioAssetId": "pronunciation:rabbit"
            },
            {
              "hanzi": "马",
              "pinyin": "mǎ",
              "meaning": "лошадь",
              "audioAssetId": "pronunciation:horse"
            },
            {
              "hanzi": "农场",
              "pinyin": "nóngchǎng",
              "meaning": "ферма",
              "audioAssetId": "pronunciation:farm"
            }
          ]
        },
        {
          "id": "phrases",
          "title": "Фразы и действия",
          "entries": [
            {
              "hanzi": "我是…",
              "pinyin": "wǒ shì…",
              "meaning": "Я…",
              "audioAssetId": "pronunciation:wo-shi"
            },
            {
              "hanzi": "这是…",
              "pinyin": "zhè shì…",
              "meaning": "Это…",
              "audioAssetId": "pronunciation:zhe-shi"
            },
            {
              "hanzi": "跑",
              "pinyin": "pǎo",
              "meaning": "бежать",
              "audioAssetId": "pronunciation:run"
            },
            {
              "hanzi": "跳",
              "pinyin": "tiào",
              "meaning": "прыгать",
              "audioAssetId": "pronunciation:jump"
            },
            {
              "hanzi": "我们…吧!",
              "pinyin": "wǒmen … ba!",
              "meaning": "давайте…",
              "audioAssetId": "pronunciation:lets"
            },
            {
              "hanzi": "在",
              "pinyin": "zài",
              "meaning": "в / внутри",
              "audioAssetId": "pronunciation:zai"
            }
          ]
        }
      ]
    },
    {
      "type": "worksheet",
      "title": "Тетрадь и песня",
      "subtitle": "Финальный блок урока.",
      "tone": "rose",
      "layout": "practice",
      "sceneId": "scene-materials",
      "illustrationSrc": "/methodologies/world-around-me/lesson-1/visuals/workbook-practice.png",
      "pageLabel": "Рабочая тетрадь · стр. 3–4",
      "instructions": "Раскрась животных, ответь «这是什么？», затем спой песню farm animals. PDF будет добавлен позже — пока открой внешний ресурс.",
      "teacherHint": "После тетради дайте детям 1 минуту на повтор слов перед песней.",
      "assetId": "worksheet:workbook-pages-3-4"
    },
    {
      "type": "resource_links",
      "title": "Материалы урока",
      "subtitle": "Видео, карточки, приложение и песня.",
      "tone": "rose",
      "layout": "resources",
      "sceneId": "scene-materials",
      "audience": "both",
      "resources": [
        {
          "id": "video",
          "title": "Видео farm animals",
          "assetId": "video:farm-animals",
          "previewable": true
        },
        {
          "id": "cards",
          "title": "Карточки урока",
          "assetId": "flashcards:world-around-me-lesson-1",
          "downloadable": false
        },
        {
          "id": "appendix",
          "title": "Приложение 1",
          "assetId": "worksheet:appendix-1",
          "previewable": true
        },
        {
          "id": "song",
          "title": "Песня farm animals",
          "assetId": "song:farm-animals",
          "previewable": true
        }
      ]
    },
    {
      "type": "matching_practice",
      "title": "Практика перед домашним заданием",
      "subtitle": "Сопоставь картинку и слово.",
      "tone": "violet",
      "layout": "homework",
      "sceneId": "scene-homework-practice",
      "prompt": "Перед домашкой потренируйся: найди пару картинка ↔ иероглиф.",
      "pairs": [
        {
          "id": "dog",
          "label": "狗",
          "illustrationSrc": "/methodologies/world-around-me/lesson-1/visuals/dog-card.png"
        },
        {
          "id": "cat",
          "label": "猫",
          "illustrationSrc": "/methodologies/world-around-me/lesson-1/visuals/cat-card.png"
        },
        {
          "id": "rabbit",
          "label": "兔子",
          "illustrationSrc": "/methodologies/world-around-me/lesson-1/visuals/rabbit-card.png"
        },
        {
          "id": "horse",
          "label": "马",
          "illustrationSrc": "/methodologies/world-around-me/lesson-1/visuals/horse-card.png"
        }
      ]
    }
  ]
}
```

## Домашнее задание

```json
{
  "id": "methodology-homework:world-around-me-01",
  "methodologyLessonId": "methodology-lesson:world-around-me-01",
  "title": "Практика дома: ферма, слова и команды",
  "kind": "quiz_single_choice",
  "instructions": "Сначала сопоставь животных и иероглифы, затем повтори слова с аудио, и после этого пройди короткий квиз.",
  "materialLinks": [
    "Рабочая тетрадь, стр. 3–4",
    "Карточки животных",
    "Презентация урока 1"
  ],
  "answerFormatHint": "Интерактивная практика + квиз из 5 вопросов.",
  "estimatedMinutes": 10,
  "quiz": {
    "id": "world-around-me-lesson-1-quiz",
    "version": 2,
    "title": "Домашняя мини-миссия: Животные на ферме",
    "subtitle": "Сопоставь, послушай, затем выбери правильный вариант.",
    "introText": "Повтори слова урока вместе с карточками и аудио.",
    "completionTitle": "Отличная работа!",
    "completionText": "Ты повторил(а) слова, команды и фразы урока 1.",
    "practiceSections": [
      {
        "id": "matching-l1",
        "type": "matching",
        "title": "Соедини картинку и иероглиф",
        "prompt": "Перетащи слово к правильной карточке животного.",
        "items": [
          {
            "id": "dog",
            "label": "狗",
            "illustrationSrc": "/methodologies/world-around-me/lesson-1/visuals/dog-card.png"
          },
          {
            "id": "cat",
            "label": "猫",
            "illustrationSrc": "/methodologies/world-around-me/lesson-1/visuals/cat-card.png"
          },
          {
            "id": "rabbit",
            "label": "兔子",
            "illustrationSrc": "/methodologies/world-around-me/lesson-1/visuals/rabbit-card.png"
          },
          {
            "id": "horse",
            "label": "马",
            "illustrationSrc": "/methodologies/world-around-me/lesson-1/visuals/horse-card.png"
          }
        ]
      },
      {
        "id": "audio-review-l1",
        "type": "audio_review",
        "title": "Слушай и повторяй слова",
        "groups": [
          {
            "id": "animals",
            "title": "Животные и ферма",
            "entries": [
              {
                "id": "狗",
                "hanzi": "狗",
                "pinyin": "gǒu",
                "meaning": "собака",
                "audioAssetId": "pronunciation:dog",
                "audioUrl": "/methodologies/world-around-me/lesson-1/audio/gou.mp3"
              },
              {
                "id": "猫",
                "hanzi": "猫",
                "pinyin": "māo",
                "meaning": "кошка",
                "audioAssetId": "pronunciation:cat",
                "audioUrl": "/methodologies/world-around-me/lesson-1/audio/mao.mp3"
              },
              {
                "id": "兔子",
                "hanzi": "兔子",
                "pinyin": "tùzi",
                "meaning": "кролик",
                "audioAssetId": "pronunciation:rabbit",
                "audioUrl": "/methodologies/world-around-me/lesson-1/audio/tuzi.mp3"
              },
              {
                "id": "马",
                "hanzi": "马",
                "pinyin": "mǎ",
                "meaning": "лошадь",
                "audioAssetId": "pronunciation:horse",
                "audioUrl": "/methodologies/world-around-me/lesson-1/audio/ma.mp3"
              },
              {
                "id": "农场",
                "hanzi": "农场",
                "pinyin": "nóngchǎng",
                "meaning": "ферма",
                "audioAssetId": "pronunciation:farm",
                "audioUrl": "/methodologies/world-around-me/lesson-1/audio/nongchang.mp3"
              }
            ]
          },
          {
            "id": "phrases-actions",
            "title": "Фразы, действия и грамматика",
            "entries": [
              {
                "id": "我是",
                "hanzi": "我是…",
                "pinyin": "wǒ shì…",
                "meaning": "Я…",
                "audioAssetId": "pronunciation:wo-shi",
                "audioUrl": "/methodologies/world-around-me/lesson-1/audio/woshi.mp3"
              },
              {
                "id": "这是",
                "hanzi": "这是…",
                "pinyin": "zhè shì…",
                "meaning": "Это…",
                "audioAssetId": "pronunciation:zhe-shi",
                "audioUrl": "/methodologies/world-around-me/lesson-1/audio/zheshi.mp3"
              },
              {
                "id": "跑",
                "hanzi": "跑",
                "pinyin": "pǎo",
                "meaning": "бежать",
                "audioAssetId": "pronunciation:run",
                "audioUrl": "/methodologies/world-around-me/lesson-1/audio/pao.mp3"
              },
              {
                "id": "跳",
                "hanzi": "跳",
                "pinyin": "tiào",
                "meaning": "прыгать",
                "audioAssetId": "pronunciation:jump",
                "audioUrl": "/methodologies/world-around-me/lesson-1/audio/tiao.mp3"
              },
              {
                "id": "我们吧",
                "hanzi": "我们…吧!",
                "pinyin": "wǒmen … ba!",
                "meaning": "Давайте…!",
                "audioAssetId": "pronunciation:lets",
                "audioUrl": "/methodologies/world-around-me/lesson-1/audio/womenba.mp3"
              },
              {
                "id": "在",
                "hanzi": "在",
                "pinyin": "zài",
                "meaning": "в / внутри",
                "audioAssetId": "pronunciation:zai",
                "audioUrl": "/methodologies/world-around-me/lesson-1/audio/zai.mp3"
              }
            ]
          }
        ]
      }
    ],
    "questions": [
      {
        "id": "q1",
        "prompt": "Как по-китайски «собака»?",
        "helperText": "Выбери карточку со словом.",
        "options": [
          {
            "id": "a",
            "label": "狗"
          },
          {
            "id": "b",
            "label": "猫"
          },
          {
            "id": "c",
            "label": "马"
          }
        ],
        "correctOptionId": "a"
      },
      {
        "id": "q2",
        "prompt": "Как по-китайски «кролик»?",
        "options": [
          {
            "id": "a",
            "label": "兔子"
          },
          {
            "id": "b",
            "label": "农场"
          },
          {
            "id": "c",
            "label": "狗"
          }
        ],
        "correctOptionId": "a"
      },
      {
        "id": "q3",
        "prompt": "Что значит «农场»?",
        "options": [
          {
            "id": "a",
            "label": "кошка"
          },
          {
            "id": "b",
            "label": "ферма"
          },
          {
            "id": "c",
            "label": "лошадь"
          }
        ],
        "correctOptionId": "b"
      },
      {
        "id": "q4",
        "prompt": "Выбери фразу «Это…»",
        "options": [
          {
            "id": "a",
            "label": "我是…"
          },
          {
            "id": "b",
            "label": "这是…"
          },
          {
            "id": "c",
            "label": "我们…吧！"
          }
        ],
        "correctOptionId": "b"
      },
      {
        "id": "q5",
        "prompt": "Какое слово значит «прыгать»?",
        "options": [
          {
            "id": "a",
            "label": "跑"
          },
          {
            "id": "b",
            "label": "在"
          },
          {
            "id": "c",
            "label": "跳"
          }
        ],
        "correctOptionId": "c"
      }
    ]
  }
}
```

## Связанные материалы

```json
[
  {
    "id": "video:farm-animals",
    "kind": "video",
    "title": "farm animals",
    "description": "Видео-сегмент уроков 1–2: знакомство с животными фермы.",
    "fileRef": "/methodologies/world-around-me/lesson-1/media/e.mp4",
    "sourceUrl": "https://drive.google.com/file/d/1NXyngOuT9WIwvgA0gvvSzZc9-BUuKT7k/view?usp=drive_link"
  },
  {
    "id": "presentation:world-around-me-lesson-1",
    "kind": "presentation",
    "title": "Презентация урока 1",
    "description": "Локальная презентация урока 1 для проведения и демонстрации слайдов.",
    "sourceUrl": "https://docs.google.com/presentation/d/1o-LCuePhdVq39oBPqHgtHpJUREJNz4dS/edit?usp=drive_link&ouid=102261836036017130249&rtpof=true&sd=true",
    "fileRef": "/methodologies/world-around-me/lesson-1/presentation/lesson-1-slides.pdf",
    "metadata": {
      "pptxFileRef": "/methodologies/world-around-me/lesson-1/presentation/lesson-1-slides.pptx",
      "slideImageRefs": [
        "/methodologies/world-around-me/lesson-1/presentation/lesson-1-slide-01.png",
        "/methodologies/world-around-me/lesson-1/presentation/lesson-1-slide-02.png",
        "/methodologies/world-around-me/lesson-1/presentation/lesson-1-slide-03.png",
        "/methodologies/world-around-me/lesson-1/presentation/lesson-1-slide-04.png",
        "/methodologies/world-around-me/lesson-1/presentation/lesson-1-slide-05.png",
        "/methodologies/world-around-me/lesson-1/presentation/lesson-1-slide-06.png",
        "/methodologies/world-around-me/lesson-1/presentation/lesson-1-slide-07.png",
        "/methodologies/world-around-me/lesson-1/presentation/lesson-1-slide-08.png",
        "/methodologies/world-around-me/lesson-1/presentation/lesson-1-slide-09.png",
        "/methodologies/world-around-me/lesson-1/presentation/lesson-1-slide-10.png",
        "/methodologies/world-around-me/lesson-1/presentation/lesson-1-slide-11.png",
        "/methodologies/world-around-me/lesson-1/presentation/lesson-1-slide-12.png",
        "/methodologies/world-around-me/lesson-1/presentation/lesson-1-slide-13.png",
        "/methodologies/world-around-me/lesson-1/presentation/lesson-1-slide-14.png",
        "/methodologies/world-around-me/lesson-1/presentation/lesson-1-slide-15.png",
        "/methodologies/world-around-me/lesson-1/presentation/lesson-1-slide-16.png"
      ]
    }
  },
  {
    "id": "flashcards:world-around-me-lesson-1",
    "kind": "flashcards_pdf",
    "title": "Карточки урока 1 (PDF)",
    "sourceUrl": "https://drive.google.com/file/d/11LTKea4ui3_xB5ZBc6WbEanwlxfoO_GY/view?usp=drive_link",
    "fileRef": "/methodologies/world-around-me/lesson-1/flashcards/lesson-1-flashcards.pdf",
    "metadata": {
      "cardImageRefs": [
        "/methodologies/world-around-me/lesson-1/flashcards/dog-card.png",
        "/methodologies/world-around-me/lesson-1/flashcards/dog-card_2.png",
        "/methodologies/world-around-me/lesson-1/flashcards/cat-card.png",
        "/methodologies/world-around-me/lesson-1/flashcards/cat-card_2.png",
        "/methodologies/world-around-me/lesson-1/flashcards/rabbit-card.png",
        "/methodologies/world-around-me/lesson-1/flashcards/rabbit-card_2.png",
        "/methodologies/world-around-me/lesson-1/flashcards/horse-card.png",
        "/methodologies/world-around-me/lesson-1/flashcards/horse-card_2.png",
        "/methodologies/world-around-me/lesson-1/flashcards/farm-card.png",
        "/methodologies/world-around-me/lesson-1/flashcards/farm-card_2.png"
      ]
    }
  },
  {
    "id": "song:farm-animals",
    "kind": "song_audio",
    "title": "farm animals",
    "description": "Песня для завершения уроков про животных.",
    "sourceUrl": "https://drive.google.com/file/d/1RewHJRdd6oqSfX506A7ABt6VMDhDzJRP/view?usp=drive_link",
    "fileRef": "/methodologies/world-around-me/lesson-1/media/farm-animals-song.mp3"
  },
  {
    "id": "worksheet:workbook-pages-3-4",
    "kind": "worksheet",
    "title": "Рабочая тетрадь, стр. 3–4",
    "description": "Задание на раскрашивание животных и вопрос «这是什么？».",
    "metadata": {
      "previewImageRef": "/methodologies/world-around-me/lesson-1/visuals/workbook-practice.png"
    },
    "sourceUrl": "https://drive.google.com/file/d/1bS3KP_wRQSrAu9faPhyqkNdxeTul9bi0/view?usp=drive_link"
  },
  {
    "id": "worksheet:appendix-1",
    "kind": "worksheet_pdf",
    "title": "Приложение 1",
    "description": "Материал для указки: показать, посчитать, назвать животных.",
    "sourceUrl": "https://drive.google.com/file/d/1hNwwBZ0S7SNmSbAAt-vz1aPanAluSTrC/view?usp=drive_link",
    "fileRef": "/methodologies/world-around-me/lesson-1/appendix/appendix-1.pdf",
    "metadata": {
      "previewImageRef": "/methodologies/world-around-me/lesson-1/appendix/appendix-1.png"
    }
  },
  {
    "id": "pronunciation:dog",
    "kind": "pronunciation_audio",
    "title": "狗 · gǒu",
    "fileRef": "/methodologies/world-around-me/lesson-1/audio/gou.mp3"
  },
  {
    "id": "pronunciation:cat",
    "kind": "pronunciation_audio",
    "title": "猫 · māo",
    "fileRef": "/methodologies/world-around-me/lesson-1/audio/mao.mp3"
  },
  {
    "id": "pronunciation:rabbit",
    "kind": "pronunciation_audio",
    "title": "兔子 · tùzi",
    "fileRef": "/methodologies/world-around-me/lesson-1/audio/tuzi.mp3"
  },
  {
    "id": "pronunciation:horse",
    "kind": "pronunciation_audio",
    "title": "马 · mǎ",
    "fileRef": "/methodologies/world-around-me/lesson-1/audio/ma.mp3"
  },
  {
    "id": "pronunciation:farm",
    "kind": "pronunciation_audio",
    "title": "农场 · nóngchǎng",
    "fileRef": "/methodologies/world-around-me/lesson-1/audio/nongchang.mp3"
  },
  {
    "id": "pronunciation:wo-shi",
    "kind": "pronunciation_audio",
    "title": "我是… · wǒ shì…",
    "fileRef": "/methodologies/world-around-me/lesson-1/audio/woshi.mp3"
  },
  {
    "id": "pronunciation:zhe-shi",
    "kind": "pronunciation_audio",
    "title": "这是… · zhè shì…",
    "fileRef": "/methodologies/world-around-me/lesson-1/audio/zheshi.mp3"
  },
  {
    "id": "pronunciation:run",
    "kind": "pronunciation_audio",
    "title": "跑 · pǎo",
    "fileRef": "/methodologies/world-around-me/lesson-1/audio/pao.mp3"
  },
  {
    "id": "pronunciation:jump",
    "kind": "pronunciation_audio",
    "title": "跳 · tiào",
    "fileRef": "/methodologies/world-around-me/lesson-1/audio/tiao.mp3"
  },
  {
    "id": "pronunciation:lets",
    "kind": "pronunciation_audio",
    "title": "我们…吧! · wǒmen … ba!",
    "fileRef": "/methodologies/world-around-me/lesson-1/audio/womenba.mp3"
  },
  {
    "id": "pronunciation:zai",
    "kind": "pronunciation_audio",
    "title": "在 · zài",
    "fileRef": "/methodologies/world-around-me/lesson-1/audio/zai.mp3"
  }
]
```
