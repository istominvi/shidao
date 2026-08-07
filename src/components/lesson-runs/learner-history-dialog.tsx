"use client";

import { CheckCircle2, History, LoaderCircle, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";
import { loadLearnerHistory } from "@/components/lesson-runs/lesson-run-client";
import { formatRunDateTime } from "@/components/lesson-runs/lesson-run-format";
import { DialogShell } from "@/components/ui/dialog-shell";
import type {
  LearnerProfile,
  LearningRecord,
} from "@/modules/lesson-runs/domain";

export function LearnerHistoryDialog({
  profile,
  onClose,
}: {
  profile: LearnerProfile;
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
      title={profile.displayName}
      description="История обучения в курсах, где вы работаете с этим учеником."
      onClose={onClose}
      panelClassName="max-w-3xl"
    >
      <LearnerHistoryPanel profile={profile} />
    </DialogShell>
  );
}

export function LearnerHistoryPanel({ profile }: { profile: LearnerProfile }) {
  const [records, setRecords] = useState<LearningRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setRecords(null);
    setError(null);
    void loadLearnerHistory(profile.id)
      .then((items) => {
        if (active) setRecords(items);
      })
      .catch((caught: unknown) => {
        if (!active) return;
        setError(
          caught instanceof Error
            ? caught.message
            : "Не удалось загрузить учебную историю.",
        );
      });
    return () => {
      active = false;
    };
  }, [profile.id]);

  return (
    <div className="learner-history-panel">
      <p className="learner-history-scope">
        Показаны только завершённые уроки в ваших курсах. Данные других
        преподавателей здесь недоступны.
      </p>
      {error ? (
        <p className="app-alert app-alert-error" role="alert">
          {error}
        </p>
      ) : null}
      {!error && !records ? (
        <p
          className="flex items-center gap-2 py-7 text-sm text-neutral-600"
          role="status"
        >
          <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
          Загружаем историю…
        </p>
      ) : null}
      {records?.length === 0 ? (
        <div className="lesson-run-no-audience py-8 text-center">
          <History className="mx-auto h-7 w-7" aria-hidden="true" />
          <p>Завершённых уроков пока нет.</p>
        </div>
      ) : null}
      {records?.length ? (
        <ol className="learner-history-list">
          {records.map((record) => (
            <li key={record.id}>
              <div className="learner-history-heading">
                <div>
                  <p>{record.courseTitleAtTime ?? "Удалённый курс"}</p>
                  <h3>{record.lessonTitleAtTime ?? "Удалённый урок"}</h3>
                  <time dateTime={record.occurredAt ?? undefined}>
                    {record.occurredAt
                      ? formatRunDateTime(record.occurredAt)
                      : "Дата не зафиксирована"}
                  </time>
                </div>
                {record.needsRepeat ? (
                  <span className="lesson-run-repeat">
                    <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                    Нужно повторить
                  </span>
                ) : record.wasPresent ? (
                  <span className="lesson-run-complete">
                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                    Был на уроке
                  </span>
                ) : (
                  <span className="lesson-run-history-state lesson-run-status-cancelled">
                    Отсутствовал
                  </span>
                )}
              </div>
              {record.teacherComment ? <p>{record.teacherComment}</p> : null}
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}
