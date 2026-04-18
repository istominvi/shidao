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

test("shared learner deck uses scene grouping with stronger progression rhythm", () => {
  assert.equal(sharedDeckSource.includes("groupScenes"), true);
  assert.equal(sharedDeckSource.includes("Сцена"), true);
  assert.equal(sharedDeckSource.includes("FlashcardCarousel"), true);
  assert.equal(sharedDeckSource.includes("ActionSlider"), true);
  assert.equal(sharedDeckSource.includes('section.type === "presentation"'), true);
  assert.equal(sharedDeckSource.includes("slideImageRefs"), true);
  assert.equal(sharedDeckSource.includes('section.type === "count_board"'), true);
  assert.equal(sharedDeckSource.includes("previewImageRef"), true);
});

test("shared learner deck gracefully handles media without source url", () => {
  assert.equal(sharedDeckSource.includes("Материал покажет преподаватель на уроке"), true);
  assert.equal(sharedDeckSource.includes("sourceUrl"), true);
});
