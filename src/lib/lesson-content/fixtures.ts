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
    description: "Видео-сегмент уроков 1–2: знакомство с животными фермы.",
  },
  {
    id: "song:hello",
    kind: "song",
    title: "hello",
    description: "Песня-приветствие для начала урока 2.",
  },
  {
    id: "song:farm-animals",
    kind: "song",
    title: "farm animals",
    description: "Песня для завершения уроков про животных.",
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
  {
    id: "worksheet:workbook-page-5",
    kind: "worksheet",
    title: "Рабочая тетрадь, стр. 5",
    description: "Соедини числа и животных, назови вслух по модели «这是…».",
  },
  {
    id: "worksheet:appendix-2",
    kind: "worksheet",
    title: "Приложение 2",
    description: "Пазлы с животными для счёта и называния.",
  },
  {
    id: "media:masks-farm-animals",
    kind: "media_file",
    title: "Маски животных фермы",
    description: "Набор масок: 鸭子、鸡子、羊、牛 для командных игр.",
    fileRef: "/methodologies/world-around-me/lesson-2/masks.svg",
  },
];

const lessonOneBlocks: LessonBlockInstance[] = [
  {
    id: "block:step-01-greeting",
    blockType: "intro_framing",
    order: 1,
    title: "Приветствие детей и героев курса",
    assetRefs: [],
    content: {
      title: "Урок 1. Животные на ферме",
      goal: "Мягко включить детей в китайскую речь и обозначить тему урока.",
      teacherScriptShort:
        "Поприветствовать детей и героев курса, создать доброжелательный круг.",
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
      promptBeforeWatch:
        "Смотрим видео farm animals и слушаем, как звучат названия животных.",
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
      fallbackRu:
        "Дайте ребёнку выбрать роль героя или животного и завершить фразу «我是…».",
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
      miniDrill:
        "Проход 1: только слово. Проход 2: паттерн «这是…» с каждой карточкой.",
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
      fallbackRu:
        "Сначала моделируйте полный ответ, затем просите ребёнка повторить по образцу.",
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
      miniDrill:
        "Покажите карточку 农场 и попросите детей повторить в хоре.",
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
      successCriteria: [
        "Дети узнают слово 农场.",
        "Дети повторяют модель 在…里 с опорой на игрушки.",
      ],
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
      exitCheck:
        "Перед прощанием попросите каждого ребёнка назвать 1 животное и 1 действие.",
      teacherReflectionPrompt:
        "Завершите урок песней и дружелюбным прощанием героев курса.",
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
      roomSetupNotes:
        "Подготовьте безопасные зоны для движения и заранее разложите игрушки для этапа команд.",
    },
  },
];

