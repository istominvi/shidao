import { NextRequest, NextResponse } from "next/server";
import { resolveAccessPolicy } from "@/lib/server/access-policy";
import {
  getLessonGroupChatReadModel,
  sendLessonGroupVoiceMessage,
} from "@/lib/server/lesson-group-chat-service";

export const runtime = "nodejs";

function toHttpErrorStatus(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("Требуется авторизация")) return 401;
  if (message.includes("не имеет доступа") || message.includes("не может отправлять")) return 403;
  if (
    message.includes("Неподдерживаемый формат") ||
    message.includes("слишком большой") ||
    message.includes("слишком длинное") ||
    message.includes("пустой")
  ) {
    return 400;
  }
  return 500;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ scheduledLessonId: string }> },
) {
  try {
    const accessResolution = await resolveAccessPolicy();
    const { scheduledLessonId } = await params;
    const formData = await request.formData();
    const audio = formData.get("audio");
    if (!(audio instanceof File)) {
      throw new Error("Не удалось прочитать аудиофайл.");
    }

    const durationMsRaw = formData.get("durationMs");
    const durationMs =
      typeof durationMsRaw === "string" && durationMsRaw.trim().length > 0
        ? Number(durationMsRaw)
        : null;

    const buffer = await audio.arrayBuffer();

    await sendLessonGroupVoiceMessage({
      scheduledLessonId,
      accessResolution,
      mimeType: audio.type,
      sizeBytes: audio.size,
      durationMs: Number.isFinite(durationMs) ? durationMs : null,
      payload: buffer,
    });

    const model = await getLessonGroupChatReadModel({
      scheduledLessonId,
      accessResolution,
    });
    return NextResponse.json(model, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось отправить голосовое сообщение.";
    return NextResponse.json({ error: message }, { status: toHttpErrorStatus(error) });
  }
}
