"use client";

import { Check, ChevronLeft, ChevronRight, Play } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { TeacherLessonWorkspaceReadModel } from "@/lib/server/teacher-lesson-workspace";
import { LessonStudentContentPanel } from "@/components/lessons/lesson-student-content-panel";
import { TeacherLessonPedagogicalContent } from "@/components/lessons/teacher-lesson-pedagogical-content";
import { TeacherHomeworkPanel } from "@/components/lessons/teacher-homework-panel";
import { LessonGroupChatPanel } from "@/components/lessons/lesson-group-chat-panel";
import {
  TeacherLessonTabs,
  type TeacherLessonTabKey,
} from "@/components/lessons/teacher-lesson-tabs";
import { productButtonClassName } from "@/components/ui/button";
import { SurfaceCard } from "@/components/ui/surface-card";

type TeacherLessonWorkspaceProps = {
  workspace: TeacherLessonWorkspaceReadModel;
  runtimeFormFeedback?: {
    success?: string;
    error?: string;
  };
};

type LiveActionHandler = (payload: Record<string, unknown>) => void;

function LiveLessonControlBar({
  liveState,
  liveStepId,
  steps,
  pending,
  onAction,
}: {
  liveState: TeacherLessonWorkspaceReadModel["liveState"];
  liveStepId: string | null;
  steps: TeacherLessonWorkspaceReadModel["unifiedReadModel"]["steps"];
  pending: boolean;
  onAction: LiveActionHandler;
}) {
  const activeStep = steps.find((step) => step.id === liveStepId) ?? steps[0] ?? null;
  const activeIndex = activeStep
    ? steps.findIndex((step) => step.id === activeStep.id)
    : -1;
  const isCompletedOrCancelled =
    liveState.runtimeStatus === "completed" ||
    liveState.runtimeStatus === "cancelled";
  const canStart = liveState.runtimeStatus === "planned";
  const canComplete = !isCompletedOrCancelled;
  const canPrevious = !isCompletedOrCancelled && activeIndex > 0;
  const canNext =
    !isCompletedOrCancelled && activeIndex >= 0 && activeIndex < steps.length - 1;

  return (
    <div className="rounded-3xl border border-sky-200 bg-sky-50 p-5 text-sm text-sky-900">
      <p className="font-semibold">
        {liveState.runtimeStatus === "in_progress"
          ? "Идёт занятие"
          : liveState.runtimeStatus === "completed"
            ? "Урок завершён"
            : liveState.runtimeStatus === "cancelled"
              ? "Урок отменён"
              : "Запланировано"}
      </p>
      <p className="mt-1">
        Сейчас у учеников: Шаг {activeStep?.order ?? 1}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {canStart ? (
          <button
            type="button"
            className={productButtonClassName("secondary", "text-sm")}
            disabled={pending}
            onClick={() => void onAction({ action: "start" })}
          >
            <Play className="h-4 w-4" aria-hidden="true" />
            Начать урок
          </button>
        ) : null}
        <button
          type="button"
          disabled={!canPrevious || pending}
          className={productButtonClassName("secondary", "text-sm")}
          onClick={() => void onAction({ action: "previous" })}
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          Предыдущий шаг
        </button>
        <button
          type="button"
          disabled={!canNext || pending}
          className={productButtonClassName("secondary", "text-sm")}
          onClick={() => void onAction({ action: "next" })}
        >
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
          Следующий шаг
        </button>
        <button
          type="button"
          disabled={!canComplete || pending}
          className={productButtonClassName("secondary", "text-sm")}
          onClick={() => void onAction({ action: "complete" })}
        >
          <Check className="h-4 w-4" aria-hidden="true" />
          Завершить урок
        </button>
      </div>
    </div>
  );
}

