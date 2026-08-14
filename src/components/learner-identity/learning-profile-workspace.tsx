"use client";

import {
  BadgeCheck,
  BrainCircuit,
  Database,
  History,
  LoaderCircle,
  Shield,
  UserRound,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppPageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { SurfaceCard } from "@/components/ui/surface-card";
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
  SelfLearningProfile,
  ShareCode,
} from "@/modules/learner-identity/domain";
import type { AccountAttestationCredential } from "@/modules/course-attestations/domain";
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

type Surface = "overview" | "history" | "attestation" | "access" | "data";

const LEARNING_PROFILE_TABS_ID = "learning-profile";

export function LearningProfileWorkspace() {
  const [surface, setSurface] = useState<Surface>("overview");
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
  const [destructiveMode, setDestructiveMode] = useState<
    "unlink" | "erasure" | null
  >(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [
        nextProfile,
        nextProgress,
        historyPage,
        nextConnections,
        nextConsents,
      ] = await Promise.all([
        loadSelfLearningProfile(),
        loadSelfProgress(),
        loadSelfHistory(),
        loadConnections(),
        loadAiConsents(),
      ]);
      setProfile(nextProfile);
      setProgress(nextProgress);
      setHistory(historyPage.items);
      setNextCursor(historyPage.nextCursor);
      setConnections(nextConnections);
      setConsents(nextConsents);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Не удалось загрузить учебный профиль.",
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
    if (
      surface !== "attestation" ||
      attestations !== null ||
      attestationsLoading ||
      attestationsError
    ) {
      return;
    }
    void loadAttestations();
  }, [
    attestations,
    attestationsError,
    attestationsLoading,
    loadAttestations,
    surface,
  ]);

  async function mutate(action: () => Promise<unknown>) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await action();
      await load();
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

  return (
    <div className="space-y-6">
      <AppPageHeader
        title="Мой учебный профиль"
        metric={
          !loading && progress
            ? `Завершённых занятий: ${progress.finalizedRunCount} · предметов: ${progress.subjects.length}`
            : undefined
        }
      />
      <WorkspaceTabs
        idBase={LEARNING_PROFILE_TABS_ID}
        ariaLabel="Разделы учебного профиля"
        value={surface}
        onChange={setSurface}
        items={[
          { value: "overview", label: "Обзор", icon: UserRound },
          {
            value: "history",
            label: "История",
            icon: History,
            count: history.length,
          },
          {
            value: "attestation",
            label: "Аттестация",
            icon: BadgeCheck,
            ...(attestations === null ? {} : { count: attestations.length }),
          },
          {
            value: "access",
            label: "Связи и помощник",
            icon: Shield,
            count:
              connections.filter(
                (item) =>
                  item.status === "pending" && item.direction === "incoming",
              ).length +
              consents.filter((item) => item.status === "pending").length,
          },
          { value: "data", label: "Данные", icon: Database },
        ]}
      />
      {error ? (
        <IdentityError message={error} onRetry={() => void load()} />
      ) : null}
      {loading ? (
        <IdentityLoading>Загружаем учебный профиль…</IdentityLoading>
      ) : null}
      <div
        id={workspaceTabPanelId(LEARNING_PROFILE_TABS_ID, "overview")}
        role="tabpanel"
        aria-labelledby={workspaceTabId(LEARNING_PROFILE_TABS_ID, "overview")}
        hidden={surface !== "overview"}
        tabIndex={0}
      >
        {!loading && profile && progress && surface === "overview" ? (
          <div className="space-y-5">
            <SurfaceCard>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Ваш учебный профиль
                  </p>
                  <h1 className="mt-1 text-2xl font-black text-neutral-950">
                    {profile.displayName}
                  </h1>
                  <p className="mt-2 text-sm text-neutral-600">
                    Объединено прежних учебных профилей:{" "}
                    {profile.mergedLineageCount}. Служебные идентификаторы и
                    данные безопасности здесь не показываются.
                  </p>
                </div>
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-900">
                  Связан с вашим аккаунтом
                </span>
              </div>
            </SurfaceCard>
            <ProgressSummary progress={progress} />
            <ShareCodeCard
              shareCode={shareCode}
              busy={busy}
              onRotate={() => void rotateCode()}
            />
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
        {!loading && profile && progress && surface === "history" ? (
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
            <div className="rounded-2xl border border-neutral-200 bg-white p-5">
              <div className="flex items-start gap-3">
                <BadgeCheck
                  className="mt-0.5 h-5 w-5 text-emerald-700"
                  aria-hidden="true"
                />
                <div>
                  <h2 className="font-bold text-neutral-950">Аттестация</h2>
                  <p className="mt-1 text-sm leading-relaxed text-neutral-600">
                    Здесь собраны пройденные аттестации по профессиональным
                    курсам. Это результат внутри ShiDao, а не государственное
                    удостоверение о повышении квалификации.
                  </p>
                </div>
              </div>
            </div>

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
                    className="rounded-2xl border border-neutral-200 bg-white p-5"
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
        id={workspaceTabPanelId(LEARNING_PROFILE_TABS_ID, "access")}
        role="tabpanel"
        aria-labelledby={workspaceTabId(LEARNING_PROFILE_TABS_ID, "access")}
        hidden={surface !== "access"}
        tabIndex={0}
      >
        {!loading && profile && progress && surface === "access" ? (
          <div className="grid gap-5 lg:grid-cols-2">
            <section className="rounded-2xl border border-neutral-200 bg-white p-5">
              <h2 className="font-bold text-neutral-950">
                Запросы преподавателей
              </h2>
              <p className="mt-1 text-sm text-neutral-600">
                Код и email создают только запрос. Вы решаете, активировать ли
                связь.
              </p>
              {connections.length === 0 ? (
                <div className="mt-4">
                  <IdentityEmpty
                    title="Запросов нет"
                    description="Поделитесь одноразовым кодом только с нужным преподавателем."
                  />
                </div>
              ) : (
                <ul className="mt-4 space-y-3">
                  {connections.map((request) => (
                    <li
                      key={request.id}
                      className="rounded-xl border border-neutral-200 p-3"
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
            </section>
            <section className="rounded-2xl border border-neutral-200 bg-white p-5">
              <div className="flex items-start gap-3">
                <BrainCircuit className="mt-0.5 h-5 w-5" aria-hidden="true" />
                <div>
                  <h2 className="font-bold text-neutral-950">
                    Персонализация с общей историей
                  </h2>
                  <p className="mt-1 text-sm text-neutral-600">
                    Отдельное согласие для конкретного курса и его текущего
                    владельца. Оно не открывает преподавателю чужие личные
                    заметки других преподавателей.
                  </p>
                </div>
              </div>
              {consents.length === 0 ? (
                <div className="mt-4">
                  <IdentityEmpty
                    title="Запросов помощника нет"
                    description="Без вашего разрешения помощник использует только историю, записанную владельцем курса."
                  />
                </div>
              ) : (
                <ul className="mt-4 space-y-3">
                  {consents.map((consent) => (
                    <li
                      key={consent.id}
                      className="rounded-xl border border-neutral-200 p-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <strong className="text-sm">
                          {consent.courseTitle}
                        </strong>
                        <AiConsentStatusBadge status={consent.status} />
                      </div>
                      <p className="mt-1 text-xs text-neutral-600">
                        Владелец: {consent.ownerLabel}. Цель: {consent.purpose}.
                        До {formatIdentityDate(consent.expiresAt)}
                      </p>
                      <div className="mt-3 flex gap-2">
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
            </section>
          </div>
        ) : null}
      </div>
      <div
        id={workspaceTabPanelId(LEARNING_PROFILE_TABS_ID, "data")}
        role="tabpanel"
        aria-labelledby={workspaceTabId(LEARNING_PROFILE_TABS_ID, "data")}
        hidden={surface !== "data"}
        tabIndex={0}
      >
        {!loading && profile && progress && surface === "data" ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
              <h2 className="font-bold text-amber-950">
                Ошибочная прямая связь
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-amber-900">
                Отвязка доступна только для ошибочной прямой связи, пока учебные
                результаты ещё не объединялись и нет зависимых разрешений.
                Прежний профиль останется у связанных преподавателей без
                аккаунта, а у вас появится новый пустой профиль.
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
            </section>
            <section className="rounded-2xl border border-rose-200 bg-rose-50 p-5">
              <h2 className="font-bold text-rose-950">Сброс учебных данных</h2>
              <p className="mt-2 text-sm leading-relaxed text-rose-900">
                Будут удалены все ваши учебные результаты, связи, приглашения,
                доступы наблюдателей и разрешения помощнику. Перед действием
                потребуется ещё раз подтвердить вход.
              </p>
              <Button
                type="button"
                variant="secondary"
                className="product-btn-danger mt-4"
                onClick={() => setDestructiveMode("erasure")}
              >
                Проверить, что будет удалено
              </Button>
            </section>
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
