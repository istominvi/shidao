import { isSafeRelativePath } from '@/lib/routes';

const DEFAULT_PUBLIC_SITE_URL = 'https://shidao.ru';

export function getSupabasePublicConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error('Supabase auth is not configured.');
  }

  return { url, anonKey };
}

export function getPublicSiteUrl() {
  const candidate =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    DEFAULT_PUBLIC_SITE_URL;

  return candidate.replace(/\/+$/, '');
}

export function resolveSafeAuthRedirect(input: string | null, fallback: string) {
  if (!isSafeRelativePath(input)) return fallback;
  return input;
}
