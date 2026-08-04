# Урок 4. Мне нравятся цвета

- ID: `methodology-lesson:world-around-me-04`
- Позиция: модуль 1, урок 4
- Длительность: 45 минут
- Статус: `ready`
- Шагов/блоков: 17
- Связанных fixture-материалов: 15

## Карточка урока

```json
{
  "id": "methodology-shell:world-around-me-04",
  "methodologyId": "methodology:world-around-me",
  "title": "Урок 4. Мне нравятся цвета",
  "position": {
    "moduleIndex": 1,
    "unitIndex": 1,
    "lessonIndex": 4
  },
  "vocabularySummary": [
    "橘色",
    "黑色",
    "白色",
    "棕色",
    "草地",
    "我喜欢…",
    "有",
    "飞"
  ],
  "phraseSummary": [
    "我是…",
    "你是…",
    "我是谁？",
    "这是黑色。",
    "我喜欢蓝色。",
    "我们数到五吧！",
    "草地上有什么动物？",
    "草地上有一头蓝色的牛。"
  ],
  "estimatedDurationMinutes": 45,
  "mediaSummary": {
    "videos": 1,
    "songs": 2,
    "worksheets": 3,
    "other": 6
  },
  "readinessStatus": "ready"
}
```

## План и все шаги

## 1. Приветствие детей и героев курса

- ID: `block:l4-step-01-greeting`
- Тип: `intro_framing`
- Порядок: 1
- Материалы: нет

```json
{
  "title": "Урок 4. Мне нравятся цвета",
  "goal": "Включить детей в урок и подготовить к новым цветам через знакомый ритуал.",
  "teacherScriptShort": "Поприветствуйте детей и героев курса, напомните, что сегодня продолжаем тему цветов.",
  "timeboxMinutes": 2,
  "teacher": {
    "goal": "Создать спокойный старт и вернуть внимание к цветной теме.",
    "actions": [
      "Поприветствуйте группу и героев курса.",
      "Покажите, что урок будет про новые цвета и любимые цвета."
    ],
    "materials": [
      "герои курса"
    ]
  },
  "student": {
    "componentKey": "lesson_focus_v1",
    "instruction": "Поздоровайся с преподавателем и героями курса."
  }
}
```

## 2. Смотрим видео «colors»

- ID: `block:l4-step-02-video-colors`
- Тип: `video_segment`
- Порядок: 2
- Материалы: `video:colors`

```json
{
  "promptBeforeWatch": "Смотрим видео colors и вспоминаем знакомые цвета.",
  "focusPoints": [
    "红色",
    "绿色",
    "蓝色",
    "黄色",
    "橘色",
    "黑色",
    "白色",
    "棕色"
  ],
  "questionsAfterWatch": [
    "Какой цвет ты услышал?",
    "Покажи цвет, который запомнил."
  ],
  "teacher": {
    "goal": "Актуализировать старые цвета и подготовить ввод новых.",
    "actions": [
      "Включите видео colors.",
      "После просмотра попросите детей назвать любой услышанный цвет."
    ],
    "expectedResponses": [
      "红色",
      "绿色",
      "蓝色",
      "黄色"
    ],
    "materials": [
      "video:colors"
    ]
  },
  "student": {
    "componentKey": "media_asset_v1",
    "instruction": "Смотри, слушай и показывай цвета, которые узнаёшь."
  }
}
```

## 3. Фразы 我是… / 你是… / 我是谁？

- ID: `block:l4-step-03-ni-shi`
- Тип: `teacher_prompt_pattern`
- Порядок: 3
- Материалы: нет

```json
{
  "promptPatterns": [
    "我是…",
    "你是…",
    "我是谁？"
  ],
  "expectedStudentResponses": [
    "你是…",
    "我是…"
  ],
  "fallbackRu": "Сначала покажите на себя и героя курса, затем мягко помогите ребёнку ответить по модели.",
  "teacher": {
    "goal": "Повторить личные местоимения и фразы представления.",
    "actions": [
      "Смоделируйте «我是…» от лица преподавателя или героя.",
      "Указывая на ребёнка, произнесите «你是…» и попросите повторить.",
      "Спросите «我是谁？» и помогите ответить «你是…»."
    ],
    "expectedResponses": [
      "我是…",
      "你是…"
    ],
    "materials": [
      "герои курса"
    ]
  },
  "student": {
    "componentKey": "phrase_cards_v1",
    "instruction": "Повтори фразы и ответь преподавателю по образцу."
  }
}
```

## 4. Песня farm animals

- ID: `block:l4-step-04-farm-song`
- Тип: `song_segment`
- Порядок: 4
- Материалы: `song:farm-animals`, `song-video:farm-animals-movement`

```json
{
  "activityGoal": "Сохранить знакомый ритуал и активизировать лексику животных.",
  "teacherActions": [
    "Включите farm animals и пойте вместе с детьми."
  ],
  "repeatCount": 1,
  "movementHint": "Добавьте жесты животных и короткие повторы знакомых слов.",
  "teacher": {
    "goal": "Разогреть группу через знакомую песню.",
    "actions": [
      "Включите песню.",
      "Поддерживайте движения и подпевание."
    ],
    "materials": [
      "song:farm-animals",
      "song-video:farm-animals-movement"
    ]
  },
  "student": {
    "componentKey": "song_player_v1",
    "instruction": "Слушай, пой и показывай знакомых животных."
  }
}
```

## 5. Новые цвета: 橘色 / 黑色 / 白色 / 棕色

