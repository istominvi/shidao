import assert from "node:assert/strict";
import test from "node:test";
import type { ChoiceQuizHistoryItem } from "./choice-quiz-history-format";
import {
  choiceQuizRoleLabel,
  choiceQuizSupportLabel,
  groupChoiceQuizAttemptHistory,
} from "./choice-quiz-history-format";

const INITIAL_EVALUATION_ID = "11111111-1111-4111-8111-111111111111";
const CORRECTION_EVALUATION_ID = "22222222-2222-4222-8222-222222222222";
const OPTION_A = "33333333-3333-4333-8333-333333333333";
const OPTION_B = "44444444-4444-4444-8444-444444444444";

function evaluation(
  overrides: Partial<ChoiceQuizHistoryItem> = {},
): ChoiceQuizHistoryItem {
  return {
    issueRef: `cqi_${"a".repeat(64)}`,
    evaluationId: INITIAL_EVALUATION_ID,
    supersedesEvaluationId: null,
    supersededByEvaluationId: CORRECTION_EVALUATION_ID,
    learnerProfileId: "55555555-5555-4555-8555-555555555555",
    learnerDisplayName: "Анна",
    componentLabelAtTime: "Какая дробь больше половины?",
    objectiveTitleAtTime: "Сравнивать дроби",
    activityRole: "practice",
    question: "Какая дробь больше половины?",
    shownOptions: [
      { id: OPTION_A, label: "2/3" },
      { id: OPTION_B, label: "1/3" },
    ],
    attemptNumber: 1,
    selectedOptions: [{ id: OPTION_A, label: "2/3" }],
    isCorrect: false,
    score: 0,
    supportContext: "independent",
    hintCount: 0,
    revealAvailable: false,
    evaluatorVersion: "choice_quiz_exact_set_v1",
    evaluatorFingerprint: `cqef_v1_${"b".repeat(64)}`,
    evaluatedAt: "2026-08-21T10:00:00.000Z",
    correctionReason: null,
    ...overrides,
  };
}

test("history groups one attempt into a chronological transparent correction chain", () => {
  const correction = evaluation({
    evaluationId: CORRECTION_EVALUATION_ID,
    supersedesEvaluationId: INITIAL_EVALUATION_ID,
    supersededByEvaluationId: null,
    isCorrect: true,
    score: 1,
    evaluatedAt: "2026-08-21T10:05:00.000Z",
    correctionReason: "Учитель перепроверил ответ.",
  });

  const groups = groupChoiceQuizAttemptHistory([
    correction,
    evaluation(),
    evaluation({
      issueRef: `cqi_${"c".repeat(64)}`,
      evaluationId: "66666666-6666-4666-8666-666666666666",
      supersededByEvaluationId: null,
      learnerDisplayName: "Борис",
      attemptNumber: 2,
    }),
  ]);

  assert.equal(groups.length, 2);
  assert.equal(groups[0]?.learnerDisplayName, "Анна");
  assert.deepEqual(
    groups[0]?.evaluations.map((item) => item.evaluationId),
    [INITIAL_EVALUATION_ID, CORRECTION_EVALUATION_ID],
  );
  assert.equal(
    groups[0]?.evaluations[1]?.correctionReason,
    "Учитель перепроверил ответ.",
  );
  assert.equal(groups[1]?.attemptNumber, 2);
});

test("history labels role and support without inferring hidden evaluator state", () => {
  assert.equal(choiceQuizRoleLabel("practice"), "Практика");
  assert.equal(choiceQuizRoleLabel("assessment"), "Проверочная работа");
  assert.equal(choiceQuizSupportLabel("independent"), "Самостоятельно");
  assert.equal(choiceQuizSupportLabel("with_support"), "С поддержкой");
});
