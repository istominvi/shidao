import assert from "node:assert/strict";
import test from "node:test";
import {
  CourseBuilderAccessError,
  CourseBuilderConflictError,
} from "@/modules/course-builder/contracts";
import type { CourseBuilderActor } from "@/modules/course-builder/domain";
import { CourseBuilderRepositoryError } from "@/modules/course-builder/repository";
import type {
  CompleteLessonRunInput,
  CreateLearnerProfileInput,
} from "./contracts";
import type {
  CourseReference,
  LearnerProfile,
  LearningRecord,
  LessonReference,
  LessonRun,
  LessonRunContext,
} from "./domain";
import type { LessonRunsRepository } from "./repository";
import { createLessonRunsService } from "./service";

const NOW = "2026-08-07T00:00:00.000Z";
const STARTED_AT = "2026-08-08T01:00:00.000Z";
const ENDED_AT = "2026-08-08T01:45:00.000Z";

function uuid(sequence: number) {
  return `00000000-0000-4000-8000-${sequence.toString(16).padStart(12, "0")}`;
}

const ALICE_USER_ID = uuid(1);
const BOB_USER_ID = uuid(2);
const ALICE_ACCOUNT_ID = uuid(101);
const BOB_ACCOUNT_ID = uuid(102);
const ALICE_COURSE_ID = uuid(201);
const BOB_COURSE_ID = uuid(202);
const ALICE_LESSON_ID = uuid(301);
const BOB_LESSON_ID = uuid(302);
const ANNA_ID = uuid(401);
const IVAN_ID = uuid(402);
const BOB_LEARNER_ID = uuid(403);

const alice: CourseBuilderActor = {
  authUserId: ALICE_USER_ID,
  accessToken: "alice-access-token",
};
const bob: CourseBuilderActor = {
  authUserId: BOB_USER_ID,
  accessToken: "bob-access-token",
};

class InMemoryLessonRunsRepository implements LessonRunsRepository {
  readonly accounts = new Map([
    [ALICE_USER_ID, ALICE_ACCOUNT_ID],
    [BOB_USER_ID, BOB_ACCOUNT_ID],
  ]);
  readonly courses = new Map<string, CourseReference>([
    [
      ALICE_COURSE_ID,
      {
        id: ALICE_COURSE_ID,
        ownerAccountId: ALICE_ACCOUNT_ID,
        title: "Китайский с нуля",
        subject: "Китайский язык",
      },
    ],
    [
      BOB_COURSE_ID,
      {
        id: BOB_COURSE_ID,
        ownerAccountId: BOB_ACCOUNT_ID,
        title: "Чужой курс",
        subject: "Математика",
      },
    ],
  ]);
  readonly lessons = new Map<string, LessonReference>([
    [
      ALICE_LESSON_ID,
      {
        id: ALICE_LESSON_ID,
        courseId: ALICE_COURSE_ID,
        title: "Знакомство",
      },
    ],
    [
      BOB_LESSON_ID,
      {
        id: BOB_LESSON_ID,
        courseId: BOB_COURSE_ID,
        title: "Чужой урок",
      },
    ],
  ]);
  readonly profiles = new Map<string, LearnerProfile>([
    [ANNA_ID, this.profile(ANNA_ID, ALICE_ACCOUNT_ID, "Анна")],
    [IVAN_ID, this.profile(IVAN_ID, ALICE_ACCOUNT_ID, "Иван")],
    [BOB_LEARNER_ID, this.profile(BOB_LEARNER_ID, BOB_ACCOUNT_ID, "Борис")],
  ]);
  readonly audiences = new Map<string, string[]>();
  readonly runs = new Map<string, LessonRunContext>();
  sequence = 900;

  private profile(id: string, ownerAccountId: string, displayName: string) {
    return { id, ownerAccountId, displayName, createdAt: NOW, updatedAt: NOW };
  }

  private nextId() {
    this.sequence += 1;
    return uuid(this.sequence);
  }

