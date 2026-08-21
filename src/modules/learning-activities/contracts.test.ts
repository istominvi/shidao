import assert from "node:assert/strict";
import test from "node:test";
import { CourseBuilderValidationError } from "@/modules/course-builder/contracts";
import {
  ACTIVITY_PROFILE_STATES_MAX,
  correctFinalizedObservationInputSchema,
  learnerSafeActivityProfileSchema,
  learningEvidenceSchema,
  parseLearningActivitiesContract,
  saveLessonComponentObservationsInputSchema,
  setRecommendationOverrideInputSchema,
  teacherLearnerActivityProfileSchema,
} from "./contracts";

function uuid(sequence: number) {
  return `00000000-0000-4000-8000-${sequence.toString(16).padStart(12, "0")}`;
}

test("observation save trims bounded criterion and private notes", () => {
  assert.deepEqual(
    parseLearningActivitiesContract(
      saveLessonComponentObservationsInputSchema,
      {
        lessonComponentId: uuid(1),
        observableCriterionAtTime: "  Называет слово без подсказки  ",
        entryMethod: "direct",
        entries: [
          {
            learningRecordId: uuid(2),
            rating: "independent",
            privateNote: "  Чётко произносит тон  ",
          },
        ],
      },
    ),
    {
      lessonComponentId: uuid(1),
      observableCriterionAtTime: "Называет слово без подсказки",
      entryMethod: "direct",
      entries: [
        {
          learningRecordId: uuid(2),
          rating: "independent",
          privateNote: "Чётко произносит тон",
        },
      ],
    },
  );
});

test("structured rating requires an explicitly confirmed criterion", () => {
  assert.throws(
    () =>
      parseLearningActivitiesContract(
        saveLessonComponentObservationsInputSchema,
        {
          lessonComponentId: uuid(1),
          entryMethod: "direct",
          entries: [
            {
              learningRecordId: uuid(2),
              rating: "with_support",
            },
          ],
        },
      ),
    (error: unknown) =>
      error instanceof CourseBuilderValidationError &&
      /подтвердите наблюдаемый критерий/.test(error.message),
  );
});

test("not observed is a criterion-free delete without a private note", () => {
  assert.deepEqual(
    parseLearningActivitiesContract(
      saveLessonComponentObservationsInputSchema,
      {
        lessonComponentId: uuid(1),
        observableCriterionAtTime: null,
        entryMethod: "direct",
        entries: [
          {
            learningRecordId: uuid(2),
            rating: null,
            privateNote: "   ",
          },
        ],
      },
    ),
    {
      lessonComponentId: uuid(1),
      observableCriterionAtTime: null,
      entryMethod: "direct",
      entries: [
        {
          learningRecordId: uuid(2),
          rating: null,
          privateNote: null,
        },
      ],
    },
  );

  assert.throws(
    () =>
      parseLearningActivitiesContract(
        saveLessonComponentObservationsInputSchema,
        {
          lessonComponentId: uuid(1),
          entryMethod: "direct",
          entries: [
            {
              learningRecordId: uuid(2),
              rating: null,
              privateNote: "Эта заметка не должна пережить очистку",
            },
          ],
        },
      ),
    /не может быть заметки/,
  );
});

test("bulk confirmation rejects duplicate records and unsupported values", () => {
  assert.throws(
    () =>
      parseLearningActivitiesContract(
        saveLessonComponentObservationsInputSchema,
        {
          lessonComponentId: uuid(1),
          observableCriterionAtTime: "Отвечает на вопрос",
          entryMethod: "bulk_confirmed",
          entries: [
            { learningRecordId: uuid(2), rating: "independent" },
            { learningRecordId: uuid(2), rating: "not_yet" },
          ],
        },
      ),
    /ровно один раз/,
  );

  assert.throws(
    () =>
      parseLearningActivitiesContract(
        saveLessonComponentObservationsInputSchema,
        {
          lessonComponentId: uuid(1),
          observableCriterionAtTime: "Отвечает на вопрос",
          entryMethod: "bulk",
          entries: [{ learningRecordId: uuid(2), rating: "mastered" }],
        },
      ),
    CourseBuilderValidationError,
  );
});

