import type { CourseLearningAudience } from "@/modules/course-builder/learning-audience";
import type {
  ActivityRole,
  ComponentTypeKey,
} from "@/modules/course-builder/registry/contracts";

export type CoursePublicationStatus = "published" | "unpublished";
export type EducatorCourseReviewStatus = "pending" | "approved" | "rejected";

export type OwnedCoursePublication = {
  id: string;
  status: CoursePublicationStatus;
  currentRevisionId: string | null;
  publishedAt: string | null;
  updatedAt: string;
  hasUnpublishedChanges: boolean;
  reviewStatus: EducatorCourseReviewStatus | null;
  reviewRevisionId: string | null;
  approvedRevisionId: string | null;
};

export type CourseCatalogAuthor = {
  displayName: string;
  isShiDao: boolean;
  isCurrentUser: boolean;
};

export type CourseCatalogEntry = {
  id: string;
  /** Owner-only projection. Always null for publications owned by others. */
  sourceCourseId: string | null;
  learningAudience: CourseLearningAudience;
  title: string;
  subject: string;
  goal: string;
  level: string;
  audienceDescription: string;
  targetLessonCount: number;
  lessonCount: number;
  materialCount: number;
  publishedAt: string;
  author: CourseCatalogAuthor;
};

export type CourseCatalogLesson = {
  id: string;
  position: number;
  title: string;
  estimatedDurationMinutes: number | null;
  slides: CourseCatalogSlide[];
};

export type CourseCatalogComponent = {
  id: string;
  position: number;
  typeKey: ComponentTypeKey;
  schemaVersion: number;
  payload: Record<string, unknown>;
  placement: Record<string, unknown>;
};

export type CourseCatalogSlide = {
  id: string;
  position: number;
  components: CourseCatalogComponent[];
};

export type CourseCatalogMaterial = {
  id: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  downloadUrl: string;
};

export type CourseCatalogDetail = CourseCatalogEntry & {
  revisionId: string;
  lessons: CourseCatalogLesson[];
  materials: CourseCatalogMaterial[];
};

export type CourseCatalogPage = {
  courses: CourseCatalogEntry[];
  facets: {
    subjects: string[];
    levels: string[];
  };
  nextCursor: string | null;
};

export type CopiedCourseResult = {
  courseId: string;
};

export type PublicationSnapshotMaterial = {
  ref: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  checksumSha256: string;
};

export type PublicationSnapshotSlide = {
  ref: string;
  position: number;
};

export type PublicationSnapshotComponentV1 = {
  ref: string;
  position: number;
  typeKey: ComponentTypeKey;
  schemaVersion: number;
  payload: Record<string, unknown>;
  placement: Record<string, unknown>;
  visibility: "learner_visible" | "staff_only";
  studentSlideRef: string | null;
};

export type PublicationSnapshotComponentV2 = PublicationSnapshotComponentV1 & {
  primaryObjectiveRef: string | null;
  activityRole: ActivityRole | null;
};

export type PublicationSnapshotComponent =
  PublicationSnapshotComponentV1 | PublicationSnapshotComponentV2;

export type PublicationSnapshotLessonV1 = {
  ref: string;
  position: number;
  title: string;
  summary: string;
  estimatedDurationMinutes: number | null;
  components: PublicationSnapshotComponentV1[];
  slides: PublicationSnapshotSlide[];
};

export type PublicationSnapshotLessonV2 = Omit<
  PublicationSnapshotLessonV1,
  "components"
> & {
  components: PublicationSnapshotComponentV2[];
};

export type PublicationSnapshotLesson =
  PublicationSnapshotLessonV1 | PublicationSnapshotLessonV2;

export type PublicationSnapshotObjective = {
  ref: string;
  position: number;
  title: string;
  description: string | null;
  archivedAt: string | null;
};

type PublicationSnapshotCourse = Pick<
  CourseCatalogEntry,
  | "title"
  | "subject"
  | "goal"
  | "level"
  | "audienceDescription"
  | "targetLessonCount"
>;

/** Immutable legacy shape. Keep exact: old revisions are read, never rewritten. */
export type CoursePublicationSnapshotV1 = {
  schemaVersion: 1;
  course: PublicationSnapshotCourse;
  lessons: PublicationSnapshotLessonV1[];
  materials: PublicationSnapshotMaterial[];
};

export type CoursePublicationSnapshotV2 = {
  schemaVersion: 2;
  course: PublicationSnapshotCourse;
  objectives: PublicationSnapshotObjective[];
  lessons: PublicationSnapshotLessonV2[];
  materials: PublicationSnapshotMaterial[];
};

export type CoursePublicationSnapshot =
  CoursePublicationSnapshotV1 | CoursePublicationSnapshotV2;

export type PublicationAssetManifestItem = Omit<
  PublicationSnapshotMaterial,
  "ref"
> & {
  publicationAssetId: string;
  sourceStoredFileId: string;
  storageBucket: "course-publication-assets";
  storagePath: string;
};

export type ClonedAssetManifestItem = Omit<
  PublicationSnapshotMaterial,
  "ref"
> & {
  publicationAssetId: string;
  targetStoredFileId: string;
  storageBucket: "course-assets";
  storagePath: string;
};

export type PublicationIdMap = {
  objectives: Array<{ ref: string; id: string }>;
  lessons: Array<{ ref: string; id: string }>;
  components: Array<{ ref: string; id: string }>;
  slides: Array<{ ref: string; id: string }>;
};
