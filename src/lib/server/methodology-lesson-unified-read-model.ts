import type {
  MethodologyLessonHomeworkDefinition,
  MethodologyLessonShell,
  MethodologyLessonStudentContent,
  MethodologyLessonStudentContentSection,
  ReusableAsset,
} from "@/lib/lesson-content";
import type { TeacherLessonWorkspacePresentation } from "@/lib/server/teacher-lesson-workspace";

export type MethodologyLessonStep = {
  id: string;
  order: number;
  title: string;
  phase?: "opening" | "language_input" | "active_practice" | "consolidation" | "closure";
  durationMinutes?: number | null;
  movementMode?: "calm" | "active" | "table" | "song" | "mixed" | null;
  resourceIds?: string[];
  teacher: {
    goal?: string | null;
    description?: string | null;
    teacherActions: string[];
    studentActions: string[];
    teacherScript?: string[];
    expectedResponses?: string[];
    materials: string[];
    successCriteria?: string[];
    notes?: string[];
  };
  student: {
    screenType:
      | "intro"
      | "video"
      | "presentation"
      | "flashcards"
      | "phrase_practice"
      | "counting"
      | "movement"
      | "worksheet"
      | "farm_placement"
      | "song"
      | "placeholder";
    title: string;
    instruction?: string;
    assetIds?: string[];
    payload?: {
      sections?: MethodologyLessonStudentContentSection[];
      chips?: string[];
    };
    allowStudentInteraction?: boolean;
  };
};

export type MethodologyLessonUnifiedReadModel = {
  lesson: {
    id: string;
    title: string;
    moduleIndex: number;
    lessonIndex: number;
    durationMinutes: number;
    durationLabel: string;
  };
  quickSummary: TeacherLessonWorkspacePresentation["quickSummary"];
  steps: MethodologyLessonStep[];
  assetsById: Record<string, ReusableAsset>;
  canonicalHomework: MethodologyLessonHomeworkDefinition | null;
};

type LessonFlowStep = TeacherLessonWorkspacePresentation["lessonFlow"][number];

type WorldAroundMeLessonOneCanonicalStep = {
  order: number;
  title: string;
  teacherFlowOrder: number;
  studentInstruction: string;
  selectSection?: (section: MethodologyLessonStudentContentSection) => boolean;
  explicitResourceIds?: string[];
  forcedScreenType?: MethodologyLessonStep["student"]["screenType"];
  transformSelectedSection?: (section: MethodologyLessonStudentContentSection) => MethodologyLessonStudentContentSection;
};

