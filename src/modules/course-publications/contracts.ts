import { z } from "zod";
import { postgresUuidSchema } from "@/lib/postgres-uuid";
import { componentVisibilitySchema } from "@/modules/course-builder/component-visibility";
import {
  activityRoleSchema,
  componentTypeKeySchema,
} from "@/modules/course-builder/registry/contracts";
import {
  courseLearningAudienceSchema,
  DEFAULT_COURSE_LEARNING_AUDIENCE,
} from "@/modules/course-builder/learning-audience";

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
    learningAudience: courseLearningAudienceSchema.default(
      DEFAULT_COURSE_LEARNING_AUDIENCE,
    ),
    subject: z.string().trim().max(160).default(""),
    level: z.string().trim().max(240).default(""),
    cursor: z.string().trim().min(1).max(2_048).nullable().default(null),
    limit: z.coerce.number().int().min(1).max(50).default(24),
  })
  .strict();

const snapshotMaterialSchema = z
  .object({
    ref: postgresUuidSchema,
    originalFilename: z.string().trim().min(1).max(255),
    mimeType: z.string().trim().min(1).max(255),
    sizeBytes: z.number().int().positive(),
    checksumSha256: z.string().regex(/^[a-f0-9]{64}$/i),
  })
  .strict();

const snapshotSlideSchema = z
  .object({
    ref: postgresUuidSchema,
    position: z.number().int().positive(),
  })
  .strict();

const snapshotComponentV1Schema = z
  .object({
    ref: postgresUuidSchema,
    position: z.number().int().positive(),
    typeKey: componentTypeKeySchema,
    schemaVersion: z.number().int().positive(),
    payload: z.record(z.string(), z.unknown()),
    placement: z.record(z.string(), z.unknown()),
    visibility: componentVisibilitySchema,
    studentSlideRef: postgresUuidSchema.nullable(),
  })
  .strict();

const snapshotComponentV2Schema = snapshotComponentV1Schema
  .extend({
    primaryObjectiveRef: postgresUuidSchema.nullable(),
    activityRole: activityRoleSchema.nullable(),
  })
  .strict();

const snapshotLessonV1Schema = z
  .object({
    ref: postgresUuidSchema,
    position: z.number().int().positive(),
    title: z.string().trim().min(1).max(180),
    summary: z.string().max(1_200),
    estimatedDurationMinutes: z.number().int().positive().nullable(),
    components: z.array(snapshotComponentV1Schema),
    slides: z.array(snapshotSlideSchema),
  })
  .strict();

const snapshotLessonV2Schema = snapshotLessonV1Schema
  .omit({ components: true })
  .extend({ components: z.array(snapshotComponentV2Schema) })
  .strict();

const snapshotObjectiveSchema = z
  .object({
    ref: postgresUuidSchema,
    position: z.number().int().positive(),
    title: z.string().trim().min(2).max(240),
    description: z.string().trim().min(1).max(2_000).nullable(),
    archivedAt: z.iso.datetime({ offset: true }).nullable(),
  })
  .strict();

const snapshotCourseSchema = z
  .object({
    title: z.string().trim().min(2).max(160),
    subject: z.string().trim().max(160),
    goal: z.string().trim().max(1_200),
    level: z.string().trim().max(240),
    audienceDescription: z.string().trim().max(1_200),
    targetLessonCount: z.number().int().positive(),
  })
  .strict();

export const coursePublicationSnapshotV1Schema = z
  .object({
    schemaVersion: z.literal(1),
    course: snapshotCourseSchema,
    lessons: z.array(snapshotLessonV1Schema),
    materials: z.array(snapshotMaterialSchema),
  })
  .strict();

export const coursePublicationSnapshotV2Schema = z
  .object({
    schemaVersion: z.literal(2),
    course: snapshotCourseSchema,
    objectives: z.array(snapshotObjectiveSchema),
    lessons: z.array(snapshotLessonV2Schema),
    materials: z.array(snapshotMaterialSchema),
  })
  .strict()
  .superRefine((snapshot, context) => {
    const objectiveRefs = new Set<string>();
    const objectivePositions = new Set<number>();
    for (const [index, objective] of snapshot.objectives.entries()) {
      if (objectiveRefs.has(objective.ref)) {
        context.addIssue({
          code: "custom",
          path: ["objectives", index, "ref"],
          message: "Ссылки целей публикации не должны повторяться.",
        });
      }
      objectiveRefs.add(objective.ref);
      if (objectivePositions.has(objective.position)) {
        context.addIssue({
          code: "custom",
          path: ["objectives", index, "position"],
          message: "Позиции целей публикации не должны повторяться.",
        });
      }
      objectivePositions.add(objective.position);
    }
    if (
      snapshot.objectives.some(
        (objective) => objective.position > snapshot.objectives.length,
      )
    ) {
      context.addIssue({
        code: "custom",
        path: ["objectives"],
        message:
          "Позиции целей публикации должны образовывать плотный порядок.",
      });
    }

    for (const [lessonIndex, lesson] of snapshot.lessons.entries()) {
      for (const [componentIndex, component] of lesson.components.entries()) {
        if (
          component.primaryObjectiveRef !== null &&
          !objectiveRefs.has(component.primaryObjectiveRef)
        ) {
          context.addIssue({
            code: "custom",
            path: [
              "lessons",
              lessonIndex,
              "components",
              componentIndex,
              "primaryObjectiveRef",
            ],
            message: "Компонент ссылается на неизвестную цель публикации.",
          });
        }
      }
    }
  });

export const coursePublicationSnapshotSchema = z.discriminatedUnion(
  "schemaVersion",
  [coursePublicationSnapshotV1Schema, coursePublicationSnapshotV2Schema],
);

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
