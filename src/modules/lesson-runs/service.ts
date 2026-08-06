import {
  CourseBuilderAccessError,
  CourseBuilderConflictError,
  uuidSchema,
} from "@/modules/course-builder/contracts";
import type { CourseBuilderActor } from "@/modules/course-builder/domain";
import {
  assertSameLearnerSet,
  completeLessonRunInputSchema,
  createLearnerProfileInputSchema,
  lessonRunWindowInputSchema,
  parseLessonRunsContract,
  replaceCourseAudienceInputSchema,
  rescheduleLessonRunInputSchema,
  scheduleLessonRunInputSchema,
  type CompleteLessonRunInput,
  type CreateLearnerProfileInput,
  type LessonRunWindowInput,
  type ReplaceCourseAudienceInput,
  type RescheduleLessonRunInput,
  type ScheduleLessonRunInput,
} from "./contracts";
import type { LessonRun, LearnerProfile } from "./domain";
import type {
  CourseHistoryOptions,
  LearningRecordHistoryOptions,
  LessonRunsRepository,
} from "./repository";
import { LESSON_RUN_HISTORY_HARD_LIMIT } from "./repository";
import { CourseBuilderRepositoryError } from "@/modules/course-builder/repository";

export type LessonRunsServiceDependencies = {
  repository: LessonRunsRepository;
};

export type LessonRunsApplicationService = ReturnType<
  typeof createLessonRunsService
>;

