"use client";

import { ArrowLeft, Copy, Link2, Mail, UserPlus, WifiOff } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DialogShell } from "@/components/ui/dialog-shell";
import type { LearnerGroup } from "@/modules/lesson-runs/domain";
import { createConnection } from "./identity-client";
import { IdentityError } from "./identity-ui";

type Method = "choose" | "share_code" | "email" | "offline";

export function AddLearnerDialog({
  groups,
  onClose,
  onCreateOffline,
  onPendingCreated,
  initialShareCode = "",
}: {
  groups: LearnerGroup[];
  onClose: () => void;
  onCreateOffline: (displayName: string, groupIds: string[]) => Promise<void>;
  onPendingCreated: () => Promise<void> | void;
  initialShareCode?: string;
}) {
  const [method, setMethod] = useState<Method>(
    initialShareCode ? "share_code" : "choose",
  );
  const [localDisplayName, setLocalDisplayName] = useState("");
  const [shareCode, setShareCode] = useState(initialShareCode);
  const [email, setEmail] = useState("");
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    message: string;
    copyLink: string | null;
  } | null>(null);

  async function submit() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      if (method === "offline") {
        await onCreateOffline(localDisplayName.trim(), selectedGroups);
        return;
      }
      if (method !== "email" && method !== "share_code") return;
      const created = await createConnection(
        method === "email"
          ? {
              method,
              email: email.trim(),
              localDisplayName: localDisplayName.trim(),
            }
          : {
              method,
              shareCode: shareCode.trim(),
              localDisplayName: localDisplayName.trim(),
            },
      );
      await onPendingCreated();
      setResult({
        message:
          method === "share_code"
            ? "Запрос отправлен. Ученик появится в активном списке только после подтверждения владельцем аккаунта."
            : "Если адрес можно использовать, получатель увидит приглашение. Ответ одинаков для существующего и нового аккаунта.",
        copyLink: created.copyLink,
      });
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Не удалось отправить запрос.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <DialogShell
      title="Добавить ученика"
      description="Сначала предложите учащемуся подключить свой аккаунт. Профиль без аккаунта нужен, только если заниматься надо уже сейчас."
      onClose={() => {
        if (!busy) onClose();
      }}
      panelClassName="max-w-2xl"
    >
      {result ? (
        <div className="space-y-4">
          <p
            className="rounded-2xl bg-emerald-50 p-4 text-sm leading-relaxed text-emerald-950"
            role="status"
          >
            {result.message}
          </p>
          {result.copyLink ? (
            <div className="rounded-2xl border border-neutral-200 p-4">
              <p className="text-sm font-semibold text-neutral-950">
                Резервная ссылка
              </p>
              <p className="mt-1 text-xs text-neutral-600">
                Ссылка одноразовая, ограничена по времени и сможет сработать
                только для указанного получателя.
              </p>
              <Button
                type="button"
                variant="ghost"
                className="mt-3"
                onClick={() =>
                  void navigator.clipboard.writeText(result.copyLink!)
                }
              >
                <Copy className="h-4 w-4" aria-hidden="true" />
                Копировать ссылку
              </Button>
            </div>
          ) : null}
          <div className="flex justify-end">
            <Button type="button" onClick={onClose}>
              Готово
            </Button>
          </div>
        </div>
      ) : method === "choose" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <button
            data-dialog-initial-focus
            type="button"
            className="rounded-2xl border border-neutral-200 bg-white p-5 text-left transition hover:border-sky-300 hover:bg-sky-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
            onClick={() => setMethod("share_code")}
          >
            <Link2 className="h-6 w-6" aria-hidden="true" />
            <strong className="mt-3 block">Найти аккаунт по коду</strong>
            <span className="mt-1 block text-sm text-neutral-600">
              Одноразовый код или QR выдаёт сам учащийся.
            </span>
          </button>
          <button
            type="button"
            className="rounded-2xl border border-neutral-200 bg-white p-5 text-left transition hover:border-sky-300 hover:bg-sky-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
            onClick={() => setMethod("email")}
          >
            <Mail className="h-6 w-6" aria-hidden="true" />
            <strong className="mt-3 block">Отправить на email</strong>
            <span className="mt-1 block text-sm text-neutral-600">
              Мы не сообщим, существует ли аккаунт с этим адресом.
            </span>
          </button>
          <button
            type="button"
            className="rounded-2xl border border-neutral-200 bg-white p-5 text-left transition hover:border-amber-300 hover:bg-amber-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 sm:col-span-2"
            onClick={() => setMethod("offline")}
          >
            <WifiOff className="h-6 w-6" aria-hidden="true" />
            <strong className="mt-3 block">Создать без аккаунта</strong>
            <span className="mt-1 block text-sm text-neutral-600">
              Можно вести занятия сейчас и адресно пригласить человека позже.
            </span>
          </button>
        </div>
      ) : (
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <button
            type="button"
            className="inline-flex items-center gap-2 text-sm font-semibold text-neutral-700"
            disabled={busy}
            onClick={() => {
              setMethod("choose");
              setError(null);
            }}
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Другой способ
          </button>
          <label className="block">
            <span className="field-label">Имя в моём списке</span>
            <input
              data-dialog-initial-focus
              className="field-input"
              required
              minLength={1}
              maxLength={160}
              value={localDisplayName}
              onChange={(event) => setLocalDisplayName(event.target.value)}
              placeholder="Например, Анна Петрова"
            />
          </label>
          {method === "share_code" ? (
            <label className="block">
              <span className="field-label">Одноразовый код</span>
              <input
                className="field-input font-mono uppercase tracking-widest"
                required
                minLength={6}
                maxLength={64}
                autoComplete="off"
                value={shareCode}
                onChange={(event) => setShareCode(event.target.value)}
                placeholder="ABCDE-FGHIJ"
              />
            </label>
          ) : null}
          {method === "email" ? (
            <label className="block">
              <span className="field-label">Email получателя</span>
              <input
                className="field-input"
                required
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="name@example.com"
              />
            </label>
          ) : null}
          {method === "offline" && groups.length > 0 ? (
            <fieldset className="rounded-2xl border border-neutral-200 p-4">
              <legend className="px-1 text-sm font-semibold">
                Добавить в группы
              </legend>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {groups.map((group) => (
                  <label
                    key={group.id}
                    className="flex items-center gap-2 rounded-xl bg-neutral-50 px-3 py-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={selectedGroups.includes(group.id)}
                      onChange={(event) =>
                        setSelectedGroups((current) =>
                          event.target.checked
                            ? [...current, group.id]
                            : current.filter((id) => id !== group.id),
                        )
                      }
                    />
                    {group.name}
                  </label>
                ))}
              </div>
            </fieldset>
          ) : null}
          {method !== "offline" ? (
            <p className="rounded-xl bg-sky-50 px-4 py-3 text-sm text-sky-950">
              Запрос создаёт только ожидание. Связь и доступ к активной
              аудитории появятся после подтверждения получателем.
            </p>
          ) : null}
          {error ? <IdentityError message={error} /> : null}
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={onClose}
            >
              Отмена
            </Button>
            <Button
              type="submit"
              disabled={
                busy ||
                !localDisplayName.trim() ||
                (method === "share_code" && !shareCode.trim()) ||
                (method === "email" && !email.trim())
              }
            >
              {method === "offline" ? (
                <UserPlus className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Link2 className="h-4 w-4" aria-hidden="true" />
              )}
              {busy
                ? "Сохраняем…"
                : method === "offline"
                  ? "Создать профиль без аккаунта"
                  : "Отправить запрос"}
            </Button>
          </div>
        </form>
      )}
    </DialogShell>
  );
}
