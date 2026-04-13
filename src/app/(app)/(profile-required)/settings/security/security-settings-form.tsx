"use client";

import { FormEvent, useState } from "react";
import { SettingsShell } from "@/components/settings-shell";

type SecuritySettingsFormProps = {
  initialHasPin: boolean;
};

export function SecuritySettingsForm({
  initialHasPin,
}: SecuritySettingsFormProps) {
  const [hasPin, setHasPin] = useState(initialHasPin);
  const [newPin, setNewPin] = useState("");
  const [currentSecret, setCurrentSecret] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    try {
      setLoading(true);
      const response = await fetch("/api/settings/security/pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPin, currentSecret }),
      });
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!response.ok)
        throw new Error(payload?.error ?? "Не удалось сохранить PIN.");

      setHasPin(true);
      setCurrentSecret("");
      setNewPin("");
      setSuccess("PIN успешно сохранён.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось сохранить PIN.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <SettingsShell
      eyebrow="Личное"
      title="PIN-код входа"
      description={`Статус: ${hasPin ? "PIN настроен" : "PIN не настроен"}.`}
    >
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        {hasPin && (
          <label className="block">
            <span className="mb-2 block text-sm font-medium">
              Подтвердите текущим паролем или старым PIN
            </span>
            <input
              type="password"
              value={currentSecret}
              onChange={(e) => setCurrentSecret(e.target.value)}
              className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3"
            />
          </label>
        )}
        <label className="block">
          <span className="mb-2 block text-sm font-medium">
            Новый PIN (4–8 цифр)
          </span>
          <input
            value={newPin}
            onChange={(e) => setNewPin(e.target.value)}
            className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3"
          />
        </label>

        {error && (
          <p className="rounded-2xl bg-red-100 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        )}
        {success && (
          <p className="rounded-2xl bg-emerald-100 px-4 py-3 text-sm text-emerald-700">
            {success}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-2xl bg-black px-4 py-3 font-semibold text-white disabled:opacity-60"
        >
          {loading ? "Сохраняем…" : hasPin ? "Изменить PIN" : "Создать PIN"}
        </button>
      </form>
    </SettingsShell>
  );
}
