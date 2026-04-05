import { redirect } from 'next/navigation';
import { onAuthPageWhenAuthenticated } from '@/lib/auth-redirects';
import { isGuardedAuthRoute } from '@/lib/routes';
import { resolveAccessPolicy } from '@/lib/server/access-policy';
import { readRequestPathname } from '@/lib/server/request-pathname';

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const pathname = await readRequestPathname();
  if (!isGuardedAuthRoute(pathname)) {
    return children;
  }

  const resolution = await resolveAccessPolicy();
  const redirectTo = onAuthPageWhenAuthenticated(resolution);

  if (redirectTo) {
    redirect(redirectTo);
  }

  return children;
}
