import assert from "node:assert/strict";
import test from "node:test";
import type { AppSession, AppSessionSupabaseTokens } from "../app-session";
import {
  requireSupabaseUserAccessToken,
  SupabaseUserReauthenticationRequiredError,
} from "../supabase-user-session";

const nowMs = Date.parse("2026-08-03T12:00:00.000Z");

function sessionWith(
  supabaseSession: AppSessionSupabaseTokens | null,
): AppSession {
  return {
    v: 1,
    sid: "session-1",
    uid: "user-1",
    email: "teacher@example.test",
    fullName: "Teacher",
    recoveryVerifiedAt: null,
    supabaseSession,
    iat: nowMs - 1000,
    exp: nowMs + 3_600_000,
  };
}

test("returns a fresh user access token without refresh", async () => {
  let fetchCalled = false;
  const accessToken = await requireSupabaseUserAccessToken({
    now: () => nowMs,
    readSession: async () =>
      sessionWith({
        accessToken: "fresh-access",
        refreshToken: "refresh-token",
        accessTokenExpiresAtMs: nowMs + 3_600_000,
      }),
    fetcher: (async () => {
      fetchCalled = true;
      throw new Error("fetch should not be called");
    }) as typeof fetch,
  });

  assert.equal(accessToken, "fresh-access");
  assert.equal(fetchCalled, false);
});

test("refreshes an expired token, checks user identity, and rotates the cookie payload", async () => {
  const currentSession = sessionWith({
    accessToken: "expired-access",
    refreshToken: "old-refresh",
    accessTokenExpiresAtMs: nowMs - 1,
  });
  let rotated:
    { session: AppSession; tokens: AppSessionSupabaseTokens } | undefined;

  const accessToken = await requireSupabaseUserAccessToken({
    now: () => nowMs,
    readSession: async () => currentSession,
    getConfig: () => ({
      url: "https://supabase.example.test/",
      anonKey: "anon-key",
    }),
    fetcher: (async (input, init) => {
      assert.equal(
        input,
        "https://supabase.example.test/auth/v1/token?grant_type=refresh_token",
      );
      assert.equal(init?.method, "POST");
      const headers = new Headers(init?.headers);
      assert.equal(headers.get("apikey"), "anon-key");
      assert.equal(headers.get("authorization"), "Bearer anon-key");
      assert.deepEqual(JSON.parse(String(init?.body)), {
        refresh_token: "old-refresh",
      });
      return new Response(
        JSON.stringify({
          access_token: "new-access",
          refresh_token: "rotated-refresh",
          expires_in: 3600,
          user: { id: "user-1" },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }) as typeof fetch,
    rotateSession: async (session, tokens) => {
      rotated = { session, tokens };
    },
  });

  assert.equal(accessToken, "new-access");
  assert.equal(rotated?.session.sid, "session-1");
  assert.deepEqual(rotated?.tokens, {
    accessToken: "new-access",
    refreshToken: "rotated-refresh",
    accessTokenExpiresAtMs: nowMs + 3_600_000,
  });
});

test("keeps the previous refresh token when Supabase does not rotate it", async () => {
  const rotation: { tokens: AppSessionSupabaseTokens | null } = {
    tokens: null,
  };
  const accessToken = await requireSupabaseUserAccessToken({
    now: () => nowMs,
    readSession: async () =>
      sessionWith({
        accessToken: "expired-access",
        refreshToken: "existing-refresh",
        accessTokenExpiresAtMs: nowMs - 1,
      }),
    getConfig: () => ({
      url: "https://supabase.example.test",
      anonKey: "anon-key",
    }),
    fetcher: (async () =>
      new Response(
        JSON.stringify({
          access_token: "new-access",
          expires_at: Math.floor((nowMs + 3_600_000) / 1000),
          user: { id: "user-1" },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      )) as typeof fetch,
    rotateSession: async (_session, tokens) => {
      rotation.tokens = tokens;
    },
  });

  assert.equal(accessToken, "new-access");
  assert.equal(rotation.tokens?.refreshToken, "existing-refresh");
});

test("missing Supabase tokens raises the typed Courses re-authentication error", async () => {
  await assert.rejects(
    requireSupabaseUserAccessToken({
      now: () => nowMs,
      readSession: async () => sessionWith(null),
    }),
    SupabaseUserReauthenticationRequiredError,
  );
});

test("rejects a refreshed session for a different user", async () => {
  await assert.rejects(
    requireSupabaseUserAccessToken({
      now: () => nowMs,
      readSession: async () =>
        sessionWith({
          accessToken: null,
          refreshToken: "refresh-token",
          accessTokenExpiresAtMs: null,
        }),
      getConfig: () => ({
        url: "https://supabase.example.test",
        anonKey: "anon-key",
      }),
      fetcher: (async () =>
        new Response(
          JSON.stringify({
            access_token: "other-access",
            refresh_token: "other-refresh",
            expires_in: 3600,
            user: { id: "other-user" },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        )) as typeof fetch,
      rotateSession: async () => {
        throw new Error("must not rotate");
      },
    }),
    SupabaseUserReauthenticationRequiredError,
  );
});
