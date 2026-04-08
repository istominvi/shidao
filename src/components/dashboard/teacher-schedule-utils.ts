import type { TeacherDashboardScheduleEvent } from "@/lib/server/teacher-dashboard-operations";

export type ScheduleViewMode = "day" | "week" | "month";

export type HourRange = {
  startHour: number;
  endHour: number;
};

const MIN_HOUR = 6;
const MAX_HOUR = 22;
const DAY_MS = 24 * 60 * 60 * 1000;

export function startOfUtcDay(isoDate: string) {
  return Date.parse(`${isoDate}T00:00:00Z`);
}

export function toIsoDate(timestamp: number) {
  return new Date(timestamp).toISOString().slice(0, 10);
}

export function addUtcDays(isoDate: string, days: number) {
  return toIsoDate(startOfUtcDay(isoDate) + days * DAY_MS);
}

export function getWeekStartIso(isoDate: string) {
  const dayDate = new Date(`${isoDate}T00:00:00Z`);
  const weekDay = dayDate.getUTCDay();
  const mondayOffset = (weekDay + 6) % 7;
  return addUtcDays(isoDate, -mondayOffset);
}

export function getWeekDays(isoDate: string) {
  const weekStart = getWeekStartIso(isoDate);
  return Array.from({ length: 7 }, (_, index) => addUtcDays(weekStart, index));
}

export function getMonthMatrix(activeIsoDate: string) {
  const date = new Date(`${activeIsoDate}T00:00:00Z`);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const monthStartIso = new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10);
  const firstCellIso = getWeekStartIso(monthStartIso);

  const weeks: string[][] = [];
  let cursorIso = firstCellIso;
  for (let week = 0; week < 6; week += 1) {
    const row: string[] = [];
    for (let day = 0; day < 7; day += 1) {
      row.push(cursorIso);
      cursorIso = addUtcDays(cursorIso, 1);
    }
    weeks.push(row);
  }

  return { weeks, month, year };
}

export function getRangeByView(viewMode: ScheduleViewMode, activeIsoDate: string) {
  if (viewMode === "day") {
    return { startIso: activeIsoDate, endIsoExclusive: addUtcDays(activeIsoDate, 1) };
  }

  if (viewMode === "week") {
    const weekStart = getWeekStartIso(activeIsoDate);
    return { startIso: weekStart, endIsoExclusive: addUtcDays(weekStart, 7) };
  }

  const date = new Date(`${activeIsoDate}T00:00:00Z`);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const monthStart = new Date(Date.UTC(year, month, 1));
  const nextMonthStart = new Date(Date.UTC(year, month + 1, 1));

  return {
    startIso: monthStart.toISOString().slice(0, 10),
    endIsoExclusive: nextMonthStart.toISOString().slice(0, 10),
  };
}

export function getVisibleHourRange(events: TeacherDashboardScheduleEvent[]): HourRange {
  if (events.length === 0) {
    return { startHour: 8, endHour: 20 };
  }

  let minMinutes = Number.POSITIVE_INFINITY;
  let maxMinutes = 0;

  for (const event of events) {
    const start = new Date(event.startsAt);
    const end = new Date(event.endsAt);
    const startMinutes = start.getUTCHours() * 60 + start.getUTCMinutes();
    const endMinutes = end.getUTCHours() * 60 + end.getUTCMinutes();
    minMinutes = Math.min(minMinutes, startMinutes);
    maxMinutes = Math.max(maxMinutes, endMinutes);
  }

  const bufferedStart = Math.max(MIN_HOUR, Math.floor((minMinutes - 60) / 60));
  const bufferedEnd = Math.min(MAX_HOUR, Math.ceil((maxMinutes + 60) / 60));

  return {
    startHour: Math.min(bufferedStart, bufferedEnd - 1),
    endHour: Math.max(bufferedEnd, bufferedStart + 1),
  };
}

export type EventLaneLayout = {
  id: string;
  laneIndex: number;
  laneCount: number;
};

export function buildEventLaneLayout(events: TeacherDashboardScheduleEvent[]): EventLaneLayout[] {
  const sorted = [...events].sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
  const lanesEndAt: number[] = [];
  const result: Array<{ id: string; laneIndex: number; cluster: number }> = [];
  let clusterId = 0;
  let clusterMaxLanes = 0;
  const clusterLaneCounts = new Map<number, number>();

  for (const event of sorted) {
    const startsAt = Date.parse(event.startsAt);
    const endedBeforeStart = lanesEndAt.every((laneEnd) => laneEnd <= startsAt);
    if (endedBeforeStart && result.length > 0) {
      clusterLaneCounts.set(clusterId, clusterMaxLanes);
      clusterId += 1;
      clusterMaxLanes = 0;
      lanesEndAt.length = 0;
    }

    let laneIndex = lanesEndAt.findIndex((laneEnd) => laneEnd <= startsAt);
    if (laneIndex < 0) {
      laneIndex = lanesEndAt.length;
      lanesEndAt.push(0);
    }

    lanesEndAt[laneIndex] = Date.parse(event.endsAt);
    clusterMaxLanes = Math.max(clusterMaxLanes, lanesEndAt.length);
    result.push({ id: event.id, laneIndex, cluster: clusterId });
  }

  clusterLaneCounts.set(clusterId, Math.max(clusterMaxLanes, 1));

  return result.map((item) => ({
    id: item.id,
    laneIndex: item.laneIndex,
    laneCount: clusterLaneCounts.get(item.cluster) ?? 1,
  }));
}
