"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useSessionView } from "@/components/use-session-view";
import { ROUTES } from "@/lib/auth";
import {
  canCommitPrimaryHeaderSummaryRequest,
  currentPrimaryHeaderScheduleRange,
  primaryHeaderSummarySchema,
  PRIMARY_HEADER_SUMMARY_TTL_MS,
  type PrimaryHeaderSummary,
} from "@/lib/navigation/primary-header-summary";
import type { SessionView } from "@/lib/session-view";

type PrimaryHeaderSummaryContextValue = {
  summary: PrimaryHeaderSummary | null;
  pending: boolean;
  refreshing: boolean;
  error: string | null;
  refresh: () => void;
  invalidate: () => void;
};

type SummaryOwner = {
  accountKey: string;
  session: SessionView;
};

type SummaryViewState = {
  summary: PrimaryHeaderSummary | null;
  loading: boolean;
  error: string | null;
  owner: SummaryOwner | null;
};

const EMPTY_STATE: SummaryViewState = {
  summary: null,
  loading: false,
  error: null,
  owner: null,
};

const PRIMARY_APP_ROUTES = [
  ROUTES.schedule,
  ROUTES.students,
  ROUTES.courses,
  ROUTES.store,
  ROUTES.profile,
] as const;

const PrimaryHeaderSummaryContext =
  createContext<PrimaryHeaderSummaryContextValue | null>(null);

function summaryErrorMessage(payload: unknown) {
  if (
    payload &&
    typeof payload === "object" &&
    "error" in payload &&
    typeof payload.error === "string"
  ) {
    return payload.error;
  }
  return "Не удалось обновить метрики разделов.";
}

function sameOwner(
  owner: SummaryOwner | null,
  accountKey: string,
  session: SessionView,
) {
  return owner?.accountKey === accountKey && owner.session === session;
}

