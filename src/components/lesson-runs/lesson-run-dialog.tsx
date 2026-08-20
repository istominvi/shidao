"use client";

import Link from "next/link";
import {
  CalendarClock,
  CheckCircle2,
  Clock3,
  Play,
  RotateCcw,
  Users,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  cancelLessonRun,
  completeLessonRun,
  scheduleLessonRun,
  startLessonRun,
  updateLessonRun,
} from "@/components/lesson-runs/lesson-run-client";
import {
  completedLessonRunCount,
  defaultLessonRunDate,
  formatRunDateTime,
  lessonRunState,
  lessonRunStateLabel,
  openLessonRun,
  toLocalDateTimeInput,
} from "@/components/lesson-runs/lesson-run-format";
import { Button } from "@/components/ui/button";
import { DialogShell } from "@/components/ui/dialog-shell";
import type { LearningRecord, LessonRun } from "@/modules/lesson-runs/domain";
import type { LessonComponentObservation } from "@/modules/learning-activities";

export type LessonRunMutationRunner = (
  label: string,
  action: () => Promise<unknown>,
) => Promise<boolean>;

export type LessonRunLearnerOption = {
  id: string;
  displayName: string;
};

type LessonReference = {
  id: string;
  title: string;
  position?: number;
};

type CompletionDraft = {
  wasPresent: boolean | null;
  needsRepeat: boolean;
  teacherComment: string;
  shareWithLearner: boolean;
};

function runLearnerOptions(
  run: LessonRun | null,
  learners: LessonRunLearnerOption[],
) {
  const options = new Map(
    learners.map((learner) => [learner.id, learner] as const),
  );
  for (const record of run?.records ?? []) {
    if (!options.has(record.learnerProfileId)) {
      options.set(record.learnerProfileId, {
        id: record.learnerProfileId,
        displayName: record.learnerDisplayName,
      });
    }
  }
  return [...options.values()].sort((left, right) =>
    left.displayName.localeCompare(right.displayName, "ru"),
  );
}

function completionDraftFor(record: LearningRecord): CompletionDraft {
  return {
    wasPresent: record.wasPresent,
    needsRepeat: record.needsRepeat ?? false,
    teacherComment: record.teacherComment ?? "",
    shareWithLearner: Boolean(record.sharedWithLearnerAt),
  };
}

function setQuickDate(
  offset: 0 | 1,
  currentValue: string,
  now: Date = new Date(),
) {
  const current = currentValue ? new Date(currentValue) : now;
  const hour =
    offset === 0 && current.getTime() <= now.getTime()
      ? now.getHours() + 1
      : current.getHours();
  const next = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + offset,
    hour,
    current.getMinutes(),
  );
  next.setSeconds(0, 0);
  return toLocalDateTimeInput(next);
}

export function LessonRunStatusButton({
  runs,
  disabled,
  onClick,
  className = "",
  variant = "secondary",
}: {
  runs: LessonRun[];
  disabled?: boolean;
  onClick: () => void;
  className?: string;
  variant?: "primary" | "secondary";
}) {
  const currentRun = openLessonRun(runs);
  const completedCount = completedLessonRunCount(runs);
  const state = currentRun ? lessonRunState(currentRun) : null;
  const label = currentRun
    ? lessonRunStateLabel(currentRun)
    : completedCount > 0
      ? `Проведён ${completedCount} раз`
      : "Назначить";

  return (
    <Button
      type="button"
      variant={variant}
      className={`lesson-run-status-button lesson-run-status-${state ?? "empty"} ${className}`}
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      aria-label={`${label}. Настроить проведение урока`}
    >
      {state === "active" ? (
        <Play className="h-4 w-4" aria-hidden="true" />
      ) : completedCount > 0 && !currentRun ? (
        <RotateCcw className="h-4 w-4" aria-hidden="true" />
      ) : (
        <CalendarClock className="h-4 w-4" aria-hidden="true" />
      )}
      {label}
    </Button>
  );
}

