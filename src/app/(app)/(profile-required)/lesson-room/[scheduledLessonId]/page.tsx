import { notFound, redirect } from "next/navigation";
import { LearnerLessonRoom } from "@/components/lessons/learner-lesson-room";
import { TopNav } from "@/components/top-nav";
import { ROUTES } from "@/lib/auth";
import { resolveAccessPolicy } from "@/lib/server/access-policy";
import {
  getLessonRoomPreviewByScheduledLessonId,
  getStudentLessonRoomReadModel,
} from "@/lib/server/learner-lesson-room";
import { listClassIdsForStudentAdmin } from "@/lib/server/lesson-content-repository";

export default async function StudentLessonRoomPage({
  params,
}: {
  params: Promise<{ scheduledLessonId: string }>;
}) {
  const resolution = await resolveAccessPolicy();
  const { scheduledLessonId } = await params;

  if (resolution.status === "guest" || resolution.status === "degraded") {
    redirect(ROUTES.login);
  }
  if (resolution.status === "adult-without-profile") {
    redirect(ROUTES.onboarding);
  }

  if (resolution.context.actorKind === "student") {
    const studentId = resolution.context.student?.id ?? "";
    const classIds = studentId ? await listClassIdsForStudentAdmin(studentId) : [];
    const model = await getStudentLessonRoomReadModel({
      studentId,
      classIds,
      scheduledLessonId,
    }).catch((error) => {
      console.error(
        "[StudentLessonRoomPage] failed to load student lesson room",
        {
          scheduledLessonId,
          studentId,
          error,
        },
      );
      return null;
    });

    if (!model) notFound();

    return (
      <main className="pb-12">
        <div className="landing-noise" aria-hidden="true" />
        <TopNav />
        <div className="container py-7 md:py-10">
          <LearnerLessonRoom
            model={model}
            role="student"
            header={{
              title: "Ученическая версия урока",
              subtitle: "Повторяй слова и активности урока в удобном темпе.",
            }}
          />
        </div>
      </main>
    );
  }

  if (resolution.context.activeProfile === "teacher") {
    const preview = await getLessonRoomPreviewByScheduledLessonId(
      scheduledLessonId,
    ).catch((error) => {
      console.error("[StudentLessonRoomPage] failed to load lesson room preview", {
        scheduledLessonId,
        error,
      });
      return null;
    });
    if (!preview) notFound();

    return (
      <main className="pb-12">
        <div className="landing-noise" aria-hidden="true" />
        <TopNav />
        <div className="container py-7 md:py-10">
          <LearnerLessonRoom
            model={{ ...preview, homework: null }}
            role="student"
            header={{
              title: "Режим показа для урока",
              subtitle: "Так контент видят ученики во время и после занятия.",
            }}
          />
        </div>
      </main>
    );
  }

  redirect(ROUTES.dashboard);
}
