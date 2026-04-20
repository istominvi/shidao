import { redirect } from "next/navigation";
import { ParentDashboard } from "@/components/dashboard/parent-dashboard";
import { TopNav } from "@/components/top-nav";
import { ROUTES } from "@/lib/auth";
import { resolveAccessPolicy } from "@/lib/server/access-policy";
import { getParentCommunicationProjection } from "@/lib/server/communication-service";
import { getParentHomeworkProjection } from "@/lib/server/parent-homework";
import {
  getMethodologyLessonByIdAdmin,
  listScheduledLessonsForClassesAdmin,
} from "@/lib/server/lesson-content-repository";
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

export default async function DashboardIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; methodology?: string }>;
}) {
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

  const learningContexts = await loadParentLearningContextsByUser(context.userId);
  const parentHomework = await getParentHomeworkProjection({
    children: learningContexts.map((child) => ({
      studentId: child.studentId,
      classIds: child.classes.map((item) => item.classId),
    })),
  });
  const homeworkByStudent = Object.fromEntries(
    parentHomework.map((item) => [item.studentId, item.items]),
  );
  const parentCommunication = await getParentCommunicationProjection({ userId: context.userId });
  const lessonsByStudent: Record<
    string,
    Array<{
      scheduledLessonId: string;
      lessonTitle: string;
      startsAt: string;
      statusLabel: string;
    }>
  > = {};
  for (const child of learningContexts) {
    const lessons = child.classes.length
      ? await listScheduledLessonsForClassesAdmin(child.classes.map((item) => item.classId))
      : [];
    lessonsByStudent[child.studentId] = await Promise.all(
      lessons.slice(0, 6).map(async (lesson) => {
        const methodologyLesson = await getMethodologyLessonByIdAdmin(
          lesson.methodologyLessonId,
        );
        return {
          scheduledLessonId: lesson.id,
          lessonTitle: methodologyLesson?.shell.title ?? "Урок",
          startsAt: formatStartsAt(lesson.runtimeShell.startsAt),
          statusLabel: formatStatus(lesson.runtimeShell.runtimeStatus),
        };
      }),
    );
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
