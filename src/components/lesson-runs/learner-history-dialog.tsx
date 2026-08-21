"use client";

import {
  CheckCircle2,
  History,
  LoaderCircle,
  PencilLine,
  RotateCcw,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { loadLearnerHistory } from "@/components/lesson-runs/lesson-run-client";
import { formatRunDateTime } from "@/components/lesson-runs/lesson-run-format";
import { DialogShell } from "@/components/ui/dialog-shell";
import { Button } from "@/components/ui/button";
import type {
  LearnerProfile,
  LearningRecord,
} from "@/modules/lesson-runs/domain";
import type {
  LearningEvidence,
  LessonObservationCorrection,
  LessonComponentObservation,
  LearningRecommendationType,
  TeacherLearnerActivityProfile,
} from "@/modules/learning-activities";
import {
  observationObjectiveTitleAtTime,
  ratingLabel,
} from "@/components/learning-activities/observation-format";
import {
  correctTeacherObservation,
  loadTeacherActivityProfile,
  setTeacherRecommendationOverride,
} from "@/components/learning-activities/activity-profile-client";
import { TeacherActivityProfileSections } from "@/components/learning-activities/teacher-activity-profile-sections";
import { CorrectionAuditList } from "@/components/learning-activities/correction-audit-list";
import {
  currentEvidenceByObservation,
  evidenceDirectionLabel,
} from "@/components/learning-activities/evidence-history-format";

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
  const [observations, setObservations] = useState<
    LessonComponentObservation[]
  >([]);
  const [corrections, setCorrections] = useState<LessonObservationCorrection[]>(
    [],
  );
  const [correctionsTruncated, setCorrectionsTruncated] = useState(false);
  const [correctionsUnavailable, setCorrectionsUnavailable] = useState(false);
  const [correctionsLoading, setCorrectionsLoading] = useState(false);
  const [correctionsError, setCorrectionsError] = useState<string | null>(null);
  const [evidence, setEvidence] = useState<LearningEvidence[]>([]);
  const [evidenceUnavailable, setEvidenceUnavailable] = useState(false);
  const [evidenceLoading, setEvidenceLoading] = useState(false);
  const [evidenceError, setEvidenceError] = useState<string | null>(null);
  const [activityProfile, setActivityProfile] =
    useState<TeacherLearnerActivityProfile | null>(null);
  const [correctionTarget, setCorrectionTarget] =
    useState<LessonComponentObservation | null>(null);
  const [correctionRating, setCorrectionRating] =
    useState<LessonComponentObservation["rating"]>("independent");
  const [correctionNote, setCorrectionNote] = useState("");
  const [correctionReason, setCorrectionReason] = useState("");
  const [correctionIdempotencyKey, setCorrectionIdempotencyKey] = useState<
    string | null
  >(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activityError, setActivityError] = useState<string | null>(null);
  const [activityLoading, setActivityLoading] = useState(false);
  const loadRequestRef = useRef(0);

  const load = useCallback(async () => {
    const requestId = ++loadRequestRef.current;
    setRecords(null);
    setObservations([]);
    setCorrections([]);
    setCorrectionsTruncated(false);
    setCorrectionsUnavailable(false);
    setCorrectionsLoading(false);
    setCorrectionsError(null);
    setEvidence([]);
    setEvidenceUnavailable(false);
    setEvidenceLoading(false);
    setEvidenceError(null);
    setActivityProfile(null);
    setCorrectionTarget(null);
    setCorrectionIdempotencyKey(null);
    setError(null);
    setActivityError(null);
    setActivityLoading(true);
    void loadTeacherActivityProfile(profile.id)
      .then((nextActivityProfile) => {
        if (requestId !== loadRequestRef.current) return;
        setActivityProfile(nextActivityProfile);
      })
      .catch((caught: unknown) => {
        if (requestId !== loadRequestRef.current) return;
        setActivityError(
          caught instanceof Error
            ? caught.message
            : "Не удалось загрузить навыки и рекомендации.",
        );
      })
      .finally(() => {
        if (requestId === loadRequestRef.current) setActivityLoading(false);
      });
    try {
      const history = await loadLearnerHistory(profile.id);
      if (requestId !== loadRequestRef.current) return;
      setRecords(history.records);
      setObservations(history.observations);
      setCorrections(history.corrections);
      setCorrectionsTruncated(history.correctionsTruncated);
      setCorrectionsUnavailable(history.correctionsUnavailable);
      setEvidence(history.evidence);
      setEvidenceUnavailable(history.evidenceUnavailable);
    } catch (caught) {
      if (requestId !== loadRequestRef.current) return;
      setError(
        caught instanceof Error
          ? caught.message
          : "Не удалось загрузить историю обучения.",
      );
    }
  }, [profile.id]);

  const retryEvidence = useCallback(async () => {
    const requestId = loadRequestRef.current;
    setEvidenceLoading(true);
    setEvidenceError(null);
    try {
      const nextHistory = await loadLearnerHistory(profile.id);
      if (requestId !== loadRequestRef.current) return;
      setRecords(nextHistory.records);
      setObservations(nextHistory.observations);
      setCorrections(nextHistory.corrections);
      setCorrectionsTruncated(nextHistory.correctionsTruncated);
      setCorrectionsUnavailable(nextHistory.correctionsUnavailable);
      setEvidence(nextHistory.evidence);
      setEvidenceUnavailable(nextHistory.evidenceUnavailable);
    } catch (caught) {
      if (requestId !== loadRequestRef.current) return;
      setEvidenceUnavailable(true);
      setEvidenceError(
        caught instanceof Error
          ? caught.message
          : "Не удалось повторно загрузить свидетельства профиля.",
      );
    } finally {
      if (requestId === loadRequestRef.current) setEvidenceLoading(false);
    }
  }, [profile.id]);

  const retryCorrections = useCallback(async () => {
    const requestId = loadRequestRef.current;
    setCorrectionsLoading(true);
    setCorrectionsError(null);
    try {
      const nextHistory = await loadLearnerHistory(profile.id);
      if (requestId !== loadRequestRef.current) return;
      setRecords(nextHistory.records);
      setObservations(nextHistory.observations);
      setCorrections(nextHistory.corrections);
      setCorrectionsTruncated(nextHistory.correctionsTruncated);
      setCorrectionsUnavailable(nextHistory.correctionsUnavailable);
      setEvidence(nextHistory.evidence);
      setEvidenceUnavailable(nextHistory.evidenceUnavailable);
    } catch (caught) {
      if (requestId !== loadRequestRef.current) return;
      setCorrectionsUnavailable(true);
      setCorrectionsError(
        caught instanceof Error
          ? caught.message
          : "Не удалось повторно загрузить журнал исправлений.",
      );
    } finally {
      if (requestId === loadRequestRef.current) setCorrectionsLoading(false);
    }
  }, [profile.id]);

  const retryActivityProfile = useCallback(async () => {
    const requestId = loadRequestRef.current;
    setActivityError(null);
    setActivityLoading(true);
    try {
      const nextActivityProfile = await loadTeacherActivityProfile(profile.id);
      if (requestId !== loadRequestRef.current) return;
      setActivityProfile(nextActivityProfile);
    } catch (caught) {
      if (requestId !== loadRequestRef.current) return;
      setActivityError(
        caught instanceof Error
          ? caught.message
          : "Не удалось загрузить навыки и рекомендации.",
      );
    } finally {
      if (requestId === loadRequestRef.current) setActivityLoading(false);
    }
  }, [profile.id]);

  useEffect(() => {
    let active = true;
    void load().catch((caught: unknown) => {
      if (!active) return;
      setError(
        caught instanceof Error
          ? caught.message
          : "Не удалось загрузить учебный профиль.",
      );
    });
    return () => {
      active = false;
      loadRequestRef.current += 1;
    };
  }, [load]);

  function openCorrection(observation: LessonComponentObservation) {
    setCorrectionTarget(observation);
    setCorrectionRating(observation.rating);
    setCorrectionNote(observation.privateNote ?? "");
    setCorrectionReason("");
    setCorrectionIdempotencyKey(globalThis.crypto.randomUUID());
    setError(null);
  }

  async function submitCorrection() {
    if (
      !correctionTarget ||
      !correctionIdempotencyKey ||
      !correctionReason.trim() ||
      busy
    )
      return;
    setBusy(true);
    setError(null);
    let correctionSaved = false;
    try {
      await correctTeacherObservation(profile.id, {
        observationId: correctionTarget.id,
        expectedLearningRecordId: correctionTarget.learningRecordId,
        rating: correctionRating,
        privateNote: correctionNote.trim() || null,
        correctionReason: correctionReason.trim(),
        idempotencyKey: correctionIdempotencyKey,
      });
      correctionSaved = true;
      setCorrectionTarget(null);
      setCorrectionIdempotencyKey(null);
      await load();
    } catch (caught) {
      setError(
        correctionSaved
          ? "Исправление сохранено, но профиль не удалось обновить. Повторите загрузку."
          : caught instanceof Error
            ? caught.message
            : "Не удалось сохранить исправление.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function setOverride(
    state: TeacherLearnerActivityProfile["states"][number],
    action: "replace" | "dismiss" | "clear",
    recommendationType: LearningRecommendationType | null,
    privateReason: string | null,
  ) {
    if (busy || state.status === "no_data" || state.stateId === null) return;
    setBusy(true);
    setError(null);
    let overrideSaved = false;
    try {
      await setTeacherRecommendationOverride(profile.id, {
        sourceLearningObjectiveIdAtTime: state.sourceLearningObjectiveIdAtTime,
        action,
        recommendationType,
        privateReason,
        expectedStateUpdatedAt: state.evaluatedAt,
      });
      overrideSaved = true;
      await load();
    } catch (caught) {
      setError(
        overrideSaved
          ? "Решение сохранено, но профиль не удалось обновить. Повторите загрузку."
          : caught instanceof Error
            ? caught.message
            : "Не удалось сохранить решение преподавателя.",
      );
    } finally {
      setBusy(false);
    }
  }

  const groupedObservations = observationsByRecord(observations);
  const groupedCorrections = correctionsByRecord(corrections);
  const groupedEvidence = currentEvidenceByObservation(evidence);

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
      {records && (evidenceUnavailable || evidenceError) ? (
        <div
          className="app-alert app-alert-error flex flex-wrap items-center justify-between gap-3"
          role="alert"
        >
          <span>
            История и наблюдения доступны, но свидетельства профиля временно не
            загружены{evidenceError ? `: ${evidenceError}` : "."}
          </span>
          <Button
            type="button"
            variant="secondary"
            disabled={evidenceLoading}
            onClick={() => void retryEvidence()}
          >
            {evidenceLoading ? (
              <LoaderCircle
                className="h-4 w-4 animate-spin"
                aria-hidden="true"
              />
            ) : null}
            Повторить загрузку свидетельств
          </Button>
        </div>
      ) : null}
      {records && (correctionsUnavailable || correctionsError) ? (
        <div
          className="app-alert app-alert-error flex flex-wrap items-center justify-between gap-3"
          role="alert"
        >
          <span>
            История доступна, но журнал исправлений временно не загружен. Пустой
            журнал сейчас не означает отсутствие исправлений
            {correctionsError ? `: ${correctionsError}` : "."}
          </span>
          <Button
            type="button"
            variant="secondary"
            disabled={correctionsLoading}
            onClick={() => void retryCorrections()}
          >
            {correctionsLoading ? (
              <LoaderCircle
                className="h-4 w-4 animate-spin"
                aria-hidden="true"
              />
            ) : null}
            Повторить загрузку журнала
          </Button>
        </div>
      ) : null}
      {records && !correctionsUnavailable && correctionsTruncated ? (
        <p className="app-alert app-alert-info" role="status">
          Показаны последние 200 исправлений. Более ранние записи остаются в
          защищённом журнале.
        </p>
      ) : null}
      {records?.length ? (
        <ol className="learner-history-list">
          {records.map((record) => {
            const recordObservations = groupedObservations.get(record.id) ?? [];
            const recordCorrections = groupedCorrections.get(record.id) ?? [];
            return (
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
                      <CheckCircle2
                        className="h-3.5 w-3.5"
                        aria-hidden="true"
                      />
                      Был на уроке
                    </span>
                  ) : (
                    <span className="lesson-run-history-state lesson-run-status-cancelled">
                      Отсутствовал
                    </span>
                  )}
                </div>
                {record.teacherComment ? <p>{record.teacherComment}</p> : null}
                {record.actualDurationMinutesAtTime != null ? (
                  <p className="text-sm text-neutral-500">
                    Фактическая длительность:{" "}
                    {record.actualDurationMinutesAtTime} мин.
                  </p>
                ) : null}
                {recordObservations.length > 0 ? (
                  <ol className="learner-observation-history-list">
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
                              <strong>Учебная цель в момент наблюдения:</strong>{" "}
                              {objectiveTitle}
                            </p>
                          ) : null}
                          <p>{observation.observableCriterionAtTime}</p>
                          {observation.privateNote ? (
                            <small>
                              Личная заметка преподавателя:{" "}
                              {observation.privateNote}
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
                          <div className="mt-3">
                            <Button
                              type="button"
                              variant="ghost"
                              disabled={busy}
                              onClick={() => openCorrection(observation)}
                            >
                              <PencilLine
                                className="h-4 w-4"
                                aria-hidden="true"
                              />
                              Исправить итог
                            </Button>
                          </div>
                          {correctionTarget?.id === observation.id ? (
                            <div className="mt-3 grid gap-3 rounded-xl bg-neutral-50 p-3">
                              <p className="text-sm font-semibold text-neutral-950">
                                Явное исправление завершённого наблюдения
                              </p>
                              <label>
                                <span className="field-label">
                                  Исправленный результат
                                </span>
                                <select
                                  className="field-input"
                                  value={correctionRating}
                                  disabled={busy}
                                  onChange={(event) =>
                                    setCorrectionRating(
                                      event.target
                                        .value as LessonComponentObservation["rating"],
                                    )
                                  }
                                >
                                  <option value="independent">
                                    Самостоятельно
                                  </option>
                                  <option value="with_support">
                                    С поддержкой
                                  </option>
                                  <option value="not_yet">
                                    Пока не получилось
                                  </option>
                                </select>
                              </label>
                              <label>
                                <span className="field-label">
                                  Личная заметка
                                </span>
                                <textarea
                                  className="field-input"
                                  maxLength={500}
                                  value={correctionNote}
                                  disabled={busy}
                                  onChange={(event) =>
                                    setCorrectionNote(event.target.value)
                                  }
                                />
                              </label>
                              <label>
                                <span className="field-label">
                                  Причина исправления
                                </span>
                                <textarea
                                  className="field-input"
                                  required
                                  maxLength={500}
                                  value={correctionReason}
                                  disabled={busy}
                                  placeholder="Например, отметка была выбрана по ошибке"
                                  onChange={(event) =>
                                    setCorrectionReason(event.target.value)
                                  }
                                />
                              </label>
                              <p className="text-xs text-neutral-500">
                                Исходная запись останется в истории как
                                заменённая; новая станет явным исправлением.
                              </p>
                              <div className="flex flex-wrap gap-2">
                                <Button
                                  type="button"
                                  disabled={busy || !correctionReason.trim()}
                                  onClick={() => void submitCorrection()}
                                >
                                  {busy ? (
                                    <LoaderCircle
                                      className="h-4 w-4 animate-spin"
                                      aria-hidden="true"
                                    />
                                  ) : null}
                                  Сохранить исправление
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  disabled={busy}
                                  onClick={() => {
                                    setCorrectionTarget(null);
                                    setCorrectionIdempotencyKey(null);
                                  }}
                                >
                                  Отмена
                                </Button>
                              </div>
                            </div>
                          ) : null}
                        </li>
                      );
                    })}
                  </ol>
                ) : null}
                <CorrectionAuditList corrections={recordCorrections} />
              </li>
            );
          })}
        </ol>
      ) : null}
      {activityProfile ? (
        <TeacherActivityProfileSections
          profile={activityProfile}
          busy={busy}
          onOverride={setOverride}
        />
      ) : null}
      {activityLoading ? (
        <p
          className="flex items-center gap-2 py-4 text-sm text-neutral-600"
          role="status"
        >
          <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
          Загружаем навыки и рекомендации…
        </p>
      ) : null}
      {activityError ? (
        <div
          className="app-alert app-alert-error flex flex-wrap items-center justify-between gap-3"
          role="alert"
        >
          <span>
            История доступна, но навыки и рекомендации временно не загружены:{" "}
            {activityError}
          </span>
          <Button
            type="button"
            variant="secondary"
            onClick={() => void retryActivityProfile()}
          >
            Повторить
          </Button>
        </div>
      ) : null}
    </div>
  );
}
