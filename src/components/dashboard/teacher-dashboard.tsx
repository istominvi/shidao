"use client";

import type { TeacherDashboardOperationsReadModel } from "@/lib/server/teacher-dashboard-operations";
import { TeacherGroupsCard } from "./teacher-groups-card";
import { TeacherScheduleCard } from "./teacher-schedule-card";

type TeacherDashboardProps = {
  readModel: TeacherDashboardOperationsReadModel;
};

export function TeacherDashboard({ readModel }: TeacherDashboardProps) {
  return (
    <div className="space-y-6">
      <section className="landing-surface rounded-3xl border border-white/80 p-4 md:p-6">
        <h1 className="text-3xl font-black tracking-[-0.03em] text-neutral-950 md:text-4xl">Обзор</h1>
      </section>

      <TeacherScheduleCard schedule={readModel.schedule} />

      <TeacherGroupsCard
        title="Мои группы"
        actions={readModel.actions}
        rows={readModel.groups.rows}
        filters={readModel.groups.filters}
      />
    </div>
  );
}
