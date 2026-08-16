"use client";

import { ROUTES } from "@/lib/auth";
import type {
  AssistantConversation,
  AssistantExchange,
  AssistantTurn,
  CommunicationMessage,
  CommunicationThread,
  CursorPage,
  InboxCursor,
  InboxPage,
  MessageTargets,
  ReadReceipt,
  SystemNotification,
} from "@/modules/communication/domain";
import type {
  CreateAssistantConversationInput,
  OpenCommunicationThreadInput,
  UpdateAssistantConversationInput,
} from "@/modules/communication/contracts";
type CommunicationErrorPayload = {
  error?: string;
  code?: string;
  loginRequired?: boolean;
};

export class CommunicationClientError extends Error {
  readonly status: number;
  readonly code: string | null;

  constructor(message: string, status: number, code?: string | null) {
    super(message);
    this.name = "CommunicationClientError";
    this.status = status;
    this.code = code ?? null;
  }
}

function redirectToLogin() {
  const next = `${window.location.pathname}${window.location.search}`;
  window.location.assign(`${ROUTES.login}?next=${encodeURIComponent(next)}`);
}

async function communicationRequest<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  let response: Response;
  try {
    response = await fetch(path, {
      credentials: "same-origin",
      cache: "no-store",
      ...init,
      headers,
    });
  } catch {
    throw new CommunicationClientError(
      "Не удалось связаться с сервисом сообщений. Проверьте соединение.",
      0,
      "network_error",
    );
  }

  const payload = (await response.json().catch(() => null)) as
    CommunicationErrorPayload | T | null;
  if (!response.ok) {
    const error = payload as CommunicationErrorPayload | null;
    if (error?.loginRequired) redirectToLogin();
    throw new CommunicationClientError(
      error?.error ?? "Сообщения временно недоступны. Попробуйте ещё раз.",
      response.status,
      error?.code,
    );
  }
  return payload as T;
}

function cursorQuery(cursor: InboxCursor | null) {
  if (!cursor) return "";
  const query = new URLSearchParams({
    cursorActivityAt: cursor.activityAt,
    cursorKind: cursor.kind,
    cursorId: cursor.id,
  });
  return `?${query.toString()}`;
}

export async function loadInbox(cursor: InboxCursor | null = null) {
  const payload = await communicationRequest<{ inbox: InboxPage }>(
    `/api/v2/inbox${cursorQuery(cursor)}`,
  );
  return payload.inbox;
}

export async function loadMessageTargets(query = "") {
  const params = new URLSearchParams();
  if (query.trim()) params.set("q", query.trim());
  const suffix = params.size > 0 ? `?${params.toString()}` : "";
  const payload = await communicationRequest<{ targets: MessageTargets }>(
    `/api/v2/message-targets${suffix}`,
  );
  return payload.targets;
}

export async function openCommunicationThread(
  input: OpenCommunicationThreadInput,
) {
  const payload = await communicationRequest<{ thread: CommunicationThread }>(
    "/api/v2/communication-threads",
    { method: "POST", body: JSON.stringify(input) },
  );
  return payload.thread;
}

export async function loadCommunicationMessages(
  threadId: string,
  beforeMessageId: number | null = null,
) {
  const suffix = beforeMessageId
    ? `?beforeMessageId=${encodeURIComponent(String(beforeMessageId))}`
    : "";
  const payload = await communicationRequest<{
    messages: CursorPage<CommunicationMessage>;
  }>(
    `/api/v2/communication-threads/${encodeURIComponent(threadId)}/messages${suffix}`,
  );
  return payload.messages;
}

export async function sendCommunicationMessage(
  threadId: string,
  body: string,
  clientMessageId = crypto.randomUUID(),
) {
  const payload = await communicationRequest<{ message: CommunicationMessage }>(
    `/api/v2/communication-threads/${encodeURIComponent(threadId)}/messages`,
    {
      method: "POST",
      body: JSON.stringify({ clientMessageId, body }),
    },
  );
  return payload.message;
}

