import { z } from "zod";
import { componentVisibilitySchema } from "@/modules/course-builder/component-visibility";
import { componentTypeKeySchema } from "@/modules/course-builder/registry/contracts";

export const COURSE_PUBLICATION_ASSET_BUCKET = "course-publication-assets";
export const COURSE_ASSET_BUCKET = "course-assets";

export const rightsConfirmationInputSchema = z
  .object({ rightsConfirmed: z.literal(true) })
  .strict();

export const copyCourseInputSchema = z
  .object({ title: z.string().trim().min(2).max(160).optional() })
  .strict();

export const catalogQuerySchema = z
  .object({
    q: z.string().trim().max(160).default(""),
    subject: z.string().trim().max(160).default(""),
    level: z.string().trim().max(240).default(""),
    cursor: z.string().trim().min(1).max(2_048).nullable().default(null),
    limit: z.coerce.number().int().min(1).max(50).default(24),
  })
  .strict();

const snapshotMaterialSchema = z
  .object({
    ref: z.uuid(),
    originalFilename: z.string().trim().min(1).max(255),
    mimeType: z.string().trim().min(1).max(255),
    sizeBytes: z.number().int().positive(),
    checksumSha256: z.string().regex(/^[a-f0-9]{64}$/i),
  })
  .strict();

const snapshotSlideSchema = z
  .object({
    ref: z.uuid(),
    position: z.number().int().positive(),
  })
  .strict();

const snapshotComponentSchema = z
  .object({
    ref: z.uuid(),
    position: z.number().int().positive(),
    typeKey: componentTypeKeySchema,
    schemaVersion: z.number().int().positive(),
    payload: z.record(z.string(), z.unknown()),
    placement: z.record(z.string(), z.unknown()),
    visibility: componentVisibilitySchema,
    studentSlideRef: z.uuid().nullable(),
  })
  .strict();

const snapshotLessonSchema = z
  .object({
    ref: z.uuid(),
    position: z.number().int().positive(),
    title: z.string().trim().min(1).max(180),
    summary: z.string().max(1_200),
    estimatedDurationMinutes: z.number().int().positive().nullable(),
    components: z.array(snapshotComponentSchema),
    slides: z.array(snapshotSlideSchema),
  })
  .strict();

export const coursePublicationSnapshotSchema = z
  .object({
    schemaVersion: z.literal(1),
    course: z
      .object({
        title: z.string().trim().min(2).max(160),
        subject: z.string().trim().max(160),
        goal: z.string().trim().max(1_200),
        level: z.string().trim().max(240),
        audienceDescription: z.string().trim().max(1_200),
        targetLessonCount: z.number().int().positive(),
      })
      .strict(),
    lessons: z.array(snapshotLessonSchema),
    materials: z.array(snapshotMaterialSchema),
  })
  .strict();

export type RightsConfirmationInput = z.infer<
  typeof rightsConfirmationInputSchema
>;
export type CopyCourseInput = z.infer<typeof copyCourseInputSchema>;
export type CatalogQuery = z.infer<typeof catalogQuerySchema>;

export class CoursePublicationValidationError extends Error {
  readonly code = "validation_error";

  constructor(message: string) {
    super(message);
    this.name = "CoursePublicationValidationError";
  }
}

export class CoursePublicationAccessError extends Error {
  readonly code = "access_denied";

  constructor(message = "Публикация курса не найдена или недоступна.") {
    super(message);
    this.name = "CoursePublicationAccessError";
  }
}

export class CoursePublicationConflictError extends Error {
  constructor(
    message: string,
    readonly code = "conflict",
  ) {
    super(message);
    this.name = "CoursePublicationConflictError";
  }
}

export function parsePublicationContract<T>(
  schema: z.ZodType<T>,
  value: unknown,
): T {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  throw new CoursePublicationValidationError(
    result.error.issues[0]?.message ?? "Проверьте переданные данные.",
  );
}