- ID: `block:l4-step-05-new-colors`
- Тип: `vocabulary_focus`
- Порядок: 5
- Материалы: `flashcards:world-around-me-lesson-4`

```json
{
  "items": [
    {
      "term": "橘色",
      "pinyin": "júsè",
      "meaning": "оранжевый"
    },
    {
      "term": "黑色",
      "pinyin": "hēisè",
      "meaning": "чёрный"
    },
    {
      "term": "白色",
      "pinyin": "báisè",
      "meaning": "белый"
    },
    {
      "term": "棕色",
      "pinyin": "zōngsè",
      "meaning": "коричневый"
    }
  ],
  "practiceMode": "cards_two_passes_then_phrase_model",
  "miniDrill": "Проход 1: называем цвет. Проход 2: говорим полной фразой «这是黑色。» и аналогично для других цветов.",
  "teacher": {
    "goal": "Ввести четыре новых цвета через карточки и модель 这是…",
    "actions": [
      "Покажите карточки 橘色、黑色、白色、棕色 по очереди.",
      "Первый проход: произносите только слово.",
      "Второй проход: проговаривайте «这是…»."
    ],
    "expectedResponses": [
      "橘色",
      "黑色",
      "白色",
      "棕色",
      "这是黑色。"
    ],
    "materials": [
      "карточки 橘色、黑色、白色、棕色"
    ]
  },
  "student": {
    "componentKey": "flashcards_v1",
    "instruction": "Смотри на карточки и повторяй новые цвета."
  }
}
```

## 6. Игра «Что пропало?»

- ID: `block:l4-step-06-missing-color`
- Тип: `guided_activity`
- Порядок: 6
- Материалы: `activity:lesson-4-missing-color`

```json
{
  "activityType": "missing_color_memory_game",
  "steps": [
    "Выложите карточки 橘色、黑色、白色、棕色 в ряд.",
    "Попросите детей закрыть глаза.",
    "Уберите одну карточку и попросите назвать, какой цвет пропал.",
    "Верните карточку и повторите раунд с другим цветом."
  ],
  "successCriteria": [
    "Ребёнок удерживает в памяти 4 новых цвета.",
    "Ребёнок называет пропавший цвет по-китайски."
  ],
  "timeboxMinutes": 4,
  "teacher": {
    "goal": "Закрепить новые цвета через память и быструю реакцию.",
    "actions": [
      "Запустите игру 4.6 на Student Screen.",
      "Спрячьте один цвет и попросите назвать, что пропало."
    ],
    "materials": [
      "Игра 4.6",
      "карточки 橘色、黑色、白色、棕色"
    ]
  },
  "student": {
    "componentKey": "missing_color_game_v1",
    "instruction": "Закрой глаза, затем назови цвет, который исчез.",
    "payload": {
      "colors": [
        {
          "id": "orange",
          "hanzi": "橘色",
          "pinyin": "júsè",
          "meaning": "оранжевый",
          "swatch": "#f47c24"
        },
        {
          "id": "black",
          "hanzi": "黑色",
          "pinyin": "hēisè",
          "meaning": "чёрный",
          "swatch": "#111111"
        },
        {
          "id": "white",
          "hanzi": "白色",
          "pinyin": "báisè",
          "meaning": "белый",
          "swatch": "#ffffff",
          "border": "#4f7fd9"
        },
        {
          "id": "brown",
          "hanzi": "棕色",
          "pinyin": "zōngsè",
          "meaning": "коричневый",
          "swatch": "#8a6500"
        }
      ]
    }
  }
}
```

## 7. Сортируем предметы по цветам

- ID: `block:l4-step-07-color-sorting`
- Тип: `guided_activity`
- Порядок: 7
- Материалы: `activity:lesson-4-color-sorting`

```json
{
  "activityType": "color_basket_sorting",
  "steps": [
    "Разложите разноцветные мячи или карточки предметов.",
    "Дети выбирают предмет и кладут его в коробку нужного цвета.",
    "Перед тем как положить предмет, ребёнок называет цвет вслух."
  ],
  "successCriteria": [
    "Ребёнок сортирует предмет по цвету.",
    "Ребёнок называет цвет перед действием."
  ],
  "timeboxMinutes": 4,
  "teacher": {
    "goal": "Перенести распознавание цвета в игровое действие.",
    "actions": [
      "Запустите игру 4.7.",
      "Попросите выбрать предмет, назвать цвет и поместить в правильную корзину."
    ],
    "expectedResponses": [
      "橘色",
      "黑色",
      "白色",
      "棕色"
    ],
    "materials": [
      "разноцветные мячи",
      "коробки для сортировки",
      "Игра 4.7"
    ]
  },
  "student": {
    "componentKey": "color_sorting_game_v1",
    "instruction": "Выбери предмет, назови его цвет и положи в правильную корзину.",
    "payload": {
      "baskets": [
        {
          "id": "orange",
          "hanzi": "橘色",
          "meaning": "оранжевый",
          "swatch": "#f47c24"
        },
        {
          "id": "black",
          "hanzi": "黑色",
          "meaning": "чёрный",
          "swatch": "#111111"
        },
        {
          "id": "white",
          "hanzi": "白色",
          "meaning": "белый",
          "swatch": "#ffffff",
          "border": "#4f7fd9"
        },
        {
          "id": "brown",
          "hanzi": "棕色",
          "meaning": "коричневый",
          "swatch": "#8a6500"
        }
      ],
      "items": [
        {
          "id": "jacket",
          "label": "кофта",
          "colorId": "brown"
        },
        {
          "id": "bread",
          "label": "хлеб",
          "colorId": "brown"
        },
        {
          "id": "carrot",
          "label": "морковь",
          "colorId": "orange"
        },
        {
          "id": "ball",
          "label": "мяч",
          "colorId": "orange"
        },
        {
          "id": "cat",
          "label": "кот",
          "colorId": "black"
        },
        {
          "id": "bat",
          "label": "летучая мышь",
          "colorId": "black"
        },
        {
          "id": "plane",
          "label": "самолёт",
          "colorId": "white"
        },
        {
          "id": "bird",
          "label": "птица",
          "colorId": "white"
        }
      ]
    }
  }
}
```

