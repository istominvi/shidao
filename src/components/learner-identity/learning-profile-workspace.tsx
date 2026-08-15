"use client";

import {
  BadgeCheck,
  BrainCircuit,
  History,
  LoaderCircle,
  LogOut,
  Settings,
  UserRound,
  UsersRound,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  AccountSettingsPanel,
  type AccountEmailStatus,
} from "@/components/account/account-settings-panel";
import { AppPageHeader } from "@/components/app/page-header";
import { useSystemAssistantPageContext } from "@/components/assistant/system-assistant-provider";
import { usePrimaryHeaderSummary } from "@/components/navigation/primary-header-summary-provider";
import { useSessionView } from "@/components/use-session-view";
import { Button } from "@/components/ui/button";
import { ProfileSurface } from "@/components/profile/profile-surface";
import {
  WorkspaceTabs,
  workspaceTabId,
  workspaceTabPanelId,
} from "@/components/ui/workspace-tabs";
import type {
  LearnerAiConsent,
  LearnerConnectionRequest,
  LearnerProgress,
  LearnerSafeHistoryItem,
  ObserverOverview,
  SelfLearningProfile,
  ShareCode,
} from "@/modules/learner-identity/domain";
import type { AccountAttestationCredential } from "@/modules/course-attestations/domain";
import { signOutViaServer } from "@/lib/auth-flow";
import { profileTabHref, type ProfileTab } from "@/lib/navigation/profile-nav";
import profileStyles from "@/components/profile/profile-workspace.module.css";
import {
  actOnAiConsent,
  actOnConnection,
  loadAccountAttestations,
  loadAiConsents,
  loadConnections,
  loadSelfHistory,
  loadSelfLearningProfile,
  loadSelfProgress,
  rotateSelfShareCode,
} from "./identity-client";
import { DestructiveProfileDialog } from "./destructive-profile-dialog";
import {
  AiConsentStatusBadge,
  formatIdentityDate,
  IdentityEmpty,
  IdentityError,
  IdentityLoading,
  RequestStatusBadge,
} from "./identity-ui";
import { ProgressSummary } from "./progress-summary";
import { SafeHistoryList } from "./safe-history-list";
import { ShareCodeCard } from "./share-code-card";
import { ObserversSettingsWorkspace } from "./observers-settings-workspace";

const LEARNING_PROFILE_TABS_ID = "learning-profile";

type LearningProfileWorkspaceProps = {
  initialSurface: ProfileTab;
  emailStatus: AccountEmailStatus;
};

