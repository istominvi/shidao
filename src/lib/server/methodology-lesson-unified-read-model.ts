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
    goal: "Включить детей в урок и задать позитивный ритм.",
    description: "Короткое приветствие, настрой и правила участия.",
    teacherActions: ["Приветствует каждого ученика по имени.", "Показывает жест ‘слушаем и повторяем’."],
    studentActions: ["Приветствуют педагога.", "Повторяют ритуальную фразу приветствия."],
    teacherScript: ["大家好! Nǐ hǎo!", "今天我们学习农场动物。"],
    expectedResponses: ["Nǐ hǎo!", "Готовы!"],
    materials: ["Карточка приветствия"],
    successCriteria: ["Дети включились в урок за 1–2 минуты."],
    notes: ["Держите темп бодрым, не затягивайте вступление."],
    durationMinutes: 2,
    movementMode: "calm",
  },
  2: {
    goal: "Дать первичное аудио-визуальное знакомство с животными фермы.",
    description: "Просмотр короткого видео с повторением ключевых слов.",
    teacherActions: ["Запускает видео и делает паузы на ключевых кадрах.", "Просит повторить 2–3 слова хором."],
    studentActions: ["Смотрят видео.", "Повторяют названия животных."],
    teacherScript: ["Слушаем и повторяем: cow, pig, horse.", "Кто это?"],
    expectedResponses: ["cow", "pig", "horse"],
    materials: ["Видео farm animals"],
    successCriteria: ["Ученики узнают минимум 2 животных на слух."],
    notes: ["Если группа устаёт, сократите повтор до одного круга."],
    durationMinutes: 3,
    movementMode: "calm",
  },
  3: {
    goal: "Закрепить речевой шаблон 我是…",
    description: "Ученики представляются через новую фразу.",
    teacherActions: ["Даёт модель фразы с именем и персонажем.", "Организует повторение цепочкой."],
    studentActions: ["Повторяют 我是…", "Называют себя или героя."],
    teacherScript: ["我是老师。", "我是小马。你呢?"],
    expectedResponses: ["我是…"],
    materials: ["Фразовые карточки"],
    successCriteria: ["Большинство учеников произносят 我是… без подсказки."],
    notes: ["Поддерживайте правильный ритм фразы жестом."],
    durationMinutes: 3,
    movementMode: "calm",
  },
  4: {
    goal: "Соотнести образ и слово для животных фермы.",
    description: "Работа с карточками на узнавание и называние.",
    teacherActions: ["Показывает карточку, произносит слово, предлагает повторить.", "Меняет порядок карточек для проверки внимания."],
    studentActions: ["Называют животных по карточкам.", "Находят карточку по слову."],
    teacherScript: ["Это cow. Повторяем.", "Покажи pig."],
    expectedResponses: ["cow / pig / horse"],
    materials: ["Набор карточек животных"],
    successCriteria: ["Ученики уверенно находят нужную карточку."],
    notes: ["Держите карточки на уровне глаз детей."],
    durationMinutes: 3,
    movementMode: "mixed",
  },
  5: {
    goal: "Подключить телесный канал для запоминания слов.",
    description: "Дети изображают животных по команде.",
    teacherActions: ["Даёт команду и показывает пример движения.", "Быстро меняет животных."],
    studentActions: ["Изображают походку и звук животного.", "Реагируют на смену команды."],
    teacherScript: ["Покажи horse!", "Теперь pig!"],
    expectedResponses: ["Корректное движение по команде"],
    materials: ["Свободное пространство в классе"],
    successCriteria: ["Дети различают минимум 3 животных в движении."],
    notes: ["Контролируйте безопасную дистанцию."],
    durationMinutes: 3,
    movementMode: "active",
  },
  6: {
    goal: "Тренировать скорость реакции и понимание команд.",
    description: "Игра с карточками и мячом на быстрое узнавание.",
    teacherActions: ["Называет животное и бросает мяч ученику.", "Поддерживает ротацию участников."],
    studentActions: ["Ловят мяч.", "Показывают/называют нужную карточку."],
    teacherScript: ["Catch! Where is horse?", "Отлично, дальше!"],
    expectedResponses: ["Верный выбор карточки", "Однословный ответ"],
    materials: ["Мягкий мяч", "Карточки животных"],
    successCriteria: ["Большинство ответов верные в темпе игры."],
    notes: ["Ускоряйте темп постепенно."],
    durationMinutes: 3,
    movementMode: "active",
  },
  7: {
    goal: "Ввести счёт 1–5 в связке с предметным действием.",
    description: "Счётные палочки и синхронное проговаривание.",
    teacherActions: ["Показывает количество палочек.", "Ведёт счёт вместе с детьми."],
    studentActions: ["Считают вслух.", "Показывают нужное количество."],
    teacherScript: ["一, 二, 三...", "Покажи пять."],
    expectedResponses: ["Счёт до пяти", "Верное количество"],
    materials: ["Счётные палочки"],
    successCriteria: ["Дети считают до 5 без пауз."],
    notes: ["Сильным детям давайте обратный счёт."],
    durationMinutes: 3,
    movementMode: "table",
  },
  8: {
    goal: "Закрепить счёт и лексику на задании из приложения.",
    description: "Работа по Приложению 1 с подсчётом животных.",
    teacherActions: ["Открывает приложение и задаёт вопросы по картинке.", "Проверяет ответы фронтально."],
    studentActions: ["Считают животных в приложении.", "Произносят число и животное."],
    teacherScript: ["Сколько cows?", "Скажи: three cows."],
    expectedResponses: ["one/two/three ... + animal"],
    materials: ["Приложение 1", "Карандаш"],
    successCriteria: ["Ученики дают связку число + животное."],
    notes: ["Дайте 20–30 секунд на самостоятельный поиск."],
    durationMinutes: 4,
    movementMode: "table",
  },
  9: {
    goal: "Ввести глаголы движения 跑 и 跳.",
    description: "Команды с демонстрацией и повтором.",
    teacherActions: ["Показывает动作 для 跑 и 跳.", "Чередует команды в разном темпе."],
    studentActions: ["Повторяют глаголы.", "Выполняют правильное движение."],
    teacherScript: ["跑!", "跳!"],
    expectedResponses: ["Верное действие на команду"],
    materials: ["Карточки действий"],
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
    teacherScript: ["跳到 horse!", "跑到 pig!"],
    expectedResponses: ["Правильный выбор направления"],
    materials: ["Карточки животных на полу/стене"],
    successCriteria: ["Команда выполняется без дополнительных пояснений."],
    notes: ["Разведите карточки по разным зонам класса."],
    durationMinutes: 4,
    movementMode: "active",
  },
  11: {
    goal: "Развивать мини-высказывание о действии животного.",
    description: "Ответы по модели ‘кто что делает’.",
    teacherActions: ["Показывает картинку/жест и задаёт вопрос.", "Подсказывает начало ответа при необходимости."],
    studentActions: ["Отвечают по модели.", "Повторяют ответы друг друга."],
    teacherScript: ["Что делает horse?", "Horse 跑."],
    expectedResponses: ["X 跑 / X 跳"],
    materials: ["Карточки животных и действий"],
    successCriteria: ["Ученики дают короткий ответ по модели."],
    notes: ["Слабым ученикам разрешите одно слово + жест."],
    durationMinutes: 3,
    movementMode: "mixed",
  },
  12: {
    goal: "Перенести изученное в письменно-визуальную практику.",
    description: "Задания рабочей тетради на стр. 3–4.",
    teacherActions: ["Поясняет задание по образцу.", "Обходит класс и даёт точечную помощь."],
    studentActions: ["Выполняют задания в тетради.", "Сверяют ответы с педагогом."],
    teacherScript: ["Откройте стр. 3–4.", "Соедините и подпишите."],
    expectedResponses: ["Корректно выполненные упражнения"],
    materials: ["Рабочая тетрадь стр. 3–4", "Карандаши"],
    successCriteria: ["Большинство выполняет задания без ошибок."],
    notes: ["Оставьте 30 секунд на самопроверку."],
    durationMinutes: 3,
    movementMode: "table",
  },
  13: {
    goal: "Зафиксировать слово 农场 в активном словаре.",
    description: "Проговаривание и узнавание слова 农场.",
    teacherActions: ["Показывает слово и чтение по слогам.", "Сопоставляет слово с изображением фермы."],
    studentActions: ["Повторяют слово.", "Находят слово в списке."],
    teacherScript: ["农场 — nóngchǎng.", "Где слово 农场?"],
    expectedResponses: ["农场", "Ферма"],
    materials: ["Словарь урока на экране"],
    successCriteria: ["Ученики узнают и произносят слово 农场."],
    notes: ["Сделайте 2–3 коротких повтора в разном темпе."],
    durationMinutes: 2,
    movementMode: "calm",
  },
  14: {
    goal: "Обобщить лексику в контексте ‘кто живёт на ферме’.",
    description: "Сортировка/размещение животных на ферме.",
    teacherActions: ["Даёт инструкцию на размещение животных.", "Проверяет и просит проговорить выбор."],
    studentActions: ["Размещают животных.", "Называют, кто живёт на ферме."],
    teacherScript: ["Кто живёт на ферме?", "Put cow on the farm."],
    expectedResponses: ["Cow/pig/horse live on the farm."],
    materials: ["Интерактив ‘Ферма’"],
    successCriteria: ["Дети верно распределяют и называют животных."],
    notes: ["Попросите 1–2 учеников объяснить выбор вслух."],
    durationMinutes: 3,
    movementMode: "mixed",
  },
  15: {
    goal: "Снять напряжение и закрепить лексику через песню.",
    description: "Песня с подпеванием и жестами.",
    teacherActions: ["Включает песню и показывает ключевые жесты.", "Организует короткое повторное исполнение."],
    studentActions: ["Поют вместе.", "Показывают движения под слова."],
    teacherScript: ["Слушаем и поём вместе.", "Ещё раз припев!"],
    expectedResponses: ["Уверенное подпевание знакомых слов"],
    materials: ["Аудио песни farm animals"],
    successCriteria: ["Ученики активно участвуют в подпевании."],
    notes: ["Сократите до припева, если осталось мало времени."],
    durationMinutes: 2,
    movementMode: "song",
  },
  16: {
    goal: "Подвести итог и завершить урок на позитиве.",
    description: "Короткий recap и прощание.",
    teacherActions: ["Просит назвать 2–3 слова урока.", "Благодарит группу и прощается."],
    studentActions: ["Называют слова/фразы урока.", "Прощаются с педагогом."],
    teacherScript: ["Что запомнили сегодня?", "再见! Zàijiàn!"],
    expectedResponses: ["Названия животных", "Фраза 我是…"],
    materials: ["Карточка-подсказка recap"],
    successCriteria: ["Каждый ученик участвует в завершающем круге."],
    notes: ["Завершите урок спокойным ритуалом."],
    durationMinutes: 1,
    movementMode: "calm",
  },
};

