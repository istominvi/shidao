import { AppPageHeader } from "@/components/app/page-header";
import { resolveAccessPolicy } from "@/lib/server/access-policy";
import {
  countUnreadNotificationsForUserAdmin,
  listNotificationsForUserAdmin,
} from "@/lib/server/notification-repository";
import { markAllNotificationsReadAdmin, markNotificationReadAdmin } from "@/lib/server/notification-repository";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ROUTES } from "@/lib/auth";

export const runtime = "nodejs";

function sectionLabel(iso: string) {
  const now = new Date();
  const date = new Date(iso);
  const startToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const startTarget = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const diff = Math.round((startToday.getTime() - startTarget.getTime()) / 86400000);
  if (diff === 0) return "Сегодня";
  if (diff === 1) return "Вчера";
  return "Ранее";
}

function formatDateTime(iso: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(new Date(iso));
}

export default async function NotificationsPage() {
  const resolution = await resolveAccessPolicy();
  if (resolution.status === "guest" || resolution.status === "degraded") {
    redirect(ROUTES.login);
  }

  const userId = resolution.context.userId;
  const [notifications, unreadCount] = await Promise.all([
    listNotificationsForUserAdmin({ userId, limit: 200 }),
    countUnreadNotificationsForUserAdmin(userId),
  ]);

  const groups = new Map<string, typeof notifications>();
  for (const item of notifications) {
    const key = sectionLabel(item.createdAt);
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }

  async function markOneReadAction(formData: FormData) {
    "use server";
    const notificationId = String(formData.get("notificationId") ?? "").trim();
    if (!notificationId) return;
    await markNotificationReadAdmin({ userId, notificationId });
  }

  async function markAllReadAction() {
    "use server";
    await markAllNotificationsReadAdmin(userId);
  }

  return (
    <div className="space-y-4">
      <AppPageHeader
        title="Уведомления"
        description="Системные события по домашним заданиям, сообщениям и статусам."
        actions={
          <form action={markAllReadAction}>
            <button type="submit" className="nav-pill nav-pill-inactive px-3 py-1.5 text-sm">
              Отметить всё прочитанным
            </button>
          </form>
        }
        meta={<span className="text-sm text-neutral-500">Непрочитанных: {unreadCount}</span>}
      />

      {notifications.length === 0 ? (
        <div className="rounded-2xl border border-black/10 bg-white p-5 text-sm text-neutral-600">
          Уведомлений пока нет.
        </div>
      ) : (
        <div className="space-y-4">
          {Array.from(groups.entries()).map(([label, items]) => (
            <section key={label} className="space-y-2">
              <h2 className="text-sm font-semibold text-neutral-800">{label}</h2>
              <ul className="space-y-2">
                {items.map((item) => (
                  <li key={item.id} className={`rounded-2xl border p-3 ${item.readAt ? "border-black/10 bg-white" : "border-blue-100 bg-blue-50/50"}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-neutral-900">{item.title}</p>
                        {item.body ? <p className="mt-1 text-sm text-neutral-600">{item.body}</p> : null}
                        <p className="mt-1 text-xs text-neutral-500">{formatDateTime(item.createdAt)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <form action={markOneReadAction}>
                          <input type="hidden" name="notificationId" value={item.id} />
                          <button type="submit" className="text-xs text-neutral-500 hover:text-neutral-700">
                            Прочитано
                          </button>
                        </form>
                        <Link href={item.href} className="text-xs font-medium text-neutral-700 underline underline-offset-2">
                          Открыть
                        </Link>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
