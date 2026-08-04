# Урок 5. Растения на лугу

- ID: `methodology-lesson:world-around-me-05`
- Позиция: модуль 1, урок 5
- Длительность: 45 минут
- Статус: `ready`
- Шагов/блоков: 17
- Связанных fixture-материалов: 21

## Карточка урока

```json
{
  "id": "methodology-shell:world-around-me-05",
  "methodologyId": "methodology:world-around-me",
  "title": "Урок 5. Растения на лугу",
  "position": {
    "moduleIndex": 1,
    "unitIndex": 1,
    "lessonIndex": 5
  },
  "vocabularySummary": [
    "花",
    "树",
    "草",
    "草地",
    "我很好",
    "我不好",
    "飞",
    "跑",
    "跳",
    "拍手",
    "数"
  ],
  "phraseSummary": [
    "我喜欢蓝色的花。",
    "我喜欢红色的花。",
    "草地上有什么？",
    "草地上有花。",
    "草地上有树。"
  ],
  "estimatedDurationMinutes": 45,
  "mediaSummary": {
    "videos": 1,
    "songs": 2,
    "worksheets": 7,
    "other": 8
  },
  "readinessStatus": "ready"
}
```

## План и все шаги

## 1. Приветствие детей и героев курса

- ID: `block:l5-step-01-greeting`
- Тип: `intro_framing`
- Порядок: 1
- Материалы: `presentation:world-around-me-lesson-5`, `media:lesson-5-heroes`

```json
{
  "title": "Урок 5. Растения на лугу",
  "goal": "Включить детей в урок через знакомых героев и тему природы.",
  "teacherScriptShort": "Поприветствуйте группу и героев, покажите, что сегодня будем собирать луг из цветов, деревьев и травы.",
  "timeboxMinutes": 2,
  "teacher": {
    "goal": "Создать мягкий старт и обозначить тему 花、树、草、草地.",
    "actions": [
      "Покажите слайд с Сяо Лоном и Сяо Мей.",
      "Поприветствуйте детей и предложите отправиться на луг."
    ],
    "expectedResponses": [
      "你好！",
      "你好，小龙！",
      "你好，小妹！"
    ],
    "materials": [
      "герои курса",
      "Презентация урока 5"
    ]
  },
  "student": {
    "componentKey": "lesson_focus_v1",
    "instruction": "Поздоровайся с преподавателем и героями курса."
  }
}
```

## 2. Смотрим видео и входим в тему природы

- ID: `block:l5-step-02-video-nature`
- Тип: `video_segment`
- Порядок: 2
- Материалы: `video:colors`

```json
{
  "promptBeforeWatch": "Смотрим короткий видеовход и вспоминаем цвета, которые понадобятся для цветов на лугу.",
  "focusPoints": [
    "花",
    "树",
    "草",
    "草地",
    "颜色"
  ],
  "questionsAfterWatch": [
    "Какой цвет ты увидел?",
    "Какого цвета может быть 花?"
  ],
  "teacher": {
    "goal": "Разогреть слух и внимание перед вводом слов про растения.",
    "actions": [
      "Включите видеовход или откройте слайд со ссылкой на видео.",
      "После просмотра задайте 1-2 вопроса про цвета и природу."
    ],
    "expectedResponses": [
      "红色",
      "绿色",
      "蓝色",
      "黄色"
    ],
    "materials": [
      "video:colors",
      "Презентация урока 5"
    ]
  },
  "student": {
    "componentKey": "media_asset_v1",
    "instruction": "Смотри, слушай и вспоминай цвета."
  }
}
```

## 3. Проверяем настроение: 我很好 / 我不好

- ID: `block:l5-step-03-feelings`
- Тип: `teacher_prompt_pattern`
- Порядок: 3
- Материалы: нет

```json
{
  "promptPatterns": [
    "我很好",
    "我不好"
  ],
  "expectedStudentResponses": [
    "我很好",
    "我不好"
  ],
  "fallbackRu": "Покажите жестом и мимикой два состояния, затем помогите ребёнку выбрать короткий ответ.",
  "teacher": {
    "goal": "Добавить короткую эмоциональную реплику в ритуал начала.",
    "actions": [
      "Покажите весёлый и грустный смайлы.",
      "Смоделируйте ответы 我很好 и 我不好.",
      "Попросите каждого ребёнка выбрать и повторить фразу."
    ],
    "expectedResponses": [
      "我很好",
      "我不好"
    ],
    "materials": [
      "слайд настроения"
    ]
  },
  "student": {
    "componentKey": "phrase_cards_v1",
    "instruction": "Выбери, как ты себя чувствуешь, и повтори фразу."
  }
}
```

## 4. Песня-ритуал перед новыми словами

- ID: `block:l5-step-04-song`
- Тип: `song_segment`
- Порядок: 4
- Материалы: `song:hello`

```json
{
  "activityGoal": "Переключить группу в музыкальный режим и подготовить к повторению за преподавателем.",
  "teacherActions": [
    "Включите песню по ссылке из презентации или проведите знакомый hello-ритуал."
  ],
  "repeatCount": 1,
  "movementHint": "Добавьте простые движения руками и приветствие героев.",
  "teacher": {
    "goal": "Снять напряжение и собрать внимание перед карточками.",
    "actions": [
      "Запустите песню или спойте короткий знакомый фрагмент.",
      "После песни верните внимание к слайдам 花、树、草、草地."
    ],
    "materials": [
      "song:hello",
      "Презентация урока 5"
    ]
  },
  "student": {
    "componentKey": "song_player_v1",
    "instruction": "Слушай, пой и повторяй движения."
  }
}
```

## 5. Слово 花

- ID: `block:l5-step-05-flower`
- Тип: `vocabulary_focus`
- Порядок: 5
- Материалы: `flashcards:world-around-me-lesson-5`, `media:lesson-5-flower`, `pronunciation:lesson-5-flower`

```json
{
  "items": [
    {
      "term": "花",
      "pinyin": "huā",
      "meaning": "цветок"
    }
  ],
  "practiceMode": "show_picture_then_word_then_repeat",
  "miniDrill": "Покажите картинку цветка, произнесите 花 и попросите повторить 3 раза.",
  "teacher": {
    "goal": "Ввести первое слово урока через крупную карточку и озвучку.",
    "actions": [
      "Покажите картинку цветка.",
      "Произнесите 花 медленно, затем в обычном темпе.",
      "Попросите детей показать цветок рукой или на слайде."
    ],
    "expectedResponses": [
      "花"
    ],
    "materials": [
      "карточка 花",
      "Приложение 1",
      "озвучка 花"
    ]
  },
  "student": {
    "componentKey": "flashcards_v1",
    "instruction": "Смотри на цветок и повторяй: 花."
  }
}
```

