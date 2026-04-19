import type { MethodologyLessonStep } from "@/lib/server/methodology-lesson-unified-read-model";
import { getScheduledLessonByIdAdmin, updateScheduledLessonRuntimeNotesAdmin } from "@/lib/server/lesson-content-repository";
import { buildMethodologyLessonUnifiedReadModel } from "@/lib/server/methodology-lesson-unified-read-model";
import { buildTeacherLessonProjection } from "@/lib/lesson-content";
import { getMethodologyLessonByIdAdmin } from "@/lib/server/lesson-content-repository";
import { assertTeacherAssignedToClassAdmin } from "@/lib/server/supabase-admin";
import { mapScheduledLessonLiveState, resolveActiveLessonStep } from "@/lib/server/scheduled-lesson-live-state";

export type LiveAction = "start" | "set_step" | "next" | "previous" | "complete";

function findStepOrThrow(
  steps: MethodologyLessonStep[],
  liveState: ReturnType<typeof mapScheduledLessonLiveState>,
) {
  const step = resolveActiveLessonStep(steps, liveState);
  if (!step) throw new Error("В уроке нет шагов.");
  return step;
}

export async function applyTeacherScheduledLessonLiveAction(input: {
  scheduledLessonId: string;
  teacherId: string;
  action: LiveAction;
  stepId?: string;
  stepOrder?: number;
}) {
  const scheduledLesson = await getScheduledLessonByIdAdmin(input.scheduledLessonId);
  if (!scheduledLesson) throw new Error("Урок не найден.");

  await assertTeacherAssignedToClassAdmin(
    input.teacherId,
    scheduledLesson.runtimeShell.classId,
  );

  const methodologyLesson = await getMethodologyLessonByIdAdmin(
    scheduledLesson.methodologyLessonId,
  );
  if (!methodologyLesson) throw new Error("Исходный урок методики не найден.");

  const projection = buildTeacherLessonProjection(methodologyLesson, scheduledLesson);
  const unified = buildMethodologyLessonUnifiedReadModel({
    lessonId: methodologyLesson.id,
    lessonShell: methodologyLesson.shell,
    presentation: {
      quickSummary: { prepChecklist: [], keyWords: [], keyPhrases: [], resources: [] },
      lessonFlow: projection.orderedBlocks.map((block) => ({
        id: block.id,
        order: block.order,
        stepLabel: `Шаг ${block.order}`,
        blockLabel: block.blockType,
        accentTone: "sky",
        title: block.title?.trim() || `Шаг ${block.order}`,
        teacherActions: [],
        studentActions: [],
        materials: [],
        resources: [],
      })),
    },
    studentContent: null,
    assetsById: {},
    canonicalHomework: null,
  });

  const liveState = mapScheduledLessonLiveState(scheduledLesson);
  const active = findStepOrThrow(unified.steps, liveState);

  if (liveState.runtimeStatus === "completed" && input.action !== "complete") {
    throw new Error("Завершённый урок нельзя переключать по шагам.");
  }
  if (liveState.runtimeStatus === "cancelled") {
    throw new Error("Отменённый урок нельзя изменить.");
  }

  if (input.action === "start") {
    const firstStep = unified.steps[0];
    if (!firstStep) throw new Error("В уроке нет шагов.");
    return updateScheduledLessonRuntimeNotesAdmin({
      scheduledLessonId: input.scheduledLessonId,
      runtimeStatus: "in_progress",
      runtimeCurrentStepId: scheduledLesson.runtimeShell.runtimeCurrentStepId ?? firstStep.id,
      runtimeCurrentStepOrder:
        scheduledLesson.runtimeShell.runtimeCurrentStepOrder ?? firstStep.order,
      runtimeStartedAt: scheduledLesson.runtimeShell.runtimeStartedAt ?? new Date().toISOString(),
      runtimeStudentNavigationLocked: true,
      runtimeStepUpdatedAt: new Date().toISOString(),
    });
  }

  if (input.action === "complete") {
    return updateScheduledLessonRuntimeNotesAdmin({
      scheduledLessonId: input.scheduledLessonId,
      runtimeStatus: "completed",
      runtimeStudentNavigationLocked: false,
      runtimeCompletedAt: new Date().toISOString(),
    });
  }

  let target = active;
  if (input.action === "next") {
    target = unified.steps.find((step) => step.order === active.order + 1) ?? active;
  } else if (input.action === "previous") {
    target = unified.steps.find((step) => step.order === active.order - 1) ?? active;
  } else if (input.action === "set_step") {
    target =
      unified.steps.find(
        (step) =>
          (input.stepId && step.id === input.stepId) ||
          (typeof input.stepOrder === "number" && step.order === input.stepOrder),
      ) ?? (() => {
        throw new Error("Шаг не найден в каноническом списке урока.");
      })();
  }

  return updateScheduledLessonRuntimeNotesAdmin({
    scheduledLessonId: input.scheduledLessonId,
    runtimeStatus:
      liveState.runtimeStatus === "planned" ? "in_progress" : liveState.runtimeStatus,
    runtimeCurrentStepId: target.id,
    runtimeCurrentStepOrder: target.order,
    runtimeStudentNavigationLocked: true,
    runtimeStepUpdatedAt: new Date().toISOString(),
    runtimeStartedAt:
      liveState.startedAt ??
      (liveState.runtimeStatus === "planned" ? new Date().toISOString() : undefined),
  });
}
