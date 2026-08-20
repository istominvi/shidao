import type {
  CourseAsset,
  CourseLesson,
  LearningObjective,
} from "@/modules/course-builder/domain";
import type { LessonRun } from "@/modules/lesson-runs/domain";

export type ObservationRating = "independent" | "with_support" | "not_yet";

export type ObservationEntryMethod = "direct" | "bulk_confirmed";

/**
 * One teacher-owned, component-level observation for one expected learner in
 * a LessonRun. While its LearningRecord is a draft the row may be replaced or
 * removed; completion makes the same row durable read-only history.
 */
export type LessonComponentObservation = {
  id: string;
  learningRecordId: string;
  lessonComponentId: string | null;
  sourceComponentIdAtTime: string;
  /** Nullable live FK; deletion does not erase the stable fields below. */
  learningObjectiveId: string | null;
  /** Stable objective provenance captured by the save RPC under its locks. */
  sourceLearningObjectiveIdAtTime: string | null;
  /** Bounded historical title; null for honest LA-M1 component-only rows. */
  learningObjectiveTitleAtTime: string | null;
  componentPositionAtTime: number;
  /** Historical registry key; it remains readable if a live type is retired. */
  componentTypeAtTime: string;
  componentLabelAtTime: string;
  observableCriterionAtTime: string;
  rating: ObservationRating;
  entryMethod: ObservationEntryMethod;
  privateNote: string | null;
  observedAt: string;
  recordedByAccountId: string;
  createdAt: string;
  updatedAt: string;
};

/**
 * Teacher-only projection for conducting one existing LessonRun. The Lesson
 * remains the single source of authored content; the Run does not receive a
 * content snapshot or a second component order.
 */
export type RunObservationWorkspace = {
  run: LessonRun;
  lesson: CourseLesson;
  attachments: CourseAsset[];
  learningObjectives: LearningObjective[];
  observations: LessonComponentObservation[];
};
