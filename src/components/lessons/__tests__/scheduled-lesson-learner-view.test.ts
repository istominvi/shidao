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

test("shared learner deck works as step-by-step player", () => {
  assert.equal(sharedDeckSource.includes("buildLegacyStepDeckFromStudentContent"), true);
  assert.equal(sharedDeckSource.includes("hasUnifiedSteps"), true);
  assert.equal(sharedDeckSource.includes("Шаг"), true);
  assert.equal(sharedDeckSource.includes("Сцена"), false);
  assert.equal(sharedDeckSource.includes("Назад"), true);
  assert.equal(sharedDeckSource.includes("Далее"), true);
  assert.equal(sharedDeckSource.includes("Инструкция для ученика"), true);
});

test("shared learner deck keeps existing rich renderers", () => {
  assert.equal(sharedDeckSource.includes("FlashcardCarousel"), true);
  assert.equal(sharedDeckSource.includes("ActionSlider"), true);
  assert.equal(sharedDeckSource.includes('section.type === "presentation"'), true);
  assert.equal(sharedDeckSource.includes('section.type === "count_board"'), true);
});
