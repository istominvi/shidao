import type {
  LessonBlockInstance,
  MethodologyLessonHomeworkDefinition,
  MethodologyLessonStudentContent,
  Methodology,
  MethodologyLesson,
  ReusableAsset,
  ScheduledLesson,
} from "./contracts";

export const lessonContentFixtureMethodology: Methodology = {
  id: "methodology:world-around-me",
  slug: "world-around-me",
  title: "Мир вокруг меня – 我周围的世界",
  shortDescription:
    "Китайский для детей 5–6 лет, 45-минутные занятия с песнями, видео и активной игровой практикой.",
  metadata: {
    locale: "zh-CN",
    level: "Beginner · Pre-A1",
    titleRu: "Мир вокруг меня",
    titleNative: "我周围的世界",
    coverImage: {
      src: "/methodologies/01.png",
      alt: "Обложка методики «Мир вокруг меня»",
    },
    audienceLabel: "Дошкольники 5–6 лет, старт в китайском языке",
    targetAgeLabel: "5–6 лет",
    lessonDurationLabel: "45 минут",
    courseDurationLabel: "1 учебный год · сентябрь–июнь",
    courseScopeLabel: "38 учебных часов / 38 недель",
    approximateVocabularyCount: 180,
    songCount: 21,
    videoCount: 21,
    idealGroupSizeLabel: "4–6 детей",
    maxGroupSize: 8,
    activitiesPerLessonLabel: "Обычно 14–16 активностей (оптимум — 15)",
    lessonFormatSummary:
      "Каждый урок начинается и завершается песней, а этапы чередуют активные игры, движение, видео и более спокойные задания.",
    teachingApproachSummary:
      "Активное игровое обучение в малой группе: коммуникативные паттерны, движение, песни и наглядные материалы.",
    learningOutcomes: [
      "Понимать инструкции преподавателя и простое тематическое содержание на слух.",
      "Отвечать короткими моделями и участвовать в простых диалогах по образцу.",
      "Осваивать лексику из детских повседневных тем и использовать её в мини-ситуациях.",
      "Запоминать песни и речевые фрагменты как опору для говорения.",
    ],
    thematicModules: [
      "Животные фермы, цвета и природа.",
      "Дом и окружение ребёнка.",
      "Части тела, фрукты и овощи.",
      "Еда, напитки, игрушки и праздники.",
      "Одежда, день рождения, транспорт и погода.",
      "Джунгли, сафари, лес, море, музыка, профессии, город и школьные принадлежности.",
    ],
    methodologyNotes: [
      "Перед началом новой группы проверьте пищевые аллергии: в ряде планов используются продукты.",
      "Уроки требуют предварительной подготовки карточек, реквизита и материалов.",
      "Методика рассчитана на малую группу; при 7–8 детях нужны парные и ротационные форматы.",
      "Пассивное накопление словаря — важная часть методики наравне с активной практикой.",
    ],
    materialsEcosystemSummary:
      "План урока включает слова и фразы, карточки, реквизит/материалы, подробные активности, вопросы преподавателя и ожидаемые ответы детей.",
    programLessonCount: 38,
  },
};

export const lessonContentFixtureAssets: ReusableAsset[] = [
  {
    id: "video:farm-animals",
    kind: "video",
    title: "farm animals",
    description: "Видео-сегмент урока 1: farm animals.",
  },
  {
    id: "song:farm-animals",
    kind: "song",
    title: "farm animals",
    description: "Песня для завершения урока 1.",
  },
  {
    id: "worksheet:workbook-pages-3-4",
    kind: "worksheet",
    title: "Рабочая тетрадь, стр. 3–4",
    description: "Задание на раскрашивание животных и вопрос «这是什么？».",
  },
  {
    id: "worksheet:appendix-1",
    kind: "worksheet",
    title: "Приложение 1",
    description: "Материал для указки: показать, посчитать, назвать животных.",
  },
];

