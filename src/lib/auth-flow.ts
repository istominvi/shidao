"use client";

export async function loginWithIdentifier(identifier: string, secret: string) {
  const response = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier, secret }),
  });

  const payload = (await response.json().catch(() => null)) as {
    error?: string;
    redirectTo?: string;
  } | null;

  if (!response.ok) {
    throw new Error(payload?.error ?? "Не удалось выполнить вход.");
  }

  if (!payload?.redirectTo) {
    throw new Error("Сервер не вернул маршрут для перехода после входа.");
  }

  return payload.redirectTo;
}

export async function signOutViaServer() {
  return fetch("/api/auth/logout", { method: "POST" });
}
