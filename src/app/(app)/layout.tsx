import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { ROUTES } from '@/lib/auth';
import { resolveAccessPolicy } from '@/lib/server/access-policy';

function readRequestPathname() {
  const headerStore = headers();
  const nextUrl = headerStore.get('next-url');
  if (nextUrl) {
    try {
      return new URL(nextUrl, 'http://localhost').pathname;
    } catch {
      return nextUrl;
    }
  }

  return null;
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const resolution = await resolveAccessPolicy();

  if (resolution.status === 'guest') {
    redirect(ROUTES.login);
  }

  if (resolution.status === 'degraded') {
    redirect(ROUTES.login);
  }

  const pathname = readRequestPathname();
  const isOnboardingRoute = pathname?.startsWith(ROUTES.onboarding) ?? false;

  if (resolution.status === 'adult-without-profile' && !isOnboardingRoute) {
    redirect(ROUTES.onboarding);
  }

  return children;
}
