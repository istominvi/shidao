"use client";

import { addUtcDays, type ScheduleViewMode } from "@/components/dashboard/teacher-schedule-utils";
import type { TeacherScheduleToolbarState } from "./teacher-schedule-types";

type FilterOption = { id: string; label: string };

type Props = {
  state: TeacherScheduleToolbarState;
  onChange: (patch: Partial<TeacherScheduleToolbarState>) => void;
  classOptions: FilterOption[];
  methodologyOptions: FilterOption[];
  formatOptions: FilterOption[];
  statusOptions: FilterOption[];
};

const VIEW_ORDER: ScheduleViewMode[] = ["day", "week", "month", "list"];
const VIEW_LABELS: Record<ScheduleViewMode, string> = {
  day: "День",
  week: "Неделя",
  month: "Месяц",
  list: "Список",
};

function shiftDateByView(current: string, view: ScheduleViewMode, delta: number) {
  if (view === "day") return addUtcDays(current, delta);
  if (view === "week" || view === "list") return addUtcDays(current, delta * 7);
  const date = new Date(`${current}T00:00:00Z`);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + delta, 1)).toISOString().slice(0, 10);
}

export function TeacherScheduleToolbar({
  state,
  onChange,
  classOptions,
  methodologyOptions,
  formatOptions,
  statusOptions,
}: Props) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-full border border-neutral-200 bg-white p-1">
          {VIEW_ORDER.map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => onChange({ view: mode })}
              aria-pressed={state.view === mode}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                state.view === mode ? "bg-neutral-900 text-white" : "text-neutral-600 hover:bg-neutral-100"
              }`}
            >
              {VIEW_LABELS[mode]}
            </button>
          ))}
        </div>
        <div className="ml-auto inline-flex items-center gap-2">
          <button type="button" onClick={() => onChange({ date: shiftDateByView(state.date, state.view, -1) })} className="rounded-full border border-neutral-200 bg-white px-3 py-1 text-sm">←</button>
          <input type="date" value={state.date} onChange={(event) => onChange({ date: event.target.value })} className="rounded-xl border border-neutral-300 bg-white px-3 py-1.5 text-sm" />
          <button type="button" onClick={() => onChange({ date: shiftDateByView(state.date, state.view, 1) })} className="rounded-full border border-neutral-200 bg-white px-3 py-1 text-sm">→</button>
        </div>
      </div>

      <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-5">
        <input
          type="search"
          value={state.search}
          onChange={(event) => onChange({ search: event.target.value })}
          placeholder="Поиск по группе или уроку"
          className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm lg:col-span-2"
        />
        <select value={state.classId} onChange={(event) => onChange({ classId: event.target.value })} className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm">
          <option value="">Все группы</option>
          {classOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
        </select>
        <select value={state.methodologyLessonId} onChange={(event) => onChange({ methodologyLessonId: event.target.value })} className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm">
          <option value="">Все уроки методики</option>
          {methodologyOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
        </select>
        <div className="grid grid-cols-2 gap-2">
          <select value={state.format} onChange={(event) => onChange({ format: event.target.value as TeacherScheduleToolbarState["format"] })} className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm">
            <option value="">Формат</option>
            {formatOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
          </select>
          <select value={state.status} onChange={(event) => onChange({ status: event.target.value as TeacherScheduleToolbarState["status"] })} className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm">
            <option value="">Статус</option>
            {statusOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
          </select>
        </div>
      </div>
    </div>
  );
}
