import { DashboardShell } from "@/components/dashboard-shell";
// lesson route links are implemented in section components via toScheduledLessonRoute.
import {
  StudentHomeworkList,
  StudentLessonsList,
} from "@/components/dashboard/student-dashboard-sections";
import type { getStudentConversationReadModels } from "@/lib/server/communication-service";
import type { StudentHomeworkCard } from "@/lib/server/student-homework";

type StudentDashboardProps = {
  homework: StudentHomeworkCard[];
  communication: Awaited<ReturnType<typeof getStudentConversationReadModels>>;
  lessons: Array<{
    scheduledLessonId: string;
    lessonTitle: string;
    startsAt: string;
    statusLabel: string;
  }>;
};

export function StudentDashboard({
  homework,
  communication,
  lessons,
}: StudentDashboardProps) {
  return (
    <DashboardShell
      roleLabel="Ученик"
      roleTone="student"
      title="Кабинет ученика"
      subtitle="Текущие уроки, домашние задания и связь с преподавателем."
    >
      <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <StudentLessonsList lessons={lessons} />
        <StudentHomeworkList homework={homework} communication={communication} />
      </div>
    </DashboardShell>
  );
}
