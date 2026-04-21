"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

type NotificationItem = {
  id: string;
  title: string;
  body: string | null;
  href: string;
  eventType: string;
  readAt: string | null;
  createdAt: string;
};

type NotificationPayload = {
  unreadCount: number;
  notifications: NotificationItem[];
};

function toRelativeLabel(iso: string) {
  const dt = new Date(iso).getTime();
  if (Number.isNaN(dt)) return "";
  const deltaSec = Math.round((dt - Date.now()) / 1000);
  const absSec = Math.abs(deltaSec);
  const rtf = new Intl.RelativeTimeFormat("ru", { numeric: "auto" });
  if (absSec < 60) return rtf.format(deltaSec, "second");
  if (absSec < 3600) return rtf.format(Math.round(deltaSec / 60), "minute");
  if (absSec < 86400) return rtf.format(Math.round(deltaSec / 3600), "hour");
  return rtf.format(Math.round(deltaSec / 86400), "day");
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<NotificationPayload>({ unreadCount: 0, notifications: [] });
  const rootRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const response = await fetch("/api/notifications", { cache: "no-store" });
        if (!response.ok) throw new Error("load failed");
        const data = (await response.json()) as NotificationPayload;
        if (!active) return;
        setPayload(data);
        setError(null);
      } catch {
        if (!active) return;
        setError("Уведомления недоступны");
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    const timer = window.setInterval(load, 15000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const recentItems = useMemo(() => payload.notifications.slice(0, 8), [payload.notifications]);

  const handleNotificationClick = async (item: NotificationItem) => {
    try {
      await fetch(`/api/notifications/${encodeURIComponent(item.id)}/read`, { method: "POST" });
      setPayload((prev) => ({
        unreadCount: Math.max(0, prev.unreadCount - (item.readAt ? 0 : 1)),
        notifications: prev.notifications.map((entry) =>
          entry.id === item.id ? { ...entry, readAt: entry.readAt ?? new Date().toISOString() } : entry,
        ),
      }));
    } catch {
      // noop
    }
    setOpen(false);
    router.push(item.href);
    router.refresh();
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="nav-user-trigger relative inline-flex items-center justify-center px-2.5 text-neutral-900"
        aria-label="Уведомления"
      >
        <Bell size={18} />
        {payload.unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 inline-flex min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
            {payload.unreadCount > 99 ? "99+" : payload.unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="fixed inset-x-3 bottom-3 top-20 z-[220] flex flex-col rounded-2xl border border-black/10 bg-white p-3 shadow-xl md:absolute md:inset-auto md:right-0 md:top-full md:mt-2 md:block md:w-[22rem] md:max-w-[calc(100vw-16px)] md:p-2">
          <div className="mb-2 flex items-center justify-between px-1 pt-1 md:px-2">
            <p className="text-base font-semibold text-neutral-900 md:text-sm">Уведомления</p>
            <Link href="/notifications" className="text-sm font-semibold text-neutral-700 hover:text-neutral-900 md:text-xs md:font-medium" onClick={() => setOpen(false)}>
              Все
            </Link>
          </div>
          {loading ? <p className="px-2 py-3 text-sm text-neutral-500">Загрузка…</p> : null}
          {error ? <p className="px-2 py-3 text-sm text-red-600">{error}</p> : null}
          {!loading && !error && recentItems.length === 0 ? (
            <p className="px-2 py-3 text-sm text-neutral-500">Уведомлений пока нет.</p>
          ) : null}
          {!loading && !error && recentItems.length > 0 ? (
            <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto md:max-h-[22rem] md:flex-none">
              {recentItems.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => void handleNotificationClick(item)}
                    className={`w-full rounded-xl px-3 py-2.5 text-left hover:bg-neutral-50 md:px-2 md:py-2 ${item.readAt ? "opacity-75" : "bg-blue-50/60"}`}
                  >
                    <p className="text-[15px] font-semibold text-neutral-900 md:text-sm md:font-medium">{item.title}</p>
                    {item.body ? <p className="line-clamp-2 text-sm text-neutral-600 md:truncate md:text-xs">{item.body}</p> : null}
                    <p className="mt-1 text-xs text-neutral-500 md:text-[11px]">{toRelativeLabel(item.createdAt)}</p>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
