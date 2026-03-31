'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { TopNav } from '@/components/top-nav';
import { ensureAdultRole, findAdultByAuthUserId, getSession, updateAdultCurrentRole } from '@/lib/supabase-client';
import type { AdultRole } from '@/lib/auth';

const options: Array<{ value: AdultRole; title: string; description: string }> = [
  {
    value: 'parent',
    title: 'Следить за обучением своего ребёнка',
    description: 'Вы будете видеть расписание, прогресс и задания ученика.'
  },
  {
    value: 'teacher',
    title: 'Преподавать Китайский язык',
    description: 'Вы получите доступ к урокам, группам и управлению учебным процессом.'
  }
];

export default function AdultOnboardingPage() {
  const router = useRouter();
  const [loadingRole, setLoadingRole] = useState<AdultRole | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function selectRole(role: AdultRole) {
    setError(null);
    setLoadingRole(role);

    try {
      const session = getSession();
      if (!session) {
        throw new Error('Сессия не найдена. Выполните вход заново.');
      }

      const adult = await findAdultByAuthUserId(session.user.id, session.access_token);
      if (!adult?.id) {
        throw new Error('Профиль взрослого не найден.');
      }

      await ensureAdultRole(adult.id, role, session.access_token);
      await updateAdultCurrentRole(adult.id, role, session.access_token);
      router.push(role === 'parent' ? '/dashboard/parent' : '/dashboard/teacher');
      router.refresh();
    } catch (selectError) {
      setError(selectError instanceof Error ? selectError.message : 'Не удалось сохранить выбор роли.');
    } finally {
      setLoadingRole(null);
    }
  }

  return (
    <main>
      <TopNav />
      <section className="container mt-8 pb-12">
        <div className="mx-auto max-w-3xl glass rounded-3xl p-6 md:p-8">
          <p className="chip bg-amber-100 text-amber-700">Первый вход взрослого</p>
          <h1 className="mt-4 text-3xl font-black">Выберите первое направление</h1>
          <p className="mt-2 text-neutral-700">Выберите один вариант сейчас. Вторую роль можно добавить и включить позже через шапку.</p>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => selectRole(option.value)}
                disabled={loadingRole !== null}
                className="rounded-3xl border border-black/10 bg-white p-5 text-left transition hover:border-black/30 disabled:opacity-60"
              >
                <h2 className="text-lg font-bold">{option.title}</h2>
                <p className="mt-2 text-sm text-neutral-600">{option.description}</p>
                <p className="mt-5 text-sm font-semibold">{loadingRole === option.value ? 'Сохраняем…' : 'Выбрать'}</p>
              </button>
            ))}
          </div>

          {error && <p className="mt-4 rounded-2xl bg-red-100 px-4 py-3 text-sm text-red-700">{error}</p>}
        </div>
      </section>
    </main>
  );
}
