import { notFound, redirect } from "next/navigation";
import { ScheduledLessonLearnerView } from "@/components/lessons/scheduled-lesson-learner-view";
import { TeacherLessonWorkspace } from "@/components/lessons/teacher-lesson-workspace";
import { TopNav } from "@/components/top-nav";
import { ROUTES } from "@/lib/auth";
import { resolveAccessPolicy } from "@/lib/server/access-policy";
import {
  getParentScheduledLessonView,
  getScheduledLessonLearnerPreview,
  getStudentScheduledLessonView,
  getTeacherScheduledLessonView,
} from "@/lib/server/scheduled-lesson-view";

export default async function ScheduledLessonPage({
  params,
  searchParams,
}: {
  params: Promise<{ scheduledLessonId: string }>;
  searchParams: Promise<{ saved?: string; error?: string; view?: string }>;
}) {
  const accessResolution = await resolveAccessPolicy();

  if (accessResolution.status === "guest" || accessResolution.status === "degraded") {
    redirect(ROUTES.login);
  }

  if (accessResolution.status === "adult-without-profile") {
    redirect(ROUTES.onboarding);
  }

  const { scheduledLessonId } = await params;
  const query = await searchParams;

  if (accessResolution.context.actorKind === "student") {
    const studentId = accessResolution.context.student?.id ?? "";
    const view = await getStudentScheduledLessonView({ scheduledLessonId, studentId });
    if (!view) notFound();

    return (
      <main className="pb-12">
        <div className="landing-noise" aria-hidden="true" />
        <TopNav />
        <div className="container py-7 md:py-10">
          <ScheduledLessonLearnerView model={view} />
        </div>
      </main>
    );
  }

  if (accessResolution.context.activeProfile === "parent") {
    const view = await getParentScheduledLessonView({
      scheduledLessonId,
      userId: accessResolution.context.userId,
    });
    if (!view) notFound();

    return (
      <main className="pb-12">
        <div className="landing-noise" aria-hidden="true" />
        <TopNav />
        <div className="container py-7 md:py-10">
          <ScheduledLessonLearnerView model={view} />
        </div>
      </main>
    );
  }

  if (accessResolution.context.activeProfile !== "teacher") {
    redirect(ROUTES.dashboard);
  }

  const teacherId = accessResolution.context.teacher?.id ?? "";
  const teacherView = await getTeacherScheduledLessonView({
    scheduledLessonId,
    teacherId,
  });
  if (!teacherView) notFound();

  if (query.view === "learner-preview") {
    const preview = await getScheduledLessonLearnerPreview(scheduledLessonId);

    return (
      <main className="pb-12">
        <div className="landing-noise" aria-hidden="true" />
        <TopNav />
        <div className="container py-7 md:py-10">
          {preview ? (
            <ScheduledLessonLearnerView model={preview} />
          ) : (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">Предпросмотр ученической версии временно недоступен.</p>
          )}
        </div>
      </main>
    );
  }

  return (
    <main className="pb-12">
      <div className="landing-noise" aria-hidden="true" />
      <TopNav />
      <div className="container py-7 md:py-10">
        <TeacherLessonWorkspace
          workspace={teacherView.workspace}
          runtimeFormFeedback={{
            success: query.saved?.trim() || undefined,
            error: query.error?.trim() || undefined,
          }}
        />
      </div>
    </main>
  );
}
