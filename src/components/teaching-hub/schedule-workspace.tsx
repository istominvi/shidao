"use client";

import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Clock3,
  LoaderCircle,
  Play,
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
  localDayRange,
} from "@/components/lesson-runs/lesson-run-format";
import { RunHistoryList } from "@/components/lesson-runs/run-history-list";
import { Button, productButtonClassName } from "@/components/ui/button";
import { Chip, type ChipTone } from "@/components/ui/chip";
import { DialogShell } from "@/components/ui/dialog-shell";
import { SurfaceCard } from "@/components/ui/surface-card";
import { toCourseRoute } from "@/lib/auth";
import type { LessonRun } from "@/modules/lesson-runs/domain";

const dateFormatter = new Intl.DateTimeFormat("ru-RU", {
  weekday: "long",
  day: "numeric",
  month: "long",
});

const timeFormatter = new Intl.DateTimeFormat("ru-RU", {
  hour: "2-digit",
  minute: "2-digit",
});

function atLocalNoon(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate(), 12);
}

function shiftDate(value: Date, amount: number) {
  const next = atLocalNoon(value);
  next.setDate(next.getDate() + amount);
  return next;
}

function formatSelectedDate(value: Date) {
  const label = dateFormatter.format(value);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function formatAssistantLocalDate(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function statusTone(run: LessonRun): ChipTone {
  const state = lessonRunState(run);
  if (state === "active") return "emerald";
  if (state === "attention") return "amber";
  if (state === "completed") return "violet";
  if (state === "cancelled") return "slate";
  return "sky";
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

  const reload = useCallback(async (date: Date) => {
    const range = localDayRange(date);
    const nextRuns = await loadSchedule(range.from, range.to);
    setRuns(nextRuns);
    return nextRuns;
  }, []);

  useEffect(() => {
    setSelectedDate(atLocalNoon(new Date()));
  }, []);

  useEffect(() => {
    if (!selectedDate) return;
    let active = true;
    setRuns(null);
    setError(null);
    const range = localDayRange(selectedDate);
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
  }, [selectedDate]);

  const runMutation = useCallback<LessonRunMutationRunner>(
    async (label, action) => {
      if (mutationInFlightRef.current || !selectedDate) return false;
      mutationInFlightRef.current = true;
      setBusyLabel(label);
      setError(null);
      try {
        await action();
        await reload(selectedDate);
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
    [reload, selectedDate],
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

  return (
    <div className="teaching-hub-stack">
      <section
        className="teaching-hub-toolbar"
        aria-label="Навигация по расписанию"
      >
        <div className="teaching-date-navigator">
          <button
            type="button"
            aria-label="Предыдущий день"
            onClick={() =>
              setSelectedDate((current) =>
                shiftDate(current ?? atLocalNoon(new Date()), -1),
              )
            }
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          </button>
          <strong aria-live="polite">
            {selectedDate ? formatSelectedDate(selectedDate) : "Сегодня"}
          </strong>
          <button
            type="button"
            aria-label="Следующий день"
            onClick={() =>
              setSelectedDate((current) =>
                shiftDate(current ?? atLocalNoon(new Date()), 1),
              )
            }
          >
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            className="teaching-today-button"
            onClick={() => setSelectedDate(atLocalNoon(new Date()))}
          >
            Сегодня
          </button>
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

      {runs && visibleRuns.length === 0 ? (
        <SurfaceCard className="teaching-schedule-empty" as="section">
          <div className="teaching-empty-icon teaching-empty-icon-sky">
            <CalendarDays className="h-6 w-6" aria-hidden="true" />
          </div>
          <div>
            <p className="teaching-empty-eyebrow">Выбранный день</p>
            <h2>Занятий нет</h2>
            <p>
              Откройте курс и нажмите «Назначить» рядом с нужным уроком. Он
              сразу появится здесь без отдельного события расписания.
            </p>
          </div>
        </SurfaceCard>
      ) : null}

      {runs && visibleRuns.length > 0 ? (
        <section
          className="teaching-hub-section"
          aria-labelledby="day-runs-title"
        >
          <div className="teaching-section-heading">
            <div>
              <p className="teaching-section-eyebrow">Выбранный день</p>
              <h2 id="day-runs-title">Занятия</h2>
            </div>
            <Chip icon={CalendarDays} tone="slate">
              {visibleRuns.length}
            </Chip>
          </div>

          <div className="teaching-run-list">
            {visibleRuns.map((run) => (
              <SurfaceCard
                key={run.id}
                as="article"
                className="teaching-run-card"
              >
                <time dateTime={run.scheduledAt} className="teaching-run-time">
                  {timeFormatter.format(new Date(run.scheduledAt))}
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
                <div className="teaching-run-actions">
                  <Chip
                    icon={lessonRunState(run) === "active" ? Play : Clock3}
                    tone={statusTone(run)}
                  >
                    {lessonRunStateLabel(run)}
                  </Chip>
                  <Button
                    type="button"
                    disabled={Boolean(busyLabel)}
                    onClick={() => setSelectedRunId(run.id)}
                  >
                    {lessonRunState(run) === "active"
                      ? "Завершить"
                      : lessonRunState(run) === "completed"
                        ? "Результаты"
                        : "Открыть"}
                  </Button>
                  <Link
                    href={`${toCourseRoute(run.courseId)}?lesson=${encodeURIComponent(run.lessonId)}`}
                    className={productButtonClassName("ghost")}
                  >
                    Открыть план
                  </Link>
                </div>
              </SurfaceCard>
            ))}
          </div>
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
