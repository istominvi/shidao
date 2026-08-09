"use client";

import { Eye, History, LoaderCircle, UserRound } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { AppPageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { WorkspaceTabs } from "@/components/ui/workspace-tabs";
import type {
  LearnerProgress,
  LearnerSafeHistoryItem,
  ObserverGrant,
} from "@/modules/learner-identity/domain";
import {
  actOnObserver,
  loadObservedHistory,
  loadObservedProfiles,
  loadObservedProgress,
} from "./identity-client";
import { IdentityEmpty, IdentityError, IdentityLoading } from "./identity-ui";
import { ProgressSummary } from "./progress-summary";
import { SafeHistoryList } from "./safe-history-list";

type Surface = "progress" | "history";

type ObservingWorkspaceProps = {
  embedded?: boolean;
};

export function ObservingWorkspace({
  embedded = false,
}: ObservingWorkspaceProps) {
  const [profiles, setProfiles] = useState<ObserverGrant[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [surface, setSurface] = useState<Surface>("progress");
  const [progress, setProgress] = useState<LearnerProgress | null>(null);
  const [history, setHistory] = useState<LearnerSafeHistoryItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loadingProjection, setLoadingProjection] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    if (!selectedId) {
      setProgress(null);
      setHistory([]);
      setNextCursor(null);
      return;
    }
    let active = true;
    setLoadingProjection(true);
    setError(null);
    void Promise.all([
      loadObservedProgress(selectedId),
      loadObservedHistory(selectedId),
    ])
      .then(([nextProgress, page]) => {
        if (!active) return;
        setProgress(nextProgress);
        setHistory(page.items);
        setNextCursor(page.nextCursor);
      })
      .catch((caught) => {
        if (active)
          setError(
            caught instanceof Error
              ? caught.message
              : "Доступ к профилю больше недоступен.",
          );
      })
      .finally(() => {
        if (active) setLoadingProjection(false);
      });
    return () => {
      active = false;
    };
  }, [selectedId]);

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
    setBusy(true);
    setError(null);
    try {
      await actOnObserver(selectedGrant.id, "leave");
      await loadProfiles();
    } catch (caught) {
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
    setBusy(true);
    try {
      const page = await loadObservedHistory(selectedId, nextCursor);
      setHistory((current) => [...current, ...page.items]);
      setNextCursor(page.nextCursor);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Не удалось продолжить историю.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {!embedded ? (
        <AppPageHeader
          title="Наблюдение"
          description="История людей, которые явно дали вам доступ, доступна только для чтения. Наблюдатель не может менять учебные данные."
        />
      ) : null}
      {error ? (
        <IdentityError message={error} onRetry={() => void loadProfiles()} />
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
                onClick={() => setSelectedId(grant.learnerProfileId)}
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
              idBase="observing-projection"
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
              ]}
            />
            {loadingProjection ? (
              <IdentityLoading>Загружаем доступные данные…</IdentityLoading>
            ) : null}
            {!loadingProjection && surface === "progress" && progress ? (
              <ProgressSummary progress={progress} />
            ) : null}
            {!loadingProjection && surface === "history" ? (
              <SafeHistoryList
                items={history}
                nextCursor={nextCursor}
                loadingMore={busy}
                onLoadMore={() => void loadMore()}
              />
            ) : null}
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
