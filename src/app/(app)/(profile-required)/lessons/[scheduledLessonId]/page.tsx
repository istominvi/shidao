import { notFound, redirect } from "next/navigation";
import { AppPageHeader } from "@/components/app/page-header";
import {
  LessonMetaPill,
  LessonMetaRail,
  type LessonMetaIconKey,
  type LessonMetaTone,
} from "@/components/lessons/lesson-meta-pill";
import { ScheduledLessonLearnerView } from "@/components/lessons/scheduled-lesson-learner-view";
import { TeacherLessonWorkspace } from "@/components/lessons/teacher-lesson-workspace";
import { TopNav } from "@/components/top-nav";
import { ROUTES } from "@/lib/auth";
import { resolveAccessPolicy } from "@/lib/server/access-policy";
import { logger } from "@/lib/server/logger";
import {
  getParentScheduledLessonView,
  getStudentScheduledLessonView,
  getTeacherScheduledLessonView,
} from "@/lib/server/scheduled-lesson-view";

function learnerEyebrow(view: "preview" | "parent" | "student") {
  if (view === "preview") return "Предпросмотр урока";
  if (view === "parent") return "Урок ребёнка";
  return "Твой урок";
}

function formatLessonDateLabel(startsAt: string) {
  const date = new Date(startsAt);
  if (Number.isNaN(date.getTime())) {
    return "Дата урока уточняется";
  }

  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function runtimeStatusMeta(status: "planned" | "in_progress" | "completed" | "cancelled"): {
  label: string;
  icon: LessonMetaIconKey;
  tone: LessonMetaTone;
} {
  if (status === "in_progress") {
    return { label: "Урок начался", icon: "status", tone: "success" };
  }
  if (status === "completed") {
    return { label: "Урок окончен", icon: "readiness", tone: "muted" };
  }
  if (status === "cancelled") {
    return { label: "Урок отменён", icon: "readiness", tone: "muted" };
  }
  return { label: "Урок запланирован", icon: "datetime", tone: "primary" };
}

export default async function ScheduledLessonPage({
  params,
  searchParams,
}: {
  params: Promise<{ scheduledLessonId: string }>;
  searchParams: Promise<{ saved?: string; error?: string }>;
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
    const studentId = accessResolution.context.student?.id;
    if (!studentId) {
      redirect(ROUTES.login);
    }
    let view: Awaited<ReturnType<typeof getStudentScheduledLessonView>> = null;
    let loadFailed = false;
    try {
      view = await getStudentScheduledLessonView({
        scheduledLessonId,
        studentId,
      });
    } catch (error) {
      loadFailed = true;
      logger.error("[lessons] failed to load student scheduled lesson view", {
        scheduledLessonId,
        studentId,
        userId: accessResolution.context.userId,
        error,
      });
    }
    if (!view) {
      if (loadFailed) {
        return (
          <main className="pb-12">
            <div className="landing-noise" aria-hidden="true" />
            <TopNav />
            <div className="container app-page-container">
              <AppPageHeader
                eyebrow={learnerEyebrow("student")}
                title="Урок временно недоступен"
                description="Не удалось загрузить данные урока. Попробуй открыть его позже или вернись в кабинет."
              />
            </div>
          </main>
        );
      }
      notFound();
    }

    const runtimeMeta = runtimeStatusMeta(view.runtimeStatus);

    return (
      <main className="pb-12">
        <div className="landing-noise" aria-hidden="true" />
        <TopNav />
        <div className="container app-page-container space-y-6">
          <AppPageHeader
            backHref={ROUTES.schedule}
            backLabel="Расписание"
            title={view.lessonTitle}
            meta={
              <LessonMetaRail>
                <LessonMetaPill
                  icon={runtimeMeta.icon}
                  tone={runtimeMeta.tone}
                  label={runtimeMeta.label}
                />
                <LessonMetaPill
                  icon="datetime"
                  label={formatLessonDateLabel(view.startsAt)}
                />
                <LessonMetaPill icon="teacher" label={view.teacherLabel} />
                <LessonMetaPill icon="group" label={view.groupLabel} />
                <LessonMetaPill icon="format" label={view.formatLabel} />
              </LessonMetaRail>
            }
          />
          <ScheduledLessonLearnerView model={view} />
        </div>
      </main>
    );
  }

  if (accessResolution.context.activeProfile === "parent") {
    let view: Awaited<ReturnType<typeof getParentScheduledLessonView>> = null;
    try {
      view = await getParentScheduledLessonView({
        scheduledLessonId,
        userId: accessResolution.context.userId,
      });
    } catch (error) {
      logger.error("[lessons] failed to load parent scheduled lesson view", {
        scheduledLessonId,
        userId: accessResolution.context.userId,
        error,
      });
    }
    if (!view) notFound();

    const runtimeMeta = runtimeStatusMeta(view.runtimeStatus);

    return (
      <main className="pb-12">
        <div className="landing-noise" aria-hidden="true" />
        <TopNav />
        <div className="container app-page-container space-y-6">
          <AppPageHeader
            eyebrow={learnerEyebrow("parent")}
            title={view.lessonTitle}
            description={
              view.lessonSubtitle ??
              "Урок доступен в формате родительского мониторинга."
            }
            meta={
              <LessonMetaRail>
                <LessonMetaPill
                  icon={runtimeMeta.icon}
                  tone={runtimeMeta.tone}
                  label={runtimeMeta.label}
                />
                <LessonMetaPill
                  icon="datetime"
                  label={formatLessonDateLabel(view.startsAt)}
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
  const teacherRuntimeMeta = runtimeStatusMeta(
    teacherView.workspace.liveState.runtimeStatus,
  );

  return (
    <main className="pb-12">
      <div className="landing-noise" aria-hidden="true" />
      <TopNav />
      <div className="container app-page-container space-y-6">
        <AppPageHeader
          backHref={ROUTES.schedule}
          backLabel="Расписание"
          title={teacherView.workspace.presentation.hero.lessonTitle}
          meta={
            <LessonMetaRail>
              <LessonMetaPill
                icon={teacherRuntimeMeta.icon}
                tone={teacherRuntimeMeta.tone}
                label={teacherRuntimeMeta.label}
              />
              <LessonMetaPill
                icon="datetime"
                label={formatLessonDateLabel(teacherView.workspace.projection.runtimeShell.startsAt)}
              />
              <LessonMetaPill
                icon="group"
                label={teacherView.workspace.presentation.hero.groupLabel}
              />
              <LessonMetaPill
                icon="format"
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
