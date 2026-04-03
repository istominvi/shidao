'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { TopNav } from '@/components/top-nav';
import { loginWithIdentifier } from '@/lib/auth-flow';
import { ROUTES } from '@/lib/auth';

export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState('');
  const [secret, setSecret] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
      router.push(route);
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Не удалось выполнить вход.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main>
      <TopNav />
      <section className="container mt-8 pb-12">
        <div className="mx-auto max-w-xl glass rounded-3xl p-6 md:p-8">
          <p className="chip bg-sky-100 text-sky-700">Единый вход</p>
          <h1 className="mt-4 text-3xl font-black">Вход в Shidao</h1>
          <p className="mt-2 text-sm text-neutral-600">
            Взрослые входят по email. Ученики входят по логину. Телефонный вход готовится и скоро появится.
          </p>

          <form className="mt-6 space-y-4" onSubmit={onSubmit}>
            <label className="block">
              <span className="mb-2 block text-sm font-medium">Email, логин или телефон</span>
              <input
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="Введите email, логин или телефон"
                className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 outline-none transition focus:border-black/30 focus:ring-2 focus:ring-black/10"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-medium">Пароль или PIN-код</span>
              <input
                type="password"
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                placeholder="Введите пароль или PIN"
                className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 outline-none transition focus:border-black/30 focus:ring-2 focus:ring-black/10"
              />
            </label>

            {error && <p className="rounded-2xl bg-red-100 px-4 py-3 text-sm text-red-700">{error}</p>}

            <button
              disabled={loading}
              className="w-full rounded-2xl bg-black px-4 py-3 font-semibold text-white disabled:opacity-60"
              type="submit"
            >
              {loading ? 'Входим…' : 'Войти'}
            </button>
          </form>

          <p className="mt-5 text-sm text-neutral-600">
            Нет взрослого аккаунта?{' '}
            <Link href={ROUTES.join} className="font-semibold underline">
              Зарегистрироваться
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
