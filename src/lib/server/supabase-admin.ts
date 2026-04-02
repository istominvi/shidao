import { normalizeIdentifier, toStudentInternalAuthEmail } from '@/lib/auth';

type Json = Record<string, unknown>;

type SupabaseUser = { id: string; email?: string | null };

function getServerSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !anonKey || !serviceRoleKey) {
    throw new Error('Не настроены NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY.');
  }

  return { url, anonKey, serviceRoleKey };
}

async function request<T>(path: string, method = 'GET', options?: { payload?: Json; accessToken?: string; admin?: boolean }) {
  const { url, anonKey, serviceRoleKey } = getServerSupabaseConfig();
  const apiKey = options?.admin ? serviceRoleKey : anonKey;
  const bearer = options?.admin ? serviceRoleKey : options?.accessToken ?? anonKey;

  const response = await fetch(`${url}${path}`, {
    method,
    headers: {
      apikey: apiKey,
      Authorization: `Bearer ${bearer}`,
      'Content-Type': 'application/json',
      ...(method !== 'GET' ? { Prefer: 'return=representation' } : {})
    },
    body: options?.payload ? JSON.stringify(options.payload) : undefined
  });

  if (!response.ok) {
    const payloadError = (await response.json().catch(() => null)) as { message?: string; msg?: string } | null;
    throw new Error(payloadError?.message ?? payloadError?.msg ?? 'Ошибка запроса к Supabase.');
  }

  if (response.status === 204) {
    return null as T;
  }

  return (await response.json()) as T;
}

export async function getAuthUserFromAccessToken(accessToken: string) {
  return request<SupabaseUser>('/auth/v1/user', 'GET', { accessToken });
}

export async function findTeacherByAuthUserId(accessToken: string, authUserId: string) {
  const rows = await request<Array<{ id: string }>>(
    `/rest/v1/teacher?select=id&user_id=eq.${authUserId}`,
    'GET',
    { accessToken }
  );
  return rows[0] ?? null;
}

export async function assertTeacherAssignedToClass(accessToken: string, teacherId: string, classId: string) {
  const rows = await request<Array<{ id: string }>>(
    `/rest/v1/class_teacher?select=id&class_id=eq.${classId}&teacher_id=eq.${teacherId}`,
    'GET',
    { accessToken }
  );

  if (!rows[0]?.id) {
    throw new Error('Только преподаватель, назначенный в этот класс, может выполнять действие.');
  }
}

export async function createStudentAuthUser(input: { login: string; password: string; fullName?: string | null }) {
  const email = toStudentInternalAuthEmail(input.login);
  const payload = {
    email,
    password: input.password,
    email_confirm: true,
    user_metadata: {
      role: 'student',
      login: normalizeIdentifier(input.login),
      full_name: input.fullName ?? null
    }
  };

  const result = await request<{ id: string; email: string }>('/auth/v1/admin/users', 'POST', {
    payload,
    admin: true
  });

  return { userId: result.id, email: result.email };
}

export async function insertStudentRow(input: {
  userId: string;
  login: string;
  internalAuthEmail: string;
  fullName?: string | null;
  parentId?: string | null;
}) {
  const rows = await request<Array<{ id: string }>>('/rest/v1/student', 'POST', {
    admin: true,
    payload: {
      user_id: input.userId,
      login: normalizeIdentifier(input.login),
      internal_auth_email: input.internalAuthEmail,
      full_name: input.fullName ?? null,
      parent_id: input.parentId ?? null
    }
  });

  return rows[0]?.id;
}

export async function attachStudentToClassAsAdmin(input: { classId: string; studentId: string }) {
  const rows = await request<Array<{ class_id: string; student_id: string }>>('/rest/v1/class_student', 'POST', {
    admin: true,
    payload: {
      class_id: input.classId,
      student_id: input.studentId
    }
  });

  return rows[0] ?? null;
}
