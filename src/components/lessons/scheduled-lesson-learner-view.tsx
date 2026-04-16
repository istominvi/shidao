import { LessonLearnerContentDeck } from "@/components/lessons/lesson-learner-content-deck";
import { SurfaceCard } from "@/components/ui/surface-card";
import { StudentHomeworkQuizCard } from "@/components/dashboard/student-homework-quiz-card";
import type {
  ParentScheduledLessonView,
  ScheduledLessonPreviewView,
  StudentScheduledLessonView,
} from "@/lib/server/scheduled-lesson-view";

export function ScheduledLessonLearnerView({
  model,
}: {
  model:
    | StudentScheduledLessonView
    | ParentScheduledLessonView
    | ScheduledLessonPreviewView;
}) {
  return (
    <div className="space-y-5">
      <SurfaceCard title={model.studentContent?.title ?? model.lessonTitle} description={model.studentContent?.subtitle}>
        <LessonLearnerContentDeck
          source={model.studentContent}
          unavailableReason={model.studentContentUnavailableReason}
          assetsById={model.assetsById}
        />
      </SurfaceCard>

      {model.role === "student" && model.homework ? (
        <SurfaceCard title="Домашнее задание">
          <article className="mt-3 rounded-2xl border border-neutral-200 bg-white p-3">
            <p className="font-semibold text-neutral-900">
              {model.homework.homeworkTitle}
            </p>
            <p className="text-xs text-neutral-500">
              {model.homework.statusLabel} · Срок: {model.homework.dueAt ?? "без срока"}
            </p>
            <p className="mt-2 text-sm text-neutral-700">{model.homework.instructions}</p>
            {model.homework.kind === "practice_text" ? (
              <form className="mt-2 space-y-2" action={`/api/student/homework/${model.homework.studentHomeworkAssignmentId}/submit`} method="POST">
                <textarea
                  name="submissionText"
                  defaultValue={model.homework.submissionText ?? ""}
                  rows={3}
                  className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm"
                  placeholder="Напиши короткий ответ"
                />
                <button type="submit" className="rounded-xl bg-neutral-900 px-3 py-1.5 text-sm font-semibold text-white">
                  Отправить
                </button>
              </form>
            ) : (
              <StudentHomeworkQuizCard item={model.homework} />
            )}
          </article>
        </SurfaceCard>
      ) : null}

      {model.role === "student" && model.communication.length > 0 ? (
        <SurfaceCard title="Обсуждение по уроку">
          <div className="space-y-1 text-sm text-neutral-700">
            {model.communication.map((message) => (
              <p key={message.id}>
                <span className="font-medium">{message.authorRole}:</span> {message.body}
              </p>
            ))}
          </div>
        </SurfaceCard>
      ) : null}

      {model.role === "parent" ? (
        <SurfaceCard title="Дети на этом уроке">
          <div className="space-y-3">
            {model.childrenRuntime.map((child) => (
              <article key={child.studentId} className="rounded-2xl border border-neutral-200 bg-white p-3 text-sm">
                <p className="font-semibold text-neutral-900">{child.studentName}</p>
                <p className="text-xs text-neutral-500">{child.lessonStatusLabel}</p>
                {child.homework ? (
                  <>
                    <p className="mt-1 text-neutral-700">{child.homework.homeworkTitle} · {child.homework.statusLabel}</p>
                    {child.homework.score !== null && child.homework.maxScore !== null ? (
                      <p className="text-xs text-sky-800">Результат: {child.homework.score} / {child.homework.maxScore}</p>
                    ) : null}
                    {child.homework.assignmentComment ? <p className="text-xs text-neutral-700">Комментарий к выдаче: {child.homework.assignmentComment}</p> : null}
                    {child.homework.reviewNote ? <p className="text-xs text-neutral-700">Комментарий после проверки: {child.homework.reviewNote}</p> : null}
                  </>
                ) : (
                  <p className="mt-1 text-neutral-600">Домашнее задание пока не выдано.</p>
                )}
                {child.communicationPreview.length > 0 ? (
                  <div className="mt-2 rounded-xl border border-neutral-200 bg-neutral-50 p-2">
                    {child.communicationPreview.map((message) => (
                      <p key={message.id} className="text-xs text-neutral-700">
                        <span className="font-medium">{message.authorRole}:</span> {message.body}
                      </p>
                    ))}
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        </SurfaceCard>
      ) : null}
    </div>
  );
}
