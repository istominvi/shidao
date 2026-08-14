import assert from "node:assert/strict";
import test from "node:test";
import {
  createProfileAvatarStoragePath,
  deleteProfileAvatarObject,
  downloadProfileAvatarObject,
  isOwnProfileAvatarStoragePath,
  PROFILE_AVATAR_BUCKET,
  uploadProfileAvatarObject,
} from "../profile-avatar-storage";

const ACCOUNT_ID = "22222222-2222-4222-8222-22222222222a";
const OTHER_ACCOUNT_ID = "33333333-3333-4333-8333-33333333333b";
const OBJECT_ID = "44444444-4444-4444-8444-44444444444c";
const OBJECT_PATH = `${ACCOUNT_ID}/${OBJECT_ID}.webp`;

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

test("profile avatar paths are canonical, account-owned WebP objects", () => {
  assert.equal(PROFILE_AVATAR_BUCKET, "profile-avatars");
  assert.equal(
    createProfileAvatarStoragePath(ACCOUNT_ID, OBJECT_ID),
    OBJECT_PATH,
  );
  assert.equal(isOwnProfileAvatarStoragePath(OBJECT_PATH, ACCOUNT_ID), true);

  for (const path of [
    `${OTHER_ACCOUNT_ID}/${OBJECT_ID}.webp`,
    `${ACCOUNT_ID}/../${OBJECT_ID}.webp`,
    `${ACCOUNT_ID}/${OBJECT_ID}.png`,
    `${ACCOUNT_ID}/not-a-v4-uuid.webp`,
    `${ACCOUNT_ID.toUpperCase()}/${OBJECT_ID}.webp`,
  ]) {
    assert.equal(
      isOwnProfileAvatarStoragePath(path, ACCOUNT_ID),
      false,
      `unexpectedly accepted ${path}`,
    );
  }
});

test("profile avatar Storage uses server-only service credentials", async () => {
  await withSupabaseEnv(async () => {
    const bytes = new Uint8Array([0x52, 0x49, 0x46, 0x46]);
    let uploadCalls = 0;
    await uploadProfileAvatarObject(
      {
        accountId: ACCOUNT_ID,
        path: OBJECT_PATH,
        bytes,
      },
      {
        fetcher: (async (input, init) => {
          uploadCalls += 1;
          assert.equal(
            input,
            `https://supabase.example.test/storage/v1/object/${PROFILE_AVATAR_BUCKET}/${OBJECT_PATH}`,
          );
          assert.equal(init?.method, "POST");
          const headers = new Headers(init?.headers);
          assert.equal(headers.get("apikey"), "service-key");
          assert.equal(headers.get("authorization"), "Bearer service-key");
          assert.equal(headers.get("content-type"), "image/webp");
          assert.equal(headers.get("x-upsert"), "false");
          assert.deepEqual(new Uint8Array(init?.body as ArrayBuffer), bytes);
          return new Response(null, { status: 200 });
        }) as typeof fetch,
      },
    );
    assert.equal(uploadCalls, 1);

    const downloaded = await downloadProfileAvatarObject(
      {
        accountId: ACCOUNT_ID,
        path: OBJECT_PATH,
      },
      {
        fetcher: (async (input, init) => {
          assert.equal(
            input,
            `https://supabase.example.test/storage/v1/object/authenticated/${PROFILE_AVATAR_BUCKET}/${OBJECT_PATH}`,
          );
          assert.equal(init?.method, undefined);
          const headers = new Headers(init?.headers);
          assert.equal(headers.get("apikey"), "service-key");
          assert.equal(headers.get("authorization"), "Bearer service-key");
          return new Response(bytes.buffer, {
            status: 200,
            headers: { "Content-Type": "image/webp" },
          });
        }) as typeof fetch,
      },
    );
    assert.deepEqual(downloaded, bytes);
  });
});

test("profile avatar Storage rejects cross-account mutations before fetch", async () => {
  await withSupabaseEnv(async () => {
    let fetchCalls = 0;
    const fetcher = (async () => {
      fetchCalls += 1;
      return new Response(null, { status: 200 });
    }) as typeof fetch;

    await assert.rejects(
      uploadProfileAvatarObject(
        {
          accountId: OTHER_ACCOUNT_ID,
          path: OBJECT_PATH,
          bytes: new Uint8Array([1]),
        },
        { fetcher },
      ),
      /path is invalid/i,
    );
    await assert.rejects(
      deleteProfileAvatarObject(
        {
          accountId: OTHER_ACCOUNT_ID,
          path: OBJECT_PATH,
        },
        { fetcher },
      ),
      /path is invalid/i,
    );
    assert.equal(fetchCalls, 0);
  });
});

test("profile avatar deletion is exact and Storage errors stay redacted", async () => {
  await withSupabaseEnv(async () => {
    await deleteProfileAvatarObject(
      {
        accountId: ACCOUNT_ID,
        path: OBJECT_PATH,
      },
      {
        fetcher: (async (input, init) => {
          assert.equal(
            input,
            `https://supabase.example.test/storage/v1/object/${PROFILE_AVATAR_BUCKET}`,
          );
          assert.equal(init?.method, "DELETE");
          assert.deepEqual(JSON.parse(String(init?.body)), {
            prefixes: [OBJECT_PATH],
          });
          return new Response(null, { status: 200 });
        }) as typeof fetch,
      },
    );

    await assert.rejects(
      downloadProfileAvatarObject(
        {
          accountId: ACCOUNT_ID,
          path: OBJECT_PATH,
        },
        {
          fetcher: (async () =>
            Response.json(
              { message: "must-not-be-reflected" },
              { status: 403 },
            )) as typeof fetch,
        },
      ),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.match(error.message, /download failed \(403\)/);
        assert.doesNotMatch(error.message, /must-not-be-reflected/);
        assert.doesNotMatch(error.message, /service-key/);
        return true;
      },
    );
  });
});

test("profile avatar download rejects an oversized stored object before buffering", async () => {
  await withSupabaseEnv(async () => {
    await assert.rejects(
      downloadProfileAvatarObject(
        {
          accountId: ACCOUNT_ID,
          path: OBJECT_PATH,
        },
        {
          fetcher: (async () =>
            new Response(new Uint8Array([1]), {
              headers: {
                "Content-Length": String(1024 * 1024 + 1),
                "Content-Type": "image/webp",
              },
            })) as typeof fetch,
        },
      ),
      /stored profile avatar is invalid/i,
    );
  });
});
