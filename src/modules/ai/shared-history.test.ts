import assert from "node:assert/strict";
import test from "node:test";
import { sharedHistoryProvider } from "./shared-history";

const API_URL = "https://shidao-test.supabase.co";
const ANON_KEY = "test-anon-key";
const SERVICE_ROLE_KEY = "test-service-role-key";
const ACTOR_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const COURSE_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

test("no-consent shared-history projection parses as an empty optional context", async () => {
  const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const previousAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const previousServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const previousFetch = globalThis.fetch;

  process.env.NEXT_PUBLIC_SUPABASE_URL = API_URL;
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = ANON_KEY;
  process.env.SUPABASE_SERVICE_ROLE_KEY = SERVICE_ROLE_KEY;
  globalThis.fetch = (async (input, init) => {
    assert.equal(
      input,
      `${API_URL}/rest/v1/rpc/build_cross_provider_learner_context`,
    );
    assert.equal(init?.method, "POST");
    const headers = new Headers(init?.headers);
    assert.equal(headers.get("apikey"), SERVICE_ROLE_KEY);
    assert.equal(headers.get("authorization"), `Bearer ${SERVICE_ROLE_KEY}`);
    assert.deepEqual(JSON.parse(String(init?.body)), {
      p_actor_auth_user_id: ACTOR_ID,
      p_course_id: COURSE_ID,
    });
    return new Response(
      JSON.stringify({
        used: false,
        revision: "0".repeat(64),
        projectionVersion: 1,
        aggregates: {
          conductedCount: 0,
          presentCount: 0,
          absentCount: 0,
          repeatCount: 0,
          knownDurationCount: 0,
          actualDurationMinutes: 0,
          subjectBreakdown: [],
        },
        sharedCommentSummaries: [],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }) as typeof fetch;

  try {
    const projection = await sharedHistoryProvider.load(ACTOR_ID, COURSE_ID);
    assert.equal(projection.used, false);
    assert.equal(projection.revision, "0".repeat(64));
    assert.deepEqual(projection.sharedCommentSummaries, []);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl;
    if (previousAnonKey === undefined)
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = previousAnonKey;
    if (previousServiceRoleKey === undefined)
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = previousServiceRoleKey;
  }
});
