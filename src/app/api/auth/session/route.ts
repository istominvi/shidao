import { NextResponse } from 'next/server';
import { readSessionViewServer } from '@/lib/server/session-view';

export const runtime = 'nodejs';

export async function GET() {
  const sessionView = await readSessionViewServer();
  const status = sessionView.authenticated ? (sessionView.contextResolved === false ? 503 : 200) : 401;

  return NextResponse.json(sessionView, { status });
}