const lessonOneTeacherFallbackByOrder: Record<number, Omit<MethodologyLessonStep["teacher"], "description"> & {
  description?: string;
  durationMinutes: number;
  movementMode: NonNullable<MethodologyLessonStep["movementMode"]>;
}> = {
  1: {
    goal: "Мягко включить детей в урок и создать безопасный ритуал старта.",
    description: "Приветствие детей и героев курса, вход в тему фермы.",
    teacherActions: ["Приветствует детей и героев курса.", "Обозначает: сегодня идём на ферму и знакомимся с животными."],
    studentActions: ["Приветствуют педагога.", "Смотрят на героев курса и включаются в ритуал."],
    teacherScript: ["你好！\nNǐ hǎo!\nПривет!", "今天我们去农场。\nJīntiān wǒmen qù nóngchǎng.\nСегодня мы идём на ферму."],
    expectedResponses: ["你好！"],
    materials: ["герои курса"],
    successCriteria: ["Дети эмоционально включены в урок за 1–2 минуты."],
    notes: ["Поддерживайте тёплый тон и короткий темп входа."],
    durationMinutes: 3,
    movementMode: "calm",
  },
  2: {
    goal: "Дать первое аудио-визуальное знакомство с животными фермы.",
    description: "Видео-вход с короткими повторами слов за педагогом.",
    teacherActions: ["Включает видео farm animals.", "Просит слушать и находить животных.", "При необходимости ставит короткие паузы на ключевых кадрах."],
    studentActions: ["Смотрят видео.", "Повторяют 1–2 слова за педагогом."],
    teacherScript: ["这是狗。\nZhè shì gǒu.\nЭто собака.", "这是猫。\nZhè shì māo.\nЭто кошка."],
    expectedResponses: ["狗", "猫", "兔子", "马"],
    materials: ["video:farm-animals"],
    successCriteria: ["Дети распознают минимум 2 животных по звуку или изображению."],
    notes: ["Короткие паузы делайте только для усиления внимания, без долгих объяснений."],
    durationMinutes: 3,
    movementMode: "calm",
  },
  3: {
    goal: "Ввести первый персональный паттерн речи «你是谁？— 我是…».",
    description: "Круг знакомства с опорой на героев курса.",
    teacherActions: ["Садится с детьми в круг.", "Показывает на себя и героя, моделирует «我是…».", "Задаёт каждому ребёнку вопрос «你是谁？」."],
    studentActions: ["Показывают на себя или персонажа.", "Отвечают с опорой на модель."],
    teacherScript: ["我是…\nWǒ shì…\nЯ…", "你是谁？\nNǐ shì shéi?\nКто ты?", "我是小龙。\nWǒ shì Xiǎo Lóng.\nЯ Сяо Лон."],
    expectedResponses: ["我是…"],
    materials: ["герои курса"],
    successCriteria: ["Большинство детей повторяет «我是…» с поддержкой педагога."],
    notes: ["Если ребёнок стесняется, разрешите ответить вместе с героем курса."],
    durationMinutes: 3,
    movementMode: "calm",
  },
  4: {
    goal: "Связать визуальный образ карточки с китайским словом и моделью «这是…».",
    description: "Карточки животных в два прохода: слово → фраза.",
    teacherActions: ["Показывает карточки 狗, 猫, 兔子, 马 по одной.", "Первый проход: произносит только слово.", "Второй проход: произносит полные фразы с «这是…»."],
    studentActions: ["Повторяют слова.", "Повторяют короткие фразы «这是…»."],
    teacherScript: ["狗。\nGǒu.\nСобака.", "猫。\nMāo.\nКошка.", "兔子。\nTùzi.\nКролик.", "马。\nMǎ.\nЛошадь.", "这是狗。\nZhè shì gǒu.\nЭто собака.", "这是猫。\nZhè shì māo.\nЭто кошка.", "这是兔子。\nZhè shì tùzi.\nЭто кролик.", "这是马。\nZhè shì mǎ.\nЭто лошадь."],
    expectedResponses: ["狗 / 猫 / 兔子 / 马", "这是狗。/ 这是猫。/ 这是兔子。/ 这是马。"],
    materials: ["карточки 狗, 猫, 兔子, 马", "flashcards:world-around-me-lesson-1"],
    successCriteria: ["Дети сопоставляют минимум 3 карточки со словами."],
    notes: ["Держите карточки на уровне глаз детей и меняйте порядок показа."],
    durationMinutes: 4,
    movementMode: "mixed",
  },
  5: {
    goal: "Подключить телесный канал для запоминания слов.",
    description: "Дети изображают животных по команде.",
    teacherActions: ["Даёт команду и показывает пример движения.", "Быстро меняет животных."],
    studentActions: ["Изображают походку и звук животного.", "Реагируют на смену команды."],
    teacherScript: ["我是狗。\nWǒ shì gǒu.\nЯ собачка.", "我是猫。\nWǒ shì māo.\nЯ кошка."],
    expectedResponses: ["我是狗。", "我是猫。"],
    materials: ["карточки животных", "свободное пространство для движения"],
    successCriteria: ["Дети связывают слово животного с телесным действием."],
    notes: ["Контролируйте безопасную дистанцию."],
    durationMinutes: 3,
    movementMode: "active",
  },
  6: {
    goal: "Тренировать скорость реакции и понимание команд.",
    description: "Игра с карточками и мячом на быстрое узнавание.",
    teacherActions: ["Крепит карточки животных на стену малярным скотчем.", "Называет животное — ребёнок бросает мяч в нужную карточку.", "После броска просит назвать карточку словом или фразой «这是…»."],
    studentActions: ["Попадают мячом в нужную карточку.", "Произносят слово или короткую фразу."],
    teacherScript: ["狗！\nGǒu!\nСобака!", "猫！\nMāo!\nКошка!", "这是什么？\nZhè shì shénme?\nЧто это?"],
    expectedResponses: ["狗 / 猫 / 兔子 / 马", "这是狗。"],
    materials: ["малярный скотч", "карточки 狗, 猫, 兔子, 马", "мяч"],
    successCriteria: ["Дети выбирают правильную карточку по звучащему слову."],
    notes: ["Соблюдайте безопасную дистанцию между детьми."],
    durationMinutes: 4,
    movementMode: "active",
  },
  7: {
    goal: "Ввести счёт 1–5 в связке с предметным действием.",
    description: "Счётные палочки и синхронное проговаривание.",
    teacherActions: ["Показывает количество палочек.", "Ведёт счёт вместе с детьми."],
    studentActions: ["Считают вслух.", "Показывают нужное количество."],
    teacherScript: ["一、二、三、四、五。\nYī, èr, sān, sì, wǔ.\nОдин, два, три, четыре, пять."],
    expectedResponses: ["一、二、三、四、五"],
    materials: ["палочки для счёта"],
    successCriteria: ["Группа считает до 5 вместе в одном ритме."],
    notes: ["Не усложняйте шаг классификаторами: сохраняйте простой счёт до 5."],
    durationMinutes: 3,
    movementMode: "table",
  },
  8: {
    goal: "Закрепить счёт и лексику на задании из приложения.",
    description: "Работа по Приложению 1 с подсчётом животных.",
    teacherActions: ["Открывает приложение и задаёт вопросы по картинке.", "Проверяет ответы фронтально."],
    studentActions: ["Считают животных в приложении.", "Произносят число и животное."],
    teacherScript: ["Покажи 狗.", "Сколько здесь животных?", "这是什么？\nZhè shì shénme?\nЧто это?"],
    expectedResponses: ["狗 / 猫 / 兔子 / 马"],
    materials: ["Приложение 1", "указка"],
    successCriteria: ["Дети показывают и называют животных с опорой педагога."],
    notes: ["Дайте 20–30 секунд на самостоятельный поиск."],
    durationMinutes: 4,
    movementMode: "table",
  },
  9: {
    goal: "Ввести глаголы движения 跑 и 跳.",
    description: "Команды с демонстрацией и повтором.",
    teacherActions: ["Показывает движения для 跑 и 跳.", "Чередует команды в разном темпе."],
    studentActions: ["Повторяют глаголы.", "Выполняют правильное движение."],
    teacherScript: ["跑。\nPǎo.\nБежать.", "跳。\nTiào.\nПрыгать.", "我们跑吧！\nWǒmen pǎo ba!\nДавайте побегаем!", "我们跳吧！\nWǒmen tiào ba!\nДавайте попрыгаем!"],
    expectedResponses: ["跑", "跳"],
    materials: ["свободное пространство для движения"],
    successCriteria: ["Ученики различают оба глагола на слух."],
    notes: ["Сначала медленно, потом в игровом темпе."],
    durationMinutes: 3,
    movementMode: "active",
  },
  10: {
    goal: "Соединить лексику животных и действия в движении.",
    description: "Дети бегут/прыгают к нужному животному.",
    teacherActions: ["Даёт комбинированные команды.", "Отмечает точные и быстрые реакции."],
    studentActions: ["Двигаются к карточкам животных.", "Выполняют действие по команде."],
    teacherScript: ["跑到狗！\nPǎo dào gǒu!\nБеги к собаке!", "跳到兔子！\nTiào dào tùzi!\nПрыгай к кролику!", "跑到马！\nPǎo dào mǎ!\nБеги к лошади!", "跳到猫！\nTiào dào māo!\nПрыгай к кошке!"],
    expectedResponses: ["Точное движение к правильной игрушке с правильным действием."],
    materials: ["мягкие игрушки: собака, кот, кролик, лошадь", "свободное пространство для движения"],
    successCriteria: ["Дети корректно реагируют на комбинированные команды движения + животное."],
    notes: ["Разведите карточки по разным зонам класса."],
    durationMinutes: 4,
    movementMode: "active",
  },
  11: {
    goal: "Развивать мини-высказывание о действии животного.",
    description: "Вопрос-ответ о действии игрушечного животного с моделью 在.",
    teacherActions: ["Показывает мягкими игрушками бег и прыжки.", "Задаёт вопрос: «狗在做什么？».", "Моделирует короткий ответ и просит повторить."],
    studentActions: ["Наблюдают действие игрушки.", "Отвечают словом или короткой фразой."],
    teacherScript: ["狗在做什么？\nGǒu zài zuò shénme?\nЧто делает собака?", "狗在跳。\nGǒu zài tiào.\nСобака прыгает.", "猫在跑。\nMāo zài pǎo.\nКошка бежит."],
    expectedResponses: ["狗在跳。", "猫在跑。"],
    materials: ["мягкие игрушки: собака, кот, кролик, лошадь"],
    successCriteria: ["Дети отвечают действием + животным с поддержкой педагога."],
    notes: ["Слабым ученикам разрешите одно слово + жест."],
    durationMinutes: 3,
    movementMode: "mixed",
  },
  12: {
    goal: "Перенести изученное в письменно-визуальную практику.",
    description: "Задания рабочей тетради на стр. 3–4.",
    teacherActions: ["Открывает рабочую тетрадь на страницах 3–4.", "Просит раскрасить животных.", "Во время проверки задаёт вопрос «这是什么？」."],
    studentActions: ["Раскрашивают животных.", "Называют животное на рисунке."],
    teacherScript: ["Откройте страницы 3–4.", "Раскрасьте животных.", "这是什么？\nZhè shì shénme?\nЧто это?"],
    expectedResponses: ["这是狗。", "这是猫。", "这是兔子。", "这是马。"],
    materials: ["рабочая тетрадь, страницы 3–4", "карандаши"],
    successCriteria: ["Дети устно называют раскрашенных животных."],
    notes: ["Оставьте 30 секунд на самопроверку."],
    durationMinutes: 3,
    movementMode: "table",
  },
  13: {
    goal: "Зафиксировать слово 农场 в активном словаре.",
    description: "Ввод слова «ферма» как места для всей темы урока.",
    teacherActions: ["Показывает карточку фермы.", "Проговаривает слово медленно и чётко.", "Делает хоровой повтор."],
    studentActions: ["Повторяют слово.", "Показывают карточку фермы."],
    teacherScript: ["农场。\nNóngchǎng.\nФерма.", "这是农场。\nZhè shì nóngchǎng.\nЭто ферма."],
    expectedResponses: ["农场"],
    materials: ["карточка 农场 из набора flashcards:world-around-me-lesson-1"],
    successCriteria: ["Ученики узнают и произносят слово 农场."],
    notes: ["Сделайте 2–3 коротких повтора в разном темпе."],
    durationMinutes: 2,
    movementMode: "calm",
  },
  14: {
    goal: "Связать животных с местом через модель «在…里».",
    description: "Игрушечная ферма: размещаем животных и проговариваем короткие фразы.",
    teacherActions: ["Размещает животных внутри/на ферме.", "Моделирует короткие фразы с 在…里.", "Организует повтор детьми."],
    studentActions: ["Ставят игрушки на ферму и в ферму.", "Повторяют короткую фразу по образцу."],
    teacherScript: ["猫住在农场里。\nMāo zhù zài nóngchǎng lǐ.\nКошка живёт на ферме.", "马在农场里。\nMǎ zài nóngchǎng lǐ.\nЛошадь на ферме.", "狗在农场里。\nGǒu zài nóngchǎng lǐ.\nСобака на ферме."],
    expectedResponses: ["猫在农场里。", "狗在农场里。"],
    materials: ["игрушечная ферма", "мягкие игрушки: собака, кот, кролик, лошадь"],
    successCriteria: ["Дети понимают идею «внутри фермы» и повторяют модель 在…里."],
    notes: ["Попросите 1–2 учеников объяснить выбор вслух."],
    durationMinutes: 3,
    movementMode: "mixed",
  },
  15: {
    goal: "Снять напряжение и закрепить лексику через песню.",
    description: "Эмоциональное закрытие через знакомую песню и движения.",
    teacherActions: ["Включает аудио песни farm animals.", "При желании использует видео движений как подсказку педагогу.", "Поёт и двигается вместе с детьми."],
    studentActions: ["Поют или подпевают.", "Повторяют движения песни."],
    teacherScript: ["Поём вместе!", "听一听，唱一唱。\nTīng yi tīng, chàng yi chàng.\nПослушаем и споём."],
    expectedResponses: ["Дети поют или включаются в движения."],
    materials: ["song:farm-animals", "song-video:farm-animals-movement"],
    successCriteria: ["Ученики активно участвуют в подпевании."],
    notes: ["Сократите до припева, если осталось мало времени."],
    durationMinutes: 2,
    movementMode: "song",
  },
  16: {
    goal: "Подвести итог и завершить урок на позитиве.",
    description: "Короткий recap и прощание.",
    teacherActions: ["Просит каждого ребёнка назвать одно слово или действие урока.", "Прощается с детьми и героями курса."],
    studentActions: ["Называют слово или короткую фразу.", "Прощаются с педагогом и героями."],
    teacherScript: ["Что запомнили?", "再见！\nZàijiàn!\nДо свидания!"],
    expectedResponses: ["狗 / 猫 / 兔子 / 马 / 农场 / 跑 / 跳", "再见！"],
    materials: ["герои курса"],
    successCriteria: ["Каждый ребёнок участвует в ритуале завершения."],
    notes: ["Завершите урок спокойным ритуалом."],
    durationMinutes: 1,
    movementMode: "calm",
  },
};

