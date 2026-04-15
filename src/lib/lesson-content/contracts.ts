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
    [key: string]: string | number | boolean | undefined;
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
};

export type LessonFocusStudentSection = BaseStudentSection<"lesson_focus"> & {
  body: string;
  chips: string[];
};

export type VocabularyCardsStudentSection =
  BaseStudentSection<"vocabulary_cards"> & {
    items: Array<{
      term: string;
      pinyin?: string;
      meaning: string;
      visualHint?: string;
    }>;
  };

export type PhraseCardsStudentSection = BaseStudentSection<"phrase_cards"> & {
  items: Array<{
    phrase: string;
    pinyin?: string;
    meaning: string;
    usageHint?: string;
  }>;
};

export type MediaAssetStudentSection = BaseStudentSection<"media_asset"> & {
  assetId: string;
  assetKind: "video" | "song" | "media_file";
  studentPrompt: string;
  teacherShareHint?: string;
};

export type ActionCardsStudentSection = BaseStudentSection<"action_cards"> & {
  items: Array<{
    term: string;
    pinyin?: string;
    meaning: string;
    movementHint: string;
  }>;
};

export type WorksheetStudentSection = BaseStudentSection<"worksheet"> & {
  assetId?: string;
  instructions: string;
  pageLabel?: string;
};

export type RecapStudentSection = BaseStudentSection<"recap"> & {
  bullets: string[];
};

export type HeroBannerStudentSection = BaseStudentSection<"hero_banner"> & {
  subtitle?: string;
  mood?: string;
  chips: string[];
};

export type GoalCardsStudentSection = BaseStudentSection<"goal_cards"> & {
  goals: Array<{
    icon?: string;
    text: string;
  }>;
};

export type StorySceneStudentSection = BaseStudentSection<"story_scene"> & {
  sceneLine: string;
  prompt?: string;
  chips?: string[];
};

export type VocabularyGalleryStudentSection =
  BaseStudentSection<"vocabulary_gallery"> & {
    items: Array<{
      term: string;
      pinyin?: string;
      meaning: string;
      category: "animal" | "place" | "action" | "phrase";
      visualHint?: string;
    }>;
  };

export type PhraseDrillStudentSection = BaseStudentSection<"phrase_drill"> & {
  items: Array<{
    phrase: string;
    pinyin?: string;
    meaning: string;
    example?: string;
  }>;
};

export type MovementMissionStudentSection =
  BaseStudentSection<"movement_mission"> & {
    prompts: string[];
    hints?: string[];
    energyLevel?: "calm" | "active";
  };

export type CountingTaskStudentSection = BaseStudentSection<"counting_task"> & {
  task: string;
  countingRange?: string;
  hints?: string[];
};

export type MediaStageStudentSection = BaseStudentSection<"media_stage"> & {
  assetId?: string;
  assetKind: "video" | "song" | "media_file";
  prompt: string;
  description?: string;
  ctaLabel?: string;
};

export type FarmSceneStudentSection = BaseStudentSection<"farm_scene"> & {
  modelLine: string;
  childNote: string;
  prompts?: string[];
};

export type WorksheetPreviewStudentSection =
  BaseStudentSection<"worksheet_preview"> & {
    assetId?: string;
    pageLabel?: string;
    instructions: string;
    checklist?: string[];
  };

export type SongStageStudentSection = BaseStudentSection<"song_stage"> & {
  assetId?: string;
  prompt: string;
  movementHint?: string;
};

export type HomeRecapStudentSection = BaseStudentSection<"home_recap"> & {
  bullets: string[];
};

export type ParentTipStudentSection = BaseStudentSection<"parent_tip"> & {
  tip: string;
};

export type MethodologyLessonStudentContentSection =
  | LessonFocusStudentSection
  | VocabularyCardsStudentSection
  | PhraseCardsStudentSection
  | MediaAssetStudentSection
  | ActionCardsStudentSection
  | WorksheetStudentSection
  | RecapStudentSection
  | HeroBannerStudentSection
  | GoalCardsStudentSection
  | StorySceneStudentSection
  | VocabularyGalleryStudentSection
  | PhraseDrillStudentSection
  | MovementMissionStudentSection
  | CountingTaskStudentSection
  | MediaStageStudentSection
  | FarmSceneStudentSection
  | WorksheetPreviewStudentSection
  | SongStageStudentSection
  | HomeRecapStudentSection
  | ParentTipStudentSection;

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
