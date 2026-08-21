import { NextResponse } from "next/server";
import { clearAppSession } from "@/lib/server/app-session";
import { getActiveCourseBuilderContext } from "@/modules/course-builder/server-context";
import {
  isSupabaseUserReauthenticationRequiredError,
  requireSupabaseUserSession,
  SupabaseUserReauthenticationRequiredError,
} from "@/lib/server/supabase-user-session";
import { postgresUuidSchema } from "@/lib/postgres-uuid";
import { LiveDeliveryValidationError } from "./contracts";
import type { LearnerLiveActor } from "./domain";
import {
  LiveDeliveryAssetNotFoundError,
  LiveDeliveryAssetRangeError,
  LiveDeliveryProjectionError,
  LiveDeliveryRepositoryError,
} from "./errors";
import {
  createLearnerLiveDeliveryRepository,
  createTeacherLiveDeliveryRepository,
} from "./repository";
import { createLiveDeliveryService } from "./service";
import type { LearnerLiveAssetDelivery } from "./service";

type TrustedSupabaseSessionClaims = {
  authUserId: string;
  sessionId: string;
};

/**
 * Decodes only identity hints from the access JWT kept in the encrypted app
 * cookie. Authority is established later by the service-role-only resolver,
 * which checks both values against auth.sessions and the canonical Account.
 */
export function decodeTrustedSupabaseSessionClaims(
  accessToken: string,
): TrustedSupabaseSessionClaims | null {
  const payloadSegment = accessToken.split(".")[1];
  if (!payloadSegment) return null;
  try {
    const payload = JSON.parse(
      Buffer.from(payloadSegment, "base64url").toString("utf8"),
    ) as unknown;
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return null;
    }
    const candidate = payload as Record<string, unknown>;
    const authUserId = postgresUuidSchema.safeParse(candidate.sub);
    const sessionId = postgresUuidSchema.safeParse(candidate.session_id);
    if (!authUserId.success || !sessionId.success) return null;
    return { authUserId: authUserId.data, sessionId: sessionId.data };
  } catch {
    return null;
  }
}

export async function getTeacherLiveDeliveryContext() {
  const { actor } = await getActiveCourseBuilderContext();
  return {
    service: createLiveDeliveryService({
      teacherRepository: createTeacherLiveDeliveryRepository(actor.accessToken),
    }),
  };
}

export async function getLearnerLiveDeliveryContext() {
  const { accessToken, session } = await requireSupabaseUserSession();
  const claims = decodeTrustedSupabaseSessionClaims(accessToken);
  if (!claims || claims.authUserId !== session.uid) {
    throw new SupabaseUserReauthenticationRequiredError();
  }
  const actor: LearnerLiveActor = {
    authUserId: session.uid,
    supabaseSessionId: claims.sessionId,
  };
  return {
    actor,
    service: createLiveDeliveryService({
      learnerRepository: createLearnerLiveDeliveryRepository(),
    }),
  };
}

export async function readLiveDeliveryJson(request: Request) {
  try {
    return await request.json();
  } catch {
    throw new LiveDeliveryValidationError("Ожидался JSON body.");
  }
}

export function liveDeliveryJson(body: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("Cache-Control", "private, no-store");
  return NextResponse.json(body, { ...init, headers });
}

const liveAssetExtensionByMimeType: Readonly<Record<string, string>> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    "docx",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation":
    "pptx",
  "text/plain": "txt",
  "text/markdown": "md",
};

function applyLiveAssetSecurityHeaders(headers: Headers) {
  headers.set("Cache-Control", "private, no-store");
  headers.set(
    "Content-Security-Policy",
    "sandbox; default-src 'none'; base-uri 'none'; form-action 'none'",
  );
  headers.set("Cross-Origin-Resource-Policy", "same-origin");
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  headers.set("Referrer-Policy", "no-referrer");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.delete("Location");
  return headers;
}

export function liveDeliveryAssetResponse(asset: LearnerLiveAssetDelivery) {
  const extension = liveAssetExtensionByMimeType[asset.mimeType] ?? "bin";
  const disposition =
    asset.mimeType.startsWith("image/") || asset.mimeType === "application/pdf"
      ? "inline"
      : "attachment";
  const headers = applyLiveAssetSecurityHeaders(
    new Headers({
      "Accept-Ranges": "bytes",
      "Content-Disposition": `${disposition}; filename="live-material.${extension}"`,
      "Content-Length": String(asset.contentLength),
      "Content-Type": asset.mimeType,
    }),
  );
  if (asset.contentRange) headers.set("Content-Range", asset.contentRange);
  return new NextResponse(asset.body, { status: asset.status, headers });
}

export async function liveDeliveryAssetError(error: unknown) {
  let response: Response;
  try {
    response = await liveDeliveryApiError(error);
  } catch {
    response = liveDeliveryJson(
      {
        error: "Сервис live-материалов временно недоступен.",
        code: "live_delivery_asset_unavailable",
      },
      { status: 503 },
    );
  }
  applyLiveAssetSecurityHeaders(response.headers);
  return response;
}

export async function liveDeliveryApiError(error: unknown) {
  if (
    isSupabaseUserReauthenticationRequiredError(error) ||
    (error instanceof LiveDeliveryRepositoryError && error.status === 401)
  ) {
    await clearAppSession();
    return liveDeliveryJson(
      {
        error: "Войдите снова, чтобы открыть live-занятие.",
        code: "live_delivery_reauthentication_required",
        loginRequired: true,
      },
      { status: 401 },
    );
  }
  if (error instanceof LiveDeliveryValidationError) {
    return liveDeliveryJson(
      { error: error.message, code: error.code },
      { status: 400 },
    );
  }
  if (error instanceof LiveDeliveryAssetNotFoundError) {
    return liveDeliveryJson(
      {
        error: "Live-материал не найден или недоступен.",
        code: error.code,
      },
      { status: 404 },
    );
  }
  if (error instanceof LiveDeliveryAssetRangeError) {
    return liveDeliveryJson(
      {
        error: "Запрошенный диапазон live-материала недоступен.",
        code: error.code,
      },
      {
        status: 416,
        headers: {
          "Accept-Ranges": "bytes",
          "Content-Range": `bytes */${error.sizeBytes}`,
        },
      },
    );
  }
  if (error instanceof LiveDeliveryRepositoryError) {
    if (error.status === 404) {
      return liveDeliveryJson(
        {
          error: "Live-занятие не найдено или недоступно.",
          code: "live_delivery_not_found",
        },
        { status: 404 },
      );
    }
    if (error.status === 409) {
      return liveDeliveryJson(
        {
          error:
            "Курсор уже изменился. Обновите состояние и повторите действие.",
          code: "live_delivery_cursor_conflict",
        },
        { status: 409 },
      );
    }
    if (error.status === 400) {
      return liveDeliveryJson(
        {
          error: "Проверьте состояние и параметры live-показа.",
          code: "live_delivery_validation_error",
        },
        { status: 400 },
      );
    }
  }
  if (error instanceof LiveDeliveryProjectionError) {
    return liveDeliveryJson(
      {
        error: "Live-слайд временно недоступен.",
        code: error.code,
      },
      { status: 503 },
    );
  }
  return liveDeliveryJson(
    {
      error: "Сервис live-занятия временно недоступен.",
      code: "live_delivery_unavailable",
    },
    { status: 503 },
  );
}