const worldAroundMeLessonOneCanonicalSteps: WorldAroundMeLessonOneCanonicalStep[] = [
  {
    order: 1,
    title: "Смотрим видео «farm animals»",
    teacherFlowOrder: 2,
    studentInstruction: "Посмотри видео и повтори названия животных.",
    selectSection: (section) =>
      section.type === "media_asset" &&
      section.assetId === "video:farm-animals",
    explicitResourceIds: ["video:farm-animals"],
    forcedScreenType: "video",
  },
  { order: 2, title: "Учим фразу 我是…", teacherFlowOrder: 3, studentInstruction: "Повтори фразу 我是… и ответь на вопрос 你是谁？.", selectSection: (section) => section.sceneId === "scene-phrases" && section.type === "phrase_cards" },
  { order: 3, title: "Учим слова 狗，猫，兔子，马", teacherFlowOrder: 4, studentInstruction: "Посмотри карточки животных и повтори слова.", selectSection: (section) => section.sceneId === "scene-flashcards" && section.type === "vocabulary_cards", explicitResourceIds: ["flashcards:world-around-me-lesson-1"] },
  { order: 4, title: "Изображаем животных", teacherFlowOrder: 5, studentInstruction: "Изобрази животное и повтори 我是… по модели педагога." },
  {
    order: 5,
    title: "Игра с мячом у стены",
    teacherFlowOrder: 6,
    studentInstruction: "Слушай команду и выбери нужную карточку.",
    selectSection: (section) => section.sceneId === "scene-homework-practice" && section.type === "matching_practice",
    transformSelectedSection: (section) => {
      if (section.type !== "matching_practice") return section;
      return {
        ...section,
        title: "Игра с карточками",
        subtitle: "Тренируем внимание и скорость реакции.",
        prompt: "Найди пару картинка ↔ слово по команде преподавателя.",
      };
    },
  },
  { order: 6, title: "Счётные палочки", teacherFlowOrder: 7, studentInstruction: "Считай до пяти вместе с педагогом." },
  { order: 7, title: "Приложение 1: указываем, считаем и называем животных", teacherFlowOrder: 8, studentInstruction: "Покажи, посчитай и назови животных в Приложении 1.", selectSection: (section) => section.sceneId === "scene-counting" && section.type === "count_board", explicitResourceIds: ["worksheet:appendix-1"] },
  { order: 8, title: "Учим глаголы 跑，跳", teacherFlowOrder: 9, studentInstruction: "Выполняй команды с 跑 и 跳 вместе с педагогом.", selectSection: (section) => section.sceneId === "scene-actions" && section.type === "action_cards" },
  { order: 9, title: "Команды с мягкими игрушками", teacherFlowOrder: 10, studentInstruction: "Беги или прыгай к нужной игрушке по команде педагога." },
  { order: 10, title: "Отрабатываем 跑，跳 на мягких игрушках", teacherFlowOrder: 11, studentInstruction: "Ответь, что делает животное." },
  { order: 11, title: "Рабочая тетрадь, страницы 3–4", teacherFlowOrder: 12, studentInstruction: "Открой рабочую тетрадь на страницах 3–4 и назови животных.", selectSection: (section) => section.sceneId === "scene-materials" && section.type === "worksheet", explicitResourceIds: ["worksheet:workbook-pages-3-4"] },
  {
    order: 12,
    title: "Учим слово 农场",
    teacherFlowOrder: 13,
    studentInstruction: "Повтори слово 农场 и найди его в словаре урока.",
    selectSection: (section) => section.sceneId === "scene-review" && section.type === "word_list",
    transformSelectedSection: (section) => {
      if (section.type !== "word_list") return section;
      return {
        ...section,
        title: "Слово 农场",
        groups: section.groups
          .map((group) => ({
            ...group,
            entries: group.entries.filter((entry) => entry.hanzi === "农场"),
          }))
          .filter((group) => group.entries.length > 0),
      };
    },
  },
  { order: 13, title: "Игрушечная ферма и конструкция 在…里", teacherFlowOrder: 14, studentInstruction: "Скажи, кто находится на ферме, используя 在…里.", selectSection: (section) => section.sceneId === "scene-farm" && section.type === "farm_placement" },
  {
    order: 14,
    title: "Поём песню «Животные на ферме»",
    teacherFlowOrder: 15,
    studentInstruction: "Послушай и спой песню про животных фермы.",
    selectSection: (section) => section.sceneId === "scene-materials" && section.type === "resource_links",
    explicitResourceIds: ["song:farm-animals"],
    forcedScreenType: "song",
    transformSelectedSection: (section) => {
      if (section.type !== "resource_links") return section;
      return {
        ...section,
        resources: section.resources.filter((resource) => resource.assetId === "song:farm-animals"),
      };
    },
  },
  { order: 15, title: "Прощаемся с детьми и героями курса", teacherFlowOrder: 16, studentInstruction: "Попрощайся и повтори слова урока.", selectSection: (section) => section.sceneId === "scene-review" && section.type === "recap" },
];

