import { NextResponse } from "next/server";
import { resolveAccessPolicy } from "@/lib/server/access-policy";
import { getScheduledLessonByIdAdmin, listAssignedClassIdsForTeacherAdmin, listClassIdsForStudentAdmin } from "@/lib/server/lesson-content-repository";
import { loadParentLearningContextsByUser } from "@/lib/server/supabase-admin";
import { mapScheduledLessonLiveState } from "@/lib/server/scheduled-lesson-live-state";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ scheduledLessonId: string }> },
) {
  const { scheduledLessonId } = await params;
  const access = await resolveAccessPolicy();
  const scheduledLesson = await getScheduledLessonByIdAdmin(scheduledLessonId);
  if (!scheduledLesson) {
    return NextResponse.json({ error: "Урок не найден." }, { status: 404 });
  }

  const classId = scheduledLesson.runtimeShell.classId;

  if (access.status !== "adult-with-profile" && access.status !== "student") {
    return NextResponse.json({ error: "Доступ запрещён." }, { status: 403 });
  }

  if (access.context.actorKind === "student") {
    const studentId = access.context.student?.id;
    if (!studentId) return NextResponse.json({ error: "Доступ запрещён." }, { status: 403 });
    const classIds = await listClassIdsForStudentAdmin(studentId);
    if (!classIds.includes(classId)) {
      return NextResponse.json({ error: "Доступ запрещён." }, { status: 403 });
    }
  } else if (access.context.activeProfile === "teacher") {
    const teacherId = access.context.teacher?.id;
    if (!teacherId) return NextResponse.json({ error: "Доступ запрещён." }, { status: 403 });
    const classIds = await listAssignedClassIdsForTeacherAdmin(teacherId);
    if (!classIds.includes(classId)) {
      return NextResponse.json({ error: "Доступ запрещён." }, { status: 403 });
    }
  } else if (access.context.activeProfile === "parent") {
    const contexts = await loadParentLearningContextsByUser(access.context.userId);
    const canAccess = contexts.some((child) =>
      child.classes.some((klass) => klass.classId === classId),
    );
    if (!canAccess) {
      return NextResponse.json({ error: "Доступ запрещён." }, { status: 403 });
    }
  }

  return NextResponse.json({
    liveState: mapScheduledLessonLiveState(scheduledLesson),
  });
}
