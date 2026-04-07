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
  searchParams,
}: {
  params: Promise<{ scheduledLessonId: string }>;
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const accessResolution = await resolveAccessPolicy();

  if (!canAccessTeacherLessonWorkspace(accessResolution)) {
    redirect(ROUTES.dashboard);
  }

  const { scheduledLessonId } = await params;
  const workspace = await getTeacherLessonWorkspaceByScheduledLessonId(
    scheduledLessonId,
  );
  const query = await searchParams;

  if (!workspace) {
    notFound();
  }

  return (
    <main className="pb-12">
      <div className="landing-noise" aria-hidden="true" />
      <TopNav />
      <div className="container py-7 md:py-10">
        <TeacherLessonWorkspace
          workspace={workspace}
          runtimeFormFeedback={{
            success: query.saved?.trim() || undefined,
            error: query.error?.trim() || undefined,
          }}
        />
      </div>
    </main>
  );
}
