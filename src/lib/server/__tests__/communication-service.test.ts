import assert from "node:assert/strict";
import test from "node:test";
import { filterConversationMessages } from "../communication-service";
import type { GroupStudentMessage } from "../communication-repository";

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
