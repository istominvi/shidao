import { normalizeIdentifier, toStudentInternalAuthEmail, type ProfileKind } from '@/lib/auth';

type Json = Record<string, unknown>;

type SupabaseUser = { id: string; email?: string | null; user_metadata?: { full_name?: string | null } | null };

type AuthSession = {
  access_token: string;
  refresh_token: string;
  user: SupabaseUser;
};

function getServerSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !anonKey || !serviceRoleKey) {
    throw new Error('Не настроены NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY.');
  }

  return { url, anonKey, serviceRoleKey };
}

async function request<T>(path: string, method = 'GET', options?: { payload?: Json; accessToken?: string; admin?: boolean; allowEmpty?: boolean }) {
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
    body: options?.payload ? JSON.stringify(options.payload) : undefined,
    cache: 'no-store'
  });

  if (!response.ok) {
    const payloadError = (await response.json().catch(() => null)) as { message?: string; msg?: string } | null;
    throw new Error(payloadError?.message ?? payloadError?.msg ?? 'Ошибка запроса к Supabase.');
  }

  if (response.status === 204) {
    return null as T;
  }

  const text = await response.text();
  if (!text) {
    if (options?.allowEmpty) return null as T;
    throw new Error('Пустой ответ Supabase.');
  }

  return JSON.parse(text) as T;
}

async function authPasswordSignIn(email: string, password: string) {
  const { url, anonKey } = getServerSupabaseConfig();
  const response = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ email, password }),
    cache: 'no-store'
  });

  if (!response.ok) return null;

  return (await response.json()) as AuthSession;
}

export async function trySignInWithPassword(email: string, password: string) {
  return authPasswordSignIn(email, password);
}

export async function findStudentAuthEmail(login: string) {
  const rows = await request<Array<{ internal_auth_email: string | null; user_id: string | null }>>(
    `/rest/v1/student?select=internal_auth_email,user_id&login=eq.${encodeURIComponent(normalizeIdentifier(login))}`,
    'GET',
    { admin: true }
  );

  if (!rows[0]?.internal_auth_email || !rows[0]?.user_id) {
    return null;
  }

  return { email: rows[0].internal_auth_email, userId: rows[0].user_id };
}

export async function verifyUserPin(userId: string, rawPin: string) {
  const result = await request<boolean>('/rest/v1/rpc/verify_user_pin', 'POST', {
    admin: true,
    payload: {
      p_user_id: userId,
      p_raw_pin: rawPin
    }
  });

  return Boolean(result);
}

export async function setUserPin(userId: string, rawPin: string) {
  await request('/rest/v1/rpc/set_user_pin', 'POST', {
    admin: true,
    payload: {
      p_user_id: userId,
      p_raw_pin: rawPin
    }
  });
}

export async function hasUserPin(userId: string) {
  const rows = await request<Array<{ pin_hash: string | null }>>(`/rest/v1/user_security?select=pin_hash&user_id=eq.${userId}&limit=1`, 'GET', {
    admin: true
  });
  return Boolean(rows[0]?.pin_hash);
}

export async function ensureUserPreference(userId: string) {
  await request('/rest/v1/rpc/ensure_user_preference', 'POST', {
    admin: true,
    payload: { p_user_id: userId }
  });
}

export async function setLastActiveProfile(userId: string, profile: ProfileKind) {
  await request('/rest/v1/rpc/set_last_active_profile', 'POST', {
    admin: true,
    payload: { p_user_id: userId, p_profile: profile }
  });
}

export async function getUserContextById(userId: string) {
  const [parentRows, teacherRows, studentRows, prefRows, securityRows, authUser] = await Promise.all([
    request<Array<{ id: string; full_name: string | null }>>(`/rest/v1/parent?select=id,full_name&user_id=eq.${userId}&limit=1`, 'GET', { admin: true }),
    request<Array<{ id: string; full_name: string | null }>>(`/rest/v1/teacher?select=id,full_name&user_id=eq.${userId}&limit=1`, 'GET', { admin: true }),
    request<Array<{ id: string; login: string; full_name: string | null }>>(`/rest/v1/student?select=id,login,full_name&user_id=eq.${userId}&limit=1`, 'GET', { admin: true }),
    request<Array<{ last_active_profile: ProfileKind | null; last_selected_school_id: string | null; theme: string | null; settings: Record<string, unknown> }>>(`/rest/v1/user_preference?select=last_active_profile,last_selected_school_id,theme,settings&user_id=eq.${userId}&limit=1`, 'GET', { admin: true }),
    request<Array<{ pin_hash: string | null }>>(`/rest/v1/user_security?select=pin_hash&user_id=eq.${userId}&limit=1`, 'GET', { admin: true }),
    request<{ user: SupabaseUser }>(`/auth/v1/admin/users/${userId}`, 'GET', { admin: true })
  ]);

  const student = studentRows[0] ?? null;
  const teacher = teacherRows[0] ?? null;
  const parent = parentRows[0] ?? null;
  const pref = prefRows[0] ?? null;
  const profileChoices = [teacher ? 'teacher' : null, parent ? 'parent' : null].filter(Boolean) as ProfileKind[];

  let activeProfile: ProfileKind | null = null;
  if (profileChoices.length === 1) {
    activeProfile = profileChoices[0];
  } else if (profileChoices.length === 2) {
    activeProfile = pref?.last_active_profile && profileChoices.includes(pref.last_active_profile) ? pref.last_active_profile : 'parent';
  }

  return {
    userId,
    email: authUser.user.email ?? null,
    fullName: authUser.user.user_metadata?.full_name ?? parent?.full_name ?? teacher?.full_name ?? student?.full_name ?? null,
    actorKind: student ? ('student' as const) : ('adult' as const),
    student,
    teacher,
    parent,
    preferences: pref,
    activeProfile,
    availableAdultProfiles: profileChoices,
    hasAnyAdultProfile: Boolean(parent || teacher),
    hasPin: Boolean(securityRows[0]?.pin_hash)
  };
}

export async function upsertParentProfile(userId: string, fullName: string | null) {
  return request<string>('/rest/v1/rpc/onboard_parent', 'POST', {
    admin: true,
    payload: { p_user_id: userId, p_full_name: fullName }
  });
}

export async function upsertTeacherProfile(userId: string, fullName: string | null) {
  return request<Array<{ teacher_id: string; school_id: string; class_id: string }>>('/rest/v1/rpc/onboard_teacher', 'POST', {
    admin: true,
    payload: { p_user_id: userId, p_full_name: fullName }
  });
}

export async function loadParentLearningContextsByUser(userId: string) {
  const parentRows = await request<Array<{ id: string }>>(`/rest/v1/parent?select=id&user_id=eq.${userId}&limit=1`, 'GET', {
    admin: true
  });
  const parentId = parentRows[0]?.id;
  if (!parentId) return [];

  const rows = await request<
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
    `/rest/v1/student?select=id,full_name,login,class_student(class:class_id(id,name,school:school_id(id,name)))&parent_id=eq.${parentId}&order=created_at.asc`,
    'GET',
    { admin: true }
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

// Existing teacher admin helpers
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

export async function assertTeacherAssignedToClassAdmin(teacherId: string, classId: string) {
  const rows = await request<Array<{ id: string }>>(
    `/rest/v1/class_teacher?select=id&class_id=eq.${classId}&teacher_id=eq.${teacherId}`,
    'GET',
    { admin: true }
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
