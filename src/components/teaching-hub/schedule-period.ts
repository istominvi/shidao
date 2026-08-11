export type SchedulePeriod = "day" | "week" | "month";

const shortDateFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
});

const shortDateWithYearFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

const weekdayFormatter = new Intl.DateTimeFormat("ru-RU", {
  weekday: "long",
});

const fullDateFormatter = new Intl.DateTimeFormat("ru-RU", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

const monthFormatter = new Intl.DateTimeFormat("ru-RU", {
  month: "long",
  year: "numeric",
});

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function sameLocalDay(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

export function atLocalNoon(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate(), 12);
}

export function addLocalDays(value: Date, amount: number) {
  return new Date(
    value.getFullYear(),
    value.getMonth(),
    value.getDate() + amount,
    12,
  );
}

export function startOfLocalWeek(value: Date) {
  const day = value.getDay() || 7;
  return new Date(
    value.getFullYear(),
    value.getMonth(),
    value.getDate() - day + 1,
  );
}

export function schedulePeriodLocalRange(value: Date, period: SchedulePeriod) {
  const from =
    period === "day"
      ? new Date(value.getFullYear(), value.getMonth(), value.getDate())
      : period === "week"
        ? startOfLocalWeek(value)
        : new Date(value.getFullYear(), value.getMonth(), 1);
  const to =
    period === "day"
      ? new Date(from.getFullYear(), from.getMonth(), from.getDate() + 1)
      : period === "week"
        ? new Date(from.getFullYear(), from.getMonth(), from.getDate() + 7)
        : new Date(from.getFullYear(), from.getMonth() + 1, 1);

  return { from, to };
}

export function schedulePeriodRange(value: Date, period: SchedulePeriod) {
  const range = schedulePeriodLocalRange(value, period);
  return { from: range.from.toISOString(), to: range.to.toISOString() };
}

export function shiftSchedulePeriod(
  value: Date,
  period: SchedulePeriod,
  direction: -1 | 1,
) {
  if (period === "day") return addLocalDays(value, direction);
  if (period === "week") return addLocalDays(value, direction * 7);

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

export function formatScheduleMonthTitle(value: Date) {
  return capitalize(monthFormatter.format(value).replace(" г.", ""));
}

export function formatSchedulePeriodLabel(
  value: Date,
  period: SchedulePeriod,
  today: Date = new Date(),
) {
  if (period === "day") {
    if (sameLocalDay(value, today)) {
      return `Сегодня · ${shortDateFormatter.format(value)}`;
    }
    if (value.getFullYear() !== today.getFullYear()) {
      return capitalize(shortDateWithYearFormatter.format(value));
    }
    return `${capitalize(weekdayFormatter.format(value))} · ${shortDateFormatter.format(value)}`;
  }

  if (period === "month") return formatScheduleMonthTitle(value);

  const range = schedulePeriodLocalRange(value, "week");
  const lastDay = addLocalDays(range.to, -1);
  if (
    range.from.getFullYear() === lastDay.getFullYear() &&
    range.from.getMonth() === lastDay.getMonth()
  ) {
    return `Неделя · ${range.from.getDate()}–${shortDateFormatter.format(lastDay)}`;
  }
  if (range.from.getFullYear() === lastDay.getFullYear()) {
    return `Неделя · ${shortDateFormatter.format(range.from)} — ${shortDateFormatter.format(lastDay)}`;
  }
  return `Неделя · ${shortDateWithYearFormatter.format(range.from)} — ${shortDateWithYearFormatter.format(lastDay)}`;
}

export function formatSchedulePeriodAriaLabel(
  value: Date,
  period: SchedulePeriod,
) {
  if (period === "day") return capitalize(fullDateFormatter.format(value));
  if (period === "month") return formatScheduleMonthTitle(value);

  const range = schedulePeriodLocalRange(value, "week");
  const lastDay = addLocalDays(range.to, -1);
  return `Неделя: с ${shortDateWithYearFormatter.format(range.from)} по ${shortDateWithYearFormatter.format(lastDay)}`;
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
