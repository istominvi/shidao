"use client";

import { Copy, MailPlus, Pencil, UserMinus } from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { DialogShell } from "@/components/ui/dialog-shell";
import { Input } from "@/components/ui/input";
import type {
  ObserverGrant,
  ObserverOverview,
} from "@/modules/learner-identity/domain";
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

type ObserversSettingsWorkspaceProps = {
  onOverviewChange?: (overview: ObserverOverview) => void;
};

export function ObserversSettingsWorkspace({
  onOverviewChange,
}: ObserversSettingsWorkspaceProps = {}) {
  const [overview, setOverview] = useState<ObserverOverview | null>(null);
  const [email, setEmail] = useState("");
  const [label, setLabel] = useState("");
  const [copyLink, setCopyLink] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingGrant, setEditingGrant] = useState<ObserverGrant | null>(null);
  const [relationshipLabel, setRelationshipLabel] = useState("");
  const [revokingGrant, setRevokingGrant] = useState<ObserverGrant | null>(
    null,
  );

  const commitOverview = useCallback(
    (nextOverview: ObserverOverview) => {
      setOverview(nextOverview);
      onOverviewChange?.(nextOverview);
    },
    [onOverviewChange],
  );

  const load = useCallback(async () => {
    setError(null);
    try {
      commitOverview(await loadObserverOverview());
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Не удалось загрузить наблюдателей.",
      );
    }
  }, [commitOverview]);
  useEffect(() => {
    void load();
  }, [load]);

  async function mutate(action: () => Promise<ObserverOverview>) {
    if (busy) return false;
    setBusy(true);
    setError(null);
    try {
      commitOverview(await action());
      return true;
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Не удалось изменить доступ.",
      );
      return false;
    } finally {
      setBusy(false);
    }
  }

  function openRenameDialog(grant: ObserverGrant) {
    setEditingGrant(grant);
    setRelationshipLabel(grant.relationshipLabel ?? "");
  }

  async function renameObserver(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingGrant) return;
    const completed = await mutate(() =>
      actOnObserver(editingGrant.id, "rename", {
        relationshipLabel: relationshipLabel.trim(),
      }),
    );
    if (completed) setEditingGrant(null);
  }

  async function revokeObserver() {
    if (!revokingGrant) return;
    const completed = await mutate(() =>
      actOnObserver(revokingGrant.id, "revoke"),
    );
    if (completed) setRevokingGrant(null);
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
      commitOverview(created.overview);
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
    <div className="space-y-6">
      {error ? (
        <IdentityError message={error} onRetry={() => void load()} />
      ) : null}
      {overview === null && !error ? (
        <IdentityLoading>Загружаем наблюдателей…</IdentityLoading>
      ) : null}
      {overview ? (
        <>
          <section aria-labelledby="active-observers-title">
            <h2 id="active-observers-title" className="text-lg font-bold">
              Активные наблюдатели
            </h2>
            <p className="mt-1 text-sm text-neutral-600">
              Эти пользователи могут видеть вашу завершённую учебную историю и
              прогресс, но не могут действовать от вашего имени.
            </p>
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
                        onClick={() => openRenameDialog(grant)}
                      >
                        <Pencil className="h-4 w-4" aria-hidden="true" />
                        Подпись
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        disabled={busy}
                        onClick={() => setRevokingGrant(grant)}
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
                <Input
                  type="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </label>
              <label>
                <span className="field-label">Свободная подпись</span>
                <Input
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

          <section aria-labelledby="observer-invitations-title">
            <h2 id="observer-invitations-title" className="text-lg font-bold">
              Отправленные приглашения
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
                        Действует до {formatIdentityDate(invitation.expiresAt)}
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

          <section aria-labelledby="incoming-observers-title">
            <h2 id="incoming-observers-title" className="text-lg font-bold">
              Вас приглашают наблюдать
            </h2>
            <p className="mt-1 text-sm text-neutral-600">
              Это отдельные приглашения видеть профиль другого учащегося; они не
              входят в список ваших наблюдателей выше.
            </p>
            {incoming.length === 0 ? (
              <div className="mt-3">
                <IdentityEmpty
                  title="Новых приглашений нет"
                  description="Здесь появится запрос, если учащийся предложит вам наблюдать за своим профилем."
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
        </>
      ) : null}

      {editingGrant ? (
        <DialogShell
          title="Подпись наблюдателя"
          description={`Измените подпись для «${editingGrant.observerLabel}». Например: мама, папа или тренер.`}
          onClose={() => {
            if (!busy) setEditingGrant(null);
          }}
          panelClassName="max-w-lg"
        >
          <form className="space-y-4" onSubmit={renameObserver}>
            {error ? <IdentityError message={error} /> : null}
            <label className="block">
              <span className="field-label">Подпись</span>
              <Input
                autoFocus
                maxLength={80}
                value={relationshipLabel}
                onChange={(event) => setRelationshipLabel(event.target.value)}
              />
            </label>
            <div className="dialog-shell-actions">
              <Button type="submit" disabled={busy}>
                {busy ? "Сохраняем…" : "Сохранить"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                disabled={busy}
                onClick={() => setEditingGrant(null)}
              >
                Отмена
              </Button>
            </div>
          </form>
        </DialogShell>
      ) : null}

      {revokingGrant ? (
        <DialogShell
          title="Отозвать доступ?"
          description={`«${revokingGrant.observerLabel}» сразу перестанет видеть ваш учебный профиль.`}
          onClose={() => {
            if (!busy) setRevokingGrant(null);
          }}
          panelClassName="max-w-lg"
        >
          {error ? <IdentityError message={error} /> : null}
          <div className="dialog-shell-actions">
            <Button
              type="button"
              variant="secondary"
              className="product-btn-danger"
              disabled={busy}
              onClick={() => void revokeObserver()}
            >
              {busy ? "Отзываем…" : "Отозвать доступ"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={() => setRevokingGrant(null)}
            >
              Отмена
            </Button>
          </div>
        </DialogShell>
      ) : null}
    </div>
  );
}
