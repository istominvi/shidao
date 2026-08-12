import assert from "node:assert/strict";
import test from "node:test";
import {
  courseLessonContentUpdatedAt,
  lessonScheduleInfo,
} from "./course-lesson-table";
import type { CourseLesson } from "@/modules/course-builder/domain";
import type { LessonRun } from "@/modules/lesson-runs/domain";

function lessonRun(
  overrides: Partial<LessonRun> & Pick<LessonRun, "id">,
): LessonRun {
  const { id, ...rest } = overrides;
  return {
    id,
    lessonId: "44444444-4444-4444-8444-444444444444",
    courseId: "33333333-3333-4333-8333-333333333333",
    lessonTitle: "Урок",
    courseTitle: "Курс",
    scheduledAt: "2026-08-12T08:00:00.000Z",
    plannedDurationMinutes: 45,
    startedAt: null,
    endedAt: null,
    cancelledAt: null,
    teacherReport: "",
    records: [],
    createdAt: "2026-08-11T08:00:00.000Z",
    updatedAt: "2026-08-11T08:00:00.000Z",
    ...rest,
  };
}

test("lesson schedule projection distinguishes never assigned and completed-only lessons", () => {
  assert.deepEqual(lessonScheduleInfo([]), {
    label: "Не назначен",
    rank: 4,
    timestamp: Number.POSITIVE_INFINITY,
  });

  const endedAt = "2026-08-12T09:00:00.000Z";
  assert.deepEqual(
    lessonScheduleInfo([
      lessonRun({
        id: "88888888-8888-4888-8888-888888888888",
        startedAt: "2026-08-12T08:00:00.000Z",
        endedAt,
      }),
    ]),
    {
      label: "Проводился ранее",
      rank: 3,
      timestamp: Date.parse(endedAt),
    },
  );
});

test("lesson schedule projection prioritizes the current run over history", () => {
  assert.deepEqual(
    lessonScheduleInfo([
      lessonRun({
        id: "88888888-8888-4888-8888-888888888887",
        endedAt: "2026-08-11T09:00:00.000Z",
      }),
      lessonRun({
        id: "88888888-8888-4888-8888-888888888889",
        startedAt: "2026-08-12T08:00:00.000Z",
      }),
    ]),
    {
      label: "Идёт сейчас",
      rank: 0,
      timestamp: Date.parse("2026-08-12T08:00:00.000Z"),
    },
  );
});

test("lesson schedule projection uses the provided clock at the schedule boundary", () => {
  const scheduled = lessonRun({
    id: "88888888-8888-4888-8888-888888888886",
  });

  assert.equal(
    lessonScheduleInfo([scheduled], new Date("2026-08-12T07:59:59.999Z")).rank,
    2,
  );
  assert.deepEqual(
    lessonScheduleInfo([scheduled], new Date(scheduled.scheduledAt)),
    {
      label: "Нужно отметить",
      rank: 1,
      timestamp: Date.parse(scheduled.scheduledAt),
    },
  );
});

test("lesson content update uses the newest lesson, component, or slide timestamp", () => {
  const lesson: CourseLesson = {
    id: "44444444-4444-4444-8444-444444444444",
    courseId: "33333333-3333-4333-8333-333333333333",
    position: 1,
    title: "Урок",
    summary: "",
    components: [
      {
        id: "77777777-7777-4777-8777-777777777777",
        lessonId: "44444444-4444-4444-8444-444444444444",
        typeKey: "heading",
        schemaVersion: 1,
        position: 1,
        payload: {},
        placement: {},
        visibility: "staff_only",
        studentSlideId: null,
        createdAt: "2026-08-10T08:00:00.000Z",
        updatedAt: "2026-08-13T08:00:00.000Z",
      },
    ],
    studentSlides: [
      {
        id: "99999999-9999-4999-8999-999999999999",
        lessonId: "44444444-4444-4444-8444-444444444444",
        position: 1,
        createdAt: "2026-08-11T08:00:00.000Z",
        updatedAt: "2026-08-12T08:00:00.000Z",
      },
    ],
    createdAt: "2026-08-09T08:00:00.000Z",
    updatedAt: "2026-08-10T08:00:00.000Z",
  };

  assert.equal(
    courseLessonContentUpdatedAt(lesson),
    "2026-08-13T08:00:00.000Z",
  );

  assert.equal(
    courseLessonContentUpdatedAt({
      ...lesson,
      updatedAt: "2026-08-14T08:00:00.000Z",
    }),
    "2026-08-14T08:00:00.000Z",
  );

  assert.equal(
    courseLessonContentUpdatedAt({
      ...lesson,
      components: lesson.components.map((component) => ({
        ...component,
        createdAt: "2026-08-15T08:00:00.000Z",
        updatedAt: "2026-08-11T08:00:00.000Z",
      })),
    }),
    "2026-08-15T08:00:00.000Z",
  );

  assert.equal(
    courseLessonContentUpdatedAt({
      ...lesson,
      components: lesson.components.map((component) => ({
        ...component,
        createdAt: "2026-08-10T08:00:00.000Z",
        updatedAt: "2026-08-11T08:00:00.000Z",
      })),
      studentSlides: lesson.studentSlides.map((slide) => ({
        ...slide,
        updatedAt: "2026-08-16T08:00:00.000Z",
      })),
    }),
    "2026-08-16T08:00:00.000Z",
  );
});
