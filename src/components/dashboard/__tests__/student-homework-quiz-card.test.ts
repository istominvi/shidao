import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const source = readFileSync("src/components/dashboard/student-homework-quiz-card.tsx", "utf8");

test("student homework card includes matching and audio review practice surfaces", () => {
  assert.equal(source.includes("MatchingPractice"), true);
  assert.equal(source.includes("AudioReviewPractice"), true);
  assert.equal(source.includes("draggable"), true);
  assert.equal(source.includes("practiceSections"), true);
});
