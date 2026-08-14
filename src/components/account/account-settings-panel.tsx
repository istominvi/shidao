"use client";

import { type FormEvent, useMemo, useState } from "react";
import { SecuritySettingsForm } from "@/app/(app)/(profile-required)/settings/security/security-settings-form";
import { StatusMessage } from "@/components/product-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SurfaceCard } from "@/components/ui/surface-card";

export type AccountEmailStatus = "changed" | "change-requested" | null;

type AccountSettingsPanelProps = {
  initialHasPin: boolean;
  emailStatus: AccountEmailStatus;
  onHasPinChange?: (hasPin: boolean) => void;
};

export function AccountSettingsPanel({
  initialHasPin,
  emailStatus,
  onHasPinChange,
}: AccountSettingsPanelProps) {
  const [newEmail, setNewEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailSuccess, setEmailSuccess] = useState<string | null>(null);
  const [emailLoading, setEmailLoading] = useState(false);

  const queryStatus = useMemo(() => {
    if (emailStatus === "changed") {
      return {
        kind: "success" as const,
        text: "Новый email подтверждён. Профиль обновлён.",
      };
    }
    if (emailStatus === "change-requested") {
      return {
        kind: "info" as const,
        text: "Запрос отправлен. Подтвердите новый email через письмо.",
      };
    }
    return null;
  }, [emailStatus]);

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
    <div className="space-y-6">
      <SurfaceCard
        title="Профиль и email"
        description="Смена email завершится только после подтверждения нового адреса."
      >
        {queryStatus ? (
          <StatusMessage kind={queryStatus.kind}>
            {queryStatus.text}
          </StatusMessage>
        ) : null}

        <form onSubmit={onEmailSubmit} className="mt-4 space-y-4">
          <label className="block">
            <span className="mb-2 block text-sm font-medium">Новый email</span>
            <Input
              type="email"
              value={newEmail}
              onChange={(event) => setNewEmail(event.target.value)}
              required
              autoComplete="email"
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-medium">
              Текущий пароль
            </span>
            <Input
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              required
              autoComplete="current-password"
            />
          </label>

          {emailError ? (
            <StatusMessage kind="error">{emailError}</StatusMessage>
          ) : null}
          {emailSuccess ? (
            <StatusMessage kind="success">{emailSuccess}</StatusMessage>
          ) : null}

          <Button type="submit" disabled={emailLoading}>
            {emailLoading ? "Отправляем…" : "Запросить смену email"}
          </Button>
        </form>
      </SurfaceCard>

      <SecuritySettingsForm
        initialHasPin={initialHasPin}
        onHasPinChange={onHasPinChange}
      />
    </div>
  );
}
