import type {
  ActivityRole,
  ComponentTypeKey,
  CreatableComponentTypeKey,
} from "./registry/contracts";
import type { ComponentVisibility } from "./component-visibility";
import type { OwnedCoursePublication } from "@/modules/course-publications/domain";
import type { CourseLearningAudience } from "./learning-audience";

export type { ComponentVisibility } from "./component-visibility";

export type CourseStatus = "draft";
export type StoredFileStatus = "pending" | "ready";

export type CourseSummary = {
  id: string;
  ownerAccountId: string;
  title: string;
  learningAudience: CourseLearningAudience;
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
  publicationContentUpdatedAt: string;
  publication?: OwnedCoursePublication | null;
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

export type LearningObjective = {
  id: string;
  courseId: string;
  title: string;
  description: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type LessonComponent = {
  id: string;
  lessonId: string;
  typeKey: ComponentTypeKey;
  schemaVersion: number;
  position: number;
  payload: Record<string, unknown>;
  placement: Record<string, unknown>;
  visibility: ComponentVisibility;
  studentSlideId: string | null;
  primaryLearningObjectiveId: string | null;
  activityRole: ActivityRole | null;
  createdAt: string;
  updatedAt: string;
};

export type LessonStudentSlide = {
  id: string;
  lessonId: string;
  position: number;
  createdAt: string;
  updatedAt: string;
};

export type LearnerSafeLessonComponent = Omit<
  LessonComponent,
  "payload" | "primaryLearningObjectiveId" | "activityRole"
> & {
  payload: Record<string, unknown>;
};

export type CourseLesson = {
  id: string;
  courseId: string;
  position: number;
  title: string;
  summary: string;
  estimatedDurationMinutes?: number | null;
  components: LessonComponent[];
  studentSlides: LessonStudentSlide[];
  createdAt: string;
  updatedAt: string;
};

export type CourseWorkspace = CourseSummary & {
  lessons: CourseLesson[];
  attachments: CourseAsset[];
  learningObjectives: LearningObjective[];
};

export type StudentScreenSlide = LessonStudentSlide & {
  components: LearnerSafeLessonComponent[];
};

export type StudentScreenLesson = Omit<
  CourseLesson,
  "summary" | "components" | "studentSlides"
> & {
  slides: StudentScreenSlide[];
};

/**
 * Explicit learner-facing projection used by Student Screen preview. Teacher
 * Teacher-only fields are absent from this contract, not merely hidden by CSS.
 */
export type StudentScreenCourse = Pick<CourseWorkspace, "id" | "title"> & {
  lessons: StudentScreenLesson[];
  attachments: CourseAsset[];
};

export type CourseBuilderActor = {
  authUserId: string;
  /** Exact Supabase Auth session from the verified server-held user JWT. */
  supabaseSessionId: string;
  accessToken: string;
  /** Fresh Account capability, absent/false for non-browser adapters. */
  canAuthorEducatorCourses?: boolean;
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
  componentIds: string[];
  alreadyAssembled: boolean;
};

export type CourseDraftAssemblyComponent = {
  typeKey: CreatableComponentTypeKey;
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
  components: CourseDraftAssemblyComponent[];
};
