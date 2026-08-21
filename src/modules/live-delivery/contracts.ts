import { z } from "zod";
import { postgresUuidSchema } from "@/lib/postgres-uuid";
import { courseAssetMimeTypeSchema } from "@/modules/course-builder/contracts";
import { componentTypeKeySchema } from "@/modules/course-builder/registry/contracts";

export const LIVE_DELIVERY_LEARNER_LIMIT = 200;
export const LIVE_DELIVERY_SLIDE_LIMIT = 500;
export const LIVE_DELIVERY_COMPONENT_LIMIT = 500;
export const LIVE_DELIVERY_ASSET_LIMIT = 150;

export const liveDeliveryRevisionSchema = z
  .number()
  .int()
  .nonnegative()
  .max(Number.MAX_SAFE_INTEGER);
const positivePositionSchema = z.number().int().positive().max(100_000);
const jsonObjectSchema = z.record(z.string(), z.unknown());

export const setLiveAccessInputSchema = z
  .object({
    learnerProfileId: postgresUuidSchema,
    courseAccessEnabled: z.boolean(),
    runCapabilityEnabled: z.boolean(),
  })
  .strict()
  .superRefine((input, context) => {
    if (input.runCapabilityEnabled && !input.courseAccessEnabled) {
      context.addIssue({
        code: "custom",
        path: ["runCapabilityEnabled"],
        message: "Доступ к запуску нельзя включить без явного доступа к курсу.",
      });
    }
  });

export type SetLiveAccessInput = z.infer<typeof setLiveAccessInputSchema>;

export const setPresentationCursorInputSchema = z
  .object({
    slideId: postgresUuidSchema.nullable(),
    expectedRevision: liveDeliveryRevisionSchema,
  })
  .strict();

export type SetPresentationCursorInput = z.infer<
  typeof setPresentationCursorInputSchema
>;

export const presentationCursorSchema = z
  .object({
    slideId: postgresUuidSchema.nullable(),
    revision: liveDeliveryRevisionSchema,
  })
  .strict();

export type PresentationCursor = z.infer<typeof presentationCursorSchema>;

const teacherLiveSlideSchema = z
  .object({
    id: postgresUuidSchema,
    position: positivePositionSchema,
    componentCount: z
      .number()
      .int()
      .nonnegative()
      .max(LIVE_DELIVERY_COMPONENT_LIMIT),
  })
  .strict();

const teacherLiveLearnerSchema = z
  .object({
    learnerProfileId: postgresUuidSchema,
    displayName: z.string().trim().min(1).max(160),
    identityState: z.enum(["claimed", "offline"]),
    courseAccessEnabled: z.boolean(),
    runCapabilityEnabled: z.boolean(),
  })
  .strict()
  .superRefine((learner, context) => {
    if (learner.runCapabilityEnabled && !learner.courseAccessEnabled) {
      context.addIssue({
        code: "custom",
        path: ["runCapabilityEnabled"],
        message: "Run capability requires active Course access.",
      });
    }
    if (
      learner.identityState === "offline" &&
      (learner.courseAccessEnabled || learner.runCapabilityEnabled)
    ) {
      context.addIssue({
        code: "custom",
        path: ["identityState"],
        message: "An offline learner cannot hold live capabilities.",
      });
    }
  });