const lessonTwoBlocks: LessonBlockInstance[] = [
  {
    id: "block:l2-step-01-greeting",
    blockType: "intro_framing",
    order: 1,
    title: "Приветствие детей и героев курса",
    assetRefs: [],
    content: {
      title: "Урок 2. Что это за животное?",
      goal: "Активно включить детей в урок и напомнить формат «играем и говорим по-китайски».",
      teacherScriptShort:
        "Поприветствуйте детей и героев курса, посадите группу в круг, задайте позитивный ритм.",
      warmupQuestion: "你是谁？",
      timeboxMinutes: 3,
    },
  },
  {
    id: "block:l2-step-02-video",
    blockType: "video_segment",
    order: 2,
    title: "Видео farm animals",
    assetRefs: [{ kind: "video", id: "video:farm-animals" }],
    content: {
      promptBeforeWatch:
        "Смотрим farm animals и слушаем новые слова про животных фермы.",
      focusPoints: ["鸭子", "鸡子", "羊", "牛"],
      questionsAfterWatch: ["Кого ты услышал?", "Кто говорит «му-у»?", "Что ты запомнил?"],
    },
  },
  {
    id: "block:l2-step-03-wo-shi-circle",
    blockType: "teacher_prompt_pattern",
    order: 3,
    title: "Круговой паттерн «你是谁？— 我是…»",
    assetRefs: [],
    content: {
      promptPatterns: ["你是谁？", "我是…"],
      expectedStudentResponses: ["我是小鸭子。", "我是小牛。"],
      fallbackRu:
        "Если ребёнок теряется, предложите выбрать маску/картинку и договорить «我是…» вместе с вами.",
    },
  },
  {
    id: "block:l2-step-04-hello-song",
    blockType: "song_segment",
    order: 4,
    title: "Песня hello",
    assetRefs: [{ kind: "song", id: "song:hello" }],
    content: {
      activityGoal: "Закрепить ритуал начала занятия и настроить группу на совместную речь.",
      teacherActions: ["Включите песню hello и спойте её вместе с детьми в круге."],
      repeatCount: 1,
      movementHint: "Добавьте хлопки в ладоши и жест «привет» каждому ребёнку.",
    },
  },
  {
    id: "block:l2-step-05-vocabulary-animals",
    blockType: "vocabulary_focus",
    order: 5,
    title: "Новые слова: животные фермы",
    assetRefs: [],
    content: {
      items: [
        { term: "鸭子", pinyin: "yāzi", meaning: "утка" },
        { term: "鸡子", pinyin: "jīzi", meaning: "курица" },
        { term: "羊", pinyin: "yáng", meaning: "овца" },
        { term: "牛", pinyin: "niú", meaning: "корова" },
      ],
      practiceMode: "cards_two_passes_then_sentence_model",
      miniDrill:
        "Проход 1: называем слово. Проход 2: с каждой карточкой говорим полную модель «这是…».",
    },
  },
  {
    id: "block:l2-step-06-jump-cards",
    blockType: "guided_activity",
    order: 6,
    title: "Прыжки по карточкам",
    assetRefs: [],
    content: {
      activityType: "jump_and_name_cards",
      steps: [
        "Разложите карточки 鸭子/鸡子/羊/牛 в ряд на полу.",
        "Ребёнок прыгает на карточку, показывает на неё и говорит: «这是…».",
        "Группа повторяет фразу хором после каждого прыжка.",
      ],
      successCriteria: [
        "Ребёнок уверенно соотносит карточку и слово.",
        "Ребёнок произносит модель «这是…» в активном движении.",
      ],
      timeboxMinutes: 4,
    },
  },
  {
    id: "block:l2-step-07-sound-guess",
    blockType: "guided_activity",
    order: 7,
    title: "Угадай животное по звуку",
    assetRefs: [],
    content: {
      activityType: "animal_sound_guessing",
      steps: [
        "Дети садятся в круг и слушают звуки животных.",
        "После каждого звука задайте вопрос: «这是什么？».",
        "Дети отвечают словом животного или фразой «这是牛。».",
      ],
      successCriteria: [
        "Дети распознают животное на слух.",
        "Дети пробуют отвечать словами урока без подсказки на карточке.",
      ],
      timeboxMinutes: 3,
    },
  },
  {
    id: "block:l2-step-08-actions-clap-count",
    blockType: "teacher_prompt_pattern",
    order: 8,
    title: "Команды 跑 / 跳 / 拍手 / 数",
    assetRefs: [],
    content: {
      promptPatterns: ["我们跑吧！", "我们跳吧！", "拍手吧！", "我们数吧！"],
      expectedStudentResponses: [
        "Дети выполняют движение и проговаривают глагол.",
        "Дети считают до 5, хлопая и прыгая.",
      ],
      fallbackRu:
        "Сначала выполните команду сами, затем подключите группу и добавьте счёт «一、二、三、四、五».",
    },
  },
  {
    id: "block:l2-step-09-counting-toys",
    blockType: "guided_activity",
    order: 9,
    title: "Считаем игрушки животных",
    assetRefs: [],
    content: {
      activityType: "counting_with_soft_toys",
      steps: [
        "Посадите детей в круг и разложите игрушки (собака, кот, кролик, лошадь).",
        "Считайте вместе до 5, по очереди показывая игрушки и называя животных.",
        "Попросите детей повторить счёт и назвать одно животное самостоятельно.",
      ],
      successCriteria: [
        "Дети держат ритм счёта до 5.",
        "Дети совмещают счёт с называнием животного.",
      ],
      timeboxMinutes: 3,
    },
  },
  {
    id: "block:l2-step-10-appendix-2",
    blockType: "guided_activity",
    order: 10,
    title: "Приложение 2: пазлы животных",
    assetRefs: [{ kind: "worksheet", id: "worksheet:appendix-2" }],
    content: {
      activityType: "appendix_puzzle_count_and_name",
      steps: [
        "Раздайте детям элементы Приложения 2.",
        "Попросите собрать пазл и назвать животное на картинке.",
        "После сборки дети считают животных вслух по одному.",
      ],
      successCriteria: [
        "Ребёнок называет хотя бы 1–2 животных из урока.",
        "Ребёнок участвует в счёте и слышит ответы одногруппников.",
      ],
      timeboxMinutes: 4,
    },
  },
  {
    id: "block:l2-step-11-masks-commands",
    blockType: "guided_activity",
    order: 11,
    title: "Маски и команды",
    assetRefs: [{ kind: "media_file", id: "media:masks-farm-animals" }],
    content: {
      activityType: "mask_roleplay_commands",
      steps: [
        "Раздайте маски утки, курицы, овцы и коровы.",
        "Давайте команды в игровом формате: «鸭子，跑吧！», «鸡子，拍手吧！».",
        "Меняйте роли, чтобы каждый ребёнок выполнил минимум 2 команды.",
      ],
      successCriteria: [
        "Дети реагируют на адресную команду.",
        "Дети закрепляют глаголы 跑 / 跳 / 拍手.",
      ],
      timeboxMinutes: 4,
    },
  },
  {
    id: "block:l2-step-12-workbook-page-5",
    blockType: "worksheet_task",
    order: 12,
    title: "Рабочая тетрадь: страница 5",
    assetRefs: [{ kind: "worksheet", id: "worksheet:workbook-page-5" }],
    content: {
      taskInstruction:
        "Откройте стр. 5 и соедините числа с животными. После соединения проговорите «这是…».",
      completionMode: "in_class",
      answerKeyHint:
        "Проверяйте устно: ребёнок показывает линию и произносит название животного.",
    },
  },
  {
    id: "block:l2-step-13-house-word",
    blockType: "vocabulary_focus",
    order: 13,
    title: "Слово 房子",
    assetRefs: [],
    content: {
      items: [{ term: "房子", pinyin: "fángzi", meaning: "дом" }],
      practiceMode: "single_card_with_context",
      miniDrill:
        "Покажите карточку 房子 и попросите детей повторить слово с жестом «домик» руками.",
    },
  },
  {
    id: "block:l2-step-14-house-pattern",
    blockType: "guided_activity",
    order: 14,
    title: "Игрушечный дом: 我 / 你 / 在…里",
    assetRefs: [],
    content: {
      activityType: "toy_house_phrase_practice",
      steps: [
        "Поставьте игрушечный дом и маленькие фигурки.",
        "Моделируйте фразы: «我住在房子里。», «你在房子里吗？».",
        "Попросите детей по очереди поместить фигурку в дом и проговорить короткую фразу.",
      ],
      successCriteria: [
        "Дети распознают слова 我 / 你 / 房子.",
        "Дети повторяют модель 在…里 в мини-ситуации.",
      ],
      timeboxMinutes: 4,
    },
  },
  {
    id: "block:l2-step-15-song-farm-animals",
    blockType: "song_segment",
    order: 15,
    title: "Песня farm animals",
    assetRefs: [{ kind: "song", id: "song:farm-animals" }],
    content: {
      activityGoal:
        "Завершить урок в знакомом ритуале и закрепить новые слова о животных.",
      teacherActions: ["Включите farm animals, пойте вместе и показывайте карточки животных."],
      repeatCount: 1,
      movementHint: "Добавьте хлопки и прыжки на знакомых словах.",
    },
  },
  {
    id: "block:l2-step-16-goodbye",
    blockType: "wrap_up_closure",
    order: 16,
    title: "Прощание с детьми и героями",
    assetRefs: [],
    content: {
      recapPoints: [
        "鸭子",
        "鸡子",
        "羊",
        "牛",
        "房子",
        "我是…",
        "这是…",
        "拍手",
        "数",
        "在…里",
      ],
      exitCheck:
        "Перед прощанием каждый ребёнок называет 1 животное и 1 действие, затем говорит короткую фразу с «这是…».",
      teacherReflectionPrompt:
        "Попрощайтесь вместе с героями курса и отметьте детей за участие в играх.",
    },
  },
  {
    id: "block:l2-materials",
    blockType: "materials_prep",
    order: 17,
    title: "Материалы урока 2",
    assetRefs: [
      { kind: "worksheet", id: "worksheet:appendix-2" },
      { kind: "worksheet", id: "worksheet:workbook-page-5" },
      { kind: "media_file", id: "media:masks-farm-animals" },
    ],
    content: {
      materialsChecklist: [
        "герои курса",
        "карточки 鸭子/鸡子/羊/牛",
        "карточка 房子",
        "аудио со звуками животных",
        "мягкие игрушки: собака, кот, кролик, лошадь",
        "Приложение 2 (пазлы)",
        "маски утки/курицы/овцы/коровы",
        "рабочая тетрадь (стр. 5)",
        "игрушечный дом",
      ],
      roomSetupNotes:
        "Подготовьте две зоны: активную (прыжки/команды) и спокойную (пазлы/тетрадь), чтобы сохранить чередование темпа урока.",
    },
  },
];

