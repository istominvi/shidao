# Урок 3. Этот разноцветный мир

- ID: `methodology-lesson:world-around-me-03`
- Позиция: модуль 1, урок 3
- Длительность: 45 минут
- Статус: `ready`
- Шагов/блоков: 17
- Связанных fixture-материалов: 9

## Карточка урока

```json
{
  "id": "methodology-shell:world-around-me-03",
  "methodologyId": "methodology:world-around-me",
  "title": "Урок 3. Этот разноцветный мир",
  "position": {
    "moduleIndex": 1,
    "unitIndex": 1,
    "lessonIndex": 3
  },
  "vocabularySummary": [
    "红色",
    "绿色",
    "蓝色",
    "黄色",
    "车",
    "只",
    "…的…",
    "次"
  ],
  "phraseSummary": [
    "你是…",
    "我是谁？",
    "这是红色。",
    "这是狗。",
    "我们在做什么？",
    "我们在开车。",
    "红色的车。"
  ],
  "estimatedDurationMinutes": 45,
  "mediaSummary": {
    "videos": 1,
    "songs": 2,
    "worksheets": 2,
    "other": 4
  },
  "readinessStatus": "ready"
}
```

## План и все шаги

## 1. Приветствие детей и героев курса

- ID: `block:l3-step-01-greeting`
- Тип: `intro_framing`
- Порядок: 1
- Материалы: нет

```json
{
  "title": "Урок 3. Этот разноцветный мир",
  "goal": "Включить детей в тему цветов и напомнить игровой ритм урока.",
  "teacherScriptShort": "Поприветствуйте детей и героев курса, соберите группу в круг и объявите цветное приключение.",
  "timeboxMinutes": 3
}
```

## 2. Видео colors

- ID: `block:l3-step-02-video-colors`
- Тип: `video_segment`
- Порядок: 2
- Материалы: `video:colors`

```json
{
  "promptBeforeWatch": "Смотрим видео colors и слушаем названия цветов.",
  "focusPoints": [
    "红色",
    "绿色",
    "蓝色",
    "黄色"
  ],
  "questionsAfterWatch": [
    "Какой цвет ты услышал?",
    "Покажи любимый цвет руками."
  ]
}
```

## 3. Круг «你是… / 我是谁？»

- ID: `block:l3-step-03-ni-shi`
- Тип: `teacher_prompt_pattern`
- Порядок: 3
- Материалы: нет

```json
{
  "promptPatterns": [
    "你是…",
    "我是谁？"
  ],
  "expectedStudentResponses": [
    "你是…"
  ],
  "fallbackRu": "Покажите на ребёнка и мягко дайте начало фразы, чтобы он завершил «你是…»."
}
```

## 4. Песня hello

- ID: `block:l3-step-04-hello-song`
- Тип: `song_segment`
- Порядок: 4
- Материалы: `song:hello`

```json
{
  "activityGoal": "Сохранить ритуал начала урока и общий темп группы.",
  "teacherActions": [
    "Спойте hello song в круге вместе с детьми и героями курса."
  ],
  "repeatCount": 1,
  "movementHint": "Добавьте мягкие жесты приветствия и хлопки в ритме песни."
}
```

## 5. Цвета: 红色 / 绿色 / 蓝色 / 黄色

- ID: `block:l3-step-05-colors-vocabulary`
- Тип: `vocabulary_focus`
- Порядок: 5
- Материалы: `media:color-cards`

```json
{
  "items": [
    {
      "term": "红色",
      "pinyin": "hóngsè",
      "meaning": "красный"
    },
    {
      "term": "绿色",
      "pinyin": "lǜsè",
      "meaning": "зелёный"
    },
    {
      "term": "蓝色",
      "pinyin": "lánsè",
      "meaning": "синий"
    },
    {
      "term": "黄色",
      "pinyin": "huángsè",
      "meaning": "жёлтый"
    }
  ],
  "practiceMode": "cards_two_passes_then_phrase_model",
  "miniDrill": "Проход 1: называем слово. Проход 2: говорим полной фразой «这是红色。» и аналогично для других цветов."
}
```

## 6. Палочки и карточки: коснись нужного цвета

