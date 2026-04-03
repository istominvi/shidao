'use client';

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
