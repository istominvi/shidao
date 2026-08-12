import Link from "next/link";
import { CalendarPlus } from "lucide-react";
import { AppPageHeader } from "@/components/app/page-header";
import { ScheduleWorkspace } from "@/components/teaching-hub/schedule-workspace";
import { TopNav } from "@/components/top-nav";
import { productButtonClassName } from "@/components/ui/button";
import { ROUTES } from "@/lib/auth";

export default function SchedulePage() {
  return (
    <main className="course-demo-shell teaching-hub-shell pb-12">
      <TopNav demoStyle />
      <div className="container app-page-container space-y-6">
        <AppPageHeader
          title="Расписание"
          description="Здесь все назначенные уроки за выбранный период"
          actions={
            <Link
              href={ROUTES.courses}
              className={productButtonClassName("primary")}
            >
              <CalendarPlus className="h-4 w-4" aria-hidden="true" />
              Назначить урок
            </Link>
          }
        />
        <ScheduleWorkspace />
      </div>
    </main>
  );
}