export const lessonContentFixtureBlocks: LessonBlockInstance[] = lessonOneBlocks;
export const lessonContentFixtureLessonTwoBlocks: LessonBlockInstance[] = lessonTwoBlocks;

const lessonOneMethodologyLesson: MethodologyLesson = {
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
  blocks: lessonOneBlocks,
};

const lessonTwoMethodologyLesson: MethodologyLesson = {
  id: "methodology-lesson:world-around-me-02",
  methodologyId: lessonContentFixtureMethodology.id,
  methodologySlug: lessonContentFixtureMethodology.slug,
  shell: {
    id: "methodology-shell:world-around-me-02",
    methodologyId: lessonContentFixtureMethodology.id,
    title: "Урок 2. Что это за животное?",
    position: {
      moduleIndex: 1,
      unitIndex: 1,
      lessonIndex: 2,
    },
    vocabularySummary: ["鸭子", "鸡子", "羊", "牛", "房子", "拍手", "数", "我", "你"],
    phraseSummary: ["你是谁？", "我是…", "这是…", "在…里", "我住在房子里。"],
    estimatedDurationMinutes: 45,
    mediaSummary: {
      videos: 1,
      songs: 2,
      worksheets: 2,
      other: 1,
    },
    readinessStatus: "ready",
  },
  blocks: lessonTwoBlocks,
};

