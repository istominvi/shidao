import { notFound, redirect } from "next/navigation";
import { LearnerLessonRoom } from "@/components/lessons/learner-lesson-room";
import { TopNav } from "@/components/top-nav";
import { ROUTES } from "@/lib/auth";
import { resolveAccessPolicy } from "@/lib/server/access-policy";
import { getParentLessonRoomReadModel } from "@/lib/server/learner-lesson-room";

export default async function ParentLessonRoomPage({
  params,
}: {
  params: Promise<{ studentId: string; scheduledLessonId: string }>;
}) {
  const resolution = await resolveAccessPolicy();
  if (resolution.status === "guest" || resolution.status === "degraded") {
    redirect(ROUTES.login);
  }
  if (resolution.status === "adult-without-profile") {
    redirect(ROUTES.onboarding);
  }

  if (resolution.context.activeProfile !== "parent") {
    redirect(ROUTES.dashboard);
  }

  const { studentId, scheduledLessonId } = await params;
  const model = await getParentLessonRoomReadModel({
    userId: resolution.context.userId,
    studentId,
    scheduledLessonId,
  });

  if (!model) notFound();

  return (
    <main className="pb-12">
      <div className="landing-noise" aria-hidden="true" />
      <TopNav />
      <div className="container py-7 md:py-10">
        <LearnerLessonRoom
          model={model}
          role="parent"
          header={{
            title: "Урок ребёнка",
            subtitle: "Материалы урока и домашнее задание в режиме только чтение.",
          }}
        />
      </div>
    </main>
  );
}
