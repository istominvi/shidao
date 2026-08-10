"use client";

import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  ChevronDown,
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
import {
  lessonRunState,
  lessonRunStateLabel,
} from "@/components/lesson-runs/lesson-run-format";
import { RunHistoryList } from "@/components/lesson-runs/run-history-list";
import {
  atLocalNoon,
  formatLocalDateValue,
  parseLocalDateValue,
  schedulePeriodRange,
  shiftSchedulePeriod,
  type SchedulePeriod,
} from "@/components/teaching-hub/schedule-period";
import { Button, productButtonClassName } from "@/components/ui/button";
import { Chip, type ChipTone } from "@/components/ui/chip";
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

const dateFormatter = new Intl.DateTimeFormat("ru-RU", {
  weekday: "long",
  day: "numeric",
  month: "long",
});

const dateWithYearFormatter = new Intl.DateTimeFormat("ru-RU", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

const shortDateFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
});

const tableDateFormatter = new Intl.DateTimeFormat("ru-RU", {
  weekday: "short",
  day: "numeric",
  month: "short",
});

const timeFormatter = new Intl.DateTimeFormat("ru-RU", {
  hour: "2-digit",
  minute: "2-digit",
});

function formatSelectedDate(value: Date) {
  const today = new Date();
  if (
    value.getFullYear() === today.getFullYear() &&
    value.getMonth() === today.getMonth() &&
    value.getDate() === today.getDate()
  ) {
    return `Сегодня · ${shortDateFormatter.format(value)}`;
  }
  const label =
    value.getFullYear() === today.getFullYear()
      ? dateFormatter.format(value)
      : dateWithYearFormatter.format(value);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function formatAssistantLocalDate(value: Date) {
  return formatLocalDateValue(value);
}

type ScheduleViewMode = "table" | "cards";
const SCHEDULE_RESULT_LIMIT = 500;

function statusTone(run: LessonRun): ChipTone {
  const state = lessonRunState(run);
  if (state === "active") return "emerald";
  if (state === "attention") return "amber";
  if (state === "completed") return "violet";
  if (state === "cancelled") return "slate";
  return "sky";
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
      <Chip
        icon={lessonRunState(run) === "active" ? Play : Clock3}
        tone={statusTone(run)}
      >
        {lessonRunStateLabel(run)}
      </Chip>
      <Button type="button" disabled={disabled} onClick={onOpen}>
        {runActionLabel(run)}
      </Button>
      <Link
        href={`${toCourseRoute(run.courseId)}?lesson=${encodeURIComponent(run.lessonId)}`}
        className={productButtonClassName("ghost")}
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
      ? `Расписание · ${formatSelectedDate(selectedDate)}`
      : "Расписание",
    ...(selectedDate
      ? { localDate: formatAssistantLocalDate(selectedDate) }
      : {}),
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
    period === "week" ? "выбранную неделю" : "выбранный месяц";
  const periodEyebrow =
    period === "week" ? "Выбранная неделя" : "Выбранный месяц";

  return (
    <div className="teaching-hub-stack">
      <section
        className="teaching-hub-toolbar"
        aria-label="Навигация по расписанию"
      >
        <div className="teaching-date-navigator">
          <button
            type="button"
            aria-label={
              period === "week" ? "Предыдущая неделя" : "Предыдущий месяц"
            }
            onClick={() =>
              setSelectedDate((current) =>
                shiftSchedulePeriod(
                  current ?? atLocalNoon(new Date()),
                  period,
                  -1,
                ),
              )
            }
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          </button>
          <label className="teaching-date-trigger">
            <span aria-live="polite">
              {selectedDate ? formatSelectedDate(selectedDate) : "Сегодня"}
            </span>
            <ChevronDown className="h-4 w-4" aria-hidden="true" />
            <input
              type="date"
              aria-label="Выбрать дату расписания"
              value={selectedDate ? formatLocalDateValue(selectedDate) : ""}
              onChange={(event) => {
                const nextDate = parseLocalDateValue(event.target.value);
                if (nextDate) setSelectedDate(nextDate);
              }}
            />
          </label>
          <button
            type="button"
            aria-label={
              period === "week" ? "Следующая неделя" : "Следующий месяц"
            }
            onClick={() =>
              setSelectedDate((current) =>
                shiftSchedulePeriod(
                  current ?? atLocalNoon(new Date()),
                  period,
                  1,
                ),
              )
            }
          >
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="teaching-schedule-toolbar-actions">
          <div
            className="teaching-schedule-period-switch"
            role="group"
            aria-label="Период расписания"
          >
            <button
              type="button"
              className={period === "week" ? "is-active" : undefined}
              aria-pressed={period === "week"}
              onClick={() => setPeriod("week")}
            >
              Неделя
            </button>
            <button
              type="button"
              className={period === "month" ? "is-active" : undefined}
              aria-pressed={period === "month"}
              onClick={() => setPeriod("month")}
            >
              Месяц
            </button>
          </div>
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
              : " Эта неделя может быть показана не полностью."}
          </p>
        </SurfaceCard>
      ) : null}

      {runs && visibleRuns.length === 0 ? (
        <SurfaceCard className="teaching-schedule-empty" as="section">
          <div className="teaching-empty-icon teaching-empty-icon-sky">
            <CalendarDays className="h-6 w-6" aria-hidden="true" />
          </div>
          <div>
            <p className="teaching-empty-eyebrow">{periodEyebrow}</p>
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
          aria-labelledby="schedule-runs-title"
        >
          <div className="teaching-section-heading">
            <div>
              <p className="teaching-section-eyebrow">{periodEyebrow}</p>
              <h2 id="schedule-runs-title">Занятия</h2>
            </div>
            <Chip icon={CalendarDays} tone="slate">
              {visibleRuns.length}
            </Chip>
          </div>

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
                      Участники
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
                              {tableDateFormatter.format(scheduledAt)}
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
                          <Chip
                            icon={
                              lessonRunState(run) === "active" ? Play : Clock3
                            }
                            tone={statusTone(run)}
                          >
                            {lessonRunStateLabel(run)}
                          </Chip>
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
                              className={productButtonClassName("ghost")}
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
                        {run.records.length} участников
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