export const lessonContentFixtureMethodologyLessons: MethodologyLesson[] = [
  lessonOneMethodologyLesson,
  lessonTwoMethodologyLesson,
];

export const lessonContentFixtureMethodologyLesson: MethodologyLesson =
  lessonOneMethodologyLesson;
export const lessonContentFixtureMethodologyLessonTwo: MethodologyLesson =
  lessonTwoMethodologyLesson;

const lessonOneHomeworkDefinition: MethodologyLessonHomeworkDefinition = {
  id: "methodology-homework:world-around-me-01",
  methodologyLessonId: lessonOneMethodologyLesson.id,
  title: "Мини-тест: Животные на ферме",
  kind: "quiz_single_choice",
  instructions:
    "Короткая игра на повторение слов и фраз урока. Выбери правильный ответ в каждом вопросе.",
  materialLinks: ["Рабочая тетрадь, стр. 3–4", "Карточки животных из урока"],
  answerFormatHint: "Тест из 5 вопросов, один ответ в каждом.",
  estimatedMinutes: 5,
  quiz: {
    id: "world-around-me-lesson-1-quiz",
    version: 1,
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
        prompt: "Как по-китайски «кролик»?",
        options: [
          { id: "a", label: "兔子" },
          { id: "b", label: "农场" },
          { id: "c", label: "狗" },
        ],
        correctOptionId: "a",
      },
      {
        id: "q3",
        prompt: "Что значит «农场»?",
        options: [
          { id: "a", label: "кошка" },
          { id: "b", label: "ферма" },
          { id: "c", label: "лошадь" },
        ],
        correctOptionId: "b",
      },
      {
        id: "q4",
        prompt: "Выбери фразу «Это…»",
        options: [
          { id: "a", label: "我是…" },
          { id: "b", label: "这是…" },
          { id: "c", label: "我们…吧！" },
        ],
        correctOptionId: "b",
      },
      {
        id: "q5",
        prompt: "Какое слово значит «прыгать»?",
        options: [
          { id: "a", label: "跑" },
          { id: "b", label: "在" },
          { id: "c", label: "跳" },
        ],
        correctOptionId: "c",
      },
    ],
  },
};

const lessonTwoHomeworkDefinition: MethodologyLessonHomeworkDefinition = {
  id: "methodology-homework:world-around-me-02",
  methodologyLessonId: lessonTwoMethodologyLesson.id,
  title: "Мини-миссия: Угадай животное и дом",
  kind: "quiz_single_choice",
  instructions:
    "Повтори слова урока 2. Слушай вопрос, выбирай правильный ответ и помоги героям найти животных и дом.",
  materialLinks: ["Рабочая тетрадь, стр. 5", "Карточки 鸭子/鸡子/羊/牛/房子"],
  answerFormatHint: "6 коротких вопросов, по одному ответу.",
  estimatedMinutes: 6,
  quiz: {
    id: "world-around-me-lesson-2-quiz",
    version: 1,
    questions: [
      {
        id: "q1",
        prompt: "Как по-китайски «утка»?",
        options: [
          { id: "a", label: "鸭子" },
          { id: "b", label: "羊" },
          { id: "c", label: "牛" },
        ],
        correctOptionId: "a",
      },
      {
        id: "q2",
        prompt: "Что значит 房子?",
        options: [
          { id: "a", label: "овца" },
          { id: "b", label: "дом" },
          { id: "c", label: "курица" },
        ],
        correctOptionId: "b",
      },
      {
        id: "q3",
        prompt: "Выбери фразу «Это корова».",
        options: [
          { id: "a", label: "我是牛。" },
          { id: "b", label: "这是牛。" },
          { id: "c", label: "你是牛。" },
        ],
        correctOptionId: "b",
      },
      {
        id: "q4",
        prompt: "Какое слово — команда «хлопай»?",
        options: [
          { id: "a", label: "拍手" },
          { id: "b", label: "数" },
          { id: "c", label: "跳" },
        ],
        correctOptionId: "a",
      },
      {
        id: "q5",
        prompt: "Какое слово значит «считать»?",
        options: [
          { id: "a", label: "你" },
          { id: "b", label: "我" },
          { id: "c", label: "数" },
        ],
        correctOptionId: "c",
      },
      {
        id: "q6",
        prompt: "Выбери правильную фразу про дом.",
        helperText: "Где я живу?",
        options: [
          { id: "a", label: "我住在房子里。" },
          { id: "b", label: "你住在羊里。" },
          { id: "c", label: "这是我里。" },
        ],
        correctOptionId: "a",
      },
    ],
  },
};

