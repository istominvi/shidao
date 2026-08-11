"use client";

import Link from "next/link";
import {
  CalendarDays,
  CircleAlert,
  CircleCheck,
  Clock3,
  LayoutGrid,
  LoaderCircle,
  Play,
  Table2,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSystemAssistantPageContext } from "@/components/assistant/system-assistant-provider";
import { loadSchedule } from "@/components/lesson-runs/lesson-run-client";
import {
  LessonRunDialog,
  type LessonRunMutationRunner,
} from "@/components/lesson-runs/lesson-run-dialog";
import { lessonRunState } from "@/components/lesson-runs/lesson-run-format";
import { RunHistoryList } from "@/components/lesson-runs/run-history-list";
import { ScheduleDatePicker } from "@/components/teaching-hub/schedule-date-picker";
import {
  atLocalNoon,
  formatSchedulePeriodLabel,
  formatLocalDateValue,
  schedulePeriodRange,
  type SchedulePeriod,
} from "@/components/teaching-hub/schedule-period";
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
} from "@/components/ui/product-table";
import { SurfaceCard } from "@/components/ui/surface-card";
import { toCourseRoute } from "@/lib/auth";
import type { LessonRun } from "@/modules/lesson-runs/domain";

const tableDateFormatter = new Intl.DateTimeFormat("ru-RU", {
  weekday: "long",
  day: "numeric",
  month: "long",
});

const timeFormatter = new Intl.DateTimeFormat("ru-RU", {
  hour: "2-digit",
  minute: "2-digit",
});

type ScheduleViewMode = "table" | "cards";
const SCHEDULE_RESULT_LIMIT = 500;

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
      {status.label}
    </span>
  );
}

function runActionLabel(run: LessonRun) {
  if (lessonRunState(run) === "active") return "Завершить";
  if (lessonRunState(run) === "completed") return "Результаты";
  return "Открыть";
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
      <Link
        href={`${toCourseRoute(run.courseId)}?lesson=${encodeURIComponent(run.lessonId)}`}
        className={productButtonClassName("secondary")}
      >
        Открыть план
      </Link>
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
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyLabel, setBusyLabel] = useState<string | null>(null);
  const mutationInFlightRef = useRef(false);

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
    [period, reload, selectedDate],
  );

  const visibleRuns = useMemo(
    () =>
      [...(runs ?? [])]
        .filter((run) => !run.cancelledAt)
        .sort(
          (left, right) =>
            new Date(left.scheduledAt).getTime() -
            new Date(right.scheduledAt).getTime(),
        ),
    [runs],
  );
  const selectedRun =
    visibleRuns.find((run) => run.id === selectedRunId) ?? null;
  const selectedPeriodLabel =
    period === "day"
      ? "выбранный день"
      : period === "week"
        ? "выбранную неделю"
        : "выбранный месяц";

  return (
    <div className="teaching-hub-stack">
      <section
        className="teaching-hub-toolbar"
        aria-label="Навигация по расписанию"
      >
        <div className="teaching-schedule-toolbar-actions">
          <ScheduleDatePicker
            selectedDate={selectedDate ?? atLocalNoon(new Date())}
            period={period}
            onDateChange={setSelectedDate}
            onPeriodChange={setPeriod}
          />
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
            <div className="teaching-run-table-wrap">
              <ProductTable className="teaching-run-table">
                <caption className="sr-only">
                  Занятия за {selectedPeriodLabel}
                </caption>
                <ProductTableHead>
                  <ProductTableHeaderRow>
                    <ProductTableHeaderCell className="w-[18%]">
                      Дата и время
                    </ProductTableHeaderCell>
                    <ProductTableHeaderCell className="w-[26%]">
                      Урок
                    </ProductTableHeaderCell>
                    <ProductTableHeaderCell className="w-[14%]">
                      Ученики
                    </ProductTableHeaderCell>
                    <ProductTableHeaderCell className="w-[18%]">
                      Статус
                    </ProductTableHeaderCell>
                    <ProductTableHeaderCell className="w-[24%] text-right">
                      Действия
                    </ProductTableHeaderCell>
                  </ProductTableHeaderRow>
                </ProductTableHead>
                <ProductTableBody>
                  {visibleRuns.map((run) => {
                    const scheduledAt = new Date(run.scheduledAt);
                    return (
                      <ProductTableRow key={run.id} className="h-20">
                        <ProductTableCell>
                          <time
                            dateTime={run.scheduledAt}
                            className="teaching-run-table-time"
                          >
                            <strong>
                              {tableDateFormatter
                                .format(scheduledAt)
                                .replace(/^./u, (character) =>
                                  character.toLocaleUpperCase("ru-RU"),
                                )}
                            </strong>
                            <span>
                              {timeFormatter.format(scheduledAt)} ·{" "}
                              {run.plannedDurationMinutes} мин.
                            </span>
                          </time>
                        </ProductTableCell>
                        <ProductTablePrimaryCell>
                          <span className="teaching-run-table-lesson">
                            <strong>{run.lessonTitle}</strong>
                            <small>{run.courseTitle}</small>
                          </span>
                        </ProductTablePrimaryCell>
                        <ProductTableCell>
                          <span className="teaching-run-table-participants">
                            <Users className="h-4 w-4" aria-hidden="true" />
                            {run.records.length}
                          </span>
                        </ProductTableCell>
                        <ProductTableCell>
                          <ScheduleRunStatus run={run} />
                        </ProductTableCell>
                        <ProductTableActionCell className="text-right">
                          <span className="teaching-run-table-actions">
                            <Button
                              type="button"
                              disabled={Boolean(busyLabel)}
                              onClick={() => setSelectedRunId(run.id)}
                            >
                              {runActionLabel(run)}
                            </Button>
                            <Link
                              href={`${toCourseRoute(run.courseId)}?lesson=${encodeURIComponent(run.lessonId)}`}
                              className={productButtonClassName("secondary")}
                            >
                              Открыть план
                            </Link>
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
                      <small>{run.plannedDurationMinutes} мин.</small>
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
        <CompletedRunDialog
          run={selectedRun}
          onClose={() => setSelectedRunId(null)}
        />
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
          onClose={() => setSelectedRunId(null)}
        />
      ) : null}
    </div>
  );
}
