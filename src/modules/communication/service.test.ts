import assert from "node:assert/strict";
import test from "node:test";
import { CommunicationApplicationError, type InboxQuery } from "./contracts";
import type { CommunicationActor } from "./domain";
import {
  CommunicationRepositoryError,
  type CommunicationRepository,
} from "./repository";
import { createCommunicationService } from "./service";

const GUID_A = "00000000-0000-0000-0000-000000000001";
const GUID_B = "00000000-0000-0000-0000-000000000002";
const NOW = "2026-08-16T06:00:00.000Z";
const actor: CommunicationActor = { authUserId: GUID_A, accountId: GUID_B };
const emptyInboxQuery: InboxQuery = {
  cursorActivityAt: null,
  cursorKind: null,
  cursorId: null,
  limit: 30,
};

test("service validates the learner-domain direct target before repository access", async () => {
  let openedProfileId: string | null = null;
  const repository = {
    async openDirectThread(learnerProfileId: string) {
      openedProfileId = learnerProfileId;
      return {
        id: GUID_A,
        kind: "direct" as const,
        title: "Анна",
        courseId: null,
        directLearnerProfileId: learnerProfileId,
        preview: null,
        lastMessageId: null,
        lastActivityAt: NOW,
        unreadCount: 0,
        canSend: true,
      };
    },
  } as unknown as CommunicationRepository;
  const service = createCommunicationService({ repository });

  await service.openThread(actor, {
    kind: "direct",
    learnerProfileId: GUID_B,
  });
  assert.equal(openedProfileId, GUID_B);

  assert.throws(
    () =>
      service.openThread(actor, {
        kind: "direct",
        learnerProfileId: GUID_B,
        otherAccountId: GUID_A,
      }),
    (error: unknown) =>
      error instanceof CommunicationApplicationError && error.status === 400,
  );
});

test("bare inbox request reaches the repository with canonical query defaults", async () => {
  let received: InboxQuery | null = null;
  const repository = {
    async listInbox(input: InboxQuery) {
      received = input;
      return { items: [], nextCursor: null, totalUnread: 0 };
    },
  } as unknown as CommunicationRepository;
  const service = createCommunicationService({ repository });

  await service.listInbox(actor, {});

  assert.deepEqual(received, emptyInboxQuery);
});

test("assistant monthly quota aggregates persisted owner-scoped turns", async () => {
  const now = new Date();
  const currentMonth = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 2),
  ).toISOString();
  const priorMonth = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0),
  ).toISOString();
  let conversationQuery: unknown;
  let turnQuery: unknown;
  const replyPayload = (totalTokens: number) => ({
    replyToTurnId: 1,
    reply: {
      requestId: `request-${totalTokens}`,
      model: "test-model",
      provider: "test-provider",
      usage: {
        inputTokens: totalTokens,
        outputTokens: 0,
        totalTokens,
        cachedInputTokens: 0,
        reasoningTokens: 0,
      },
      proposedAction: null,
      quickReplies: [],
      sharedHistoryUsed: false,
    },
  });
  const repository = {
    async listAssistantConversations(query: unknown) {
      conversationQuery = query;
      return {
        items: [
          {
            id: GUID_A,
            title: "Архивный диалог тоже учитывается",
            contextCourseId: null,
            contextLessonId: null,
            lastTurnId: 4,
            lastActivityAt: currentMonth,
            unreadCount: 0,
            archivedAt: currentMonth,
            createdAt: priorMonth,
            updatedAt: currentMonth,
          },
        ],
      };
    },
    async listAssistantTurns(_conversationId: string, query: unknown) {
      turnQuery = query;
      return {
        items: [
          {
            id: 1,
            role: "assistant" as const,
            deliveryKind: "interactive" as const,
            body: "Старый ответ",
            payload: replyPayload(900_000),
            createdAt: priorMonth,
          },
          {
            id: 2,
            role: "user" as const,
            deliveryKind: "interactive" as const,
            body: "Сообщение",
            payload: {},
            createdAt: currentMonth,
          },
          {
            id: 3,
            role: "assistant" as const,
            deliveryKind: "interactive" as const,
            body: "Ответ",
            payload: replyPayload(500_000),
            createdAt: currentMonth,
          },
        ],
        nextCursor: null,
      };
    },
  } as unknown as CommunicationRepository;
  const service = createCommunicationService({ repository });

  const quota = await service.getAssistantMonthlyQuota(actor);
  assert.equal(quota.limitTokens, 2_000_000);
  assert.equal(quota.usedTokens, 500_000);
  assert.equal(quota.remainingTokens, 1_500_000);
  assert.deepEqual(conversationQuery, { includeArchived: true, limit: 50 });
  assert.deepEqual(turnQuery, { beforeTurnId: null, limit: 50 });
});

