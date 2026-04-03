import { redirect } from 'next/navigation';
import { ParentDashboard } from '@/components/dashboard/parent-dashboard';
import { StudentDashboard } from '@/components/dashboard/student-dashboard';
import { TeacherDashboard } from '@/components/dashboard/teacher-dashboard';
import { ROUTES } from '@/lib/auth';
import { loadParentLearningContextsByUser } from '@/lib/server/supabase-admin';
import { requireUserContext } from '@/lib/server/user-context';

export default async function DashboardIndexPage() {
  const context = await requireUserContext();

  if (context.actorKind === 'student') {
    return <StudentDashboard />;
  }

  if (!context.hasAnyAdultProfile) {
    redirect(ROUTES.onboarding);
  }

  if (context.activeProfile === 'teacher') {
    return <TeacherDashboard />;
  }

  const learningContexts = await loadParentLearningContextsByUser(context.userId);
  return <ParentDashboard childrenContexts={learningContexts} />;
}
