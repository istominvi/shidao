import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { toLessonWorkspaceRoute } from "@/lib/auth";
import { resolveAccessPolicy } from "@/lib/server/access-policy";
import { assertTeacherAssignedToClassAdmin } from "@/lib/server/supabase-admin";
import { assertTeacherHomeworkAccess, issueHomeworkForScheduledLesson } from "@/lib/server/teacher-homework";
import { getScheduledLessonByIdAdmin } from "@/lib/server/lesson-content-repository";

export const runtime = "nodejs";

function withMessage(path: string, type: "saved" | "error", message: string) {
  const params = new URLSearchParams();
  params.set(type, message);
  return `${path}?${params.toString()}`;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ scheduledLessonId: string }> },
) {
  const { scheduledLessonId } = await params;
  const path = toLessonWorkspaceRoute(scheduledLessonId);

  try {
    const accessResolution = await resolveAccessPolicy();
    const { teacherId } = assertTeacherHomeworkAccess(accessResolution);

    const scheduledLesson = await getScheduledLessonByIdAdmin(scheduledLessonId);
    if (!scheduledLesson) throw new Error("Урок не найден.");
    await assertTeacherAssignedToClassAdmin(teacherId, scheduledLesson.runtimeShell.classId);

    const formData = await request.formData();
    const recipientMode = formData.get("recipientMode") === "selected" ? "selected" : "all";
    const dueAtEntry = formData.get("dueAt");
    const dueAtRaw = typeof dueAtEntry === "string" ? dueAtEntry : "";
    const assignmentCommentEntry = formData.get("assignmentComment");
    const assignmentCommentRaw =
      typeof assignmentCommentEntry === "string" ? assignmentCommentEntry : "";
    const selectedStudentIds = formData
      .getAll("studentIds")
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean);

    await issueHomeworkForScheduledLesson({
      scheduledLessonId,
      teacherId,
      recipientMode,
      selectedStudentIds,
      dueAt: dueAtRaw ? new Date(dueAtRaw).toISOString() : null,
      assignmentComment: assignmentCommentRaw.trim() || null,
    });

    revalidatePath(path);
    revalidatePath("/dashboard");
    return NextResponse.redirect(
      new URL(withMessage(path, "saved", "Домашнее задание выдано."), request.url),
      { status: 303 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось выдать домашнее задание.";
    return NextResponse.redirect(new URL(withMessage(path, "error", message), request.url), {
      status: 303,
    });
  }
}
