import { NextRequest, NextResponse } from "next/server";
import { afterConfirm } from "@/lib/auth-redirects";
import {
  getPublicSiteUrl,
  getSupabasePublicConfig,
  resolveSafeAuthRedirect,
} from "@/lib/server/auth-config";
import {
  buildAppSessionSupabaseTokens,
  writeAppSession,
} from "@/lib/server/app-session";
import { setIdentityEmailHandoff } from "@/modules/learner-identity/email-handoff";

export const runtime = "nodejs";
const ALLOWED_TYPES = new Set([
  "signup",
  "email",
  "recovery",
  "invite",
  "email_change",
]);
type IdentityInvitationKind = "connection" | "profile" | "observer";

function authRedirect(url: URL) {
  const response = NextResponse.redirect(url);
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}

function fragmentRelayResponse() {
  const html = `<!doctype html>
<html lang="ru">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <meta name="referrer" content="no-referrer">
    <title>Подтверждаем вход — ShiDao</title>
  </head>
  <body>
    <main aria-live="polite"><p>Подтверждаем безопасный вход…</p></main>
    <script>
      (async function () {
        var fragment = new URLSearchParams(window.location.hash.slice(1));
        var refreshToken = fragment.get("refresh_token");
        var query = new URLSearchParams(window.location.search);
        History.prototype.replaceState.call(
          window.history,
          window.history.state,
          "",
          window.location.pathname + window.location.search
        );
        try {
          if (!refreshToken) throw new Error("missing relay token");
          var response = await fetch("/api/auth/email-relay", {
            method: "POST",
            credentials: "same-origin",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              refreshToken: refreshToken,
              invitationId: query.get("identity_invitation"),
              kind: query.get("identity_kind"),
              next: query.get("next")
            })
          });
          var payload = await response.json();
          if (!response.ok || typeof payload.redirectTo !== "string") {
            throw new Error("relay failed");
          }
          window.location.replace(payload.redirectTo);
        } catch (_) {
          window.location.replace("/login");
        }
      })();
    </script>
  </body>
</html>`;
  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
      "Content-Security-Policy":
        "default-src 'none'; script-src 'unsafe-inline'; connect-src 'self'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
    },
  });
}

function readRedirectContract(req: NextRequest) {
  let next = req.nextUrl.searchParams.get("next");
  let invitationId = req.nextUrl.searchParams.get("identity_invitation");
  let invitationKind = req.nextUrl.searchParams.get("identity_kind");
  const nestedRedirect = req.nextUrl.searchParams.get("redirect_to");
  if (!nestedRedirect) return { next, invitationId, invitationKind };

  try {
    const nested = new URL(nestedRedirect);
    const publicUrl = new URL(getPublicSiteUrl());
    if (
      nested.origin !== publicUrl.origin ||
      nested.pathname !== "/auth/confirm"
    ) {
      return { next, invitationId, invitationKind };
    }
    next = nested.searchParams.get("next") ?? next;
    invitationId =
      nested.searchParams.get("identity_invitation") ?? invitationId;
    invitationKind = nested.searchParams.get("identity_kind") ?? invitationKind;
  } catch {
    // Invalid nested redirects never override the safe local fallback.
  }
  return { next, invitationId, invitationKind };
}

export async function GET(req: NextRequest) {
  const tokenHash = req.nextUrl.searchParams.get("token_hash");
  const rawType = (req.nextUrl.searchParams.get("type") ?? "").toLowerCase();
  const type = rawType === "email/signup" ? "signup" : rawType;
  const { next, invitationId, invitationKind } = readRedirectContract(req);
  const fallbackUrl = new URL(afterConfirm("unknown"), getPublicSiteUrl());
  let redirectPath = resolveSafeAuthRedirect(next, afterConfirm(type));
  const identityRequested = Boolean(invitationId || invitationKind);
  const normalizedInvitationKind: IdentityInvitationKind | null =
    invitationKind === "connection" ||
    invitationKind === "profile" ||
    invitationKind === "observer"
      ? invitationKind
      : null;
  const identityContract: {
    invitationId: string;
    kind: IdentityInvitationKind;
  } | null =
    invitationId &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      invitationId,
    ) &&
    normalizedInvitationKind &&
    redirectPath === `/identity/invitations/${encodeURIComponent(invitationId)}`
      ? { invitationId, kind: normalizedInvitationKind }
      : null;
  if (identityRequested && !identityContract) {
    redirectPath = afterConfirm(type);
  } else if (identityContract) {
    redirectPath = `/identity/invitations/${encodeURIComponent(identityContract.invitationId)}`;
  }

  if (!tokenHash) {
    return identityContract
      ? fragmentRelayResponse()
      : authRedirect(fallbackUrl);
  }
  if (!type || !ALLOWED_TYPES.has(type)) {
    return authRedirect(fallbackUrl);
  }

  try {
    const { url, anonKey } = getSupabasePublicConfig();
    const response = await fetch(`${url}/auth/v1/verify`, {
      method: "POST",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        token_hash: tokenHash,
        type,
      }),
      cache: "no-store",
    });

    const payload = (await response.json().catch(() => null)) as {
      access_token?: string | null;
      refresh_token?: string | null;
      expires_in?: number | null;
      expires_at?: number | null;
      user?: {
        id?: string;
        email?: string | null;
        user_metadata?: { full_name?: string | null } | null;
      };
    } | null;

    if (!response.ok) {
      return authRedirect(fallbackUrl);
    }

    if (payload?.user?.id) {
      await writeAppSession({
        uid: payload.user.id,
        email: payload.user.email ?? null,
        fullName: payload.user.user_metadata?.full_name ?? null,
        recoveryVerifiedAt: type === "recovery" ? Date.now() : null,
        supabaseSession: buildAppSessionSupabaseTokens({
          accessToken: payload.access_token,
          refreshToken: payload.refresh_token,
          expiresInSeconds: payload.expires_in,
          expiresAtEpochSeconds: payload.expires_at,
        }),
      });
    }

    const destination = new URL(redirectPath, getPublicSiteUrl());
    if (identityContract) {
      destination.searchParams.set("kind", identityContract.kind);
    }
    const redirectResponse = authRedirect(destination);
    if (
      identityContract &&
      payload?.user?.id &&
      typeof payload.user.email === "string" &&
      payload.user.email
    ) {
      setIdentityEmailHandoff(redirectResponse, {
        invitationId: identityContract.invitationId,
        kind: identityContract.kind,
        authUserId: payload.user.id,
        verifiedEmail: payload.user.email,
      });
    }
    return redirectResponse;
  } catch {
    return authRedirect(fallbackUrl);
  }
}
