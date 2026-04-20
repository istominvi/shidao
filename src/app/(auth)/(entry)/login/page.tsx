"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useMemo, useState } from "react";
import { ProductShell, StatusMessage } from "@/components/product-shell";
import { Button } from "@/components/ui/button";
import { FieldControl, FieldLabel, FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { useSessionView } from "@/components/use-session-view";
import { loginWithIdentifier } from "@/lib/auth-flow";
import { ROUTES } from "@/lib/auth";

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refetchSession } = useSessionView();
  const [identifier, setIdentifier] = useState("");
  const [secret, setSecret] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const successHint = useMemo(() => {
    if (searchParams.get("registered") === "1") {
      return "Аккаунт создан. Теперь войдите с email и паролем.";
    }
    if (searchParams.get("confirmed") === "1") {
      return "Email подтверждён. Теперь выполните вход.";
    }
    if (searchParams.get("passwordReset") === "1") {
      return "Пароль обновлён. Войдите с новым паролем.";
    }
    return null;
  }, [searchParams]);

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
      router.push(route);
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
    <ProductShell contentClassName="mt-10">
      <div className="mx-auto w-full max-w-[500px]">
        <div className="surface-card">
          <h1 className="surface-card-title text-2xl">
            Войти
          </h1>
          <p className="surface-card-description mt-2">
            Введите данные доступа, которые вы получили при регистрации или от
            учителя/родителя
          </p>

          {successHint && (
            <div className="mt-4">
              <StatusMessage kind="success">{successHint}</StatusMessage>
            </div>
          )}

          <form className="mt-5 space-y-4" onSubmit={onSubmit}>
            <FormField>
              <FieldLabel htmlFor="login-identifier">
                Email или логин ученика
              </FieldLabel>
              <FieldControl>
                <Input
                  id="login-identifier"
                  name="identifier"
                  type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="Например, parent@school.com или login ученика"
                className="w-full"
                autoComplete="username"
                required
                />
              </FieldControl>
            </FormField>
            <FormField>
              <FieldLabel htmlFor="login-secret">Пароль или PIN-код</FieldLabel>
              <FieldControl>
                <Input
                  id="login-secret"
                  name="secret"
                  type="password"
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                placeholder="Введите пароль или PIN"
                className="w-full"
                autoComplete="current-password"
                required
                />
              </FieldControl>
            </FormField>
            <div className="text-right">
              <Link
                href={ROUTES.forgotPassword}
                className="text-sm font-semibold underline decoration-black/20 underline-offset-2"
              >
                Забыли пароль?
              </Link>
            </div>

            {error && <StatusMessage kind="error">{error}</StatusMessage>}

            <Button
              disabled={loading}
              className="auth-submit-btn"
              type="submit"
            >
              {loading ? "Входим…" : "Войти"}
            </Button>
          </form>
        </div>
      </div>
    </ProductShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageContent />
    </Suspense>
  );
}