export const teacherLiveDeliverySchema = z
  .object({
    run: z
      .object({
        started: z.boolean(),
        ended: z.boolean(),
      })
      .strict(),
    cursor: presentationCursorSchema,
    slides: z.array(teacherLiveSlideSchema).max(LIVE_DELIVERY_SLIDE_LIMIT),
    learners: z
      .array(teacherLiveLearnerSchema)
      .max(LIVE_DELIVERY_LEARNER_LIMIT),
  })
  .strict()
  .superRefine((delivery, context) => {
    const slideIds = delivery.slides.map((slide) => slide.id);
    const slidePositions = delivery.slides.map((slide) => slide.position);
    if (new Set(slideIds).size !== slideIds.length) {
      context.addIssue({
        code: "custom",
        path: ["slides"],
        message: "Live slide identifiers must be unique.",
      });
    }
    if (new Set(slidePositions).size !== slidePositions.length) {
      context.addIssue({
        code: "custom",
        path: ["slides"],
        message: "Live slide positions must be unique.",
      });
    }
    if (
      delivery.slides.some(
        (slide, index) =>
          index > 0 && slide.position <= delivery.slides[index - 1]!.position,
      )
    ) {
      context.addIssue({
        code: "custom",
        path: ["slides"],
        message: "Live slides must follow canonical Lesson order.",
      });
    }
    if (
      delivery.cursor.slideId !== null &&
      !slideIds.includes(delivery.cursor.slideId)
    ) {
      context.addIssue({
        code: "custom",
        path: ["cursor", "slideId"],
        message: "The live cursor must reference a current non-empty slide.",
      });
    }
    const learnerIds = delivery.learners.map(
      (learner) => learner.learnerProfileId,
    );
    if (new Set(learnerIds).size !== learnerIds.length) {
      context.addIssue({
        code: "custom",
        path: ["learners"],
        message: "Live learner rows must be unique.",
      });
    }
  });

export type TeacherLiveDelivery = z.infer<typeof teacherLiveDeliverySchema>;

export const teacherLiveDeliveryResponseSchema = z
  .object({ delivery: teacherLiveDeliverySchema })
  .strict();

export const presentationCursorResponseSchema = z
  .object({ cursor: presentationCursorSchema })
  .strict();

export const learnerLiveComponentSchema = z
  .object({
    key: z.string().regex(/^component-[1-9]\d*$/),
    typeKey: componentTypeKeySchema,
    schemaVersion: z.number().int().positive().max(100_000),
    position: positivePositionSchema,
    payload: jsonObjectSchema,
    placement: jsonObjectSchema,
  })
  .strict();

export type LearnerLiveComponent = z.infer<typeof learnerLiveComponentSchema>;

export const learnerLiveAssetRefSchema = postgresUuidSchema.refine((value) => {
  const match = /^00000000-0000-4000-8000-(\d{12})$/.exec(value);
  if (!match) return false;
  const ordinal = Number(match[1]);
  return ordinal >= 1 && ordinal <= LIVE_DELIVERY_ASSET_LIMIT;
}, "Invalid live asset reference.");

const learnerLiveAssetUrlSchema = z
  .string()
  .max(320)
  .regex(
    /^\/api\/v2\/me\/live-runs\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/assets\/00000000-0000-4000-8000-\d{12}\?revision=(?:0|[1-9]\d*)$/i,
  );

export const learnerLiveAssetSchema = z
  .object({
    /** Synthetic per-response UUID, never a stored_file identifier. */
    ref: learnerLiveAssetRefSchema,
    mimeType: courseAssetMimeTypeSchema,
    /** Opaque same-origin proxy URL; Storage paths never cross this boundary. */
    url: learnerLiveAssetUrlSchema,
  })
  .strict();

export type LearnerLiveAsset = z.infer<typeof learnerLiveAssetSchema>;

const learnerWaitingStateSchema = z
  .object({
    kind: z.literal("waiting"),
    cursorRevision: liveDeliveryRevisionSchema,
  })
  .strict();

const learnerActiveStateSchema = z
  .object({
    kind: z.literal("active"),
    cursorRevision: liveDeliveryRevisionSchema,
    slide: z
      .object({
        position: positivePositionSchema,
        componentCount: z
          .number()
          .int()
          .positive()
          .max(LIVE_DELIVERY_COMPONENT_LIMIT),
        components: z
          .array(learnerLiveComponentSchema)
          .min(1)
          .max(LIVE_DELIVERY_COMPONENT_LIMIT),
      })
      .strict()
      .superRefine((slide, context) => {
        if (slide.componentCount !== slide.components.length) {
          context.addIssue({
            code: "custom",
            path: ["componentCount"],
            message: "The live component count must match its projection.",
          });
        }
        const positions = slide.components.map(
          (component) => component.position,
        );
        if (new Set(positions).size !== positions.length) {
          context.addIssue({
            code: "custom",
            path: ["components"],
            message: "Live component positions must be unique.",
          });
        }
        if (
          slide.components.some(
            (component, index) =>
              index > 0 &&
              component.position <= slide.components[index - 1]!.position,
          )
        ) {
          context.addIssue({
            code: "custom",
            path: ["components"],
            message: "Live components must follow canonical Lesson order.",
          });
        }
      }),
    assets: z.array(learnerLiveAssetSchema).max(LIVE_DELIVERY_ASSET_LIMIT),
  })
  .strict();

