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
  getMonthMatrix,
  getRangeByView,
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
              {(["day", "week", "month", "list"] as ScheduleViewMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setViewMode(mode)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
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
            <ul className="space-y-2">
              {rangeEvents.length === 0 ? <li className="text-sm text-neutral-500">На выбранный день занятий нет.</li> : rangeEvents.map((event) => (
                <li key={event.id}><Link href={event.href} className="landing-card block p-3">{event.timeRangeLabel} · {event.groupLabel}</Link></li>
              ))}
            </ul>
          ) : null}

          {viewMode === "week" ? (
            <div className="grid gap-2 md:grid-cols-7">
              {getWeekDays(activeDateIso).map((day) => {
                const dayEvents = rangeEvents.filter((event) => event.isoDate === day);
                return (
                  <div key={day} className="rounded-xl border border-neutral-200 p-2">
                    <p className="text-xs font-semibold text-neutral-600">{formatDayLabel(day, true)}</p>
                    <div className="mt-2 space-y-1">
                      {dayEvents.length === 0 ? <p className="text-[11px] text-neutral-400">—</p> : dayEvents.map((event) => (
                        <Link key={event.id} href={event.href} className="block truncate rounded-lg bg-sky-50 px-2 py-1 text-[11px] text-sky-800">{event.timeLabel} · {event.groupLabel}</Link>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}

          {viewMode === "month" ? (
            <div className="space-y-3">
              <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-neutral-500">
                {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((day) => <div key={day}>{day}</div>)}
              </div>
              {getMonthMatrix(activeDateIso).weeks.map((week) => (
                <div key={week[0]} className="grid grid-cols-7 gap-1">
                  {week.map((day) => {
                    const dayEvents = filteredEvents.filter((event) => event.isoDate === day);
                    return (
                      <button key={day} type="button" onClick={() => setMonthAgendaIso(day)} className={`min-h-20 rounded-lg border px-2 py-1 text-left ${monthAgendaIso === day ? "border-sky-400 bg-sky-50" : "border-neutral-200"}`}>
                        <p className="text-xs font-semibold text-neutral-700">{Number(day.slice(8, 10))}</p>
                        {dayEvents.length > 0 ? <p className="text-[10px] text-neutral-500">{dayEvents.length} зан.</p> : null}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
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
