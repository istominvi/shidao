import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { CourseBuilderActor } from "../domain";
import {
  componentRegistry,
  creatableComponentTypeKeys,
} from "../registry/contracts";
import {
  courseBuilderMcpInputContracts,
  courseBuilderMcpInputJsonSchemas,
  courseBuilderMcpToolNames,
  createCourseBuilderMcpTools,
  type CourseBuilderMcpApplicationService,
} from "./tools";

const COURSE_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const LESSON_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const COMPONENT_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const OBJECTIVE_ID = "ffffffff-ffff-4fff-8fff-ffffffffffff";

const actor: CourseBuilderActor = {
  authUserId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
  supabaseSessionId: "99999999-9999-4999-8999-999999999999",
  accessToken: "private-user-jwt",
};

type RecordedCall = {
  method: string;
  args: unknown[];
};

function createServiceDouble(calls: RecordedCall[]) {
  const record = (method: string, args: unknown[]) => {
    calls.push({ method, args });
    return Promise.resolve({ method });
  };

  return {
    createDraft: (...args: unknown[]) => record("createDraft", args),
    getCourse: (...args: unknown[]) => record("getCourse", args),
    addLesson: (...args: unknown[]) => record("addLesson", args),
    createLearningObjective: (...args: unknown[]) =>
      record("createLearningObjective", args),
    archiveLearningObjective: (...args: unknown[]) =>
      record("archiveLearningObjective", args),
    addComponent: (...args: unknown[]) => record("addComponent", args),
    updateComponent: (...args: unknown[]) => record("updateComponent", args),
    setComponentStudentScreen: (...args: unknown[]) =>
      record("setComponentStudentScreen", args),
    reorderComponent: (...args: unknown[]) => record("reorderComponent", args),
  } as unknown as CourseBuilderMcpApplicationService;
}

test("adapter exposes the internal Course Builder tools", () => {
  const tools = createCourseBuilderMcpTools({
    service: createServiceDouble([]),
    actor,
  });

  assert.deepEqual(
    tools.map((tool) => tool.name),
    courseBuilderMcpToolNames,
  );
  assert.deepEqual(Object.keys(courseBuilderMcpInputContracts), [
    ...courseBuilderMcpToolNames,
  ]);
  assert.deepEqual(Object.keys(courseBuilderMcpInputJsonSchemas), [
    ...courseBuilderMcpToolNames,
  ]);

  for (const tool of tools) {
    assert.equal(tool.inputContract, courseBuilderMcpInputContracts[tool.name]);
    assert.equal(tool.inputSchema, courseBuilderMcpInputJsonSchemas[tool.name]);
    assert.equal(
      tool.inputSchema.$schema,
      "https://json-schema.org/draft/2020-12/schema",
    );
    assert.doesNotThrow(() => JSON.stringify(tool.inputSchema));
  }
});

test("JSON Schema is generated from the canonical application and registry contracts", () => {
  const draftJson = JSON.stringify(
    courseBuilderMcpInputJsonSchemas["course.create_draft"],
  );
  assert.match(draftJson, /targetLessonCount/);
  assert.match(draftJson, /teacherPreferences/);

  const addComponentJson = JSON.stringify(
    courseBuilderMcpInputJsonSchemas["lesson.add_component"],
  );
  assert.match(addComponentJson, /lessonId/);
  assert.doesNotMatch(addComponentJson, /lessonStepId/);
  assert.doesNotMatch(
    addComponentJson,
    /visibility|learner_visible|staff_only/,
  );
  for (const typeKey of creatableComponentTypeKeys) {
    assert.match(addComponentJson, new RegExp(`"const":"${typeKey}"`));
  }
  assert.doesNotMatch(addComponentJson, /"const":"heading"/);
  assert.match(addComponentJson, /storedFileId/);
  assert.match(addComponentJson, /showResults/);
  assert.match(addComponentJson, /shuffle/);
  assert.match(addComponentJson, /primaryLearningObjectiveId/);
  assert.match(addComponentJson, /activityRole/);

  const createObjectiveJson = JSON.stringify(
    courseBuilderMcpInputJsonSchemas["course.create_learning_objective"],
  );
  assert.match(createObjectiveJson, /courseId/);
  assert.match(createObjectiveJson, /title/);
  assert.match(createObjectiveJson, /description/);

  const updateComponentJson = JSON.stringify(
    courseBuilderMcpInputJsonSchemas["lesson.update_component"],
  );
  assert.match(updateComponentJson, /componentId/);
  assert.match(updateComponentJson, /primaryLearningObjectiveId/);
  assert.match(updateComponentJson, /practice|assessment|survey/);

  const studentScreenJson = JSON.stringify(
    courseBuilderMcpInputJsonSchemas["lesson.set_component_student_screen"],
  );
  assert.match(studentScreenJson, /componentId/);
  assert.match(studentScreenJson, /existing/);
  assert.match(studentScreenJson, /slideId/);
  assert.match(studentScreenJson, /new/);
  assert.match(studentScreenJson, /hide/);
});