## 8. Конструкция 我喜欢…

- ID: `block:l4-step-08-wo-xihuan`
- Тип: `guided_activity`
- Порядок: 8
- Материалы: `media:lesson-4-heart`

```json
{
  "activityType": "favorite_color_heart",
  "steps": [
    "Покажите сердце из картона с клейкой лентой.",
    "Выберите цвет и прикрепите его на сердце.",
    "Смоделируйте фразу «我喜欢蓝色。».",
    "Дети по очереди выбирают цвет и повторяют фразу."
  ],
  "successCriteria": [
    "Ребёнок понимает модель 我喜欢…",
    "Ребёнок выбирает цвет и повторяет фразу с поддержкой."
  ],
  "timeboxMinutes": 4,
  "teacher": {
    "goal": "Ввести фразу о предпочтении через любимый цвет.",
    "actions": [
      "Покажите сердце.",
      "Дайте каждому ребёнку выбрать цвет.",
      "Повторите «我喜欢…»."
    ],
    "expectedResponses": [
      "我喜欢蓝色。",
      "我喜欢黑色。"
    ],
    "materials": [
      "сердце из картона",
      "карточки цветов"
    ]
  },
  "student": {
    "componentKey": "phrase_cards_v1",
    "instruction": "Выбери любимый цвет и скажи: 我喜欢…"
  }
}
```

## 9. Глагол 飞 и повтор действий

- ID: `block:l4-step-09-actions-fei`
- Тип: `teacher_prompt_pattern`
- Порядок: 9
- Материалы: `media:lesson-4-action-cards`

```json
{
  "promptPatterns": [
    "飞",
    "跑",
    "跳",
    "拍手",
    "数",
    "我们数到五吧！",
    "我们跳吧！"
  ],
  "expectedStudentResponses": [
    "Дети выполняют действие и повторяют слово или команду."
  ],
  "fallbackRu": "Сначала покажите действие сами, затем кликайте нужную карточку и подключайте детей.",
  "teacher": {
    "goal": "Ввести 飞 и повторить знакомые действия.",
    "actions": [
      "Покажите карточку 飞.",
      "Чередуйте 飞、跑、跳、拍手、数.",
      "Просите детей выполнять действие после команды."
    ],
    "materials": [
      "карточки действий"
    ]
  },
  "student": {
    "componentKey": "movement_cards_v1",
    "instruction": "Смотри на выбранную карточку и выполняй действие."
  }
}
```

## 10. Слово 草地

- ID: `block:l4-step-10-caodi-word`
- Тип: `vocabulary_focus`
- Порядок: 10
- Материалы: `media:lesson-4-grassland`

```json
{
  "items": [
    {
      "term": "草地",
      "pinyin": "cǎodì",
      "meaning": "луг / поле"
    }
  ],
  "practiceMode": "single_card_with_context",
  "miniDrill": "Покажите карточку 草地 и попросите детей повторить слово хором.",
  "teacher": {
    "goal": "Ввести слово 草地 как место для следующей сцены.",
    "actions": [
      "Покажите карточку луга.",
      "Произнесите 草地 несколько раз в разном темпе."
    ],
    "expectedResponses": [
      "草地"
    ],
    "materials": [
      "карточка 草地"
    ]
  },
  "student": {
    "componentKey": "flashcards_v1",
    "instruction": "Повтори слово 草地 и покажи луг."
  }
}
```

## 11. Луг и животные: 草地上有什么动物？

- ID: `block:l4-step-11-grassland-animals`
- Тип: `guided_activity`
- Порядок: 11
- Материалы: `worksheet:appendix-3-color-animals`, `media:lesson-4-grassland`

```json
{
  "activityType": "grassland_colored_animals_scene",
  "steps": [
    "Выложите луг из синей, зелёной и жёлтой ткани.",
    "Добавьте цветных животных из Приложения 3.",
    "Задайте вопрос «草地上有什么动物？».",
    "Смоделируйте ответ «草地上有一头蓝色的牛。»."
  ],
  "successCriteria": [
    "Ребёнок понимает вопрос о животных на лугу.",
    "Ребёнок повторяет фразу с 有 и цветом."
  ],
  "timeboxMinutes": 5,
  "teacher": {
    "goal": "Соединить 草地, 有, цвета и животных в одну сцену.",
    "actions": [
      "Соберите луг из ткани.",
      "Дайте ребёнку выбрать животное.",
      "Комментируйте фразуми с 有."
    ],
    "expectedResponses": [
      "草地上有一头蓝色的牛。",
      "草地上有黄色的猫。"
    ],
    "materials": [
      "синяя, зелёная и жёлтая ткани",
      "Приложение 3"
    ]
  },
  "student": {
    "componentKey": "phrase_cards_v1",
    "instruction": "Посмотри на луг и повтори, кто находится на нём."
  }
}
```

## 12. Приложение 4: домино цветов

- ID: `block:l4-step-12-color-domino`
- Тип: `guided_activity`
- Порядок: 12
- Материалы: `worksheet:appendix-4-color-domino`

