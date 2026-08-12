import {
  completedLessonRunCount,
  lessonRunState,
  lessonRunStateLabel,
  openLessonRun,
} from "@/components/lesson-runs/lesson-run-format";
import type { CourseLesson } from "@/modules/course-builder/domain";
import type { LessonRun } from "@/modules/lesson-runs/domain";

const lessonRunStateOrder = {
  active: 0,
  attention: 1,
  scheduled: 2,
  completed: 3,
  cancelled: 4,
} as const;

export function lessonScheduleInfo(runs: LessonRun[], now: Date = new Date()) {
  const currentRun = openLessonRun(runs);
  if (currentRun) {
    return {
      label: lessonRunStateLabel(currentRun, now),
      rank: lessonRunStateOrder[lessonRunState(currentRun, now)],
      timestamp: new Date(currentRun.scheduledAt).getTime(),
    };
  }

  const completedRuns = runs.filter((run) => Boolean(run.endedAt));
  if (completedLessonRunCount(completedRuns) > 0) {
    return {
      label: "Проводился ранее",
      rank: 3,
      timestamp: Math.max(
        ...completedRuns.map((run) =>
          new Date(run.endedAt ?? run.scheduledAt).getTime(),
        ),
      ),
    };
  }

  return {
    label: "Не назначен",
    rank: 4,
    timestamp: Number.POSITIVE_INFINITY,
  };
}

export function courseLessonContentUpdatedAt(lesson: CourseLesson) {
  const values = [
    lesson.updatedAt,
    ...lesson.components.flatMap((component) => [
      component.createdAt,
      component.updatedAt,
    ]),
    ...lesson.studentSlides.flatMap((slide) => [
      slide.createdAt,
      slide.updatedAt,
    ]),
  ];
  const timestamps = values
    .map((value) => Date.parse(value))
    .filter(Number.isFinite);
  return timestamps.length > 0
    ? new Date(Math.max(...timestamps)).toISOString()
    : lesson.updatedAt;
}
