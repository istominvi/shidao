import { ScheduleWorkspace } from "@/components/teaching-hub/schedule-workspace";
import { TopNav } from "@/components/top-nav";

export default function SchedulePage() {
  return (
    <main className="course-demo-shell teaching-hub-shell pb-12">
      <TopNav demoStyle />
      <div className="container app-page-container space-y-6">
        <ScheduleWorkspace />
      </div>
    </main>
  );
}
