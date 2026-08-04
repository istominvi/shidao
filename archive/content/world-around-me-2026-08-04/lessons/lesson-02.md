# Урок 2. Что это за животное?

- ID: `methodology-lesson:world-around-me-02`
- Позиция: модуль 1, урок 2
- Длительность: 45 минут
- Статус: `ready`
- Шагов/блоков: 17
- Связанных fixture-материалов: 6

## Карточка урока

```json
{
  "id": "methodology-shell:world-around-me-02",
  "methodologyId": "methodology:world-around-me",
  "title": "Урок 2. Что это за животное?",
  "position": {
    "moduleIndex": 1,
    "unitIndex": 1,
    "lessonIndex": 2
  },
  "vocabularySummary": [
    "鸭子",
    "鸡子",
    "羊",
    "牛",
    "房子",
    "拍手",
    "数",
    "我",
    "你"
  ],
  "phraseSummary": [
    "你是谁？",
    "我是…",
    "这是…",
    "在…里",
    "我住在房子里。"
  ],
  "estimatedDurationMinutes": 45,
  "mediaSummary": {
    "videos": 1,
    "songs": 2,
    "worksheets": 2,
    "other": 1
  },
  "readinessStatus": "ready"
}
```

## План и все шаги

## 1. Приветствие детей и героев курса

- ID: `block:l2-step-01-greeting`
- Тип: `intro_framing`
- Порядок: 1
- Материалы: нет

```json
{
  "title": "Урок 2. Что это за животное?",
  "goal": "Активно включить детей в урок и напомнить формат «играем и говорим по-китайски».",
  "teacherScriptShort": "Поприветствуйте детей и героев курса, посадите группу в круг, задайте позитивный ритм.",
  "warmupQuestion": "你是谁？",
  "timeboxMinutes": 3
}
```

## 2. Видео farm animals

- ID: `block:l2-step-02-video`
- Тип: `video_segment`
- Порядок: 2
- Материалы: `video:farm-animals`

```json
{
  "promptBeforeWatch": "Смотрим farm animals и слушаем новые слова про животных фермы.",
  "focusPoints": [
    "鸭子",
    "鸡子",
    "羊",
    "牛"
  ],
  "questionsAfterWatch": [
    "Кого ты услышал?",
    "Кто говорит «му-у»?",
    "Что ты запомнил?"
  ]
}
```

## 3. Круговой паттерн «你是谁？— 我是…»

