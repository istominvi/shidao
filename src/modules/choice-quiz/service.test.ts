import assert from "node:assert/strict";
import test from "node:test";
import type {
  ChoiceQuizLearnerRepository,
  ChoiceQuizTeacherRepository,
  IssueChoiceQuizDefinitionRepositoryInput,
} from "./repository";
import { ChoiceQuizProjectionError } from "./errors";
import { createChoiceQuizService } from "./service";

function uuid(index: number) {
  return `00000000-0000-4000-8000-${index.toString().padStart(12, "0")}`;
}

const ACTOR = { authUserId: uuid(1), supabaseSessionId: uuid(2) };
const RUN_ID = uuid(3);
const COMPONENT_ID = uuid(4);
const OBJECTIVE_ID = uuid(5);
const OPTION_A = uuid(6);
const OPTION_B = uuid(7);
const ISSUE_REF = `cqi_${"a".repeat(64)}`;
const REVISION = `cqd_v1_${"b".repeat(64)}`;

function authorPayload(allowMultiple = false) {
  return {
    question: "Что означает 道?",
    options: [
      { id: OPTION_A, label: "Путь", isCorrect: true },
      { id: OPTION_B, label: "Дом", isCorrect: allowMultiple },
    ],
    allowMultiple,
    explanation: "道 — путь или принцип.",
    shuffle: false,
  };
}

function liveInput(
  role: "practice" | "assessment" | null = "practice",
  allowMultiple = false,
) {
  return {
    actor: ACTOR,
    lessonRunId: RUN_ID,
    cursorRevision: 4,
    component: {
      id: COMPONENT_ID,
      schemaVersion: 1,
      position: 2,
      updatedAt: "2026-08-21T08:00:00.000Z",
      activityRole: role,
      primaryLearningObjectiveId: OBJECTIVE_ID,
      payload: authorPayload(allowMultiple),
    },
  } as const;
}

function issuedProjection(input: {
  maxAttempts?: 1 | 3;
  learnerDefinition?: {
    question: string;
    options: Array<{ id: string; label: string }>;
    allowMultiple: boolean;
  };
  latestFeedback?: null | {
    attemptNumber: number;
    selectedOptionIds: string[];
    isCorrect: boolean;
    score: 0 | 1;
    submittedAt: string;
    canRetry: boolean;
    reveal: null | { correctOptionIds: string[]; explanation?: string };
  };
}) {
  const maxAttempts = input.maxAttempts ?? 3;
  const latestFeedback = input.latestFeedback ?? null;
  const attemptCount = latestFeedback?.attemptNumber ?? 0;
  return {
    learnerDefinition: input.learnerDefinition ?? {
      question: "Что означает 道?",
      options: [
        { id: OPTION_A, label: "Путь" },
        { id: OPTION_B, label: "Дом" },
      ],
      allowMultiple: false,
    },
    execution: {
      issueRef: ISSUE_REF,
      definitionRevision: REVISION,
      attemptCount,
      maxAttempts,
      remainingAttempts: maxAttempts - attemptCount,
      hintAvailable: false,
      hintCount: 0,
      canSubmit:
        maxAttempts > attemptCount &&
        (latestFeedback === null || latestFeedback.canRetry),
      latestFeedback,
    },
  } as const;
}

class LearnerRepository implements ChoiceQuizLearnerRepository {
  issuedInputs: IssueChoiceQuizDefinitionRepositoryInput[] = [];
  submitInputs: unknown[] = [];
  nextIssue = issuedProjection({});

  async issueDefinition(input: IssueChoiceQuizDefinitionRepositoryInput) {
    this.issuedInputs.push(input);
    return this.nextIssue;
  }

  async submitAttempt(
    actor: typeof ACTOR,
    lessonRunId: string,
    issueRef: string,
    input: {
      idempotencyKey: string;
      cursorRevision: number;
      selectedOptionIds: string[];
    },
  ) {
    this.submitInputs.push({ actor, lessonRunId, issueRef, input });
    return { execution: this.nextIssue.execution };
  }
}

test("practice issuance persists exact registry projections before delivery", async () => {
  const repository = new LearnerRepository();
  const service = createChoiceQuizService({ learnerRepository: repository });
  const result = await service.issueLiveDefinition(liveInput());

  assert.deepEqual(result, issuedProjection({}));
  assert.equal(repository.issuedInputs.length, 1);
  const persisted = repository.issuedInputs[0]!;
  assert.deepEqual(
    {
      actor: persisted.actor,
      lessonRunId: persisted.lessonRunId,
      cursorRevision: persisted.cursorRevision,
      componentId: persisted.componentId,
      expectedComponentUpdatedAt: persisted.expectedComponentUpdatedAt,
    },
    {
      actor: ACTOR,
      lessonRunId: RUN_ID,
      cursorRevision: 4,
      componentId: COMPONENT_ID,
      expectedComponentUpdatedAt: "2026-08-21T08:00:00.000Z",
    },
  );
  assert.deepEqual(persisted.learnerDefinition, {
    question: "Что означает 道?",
    options: [
      { id: OPTION_A, label: "Путь" },
      { id: OPTION_B, label: "Дом" },
    ],
    allowMultiple: false,
  });
  assert.deepEqual(persisted.evaluatorConfig, {
    correctOptionIds: [OPTION_A],
    allowMultiple: false,
    explanation: "道 — путь или принцип.",
  });
  assert.doesNotMatch(
    JSON.stringify(result),
    /isCorrect|correctOptionIds|explanation|objective|activityRole|componentId/,
  );
});

