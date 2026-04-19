import { NextResponse } from "next/server";
import { resolveAccessPolicy } from "@/lib/server/access-policy";
import { getStudentScheduledLessonView } from "@/lib/server/scheduled-lesson-view";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ scheduledLessonId: string }> },
) {
  const access = await resolveAccessPolicy();
  if (access.status !== "student") {
    return NextResponse.json({ error: "Доступ запрещён." }, { status: 403 });
  }

  const studentId = access.context.student?.id;
  if (!studentId) {
    return NextResponse.json({ error: "Доступ запрещён." }, { status: 403 });
  }

  const { scheduledLessonId } = await params;
  const lessonView = await getStudentScheduledLessonView({
    scheduledLessonId,
    studentId,
  });

  if (!lessonView) {
    return NextResponse.json({ error: "Урок не найден." }, { status: 404 });
  }

  return NextResponse.json({ homework: lessonView.homework });
}
