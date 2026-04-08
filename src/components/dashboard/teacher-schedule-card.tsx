"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { TeacherDashboardScheduleEvent } from "@/lib/server/teacher-dashboard-operations";
import type { TeacherDashboardOperationsReadModel } from "@/lib/server/teacher-dashboard-operations";
import {
  buildEventLaneLayout,
  getMonthMatrix,
  getRangeByView,
  getVisibleHourRange,
  getWeekDays,
  type ScheduleViewMode,
} from "./teacher-schedule-utils";

type Props = {
  schedule: TeacherDashboardOperationsReadModel["schedule"];
};

const VIEW_LABELS: Record<ScheduleViewMode, string> = {
  day: "День",
  week: "Неделя",
  month: "Месяц",
  list: "Список",
};
const WEEKDAY_SHORT = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

const HOUR_HEIGHT = 62;
const HOUR_WIDTH = 128;

function formatDayLabel(isoDate: string, compact = false) {
  return new Intl.DateTimeFormat("ru-RU", {
    weekday: compact ? "short" : "long",
    day: "numeric",
    month: compact ? "numeric" : "long",
    timeZone: "UTC",
  }).format(new Date(`${isoDate}T00:00:00Z`));
}


export function TeacherScheduleCard({ schedule }: Props) {
  const [viewMode, setViewMode] = useState<ScheduleViewMode>("list");
  const [activeDateIso, setActiveDateIso] = useState(schedule.defaultDateIso);
  const [monthAgendaIso, setMonthAgendaIso] = useState(schedule.defaultDateIso);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px)");
    if (media.matches) {
      setViewMode("list");
    }
  }, []);

  const nowTs = Date.parse(schedule.nowIso);
  const range = useMemo(() => getRangeByView(viewMode, activeDateIso), [viewMode, activeDateIso]);

  const rangeEvents = useMemo(() => {
    const source =
      viewMode === "list"
        ? schedule.events
        : schedule.events.filter((event) => event.isoDate >= range.startIso && event.isoDate < range.endIsoExclusive);
    return source.slice().sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
  }, [schedule.events, range, viewMode]);

  const nextInRange = rangeEvents.find((event) => Date.parse(event.startsAt) >= nowTs) ?? null;

  return (
    <section className="landing-surface rounded-3xl border border-white/80 p-4 md:p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-xl font-black text-neutral-950">Расписание</h2>
          <p className="mt-1 text-xs text-neutral-500">
            Занятий в диапазоне: {rangeEvents.length}
            {nextInRange ? ` · Ближайшее: ${nextInRange.timeRangeLabel}, ${nextInRange.groupLabel}` : " · Ближайших занятий нет"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-full border border-neutral-200 bg-white p-1">
            {(["list", "day", "week", "month"] as ScheduleViewMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                aria-pressed={viewMode === mode}
                onClick={() => setViewMode(mode)}
                className={`cursor-pointer rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  viewMode === mode
                    ? "bg-neutral-900 text-white"
                    : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
                }`}
              >
                {VIEW_LABELS[mode]}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4">
        {viewMode === "day" ? (
          <DayView
            activeDateIso={activeDateIso}
            events={schedule.events}
            nowIso={schedule.nowIso}
            onDayPick={setActiveDateIso}
          />
        ) : null}
        {viewMode === "week" ? (
          <WeekView activeDateIso={activeDateIso} events={schedule.events} nowIso={schedule.nowIso} />
        ) : null}
        {viewMode === "month" ? (
          <MonthView
            activeDateIso={activeDateIso}
            agendaDateIso={monthAgendaIso}
            events={schedule.events}
            onSelectDate={setMonthAgendaIso}
          />
        ) : null}
        {viewMode === "list" ? (
          <ListView events={schedule.events} nowIso={schedule.nowIso} />
        ) : null}
      </div>
    </section>
  );
}

function DayView({
  activeDateIso,
  events,
  nowIso,
  onDayPick,
}: {
  activeDateIso: string;
  events: TeacherDashboardScheduleEvent[];
  nowIso: string;
  onDayPick: (iso: string) => void;
}) {
  const weekDays = getWeekDays(activeDateIso);
  const dayEvents = events.filter((event) => event.isoDate === activeDateIso);
  const hourRange = getVisibleHourRange(dayEvents);

  return (
    <div className="space-y-3">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {weekDays.map((iso) => (
          <button
            key={iso}
            type="button"
            onClick={() => onDayPick(iso)}
            className={`shrink-0 cursor-pointer rounded-2xl border px-3 py-2 text-left text-xs font-semibold transition ${
              iso === activeDateIso
                ? "border-neutral-900 bg-neutral-900 text-white"
                : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50"
            }`}
          >
            <div>{WEEKDAY_SHORT[(new Date(`${iso}T00:00:00Z`).getUTCDay() + 6) % 7]} · {iso.slice(8, 10)}</div>
          </button>
        ))}
      </div>
      <HorizontalDayTimeline
        activeDateIso={activeDateIso}
        events={dayEvents}
        nowIso={nowIso}
        hourRange={hourRange}
      />
    </div>
  );
}

function ListView({ events, nowIso }: { events: TeacherDashboardScheduleEvent[]; nowIso: string }) {
  const router = useRouter();
  const sortedEvents = events.slice().sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
  const nowTs = Date.parse(nowIso);
  const focusIndex = sortedEvents.findIndex((event) => Date.parse(event.startsAt) <= nowTs && Date.parse(event.endsAt) >= nowTs);
  const nearestUpcomingIndex = sortedEvents.findIndex((event) => Date.parse(event.startsAt) >= nowTs);
  const targetIndex = focusIndex >= 0 ? focusIndex : nearestUpcomingIndex >= 0 ? nearestUpcomingIndex : -1;
  const targetRowRef = useRef<HTMLTableRowElement | null>(null);

  useEffect(() => {
    if (targetIndex < 0) return;
    targetRowRef.current?.focus();
    targetRowRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [targetIndex]);

  return (
    <div className="overflow-x-auto rounded-2xl border border-neutral-200 bg-white">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
          <tr>
            <th className="px-4 py-3">Дата</th>
            <th className="px-4 py-3">Время</th>
            <th className="px-4 py-3">Группа</th>
            <th className="px-4 py-3">Урок</th>
            <th className="px-4 py-3">Формат</th>
            <th className="px-4 py-3">Статус</th>
          </tr>
        </thead>
        <tbody>
          {sortedEvents.map((event, index) => (
            <tr
              key={event.id}
              ref={index === targetIndex ? targetRowRef : null}
              tabIndex={index === targetIndex ? -1 : undefined}
              onClick={() => router.push(event.href)}
              className={`cursor-pointer border-t border-neutral-200 transition hover:bg-sky-50/45 ${index === targetIndex ? "bg-sky-50/70 outline-none" : ""}`}
            >
              <td className="px-4 py-3 text-neutral-700">{formatDayLabel(event.isoDate)}</td>
              <td className="px-4 py-3 font-medium text-neutral-900">{event.timeRangeLabel}</td>
              <td className="px-4 py-3 text-neutral-700">{event.groupLabel}</td>
              <td className="px-4 py-3 text-neutral-700">{event.lessonTitle}</td>
              <td className="px-4 py-3 text-neutral-700">{event.formatLabel}</td>
              <td className="px-4 py-3 text-neutral-700">{event.statusLabel}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function HorizontalDayTimeline({
  activeDateIso,
  events,
  nowIso,
  hourRange,
}: {
  activeDateIso: string;
  events: TeacherDashboardScheduleEvent[];
  nowIso: string;
  hourRange: { startHour: number; endHour: number };
}) {
  const visibleStartMinutes = hourRange.startHour * 60;
  const timelineWidth = (hourRange.endHour - hourRange.startHour) * HOUR_WIDTH;
  const laneLayout = buildEventLaneLayout(events);
  const laneById = new Map(laneLayout.map((item) => [item.id, item]));
  const laneCount = Math.max(1, ...laneLayout.map((item) => item.laneCount));
  const rowHeight = 74;
  const contentHeight = laneCount * rowHeight;
  const now = new Date(nowIso);
  const nowDay = nowIso.slice(0, 10);
  const nowMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  const showNow = nowDay === activeDateIso && nowMinutes >= visibleStartMinutes && nowMinutes <= hourRange.endHour * 60;
  const marks = Array.from({ length: hourRange.endHour - hourRange.startHour + 1 }, (_, index) => hourRange.startHour + index);

  return (
    <div className="overflow-x-auto rounded-2xl border border-neutral-200 bg-white">
      <div className="min-w-[720px] p-3" style={{ width: `${Math.max(720, timelineWidth + 24)}px` }}>
        <div className="relative mb-2 h-6">
          {marks.map((hour) => (
            <div key={hour} className="absolute -translate-x-1/2 text-[11px] font-semibold text-neutral-500" style={{ left: `${((hour - hourRange.startHour) * HOUR_WIDTH) + 12}px` }}>
              {String(hour).padStart(2, "0")}:00
            </div>
          ))}
        </div>
        <div className="relative rounded-xl border border-neutral-200 bg-neutral-50/40" style={{ height: `${Math.max(contentHeight, 78)}px` }}>
          {marks.map((hour) => (
            <div
              key={hour}
              className="absolute bottom-0 top-0 border-l border-dashed border-neutral-200"
              style={{ left: `${(hour - hourRange.startHour) * HOUR_WIDTH + 12}px` }}
            />
          ))}
          {showNow ? (
            <div
              className="absolute bottom-0 top-0 z-20 border-l border-rose-400"
              style={{ left: `${((nowMinutes - visibleStartMinutes) / 60) * HOUR_WIDTH + 12}px` }}
            >
              <span className="ml-1 mt-1 inline-block rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">Сейчас</span>
            </div>
          ) : null}

          {events.map((event) => {
            const lane = laneById.get(event.id);
            const start = new Date(event.startsAt);
            const end = new Date(event.endsAt);
            const startMinutes = start.getUTCHours() * 60 + start.getUTCMinutes();
            const endMinutes = end.getUTCHours() * 60 + end.getUTCMinutes();
            const left = ((startMinutes - visibleStartMinutes) / 60) * HOUR_WIDTH + 16;
            const width = Math.max(140, ((endMinutes - startMinutes) / 60) * HOUR_WIDTH - 8);
            const top = (lane?.laneIndex ?? 0) * rowHeight + 8;

            return (
              <Link
                key={event.id}
                href={event.href}
                className="absolute z-10 block cursor-pointer overflow-hidden rounded-xl border border-neutral-200 bg-white p-2.5 text-xs text-neutral-700 shadow-sm transition hover:border-sky-300 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                style={{ left: `${left}px`, width: `${width}px`, top: `${top}px` }}
              >
                <p className="truncate font-semibold text-neutral-900">{event.groupLabel}</p>
                <p className="truncate text-[11px]">{event.lessonTitle}</p>
                <p className="mt-0.5 text-[11px] text-neutral-500">{event.timeRangeLabel} · {event.formatLabel}</p>
              </Link>
            );
          })}

        </div>
      </div>
    </div>
  );
}

function WeekView({
  activeDateIso,
  events,
  nowIso,
}: {
  activeDateIso: string;
  events: TeacherDashboardScheduleEvent[];
  nowIso: string;
}) {
  const weekDays = getWeekDays(activeDateIso);
  const weekEvents = events.filter((event) => weekDays.includes(event.isoDate));
  const hourRange = getVisibleHourRange(weekEvents);

  return <TimeGrid days={weekDays} events={weekEvents} nowIso={nowIso} hourRange={hourRange} />;
}

function TimeGrid({
  days,
  events,
  nowIso,
  hourRange,
}: {
  days: string[];
  events: TeacherDashboardScheduleEvent[];
  nowIso: string;
  hourRange: { startHour: number; endHour: number };
}) {
  const hours = Array.from({ length: hourRange.endHour - hourRange.startHour + 1 }, (_, i) => hourRange.startHour + i);
  const gridHeight = (hourRange.endHour - hourRange.startHour) * HOUR_HEIGHT;

  const eventsByDay = new Map<string, TeacherDashboardScheduleEvent[]>();
  for (const day of days) eventsByDay.set(day, []);
  for (const event of events) {
    if (eventsByDay.has(event.isoDate)) {
      eventsByDay.get(event.isoDate)?.push(event);
    }
  }

  const now = new Date(nowIso);
  const nowDay = nowIso.slice(0, 10);
  const nowMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  const visibleStartMinutes = hourRange.startHour * 60;

  return (
    <div className="overflow-x-auto rounded-2xl border border-neutral-200 bg-white">
      <div className="grid min-w-[720px] grid-cols-[64px_repeat(7,minmax(140px,1fr))]">
        <div className="border-b border-neutral-200 bg-neutral-50 p-2 text-xs font-semibold text-neutral-600" />
        {days.map((day) => (
          <div key={day} className="border-b border-l border-neutral-200 bg-neutral-50 px-2 py-2 text-center text-xs font-semibold text-neutral-600">
            <span className={day === nowDay ? "rounded-full bg-sky-100 px-2 py-0.5 text-sky-700" : ""}>
              {WEEKDAY_SHORT[(new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7]} · {day.slice(8, 10)}
            </span>
          </div>
        ))}

        <div className="relative">
          {hours.map((hour) => (
            <div key={hour} className="h-[62px] border-t border-neutral-100 px-2 pt-1 text-[11px] text-neutral-500">
              {String(hour).padStart(2, "0")}:00
            </div>
          ))}
        </div>

        {days.map((day) => {
          const dayEvents = (eventsByDay.get(day) ?? []).sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
          const laneLayout = buildEventLaneLayout(dayEvents);
          const laneById = new Map(laneLayout.map((item) => [item.id, item]));

          return (
            <div key={day} className="relative border-l border-neutral-200">
              <div className="relative" style={{ height: `${gridHeight}px` }}>
                {hours.slice(0, -1).map((hour) => (
                  <div key={hour} className="h-[62px] border-t border-neutral-100" />
                ))}

                {day === nowDay && nowMinutes >= visibleStartMinutes && nowMinutes <= hourRange.endHour * 60 ? (
                  <div
                    className="pointer-events-none absolute left-0 right-0 z-20 border-t border-rose-400"
                    style={{ top: `${((nowMinutes - visibleStartMinutes) / 60) * HOUR_HEIGHT}px` }}
                  >
                    <span className="-mt-2 ml-1 inline-block rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">Сейчас</span>
                  </div>
                ) : null}

                {dayEvents.map((event) => {
                  const start = new Date(event.startsAt);
                  const end = new Date(event.endsAt);
                  const startMinutes = start.getUTCHours() * 60 + start.getUTCMinutes();
                  const endMinutes = end.getUTCHours() * 60 + end.getUTCMinutes();
                  const top = ((startMinutes - visibleStartMinutes) / 60) * HOUR_HEIGHT;
                  const height = Math.max(32, ((endMinutes - startMinutes) / 60) * HOUR_HEIGHT - 4);
                  const lane = laneById.get(event.id);
                  const laneCount = Math.max(lane?.laneCount ?? 1, 1);
                  const laneWidth = 100 / laneCount;
                  const left = (lane?.laneIndex ?? 0) * laneWidth;

                  return (
                    <Link
                      key={event.id}
                      href={event.href}
                      className="absolute z-10 cursor-pointer overflow-hidden rounded-xl border border-neutral-200 bg-white p-2.5 text-xs text-neutral-700 shadow-sm transition hover:border-sky-300 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                      style={{
                        top: `${top}px`,
                        left: `${left + 1}%`,
                        width: `calc(${laneWidth}% - 2%)`,
                        height: `${height}px`,
                      }}
                    >
                      <p className="truncate font-semibold text-neutral-900">{event.groupLabel}</p>
                      <p className="truncate text-[11px]">{event.lessonTitle}</p>
                      <p className="mt-0.5 text-[11px] text-neutral-500">{event.timeRangeLabel}</p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        <span className="rounded-full bg-sky-100 px-1.5 py-0.5 text-[10px] text-sky-700">{event.formatLabel}</span>
                        <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] text-emerald-700">{event.statusLabel}</span>
                      </div>
                    </Link>
                  );
                })}

              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MonthView({
  activeDateIso,
  agendaDateIso,
  events,
  onSelectDate,
}: {
  activeDateIso: string;
  agendaDateIso: string;
  events: TeacherDashboardScheduleEvent[];
  onSelectDate: (isoDate: string) => void;
}) {
  const { weeks, month } = getMonthMatrix(activeDateIso);
  const eventsByDate = new Map<string, TeacherDashboardScheduleEvent[]>();

  for (const event of events) {
    const bucket = eventsByDate.get(event.isoDate) ?? [];
    bucket.push(event);
    eventsByDate.set(event.isoDate, bucket);
  }

  const agendaEvents = (eventsByDate.get(agendaDateIso) ?? []).sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-2xl border border-neutral-200 bg-white">
        <div className="grid min-w-[740px] grid-cols-7 border-b border-neutral-200 bg-neutral-50 text-xs font-semibold text-neutral-600">
          {weeks[1]?.map((iso) => (
            <div key={iso} className="px-2 py-2 text-center">
              {WEEKDAY_SHORT[(new Date(`${iso}T00:00:00Z`).getUTCDay() + 6) % 7]} · {iso.slice(8, 10)}
            </div>
          ))}
        </div>
        {weeks.map((week, index) => (
          <div key={`${week[0]}-${index}`} className="grid min-w-[740px] grid-cols-7 border-t border-neutral-100">
            {week.map((iso) => {
              const dayEvents = eventsByDate.get(iso) ?? [];
              const isCurrentMonth = new Date(`${iso}T00:00:00Z`).getUTCMonth() === month;
              const isSelected = iso === agendaDateIso;
              return (
                <button
                  key={iso}
                  type="button"
                  onClick={() => onSelectDate(iso)}
                  className={`min-h-24 cursor-pointer border-l border-neutral-100 px-2 py-2 text-left transition first:border-l-0 ${
                    isSelected ? "bg-sky-50" : "hover:bg-neutral-50"
                  }`}
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className={isCurrentMonth ? "font-semibold text-neutral-900" : "text-neutral-400"}>{Number(iso.slice(8, 10))}</span>
                    {dayEvents.length > 0 ? (
                      <span className="rounded-full bg-neutral-900 px-1.5 py-0.5 text-[10px] text-white">{dayEvents.length}</span>
                    ) : null}
                  </div>
                  <div className="mt-1 space-y-1">
                    {dayEvents.slice(0, 2).map((event) => (
                      <Link key={event.id} href={event.href} className="block cursor-pointer truncate rounded-lg border border-neutral-200 bg-white px-2 py-1 text-[10px] text-neutral-700 hover:border-sky-300">
                        {event.timeLabel} · {event.groupLabel}
                      </Link>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-neutral-200 bg-white p-3">
        <p className="text-sm font-semibold text-neutral-900">{formatDayLabel(agendaDateIso)}</p>
        <ul className="mt-2 space-y-2">
          {agendaEvents.length === 0 ? (
            <li className="text-sm text-neutral-500">На выбранный день занятий пока нет.</li>
          ) : (
            agendaEvents.map((event) => (
              <li key={event.id}>
                <Link href={event.href} className="landing-card block cursor-pointer p-3 hover:border-sky-300">
                  <p className="text-sm font-semibold text-neutral-900">{event.timeRangeLabel} · {event.groupLabel}</p>
                  <p className="text-xs text-neutral-600">{event.lessonTitle}</p>
                  <p className="mt-1 text-[11px] text-neutral-500">{event.formatLabel} · {event.statusLabel}</p>
                </Link>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