test("browser save input cannot supply objective provenance", () => {
  for (const objectiveField of [
    "learningObjectiveId",
    "sourceLearningObjectiveIdAtTime",
    "learningObjectiveTitleAtTime",
  ]) {
    assert.throws(
      () =>
        parseLearningActivitiesContract(
          saveLessonComponentObservationsInputSchema,
          {
            lessonComponentId: uuid(1),
            [objectiveField]:
              objectiveField === "learningObjectiveTitleAtTime"
                ? "Подменённая цель"
                : uuid(3),
            observableCriterionAtTime: "Отвечает на вопрос",
            entryMethod: "direct",
            entries: [
              {
                learningRecordId: uuid(2),
                rating: "independent",
              },
            ],
          },
        ),
      CourseBuilderValidationError,
    );
  }
});

test("finalized correction accepts only an explicit bounded reason and idempotency key", () => {
  assert.deepEqual(
    parseLearningActivitiesContract(correctFinalizedObservationInputSchema, {
      observationId: uuid(1),
      expectedLearningRecordId: uuid(2),
      rating: "not_yet",
      privateNote: "  Нужна новая подсказка  ",
      correctionReason: "  Исправлена ошибочная отметка  ",
      idempotencyKey: uuid(3),
    }),
    {
      observationId: uuid(1),
      expectedLearningRecordId: uuid(2),
      rating: "not_yet",
      privateNote: "Нужна новая подсказка",
      correctionReason: "Исправлена ошибочная отметка",
      idempotencyKey: uuid(3),
    },
  );

  for (const invalid of [
    { correctionReason: "   " },
    { correctedAt: "2026-08-20T00:00:00.000Z" },
    { learnerProfileId: uuid(4) },
  ]) {
    assert.throws(
      () =>
        parseLearningActivitiesContract(
          correctFinalizedObservationInputSchema,
          {
            observationId: uuid(1),
            expectedLearningRecordId: uuid(2),
            rating: "independent",
            privateNote: null,
            correctionReason: "Исправление",
            idempotencyKey: uuid(3),
            ...invalid,
          },
        ),
      CourseBuilderValidationError,
    );
  }
});

test("recommendation override is explicit, stale-write guarded and action-consistent", () => {
  const expectedStateUpdatedAt = "2026-08-20T00:00:00.000Z";
  assert.deepEqual(
    parseLearningActivitiesContract(setRecommendationOverrideInputSchema, {
      sourceLearningObjectiveIdAtTime: uuid(1),
      action: "replace",
      recommendationType: "repeat",
      privateReason: "  Нужна дополнительная практика  ",
      expectedStateUpdatedAt,
    }),
    {
      sourceLearningObjectiveIdAtTime: uuid(1),
      action: "replace",
      recommendationType: "repeat",
      privateReason: "Нужна дополнительная практика",
      expectedStateUpdatedAt,
    },
  );

  for (const value of [
    {
      action: "replace",
      recommendationType: null,
      privateReason: "Причина",
    },
    {
      action: "dismiss",
      recommendationType: "repeat",
      privateReason: "Причина",
    },
    {
      action: "clear",
      recommendationType: null,
      privateReason: "Не должно сохраняться",
    },
    {
      action: "dismiss",
      recommendationType: null,
      privateReason: null,
    },
  ]) {
    assert.throws(
      () =>
        parseLearningActivitiesContract(setRecommendationOverrideInputSchema, {
          sourceLearningObjectiveIdAtTime: uuid(1),
          expectedStateUpdatedAt,
          ...value,
        }),
      CourseBuilderValidationError,
    );
  }
});

function safeState(overrides: Record<string, unknown> = {}) {
  return {
    key: `las_${"a".repeat(64)}`,
    courseTitle: "Китайский с нуля",
    subject: "Китайский язык",
    objectiveTitle: "Объясняет правило",
    state: "forming",
    reasonCode: "latest_with_support",
    reasonText: "Получилось с поддержкой — навык ещё формируется.",
    evaluatedAt: "2026-08-20T00:00:00.000Z",
    lastEvidenceAt: "2026-08-19T00:00:00.000Z",
    freshnessDueAt: null,
    evidenceReferences: [
      {
        key: `lae_${"b".repeat(64)}`,
        direction: "positive",
        support: "with_support",
        observedAt: "2026-08-19T00:00:00.000Z",
        evidenceAt: "2026-08-19T00:01:00.000Z",
        courseTitle: "Китайский с нуля",
        lessonTitle: "Знакомство",
        componentLabel: "Свободный ответ",
        objectiveTitle: "Объясняет правило",
        criterion: "Объясняет правило своими словами",
      },
    ],
    recommendation: {
      type: "try_without_support",
      reasonCode: "try_without_support_after_supported_success",
      reasonText:
        "Получилось с поддержкой — следующим шагом попробуйте без подсказки.",
      source: "rule",
      generatedAt: "2026-08-20T00:00:00.000Z",
      evidenceReferenceKeys: [`lae_${"b".repeat(64)}`],
    },
    ...overrides,
  };
}

