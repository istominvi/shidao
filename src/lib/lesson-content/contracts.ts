import type {
  AssetRef,
  LessonBlockType,
  MethodologyStudentSectionType,
  MethodologyLessonPosition,
  MethodologyReadinessStatus,
  ReusableAssetKind,
  ScheduledLessonRuntimeStatus,
} from "./types";

export type Methodology = {
  id: string;
  slug: string;
  title: string;
  shortDescription?: string;
  metadata?: MethodologyMetadata;
};

export type MethodologyMetadata = {
  locale?: string;
  level?: string;
  titleRu?: string;
  titleNative?: string;
  coverImage?: {
    src: string;
    alt?: string;
  };
  targetAgeLabel?: string;
  lessonDurationLabel?: string;
  courseDurationLabel?: string;
  approximateVocabularyCount?: number;
  songCount?: number;
  videoCount?: number;
  idealGroupSizeLabel?: string;
  maxGroupSize?: number;
  activitiesPerLessonLabel?: string;
  lessonFormatSummary?: string;
  teachingApproachSummary?: string;
  learningOutcomes?: string[];
  thematicModules?: string[];
  methodologyNotes?: string[];
  materialsEcosystemSummary?: string;
  audienceLabel?: string;
  courseScopeLabel?: string;
  programLessonCount?: number;
};

export type MethodologyLessonShell = {
  id: string;
  methodologyId: string;
  title: string;
  position: MethodologyLessonPosition;
  vocabularySummary: string[];
  phraseSummary: string[];
  estimatedDurationMinutes: number;
  mediaSummary: {
    videos: number;
    songs: number;
    worksheets: number;
    other: number;
  };
  readinessStatus: MethodologyReadinessStatus;
};

type BaseScheduledLessonRuntimeShell = {
  id: string;
  classId: string;
  startsAt: string;
  runtimeStatus: ScheduledLessonRuntimeStatus;
  runtimeNotesSummary?: string;
};

export type ScheduledLessonRuntimeShell =
  | (BaseScheduledLessonRuntimeShell & {
      format: "online";
      meetingLink: string;
      place?: never;
    })
  | (BaseScheduledLessonRuntimeShell & {
      format: "offline";
      place: string;
      meetingLink?: never;
    });

export type ReusableAsset = {
  id: string;
  kind: ReusableAssetKind;
  title: string;
  description?: string;
  sourceUrl?: string;
  fileRef?: string;
  metadata?: {
    durationSeconds?: number;
    language?: string;
    level?: string;
    titleRu?: string;
    titleNative?: string;
    [key: string]:
      | string
      | number
      | boolean
      | undefined
      | string[]
      | { [nested: string]: string | number | boolean | undefined | string[] };
  };
};

type BaseLessonBlockInstance<TBlockType extends LessonBlockType, TPayload> = {
  id: string;
  blockType: TBlockType;
  order: number;
  title?: string;
  assetRefs: AssetRef[];
  content: TPayload;
};

export type IntroFramingBlock = BaseLessonBlockInstance<
  "intro_framing",
  {
    title: string;
    goal: string;
    teacherScriptShort: string;
    warmupQuestion?: string;
    timeboxMinutes?: number;
  }
>;

export type VideoSegmentBlock = BaseLessonBlockInstance<
  "video_segment",
  {
    promptBeforeWatch: string;
    focusPoints: string[];
    clipStart?: number;
    clipEnd?: number;
    questionsAfterWatch?: string[];
  }
>;

export type SongSegmentBlock = BaseLessonBlockInstance<
  "song_segment",
  {
    activityGoal: string;
    teacherActions: string[];
    lyricsExcerpt?: string;
    repeatCount?: number;
    movementHint?: string;
  }
>;

export type VocabularyFocusBlock = BaseLessonBlockInstance<
  "vocabulary_focus",
  {
    items: Array<{
      term: string;
      pinyin: string;
      meaning: string;
    }>;
    practiceMode: string;
    mnemonics?: string[];
    commonMistakes?: string[];
    miniDrill?: string;
  }
>;

export type TeacherPromptPatternBlock = BaseLessonBlockInstance<
  "teacher_prompt_pattern",
  {
    promptPatterns: string[];
    expectedStudentResponses: string[];
    adaptationsByLevel?: string[];
    fallbackRu?: string;
  }
>;

export type GuidedActivityBlock = BaseLessonBlockInstance<
  "guided_activity",
  {
    activityType: string;
    steps: string[];
    successCriteria: string[];
    grouping?: string;
    timeboxMinutes?: number;
    differentiationNotes?: string;
  }
>;

export type MaterialsPrepBlock = BaseLessonBlockInstance<
  "materials_prep",
  {
    materialsChecklist: string[];
    printCount?: number;
    roomSetupNotes?: string;
  }
>;

export type WorksheetTaskBlock = BaseLessonBlockInstance<
  "worksheet_task",
  {
    taskInstruction: string;
    completionMode: "in_class" | "home";
    answerKeyHint?: string;
    homeExtension?: string;
  }
>;

export type WrapUpClosureBlock = BaseLessonBlockInstance<
  "wrap_up_closure",
  {
    recapPoints: string[];
    exitCheck: string;
    previewNextLesson?: string;
    teacherReflectionPrompt?: string;
  }
>;

export type LessonBlockInstance =
  | IntroFramingBlock
  | VideoSegmentBlock
  | SongSegmentBlock
  | VocabularyFocusBlock
  | TeacherPromptPatternBlock
  | GuidedActivityBlock
  | MaterialsPrepBlock
  | WorksheetTaskBlock
  | WrapUpClosureBlock;

