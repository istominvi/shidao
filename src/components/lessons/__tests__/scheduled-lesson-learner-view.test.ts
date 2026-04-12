import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const source = readFileSync(
  "src/components/lessons/scheduled-lesson-learner-view.tsx",
  "utf8",
);

test("learner lesson view supports dedicated preview role", () => {
  assert.equal(source.includes("ScheduledLessonPreviewView"), true);
  assert.equal(source.includes("Предпросмотр урока"), false);
});

test("learner lesson view does not force UTC timezone", () => {
  assert.equal(source.includes('timeZone: "UTC"'), false);
  assert.equal(source.includes('new Intl.DateTimeFormat("ru-RU"'), false);
});

test("learner lesson view no longer renders page-level handcrafted h1 header", () => {
  assert.equal(source.includes("<h1"), false);
  assert.equal(source.includes("model.lessonTitle"), false);
});
