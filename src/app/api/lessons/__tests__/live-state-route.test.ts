import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const source = readFileSync(
  "src/app/api/lessons/[scheduledLessonId]/live-state/route.ts",
  "utf8",
);

test("learner live-state route allows student and adult profiles", () => {
  assert.equal(
    source.includes('access.status !== "adult-with-profile" && access.status !== "student"'),
    true,
  );
  assert.equal(source.includes("listClassIdsForStudentAdmin"), true);
  assert.equal(source.includes("if (!classIds.includes(classId))"), true);
});
