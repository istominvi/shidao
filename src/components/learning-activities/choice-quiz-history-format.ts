import type { ChoiceQuizTeacherHistory } from "@/modules/choice-quiz/contracts";

export type ChoiceQuizHistoryItem = ChoiceQuizTeacherHistory["items"][number];

export type ChoiceQuizAttemptHistory = {
  key: string;
  learnerDisplayName: string;
  question: string;
  objectiveTitleAtTime: string | null;
  activityRole: ChoiceQuizHistoryItem["activityRole"];
  attemptNumber: number;
  selectedOptions: ChoiceQuizHistoryItem["selectedOptions"];
  supportContext: ChoiceQuizHistoryItem["supportContext"];
  evaluations: ChoiceQuizHistoryItem[];
};

export function groupChoiceQuizAttemptHistory(
  items: readonly ChoiceQuizHistoryItem[],
): ChoiceQuizAttemptHistory[] {
  const groups = new Map<string, ChoiceQuizAttemptHistory>();

  for (const item of items) {
    const key = `${item.issueRef}:${item.attemptNumber}`;
    const current = groups.get(key);
    if (current) {
      current.evaluations.push(item);
      continue;
    }
    groups.set(key, {
      key,
      learnerDisplayName: item.learnerDisplayName,
      question: item.question,
      objectiveTitleAtTime: item.objectiveTitleAtTime,
      activityRole: item.activityRole,
      attemptNumber: item.attemptNumber,
      selectedOptions: item.selectedOptions,
      supportContext: item.supportContext,
      evaluations: [item],
    });
  }

  return Array.from(groups.values(), (group) => ({
    ...group,
    evaluations: group.evaluations
      .slice()
      .sort(
        (left, right) =>
          left.evaluatedAt.localeCompare(right.evaluatedAt) ||
          left.evaluationId.localeCompare(right.evaluationId),
      ),
  }));
}

export function choiceQuizRoleLabel(
  role: ChoiceQuizHistoryItem["activityRole"],
) {
  return role === "assessment" ? "Проверочная работа" : "Практика";
}

export function choiceQuizSupportLabel(
  support: ChoiceQuizHistoryItem["supportContext"],
) {
  return support === "independent" ? "Самостоятельно" : "С поддержкой";
}

const choiceQuizHistoryDateTime = new Intl.DateTimeFormat("ru-RU", {
  dateStyle: "medium",
  timeStyle: "short",
});

export function formatChoiceQuizHistoryTime(value: string) {
  return choiceQuizHistoryDateTime.format(new Date(value));
}
