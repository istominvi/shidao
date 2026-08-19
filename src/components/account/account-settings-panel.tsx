"use client";

import { type FormEvent, useMemo, useState } from "react";
import { SecuritySettingsForm } from "@/app/(app)/settings/security/security-settings-form";
import { AvatarSettingsForm } from "@/components/account/avatar-settings-form";
import { ProfileSurface } from "@/components/profile/profile-surface";
import profileStyles from "@/components/profile/profile-workspace.module.css";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
    <div className={`${profileStyles.workspace} space-y-5`}>
      <ProfileSurface title="Аватар">
        <AvatarSettingsForm />
      </ProfileSurface>

      <ProfileSurface
        title="Профиль и email"
        description="Смена email завершится только после подтверждения нового адреса."
      >
        {queryStatus ? (
          <Alert tone={queryStatus.kind}>{queryStatus.text}</Alert>
        ) : null}

        <form onSubmit={onEmailSubmit} className="mt-4 space-y-4">
          <label className="block">
            <span className="field-label">Новый email</span>
            <Input
              type="email"
              value={newEmail}
              onChange={(event) => setNewEmail(event.target.value)}
              required
              autoComplete="email"
            />
          </label>
          <label className="block">
            <span className="field-label">Текущий пароль</span>
            <Input
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              required
              autoComplete="current-password"
            />
          </label>

          {emailError ? <Alert tone="error">{emailError}</Alert> : null}
          {emailSuccess ? <Alert tone="success">{emailSuccess}</Alert> : null}

          <Button type="submit" disabled={emailLoading}>
            {emailLoading ? "Отправляем…" : "Запросить смену email"}
          </Button>
        </form>
      </ProfileSurface>

      <SecuritySettingsForm
        initialHasPin={initialHasPin}
        onHasPinChange={onHasPinChange}
      />
    </div>
  );
}
