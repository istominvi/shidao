"use client";

import {
  Check,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  ClipboardCheck,
  LoaderCircle,
  LockKeyhole,
  RotateCcw,
  Sparkles,
  Users,
} from "lucide-react";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  CourseComponentRenderer,
  type SignedCourseComponentAssetMap,
} from "@/components/course-builder/component-renderers";
import { Button } from "@/components/ui/button";
import type {
  LessonComponentObservation,
  RunObservationWorkspace as RunObservationWorkspaceData,
  SaveLessonComponentObservationsInput,
} from "@/modules/learning-activities";
import { ObservationHistorySummary } from "./observation-history-summary";
import {
  componentDisplayLabel,
  formatObservationTime,
  observationRatingOptions,
  observationsForComponent,
  persistedCriterionForComponent,
  suggestObservableCriterion,
  summarizeObservations,
  type ObservationRatingValue,
} from "./observation-format";
import styles from "./run-observation-workspace.module.css";

type RowSaveStatus =
  | { kind: "idle" }
  | { kind: "pending"; message: string }
  | { kind: "saved"; message: string }
  | { kind: "error"; message: string };

type BulkDraft = {
  componentId: string;
  ratings: Record<string, ObservationRatingValue>;
};

type PendingNoteSave = {
  learningRecordId: string;
  input: SaveLessonComponentObservationsInput;
};

export type RunObservationWorkspaceHandle = {
  flushPendingChanges: () => Promise<boolean>;
};

type RunObservationWorkspaceProps = {
  workspace: RunObservationWorkspaceData;
  onSave: (
    input: SaveLessonComponentObservationsInput,
  ) => Promise<LessonComponentObservation[]>;
  onObservationsChange: (observations: LessonComponentObservation[]) => void;
  onRequestCompletion: () => void;
};

const idleStatus: RowSaveStatus = { kind: "idle" };

function own<T extends object>(value: T, key: PropertyKey) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function draftKey(componentId: string, learningRecordId: string) {
  return `${componentId}:${learningRecordId}`;
}

function sortedRecords(workspace: RunObservationWorkspaceData) {
  return [...workspace.run.records].sort((left, right) =>
    left.learnerDisplayName.localeCompare(right.learnerDisplayName, "ru"),
  );
}

export const RunObservationWorkspace = forwardRef<
  RunObservationWorkspaceHandle,
  RunObservationWorkspaceProps
