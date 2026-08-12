import type { CourseLearningAudience } from "@/modules/course-builder/learning-audience";

export type CoursePublicationStatus = "published" | "unpublished";

export type OwnedCoursePublication = {
  id: string;
  status: CoursePublicationStatus;
  currentRevisionId: string | null;
  publishedAt: string | null;
  updatedAt: string;
  hasUnpublishedChanges: boolean;
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
  position: number;
  title: string;
  summary: string;
  estimatedDurationMinutes: number | null;
};

export type CourseCatalogMaterial = {
  id: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  downloadUrl: string;
};

export type CourseCatalogDetail = CourseCatalogEntry & {
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

export type PublicationSnapshotComponent = {
  ref: string;
  position: number;
  typeKey: string;
  schemaVersion: number;
  payload: Record<string, unknown>;
  placement: Record<string, unknown>;
  visibility: "learner_visible" | "staff_only";
  studentSlideRef: string | null;
};

export type PublicationSnapshotLesson = CourseCatalogLesson & {
  ref: string;
  components: PublicationSnapshotComponent[];
  slides: PublicationSnapshotSlide[];
};

export type CoursePublicationSnapshot = {
  schemaVersion: 1;
  course: Pick<
    CourseCatalogEntry,
    | "title"
    | "subject"
    | "goal"
    | "level"
    | "audienceDescription"
    | "targetLessonCount"
  >;
  lessons: PublicationSnapshotLesson[];
  materials: PublicationSnapshotMaterial[];
};

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
  lessons: Array<{ ref: string; id: string }>;
  components: Array<{ ref: string; id: string }>;
  slides: Array<{ ref: string; id: string }>;
};