function isWorldAroundMeLessonOne(lessonShell: MethodologyLessonShell) {
  return lessonShell.position.moduleIndex === 1 && lessonShell.position.lessonIndex === 1;
}

function stepPhase(order: number): MethodologyLessonStep["phase"] {
  if (order <= 2) return "opening";
  if (order <= 4) return "language_input";
  if (order <= 11) return "active_practice";
  if (order <= 14) return "consolidation";
  return "closure";
}

function screenTypeFromSections(sections: MethodologyLessonStudentContentSection[]) {
  const types = new Set(sections.map((section) => section.type));
  if (types.has("media_asset")) return "video" as const;
  if (types.has("presentation")) return "presentation" as const;
  if (types.has("vocabulary_cards")) return "flashcards" as const;
  if (types.has("phrase_cards")) return "phrase_practice" as const;
  if (types.has("count_board")) return "counting" as const;
  if (types.has("action_cards") || types.has("matching_practice")) return "movement" as const;
  if (types.has("worksheet")) return "worksheet" as const;
  if (types.has("farm_placement")) return "farm_placement" as const;
  if (types.has("lesson_focus")) return "intro" as const;
  if (types.has("resource_links")) return "song" as const;
  return "placeholder" as const;
}

function instructionFromSection(section?: MethodologyLessonStudentContentSection): string {
  if (!section) return "Следуйте инструкции преподавателя.";
  if (section.type === "lesson_focus") return section.body;
  if (section.type === "media_asset") return section.studentPrompt;
  if (section.type === "count_board") return section.prompt;
  if (section.type === "matching_practice") return section.prompt;
  if (section.type === "worksheet") return section.instructions;
  if (section.subtitle) return section.subtitle;
  return "Следуйте инструкции преподавателя.";
}