test("each tool validates input and delegates once with the injected actor", async () => {
  const calls: RecordedCall[] = [];
  const tools = createCourseBuilderMcpTools({
    service: createServiceDouble(calls),
    actor,
  });
  const byName = new Map(tools.map((tool) => [tool.name, tool]));

  await byName.get("course.create_draft")?.execute({
    title: "Китайский для путешествий",
    subject: "Китайский язык",
    goal: "Общаться в поездке",
    level: "Начальный",
    targetLessonCount: 8,
  });
  await byName.get("course.get")?.execute({ courseId: COURSE_ID });
  await byName.get("course.add_lesson")?.execute({
    courseId: COURSE_ID,
    title: "Знакомство",
  });
  await byName.get("course.create_learning_objective")?.execute({
    courseId: COURSE_ID,
    title: "Различает приветствия",
  });
  await byName.get("course.archive_learning_objective")?.execute({
    courseId: COURSE_ID,
    learningObjectiveId: OBJECTIVE_ID,
  });
  await byName.get("lesson.add_component")?.execute({
    lessonId: LESSON_ID,
    typeKey: "rich_text",
    payload: { title: "Знакомство", format: "markdown" },
    placement: componentRegistry.rich_text.defaultPlacement,
  });
  await byName.get("lesson.update_component")?.execute({
    componentId: COMPONENT_ID,
    primaryLearningObjectiveId: OBJECTIVE_ID,
    activityRole: "assessment",
  });
  await byName.get("lesson.set_component_student_screen")?.execute({
    componentId: COMPONENT_ID,
    mode: "new",
  });
  await byName.get("lesson.reorder_component")?.execute({
    componentId: COMPONENT_ID,
    toPosition: 2,
  });

  assert.deepEqual(
    calls.map((call) => call.method),
    [
      "createDraft",
      "getCourse",
      "addLesson",
      "createLearningObjective",
      "archiveLearningObjective",
      "addComponent",
      "updateComponent",
      "setComponentStudentScreen",
      "reorderComponent",
    ],
  );
  for (const call of calls) assert.equal(call.args[0], actor);

  assert.deepEqual(calls[0]?.args[1], {
    title: "Китайский для путешествий",
    learningAudience: "children",
    subject: "Китайский язык",
    goal: "Общаться в поездке",
    level: "Начальный",
    audienceDescription: "",
    targetLessonCount: 8,
    teacherPreferences: "",
  });
  assert.deepEqual(calls[2]?.args.slice(1), [
    COURSE_ID,
    {
      title: "Знакомство",
      summary: "",
    },
  ]);
  assert.deepEqual(calls[3]?.args.slice(1), [
    COURSE_ID,
    {
      title: "Различает приветствия",
      description: null,
    },
  ]);
  assert.deepEqual(calls[4]?.args.slice(1), [COURSE_ID, OBJECTIVE_ID]);
  assert.deepEqual(calls[5]?.args[1], {
    lessonId: LESSON_ID,
    typeKey: "rich_text",
    payload: { title: "Знакомство", format: "markdown" },
    placement: componentRegistry.rich_text.defaultPlacement,
    primaryLearningObjectiveId: null,
    activityRole: null,
  });
  assert.deepEqual(calls[6]?.args.slice(1), [
    COMPONENT_ID,
    {
      primaryLearningObjectiveId: OBJECTIVE_ID,
      activityRole: "assessment",
    },
  ]);
  assert.deepEqual(calls[7]?.args.slice(1), [COMPONENT_ID, { mode: "new" }]);
  assert.deepEqual(calls[8]?.args.slice(1), [COMPONENT_ID, { toPosition: 2 }]);
});

