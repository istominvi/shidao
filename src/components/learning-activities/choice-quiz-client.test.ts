import assert from "node:assert/strict";
import test from "node:test";
import type { SubmitChoiceQuizAttemptInput } from "@/modules/choice-quiz/contracts";
import {
  ChoiceQuizSubmitError,
  submitLearnerChoiceQuizAttempt,
} from "./choice-quiz-client";

const LESSON_RUN_ID = "11111111-1111-4111-8111-111111111111";
const ISSUE_REF = `cqi_${"a".repeat(64)}`;
const DEFINITION_REVISION = `cqd_v1_${"b".repeat(64)}`;
const OPTION_ID = "22222222-2222-4222-8222-222222222222";

const input: SubmitChoiceQuizAttemptInput = {
  idempotencyKey: "33333333-3333-4333-8333-333333333333",
  cursorRevision: 4,
  selectedOptionIds: [OPTION_ID],
};

const execution = {
  issueRef: ISSUE_REF,
  definitionRevision: DEFINITION_REVISION,
  attemptCount: 1,
  maxAttempts: 3,
  remainingAttempts: 2,
  hintAvailable: false,
  hintCount: 0,
  canSubmit: true,
  latestFeedback: {
    attemptNumber: 1,
    selectedOptionIds: [OPTION_ID],
    isCorrect: false,
    score: 0,
    submittedAt: "2026-08-21T10:00:00.000Z",
    canRetry: true,
    reveal: null,
  },
} as const;

test("choice quiz submit sends only the frozen learner request and parses persisted execution", async () => {
  let capturedPath = "";
  let capturedInit: RequestInit | undefined;
  const fetchMock = (async (path, init) => {
    capturedPath = String(path);
    capturedInit = init;
    return Response.json({ execution });
  }) as typeof fetch;

  const result = await submitLearnerChoiceQuizAttempt(
    LESSON_RUN_ID,
    ISSUE_REF,
    input,
    fetchMock,
  );

  assert.equal(
    capturedPath,
    `/api/v2/me/live-runs/${LESSON_RUN_ID}/activities/${ISSUE_REF}/attempts`,
  );
  assert.equal(capturedInit?.method, "POST");
  assert.equal(capturedInit?.credentials, "same-origin");
  assert.equal(capturedInit?.cache, "no-store");
  assert.equal(
    new Headers(capturedInit?.headers).get("content-type"),
    "application/json",
  );
  assert.deepEqual(JSON.parse(String(capturedInit?.body)), input);
  assert.deepEqual(result, execution);
});

test("choice quiz submit classifies stale and transient failures without trusting response bodies", async () => {
  await assert.rejects(
    submitLearnerChoiceQuizAttempt(LESSON_RUN_ID, ISSUE_REF, input, (async () =>
      Response.json(
        { error: "private backend detail" },
        { status: 409 },
      )) as typeof fetch),
    (error: unknown) => {
      assert.ok(error instanceof ChoiceQuizSubmitError);
      assert.equal(error.failure, "stale");
      assert.equal(error.message.includes("private backend detail"), false);
      return true;
    },
  );

  await assert.rejects(
    submitLearnerChoiceQuizAttempt(
      LESSON_RUN_ID,
      ISSUE_REF,
      input,
      (async () => {
        throw new Error("network detail");
      }) as typeof fetch,
    ),
    (error: unknown) => {
      assert.ok(error instanceof ChoiceQuizSubmitError);
      assert.equal(error.failure, "unavailable");
      assert.equal(error.status, 0);
      return true;
    },
  );
});

test("choice quiz submit rejects malformed success payloads fail closed", async () => {
  await assert.rejects(
    submitLearnerChoiceQuizAttempt(LESSON_RUN_ID, ISSUE_REF, input, (async () =>
      Response.json({ execution: { issueRef: ISSUE_REF } })) as typeof fetch),
    (error: unknown) => {
      assert.ok(error instanceof ChoiceQuizSubmitError);
      assert.equal(error.failure, "invalid_response");
      return true;
    },
  );
});
