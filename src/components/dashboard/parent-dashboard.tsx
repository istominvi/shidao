import { DashboardShell } from "@/components/dashboard-shell";
// lesson route links are implemented in section components via toScheduledLessonRoute.
import { DashboardEmptyState, DashboardSection } from "@/components/dashboard/dashboard-section";
import {
  ParentChildSummary,
  ParentCommunicationSection,
  ParentHomeworkSection,
  ParentLessonsSection,
  type ParentContext,
  type ParentHomeworkItem,
} from "@/components/dashboard/parent-dashboard-sections";

type ParentDashboardProps = {
  childrenContexts: ParentContext[];
  homeworkByStudent: Record<string, ParentHomeworkItem[]>;
  communicationByStudent: Record<
    string,
    Array<{
      id: string;
      authorRole: "teacher" | "student" | "parent";
      body: string;
      scheduledLessonId: string | null;
      scheduledLessonHomeworkAssignmentId: string | null;
    }>
  >;
  lessonsByStudent: Record<
    string,
    Array<{
      scheduledLessonId: string;
      lessonTitle: string;
      startsAt: string;
      statusLabel: string;
    }>
  >;
};

export function ParentDashboard({
  childrenContexts,
  homeworkByStudent,
  communicationByStudent,
  lessonsByStudent,
}: ParentDashboardProps) {
  return (
    <DashboardShell
      roleLabel="Родитель"
      roleTone="parent"
      title="Кабинет родителя"
      subtitle="Сводка по ребёнку: уроки, домашняя работа и комментарии преподавателя."
    >
      {childrenContexts.length === 0 ? (
        <DashboardSection title="Детей пока нет" description="Добавьте ученика через преподавателя, чтобы увидеть прогресс.">
          <DashboardEmptyState>После привязки ученика здесь появится учебная сводка.</DashboardEmptyState>
        </DashboardSection>
      ) : (
        <div className="space-y-4">
          {childrenContexts.map((child) => (
            <article key={child.studentId} className="space-y-3 rounded-2xl border border-neutral-200 bg-white p-3 md:p-4">
              <ParentChildSummary child={child} />
              <div className="grid gap-3 lg:grid-cols-3">
                <ParentLessonsSection lessons={lessonsByStudent[child.studentId] ?? []} />
                <ParentHomeworkSection items={homeworkByStudent[child.studentId] ?? []} />
                <ParentCommunicationSection messages={communicationByStudent[child.studentId] ?? []} />
              </div>
            </article>
          ))}
        </div>
      )}
    </DashboardShell>
  );
}
