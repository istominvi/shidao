"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Rows3, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AppPageHeader } from "@/components/app/page-header";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Select } from "@/components/ui/input";
import { SurfaceCard } from "@/components/ui/surface-card";
import { getMonthMatrix } from "@/components/dashboard/teacher-schedule-utils";
import type {
  StudentLessonsHubEvent,
  StudentLessonsHubReadModel,
} from "@/lib/server/student-schedule";

const DISPLAY_MODES = ["table", "calendar"] as const;
const DISPLAY_MODE_LABELS: Record<(typeof DISPLAY_MODES)[number], string> = {
  table: "Таблица",
  calendar: "Календарь",
};
const WEEKDAY_SHORT = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

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

function matchesFilter(event: StudentLessonsHubEvent, teacher: string, group: string) {
  const teacherMatch = teacher === "all" || event.teacherLabel === teacher;
  const groupMatch = group === "all" || event.groupLabel === group;
  return teacherMatch && groupMatch;
}

function isNowActive(event: StudentLessonsHubEvent, nowTs: number) {
  return Date.parse(event.startsAt) <= nowTs && Date.parse(event.endsAt) >= nowTs;
}

export function StudentLessonsHub({ hub }: { hub: StudentLessonsHubReadModel }) {
  const [displayMode, setDisplayMode] = useState<(typeof DISPLAY_MODES)[number]>("table");
  const [activeDateIso, setActiveDateIso] = useState(hub.defaultDateIso);
  const [monthDialogIso, setMonthDialogIso] = useState<string | null>(null);
  const [teacherFilter, setTeacherFilter] = useState("all");
  const [groupFilter, setGroupFilter] = useState("all");

  const filteredEvents = useMemo(
    () =>
      hub.events.filter((event) =>
        matchesFilter(event, teacherFilter, groupFilter),
      ),
    [groupFilter, hub.events, teacherFilter],
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

  return (
    <div className="space-y-6 lg:space-y-8">
      <AppPageHeader title="Расписание" />

      <SurfaceCard
        title={
          <span className="inline-flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span>Уроки</span>
            <span className="text-sm font-semibold text-neutral-500">
              Всего: {hub.totalLessons} · По фильтрам: {filteredEvents.length}
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
            value={teacherFilter}
            onChange={(event) => setTeacherFilter(event.target.value)}
            className="min-w-[13rem]"
            aria-label="Фильтр по преподавателю"
          >
            <option value="all">Все преподаватели</option>
            {hub.teacherOptions.map((label) => (
              <option key={label} value={label}>
                {label}
              </option>
            ))}
          </Select>
          <ChevronDown className="product-select-icon h-4 w-4" aria-hidden="true" />
          </div>

          <div className="product-select-wrap">
          <Select
            value={groupFilter}
            onChange={(event) => setGroupFilter(event.target.value)}
            className="min-w-[11rem]"
            aria-label="Фильтр по группе"
          >
            <option value="all">Все группы</option>
            {hub.groupOptions.map((label) => (
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
            <StudentLessonsTable events={tableEvents} nowIso={hub.nowIso} />
          ) : (
            <>
              <StudentMonthView
                activeDateIso={activeDateIso}
                events={sortedFilteredEvents}
                onOpenDay={setMonthDialogIso}
              />
              <StudentMonthDialog
                isoDate={monthDialogIso}
                events={sortedFilteredEvents}
                nowIso={hub.nowIso}
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
    </div>
  );
}

function HomeworkPreview({ event }: { event: StudentLessonsHubEvent }) {
  if (!event.homework) {
    return <span className="text-xs text-neutral-500">Без ДЗ</span>;
  }

  return (
    <div className="space-y-0.5">
      <p className="truncate text-xs font-semibold text-neutral-800">{event.homework.title}</p>
      <p className="text-[11px] text-neutral-500">
        {event.homework.statusLabel} · до {event.homework.dueAtLabel}
      </p>
    </div>
  );
}

function StudentLessonsTable({
  events,
  nowIso,
}: {
  events: StudentLessonsHubEvent[];
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
              <th className="px-4 py-0 text-left align-middle">Учитель</th>
              <th className="px-4 py-0 text-left align-middle">Группа</th>
              <th className="px-4 py-0 text-left align-middle">Формат</th>
              <th className="px-4 py-0 text-left align-middle">ДЗ</th>
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
                  <td className="px-3 py-3">{event.teacherLabel}</td>
                  <td className="px-3 py-3">{event.groupLabel}</td>
                  <td className="px-3 py-3">{event.formatLabel}</td>
                  <td className="px-3 py-3">{event.homework ? event.homework.dueAtLabel : ""}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="space-y-2 md:hidden">
        {events.map((event) => (
          <LessonEventCard key={event.id} event={event} nowIso={nowIso} compact />
        ))}
      </div>
    </>
  );
}

function LessonEventCard({
  event,
  nowIso,
  compact = false,
}: {
  event: StudentLessonsHubEvent;
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
      <p className="mt-1 text-xs text-neutral-600">
        Учитель: {event.teacherLabel} · Группа: {event.groupLabel}
      </p>
      <div className="mt-2 rounded-xl border border-neutral-200 bg-neutral-50 px-2.5 py-2">
        <HomeworkPreview event={event} />
      </div>
      <p className={`mt-2 text-xs font-semibold text-sky-700 ${compact ? "" : "sm:text-sm"}`}>
        Открыть урок
      </p>
    </Link>
  );
}

function StudentMonthView({
  activeDateIso,
  events,
  onOpenDay,
}: {
  activeDateIso: string;
  events: StudentLessonsHubEvent[];
  onOpenDay: (iso: string) => void;
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
          const previewEvents = dayEvents.slice(0, 2);
          const extraCount = dayEvents.length - previewEvents.length;

          return (
            <button
              key={iso}
              type="button"
              onClick={() => onOpenDay(iso)}
              className={`relative min-h-24 border-r border-b border-neutral-100 px-2 py-2 text-left transition ${
                inMonth ? "bg-white hover:bg-neutral-50" : "bg-neutral-50/70 text-neutral-400"
              }`}
            >
              <div className="absolute left-2 top-2 text-xs font-semibold">
                {Number(iso.slice(8, 10))}
              </div>
              <div className="mt-5 space-y-1">
                {previewEvents.map((event) => (
                  <div
                    key={event.id}
                    className="rounded-lg border border-neutral-200 bg-neutral-50 px-1.5 py-1 text-[10px] leading-tight text-neutral-700"
                  >
                    <div className="font-semibold">{event.timeLabel}</div>
                    <div className="truncate">{event.lessonTitle}</div>
                    {event.homework ? <div className="text-[9px] font-semibold text-neutral-500">ДЗ</div> : null}
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

function StudentMonthDialog({
  isoDate,
  events,
  nowIso,
  onClose,
}: {
  isoDate: string | null;
  events: StudentLessonsHubEvent[];
  nowIso: string;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!isoDate) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isoDate, onClose]);

  if (!isoDate) return null;

  const dayEvents = events
    .filter((event) => event.isoDate === isoDate)
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));

  return (
    <div className="fixed inset-0 z-[280] flex items-end justify-center bg-black/40 p-3 sm:items-center">
      <div
        className="absolute inset-0"
        onClick={onClose}
        aria-hidden="true"
      />
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
                <LessonEventCard key={event.id} event={event} nowIso={nowIso} compact />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