```json
{
  "activityType": "color_domino_matching",
  "steps": [
    "Откройте Приложение 4.",
    "Справа расположены иероглифы цветов, слева цветовые карточки.",
    "Дети соединяют иероглиф с правильным цветом."
  ],
  "successCriteria": [
    "Ребёнок узнаёт иероглиф цвета.",
    "Ребёнок соединяет цвет и слово без лишней подсказки."
  ],
  "timeboxMinutes": 4,
  "teacher": {
    "goal": "Закрепить визуальное узнавание иероглифов цветов.",
    "actions": [
      "Покажите пары.",
      "Дайте детям по очереди выбрать соответствие."
    ],
    "materials": [
      "Приложение 4"
    ]
  },
  "student": {
    "componentKey": "matching_practice_v1",
    "instruction": "Найди пару: цвет и иероглиф."
  }
}
```

## 13. Разноцветные счёты: считаем до 5

- ID: `block:l4-step-13-abacus`
- Тип: `guided_activity`
- Порядок: 13
- Материалы: `media:lesson-4-abacus`

```json
{
  "activityType": "colored_abacus_counting",
  "steps": [
    "Покажите разноцветные счёты.",
    "Дети называют цвет ряда и считают бусины до 5.",
    "Проговаривайте коротко: 橘色，五个; 黑色，四个."
  ],
  "successCriteria": [
    "Ребёнок называет цвет.",
    "Ребёнок считает до 5 с опорой на предмет."
  ],
  "timeboxMinutes": 3,
  "teacher": {
    "goal": "Повторить счёт до 5 через новые цвета.",
    "actions": [
      "Показывайте ряд счётов.",
      "Попросите назвать цвет и посчитать бусины."
    ],
    "expectedResponses": [
      "一、二、三、四、五",
      "橘色"
    ],
    "materials": [
      "разноцветные счёты"
    ]
  },
  "student": {
    "componentKey": "count_board_v1",
    "instruction": "Выбери цветной ряд и посчитай бусины."
  }
}
```

## 14. Рабочая тетрадь: страницы 7–8

- ID: `block:l4-step-14-workbook-pages-7-8`
- Тип: `worksheet_task`
- Порядок: 14
- Материалы: `worksheet:workbook-pages-7-8`

```json
{
  "taskInstruction": "Слушай преподавателя, раскрашивай животных нужным цветом и называй цвет по-китайски.",
  "completionMode": "in_class",
  "answerKeyHint": "Проверяйте устно: ребёнок показывает животное и произносит цвет или фразу «这是黑色。».",
  "teacher": {
    "goal": "Закрепить цвета в спокойной тетрадной практике.",
    "actions": [
      "Откройте страницы 7–8.",
      "Называйте цвет, дети раскрашивают соответствующее животное."
    ],
    "materials": [
      "рабочая тетрадь",
      "карандаши"
    ]
  },
  "student": {
    "componentKey": "worksheet_v1",
    "instruction": "Раскрась животных нужным цветом и назови цвет."
  }
}
```

## 15. Песня my favorite color is blue

- ID: `block:l4-step-15-favorite-color-song`
- Тип: `song_segment`
- Порядок: 15
- Материалы: `song:my-favorite-color-is-blue`, `song-video:my-favorite-color-is-blue`

```json
{
  "activityGoal": "Закрепить тему любимого цвета и эмоционально закрыть активную часть урока.",
  "teacherActions": [
    "Включите my favorite color is blue и подпевайте с детьми."
  ],
  "repeatCount": 1,
  "movementHint": "Поднимайте карточку цвета, который звучит в песне.",
  "teacher": {
    "goal": "Повторить фразу про любимый цвет через песню.",
    "actions": [
      "Включите песню.",
      "Показывайте карточки цветов и приглашайте детей подпевать."
    ],
    "materials": [
      "song:my-favorite-color-is-blue",
      "song-video:my-favorite-color-is-blue"
    ]
  },
  "student": {
    "componentKey": "song_player_v1",
    "instruction": "Слушай песню и показывай любимый цвет."
  }
}
```

## 16. Прощание с детьми и героями курса

- ID: `block:l4-step-16-goodbye`
- Тип: `wrap_up_closure`
- Порядок: 16
- Материалы: нет

```json
{
  "recapPoints": [
    "橘色",
    "黑色",
    "白色",
    "棕色",
    "草地",
    "我喜欢…",
    "有",
    "飞"
  ],
  "exitCheck": "Перед прощанием каждый ребёнок называет один новый цвет и одну фразу «我喜欢…».",
  "teacherReflectionPrompt": "Попрощайтесь вместе с героями курса и отметьте детей за самостоятельный выбор цвета.",
  "teacher": {
    "goal": "Собрать короткий итог урока и завершить занятие.",
    "actions": [
      "Попросите каждого ребёнка назвать цвет.",
      "Попрощайтесь с героями курса."
    ],
    "expectedResponses": [
      "橘色",
      "我喜欢黑色。",
      "再见！"
    ],
    "materials": [
      "герои курса"
    ]
  },
  "student": {
    "componentKey": "lesson_focus_v1",
    "instruction": "Назови новый цвет, скажи любимый цвет и попрощайся."
  }
}
```

## 17. Материалы урока 4

