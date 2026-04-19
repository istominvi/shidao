"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageHero, ProductShell, StatusMessage } from "@/components/product-shell";
import { useSessionView } from "@/components/use-session-view";
import { ROUTES, type ProfileKind } from "@/lib/auth";

const PROFILE_OPTIONS: Array<{
  value: ProfileKind;
  title: string;
  description: string;
  bullets: string[];
}> = [
  {
    value: "parent",
    title: "Я родитель",
    description: "Слежу за прогрессом ребёнка по урокам и домашним заданиям.",
    bullets: [
      "Расписание и статусы занятий",
      "Результаты и комментарии преподавателя",
      "Сводка по каждому ребёнку",
    ],
  },
  {
    value: "teacher",
    title: "Я преподаватель",
    description: "Веду группы, уроки и домашнюю работу в рабочем кабинете.",
    bullets: [
      "Планирование уроков по методике",
      "Назначение и проверка домашней работы",
      "Коммуникация по уроку и заданию",
    ],
  },
];

function resolveHeroContent(manageMode: boolean) {
  if (manageMode) {
    return {
      eyebrow: "Добавление второй роли",
      title: "Добавьте ещё один кабинет",
      description:
        "В одном аккаунте можно подключить роль родителя и преподавателя и переключаться между ними в меню профиля.",
    };
  }

  return {
    eyebrow: "Первый вход",
    title: "Выберите стартовый кабинет",
    description:
      "Начните с одной роли. Вторую взрослую роль можно добавить позже без нового аккаунта.",
  };
}

export function OnboardingPageClient({ manageMode }: { manageMode: boolean }) {
  const router = useRouter();
  const { refetchSession } = useSessionView();
  const [loadingProfile, setLoadingProfile] = useState<ProfileKind | null>(null);
  const [error, setError] = useState<string | null>(null);
  const hero = resolveHeroContent(manageMode);

  async function selectProfile(profile: ProfileKind) {
    setError(null);
    setLoadingProfile(profile);

    try {
      const response = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile }),
      });

      const payload = (await response.json().catch(() => null)) as
        | { error?: string; redirectTo?: string }
        | null;
      if (!response.ok) {
        throw new Error(payload?.error ?? "Не удалось завершить онбординг.");
      }

      await refetchSession();
      router.push(payload?.redirectTo ?? ROUTES.dashboard);
      router.refresh();
    } catch (selectError) {
      setError(
        selectError instanceof Error
          ? selectError.message
          : "Не удалось завершить онбординг.",
      );
    } finally {
      setLoadingProfile(null);
    }
  }

  return (
    <ProductShell contentClassName="max-w-4xl">
      <PageHero
        eyebrow={hero.eyebrow}
        title={hero.title}
        description={hero.description}
      />

      <section className="mt-5 rounded-2xl border border-neutral-200 bg-white p-4 md:p-5">
        <div className="grid gap-4 md:grid-cols-2">
          {PROFILE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => selectProfile(option.value)}
              disabled={loadingProfile !== null}
              className="rounded-2xl border border-neutral-200 bg-white p-4 text-left transition hover:border-neutral-400 disabled:opacity-60"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">
                Стартовый профиль
              </p>
              <h2 className="mt-3 text-2xl font-black tracking-tight">{option.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-neutral-700">
                {option.description}
              </p>
              <ul className="mt-4 space-y-1.5 text-sm text-neutral-700">
                {option.bullets.map((bullet) => (
                  <li key={bullet}>• {bullet}</li>
                ))}
              </ul>
              <p className="mt-5 text-sm font-semibold text-neutral-900">
                {loadingProfile === option.value
                  ? "Создаём профиль…"
                  : "Выбрать и продолжить"}
              </p>
            </button>
          ))}
        </div>

        {error ? (
          <div className="mt-4">
            <StatusMessage kind="error">{error}</StatusMessage>
          </div>
        ) : null}
      </section>
    </ProductShell>
  );
}
