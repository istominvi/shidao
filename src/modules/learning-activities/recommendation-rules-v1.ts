import {
  RECOMMENDATION_RULE_VERSION,
  type ProjectedLearnerObjectiveStateV1,
  type ProjectedLearningRecommendationV1,
} from "./domain";

const RECOMMENDATIONS = {
  latest_not_yet: {
    type: "repeat",
    reasonCode: "repeat_after_not_yet",
    reasonText: "Пока не получилось — повторите материал и попробуйте ещё раз.",
  },
  latest_with_support: {
    type: "try_without_support",
    reasonCode: "try_without_support_after_supported_success",
    reasonText:
      "Получилось с поддержкой — следующим шагом попробуйте без подсказки.",
  },
  independent_opportunities_missing: {
    type: "apply_in_new_context",
    reasonCode: "apply_in_new_context_after_one_independent_opportunity",
    reasonText:
      "Получилось самостоятельно один раз — примените навык в новом контексте.",
  },
  multiple_independent_opportunities: {
    type: "move_forward",
    reasonCode: "move_forward_after_confirmation",
    reasonText:
      "Навык подтверждён в нескольких занятиях — можно переходить дальше.",
  },
  confirmed_evidence_stale: {
    type: "recheck_freshness",
    reasonCode: "recheck_due_to_freshness",
    reasonText:
      "Подтверждение давно не обновлялось — пора перепроверить навык.",
  },
} as const;

/** A deterministic next-step projection; it never schedules or reorders work. */
export function projectLearningRecommendationV1(
  state: ProjectedLearnerObjectiveStateV1,
): ProjectedLearningRecommendationV1 | null {
  if (state.reasonCode === "no_eligible_evidence") return null;
  const rule = RECOMMENDATIONS[state.reasonCode];
  return {
    ...rule,
    ruleVersion: RECOMMENDATION_RULE_VERSION,
    generatedAt: state.evaluatedAt,
    evidenceIds: [...state.evidenceIds],
  };
}
