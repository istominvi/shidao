"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef } from "react";
import { SurfaceCard } from "@/components/ui/surface-card";
import { findDefaultCenteredEventIndex } from "./teacher-schedule-helpers";

type LessonCarouselEvent = {
  id: string;
  href: string;
  startsAt: string;
  endsAt: string;
  groupLabel: string;
  lessonTitle: string;
  timeRangeLabel: string;
  formatLabel: string;
  statusLabel: string;
};

type TeacherLessonsCarouselProps = {
  events: LessonCarouselEvent[];
  nowIso: string;
};

function formatDate(startsAt: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    weekday: "short",
    timeZone: "UTC",
  }).format(new Date(startsAt));
}

export function TeacherLessonsCarousel({ events, nowIso }: TeacherLessonsCarouselProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<Array<HTMLAnchorElement | null>>([]);

  const sortedEvents = useMemo(
    () => events.slice().sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt)),
    [events],
  );

  const centerIndex = useMemo(
    () => findDefaultCenteredEventIndex(sortedEvents, nowIso),
    [sortedEvents, nowIso],
  );

  useEffect(() => {
    if (centerIndex < 0) return;
    const target = itemRefs.current[centerIndex];
    target?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [centerIndex]);

  const scrollByOne = (delta: number) => {
    const container = scrollRef.current;
    if (!container) return;
    const width = container.clientWidth * 0.72;
    container.scrollBy({ left: width * delta, behavior: "smooth" });
  };

  if (sortedEvents.length === 0) {
    return (
      <SurfaceCard
        title="Ближайшие занятия"
        description="Пока нет запланированных занятий. Когда они появятся, здесь будет быстрый доступ к урокам."
      />
    );
  }

  const nowTs = Date.parse(nowIso);

  return (
    <SurfaceCard
      title="Ближайшие занятия"
      description="Слева прошедшие, по центру ближайшее релевантное занятие."
      actions={
        <div className="hidden items-center gap-2 md:flex">
          <button type="button" onClick={() => scrollByOne(-1)} className="rounded-full border border-neutral-200 px-3 py-1 text-sm hover:bg-neutral-50" aria-label="Прокрутить влево">←</button>
          <button type="button" onClick={() => scrollByOne(1)} className="rounded-full border border-neutral-200 px-3 py-1 text-sm hover:bg-neutral-50" aria-label="Прокрутить вправо">→</button>
        </div>
      }
    >

      <div
        ref={scrollRef}
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 [scrollbar-width:thin]"
      >
        {sortedEvents.map((event, index) => {
          const starts = Date.parse(event.startsAt);
          const ends = Date.parse(event.endsAt);
          const isPast = ends < nowTs;
          const isNow = starts <= nowTs && ends >= nowTs;

          return (
            <Link
              key={event.id}
              href={event.href}
              ref={(el) => {
                itemRefs.current[index] = el;
              }}
              className={`relative block w-[280px] shrink-0 snap-center rounded-2xl border p-3 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 motion-reduce:transition-none ${
                isNow
                  ? "border-sky-300 bg-sky-50/60 shadow"
                  : isPast
                    ? "border-neutral-200 bg-neutral-100/70 text-neutral-500"
                    : "border-neutral-200 bg-white hover:border-sky-300"
              }`}
              aria-label={`Открыть занятие ${event.groupLabel}`}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="truncate text-sm font-semibold text-neutral-900">{event.groupLabel}</p>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${isNow ? "bg-sky-600 text-white" : isPast ? "bg-neutral-300 text-neutral-700" : "bg-neutral-900 text-white"}`}>
                  {isNow ? "Идёт" : isPast ? "Завершено" : event.statusLabel}
                </span>
              </div>
              <p className="mt-1 truncate text-xs text-neutral-600">{event.lessonTitle}</p>
              <p className="mt-2 text-xs text-neutral-600">{formatDate(event.startsAt)} · {event.timeRangeLabel}</p>
              <p className="mt-1 text-[11px] text-neutral-500">{event.formatLabel}</p>
              <p className="mt-3 text-xs font-semibold text-sky-700">Открыть занятие →</p>
            </Link>
          );
        })}
      </div>
    </SurfaceCard>
  );
}
