'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { PageHero, ProductShell, StatusMessage } from '@/components/product-shell';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    try {
      setLoading(true);
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, confirmPassword })
      });
      const payload = (await response.json().catch(() => null)) as { error?: string; redirectTo?: string } | null;
      if (!response.ok) {
        throw new Error(payload?.error ?? 'Не удалось обновить пароль.');
      }

      setSuccess('Пароль обновлён. Перенаправляем на страницу входа…');
      if (!payload?.redirectTo) {
        throw new Error('Сервер не вернул маршрут после обновления пароля.');
      }

      setTimeout(() => {
        router.replace(payload.redirectTo);
      }, 700);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Не удалось обновить пароль.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <ProductShell>
      <PageHero
        eyebrow="Новый пароль"
        title="Создайте новый пароль"
        description="После подтверждения письма восстановления вы можете установить новый пароль для взрослого аккаунта Shidao."
      />

      <div className="mx-auto mt-4 w-full max-w-xl">
        <div className="primary-form-card">
          <h2 className="text-2xl font-black tracking-tight">Новый пароль</h2>
          <form className="mt-5 space-y-4" onSubmit={onSubmit}>
            <label className="block">
              <span className="field-label">Новый пароль</span>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="field-input" placeholder="Минимум 8 символов" />
            </label>

            <label className="block">
              <span className="field-label">Подтверждение пароля</span>
              <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="field-input" />
            </label>

            {error && <StatusMessage kind="error">{error}</StatusMessage>}
            {success && <StatusMessage kind="success">{success}</StatusMessage>}

            <button disabled={loading} className="landing-btn landing-btn-primary min-h-12 w-full disabled:opacity-60" type="submit">
              {loading ? 'Сохраняем…' : 'Сохранить новый пароль'}
            </button>
          </form>
        </div>
      </div>
    </ProductShell>
  );
}