- ID: `block:l4-materials`
- Тип: `materials_prep`
- Порядок: 17
- Материалы: `video:colors`, `flashcards:world-around-me-lesson-4`, `activity:lesson-4-missing-color`, `activity:lesson-4-color-sorting`, `media:lesson-4-heart`, `media:lesson-4-action-cards`, `media:lesson-4-grassland`, `worksheet:appendix-3-color-animals`, `worksheet:appendix-4-color-domino`, `media:lesson-4-abacus`, `worksheet:workbook-pages-7-8`, `song:my-favorite-color-is-blue`, `song-video:my-favorite-color-is-blue`

```json
{
  "materialsChecklist": [
    "герои курса",
    "видео colors",
    "карточки 橘色、黑色、白色、棕色",
    "разноцветные мячи",
    "8 коробок для сортировки",
    "сердце из картона с клейкой лентой",
    "карточки действий 飞、跑、跳、拍手、数",
    "карточка 草地",
    "синяя, зелёная и жёлтая ткани",
    "Приложение 3",
    "Приложение 4",
    "разноцветные счёты",
    "рабочая тетрадь, стр. 7–8"
  ],
  "roomSetupNotes": "Подготовьте активную зону для сортировки и отдельный стол для карточек, домино и тетради."
}
```

## Экран ученика

