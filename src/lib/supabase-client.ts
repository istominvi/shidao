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
  const rows = await requestRest<Array<{ internal_auth_email: string | null }>>(
    `student?select=internal_auth_email&login=eq.${encodeURIComponent(login)}`
  );

  if (!rows[0]?.internal_auth_email) return null;

  return rows[0].internal_auth_email;
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


export type ParentStudentLearningContext = {
  studentId: string;
  studentName: string;
  login: string;
  classes: Array<{
    classId: string;
    className: string;
    schoolId: string;
    schoolName: string;
  }>;
};

export async function loadParentLearningContexts(accessToken: string) {
  const rows = await requestRest<
    Array<{
      id: string;
      full_name: string | null;
      login: string;
      class_student: Array<{
        class: {
          id: string;
          name: string;
          school: { id: string; name: string } | null;
        } | null;
      }> | null;
    }>
  >(
    'student?select=id,full_name,login,class_student(class:class_id(id,name,school:school_id(id,name)))&order=created_at.asc',
    'GET',
    undefined,
    accessToken
  );

  return rows.map((student) => ({
    studentId: student.id,
    studentName: student.full_name ?? student.login,
    login: student.login,
    classes: (student.class_student ?? [])
      .map((membership) => membership.class)
      .filter((cls): cls is { id: string; name: string; school: { id: string; name: string } | null } => Boolean(cls))
      .map((cls) => ({
        classId: cls.id,
        className: cls.name,
        schoolId: cls.school?.id ?? '',
        schoolName: cls.school?.name ?? 'Школа не указана'
      }))
  }));
}

export async function createStudentForClass(input: {
  accessToken: string;
  classId: string;
  login: string;
  password: string;
  fullName?: string | null;
  parentId?: string | null;
}) {
  const response = await fetch('/api/teacher/students', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${input.accessToken}`
    },
    body: JSON.stringify({
      classId: input.classId,
      login: input.login,
      password: input.password,
      fullName: input.fullName ?? null,
      parentId: input.parentId ?? null
    })
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error ?? 'Не удалось создать ученика.');
  }

  return (await response.json()) as { studentId: string; userId: string };
}

export async function attachExistingStudentToClass(input: { accessToken: string; classId: string; studentId: string }) {
  const response = await fetch('/api/teacher/class-students', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${input.accessToken}`
    },
    body: JSON.stringify({ classId: input.classId, studentId: input.studentId })
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error ?? 'Не удалось привязать ученика к классу.');
  }

  return (await response.json()) as { classId: string; studentId: string };
}