- ID: `block:l3-step-06-sticks-touch`
- Тип: `guided_activity`
- Порядок: 6
- Материалы: `media:color-cards`

```json
{
  "activityType": "color_touch_with_sticks",
  "steps": [
    "Разложите карточки 红色/绿色/蓝色/黄色 в ряд.",
    "Раздайте детям цветные палочки.",
    "Называйте цвет: ребёнок касается карточки палочкой и повторяет слово."
  ],
  "successCriteria": [
    "Ребёнок находит нужный цвет по аудиокоманде.",
    "Ребёнок проговаривает цвет после действия."
  ],
  "timeboxMinutes": 4
}
```

## 7. Найди в классе предмет нужного цвета

- ID: `block:l3-step-07-find-color-objects`
- Тип: `guided_activity`
- Порядок: 7
- Материалы: нет

```json
{
  "activityType": "bring_objects_by_color",
  "steps": [
    "Разместите по классу предметы зелёного, синего, жёлтого и красного цветов.",
    "Называйте цвет, дети находят предмет и приносят в корзину.",
    "Перед тем как положить предмет, ребёнок самостоятельно называет цвет."
  ],
  "successCriteria": [
    "Ребёнок узнаёт и приносит предмет нужного цвета.",
    "Ребёнок произносит цвет без подсказки."
  ],
  "timeboxMinutes": 4
}
```

## 8. Мешочек животных: 这是狗 / 两只狗 / 三只猫

- ID: `block:l3-step-08-animals-bag-classifier`
- Тип: `guided_activity`
- Порядок: 8
- Материалы: `media:animals-bag`

```json
{
  "activityType": "animal_bag_classifier_count",
  "steps": [
    "Повторите животных по карточкам: 狗、猫、兔子、马、鸭子、鸡子、羊、牛.",
    "Дети по очереди достают игрушки из мешочка и говорят: «这是狗。»",
    "В конце мини-раунда ребёнок считает и подводит итог с 只: «两只狗», «三只猫»."
  ],
  "successCriteria": [
    "Ребёнок называет животное по модели «这是…».",
    "Ребёнок использует классификатор 只 в короткой счётной фразе."
  ],
  "timeboxMinutes": 5
}
```

## 9. Новое слово 车

- ID: `block:l3-step-09-che-word`
- Тип: `vocabulary_focus`
- Порядок: 9
- Материалы: нет

```json
{
  "items": [
    {
      "term": "车",
      "pinyin": "chē",
      "meaning": "машина"
    }
  ],
  "practiceMode": "single_card_with_object_link",
  "miniDrill": "Покажите карточку 车, затем игрушечную машину и проговорите слово хором."
}
```

## 10. Игра с машинками: 我们在做什么？我们在开车。

- ID: `block:l3-step-10-toy-cars`
- Тип: `guided_activity`
- Порядок: 10
- Материалы: нет

```json
{
  "activityType": "toy_car_action_commentary",
  "steps": [
    "Раздайте детям игрушечные машинки и задайте вопрос: «我们在做什么？».",
    "Смоделируйте ответ: «我们在开车。».",
    "Попросите детей катать машинки и повторять полную фразу."
  ],
  "successCriteria": [
    "Дети отвечают на вопрос готовой моделью.",
    "Дети связывают действие и фразу «我们在开车。»."
  ],
  "timeboxMinutes": 4
}
```

## 11. Силуэт машины и модель «…的车»

- ID: `block:l3-step-11-colored-car`
- Тип: `guided_activity`
- Порядок: 11
- Материалы: `media:car-silhouette`

```json
{
  "activityType": "car_silhouette_color_phrase",
  "steps": [
    "Покажите картонный силуэт машины с окошком.",
    "По очереди вставляйте цветные карточки в силуэт.",
    "Комментируйте и просите повторить: «红色的车。», «绿色的车。»."
  ],
  "successCriteria": [
    "Ребёнок повторяет модель «…的车».",
    "Ребёнок соединяет цвет и предмет в единую фразу."
  ],
  "timeboxMinutes": 4
}
```

## 12. Приложение 3: сортировка животных по цвету

- ID: `block:l3-step-12-appendix-3-color-die`
- Тип: `guided_activity`
- Порядок: 12
- Материалы: `worksheet:appendix-3`, `media:color-die`

