import type { ScheduleViewMode } from "@/components/dashboard/teacher-schedule-utils";

export type TeacherScheduleEvent = {
  id: string;
  href: string;
  startsAt: string;
  endsAt: string;
  durationMinutes: number;
  isoDate: string;
  groupLabel: string;
  lessonTitle: string;
  format: "online" | "offline";
  formatLabel: string;
  status: string;
  statusLabel: string;
  timeLabel: string;
  timeRangeLabel: string;
};

export type TeacherScheduleInteractionMode = "navigate" | "select";

export type TeacherScheduleToolbarState = {
  view: ScheduleViewMode;
  date: string;
  search: string;
  classId: string;
  methodologyLessonId: string;
  format: "" | "online" | "offline";
  status: "" | "planned" | "in_progress" | "completed" | "cancelled";
};
