"use client";

import type { TeacherDashboardOperationsReadModel } from "@/lib/server/teacher-dashboard-operations";
import { AppPageHeader } from "@/components/app/page-header";
import { TeacherGroupsCard } from "./teacher-groups-card";
import { TeacherScheduleCard } from "./teacher-schedule-card";

type TeacherDashboardProps = {
  readModel: TeacherDashboardOperationsReadModel;
};

export function TeacherDashboard({ readModel }: TeacherDashboardProps) {
  return (
    <div className="space-y-6">
      <AppPageHeader title="Обзор" />

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