export const lessonContentFixtureHomeworkDefinitions: MethodologyLessonHomeworkDefinition[] = [
  lessonOneHomeworkDefinition,
  lessonTwoHomeworkDefinition,
];

export const lessonContentFixtureHomeworkDefinition: MethodologyLessonHomeworkDefinition =
  lessonOneHomeworkDefinition;
export const lessonContentFixtureHomeworkDefinitionLessonTwo: MethodologyLessonHomeworkDefinition =
  lessonTwoHomeworkDefinition;

const lessonOneStudentContent: MethodologyLessonStudentContent = {
  id: "methodology-student-content:world-around-me-01",
  methodologyLessonId: lessonOneMethodologyLesson.id,
  title: "Урок 1. Животные на ферме",
  subtitle: "Большое фермерское приключение: говорим, считаем, двигаемся и поём.",
  sections: [
    {
      type: "lesson_focus",
      title: "Урок 1 · Животные на ферме",
      subtitle: "Сегодня мы отправляемся на ферму вместе с Сяо Лоном и Сяо Мей.",
      body: "Поздороваемся, посмотрим видео и выучим первые слова про животных.",
      chips: ["狗", "猫", "兔子", "马"],
      tone: "sky",
      layout: "hero",
      illustrationSrc: "/methodologies/world-around-me/lesson-1/farm-scene.svg",
      sceneId: "scene-hero",
    },
    {
      type: "lesson_focus",
      title: "Что мы делаем сегодня",
      body: "Смотрим видео farm animals, считаем до 5, двигаемся по командам, работаем в тетради и поём песню.",
      chips: ["смотреть", "считать", "двигаться", "практиковать", "петь"],
      tone: "violet",
      layout: "roadmap",
      sceneId: "scene-roadmap",
    },
    {
      type: "vocabulary_cards",
      title: "Животные фермы",
      subtitle: "Смотри на карточку, слушай и повторяй слово.",
      tone: "amber",
      layout: "vocabulary",
      sceneId: "scene-vocabulary",
      items: [
        {
          term: "狗",
          pinyin: "gǒu",
          meaning: "собака",
          visualHint: "Скажи громко: gǒu!",
          illustrationSrc: "/methodologies/world-around-me/lesson-1/dog.svg",
        },
        {
          term: "猫",
          pinyin: "māo",
          meaning: "кошка",
          visualHint: "Покажи лапки, как у кошки.",
          illustrationSrc: "/methodologies/world-around-me/lesson-1/cat.svg",
        },
        {
          term: "兔子",
          pinyin: "tùzi",
          meaning: "кролик",
          visualHint: "Прыгни как кролик.",
          illustrationSrc: "/methodologies/world-around-me/lesson-1/rabbit.svg",
        },
        {
          term: "马",
          pinyin: "mǎ",
          meaning: "лошадь",
          visualHint: "Покажи, как скачет лошадка.",
          illustrationSrc: "/methodologies/world-around-me/lesson-1/horse.svg",
        },
      ],
    },
    {
      type: "phrase_cards",
      title: "Говорим по-китайски",
      subtitle: "Скажи о себе и покажи, кто на карточке.",
      tone: "violet",
      layout: "phrases",
      sceneId: "scene-phrases",
      items: [
        {
          phrase: "我是…",
          pinyin: "wǒ shì…",
          meaning: "Я…",
          usageHint: "Назови себя или выбранное животное.",
          example: "我是小猫。",
        },
        {
          phrase: "这是…",
          pinyin: "zhè shì…",
          meaning: "Это…",
          usageHint: "Покажи карточку и назови животное.",
          example: "这是狗。",
        },
      ],
    },
    {
      type: "lesson_focus",
      title: "Считаем до 5",
      subtitle: "Берём палочки и считаем вместе.",
      body: "Покажи животных в Приложении 1 указкой, посчитай и назови их вслух.",
      chips: ["1", "2", "3", "4", "5"],
      tone: "sky",
      layout: "counting",
      illustrationSrc: "/methodologies/world-around-me/lesson-1/counting.svg",
      sceneId: "scene-counting",
    },
    {
      type: "action_cards",
      title: "Движение и команды",
      subtitle: "Слушай команду и двигайся быстро.",
      tone: "emerald",
      layout: "movement",
      sceneId: "scene-movement",
      items: [
        {
          term: "跑",
          pinyin: "pǎo",
          meaning: "бежать",
          movementHint: "我们跑吧！ — 跑到狗！",
          illustrationSrc: "/methodologies/world-around-me/lesson-1/run.svg",
        },
        {
          term: "跳",
          pinyin: "tiào",
          meaning: "прыгать",
          movementHint: "我们跳吧！ — 跳到兔子！",
          illustrationSrc: "/methodologies/world-around-me/lesson-1/jump.svg",
        },
      ],
    },
    {
      type: "phrase_cards",
      title: "Ферма и где живут животные",
      subtitle: "Ставим игрушки в ферму и говорим полными фразами.",
      tone: "amber",
      layout: "farm",
      illustrationSrc: "/methodologies/world-around-me/lesson-1/barn.svg",
      sceneId: "scene-farm",
      items: [
        {
          phrase: "农场",
          pinyin: "nóngchǎng",
          meaning: "ферма",
          usageHint: "Покажи карточку фермы.",
        },
        {
          phrase: "在…里",
          pinyin: "zài…lǐ",
          meaning: "внутри / в",
          usageHint: "Скажи, где находится животное.",
          example: "猫住在农场里。",
        },
      ],
    },
    {
      type: "worksheet",
      title: "Закрепляем: тетрадь",
      subtitle: "Спокойная практика после активных игр.",
      tone: "amber",
      layout: "practice",
      sceneId: "scene-practice",
      illustrationSrc: "/methodologies/world-around-me/lesson-1/workbook.svg",
      pageLabel: "Рабочая тетрадь · стр. 3–4",
      instructions: "Раскрась животных и ответь: «这是什么？».",
      teacherHint: "Сначала раскрашиваем, потом показываем и называем вслух.",
      assetId: "worksheet:workbook-pages-3-4",
    },
    {
      type: "media_asset",
      title: "Заканчиваем песней farm animals",
      subtitle: "Поём и повторяем движения животных.",
      tone: "rose",
      layout: "practice",
      sceneId: "scene-practice",
      assetId: "song:farm-animals",
      assetKind: "song",
      studentPrompt: "Пой и двигайся вместе с группой.",
      teacherShareHint: "Если кнопки нет, песню включает преподаватель в классе.",
      ctaLabel: "Слушать песню",
    },
    {
      type: "recap",
      title: "Вспомнить дома",
      subtitle: "Короткий повтор перед домашним заданием.",
      tone: "neutral",
      layout: "recap",
      sceneId: "scene-recap",
      bullets: [
        "Назови 4 животных: 狗, 猫, 兔子, 马.",
        "Скажи: 我是…",
        "Скажи: 这是狗。 / 这是猫。",
        "Покажи 跑 и 跳.",
        "Скажи одну фразу с 农场 или 在…里.",
      ],
    },
  ],
};