export function LessonRunDialog({
  lesson,
  runs,
  learners,
  disabled,
  mutationError,
  runMutation,
  onScheduleSummaryChanged,
  onStarted,
  observations = [],
  initialMode = "default",
  onClose,
}: {
  lesson: LessonReference;
  runs: LessonRun[];
  learners: LessonRunLearnerOption[];
  disabled: boolean;
  mutationError?: string | null;
  runMutation: LessonRunMutationRunner;
  onScheduleSummaryChanged?: () => void;
  onStarted?: (lessonRunId: string) => void;
  observations?: LessonComponentObservation[];
  initialMode?: "default" | "edit";
  onClose: () => void;
}) {
  const run = openLessonRun(runs);
  const runState = run ? lessonRunState(run) : null;
  const learnerOptions = useMemo(
    () => runLearnerOptions(run, learners),
    [learners, run],
  );
  const [scheduledAt, setScheduledAt] = useState(() =>
    run ? toLocalDateTimeInput(run.scheduledAt) : defaultLessonRunDate(),
  );
  const [selectedLearnerIds, setSelectedLearnerIds] = useState<string[]>(() =>
    run
      ? run.records.map((record) => record.learnerProfileId)
      : learners.map((learner) => learner.id),
  );
  const [teacherReport, setTeacherReport] = useState(run?.teacherReport ?? "");
  const [actualDurationMinutes, setActualDurationMinutes] = useState(
    run?.actualDurationMinutes?.toString() ?? "",
  );
  const [editingAttention, setEditingAttention] = useState(
    initialMode === "edit",
  );
  const [mutationFailed, setMutationFailed] = useState(false);
  const [completion, setCompletion] = useState<Record<string, CompletionDraft>>(
    () =>
      Object.fromEntries(
        (run?.records ?? []).map((record) => [
          record.learnerProfileId,
          completionDraftFor(record),
        ]),
      ),
  );

  useEffect(() => {
    if (!run) return;
    setScheduledAt(toLocalDateTimeInput(run.scheduledAt));
    setSelectedLearnerIds(run.records.map((record) => record.learnerProfileId));
    setTeacherReport(run.teacherReport ?? "");
    setActualDurationMinutes(run.actualDurationMinutes?.toString() ?? "");
    setCompletion(
      Object.fromEntries(
        run.records.map((record) => [
          record.learnerProfileId,
          completionDraftFor(record),
        ]),
      ),
    );
  }, [run]);

  const activeRecords = run?.records ?? [];
  const observationCountByRecordId = useMemo(() => {
    const counts = new Map<string, number>();
    for (const observation of observations) {
      counts.set(
        observation.learningRecordId,
        (counts.get(observation.learningRecordId) ?? 0) + 1,
      );
    }
    return counts;
  }, [observations]);
  const observedLearnerCount = observationCountByRecordId.size;
  const completionMode =
    runState === "active" || (runState === "attention" && !editingAttention);
  const completionReady =
    activeRecords.length > 0 &&
    activeRecords.every((record) => {
      const draft =
        completion[record.learnerProfileId] ?? completionDraftFor(record);
      return (
        draft.wasPresent !== null &&
        !(
          draft.wasPresent === false &&
          observationCountByRecordId.has(record.id)
        )
      );
    });
  const hasUnsavedCompletionDraft =
    teacherReport !== (run?.teacherReport ?? "") ||
    actualDurationMinutes !== (run?.actualDurationMinutes?.toString() ?? "") ||
    activeRecords.some((record) => {
      const initial = completionDraftFor(record);
      const current = completion[record.learnerProfileId] ?? initial;
      return (
        current.wasPresent !== initial.wasPresent ||
        current.needsRepeat !== initial.needsRepeat ||
        current.teacherComment !== initial.teacherComment ||
        current.shareWithLearner !== initial.shareWithLearner
      );
    });
  const requestClose = useCallback(() => {
    if (disabled) return;
    if (
      hasUnsavedCompletionDraft &&
      !window.confirm(
        "Закрыть без сохранения? Отчёт и индивидуальные отметки будут потеряны.",
      )
    ) {
      return;
    }
    onClose();
  }, [disabled, hasUnsavedCompletionDraft, onClose]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape" || disabled) return;
      event.preventDefault();
      requestClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [disabled, requestClose]);

  const title =
    runState === "active"
      ? "Завершить урок"
      : runState === "attention" && !editingAttention
        ? "Отметить результаты"
        : run
          ? "Проведение урока"
          : completedLessonRunCount(runs) > 0
            ? "Назначить урок снова"
            : "Назначить урок";

  async function runDialogMutation(
    label: string,
    action: () => Promise<unknown>,
  ) {
    setMutationFailed(false);
    const saved = await runMutation(label, action);
    if (!saved) setMutationFailed(true);
    return saved;
  }

  async function saveSchedule() {
    if (!scheduledAt || selectedLearnerIds.length === 0) return;

    const input = {
      scheduledAt: new Date(scheduledAt).toISOString(),
      learnerProfileIds: selectedLearnerIds,
    };
    const saved = await runDialogMutation(
      run ? "Переносим урок…" : "Назначаем урок…",
      () =>
        run
          ? updateLessonRun(run.id, input)
          : scheduleLessonRun(lesson.id, input),
    );
    if (saved) {
      onScheduleSummaryChanged?.();
      onClose();
    }
  }

  async function start() {
    if (!run) return;
    const saved = await runDialogMutation("Начинаем урок…", () =>
      startLessonRun(run.id),
    );
    if (saved) {
      onStarted?.(run.id);
      onClose();
    }
  }

  async function cancel() {
    if (!run) return;
    const consequences = [
      observations.length > 0
        ? `Сохранённые наблюдения (${observations.length}) будут удалены вместе с черновыми учебными записями.`
        : null,
      hasUnsavedCompletionDraft
        ? "Введённый отчёт и индивидуальные итоговые отметки будут потеряны."
        : null,
    ].filter((message): message is string => Boolean(message));
    const warning = `Отменить это проведение урока?${
      consequences.length > 0 ? ` ${consequences.join(" ")}` : ""
    }`;
    if (!window.confirm(warning)) return;
    const saved = await runDialogMutation("Отменяем проведение…", () =>
      cancelLessonRun(run.id),
    );
    if (saved) {
      onScheduleSummaryChanged?.();
      onClose();
    }
  }

  async function complete() {
    if (!run || !completionReady) return;
    const saved = await runDialogMutation("Сохраняем результаты урока…", () =>
      completeLessonRun(run.id, {
        teacherReport,
        actualDurationMinutes: actualDurationMinutes
          ? Number(actualDurationMinutes)
          : null,
        records: activeRecords.map((record) => {
          const draft =
            completion[record.learnerProfileId] ?? completionDraftFor(record);
          if (draft.wasPresent === null) {
            throw new Error("Отметьте присутствие каждого ученика.");
          }
          return {
            learnerProfileId: record.learnerProfileId,
            wasPresent: draft.wasPresent,
            needsRepeat: draft.wasPresent && draft.needsRepeat,
            teacherComment: draft.teacherComment,
            shareWithLearner: draft.shareWithLearner,
          };
        }),
      }),
    );
    if (saved) {
      onScheduleSummaryChanged?.();
      onClose();
    }
  }

  return (
    <DialogShell
      title={title}
      description={`«${lesson.title}». Содержание урока остаётся тем же, а каждое завершённое проведение попадает в историю.`}
      onClose={requestClose}
      panelClassName="max-w-3xl"
    >
      {mutationFailed ? (
        <p className="app-alert app-alert-error mb-4" role="alert">
          {mutationError ??
            "Не удалось сохранить проведение. Попробуйте ещё раз."}
        </p>
      ) : null}

      {completionMode ? (
        <form
          className="grid gap-5"
          onSubmit={(event) => {
            event.preventDefault();
            void complete();
          }}
        >
          <div className="lesson-run-current-note">
            {runState === "active" ? (
              <Play className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Clock3 className="h-4 w-4" aria-hidden="true" />
            )}
            <span>
              {runState === "active"
                ? `Урок начат${
                    run?.startedAt ? ` ${formatRunDateTime(run.startedAt)}` : ""
                  }`
                : "Время урока прошло. Отметьте итоги, перенесите или отмените проведение."}
            </span>
          </div>

          {observations.length > 0 ? (
            <section
              className="lesson-run-observation-completion-summary"
              aria-label="Сводка наблюдений перед завершением"
            >
              <strong>Наблюдения перед завершением</strong>
              <p>
                Сохранено {observations.length} отметок для{" "}
                {observedLearnerCount} из {activeRecords.length} учеников. Они
                не меняют посещаемость, рекомендацию повторения или общий отчёт
                автоматически.
              </p>
            </section>
          ) : null}

          <label className="block">
            <span className="field-label">Как прошёл урок</span>
            <textarea
              autoFocus
              maxLength={4000}
              className="field-input min-h-28 resize-y"
              placeholder="Общий отчёт преподавателя"
              value={teacherReport}
              onChange={(event) => setTeacherReport(event.target.value)}
            />
          </label>

          <label className="block">
            <span className="field-label">Фактическая длительность, минут</span>
            <input
              type="number"
              min={1}
              max={720}
              inputMode="numeric"
              className="field-input"
              placeholder={
                run?.startedAtIsActual
                  ? "Рассчитается по времени запуска"
                  : "Укажите, если время известно"
              }
              value={actualDurationMinutes}
              onChange={(event) => setActualDurationMinutes(event.target.value)}
            />
            <span className="form-field-hint mt-1 block">
              Если урок запускали в ShiDao, длительность рассчитается
              автоматически. Для отчёта задним числом укажите её вручную;
              неизвестное время останется пустым.
            </span>
          </label>

          <fieldset className="lesson-run-participants">
            <legend>Результаты учеников</legend>
            {activeRecords.map((record) => {
              const draft =
                completion[record.learnerProfileId] ??
                completionDraftFor(record);
              const observationCount =
                observationCountByRecordId.get(record.id) ?? 0;
              return (
                <div
                  key={record.learnerProfileId}
                  className="lesson-run-participant-card"
                >
                  <strong>{record.learnerDisplayName}</strong>
                  <div
                    className="lesson-run-participant-toggles"
                    role="group"
                    aria-label={`Посещаемость: ${record.learnerDisplayName}`}
                  >
                    <label>
                      <input
                        type="radio"
                        name={`attendance-${record.learnerProfileId}`}
                        checked={draft.wasPresent === true}
                        onChange={() =>
                          setCompletion((current) => ({
                            ...current,
                            [record.learnerProfileId]: {
                              ...draft,
                              wasPresent: true,
                            },
                          }))
                        }
                      />
                      Был на уроке
                    </label>
                    <label>
                      <input
                        type="radio"
                        name={`attendance-${record.learnerProfileId}`}
                        checked={draft.wasPresent === false}
                        onChange={() =>
                          setCompletion((current) => ({
                            ...current,
                            [record.learnerProfileId]: {
                              ...draft,
                              wasPresent: false,
                              needsRepeat: false,
                            },
                          }))
                        }
                      />
                      Не был на уроке
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={draft.needsRepeat}
                        disabled={draft.wasPresent !== true}
                        onChange={(event) =>
                          setCompletion((current) => ({
                            ...current,
                            [record.learnerProfileId]: {
                              ...draft,
                              needsRepeat: event.target.checked,
                            },
                          }))
                        }
                      />
                      Нужно повторить
                    </label>
                  </div>
                  {draft.wasPresent === false && observationCount > 0 ? (
                    <p className="app-alert app-alert-error" role="alert">
                      Для ученика сохранено наблюдений: {observationCount}.
                      Отметьте присутствие или закройте это окно и явно очистите
                      наблюдения в проведении.
                    </p>
                  ) : null}
                  <label>
                    <span className="sr-only">
                      Комментарий об ученике {record.learnerDisplayName}
                    </span>
                    <textarea
                      maxLength={2000}
                      className="field-input min-h-20 resize-y"
                      placeholder="Индивидуальный комментарий"
                      value={draft.teacherComment}
                      onChange={(event) =>
                        setCompletion((current) => ({
                          ...current,
                          [record.learnerProfileId]: {
                            ...draft,
                            teacherComment: event.target.value,
                            shareWithLearner: event.target.value.trim()
                              ? draft.shareWithLearner
                              : false,
                          },
                        }))
                      }
                    />
                  </label>
                  <label className="lesson-run-profile-share">
                    <input
                      type="checkbox"
                      aria-label={`Добавить комментарий ${record.learnerDisplayName} в учебный профиль`}
                      checked={draft.shareWithLearner}
                      disabled={!draft.teacherComment.trim()}
                      onChange={(event) =>
                        setCompletion((current) => ({
                          ...current,
                          [record.learnerProfileId]: {
                            ...draft,
                            shareWithLearner: event.target.checked,
                          },
                        }))
                      }
                    />
                    <span>
                      <strong>Добавить в учебный профиль</strong>
                      <small>
                        Комментарий увидят учащийся и его наблюдатели. Без этой
                        отметки он останется только у преподавателя.
                      </small>
                    </span>
                  </label>
                </div>
              );
            })}
          </fieldset>

          {!completionReady ? (
            <p className="lesson-run-completion-hint" role="status">
              Отметьте «Был» или «Не был» для каждого ученика. Отсутствие нельзя
              сохранить, пока у ученика есть наблюдения этого проведения.
            </p>
          ) : null}

          <div className="dialog-shell-actions">
            {runState === "active" || runState === "attention" ? (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  className="product-btn-danger"
                  disabled={disabled}
                  onClick={() => void cancel()}
                >
                  <XCircle className="h-4 w-4" aria-hidden="true" />
                  {runState === "attention"
                    ? "Урок не состоялся"
                    : "Отменить проведение"}
                </Button>
                {runState === "attention" ? (
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={disabled}
                    onClick={() => setEditingAttention(true)}
                  >
                    <CalendarClock className="h-4 w-4" aria-hidden="true" />
                    Перенести
                  </Button>
                ) : null}
              </>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              disabled={disabled}
              onClick={requestClose}
            >
              Закрыть
            </Button>
            <Button type="submit" disabled={disabled || !completionReady}>
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              Завершить и сохранить
            </Button>
          </div>
        </form>
      ) : (
        <form
          className="grid gap-5"
          onSubmit={(event) => {
            event.preventDefault();
            void saveSchedule();
          }}
        >
          {run ? (
            <div className="lesson-run-current-note">
              <Clock3 className="h-4 w-4" aria-hidden="true" />
              <span>{lessonRunStateLabel(run)}</span>
            </div>
          ) : null}

          <div>
            <label className="block">
              <span className="field-label">Дата и время</span>
              <input
                autoFocus
                required
                type="datetime-local"
                className="field-input"
                value={scheduledAt}
                onChange={(event) => setScheduledAt(event.target.value)}
              />
              <span className="lesson-run-quick-dates">
                <button
                  type="button"
                  onClick={() =>
                    setScheduledAt((value) => setQuickDate(0, value))
                  }
                >
                  Сегодня
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setScheduledAt((value) => setQuickDate(1, value))
                  }
                >
                  Завтра
                </button>
              </span>
            </label>
          </div>

          <fieldset className="lesson-run-audience-picker">
            <legend>
              <Users className="h-4 w-4" aria-hidden="true" />
              Участники
            </legend>
            {learnerOptions.length > 0 ? (
              <>
                <div className="lesson-run-audience-actions">
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedLearnerIds(
                        learnerOptions.map((learner) => learner.id),
                      )
                    }
                  >
                    Выбрать всех
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedLearnerIds([])}
                  >
                    Снять выбор
                  </button>
                </div>
                <div className="lesson-run-audience-options">
                  {learnerOptions.map((learner) => (
                    <label key={learner.id}>
                      <input
                        type="checkbox"
                        checked={selectedLearnerIds.includes(learner.id)}
                        onChange={(event) =>
                          setSelectedLearnerIds((current) =>
                            event.target.checked
                              ? [...current, learner.id]
                              : current.filter((id) => id !== learner.id),
                          )
                        }
                      />
                      <span>{learner.displayName}</span>
                    </label>
                  ))}
                </div>
              </>
            ) : (
              <div className="lesson-run-no-audience">
                <p>Сначала добавьте ученика и назначьте его этому курсу.</p>
                <Link href="/students">Перейти к ученикам</Link>
              </div>
            )}
          </fieldset>

          <div className="dialog-shell-actions lesson-run-dialog-actions">
            {run ? (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  className="product-btn-danger"
                  disabled={disabled}
                  onClick={() => void cancel()}
                >
                  <XCircle className="h-4 w-4" aria-hidden="true" />
                  Отменить проведение
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={disabled}
                  onClick={() => void start()}
                >
                  <Play className="h-4 w-4" aria-hidden="true" />
                  Начать урок
                </Button>
              </>
            ) : null}
            <Button
              type="submit"
              disabled={
                disabled || !scheduledAt || selectedLearnerIds.length === 0
              }
            >
              <CalendarClock className="h-4 w-4" aria-hidden="true" />
              {run ? "Сохранить время и состав" : "Назначить урок"}
            </Button>
          </div>
        </form>
      )}
    </DialogShell>
  );
}
