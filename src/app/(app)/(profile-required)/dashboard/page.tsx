import { redirect } from "next/navigation";
import { ParentDashboard } from "@/components/dashboard/parent-dashboard";
import { StudentDashboard } from "@/components/dashboard/student-dashboard";
import { TeacherDashboard } from "@/components/dashboard/teacher-dashboard";
import { TopNav } from "@/components/top-nav";
import { ROUTES } from "@/lib/auth";
import { resolveAccessPolicy } from "@/lib/server/access-policy";
import { getParentCommunicationProjection, getStudentConversationReadModels } from "@/lib/server/communication-service";
import { getParentHomeworkProjection } from "@/lib/server/parent-homework";
import { listClassIdsForStudentAdmin } from "@/lib/server/lesson-content-repository";
import { getStudentHomeworkReadModel } from "@/lib/server/student-homework";
import { listLearnerScheduledLessonsForStudent } from "@/lib/server/lesson-room";
import { getTeacherDashboardOperationsReadModel } from "@/lib/server/teacher-dashboard-operations";
import { loadParentLearningContextsByUser } from "@/lib/server/supabase-admin";

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
    const studentId = context.student?.id;
    const classIds = studentId ? await listClassIdsForStudentAdmin(studentId) : [];
    const homework = studentId
      ? await getStudentHomeworkReadModel({ studentId, classIds })
      : [];
    const communication = studentId
      ? await getStudentConversationReadModels({ studentId, filter: "all" })
      : [];
    const lessons = studentId ? await listLearnerScheduledLessonsForStudent({ studentId }) : [];
    return <StudentDashboard homework={homework} communication={communication} lessons={lessons} />;
  }

  if (context.activeProfile === "teacher") {
    const teacherId = context.teacher?.id;
    if (!teacherId) {
      redirect(ROUTES.onboarding);
    }

    const query = await searchParams;
    const readModel = await getTeacherDashboardOperationsReadModel({
      teacherId,
      search: query.q,
      methodology: query.methodology,
    });

    return (
      <main className="pb-12">
        <div className="landing-noise" aria-hidden="true" />
        <TopNav />
        <div className="container py-7 md:py-10">
          <TeacherDashboard readModel={readModel} />
        </div>
      </main>
    );
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
  const parentLessonsByStudent = Object.fromEntries(
    await Promise.all(learningContexts.map(async (child) => [child.studentId, await listLearnerScheduledLessonsForStudent({ studentId: child.studentId })])),
  );
  return (
    <ParentDashboard
      childrenContexts={learningContexts}
      homeworkByStudent={homeworkByStudent}
      parentLessonsByStudent={parentLessonsByStudent}
      communicationByStudent={Object.fromEntries(
        parentCommunication.map((item) => [item.studentId, item.messages]),
      )}
    />
  );
}
