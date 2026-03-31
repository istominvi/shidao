'use client';

import {
  findAdultByAuthUserId,
  findAdultRoles,
  findStudentAuthEmail,
  findStudentByAuthUserId,
  updateAdultCurrentRole,
  type AuthSession
} from '@/lib/supabase-client';
import { isEmail, normalizeIdentifier, type AdultRole } from '@/lib/auth';

export async function resolveCredentials(rawIdentifier: string): Promise<{ identifierType: 'adult' | 'student'; email: string }> {
  const identifier = normalizeIdentifier(rawIdentifier);

  if (isEmail(identifier)) {
    return { identifierType: 'adult', email: identifier };
  }

  const studentEmail = await findStudentAuthEmail(identifier);
  if (!studentEmail) {
    throw new Error('Пользователь с таким логином не найден.');
  }

  return { identifierType: 'student', email: studentEmail };
}

export async function resolvePostSignInRoute(session: AuthSession): Promise<string> {
  const adult = await findAdultByAuthUserId(session.user.id, session.access_token);

  if (adult?.id) {
    const roles = await findAdultRoles(adult.id, session.access_token);
    const roleList = roles.map((item) => item.role as AdultRole);

    if (roleList.length === 0) {
      return '/onboarding';
    }

    const preferred = adult.current_role as AdultRole | null;
    const activeRole = preferred && roleList.includes(preferred) ? preferred : roleList[0];

    if (activeRole !== preferred) {
      await updateAdultCurrentRole(adult.id, activeRole, session.access_token);
    }

    return activeRole === 'parent' ? '/dashboard/parent' : '/dashboard/teacher';
  }

  const student = await findStudentByAuthUserId(session.user.id, session.access_token);
  if (student?.id) {
    return '/dashboard/student';
  }

  throw new Error('Для этого аккаунта не найден профиль. Обратитесь к администратору.');
}
