'use client';

import { ROUTES } from '@/lib/auth';

export async function loginWithIdentifier(identifier: string, secret: string) {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier, secret })
  });

  const payload = (await response.json().catch(() => null)) as { error?: string; redirectTo?: string } | null;

  if (!response.ok) {
    throw new Error(payload?.error ?? 'Не удалось выполнить вход.');
  }

  return payload?.redirectTo ?? ROUTES.dashboard;
}

export async function signOutViaServer() {
  await fetch('/api/auth/logout', { method: 'POST' });
}
