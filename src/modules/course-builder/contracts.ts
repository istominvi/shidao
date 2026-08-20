import { z } from "zod";
import { postgresUuidSchema } from "@/lib/postgres-uuid";
import {
  courseLearningAudienceSchema,
  DEFAULT_COURSE_LEARNING_AUDIENCE,
} from "./learning-audience";
import { activityRoleSchema } from "./registry/contracts";

export const COURSE_ASSET_BUCKET = "course-assets";
export const COURSE_ASSET_MAX_BYTES = 10 * 1024 * 1024;

export const COURSE_ASSET_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/markdown",
] as const;

export const courseAssetMimeTypeSchema = z.enum(COURSE_ASSET_MIME_TYPES);

const optionalTrimmedText = (max: number) =>
  z.string().trim().max(max).default("");

export const courseDraftInputSchema = z.object({
  title: z.string().trim().min(2).max(160),
  learningAudience: courseLearningAudienceSchema.default(
    DEFAULT_COURSE_LEARNING_AUDIENCE,
  ),
  subject: z.string().trim().min(2).max(160),
  goal: z.string().trim().min(2).max(1_200),
  level: z.string().trim().min(1).max(240),
  audienceDescription: optionalTrimmedText(1_200),
  targetLessonCount: z.number().int().min(1).max(60),
  teacherPreferences: optionalTrimmedText(2_000),
});

export type CourseDraftInput = z.infer<typeof courseDraftInputSchema>;

export const courseUpdateInputSchema = courseDraftInputSchema
  .partial()
  .refine((input) => Object.keys(input).length > 0, {
    message: "Нужно передать хотя бы одно поле курса.",
  });

export type CourseUpdateInput = z.infer<typeof courseUpdateInputSchema>;

export const addLessonInputSchema = z.object({
  title: z.string().trim().min(1).max(180),
  summary: optionalTrimmedText(1_200),
});

export type AddLessonInput = z.infer<typeof addLessonInputSchema>;

export const updateLessonInputSchema = addLessonInputSchema
  .partial()
  .refine((input) => Object.keys(input).length > 0, {
    message: "Нужно передать хотя бы одно поле урока.",
  });

export type UpdateLessonInput = z.infer<typeof updateLessonInputSchema>;

export const updateLessonComponentInputSchema = z
  .object({
    payload: z.unknown().optional(),
    placement: z.unknown().optional(),
    primaryLearningObjectiveId: postgresUuidSchema.nullable().optional(),
    activityRole: activityRoleSchema.nullable().optional(),
  })
  .strict()
  .refine(
    (input) =>
      input.payload !== undefined ||
      input.placement !== undefined ||
      input.primaryLearningObjectiveId !== undefined ||
      input.activityRole !== undefined,
    { message: "Нужно передать изменение компонента." },
  );

export type UpdateLessonComponentInput = z.infer<
  typeof updateLessonComponentInputSchema
>;

const learningObjectiveDescriptionValueSchema = z
  .string()
  .trim()
  .min(1)
  .max(2_000)
  .nullable();

export const createLearningObjectiveInputSchema = z
  .object({
    title: z.string().trim().min(2).max(240),
    description: learningObjectiveDescriptionValueSchema.default(null),
  })
  .strict();

export type CreateLearningObjectiveInput = z.infer<
  typeof createLearningObjectiveInputSchema
>;

export const updateLearningObjectiveInputSchema = z
  .object({
    title: z.string().trim().min(2).max(240).optional(),
    description: learningObjectiveDescriptionValueSchema.optional(),
  })
  .strict()
  .refine(
    (input) => input.title !== undefined || input.description !== undefined,
    { message: "Нужно передать изменение цели." },
  );

export type UpdateLearningObjectiveInput = z.infer<
  typeof updateLearningObjectiveInputSchema
>;

export const reorderLessonComponentInputSchema = z.object({
  toPosition: z.number().int().min(1),
});

export type ReorderLessonComponentInput = z.infer<
  typeof reorderLessonComponentInputSchema
>;

function createComponentStudentScreenInputSchema<TShape extends z.ZodRawShape>(
  commonShape: TShape,
) {
  return z.discriminatedUnion("mode", [
    z.object({ ...commonShape, mode: z.literal("hide") }).strict(),
    z
      .object({
        ...commonShape,
        mode: z.literal("existing"),
        slideId: postgresUuidSchema,
      })
      .strict(),
    z.object({ ...commonShape, mode: z.literal("new") }).strict(),
  ]);
}

export const setComponentStudentScreenInputSchema =
  createComponentStudentScreenInputSchema({});

export const setComponentStudentScreenCommandInputSchema =
  createComponentStudentScreenInputSchema({ componentId: postgresUuidSchema });

export type SetComponentStudentScreenInput = z.infer<
  typeof setComponentStudentScreenInputSchema
>;

export const prepareCourseAttachmentInputSchema = z.object({
  originalFilename: z.string().trim().min(1).max(255),
  mimeType: courseAssetMimeTypeSchema,
  sizeBytes: z.number().int().min(1).max(COURSE_ASSET_MAX_BYTES),
  checksumSha256: z.string().regex(/^[a-f0-9]{64}$/i),
});

export type PrepareCourseAttachmentInput = z.infer<
  typeof prepareCourseAttachmentInputSchema
>;

export const uuidSchema = postgresUuidSchema;

export function parseContract<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (result.success) return result.data;

  const issue = result.error.issues[0];
  throw new CourseBuilderValidationError(
    issue?.message ?? "Проверьте заполненные данные.",
  );
}

export class CourseBuilderValidationError extends Error {
  readonly code = "validation_error";

  constructor(message: string) {
    super(message);
    this.name = "CourseBuilderValidationError";
  }
}

export class CourseBuilderAccessError extends Error {
  readonly code = "access_denied";

  constructor(message = "Курс не найден или недоступен.") {
    super(message);
    this.name = "CourseBuilderAccessError";
  }
}

export class CourseBuilderConflictError extends Error {
  readonly code: string;

  constructor(message: string, code = "conflict") {
    super(message);
    this.name = "CourseBuilderConflictError";
    this.code = code;
  }
}