## 6. Слово 树

- ID: `block:l5-step-06-tree`
- Тип: `vocabulary_focus`
- Порядок: 6
- Материалы: `flashcards:world-around-me-lesson-5`, `media:lesson-5-tree`

```json
{
  "items": [
    {
      "term": "树",
      "pinyin": "shù",
      "meaning": "дерево"
    }
  ],
  "practiceMode": "show_picture_then_word_then_repeat",
  "miniDrill": "Покажите дерево и сравните: 花 маленький, 树 высокий.",
  "teacher": {
    "goal": "Ввести слово 树 и связать его с образом дерева.",
    "actions": [
      "Покажите дерево на слайде.",
      "Произнесите 树 и попросите детей изобразить высокое дерево."
    ],
    "expectedResponses": [
      "树"
    ],
    "materials": [
      "карточка 树",
      "Приложение 1"
    ]
  },
  "student": {
    "componentKey": "flashcards_v1",
    "instruction": "Смотри на дерево и повторяй: 树."
  }
}
```

## 7. Слово 草

- ID: `block:l5-step-07-grass`
- Тип: `vocabulary_focus`
- Порядок: 7
- Материалы: `flashcards:world-around-me-lesson-5`, `media:lesson-5-grass`

```json
{
  "items": [
    {
      "term": "草",
      "pinyin": "cǎo",
      "meaning": "трава"
    }
  ],
  "practiceMode": "show_picture_then_word_then_repeat",
  "miniDrill": "Покажите траву и попросите детей присесть ниже, чем дерево.",
  "teacher": {
    "goal": "Ввести слово 草 через визуальный и телесный контраст.",
    "actions": [
      "Покажите траву.",
      "Произнесите 草 и попросите детей повторить тихим коротким эхом."
    ],
    "expectedResponses": [
      "草"
    ],
    "materials": [
      "карточка 草",
      "Приложение 1"
    ]
  },
  "student": {
    "componentKey": "flashcards_v1",
    "instruction": "Смотри на траву и повторяй: 草."
  }
}
```

## 8. Слово 草地

- ID: `block:l5-step-08-grassland`
- Тип: `vocabulary_focus`
- Порядок: 8
- Материалы: `flashcards:world-around-me-lesson-5`, `media:lesson-5-grassland`

```json
{
  "items": [
    {
      "term": "草地",
      "pinyin": "cǎodì",
      "meaning": "луг / поле"
    }
  ],
  "practiceMode": "show_scene_then_word_then_phrase",
  "miniDrill": "Соберите значение из 草 + 地: место с травой.",
  "teacher": {
    "goal": "Закрепить знакомое из урока 4 слово 草地 в новой теме растений.",
    "actions": [
      "Покажите фон луга.",
      "Попросите детей сказать 草地 и провести рукой по лугу."
    ],
    "expectedResponses": [
      "草地"
    ],
    "materials": [
      "карточка 草地",
      "Приложение 1"
    ]
  },
  "student": {
    "componentKey": "flashcards_v1",
    "instruction": "Смотри на луг и повторяй: 草地."
  }
}
```

## 9. Игра «Колесо слов»

- ID: `block:l5-step-09-wheel`
- Тип: `guided_activity`
- Порядок: 9
- Материалы: `activity:lesson-5-wheel`

```json
{
  "activityType": "plant_word_wheel",
  "steps": [
    "Откройте колесо слов.",
    "Нажмите Go, затем Stop.",
    "Ребёнок называет слово, на котором остановилось колесо.",
    "После ответа попросите показать предмет на карточке."
  ],
  "successCriteria": [
    "Ребёнок узнаёт 花、树、草、草地.",
    "Ребёнок произносит слово без длинной русской подсказки."
  ],
  "timeboxMinutes": 4,
  "teacher": {
    "goal": "Перевести новые слова из показа карточек в быструю реакцию.",
    "actions": [
      "Запустите wheel game.",
      "После каждого остановленного сектора просите назвать слово."
    ],
    "expectedResponses": [
      "花",
      "树",
      "草",
      "草地"
    ],
    "materials": [
      "Приложение 2",
      "Приложение 3"
    ]
  },
  "student": {
    "componentKey": "plant_wheel_game_v1",
    "instruction": "Останови колесо и назови слово.",
    "payload": {
      "items": [
        {
          "id": "flower",
          "term": "花",
          "pinyin": "huā",
          "meaning": "цветок",
          "illustrationSrc": "/methodologies/world-around-me/lesson-5/assets/flower-purple.png"
        },
        {
          "id": "tree",
          "term": "树",
          "pinyin": "shù",
          "meaning": "дерево",
          "illustrationSrc": "/methodologies/world-around-me/lesson-5/assets/tree.png"
        },
        {
          "id": "grass",
          "term": "草",
          "pinyin": "cǎo",
          "meaning": "трава",
          "illustrationSrc": "/methodologies/world-around-me/lesson-5/assets/grass.png"
        },
        {
          "id": "grassland",
          "term": "草地",
          "pinyin": "cǎodì",
          "meaning": "луг / поле",
          "illustrationSrc": "/methodologies/world-around-me/lesson-5/assets/meadow-bg.jpeg"
        }
      ]
    }
  }
}
```

## 10. Приложение 3: карточки растений

- ID: `block:l5-step-10-plant-cards`
- Тип: `guided_activity`
- Порядок: 10
- Материалы: `activity:lesson-5-plant-cards`

```json
{
  "activityType": "plant_card_matching",
  "steps": [
    "Покажите карточки из Приложения 3.",
    "Перемешайте порядок.",
    "Ребёнок выбирает картинку и называет слово.",
    "Затем ребёнок сопоставляет картинку и иероглиф."
  ],
  "successCriteria": [
    "Ребёнок сопоставляет картинку и слово.",
    "Ребёнок различает 草 и 草地."
  ],
  "timeboxMinutes": 4,
  "teacher": {
    "goal": "Закрепить визуальное различение четырёх слов.",
    "actions": [
      "Откройте карточки растений.",
      "Меняйте порядок карточек и просите назвать слово."
    ],
    "expectedResponses": [
      "花",
      "树",
      "草",
      "草地"
    ],
    "materials": [
      "Приложение 3"
    ]
  },
  "student": {
    "componentKey": "matching_practice_v1",
    "instruction": "Найди пару: картинка и слово."
  }
}
```

## 11. Конструкция 我喜欢…的花

