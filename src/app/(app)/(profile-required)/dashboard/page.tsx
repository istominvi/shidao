import { redirect } from "next/navigation";
import { ParentDashboard } from "@/components/dashboard/parent-dashboard";
import { ROUTES } from "@/lib/auth";
import { resolveAccessPolicy } from "@/lib/server/access-policy";
import { getParentCommunicationProjection } from "@/lib/server/communication-service";
import { getParentHomeworkProjection } from "@/lib/server/parent-homework";
import {
  getMethodologyLessonByIdAdmin,
  listScheduledLessonsForClassesAdmin,
} from "@/lib/server/lesson-content-repository";
import { logger } from "@/lib/server/logger";
import { loadParentLearningContextsByUser } from "@/lib/server/supabase-admin";

function formatStatus(status: "planned" | "in_progress" | "completed" | "cancelled") {
  if (status === "in_progress") return "Идёт";
  if (status === "completed") return "Завершено";
  if (status === "cancelled") return "Отменено";
  return "Запланировано";
}

function formatStartsAt(iso: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(new Date(iso));
}

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
    redirect(ROUTES.lessons);
  }

  if (context.activeProfile === "teacher") {
    redirect(ROUTES.lessons);
  }

  let learningContexts: Awaited<ReturnType<typeof loadParentLearningContextsByUser>> = [];
  try {
    learningContexts = await loadParentLearningContextsByUser(context.userId);
  } catch (error) {
    logger.error("[parent-dashboard] failed to load learning contexts", {
      userId: context.userId,
      error,
    });
  }

  let parentHomework: Awaited<ReturnType<typeof getParentHomeworkProjection>> = [];
  try {
    parentHomework = await getParentHomeworkProjection({
      children: learningContexts.map((child) => ({
        studentId: child.studentId,
        classIds: child.classes.map((item) => item.classId),
      })),
    });
  } catch (error) {
    logger.error("[parent-dashboard] failed to load homework projection", {
      userId: context.userId,
      error,
    });
  }
  const homeworkByStudent = Object.fromEntries(
    parentHomework.map((item) => [item.studentId, item.items]),
  );
  let parentCommunication: Awaited<ReturnType<typeof getParentCommunicationProjection>> = [];
  try {
    parentCommunication = await getParentCommunicationProjection({ userId: context.userId });
  } catch (error) {
    logger.error("[parent-dashboard] failed to load communication projection", {
      userId: context.userId,
      error,
    });
  }
  const lessonsByStudent: Record<
    string,
    Array<{
      scheduledLessonId: string;
      lessonTitle: string;
      startsAt: string;
      startsAtIso: string;
      statusLabel: string;
    }>
  > = {};
  for (const child of learningContexts) {
    try {
      const lessons = child.classes.length
        ? await listScheduledLessonsForClassesAdmin(child.classes.map((item) => item.classId))
        : [];
      const now = Date.now();
      const sortedLessons = lessons
        .slice()
        .sort(
          (a, b) =>
            new Date(a.runtimeShell.startsAt).getTime() -
            new Date(b.runtimeShell.startsAt).getTime(),
        );
      const upcomingLessons = sortedLessons.filter(
        (lesson) => new Date(lesson.runtimeShell.startsAt).getTime() >= now,
      );
      const pastLessons = sortedLessons.filter(
        (lesson) => new Date(lesson.runtimeShell.startsAt).getTime() < now,
      );

      lessonsByStudent[child.studentId] = await Promise.all(
        [...upcomingLessons, ...pastLessons].slice(0, 6).map(async (lesson) => {
          let lessonTitle = "Урок";
          try {
            const methodologyLesson = await getMethodologyLessonByIdAdmin(
              lesson.methodologyLessonId,
            );
            lessonTitle = methodologyLesson?.shell.title ?? "Урок";
          } catch {
            lessonTitle = "Урок";
          }
          return {
            scheduledLessonId: lesson.id,
            lessonTitle,
            startsAt: formatStartsAt(lesson.runtimeShell.startsAt),
            startsAtIso: lesson.runtimeShell.startsAt,
            statusLabel: formatStatus(lesson.runtimeShell.runtimeStatus),
          };
        }),
      );
    } catch (error) {
      logger.error("[parent-dashboard] failed to load lessons for student", {
        userId: context.userId,
        studentId: child.studentId,
        error,
      });
      lessonsByStudent[child.studentId] = [];
    }
  }
  return (
    <ParentDashboard
      childrenContexts={learningContexts}
      homeworkByStudent={homeworkByStudent}
      communicationByStudent={Object.fromEntries(
        parentCommunication.map((item) => [item.studentId, item.messages]),
      )}
      lessonsByStudent={lessonsByStudent}
    />
  );
}
