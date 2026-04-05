'use client';

import { Suspense } from 'react';
import { FormEvent, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { SettingsShell } from '@/components/settings-shell';
import { StatusMessage } from '@/components/product-shell';

function ProfileSettingsPageContent() {
  const searchParams = useSearchParams();
  const [newEmail, setNewEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailSuccess, setEmailSuccess] = useState<string | null>(null);
  const [emailLoading, setEmailLoading] = useState(false);

  const queryStatus = useMemo(() => {
    if (searchParams.get('emailChanged') === '1') {
      return { kind: 'success' as const, text: 'Новый email подтверждён. Профиль обновлён.' };
    }
    if (searchParams.get('emailChangeRequested') === '1') {
      return { kind: 'info' as const, text: 'Запрос отправлен. Подтвердите новый email через письмо.' };
    }
    return null;
  }, [searchParams]);

  async function onEmailSubmit(event: FormEvent) {
    event.preventDefault();
    setEmailError(null);
    setEmailSuccess(null);

    try {
      setEmailLoading(true);
      const response = await fetch('/api/settings/profile/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newEmail: newEmail.trim().toLowerCase(),
          currentPassword
        })
      });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(payload?.error ?? 'Не удалось отправить запрос на смену email.');
      }

      setEmailSuccess('Письмо подтверждения отправлено на новый email.');
      setCurrentPassword('');
      setNewEmail('');
    } catch (submitError) {
      setEmailError(submitError instanceof Error ? submitError.message : 'Не удалось отправить запрос на смену email.');
    } finally {
      setEmailLoading(false);
    }
  }

  return (
    <SettingsShell
      badgeClassName="bg-violet-100 text-violet-700"
      badgeLabel="Личное"
      title="Профиль и email"
      description="Для безопасности подтвердите действие текущим паролем."
    >
      {queryStatus && (
        <div className="mt-4">
          <StatusMessage kind={queryStatus.kind}>{queryStatus.text}</StatusMessage>
        </div>
      )}

      <form onSubmit={onEmailSubmit} className="mt-6 space-y-4">
        <label className="block">
          <span className="mb-2 block text-sm font-medium">Новый email</span>
          <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3" />
        </label>
        <label className="block">
          <span className="mb-2 block text-sm font-medium">Текущий пароль</span>
          <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3" />
        </label>

        {emailError && <StatusMessage kind="error">{emailError}</StatusMessage>}
        {emailSuccess && <StatusMessage kind="success">{emailSuccess}</StatusMessage>}

        <button type="submit" disabled={emailLoading} className="w-full rounded-2xl bg-black px-4 py-3 font-semibold text-white disabled:opacity-60">
          {emailLoading ? 'Отправляем…' : 'Запросить смену email'}
        </button>
      </form>
    </SettingsShell>
  );
}

export default function ProfileSettingsPage() {
  return (
    <Suspense fallback={null}>
      <ProfileSettingsPageContent />
    </Suspense>
  );
}
