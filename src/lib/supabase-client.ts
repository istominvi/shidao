'use client';

type Json = Record<string, unknown>;

export type AuthSession = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  user: { id: string; email?: string | null };
};

const STORAGE_KEY = 'shidao.auth.session';

function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error('Не настроены NEXT_PUBLIC_SUPABASE_URL и NEXT_PUBLIC_SUPABASE_ANON_KEY.');
  }

  return { url, anonKey };
}

async function requestAuth<T>(path: string, method: string, body?: Json, accessToken?: string): Promise<T> {
  const { url, anonKey } = getSupabaseConfig();
  const response = await fetch(`${url}/auth/v1/${path}`, {
    method,
    headers: {
      apikey: anonKey,
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { msg?: string; message?: string } | null;
    throw new Error(payload?.msg ?? payload?.message ?? 'Ошибка Supabase Auth.');
  }

  return (await response.json()) as T;
}

async function requestRest<T>(path: string, method = 'GET', payload?: Json, accessToken?: string): Promise<T> {
  const { url, anonKey } = getSupabaseConfig();
  const response = await fetch(`${url}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${accessToken ?? anonKey}`,
      'Content-Type': 'application/json',
      ...(method !== 'GET' ? { Prefer: 'return=representation' } : {})
    },
    body: payload ? JSON.stringify(payload) : undefined
  });

  if (!response.ok) {
    const payloadError = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(payloadError?.message ?? 'Ошибка при запросе к данным.');
  }

  return (await response.json()) as T;
}

export function saveSession(session: AuthSession) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function getSession() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthSession;
  } catch {
    return null;
  }
}

export function clearSession() {
  localStorage.removeItem(STORAGE_KEY);
}

export async function signInWithPassword(email: string, password: string) {
  const session = await requestAuth<AuthSession>('token?grant_type=password', 'POST', { email, password });
  saveSession(session);
  return session;
}

export async function signUpWithPassword(email: string, password: string, fullName: string) {
  return requestAuth<{ id: string; email: string }>('signup', 'POST', {
    email,
    password,
    data: { full_name: fullName }
  });
}

export async function signOut() {
  const session = getSession();
  if (session?.access_token) {
    await requestAuth('logout', 'POST', undefined, session.access_token).catch(() => undefined);
  }
  clearSession();
}

export async function getCurrentUser(accessToken: string) {
  return requestAuth<{ id: string; email?: string | null }>('user', 'GET', undefined, accessToken);
}

export async function findStudentAuthEmail(loginIdentifier: string) {
  const rows = await requestRest<Array<{ auth_login_email: string | null }>>(
    `student?select=auth_login_email&login_identifier=eq.${encodeURIComponent(loginIdentifier)}`
  );
  return rows[0]?.auth_login_email ?? null;
}

export async function findAdultByAuthUserId(authUserId: string, accessToken: string) {
  const rows = await requestRest<Array<{ id: string; current_role: 'parent' | 'teacher' | null }>>(
    `adult?select=id,current_role&auth_user_id=eq.${authUserId}`,
    'GET',
    undefined,
    accessToken
  );
  return rows[0] ?? null;
}

export async function findAdultRoles(adultId: string, accessToken: string) {
  return requestRest<Array<{ role: 'parent' | 'teacher' }>>(
    `adult_role?select=role&adult_id=eq.${adultId}&role=in.(parent,teacher)`,
    'GET',
    undefined,
    accessToken
  );
}

export async function updateAdultCurrentRole(adultId: string, role: 'parent' | 'teacher', accessToken: string) {
  await requestRest(
    `adult?id=eq.${adultId}`,
    'PATCH',
    { current_role: role },
    accessToken
  );
}

export async function ensureAdultRole(adultId: string, role: 'parent' | 'teacher', accessToken: string) {
  const rows = await requestRest<Array<{ id: string }>>(
    `adult_role?select=id&adult_id=eq.${adultId}&role=eq.${role}&school_id=is.null`,
    'GET',
    undefined,
    accessToken
  );

  if (rows.length > 0) return;

  await requestRest(
    'adult_role',
    'POST',
    { adult_id: adultId, role, school_id: null },
    accessToken
  );
}

export async function findStudentByAuthUserId(authUserId: string, accessToken: string) {
  const rows = await requestRest<Array<{ id: string }>>(
    `student?select=id&auth_user_id=eq.${authUserId}`,
    'GET',
    undefined,
    accessToken
  );
  return rows[0] ?? null;
}

export async function createAdultProfile(input: {
  authUserId: string;
  fullName: string;
  email: string;
}) {
  await requestRest('adult', 'POST', {
    auth_user_id: input.authUserId,
    full_name: input.fullName,
    email: input.email,
    current_role: null
  });
}
