import {
  CHOICE_QUIZ_EVIDENCE_ELIGIBILITY_POLICY_VERSION,
  EVIDENCE_ELIGIBILITY_POLICY_VERSION,
  OBJECTIVE_STATE_POLICY_VERSION,
  type LearningEvidence,
  type ProjectedLearnerObjectiveStateV1,
} from "./domain";

export const OBJECTIVE_STATE_FRESHNESS_DAYS_V1 = 90;
export const OBJECTIVE_STATE_FRESHNESS_MS_V1 =
  OBJECTIVE_STATE_FRESHNESS_DAYS_V1 * 24 * 60 * 60 * 1_000;

export type LearningActivityClock = {
  now(): Date;
};

export const systemLearningActivityClock: LearningActivityClock = {
  now: () => new Date(),
};

export function fixedLearningActivityClock(
  now: string | Date,
): LearningActivityClock {
  const fixed = new Date(now);
  if (!Number.isFinite(fixed.getTime())) {
    throw new TypeError("fixed_clock_invalid");
  }
  return { now: () => new Date(fixed.getTime()) };
}

export class ObjectiveStatePolicyError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "ObjectiveStatePolicyError";
  }
}

const REASON_TEXT = {
  no_eligible_evidence: "Пока нет подходящих наблюдений по этой учебной цели.",
  latest_not_yet:
    "В последнем наблюдении пока не получилось — навык ещё формируется.",
  latest_with_support:
    "В последнем наблюдении получилось с поддержкой — навык ещё формируется.",
  independent_opportunities_missing:
    "Есть самостоятельное выполнение, но нужно подтверждение в другом занятии.",
  multiple_independent_opportunities:
    "Навык подтверждён самостоятельными наблюдениями в разных занятиях.",
  confirmed_evidence_stale:
    "Подтверждение навыка устарело по сроку свежести — его пора перепроверить.",
} as const;

function timestamp(value: string, field: string) {
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds)) {
    throw new ObjectiveStatePolicyError(`objective_state_${field}_invalid`);
  }
  return milliseconds;
}

function compareEvidenceNewestFirst(
  left: LearningEvidence,
  right: LearningEvidence,
) {
  return (
    timestamp(right.observedAt, "observed_at") -
      timestamp(left.observedAt, "observed_at") ||
    right.id.localeCompare(left.id)
  );
}

function assertOneObjective(evidence: LearningEvidence[]) {
  const [first] = evidence;
  if (!first) return;
  for (const item of evidence) {
    if (
      item.learnerProfileId !== first.learnerProfileId ||
      item.recordedByAccountId !== first.recordedByAccountId ||
      item.sourceCourseIdAtTime !== first.sourceCourseIdAtTime ||
      item.sourceLearningObjectiveIdAtTime !==
        first.sourceLearningObjectiveIdAtTime
    ) {
      throw new ObjectiveStatePolicyError("objective_state_key_mixed");
    }
    const expectedEligibilityPolicyVersion =
      item.sourceKind === "observation"
        ? EVIDENCE_ELIGIBILITY_POLICY_VERSION
        : CHOICE_QUIZ_EVIDENCE_ELIGIBILITY_POLICY_VERSION;
    if (
      item.evidenceVersion !== 1 ||
      item.eligibilityPolicyVersion !== expectedEligibilityPolicyVersion
    ) {
      throw new ObjectiveStatePolicyError(
        "objective_state_evidence_policy_unsupported",
      );
    }
    timestamp(item.observedAt, "observed_at");
    timestamp(item.finalizedAt, "finalized_at");
    timestamp(item.materializedAt, "materialized_at");
    if (
      (item.direction === "negative" && item.support !== null) ||
      (item.direction === "positive" && item.support === null)
    ) {
      throw new ObjectiveStatePolicyError(
        "objective_state_evidence_semantics_invalid",
      );
    }
  }
}

