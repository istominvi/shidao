import Link from "next/link";
import { DashboardShell } from "@/components/dashboard-shell";
import {
  DashboardEmptyState,
  DashboardSection,
} from "@/components/dashboard/dashboard-section";
import { toScheduledLessonRoute } from "@/lib/auth";

type ParentContext = {
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

type ParentHomeworkItem = {
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

function ChildLessons({
  lessons,
}: {
  lessons: ParentDashboardProps["lessonsByStudent"][string];
}) {
  if (lessons.length === 0) {
    return <DashboardEmptyState>Пока нет запланированных уроков.</DashboardEmptyState>;
  }

  return (
    <ul className="space-y-2">
      {lessons.map((lesson) => (
        <li key={lesson.scheduledLessonId} className="rounded-xl border border-neutral-200 p-3">
          <p className="font-semibold text-neutral-900">{lesson.lessonTitle}</p>
          <p className="text-xs text-neutral-600">{lesson.startsAt} · {lesson.statusLabel}</p>
          <Link
            href={toScheduledLessonRoute(lesson.scheduledLessonId)}
            className="mt-2 inline-flex rounded-lg border border-neutral-300 px-2.5 py-1 text-xs font-semibold text-neutral-800"
          >
            Открыть урок
          </Link>
        </li>
      ))}
    </ul>
  );
}

function ChildHomework({ items }: { items: ParentHomeworkItem[] }) {
  if (items.length === 0) {
    return <DashboardEmptyState>Домашние задания пока не назначены.</DashboardEmptyState>;
  }

  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={`${item.scheduledLessonId}-${item.homeworkTitle}`} className="rounded-xl border border-neutral-200 p-3">
          <p className="font-semibold text-neutral-900">{item.homeworkTitle}</p>
          <p className="text-xs text-neutral-500">{item.lessonTitle}</p>
          <p className="text-xs text-neutral-600">Срок: {item.dueAt ?? "без срока"} · {item.statusLabel}</p>
          {item.score !== null && item.maxScore !== null ? (
            <p className="text-xs text-neutral-700">Результат: {item.score} / {item.maxScore}</p>
          ) : null}
          {item.assignmentComment ? (
            <p className="mt-1 text-xs text-neutral-700">Комментарий к заданию: {item.assignmentComment}</p>
          ) : null}
          {item.reviewNote ? (
            <p className="mt-1 text-xs text-neutral-700">Комментарий после проверки: {item.reviewNote}</p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function ChildCommunication({
  messages,
}: {
  messages: ParentDashboardProps["communicationByStudent"][string];
}) {
  if (messages.length === 0) {
    return <DashboardEmptyState>Сообщений пока нет.</DashboardEmptyState>;
  }

  return (
    <ul className="space-y-1.5">
      {messages.slice(-3).map((message) => (
        <li key={message.id} className="text-sm text-neutral-700">
          <span className="font-medium text-neutral-900">{message.authorRole}:</span> {message.body}
        </li>
      ))}
    </ul>
  );
}

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
            <article key={child.studentId} className="space-y-3 rounded-2xl border border-neutral-200 bg-white/70 p-3 md:p-4">
              <header>
                <h2 className="text-base font-bold text-neutral-900">{child.studentName}</h2>
                <p className="text-sm text-neutral-600">Логин ученика: {child.login}</p>
              </header>

              <div className="grid gap-3 lg:grid-cols-3">
                <DashboardSection title="Уроки">
                  <ChildLessons lessons={lessonsByStudent[child.studentId] ?? []} />
                </DashboardSection>
                <DashboardSection title="Домашняя работа">
                  <ChildHomework items={homeworkByStudent[child.studentId] ?? []} />
                </DashboardSection>
                <DashboardSection title="Последние сообщения" description="Режим просмотра">
                  <ChildCommunication messages={communicationByStudent[child.studentId] ?? []} />
                </DashboardSection>
              </div>
            </article>
          ))}
        </div>
      )}
    </DashboardShell>
  );
}