```json
{
  "id": "methodology-student-content:world-around-me-04",
  "methodologyLessonId": "methodology-lesson:world-around-me-04",
  "title": "Урок 4. Мне нравятся цвета",
  "subtitle": "Новые цвета, любимый цвет, луг, действия и счёт в игровых шагах.",
  "sections": [
    {
      "type": "lesson_focus",
      "title": "Приветствие детей и героев курса",
      "subtitle": "Начинаем цветное занятие вместе с героями.",
      "body": "Поздоровайся, посмотри на героев курса и приготовься изучать новые цвета.",
      "chips": [
        "你好",
        "цвета",
        "герои курса"
      ],
      "tone": "sky",
      "layout": "hero",
      "illustrationSrc": "/methodologies/world-around-me/lesson-3/color-world.svg",
      "sceneId": "l4-step-01"
    },
    {
      "type": "media_asset",
      "title": "Смотрим видео «colors»",
      "subtitle": "Слушаем и вспоминаем цвета.",
      "tone": "sky",
      "layout": "practice",
      "sceneId": "l4-step-02",
      "assetId": "video:colors",
      "assetKind": "video",
      "studentPrompt": "Смотри видео и показывай цвета, которые уже знаешь.",
      "ctaLabel": "Открыть видео colors"
    },
    {
      "type": "phrase_cards",
      "title": "Фразы 我是… / 你是… / 我是谁？",
      "subtitle": "Повтори фразы и ответь преподавателю.",
      "tone": "violet",
      "layout": "phrases",
      "sceneId": "l4-step-03",
      "items": [
        {
          "phrase": "我是…",
          "pinyin": "wǒ shì…",
          "meaning": "я…",
          "usageHint": "Скажи о себе."
        },
        {
          "phrase": "你是…",
          "pinyin": "nǐ shì…",
          "meaning": "ты…",
          "usageHint": "Скажи о друге или преподавателе."
        },
        {
          "phrase": "我是谁？",
          "pinyin": "wǒ shì shéi?",
          "meaning": "кто я?",
          "usageHint": "Спроси и послушай ответ."
        }
      ]
    },
    {
      "type": "media_asset",
      "title": "Песня farm animals",
      "subtitle": "Поём знакомую песню и вспоминаем животных.",
      "tone": "rose",
      "layout": "practice",
      "sceneId": "l4-step-04",
      "assetId": "song:farm-animals",
      "assetKind": "song",
      "studentPrompt": "Слушай, пой и показывай животных движениями.",
      "ctaLabel": "Открыть песню"
    },
    {
      "type": "vocabulary_cards",
      "title": "Новые цвета: 橘色 / 黑色 / 白色 / 棕色",
      "subtitle": "Слушай преподавателя и повторяй каждый цвет.",
      "tone": "amber",
      "layout": "vocabulary",
      "sceneId": "l4-step-05",
      "displayMode": "grid",
      "items": [
        {
          "term": "橘色",
          "pinyin": "júsè",
          "meaning": "оранжевый",
          "visualHint": "Покажи оранжевый цвет."
        },
        {
          "term": "黑色",
          "pinyin": "hēisè",
          "meaning": "чёрный",
          "visualHint": "Найди что-то чёрное."
        },
        {
          "term": "白色",
          "pinyin": "báisè",
          "meaning": "белый",
          "visualHint": "Покажи белую карточку."
        },
        {
          "term": "棕色",
          "pinyin": "zōngsè",
          "meaning": "коричневый",
          "visualHint": "Назови коричневый предмет."
        }
      ]
    },
    {
      "type": "lesson_focus",
      "title": "Игра «Что пропало?»",
      "subtitle": "Запоминаем 4 цвета и угадываем исчезнувший.",
      "body": "Смотри на цвета, закрывай глаза по команде преподавателя и называй цвет, который исчез.",
      "chips": [
        "橘色",
        "黑色",
        "白色",
        "棕色"
      ],
      "tone": "amber",
      "layout": "practice",
      "sceneId": "l4-step-06"
    },
    {
      "type": "lesson_focus",
      "title": "Сортируем предметы по цветам",
      "subtitle": "Кликаем предмет и кладём его в правильную корзину.",
      "body": "Выбери предмет, назови его цвет и положи в корзину такого же цвета.",
      "chips": [
        "сортировка",
        "цвет",
        "корзина"
      ],
      "tone": "emerald",
      "layout": "practice",
      "sceneId": "l4-step-07"
    },
    {
      "type": "phrase_cards",
      "title": "Конструкция 我喜欢…",
      "subtitle": "Выбираем любимый цвет.",
      "tone": "rose",
      "layout": "phrases",
      "illustrationSrc": "/methodologies/world-around-me/lesson-4/heart-color.svg",
      "sceneId": "l4-step-08",
      "items": [
        {
          "phrase": "我喜欢…",
          "pinyin": "wǒ xǐhuan…",
          "meaning": "мне нравится…",
          "usageHint": "Поставь после фразы цвет.",
          "example": "我喜欢蓝色。"
        },
        {
          "phrase": "我喜欢黑色。",
          "pinyin": "wǒ xǐhuan hēisè.",
          "meaning": "мне нравится чёрный цвет",
          "usageHint": "Скажи, если выбрал чёрный."
        },
        {
          "phrase": "我喜欢橘色。",
          "pinyin": "wǒ xǐhuan júsè.",
          "meaning": "мне нравится оранжевый цвет",
          "usageHint": "Скажи, если выбрал оранжевый."
        }
      ]
    },
    {
      "type": "action_cards",
      "title": "Глагол 飞 и повтор действий",
      "subtitle": "Смотри на карточку и выполняй действие.",
      "tone": "emerald",
      "layout": "movement",
      "illustrationSrc": "/methodologies/world-around-me/lesson-4/action-cards.svg",
      "sceneId": "l4-step-09",
      "displayMode": "slider",
      "items": [
        {
          "term": "飞",
          "pinyin": "fēi",
          "meaning": "летать",
          "movementHint": "Покажи, как летишь."
        },
        {
          "term": "跑",
          "pinyin": "pǎo",
          "meaning": "бежать",
          "movementHint": "Беги на месте.",
          "commandExample": "我们跑吧！"
        },
        {
          "term": "跳",
          "pinyin": "tiào",
          "meaning": "прыгать",
          "movementHint": "Прыгни по команде.",
          "commandExample": "我们跳吧！"
        },
        {
          "term": "拍手",
          "pinyin": "pāishǒu",
          "meaning": "хлопать",
          "movementHint": "Хлопай в ладоши."
        },
        {
          "term": "数",
          "pinyin": "shǔ",
          "meaning": "считать",
          "movementHint": "Считай вместе до пяти.",
          "commandExample": "我们数到五吧！"
        }
      ]
    },
    {
      "type": "word_list",
      "title": "Слово 草地",
      "subtitle": "Готовимся к сцене на лугу.",
      "tone": "amber",
      "layout": "recap",
      "illustrationSrc": "/methodologies/world-around-me/lesson-4/grassland.svg",
      "sceneId": "l4-step-10",
      "groups": [
        {
          "id": "grassland",
          "title": "Новое слово",
          "entries": [
            {
              "hanzi": "草地",
              "pinyin": "cǎodì",
              "meaning": "луг / поле"
            }
          ]
        }
      ]
    },
    {
      "type": "phrase_cards",
      "title": "Луг и животные: 草地上有什么动物？",
      "subtitle": "Смотрим на луг и говорим, кто на нём есть.",
      "tone": "sky",
      "layout": "farm",
      "illustrationSrc": "/methodologies/world-around-me/lesson-4/grassland.svg",
      "sceneId": "l4-step-11",
      "items": [
        {
          "phrase": "草地上有什么动物？",
          "pinyin": "cǎodì shàng yǒu shénme dòngwù?",
          "meaning": "какие животные на лугу?",
          "usageHint": "Посмотри на луг и ответь."
        },
        {
          "phrase": "草地上有一头蓝色的牛。",
          "pinyin": "cǎodì shàng yǒu yì tóu lánsè de niú.",
          "meaning": "на лугу одна синяя корова",
          "usageHint": "Повтори длинную фразу частями."
        },
        {
          "phrase": "草地上有黄色的猫。",
          "pinyin": "cǎodì shàng yǒu huángsè de māo.",
          "meaning": "на лугу жёлтая кошка",
          "usageHint": "Скажи про другое животное."
        }
      ]
    },
    {
      "type": "matching_practice",
      "title": "Приложение 4: домино цветов",
      "subtitle": "Найди пару цвета и иероглифа.",
      "tone": "violet",
      "layout": "homework",
      "sceneId": "l4-step-12",
      "prompt": "Соедини цветовую карточку и правильный иероглиф.",
      "pairs": [
        {
          "id": "orange",
          "label": "橘色"
        },
        {
          "id": "black",
          "label": "黑色"
        },
        {
          "id": "white",
          "label": "白色"
        },
        {
          "id": "brown",
          "label": "棕色"
        }
      ]
    },
    {
      "type": "count_board",
      "title": "Разноцветные счёты: считаем до 5",
      "subtitle": "Выбери цветной ряд и посчитай.",
      "tone": "sky",
      "layout": "counting",
      "illustrationSrc": "/methodologies/world-around-me/lesson-4/abacus.svg",
      "sceneId": "l4-step-13",
      "prompt": "Назови цвет ряда и посчитай бусины вместе с преподавателем.",
      "assetId": "media:lesson-4-abacus",
      "groups": [
        {
          "id": "orange",
          "label": "橘色 · 5",
          "count": 5,
          "cue": "橘色：一、二、三、四、五"
        },
        {
          "id": "black",
          "label": "黑色 · 4",
          "count": 4,
          "cue": "黑色：一、二、三、四"
        },
        {
          "id": "white",
          "label": "白色 · 3",
          "count": 3,
          "cue": "白色：一、二、三"
        },
        {
          "id": "brown",
          "label": "棕色 · 2",
          "count": 2,
          "cue": "棕色：一、二"
        }
      ]
    },
    {
      "type": "worksheet",
      "title": "Рабочая тетрадь: страницы 7–8",
      "subtitle": "Раскрашиваем животных нужным цветом.",
      "tone": "rose",
      "layout": "practice",
      "sceneId": "l4-step-14",
      "pageLabel": "Рабочая тетрадь · стр. 7–8",
      "instructions": "Слушай цвет от преподавателя, раскрась животное и назови цвет по-китайски.",
      "teacherHint": "Проверяйте устно: цвет или короткая фраза «这是黑色。».",
      "assetId": "worksheet:workbook-pages-7-8"
    },
    {
      "type": "media_asset",
      "title": "Песня my favorite color is blue",
      "subtitle": "Финальный музыкальный повтор.",
      "tone": "rose",
      "layout": "practice",
      "sceneId": "l4-step-15",
      "assetId": "song:my-favorite-color-is-blue",
      "assetKind": "song",
      "studentPrompt": "Слушай песню, подпевай и показывай любимый цвет.",
      "ctaLabel": "Открыть песню"
    },
    {
      "type": "recap",
      "title": "Прощание с детьми и героями курса",
      "subtitle": "Повторяем главное и завершаем урок.",
      "tone": "neutral",
      "layout": "recap",
      "sceneId": "l4-step-16",
      "bullets": [
        "Назови новые цвета: 橘色, 黑色, 白色, 棕色.",
        "Скажи любимый цвет: 我喜欢…",
        "Повтори слово 草地.",
        "Покажи действие 飞.",
        "Попрощайся с героями курса."
      ]
    }
  ]
}
```

