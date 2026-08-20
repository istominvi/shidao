import assert from "node:assert/strict";
import test from "node:test";
import {
  catalogQuerySchema,
  coursePublicationSnapshotSchema,
  CoursePublicationValidationError,
  parsePublicationContract,
  rightsConfirmationInputSchema,
} from "./contracts";

const COURSE_FIELDS = {
  title: "Китайский с нуля",
  subject: "Китайский язык",
  goal: "Научиться вести короткий диалог",
  level: "Начальный",
  audienceDescription: "Дети 9–11 лет",
  targetLessonCount: 8,
};

const OBJECTIVE_REF = "00000000-0000-4000-8000-000000000101";
const LESSON_REF = "00000000-0000-4000-8000-000000000201";
const COMPONENT_REF = "00000000-0000-4000-8000-000000000301";

function v1Snapshot() {
  return {
    schemaVersion: 1 as const,
    course: COURSE_FIELDS,
    lessons: [],
    materials: [],
  };
}

function v2Snapshot() {
  return {
    schemaVersion: 2 as const,
    course: COURSE_FIELDS,
    objectives: [
      {
        ref: OBJECTIVE_REF,
        position: 1,
        title: "Распознавать приветствие на слух",
        description: null,
        archivedAt: null,
      },
    ],
    lessons: [
      {
        ref: LESSON_REF,
        position: 1,
        title: "Знакомство",
        summary: "Комментарий преподавателя",
        estimatedDurationMinutes: 45,
        components: [
          {
            ref: COMPONENT_REF,
            position: 1,
            typeKey: "choice_quiz" as const,
            schemaVersion: 1,
            payload: {},
            placement: {},
            visibility: "learner_visible" as const,
            studentSlideRef: null,
            primaryObjectiveRef: OBJECTIVE_REF,
            activityRole: "assessment" as const,
          },
        ],
        slides: [],
      },
    ],
    materials: [],
  };
}

test("catalog audience defaults to children and accepts educators", () => {
  assert.equal(catalogQuerySchema.parse({}).learningAudience, "children");
  assert.equal(
    catalogQuerySchema.parse({ learningAudience: "educators" })
      .learningAudience,
    "educators",
  );
  assert.equal(
    catalogQuerySchema.safeParse({ learningAudience: "all" }).success,
    false,
  );
});

test("publication rights confirmation is explicit and strict", () => {
  assert.deepEqual(
    parsePublicationContract(rightsConfirmationInputSchema, {
      rightsConfirmed: true,
    }),
    { rightsConfirmed: true },
  );
  assert.throws(
    () =>
      parsePublicationContract(rightsConfirmationInputSchema, {
        rightsConfirmed: false,
      }),
    CoursePublicationValidationError,
  );
  assert.throws(
    () =>
      parsePublicationContract(rightsConfirmationInputSchema, {
        rightsConfirmed: true,
        previewAccepted: true,
      }),
    CoursePublicationValidationError,
  );
});

test("publication snapshots preserve the exact legacy V1 branch", () => {
  const input = v1Snapshot();
  const before = JSON.stringify(input);
  const parsed = coursePublicationSnapshotSchema.parse(input);

  assert.equal(parsed.schemaVersion, 1);
  assert.equal("objectives" in parsed, false);
  assert.equal(JSON.stringify(input), before);
  assert.equal(
    coursePublicationSnapshotSchema.safeParse({
      ...input,
      objectives: [],
    }).success,
    false,
  );
});

test("publication snapshots accept the strict objective-aligned V2 branch", () => {
  const parsed = coursePublicationSnapshotSchema.parse(v2Snapshot());
  assert.equal(parsed.schemaVersion, 2);
  assert.equal(parsed.objectives[0]?.ref, OBJECTIVE_REF);
  assert.equal(
    parsed.lessons[0]?.components[0]?.primaryObjectiveRef,
    OBJECTIVE_REF,
  );
  assert.equal(parsed.lessons[0]?.components[0]?.activityRole, "assessment");
});

test("publication snapshot union rejects mixed, unknown and dangling V2 shapes", () => {
  const v2 = v2Snapshot();
  const component = v2.lessons[0]!.components[0]!;
  const v2WithoutObjectives: Record<string, unknown> = { ...v2 };
  delete v2WithoutObjectives.objectives;
  for (const invalid of [
    { ...v1Snapshot(), objectives: [] },
    { ...v2, schemaVersion: 3 },
    v2WithoutObjectives,
    { ...v2, privateEvaluator: true },
    {
      ...v2,
      lessons: [
        {
          ...v2.lessons[0]!,
          components: [
            {
              ref: component.ref,
              position: component.position,
              typeKey: component.typeKey,
              schemaVersion: component.schemaVersion,
              payload: component.payload,
              placement: component.placement,
              visibility: component.visibility,
              studentSlideRef: component.studentSlideRef,
            },
          ],
        },
      ],
    },
    {
      ...v2,
      lessons: [
        {
          ...v2.lessons[0]!,
          components: [
            {
              ...component,
              primaryObjectiveRef: "00000000-0000-4000-8000-000000000999",
            },
          ],
        },
      ],
    },
    {
      ...v2,
      objectives: [
        v2.objectives[0]!,
        {
          ...v2.objectives[0]!,
          ref: "00000000-0000-4000-8000-000000000102",
        },
      ],
    },
  ]) {
    assert.equal(
      coursePublicationSnapshotSchema.safeParse(invalid).success,
      false,
    );
  }
});
