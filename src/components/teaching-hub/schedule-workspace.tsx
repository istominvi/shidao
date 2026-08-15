"use client";

import {
  CalendarPlus,
  CalendarDays,
  CircleAlert,
  CircleCheck,
  Clock3,
  LayoutGrid,
  LoaderCircle,
  MoreVertical,
  Pencil,
  Play,
  Table2,
  Users,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppPageHeader } from "@/components/app/page-header";
import { useSystemAssistantPageContext } from "@/components/assistant/system-assistant-provider";
import { PageTransitionLink } from "@/components/navigation/page-transition-link";
import { usePrimaryHeaderSummary } from "@/components/navigation/primary-header-summary-provider";
import {
  cancelLessonRun,
  loadSchedule,
  startLessonRun,
} from "@/components/lesson-runs/lesson-run-client";
import {
  LessonRunDialog,
  type LessonRunMutationRunner,
} from "@/components/lesson-runs/lesson-run-dialog";
import { lessonRunState } from "@/components/lesson-runs/lesson-run-format";
import { RunHistoryList } from "@/components/lesson-runs/run-history-list";
import { ScheduleDatePicker } from "@/components/teaching-hub/schedule-date-picker";
import {
  atLocalNoon,
  formatScheduleCompactDate,
  formatSchedulePeriodLabel,
  formatLocalDateValue,
  schedulePeriodRange,
  type SchedulePeriod,
} from "@/components/teaching-hub/schedule-period";
import { ActionMenu, type ActionMenuItem } from "@/components/ui/action-menu";
import { Button, productButtonClassName } from "@/components/ui/button";
import { DialogShell } from "@/components/ui/dialog-shell";
import {
  ProductTable,
  ProductTableActionCell,
  ProductTableBody,
  ProductTableCell,
  ProductTableHead,
  ProductTableHeaderCell,
  ProductTableHeaderRow,
  ProductTablePrimaryCell,
  ProductTableRow,
  ProductTableSortableHeaderCell,
  nextProductTableSort,
  type ProductTableSortState,
} from "@/components/ui/product-table";
import { SurfaceCard } from "@/components/ui/surface-card";
import { ROUTES, toCourseRoute } from "@/lib/auth";
import type { LessonRun } from "@/modules/lesson-runs/domain";

const tableDateFormatter = new Intl.DateTimeFormat("ru-RU", {
  weekday: "long",
  day: "numeric",
  month: "long",
});

const compactTableDateFormatter = new Intl.DateTimeFormat("ru-RU", {
  weekday: "long",
});

const timeFormatter = new Intl.DateTimeFormat("ru-RU", {
  hour: "2-digit",
  minute: "2-digit",
});

type ScheduleViewMode = "table" | "cards";
type SelectedRunMode = "default" | "edit";
type ScheduleSortKey =
  "date" | "time" | "lesson" | "course" | "participants" | "status";
const SCHEDULE_RESULT_LIMIT = 500;

const scheduleCollator = new Intl.Collator("ru-RU", {
  numeric: true,
  sensitivity: "base",
});

const scheduleStatusOrder: Record<ReturnType<typeof lessonRunState>, number> = {
  active: 0,
  attention: 1,
  scheduled: 2,
  completed: 3,
  cancelled: 4,
};

function localMinutes(value: string) {
  const date = new Date(value);
  return date.getHours() * 60 + date.getMinutes();
}