export const lessonContentFixtureBlocks: LessonBlockInstance[] = [
  {
    id: "block:intro-lesson-1",
    blockType: "intro_framing",
    order: 1,
    title: "Welcome and theme launch",
    assetRefs: [],
    content: {
      title: "Урок 1. Животные на ферме",
      goal: "Познакомить детей со словами 狗, 猫, 兔子, 马, 农场 и базовыми фразами урока.",
      teacherScriptShort:
        "Приветствуем детей и героев курса, задаём тему фермы и правила смены активностей.",
      warmupQuestion: "Кто сегодня хочет быть 狗 или 猫?",
      timeboxMinutes: 3,
    },
  },
  {
    id: "block:materials-lesson-1",
    blockType: "materials_prep",
    order: 2,
    title: "Материалы и реквизит урока",
    assetRefs: [{ kind: "worksheet", id: "worksheet:appendix-1" }],
    content: {
      materialsChecklist: [
        "герои курса",
        "карточки 狗, 猫, 兔子, 马",
        "карточка 农场",
        "малярный скотч",
        "мяч",
        "палочки для счета",
        "приложение 1",
        "указка",
        "мягкие игрушки: собака, кот, кролик, лошадь",
        "рабочая тетрадь",
        "игрушечная ферма",
      ],
      roomSetupNotes:
        "Подготовить свободное пространство для движения, отметить безопасные зоны скотчем и заранее разложить мягкие игрушки.",
    },
  },
  {
    id: "block:video-farm-animals",
    blockType: "video_segment",
    order: 3,
    title: "Video warm-up: farm animals",
    assetRefs: [{ kind: "video", id: "video:farm-animals" }],
    content: {
      promptBeforeWatch: "Смотрим видео farm animals и слушаем названия животных.",
      focusPoints: ["狗", "猫", "兔子", "马"],
      questionsAfterWatch: ["Каких животных дети запомнили?"],
    },
  },
  {
    id: "block:vocabulary-lesson-1",
    blockType: "vocabulary_focus",
    order: 4,
    title: "Vocabulary reveal: 狗 / 猫 / 兔子 / 马",
    assetRefs: [],
    content: {
      items: [
        { term: "狗", pinyin: "gǒu", meaning: "собака" },
        { term: "猫", pinyin: "māo", meaning: "кот / кошка" },
        { term: "兔子", pinyin: "tùzi", meaning: "кролик" },
        { term: "马", pinyin: "mǎ", meaning: "лошадь" },
        { term: "农场", pinyin: "nóngchǎng", meaning: "ферма" },
        { term: "我是…", pinyin: "wǒ shì…", meaning: "Я…" },
        { term: "这是…", pinyin: "zhè shì…", meaning: "Это…" },
        { term: "跑", pinyin: "pǎo", meaning: "бежать" },
        { term: "跳", pinyin: "tiào", meaning: "прыгать" },
        { term: "我们…吧！", pinyin: "wǒmen…ba!", meaning: "Давайте…!" },
        { term: "在", pinyin: "zài", meaning: "в / находиться в" },
      ],
      practiceMode: "cards_two_passes_then_actions",
      miniDrill: "Первый проход: только слово. Второй проход: паттерн 这是… с карточкой.",
    },
  },
  {
    id: "block:prompt-self-intro",
    blockType: "teacher_prompt_pattern",
    order: 5,
    title: "Circle talk: 我是…",
    assetRefs: [],
    content: {
      promptPatterns: ["你是谁？", "我是…", "这是狗", "这是猫", "这是兔子", "这是马"],
      expectedStudentResponses: ["我是…", "这是…"],
      fallbackRu: "Поддержать полный ответ в модели «我是…» и «这是…».",
    },
  },
  {
    id: "block:activity-imitation",
    blockType: "guided_activity",
    order: 6,
    title: "Animal imitation game",
    assetRefs: [],
    content: {
      activityType: "movement_imitation",
      steps: [
        "Дети встают и по карточкам имитируют животных (лают, как собака, и т.д.).",
        "Преподаватель сопровождает действия комментарием «我是狗» и другими вариантами с карточками.",
      ],
      successCriteria: [
        "Дети связывают карточку с действием животного.",
        "Дети повторяют модель «我是…» во время движения.",
      ],
      timeboxMinutes: 3,
      differentiationNotes: "Для стеснительных детей — парное повторение с преподавателем; для активных — роль лидера показа.",
    },
  },
  {
    id: "block:activity-wall-ball",
    blockType: "guided_activity",
    order: 7,
    title: "Wall cards + ball target game",
    assetRefs: [],
    content: {
      activityType: "target_throw_and_name",
      steps: [
        "Закрепить карточки 狗, 猫, 兔子, 马 на стене с помощью скотча.",
        "Преподаватель называет животное, ребёнок бросает мяч в нужную карточку.",
        "После броска ребёнок проговаривает, что изображено на карточке.",
      ],
      successCriteria: [
        "Ребёнок выбирает правильную карточку по слову преподавателя.",
        "Ребёнок произносит название или фразу «这是…» после броска.",
      ],
      timeboxMinutes: 4,
    },
  },
  {
    id: "block:activity-counting",
    blockType: "guided_activity",
    order: 8,
    title: "Count to five with sticks",
    assetRefs: [{ kind: "worksheet", id: "worksheet:appendix-1" }],
    content: {
      activityType: "count_and_point",
      steps: [
        "Сесть, показать счёт палочками до 5, затем раздать палочки детям и считать вместе.",
        "Открыть Приложение 1, использовать указку: дети показывают, считают и называют животных хором.",
      ],
      successCriteria: [
        "Дети считают до 5 вместе с преподавателем.",
        "Дети указывают и называют животных по материалу приложения.",
      ],
      timeboxMinutes: 3,
    },
  },
  {
    id: "block:prompt-movement",
    blockType: "teacher_prompt_pattern",
    order: 9,
    title: "Movement commands: 跑 / 跳",
    assetRefs: [],
    content: {
      promptPatterns: [
        "我们跑吧！",
        "我们跳吧！",
        "跑到狗！",
        "跳到兔子！",
        "跑到马！",
        "跳到猫！",
        "狗在做什么？",
        "这是什么？",
      ],
      expectedStudentResponses: ["狗在跳", "这是…"],
    },
  },
  {
    id: "block:activity-movement-toys",
    blockType: "guided_activity",
    order: 10,
    title: "Plush-animal movement mission",
    assetRefs: [],
    content: {
      activityType: "movement_commands_with_toys",
      steps: [
        "Ввести глаголы 跑 и 跳 в командах «我们跑吧！» и «我们跳吧！».",
        "Разместить мягкие игрушки по классу, давать команды «跑到狗！», «跳到兔子！», «跑到马！», «跳到猫！».",
        "Повторно использовать игрушки для вопросов «狗在做什么？» и комментариев вида «狗在跳».",
      ],
      successCriteria: [
        "Дети различают команды с 跑 и 跳.",
        "Дети дают короткий ответ или комментарий о действии животного.",
      ],
      timeboxMinutes: 4,
      differentiationNotes: "Энергичным детям поручить демонстрацию команд, пассивных включать через выбор игрушки.",
    },
  },
  {
    id: "block:worksheet-workbook",
    blockType: "worksheet_task",
    order: 11,
    title: "Workbook pages 3–4",
    assetRefs: [{ kind: "worksheet", id: "worksheet:workbook-pages-3-4" }],
    content: {
      taskInstruction:
        "Выполнить страницы 3–4: раскрасить животных, затем назвать картинки по вопросу «这是什么？».",
      completionMode: "in_class",
      answerKeyHint: "Проверка устно в группе после выполнения.",
      homeExtension: "Дома попросите ребёнка показать страницу и назвать минимум одно животное.",
    },
  },
  {
    id: "block:activity-toy-farm",
    blockType: "guided_activity",
    order: 12,
    title: "农场 and toy farm scene",
    assetRefs: [],
    content: {
      activityType: "toy_farm_language_reinforcement",
      steps: [
        "Ввести слово 农场 с карточкой.",
        "На игрушечной ферме закрепить слова 农场, 狗, 猫, 兔子, 马.",
        "Отработать паттерн 在…里 на примере «猫住在农场里».",
      ],
      successCriteria: [
        "Дети узнают и проговаривают слово 农场.",
        "Дети повторяют модель 在…里 на примере фермы.",
      ],
      timeboxMinutes: 4,
    },
  },
  {
    id: "block:song-closing",
    blockType: "song_segment",
    order: 13,
    title: "Song and goodbye recap",
    assetRefs: [{ kind: "song", id: "song:farm-animals" }],
    content: {
      activityGoal: "Закрепить лексику животных в конце урока.",
      teacherActions: [
        "Включить песню farm animals и пропеть вместе с детьми.",
        "Поддерживать движения и указания на знакомых животных.",
        "Сделать мягкий переход к прощанию и спокойному завершению.",
      ],
      repeatCount: 1,
      movementHint: "Контролируйте темп и расстояние между детьми во время финального движения.",
    },
  },
  {
    id: "block:wrap-goodbye",
    blockType: "wrap_up_closure",
    order: 14,
    title: "Прощание",
    assetRefs: [],
    content: {
      recapPoints: ["狗", "猫", "兔子", "马", "农场", "我是…", "这是…", "跑", "跳", "在…里"],
      exitCheck: "Ребёнок называет минимум одно животное фермы и показывает одно действие (跑/跳).",
      previewNextLesson: "На следующем уроке продолжаем тему животных и добавляем новые контексты.",
      teacherReflectionPrompt: "Transition cue: после движения предложите глоток воды и сигнал «садимся в круг». Отметьте, кто требовал дополнительного вовлечения.",
    },
  },
];

