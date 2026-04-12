import { notFound, redirect } from "next/navigation";
import { TopNav } from "@/components/top-nav";
import { LearnerLessonRoom } from "@/components/lessons/learner-lesson-room";
import { ROUTES } from "@/lib/auth";
import { resolveAccessPolicy } from "@/lib/server/access-policy";
import { getLearnerLessonRoomReadModel } from "@/lib/server/learner-lesson-room";

export default async function StudentLessonRoomPage({
  params,
}: {
  params: Promise<{ scheduledLessonId: string }>;
}) {
  const access = await resolveAccessPolicy();
  if (access.status === "guest" || access.status === "degraded") redirect(ROUTES.login);

  const { scheduledLessonId } = await params;

  if (access.status !== "student") {
    redirect(ROUTES.dashboard);
  }

  const studentId = access.context.student?.id;
  if (!studentId) redirect(ROUTES.dashboard);

  const readModel = await getLearnerLessonRoomReadModel({
    scheduledLessonId,
    studentId,
    readOnlyHomework: false,
  });

  if (!readModel) notFound();

  return (
    <main className="pb-12">
      <TopNav />
      <div className="container py-7 md:py-10">
        <LearnerLessonRoom readModel={readModel} role="student" />
      </div>
    </main>
  );
}
