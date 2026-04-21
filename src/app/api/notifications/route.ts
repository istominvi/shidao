import { NextResponse } from "next/server";
import { resolveAccessPolicy } from "@/lib/server/access-policy";
import {
  countUnreadNotificationsForUserAdmin,
  listNotificationsForUserAdmin,
} from "@/lib/server/notification-repository";

export const runtime = "nodejs";

function resolveUserId() {
  return resolveAccessPolicy().then((resolution) => {
    if (resolution.status === "guest" || resolution.status === "degraded") {
      throw new Error("unauthorized");
    }
    return resolution.context.userId;
  });
}

export async function GET() {
  try {
    const userId = await resolveUserId();
    const [notifications, unreadCount] = await Promise.all([
      listNotificationsForUserAdmin({ userId, limit: 20 }),
      countUnreadNotificationsForUserAdmin(userId),
    ]);

    return NextResponse.json({
      unreadCount,
      notifications: notifications.map((item) => ({
        id: item.id,
        title: item.title,
        body: item.body,
        href: item.href,
        eventType: item.eventType,
        readAt: item.readAt,
        createdAt: item.createdAt,
      })),
    });
  } catch (error) {
    const unauthorized = error instanceof Error && error.message === "unauthorized";
    return NextResponse.json(
      { error: unauthorized ? "Требуется авторизация." : "Не удалось загрузить уведомления." },
      { status: unauthorized ? 401 : 500 },
    );
  }
}
