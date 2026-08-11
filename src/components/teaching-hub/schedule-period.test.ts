import assert from "node:assert/strict";
import test from "node:test";
import {
  addLocalDays,
  atLocalNoon,
  formatLocalDateValue,
  formatScheduleMonthTitle,
  formatSchedulePeriodAriaLabel,
  formatSchedulePeriodLabel,
  parseLocalDateValue,
  schedulePeriodRange,
  shiftSchedulePeriod,
  startOfLocalWeek,
} from "./schedule-period";

function localParts(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value;
  return [date.getFullYear(), date.getMonth(), date.getDate()];
}

test("schedule day uses exact local midnight boundaries", () => {
  const range = schedulePeriodRange(new Date(2026, 7, 12, 18), "day");
  assert.deepEqual(localParts(range.from), [2026, 7, 12]);
  assert.deepEqual(localParts(range.to), [2026, 7, 13]);
});

test("schedule week starts on Monday and ends on the next Monday", () => {
  const range = schedulePeriodRange(new Date(2026, 7, 12, 12), "week");
  assert.deepEqual(localParts(range.from), [2026, 7, 10]);
  assert.deepEqual(localParts(range.to), [2026, 7, 17]);
  assert.deepEqual(
    localParts(startOfLocalWeek(new Date(2026, 7, 16))),
    [2026, 7, 10],
  );
});

test("schedule month uses exact local calendar boundaries", () => {
  const range = schedulePeriodRange(new Date(2026, 7, 31, 12), "month");
  assert.deepEqual(localParts(range.from), [2026, 7, 1]);
  assert.deepEqual(localParts(range.to), [2026, 8, 1]);
});

test("schedule navigation moves by the active day, week or month", () => {
  const anchor = new Date(2026, 0, 31, 12);
  const previousDay = shiftSchedulePeriod(anchor, "day", -1);
  const previousWeek = shiftSchedulePeriod(anchor, "week", -1);
  const nextMonth = shiftSchedulePeriod(anchor, "month", 1);

  assert.deepEqual(localParts(previousDay), [2026, 0, 30]);
  assert.deepEqual(localParts(previousWeek), [2026, 0, 24]);
  assert.deepEqual(localParts(nextMonth), [2026, 1, 28]);
  assert.equal(previousDay.getHours(), 12);
  assert.equal(previousWeek.getHours(), 12);
  assert.equal(nextMonth.getHours(), 12);
});

test("period labels adapt to a day, week and month without repeating time", () => {
  const today = new Date(2026, 7, 11, 9);

  assert.equal(
    formatSchedulePeriodLabel(new Date(2026, 7, 11, 12), "day", today),
    "Сегодня · 11 авг",
  );
  assert.equal(
    formatSchedulePeriodLabel(new Date(2026, 7, 12, 12), "day", today),
    "Среда · 12 авг",
  );
  assert.equal(
    formatSchedulePeriodLabel(new Date(2027, 7, 12, 12), "day", today),
    "12 авг 2027 г.",
  );
  assert.equal(
    formatSchedulePeriodLabel(new Date(2026, 7, 12, 12), "week", today),
    "Неделя · 10–16 авг",
  );
  assert.equal(
    formatSchedulePeriodLabel(new Date(2026, 8, 1, 12), "week", today),
    "Неделя · 31 авг–6 сент",
  );
  assert.equal(
    formatSchedulePeriodLabel(new Date(2026, 11, 31, 12), "week", today),
    "Неделя · 28 дек 2026 г.–3 янв 2027 г.",
  );
  assert.equal(
    formatSchedulePeriodLabel(new Date(2026, 7, 12, 12), "month", today),
    "Авг 2026",
  );
  assert.equal(formatScheduleMonthTitle(new Date(2026, 0, 1)), "Январь 2026");
});

test("period aria labels expose complete local dates", () => {
  assert.equal(
    formatSchedulePeriodAriaLabel(new Date(2026, 7, 11, 12), "day"),
    "Вторник, 11 августа 2026 г.",
  );
  assert.equal(
    formatSchedulePeriodAriaLabel(new Date(2026, 7, 11, 12), "week"),
    "Неделя: с 10 августа 2026 г. по 16 августа 2026 г.",
  );
  assert.equal(
    formatSchedulePeriodAriaLabel(new Date(2026, 7, 11, 12), "month"),
    "Август 2026",
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
  assert.equal(formatLocalDateValue(addLocalDays(parsed!, 7)), "2026-08-17");
});