```json
{
  "activityType": "appendix_color_sorting_with_die",
  "steps": [
    "Используйте Приложение 3 и цветной кубик.",
    "Ребёнок бросает кубик и узнаёт целевой цвет.",
    "Ребёнок выбирает животных нужного цвета и называет: «黄色的猫。», «绿色的牛。»."
  ],
  "successCriteria": [
    "Ребёнок сортирует карточки животных по цвету.",
    "Ребёнок проговаривает словосочетание с «…的…»."
  ],
  "timeboxMinutes": 5
}
```

## 13. Движение и счёт с 次

- ID: `block:l3-step-13-count-actions-ci`
- Тип: `guided_activity`
- Порядок: 13
- Материалы: нет

```json
{
  "activityType": "counted_actions_with_ci",
  "steps": [
    "Повторите знакомые глаголы движения и хлопков.",
    "Давайте команды с числом: «跳五次。», «拍手三次。».",
    "Дети выполняют действие и считают вслух до 5."
  ],
  "successCriteria": [
    "Ребёнок понимает модель «число + 次».",
    "Ребёнок выполняет и считает нужное количество раз."
  ],
  "timeboxMinutes": 4
}
```

## 14. Рабочая тетрадь: страница 6

- ID: `block:l3-step-14-workbook-page6`
- Тип: `worksheet_task`
- Порядок: 14
- Материалы: `worksheet:workbook-page-6`

```json
{
  "taskInstruction": "Раскрась цвета на странице 6 и назови каждый цвет по-китайски.",
  "completionMode": "in_class",
  "answerKeyHint": "Проверка устно: ребёнок показывает цвет и произносит «这是红色。» или аналогичную фразу."
}
```

## 15. Песня my favorite color is blue

- ID: `block:l3-step-15-favorite-color-song`
- Тип: `song_segment`
- Порядок: 15
- Материалы: `song:my-favorite-color-is-blue`

```json
{
  "activityGoal": "Закрепить цвета и завершить урок эмоционально.",
  "teacherActions": [
    "Включите песню my favorite color is blue и подпевайте с детьми."
  ],
  "repeatCount": 1,
  "movementHint": "Поднимайте карточку того цвета, который звучит в песне."
}
```

## 16. Прощание с детьми и героями

- ID: `block:l3-step-16-goodbye`
- Тип: `wrap_up_closure`
- Порядок: 16
- Материалы: нет

```json
{
  "recapPoints": [
    "红色",
    "绿色",
    "蓝色",
    "黄色",
    "车",
    "你是…",
    "我是谁？",
    "…的…",
    "只",
    "次"
  ],
  "exitCheck": "Перед прощанием каждый ребёнок называет один цвет, одну фразу с «…的…» и выполняет короткую команду с 次.",
  "teacherReflectionPrompt": "Попрощайтесь вместе с героями и отметьте детей за смелую речь полными фразами."
}
```

## 17. Материалы урока 3

- ID: `block:l3-materials`
- Тип: `materials_prep`
- Порядок: 17
- Материалы: `media:color-cards`, `media:animals-bag`, `media:car-silhouette`, `worksheet:appendix-3`, `worksheet:workbook-page-6`, `media:color-die`

```json
{
  "materialsChecklist": [
    "герои курса",
    "видео colors",
    "карточки 红色/绿色/蓝色/黄色/车",
    "цветные палочки",
    "предметы 4 цветов для игры по классу",
    "карточки и игрушки животных в мешочке",
    "игрушечные машинки",
    "картонный силуэт машины",
    "Приложение 3",
    "цветной кубик",
    "рабочая тетрадь (стр. 6)"
  ],
  "roomSetupNotes": "Подготовьте активную зону поиска предметов и спокойную зону для сортировки/тетради; заранее проверьте, что цветные карточки видны всем детям."
}
```

## Экран ученика

