import { headers } from 'next/headers';

export async function readRequestPathname() {
  const headerStore = await headers();
  const nextUrl = headerStore.get('next-url');
  if (!nextUrl) return null;

  try {
    return new URL(nextUrl, 'http://localhost').pathname;
  } catch {
    return nextUrl;
  }
}
