import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const source = readFileSync(
  "src/components/lessons/scheduled-lesson-learner-view.tsx",
  "utf8",
);

const sharedDeckSource = readFileSync(
  "src/components/lessons/lesson-learner-content-deck.tsx",
  "utf8",
);

test("learner lesson view supports dedicated preview role", () => {
  assert.equal(source.includes("ScheduledLessonPreviewView"), true);
});

test("learner lesson view renders shared learner deck", () => {
  assert.equal(source.includes("LessonLearnerContentDeck"), true);
  assert.equal(source.includes("model.studentContent?.sections"), false);
});

test("shared learner deck gracefully handles media without source url", () => {
  assert.equal(sharedDeckSource.includes("Материал покажет преподаватель на уроке"), true);
  assert.equal(sharedDeckSource.includes("sourceUrl"), true);
});
