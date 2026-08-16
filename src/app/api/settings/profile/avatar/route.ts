import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  ACCOUNT_AVATAR_MAX_UPLOAD_BYTES,
  isAvatarPresetKey,
  type AccountAvatarView,
} from "@/lib/account-avatar";
import { apiError } from "@/lib/server/api";
import {
  AccountAvatarRevisionConflictError,
  getCurrentAccountAuthContext,
  setCurrentAccountAvatar,
} from "@/lib/server/account-auth";
import {
  clearAppSession,
  isSessionRevoked,
  readAppSession,
} from "@/lib/server/app-session";
import { logger } from "@/lib/server/logger";
import {
  parseProfileAvatarDeliveryWidth,
  processProfileAvatarImage,
  ProfileAvatarInputError,
  renderProfileAvatarDeliveryVariant,
} from "@/lib/server/profile-avatar-image";
import {
  createProfileAvatarDeliveryKey,
  PROFILE_AVATAR_DELIVERY_KEY_PATTERN,
} from "@/lib/server/profile-avatar-delivery";
import { reconcileProfileAvatarCustomSwitch } from "@/lib/server/profile-avatar-reconciliation";
import {
  createProfileAvatarStoragePath,
  deleteProfileAvatarObject,
  downloadProfileAvatarObject,
  PROFILE_AVATAR_OUTPUT_MIME_TYPE,
  uploadProfileAvatarObject,
} from "@/lib/server/profile-avatar-storage";
import { hitRateLimit } from "@/lib/server/rate-limit";
import {
  isSupabaseUserReauthenticationRequiredError,
  requireSupabaseUserAccessToken,
} from "@/lib/server/supabase-user-session";

export const runtime = "nodejs";

const MULTIPART_OVERHEAD_BYTES = 64 * 1024;
const MAX_MULTIPART_BODY_BYTES =
  ACCOUNT_AVATAR_MAX_UPLOAD_BYTES + MULTIPART_OVERHEAD_BYTES;

type AvatarRequestContext = {
  accessToken: string;
  sessionIssuedAt: number;
  account: Awaited<ReturnType<typeof getCurrentAccountAuthContext>>;
};

type AvatarContextResolution =
  | { ok: true; value: AvatarRequestContext }
  | { ok: false; response: NextResponse };

function publicAvatar(avatar: AccountAvatarView): AccountAvatarView {
  return {
    kind: avatar.kind,
    presetKey: avatar.presetKey,
    revision: avatar.revision,
  };
}

function parseExpectedRevision(value: unknown) {
  const revision =
    typeof value === "string" && /^[1-9][0-9]*$/.test(value)
      ? Number(value)
      : value;
  return typeof revision === "number" &&
    Number.isSafeInteger(revision) &&
    revision >= 1
    ? revision
    : null;
}

function rateLimitResponse(retryAfterSeconds: number) {
  return NextResponse.json(
    { error: "Слишком много запросов. Повторите попытку позже." },
    {
      status: 429,
      headers: { "Retry-After": String(retryAfterSeconds) },
    },
  );
}

async function resolveAvatarRequestContext(): Promise<AvatarContextResolution> {
  const session = await readAppSession();
  if (!session) {
    return { ok: false, response: apiError(401, "Не авторизовано.") };
  }

  try {
    const accessToken = await requireSupabaseUserAccessToken();
    const account = await getCurrentAccountAuthContext(accessToken);
    if (
      account.authUserId !== session.uid ||
      isSessionRevoked(session.iat, account.sessionsInvalidBefore)
    ) {
      await clearAppSession();
      return {
        ok: false,
        response: apiError(401, "Требуется повторный вход."),
      };
    }
    return {
      ok: true,
      value: { accessToken, sessionIssuedAt: session.iat, account },
    };
  } catch (error) {
    if (isSupabaseUserReauthenticationRequiredError(error)) {
      await clearAppSession();
      return {
        ok: false,
        response: apiError(401, "Требуется повторный вход."),
      };
    }
    logger.error("[api/profile-avatar] Account resolution failed", { error });
    return {
      ok: false,
      response: apiError(503, "Не удалось проверить профиль."),
    };
  }
}

async function bestEffortDelete(accountId: string, path: string | null) {
  if (!path) return;
  try {
    await deleteProfileAvatarObject({
      accountId,
      path,
    });
  } catch (error) {
    logger.warn("[api/profile-avatar] Object cleanup failed", { error });
  }
}

