"use client";

import {
  BookOpenCheck,
  Eye,
  History,
  Lightbulb,
  LoaderCircle,
  UserRound,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppPageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import {
  WorkspaceTabs,
  workspaceTabId,
  workspaceTabPanelId,
} from "@/components/ui/workspace-tabs";
import type {
  LearnerProgress,
  LearnerSafeHistoryItem,
  ObserverGrant,
} from "@/modules/learner-identity/domain";
import type { LearnerSafeActivityProfile } from "@/modules/learning-activities";
import {
  actOnObserver,
  loadObservedHistory,
  loadObservedActivityProfile,
  loadObservedProfiles,
  loadObservedProgress,
} from "./identity-client";
import { IdentityEmpty, IdentityError, IdentityLoading } from "./identity-ui";
import { ProgressSummary } from "./progress-summary";
import { SafeHistoryList } from "./safe-history-list";
import { SafeActivityProfileSection } from "@/components/learning-activities/activity-profile-sections";

type Surface = "progress" | "history" | "skills" | "recommendations";

const OBSERVING_PROJECTION_TABS_ID = "observing-projection";

type ObservingWorkspaceProps = {
  embedded?: boolean;
  onProfileCountChange?: (count: number) => void;
};

function isProjectionAccessFailure(error: unknown) {
  if (!error || typeof error !== "object" || !("status" in error)) {
    return false;
  }
  const status = (error as { status?: unknown }).status;
  return status === 401 || status === 403 || status === 404;
}

export function ObservingWorkspace({
  embedded = false,
  onProfileCountChange,
}: ObservingWorkspaceProps) {
  const [profiles, setProfiles] = useState<ObserverGrant[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [surface, setSurface] = useState<Surface>("progress");
  const [progress, setProgress] = useState<LearnerProgress | null>(null);
  const [history, setHistory] = useState<LearnerSafeHistoryItem[]>([]);
  const [activityProfile, setActivityProfile] =
    useState<LearnerSafeActivityProfile | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loadingProjection, setLoadingProjection] = useState(false);
  const [loadingActivityProfile, setLoadingActivityProfile] = useState(false);
  const [activityError, setActivityError] = useState<string | null>(null);
  const [projectionReload, setProjectionReload] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const projectionGenerationRef = useRef(0);
  const selectedIdRef = useRef<string | null>(null);

  const loadProfiles = useCallback(async () => {
    setError(null);
    try {
      const next = await loadObservedProfiles();
      setProfiles(next);
      setSelectedId((current) =>
        current && next.some((item) => item.learnerProfileId === current)
          ? current
          : (next[0]?.learnerProfileId ?? null),
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Не удалось загрузить наблюдение.",
      );
    }
  }, []);

  useEffect(() => {
    void loadProfiles();
  }, [loadProfiles]);

  useEffect(() => {
    if (profiles !== null) onProfileCountChange?.(profiles.length);
  }, [onProfileCountChange, profiles]);

  useEffect(() => {
    if (!selectedId) {
      projectionGenerationRef.current += 1;
      selectedIdRef.current = null;
      setProgress(null);
      setHistory([]);
      setActivityProfile(null);
      setNextCursor(null);
      setActivityError(null);
      setLoadingProjection(false);
      setLoadingActivityProfile(false);
      setBusy(false);
      return;
    }
    const learnerProfileId = selectedId;
    const generation = ++projectionGenerationRef.current;
    selectedIdRef.current = learnerProfileId;
    let active = true;
    setLoadingProjection(true);
    setLoadingActivityProfile(true);
    setBusy(false);
    setError(null);
    setProgress(null);
    setHistory([]);
    setActivityProfile(null);
    setNextCursor(null);
    setActivityError(null);
    const isCurrent = () =>
      active &&
      generation === projectionGenerationRef.current &&
      selectedIdRef.current === learnerProfileId;
    const failClosed = (reason: unknown) => {
      if (!isCurrent()) return;
      projectionGenerationRef.current += 1;
      selectedIdRef.current = null;
      setProgress(null);
      setHistory([]);
      setActivityProfile(null);
      setNextCursor(null);
      setProfiles(null);
      setSelectedId(null);
      setLoadingProjection(false);
      setLoadingActivityProfile(false);
      setError(
        reason instanceof Error
          ? reason.message
          : "Доступ к профилю больше недоступен.",
      );
      void loadProfiles();
    };

    void loadObservedActivityProfile(learnerProfileId)
      .then((nextActivityProfile) => {
        if (!isCurrent()) return;
        setActivityProfile(nextActivityProfile);
      })
      .catch((caught: unknown) => {
        if (!isCurrent()) return;
        if (isProjectionAccessFailure(caught)) {
          failClosed(caught);
          return;
        }
        setActivityError(
          caught instanceof Error
            ? caught.message
            : "Не удалось загрузить навыки и рекомендации.",
        );
      })
      .finally(() => {
        if (isCurrent()) setLoadingActivityProfile(false);
      });

    void Promise.allSettled([
      loadObservedProgress(learnerProfileId),
      loadObservedHistory(learnerProfileId),
    ])
      .then(([progressResult, historyResult]) => {
        if (!isCurrent()) return;
        const accessFailure = [progressResult, historyResult].find(
          (result) =>
            result.status === "rejected" &&
            isProjectionAccessFailure(result.reason),
        );
        if (accessFailure?.status === "rejected") {
          failClosed(accessFailure.reason);
          return;
        }
        if (
          progressResult.status === "rejected" ||
          historyResult.status === "rejected"
        ) {
          setProgress(null);
          setHistory([]);
          setNextCursor(null);
          const reason =
            progressResult.status === "rejected"
              ? progressResult.reason
              : historyResult.status === "rejected"
                ? historyResult.reason
                : null;
          setError(
            reason instanceof Error
              ? reason.message
              : "Не удалось загрузить доступные данные профиля.",
          );
          return;
        }
        setProgress(progressResult.value);
        setHistory(historyResult.value.items);
        setNextCursor(historyResult.value.nextCursor);
      })
      .finally(() => {
        if (isCurrent()) setLoadingProjection(false);
      });
    return () => {
      active = false;
    };
  }, [loadProfiles, projectionReload, selectedId]);

  async function retryActivityProfile() {
    if (!selectedId || loadingActivityProfile) return;
    const learnerProfileId = selectedId;
    const generation = projectionGenerationRef.current;
    setLoadingActivityProfile(true);
    setActivityError(null);
    try {
      const nextActivityProfile =
        await loadObservedActivityProfile(learnerProfileId);
      if (
        generation !== projectionGenerationRef.current ||
        selectedIdRef.current !== learnerProfileId
      )
        return;
      setActivityProfile(nextActivityProfile);
    } catch (caught) {
      if (
        generation !== projectionGenerationRef.current ||
        selectedIdRef.current !== learnerProfileId
      )
        return;
      if (isProjectionAccessFailure(caught)) {
        projectionGenerationRef.current += 1;
        selectedIdRef.current = null;
        setProgress(null);
        setHistory([]);
        setActivityProfile(null);
        setNextCursor(null);
        setProfiles(null);
        setSelectedId(null);
        setError(
          caught instanceof Error
            ? caught.message
            : "Доступ к профилю больше недоступен.",
        );
        void loadProfiles();
      } else {
        setActivityError(
          caught instanceof Error
            ? caught.message
            : "Не удалось загрузить навыки и рекомендации.",
        );
      }
    } finally {
      if (
        generation === projectionGenerationRef.current &&
        selectedIdRef.current === learnerProfileId
      )
        setLoadingActivityProfile(false);
    }
  }

  const selectedGrant =
    profiles?.find((item) => item.learnerProfileId === selectedId) ?? null;

  async function leave() {
    if (!selectedGrant || busy) return;
    if (
      !window.confirm(
        `Отказаться от наблюдения за «${selectedGrant.subjectLabel}»? Доступ прекратится сразу.`,
      )
    )
      return;
    const leavingLearnerProfileId = selectedGrant.learnerProfileId;
    const remainingProfiles = (profiles ?? []).filter(
      (grant) => grant.id !== selectedGrant.id,
    );
    projectionGenerationRef.current += 1;
    selectedIdRef.current = null;
    setSelectedId(null);
    setBusy(true);
    setError(null);
    setProgress(null);
    setHistory([]);
    setActivityProfile(null);
    setNextCursor(null);
    setLoadingProjection(false);
    setLoadingActivityProfile(false);
    try {
      await actOnObserver(selectedGrant.id, "leave");
      const nextSelectedId = remainingProfiles[0]?.learnerProfileId ?? null;
      setProfiles(remainingProfiles);
      selectedIdRef.current = nextSelectedId;
      setSelectedId(nextSelectedId);
    } catch (caught) {
      selectedIdRef.current = leavingLearnerProfileId;
      setSelectedId(leavingLearnerProfileId);
      setError(
        caught instanceof Error
          ? caught.message
          : "Не удалось отказаться от доступа.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function loadMore() {
    if (!selectedId || !nextCursor || busy) return;
    const learnerProfileId = selectedId;
    const generation = projectionGenerationRef.current;
    const cursor = nextCursor;
    setBusy(true);
    try {
      const page = await loadObservedHistory(learnerProfileId, cursor);
      if (
        generation !== projectionGenerationRef.current ||
        selectedIdRef.current !== learnerProfileId
      )
        return;
      setHistory((current) => [...current, ...page.items]);
      setNextCursor(page.nextCursor);
    } catch (caught) {
      if (
        generation !== projectionGenerationRef.current ||
        selectedIdRef.current !== learnerProfileId
      )
        return;
      if (isProjectionAccessFailure(caught)) {
        projectionGenerationRef.current += 1;
        selectedIdRef.current = null;
        setProgress(null);
        setHistory([]);
        setActivityProfile(null);
        setNextCursor(null);
        setProfiles(null);
        setSelectedId(null);
        setError(
          caught instanceof Error
            ? caught.message
            : "Доступ к профилю больше недоступен.",
        );
        void loadProfiles();
      } else {
        setError(
          caught instanceof Error
            ? caught.message
            : "Не удалось продолжить историю.",
        );
      }
    } finally {
      if (
        generation === projectionGenerationRef.current &&
        selectedIdRef.current === learnerProfileId
      )
        setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {!embedded ? (
        <AppPageHeader
          title="Наблюдение"
          metric={
            profiles === null ? undefined : `Профилей: ${profiles.length}`
          }
        />
      ) : null}
      {error ? (
        <IdentityError
          message={error}
          onRetry={() => {
            void loadProfiles();
            setProjectionReload((current) => current + 1);
          }}
        />
      ) : null}
      {profiles === null ? (
        <IdentityLoading>Проверяем доступные профили…</IdentityLoading>
      ) : null}
      {profiles?.length === 0 ? (
        <IdentityEmpty
          title="Нет активного наблюдения"
          description="Владелец учебного профиля может адресно пригласить вас в настройках «Наблюдатели»."
        />
      ) : null}
      {profiles && profiles.length > 0 ? (
        <div className="grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="space-y-2" aria-label="Наблюдаемые профили">
            {profiles.map((grant) => (
              <button
                key={grant.id}
                type="button"
                className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${selectedId === grant.learnerProfileId ? "border-sky-300 bg-sky-50" : "border-neutral-200 bg-white"}`}
                onClick={() => {
                  projectionGenerationRef.current += 1;
                  selectedIdRef.current = grant.learnerProfileId;
                  setSelectedId(grant.learnerProfileId);
                }}
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-neutral-100">
                  <UserRound className="h-4 w-4" aria-hidden="true" />
                </span>
                <span>
                  <strong className="block text-sm">
                    {grant.subjectLabel}
                  </strong>
                  <small className="text-neutral-500">
                    {grant.relationshipLabel || "Наблюдатель"}
                  </small>
                </span>
              </button>
            ))}
          </aside>
          <section className="min-w-0 space-y-4">
            {selectedGrant ? (
              <div className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-neutral-200 bg-white p-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Наблюдаемый профиль
                  </p>
                  <h2 className="mt-1 text-xl font-black">
                    {selectedGrant.subjectLabel}
                  </h2>
                  <p className="mt-1 text-sm text-neutral-600">
                    {selectedGrant.relationshipLabel || "Без подписи"}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => void leave()}
                >
                  Отказаться от доступа
                </Button>
              </div>
            ) : null}
            <WorkspaceTabs
              idBase={OBSERVING_PROJECTION_TABS_ID}
              ariaLabel="Данные наблюдаемого профиля"
              value={surface}
              onChange={setSurface}
              items={[
                { value: "progress", label: "Прогресс", icon: Eye },
                {
                  value: "history",
                  label: "История",
                  icon: History,
                  count: history.length,
                },
                {
                  value: "skills",
                  label: "Навыки",
                  icon: BookOpenCheck,
                  ...(activityProfile === null
                    ? {}
                    : { count: activityProfile.states.length }),
                },
                {
                  value: "recommendations",
                  label: "Рекомендации",
                  icon: Lightbulb,
                  ...(activityProfile === null
                    ? {}
                    : {
                        count: activityProfile.states.filter(
                          (state) => state.recommendation !== null,
                        ).length,
                      }),
                },
              ]}
            />
            {loadingProjection ? (
              <IdentityLoading>Загружаем доступные данные…</IdentityLoading>
            ) : null}
            <div
              id={workspaceTabPanelId(OBSERVING_PROJECTION_TABS_ID, "progress")}
              role="tabpanel"
              aria-labelledby={workspaceTabId(
                OBSERVING_PROJECTION_TABS_ID,
                "progress",
              )}
              hidden={surface !== "progress"}
              tabIndex={0}
            >
              {!loadingProjection && surface === "progress" && progress ? (
                <ProgressSummary progress={progress} />
              ) : null}
            </div>
            <div
              id={workspaceTabPanelId(OBSERVING_PROJECTION_TABS_ID, "history")}
              role="tabpanel"
              aria-labelledby={workspaceTabId(
                OBSERVING_PROJECTION_TABS_ID,
                "history",
              )}
              hidden={surface !== "history"}
              tabIndex={0}
            >
              {!loadingProjection && surface === "history" ? (
                <SafeHistoryList
                  items={history}
                  nextCursor={nextCursor}
                  loadingMore={busy}
                  onLoadMore={() => void loadMore()}
                />
              ) : null}
            </div>
            <div
              id={workspaceTabPanelId(OBSERVING_PROJECTION_TABS_ID, "skills")}
              role="tabpanel"
              aria-labelledby={workspaceTabId(
                OBSERVING_PROJECTION_TABS_ID,
                "skills",
              )}
              hidden={surface !== "skills"}
              tabIndex={0}
            >
              {!loadingProjection && surface === "skills" && activityError ? (
                <IdentityError
                  message={`Навыки временно недоступны: ${activityError}`}
                  onRetry={() => void retryActivityProfile()}
                />
              ) : null}
              {loadingActivityProfile && surface === "skills" ? (
                <IdentityLoading>Обновляем навыки…</IdentityLoading>
              ) : null}
              {!loadingProjection && surface === "skills" && activityProfile ? (
                <SafeActivityProfileSection
                  profile={activityProfile}
                  section="skills"
                />
              ) : null}
            </div>
            <div
              id={workspaceTabPanelId(
                OBSERVING_PROJECTION_TABS_ID,
                "recommendations",
              )}
              role="tabpanel"
              aria-labelledby={workspaceTabId(
                OBSERVING_PROJECTION_TABS_ID,
                "recommendations",
              )}
              hidden={surface !== "recommendations"}
              tabIndex={0}
            >
              {!loadingProjection &&
              surface === "recommendations" &&
              activityError ? (
                <IdentityError
                  message={`Рекомендации временно недоступны: ${activityError}`}
                  onRetry={() => void retryActivityProfile()}
                />
              ) : null}
              {loadingActivityProfile && surface === "recommendations" ? (
                <IdentityLoading>Обновляем рекомендации…</IdentityLoading>
              ) : null}
              {!loadingProjection &&
              surface === "recommendations" &&
              activityProfile ? (
                <SafeActivityProfileSection
                  profile={activityProfile}
                  section="recommendations"
                />
              ) : null}
            </div>
            {busy ? (
              <p
                className="flex items-center gap-2 text-sm text-neutral-600"
                role="status"
              >
                <LoaderCircle
                  className="h-4 w-4 animate-spin"
                  aria-hidden="true"
                />
                Обновляем доступ…
              </p>
            ) : null}
          </section>
        </div>
      ) : null}
    </div>
  );
}
