"use client";

import { ROUTES } from "@/lib/auth";
import type {
  SystemAssistantActionProposal,
  SystemAssistantActionResult,
} from "@/modules/ai/system-assistant-contracts";

type AssistantErrorPayload = {
  error?: string;
  code?: string;
  loginRequired?: boolean;
};

export class AssistantApiError extends Error {
  readonly status: number;
  readonly code: string | null;

  constructor(message: string, status: number, code?: string | null) {
    super(message);
    this.name = "AssistantApiError";
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
    throw new AssistantApiError(
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
    throw new AssistantApiError(
      error?.error ?? "Ассистент временно недоступен. Попробуйте ещё раз.",
      response.status,
      error?.code,
    );
  }
  return payload as T;
}

export async function applyAssistantAction(
  proposal: SystemAssistantActionProposal,
) {
  const payload = await assistantRequest<{
    result: SystemAssistantActionResult;
  }>("/api/v2/assistant/actions/apply", {
    idempotencyKey: proposal.idempotencyKey,
    action: proposal.action,
    signature: proposal.signature,
  });
  return payload.result;
}
