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
  isNavigationPending: () => boolean;
  runUpdate: (direction: PageTransitionDirection, update: () => void) => void;
};

const PageTransitionContext = createContext<PageTransitionContextValue | null>(
  null,
);

const TRANSITION_TIMEOUT_MS = 1_600;
const FALLBACK_DURATION_MS = 420;
const READY_PAGE_HEADER_SELECTOR = ".app-page-header";

function reducedMotionRequested() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function setTransitionState(
  direction: PageTransitionDirection,
  fallbackPhase: false | "exit" | "enter",
) {
  document.documentElement.dataset.pageTransitionDirection = direction;
  if (fallbackPhase) {
    document.documentElement.dataset.pageTransitionFallback = fallbackPhase;
  } else {
    delete document.documentElement.dataset.pageTransitionFallback;
  }
}

function clearTransitionState() {
  const root = document.documentElement;
  delete root.dataset.pageTransitionDirection;
  delete root.dataset.pageTransitionFallback;
}

function readyPageHeaderExists() {
  return document.querySelector(READY_PAGE_HEADER_SELECTOR) !== null;
}

function observeReadyPageHeader(onReady: () => void) {
  if (readyPageHeaderExists()) {
    onReady();
    return null;
  }

  const observer = new MutationObserver(() => {
    if (!readyPageHeaderExists()) return;
    observer.disconnect();
    onReady();
  });
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });

  // Do not miss a header committed between the first query and observer setup.
  if (readyPageHeaderExists()) {
    observer.disconnect();
    onReady();
    return null;
  }

  return observer;
}

type PendingFallbackRoute = {
  direction: PageTransitionDirection;
  targetPathname: string;
  timeoutId: number;
  token: number;
  headerWaitStarted: boolean;
  headerObserver: MutationObserver | null;
};

type PendingNavigationIntent = {
  targetPathname: string;
};

type CancelTransitionOptions = {
  clearNavigationIntent?: boolean;
  preserveTransitionState?: boolean;
};

export function PageTransitionProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const pathnameRef = useRef(pathname);
  const activeTransitionRef = useRef<BrowserViewTransition | null>(null);
  const pendingFallbackRouteRef = useRef<PendingFallbackRoute | null>(null);
  const pendingNavigationIntentRef = useRef<PendingNavigationIntent | null>(
    null,
  );
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

  const cancelOngoingTransition = useCallback(
    (options: CancelTransitionOptions = {}) => {
      transitionTokenRef.current += 1;
      if (options.clearNavigationIntent !== false) {
        pendingNavigationIntentRef.current = null;
      }

      const pendingFallback = pendingFallbackRouteRef.current;
      if (pendingFallback) {
        window.clearTimeout(pendingFallback.timeoutId);
        pendingFallback.headerObserver?.disconnect();
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
      if (!options.preserveTransitionState) clearTransitionState();
    },
    [],
  );

  useLayoutEffect(() => {
    pathnameRef.current = pathname;
    if (pendingNavigationIntentRef.current?.targetPathname === pathname) {
      pendingNavigationIntentRef.current = null;
    }

    const pendingFallback = pendingFallbackRouteRef.current;
    if (pendingFallback?.targetPathname !== pathname) return;
    if (pendingFallback.headerWaitStarted) return;

    pendingFallback.headerWaitStarted = true;
    pendingFallback.headerObserver = observeReadyPageHeader(() => {
      if (pendingFallbackRouteRef.current !== pendingFallback) return;
      window.clearTimeout(pendingFallback.timeoutId);
      pendingFallbackRouteRef.current = null;
      if (transitionTokenRef.current !== pendingFallback.token) return;

      // The route chrome is committed at this point. Its async metric may
      // still be warming, but that must never delay the title or actions.
      setTransitionState(pendingFallback.direction, "enter");
      scheduleFallbackStateClear(pendingFallback.token);
    });
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
        cancelOngoingTransition({ clearNavigationIntent: false });
        update();
        return;
      }

      const transitionDocument = document as ViewTransitionDocument;
      if (!transitionDocument.startViewTransition) {
        cancelOngoingTransition({ clearNavigationIntent: false });
        const token = ++transitionTokenRef.current;
        flushSync(update);
        setTransitionState(direction, "enter");
        scheduleFallbackStateClear(token);
        return;
      }

      cancelOngoingTransition({ clearNavigationIntent: false });
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

      if (targetPathname === pathnameRef.current) {
        cancelOngoingTransition({ clearNavigationIntent: true });
        navigateNow();
        return;
      }

      const direction =
        options.direction ??
        resolvePageTransitionDirection(pathnameRef.current, targetPathname);
      const reducedMotion = reducedMotionRequested();
      const preserveFallbackExit =
        !reducedMotion &&
        pendingNavigationIntentRef.current !== null &&
        document.documentElement.dataset.pageTransitionFallback === "exit" &&
        document.documentElement.dataset.pageTransitionDirection === direction;

      cancelOngoingTransition({
        clearNavigationIntent: true,
        preserveTransitionState: preserveFallbackExit,
      });
      const token = ++transitionTokenRef.current;
      const navigationIntent: PendingNavigationIntent = { targetPathname };
      pendingNavigationIntentRef.current = navigationIntent;

      if (reducedMotion) {
        try {
          navigateNow();
        } catch (error) {
          if (pendingNavigationIntentRef.current === navigationIntent) {
            pendingNavigationIntentRef.current = null;
          }
          if (transitionTokenRef.current === token) {
            transitionTokenRef.current += 1;
          }
          throw error;
        }
        return;
      }

      if (!preserveFallbackExit) {
        setTransitionState(direction, "exit");
      }

      const timeoutId = window.setTimeout(() => {
        if (pendingFallbackRouteRef.current?.token !== token) return;
        pendingFallbackRouteRef.current.headerObserver?.disconnect();
        pendingFallbackRouteRef.current = null;
        clearStateForToken(token);
      }, TRANSITION_TIMEOUT_MS);
      pendingFallbackRouteRef.current = {
        direction,
        targetPathname,
        timeoutId,
        token,
        headerWaitStarted: false,
        headerObserver: null,
      };
      try {
        navigateNow();
      } catch (error) {
        window.clearTimeout(timeoutId);
        pendingFallbackRouteRef.current?.headerObserver?.disconnect();
        pendingFallbackRouteRef.current = null;
        if (pendingNavigationIntentRef.current === navigationIntent) {
          pendingNavigationIntentRef.current = null;
        }
        if (transitionTokenRef.current === token) {
          transitionTokenRef.current += 1;
        }
        throw error;
      }
      return;
    },
    [cancelOngoingTransition, clearStateForToken, router],
  );

  const isNavigationPending = useCallback(
    () => pendingNavigationIntentRef.current !== null,
    [],
  );

  const value = useMemo(
    () => ({ isNavigationPending, navigate, runUpdate }),
    [isNavigationPending, navigate, runUpdate],
  );

  return (
    <PageTransitionContext.Provider value={value}>
      {children}
    </PageTransitionContext.Provider>
  );
}

export function usePageTransition() {
  return useContext(PageTransitionContext);
}
