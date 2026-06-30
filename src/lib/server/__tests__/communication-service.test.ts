import assert from "node:assert/strict";
import test from "node:test";
import {
  filterConversationMessages,
  getAuthorizedTeacherConversationReadModel,
  getParentCommunicationProjection,
} from "../communication-service";
import type { GroupStudentMessage } from "../communication-repository";

function buildMessage(
  id: string,
  body: string,
  createdAt: string,
): GroupStudentMessage {
  return {
    id,
    conversationId: `conv-${id}`,
    authorUserId: "u-1",
    authorRole: "teacher",
    body,
    scheduledLessonId: null,
    scheduledLessonHomeworkAssignmentId: null,
    topicKind: "general",
    createdAt,
  };
}

const messages: GroupStudentMessage[] = [
  {
    id: "m-1",
    conversationId: "c-1",
    authorUserId: "u-1",
    authorRole: "teacher",
    body: "general",
    scheduledLessonId: null,
    scheduledLessonHomeworkAssignmentId: null,
    topicKind: "general",
    createdAt: "2026-04-07T00:00:00Z",
  },
  {
    id: "m-2",
    conversationId: "c-1",
    authorUserId: "u-2",
    authorRole: "student",
    body: "lesson",
    scheduledLessonId: "lesson-1",
    scheduledLessonHomeworkAssignmentId: null,
    topicKind: "lesson",
    createdAt: "2026-04-07T00:01:00Z",
  },
  {
    id: "m-3",
    conversationId: "c-1",
    authorUserId: "u-2",
    authorRole: "student",
    body: "homework",
    scheduledLessonId: "lesson-1",
    scheduledLessonHomeworkAssignmentId: "ha-1",
    topicKind: "homework",
    createdAt: "2026-04-07T00:02:00Z",
  },
];

test("communication filter supports all/lesson/homework/general projections", () => {
  assert.equal(filterConversationMessages(messages, "all").length, 3);
  assert.deepEqual(
    filterConversationMessages(messages, "lesson").map((m) => m.id),
    ["m-2", "m-3"],
  );
  assert.deepEqual(
    filterConversationMessages(messages, "homework").map((m) => m.id),
    ["m-3"],
  );
  assert.deepEqual(
    filterConversationMessages(messages, "general").map((m) => m.id),
    ["m-1"],
  );
});

test("communication filter narrows by lesson/homework context to prevent cross-context leakage", () => {
  assert.deepEqual(
    filterConversationMessages(messages, "all", "lesson-1", undefined).map((m) => m.id),
    ["m-2", "m-3"],
  );
  assert.deepEqual(
    filterConversationMessages(messages, "all", undefined, "ha-1").map((m) => m.id),
    ["m-3"],
  );
});

test("authorized teacher reader rejects a teacher not assigned to the class (IDOR guard)", async () => {
  const calls: Array<{ teacherId: string; classId: string }> = [];
  const deps = {
    assertTeacherAssignedToClass: async (teacherId: string, classId: string) => {
      calls.push({ teacherId, classId });
      throw new Error(
        "Только преподаватель, назначенный в этот класс, может выполнять действие.",
      );
    },
  };

  await assert.rejects(
    getAuthorizedTeacherConversationReadModel(
      {
        teacherId: "teacher-not-in-class",
        classId: "class-belonging-to-someone-else",
        studentId: "student-1",
        filter: "all",
      },
      deps,
    ),
    /назначенный в этот класс/,
  );

  // Authorization must run for the requested class, and must fail *before*
  // any conversation data is fetched.
  assert.deepEqual(calls, [
    { teacherId: "teacher-not-in-class", classId: "class-belonging-to-someone-else" },
  ]);
});

test("parent communication projection aggregates messages across ALL of a child's classes (regression: not just the first)", async () => {
  const reads: Array<{ classId: string; studentId: string }> = [];
  const projection = await getParentCommunicationProjection(
    { userId: "parent-user-1" },
    {
      loadParentLearningContexts: async () => [
        {
          studentId: "child-1",
          studentName: "Света Иванова",
          // child enrolled in TWO classes
          classes: [{ classId: "class-a" }, { classId: "class-b" }],
        },
        {
          studentId: "child-2",
          studentName: "Пётр Иванов",
          classes: [{ classId: "class-c" }],
        },
      ],
      readConversation: async ({ classId, studentId }) => {
        reads.push({ classId, studentId });
        const byClass: Record<string, GroupStudentMessage[]> = {
          "class-a": [buildMessage("a1", "из класса А", "2026-04-07T00:02:00Z")],
          "class-b": [buildMessage("b1", "из класса Б", "2026-04-07T00:01:00Z")],
          "class-c": [buildMessage("c1", "из класса В", "2026-04-07T00:00:00Z")],
        };
        return { messages: byClass[classId] ?? [] };
      },
    },
  );

  // Both classes of the multi-class child were read — not only classes[0].
  assert.deepEqual(
    reads
      .filter((r) => r.studentId === "child-1")
      .map((r) => r.classId)
      .sort(),
    ["class-a", "class-b"],
  );

  // Messages are merged from BOTH classes and re-sorted chronologically by
  // createdAt (class-b's message is earlier than class-a's).
  const child1 = projection.find((p) => p.studentId === "child-1");
  assert.deepEqual(
    child1?.messages.map((m) => m.id),
    ["b1", "a1"],
  );

  // Other children are still projected one row each, untouched.
  const child2 = projection.find((p) => p.studentId === "child-2");
  assert.deepEqual(
    child2?.messages.map((m) => m.id),
    ["c1"],
  );
  assert.equal(projection.length, 2);
});

test("parent communication projection yields empty messages for a child with no classes", async () => {
  let readCount = 0;
  const projection = await getParentCommunicationProjection(
    { userId: "parent-user-2" },
    {
      loadParentLearningContexts: async () => [
        { studentId: "child-x", studentName: "Без группы", classes: [] },
      ],
      readConversation: async () => {
        readCount += 1;
        return { messages: [] };
      },
    },
  );

  assert.deepEqual(projection, [
    { studentId: "child-x", studentName: "Без группы", messages: [] },
  ]);
  assert.equal(readCount, 0);
});
