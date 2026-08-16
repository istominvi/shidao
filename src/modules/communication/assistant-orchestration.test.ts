import assert from "node:assert/strict";
import test from "node:test";
import type { SystemAssistantReply } from "@/modules/ai/system-assistant-contracts";
import type { CommunicationApplicationService } from "./service";
import type {
  AssistantConversation,
  AssistantTurn,
  CommunicationActor,
} from "./domain";
import {
  boundedAssistantHistory,
  runPersistedAssistantExchange,
} from "./assistant-orchestration";

const GUID_A = "00000000-0000-4000-8000-000000000001";
const GUID_B = "00000000-0000-4000-8000-000000000002";
const GUID_C = "00000000-0000-4000-8000-000000000003";
const NOW = "2026-08-16T06:00:00.000Z";

const actor: CommunicationActor = { authUserId: GUID_A, accountId: GUID_B };
const conversation: AssistantConversation = {
  id: GUID_C,
  title: "Урок завтра",
  contextCourseId: GUID_A,
  contextLessonId: GUID_B,
  lastTurnId: null,
  lastActivityAt: NOW,
  unreadCount: 0,
  archivedAt: null,
  createdAt: NOW,
  updatedAt: NOW,
};
const userTurn: AssistantTurn = {
  id: 7,
  role: "user",
  deliveryKind: "interactive",
  body: "Назначь этот урок на завтра",
  payload: {},
  createdAt: NOW,
};
const providerReply: SystemAssistantReply = {
  requestId: "router-request",
  model: "test-model",
  provider: "test-provider",
  usage: {
    inputTokens: 10,
    outputTokens: 5,
    totalTokens: 15,
    cachedInputTokens: 0,
    reasoningTokens: 0,
  },
  message: { role: "assistant", content: "Подготовил назначение." },
  proposedAction: null,
  quickReplies: [{ label: "Хорошо", message: "Покажи расписание" }],
  sharedHistoryUsed: true,
};

function fakeService(turns: AssistantTurn[]) {
  return {
    async getAssistantConversation() {
      return conversation;
    },
    async appendAssistantUserTurn() {
      return userTurn;
    },
    async listAssistantTurns() {
      return { items: turns, nextCursor: null };
    },
  } as unknown as CommunicationApplicationService;
}

test("assistant exchange uses persisted history and loads the admin writer only after provider success", async () => {
  const events: string[] = [];
  let persistedPayload: Record<string, unknown> | null = null;

  const exchange = await runPersistedAssistantExchange(
    {
      actor,
      service: fakeService([
        {
          id: 6,
          role: "assistant",
          deliveryKind: "interactive",
          body: "Какой урок?",
          payload: {},
          createdAt: NOW,
        },
        userTurn,
      ]),
      async chat(request) {
        events.push("provider");
        assert.deepEqual(request.page, {
          surface: "lesson",
          view: "lesson_plan",
          courseId: GUID_A,
          lessonId: GUID_B,
          localDate: "2026-08-16",
          utcOffsetMinutes: 540,
        });
        assert.deepEqual(request.messages, [
          { role: "assistant", content: "Какой урок?" },
          { role: "user", content: userTurn.body },
        ]);
        return providerReply;
      },
      async loadAdminAppender() {
        events.push("admin-import");
        return {
          async appendAssistantTurn(input) {
            events.push("admin-append");
            assert.equal(input.ownerAccountId, actor.accountId);
            assert.equal(input.sourceKey, "interactive:user-turn:7");
            persistedPayload = input.payload;
            return {
              id: 8,
              role: "assistant",
              deliveryKind: "interactive",
              body: input.body,
              payload: input.payload,
              createdAt: NOW,
            };
          },
        };
      },
    },
    conversation.id,
    {
      clientTurnId: GUID_C,
      body: userTurn.body,
      localDate: "2026-08-16",
      utcOffsetMinutes: 540,
    },
  );

  assert.deepEqual(events, ["provider", "admin-import", "admin-append"]);
  assert.equal(exchange.userTurn.id, 7);
  assert.equal(exchange.assistantTurn.id, 8);
  assert.deepEqual(exchange.quickReplies, providerReply.quickReplies);
  assert.deepEqual(
    (persistedPayload as unknown as { replyToTurnId: number }).replyToTurnId,
    7,
  );
});

test("retry reuses the persisted assistant turn without another provider call", async () => {
  const persistedPayload = {
    replyToTurnId: userTurn.id,
    reply: {
      requestId: providerReply.requestId,
      model: providerReply.model,
      provider: providerReply.provider,
      usage: providerReply.usage,
      proposedAction: null,
      quickReplies: providerReply.quickReplies,
      sharedHistoryUsed: providerReply.sharedHistoryUsed,
    },
  };
  const assistantTurn: AssistantTurn = {
    id: 8,
    role: "assistant",
    deliveryKind: "interactive",
    body: providerReply.message.content,
    payload: persistedPayload,
    createdAt: NOW,
  };

  const exchange = await runPersistedAssistantExchange(
    {
      actor,
      service: fakeService([assistantTurn, userTurn]),
      async chat() {
        throw new Error("provider must not be called on an idempotent retry");
      },
      async loadAdminAppender() {
        throw new Error(
          "admin writer must not be loaded on an idempotent retry",
        );
      },
    },
    conversation.id,
    {
      clientTurnId: GUID_C,
      body: userTurn.body,
      localDate: "2026-08-16",
      utcOffsetMinutes: 540,
    },
  );

  assert.equal(exchange.assistantTurn.id, assistantTurn.id);
  assert.deepEqual(exchange.usage, providerReply.usage);
});

test("assistant history is a contiguous bounded suffix ending at the user turn", () => {
  const turns: AssistantTurn[] = Array.from({ length: 20 }, (_, index) => ({
    id: index + 1,
    role: index % 2 === 0 ? "user" : "assistant",
    deliveryKind: "interactive",
    body: `turn-${index + 1}`,
    payload: {},
    createdAt: NOW,
  }));
  const history = boundedAssistantHistory(turns, 19);
  assert.equal(history.length, 16);
  assert.equal(history[0]?.content, "turn-4");
  assert.deepEqual(history.at(-1), { role: "user", content: "turn-19" });
});
