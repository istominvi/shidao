import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { resolveAccessPolicy } from "@/lib/server/access-policy";
import { sendStudentMessage } from "@/lib/server/communication-service";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const resolution = await resolveAccessPolicy();
    if (resolution.status !== "student") {
      throw new Error("Только ученик может отправлять сообщение здесь.");
    }

    const formData = await request.formData();
    const classId = String(formData.get("classId") ?? "").trim();
    const body = String(formData.get("body") ?? "");
    const redirectTo = String(formData.get("redirectTo") ?? "/dashboard");

    await sendStudentMessage({
      studentId: resolution.context.student?.id ?? "",
      classId,
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
