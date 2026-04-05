'use client';

import { FormEvent, useEffect, useState } from 'react';
import { TopNav } from '@/components/top-nav';
import { SettingsNavigation } from '@/components/settings-navigation';

export default function SecuritySettingsPage() {
  const [hasPin, setHasPin] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [currentSecret, setCurrentSecret] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/auth/session', { cache: 'no-store' })
      .then((r) => r.json())
      .then((payload) => setHasPin(Boolean(payload?.hasPin)))
      .catch(() => setHasPin(false));
  }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    try {
      setLoading(true);
      const response = await fetch('/api/settings/security/pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPin, currentSecret })
      });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(payload?.error ?? 'Не удалось сохранить PIN.');

      setHasPin(true);
      setCurrentSecret('');
      setNewPin('');
      setSuccess('PIN успешно сохранён.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось сохранить PIN.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main>
      <TopNav />
      <section className="container mt-8 grid gap-4 pb-12 md:grid-cols-[280px_minmax(0,1fr)]">
        <SettingsNavigation />

        <div className="glass rounded-3xl p-6 md:p-8">
          <p className="chip bg-violet-100 text-violet-700">Личное</p>
          <h1 className="mt-4 text-3xl font-black">PIN-код входа</h1>
          <p className="mt-2 text-sm text-neutral-600">Статус: {hasPin ? 'PIN настроен' : 'PIN не настроен'}.</p>

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            {hasPin && (
              <label className="block">
                <span className="mb-2 block text-sm font-medium">Подтвердите текущим паролем или старым PIN</span>
                <input type="password" value={currentSecret} onChange={(e) => setCurrentSecret(e.target.value)} className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3" />
              </label>
            )}
            <label className="block">
              <span className="mb-2 block text-sm font-medium">Новый PIN (4–8 цифр)</span>
              <input value={newPin} onChange={(e) => setNewPin(e.target.value)} className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3" />
            </label>

            {error && <p className="rounded-2xl bg-red-100 px-4 py-3 text-sm text-red-700">{error}</p>}
            {success && <p className="rounded-2xl bg-emerald-100 px-4 py-3 text-sm text-emerald-700">{success}</p>}

            <button type="submit" disabled={loading} className="w-full rounded-2xl bg-black px-4 py-3 font-semibold text-white disabled:opacity-60">
              {loading ? 'Сохраняем…' : hasPin ? 'Изменить PIN' : 'Создать PIN'}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