## Домашнее задание

```json
{
  "id": "methodology-homework:world-around-me-04",
  "methodologyLessonId": "methodology-lesson:world-around-me-04",
  "title": "Мини-миссия: Любимые цвета и луг",
  "kind": "quiz_single_choice",
  "instructions": "Повтори новые цвета, фразу «я люблю…», слово 草地 и глагол 飞. Затем выбери правильный ответ в каждом вопросе.",
  "materialLinks": [
    "Рабочая тетрадь, стр. 7–8",
    "Карточки 橘色/黑色/白色/棕色"
  ],
  "answerFormatHint": "6 коротких вопросов, по одному ответу.",
  "estimatedMinutes": 7,
  "quiz": {
    "id": "world-around-me-lesson-4-quiz",
    "version": 1,
    "title": "Домашняя мини-миссия: Любимые цвета",
    "subtitle": "Вспомни новые цвета, 草地 и короткие фразы урока.",
    "introText": "Выбери правильный ответ и помоги героям собрать цветной луг.",
    "completionTitle": "Цветная миссия выполнена!",
    "completionText": "Ты повторил(а) новые цвета, фразы и действия урока 4.",
    "tone": "amber",
    "practiceSections": [
      {
        "id": "audio-review-l4",
        "type": "audio_review",
        "title": "Слова урока 4",
        "groups": [
          {
            "id": "colors",
            "title": "Новые цвета",
            "entries": [
              {
                "id": "orange",
                "hanzi": "橘色",
                "pinyin": "júsè",
                "meaning": "оранжевый"
              },
              {
                "id": "black",
                "hanzi": "黑色",
                "pinyin": "hēisè",
                "meaning": "чёрный"
              },
              {
                "id": "white",
                "hanzi": "白色",
                "pinyin": "báisè",
                "meaning": "белый"
              },
              {
                "id": "brown",
                "hanzi": "棕色",
                "pinyin": "zōngsè",
                "meaning": "коричневый"
              }
            ]
          },
          {
            "id": "phrases",
            "title": "Фразы и действия",
            "entries": [
              {
                "id": "grassland",
                "hanzi": "草地",
                "pinyin": "cǎodì",
                "meaning": "луг / поле"
              },
              {
                "id": "like",
                "hanzi": "我喜欢…",
                "pinyin": "wǒ xǐhuan…",
                "meaning": "мне нравится…"
              },
              {
                "id": "have",
                "hanzi": "有",
                "pinyin": "yǒu",
                "meaning": "иметь / есть"
              },
              {
                "id": "fly",
                "hanzi": "飞",
                "pinyin": "fēi",
                "meaning": "летать"
              }
            ]
          }
        ]
      }
    ],
    "questions": [
      {
        "id": "q1",
        "prompt": "Как по-китайски «оранжевый»?",
        "options": [
          {
            "id": "a",
            "label": "橘色"
          },
          {
            "id": "b",
            "label": "黑色"
          },
          {
            "id": "c",
            "label": "白色"
          }
        ],
        "correctOptionId": "a"
      },
      {
        "id": "q2",
        "prompt": "Что значит 黑色?",
        "options": [
          {
            "id": "a",
            "label": "белый"
          },
          {
            "id": "b",
            "label": "чёрный"
          },
          {
            "id": "c",
            "label": "коричневый"
          }
        ],
        "correctOptionId": "b"
      },
      {
        "id": "q3",
        "prompt": "Выбери фразу «Мне нравится синий цвет».",
        "options": [
          {
            "id": "a",
            "label": "我喜欢蓝色。"
          },
          {
            "id": "b",
            "label": "你是蓝色。"
          },
          {
            "id": "c",
            "label": "这是喜欢。"
          }
        ],
        "correctOptionId": "a"
      },
      {
        "id": "q4",
        "prompt": "Какое слово значит «луг / поле»?",
        "options": [
          {
            "id": "a",
            "label": "草地"
          },
          {
            "id": "b",
            "label": "棕色"
          },
          {
            "id": "c",
            "label": "飞"
          }
        ],
        "correctOptionId": "a"
      },
      {
        "id": "q5",
        "prompt": "Что значит 飞?",
        "options": [
          {
            "id": "a",
            "label": "считать"
          },
          {
            "id": "b",
            "label": "летать"
          },
          {
            "id": "c",
            "label": "хлопать"
          }
        ],
        "correctOptionId": "b"
      },
      {
        "id": "q6",
        "prompt": "Выбери правильную фразу про луг.",
        "helperText": "На лугу есть одна синяя корова.",
        "options": [
          {
            "id": "a",
            "label": "草地上有一头蓝色的牛。"
          },
          {
            "id": "b",
            "label": "草地喜欢黑色。"
          },
          {
            "id": "c",
            "label": "牛飞五次。"
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
    "id": "song:farm-animals",
    "kind": "song_audio",
    "title": "farm animals",
    "description": "Песня для завершения уроков про животных.",
    "sourceUrl": "https://drive.google.com/file/d/1RewHJRdd6oqSfX506A7ABt6VMDhDzJRP/view?usp=drive_link",
    "fileRef": "/methodologies/world-around-me/lesson-1/media/farm-animals-song.mp3"
  },
  {
    "id": "song-video:farm-animals-movement",
    "kind": "song_video",
    "title": "farm animals (movement version)",
    "sourceUrl": "https://drive.google.com/file/d/1RdZLmZHFnxflYuYkSNvhclrfYuNxAnSC/view?usp=drive_link",
    "fileRef": "/methodologies/world-around-me/lesson-1/media/farm-animals-song-video.mp4"
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
    "id": "flashcards:world-around-me-lesson-4",
    "kind": "flashcards_pdf",
    "title": "Карточки урока 4: новые цвета",
    "description": "Карточки 橘色、黑色、白色、棕色 и дополнительные слова урока.",
    "fileRef": "/methodologies/world-around-me/lesson-4/color-cards.svg",
    "metadata": {
      "cardImageRefs": [
        "/methodologies/world-around-me/lesson-4/color-card-orange.svg",
        "/methodologies/world-around-me/lesson-4/color-card-black.svg",
        "/methodologies/world-around-me/lesson-4/color-card-white.svg",
        "/methodologies/world-around-me/lesson-4/color-card-brown.svg"
      ]
    }
  },
  {
    "id": "activity:lesson-4-missing-color",
    "kind": "activity_template",
    "title": "Игра 4.6: Что пропало?",
    "description": "PPTX-материал с карточками цветов для игры на внимание.",
    "fileRef": "/methodologies/world-around-me/lesson-4/games/lesson-4-game-4-6.pptx"
  },
  {
    "id": "activity:lesson-4-color-sorting",
    "kind": "activity_template",
    "title": "Игра 4.7: Сортировка по цветам",
    "description": "PPTX-материал с корзинами и предметами для сортировки.",
    "fileRef": "/methodologies/world-around-me/lesson-4/games/lesson-4-game-4-7.pptx"
  },
  {
    "id": "worksheet:appendix-3-color-animals",
    "kind": "worksheet",
    "title": "Приложение 3: цветные животные на лугу",
    "description": "Материал для выкладывания луга и фраз «草地上有…».",
    "fileRef": "/methodologies/world-around-me/lesson-4/color-animals-grassland.svg",
    "metadata": {
      "previewImageRef": "/methodologies/world-around-me/lesson-4/color-animals-grassland.svg"
    }
  },
  {
    "id": "worksheet:appendix-4-color-domino",
    "kind": "worksheet",
    "title": "Приложение 4: домино цветов",
    "description": "Найди пару: иероглиф цвета и соответствующая цветовая карточка.",
    "fileRef": "/methodologies/world-around-me/lesson-4/color-domino.svg",
    "metadata": {
      "previewImageRef": "/methodologies/world-around-me/lesson-4/color-domino.svg"
    }
  },
  {
    "id": "worksheet:workbook-pages-7-8",
    "kind": "worksheet",
    "title": "Рабочая тетрадь, стр. 7–8",
    "description": "Раскрась животных нужным цветом и назови цвет по-китайски.",
    "fileRef": "/methodologies/world-around-me/lesson-4/workbook-pages-7-8.svg",
    "metadata": {
      "previewImageRef": "/methodologies/world-around-me/lesson-4/workbook-pages-7-8.svg"
    }
  },
  {
    "id": "media:lesson-4-heart",
    "kind": "media_file",
    "title": "Сердце для фразы 我喜欢…",
    "description": "Шаблон для выбора любимого цвета.",
    "fileRef": "/methodologies/world-around-me/lesson-4/heart-color.svg"
  },
  {
    "id": "media:lesson-4-grassland",
    "kind": "media_file",
    "title": "Карточка 草地",
    "description": "Визуальная опора для слова 草地.",
    "fileRef": "/methodologies/world-around-me/lesson-4/grassland.svg"
  },
  {
    "id": "media:lesson-4-abacus",
    "kind": "media_file",
    "title": "Разноцветные счёты",
    "description": "Опора для счёта до 5 по цветам.",
    "fileRef": "/methodologies/world-around-me/lesson-4/abacus.svg"
  },
  {
    "id": "media:lesson-4-action-cards",
    "kind": "media_file",
    "title": "Карточки действий урока 4",
    "description": "飞、跑、跳、拍手、数 для командной игры.",
    "fileRef": "/methodologies/world-around-me/lesson-4/action-cards.svg"
  }
]
```
