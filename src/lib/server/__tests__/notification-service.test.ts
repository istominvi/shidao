import assert from "node:assert/strict";
import test from "node:test";
import {
  createNotificationInput,
  isNotificationUnread,
  toRecipientDedupeKey,
  toHomeworkReviewEventType,
} from "../notification-service";

test("homework review status maps to expected notification event", () => {
  assert.equal(toHomeworkReviewEventType("reviewed"), "homework_reviewed");
  assert.equal(toHomeworkReviewEventType("needs_revision"), "homework_needs_revision");
});

test("read/unread helper maps null read_at to unread state", () => {
  assert.equal(isNotificationUnread(null), true);
  assert.equal(isNotificationUnread("2026-04-21T10:00:00Z"), false);
});

test("notification generation skips actor as recipient", () => {
  const draft = createNotificationInput({
    recipient: { userId: "same-user", role: "teacher", teacherId: "t-1" },
    actorUserId: "same-user",
    actorRole: "teacher",
    eventType: "message_created",
    title: "x",
    href: "/dashboard",
  });
  assert.equal(draft, null);
});

test("dedupe key generation uses role-specific ids and skips missing ids", () => {
  assert.equal(
    toRecipientDedupeKey("homework_assigned:sha-1", {
      role: "student",
      studentId: "student-1",
    }),
    "homework_assigned:sha-1:student:student-1",
  );
  assert.equal(
    toRecipientDedupeKey("homework_assigned:sha-1", {
      role: "parent",
      parentId: "parent-1",
    }),
    "homework_assigned:sha-1:parent:parent-1",
  );
  assert.equal(
    toRecipientDedupeKey("homework_submitted:sha-1", {
      role: "teacher",
      teacherId: "teacher-1",
    }),
    "homework_submitted:sha-1:teacher:teacher-1",
  );
  assert.equal(
    toRecipientDedupeKey("homework_assigned:sha-1", {
      role: "parent",
      parentId: null,
    }),
    null,
  );
});
