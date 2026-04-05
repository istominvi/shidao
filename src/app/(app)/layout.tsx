import { redirect } from 'next/navigation';
import { ROUTES } from '@/lib/auth';
import { resolveAccessPolicy } from '@/lib/server/access-policy';
import { readRequestPathname } from '@/lib/server/request-pathname';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const resolution = await resolveAccessPolicy();

  if (resolution.status === 'guest') {
    redirect(ROUTES.login);
  }

  if (resolution.status === 'degraded') {
    redirect(ROUTES.login);
  }

  const pathname = await readRequestPathname();
  const isOnboardingRoute = pathname?.startsWith(ROUTES.onboarding) ?? false;

  if (resolution.status === 'adult-without-profile' && !isOnboardingRoute) {
    redirect(ROUTES.onboarding);
  }

  return children;
}
