"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AppCard } from "@/components/app/app-card";
import { TeacherScheduleBoard } from "@/components/schedule/teacher-schedule-board";
import type { ScheduleViewMode } from "./teacher-schedule-utils";
import type { TeacherDashboardOperationsReadModel } from "@/lib/server/teacher-dashboard-operations";

type Props = {
  schedule: TeacherDashboardOperationsReadModel["schedule"];
};

const viewOptions: ScheduleViewMode[] = ["week", "day", "month", "list"];
const viewLabel: Record<ScheduleViewMode, string> = {
  day: "День",
  week: "Неделя",
  month: "Месяц",
  list: "Список",
};

export function TeacherScheduleCard({ schedule }: Props) {
  const [viewMode, setViewMode] = useState<ScheduleViewMode>("week");
  const [activeDateIso, setActiveDateIso] = useState(schedule.defaultDateIso);
  const [monthDateIso, setMonthDateIso] = useState(schedule.defaultDateIso);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px)");
    if (media.matches) setViewMode("list");
  }, []);

  const nowTs = Date.parse(schedule.nowIso);
  const nextLesson = useMemo(
    () => schedule.events.find((event) => Date.parse(event.startsAt) >= nowTs) ?? null,
    [nowTs, schedule.events],
  );

  return (
    <AppCard className="p-4 md:p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-xl font-black text-neutral-950">Расписание</h2>
          <p className="mt-1 text-xs text-neutral-500">
            Всего занятий: {schedule.events.length}
            {nextLesson ? ` · Ближайшее: ${nextLesson.timeRangeLabel}, ${nextLesson.groupLabel}` : " · Ближайших занятий нет"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-full border border-neutral-200 bg-white p-1">
            {viewOptions.map((mode) => (
              <button key={mode} type="button" onClick={() => setViewMode(mode)} className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${viewMode === mode ? "bg-neutral-900 text-white" : "text-neutral-600 hover:bg-neutral-100"}`}>
                {viewLabel[mode]}
              </button>
            ))}
          </div>
          <Link href="/lessons" className="rounded-full border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50">
            Открыть полностью
          </Link>
        </div>
      </div>

      <div className="mt-4">
        <TeacherScheduleBoard
          events={schedule.events}
          viewMode={viewMode}
          activeDateIso={activeDateIso}
          monthFocusDateIso={monthDateIso}
          nowIso={schedule.nowIso}
          interactionMode="navigate"
          onActiveDateChange={setActiveDateIso}
          onMonthFocusDateChange={setMonthDateIso}
          emptyLabel="В выбранном диапазоне пока нет занятий."
        />
      </div>
    </AppCard>
  );
}
