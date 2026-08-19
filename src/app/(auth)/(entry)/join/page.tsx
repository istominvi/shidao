"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { AuthLink, AuthPage } from "@/components/auth/auth-page";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  FieldControl,
  FieldLabel,
  FormField,
} from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { ROUTES } from "@/lib/auth";
import { afterLogin } from "@/lib/auth-redirects";

export default function JoinPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (!name.trim() || !email.trim() || password.length < 8) {
      setError("Укажите имя, корректный email и пароль не короче 8 символов.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Пароль и подтверждение не совпадают.");
      return;
    }

    if (!agreed) {
      setError("Нужно согласиться с условиями и политикой.");
      return;
    }

    try {
      setLoading(true);
      const normalizedEmail = email.trim().toLowerCase();
      const safeNext = afterLogin(
        new URLSearchParams(window.location.search).get("next"),
      );
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: normalizedEmail,
          password,
          next: safeNext,
        }),
        cache: "no-store",
      });

      const payload = (await response.json().catch(() => null)) as {
        error?: string;
        redirectTo?: string;
      } | null;
      if (!response.ok) {
        throw new Error(
          payload?.error ??
            "Не удалось завершить регистрацию. Попробуйте ещё раз.",
        );
      }
      if (!payload?.redirectTo) {
        throw new Error("Сервер не вернул маршрут после регистрации.");
      }

      router.push(payload.redirectTo);
    } catch (submitError) {
      if (
        submitError instanceof TypeError &&
        submitError.message.includes("fetch")
      ) {
        setError(
          "Проблема с сетью. Проверьте подключение и попробуйте ещё раз.",
        );
      } else {
        setError(
          submitError instanceof Error
            ? submitError.message
            : "Ошибка регистрации.",
        );
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthPage
      title="Создать аккаунт"
      description="Один аккаунт открывает курсы, уроки и работу с учащимися — без выбора роли при регистрации."
      footer={
        <p>
          Уже есть аккаунт? <AuthLink href={ROUTES.login}>Войти</AuthLink>
        </p>
      }
    >
      <form className="auth-form" onSubmit={onSubmit}>
        <FormField>
          <FieldLabel htmlFor="join-name">Имя</FieldLabel>
          <FieldControl>
            <Input
              id="join-name"
              name="name"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="w-full"
              placeholder="Как к вам обращаться"
              autoComplete="name"
              maxLength={160}
              required
            />
          </FieldControl>
        </FormField>

        <FormField>
          <FieldLabel htmlFor="join-email">Email</FieldLabel>
          <FieldControl>
            <Input
              id="join-email"
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

        <FormField>
          <FieldLabel htmlFor="join-password">Пароль</FieldLabel>
          <FieldControl>
            <Input
              id="join-password"
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
          <FieldLabel htmlFor="join-confirm-password">
            Подтверждение пароля
          </FieldLabel>
          <FieldControl>
            <Input
              id="join-confirm-password"
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

        <FormField>
          <FieldLabel htmlFor="join-agree" className="auth-consent-label">
            <Checkbox
              id="join-agree"
              name="agreed"
              checked={agreed}
              onChange={(event) => setAgreed(event.target.checked)}
              required
            />
            <span>
              Я согласен(а) с условиями использования и политикой
              конфиденциальности.
            </span>
          </FieldLabel>
        </FormField>

        {error ? <Alert tone="error">{error}</Alert> : null}

        <Button
          variant="inverse"
          disabled={loading}
          className="auth-submit"
          type="submit"
        >
          {loading ? "Создаём аккаунт…" : "Создать аккаунт"}
        </Button>
      </form>
    </AuthPage>
  );
}
