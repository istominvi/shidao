import { z } from "zod";
import { postgresUuidSchema } from "@/lib/postgres-uuid";

export const coursePublicationProgressSchema = z
  .object({
    publicationId: postgresUuidSchema,
    revisionId: postgresUuidSchema,
    completedLessonRefs: z.array(postgresUuidSchema),
    lastOpenedLessonRef: postgresUuidSchema.nullable(),
    completedLessonCount: z.number().int().nonnegative(),
    totalLessonCount: z.number().int().positive(),
    percent: z.number().int().min(0).max(100),
    complete: z.boolean(),
  })
  .strict()
  .superRefine((progress, context) => {
    if (
      progress.completedLessonCount !== progress.completedLessonRefs.length ||
      new Set(progress.completedLessonRefs).size !==
        progress.completedLessonRefs.length ||
      progress.completedLessonCount > progress.totalLessonCount
    ) {
      context.addIssue({
        code: "custom",
        message: "Некорректный прогресс курса.",
      });
    }
    const expectedPercent = Math.floor(
      (progress.completedLessonCount * 100) / progress.totalLessonCount,
    );
    if (
      progress.percent !== expectedPercent ||
      progress.complete !==
        (progress.completedLessonCount === progress.totalLessonCount)
    ) {
      context.addIssue({
        code: "custom",
        message: "Некорректный итог прогресса курса.",
      });
    }
  });

export const updateCoursePublicationProgressSchema = z
  .object({
    expectedRevisionId: postgresUuidSchema,
    lessonRef: postgresUuidSchema,
    completed: z.boolean(),
  })
  .strict();

export type UpdateCoursePublicationProgressInput = z.infer<
  typeof updateCoursePublicationProgressSchema
>;
