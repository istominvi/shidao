import { NextResponse } from 'next/server';
import { readSessionViewServer } from '@/lib/server/session-view';

export const runtime = 'nodejs';

export async function GET() {
  const sessionView = await readSessionViewServer();
  const status = (() => {
    switch (sessionView.kind) {
      case 'guest':
        return 401;
      case 'degraded':
        return 503;
      case 'student':
      case 'adult':
        return 200;
      default: {
        const _exhaustive: never = sessionView;
        return _exhaustive;
      }
    }
  })();

  return NextResponse.json(sessionView, { status });
}
