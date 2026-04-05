'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { SessionView } from '@/lib/session-view';

type SessionViewContextValue = {
  state: SessionView;
  sessionResolved: boolean;
  refetchSession: () => Promise<void>;
};

const SessionViewContext = createContext<SessionViewContextValue | null>(null);

type SessionViewProviderProps = {
  initialState: SessionView;
  children: ReactNode;
};

export function SessionViewProvider({ initialState, children }: SessionViewProviderProps) {
  const [state, setState] = useState<SessionView>(initialState);
  const [sessionResolved, setSessionResolved] = useState(true);

  const refetchSession = useCallback(async () => {
    const controller = new AbortController();

    setSessionResolved(false);

    try {
      const response = await fetch('/api/auth/session', {
        cache: 'no-store',
        signal: controller.signal
      });

      const payload = (await response.json().catch(() => null)) as SessionView | null;
      setState(payload ?? { authenticated: false });
    } catch {
      setState({ authenticated: false });
    } finally {
      if (!controller.signal.aborted) {
        setSessionResolved(true);
      }
    }
  }, []);

  const value = useMemo(
    () => ({ state, sessionResolved, refetchSession }),
    [refetchSession, sessionResolved, state]
  );

  return <SessionViewContext.Provider value={value}>{children}</SessionViewContext.Provider>;
}

export function useSessionView() {
  const context = useContext(SessionViewContext);

  if (!context) {
    throw new Error('useSessionView must be used inside SessionViewProvider.');
  }

  return context;
}
