"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import { flushSync } from "react-dom";
import {
  pageTransitionPathname,
  resolvePageTransitionDirection,
  type PageTransitionDirection,
} from "@/lib/navigation/page-transition";

type BrowserViewTransition = {
  finished: Promise<void>;
  skipTransition?: () => void;
};

type ViewTransitionDocument = Document & {
  startViewTransition?: (
    update: () => void | Promise<void>,
  ) => BrowserViewTransition;
};

type NavigateOptions = {
  direction?: PageTransitionDirection;
  replace?: boolean;
  scroll?: boolean;
};

type PageTransitionContextValue = {
  navigate: (href: string, options?: NavigateOptions) => void;
  runUpdate: (direction: PageTransitionDirection, update: () => void) => void;
};

const PageTransitionContext = createContext<PageTransitionContextValue | null>(
  null,
);

const TRANSITION_TIMEOUT_MS = 1_600;
const FALLBACK_DURATION_MS = 420;

function reducedMotionRequested() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function setTransitionState(
  direction: PageTransitionDirection,
  fallback: boolean,
) {
  document.documentElement.dataset.pageTransitionDirection = direction;
  if (fallback) {
    document.documentElement.dataset.pageTransitionFallback = "true";
  } else {
    delete document.documentElement.dataset.pageTransitionFallback;
  }
}

function clearTransitionState() {
  const root = document.documentElement;
  delete root.dataset.pageTransitionDirection;
  delete root.dataset.pageTransitionFallback;
}

type PendingRoute = {
  targetPathname: string;
  complete: () => void;
};

type PendingFallbackRoute = {
  direction: PageTransitionDirection;
  targetPathname: string;
  timeoutId: number;
  token: number;
};

