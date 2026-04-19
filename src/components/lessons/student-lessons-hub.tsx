"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AppPageHeader } from "@/components/app/page-header";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { SurfaceCard } from "@/components/ui/surface-card";
import {
  addUtcDays,
  buildEventLaneLayout,
  getMonthMatrix,
  getVisibleHourRange,
  getWeekDays,
  type ScheduleViewMode,
} from "@/components/dashboard/teacher-schedule-utils";
import type {
  StudentLessonsHubEvent,
  StudentLessonsHubReadModel,
} from "@/lib/server/student-schedule";

const VISIBLE_VIEWS: Array<"day" | "week" | "month"> = ["day", "week", "month"];
const VIEW_LABELS: Record<"day" | "week" | "month", string> = {
  day: "День",
  week: "Неделя",
  month: "Месяц",
};
const WEEKDAY_SHORT = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const HOUR_WIDTH = 128;

function formatDayLabel(isoDate: string, compact = false) {
  return new Intl.DateTimeFormat("ru-RU", {
    weekday: compact ? "short" : "long",
    day: "numeric",
    month: compact ? "numeric" : "long",
    timeZone: "UTC",
  }).format(new Date(`${isoDate}T00:00:00Z`));
}

function shiftDateByView(current: string, view: ScheduleViewMode, delta: number) {
  if (view === "day") return addUtcDays(current, delta);
  if (view === "week") return addUtcDays(current, delta * 7);
  const date = new Date(`${current}T00:00:00Z`);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + delta, 1))
    .toISOString()
    .slice(0, 10);
}

function matchesFilter(event: StudentLessonsHubEvent, teacher: string, group: string) {
  const teacherMatch = teacher === "all" || event.teacherLabel === teacher;
  const groupMatch = group === "all" || event.groupLabel === group;
  return teacherMatch && groupMatch;
}

