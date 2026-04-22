"use client";

import { useEffect, useMemo, useState } from "react";
import { ExternalLink } from "lucide-react";
import { useRouter } from "next/navigation";
import { LessonStudentContentPanel } from "@/components/lessons/lesson-student-content-panel";
import { productButtonClassName } from "@/components/ui/button";
import { SurfaceCard } from "@/components/ui/surface-card";
import { StudentHomeworkQuizCard } from "@/components/dashboard/student-homework-quiz-card";
import { LessonGroupChatPanel } from "@/components/lessons/lesson-group-chat-panel";
import { TeacherLessonTabs, type TeacherLessonTabKey } from "@/components/lessons/teacher-lesson-tabs";
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
  const modelHomework = model.role === "student" ? model.homework : null;
  const router = useRouter();
  const [liveState, setLiveState] = useState(model.liveState);
  const [studentHomework, setStudentHomework] = useState(modelHomework);
  const [studentTab, setStudentTab] = useState<"lesson" | "homework" | "chat">(
    modelHomework ? "homework" : "lesson",
  );
  useEffect(() => {
    setLiveState(model.liveState);
  }, [model.liveState]);
  useEffect(() => {
    if (model.role !== "student") return;
    setStudentHomework(modelHomework);
    if (modelHomework) {
      setStudentTab("homework");
      return;
    }
    setStudentTab("lesson");
  }, [model.role, modelHomework]);

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

  useEffect(() => {
    if (model.role !== "student") return;
    if (liveState.runtimeStatus === model.runtimeStatus) return;
    router.refresh();
  }, [liveState.runtimeStatus, model.role, model.runtimeStatus, router]);

  useEffect(() => {
    if (model.role !== "student" || studentHomework) return;
    const timer = window.setInterval(async () => {
      try {
        const response = await fetch(`/api/student/lessons/${model.scheduledLessonId}/homework`, {
          method: "GET",
          cache: "no-store",
        });
        if (!response.ok) return;
        const data = (await response.json()) as { homework?: typeof studentHomework };
        if (data.homework) setStudentHomework(data.homework);
      } catch {
        // Silent retry on next tick; do not interrupt learner UI.
      }
    }, 2000);
    return () => window.clearInterval(timer);
  }, [model.role, model.scheduledLessonId, studentHomework]);

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

  const lessonPanel = (
    <>
      {liveState.runtimeStatus === "planned" ? (
        <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3">
          <p className="text-base font-semibold text-neutral-900">Учитель ещё не начал урок</p>
        </div>
      ) : null}
      {liveState.runtimeStatus === "cancelled" ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3">
          <p className="text-base font-semibold text-neutral-900">Урок отменён</p>
          <p className="mt-2 text-sm text-neutral-700">Пожалуйста, дождитесь нового расписания от преподавателя.</p>
        </div>
      ) : null}
      {liveState.runtimeStatus !== "planned" && liveState.runtimeStatus !== "cancelled" ? (
        <LessonStudentContentPanel
          title="Экран ученика"
          embedded
          showFullscreenControl
          steps={model.unifiedReadModel.steps}
          source={model.studentContent}
          unavailableReason={model.studentContentUnavailableReason}
          assetsById={model.unifiedReadModel.assetsById}
          mode={learnerMode}
          controlledStepId={learnerMode === "student_live_locked" ? controlledStepId ?? undefined : undefined}
        />
      ) : null}
    </>
  );

  const studentActiveTab: TeacherLessonTabKey = studentTab === "lesson" ? "plan" : studentTab;
  const onlineMeetingAction =
    model.connection.kind === "online" && model.connection.meetingLink && model.connection.ctaLabel ? (
      <a
        href={model.connection.meetingLink}
        target="_blank"
        rel="noreferrer noopener"
        className={productButtonClassName("secondary", "text-sm")}
      >
        <span>{model.connection.ctaLabel}</span>
        <ExternalLink className="h-4 w-4" aria-hidden="true" />
      </a>
    ) : null;

  const homeworkPanel =
    model.role === "student" && studentHomework ? (
      <section>
        <article className="rounded-2xl border border-neutral-200 bg-white p-3">
          <p className="font-semibold text-neutral-900">
            {studentHomework.homeworkTitle}
          </p>
          <p className="text-xs text-neutral-500">
            {studentHomework.statusLabel} · Срок: {studentHomework.dueAt ?? "без срока"}
          </p>
          <p className="mt-2 text-sm text-neutral-700">{studentHomework.instructions}</p>
          {studentHomework.kind === "practice_text" ? (
            <form className="mt-2 space-y-2" action={`/api/student/homework/${studentHomework.studentHomeworkAssignmentId}/submit`} method="POST">
              <textarea
                name="submissionText"
                defaultValue={studentHomework.submissionText ?? ""}
                rows={3}
                className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm"
                placeholder="Напиши короткий ответ"
              />
              <button type="submit" className="rounded-xl bg-neutral-900 px-3 py-1.5 text-sm font-semibold text-white">
                Отправить
              </button>
            </form>
          ) : (
            <StudentHomeworkQuizCard item={studentHomework} />
          )}
        </article>
      </section>
    ) : (
      <section className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3">
        <p className="text-sm text-neutral-600">Домашнее задание пока не выдано.</p>
      </section>
    );

  return (
    <div className="space-y-5">
      {model.role === "student" ? (
        <SurfaceCard as="section" className="p-5 md:p-6" bodyClassName="mt-0">
          <div className="-mx-5 md:-mx-6">
            <div className="px-5 md:px-6">
              <TeacherLessonTabs
                tabs={["plan", "homework", "chat"]}
                activeTab={studentActiveTab}
                onTabChange={(tab) => {
                  if (tab === "plan" || tab === "student_screen") {
                    setStudentTab("lesson");
                    return;
                  }
                  if (tab === "homework" && !studentHomework) return;
                  if (tab === "homework" || tab === "chat") {
                    setStudentTab(tab);
                  }
                }}
                tone="embedded"
                trailingActions={onlineMeetingAction}
              />
            </div>
          </div>
          <div className="mt-5">
            {studentTab === "lesson" ? lessonPanel : null}
            {studentTab === "homework" ? homeworkPanel : null}
            {studentTab === "chat" ? (
              <LessonGroupChatPanel scheduledLessonId={model.scheduledLessonId} canWrite />
            ) : null}
          </div>
        </SurfaceCard>
      ) : null}

      {model.role !== "student" ? lessonPanel : null}

      {model.role === "parent" ? (
        <>
          <LessonGroupChatPanel scheduledLessonId={model.scheduledLessonId} canWrite={false} />
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
                </article>
              ))}
            </div>
          </SurfaceCard>
        </>
      ) : null}
    </div>
  );
}
