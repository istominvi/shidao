import type { LearningEvidence } from "@/modules/learning-activities";

export function currentEvidenceByObservation(
  evidence: LearningEvidence[],
): Map<string, LearningEvidence[]> {
  const grouped = new Map<string, LearningEvidence[]>();
  for (const item of evidence) {
    if (item.sourceKind !== "observation" || item.supersededByEvidenceId) {
      continue;
    }
    const current = grouped.get(item.sourceObservationId) ?? [];
    current.push(item);
    grouped.set(item.sourceObservationId, current);
  }
  for (const items of grouped.values()) {
    items.sort(
      (left, right) =>
        left.finalizedAt.localeCompare(right.finalizedAt) ||
        left.id.localeCompare(right.id),
    );
  }
  return grouped;
}

export function evidenceDirectionLabel(evidence: LearningEvidence) {
  if (evidence.direction === "negative") return "Нужна дальнейшая работа";
  return evidence.support === "with_support"
    ? "Получилось с поддержкой"
    : "Получилось самостоятельно";
}
