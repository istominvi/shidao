import assert from "node:assert/strict";
import test from "node:test";
import {
  createCommunicationRepository,
  CommunicationRepositoryError,
} from "./repository";
import type { CommunicationThread, InboxPage } from "./domain";

const GUID_A = "00000000-0000-0000-0000-000000000001";
const GUID_B = "00000000-0000-0000-0000-000000000002";
const NOW = "2026-08-16T06:00:00.000Z";

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

function directThread(): CommunicationThread {
  return {
    id: GUID_A,
    kind: "direct",
    title: "Анна",
    courseId: null,
    directLearnerProfileId: GUID_B,
    preview: null,
    lastMessageId: null,
    lastActivityAt: NOW,
    unreadCount: 0,
    canSend: true,
  };
}

function finalInboxPage(): InboxPage {
  return {
    items: [
      {
        id: "system",
        kind: "system",
        title: "ShiDao",
        preview: "Урок завершён",
        lastActivityAt: NOW,
        unreadCount: 1,
        pinned: true,
        lastNotificationId: 9,
      },
      {
        id: GUID_A,
        kind: "direct",
        title: "Анна",
        preview: "До встречи",
        lastActivityAt: NOW,
        unreadCount: 1,
        pinned: false,
        threadId: GUID_A,
        lastMessageId: 7,
        canSend: false,
        directLearnerProfileId: GUID_B,
      },
    ],
    nextCursor: null,
    totalUnread: 2,
  };
}

test("direct open uses learnerProfileId with the user JWT and sends no Account id", async (t) => {
  configureRepository(t);
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const repository = createCommunicationRepository("user-jwt", {
    fetcher: async (input, init = {}) => {
      calls.push({ url: String(input), init });
      return Response.json(directThread());
    },
  });

  assert.deepEqual(await repository.openDirectThread(GUID_B), directThread());
  assert.match(calls[0]!.url, /rpc\/open_direct_communication_thread$/);
  assert.equal(
    new Headers(calls[0]!.init.headers).get("Authorization"),
    "Bearer user-jwt",
  );
  const body = JSON.parse(String(calls[0]!.init.body)) as Record<
    string,
    unknown
  >;
  assert.deepEqual(body, { p_learner_profile_id: GUID_B });
  assert.doesNotMatch(JSON.stringify(body), /account|auth/i);
});

test("assistant conversation lookup uses its narrow owner-scoped RPC", async (t) => {
  configureRepository(t);
  let calledUrl = "";
  let calledBody: unknown;
  const conversation = {
    id: GUID_A,
    title: "План курса",
    contextCourseId: null,
    contextLessonId: null,
    lastTurnId: null,
    lastActivityAt: NOW,
    unreadCount: 0,
    archivedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
  };
  const repository = createCommunicationRepository("user-jwt", {
    fetcher: async (input, init = {}) => {
      calledUrl = String(input);
      calledBody = JSON.parse(String(init.body));
      return Response.json(conversation);
    },
  });

  assert.deepEqual(
    await repository.getAssistantConversation(GUID_A),
    conversation,
  );
  assert.match(calledUrl, /rpc\/get_my_assistant_conversation$/);
  assert.deepEqual(calledBody, { p_conversation_id: GUID_A });
});

test("inbox RPC mock preserves final cursors and send capability", async (t) => {
  configureRepository(t);
  let calledUrl = "";
  let calledBody: unknown;
  const page = finalInboxPage();
  const repository = createCommunicationRepository("user-jwt", {
    fetcher: async (input, init = {}) => {
      calledUrl = String(input);
      calledBody = JSON.parse(String(init.body));
      return Response.json(page);
    },
  });

  assert.deepEqual(
    await repository.listInbox({
      cursorActivityAt: null,
      cursorKind: null,
      cursorId: null,
      limit: 30,
    }),
    page,
  );
  assert.match(calledUrl, /rpc\/list_my_communication_inbox$/);
  assert.deepEqual(calledBody, {
    p_cursor_activity_at: null,
    p_cursor_kind: null,
    p_cursor_id: null,
    p_limit: 30,
  });
});

test("strict inbox RPC output rejects a pre-capability browser mock", async (t) => {
  configureRepository(t);
  const repository = createCommunicationRepository("user-jwt", {
    fetcher: async () =>
      Response.json({
        items: [
          {
            id: GUID_A,
            kind: "direct",
            title: "Анна",
            preview: null,
            lastActivityAt: NOW,
            unreadCount: 0,
            pinned: false,
            threadId: GUID_A,
            lastMessageId: null,
            directLearnerProfileId: GUID_B,
          },
        ],
        nextCursor: null,
        totalUnread: 0,
      }),
  });

  await assert.rejects(
    repository.listInbox({
      cursorActivityAt: null,
      cursorKind: null,
      cursorId: null,
      limit: 30,
    }),
    (error: unknown) =>
      error instanceof CommunicationRepositoryError &&
      error.status === 502 &&
      error.databaseCode === "communication_rpc_output_invalid",
  );
});

test("strict RPC outputs reject an undocumented sender Account id", async (t) => {
  configureRepository(t);
  const repository = createCommunicationRepository("user-jwt", {
    fetcher: async () =>
      Response.json({
        id: 1,
        threadId: GUID_A,
        senderLabel: "Анна",
        senderAccountId: GUID_B,
        body: "Сообщение",
        createdAt: NOW,
        isOwn: false,
      }),
  });

  await assert.rejects(
    repository.sendMessage(GUID_A, {
      clientMessageId: GUID_B,
      body: "Сообщение",
    }),
    (error: unknown) =>
      error instanceof CommunicationRepositoryError &&
      error.status === 502 &&
      error.databaseCode === "communication_rpc_output_invalid",
  );
});
