import crypto from "node:crypto";
import {
  systemAssistantActionSchema,
  type SystemAssistantAction,
} from "./system-assistant-contracts";

const MIN_APP_SESSION_SECRET_LENGTH = 32;
const PROPOSAL_SIGNATURE_VERSION = 1;
const PROPOSAL_KEY_DOMAIN =
  "shidao:system-assistant-action-proposal:v1:key-derivation";
const PROPOSAL_MESSAGE_DOMAIN =
  "shidao:system-assistant-action-proposal:v1:message";
const MAX_ISSUED_AT_CLOCK_SKEW_MS = 30_000;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const SYSTEM_ASSISTANT_ACTION_PROPOSAL_TTL_MS = 10 * 60 * 1_000;

export type UnsignedSystemAssistantActionProposal = {
  idempotencyKey: string;
  action: SystemAssistantAction;
};

export type SystemAssistantActionProposalSignatureInput = {
  actorAuthUserId: string;
  proposal: UnsignedSystemAssistantActionProposal;
};

type ProposalSignatureEnvelope = {
  v: number;
  iat: number;
  exp: number;
};

function appSessionSecret() {
  const secret = process.env.APP_SESSION_SECRET;
  if (!secret) {
    throw new Error(
      "Configuration error: APP_SESSION_SECRET is required for system assistant proposal signing.",
    );
  }
  if (secret.length < MIN_APP_SESSION_SECRET_LENGTH) {
    throw new Error(
      `Configuration error: APP_SESSION_SECRET is too short. Use at least ${MIN_APP_SESSION_SECRET_LENGTH} characters with high entropy.`,
    );
  }
  return secret;
}

function signingKey() {
  return crypto
    .createHmac("sha256", appSessionSecret())
    .update(PROPOSAL_KEY_DOMAIN, "utf8")
    .digest();
}

function canonicalJson(value: unknown): string {
  if (
    value === null ||
    typeof value === "boolean" ||
    typeof value === "string"
  ) {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new TypeError("Proposal signature input must be JSON-compatible.");
    }
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  }
  if (typeof value === "object") {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new TypeError("Proposal signature input must be JSON-compatible.");
    }
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
      .join(",")}}`;
  }
  throw new TypeError("Proposal signature input must be JSON-compatible.");
}

function normalizeUuid(value: unknown) {
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) return null;
  return value.toLowerCase();
}

function normalizeSignatureInput(
  input: SystemAssistantActionProposalSignatureInput | null | undefined,
) {
  if (!input || typeof input !== "object") return null;
  const actorAuthUserId = normalizeUuid(input.actorAuthUserId);
  const idempotencyKey = normalizeUuid(input.proposal?.idempotencyKey);
  const action = systemAssistantActionSchema.safeParse(input.proposal?.action);
  if (!actorAuthUserId || !idempotencyKey || !action.success) return null;
  return {
    actorAuthUserId,
    proposal: {
      idempotencyKey,
      action: action.data,
    },
  } satisfies SystemAssistantActionProposalSignatureInput;
}

function signature(
  envelope: ProposalSignatureEnvelope,
  input: SystemAssistantActionProposalSignatureInput,
  key: Buffer,
) {
  return crypto
    .createHmac("sha256", key)
    .update(
      canonicalJson({
        domain: PROPOSAL_MESSAGE_DOMAIN,
        envelope,
        ...input,
      }),
      "utf8",
    )
    .digest();
}

function encodeEnvelope(envelope: ProposalSignatureEnvelope) {
  return Buffer.from(JSON.stringify(envelope), "utf8").toString("base64url");
}

function decodeEnvelope(encoded: string): ProposalSignatureEnvelope | null {
  if (!/^[A-Za-z0-9_-]+$/.test(encoded) || encoded.length > 256) return null;
  try {
    const bytes = Buffer.from(encoded, "base64url");
    if (bytes.toString("base64url") !== encoded) return null;
    const value = JSON.parse(bytes.toString("utf8")) as Record<string, unknown>;
    if (
      !value ||
      typeof value !== "object" ||
      Array.isArray(value) ||
      Object.keys(value).sort().join(",") !== "exp,iat,v" ||
      value.v !== PROPOSAL_SIGNATURE_VERSION ||
      typeof value.iat !== "number" ||
      !Number.isSafeInteger(value.iat) ||
      value.iat < 0 ||
      typeof value.exp !== "number" ||
      !Number.isSafeInteger(value.exp) ||
      value.exp - value.iat !== SYSTEM_ASSISTANT_ACTION_PROPOSAL_TTL_MS
    ) {
      return null;
    }
    return {
      v: PROPOSAL_SIGNATURE_VERSION,
      iat: value.iat,
      exp: value.exp,
    };
  } catch {
    return null;
  }
}

export function sealSystemAssistantActionProposal(
  input: SystemAssistantActionProposalSignatureInput,
  nowMs = Date.now(),
) {
  if (!Number.isSafeInteger(nowMs) || nowMs < 0) {
    throw new TypeError(
      "Proposal signature issue time must be an epoch millisecond integer.",
    );
  }
  if (!Number.isSafeInteger(nowMs + SYSTEM_ASSISTANT_ACTION_PROPOSAL_TTL_MS)) {
    throw new TypeError(
      "Proposal signature expiry exceeds the safe time range.",
    );
  }
  const normalized = normalizeSignatureInput(input);
  if (!normalized) {
    throw new TypeError("System assistant action proposal is invalid.");
  }
  const envelope: ProposalSignatureEnvelope = {
    v: PROPOSAL_SIGNATURE_VERSION,
    iat: nowMs,
    exp: nowMs + SYSTEM_ASSISTANT_ACTION_PROPOSAL_TTL_MS,
  };
  const encodedEnvelope = encodeEnvelope(envelope);
  const mac = signature(envelope, normalized, signingKey());
  return `${encodedEnvelope}.${mac.toString("base64url")}`;
}

export function verifySystemAssistantActionProposal(
  sealed: string,
  input: SystemAssistantActionProposalSignatureInput,
  nowMs = Date.now(),
) {
  // Resolve configuration outside the fail-closed parsing path so deployment
  // mistakes remain visible instead of looking like an invalid client token.
  const key = signingKey();
  if (!Number.isSafeInteger(nowMs) || nowMs < 0) return false;
  const normalized = normalizeSignatureInput(input);
  if (!normalized || typeof sealed !== "string") return false;
  const parts = sealed.split(".");
  if (parts.length !== 2) return false;
  const [encodedEnvelope, encodedMac] = parts;
  if (
    !encodedEnvelope ||
    !encodedMac ||
    !/^[A-Za-z0-9_-]{43}$/.test(encodedMac)
  ) {
    return false;
  }
  const envelope = decodeEnvelope(encodedEnvelope);
  if (
    !envelope ||
    envelope.iat > nowMs + MAX_ISSUED_AT_CLOCK_SKEW_MS ||
    envelope.exp <= nowMs
  ) {
    return false;
  }
  const actual = Buffer.from(encodedMac, "base64url");
  if (actual.toString("base64url") !== encodedMac) return false;
  try {
    const expected = signature(envelope, normalized, key);
    return (
      actual.length === expected.length &&
      crypto.timingSafeEqual(actual, expected)
    );
  } catch {
    return false;
  }
}