- ID: `block:l5-step-11-favorite-flower`
- Тип: `guided_activity`
- Порядок: 11
- Материалы: `worksheet:lesson-5-favorite-flowers`

```json
{
  "activityType": "favorite_color_flower_phrase",
  "steps": [
    "Покажите цветные цветы и сердце.",
    "Выберите цветок и произнесите 我喜欢蓝色的花.",
    "Дети по очереди выбирают цвет и повторяют фразу."
  ],
  "successCriteria": [
    "Ребёнок понимает модель 我喜欢…",
    "Ребёнок добавляет цвет и слово 花 в одну фразу."
  ],
  "timeboxMinutes": 4,
  "teacher": {
    "goal": "Расширить фразу о любимом цвете: любимый цветок.",
    "actions": [
      "Покажите Приложение 4.",
      "Смоделируйте фразу с разными цветами.",
      "Помогите детям выбрать цвет и повторить фразу."
    ],
    "expectedResponses": [
      "我喜欢蓝色的花。",
      "我喜欢红色的花。",
      "我喜欢黄色的花。",
      "我喜欢绿色的花。"
    ],
    "materials": [
      "Приложение 4",
      "сердце",
      "цветные цветы"
    ]
  },
  "student": {
    "componentKey": "phrase_cards_v1",
    "instruction": "Выбери цветок и скажи, какой цветок тебе нравится."
  }
}
```

## 12. Действия: 飞 / 跑 / 跳 / 拍手 / 数

- ID: `block:l5-step-12-actions`
- Тип: `guided_activity`
- Порядок: 12
- Материалы: `worksheet:lesson-5-actions`

```json
{
  "activityType": "movement_cards_review",
  "steps": [
    "Покажите карточку действия.",
    "Дети называют или повторяют слово.",
    "Вся группа выполняет действие.",
    "Завершите счётом 数 до пяти."
  ],
  "successCriteria": [
    "Ребёнок реагирует движением на действие.",
    "Ребёнок повторяет минимум 3 действия."
  ],
  "timeboxMinutes": 4,
  "teacher": {
    "goal": "Повторить действия из уроков 1-4 и подготовить к счёту на лугу.",
    "actions": [
      "Откройте Приложение 5.",
      "Чередуйте карточки действий в разном темпе."
    ],
    "expectedResponses": [
      "飞",
      "跑",
      "跳",
      "拍手",
      "数"
    ],
    "materials": [
      "Приложение 5",
      "свободное пространство"
    ]
  },
  "student": {
    "componentKey": "movement_cards_v1",
    "instruction": "Смотри на карточку, повторяй слово и выполняй действие."
  }
}
```

## 13. Сцена 草地: что есть на лугу?

- ID: `block:l5-step-13-meadow-scene`
- Тип: `guided_activity`
- Порядок: 13
- Материалы: `media:lesson-5-grassland`, `media:lesson-5-flower`, `media:lesson-5-tree`, `media:lesson-5-grass`

```json
{
  "activityType": "meadow_scene_phrase",
  "steps": [
    "Покажите пустой луг.",
    "Добавьте цветы, деревья и траву.",
    "Задайте вопрос: 草地上有什么？",
    "Отвечайте коротко: 草地上有花 / 树 / 草."
  ],
  "successCriteria": [
    "Ребёнок понимает вопрос 草地上有什么？",
    "Ребёнок отвечает одним словом или короткой фразой."
  ],
  "timeboxMinutes": 4,
  "teacher": {
    "goal": "Связать новые слова в сцену луга.",
    "actions": [
      "Постепенно добавляйте объекты на луг.",
      "Задавайте вопрос и принимайте ответы от одного слова до фразы."
    ],
    "expectedResponses": [
      "花",
      "树",
      "草",
      "草地上有花。"
    ],
    "materials": [
      "фон луга",
      "картинки 花、树、草"
    ]
  },
  "student": {
    "componentKey": "phrase_cards_v1",
    "instruction": "Посмотри на луг и скажи, что на нём есть."
  }
}
```

## 14. Считаем цветы, деревья и траву

- ID: `block:l5-step-14-count-meadow`
- Тип: `guided_activity`
- Порядок: 14
- Материалы: `worksheet:lesson-5-meadow-count`, `media:lesson-5-count-hands`

```json
{
  "activityType": "meadow_counting",
  "steps": [
    "Откройте Приложение 6.",
    "Сначала посчитайте цветы.",
    "Затем деревья и кусты травы.",
    "После каждого счёта повторите объект: 花 / 树 / 草."
  ],
  "successCriteria": [
    "Ребёнок считает до 10 с поддержкой.",
    "Ребёнок соединяет число и объект."
  ],
  "timeboxMinutes": 4,
  "teacher": {
    "goal": "Закрепить слова урока через счёт.",
    "actions": [
      "Показывайте группы объектов на лугу.",
      "Ведите счёт хором и индивидуально."
    ],
    "expectedResponses": [
      "一、二、三、四、五",
      "十朵花",
      "十棵树"
    ],
    "materials": [
      "Приложение 6",
      "счёт на пальцах"
    ]
  },
  "student": {
    "componentKey": "count_board_v1",
    "instruction": "Выбери группу на лугу и посчитай вместе с преподавателем."
  }
}
```

## 15. Создаём и раскрашиваем луг

- ID: `block:l5-step-15-create-meadow`
- Тип: `worksheet_task`
- Порядок: 15
- Материалы: `worksheet:lesson-5-flower-coloring`, `worksheet:lesson-5-homework-meadow`

```json
{
  "taskInstruction": "Раскрась цветок, выбери элементы луга и собери свою сцену: 花、树、草、草地.",
  "completionMode": "in_class",
  "answerKeyHint": "Ребёнок называет минимум два элемента своего луга по-китайски.",
  "homeExtension": "Дома можно вырезать, наклеить изученные слова и раскрасить собственный луг.",
  "teacher": {
    "goal": "Перенести лексику в творческое задание.",
    "actions": [
      "Откройте Приложения 7 и 8.",
      "Покажите, как выбрать цвет и элементы луга.",
      "Просите детей называть добавленный элемент по-китайски."
    ],
    "expectedResponses": [
      "花",
      "树",
      "草",
      "草地"
    ],
    "materials": [
      "Приложение 7",
      "Приложение 8",
      "карандаши",
      "клей",
      "ножницы"
    ]
  },
  "student": {
    "componentKey": "meadow_builder_v1",
    "instruction": "Собери свой луг и называй элементы по-китайски.",
    "payload": {
      "elements": [
        {
          "id": "flower",
          "term": "花",
          "meaning": "цветок",
          "targetCount": 3,
          "illustrationSrc": "/methodologies/world-around-me/lesson-5/assets/flower-purple.png"
        },
        {
          "id": "tree",
          "term": "树",
          "meaning": "дерево",
          "targetCount": 2,
          "illustrationSrc": "/methodologies/world-around-me/lesson-5/assets/tree.png"
        },
        {
          "id": "grass",
          "term": "草",
          "meaning": "трава",
          "targetCount": 4,
          "illustrationSrc": "/methodologies/world-around-me/lesson-5/assets/grass.png"
        }
      ]
    }
  }
}
```

