import type { LessonRun } from "@/modules/lesson-runs/domain";

export type LessonRunState =
  "scheduled" | "attention" | "active" | "completed" | "cancelled";

const dayFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
});

const fullDateFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

const timeFormatter = new Intl.DateTimeFormat("ru-RU", {
  hour: "2-digit",
  minute: "2-digit",
});

function sameLocalDay(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function tomorrowFrom(value: Date) {
  const tomorrow = new Date(
    value.getFullYear(),
    value.getMonth(),
    value.getDate() + 1,
  );
  return tomorrow;
}

export function lessonRunState(
  run: LessonRun,
  now: Date = new Date(),
): LessonRunState {
  if (run.cancelledAt) return "cancelled";
  if (run.endedAt) return "completed";
  if (run.startedAt) return "active";
  return new Date(run.scheduledAt).getTime() <= now.getTime()
    ? "attention"
    : "scheduled";
}

export function lessonRunStateLabel(run: LessonRun, now: Date = new Date()) {
  const state = lessonRunState(run, now);
  if (state === "cancelled") return "Отменён";
  if (state === "completed") return "Проведён";
  if (state === "active") return "Идёт сейчас";
  if (state === "attention") return "Нужно отметить";

  const scheduledAt = new Date(run.scheduledAt);
  const time = timeFormatter.format(scheduledAt);
  if (sameLocalDay(scheduledAt, now)) return `Сегодня, ${time}`;
  if (sameLocalDay(scheduledAt, tomorrowFrom(now))) return `Завтра, ${time}`;
  return `${dayFormatter.format(scheduledAt)}, ${time}`;
}

export function formatRunDateTime(value: string) {
  const date = new Date(value);
  return `${fullDateFormatter.format(date)}, ${timeFormatter.format(date)}`;
}

export function openLessonRun(runs: LessonRun[]) {
  return (
    [...runs]
      .filter((run) => !run.endedAt && !run.cancelledAt)
      .sort(
        (left, right) =>
          new Date(right.scheduledAt).getTime() -
          new Date(left.scheduledAt).getTime(),
      )[0] ?? null
  );
}

export function completedLessonRunCount(runs: LessonRun[]) {
  return runs.filter((run) => Boolean(run.endedAt)).length;
}

export function toLocalDateTimeInput(value: Date | string) {
  const date = typeof value === "string" ? new Date(value) : value;
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export function defaultLessonRunDate(now: Date = new Date()) {
  const date = new Date(now);
  date.setDate(date.getDate() + 1);
  date.setSeconds(0, 0);
  if (date.getMinutes() !== 0) {
    date.setHours(date.getHours() + 1, 0, 0, 0);
  }
  return toLocalDateTimeInput(date);
}

export function localDayRange(value: Date) {
  const from = new Date(value.getFullYear(), value.getMonth(), value.getDate());
  const to = new Date(
    value.getFullYear(),
    value.getMonth(),
    value.getDate() + 1,
  );
  return { from: from.toISOString(), to: to.toISOString() };
}
