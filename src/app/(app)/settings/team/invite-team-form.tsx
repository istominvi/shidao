"use client";

import { FormEvent, useState } from "react";
import { StatusMessage } from "@/components/product-shell";

export function InviteTeamForm() {
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);

  async function onInviteSubmit(event: FormEvent) {
    event.preventDefault();
    setInviteError(null);
    setInviteSuccess(null);

    try {
      setInviteLoading(true);
      const response = await fetch("/api/admin/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail.trim().toLowerCase() }),
      });
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!response.ok) {
        throw new Error(payload?.error ?? "Не удалось отправить приглашение.");
      }

      setInviteSuccess("Приглашение отправлено.");
      setInviteEmail("");
    } catch (submitError) {
      setInviteError(
        submitError instanceof Error
          ? submitError.message
          : "Не удалось отправить приглашение.",
      );
    } finally {
      setInviteLoading(false);
    }
  }

  return (
    <form onSubmit={onInviteSubmit} className="mt-6 space-y-4">
      <label className="block">
        <span className="mb-2 block text-sm font-medium">
          Email приглашённого
        </span>
        <input
          type="email"
          value={inviteEmail}
          onChange={(e) => setInviteEmail(e.target.value)}
          className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3"
        />
      </label>

      {inviteError && <StatusMessage kind="error">{inviteError}</StatusMessage>}
      {inviteSuccess && (
        <StatusMessage kind="success">{inviteSuccess}</StatusMessage>
      )}

      <button
        type="submit"
        disabled={inviteLoading}
        className="w-full rounded-2xl bg-black px-4 py-3 font-semibold text-white disabled:opacity-60"
      >
        {inviteLoading ? "Отправляем…" : "Отправить приглашение"}
      </button>
    </form>
  );
}
