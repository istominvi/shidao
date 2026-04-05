import { NextRequest, NextResponse } from "next/server";
import { afterConfirm } from "@/lib/auth-redirects";
import {
  getPublicSiteUrl,
  getSupabasePublicConfig,
  resolveSafeAuthRedirect,
} from "@/lib/server/auth-config";
import { writeAppSession } from "@/lib/server/app-session";

export const runtime = "nodejs";
const ALLOWED_TYPES = new Set([
  "signup",
  "email",
  "recovery",
  "invite",
  "email_change",
]);

export async function GET(req: NextRequest) {
  const tokenHash = req.nextUrl.searchParams.get("token_hash");
  const rawType = (req.nextUrl.searchParams.get("type") ?? "").toLowerCase();
  const type = rawType === "email/signup" ? "signup" : rawType;
  const next = req.nextUrl.searchParams.get("next");
  const fallbackUrl = new URL(afterConfirm("unknown"), getPublicSiteUrl());

  if (!tokenHash || !type || !ALLOWED_TYPES.has(type)) {
    return NextResponse.redirect(fallbackUrl);
  }

  const redirectPath = resolveSafeAuthRedirect(next, afterConfirm(type));

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
      user?: {
        id?: string;
        email?: string | null;
        user_metadata?: { full_name?: string | null } | null;
      };
    } | null;

    if (!response.ok) {
      return NextResponse.redirect(fallbackUrl);
    }

    if (payload?.user?.id) {
      await writeAppSession({
        uid: payload.user.id,
        email: payload.user.email ?? null,
        fullName: payload.user.user_metadata?.full_name ?? null,
        recoveryVerifiedAt: type === "recovery" ? Date.now() : null,
      });
    }

    return NextResponse.redirect(new URL(redirectPath, getPublicSiteUrl()));
  } catch {
    return NextResponse.redirect(fallbackUrl);
  }
}
