'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { TopNav } from '@/components/top-nav';
import { ROUTES, type ProfileKind } from '@/lib/auth';

const options: Array<{ value: ProfileKind; title: string; description: string }> = [
  {
    value: 'parent',
    title: 'Я родитель',
    description: 'Создадим профиль родителя и откроем доступ к детям, которые привязаны к вам.'
  },
  {
    value: 'teacher',
    title: 'Я преподаватель',
    description: 'Создадим профиль преподавателя, школу, первый класс и назначим вас владельцем.'
  }
];

export default function OnboardingPage() {
  const router = useRouter();
  const [loadingProfile, setLoadingProfile] = useState<ProfileKind | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sessionCheckPending, setSessionCheckPending] = useState(true);
  const [sessionError, setSessionError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function checkSession() {
      setSessionCheckPending(true);
      setSessionError(null);

      try {
        const response = await fetch('/api/auth/session', { cache: 'no-store' });
        const ctx = (await response.json().catch(() => null)) as
          | { authenticated?: boolean; actorKind?: string; hasAnyAdultProfile?: boolean; reason?: string }
          | null;

        if (cancelled) return;

        if (response.status === 401 || (ctx?.authenticated === false && ctx?.reason === 'no_session')) {
          router.replace(ROUTES.login);
          return;
        }

        if (!response.ok) {
          setSessionError('Не удалось проверить сессию. Попробуйте ещё раз.');
          return;
        }

        if (!ctx?.authenticated) {
          router.replace(ROUTES.login);
          return;
        }

        if (ctx.actorKind === 'student' || ctx.hasAnyAdultProfile) {
          router.replace(ROUTES.dashboard);
          return;
        }
      } catch {
        if (!cancelled) {
          setSessionError('Сервис сессий временно недоступен. Попробуйте ещё раз.');
        }
      } finally {
        if (!cancelled) {
          setSessionCheckPending(false);
        }
      }
    }

    checkSession();
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function selectProfile(profile: ProfileKind) {
    setError(null);
    setLoadingProfile(profile);

    try {
      const response = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile })
      });

      const payload = (await response.json().catch(() => null)) as { error?: string; redirectTo?: string } | null;
      if (!response.ok) {
        throw new Error(payload?.error ?? 'Не удалось завершить онбординг.');
      }

      router.push(payload?.redirectTo ?? ROUTES.dashboard);
      router.refresh();
    } catch (selectError) {
      setError(selectError instanceof Error ? selectError.message : 'Не удалось завершить онбординг.');
    } finally {
      setLoadingProfile(null);
    }
  }

  return (
    <main>
      <TopNav />
      <section className="container mt-8 pb-12">
        <div className="mx-auto max-w-3xl glass rounded-3xl p-6 md:p-8">
          <p className="chip bg-amber-100 text-amber-700">Первый вход</p>
          <h1 className="mt-4 text-3xl font-black">Выберите профиль</h1>
          <p className="mt-2 text-neutral-700">Профиль можно расширить позже: один взрослый аккаунт может иметь роли родителя и преподавателя.</p>

          {sessionCheckPending ? (
            <p className="mt-6 rounded-2xl bg-neutral-100 px-4 py-3 text-sm text-neutral-700">Проверяем сессию…</p>
          ) : (
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {options.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => selectProfile(option.value)}
                  disabled={loadingProfile !== null}
                  className="rounded-3xl border border-black/10 bg-white p-5 text-left transition hover:border-black/30 disabled:opacity-60"
                >
                  <h2 className="text-lg font-bold">{option.title}</h2>
                  <p className="mt-2 text-sm text-neutral-600">{option.description}</p>
                  <p className="mt-5 text-sm font-semibold">{loadingProfile === option.value ? 'Сохраняем…' : 'Выбрать'}</p>
                </button>
              ))}
            </div>
          )}

          {sessionError && (
            <div className="mt-4 rounded-2xl bg-amber-100 px-4 py-3 text-sm text-amber-800">
              <p>{sessionError}</p>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="mt-2 rounded-xl border border-amber-300 bg-white px-3 py-1 font-semibold text-amber-800"
              >
                Повторить
              </button>
            </div>
          )}
          {error && <p className="mt-4 rounded-2xl bg-red-100 px-4 py-3 text-sm text-red-700">{error}</p>}
        </div>
      </section>
    </main>
  );
}
