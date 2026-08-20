import { z } from "zod";
import { CourseBuilderValidationError } from "@/modules/course-builder/contracts";

export const OBSERVABLE_CRITERION_MAX_LENGTH = 500;
export const OBSERVATION_PRIVATE_NOTE_MAX_LENGTH = 500;
export const OBSERVATION_COMPONENT_LABEL_MAX_LENGTH = 500;
export const OBSERVATION_COMPONENT_PROMPT_MAX_LENGTH = 240;
// One history response can contain at most 100 Runs with the existing
// 200-learner Run audience bound.
export const HISTORY_OBSERVATION_LEARNING_RECORD_IDS_MAX = 20_000;

export const observationRatingSchema = z.enum([
  "independent",
  "with_support",
  "not_yet",
]);

export const observationEntryMethodSchema = z.enum([
  "direct",
  "bulk_confirmed",
]);

export const historyObservationLearningRecordIdsSchema = z
  .array(z.guid())
  .max(HISTORY_OBSERVATION_LEARNING_RECORD_IDS_MAX)
  .transform((ids) => [...new Set(ids)]);

const nullableTrimmedText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .transform((value) => value?.trim() || null);

export const saveLessonComponentObservationEntrySchema = z
  .object({
    learningRecordId: z.guid(),
    rating: observationRatingSchema.nullable(),
    privateNote: nullableTrimmedText(OBSERVATION_PRIVATE_NOTE_MAX_LENGTH),
  })
  .strict()
  .superRefine((entry, context) => {
    if (entry.rating === null && entry.privateNote) {
      context.addIssue({
        code: "custom",
        path: ["privateNote"],
        message: "У отметки «не наблюдал» не может быть заметки.",
      });
    }
  });

export const saveLessonComponentObservationsInputSchema = z
  .object({
    lessonComponentId: z.guid(),
    observableCriterionAtTime: nullableTrimmedText(
      OBSERVABLE_CRITERION_MAX_LENGTH,
    ),
    entryMethod: observationEntryMethodSchema,
    entries: z.array(saveLessonComponentObservationEntrySchema).min(1).max(200),
  })
  .strict()
  .superRefine((input, context) => {
    if (
      new Set(input.entries.map((entry) => entry.learningRecordId)).size !==
      input.entries.length
    ) {
      context.addIssue({
        code: "custom",
        path: ["entries"],
        message: "Отметку каждого ученика нужно передать ровно один раз.",
      });
    }

    if (
      input.entries.some((entry) => entry.rating !== null) &&
      !input.observableCriterionAtTime
    ) {
      context.addIssue({
        code: "custom",
        path: ["observableCriterionAtTime"],
        message: "Сначала подтвердите наблюдаемый критерий.",
      });
    }
  });

export type SaveLessonComponentObservationsInput = z.infer<
  typeof saveLessonComponentObservationsInputSchema
>;

export function parseLearningActivitiesContract<T>(
  schema: z.ZodType<T>,
  value: unknown,
): T {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  throw new CourseBuilderValidationError(
    result.error.issues[0]?.message ?? "Проверьте данные наблюдения.",
  );
}
