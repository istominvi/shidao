"use client";

import {
  CheckCircle2,
  CircleAlert,
  History,
  LoaderCircle,
  RefreshCw,
  UserRound,
  XCircle,
} from "lucide-react";
import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Button } from "@/components/ui/button";
import type {
  ChoiceQuizTeacherHistory,
  CorrectChoiceQuizEvaluationInput,
} from "@/modules/choice-quiz/contracts";
import {
  correctTeacherChoiceQuizEvaluation,
  loadTeacherChoiceQuizHistory,
} from "./choice-quiz-history-client";
import {
  choiceQuizRoleLabel,
  choiceQuizSupportLabel,
  formatChoiceQuizHistoryTime,
  groupChoiceQuizAttemptHistory,
} from "./choice-quiz-history-format";
import styles from "./run-choice-quiz-history-panel.module.css";

function historyErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Не удалось загрузить историю ответов.";
}

function EvaluationCorrectionForm({
  evaluation,
  onSaved,
}: {
  evaluation: ChoiceQuizTeacherHistory["items"][number];
  onSaved: () => Promise<void>;
}) {
  const [isCorrect, setIsCorrect] = useState(!evaluation.isCorrect);
  const [reason, setReason] = useState("");
  const [pendingRequest, setPendingRequest] =
    useState<CorrectChoiceQuizEvaluationInput | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const radioName = `choice-quiz-correction-${evaluation.evaluationId}`;

  const changeResult = (next: boolean) => {
    setIsCorrect(next);
    setPendingRequest(null);
    setError(null);
  };

  const changeReason = (next: string) => {
    setReason(next);
    setPendingRequest(null);
    setError(null);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedReason = reason.trim();
    if (
      normalizedReason.length < 1 ||
      normalizedReason.length > 500 ||
      isCorrect === evaluation.isCorrect
    ) {
      setError("Выберите новый результат и укажите причину исправления.");
      return;
    }

    const request =
      pendingRequest ??
      ({
        idempotencyKey: crypto.randomUUID(),
        isCorrect,
        reason: normalizedReason,
      } satisfies CorrectChoiceQuizEvaluationInput);
    setPendingRequest(request);
    setSubmitting(true);
    setError(null);
    try {
      await correctTeacherChoiceQuizEvaluation(
        evaluation.evaluationId,
        request,
      );
      setPendingRequest(null);
      await onSaved();
    } catch (caught) {
      setError(historyErrorMessage(caught));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <details className={styles.correctionEditor}>
      <summary>Исправить текущую оценку</summary>
      <form onSubmit={(event) => void submit(event)}>
        <fieldset disabled={submitting}>
          <legend>Новый результат</legend>
          <label>
            <input
              type="radio"
              name={radioName}
              checked={isCorrect}
              onChange={() => changeResult(true)}
            />
            Верно
          </label>
          <label>
            <input
              type="radio"
              name={radioName}
              checked={!isCorrect}
              onChange={() => changeResult(false)}
            />
            Неверно
          </label>
        </fieldset>
        <label className={styles.reasonField}>
          Причина исправления
          <textarea
            value={reason}
            onChange={(event) => changeReason(event.target.value)}
            minLength={1}
            maxLength={500}
            rows={3}
            disabled={submitting}
            required
          />
        </label>
        {error ? (
          <p className={styles.correctionError} role="alert">
            {error}
          </p>
        ) : null}
        <Button type="submit" disabled={submitting}>
          {submitting ? "Сохраняем…" : "Сохранить исправление"}
        </Button>
        <p className={styles.retryNote}>
          При сетевой ошибке повтор сохраняет тот же ключ и не создаёт дубль.
        </p>
      </form>
    </details>
  );
}

export function RunChoiceQuizHistoryPanel({
  lessonRunId,
}: {
  lessonRunId: string;
}) {
  const [history, setHistory] = useState<ChoiceQuizTeacherHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [correctionAnnouncement, setCorrectionAnnouncement] = useState<
    string | null
  >(null);
  const requestVersionRef = useRef(0);

  const load = useCallback(async () => {
    const requestVersion = ++requestVersionRef.current;
    setLoading(true);
    setError(null);
    try {
      const next = await loadTeacherChoiceQuizHistory(lessonRunId);
      if (requestVersion === requestVersionRef.current) setHistory(next);
    } catch (caught) {
      if (requestVersion === requestVersionRef.current) {
        setError(historyErrorMessage(caught));
      }
    } finally {
      if (requestVersion === requestVersionRef.current) setLoading(false);
    }
  }, [lessonRunId]);

  useEffect(() => {
    setHistory(null);
    setCorrectionAnnouncement(null);
    void load();
    return () => {
      requestVersionRef.current += 1;
    };
  }, [load]);

  const attempts = useMemo(
    () => groupChoiceQuizAttemptHistory(history?.items ?? []),
    [history],
  );

  if (loading && !history) {
    return (
      <section
        className={styles.panel}
        aria-labelledby="choice-quiz-history-title"
        aria-busy="true"
        role="status"
      >
        <LoaderCircle className={styles.spin} aria-hidden="true" />
        <div>
          <h2 id="choice-quiz-history-title">Ответы на тесты</h2>
          <p>Загружаем сохранённые попытки и оценки.</p>
        </div>
      </section>
    );
  }

  if (!history) {
    return (
      <section
        className={styles.panel}
        aria-labelledby="choice-quiz-history-title"
      >
        <CircleAlert aria-hidden="true" />
        <div>
          <h2 id="choice-quiz-history-title">Ответы на тесты недоступны</h2>
          <p role="alert">{error}</p>
          <Button variant="secondary" onClick={() => void load()}>
            <RefreshCw aria-hidden="true" />
            Повторить
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section
      className={styles.panel}
      aria-labelledby="choice-quiz-history-title"
      aria-busy={loading}
    >
      <header className={styles.header}>
        <div className={styles.titleGroup}>
          <span className={styles.icon} aria-hidden="true">
            <History />
          </span>
          <div>
            <p className={styles.eyebrow}>LA‑M5 · сохранённые ответы</p>
            <h2 id="choice-quiz-history-title">Ответы на тесты</h2>
            <p>
              Попыток: {attempts.length}. Оценок с учётом исправлений:{" "}
              {history.items.length}.
            </p>
          </div>
        </div>
        <Button
          variant="secondary"
          disabled={loading}
          onClick={() => void load()}
          aria-label="Обновить историю ответов на тесты"
        >
          <RefreshCw
            className={loading ? styles.spin : undefined}
            aria-hidden="true"
          />
          {loading ? "Обновляем…" : "Обновить"}
        </Button>
      </header>

      {error ? (
        <p className={styles.error} role="alert">
          Историю не удалось обновить. Показана последняя загруженная версия:{" "}
          {error}
        </p>
      ) : null}

      {correctionAnnouncement ? (
        <p
          className={styles.correctionAnnouncement}
          role="status"
          aria-live="polite"
        >
          {correctionAnnouncement}
        </p>
      ) : null}

      {history.truncated ? (
        <p className={styles.truncated} role="status">
          Показаны последние 5 000 оценок и исправлений. Более ранние записи не
          входят в эту компактную выборку.
        </p>
      ) : null}

      {attempts.length === 0 ? (
        <div className={styles.empty} role="status">
          <strong>Ответов пока нет</strong>
          <p>
            Здесь появятся отправленные учениками тесты с ролями «Практика» и
            «Проверочная работа» этого проведения.
          </p>
        </div>
      ) : (
        <ul
          className={styles.attemptList}
          aria-label="История ответов учеников"
        >
          {attempts.map((attempt, attemptIndex) => (
            <li key={attempt.key}>
              <article
                className={styles.attemptCard}
                aria-labelledby={`choice-quiz-attempt-${attemptIndex}`}
              >
                <header className={styles.attemptHeader}>
                  <div>
                    <p className={styles.learner}>
                      <UserRound aria-hidden="true" />
                      Ученик: {attempt.learnerDisplayName}
                    </p>
                    <h3 id={`choice-quiz-attempt-${attemptIndex}`}>
                      {attempt.question}
                    </h3>
                  </div>
                  <span
                    className={styles.roleBadge}
                    data-role={attempt.activityRole}
                  >
                    {choiceQuizRoleLabel(attempt.activityRole)}
                  </span>
                </header>

                {attempt.objectiveTitleAtTime ? (
                  <p className={styles.objective}>
                    Учебная цель в момент ответа: {attempt.objectiveTitleAtTime}
                  </p>
                ) : null}

                <dl className={styles.attemptMeta}>
                  <div>
                    <dt>Попытка</dt>
                    <dd>{attempt.attemptNumber}</dd>
                  </div>
                  <div>
                    <dt>Уровень поддержки</dt>
                    <dd>{choiceQuizSupportLabel(attempt.supportContext)}</dd>
                  </div>
                  <div>
                    <dt>Выбранный ответ</dt>
                    <dd>
                      {attempt.selectedOptions
                        .map((option) => option.label)
                        .join(", ")}
                    </dd>
                  </div>
                </dl>

                <div className={styles.chain}>
                  <h4>Цепочка оценок · {attempt.evaluations.length}</h4>
                  <ol aria-label="Исходная оценка и исправления">
                    {attempt.evaluations.map((evaluation, evaluationIndex) => {
                      const current =
                        evaluation.supersededByEvaluationId === null;
                      const correction =
                        evaluation.supersedesEvaluationId !== null;
                      return (
                        <li
                          key={evaluation.evaluationId}
                          data-current={current}
                          data-correct={evaluation.isCorrect}
                        >
                          <div className={styles.evaluationHeading}>
                            <strong>
                              {correction
                                ? `Исправление ${Math.max(1, evaluationIndex)}`
                                : "Исходная оценка"}
                            </strong>
                            <span>{current ? "Текущая" : "Заменена"}</span>
                          </div>
                          <dl className={styles.evaluationMeta}>
                            <div>
                              <dt>Результат</dt>
                              <dd>
                                {evaluation.isCorrect ? (
                                  <CheckCircle2 aria-hidden="true" />
                                ) : (
                                  <XCircle aria-hidden="true" />
                                )}
                                {evaluation.isCorrect ? "Верно" : "Неверно"}
                              </dd>
                            </div>
                            <div>
                              <dt>Балл</dt>
                              <dd>{evaluation.score} из 1</dd>
                            </div>
                            <div>
                              <dt>Раскрытие ответа</dt>
                              <dd>
                                {evaluation.revealAvailable
                                  ? "Ответ был доступен ученику"
                                  : "Ответ не был доступен"}
                              </dd>
                            </div>
                            <div>
                              <dt>Оценено</dt>
                              <dd>
                                <time dateTime={evaluation.evaluatedAt}>
                                  {formatChoiceQuizHistoryTime(
                                    evaluation.evaluatedAt,
                                  )}
                                </time>
                              </dd>
                            </div>
                          </dl>
                          {evaluation.correctionReason ? (
                            <p className={styles.correctionReason}>
                              Причина исправления: {evaluation.correctionReason}
                            </p>
                          ) : null}
                          {current ? (
                            <EvaluationCorrectionForm
                              evaluation={evaluation}
                              onSaved={async () => {
                                await load();
                                setCorrectionAnnouncement(
                                  "Исправление сохранено.",
                                );
                              }}
                            />
                          ) : null}
                        </li>
                      );
                    })}
                  </ol>
                </div>
              </article>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
