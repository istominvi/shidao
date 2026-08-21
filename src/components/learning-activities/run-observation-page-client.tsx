"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AppPageHeader } from "@/components/app/page-header";
import { LessonRunDialog } from "@/components/lesson-runs/lesson-run-dialog";
import { Button } from "@/components/ui/button";
import { toCourseRoute } from "@/lib/auth";
import type {
  LessonComponentObservation,
  RunObservationWorkspace as RunObservationWorkspaceData,
  SaveLessonComponentObservationsInput,
} from "@/modules/learning-activities";
import {
  loadRunObservationWorkspace,
  saveLessonComponentObservations,
} from "./run-observation-client";
import {
  RunObservationWorkspace,
  type RunObservationWorkspaceHandle,
} from "./run-observation-workspace";
import { RunChoiceQuizHistoryPanel } from "./run-choice-quiz-history-panel";
import { RunLiveDeliveryPanel } from "./run-live-delivery-panel";
import styles from "./run-observation-workspace.module.css";

function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Не удалось загрузить проведение урока.";
}

export function RunObservationPageClient({
  courseId,
  lessonRunId,
}: {
  courseId: string;
  lessonRunId: string;
}) {
  const router = useRouter();
  const [workspace, setWorkspace] =
    useState<RunObservationWorkspaceData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [completionOpen, setCompletionOpen] = useState(false);
  const [runMutationPending, setRunMutationPending] = useState(false);
  const [runMutationError, setRunMutationError] = useState<string | null>(null);
  const requestVersionRef = useRef(0);
  const workspaceRef = useRef<RunObservationWorkspaceHandle>(null);
  const returnPendingRef = useRef(false);

  const reload = useCallback(
    async (showLoading = false) => {
      const requestVersion = ++requestVersionRef.current;
      if (showLoading) setLoading(true);
      setLoadError(null);
      try {
        const next = await loadRunObservationWorkspace(lessonRunId);
        if (requestVersion === requestVersionRef.current) setWorkspace(next);
        return next;
      } catch (error) {
        if (requestVersion === requestVersionRef.current) {
          setLoadError(errorMessage(error));
        }
        throw error;
      } finally {
        if (requestVersion === requestVersionRef.current) setLoading(false);
      }
    },
    [lessonRunId],
  );

  useEffect(() => {
    void reload(true).catch(() => undefined);
    return () => {
      requestVersionRef.current += 1;
    };
  }, [reload]);

  const saveObservations = useCallback(
    (input: SaveLessonComponentObservationsInput) =>
      saveLessonComponentObservations(lessonRunId, input),
    [lessonRunId],
  );

  const applyObservations = useCallback(
    (observations: LessonComponentObservation[]) => {
      setWorkspace((current) =>
        current ? { ...current, observations } : current,
      );
    },
    [],
  );

  const runMutation = useCallback(
    async (_label: string, action: () => Promise<unknown>) => {
      setRunMutationPending(true);
      setRunMutationError(null);
      try {
        await action();
        await reload(false);
        return true;
      } catch (error) {
        setRunMutationError(errorMessage(error));
        return false;
      } finally {
        setRunMutationPending(false);
      }
    },
    [reload],
  );

  const backHref = workspace
    ? `${toCourseRoute(courseId)}?lesson=${encodeURIComponent(workspace.lesson.id)}`
    : toCourseRoute(courseId);
  const roster = useMemo(
    () =>
      workspace?.run.records.map((record) => ({
        id: record.learnerProfileId,
        displayName: record.learnerDisplayName,
      })) ?? [],
    [workspace],
  );

  async function returnToCourse() {
    if (returnPendingRef.current) return;
    returnPendingRef.current = true;
    try {
      const canLeave =
        (await workspaceRef.current?.flushPendingChanges()) ?? true;
      if (canLeave) router.push(backHref);
    } finally {
      returnPendingRef.current = false;
    }
  }

  if (!workspace) {
    return (
      <div className={`container app-page-container ${styles.pageContainer}`}>
        <AppPageHeader
          title="Проведение урока"
          metricPending={loading}
          back={{ type: "link", href: backHref, label: "К курсу" }}
        />
        {loadError ? (
          <section className={styles.loadState} role="alert">
            <strong>Проведение не загрузилось</strong>
            <p>{loadError}</p>
            <Button onClick={() => void reload(true).catch(() => undefined)}>
              Повторить
            </Button>
          </section>
        ) : (
          <section className={styles.loadState} aria-busy="true" role="status">
            <strong>Открываем рабочее пространство…</strong>
            <p>Загружаем состав, компоненты и сохранённые наблюдения.</p>
          </section>
        )}
      </div>
    );
  }

  if (workspace.run.courseId !== courseId) {
    return (
      <div className={`container app-page-container ${styles.pageContainer}`}>
        <AppPageHeader
          title="Проведение недоступно"
          back={{
            type: "link",
            href: toCourseRoute(courseId),
            label: "К курсу",
          }}
        />
        <section className={styles.loadState} role="alert">
          <strong>Проведение не относится к этому курсу</strong>
          <p>Вернитесь к курсу и откройте проведение из карточки урока.</p>
        </section>
      </div>
    );
  }

  return (
    <div className={`container app-page-container ${styles.pageContainer}`}>
      <AppPageHeader
        title={workspace.lesson.title}
        metric={`Проведение · ${workspace.run.records.length} учеников · ${workspace.lesson.components.length} компонентов`}
        back={{
          type: "button",
          onClick: () => void returnToCourse(),
          label: workspace.run.courseTitle,
        }}
      />

      {loadError ? (
        <p className={styles.refreshWarning} role="alert">
          Данные проведения изменились, но обновить экран не удалось:{" "}
          {loadError}
        </p>
      ) : null}

      <RunLiveDeliveryPanel
        key={`${lessonRunId}:${workspace.run.updatedAt}`}
        lessonRunId={lessonRunId}
      />

      <RunChoiceQuizHistoryPanel lessonRunId={lessonRunId} />

      <RunObservationWorkspace
        ref={workspaceRef}
        workspace={workspace}
        onSave={saveObservations}
        onObservationsChange={applyObservations}
        onRequestCompletion={() => {
          setRunMutationError(null);
          setCompletionOpen(true);
        }}
      />

      {completionOpen ? (
        <LessonRunDialog
          lesson={workspace.lesson}
          runs={[workspace.run]}
          learners={roster}
          observations={workspace.observations}
          disabled={runMutationPending}
          mutationError={runMutationError}
          runMutation={runMutation}
          initialMode="edit"
          onClose={() => setCompletionOpen(false)}
        />
      ) : null}
    </div>
  );
}
