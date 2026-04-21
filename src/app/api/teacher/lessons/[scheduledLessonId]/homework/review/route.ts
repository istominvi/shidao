import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { toLessonWorkspaceRoute } from "@/lib/auth";
import { resolveAccessPolicy } from "@/lib/server/access-policy";
import { assertTeacherHomeworkAccess, reviewStudentHomeworkSubmission } from "@/lib/server/teacher-homework";

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
    assertTeacherHomeworkAccess(accessResolution);
    const actorUserId =
      "context" in accessResolution ? accessResolution.context.userId : null;

    const formData = await request.formData();
    const studentHomeworkAssignmentId = `${formData.get("studentHomeworkAssignmentId") ?? ""}`.trim();
    const status = formData.get("reviewStatus") === "needs_revision" ? "needs_revision" : "reviewed";
    const reviewNote = `${formData.get("reviewNote") ?? ""}`;

    if (!studentHomeworkAssignmentId) {
      throw new Error("Не выбрана работа ученика для проверки.");
    }

    await reviewStudentHomeworkSubmission({
      scheduledLessonId,
      studentHomeworkAssignmentId,
      status,
      reviewNote,
      actorUserId,
    });

    revalidatePath(path);
    revalidatePath("/dashboard");
    return NextResponse.redirect(new URL(withMessage(path, "saved", "Проверка сохранена."), request.url), {
      status: 303,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось сохранить проверку.";
    return NextResponse.redirect(new URL(withMessage(path, "error", message), request.url), {
      status: 303,
    });
  }
}
