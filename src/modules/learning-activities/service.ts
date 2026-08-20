import {
  CourseBuilderAccessError,
  CourseBuilderConflictError,
  CourseBuilderValidationError,
  uuidSchema,
} from "@/modules/course-builder/contracts";
import type {
  CourseBuilderActor,
  LessonComponent,
} from "@/modules/course-builder/domain";
import { CourseBuilderRepositoryError } from "@/modules/course-builder/repository";
import type { CourseBuilderApplicationService } from "@/modules/course-builder/service";
import { findComponentDefinition } from "@/modules/course-builder/registry/contracts";
import type { LessonRunsApplicationService } from "@/modules/lesson-runs/service";
import {
  OBSERVATION_COMPONENT_LABEL_MAX_LENGTH,
  OBSERVATION_COMPONENT_PROMPT_MAX_LENGTH,
  historyObservationLearningRecordIdsSchema,
  parseLearningActivitiesContract,
  saveLessonComponentObservationsInputSchema,
  type SaveLessonComponentObservationsInput,
} from "./contracts";
import type { RunObservationWorkspace } from "./domain";
import type { LearningActivitiesRepository } from "./repository";

type CourseReader = Pick<CourseBuilderApplicationService, "getCourse">;
type LessonRunReader = Pick<LessonRunsApplicationService, "getRun">;

export type LearningActivitiesServiceDependencies = {
  repository: LearningActivitiesRepository;
  courseBuilderService: CourseReader;
  lessonRunsService: LessonRunReader;
};

export type LearningActivitiesApplicationService = ReturnType<
  typeof createLearningActivitiesService
>;

function collapseWhitespace(value: string) {
  return value.replace(/\s+/gu, " ").trim();
}

