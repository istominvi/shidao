"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AppCard } from "@/components/app/app-card";
import { AppPageHeader } from "@/components/app/page-header";
import { ROUTES } from "@/lib/auth";
import type { TeacherLessonsHubReadModel } from "@/lib/server/teacher-lessons-hub";
import {
  addUtcDays,
  buildEventLaneLayout,
  getMonthMatrix,
  getRangeByView,
  getVisibleHourRange,
  getWeekDays,
  type ScheduleViewMode,
} from "@/components/dashboard/teacher-schedule-utils";

type TeacherLessonsHubProps = {
  hub: TeacherLessonsHubReadModel;
  createLessonAction: (formData: FormData) => Promise<void>;
  feedback?: {
    success?: string;
    error?: string;
  };
  hasExplicitViewParam: boolean;
  initialState: {
    view: ScheduleViewMode;
    date: string;
    search: string;
    classId: string;
    methodologyLessonId: string;
    format: "" | "online" | "offline";
    status: "" | "planned" | "in_progress" | "completed" | "cancelled";
  };
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
type LessonScheduleEvent = TeacherLessonsHubReadModel["schedule"]["events"][number];

function formatDayLabel(isoDate: string, compact = false) {
  return new Intl.DateTimeFormat("ru-RU", {
    weekday: compact ? "short" : "long",
    day: "numeric",
    month: compact ? "numeric" : "long",
    timeZone: "UTC",
  }).format(new Date(`${isoDate}T00:00:00Z`));
}

function startOfMonth(isoDate: string) {
  const [year, month] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(year!, (month ?? 1) - 1, 1)).toISOString().slice(0, 10);
}

function endOfMonthExclusive(isoDate: string) {
  const [year, month] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(year!, month ?? 1, 1)).toISOString().slice(0, 10);
}

function shiftDateByView(current: string, view: ScheduleViewMode, delta: number) {
  if (view === "day") return addUtcDays(current, delta);
  if (view === "week") return addUtcDays(current, delta * 7);
  if (view === "month") {
    const date = new Date(`${current}T00:00:00Z`);
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + delta, 1))
      .toISOString()
      .slice(0, 10);
  }
  return addUtcDays(current, delta * 7);
}

