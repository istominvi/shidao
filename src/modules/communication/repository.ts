import { getSupabasePublicConfig } from "@/lib/server/auth-config";
import type {
  AppendAssistantUserTurnInput,
  AssistantConversationListQuery,
  AssistantTurnPageQuery,
  CreateAssistantConversationInput,
  InboxQuery,
  MarkAssistantConversationReadInput,
  MarkCommunicationThreadReadInput,
  MarkSystemNotificationsReadInput,
  MessagePageQuery,
  MessageTargetsQuery,
  SendCommunicationMessageInput,
  SystemNotificationPageQuery,
  UpdateAssistantConversationInput,
} from "./contracts";
import type {
  AssistantConversation,
  AssistantConversationList,
  AssistantTurn,
  CommunicationMessage,
  CommunicationThread,
  CursorPage,
  InboxPage,
  MessageTargets,
  ReadReceipt,
  SystemNotification,
} from "./domain";
import {
  assistantConversationSchema,
  assistantConversationListSchema,
  assistantTurnSchema,
  communicationMessageSchema,
  communicationThreadSchema,
  cursorPageSchema,
  inboxPageSchema,
  messageTargetsSchema,
  readReceiptSchema,
  systemNotificationSchema,
} from "./output-contracts";
import { COMMUNICATION_RPC, type CommunicationRpcName } from "./rpc-contract";
import type { ZodType } from "zod";

type JsonObject = Record<string, unknown>;

export class CommunicationRepositoryError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly databaseCode: string | null = null,
  ) {
    super(message);
    this.name = "CommunicationRepositoryError";
  }
}

type CommunicationRepositoryOptions = {
  fetcher?: typeof fetch;
};

function isObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function unwrapRpcPayload(value: unknown) {
  if (Array.isArray(value) && value.length === 1 && isObject(value[0])) {
    return value[0];
  }
  if (isObject(value) && "result" in value) return value.result;
  return value;
}

function parseRpcOutput<T>(
  schema: ZodType<T>,
  payload: unknown,
  operation: string,
): T {
  const parsed = schema.safeParse(unwrapRpcPayload(payload));
  if (parsed.success) return parsed.data;
  throw new CommunicationRepositoryError(
    `communication_rpc_output_invalid:${operation}`,
    502,
    "communication_rpc_output_invalid",
  );
}