const worldAroundMeLessonOneCanonicalSteps: WorldAroundMeLessonOneCanonicalStep[] = [
  {
    order: 1,
    title: "Приветствие",
    teacherFlowOrder: 1,
    studentInstruction: "Поздоровайся с преподавателем и героями урока.",
    selectSection: (section) => section.sceneId === "scene-hero" && section.type === "lesson_focus",
  },
  {
    order: 2,
    title: "Видео: farm animals",
    teacherFlowOrder: 2,
    studentInstruction: "Посмотри видео и повтори названия животных.",
    selectSection: (section) =>
      section.type === "media_asset" &&
      section.assetId === "video:farm-animals",
    explicitResourceIds: ["video:farm-animals"],
    forcedScreenType: "video",
  },
  { order: 3, title: "Фраза 我是…", teacherFlowOrder: 3, studentInstruction: "Повтори фразу 我是… и назови себя или героя.", selectSection: (section) => section.sceneId === "scene-phrases" && section.type === "phrase_cards" },
  { order: 4, title: "Карточки животных", teacherFlowOrder: 4, studentInstruction: "Посмотри карточки животных и повтори слова.", selectSection: (section) => section.sceneId === "scene-flashcards" && section.type === "vocabulary_cards", explicitResourceIds: ["flashcards:world-around-me-lesson-1"] },
  { order: 5, title: "Изображаем животных", teacherFlowOrder: 5, studentInstruction: "Изобрази животное по команде преподавателя." },
  {
    order: 6,
    title: "Игра с карточками и мячом",
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
  { order: 7, title: "Счётные палочки", teacherFlowOrder: 7, studentInstruction: "Считай до пяти вместе с преподавателем." },
  { order: 8, title: "Приложение 1: считаем и называем", teacherFlowOrder: 8, studentInstruction: "Покажи и посчитай животных в Приложении 1.", selectSection: (section) => section.sceneId === "scene-counting" && section.type === "count_board", explicitResourceIds: ["worksheet:appendix-1"] },
  { order: 9, title: "Глаголы 跑 и 跳", teacherFlowOrder: 9, studentInstruction: "Повтори команды с глаголами 跑 и 跳.", selectSection: (section) => section.sceneId === "scene-actions" && section.type === "action_cards" },
  { order: 10, title: "Бежим и прыгаем к животным", teacherFlowOrder: 10, studentInstruction: "Выполни движение по команде преподавателя." },
  { order: 11, title: "Что делает животное?", teacherFlowOrder: 11, studentInstruction: "Ответь, что делает животное." },
  { order: 12, title: "Рабочая тетрадь, стр. 3–4", teacherFlowOrder: 12, studentInstruction: "Открой рабочую тетрадь на стр. 3–4.", selectSection: (section) => section.sceneId === "scene-materials" && section.type === "worksheet", explicitResourceIds: ["worksheet:workbook-pages-3-4"] },
  {
    order: 13,
    title: "Слово 农场",
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
  { order: 14, title: "Кто живёт на ферме", teacherFlowOrder: 14, studentInstruction: "Скажи, кто живёт на ферме.", selectSection: (section) => section.sceneId === "scene-farm" && section.type === "farm_placement" },
  {
    order: 15,
    title: "Песня: farm animals",
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
  { order: 16, title: "Прощание", teacherFlowOrder: 16, studentInstruction: "Попрощайся и повтори слова урока.", selectSection: (section) => section.sceneId === "scene-review" && section.type === "recap" },
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
  return Array.from(new Set(source.filter((item) => item.trim().length > 0)));
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
  const fallback = lessonOneTeacherFallbackByOrder[input.canonicalStep.order];

  const description = matched?.description ?? fallback.description ?? null;
  return {
    goal: matched?.description ?? fallback.goal ?? null,
    description,
    teacherActions: makeUnique(matched?.teacherActions, fallback.teacherActions),
    studentActions: makeUnique(matched?.studentActions, fallback.studentActions),
    expectedResponses: makeUnique(
      matched?.pedagogicalDetails?.expectedStudentResponses,
      fallback.expectedResponses ?? [],
    ),
    teacherScript: makeUnique(
      matched?.pedagogicalDetails?.promptPatterns,
      fallback.teacherScript ?? [],
    ),
    materials: makeUnique(matched?.materials, fallback.materials),
    successCriteria: makeUnique(
      matched?.pedagogicalDetails?.successCriteria,
      fallback.successCriteria ?? [],
    ),
    notes: makeUnique(
      [
        matched?.pedagogicalDetails?.fallbackRu,
        matched?.pedagogicalDetails?.homeExtension,
        matched?.pedagogicalDetails?.exitCheck,
      ].filter((item): item is string => Boolean(item)),
      fallback.notes ?? [],
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
      durationMinutes: lessonOneTeacherFallbackByOrder[canonicalStep.order].durationMinutes,
      movementMode: lessonOneTeacherFallbackByOrder[canonicalStep.order].movementMode,
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
      durationMinutes: input.lessonShell.estimatedDurationMinutes,
      durationLabel: `${input.lessonShell.estimatedDurationMinutes} мин`,
    },
    quickSummary: input.presentation.quickSummary,
    steps,
    assetsById: input.assetsById,
    canonicalHomework: input.canonicalHomework,
  };
}
