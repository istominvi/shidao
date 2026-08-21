"use client";

import { LoaderCircle, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  ChoiceQuizSubmitError,
  submitLearnerChoiceQuizAttempt,
} from "./choice-quiz-client";
import {
  learnerChoiceQuizDraftFromExecution,
  learnerChoiceQuizExecutionAdvancesDraft,
  prepareLearnerChoiceQuizSubmission,
  type LearnerChoiceQuizDraft,
} from "./learner-choice-quiz-draft";
import { componentRegistry } from "@/modules/course-builder/registry/contracts";
import type { ChoiceQuizLearnerExecution } from "@/modules/choice-quiz/contracts";
import styles from "./learner-choice-quiz.module.css";

type QuizComponent = {
  key: string;
  payload: Record<string, unknown>;
  placement: Record<string, unknown>;
};

function focusSoon(target: React.RefObject<HTMLElement | null>) {
  requestAnimationFrame(() => target.current?.focus());
}

export function LearnerChoiceQuiz({
  lessonRunId,
  cursorRevision,
  component,
  execution,
  draft,
  onDraftChange,
  onLiveStateInvalidated,
}: {
  lessonRunId: string;
  cursorRevision: number;
  component: QuizComponent;
  execution: ChoiceQuizLearnerExecution;
  draft: LearnerChoiceQuizDraft;
  onDraftChange: (issueRef: string, draft: LearnerChoiceQuizDraft) => void;
  onLiveStateInvalidated: () => void;
}) {
  const payload =
    componentRegistry.choice_quiz.activityFacet.learnerDeliverySchema.parse(
      component.payload,
    );
  const placement = componentRegistry.choice_quiz.placementSchema.parse(
    component.placement,
  );
  const [currentExecution, setCurrentExecution] = useState(execution);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const statusRef = useRef<HTMLDivElement>(null);
  const fieldsetRef = useRef<HTMLFieldSetElement>(null);

  useEffect(() => {
    const currentSubmittedAt =
      currentExecution.latestFeedback?.submittedAt ?? null;
    const incomingSubmittedAt = execution.latestFeedback?.submittedAt ?? null;
    const advanced =
      execution.attemptCount > currentExecution.attemptCount ||
      (execution.attemptCount === currentExecution.attemptCount &&
        incomingSubmittedAt !== null &&
        incomingSubmittedAt !== currentSubmittedAt);
    if (advanced && execution.attemptCount >= currentExecution.attemptCount) {
      setCurrentExecution(execution);
      setSubmitting(false);
      setSubmitError(null);
    }
    if (learnerChoiceQuizExecutionAdvancesDraft(execution, draft)) {
      onDraftChange(
        execution.issueRef,
        learnerChoiceQuizDraftFromExecution(execution),
      );
    }
  }, [currentExecution, draft, execution, onDraftChange]);

  const selectedIds = draft.selectedOptionIds;
  const pendingSubmission = draft.pendingSubmission;
  const draftingRetry = draft.draftingRetry;
  const latestFeedback = draftingRetry ? null : currentExecution.latestFeedback;
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const revealedCorrectSet = useMemo(
    () => new Set(latestFeedback?.reveal?.correctOptionIds ?? []),
    [latestFeedback?.reveal?.correctOptionIds],
  );
  const validSelectedIds = payload.options
    .filter((option) => selectedSet.has(option.id))
    .map((option) => option.id);
  const controlsLocked =
    submitting || pendingSubmission !== null || latestFeedback !== null;
  const canDraft = currentExecution.canSubmit && !controlsLocked;
  const assessment = currentExecution.maxAttempts === 1;
  const displayedAttemptNumber = latestFeedback
    ? latestFeedback.attemptNumber
    : Math.min(currentExecution.attemptCount + 1, currentExecution.maxAttempts);

  function choose(optionId: string) {
    if (!canDraft) return;
    setSubmitError(null);
    if (!payload.allowMultiple) {
      onDraftChange(currentExecution.issueRef, {
        ...draft,
        selectedOptionIds: [optionId],
      });
      return;
    }
    onDraftChange(currentExecution.issueRef, {
      ...draft,
      selectedOptionIds: selectedIds.includes(optionId)
        ? selectedIds.filter((id) => id !== optionId)
        : [...selectedIds, optionId],
    });
  }

  async function submit() {
    if (submitting || validSelectedIds.length === 0) return;
    const prepared = prepareLearnerChoiceQuizSubmission(
      draft,
      validSelectedIds,
      () => globalThis.crypto.randomUUID(),
    );
    const request = prepared.request;
    onDraftChange(currentExecution.issueRef, prepared.draft);
    setSubmitting(true);
    setSubmitError(null);

    try {
      const nextExecution = await submitLearnerChoiceQuizAttempt(
        lessonRunId,
        currentExecution.issueRef,
        {
          idempotencyKey: request.idempotencyKey,
          cursorRevision,
          selectedOptionIds: request.selectedOptionIds,
        },
      );
      setCurrentExecution(nextExecution);
      onDraftChange(
        nextExecution.issueRef,
        learnerChoiceQuizDraftFromExecution(nextExecution),
      );
      focusSoon(statusRef);
    } catch (error) {
      const clientError =
        error instanceof ChoiceQuizSubmitError
          ? error
          : new ChoiceQuizSubmitError("unavailable", 0);
      setSubmitError(clientError.message);
      if (
        clientError.failure === "stale" ||
        clientError.failure === "login" ||
        clientError.failure === "denied"
      ) {
        onLiveStateInvalidated();
      }
      focusSoon(statusRef);
    } finally {
      setSubmitting(false);
    }
  }

  function startRetry() {
    if (!currentExecution.canSubmit || !latestFeedback?.canRetry) return;
    onDraftChange(currentExecution.issueRef, {
      ...draft,
      selectedOptionIds: [],
      pendingSubmission: null,
      draftingRetry: true,
    });
    setSubmitError(null);
    focusSoon(fieldsetRef);
  }

  const feedbackTone = submitError
    ? "error"
    : latestFeedback?.isCorrect
      ? "success"
      : latestFeedback
        ? "incorrect"
        : "neutral";

  return (
    <section
      className={styles.quiz}
      data-width={placement.width}
      data-compact={placement.compact}
      data-choice-quiz-execution="issued"
      aria-label="Тест с выбором ответа"
    >
      <div className={styles.heading}>
        <span>{assessment ? "Проверочная работа" : "Практика"}</span>
        <span>
          Попытка {displayedAttemptNumber} из {currentExecution.maxAttempts}
        </span>
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <fieldset
          ref={fieldsetRef}
          className={styles.fieldset}
          tabIndex={-1}
          disabled={controlsLocked || !currentExecution.canSubmit}
          aria-describedby={`${component.key}-choice-quiz-instruction ${component.key}-choice-quiz-status`}
        >
          <legend className={styles.legend}>{payload.question}</legend>
          <p
            id={`${component.key}-choice-quiz-instruction`}
            className={styles.instruction}
          >
            {payload.allowMultiple
              ? "Выберите все подходящие варианты. Частичного зачёта нет."
              : "Выберите один вариант."}
          </p>
          <div className={styles.options}>
            {payload.options.map((option) => {
              const selected = selectedSet.has(option.id);
              const revealedCorrect = revealedCorrectSet.has(option.id);
              const revealedIncorrect =
                latestFeedback?.reveal !== null &&
                latestFeedback !== null &&
                selected &&
                !revealedCorrect;
              return (
                <label
                  key={option.id}
                  className={styles.option}
                  data-selected={selected}
                  data-revealed-correct={revealedCorrect}
                  data-revealed-incorrect={revealedIncorrect}
                >
                  <input
                    type={payload.allowMultiple ? "checkbox" : "radio"}
                    name={`choice-quiz-${component.key}`}
                    checked={selected}
                    onChange={() => choose(option.id)}
                  />
                  <span className={styles.optionText}>
                    <span>{option.label}</span>
                    {revealedCorrect ? (
                      <span className={styles.optionResult}>
                        Правильный вариант
                      </span>
                    ) : revealedIncorrect ? (
                      <span className={styles.optionResult}>
                        Вы выбрали этот вариант
                      </span>
                    ) : null}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <div className={styles.actions}>
          {latestFeedback?.canRetry && currentExecution.canSubmit ? (
            <Button type="button" onClick={startRetry}>
              <RotateCcw aria-hidden="true" />
              Попробовать ещё раз
            </Button>
          ) : latestFeedback === null ? (
            <Button
              type="submit"
              variant="inverse"
              disabled={submitting || validSelectedIds.length === 0}
              aria-describedby={`${component.key}-choice-quiz-status`}
            >
              {submitting ? (
                <LoaderCircle className={styles.spin} aria-hidden="true" />
              ) : null}
              {submitting
                ? "Сохраняем…"
                : pendingSubmission
                  ? "Повторить отправку"
                  : "Проверить ответ"}
            </Button>
          ) : null}
        </div>
      </form>

      <div
        ref={statusRef}
        id={`${component.key}-choice-quiz-status`}
        className={styles.status}
        data-tone={feedbackTone}
        role={submitError ? "alert" : "status"}
        aria-live={submitError ? "assertive" : "polite"}
        aria-atomic="true"
        tabIndex={-1}
      >
        {submitError ? (
          <p>{submitError}</p>
        ) : submitting ? (
          <p>Проверяем и сохраняем ответ на сервере.</p>
        ) : latestFeedback ? (
          <>
            <p>
              <strong>
                {latestFeedback.isCorrect
                  ? "Верно."
                  : latestFeedback.canRetry
                    ? "Пока неверно."
                    : "Неверно."}
              </strong>{" "}
              Результат сохранён: {latestFeedback.score} из 1.
            </p>
            {latestFeedback.canRetry ? (
              <p>
                Можно попробовать ещё раз. Осталось попыток:{" "}
                {currentExecution.remainingAttempts}.
              </p>
            ) : null}
            {latestFeedback.reveal?.explanation ? (
              <p className={styles.explanation}>
                {latestFeedback.reveal.explanation}
              </p>
            ) : null}
          </>
        ) : draftingRetry ? (
          <p>Выберите новый ответ. Следующая отправка создаст новую попытку.</p>
        ) : (
          <p>Ответ проверит сервер после явной отправки.</p>
        )}
      </div>
    </section>
  );
}
