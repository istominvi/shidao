import assert from "node:assert/strict";
import test from "node:test";
import {
  ChoiceQuizCorrectionClientError,
  ChoiceQuizHistoryClientError,
  correctTeacherChoiceQuizEvaluation,
  loadTeacherChoiceQuizHistory,
} from "./choice-quiz-history-client";

const LESSON_RUN_ID = "11111111-1111-4111-8111-111111111111";
const OPTION_A = "22222222-2222-4222-8222-222222222222";
const OPTION_B = "33333333-3333-4333-8333-333333333333";

const historyItem = {
  issueRef: `cqi_${"a".repeat(64)}`,
  evaluationId: "44444444-4444-4444-8444-444444444444",
  supersedesEvaluationId: null,
  supersededByEvaluationId: null,
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
  isCorrect: true,
  score: 1,
  supportContext: "independent",
  hintCount: 0,
  revealAvailable: true,
  evaluatorVersion: "choice_quiz_exact_set_v1",
  evaluatorFingerprint: `cqef_v1_${"b".repeat(64)}`,
  evaluatedAt: "2026-08-21T10:00:00.000Z",
  correctionReason: null,
} as const;

test("teacher choice quiz history GET uses the exact Run endpoint and strict schema", async () => {
  let capturedPath = "";
  let capturedInit: RequestInit | undefined;
  const fetchMock = (async (path, init) => {
    capturedPath = String(path);
    capturedInit = init;
    return Response.json({ items: [historyItem], truncated: false });
  }) as typeof fetch;

  const result = await loadTeacherChoiceQuizHistory(LESSON_RUN_ID, fetchMock);

  assert.equal(
    capturedPath,
    `/api/v2/lesson-runs/${LESSON_RUN_ID}/choice-quiz-history`,
  );
  assert.equal(capturedInit?.method, "GET");
  assert.equal(capturedInit?.credentials, "same-origin");
  assert.equal(capturedInit?.cache, "no-store");
  assert.deepEqual(result, { items: [historyItem], truncated: false });
});

test("teacher choice quiz history rejects malformed success responses", async () => {
  await assert.rejects(
    loadTeacherChoiceQuizHistory(LESSON_RUN_ID, (async () =>
      Response.json({
        items: [{ learnerDisplayName: "Анна" }],
      })) as typeof fetch),
    (error: unknown) => {
      assert.ok(error instanceof ChoiceQuizHistoryClientError);
      assert.equal(error.status, 200);
      return true;
    },
  );
});

test("teacher choice quiz history does not expose backend error details", async () => {
  await assert.rejects(
    loadTeacherChoiceQuizHistory(LESSON_RUN_ID, (async () =>
      Response.json(
        { error: "private evaluator config detail" },
        { status: 503 },
      )) as typeof fetch),
    (error: unknown) => {
      assert.ok(error instanceof ChoiceQuizHistoryClientError);
      assert.equal(error.status, 503);
      assert.equal(error.message.includes("private evaluator"), false);
      return true;
    },
  );
});

test("teacher correction POST sends only the strict idempotent input and parses the evaluation", async () => {
  let capturedPath = "";
  let capturedInit: RequestInit | undefined;
  const input = {
    idempotencyKey: "66666666-6666-4666-8666-666666666666",
    isCorrect: false,
    reason: "Проверка показала другую трактовку ответа.",
  } as const;
  const corrected = {
    ...historyItem,
    evaluationId: "77777777-7777-4777-8777-777777777777",
    supersedesEvaluationId: historyItem.evaluationId,
    isCorrect: false,
    score: 0,
    correctionReason: input.reason,
  };
  const fetchMock = (async (path, init) => {
    capturedPath = String(path);
    capturedInit = init;
    return Response.json({ evaluation: corrected });
  }) as typeof fetch;

  const result = await correctTeacherChoiceQuizEvaluation(
    historyItem.evaluationId,
    input,
    fetchMock,
  );

  assert.equal(
    capturedPath,
    `/api/v2/choice-quiz-evaluations/${historyItem.evaluationId}/corrections`,
  );
  assert.equal(capturedInit?.method, "POST");
  assert.equal(capturedInit?.credentials, "same-origin");
  assert.equal(capturedInit?.cache, "no-store");
  assert.deepEqual(JSON.parse(String(capturedInit?.body)), input);
  assert.deepEqual(result, { evaluation: corrected });
});

test("teacher correction rejects malformed input and hides backend detail", async () => {
  let called = false;
  await assert.rejects(
    correctTeacherChoiceQuizEvaluation(
      historyItem.evaluationId,
      {
        idempotencyKey: "not-a-uuid",
        isCorrect: false,
        reason: "",
      },
      (async () => {
        called = true;
        return Response.json({ privateEvaluator: true });
      }) as typeof fetch,
    ),
    (error: unknown) => {
      assert.ok(error instanceof ChoiceQuizCorrectionClientError);
      assert.equal(error.status, 400);
      assert.equal(error.message.includes("Evaluator"), false);
      return true;
    },
  );
  assert.equal(called, false);
});
