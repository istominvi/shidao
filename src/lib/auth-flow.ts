'use client';

import {
  findParentByAuthUserId,
  findStudentAuthEmail,
  findStudentByAuthUserId,
  findTeacherByAuthUserId,
  type AuthSession
} from '@/lib/supabase-client';
import { isEmail, normalizeIdentifier } from '@/lib/auth';

export async function resolveCredentials(rawIdentifier: string): Promise<{ identifierType: 'account' | 'student'; email: string }> {
  const identifier = normalizeIdentifier(rawIdentifier);

  if (isEmail(identifier)) {
    return { identifierType: 'account', email: identifier };
  }

  const studentEmail = await findStudentAuthEmail(identifier);
  if (!studentEmail) {
    throw new Error('Пользователь с таким логином не найден.');
  }

  return { identifierType: 'student', email: studentEmail };
}

export async function resolvePostSignInRoute(session: AuthSession): Promise<string> {
  const student = await findStudentByAuthUserId(session.user.id, session.access_token);
  if (student?.id) {
    return '/dashboard/student';
  }

  const [teacher, parent] = await Promise.all([
    findTeacherByAuthUserId(session.user.id, session.access_token),
    findParentByAuthUserId(session.user.id, session.access_token)
  ]);

  if (teacher?.id && parent?.id) {
    return '/dashboard/select-profile';
  }

  if (teacher?.id) {
    return '/dashboard/teacher';
  }

  if (parent?.id) {
    return '/dashboard/parent';
  }

  return '/onboarding';
}
