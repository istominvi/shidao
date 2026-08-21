"use client";

import {
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Copy,
  LoaderCircle,
  MonitorPlay,
  RefreshCw,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { CourseBuilderClientError } from "@/components/course-builder/course-builder-client";
import { toLearnerLiveRoute } from "@/lib/auth";
import {
  loadTeacherLiveDelivery,
  updateTeacherLiveAccess,
  updateTeacherLiveCursor,
  type TeacherLiveDelivery,
} from "./live-delivery-client";
import styles from "./run-live-delivery-panel.module.css";

function message(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Не удалось обновить live-показ.";
}

export function RunLiveDeliveryPanel({ lessonRunId }: { lessonRunId: string }) {
  const [delivery, setDelivery] = useState<TeacherLiveDelivery | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingLearnerId, setPendingLearnerId] = useState<string | null>(null);
  const [cursorPending, setCursorPending] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">(
    "idle",
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setDelivery(await loadTeacherLiveDelivery(lessonRunId));
    } catch (caught) {
      setError(message(caught));
    } finally {
      setLoading(false);
    }
  }, [lessonRunId]);

  useEffect(() => {
    void load();
  }, [load]);

  const validSlides = useMemo(
    () => delivery?.slides.filter((slide) => slide.componentCount > 0) ?? [],
    [delivery],
  );

  const activeSlideIndex = useMemo(
    () =>
      validSlides.findIndex((slide) => slide.id === delivery?.cursor.slideId) ??
      -1,
    [delivery, validSlides],
  );

  async function setAccess(
    learner: TeacherLiveDelivery["learners"][number],
    kind: "course" | "run",
    enabled: boolean,
  ) {
    if (loading || cursorPending || pendingLearnerId || !delivery) return;
    setPendingLearnerId(learner.learnerProfileId);
    setError(null);
    try {
      setDelivery(
        await updateTeacherLiveAccess(lessonRunId, {
          learnerProfileId: learner.learnerProfileId,
          courseAccessEnabled:
            kind === "course" ? enabled : learner.courseAccessEnabled,
          runCapabilityEnabled:
            kind === "course" && !enabled
              ? false
              : kind === "run"
                ? enabled
                : learner.runCapabilityEnabled,
        }),
      );
    } catch (caught) {
      setError(message(caught));
    } finally {
      setPendingLearnerId(null);
    }
  }

  async function setCursor(slideId: string | null) {
    if (
      loading ||
      !delivery ||
      cursorPending ||
      pendingLearnerId ||
      delivery.run.ended
    ) {
      return;
    }
    setCursorPending(true);
    setError(null);
    try {
      const cursor = await updateTeacherLiveCursor(lessonRunId, {
        slideId,
        expectedRevision: delivery.cursor.revision,
      });
      setDelivery((current) => (current ? { ...current, cursor } : current));
    } catch (caught) {
      setError(message(caught));
      if (caught instanceof CourseBuilderClientError && caught.status === 409) {
        await load();
      }
    } finally {
      setCursorPending(false);
    }
  }

  async function copyLearnerLink() {
    setCopyState("idle");
    try {
      const url = new URL(
        toLearnerLiveRoute(lessonRunId),
        window.location.origin,
      );
      await navigator.clipboard.writeText(url.toString());
      setCopyState("copied");
    } catch {
      setCopyState("error");
    }
  }

  if (loading && !delivery) {
    return (
      <section className={styles.panel} aria-busy="true" role="status">
        <LoaderCircle className={styles.spin} aria-hidden="true" />
        <div>
          <strong>Готовим live-показ…</strong>
          <p>Проверяем доступ учеников и сохранённый курсор.</p>
        </div>
      </section>
    );
  }

  if (!delivery) {
    return (
      <section className={styles.panel} role="alert">
        <CircleAlert aria-hidden="true" />
        <div>
          <strong>Live-показ недоступен</strong>
          <p>{error}</p>
          <Button variant="secondary" onClick={() => void load()}>
            <RefreshCw aria-hidden="true" />
            Повторить
          </Button>
        </div>
      </section>
    );
  }

  const cursorLocked =
    loading ||
    !delivery.run.started ||
    delivery.run.ended ||
    cursorPending ||
    pendingLearnerId !== null;
  const previousSlide =
    activeSlideIndex > 0 ? validSlides[activeSlideIndex - 1] : null;
  const nextSlide =
    activeSlideIndex >= 0 && activeSlideIndex < validSlides.length - 1
      ? validSlides[activeSlideIndex + 1]
      : activeSlideIndex === -1
        ? validSlides[0]
        : null;

  return (
    <section className={styles.panel} aria-labelledby="live-delivery-title">
      <div className={styles.header}>
        <div className={styles.titleGroup}>
          <span className={styles.icon} aria-hidden="true">
            <MonitorPlay />
          </span>
          <div>
            <p className={styles.eyebrow}>LA‑M4 · отдельный канал показа</p>
            <h2 id="live-delivery-title">Экран ученика в реальном времени</h2>
          </div>
        </div>
        <div className={styles.headerActions}>
          <Button variant="secondary" onClick={() => void copyLearnerLink()}>
            <Copy aria-hidden="true" />
            {copyState === "copied" ? "Ссылка скопирована" : "Ссылка ученику"}
          </Button>
          <span
            className={styles.srOnly}
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            {copyState === "copied"
              ? "Ссылка на live-урок скопирована"
              : copyState === "error"
                ? "Не удалось скопировать ссылку на live-урок"
                : ""}
          </span>
          <Button
            variant="secondary"
            disabled={loading || cursorPending || pendingLearnerId !== null}
            onClick={() => void load()}
            aria-label="Обновить состояние live-показа"
          >
            <RefreshCw aria-hidden="true" />
            Обновить
          </Button>
        </div>
      </div>

      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
      {copyState === "error" ? (
        <p className={styles.error} role="alert">
          Браузер не разрешил копирование. Откройте /live/{lessonRunId} на
          устройстве ученика.
        </p>
      ) : null}

      <div className={styles.grid}>
        <div className={styles.cursorCard}>
          <div className={styles.cardHeading}>
            <div>
              <p className={styles.eyebrow}>Курсор показа</p>
              <h3>
                {delivery.cursor.slideId && activeSlideIndex >= 0
                  ? `Слайд ${validSlides[activeSlideIndex]!.position}`
                  : "Ожидание"}
              </h3>
            </div>
            <span>версия {delivery.cursor.revision}</span>
          </div>
          <p className={styles.help}>
            Ученик видит только выбранный слайд. Курсор не связан с текущим
            компонентом наблюдения учителя.
          </p>
          <div className={styles.slideList} aria-label="Слайды live-показа">
            <button
              type="button"
              data-active={delivery.cursor.slideId === null ? "" : undefined}
              aria-pressed={delivery.cursor.slideId === null}
              disabled={cursorLocked}
              onClick={() => void setCursor(null)}
            >
              <span>Ожидание</span>
              <small>ничего не показывать</small>
            </button>
            {delivery.slides.map((slide) => (
              <button
                key={slide.id}
                type="button"
                data-active={
                  slide.id === delivery.cursor.slideId ? "" : undefined
                }
                aria-pressed={slide.id === delivery.cursor.slideId}
                disabled={cursorLocked || slide.componentCount === 0}
                onClick={() => void setCursor(slide.id)}
              >
                <span>Слайд {slide.position}</span>
                <small>
                  {slide.componentCount === 0
                    ? "нет learner-visible компонентов"
                    : `${slide.componentCount} компонентов`}
                </small>
              </button>
            ))}
          </div>
          <div className={styles.cursorControls}>
            <Button
              variant="secondary"
              disabled={cursorLocked || !previousSlide}
              onClick={() => void setCursor(previousSlide?.id ?? null)}
            >
              <ChevronLeft aria-hidden="true" />
              Назад
            </Button>
            <Button
              variant="secondary"
              disabled={cursorLocked || !nextSlide}
              onClick={() => void setCursor(nextSlide?.id ?? null)}
            >
              Далее
              <ChevronRight aria-hidden="true" />
            </Button>
          </div>
          {!delivery.run.started ? (
            <p className={styles.notice}>
              Курсор откроется после явного старта.
            </p>
          ) : delivery.run.ended ? (
            <p className={styles.notice}>Занятие закрыто; показ завершён.</p>
          ) : validSlides.length === 0 ? (
            <p className={styles.notice}>В уроке нет непустых слайдов.</p>
          ) : null}
        </div>

        <div className={styles.accessCard}>
          <div className={styles.cardHeading}>
            <div>
              <p className={styles.eyebrow}>Явные capabilities</p>
              <h3>Доступ учеников</h3>
            </div>
            <span>
              <Users aria-hidden="true" /> {delivery.learners.length}
            </span>
          </div>
          <p className={styles.help}>
            Аудитория и roster не дают права автоматически. Для live нужны оба
            разрешения ниже.
          </p>
          <div className={styles.learners}>
            {delivery.learners.map((learner, learnerIndex) => {
              const pending = pendingLearnerId === learner.learnerProfileId;
              const offline = learner.identityState === "offline";
              const accessLocked = pendingLearnerId !== null;
              return (
                <div
                  className={styles.learnerRow}
                  key={learner.learnerProfileId}
                >
                  <div className={styles.learnerName}>
                    <strong>{learner.displayName}</strong>
                    <span>
                      {offline ? "Нет связанного Account" : "Account связан"}
                    </span>
                  </div>
                  <label>
                    <Checkbox
                      checked={learner.courseAccessEnabled}
                      disabled={
                        loading ||
                        cursorPending ||
                        accessLocked ||
                        offline ||
                        (delivery.run.ended && !learner.courseAccessEnabled)
                      }
                      aria-label={`Доступ к курсу для ${learner.displayName}, ученик ${learnerIndex + 1}`}
                      onChange={(event) =>
                        void setAccess(learner, "course", event.target.checked)
                      }
                    />
                    <span>Курс</span>
                  </label>
                  <label>
                    <Checkbox
                      checked={learner.runCapabilityEnabled}
                      disabled={
                        accessLocked ||
                        loading ||
                        cursorPending ||
                        offline ||
                        delivery.run.ended ||
                        !delivery.run.started ||
                        !learner.courseAccessEnabled
                      }
                      aria-label={`Доступ к этому запуску для ${learner.displayName}, ученик ${learnerIndex + 1}`}
                      onChange={(event) =>
                        void setAccess(learner, "run", event.target.checked)
                      }
                    />
                    <span>Этот запуск</span>
                  </label>
                  {pending ? (
                    <LoaderCircle
                      className={styles.spin}
                      aria-label="Сохраняем доступ"
                    />
                  ) : null}
                </div>
              );
            })}
            {delivery.learners.length === 0 ? (
              <p className={styles.notice}>В frozen roster нет учеников.</p>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
