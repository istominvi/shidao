import { z, type ZodType } from "zod";
import {
  systemAssistantActionSchema,
  systemAssistantQuickReplySchema,
} from "@/modules/ai/system-assistant-contracts";
import type {
  AssistantConversation,
  AssistantConversationList,
  AssistantTurn,
  CommunicationMessage,
  CommunicationThread,
  CourseMessageTarget,
  CursorPage,
  DirectMessageTarget,
  InboxCursor,
  InboxItem,
  InboxPage,
  MessageTargets,
  ReadReceipt,
  SystemNotification,
} from "./domain";

const timestampSchema = z
  .string()
  .min(1)
  .max(128)
  .refine((value) => Number.isFinite(Date.parse(value)), {
    message: "Некорректная дата в ответе сервиса сообщений.",
  });
const nullableTimestampSchema = timestampSchema.nullable();
const labelSchema = z.string().min(1).max(4_000);
const previewSchema = z.string().max(6_000).nullable();
const sequenceSchema = z.number().int().positive().safe();
const nullableSequenceSchema = sequenceSchema.nullable();
const unreadCountSchema = z.number().int().nonnegative().safe();

const allowedUsageCounterKeys = new Set([
  "inputtokens",
  "outputtokens",
  "totaltokens",
  "cachedinputtokens",
  "reasoningtokens",
]);

function payloadKeyIsForbidden(key: string) {
  const normalized = key.replace(/[^a-z0-9]/gi, "").toLowerCase();
  if (allowedUsageCounterKeys.has(normalized)) return false;
  return (
    normalized === "pin" ||
    /(?:account|auth|email|token|digest|secret|jwt|storagepath|rawpin|password|credential)/.test(
      normalized,
    )
  );
}

function payloadIsBrowserSafe(value: unknown, depth = 0): boolean {
  if (depth > 8) return false;
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value))
  ) {
    return true;
  }
  if (Array.isArray(value)) {
    return (
      value.length <= 250 &&
      value.every((item) => payloadIsBrowserSafe(item, depth + 1))
    );
  }
  if (typeof value !== "object") return false;
  const entries = Object.entries(value as Record<string, unknown>);
  return (
    entries.length <= 100 &&
    entries.every(([key, item]) => {
      if (key.length > 100) return false;
      const normalized = key.replace(/[^a-z0-9]/gi, "").toLowerCase();
      if (allowedUsageCounterKeys.has(normalized)) {
        return (
          typeof item === "number" && Number.isSafeInteger(item) && item >= 0
        );
      }
      return (
        !payloadKeyIsForbidden(key) && payloadIsBrowserSafe(item, depth + 1)
      );
    })
  );
}

function browserSafePayloadSchema(maxBytes: number) {
  return z.record(z.string(), z.unknown()).superRefine((payload, context) => {
    let byteLength = Number.POSITIVE_INFINITY;
    try {
      byteLength = Buffer.byteLength(JSON.stringify(payload), "utf8");
    } catch {
      // Non-JSON values and cycles are never valid persisted payloads.
    }
    if (!payloadIsBrowserSafe(payload) || byteLength > maxBytes) {
      context.addIssue({
        code: "custom",
        message: "Сервис сообщений вернул небезопасные дополнительные данные.",
      });
    }
  });
}

export const assistantCommunicationPayloadSchema =
  browserSafePayloadSchema(65_536);
export const systemCommunicationPayloadSchema =
  browserSafePayloadSchema(16_384);

export const communicationThreadSchema: ZodType<CommunicationThread> = z
  .object({
    id: z.guid(),
    kind: z.enum(["direct", "course"]),
    title: labelSchema,
    courseId: z.guid().nullable(),
    directLearnerProfileId: z.guid().nullable(),
    preview: previewSchema,
    lastMessageId: nullableSequenceSchema,
    lastActivityAt: timestampSchema,
    unreadCount: unreadCountSchema,
    canSend: z.boolean(),
  })
  .strict()
  .superRefine((thread, context) => {
    if (
      (thread.kind === "course" &&
        (!thread.courseId || thread.directLearnerProfileId)) ||
      (thread.kind === "direct" && thread.courseId)
    ) {
      context.addIssue({
        code: "custom",
        message: "Тип диалога не соответствует его адресату.",
      });
    }
  });

export const communicationMessageSchema: ZodType<CommunicationMessage> = z
  .object({
    id: sequenceSchema,
    threadId: z.guid(),
    senderLabel: labelSchema,
    body: z.string().min(1).max(6_000),
    createdAt: timestampSchema,
    isOwn: z.boolean(),
  })
  .strict();

export const directMessageTargetSchema: ZodType<DirectMessageTarget> = z
  .object({
    learnerProfileId: z.guid(),
    title: labelSchema,
    existingThreadId: z.guid().nullable(),
  })
  .strict();

export const courseMessageTargetSchema: ZodType<CourseMessageTarget> = z
  .object({
    courseId: z.guid(),
    title: labelSchema,
    existingThreadId: z.guid().nullable(),
  })
  .strict();

export const messageTargetsSchema: ZodType<MessageTargets> = z
  .object({
    direct: z.array(directMessageTargetSchema).max(50),
    courses: z.array(courseMessageTargetSchema).max(50),
  })
  .strict();

