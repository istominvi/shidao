import { z } from "zod";
import { postgresUuidSchema } from "@/lib/postgres-uuid";

export const HOMEWORK_ITEM_LIMIT = 50;

/**
 * P1.3 is common teacher authoring only. The allowlist deliberately contains
 * no activity facet, evaluator, response, or learner-execution type.
 */
export const homeworkItemTypeKeys = [
  "rich_text",
  "image",
  "external_link",
  "file",
] as const;

export const homeworkItemTypeKeySchema = z.enum(homeworkItemTypeKeys);
export type HomeworkItemTypeKey = z.infer<typeof homeworkItemTypeKeySchema>;

const jsonObjectSchema = z.record(z.string(), z.unknown());
const revisionSchema = z.number().int().positive().max(2_147_483_647);

export const lessonHomeworkDraftItemSchema = z
  .object({
    id: postgresUuidSchema,
    typeKey: homeworkItemTypeKeySchema,
    schemaVersion: z.number().int().positive().max(100_000),
    payload: jsonObjectSchema,
    placement: jsonObjectSchema,
  })
  .strict();

export const replaceLessonHomeworkInputSchema = z
  .object({
    expectedRevision: revisionSchema.nullable(),
    items: z
      .array(lessonHomeworkDraftItemSchema)
      .min(1)
      .max(HOMEWORK_ITEM_LIMIT),
  })
  .strict()
  .superRefine((input, context) => {
    const ids = input.items.map((item) => item.id);
    if (new Set(ids).size !== ids.length) {
      context.addIssue({
        code: "custom",
        path: ["items"],
        message: "Пункты домашнего задания должны иметь уникальные ID.",
      });
    }
  });

export const clearLessonHomeworkInputSchema = z
  .object({ expectedRevision: revisionSchema })
  .strict();

export const lessonHomeworkItemSchema = lessonHomeworkDraftItemSchema
  .extend({ position: z.number().int().positive().max(HOMEWORK_ITEM_LIMIT) })
  .strict();

export const lessonHomeworkSchema = z
  .object({
    id: postgresUuidSchema,
    lessonId: postgresUuidSchema,
    revision: revisionSchema,
    items: z.array(lessonHomeworkItemSchema).max(HOMEWORK_ITEM_LIMIT),
    createdAt: z.iso.datetime({ offset: true }),
    updatedAt: z.iso.datetime({ offset: true }),
  })
  .strict()
  .superRefine((homework, context) => {
    const ids = homework.items.map((item) => item.id);
    if (new Set(ids).size !== ids.length) {
      context.addIssue({
        code: "custom",
        path: ["items"],
        message: "Homework item identifiers must be unique.",
      });
    }
    homework.items.forEach((item, index) => {
      if (item.position !== index + 1) {
        context.addIssue({
          code: "custom",
          path: ["items", index, "position"],
          message: "Homework item positions must be dense and ordered.",
        });
      }
    });
  });

export const lessonHomeworkScopeSchema = z
  .object({
    courseId: postgresUuidSchema,
    lessonId: postgresUuidSchema,
    homework: lessonHomeworkSchema.nullable(),
  })
  .strict();

export type ReplaceLessonHomeworkInput = z.infer<
  typeof replaceLessonHomeworkInputSchema
>;
export type ClearLessonHomeworkInput = z.infer<
  typeof clearLessonHomeworkInputSchema
>;
