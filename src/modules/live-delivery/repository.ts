import "server-only";

import type { ZodType } from "zod";
import { getSupabasePublicConfig } from "@/lib/server/auth-config";
import {
  learnerLiveSourceSchema,
  presentationCursorSchema,
  teacherLiveDeliverySchema,
  type LearnerLiveSourceAsset,
  type SetLiveAccessInput,
  type SetPresentationCursorInput,
} from "./contracts";
import type {
  LearnerLiveActor,
  LearnerLiveSource,
  PresentationCursor,
  TeacherLiveDelivery,
} from "./domain";
import { LiveDeliveryRepositoryError } from "./errors";

export const LIVE_DELIVERY_RPC = {
  getTeacherDelivery: "get_lesson_run_live_delivery_admin",
  setAccess: "set_lesson_run_live_access",
  setCursor: "set_lesson_run_presentation_cursor",
  resolveLearnerSource: "resolve_lesson_run_live_source_admin",
} as const;

type RepositoryOptions = { fetcher?: typeof fetch };

export interface TeacherLiveDeliveryRepository {
  getDelivery(lessonRunId: string): Promise<TeacherLiveDelivery>;
  setAccess(
    lessonRunId: string,
    input: SetLiveAccessInput,
  ): Promise<TeacherLiveDelivery>;
  setCursor(
    lessonRunId: string,
    input: SetPresentationCursorInput,
  ): Promise<PresentationCursor>;
}

export interface LearnerLiveDeliveryRepository {
  resolveSource(
    actor: LearnerLiveActor,
    lessonRunId: string,
  ): Promise<LearnerLiveSource>;
  fetchAsset(
    asset: LearnerLiveSourceAsset,
    input: { range: string | null; signal?: AbortSignal },
  ): Promise<LearnerLiveAssetBytes>;
}

export type LearnerLiveAssetBytes = {
  body: ReadableStream<Uint8Array>;
  status: 200 | 206;
  contentLength: number;
  contentRange: string | null;
};

type PostgrestErrorPayload = {
  code?: unknown;
  message?: unknown;
  error?: unknown;
};

function errorToken(payload: PostgrestErrorPayload | null) {
  if (typeof payload?.message === "string") return payload.message;
  if (typeof payload?.error === "string") return payload.error;
  return "live_delivery_rpc_failed";
}

function repositoryFailure(status: number, payload: unknown) {
  const details =
    payload && typeof payload === "object"
      ? (payload as PostgrestErrorPayload)
      : null;
  const token = errorToken(details).toLowerCase();
  const databaseCode = typeof details?.code === "string" ? details.code : null;

  if (status === 408 || status === 425 || status === 429) {
    return new LiveDeliveryRepositoryError(
      "Live delivery repository is temporarily unavailable.",
      503,
      "live_delivery_repository_error",
    );
  }

  if (token.includes("live_delivery_session_revoked")) {
    return new LiveDeliveryRepositoryError(
      "Live session is no longer valid.",
      401,
      "live_delivery_session_revoked",
    );
  }
  if (
    token.includes("lesson_run_live_not_found") ||
    /not_found|access_denied|owner_mismatch/.test(token) ||
    databaseCode === "P0002"
  ) {
    return new LiveDeliveryRepositoryError(
      "Live lesson is unavailable.",
      404,
      "live_delivery_not_found",
    );
  }
  if (
    token.includes("live_delivery_cursor_stale") ||
    token.includes("presentation_cursor_stale") ||
    /stale.*(?:cursor|revision)|(?:cursor|revision).*stale/.test(token) ||
    databaseCode === "40001"
  ) {
    return new LiveDeliveryRepositoryError(
      "Live cursor revision is stale.",
      409,
      "live_delivery_cursor_conflict",
    );
  }
  if (
    /invalid|requires|forbidden_state|not_started|already_ended|not_open|not_eligible/.test(
      token,
    ) ||
    databaseCode === "22023"
  ) {
    return new LiveDeliveryRepositoryError(
      "Live delivery input was rejected.",
      400,
      "live_delivery_validation_error",
    );
  }
  if (status === 401) {
    return new LiveDeliveryRepositoryError(
      "Live session requires reauthentication.",
      401,
      "live_delivery_reauthentication_required",
    );
  }
  if (status === 403) {
    return new LiveDeliveryRepositoryError(
      "Live lesson is unavailable.",
      404,
      "live_delivery_not_found",
    );
  }
  return new LiveDeliveryRepositoryError(
    "Live delivery repository is unavailable.",
    status >= 500 ? 503 : 400,
    "live_delivery_repository_error",
  );
}

