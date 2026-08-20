import assert from "node:assert/strict";
import test from "node:test";
import type {
  CourseWorkspace,
  LessonComponent,
} from "@/modules/course-builder/domain";
import type {
  CourseAudience,
  LearnerProfile,
  LearningRecord,
  LessonRun,
} from "@/modules/lesson-runs/domain";
import {
  MAX_AI_CONTEXT_CHARACTERS,
  buildAssistantContext,
  buildCoursePlanningContext,
  buildLessonPlanningContext,
} from "./course-context";

function component(index: number): LessonComponent {
  return {
    id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    lessonId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    typeKey: "rich_text",
    schemaVersion: 1,
    position: index,
    payload: {
      content: `Материал ${index}`,
      format: "markdown",
      storedFileId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    },
    placement: { width: "content", textAlign: "start" },
    visibility: "staff_only",
    studentSlideId: null,
    primaryLearningObjectiveId: null,
    activityRole: null,
    createdAt: "2026-08-05T00:00:00.000Z",
    updatedAt: "2026-08-05T00:00:00.000Z",
  };
}

function workspace(): CourseWorkspace {
  return {
    id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    ownerAccountId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    title: "Дроби",
    learningAudience: "children",
    subject: "Математика",
    goal: "Научиться считать",
    level: "5 класс",
    audienceDescription: "Один ученик",
    targetLessonCount: 8,
    teacherPreferences: "Больше практики",
    status: "draft",
    lessonCount: 1,
    assembledAt: null,
    createdAt: "2026-08-05T00:00:00.000Z",
    publicationContentUpdatedAt: "2026-08-05T00:00:00.000Z",
    updatedAt: "2026-08-05T00:00:00.000Z",
    learningObjectives: [],
    lessons: [
      {
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        courseId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        position: 1,
        title: "Сравнение дробей",
        summary: "Комментарий преподавателя",
        components: Array.from({ length: 21 }, (_, index) =>
          component(index + 1),
        ),
        studentSlides: [],
        createdAt: "2026-08-05T00:00:00.000Z",
        updatedAt: "2026-08-05T00:00:00.000Z",
      },
    ],
    attachments: [
      {
        id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        originalFilename: "private.pdf",
        mimeType: "application/pdf",
        sizeBytes: 123,
        checksumSha256: "secret-checksum",
        status: "ready",
        signedUrl: "https://storage.test/private-signed-url",
        createdAt: "2026-08-05T00:00:00.000Z",
      },
    ],
  };
}

function learningRecord(
  overrides: Partial<LearningRecord> = {},
): LearningRecord {
  return {
    id: "30000000-0000-4000-8000-000000000001",
    learnerProfileId: "30000000-0000-4000-8000-000000000002",
    recordedByAccountId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    learnerDisplayName: "Анна",
    lessonRunId: "30000000-0000-4000-8000-000000000003",
    sourceCourseId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    sourceLessonId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    occurredAt: "2026-08-06T11:00:00.000Z",
    wasPresent: true,
    needsRepeat: true,
    teacherComment: "Путает знаменатель и числитель.",
    courseTitleAtTime: "Дроби",
    lessonTitleAtTime: "Сравнение дробей",
    subjectAtTime: "Математика",
    createdAt: "2026-08-06T10:00:00.000Z",
    updatedAt: "2026-08-06T11:00:00.000Z",
    ...overrides,
  };
}

function learnerProfile(id: string, displayName: string): LearnerProfile {
  return {
    id,
    teacherAccountId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    displayName,
    archivedAt: null,
    createdAt: "2026-08-05T00:00:00.000Z",
    updatedAt: "2026-08-05T00:00:00.000Z",
  };
}

function lessonRun(
  records: LearningRecord[],
  overrides: Partial<LessonRun> = {},
): LessonRun {
  return {
    id: "30000000-0000-4000-8000-000000000003",
    lessonId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    courseId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    lessonTitle: "Сравнение дробей",
    courseTitle: "Дроби",
    scheduledAt: "2026-08-06T10:00:00.000Z",
    plannedDurationMinutes: 60,
    startedAt: "2026-08-06T10:00:00.000Z",
    endedAt: "2026-08-06T11:00:00.000Z",
    cancelledAt: null,
    teacherReport: "Повторили общий знаменатель.",
    records,
    createdAt: "2026-08-06T09:00:00.000Z",
    updatedAt: "2026-08-06T11:00:00.000Z",
    ...overrides,
  };
}