function boundedExcerpt(value: string, max: number) {
  const normalized = collapseWhitespace(value);
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

/**
 * The at-time label is deliberately derived from the existing registry and a
 * tiny allowlist of prompt-like fields. It never serializes the Component
 * payload, answer keys, placement or Student Screen metadata.
 */
export function observationComponentLabel(component: LessonComponent) {
  const definition = findComponentDefinition(component.typeKey);
  if (!definition || component.schemaVersion !== definition.version) {
    throw new CourseBuilderConflictError(
      "Компонент использует неподдерживаемую версию schema.",
      "lesson_component_schema_unsupported",
    );
  }

  const parsedPayload = definition.payloadSchema.safeParse(component.payload);
  if (!parsedPayload.success) {
    throw new CourseBuilderConflictError(
      "Компонент содержит неподдерживаемые данные.",
      "lesson_component_schema_unsupported",
    );
  }

  const payload = parsedPayload.data as Record<string, unknown>;
  const promptValue = ["instruction", "question", "prompt"]
    .map((key) => payload[key])
    .find((value): value is string =>
      Boolean(typeof value === "string" && collapseWhitespace(value)),
    );
  const prompt = promptValue
    ? boundedExcerpt(promptValue, OBSERVATION_COMPONENT_PROMPT_MAX_LENGTH)
    : "";
  return boundedExcerpt(
    prompt ? `${definition.title}: ${prompt}` : definition.title,
    OBSERVATION_COMPONENT_LABEL_MAX_LENGTH,
  );
}

export function createLearningActivitiesService(
  dependencies: LearningActivitiesServiceDependencies,
) {
  const { repository, courseBuilderService, lessonRunsService } = dependencies;

  async function readOwnedWorkspace(
    actor: CourseBuilderActor,
    lessonRunIdValue: string,
  ): Promise<RunObservationWorkspace> {
    const lessonRunId = parseLearningActivitiesContract(
      uuidSchema,
      lessonRunIdValue,
    );
    const run = await lessonRunsService.getRun(actor, lessonRunId);
    const course = await courseBuilderService.getCourse(actor, run.courseId);
    const lesson = course.lessons.find(
      (candidate) => candidate.id === run.lessonId,
    );
    if (!lesson) {
      throw new CourseBuilderAccessError("Урок занятия не найден.");
    }
    const observations = await repository.listByLearningRecordIds(
      run.records.map((record) => record.id),
    );
    return {
      run,
      lesson,
      attachments: course.attachments,
      observations,
    };
  }

  function assertRunAcceptsObservations(workspace: RunObservationWorkspace) {
    const { run } = workspace;
    if (run.endedAt || run.cancelledAt) {
      throw new CourseBuilderConflictError(
        "Завершённое или отменённое занятие нельзя изменить.",
        "lesson_run_closed",
      );
    }
    if (!run.startedAt || run.startedAtIsActual !== true) {
      throw new CourseBuilderConflictError(
        "Сначала явно начните урок.",
        "lesson_run_not_started",
      );
    }
  }

  function requireRunComponent(
    workspace: RunObservationWorkspace,
    lessonComponentId: string,
  ) {
    const component = workspace.lesson.components.find(
      (candidate) => candidate.id === lessonComponentId,
    );
    if (!component || component.lessonId !== workspace.run.lessonId) {
      throw new CourseBuilderAccessError(
        "Компонент не принадлежит уроку этого занятия.",
      );
    }
    return component;
  }

  function assertRunRecords(
    workspace: RunObservationWorkspace,
    input: SaveLessonComponentObservationsInput,
  ) {
    const records = new Map(
      workspace.run.records.map((record) => [record.id, record] as const),
    );
    for (const entry of input.entries) {
      const record = records.get(entry.learningRecordId);
      if (
        !record ||
        record.lessonRunId !== workspace.run.id ||
        record.occurredAt !== null
      ) {
        throw new CourseBuilderAccessError(
          "Учебная запись не принадлежит ожидаемому участнику этого занятия.",
        );
      }
    }
  }

  async function runMutation<T>(operation: () => Promise<T>) {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof CourseBuilderRepositoryError) {
        if (
          /lesson_component_observation_not_found|(?:run|lesson_run|component|learning_record)_not_found|component_not_in_(?:lesson_)?run|learning_record_not_in_(?:lesson_)?run/.test(
            error.message,
          )
        ) {
          throw new CourseBuilderAccessError(
            "Занятие, компонент или учебная запись недоступны.",
          );
        }
        if (
          /lesson_run_not_started|observation_run_not_started/.test(
            error.message,
          )
        ) {
          throw new CourseBuilderConflictError(
            "Сначала явно начните урок.",
            "lesson_run_not_started",
          );
        }
        if (
          /lesson_run_not_open|lesson_run_closed|observation_run_closed/.test(
            error.message,
          )
        ) {
          throw new CourseBuilderConflictError(
            "Завершённое или отменённое занятие нельзя изменить.",
            "lesson_run_closed",
          );
        }
        if (/observation_criterion_(?:changed|mismatch)/.test(error.message)) {
          throw new CourseBuilderConflictError(
            "Критерий уже используется в сохранённых отметках. Обновите занятие.",
            "observation_criterion_changed",
          );
        }
        if (
          /lesson_component_observations_invalid|lesson_component_observation_(?:entry_invalid|record_duplicate|criterion_required)|observable_criterion_required|observation_(?:input|entry|rating|method|note)_invalid/.test(
            error.message,
          )
        ) {
          throw new CourseBuilderValidationError(
            "Проверьте критерий и отметки наблюдения.",
          );
        }
      }
      throw error;
    }
  }

  return {
    async listHistoryObservations(
      _actor: CourseBuilderActor,
      learningRecordIdsValue: string[] | unknown,
    ) {
      const learningRecordIds = parseLearningActivitiesContract(
        historyObservationLearningRecordIdsSchema,
        learningRecordIdsValue,
      );
      return repository.listByLearningRecordIds(learningRecordIds);
    },

    async getRunWorkspace(
      actor: CourseBuilderActor,
      lessonRunId: string,
    ): Promise<RunObservationWorkspace> {
      return readOwnedWorkspace(actor, lessonRunId);
    },

    async saveRunObservations(
      actor: CourseBuilderActor,
      lessonRunId: string,
      rawInput: SaveLessonComponentObservationsInput | unknown,
    ) {
      const input = parseLearningActivitiesContract(
        saveLessonComponentObservationsInputSchema,
        rawInput,
      );
      const workspace = await readOwnedWorkspace(actor, lessonRunId);
      assertRunAcceptsObservations(workspace);
      const component = requireRunComponent(workspace, input.lessonComponentId);
      assertRunRecords(workspace, input);

      await runMutation(() =>
        repository.saveRunObservations({
          lessonRunId: workspace.run.id,
          lessonComponentId: component.id,
          componentLabelAtTime: observationComponentLabel(component),
          observableCriterionAtTime: input.observableCriterionAtTime,
          entryMethod: input.entryMethod,
          entries: input.entries,
        }),
      );

      return repository.listByLearningRecordIds(
        workspace.run.records.map((record) => record.id),
      );
    },
  };
}
