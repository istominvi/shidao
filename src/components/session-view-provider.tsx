'use client';

import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { SessionViewContext } from '@/components/session-view-context';
import type { SessionView } from '@/lib/session-view';

type SessionViewProviderProps = {
  initialState: SessionView;
  children: ReactNode;
};

export function SessionViewProvider({ initialState, children }: SessionViewProviderProps) {
  const [state, setState] = useState<SessionView>(initialState);
  const [sessionResolved, setSessionResolved] = useState(true);

  const refetchSession = useCallback(async () => {
    setSessionResolved(false);

    try {
      const response = await fetch('/api/auth/session', { cache: 'no-store' });

      const payload = (await response.json().catch(() => null)) as SessionView | null;
      setState(payload ?? { kind: 'guest', authenticated: false });
    } catch {
      setState({ kind: 'guest', authenticated: false });
    } finally {
      setSessionResolved(true);
    }
  }, []);

  const value = useMemo(
    () => ({ state, sessionResolved, refetchSession }),
    [refetchSession, sessionResolved, state]
  );

  return <SessionViewContext.Provider value={value}>{children}</SessionViewContext.Provider>;
}
