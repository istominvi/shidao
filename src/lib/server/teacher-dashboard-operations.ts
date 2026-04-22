import { ROUTES, toGroupRoute, toLessonWorkspaceRoute } from "../auth";
import { buildLessonConnectionInfo, type LessonConnectionInfo } from "../lesson-connection";
import {
  listScheduledLessonsForClassesAdmin,
  listStudentsForClassesAdmin,
  listTeacherClassesAdmin,
  listMethodologyLessonsByMethodologyAdmin,
} from "./lesson-content-repository";

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
  groupHref: string;
  groupLessonsHref: string;
};

export type TeacherDashboardScheduleEvent = {
  id: string;
  href: string;
  startsAt: string;
  endsAt: string;
  durationMinutes: number;
  isoDate: string;
  groupLabel: string;
  lessonTitle: string;
  status: string;
  statusLabel: string;
  format: "online" | "offline";
  formatLabel: string;
  connection: LessonConnectionInfo;
  timeLabel: string;
  timeRangeLabel: string;
};

export type TeacherDashboardOperationsReadModel = {
  actions: Array<{ label: string; href: string; tone: "primary" | "secondary" }>;
  groups: {
    rows: TeacherGroupOperationsRow[];
    filters: {
      search: string;
      methodology: string;
      methodologyOptions: string[];
    };
  };
  schedule: {
    events: TeacherDashboardScheduleEvent[];
    nowIso: string;
    defaultDateIso: string;
    totalLessons: number;
    nextLessonLabel: string | null;
  };
};

export type TeacherGroupsIndexOperationsReadModel = {
  actions: Array<{ label: string; href: string; tone: "primary" | "secondary" }>;
  rows: TeacherGroupOperationsRow[];
  filters: {
    search: string;
    methodology: string;
    methodologyOptions: string[];
  };
};

type TeacherDashboardOperationsDeps = {
  listTeacherClasses: typeof listTeacherClassesAdmin;
  listStudentsForClasses: typeof listStudentsForClassesAdmin;
  listScheduledLessonsForClasses: typeof listScheduledLessonsForClassesAdmin;
  listMethodologyLessonsByMethodology: typeof listMethodologyLessonsByMethodologyAdmin;
};

const defaultDeps: TeacherDashboardOperationsDeps = {
  listTeacherClasses: listTeacherClassesAdmin,
  listStudentsForClasses: listStudentsForClassesAdmin,
  listScheduledLessonsForClasses: listScheduledLessonsForClassesAdmin,
  listMethodologyLessonsByMethodology: listMethodologyLessonsByMethodologyAdmin,
};

const SCHEDULE_DURATION_FALLBACK_MINUTES = 45;

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

function formatTimeRange(startsAtIso: string, endsAtIso: string) {
  return `${formatTime(startsAtIso)}–${formatTime(endsAtIso)}`;
}

function addMinutes(iso: string, minutes: number) {
  return new Date(Date.parse(iso) + minutes * 60 * 1000).toISOString();
}

