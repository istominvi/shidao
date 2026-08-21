import type { HomeworkItemTypeKey } from "./contracts";

export type LessonHomeworkItem = {
  id: string;
  position: number;
  typeKey: HomeworkItemTypeKey;
  schemaVersion: number;
  payload: Record<string, unknown>;
  placement: Record<string, unknown>;
};

export type LessonHomeworkDraftItem = Omit<LessonHomeworkItem, "position">;

export type LessonHomework = {
  id: string;
  lessonId: string;
  revision: number;
  items: LessonHomeworkItem[];
  createdAt: string;
  updatedAt: string;
};

export type LessonHomeworkScope = {
  courseId: string;
  lessonId: string;
  homework: LessonHomework | null;
};
