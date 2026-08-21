import assert from "node:assert/strict";
import test from "node:test";
import type { LearningEvidence } from "./domain";
import {
  fixedLearningActivityClock,
  OBJECTIVE_STATE_FRESHNESS_MS_V1,
  ObjectiveStatePolicyError,
  projectLearnerObjectiveStateV1,
} from "./objective-state-v1";
import { projectLearningRecommendationV1 } from "./recommendation-rules-v1";

function uuid(sequence: number) {
  return `00000000-0000-4000-8000-${sequence.toString(16).padStart(12, "0")}`;
}

const LEARNER_ID = uuid(1);
const ACCOUNT_ID = uuid(2);
const COURSE_ID = uuid(3);
const OBJECTIVE_ID = uuid(4);
const BASE_TIME = "2026-01-01T00:00:00.000Z";

function evidence(
  sequence: number,
  overrides: Partial<LearningEvidence> = {},
): LearningEvidence {
  const direction = overrides.direction ?? "positive";
  const support =
    overrides.support === undefined
      ? direction === "positive"
        ? "independent"
        : null
      : overrides.support;
  return {
    id: uuid(100 + sequence),
    learnerProfileId: LEARNER_ID,
    recordedByAccountId: ACCOUNT_ID,
    learningRecordId: uuid(200 + sequence),
    sourceObservationId: uuid(300 + sequence),
    sourceCourseIdAtTime: COURSE_ID,
    sourceLessonIdAtTime: uuid(400 + sequence),
    sourceLessonRunIdAtTime: uuid(500 + sequence),
    sourceComponentIdAtTime: uuid(600 + sequence),
    sourceLearningObjectiveIdAtTime: OBJECTIVE_ID,
    lessonComponentId: uuid(600 + sequence),
    learningObjectiveId: OBJECTIVE_ID,
    courseTitleAtTime: "Китайский с нуля",
    lessonTitleAtTime: `Урок ${sequence}`,
    subjectAtTime: "Китайский язык",
    componentTypeAtTime: "free_response",
    componentLabelAtTime: "Свободный ответ",
    objectiveTitleAtTime: "Объясняет правило",
    criterionAtTime: "Объясняет правило своими словами",
    direction,
    support,
    observedAt: new Date(
      Date.parse(BASE_TIME) + sequence * 60_000,
    ).toISOString(),
    finalizedAt: new Date(
      Date.parse(BASE_TIME) + sequence * 60_000 + 1_000,
    ).toISOString(),
    materializedAt: new Date(
      Date.parse(BASE_TIME) + sequence * 60_000 + 2_000,
    ).toISOString(),
    evidenceVersion: 1,
    eligibilityPolicyVersion: 1,
    reasonCode:
      direction === "negative"
        ? "not_yet_negative_evidence"
        : support === "independent"
          ? "independent_positive_evidence"
          : "supported_positive_evidence",
    supersedesEvidenceId: null,
    supersededByEvidenceId: null,
    ...overrides,
  };
}

test("fixed learning-activity clock returns an isolated deterministic Date", () => {
  const clock = fixedLearningActivityClock("2026-08-20T12:00:00.000Z");
  const first = clock.now();
  first.setUTCFullYear(2030);
  assert.equal(clock.now().toISOString(), "2026-08-20T12:00:00.000Z");
  assert.throws(
    () => fixedLearningActivityClock("not-a-date"),
    /fixed_clock_invalid/,
  );
});

test("objective-state-v1 keeps zero evidence explainable and recommendation-free", () => {
  const state = projectLearnerObjectiveStateV1([], BASE_TIME);
  assert.deepEqual(state, {
    status: "no_data",
    reasonCode: "no_eligible_evidence",
    reasonText: "Пока нет подходящих наблюдений по этой учебной цели.",
    policyVersion: 1,
    evaluatedAt: BASE_TIME,
    lastEvidenceAt: null,
    freshnessDueAt: null,
    evidenceIds: [],
  });
  assert.equal(projectLearningRecommendationV1(state), null);
  assert.equal("masteryPercentage" in state, false);
});

