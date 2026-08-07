import assert from "node:assert/strict";
import test from "node:test";
import {
  camelizeRpcPayload,
  createLearnerIdentityRepository,
} from "./repository";

function configureRepository(t: test.TestContext) {
  const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const previousKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supabase.test";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-test";
  t.after(() => {
    if (previousUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl;
    if (previousKey === undefined)
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = previousKey;
  });
}

test("RPC response mapping recursively converts database keys without exposing raw rows", () => {
  assert.deepEqual(
    camelizeRpcPayload({
      next_cursor: "opaque",
      items: [{ occurred_at: "2026-08-07", shared_comment: null }],
    }),
    {
      nextCursor: "opaque",
      items: [{ occurredAt: "2026-08-07", sharedComment: null }],
    },
  );
});

test("authenticated relationship action sends only the narrow action contract", async (t) => {
  configureRepository(t);
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const repository = createLearnerIdentityRepository("user-jwt", {
    fetcher: async (input, init = {}) => {
      calls.push({ url: String(input), init });
      return Response.json({
        grants: [],
        invitations: [],
      });
    },
  });

  await repository.actOnObserverRelationship(
    "00000000-0000-4000-8000-000000000001",
    { action: "rename", relationshipLabel: "тренер" },
  );

  assert.equal(calls.length, 1);
  assert.match(calls[0]!.url, /act_on_learner_observer_relationship$/);
  const body = JSON.parse(String(calls[0]!.init.body)) as Record<
    string,
    unknown
  >;
  assert.deepEqual(body, {
    p_relationship_id: "00000000-0000-4000-8000-000000000001",
    p_action: "rename",
    p_relationship_label: "тренер",
  });
  assert.doesNotMatch(JSON.stringify(body), /token|email|secret|pin/i);
  assert.equal(
    new Headers(calls[0]!.init.headers).get("Authorization"),
    "Bearer user-jwt",
  );
});