function collectSectionAssetIds(section: MethodologyLessonStudentContentSection): string[] {
  if (section.type === "media_asset") return [section.assetId];
  if (section.type === "presentation") return [section.assetId];
  if (section.type === "worksheet" && section.assetId) return [section.assetId];
  if (section.type === "count_board" && section.assetId) return [section.assetId];
  if (section.type === "resource_links") {
    return section.resources
      .map((resource) => resource.assetId)
      .filter((id): id is string => Boolean(id));
  }
  return [];
}

function makeSectionSelectionKey(section: MethodologyLessonStudentContentSection, index: number) {
  if (section.sceneId?.trim()) {
    return `${section.sceneId.trim()}::${section.type}::${section.title}::${index}`;
  }
  return `idx:${index}`;
}

function findAndClaimSection(input: {
  source: MethodologyLessonStudentContent | null;
  usedSectionKeys: Set<string>;
  predicate: (section: MethodologyLessonStudentContentSection) => boolean;
  transform?: (section: MethodologyLessonStudentContentSection) => MethodologyLessonStudentContentSection;
}) {
  if (!input.source) return null;
  for (const [index, section] of input.source.sections.entries()) {
    const key = makeSectionSelectionKey(section, index);
    if (input.usedSectionKeys.has(key)) continue;
    if (!input.predicate(section)) continue;
    input.usedSectionKeys.add(key);
    return input.transform ? input.transform(section) : section;
  }
  return null;
}