## 16. Песня, прощание и домашняя миссия

- ID: `block:l5-step-16-goodbye-homework`
- Тип: `wrap_up_closure`
- Порядок: 16
- Материалы: `song:my-favorite-color-is-blue`, `song-video:my-favorite-color-is-blue`, `worksheet:lesson-5-homework`, `media:lesson-5-heroes`

```json
{
  "recapPoints": [
    "Назови слова урока: 花、树、草、草地.",
    "Скажи фразу: 我喜欢蓝色的花.",
    "Посчитай предметы на лугу.",
    "Попрощайся с героями курса."
  ],
  "exitCheck": "Каждый ребёнок называет один элемент луга перед прощанием.",
  "previewNextLesson": "Дома ребёнок создаёт свой луг и повторяет слова урока.",
  "teacherReflectionPrompt": "Отметьте, различают ли дети 草 и 草地 без русской подсказки.",
  "teacher": {
    "goal": "Закрыть урок песней, повтором и понятной домашней миссией.",
    "actions": [
      "Включите финальную песню.",
      "Попросите каждого ребёнка назвать одно слово урока.",
      "Покажите домашнее задание: создать луг."
    ],
    "expectedResponses": [
      "花",
      "树",
      "草",
      "草地",
      "再见！"
    ],
    "materials": [
      "песня my favorite color is blue",
      "домашнее задание урока 5"
    ]
  },
  "student": {
    "componentKey": "song_player_v1",
    "instruction": "Спой, повтори слова урока и попрощайся с героями."
  }
}
```

## 17. Подготовка материалов урока 5

- ID: `block:l5-materials-prep`
- Тип: `materials_prep`
- Порядок: 17
- Материалы: `presentation:world-around-me-lesson-5`, `flashcards:world-around-me-lesson-5`, `activity:lesson-5-wheel`, `activity:lesson-5-plant-cards`, `worksheet:lesson-5-favorite-flowers`, `worksheet:lesson-5-actions`, `worksheet:lesson-5-meadow-count`, `worksheet:lesson-5-flower-coloring`, `worksheet:lesson-5-homework-meadow`, `worksheet:lesson-5-homework`

```json
{
  "materialsChecklist": [
    "герои курса",
    "Презентация урока 5",
    "Приложение 1: карточки 花、树、草、草地",
    "Приложение 2: колесо слов",
    "Приложение 3: карточки растений",
    "Приложение 4: любимые цветы",
    "Приложение 5: действия 飞、跑、跳、拍手、数",
    "Приложение 6: счёт на лугу",
    "Приложения 7-8: творческий луг",
    "карандаши, клей, ножницы"
  ],
  "roomSetupNotes": "Подготовьте экран для презентации, стол для раскрашивания и свободную зону для действий."
}
```

## Экран ученика

