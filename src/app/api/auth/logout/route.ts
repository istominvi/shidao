import { NextResponse } from 'next/server';
import { clearAppSession } from '@/lib/server/app-session';

export const runtime = 'nodejs';

export async function POST() {
  await clearAppSession();
  return NextResponse.json({ ok: true });
}