export function LearningProfileWorkspace({
  initialSurface,
  emailStatus,
}: LearningProfileWorkspaceProps) {
  const router = useRouter();
  const { state: session, refetchSession } = useSessionView();
  const [surface, setSurface] = useState<ProfileTab>(initialSurface);
  const [profile, setProfile] = useState<SelfLearningProfile | null>(null);
  const [progress, setProgress] = useState<LearnerProgress | null>(null);
  const [history, setHistory] = useState<LearnerSafeHistoryItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [attestations, setAttestations] = useState<
    AccountAttestationCredential[] | null
  >(null);
  const [attestationsLoading, setAttestationsLoading] = useState(false);
  const [attestationsError, setAttestationsError] = useState<string | null>(
    null,
  );
  const attestationRequestInFlightRef = useRef(false);
  const [connections, setConnections] = useState<LearnerConnectionRequest[]>(
    [],
  );
  const [consents, setConsents] = useState<LearnerAiConsent[]>([]);
  const [shareCode, setShareCode] = useState<ShareCode | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const [hasPin, setHasPin] = useState(
    session.kind === "account" ? session.hasPin : false,
  );
  const [observerSummary, setObserverSummary] = useState<{
    active: number;
    pending: number;
  } | null>(null);
  const [observerSummaryPending, setObserverSummaryPending] = useState(true);
  const [destructiveMode, setDestructiveMode] = useState<
    "unlink" | "erasure" | null
  >(null);
  const {
    summary: primaryHeaderSummary,
    refresh: refreshPrimaryHeaderSummary,
  } = usePrimaryHeaderSummary();

  useEffect(() => {
    setSurface(initialSurface);
  }, [initialSurface]);

  useEffect(() => {
    if (session.kind === "account") setHasPin(session.hasPin);
  }, [session]);

  useSystemAssistantPageContext({
    surface:
      surface === "observers"
        ? "observer_settings"
        : surface === "settings"
          ? "profile_settings"
          : "learning_profile",
    courseId: null,
    lessonId: null,
    label:
      surface === "observers"
        ? "Профиль · Наблюдатели"
        : surface === "settings"
          ? "Профиль · Настройки"
          : `Профиль · ${surface === "profile" ? "Профиль" : surface === "history" ? "История" : "Аттестация"}`,
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [
        profileResult,
        progressResult,
        historyResult,
        connectionsResult,
        consentsResult,
      ] = await Promise.allSettled([
        loadSelfLearningProfile(),
        loadSelfProgress(),
        loadSelfHistory(),
        loadConnections(),
        loadAiConsents(),
      ]);

      const unavailableSections: string[] = [];
      if (profileResult.status === "fulfilled") {
        setProfile(profileResult.value);
      }
      if (progressResult.status === "fulfilled") {
        setProgress(progressResult.value);
      }
      if (historyResult.status === "fulfilled") {
        setHistory(historyResult.value.items);
        setNextCursor(historyResult.value.nextCursor);
      } else {
        unavailableSections.push("история занятий");
      }
      if (connectionsResult.status === "fulfilled") {
        setConnections(connectionsResult.value);
      } else {
        unavailableSections.push("запросы преподавателей");
      }
      if (consentsResult.status === "fulfilled") {
        setConsents(consentsResult.value);
      } else {
        unavailableSections.push("разрешения помощнику");
      }

      const requiredFailure =
        profileResult.status === "rejected"
          ? profileResult.reason
          : progressResult.status === "rejected"
            ? progressResult.reason
            : null;
      if (requiredFailure) {
        setError(
          requiredFailure instanceof Error
            ? requiredFailure.message
            : "Не удалось загрузить профиль.",
        );
      } else if (unavailableSections.length > 0) {
        setError(
          `Профиль загружен, но временно недоступны: ${unavailableSections.join(
            ", ",
          )}.`,
        );
      }
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Не удалось загрузить профиль.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const loadAttestations = useCallback(async () => {
    if (attestationRequestInFlightRef.current) return;
    attestationRequestInFlightRef.current = true;
    setAttestationsLoading(true);
    setAttestationsError(null);
    try {
      setAttestations(await loadAccountAttestations());
    } catch (caught) {
      setAttestationsError(
        caught instanceof Error
          ? caught.message
          : "Не удалось загрузить аттестации.",
      );
    } finally {
      attestationRequestInFlightRef.current = false;
      setAttestationsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (attestations !== null || attestationsLoading || attestationsError) {
      return;
    }
    void loadAttestations();
  }, [attestations, attestationsError, attestationsLoading, loadAttestations]);

  async function mutate(action: () => Promise<unknown>) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await action();
      await load();
      refreshPrimaryHeaderSummary();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Не удалось выполнить действие.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    setError(null);
    try {
      const page = await loadSelfHistory(nextCursor);
      setHistory((current) => [...current, ...page.items]);
      setNextCursor(page.nextCursor);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Не удалось продолжить историю.",
      );
    } finally {
      setLoadingMore(false);
    }
  }

  async function rotateCode() {
    setBusy(true);
    setError(null);
    try {
      setShareCode(await rotateSelfShareCode());
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Не удалось создать код.",
      );
    } finally {
      setBusy(false);
    }
  }

  function changeSurface(nextSurface: ProfileTab) {
    setSurface(nextSurface);
    router.replace(profileTabHref(nextSurface), { scroll: false });
  }

  const handleObserverOverview = useCallback((overview: ObserverOverview) => {
    setObserverSummary({
      active: overview.grants.filter(
        (grant) => grant.direction === "observed_by",
      ).length,
      pending: overview.invitations.filter(
        (invitation) =>
          invitation.direction === "outgoing" &&
          (invitation.status === "pending" || invitation.status === "bound"),
      ).length,
    });
  }, []);

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    setSignOutError(null);
    try {
      const response = await signOutViaServer();
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(payload?.error ?? "Не удалось выйти из аккаунта.");
      }

      await refetchSession();
      router.push("/login");
      router.refresh();
    } catch (caught) {
      setSignOutError(
        caught instanceof Error
          ? caught.message
          : "Не удалось выйти из аккаунта.",
      );
      setSigningOut(false);
    }
  }

  const cachedProfileSummary = primaryHeaderSummary?.profile ?? null;
  const headerMetric = (() => {
    switch (surface) {
      case "profile":
        return progress
          ? `Завершённых занятий: ${progress.finalizedRunCount} · предметов: ${progress.subjects.length}`
          : cachedProfileSummary
            ? `Завершённых занятий: ${cachedProfileSummary.finalizedRunCount} · предметов: ${cachedProfileSummary.subjectCount}`
            : undefined;
      case "history":
        return progress
          ? `Записей: ${progress.finalizedRunCount} · посещено: ${progress.attendedRunCount}`
          : cachedProfileSummary
            ? `Записей: ${cachedProfileSummary.finalizedRunCount} · посещено: ${cachedProfileSummary.attendedRunCount}`
            : undefined;
      case "attestation":
        return attestations ? `Аттестаций: ${attestations.length}` : undefined;
      case "observers":
        return observerSummary
          ? `Наблюдателей: ${observerSummary.active} · приглашений: ${observerSummary.pending}`
          : undefined;
      case "settings":
        return session.kind === "account"
          ? hasPin
            ? "PIN настроен"
            : "PIN не настроен"
          : undefined;
      default: {
        const _exhaustive: never = surface;
        return _exhaustive;
      }
    }
  })();
  const headerMetricPending =
    headerMetric === undefined &&
    (() => {
      switch (surface) {
        case "profile":
        case "history":
          return loading && error === null;
        case "attestation":
          return attestations === null && attestationsError === null;
        case "observers":
          return observerSummaryPending;
        case "settings":
          return false;
        default: {
          const _exhaustive: never = surface;
          return _exhaustive;
        }
      }
    })();

  const profileTitle =
    session.kind === "account"
      ? (session.fullName ?? profile?.displayName ?? "Профиль")
      : (profile?.displayName ?? "Профиль");

  return (
    <div className={`${profileStyles.workspace} space-y-6`}>
      <AppPageHeader
        title={profileTitle}
        metric={headerMetric}
        metricPending={headerMetricPending}
        actions={
          <Button
            type="button"
            disabled={signingOut}
            aria-busy={signingOut}
            onClick={() => void handleSignOut()}
          >
            <LogOut aria-hidden="true" />
            {signingOut ? "Выход…" : "Выход"}
          </Button>
        }
      />
      <WorkspaceTabs
        idBase={LEARNING_PROFILE_TABS_ID}
        ariaLabel="Разделы профиля"
        value={surface}
        onChange={changeSurface}
        items={[
          { value: "profile", label: "Профиль", icon: UserRound },
          {
            value: "history",
            label: "История",
            icon: History,
            ...(progress === null && cachedProfileSummary === null
              ? {}
              : {
                  count:
                    progress?.finalizedRunCount ??
                    cachedProfileSummary?.finalizedRunCount ??
                    0,
                }),
          },
          {
            value: "attestation",
            label: "Аттестация",
            icon: BadgeCheck,
            ...(attestations === null ? {} : { count: attestations.length }),
          },
          {
            value: "observers",
            label: "Наблюдатели",
            icon: UsersRound,
            ...(observerSummary === null
              ? {}
              : { count: observerSummary.active }),
          },
          {
            value: "settings",
            label: "Настройки",
            icon: Settings,
            count: consents.filter((item) => item.status === "pending").length,
          },
        ]}
      />
      {signOutError ? <IdentityError message={signOutError} /> : null}
      {error ? (
        <IdentityError message={error} onRetry={() => void load()} />
      ) : null}
      {loading ? <IdentityLoading>Загружаем профиль…</IdentityLoading> : null}
      <div
        id={workspaceTabPanelId(LEARNING_PROFILE_TABS_ID, "profile")}
        role="tabpanel"
        aria-labelledby={workspaceTabId(LEARNING_PROFILE_TABS_ID, "profile")}
        hidden={surface !== "profile"}
        tabIndex={0}
      >
        {!loading && profile && progress && surface === "profile" ? (
          <div className="space-y-5">
            <ProfileSurface
              title="Учебная информация"
              description={`Создан ${formatIdentityDate(profile.createdAt)} · объединено прежних профилей: ${profile.mergedLineageCount}`}
              actions={
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-900">
                  Связан с аккаунтом
                </span>
              }
            />
            <ProgressSummary progress={progress} />
            <ShareCodeCard
              shareCode={shareCode}
              busy={busy}
              onRotate={() => void rotateCode()}
            />
            <ProfileSurface
              title="Запросы преподавателей"
              description="Код и email создают только запрос. Вы сами решаете, активировать ли связь."
            >
              {connections.length === 0 ? (
                <IdentityEmpty
                  surface="row"
                  title="Запросов нет"
                  description="Поделитесь одноразовым кодом только с нужным преподавателем."
                />
              ) : (
                <ul className="space-y-3">
                  {connections.map((request) => (
                    <li
                      key={request.id}
                      className={profileStyles.row}
                      data-profile-surface="row"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <strong className="text-sm">
                          {request.counterpartyLabel}
                        </strong>
                        <RequestStatusBadge status={request.status} />
                      </div>
                      <p className="mt-1 text-xs text-neutral-500">
                        До {formatIdentityDate(request.expiresAt)}
                      </p>
                      {request.status === "pending" ? (
                        <div className="mt-3 flex gap-2">
                          {request.direction === "incoming" ? (
                            <>
                              <Button
                                type="button"
                                disabled={busy}
                                onClick={() =>
                                  void mutate(() =>
                                    actOnConnection(request.id, "accept"),
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
                                    actOnConnection(request.id, "reject"),
                                  )
                                }
                              >
                                Отклонить
                              </Button>
                            </>
                          ) : (
                            <Button
                              type="button"
                              variant="ghost"
                              disabled={busy}
                              onClick={() =>
                                void mutate(() =>
                                  actOnConnection(request.id, "cancel"),
                                )
                              }
                            >
                              Отменить
                            </Button>
                          )}
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </ProfileSurface>
          </div>
        ) : null}
      </div>
      <div
        id={workspaceTabPanelId(LEARNING_PROFILE_TABS_ID, "history")}
        role="tabpanel"
        aria-labelledby={workspaceTabId(LEARNING_PROFILE_TABS_ID, "history")}
        hidden={surface !== "history"}
        tabIndex={0}
      >
        {!loading && surface === "history" ? (
          <SafeHistoryList
            items={history}
            nextCursor={nextCursor}
            loadingMore={loadingMore}
            onLoadMore={() => void loadMore()}
          />
        ) : null}
      </div>
      <div
        id={workspaceTabPanelId(LEARNING_PROFILE_TABS_ID, "attestation")}
        role="tabpanel"
        aria-labelledby={workspaceTabId(
          LEARNING_PROFILE_TABS_ID,
          "attestation",
        )}
        hidden={surface !== "attestation"}
        tabIndex={0}
      >
        {surface === "attestation" ? (
          <div className="space-y-4">
            <ProfileSurface
              title={
                <span className="inline-flex items-center gap-2">
                  <BadgeCheck
                    className="h-5 w-5 text-emerald-700"
                    aria-hidden="true"
                  />
                  Аттестация
                </span>
              }
              description="Здесь собраны пройденные аттестации по профессиональным курсам. Это результат внутри ShiDao, а не государственное удостоверение о повышении квалификации."
            />

            {attestationsLoading ? (
              <IdentityLoading>Загружаем аттестации…</IdentityLoading>
            ) : null}
            {attestationsError ? (
              <IdentityError
                message={attestationsError}
                onRetry={() => void loadAttestations()}
              />
            ) : null}
            {!attestationsLoading &&
            !attestationsError &&
            attestations?.length === 0 ? (
              <IdentityEmpty
                surface="card"
                title="Аттестаций пока нет"
                description="После успешного прохождения итогового теста результат появится здесь."
              />
            ) : null}
            {!attestationsLoading &&
            !attestationsError &&
            attestations &&
            attestations.length > 0 ? (
              <ul className="grid gap-4 lg:grid-cols-2">
                {attestations.map((attestation) => (
                  <li
                    key={`${attestation.publicationId}:${attestation.revisionId}:${attestation.assessmentVersion}`}
                    className={profileStyles.card}
                    data-profile-surface="card"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                          {attestation.courseSubject}
                        </p>
                        <h3 className="mt-1 text-lg font-bold text-neutral-950">
                          {attestation.courseTitle}
                        </h3>
                        <p className="mt-1 text-sm text-neutral-600">
                          {attestation.assessmentTitle}
                        </p>
                      </div>
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-900">
                        <BadgeCheck
                          className="h-3.5 w-3.5"
                          aria-hidden="true"
                        />
                        Аттестован по курсу
                      </span>
                    </div>

                    <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                      <div>
                        <dt className="text-neutral-500">Результат</dt>
                        <dd className="font-semibold text-neutral-950">
                          {attestation.scorePercent}%
                        </dd>
                      </div>
                      <div>
                        <dt className="text-neutral-500">Проходной балл</dt>
                        <dd className="font-semibold text-neutral-950">
                          {attestation.passingScorePercent}%
                        </dd>
                      </div>
                      <div>
                        <dt className="text-neutral-500">Пройдено</dt>
                        <dd className="font-semibold text-neutral-950">
                          {formatIdentityDate(attestation.completedAt)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-neutral-500">Версия</dt>
                        <dd className="font-semibold text-neutral-950">
                          {attestation.assessmentVersion}
                        </dd>
                      </div>
                    </dl>

                    <div className="mt-4 border-t border-neutral-100 pt-3 text-xs leading-relaxed text-neutral-500">
                      <p>Автор курса: {attestation.publisherDisplayName}</p>
                      <p>
                        {attestation.isCurrentRevision
                          ? "Пройдена текущая редакция аттестации."
                          : "Пройдена предыдущая редакция аттестации."}{" "}
                        {attestation.publicationAvailable
                          ? "Курс доступен в каталоге."
                          : "Публикация курса сейчас недоступна."}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </div>
      <div
        id={workspaceTabPanelId(LEARNING_PROFILE_TABS_ID, "observers")}
        role="tabpanel"
        aria-labelledby={workspaceTabId(LEARNING_PROFILE_TABS_ID, "observers")}
        hidden={surface !== "observers"}
        tabIndex={0}
      >
        <ObserversSettingsWorkspace
          onOverviewChange={handleObserverOverview}
          onOverviewPendingChange={setObserverSummaryPending}
        />
      </div>
      <div
        id={workspaceTabPanelId(LEARNING_PROFILE_TABS_ID, "settings")}
        role="tabpanel"
        aria-labelledby={workspaceTabId(LEARNING_PROFILE_TABS_ID, "settings")}
        hidden={surface !== "settings"}
        tabIndex={0}
      >
        {session.kind === "account" && surface === "settings" ? (
          <div className="space-y-6">
            <AccountSettingsPanel
              initialHasPin={hasPin}
              emailStatus={emailStatus}
              onHasPinChange={setHasPin}
            />

            {!loading ? (
              <ProfileSurface
                title={
                  <span className="inline-flex items-center gap-2">
                    <BrainCircuit className="h-5 w-5" aria-hidden="true" />
                    Персонализация с общей историей
                  </span>
                }
                description="Разрешение действует только для конкретного курса и его текущего владельца и не открывает чужие личные заметки."
              >
                {consents.length === 0 ? (
                  <IdentityEmpty
                    surface="row"
                    title="Запросов помощника нет"
                    description="Без вашего разрешения помощник использует только историю, записанную владельцем курса."
                  />
                ) : (
                  <ul className="space-y-3">
                    {consents.map((consent) => (
                      <li
                        key={consent.id}
                        className={profileStyles.row}
                        data-profile-surface="row"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <strong className="text-sm">
                            {consent.courseTitle}
                          </strong>
                          <AiConsentStatusBadge status={consent.status} />
                        </div>
                        <p className="mt-1 text-xs text-neutral-600">
                          Владелец: {consent.ownerLabel}. Цель:{" "}
                          {consent.purpose}. До{" "}
                          {formatIdentityDate(consent.expiresAt)}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {consent.status === "pending" ? (
                            <>
                              <Button
                                type="button"
                                disabled={busy}
                                onClick={() =>
                                  void mutate(() =>
                                    actOnAiConsent(consent.id, "grant", {
                                      expectedRevision: consent.revision,
                                      expiresInDays: 90,
                                    }),
                                  )
                                }
                              >
                                Разрешить
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                disabled={busy}
                                onClick={() =>
                                  void mutate(() =>
                                    actOnAiConsent(consent.id, "revoke", {
                                      expectedRevision: consent.revision,
                                    }),
                                  )
                                }
                              >
                                Отклонить
                              </Button>
                            </>
                          ) : null}
                          {consent.status === "active" ? (
                            <Button
                              type="button"
                              variant="ghost"
                              disabled={busy}
                              onClick={() =>
                                void mutate(() =>
                                  actOnAiConsent(consent.id, "revoke", {
                                    expectedRevision: consent.revision,
                                  }),
                                )
                              }
                            >
                              Отозвать
                            </Button>
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </ProfileSurface>
            ) : null}

            {profile ? (
              <section aria-labelledby="learning-profile-lifecycle-title">
                <div>
                  <h2
                    id="learning-profile-lifecycle-title"
                    className="surface-card-title"
                  >
                    Управление данными профиля
                  </h2>
                  <p className="surface-card-description">
                    Отвязка и сброс требуют отдельного подтверждения и никогда
                    не выполняются автоматически.
                  </p>
                </div>
                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  <div
                    className={profileStyles.card}
                    data-profile-surface="card"
                  >
                    <h3 className="surface-card-title">
                      Ошибочная прямая связь
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-neutral-600">
                      Отвязка доступна только до объединения результатов и при
                      отсутствии зависимых разрешений. У аккаунта появится новый
                      пустой профиль.
                    </p>
                    <Button
                      type="button"
                      variant="ghost"
                      className="mt-4"
                      disabled={!profile.canSafeUnlink}
                      onClick={() => setDestructiveMode("unlink")}
                    >
                      Проверить возможность отвязки
                    </Button>
                  </div>
                  <div
                    className={profileStyles.card}
                    data-profile-surface="card"
                  >
                    <h3 className="surface-card-title">Сброс учебных данных</h3>
                    <p className="mt-2 text-sm leading-relaxed text-neutral-600">
                      Будут удалены учебные результаты, связи, приглашения,
                      доступы наблюдателей и разрешения помощнику. Потребуется
                      повторное подтверждение входа.
                    </p>
                    <Button
                      type="button"
                      variant="secondary"
                      className="product-btn-danger mt-4"
                      onClick={() => setDestructiveMode("erasure")}
                    >
                      Проверить, что будет удалено
                    </Button>
                  </div>
                </div>
              </section>
            ) : null}
          </div>
        ) : null}
      </div>
      {busy ? (
        <p
          className="flex items-center gap-2 text-sm text-neutral-600"
          role="status"
        >
          <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
          Сохраняем изменение…
        </p>
      ) : null}
      {destructiveMode ? (
        <DestructiveProfileDialog
          mode={destructiveMode}
          onClose={() => setDestructiveMode(null)}
          onCompleted={load}
        />
      ) : null}
    </div>
  );
}
