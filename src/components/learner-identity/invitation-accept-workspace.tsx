"use client";

import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  KeyRound,
  Link2,
  ShieldCheck,
  UserPlus,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { AppPageHeader } from "@/components/app/page-header";
import { Button, productButtonClassName } from "@/components/ui/button";
import { useSessionView } from "@/components/use-session-view";
import { profileTabHref } from "@/lib/navigation/profile-nav";
import type {
  InvitationAcceptance,
  LearnerMergePreview,
  RecipientBoundInvitationPreview,
} from "@/modules/learner-identity/domain";
import {
  actOnEmailConnection,
  actOnEmailObserverInvitation,
  actOnIdentityInvitation,
  activateChildIdentity,
  cancelMerge,
  confirmMerge,
  previewEmailConnection,
  previewEmailObserverInvitation,
  previewIdentityInvitation,
  reauthenticate,
} from "./identity-client";
import {
  formatIdentityDate,
  IdentityError,
  IdentityLoading,
  RequestStatusBadge,
} from "./identity-ui";

type InvitationKind = "profile" | "connection" | "observer";

export function InvitationAcceptWorkspace({
  invitationId,
}: {
  invitationId: string;
}) {
  const { state: session, sessionResolved } = useSessionView();
  const [kind, setKind] = useState<InvitationKind | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [emailHandoff, setEmailHandoff] = useState(false);
  const [profilePreview, setProfilePreview] =
    useState<InvitationAcceptance | null>(null);
  const [boundPreview, setBoundPreview] =
    useState<RecipientBoundInvitationPreview | null>(null);
  const [mergePreview, setMergePreview] = useState<LearnerMergePreview | null>(
    null,
  );
  const [learnerLogin, setLearnerLogin] = useState("");
  const [pin, setPin] = useState("");
  const [reauthSecret, setReauthSecret] = useState("");
  const [acknowledgeRecoveryDelegate, setAcknowledgeRecoveryDelegate] =
    useState(false);
  const [requestObserver, setRequestObserver] = useState(false);
  const [completed, setCompleted] = useState<InvitationAcceptance | null>(null);
  const [mergeCompleted, setMergeCompleted] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const returnPath = `/identity/invitations/${encodeURIComponent(invitationId)}`;
  const storedInvitationKey = `shidao.identity-invitation.${invitationId}`;

  const forgetStoredInvitation = useCallback(() => {
    window.sessionStorage.removeItem(storedInvitationKey);
  }, [storedInvitationKey]);

  useEffect(() => {
    const fragment = new URLSearchParams(window.location.hash.slice(1));
    const rawKind = fragment.get("kind");
    const rawToken = fragment.get("token");
    const fragmentKind =
      rawKind === "connection" ||
      rawKind === "observer" ||
      rawKind === "profile"
        ? rawKind
        : null;
    if (fragmentKind && rawToken) {
      window.sessionStorage.setItem(
        storedInvitationKey,
        JSON.stringify({ kind: fragmentKind, token: rawToken }),
      );
      setKind(fragmentKind);
      setToken(rawToken);
      setEmailHandoff(false);
    } else {
      const queryKind = new URLSearchParams(window.location.search).get("kind");
      if (
        queryKind === "connection" ||
        queryKind === "observer" ||
        queryKind === "profile"
      ) {
        setKind(queryKind);
        setToken(null);
        setEmailHandoff(true);
      } else {
        try {
          const saved = JSON.parse(
            window.sessionStorage.getItem(storedInvitationKey) ?? "null",
          ) as { kind?: unknown; token?: unknown } | null;
          const savedKind =
            saved?.kind === "connection" ||
            saved?.kind === "observer" ||
            saved?.kind === "profile"
              ? saved.kind
              : null;
          if (savedKind && typeof saved?.token === "string" && saved.token) {
            setKind(savedKind);
            setToken(saved.token);
            setEmailHandoff(false);
          } else {
            setKind("profile");
            setError("Приглашение недоступно или больше не существует.");
          }
        } catch {
          window.sessionStorage.removeItem(storedInvitationKey);
          setKind("profile");
          setError("Приглашение недоступно или больше не существует.");
        }
      }
    }
    // Remove the bearer value before any navigation, screenshot or copied URL.
    // Use the native History method so framework navigation wrappers cannot
    // restore the sensitive fragment after this synchronous scrub.
    History.prototype.replaceState.call(
      window.history,
      window.history.state,
      "",
      `${window.location.pathname}${window.location.search}`,
    );
  }, [storedInvitationKey]);

  useEffect(() => {
    if (
      !sessionResolved ||
      !session.authenticated ||
      !kind ||
      (!token && !emailHandoff)
    ) {
      return;
    }
    let active = true;
    setBusy(true);
    setError(null);
    const load =
      kind === "profile"
        ? previewIdentityInvitation(invitationId, token).then((value) => {
            if (value.completed) {
              forgetStoredInvitation();
              setToken(null);
              setEmailHandoff(false);
              setCompleted(value);
            } else {
              setProfilePreview(value);
            }
          })
        : kind === "connection"
          ? previewEmailConnection(invitationId, token).then((value) =>
              setBoundPreview(value),
            )
          : previewEmailObserverInvitation(invitationId, token).then((value) =>
              setBoundPreview(value),
            );
    void load
      .catch((caught) => {
        if (active)
          setError(
            caught instanceof Error
              ? caught.message
              : "Приглашение недоступно или больше не существует.",
          );
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [
    forgetStoredInvitation,
    invitationId,
    kind,
    emailHandoff,
    session.authenticated,
    sessionResolved,
    token,
  ]);

  async function act(action: "accept" | "reject") {
    if (!kind || (!token && !emailHandoff) || busy) return;
    setBusy(true);
    setError(null);
    try {
      if (kind === "connection") {
        await actOnEmailConnection(invitationId, token, action);
        forgetStoredInvitation();
        setToken(null);
        setEmailHandoff(false);
        setBoundPreview((current) =>
          current
            ? {
                ...current,
                status: action === "accept" ? "accepted" : "rejected",
                canAccept: false,
              }
            : current,
        );
        return;
      }
      if (kind === "observer") {
        await actOnEmailObserverInvitation(invitationId, token, action);
        forgetStoredInvitation();
        setToken(null);
        setEmailHandoff(false);
        setBoundPreview((current) =>
          current
            ? {
                ...current,
                status: action === "accept" ? "accepted" : "rejected",
                canAccept: false,
              }
            : current,
        );
        return;
      }
      const result = await actOnIdentityInvitation(invitationId, token, action);
      setEmailHandoff(false);
      if (result.mergePreview) setMergePreview(result.mergePreview);
      else {
        forgetStoredInvitation();
        setToken(null);
        setEmailHandoff(false);
        setCompleted(result);
      }
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Не удалось обработать приглашение.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function activateChild() {
    if ((!token && !emailHandoff) || busy) return;
    setBusy(true);
    setError(null);
    try {
      await reauthenticate(reauthSecret);
      const result = await activateChildIdentity(invitationId, {
        token,
        learnerLogin: learnerLogin.trim(),
        pin,
        acknowledgeRecoveryDelegate: true,
        requestObserverInvitation: requestObserver,
      });
      forgetStoredInvitation();
      setToken(null);
      setEmailHandoff(false);
      setPin("");
      setReauthSecret("");
      setLearnerLogin("");
      setCompleted(result);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Не удалось активировать отдельный аккаунт.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function confirmPhysicalMerge() {
    if (!mergePreview || busy) return;
    setBusy(true);
    setError(null);
    try {
      await confirmMerge(
        mergePreview.operationId,
        mergePreview.previewFingerprint,
      );
      forgetStoredInvitation();
      setToken(null);
      setMergePreview(null);
      setMergeCompleted(true);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Не удалось объединить профили.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function cancelPhysicalMerge() {
    if (!mergePreview || busy) return;
    setBusy(true);
    try {
      await cancelMerge(mergePreview.operationId);
      forgetStoredInvitation();
      setToken(null);
      setMergePreview(null);
      setProfilePreview(null);
      setCancelled(true);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Не удалось отменить объединение.",
      );
    } finally {
      setBusy(false);
    }
  }

  const childActivation =
    profilePreview?.invitation.kind === "child_activation";

  return (
    <div className="space-y-6">
      <AppPageHeader title="Адресованное приглашение" />
      {sessionResolved && !session.authenticated ? (
        <div className="rounded-3xl border border-neutral-200 bg-white p-6">
          <KeyRound className="h-7 w-7" aria-hidden="true" />
          <h2 className="mt-3 text-xl font-black">
            Войдите, чтобы открыть приглашение
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-neutral-600">
            Приглашение сохранено только в этом браузере. Войдите подтверждённым
            аккаунтом получателя или создайте его — секрет не попадёт в адресную
            строку.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link
              className={productButtonClassName("primary")}
              href={`/login?next=${encodeURIComponent(returnPath)}`}
            >
              Войти
            </Link>
            <Link
              className={productButtonClassName("secondary")}
              href={`/join?next=${encodeURIComponent(returnPath)}`}
            >
              Создать аккаунт
            </Link>
          </div>
        </div>
      ) : null}
      {busy && !profilePreview && !boundPreview ? (
        <IdentityLoading>Проверяем приглашение…</IdentityLoading>
      ) : null}
      {error ? <IdentityError message={error} /> : null}
      {cancelled ? (
        <div
          className="rounded-3xl border border-neutral-200 bg-white p-6"
          role="status"
        >
          <h2 className="text-xl font-black">Объединение отменено</h2>
          <p className="mt-2 text-sm text-neutral-600">
            Оба учебных профиля остались без изменений.
          </p>
        </div>
      ) : null}
      {completed ? (
        <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6">
          <CheckCircle2
            className="h-8 w-8 text-emerald-700"
            aria-hidden="true"
          />
          <h2 className="mt-3 text-xl font-black text-emerald-950">Готово</h2>
          <p className="mt-2 text-sm leading-relaxed text-emerald-900">
            Приглашение обработано. Повторное принятие безопасно вернёт тот же
            результат.
          </p>
          {completed.childAccountLogin ? (
            <div className="mt-4 rounded-2xl bg-white p-4">
              <p className="text-sm text-neutral-600">
                Логин отдельного аккаунта учащегося
              </p>
              <p className="mt-1 font-mono text-xl font-bold">
                {completed.childAccountLogin}
              </p>
              <p className="mt-2 text-xs text-neutral-500">
                PIN виден только вам в форме и не возвращается сервером. Выйдите
                или откройте отдельное окно, чтобы войти как учащийся.
              </p>
              {completed.recoveryDelegateActive ? (
                <p className="mt-3 rounded-xl bg-sky-50 p-3 text-sm text-sky-950">
                  Вы стали доверенным взрослым для восстановления этого
                  отдельного аккаунта. В разделе «Безопасность» вы сможете
                  задать ему новый логин и PIN. Это не даёт доступа к учебной
                  истории: наблюдение подключается отдельно.
                </p>
              ) : null}
            </div>
          ) : null}
          {completed.observerInvitationId ? (
            <div className="mt-4 rounded-2xl bg-white p-4">
              <p className="text-sm font-semibold text-emerald-950">
                Доступ наблюдателя ещё не включён
              </p>
              <p className="mt-1 text-xs text-neutral-600">
                Для вас создан отдельный запрос. Примите его в настройках — это
                решение не связано с активацией аккаунта учащегося.
              </p>
              <Link
                href={profileTabHref("observers")}
                className="mt-3 inline-flex text-sm font-semibold underline underline-offset-4"
              >
                Открыть запросы наблюдателя
              </Link>
            </div>
          ) : null}
          <Link
            href={
              completed.childAccountLogin ? "/login" : profileTabHref("profile")
            }
            className={productButtonClassName("primary", "mt-4")}
          >
            {completed.childAccountLogin
              ? "Перейти ко входу"
              : "Открыть профиль"}
          </Link>
        </div>
      ) : null}
      {mergeCompleted ? (
        <div
          className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6"
          role="status"
        >
          <CheckCircle2
            className="h-8 w-8 text-emerald-700"
            aria-hidden="true"
          />
          <h2 className="mt-3 text-xl font-black text-emerald-950">
            Учебные результаты объединены
          </h2>
          <p className="mt-2 text-sm text-emerald-900">
            История теперь доступна в вашем текущем учебном профиле.
          </p>
          <Link
            href={profileTabHref("profile")}
            className={productButtonClassName("primary", "mt-4")}
          >
            Открыть профиль
          </Link>
        </div>
      ) : null}
      {!completed && boundPreview ? (
        <div className="rounded-3xl border border-neutral-200 bg-white p-6">
          <div className="flex items-start gap-3">
            {kind === "observer" ? (
              <ShieldCheck className="h-6 w-6" aria-hidden="true" />
            ) : (
              <Link2 className="h-6 w-6" aria-hidden="true" />
            )}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                {kind === "observer" ? "Наблюдатель" : "Связь с преподавателем"}
              </p>
              <h2 className="mt-1 text-xl font-black">{boundPreview.title}</h2>
              <p className="mt-2 text-sm text-neutral-600">
                От: {boundPreview.inviterLabel}. Действует до{" "}
                {formatIdentityDate(boundPreview.expiresAt)}.
              </p>
              {kind === "observer" ? (
                <p className="mt-3 rounded-xl bg-sky-50 p-3 text-sm text-sky-950">
                  Доступ только на чтение к завершённым результатам и прогрессу.
                  Нельзя создавать, менять или запускать учебные данные.
                </p>
              ) : (
                <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-950">
                  Принятие добавит преподавателя в ваш справочник связей, но не
                  сделает его наблюдателем и не откроет личные заметки других
                  преподавателей.
                </p>
              )}
            </div>
          </div>
          {boundPreview.canAccept ? (
            <div className="mt-5 flex flex-wrap gap-2">
              <Button
                type="button"
                disabled={busy}
                onClick={() => void act("accept")}
              >
                Принять
              </Button>
              <Button
                type="button"
                variant="ghost"
                disabled={busy}
                onClick={() => void act("reject")}
              >
                Отклонить
              </Button>
            </div>
          ) : (
            <p className="mt-4 text-sm font-semibold">
              Статус: <RequestStatusBadge status={boundPreview.status} />
            </p>
          )}
        </div>
      ) : null}
      {!completed && profilePreview && !mergePreview ? (
        <div className="rounded-3xl border border-neutral-200 bg-white p-6">
          <div className="flex items-start gap-3">
            <UserPlus className="h-6 w-6" aria-hidden="true" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                {childActivation
                  ? "Отдельный аккаунт учащегося"
                  : "Подключение учебного профиля"}
              </p>
              <h2 className="mt-1 text-xl font-black">
                {profilePreview.invitation.learnerLabel}
              </h2>
              <p className="mt-2 text-sm text-neutral-600">
                Пригласил: {profilePreview.invitation.inviterLabel}. До{" "}
                {formatIdentityDate(profilePreview.invitation.expiresAt)}.
              </p>
            </div>
          </div>
          {childActivation ? (
            <form
              className="mt-5 space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                void activateChild();
              }}
            >
              <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm leading-relaxed text-amber-950">
                <AlertTriangle className="mb-2 h-5 w-5" aria-hidden="true" />
                <strong className="block">
                  Вы активируете отдельный аккаунт учащегося.
                </strong>
                Аккаунт получателя не станет профилем учащегося и не получит
                доступ наблюдателя автоматически. После активации в новый
                аккаунт нужно войти отдельно. Вы сможете восстановить его логин
                и PIN как доверенный взрослый; это право можно отозвать в
                настройках аккаунта учащегося.
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label>
                  <span className="field-label">
                    Уникальный login учащегося
                  </span>
                  <input
                    className="field-input"
                    required
                    minLength={3}
                    maxLength={80}
                    autoComplete="username"
                    value={learnerLogin}
                    onChange={(event) => setLearnerLogin(event.target.value)}
                  />
                </label>
                <label>
                  <span className="field-label">PIN учащегося (4–8 цифр)</span>
                  <input
                    className="field-input"
                    required
                    pattern="[0-9]{4,8}"
                    inputMode="numeric"
                    type="password"
                    autoComplete="new-password"
                    value={pin}
                    onChange={(event) => setPin(event.target.value)}
                  />
                </label>
              </div>
              <label className="flex items-start gap-2 rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm text-sky-950">
                <input
                  type="checkbox"
                  required
                  checked={acknowledgeRecoveryDelegate}
                  onChange={(event) =>
                    setAcknowledgeRecoveryDelegate(event.target.checked)
                  }
                />
                <span>
                  Я понимаю, что стану доверенным взрослым и смогу менять логин
                  и PIN этого отдельного аккаунта. Наблюдение за учебной
                  историей оформляется отдельным запросом.
                </span>
              </label>
              <label className="flex items-start gap-2 rounded-xl bg-neutral-50 p-3 text-sm">
                <input
                  type="checkbox"
                  checked={requestObserver}
                  onChange={(event) => setRequestObserver(event.target.checked)}
                />
                <span>
                  Отдельно отправить новому учащемуся запрос доступа наблюдателя
                  для текущего получателя. Доступ не включится автоматически.
                </span>
              </label>
              <label>
                <span className="field-label">
                  Подтвердите вход текущим паролем или PIN
                </span>
                <input
                  className="field-input"
                  required
                  type="password"
                  autoComplete="current-password"
                  value={reauthSecret}
                  onChange={(event) => setReauthSecret(event.target.value)}
                />
              </label>
              <Button
                type="submit"
                disabled={
                  busy ||
                  !learnerLogin.trim() ||
                  !/^\d{4,8}$/.test(pin) ||
                  !acknowledgeRecoveryDelegate ||
                  !reauthSecret
                }
              >
                <KeyRound className="h-4 w-4" aria-hidden="true" />
                {busy ? "Активируем…" : "Создать отдельный аккаунт"}
              </Button>
            </form>
          ) : (
            <div className="mt-5">
              <div className="rounded-2xl bg-amber-50 p-4 text-sm leading-relaxed text-amber-950">
                <AlertTriangle className="mb-2 h-5 w-5" aria-hidden="true" />
                <strong className="block">
                  Вы входите в аккаунт учащегося.
                </strong>
                Если в вашем аккаунте уже есть учебные результаты, сначала вы
                увидите, какие данные будут объединены и что мешает операции.
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  type="button"
                  disabled={busy}
                  onClick={() => void act("accept")}
                >
                  Проверить объединение
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => void act("reject")}
                >
                  Отклонить
                </Button>
              </div>
            </div>
          )}
        </div>
      ) : null}
      {!completed && mergePreview ? (
        <div className="rounded-3xl border border-amber-300 bg-amber-50 p-6">
          <AlertTriangle
            className="h-7 w-7 text-amber-800"
            aria-hidden="true"
          />
          <h2 className="mt-3 text-xl font-black text-amber-950">
            Проверка необратимого объединения
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-amber-900">
            Все результаты приглашённого профиля будут перенесены в ваш текущий
            учебный профиль. После подтверждения автоматически разделить их
            обратно будет нельзя.
          </p>
          <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-amber-800">Завершённых результатов</dt>
              <dd className="font-bold">{mergePreview.finalizedRecordCount}</dd>
            </div>
            <div>
              <dt className="text-amber-800">Связей преподавателей</dt>
              <dd className="font-bold">{mergePreview.teacherRelationCount}</dd>
            </div>
            <div>
              <dt className="text-amber-800">Групп</dt>
              <dd className="font-bold">{mergePreview.groupMembershipCount}</dd>
            </div>
            <div>
              <dt className="text-amber-800">Аудиторий курсов</dt>
              <dd className="font-bold">{mergePreview.courseAudienceCount}</dd>
            </div>
            <div>
              <dt className="text-amber-800">Конфликтов одного проведения</dt>
              <dd className="font-bold">{mergePreview.conflicts.length}</dd>
            </div>
          </dl>
          {mergePreview.blockers.length > 0 ? (
            <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-rose-900">
              {mergePreview.blockers.map((blocker) => (
                <li key={blocker.code}>
                  {blocker.message}
                  {blocker.count ? ` (${blocker.count})` : ""}
                </li>
              ))}
            </ul>
          ) : null}
          <div className="mt-5 flex flex-wrap gap-2">
            <Button
              type="button"
              disabled={busy || !mergePreview.canConfirm}
              onClick={() => void confirmPhysicalMerge()}
            >
              Подтвердить объединение
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={() => void cancelPhysicalMerge()}
            >
              Не объединять
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