test("negative and supported latest evidence remain forming with honest next steps", () => {
  const negative = evidence(2, {
    direction: "negative",
    support: null,
    reasonCode: "not_yet_negative_evidence",
  });
  const negativeState = projectLearnerObjectiveStateV1(
    [evidence(1), negative],
    "2026-01-02T00:00:00.000Z",
  );
  assert.equal(negativeState.status, "forming");
  assert.equal(negativeState.reasonCode, "latest_not_yet");
  assert.deepEqual(negativeState.evidenceIds, [negative.id]);
  assert.deepEqual(projectLearningRecommendationV1(negativeState), {
    type: "repeat",
    reasonCode: "repeat_after_not_yet",
    reasonText: "Пока не получилось — повторите материал и попробуйте ещё раз.",
    ruleVersion: 1,
    generatedAt: "2026-01-02T00:00:00.000Z",
    evidenceIds: [negative.id],
  });

  const supported = evidence(3, {
    support: "with_support",
    reasonCode: "supported_positive_evidence",
  });
  const supportedState = projectLearnerObjectiveStateV1(
    [evidence(1), supported],
    "2026-01-02T00:00:00.000Z",
  );
  assert.equal(supportedState.status, "forming");
  assert.equal(supportedState.reasonCode, "latest_with_support");
  assert.equal(
    projectLearningRecommendationV1(supportedState)?.type,
    "try_without_support",
  );
});

test("one observation or multiple Components in one Run cannot confirm an objective", () => {
  const first = evidence(1);
  const sameRun = evidence(2, {
    sourceLessonRunIdAtTime: first.sourceLessonRunIdAtTime,
  });

  for (const input of [[first], [first, sameRun]]) {
    const state = projectLearnerObjectiveStateV1(
      input,
      "2026-01-02T00:00:00.000Z",
    );
    assert.equal(state.status, "forming");
    assert.equal(state.reasonCode, "independent_opportunities_missing");
    assert.equal(state.evidenceIds.length, 1);
    assert.equal(
      projectLearningRecommendationV1(state)?.type,
      "apply_in_new_context",
    );
  }
});

test("two distinct independent Run opportunities confirm deterministically", () => {
  const first = evidence(1);
  const second = evidence(2);
  const asOf = "2026-01-02T00:00:00.000Z";
  const state = projectLearnerObjectiveStateV1([first, second], asOf);
  const reversed = projectLearnerObjectiveStateV1([second, first], asOf);

  assert.deepEqual(state, reversed);
  assert.equal(state.status, "confirmed");
  assert.equal(state.reasonCode, "multiple_independent_opportunities");
  assert.deepEqual(state.evidenceIds, [second.id, first.id]);
  assert.equal(projectLearningRecommendationV1(state)?.type, "move_forward");
});

test("freshness becomes recheck_due at the exact fixed-clock boundary", () => {
  const first = evidence(1);
  const latest = evidence(2);
  const due = new Date(
    Date.parse(latest.observedAt) + OBJECTIVE_STATE_FRESHNESS_MS_V1,
  );
  const justBefore = new Date(due.getTime() - 1);

  assert.equal(
    projectLearnerObjectiveStateV1([first, latest], justBefore).status,
    "confirmed",
  );
  const stale = projectLearnerObjectiveStateV1([first, latest], due);
  assert.equal(stale.status, "recheck_due");
  assert.equal(stale.reasonCode, "confirmed_evidence_stale");
  assert.equal(stale.freshnessDueAt, due.toISOString());
  assert.equal(
    projectLearningRecommendationV1(stale)?.type,
    "recheck_freshness",
  );
});

test("superseding correction removes old evidence from a rebuild", () => {
  const first = evidence(1);
  const superseded = evidence(2, { supersededByEvidenceId: uuid(999) });
  const replacement = evidence(3, {
    id: uuid(999),
    direction: "negative",
    support: null,
    reasonCode: "not_yet_negative_evidence",
    supersedesEvidenceId: superseded.id,
  });
  const input = [first, superseded, replacement];

  const state = projectLearnerObjectiveStateV1(
    input,
    "2026-01-02T00:00:00.000Z",
  );
  assert.equal(state.reasonCode, "latest_not_yet");
  assert.deepEqual(state.evidenceIds, [replacement.id]);
  assert.deepEqual(
    projectLearnerObjectiveStateV1(input, "2026-01-02T00:00:00.000Z"),
    state,
  );
});

test("objective-state-v1 rejects mixed keys and unsupported policy evidence", () => {
  assert.throws(
    () =>
      projectLearnerObjectiveStateV1(
        [evidence(1), evidence(2, { learnerProfileId: uuid(999) })],
        BASE_TIME,
      ),
    (error: unknown) =>
      error instanceof ObjectiveStatePolicyError &&
      error.code === "objective_state_key_mixed",
  );

  assert.throws(
    () =>
      projectLearnerObjectiveStateV1(
        [
          evidence(1, {
            eligibilityPolicyVersion: 2 as 1,
          }),
        ],
        BASE_TIME,
      ),
    (error: unknown) =>
      error instanceof ObjectiveStatePolicyError &&
      error.code === "objective_state_evidence_policy_unsupported",
  );
});