export function PageTransitionProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const pathnameRef = useRef(pathname);
  const activeTransitionRef = useRef<BrowserViewTransition | null>(null);
  const pendingRouteRef = useRef<PendingRoute | null>(null);
  const pendingFallbackRouteRef = useRef<PendingFallbackRoute | null>(null);
  const fallbackClearTimerRef = useRef<number | null>(null);
  const transitionTokenRef = useRef(0);

  const clearStateForToken = useCallback((token: number) => {
    if (transitionTokenRef.current !== token) return;
    clearTransitionState();
  }, []);

  const scheduleFallbackStateClear = useCallback(
    (token: number) => {
      if (fallbackClearTimerRef.current !== null) {
        window.clearTimeout(fallbackClearTimerRef.current);
      }
      fallbackClearTimerRef.current = window.setTimeout(() => {
        fallbackClearTimerRef.current = null;
        clearStateForToken(token);
      }, FALLBACK_DURATION_MS);
    },
    [clearStateForToken],
  );

  const cancelOngoingTransition = useCallback(() => {
    transitionTokenRef.current += 1;

    pendingRouteRef.current?.complete();
    pendingRouteRef.current = null;

    const pendingFallback = pendingFallbackRouteRef.current;
    if (pendingFallback) {
      window.clearTimeout(pendingFallback.timeoutId);
      pendingFallbackRouteRef.current = null;
    }

    if (fallbackClearTimerRef.current !== null) {
      window.clearTimeout(fallbackClearTimerRef.current);
      fallbackClearTimerRef.current = null;
    }

    try {
      activeTransitionRef.current?.skipTransition?.();
    } catch {
      // A completed browser transition no longer needs to be skipped.
    }
    activeTransitionRef.current = null;
    clearTransitionState();
  }, []);

  useLayoutEffect(() => {
    pathnameRef.current = pathname;
    const pending = pendingRouteRef.current;
    if (pending?.targetPathname === pathname) {
      pendingRouteRef.current = null;
      pending.complete();
    }

    const pendingFallback = pendingFallbackRouteRef.current;
    if (pendingFallback?.targetPathname !== pathname) return;

    window.clearTimeout(pendingFallback.timeoutId);
    pendingFallbackRouteRef.current = null;
    if (transitionTokenRef.current !== pendingFallback.token) return;

    // The route DOM is committed at this point, so the fallback animation is
    // applied only to the incoming header. Applying it before router.push()
    // would incorrectly animate the outgoing header as an entrance.
    setTransitionState(pendingFallback.direction, true);
    scheduleFallbackStateClear(pendingFallback.token);
  }, [pathname, scheduleFallbackStateClear]);

  useLayoutEffect(
    () => () => {
      cancelOngoingTransition();
    },
    [cancelOngoingTransition],
  );

  const runUpdate = useCallback(
    (direction: PageTransitionDirection, update: () => void) => {
      if (reducedMotionRequested()) {
        cancelOngoingTransition();
        update();
        return;
      }

      const transitionDocument = document as ViewTransitionDocument;
      if (!transitionDocument.startViewTransition) {
        cancelOngoingTransition();
        const token = ++transitionTokenRef.current;
        flushSync(update);
        setTransitionState(direction, true);
        scheduleFallbackStateClear(token);
        return;
      }

      cancelOngoingTransition();
      const token = ++transitionTokenRef.current;
      setTransitionState(direction, false);
      let transition: BrowserViewTransition;
      let updateStarted = false;
      try {
        transition = transitionDocument.startViewTransition(() => {
          if (transitionTokenRef.current !== token) return;
          updateStarted = true;
          flushSync(update);
        });
      } catch {
        clearStateForToken(token);
        if (!updateStarted) update();
        return;
      }
      activeTransitionRef.current = transition;
      void transition.finished
        .catch(() => undefined)
        .finally(() => {
          if (
            activeTransitionRef.current !== transition ||
            transitionTokenRef.current !== token
          ) {
            return;
          }
          activeTransitionRef.current = null;
          clearStateForToken(token);
        });
    },
    [cancelOngoingTransition, clearStateForToken, scheduleFallbackStateClear],
  );

  const navigate = useCallback(
    (href: string, options: NavigateOptions = {}) => {
      const targetPathname = pageTransitionPathname(href);
      const navigateNow = () => {
        const routerOptions =
          options.scroll === undefined ? undefined : { scroll: options.scroll };
        if (options.replace) {
          router.replace(href, routerOptions);
        } else {
          router.push(href, routerOptions);
        }
      };

      if (targetPathname === pathnameRef.current || reducedMotionRequested()) {
        cancelOngoingTransition();
        navigateNow();
        return;
      }

      const direction =
        options.direction ??
        resolvePageTransitionDirection(pathnameRef.current, targetPathname);
      const transitionDocument = document as ViewTransitionDocument;

      if (!transitionDocument.startViewTransition) {
        cancelOngoingTransition();
        const token = ++transitionTokenRef.current;
        const timeoutId = window.setTimeout(() => {
          if (pendingFallbackRouteRef.current?.token !== token) return;
          pendingFallbackRouteRef.current = null;
        }, TRANSITION_TIMEOUT_MS);
        pendingFallbackRouteRef.current = {
          direction,
          targetPathname,
          timeoutId,
          token,
        };
        try {
          navigateNow();
        } catch (error) {
          window.clearTimeout(timeoutId);
          pendingFallbackRouteRef.current = null;
          if (transitionTokenRef.current === token) {
            transitionTokenRef.current += 1;
          }
          throw error;
        }
        return;
      }

      cancelOngoingTransition();
      const token = ++transitionTokenRef.current;
      let completeRoute!: () => void;
      let routeTimeoutId: number | null = null;
      const routeCommitted = new Promise<void>((resolve) => {
        let complete = false;
        completeRoute = () => {
          if (complete) return;
          complete = true;
          if (routeTimeoutId !== null) window.clearTimeout(routeTimeoutId);
          resolve();
        };
        routeTimeoutId = window.setTimeout(
          completeRoute,
          TRANSITION_TIMEOUT_MS,
        );
      });
      pendingRouteRef.current = { targetPathname, complete: completeRoute };
      setTransitionState(direction, false);

      let transition: BrowserViewTransition;
      let navigationStarted = false;
      try {
        transition = transitionDocument.startViewTransition(async () => {
          if (transitionTokenRef.current !== token) return;
          navigationStarted = true;
          navigateNow();
          await routeCommitted;
        });
      } catch {
        pendingRouteRef.current = null;
        completeRoute();
        clearStateForToken(token);
        if (!navigationStarted) navigateNow();
        return;
      }
      activeTransitionRef.current = transition;
      void transition.finished
        .catch(() => undefined)
        .finally(() => {
          if (pendingRouteRef.current?.complete === completeRoute) {
            pendingRouteRef.current = null;
          }
          completeRoute();
          if (
            activeTransitionRef.current !== transition ||
            transitionTokenRef.current !== token
          ) {
            return;
          }
          activeTransitionRef.current = null;
          clearStateForToken(token);
        });
    },
    [cancelOngoingTransition, clearStateForToken, router],
  );

  const value = useMemo(() => ({ navigate, runUpdate }), [navigate, runUpdate]);

  return (
    <PageTransitionContext.Provider value={value}>
      {children}
    </PageTransitionContext.Provider>
  );
}

export function usePageTransition() {
  return useContext(PageTransitionContext);
}
