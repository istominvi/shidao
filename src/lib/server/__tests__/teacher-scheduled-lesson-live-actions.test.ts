import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const source = readFileSync(
  "src/lib/server/teacher-scheduled-lesson-live-actions.ts",
  "utf8",
);

test("live actions include required start/set-step/next/previous/complete operations", () => {
  assert.equal(source.includes('type LiveAction = "start" | "set_step" | "next" | "previous" | "complete"'), true);
  assert.equal(source.includes('input.action === "start"'), true);
  assert.equal(source.includes('input.action === "set_step"'), true);
  assert.equal(source.includes('input.action === "next"'), true);
  assert.equal(source.includes('input.action === "previous"'), true);
  assert.equal(source.includes('input.action === "complete"'), true);
  assert.equal(source.includes("loadScheduledLessonUnifiedSeedAdmin"), true);
  assert.equal(source.includes("buildTeacherLessonWorkspaceReadModel"), true);
  assert.equal(source.includes("buildMethodologyLessonUnifiedReadModel"), false);
});

test("live action mutation sets lock and completion semantics", () => {
  assert.equal(source.includes("runtimeStudentNavigationLocked: true"), true);
  assert.equal(source.includes("runtimeStudentNavigationLocked: false"), true);
  assert.equal(source.includes("runtimeCompletedAt"), true);
  assert.equal(source.includes("runtimeStartedAt"), true);
  assert.equal(source.includes("runtimeStepUpdatedAt"), true);
});