export function createLessonRunsService(
  dependencies: LessonRunsServiceDependencies,
) {
  const repository = dependencies.repository;

  async function requireAccountId(actor: CourseBuilderActor) {
    const authUserId = parseLessonRunsContract(uuidSchema, actor.authUserId);
    const accountId = await repository.getAccountId(authUserId);
    if (!accountId) {
      throw new CourseBuilderAccessError(
        "Для текущей Auth-сессии не найден Account.",
      );
    }
    return accountId;
  }

  async function requireOwnedCourse(
    actor: CourseBuilderActor,
    courseIdValue: string,
  ) {
    const courseId = parseLessonRunsContract(uuidSchema, courseIdValue);
    const [accountId, course] = await Promise.all([
      requireAccountId(actor),
      repository.getCourse(courseId),
    ]);
    if (!course || course.ownerAccountId !== accountId) {
      throw new CourseBuilderAccessError();
    }
    return { accountId, course };
  }

  async function requireOwnedLesson(
    actor: CourseBuilderActor,
    lessonIdValue: string,
  ) {
    const lessonId = parseLessonRunsContract(uuidSchema, lessonIdValue);
    const lesson = await repository.getLesson(lessonId);
    if (!lesson) throw new CourseBuilderAccessError("Урок не найден.");
    const { accountId, course } = await requireOwnedCourse(
      actor,
      lesson.courseId,
    );
    return { accountId, course, lesson };
  }

  async function requireOwnedLearner(
    actor: CourseBuilderActor,
    learnerProfileIdValue: string,
  ) {
    const learnerProfileId = parseLessonRunsContract(
      uuidSchema,
      learnerProfileIdValue,
    );
    const [accountId, learnerProfile] = await Promise.all([
      requireAccountId(actor),
      repository.getLearnerProfile(learnerProfileId),
    ]);
    if (!learnerProfile || learnerProfile.ownerAccountId !== accountId) {
      throw new CourseBuilderAccessError("Профиль ученика не найден.");
    }
    return { accountId, learnerProfile };
  }

  async function requireOwnedRun(
    actor: CourseBuilderActor,
    lessonRunIdValue: string,
  ) {
    const lessonRunId = parseLessonRunsContract(uuidSchema, lessonRunIdValue);
    const [accountId, context] = await Promise.all([
      requireAccountId(actor),
      repository.getRun(lessonRunId),
    ]);
    if (!context || context.ownerAccountId !== accountId) {
      throw new CourseBuilderAccessError("Занятие не найдено.");
    }
    return context.run;
  }

  async function requireAudienceSubset(
    courseId: string,
    requestedIds: string[] | undefined,
  ) {
    const audience = await repository.listCourseAudience(courseId);
    const audienceIds = new Set(audience.map((profile) => profile.id));
    const selectedIds = requestedIds ?? [...audienceIds];
    if (selectedIds.some((learnerId) => !audienceIds.has(learnerId))) {
      throw new CourseBuilderAccessError(
        "Для занятия можно выбрать только учеников аудитории курса.",
      );
    }
    if (selectedIds.length === 0) {
      throw new CourseBuilderConflictError(
        "Сначала добавьте хотя бы одного ученика в аудиторию курса.",
        "lesson_run_audience_required",
      );
    }
    return selectedIds;
  }

  async function requireOwnedLearnerIds(
    ownerAccountId: string,
    learnerProfileIds: string[],
  ) {
    const ownedIds = new Set(
      (await repository.listLearnerProfiles(ownerAccountId)).map(
        (profile) => profile.id,
      ),
    );
    if (learnerProfileIds.some((learnerId) => !ownedIds.has(learnerId))) {
      throw new CourseBuilderAccessError(
        "Один или несколько профилей ученика недоступны.",
      );
    }
  }

  function assertRunIsOpen(run: LessonRun) {
    if (run.endedAt || run.cancelledAt) {
      throw new CourseBuilderConflictError(
        "Завершённое или отменённое занятие нельзя изменить.",
        "lesson_run_closed",
      );
    }
  }

  function assertHistoryLimit(limit: number | undefined) {
    if (
      limit !== undefined &&
      (!Number.isInteger(limit) ||
        limit < 1 ||
        limit > LESSON_RUN_HISTORY_HARD_LIMIT)
    ) {
      throw new CourseBuilderConflictError(
        `Лимит истории должен быть от 1 до ${LESSON_RUN_HISTORY_HARD_LIMIT}.`,
        "lesson_run_history_limit_invalid",
      );
    }
  }

  async function runMutation<T>(operation: () => Promise<T>) {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof CourseBuilderRepositoryError) {
        if (/_(?:not_found|not_in_course)/.test(error.message)) {
          throw new CourseBuilderAccessError(
            "Занятие или один из его учеников больше недоступны.",
          );
        }
        if (/lesson_run_requires_expected_learner/.test(error.message)) {
          throw new CourseBuilderConflictError(
            "Сначала добавьте хотя бы одного ученика в аудиторию курса.",
            "lesson_run_audience_required",
          );
        }
        if (/lesson_run_already_started/.test(error.message)) {
          throw new CourseBuilderConflictError(
            "Начавшееся занятие уже нельзя перенести.",
            "lesson_run_started",
          );
        }
        if (/lesson_run_changed/.test(error.message)) {
          throw new CourseBuilderConflictError(
            "Занятие уже изменилось. Обновите страницу.",
            "lesson_run_changed",
          );
        }
        if (
          /records_do_not_match|contains_finalized_records/.test(error.message)
        ) {
          throw new CourseBuilderConflictError(
            "Состав или результаты занятия уже изменились. Обновите страницу.",
            "lesson_run_participants_changed",
          );
        }
        if (/lesson_run_(?:not_open|already_completed)/.test(error.message)) {
          throw new CourseBuilderConflictError(
            "Занятие уже завершено или отменено.",
            "lesson_run_closed",
          );
        }
      }
      throw error;
    }
  }

  return {
    async listLearnerProfiles(
      actor: CourseBuilderActor,
    ): Promise<LearnerProfile[]> {
      const accountId = await requireAccountId(actor);
      return repository.listLearnerProfiles(accountId);
    },

    async createLearnerProfile(
      actor: CourseBuilderActor,
      rawInput: CreateLearnerProfileInput | unknown,
    ) {
      const accountId = await requireAccountId(actor);
      const input = parseLessonRunsContract(
        createLearnerProfileInputSchema,
        rawInput,
      );
      return repository.createLearnerProfile(accountId, input);
    },

    async listCourseAudience(actor: CourseBuilderActor, courseId: string) {
      const { course } = await requireOwnedCourse(actor, courseId);
      return repository.listCourseAudience(course.id);
    },

    async replaceCourseAudience(
      actor: CourseBuilderActor,
      courseId: string,
      rawInput: ReplaceCourseAudienceInput | unknown,
    ) {
      const { accountId, course } = await requireOwnedCourse(actor, courseId);
      const input = parseLessonRunsContract(
        replaceCourseAudienceInputSchema,
        rawInput,
      );
      await requireOwnedLearnerIds(accountId, input.learnerProfileIds);
      return repository.replaceCourseAudience(
        course.id,
        input.learnerProfileIds,
      );
    },

    async listSchedule(
      actor: CourseBuilderActor,
      rawInput: LessonRunWindowInput | unknown,
    ) {
      const accountId = await requireAccountId(actor);
      const input = parseLessonRunsContract(
        lessonRunWindowInputSchema,
        rawInput,
      );
      return repository.listSchedule(accountId, input.from, input.to);
    },

    async listLessonHistory(actor: CourseBuilderActor, lessonId: string) {
      const { lesson } = await requireOwnedLesson(actor, lessonId);
      return repository.listLessonHistory(lesson.id, {
        limit: LESSON_RUN_HISTORY_HARD_LIMIT,
      });
    },

    async listCourseHistory(
      actor: CourseBuilderActor,
      courseId: string,
      options?: CourseHistoryOptions,
    ) {
      const { course } = await requireOwnedCourse(actor, courseId);
      assertHistoryLimit(options?.limit);
      return repository.listCourseHistory(course.id, {
        ...options,
        limit: options?.limit ?? LESSON_RUN_HISTORY_HARD_LIMIT,
      });
    },

    async listCourseLearningRecords(
      actor: CourseBuilderActor,
      courseId: string,
      options?: LearningRecordHistoryOptions,
    ) {
      const { course } = await requireOwnedCourse(actor, courseId);
      assertHistoryLimit(options?.limit);
      return repository.listCourseLearningRecords(course.id, {
        ...options,
        limit: options?.limit ?? LESSON_RUN_HISTORY_HARD_LIMIT,
      });
    },

    async listLearnerHistory(
      actor: CourseBuilderActor,
      learnerProfileId: string,
    ) {
      const { learnerProfile } = await requireOwnedLearner(
        actor,
        learnerProfileId,
      );
      return repository.listLearnerHistory(learnerProfile.id, {
        limit: LESSON_RUN_HISTORY_HARD_LIMIT,
      });
    },

    async scheduleRun(
      actor: CourseBuilderActor,
      lessonId: string,
      rawInput: ScheduleLessonRunInput | unknown,
    ) {
      const { lesson } = await requireOwnedLesson(actor, lessonId);
      const input = parseLessonRunsContract(
        scheduleLessonRunInputSchema,
        rawInput,
      );
      const learnerProfileIds = await requireAudienceSubset(
        lesson.courseId,
        input.learnerProfileIds,
      );
      return runMutation(() =>
        repository.scheduleRun({
          lessonId: lesson.id,
          scheduledAt: input.scheduledAt,
          plannedDurationMinutes: input.plannedDurationMinutes ?? null,
          learnerProfileIds,
        }),
      );
    },

    async rescheduleRun(
      actor: CourseBuilderActor,
      lessonRunId: string,
      rawInput: RescheduleLessonRunInput | unknown,
    ) {
      const current = await requireOwnedRun(actor, lessonRunId);
      assertRunIsOpen(current);
      if (current.startedAt) {
        throw new CourseBuilderConflictError(
          "Начавшееся занятие уже нельзя перенести.",
          "lesson_run_started",
        );
      }
      const input = parseLessonRunsContract(
        rescheduleLessonRunInputSchema,
        rawInput,
      );
      const learnerProfileIds = await requireAudienceSubset(
        current.courseId,
        input.learnerProfileIds ??
          current.records.map((record) => record.learnerProfileId),
      );
      return runMutation(() =>
        repository.rescheduleRun({
          runId: current.id,
          lessonId: current.lessonId,
          scheduledAt: input.scheduledAt ?? current.scheduledAt,
          plannedDurationMinutes:
            input.plannedDurationMinutes ?? current.plannedDurationMinutes,
          learnerProfileIds,
        }),
      );
    },

    async startRun(actor: CourseBuilderActor, lessonRunId: string) {
      const current = await requireOwnedRun(actor, lessonRunId);
      assertRunIsOpen(current);
      if (current.startedAt) return current;
      return runMutation(() => repository.startRun(current.id));
    },

    async completeRun(
      actor: CourseBuilderActor,
      lessonRunId: string,
      rawInput: CompleteLessonRunInput | unknown,
    ) {
      const current = await requireOwnedRun(actor, lessonRunId);
      const input = parseLessonRunsContract(
        completeLessonRunInputSchema,
        rawInput,
      );
      if (current.endedAt) return current;
      if (current.cancelledAt) {
        throw new CourseBuilderConflictError(
          "Отменённое занятие нельзя завершить.",
          "lesson_run_closed",
        );
      }
      assertSameLearnerSet(
        current.records.map((record) => record.learnerProfileId),
        input.records.map((record) => record.learnerProfileId),
      );
      return runMutation(() => repository.completeRun(current.id, input));
    },

    async cancelRun(actor: CourseBuilderActor, lessonRunId: string) {
      const current = await requireOwnedRun(actor, lessonRunId);
      if (current.cancelledAt) return current;
      if (current.endedAt) {
        throw new CourseBuilderConflictError(
          "Проведённое занятие нельзя отменить.",
          "lesson_run_completed",
        );
      }
      return runMutation(() => repository.cancelRun(current.id));
    },
  };
}
