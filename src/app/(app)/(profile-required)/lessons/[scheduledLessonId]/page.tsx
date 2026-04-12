import { notFound, redirect } from "next/navigation";
import { AppPageHeader } from "@/components/app/page-header";
import {
  LessonMetaPill,
  LessonMetaRail,
} from "@/components/lessons/lesson-meta-pill";
import { ScheduledLessonLearnerView } from "@/components/lessons/scheduled-lesson-learner-view";
import { TeacherLessonWorkspace } from "@/components/lessons/teacher-lesson-workspace";
import { TopNav } from "@/components/top-nav";
import { ROUTES, toMethodologyLessonRoute } from "@/lib/auth";
import { resolveAccessPolicy } from "@/lib/server/access-policy";
import {
  getParentScheduledLessonView,
  getScheduledLessonLearnerPreview,
  getStudentScheduledLessonView,
  getTeacherScheduledLessonView,
} from "@/lib/server/scheduled-lesson-view";

function learnerEyebrow(view: "preview" | "parent" | "student") {
  if (view === "preview") return "Предпросмотр урока";
  if (view === "parent") return "Урок ребёнка";
  return "Твой урок";
}

export default async function ScheduledLessonPage({
  params,
  searchParams,
}: {
  params: Promise<{ scheduledLessonId: string }>;
  searchParams: Promise<{ saved?: string; error?: string; view?: string }>;
}) {
  const accessResolution = await resolveAccessPolicy();

  if (
    accessResolution.status === "guest" ||
    accessResolution.status === "degraded"
  ) {
    redirect(ROUTES.login);
  }

  if (accessResolution.status === "adult-without-profile") {
    redirect(ROUTES.onboarding);
  }

  const { scheduledLessonId } = await params;
  const query = await searchParams;

  if (accessResolution.context.actorKind === "student") {
    const studentId = accessResolution.context.student?.id ?? "";
    const view = await getStudentScheduledLessonView({
      scheduledLessonId,
      studentId,
    });
    if (!view) notFound();

    return (
      <main className="pb-12">
        <div className="landing-noise" aria-hidden="true" />
        <TopNav />
        <div className="container space-y-6 py-7 md:py-10">
          <AppPageHeader
            backHref={ROUTES.dashboard}
            backLabel="Дашборд"
            eyebrow={learnerEyebrow("student")}
            title={view.lessonTitle}
            description={
              view.lessonSubtitle ??
              "Повторяй слова и активности урока в удобном темпе."
            }
            meta={
              <LessonMetaRail>
                <LessonMetaPill
                  icon="status"
                  tone="info"
                  label={
                    view.runtimeStatus === "in_progress"
                      ? "Идёт урок"
                      : view.runtimeStatus === "completed"
                        ? "Урок завершён"
                        : view.runtimeStatus === "cancelled"
                          ? "Урок отменён"
                          : "Урок запланирован"
                  }
                />
                <LessonMetaPill
                  icon="datetime"
                  tone="neutral"
                  label={new Intl.DateTimeFormat("ru-RU", {
                    day: "numeric",
                    month: "long",
                    hour: "2-digit",
                    minute: "2-digit",
                  }).format(new Date(view.startsAt))}
                />
              </LessonMetaRail>
            }
          />
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
        <div className="container space-y-6 py-7 md:py-10">
          <AppPageHeader
            backHref={ROUTES.dashboard}
            backLabel="Дашборд"
            eyebrow={learnerEyebrow("parent")}
            title={view.lessonTitle}
            description={
              view.lessonSubtitle ??
              "Урок доступен в формате родительского мониторинга."
            }
            meta={
              <LessonMetaRail>
                <LessonMetaPill
                  icon="status"
                  tone="info"
                  label={
                    view.runtimeStatus === "in_progress"
                      ? "Идёт урок"
                      : view.runtimeStatus === "completed"
                        ? "Урок завершён"
                        : view.runtimeStatus === "cancelled"
                          ? "Урок отменён"
                          : "Урок запланирован"
                  }
                />
                <LessonMetaPill
                  icon="datetime"
                  tone="neutral"
                  label={new Intl.DateTimeFormat("ru-RU", {
                    day: "numeric",
                    month: "long",
                    hour: "2-digit",
                    minute: "2-digit",
                  }).format(new Date(view.startsAt))}
                />
              </LessonMetaRail>
            }
          />
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
        <div className="container space-y-6 py-7 md:py-10">
          {preview ? (
            <>
              <AppPageHeader
                backHref={toMethodologyLessonRoute(
                  teacherView.workspace.sourceLesson.methodologySlug,
                  teacherView.workspace.sourceLesson.lessonId,
                )}
                backLabel={teacherView.workspace.sourceLesson.methodologyTitle}
                eyebrow={learnerEyebrow("preview")}
                title={preview.lessonTitle}
                description={
                  preview.lessonSubtitle ??
                  "Канонический ученический surface для текущего урока."
                }
                meta={
                  <LessonMetaRail>
                    <LessonMetaPill
                      icon="status"
                      tone="info"
                      label={
                        preview.runtimeStatus === "in_progress"
                          ? "Идёт урок"
                          : preview.runtimeStatus === "completed"
                            ? "Урок завершён"
                            : preview.runtimeStatus === "cancelled"
                              ? "Урок отменён"
                              : "Урок запланирован"
                      }
                    />
                    <LessonMetaPill
                      icon="datetime"
                      tone="neutral"
                      label={new Intl.DateTimeFormat("ru-RU", {
                        day: "numeric",
                        month: "long",
                        hour: "2-digit",
                        minute: "2-digit",
                      }).format(new Date(preview.startsAt))}
                    />
                  </LessonMetaRail>
                }
              />
              <ScheduledLessonLearnerView model={preview} />
            </>
          ) : (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Предпросмотр ученической версии временно недоступен.
            </p>
          )}
        </div>
      </main>
    );
  }

  return (
    <main className="pb-12">
      <div className="landing-noise" aria-hidden="true" />
      <TopNav />
      <div className="container space-y-6 py-7 md:py-10">
        <AppPageHeader
          backHref={toMethodologyLessonRoute(
            teacherView.workspace.sourceLesson.methodologySlug,
            teacherView.workspace.sourceLesson.lessonId,
          )}
          backLabel={teacherView.workspace.sourceLesson.methodologyTitle}
          eyebrow="Рабочее пространство преподавателя"
          title={teacherView.workspace.presentation.hero.lessonTitle}
          meta={
            <LessonMetaRail>
              <LessonMetaPill
                icon="methodology"
                tone="neutral"
                label={teacherView.workspace.presentation.hero.methodologyTitle}
              />
              <LessonMetaPill
                icon="datetime"
                tone="info"
                label={teacherView.workspace.presentation.hero.dateTimeLabel}
              />
              <LessonMetaPill
                icon="group"
                tone="neutral"
                label={teacherView.workspace.presentation.hero.groupLabel}
              />
              <LessonMetaPill
                icon="format"
                tone="muted"
                label={teacherView.workspace.presentation.hero.formatLabel}
              />
            </LessonMetaRail>
          }
        />
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
