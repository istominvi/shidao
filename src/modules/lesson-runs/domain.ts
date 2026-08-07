import type { CourseBuilderActor } from "@/modules/course-builder/domain";

export type { CourseBuilderActor as LessonRunsActor };

/**
 * The current teacher's directory projection of one canonical learner
 * identity. `id` is the stable `learner_profile.id`; the name and archive
 * state belong to the `teacher_learner` relation and may therefore differ for
 * another teacher without splitting the learner's history.
 */
export type LearnerProfile = {
  id: string;
  teacherAccountId: string;
  displayName: string;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

/**
 * An Account-owned address-book group. Groups are dynamic audience sources:
 * changing membership affects future LessonRuns, never an already scheduled
 * Run's expected learner records.
 */
export type LearnerGroup = {
  id: string;
  ownerAccountId: string;
  name: string;
  members: LearnerProfile[];
  createdAt: string;
  updatedAt: string;
};

/**
 * The persisted Course selection and its deduplicated learner projection.
 * A learner may be selected directly and through any number of groups, but is
 * present only once in `effectiveLearners`.
 */
export type CourseAudience = {
  directLearners: LearnerProfile[];
  groups: LearnerGroup[];
  effectiveLearners: LearnerProfile[];
};

/**
 * One learner's participation in a run. Before `occurredAt` is set the row is
 * also the expected-participant list; afterwards it is durable learning
 * history and can outlive its Lesson/Run source.
 */
export type LearningRecord = {
  id: string;
  learnerProfileId: string;
  recordedByAccountId: string;
  learnerDisplayName: string;
  lessonRunId: string | null;
  sourceCourseId: string | null;
  sourceLessonId: string | null;
  occurredAt: string | null;
  wasPresent: boolean | null;
  needsRepeat: boolean | null;
  teacherComment: string;
  sharedWithLearnerAt?: string | null;
  actualDurationMinutesAtTime?: number | null;
  supersededByRecordId?: string | null;
  courseTitleAtTime: string | null;
  lessonTitleAtTime: string | null;
  subjectAtTime: string | null;
  createdAt: string;
  updatedAt: string;
};

/**
 * A concrete appointment/execution of the editable Lesson. There is no
 * persisted status: scheduled/running/completed/cancelled is derived from the
 * four timestamps.
 */
export type LessonRun = {
  id: string;
  lessonId: string;
  courseId: string;
  lessonTitle: string;
  courseTitle: string;
  scheduledAt: string;
  plannedDurationMinutes: number;
  actualDurationMinutes?: number | null;
  startedAt: string | null;
  startedAtIsActual?: boolean;
  endedAt: string | null;
  cancelledAt: string | null;
  teacherReport: string;
  records: LearningRecord[];
  createdAt: string;
  updatedAt: string;
};

export type LessonRunContext = {
  run: LessonRun;
  ownerAccountId: string;
};

export type LessonReference = {
  id: string;
  courseId: string;
  title: string;
};

export type CourseReference = {
  id: string;
  ownerAccountId: string;
  title: string;
  subject: string;
};
