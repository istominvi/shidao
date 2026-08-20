import {
  CourseBuilderAccessError,
  CourseBuilderConflictError,
  uuidSchema,
} from "@/modules/course-builder/contracts";
import type { CourseBuilderActor } from "@/modules/course-builder/domain";
import {
  assertSameLearnerSet,
  assistantScheduleLessonRunInputSchema,
  completeLessonRunInputSchema,
  createLearnerGroupInputSchema,
  createLearnerProfileInputSchema,
  lessonRunWindowInputSchema,
  parseLessonRunsContract,
  replaceCourseAudienceInputSchema,
  rescheduleLessonRunInputSchema,
  scheduleLessonRunInputSchema,
  updateLearnerGroupInputSchema,
  updateLearnerProfileInputSchema,
  type AssistantScheduleLessonRunInput,
  type CompleteLessonRunInput,
  type CreateLearnerGroupInput,
  type CreateLearnerProfileInput,
  type LessonRunWindowInput,
  type ReplaceCourseAudienceInput,
  type RescheduleLessonRunInput,
  type ScheduleLessonRunInput,
  type UpdateLearnerGroupInput,
  type UpdateLearnerProfileInput,
} from "./contracts";
import type { LearnerGroup, LearnerProfile, LessonRun } from "./domain";
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

  async function requireTeacherLearner(
    actor: CourseBuilderActor,
    learnerProfileIdValue: string,
  ) {
    const learnerProfileId = parseLessonRunsContract(
      uuidSchema,
      learnerProfileIdValue,
    );
    const accountId = await requireAccountId(actor);
    const learnerProfile = await repository.getLearnerProfile(
      accountId,
      learnerProfileId,
    );
    if (!learnerProfile || learnerProfile.teacherAccountId !== accountId) {
      throw new CourseBuilderAccessError("Профиль ученика не найден.");
    }
    return { accountId, learnerProfile };
  }

  async function requireOwnedLearnerGroup(
    actor: CourseBuilderActor,
    learnerGroupIdValue: string,
  ) {
    const learnerGroupId = parseLessonRunsContract(
      uuidSchema,
      learnerGroupIdValue,
    );
    const [accountId, learnerGroup] = await Promise.all([
      requireAccountId(actor),
      repository.getLearnerGroup(learnerGroupId),
    ]);
    if (!learnerGroup || learnerGroup.ownerAccountId !== accountId) {
      throw new CourseBuilderAccessError("Группа учеников не найдена.");
    }
    return { accountId, learnerGroup };
  }

  async function requireOwnedRun(
    actor: CourseBuilderActor,
    lessonRunIdValue: string,
  ) {
    const lessonRunId = parseLessonRunsContract(uuidSchema, lessonRunIdValue);
    const accountId = await requireAccountId(actor);
    const context = await repository.getRun(accountId, lessonRunId);
    if (!context || context.ownerAccountId !== accountId) {
      throw new CourseBuilderAccessError("Занятие не найдено.");
    }
    return context.run;
  }

  async function requireTeacherLearnerIds(
    teacherAccountId: string,
    learnerProfileIds: string[],
  ) {
    const ownedIds = new Set(
      (await repository.listLearnerProfiles(teacherAccountId)).map(
        (profile) => profile.id,
      ),
    );
    if (learnerProfileIds.some((learnerId) => !ownedIds.has(learnerId))) {
      throw new CourseBuilderAccessError(
        "Один или несколько профилей ученика недоступны.",
      );
    }
  }

  async function requireOwnedLearnerGroupIds(
    ownerAccountId: string,
    learnerGroupIds: string[],
  ) {
    const ownedIds = new Set(
      (await repository.listLearnerGroups(ownerAccountId)).map(
        (group) => group.id,
      ),
    );
    if (learnerGroupIds.some((groupId) => !ownedIds.has(groupId))) {
      throw new CourseBuilderAccessError(
        "Одна или несколько групп учеников недоступны.",
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
        if (/learner_group_name_taken/.test(error.message)) {
          throw new CourseBuilderConflictError(
            "Группа с таким названием уже существует.",
            "learner_group_name_taken",
          );
        }
        if (/course_audience_too_large/.test(error.message)) {
          throw new CourseBuilderConflictError(
            "В аудитории курса может быть не более 200 учеников.",
            "course_audience_too_large",
          );
        }
        if (/learner_group_not_found/.test(error.message)) {
          throw new CourseBuilderAccessError("Группа учеников не найдена.");
        }
        if (/learner_profile_not_found/.test(error.message)) {
          throw new CourseBuilderAccessError("Профиль ученика не найден.");
        }
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
        if (/lesson_run_absent_learner_has_observation/.test(error.message)) {
          throw new CourseBuilderConflictError(
            "У отсутствующего ученика остались наблюдения. Исправьте посещаемость или очистите наблюдения.",
            "lesson_run_absent_learner_has_observation",
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

  async function runAssistantScheduleMutation<T>(operation: () => Promise<T>) {
    try {
      return await runMutation(operation);
    } catch (error) {
      if (
        error instanceof CourseBuilderConflictError &&
        error.code === "lesson_run_changed"
      ) {
        throw new CourseBuilderConflictError(
          "Занятие или состав участников изменились после предложения. Подготовьте назначение заново.",
          "ai_action_stale",
        );
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
      await requireOwnedLearnerGroupIds(accountId, input.learnerGroupIds);
      return runMutation(() =>
        repository.createLearnerProfile(accountId, input),
      );
    },

    async updateLearnerProfile(
      actor: CourseBuilderActor,
      learnerProfileId: string,
      rawInput: UpdateLearnerProfileInput | unknown,
    ) {
      const { accountId, learnerProfile } = await requireTeacherLearner(
        actor,
        learnerProfileId,
      );
      const input = parseLessonRunsContract(
        updateLearnerProfileInputSchema,
        rawInput,
      );
      await requireOwnedLearnerGroupIds(accountId, input.learnerGroupIds);
      return runMutation(() =>
        repository.updateLearnerProfile(accountId, learnerProfile.id, input),
      );
    },

    async archiveLearnerProfile(
      actor: CourseBuilderActor,
      learnerProfileId: string,
    ) {
      const { accountId, learnerProfile } = await requireTeacherLearner(
        actor,
        learnerProfileId,
      );
      if (learnerProfile.archivedAt) return learnerProfile;
      return runMutation(() =>
        repository.archiveLearnerProfile(accountId, learnerProfile.id),
      );
    },

    async listLearnerGroups(
      actor: CourseBuilderActor,
    ): Promise<LearnerGroup[]> {
      const accountId = await requireAccountId(actor);
      return repository.listLearnerGroups(accountId);
    },

    async createLearnerGroup(
      actor: CourseBuilderActor,
      rawInput: CreateLearnerGroupInput | unknown,
    ) {
      const accountId = await requireAccountId(actor);
      const input = parseLessonRunsContract(
        createLearnerGroupInputSchema,
        rawInput,
      );
      await requireTeacherLearnerIds(accountId, input.learnerProfileIds);
      return runMutation(() => repository.createLearnerGroup(accountId, input));
    },

    async updateLearnerGroup(
      actor: CourseBuilderActor,
      learnerGroupId: string,
      rawInput: UpdateLearnerGroupInput | unknown,
    ) {
      const { accountId, learnerGroup } = await requireOwnedLearnerGroup(
        actor,
        learnerGroupId,
      );
      const input = parseLessonRunsContract(
        updateLearnerGroupInputSchema,
        rawInput,
      );
      await requireTeacherLearnerIds(accountId, input.learnerProfileIds);
      return runMutation(() =>
        repository.updateLearnerGroup(learnerGroup.id, input),
      );
    },

    async deleteLearnerGroup(
      actor: CourseBuilderActor,
      learnerGroupId: string,
    ) {
      const { learnerGroup } = await requireOwnedLearnerGroup(
        actor,
        learnerGroupId,
      );
      await runMutation(() => repository.deleteLearnerGroup(learnerGroup.id));
    },

    async getCourseAudience(actor: CourseBuilderActor, courseId: string) {
      const { accountId, course } = await requireOwnedCourse(actor, courseId);
      return repository.getCourseAudience(accountId, course.id);
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
      if ("learnerProfileIds" in input) {
        await requireTeacherLearnerIds(accountId, input.learnerProfileIds);
        return runMutation(() =>
          repository.replaceDirectCourseAudience(
            accountId,
            course.id,
            input.learnerProfileIds,
          ),
        );
      }
      await Promise.all([
        requireTeacherLearnerIds(accountId, input.directLearnerProfileIds),
        requireOwnedLearnerGroupIds(accountId, input.learnerGroupIds),
      ]);
      return runMutation(() =>
        repository.replaceCourseAudience(
          accountId,
          course.id,
          input.directLearnerProfileIds,
          input.learnerGroupIds,
        ),
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

    async getRun(actor: CourseBuilderActor, lessonRunId: string) {
      return requireOwnedRun(actor, lessonRunId);
    },

    async listLessonHistory(actor: CourseBuilderActor, lessonId: string) {
      const { accountId, lesson } = await requireOwnedLesson(actor, lessonId);
      return repository.listLessonHistory(accountId, lesson.id, {
        limit: LESSON_RUN_HISTORY_HARD_LIMIT,
      });
    },

    async listCourseHistory(
      actor: CourseBuilderActor,
      courseId: string,
      options?: CourseHistoryOptions,
    ) {
      const { accountId, course } = await requireOwnedCourse(actor, courseId);
      assertHistoryLimit(options?.limit);
      return repository.listCourseHistory(accountId, course.id, {
        ...options,
        limit: options?.limit ?? LESSON_RUN_HISTORY_HARD_LIMIT,
      });
    },

    async listCourseLearningRecords(
      actor: CourseBuilderActor,
      courseId: string,
      options?: LearningRecordHistoryOptions,
    ) {
      const { accountId, course } = await requireOwnedCourse(actor, courseId);
      assertHistoryLimit(options?.limit);
      return repository.listCourseLearningRecords(accountId, course.id, {
        ...options,
        limit: options?.limit ?? LESSON_RUN_HISTORY_HARD_LIMIT,
      });
    },

    async getCourseAudienceLearningRecords(
      actor: CourseBuilderActor,
      courseId: string,
      options?: LearningRecordHistoryOptions,
    ) {
      const { accountId, course } = await requireOwnedCourse(actor, courseId);
      assertHistoryLimit(options?.limit);
      const audience = await repository.getCourseAudience(accountId, course.id);
      const records = await repository.listLearningRecordsForLearners(
        accountId,
        audience.effectiveLearners.map((profile) => profile.id),
        {
          ...options,
          limit: options?.limit ?? LESSON_RUN_HISTORY_HARD_LIMIT,
        },
      );
      return { audience, records };
    },

    async listLearnerHistory(
      actor: CourseBuilderActor,
      learnerProfileId: string,
    ) {
      const { accountId, learnerProfile } = await requireTeacherLearner(
        actor,
        learnerProfileId,
      );
      return repository.listLearnerHistory(accountId, learnerProfile.id, {
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
      return runMutation(() =>
        repository.scheduleRun({
          lessonId: lesson.id,
          scheduledAt: input.scheduledAt,
          plannedDurationMinutes: input.plannedDurationMinutes ?? null,
          learnerProfileIds: input.learnerProfileIds ?? null,
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
      return runMutation(() =>
        repository.rescheduleRun({
          runId: current.id,
          lessonId: current.lessonId,
          scheduledAt: input.scheduledAt ?? current.scheduledAt,
          plannedDurationMinutes:
            input.plannedDurationMinutes ?? current.plannedDurationMinutes,
          learnerProfileIds: input.learnerProfileIds ?? null,
        }),
      );
    },

    async applyAssistantScheduleRun(
      actor: CourseBuilderActor,
      lessonId: string,
      rawInput: AssistantScheduleLessonRunInput | unknown,
    ) {
      const { lesson } = await requireOwnedLesson(actor, lessonId);
      const input = parseLessonRunsContract(
        assistantScheduleLessonRunInputSchema,
        rawInput,
      );
      return runAssistantScheduleMutation(() =>
        repository.scheduleRunIfUnchanged({
          lessonId: lesson.id,
          scheduledAt: input.scheduledAt,
          plannedDurationMinutes: input.plannedDurationMinutes,
          expectedLessonRunId: input.expectedLessonRunId,
          expectedLessonRunUpdatedAt: input.expectedLessonRunUpdatedAt,
          expectedLearnerProfileIds: input.expectedLearnerProfileIds,
        }),
      );
    },

    async startRun(actor: CourseBuilderActor, lessonRunId: string) {
      const current = await requireOwnedRun(actor, lessonRunId);
      assertRunIsOpen(current);
      if (current.startedAt && current.startedAtIsActual) return current;
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
