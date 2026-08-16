import { z } from "zod";
import {
  CourseBuilderConflictError,
  CourseBuilderValidationError,
} from "@/modules/course-builder/contracts";

const optionalTrimmedText = (max: number) =>
  z.string().trim().max(max).default("");

const uniqueUuidList = (options?: {
  allowEmpty?: boolean;
  duplicateMessage?: string;
}) =>
  z
    .array(z.guid())
    .min(options?.allowEmpty ? 0 : 1)
    .max(200)
    .refine((ids) => new Set(ids).size === ids.length, {
      message:
        options?.duplicateMessage ?? "Один ученик не может быть указан дважды.",
    });

export const createLearnerProfileInputSchema = z
  .object({
    displayName: z.string().trim().min(1).max(160),
    learnerGroupIds: uniqueUuidList({
      allowEmpty: true,
      duplicateMessage: "Одна группа не может быть указана дважды.",
    }).default([]),
  })
  .strict();

export type CreateLearnerProfileInput = z.infer<
  typeof createLearnerProfileInputSchema
>;

export const updateLearnerProfileInputSchema = z
  .object({
    displayName: z.string().trim().min(1).max(160),
    learnerGroupIds: uniqueUuidList({
      allowEmpty: true,
      duplicateMessage: "Одна группа не может быть указана дважды.",
    }),
  })
  .strict();

export type UpdateLearnerProfileInput = z.infer<
  typeof updateLearnerProfileInputSchema
>;

export const createLearnerGroupInputSchema = z
  .object({
    name: z.string().trim().min(1).max(160),
    learnerProfileIds: uniqueUuidList({ allowEmpty: true }).default([]),
  })
  .strict();

export type CreateLearnerGroupInput = z.infer<
  typeof createLearnerGroupInputSchema
>;

export const updateLearnerGroupInputSchema = z
  .object({
    name: z.string().trim().min(1).max(160),
    learnerProfileIds: uniqueUuidList({ allowEmpty: true }),
  })
  .strict();

export type UpdateLearnerGroupInput = z.infer<
  typeof updateLearnerGroupInputSchema
>;

export const mixedCourseAudienceInputSchema = z
  .object({
    directLearnerProfileIds: uniqueUuidList({ allowEmpty: true }),
    learnerGroupIds: uniqueUuidList({
      allowEmpty: true,
      duplicateMessage: "Одна группа не может быть указана дважды.",
    }),
  })
  .strict();

export const legacyCourseAudienceInputSchema = z
  .object({
    learnerProfileIds: uniqueUuidList({ allowEmpty: true }),
  })
  .strict();

export const replaceCourseAudienceInputSchema = z.union([
  mixedCourseAudienceInputSchema,
  legacyCourseAudienceInputSchema,
]);

export type ReplaceCourseAudienceInput = z.infer<
  typeof replaceCourseAudienceInputSchema
>;

const runAudienceShape = {
  learnerProfileIds: uniqueUuidList().optional(),
};

export const scheduleLessonRunInputSchema = z
  .object({
    scheduledAt: z.iso.datetime({ offset: true }),
    plannedDurationMinutes: z.number().int().min(5).max(480).optional(),
    ...runAudienceShape,
  })
  .strict();

export type ScheduleLessonRunInput = z.infer<
  typeof scheduleLessonRunInputSchema
>;

export const rescheduleLessonRunInputSchema = z
  .object({
    scheduledAt: z.iso.datetime({ offset: true }).optional(),
    plannedDurationMinutes: z.number().int().min(5).max(480).optional(),
    ...runAudienceShape,
  })
  .strict()
  .refine((input) => Object.keys(input).length > 0, {
    message: "Нужно передать время, длительность или состав участников.",
  });

export type RescheduleLessonRunInput = z.infer<
  typeof rescheduleLessonRunInputSchema
>;

