"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import {
  PageHero,
  ProductShell,
  StatusMessage,
} from "@/components/product-shell";
import { Button } from "@/components/ui/button";
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
    <ProductShell>
      <PageHero
        eyebrow="Восстановление доступа"
        title="Забыли пароль или PIN?"
        description="Для аккаунта с email отправим ссылку сброса. Доступ к отдельному аккаунту учащегося без email восстанавливает назначенный при активации доверенный взрослый."
      />

      <div className="mx-auto mt-4 w-full max-w-xl">
        <div className="primary-form-card">
          <h2 className="text-2xl font-black tracking-tight">Сброс пароля</h2>
          <form className="mt-5 space-y-4" onSubmit={onSubmit}>
            <label className="block">
              <span className="field-label">Email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="field-input"
                placeholder="you@example.com"
              />
            </label>

            {error && <StatusMessage kind="error">{error}</StatusMessage>}
            {success && <StatusMessage kind="success">{success}</StatusMessage>}

            <Button disabled={loading} className="w-full" type="submit">
              {loading ? "Отправляем…" : "Отправить письмо"}
            </Button>
          </form>

          <p className="mt-5 text-sm text-neutral-600">
            Если учащийся входит по отдельному логину и PIN без собственного
            email, попросите доверенного взрослого открыть «Настройки →
            Безопасность → Доступ учащегося». ShiDao не показывает, существует
            ли введённый логин или email.
          </p>

          <p className="mt-3 text-sm text-neutral-600">
            Вспомнили пароль?{" "}
            <Link
              href={ROUTES.login}
              className="font-semibold underline decoration-black/25 underline-offset-2"
            >
              Вернуться ко входу
            </Link>
          </p>
        </div>
      </div>
    </ProductShell>
  );
}