function resolveLegacyResourceIdsByTitle(input: {
  step: LessonFlowStep;
  assetsById: Record<string, ReusableAsset>;
}) {
  return input.step.resources
    .map((resource) =>
      Object.values(input.assetsById).find((asset) => asset.title === resource.title)
        ?.id,
    )
    .filter((id): id is string => Boolean(id));
}

function makeUnique(items: string[] | undefined, fallback: string[]) {
  const source = items && items.length ? items : fallback;
  return Array.from(
    new Set(
      source.filter((item) => {
        const value = item.trim();
        if (!value) return false;
        if (value === "…" || value === "...") return false;
        if (/^[,.;:!?\-\s]+$/.test(value)) return false;
        if (/^фраза\s+[.…]+$/i.test(value)) return false;
        if (/^фокус:\s*[,.\s]*$/i.test(value)) return false;
        if (/^карточки\s*[,.\s]*$/i.test(value)) return false;
        return true;
      }),
    ),
  );
}

function buildTeacherSideForCanonicalStep(input: {
  canonicalStep: WorldAroundMeLessonOneCanonicalStep;
  lessonFlow: LessonFlowStep[];
}) {
  const matched = input.lessonFlow.find(
    (step) =>
      step.order === input.canonicalStep.teacherFlowOrder &&
      !step.blockLabel.toLowerCase().includes("подготов"),
  );
  const fallback = lessonOneTeacherFallbackByOrder[input.canonicalStep.teacherFlowOrder];
  return {
    goal: fallback.goal ?? matched?.description ?? null,
    description: fallback.description ?? matched?.description ?? null,
    teacherActions: makeUnique(fallback.teacherActions, matched?.teacherActions ?? []),
    studentActions: makeUnique(fallback.studentActions, matched?.studentActions ?? []),
    expectedResponses: makeUnique(
      fallback.expectedResponses ?? [],
      matched?.pedagogicalDetails?.expectedStudentResponses ?? [],
    ),
    teacherScript: makeUnique(
      fallback.teacherScript ?? [],
      matched?.pedagogicalDetails?.promptPatterns ?? [],
    ),
    materials: makeUnique(fallback.materials, matched?.materials ?? []),
    successCriteria: makeUnique(
      fallback.successCriteria ?? [],
      matched?.pedagogicalDetails?.successCriteria ?? [],
    ),
    notes: makeUnique(
      fallback.notes ?? [],
      [
        matched?.pedagogicalDetails?.fallbackRu,
        matched?.pedagogicalDetails?.homeExtension,
        matched?.pedagogicalDetails?.exitCheck,
      ].filter((item): item is string => Boolean(item)),
    ),
  } satisfies MethodologyLessonStep["teacher"];
}

