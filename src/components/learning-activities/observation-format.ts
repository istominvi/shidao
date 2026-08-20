import type { LessonComponent } from "@/modules/course-builder/domain";
import { findComponentDefinition } from "@/modules/course-builder/registry/contracts";
import type {
  LessonComponentObservation,
  ObservationRating,
} from "@/modules/learning-activities";

export type ObservationRatingValue = ObservationRating | null;

export const observationRatingOptions: ReadonlyArray<{
  value: ObservationRatingValue;
  label: string;
  shortLabel: string;
  description: string;
}> = [
  {
    value: "independent",
    label: "Самостоятельно",
    shortLabel: "Сам",
    description: "Выполнил без подсказки",
  },
  {
    value: "with_support",
    label: "С помощью",
    shortLabel: "С помощью",
    description: "Выполнил после подсказки или помощи",
  },
  {
    value: "not_yet",
    label: "Пока не получилось",
    shortLabel: "Пока не получилось",
    description: "Попытка была, но критерий пока не достигнут",
  },
  {
    value: null,
    label: "Не наблюдал",
    shortLabel: "Не наблюдал",
    description: "Не делаем вывод по этому компоненту",
  },
] as const;

export type ObservationSummary = {
  totalLearners: number;
  observedLearners: number;
  independent: number;
  withSupport: number;
  notYet: number;
  notObserved: number;
};

export function summarizeObservations(
  observations: readonly Pick<
    LessonComponentObservation,
    "learningRecordId" | "rating"
  >[],
  totalLearners: number,
): ObservationSummary {
  const latestByRecord = new Map<string, ObservationRating>();
  for (const observation of observations) {
    latestByRecord.set(observation.learningRecordId, observation.rating);
  }

  const ratings = [...latestByRecord.values()];
  const independent = ratings.filter(
    (rating) => rating === "independent",
  ).length;
  const withSupport = ratings.filter(
    (rating) => rating === "with_support",
  ).length;
  const notYet = ratings.filter((rating) => rating === "not_yet").length;
  const observedLearners = ratings.length;

  return {
    totalLearners,
    observedLearners,
    independent,
    withSupport,
    notYet,
    notObserved: Math.max(0, totalLearners - observedLearners),
  };
}

export function observationsForComponent(
  observations: readonly LessonComponentObservation[],
  componentId: string,
) {
  return observations.filter(
    (observation) =>
      observation.lessonComponentId === componentId ||
      observation.sourceComponentIdAtTime === componentId,
  );
}

export function persistedCriterionForComponent(
  observations: readonly LessonComponentObservation[],
  componentId: string,
) {
  return (
    observationsForComponent(observations, componentId)[0]
      ?.observableCriterionAtTime ?? null
  );
}

export function componentDisplayLabel(
  component: Pick<LessonComponent, "position" | "typeKey">,
) {
  const title =
    findComponentDefinition(component.typeKey)?.title ?? "Компонент";
  return `${component.position}. ${title}`;
}

function firstMeaningfulText(
  payload: Record<string, unknown>,
  keys: readonly string[],
) {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function conciseText(value: string, maxLength = 180) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1).trimEnd()}…`;
}

/**
 * A deliberately modest authoring-time suggestion. It only turns visible
 * component copy into a teacher-confirmed criterion; it never pretends that
 * the component payload already contains an assessed learner result.
 */
export function suggestObservableCriterion(
  component: Pick<LessonComponent, "typeKey" | "payload">,
) {
  const question = firstMeaningfulText(component.payload, [
    "question",
    "prompt",
  ]);
  const instruction = firstMeaningfulText(component.payload, ["instruction"]);
  const componentTitle =
    findComponentDefinition(component.typeKey)?.title.toLocaleLowerCase(
      "ru-RU",
    ) ?? "задание";

  if (question) {
    return `Ученик отвечает на вопрос: «${conciseText(question)}»`;
  }
  if (instruction) {
    return `Ученик выполняет инструкцию: «${conciseText(instruction)}»`;
  }

  return `Ученик демонстрирует наблюдаемое действие в компоненте «${componentTitle}».`;
}

export function ratingLabel(value: ObservationRatingValue) {
  return (
    observationRatingOptions.find((option) => option.value === value)?.label ??
    "Не наблюдал"
  );
}

export function formatObservationTime(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "время не указано";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
}
