import { notFound, redirect } from "next/navigation";
import { TeacherLessonWorkspace } from "@/components/lessons/teacher-lesson-workspace";
import { TopNav } from "@/components/top-nav";
import { ROUTES } from "@/lib/auth";
import { resolveAccessPolicy } from "@/lib/server/access-policy";
import {
  canAccessTeacherLessonWorkspace,
  getTeacherLessonWorkspaceByScheduledLessonId,
} from "@/lib/server/teacher-lesson-workspace";

export default async function TeacherLessonWorkspacePage({
  params,
}: {
  params: Promise<{ scheduledLessonId: string }>;
}) {
  const accessResolution = await resolveAccessPolicy();

  if (!canAccessTeacherLessonWorkspace(accessResolution)) {
    redirect(ROUTES.dashboard);
  }

  const { scheduledLessonId } = await params;
  const workspace = await getTeacherLessonWorkspaceByScheduledLessonId(
    scheduledLessonId,
  );

  if (!workspace) {
    notFound();
  }

  return (
    <main className="pb-10">
      <div className="landing-noise" aria-hidden="true" />
      <TopNav />
      <div className="container py-6 md:py-8">
        <TeacherLessonWorkspace workspace={workspace} />
      </div>
    </main>
  );
}