function teacherNoDataState(overrides: Record<string, unknown> = {}) {
  return {
    stateId: null,
    learningObjectiveId: uuid(40),
    sourceLearningObjectiveIdAtTime: uuid(40),
    sourceCourseIdAtTime: uuid(41),
    courseTitleAtTime: "Китайский с нуля",
    subjectAtTime: "Китайский язык",
    objectiveTitleAtTime: "Объясняет правило",
    status: "no_data",
    reasonCode: "no_eligible_evidence",
    reasonText: "Пока нет подходящих наблюдений по этой учебной цели.",
    policyVersion: 1,
    evaluatedAt: "2026-08-20T00:00:00.000Z",
    lastEvidenceAt: null,
    freshnessDueAt: null,
    evidence: [],
    recommendation: null,
    ...overrides,
  };
}

test("teacher profile accepts only a fully synthesized no-data state", () => {
  const profile = {
    projectionVersion: 1,
    learnerProfileId: uuid(42),
    generatedAt: "2026-08-20T00:00:00.000Z",
    states: [
      teacherNoDataState(),
      teacherNoDataState({
        learningObjectiveId: uuid(43),
        sourceLearningObjectiveIdAtTime: uuid(43),
      }),
    ],
  };
  assert.equal(
    teacherLearnerActivityProfileSchema.safeParse(profile).success,
    true,
  );

  for (const invalidState of [
    teacherNoDataState({ stateId: uuid(44) }),
    teacherNoDataState({ lastEvidenceAt: "2026-08-19T00:00:00.000Z" }),
    teacherNoDataState({ recommendation: safeState().recommendation }),
    teacherNoDataState({
      status: "forming",
      reasonCode: "latest_with_support",
    }),
  ]) {
    assert.equal(
      teacherLearnerActivityProfileSchema.safeParse({
        ...profile,
        states: [invalidState],
      }).success,
      false,
    );
  }

  assert.equal(
    teacherLearnerActivityProfileSchema.safeParse({
      ...profile,
      states: [teacherNoDataState(), teacherNoDataState()],
    }).success,
    false,
  );
});

test("learner-safe profile is strict, bounded and contains only opaque references", () => {
  const profile = {
    projectionVersion: 1,
    generatedAt: "2026-08-20T00:00:00.000Z",
    states: [safeState()],
  };
  assert.equal(
    learnerSafeActivityProfileSchema.safeParse(profile).success,
    true,
  );
  assert.equal(
    learnerSafeActivityProfileSchema.safeParse({
      ...profile,
      states: [
        safeState({
          recommendation: {
            ...safeState().recommendation,
            type: "repeat",
            source: "teacher_override",
            reasonText: "Преподаватель выбрал другой следующий шаг.",
          },
        }),
      ],
    }).success,
    true,
  );

  for (const unsafeState of [
    safeState({ privateNote: "teacher only" }),
    safeState({ recordedByAccountId: uuid(9) }),
    safeState({ learnerProfileId: uuid(8) }),
    safeState({ evaluatorData: { score: 0.9 } }),
    safeState({ policyInputs: { hiddenWeight: 3 } }),
    safeState({ key: uuid(7) }),
    safeState({
      key: `las_prefix-${uuid(7)}-${"a".repeat(32)}`,
    }),
    safeState({
      evidenceReferences: [
        {
          ...safeState().evidenceReferences[0],
          key: `lae_prefix-${uuid(7)}-${"b".repeat(32)}`,
        },
      ],
    }),
    safeState({
      evidenceReferences: [
        {
          ...safeState().evidenceReferences[0],
          privateNote: "teacher only",
        },
      ],
    }),
    safeState({
      recommendation: {
        ...safeState().recommendation,
        source: "teacher_override",
        privateReason: "teacher only",
      },
    }),
  ]) {
    assert.equal(
      learnerSafeActivityProfileSchema.safeParse({
        ...profile,
        states: [unsafeState],
      }).success,
      false,
    );
  }

  assert.equal(
    learnerSafeActivityProfileSchema.safeParse({
      ...profile,
      states: Array.from(
        { length: ACTIVITY_PROFILE_STATES_MAX + 1 },
        (_, index) =>
          safeState({
            key: `las_${index.toString(16).padStart(64, "0")}`,
          }),
      ),
    }).success,
    false,
  );
});