function compareScheduleRuns(
  left: LessonRun,
  right: LessonRun,
  key: ScheduleSortKey,
) {
  if (key === "date") {
    const dateDifference =
      new Date(left.scheduledAt).getTime() -
      new Date(right.scheduledAt).getTime();
    if (dateDifference !== 0) return dateDifference;
  }
  if (key === "time") {
    const timeDifference =
      localMinutes(left.scheduledAt) - localMinutes(right.scheduledAt);
    if (timeDifference !== 0) return timeDifference;
  } else if (key === "lesson") {
    const lessonDifference = scheduleCollator.compare(
      left.lessonTitle,
      right.lessonTitle,
    );
    if (lessonDifference !== 0) return lessonDifference;
  } else if (key === "course") {
    const courseDifference = scheduleCollator.compare(
      left.courseTitle,
      right.courseTitle,
    );
    if (courseDifference !== 0) return courseDifference;
  } else if (key === "participants") {
    const participantDifference = left.records.length - right.records.length;
    if (participantDifference !== 0) return participantDifference;
  } else if (key === "status") {
    const statusDifference =
      scheduleStatusOrder[lessonRunState(left)] -
      scheduleStatusOrder[lessonRunState(right)];
    if (statusDifference !== 0) return statusDifference;
  }

  const timestampDifference =
    new Date(left.scheduledAt).getTime() -
    new Date(right.scheduledAt).getTime();
  if (timestampDifference !== 0) return timestampDifference;
  return left.id.localeCompare(right.id);
}

function scheduleRunStatus(run: LessonRun) {
  const state = lessonRunState(run);
  if (state === "scheduled") {
    return { label: "Ожидается", icon: Clock3 };
  }
  if (state === "attention") {
    return { label: "Нужно отметить", icon: CircleAlert };
  }
  if (state === "active") {
    return { label: "Идёт сейчас", icon: Play };
  }
  if (state === "completed") {
    return { label: "Проведён", icon: CircleCheck };
  }
  return { label: "Отменён", icon: CircleAlert };
}

function ScheduleRunStatus({ run }: { run: LessonRun }) {
  const status = scheduleRunStatus(run);
  const Icon = status.icon;
  return (
    <span className="teaching-run-table-status">
      <Icon className="h-4 w-4" aria-hidden="true" />
      <span className="teaching-run-table-status-label">{status.label}</span>
    </span>
  );
}

function runActionLabel(run: LessonRun) {
  if (lessonRunState(run) === "active") return "Завершить";
  if (lessonRunState(run) === "completed") return "Результаты";
  return "Открыть";
}

function capitalizeRussian(value: string) {
  return value.replace(/^./u, (character) =>
    character.toLocaleUpperCase("ru-RU"),
  );
}

function runPlanHref(run: LessonRun) {
  return `${toCourseRoute(run.courseId)}?lesson=${encodeURIComponent(run.lessonId)}`;
}

function ScheduleRunActions({
  run,
  disabled,
  onOpen,
  className = "teaching-run-actions",
}: {
  run: LessonRun;
  disabled: boolean;
  onOpen: () => void;
  className?: string;
}) {
  return (
    <div className={className}>
      <ScheduleRunStatus run={run} />
      <Button type="button" disabled={disabled} onClick={onOpen}>
        {runActionLabel(run)}
      </Button>
      <PageTransitionLink
        href={runPlanHref(run)}
        className={productButtonClassName("secondary")}
      >
        Открыть план
      </PageTransitionLink>
    </div>
  );
}

function CompletedRunDialog({
  run,
  onClose,
}: {
  run: LessonRun;
  onClose: () => void;
}) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <DialogShell
      title="Результаты проведения"
      description={`«${run.lessonTitle}» · ${run.courseTitle}`}
      onClose={onClose}
      panelClassName="max-w-3xl"
    >
      <RunHistoryList runs={[run]} />
    </DialogShell>
  );
}

