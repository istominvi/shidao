import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

function source(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

const quiz = source(
  "src/components/learning-activities/learner-choice-quiz.tsx",
);
const client = source(
  "src/components/learning-activities/choice-quiz-client.ts",
);
const draft = source(
  "src/components/learning-activities/learner-choice-quiz-draft.ts",
);
const integration = source(
  "src/components/learning-activities/learner-live-delivery.tsx",
);
const css = source(
  "src/components/learning-activities/learner-choice-quiz.module.css",
);

test("issued choice quiz uses semantic single/multiple selection and server-only grading", () => {
  assert.match(quiz, /<fieldset/);
  assert.match(quiz, /<legend/);
  assert.match(quiz, /type=\{payload\.allowMultiple \? "checkbox" : "radio"\}/);
  assert.match(quiz, /latestFeedback\.isCorrect/);
  assert.match(quiz, /latestFeedback\?\.reveal\?\.correctOptionIds/);
  assert.doesNotMatch(
    quiz,
    /option\.isCorrect|correctOptionIds.*component\.payload/,
  );
  assert.match(quiz, /Ответ проверит сервер после явной отправки/);
  assert.match(quiz, /Частичного зачёта нет/);
});

test("choice quiz preserves the exact request across transient retry and refreshes stale live state", () => {
  assert.match(quiz, /prepareLearnerChoiceQuizSubmission/);
  assert.match(draft, /draft\.pendingSubmission \?\?/);
  assert.match(quiz, /globalThis\.crypto\.randomUUID\(\)/);
  assert.match(quiz, /selectedOptionIds: request\.selectedOptionIds/);
  assert.match(quiz, /clientError\.failure === "stale"/);
  assert.match(quiz, /onLiveStateInvalidated\(\)/);
  assert.match(quiz, /Повторить отправку/);
  assert.match(client, /status === 409/);
  assert.match(client, /ChoiceQuizSubmitError\("stale"/);
});

test("choice quiz announces results, restores persisted selection, and exposes only policy states", () => {
  assert.match(draft, /execution\.latestFeedback\?\.selectedOptionIds/);
  assert.match(quiz, /aria-live=\{submitError \? "assertive" : "polite"\}/);
  assert.match(quiz, /aria-atomic="true"/);
  assert.match(quiz, /tabIndex=\{-1\}/);
  assert.match(quiz, /latestFeedback\?\.canRetry/);
  assert.match(quiz, /latestFeedback\.reveal\.explanation/);
  assert.doesNotMatch(quiz, /hint|mastery|objective/);
});

test("choice quiz draft stays parent-owned while reconnecting hides stale content", () => {
  assert.match(integration, /useState<LearnerChoiceQuizDrafts>/);
  assert.match(integration, /choiceQuizDrafts\[execution\.data\.issueRef\]/);
  assert.match(integration, /activeChoiceQuizIssueRefs/);
  assert.match(integration, /retainLearnerChoiceQuizDrafts/);
  assert.match(integration, /view\.kind === "reconnecting"/);
  assert.match(integration, /return null/);
  assert.match(integration, /Соединение прервано\. Содержимое скрыто/);
  assert.doesNotMatch(integration, /localStorage|sessionStorage/);
  assert.doesNotMatch(draft, /evaluator|correctOptionIds|definitionRevision/);
});

test("only issued choice quiz becomes interactive while all other live activities remain presentation-only", () => {
  assert.match(integration, /component\.typeKey === "choice_quiz"/);
  assert.match(integration, /choiceQuizLearnerExecutionSchema\.safeParse/);
  assert.match(integration, /<LearnerChoiceQuiz/);
  assert.match(integration, /interaction="presentation"/);
});

test("choice quiz supports touch, focus, reduced motion and forced colors", () => {
  assert.match(css, /min-height: 3rem/);
  assert.match(css, /:has\(input:focus-visible\)/);
  assert.match(css, /@media \(max-width: 640px\), \(pointer: coarse\)/);
  assert.match(css, /min-height: 3\.5rem/);
  assert.match(css, /overflow-wrap: anywhere/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /transition: none/);
  assert.match(css, /@media \(forced-colors: active\)/);
});
