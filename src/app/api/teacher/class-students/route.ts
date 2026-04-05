import { NextRequest, NextResponse } from "next/server";
import {
  assertTeacherAssignedToClassAdmin,
  attachStudentToClassAsAdmin,
  getUserContextById,
} from "@/lib/server/supabase-admin";
import { readAppSession } from "@/lib/server/app-session";

export const runtime = "nodejs";

type Payload = {
  classId?: string;
  studentId?: string;
};

export async function POST(req: NextRequest) {
  try {
    const session = await readAppSession();
    if (!session) {
      return NextResponse.json({ error: "Не авторизовано." }, { status: 401 });
    }

    const body = (await req.json()) as Payload;
    const classId = body.classId?.trim();
    const studentId = body.studentId?.trim();

    if (!classId || !studentId) {
      return NextResponse.json(
        { error: "Нужны classId и studentId." },
        { status: 400 },
      );
    }

    const context = await getUserContextById(session.uid);
    if (!context.teacher?.id) {
      return NextResponse.json(
        { error: "Только преподаватель может добавлять учеников в класс." },
        { status: 403 },
      );
    }

    await assertTeacherAssignedToClassAdmin(context.teacher.id, classId);
    await attachStudentToClassAsAdmin({ classId, studentId });

    return NextResponse.json({ classId, studentId }, { status: 200 });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Не удалось добавить ученика в класс.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