- ID: `block:l2-step-03-wo-shi-circle`
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
    "我是小鸭子。",
    "我是小牛。"
  ],
  "fallbackRu": "Если ребёнок теряется, предложите выбрать маску/картинку и договорить «我是…» вместе с вами."
}
```

## 4. Песня hello

- ID: `block:l2-step-04-hello-song`
- Тип: `song_segment`
- Порядок: 4
- Материалы: `song:hello`

```json
{
  "activityGoal": "Закрепить ритуал начала занятия и настроить группу на совместную речь.",
  "teacherActions": [
    "Включите песню hello и спойте её вместе с детьми в круге."
  ],
  "repeatCount": 1,
  "movementHint": "Добавьте хлопки в ладоши и жест «привет» каждому ребёнку."
}
```

## 5. Новые слова: животные фермы

- ID: `block:l2-step-05-vocabulary-animals`
- Тип: `vocabulary_focus`
- Порядок: 5
- Материалы: нет

```json
{
  "items": [
    {
      "term": "鸭子",
      "pinyin": "yāzi",
      "meaning": "утка"
    },
    {
      "term": "鸡子",
      "pinyin": "jīzi",
      "meaning": "курица"
    },
    {
      "term": "羊",
      "pinyin": "yáng",
      "meaning": "овца"
    },
    {
      "term": "牛",
      "pinyin": "niú",
      "meaning": "корова"
    }
  ],
  "practiceMode": "cards_two_passes_then_sentence_model",
  "miniDrill": "Проход 1: называем слово. Проход 2: с каждой карточкой говорим полную модель «这是…»."
}
```

## 6. Прыжки по карточкам

- ID: `block:l2-step-06-jump-cards`
- Тип: `guided_activity`
- Порядок: 6
- Материалы: нет

```json
{
  "activityType": "jump_and_name_cards",
  "steps": [
    "Разложите карточки 鸭子/鸡子/羊/牛 в ряд на полу.",
    "Ребёнок прыгает на карточку, показывает на неё и говорит: «这是…».",
    "Группа повторяет фразу хором после каждого прыжка."
  ],
  "successCriteria": [
    "Ребёнок уверенно соотносит карточку и слово.",
    "Ребёнок произносит модель «这是…» в активном движении."
  ],
  "timeboxMinutes": 4
}
```

## 7. Угадай животное по звуку

- ID: `block:l2-step-07-sound-guess`
- Тип: `guided_activity`
- Порядок: 7
- Материалы: нет

```json
{
  "activityType": "animal_sound_guessing",
  "steps": [
    "Дети садятся в круг и слушают звуки животных.",
    "После каждого звука задайте вопрос: «这是什么？».",
    "Дети отвечают словом животного или фразой «这是牛。»."
  ],
  "successCriteria": [
    "Дети распознают животное на слух.",
    "Дети пробуют отвечать словами урока без подсказки на карточке."
  ],
  "timeboxMinutes": 3
}
```

## 8. Команды 跑 / 跳 / 拍手 / 数

- ID: `block:l2-step-08-actions-clap-count`
- Тип: `teacher_prompt_pattern`
- Порядок: 8
- Материалы: нет

```json
{
  "promptPatterns": [
    "我们跑吧！",
    "我们跳吧！",
    "拍手吧！",
    "我们数吧！"
  ],
  "expectedStudentResponses": [
    "Дети выполняют движение и проговаривают глагол.",
    "Дети считают до 5, хлопая и прыгая."
  ],
  "fallbackRu": "Сначала выполните команду сами, затем подключите группу и добавьте счёт «一、二、三、四、五»."
}
```

## 9. Считаем игрушки животных

- ID: `block:l2-step-09-counting-toys`
- Тип: `guided_activity`
- Порядок: 9
- Материалы: нет

```json
{
  "activityType": "counting_with_soft_toys",
  "steps": [
    "Посадите детей в круг и разложите игрушки (собака, кот, кролик, лошадь).",
    "Считайте вместе до 5, по очереди показывая игрушки и называя животных.",
    "Попросите детей повторить счёт и назвать одно животное самостоятельно."
  ],
  "successCriteria": [
    "Дети держат ритм счёта до 5.",
    "Дети совмещают счёт с называнием животного."
  ],
  "timeboxMinutes": 3
}
```

## 10. Приложение 2: пазлы животных

- ID: `block:l2-step-10-appendix-2`
- Тип: `guided_activity`
- Порядок: 10
- Материалы: `worksheet:appendix-2`

```json
{
  "activityType": "appendix_puzzle_count_and_name",
  "steps": [
    "Раздайте детям элементы Приложения 2.",
    "Попросите собрать пазл и назвать животное на картинке.",
    "После сборки дети считают животных вслух по одному."
  ],
  "successCriteria": [
    "Ребёнок называет хотя бы 1–2 животных из урока.",
    "Ребёнок участвует в счёте и слышит ответы одногруппников."
  ],
  "timeboxMinutes": 4
}
```

## 11. Маски и команды

- ID: `block:l2-step-11-masks-commands`
- Тип: `guided_activity`
- Порядок: 11
- Материалы: `media:masks-farm-animals`

```json
{
  "activityType": "mask_roleplay_commands",
  "steps": [
    "Раздайте маски утки, курицы, овцы и коровы.",
    "Давайте команды в игровом формате: «鸭子，跑吧！», «鸡子，拍手吧！».",
    "Меняйте роли, чтобы каждый ребёнок выполнил минимум 2 команды."
  ],
  "successCriteria": [
    "Дети реагируют на адресную команду.",
    "Дети закрепляют глаголы 跑 / 跳 / 拍手."
  ],
  "timeboxMinutes": 4
}
```

## 12. Рабочая тетрадь: страница 5

- ID: `block:l2-step-12-workbook-page-5`
- Тип: `worksheet_task`
- Порядок: 12
- Материалы: `worksheet:workbook-page-5`

```json
{
  "taskInstruction": "Откройте стр. 5 и соедините числа с животными. После соединения проговорите «这是…».",
  "completionMode": "in_class",
  "answerKeyHint": "Проверяйте устно: ребёнок показывает линию и произносит название животного."
}
```

## 13. Слово 房子

- ID: `block:l2-step-13-house-word`
- Тип: `vocabulary_focus`
- Порядок: 13
- Материалы: нет

```json
{
  "items": [
    {
      "term": "房子",
      "pinyin": "fángzi",
      "meaning": "дом"
    }
  ],
  "practiceMode": "single_card_with_context",
  "miniDrill": "Покажите карточку 房子 и попросите детей повторить слово с жестом «домик» руками."
}
```

## 14. Игрушечный дом: 我 / 你 / 在…里

- ID: `block:l2-step-14-house-pattern`
- Тип: `guided_activity`
- Порядок: 14
- Материалы: нет

```json
{
  "activityType": "toy_house_phrase_practice",
  "steps": [
    "Поставьте игрушечный дом и маленькие фигурки.",
    "Моделируйте фразы: «我住在房子里。», «你在房子里吗？».",
    "Попросите детей по очереди поместить фигурку в дом и проговорить короткую фразу."
  ],
  "successCriteria": [
    "Дети распознают слова 我 / 你 / 房子.",
    "Дети повторяют модель 在…里 в мини-ситуации."
  ],
  "timeboxMinutes": 4
}
```

## 15. Песня farm animals

- ID: `block:l2-step-15-song-farm-animals`
- Тип: `song_segment`
- Порядок: 15
- Материалы: `song:farm-animals`

```json
{
  "activityGoal": "Завершить урок в знакомом ритуале и закрепить новые слова о животных.",
  "teacherActions": [
    "Включите farm animals, пойте вместе и показывайте карточки животных."
  ],
  "repeatCount": 1,
  "movementHint": "Добавьте хлопки и прыжки на знакомых словах."
}
```

## 16. Прощание с детьми и героями

- ID: `block:l2-step-16-goodbye`
- Тип: `wrap_up_closure`
- Порядок: 16
- Материалы: нет

```json
{
  "recapPoints": [
    "鸭子",
    "鸡子",
    "羊",
    "牛",
    "房子",
    "我是…",
    "这是…",
    "拍手",
    "数",
    "在…里"
  ],
  "exitCheck": "Перед прощанием каждый ребёнок называет 1 животное и 1 действие, затем говорит короткую фразу с «这是…».",
  "teacherReflectionPrompt": "Попрощайтесь вместе с героями курса и отметьте детей за участие в играх."
}
```

## 17. Материалы урока 2

- ID: `block:l2-materials`
- Тип: `materials_prep`
- Порядок: 17
- Материалы: `worksheet:appendix-2`, `worksheet:workbook-page-5`, `media:masks-farm-animals`

```json
{
  "materialsChecklist": [
    "герои курса",
    "карточки 鸭子/鸡子/羊/牛",
    "карточка 房子",
    "аудио со звуками животных",
    "мягкие игрушки: собака, кот, кролик, лошадь",
    "Приложение 2 (пазлы)",
    "маски утки/курицы/овцы/коровы",
    "рабочая тетрадь (стр. 5)",
    "игрушечный дом"
  ],
  "roomSetupNotes": "Подготовьте две зоны: активную (прыжки/команды) и спокойную (пазлы/тетрадь), чтобы сохранить чередование темпа урока."
}
```

## Экран ученика

```json
{
  "id": "methodology-student-content:world-around-me-02",
  "methodologyLessonId": "methodology-lesson:world-around-me-02",
  "title": "Урок 2. Что это за животное?",
  "subtitle": "Новые животные фермы: слушаем, угадываем, двигаемся и говорим фразами.",
  "sections": [
    {
      "type": "lesson_focus",
      "title": "Урок 2 · Что это за животное?",
      "subtitle": "Сяо Лон и Сяо Мей зовут нас на ферму знакомиться с новыми друзьями.",
      "body": "Сегодня мы будем говорить, двигаться, угадывать звуки и играть с масками животных.",
      "chips": [
        "鸭子",
        "鸡子",
        "羊",
        "牛"
      ],
      "tone": "sky",
      "layout": "hero",
      "illustrationSrc": "/methodologies/world-around-me/lesson-2/farm-scene-2.svg",
      "sceneId": "scene-hero"
    },
    {
      "type": "lesson_focus",
      "title": "Что мы делаем сегодня",
      "body": "Смотрим видео, угадываем звуки, хлопаем и считаем, играем с масками, делаем страницу 5 и поём.",
      "chips": [
        "смотреть",
        "угадывать",
        "хлопать",
        "считать",
        "петь"
      ],
      "tone": "violet",
      "layout": "roadmap",
      "sceneId": "scene-roadmap"
    },
    {
      "type": "vocabulary_cards",
      "title": "Новые животные фермы",
      "subtitle": "Слушай, повторяй и покажи карточку.",
      "tone": "amber",
      "layout": "vocabulary",
      "sceneId": "scene-vocabulary",
      "items": [
        {
          "term": "鸭子",
          "pinyin": "yāzi",
          "meaning": "утка",
          "visualHint": "Покажи крылышки и скажи: yāzi!",
          "illustrationSrc": "/methodologies/world-around-me/lesson-2/duck.svg"
        },
        {
          "term": "鸡子",
          "pinyin": "jīzi",
          "meaning": "курица",
          "visualHint": "Скажи громко: jīzi!",
          "illustrationSrc": "/methodologies/world-around-me/lesson-2/chicken.svg"
        },
        {
          "term": "羊",
          "pinyin": "yáng",
          "meaning": "овца",
          "visualHint": "Сложи руки как пушистую овечку.",
          "illustrationSrc": "/methodologies/world-around-me/lesson-2/sheep.svg"
        },
        {
          "term": "牛",
          "pinyin": "niú",
          "meaning": "корова",
          "visualHint": "Покажи рога и скажи: niú!",
          "illustrationSrc": "/methodologies/world-around-me/lesson-2/cow.svg"
        }
      ]
    },
    {
      "type": "phrase_cards",
      "title": "Говорим фразами",
      "subtitle": "Скажи кто ты и что на карточке.",
      "tone": "violet",
      "layout": "phrases",
      "sceneId": "scene-speaking",
      "items": [
        {
          "phrase": "我是…",
          "pinyin": "wǒ shì…",
          "meaning": "Я…",
          "usageHint": "Выбери животное и представься.",
          "example": "我是小羊。"
        },
        {
          "phrase": "这是…",
          "pinyin": "zhè shì…",
          "meaning": "Это…",
          "usageHint": "Покажи карточку и назови животное.",
          "example": "这是鸭子。"
        }
      ]
    },
    {
      "type": "lesson_focus",
      "title": "Слушай звук и угадай",
      "subtitle": "Какое животное так звучит?",
      "body": "Слушай звук внимательно и отвечай: «这是…».",
      "chips": [
        "слушай",
        "угадывай",
        "отвечай"
      ],
      "tone": "sky",
      "layout": "practice",
      "illustrationSrc": "/methodologies/world-around-me/lesson-2/sounds.svg",
      "sceneId": "scene-sounds"
    },
    {
      "type": "action_cards",
      "title": "Двигаемся и считаем",
      "subtitle": "跑 · 跳 · 拍手 · 数",
      "tone": "emerald",
      "layout": "movement",
      "sceneId": "scene-actions",
      "items": [
        {
          "term": "跑",
          "pinyin": "pǎo",
          "meaning": "бежать",
          "movementHint": "我们跑吧！",
          "illustrationSrc": "/methodologies/world-around-me/lesson-1/visuals/run-action.png"
        },
        {
          "term": "跳",
          "pinyin": "tiào",
          "meaning": "прыгать",
          "movementHint": "我们跳吧！",
          "illustrationSrc": "/methodologies/world-around-me/lesson-1/visuals/jump-action.png"
        },
        {
          "term": "拍手",
          "pinyin": "pāishǒu",
          "meaning": "хлопать в ладоши",
          "movementHint": "拍手吧！ 一、二、三、四、五。",
          "illustrationSrc": "/methodologies/world-around-me/lesson-2/clap.svg"
        },
        {
          "term": "数",
          "pinyin": "shǔ",
          "meaning": "считать",
          "movementHint": "我们数吧！",
          "illustrationSrc": "/methodologies/world-around-me/lesson-2/count.svg"
        }
      ]
    },
    {
      "type": "lesson_focus",
      "title": "Маски и команды",
      "subtitle": "Играй роль животного и слушай команду.",
      "body": "Надень маску и выполняй: «鸭子，跑吧！», «鸡子，拍手吧！».",
      "chips": [
        "маска",
        "команда",
        "игра"
      ],
      "tone": "amber",
      "layout": "practice",
      "illustrationSrc": "/methodologies/world-around-me/lesson-2/masks.svg",
      "sceneId": "scene-masks"
    },
    {
      "type": "phrase_cards",
      "title": "Домик и новые слова",
      "subtitle": "我 · 你 · 房子 · 在…里",
      "tone": "amber",
      "layout": "farm",
      "illustrationSrc": "/methodologies/world-around-me/lesson-2/house.svg",
      "sceneId": "scene-house",
      "items": [
        {
          "phrase": "房子",
          "pinyin": "fángzi",
          "meaning": "дом",
          "usageHint": "Покажи карточку домика."
        },
        {
          "phrase": "我",
          "pinyin": "wǒ",
          "meaning": "я",
          "usageHint": "Скажи о себе."
        },
        {
          "phrase": "你",
          "pinyin": "nǐ",
          "meaning": "ты",
          "usageHint": "Спроси друга: «你是谁？»."
        },
        {
          "phrase": "在…里",
          "pinyin": "zài…lǐ",
          "meaning": "внутри / в",
          "usageHint": "Покажи, кто находится в домике.",
          "example": "我住在房子里。"
        }
      ]
    },
    {
      "type": "worksheet",
      "title": "Тетрадь и песня",
      "subtitle": "Спокойное закрепление перед финалом.",
      "tone": "rose",
      "layout": "practice",
      "sceneId": "scene-workbook-song",
      "illustrationSrc": "/methodologies/world-around-me/lesson-2/workbook.svg",
      "pageLabel": "Рабочая тетрадь · стр. 5",
      "instructions": "Соедини числа с животными, назови их, а потом спой песню farm animals с группой.",
      "teacherHint": "После задания попросите каждого ребёнка назвать одну пару «число + животное».",
      "assetId": "worksheet:workbook-page-5"
    },
    {
      "type": "recap",
      "title": "Повтор дома",
      "subtitle": "Мини-итог после урока.",
      "tone": "neutral",
      "layout": "recap",
      "sceneId": "scene-home-review",
      "bullets": [
        "Назови 4 животных: 鸭子, 鸡子, 羊, 牛.",
        "Скажи 2 фразы: 我是… и 这是…",
        "Покажи действия: 跑, 跳, 拍手.",
        "Скажи слово 数 и посчитай до 5.",
        "Произнеси: 我住在房子里。"
      ]
    }
  ]
}
```

## Домашнее задание

```json
{
  "id": "methodology-homework:world-around-me-02",
  "methodologyLessonId": "methodology-lesson:world-around-me-02",
  "title": "Мини-миссия: Угадай животное и дом",
  "kind": "quiz_single_choice",
  "instructions": "Повтори слова урока 2. Слушай вопрос, выбирай правильный ответ и помоги героям найти животных и дом.",
  "materialLinks": [
    "Рабочая тетрадь, стр. 5",
    "Карточки 鸭子/鸡子/羊/牛/房子"
  ],
  "answerFormatHint": "6 коротких вопросов, по одному ответу.",
  "estimatedMinutes": 6,
  "quiz": {
    "id": "world-around-me-lesson-2-quiz",
    "version": 1,
    "questions": [
      {
        "id": "q1",
        "prompt": "Как по-китайски «утка»?",
        "options": [
          {
            "id": "a",
            "label": "鸭子"
          },
          {
            "id": "b",
            "label": "羊"
          },
          {
            "id": "c",
            "label": "牛"
          }
        ],
        "correctOptionId": "a"
      },
      {
        "id": "q2",
        "prompt": "Что значит 房子?",
        "options": [
          {
            "id": "a",
            "label": "овца"
          },
          {
            "id": "b",
            "label": "дом"
          },
          {
            "id": "c",
            "label": "курица"
          }
        ],
        "correctOptionId": "b"
      },
      {
        "id": "q3",
        "prompt": "Выбери фразу «Это корова».",
        "options": [
          {
            "id": "a",
            "label": "我是牛。"
          },
          {
            "id": "b",
            "label": "这是牛。"
          },
          {
            "id": "c",
            "label": "你是牛。"
          }
        ],
        "correctOptionId": "b"
      },
      {
        "id": "q4",
        "prompt": "Какое слово — команда «хлопай»?",
        "options": [
          {
            "id": "a",
            "label": "拍手"
          },
          {
            "id": "b",
            "label": "数"
          },
          {
            "id": "c",
            "label": "跳"
          }
        ],
        "correctOptionId": "a"
      },
      {
        "id": "q5",
        "prompt": "Какое слово значит «считать»?",
        "options": [
          {
            "id": "a",
            "label": "你"
          },
          {
            "id": "b",
            "label": "我"
          },
          {
            "id": "c",
            "label": "数"
          }
        ],
        "correctOptionId": "c"
      },
      {
        "id": "q6",
        "prompt": "Выбери правильную фразу про дом.",
        "helperText": "Где я живу?",
        "options": [
          {
            "id": "a",
            "label": "我住在房子里。"
          },
          {
            "id": "b",
            "label": "你住在羊里。"
          },
          {
            "id": "c",
            "label": "这是我里。"
          }
        ],
        "correctOptionId": "a"
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
    "id": "song:hello",
    "kind": "song",
    "title": "hello",
    "description": "Песня-приветствие для начала урока 2."
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
    "id": "worksheet:workbook-page-5",
    "kind": "worksheet",
    "title": "Рабочая тетрадь, стр. 5",
    "description": "Соедини числа и животных, назови вслух по модели «这是…»."
  },
  {
    "id": "worksheet:appendix-2",
    "kind": "worksheet",
    "title": "Приложение 2",
    "description": "Пазлы с животными для счёта и называния."
  },
  {
    "id": "media:masks-farm-animals",
    "kind": "media_file",
    "title": "Маски животных фермы",
    "description": "Набор масок: 鸭子、鸡子、羊、牛 для командных игр.",
    "fileRef": "/methodologies/world-around-me/lesson-2/masks.svg"
  }
]
```
