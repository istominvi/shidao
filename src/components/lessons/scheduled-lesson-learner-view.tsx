"use client";

import { useEffect, useMemo, useState } from "react";
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
  const [liveState, setLiveState] = useState(model.liveState);
  useEffect(() => {
    setLiveState(model.liveState);
  }, [model.liveState]);

  useEffect(() => {
    if (liveState.runtimeStatus !== "planned" && liveState.runtimeStatus !== "in_progress") {
      return;
    }
    const timer = window.setInterval(async () => {
      try {
        const response = await fetch(`/api/lessons/${model.scheduledLessonId}/live-state`, {
          method: "GET",
          cache: "no-store",
        });
        if (!response.ok) return;
        const data = (await response.json()) as { liveState?: typeof liveState };
        if (data.liveState) setLiveState(data.liveState);
      } catch {
        // Silent retry on next tick; do not interrupt learner UI.
      }
    }, 2000);
    return () => window.clearInterval(timer);
  }, [liveState.runtimeStatus, model.scheduledLessonId]);

  const controlledStepId = useMemo(() => {
    if (liveState.currentStepId) {
      const match = model.unifiedReadModel.steps.find((step) => step.id === liveState.currentStepId);
      if (match) return match.id;
    }
    if (liveState.currentStepOrder !== null) {
      return (
        model.unifiedReadModel.steps.find((step) => step.order === liveState.currentStepOrder)?.id ??
        model.unifiedReadModel.steps[0]?.id ??
        null
      );
    }
    return model.unifiedReadModel.steps[0]?.id ?? null;
  }, [liveState.currentStepId, liveState.currentStepOrder, model.unifiedReadModel.steps]);

  const learnerMode =
    liveState.runtimeStatus === "in_progress"
      ? "student_live_locked"
      : liveState.runtimeStatus === "completed"
        ? "student_review"
        : "teacher_preview";

  return (
    <div className="space-y-5">
      {liveState.runtimeStatus === "planned" ? (
        <SurfaceCard title="Урок скоро начнётся">
          <p className="text-sm text-neutral-700">Преподаватель откроет первый шаг.</p>
        </SurfaceCard>
      ) : null}
      {liveState.runtimeStatus === "cancelled" ? (
        <SurfaceCard title="Урок отменён">
          <p className="text-sm text-neutral-700">Пожалуйста, дождитесь нового расписания от преподавателя.</p>
        </SurfaceCard>
      ) : null}
      {liveState.runtimeStatus !== "planned" &&
      liveState.runtimeStatus !== "cancelled" ? (
        <SurfaceCard
          title={model.studentContent?.title ?? model.lessonTitle}
          description={model.studentContent?.subtitle}
        >
          <LessonLearnerContentDeck
            steps={model.unifiedReadModel.steps}
            source={model.studentContent}
            unavailableReason={model.studentContentUnavailableReason}
            assetsById={model.unifiedReadModel.assetsById}
            mode={learnerMode}
            controlledStepId={controlledStepId ?? undefined}
          />
        </SurfaceCard>
      ) : null}

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
