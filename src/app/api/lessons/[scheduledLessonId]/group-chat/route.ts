import { NextRequest, NextResponse } from "next/server";
import { resolveAccessPolicy } from "@/lib/server/access-policy";
import {
  deleteLessonGroupChatMessage,
  getLessonGroupChatReadModel,
  sendLessonGroupChatMessage,
} from "@/lib/server/lesson-group-chat-service";

export const runtime = "nodejs";

function toHttpErrorStatus(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("Требуется авторизация")) return 401;
  if (
    message.includes("не имеет доступа") ||
    message.includes("не состоит в группе") ||
    message.includes("Только преподаватель") ||
    message.includes("Недостаточно прав") ||
    message.includes("не может отправлять") ||
    message.includes("не может удалять")
  ) {
    return 403;
  }
  if (
    message.includes("Введите текст") ||
    message.includes("слишком длинное") ||
    message.includes("Сообщение не найдено")
  ) {
    return 400;
  }
  return 500;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ scheduledLessonId: string }> },
) {
  try {
    const accessResolution = await resolveAccessPolicy();
    const { scheduledLessonId } = await params;
    const model = await getLessonGroupChatReadModel({
      scheduledLessonId,
      accessResolution,
    });

    return NextResponse.json(model, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось загрузить чат урока.";
    return NextResponse.json({ error: message }, { status: toHttpErrorStatus(error) });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ scheduledLessonId: string }> },
) {
  try {
    const accessResolution = await resolveAccessPolicy();
    const { scheduledLessonId } = await params;
    const payload = (await request.json().catch(() => null)) as { body?: string } | null;
    const body = String(payload?.body ?? "");

    await sendLessonGroupChatMessage({
      scheduledLessonId,
      accessResolution,
      body,
    });

    const model = await getLessonGroupChatReadModel({
      scheduledLessonId,
      accessResolution,
    });

    return NextResponse.json(model, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось отправить сообщение.";
    return NextResponse.json({ error: message }, { status: toHttpErrorStatus(error) });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ scheduledLessonId: string }> },
) {
  try {
    const accessResolution = await resolveAccessPolicy();
    const { scheduledLessonId } = await params;
    const payload = (await request.json().catch(() => null)) as { messageId?: string } | null;
    const messageId = String(payload?.messageId ?? "").trim();
    if (!messageId) {
      return NextResponse.json({ error: "Не указан идентификатор сообщения." }, { status: 400 });
    }

    await deleteLessonGroupChatMessage({
      scheduledLessonId,
      messageId,
      accessResolution,
    });

    const model = await getLessonGroupChatReadModel({
      scheduledLessonId,
      accessResolution,
    });

    return NextResponse.json(model, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось удалить сообщение.";
    return NextResponse.json({ error: message }, { status: toHttpErrorStatus(error) });
  }
}
