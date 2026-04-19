import { redirect } from "next/navigation";
import { AppPageHeader } from "@/components/app/page-header";
import { StudentHomeworkQuizCard } from "@/components/dashboard/student-homework-quiz-card";
import { TopNav } from "@/components/top-nav";
import { SurfaceCard } from "@/components/ui/surface-card";
import { ROUTES } from "@/lib/auth";
import { resolveAccessPolicy } from "@/lib/server/access-policy";
import type { GroupStudentMessage } from "@/lib/server/communication-repository";
import { getStudentConversationReadModels } from "@/lib/server/communication-service";
import { listClassIdsForStudentAdmin } from "@/lib/server/lesson-content-repository";
import { logger } from "@/lib/server/logger";
import { getStudentHomeworkReadModel, type StudentHomeworkCard } from "@/lib/server/student-homework";

function kindBadge(kind: StudentHomeworkCard["kind"]) {
  return kind === "quiz_single_choice" ? "Тест" : "Практика";
}

function HomeworkThreadPreview({
  item,
  communication,
}: {
  item: StudentHomeworkCard;
  communication: Awaited<ReturnType<typeof getStudentConversationReadModels>>;
}) {
  const messages = communication
    .filter((thread) => thread.classId === item.classId)
    .flatMap((thread) =>
      thread.messages.filter(
        (message: GroupStudentMessage) =>
          message.scheduledLessonHomeworkAssignmentId ===
          item.scheduledHomeworkAssignmentId,
      ),
    )
    .slice(-2);

  return (
    <div className="mt-3 rounded-xl border border-neutral-200 p-2.5">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-neutral-500">
        Обсуждение задания
      </p>
      {messages.length === 0 ? (
        <p className="mt-1 text-sm text-neutral-600">Пока без сообщений.</p>
      ) : (
        <ul className="mt-1 space-y-1 text-sm">
          {messages.map((message) => (
            <li key={message.id}>
              <span className="font-medium">{message.authorRole}:</span> {message.body}
            </li>
          ))}
        </ul>
      )}
      <form action="/api/student/communication" method="POST" className="mt-2 space-y-2">
        <input type="hidden" name="classId" value={item.classId} />
        <input type="hidden" name="scheduledLessonId" value={item.scheduledLessonId} />
        <input
          type="hidden"
          name="scheduledLessonHomeworkAssignmentId"
          value={item.scheduledHomeworkAssignmentId}
        />
        <input type="hidden" name="topicKind" value="homework" />
        <input type="hidden" name="redirectTo" value={ROUTES.homework} />
        <textarea
          name="body"
          rows={2}
          className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm"
          placeholder="Сообщение преподавателю"
        />
        <button
          type="submit"
          className="rounded-xl border border-neutral-300 px-3 py-1.5 text-xs font-semibold"
        >
          Отправить
        </button>
      </form>
    </div>
  );
}

export default async function StudentHomeworkPage() {
  const resolution = await resolveAccessPolicy();

  if (resolution.status === "guest" || resolution.status === "degraded") {
    redirect(ROUTES.login);
  }

  if (resolution.status === "adult-without-profile") {
    redirect(ROUTES.onboarding);
  }

  if (resolution.context.actorKind !== "student") {
    redirect(ROUTES.dashboard);
  }

  const studentId = resolution.context.student?.id;
  if (!studentId) {
    redirect(ROUTES.login);
  }

  const classIds = await listClassIdsForStudentAdmin(studentId);
  const homework = await getStudentHomeworkReadModel({ studentId, classIds });

  let communication: Awaited<ReturnType<typeof getStudentConversationReadModels>> = [];
  try {
    communication = await getStudentConversationReadModels({ studentId, filter: "all" });
  } catch (error) {
    logger.error("[homework] failed to load student communication projection", {
      studentId,
      userId: resolution.context.userId,
      error,
    });
  }

  return (
    <main className="pb-12">
      <div className="landing-noise" aria-hidden="true" />
      <TopNav />
      <div className="container app-page-container space-y-6">
        <AppPageHeader
          eyebrow="Кабинет ученика"
          title="Домашнее задание"
          description="Все выданные задания: и ожидающие сдачи, и уже проверенные."
        />

        <SurfaceCard title="Список заданий" description={`Всего: ${homework.length}`}>
          {homework.length === 0 ? (
            <p className="text-sm text-neutral-600">Пока преподаватель не выдал домашнее задание.</p>
          ) : (
            <ul className="space-y-3">
              {homework.map((item) => (
                <li key={item.studentHomeworkAssignmentId} className="rounded-2xl border border-neutral-200 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">{item.homeworkTitle}</p>
                    <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-semibold text-neutral-700">
                      {kindBadge(item.kind)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-neutral-500">
                    {item.lessonTitle} · Срок: {item.dueAt ?? "без срока"}
                  </p>
                  <p className="mt-1 text-xs text-neutral-500">
                    {item.statusLabel} · Группа: {item.groupLabel} · Преподаватель: {item.teacherLabel}
                  </p>
                  {item.issueComment ? (
                    <p className="mt-1 text-sm text-neutral-700">Комментарий учителя: {item.issueComment}</p>
                  ) : null}

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
                      <button
                        type="submit"
                        className="rounded-xl bg-neutral-900 px-3 py-1.5 text-sm font-semibold text-white"
                      >
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
                    <p className="mt-2 text-sm text-neutral-700">Комментарий: {item.reviewNote}</p>
                  ) : null}
                  <HomeworkThreadPreview item={item} communication={communication} />
                </li>
              ))}
            </ul>
          )}
        </SurfaceCard>
      </div>
    </main>
  );
}
