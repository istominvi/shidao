import { z } from "zod";
import {
  calloutPayloadSchema,
  getComponentDefinition,
  lessonAddComponentInputSchema,
  matchingGamePayloadSchema,
  richTextPayloadSchema,
  singleChoicePollPayloadSchema,
  type LessonAddComponentInput,
} from "@/modules/course-builder/registry/contracts";

const optionalInstructionSchema = z.string().trim().max(2_000).default("");
const contextFingerprintSchema = z.string().regex(/^[a-f0-9]{64}$/);

export const aiCoursePlanRequestSchema = z
  .object({ instruction: optionalInstructionSchema })
  .strict();

export const aiCourseOutlineLessonSchema = z
  .object({
    title: z.string().trim().min(1).max(180),
    summary: z.string().trim().min(1).max(1_200),
  })
  .strict();

export const aiCourseOutlinePlanSchema = z
  .object({
    lessons: z.array(aiCourseOutlineLessonSchema).min(1).max(60),
  })
  .strict();

export function createAiCourseOutlinePlanSchema(lessonCount: number) {
  return z
    .object({
      lessons: z.array(aiCourseOutlineLessonSchema).length(lessonCount),
    })
    .strict();
}

export const aiCoursePlanApplyRequestSchema = z
  .object({
    baseContextFingerprint: contextFingerprintSchema,
    plan: aiCourseOutlinePlanSchema,
  })
  .strict();

const richTextPlanSchema = z
  .object({
    typeKey: z.literal("rich_text"),
    payload: richTextPayloadSchema,
  })
  .strict();

const calloutPlanSchema = z
  .object({
    typeKey: z.literal("callout"),
    payload: calloutPayloadSchema,
  })
  .strict();

const singleChoicePollPlanSchema = z
  .object({
    typeKey: z.literal("single_choice_poll"),
    payload: singleChoicePollPayloadSchema,
  })
  .strict();

const matchingGamePlanSchema = z
  .object({
    typeKey: z.literal("matching_game"),
    payload: matchingGamePayloadSchema,
  })
  .strict();

export const aiLessonComponentPlanSchema = z.discriminatedUnion("typeKey", [
  richTextPlanSchema,
  calloutPlanSchema,
  singleChoicePollPlanSchema,
  matchingGamePlanSchema,
]);

export const aiLessonPlanSchema = z
  .object({
    summary: z.string().trim().min(1).max(1_200),
    components: z.array(aiLessonComponentPlanSchema).min(3).max(20),
  })
  .strict();

export const aiLessonPlanRequestSchema = z
  .object({
    lessonId: z.uuid().nullable(),
    title: z.string().trim().min(1).max(180),
    instruction: optionalInstructionSchema,
  })
  .strict();

export const aiLessonPlanApplyRequestSchema = z
  .object({
    lessonId: z.uuid().nullable(),
    title: z.string().trim().min(1).max(180),
    baseContextFingerprint: contextFingerprintSchema,
    sharedHistoryRevision: contextFingerprintSchema.default("0".repeat(64)),
    baseLessonIds: z.array(z.uuid()).max(60),
    baseComponentIds: z.array(z.uuid()).max(200),
    plan: aiLessonPlanSchema,
  })
  .strict()
  .superRefine((input, context) => {
    if (input.lessonId === null && input.baseComponentIds.length > 0) {
      context.addIssue({
        code: "custom",
        path: ["baseComponentIds"],
        message: "Новый урок не может иметь исходные компоненты.",
      });
    }
  });

export const aiAssistantMessageSchema = z
  .object({
    role: z.enum(["user", "assistant"]),
    content: z.string().trim().min(1).max(6_000),
  })
  .strict();

export const aiAssistantRequestSchema = z
  .object({
    lessonId: z.uuid().nullable(),
    messages: z.array(aiAssistantMessageSchema).min(1).max(16),
  })
  .strict()
  .superRefine((input, context) => {
    const totalCharacters = input.messages.reduce(
      (total, message) => total + message.content.length,
      0,
    );
    if (totalCharacters > 24_000) {
      context.addIssue({
        code: "custom",
        path: ["messages"],
        message: "История диалога слишком длинная. Начните новый диалог.",
      });
    }
    if (input.messages.at(-1)?.role !== "user") {
      context.addIssue({
        code: "custom",
        path: ["messages"],
        message: "Последнее сообщение должно быть от пользователя.",
      });
    }
  });

export type AiCourseOutlinePlan = z.infer<typeof aiCourseOutlinePlanSchema>;
export type AiLessonPlan = z.infer<typeof aiLessonPlanSchema>;
export type AiLessonComponentPlan = z.infer<typeof aiLessonComponentPlanSchema>;
export type AiAssistantMessage = z.infer<typeof aiAssistantMessageSchema>;

export type AiProviderUsage = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cachedInputTokens: number;
  reasoningTokens: number;
};

export type AiProviderMetadata = {
  requestId: string;
  model: string;
  provider: string | null;
  usage: AiProviderUsage;
};

export type AiCoursePlanPreview = AiProviderMetadata & {
  baseContextFingerprint: string;
  plan: AiCourseOutlinePlan;
};

export type AiLessonPlanPreview = AiProviderMetadata & {
  lessonId: string | null;
  title: string;
  baseContextFingerprint: string;
  sharedHistoryUsed: boolean;
  sharedHistoryRevision: string;
  baseLessonIds: string[];
  baseComponentIds: string[];
  plan: AiLessonPlan;
};

export type AiAssistantReply = AiProviderMetadata & {
  message: AiAssistantMessage & { role: "assistant" };
  sharedHistoryUsed: boolean;
};

export function toLessonAddComponentInput(
  lessonId: string,
  component: AiLessonComponentPlan,
): LessonAddComponentInput {
  const definition = getComponentDefinition(component.typeKey);

  return lessonAddComponentInputSchema.parse({
    lessonId,
    typeKey: component.typeKey,
    payload: component.payload,
    placement: structuredClone(definition.defaultPlacement),
  });
}