test("assistant monthly quota paginates turns, rejects malformed usage and clamps the remainder", async () => {
  const now = new Date();
  const periodStartedAt = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  );
  const beforePeriod = new Date(periodStartedAt.getTime() - 1).toISOString();
  const currentPeriod = periodStartedAt.toISOString();
  const turnQueries: unknown[] = [];
  const replyPayload = (totalTokens: number) => ({
    replyToTurnId: 1,
    reply: {
      requestId: `request-${totalTokens}`,
      model: "test-model",
      provider: "test-provider",
      usage: {
        inputTokens: totalTokens,
        outputTokens: 0,
        totalTokens,
        cachedInputTokens: 0,
        reasoningTokens: 0,
      },
      proposedAction: null,
      quickReplies: [],
      sharedHistoryUsed: false,
    },
  });
  const repository = {
    async listAssistantConversations() {
      return {
        items: [
          {
            id: GUID_A,
            title: "Много ответов",
            contextCourseId: null,
            contextLessonId: null,
            lastTurnId: 4,
            lastActivityAt: currentPeriod,
            unreadCount: 0,
            archivedAt: null,
            createdAt: beforePeriod,
            updatedAt: currentPeriod,
          },
        ],
      };
    },
    async listAssistantTurns(
      _conversationId: string,
      query: { beforeTurnId: number | null; limit: number },
    ) {
      turnQueries.push(query);
      if (query.beforeTurnId === null) {
        return {
          items: [
            {
              id: 3,
              role: "assistant" as const,
              deliveryKind: "interactive" as const,
              body: "Большой ответ",
              payload: replyPayload(1_700_000),
              createdAt: currentPeriod,
            },
            {
              id: 4,
              role: "assistant" as const,
              deliveryKind: "interactive" as const,
              body: "Некорректные metadata",
              payload: { reply: { usage: { totalTokens: 9_000_000 } } },
              createdAt: currentPeriod,
            },
          ],
          nextCursor: 3,
        };
      }
      return {
        items: [
          {
            id: 1,
            role: "assistant" as const,
            deliveryKind: "interactive" as const,
            body: "Прошлый месяц",
            payload: replyPayload(900_000),
            createdAt: beforePeriod,
          },
          {
            id: 2,
            role: "assistant" as const,
            deliveryKind: "interactive" as const,
            body: "Граница месяца",
            payload: replyPayload(500_000),
            createdAt: currentPeriod,
          },
        ],
        nextCursor: null,
      };
    },
  } as unknown as CommunicationRepository;
  const service = createCommunicationService({ repository });

  const quota = await service.getAssistantMonthlyQuota(actor);
  assert.equal(quota.usedTokens, 2_200_000);
  assert.equal(quota.remainingTokens, 0);
  assert.deepEqual(turnQueries, [
    { beforeTurnId: null, limit: 50 },
    { beforeTurnId: 3, limit: 50 },
  ]);
});

test("service maps repository auth, access, conflict and outage errors", async (t) => {
  const cases = [
    {
      repositoryError: new CommunicationRepositoryError("jwt_expired", 401),
      status: 401,
      code: "communication_reauthentication_required",
    },
    {
      repositoryError: new CommunicationRepositoryError(
        "communication_relation_required",
        403,
      ),
      status: 404,
      code: "communication_not_found",
    },
    {
      repositoryError: new CommunicationRepositoryError(
        "communication_thread_archived",
        409,
      ),
      status: 409,
      code: "communication_conflict",
    },
    {
      repositoryError: new CommunicationRepositoryError(
        "communication_network_error",
        503,
      ),
      status: 503,
      code: "communication_unavailable",
    },
  ] as const;

  for (const current of cases) {
    await t.test(current.code, async () => {
      const repository = {
        async listInbox() {
          throw current.repositoryError;
        },
      } as unknown as CommunicationRepository;
      const service = createCommunicationService({ repository });
      await assert.rejects(
        service.listInbox(actor, emptyInboxQuery),
        (error: unknown) =>
          error instanceof CommunicationApplicationError &&
          error.status === current.status &&
          error.code === current.code,
      );
    });
  }
});

test("archived assistant conversations cannot receive another user turn", async () => {
  const repository = {
    async getAssistantConversation() {
      return {
        id: GUID_A,
        title: "Архив",
        contextCourseId: null,
        contextLessonId: null,
        lastTurnId: null,
        lastActivityAt: NOW,
        unreadCount: 0,
        archivedAt: NOW,
        createdAt: NOW,
        updatedAt: NOW,
      };
    },
  } as unknown as CommunicationRepository;
  const service = createCommunicationService({ repository });

  await assert.rejects(
    service.getAssistantConversation(actor, GUID_A),
    (error: unknown) =>
      error instanceof CommunicationApplicationError &&
      error.status === 404 &&
      error.code === "assistant_conversation_not_found",
  );
});
