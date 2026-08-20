import assert from "node:assert/strict";
import test from "node:test";
import type { ObservationEvidenceEligibilityInput } from "./evidence-eligibility";
import { projectObservationEvidenceEligibility } from "./evidence-eligibility";

const OBJECTIVE_ID = "00000000-0000-4000-8000-000000000001";

function input(
  overrides: Partial<ObservationEvidenceEligibilityInput> = {},
): ObservationEvidenceEligibilityInput {
  return {
    learningObjectiveId: OBJECTIVE_ID,
    sourceLearningObjectiveIdAtTime: OBJECTIVE_ID,
    learningObjectiveTitleAtTime: "Различает второй и третий тон",
    observableCriterionAtTime: "Верно различает тоны в знакомых словах",
    rating: "independent",
    entryMethod: "direct",
    ...overrides,
  };
}

test("direct and confirmed-bulk observations are eligible with preserved support", () => {
  assert.deepEqual(projectObservationEvidenceEligibility(input()), {
    eligible: true,
    rating: "independent",
    support: "independent",
    direction: "positive",
    reasonCodes: ["independent_positive_evidence"],
  });

  assert.deepEqual(
    projectObservationEvidenceEligibility(
      input({ rating: "with_support", entryMethod: "bulk_confirmed" }),
    ),
    {
      eligible: true,
      rating: "with_support",
      support: "with_support",
      direction: "positive",
      reasonCodes: ["supported_positive_evidence"],
    },
  );
});

test("not_yet is eligible negative evidence and never represented as mastery", () => {
  const projection = projectObservationEvidenceEligibility(
    input({ rating: "not_yet" }),
  );

  assert.deepEqual(projection, {
    eligible: true,
    rating: "not_yet",
    support: null,
    direction: "negative",
    reasonCodes: ["not_yet_negative_evidence"],
  });
  assert.equal("mastery" in projection, false);
  assert.equal("masteryPercent" in projection, false);
});

test("legacy, blank-criterion, and unconfirmed drafts remain ineligible with reason codes", () => {
  assert.deepEqual(
    projectObservationEvidenceEligibility(
      input({
        sourceLearningObjectiveIdAtTime: null,
        learningObjectiveTitleAtTime: null,
        observableCriterionAtTime: "   ",
        entryMethod: null,
      }),
    ),
    {
      eligible: false,
      rating: "independent",
      support: "independent",
      direction: "positive",
      reasonCodes: [
        "objective_alignment_missing",
        "observable_criterion_missing",
        "teacher_confirmation_missing",
      ],
    },
  );
});

test("deleting the live objective does not invalidate stable objective-at-time provenance", () => {
  const projection = projectObservationEvidenceEligibility(
    input({ learningObjectiveId: null }),
  );

  assert.equal(projection.eligible, true);
  assert.deepEqual(projection.reasonCodes, ["independent_positive_evidence"]);
});
