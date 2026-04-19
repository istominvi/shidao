"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Rows3, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AppPageHeader } from "@/components/app/page-header";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Select } from "@/components/ui/input";
import { SurfaceCard } from "@/components/ui/surface-card";
import type { ScheduleViewMode } from "@/components/dashboard/teacher-schedule-utils";
import { getMonthMatrix } from "@/components/dashboard/teacher-schedule-utils";
import type { TeacherLessonsHubReadModel } from "@/lib/server/teacher-lessons-hub";

type TeacherLessonsHubProps = {
  hub: TeacherLessonsHubReadModel;
  createLessonAction: (formData: FormData) => Promise<void>;
  feedback?: {
    success?: string;
    error?: string;
  };
  initialState: {
    view: ScheduleViewMode;
    date: string;
  };
};

export function TeacherLessonsHub({
  hub,
  createLessonAction,
  feedback,
  initialState,
}: TeacherLessonsHubProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [view, setView] = useState<ScheduleViewMode>(initialState.view);
  const [date, setDate] = useState(initialState.date);
  const [scheduleFormat, setScheduleFormat] = useState<"online" | "offline">("online");

  useEffect(() => {
    const params = new URLSearchParams();
    params.set("view", view);
    params.set("date", date);
    if (feedback?.error) params.set("error", feedback.error);
    if (feedback?.success) params.set("saved", feedback.success);

    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [date, feedback?.error, feedback?.success, pathname, router, view]);

  return (
    <div className="space-y-6 lg:space-y-8">
      <AppPageHeader title="Расписание" />

      <TeacherLessonsSchedule
        events={hub.schedule.events}
        nowIso={hub.schedule.nowIso}
        initialView={initialState.view}
        onStateChange={(state) => {
          setView(state.view);
          setDate(state.date);
        }}
      />

      <SurfaceCard title="Запланировать занятие">
        <details>
          <summary className="cursor-pointer list-none text-sm font-semibold text-neutral-700">
            Открыть форму
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
      </SurfaceCard>
    </div>
  );
}

const DISPLAY_MODES = ["table", "calendar"] as const;
const DISPLAY_MODE_LABELS: Record<(typeof DISPLAY_MODES)[number], string> = {
  table: "Таблица",
  calendar: "Календарь",
};
const WEEKDAY_SHORT = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

type TeacherLessonsScheduleProps = {
  events: TeacherLessonsHubReadModel["schedule"]["events"];
  nowIso: string;
  initialView: ScheduleViewMode;
  onStateChange?: (state: { view: ScheduleViewMode; date: string }) => void;
};

function formatDayLabel(isoDate: string, compact = false) {
  return new Intl.DateTimeFormat("ru-RU", {
    weekday: compact ? "short" : "long",
    day: "numeric",
    month: compact ? "numeric" : "long",
    timeZone: "UTC",
  }).format(new Date(`${isoDate}T00:00:00Z`));
}

function formatDateCell(isoDate: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${isoDate}T00:00:00Z`));
}

function formatMonthLabel(isoDate: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  })
    .format(new Date(`${isoDate}T00:00:00Z`))
    .replace(/\sг\.$/u, "");
}

function shiftMonth(current: string, delta: number) {
  const date = new Date(`${current}T00:00:00Z`);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + delta, 1))
    .toISOString()
    .slice(0, 10);
}

function isNowActive(event: TeacherLessonsHubReadModel["schedule"]["events"][number], nowTs: number) {
  return Date.parse(event.startsAt) <= nowTs && Date.parse(event.endsAt) >= nowTs;
}

function TeacherLessonsSchedule({
  events,
  nowIso,
  initialView,
  onStateChange,
}: TeacherLessonsScheduleProps) {
  const [displayMode, setDisplayMode] = useState<(typeof DISPLAY_MODES)[number]>(
    initialView === "month" ? "calendar" : "table",
  );
  const [activeDateIso, setActiveDateIso] = useState(nowIso.slice(0, 10));
  const [monthDialogIso, setMonthDialogIso] = useState<string | null>(null);
  const [groupFilter, setGroupFilter] = useState("all");

  const groupOptions = useMemo(
    () => Array.from(new Set(events.map((event) => event.groupLabel))),
    [events],
  );

  const filteredEvents = useMemo(
    () => events.filter((event) => groupFilter === "all" || event.groupLabel === groupFilter),
    [events, groupFilter],
  );

  const sortedFilteredEvents = useMemo(
    () => filteredEvents.slice().sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt)),
    [filteredEvents],
  );

  const tableEvents = useMemo(
    () => sortedFilteredEvents.slice().sort((a, b) => Date.parse(b.startsAt) - Date.parse(a.startsAt)),
    [sortedFilteredEvents],
  );

  const monthEvents = useMemo(() => {
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

    return sortedFilteredEvents.filter(
      (event) => event.isoDate >= startIso && event.isoDate < endIso,
    );
  }, [activeDateIso, sortedFilteredEvents]);

  useEffect(() => {
    onStateChange?.({
      view: displayMode === "calendar" ? "month" : "week",
      date: activeDateIso,
    });
  }, [activeDateIso, displayMode, onStateChange]);

  return (
    <SurfaceCard
      title={
        <span className="inline-flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span>Уроки</span>
          <span className="text-sm font-semibold text-neutral-500">
            Всего: {events.length} · По фильтрам: {filteredEvents.length}
          </span>
        </span>
      }
      bodyClassName="mt-5"
    >
      <div className="product-control-rail">
        <SegmentedControl
          ariaLabel="Режим отображения"
          value={displayMode}
          onChange={(value) => setDisplayMode(value as (typeof DISPLAY_MODES)[number])}
          items={DISPLAY_MODES.map((mode) => ({
            value: mode,
            label: DISPLAY_MODE_LABELS[mode],
            icon: mode === "table" ? Rows3 : CalendarDays,
          }))}
        />

        <div className="product-select-wrap">
          <Select
            value={groupFilter}
            onChange={(event) => setGroupFilter(event.target.value)}
            className="min-w-[11rem]"
            aria-label="Фильтр по группе"
          >
            <option value="all">Все группы</option>
            {groupOptions.map((label) => (
              <option key={label} value={label}>
                {label}
              </option>
            ))}
          </Select>
          <ChevronDown className="product-select-icon h-4 w-4" aria-hidden="true" />
        </div>

        {displayMode === "calendar" ? (
          <div className="product-control inline-flex min-w-[230px] items-center gap-1 px-1.5">
            <button
              type="button"
              onClick={() => setActiveDateIso(shiftMonth(activeDateIso, -1))}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-black/10 text-sm hover:bg-neutral-50"
              aria-label="Предыдущий месяц"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="min-w-[140px] flex-1 px-1 text-center text-sm font-medium capitalize text-neutral-700">
              {formatMonthLabel(activeDateIso)}
            </span>
            <button
              type="button"
              onClick={() => setActiveDateIso(shiftMonth(activeDateIso, 1))}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-black/10 text-sm hover:bg-neutral-50"
              aria-label="Следующий месяц"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        ) : null}
      </div>

      <div className="mt-5">
        {displayMode === "table" ? (
          <TeacherLessonsTable events={tableEvents} nowIso={nowIso} />
        ) : (
          <>
            <TeacherMonthView
              activeDateIso={activeDateIso}
              events={sortedFilteredEvents}
              onOpenDay={setMonthDialogIso}
            />
            <TeacherMonthDialog
              isoDate={monthDialogIso}
              events={sortedFilteredEvents}
              nowIso={nowIso}
              onClose={() => setMonthDialogIso(null)}
            />
          </>
        )}
      </div>

      {(displayMode === "table" && sortedFilteredEvents.length === 0) ||
      (displayMode === "calendar" && monthEvents.length === 0) ? (
        <p className="mt-3 text-sm text-neutral-500">По выбранным фильтрам занятий нет.</p>
      ) : null}
    </SurfaceCard>
  );
}

function TeacherLessonsTable({
  events,
  nowIso,
}: {
  events: TeacherLessonsHubReadModel["schedule"]["events"];
  nowIso: string;
}) {
  const router = useRouter();
  const nowTs = Date.parse(nowIso);

  return (
    <>
      <div className="hidden overflow-x-auto rounded-2xl border border-neutral-200 bg-white md:block">
        <table className="min-w-full divide-y divide-neutral-200 text-sm">
          <thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
            <tr className="h-10">
              <th className="px-4 py-0 text-left align-middle">Дата</th>
              <th className="px-4 py-0 text-left align-middle">Время</th>
              <th className="px-4 py-0 text-left align-middle">Урок</th>
              <th className="px-4 py-0 text-left align-middle">Группа</th>
              <th className="px-4 py-0 text-left align-middle">Формат</th>
              <th className="px-4 py-0 text-left align-middle">Статус</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {events.map((event) => {
              const isPast = Date.parse(event.endsAt) < nowTs;
              const rowTone = isPast ? "text-neutral-400" : "text-neutral-700";

              return (
                <tr
                  key={event.id}
                  className={`cursor-pointer align-top text-sm hover:bg-neutral-50/70 ${rowTone}`}
                  onClick={() => router.push(event.href)}
                >
                  <td className="px-3 py-3">{formatDateCell(event.isoDate)}</td>
                  <td className="px-3 py-3">{event.timeRangeLabel}</td>
                  <td className="px-3 py-3">{event.lessonTitle}</td>
                  <td className="px-3 py-3">{event.groupLabel}</td>
                  <td className="px-3 py-3">{event.formatLabel}</td>
                  <td className="px-3 py-3">{event.statusLabel}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="space-y-2 md:hidden">
        {events.map((event) => (
          <TeacherLessonEventCard key={event.id} event={event} nowIso={nowIso} compact />
        ))}
      </div>
    </>
  );
}

function TeacherLessonEventCard({
  event,
  nowIso,
  compact = false,
}: {
  event: TeacherLessonsHubReadModel["schedule"]["events"][number];
  nowIso: string;
  compact?: boolean;
}) {
  const isCurrent = isNowActive(event, Date.parse(nowIso));

  return (
    <Link
      href={event.href}
      className={`block rounded-2xl border p-3 transition hover:border-sky-300 ${
        isCurrent ? "border-sky-300 bg-sky-50/70" : "border-neutral-200 bg-white"
      }`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-semibold text-neutral-900">{event.timeRangeLabel}</p>
        <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-600">
          {event.statusLabel}
        </span>
        <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-600">
          {event.formatLabel}
        </span>
      </div>
      <p className="mt-1 text-sm font-semibold text-neutral-900">{event.lessonTitle}</p>
      <p className="mt-1 text-xs text-neutral-600">Группа: {event.groupLabel}</p>
      <p className={`mt-2 text-xs font-semibold text-sky-700 ${compact ? "" : "sm:text-sm"}`}>
        Открыть урок
      </p>
    </Link>
  );
}

function TeacherMonthView({
  activeDateIso,
  events,
  onOpenDay,
}: {
  activeDateIso: string;
  events: TeacherLessonsHubReadModel["schedule"]["events"];
  onOpenDay: (isoDate: string) => void;
}) {
  const monthMatrix = getMonthMatrix(activeDateIso);
  const eventsByDay = useMemo(() => {
    const bucket = new Map<string, TeacherLessonsHubReadModel["schedule"]["events"]>();
    for (const event of events) {
      if (!bucket.has(event.isoDate)) {
        bucket.set(event.isoDate, []);
      }
      bucket.get(event.isoDate)?.push(event);
    }
    return bucket;
  }, [events]);

  return (
    <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
      <div className="grid grid-cols-7 border-b border-neutral-200 bg-neutral-50 text-center text-xs font-semibold text-neutral-500">
        {WEEKDAY_SHORT.map((day) => (
          <span key={day} className="px-2 py-2">
            {day}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {monthMatrix.weeks.flat().map((isoDate: string) => {
          const dayEvents = eventsByDay.get(isoDate) ?? [];
          const isCurrentMonth = isoDate.slice(0, 7) === activeDateIso.slice(0, 7);
          const previewEvents = dayEvents.slice(0, 2);
          const extraCount = dayEvents.length - previewEvents.length;

          return (
            <button
              key={isoDate}
              type="button"
              onClick={() => onOpenDay(isoDate)}
              className={`relative min-h-24 border-b border-r border-neutral-100 px-2 py-2 text-left transition ${
                isCurrentMonth ? "bg-white hover:bg-neutral-50" : "bg-neutral-50/70 text-neutral-400"
              }`}
            >
              <div className="absolute left-2 top-2 text-xs font-semibold">
                {Number(isoDate.slice(8, 10))}
              </div>
              <div className="mt-5 space-y-1">
                {previewEvents.map((event) => (
                  <div
                    key={event.id}
                    className="rounded-lg border border-neutral-200 bg-neutral-50 px-1.5 py-1 text-[10px] leading-tight text-neutral-700"
                  >
                    <div className="font-semibold">{event.timeLabel}</div>
                    <div className="truncate">{event.lessonTitle}</div>
                    <div className="truncate text-[9px] text-neutral-500">{event.groupLabel}</div>
                  </div>
                ))}
                {extraCount > 0 ? (
                  <div className="text-[10px] font-semibold text-neutral-500">+{extraCount}</div>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TeacherMonthDialog({
  isoDate,
  events,
  nowIso,
  onClose,
}: {
  isoDate: string | null;
  events: TeacherLessonsHubReadModel["schedule"]["events"];
  nowIso: string;
  onClose: () => void;
}) {
  const dayEvents = useMemo(
    () =>
      isoDate
        ? events
            .filter((event) => event.isoDate === isoDate)
            .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))
        : [],
    [events, isoDate],
  );

  if (!isoDate) return null;

  return (
    <div className="fixed inset-0 z-[280] flex items-end justify-center bg-black/40 p-3 sm:items-center">
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Уроки на ${formatDayLabel(isoDate)}`}
        className="relative z-[1] max-h-[85vh] w-full max-w-2xl overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
          <h3 className="text-sm font-semibold text-neutral-900">{formatDayLabel(isoDate)}</h3>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-neutral-200 text-neutral-600 hover:bg-neutral-50"
            aria-label="Закрыть"
          >
            <X size={16} />
          </button>
        </div>
        <div className="max-h-[calc(85vh-56px)] overflow-y-auto p-4">
          {dayEvents.length === 0 ? (
            <p className="text-sm text-neutral-500">На выбранный день занятий пока нет.</p>
          ) : (
            <div className="space-y-2">
              {dayEvents.map((event) => (
                <TeacherLessonEventCard key={event.id} event={event} nowIso={nowIso} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
