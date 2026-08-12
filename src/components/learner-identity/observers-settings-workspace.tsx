"use client";

import { Copy, MailPlus, Pencil, UserMinus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { SettingsShell } from "@/components/settings-shell";
import { Button } from "@/components/ui/button";
import type { ObserverOverview } from "@/modules/learner-identity/domain";
import {
  actOnObserver,
  createObserverInvitation,
  loadObserverOverview,
} from "./identity-client";
import {
  formatIdentityDate,
  IdentityEmpty,
  IdentityError,
  IdentityLoading,
  RequestStatusBadge,
} from "./identity-ui";

export function ObserversSettingsWorkspace() {
  const [overview, setOverview] = useState<ObserverOverview | null>(null);
  const [email, setEmail] = useState("");
  const [label, setLabel] = useState("");
  const [copyLink, setCopyLink] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setOverview(await loadObserverOverview());
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Не удалось загрузить наблюдателей.",
      );
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  async function mutate(action: () => Promise<ObserverOverview>) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      setOverview(await action());
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Не удалось изменить доступ.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function invite() {
    if (!email.trim() || busy) return;
    setBusy(true);
    setError(null);
    setCopyLink(null);
    try {
      const created = await createObserverInvitation({
        recipientEmail: email.trim(),
        relationshipLabel: label.trim(),
      });
      setOverview(created.overview);
      setCopyLink(created.copyLink);
      setEmail("");
      setLabel("");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Не удалось создать приглашение.",
      );
    } finally {
      setBusy(false);
    }
  }

  const myObservers =
    overview?.grants.filter((grant) => grant.direction === "observed_by") ?? [];
  const outgoing =
    overview?.invitations.filter(
      (invitation) => invitation.direction === "outgoing",
    ) ?? [];
  const incoming =
    overview?.invitations.filter(
      (invitation) => invitation.direction === "incoming",
    ) ?? [];

  return (
    <SettingsShell
      title="Наблюдатели"
      description="Только вы управляете доступом к своему учебному профилю для чтения. Подпись связи — текст для удобства, а не роль или дополнительное разрешение."
    >
      <div className="mt-6 space-y-6">
        {error ? (
          <IdentityError message={error} onRetry={() => void load()} />
        ) : null}
        {overview === null && !error ? (
          <IdentityLoading>Загружаем связи…</IdentityLoading>
        ) : null}
        {overview ? (
          <>
            <form
              className="space-y-4 rounded-2xl border border-neutral-200 bg-white p-5"
              onSubmit={(event) => {
                event.preventDefault();
                void invite();
              }}
            >
              <div>
                <h2 className="font-bold text-neutral-950">
                  Пригласить наблюдателя
                </h2>
                <p className="mt-1 text-sm text-neutral-600">
                  Адресованная одноразовая ссылка. Получатель должен войти с
                  подтверждённым email и сам принять доступ.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label>
                  <span className="field-label">Email получателя</span>
                  <input
                    className="field-input"
                    type="email"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                  />
                </label>
                <label>
                  <span className="field-label">Свободная подпись</span>
                  <input
                    className="field-input"
                    maxLength={80}
                    value={label}
                    onChange={(event) => setLabel(event.target.value)}
                    placeholder="Например, мама или тренер"
                  />
                </label>
              </div>
              <Button type="submit" disabled={busy || !email.trim()}>
                <MailPlus className="h-4 w-4" aria-hidden="true" />
                {busy ? "Отправляем…" : "Отправить приглашение"}
              </Button>
              {copyLink ? (
                <div
                  className="rounded-xl bg-amber-50 p-3 text-sm text-amber-950"
                  role="status"
                >
                  Скопируйте резервную ссылку сейчас: её секрет повторно не
                  показывается.
                  <Button
                    type="button"
                    variant="ghost"
                    className="ml-2"
                    onClick={() => void navigator.clipboard.writeText(copyLink)}
                  >
                    <Copy className="h-4 w-4" aria-hidden="true" />
                    Копировать
                  </Button>
                </div>
              ) : null}
            </form>

            <section aria-labelledby="incoming-observers-title">
              <h2 id="incoming-observers-title" className="text-lg font-bold">
                Запросы для вас
              </h2>
              {incoming.length === 0 ? (
                <div className="mt-3">
                  <IdentityEmpty
                    title="Новых запросов нет"
                    description="Здесь появится отдельный запрос, если учащийся предложит вам наблюдать за своим профилем."
                  />
                </div>
              ) : (
                <ul className="mt-3 space-y-3">
                  {incoming.map((invitation) => (
                    <li
                      key={invitation.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-neutral-200 bg-white p-4"
                    >
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <strong>{invitation.subjectLabel}</strong>
                          <RequestStatusBadge status={invitation.status} />
                        </div>
                        <p className="mt-1 text-sm text-neutral-600">
                          {invitation.relationshipLabel || "Без подписи"} · до{" "}
                          {formatIdentityDate(invitation.expiresAt)}
                        </p>
                      </div>
                      {invitation.status === "bound" ||
                      invitation.status === "pending" ? (
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              void mutate(() =>
                                actOnObserver(invitation.id, "accept"),
                              )
                            }
                          >
                            Принять
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            disabled={busy}
                            onClick={() =>
                              void mutate(() =>
                                actOnObserver(invitation.id, "reject"),
                              )
                            }
                          >
                            Отклонить
                          </Button>
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section aria-labelledby="active-observers-title">
              <h2 id="active-observers-title" className="text-lg font-bold">
                Активные наблюдатели
              </h2>
              {myObservers.length === 0 ? (
                <div className="mt-3">
                  <IdentityEmpty
                    title="Наблюдателей пока нет"
                    description="Учебные связи сами по себе не дают доступ наблюдателя."
                  />
                </div>
              ) : (
                <ul className="mt-3 space-y-3">
                  {myObservers.map((grant) => (
                    <li
                      key={grant.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-neutral-200 bg-white p-4"
                    >
                      <div>
                        <strong>{grant.observerLabel}</strong>
                        <p className="mt-1 text-sm text-neutral-600">
                          {grant.relationshipLabel || "Без подписи"}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          disabled={busy}
                          onClick={() => {
                            const next = window
                              .prompt(
                                "Новая подпись связи",
                                grant.relationshipLabel ?? "",
                              )
                              ?.trim();
                            if (next !== undefined)
                              void mutate(() =>
                                actOnObserver(grant.id, "rename", {
                                  relationshipLabel: next,
                                }),
                              );
                          }}
                        >
                          <Pencil className="h-4 w-4" aria-hidden="true" />
                          Подпись
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          disabled={busy}
                          onClick={() => {
                            if (
                              window.confirm(
                                `Отозвать доступ у «${grant.observerLabel}»? Он прекратится сразу.`,
                              )
                            )
                              void mutate(() =>
                                actOnObserver(grant.id, "revoke"),
                              );
                          }}
                        >
                          <UserMinus className="h-4 w-4" aria-hidden="true" />
                          Отозвать
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section aria-labelledby="observer-invitations-title">
              <h2 id="observer-invitations-title" className="text-lg font-bold">
                Приглашения
              </h2>
              {outgoing.length === 0 ? (
                <div className="mt-3">
                  <IdentityEmpty
                    title="Нет приглашений"
                    description="Для повторного приглашения введите email заново: старый секрет не хранится и не восстанавливается."
                  />
                </div>
              ) : (
                <ul className="mt-3 space-y-3">
                  {outgoing.map((invitation) => (
                    <li
                      key={invitation.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-neutral-200 bg-white p-4"
                    >
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <strong>{invitation.observerLabel}</strong>
                          <RequestStatusBadge status={invitation.status} />
                        </div>
                        <p className="mt-1 text-xs text-neutral-500">
                          Действует до{" "}
                          {formatIdentityDate(invitation.expiresAt)}
                        </p>
                        {invitation.status !== "pending" &&
                        invitation.status !== "accepted" ? (
                          <p className="mt-1 text-xs text-neutral-600">
                            Чтобы пригласить снова, введите email в форме выше.
                          </p>
                        ) : null}
                      </div>
                      {invitation.status === "pending" ||
                      invitation.status === "bound" ? (
                        <Button
                          type="button"
                          variant="ghost"
                          disabled={busy}
                          onClick={() =>
                            void mutate(() =>
                              actOnObserver(invitation.id, "revoke"),
                            )
                          }
                        >
                          <UserMinus className="h-4 w-4" aria-hidden="true" />
                          Отозвать
                        </Button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        ) : null}
      </div>
    </SettingsShell>
  );
}
