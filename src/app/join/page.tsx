'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { TopNav } from '@/components/top-nav';
import { ROUTES } from '@/lib/auth';

export default function JoinPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (!name.trim() || !email.trim() || password.length < 8) {
      setError('Укажите имя, корректный email и пароль не короче 8 символов.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Пароль и подтверждение не совпадают.');
      return;
    }

    if (!agreed) {
      setError('Нужно согласиться с условиями и политикой.');
      return;
    }

    try {
      setLoading(true);
      const normalizedEmail = email.trim().toLowerCase();
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: normalizedEmail,
          password
        })
      });

      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(payload?.error ?? 'Не удалось завершить регистрацию. Попробуйте ещё раз.');
      }
      router.push(`${ROUTES.joinCheckEmail}?email=${encodeURIComponent(normalizedEmail)}`);
    } catch (submitError) {
      if (submitError instanceof TypeError && submitError.message.includes('fetch')) {
        setError('Проблема с сетью. Проверьте подключение и попробуйте ещё раз.');
      } else {
        setError(submitError instanceof Error ? submitError.message : 'Ошибка регистрации.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main>
      <TopNav />
      <section className="container mt-8 pb-12">
        <div className="mx-auto max-w-xl glass rounded-3xl p-6 md:p-8">
          <p className="chip bg-lime-100 text-lime-700">Регистрация взрослого</p>
          <h1 className="mt-4 text-3xl font-black">Создать аккаунт</h1>
          <p className="mt-2 text-sm text-neutral-600">
            Регистрация доступна только взрослым. Роль выбирается после подтверждения email на этапе онбординга.
          </p>

          <form className="mt-6 space-y-4" onSubmit={onSubmit}>
            <label className="block">
              <span className="mb-2 block text-sm font-medium">Имя</span>
              <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3" />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-medium">Email</span>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3" />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-medium">Пароль</span>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3" />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-medium">Подтверждение пароля</span>
              <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3" />
            </label>

            <label className="flex items-start gap-2 rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm">
              <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5" />
              <span>Я согласен(а) с условиями использования и политикой конфиденциальности.</span>
            </label>

            {error && <p className="rounded-2xl bg-red-100 px-4 py-3 text-sm text-red-700">{error}</p>}

            <button disabled={loading} className="w-full rounded-2xl bg-black px-4 py-3 font-semibold text-white disabled:opacity-60" type="submit">
              {loading ? 'Создаём аккаунт…' : 'Создать аккаунт'}
            </button>
          </form>

          <p className="mt-5 text-sm text-neutral-600">
            Уже есть аккаунт? <Link href={ROUTES.login} className="font-semibold underline">Войти</Link>
          </p>
        </div>
      </section>
    </main>
  );
}
