import assert from "node:assert/strict";
import test from "node:test";
import { assertCourseAssetObjectExists } from "./storage";

const API_URL = "https://shidao-test.supabase.co";
const ANON_KEY = "test-anon-key";
const ACCESS_TOKEN = "test-access-token";

async function withObjectInfoResponse(
  payload: unknown,
  run: () => Promise<void>,
) {
  const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const previousAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const previousFetch = globalThis.fetch;

  process.env.NEXT_PUBLIC_SUPABASE_URL = API_URL;
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = ANON_KEY;
  globalThis.fetch = (async (input, init) => {
    assert.equal(
      input,
      `${API_URL}/storage/v1/object/info/course-assets/account-id/courses/course-id/file.pdf`,
    );
    const headers = new Headers(init?.headers);
    assert.equal(headers.get("apikey"), ANON_KEY);
    assert.equal(headers.get("authorization"), `Bearer ${ACCESS_TOKEN}`);
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;

  try {
    await run();
  } finally {
    globalThis.fetch = previousFetch;
    if (previousUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl;
    if (previousAnonKey === undefined)
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = previousAnonKey;
  }
}

function assertObject() {
  return assertCourseAssetObjectExists({
    accessToken: ACCESS_TOKEN,
    bucket: "course-assets",
    path: "account-id/courses/course-id/file.pdf",
    expectedSizeBytes: 2048,
    expectedMimeType: "application/pdf",
  });
}

test("object verification reads current top-level Supabase Storage info", async () => {
  await withObjectInfoResponse(
    {
      size: 2048,
      content_type: "application/pdf",
      metadata: { source: "user-metadata" },
    },
    assertObject,
  );
});

test("object verification supports the legacy nested metadata shape", async () => {
  await withObjectInfoResponse(
    { metadata: { size: 2048, mimetype: "application/pdf" } },
    assertObject,
  );
});

test("object verification fails closed when Storage omits size or MIME", async () => {
  await withObjectInfoResponse({ size: 2048 }, async () => {
    await assert.rejects(assertObject(), /не вернул размер и MIME type/);
  });
});

test("object verification rejects a different object size", async () => {
  await withObjectInfoResponse(
    { size: 1024, content_type: "application/pdf" },
    async () => {
      await assert.rejects(assertObject(), /Размер загруженного файла/);
    },
  );
});

test("object verification rejects a different object MIME type", async () => {
  await withObjectInfoResponse(
    { size: 2048, content_type: "text/plain" },
    async () => {
      await assert.rejects(assertObject(), /MIME type загруженного файла/);
    },
  );
});
