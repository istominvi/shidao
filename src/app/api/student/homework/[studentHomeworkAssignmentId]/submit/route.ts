import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { ROUTES } from "@/lib/auth";
import { resolveAccessPolicy } from "@/lib/server/access-policy";
import { submitStudentHomework } from "@/lib/server/student-homework";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ studentHomeworkAssignmentId: string }> },
) {
  const { studentHomeworkAssignmentId } = await params;

  try {
    const resolution = await resolveAccessPolicy();
    if (resolution.status !== "student") {
      throw new Error("Только ученик может отправлять домашнее задание.");
    }

    const formData = await request.formData();
    const submissionText = `${formData.get("submissionText") ?? ""}`;
    const submissionPayloadRaw = `${formData.get("submissionPayload") ?? ""}`.trim();
    let submissionPayload: unknown = undefined;
    if (submissionPayloadRaw) {
      try {
        submissionPayload = JSON.parse(submissionPayloadRaw);
      } catch {
        throw new Error("Не удалось прочитать ответы теста.");
      }
    }

    await submitStudentHomework({
      studentId: resolution.context.student?.id ?? "",
      studentHomeworkAssignmentId,
      submissionText,
      submissionPayload,
      actorUserId: resolution.context.userId,
    });

    revalidatePath(ROUTES.dashboard);
    return NextResponse.redirect(new URL(`${ROUTES.dashboard}?saved=homework`, request.url), {
      status: 303,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось отправить домашнее задание.";
    return NextResponse.redirect(
      new URL(`${ROUTES.dashboard}?error=${encodeURIComponent(message)}`, request.url),
      { status: 303 },
    );
  }
}
