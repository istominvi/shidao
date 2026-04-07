import { ROUTES, toGroupRoute, toLessonWorkspaceRoute } from "../auth";
import {
  getMethodologyLessonByIdAdmin,
  listMethodologyLessonsCatalogAdmin,
  listScheduledLessonsForClassesAdmin,
  listStudentsForClassesAdmin,
  listTeacherClassesAdmin,
} from "./lesson-content-repository";

export type TeacherGroupOperationalStatus =
  | "attention"
  | "scheduled"
  | "on_track";

export type TeacherGroupOperationsRow = {
  id: string;
  groupLabel: string;
  studentCount: number;
  methodologyLabel: string | null;
  progressLabel: string;
  progressRatio: number | null;
  nextLessonLabel: string | null;
  nextLessonHref: string | null;
  nextLessonTitle: string | null;
  status: TeacherGroupOperationalStatus;
  statusLabel: string;
  attentionReasons: string[];
  groupHref: string;
  groupLessonsHref: string;
};

export type TeacherDashboardScheduleItem = {
  id: string;
  dateLabel: string;
  timeLabel: string;
  groupLabel: string;
  lessonTitle: string;
  statusLabel: string;
  href: string;
};

export type TeacherDashboardScheduleDay = {
  isoDate: string;
  label: string;
  isToday: boolean;
  lessons: TeacherDashboardScheduleItem[];
};

export type TeacherDashboardAlerts = {
  groupsWithoutStudents: number;
  groupsWithoutMethodology: number;
  groupsWithoutUpcomingLessons: number;
  lessonsToday: number;
  attentionGroups: Array<{ id: string; label: string; reasons: string[]; href: string }>;
};

export type TeacherDashboardOperationsReadModel = {
  actions: Array<{ label: string; href: string; tone: "primary" | "secondary" }>;
  groups: {
    rows: TeacherGroupOperationsRow[];
    filters: {
      search: string;
      methodology: string;
      status: string;
      methodologyOptions: string[];
    };
  };
  schedule: {
    days: TeacherDashboardScheduleDay[];
    totalLessons: number;
    nextLessonLabel: string | null;
  };
  alerts: TeacherDashboardAlerts;
};

export type TeacherGroupsIndexOperationsReadModel = {
  rows: TeacherGroupOperationsRow[];
  filters: {
    search: string;
    methodology: string;
    status: string;
    methodologyOptions: string[];
  };
};

type TeacherDashboardOperationsDeps = {
  listTeacherClasses: typeof listTeacherClassesAdmin;
  listStudentsForClasses: typeof listStudentsForClassesAdmin;
  listScheduledLessonsForClasses: typeof listScheduledLessonsForClassesAdmin;
  getMethodologyLessonById: typeof getMethodologyLessonByIdAdmin;
  listMethodologyLessonsCatalog: typeof listMethodologyLessonsCatalogAdmin;
};

const defaultDeps: TeacherDashboardOperationsDeps = {
  listTeacherClasses: listTeacherClassesAdmin,
  listStudentsForClasses: listStudentsForClassesAdmin,
  listScheduledLessonsForClasses: listScheduledLessonsForClassesAdmin,
  getMethodologyLessonById: getMethodologyLessonByIdAdmin,
  listMethodologyLessonsCatalog: listMethodologyLessonsCatalogAdmin,
};

function clean(value: string | null | undefined) {
  return value?.trim() || "";
}

function formatDate(startsAt: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    weekday: "short",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(startsAt));
}

function formatTime(startsAt: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(new Date(startsAt));
}

function formatDateTime(startsAt: string) {
  return `${formatDate(startsAt)} · ${formatTime(startsAt)}`;
}

function formatStatus(status: string) {
  switch (status) {
    case "planned":
      return "Запланировано";
    case "in_progress":
      return "Идёт занятие";
    case "completed":
      return "Проведено";
    case "cancelled":
      return "Отменено";
    default:
      return "Запланировано";
  }
}

function buildProgressLabel(completed: number, total: number | null) {
  if (!total || total <= 0) {
    return `${completed} проведено`;
  }

  const percent = Math.min(100, Math.round((completed / total) * 100));
  return `${completed}/${total} (${percent}%)`;
}

function normalizeFilter(value: string | null | undefined) {
  return clean(value).toLowerCase();
}