export function ScheduleWorkspace() {
  const [runs, setRuns] = useState<LessonRun[] | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [period, setPeriod] = useState<SchedulePeriod>("week");
  const [viewMode, setViewMode] = useState<ScheduleViewMode>("table");
  const [sort, setSort] = useState<ProductTableSortState<ScheduleSortKey>>({
    key: "date",
    direction: "asc",
  });
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [selectedRunMode, setSelectedRunMode] =
    useState<SelectedRunMode>("default");
  const [error, setError] = useState<string | null>(null);
  const [busyLabel, setBusyLabel] = useState<string | null>(null);
  const mutationInFlightRef = useRef(false);
  const {
    summary: primaryHeaderSummary,
    pending: primaryHeaderSummaryPending,
    refresh: refreshPrimaryHeaderSummary,
  } = usePrimaryHeaderSummary();

  useSystemAssistantPageContext({
    surface: "schedule",
    courseId: null,
    lessonId: null,
    label: selectedDate
      ? `Расписание · ${formatSchedulePeriodLabel(selectedDate, period)}`
      : "Расписание",
    ...(selectedDate ? { localDate: formatLocalDateValue(selectedDate) } : {}),
  });

  const reload = useCallback(
    async (date: Date, activePeriod: SchedulePeriod) => {
      const range = schedulePeriodRange(date, activePeriod);
      const nextRuns = await loadSchedule(range.from, range.to);
      setRuns(nextRuns);
      return nextRuns;
    },
    [],
  );

  useEffect(() => {
    setSelectedDate(atLocalNoon(new Date()));
  }, []);

  useEffect(() => {
    if (!selectedDate) return;
    let active = true;
    setRuns(null);
    setError(null);
    const range = schedulePeriodRange(selectedDate, period);
    void loadSchedule(range.from, range.to)
      .then((nextRuns) => {
        if (active) setRuns(nextRuns);
      })
      .catch((caught: unknown) => {
        if (!active) return;
        setError(
          caught instanceof Error
            ? caught.message
            : "Не удалось загрузить расписание.",
        );
      });
    return () => {
      active = false;
    };
  }, [period, selectedDate]);

  const runMutation = useCallback<LessonRunMutationRunner>(
    async (label, action) => {
      if (mutationInFlightRef.current || !selectedDate) return false;
      mutationInFlightRef.current = true;
      setBusyLabel(label);
      setError(null);
      try {
        await action();
        await reload(selectedDate, period);
        refreshPrimaryHeaderSummary();
        return true;
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : "Не удалось сохранить проведение.",
        );
        return false;
      } finally {
        mutationInFlightRef.current = false;
        setBusyLabel(null);
      }
    },
    [period, refreshPrimaryHeaderSummary, reload, selectedDate],
  );

  const openRun = useCallback(
    (runId: string, mode: SelectedRunMode = "default") => {
      setSelectedRunMode(mode);
      setSelectedRunId(runId);
    },
    [],
  );

  const closeRun = useCallback(() => {
    setSelectedRunId(null);
    setSelectedRunMode("default");
  }, []);

  const startRun = useCallback(
    (runId: string) => {
      void runMutation("Начинаем урок…", () => startLessonRun(runId));
    },
    [runMutation],
  );

  const cancelRun = useCallback(
    (runId: string) => {
      if (!window.confirm("Отменить это проведение урока?")) return;
      void runMutation("Отменяем проведение…", () => cancelLessonRun(runId));
    },
    [runMutation],
  );

  const visibleRuns = useMemo(() => {
    const direction = sort.direction === "asc" ? 1 : -1;
    return [...(runs ?? [])]
      .filter((run) => !run.cancelledAt)
      .sort(
        (left, right) => direction * compareScheduleRuns(left, right, sort.key),
      );
  }, [runs, sort]);
  const selectedRun =
    visibleRuns.find((run) => run.id === selectedRunId) ?? null;
  const selectedPeriodLabel =
    period === "day"
      ? "выбранный день"
      : period === "week"
        ? "выбранную неделю"
        : "выбранный месяц";
  const selectedScheduleRange = selectedDate
    ? schedulePeriodRange(selectedDate, period)
    : null;
  const cachedScheduleSummary =
    selectedScheduleRange &&
    primaryHeaderSummary?.schedule?.from === selectedScheduleRange.from &&
    primaryHeaderSummary.schedule.to === selectedScheduleRange.to
      ? primaryHeaderSummary.schedule
      : null;
  const headerMetric =
    selectedDate && runs
      ? `${formatSchedulePeriodLabel(selectedDate, period)} · ${runs.length >= SCHEDULE_RESULT_LIMIT ? "показано" : "занятий"}: ${visibleRuns.length}`
      : selectedDate && cachedScheduleSummary
        ? `${formatSchedulePeriodLabel(selectedDate, period)} · ${cachedScheduleSummary.limited ? "показано" : "занятий"}: ${cachedScheduleSummary.visibleRunCount}`
        : undefined;
  const headerMetricPending =
    headerMetric === undefined &&
    error === null &&
    (selectedDate === null || runs === null || primaryHeaderSummaryPending);

  return (
    <div className="teaching-hub-stack">
      <AppPageHeader
        title="Расписание"
        metric={headerMetric}
        metricPending={headerMetricPending}
        actions={
          <PageTransitionLink
            href={ROUTES.courses}
            className={productButtonClassName("primary")}
          >
            <CalendarPlus className="h-4 w-4" aria-hidden="true" />
            Назначить урок
          </PageTransitionLink>
        }
      />
      <section
        className="teaching-hub-toolbar"
        aria-label="Навигация по расписанию"
      >
        <div className="teaching-schedule-toolbar-actions">
          {selectedDate ? (
            <ScheduleDatePicker
              selectedDate={selectedDate}
              period={period}
              onDateChange={setSelectedDate}
              onPeriodChange={setPeriod}
            />
          ) : null}
          <div
            className="teaching-schedule-view-toggle"
            role="group"
            aria-label="Вид занятий"
          >
            <button
              type="button"
              className={viewMode === "table" ? "is-active" : undefined}
              aria-label="Показать таблицей"
              aria-pressed={viewMode === "table"}
              onClick={() => setViewMode("table")}
            >
              <Table2 className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              className={viewMode === "cards" ? "is-active" : undefined}
              aria-label="Показать карточками"
              aria-pressed={viewMode === "cards"}
              onClick={() => setViewMode("cards")}
            >
              <LayoutGrid className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </section>

      {error ? (
        <SurfaceCard className="border border-rose-200">
          <p className="text-sm font-medium text-rose-800" role="alert">
            {error}
          </p>
        </SurfaceCard>
      ) : null}

      {busyLabel ? (
        <SurfaceCard className="flex items-center gap-3 border border-sky-200">
          <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden="true" />
          <p className="text-sm font-medium text-sky-900" role="status">
            {busyLabel}
          </p>
        </SurfaceCard>
      ) : null}

      {!error && !runs ? (
        <SurfaceCard className="flex items-center gap-3 border border-neutral-200">
          <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden="true" />
          <p className="text-sm font-medium text-neutral-700" role="status">
            Загружаем занятия…
          </p>
        </SurfaceCard>
      ) : null}

      {runs && runs.length >= SCHEDULE_RESULT_LIMIT ? (
        <SurfaceCard className="border border-amber-200 bg-amber-50/80">
          <p className="text-sm font-medium text-amber-900" role="status">
            Показаны первые {SCHEDULE_RESULT_LIMIT} занятий этого периода.
            {period === "month"
              ? " Переключитесь на неделю, чтобы сузить окно."
              : period === "week"
                ? " Эта неделя может быть показана не полностью."
                : " Этот день может быть показан не полностью."}
          </p>
        </SurfaceCard>
      ) : null}

      {runs && visibleRuns.length === 0 ? (
        <SurfaceCard className="teaching-schedule-empty" as="section">
          <div className="teaching-empty-icon teaching-empty-icon-sky">
            <CalendarDays className="h-6 w-6" aria-hidden="true" />
          </div>
          <div>
            <h2>Занятий нет</h2>
            <p>
              Откройте курс и нажмите «Назначить» рядом с нужным уроком. Он
              появится здесь в расписании за {selectedPeriodLabel}.
            </p>
          </div>
        </SurfaceCard>
      ) : null}

      {runs && visibleRuns.length > 0 ? (
        <section
          className="teaching-hub-section"
          aria-label={`Назначенные уроки за ${selectedPeriodLabel}`}
        >
          {viewMode === "table" ? (
            <div className="product-table-wrap teaching-run-table-wrap">
              <ProductTable className="teaching-run-table">
                <caption className="sr-only">
                  Занятия за {selectedPeriodLabel}
                </caption>
                <colgroup>
                  <col className="teaching-run-table-col-date" />
                  <col className="teaching-run-table-col-time" />
                  <col className="teaching-run-table-col-lesson" />
                  <col className="teaching-run-table-col-course" />
                  <col className="teaching-run-table-col-participants" />
                  <col className="teaching-run-table-col-status" />
                  <col className="teaching-run-table-col-actions" />
                </colgroup>
                <ProductTableHead>
                  <ProductTableHeaderRow>
                    <ProductTableSortableHeaderCell
                      direction={sort.key === "date" ? sort.direction : null}
                      onSort={() =>
                        setSort((current) =>
                          nextProductTableSort(current, "date"),
                        )
                      }
                    >
                      Дата
                    </ProductTableSortableHeaderCell>
                    <ProductTableSortableHeaderCell
                      direction={sort.key === "time" ? sort.direction : null}
                      onSort={() =>
                        setSort((current) =>
                          nextProductTableSort(current, "time"),
                        )
                      }
                    >
                      Время
                    </ProductTableSortableHeaderCell>
                    <ProductTableSortableHeaderCell
                      direction={sort.key === "lesson" ? sort.direction : null}
                      onSort={() =>
                        setSort((current) =>
                          nextProductTableSort(current, "lesson"),
                        )
                      }
                    >
                      Урок
                    </ProductTableSortableHeaderCell>
                    <ProductTableSortableHeaderCell
                      direction={sort.key === "course" ? sort.direction : null}
                      onSort={() =>
                        setSort((current) =>
                          nextProductTableSort(current, "course"),
                        )
                      }
                    >
                      Курс
                    </ProductTableSortableHeaderCell>
                    <ProductTableSortableHeaderCell
                      direction={
                        sort.key === "participants" ? sort.direction : null
                      }
                      onSort={() =>
                        setSort((current) =>
                          nextProductTableSort(current, "participants"),
                        )
                      }
                    >
                      Ученики
                    </ProductTableSortableHeaderCell>
                    <ProductTableSortableHeaderCell
                      direction={sort.key === "status" ? sort.direction : null}
                      onSort={() =>
                        setSort((current) =>
                          nextProductTableSort(current, "status"),
                        )
                      }
                    >
                      Статус
                    </ProductTableSortableHeaderCell>
                    <ProductTableHeaderCell
                      className="text-right"
                      aria-label="Действия"
                    />
                  </ProductTableHeaderRow>
                </ProductTableHead>
                <ProductTableBody>
                  {visibleRuns.map((run) => {
                    const scheduledAt = new Date(run.scheduledAt);
                    const compactDate = `${capitalizeRussian(
                      compactTableDateFormatter.format(scheduledAt),
                    )} · ${formatScheduleCompactDate(scheduledAt)}`;
                    const formattedTime = timeFormatter.format(scheduledAt);
                    const duration = `${run.plannedDurationMinutes} мин`;
                    const runState = lessonRunState(run);
                    const actionItems: ActionMenuItem[] =
                      runState === "completed"
                        ? [
                            {
                              id: "results",
                              label: "Результаты",
                              icon: CircleCheck,
                              disabled: Boolean(busyLabel),
                              onSelect: () => openRun(run.id),
                            },
                          ]
                        : runState === "active"
                          ? [
                              {
                                id: "complete",
                                label: "Завершить урок",
                                icon: CircleCheck,
                                disabled: Boolean(busyLabel),
                                onSelect: () => openRun(run.id),
                              },
                              {
                                id: "cancel",
                                label: "Отменить",
                                icon: XCircle,
                                destructive: true,
                                disabled: Boolean(busyLabel),
                                onSelect: () => cancelRun(run.id),
                              },
                            ]
                          : [
                              {
                                id: "start",
                                label: "Начать урок",
                                icon: Play,
                                disabled: Boolean(busyLabel),
                                onSelect: () => startRun(run.id),
                              },
                              {
                                id: "edit",
                                label: "Изменить",
                                icon: Pencil,
                                disabled: Boolean(busyLabel),
                                onSelect: () => openRun(run.id, "edit"),
                              },
                              {
                                id: "cancel",
                                label: "Отменить",
                                icon: XCircle,
                                destructive: true,
                                disabled: Boolean(busyLabel),
                                onSelect: () => cancelRun(run.id),
                              },
                            ];
                    return (
                      <ProductTableRow
                        key={run.id}
                        className="teaching-run-table-row"
                      >
                        <ProductTableCell className="overflow-hidden">
                          <time
                            dateTime={run.scheduledAt}
                            className="teaching-run-table-date block truncate"
                            title={compactDate}
                          >
                            {compactDate}
                          </time>
                        </ProductTableCell>
                        <ProductTableCell className="overflow-hidden">
                          <time
                            dateTime={run.scheduledAt}
                            className="teaching-run-table-duration block truncate"
                            title={`${formattedTime} · ${duration}`}
                          >
                            {formattedTime} · {duration}
                          </time>
                        </ProductTableCell>
                        <ProductTablePrimaryCell className="overflow-hidden">
                          <span
                            className="teaching-run-table-truncate block truncate"
                            title={run.lessonTitle}
                          >
                            {run.lessonTitle}
                          </span>
                        </ProductTablePrimaryCell>
                        <ProductTableCell className="overflow-hidden">
                          <span
                            className="teaching-run-table-truncate block truncate"
                            title={run.courseTitle}
                          >
                            {run.courseTitle}
                          </span>
                        </ProductTableCell>
                        <ProductTableCell>
                          <span className="teaching-run-table-participants">
                            <Users className="h-4 w-4" aria-hidden="true" />
                            {run.records.length}
                          </span>
                        </ProductTableCell>
                        <ProductTableCell>
                          <ScheduleRunStatus run={run} />
                        </ProductTableCell>
                        <ProductTableActionCell className="teaching-run-table-action-cell text-right">
                          <span className="teaching-run-table-actions">
                            <ActionMenu
                              className="teaching-run-action-menu"
                              label={`Действия с занятием «${run.lessonTitle}»`}
                              items={actionItems}
                              triggerIcon={MoreVertical}
                              triggerVariant="ghost"
                              disabled={Boolean(busyLabel)}
                              portal
                            />
                          </span>
                        </ProductTableActionCell>
                      </ProductTableRow>
                    );
                  })}
                </ProductTableBody>
              </ProductTable>
            </div>
          ) : (
            <div className="teaching-run-list">
              {visibleRuns.map((run) => {
                const scheduledAt = new Date(run.scheduledAt);
                return (
                  <SurfaceCard
                    key={run.id}
                    as="article"
                    className="teaching-run-card"
                    bodyClassName="teaching-run-card-body"
                  >
                    <time
                      dateTime={run.scheduledAt}
                      className="teaching-run-time"
                    >
                      <span>{tableDateFormatter.format(scheduledAt)}</span>
                      <strong>{timeFormatter.format(scheduledAt)}</strong>
                      <small>{run.plannedDurationMinutes} мин</small>
                    </time>
                    <div className="teaching-run-content">
                      <p>{run.courseTitle}</p>
                      <h3>{run.lessonTitle}</h3>
                      <span>
                        <Users className="h-4 w-4" aria-hidden="true" />
                        {run.records.length} учеников
                      </span>
                    </div>
                    <ScheduleRunActions
                      run={run}
                      disabled={Boolean(busyLabel)}
                      onOpen={() => setSelectedRunId(run.id)}
                    />
                  </SurfaceCard>
                );
              })}
            </div>
          )}
        </section>
      ) : null}

      {selectedRun?.endedAt ? (
        <CompletedRunDialog run={selectedRun} onClose={closeRun} />
      ) : selectedRun ? (
        <LessonRunDialog
          lesson={{ id: selectedRun.lessonId, title: selectedRun.lessonTitle }}
          runs={[selectedRun]}
          learners={selectedRun.records.map((record) => ({
            id: record.learnerProfileId,
            displayName: record.learnerDisplayName,
          }))}
          disabled={Boolean(busyLabel)}
          mutationError={error}
          runMutation={runMutation}
          initialMode={selectedRunMode}
          onClose={closeRun}
        />
      ) : null}
    </div>
  );
}
