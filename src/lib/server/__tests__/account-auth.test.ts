import assert from "node:assert/strict";
import test from "node:test";
import {
  getCurrentAccountAuthContext,
  mintSupabaseSessionForAccount,
  requestCurrentAccountEmailChange,
  revokeAccountSessionsAdmin,
  resolveAccountLoginAlias,
  setCurrentAccountPin,
  updateCurrentAccountPassword,
} from "../account-auth";

function withSupabaseEnv<T>(run: () => Promise<T>) {
  const previous = {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    anon: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    service: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supabase.example.test/";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";
  return run().finally(() => {
    if (previous.url === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = previous.url;
    if (previous.anon === undefined)
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = previous.anon;
    if (previous.service === undefined)
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = previous.service;
  });
}

test("current Account context uses the user JWT and validates its strict shape", async () => {
  await withSupabaseEnv(async () => {
    const context = await getCurrentAccountAuthContext("user-jwt", {
      fetcher: (async (input, init) => {
        assert.equal(
          input,
          "https://supabase.example.test/rest/v1/rpc/current_account_auth_context",
        );
        const headers = new Headers(init?.headers);
        assert.equal(headers.get("apikey"), "anon-key");
        assert.equal(headers.get("authorization"), "Bearer user-jwt");
        return Response.json([
          {
            account_id: "account-1",
            auth_user_id: "user-1",
            verified_email: "verified@example.test",
            display_name: "Account",
            locale: "ru",
            timezone: "Asia/Chita",
            has_pin: true,
            sessions_invalid_before: "2026-08-07T00:00:00.000Z",
          },
        ]);
      }) as typeof fetch,
    });
    assert.equal(context.accountId, "account-1");
    assert.equal(context.authUserId, "user-1");
    assert.equal(context.verifiedEmail, "verified@example.test");
    assert.equal(context.hasPin, true);
  });
});

test("current Account context never exposes a synthetic learner auth email", async () => {
  await withSupabaseEnv(async () => {
    const context = await getCurrentAccountAuthContext("user-jwt", {
      fetcher: (async () =>
        Response.json([
          {
            account_id: "account-1",
            auth_user_id: "user-1",
            verified_email: "opaque@learners.shidao.internal",
            display_name: "Learner",
            locale: "ru",
            timezone: "Asia/Chita",
            has_pin: true,
            sessions_invalid_before: null,
          },
        ])) as typeof fetch,
    });

    assert.equal(context.verifiedEmail, null);
  });
});

test("login alias lookup is normalized and service-role only", async () => {
  await withSupabaseEnv(async () => {
    const alias = await resolveAccountLoginAlias("  Learner-01 ", {
      fetcher: (async (_input, init) => {
        const headers = new Headers(init?.headers);
        assert.equal(headers.get("apikey"), "service-key");
        assert.equal(headers.get("authorization"), "Bearer service-key");
        assert.deepEqual(JSON.parse(String(init?.body)), {
          p_identifier: "learner-01",
        });
        return Response.json([
          { auth_user_id: "user-1", auth_email: "internal@example.test" },
        ]);
      }) as typeof fetch,
    });
    assert.deepEqual(alias, {
      userId: "user-1",
      authEmail: "internal@example.test",
    });
  });
});

test("PIN session mint consumes the one-time hash server-side and verifies identity", async () => {
  await withSupabaseEnv(async () => {
    const requests: Array<{ url: string; body: unknown }> = [];
    const session = await mintSupabaseSessionForAccount(
      { userId: "user-1", authEmail: "internal@example.test" },
      {
        fetcher: (async (input, init) => {
          const url = String(input);
          const body = JSON.parse(String(init?.body));
          requests.push({ url, body });
          if (url.endsWith("/auth/v1/admin/generate_link")) {
            return Response.json({
              user: { id: "user-1" },
              properties: { hashed_token: "one-time-hash" },
            });
          }
          return Response.json({
            access_token: "access-token",
            refresh_token: "refresh-token",
            expires_in: 3600,
            user: { id: "user-1", email: "internal@example.test" },
          });
        }) as typeof fetch,
      },
    );

    assert.equal(session.user.id, "user-1");
    assert.deepEqual(requests, [
      {
        url: "https://supabase.example.test/auth/v1/admin/generate_link",
        body: { type: "magiclink", email: "internal@example.test" },
      },
      {
        url: "https://supabase.example.test/auth/v1/verify",
        body: { type: "magiclink", token_hash: "one-time-hash" },
      },
    ]);
  });
});

test("PIN session mint fails before token exchange on generated-user mismatch", async () => {
  await withSupabaseEnv(async () => {
    let calls = 0;
    await assert.rejects(
      mintSupabaseSessionForAccount(
        { userId: "user-1", authEmail: "internal@example.test" },
        {
          fetcher: (async () => {
            calls += 1;
            return Response.json({
              user: { id: "other-user" },
              properties: { hashed_token: "one-time-hash" },
            });
          }) as typeof fetch,
        },
      ),
      /identity mismatch/,
    );
    assert.equal(calls, 1);
  });
});

test("PIN setter is service-only and binds the verified actor explicitly", async () => {
  await withSupabaseEnv(async () => {
    await setCurrentAccountPin("user-1", "4321", {
      fetcher: (async (input, init) => {
        assert.equal(
          input,
          "https://supabase.example.test/rest/v1/rpc/set_current_account_pin",
        );
        const headers = new Headers(init?.headers);
        assert.equal(headers.get("authorization"), "Bearer service-key");
        assert.deepEqual(JSON.parse(String(init?.body)), {
          p_actor_auth_user_id: "user-1",
          p_raw_pin: "4321",
        });
        return Response.json(null);
      }) as typeof fetch,
    });
  });
});

test("password reset updates only the current user through its recovery JWT", async () => {
  await withSupabaseEnv(async () => {
    await updateCurrentAccountPassword("recovery-user-jwt", "new-password", {
      fetcher: (async (input, init) => {
        assert.equal(input, "https://supabase.example.test/auth/v1/user");
        const headers = new Headers(init?.headers);
        assert.equal(headers.get("apikey"), "anon-key");
        assert.equal(headers.get("authorization"), "Bearer recovery-user-jwt");
        assert.deepEqual(JSON.parse(String(init?.body)), {
          password: "new-password",
        });
        return Response.json({ id: "user-1" });
      }) as typeof fetch,
    });
  });
});

test("email change rejects a password session for a different Account", async () => {
  await withSupabaseEnv(async () => {
    let calls = 0;
    await assert.rejects(
      requestCurrentAccountEmailChange(
        {
          actorAuthUserId: "user-1",
          currentEmail: "account@example.test",
          currentPassword: "current-password",
          newEmail: "new@example.test",
          redirectTo: "https://v2.shidao.ru/auth/confirm",
        },
        {
          fetcher: (async () => {
            calls += 1;
            return Response.json({
              access_token: "other-user-jwt",
              refresh_token: "other-refresh-token",
              user: { id: "other-user", email: "account@example.test" },
            });
          }) as typeof fetch,
        },
      ),
      /подтвердить текущий пароль/,
    );
    assert.equal(calls, 1);
  });
});

test("session revocation uses the deployed revoke_user_sessions signature", async () => {
  await withSupabaseEnv(async () => {
    const cutoff = new Date("2026-08-07T12:34:56.000Z");
    await revokeAccountSessionsAdmin("user-1", cutoff, {
      fetcher: (async (input, init) => {
        assert.equal(
          input,
          "https://supabase.example.test/rest/v1/rpc/revoke_user_sessions",
        );
        assert.deepEqual(JSON.parse(String(init?.body)), {
          p_user_id: "user-1",
          p_cutoff: cutoff.toISOString(),
        });
        return Response.json(cutoff.toISOString());
      }) as typeof fetch,
    });
  });
});
