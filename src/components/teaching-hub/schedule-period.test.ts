import assert from "node:assert/strict";
import test from "node:test";
import {
  atLocalNoon,
  formatLocalDateValue,
  parseLocalDateValue,
  schedulePeriodRange,
  shiftSchedulePeriod,
} from "./schedule-period";

function localParts(value: string) {
  const date = new Date(value);
  return [date.getFullYear(), date.getMonth(), date.getDate()];
}

test("schedule week starts on Monday and ends on the next Monday", () => {
  const range = schedulePeriodRange(new Date(2026, 7, 12, 12), "week");
  assert.deepEqual(localParts(range.from), [2026, 7, 10]);
  assert.deepEqual(localParts(range.to), [2026, 7, 17]);
});

test("schedule month uses exact local calendar boundaries", () => {
  const range = schedulePeriodRange(new Date(2026, 7, 31, 12), "month");
  assert.deepEqual(localParts(range.from), [2026, 7, 1]);
  assert.deepEqual(localParts(range.to), [2026, 8, 1]);
});

test("schedule navigation moves by a week or clamps the day in a month", () => {
  const anchor = new Date(2026, 0, 31, 12);
  const previousWeek = shiftSchedulePeriod(anchor, "week", -1);
  const nextMonth = shiftSchedulePeriod(anchor, "month", 1);

  assert.deepEqual(
    [
      previousWeek.getFullYear(),
      previousWeek.getMonth(),
      previousWeek.getDate(),
    ],
    [2026, 0, 24],
  );
  assert.deepEqual(
    [nextMonth.getFullYear(), nextMonth.getMonth(), nextMonth.getDate()],
    [2026, 1, 28],
  );
});

test("native date values round-trip as a local noon date", () => {
  const formatted = formatLocalDateValue(new Date(2026, 7, 10, 19));
  const parsed = parseLocalDateValue(formatted);

  assert.equal(formatted, "2026-08-10");
  assert.ok(parsed);
  assert.equal(parsed?.getHours(), 12);
  assert.equal(formatLocalDateValue(parsed!), formatted);
  assert.equal(parseLocalDateValue("2026-02-31"), null);
  assert.equal(parseLocalDateValue("2026-08-10-extra"), null);
  assert.equal(
    formatLocalDateValue(atLocalNoon(new Date(2026, 7, 10, 1))),
    formatted,
  );
});
