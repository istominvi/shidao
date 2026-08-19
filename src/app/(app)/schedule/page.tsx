import { ScheduleWorkspace } from "@/components/teaching-hub/schedule-workspace";

export default function SchedulePage() {
  return (
    <main className="app-page-shell pb-12">
      <div className="container app-page-container space-y-6">
        <ScheduleWorkspace />
      </div>
    </main>
  );
}