  private record(runId: string, learnerProfileId: string): LearningRecord {
    const profile = this.profiles.get(learnerProfileId);
    return {
      id: this.nextId(),
      learnerProfileId,
      learnerDisplayName: profile?.displayName ?? "",
      lessonRunId: runId,
      sourceCourseId: null,
      sourceLessonId: null,
      occurredAt: null,
      wasPresent: null,
      needsRepeat: null,
      teacherComment: "",
      courseTitleAtTime: null,
      lessonTitleAtTime: null,
      subjectAtTime: null,
      createdAt: NOW,
      updatedAt: NOW,
    };
  }

  async getSessionInvalidBefore() {
    return null;
  }

  async getAccountId(authUserId: string) {
    return this.accounts.get(authUserId) ?? null;
  }

  async getCourse(courseId: string) {
    return this.courses.get(courseId) ?? null;
  }

  async getLesson(lessonId: string) {
    return this.lessons.get(lessonId) ?? null;
  }

  async getLearnerProfile(learnerProfileId: string) {
    return this.profiles.get(learnerProfileId) ?? null;
  }

  async listLearnerProfiles(ownerAccountId: string) {
    return [...this.profiles.values()].filter(
      (profile) => profile.ownerAccountId === ownerAccountId,
    );
  }

  async createLearnerProfile(
    ownerAccountId: string,
    input: CreateLearnerProfileInput,
  ) {
    const profile = this.profile(
      this.nextId(),
      ownerAccountId,
      input.displayName,
    );
    this.profiles.set(profile.id, profile);
    return profile;
  }

  async listCourseAudience(courseId: string) {
    return (this.audiences.get(courseId) ?? [])
      .map((id) => this.profiles.get(id))
      .filter((profile): profile is LearnerProfile => Boolean(profile));
  }

  async replaceCourseAudience(courseId: string, learnerProfileIds: string[]) {
    this.audiences.set(courseId, [...learnerProfileIds]);
    return this.listCourseAudience(courseId);
  }

  async listSchedule(ownerAccountId: string, from: string, to: string) {
    return [...this.runs.values()]
      .filter(
        ({ ownerAccountId: owner, run }) =>
          owner === ownerAccountId &&
          run.scheduledAt >= from &&
          run.scheduledAt < to &&
          !run.cancelledAt,
      )
      .map(({ run }) => run);
  }

  async listLessonHistory(lessonId: string) {
    return [...this.runs.values()]
      .map(({ run }) => run)
      .filter((run) => run.lessonId === lessonId);
  }

  async listCourseHistory(
    courseId: string,
    options?: { limit?: number; completedOnly?: boolean },
  ) {
    return [...this.runs.values()]
      .map(({ run }) => run)
      .filter(
        (run) =>
          run.courseId === courseId &&
          (!options?.completedOnly || Boolean(run.endedAt)),
      )
      .slice(0, options?.limit);
  }

  async listCourseLearningRecords(
    courseId: string,
    options?: { limit?: number },
  ) {
    return [...this.runs.values()]
      .flatMap(({ run }) => run.records)
      .filter(
        (record) =>
          record.sourceCourseId === courseId && Boolean(record.occurredAt),
      )
      .slice(0, options?.limit);
  }

  async listLearnerHistory(learnerProfileId: string) {
    return [...this.runs.values()].flatMap(({ run }) =>
      run.records.filter(
        (record) =>
          record.learnerProfileId === learnerProfileId && record.occurredAt,
      ),
    );
  }

  async getRun(runId: string) {
    return this.runs.get(runId) ?? null;
  }

  async scheduleRun(input: {
    lessonId: string;
    scheduledAt: string;
    plannedDurationMinutes: number | null;
    learnerProfileIds: string[];
  }) {
    const lesson = this.lessons.get(input.lessonId);
    if (!lesson) throw new Error("lesson not found");
    const course = this.courses.get(lesson.courseId);
    if (!course) throw new Error("course not found");
    const current = [...this.runs.values()].find(
      ({ run }) =>
        run.lessonId === input.lessonId &&
        !run.startedAt &&
        !run.endedAt &&
        !run.cancelledAt,
    );
    const runId = current?.run.id ?? this.nextId();
    const run: LessonRun = {
      id: runId,
      lessonId: lesson.id,
      courseId: course.id,
      lessonTitle: lesson.title,
      courseTitle: course.title,
      scheduledAt: input.scheduledAt,
      plannedDurationMinutes: input.plannedDurationMinutes ?? 60,
      startedAt: null,
      endedAt: null,
      cancelledAt: null,
      teacherReport: "",
      records: input.learnerProfileIds.map((id) => this.record(runId, id)),
      createdAt: current?.run.createdAt ?? NOW,
      updatedAt: NOW,
    };
    this.runs.set(run.id, { run, ownerAccountId: course.ownerAccountId });
    return run;
  }

