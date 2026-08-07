"use client";

import { AlertTriangle, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { DialogShell } from "@/components/ui/dialog-shell";
import type {
  ErasurePreview,
  SafeUnlinkPreview,
} from "@/modules/learner-identity/domain";
import {
  confirmLearningDataErasure,
  confirmSafeUnlink,
  previewLearningDataErasure,
  previewSafeUnlink,
  reauthenticate,
} from "./identity-client";
import { IdentityError, IdentityLoading } from "./identity-ui";

type Mode = "unlink" | "erasure";
const ERASURE_PHRASE = "УДАЛИТЬ УЧЕБНЫЕ ДАННЫЕ";

export function DestructiveProfileDialog({
  mode,
  onClose,
  onCompleted,
}: {
  mode: Mode;
  onClose: () => void;
  onCompleted: () => Promise<void> | void;
}) {
  const [preview, setPreview] = useState<
    SafeUnlinkPreview | ErasurePreview | null
  >(null);
  const [secret, setSecret] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load =
      mode === "unlink" ? previewSafeUnlink : previewLearningDataErasure;
    void load()
      .then((value) => {
        if (active) setPreview(value);
      })
      .catch((caught) => {
        if (active)
          setError(
            caught instanceof Error
              ? caught.message
              : "Не удалось подготовить проверку.",
          );
      });
    return () => {
      active = false;
    };
  }, [mode]);

  const unlinkPreview =
    mode === "unlink" ? (preview as SafeUnlinkPreview | null) : null;
  const erasurePreview =
    mode === "erasure" ? (preview as ErasurePreview | null) : null;
  const canSubmit = Boolean(
    preview &&
    secret &&
    (mode === "unlink"
      ? unlinkPreview?.canUnlink
      : confirmation === ERASURE_PHRASE),
  );

  async function confirm() {
    if (!preview || !canSubmit || busy) return;
    setBusy(true);
    setError(null);
    try {
      // The receipt is stored only in the encrypted HttpOnly session. The
      // destructive RPC then rechecks it server-side; the browser cannot mint it.
      await reauthenticate(secret);
      if (mode === "unlink")
        await confirmSafeUnlink(preview.previewFingerprint);
      else await confirmLearningDataErasure(preview.previewFingerprint);
      await onCompleted();
      onClose();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Не удалось завершить действие.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <DialogShell
      title={
        mode === "unlink"
          ? "Безопасно отвязать профиль"
          : "Удалить учебные данные"
      }
      description={
        mode === "unlink"
          ? "Доступно только для ошибочной прямой связи, если учебные результаты ещё не объединялись и нет зависимых разрешений."
          : "Сам аккаунт сохранится: учебные данные будут очищены, а вместо прежнего профиля появится новый пустой."
      }
      onClose={() => {
        if (!busy) onClose();
      }}
      panelClassName="max-w-2xl"
    >
      {!preview && !error ? (
        <IdentityLoading>Считаем затрагиваемые данные…</IdentityLoading>
      ) : null}
      {error ? <IdentityError message={error} /> : null}
      {unlinkPreview ? (
        <div className="space-y-4">
          {unlinkPreview.canUnlink ? (
            <p className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-950">
              <ShieldCheck className="mb-2 h-5 w-5" aria-hidden="true" />
              Прежний профиль останется у связанных преподавателей без аккаунта;
              у вас сразу появится новый пустой учебный профиль.
            </p>
          ) : (
            <div className="rounded-2xl bg-neutral-100 p-4">
              <p className="font-semibold">Отвязка недоступна</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-neutral-700">
                {unlinkPreview.blockers.map((blocker) => (
                  <li key={blocker.code}>
                    {blocker.message}
                    {blocker.count ? ` (${blocker.count})` : ""}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : null}
      {erasurePreview ? (
        <div className="space-y-4">
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-950">
            <AlertTriangle className="mb-2 h-5 w-5" aria-hidden="true" />
            <p className="font-semibold">
              Будут удалены все ваши учебные данные
            </p>
            <ul className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
              <li>Результаты: {erasurePreview.learningRecordCount}</li>
              <li>Связанные профили: {erasurePreview.lineageProfileCount}</li>
              <li>
                Связи преподавателей: {erasurePreview.teacherRelationCount}
              </li>
              <li>Группы: {erasurePreview.groupMembershipCount}</li>
              <li>Аудитории курсов: {erasurePreview.courseAudienceCount}</li>
              <li>Приглашения: {erasurePreview.invitationCount}</li>
              <li>Наблюдатели: {erasurePreview.observerGrantCount}</li>
              <li>Разрешения помощнику: {erasurePreview.aiConsentCount}</li>
              <li>
                Доступы восстановления: {erasurePreview.recoveryDelegateCount}
              </li>
            </ul>
          </div>
          <label className="block">
            <span className="field-label">Введите «{ERASURE_PHRASE}»</span>
            <input
              className="field-input"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              autoComplete="off"
            />
          </label>
        </div>
      ) : null}
      {preview ? (
        <div className="mt-4 space-y-4">
          <label className="block">
            <span className="field-label">
              Подтвердите текущим паролем или PIN
            </span>
            <input
              data-dialog-initial-focus
              className="field-input"
              type="password"
              value={secret}
              onChange={(event) => setSecret(event.target.value)}
              autoComplete="current-password"
            />
          </label>
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
              type="button"
              disabled={busy || !canSubmit}
              onClick={() => void confirm()}
            >
              {busy
                ? "Проверяем и выполняем…"
                : mode === "unlink"
                  ? "Отвязать профиль"
                  : "Необратимо удалить данные"}
            </Button>
          </div>
        </div>
      ) : null}
    </DialogShell>
  );
}
