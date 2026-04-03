import { NextResponse } from 'next/server';
import { readAppSession } from '@/lib/server/app-session';
import { getUserContextById } from '@/lib/server/supabase-admin';
import { toInitials } from '@/lib/auth';

export const runtime = 'nodejs';

export async function GET() {
  const session = await readAppSession();
  if (!session) {
    return NextResponse.json({ authenticated: false });
  }

  try {
    const ctx = await getUserContextById(session.uid);
    return NextResponse.json({
      authenticated: true,
      userId: ctx.userId,
      actorKind: ctx.actorKind,
      fullName: ctx.fullName,
      email: ctx.email,
      initials: toInitials(ctx.fullName, ctx.email),
      availableAdultProfiles: ctx.availableAdultProfiles,
      activeProfile: ctx.activeProfile,
      hasAnyAdultProfile: ctx.hasAnyAdultProfile,
      hasPin: ctx.hasPin
    });
  } catch (error) {
    console.error('[auth-session] failed to resolve user context', { userId: session.uid, error });
    return NextResponse.json({ authenticated: false }, { status: 503 });
  }
}
