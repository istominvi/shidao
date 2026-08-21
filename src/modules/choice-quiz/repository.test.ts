import assert from "node:assert/strict";
import test from "node:test";
import {
  CHOICE_QUIZ_RPC,
  createChoiceQuizLearnerRepository,
  createChoiceQuizTeacherRepository,
} from "./repository";
import { ChoiceQuizRepositoryError } from "./errors";

function uuid(index: number) {
  return `00000000-0000-4000-8000-${index.toString().padStart(12, "0")}`;
}

const AUTH_USER_ID = uuid(1);
const SESSION_ID = uuid(2);
const RUN_ID = uuid(3);
const COMPONENT_ID = uuid(4);
const OPTION_A = uuid(5);
const OPTION_B = uuid(6);
const ISSUE_REF = `cqi_${"a".repeat(64)}`;
const REVISION = `cqd_v1_${"b".repeat(64)}`;

const learnerDefinition = {
  question: "Что означает 道?",
  options: [
    { id: OPTION_A, label: "Путь" },
    { id: OPTION_B, label: "Дом" },
  ],
  allowMultiple: false,
};

const execution = {
  issueRef: ISSUE_REF,
  definitionRevision: REVISION,
  attemptCount: 0,
  maxAttempts: 3,
  remainingAttempts: 3,
  hintAvailable: false,
  hintCount: 0,
  canSubmit: true,
  latestFeedback: null,
};

function configureEnvironment(t: test.TestContext) {
  const names = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
  ] as const;
  const previous = Object.fromEntries(
    names.map((name) => [name, process.env[name]]),
  );
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supabase.example.test";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
  t.after(() => {
    for (const name of names) {
      const value = previous[name];
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });
}

test("learner issue and submit use exact service-role-only RPC arguments", async (t) => {
  configureEnvironment(t);
  const requests: Array<{
    functionName: string;
    authorization: string | null;
    apiKey: string | null;
    body: Record<string, unknown>;
  }> = [];
  const repository = createChoiceQuizLearnerRepository({
    fetcher: (async (input, init) => {
      const request = new URL(String(input));
      const functionName = request.pathname.split("/").at(-1)!;
      requests.push({
        functionName,
        authorization: new Headers(init?.headers).get("Authorization"),
        apiKey: new Headers(init?.headers).get("apikey"),
        body: JSON.parse(String(init?.body)) as Record<string, unknown>,
      });
      if (functionName === CHOICE_QUIZ_RPC.issueDefinition) {
        return Response.json({ learnerDefinition, execution });
      }
      return Response.json({ execution });
    }) as typeof fetch,
  });

  await repository.issueDefinition({
    actor: { authUserId: AUTH_USER_ID, supabaseSessionId: SESSION_ID },
    lessonRunId: RUN_ID,
    cursorRevision: 7,
    componentId: COMPONENT_ID,
    expectedComponentUpdatedAt: "2026-08-21T08:00:00.000Z",
    learnerDefinition,
    evaluatorConfig: {
      correctOptionIds: [OPTION_A],
      allowMultiple: false,
      explanation: "Пояснение",
    },
  });
  await repository.submitAttempt(
    { authUserId: AUTH_USER_ID, supabaseSessionId: SESSION_ID },
    RUN_ID,
    ISSUE_REF,
    {
      idempotencyKey: uuid(20),
      cursorRevision: 7,
      selectedOptionIds: [OPTION_A],
    },
  );

  assert.ok(
    requests.every(
      (request) =>
        request.authorization === "Bearer service-role-key" &&
        request.apiKey === "service-role-key",
    ),
  );
  assert.deepEqual(requests[0], {
    functionName: CHOICE_QUIZ_RPC.issueDefinition,
    authorization: "Bearer service-role-key",
    apiKey: "service-role-key",
    body: {
      p_auth_user_id: AUTH_USER_ID,
      p_session_id: SESSION_ID,
      p_lesson_run_id: RUN_ID,
      p_cursor_revision: 7,
      p_component_id: COMPONENT_ID,
      p_expected_component_updated_at: "2026-08-21T08:00:00.000Z",
      p_learner_definition: learnerDefinition,
      p_evaluator_config: {
        correctOptionIds: [OPTION_A],
        allowMultiple: false,
        explanation: "Пояснение",
      },
    },
  });
  assert.deepEqual(requests[1]!.body, {
    p_auth_user_id: AUTH_USER_ID,
    p_session_id: SESSION_ID,
    p_lesson_run_id: RUN_ID,
    p_issue_ref: ISSUE_REF,
    p_cursor_revision: 7,
    p_idempotency_key: uuid(20),
    p_selected_option_ids: [OPTION_A],
  });
  assert.doesNotMatch(
    JSON.stringify(requests[1]!.body),
    /correct|score|learner_profile|account_id|definition_revision/i,
  );
});