```json
{
  "id": "methodology-student-content:world-around-me-05",
  "methodologyLessonId": "methodology-lesson:world-around-me-05",
  "title": "Урок 5. Растения на лугу",
  "subtitle": "Цветы, деревья, трава, луг, любимый цветок, действия и счёт на лугу.",
  "sections": [
    {
      "type": "lesson_focus",
      "title": "Приветствие детей и героев курса",
      "subtitle": "Сяо Лон и Сяо Мей приглашают на луг.",
      "body": "Поздоровайся с героями и приготовься собирать луг из цветов, деревьев и травы.",
      "chips": [
        "你好",
        "花",
        "树",
        "草地"
      ],
      "tone": "sky",
      "layout": "hero",
      "illustrationSrc": "/methodologies/world-around-me/lesson-5/assets/heroes.png",
      "sceneId": "l5-step-01"
    },
    {
      "type": "media_asset",
      "title": "Смотрим видео и входим в тему природы",
      "subtitle": "Вспоминаем цвета перед цветами на лугу.",
      "tone": "sky",
      "layout": "practice",
      "sceneId": "l5-step-02",
      "assetId": "video:colors",
      "assetKind": "video",
      "studentPrompt": "Смотри видео и называй цвета, которые узнаёшь.",
      "ctaLabel": "Открыть видео"
    },
    {
      "type": "phrase_cards",
      "title": "Проверяем настроение: 我很好 / 我不好",
      "subtitle": "Выбери фразу про своё настроение.",
      "tone": "amber",
      "layout": "phrases",
      "sceneId": "l5-step-03",
      "items": [
        {
          "phrase": "我很好",
          "pinyin": "wǒ hěn hǎo",
          "meaning": "у меня всё хорошо",
          "usageHint": "Скажи, если настроение хорошее."
        },
        {
          "phrase": "我不好",
          "pinyin": "wǒ bù hǎo",
          "meaning": "мне нехорошо / не очень",
          "usageHint": "Скажи, если настроение не очень."
        }
      ]
    },
    {
      "type": "media_asset",
      "title": "Песня-ритуал перед новыми словами",
      "subtitle": "Поём короткий приветственный фрагмент.",
      "tone": "rose",
      "layout": "practice",
      "sceneId": "l5-step-04",
      "assetId": "song:hello",
      "assetKind": "song",
      "studentPrompt": "Слушай, пой и повторяй движения.",
      "ctaLabel": "Открыть песню"
    },
    {
      "type": "vocabulary_cards",
      "title": "Слово 花",
      "subtitle": "Смотри на цветок и повторяй слово.",
      "tone": "amber",
      "layout": "vocabulary",
      "sceneId": "l5-step-05",
      "displayMode": "carousel",
      "items": [
        {
          "term": "花",
          "pinyin": "huā",
          "meaning": "цветок",
          "visualHint": "Покажи цветок на картинке.",
          "illustrationSrc": "/methodologies/world-around-me/lesson-5/assets/flower-purple.png",
          "audioAssetId": "pronunciation:lesson-5-flower"
        }
      ]
    },
    {
      "type": "vocabulary_cards",
      "title": "Слово 树",
      "subtitle": "Смотри на дерево и повторяй слово.",
      "tone": "emerald",
      "layout": "vocabulary",
      "sceneId": "l5-step-06",
      "displayMode": "carousel",
      "items": [
        {
          "term": "树",
          "pinyin": "shù",
          "meaning": "дерево",
          "visualHint": "Покажи, какое дерево высокое.",
          "illustrationSrc": "/methodologies/world-around-me/lesson-5/assets/tree.png"
        }
      ]
    },
    {
      "type": "vocabulary_cards",
      "title": "Слово 草",
      "subtitle": "Смотри на траву и повторяй слово.",
      "tone": "emerald",
      "layout": "vocabulary",
      "sceneId": "l5-step-07",
      "displayMode": "carousel",
      "items": [
        {
          "term": "草",
          "pinyin": "cǎo",
          "meaning": "трава",
          "visualHint": "Покажи траву низко у земли.",
          "illustrationSrc": "/methodologies/world-around-me/lesson-5/assets/grass.png"
        }
      ]
    },
    {
      "type": "vocabulary_cards",
      "title": "Слово 草地",
      "subtitle": "Смотри на луг и повторяй слово.",
      "tone": "sky",
      "layout": "vocabulary",
      "sceneId": "l5-step-08",
      "displayMode": "carousel",
      "items": [
        {
          "term": "草地",
          "pinyin": "cǎodì",
          "meaning": "луг / поле",
          "visualHint": "Покажи весь луг.",
          "illustrationSrc": "/methodologies/world-around-me/lesson-5/assets/meadow-bg.jpeg"
        }
      ]
    },
    {
      "type": "lesson_focus",
      "title": "Игра «Колесо слов»",
      "subtitle": "Останови колесо и назови слово.",
      "body": "Нажми Stop, посмотри на выпавшую карточку и произнеси слово по-китайски.",
      "chips": [
        "花",
        "树",
        "草",
        "草地"
      ],
      "tone": "violet",
      "layout": "practice",
      "sceneId": "l5-step-09"
    },
    {
      "type": "matching_practice",
      "title": "Приложение 3: карточки растений",
      "subtitle": "Соединяем картинку и слово.",
      "tone": "amber",
      "layout": "practice",
      "sceneId": "l5-step-10",
      "prompt": "Найди пару: картинка растения и правильный иероглиф.",
      "pairs": [
        {
          "id": "flower",
          "label": "花",
          "illustrationSrc": "/methodologies/world-around-me/lesson-5/assets/flower-purple.png"
        },
        {
          "id": "tree",
          "label": "树",
          "illustrationSrc": "/methodologies/world-around-me/lesson-5/assets/tree.png"
        },
        {
          "id": "grass",
          "label": "草",
          "illustrationSrc": "/methodologies/world-around-me/lesson-5/assets/grass.png"
        },
        {
          "id": "grassland",
          "label": "草地",
          "illustrationSrc": "/methodologies/world-around-me/lesson-5/assets/meadow-bg.jpeg"
        }
      ]
    },
    {
      "type": "phrase_cards",
      "title": "Конструкция 我喜欢…的花",
      "subtitle": "Выбираем любимый цветок.",
      "tone": "rose",
      "layout": "phrases",
      "illustrationSrc": "/methodologies/world-around-me/lesson-5/assets/colored-flowers.png",
      "sceneId": "l5-step-11",
      "items": [
        {
          "phrase": "我喜欢蓝色的花。",
          "pinyin": "wǒ xǐhuan lánsè de huā.",
          "meaning": "мне нравится синий цветок",
          "usageHint": "Выбери синий цветок."
        },
        {
          "phrase": "我喜欢红色的花。",
          "pinyin": "wǒ xǐhuan hóngsè de huā.",
          "meaning": "мне нравится красный цветок",
          "usageHint": "Выбери красный цветок."
        },
        {
          "phrase": "我喜欢黄色的花。",
          "pinyin": "wǒ xǐhuan huángsè de huā.",
          "meaning": "мне нравится жёлтый цветок",
          "usageHint": "Выбери жёлтый цветок."
        },
        {
          "phrase": "我喜欢绿色的花。",
          "pinyin": "wǒ xǐhuan lǜsè de huā.",
          "meaning": "мне нравится зелёный цветок",
          "usageHint": "Выбери зелёный цветок."
        }
      ]
    },
    {
      "type": "action_cards",
      "title": "Действия: 飞 / 跑 / 跳 / 拍手 / 数",
      "subtitle": "Смотри на карточку и выполняй действие.",
      "tone": "emerald",
      "layout": "movement",
      "sceneId": "l5-step-12",
      "displayMode": "slider",
      "items": [
        {
          "term": "飞",
          "pinyin": "fēi",
          "meaning": "летать",
          "movementHint": "Покажи руками, как летишь.",
          "illustrationSrc": "/methodologies/world-around-me/lesson-5/presentation/lesson-5-slide-13.png"
        },
        {
          "term": "跑",
          "pinyin": "pǎo",
          "meaning": "бежать",
          "movementHint": "Беги на месте.",
          "commandExample": "我们跑吧！",
          "illustrationSrc": "/methodologies/world-around-me/lesson-5/presentation/lesson-5-slide-14.png"
        },
        {
          "term": "跳",
          "pinyin": "tiào",
          "meaning": "прыгать",
          "movementHint": "Прыгни по команде.",
          "commandExample": "我们跳吧！",
          "illustrationSrc": "/methodologies/world-around-me/lesson-5/presentation/lesson-5-slide-15.png"
        },
        {
          "term": "拍手",
          "pinyin": "pāishǒu",
          "meaning": "хлопать",
          "movementHint": "Хлопай в ладоши.",
          "illustrationSrc": "/methodologies/world-around-me/lesson-5/presentation/lesson-5-slide-16.png"
        },
        {
          "term": "数",
          "pinyin": "shǔ",
          "meaning": "считать",
          "movementHint": "Считай вместе до пяти.",
          "commandExample": "我们数到五吧！",
          "illustrationSrc": "/methodologies/world-around-me/lesson-5/presentation/lesson-5-slide-17.png"
        }
      ]
    },
    {
      "type": "phrase_cards",
      "title": "Сцена 草地: что есть на лугу?",
      "subtitle": "Смотрим на луг и говорим, что на нём есть.",
      "tone": "sky",
      "layout": "farm",
      "illustrationSrc": "/methodologies/world-around-me/lesson-5/assets/meadow-bg.jpeg",
      "sceneId": "l5-step-13",
      "items": [
        {
          "phrase": "草地上有什么？",
          "pinyin": "cǎodì shàng yǒu shénme?",
          "meaning": "что есть на лугу?",
          "usageHint": "Посмотри на луг и ответь."
        },
        {
          "phrase": "草地上有花。",
          "pinyin": "cǎodì shàng yǒu huā.",
          "meaning": "на лугу есть цветы",
          "usageHint": "Скажи, когда видишь цветы."
        },
        {
          "phrase": "草地上有树。",
          "pinyin": "cǎodì shàng yǒu shù.",
          "meaning": "на лугу есть деревья",
          "usageHint": "Скажи, когда видишь деревья."
        },
        {
          "phrase": "草地上有草。",
          "pinyin": "cǎodì shàng yǒu cǎo.",
          "meaning": "на лугу есть трава",
          "usageHint": "Скажи, когда видишь траву."
        }
      ]
    },
    {
      "type": "count_board",
      "title": "Считаем цветы, деревья и траву",
      "subtitle": "Выбери группу на лугу и посчитай.",
      "tone": "sky",
      "layout": "counting",
      "illustrationSrc": "/methodologies/world-around-me/lesson-5/assets/count-hands.png",
      "sceneId": "l5-step-14",
      "prompt": "Назови объект и посчитай его вместе с преподавателем.",
      "assetId": "worksheet:lesson-5-meadow-count",
      "groups": [
        {
          "id": "flowers",
          "label": "花 · 10",
          "count": 10,
          "cue": "花：一、二、三、四、五、六、七、八、九、十"
        },
        {
          "id": "trees",
          "label": "树 · 10",
          "count": 10,
          "cue": "树：一、二、三、四、五、六、七、八、九、十"
        },
        {
          "id": "grass",
          "label": "草 · 10",
          "count": 10,
          "cue": "草：一、二、三、四、五、六、七、八、九、十"
        }
      ]
    },
    {
      "type": "worksheet",
      "title": "Создаём и раскрашиваем луг",
      "subtitle": "Выбираем элементы и собираем свой 草地.",
      "tone": "emerald",
      "layout": "practice",
      "sceneId": "l5-step-15",
      "pageLabel": "Приложения 7-8 · творческий луг",
      "instructions": "Добавь цветы, деревья и траву на луг. Называй каждый элемент по-китайски.",
      "teacherHint": "Проверяйте устно: ребёнок должен назвать минимум два элемента луга.",
      "assetId": "worksheet:lesson-5-homework-meadow"
    },
    {
      "type": "recap",
      "title": "Песня, прощание и домашняя миссия",
      "subtitle": "Повторяем главное и завершаем урок.",
      "tone": "neutral",
      "layout": "recap",
      "illustrationSrc": "/methodologies/world-around-me/lesson-5/assets/heroes.png",
      "sceneId": "l5-step-16",
      "bullets": [
        "Назови слова урока: 花, 树, 草, 草地.",
        "Скажи любимый цветок: 我喜欢蓝色的花.",
        "Посчитай предметы на лугу.",
        "Открой домашнюю миссию и создай свой луг.",
        "Попрощайся с героями курса."
      ]
    }
  ]
}
```