export function createCommunicationRepository(
  accessToken: string,
  options: CommunicationRepositoryOptions = {},
) {
  const fetcher = options.fetcher ?? fetch;

  async function rpc(
    name: CommunicationRpcName,
    args: JsonObject = {},
  ): Promise<unknown> {
    const { url, anonKey } = getSupabasePublicConfig();
    let response: Response;
    try {
      response = await fetcher(
        `${url.replace(/\/+$/, "")}/rest/v1/rpc/${name}`,
        {
          method: "POST",
          headers: {
            apikey: anonKey,
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(args),
          cache: "no-store",
        },
      );
    } catch {
      throw new CommunicationRepositoryError(
        "communication_network_error",
        503,
      );
    }

    const payload = (await response.json().catch(() => null)) as unknown;
    if (!response.ok) {
      const details = isObject(payload) ? payload : {};
      throw new CommunicationRepositoryError(
        typeof details.message === "string"
          ? details.message
          : `communication_rpc_failed_${response.status}`,
        response.status,
        typeof details.code === "string" ? details.code : null,
      );
    }
    return payload;
  }

  return {
    listInbox(input: InboxQuery): Promise<InboxPage> {
      return rpc(COMMUNICATION_RPC.listInbox, {
        p_cursor_activity_at: input.cursorActivityAt,
        p_cursor_kind: input.cursorKind,
        p_cursor_id: input.cursorId,
        p_limit: input.limit,
      }).then((payload) =>
        parseRpcOutput(inboxPageSchema, payload, "list_inbox"),
      );
    },

    listMessageTargets(input: MessageTargetsQuery): Promise<MessageTargets> {
      return rpc(COMMUNICATION_RPC.listMessageTargets, {
        p_q: input.q,
        p_limit: input.limit,
      }).then((payload) =>
        parseRpcOutput(messageTargetsSchema, payload, "list_message_targets"),
      );
    },

    openDirectThread(learnerProfileId: string): Promise<CommunicationThread> {
      return rpc(COMMUNICATION_RPC.openDirectThread, {
        p_learner_profile_id: learnerProfileId,
      }).then((payload) =>
        parseRpcOutput(
          communicationThreadSchema,
          payload,
          "open_direct_thread",
        ),
      );
    },

    openCourseThread(courseId: string): Promise<CommunicationThread> {
      return rpc(COMMUNICATION_RPC.openCourseThread, {
        p_course_id: courseId,
      }).then((payload) =>
        parseRpcOutput(
          communicationThreadSchema,
          payload,
          "open_course_thread",
        ),
      );
    },

    listMessages(
      threadId: string,
      input: MessagePageQuery,
    ): Promise<CursorPage<CommunicationMessage>> {
      return rpc(COMMUNICATION_RPC.listMessages, {
        p_thread_id: threadId,
        p_before_message_id: input.beforeMessageId,
        p_limit: input.limit,
      }).then((payload) =>
        parseRpcOutput(
          cursorPageSchema(communicationMessageSchema),
          payload,
          "list_messages",
        ),
      );
    },

    sendMessage(
      threadId: string,
      input: SendCommunicationMessageInput,
    ): Promise<CommunicationMessage> {
      return rpc(COMMUNICATION_RPC.sendMessage, {
        p_thread_id: threadId,
        p_body: input.body,
        p_client_message_id: input.clientMessageId,
      }).then((payload) =>
        parseRpcOutput(communicationMessageSchema, payload, "send_message"),
      );
    },

    markThreadRead(
      threadId: string,
      input: MarkCommunicationThreadReadInput,
    ): Promise<ReadReceipt> {
      return rpc(COMMUNICATION_RPC.markThreadRead, {
        p_thread_id: threadId,
        p_through_message_id: input.throughMessageId ?? null,
      }).then((payload) =>
        parseRpcOutput(readReceiptSchema, payload, "mark_thread_read"),
      );
    },

    listAssistantConversations(
      input: AssistantConversationListQuery,
    ): Promise<AssistantConversationList> {
      return rpc(COMMUNICATION_RPC.listAssistantConversations, {
        p_include_archived: input.includeArchived,
        p_limit: input.limit,
      }).then((payload) =>
        parseRpcOutput(
          assistantConversationListSchema,
          payload,
          "list_assistant_conversations",
        ),
      );
    },

    getAssistantConversation(
      conversationId: string,
    ): Promise<AssistantConversation> {
      return rpc(COMMUNICATION_RPC.getAssistantConversation, {
        p_conversation_id: conversationId,
      }).then((payload) =>
        parseRpcOutput(
          assistantConversationSchema,
          payload,
          "get_assistant_conversation",
        ),
      );
    },

    createAssistantConversation(
      input: CreateAssistantConversationInput,
    ): Promise<AssistantConversation> {
      const contextCourseId =
        input.context.kind === "global" ? null : input.context.courseId;
      const contextLessonId =
        input.context.kind === "lesson" ? input.context.lessonId : null;
      return rpc(COMMUNICATION_RPC.createAssistantConversation, {
        p_title: input.title,
        p_context_course_id: contextCourseId,
        p_context_lesson_id: contextLessonId,
      }).then((payload) =>
        parseRpcOutput(
          assistantConversationSchema,
          payload,
          "create_assistant_conversation",
        ),
      );
    },

    updateAssistantConversation(
      conversationId: string,
      input: UpdateAssistantConversationInput,
    ): Promise<AssistantConversation> {
      return rpc(COMMUNICATION_RPC.updateAssistantConversation, {
        p_conversation_id: conversationId,
        p_title: input.action === "rename" ? input.title : null,
        p_archived: input.action === "archive" ? true : null,
      }).then((payload) =>
        parseRpcOutput(
          assistantConversationSchema,
          payload,
          "update_assistant_conversation",
        ),
      );
    },

    listAssistantTurns(
      conversationId: string,
      input: AssistantTurnPageQuery,
    ): Promise<CursorPage<AssistantTurn>> {
      return rpc(COMMUNICATION_RPC.listAssistantTurns, {
        p_conversation_id: conversationId,
        p_before_turn_id: input.beforeTurnId,
        p_limit: input.limit,
      }).then((payload) =>
        parseRpcOutput(
          cursorPageSchema(assistantTurnSchema),
          payload,
          "list_assistant_turns",
        ),
      );
    },

    appendAssistantUserTurn(
      conversationId: string,
      input: AppendAssistantUserTurnInput,
    ): Promise<AssistantTurn> {
      return rpc(COMMUNICATION_RPC.appendAssistantTurn, {
        p_conversation_id: conversationId,
        p_body: input.body,
        p_client_turn_id: input.clientTurnId,
      }).then((payload) =>
        parseRpcOutput(assistantTurnSchema, payload, "append_assistant_turn"),
      );
    },

    markAssistantConversationRead(
      conversationId: string,
      input: MarkAssistantConversationReadInput,
    ): Promise<ReadReceipt> {
      return rpc(COMMUNICATION_RPC.markAssistantConversationRead, {
        p_conversation_id: conversationId,
        p_through_turn_id: input.throughTurnId ?? null,
      }).then((payload) =>
        parseRpcOutput(
          readReceiptSchema,
          payload,
          "mark_assistant_conversation_read",
        ),
      );
    },

    listSystemNotifications(
      input: SystemNotificationPageQuery,
    ): Promise<CursorPage<SystemNotification>> {
      return rpc(COMMUNICATION_RPC.listSystemNotifications, {
        p_before_notification_id: input.beforeNotificationId,
        p_limit: input.limit,
      }).then((payload) =>
        parseRpcOutput(
          cursorPageSchema(systemNotificationSchema),
          payload,
          "list_system_notifications",
        ),
      );
    },

    markSystemNotificationsRead(
      input: MarkSystemNotificationsReadInput,
    ): Promise<ReadReceipt> {
      return rpc(COMMUNICATION_RPC.markSystemNotificationsRead, {
        p_through_notification_id: input.throughNotificationId ?? null,
      }).then((payload) =>
        parseRpcOutput(
          readReceiptSchema,
          payload,
          "mark_system_notifications_read",
        ),
      );
    },
  };
}

export type CommunicationRepository = ReturnType<
  typeof createCommunicationRepository
>;
