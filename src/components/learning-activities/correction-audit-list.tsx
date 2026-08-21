import { formatRunDateTime } from "@/components/lesson-runs/lesson-run-format";
import { ratingLabel } from "@/components/learning-activities/observation-format";
import type { LessonObservationCorrection } from "@/modules/learning-activities";

function privateNoteLabel(value: string | null) {
  return value ?? "без личной заметки";
}

export function CorrectionAuditList({
  corrections,
}: {
  corrections: LessonObservationCorrection[];
}) {
  if (corrections.length === 0) return null;
  return (
    <section
      className="mt-4 rounded-xl border border-sky-200 bg-sky-50/70 p-3"
      aria-label="Журнал исправлений наблюдений"
      data-observation-correction-audit="true"
    >
      <strong className="text-sm text-sky-950">Журнал исправлений</strong>
      <ol className="mt-2 grid gap-3">
        {corrections.map((correction) => (
          <li
            key={`${correction.learningRecordId}:${correction.observationId}`}
            className="rounded-lg bg-white/80 p-3 text-sm text-neutral-700"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <strong className="text-neutral-950">
                {correction.componentPositionAtTime}.{" "}
                {correction.componentLabelAtTime}
              </strong>
              <time
                className="text-xs text-neutral-500"
                dateTime={correction.correctedAt}
              >
                {formatRunDateTime(correction.correctedAt)}
              </time>
            </div>
            <p className="mt-2">
              Результат: {ratingLabel(correction.oldRating)} →{" "}
              {ratingLabel(correction.newRating)}
            </p>
            <p>
              Личная заметка: {privateNoteLabel(correction.oldPrivateNote)} →{" "}
              {privateNoteLabel(correction.newPrivateNote)}
            </p>
            <p className="mt-1">
              <strong>Причина:</strong> {correction.correctionReason}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}
