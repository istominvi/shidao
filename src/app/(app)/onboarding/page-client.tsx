"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppPageHeader } from "@/components/app/page-header";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FormField, FieldLabel } from "@/components/ui/form-field";
import { Input, Select } from "@/components/ui/input";
import { SurfaceCard } from "@/components/ui/surface-card";
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
    <main className="app-page-shell onboarding-page-shell pb-12">
      <div className="container app-page-container onboarding-page-container">
        <AppPageHeader title="Настройка аккаунта" />

        <div className="onboarding-workspace">
          <SurfaceCard
            as="section"
            className="onboarding-profile-card"
            title="Расскажите немного о себе"
            description="Эти общие настройки не ограничивают возможности: любой аккаунт может создавать курсы, работать с учащимися, учиться и наблюдать прогресс."
          >
            <form onSubmit={submit} className="onboarding-form">
              <FormField>
                <FieldLabel htmlFor="onboarding-display-name">Имя</FieldLabel>
                <Input
                  id="onboarding-display-name"
                  name="displayName"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  required
                  maxLength={160}
                  autoComplete="name"
                />
              </FormField>

              <div className="onboarding-form-grid">
                <FormField>
                  <FieldLabel htmlFor="onboarding-locale">Язык</FieldLabel>
                  <Select
                    id="onboarding-locale"
                    name="locale"
                    value={locale}
                    onChange={(event) => setLocale(event.target.value)}
                  >
                    <option value="ru">Русский</option>
                  </Select>
                </FormField>
                <FormField>
                  <FieldLabel htmlFor="onboarding-timezone">
                    Часовой пояс
                  </FieldLabel>
                  <Select
                    id="onboarding-timezone"
                    name="timezone"
                    value={timezone}
                    onChange={(event) => setTimezone(event.target.value)}
                  >
                    {TIMEZONE_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </Select>
                </FormField>
              </div>

              {error ? <Alert tone="error">{error}</Alert> : null}

              <Button type="submit" disabled={loading} className="w-full">
                {loading ? "Сохраняем…" : "Сохранить и продолжить"}
              </Button>
            </form>
          </SurfaceCard>
        </div>
      </div>
    </main>
  );
}