const lessonTwoStudentContent: MethodologyLessonStudentContent = {
  id: "methodology-student-content:world-around-me-02",
  methodologyLessonId: lessonTwoMethodologyLesson.id,
  title: "Урок 2. Что это за животное?",
  subtitle: "Новые животные фермы: слушаем, угадываем, двигаемся и говорим фразами.",
  sections: [
    {
      type: "lesson_focus",
      title: "Урок 2 · Что это за животное?",
      subtitle: "Сяо Лон и Сяо Мей зовут нас на ферму знакомиться с новыми друзьями.",
      body: "Сегодня мы будем говорить, двигаться, угадывать звуки и играть с масками животных.",
      chips: ["鸭子", "鸡子", "羊", "牛"],
      tone: "sky",
      layout: "hero",
      illustrationSrc: "/methodologies/world-around-me/lesson-2/farm-scene-2.svg",
      sceneId: "scene-hero",
    },
    {
      type: "lesson_focus",
      title: "Что мы делаем сегодня",
      body: "Смотрим видео, угадываем звуки, хлопаем и считаем, играем с масками, делаем страницу 5 и поём.",
      chips: ["смотреть", "угадывать", "хлопать", "считать", "петь"],
      tone: "violet",
      layout: "roadmap",
      sceneId: "scene-roadmap",
    },
    {
      type: "vocabulary_cards",
      title: "Новые животные фермы",
      subtitle: "Слушай, повторяй и покажи карточку.",
      tone: "amber",
      layout: "vocabulary",
      sceneId: "scene-vocabulary",
      items: [
        {
          term: "鸭子",
          pinyin: "yāzi",
          meaning: "утка",
          visualHint: "Покажи крылышки и скажи: yāzi!",
          illustrationSrc: "/methodologies/world-around-me/lesson-2/duck.svg",
        },
        {
          term: "鸡子",
          pinyin: "jīzi",
          meaning: "курица",
          visualHint: "Скажи громко: jīzi!",
          illustrationSrc: "/methodologies/world-around-me/lesson-2/chicken.svg",
        },
        {
          term: "羊",
          pinyin: "yáng",
          meaning: "овца",
          visualHint: "Сложи руки как пушистую овечку.",
          illustrationSrc: "/methodologies/world-around-me/lesson-2/sheep.svg",
        },
        {
          term: "牛",
          pinyin: "niú",
          meaning: "корова",
          visualHint: "Покажи рога и скажи: niú!",
          illustrationSrc: "/methodologies/world-around-me/lesson-2/cow.svg",
        },
      ],
    },
    {
      type: "phrase_cards",
      title: "Говорим фразами",
      subtitle: "Скажи кто ты и что на карточке.",
      tone: "violet",
      layout: "phrases",
      sceneId: "scene-speaking",
      items: [
        {
          phrase: "我是…",
          pinyin: "wǒ shì…",
          meaning: "Я…",
          usageHint: "Выбери животное и представься.",
          example: "我是小羊。",
        },
        {
          phrase: "这是…",
          pinyin: "zhè shì…",
          meaning: "Это…",
          usageHint: "Покажи карточку и назови животное.",
          example: "这是鸭子。",
        },
      ],
    },
    {
      type: "lesson_focus",
      title: "Слушай звук и угадай",
      subtitle: "Какое животное так звучит?",
      body: "Слушай звук внимательно и отвечай: «这是…».",
      chips: ["слушай", "угадывай", "отвечай"],
      tone: "sky",
      layout: "practice",
      illustrationSrc: "/methodologies/world-around-me/lesson-2/sounds.svg",
      sceneId: "scene-sounds",
    },
    {
      type: "action_cards",
      title: "Двигаемся и считаем",
      subtitle: "跑 · 跳 · 拍手 · 数",
      tone: "emerald",
      layout: "movement",
      sceneId: "scene-actions",
      items: [
        {
          term: "跑",
          pinyin: "pǎo",
          meaning: "бежать",
          movementHint: "我们跑吧！",
          illustrationSrc: "/methodologies/world-around-me/lesson-1/run.svg",
        },
        {
          term: "跳",
          pinyin: "tiào",
          meaning: "прыгать",
          movementHint: "我们跳吧！",
          illustrationSrc: "/methodologies/world-around-me/lesson-1/jump.svg",
        },
        {
          term: "拍手",
          pinyin: "pāishǒu",
          meaning: "хлопать в ладоши",
          movementHint: "拍手吧！ 一、二、三、四、五。",
          illustrationSrc: "/methodologies/world-around-me/lesson-2/clap.svg",
        },
        {
          term: "数",
          pinyin: "shǔ",
          meaning: "считать",
          movementHint: "我们数吧！",
          illustrationSrc: "/methodologies/world-around-me/lesson-2/count.svg",
        },
      ],
    },
    {
      type: "lesson_focus",
      title: "Маски и команды",
      subtitle: "Играй роль животного и слушай команду.",
      body: "Надень маску и выполняй: «鸭子，跑吧！», «鸡子，拍手吧！».",
      chips: ["маска", "команда", "игра"],
      tone: "amber",
      layout: "practice",
      illustrationSrc: "/methodologies/world-around-me/lesson-2/masks.svg",
      sceneId: "scene-masks",
    },
    {
      type: "phrase_cards",
      title: "Домик и новые слова",
      subtitle: "我 · 你 · 房子 · 在…里",
      tone: "amber",
      layout: "farm",
      illustrationSrc: "/methodologies/world-around-me/lesson-2/house.svg",
      sceneId: "scene-house",
      items: [
        { phrase: "房子", pinyin: "fángzi", meaning: "дом", usageHint: "Покажи карточку домика." },
        { phrase: "我", pinyin: "wǒ", meaning: "я", usageHint: "Скажи о себе." },
        { phrase: "你", pinyin: "nǐ", meaning: "ты", usageHint: "Спроси друга: «你是谁？»." },
        {
          phrase: "在…里",
          pinyin: "zài…lǐ",
          meaning: "внутри / в",
          usageHint: "Покажи, кто находится в домике.",
          example: "我住在房子里。",
        },
      ],
    },
    {
      type: "worksheet",
      title: "Тетрадь и песня",
      subtitle: "Спокойное закрепление перед финалом.",
      tone: "rose",
      layout: "practice",
      sceneId: "scene-workbook-song",
      illustrationSrc: "/methodologies/world-around-me/lesson-2/workbook.svg",
      pageLabel: "Рабочая тетрадь · стр. 5",
      instructions:
        "Соедини числа с животными, назови их, а потом спой песню farm animals с группой.",
      teacherHint: "После задания попросите каждого ребёнка назвать одну пару «число + животное».",
      assetId: "worksheet:workbook-page-5",
    },
    {
      type: "recap",
      title: "Повтор дома",
      subtitle: "Мини-итог после урока.",
      tone: "neutral",
      layout: "recap",
      sceneId: "scene-home-review",
      bullets: [
        "Назови 4 животных: 鸭子, 鸡子, 羊, 牛.",
        "Скажи 2 фразы: 我是… и 这是…",
        "Покажи действия: 跑, 跳, 拍手.",
        "Скажи слово 数 и посчитай до 5.",
        "Произнеси: 我住在房子里。",
      ],
    },
  ],
};

