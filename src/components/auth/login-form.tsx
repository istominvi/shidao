"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { AuthLink } from "@/components/auth/auth-page";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  FieldControl,
  FieldLabel,
  FormField,
} from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { useSessionView } from "@/components/use-session-view";
import { loginWithIdentifier } from "@/lib/auth-flow";
import { ROUTES } from "@/lib/auth";
import { resolveClientPostLoginRoute } from "@/lib/auth-redirects";

type LoginFormProps = {
  requestedRoute?: string;
  successHint?: string;
};

export function LoginForm({ requestedRoute, successHint }: LoginFormProps) {
  const router = useRouter();
  const { refetchSession } = useSessionView();
  const [identifier, setIdentifier] = useState("");
  const [secret, setSecret] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (!identifier.trim() || !secret.trim()) {
      setError("Заполните оба поля для входа.");
      return;
    }

    try {
      setLoading(true);
      const route = await loginWithIdentifier(identifier, secret);
      await refetchSession();
      router.push(resolveClientPostLoginRoute(route, requestedRoute));
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Не удалось выполнить вход.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {successHint ? <Alert tone="success">{successHint}</Alert> : null}

      <form className="auth-form" onSubmit={onSubmit}>
        <FormField>
          <FieldLabel htmlFor="login-identifier">Email или логин</FieldLabel>
          <FieldControl>
            <Input
              id="login-identifier"
              name="identifier"
              type="text"
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              placeholder="name@example.com или learner-login"
              className="w-full"
              autoComplete="username"
              maxLength={254}
              required
            />
          </FieldControl>
        </FormField>

        <FormField>
          <div className="auth-field-label-row">
            <FieldLabel htmlFor="login-secret">Пароль или PIN-код</FieldLabel>
            <AuthLink href={ROUTES.forgotPassword}>
              Забыли пароль или PIN?
            </AuthLink>
          </div>
          <FieldControl>
            <Input
              id="login-secret"
              name="secret"
              type="password"
              value={secret}
              onChange={(event) => setSecret(event.target.value)}
              placeholder="Введите пароль или PIN"
              className="w-full"
              autoComplete="current-password"
              maxLength={256}
              required
            />
          </FieldControl>
        </FormField>

        {error ? <Alert tone="error">{error}</Alert> : null}

        <Button
          variant="inverse"
          disabled={loading}
          className="auth-submit"
          type="submit"
        >
          {loading ? "Входим…" : "Войти"}
        </Button>
      </form>
    </>
  );
}
