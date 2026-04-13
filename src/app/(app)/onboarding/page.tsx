"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PageHero, ProductShell, StatusMessage } from "@/components/product-shell";
import { useSessionView } from "@/components/use-session-view";
import { ROUTES, type ProfileKind } from "@/lib/auth";

const PROFILE_OPTIONS: Array<{
  value: ProfileKind;
  title: string;
  description: string;
}> = [
  {
    value: "parent",
    title: "Я родитель",
    description: "Слежу за прогрессом ребёнка по урокам и домашним заданиям.",
  },
  {
    value: "teacher",
    title: "Я преподаватель",
    description: "Веду группы, уроки и домашнюю работу в рабочем кабинете.",
  },
];

function resolveHeroContent(manageMode: boolean) {
  return manageMode
    ? {
        eyebrow: "Добавление второй роли",
        title: "Добавьте ещё один кабинет",
        description: "Подключите вторую роль и переключайтесь между кабинетами в меню профиля.",
      }
    : {
        eyebrow: "Первый вход",
        title: "Выберите стартовый кабинет",
        description: "Начните с одной роли. Вторую взрослую роль можно добавить позже без нового аккаунта.",
      };
}

function RoleChoiceCard({
  title,
  description,
  busy,
  disabled,
  onSelect,
}: {
  title: string;
  description: string;
  busy: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      className="rounded-2xl border border-neutral-200 bg-white p-5 text-left transition hover:border-neutral-400 disabled:opacity-60"
    >
      <h2 className="text-2xl font-black tracking-tight">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-neutral-700">{description}</p>
      <p className="mt-5 text-sm font-semibold text-neutral-900">
        {busy ? "Создаём профиль…" : "Выбрать и продолжить"}
      </p>
    </button>
  );
}

function OnboardingPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refetchSession } = useSessionView();
  const manageMode = searchParams.get("mode") === "add-profile";
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
      setError(selectError instanceof Error ? selectError.message : "Не удалось завершить онбординг.");
    } finally {
      setLoadingProfile(null);
    }
  }

  return (
    <ProductShell contentClassName="max-w-3xl">
      <PageHero eyebrow={hero.eyebrow} title={hero.title} description={hero.description} />

      <section className="mt-5 rounded-2xl border border-neutral-200 bg-white p-4 md:p-5">
        <div className="grid gap-4 md:grid-cols-2">
          {PROFILE_OPTIONS.map((option) => (
            <RoleChoiceCard
              key={option.value}
              title={option.title}
              description={option.description}
              busy={loadingProfile === option.value}
              disabled={loadingProfile !== null}
              onSelect={() => void selectProfile(option.value)}
            />
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

export default function OnboardingPage() {
  return (
    <Suspense fallback={null}>
      <OnboardingPageContent />
    </Suspense>
  );
}