async function buildOperationsSnapshot(
  input: {
    teacherId: string;
    nowIso?: string;
    weekStartsAtIso?: string;
    search?: string;
    methodology?: string;
    status?: string;
  },
  deps: TeacherDashboardOperationsDeps,
) {
  const classes = await deps.listTeacherClasses(input.teacherId);
  const classIds = classes.map((item) => item.id);

  const [studentsByClass, lessons, methodologyCatalog] = await Promise.all([
    deps.listStudentsForClasses(classIds),
    deps.listScheduledLessonsForClasses(classIds),
    deps.listMethodologyLessonsCatalog(),
  ]);

  const methodologyIds = Array.from(
    new Set(lessons.map((lesson) => lesson.methodologyLessonId)),
  );

  const methodologyEntries = await Promise.all(
    methodologyIds.map(async (methodologyLessonId) => {
      const lesson = await deps.getMethodologyLessonById(methodologyLessonId);
      return [
        methodologyLessonId,
        clean(lesson?.methodologyTitle) || null,
      ] as const;
    }),
  );
  const methodologyLabelByLessonId = Object.fromEntries(methodologyEntries);

  const methodologyTotals = methodologyCatalog.reduce<Record<string, number>>(
    (acc, lesson) => {
      const title = clean(lesson.methodologyTitle);
      if (!title) return acc;
      acc[title] = (acc[title] ?? 0) + 1;
      return acc;
    },
    {},
  );

  const now = Date.parse(input.nowIso ?? new Date().toISOString());
  const weekStart = Date.parse(input.weekStartsAtIso ?? input.nowIso ?? new Date().toISOString());
  const weekEnd = weekStart + 7 * 24 * 60 * 60 * 1000;

  const rows: TeacherGroupOperationsRow[] = classes.map((group) => {
    const scopedLessons = lessons
      .filter((lesson) => lesson.runtimeShell.classId === group.id)
      .sort(
        (a, b) =>
          Date.parse(a.runtimeShell.startsAt) - Date.parse(b.runtimeShell.startsAt),
      );

    const upcomingLessons = scopedLessons.filter(
      (lesson) => Date.parse(lesson.runtimeShell.startsAt) >= now,
    );
    const completedLessons = scopedLessons.filter(
      (lesson) => lesson.runtimeShell.runtimeStatus === "completed",
    ).length;

    const nextLesson = upcomingLessons[0] ?? null;
    const referenceLesson = nextLesson ?? scopedLessons.at(-1) ?? null;
    const methodologyLabel = referenceLesson
      ? methodologyLabelByLessonId[referenceLesson.methodologyLessonId]
      : null;

    const knownMethodologyLessonTotal = methodologyLabel
      ? methodologyTotals[methodologyLabel] ?? null
      : null;

    const attentionReasons: string[] = [];
    if ((studentsByClass[group.id]?.length ?? 0) === 0) {
      attentionReasons.push("Нет учеников");
    }
    if (!methodologyLabel) {
      attentionReasons.push("Не определена методология");
    }
    if (!nextLesson) {
      attentionReasons.push("Нет ближайшего занятия");
    }

    const status: TeacherGroupOperationalStatus =
      attentionReasons.length > 0
        ? "attention"
        : upcomingLessons.length > 0
          ? "scheduled"
          : "on_track";

    const statusLabel =
      status === "attention"
        ? "Требует внимания"
        : status === "scheduled"
          ? "По плану"
          : "Стабильно";

    return {
      id: group.id,
      groupLabel: clean(group.name) || "Группа",
      studentCount: studentsByClass[group.id]?.length ?? 0,
      methodologyLabel,
      progressLabel: buildProgressLabel(completedLessons, knownMethodologyLessonTotal),
      progressRatio:
        knownMethodologyLessonTotal && knownMethodologyLessonTotal > 0
          ? Math.min(1, completedLessons / knownMethodologyLessonTotal)
          : null,
      nextLessonLabel: nextLesson ? formatDateTime(nextLesson.runtimeShell.startsAt) : null,
      nextLessonHref: nextLesson ? toLessonWorkspaceRoute(nextLesson.id) : null,
      nextLessonTitle:
        nextLesson && clean(methodologyLabelByLessonId[nextLesson.methodologyLessonId])
          ? clean(methodologyLabelByLessonId[nextLesson.methodologyLessonId])
          : nextLesson
            ? "Занятие"
            : null,
      status,
      statusLabel,
      attentionReasons,
      groupHref: toGroupRoute(group.id),
      groupLessonsHref: `${ROUTES.lessons}?groupId=${encodeURIComponent(group.id)}`,
    };
  });

  const search = normalizeFilter(input.search);
  const methodology = clean(input.methodology);
  const status = normalizeFilter(input.status);

  const filteredRows = rows.filter((row) => {
    if (search && !row.groupLabel.toLowerCase().includes(search)) {
      return false;
    }

    if (methodology && row.methodologyLabel !== methodology) {
      return false;
    }

    if (status && row.status !== status) {
      return false;
    }

    return true;
  });

  const scheduleSource = lessons
    .filter((lesson) => {
      const startsAt = Date.parse(lesson.runtimeShell.startsAt);
      return startsAt >= weekStart && startsAt < weekEnd;
    })
    .sort(
      (a, b) => Date.parse(a.runtimeShell.startsAt) - Date.parse(b.runtimeShell.startsAt),
    );

  const todayIso = new Date(now).toISOString().slice(0, 10);
  const scheduleByDay = new Map<string, TeacherDashboardScheduleItem[]>();

  for (const lesson of scheduleSource) {
    const isoDate = lesson.runtimeShell.startsAt.slice(0, 10);
    const items = scheduleByDay.get(isoDate) ?? [];
    const methodologyLabel = clean(
      methodologyLabelByLessonId[lesson.methodologyLessonId],
    );

    items.push({
      id: lesson.id,
      dateLabel: formatDate(lesson.runtimeShell.startsAt),
      timeLabel: formatTime(lesson.runtimeShell.startsAt),
      groupLabel:
        rows.find((row) => row.id === lesson.runtimeShell.classId)?.groupLabel ||
        "Группа",
      lessonTitle: methodologyLabel || "Занятие",
      statusLabel: formatStatus(lesson.runtimeShell.runtimeStatus),
      href: toLessonWorkspaceRoute(lesson.id),
    });

    scheduleByDay.set(isoDate, items);
  }

  const days: TeacherDashboardScheduleDay[] = Array.from(scheduleByDay.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([isoDate, dayLessons]) => ({
      isoDate,
      label: dayLessons[0]?.dateLabel ?? isoDate,
      isToday: isoDate === todayIso,
      lessons: dayLessons,
    }));

  const lessonsToday = days.find((day) => day.isoDate === todayIso)?.lessons.length ?? 0;

  return {
    rows,
    filteredRows,
    filters: {
      search: clean(input.search),
      methodology,
      status,
      methodologyOptions: Array.from(
        new Set(rows.map((row) => row.methodologyLabel).filter((value): value is string => Boolean(value))),
      ).sort((a, b) => a.localeCompare(b, "ru-RU")),
    },
    schedule: {
      days,
      totalLessons: scheduleSource.length,
      nextLessonLabel: scheduleSource[0]
        ? `${formatDate(scheduleSource[0].runtimeShell.startsAt)} · ${formatTime(scheduleSource[0].runtimeShell.startsAt)}`
        : null,
    },
    alerts: {
      groupsWithoutStudents: rows.filter((row) => row.studentCount === 0).length,
      groupsWithoutMethodology: rows.filter((row) => !row.methodologyLabel).length,
      groupsWithoutUpcomingLessons: rows.filter((row) => !row.nextLessonHref).length,
      lessonsToday,
      attentionGroups: rows
        .filter((row) => row.attentionReasons.length > 0)
        .map((row) => ({
          id: row.id,
          label: row.groupLabel,
          reasons: row.attentionReasons,
          href: row.groupHref,
        })),
    },
  };
}