  async rescheduleRun(input: {
    runId: string;
    lessonId: string;
    scheduledAt: string;
    plannedDurationMinutes: number;
    learnerProfileIds: string[];
  }) {
    return this.scheduleRun(input);
  }

  async startRun(runId: string) {
    const context = this.runs.get(runId);
    if (!context) throw new Error("run not found");
    context.run = { ...context.run, startedAt: STARTED_AT, updatedAt: NOW };
    return context.run;
  }

  async completeRun(runId: string, input: CompleteLessonRunInput) {
    const context = this.runs.get(runId);
    if (!context) throw new Error("run not found");
    const course = this.courses.get(context.run.courseId);
    const lesson = this.lessons.get(context.run.lessonId);
    context.run = {
      ...context.run,
      endedAt: ENDED_AT,
      teacherReport: input.teacherReport,
      records: context.run.records.map((record) => {
        const result = input.records.find(
          (candidate) => candidate.learnerProfileId === record.learnerProfileId,
        );
        if (!result) throw new Error("missing result");
        return {
          ...record,
          sourceCourseId: context.run.courseId,
          sourceLessonId: context.run.lessonId,
          occurredAt: ENDED_AT,
          wasPresent: result.wasPresent,
          needsRepeat: result.needsRepeat,
          teacherComment: result.teacherComment,
          courseTitleAtTime: course?.title ?? null,
          lessonTitleAtTime: lesson?.title ?? null,
          subjectAtTime: course?.subject ?? null,
          updatedAt: NOW,
        };
      }),
      updatedAt: NOW,
    };
    return context.run;
  }

  async cancelRun(runId: string) {
    const context = this.runs.get(runId);
    if (!context) throw new Error("run not found");
    context.run = {
      ...context.run,
      cancelledAt: NOW,
      records: [],
      updatedAt: NOW,
    };
    return context.run;
  }
}

test("course audience accepts only learner profiles owned by the Course owner", async () => {
  const repository = new InMemoryLessonRunsRepository();
  const service = createLessonRunsService({ repository });

  const audience = await service.replaceCourseAudience(alice, ALICE_COURSE_ID, {
    learnerProfileIds: [ANNA_ID, IVAN_ID],
  });
  assert.deepEqual(
    audience.map((profile) => profile.id),
    [ANNA_ID, IVAN_ID],
  );

  await assert.rejects(
    service.replaceCourseAudience(alice, ALICE_COURSE_ID, {
      learnerProfileIds: [BOB_LEARNER_ID],
    }),
    CourseBuilderAccessError,
  );
  await assert.rejects(
    service.listCourseAudience(bob, ALICE_COURSE_ID),
    CourseBuilderAccessError,
  );
});

test("schedule uses the Course audience, requires at least one learner and reschedules the same open run", async () => {
  const repository = new InMemoryLessonRunsRepository();
  const service = createLessonRunsService({ repository });

  await assert.rejects(
    service.scheduleRun(alice, ALICE_LESSON_ID, {
      scheduledAt: "2026-08-08T01:00:00Z",
      plannedDurationMinutes: 45,
    }),
    (error: unknown) =>
      error instanceof CourseBuilderConflictError &&
      error.code === "lesson_run_audience_required",
  );

  await service.replaceCourseAudience(alice, ALICE_COURSE_ID, {
    learnerProfileIds: [ANNA_ID, IVAN_ID],
  });
  const scheduled = await service.scheduleRun(alice, ALICE_LESSON_ID, {
    scheduledAt: "2026-08-08T01:00:00Z",
    plannedDurationMinutes: 45,
  });
  assert.deepEqual(
    scheduled.records.map((record) => record.learnerProfileId),
    [ANNA_ID, IVAN_ID],
  );

  const rescheduled = await service.rescheduleRun(alice, scheduled.id, {
    scheduledAt: "2026-08-09T01:00:00Z",
    learnerProfileIds: [ANNA_ID],
  });
  assert.equal(rescheduled.id, scheduled.id);
  assert.equal(rescheduled.scheduledAt, "2026-08-09T01:00:00Z");
  assert.deepEqual(
    rescheduled.records.map((record) => record.learnerProfileId),
    [ANNA_ID],
  );
});

