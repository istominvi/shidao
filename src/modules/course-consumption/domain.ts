export type CoursePublicationProgress = {
  publicationId: string;
  revisionId: string;
  completedLessonRefs: string[];
  lastOpenedLessonRef: string | null;
  completedLessonCount: number;
  totalLessonCount: number;
  percent: number;
  complete: boolean;
};
