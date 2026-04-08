import assert from "node:assert/strict";
import test from "node:test";
import {
  buildEventLaneLayout,
  getMonthMatrix,
  getRangeByView,
  getVisibleHourRange,
  getWeekDays,
} from "../teacher-schedule-utils";

const events = [
  {
    id: "a",
    startsAt: "2026-04-08T09:00:00Z",
    endsAt: "2026-04-08T10:00:00Z",
    isoDate: "2026-04-08",
  },
  {
    id: "b",
    startsAt: "2026-04-08T09:30:00Z",
    endsAt: "2026-04-08T10:30:00Z",
    isoDate: "2026-04-08",
  },
  {
    id: "c",
    startsAt: "2026-04-08T11:00:00Z",
    endsAt: "2026-04-08T11:30:00Z",
    isoDate: "2026-04-08",
  },
] as never;

test("visible hour range adds buffers and clamps", () => {
  const range = getVisibleHourRange(events);
  assert.deepEqual(range, { startHour: 8, endHour: 13 });
});

test("overlap lanes split concurrent lessons", () => {
  const lanes = buildEventLaneLayout(events);
  const laneA = lanes.find((item) => item.id === "a");
  const laneB = lanes.find((item) => item.id === "b");
  const laneC = lanes.find((item) => item.id === "c");

  assert.equal(laneA?.laneCount, 2);
  assert.equal(laneB?.laneCount, 2);
  assert.equal(laneA?.laneIndex, 0);
  assert.equal(laneB?.laneIndex, 1);
  assert.equal(laneC?.laneCount, 1);
});

test("day/week/month ranges derive correctly", () => {
  assert.deepEqual(getRangeByView("day", "2026-04-08"), {
    startIso: "2026-04-08",
    endIsoExclusive: "2026-04-09",
  });
  assert.deepEqual(getRangeByView("week", "2026-04-08"), {
    startIso: "2026-04-06",
    endIsoExclusive: "2026-04-13",
  });
  assert.deepEqual(getRangeByView("month", "2026-04-08"), {
    startIso: "2026-04-01",
    endIsoExclusive: "2026-05-01",
  });
});

test("week and month matrix return usable calendar structures", () => {
  const weekDays = getWeekDays("2026-04-08");
  assert.equal(weekDays[0], "2026-04-06");
  assert.equal(weekDays[6], "2026-04-12");

  const monthMatrix = getMonthMatrix("2026-04-08");
  assert.equal(monthMatrix.weeks.length, 6);
  assert.equal(monthMatrix.weeks[0]?.[0], "2026-03-30");
});