export function TeacherLessonsHub({
  hub,
  createLessonAction,
  feedback,
  initialState,
  hasExplicitViewParam,
}: TeacherLessonsHubProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [viewMode, setViewMode] = useState<ScheduleViewMode>(initialState.view);
  const [activeDateIso, setActiveDateIso] = useState(initialState.date);
  const [monthAgendaIso, setMonthAgendaIso] = useState(initialState.date);
  const [search, setSearch] = useState(initialState.search);
  const [classId, setClassId] = useState(initialState.classId);
  const [methodologyLessonId, setMethodologyLessonId] = useState(initialState.methodologyLessonId);
  const [format, setFormat] = useState(initialState.format);
  const [status, setStatus] = useState(initialState.status);
  const [scheduleFormat, setScheduleFormat] = useState<"online" | "offline">("online");

  useEffect(() => {
    if (hasExplicitViewParam) return;
    const media = window.matchMedia("(max-width: 767px)");
    if (media.matches) {
      setViewMode("list");
    }
  }, [hasExplicitViewParam]);

  useEffect(() => {
    const params = new URLSearchParams();
    params.set("view", viewMode);
    params.set("date", activeDateIso);
    if (search.trim()) params.set("search", search.trim());
    if (classId) params.set("classId", classId);
    if (methodologyLessonId) params.set("methodologyLessonId", methodologyLessonId);
    if (format) params.set("format", format);
    if (status) params.set("status", status);
    if (feedback?.error) params.set("error", feedback.error);
    if (feedback?.success) params.set("saved", feedback.success);

    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [activeDateIso, classId, feedback?.error, feedback?.success, format, methodologyLessonId, pathname, router, search, status, viewMode]);

  const filteredEvents = useMemo(() => {
    const query = search.trim().toLowerCase();
    return hub.schedule.events.filter((event) => {
      if (classId && event.classId !== classId) return false;
      if (methodologyLessonId && event.methodologyLessonId !== methodologyLessonId) return false;
      if (format && event.format !== format) return false;
      if (status && event.status !== status) return false;
      if (
        query &&
        !event.groupLabel.toLowerCase().includes(query) &&
        !event.lessonTitle.toLowerCase().includes(query)
      ) {
        return false;
      }
      return true;
    });
  }, [classId, format, hub.schedule.events, methodologyLessonId, search, status]);

  const range = useMemo(() => {
    if (viewMode === "month") {
      return {
        startIso: startOfMonth(activeDateIso),
        endIsoExclusive: endOfMonthExclusive(activeDateIso),
      };
    }
    return getRangeByView(viewMode, activeDateIso);
  }, [activeDateIso, viewMode]);

  const rangeEvents = useMemo(() => {
    if (viewMode === "list") {
      return filteredEvents.slice().sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
    }

    return filteredEvents
      .filter((event) => event.isoDate >= range.startIso && event.isoDate < range.endIsoExclusive)
      .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
  }, [filteredEvents, range.endIsoExclusive, range.startIso, viewMode]);

  const detailEvents = useMemo(() => {
    if (viewMode === "month") {
      return filteredEvents
        .filter((event) => event.isoDate === monthAgendaIso)
        .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
    }

    return rangeEvents;
  }, [filteredEvents, monthAgendaIso, rangeEvents, viewMode]);

  return (
    <div className="space-y-6 lg:space-y-8">
      <AppPageHeader
        title="Расписание"
        description="Все занятия по вашим группам в одном месте."
        actions={(
          <div className="flex items-center gap-3 text-sm">
            <button
              type="button"
              onClick={() => setActiveDateIso(hub.schedule.defaultDateIso)}
              className="rounded-full border border-neutral-300 bg-white px-3 py-1.5 font-semibold text-neutral-700 hover:bg-neutral-50"
            >
              Сегодня
            </button>
            <Link href={ROUTES.groups} className="font-semibold text-sky-700 underline underline-offset-2">
              К группам
            </Link>
          </div>
        )}
      />

      <AppCard className="p-4 md:p-5">
        <div className="flex flex-col gap-3">
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
            <div className="ml-auto inline-flex items-center gap-2">
              <button type="button" onClick={() => setActiveDateIso(shiftDateByView(activeDateIso, viewMode, -1))} className="rounded-full border border-neutral-200 px-3 py-1 text-sm">←</button>
              <input type="date" value={activeDateIso} onChange={(event) => setActiveDateIso(event.target.value)} className="rounded-xl border border-neutral-300 px-3 py-1.5 text-sm" />
              <button type="button" onClick={() => setActiveDateIso(shiftDateByView(activeDateIso, viewMode, 1))} className="rounded-full border border-neutral-200 px-3 py-1 text-sm">→</button>
            </div>
          </div>

          <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-5">
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Поиск по группе или уроку"
              className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm lg:col-span-2"
            />
            <select value={classId} onChange={(event) => setClassId(event.target.value)} className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm">
              <option value="">Все группы</option>
              {hub.schedule.filters.classOptions.map((option) => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </select>
            <select value={methodologyLessonId} onChange={(event) => setMethodologyLessonId(event.target.value)} className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm">
              <option value="">Все уроки методики</option>
              {hub.schedule.filters.methodologyOptions.map((option) => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <select value={format} onChange={(event) => setFormat(event.target.value as typeof format)} className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm">
                <option value="">Формат</option>
                {hub.schedule.filters.formatOptions.map((option) => (
                  <option key={option.id} value={option.id}>{option.label}</option>
                ))}
              </select>
              <select value={status} onChange={(event) => setStatus(event.target.value as typeof status)} className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm">
                <option value="">Статус</option>
                {hub.schedule.filters.statusOptions.map((option) => (
                  <option key={option.id} value={option.id}>{option.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-neutral-200 bg-white p-3">
          {viewMode === "list" ? (
            <ul className="space-y-2">
              {rangeEvents.length === 0 ? <li className="text-sm text-neutral-500">Занятий по текущим фильтрам нет.</li> : rangeEvents.map((event) => (
                <li key={event.id}>
                  <Link href={event.href} className="landing-card block p-3 hover:border-sky-300">
                    <p className="text-sm font-semibold text-neutral-900">{formatDayLabel(event.isoDate)} · {event.timeRangeLabel}</p>
                    <p className="text-xs text-neutral-600">{event.groupLabel} · {event.lessonTitle}</p>
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}

          {viewMode === "day" ? (
            <LessonsDayView
              activeDateIso={activeDateIso}
              events={filteredEvents}
              nowIso={hub.schedule.nowIso}
              onDayPick={setActiveDateIso}
            />
          ) : null}

          {viewMode === "week" ? (
            <LessonsWeekView activeDateIso={activeDateIso} events={filteredEvents} nowIso={hub.schedule.nowIso} />
          ) : null}

          {viewMode === "month" ? (
            <LessonsMonthView
              activeDateIso={activeDateIso}
              agendaDateIso={monthAgendaIso}
              events={filteredEvents}
              onSelectDate={setMonthAgendaIso}
            />
          ) : null}
        </div>
      </AppCard>

      <AppCard className="p-4 md:p-5">
        <h2 className="text-lg font-bold text-neutral-950">
          {viewMode === "month" ? `План на ${formatDayLabel(monthAgendaIso)}` : "Занятия в выбранном диапазоне"}
        </h2>
        <ul className="mt-3 space-y-2">
          {detailEvents.length === 0 ? (
            <li className="text-sm text-neutral-500">Нет занятий по текущему контексту.</li>
          ) : (
            detailEvents.map((event) => (
              <li key={event.id}>
                <Link href={event.href} className="landing-card block p-3 hover:border-sky-300">
                  <p className="text-sm font-semibold text-neutral-900">{event.timeRangeLabel} · {event.groupLabel}</p>
                  <p className="text-xs text-neutral-600">{event.lessonTitle}</p>
                  <p className="mt-1 text-[11px] text-neutral-500">{event.formatLabel} · {event.statusLabel}</p>
                </Link>
              </li>
            ))
          )}
        </ul>
      </AppCard>

      <AppCard className="p-5 md:p-6">
        <details>
          <summary className="cursor-pointer list-none text-base font-bold text-neutral-950">
            Запланировать занятие
          </summary>
          <div className="mt-3">
            {feedback?.success ? (
              <p className="mb-3 rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                {feedback.success}
              </p>
            ) : null}

            {feedback?.error ? (
              <p className="mb-3 rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                {feedback.error}
              </p>
            ) : null}

            <form action={createLessonAction} className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1 text-sm text-neutral-700">
                <span>Группа</span>
                <select name="classId" required className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm" defaultValue="">
                  <option value="" disabled>Выберите группу</option>
                  {hub.classOptions.map((option) => (
                    <option key={option.id} value={option.id}>{option.label}</option>
                  ))}
                </select>
              </label>

              <label className="space-y-1 text-sm text-neutral-700">
                <span>Методологический урок</span>
                <select name="methodologyLessonId" required className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm" defaultValue="">
                  <option value="" disabled>Выберите урок</option>
                  {hub.methodologyOptions.map((option) => (
                    <option key={option.id} value={option.id}>{option.label}</option>
                  ))}
                </select>
              </label>

              <label className="space-y-1 text-sm text-neutral-700">
                <span>Дата</span>
                <input type="date" name="date" required className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm" />
              </label>

              <label className="space-y-1 text-sm text-neutral-700">
                <span>Время</span>
                <input type="time" name="time" required className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm" />
              </label>

              <label className="space-y-1 text-sm text-neutral-700">
                <span>Формат</span>
                <select name="format" required className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm" value={scheduleFormat} onChange={(event) => setScheduleFormat(event.target.value as "online" | "offline")}>
                  <option value="online">Онлайн</option>
                  <option value="offline">Офлайн</option>
                </select>
              </label>

              {scheduleFormat === "online" ? (
                <label className="space-y-1 text-sm text-neutral-700">
                  <span>Ссылка на встречу</span>
                  <input type="url" name="meetingLink" placeholder="https://" className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm" required />
                </label>
              ) : (
                <label className="space-y-1 text-sm text-neutral-700">
                  <span>Место проведения</span>
                  <input type="text" name="place" placeholder="Кабинет / адрес" className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm" required />
                </label>
              )}

              <div className="md:col-span-2">
                <button type="submit" className="inline-flex items-center rounded-full bg-sky-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-sky-500">
                  Запланировать занятие
                </button>
              </div>
            </form>
          </div>
        </details>
      </AppCard>
    </div>
  );
}

function LessonsDayView({
  activeDateIso,
  events,
  nowIso,
  onDayPick,
}: {
  activeDateIso: string;
  events: LessonScheduleEvent[];
  nowIso: string;
  onDayPick: (iso: string) => void;
}) {
  const weekDays = getWeekDays(activeDateIso);
  const dayEvents = events.filter((event) => event.isoDate === activeDateIso);
  const hourRange = getVisibleHourRange(dayEvents);
  const visibleStartMinutes = hourRange.startHour * 60;
  const timelineWidth = (hourRange.endHour - hourRange.startHour) * HOUR_WIDTH;
  const laneLayout = buildEventLaneLayout(dayEvents);
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
              <div className="pointer-events-none absolute bottom-0 top-0 z-20 border-l border-rose-400" style={{ left: `${((nowMinutes - visibleStartMinutes) / 60) * HOUR_WIDTH + 12}px` }}>
                <span className="-ml-3 rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">Сейчас</span>
              </div>
            ) : null}

            {dayEvents.map((event) => {
              const start = new Date(event.startsAt);
              const end = new Date(event.endsAt);
              const startMinutes = start.getUTCHours() * 60 + start.getUTCMinutes();
              const endMinutes = end.getUTCHours() * 60 + end.getUTCMinutes();
              const left = ((startMinutes - visibleStartMinutes) / 60) * HOUR_WIDTH + 16;
              const width = Math.max(80, ((endMinutes - startMinutes) / 60) * HOUR_WIDTH - 8);
              const lane = laneById.get(event.id);
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
    </div>
  );
}

function LessonsWeekView({
  activeDateIso,
  events,
  nowIso,
}: {
  activeDateIso: string;
  events: LessonScheduleEvent[];
  nowIso: string;
}) {
  const weekDays = getWeekDays(activeDateIso);
  const weekEvents = events.filter((event) => weekDays.includes(event.isoDate));
  const hourRange = getVisibleHourRange(weekEvents);
  const hours = Array.from({ length: hourRange.endHour - hourRange.startHour + 1 }, (_, i) => hourRange.startHour + i);
  const gridHeight = (hourRange.endHour - hourRange.startHour) * HOUR_HEIGHT;
  const eventsByDay = new Map<string, LessonScheduleEvent[]>();

  for (const day of weekDays) eventsByDay.set(day, []);
  for (const event of weekEvents) {
    eventsByDay.get(event.isoDate)?.push(event);
  }

  const now = new Date(nowIso);
  const nowDay = nowIso.slice(0, 10);
  const nowMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  const visibleStartMinutes = hourRange.startHour * 60;

  return (
    <div className="overflow-x-auto rounded-2xl border border-neutral-200 bg-white">
      <div className="grid min-w-[720px] grid-cols-[64px_repeat(7,minmax(140px,1fr))]">
        <div className="border-b border-neutral-200 bg-neutral-50 p-2 text-xs font-semibold text-neutral-600" />
        {weekDays.map((day) => (
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

        {weekDays.map((day) => {
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
                  <div className="pointer-events-none absolute left-0 right-0 z-20 border-t border-rose-400" style={{ top: `${((nowMinutes - visibleStartMinutes) / 60) * HOUR_HEIGHT}px` }}>
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
                      style={{ top: `${top}px`, left: `${left + 1}%`, width: `calc(${laneWidth}% - 2%)`, height: `${height}px` }}
                    >
                      <p className="truncate font-semibold text-neutral-900">{event.groupLabel}</p>
                      <p className="truncate text-[11px]">{event.lessonTitle}</p>
                      <p className="mt-0.5 text-[11px] text-neutral-500">{event.timeRangeLabel}</p>
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

function LessonsMonthView({
  activeDateIso,
  agendaDateIso,
  events,
  onSelectDate,
}: {
  activeDateIso: string;
  agendaDateIso: string;
  events: LessonScheduleEvent[];
  onSelectDate: (isoDate: string) => void;
}) {
  const { weeks, month } = getMonthMatrix(activeDateIso);
  const eventsByDate = new Map<string, LessonScheduleEvent[]>();
  for (const event of events) {
    const bucket = eventsByDate.get(event.isoDate) ?? [];
    bucket.push(event);
    eventsByDate.set(event.isoDate, bucket);
  }

  return (
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
  );
}