export function TeacherLessonWorkspace({
  workspace,
  runtimeFormFeedback,
}: TeacherLessonWorkspaceProps) {
  const router = useRouter();
  const [tab, setTab] = useState<TeacherLessonTabKey>("plan");
  const [liveActionError, setLiveActionError] = useState<string | null>(null);
  const runtime = workspace.projection.runtimeShell;
  const { quickSummary } = workspace.unifiedReadModel;
  const planSteps = workspace.unifiedReadModel.steps;
  const [liveState, setLiveState] = useState(workspace.liveState);
  const [liveStepId, setLiveStepId] = useState<string | null>(workspace.liveActiveStepId);
  const [livePending, setLivePending] = useState(false);

  useEffect(() => {
    setLiveState(workspace.liveState);
    setLiveStepId(workspace.liveActiveStepId);
    setLivePending(false);
  }, [workspace.liveActiveStepId, workspace.liveState, workspace.scheduledLessonId]);

  const stepById = useMemo(
    () => new Map(planSteps.map((step) => [step.id, step] as const)),
    [planSteps],
  );

  const callLiveAction = async (payload: Record<string, unknown>) => {
    setLiveActionError(null);
    const response = await fetch(
      `/api/teacher/lessons/${workspace.scheduledLessonId}/live-state`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      throw new Error(data.error ?? "Не удалось обновить live-состояние урока.");
    }
    router.refresh();
  };

  const applyOptimisticLiveState = (payload: Record<string, unknown>) => {
    const action = String(payload.action ?? "");
    const resolvedActiveStep =
      planSteps.find((step) => step.id === liveStepId) ?? planSteps[0] ?? null;
    const activeIndex = resolvedActiveStep
      ? planSteps.findIndex((step) => step.id === resolvedActiveStep.id)
      : -1;

    if (action === "set_step") {
      const stepId = String(payload.stepId ?? "");
      const step = stepById.get(stepId);
      if (step) {
        setLiveStepId(step.id);
      }
      if (liveState.runtimeStatus === "planned") {
        setLiveState((previous) => ({ ...previous, runtimeStatus: "in_progress" }));
      }
      return;
    }
    if (action === "start") {
      setLiveState((previous) => ({ ...previous, runtimeStatus: "in_progress" }));
      if (!resolvedActiveStep && planSteps[0]) {
        setLiveStepId(planSteps[0].id);
      }
      return;
    }
    if (action === "next") {
      const nextStep = activeIndex >= 0 ? planSteps[activeIndex + 1] : planSteps[0];
      if (nextStep) setLiveStepId(nextStep.id);
      if (liveState.runtimeStatus === "planned") {
        setLiveState((previous) => ({ ...previous, runtimeStatus: "in_progress" }));
      }
      return;
    }
    if (action === "previous") {
      const previousStep = activeIndex > 0 ? planSteps[activeIndex - 1] : null;
      if (previousStep) setLiveStepId(previousStep.id);
      return;
    }
    if (action === "complete") {
      setLiveState((previous) => ({ ...previous, runtimeStatus: "completed" }));
    }
  };

  const runLiveAction = (payload: Record<string, unknown>, fallbackMessage: string) => {
    setLivePending(true);
    applyOptimisticLiveState(payload);
    void callLiveAction(payload)
      .catch((error) => {
        setLiveActionError(error instanceof Error ? error.message : fallbackMessage);
      })
      .finally(() => {
        setLivePending(false);
      });
  };

  return (
    <div className="space-y-8 lg:space-y-10">
      <section>
        <LiveLessonControlBar
          liveState={liveState}
          liveStepId={liveStepId}
          steps={planSteps}
          pending={livePending}
          onAction={(payload) => runLiveAction(payload, "Не удалось обновить live-режим урока.")}
        />
      </section>

      <SurfaceCard as="section" className="p-5 md:p-6" bodyClassName="mt-0">
        <TeacherLessonTabs
          tabs={["plan", "student_screen", "homework", "chat"]}
          activeTab={tab}
          onTabChange={setTab}
          tone="embedded"
        />
        {liveActionError ? (
          <p className="mt-4 rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            Не удалось обновить live-режим урока: {liveActionError}
          </p>
        ) : null}

        <div className="mt-5">
          {tab === "plan" ? (
            <TeacherLessonPedagogicalContent
              quickSummary={quickSummary}
              steps={planSteps}
              durationLabel={workspace.unifiedReadModel.lesson.durationLabel}
              summaryNote={workspace.presentation.hero.lessonEssence}
              activeStudentStepId={liveStepId}
              assetsById={workspace.unifiedReadModel.assetsById}
              lessonIdentity={{
                methodologySlug: workspace.sourceLesson.methodologySlug,
                moduleIndex: workspace.unifiedReadModel.lesson.moduleIndex,
                lessonIndex: workspace.unifiedReadModel.lesson.lessonIndex,
                lessonTitle: workspace.unifiedReadModel.lesson.title,
              }}
              lessonNotesSlot={
                <form
                  className="mt-4 space-y-3"
                  action={`/api/teacher/lessons/${workspace.scheduledLessonId}/runtime`}
                  method="POST"
                >
                  {runtimeFormFeedback?.success ? (
                    <p className="rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                      {runtimeFormFeedback.success}
                    </p>
                  ) : null}
                  {runtimeFormFeedback?.error ? (
                    <p className="rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                      {runtimeFormFeedback.error}
                    </p>
                  ) : null}
                  <input type="hidden" name="runtimeStatus" value={runtime.runtimeStatus} />
                  <input
                    type="hidden"
                    name="runtimeNotesSummary"
                    value={runtime.runtimeNotesSummary ?? ""}
                  />
                  <input
                    type="hidden"
                    name="outcomeNotes"
                    value={workspace.projection.outcomeNotes ?? ""}
                  />
                  <label className="block">
                    <textarea
                      name="runtimeNotes"
                      rows={5}
                      defaultValue={workspace.projection.runtimeNotes ?? ""}
                      className="mt-1.5 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm text-neutral-900"
                      placeholder="Личные заметки преподавателя по уроку"
                    />
                  </label>
                  <button
                    type="submit"
                    className="inline-flex items-center rounded-xl bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-neutral-800"
                  >
                    Сохранить заметки
                  </button>
                </form>
              }
              onShowOnStudentScreen={(stepId) => {
                const step = workspace.unifiedReadModel.steps.find((item) => item.id === stepId);
                if (!step) return;
                runLiveAction(
                  { action: "set_step", stepId: step.id, stepOrder: step.order },
                  "Не удалось показать шаг ученикам.",
                );
              }}
              onOpenStudentScreen={(stepId) => {
                const step = workspace.unifiedReadModel.steps.find((item) => item.id === stepId);
                if (!step) return;
                setLiveActionError(null);
                setLivePending(true);
                applyOptimisticLiveState({
                  action: "set_step",
                  stepId: step.id,
                  stepOrder: step.order,
                });
                void callLiveAction({
                  action: "set_step",
                  stepId: step.id,
                  stepOrder: step.order,
                })
                  .then(() => setTab("student_screen"))
                  .catch((error) => {
                    setLiveActionError(
                      error instanceof Error
                        ? error.message
                        : "Не удалось открыть экран ученика.",
                    );
                  })
                  .finally(() => {
                    setLivePending(false);
                  });
              }}
            />
          ) : null}

          {tab === "student_screen" ? (
            <LessonStudentContentPanel
              steps={workspace.unifiedReadModel.steps}
              source={workspace.studentContent.source}
              unavailableReason={workspace.studentContent.unavailableReason}
              assetsById={workspace.unifiedReadModel.assetsById}
              embedded
              showFullscreenControl
              mode="teacher_preview"
              controlledStepId={liveStepId ?? undefined}
              onStepChange={(stepId) => {
                const step = workspace.unifiedReadModel.steps.find((item) => item.id === stepId);
                if (!step) return;
                runLiveAction(
                  { action: "set_step", stepId: step.id, stepOrder: step.order },
                  "Не удалось показать выбранный шаг ученикам.",
                );
              }}
            />
          ) : null}

          {tab === "homework" ? (
            <TeacherHomeworkPanel
              homework={workspace.homework}
              scheduledLessonId={workspace.scheduledLessonId}
            />
          ) : null}

          {tab === "chat" ? (
            <LessonGroupChatPanel scheduledLessonId={workspace.scheduledLessonId} canWrite />
          ) : null}
        </div>
      </SurfaceCard>
    </div>
  );
}
