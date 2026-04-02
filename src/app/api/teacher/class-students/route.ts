import { NextRequest, NextResponse } from 'next/server';
import {
  assertTeacherAssignedToClass,
  attachStudentToClassAsAdmin,
  findTeacherByAuthUserId,
  getAuthUserFromAccessToken
} from '@/lib/server/supabase-admin';

export const runtime = 'nodejs';

type Payload = {
  classId?: string;
  studentId?: string;
};

function getAccessToken(req: NextRequest) {
  const auth = req.headers.get('authorization') ?? '';
  return auth.startsWith('Bearer ') ? auth.slice('Bearer '.length).trim() : '';
}

export async function POST(req: NextRequest) {
  try {
    const accessToken = getAccessToken(req);
    if (!accessToken) {
      return NextResponse.json({ error: 'Не авторизовано.' }, { status: 401 });
    }

    const body = (await req.json()) as Payload;
    const classId = body.classId?.trim();
    const studentId = body.studentId?.trim();

    if (!classId || !studentId) {
      return NextResponse.json({ error: 'Нужны classId и studentId.' }, { status: 400 });
    }

    const authUser = await getAuthUserFromAccessToken(accessToken);
    const teacher = await findTeacherByAuthUserId(accessToken, authUser.id);

    if (!teacher?.id) {
      return NextResponse.json({ error: 'Только преподаватель может добавлять учеников в класс.' }, { status: 403 });
    }

    await assertTeacherAssignedToClass(accessToken, teacher.id, classId);
    await attachStudentToClassAsAdmin({ classId, studentId });

    return NextResponse.json({ classId, studentId }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Не удалось добавить ученика в класс.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
