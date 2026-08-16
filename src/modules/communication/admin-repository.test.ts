import assert from "node:assert/strict";
import test from "node:test";
import { createCommunicationAdminRepository } from "./admin-repository";

const GUID_A = "00000000-0000-0000-0000-000000000001";
const GUID_B = "00000000-0000-0000-0000-000000000002";
const NOW = "2026-08-16T06:00:00.000Z";

function configureRepository(t: test.TestContext) {
  const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const previousAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const previousServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supabase.test";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-test";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-test";
  t.after(() => {
    if (previousUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl;
    if (previousAnonKey === undefined)
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = previousAnonKey;
    if (previousServiceKey === undefined)
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = previousServiceKey;
  });
}

test("assistant producer uses only the service-role RPC after its safe payload boundary", async (t) => {
  configureRepository(t);
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const repository = createCommunicationAdminRepository({
    fetcher: async (input, init = {}) => {
      calls.push({ url: String(input), init });
      const args = JSON.parse(String(init.body)) as Record<string, unknown>;
      return Response.json({
        id: 8,
        role: "assistant",
        deliveryKind: "interactive",
        body: args.p_body,
        payload: args.p_payload,
        createdAt: NOW,
      });
    },
  });

  const turn = await repository.appendAssistantTurn({
    ownerAccountId: GUID_A,
    conversationId: GUID_B,
    body: "Готово",
    payload: { summary: "я".repeat(20_000) },
    deliveryKind: "interactive",
    sourceKey: "interactive:user-turn:7",
  });

  assert.equal(turn.id, 8);
  assert.match(calls[0]!.url, /rpc\/append_assistant_turn_admin$/);
  const headers = new Headers(calls[0]!.init.headers);
  assert.equal(headers.get("Authorization"), "Bearer service-role-test");
  assert.equal(headers.get("apikey"), "service-role-test");
  assert.doesNotMatch(String(calls[0]!.init.body), /authUserId|accessToken/);
});

test("system producer accepts action-required severity but rejects sensitive payload keys", async (t) => {
  configureRepository(t);
  const repository = createCommunicationAdminRepository({
    fetcher: async (_input, init = {}) => {
      const args = JSON.parse(String(init.body)) as Record<string, unknown>;
      return Response.json({
        id: 9,
        eventType: args.p_event_type,
        severity: args.p_severity,
        title: args.p_title,
        body: args.p_body,
        payload: args.p_payload,
        occurredAt: args.p_occurred_at,
        readAt: null,
      });
    },
  });

  const notification = await repository.appendSystemNotification({
    recipientAccountId: GUID_A,
    eventType: "course.action_required",
    severity: "action_required",
    title: "Нужно подтвердить действие",
    body: "Откройте курс.",
    payload: { href: "/courses/example" },
    dedupeKey: "course:example:action",
    occurredAt: NOW,
  });
  assert.equal(notification.severity, "action_required");

  await assert.rejects(
    repository.appendSystemNotification({
      recipientAccountId: GUID_A,
      eventType: "course.secret",
      severity: "warning",
      title: "Небезопасно",
      body: "Не должно сохраниться.",
      payload: { accessToken: "secret" },
      dedupeKey: "course:secret",
      occurredAt: NOW,
    }),
  );
});