## Домашнее задание

```json
{
  "id": "methodology-homework:world-around-me-05",
  "methodologyLessonId": "methodology-lesson:world-around-me-05",
  "title": "Мини-миссия: Создай свой луг",
  "kind": "quiz_single_choice",
  "instructions": "Повтори слова 花、树、草、草地, фразу про любимый цветок и счёт на лугу. Затем создай свой луг: вырежи, наклей, раскрась и назови элементы по-китайски.",
  "materialLinks": [
    "Приложение 8: домашний луг",
    "Домашнее задание урока 5",
    "Карточки 花 / 树 / 草 / 草地"
  ],
  "answerFormatHint": "Творческая распечатка + 6 коротких вопросов.",
  "estimatedMinutes": 10,
  "quiz": {
    "id": "world-around-me-lesson-5-quiz",
    "version": 1,
    "title": "Домашняя мини-миссия: Растения на лугу",
    "subtitle": "Вспомни слова урока и собери свой 草地.",
    "introText": "Выбери правильный ответ, а потом создай луг с цветами, деревьями и травой.",
    "completionTitle": "Луг готов!",
    "completionText": "Ты повторил(а) растения, любимый цветок и счёт урока 5.",
    "illustrationSrc": "/methodologies/world-around-me/lesson-5/assets/homework-meadow.jpeg",
    "tone": "emerald",
    "practiceSections": [
      {
        "id": "audio-review-l5",
        "type": "audio_review",
        "title": "Слова урока 5",
        "groups": [
          {
            "id": "plants",
            "title": "Растения и луг",
            "entries": [
              {
                "id": "flower",
                "hanzi": "花",
                "pinyin": "huā",
                "meaning": "цветок",
                "audioAssetId": "pronunciation:lesson-5-flower",
                "audioUrl": "/methodologies/world-around-me/lesson-5/audio/lesson-5-audio-1.wav"
              },
              {
                "id": "tree",
                "hanzi": "树",
                "pinyin": "shù",
                "meaning": "дерево"
              },
              {
                "id": "grass",
                "hanzi": "草",
                "pinyin": "cǎo",
                "meaning": "трава"
              },
              {
                "id": "grassland",
                "hanzi": "草地",
                "pinyin": "cǎodì",
                "meaning": "луг / поле"
              }
            ]
          },
          {
            "id": "phrases",
            "title": "Фразы",
            "entries": [
              {
                "id": "favorite-flower",
                "hanzi": "我喜欢蓝色的花。",
                "pinyin": "wǒ xǐhuan lánsè de huā.",
                "meaning": "мне нравится синий цветок"
              },
              {
                "id": "meadow-has",
                "hanzi": "草地上有花。",
                "pinyin": "cǎodì shàng yǒu huā.",
                "meaning": "на лугу есть цветы"
              }
            ]
          }
        ]
      },
      {
        "id": "matching-l5",
        "type": "matching",
        "title": "Соедини слово и картинку",
        "prompt": "Перетащи иероглиф к правильной карточке растения.",
        "items": [
          {
            "id": "flower",
            "label": "花",
            "illustrationSrc": "/methodologies/world-around-me/lesson-5/assets/flower-purple.png"
          },
          {
            "id": "tree",
            "label": "树",
            "illustrationSrc": "/methodologies/world-around-me/lesson-5/assets/tree.png"
          },
          {
            "id": "grass",
            "label": "草",
            "illustrationSrc": "/methodologies/world-around-me/lesson-5/assets/grass.png"
          },
          {
            "id": "grassland",
            "label": "草地",
            "illustrationSrc": "/methodologies/world-around-me/lesson-5/assets/meadow-bg.jpeg"
          }
        ]
      }
    ],
    "questions": [
      {
        "id": "q1",
        "prompt": "Как по-китайски «цветок»?",
        "options": [
          {
            "id": "a",
            "label": "花"
          },
          {
            "id": "b",
            "label": "树"
          },
          {
            "id": "c",
            "label": "草"
          }
        ],
        "correctOptionId": "a"
      },
      {
        "id": "q2",
        "prompt": "Что значит 树?",
        "options": [
          {
            "id": "a",
            "label": "трава"
          },
          {
            "id": "b",
            "label": "дерево"
          },
          {
            "id": "c",
            "label": "цветок"
          }
        ],
        "correctOptionId": "b"
      },
      {
        "id": "q3",
        "prompt": "Какое слово значит «трава»?",
        "options": [
          {
            "id": "a",
            "label": "草"
          },
          {
            "id": "b",
            "label": "草地"
          },
          {
            "id": "c",
            "label": "花"
          }
        ],
        "correctOptionId": "a"
      },
      {
        "id": "q4",
        "prompt": "Выбери слово «луг / поле».",
        "options": [
          {
            "id": "a",
            "label": "树"
          },
          {
            "id": "b",
            "label": "草地"
          },
          {
            "id": "c",
            "label": "拍手"
          }
        ],
        "correctOptionId": "b"
      },
      {
        "id": "q5",
        "prompt": "Выбери фразу «Мне нравится синий цветок».",
        "options": [
          {
            "id": "a",
            "label": "我喜欢蓝色的花。"
          },
          {
            "id": "b",
            "label": "我不好花。"
          },
          {
            "id": "c",
            "label": "草地上有树。"
          }
        ],
        "correctOptionId": "a"
      },
      {
        "id": "q6",
        "prompt": "Что можно сказать, если на лугу есть цветы?",
        "options": [
          {
            "id": "a",
            "label": "草地上有花。"
          },
          {
            "id": "b",
            "label": "花在跑。"
          },
          {
            "id": "c",
            "label": "我不好树。"
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
    "id": "song-video:my-favorite-color-is-blue",
    "kind": "song_video",
    "title": "my favorite color is blue (video)",
    "description": "Видео песни для демонстрации и подпевания.",
    "sourceUrl": "https://drive.google.com/file/d/187Poj_6dwktDokSSRkqzGy5MBmiRTAhG/view?usp=drive_link"
  },
  {
    "id": "presentation:world-around-me-lesson-5",
    "kind": "presentation",
    "title": "Презентация урока 5",
    "description": "Student Screen deck: растения, луг, действия, счёт и домашнее задание.",
    "fileRef": "/methodologies/world-around-me/lesson-5/presentation/lesson-5-visual.pdf",
    "metadata": {
      "pptxFileRef": "/methodologies/world-around-me/lesson-5/presentation/lesson-5-visual.pptx",
      "slideImageRefs": [
        "/methodologies/world-around-me/lesson-5/presentation/lesson-5-slide-01.png",
        "/methodologies/world-around-me/lesson-5/presentation/lesson-5-slide-02.png",
        "/methodologies/world-around-me/lesson-5/presentation/lesson-5-slide-03.png",
        "/methodologies/world-around-me/lesson-5/presentation/lesson-5-slide-04.png",
        "/methodologies/world-around-me/lesson-5/presentation/lesson-5-slide-05.png",
        "/methodologies/world-around-me/lesson-5/presentation/lesson-5-slide-06.png",
        "/methodologies/world-around-me/lesson-5/presentation/lesson-5-slide-07.png",
        "/methodologies/world-around-me/lesson-5/presentation/lesson-5-slide-08.png",
        "/methodologies/world-around-me/lesson-5/presentation/lesson-5-slide-09.png",
        "/methodologies/world-around-me/lesson-5/presentation/lesson-5-slide-10.png",
        "/methodologies/world-around-me/lesson-5/presentation/lesson-5-slide-11.png",
        "/methodologies/world-around-me/lesson-5/presentation/lesson-5-slide-12.png",
        "/methodologies/world-around-me/lesson-5/presentation/lesson-5-slide-13.png",
        "/methodologies/world-around-me/lesson-5/presentation/lesson-5-slide-14.png",
        "/methodologies/world-around-me/lesson-5/presentation/lesson-5-slide-15.png",
        "/methodologies/world-around-me/lesson-5/presentation/lesson-5-slide-16.png",
        "/methodologies/world-around-me/lesson-5/presentation/lesson-5-slide-17.png",
        "/methodologies/world-around-me/lesson-5/presentation/lesson-5-slide-18.png",
        "/methodologies/world-around-me/lesson-5/presentation/lesson-5-slide-19.png",
        "/methodologies/world-around-me/lesson-5/presentation/lesson-5-slide-20.png",
        "/methodologies/world-around-me/lesson-5/presentation/lesson-5-slide-21.png",
        "/methodologies/world-around-me/lesson-5/presentation/lesson-5-slide-22.png",
        "/methodologies/world-around-me/lesson-5/presentation/lesson-5-slide-23.png",
        "/methodologies/world-around-me/lesson-5/presentation/lesson-5-slide-24.png",
        "/methodologies/world-around-me/lesson-5/presentation/lesson-5-slide-25.png",
        "/methodologies/world-around-me/lesson-5/presentation/lesson-5-slide-26.png",
        "/methodologies/world-around-me/lesson-5/presentation/lesson-5-slide-27.png",
        "/methodologies/world-around-me/lesson-5/presentation/lesson-5-slide-28.png",
        "/methodologies/world-around-me/lesson-5/presentation/lesson-5-slide-29.png",
        "/methodologies/world-around-me/lesson-5/presentation/lesson-5-slide-30.png"
      ]
    }
  },
  {
    "id": "flashcards:world-around-me-lesson-5",
    "kind": "flashcards_pdf",
    "title": "Карточки урока 5: растения и луг",
    "description": "Карточки 花、树、草、草地 с картинками и пиньинем.",
    "fileRef": "/methodologies/world-around-me/lesson-5/appendices/appendix-1-flashcards.pdf",
    "metadata": {
      "cardImageRefs": [
        "/methodologies/world-around-me/lesson-5/appendices/appendix-1-page-1.png",
        "/methodologies/world-around-me/lesson-5/appendices/appendix-1-page-2.png",
        "/methodologies/world-around-me/lesson-5/appendices/appendix-1-page-3.png",
        "/methodologies/world-around-me/lesson-5/appendices/appendix-1-page-4.png",
        "/methodologies/world-around-me/lesson-5/appendices/appendix-1-page-5.png",
        "/methodologies/world-around-me/lesson-5/appendices/appendix-1-page-6.png",
        "/methodologies/world-around-me/lesson-5/appendices/appendix-1-page-7.png",
        "/methodologies/world-around-me/lesson-5/appendices/appendix-1-page-8.png"
      ]
    }
  },
  {
    "id": "activity:lesson-5-wheel",
    "kind": "activity_template",
    "title": "Приложение 2: колесо слов",
    "description": "Колесо для игры: крутим, останавливаем и называем растение.",
    "fileRef": "/methodologies/world-around-me/lesson-5/appendices/appendix-2-wheel.pdf",
    "metadata": {
      "previewImageRef": "/methodologies/world-around-me/lesson-5/appendices/appendix-2-page-01.png"
    }
  },
  {
    "id": "activity:lesson-5-plant-cards",
    "kind": "activity_template",
    "title": "Приложение 3: карточки растений",
    "description": "PPTX-карточки 花、树、草、草地 для быстрой практики.",
    "fileRef": "/methodologies/world-around-me/lesson-5/appendices/appendix-3-cards.pdf",
    "metadata": {
      "pptxFileRef": "/methodologies/world-around-me/lesson-5/appendices/appendix-3-cards.pptx",
      "slideImageRefs": [
        "/methodologies/world-around-me/lesson-5/appendices/appendix-3-page-1.png",
        "/methodologies/world-around-me/lesson-5/appendices/appendix-3-page-2.png"
      ]
    }
  },
  {
    "id": "worksheet:lesson-5-favorite-flowers",
    "kind": "worksheet_pdf",
    "title": "Приложение 4: любимые цветы",
    "description": "Цветные цветы и сердца для фразы 我喜欢…的花.",
    "fileRef": "/methodologies/world-around-me/lesson-5/appendices/appendix-4-favorite-flowers.pdf",
    "metadata": {
      "previewImageRefs": [
        "/methodologies/world-around-me/lesson-5/appendices/appendix-4-page-1.png",
        "/methodologies/world-around-me/lesson-5/appendices/appendix-4-page-2.png"
      ]
    }
  },
  {
    "id": "worksheet:lesson-5-actions",
    "kind": "worksheet_pdf",
    "title": "Приложение 5: действия",
    "description": "Карточки действий 飞、跑、跳、拍手、数 для повторения.",
    "fileRef": "/methodologies/world-around-me/lesson-5/appendices/appendix-5-actions.pdf",
    "metadata": {
      "previewImageRefs": [
        "/methodologies/world-around-me/lesson-5/appendices/appendix-5-page-1.png",
        "/methodologies/world-around-me/lesson-5/appendices/appendix-5-page-2.png"
      ]
    }
  },
  {
    "id": "worksheet:lesson-5-meadow-count",
    "kind": "worksheet_pdf",
    "title": "Приложение 6: считаем на лугу",
    "description": "Луг с цветами, деревьями и травой для счёта до десяти.",
    "fileRef": "/methodologies/world-around-me/lesson-5/appendices/appendix-6-meadow-count.pdf",
    "metadata": {
      "previewImageRefs": [
        "/methodologies/world-around-me/lesson-5/appendices/appendix-6-page-1.png",
        "/methodologies/world-around-me/lesson-5/appendices/appendix-6-page-2.png"
      ]
    }
  },
  {
    "id": "worksheet:lesson-5-flower-coloring",
    "kind": "worksheet_pdf",
    "title": "Приложение 7: раскрась цветок",
    "description": "Цветок для раскрашивания и фразы про любимый цвет.",
    "fileRef": "/methodologies/world-around-me/lesson-5/appendices/appendix-7-flower-coloring.pdf",
    "metadata": {
      "previewImageRef": "/methodologies/world-around-me/lesson-5/appendices/appendix-7-page-01.png"
    }
  },
  {
    "id": "worksheet:lesson-5-homework-meadow",
    "kind": "worksheet_pdf",
    "title": "Приложение 8: домашний луг",
    "description": "Распечатка для создания луга дома: вырезать, наклеить, раскрасить.",
    "fileRef": "/methodologies/world-around-me/lesson-5/appendices/appendix-8-homework-meadow.pdf",
    "metadata": {
      "previewImageRef": "/methodologies/world-around-me/lesson-5/appendices/appendix-8-page-01.png"
    }
  },
  {
    "id": "worksheet:lesson-5-homework",
    "kind": "worksheet_pdf",
    "title": "Домашнее задание урока 5",
    "description": "PDF-инструкция: создать луг с изученными словами.",
    "fileRef": "/methodologies/world-around-me/lesson-5/appendices/homework-lesson-5.pdf",
    "metadata": {
      "previewImageRef": "/methodologies/world-around-me/lesson-5/appendices/homework-page-01.png"
    }
  },
  {
    "id": "media:lesson-5-heroes",
    "kind": "media_file",
    "title": "Сяо Лон и Сяо Мей",
    "description": "Герои курса для приветствия и прощания.",
    "fileRef": "/methodologies/world-around-me/lesson-5/assets/heroes.png"
  },
  {
    "id": "media:lesson-5-flower",
    "kind": "media_file",
    "title": "Картинка 花",
    "description": "Визуальная опора для слова 花.",
    "fileRef": "/methodologies/world-around-me/lesson-5/assets/flower-purple.png"
  },
  {
    "id": "media:lesson-5-tree",
    "kind": "media_file",
    "title": "Картинка 树",
    "description": "Визуальная опора для слова 树.",
    "fileRef": "/methodologies/world-around-me/lesson-5/assets/tree.png"
  },
  {
    "id": "media:lesson-5-grass",
    "kind": "media_file",
    "title": "Картинка 草",
    "description": "Визуальная опора для слова 草.",
    "fileRef": "/methodologies/world-around-me/lesson-5/assets/grass.png"
  },
  {
    "id": "media:lesson-5-grassland",
    "kind": "media_file",
    "title": "Картинка 草地",
    "description": "Фон луга для фраз и счёта.",
    "fileRef": "/methodologies/world-around-me/lesson-5/assets/meadow-bg.jpeg"
  },
  {
    "id": "media:lesson-5-count-hands",
    "kind": "media_file",
    "title": "Счёт на пальцах 1-5",
    "description": "Опора для повторения счёта перед задачами с лугом.",
    "fileRef": "/methodologies/world-around-me/lesson-5/assets/count-hands.png"
  },
  {
    "id": "pronunciation:lesson-5-flower",
    "kind": "pronunciation_audio",
    "title": "花 · huā",
    "description": "Озвучка из презентации урока 5.",
    "fileRef": "/methodologies/world-around-me/lesson-5/audio/lesson-5-audio-1.wav"
  }
]
```