function activeEvidence(evidence: LearningEvidence[]) {
  const active = evidence.filter(
    (item) => item.supersededByEvidenceId === null,
  );
  const ids = new Set<string>();
  for (const item of active) {
    if (ids.has(item.id)) {
      throw new ObjectiveStatePolicyError("objective_state_evidence_duplicate");
    }
    ids.add(item.id);
  }
  return active.sort(compareEvidenceNewestFirst);
}

function evaluatedAtIso(asOf: string | Date) {
  const date = new Date(asOf);
  if (!Number.isFinite(date.getTime())) {
    throw new ObjectiveStatePolicyError("objective_state_as_of_invalid");
  }
  return date.toISOString();
}

/**
 * Transparent objective-state-v1 policy. It has no scores, percentages or
 * hidden weights: the latest evidence determines direction/support and two
 * independent results must come from two distinct LessonRuns.
 */
export function projectLearnerObjectiveStateV1(
  evidence: LearningEvidence[],
  asOf: string | Date,
): ProjectedLearnerObjectiveStateV1 {
  assertOneObjective(evidence);
  const evaluatedAt = evaluatedAtIso(asOf);
  const active = activeEvidence(evidence);
  const latest = active[0];

  if (!latest) {
    return {
      status: "no_data",
      reasonCode: "no_eligible_evidence",
      reasonText: REASON_TEXT.no_eligible_evidence,
      policyVersion: OBJECTIVE_STATE_POLICY_VERSION,
      evaluatedAt,
      lastEvidenceAt: null,
      freshnessDueAt: null,
      evidenceIds: [],
    };
  }

  const lastEvidenceAt = new Date(
    timestamp(latest.observedAt, "observed_at"),
  ).toISOString();

  if (latest.direction === "negative") {
    return {
      status: "forming",
      reasonCode: "latest_not_yet",
      reasonText: REASON_TEXT.latest_not_yet,
      policyVersion: OBJECTIVE_STATE_POLICY_VERSION,
      evaluatedAt,
      lastEvidenceAt,
      freshnessDueAt: null,
      evidenceIds: [latest.id],
    };
  }

  if (latest.support === "with_support") {
    return {
      status: "forming",
      reasonCode: "latest_with_support",
      reasonText: REASON_TEXT.latest_with_support,
      policyVersion: OBJECTIVE_STATE_POLICY_VERSION,
      evaluatedAt,
      lastEvidenceAt,
      freshnessDueAt: null,
      evidenceIds: [latest.id],
    };
  }

  const independentByRun = new Map<string, LearningEvidence>();
  for (const item of active) {
    if (
      item.direction === "positive" &&
      item.support === "independent" &&
      !independentByRun.has(item.sourceLessonRunIdAtTime)
    ) {
      independentByRun.set(item.sourceLessonRunIdAtTime, item);
    }
  }
  const determiningEvidence = [...independentByRun.values()].slice(0, 2);

  if (determiningEvidence.length < 2) {
    return {
      status: "forming",
      reasonCode: "independent_opportunities_missing",
      reasonText: REASON_TEXT.independent_opportunities_missing,
      policyVersion: OBJECTIVE_STATE_POLICY_VERSION,
      evaluatedAt,
      lastEvidenceAt,
      freshnessDueAt: null,
      evidenceIds: determiningEvidence.map((item) => item.id),
    };
  }

  const freshnessDueAt = new Date(
    timestamp(latest.observedAt, "observed_at") +
      OBJECTIVE_STATE_FRESHNESS_MS_V1,
  ).toISOString();
  const isStale = Date.parse(evaluatedAt) >= Date.parse(freshnessDueAt);
  return {
    status: isStale ? "recheck_due" : "confirmed",
    reasonCode: isStale
      ? "confirmed_evidence_stale"
      : "multiple_independent_opportunities",
    reasonText: isStale
      ? REASON_TEXT.confirmed_evidence_stale
      : REASON_TEXT.multiple_independent_opportunities,
    policyVersion: OBJECTIVE_STATE_POLICY_VERSION,
    evaluatedAt,
    lastEvidenceAt,
    freshnessDueAt,
    evidenceIds: determiningEvidence.map((item) => item.id),
  };
}