test("a stale reschedule target becomes a stable conflict instead of changing a replacement Run", async () => {
  const repository = new InMemoryLessonRunsRepository();
  const service = createLessonRunsService({ repository });
  await service.replaceCourseAudience(alice, ALICE_COURSE_ID, {
    learnerProfileIds: [ANNA_ID],
  });
  const scheduled = await service.scheduleRun(alice, ALICE_LESSON_ID, {
    scheduledAt: "2026-08-08T01:00:00Z",
  });
  repository.rescheduleRun = async () => {
    throw new CourseBuilderRepositoryError("lesson_run_changed", 400, "55000");
  };

  await assert.rejects(
    service.rescheduleRun(alice, scheduled.id, {
      scheduledAt: "2026-08-09T01:00:00Z",
    }),
    (error: unknown) =>
      error instanceof CourseBuilderConflictError &&
      error.code === "lesson_run_changed",
  );
});

test("completion is owner-scoped and requires exactly the expected learners", async () => {
  const repository = new InMemoryLessonRunsRepository();
  const service = createLessonRunsService({ repository });
  await service.replaceCourseAudience(alice, ALICE_COURSE_ID, {
    learnerProfileIds: [ANNA_ID, IVAN_ID],
  });
  const scheduled = await service.scheduleRun(alice, ALICE_LESSON_ID, {
    scheduledAt: "2026-08-08T01:00:00Z",
    plannedDurationMinutes: 45,
  });

  await assert.rejects(
    service.startRun(bob, scheduled.id),
    CourseBuilderAccessError,
  );
  await assert.rejects(
    service.completeRun(alice, scheduled.id, {
      records: [
        {
          learnerProfileId: ANNA_ID,
          wasPresent: true,
          needsRepeat: false,
          teacherComment: "Уверенно отвечает",
        },
      ],
    }),
    (error: unknown) =>
      error instanceof CourseBuilderConflictError &&
      error.code === "lesson_run_participants_changed",
  );

  const completed = await service.completeRun(alice, scheduled.id, {
    teacherReport: "Цель достигнута частично",
    records: [
      {
        learnerProfileId: ANNA_ID,
        wasPresent: true,
        needsRepeat: false,
        teacherComment: "Уверенно отвечает",
      },
      {
        learnerProfileId: IVAN_ID,
        wasPresent: false,
        needsRepeat: false,
        teacherComment: "Не присутствовал",
      },
    ],
  });
  assert.equal(completed.endedAt, ENDED_AT);
  assert.equal(completed.records[0]?.lessonTitleAtTime, "Знакомство");
  assert.equal(completed.records[1]?.wasPresent, false);
  assert.equal(
    (
      await service.completeRun(alice, scheduled.id, {
        teacherReport: "Повтор запроса не меняет историю",
        records: [
          {
            learnerProfileId: ANNA_ID,
            wasPresent: true,
            needsRepeat: true,
            teacherComment: "Другое значение не перезаписывается",
          },
          {
            learnerProfileId: IVAN_ID,
            wasPresent: false,
            needsRepeat: false,
            teacherComment: "",
          },
        ],
      })
    ).teacherReport,
    "Цель достигнута частично",
  );
  assert.equal((await service.listLearnerHistory(alice, IVAN_ID)).length, 1);
  assert.equal(
    (
      await service.listCourseLearningRecords(alice, ALICE_COURSE_ID, {
        limit: 8,
      })
    ).length,
    2,
  );
});
