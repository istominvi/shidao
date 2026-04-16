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
    id: "block:step-01-greeting",
    blockType: "intro_framing",
    order: 1,
    title: "Приветствие детей и героев курса",
    assetRefs: [],
    content: {
      title: "Урок 1. Животные на ферме",
      goal: "Мягко включить детей в китайскую речь и обозначить тему урока.",
      teacherScriptShort: "Поприветствовать детей и героев курса, создать доброжелательный круг.",
      timeboxMinutes: 3,
    },
  },
  {
    id: "block:step-02-video",
    blockType: "video_segment",
    order: 2,
    title: "Просмотр видео farm animals",
    assetRefs: [{ kind: "video", id: "video:farm-animals" }],
    content: {
      promptBeforeWatch: "Смотрим видео farm animals и слушаем, как звучат названия животных.",
      focusPoints: ["狗", "猫", "兔子", "马"],
      questionsAfterWatch: ["Кого ты услышал?", "Какое слово запомнилось лучше всего?"],
    },
  },
  {
    id: "block:step-03-wo-shi",
    blockType: "teacher_prompt_pattern",
    order: 3,
    title: "Круг: «我是…» и вопрос «你是谁？»",
    assetRefs: [],
    content: {
      promptPatterns: ["你是谁？", "我是…"],
      expectedStudentResponses: ["我是…"],
      fallbackRu: "Дайте ребёнку выбрать роль героя или животного и завершить фразу «我是…».",
    },
  },
  {
    id: "block:step-04-vocabulary-pass",
    blockType: "vocabulary_focus",
    order: 4,
    title: "Карточки животных в два прохода",
    assetRefs: [],
    content: {
      items: [
        { term: "狗", pinyin: "gǒu", meaning: "собака" },
        { term: "猫", pinyin: "māo", meaning: "кот / кошка" },
        { term: "兔子", pinyin: "tùzi", meaning: "кролик" },
        { term: "马", pinyin: "mǎ", meaning: "лошадь" },
      ],
      practiceMode: "cards_two_passes_then_actions",
      miniDrill: "Проход 1: только слово. Проход 2: паттерн «这是…» с каждой карточкой.",
    },
  },
  {
    id: "block:step-05-imitation",
    blockType: "guided_activity",
    order: 5,
    title: "Подражание животным по карточкам",
    assetRefs: [],
    content: {
      activityType: "movement_imitation",
      steps: [
        "Дети встают, педагог показывает карточку — группа изображает животное.",
        "Педагог комментирует действия в модели «我是狗» / «我是猫».",
      ],
      successCriteria: [
        "Ребёнок связывает образ карточки и китайское слово.",
        "Ребёнок пробует говорить «我是…» в движении.",
      ],
      timeboxMinutes: 3,
    },
  },
  {
    id: "block:step-06-wall-ball",
    blockType: "guided_activity",
    order: 6,
    title: "Карточки на стене + мяч",
    assetRefs: [],
    content: {
      activityType: "target_throw_and_name",
      steps: [
        "Закрепите карточки 狗/猫/兔子/马 на стене малярным скотчем.",
        "Педагог называет животное, ребёнок бросает мяч в нужную карточку.",
        "После броска ребёнок говорит «这是…» или слово животного.",
      ],
      successCriteria: [
        "Ребёнок точно выбирает карточку по аудиокоманде.",
        "Ребёнок проговаривает слово или модель «这是…».",
      ],
      timeboxMinutes: 4,
    },
  },
  {
    id: "block:step-07-counting-sticks",
    blockType: "guided_activity",
    order: 7,
    title: "Счёт до 5 палочками",
    assetRefs: [],
    content: {
      activityType: "counting_sticks_to_five",
      steps: [
        "Дети садятся в круг, педагог считает палочками до 5.",
        "Дети повторяют счёт с собственными палочками.",
      ],
      successCriteria: ["Группа синхронно считает до 5.", "Дети удерживают речевой ритм."],
      timeboxMinutes: 3,
    },
  },
  {
    id: "block:step-08-appendix",
    blockType: "guided_activity",
    order: 8,
    title: "Приложение 1: показать, посчитать, назвать",
    assetRefs: [{ kind: "worksheet", id: "worksheet:appendix-1" }],
    content: {
      activityType: "count_and_point",
      steps: [
        "Откройте Приложение 1 и используйте указку.",
        "Дети по очереди показывают, считают и называют животных.",
      ],
      successCriteria: [
        "Ребёнок находит нужного животного по слову.",
        "Ребёнок проговаривает название после указания.",
      ],
      timeboxMinutes: 4,
    },
  },
  {
    id: "block:step-09-run-jump",
    blockType: "teacher_prompt_pattern",
    order: 9,
    title: "Введение 跑 / 跳 через команды",
    assetRefs: [],
    content: {
      promptPatterns: ["我们跑吧！", "我们跳吧！"],
      expectedStudentResponses: ["Дети выполняют движение и повторяют глагол."],
    },
  },
  {
    id: "block:step-10-toy-commands",
    blockType: "guided_activity",
    order: 10,
    title: "Команды с мягкими игрушками",
    assetRefs: [],
    content: {
      activityType: "movement_commands_with_toys",
      steps: [
        "Разместите игрушки собаки, кошки, кролика и лошади по комнате.",
        "Давайте команды: «跑到狗！», «跳到兔子！», «跑到马！», «跳到猫！».",
      ],
      successCriteria: ["Дети различают 跑 и 跳.", "Дети реагируют быстро и безопасно."],
      timeboxMinutes: 4,
    },
  },
  {
    id: "block:step-11-what-is-doing",
    blockType: "teacher_prompt_pattern",
    order: 11,
    title: "Вопрос-ответ о действии",
    assetRefs: [],
    content: {
      promptPatterns: ["狗在做什么？", "狗在跳"],
      expectedStudentResponses: ["狗在跳", "猫在跑"],
      fallbackRu: "Сначала моделируйте полный ответ, затем просите ребёнка повторить по образцу.",
    },
  },
  {
    id: "block:step-12-workbook",
    blockType: "worksheet_task",
    order: 12,
    title: "Рабочая тетрадь: страницы 3–4",
    assetRefs: [{ kind: "worksheet", id: "worksheet:workbook-pages-3-4" }],
    content: {
      taskInstruction: "Раскрась животных на стр. 3–4 и ответь на вопрос «这是什么？».",
      completionMode: "in_class",
      answerKeyHint: "Проверяйте устно: ребёнок показывает рисунок и говорит «这是…».",
    },
  },
  {
    id: "block:step-13-farm-word",
    blockType: "vocabulary_focus",
    order: 13,
    title: "Слово 农场",
    assetRefs: [],
    content: {
      items: [{ term: "农场", pinyin: "nóngchǎng", meaning: "ферма" }],
      practiceMode: "single_card_with_context",
      miniDrill: "Покажите карточку 农场 и попросите детей повторить в хоре.",
    },
  },
  {
    id: "block:step-14-farm-pattern",
    blockType: "guided_activity",
    order: 14,
    title: "Игрушечная ферма и модель «在…里»",
    assetRefs: [],
    content: {
      activityType: "toy_farm_language_reinforcement",
      steps: [
        "Разместите животных в игрушечной ферме.",
        "Проговаривайте и повторяйте: «猫住在农场里。», «马在农场里。».",
      ],
      successCriteria: ["Дети узнают слово 农场.", "Дети повторяют модель 在…里 с опорой на игрушки."],
      timeboxMinutes: 4,
    },
  },
  {
    id: "block:step-15-song",
    blockType: "song_segment",
    order: 15,
    title: "Песня farm animals",
    assetRefs: [{ kind: "song", id: "song:farm-animals" }],
    content: {
      activityGoal: "Закрепить слова и завершить урок в знакомом ритуале.",
      teacherActions: ["Включите песню farm animals и подпевайте вместе с детьми."],
      repeatCount: 1,
      movementHint: "Поддерживайте знакомые движения на словах животных.",
    },
  },
  {
    id: "block:step-16-goodbye",
    blockType: "wrap_up_closure",
    order: 16,
    title: "Прощание с детьми и героями",
    assetRefs: [],
    content: {
      recapPoints: ["狗", "猫", "兔子", "马", "农场", "我是…", "这是…", "跑", "跳", "在…里"],
      exitCheck: "Перед прощанием попросите каждого ребёнка назвать 1 животное и 1 действие.",
      teacherReflectionPrompt: "Завершите урок песней и дружелюбным прощанием героев курса.",
    },
  },
  {
    id: "block:materials-lesson-1",
    blockType: "materials_prep",
    order: 17,
    title: "Материалы урока",
    assetRefs: [{ kind: "worksheet", id: "worksheet:appendix-1" }],
    content: {
      materialsChecklist: [
        "герои курса",
        "карточки 狗/猫/兔子/马 и карточка 农场",
        "малярный скотч",
        "мяч",
        "палочки для счёта",
        "Приложение 1",
        "указка",
        "мягкие игрушки: собака, кот, кролик, лошадь",
        "рабочая тетрадь",
        "игрушечная ферма",
      ],
      roomSetupNotes: "Подготовьте безопасные зоны для движения и заранее разложите игрушки для этапа команд.",
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
    phraseSummary: ["你是谁？", "我是…", "这是…", "我们…吧！", "在…里"],
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

export const lessonContentFixtureHomeworkDefinition: MethodologyLessonHomeworkDefinition = {
  id: "methodology-homework:world-around-me-01",
  methodologyLessonId: lessonContentFixtureMethodologyLesson.id,
  title: "Мини-тест: Животные на ферме",
  kind: "quiz_single_choice",
  instructions: "Короткая игра на повторение слов и фраз урока. Выбери правильный ответ в каждом вопросе.",
  materialLinks: ["Рабочая тетрадь, стр. 3–4", "Карточки животных из урока"],
  answerFormatHint: "Тест из 5 вопросов, один ответ в каждом.",
  estimatedMinutes: 5,
  quiz: {
    id: "world-around-me-lesson-1-quiz",
    version: 1,
    questions: [
      { id: "q1", prompt: "Как по-китайски «собака»?", helperText: "Выбери карточку со словом.", options: [{ id: "a", label: "狗" }, { id: "b", label: "猫" }, { id: "c", label: "马" }], correctOptionId: "a" },
      { id: "q2", prompt: "Как по-китайски «кролик»?", options: [{ id: "a", label: "兔子" }, { id: "b", label: "农场" }, { id: "c", label: "狗" }], correctOptionId: "a" },
      { id: "q3", prompt: "Что значит «农场»?", options: [{ id: "a", label: "кошка" }, { id: "b", label: "ферма" }, { id: "c", label: "лошадь" }], correctOptionId: "b" },
      { id: "q4", prompt: "Выбери фразу «Это…»", options: [{ id: "a", label: "我是…" }, { id: "b", label: "这是…" }, { id: "c", label: "我们…吧！" }], correctOptionId: "b" },
      { id: "q5", prompt: "Какое слово значит «прыгать»?", options: [{ id: "a", label: "跑" }, { id: "b", label: "在" }, { id: "c", label: "跳" }], correctOptionId: "c" },
    ],
  },
};

export const lessonContentFixtureMethodologyLessonStudentContent: MethodologyLessonStudentContent = {
  id: "methodology-student-content:world-around-me-01",
  methodologyLessonId: lessonContentFixtureMethodologyLesson.id,
  title: "Урок 1. Животные на ферме",
  subtitle: "Смотрим, играем, двигаемся и повторяем китайские слова вместе.",
  sections: [
    {
      type: "lesson_focus",
      title: "Урок 1 · Животные на ферме",
      subtitle: "Сегодня мы отправляемся на ферму вместе с Сяо Лоном и Сяо Мей.",
      body: "Сначала поздороваемся, посмотрим видео, выучим слова и поиграем в активные игры с командами.",
      chips: ["狗", "猫", "兔子", "马", "农场"],
      tone: "sky",
      illustrationSrc: "/methodologies/world-around-me/lesson-1/farm-scene.svg",
    },
    {
      type: "lesson_focus",
      title: "Сегодня на уроке",
      body: "Смотрим видео, считаем до 5, двигаемся по командам, работаем в тетради и поём песню farm animals.",
      chips: ["我是…", "这是…", "我们跑吧！", "我们跳吧！", "在…里"],
      tone: "violet",
    },
    {
      type: "vocabulary_cards",
      title: "Слова-животные",
      tone: "amber",
      items: [
        { term: "狗", pinyin: "gǒu", meaning: "собака", illustrationSrc: "/methodologies/world-around-me/lesson-1/dog.svg" },
        { term: "猫", pinyin: "māo", meaning: "кот / кошка", illustrationSrc: "/methodologies/world-around-me/lesson-1/cat.svg" },
        { term: "兔子", pinyin: "tùzi", meaning: "кролик", illustrationSrc: "/methodologies/world-around-me/lesson-1/rabbit.svg" },
        { term: "马", pinyin: "mǎ", meaning: "лошадь", illustrationSrc: "/methodologies/world-around-me/lesson-1/horse.svg" },
      ],
    },
    {
      type: "phrase_cards",
      title: "Фраза урока: 我是…",
      tone: "violet",
      items: [
        { phrase: "我是…", pinyin: "wǒ shì…", meaning: "Я…", usageHint: "Представься сам или как герой/животное.", example: "我是狗。" },
      ],
    },
    {
      type: "phrase_cards",
      title: "Фраза урока: 这是…",
      tone: "violet",
      items: [
        { phrase: "这是…", pinyin: "zhè shì…", meaning: "Это…", usageHint: "Покажи карточку и скажи, кто это.", example: "这是猫。" },
      ],
    },
    {
      type: "lesson_focus",
      title: "Считаем до 5",
      body: "Считаем палочками и показываем животных в Приложении 1 с указкой.",
      chips: ["1", "2", "3", "4", "5"],
      tone: "sky",
      illustrationSrc: "/methodologies/world-around-me/lesson-1/counting.svg",
    },
    {
      type: "action_cards",
      title: "Движение: 跑 и 跳",
      tone: "emerald",
      items: [
        { term: "跑", pinyin: "pǎo", meaning: "бежать", movementHint: "Бежим к игрушке по команде.", illustrationSrc: "/methodologies/world-around-me/lesson-1/run.svg" },
        { term: "跳", pinyin: "tiào", meaning: "прыгать", movementHint: "Прыгаем как животные фермы.", illustrationSrc: "/methodologies/world-around-me/lesson-1/jump.svg" },
      ],
    },
    {
      type: "phrase_cards",
      title: "Команды",
      tone: "emerald",
      items: [
        { phrase: "我们跑吧！", pinyin: "wǒmen pǎo ba!", meaning: "Давайте побежим!", example: "跑到狗！" },
        { phrase: "我们跳吧！", pinyin: "wǒmen tiào ba!", meaning: "Давайте попрыгаем!", example: "跳到兔子！" },
      ],
    },
    {
      type: "phrase_cards",
      title: "Ферма: 农场 и 在…里",
      tone: "amber",
      illustrationSrc: "/methodologies/world-around-me/lesson-1/barn.svg",
      items: [
        { phrase: "农场", pinyin: "nóngchǎng", meaning: "ферма", usageHint: "Покажи карточку фермы." },
        { phrase: "在…里", pinyin: "zài…lǐ", meaning: "внутри / в", example: "猫住在农场里。" },
      ],
    },
    {
      type: "worksheet",
      title: "Практика в тетради",
      tone: "amber",
      illustrationSrc: "/methodologies/world-around-me/lesson-1/workbook.svg",
      pageLabel: "Рабочая тетрадь · стр. 3–4",
      instructions: "Раскрась животных и ответь на вопрос «这是什么？».",
      teacherHint: "Если ссылки нет, материал выдается преподавателем прямо на уроке.",
      assetId: "worksheet:workbook-pages-3-4",
    },
    {
      type: "media_asset",
      title: "Песня farm animals",
      tone: "rose",
      assetId: "song:farm-animals",
      assetKind: "song",
      studentPrompt: "Пой и повторяй движения вместе с группой.",
      teacherShareHint: "Песня открывает и завершает учебный цикл урока.",
      ctaLabel: "Слушать запись",
    },
    {
      type: "recap",
      title: "Вспомнить дома",
      tone: "neutral",
      bullets: [
        "Назови 4 животных: 狗, 猫, 兔子, 马.",
        "Скажи про себя и предмет: «我是…», «这是…».",
        "Покажи движения 跑 и 跳 и проговори команды.",
        "Скажи одну фразу с 农场 и 在…里.",
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
