'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { TopNav } from '@/components/top-nav';
import { createAdultProfile, signUpWithPassword } from '@/lib/supabase-client';

export default function SignUpPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!name.trim() || !email.trim() || password.length < 8) {
      setError('Укажите имя, корректный email и пароль не короче 8 символов.');
      return;
    }

    try {
      setLoading(true);
      const user = await signUpWithPassword(email.trim().toLowerCase(), password, name.trim()).catch((signupError: unknown) => {
        if (signupError instanceof Error && signupError.message.toLowerCase().includes('already')) {
          throw new Error('Пользователь с таким email уже существует.');
        }
        throw new Error('Не удалось создать аккаунт.');
      });

      await createAdultProfile({
        authUserId: user.id,
        fullName: name.trim(),
        email: email.trim().toLowerCase()
      });

      setSuccess('Аккаунт создан. Теперь выполните вход через единую форму.');
      setTimeout(() => {
        router.push('/auth/sign-in');
      }, 800);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Ошибка регистрации.');
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
          <h1 className="mt-4 text-3xl font-black">Создать единый взрослый аккаунт</h1>
          <p className="mt-2 text-sm text-neutral-600">
            Родитель и преподаватель регистрируются одинаково. Выбор первого направления появится только после первого входа.
          </p>

          <form className="mt-6 space-y-4" onSubmit={onSubmit}>
            <label className="block">
              <span className="mb-2 block text-sm font-medium">Ваше имя</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Например: Анна Иванова"
                className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 outline-none transition focus:border-black/30 focus:ring-2 focus:ring-black/10"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-medium">Email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 outline-none transition focus:border-black/30 focus:ring-2 focus:ring-black/10"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-medium">Пароль</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Минимум 8 символов"
                className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 outline-none transition focus:border-black/30 focus:ring-2 focus:ring-black/10"
              />
            </label>

            {error && <p className="rounded-2xl bg-red-100 px-4 py-3 text-sm text-red-700">{error}</p>}
            {success && <p className="rounded-2xl bg-emerald-100 px-4 py-3 text-sm text-emerald-700">{success}</p>}

            <button
              disabled={loading}
              className="w-full rounded-2xl bg-black px-4 py-3 font-semibold text-white disabled:opacity-60"
              type="submit"
            >
              {loading ? 'Создаём аккаунт…' : 'Создать аккаунт'}
            </button>
          </form>

          <p className="mt-5 text-sm text-neutral-600">
            Уже есть аккаунт?{' '}
            <Link href="/auth/sign-in" className="font-semibold underline">
              Войти
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
