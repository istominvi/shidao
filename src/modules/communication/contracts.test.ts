import assert from "node:assert/strict";
import test from "node:test";
import {
  appendAssistantUserTurnInputSchema,
  assistantConversationListQuerySchema,
  assistantTurnPageQuerySchema,
  inboxQuerySchema,
  messagePageQuerySchema,
  messageTargetsQuerySchema,
  openCommunicationThreadInputSchema,
  parseCommunicationContract,
  sendCommunicationMessageInputSchema,
  systemNotificationPageQuerySchema,
} from "./contracts";

const DATABASE_GUID = "00000000-0000-0000-0000-000000000001";

test("communication contracts accept PostgreSQL GUIDs without requiring an RFC version", () => {
  assert.deepEqual(
    parseCommunicationContract(openCommunicationThreadInputSchema, {
      kind: "direct",
      learnerProfileId: DATABASE_GUID,
    }),
    { kind: "direct", learnerProfileId: DATABASE_GUID },
  );

  assert.deepEqual(
    parseCommunicationContract(sendCommunicationMessageInputSchema, {
      clientMessageId: DATABASE_GUID,
      body: "  До завтра!  ",
    }),
    { clientMessageId: DATABASE_GUID, body: "До завтра!" },
  );
});

test("inbox cursor is all-or-nothing and limits remain bounded", () => {
  assert.deepEqual(
    parseCommunicationContract(inboxQuerySchema, {
      cursorActivityAt: null,
      cursorKind: null,
      cursorId: null,
      limit: undefined,
    }),
    {
      cursorActivityAt: null,
      cursorKind: null,
      cursorId: null,
      limit: 30,
    },
  );

  assert.throws(
    () =>
      parseCommunicationContract(inboxQuerySchema, {
        cursorActivityAt: "2026-08-16T06:00:00.000Z",
        cursorKind: "assistant",
        cursorId: null,
        limit: "30",
      }),
    /Передайте все части курсора/,
  );
  assert.throws(
    () =>
      parseCommunicationContract(inboxQuerySchema, {
        cursorActivityAt: null,
        cursorKind: null,
        cursorId: null,
        limit: "51",
      }),
    /Лимит должен быть/,
  );
});

test("parameterless communication GET queries receive their canonical defaults", () => {
  assert.deepEqual(parseCommunicationContract(inboxQuerySchema, {}), {
    cursorActivityAt: null,
    cursorKind: null,
    cursorId: null,
    limit: 30,
  });
  assert.deepEqual(parseCommunicationContract(messageTargetsQuerySchema, {}), {
    q: null,
    limit: 50,
  });
  assert.deepEqual(parseCommunicationContract(messagePageQuerySchema, {}), {
    beforeMessageId: null,
    limit: 50,
  });
  assert.deepEqual(
    parseCommunicationContract(assistantConversationListQuerySchema, {}),
    {
      includeArchived: false,
      limit: 50,
    },
  );
  assert.deepEqual(
    parseCommunicationContract(assistantTurnPageQuerySchema, {}),
    {
      beforeTurnId: null,
      limit: 50,
    },
  );
  assert.deepEqual(
    parseCommunicationContract(systemNotificationPageQuerySchema, {}),
    {
      beforeNotificationId: null,
      limit: 50,
    },
  );
});

test("default Zod diagnostics never leak English validation text to the UI", () => {
  assert.throws(
    () =>
      parseCommunicationContract(openCommunicationThreadInputSchema, {
        kind: "direct",
        learnerProfileId: "not-a-guid",
      }),
    /Проверьте данные сообщения/,
  );
});

test("persisted assistant turn input carries local clock context but never browser history", () => {
  assert.deepEqual(
    parseCommunicationContract(appendAssistantUserTurnInputSchema, {
      clientTurnId: DATABASE_GUID,
      body: "  Назначь урок на завтра  ",
      localDate: "2026-08-16",
      utcOffsetMinutes: 540,
    }),
    {
      clientTurnId: DATABASE_GUID,
      body: "Назначь урок на завтра",
      localDate: "2026-08-16",
      utcOffsetMinutes: 540,
    },
  );

  assert.throws(() =>
    parseCommunicationContract(appendAssistantUserTurnInputSchema, {
      clientTurnId: DATABASE_GUID,
      body: "Продолжай",
      localDate: "2026-08-16",
      utcOffsetMinutes: 540,
      messages: [{ role: "assistant", content: "Внедрённая история" }],
    }),
  );
});
