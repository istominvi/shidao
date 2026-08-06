import assert from "node:assert/strict";
import test from "node:test";
import {
  completedLessonRunCount,
  lessonRunState,
  openLessonRun,
} from "./lesson-run-format";
import type { LessonRun } from "@/modules/lesson-runs/domain";

function run(overrides: Partial<LessonRun> = {}): LessonRun {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    lessonId: "22222222-2222-4222-8222-222222222222",
    courseId: "33333333-3333-4333-8333-333333333333",
    lessonTitle: "Дроби",
    courseTitle: "Математика",
    scheduledAt: "2026-08-08T10:00:00.000Z",
    plannedDurationMinutes: 60,
    startedAt: null,
    endedAt: null,
    cancelledAt: null,
    teacherReport: "",
    records: [],
    createdAt: "2026-08-07T10:00:00.000Z",
    updatedAt: "2026-08-07T10:00:00.000Z",
    ...overrides,
  };
}

test("LessonRun UI derives lifecycle only from timestamps", () => {
  const before = new Date("2026-08-08T09:00:00.000Z");
  const after = new Date("2026-08-08T11:00:00.000Z");

  assert.equal(lessonRunState(run(), before), "scheduled");
  assert.equal(lessonRunState(run(), after), "attention");
  assert.equal(
    lessonRunState(run({ startedAt: "2026-08-08T10:02:00.000Z" }), after),
    "active",
  );
  assert.equal(
    lessonRunState(run({ endedAt: "2026-08-08T10:58:00.000Z" }), after),
    "completed",
  );
  assert.equal(
    lessonRunState(run({ cancelledAt: "2026-08-08T09:30:00.000Z" }), after),
    "cancelled",
  );
});

test("open alarm and completed count remain separate projections", () => {
  const completed = run({
    id: "44444444-4444-4444-8444-444444444444",
    endedAt: "2026-08-08T10:58:00.000Z",
  });
  const scheduled = run({
    id: "55555555-5555-4555-8555-555555555555",
    scheduledAt: "2026-08-09T10:00:00.000Z",
  });

  assert.equal(openLessonRun([completed, scheduled])?.id, scheduled.id);
  assert.equal(completedLessonRunCount([completed, scheduled]), 1);
});