```json
{
  "id": "methodology-student-content:world-around-me-03",
  "methodologyLessonId": "methodology-lesson:world-around-me-03",
  "title": "Урок 3. Этот разноцветный мир",
  "subtitle": "Изучаем цвета, играем с животными и машинками, считаем и поём.",
  "sections": [
    {
      "type": "lesson_focus",
      "title": "Урок 3 · Этот разноцветный мир",
      "subtitle": "Сяо Лон и Сяо Мей приглашают нас в мир ярких цветов.",
      "body": "Сегодня мы смотрим видео colors, играем с карточками и учимся говорить цветные фразы.",
      "chips": [
        "红色",
        "绿色",
        "蓝色",
        "黄色"
      ],
      "tone": "sky",
      "layout": "hero",
      "illustrationSrc": "/methodologies/world-around-me/lesson-3/color-world.svg",
      "sceneId": "scene-hero"
    },
    {
      "type": "lesson_focus",
      "title": "Что мы делаем сегодня",
      "body": "Смотрим видео, называем цвета, ищем цвета в классе, сортируем животных, играем с машинками и поём.",
      "chips": [
        "смотреть",
        "называть",
        "искать",
        "сортировать",
        "петь"
      ],
      "tone": "violet",
      "layout": "roadmap",
      "sceneId": "scene-roadmap"
    },
    {
      "type": "vocabulary_cards",
      "title": "Главные цвета",
      "subtitle": "Слушай и повторяй каждый цвет.",
      "tone": "amber",
      "layout": "vocabulary",
      "sceneId": "scene-colors",
      "items": [
        {
          "term": "红色",
          "pinyin": "hóngsè",
          "meaning": "красный",
          "visualHint": "Покажи красный цвет вокруг себя."
        },
        {
          "term": "绿色",
          "pinyin": "lǜsè",
          "meaning": "зелёный",
          "visualHint": "Найди что-то зелёное."
        },
        {
          "term": "蓝色",
          "pinyin": "lánsè",
          "meaning": "синий",
          "visualHint": "Покажи синий предмет."
        },
        {
          "term": "黄色",
          "pinyin": "huángsè",
          "meaning": "жёлтый",
          "visualHint": "Улыбнись как жёлтое солнышко."
        }
      ]
    },
    {
      "type": "phrase_cards",
      "title": "Говорим и показываем",
      "subtitle": "Играем в кругу с вопросом и ответом.",
      "tone": "violet",
      "layout": "phrases",
      "sceneId": "scene-speaking",
      "items": [
        {
          "phrase": "你是…",
          "pinyin": "nǐ shì…",
          "meaning": "Ты…",
          "usageHint": "Покажи на друга и начни фразу."
        },
        {
          "phrase": "我是谁？",
          "pinyin": "wǒ shì shéi?",
          "meaning": "Кто я?",
          "usageHint": "Спроси и послушай ответ друга."
        }
      ]
    },
    {
      "type": "phrase_cards",
      "title": "Животные и счёт",
      "subtitle": "Называем и считаем с 只.",
      "tone": "emerald",
      "layout": "farm",
      "illustrationSrc": "/methodologies/world-around-me/lesson-3/animals-bag.svg",
      "sceneId": "scene-animals",
      "items": [
        {
          "phrase": "这是狗。",
          "pinyin": "zhè shì gǒu.",
          "meaning": "Это собака.",
          "usageHint": "Скажи, когда достаёшь игрушку из мешочка."
        },
        {
          "phrase": "两只狗。",
          "pinyin": "liǎng zhī gǒu.",
          "meaning": "Две собаки.",
          "usageHint": "Посчитай, сколько собак у тебя."
        },
        {
          "phrase": "三只猫。",
          "pinyin": "sān zhī māo.",
          "meaning": "Три кошки.",
          "usageHint": "Назови итог с числом и 只."
        }
      ]
    },
    {
      "type": "phrase_cards",
      "title": "Машинки",
      "subtitle": "Учимся говорить о машинах и цветах.",
      "tone": "amber",
      "layout": "practice",
      "illustrationSrc": "/methodologies/world-around-me/lesson-3/toy-car.svg",
      "sceneId": "scene-cars",
      "items": [
        {
          "phrase": "车",
          "pinyin": "chē",
          "meaning": "машина",
          "usageHint": "Покажи игрушечную машину."
        },
        {
          "phrase": "我们在开车。",
          "pinyin": "wǒmen zài kāichē.",
          "meaning": "Мы ведём машину.",
          "usageHint": "Скажи, когда играешь с машинкой."
        },
        {
          "phrase": "红色的车。",
          "pinyin": "hóngsè de chē.",
          "meaning": "Красная машина.",
          "usageHint": "Подбери цвет и назови машину."
        },
        {
          "phrase": "绿色的车。",
          "pinyin": "lǜsè de chē.",
          "meaning": "Зелёная машина.",
          "usageHint": "Сравни с другой машиной."
        }
      ]
    },
    {
      "type": "phrase_cards",
      "title": "Сортируем по цветам",
      "subtitle": "Бросаем кубик цвета и ищем животных.",
      "tone": "sky",
      "layout": "practice",
      "illustrationSrc": "/methodologies/world-around-me/lesson-3/color-die.svg",
      "sceneId": "scene-sorting",
      "items": [
        {
          "phrase": "黄色的猫。",
          "pinyin": "huángsè de māo.",
          "meaning": "Жёлтая кошка.",
          "usageHint": "Назови животное нужного цвета."
        },
        {
          "phrase": "绿色的牛。",
          "pinyin": "lǜsè de niú.",
          "meaning": "Зелёная корова.",
          "usageHint": "Скажи фразу после броска кубика."
        }
      ]
    },
    {
      "type": "action_cards",
      "title": "Считаем действия",
      "subtitle": "Двигаемся с числом и 次.",
      "tone": "emerald",
      "layout": "movement",
      "sceneId": "scene-actions",
      "items": [
        {
          "term": "跳五次",
          "pinyin": "tiào wǔ cì",
          "meaning": "прыгни 5 раз",
          "movementHint": "Прыгаем и считаем до пяти."
        },
        {
          "term": "拍手三次",
          "pinyin": "pāishǒu sān cì",
          "meaning": "хлопни 3 раза",
          "movementHint": "Хлопай в ладоши и считай до трёх."
        }
      ]
    },
    {
      "type": "worksheet",
      "title": "Тетрадь и песня",
      "subtitle": "Спокойный финал перед прощанием.",
      "tone": "rose",
      "layout": "practice",
      "sceneId": "scene-workbook-song",
      "illustrationSrc": "/methodologies/world-around-me/lesson-3/workbook.svg",
      "pageLabel": "Рабочая тетрадь · стр. 6",
      "instructions": "Раскрась цвета на стр. 6, произнеси каждый цвет и вместе спой my favorite color is blue.",
      "teacherHint": "Попросите детей показать любимый цвет и назвать его вслух.",
      "assetId": "worksheet:workbook-page-6"
    },
    {
      "type": "recap",
      "title": "Повтор дома",
      "subtitle": "Мини-итог перед домашней мини-миссией.",
      "tone": "neutral",
      "layout": "recap",
      "sceneId": "scene-home-review",
      "bullets": [
        "Назови 4 цвета: 红色, 绿色, 蓝色, 黄色.",
        "Скажи фразу: 这是红色。",
        "Скажи про машинку: 红色的车 / 绿色的车.",
        "Повтори счёт с 只: 两只狗, 三只猫.",
        "Сделай 2 команды: 跳五次, 拍手三次."
      ]
    }
  ]
}
```

