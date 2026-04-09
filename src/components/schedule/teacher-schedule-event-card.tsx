"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import type { TeacherScheduleEvent } from "./teacher-schedule-types";

type Props = {
  event: TeacherScheduleEvent;
  density: "compact" | "standard" | "row";
  selected?: boolean;
  interactionMode?: "navigate" | "select";
  onSelect?: (eventId: string) => void;
  className?: string;
  style?: CSSProperties;
};

const formatTone = {
  online: "bg-sky-100 text-sky-700",
  offline: "bg-violet-100 text-violet-700",
} as const;

const statusTone: Record<string, string> = {
  planned: "bg-amber-100 text-amber-700",
  in_progress: "bg-emerald-100 text-emerald-700",
  completed: "bg-neutral-200 text-neutral-700",
  cancelled: "bg-rose-100 text-rose-700",
};

function baseCard(selected?: boolean) {
  return `rounded-xl border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
    selected
      ? "border-sky-300 bg-sky-50/70 shadow-sm"
      : "border-neutral-200 bg-white hover:border-neutral-300 hover:bg-neutral-50"
  }`;
}

export function TeacherScheduleEventCard({
  event,
  density,
  selected,
  interactionMode = "navigate",
  onSelect,
  className = "",
  style,
}: Props) {
  const isSelect = interactionMode === "select";
  const shell = `${baseCard(selected)} ${className}`;
  const chips = (
    <div className="mt-1.5 flex flex-wrap gap-1.5 text-[10px] font-semibold">
      <span className={`rounded-full px-2 py-0.5 ${formatTone[event.format]}`}>{event.formatLabel}</span>
      <span className={`rounded-full px-2 py-0.5 ${statusTone[event.status] ?? "bg-neutral-100 text-neutral-700"}`}>{event.statusLabel}</span>
    </div>
  );

  if (density === "compact") {
    const content = <span className="truncate px-2 py-1 text-[10px] text-neutral-700">{event.timeLabel} · {event.groupLabel}</span>;
    return isSelect ? (
      <button type="button" onClick={() => onSelect?.(event.id)} style={style} className={`block w-full text-left ${shell}`}>
        {content}
      </button>
    ) : (
      <Link href={event.href} style={style} className={`block ${shell}`}>{content}</Link>
    );
  }

  if (density === "row") {
    const row = (
      <div className="grid grid-cols-[132px_1fr_140px_128px] items-center gap-3 px-3 py-2.5 text-sm max-md:grid-cols-1 max-md:gap-1">
        <p className="font-semibold text-neutral-900">{event.timeRangeLabel}</p>
        <div className="min-w-0">
          <p className="truncate font-semibold text-neutral-900">{event.lessonTitle}</p>
          <p className="truncate text-xs text-neutral-600">{event.groupLabel}</p>
        </div>
        <p className="text-xs text-neutral-600">{event.formatLabel}</p>
        <p className="text-xs text-neutral-600">{event.statusLabel}</p>
      </div>
    );
    return isSelect ? (
      <button type="button" onClick={() => onSelect?.(event.id)} style={style} className={`block w-full text-left ${shell}`}>{row}</button>
    ) : (
      <Link href={event.href} style={style} className={`block ${shell}`}>{row}</Link>
    );
  }

  const standard = (
    <div className="p-2.5 text-xs text-neutral-700">
      <p className="truncate font-semibold text-neutral-900">{event.groupLabel}</p>
      <p className="truncate text-[11px] text-neutral-700">{event.lessonTitle}</p>
      <p className="mt-0.5 text-[11px] text-neutral-500">{event.timeRangeLabel}</p>
      {chips}
    </div>
  );

  return isSelect ? (
    <button type="button" onClick={() => onSelect?.(event.id)} style={style} className={`block w-full text-left ${shell}`}>{standard}</button>
  ) : (
    <Link href={event.href} style={style} className={`block ${shell}`}>{standard}</Link>
  );
}
