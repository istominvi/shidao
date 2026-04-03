'use client';

type Json = Record<string, unknown>;

function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error('Не настроены NEXT_PUBLIC_SUPABASE_URL и NEXT_PUBLIC_SUPABASE_ANON_KEY.');
  }

  return { url, anonKey };
}

async function requestAuth<T>(path: string, method: string, body?: Json): Promise<T> {
  const { url, anonKey } = getSupabaseConfig();
  const response = await fetch(`${url}/auth/v1/${path}`, {
    method,
    headers: {
      apikey: anonKey,
      'Content-Type': 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { msg?: string; message?: string } | null;
    throw new Error(payload?.msg ?? payload?.message ?? 'Ошибка Supabase Auth.');
  }

  return (await response.json()) as T;
}

export async function signUpWithPassword(email: string, password: string, fullName: string) {
  return requestAuth<{ id: string; email: string }>('signup', 'POST', {
    email,
    password,
    data: { full_name: fullName }
  });
}

export async function createStudentForClass(input: {
  classId: string;
  login: string;
  password: string;
  fullName?: string | null;
  parentId?: string | null;
}) {
  const response = await fetch('/api/teacher/students', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
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

export async function attachExistingStudentToClass(input: { classId: string; studentId: string }) {
  const response = await fetch('/api/teacher/class-students', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ classId: input.classId, studentId: input.studentId })
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error ?? 'Не удалось привязать ученика к классу.');
  }

  return (await response.json()) as { classId: string; studentId: string };
}
