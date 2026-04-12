import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const studentDashboardSource = readFileSync(
  "src/components/dashboard/student-dashboard.tsx",
  "utf8",
);
const parentDashboardSource = readFileSync(
  "src/components/dashboard/parent-dashboard.tsx",
  "utf8",
);

test("student dashboard links lessons to canonical scheduled lesson route", () => {
  assert.equal(studentDashboardSource.includes("toScheduledLessonRoute"), true);
  assert.equal(studentDashboardSource.includes("toStudentLessonRoomRoute"), false);
  assert.equal(studentDashboardSource.includes("/lesson-room/"), false);
});

test("parent dashboard links lessons to canonical scheduled lesson route", () => {
  assert.equal(parentDashboardSource.includes("toScheduledLessonRoute"), true);
  assert.equal(parentDashboardSource.includes("toParentLessonRoomRoute"), false);
  assert.equal(parentDashboardSource.includes("/children/"), false);
  assert.equal(parentDashboardSource.includes("/lesson-room/"), false);
});
