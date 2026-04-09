import assert from "node:assert/strict";
import test from "node:test";
import { findDefaultCenteredEventIndex } from "./teacher-schedule-helpers";

test("centers in-progress event first", () => {
  const index = findDefaultCenteredEventIndex(
    [
      { id: "past", startsAt: "2026-04-09T08:00:00Z", endsAt: "2026-04-09T08:45:00Z" },
      { id: "current", startsAt: "2026-04-09T09:00:00Z", endsAt: "2026-04-09T09:45:00Z" },
      { id: "future", startsAt: "2026-04-09T10:00:00Z", endsAt: "2026-04-09T10:45:00Z" },
    ],
    "2026-04-09T09:20:00Z",
  );

  assert.equal(index, 1);
});

test("centers nearest upcoming when nothing in progress", () => {
  const index = findDefaultCenteredEventIndex(
    [
      { id: "past", startsAt: "2026-04-09T07:00:00Z", endsAt: "2026-04-09T07:45:00Z" },
      { id: "next", startsAt: "2026-04-09T11:00:00Z", endsAt: "2026-04-09T11:45:00Z" },
      { id: "later", startsAt: "2026-04-09T12:00:00Z", endsAt: "2026-04-09T12:45:00Z" },
    ],
    "2026-04-09T10:00:00Z",
  );

  assert.equal(index, 1);
});

test("centers latest past when only past lessons exist", () => {
  const index = findDefaultCenteredEventIndex(
    [
      { id: "old", startsAt: "2026-04-08T07:00:00Z", endsAt: "2026-04-08T07:45:00Z" },
      { id: "latest", startsAt: "2026-04-09T08:00:00Z", endsAt: "2026-04-09T08:45:00Z" },
    ],
    "2026-04-09T10:00:00Z",
  );

  assert.equal(index, 1);
});
