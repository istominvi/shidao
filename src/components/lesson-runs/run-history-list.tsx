"use client";

import { CalendarDays, CheckCircle2, RotateCcw, Users } from "lucide-react";
import { CorrectionAuditList } from "@/components/learning-activities/correction-audit-list";
import {
  formatRunDateTime,
  lessonRunState,
  lessonRunStateLabel,
} from "@/components/lesson-runs/lesson-run-format";
import type { LessonRun } from "@/modules/lesson-runs/domain";
import type {
  LearningEvidence,
  LessonObservationCorrection,
  LessonComponentObservation,
} from "@/modules/learning-activities";
import { Button } from "@/components/ui/button";
import {
  observationObjectiveTitleAtTime,
  ratingLabel,
} from "@/components/learning-activities/observation-format";
import {
  currentEvidenceByObservation,
  evidenceDirectionLabel,
} from "@/components/learning-activities/evidence-history-format";

function participantSummary(run: LessonRun) {
  const finalRecords = run.records.filter((record) => record.occurredAt);
  const present = finalRecords.filter(
    (record) => record.wasPresent === true,
  ).length;
  if (run.endedAt) {
    return `${present} из ${finalRecords.length} на уроке`;
  }
  return `${run.records.length} приглашено`;
}

function observationsByRecord(
  observations: LessonComponentObservation[],
): Map<string, LessonComponentObservation[]> {
  const grouped = new Map<string, LessonComponentObservation[]>();
  for (const observation of observations) {
    const current = grouped.get(observation.learningRecordId) ?? [];
    current.push(observation);
    grouped.set(observation.learningRecordId, current);
  }
  for (const recordObservations of grouped.values()) {
    recordObservations.sort(
      (left, right) =>
        left.componentPositionAtTime - right.componentPositionAtTime ||
        left.id.localeCompare(right.id),
    );
  }
  return grouped;
}

function correctionsByRecord(corrections: LessonObservationCorrection[]) {
  const grouped = new Map<string, LessonObservationCorrection[]>();
  for (const correction of corrections) {
    const current = grouped.get(correction.activeLearningRecordId);
    if (current) current.push(correction);
    else grouped.set(correction.activeLearningRecordId, [correction]);
  }
  return grouped;
}

function EvidenceUnavailableAlert({ onReload }: { onReload?: () => void }) {
  return (
    <div
      className="app-alert app-alert-error mb-4 flex flex-wrap items-center justify-between gap-3"
      role="alert"
    >
      <span>
        История и наблюдения доступны, но свидетельства профиля временно не
        загружены. Это не означает, что свидетельств нет.
      </span>
      {onReload ? (
        <Button type="button" variant="secondary" onClick={onReload}>
          Обновить историю
        </Button>
      ) : null}
    </div>
  );
}

function CorrectionHistoryAlert({
  unavailable,
  truncated,
  onReload,
}: {
  unavailable: boolean;
  truncated: boolean;
  onReload?: () => void;
}) {
  if (!unavailable && !truncated) return null;
  return (
    <div
      className={`app-alert mb-4 flex flex-wrap items-center justify-between gap-3 ${unavailable ? "app-alert-error" : "app-alert-info"}`}
      role={unavailable ? "alert" : "status"}
    >
      <span>
        {unavailable
          ? "История доступна, но журнал исправлений временно не загружен. Пустой журнал сейчас не означает отсутствие исправлений."
          : "Показаны последние 200 исправлений. Более ранние записи остаются в защищённом журнале."}
      </span>
      {unavailable && onReload ? (
        <Button type="button" variant="secondary" onClick={onReload}>
          Повторить загрузку журнала
        </Button>
      ) : null}
    </div>
  );
}

