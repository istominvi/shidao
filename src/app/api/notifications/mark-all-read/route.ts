import { NextResponse } from "next/server";
import { resolveAccessPolicy } from "@/lib/server/access-policy";
import { markAllNotificationsReadAdmin } from "@/lib/server/notification-repository";

export const runtime = "nodejs";

export async function POST() {
  try {
    const resolution = await resolveAccessPolicy();
    if (resolution.status === "guest" || resolution.status === "degraded") {
      return NextResponse.json({ error: "Требуется авторизация." }, { status: 401 });
    }

    await markAllNotificationsReadAdmin(resolution.context.userId);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Не удалось отметить уведомления." }, { status: 500 });
  }
}
