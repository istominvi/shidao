import { NextRequest, NextResponse } from "next/server";
import { resolveAccessPolicy } from "@/lib/server/access-policy";
import { getCommunicationAttachmentSignedUrl } from "@/lib/server/lesson-group-chat-service";

export const runtime = "nodejs";

function toHttpErrorStatus(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("Требуется авторизация")) return 401;
  if (message.includes("доступ") || message.includes("не может") || message.includes("Недостаточно прав")) return 403;
  if (message.includes("не найден")) return 404;
  return 500;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ attachmentId: string }> },
) {
  try {
    const accessResolution = await resolveAccessPolicy();
    const { attachmentId } = await params;
    const scheduledLessonId = request.nextUrl.searchParams.get("scheduledLessonId");
    if (!scheduledLessonId) {
      return NextResponse.json({ error: "scheduledLessonId is required" }, { status: 400 });
    }

    const payload = await getCommunicationAttachmentSignedUrl({
      attachmentId,
      scheduledLessonId,
      accessResolution,
    });
    return NextResponse.json(payload, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось получить ссылку на вложение.";
    return NextResponse.json({ error: message }, { status: toHttpErrorStatus(error) });
  }
}