export const assistantScheduleLessonRunInputSchema = z
  .object({
    scheduledAt: z.iso.datetime({ offset: true }),
    plannedDurationMinutes: z.number().int().min(5).max(480),
    expectedLessonRunId: z.guid().nullable(),
    expectedLessonRunUpdatedAt: z.iso.datetime({ offset: true }).nullable(),
    expectedLearnerProfileIds: uniqueUuidList({ allowEmpty: true }).refine(
      (ids) =>
        ids.every(
          (learnerProfileId, index) =>
            index === 0 || ids[index - 1]!.localeCompare(learnerProfileId) < 0,
        ),
      {
        message:
          "Ожидаемый состав участников должен быть отсортирован по идентификатору.",
      },
    ),
  })
  .strict()
  .superRefine((input, context) => {
    if (
      (input.expectedLessonRunId === null) !==
      (input.expectedLessonRunUpdatedAt === null)
    ) {
      context.addIssue({
        code: "custom",
        path: ["expectedLessonRunUpdatedAt"],
        message:
          "Ожидаемые идентификатор и версия занятия должны быть указаны вместе.",
      });
    }
  });

export type AssistantScheduleLessonRunInput = z.infer<
  typeof assistantScheduleLessonRunInputSchema
>;

export const completeLearningRecordInputSchema = z
  .object({
    learnerProfileId: z.guid(),
    wasPresent: z.boolean(),
    needsRepeat: z.boolean(),
    teacherComment: optionalTrimmedText(2_000),
    shareWithLearner: z.boolean().default(false),
  })
  .strict()
  .superRefine((record, context) => {
    if (!record.wasPresent && record.needsRepeat) {
      context.addIssue({
        code: "custom",
        path: ["needsRepeat"],
        message: "Повторение оценивается только для присутствовавшего ученика.",
      });
    }
    if (record.shareWithLearner && !record.teacherComment) {
      context.addIssue({
        code: "custom",
        path: ["shareWithLearner"],
        message: "Сначала добавьте комментарий для учебного профиля.",
      });
    }
  });

export const completeLessonRunInputSchema = z
  .object({
    teacherReport: optionalTrimmedText(4_000),
    actualDurationMinutes: z
      .number()
      .int()
      .min(1)
      .max(720)
      .nullable()
      .optional(),
    records: z.array(completeLearningRecordInputSchema).min(1).max(200),
  })
  .strict()
  .refine(
    (input) =>
      new Set(input.records.map((record) => record.learnerProfileId)).size ===
      input.records.length,
    {
      message: "Результат каждого ученика нужно передать ровно один раз.",
      path: ["records"],
    },
  );

export type CompleteLessonRunInput = z.infer<
  typeof completeLessonRunInputSchema
>;

export const lessonRunWindowInputSchema = z
  .object({
    from: z.iso.datetime({ offset: true }),
    to: z.iso.datetime({ offset: true }),
  })
  .strict()
  .superRefine((window, context) => {
    const from = Date.parse(window.from);
    const to = Date.parse(window.to);
    if (to <= from) {
      context.addIssue({
        code: "custom",
        path: ["to"],
        message: "Конец периода должен быть позже начала.",
      });
      return;
    }
    if (to - from > 93 * 24 * 60 * 60 * 1_000) {
      context.addIssue({
        code: "custom",
        path: ["to"],
        message: "За один запрос можно открыть не более 93 дней.",
      });
    }
  });

export type LessonRunWindowInput = z.infer<typeof lessonRunWindowInputSchema>;

export function parseLessonRunsContract<T>(
  schema: z.ZodType<T>,
  value: unknown,
): T {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  throw new CourseBuilderValidationError(
    result.error.issues[0]?.message ?? "Проверьте данные занятия.",
  );
}

export function assertSameLearnerSet(
  expectedIds: string[],
  receivedIds: string[],
) {
  const expected = new Set(expectedIds);
  const received = new Set(receivedIds);
  if (
    expected.size !== received.size ||
    [...expected].some((learnerId) => !received.has(learnerId))
  ) {
    throw new CourseBuilderConflictError(
      "Нужно отметить результат каждого ожидаемого ученика.",
      "lesson_run_participants_changed",
    );
  }
}
