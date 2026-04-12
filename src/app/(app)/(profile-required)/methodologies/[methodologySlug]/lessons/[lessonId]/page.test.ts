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
});
