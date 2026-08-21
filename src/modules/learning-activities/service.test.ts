import assert from "node:assert/strict";
import test from "node:test";
import {
  CourseBuilderAccessError,
  CourseBuilderConflictError,
  CourseBuilderValidationError,
} from "@/modules/course-builder/contracts";
import type {
  CourseBuilderActor,
  CourseWorkspace,
  LessonComponent,
} from "@/modules/course-builder/domain";
import { CourseBuilderRepositoryError } from "@/modules/course-builder/repository";
import type { LearningRecord, LessonRun } from "@/modules/lesson-runs/domain";
import { HISTORY_OBSERVATION_LEARNING_RECORD_IDS_MAX } from "./contracts";
import type {
  LearnerSafeActivityProfile,
  LessonComponentObservation,
  ObservationEntryMethod,
  TeacherLearnerActivityProfile,
} from "./domain";
import type {
  CorrectFinalizedObservationRepositoryInput,
  LearningActivitiesRepository,
  SaveRunObservationsRepositoryInput,
  SetRecommendationOverrideRepositoryInput,
} from "./repository";
import {
  createLearningActivitiesService,
  observationComponentLabel,
} from "./service";
import { fixedLearningActivityClock } from "./objective-state-v1";

const NOW = "2026-08-19T01:00:00.000Z";

function uuid(sequence: number) {
  return `00000000-0000-4000-8000-${sequence.toString(16).padStart(12, "0")}`;
}

const USER_ID = uuid(1);
const ACCOUNT_ID = uuid(2);
const COURSE_ID = uuid(3);
const LESSON_ID = uuid(4);
const RUN_ID = uuid(5);
const COMPONENT_ID = uuid(6);
const OTHER_COMPONENT_ID = uuid(7);
const RECORD_ID = uuid(8);
const OTHER_RECORD_ID = uuid(9);
const LEARNER_ID = uuid(10);
const OBJECTIVE_ID = uuid(11);

const actor: CourseBuilderActor = {
  authUserId: USER_ID,
  accessToken: "access-token",
};

