import assert from "node:assert/strict";
import test from "node:test";
import type { ChoiceQuizLearnerExecution } from "@/modules/choice-quiz/contracts";
import {
  learnerChoiceQuizDraftFromExecution,
  learnerChoiceQuizExecutionAdvancesDraft,
  prepareLearnerChoiceQuizSubmission,
  retainLearnerChoiceQuizDrafts,
  setLearnerChoiceQuizDraft,
} from "./learner-choice-quiz-draft";

const ISSUE_REF = `cqi_${"a".repeat(64)}`;
const NEXT_ISSUE_REF = `cqi_${"b".repeat(64)}`;
const OPTION_ID = "11111111-1111-4111-8111-111111111111";
const IDEMPOTENCY_KEY = "22222222-2222-4222-8222-222222222222";

function execution(
  overrides: Partial<ChoiceQuizLearnerExecution> = {},
): ChoiceQuizLearnerExecution {
  return {
    issueRef: ISSUE_REF,
    definitionRevision: `cqd_v1_${"c".repeat(64)}`,
    attemptCount: 0,
    maxAttempts: 3,
    remainingAttempts: 3,
    canSubmit: true,
    hintAvailable: false,
    hintCount: 0,
    latestFeedback: null,
    ...overrides,
  };
}

test("choice quiz draft preserves selection and the exact pending key through reconnect remount", () => {
  const initial = {
    ...learnerChoiceQuizDraftFromExecution(execution()),
    selectedOptionIds: [OPTION_ID],
  };
  let createdKeys = 0;
  const prepared = prepareLearnerChoiceQuizSubmission(
    initial,
    initial.selectedOptionIds,
    () => {
      createdKeys += 1;
      return IDEMPOTENCY_KEY;
    },
  );
  const mounted = setLearnerChoiceQuizDraft({}, ISSUE_REF, prepared.draft);

  const reconnecting = retainLearnerChoiceQuizDrafts(mounted, null);
  assert.equal(reconnecting, mounted);
  assert.deepEqual(reconnecting[ISSUE_REF]?.selectedOptionIds, [OPTION_ID]);
  assert.equal(
    reconnecting[ISSUE_REF]?.pendingSubmission?.idempotencyKey,
    IDEMPOTENCY_KEY,
  );

  const remounted = prepareLearnerChoiceQuizSubmission(
    reconnecting[ISSUE_REF]!,
    reconnecting[ISSUE_REF]!.selectedOptionIds,
    () => {
      createdKeys += 1;
      return "must-not-be-created";
    },
  );
  assert.equal(remounted.request.idempotencyKey, IDEMPOTENCY_KEY);
  assert.deepEqual(remounted.request.selectedOptionIds, [OPTION_ID]);
  assert.equal(createdKeys, 1);
});

test("choice quiz draft advances from a persisted response and clears on issue change", () => {
  const pending = prepareLearnerChoiceQuizSubmission(
    {
      ...learnerChoiceQuizDraftFromExecution(execution()),
      selectedOptionIds: [OPTION_ID],
    },
    [OPTION_ID],
    () => IDEMPOTENCY_KEY,
  ).draft;
  const persisted = execution({
    attemptCount: 1,
    remainingAttempts: 2,
    latestFeedback: {
      attemptNumber: 1,
      selectedOptionIds: [OPTION_ID],
      isCorrect: false,
      score: 0,
      submittedAt: "2026-08-21T10:00:00.000Z",
      canRetry: true,
      reveal: null,
    },
  });

  assert.equal(
    learnerChoiceQuizExecutionAdvancesDraft(persisted, pending),
    true,
  );
  const advanced = learnerChoiceQuizDraftFromExecution(persisted);
  assert.equal(advanced.pendingSubmission, null);
  assert.deepEqual(advanced.selectedOptionIds, [OPTION_ID]);
  assert.equal(advanced.persistedAttemptCount, 1);

  const stored = setLearnerChoiceQuizDraft({}, ISSUE_REF, advanced);
  assert.equal(retainLearnerChoiceQuizDrafts(stored, [ISSUE_REF]), stored);
  assert.deepEqual(retainLearnerChoiceQuizDrafts(stored, [NEXT_ISSUE_REF]), {});
});