export async function getTeacherDashboardOperationsReadModel(
  input: {
    teacherId: string;
    nowIso?: string;
    weekStartsAtIso?: string;
    search?: string;
    methodology?: string;
    status?: string;
  },
  deps: TeacherDashboardOperationsDeps = defaultDeps,
): Promise<TeacherDashboardOperationsReadModel> {
  const snapshot = await buildOperationsSnapshot(input, deps);

  return {
    actions: [
      { label: "Добавить группу", href: ROUTES.groupsNew, tone: "primary" },
      { label: "Добавить ученика", href: ROUTES.studentsNew, tone: "primary" },
      { label: "Открыть группы", href: ROUTES.groups, tone: "secondary" },
      { label: "Открыть занятия", href: ROUTES.lessons, tone: "secondary" },
    ],
    groups: {
      rows: snapshot.filteredRows
        .sort((a, b) => a.groupLabel.localeCompare(b.groupLabel, "ru-RU")),
      filters: snapshot.filters,
    },
    schedule: snapshot.schedule,
    alerts: snapshot.alerts,
  };
}

export async function getTeacherGroupsIndexOperationsReadModel(
  input: {
    teacherId: string;
    search?: string;
    methodology?: string;
    status?: string;
    nowIso?: string;
  },
  deps: TeacherDashboardOperationsDeps = defaultDeps,
): Promise<TeacherGroupsIndexOperationsReadModel> {
  const snapshot = await buildOperationsSnapshot(input, deps);

  return {
    rows: snapshot.filteredRows
      .sort((a, b) => a.groupLabel.localeCompare(b.groupLabel, "ru-RU")),
    filters: snapshot.filters,
  };
}
