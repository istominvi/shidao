import { notFound, redirect } from "next/navigation";
import { LearnerLessonRoom } from "@/components/lessons/learner-lesson-room";
import { ROUTES } from "@/lib/auth";
import { resolveAccessPolicy } from "@/lib/server/access-policy";
import { getParentLessonRoomReadModel } from "@/lib/server/lesson-room";

export default async function ParentLessonRoomPage({ params }: { params: Promise<{ studentId: string; scheduledLessonId: string }> }) {
  const resolution = await resolveAccessPolicy();
  if (resolution.status !== "adult-with-profile" || resolution.context.activeProfile !== "parent") {
    redirect(ROUTES.dashboard);
  }

  const { studentId, scheduledLessonId } = await params;
  const model = await getParentLessonRoomReadModel({
    userId: resolution.context.userId,
    studentId,
    scheduledLessonId,
  });
  if (!model) notFound();

  return <LearnerLessonRoom model={model} />;
}
