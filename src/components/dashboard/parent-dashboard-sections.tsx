import Link from "next/link";
import { DashboardEmptyState, DashboardSection } from "@/components/dashboard/dashboard-section";
import { toScheduledLessonRoute } from "@/lib/auth";

export type ParentContext = {
  studentId: string;
  studentName: string;
  login: string;
  classes: Array<{
    classId: string;
    className: string;
    schoolId: string;
    schoolName: string;
  }>;
};

export type ParentHomeworkItem = {
  studentId: string;
  scheduledLessonId: string;
  lessonTitle: string;
  homeworkTitle: string;
  dueAt: string | null;
  statusLabel: string;
  assignmentComment: string | null;
  reviewNote: string | null;
  score: number | null;
  maxScore: number | null;
};

export function ParentChildSummary({ child }: { child: ParentContext }) {
  return (
    <header className="rounded-2xl border border-neutral-200 bg-neutral-50 p-3">
      <h2 className="text-base font-bold text-neutral-900">{child.studentName}</h2>
      <p className="text-sm text-neutral-600">Логин ученика: {child.login}</p>
      <p className="mt-1 text-xs text-neutral-500">Групп: {child.classes.length}</p>
    </header>
  );
}

export function ParentLessonsSection({
  lessons,
}: {
  lessons: Array<{ scheduledLessonId: string; lessonTitle: string; startsAt: string; statusLabel: string }>;
}) {
  return (
    <DashboardSection title="Ближайшие уроки">
      {lessons.length === 0 ? (
        <DashboardEmptyState>Пока нет запланированных уроков.</DashboardEmptyState>
      ) : (
        <ul className="space-y-2">
          {lessons.map((lesson) => (
            <li key={lesson.scheduledLessonId} className="rounded-xl border border-neutral-200 p-3">
              <p className="font-semibold text-neutral-900">{lesson.lessonTitle}</p>
              <p className="text-xs text-neutral-600">{lesson.startsAt} · {lesson.statusLabel}</p>
              <Link href={toScheduledLessonRoute(lesson.scheduledLessonId)} className="mt-2 inline-flex rounded-lg border border-neutral-300 px-2.5 py-1 text-xs font-semibold text-neutral-800">
                Открыть урок
              </Link>
            </li>
          ))}
        </ul>
      )}
    </DashboardSection>
  );
}

export function ParentHomeworkSection({ items }: { items: ParentHomeworkItem[] }) {
  return (
    <DashboardSection title="Домашняя работа">
      {items.length === 0 ? (
        <DashboardEmptyState>Домашние задания пока не назначены.</DashboardEmptyState>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={`${item.scheduledLessonId}-${item.homeworkTitle}`} className="rounded-xl border border-neutral-200 p-3">
              <p className="font-semibold text-neutral-900">{item.homeworkTitle}</p>
              <p className="text-xs text-neutral-500">{item.lessonTitle}</p>
              <p className="text-xs text-neutral-600">Срок: {item.dueAt ?? "без срока"} · {item.statusLabel}</p>
              {item.score !== null && item.maxScore !== null ? (
                <p className="text-xs text-neutral-700">Результат: {item.score} / {item.maxScore}</p>
              ) : null}
              {item.assignmentComment ? <p className="mt-1 text-xs text-neutral-700">Комментарий к заданию: {item.assignmentComment}</p> : null}
              {item.reviewNote ? <p className="mt-1 text-xs text-neutral-700">Комментарий после проверки: {item.reviewNote}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </DashboardSection>
  );
}

export function ParentCommunicationSection({
  messages,
}: {
  messages: Array<{
    id: string;
    authorRole: "teacher" | "student" | "parent";
    body: string;
    scheduledLessonId: string | null;
    scheduledLessonHomeworkAssignmentId: string | null;
  }>;
}) {
  return (
    <DashboardSection title="Последние сообщения" description="Режим просмотра">
      {messages.length === 0 ? (
        <DashboardEmptyState>Сообщений пока нет.</DashboardEmptyState>
      ) : (
        <ul className="space-y-1.5">
          {messages.slice(-3).map((message) => (
            <li key={message.id} className="text-sm text-neutral-700">
              <span className="font-medium text-neutral-900">{message.authorRole}:</span> {message.body}
            </li>
          ))}
        </ul>
      )}
    </DashboardSection>
  );
}
