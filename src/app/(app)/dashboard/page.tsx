import { ParentDashboard } from "@/components/dashboard/parent-dashboard";
import { StudentDashboard } from "@/components/dashboard/student-dashboard";
import { TeacherDashboard } from "@/components/dashboard/teacher-dashboard";
import { loadParentLearningContextsByUser } from "@/lib/server/supabase-admin";
import { requireDashboardContext } from "@/lib/server/user-context";

export default async function DashboardIndexPage() {
  const context = await requireDashboardContext();

  if (context.actorKind === "student") {
    return <StudentDashboard />;
  }

  if (context.activeProfile === "teacher") {
    return <TeacherDashboard />;
  }

  const learningContexts = await loadParentLearningContextsByUser(
    context.userId,
  );
  return <ParentDashboard childrenContexts={learningContexts} />;
}