function unwrapRpcPayload(payload: unknown) {
  if (Array.isArray(payload)) {
    if (payload.length !== 1) return payload;
    const first = payload[0];
    if (
      first &&
      typeof first === "object" &&
      !Array.isArray(first) &&
      "result" in first
    ) {
      return (first as { result: unknown }).result;
    }
    return first;
  }
  if (
    payload &&
    typeof payload === "object" &&
    !Array.isArray(payload) &&
    "result" in payload
  ) {
    return (payload as { result: unknown }).result;
  }
  return payload;
}

function parseRpcResult<T>(
  functionName: string,
  schema: ZodType<T>,
  payload: unknown,
) {
  const parsed = schema.safeParse(unwrapRpcPayload(payload));
  if (parsed.success) return parsed.data;
  throw new LiveDeliveryRepositoryError(
    `${functionName} returned an invalid projection.`,
    502,
    "live_delivery_response_invalid",
  );
}

async function postRpc(input: {
  functionName: string;
  args: Record<string, unknown>;
  bearer: string;
  apiKey: string;
  fetcher: typeof fetch;
}) {
  const { url } = getSupabasePublicConfig();
  let response: Response;
  try {
    response = await input.fetcher(
      `${url.replace(/\/+$/, "")}/rest/v1/rpc/${input.functionName}`,
      {
        method: "POST",
        headers: {
          apikey: input.apiKey,
          Authorization: `Bearer ${input.bearer}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(input.args),
        cache: "no-store",
      },
    );
  } catch {
    throw new LiveDeliveryRepositoryError(
      "Could not reach live delivery storage.",
      503,
      "live_delivery_network_error",
    );
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok) throw repositoryFailure(response.status, payload);
  if (payload === null) {
    throw new LiveDeliveryRepositoryError(
      `${input.functionName} returned an empty projection.`,
      502,
      "live_delivery_response_invalid",
    );
  }
  return payload;
}

export function createTeacherLiveDeliveryRepository(
  accessToken: string,
  options: RepositoryOptions = {},
): TeacherLiveDeliveryRepository {
  const { anonKey } = getSupabasePublicConfig();
  const fetcher = options.fetcher ?? fetch;

  async function rpc<T>(
    functionName: string,
    args: Record<string, unknown>,
    schema: ZodType<T>,
  ) {
    return parseRpcResult(
      functionName,
      schema,
      await postRpc({
        functionName,
        args,
        bearer: accessToken,
        apiKey: anonKey,
        fetcher,
      }),
    );
  }

  return {
    getDelivery(lessonRunId) {
      return rpc(
        LIVE_DELIVERY_RPC.getTeacherDelivery,
        { p_lesson_run_id: lessonRunId },
        teacherLiveDeliverySchema,
      );
    },

    setAccess(lessonRunId, input) {
      return rpc(
        LIVE_DELIVERY_RPC.setAccess,
        {
          p_lesson_run_id: lessonRunId,
          p_learner_profile_id: input.learnerProfileId,
          p_course_access_enabled: input.courseAccessEnabled,
          p_run_capability_enabled: input.runCapabilityEnabled,
        },
        teacherLiveDeliverySchema,
      );
    },

    setCursor(lessonRunId, input) {
      return rpc(
        LIVE_DELIVERY_RPC.setCursor,
        {
          p_lesson_run_id: lessonRunId,
          p_student_slide_id: input.slideId,
          p_expected_revision: input.expectedRevision,
        },
        presentationCursorSchema,
      );
    },
  };
}

function requireServiceRoleKey() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error("Supabase service-role auth is not configured.");
  }
  return key;
}

function encodedStorageObjectPath(bucket: string, path: string) {
  return [bucket, ...path.split("/")]
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

const LIVE_ASSET_UPSTREAM_TIMEOUT_MS = 30_000;

function boundedAssetFetchSignal(parent: AbortSignal | undefined) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (parent?.aborted) abort();
  else parent?.addEventListener("abort", abort, { once: true });
  const timeout = setTimeout(abort, LIVE_ASSET_UPSTREAM_TIMEOUT_MS);

  return {
    signal: controller.signal,
    cleanup() {
      clearTimeout(timeout);
      parent?.removeEventListener("abort", abort);
    },
  };
}

function expectedAssetRange(input: {
  range: string | null;
  sizeBytes: number;
}) {
  if (!input.range) {
    return {
      status: 200 as const,
      contentLength: input.sizeBytes,
      contentRange: null,
    };
  }
  const match = /^bytes=(\d+)-(\d+)$/.exec(input.range);
  if (!match) {
    throw new LiveDeliveryRepositoryError(
      "Live asset range was not normalized.",
      503,
      "live_delivery_asset_unavailable",
    );
  }
  const start = Number(match[1]);
  const end = Number(match[2]);
  return {
    status: 206 as const,
    contentLength: end - start + 1,
    contentRange: `bytes ${start}-${end}/${input.sizeBytes}`,
  };
}

function managedAssetBody(
  body: ReadableStream<Uint8Array>,
  cleanup: () => void,
) {
  const reader = body.getReader();
  let closed = false;
  const finish = () => {
    if (closed) return;
    closed = true;
    cleanup();
  };

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const result = await reader.read();
        if (result.done) {
          finish();
          controller.close();
          return;
        }
        controller.enqueue(result.value);
      } catch (error) {
        finish();
        controller.error(error);
      }
    },
    async cancel(reason) {
      finish();
      await reader.cancel(reason).catch(() => undefined);
    },
  });
}

export function createLearnerLiveDeliveryRepository(
  options: RepositoryOptions = {},
): LearnerLiveDeliveryRepository {
  const fetcher = options.fetcher ?? fetch;

  function config() {
    const { url } = getSupabasePublicConfig();
    return {
      url: url.replace(/\/+$/, ""),
      serviceRoleKey: requireServiceRoleKey(),
    };
  }

  return {
    async resolveSource(actor, lessonRunId) {
      const { serviceRoleKey } = config();
      return parseRpcResult(
        LIVE_DELIVERY_RPC.resolveLearnerSource,
        learnerLiveSourceSchema,
        await postRpc({
          functionName: LIVE_DELIVERY_RPC.resolveLearnerSource,
          args: {
            p_auth_user_id: actor.authUserId,
            p_session_id: actor.supabaseSessionId,
            p_lesson_run_id: lessonRunId,
          },
          bearer: serviceRoleKey,
          apiKey: serviceRoleKey,
          fetcher,
        }),
      );
    },

    async fetchAsset(asset, input) {
      const { url, serviceRoleKey } = config();
      const objectPath = encodedStorageObjectPath(
        asset.storageBucket,
        asset.storagePath,
      );
      const expected = expectedAssetRange({
        range: input.range,
        sizeBytes: asset.sizeBytes,
      });
      const boundedSignal = boundedAssetFetchSignal(input.signal);
      let response: Response;
      try {
        response = await fetcher(
          `${url}/storage/v1/object/authenticated/${objectPath}`,
          {
            method: "GET",
            headers: {
              apikey: serviceRoleKey,
              Authorization: `Bearer ${serviceRoleKey}`,
              ...(input.range ? { Range: input.range } : {}),
            },
            cache: "no-store",
            redirect: "error",
            signal: boundedSignal.signal,
          },
        );
      } catch {
        boundedSignal.cleanup();
        throw new LiveDeliveryRepositoryError(
          "Could not read a live delivery asset.",
          503,
          "live_delivery_asset_unavailable",
        );
      }

      if (response.status === 404) {
        boundedSignal.cleanup();
        void response.body?.cancel();
        throw new LiveDeliveryRepositoryError(
          "Live delivery asset is unavailable.",
          404,
          "live_delivery_not_found",
        );
      }
      if (
        response.status !== expected.status ||
        !response.body ||
        (expected.contentRange !== null &&
          response.headers.get("Content-Range") !== expected.contentRange)
      ) {
        boundedSignal.cleanup();
        void response.body?.cancel();
        throw new LiveDeliveryRepositoryError(
          "Storage returned an invalid live asset response.",
          503,
          "live_delivery_asset_unavailable",
        );
      }
      const upstreamLength = response.headers.get("Content-Length");
      if (
        upstreamLength !== null &&
        Number(upstreamLength) !== expected.contentLength
      ) {
        boundedSignal.cleanup();
        void response.body.cancel();
        throw new LiveDeliveryRepositoryError(
          "Storage returned an invalid live asset length.",
          503,
          "live_delivery_asset_unavailable",
        );
      }

      return {
        body: managedAssetBody(response.body, boundedSignal.cleanup),
        status: expected.status,
        contentLength: expected.contentLength,
        contentRange: expected.contentRange,
      };
    },
  };
}
