import type { ScheduledLesson, ScheduledLessonRuntimeShell } from "../lesson-content";
import type { AccessResolution } from "./access-policy";
import {
  getScheduledLessonByIdAdmin,
  updateScheduledLessonRuntimeNotesAdmin,
  type UpdateScheduledLessonRuntimeNotesAdminInput,
} from "./lesson-content-repository";
import { notifyLessonStatusChanged } from "./notification-service";
import { canAccessTeacherLessonWorkspace } from "./teacher-lesson-workspace";

const runtimeStatuses = ["planned", "in_progress", "completed", "cancelled"] as const;

export const TEACHER_RUNTIME_MUTABLE_FIELDS = [
  "runtimeStatus",
  "runtimeNotesSummary",
  "runtimeNotes",
  "outcomeNotes",
] as const;

type MutableField = (typeof TEACHER_RUNTIME_MUTABLE_FIELDS)[number];

export type TeacherRuntimeUpdatePayload = Pick<
  UpdateScheduledLessonRuntimeNotesAdminInput,
  MutableField
>;

type RuntimeMutationDeps = {
  getScheduledLessonById: typeof getScheduledLessonByIdAdmin;
  assertTeacherAssignedToClass: (teacherId: string, classId: string) => Promise<void>;
  updateScheduledLessonRuntimeNotes: typeof updateScheduledLessonRuntimeNotesAdmin;
};

async function assertTeacherAssignedToClassAdminDefault(
  teacherId: string,
  classId: string,
) {
  const { assertTeacherAssignedToClassAdmin } = await import("./supabase-admin");
  await assertTeacherAssignedToClassAdmin(teacherId, classId);
}

const defaultRuntimeMutationDeps: RuntimeMutationDeps = {
  getScheduledLessonById: getScheduledLessonByIdAdmin,
  assertTeacherAssignedToClass: assertTeacherAssignedToClassAdminDefault,
  updateScheduledLessonRuntimeNotes: updateScheduledLessonRuntimeNotesAdmin,
};

export function assertTeacherRuntimeMutationAccess(
  resolution: AccessResolution,
): { teacherId: string; userId: string } {
  if (
    resolution.status !== "adult-with-profile" ||
    !canAccessTeacherLessonWorkspace(resolution)
  ) {
    throw new Error("Только профиль преподавателя может изменять runtime-данные урока.");
  }

  const teacherId = resolution.context.teacher?.id;
  if (!teacherId) {
    throw new Error("Профиль преподавателя не найден.");
  }

  return { teacherId, userId: resolution.context.userId };
}

function normalizeText(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return "";
  return value.trim();
}

function parseRuntimeStatus(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    throw new Error("Неверный статус проведения.");
  }

  const normalized = value.trim() as ScheduledLessonRuntimeShell["runtimeStatus"];
  if (!runtimeStatuses.includes(normalized)) {
    throw new Error("Неверный статус проведения.");
  }

  return normalized;
}

function formatRuntimeStatusLabel(status: ScheduledLessonRuntimeShell["runtimeStatus"]) {
  if (status === "in_progress") return "Идёт урок";
  if (status === "completed") return "Урок завершён";
  if (status === "cancelled") return "Урок отменён";
  return "Запланирован";
}

export function parseTeacherRuntimeUpdateFormData(
  formData: FormData,
): TeacherRuntimeUpdatePayload {
  const allowedKeys = new Set(TEACHER_RUNTIME_MUTABLE_FIELDS);

  for (const key of formData.keys()) {
    if (!allowedKeys.has(key as MutableField)) {
      throw new Error("Обнаружены неподдерживаемые поля обновления runtime-данных.");
    }
  }

  return {
    runtimeStatus: parseRuntimeStatus(formData.get("runtimeStatus")),
    runtimeNotesSummary: normalizeText(formData.get("runtimeNotesSummary")),
    runtimeNotes: normalizeText(formData.get("runtimeNotes")),
    outcomeNotes: normalizeText(formData.get("outcomeNotes")),
  };
}

export async function updateTeacherLessonRuntime(
  input: {
    scheduledLessonId: string;
    teacherId: string;
    actorUserId?: string | null;
    payload: TeacherRuntimeUpdatePayload;
  },
  deps: RuntimeMutationDeps = defaultRuntimeMutationDeps,
): Promise<ScheduledLesson> {
  const scheduledLesson = await deps.getScheduledLessonById(input.scheduledLessonId);
  if (!scheduledLesson) {
    throw new Error("Урок не найден.");
  }

  await deps.assertTeacherAssignedToClass(
    input.teacherId,
    scheduledLesson.runtimeShell.classId,
  );

  const updated = await deps.updateScheduledLessonRuntimeNotes({
    scheduledLessonId: input.scheduledLessonId,
    runtimeStatus: input.payload.runtimeStatus,
    runtimeNotesSummary: input.payload.runtimeNotesSummary,
    runtimeNotes: input.payload.runtimeNotes,
    outcomeNotes: input.payload.outcomeNotes,
  });

  if (scheduledLesson.runtimeShell.runtimeStatus !== updated.runtimeShell.runtimeStatus) {
    try {
      await notifyLessonStatusChanged({
        actorUserId: input.actorUserId ?? null,
        classId: updated.runtimeShell.classId,
        scheduledLessonId: updated.id,
        status: updated.runtimeShell.runtimeStatus,
        statusLabel: formatRuntimeStatusLabel(updated.runtimeShell.runtimeStatus),
      });
    } catch (error) {
      console.warn("[notifications] notifyLessonStatusChanged(runtime) failed", error);
    }
  }

  return updated;
}
