import { DashboardShell } from "@/components/dashboard-shell";
import { toParentLessonRoomRoute } from "@/lib/auth";

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

export function ParentDashboard({
  childrenContexts,
  homeworkByStudent,
  communicationByStudent,
  parentLessonsByStudent,
}: {
  childrenContexts: ParentContext[];
  homeworkByStudent: Record<string, ParentHomeworkItem[]>;
  parentLessonsByStudent: Record<string, Array<{ scheduledLessonId: string; startsAt: string; status: string; title: string }>>;
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
}) {
  return (
    <DashboardShell
      roleLabel="Родитель"
      roleTone="parent"
      title="Семейное учебное пространство"
      subtitle="Только главное: что задано, что сдано и какой результат у ребёнка."
    >
      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <article className="dashboard-grid-card bg-[linear-gradient(140deg,rgba(201,255,79,0.24),rgba(255,255,255,0.92))]">
          <h3 className="text-lg font-black">Мои дети</h3>
          {childrenContexts.length > 0 && (
            <ul className="mt-3 space-y-3 text-sm">
              {childrenContexts.map((child) => (
                <li
                  key={child.studentId}
                  className="rounded-2xl border border-black/10 bg-white/80 p-3"
                >
                  <p className="font-semibold">{child.studentName}</p>
                  <p className="mt-1 text-neutral-700">Логин ученика: {child.login}</p>
                  <div className="mt-2 space-y-2">
                    <div className="rounded-xl border border-neutral-200 bg-white p-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">Занятия</p>
                      {(parentLessonsByStudent[child.studentId] ?? []).slice(0, 6).map((lesson) => (
                        <p key={lesson.scheduledLessonId} className="mt-1 text-xs">
                          {lesson.title} · <a className="text-sky-700 underline" href={toParentLessonRoomRoute(child.studentId, lesson.scheduledLessonId)}>Открыть</a>
                        </p>
                      ))}
                    </div>
                    {(homeworkByStudent[child.studentId] ?? []).map((item) => (
                      <article key={`${item.scheduledLessonId}-${item.homeworkTitle}`} className="rounded-xl border border-neutral-200 bg-white p-2">
                        <p className="font-semibold text-neutral-900">{item.homeworkTitle}</p>
                        <p className="text-xs text-neutral-500">{item.lessonTitle}</p>
                        <p className="text-xs text-neutral-600">Срок: {item.dueAt ?? "без срока"} · {item.statusLabel}</p>
                        {item.score !== null && item.maxScore !== null ? (
                          <p className="text-xs text-sky-800">Результат: {item.score} / {item.maxScore}</p>
                        ) : null}
                        {item.assignmentComment ? <p className="text-xs text-neutral-700">Комментарий к заданию: {item.assignmentComment}</p> : null}
                        {item.reviewNote ? <p className="text-xs text-neutral-700">Комментарий после проверки: {item.reviewNote}</p> : null}
                      </article>
                    ))}
                  </div>
                  <div className="mt-2 rounded-xl border border-neutral-200 p-2 text-xs text-neutral-700">
                    <p className="font-semibold text-neutral-900">Коммуникация (read-only)</p>
                    {(communicationByStudent[child.studentId] ?? [])
                      .slice(-3)
                      .map((message) => (
                        <p key={message.id} className="mt-1">
                          {message.authorRole}: {message.body}
                        </p>
                      ))}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </article>

        <article className="dashboard-grid-card bg-[linear-gradient(160deg,rgba(255,182,232,0.24),rgba(255,255,255,0.9))]">
          <h3 className="text-lg font-black">Что включено</h3>
          <ul className="mt-3 space-y-2 text-sm text-neutral-700">
            <li>• Домашние задания по каждому ребёнку</li>
            <li>• Статус сдачи и проверки</li>
            <li>• Результат теста и комментарии преподавателя</li>
          </ul>
        </article>
      </div>
    </DashboardShell>
  );
}
