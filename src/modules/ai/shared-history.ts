import { z } from "zod";
import { getSupabasePublicConfig } from "@/lib/server/auth-config";
import type { SharedLearnerHistoryContext } from "./course-context";

const projectionSchema = z
  .object({
    used: z.boolean(),
    revision: z.string().regex(/^[a-f0-9]{64}$/),
    projectionVersion: z.literal(1),
    aggregates: z
      .object({
        conductedCount: z.number().int().min(0).max(10_000),
        presentCount: z.number().int().min(0).max(10_000),
        absentCount: z.number().int().min(0).max(10_000),
        repeatCount: z.number().int().min(0).max(10_000),
        knownDurationCount: z.number().int().min(0).max(10_000),
        actualDurationMinutes: z.number().int().min(0).max(10_000_000),
        lastActivityMonth: z
          .string()
          .regex(/^\d{4}-\d{2}$/)
          .nullable()
          .optional(),
        subjectBreakdown: z
          .array(
            z
              .object({
                subjectBucket: z.string().trim().min(1).max(80),
                count: z.number().int().min(0).max(10_000),
              })
              .strict(),
          )
          .max(20),
      })
      .strict(),
    sharedCommentSummaries: z.array(z.string().trim().min(1).max(240)).max(20),
  })
  .strict();

type RpcResponse = SharedLearnerHistoryContext | SharedLearnerHistoryContext[];

export const sharedHistoryProvider = {
  async load(
    actorAuthUserId: string,
    courseId: string,
  ): Promise<SharedLearnerHistoryContext> {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey)
      throw new Error("Supabase service role is not configured.");
    const { url } = getSupabasePublicConfig();
    const response = await fetch(
      `${url}/rest/v1/rpc/build_cross_provider_learner_context`,
      {
        method: "POST",
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          p_actor_auth_user_id: actorAuthUserId,
          p_course_id: courseId,
        }),
        cache: "no-store",
      },
    );
    if (!response.ok) {
      throw new Error("Не удалось проверить разрешение на общую историю.");
    }
    const raw = (await response.json()) as RpcResponse;
    return projectionSchema.parse(Array.isArray(raw) ? raw[0] : raw);
  },
};