function component(overrides: Partial<LessonComponent> = {}): LessonComponent {
  return {
    id: COMPONENT_ID,
    lessonId: LESSON_ID,
    typeKey: "free_response",
    schemaVersion: 1,
    position: 2,
    payload: {
      prompt: "  Объясните правило своими словами.  ",
      responseType: "long",
      minChars: 0,
      maxChars: 2_000,
    },
    placement: { width: "content", compact: false },
    visibility: "staff_only",
    studentSlideId: null,
    primaryLearningObjectiveId: null,
    activityRole: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function learningRecord(
  overrides: Partial<LearningRecord> = {},
): LearningRecord {
  return {
    id: RECORD_ID,
    learnerProfileId: LEARNER_ID,
    recordedByAccountId: ACCOUNT_ID,
    learnerDisplayName: "Анна",
    lessonRunId: RUN_ID,
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
    ...overrides,
  };
}

function lessonRun(overrides: Partial<LessonRun> = {}): LessonRun {
  return {
    id: RUN_ID,
    lessonId: LESSON_ID,
    courseId: COURSE_ID,
    lessonTitle: "Знакомство",
    courseTitle: "Китайский с нуля",
    scheduledAt: "2026-08-19T00:30:00.000Z",
    plannedDurationMinutes: 45,
    actualDurationMinutes: null,
    startedAt: NOW,
    startedAtIsActual: true,
    endedAt: null,
    cancelledAt: null,
    teacherReport: "",
    records: [learningRecord()],
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function courseWorkspace(
  components: LessonComponent[] = [component()],
): CourseWorkspace {
  return {
    id: COURSE_ID,
    ownerAccountId: ACCOUNT_ID,
    title: "Китайский с нуля",
    learningAudience: "children",
    subject: "Китайский язык",
    goal: "Говорить увереннее",
    level: "Начальный",
    audienceDescription: "",
    targetLessonCount: 10,
    teacherPreferences: "",
    status: "draft",
    lessonCount: 1,
    assembledAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    publicationContentUpdatedAt: NOW,
    lessons: [
      {
        id: LESSON_ID,
        courseId: COURSE_ID,
        position: 1,
        title: "Знакомство",
        summary: "",
        components,
        studentSlides: [],
        createdAt: NOW,
        updatedAt: NOW,
      },
    ],
    attachments: [],
    learningObjectives: [
      {
        id: OBJECTIVE_ID,
        courseId: COURSE_ID,
        title: "Объясняет правило своими словами",
        description: null,
        archivedAt: null,
        createdAt: NOW,
        updatedAt: NOW,
      },
    ],
  };
}

function observation(
  overrides: Partial<LessonComponentObservation> = {},
): LessonComponentObservation {
  return {
    id: uuid(20),
    learningRecordId: RECORD_ID,
    correctedFromObservationId: null,
    supersededByObservationId: null,
    lessonComponentId: COMPONENT_ID,
    sourceComponentIdAtTime: COMPONENT_ID,
    learningObjectiveId: null,
    sourceLearningObjectiveIdAtTime: null,
    learningObjectiveTitleAtTime: null,
    componentPositionAtTime: 2,
    componentTypeAtTime: "free_response",
    componentLabelAtTime: "Свободный ответ: Объясните правило своими словами.",
    observableCriterionAtTime: "Объясняет правило своими словами",
    rating: "independent",
    entryMethod: "direct",
    privateNote: null,
    observedAt: NOW,
    recordedByAccountId: ACCOUNT_ID,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

class InMemoryLearningActivitiesRepository implements LearningActivitiesRepository {
  observations: LessonComponentObservation[] = [];
  historyReads: string[][] = [];
  evidenceHistoryReads: string[][] = [];
  correctionHistoryReads: string[][] = [];
  teacherProfileReads: string[] = [];
  observedProfileReads: string[] = [];
  selfProfileReadCount = 0;
  saves: SaveRunObservationsRepositoryInput[] = [];
  corrections: CorrectFinalizedObservationRepositoryInput[] = [];
  overrides: SetRecommendationOverrideRepositoryInput[] = [];
  saveError: Error | null = null;
  objectiveContext: Pick<
    LessonComponentObservation,
    | "learningObjectiveId"
    | "sourceLearningObjectiveIdAtTime"
    | "learningObjectiveTitleAtTime"
  > = {
    learningObjectiveId: null,
    sourceLearningObjectiveIdAtTime: null,
    learningObjectiveTitleAtTime: null,
  };

  async listByLearningRecordIds(learningRecordIds: string[]) {
    this.historyReads.push(learningRecordIds);
    const ids = new Set(learningRecordIds);
    return this.observations.filter((item) => ids.has(item.learningRecordId));
  }

  async listEvidenceByLearningRecordIds(learningRecordIds: string[]) {
    this.evidenceHistoryReads.push(learningRecordIds);
    return [];
  }

  async listHistoryCorrections(activeLearningRecordIds: string[]) {
    this.correctionHistoryReads.push(activeLearningRecordIds);
    return { items: [], truncated: false };
  }

  async saveRunObservations(input: SaveRunObservationsRepositoryInput) {
    if (this.saveError) throw this.saveError;
    this.saves.push(input);
    for (const entry of input.entries) {
      this.observations = this.observations.filter(
        (item) =>
          !(
            item.learningRecordId === entry.learningRecordId &&
            item.sourceComponentIdAtTime === input.lessonComponentId
          ),
      );
      if (entry.rating === null) continue;
      this.observations.push(
        observation({
          learningRecordId: entry.learningRecordId,
          lessonComponentId: input.lessonComponentId,
          sourceComponentIdAtTime: input.lessonComponentId,
          ...this.objectiveContext,
          componentLabelAtTime: input.componentLabelAtTime,
          observableCriterionAtTime: input.observableCriterionAtTime ?? "",
          rating: entry.rating,
          entryMethod: input.entryMethod as ObservationEntryMethod,
          privateNote: entry.privateNote,
        }),
      );
    }
  }

  async correctFinalizedObservation(
    input: CorrectFinalizedObservationRepositoryInput,
  ) {
    if (this.saveError) throw this.saveError;
    this.corrections.push(input);
    return {
      idempotencyKey: input.idempotencyKey,
      newLearningRecordId: uuid(90),
      newObservationId: uuid(91),
      correctedAt: input.correctedAt,
      replayed: false,
    };
  }

  async setRecommendationOverride(
    input: SetRecommendationOverrideRepositoryInput,
  ) {
    if (this.saveError) throw this.saveError;
    this.overrides.push(input);
    return {
      action: input.action,
      stateId: uuid(92),
      updatedAt: input.expectedStateUpdatedAt,
    };
  }

  async getTeacherLearnerActivityProfile(learnerProfileId: string) {
    this.teacherProfileReads.push(learnerProfileId);
    return {
      projectionVersion: 1,
      learnerProfileId,
      generatedAt: NOW,
      states: [],
    } satisfies TeacherLearnerActivityProfile;
  }

  async getMyLearningActivityProfile() {
    this.selfProfileReadCount += 1;
    return {
      projectionVersion: 1,
      generatedAt: NOW,
      states: [],
    } satisfies LearnerSafeActivityProfile;
  }

  async getObservedLearnerActivityProfile(_learnerProfileId: string) {
    this.observedProfileReads.push(_learnerProfileId);
    return {
      projectionVersion: 1,
      generatedAt: NOW,
      states: [],
    } satisfies LearnerSafeActivityProfile;
  }
}

test("history observations validate a bounded UUID list before recorder-scoped read", async () => {
  const { repository, service } = fixture();
  repository.observations = [observation()];

  const observations = await service.listHistoryObservations(actor, [
    RECORD_ID,
    RECORD_ID,
  ]);
  assert.deepEqual(repository.historyReads, [[RECORD_ID]]);
  assert.equal(observations[0]?.id, uuid(20));

  await assert.rejects(
    service.listHistoryObservations(actor, ["not-a-uuid"]),
    CourseBuilderValidationError,
  );
  await assert.rejects(
    service.listHistoryObservations(
      actor,
      Array.from(
        { length: HISTORY_OBSERVATION_LEARNING_RECORD_IDS_MAX + 1 },
        () => RECORD_ID,
      ),
    ),
    CourseBuilderValidationError,
  );
  assert.equal(repository.historyReads.length, 1);
});

test("teacher correction history validates active records and delegates to the bounded RPC repository", async () => {
  const { repository, service } = fixture();
  assert.deepEqual(
    await service.listHistoryCorrections(actor, [
      learningRecord({ occurredAt: NOW }),
      learningRecord({ occurredAt: NOW }),
    ]),
    { items: [], truncated: false },
  );
  assert.deepEqual(repository.correctionHistoryReads, [[RECORD_ID]]);
  await assert.rejects(
    service.listHistoryCorrections(actor, [
      learningRecord({ id: "not-a-uuid", occurredAt: NOW }),
    ]),
    CourseBuilderValidationError,
  );
});

function fixture(input?: {
  run?: LessonRun;
  course?: CourseWorkspace;
  repository?: InMemoryLearningActivitiesRepository;
  clock?: ReturnType<typeof fixedLearningActivityClock>;
}) {
  const repository =
    input?.repository ?? new InMemoryLearningActivitiesRepository();
  const run = input?.run ?? lessonRun();
  const course = input?.course ?? courseWorkspace();
  return {
    repository,
    service: createLearningActivitiesService({
      repository,
      lessonRunsService: {
        async getRun(_actor, lessonRunId) {
          if (lessonRunId !== run.id) throw new CourseBuilderAccessError();
          return run;
        },
      },
      courseBuilderService: {
        async getCourse(_actor, courseId) {
          if (courseId !== course.id) throw new CourseBuilderAccessError();
          return course;
        },
      },
      clock: input?.clock,
    }),
  };
}

test("workspace composes the owned Run with the canonical ordered Lesson", async () => {
  const { repository, service } = fixture();
  repository.observations = [observation()];

  const workspace = await service.getRunWorkspace(actor, RUN_ID);

  assert.equal(workspace.run.id, RUN_ID);
  assert.equal(workspace.lesson.id, LESSON_ID);
  assert.deepEqual(
    workspace.lesson.components.map((item) => item.id),
    [COMPONENT_ID],
  );
  assert.equal(workspace.observations[0]?.learningRecordId, RECORD_ID);
  assert.deepEqual(workspace.attachments, []);
  assert.equal(workspace.learningObjectives[0]?.id, OBJECTIVE_ID);
});

test("component label uses registry title and one bounded canonical prompt excerpt", () => {
  const label = observationComponentLabel(component());
  assert.equal(label, "Свободный ответ: Объясните правило своими словами.");
  assert.doesNotMatch(label, /responseType|maxChars|2_000/);

  const longPrompt = "слово ".repeat(100);
  const longLabel = observationComponentLabel(
    component({ payload: { ...component().payload, prompt: longPrompt } }),
  );
  assert.ok(longLabel.length <= 500);
  assert.match(longLabel, /…$/);
});

test("save validates the open actual start, Component and expected records locally", async () => {
  const notStarted = fixture({
    run: lessonRun({ startedAt: null, startedAtIsActual: false }),
  });
  await assert.rejects(
    notStarted.service.saveRunObservations(actor, RUN_ID, {
      lessonComponentId: COMPONENT_ID,
      observableCriterionAtTime: "Отвечает",
      entryMethod: "direct",
      entries: [{ learningRecordId: RECORD_ID, rating: "independent" }],
    }),
    (error: unknown) =>
      error instanceof CourseBuilderConflictError &&
      error.code === "lesson_run_not_started",
  );
  assert.equal(notStarted.repository.saves.length, 0);

  const closed = fixture({ run: lessonRun({ endedAt: NOW }) });
  await assert.rejects(
    closed.service.saveRunObservations(actor, RUN_ID, {
      lessonComponentId: COMPONENT_ID,
      observableCriterionAtTime: "Отвечает",
      entryMethod: "direct",
      entries: [{ learningRecordId: RECORD_ID, rating: "independent" }],
    }),
    (error: unknown) =>
      error instanceof CourseBuilderConflictError &&
      error.code === "lesson_run_closed",
  );

  const { service } = fixture();
  await assert.rejects(
    service.saveRunObservations(actor, RUN_ID, {
      lessonComponentId: OTHER_COMPONENT_ID,
      observableCriterionAtTime: "Отвечает",
      entryMethod: "direct",
      entries: [{ learningRecordId: RECORD_ID, rating: "independent" }],
    }),
    CourseBuilderAccessError,
  );
  await assert.rejects(
    service.saveRunObservations(actor, RUN_ID, {
      lessonComponentId: COMPONENT_ID,
      observableCriterionAtTime: "Отвечает",
      entryMethod: "direct",
      entries: [{ learningRecordId: OTHER_RECORD_ID, rating: "independent" }],
    }),
    CourseBuilderAccessError,
  );
});

test("save sends only compact at-time context and returns all Run observations", async () => {
  const repository = new InMemoryLearningActivitiesRepository();
  const { service } = fixture({
    repository,
    course: courseWorkspace([
      component({
        primaryLearningObjectiveId: OBJECTIVE_ID,
        activityRole: "assessment",
      }),
    ]),
  });
  repository.objectiveContext = {
    learningObjectiveId: OBJECTIVE_ID,
    sourceLearningObjectiveIdAtTime: OBJECTIVE_ID,
    learningObjectiveTitleAtTime: "Объясняет правило своими словами",
  };

  const observations = await service.saveRunObservations(actor, RUN_ID, {
    lessonComponentId: COMPONENT_ID,
    observableCriterionAtTime: "  Объясняет правило своими словами  ",
    entryMethod: "bulk_confirmed",
    entries: [
      {
        learningRecordId: RECORD_ID,
        rating: "with_support",
        privateNote: "Нужен один вопрос",
      },
    ],
  });

  assert.equal(repository.saves.length, 1);
  assert.deepEqual(repository.saves[0], {
    lessonRunId: RUN_ID,
    lessonComponentId: COMPONENT_ID,
    componentLabelAtTime: "Свободный ответ: Объясните правило своими словами.",
    observableCriterionAtTime: "Объясняет правило своими словами",
    entryMethod: "bulk_confirmed",
    entries: [
      {
        learningRecordId: RECORD_ID,
        rating: "with_support",
        privateNote: "Нужен один вопрос",
      },
    ],
  });
  assert.equal(
    Object.prototype.hasOwnProperty.call(
      repository.saves[0],
      "learningObjectiveId",
    ),
    false,
  );
  assert.equal(observations[0]?.rating, "with_support");
  assert.equal(observations[0]?.entryMethod, "bulk_confirmed");
  assert.equal(observations[0]?.learningObjectiveId, OBJECTIVE_ID);
  assert.equal(observations[0]?.sourceLearningObjectiveIdAtTime, OBJECTIVE_ID);
  assert.equal(
    observations[0]?.learningObjectiveTitleAtTime,
    "Объясняет правило своими словами",
  );
});

test("service maps atomic RPC lifecycle and validation failures", async () => {
  const repository = new InMemoryLearningActivitiesRepository();
  const { service } = fixture({ repository });
  const input = {
    lessonComponentId: COMPONENT_ID,
    observableCriterionAtTime: "Отвечает",
    entryMethod: "direct" as const,
    entries: [{ learningRecordId: RECORD_ID, rating: "not_yet" as const }],
  };

  repository.saveError = new CourseBuilderRepositoryError(
    "lesson_run_not_open",
    400,
    "55000",
  );
  await assert.rejects(
    service.saveRunObservations(actor, RUN_ID, input),
    (error: unknown) =>
      error instanceof CourseBuilderConflictError &&
      error.code === "lesson_run_closed",
  );

  repository.saveError = new CourseBuilderRepositoryError(
    "lesson_component_observation_criterion_required",
    400,
    "22023",
  );
  await assert.rejects(
    service.saveRunObservations(actor, RUN_ID, input),
    CourseBuilderValidationError,
  );

  repository.saveError = new CourseBuilderRepositoryError(
    "lesson_component_observation_not_found",
    404,
    "P0002",
  );
  await assert.rejects(
    service.saveRunObservations(actor, RUN_ID, input),
    CourseBuilderAccessError,
  );

  repository.saveError = new CourseBuilderRepositoryError(
    "lesson_component_observation_record_duplicate",
    400,
    "22023",
  );
  await assert.rejects(
    service.saveRunObservations(actor, RUN_ID, input),
    CourseBuilderValidationError,
  );
});

test("history evidence and activity-profile reads validate IDs before fail-closed repository calls", async () => {
  const { repository, service } = fixture();
  assert.deepEqual(
    await service.listHistoryEvidence(actor, [RECORD_ID, RECORD_ID]),
    [],
  );
  assert.deepEqual(repository.evidenceHistoryReads, [[RECORD_ID]]);

  assert.equal(
    (await service.getTeacherLearnerActivityProfile(actor, LEARNER_ID))
      .learnerProfileId,
    LEARNER_ID,
  );
  assert.equal(
    (await service.getMyActivityProfile(actor)).projectionVersion,
    1,
  );
  assert.equal(
    (await service.getObservedActivityProfile(actor, LEARNER_ID))
      .projectionVersion,
    1,
  );
  assert.deepEqual(repository.teacherProfileReads, [LEARNER_ID]);
  assert.deepEqual(repository.observedProfileReads, [LEARNER_ID]);
  assert.equal(repository.selfProfileReadCount, 1);

  await assert.rejects(
    service.listHistoryEvidence(actor, ["not-a-uuid"]),
    CourseBuilderValidationError,
  );
  await assert.rejects(
    service.getTeacherLearnerActivityProfile(actor, "not-a-uuid"),
    CourseBuilderValidationError,
  );
  await assert.rejects(
    service.getObservedActivityProfile(actor, "not-a-uuid"),
    CourseBuilderValidationError,
  );
  assert.equal(repository.evidenceHistoryReads.length, 1);
});

test("finalized correction uses the injected server clock and never trusts browser time", async () => {
  const repository = new InMemoryLearningActivitiesRepository();
  const correctedAt = "2026-08-20T12:34:56.000Z";
  const { service } = fixture({
    repository,
    clock: fixedLearningActivityClock(correctedAt),
  });
  const idempotencyKey = uuid(70);

  const result = await service.correctFinalizedObservation(actor, LEARNER_ID, {
    observationId: uuid(20),
    expectedLearningRecordId: RECORD_ID,
    rating: "not_yet",
    privateNote: "  Перепроверить на следующем уроке  ",
    correctionReason: "  Ошибка при завершении  ",
    idempotencyKey,
  });

  assert.equal(result.correctedAt, correctedAt);
  assert.deepEqual(repository.corrections, [
    {
      observationId: uuid(20),
      learnerProfileId: LEARNER_ID,
      expectedLearningRecordId: RECORD_ID,
      rating: "not_yet",
      privateNote: "Перепроверить на следующем уроке",
      correctionReason: "Ошибка при завершении",
      idempotencyKey,
      correctedAt,
    },
  ]);

  await assert.rejects(
    service.correctFinalizedObservation(actor, LEARNER_ID, {
      observationId: uuid(20),
      expectedLearningRecordId: RECORD_ID,
      rating: "independent",
      privateNote: null,
      correctionReason: "Исправление",
      idempotencyKey,
      correctedAt: "2030-01-01T00:00:00.000Z",
    }),
    CourseBuilderValidationError,
  );
  assert.equal(repository.corrections.length, 1);
});

test("teacher recommendation override preserves explicit action and stale-write guard", async () => {
  const repository = new InMemoryLearningActivitiesRepository();
  const { service } = fixture({ repository });
  const expectedStateUpdatedAt = "2026-08-20T00:00:00.000Z";
  const result = await service.setRecommendationOverride(actor, LEARNER_ID, {
    sourceLearningObjectiveIdAtTime: OBJECTIVE_ID,
    action: "dismiss",
    recommendationType: null,
    privateReason: "Сейчас приоритет у другой темы",
    expectedStateUpdatedAt,
  });
  assert.equal(result.action, "dismiss");
  assert.deepEqual(repository.overrides, [
    {
      learnerProfileId: LEARNER_ID,
      sourceLearningObjectiveIdAtTime: OBJECTIVE_ID,
      action: "dismiss",
      recommendationType: null,
      privateReason: "Сейчас приоритет у другой темы",
      expectedStateUpdatedAt,
    },
  ]);

  await assert.rejects(
    service.setRecommendationOverride(actor, LEARNER_ID, {
      sourceLearningObjectiveIdAtTime: OBJECTIVE_ID,
      action: "replace",
      recommendationType: null,
      privateReason: "Причина",
      expectedStateUpdatedAt,
    }),
    CourseBuilderValidationError,
  );
  assert.equal(repository.overrides.length, 1);
});

test("service maps correction and recommendation races to explicit conflicts", async () => {
  const repository = new InMemoryLearningActivitiesRepository();
  const { service } = fixture({ repository });
  repository.saveError = new CourseBuilderRepositoryError(
    "finalized_observation_changed",
    409,
    "40001",
  );
  await assert.rejects(
    service.correctFinalizedObservation(actor, LEARNER_ID, {
      observationId: uuid(20),
      expectedLearningRecordId: RECORD_ID,
      rating: "independent",
      privateNote: null,
      correctionReason: "Исправление",
      idempotencyKey: uuid(70),
    }),
    (error: unknown) =>
      error instanceof CourseBuilderConflictError &&
      error.code === "observation_correction_conflict",
  );

  repository.saveError = new CourseBuilderRepositoryError(
    "learner_recommendation_override_state_changed",
    409,
    "40001",
  );
  await assert.rejects(
    service.setRecommendationOverride(actor, LEARNER_ID, {
      sourceLearningObjectiveIdAtTime: OBJECTIVE_ID,
      action: "clear",
      recommendationType: null,
      privateReason: null,
      expectedStateUpdatedAt: "2026-08-20T00:00:00.000Z",
    }),
    (error: unknown) =>
      error instanceof CourseBuilderConflictError &&
      error.code === "recommendation_state_stale",
  );
});

test("service maps a no-op finalized correction to safe validation", async () => {
  const repository = new InMemoryLearningActivitiesRepository();
  const { service } = fixture({ repository });
  repository.saveError = new CourseBuilderRepositoryError(
    "learning_observation_correction_no_change",
    400,
    "22023",
  );
  await assert.rejects(
    service.correctFinalizedObservation(actor, LEARNER_ID, {
      observationId: uuid(20),
      expectedLearningRecordId: RECORD_ID,
      rating: "independent",
      privateNote: null,
      correctionReason: "Проверка",
      idempotencyKey: uuid(70),
    }),
    CourseBuilderValidationError,
  );
});
