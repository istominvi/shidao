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
  LessonComponentObservation,
  ObservationEntryMethod,
} from "./domain";
import type {
  LearningActivitiesRepository,
  SaveRunObservationsRepositoryInput,
} from "./repository";
import {
  createLearningActivitiesService,
  observationComponentLabel,
} from "./service";

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
  };
}

function observation(
  overrides: Partial<LessonComponentObservation> = {},
): LessonComponentObservation {
  return {
    id: uuid(20),
    learningRecordId: RECORD_ID,
    lessonComponentId: COMPONENT_ID,
    sourceComponentIdAtTime: COMPONENT_ID,
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
  saves: SaveRunObservationsRepositoryInput[] = [];
  saveError: Error | null = null;

  async listByLearningRecordIds(learningRecordIds: string[]) {
    this.historyReads.push(learningRecordIds);
    const ids = new Set(learningRecordIds);
    return this.observations.filter((item) => ids.has(item.learningRecordId));
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
          componentLabelAtTime: input.componentLabelAtTime,
          observableCriterionAtTime: input.observableCriterionAtTime ?? "",
          rating: entry.rating,
          entryMethod: input.entryMethod as ObservationEntryMethod,
          privateNote: entry.privateNote,
        }),
      );
    }
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

function fixture(input?: {
  run?: LessonRun;
  course?: CourseWorkspace;
  repository?: InMemoryLearningActivitiesRepository;
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
  const { repository, service } = fixture();

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
  assert.equal(observations[0]?.rating, "with_support");
  assert.equal(observations[0]?.entryMethod, "bulk_confirmed");
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
