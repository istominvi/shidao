import assert from "node:assert/strict";
import test from "node:test";
import {
  assistantCommunicationPayloadSchema,
  assistantMonthlyQuotaSchema,
  communicationMessageSchema,
  communicationThreadSchema,
  cursorPageSchema,
  inboxPageSchema,
  inboxItemSchema,
  persistedAssistantReplyPayloadSchema,
  systemCommunicationPayloadSchema,
  systemNotificationSchema,
} from "./output-contracts";

const GUID_A = "00000000-0000-0000-0000-000000000001";
const GUID_B = "00000000-0000-0000-0000-000000000002";
const NOW = "2026-08-16T06:00:00.000Z";

test("assistant monthly quota is exact, bounded, and internally consistent", () => {
  const quota = {
    periodStartedAt: "2026-08-01T00:00:00.000Z",
    resetsAt: "2026-09-01T00:00:00.000Z",
    limitTokens: 2_000_000,
    usedTokens: 500_000,
    remainingTokens: 1_500_000,
  };

  assert.equal(assistantMonthlyQuotaSchema.safeParse(quota).success, true);
  assert.equal(
    assistantMonthlyQuotaSchema.safeParse({
      ...quota,
      remainingTokens: 1_499_999,
    }).success,
    false,
  );
  assert.equal(
    assistantMonthlyQuotaSchema.safeParse({
      ...quota,
      periodStartedAt: quota.resetsAt,
    }).success,
    false,
  );
});

test("human DTOs expose labels and learner-domain ids, never Account/Auth ids", () => {
  const direct = {
    id: GUID_A,
    kind: "direct" as const,
    title: "Анна",
    courseId: null,
    directLearnerProfileId: null,
    preview: null,
    lastMessageId: null,
    lastActivityAt: NOW,
    unreadCount: 0,
    canSend: true,
  };
  assert.equal(communicationThreadSchema.safeParse(direct).success, true);
  assert.equal(
    communicationThreadSchema.safeParse({
      ...direct,
      directAccountId: GUID_B,
    }).success,
    false,
  );

  const message = {
    id: 1,
    threadId: GUID_A,
    senderLabel: "Преподаватель",
    body: "Начинаем в 15:00",
    createdAt: NOW,
    isOwn: false,
  };
  assert.equal(communicationMessageSchema.safeParse(message).success, true);
  assert.equal(
    communicationMessageSchema.safeParse({
      ...message,
      senderAccountId: GUID_B,
    }).success,
    false,
  );

  assert.equal(
    inboxItemSchema.safeParse({
      id: GUID_A,
      kind: "direct",
      title: "Преподаватель",
      preview: "До встречи",
      lastActivityAt: NOW,
      unreadCount: 1,
      pinned: false,
      threadId: GUID_A,
      lastMessageId: null,
      canSend: true,
      directLearnerProfileId: null,
    }).success,
    true,
  );
});

test("final inbox cursor fields are required on their exact discriminants", () => {
  const course = {
    id: GUID_A,
    kind: "course" as const,
    title: "Курс",
    preview: "Новое сообщение",
    lastActivityAt: NOW,
    unreadCount: 1,
    pinned: false as const,
    threadId: GUID_A,
    lastMessageId: 7,
    canSend: false,
    courseId: GUID_B,
  };
  const system = {
    id: "system" as const,
    kind: "system" as const,
    title: "ShiDao",
    preview: "Урок завершён",
    lastActivityAt: NOW,
    unreadCount: 1,
    pinned: true as const,
    lastNotificationId: 9,
  };

  assert.equal(inboxItemSchema.safeParse(course).success, true);
  assert.equal(inboxItemSchema.safeParse(system).success, true);

  assert.equal(
    inboxItemSchema.safeParse({ ...course, lastMessageId: undefined }).success,
    false,
  );
  assert.equal(
    inboxItemSchema.safeParse({ ...course, canSend: undefined }).success,
    false,
  );
  assert.equal(
    inboxItemSchema.safeParse({ ...system, lastNotificationId: undefined })
      .success,
    false,
  );
});

test("assistant payload accepts canonical plans up to 64 KiB while system payload stays at 16 KiB", () => {
  const payload = { summary: "я".repeat(20_000) };
  assert.equal(
    assistantCommunicationPayloadSchema.safeParse(payload).success,
    true,
  );
  assert.equal(
    systemCommunicationPayloadSchema.safeParse(payload).success,
    false,
  );
  assert.equal(
    assistantCommunicationPayloadSchema.safeParse({ authUserId: GUID_A })
      .success,
    false,
  );
});

test("persisted assistant reply payload is strict and bound to a user turn", () => {
  const payload = {
    replyToTurnId: 7,
    reply: {
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
      proposedAction: null,
      quickReplies: [{ label: "Да", message: "Продолжай" }],
      sharedHistoryUsed: false,
    },
  };
  assert.equal(
    persistedAssistantReplyPayloadSchema.safeParse(payload).success,
    true,
  );
  assert.equal(
    persistedAssistantReplyPayloadSchema.safeParse({
      ...payload,
      reply: { ...payload.reply, token: "secret" },
    }).success,
    false,
  );
});

test("system feed preserves error and action-required severities", () => {
  for (const severity of ["error", "action_required"] as const) {
    assert.equal(
      systemNotificationSchema.safeParse({
        id: 1,
        eventType: "course.background_task",
        severity,
        title: "Нужно внимание",
        body: "Проверьте результат фоновой операции.",
        payload: {},
        occurredAt: NOW,
        readAt: null,
      }).success,
      true,
    );
  }
});

test("inbox alone permits the pinned System item outside the 50-row page", () => {
  const assistantItems = Array.from({ length: 50 }, (_, index) => {
    const id = `00000000-0000-0000-0000-${(index + 100).toString(16).padStart(12, "0")}`;
    return {
      id,
      kind: "assistant" as const,
      title: `Диалог ${index + 1}`,
      preview: null,
      lastActivityAt: NOW,
      unreadCount: 0,
      pinned: false,
      conversationId: id,
      contextCourseId: null,
      contextLessonId: null,
    };
  });
  const systemItem = {
    id: "system" as const,
    kind: "system" as const,
    title: "ShiDao",
    preview: null,
    lastActivityAt: NOW,
    unreadCount: 0,
    pinned: true as const,
    lastNotificationId: null,
  };

  assert.equal(
    inboxPageSchema.safeParse({
      items: [systemItem, ...assistantItems],
      nextCursor: null,
      totalUnread: 0,
    }).success,
    true,
  );
  assert.equal(
    inboxPageSchema.safeParse({
      items: [systemItem, ...assistantItems, assistantItems[0]],
      nextCursor: null,
      totalUnread: 0,
    }).success,
    false,
  );

  const message = {
    id: 1,
    threadId: GUID_A,
    senderLabel: "Анна",
    body: "Сообщение",
    createdAt: NOW,
    isOwn: false,
  };
  assert.equal(
    cursorPageSchema(communicationMessageSchema).safeParse({
      items: Array.from({ length: 51 }, (_, index) => ({
        ...message,
        id: index + 1,
      })),
      nextCursor: null,
    }).success,
    false,
  );
});