## Домашнее задание

```json
{
  "id": "methodology-homework:world-around-me-03",
  "methodologyLessonId": "methodology-lesson:world-around-me-03",
  "title": "Мини-миссия: Вспоминаем цвета и машинки",
  "kind": "quiz_single_choice",
  "instructions": "Повтори цвета, машинки и короткие фразы урока 3. Выбери правильный ответ в каждом вопросе.",
  "materialLinks": [
    "Рабочая тетрадь, стр. 6",
    "Карточки 红色/绿色/蓝色/黄色/车"
  ],
  "answerFormatHint": "6 коротких вопросов, по одному ответу.",
  "estimatedMinutes": 6,
  "quiz": {
    "id": "world-around-me-lesson-3-quiz",
    "version": 1,
    "questions": [
      {
        "id": "q1",
        "prompt": "Как по-китайски «красный»?",
        "options": [
          {
            "id": "a",
            "label": "红色"
          },
          {
            "id": "b",
            "label": "绿色"
          },
          {
            "id": "c",
            "label": "蓝色"
          }
        ],
        "correctOptionId": "a"
      },
      {
        "id": "q2",
        "prompt": "Какое слово значит «машина»?",
        "options": [
          {
            "id": "a",
            "label": "只"
          },
          {
            "id": "b",
            "label": "车"
          },
          {
            "id": "c",
            "label": "次"
          }
        ],
        "correctOptionId": "b"
      },
      {
        "id": "q3",
        "prompt": "Выбери правильную фразу:",
        "helperText": "«Мы ведём машину.»",
        "options": [
          {
            "id": "a",
            "label": "我们在开车。"
          },
          {
            "id": "b",
            "label": "我们在跳车。"
          },
          {
            "id": "c",
            "label": "我们是谁？"
          }
        ],
        "correctOptionId": "a"
      },
      {
        "id": "q4",
        "prompt": "Выбери словосочетание «зелёная машина».",
        "options": [
          {
            "id": "a",
            "label": "绿色的车"
          },
          {
            "id": "b",
            "label": "车的绿色"
          },
          {
            "id": "c",
            "label": "绿色在车"
          }
        ],
        "correctOptionId": "a"
      },
      {
        "id": "q5",
        "prompt": "В какой фразе правильно используется 只?",
        "options": [
          {
            "id": "a",
            "label": "三次猫"
          },
          {
            "id": "b",
            "label": "两只狗"
          },
          {
            "id": "c",
            "label": "狗的两"
          }
        ],
        "correctOptionId": "b"
      },
      {
        "id": "q6",
        "prompt": "Выбери команду «Прыгни пять раз».",
        "options": [
          {
            "id": "a",
            "label": "拍手三次。"
          },
          {
            "id": "b",
            "label": "跳五次。"
          },
          {
            "id": "c",
            "label": "跳五只。"
          }
        ],
        "correctOptionId": "b"
      }
    ]
  }
}
```