>(function RunObservationWorkspace(
  { workspace, onSave, onObservationsChange, onRequestCompletion },
  ref,
) {
  const components = useMemo(
    () =>
      [...workspace.lesson.components].sort(
        (left, right) => left.position - right.position,
      ),
    [workspace.lesson.components],
  );
  const records = useMemo(() => sortedRecords(workspace), [workspace]);
  const [activeComponentId, setActiveComponentId] = useState(
    () => components[0]?.id ?? null,
  );
  const [criterionDrafts, setCriterionDrafts] = useState<
    Record<string, string>
  >({});
  const [confirmedCriteria, setConfirmedCriteria] = useState<
    Record<string, string | null>
  >({});
  const [criterionError, setCriterionError] = useState<string | null>(null);
  const [ratingDrafts, setRatingDrafts] = useState<
    Record<string, ObservationRatingValue>
  >({});
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [rowStatuses, setRowStatuses] = useState<Record<string, RowSaveStatus>>(
    {},
  );
  const [bulkDraft, setBulkDraft] = useState<BulkDraft | null>(null);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [componentNavigationPending, setComponentNavigationPending] =
    useState(false);
  const [completionFlushPending, setCompletionFlushPending] = useState(false);
  const mutationQueueRef = useRef<Promise<unknown>>(Promise.resolve());
  const pendingMutationCountRef = useRef(0);
  const rowVersionsRef = useRef<Record<string, number>>({});
  const noteTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>(
    {},
  );
  const pendingNoteSavesRef = useRef<Record<string, PendingNoteSave>>({});
  const failedInputsRef = useRef<
    Record<string, SaveLessonComponentObservationsInput>
  >({});

  useEffect(() => {
    if (
      activeComponentId &&
      components.some((component) => component.id === activeComponentId)
    ) {
      return;
    }
    setActiveComponentId(components[0]?.id ?? null);
  }, [activeComponentId, components]);

  useEffect(() => {
    const noteTimers = noteTimersRef.current;

    function guardUnfinishedWrite(event: BeforeUnloadEvent) {
      if (
        Object.keys(pendingNoteSavesRef.current).length === 0 &&
        pendingMutationCountRef.current === 0
      ) {
        return;
      }
      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", guardUnfinishedWrite);
    return () => {
      window.removeEventListener("beforeunload", guardUnfinishedWrite);
      for (const timer of Object.values(noteTimers)) {
        clearTimeout(timer);
      }
    };
  }, []);

  const activeIndex = components.findIndex(
    (component) => component.id === activeComponentId,
  );
  const activeComponent = activeIndex >= 0 ? components[activeIndex] : null;
  const activeObservations = useMemo(
    () =>
      activeComponent
        ? observationsForComponent(workspace.observations, activeComponent.id)
        : [],
    [activeComponent, workspace.observations],
  );
  const observationsByRecord = useMemo(
    () =>
      new Map(
        activeObservations.map((observation) => [
          observation.learningRecordId,
          observation,
        ]),
      ),
    [activeObservations],
  );
  const assets = useMemo<SignedCourseComponentAssetMap>(
    () =>
      Object.fromEntries(
        workspace.attachments.map((asset) => [
          asset.id,
          {
            id: asset.id,
            originalFilename: asset.originalFilename,
            mimeType: asset.mimeType,
            signedUrl: asset.signedUrl,
          },
        ]),
      ),
    [workspace.attachments],
  );

  const persistedCriterion = activeComponent
    ? persistedCriterionForComponent(workspace.observations, activeComponent.id)
    : null;
  const criterionSuggestion = activeComponent
    ? suggestObservableCriterion(activeComponent)
    : "";
  const criterionDraft = activeComponent
    ? own(criterionDrafts, activeComponent.id)
      ? criterionDrafts[activeComponent.id]
      : (persistedCriterion ?? criterionSuggestion)
    : "";
  const confirmedCriterion = activeComponent
    ? own(confirmedCriteria, activeComponent.id)
      ? confirmedCriteria[activeComponent.id]
      : persistedCriterion
    : null;
  const criterionIsConfirmed = Boolean(
    criterionDraft.trim() && confirmedCriterion === criterionDraft.trim(),
  );
  const runFinished = Boolean(
    workspace.run.endedAt || workspace.run.cancelledAt,
  );
  const runStarted = Boolean(
    workspace.run.startedAt && workspace.run.startedAtIsActual === true,
  );
  const interactionLocked = runFinished || !runStarted;
  const activeStatusPrefix = activeComponent ? `${activeComponent.id}:` : "";
  const hasPending = Object.values(rowStatuses).some(
    (status) => status.kind === "pending",
  );
  const hasErrors = Object.values(rowStatuses).some(
    (status) => status.kind === "error",
  );
  const hasUnsavedNotes = Object.keys(noteDrafts).length > 0;
  const activeHasPending = Object.entries(rowStatuses).some(
    ([key, status]) =>
      key.startsWith(activeStatusPrefix) && status.kind === "pending",
  );
  const activeHasErrors = Object.entries(rowStatuses).some(
    ([key, status]) =>
      key.startsWith(activeStatusPrefix) && status.kind === "error",
  );
  const activeHasUnsavedNotes = Object.keys(noteDrafts).some((key) =>
    key.startsWith(activeStatusPrefix),
  );
  const summary = summarizeObservations(activeObservations, records.length);
  const coveredComponents = components.filter((component) =>
    workspace.observations.some(
      (observation) =>
        observation.lessonComponentId === component.id ||
        observation.sourceComponentIdAtTime === component.id,
    ),
  ).length;

  function queueMutation<T>(operation: () => Promise<T>) {
    pendingMutationCountRef.current += 1;
    const next = mutationQueueRef.current
      .catch(() => undefined)
      .then(operation);
    const markSettled = () => {
      pendingMutationCountRef.current = Math.max(
        0,
        pendingMutationCountRef.current - 1,
      );
    };
    void next.then(markSettled, markSettled);
    mutationQueueRef.current = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }

  function setRowStatus(rowKey: string, status: RowSaveStatus) {
    setRowStatuses((current) => ({
      ...current,
      [rowKey]: status,
    }));
  }

  function clearNoteTimer(rowKey: string) {
    const timer = noteTimersRef.current[rowKey];
    if (timer) clearTimeout(timer);
    delete noteTimersRef.current[rowKey];
  }

  async function persistRow(
    learningRecordId: string,
    input: SaveLessonComponentObservationsInput,
  ): Promise<boolean> {
    const key = draftKey(input.lessonComponentId, learningRecordId);
    const version = (rowVersionsRef.current[key] ?? 0) + 1;
    rowVersionsRef.current[key] = version;
    failedInputsRef.current[key] = input;
    setRowStatus(key, {
      kind: "pending",
      message: "Сохраняем…",
    });

    try {
      const observations = await queueMutation(() => onSave(input));
      onObservationsChange(observations);
      if (rowVersionsRef.current[key] !== version) return true;

      setRatingDrafts((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
      setNoteDrafts((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
      delete failedInputsRef.current[key];
      setRowStatus(key, {
        kind: "saved",
        message: "Сохранено",
      });
      return true;
    } catch (error) {
      if (rowVersionsRef.current[key] !== version) return false;
      setRowStatus(key, {
        kind: "error",
        message:
          error instanceof Error ? error.message : "Не удалось сохранить.",
      });
      return false;
    }
  }

  async function flushPendingNote(rowKey: string): Promise<boolean> {
    const pending = pendingNoteSavesRef.current[rowKey];
    if (!pending) return true;

    clearNoteTimer(rowKey);
    delete pendingNoteSavesRef.current[rowKey];
    return persistRow(pending.learningRecordId, pending.input);
  }

  async function flushPendingChanges(): Promise<boolean> {
    while (Object.keys(pendingNoteSavesRef.current).length > 0) {
      const pendingKeys = Object.keys(pendingNoteSavesRef.current);
      await Promise.all(pendingKeys.map((key) => flushPendingNote(key)));
    }
    await mutationQueueRef.current;
    return Object.keys(failedInputsRef.current).length === 0;
  }

  useImperativeHandle(ref, () => ({ flushPendingChanges }));

  function ratingForRecord(learningRecordId: string) {
    if (!activeComponent) return null;
    if (bulkDraft?.componentId === activeComponent.id) {
      return bulkDraft.ratings[learningRecordId] ?? null;
    }
    const key = draftKey(activeComponent.id, learningRecordId);
    if (own(ratingDrafts, key)) return ratingDrafts[key];
    return observationsByRecord.get(learningRecordId)?.rating ?? null;
  }

  function noteForRecord(learningRecordId: string) {
    if (!activeComponent) return "";
    const key = draftKey(activeComponent.id, learningRecordId);
    if (own(noteDrafts, key)) return noteDrafts[key];
    return observationsByRecord.get(learningRecordId)?.privateNote ?? "";
  }

  async function selectComponent(componentId: string) {
    if (componentId === activeComponentId || componentNavigationPending) return;
    if (bulkDraft && bulkDraft.componentId !== componentId) {
      setBulkError(
        "Сначала подтвердите или отмените массовый черновик текущего компонента.",
      );
      return;
    }
    const sourceComponentId = activeComponentId;
    setComponentNavigationPending(true);
    try {
      await flushPendingChanges();
      const sourceHasErrors = Object.keys(failedInputsRef.current).some(
        (key) =>
          sourceComponentId ? key.startsWith(`${sourceComponentId}:`) : false,
      );
      if (sourceHasErrors) return;
      setCriterionError(null);
      setBulkError(null);
      setActiveComponentId(componentId);
    } finally {
      setComponentNavigationPending(false);
    }
  }

  function selectRating(
    learningRecordId: string,
    rating: ObservationRatingValue,
  ) {
    if (!activeComponent || interactionLocked || !criterionIsConfirmed) return;
    if (bulkDraft?.componentId === activeComponent.id) {
      setBulkDraft((current) =>
        current
          ? {
              ...current,
              ratings: {
                ...current.ratings,
                [learningRecordId]: rating,
              },
            }
          : current,
      );
      setBulkError(null);
      return;
    }

    const key = draftKey(activeComponent.id, learningRecordId);
    clearNoteTimer(key);
    delete pendingNoteSavesRef.current[key];
    setRatingDrafts((current) => ({ ...current, [key]: rating }));
    if (rating === null) {
      setNoteDrafts((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
    }
    void persistRow(learningRecordId, {
      lessonComponentId: activeComponent.id,
      observableCriterionAtTime: confirmedCriterion,
      entryMethod: "direct",
      entries: [
        {
          learningRecordId,
          rating,
          privateNote: rating === null ? null : noteForRecord(learningRecordId),
        },
      ],
    });
  }

  function scheduleNoteSave(
    learningRecordId: string,
    value: string,
    delay = 700,
  ) {
    if (!activeComponent || interactionLocked || !criterionIsConfirmed) return;
    const rating = ratingForRecord(learningRecordId);
    if (rating === null || bulkDraft) return;
    const componentId = activeComponent.id;
    const key = draftKey(componentId, learningRecordId);
    rowVersionsRef.current[key] = (rowVersionsRef.current[key] ?? 0) + 1;
    setNoteDrafts((current) => ({ ...current, [key]: value }));
    clearNoteTimer(key);
    setRowStatus(key, {
      kind: "pending",
      message: delay > 0 ? "Заметка ожидает сохранения…" : "Сохраняем…",
    });
    pendingNoteSavesRef.current[key] = {
      learningRecordId,
      input: {
        lessonComponentId: componentId,
        observableCriterionAtTime: confirmedCriterion,
        entryMethod: "direct",
        entries: [
          {
            learningRecordId,
            rating,
            privateNote: value,
          },
        ],
      },
    };
    noteTimersRef.current[key] = setTimeout(() => {
      void flushPendingNote(key);
    }, delay);
  }

  async function requestCompletion() {
    if (completionFlushPending || bulkDraft) return;
    setCompletionFlushPending(true);
    try {
      const saved = await flushPendingChanges();
      if (saved) onRequestCompletion();
    } finally {
      setCompletionFlushPending(false);
    }
  }

  async function confirmCriterion() {
    if (!activeComponent || interactionLocked) return;
    const criterion = criterionDraft.trim();
    if (!criterion) {
      setCriterionError("Опишите, что именно вы сможете увидеть или услышать.");
      return;
    }
    setCriterionError(null);

    if (activeObservations.length === 0) {
      setConfirmedCriteria((current) => ({
        ...current,
        [activeComponent.id]: criterion,
      }));
      return;
    }

    for (const observation of activeObservations) {
      setRowStatus(draftKey(activeComponent.id, observation.learningRecordId), {
        kind: "pending",
        message: "Обновляем критерий…",
      });
    }
    try {
      const observations = await queueMutation(() =>
        onSave({
          lessonComponentId: activeComponent.id,
          observableCriterionAtTime: criterion,
          entryMethod: "direct",
          entries: activeObservations.map((observation) => ({
            learningRecordId: observation.learningRecordId,
            rating: observation.rating,
            privateNote: observation.privateNote,
          })),
        }),
      );
      onObservationsChange(observations);
      setConfirmedCriteria((current) => ({
        ...current,
        [activeComponent.id]: criterion,
      }));
      for (const observation of activeObservations) {
        setRowStatus(
          draftKey(activeComponent.id, observation.learningRecordId),
          {
            kind: "saved",
            message: "Сохранено",
          },
        );
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Не удалось сохранить критерий.";
      setCriterionError(message);
      for (const observation of activeObservations) {
        setRowStatus(
          draftKey(activeComponent.id, observation.learningRecordId),
          {
            kind: "saved",
            message: "Предыдущий критерий сохранён",
          },
        );
      }
    }
  }

  function startBulkDraft() {
    if (
      !activeComponent ||
      interactionLocked ||
      !criterionIsConfirmed ||
      activeHasPending ||
      activeHasErrors ||
      activeHasUnsavedNotes
    ) {
      return;
    }
    setBulkError(null);
    setBulkDraft({
      componentId: activeComponent.id,
      ratings: Object.fromEntries(
        records.map((record) => [record.id, "independent" as const]),
      ),
    });
  }

  async function confirmBulkDraft() {
    if (
      !activeComponent ||
      !bulkDraft ||
      bulkDraft.componentId !== activeComponent.id ||
      !confirmedCriterion
    ) {
      return;
    }
    setBulkError(null);
    for (const record of records) {
      setRowStatus(draftKey(activeComponent.id, record.id), {
        kind: "pending",
        message: "Сохраняем массовую отметку…",
      });
    }
    try {
      const observations = await queueMutation(() =>
        onSave({
          lessonComponentId: activeComponent.id,
          observableCriterionAtTime: confirmedCriterion,
          entryMethod: "bulk_confirmed",
          entries: records.map((record) => {
            const rating = bulkDraft.ratings[record.id] ?? null;
            return {
              learningRecordId: record.id,
              rating,
              privateNote: rating === null ? null : noteForRecord(record.id),
            };
          }),
        }),
      );
      onObservationsChange(observations);
      setBulkDraft(null);
      for (const record of records) {
        setRowStatus(draftKey(activeComponent.id, record.id), {
          kind: "saved",
          message: "Сохранено",
        });
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Массовую отметку сохранить не удалось.";
      setBulkError(message);
      for (const record of records) {
        setRowStatus(draftKey(activeComponent.id, record.id), {
          kind: "error",
          message,
        });
      }
    }
  }

  function retryRow(learningRecordId: string) {
    if (!activeComponent) return;
    const input =
      failedInputsRef.current[draftKey(activeComponent.id, learningRecordId)];
    if (input) void persistRow(learningRecordId, input);
  }

  const criterionEditingLocked =
    interactionLocked ||
    activeHasPending ||
    activeHasErrors ||
    activeHasUnsavedNotes ||
    Boolean(bulkDraft);
  const completionBlocked =
    hasErrors || Boolean(bulkDraft) || completionFlushPending;

  if (!activeComponent) {
    return (
      <div className={styles.emptyWorkspace}>
        <ClipboardCheck aria-hidden="true" />
        <h2>В уроке пока нет компонентов</h2>
        <p>
          Наблюдения привязываются к каноническим компонентам урока. Добавьте
          компонент в плане урока и вернитесь к проведению.
        </p>
        {runStarted && !runFinished ? (
          <Button onClick={onRequestCompletion}>
            Перейти к завершению урока
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <div className={styles.workspace}>
      {runFinished ? (
        <div className={styles.stateBanner} data-tone="locked" role="status">
          <LockKeyhole aria-hidden="true" />
          <div>
            <strong>
              {workspace.run.cancelledAt
                ? "Проведение отменено"
                : "Проведение завершено — история доступна только для чтения"}
            </strong>
            <p>Сохранённые критерии, отметки и заметки больше не изменяются.</p>
          </div>
        </div>
      ) : !runStarted ? (
        <div className={styles.stateBanner} data-tone="attention" role="status">
          <CircleAlert aria-hidden="true" />
          <div>
            <strong>Сначала начните проведение урока</strong>
            <p>
              До запуска можно просматривать компоненты, но не ставить отметки.
            </p>
          </div>
        </div>
      ) : null}

      <div className={styles.workspaceGrid}>
        <nav className={styles.navigator} aria-label="Компоненты урока">
          <div className={styles.navigatorHeading}>
            <div>
              <p className={styles.eyebrow}>Ход урока</p>
              <h2>Компоненты</h2>
            </div>
            <span>{components.length}</span>
          </div>
          <ol className={styles.navigatorList}>
            {components.map((component) => {
              const componentObservations = observationsForComponent(
                workspace.observations,
                component.id,
              );
              const componentHasError = Object.entries(rowStatuses).some(
                ([key, status]) =>
                  key.startsWith(`${component.id}:`) && status.kind === "error",
              );
              const active = component.id === activeComponent.id;
              return (
                <li key={component.id}>
                  <button
                    type="button"
                    className={styles.navigatorButton}
                    data-active={active ? "" : undefined}
                    aria-current={active ? "true" : undefined}
                    disabled={componentNavigationPending}
                    onClick={() => void selectComponent(component.id)}
                  >
                    <span className={styles.navigatorPosition}>
                      {component.position}
                    </span>
                    <span className={styles.navigatorLabel}>
                      {componentDisplayLabel(component).replace(
                        `${component.position}. `,
                        "",
                      )}
                    </span>
                    {componentHasError ? (
                      <span
                        className={styles.navigatorError}
                        aria-label="Есть ошибка сохранения"
                        title="Есть ошибка сохранения"
                      >
                        !
                      </span>
                    ) : componentObservations.length > 0 ? (
                      <span
                        className={styles.navigatorCount}
                        aria-label={`Наблюдений: ${componentObservations.length}`}
                      >
                        {componentObservations.length}
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ol>
          <div className={styles.navigatorControls}>
            <button
              type="button"
              disabled={activeIndex <= 0 || componentNavigationPending}
              onClick={() =>
                void selectComponent(components[activeIndex - 1]!.id)
              }
              aria-label="Предыдущий компонент"
            >
              <ChevronLeft aria-hidden="true" />
              Назад
            </button>
            <button
              type="button"
              disabled={
                activeIndex >= components.length - 1 ||
                componentNavigationPending
              }
              onClick={() =>
                void selectComponent(components[activeIndex + 1]!.id)
              }
              aria-label="Следующий компонент"
            >
              Далее
              <ChevronRight aria-hidden="true" />
            </button>
          </div>
        </nav>

        <div className={styles.observationColumn}>
          <section
            className={styles.componentPreview}
            aria-labelledby="active-component-title"
          >
            <div className={styles.sectionHeading}>
              <div>
                <p className={styles.eyebrow}>
                  Компонент {activeComponent.position} из {components.length}
                </p>
                <h2 id="active-component-title">
                  {componentDisplayLabel(activeComponent).replace(
                    `${activeComponent.position}. `,
                    "",
                  )}
                </h2>
              </div>
              <span>Экран учителя</span>
            </div>
            <div className={styles.rendererSurface}>
              <CourseComponentRenderer
                component={activeComponent}
                assets={assets}
                mode="teacher"
              />
            </div>
          </section>

          <section
            className={styles.criterionCard}
            aria-labelledby="criterion-title"
          >
            <div className={styles.criterionHeading}>
              <div className={styles.criterionIcon} aria-hidden="true">
                <Sparkles />
              </div>
              <div>
                <p className={styles.eyebrow}>Перед отметками</p>
                <h2 id="criterion-title">Что именно наблюдаем?</h2>
              </div>
            </div>
            <label className={styles.criterionField}>
              <span>Наблюдаемый критерий</span>
              <textarea
                value={criterionDraft}
                maxLength={500}
                rows={3}
                disabled={criterionEditingLocked}
                aria-describedby="criterion-help criterion-status"
                onChange={(event) => {
                  setCriterionDrafts((current) => ({
                    ...current,
                    [activeComponent.id]: event.target.value,
                  }));
                  setConfirmedCriteria((current) => ({
                    ...current,
                    [activeComponent.id]: null,
                  }));
                  setCriterionError(null);
                }}
              />
            </label>
            <div className={styles.criterionFooter}>
              <p id="criterion-help">
                Подсказку можно изменить. Отметки откроются только после явного
                подтверждения учителем.
              </p>
              {!interactionLocked ? (
                <Button
                  variant={criterionIsConfirmed ? "secondary" : "primary"}
                  disabled={criterionEditingLocked || !criterionDraft.trim()}
                  onClick={() => void confirmCriterion()}
                >
                  {criterionIsConfirmed ? (
                    <Check aria-hidden="true" />
                  ) : (
                    <ClipboardCheck aria-hidden="true" />
                  )}
                  {criterionIsConfirmed
                    ? "Критерий подтверждён"
                    : "Подтвердить"}
                </Button>
              ) : null}
            </div>
            <p
              id="criterion-status"
              className={
                criterionError
                  ? styles.criterionError
                  : styles.criterionConfirmation
              }
              role={criterionError ? "alert" : "status"}
            >
              {criterionError
                ? criterionError
                : criterionIsConfirmed
                  ? "Этот текст сохранится вместе с каждой отметкой как контекст во времени."
                  : "Критерий ещё не подтверждён."}
            </p>
          </section>

          <section
            className={styles.rosterSection}
            aria-labelledby="roster-title"
          >
            <div className={styles.rosterHeading}>
              <div>
                <p className={styles.eyebrow}>Фиксация в моменте</p>
                <h2 id="roster-title">
                  <Users aria-hidden="true" />
                  Ученики
                </h2>
              </div>
              {!interactionLocked ? (
                <Button
                  variant="secondary"
                  disabled={
                    !criterionIsConfirmed ||
                    records.length === 0 ||
                    activeHasPending ||
                    activeHasErrors ||
                    activeHasUnsavedNotes ||
                    Boolean(bulkDraft)
                  }
                  onClick={startBulkDraft}
                >
                  Все самостоятельно
                </Button>
              ) : null}
            </div>

            {bulkDraft?.componentId === activeComponent.id ? (
              <div className={styles.bulkBar} role="status">
                <div>
                  <strong>Массовый черновик — ещё не сохранён</strong>
                  <p>
                    По умолчанию выбрано «Самостоятельно». Укажите исключения в
                    строках и подтвердите весь набор одним действием.
                  </p>
                  {bulkError ? <span role="alert">{bulkError}</span> : null}
                </div>
                <div className={styles.bulkActions}>
                  <Button
                    variant="ghost"
                    disabled={activeHasPending}
                    onClick={() => {
                      setBulkDraft(null);
                      setBulkError(null);
                      setRowStatuses((current) =>
                        Object.fromEntries(
                          Object.entries(current).filter(
                            ([key]) =>
                              !key.startsWith(`${activeComponent.id}:`),
                          ),
                        ),
                      );
                    }}
                  >
                    Отменить черновик
                  </Button>
                  <Button
                    disabled={activeHasPending}
                    onClick={() => void confirmBulkDraft()}
                  >
                    {activeHasPending ? (
                      <LoaderCircle
                        className={styles.spinner}
                        aria-hidden="true"
                      />
                    ) : (
                      <Check aria-hidden="true" />
                    )}
                    Подтвердить {records.length} отметок
                  </Button>
                </div>
              </div>
            ) : bulkError ? (
              <p className={styles.bulkNavigationError} role="alert">
                {bulkError}
              </p>
            ) : null}

            {records.length > 0 ? (
              <div className={styles.rosterList}>
                {records.map((record) => {
                  const key = draftKey(activeComponent.id, record.id);
                  const rating = ratingForRecord(record.id);
                  const note = noteForRecord(record.id);
                  const observation = observationsByRecord.get(record.id);
                  const status = rowStatuses[key] ?? idleStatus;
                  const controlsDisabled =
                    interactionLocked ||
                    !criterionIsConfirmed ||
                    status.kind === "pending";
                  const retryAvailable = Boolean(failedInputsRef.current[key]);
                  return (
                    <article className={styles.learnerRow} key={record.id}>
                      <div className={styles.learnerIdentity}>
                        <span aria-hidden="true">
                          {record.learnerDisplayName
                            .trim()
                            .slice(0, 1)
                            .toUpperCase() || "У"}
                        </span>
                        <div>
                          <h3>{record.learnerDisplayName}</h3>
                          <div
                            className={styles.saveStatus}
                            data-state={status.kind}
                            role="status"
                            aria-live="polite"
                          >
                            {status.kind === "pending" ? (
                              <LoaderCircle
                                className={styles.spinner}
                                aria-hidden="true"
                              />
                            ) : status.kind === "saved" ? (
                              <Check aria-hidden="true" />
                            ) : status.kind === "error" ? (
                              <CircleAlert aria-hidden="true" />
                            ) : observation ? (
                              <Check aria-hidden="true" />
                            ) : null}
                            <span>
                              {status.kind === "idle" && observation
                                ? `Сохранено ${formatObservationTime(
                                    observation.updatedAt,
                                  )}`
                                : status.kind === "idle"
                                  ? "Нет сохранённой отметки"
                                  : status.message}
                            </span>
                            {status.kind === "error" && retryAvailable ? (
                              <button
                                type="button"
                                onClick={() => retryRow(record.id)}
                              >
                                <RotateCcw aria-hidden="true" />
                                Повторить
                              </button>
                            ) : null}
                          </div>
                        </div>
                      </div>

                      <fieldset
                        className={styles.ratingGroup}
                        disabled={controlsDisabled}
                      >
                        <legend className="sr-only">
                          Результат: {record.learnerDisplayName}
                        </legend>
                        {observationRatingOptions.map((option) => {
                          const optionId = `${activeComponent.id}-${record.id}-${option.value ?? "not_observed"}`;
                          return (
                            <label
                              className={styles.ratingOption}
                              data-value={option.value ?? "not_observed"}
                              data-selected={
                                rating === option.value ? "" : undefined
                              }
                              htmlFor={optionId}
                              key={option.value ?? "not_observed"}
                              title={option.description}
                            >
                              <input
                                id={optionId}
                                type="radio"
                                name={`rating-${activeComponent.id}-${record.id}`}
                                checked={rating === option.value}
                                onChange={() =>
                                  selectRating(record.id, option.value)
                                }
                              />
                              <span>{option.shortLabel}</span>
                            </label>
                          );
                        })}
                      </fieldset>

                      <label className={styles.noteField}>
                        <span>Личная заметка</span>
                        <textarea
                          rows={2}
                          maxLength={500}
                          value={note}
                          disabled={
                            interactionLocked ||
                            !criterionIsConfirmed ||
                            rating === null ||
                            Boolean(bulkDraft)
                          }
                          placeholder={
                            rating === null
                              ? "Сначала выберите наблюдаемую отметку"
                              : "Только для преподавателя"
                          }
                          onChange={(event) =>
                            scheduleNoteSave(record.id, event.target.value)
                          }
                          onBlur={() => {
                            const key = draftKey(activeComponent.id, record.id);
                            if (own(noteDrafts, key)) {
                              void flushPendingNote(key);
                            }
                          }}
                        />
                      </label>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className={styles.emptyRoster}>
                <Users aria-hidden="true" />
                <p>В этом проведении нет ожидаемых учеников.</p>
              </div>
            )}
          </section>
        </div>
      </div>

      <ObservationHistorySummary
        summary={summary}
        description={`Компонентов с наблюдениями: ${coveredComponents} из ${components.length}. Всего сохранено отметок: ${workspace.observations.length}.`}
      />

      <footer className={styles.completionPanel}>
        <div>
          <p className={styles.eyebrow}>После последнего компонента</p>
          <h2>
            {runFinished ? "Итоги проведения сохранены" : "Завершение урока"}
          </h2>
          <p>
            {runFinished
              ? "Сводка выше и все наблюдения остаются частью истории учеников."
              : hasErrors || bulkDraft
                ? "Сначала дождитесь сохранения, повторите ошибки или подтвердите массовый черновик."
                : completionFlushPending
                  ? "Дожидаемся сохранения заметок перед открытием итогов."
                  : hasPending || hasUnsavedNotes
                    ? "Можно перейти к итогам: незавершённые сохранения будут выполнены перед открытием."
                    : "Проверьте сводку, затем отметьте посещаемость и общий итог урока."}
          </p>
        </div>
        {!runFinished && runStarted ? (
          <Button
            disabled={completionBlocked}
            onClick={() => void requestCompletion()}
          >
            {completionFlushPending ? (
              <LoaderCircle className={styles.spinner} aria-hidden="true" />
            ) : (
              <ClipboardCheck aria-hidden="true" />
            )}
            {completionFlushPending ? "Сохраняем заметки…" : "Завершить урок"}
          </Button>
        ) : null}
      </footer>
    </div>
  );
});
