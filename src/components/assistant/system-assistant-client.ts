"use client";

import { ROUTES } from "@/lib/auth";
import type {
  SystemAssistantActionProposal,
  SystemAssistantActionResult,
  SystemAssistantPageContext,
  SystemAssistantReply,
} from "@/modules/ai/system-assistant-contracts";
import type { AiAssistantMessage } from "@/modules/ai/course-builder-contracts";

type AssistantErrorPayload = {
  error?: string;
  code?: string;
  loginRequired?: boolean;
};

export class SystemAssistantClientError extends Error {
  readonly status: number;
  readonly code: string | null;

  constructor(message: string, status: number, code?: string | null) {
    super(message);
    this.name = "SystemAssistantClientError";
    this.status = status;
    this.code = code ?? null;
  }
}

function redirectToLogin() {
  const next = `${window.location.pathname}${window.location.search}`;
  window.location.assign(`${ROUTES.login}?next=${encodeURIComponent(next)}`);
}

async function assistantRequest<T>(path: string, body: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new SystemAssistantClientError(
      "Не удалось связаться с ассистентом. Проверьте соединение.",
      0,
      "network_error",
    );
  }

  const payload = (await response.json().catch(() => null)) as
    AssistantErrorPayload | T | null;
  if (!response.ok) {
    const error = payload as AssistantErrorPayload | null;
    if (error?.loginRequired) redirectToLogin();
    throw new SystemAssistantClientError(
      error?.error ?? "Ассистент временно недоступен. Попробуйте ещё раз.",
      response.status,
      error?.code,
    );
  }
  return payload as T;
}

export async function sendSystemAssistantMessage(
  page: SystemAssistantPageContext,
  messages: AiAssistantMessage[],
) {
  const payload = await assistantRequest<{ result: SystemAssistantReply }>(
    "/api/v2/assistant",
    { page, messages },
  );
  return payload.result;
}

export async function applySystemAssistantAction(
  proposal: SystemAssistantActionProposal,
) {
  const payload = await assistantRequest<{
    result: SystemAssistantActionResult;
  }>("/api/v2/assistant/actions/apply", {
    idempotencyKey: proposal.idempotencyKey,
    action: proposal.action,
  });
  return payload.result;
}
