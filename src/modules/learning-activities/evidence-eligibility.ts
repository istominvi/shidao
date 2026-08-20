import type {
  LessonComponentObservation,
  ObservationEntryMethod,
  ObservationRating,
} from "./domain";

export type ObservationEvidenceSupport = "independent" | "with_support" | null;

export type ObservationEvidenceDirection = "positive" | "negative";

export type ObservationEvidenceEligibilityReasonCode =
  | "objective_alignment_missing"
  | "observable_criterion_missing"
  | "teacher_confirmation_missing"
  | "independent_positive_evidence"
  | "supported_positive_evidence"
  | "not_yet_negative_evidence";

export type ObservationEvidenceEligibilityInput = Pick<
  LessonComponentObservation,
  | "sourceLearningObjectiveIdAtTime"
  | "learningObjectiveId"
  | "learningObjectiveTitleAtTime"
  | "observableCriterionAtTime"
  | "rating"
> & {
  /** A draft has no persisted entry method and is therefore not evidence. */
  entryMethod: ObservationEntryMethod | null | undefined;
};

export type ObservationEvidenceEligibilityProjection = {
  eligible: boolean;
  rating: ObservationRating;
  support: ObservationEvidenceSupport;
  direction: ObservationEvidenceDirection;
  reasonCodes: ObservationEvidenceEligibilityReasonCode[];
};

/**
 * Classifies one persisted teacher observation without writing profile state.
 * This is an eligibility projection only: LA-M2 deliberately does not infer
 * mastery, percentages, recommendations, or any durable objective state.
 */
export function projectObservationEvidenceEligibility(
  observation: ObservationEvidenceEligibilityInput,
): ObservationEvidenceEligibilityProjection {
  const support: ObservationEvidenceSupport =
    observation.rating === "independent"
      ? "independent"
      : observation.rating === "with_support"
        ? "with_support"
        : null;
  const direction: ObservationEvidenceDirection =
    observation.rating === "not_yet" ? "negative" : "positive";
  const reasonCodes: ObservationEvidenceEligibilityReasonCode[] = [];

  if (
    !observation.sourceLearningObjectiveIdAtTime ||
    !observation.learningObjectiveTitleAtTime?.trim()
  ) {
    reasonCodes.push("objective_alignment_missing");
  }
  if (!observation.observableCriterionAtTime.trim()) {
    reasonCodes.push("observable_criterion_missing");
  }
  if (
    observation.entryMethod !== "direct" &&
    observation.entryMethod !== "bulk_confirmed"
  ) {
    reasonCodes.push("teacher_confirmation_missing");
  }

  const eligible = reasonCodes.length === 0;
  if (eligible) {
    reasonCodes.push(
      observation.rating === "independent"
        ? "independent_positive_evidence"
        : observation.rating === "with_support"
          ? "supported_positive_evidence"
          : "not_yet_negative_evidence",
    );
  }

  return {
    eligible,
    rating: observation.rating,
    support,
    direction,
    reasonCodes,
  };
}