test("multiple-choice issuance keeps exact-set evaluator separate", async () => {
  const repository = new LearnerRepository();
  repository.nextIssue = issuedProjection({
    learnerDefinition: {
      question: "Что означает 道?",
      options: [
        { id: OPTION_A, label: "Путь" },
        { id: OPTION_B, label: "Дом" },
      ],
      allowMultiple: true,
    },
  });
  const service = createChoiceQuizService({ learnerRepository: repository });
  await service.issueLiveDefinition(liveInput("practice", true));
  assert.deepEqual(repository.issuedInputs[0]!.evaluatorConfig, {
    correctOptionIds: [OPTION_A, OPTION_B],
    allowMultiple: true,
    explanation: "道 — путь или принцип.",
  });
});

test("role-null quiz is presentation-only and performs no write", async () => {
  const repository = new LearnerRepository();
  const service = createChoiceQuizService({ learnerRepository: repository });
  assert.equal(await service.issueLiveDefinition(liveInput(null)), null);
  assert.deepEqual(repository.issuedInputs, []);
});

test("assessment issuance permits exactly one non-revealing attempt", async () => {
  const repository = new LearnerRepository();
  repository.nextIssue = issuedProjection({ maxAttempts: 1 });
  const service = createChoiceQuizService({ learnerRepository: repository });
  const issued = await service.issueLiveDefinition(liveInput("assessment"));
  assert.equal(issued?.execution.maxAttempts, 1);
  assert.equal(issued?.execution.attemptCount, 0);
  assert.equal(issued?.execution.latestFeedback, null);
});

test("issuance fails closed on policy or answer-reveal mismatch", async () => {
  const repository = new LearnerRepository();
  const service = createChoiceQuizService({ learnerRepository: repository });

  repository.nextIssue = issuedProjection({ maxAttempts: 1 });
  await assert.rejects(
    () => service.issueLiveDefinition(liveInput("practice")),
    ChoiceQuizProjectionError,
  );

  repository.nextIssue = issuedProjection({
    latestFeedback: {
      attemptNumber: 3,
      selectedOptionIds: [OPTION_B],
      isCorrect: false,
      score: 0,
      submittedAt: "2026-08-21T08:01:00.000Z",
      canRetry: false,
      reveal: { correctOptionIds: [OPTION_B] },
    },
  });
  await assert.rejects(
    () => service.issueLiveDefinition(liveInput("practice")),
    ChoiceQuizProjectionError,
  );
});

test("submit validates strict authority-free input before repository RPC", async () => {
  const repository = new LearnerRepository();
  const service = createChoiceQuizService({ learnerRepository: repository });
  const input = {
    idempotencyKey: uuid(20),
    cursorRevision: 4,
    selectedOptionIds: [OPTION_A],
  };
  await service.submitAttempt(ACTOR, RUN_ID, ISSUE_REF, input);
  assert.deepEqual(repository.submitInputs, [
    { actor: ACTOR, lessonRunId: RUN_ID, issueRef: ISSUE_REF, input },
  ]);
  await assert.rejects(
    async () =>
      service.submitAttempt(ACTOR, RUN_ID, ISSUE_REF, {
        ...input,
        score: 1,
      }),
    /Unrecognized key|Проверьте|unrecognized/i,
  );
  assert.equal(repository.submitInputs.length, 1);
});

test("teacher history and correction use validated run/evaluation identities", async () => {
  const calls: unknown[] = [];
  const teacherRepository: ChoiceQuizTeacherRepository = {
    async getHistory(lessonRunId) {
      calls.push({ kind: "history", lessonRunId });
      return { items: [], truncated: false };
    },
    async correctEvaluation(evaluationId, input) {
      calls.push({ kind: "correction", evaluationId, input });
      throw new Error("sentinel");
    },
  };
  const service = createChoiceQuizService({ teacherRepository });
  assert.deepEqual(await service.getTeacherHistory(RUN_ID), {
    items: [],
    truncated: false,
  });
  await assert.rejects(
    () =>
      service.correctTeacherEvaluation(uuid(30), {
        idempotencyKey: uuid(31),
        isCorrect: true,
        reason: "Исправлена проверка ответа.",
      }),
    /sentinel/,
  );
  assert.deepEqual(calls, [
    { kind: "history", lessonRunId: RUN_ID },
    {
      kind: "correction",
      evaluationId: uuid(30),
      input: {
        idempotencyKey: uuid(31),
        isCorrect: true,
        reason: "Исправлена проверка ответа.",
      },
    },
  ]);
});
