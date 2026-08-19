"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { AuthPage } from "@/components/auth/auth-page";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  FieldControl,
  FieldLabel,
  FormField,
} from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";

export default function ResetPasswordPage() {
  const router = useRouter();
  const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(
    () => () => {
      if (redirectTimerRef.current) {
        clearTimeout(redirectTimerRef.current);
      }
    },
    [],
  );

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    try {
      setLoading(true);
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, confirmPassword }),
      });
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
        redirectTo?: string;
      } | null;
      if (!response.ok) {
        throw new Error(payload?.error ?? "Не удалось обновить пароль.");
      }
      const redirectTo = payload?.redirectTo;
      if (!redirectTo) {
        throw new Error("Сервер не вернул маршрут после обновления пароля.");
      }

      setSuccess("Пароль обновлён. Перенаправляем на страницу входа…");
      redirectTimerRef.current = setTimeout(() => {
        router.replace(redirectTo);
      }, 700);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Не удалось обновить пароль.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthPage
      title="Создать новый пароль"
      description="Введите новый пароль для взрослого аккаунта Shidao после подтверждения письма восстановления."
    >
      <form className="auth-form" onSubmit={onSubmit}>
        <FormField>
          <FieldLabel htmlFor="reset-password">Новый пароль</FieldLabel>
          <FieldControl>
            <Input
              id="reset-password"
              name="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full"
              placeholder="Минимум 8 символов"
              autoComplete="new-password"
              minLength={8}
              maxLength={256}
              required
            />
          </FieldControl>
        </FormField>

        <FormField>
          <FieldLabel htmlFor="reset-confirm-password">
            Подтверждение пароля
          </FieldLabel>
          <FieldControl>
            <Input
              id="reset-confirm-password"
              name="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="w-full"
              autoComplete="new-password"
              minLength={8}
              maxLength={256}
              required
            />
          </FieldControl>
        </FormField>

        {error ? <Alert tone="error">{error}</Alert> : null}
        {success ? <Alert tone="success">{success}</Alert> : null}

        <Button
          variant="inverse"
          disabled={loading || success !== null}
          className="auth-submit"
          type="submit"
        >
          {loading ? "Сохраняем…" : "Сохранить новый пароль"}
        </Button>
      </form>
    </AuthPage>
  );
}