async function readMultipartFormData(req: NextRequest) {
  const contentLengthValue = req.headers.get("content-length");
  if (contentLengthValue !== null) {
    const contentLength = Number(contentLengthValue);
    if (
      !Number.isSafeInteger(contentLength) ||
      contentLength < 0 ||
      contentLength > MAX_MULTIPART_BODY_BYTES
    ) {
      throw new ProfileAvatarInputError(
        "Размер изображения должен быть не больше 5 МБ.",
        413,
      );
    }
  }
  if (!req.body) {
    throw new ProfileAvatarInputError("Добавьте изображение.");
  }

  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    totalBytes += chunk.value.byteLength;
    if (totalBytes > MAX_MULTIPART_BODY_BYTES) {
      await reader.cancel().catch(() => undefined);
      throw new ProfileAvatarInputError(
        "Размер изображения должен быть не больше 5 МБ.",
        413,
      );
    }
    chunks.push(chunk.value);
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  const contentType = req.headers.get("content-type");
  if (!contentType) {
    throw new ProfileAvatarInputError("Неверный формат запроса.", 415);
  }
  try {
    return await new Response(body, {
      headers: { "Content-Type": contentType },
    }).formData();
  } catch {
    throw new ProfileAvatarInputError("Не удалось прочитать изображение.");
  }
}

async function selectPreset(req: NextRequest, context: AvatarRequestContext) {
  const body = (await req.json().catch(() => null)) as {
    presetKey?: unknown;
    expectedRevision?: unknown;
  } | null;
  if (!isAvatarPresetKey(body?.presetKey)) {
    return apiError(400, "Выберите аватар из предложенных.");
  }
  const expectedRevision = parseExpectedRevision(body?.expectedRevision);
  if (expectedRevision === null) {
    return apiError(400, "Обновите страницу и повторите попытку.");
  }

  const result = await setCurrentAccountAvatar({
    accountId: context.account.accountId,
    actorAuthUserId: context.account.authUserId,
    expectedRevision,
    kind: "preset",
    presetKey: body.presetKey,
  });
  await bestEffortDelete(context.account.accountId, result.previousStoragePath);
  return NextResponse.json({ avatar: publicAvatar(result.avatar) });
}

async function uploadCustomAvatar(
  req: NextRequest,
  context: AvatarRequestContext,
) {
  const formData = await readMultipartFormData(req);
  const file = formData.get("file");
  if (!(file instanceof File) || file.size < 1) {
    throw new ProfileAvatarInputError("Добавьте изображение.");
  }
  if (file.size > ACCOUNT_AVATAR_MAX_UPLOAD_BYTES) {
    throw new ProfileAvatarInputError(
      "Размер изображения должен быть не больше 5 МБ.",
      413,
    );
  }
  const expectedRevision = parseExpectedRevision(
    formData.get("expectedRevision"),
  );
  if (expectedRevision === null) {
    throw new ProfileAvatarInputError("Обновите страницу и повторите попытку.");
  }

  const processed = await processProfileAvatarImage({
    bytes: new Uint8Array(await file.arrayBuffer()),
    declaredMimeType: file.type,
  });
  const storagePath = createProfileAvatarStoragePath(
    context.account.accountId,
    randomUUID(),
  );
  await uploadProfileAvatarObject({
    accountId: context.account.accountId,
    path: storagePath,
    bytes: processed.bytes,
  });

  let result: Awaited<ReturnType<typeof setCurrentAccountAvatar>>;
  try {
    result = await setCurrentAccountAvatar({
      accountId: context.account.accountId,
      actorAuthUserId: context.account.authUserId,
      expectedRevision,
      kind: "custom",
      storagePath,
    });
  } catch (error) {
    const reconciliation = await reconcileProfileAvatarCustomSwitch({
      accessToken: context.accessToken,
      accountId: context.account.accountId,
      authUserId: context.account.authUserId,
      sessionIssuedAt: context.sessionIssuedAt,
      storagePath,
    });
    if (reconciliation.status === "committed") {
      const previousStoragePath =
        context.account.avatar.kind === "custom"
          ? context.account.avatar.storagePath
          : null;
      if (previousStoragePath !== storagePath) {
        await bestEffortDelete(context.account.accountId, previousStoragePath);
      }
      return NextResponse.json({
        avatar: publicAvatar(reconciliation.avatar),
      });
    }
    if (reconciliation.status === "not_committed") {
      await bestEffortDelete(context.account.accountId, storagePath);
    } else {
      logger.warn(
        "[api/profile-avatar] Commit state is ambiguous; uploaded object retained",
        { error },
      );
    }
    throw error;
  }

  await bestEffortDelete(context.account.accountId, result.previousStoragePath);
  return NextResponse.json({ avatar: publicAvatar(result.avatar) });
}

