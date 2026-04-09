"use client";

import type { TeacherDashboardOperationsReadModel } from "@/lib/server/teacher-dashboard-operations";
import { TeacherScheduleSurface } from "@/components/schedule/teacher-schedule-surface";

type Props = {
  schedule: TeacherDashboardOperationsReadModel["schedule"];
};

export function TeacherScheduleCard({ schedule }: Props) {
  return (
    <TeacherScheduleSurface
      events={schedule.events}
      nowIso={schedule.nowIso}
      defaultDateIso={schedule.defaultDateIso}
    />
  );
}
