import assert from "node:assert/strict";
import test from "node:test";
import {
  createNotificationInput,
  isNotificationUnread,
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
