import { z } from "zod";
import { getSupabasePublicConfig } from "@/lib/server/auth-config";

const MAX_AI_ACTIVITY_STATES = 80;
const MAX_AI_ACTIVITY_EVIDENCE_REFERENCES = 3;
const stateOpaqueKeySchema = z.string().regex(/^las_[a-f0-9]{64}$/);
const evidenceOpaqueKeySchema = z.string().regex(/^lae_[a-f0-9]{64}$/);

const timestampSchema = z.iso.datetime({ offset: true });

const evidenceReferenceSchema = z
  .object({
    key: evidenceOpaqueKeySchema,
    direction: z.enum(["positive", "negative"]),
    support: z.enum(["independent", "with_support"]).nullable(),
    observedAt: timestampSchema,
    evidenceAt: timestampSchema,
    courseTitle: z.string().trim().min(1).max(240),
    lessonTitle: z.string().trim().min(1).max(240),
    componentLabel: z.string().trim().min(1).max(500),
    objectiveTitle: z.string().trim().min(1).max(240),
    criterion: z.string().trim().min(1).max(500),
  })
  .strict();

const recommendationSchema = z
  .object({
    type: z.enum([
      "repeat",
      "try_without_support",
      "apply_in_new_context",
      "move_forward",
      "recheck_freshness",
    ]),
    reasonCode: z.enum([
      "repeat_after_not_yet",
      "try_without_support_after_supported_success",
      "apply_in_new_context_after_one_independent_opportunity",
      "move_forward_after_confirmation",
      "recheck_due_to_freshness",
    ]),
    reasonText: z.string().trim().min(1).max(1_000),
    source: z.enum(["rule", "teacher_override"]),
    generatedAt: timestampSchema,
    evidenceReferenceKeys: z
      .array(evidenceOpaqueKeySchema)
      .max(MAX_AI_ACTIVITY_EVIDENCE_REFERENCES),
  })
  .strict();

const activityStateSchema = z
  .object({
    key: stateOpaqueKeySchema,
    courseTitle: z.string().trim().min(1).max(240),
    subject: z.string().trim().min(1).max(240).nullable(),
    objectiveTitle: z.string().trim().min(1).max(240),
    state: z.enum(["no_data", "forming", "confirmed", "recheck_due"]),
    reasonCode: z.enum([
      "no_eligible_evidence",
      "latest_not_yet",
      "latest_with_support",
      "independent_opportunities_missing",
      "multiple_independent_opportunities",
      "confirmed_evidence_stale",
    ]),
    reasonText: z.string().trim().min(1).max(1_000),
    evaluatedAt: timestampSchema,
    lastEvidenceAt: timestampSchema.nullable(),
    freshnessDueAt: timestampSchema.nullable(),
    evidenceReferences: z
      .array(evidenceReferenceSchema)
      .max(MAX_AI_ACTIVITY_EVIDENCE_REFERENCES),
    recommendation: recommendationSchema.nullable(),
  })
  .strict()
  .superRefine((state, context) => {
    const evidenceKeys = new Set(
      state.evidenceReferences.map((reference) => reference.key),
    );
    for (const key of state.recommendation?.evidenceReferenceKeys ?? []) {
      if (!evidenceKeys.has(key)) {
        context.addIssue({
          code: "custom",
          path: ["recommendation", "evidenceReferenceKeys"],
          message: "Recommendation references must be included in evidence.",
        });
      }
    }
    if (
      state.state === "no_data" &&
      (state.lastEvidenceAt !== null ||
        state.freshnessDueAt !== null ||
        state.evidenceReferences.length > 0 ||
        state.recommendation !== null)
    ) {
      context.addIssue({
        code: "custom",
        message:
          "A no-data AI state cannot contain evidence or a recommendation.",
      });
    }
  });

