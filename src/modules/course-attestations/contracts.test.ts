import assert from "node:assert/strict";
import test from "node:test";
import {
  courseAttestationDefinitionSchema,
  courseAttestationStateSchema,
  submitCourseAttestationSchema,
} from "./contracts";

const definition = {
  version: 1,
  title: "Итоговая аттестация",
  description: "Проверьте методические решения.",
  passingScorePercent: 80,
  questions: [
    {
      id: "goal",
      prompt: "Какая цель измерима?",
      options: [
        { id: "a", label: "Познакомиться с темой" },
        { id: "b", label: "Представиться тремя фразами" },
      ],
      correctOptionId: "b",
      explanation: "Цель описывает наблюдаемое действие.",
    },
  ],
};

const publicationId = "00000000-0000-4000-8000-000000000001";
const revisionId = "00000000-0000-4000-8000-000000000002";
const attemptId = "00000000-0000-4000-8000-000000000003";

function questionProjection(overrides: Record<string, unknown> = {}) {
  return {
    id: "goal",
    prompt: definition.questions[0].prompt,
    options: definition.questions[0].options,
    selectedOptionId: null,
    correctOptionId: null,
    explanation: null,
    ...overrides,
  };
}

function attestationState(overrides: Record<string, unknown> = {}) {
  return {
    publicationId,
    revisionId,
    title: definition.title,
    description: definition.description,
    passingScorePercent: 80,
    version: 1,
    questions: [questionProjection()],
    attempt: null,
    certified: false,
    ...overrides,
  };
}

test("attestation definition keeps one exact answer key per question", () => {
  assert.deepEqual(
    courseAttestationDefinitionSchema.parse(definition),
    definition,
  );
  assert.equal(
    courseAttestationDefinitionSchema.safeParse({
      ...definition,
      questions: [{ ...definition.questions[0], correctOptionId: "missing" }],
    }).success,
    false,
  );
  assert.equal(
    courseAttestationDefinitionSchema.safeParse({
      ...definition,
      questions: [definition.questions[0], definition.questions[0]],
    }).success,
    false,
  );
});

test("submission accepts only a bounded question-to-option map", () => {
  const expectedRevisionId = "00000000-0000-4000-8000-000000000002";
  assert.deepEqual(
    submitCourseAttestationSchema.parse({
      expectedRevisionId,
      selectedOptionByQuestionId: { goal: "b" },
    }),
    { expectedRevisionId, selectedOptionByQuestionId: { goal: "b" } },
  );
  assert.equal(
    submitCourseAttestationSchema.safeParse({
      expectedRevisionId,
      selectedOptionByQuestionId: { "bad id": "b" },
    }).success,
    false,
  );
  assert.equal(
    submitCourseAttestationSchema.safeParse({
      selectedOptionByQuestionId: { goal: "b" },
    }).success,
    false,
  );
});

test("safe state permits answer keys only as nullable server projections", () => {
  assert.equal(
    courseAttestationStateSchema.safeParse(attestationState()).success,
    true,
  );

  for (const leakedQuestion of [
    questionProjection({ correctOptionId: "b" }),
    questionProjection({ explanation: definition.questions[0].explanation }),
  ]) {
    assert.equal(
      courseAttestationStateSchema.safeParse(
        attestationState({ questions: [leakedQuestion] }),
      ).success,
      false,
      "an uncertified state must reject answer-key leakage",
    );
  }
});

test("failed attempt keeps complete selected answers but rejects answer keys", () => {
  const attempt = {
    id: attemptId,
    scorePercent: 0,
    passed: false,
    completedAt: "2026-08-12T10:00:00.000Z",
    selectedOptionByQuestionId: { goal: "a" },
  };
  assert.equal(
    courseAttestationStateSchema.safeParse(
      attestationState({
        questions: [questionProjection({ selectedOptionId: "a" })],
        attempt,
      }),
    ).success,
    true,
  );
  assert.equal(
    courseAttestationStateSchema.safeParse(
      attestationState({
        questions: [
          questionProjection({
            selectedOptionId: "a",
            correctOptionId: "b",
            explanation: definition.questions[0].explanation,
          }),
        ],
        attempt,
      }),
    ).success,
    false,
  );
});

test("certified state requires a passed attempt and complete review keys", () => {
  const passedAttempt = {
    id: attemptId,
    scorePercent: 100,
    passed: true,
    completedAt: "2026-08-12T10:00:00.000Z",
    selectedOptionByQuestionId: { goal: "b" },
  };
  const certifiedQuestion = questionProjection({
    selectedOptionId: "b",
    correctOptionId: "b",
    explanation: definition.questions[0].explanation,
  });
  assert.equal(
    courseAttestationStateSchema.safeParse(
      attestationState({
        questions: [certifiedQuestion],
        attempt: passedAttempt,
        certified: true,
      }),
    ).success,
    true,
  );

  for (const invalidState of [
    attestationState({ questions: [certifiedQuestion], certified: true }),
    attestationState({
      questions: [
        questionProjection({ correctOptionId: "b", explanation: "" }),
      ],
      attempt: passedAttempt,
      certified: true,
    }),
    attestationState({
      questions: [certifiedQuestion],
      attempt: {
        ...passedAttempt,
        selectedOptionByQuestionId: {},
      },
      certified: true,
    }),
  ]) {
    assert.equal(
      courseAttestationStateSchema.safeParse(invalidState).success,
      false,
    );
  }
});
