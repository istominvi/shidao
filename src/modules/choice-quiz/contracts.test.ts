import assert from "node:assert/strict";
import test from "node:test";
import {
  choiceQuizLearnerExecutionSchema,
  issuedChoiceQuizProjectionSchema,
  submitChoiceQuizAttemptInputSchema,
} from "./contracts";

function uuid(index: number) {
  return `00000000-0000-4000-8000-${index.toString().padStart(12, "0")}`;
}

const ISSUE_REF = `cqi_${"a".repeat(64)}`;
const DEFINITION_REVISION = `cqd_v1_${"b".repeat(64)}`;

function feedback(overrides: Record<string, unknown> = {}) {
  return {
    attemptNumber: 1,
    selectedOptionIds: [uuid(1)],
    isCorrect: false,
    score: 0,
    submittedAt: "2026-08-21T08:00:00.000Z",
    canRetry: true,
    reveal: null,
    ...overrides,
  };
}

test("learner execution enforces practice retry and reveal policy", () => {
  const initial = {
    issueRef: ISSUE_REF,
    definitionRevision: DEFINITION_REVISION,
    attemptCount: 0,
    maxAttempts: 3,
    remainingAttempts: 3,
    hintAvailable: false,
    hintCount: 0,
    canSubmit: true,
    latestFeedback: null,
  };
  assert.deepEqual(choiceQuizLearnerExecutionSchema.parse(initial), initial);

  const retryable = {
    ...initial,
    attemptCount: 1,
    remainingAttempts: 2,
    latestFeedback: feedback(),
  };
  assert.deepEqual(
    choiceQuizLearnerExecutionSchema.parse(retryable),
    retryable,
  );

  assert.equal(
    choiceQuizLearnerExecutionSchema.safeParse({
      ...retryable,
      latestFeedback: feedback({
        reveal: { correctOptionIds: [uuid(1)] },
      }),
    }).success,
    false,
  );

  const exhausted = {
    ...initial,
    attemptCount: 3,
    remainingAttempts: 0,
    canSubmit: false,
    latestFeedback: feedback({
      attemptNumber: 3,
      canRetry: false,
      reveal: { correctOptionIds: [uuid(1)], explanation: "Пояснение" },
    }),
  };
  assert.deepEqual(
    choiceQuizLearnerExecutionSchema.parse(exhausted),
    exhausted,
  );
});

test("assessment feedback never reveals answers or retries", () => {
  const assessment = {
    issueRef: ISSUE_REF,
    definitionRevision: DEFINITION_REVISION,
    attemptCount: 1,
    maxAttempts: 1,
    remainingAttempts: 0,
    hintAvailable: false,
    hintCount: 0,
    canSubmit: false,
    latestFeedback: feedback({ canRetry: false }),
  };
  assert.deepEqual(
    choiceQuizLearnerExecutionSchema.parse(assessment),
    assessment,
  );
  assert.equal(
    choiceQuizLearnerExecutionSchema.safeParse({
      ...assessment,
      latestFeedback: feedback({
        canRetry: false,
        isCorrect: true,
        score: 1,
        reveal: { correctOptionIds: [uuid(1)] },
      }),
    }).success,
    false,
  );
});

test("issued projection is strict and contains only learner-safe definition fields", () => {
  const projection = {
    learnerDefinition: {
      question: "Что означает 道?",
      options: [
        { id: uuid(1), label: "Путь" },
        { id: uuid(2), label: "Дом" },
      ],
      allowMultiple: false,
    },
    execution: {
      issueRef: ISSUE_REF,
      definitionRevision: DEFINITION_REVISION,
      attemptCount: 0,
      maxAttempts: 3,
      remainingAttempts: 3,
      hintAvailable: false,
      hintCount: 0,
      canSubmit: true,
      latestFeedback: null,
    },
  };
  assert.deepEqual(
    issuedChoiceQuizProjectionSchema.parse(projection),
    projection,
  );
  for (const privateField of [
    "correctOptionIds",
    "evaluatorConfig",
    "activityRole",
    "primaryLearningObjectiveId",
    "componentId",
  ]) {
    assert.equal(
      issuedChoiceQuizProjectionSchema.safeParse({
        ...projection,
        [privateField]: privateField,
      }).success,
      false,
    );
  }
});

test("attempt input accepts authority-free single/multiple selections only", () => {
  const input = {
    idempotencyKey: uuid(10),
    cursorRevision: 7,
    selectedOptionIds: [uuid(1), uuid(2)],
  };
  assert.deepEqual(submitChoiceQuizAttemptInputSchema.parse(input), input);
  assert.equal(
    submitChoiceQuizAttemptInputSchema.safeParse({
      ...input,
      selectedOptionIds: [uuid(1), uuid(1)],
    }).success,
    false,
  );
  for (const forbidden of [
    "correctness",
    "score",
    "learnerProfileId",
    "accountId",
    "definitionRevision",
    "evaluatorConfig",
  ]) {
    assert.equal(
      submitChoiceQuizAttemptInputSchema.safeParse({
        ...input,
        [forbidden]: forbidden === "score" ? 1 : uuid(99),
      }).success,
      false,
    );
  }
});
