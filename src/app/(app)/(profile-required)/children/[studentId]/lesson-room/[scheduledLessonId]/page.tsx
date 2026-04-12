import { notFound, redirect } from "next/navigation";
import { TopNav } from "@/components/top-nav";
import { LearnerLessonRoom } from "@/components/lessons/learner-lesson-room";
import { ROUTES } from "@/lib/auth";
import { resolveAccessPolicy } from "@/lib/server/access-policy";
import { getLearnerLessonRoomReadModel } from "@/lib/server/learner-lesson-room";
import { loadParentLearningContextsByUser } from "@/lib/server/supabase-admin";

export default async function ParentLessonRoomPage({
  params,
}: {
  params: Promise<{ studentId: string; scheduledLessonId: string }>;
}) {
  const access = await resolveAccessPolicy();
  if (access.status !== "adult-with-profile" || access.activeProfile !== "parent") {
    redirect(ROUTES.dashboard);
  }

  const { studentId, scheduledLessonId } = await params;
  const contexts = await loadParentLearningContextsByUser(access.context.userId);
  const child = contexts.find((item) => item.studentId === studentId);
  if (!child) notFound();

  const readModel = await getLearnerLessonRoomReadModel({
    scheduledLessonId,
    studentId,
    readOnlyHomework: true,
  });

  if (!readModel) notFound();

  return (
    <main className="pb-12">
      <TopNav />
      <div className="container py-7 md:py-10">
        <LearnerLessonRoom readModel={readModel} role="parent" />
      </div>
    </main>
  );
}
