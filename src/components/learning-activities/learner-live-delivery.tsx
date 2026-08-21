"use client";

import { CircleAlert, LoaderCircle, RefreshCw, WifiOff } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CourseComponentRenderer,
  type SignedCourseComponentAssetMap,
} from "@/components/course-builder/component-renderers";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/auth";
import { choiceQuizLearnerExecutionSchema } from "@/modules/choice-quiz/contracts";
import {
  learnerLiveDeliveryResponseSchema,
  type LearnerLiveState,
} from "@/modules/live-delivery/contracts";
import { LearnerChoiceQuiz } from "./learner-choice-quiz";
import {
  learnerChoiceQuizDraftFromExecution,
  learnerChoiceQuizExecutionAdvancesDraft,
  retainLearnerChoiceQuizDrafts,
  setLearnerChoiceQuizDraft,
  type LearnerChoiceQuizDraft,
  type LearnerChoiceQuizDrafts,
} from "./learner-choice-quiz-draft";
import styles from "./learner-live-delivery.module.css";

type ViewState =
  | { kind: "loading" }
  | { kind: "ready"; value: LearnerLiveState }
  | { kind: "reconnecting" }
  | { kind: "denied"; message: string };

type PollResult =
  | { kind: "ready"; value: LearnerLiveState }
  | { kind: "login" }
  | { kind: "denied"; message: string }
  | { kind: "retry" };

const POLL_INTERVAL_MS = 2_000;
const POLL_REQUEST_TIMEOUT_MS = 6_000;
const GENERIC_DENIED_MESSAGE =
  "Этот live-урок недоступен для текущего аккаунта.";

const liveAssetExtensionByMimeType: Readonly<Record<string, string>> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    "docx",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation":
    "pptx",
  "text/plain": "txt",
  "text/markdown": "md",
};

function liveAssetFilename(mimeType: string, index: number) {
  const extension = liveAssetExtensionByMimeType[mimeType] ?? "bin";
  return `live-material-${index + 1}.${extension}`;
}

function loginUrl() {
  const next = `${window.location.pathname}${window.location.search}`;
  return `${ROUTES.login}?next=${encodeURIComponent(next)}`;
}

function deniedMessage(payload: unknown) {
  if (
    payload &&
    typeof payload === "object" &&
    "error" in payload &&
    typeof payload.error === "string"
  ) {
    return payload.error;
  }
  return GENERIC_DENIED_MESSAGE;
}

