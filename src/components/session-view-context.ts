import { createContext } from 'react';
import type { SessionView } from '@/lib/session-view';

export type SessionViewContextValue = {
  state: SessionView;
  sessionResolved: boolean;
  refetchSession: () => Promise<void>;
};

export const SessionViewContext = createContext<SessionViewContextValue | null>(null);
