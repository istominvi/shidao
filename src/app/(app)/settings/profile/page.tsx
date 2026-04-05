'use client';

import { Suspense } from 'react';
import { FormEvent, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { TopNav } from '@/components/top-nav';
import { StatusMessage } from '@/components/product-shell';

function ProfileSettingsPageContent() {
  const searchParams = useSearchParams();
  const [newEmail, setNewEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailSuccess, setEmailSuccess] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);
  const [emailLoading, setEmailLoading] = useState(false);
  const [inviteLoading, setInviteLoading] = useState(false);

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

  async function onInviteSubmit(event: FormEvent) {
    event.preventDefault();
    setInviteError(null);
    setInviteSuccess(null);

    try {
      setInviteLoading(true);
      const response = await fetch('/api/admin/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail.trim().toLowerCase() })
      });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(payload?.error ?? 'Не удалось отправить приглашение.');
      }

      setInviteSuccess('Приглашение отправлено.');
      setInviteEmail('');
    } catch (submitError) {
      setInviteError(submitError instanceof Error ? submitError.message : 'Не удалось отправить приглашение.');
    } finally {
      setInviteLoading(false);
    }
  }

  return (
    <main>
      <TopNav />
      <section className="container mt-8 grid gap-4 pb-12 md:grid-cols-2">
        <div className="glass rounded-3xl p-6 md:p-8">
          <p className="chip bg-violet-100 text-violet-700">Профиль</p>
          <h1 className="mt-4 text-3xl font-black">Смена email</h1>
          <p className="mt-2 text-sm text-neutral-600">Для безопасности подтвердите действие текущим паролем.</p>

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
        </div>

        <div className="glass rounded-3xl p-6 md:p-8">
          <p className="chip bg-sky-100 text-sky-700">Приглашения</p>
          <h2 className="mt-4 text-3xl font-black">Пригласить пользователя</h2>
          <p className="mt-2 text-sm text-neutral-600">Отправка приглашения через серверный admin-flow Supabase.</p>

          <form onSubmit={onInviteSubmit} className="mt-6 space-y-4">
            <label className="block">
              <span className="mb-2 block text-sm font-medium">Email приглашённого</span>
              <input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3" />
            </label>

            {inviteError && <StatusMessage kind="error">{inviteError}</StatusMessage>}
            {inviteSuccess && <StatusMessage kind="success">{inviteSuccess}</StatusMessage>}

            <button type="submit" disabled={inviteLoading} className="w-full rounded-2xl bg-black px-4 py-3 font-semibold text-white disabled:opacity-60">
              {inviteLoading ? 'Отправляем…' : 'Отправить приглашение'}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}

export default function ProfileSettingsPage() {
  return (
    <Suspense fallback={null}>
      <ProfileSettingsPageContent />
    </Suspense>
  );
}
