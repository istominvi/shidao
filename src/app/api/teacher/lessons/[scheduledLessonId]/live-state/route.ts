import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { toLessonWorkspaceRoute } from "@/lib/auth";
import { resolveAccessPolicy } from "@/lib/server/access-policy";
import { assertTeacherRuntimeMutationAccess } from "@/lib/server/teacher-lesson-runtime-actions";
import { applyTeacherScheduledLessonLiveAction, type LiveAction } from "@/lib/server/teacher-scheduled-lesson-live-actions";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ scheduledLessonId: string }> },
) {
  const { scheduledLessonId } = await params;

  try {
    const access = await resolveAccessPolicy();
    const { teacherId } = assertTeacherRuntimeMutationAccess(access);
    const payload = (await request.json()) as {
      action: LiveAction;
      stepId?: string;
      stepOrder?: number;
    };

    if (!payload?.action) {
      throw new Error("Не передано действие live-урока.");
    }

    await applyTeacherScheduledLessonLiveAction({
      scheduledLessonId,
      teacherId,
      action: payload.action,
      stepId: payload.stepId,
      stepOrder: payload.stepOrder,
    });

    revalidatePath(toLessonWorkspaceRoute(scheduledLessonId));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Не удалось обновить live-состояние урока.",
      },
      { status: 400 },
    );
  }
}
