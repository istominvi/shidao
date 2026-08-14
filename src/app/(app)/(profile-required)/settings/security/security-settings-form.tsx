"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  loadLearnerCredentialRecovery,
  reauthenticate,
  resetRecoverableLearnerCredentials,
  revokeMyLearnerRecoveryDelegate,
} from "@/components/learner-identity/identity-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type {
  LearnerCredentialRecoveryOverview,
  LearnerCredentialResetResult,
} from "@/modules/learner-identity/domain";

type SecuritySettingsFormProps = {
  initialHasPin: boolean;
  onHasPinChange?: (hasPin: boolean) => void;
};

export function SecuritySettingsForm({
  initialHasPin,
  onHasPinChange,
}: SecuritySettingsFormProps) {
  const [hasPin, setHasPin] = useState(initialHasPin);
  const [newPin, setNewPin] = useState("");
  const [currentSecret, setCurrentSecret] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [recovery, setRecovery] =
    useState<LearnerCredentialRecoveryOverview | null>(null);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const [recoverySuccess, setRecoverySuccess] = useState<string | null>(null);
  const [recoveryBusy, setRecoveryBusy] = useState(false);
  const [selectedGrantId, setSelectedGrantId] = useState<string | null>(null);
  const [childLogin, setChildLogin] = useState("");
  const [childPin, setChildPin] = useState("");
  const [recoverySecret, setRecoverySecret] = useState("");
  const [resetIdempotencyKey, setResetIdempotencyKey] = useState<string | null>(
    null,
  );

  useEffect(() => {
    let active = true;
    void loadLearnerCredentialRecovery()
      .then((overview) => {
        if (active) setRecovery(overview);
      })
      .catch((caught) => {
        if (active) {
          setRecoveryError(
            caught instanceof Error
              ? caught.message
              : "Не удалось загрузить способы восстановления.",
          );
        }
      });
    return () => {
      active = false;
    };
  }, []);

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
      onHasPinChange?.(true);
      setCurrentSecret("");
      setNewPin("");
      setSuccess("PIN успешно сохранён.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось сохранить PIN.");
    } finally {
      setLoading(false);
    }
  }

  function chooseLearner(grantId: string, currentLogin: string | null) {
    setSelectedGrantId(grantId);
    setChildLogin(currentLogin ?? "");
    setChildPin("");
    setRecoverySecret("");
    setResetIdempotencyKey(null);
    setRecoveryError(null);
    setRecoverySuccess(null);
  }

  async function onRecoverySubmit(event: FormEvent) {
    event.preventDefault();
    if (!selectedGrantId || recoveryBusy) return;
    setRecoveryError(null);
    setRecoverySuccess(null);
    const idempotencyKey = resetIdempotencyKey ?? crypto.randomUUID();
    setResetIdempotencyKey(idempotencyKey);
    try {
      setRecoveryBusy(true);
      await reauthenticate(recoverySecret);
      const result = await resetRecoverableLearnerCredentials(selectedGrantId, {
        newLogin: childLogin.trim(),
        pin: childPin,
        idempotencyKey,
      });
      setRecovery((current) =>
        current
          ? {
              ...current,
              recoverableLearners: current.recoverableLearners.map((learner) =>
                learner.grantId === result.grantId
                  ? { ...learner, childAccountLogin: result.childAccountLogin }
                  : learner,
              ),
            }
          : current,
      );
      setChildPin("");
      setRecoverySecret("");
      setResetIdempotencyKey(null);
      setSelectedGrantId(null);
      setRecoverySuccess(recoverySuccessMessage(result));
    } catch (caught) {
      setRecoveryError(
        caught instanceof Error
          ? caught.message
          : "Не удалось изменить логин и PIN учащегося.",
      );
    } finally {
      setRecoveryBusy(false);
    }
  }

  async function revokeRecoveryDelegate(grantId: string) {
    if (
      recoveryBusy ||
      !window.confirm(
        "Отозвать право этого доверенного взрослого менять ваш логин и PIN?",
      )
    ) {
      return;
    }
    setRecoveryError(null);
    setRecoverySuccess(null);
    try {
      setRecoveryBusy(true);
      const changed = await revokeMyLearnerRecoveryDelegate(grantId);
      setRecovery((current) =>
        current
          ? {
              ...current,
              myDelegates: current.myDelegates.map((delegate) =>
                delegate.grantId === changed.grantId
                  ? {
                      ...delegate,
                      status: changed.status,
                      revokedAt: changed.revokedAt,
                    }
                  : delegate,
              ),
            }
          : current,
      );
      setRecoverySuccess("Право восстановления отозвано.");
    } catch (caught) {
      setRecoveryError(
        caught instanceof Error
          ? caught.message
          : "Не удалось отозвать право восстановления.",
      );
    } finally {
      setRecoveryBusy(false);
    }
  }

  const content = (
    <>
      <form
        onSubmit={onSubmit}
        className="mt-6 space-y-4 rounded-3xl border border-black/10 bg-white p-5"
      >
        <h2 className="text-lg font-bold">Мой PIN-код</h2>
        <label className="block">
          <span className="mb-2 block text-sm font-medium">
            Подтвердите текущим паролем{hasPin ? " или старым PIN" : ""}
          </span>
          <Input
            type="password"
            value={currentSecret}
            onChange={(e) => setCurrentSecret(e.target.value)}
            required
            autoComplete="current-password"
          />
        </label>
        <label className="block">
          <span className="mb-2 block text-sm font-medium">
            Новый PIN (4–8 цифр)
          </span>
          <Input
            type="password"
            inputMode="numeric"
            pattern="[0-9]{4,8}"
            minLength={4}
            maxLength={8}
            required
            autoComplete="new-password"
            value={newPin}
            onChange={(e) => setNewPin(e.target.value)}
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

        <Button type="submit" disabled={loading} className="w-full">
          {loading ? "Сохраняем…" : hasPin ? "Изменить PIN" : "Создать PIN"}
        </Button>
      </form>

      <section
        className="mt-6 rounded-3xl border border-black/10 bg-white p-5"
        aria-labelledby="learner-recovery-title"
      >
        <h2 id="learner-recovery-title" className="text-lg font-bold">
          Доступ учащегося
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-neutral-600">
          При активации отдельного аккаунта вы становитесь доверенным взрослым:
          можете задать новый логин и PIN, но не получаете доступ к учебной
          истории. Все прежние сеансы учащегося завершатся.
        </p>

        {!recovery ? (
          <p className="mt-4 text-sm text-neutral-500">
            Загружаем способы восстановления…
          </p>
        ) : recovery.recoverableLearners.length === 0 ? (
          <p className="mt-4 rounded-2xl bg-neutral-50 p-4 text-sm text-neutral-600">
            Нет отдельных аккаунтов учащихся, доступ к которым вы можете
            восстановить.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {recovery.recoverableLearners.map((learner) => (
              <div
                key={learner.grantId}
                className="rounded-2xl border border-neutral-200 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{learner.learnerLabel}</p>
                    <p className="mt-1 text-sm text-neutral-600">
                      Текущий логин: {learner.childAccountLogin ?? "не задан"}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={!learner.canReset || recoveryBusy}
                    onClick={() =>
                      chooseLearner(learner.grantId, learner.childAccountLogin)
                    }
                  >
                    Сменить логин и PIN
                  </Button>
                </div>

                {selectedGrantId === learner.grantId ? (
                  <form
                    className="mt-4 grid gap-3 border-t border-neutral-200 pt-4 sm:grid-cols-2"
                    onSubmit={onRecoverySubmit}
                  >
                    <label className="block">
                      <span className="mb-2 block text-sm font-medium">
                        Новый логин учащегося
                      </span>
                      <Input
                        required
                        minLength={3}
                        maxLength={80}
                        autoComplete="username"
                        value={childLogin}
                        onChange={(event) => {
                          setChildLogin(event.target.value);
                          setResetIdempotencyKey(null);
                        }}
                      />
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-sm font-medium">
                        Новый PIN учащегося (4–8 цифр)
                      </span>
                      <Input
                        required
                        type="password"
                        inputMode="numeric"
                        pattern="[0-9]{4,8}"
                        autoComplete="new-password"
                        value={childPin}
                        onChange={(event) => {
                          setChildPin(event.target.value);
                          setResetIdempotencyKey(null);
                        }}
                      />
                    </label>
                    <label className="block sm:col-span-2">
                      <span className="mb-2 block text-sm font-medium">
                        Ваш текущий пароль или PIN
                      </span>
                      <Input
                        required
                        type="password"
                        autoComplete="current-password"
                        value={recoverySecret}
                        onChange={(event) =>
                          setRecoverySecret(event.target.value)
                        }
                      />
                    </label>
                    <div className="flex flex-wrap gap-2 sm:col-span-2">
                      <Button
                        type="submit"
                        disabled={
                          recoveryBusy ||
                          childLogin.trim().length < 3 ||
                          !/^\d{4,8}$/.test(childPin) ||
                          !recoverySecret
                        }
                      >
                        {recoveryBusy ? "Сохраняем…" : "Сохранить новые данные"}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        disabled={recoveryBusy}
                        onClick={() => setSelectedGrantId(null)}
                      >
                        Отмена
                      </Button>
                    </div>
                  </form>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </section>

      <section
        className="mt-6 rounded-3xl border border-black/10 bg-white p-5"
        aria-labelledby="my-recovery-delegates-title"
      >
        <h2 id="my-recovery-delegates-title" className="text-lg font-bold">
          Кто может восстановить мой логин и PIN
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-neutral-600">
          Это отдельное право безопасности. Оно не даёт человеку доступ к вашим
          урокам или учебной истории.
        </p>
        {recovery && recovery.myDelegates.length > 0 ? (
          <div className="mt-4 space-y-3">
            {recovery.myDelegates.map((delegate) => (
              <div
                key={delegate.grantId}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-neutral-200 p-4"
              >
                <div>
                  <p className="font-semibold">{delegate.delegateLabel}</p>
                  <p className="mt-1 text-sm text-neutral-600">
                    {delegate.status === "active"
                      ? "Может восстановить доступ"
                      : "Право отозвано"}
                  </p>
                </div>
                {delegate.status === "active" ? (
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={recoveryBusy}
                    onClick={() =>
                      void revokeRecoveryDelegate(delegate.grantId)
                    }
                    className="product-btn-danger"
                  >
                    Отозвать право
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
        ) : recovery ? (
          <p className="mt-4 rounded-2xl bg-neutral-50 p-4 text-sm text-neutral-600">
            Ни у кого нет права менять ваш логин и PIN.
          </p>
        ) : null}
      </section>

      {recoveryError ? (
        <p className="mt-4 rounded-2xl bg-red-100 px-4 py-3 text-sm text-red-700">
          {recoveryError}
        </p>
      ) : null}
      {recoverySuccess ? (
        <p
          className="mt-4 rounded-2xl bg-emerald-100 px-4 py-3 text-sm text-emerald-700"
          role="status"
        >
          {recoverySuccess}
        </p>
      ) : null}
    </>
  );

  return (
    <section id="security" aria-labelledby="security-settings-title">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h2 id="security-settings-title" className="text-xl font-bold">
          Безопасность
        </h2>
        <p className="text-sm text-neutral-600">
          {hasPin ? "PIN настроен" : "PIN не настроен"}
        </p>
      </div>
      {content}
    </section>
  );
}

function recoverySuccessMessage(result: LearnerCredentialResetResult) {
  return `Доступ для «${result.learnerLabel}» обновлён. Новый логин: ${result.childAccountLogin}. Прежние сеансы завершены; PIN не показывается и не возвращается сервером.`;
}
