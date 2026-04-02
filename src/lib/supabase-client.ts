'use client';

type Json = Record<string, unknown>;

export type AuthSession = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  user: { id: string; email?: string | null; user_metadata?: { full_name?: string } | null };
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

async function requestRpc<T>(fnName: string, payload: Json, accessToken: string): Promise<T> {
  const { url, anonKey } = getSupabaseConfig();
  const response = await fetch(`${url}/rest/v1/rpc/${fnName}`, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const payloadError = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(payloadError?.message ?? 'Ошибка при выполнении серверной функции.');
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

export async function findStudentAuthEmail(login: string) {
  const rows = await requestRest<Array<{ internal_auth_email: string | null; user_id: string | null }>>(
    `student?select=internal_auth_email,user_id&login=eq.${encodeURIComponent(login)}`
  );

  if (!rows[0]) return null;

  const fallbackEmail = rows[0].user_id ? `${rows[0].user_id}@students.local` : null;
  return rows[0].internal_auth_email ?? fallbackEmail;
}

export async function findParentByAuthUserId(authUserId: string, accessToken: string) {
  const rows = await requestRest<Array<{ id: string }>>(
    `parent?select=id&user_id=eq.${authUserId}`,
    'GET',
    undefined,
    accessToken
  );
  return rows[0] ?? null;
}

export async function findTeacherByAuthUserId(authUserId: string, accessToken: string) {
  const rows = await requestRest<Array<{ id: string }>>(
    `teacher?select=id&user_id=eq.${authUserId}`,
    'GET',
    undefined,
    accessToken
  );
  return rows[0] ?? null;
}

export async function findStudentByAuthUserId(authUserId: string, accessToken: string) {
  const rows = await requestRest<Array<{ id: string }>>(
    `student?select=id&user_id=eq.${authUserId}`,
    'GET',
    undefined,
    accessToken
  );
  return rows[0] ?? null;
}

export async function onboardParentProfile(authUserId: string, fullName: string, accessToken: string) {
  return requestRpc<string>('onboard_parent', { p_user_id: authUserId, p_full_name: fullName }, accessToken);
}

export async function onboardTeacherProfile(authUserId: string, fullName: string, accessToken: string) {
  return requestRpc<Array<{ teacher_id: string; school_id: string; class_id: string }>>(
    'onboard_teacher',
    { p_user_id: authUserId, p_full_name: fullName },
    accessToken
  );
}
