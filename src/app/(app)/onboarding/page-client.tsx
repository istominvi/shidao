"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  PageHero,
  ProductShell,
  StatusMessage,
} from "@/components/product-shell";
import { useSessionView } from "@/components/use-session-view";
import { ROUTES } from "@/lib/auth";

const TIMEZONE_OPTIONS = [
  "Europe/Moscow",
  "Asia/Chita",
  "Asia/Yekaterinburg",
  "Asia/Novosibirsk",
  "Asia/Vladivostok",
] as const;

export function OnboardingPageClient() {
  const router = useRouter();
  const { state, refetchSession } = useSessionView();
  const [displayName, setDisplayName] = useState("");
  const [locale, setLocale] = useState("ru");
  const [timezone, setTimezone] = useState("Europe/Moscow");
  const [initialized, setInitialized] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialized || state.kind !== "account") return;
    setDisplayName(state.fullName ?? "");
    setLocale(state.locale);
    setTimezone(state.timezone);
    setInitialized(true);
  }, [initialized, state]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName, locale, timezone }),
      });
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
        redirectTo?: string;
      } | null;
      if (!response.ok) {
        throw new Error(payload?.error ?? "Не удалось сохранить профиль.");
      }

      await refetchSession();
      router.push(payload?.redirectTo ?? ROUTES.courses);
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Не удалось сохранить профиль.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <ProductShell contentClassName="max-w-3xl">
      <PageHero
        eyebrow="Настройка аккаунта"
        title="Расскажите немного о себе"
        description="Эти общие настройки не ограничивают возможности: любой аккаунт может создавать курсы, работать с учениками, учиться и наблюдать прогресс."
      />

      <form
        onSubmit={submit}
        className="primary-form-card mt-5 space-y-4 md:p-5"
      >
        <label className="block">
          <span className="mb-2 block text-sm font-medium">Имя</span>
          <input
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            required
            maxLength={160}
            autoComplete="name"
            className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3"
          />
        </label>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-sm font-medium">Язык</span>
            <select
              value={locale}
              onChange={(event) => setLocale(event.target.value)}
              className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3"
            >
              <option value="ru">Русский</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-medium">Часовой пояс</span>
            <select
              value={timezone}
              onChange={(event) => setTimezone(event.target.value)}
              className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3"
            >
              {TIMEZONE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        </div>

        {error ? <StatusMessage kind="error">{error}</StatusMessage> : null}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-2xl bg-black px-4 py-3 font-semibold text-white disabled:opacity-60"
        >
          {loading ? "Сохраняем…" : "Сохранить и продолжить"}
        </button>
      </form>
    </ProductShell>
  );
}
