'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ContextCard, PageHero, ProductShell, StatusMessage } from '@/components/product-shell';
import { ROUTES, type ProfileKind } from '@/lib/auth';

const options: Array<{ value: ProfileKind; title: string; description: string; points: string[]; toneClass: string }> = [
  {
    value: 'parent',
    title: 'Я родитель',
    description: 'Буду следить за прогрессом ребёнка и видеть обучение в контексте уроков.',
    points: ['Расписание и статусы в одном месте', 'Комментарии преподавателя по каждому занятию', 'Единый обзор по детям'],
    toneClass: 'bg-[linear-gradient(140deg,rgba(201,255,79,0.35),rgba(255,182,232,0.25),rgba(255,255,255,0.9))]'
  },
  {
    value: 'teacher',
    title: 'Я преподаватель',
    description: 'Буду вести группы, уроки и задания в структурированной рабочей зоне.',
    points: ['Планирование уроков по методике', 'Назначение домашней работы и проверка', 'Коммуникация в треде конкретного урока'],
    toneClass: 'bg-[linear-gradient(140deg,rgba(112,183,255,0.33),rgba(201,180,255,0.25),rgba(255,255,255,0.9))]'
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
    <ProductShell>
      <PageHero
        eyebrow="Первый шаг внутри платформы"
        title="Выберите, как начнёте работу в Shidao"
        description="Это стартовый профиль. Позже вы сможете добавить вторую взрослую роль, не создавая новый аккаунт."
      />

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <ContextCard tone="amber" title="Гибкий старт" description="Начните с одной роли сейчас и расширьте доступ, когда это понадобится." />
        <ContextCard tone="sky" title="Без потери данных" description="История уроков и коммуникация сохраняются внутри одного взрослого аккаунта." />
        <ContextCard tone="neutral" title="Быстрый переход" description="После выбора профиля сразу попадёте в рабочий кабинет." />
      </div>

      <section className="mt-5 primary-form-card">
        {sessionCheckPending ? (
          <StatusMessage kind="info">Проверяем вашу сессию перед выбором роли…</StatusMessage>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => selectProfile(option.value)}
                disabled={loadingProfile !== null}
                className={`role-choice-card ${option.toneClass} disabled:opacity-60`}
              >
                <p className="landing-chip bg-white/80 text-xs uppercase tracking-[0.14em] text-neutral-700">Стартовый профиль</p>
                <h2 className="mt-4 text-2xl font-black tracking-tight">{option.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-neutral-700">{option.description}</p>
                <ul className="mt-4 space-y-2 text-sm text-neutral-700">
                  {option.points.map((point) => (
                    <li key={point}>• {point}</li>
                  ))}
                </ul>
                <p className="mt-5 text-sm font-semibold">{loadingProfile === option.value ? 'Создаём профиль…' : 'Выбрать и продолжить'}</p>
              </button>
            ))}
          </div>
        )}

        {sessionError && (
          <div className="mt-4 space-y-3">
            <StatusMessage kind="error">{sessionError}</StatusMessage>
            <button type="button" onClick={() => window.location.reload()} className="landing-btn landing-btn-muted border-black/15">
              Повторить
            </button>
          </div>
        )}

        {error && (
          <div className="mt-4">
            <StatusMessage kind="error">{error}</StatusMessage>
          </div>
        )}
      </section>
    </ProductShell>
  );
}
