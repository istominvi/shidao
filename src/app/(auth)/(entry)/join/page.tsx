"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { ProductShell, StatusMessage } from "@/components/product-shell";
import { Button } from "@/components/ui/button";
import { FieldControl, FieldLabel, FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { ROUTES } from "@/lib/auth";

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
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: normalizedEmail,
          password,
        }),
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
    <ProductShell contentClassName="auth-entry-content">
      <div className="auth-entry-center-frame w-full max-w-xl">
        <div className="primary-form-card">
          <h2 className="text-2xl font-black tracking-tight">
            Создать аккаунт
          </h2>
          <p className="mt-2 text-sm text-neutral-600">
            Зарегистрируйте взрослый аккаунт. После регистрации вы перейдёте к
            подтверждению email или сразу ко входу.
          </p>

          <form className="mt-5 space-y-4" onSubmit={onSubmit}>
            <FormField>
              <FieldLabel htmlFor="join-name">Имя</FieldLabel>
              <FieldControl>
                <Input
                  id="join-name"
                  name="name"
                  type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full"
                placeholder="Как к вам обращаться"
                autoComplete="name"
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
                onChange={(e) => setEmail(e.target.value)}
                className="w-full"
                placeholder="you@example.com"
                autoComplete="email"
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
                onChange={(e) => setPassword(e.target.value)}
                className="w-full"
                placeholder="Минимум 8 символов"
                autoComplete="new-password"
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
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full"
                autoComplete="new-password"
                required
                />
              </FieldControl>
            </FormField>

            <FormField>
              <FieldLabel htmlFor="join-agree" className="flex items-start gap-2">
                <input
                  id="join-agree"
                  type="checkbox"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  className="mt-0.5 size-4"
                />
                <span>
                  Я согласен(а) с условиями использования и политикой
                  конфиденциальности.
                </span>
              </FieldLabel>
            </FormField>

            {error && <StatusMessage kind="error">{error}</StatusMessage>}

            <Button
              disabled={loading}
              className="w-full"
              type="submit"
            >
              {loading ? "Создаём аккаунт…" : "Создать аккаунт"}
            </Button>
          </form>

          <p className="mt-5 text-sm text-neutral-600">
            Уже есть аккаунт?{" "}
            <Link
              href={ROUTES.login}
              className="font-semibold underline decoration-black/25 underline-offset-2"
            >
              Войти
            </Link>
          </p>
        </div>
      </div>
    </ProductShell>
  );
}
