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
        className="relative inline-flex size-9 items-center justify-center rounded-full border border-black/10 bg-white text-neutral-700 hover:bg-neutral-50"
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
        <div className="absolute right-0 z-[170] mt-2 w-[22rem] max-w-[calc(100vw-16px)] rounded-2xl border border-black/10 bg-white p-2 shadow-xl">
          <div className="mb-2 flex items-center justify-between px-2 pt-1">
            <p className="text-sm font-semibold text-neutral-900">Уведомления</p>
            <Link href="/notifications" className="text-xs font-medium text-neutral-600 hover:text-neutral-900" onClick={() => setOpen(false)}>
              Все
            </Link>
          </div>
          {loading ? <p className="px-2 py-3 text-xs text-neutral-500">Загрузка…</p> : null}
          {error ? <p className="px-2 py-3 text-xs text-red-600">{error}</p> : null}
          {!loading && !error && recentItems.length === 0 ? (
            <p className="px-2 py-3 text-xs text-neutral-500">Уведомлений пока нет.</p>
          ) : null}
          {!loading && !error && recentItems.length > 0 ? (
            <ul className="max-h-[22rem] space-y-1 overflow-y-auto">
              {recentItems.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => void handleNotificationClick(item)}
                    className={`w-full rounded-xl px-2 py-2 text-left hover:bg-neutral-50 ${item.readAt ? "opacity-75" : "bg-blue-50/60"}`}
                  >
                    <p className="text-sm font-medium text-neutral-900">{item.title}</p>
                    {item.body ? <p className="truncate text-xs text-neutral-600">{item.body}</p> : null}
                    <p className="mt-1 text-[11px] text-neutral-500">{toRelativeLabel(item.createdAt)}</p>
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
