export type MethodologyReadinessStatus = "draft" | "ready" | "archived";

export type RuntimeLessonFormat = "online" | "offline";
export type ScheduledLessonRuntimeStatus =
  | "planned"
  | "in_progress"
  | "completed"
  | "cancelled";

export type ReusableAssetKind =
  | "video"
  | "song"
  | "worksheet"
  | "vocabulary_set"
  | "activity_template"
  | "media_file"
  | "presentation"
  | "flashcards_pdf"
  | "lesson_video"
  | "worksheet_pdf"
  | "song_audio"
  | "song_video"
  | "pronunciation_audio";

export type LessonBlockType =
  | "intro_framing"
  | "video_segment"
  | "song_segment"
  | "vocabulary_focus"
  | "teacher_prompt_pattern"
  | "guided_activity"
  | "materials_prep"
  | "worksheet_task"
  | "wrap_up_closure";

export type MethodologyStudentSectionType =
  | "lesson_focus"
  | "presentation"
  | "resource_links"
  | "vocabulary_cards"
  | "phrase_cards"
  | "word_list"
  | "count_board"
  | "media_asset"
  | "action_cards"
  | "farm_placement"
  | "matching_practice"
  | "worksheet"
  | "recap";

export type AssetRef = {
  kind: ReusableAssetKind;
  id: string;
};

export type MethodologyLessonPosition = {
  moduleIndex: number;
  unitIndex?: number;
  lessonIndex: number;
};
