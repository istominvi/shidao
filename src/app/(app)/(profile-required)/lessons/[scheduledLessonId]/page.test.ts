import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const pageSource = readFileSync(
  "src/app/(app)/(profile-required)/lessons/[scheduledLessonId]/page.tsx",
  "utf8",
);

test("canonical scheduled lesson page resolves role-aware server projections", () => {
  assert.equal(pageSource.includes("getTeacherScheduledLessonView"), true);
  assert.equal(pageSource.includes("getStudentScheduledLessonView"), true);
  assert.equal(pageSource.includes("getParentScheduledLessonView"), true);
  assert.equal(pageSource.includes("ScheduledLessonLearnerView"), true);
  assert.equal(
    pageSource.includes('role: "parent", childrenRuntime: []'),
    false,
  );
  assert.equal(pageSource.includes("AppPageHeader"), true);
  assert.equal(pageSource.includes("toMethodologyLessonRoute"), false);
  assert.equal(pageSource.includes("workspace.sourceLesson"), false);
  assert.equal(pageSource.includes("backHref={ROUTES.schedule}"), true);
  assert.equal(pageSource.includes("LessonMetaRail"), true);
  assert.equal(pageSource.includes("LessonMetaPill"), true);
});
