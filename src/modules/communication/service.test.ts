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
