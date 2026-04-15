import crypto from "node:crypto";
import { cookies } from "next/headers";

export const APP_SESSION_COOKIE = "shidao_session";
const MIN_APP_SESSION_SECRET_LENGTH = 32;
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;
const SESSION_VERSION = Number(process.env.APP_SESSION_VERSION ?? "1");

type SessionPayload = {
  v: number;
  sid: string;
  uid: string;
  email: string | null;
  fullName: string | null;
  recoveryVerifiedAt?: number | null;
  iat: number;
  exp: number;
};

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

function encrypt(payload: SessionPayload) {
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

function decrypt(token: string): SessionPayload | null {
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
    return JSON.parse(decrypted.toString("utf8")) as SessionPayload;
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

function verifyLegacyToken(token: string): SessionPayload | null {
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

function normalizePayload(payload: SessionPayload | null) {
  if (!payload) return null;
  if (!payload.uid || payload.v !== SESSION_VERSION) return null;
  if (!payload.exp || payload.exp <= Date.now()) return null;
  return payload;
}

export async function readAppSession() {
  const jar = await cookies();
  const raw = jar.get(APP_SESSION_COOKIE)?.value;
  if (!raw) return null;
  return normalizePayload(decrypt(raw) ?? verifyLegacyToken(raw));
}

export async function writeAppSession(input: {
  uid: string;
  email?: string | null;
  fullName?: string | null;
  recoveryVerifiedAt?: number | null;
}) {
  const jar = await cookies();
  const issuedAt = Date.now();
  const token = encrypt({
    v: SESSION_VERSION,
    sid: crypto.randomUUID(),
    uid: input.uid,
    email: input.email ?? null,
    fullName: input.fullName ?? null,
    recoveryVerifiedAt: input.recoveryVerifiedAt ?? null,
    iat: issuedAt,
    exp: issuedAt + SESSION_TTL_SECONDS * 1000,
  });
  jar.set(APP_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function clearAppSession() {
  const jar = await cookies();
  jar.delete(APP_SESSION_COOKIE);
}
