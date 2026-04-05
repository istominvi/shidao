'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { ProfileKind } from '@/lib/auth';

export type SessionView = {
  authenticated: boolean;
  fullName?: string | null;
  email?: string | null;
  initials?: string;
  actorKind?: 'adult' | 'student';
  availableAdultProfiles?: ProfileKind[];
  activeProfile?: ProfileKind | null;
};

export function useSessionView() {
  const pathname = usePathname();
  const [sessionResolved, setSessionResolved] = useState(false);
  const [state, setState] = useState<SessionView>({ authenticated: false });

  useEffect(() => {
    const controller = new AbortController();

    setSessionResolved(false);
    fetch('/api/auth/session', {
      cache: 'no-store',
      signal: controller.signal
    })
      .then((r) => r.json())
      .then((payload: SessionView) => setState(payload))
      .catch(() => setState({ authenticated: false }))
      .finally(() => {
        if (!controller.signal.aborted) {
          setSessionResolved(true);
        }
      });

    return () => controller.abort();
  }, [pathname]);

  return { state, sessionResolved };
}
