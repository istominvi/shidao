import type {
  SystemAssistantReply,
  SystemAssistantRequest,
} from "@/modules/ai/system-assistant-contracts";
import {
  CommunicationApplicationError,
  type AppendAssistantUserTurnInput,
} from "./contracts";
import type {
  AssistantExchange,
  AssistantTurn,
  CommunicationActor,
} from "./domain";
import {
  persistedAssistantReplyPayloadSchema,
  type PersistedAssistantReplyPayload,
} from "./output-contracts";
import type { CommunicationApplicationService } from "./service";

const ASSISTANT_HISTORY_TURN_LIMIT = 16;
const ASSISTANT_HISTORY_CHARACTER_LIMIT = 24_000;

type AssistantConversationService = Pick<
  CommunicationApplicationService,
  "getAssistantConversation" | "appendAssistantUserTurn" | "listAssistantTurns"
>;

type AssistantTurnAppender = {
  appendAssistantTurn(input: {
    ownerAccountId: string;
    conversationId: string;
    body: string;
    payload: Record<string, unknown>;
    deliveryKind: "interactive" | "background_result" | "insight";
    sourceKey: string | null;
  }): Promise<AssistantTurn>;
};

export type PersistedAssistantExchangeDependencies = {
  actor: CommunicationActor;
  service: AssistantConversationService;
  chat(
    request: SystemAssistantRequest,
    signal?: AbortSignal,
  ): Promise<SystemAssistantReply>;
  loadAdminAppender(): Promise<AssistantTurnAppender>;
};

function persistedReplyForTurn(
  turn: AssistantTurn,
  userTurnId: number,
): PersistedAssistantReplyPayload["reply"] | null {
  if (turn.role !== "assistant") return null;
  const payload = persistedAssistantReplyPayloadSchema.safeParse(turn.payload);
  if (!payload.success || payload.data.replyToTurnId !== userTurnId)
    return null;
  return payload.data.reply;
}

function exchangeFromPersistedReply(
  userTurn: AssistantTurn,
  assistantTurn: AssistantTurn,
  reply: PersistedAssistantReplyPayload["reply"],
): AssistantExchange {
  return {
    userTurn,
    assistantTurn,
    proposedAction: reply.proposedAction,
    quickReplies: reply.quickReplies,
    sharedHistoryUsed: reply.sharedHistoryUsed,
    usage: reply.usage,
  };
}

export function boundedAssistantHistory(
  turns: AssistantTurn[],
  throughTurnId: number,
): SystemAssistantRequest["messages"] {
  const candidates = turns
    .filter((turn) => turn.id <= throughTurnId)
    .sort((left, right) => left.id - right.id)
    .slice(-ASSISTANT_HISTORY_TURN_LIMIT);
  const selected: AssistantTurn[] = [];
  let characters = 0;

  for (let index = candidates.length - 1; index >= 0; index -= 1) {
    const turn = candidates[index]!;
    if (characters + turn.body.length > ASSISTANT_HISTORY_CHARACTER_LIMIT) {
      break;
    }
    selected.unshift(turn);
    characters += turn.body.length;
  }

  return selected.map((turn) => ({ role: turn.role, content: turn.body }));
}

function pageContext(
  conversation: Awaited<
    ReturnType<AssistantConversationService["getAssistantConversation"]>
  >,
  input: AppendAssistantUserTurnInput,
): SystemAssistantRequest["page"] {
  const clock = {
    localDate: input.localDate,
    utcOffsetMinutes: input.utcOffsetMinutes,
  };
  if (conversation.contextLessonId && conversation.contextCourseId) {
    return {
      surface: "lesson",
      view: "lesson_plan",
      courseId: conversation.contextCourseId,
      lessonId: conversation.contextLessonId,
      ...clock,
    };
  }
  if (conversation.contextCourseId) {
    return {
      surface: "course",
      view: "course_lessons",
      courseId: conversation.contextCourseId,
      lessonId: null,
      ...clock,
    };
  }
  return {
    surface: "other",
    view: null,
    courseId: null,
    lessonId: null,
    ...clock,
  };
}

function persistedReplyPayload(
  userTurnId: number,
  reply: SystemAssistantReply,
): PersistedAssistantReplyPayload {
  const result = persistedAssistantReplyPayloadSchema.safeParse({
    replyToTurnId: userTurnId,
    reply: {
      requestId: reply.requestId,
      model: reply.model,
      provider: reply.provider,
      usage: reply.usage,
      proposedAction: reply.proposedAction,
      quickReplies: reply.quickReplies,
      sharedHistoryUsed: reply.sharedHistoryUsed,
    },
  });
  if (result.success) return result.data;
  throw new CommunicationApplicationError(
    "Ответ ИИ оказался слишком большим для надёжного сохранения.",
    502,
    "assistant_reply_payload_invalid",
  );
}

export async function runPersistedAssistantExchange(
  dependencies: PersistedAssistantExchangeDependencies,
  conversationId: string,
  input: AppendAssistantUserTurnInput,
  signal?: AbortSignal,
): Promise<AssistantExchange> {
  const conversation = await dependencies.service.getAssistantConversation(
    dependencies.actor,
    conversationId,
  );
  const userTurn = await dependencies.service.appendAssistantUserTurn(
    dependencies.actor,
    conversationId,
    input,
  );
  const turns = await dependencies.service.listAssistantTurns(
    dependencies.actor,
    conversationId,
    { beforeTurnId: null, limit: 50 },
  );

  for (const assistantTurn of turns.items) {
    const persistedReply = persistedReplyForTurn(assistantTurn, userTurn.id);
    if (persistedReply) {
      return exchangeFromPersistedReply(
        userTurn,
        assistantTurn,
        persistedReply,
      );
    }
  }

  const historyTurns = turns.items.some((turn) => turn.id === userTurn.id)
    ? turns.items
    : [...turns.items, userTurn];

  const reply = await dependencies.chat(
    {
      page: pageContext(conversation, input),
      messages: boundedAssistantHistory(historyTurns, userTurn.id),
    },
    signal,
  );

  // Elevated persistence stays unreachable until the provider has produced a
  // valid reply. The browser never receives or controls the owner Account id.
  const payload = persistedReplyPayload(userTurn.id, reply);
  const appender = await dependencies.loadAdminAppender();
  const assistantTurn = await appender.appendAssistantTurn({
    ownerAccountId: dependencies.actor.accountId,
    conversationId,
    body: reply.message.content,
    payload,
    deliveryKind: "interactive",
    sourceKey: `interactive:user-turn:${userTurn.id}`,
  });
  const storedReply = persistedReplyForTurn(assistantTurn, userTurn.id);
  if (!storedReply) {
    throw new CommunicationApplicationError(
      "Не удалось надёжно сохранить ответ ИИ.",
      503,
      "assistant_reply_persistence_failed",
    );
  }
  return exchangeFromPersistedReply(userTurn, assistantTurn, storedReply);
}
