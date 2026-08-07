import crypto from "node:crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { isInternalAuthEmail } from "@/lib/auth";

export const APP_SESSION_COOKIE = "shidao_session";
const MIN_APP_SESSION_SECRET_LENGTH = 32;
const DEFAULT_SESSION_TTL_HOURS = 48;
export const RECENT_REAUTHENTICATION_MAX_AGE_MS = 5 * 60 * 1000;

function resolveSessionTtlSeconds() {
  const raw = process.env.APP_SESSION_TTL_HOURS;
  const hours = raw ? Number(raw) : DEFAULT_SESSION_TTL_HOURS;
  if (!Number.isFinite(hours) || hours <= 0) {
    return DEFAULT_SESSION_TTL_HOURS * 3600;
  }
  return Math.floor(hours * 3600);
}

const SESSION_TTL_SECONDS = resolveSessionTtlSeconds();
const SESSION_VERSION = Number(process.env.APP_SESSION_VERSION ?? "1");

export type AppSessionSupabaseTokens = {
  accessToken: string | null;
  refreshToken: string | null;
  accessTokenExpiresAtMs: number | null;
};

export type AppSession = {
  v: number;
  sid: string;
  uid: string;
  email: string | null;
  fullName: string | null;
  recoveryVerifiedAt?: number | null;
  reauthenticatedAt?: number | null;
  supabaseSession?: AppSessionSupabaseTokens | null;
  iat: number;
  exp: number;
};

export type WriteAppSessionInput = {
  uid: string;
  email?: string | null;
  fullName?: string | null;
  recoveryVerifiedAt?: number | null;
  reauthenticatedAt?: number | null;
  supabaseSession?: AppSessionSupabaseTokens | null;
};

type SupabaseAuthTokensInput = {
  accessToken?: string | null;
  refreshToken?: string | null;
  expiresInSeconds?: number | null;
  expiresAtEpochSeconds?: number | null;
};

function normalizeOptionalToken(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

export function resolveSupabaseAccessTokenExpiresAtMs(
  input: Pick<
    SupabaseAuthTokensInput,
    "expiresInSeconds" | "expiresAtEpochSeconds"
  >,
  nowMs = Date.now(),
) {
  if (
    typeof input.expiresAtEpochSeconds === "number" &&
    Number.isFinite(input.expiresAtEpochSeconds) &&
    input.expiresAtEpochSeconds > 0
  ) {
    return Math.trunc(input.expiresAtEpochSeconds * 1000);
  }

  if (
    typeof input.expiresInSeconds === "number" &&
    Number.isFinite(input.expiresInSeconds) &&
    input.expiresInSeconds > 0
  ) {
    return nowMs + Math.trunc(input.expiresInSeconds * 1000);
  }

  return null;
}

export function buildAppSessionSupabaseTokens(
  input: SupabaseAuthTokensInput,
  nowMs = Date.now(),
): AppSessionSupabaseTokens | null {
  const accessToken = normalizeOptionalToken(input.accessToken);
  const refreshToken = normalizeOptionalToken(input.refreshToken);
  if (!accessToken && !refreshToken) return null;

  return {
    accessToken,
    refreshToken,
    accessTokenExpiresAtMs: resolveSupabaseAccessTokenExpiresAtMs(input, nowMs),
  };
}

export function isSupabaseAccessTokenFresh(
  session: AppSessionSupabaseTokens | null | undefined,
  nowMs = Date.now(),
  refreshSkewMs = 60_000,
) {
  if (!session?.accessToken || !session.accessTokenExpiresAtMs) return false;
  const safeSkewMs = Math.max(0, refreshSkewMs);
  return session.accessTokenExpiresAtMs - safeSkewMs > nowMs;
}

function getSecret() {
  const secret = process.env.APP_SESSION_SECRET;
  if (!secret) {
    throw new Error(
      "Configuration error: APP_SESSION_SECRET is required for app session signing. Set APP_SESSION_SECRET in your environment.",
    );
  }
  if (secret.length < MIN_APP_SESSION_SECRET_LENGTH) {
    throw new Error(
      `Configuration error: APP_SESSION_SECRET is too short. Use at least ${MIN_APP_SESSION_SECRET_LENGTH} characters with high entropy.`,
    );
  }
  return secret;
}

function deriveKey() {
  return crypto.createHash("sha256").update(getSecret()).digest();
}

export function sealAppSession(payload: AppSession) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", deriveKey(), iv);
  const plaintext = Buffer.from(JSON.stringify(payload), "utf8");
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    iv.toString("base64url"),
    encrypted.toString("base64url"),
    tag.toString("base64url"),
  ].join(".");
}