export async function markCommunicationThreadRead(
  threadId: string,
  throughMessageId?: number | null,
) {
  const payload = await communicationRequest<{
    receipt?: ReadReceipt;
    thread?: CommunicationThread;
  }>(`/api/v2/communication-threads/${encodeURIComponent(threadId)}/read`, {
    method: "POST",
    body: JSON.stringify({
      ...(throughMessageId === undefined ? {} : { throughMessageId }),
    }),
  });
  return payload.receipt ?? payload.thread ?? null;
}

export async function loadAssistantConversations() {
  const payload = await communicationRequest<{
    conversations: AssistantConversation[];
  }>("/api/v2/assistant/conversations");
  return payload.conversations;
}

export async function loadAssistantConversation(conversationId: string) {
  const payload = await communicationRequest<{
    conversation: AssistantConversation;
  }>(`/api/v2/assistant/conversations/${encodeURIComponent(conversationId)}`);
  return payload.conversation;
}

export async function createAssistantConversation(
  input: CreateAssistantConversationInput,
) {
  const payload = await communicationRequest<{
    conversation: AssistantConversation;
  }>("/api/v2/assistant/conversations", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return payload.conversation;
}

export async function updateAssistantConversation(
  conversationId: string,
  input: UpdateAssistantConversationInput,
) {
  const payload = await communicationRequest<{
    conversation: AssistantConversation;
  }>(`/api/v2/assistant/conversations/${encodeURIComponent(conversationId)}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  return payload.conversation;
}

export async function loadAssistantTurns(
  conversationId: string,
  beforeTurnId: number | null = null,
) {
  const suffix = beforeTurnId
    ? `?beforeTurnId=${encodeURIComponent(String(beforeTurnId))}`
    : "";
  const payload = await communicationRequest<{
    turns: CursorPage<AssistantTurn>;
    conversation?: AssistantConversation;
  }>(
    `/api/v2/assistant/conversations/${encodeURIComponent(conversationId)}/turns${suffix}`,
  );
  return payload;
}

export async function sendAssistantTurn(
  conversationId: string,
  body: string,
  clientTurnId = crypto.randomUUID(),
) {
  const now = new Date();
  const localDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const payload = await communicationRequest<{ exchange: AssistantExchange }>(
    `/api/v2/assistant/conversations/${encodeURIComponent(conversationId)}/turns`,
    {
      method: "POST",
      body: JSON.stringify({
        clientTurnId,
        body,
        localDate,
        utcOffsetMinutes: -now.getTimezoneOffset(),
      }),
    },
  );
  return payload.exchange;
}

export async function markAssistantConversationRead(
  conversationId: string,
  throughTurnId?: number | null,
) {
  const payload = await communicationRequest<{
    receipt: ReadReceipt;
  }>(
    `/api/v2/assistant/conversations/${encodeURIComponent(conversationId)}/read`,
    {
      method: "POST",
      body: JSON.stringify({
        ...(throughTurnId === undefined ? {} : { throughTurnId }),
      }),
    },
  );
  return payload.receipt;
}

export async function loadSystemNotifications(
  beforeNotificationId: number | null = null,
) {
  const suffix = beforeNotificationId
    ? `?beforeNotificationId=${encodeURIComponent(String(beforeNotificationId))}`
    : "";
  const payload = await communicationRequest<{
    notifications: CursorPage<SystemNotification>;
  }>(`/api/v2/system-notifications${suffix}`);
  return payload.notifications;
}

export async function markSystemNotificationsRead(
  throughNotificationId?: number | null,
) {
  const payload = await communicationRequest<{ receipt: ReadReceipt }>(
    "/api/v2/system-notifications/read",
    {
      method: "POST",
      body: JSON.stringify({
        ...(throughNotificationId === undefined
          ? {}
          : { throughNotificationId }),
      }),
    },
  );
  return payload.receipt;
}
