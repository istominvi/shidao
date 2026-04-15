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
  | "media_file";

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
  | "vocabulary_cards"
  | "phrase_cards"
  | "media_asset"
  | "action_cards"
  | "worksheet"
  | "recap"
  | "hero_banner"
  | "goal_cards"
  | "story_scene"
  | "vocabulary_gallery"
  | "phrase_drill"
  | "movement_mission"
  | "counting_task"
  | "media_stage"
  | "farm_scene"
  | "worksheet_preview"
  | "song_stage"
  | "home_recap"
  | "parent_tip";

export type AssetRef = {
  kind: ReusableAssetKind;
  id: string;
};

export type MethodologyLessonPosition = {
  moduleIndex: number;
  unitIndex?: number;
  lessonIndex: number;
};
