"use client";

import { Suspense } from "react";
import { FormEvent, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { SettingsShell } from "@/components/settings-shell";
import { StatusMessage } from "@/components/product-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function ProfileSettingsPageContent() {
  const searchParams = useSearchParams();
  const [newEmail, setNewEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailSuccess, setEmailSuccess] = useState<string | null>(null);
  const [emailLoading, setEmailLoading] = useState(false);

  const queryStatus = useMemo(() => {
    if (searchParams.get("emailChanged") === "1") {
      return {
        kind: "success" as const,
        text: "Новый email подтверждён. Профиль обновлён.",
      };
    }
    if (searchParams.get("emailChangeRequested") === "1") {
      return {
        kind: "info" as const,
        text: "Запрос отправлен. Подтвердите новый email через письмо.",
      };
    }
    return null;
  }, [searchParams]);

  async function onEmailSubmit(event: FormEvent) {
    event.preventDefault();
    setEmailError(null);
    setEmailSuccess(null);

    try {
      setEmailLoading(true);
      const response = await fetch("/api/settings/profile/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          newEmail: newEmail.trim().toLowerCase(),
          currentPassword,
        }),
      });
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!response.ok) {
        throw new Error(
          payload?.error ?? "Не удалось отправить запрос на смену email.",
        );
      }

      setEmailSuccess("Письмо подтверждения отправлено на новый email.");
      setCurrentPassword("");
      setNewEmail("");
    } catch (submitError) {
      setEmailError(
        submitError instanceof Error
          ? submitError.message
          : "Не удалось отправить запрос на смену email.",
      );
    } finally {
      setEmailLoading(false);
    }
  }

  return (
    <SettingsShell
      title="Профиль и email"
      description="Для безопасности подтвердите действие текущим паролем."
    >
      {queryStatus && (
        <div className="mt-4">
          <StatusMessage kind={queryStatus.kind}>
            {queryStatus.text}
          </StatusMessage>
        </div>
      )}

      <form onSubmit={onEmailSubmit} className="mt-6 space-y-4">
        <label className="block">
          <span className="mb-2 block text-sm font-medium">Новый email</span>
          <Input
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="mb-2 block text-sm font-medium">Текущий пароль</span>
          <Input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
        </label>

        {emailError && <StatusMessage kind="error">{emailError}</StatusMessage>}
        {emailSuccess && (
          <StatusMessage kind="success">{emailSuccess}</StatusMessage>
        )}

        <Button type="submit" disabled={emailLoading} className="w-full">
          {emailLoading ? "Отправляем…" : "Запросить смену email"}
        </Button>
      </form>
    </SettingsShell>
  );
}

export default function ProfileSettingsPage() {
  return (
    <Suspense fallback={null}>
      <ProfileSettingsPageContent />
    </Suspense>
  );
}