const summarySchema = z
  .object({
    totalStateCount: z.number().int().min(0).max(1_000_000),
    includedStateCount: z.number().int().min(0).max(MAX_AI_ACTIVITY_STATES),
    formingCount: z.number().int().min(0).max(1_000_000),
    confirmedCount: z.number().int().min(0).max(1_000_000),
    recheckDueCount: z.number().int().min(0).max(1_000_000),
    evidenceReferenceCount: z
      .number()
      .int()
      .min(0)
      .max(MAX_AI_ACTIVITY_STATES * MAX_AI_ACTIVITY_EVIDENCE_REFERENCES),
    truncated: z.boolean(),
  })
  .strict();

export const learningActivityAiContextSchema = z
  .object({
    used: z.boolean(),
    revision: z.string().regex(/^[a-f0-9]{64}$/),
    projectionVersion: z.literal(1),
    summary: summarySchema,
    states: z.array(activityStateSchema).max(MAX_AI_ACTIVITY_STATES),
  })
  .strict()
  .superRefine((projection, context) => {
    if (projection.summary.includedStateCount !== projection.states.length) {
      context.addIssue({
        code: "custom",
        path: ["summary", "includedStateCount"],
        message: "Included state count must match the bounded state list.",
      });
    }
    const evidenceReferenceCount = projection.states.reduce(
      (total, state) => total + state.evidenceReferences.length,
      0,
    );
    if (projection.summary.evidenceReferenceCount !== evidenceReferenceCount) {
      context.addIssue({
        code: "custom",
        path: ["summary", "evidenceReferenceCount"],
        message: "Evidence reference count must match the bounded state list.",
      });
    }
    if (
      projection.summary.truncated !==
      projection.summary.totalStateCount > projection.summary.includedStateCount
    ) {
      context.addIssue({
        code: "custom",
        path: ["summary", "truncated"],
        message: "Truncation must reflect the bounded state count.",
      });
    }
    if (!projection.used && projection.states.length > 0) {
      context.addIssue({
        code: "custom",
        path: ["used"],
        message: "An unused projection cannot expose activity states.",
      });
    }
  });

export type LearningActivityAiContext = z.infer<
  typeof learningActivityAiContextSchema
>;

export const EMPTY_LEARNING_ACTIVITY_AI_CONTEXT: LearningActivityAiContext = {
  used: false,
  revision: "0".repeat(64),
  projectionVersion: 1,
  summary: {
    totalStateCount: 0,
    includedStateCount: 0,
    formingCount: 0,
    confirmedCount: 0,
    recheckDueCount: 0,
    evidenceReferenceCount: 0,
    truncated: false,
  },
  states: [],
};

type RpcResponse = LearningActivityAiContext | LearningActivityAiContext[];

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function camelKey(key: string) {
  return key.replace(/_([a-z0-9])/g, (_, character: string) =>
    character.toUpperCase(),
  );
}

function camelizeRpcPayload(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(camelizeRpcPayload);
  if (!isObject(value)) return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, nested]) => [
      camelKey(key),
      camelizeRpcPayload(nested),
    ]),
  );
}

function unwrapRpcProjection(value: unknown) {
  const camel = camelizeRpcPayload(value);
  if (Array.isArray(camel) && camel.length === 1 && isObject(camel[0])) {
    return "result" in camel[0] ? camel[0].result : camel[0];
  }
  if (isObject(camel) && "result" in camel) return camel.result;
  return camel;
}

export const learningActivityContextProvider = {
  async load(
    actorAuthUserId: string,
    actorSupabaseSessionId: string,
    courseId: string,
  ): Promise<LearningActivityAiContext> {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      throw new Error("Supabase service role is not configured.");
    }
    const { url } = getSupabasePublicConfig();
    const response = await fetch(
      `${url}/rest/v1/rpc/build_course_learning_activity_context`,
      {
        method: "POST",
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          p_actor_auth_user_id: actorAuthUserId,
          p_actor_session_id: actorSupabaseSessionId,
          p_course_id: courseId,
        }),
        cache: "no-store",
      },
    );
    if (!response.ok) {
      throw new Error("Не удалось загрузить безопасный учебный контекст.");
    }
    const raw = (await response.json()) as RpcResponse;
    return learningActivityAiContextSchema.parse(unwrapRpcProjection(raw));
  },
};