function buildWorldAroundMeLessonOneSteps(input: {
  lessonFlow: LessonFlowStep[];
  studentContent: MethodologyLessonStudentContent | null;
  usedSectionKeys: Set<string>;
  assetsById: Record<string, ReusableAsset>;
}) {
  return worldAroundMeLessonOneCanonicalSteps.map((canonicalStep) => {
    const selectedSection = canonicalStep.selectSection
      ? findAndClaimSection({
          source: input.studentContent,
          usedSectionKeys: input.usedSectionKeys,
          predicate: canonicalStep.selectSection,
          transform: canonicalStep.transformSelectedSection,
        })
      : null;

    const sections = selectedSection ? [selectedSection] : [];
    const sectionAssetIds = sections.flatMap(collectSectionAssetIds);

    const resourceIds = Array.from(
      new Set([...(canonicalStep.explicitResourceIds ?? []), ...sectionAssetIds]),
    );

    const teacher = buildTeacherSideForCanonicalStep({
      canonicalStep,
      lessonFlow: input.lessonFlow,
    });

    const studentInstruction =
      sections.length > 0
        ? instructionFromSection(sections[0])
        : canonicalStep.studentInstruction;

    const screenType =
      canonicalStep.forcedScreenType ?? screenTypeFromSections(sections);

    return {
      id: `canonical-world-around-me-lesson-1-step-${canonicalStep.order}`,
      order: canonicalStep.order,
      title: canonicalStep.title,
      phase: stepPhase(canonicalStep.order),
      durationMinutes: lessonOneTeacherFallbackByOrder[canonicalStep.teacherFlowOrder].durationMinutes,
      movementMode: lessonOneTeacherFallbackByOrder[canonicalStep.teacherFlowOrder].movementMode,
      resourceIds,
      teacher,
      student: {
        screenType,
        title: canonicalStep.title,
        instruction: studentInstruction,
        assetIds: resourceIds,
        payload: sections.length
          ? {
              sections,
              chips:
                sections[0]?.type === "lesson_focus" ? sections[0].chips : undefined,
            }
          : undefined,
        allowStudentInteraction: screenType !== "placeholder",
      },
    } satisfies MethodologyLessonStep;
  });
}