export function LearnerLiveDelivery({ lessonRunId }: { lessonRunId: string }) {
  const [view, setView] = useState<ViewState>({ kind: "loading" });
  const [choiceQuizDrafts, setChoiceQuizDrafts] =
    useState<LearnerChoiceQuizDrafts>({});
  const generationRef = useRef(0);
  const forceRefreshRef = useRef<() => void>(() => undefined);

  const pollUrl = useMemo(
    () => `/api/v2/me/live-runs/${encodeURIComponent(lessonRunId)}`,
    [lessonRunId],
  );

  const activeChoiceQuizIssueRefs = useMemo<readonly string[] | null>(() => {
    if (view.kind === "loading" || view.kind === "reconnecting") return null;
    if (view.kind !== "ready" || view.value.kind !== "active") return [];
    return view.value.slide.components.flatMap((component) => {
      if (component.typeKey !== "choice_quiz") return [];
      const execution = choiceQuizLearnerExecutionSchema.safeParse(
        component.execution,
      );
      return execution.success ? [execution.data.issueRef] : [];
    });
  }, [view]);

  useEffect(() => {
    setChoiceQuizDrafts((current) =>
      retainLearnerChoiceQuizDrafts(current, activeChoiceQuizIssueRefs),
    );
  }, [activeChoiceQuizIssueRefs]);

  useEffect(() => {
    setChoiceQuizDrafts({});
  }, [lessonRunId]);

  const updateChoiceQuizDraft = useCallback(
    (issueRef: string, draft: LearnerChoiceQuizDraft) => {
      setChoiceQuizDrafts((current) =>
        setLearnerChoiceQuizDraft(current, issueRef, draft),
      );
    },
    [],
  );

  const pollOnce = useCallback(
    async (signal: AbortSignal): Promise<PollResult> => {
      const response = await fetch(pollUrl, {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
        signal,
      });
      const payload = await response.json().catch(() => null);

      if (response.status === 401) {
        return { kind: "login" };
      }
      if (response.status === 400) {
        return { kind: "denied", message: GENERIC_DENIED_MESSAGE };
      }
      if (response.status === 403 || response.status === 404) {
        return { kind: "denied", message: deniedMessage(payload) };
      }
      if (!response.ok) return { kind: "retry" };

      const parsed = learnerLiveDeliveryResponseSchema.safeParse(payload);
      return parsed.success
        ? { kind: "ready", value: parsed.data.state }
        : { kind: "retry" };
    },
    [pollUrl],
  );

  useEffect(() => {
    const generation = ++generationRef.current;
    let stopped = false;
    let running = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let requestTimeout: ReturnType<typeof setTimeout> | null = null;
    let controller: AbortController | null = null;

    const schedule = () => {
      if (stopped || generation !== generationRef.current) return;
      timer = setTimeout(() => void run(), POLL_INTERVAL_MS);
    };

    const run = async () => {
      if (running || stopped || generation !== generationRef.current) return;
      running = true;
      const requestController = new AbortController();
      controller = requestController;
      let timedOut = false;
      requestTimeout = setTimeout(() => {
        timedOut = true;
        requestController.abort();
      }, POLL_REQUEST_TIMEOUT_MS);
      try {
        const result = await pollOnce(requestController.signal);
        if (stopped || generation !== generationRef.current) return;
        if (requestController.signal.aborted) {
          if (timedOut) setView({ kind: "reconnecting" });
          return;
        }
        if (result.kind === "login") {
          stopped = true;
          window.location.assign(loginUrl());
        } else if (result.kind === "denied") {
          stopped = true;
          setView({ kind: "denied", message: result.message });
        } else if (result.kind === "retry") {
          setView({ kind: "reconnecting" });
        } else {
          setView({ kind: "ready", value: result.value });
          if (result.value.kind === "ended") stopped = true;
        }
      } catch (error) {
        if (
          !stopped &&
          generation === generationRef.current &&
          (timedOut ||
            !(error instanceof DOMException && error.name === "AbortError"))
        ) {
          setView({ kind: "reconnecting" });
        }
      } finally {
        if (requestTimeout) clearTimeout(requestTimeout);
        requestTimeout = null;
        running = false;
        controller = null;
        schedule();
      }
    };

    const refreshNow = () => {
      if (document.visibilityState !== "visible") return;
      if (timer) clearTimeout(timer);
      timer = null;
      void run();
    };

    forceRefreshRef.current = refreshNow;

    void run();
    window.addEventListener("focus", refreshNow);
    document.addEventListener("visibilitychange", refreshNow);
    return () => {
      stopped = true;
      generationRef.current += 1;
      if (timer) clearTimeout(timer);
      if (requestTimeout) clearTimeout(requestTimeout);
      controller?.abort();
      forceRefreshRef.current = () => undefined;
      window.removeEventListener("focus", refreshNow);
      document.removeEventListener("visibilitychange", refreshNow);
    };
  }, [pollOnce]);

  if (view.kind === "loading") {
    return (
      <LiveFrame announcement="Подключаемся к live-уроку">
        <LiveShell tone="loading">
          <LoaderCircle className={styles.spin} aria-hidden="true" />
          <h1>Подключаемся к уроку…</h1>
          <p>Проверяем сессию и разрешение преподавателя.</p>
        </LiveShell>
      </LiveFrame>
    );
  }

  if (view.kind === "reconnecting") {
    return (
      <LiveFrame announcement="Соединение прервано. Содержимое скрыто">
        <LiveShell tone="reconnecting">
          <WifiOff aria-hidden="true" />
          <h1>Восстанавливаем соединение</h1>
          <p>
            Содержимое скрыто до следующей успешной проверки доступа. Экран
            обновится автоматически.
          </p>
        </LiveShell>
      </LiveFrame>
    );
  }

  if (view.kind === "denied") {
    return (
      <LiveFrame announcement="Live-урок недоступен">
        <LiveShell tone="denied">
          <CircleAlert aria-hidden="true" />
          <h1>Live-урок недоступен</h1>
          <p>{view.message}</p>
          <Button onClick={() => window.location.reload()}>
            <RefreshCw aria-hidden="true" />
            Проверить снова
          </Button>
        </LiveShell>
      </LiveFrame>
    );
  }

  if (view.value.kind === "ended") {
    return (
      <LiveFrame announcement="Live-показ завершён">
        <LiveShell tone="ended">
          <h1>Показ завершён</h1>
          <p>Преподаватель завершил или отменил это занятие.</p>
        </LiveShell>
      </LiveFrame>
    );
  }

  if (view.value.kind === "waiting") {
    return (
      <LiveFrame
        announcement={`Ожидание слайда. Версия показа ${view.value.cursorRevision}`}
      >
        <LiveShell tone="waiting">
          <span className={styles.pulse} aria-hidden="true" />
          <h1>Ждём следующий слайд</h1>
          <p>Преподаватель управляет экраном. Ничего нажимать не нужно.</p>
          <small>Версия показа {view.value.cursorRevision}</small>
        </LiveShell>
      </LiveFrame>
    );
  }

  const assets: SignedCourseComponentAssetMap = Object.fromEntries(
    view.value.assets.map((asset, index) => [
      asset.ref,
      {
        id: asset.ref,
        originalFilename: liveAssetFilename(asset.mimeType, index),
        mimeType: asset.mimeType,
        signedUrl: asset.url,
      },
    ]),
  );
  const activeCursorRevision = view.value.cursorRevision;

  return (
    <LiveFrame
      announcement={`Показывается слайд ${view.value.slide.position}. Версия ${view.value.cursorRevision}`}
    >
      <main className={styles.activePage}>
        <header className={styles.activeHeader}>
          <div>
            <p>Live-урок</p>
            <h1>Слайд {view.value.slide.position}</h1>
          </div>
          <span>показ · версия {view.value.cursorRevision}</span>
        </header>
        <section
          className={styles.slide}
          aria-label={`Текущий слайд ${view.value.slide.position}`}
        >
          {view.value.slide.components.length > 0 ? (
            view.value.slide.components.map((component) => {
              const execution =
                component.typeKey === "choice_quiz"
                  ? choiceQuizLearnerExecutionSchema.safeParse(
                      component.execution,
                    )
                  : null;
              if (execution?.success) {
                const storedDraft =
                  choiceQuizDrafts[execution.data.issueRef] ?? null;
                const draft =
                  storedDraft &&
                  !learnerChoiceQuizExecutionAdvancesDraft(
                    execution.data,
                    storedDraft,
                  )
                    ? storedDraft
                    : learnerChoiceQuizDraftFromExecution(execution.data);
                return (
                  <LearnerChoiceQuiz
                    key={`${component.key}:${execution.data.issueRef}`}
                    lessonRunId={lessonRunId}
                    cursorRevision={activeCursorRevision}
                    component={component}
                    execution={execution.data}
                    draft={draft}
                    onDraftChange={updateChoiceQuizDraft}
                    onLiveStateInvalidated={() => forceRefreshRef.current()}
                  />
                );
              }
              return (
                <CourseComponentRenderer
                  key={component.key}
                  component={{ ...component, id: component.key }}
                  assets={assets}
                  mode="student"
                  interaction="presentation"
                />
              );
            })
          ) : (
            <p className={styles.emptySlide}>
              На выбранном слайде пока нет доступного содержимого.
            </p>
          )}
        </section>
        <footer className={styles.activeFooter}>
          Экран обновляется автоматически; переходом управляет преподаватель.
        </footer>
      </main>
    </LiveFrame>
  );
}

function LiveFrame({
  announcement,
  children,
}: {
  announcement: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <p
        className={styles.srOnly}
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {announcement}
      </p>
      {children}
    </>
  );
}

function LiveShell({
  tone,
  children,
}: {
  tone: "loading" | "waiting" | "reconnecting" | "denied" | "ended";
  children: React.ReactNode;
}) {
  return (
    <main className={styles.statePage} data-tone={tone}>
      <section className={styles.stateCard}>{children}</section>
    </main>
  );
}
