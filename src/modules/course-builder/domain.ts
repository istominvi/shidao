import type { ComponentTypeKey } from "./registry/contracts";
import type { ComponentVisibility } from "./component-visibility";

export type { ComponentVisibility } from "./component-visibility";

export type CourseStatus = "draft";
export type StoredFileStatus = "pending" | "ready";

export type CourseSummary = {
  id: string;
  ownerAccountId: string;
  title: string;
  subject: string;
  goal: string;
  level: string;
  audienceDescription: string;
  targetLessonCount: number;
  teacherPreferences: string;
  status: CourseStatus;
  lessonCount: number;
  assembledAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CourseAsset = {
  id: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  checksumSha256: string;
  status: StoredFileStatus;
  signedUrl: string | null;
  createdAt: string;
};

export type LessonComponent = {
  id: string;
  stepId: string;
  typeKey: ComponentTypeKey;
  schemaVersion: number;
  position: number;
  payload: Record<string, unknown>;
  placement: Record<string, unknown>;
  visibility: ComponentVisibility;
  createdAt: string;
  updatedAt: string;
};

export type LessonStep = {
  id: string;
  lessonId: string;
  position: number;
  title: string;
  teacherInstructions: string;
  learnerInstruction: string;
  components: LessonComponent[];
  createdAt: string;
  updatedAt: string;
};

export type CourseLesson = {
  id: string;
  courseId: string;
  position: number;
  title: string;
  summary: string;
  steps: LessonStep[];
  createdAt: string;
  updatedAt: string;
};

export type CourseWorkspace = CourseSummary & {
  lessons: CourseLesson[];
  attachments: CourseAsset[];
};

export type StudentScreenStep = Omit<LessonStep, "teacherInstructions">;

export type StudentScreenLesson = Omit<CourseLesson, "steps" | "summary"> & {
  steps: StudentScreenStep[];
};

/**
 * Explicit learner-facing projection used by Student Screen preview. Teacher
 * methodology fields are absent from this contract, not merely hidden by CSS.
 */
export type StudentScreenCourse = Pick<CourseWorkspace, "id" | "title"> & {
  lessons: StudentScreenLesson[];
  attachments: CourseAsset[];
};

export type CourseBuilderActor = {
  authUserId: string;
  accessToken: string;
};

export type PreparedCourseAttachment = {
  asset: CourseAsset;
  upload: {
    bucket: string;
    path: string;
    signedUrl: string;
    token: string;
  };
};

export type AssembleCourseResult = {
  courseId: string;
  lessonIds: string[];
  stepIds: string[];
  componentIds: string[];
  alreadyAssembled: boolean;
};

export type CourseDraftAssemblyComponent = {
  typeKey: ComponentTypeKey;
  schemaVersion: number;
  payload: Record<string, unknown>;
  placement: Record<string, unknown>;
};

export type CourseDraftAssemblyPlan = {
  courseId: string;
  lesson: {
    title: string;
    summary: string;
  };
  step: {
    title: string;
    teacherInstructions: string;
    learnerInstruction: string;
  };
  components: CourseDraftAssemblyComponent[];
};