function decrypt(token: string): AppSession | null {
  const [ivB64, encryptedB64, tagB64] = token.split(".");
  if (!ivB64 || !encryptedB64 || !tagB64) return null;
  try {
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      deriveKey(),
      Buffer.from(ivB64, "base64url"),
    );
    decipher.setAuthTag(Buffer.from(tagB64, "base64url"));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encryptedB64, "base64url")),
      decipher.final(),
    ]);
    return JSON.parse(decrypted.toString("utf8")) as AppSession;
  } catch {
    return null;
  }
}

type LegacySessionPayload = {
  uid: string;
  email: string | null;
  fullName: string | null;
  recoveryVerifiedAt?: number | null;
  iat: number;
};

function verifyLegacyToken(token: string): AppSession | null {
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;
  const expected = crypto
    .createHmac("sha256", getSecret())
    .update(body)
    .digest("base64url");
  const sig = Buffer.from(signature);
  const exp = Buffer.from(expected);
  if (sig.length !== exp.length || !crypto.timingSafeEqual(sig, exp)) {
    return null;
  }
  try {
    const legacy = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8"),
    ) as LegacySessionPayload;
    const issuedAt = legacy.iat ?? Date.now();
    return {
      ...legacy,
      v: SESSION_VERSION,
      sid: crypto.randomUUID(),
      iat: issuedAt,
      exp: issuedAt + SESSION_TTL_SECONDS * 1000,
    };
  } catch {
    return null;
  }
}

function normalizeSupabaseSession(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<AppSessionSupabaseTokens>;
  const accessToken = normalizeOptionalToken(candidate.accessToken);
  const refreshToken = normalizeOptionalToken(candidate.refreshToken);
  if (!accessToken && !refreshToken) return null;

  return {
    accessToken,
    refreshToken,
    accessTokenExpiresAtMs:
      typeof candidate.accessTokenExpiresAtMs === "number" &&
      Number.isFinite(candidate.accessTokenExpiresAtMs) &&
      candidate.accessTokenExpiresAtMs > 0
        ? candidate.accessTokenExpiresAtMs
        : null,
  } satisfies AppSessionSupabaseTokens;
}

function normalizePayload(payload: AppSession | null, nowMs = Date.now()) {
  if (!payload) return null;
  if (!payload.uid || payload.v !== SESSION_VERSION) return null;
  if (!payload.exp || payload.exp <= nowMs) return null;
  return {
    ...payload,
    email:
      typeof payload.email === "string" && !isInternalAuthEmail(payload.email)
        ? payload.email
        : null,
    reauthenticatedAt:
      typeof payload.reauthenticatedAt === "number" &&
      Number.isFinite(payload.reauthenticatedAt) &&
      payload.reauthenticatedAt > 0
        ? payload.reauthenticatedAt
        : null,
    supabaseSession: normalizeSupabaseSession(payload.supabaseSession),
  } satisfies AppSession;
}

export function unsealAppSession(token: string, nowMs = Date.now()) {
  return normalizePayload(decrypt(token) ?? verifyLegacyToken(token), nowMs);
}

