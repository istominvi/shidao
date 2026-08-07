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
  CreateLearnerGroupInput,
  CreateLearnerProfileInput,
  UpdateLearnerGroupInput,
  UpdateLearnerProfileInput,
} from "./contracts";
import type {
  CourseAudience,
  CourseReference,
  LearnerGroup,
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
const ALICE_GROUP_ID = uuid(501);
const ALICE_GROUP_2_ID = uuid(502);
const BOB_GROUP_ID = uuid(503);

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
    [
      this.profileKey(ALICE_ACCOUNT_ID, ANNA_ID),
      this.profile(ANNA_ID, ALICE_ACCOUNT_ID, "Анна"),
    ],
    [
      this.profileKey(BOB_ACCOUNT_ID, ANNA_ID),
      this.profile(ANNA_ID, BOB_ACCOUNT_ID, "Anna for Bob"),
    ],
    [
      this.profileKey(ALICE_ACCOUNT_ID, IVAN_ID),
      this.profile(IVAN_ID, ALICE_ACCOUNT_ID, "Иван"),
    ],
    [
      this.profileKey(BOB_ACCOUNT_ID, BOB_LEARNER_ID),
      this.profile(BOB_LEARNER_ID, BOB_ACCOUNT_ID, "Борис"),
    ],
  ]);
  readonly audiences = new Map<string, string[]>();
  readonly courseGroups = new Map<string, string[]>();
  readonly groups = new Map<string, LearnerGroup>([
    [
      ALICE_GROUP_ID,
      this.group(ALICE_GROUP_ID, ALICE_ACCOUNT_ID, "Teen Talk", [ANNA_ID]),
    ],
    [
      ALICE_GROUP_2_ID,
      this.group(ALICE_GROUP_2_ID, ALICE_ACCOUNT_ID, "Практика", [ANNA_ID]),
    ],
    [
      BOB_GROUP_ID,
      this.group(BOB_GROUP_ID, BOB_ACCOUNT_ID, "Чужая группа", [
        BOB_LEARNER_ID,
      ]),
    ],
  ]);
  readonly runs = new Map<string, LessonRunContext>();
  sequence = 900;

  private profile(
    id: string,
    teacherAccountId: string,
    displayName: string,
  ): LearnerProfile {
    return {
      id,
      teacherAccountId,
      displayName,
      archivedAt: null,
      createdAt: NOW,
      updatedAt: NOW,
    };
  }

  private profileKey(teacherAccountId: string, learnerProfileId: string) {
    return `${teacherAccountId}:${learnerProfileId}`;
  }

  private group(
    id: string,
    ownerAccountId: string,
    name: string,
    learnerProfileIds: string[],
  ): LearnerGroup {
    return {
      id,
      ownerAccountId,
      name,
      members: learnerProfileIds
        .map((profileId) =>
          this.profiles.get(this.profileKey(ownerAccountId, profileId)),
        )
        .filter((profile): profile is LearnerProfile => Boolean(profile)),
      createdAt: NOW,
      updatedAt: NOW,
    };
  }

  private nextId() {
    this.sequence += 1;
    return uuid(this.sequence);
  }

  private record(
    runId: string,
    teacherAccountId: string,
    learnerProfileId: string,
  ): LearningRecord {
    const profile = this.profiles.get(
      this.profileKey(teacherAccountId, learnerProfileId),
    );
    return {
      id: this.nextId(),
      learnerProfileId,
      recordedByAccountId: teacherAccountId,
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

  async getLearnerProfile(teacherAccountId: string, learnerProfileId: string) {
    return (
      this.profiles.get(this.profileKey(teacherAccountId, learnerProfileId)) ??
      null
    );
  }

  async listLearnerProfiles(teacherAccountId: string) {
    return [...this.profiles.values()].filter(
      (profile) =>
        profile.teacherAccountId === teacherAccountId && !profile.archivedAt,
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
    this.profiles.set(this.profileKey(ownerAccountId, profile.id), profile);
    for (const groupId of input.learnerGroupIds) {
      const group = this.groups.get(groupId);
      if (group) group.members.push(profile);
    }
    return profile;
  }

  async updateLearnerProfile(
    teacherAccountId: string,
    learnerProfileId: string,
    input: UpdateLearnerProfileInput,
  ) {
    const key = this.profileKey(teacherAccountId, learnerProfileId);
    const current = this.profiles.get(key);
    if (!current) throw new Error("profile not found");
    const profile = { ...current, displayName: input.displayName };
    this.profiles.set(key, profile);
    for (const group of this.groups.values()) {
      if (group.ownerAccountId !== teacherAccountId) continue;
      group.members = group.members.filter(
        (member) => member.id !== profile.id,
      );
      if (input.learnerGroupIds.includes(group.id)) group.members.push(profile);
    }
    return profile;
  }

  async archiveLearnerProfile(
    teacherAccountId: string,
    learnerProfileId: string,
  ) {
    const key = this.profileKey(teacherAccountId, learnerProfileId);
    const current = this.profiles.get(key);
    if (!current) throw new Error("profile not found");
    const profile = { ...current, archivedAt: NOW };
    this.profiles.set(key, profile);
    for (const group of this.groups.values()) {
      if (group.ownerAccountId !== teacherAccountId) continue;
      group.members = group.members.filter(
        (member) => member.id !== profile.id,
      );
    }
    for (const [courseId, ids] of this.audiences) {
      if (this.courses.get(courseId)?.ownerAccountId !== teacherAccountId)
        continue;
      this.audiences.set(
        courseId,
        ids.filter((id) => id !== profile.id),
      );
    }
    return profile;
  }

  async getLearnerGroup(learnerGroupId: string) {
    return this.groups.get(learnerGroupId) ?? null;
  }

  async listLearnerGroups(ownerAccountId: string) {
    return [...this.groups.values()].filter(
      (group) => group.ownerAccountId === ownerAccountId,
    );
  }

  async createLearnerGroup(
    ownerAccountId: string,
    input: CreateLearnerGroupInput,
  ) {
    const group = this.group(
      this.nextId(),
      ownerAccountId,
      input.name,
      input.learnerProfileIds,
    );
    this.groups.set(group.id, group);
    return group;
  }

  async updateLearnerGroup(
    learnerGroupId: string,
    input: UpdateLearnerGroupInput,
  ) {
    const current = this.groups.get(learnerGroupId);
    if (!current) throw new Error("group not found");
    const group = this.group(
      current.id,
      current.ownerAccountId,
      input.name,
      input.learnerProfileIds,
    );
    this.groups.set(group.id, group);
    return group;
  }

  async deleteLearnerGroup(learnerGroupId: string) {
    this.groups.delete(learnerGroupId);
    for (const [courseId, ids] of this.courseGroups) {
      this.courseGroups.set(
        courseId,
        ids.filter((id) => id !== learnerGroupId),
      );
    }
  }

  async getCourseAudience(
    teacherAccountId: string,
    courseId: string,
  ): Promise<CourseAudience> {
    const directLearners = (this.audiences.get(courseId) ?? [])
      .map((id) => this.profiles.get(this.profileKey(teacherAccountId, id)))
      .filter(
        (profile): profile is LearnerProfile =>
          Boolean(profile) && !profile?.archivedAt,
      );
    const groups = (this.courseGroups.get(courseId) ?? [])
      .map((id) => this.groups.get(id))
      .filter((group): group is LearnerGroup => Boolean(group));
    const effective = new Map(
      directLearners.map((profile) => [profile.id, profile]),
    );
    for (const group of groups) {
      for (const profile of group.members) {
        if (!profile.archivedAt) effective.set(profile.id, profile);
      }
    }
    return {
      directLearners,
      groups,
      effectiveLearners: [...effective.values()],
    };
  }

  async replaceCourseAudience(
    teacherAccountId: string,
    courseId: string,
    directLearnerProfileIds: string[],
    learnerGroupIds: string[],
  ) {
    this.audiences.set(courseId, [...directLearnerProfileIds]);
    this.courseGroups.set(courseId, [...learnerGroupIds]);
    return this.getCourseAudience(teacherAccountId, courseId);
  }

  async replaceDirectCourseAudience(
    teacherAccountId: string,
    courseId: string,
    learnerProfileIds: string[],
  ) {
    this.audiences.set(courseId, [...learnerProfileIds]);
    return this.getCourseAudience(teacherAccountId, courseId);
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

  async listLessonHistory(teacherAccountId: string, lessonId: string) {
    return [...this.runs.values()]
      .filter(({ ownerAccountId }) => ownerAccountId === teacherAccountId)
      .map(({ run }) => run)
      .filter((run) => run.lessonId === lessonId);
  }

  async listCourseHistory(
    teacherAccountId: string,
    courseId: string,
    options?: { limit?: number; completedOnly?: boolean },
  ) {
    return [...this.runs.values()]
      .filter(({ ownerAccountId }) => ownerAccountId === teacherAccountId)
      .map(({ run }) => run)
      .filter(
        (run) =>
          run.courseId === courseId &&
          (!options?.completedOnly || Boolean(run.endedAt)),
      )
      .slice(0, options?.limit);
  }

  async listCourseLearningRecords(
    teacherAccountId: string,
    courseId: string,
    options?: { limit?: number },
  ) {
    return [...this.runs.values()]
      .flatMap(({ run }) => run.records)
      .filter(
        (record) =>
          record.recordedByAccountId === teacherAccountId &&
          record.sourceCourseId === courseId &&
          Boolean(record.occurredAt),
      )
      .slice(0, options?.limit);
  }

  async listLearningRecordsForLearners(
    teacherAccountId: string,
    learnerProfileIds: string[],
    options?: { limit?: number },
  ) {
    const selected = new Set(learnerProfileIds);
    return [...this.runs.values()]
      .flatMap(({ run }) => run.records)
      .filter(
        (record) =>
          record.recordedByAccountId === teacherAccountId &&
          selected.has(record.learnerProfileId) &&
          record.occurredAt,
      )
      .slice(0, options?.limit);
  }

  async listLearnerHistory(teacherAccountId: string, learnerProfileId: string) {
    return [...this.runs.values()].flatMap(({ run }) =>
      run.records.filter(
        (record) =>
          record.recordedByAccountId === teacherAccountId &&
          record.learnerProfileId === learnerProfileId &&
          record.occurredAt,
      ),
    );
  }

  async getRun(teacherAccountId: string, runId: string) {
    const context = this.runs.get(runId);
    return context?.ownerAccountId === teacherAccountId ? context : null;
  }

  async scheduleRun(input: {
    lessonId: string;
    scheduledAt: string;
    plannedDurationMinutes: number | null;
    learnerProfileIds: string[] | null;
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
    const learnerProfileIds =
      input.learnerProfileIds ??
      (current
        ? current.run.records.map((record) => record.learnerProfileId)
        : (
            await this.getCourseAudience(course.ownerAccountId, course.id)
          ).effectiveLearners.map((profile) => profile.id));
    if (learnerProfileIds.length === 0) {
      throw new CourseBuilderRepositoryError(
        "lesson_run_requires_expected_learner",
        400,
        "23514",
      );
    }
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
      records: learnerProfileIds.map((id) =>
        this.record(runId, course.ownerAccountId, id),
      ),
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
    learnerProfileIds: string[] | null;
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

test("mixed Course audience deduplicates direct learners and group members", async () => {
  const repository = new InMemoryLessonRunsRepository();
  const service = createLessonRunsService({ repository });

  const audience = await service.replaceCourseAudience(alice, ALICE_COURSE_ID, {
    directLearnerProfileIds: [ANNA_ID, IVAN_ID],
    learnerGroupIds: [ALICE_GROUP_ID, ALICE_GROUP_2_ID],
  });
  assert.deepEqual(
    audience.effectiveLearners.map((profile) => profile.id),
    [ANNA_ID, IVAN_ID],
  );
  assert.equal(audience.groups.length, 2);

  await assert.rejects(
    service.replaceCourseAudience(alice, ALICE_COURSE_ID, {
      directLearnerProfileIds: [],
      learnerGroupIds: [BOB_GROUP_ID],
    }),
    CourseBuilderAccessError,
  );
  await assert.rejects(
    service.getCourseAudience(bob, ALICE_COURSE_ID),
    CourseBuilderAccessError,
  );
});

test("learner directory and group CRUD is teacher-scoped and archive removes future audience only", async () => {
  const repository = new InMemoryLessonRunsRepository();
  const service = createLessonRunsService({ repository });

  const group = await service.createLearnerGroup(alice, {
    name: "Разговорная практика",
    learnerProfileIds: [ANNA_ID, IVAN_ID],
  });
  const created = await service.createLearnerProfile(alice, {
    displayName: "Мария",
    learnerGroupIds: [group.id],
  });
  const updated = await service.updateLearnerProfile(alice, created.id, {
    displayName: "Мария П.",
    learnerGroupIds: [ALICE_GROUP_ID, group.id],
  });
  assert.equal(updated.displayName, "Мария П.");
  assert.equal(
    (await service.listLearnerGroups(alice))
      .find((candidate) => candidate.id === group.id)
      ?.members.some((member) => member.id === created.id),
    true,
  );

  await service.replaceCourseAudience(alice, ALICE_COURSE_ID, {
    directLearnerProfileIds: [created.id],
    learnerGroupIds: [group.id],
  });
  const archived = await service.archiveLearnerProfile(alice, created.id);
  assert.equal(archived.archivedAt, NOW);
  assert.equal(
    (await service.getCourseAudience(alice, ALICE_COURSE_ID)).effectiveLearners
      .map((profile) => profile.id)
      .includes(created.id),
    false,
  );

  await assert.rejects(
    service.updateLearnerGroup(bob, group.id, {
      name: "Чужое изменение",
      learnerProfileIds: [],
    }),
    CourseBuilderAccessError,
  );
  await service.deleteLearnerGroup(alice, group.id);
  assert.equal(
    (await service.listLearnerGroups(alice)).some(
      (candidate) => candidate.id === group.id,
    ),
    false,
  );
});

test("one canonical learner can keep isolated directory names and history for two teachers", async () => {
  const repository = new InMemoryLessonRunsRepository();
  const service = createLessonRunsService({ repository });

  const aliceProfile = await service.updateLearnerProfile(alice, ANNA_ID, {
    displayName: "Анна Петрова",
    learnerGroupIds: [],
  });
  assert.equal(aliceProfile.teacherAccountId, ALICE_ACCOUNT_ID);
  assert.equal(
    (await service.listLearnerProfiles(bob)).find(
      (profile) => profile.id === ANNA_ID,
    )?.displayName,
    "Anna for Bob",
  );

  await service.replaceCourseAudience(alice, ALICE_COURSE_ID, {
    learnerProfileIds: [ANNA_ID],
  });
  const aliceRun = await service.scheduleRun(alice, ALICE_LESSON_ID, {
    scheduledAt: "2026-08-08T01:00:00Z",
  });
  await service.completeRun(alice, aliceRun.id, {
    records: [
      {
        learnerProfileId: ANNA_ID,
        wasPresent: true,
        needsRepeat: false,
        teacherComment: "Alice-only observation",
      },
    ],
  });

  await service.replaceCourseAudience(bob, BOB_COURSE_ID, {
    learnerProfileIds: [ANNA_ID],
  });
  const bobRun = await service.scheduleRun(bob, BOB_LESSON_ID, {
    scheduledAt: "2026-08-09T01:00:00Z",
  });
  await service.completeRun(bob, bobRun.id, {
    records: [
      {
        learnerProfileId: ANNA_ID,
        wasPresent: true,
        needsRepeat: true,
        teacherComment: "Bob-only observation",
      },
    ],
  });

  const aliceHistory = await service.listLearnerHistory(alice, ANNA_ID);
  const bobHistory = await service.listLearnerHistory(bob, ANNA_ID);
  assert.deepEqual(
    aliceHistory.map((record) => record.teacherComment),
    ["Alice-only observation"],
  );
  assert.deepEqual(
    bobHistory.map((record) => record.teacherComment),
    ["Bob-only observation"],
  );
  assert.equal(aliceHistory[0]?.recordedByAccountId, ALICE_ACCOUNT_ID);
  assert.equal(bobHistory[0]?.recordedByAccountId, BOB_ACCOUNT_ID);

  await service.archiveLearnerProfile(alice, ANNA_ID);
  assert.equal(
    (await service.listLearnerProfiles(alice)).some(
      (profile) => profile.id === ANNA_ID,
    ),
    false,
  );
  assert.equal(
    (await service.listLearnerProfiles(bob)).some(
      (profile) => profile.id === ANNA_ID,
    ),
    true,
  );
  assert.equal(
    (await service.listLearnerHistory(alice, ANNA_ID))[0]?.teacherComment,
    "Alice-only observation",
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

test("group changes affect future Runs while an existing Run keeps its learners", async () => {
  const repository = new InMemoryLessonRunsRepository();
  const service = createLessonRunsService({ repository });
  await service.replaceCourseAudience(alice, ALICE_COURSE_ID, {
    directLearnerProfileIds: [],
    learnerGroupIds: [ALICE_GROUP_ID],
  });
  const scheduled = await service.scheduleRun(alice, ALICE_LESSON_ID, {
    scheduledAt: "2026-08-08T01:00:00Z",
  });
  assert.deepEqual(
    scheduled.records.map((record) => record.learnerProfileId),
    [ANNA_ID],
  );

  await service.updateLearnerGroup(alice, ALICE_GROUP_ID, {
    name: "Teen Talk",
    learnerProfileIds: [IVAN_ID],
  });
  const rescheduled = await service.rescheduleRun(alice, scheduled.id, {
    scheduledAt: "2026-08-09T01:00:00Z",
  });
  assert.deepEqual(
    rescheduled.records.map((record) => record.learnerProfileId),
    [ANNA_ID],
  );

  await service.cancelRun(alice, rescheduled.id);
  const next = await service.scheduleRun(alice, ALICE_LESSON_ID, {
    scheduledAt: "2026-08-10T01:00:00Z",
  });
  assert.deepEqual(
    next.records.map((record) => record.learnerProfileId),
    [IVAN_ID],
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