test("AI context excludes storage credentials, file IDs and file contents", () => {
  const course = workspace();
  const serialized = JSON.stringify(buildCoursePlanningContext(course));
  assert.match(serialized, /private\.pdf/);
  assert.match(serialized, /только прикреплён/);
  assert.doesNotMatch(serialized, /private-signed-url|secret-checksum/);
  assert.doesNotMatch(
    serialized,
    /bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb|ownerAccountId|teacherAccountId|recordedByAccountId/,
  );
});

test("assistant context explicitly marks component truncation", () => {
  const course = workspace();
  const context = buildAssistantContext(course, course.lessons[0]);
  assert.equal(context.selectedLesson?.componentCount, 21);
  assert.equal(context.selectedLesson?.componentsIncluded, 20);
  assert.equal(context.selectedLesson?.componentsTruncated, true);
  assert.equal(context.selectedLesson?.components.length, 20);
  assert.doesNotMatch(JSON.stringify(context), /storedFileId/);
});

test("AI context includes Course objectives and Component alignment without IDs", () => {
  const course = workspace();
  const objectiveId = "90000000-0000-4000-8000-000000000001";
  course.learningObjectives = [
    {
      id: objectiveId,
      courseId: course.id,
      title: "Сравнивает дроби с общим знаменателем",
      description: "Объясняет выбор большего числителя",
      archivedAt: null,
      createdAt: "2026-08-05T00:00:00.000Z",
      updatedAt: "2026-08-05T00:00:00.000Z",
    },
  ];
  course.lessons[0]!.components[0] = {
    ...course.lessons[0]!.components[0]!,
    primaryLearningObjectiveId: objectiveId,
    activityRole: "assessment",
  };

  const context = buildLessonPlanningContext(
    course,
    course.lessons[0]!,
    course.lessons[0]!.title,
  );
  const serialized = JSON.stringify(context);

  assert.equal(context.learningObjectives.objectiveCount, 1);
  assert.equal(
    context.lesson.components[0]?.primaryLearningObjective?.title,
    "Сравнивает дроби с общим знаменателем",
  );
  assert.equal(context.lesson.components[0]?.activityRole, "assessment");
  assert.match(serialized, /Объясняет выбор большего числителя/);
  assert.doesNotMatch(serialized, /90000000-0000-4000-8000/);
  assert.doesNotMatch(serialized, /primaryLearningObjectiveId|courseId/);
});

test("lesson planning context contains bounded finalized learner history without technical IDs", () => {
  const course = workspace();
  const present = learningRecord();
  const absent = learningRecord({
    id: "30000000-0000-4000-8000-000000000004",
    learnerProfileId: "30000000-0000-4000-8000-000000000005",
    learnerDisplayName: "Борис",
    wasPresent: false,
    needsRepeat: false,
    teacherComment: "Не присутствовал.",
  });
  const draft = learningRecord({
    id: "30000000-0000-4000-8000-000000000006",
    occurredAt: null,
    wasPresent: null,
    needsRepeat: null,
  });
  const context = buildLessonPlanningContext(
    course,
    course.lessons[0]!,
    course.lessons[0]!.title,
    {
      runs: [
        lessonRun([present, absent]),
        lessonRun([draft], {
          id: "30000000-0000-4000-8000-000000000007",
          startedAt: null,
          endedAt: null,
          teacherReport: "",
        }),
      ],
      records: [present, absent, draft],
    },
  );
  const serialized = JSON.stringify(context.learningHistory);

  assert.equal(context.learningHistory.completedRunsIncluded, 1);
  assert.equal(context.learningHistory.learnerResultsIncluded, 2);
  assert.match(serialized, /Анна|Борис|Путает знаменатель/);
  assert.match(serialized, /Отсутствие ученика не является результатом/);
  assert.doesNotMatch(
    serialized,
    /30000000-0000-4000-8000|learnerProfileId|lessonRunId/,
  );
  assert.equal(
    context.learningHistory.recentLearnerResults.find(
      (record) => record.learner === "Борис",
    )?.needsRepeat,
    null,
  );
});

test("consented shared history is bounded, de-attributed and separate from raw recorder history", () => {
  const course = workspace();
  const context = buildLessonPlanningContext(
    course,
    course.lessons[0]!,
    course.lessons[0]!.title,
    { runs: [], records: [] },
    {
      used: true,
      revision: "a".repeat(64),
      projectionVersion: 1,
      aggregates: {
        conductedCount: 5,
        presentCount: 4,
        absentCount: 1,
        repeatCount: 2,
        knownDurationCount: 3,
        actualDurationMinutes: 135,
        lastActivityMonth: "2026-08",
        subjectBreakdown: [{ subjectBucket: "Математика", count: 5 }],
      },
      sharedCommentSummaries: ["Стоит повторить работу с дробями."],
    },
  );
  const serialized = JSON.stringify(context.sharedCanonicalHistory);

  assert.equal(context.sharedCanonicalHistory?.aggregates.conductedCount, 5);
  assert.match(serialized, /Стоит повторить работу с дробями/);
  assert.doesNotMatch(
    serialized,
    /recordedBy|learnerProfile|lessonRun|teacherReport|occurredAt|courseTitle|lessonTitle/,
  );
  assert.doesNotMatch(serialized, /aaaaaaaa-aaaa|cccccccc-cccc/);
});

