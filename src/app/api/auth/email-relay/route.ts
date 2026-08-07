import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabasePublicConfig } from "@/lib/server/auth-config";
import {
  buildAppSessionSupabaseTokens,
  writeAppSession,
} from "@/lib/server/app-session";
import { getCurrentAccountAuthContext } from "@/lib/server/account-auth";
import { hitRateLimit } from "@/lib/server/rate-limit";
import { setIdentityEmailHandoff } from "@/modules/learner-identity/email-handoff";

export const runtime = "nodejs";

const relayPayloadSchema = z
  .object({
    refreshToken: z.string().min(16).max(8_192),
    invitationId: z.uuid(),
    kind: z.enum(["connection", "profile", "observer"]),
    next: z.string().min(1).max(1_024),
  })
  .strict();

type RefreshResponse = {
  access_token?: unknown;
  refresh_token?: unknown;
  expires_in?: unknown;
  expires_at?: unknown;
  user?: {
    id?: unknown;
  } | null;
};

function relayError(status = 400) {
  return NextResponse.json(
    { error: "Ссылка недоступна или истекла." },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
        "Referrer-Policy": "no-referrer",
      },
    },
  );
}

/**
 * GoTrue's default magic-link template returns an existing user's session in
 * the URL fragment. The tiny /auth/confirm relay scrubs that fragment before
 * posting only the refresh capability here. This endpoint rotates and
 * validates it server-side, then persists opaque HttpOnly app/handoff cookies.
 */
export async function POST(request: NextRequest) {
  const rateLimit = hitRateLimit(request, {
    key: "auth-email-relay",
    limit: 10,
    windowMs: 60_000,
  });
  if (rateLimit.limited) {
    const response = relayError(429);
    response.headers.set("Retry-After", String(rateLimit.retryAfterSeconds));
    return response;
  }

  const parsed = relayPayloadSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) return relayError();

  const expectedNext = `/identity/invitations/${encodeURIComponent(parsed.data.invitationId)}`;
  if (parsed.data.next !== expectedNext) return relayError();

  try {
    const { url, anonKey } = getSupabasePublicConfig();
    const refreshResponse = await fetch(
      `${url.replace(/\/+$/, "")}/auth/v1/token?grant_type=refresh_token`,
      {
        method: "POST",
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ refresh_token: parsed.data.refreshToken }),
        cache: "no-store",
      },
    );
    const payload = (await refreshResponse
      .json()
      .catch(() => null)) as RefreshResponse | null;
    if (
      !refreshResponse.ok ||
      typeof payload?.access_token !== "string" ||
      typeof payload.refresh_token !== "string" ||
      typeof payload.user?.id !== "string"
    ) {
      return relayError(401);
    }

    const supabaseSession = buildAppSessionSupabaseTokens({
      accessToken: payload.access_token,
      refreshToken: payload.refresh_token,
      expiresInSeconds:
        typeof payload.expires_in === "number" ? payload.expires_in : null,
      expiresAtEpochSeconds:
        typeof payload.expires_at === "number" ? payload.expires_at : null,
    });
    if (!supabaseSession?.accessToken || !supabaseSession.refreshToken) {
      return relayError(401);
    }

    const context = await getCurrentAccountAuthContext(
      supabaseSession.accessToken,
    );
    if (context.authUserId !== payload.user.id || !context.verifiedEmail) {
      return relayError(401);
    }

    await writeAppSession({
      uid: context.authUserId,
      email: context.verifiedEmail,
      fullName: context.displayName,
      supabaseSession,
    });

    const response = NextResponse.json(
      { redirectTo: `${expectedNext}?kind=${parsed.data.kind}` },
      {
        headers: {
          "Cache-Control": "no-store",
          "Referrer-Policy": "no-referrer",
        },
      },
    );
    setIdentityEmailHandoff(response, {
      invitationId: parsed.data.invitationId,
      kind: parsed.data.kind,
      authUserId: context.authUserId,
      verifiedEmail: context.verifiedEmail,
    });
    return response;
  } catch {
    return relayError(503);
  }
}