test("invalid tool input never reaches the application service", async () => {
  const calls: RecordedCall[] = [];
  const events: unknown[] = [];
  const tools = createCourseBuilderMcpTools({
    service: createServiceDouble(calls),
    actor,
    audit: (event) => {
      events.push(event);
    },
  });
  const addComponent = tools.find(
    (tool) => tool.name === "lesson.add_component",
  );

  await assert.rejects(
    addComponent?.execute({
      lessonId: LESSON_ID,
      typeKey: "heading",
      payload: componentRegistry.heading.defaultPayload,
      placement: componentRegistry.heading.defaultPlacement,
    }) ?? Promise.reject(new Error("tool not found")),
  );
  assert.deepEqual(calls, []);
  assert.deepEqual(events, [
    {
      toolName: "lesson.add_component",
      actorAuthUserId: actor.authUserId,
      outcome: "error",
      errorCode: "ZodError",
    },
  ]);
});

test("MCP role validation is registry-driven and fails before the service", async () => {
  const calls: RecordedCall[] = [];
  const tools = createCourseBuilderMcpTools({
    service: createServiceDouble(calls),
    actor,
    audit: () => undefined,
  });
  const addComponent = tools.find(
    (tool) => tool.name === "lesson.add_component",
  );

  await assert.rejects(
    addComponent?.execute({
      lessonId: LESSON_ID,
      typeKey: "rich_text",
      payload: componentRegistry.rich_text.defaultPayload,
      placement: componentRegistry.rich_text.defaultPlacement,
      activityRole: "assessment",
    }) ?? Promise.reject(new Error("tool not found")),
  );
  assert.deepEqual(calls, []);
});

test("adapter logs only safe result identifiers and strips signed attachment URLs", async () => {
  const events: unknown[] = [];
  const service = {
    ...createServiceDouble([]),
    getCourse: async () => ({
      id: COURSE_ID,
      attachments: [
        {
          id: COMPONENT_ID,
          originalFilename: "private.pdf",
          signedUrl: "https://storage.invalid/signed?token=secret",
        },
      ],
    }),
  } as unknown as CourseBuilderMcpApplicationService;
  const tool = createCourseBuilderMcpTools({
    service,
    actor,
    audit: (event) => {
      events.push(event);
    },
  }).find((candidate) => candidate.name === "course.get");

  const result = (await tool?.execute({ courseId: COURSE_ID })) as {
    attachments: Array<Record<string, unknown>>;
  };
  assert.equal("signedUrl" in result.attachments[0]!, false);
  assert.deepEqual(events, [
    {
      toolName: "course.get",
      actorAuthUserId: actor.authUserId,
      outcome: "success",
      resultIds: { id: COURSE_ID },
    },
  ]);
  assert.doesNotMatch(JSON.stringify(events), /secret|private\.pdf|signed/i);
});

test("the internal adapter has no repository, database, transport or endpoint dependency", () => {
  const source = readFileSync(
    "src/modules/course-builder/mcp/tools.ts",
    "utf8",
  );

  assert.doesNotMatch(source, /from ["'][^"']*repository["']/);
  assert.doesNotMatch(
    source,
    /supabase|postgres|fetch\(|NextRequest|NextResponse/i,
  );
});