export function PrimaryHeaderSummaryProvider({
  accountKey,
  children,
}: {
  accountKey: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { state: session, refetchSession } = useSessionView();
  const [viewState, setViewState] = useState<SummaryViewState>(EMPTY_STATE);
  const mountedRef = useRef(false);
  const accountActiveRef = useRef(session.kind === "account");
  const sessionRef = useRef(session);
  const accountKeyRef = useRef(accountKey);
  const generationRef = useRef(0);
  const unauthorizedRef = useRef(false);
  const mismatchedOwnerKeyRef = useRef<string | null>(null);
  const summaryRef = useRef<PrimaryHeaderSummary | null>(null);
  const loadedAtRef = useRef(0);
  const inFlightRef = useRef<Promise<void> | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const refreshAfterFlightRef = useRef(false);
  const requestRef = useRef<(force?: boolean) => void>(() => undefined);

  // These render-time mirrors close the window before the identity effect:
  // a response for the previous SessionView can never commit after a switch.
  accountActiveRef.current = session.kind === "account";
  sessionRef.current = session;
  accountKeyRef.current = accountKey;

  const clearSummaryCache = useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    inFlightRef.current = null;
    refreshAfterFlightRef.current = false;
    summaryRef.current = null;
    loadedAtRef.current = 0;
    if (mountedRef.current) setViewState(EMPTY_STATE);
  }, []);

  const lockAndRefreshSession = useCallback(
    (nextOwnerKey: string | null) => {
      generationRef.current += 1;
      unauthorizedRef.current = true;
      mismatchedOwnerKeyRef.current = nextOwnerKey;
      clearSummaryCache();
      void refetchSession().finally(() => router.refresh());
    },
    [clearSummaryCache, refetchSession, router],
  );

  const requestSummary = useCallback(
    (force = false) => {
      if (!accountActiveRef.current || unauthorizedRef.current) return;

      if (inFlightRef.current) {
        if (force) refreshAfterFlightRef.current = true;
        return;
      }

      if (
        !force &&
        summaryRef.current &&
        Date.now() - loadedAtRef.current < PRIMARY_HEADER_SUMMARY_TTL_MS
      ) {
        return;
      }

      const controller = new AbortController();
      const requestGeneration = generationRef.current;
      const requestOwner: SummaryOwner = {
        accountKey: accountKeyRef.current,
        session: sessionRef.current,
      };
      const canCommit = () =>
        canCommitPrimaryHeaderSummaryRequest({
          requestGeneration,
          currentGeneration: generationRef.current,
          accountActive:
            accountActiveRef.current &&
            accountKeyRef.current === requestOwner.accountKey &&
            sessionRef.current === requestOwner.session,
          unauthorized: unauthorizedRef.current,
        });

      controllerRef.current = controller;
      if (mountedRef.current) {
        setViewState((current) => ({
          summary: sameOwner(current.owner, accountKey, session)
            ? current.summary
            : null,
          loading: true,
          error: null,
          owner: requestOwner,
        }));
      }

      const range = currentPrimaryHeaderScheduleRange();
      const query = new URLSearchParams(range);
      const request = fetch(`/api/v2/app-header-summary?${query.toString()}`, {
        cache: "no-store",
        credentials: "same-origin",
        signal: controller.signal,
      })
        .then(async (response) => {
          if (response.status === 401) {
            if (canCommit()) lockAndRefreshSession(null);
            return;
          }

          const payload = (await response.json().catch(() => null)) as unknown;
          if (!response.ok) throw new Error(summaryErrorMessage(payload));
          const parsed = primaryHeaderSummarySchema.safeParse(payload);
          if (!parsed.success) {
            throw new Error("Сервис вернул некорректные метрики разделов.");
          }
          if (controller.signal.aborted || !canCommit()) return;
          if (parsed.data.ownerKey !== requestOwner.accountKey) {
            lockAndRefreshSession(parsed.data.ownerKey);
            return;
          }

          summaryRef.current = parsed.data;
          loadedAtRef.current = Date.now();
          if (mountedRef.current) {
            setViewState({
              summary: parsed.data,
              loading: false,
              error: null,
              owner: requestOwner,
            });
          }
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted || !canCommit()) return;
          if (mountedRef.current) {
            setViewState((current) =>
              sameOwner(
                current.owner,
                requestOwner.accountKey,
                requestOwner.session,
              )
                ? {
                    ...current,
                    loading: false,
                    error:
                      error instanceof Error
                        ? error.message
                        : "Не удалось обновить метрики разделов.",
                  }
                : current,
            );
          }
        })
        .finally(() => {
          if (inFlightRef.current !== request) return;
          inFlightRef.current = null;
          if (controllerRef.current === controller)
            controllerRef.current = null;
          if (!refreshAfterFlightRef.current || !canCommit()) return;
          refreshAfterFlightRef.current = false;
          requestRef.current(true);
        });

      inFlightRef.current = request;
    },
    [accountKey, lockAndRefreshSession, session],
  );

  requestRef.current = requestSummary;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      generationRef.current += 1;
      controllerRef.current?.abort();
      controllerRef.current = null;
      inFlightRef.current = null;
      refreshAfterFlightRef.current = false;
    };
  }, []);

  useEffect(() => {
    generationRef.current += 1;
    clearSummaryCache();

    // A client-only SessionView change is not sufficient after a cross-tab
    // Account switch: wait for router.refresh() to replace the server key.
    if (
      mismatchedOwnerKeyRef.current &&
      mismatchedOwnerKeyRef.current !== accountKey
    ) {
      return;
    }
    mismatchedOwnerKeyRef.current = null;
    unauthorizedRef.current = false;
    if (session.kind !== "account") return;
    for (const href of PRIMARY_APP_ROUTES) router.prefetch(href);
    requestSummary();
  }, [accountKey, clearSummaryCache, requestSummary, router, session]);

  useEffect(() => {
    if (session.kind !== "account") return;
    requestSummary();
  }, [pathname, requestSummary, session.kind]);

  useEffect(() => {
    if (session.kind !== "account") return;
    const handleFocus = () => requestSummary();
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [requestSummary, session.kind]);

  const refresh = useCallback(() => requestSummary(true), [requestSummary]);
  const invalidate = useCallback(() => {
    loadedAtRef.current = 0;
    requestSummary(true);
  }, [requestSummary]);

  const visibleState = sameOwner(viewState.owner, accountKey, session)
    ? viewState
    : EMPTY_STATE;
  const value = useMemo<PrimaryHeaderSummaryContextValue>(
    () => ({
      summary: visibleState.summary,
      pending: visibleState.summary === null && visibleState.loading,
      refreshing: visibleState.summary !== null && visibleState.loading,
      error: visibleState.error,
      refresh,
      invalidate,
    }),
    [invalidate, refresh, visibleState],
  );

  return (
    <PrimaryHeaderSummaryContext.Provider value={value}>
      {children}
    </PrimaryHeaderSummaryContext.Provider>
  );
}

export function usePrimaryHeaderSummary() {
  const context = useContext(PrimaryHeaderSummaryContext);
  if (!context) {
    throw new Error(
      "usePrimaryHeaderSummary must be used within PrimaryHeaderSummaryProvider.",
    );
  }
  return context;
}