test("AI context describes mixed audience without duplicating technical identity", () => {
  const course = workspace();
  const anna = learnerProfile("30000000-0000-4000-8000-000000000002", "Анна");
  const boris = learnerProfile("30000000-0000-4000-8000-000000000005", "Борис");
  const audience: CourseAudience = {
    directLearners: [anna],
    groups: [
      {
        id: "30000000-0000-4000-8000-000000000010",
        ownerAccountId: course.ownerAccountId,
        name: "Teen Talk",
        members: [anna, boris],
        createdAt: "2026-08-05T00:00:00.000Z",
        updatedAt: "2026-08-05T00:00:00.000Z",
      },
    ],
    effectiveLearners: [anna, boris],
  };
  const context = buildAssistantContext(course, null, {
    audience,
    runs: [],
    records: [],
  });
  const serialized = JSON.stringify(context.currentAudience);

  assert.equal(context.currentAudience.directLearnerCount, 1);
  assert.equal(context.currentAudience.effectiveLearnerCount, 2);
  assert.match(serialized, /Teen Talk|Анна|Борис|дедуплицирована/);
  assert.doesNotMatch(
    serialized,
    /30000000-0000-4000-8000|ownerAccountId|teacherAccountId|recordedByAccountId/,
  );
});

test("maximum-sized course and learning history stay inside one safe context budget", () => {
  const course = workspace();
  const richComponents = Array.from({ length: 20 }, (_, index) => ({
    ...component(index + 1),
    payload: { content: "я".repeat(20_000), format: "markdown" },
  }));
  course.title = "к".repeat(160);
  course.subject = "п".repeat(160);
  course.goal = "ц".repeat(1_200);
  course.level = "у".repeat(240);
  course.audienceDescription = "а".repeat(1_200);
  course.teacherPreferences = "н".repeat(2_000);
  course.lessons = Array.from({ length: 60 }, (_, index) => ({
    ...course.lessons[0]!,
    id: `10000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    position: index + 1,
    title: `Урок ${index + 1} ${"т".repeat(160)}`,
    summary: "к".repeat(1_200),
    components: index === 0 ? richComponents : [],
  }));
  course.lessonCount = course.lessons.length;
  course.targetLessonCount = course.lessons.length;
  course.attachments = Array.from({ length: 30 }, (_, index) => ({
    ...course.attachments[0]!,
    id: `40000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    originalFilename: `${"ф".repeat(251)}.pdf`,
  }));

  const records = Array.from({ length: 40 }, (_, index) =>
    learningRecord({
      id: `50000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
      learnerProfileId: `60000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
      learnerDisplayName: "у".repeat(160),
      teacherComment: "к".repeat(2_000),
      courseTitleAtTime: "к".repeat(160),
      lessonTitleAtTime: "л".repeat(180),
      subjectAtTime: "п".repeat(160),
    }),
  );
  const runs = Array.from({ length: 8 }, (_, index) =>
    lessonRun(records.slice(index * 5, index * 5 + 5), {
      id: `70000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
      lessonTitle: "л".repeat(180),
      courseTitle: "к".repeat(160),
      teacherReport: "о".repeat(4_000),
    }),
  );
  const history = { runs, records };

  const assistant = buildAssistantContext(course, course.lessons[0]!, history);
  const lesson = buildLessonPlanningContext(
    course,
    course.lessons[0]!,
    course.lessons[0]!.title,
    history,
  );
  const coursePlan = buildCoursePlanningContext(course);

  for (const context of [assistant, lesson, coursePlan]) {
    const characters = JSON.stringify(context).length;
    assert.ok(
      characters <= MAX_AI_CONTEXT_CHARACTERS,
      `${characters} > ${MAX_AI_CONTEXT_CHARACTERS}`,
    );
  }
  assert.equal(assistant.learningHistory.completedRunsIncluded, 8);
  assert.equal(assistant.learningHistory.learnerResultsIncluded, 40);
  assert.equal(assistant.learningHistory.recentRuns.length, 8);
  assert.equal(assistant.learningHistory.recentLearnerResults.length, 40);
});
