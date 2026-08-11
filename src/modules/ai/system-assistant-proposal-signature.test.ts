import assert from "node:assert/strict";
import test from "node:test";
import type { SystemAssistantAction } from "./system-assistant-contracts";
import {
  sealSystemAssistantActionProposal,
  SYSTEM_ASSISTANT_ACTION_PROPOSAL_TTL_MS,
  verifySystemAssistantActionProposal,
  type SystemAssistantActionProposalSignatureInput,
} from "./system-assistant-proposal-signature";

const ACTOR_AUTH_USER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OTHER_ACTOR_AUTH_USER_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const IDEMPOTENCY_KEY = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const OTHER_IDEMPOTENCY_KEY = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const COURSE_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const NOW_MS = Date.parse("2026-08-11T08:00:00.000Z");

const ACTION = {
  type: "course.add_lesson",
  courseId: COURSE_ID,
  courseTitle: "Английский для путешествий",
  input: {
    title: "В аэропорту",
    summary: "Практикуем регистрацию на рейс.",
  },
} satisfies SystemAssistantAction;

const INPUT: SystemAssistantActionProposalSignatureInput = {
  actorAuthUserId: ACTOR_AUTH_USER_ID,
  proposal: {
    idempotencyKey: IDEMPOTENCY_KEY,
    action: ACTION,
  },
};

function useTestSecret(t: { after(callback: () => void): void }) {
  const previous = process.env.APP_SESSION_SECRET;
  process.env.APP_SESSION_SECRET =
    "test-only-app-session-secret-for-assistant-proposals";
  t.after(() => {
    if (previous === undefined) delete process.env.APP_SESSION_SECRET;
    else process.env.APP_SESSION_SECRET = previous;
  });
}

test("system assistant action proposal seal verifies for its actor and exact proposal", (t) => {
  useTestSecret(t);
  const sealed = sealSystemAssistantActionProposal(INPUT, NOW_MS);

  assert.match(sealed, /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/);
  assert.equal(
    verifySystemAssistantActionProposal(sealed, INPUT, NOW_MS + 1),
    true,
  );
});

test("proposal seal fails closed after token, idempotency key, or action tampering", (t) => {
  useTestSecret(t);
  const sealed = sealSystemAssistantActionProposal(INPUT, NOW_MS);
  const [envelope, mac] = sealed.split(".");
  assert.ok(envelope && mac);
  const tamperedMac = `${mac.startsWith("A") ? "B" : "A"}${mac.slice(1)}`;
  const decodedEnvelope = JSON.parse(
    Buffer.from(envelope, "base64url").toString("utf8"),
  ) as { v: number; iat: number; exp: number };
  const shiftedEnvelope = Buffer.from(
    JSON.stringify({
      ...decodedEnvelope,
      iat: decodedEnvelope.iat + 1_000,
      exp: decodedEnvelope.exp + 1_000,
    }),
    "utf8",
  ).toString("base64url");

  assert.equal(
    verifySystemAssistantActionProposal(
      `${envelope}.${tamperedMac}`,
      INPUT,
      NOW_MS + 1,
    ),
    false,
  );
  assert.equal(
    verifySystemAssistantActionProposal(
      `${shiftedEnvelope}.${mac}`,
      INPUT,
      NOW_MS + 1,
    ),
    false,
  );
  assert.equal(
    verifySystemAssistantActionProposal(
      sealed,
      {
        ...INPUT,
        proposal: { ...INPUT.proposal, idempotencyKey: OTHER_IDEMPOTENCY_KEY },
      },
      NOW_MS + 1,
    ),
    false,
  );
  assert.equal(
    verifySystemAssistantActionProposal(
      sealed,
      {
        ...INPUT,
        proposal: {
          ...INPUT.proposal,
          action: {
            ...ACTION,
            input: { ...ACTION.input, title: "Подменённый урок" },
          },
        },
      },
      NOW_MS + 1,
    ),
    false,
  );
});

test("proposal seal is bound to the authenticated actor", (t) => {
  useTestSecret(t);
  const sealed = sealSystemAssistantActionProposal(INPUT, NOW_MS);

  assert.equal(
    verifySystemAssistantActionProposal(
      sealed,
      { ...INPUT, actorAuthUserId: OTHER_ACTOR_AUTH_USER_ID },
      NOW_MS + 1,
    ),
    false,
  );
});

test("proposal seal expires at the short-lived boundary", (t) => {
  useTestSecret(t);
  const sealed = sealSystemAssistantActionProposal(INPUT, NOW_MS);

  assert.equal(
    verifySystemAssistantActionProposal(
      sealed,
      INPUT,
      NOW_MS + SYSTEM_ASSISTANT_ACTION_PROPOSAL_TTL_MS - 1,
    ),
    true,
  );
  assert.equal(
    verifySystemAssistantActionProposal(
      sealed,
      INPUT,
      NOW_MS + SYSTEM_ASSISTANT_ACTION_PROPOSAL_TTL_MS,
    ),
    false,
  );
});
