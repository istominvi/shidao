import { NextRequest, NextResponse } from 'next/server';
import {
  assertTeacherAssignedToClassAdmin,
  attachStudentToClassAsAdmin,
  createStudentAuthUser,
  getUserContextById,
  insertStudentRow
} from '@/lib/server/supabase-admin';
import { normalizeIdentifier, toStudentInternalAuthEmail } from '@/lib/auth';
import { readAppSession } from '@/lib/server/app-session';

export const runtime = 'nodejs';

type Payload = {
  classId?: string;
  login?: string;
  password?: string;
  fullName?: string | null;
  parentId?: string | null;
};

export async function POST(req: NextRequest) {
  try {
    const session = await readAppSession();
    if (!session) {
      return NextResponse.json({ error: 'Не авторизовано.' }, { status: 401 });
    }

    const body = (await req.json()) as Payload;
    const classId = body.classId?.trim();
    const login = normalizeIdentifier(body.login ?? '');
    const password = body.password ?? '';

    if (!classId || !login || password.length < 8) {
      return NextResponse.json(
        { error: 'Нужны classId, login и пароль ученика (минимум 8 символов).' },
        { status: 400 }
      );
    }

    const userContext = await getUserContextById(session.uid);
    if (!userContext.teacher?.id) {
      return NextResponse.json({ error: 'Только преподаватель может создавать учеников.' }, { status: 403 });
    }

    // Admin-only check: current teacher must be assigned to class.
    await assertTeacherAssignedToClassAdmin(userContext.teacher.id, classId);

    const createdAuth = await createStudentAuthUser({
      login,
      password,
      fullName: body.fullName ?? null
    });

    const internalAuthEmail = toStudentInternalAuthEmail(login);
    const studentId = await insertStudentRow({
      userId: createdAuth.userId,
      login,
      internalAuthEmail,
      fullName: body.fullName ?? null,
      parentId: body.parentId ?? null
    });

    if (!studentId) {
      return NextResponse.json({ error: 'Не удалось создать профиль ученика.' }, { status: 500 });
    }

    await attachStudentToClassAsAdmin({ classId, studentId });

    return NextResponse.json({ studentId, userId: createdAuth.userId, internalAuthEmail }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Не удалось создать ученика.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
