import type {
  LessonBlockInstance,
  Methodology,
  MethodologyLesson,
  ReusableAsset,
  ScheduledLesson,
} from "./contracts";

export const lessonContentFixtureMethodology: Methodology = {
  id: "methodology:mandarin-a1-kids",
  slug: "mandarin-a1-kids",
  title: "Mandarin A1 Kids",
  shortDescription: "Базовый разговорный китайский для младших школьников.",
  metadata: {
    locale: "zh-CN",
    level: "A1",
  },
};

export const lessonContentFixtureAssets: ReusableAsset[] = [
  {
    id: "video:greetings-dialogue-a1",
    kind: "video",
    title: "Classroom greetings dialogue",
    sourceUrl: "https://cdn.example.local/videos/greetings-dialogue-a1.mp4",
  },
  {
    id: "song:nihao-rhythm-a1",
    kind: "song",
    title: "Ni Hao rhythm chant",
    sourceUrl: "https://cdn.example.local/audio/nihao-rhythm-a1.mp3",
  },
  {
    id: "ws:greeting-cards-set-1",
    kind: "worksheet",
    title: "Greeting cards worksheet",
    fileRef: "worksheets/greeting-cards-set-1.pdf",
  },
  {
    id: "vocab:classroom-core",
    kind: "vocabulary_set",
    title: "Classroom core vocabulary",
  },
  {
    id: "activity:basic-greeting-roleplay",
    kind: "activity_template",
    title: "Basic greeting roleplay",
  },
];

export const lessonContentFixtureBlocks: LessonBlockInstance[] = [
  {
    id: "block:intro-1",
    blockType: "intro_framing",
    order: 1,
    title: "Ввод в тему",
    assetRefs: [],
    content: {
      title: "Приветствия в классе",
      goal: "Научиться 3 базовым фразам приветствия.",
      teacherScriptShort: "Сегодня тренируем приветствие и вопрос имени.",
      warmupQuestion: "Как вы приветствуете учителя утром?",
      timeboxMinutes: 5,
    },
  },
  {
    id: "block:video-1",
    blockType: "video_segment",
    order: 2,
    title: "Видео-диалог",
    assetRefs: [{ kind: "video", id: "video:greetings-dialogue-a1" }],
    content: {
      promptBeforeWatch: "Отметьте знакомые фразы.",
      focusPoints: ["你好", "你叫什么名字"],
      questionsAfterWatch: ["Кто начал приветствие первым?"],
    },
  },
  {
    id: "block:song-1",
    blockType: "song_segment",
    order: 3,
    title: "Ритмический чант",
    assetRefs: [{ kind: "song", id: "song:nihao-rhythm-a1" }],
    content: {
      activityGoal: "Закрепить интонацию и ритм приветствия.",
      teacherActions: ["Показать темп хлопками", "Повторить с классом"],
      repeatCount: 3,
    },
  },
  {
    id: "block:vocab-1",
    blockType: "vocabulary_focus",
    order: 4,
    assetRefs: [{ kind: "vocabulary_set", id: "vocab:classroom-core" }],
    content: {
      items: [
        { term: "老师", pinyin: "lǎoshī", meaning: "учитель" },
        { term: "学生", pinyin: "xuésheng", meaning: "ученик" },
      ],
      practiceMode: "choral_then_pairs",
      miniDrill: "Назови слово по карточке за 5 секунд.",
    },
  },
  {
    id: "block:prompt-1",
    blockType: "teacher_prompt_pattern",
    order: 5,
    assetRefs: [],
    content: {
      promptPatterns: ["Спроси соседа: 你叫什么名字?"],
      expectedStudentResponses: ["我叫…"],
      fallbackRu: "Если сложно — дать русский шаблон.",
    },
  },
  {
    id: "block:activity-1",
    blockType: "guided_activity",
    order: 6,
    assetRefs: [
      { kind: "activity_template", id: "activity:basic-greeting-roleplay" },
      { kind: "worksheet", id: "ws:greeting-cards-set-1" },
    ],
    content: {
      activityType: "pair_roleplay",
      steps: ["A спрашивает имя", "B отвечает", "Смена ролей"],
      successCriteria: ["Каждый произнёс 2 реплики"],
    },
  },
  {
    id: "block:materials-1",
    blockType: "materials_prep",
    order: 7,
    assetRefs: [{ kind: "worksheet", id: "ws:greeting-cards-set-1" }],
    content: {
      materialsChecklist: ["Карточки", "Маркеры", "Колонки"],
      printCount: 12,
    },
  },
  {
    id: "block:worksheet-1",
    blockType: "worksheet_task",
    order: 8,
    assetRefs: [{ kind: "worksheet", id: "ws:greeting-cards-set-1" }],
    content: {
      taskInstruction: "Соедини иероглиф и pinyin.",
      completionMode: "in_class",
      answerKeyHint: "Проверить в парах.",
    },
  },
  {
    id: "block:wrap-1",
    blockType: "wrap_up_closure",
    order: 9,
    assetRefs: [],
    content: {
      recapPoints: ["你好", "你叫什么名字", "我叫…"],
      exitCheck: "Назови 2 фразы без подсказки.",
      previewNextLesson: "Следующий урок: школьные предметы.",
    },
  },
];

export const lessonContentFixtureMethodologyLesson: MethodologyLesson = {
  id: "methodology-lesson:mandarin-a1-01",
  methodologyId: lessonContentFixtureMethodology.id,
  methodologySlug: lessonContentFixtureMethodology.slug,
  shell: {
    id: "methodology-shell:mandarin-a1-01",
    methodologyId: lessonContentFixtureMethodology.id,
    title: "Приветствия и знакомство",
    position: {
      moduleIndex: 1,
      unitIndex: 1,
      lessonIndex: 1,
    },
    vocabularySummary: ["老师", "学生"],
    phraseSummary: ["你好", "你叫什么名字", "我叫…"],
    estimatedDurationMinutes: 45,
    mediaSummary: {
      videos: 1,
      songs: 1,
      worksheets: 1,
      other: 0,
    },
    readinessStatus: "ready",
  },
  blocks: lessonContentFixtureBlocks,
};

export const lessonContentFixtureScheduledLesson: ScheduledLesson = {
  id: "scheduled-lesson:class-red-2026-04-07",
  methodologyLessonId: lessonContentFixtureMethodologyLesson.id,
  runtimeShell: {
    id: "runtime-shell:class-red-2026-04-07",
    classId: "class:red-dragons",
    startsAt: "2026-04-07T15:00:00.000Z",
    format: "online",
    meetingLink: "https://meet.example.local/class-red-dragons",
    runtimeStatus: "planned",
    runtimeNotesSummary: "Подготовить карточки на повторение в начале.",
  },
  runtimeNotes: "У Маши сложность с тоном 3, дать дополнительные повторы.",
  outcomeNotes: "",
};