## Связанные материалы

```json
[
  {
    "id": "song:hello",
    "kind": "song",
    "title": "hello",
    "description": "Песня-приветствие для начала урока 2."
  },
  {
    "id": "video:colors",
    "kind": "video",
    "title": "colors",
    "description": "Видео-сегмент урока 3: знакомство с цветами.",
    "sourceUrl": "https://drive.google.com/file/d/1XzwJU3b9Vdk20LwHUtfqqtWvt6QTESvr/view?usp=drive_link"
  },
  {
    "id": "song:my-favorite-color-is-blue",
    "kind": "song",
    "title": "my favorite color is blue",
    "description": "Песня для финала уроков о любимом цвете.",
    "sourceUrl": "https://drive.google.com/file/d/1poNUSgbO6jgYl7fkQdIb5Zr5pAQ5wAqf/view?usp=drive_link"
  },
  {
    "id": "worksheet:appendix-3",
    "kind": "worksheet",
    "title": "Приложение 3",
    "description": "Сортировка животных по цветам с цветным кубиком."
  },
  {
    "id": "worksheet:workbook-page-6",
    "kind": "worksheet",
    "title": "Рабочая тетрадь, стр. 6",
    "description": "Раскрась цвета и назови их по-китайски."
  },
  {
    "id": "media:color-cards",
    "kind": "media_file",
    "title": "Карточки цветов",
    "description": "Набор карточек 红色、绿色、蓝色、黄色.",
    "fileRef": "/methodologies/world-around-me/lesson-3/color-cards.svg"
  },
  {
    "id": "media:animals-bag",
    "kind": "media_file",
    "title": "Мешочек с игрушечными животными",
    "description": "Игровой реквизит для модели «两只狗 / 三只猫».",
    "fileRef": "/methodologies/world-around-me/lesson-3/animals-bag.svg"
  },
  {
    "id": "media:car-silhouette",
    "kind": "media_file",
    "title": "Силуэт машины",
    "description": "Картонный силуэт машины для моделей «…的车».",
    "fileRef": "/methodologies/world-around-me/lesson-3/car-silhouette.svg"
  },
  {
    "id": "media:color-die",
    "kind": "media_file",
    "title": "Цветной кубик",
    "description": "Кубик цветов для сортировки животных по цвету.",
    "fileRef": "/methodologies/world-around-me/lesson-3/color-die.svg"
  }
]
```
