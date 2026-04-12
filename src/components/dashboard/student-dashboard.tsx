import { DashboardShell } from "@/components/dashboard-shell";
import { StudentHomeworkQuizCard } from "@/components/dashboard/student-homework-quiz-card";
import Link from "next/link";
import type { GroupStudentMessage } from "@/lib/server/communication-repository";
import type { StudentHomeworkCard } from "@/lib/server/student-homework";
import type { getStudentConversationReadModels } from "@/lib/server/communication-service";
import { toStudentLessonRoomRoute } from "@/lib/auth";

function kindBadge(kind: StudentHomeworkCard["kind"]) {
  return kind === "quiz_single_choice" ? "Тест" : "Практика";
}

export function StudentDashboard({
  homework,
  communication,
  lessons,
}: {
  homework: StudentHomeworkCard[];
  communication: Awaited<ReturnType<typeof getStudentConversationReadModels>>;
  lessons: Array<{
    scheduledLessonId: string;
    lessonTitle: string;
    startsAt: string;
    statusLabel: string;
  }>;
}) {
  return (
    <DashboardShell
      roleLabel="Ученик"
      roleTone="student"
      title="Твой учебный кабинет"
      subtitle="Короткие задания, понятные шаги и поддержка преподавателя."
    >
      <section className="mt-4 rounded-3xl border border-white/80 bg-white/90 p-4">
        <h3 className="text-lg font-black">Мои занятия</h3>
        {lessons.length === 0 ? (
          <p className="mt-2 text-sm text-neutral-600">Пока нет назначенных занятий.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {lessons.map((lesson) => (
              <article key={lesson.scheduledLessonId} className="rounded-2xl border border-neutral-200 p-3">
                <p className="font-semibold">{lesson.lessonTitle}</p>
                <p className="text-xs text-neutral-500">{lesson.startsAt} · {lesson.statusLabel}</p>
                <Link href={toStudentLessonRoomRoute(lesson.scheduledLessonId)} className="mt-2 inline-flex rounded-xl border border-sky-300 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-800">
                  Открыть урок
                </Link>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="mt-4 rounded-3xl border border-white/80 bg-white/90 p-4">
        <h3 className="text-lg font-black">Мои домашние задания</h3>
        {homework.length === 0 ? (
          <p className="mt-2 text-sm text-neutral-600">
            Пока преподаватель не выдал домашнее задание.
          </p>
        ) : (
          <div className="mt-3 space-y-3">
            {homework.map((item) => (
              <article key={item.studentHomeworkAssignmentId} className="rounded-2xl border border-neutral-200 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold">{item.homeworkTitle}</p>
                  <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-semibold text-sky-800">{kindBadge(item.kind)}</span>
                </div>
                <p className="mt-1 text-xs text-neutral-500">{item.lessonTitle} · Срок: {item.dueAt ?? "без срока"}</p>
                <p className="mt-1 text-xs text-neutral-500">{item.statusLabel}</p>
                {item.issueComment ? <p className="mt-1 text-sm text-neutral-700">Комментарий учителя: {item.issueComment}</p> : null}

                {item.kind === "practice_text" ? (
                  <form
                    className="mt-2 space-y-2"
                    action={`/api/student/homework/${item.studentHomeworkAssignmentId}/submit`}
                    method="POST"
                  >
                    <p className="text-sm text-neutral-700">{item.instructions}</p>
                    <textarea
                      name="submissionText"
                      defaultValue={item.submissionText ?? ""}
                      rows={3}
                      className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm"
                      placeholder="Напиши короткий ответ"
                    />
                    <button type="submit" className="rounded-xl bg-neutral-900 px-3 py-1.5 text-sm font-semibold text-white">
                      Отправить
                    </button>
                  </form>
                ) : (
                  <>
                    <p className="mt-2 text-sm text-neutral-700">{item.instructions}</p>
                    <StudentHomeworkQuizCard item={item} />
                  </>
                )}

                {item.reviewNote ? (
                  <p className="mt-2 text-sm text-sky-800">Комментарий: {item.reviewNote}</p>
                ) : null}
                <div className="mt-3 rounded-xl border border-neutral-200 p-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">Обсуждение этого ДЗ</p>
                  <div className="mt-1 space-y-1 text-sm">
                    {communication
                      .filter((thread) => thread.classId === item.classId)
                      .flatMap((thread) =>
                        thread.messages.filter(
                          (message: GroupStudentMessage) =>
                            message.scheduledLessonHomeworkAssignmentId ===
                            item.scheduledHomeworkAssignmentId,
                        ),
                      )
                      .slice(-2)
                      .map((message) => (
                        <p key={message.id}>
                          <span className="font-medium">{message.authorRole}:</span>{" "}
                          {message.body}
                        </p>
                      ))}
                  </div>
                  <form action="/api/student/communication" method="POST" className="mt-2 space-y-2">
                    <input type="hidden" name="classId" value={item.classId} />
                    <input type="hidden" name="scheduledLessonId" value={item.scheduledLessonId} />
                    <input type="hidden" name="scheduledLessonHomeworkAssignmentId" value={item.scheduledHomeworkAssignmentId} />
                    <input type="hidden" name="topicKind" value="homework" />
                    <input type="hidden" name="redirectTo" value="/dashboard" />
                    <textarea name="body" rows={2} className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm" placeholder="Сообщение преподавателю" />
                    <button type="submit" className="rounded-xl border border-neutral-300 px-3 py-1.5 text-xs font-semibold">Отправить</button>
                  </form>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </DashboardShell>
  );
}