const learnerEndedStateSchema = z.object({ kind: z.literal("ended") }).strict();

export const learnerLiveStateSchema = z.discriminatedUnion("kind", [
  learnerWaitingStateSchema,
  learnerActiveStateSchema,
  learnerEndedStateSchema,
]);

export type LearnerLiveState = z.infer<typeof learnerLiveStateSchema>;

export const learnerLiveDeliveryResponseSchema = z
  .object({ state: learnerLiveStateSchema })
  .strict();

const sourceComponentSchema = z
  .object({
    typeKey: componentTypeKeySchema,
    schemaVersion: z.number().int().positive().max(100_000),
    position: positivePositionSchema,
    payload: z.unknown(),
    placement: z.unknown(),
  })
  .strict();

export const learnerLiveSourceAssetSchema = z
  .object({
    id: postgresUuidSchema,
    storageBucket: z.literal("course-assets"),
    storagePath: z
      .string()
      .trim()
      .min(1)
      .max(1_024)
      .refine(
        (path) =>
          !path.startsWith("/") &&
          path
            .split("/")
            .every(
              (segment) =>
                segment !== "" && segment !== "." && segment !== "..",
            ),
        "Invalid Storage object path.",
      ),
    originalFilename: z.string().trim().min(1).max(512),
    mimeType: courseAssetMimeTypeSchema,
    sizeBytes: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  })
  .strict();

export type LearnerLiveSourceAsset = z.infer<
  typeof learnerLiveSourceAssetSchema
>;

const learnerLiveSourceWaitingSchema = z
  .object({
    state: z.literal("waiting"),
    cursorRevision: liveDeliveryRevisionSchema,
  })
  .strict();

const learnerLiveSourceActiveSchema = z
  .object({
    state: z.literal("live"),
    cursorRevision: liveDeliveryRevisionSchema,
    slide: z
      .object({
        position: positivePositionSchema,
        components: z
          .array(sourceComponentSchema)
          .min(1)
          .max(LIVE_DELIVERY_COMPONENT_LIMIT),
      })
      .strict(),
    assets: z
      .array(learnerLiveSourceAssetSchema)
      .max(LIVE_DELIVERY_ASSET_LIMIT),
  })
  .strict()
  .superRefine((source, context) => {
    const positions = source.slide.components.map(
      (component) => component.position,
    );
    if (
      new Set(positions).size !== positions.length ||
      source.slide.components.some(
        (component, index) =>
          index > 0 &&
          component.position <= source.slide.components[index - 1]!.position,
      )
    ) {
      context.addIssue({
        code: "custom",
        path: ["slide", "components"],
        message: "Live source components are not in canonical Lesson order.",
      });
    }
    const assetIds = source.assets.map((asset) => asset.id);
    if (new Set(assetIds).size !== assetIds.length) {
      context.addIssue({
        code: "custom",
        path: ["assets"],
        message: "Live source assets must be unique.",
      });
    }
  });

const learnerLiveSourceEndedSchema = z
  .object({ state: z.literal("ended") })
  .strict();

/** Server-only RPC source. It is parsed before learner-safe projection. */
export const learnerLiveSourceSchema = z.discriminatedUnion("state", [
  learnerLiveSourceWaitingSchema,
  learnerLiveSourceActiveSchema,
  learnerLiveSourceEndedSchema,
]);

export type LearnerLiveSource = z.infer<typeof learnerLiveSourceSchema>;

export function parseLiveDeliveryInput<T>(
  schema: z.ZodType<T>,
  value: unknown,
): T {
  const parsed = schema.safeParse(value);
  if (parsed.success) return parsed.data;
  throw new LiveDeliveryValidationError(
    parsed.error.issues[0]?.message ?? "Проверьте данные live-показа.",
  );
}

export class LiveDeliveryValidationError extends Error {
  readonly name = "LiveDeliveryValidationError";
  readonly code = "live_delivery_validation_error";
}