export async function GET(req: NextRequest) {
  const rateLimit = hitRateLimit(req, {
    key: "settings-profile-avatar-read",
    limit: 180,
    windowMs: 60_000,
  });
  if (rateLimit.limited) {
    return rateLimitResponse(rateLimit.retryAfterSeconds);
  }

  const resolved = await resolveAvatarRequestContext();
  if (!resolved.ok) return resolved.response;
  const { account } = resolved.value;
  if (account.avatar.kind !== "custom" || !account.avatar.storagePath) {
    return apiError(404, "Собственный аватар не найден.");
  }

  const requestedRevision = parseExpectedRevision(
    req.nextUrl.searchParams.get("revision"),
  );
  if (requestedRevision !== account.avatar.revision) {
    return apiError(404, "Аватар уже изменился.");
  }
  const width = parseProfileAvatarDeliveryWidth(
    req.nextUrl.searchParams.get("width"),
  );
  if (width === null) {
    return apiError(400, "Недопустимый размер аватара.");
  }

  const suppliedDeliveryKey = req.nextUrl.searchParams.get("cache");
  if (
    suppliedDeliveryKey !== null &&
    !PROFILE_AVATAR_DELIVERY_KEY_PATTERN.test(suppliedDeliveryKey)
  ) {
    return apiError(400, "Недопустимый адрес аватара.");
  }
  const expectedDeliveryKey = createProfileAvatarDeliveryKey({
    authUserId: account.authUserId,
    revision: account.avatar.revision,
  });
  if (
    suppliedDeliveryKey !== null &&
    suppliedDeliveryKey !== expectedDeliveryKey
  ) {
    return apiError(404, "Аватар уже изменился.");
  }

  const cacheable = suppliedDeliveryKey === expectedDeliveryKey;
  const etag = `"avatar-${expectedDeliveryKey}-${width}"`;
  const cacheHeaders = {
    "Cache-Control": cacheable
      ? "private, max-age=31536000, immutable"
      : "private, no-store",
    ETag: etag,
    Vary: "Cookie",
    "X-Content-Type-Options": "nosniff",
  };
  if (cacheable && req.headers.get("if-none-match") === etag) {
    return new NextResponse(null, { status: 304, headers: cacheHeaders });
  }

  try {
    const bytes = await downloadProfileAvatarObject({
      accountId: account.accountId,
      path: account.avatar.storagePath,
    });
    const variant = await renderProfileAvatarDeliveryVariant(bytes, width);
    return new NextResponse(variant, {
      status: 200,
      headers: {
        ...cacheHeaders,
        "Content-Length": String(variant.byteLength),
        "Content-Type": PROFILE_AVATAR_OUTPUT_MIME_TYPE,
      },
    });
  } catch (error) {
    logger.error("[api/profile-avatar] Object download failed", { error });
    return apiError(503, "Не удалось загрузить аватар.");
  }
}

export async function POST(req: NextRequest) {
  const rateLimit = hitRateLimit(req, {
    key: "settings-profile-avatar-write",
    limit: 12,
    windowMs: 60_000,
  });
  if (rateLimit.limited) {
    return rateLimitResponse(rateLimit.retryAfterSeconds);
  }

  const resolved = await resolveAvatarRequestContext();
  if (!resolved.ok) return resolved.response;

  try {
    const mediaType = req.headers
      .get("content-type")
      ?.split(";", 1)[0]
      ?.trim()
      .toLowerCase();
    if (mediaType === "application/json") {
      return await selectPreset(req, resolved.value);
    }
    if (mediaType === "multipart/form-data") {
      return await uploadCustomAvatar(req, resolved.value);
    }
    return apiError(415, "Используйте JSON или форму с изображением.");
  } catch (error) {
    if (error instanceof ProfileAvatarInputError) {
      return apiError(error.status, error.message);
    }
    if (error instanceof AccountAvatarRevisionConflictError) {
      return apiError(409, "Аватар уже изменился. Обновите страницу.");
    }
    logger.error("[api/profile-avatar] Avatar update failed", { error });
    return apiError(503, "Не удалось сохранить аватар.");
  }
}
