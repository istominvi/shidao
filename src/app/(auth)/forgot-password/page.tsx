"use client";

import { type FormEvent, useState } from "react";
import { AuthPage } from "@/components/auth/auth-page";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  FieldControl,
  FieldLabel,
  FormField,
} from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { ROUTES } from "@/lib/auth";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    try {
      setLoading(true);
      const response = await fetch("/api/auth/recovery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });

      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!response.ok) {
        throw new Error(
          payload?.error ?? "Не удалось отправить письмо восстановления.",
        );
      }

      setSuccess(
        "Если такой email зарегистрирован, мы отправили письмо для восстановления пароля.",
      );
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Не удалось отправить письмо восстановления.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthPage
      title="Восстановить доступ"
      description="Для аккаунта с email отправим безопасную ссылку для создания нового пароля."
      backLink={{ href: ROUTES.login, label: "Ко входу" }}
    >
      <form className="auth-form" onSubmit={onSubmit}>
        <FormField>
          <FieldLabel htmlFor="recovery-email">Email</FieldLabel>
          <FieldControl>
            <Input
              id="recovery-email"
              name="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full"
              placeholder="you@example.com"
              autoComplete="email"
              maxLength={254}
              required
            />
          </FieldControl>
        </FormField>

        {error ? <Alert tone="error">{error}</Alert> : null}
        {success ? <Alert tone="success">{success}</Alert> : null}

        <Button
          variant="inverse"
          disabled={loading}
          className="auth-submit"
          type="submit"
        >
          {loading ? "Отправляем…" : "Отправить письмо"}
        </Button>
      </form>

      <Alert
        tone="neutral"
        title="Если учащийся входит по логину и PIN"
        className="auth-support-note"
      >
        Доступ восстанавливает доверенный взрослый в разделе «Настройки →
        Безопасность → Доступ учащегося». ShiDao не сообщает, существует ли
        введённый логин или email.
      </Alert>
    </AuthPage>
  );
}