async function buildOperationsSnapshot(
  input: {
    teacherId: string;
    activeSchoolId?: string;
    nowIso?: string;
    weekStartsAtIso?: string;
    search?: string;
    methodology?: string;
  },
  deps: TeacherDashboardOperationsDeps,
) {
  const classes = await deps.listTeacherClasses(input.teacherId);
  const scopedClasses = input.activeSchoolId
    ? classes.filter((item) => item.schoolId === input.activeSchoolId)
    : classes;
  const classIds = scopedClasses.map((item) => item.id);

  const [studentsByClass, lessons] = await Promise.all([
    deps.listStudentsForClasses(classIds),
    deps.listScheduledLessonsForClasses(classIds),
  ]);

  const methodologyLessonEntries = await Promise.all(
    Array.from(
      new Set(
        scopedClasses
          .map((item) => item.methodologyId)
          .filter((item): item is string => Boolean(item)),
      ),
    ).map(async (methodologyId) => [
      methodologyId,
      await deps.listMethodologyLessonsByMethodology(methodologyId),
    ] as const),
  );

  const methodologyLessonTotalsByMethodologyId = Object.fromEntries(
    methodologyLessonEntries.map(([methodologyId, methodologyLessons]) => [
      methodologyId,
      methodologyLessons.length,
    ]),
  );

  const methodologyLessonMetaById = Object.fromEntries(
    methodologyLessonEntries.flatMap(([, methodologyLessons]) =>
      methodologyLessons.map((methodologyLesson) => [
        methodologyLesson.id,
        {
          title: clean(methodologyLesson.shell.title) || null,
          methodologyTitle: clean(methodologyLesson.methodologyTitle) || null,
          durationMinutes: methodologyLesson.shell.estimatedDurationMinutes,
        },
      ]),
    ),
  ) as Record<string, { title: string | null; methodologyTitle: string | null; durationMinutes: number }>;

  const nowIso = input.nowIso ?? new Date().toISOString();
  const now = Date.parse(nowIso);

  const rows: TeacherGroupOperationsRow[] = scopedClasses.map((group) => {
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
    const methodologyLabel = clean(group.methodologyTitle) || null;
    const knownMethodologyLessonTotal = group.methodologyId
      ? methodologyLessonTotalsByMethodologyId[group.methodologyId] ?? 0
      : null;

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
      nextLessonTitle: nextLesson
        ? methodologyLessonMetaById[nextLesson.methodologyLessonId]?.title || "Занятие"
        : null,
      groupHref: toGroupRoute(group.id),
      groupLessonsHref: `${ROUTES.lessons}?groupId=${encodeURIComponent(group.id)}`,
    };
  });

  const search = normalizeFilter(input.search);
  const methodology = clean(input.methodology);

  const filteredRows = rows.filter((row) => {
    if (search && !row.groupLabel.toLowerCase().includes(search)) {
      return false;
    }

    if (methodology && row.methodologyLabel !== methodology) {
      return false;
    }

    return true;
  });

  const groupLabelByClassId = Object.fromEntries(rows.map((row) => [row.id, row.groupLabel]));

  const scheduleEvents = lessons
    .slice()
    .sort((a, b) => Date.parse(a.runtimeShell.startsAt) - Date.parse(b.runtimeShell.startsAt))
    .map((lesson): TeacherDashboardScheduleEvent => {
      const startsAt = lesson.runtimeShell.startsAt;
      const meta = methodologyLessonMetaById[lesson.methodologyLessonId];
      const durationMinutes = meta?.durationMinutes || SCHEDULE_DURATION_FALLBACK_MINUTES;
      const endsAt = addMinutes(startsAt, durationMinutes);
      const lessonTitle = meta?.title || meta?.methodologyTitle || "Занятие";

      return {
        id: lesson.id,
        href: toLessonWorkspaceRoute(lesson.id),
        startsAt,
        endsAt,
        durationMinutes,
        isoDate: startsAt.slice(0, 10),
        groupLabel: groupLabelByClassId[lesson.runtimeShell.classId] || "Группа",
        lessonTitle,
        status: lesson.runtimeShell.runtimeStatus,
        statusLabel: formatStatus(lesson.runtimeShell.runtimeStatus),
        format: lesson.runtimeShell.format,
        formatLabel: lesson.runtimeShell.format === "online" ? "Онлайн" : "Офлайн",
        connection: buildLessonConnectionInfo(lesson.runtimeShell, {
          onlineCtaLabel: "Открыть встречу",
          offlineDisplayPrefix: "Место: ",
        }),
        timeLabel: formatTime(startsAt),
        timeRangeLabel: formatTimeRange(startsAt, endsAt),
      };
    });

  const defaultDateIso = nowIso.slice(0, 10);
  const nextLesson = scheduleEvents.find((event) => Date.parse(event.startsAt) >= now) ?? null;

  return {
    rows,
    filteredRows,
    filters: {
      search: clean(input.search),
      methodology,
      methodologyOptions: Array.from(
        new Set(rows.map((row) => row.methodologyLabel).filter((value): value is string => Boolean(value))),
      ).sort((a, b) => a.localeCompare(b, "ru-RU")),
    },
    schedule: {
      events: scheduleEvents,
      nowIso,
      defaultDateIso,
      totalLessons: scheduleEvents.length,
      nextLessonLabel: nextLesson ? `${formatDate(nextLesson.startsAt)} · ${formatTime(nextLesson.startsAt)}` : null,
    },
  };
}

function buildTeacherGroupActions() {
  return [
    { label: "Добавить группу", href: `${ROUTES.groups}?create=1`, tone: "secondary" as const },
  ];
}

export async function getTeacherDashboardOperationsReadModel(
  input: {
    teacherId: string;
    activeSchoolId?: string;
    nowIso?: string;
    weekStartsAtIso?: string;
    search?: string;
    methodology?: string;
  },
  deps: TeacherDashboardOperationsDeps = defaultDeps,
): Promise<TeacherDashboardOperationsReadModel> {
  const snapshot = await buildOperationsSnapshot(input, deps);

  return {
    actions: buildTeacherGroupActions(),
    groups: {
      rows: snapshot.filteredRows
        .sort((a, b) => a.groupLabel.localeCompare(b.groupLabel, "ru-RU")),
      filters: snapshot.filters,
    },
    schedule: snapshot.schedule,
  };
}

export async function getTeacherGroupsIndexOperationsReadModel(
  input: {
    teacherId: string;
    activeSchoolId?: string;
    search?: string;
    methodology?: string;
    nowIso?: string;
  },
  deps: TeacherDashboardOperationsDeps = defaultDeps,
): Promise<TeacherGroupsIndexOperationsReadModel> {
  const snapshot = await buildOperationsSnapshot(input, deps);

  return {
    actions: buildTeacherGroupActions(),
    rows: snapshot.filteredRows
      .sort((a, b) => a.groupLabel.localeCompare(b.groupLabel, "ru-RU")),
    filters: snapshot.filters,
  };
}