export const lessonContentFixtureMethodologyLesson: MethodologyLesson = {
  id: "methodology-lesson:world-around-me-01",
  methodologyId: lessonContentFixtureMethodology.id,
  methodologySlug: lessonContentFixtureMethodology.slug,
  shell: {
    id: "methodology-shell:world-around-me-01",
    methodologyId: lessonContentFixtureMethodology.id,
    title: "Урок 1. Животные на ферме",
    position: {
      moduleIndex: 1,
      unitIndex: 1,
      lessonIndex: 1,
    },
    vocabularySummary: ["狗", "猫", "兔子", "马", "农场", "跑", "跳"],
    phraseSummary: ["我是…", "这是…", "我们…吧！", "在…里"],
    estimatedDurationMinutes: 45,
    mediaSummary: {
      videos: 1,
      songs: 1,
      worksheets: 2,
      other: 0,
    },
    readinessStatus: "ready",
  },
  blocks: lessonContentFixtureBlocks,
};

export const lessonContentFixtureHomeworkDefinition: MethodologyLessonHomeworkDefinition =
  {
    id: "methodology-homework:world-around-me-01",
    methodologyLessonId: lessonContentFixtureMethodologyLesson.id,
    title: "Повторяем животных фермы",
    kind: "quiz_single_choice",
    instructions:
      "Перед началом повтори 狗, 猫, 兔子, 马, 农场 и фразы 我是… / 这是…. Затем пройди мини-квиз и выбери правильный вариант.",
    materialLinks: [
      "Карточки урока: 狗, 猫, 兔子, 马, 农场",
      "Рабочая тетрадь: страницы 3–4",
      "Карточки движения: 跑 / 跳",
    ],
    answerFormatHint: "Мини-квиз: 8 вопросов, по одному правильному ответу.",
    estimatedMinutes: 7,
    quiz: {
      id: "world-around-me-lesson-1-quiz",
      version: 2,
      questions: [
        {
          id: "q1",
          prompt: "Как по-китайски «собака»?",
          helperText: "Выбери карточку со словом.",
          options: [
            { id: "a", label: "狗" },
            { id: "b", label: "猫" },
            { id: "c", label: "马" },
          ],
          correctOptionId: "a",
        },
        {
          id: "q2",
          prompt: "Как по-китайски «кошка»?",
          options: [
            { id: "a", label: "猫" },
            { id: "b", label: "马" },
            { id: "c", label: "狗" },
          ],
          correctOptionId: "a",
        },
        {
          id: "q3",
          prompt: "Как по-китайски «кролик»?",
          options: [
            { id: "a", label: "兔子" },
            { id: "b", label: "农场" },
            { id: "c", label: "狗" },
          ],
          correctOptionId: "a",
        },
        {
          id: "q4",
          prompt: "Что значит «农场»?",
          options: [
            { id: "a", label: "кошка" },
            { id: "b", label: "ферма" },
            { id: "c", label: "лошадь" },
          ],
          correctOptionId: "b",
        },
        {
          id: "q5",
          prompt: "Выбери фразу «Это…»",
          options: [
            { id: "a", label: "我是…" },
            { id: "b", label: "这是…" },
            { id: "c", label: "我们…吧！" },
          ],
          correctOptionId: "b",
        },
        {
          id: "q6",
          prompt: "Какое слово значит «прыгать»?",
          options: [
            { id: "a", label: "跑" },
            { id: "b", label: "在" },
            { id: "c", label: "跳" },
          ],
          correctOptionId: "c",
        },
        {
          id: "q7",
          prompt: "Какая фраза значит «Я…»?",
          options: [
            { id: "a", label: "我是…" },
            { id: "b", label: "这是…" },
            { id: "c", label: "在…里" },
          ],
          correctOptionId: "a",
        },
        {
          id: "q8",
          prompt: "Какое слово из урока — это животное фермы?",
          options: [
            { id: "a", label: "马" },
            { id: "b", label: "在" },
            { id: "c", label: "我们…吧！" },
          ],
          correctOptionId: "a",
        },
      ],
    },
  };