export const readAppSession = cache(async () => {
  const jar = await cookies();
  const raw = jar.get(APP_SESSION_COOKIE)?.value;
  if (!raw) return null;
  return unsealAppSession(raw);
});

export function createAppSessionPayload(
  input: WriteAppSessionInput,
  issuedAt = Date.now(),
): AppSession {
  return {
    v: SESSION_VERSION,
    sid: crypto.randomUUID(),
    uid: input.uid,
    email:
      typeof input.email === "string" && !isInternalAuthEmail(input.email)
        ? input.email
        : null,
    fullName: input.fullName ?? null,
    recoveryVerifiedAt: input.recoveryVerifiedAt ?? null,
    reauthenticatedAt: input.reauthenticatedAt ?? null,
    supabaseSession: input.supabaseSession ?? null,
    iat: issuedAt,
    exp: issuedAt + SESSION_TTL_SECONDS * 1000,
  };
}

async function persistAppSession(payload: AppSession) {
  const jar = await cookies();
  const maxAge = Math.max(1, Math.ceil((payload.exp - Date.now()) / 1000));
  const token = sealAppSession(payload);
  jar.set(APP_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  });
}

export async function writeAppSession(input: WriteAppSessionInput) {
  await persistAppSession(createAppSessionPayload(input));
}

export async function rotateAppSessionSupabaseTokens(
  currentSession: AppSession,
  supabaseSession: AppSessionSupabaseTokens,
) {
  const nextSession = normalizePayload({
    ...currentSession,
    supabaseSession,
  });
  if (!nextSession) {
    throw new Error("Cannot rotate tokens for an expired app session.");
  }
  await persistAppSession(nextSession);
  return nextSession;
}

export async function clearAppSession() {
  const jar = await cookies();
  jar.delete(APP_SESSION_COOKIE);
}

export function isRecentReauthentication(
  session: Pick<AppSession, "reauthenticatedAt"> | null | undefined,
  nowMs = Date.now(),
  maxAgeMs = RECENT_REAUTHENTICATION_MAX_AGE_MS,
) {
  const verifiedAt = session?.reauthenticatedAt;
  if (
    typeof verifiedAt !== "number" ||
    !Number.isFinite(verifiedAt) ||
    !Number.isFinite(nowMs) ||
    !Number.isFinite(maxAgeMs) ||
    maxAgeMs < 0
  ) {
    return false;
  }
  const ageMs = nowMs - verifiedAt;
  return ageMs >= 0 && ageMs <= maxAgeMs;
}

export function requireRecentReauthentication(
  session: Pick<AppSession, "reauthenticatedAt"> | null | undefined,
  nowMs = Date.now(),
  maxAgeMs = RECENT_REAUTHENTICATION_MAX_AGE_MS,
) {
  if (!isRecentReauthentication(session, nowMs, maxAgeMs)) {
    throw new Error("RECENT_REAUTHENTICATION_REQUIRED");
  }
}

/**
 * A session is revoked when it was issued (`iat`) strictly before the user's
 * `sessions_invalid_before` cutoff (see migration 202606300001). Pure and
 * testable; the cutoff may arrive as an ISO string (PostgREST), epoch ms, or
 * Date. A null cutoff means "not revoked"; a malformed non-null cutoff fails
 * closed because session validity cannot be established safely.
 */
export function isSessionRevoked(
  issuedAtMs: number,
  sessionsInvalidBefore: string | number | Date | null | undefined,
): boolean {
  if (sessionsInvalidBefore == null) return false;
  const cutoffMs =
    sessionsInvalidBefore instanceof Date
      ? sessionsInvalidBefore.getTime()
      : typeof sessionsInvalidBefore === "number"
        ? sessionsInvalidBefore
        : Date.parse(sessionsInvalidBefore);
  if (!Number.isFinite(cutoffMs)) return true;
  return issuedAtMs < cutoffMs;
}
