import test from "node:test";
import assert from "node:assert/strict";
import {
  buildAppSessionSupabaseTokens,
  createAppSessionPayload,
  isSessionRevoked,
  isRecentReauthentication,
  requireRecentReauthentication,
  isSupabaseAccessTokenFresh,
  resolveSupabaseAccessTokenExpiresAtMs,
  sealAppSession,
  unsealAppSession,
} from "../app-session";

const cutoffIso = "2026-06-30T12:00:00.000Z";
const cutoffMs = Date.parse(cutoffIso);

test("no cutoff means not revoked", () => {
  assert.equal(isSessionRevoked(cutoffMs, null), false);
  assert.equal(isSessionRevoked(cutoffMs, undefined), false);
});

test("session issued before the cutoff is revoked", () => {
  assert.equal(isSessionRevoked(cutoffMs - 1, cutoffIso), true);
});

test("session issued at or after the cutoff survives", () => {
  assert.equal(isSessionRevoked(cutoffMs, cutoffIso), false); // boundary: equal is valid
  assert.equal(isSessionRevoked(cutoffMs + 1, cutoffIso), false);
});

test("cutoff accepted as ISO string, epoch ms, and Date", () => {
  assert.equal(isSessionRevoked(cutoffMs - 1000, cutoffIso), true);
  assert.equal(isSessionRevoked(cutoffMs - 1000, cutoffMs), true);
  assert.equal(isSessionRevoked(cutoffMs - 1000, new Date(cutoffMs)), true);
});

test("unparseable non-null cutoff fails closed", () => {
  assert.equal(isSessionRevoked(cutoffMs, "not-a-date"), true);
});

test("recent reauthentication uses an inclusive five-minute boundary", () => {
  const nowMs = Date.parse("2026-08-07T12:00:00.000Z");
  assert.equal(
    isRecentReauthentication({ reauthenticatedAt: nowMs - 5 * 60_000 }, nowMs),
    true,
  );
  assert.equal(
    isRecentReauthentication(
      { reauthenticatedAt: nowMs - 5 * 60_000 - 1 },
      nowMs,
    ),
    false,
  );
  assert.equal(
    isRecentReauthentication({ reauthenticatedAt: nowMs + 1 }, nowMs),
    false,
  );
  assert.throws(
    () => requireRecentReauthentication({ reauthenticatedAt: null }, nowMs),
    /RECENT_REAUTHENTICATION_REQUIRED/,
  );
});

test("Supabase token expiry prefers expires_at and otherwise uses expires_in", () => {
  const nowMs = Date.parse("2026-08-03T12:00:00.000Z");
  assert.equal(
    resolveSupabaseAccessTokenExpiresAtMs(
      { expiresAtEpochSeconds: 1_800_000_000, expiresInSeconds: 3600 },
      nowMs,
    ),
    1_800_000_000_000,
  );
  assert.equal(
    resolveSupabaseAccessTokenExpiresAtMs({ expiresInSeconds: 3600 }, nowMs),
    nowMs + 3_600_000,
  );
  assert.equal(resolveSupabaseAccessTokenExpiresAtMs({}, nowMs), null);
});

test("Supabase access token freshness uses a proactive refresh skew", () => {
  const nowMs = Date.parse("2026-08-03T12:00:00.000Z");
  const tokens = buildAppSessionSupabaseTokens(
    {
      accessToken: "access-token",
      refreshToken: "refresh-token",
      expiresInSeconds: 3600,
    },
    nowMs,
  );

  assert.equal(isSupabaseAccessTokenFresh(tokens, nowMs), true);
  assert.equal(isSupabaseAccessTokenFresh(tokens, nowMs + 3_550_000), false);
  assert.equal(
    isSupabaseAccessTokenFresh(
      {
        accessToken: "access-token",
        refreshToken: null,
        accessTokenExpiresAtMs: null,
      },
      nowMs,
    ),
    false,
  );
});

test("encrypted app session roundtrip keeps optional Supabase tokens", () => {
  const previousSecret = process.env.APP_SESSION_SECRET;
  process.env.APP_SESSION_SECRET =
    "unit-test-app-session-secret-with-at-least-32-characters";
  const issuedAt = Date.parse("2026-08-03T12:00:00.000Z");

  try {
    const supabaseSession = buildAppSessionSupabaseTokens(
      {
        accessToken: "access-token",
        refreshToken: "refresh-token",
        expiresInSeconds: 3600,
      },
      issuedAt,
    );
    const session = createAppSessionPayload(
      {
        uid: "user-1",
        email: "teacher@example.test",
        fullName: "Teacher",
        supabaseSession,
      },
      issuedAt,
    );

    const roundtrip = unsealAppSession(
      sealAppSession(session),
      issuedAt + 1000,
    );
    assert.equal(roundtrip?.uid, "user-1");
    assert.deepEqual(roundtrip?.supabaseSession, supabaseSession);
    assert.equal(roundtrip?.iat, issuedAt);
    assert.equal(roundtrip?.exp, session.exp);
  } finally {
    if (previousSecret === undefined) {
      delete process.env.APP_SESSION_SECRET;
    } else {
      process.env.APP_SESSION_SECRET = previousSecret;
    }
  }
});

test("encrypted legacy-shaped session remains valid without Supabase tokens", () => {
  const previousSecret = process.env.APP_SESSION_SECRET;
  process.env.APP_SESSION_SECRET =
    "unit-test-app-session-secret-with-at-least-32-characters";
  const issuedAt = Date.parse("2026-08-03T12:00:00.000Z");

  try {
    const session = createAppSessionPayload({ uid: "legacy-user" }, issuedAt);
    delete session.supabaseSession;
    const roundtrip = unsealAppSession(
      sealAppSession(session),
      issuedAt + 1000,
    );

    assert.equal(roundtrip?.uid, "legacy-user");
    assert.equal(roundtrip?.supabaseSession, null);
  } finally {
    if (previousSecret === undefined) {
      delete process.env.APP_SESSION_SECRET;
    } else {
      process.env.APP_SESSION_SECRET = previousSecret;
    }
  }
});

test("app session strips synthetic internal auth email aliases", () => {
  const session = createAppSessionPayload({
    uid: "learner-user",
    email: "opaque@learners.shidao.internal",
  });

  assert.equal(session.email, null);
});

test("unsealing an older session also strips its synthetic auth email", () => {
  const previousSecret = process.env.APP_SESSION_SECRET;
  process.env.APP_SESSION_SECRET =
    "unit-test-app-session-secret-with-at-least-32-characters";
  const issuedAt = Date.parse("2026-08-03T12:00:00.000Z");

  try {
    const olderSession = createAppSessionPayload(
      { uid: "learner-user", email: "public@example.test" },
      issuedAt,
    );
    olderSession.email = "opaque@students.shidao.internal";

    const roundtrip = unsealAppSession(
      sealAppSession(olderSession),
      issuedAt + 1_000,
    );
    assert.equal(roundtrip?.email, null);
  } finally {
    if (previousSecret === undefined) {
      delete process.env.APP_SESSION_SECRET;
    } else {
      process.env.APP_SESSION_SECRET = previousSecret;
    }
  }
});
