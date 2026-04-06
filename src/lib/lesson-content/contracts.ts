import type {
  AssetRef,
  LessonBlockType,
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
  metadata?: {
    locale?: string;
    level?: string;
  };
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
  shell: MethodologyLessonShell;
  blocks: LessonBlockInstance[];
};

export type ScheduledLesson = {
  id: string;
  methodologyLessonId: string;
  runtimeShell: ScheduledLessonRuntimeShell;
  runtimeNotes?: string;
  outcomeNotes?: string;
};