export function RunHistoryList({
  runs,
  emptyTitle = "Проведений пока нет",
  emptyDescription = "После завершения урока здесь появятся отчёт преподавателя и индивидуальные результаты учеников.",
  showLessonTitle = false,
  observations = [],
  corrections = [],
  correctionsTruncated = false,
  correctionsUnavailable = false,
  evidence = [],
  evidenceUnavailable = false,
  onReload,
}: {
  runs: LessonRun[];
  emptyTitle?: string;
  emptyDescription?: string;
  showLessonTitle?: boolean;
  observations?: LessonComponentObservation[];
  corrections?: LessonObservationCorrection[];
  correctionsTruncated?: boolean;
  correctionsUnavailable?: boolean;
  evidence?: LearningEvidence[];
  evidenceUnavailable?: boolean;
  onReload?: () => void;
}) {
  const orderedRuns = [...runs].sort(
    (left, right) =>
      new Date(right.scheduledAt).getTime() -
      new Date(left.scheduledAt).getTime(),
  );
  const groupedObservations = observationsByRecord(observations);
  const groupedCorrections = correctionsByRecord(corrections);
  const groupedEvidence = currentEvidenceByObservation(evidence);

  if (orderedRuns.length === 0) {
    return (
      <>
        {evidenceUnavailable ? (
          <EvidenceUnavailableAlert onReload={onReload} />
        ) : null}
        <CorrectionHistoryAlert
          unavailable={correctionsUnavailable}
          truncated={correctionsTruncated}
          onReload={onReload}
        />
        <section className="workspace-surface workspace-empty-panel">
          <span className="workspace-empty-icon workspace-empty-icon-pink">
            <CalendarDays aria-hidden="true" />
          </span>
          <h2>{emptyTitle}</h2>
          <p>{emptyDescription}</p>
        </section>
      </>
    );
  }

  return (
    <section className="lesson-run-history" aria-label="История проведений">
      {evidenceUnavailable ? (
        <EvidenceUnavailableAlert onReload={onReload} />
      ) : null}
      <CorrectionHistoryAlert
        unavailable={correctionsUnavailable}
        truncated={correctionsTruncated}
        onReload={onReload}
      />
      {orderedRuns.map((run) => {
        const state = lessonRunState(run);
        const finalRecords = run.records.filter((record) => record.occurredAt);
        const runObservations = finalRecords.flatMap(
          (record) => groupedObservations.get(record.id) ?? [],
        );
        const runEvidence = runObservations.flatMap(
          (observation) => groupedEvidence.get(observation.id) ?? [],
        );
        return (
          <article key={run.id} className="lesson-run-history-card">
            <header>
              <div>
                {showLessonTitle ? (
                  <p className="lesson-run-history-course">{run.courseTitle}</p>
                ) : null}
                <h3>
                  {showLessonTitle
                    ? run.lessonTitle
                    : formatRunDateTime(run.scheduledAt)}
                </h3>
                {showLessonTitle ? (
                  <p className="lesson-run-history-date">
                    {formatRunDateTime(run.scheduledAt)}
                  </p>
                ) : null}
              </div>
              <span
                className={`lesson-run-history-state lesson-run-status-${state}`}
              >
                {lessonRunStateLabel(run)}
              </span>
            </header>

            <div className="lesson-run-history-meta">
              <span>
                <Users className="h-4 w-4" aria-hidden="true" />
                {participantSummary(run)}
              </span>
              <span>
                {run.actualDurationMinutes != null
                  ? `${run.actualDurationMinutes} мин. фактически`
                  : `${run.plannedDurationMinutes} мин. по плану`}
              </span>
            </div>

            {run.teacherReport ? (
              <div className="lesson-run-teacher-report">
                <strong>Отчёт преподавателя</strong>
                <p>{run.teacherReport}</p>
              </div>
            ) : null}

            {runObservations.length > 0 ? (
              <div className="lesson-run-observation-history-summary">
                <strong>Наблюдения по компонентам</strong>
                <span>
                  {runObservations.length} отметок ·{" "}
                  {
                    new Set(
                      runObservations.map(
                        (observation) => observation.sourceComponentIdAtTime,
                      ),
                    ).size
                  }{" "}
                  компонентов
                  {runEvidence.length > 0
                    ? ` · ${runEvidence.length} свидетельств профиля`
                    : ""}
                </span>
              </div>
            ) : null}

            {finalRecords.length > 0 ? (
              <ul className="lesson-run-record-list">
                {finalRecords.map((record) => {
                  const recordObservations =
                    groupedObservations.get(record.id) ?? [];
                  const recordCorrections =
                    groupedCorrections.get(record.id) ?? [];
                  return (
                    <li key={record.id}>
                      <div>
                        <strong>{record.learnerDisplayName}</strong>
                        <span>
                          {record.wasPresent
                            ? "Присутствие: да"
                            : "Присутствие: нет"}
                        </span>
                      </div>
                      <div className="lesson-run-record-result">
                        {record.needsRepeat ? (
                          <span className="lesson-run-repeat">
                            <RotateCcw
                              className="h-3.5 w-3.5"
                              aria-hidden="true"
                            />
                            Нужно повторить
                          </span>
                        ) : record.wasPresent ? (
                          <span className="lesson-run-complete">
                            <CheckCircle2
                              className="h-3.5 w-3.5"
                              aria-hidden="true"
                            />
                            Повтор не отмечен
                          </span>
                        ) : null}
                      </div>
                      {record.teacherComment ? (
                        <p>
                          {record.teacherComment}
                          {record.sharedWithLearnerAt ? (
                            <small className="ml-2 text-neutral-500">
                              Опубликован в учебном профиле
                            </small>
                          ) : (
                            <small className="ml-2 text-neutral-500">
                              Только преподавателю
                            </small>
                          )}
                        </p>
                      ) : null}
                      {recordObservations.length > 0 ? (
                        <ol className="lesson-run-observation-history-list">
                          {recordObservations.map((observation) => {
                            const objectiveTitle =
                              observationObjectiveTitleAtTime(observation);
                            const observationEvidence =
                              groupedEvidence.get(observation.id) ?? [];
                            return (
                              <li key={observation.id}>
                                <div>
                                  <strong>
                                    {observation.componentPositionAtTime}.{" "}
                                    {observation.componentLabelAtTime}
                                  </strong>
                                  <span>{ratingLabel(observation.rating)}</span>
                                </div>
                                {observation.correctedFromObservationId ? (
                                  <small className="text-sky-700">
                                    Явное исправление предыдущего результата
                                  </small>
                                ) : null}
                                {objectiveTitle ? (
                                  <p>
                                    <strong>
                                      Учебная цель в момент наблюдения:
                                    </strong>{" "}
                                    {objectiveTitle}
                                  </p>
                                ) : null}
                                <p>{observation.observableCriterionAtTime}</p>
                                {observation.privateNote ? (
                                  <small>
                                    Личная заметка: {observation.privateNote}
                                  </small>
                                ) : null}
                                {observationEvidence.map((item) => (
                                  <small
                                    key={item.id}
                                    className="block text-emerald-800"
                                    data-learning-evidence="true"
                                  >
                                    Свидетельство профиля:{" "}
                                    {evidenceDirectionLabel(item)} ·{" "}
                                    {formatRunDateTime(item.finalizedAt)}
                                  </small>
                                ))}
                              </li>
                            );
                          })}
                        </ol>
                      ) : null}
                      <CorrectionAuditList corrections={recordCorrections} />
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </article>
        );
      })}
    </section>
  );
}
