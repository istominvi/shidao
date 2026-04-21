import { NextRequest, NextResponse } from "next/server";
import { resolveAccessPolicy } from "@/lib/server/access-policy";
import { markNotificationReadAdmin } from "@/lib/server/notification-repository";

export const runtime = "nodejs";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ notificationId: string }> },
) {
  try {
    const resolution = await resolveAccessPolicy();
    if (resolution.status === "guest" || resolution.status === "degraded") {
      return NextResponse.json({ error: "Требуется авторизация." }, { status: 401 });
    }

    const { notificationId } = await params;
    await markNotificationReadAdmin({
      userId: resolution.context.userId,
      notificationId,
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Не удалось отметить уведомление." }, { status: 500 });
  }
}
