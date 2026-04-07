import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { toLessonWorkspaceRoute } from "@/lib/auth";
import { resolveAccessPolicy } from "@/lib/server/access-policy";
import {
  assertTeacherRuntimeMutationAccess,
  parseTeacherRuntimeUpdateFormData,
  updateTeacherLessonRuntime,
} from "@/lib/server/teacher-lesson-runtime-actions";

export const runtime = "nodejs";

function workspacePath(scheduledLessonId: string) {
  return toLessonWorkspaceRoute(scheduledLessonId);
}

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
  const path = workspacePath(scheduledLessonId);

  try {
    const accessResolution = await resolveAccessPolicy();
    const { teacherId } = assertTeacherRuntimeMutationAccess(accessResolution);

    const formData = await request.formData();
    const payload = parseTeacherRuntimeUpdateFormData(formData);

    await updateTeacherLessonRuntime({
      scheduledLessonId,
      teacherId,
      payload,
    });

    revalidatePath(path);
    return NextResponse.redirect(
      new URL(withMessage(path, "saved", "Runtime-данные сохранены."), request.url),
      { status: 303 },
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Не удалось сохранить runtime-данные урока.";

    return NextResponse.redirect(
      new URL(withMessage(path, "error", message), request.url),
      { status: 303 },
    );
  }
}
