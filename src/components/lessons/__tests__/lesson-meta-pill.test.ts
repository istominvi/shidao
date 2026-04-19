import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const source = readFileSync("src/components/lessons/lesson-meta-pill.tsx", "utf8");

test("lesson meta pill defines shared icon map and semantic tones", () => {
  assert.equal(source.includes("lessonMetaIconMap"), true);
  assert.equal(source.includes('"group"'), true);
  assert.equal(source.includes('"datetime"'), true);
  assert.equal(source.includes('"format"'), true);
  assert.equal(source.includes('"status"'), true);
  assert.equal(source.includes('"position"'), true);
  assert.equal(source.includes('"duration"'), true);
  assert.equal(source.includes('"readiness"'), true);
  assert.equal(source.includes('"methodology"'), true);
  assert.equal(source.includes('"teacher"'), true);
  assert.equal(source.includes("LessonMetaRail"), true);
  assert.equal(source.includes("LessonMetaPill"), true);
});