test("teacher history and correction infer authority from trusted server actor", async (t) => {
  configureEnvironment(t);
  const requests: Array<{
    functionName: string;
    authorization: string | null;
    body: Record<string, unknown>;
  }> = [];
  const evaluationId = uuid(30);
  const historyItem = {
    issueRef: ISSUE_REF,
    evaluationId,
    supersedesEvaluationId: null,
    supersededByEvaluationId: null,
    learnerProfileId: uuid(32),
    learnerDisplayName: "Анна",
    componentLabelAtTime: "Тест с выбором ответа: Что означает 道?",
    objectiveTitleAtTime: "Понимать 道",
    activityRole: "practice",
    question: "Что означает 道?",
    shownOptions: learnerDefinition.options,
    attemptNumber: 1,
    selectedOptions: [{ id: OPTION_A, label: "Путь" }],
    isCorrect: true,
    score: 1,
    supportContext: "independent",
    hintCount: 0,
    revealAvailable: true,
    evaluatorVersion: "choice_quiz_exact_set_v1",
    evaluatorFingerprint: `cqef_v1_${"c".repeat(64)}`,
    evaluatedAt: "2026-08-21T08:01:00.000Z",
    correctionReason: null,
  } as const;
  const repository = createChoiceQuizTeacherRepository(
    { authUserId: AUTH_USER_ID, supabaseSessionId: SESSION_ID },
    {
      fetcher: (async (input, init) => {
        const request = new URL(String(input));
        const functionName = request.pathname.split("/").at(-1)!;
        requests.push({
          functionName,
          authorization: new Headers(init?.headers).get("Authorization"),
          body: JSON.parse(String(init?.body)) as Record<string, unknown>,
        });
        return functionName === CHOICE_QUIZ_RPC.getTeacherHistory
          ? Response.json({ items: [historyItem], truncated: false })
          : Response.json({ evaluation: historyItem });
      }) as typeof fetch,
    },
  );

  await repository.getHistory(RUN_ID);
  await repository.correctEvaluation(evaluationId, {
    idempotencyKey: uuid(31),
    isCorrect: false,
    reason: "Проверено учителем.",
  });
  assert.deepEqual(requests, [
    {
      functionName: CHOICE_QUIZ_RPC.getTeacherHistory,
      authorization: "Bearer service-role-key",
      body: {
        p_actor_auth_user_id: AUTH_USER_ID,
        p_session_id: SESSION_ID,
        p_lesson_run_id: RUN_ID,
      },
    },
    {
      functionName: CHOICE_QUIZ_RPC.correctEvaluation,
      authorization: "Bearer service-role-key",
      body: {
        p_actor_auth_user_id: AUTH_USER_ID,
        p_session_id: SESSION_ID,
        p_evaluation_id: evaluationId,
        p_is_correct: false,
        p_reason: "Проверено учителем.",
        p_idempotency_key: uuid(31),
      },
    },
  ]);
});

test("database conflicts map to stable non-leaking application errors", async (t) => {
  configureEnvironment(t);
  async function rejected(message: string) {
    const repository = createChoiceQuizLearnerRepository({
      fetcher: (async () =>
        Response.json(
          { code: "40001", message },
          { status: 400 },
        )) as typeof fetch,
    });
    let caught: unknown;
    try {
      await repository.submitAttempt(
        { authUserId: AUTH_USER_ID, supabaseSessionId: SESSION_ID },
        RUN_ID,
        ISSUE_REF,
        {
          idempotencyKey: uuid(40),
          cursorRevision: 2,
          selectedOptionIds: [OPTION_A],
        },
      );
    } catch (error) {
      caught = error;
    }
    assert.ok(caught instanceof ChoiceQuizRepositoryError);
    return caught;
  }

  const idempotency = await rejected("choice_quiz_idempotency_conflict");
  assert.equal(idempotency.status, 409);
  assert.equal(idempotency.code, "choice_quiz_idempotency_conflict");
  assert.doesNotMatch(idempotency.message, /idempotency_conflict/);

  const stale = await rejected("choice_quiz_source_changed");
  assert.equal(stale.status, 409);
  assert.equal(stale.code, "choice_quiz_state_conflict");
  assert.doesNotMatch(stale.message, /source_changed/);
});
