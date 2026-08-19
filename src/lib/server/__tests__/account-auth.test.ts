import assert from "node:assert/strict";
import test from "node:test";
import {
  AccountAvatarRevisionConflictError,
  getCurrentAccountAuthContext,
  mintSupabaseSessionForAccount,
  requestCurrentAccountEmailChange,
  revokeAccountSessionsAdmin,
  resolveAccountLoginAlias,
  setCurrentAccountPin,
  setCurrentAccountAvatar,
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
            can_author_educator_courses: true,
            sessions_invalid_before: "2026-08-07T00:00:00.000Z",
            avatar_kind: "preset",
            avatar_preset_key: "sd-avatar-v1-01",
            avatar_storage_path: null,
            avatar_revision: 1,
            avatar_updated_at: "2026-08-14T00:00:00.000Z",
          },
        ]);
      }) as typeof fetch,
    });
    assert.equal(context.accountId, "account-1");
    assert.equal(context.authUserId, "user-1");
    assert.equal(context.verifiedEmail, "verified@example.test");
    assert.equal(context.hasPin, true);
    assert.equal(context.canAuthorEducatorCourses, true);
    assert.deepEqual(context.avatar, {
      kind: "preset",
      presetKey: "sd-avatar-v1-01",
      storagePath: null,
      revision: 1,
      updatedAt: "2026-08-14T00:00:00.000Z",
    });
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
            can_author_educator_courses: false,
            sessions_invalid_before: null,
            avatar_kind: "preset",
            avatar_preset_key: "sd-avatar-v1-02",
            avatar_storage_path: null,
            avatar_revision: 1,
            avatar_updated_at: "2026-08-14T00:00:00.000Z",
          },
        ])) as typeof fetch,
    });

    assert.equal(context.verifiedEmail, null);
  });
});

test("current Account context rejects a custom avatar outside its Account folder", async () => {
  await withSupabaseEnv(async () => {
    await assert.rejects(
      getCurrentAccountAuthContext("user-jwt", {
        fetcher: (async () =>
          Response.json([
            {
              account_id: "22222222-2222-4222-8222-222222222222",
              auth_user_id: "user-1",
              verified_email: "account@example.test",
              display_name: "Account",
              locale: "ru",
              timezone: "Asia/Chita",
              has_pin: false,
              can_author_educator_courses: false,
              sessions_invalid_before: null,
              avatar_kind: "custom",
              avatar_preset_key: null,
              avatar_storage_path:
                "99999999-9999-4999-8999-999999999999/33333333-3333-4333-8333-333333333333.webp",
              avatar_revision: 1,
              avatar_updated_at: "2026-08-14T00:00:00.000Z",
            },
          ])) as typeof fetch,
      }),
      /avatar context is invalid/,
    );
  });
});

test("avatar setter uses service credentials, an explicit actor and a public-safe result", async () => {
  await withSupabaseEnv(async () => {
    const accountId = "22222222-2222-4222-8222-222222222222";
    const actorAuthUserId = "11111111-1111-4111-8111-111111111111";
    const result = await setCurrentAccountAvatar(
      {
        accountId,
        actorAuthUserId,
        expectedRevision: 4,
        kind: "preset",
        presetKey: "sd-avatar-v1-20",
      },
      {
        fetcher: (async (input, init) => {
          assert.equal(
            input,
            "https://supabase.example.test/rest/v1/rpc/set_current_account_avatar",
          );
          const headers = new Headers(init?.headers);
          assert.equal(headers.get("apikey"), "service-key");
          assert.equal(headers.get("authorization"), "Bearer service-key");
          assert.deepEqual(JSON.parse(String(init?.body)), {
            p_actor_auth_user_id: actorAuthUserId,
            p_avatar_kind: "preset",
            p_avatar_preset_key: "sd-avatar-v1-20",
            p_avatar_storage_path: null,
            p_expected_revision: 4,
          });
          return Response.json([
            {
              avatar_kind: "preset",
              avatar_preset_key: "sd-avatar-v1-20",
              avatar_revision: 5,
              avatar_updated_at: "2026-08-14T01:00:00.000Z",
              previous_storage_path: `${accountId}/33333333-3333-4333-8333-333333333333.webp`,
            },
          ]);
        }) as typeof fetch,
      },
    );

    assert.deepEqual(result, {
      avatar: {
        kind: "preset",
        presetKey: "sd-avatar-v1-20",
        revision: 5,
        updatedAt: "2026-08-14T01:00:00.000Z",
      },
      previousStoragePath: `${accountId}/33333333-3333-4333-8333-333333333333.webp`,
    });
  });
});

test("avatar setter maps SQL serialization failures to a revision conflict", async () => {
  await withSupabaseEnv(async () => {
    await assert.rejects(
      setCurrentAccountAvatar(
        {
          accountId: "22222222-2222-4222-8222-222222222222",
          actorAuthUserId: "11111111-1111-4111-8111-111111111111",
          expectedRevision: 4,
          kind: "preset",
          presetKey: "sd-avatar-v1-01",
        },
        {
          fetcher: (async () =>
            Response.json(
              { code: "40001", message: "do not echo this response" },
              { status: 409 },
            )) as typeof fetch,
        },
      ),
      AccountAvatarRevisionConflictError,
    );
  });
});

test("avatar setter errors never reflect service credentials or provider bodies", async () => {
  await withSupabaseEnv(async () => {
    await assert.rejects(
      setCurrentAccountAvatar(
        {
          accountId: "22222222-2222-4222-8222-222222222222",
          actorAuthUserId: "11111111-1111-4111-8111-111111111111",
          expectedRevision: 4,
          kind: "preset",
          presetKey: "sd-avatar-v1-01",
        },
        {
          fetcher: (async () =>
            Response.json(
              { code: "XX000", message: "provider-secret-response" },
              { status: 500 },
            )) as typeof fetch,
        },
      ),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.match(
          error.message,
          /set_current_account_avatar failed \(500\)/,
        );
        assert.doesNotMatch(
          error.message,
          /service-key|provider-secret-response/,
        );
        return true;
      },
    );
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
      authUserId: "user-1",
      authEmail: "internal@example.test",
    });
  });
});

test("PIN session mint consumes the one-time hash server-side and verifies identity", async () => {
  await withSupabaseEnv(async () => {
    const requests: Array<{ url: string; body: unknown }> = [];
    const session = await mintSupabaseSessionForAccount(
      { authUserId: "user-1", authEmail: "internal@example.test" },
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
        { authUserId: "user-1", authEmail: "internal@example.test" },
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