export const lessonContentFixtureMethodologyLessonStudentContent: MethodologyLessonStudentContent =
  {
    id: "methodology-student-content:world-around-me-01",
    methodologyLessonId: lessonContentFixtureMethodologyLesson.id,
    title: "今天我们去农场！",
    subtitle: "Сегодня мы идём на ферму вместе с Сяо Лоном и Сяо Мей.",
    sections: [
      {
        type: "hero_banner",
        title: "今天我们去农场！",
        subtitle: "Сегодня мы идём на ферму вместе с Сяо Лоном и Сяо Мей.",
        mood: "friendly farm · warm colors · playful",
        chips: ["狗", "猫", "兔子", "马", "农场"],
      },
      {
        type: "goal_cards",
        title: "Что мы выучим сегодня",
        goals: [
          { icon: "🐶", text: "Скажем 4 животных фермы." },
          { icon: "🗣️", text: "Потренируем «我是…» и «这是…»." },
          { icon: "🏃", text: "Выполним команды 跑 и 跳." },
          { icon: "🏡", text: "Запомним слово 农场." },
        ],
      },
      {
        type: "vocabulary_gallery",
        title: "Познакомься с животными",
        items: [
          { term: "狗", pinyin: "gǒu", meaning: "собака", category: "animal", visualHint: "карточка с собакой" },
          { term: "猫", pinyin: "māo", meaning: "кошка", category: "animal", visualHint: "карточка с кошкой" },
          { term: "兔子", pinyin: "tùzi", meaning: "кролик", category: "animal", visualHint: "карточка с кроликом" },
          { term: "马", pinyin: "mǎ", meaning: "лошадь", category: "animal", visualHint: "карточка с лошадью" },
        ],
      },
      {
        type: "story_scene",
        title: "Новое место",
        sceneLine: "农场 — nóngchǎng — ферма",
        prompt: "На ферме живут разные животные.",
        chips: ["农场", "place"],
      },
      {
        type: "phrase_drill",
        title: "Говорим как в уроке",
        items: [
          { phrase: "我是…", pinyin: "wǒ shì…", meaning: "Я…", example: "我是狗。" },
          { phrase: "这是…", pinyin: "zhè shì…", meaning: "Это…", example: "这是猫。" },
        ],
      },
      {
        type: "media_stage",
        title: "Смотрим видео: farm animals",
        assetId: "video:farm-animals",
        assetKind: "video",
        prompt: "Смотри внимательно. Какие животные ты увидел?",
        description: "Сначала посмотри, потом назови знакомые слова.",
        ctaLabel: "Открыть видео",
      },
      {
        type: "movement_mission",
        title: "Двигаемся вместе",
        prompts: ["我们跑吧！", "我们跳吧！"],
        hints: ["Бежим!", "Прыгаем!"],
        energyLevel: "active",
      },
      {
        type: "movement_mission",
        title: "Найди правильное животное",
        prompts: ["跑到狗！", "跳到兔子！", "跑到马！", "跳到猫！"],
        hints: ["Слушай команду и двигайся к нужной игрушке."],
        energyLevel: "active",
      },
      {
        type: "counting_task",
        title: "Считаем и показываем",
        task: "Покажи животное, посчитай, назови.",
        countingRange: "1–5",
        hints: ["Используй палочки", "Покажи и назови"],
      },
      {
        type: "farm_scene",
        title: "На ферме",
        modelLine: "猫在农场里。",
        childNote: "Животные живут на ферме.",
        prompts: ["狗在做什么？", "这是马。"],
      },
      {
        type: "worksheet_preview",
        title: "Рабочая тетрадь",
        assetId: "worksheet:workbook-pages-3-4",
        pageLabel: "Страницы 3–4",
        instructions: "Раскрась животных, назови их и ответь: «这是什么？».",
        checklist: ["Раскрась", "Покажи", "Назови"],
      },
      {
        type: "song_stage",
        title: "Song and goodbye recap",
        assetId: "song:farm-animals",
        prompt: "Пой и повторяй вместе.",
        movementHint: "Показывай животных движениями во время песни.",
      },
      {
        type: "home_recap",
        title: "Вспомним перед домашкой",
        bullets: [
          "Я могу назвать 狗, 猫, 兔子, 马.",
          "Я помню слово 农场.",
          "Я могу сказать 我是… / 这是…",
          "Я знаю 跑 / 跳.",
        ],
      },
      {
        type: "parent_tip",
        title: "Для родителей",
        tip: "Повторите дома 4 животных, 2 фразы и 2 движения в формате мини-игры.",
      },
      {
        type: "lesson_focus",
        title: "Сегодня на уроке",
        body: "Познакомимся с животными фермы, скажем «Я…» и «Это…», а потом сыграем в подвижные игры.",
        chips: ["狗", "猫", "兔子", "马", "农场", "我是…", "这是…", "跑", "跳"],
      },
      {
        type: "vocabulary_cards",
        title: "Слова",
        items: [
          { term: "狗", pinyin: "gǒu", meaning: "собака", visualHint: "карточка собаки" },
          { term: "猫", pinyin: "māo", meaning: "кот / кошка", visualHint: "карточка кошки" },
          { term: "兔子", pinyin: "tùzi", meaning: "кролик", visualHint: "карточка кролика" },
          { term: "马", pinyin: "mǎ", meaning: "лошадь", visualHint: "карточка лошади" },
          { term: "农场", pinyin: "nóngchǎng", meaning: "ферма", visualHint: "карточка фермы" },
        ],
      },
      {
        type: "phrase_cards",
        title: "Фразы",
        items: [
          {
            phrase: "我是…",
            pinyin: "wǒ shì…",
            meaning: "Я…",
            usageHint: "Представься или выбери, кем ты сегодня играешь.",
          },
          {
            phrase: "这是…",
            pinyin: "zhè shì…",
            meaning: "Это…",
            usageHint: "Покажи карточку и назови животное.",
          },
        ],
      },
      {
        type: "media_asset",
        title: "Видео: farm animals",
        assetId: "video:farm-animals",
        assetKind: "video",
        studentPrompt: "Смотри внимательно и повторяй названия животных.",
        teacherShareHint: "Покажи видео на большом экране перед активностями.",
      },
      {
        type: "media_asset",
        title: "Песня: farm animals",
        assetId: "song:farm-animals",
        assetKind: "song",
        studentPrompt: "Пой и повторяй движения вместе с героями.",
        teacherShareHint: "Используй в финале урока для закрепления.",
      },
      {
        type: "action_cards",
        title: "Движение",
        items: [
          {
            term: "跑",
            pinyin: "pǎo",
            meaning: "бежать",
            movementHint: "Бежим к нужной игрушке или карточке.",
          },
          {
            term: "跳",
            pinyin: "tiào",
            meaning: "прыгать",
            movementHint: "Прыгаем как животные фермы.",
          },
        ],
      },
      {
        type: "worksheet",
        title: "Рабочая тетрадь",
        assetId: "worksheet:workbook-pages-3-4",
        pageLabel: "Страницы 3–4",
        instructions: "Раскрась животных и ответь на вопрос «这是什么？».",
      },
      {
        type: "worksheet",
        title: "Приложение",
        assetId: "worksheet:appendix-1",
        pageLabel: "Приложение 1",
        instructions: "Покажи указкой животных, посчитай и назови их вслух.",
      },
      {
        type: "recap",
        title: "Вспомнить дома",
        bullets: [
          "Назови дома 4 животных фермы по-китайски.",
          "Скажи 2 фразы с «我是…» или «这是…».",
          "Покажи движение «跑» и «跳» и повтори слова.",
        ],
      },
    ],
  };

export const lessonContentFixtureScheduledLesson: ScheduledLesson = {
  id: "scheduled-lesson:demo-world-around-me-lesson-1",
  methodologyLessonId: lessonContentFixtureMethodologyLesson.id,
  runtimeShell: {
    id: "runtime-shell:demo-world-around-me-lesson-1",
    classId: "3f8e9cf9-66f2-4fb9-9504-9f708b67e952",
    startsAt: "2026-04-07T15:00:00.000Z",
    format: "offline",
    place: "Demo classroom A",
    runtimeStatus: "planned",
    runtimeNotesSummary: "Подготовить карточки и мягкие игрушки до начала урока.",
  },
  runtimeNotes: "Следить за равномерным участием детей в подвижных активностях.",
  outcomeNotes: "",
};