function buildGenericUnifiedSteps(input: {
  lessonFlow: LessonFlowStep[];
  studentContent: MethodologyLessonStudentContent | null;
  assetsById: Record<string, ReusableAsset>;
}) {
  const usedSectionKeys = new Set<string>();

  return input.lessonFlow
    .filter((step) => !step.blockLabel.toLowerCase().includes("подготов"))
    .map((step, index) => {
      const section = findAndClaimSection({
        source: input.studentContent,
        usedSectionKeys,
        predicate: () => true,
      });

      const sections = section ? [section] : [];
      const sectionAssetIds = sections.flatMap(collectSectionAssetIds);
      const legacyResourceIds =
        sectionAssetIds.length > 0
          ? []
          : resolveLegacyResourceIdsByTitle({ step, assetsById: input.assetsById });

      const resourceIds = Array.from(new Set([...sectionAssetIds, ...legacyResourceIds]));
      const screenType = screenTypeFromSections(sections);

      return {
        id: step.id,
        order: index + 1,
        title: step.title,
        phase: stepPhase(index + 1),
        durationMinutes: null,
        movementMode: null,
        resourceIds,
        teacher: {
          goal: step.description ?? null,
          description: step.description ?? null,
          teacherActions: step.teacherActions,
          studentActions: step.studentActions,
          expectedResponses: step.pedagogicalDetails?.expectedStudentResponses,
          teacherScript: step.pedagogicalDetails?.promptPatterns,
          materials: step.materials,
          successCriteria: step.pedagogicalDetails?.successCriteria,
          notes: [
            step.pedagogicalDetails?.fallbackRu,
            step.pedagogicalDetails?.homeExtension,
            step.pedagogicalDetails?.exitCheck,
          ].filter((item): item is string => Boolean(item)),
        },
        student: {
          screenType,
          title: step.title,
          instruction: instructionFromSection(sections[0]),
          assetIds: resourceIds,
          payload: sections.length ? { sections } : undefined,
          allowStudentInteraction: screenType !== "placeholder",
        },
      } satisfies MethodologyLessonStep;
    });
}

export function buildMethodologyLessonUnifiedReadModel(input: {
  lessonId: string;
  lessonShell: MethodologyLessonShell;
  presentation: Pick<
    TeacherLessonWorkspacePresentation,
    "quickSummary" | "lessonFlow"
  >;
  studentContent: MethodologyLessonStudentContent | null;
  assetsById: Record<string, ReusableAsset>;
  canonicalHomework: MethodologyLessonHomeworkDefinition | null;
}): MethodologyLessonUnifiedReadModel {
  const baseLessonFlow = input.presentation.lessonFlow.filter(
    (step) => !step.blockLabel.toLowerCase().includes("подготов"),
  );

  const steps = isWorldAroundMeLessonOne(input.lessonShell)
    ? buildWorldAroundMeLessonOneSteps({
        lessonFlow: baseLessonFlow,
        studentContent: input.studentContent,
        usedSectionKeys: new Set<string>(),
        assetsById: input.assetsById,
      })
    : buildGenericUnifiedSteps({
        lessonFlow: baseLessonFlow,
        studentContent: input.studentContent,
        assetsById: input.assetsById,
      });

  return {
    lesson: {
      id: input.lessonId,
      title: input.lessonShell.title,
      moduleIndex: input.lessonShell.position.moduleIndex,
      lessonIndex: input.lessonShell.position.lessonIndex,
      durationMinutes: input.lessonShell.estimatedDurationMinutes,
      durationLabel: `${input.lessonShell.estimatedDurationMinutes} мин`,
    },
    quickSummary: input.presentation.quickSummary,
    steps,
    assetsById: input.assetsById,
    canonicalHomework: input.canonicalHomework,
  };
}