export type MethodologyLesson = {
  id: string;
  methodologyId: string;
  methodologySlug: string;
  methodologyTitle?: string;
  shell: MethodologyLessonShell;
  blocks: LessonBlockInstance[];
};

export type MethodologyLessonHomeworkDefinition = {
  id: string;
  methodologyLessonId: string;
  title: string;
  kind: "practice_text" | "quiz_single_choice";
  instructions: string;
  materialLinks: string[];
  answerFormatHint?: string;
  estimatedMinutes?: number;
  quiz?: {
    id: string;
    version: number;
    title?: string;
    subtitle?: string;
    introText?: string;
    completionTitle?: string;
    completionText?: string;
    illustrationSrc?: string;
    tone?: "sky" | "violet" | "emerald" | "amber" | "rose" | "neutral";
    practiceSections?: unknown[];
    questions: Array<{
      id: string;
      prompt: string;
      helperText?: string;
      options: Array<{
        id: string;
        label: string;
      }>;
      correctOptionId: string;
    }>;
  };
};

type BaseStudentSection<TType extends MethodologyStudentSectionType> = {
  type: TType;
  title: string;
  subtitle?: string;
  tone?: "sky" | "violet" | "emerald" | "amber" | "rose" | "neutral";
  illustrationSrc?: string;
  layout?:
    | "hero"
    | "roadmap"
    | "presentation"
    | "resources"
    | "vocabulary"
    | "phrases"
    | "counting"
    | "movement"
    | "farm"
    | "practice"
    | "homework"
    | "recap";
  sceneId?: string;
};

export type LessonFocusStudentSection = BaseStudentSection<"lesson_focus"> & {
  body: string;
  chips: string[];
};

export type VocabularyCardsStudentSection =
  BaseStudentSection<"vocabulary_cards"> & {
    displayMode?: "grid" | "carousel";
    items: Array<{
      term: string;
      pinyin?: string;
      meaning: string;
      visualHint?: string;
      illustrationSrc?: string;
      audioAssetId?: string;
    }>;
  };

export type PhraseCardsStudentSection = BaseStudentSection<"phrase_cards"> & {
  displayMode?: "grid" | "dialogue";
  items: Array<{
    phrase: string;
    pinyin?: string;
    meaning: string;
    usageHint?: string;
    example?: string;
    speaker?: string;
    audioAssetId?: string;
  }>;
};

export type MediaAssetStudentSection = BaseStudentSection<"media_asset"> & {
  assetId: string;
  assetKind: "video" | "song" | "media_file";
  studentPrompt: string;
  teacherShareHint?: string;
  ctaLabel?: string;
};

export type ActionCardsStudentSection = BaseStudentSection<"action_cards"> & {
  displayMode?: "grid" | "slider";
  items: Array<{
    term: string;
    pinyin?: string;
    meaning: string;
    movementHint: string;
    illustrationSrc?: string;
    commandExample?: string;
    audioAssetId?: string;
  }>;
};

export type PresentationStudentSection = BaseStudentSection<"presentation"> & {
  assetId: string;
  readOnly?: boolean;
  studentCtaLabel?: string;
  teacherCtaLabel?: string;
  note?: string;
};

export type ResourceLinksStudentSection = BaseStudentSection<"resource_links"> & {
  audience: "teacher" | "student" | "both";
  resources: Array<{
    id: string;
    title: string;
    subtitle?: string;
    assetId?: string;
    sourceUrl?: string;
    downloadable?: boolean;
    previewable?: boolean;
  }>;
};

export type WordListStudentSection = BaseStudentSection<"word_list"> & {
  groups: Array<{
    id: string;
    title: string;
    entries: Array<{
      hanzi: string;
      pinyin?: string;
      meaning: string;
      audioAssetId?: string;
    }>;
  }>;
};

export type CountBoardStudentSection = BaseStudentSection<"count_board"> & {
  assetId?: string;
  prompt: string;
  groups: Array<{
    id: string;
    label: string;
    count: number;
    cue?: string;
  }>;
};

export type FarmPlacementStudentSection = BaseStudentSection<"farm_placement"> & {
  illustrationSrc?: string;
  animals: Array<{
    id: string;
    hanzi: string;
    pinyin?: string;
    meaning: string;
  }>;
  targetPhraseTemplate: string;
  defaultZoneLabel: string;
};

export type MatchingPracticeStudentSection = BaseStudentSection<"matching_practice"> & {
  prompt: string;
  pairs: Array<{
    id: string;
    label: string;
    illustrationSrc?: string;
  }>;
};

export type WorksheetStudentSection = BaseStudentSection<"worksheet"> & {
  assetId?: string;
  instructions: string;
  pageLabel?: string;
  teacherHint?: string;
};

export type RecapStudentSection = BaseStudentSection<"recap"> & {
  bullets: string[];
};

export type MethodologyLessonStudentContentSection =
  | LessonFocusStudentSection
  | PresentationStudentSection
  | ResourceLinksStudentSection
  | VocabularyCardsStudentSection
  | PhraseCardsStudentSection
  | WordListStudentSection
  | CountBoardStudentSection
  | MediaAssetStudentSection
  | ActionCardsStudentSection
  | FarmPlacementStudentSection
  | MatchingPracticeStudentSection
  | WorksheetStudentSection
  | RecapStudentSection;

export type MethodologyLessonStudentContent = {
  id: string;
  methodologyLessonId: string;
  title: string;
  subtitle?: string;
  sections: MethodologyLessonStudentContentSection[];
};

export type ScheduledLesson = {
  id: string;
  methodologyLessonId: string;
  runtimeShell: ScheduledLessonRuntimeShell;
  runtimeNotes?: string;
  outcomeNotes?: string;
};