export const lessonContentFixtureMethodologyLessonStudentContents: MethodologyLessonStudentContent[] =
  [lessonOneStudentContent, lessonTwoStudentContent];

export const lessonContentFixtureMethodologyLessonStudentContent: MethodologyLessonStudentContent =
  lessonOneStudentContent;
export const lessonContentFixtureMethodologyLessonStudentContentLessonTwo: MethodologyLessonStudentContent =
  lessonTwoStudentContent;

const lessonOneScheduledLesson: ScheduledLesson = {
  id: "scheduled-lesson:demo-world-around-me-lesson-1",
  methodologyLessonId: lessonOneMethodologyLesson.id,
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

const lessonTwoScheduledLesson: ScheduledLesson = {
  id: "scheduled-lesson:demo-world-around-me-lesson-2",
  methodologyLessonId: lessonTwoMethodologyLesson.id,
  runtimeShell: {
    id: "runtime-shell:demo-world-around-me-lesson-2",
    classId: "3f8e9cf9-66f2-4fb9-9504-9f708b67e952",
    startsAt: "2026-04-14T15:00:00.000Z",
    format: "offline",
    place: "Demo classroom A",
    runtimeStatus: "planned",
    runtimeNotesSummary: "Подготовить звуки животных, маски и игрушечный дом.",
  },
  runtimeNotes:
    "Следить, чтобы в масочной игре каждый ребёнок выполнил минимум две команды.",
  outcomeNotes: "",
};

export const lessonContentFixtureScheduledLessons: ScheduledLesson[] = [
  lessonOneScheduledLesson,
  lessonTwoScheduledLesson,
];

export const lessonContentFixtureScheduledLesson: ScheduledLesson =
  lessonOneScheduledLesson;
export const lessonContentFixtureScheduledLessonLessonTwo: ScheduledLesson =
  lessonTwoScheduledLesson;

type FixtureLessonCandidateInput = {
  methodologySlug?: string;
  lessonTitle?: string;
  moduleIndex?: number;
  lessonIndex?: number;
};

function normalizeLessonTitle(value: string | undefined) {
  return value?.trim().toLowerCase().replace(/\s+/g, " ") ?? "";
}

function resolveFixtureLessonByIdentity(input: FixtureLessonCandidateInput) {
  if (input.methodologySlug !== lessonContentFixtureMethodology.slug) return null;

  const byPosition =
    input.moduleIndex && input.lessonIndex
      ? lessonContentFixtureMethodologyLessons.find(
          (lesson) =>
            lesson.shell.position.moduleIndex === input.moduleIndex &&
            lesson.shell.position.lessonIndex === input.lessonIndex,
        )
      : null;

  if (byPosition) return byPosition;

  const normalizedTitle = normalizeLessonTitle(input.lessonTitle);
  if (!normalizedTitle) return null;

  return (
    lessonContentFixtureMethodologyLessons.find(
      (lesson) => normalizeLessonTitle(lesson.shell.title) === normalizedTitle,
    ) ?? null
  );
}

export function getFixtureStudentContentFallback(input: FixtureLessonCandidateInput) {
  const fixtureLesson = resolveFixtureLessonByIdentity(input);
  if (!fixtureLesson) return null;

  const source = lessonContentFixtureMethodologyLessonStudentContents.find(
    (item) => item.methodologyLessonId === fixtureLesson.id,
  );
  if (!source) return null;

  const neededAssetIds = new Set(
    source.sections.flatMap((section) => {
      if (section.type === "media_asset") return [section.assetId];
      if (section.type === "worksheet" && section.assetId) return [section.assetId];
      return [];
    }),
  );

  return {
    source,
    assets: lessonContentFixtureAssets.filter((asset) => neededAssetIds.has(asset.id)),
  };
}