export function StudentLessonsHub({ hub }: { hub: StudentLessonsHubReadModel }) {
  const [viewMode, setViewMode] = useState<"day" | "week" | "month">("week");
  const [activeDateIso, setActiveDateIso] = useState(hub.defaultDateIso);
  const [monthAgendaIso, setMonthAgendaIso] = useState(hub.defaultDateIso);
  const [teacherFilter, setTeacherFilter] = useState("all");
  const [groupFilter, setGroupFilter] = useState("all");

  const filteredEvents = useMemo(
    () =>
      hub.events.filter((event) =>
        matchesFilter(event, teacherFilter, groupFilter),
      ),
    [groupFilter, hub.events, teacherFilter],
  );

  const rangeEvents = useMemo(() => {
    if (viewMode === "day") {
      return filteredEvents.filter((event) => event.isoDate === activeDateIso);
    }

    if (viewMode === "week") {
      const weekDays = getWeekDays(activeDateIso);
      return filteredEvents.filter((event) => weekDays.includes(event.isoDate));
    }

    const monthStart = new Date(`${activeDateIso}T00:00:00Z`);
    const startIso = new Date(
      Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth(), 1),
    )
      .toISOString()
      .slice(0, 10);
    const endIso = new Date(
      Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 1),
    )
      .toISOString()
      .slice(0, 10);

    return filteredEvents.filter(
      (event) => event.isoDate >= startIso && event.isoDate < endIso,
    );
  }, [activeDateIso, filteredEvents, viewMode]);

  return (
    <div className="space-y-6 lg:space-y-8">
      <AppPageHeader title="Расписание" />

      <SurfaceCard
        title="Уроки"
        description={`Всего: ${hub.totalLessons}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <SegmentedControl
              ariaLabel="Режим расписания"
              value={viewMode}
              onChange={(value) => setViewMode(value as "day" | "week" | "month")}
              items={VISIBLE_VIEWS.map((mode) => ({
                value: mode,
                label: VIEW_LABELS[mode],
              }))}
            />
            <button
              type="button"
              onClick={() => setActiveDateIso(hub.defaultDateIso)}
              className="rounded-full border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
            >
              Сегодня
            </button>
            <button
              type="button"
              onClick={() => setActiveDateIso(shiftDateByView(activeDateIso, viewMode, -1))}
              className="rounded-full border border-neutral-200 px-3 py-1 text-sm"
              aria-label="Предыдущий диапазон"
            >
              ←
            </button>
            <input
              type="date"
              value={activeDateIso}
              onChange={(event) => setActiveDateIso(event.target.value)}
              className="rounded-xl border border-neutral-300 px-3 py-1.5 text-sm"
              aria-label="Выбранная дата"
            />
            <button
              type="button"
              onClick={() => setActiveDateIso(shiftDateByView(activeDateIso, viewMode, 1))}
              className="rounded-full border border-neutral-200 px-3 py-1 text-sm"
              aria-label="Следующий диапазон"
            >
              →
            </button>
            <select
              value={teacherFilter}
              onChange={(event) => setTeacherFilter(event.target.value)}
              className="rounded-xl border border-neutral-300 px-2.5 py-1.5 text-xs"
              aria-label="Фильтр по преподавателю"
            >
              <option value="all">Все преподаватели</option>
              {hub.teacherOptions.map((label) => (
                <option key={label} value={label}>
                  {label}
                </option>
              ))}
            </select>
            <select
              value={groupFilter}
              onChange={(event) => setGroupFilter(event.target.value)}
              className="rounded-xl border border-neutral-300 px-2.5 py-1.5 text-xs"
              aria-label="Фильтр по группе"
            >
              <option value="all">Все группы</option>
              {hub.groupOptions.map((label) => (
                <option key={label} value={label}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        }
      >
        {viewMode === "day" ? (
          <StudentDayView
            activeDateIso={activeDateIso}
            events={filteredEvents}
            nowIso={hub.nowIso}
            onDayPick={setActiveDateIso}
          />
        ) : null}
        {viewMode === "week" ? (
          <StudentWeekView
            activeDateIso={activeDateIso}
            events={filteredEvents}
            nowIso={hub.nowIso}
          />
        ) : null}
        {viewMode === "month" ? (
          <StudentMonthView
            activeDateIso={activeDateIso}
            agendaDateIso={monthAgendaIso}
            events={filteredEvents}
            onSelectDate={setMonthAgendaIso}
          />
        ) : null}

        {viewMode === "month" ? (
          <div className="mt-4 rounded-2xl border border-neutral-200 bg-white p-3">
            <p className="text-sm font-semibold text-neutral-900">{formatDayLabel(monthAgendaIso)}</p>
            <ul className="mt-2 space-y-2">
              {filteredEvents.filter((item) => item.isoDate === monthAgendaIso).length === 0 ? (
                <li className="text-sm text-neutral-500">На выбранный день занятий пока нет.</li>
              ) : (
                filteredEvents
                  .filter((item) => item.isoDate === monthAgendaIso)
                  .map((event) => (
                    <li key={event.id}>
                      <LessonEventCard event={event} compact />
                    </li>
                  ))
              )}
            </ul>
          </div>
        ) : null}

        {rangeEvents.length === 0 ? (
          <p className="mt-3 text-sm text-neutral-500">По выбранным фильтрам занятий нет.</p>
        ) : null}
      </SurfaceCard>
    </div>
  );
}

function LessonEventCard({
  event,
  compact = false,
}: {
  event: StudentLessonsHubEvent;
  compact?: boolean;
}) {
  return (
    <Link
      href={event.href}
      className="block rounded-2xl border border-neutral-200 bg-white p-3 transition hover:border-sky-300"
    >
      <p className="text-sm font-semibold text-neutral-900">{event.lessonTitle}</p>
      <p className="mt-1 text-xs text-neutral-600">
        {event.timeRangeLabel} · {event.statusLabel} · {event.formatLabel}
      </p>
      <p className="mt-1 text-xs text-neutral-500">
        Группа: {event.groupLabel} · Преподаватель: {event.teacherLabel}
      </p>
      {event.homework ? (
        <div className="mt-2 rounded-xl border border-neutral-200 bg-neutral-50 px-2.5 py-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-neutral-500">
            Домашнее задание
          </p>
          <p className="text-xs font-medium text-neutral-800">{event.homework.title}</p>
          <p className="text-[11px] text-neutral-600">
            {event.homework.statusLabel} · Срок: {event.homework.dueAtLabel}
          </p>
        </div>
      ) : null}
      <p className={`mt-2 text-xs font-semibold text-sky-700 ${compact ? "" : "sm:text-sm"}`}>
        Открыть урок
      </p>
    </Link>
  );
}

function StudentDayView({
  activeDateIso,
  events,
  nowIso,
  onDayPick,
}: {
  activeDateIso: string;
  events: StudentLessonsHubEvent[];
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
            className={`shrink-0 rounded-2xl border px-3 py-2 text-left text-xs font-semibold transition ${
              iso === activeDateIso
                ? "border-neutral-900 bg-neutral-900 text-white"
                : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50"
            }`}
          >
            <div>
              {WEEKDAY_SHORT[(new Date(`${iso}T00:00:00Z`).getUTCDay() + 6) % 7]} · {iso.slice(8, 10)}
            </div>
          </button>
        ))}
      </div>
      <StudentTimeGrid days={[activeDateIso]} events={dayEvents} nowIso={nowIso} hourRange={hourRange} />
    </div>
  );
}

function StudentWeekView({
  activeDateIso,
  events,
  nowIso,
}: {
  activeDateIso: string;
  events: StudentLessonsHubEvent[];
  nowIso: string;
}) {
  const weekDays = getWeekDays(activeDateIso);
  const weekEvents = events.filter((event) => weekDays.includes(event.isoDate));
  const hourRange = getVisibleHourRange(weekEvents);

  return <StudentTimeGrid days={weekDays} events={weekEvents} nowIso={nowIso} hourRange={hourRange} />;
}

function StudentTimeGrid({
  days,
  events,
  nowIso,
  hourRange,
}: {
  days: string[];
  events: StudentLessonsHubEvent[];
  nowIso: string;
  hourRange: { startHour: number; endHour: number };
}) {
  const laneLayout = buildEventLaneLayout(events);
  const laneById = new Map(laneLayout.map((item) => [item.id, item]));
  const marks = Array.from(
    { length: hourRange.endHour - hourRange.startHour + 1 },
    (_, index) => hourRange.startHour + index,
  );
  const nowTs = Date.parse(nowIso);

  return (
    <div className="overflow-x-auto rounded-2xl border border-neutral-200 bg-white">
      <div
        className="grid min-w-[780px]"
        style={{ gridTemplateColumns: `120px repeat(${days.length}, 1fr)` }}
      >
        <div className="border-b border-neutral-200 p-2 text-xs font-semibold text-neutral-500">Время</div>
        {days.map((day) => (
          <div key={day} className="border-b border-l border-neutral-200 p-2 text-xs font-semibold text-neutral-600">
            {formatDayLabel(day, true)}
          </div>
        ))}

        <div className="border-r border-neutral-200 px-2 py-3">
          <div className="relative" style={{ height: `${(hourRange.endHour - hourRange.startHour) * 62}px` }}>
            {marks.map((hour, index) => (
              <div key={hour} className="absolute left-0 right-0 text-[11px] text-neutral-500" style={{ top: `${index * 62 - 8}px` }}>
                {`${String(hour).padStart(2, "0")}:00`}
              </div>
            ))}
          </div>
        </div>

        {days.map((day) => {
          const dayEvents = events.filter((event) => event.isoDate === day);
          return (
            <div key={day} className="relative border-l border-neutral-200 p-2" style={{ minHeight: `${(hourRange.endHour - hourRange.startHour) * 62}px` }}>
              {marks.map((_, index) => (
                <div key={index} className="absolute left-0 right-0 border-t border-dashed border-neutral-100" style={{ top: `${index * 62}px` }} />
              ))}
              {dayEvents.map((event) => {
                const start = new Date(event.startsAt);
                const end = new Date(event.endsAt);
                const startMinutes = start.getUTCHours() * 60 + start.getUTCMinutes();
                const endMinutes = end.getUTCHours() * 60 + end.getUTCMinutes();
                const top = ((startMinutes - hourRange.startHour * 60) / 60) * 62;
                const height = Math.max(52, ((endMinutes - startMinutes) / 60) * 62);
                const lane = laneById.get(event.id);
                const laneCount = Math.max(lane?.laneCount ?? 1, 1);
                const laneIndex = lane?.laneIndex ?? 0;
                const width = `calc(${100 / laneCount}% - 6px)`;
                const left = `calc(${(100 / laneCount) * laneIndex}% + 3px)`;
                const isNow = Date.parse(event.startsAt) <= nowTs && Date.parse(event.endsAt) >= nowTs;

                return (
                  <div
                    key={event.id}
                    className={`absolute overflow-hidden rounded-xl border p-2 ${isNow ? "border-sky-300 bg-sky-50" : "border-neutral-200 bg-white"}`}
                    style={{ top: `${top}px`, height: `${height}px`, width, left }}
                  >
                    <Link href={event.href} className="block h-full">
                      <p className="truncate text-xs font-semibold text-neutral-900">{event.lessonTitle}</p>
                      <p className="text-[11px] text-neutral-600">{event.timeRangeLabel}</p>
                      <p className="truncate text-[11px] text-neutral-500">{event.groupLabel}</p>
                      {event.homework ? (
                        <p className="mt-1 truncate text-[10px] font-semibold text-neutral-600">Домашнее задание</p>
                      ) : null}
                    </Link>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StudentMonthView({
  activeDateIso,
  agendaDateIso,
  events,
  onSelectDate,
}: {
  activeDateIso: string;
  agendaDateIso: string;
  events: StudentLessonsHubEvent[];
  onSelectDate: (iso: string) => void;
}) {
  const matrix = getMonthMatrix(activeDateIso);
  const activeMonth = new Date(`${activeDateIso}T00:00:00Z`).getUTCMonth();

  return (
    <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
      <div className="grid grid-cols-7 border-b border-neutral-200 bg-neutral-50 text-center text-xs font-semibold text-neutral-500">
        {WEEKDAY_SHORT.map((label) => (
          <div key={label} className="px-2 py-2">{label}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {matrix.weeks.flat().map((iso) => {
          const month = new Date(`${iso}T00:00:00Z`).getUTCMonth();
          const dayEvents = events.filter((event) => event.isoDate === iso);
          const inMonth = month === activeMonth;
          const isSelected = iso === agendaDateIso;

          return (
            <button
              key={iso}
              type="button"
              onClick={() => onSelectDate(iso)}
              className={`min-h-20 border-r border-b border-neutral-100 px-2 py-2 text-left transition ${
                isSelected
                  ? "bg-sky-50"
                  : inMonth
                    ? "bg-white hover:bg-neutral-50"
                    : "bg-neutral-50/70 text-neutral-400"
              }`}
            >
              <div className="text-xs font-semibold">{Number(iso.slice(8, 10))}</div>
              {dayEvents.length > 0 ? (
                <div className="mt-1 inline-flex rounded-full bg-neutral-900 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                  {dayEvents.length}
                </div>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
