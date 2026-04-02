'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { TopNav } from '@/components/top-nav';
import { getSession, onboardParentProfile, onboardTeacherProfile } from '@/lib/supabase-client';
import type { ProfileKind } from '@/lib/auth';

const options: Array<{ value: ProfileKind; title: string; description: string }> = [
  {
    value: 'parent',
    title: 'Следить за обучением своего ребёнка',
    description: 'Создадим профиль родителя и откроем доступ к ученикам, которые привязаны к вам.'
  },
  {
    value: 'teacher',
    title: 'Преподавать Китайский язык',
    description: 'Создадим профиль преподавателя, школу, первый класс и назначим вас владельцем.'
  }
];

export default function OnboardingPage() {
  const router = useRouter();
  const [loadingProfile, setLoadingProfile] = useState<ProfileKind | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function selectProfile(profile: ProfileKind) {
    setError(null);
    setLoadingProfile(profile);

    try {
      const session = getSession();
      if (!session) {
        throw new Error('Сессия не найдена. Выполните вход заново.');
      }

      const fullName = session.user.user_metadata?.full_name ?? session.user.email ?? 'Пользователь';

      if (profile === 'parent') {
        await onboardParentProfile(session.user.id, fullName, session.access_token);
        router.push('/dashboard/parent');
      } else {
        await onboardTeacherProfile(session.user.id, fullName, session.access_token);
        router.push('/dashboard/teacher');
      }

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
          <p className="mt-2 text-neutral-700">Если позже понадобится второй профиль, его можно добавить отдельно.</p>

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

          {error && <p className="mt-4 rounded-2xl bg-red-100 px-4 py-3 text-sm text-red-700">{error}</p>}
        </div>
      </section>
    </main>
  );
}