test("typed observation LearningEvidence preserves v1 and rejects private payloads", () => {
  const value = {
    id: uuid(1),
    learnerProfileId: uuid(2),
    recordedByAccountId: uuid(3),
    learningRecordId: uuid(4),
    sourceKind: "observation",
    sourceObservationId: uuid(5),
    sourceChoiceQuizEvaluationId: null,
    sourceCourseIdAtTime: uuid(6),
    sourceLessonIdAtTime: uuid(7),
    sourceLessonRunIdAtTime: uuid(8),
    sourceComponentIdAtTime: uuid(9),
    sourceLearningObjectiveIdAtTime: uuid(10),
    lessonComponentId: null,
    learningObjectiveId: null,
    courseTitleAtTime: "Курс",
    lessonTitleAtTime: "Урок",
    subjectAtTime: null,
    componentTypeAtTime: "free_response",
    componentLabelAtTime: "Свободный ответ",
    objectiveTitleAtTime: "Объясняет правило",
    criterionAtTime: "Объясняет правило своими словами",
    direction: "negative",
    support: null,
    observedAt: "2026-08-20T00:00:00.000Z",
    finalizedAt: "2026-08-20T00:01:00.000Z",
    materializedAt: "2026-08-20T00:01:01.000Z",
    evidenceVersion: 1,
    eligibilityPolicyVersion: 1,
    reasonCode: "not_yet_negative_evidence",
    supersedesEvidenceId: null,
    supersededByEvidenceId: null,
  };
  assert.equal(learningEvidenceSchema.safeParse(value).success, true);
  assert.equal(
    learningEvidenceSchema.safeParse({ ...value, support: "with_support" })
      .success,
    false,
  );
  assert.equal(
    learningEvidenceSchema.safeParse({ ...value, privateNote: "secret" })
      .success,
    false,
  );
  assert.equal(
    learningEvidenceSchema.safeParse({ ...value, evaluatorPayload: {} })
      .success,
    false,
  );
});

test("typed choice-quiz LearningEvidence requires exactly one v2 source", () => {
  const value = {
    id: uuid(21),
    learnerProfileId: uuid(22),
    recordedByAccountId: uuid(23),
    learningRecordId: null,
    sourceKind: "choice_quiz_evaluation",
    sourceObservationId: null,
    sourceChoiceQuizEvaluationId: uuid(25),
    sourceCourseIdAtTime: uuid(26),
    sourceLessonIdAtTime: uuid(27),
    sourceLessonRunIdAtTime: uuid(28),
    sourceComponentIdAtTime: uuid(29),
    sourceLearningObjectiveIdAtTime: uuid(30),
    lessonComponentId: uuid(29),
    learningObjectiveId: uuid(30),
    courseTitleAtTime: "Китайский с нуля",
    lessonTitleAtTime: "Знакомство",
    subjectAtTime: "Китайский язык",
    componentTypeAtTime: "choice_quiz",
    componentLabelAtTime: "Выберите правильный перевод",
    objectiveTitleAtTime: "Различает значения слов",
    criterionAtTime: "Выбирает точный перевод",
    direction: "positive",
    support: "independent",
    observedAt: "2026-08-21T00:00:00.000Z",
    finalizedAt: "2026-08-21T00:00:00.000Z",
    materializedAt: "2026-08-21T00:00:00.000Z",
    evidenceVersion: 1,
    eligibilityPolicyVersion: 2,
    reasonCode: "choice_quiz_independent_positive_evidence",
    supersedesEvidenceId: null,
    supersededByEvidenceId: null,
  };

  assert.equal(learningEvidenceSchema.safeParse(value).success, true);
  for (const invalid of [
    { ...value, learningRecordId: uuid(24) },
    { ...value, sourceObservationId: uuid(31) },
    {
      ...value,
      sourceKind: "observation",
      sourceObservationId: uuid(31),
    },
    { ...value, sourceChoiceQuizEvaluationId: null },
    { ...value, eligibilityPolicyVersion: 1 },
    { ...value, reasonCode: "independent_positive_evidence" },
    { ...value, support: "with_support" },
  ]) {
    assert.equal(learningEvidenceSchema.safeParse(invalid).success, false);
  }

  assert.equal(
    learningEvidenceSchema.safeParse({
      ...value,
      support: "with_support",
      reasonCode: "choice_quiz_supported_positive_evidence",
    }).success,
    true,
  );
  assert.equal(
    learningEvidenceSchema.safeParse({
      ...value,
      direction: "negative",
      support: null,
      reasonCode: "choice_quiz_not_yet_negative_evidence",
    }).success,
    true,
  );
});
