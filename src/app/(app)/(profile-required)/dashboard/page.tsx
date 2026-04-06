import { redirect } from "next/navigation";
import { ParentDashboard } from "@/components/dashboard/parent-dashboard";
import { StudentDashboard } from "@/components/dashboard/student-dashboard";
import { TeacherDashboard } from "@/components/dashboard/teacher-dashboard";
import { ROUTES } from "@/lib/auth";
import { resolveAccessPolicy } from "@/lib/server/access-policy";
import { loadParentLearningContextsByUser } from "@/lib/server/supabase-admin";

export default async function DashboardIndexPage() {
  const resolution = await resolveAccessPolicy();

  if (resolution.status === "guest" || resolution.status === "degraded") {
    redirect(ROUTES.login);
  }

  if (resolution.status === "adult-without-profile") {
    redirect(ROUTES.onboarding);
  }

  const context = resolution.context;

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
