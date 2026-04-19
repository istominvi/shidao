import type { MethodologyLessonStep } from "@/lib/server/methodology-lesson-unified-read-model";
import type { ScheduledLesson } from "@/lib/lesson-content";

export type ScheduledLessonLiveState = {
  runtimeStatus: "planned" | "in_progress" | "completed" | "cancelled";
  currentStepId: string | null;
  currentStepOrder: number | null;
  studentNavigationLocked: boolean;
  stepUpdatedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
};

export function mapScheduledLessonLiveState(
  scheduledLesson: ScheduledLesson,
): ScheduledLessonLiveState {
  return {
    runtimeStatus: scheduledLesson.runtimeShell.runtimeStatus,
    currentStepId: scheduledLesson.runtimeShell.runtimeCurrentStepId ?? null,
    currentStepOrder: scheduledLesson.runtimeShell.runtimeCurrentStepOrder ?? null,
    studentNavigationLocked:
      scheduledLesson.runtimeShell.runtimeStudentNavigationLocked ?? true,
    stepUpdatedAt: scheduledLesson.runtimeShell.runtimeStepUpdatedAt ?? null,
    startedAt: scheduledLesson.runtimeShell.runtimeStartedAt ?? null,
    completedAt: scheduledLesson.runtimeShell.runtimeCompletedAt ?? null,
  };
}

export function resolveActiveLessonStep(
  steps: MethodologyLessonStep[],
  liveState: ScheduledLessonLiveState,
): MethodologyLessonStep | null {
  if (!steps.length) return null;
  if (liveState.currentStepId) {
    const matchedById = steps.find((step) => step.id === liveState.currentStepId);
    if (matchedById) return matchedById;
  }
  if (liveState.currentStepOrder !== null) {
    const matchedByOrder = steps.find(
      (step) => step.order === liveState.currentStepOrder,
    );
    if (matchedByOrder) return matchedByOrder;
  }
  return steps[0] ?? null;
}
