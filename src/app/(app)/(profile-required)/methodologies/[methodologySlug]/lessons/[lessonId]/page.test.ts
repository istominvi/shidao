import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const pageSource = readFileSync(
  "src/app/(app)/(profile-required)/methodologies/[methodologySlug]/lessons/[lessonId]/page.tsx",
  "utf8",
);

test("methodology lesson page uses shared teacher workspace tabs", () => {
  assert.equal(pageSource.includes("TeacherMethodologyLessonWorkspace"), true);
  assert.equal(pageSource.includes("Каноничное домашнее задание методики"), false);
  assert.equal(pageSource.includes("LessonContextChip"), false);
  assert.equal(pageSource.includes("LessonMetaRail"), true);
  assert.equal(pageSource.includes("LessonMetaPill"), true);
  assert.equal(pageSource.includes("Source-урок методики"), false);
  assert.equal(pageSource.includes('icon="position"'), true);
  assert.equal(pageSource.includes('icon="duration"'), true);
  assert.equal(pageSource.includes('icon="readiness"'), true);
});
