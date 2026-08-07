import crypto from "node:crypto";

const DIGEST_VERSION = "learner-identity-v1";
const HUMAN_CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const IDENTITY_EMAIL_HANDOFF_VERSION = 1;
export const IDENTITY_EMAIL_HANDOFF_TTL_MS = 15 * 60 * 1_000;

export type IdentityEmailHandoff = {
  invitationId: string;
  kind: "connection" | "profile" | "observer";
  authUserId: string;
  recipientEmailDigest: string;
  issuedAt: number;
  expiresAt: number;
};

function digestKey() {
  const dedicated = process.env.LEARNER_IDENTITY_DIGEST_KEY;
  if (dedicated && dedicated.length >= 32)
    return Buffer.from(dedicated, "utf8");
  const sessionSecret = process.env.APP_SESSION_SECRET;
  if (!sessionSecret || sessionSecret.length < 32) {
    throw new Error("Learner identity digest key is not configured.");
  }
  return crypto
    .createHmac("sha256", sessionSecret)
    .update(`${DIGEST_VERSION}:key-derivation`, "utf8")
    .digest();
}

function digest(domain: string, normalizedValue: string) {
  return `\\x${crypto
    .createHmac("sha256", digestKey())
    .update(`${DIGEST_VERSION}:${domain}\0${normalizedValue}`, "utf8")
    .digest("hex")}`;
}

function identityEmailHandoffKey() {
  return crypto
    .createHmac("sha256", digestKey())
    .update(`${DIGEST_VERSION}:identity-email-handoff-key`, "utf8")
    .digest();
}

export function sealIdentityEmailHandoff(
  input: Omit<IdentityEmailHandoff, "issuedAt" | "expiresAt">,
  nowMs = Date.now(),
) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(
    "aes-256-gcm",
    identityEmailHandoffKey(),
    iv,
  );
  const payload: IdentityEmailHandoff & { v: number } = {
    v: IDENTITY_EMAIL_HANDOFF_VERSION,
    ...input,
    issuedAt: nowMs,
    expiresAt: nowMs + IDENTITY_EMAIL_HANDOFF_TTL_MS,
  };
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(payload), "utf8"),
    cipher.final(),
  ]);
  return [
    iv.toString("base64url"),
    encrypted.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
  ].join(".");
}

export function unsealIdentityEmailHandoff(
  sealed: string,
  nowMs = Date.now(),
): IdentityEmailHandoff | null {
  const [iv, encrypted, tag] = sealed.split(".");
  if (!iv || !encrypted || !tag) return null;
  try {
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      identityEmailHandoffKey(),
      Buffer.from(iv, "base64url"),
    );
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    const payload = JSON.parse(
      Buffer.concat([
        decipher.update(Buffer.from(encrypted, "base64url")),
        decipher.final(),
      ]).toString("utf8"),
    ) as Partial<IdentityEmailHandoff> & { v?: unknown };
    if (
      payload.v !== IDENTITY_EMAIL_HANDOFF_VERSION ||
      typeof payload.invitationId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        payload.invitationId,
      ) ||
      (payload.kind !== "connection" &&
        payload.kind !== "profile" &&
        payload.kind !== "observer") ||
      typeof payload.authUserId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        payload.authUserId,
      ) ||
      typeof payload.recipientEmailDigest !== "string" ||
      !/^\\x[0-9a-f]{64}$/.test(payload.recipientEmailDigest) ||
      typeof payload.issuedAt !== "number" ||
      typeof payload.expiresAt !== "number" ||
      !Number.isFinite(payload.issuedAt) ||
      !Number.isFinite(payload.expiresAt) ||
      payload.issuedAt > nowMs + 30_000 ||
      payload.expiresAt <= nowMs ||
      payload.expiresAt - payload.issuedAt !== IDENTITY_EMAIL_HANDOFF_TTL_MS
    ) {
      return null;
    }
    return {
      invitationId: payload.invitationId,
      kind: payload.kind,
      authUserId: payload.authUserId,
      recipientEmailDigest: payload.recipientEmailDigest,
      issuedAt: payload.issuedAt,
      expiresAt: payload.expiresAt,
    };
  } catch {
    return null;
  }
}

export function normalizeIdentityEmail(email: string) {
  return email.trim().toLocaleLowerCase("en-US");
}

export function digestIdentityEmail(email: string) {
  return digest("recipient-email", normalizeIdentityEmail(email));
}

export function normalizeShareCode(code: string) {
  return code
    .trim()
    .toLocaleUpperCase("en-US")
    .replace(/[\s-]+/g, "");
}

export function digestShareCode(code: string) {
  return digest("share-code", normalizeShareCode(code));
}

export function digestInvitationToken(token: string) {
  return digest("invitation-token", token.trim());
}

/**
 * Stable, non-reversible Auth address for one child-activation invitation.
 * Retrying an ambiguous Auth create therefore converges on the same user
 * instead of leaving multiple provisional accounts behind.
 */
export function deriveProvisionalAuthEmail(invitationId: string) {
  const normalizedInvitationId = invitationId.trim().toLocaleLowerCase("en-US");
  const opaqueLocalPart = digest(
    "provisional-auth-email",
    normalizedInvitationId,
  ).slice(2);
  return `${opaqueLocalPart}@learners.shidao.internal`;
}

export function deriveProvisionalAuthPassword(invitationId: string) {
  return digest(
    "provisional-auth-password",
    invitationId.trim().toLocaleLowerCase("en-US"),
  ).slice(2);
}

export function generateInvitationToken() {
  return crypto.randomBytes(32).toString("base64url");
}

export function generateShareCode() {
  const bytes = crypto.randomBytes(10);
  const characters = Array.from(
    bytes,
    (byte) => HUMAN_CODE_ALPHABET[byte % HUMAN_CODE_ALPHABET.length],
  );
  return `${characters.slice(0, 5).join("")}-${characters.slice(5).join("")}`;
}
