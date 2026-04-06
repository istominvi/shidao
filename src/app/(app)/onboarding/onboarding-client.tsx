"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import {
  ContextCard,
  PageHero,
  ProductShell,
  StatusMessage,
} from "@/components/product-shell";
import { useSessionView } from "@/components/use-session-view";
import { ROUTES, type ProfileKind } from "@/lib/auth";

const options: Array<{
  value: ProfileKind;
  title: string;
  description: string;
  points: string[];
  toneClass: string;
}> = [
  {
    value: "parent",
    title: "Я родитель",
    description:
      "Буду следить за прогрессом ребёнка и видеть обучение в контексте уроков.",
    points: [
      "Расписание и статусы в одном месте",
      "Комментарии преподавателя по каждому занятию",
      "Единый обзор по детям",
    ],
    toneClass:
      "bg-[linear-gradient(140deg,rgba(201,255,79,0.35),rgba(255,182,232,0.25),rgba(255,255,255,0.9))]",
  },
  {
    value: "teacher",
    title: "Я преподаватель",
    description:
      "Буду вести группы, уроки и задания в структурированной рабочей зоне.",
    points: [
      "Планирование уроков по методике",
      "Назначение домашней работы и проверка",
      "Коммуникация в треде конкретного урока",
    ],
    toneClass:
      "bg-[linear-gradient(140deg,rgba(112,183,255,0.33),rgba(201,180,255,0.25),rgba(255,255,255,0.9))]",
  },
];

function OnboardingPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refetchSession } = useSessionView();
  const manageMode = searchParams.get("mode") === "add-profile";
  const [loadingProfile, setLoadingProfile] = useState<ProfileKind | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  async function selectProfile(profile: ProfileKind) {
    setError(null);
    setLoadingProfile(profile);

    try {
      const response = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile }),
      });

      const payload = (await response.json().catch(() => null)) as {
        error?: string;
        redirectTo?: string;
      } | null;
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
    <ProductShell>
      <PageHero
        eyebrow={
          manageMode
            ? "Расширение взрослого доступа"
            : "Первый шаг внутри платформы"
        }
        title={
          manageMode
            ? "Добавьте второй кабинет в Shidao"
            : "Выберите, как начнёте работу в Shidao"
        }
        description={
          manageMode
            ? "Вы можете добавить вторую взрослую роль к текущему аккаунту и переключаться между кабинетами в меню профиля."
            : "Это стартовый профиль. Позже вы сможете добавить вторую взрослую роль, не создавая новый аккаунт."
        }
      />

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <ContextCard
          tone="amber"
          title="Гибкий старт"
          description="Начните с одной роли сейчас и расширьте доступ, когда это понадобится."
        />
        <ContextCard
          tone="sky"
          title="Без потери данных"
          description="История уроков и коммуникация сохраняются внутри одного взрослого аккаунта."
        />
        <ContextCard
          tone="neutral"
          title="Быстрый переход"
          description="После выбора профиля сразу попадёте в рабочий кабинет."
        />
      </div>

      <section className="mt-5 primary-form-card">
        <div className="grid gap-4 md:grid-cols-2">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => selectProfile(option.value)}
              disabled={loadingProfile !== null}
              className={`role-choice-card ${option.toneClass} disabled:opacity-60`}
            >
              <p className="landing-chip bg-white/80 text-xs uppercase tracking-[0.14em] text-neutral-700">
                Стартовый профиль
              </p>
              <h2 className="mt-4 text-2xl font-black tracking-tight">
                {option.title}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-neutral-700">
                {option.description}
              </p>
              <ul className="mt-4 space-y-2 text-sm text-neutral-700">
                {option.points.map((point) => (
                  <li key={point}>• {point}</li>
                ))}
              </ul>
              <p className="mt-5 text-sm font-semibold">
                {loadingProfile === option.value
                  ? "Создаём профиль…"
                  : "Выбрать и продолжить"}
              </p>
            </button>
          ))}
        </div>

        {error && (
          <div className="mt-4">
            <StatusMessage kind="error">{error}</StatusMessage>
          </div>
        )}
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
