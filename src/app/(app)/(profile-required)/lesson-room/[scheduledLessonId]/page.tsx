import { notFound, redirect } from "next/navigation";
import { LearnerLessonRoom } from "@/components/lessons/learner-lesson-room";
import { ROUTES } from "@/lib/auth";
import { resolveAccessPolicy } from "@/lib/server/access-policy";
import { getStudentLessonRoomReadModel } from "@/lib/server/lesson-room";

export default async function StudentLessonRoomPage({ params }: { params: Promise<{ scheduledLessonId: string }> }) {
  const resolution = await resolveAccessPolicy();
  if (resolution.status !== "student") {
    redirect(ROUTES.dashboard);
  }

  const { scheduledLessonId } = await params;
  const studentId = resolution.context.student?.id ?? "";
  const model = await getStudentLessonRoomReadModel({ studentId, scheduledLessonId });
  if (!model) notFound();

  return <LearnerLessonRoom model={model} />;
}
