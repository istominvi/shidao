export type SchedulePeriod = "week" | "month";

export function atLocalNoon(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate(), 12);
}

function startOfLocalWeek(value: Date) {
  const day = value.getDay() || 7;
  return new Date(
    value.getFullYear(),
    value.getMonth(),
    value.getDate() - day + 1,
  );
}

export function schedulePeriodRange(value: Date, period: SchedulePeriod) {
  const from =
    period === "week"
      ? startOfLocalWeek(value)
      : new Date(value.getFullYear(), value.getMonth(), 1);
  const to =
    period === "week"
      ? new Date(from.getFullYear(), from.getMonth(), from.getDate() + 7)
      : new Date(from.getFullYear(), from.getMonth() + 1, 1);

  return { from: from.toISOString(), to: to.toISOString() };
}

export function shiftSchedulePeriod(
  value: Date,
  period: SchedulePeriod,
  direction: -1 | 1,
) {
  if (period === "week") {
    return new Date(
      value.getFullYear(),
      value.getMonth(),
      value.getDate() + direction * 7,
      12,
    );
  }

  const day = value.getDate();
  const targetMonthStart = new Date(
    value.getFullYear(),
    value.getMonth() + direction,
    1,
    12,
  );
  const targetMonthEnd = new Date(
    targetMonthStart.getFullYear(),
    targetMonthStart.getMonth() + 1,
    0,
    12,
  );
  targetMonthStart.setDate(Math.min(day, targetMonthEnd.getDate()));
  return targetMonthStart;
}

export function formatLocalDateValue(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseLocalDateValue(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  const parsed = new Date(year, month - 1, day, 12);
  return parsed.getFullYear() === year &&
    parsed.getMonth() === month - 1 &&
    parsed.getDate() === day
    ? parsed
    : null;
}
