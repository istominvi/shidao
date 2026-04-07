import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { resolveAccessPolicy } from "@/lib/server/access-policy";
import { sendTeacherMessage } from "@/lib/server/communication-service";
import { assertTeacherGroupsAccess } from "@/lib/server/teacher-groups";
import { assertTeacherAssignedToClassAdmin } from "@/lib/server/supabase-admin";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const resolution = await resolveAccessPolicy();
    if (resolution.status !== "adult-with-profile") {
      throw new Error("Только преподаватель может отправлять сообщения в этом контексте.");
    }
    const { teacherId } = assertTeacherGroupsAccess(resolution);
    const formData = await request.formData();
    const classId = String(formData.get("classId") ?? "").trim();
    const studentId = String(formData.get("studentId") ?? "").trim();
    const body = String(formData.get("body") ?? "");
    const redirectTo = String(formData.get("redirectTo") ?? "/dashboard");

    await assertTeacherAssignedToClassAdmin(teacherId, classId);

    await sendTeacherMessage({
      classId,
      studentId,
      authorUserId: resolution.context.userId,
      body,
      scheduledLessonId: String(formData.get("scheduledLessonId") ?? "").trim() || undefined,
      scheduledLessonHomeworkAssignmentId:
        String(formData.get("scheduledLessonHomeworkAssignmentId") ?? "").trim() || undefined,
      topicKind:
        (String(formData.get("topicKind") ?? "").trim() as
          | "general"
          | "lesson"
          | "homework"
          | "progress"
          | "organizational"
          | "") || undefined,
    });

    revalidatePath(redirectTo);
    return NextResponse.redirect(new URL(redirectTo, request.url), { status: 303 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось отправить сообщение.";
    return NextResponse.redirect(
      new URL(`/dashboard?error=${encodeURIComponent(message)}`, request.url),
      { status: 303 },
    );
  }
}
