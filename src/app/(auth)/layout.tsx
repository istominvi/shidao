import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { ROUTES } from '@/lib/auth';
import { onAuthPageWhenAuthenticated } from '@/lib/auth-redirects';
import { resolveAccessPolicy } from '@/lib/server/access-policy';

async function readRequestPathname() {
  const headerStore = await headers();
  const nextUrl = headerStore.get('next-url');
  if (!nextUrl) return null;

  try {
    return new URL(nextUrl, 'http://localhost').pathname;
  } catch {
    return nextUrl;
  }
}

function isGuardedAuthPath(pathname: string | null) {
  return pathname === ROUTES.login || pathname === ROUTES.join;
}

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const pathname = await readRequestPathname();
  if (!isGuardedAuthPath(pathname)) {
    return children;
  }

  const resolution = await resolveAccessPolicy();
  const redirectTo = onAuthPageWhenAuthenticated(resolution);

  if (redirectTo) {
    redirect(redirectTo);
  }

  return children;
}
