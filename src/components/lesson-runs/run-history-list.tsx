import { CalendarDays, CheckCircle2, RotateCcw, Users } from "lucide-react";
import {
  formatRunDateTime,
  lessonRunState,
  lessonRunStateLabel,
} from "@/components/lesson-runs/lesson-run-format";
import type { LessonRun } from "@/modules/lesson-runs/domain";
import type { LessonComponentObservation } from "@/modules/learning-activities";
import { ratingLabel } from "@/components/learning-activities/observation-format";

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

export function RunHistoryList({
  runs,
  emptyTitle = "Проведений пока нет",
  emptyDescription = "После завершения урока здесь появятся отчёт преподавателя и индивидуальные результаты учеников.",
  showLessonTitle = false,
  observations = [],
}: {
  runs: LessonRun[];
  emptyTitle?: string;
  emptyDescription?: string;
  showLessonTitle?: boolean;
  observations?: LessonComponentObservation[];
}) {
  const orderedRuns = [...runs].sort(
    (left, right) =>
      new Date(right.scheduledAt).getTime() -
      new Date(left.scheduledAt).getTime(),
  );
  const groupedObservations = observationsByRecord(observations);

  if (orderedRuns.length === 0) {
    return (
      <section className="workspace-surface workspace-empty-panel">
        <span className="workspace-empty-icon workspace-empty-icon-pink">
          <CalendarDays aria-hidden="true" />
        </span>
        <h2>{emptyTitle}</h2>
        <p>{emptyDescription}</p>
      </section>
    );
  }

  return (
    <section className="lesson-run-history" aria-label="История проведений">
      {orderedRuns.map((run) => {
        const state = lessonRunState(run);
        const finalRecords = run.records.filter((record) => record.occurredAt);
        const runObservations = finalRecords.flatMap(
          (record) => groupedObservations.get(record.id) ?? [],
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
                </span>
              </div>
            ) : null}

            {finalRecords.length > 0 ? (
              <ul className="lesson-run-record-list">
                {finalRecords.map((record) => {
                  const recordObservations =
                    groupedObservations.get(record.id) ?? [];
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
                          {recordObservations.map((observation) => (
                            <li key={observation.id}>
                              <div>
                                <strong>
                                  {observation.componentPositionAtTime}.{" "}
                                  {observation.componentLabelAtTime}
                                </strong>
                                <span>{ratingLabel(observation.rating)}</span>
                              </div>
                              <p>{observation.observableCriterionAtTime}</p>
                              {observation.privateNote ? (
                                <small>
                                  Личная заметка: {observation.privateNote}
                                </small>
                              ) : null}
                            </li>
                          ))}
                        </ol>
                      ) : null}
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
