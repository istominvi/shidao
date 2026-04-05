'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, Suspense, useMemo, useState } from 'react';
import { ProductShell, StatusMessage } from '@/components/product-shell';
import { useSessionView } from '@/components/use-session-view';
import { loginWithIdentifier } from '@/lib/auth-flow';
import { ROUTES } from '@/lib/auth';

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refetchSession } = useSessionView();
  const [identifier, setIdentifier] = useState('');
  const [secret, setSecret] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const successHint = useMemo(() => {
    if (searchParams.get('registered') === '1') {
      return 'Аккаунт создан. Теперь войдите с email и паролем.';
    }
    if (searchParams.get('confirmed') === '1') {
      return 'Email подтверждён. Теперь выполните вход.';
    }
    if (searchParams.get('passwordReset') === '1') {
      return 'Пароль обновлён. Войдите с новым паролем.';
    }
    return null;
  }, [searchParams]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (!identifier.trim() || !secret.trim()) {
      setError('Заполните оба поля для входа.');
      return;
    }

    try {
      setLoading(true);
      const route = await loginWithIdentifier(identifier, secret);
      await refetchSession();
      router.push(route);
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Не удалось выполнить вход.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <ProductShell>
      <div className="mx-auto w-full max-w-xl">
        <div className="primary-form-card">
          <h2 className="text-2xl font-black tracking-tight">Войти в кабинет</h2>
          <p className="mt-2 text-sm text-neutral-600">Введите данные доступа, которые вы получили при регистрации или от учителя/родителя</p>

          {successHint && (
            <div className="mt-4">
              <StatusMessage kind="success">{successHint}</StatusMessage>
            </div>
          )}

          <form className="mt-5 space-y-4" onSubmit={onSubmit}>
            <label className="block">
              <span className="field-label">Email или логин ученика</span>
              <input
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="Например, parent@school.com или login ученика"
                className="field-input"
              />
            </label>
            <label className="block">
              <span className="field-label">Пароль или PIN-код</span>
              <input
                type="password"
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                placeholder="Введите пароль или PIN"
                className="field-input"
              />
            </label>
            <div className="text-right">
              <Link href={ROUTES.forgotPassword} className="text-sm font-semibold underline decoration-black/20 underline-offset-2">
                Забыли пароль?
              </Link>
            </div>

            {error && <StatusMessage kind="error">{error}</StatusMessage>}

            <button disabled={loading} className="landing-btn landing-btn-primary min-h-12 w-full disabled:opacity-60" type="submit">
              {loading ? 'Входим…' : 'Войти в Shidao'}
            </button>
          </form>

          <p className="mt-5 text-sm text-neutral-600">
            Нет взрослого аккаунта?{' '}
            <Link href={ROUTES.join} className="font-semibold underline decoration-black/25 underline-offset-2">
              Зарегистрироваться
            </Link>
          </p>
        </div>
      </div>
    </ProductShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageContent />
    </Suspense>
  );
}