export const assistantConversationSchema: ZodType<AssistantConversation> = z
  .object({
    id: z.guid(),
    title: labelSchema,
    contextCourseId: z.guid().nullable(),
    contextLessonId: z.guid().nullable(),
    lastTurnId: nullableSequenceSchema,
    lastActivityAt: timestampSchema,
    unreadCount: unreadCountSchema,
    archivedAt: nullableTimestampSchema,
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
  })
  .strict()
  .superRefine((conversation, context) => {
    if (conversation.contextLessonId && !conversation.contextCourseId) {
      context.addIssue({
        code: "custom",
        path: ["contextLessonId"],
        message: "Контекст урока требует контекст курса.",
      });
    }
  });

export const assistantConversationListSchema: ZodType<AssistantConversationList> =
  z
    .object({
      items: z.array(assistantConversationSchema).max(50),
    })
    .strict();

export const assistantTurnSchema: ZodType<AssistantTurn> = z
  .object({
    id: sequenceSchema,
    role: z.enum(["user", "assistant"]),
    deliveryKind: z.enum(["interactive", "background_result", "insight"]),
    body: z.string().min(1).max(6_000),
    payload: assistantCommunicationPayloadSchema,
    createdAt: timestampSchema,
  })
  .strict();

export const systemNotificationSchema: ZodType<SystemNotification> = z
  .object({
    id: sequenceSchema,
    eventType: z.string().min(1).max(100),
    severity: z.enum([
      "info",
      "success",
      "warning",
      "error",
      "action_required",
    ]),
    title: labelSchema,
    body: z.string().max(6_000),
    payload: systemCommunicationPayloadSchema,
    occurredAt: timestampSchema,
    readAt: nullableTimestampSchema,
  })
  .strict();

const inboxBaseShape = {
  id: z.string().min(1).max(200),
  title: labelSchema,
  preview: previewSchema,
  lastActivityAt: timestampSchema,
  unreadCount: unreadCountSchema,
};

export const inboxItemSchema: ZodType<InboxItem> = z.discriminatedUnion(
  "kind",
  [
    z
      .object({
        ...inboxBaseShape,
        kind: z.literal("direct"),
        pinned: z.literal(false),
        threadId: z.guid(),
        lastMessageId: nullableSequenceSchema,
        canSend: z.boolean(),
        directLearnerProfileId: z.guid().nullable(),
      })
      .strict(),
    z
      .object({
        ...inboxBaseShape,
        kind: z.literal("course"),
        pinned: z.literal(false),
        threadId: z.guid(),
        lastMessageId: nullableSequenceSchema,
        canSend: z.boolean(),
        courseId: z.guid(),
      })
      .strict(),
    z
      .object({
        ...inboxBaseShape,
        kind: z.literal("assistant"),
        pinned: z.boolean(),
        conversationId: z.guid(),
        contextCourseId: z.guid().nullable(),
        contextLessonId: z.guid().nullable(),
      })
      .strict(),
    z
      .object({
        ...inboxBaseShape,
        kind: z.literal("system"),
        id: z.literal("system"),
        pinned: z.literal(true),
        lastNotificationId: nullableSequenceSchema,
      })
      .strict(),
  ],
) as ZodType<InboxItem>;

export const inboxCursorSchema: ZodType<InboxCursor> = z
  .object({
    activityAt: timestampSchema,
    kind: z.enum(["direct", "course", "assistant"]),
    id: z.string().min(1).max(200),
  })
  .strict();

export const inboxPageSchema: ZodType<InboxPage> = z
  .object({
    // The pinned System row is deliberately outside the ordinary p_limit.
    items: z.array(inboxItemSchema).max(51),
    nextCursor: inboxCursorSchema.nullable(),
    totalUnread: unreadCountSchema,
  })
  .strict();

export function cursorPageSchema<T>(itemSchema: ZodType<T>) {
  return z
    .object({
      items: z.array(itemSchema).max(50),
      nextCursor: nullableSequenceSchema,
    })
    .strict() as ZodType<CursorPage<T>>;
}

export const readReceiptSchema: ZodType<ReadReceipt> = z
  .object({
    markedThroughId: nullableSequenceSchema,
    unreadCount: unreadCountSchema,
  })
  .strict();

const providerUsageSchema = z
  .object({
    inputTokens: z.number().int().nonnegative().safe(),
    outputTokens: z.number().int().nonnegative().safe(),
    totalTokens: z.number().int().nonnegative().safe(),
    cachedInputTokens: z.number().int().nonnegative().safe(),
    reasoningTokens: z.number().int().nonnegative().safe(),
  })
  .strict();

const assistantActionProposalSchema = z
  .object({
    idempotencyKey: z.guid(),
    action: systemAssistantActionSchema,
    signature: z
      .string()
      .min(64)
      .max(512)
      .regex(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/),
  })
  .strict();

export const persistedAssistantReplyPayloadSchema = z
  .object({
    replyToTurnId: sequenceSchema,
    reply: z
      .object({
        requestId: z.string().min(1).max(500),
        model: z.string().min(1).max(500),
        provider: z.string().min(1).max(500).nullable(),
        usage: providerUsageSchema,
        proposedAction: assistantActionProposalSchema.nullable(),
        quickReplies: z.array(systemAssistantQuickReplySchema).max(12),
        sharedHistoryUsed: z.boolean(),
      })
      .strict(),
  })
  .strict()
  .and(assistantCommunicationPayloadSchema);

export type PersistedAssistantReplyPayload = z.infer<
  typeof persistedAssistantReplyPayloadSchema
>;
