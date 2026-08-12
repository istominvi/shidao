"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  BookOpen,
  Check,
  CheckCircle2,
  Circle,
  FileText,
  LoaderCircle,
  LockKeyhole,
  RotateCcw,
  UserRound,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { AppPageHeader } from "@/components/app/page-header";
import { courseBuilderRequest } from "@/components/course-builder/course-builder-client";
import {
  CourseComponentRenderer,
  type SignedCourseComponentAssetMap,
} from "@/components/course-builder/component-renderers";
import { Button, productButtonClassName } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { SurfaceCard } from "@/components/ui/surface-card";
import {
  WorkspaceTabs,
  workspaceTabId,
  workspaceTabPanelId,
} from "@/components/ui/workspace-tabs";
import { toCourseRoute } from "@/lib/auth";
import type { CourseAttestationState } from "@/modules/course-attestations/domain";
import type { CoursePublicationProgress } from "@/modules/course-consumption/domain";
import type {
  CourseCatalogDetail,
  CourseCatalogLesson,
} from "@/modules/course-publications/domain";
import { CourseAttestationPanel } from "./course-catalog-panel";
import {
  createPublishedCourseProgressQueue,
  isProgressForIdentity,
} from "./published-course-progress-queue";

type PublishedCourseSurface = "lessons" | "about" | "materials" | "attestation";

const PUBLISHED_COURSE_TABS_ID = "published-course";

function catalogHref(audience: "children" | "educators") {
  return audience === "educators"
    ? "/courses?tab=catalog&audience=educators"
    : "/courses?tab=catalog";
}

function formatFileSize(sizeBytes: number) {
  if (sizeBytes < 1024 * 1024) return `${Math.ceil(sizeBytes / 1024)} КБ`;
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} МБ`;
}

function safeMaterialUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

function emptyProgress(course: CourseCatalogDetail): CoursePublicationProgress {
  return {
    publicationId: course.id,
    revisionId: course.revisionId,
    completedLessonRefs: [],
    lastOpenedLessonRef: null,
    completedLessonCount: 0,
    totalLessonCount: course.lessons.length,
    percent: 0,
    complete: false,
  };
}

export function PublishedCourseWorkspace({
  publicationId,
  catalogAudience,
}: {
  publicationId: string;
  catalogAudience: "children" | "educators";
}) {
  const router = useRouter();
  const [course, setCourse] = useState<CourseCatalogDetail | null>(null);
  const [progress, setProgress] = useState<CoursePublicationProgress | null>(
    null,
  );
  const [activeSurface, setActiveSurface] =
    useState<PublishedCourseSurface>("lessons");
  const [selectedLessonRef, setSelectedLessonRef] = useState<string | null>(
    null,
  );
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [copyBusy, setCopyBusy] = useState(false);
  const [progressError, setProgressError] = useState<string | null>(null);
  const [progressBusy, setProgressBusy] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [attestation, setAttestation] = useState<CourseAttestationState | null>(
    null,
  );
  const [attestationLoading, setAttestationLoading] = useState(false);
  const [attestationSubmitting, setAttestationSubmitting] = useState(false);
  const [attestationError, setAttestationError] = useState<string | null>(null);
  const [attestationReloadKey, setAttestationReloadKey] = useState(0);
  const progressRef = useRef<CoursePublicationProgress | null>(null);
  const lessonHeadingRef = useRef<HTMLHeadingElement>(null);
  const progressQueueRef = useRef<ReturnType<
    typeof createPublishedCourseProgressQueue
  > | null>(null);
  if (progressQueueRef.current === null) {
    progressQueueRef.current = createPublishedCourseProgressQueue({
      readProgress: () => progressRef.current,
      execute: async ({
        publicationId: targetPublicationId,
        revisionId,
        lessonRef,
        completed,
      }) => {
        const payload = await courseBuilderRequest<{
          progress: CoursePublicationProgress;
        }>(
          `/api/v2/course-catalog/${encodeURIComponent(targetPublicationId)}/progress`,
          {
            method: "PUT",
            body: JSON.stringify({
              expectedRevisionId: revisionId,
              lessonRef,
              completed,
            }),
          },
        );
        return payload.progress;
      },
      onCommit: (nextProgress) => {
        progressRef.current = nextProgress;
        setProgress(nextProgress);
      },
      onError: (caught) => {
        setProgressError(
          caught instanceof Error
            ? caught.message
            : "Не удалось сохранить прогресс.",
        );
      },
      onBusyChange: setProgressBusy,
    });
  }
  const progressQueue = progressQueueRef.current;

  useEffect(() => {
    let active = true;
    progressQueue.activate(null);
    progressRef.current = null;
    setCourse(null);
    setProgress(null);
    setError(null);
    setCopyError(null);
    setProgressError(null);
    setAttestation(null);
    setAttestationError(null);
    setActiveSurface("lessons");
    setSelectedLessonRef(null);
    setActiveSlideIndex(0);

    void (async () => {
      const payload = await courseBuilderRequest<{
        course: CourseCatalogDetail;
      }>(`/api/v2/course-catalog/${encodeURIComponent(publicationId)}`, {
        cache: "no-store",
      });
      if (!active) return;
      if (payload.course.learningAudience === "educators") {
        progressQueue.activate({
          publicationId: payload.course.id,
          revisionId: payload.course.revisionId,
        });
      }
      setCourse(payload.course);

      if (payload.course.learningAudience !== "educators") {
        const nextProgress = emptyProgress(payload.course);
        progressRef.current = nextProgress;
        setProgress(nextProgress);
        return;
      }

      try {
        const progressPayload = await courseBuilderRequest<{
          progress: CoursePublicationProgress;
        }>(
          `/api/v2/course-catalog/${encodeURIComponent(publicationId)}/progress`,
          { cache: "no-store" },
        );
        if (!active) return;
        const identity = {
          publicationId: payload.course.id,
          revisionId: payload.course.revisionId,
        };
        if (!isProgressForIdentity(progressPayload.progress, identity)) {
          throw new Error("Сервис вернул прогресс другой версии курса.");
        }
        progressRef.current = progressPayload.progress;
        setProgress(progressPayload.progress);
      } catch (caught) {
        if (!active) return;
        setProgressError(
          caught instanceof Error
            ? caught.message
            : "Не удалось загрузить прогресс курса.",
        );
      }
    })().catch((caught: unknown) => {
      if (!active) return;
      setError(
        caught instanceof Error
          ? caught.message
          : "Не удалось открыть опубликованный курс.",
      );
    });

    return () => {
      active = false;
    };
  }, [progressQueue, publicationId, reloadKey]);

  useEffect(() => {
    if (!selectedLessonRef || activeSurface !== "lessons") return;
    const frame = window.requestAnimationFrame(() => {
      lessonHeadingRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeSurface, selectedLessonRef]);

  // Load the safe attestation projection as soon as the course is complete.
  // This keeps the certified badge correct on the initial course header.
  useEffect(() => {
    if (course?.learningAudience !== "educators" || !progress?.complete) {
      return;
    }

    let active = true;
    setAttestationLoading(true);
    setAttestationError(null);
    void courseBuilderRequest<{ attestation: CourseAttestationState }>(
      `/api/v2/course-catalog/${encodeURIComponent(publicationId)}/attestation`,
      { cache: "no-store" },
    )
      .then((payload) => {
        if (active) setAttestation(payload.attestation);
      })
      .catch((caught: unknown) => {
        if (!active) return;
        setAttestationError(
          caught instanceof Error
            ? caught.message
            : "Не удалось загрузить аттестацию.",
        );
      })
      .finally(() => {
        if (active) setAttestationLoading(false);
      });

    return () => {
      active = false;
    };
  }, [
    attestationReloadKey,
    course?.learningAudience,
    progress?.complete,
    publicationId,
  ]);

  const selectedLesson = useMemo(
    () =>
      course?.lessons.find((lesson) => lesson.id === selectedLessonRef) ?? null,
    [course, selectedLessonRef],
  );
  const resumeLesson = useMemo(
    () =>
      course?.lessons.find(
        (lesson) => lesson.id === progress?.lastOpenedLessonRef,
      ) ?? null,
    [course, progress?.lastOpenedLessonRef],
  );
  const assets = useMemo<SignedCourseComponentAssetMap>(
    () =>
      Object.fromEntries(
        (course?.materials ?? []).map((material) => [
          material.id,
          {
            id: material.id,
            originalFilename: material.originalFilename,
            mimeType: material.mimeType,
            signedUrl: safeMaterialUrl(material.downloadUrl),
          },
        ]),
      ),
    [course],
  );

  async function copyCourse() {
    if (!course || course.learningAudience === "educators" || copyBusy) return;
    setCopyBusy(true);
    setCopyError(null);
    try {
      const payload = await courseBuilderRequest<{ courseId: string }>(
        `/api/v2/course-catalog/${encodeURIComponent(course.id)}/copy`,
        { method: "POST" },
      );
      router.push(toCourseRoute(payload.courseId));
    } catch (caught) {
      setCopyError(
        caught instanceof Error ? caught.message : "Не удалось добавить курс.",
      );
      setCopyBusy(false);
    }
  }

  function updateProgress(lesson: CourseCatalogLesson, completed: boolean) {
    if (!course || course.learningAudience !== "educators") return;
    const queued = progressQueue.enqueue({
      kind: "completion",
      lessonRef: lesson.id,
      completed,
    });
    if (queued) setProgressError(null);
  }

  function openLesson(lesson: CourseCatalogLesson) {
    setSelectedLessonRef(lesson.id);
    setActiveSurface("lessons");
    setActiveSlideIndex(0);
    // The serialized idempotent mutation also records the resume pointer.
    const queued = progressQueue.enqueue({
      kind: "open",
      lessonRef: lesson.id,
    });
    if (queued) setProgressError(null);
  }

  async function submitAttestation(
    expectedRevisionId: string,
    selectedOptionByQuestionId: Record<string, string>,
  ) {
    if (attestationSubmitting) return;
    setAttestationSubmitting(true);
    setAttestationError(null);
    try {
      const payload = await courseBuilderRequest<{
        attestation: CourseAttestationState;
      }>(
        `/api/v2/course-catalog/${encodeURIComponent(publicationId)}/attestation`,
        {
          method: "POST",
          body: JSON.stringify({
            expectedRevisionId,
            selectedOptionByQuestionId,
          }),
        },
      );
      setAttestation(payload.attestation);
    } catch (caught) {
      setAttestationError(
        caught instanceof Error
          ? caught.message
          : "Не удалось завершить аттестацию.",
      );
    } finally {
      setAttestationSubmitting(false);
    }
  }

  if (!course) {
    return (
      <div className="container app-page-container py-12">
        {error ? (
          <SurfaceCard className="border border-rose-200">
            <p className="text-sm font-medium text-rose-800" role="alert">
              {error}
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link
                href={catalogHref(catalogAudience)}
                className={productButtonClassName("secondary")}
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                Назад к каталогу
              </Link>
              <Button
                variant="secondary"
                onClick={() => setReloadKey((value) => value + 1)}
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                Повторить
              </Button>
            </div>
          </SurfaceCard>
        ) : (
          <SurfaceCard className="flex items-center gap-3 border border-neutral-200">
            <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden="true" />
            <p role="status">Загружаем курс…</p>
          </SurfaceCard>
        )}
      </div>
    );
  }

  const educatorCourse = course.learningAudience === "educators";
  const ownSourceCourseId = course.author.isCurrentUser
    ? course.sourceCourseId
    : null;
  const tabs = [
    { value: "lessons", label: "Уроки", count: course.lessons.length },
    { value: "about", label: "О курсе" },
    { value: "materials", label: "Материалы", count: course.materials.length },
    ...(educatorCourse ? [{ value: "attestation", label: "Аттестация" }] : []),
  ] as Array<{
    value: PublishedCourseSurface;
    label: string;
    count?: number;
  }>;
  const completedRefs = new Set(progress?.completedLessonRefs ?? []);
  const activeSlides = selectedLesson?.slides ?? [];
  const activeSlide =
    activeSlides[
      Math.min(activeSlideIndex, Math.max(activeSlides.length - 1, 0))
    ];

  return (
    <div className="container app-page-container course-workspace-container published-course-workspace pb-16">
      <AppPageHeader
        eyebrow={educatorCourse ? "Повышение квалификации" : "Курс из каталога"}
        back={{
          type: "link",
          href: catalogHref(course.learningAudience),
          label: "Каталог",
        }}
        title={course.title}
        description={`${course.subject} · ${course.level}`}
        actions={
          <>
            {attestation?.certified ? (
              <Chip icon={BadgeCheck} tone="emerald">
                Аттестован
              </Chip>
            ) : null}
            {course.author.isShiDao ? <Chip tone="inverse">ShiDao</Chip> : null}
            {educatorCourse || !course.author.isShiDao ? (
              <Chip icon={UserRound} tone="neutral">
                Автор: {course.author.displayName}
              </Chip>
            ) : null}
            {!educatorCourse && ownSourceCourseId ? (
              <Link
                href={toCourseRoute(ownSourceCourseId)}
                className={productButtonClassName("primary")}
              >
                Открыть мой курс
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            ) : !educatorCourse ? (
              <Button disabled={copyBusy} onClick={() => void copyCourse()}>
                {copyBusy ? "Добавляем…" : "Добавить в мои курсы"}
              </Button>
            ) : null}
          </>
        }
      />

      {copyError ? (
        <p className="app-alert app-alert-error" role="alert">
          {copyError}
        </p>
      ) : null}

      {educatorCourse && progress ? (
        <section
          className="published-course-progress"
          aria-label="Прогресс курса"
        >
          <div className="published-course-progress-summary">
            <strong>
              Пройдено {progress.completedLessonCount} из{" "}
              {progress.totalLessonCount}
            </strong>
            <span>{progress.percent}%</span>
          </div>
          <div className="published-course-progress-track" aria-hidden="true">
            <span style={{ width: `${progress.percent}%` }} />
          </div>
          {resumeLesson ? (
            <div className="published-course-resume">
              <span>Продолжить с урока «{resumeLesson.title}»</span>
              <Button variant="ghost" onClick={() => openLesson(resumeLesson)}>
                Продолжить
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          ) : null}
        </section>
      ) : null}

      {educatorCourse && progressError ? (
        <div className="app-alert app-alert-error published-course-progress-error">
          <p role="alert">{progressError}</p>
          <Button
            variant="secondary"
            onClick={() => setReloadKey((value) => value + 1)}
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Повторить
          </Button>
        </div>
      ) : null}

      <WorkspaceTabs
        idBase={PUBLISHED_COURSE_TABS_ID}
        ariaLabel="Разделы опубликованного курса"
        value={activeSurface}
        items={tabs}
        onChange={setActiveSurface}
      />

      <div
        id={workspaceTabPanelId(PUBLISHED_COURSE_TABS_ID, "lessons")}
        role="tabpanel"
        aria-labelledby={workspaceTabId(PUBLISHED_COURSE_TABS_ID, "lessons")}
        hidden={activeSurface !== "lessons"}
        tabIndex={0}
      >
        {selectedLesson ? (
          <section className="published-course-lesson">
            <Button variant="ghost" onClick={() => setSelectedLessonRef(null)}>
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Все уроки
            </Button>
            <div className="published-course-lesson-heading">
              <div>
                <p className="workspace-eyebrow">
                  Урок {selectedLesson.position}
                </p>
                <h2 ref={lessonHeadingRef} tabIndex={-1}>
                  {selectedLesson.title}
                </h2>
              </div>
              {educatorCourse ? (
                <Button
                  variant={
                    completedRefs.has(selectedLesson.id)
                      ? "secondary"
                      : "primary"
                  }
                  aria-pressed={completedRefs.has(selectedLesson.id)}
                  aria-label={
                    completedRefs.has(selectedLesson.id)
                      ? `Снять отметку о прохождении урока «${selectedLesson.title}»`
                      : `Отметить урок «${selectedLesson.title}» пройденным`
                  }
                  disabled={progressBusy || !progress}
                  onClick={() =>
                    void updateProgress(
                      selectedLesson,
                      !completedRefs.has(selectedLesson.id),
                    )
                  }
                >
                  {completedRefs.has(selectedLesson.id) ? (
                    <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <Check className="h-4 w-4" aria-hidden="true" />
                  )}
                  {completedRefs.has(selectedLesson.id)
                    ? "Снять отметку о прохождении"
                    : "Отметить пройденным"}
                </Button>
              ) : null}
            </div>
            <div className="published-course-slide">
              {activeSlide ? (
                activeSlide.components.map((component) => (
                  <CourseComponentRenderer
                    key={component.id}
                    component={component}
                    assets={assets}
                    mode="student"
                  />
                ))
              ) : (
                <p className="workspace-empty-panel">
                  В этом уроке нет материалов для просмотра.
                </p>
              )}
            </div>
            {activeSlides.length > 1 ? (
              <div className="published-course-slide-navigation">
                <Button
                  variant="secondary"
                  disabled={activeSlideIndex === 0}
                  onClick={() =>
                    setActiveSlideIndex((index) => Math.max(0, index - 1))
                  }
                >
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                  Предыдущий
                </Button>
                <span>
                  Слайд {activeSlideIndex + 1} из {activeSlides.length}
                </span>
                <Button
                  variant="secondary"
                  disabled={activeSlideIndex === activeSlides.length - 1}
                  onClick={() =>
                    setActiveSlideIndex((index) =>
                      Math.min(activeSlides.length - 1, index + 1),
                    )
                  }
                >
                  Следующий
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            ) : null}
          </section>
        ) : (
          <ol
            className="published-course-lesson-directory"
            aria-label="Уроки курса"
          >
            {course.lessons.map((lesson) => {
              const isResumeLesson = resumeLesson?.id === lesson.id;
              return (
                <li key={lesson.id}>
                  <button
                    type="button"
                    className={
                      isResumeLesson ? "published-course-lesson-resume" : ""
                    }
                    aria-current={isResumeLesson ? "step" : undefined}
                    onClick={() => openLesson(lesson)}
                  >
                    <span className="published-course-lesson-status">
                      {educatorCourse && completedRefs.has(lesson.id) ? (
                        <CheckCircle2 aria-hidden="true" />
                      ) : educatorCourse ? (
                        <Circle aria-hidden="true" />
                      ) : (
                        <BookOpen aria-hidden="true" />
                      )}
                    </span>
                    <span className="published-course-lesson-copy">
                      <small>
                        Урок {lesson.position}
                        {isResumeLesson ? " · продолжить отсюда" : ""}
                      </small>
                      <strong>{lesson.title}</strong>
                      {lesson.estimatedDurationMinutes ? (
                        <em>{lesson.estimatedDurationMinutes} мин</em>
                      ) : null}
                    </span>
                    <ArrowRight
                      className="published-course-lesson-arrow"
                      aria-hidden="true"
                    />
                  </button>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      <div
        id={workspaceTabPanelId(PUBLISHED_COURSE_TABS_ID, "about")}
        role="tabpanel"
        aria-labelledby={workspaceTabId(PUBLISHED_COURSE_TABS_ID, "about")}
        hidden={activeSurface !== "about"}
        tabIndex={0}
      >
        <SurfaceCard title="О курсе" description={course.goal}>
          <div className="course-catalog-detail-grid">
            <section>
              <h3>Кому подходит</h3>
              <p>{course.audienceDescription || "Аудитория не указана."}</p>
            </section>
            <section>
              <h3>Программа</h3>
              <p>
                {course.lessonCount} уроков · план: {course.targetLessonCount}
              </p>
            </section>
          </div>
        </SurfaceCard>
      </div>

      <div
        id={workspaceTabPanelId(PUBLISHED_COURSE_TABS_ID, "materials")}
        role="tabpanel"
        aria-labelledby={workspaceTabId(PUBLISHED_COURSE_TABS_ID, "materials")}
        hidden={activeSurface !== "materials"}
        tabIndex={0}
      >
        <SurfaceCard title="Материалы курса">
          {course.materials.length ? (
            <ul className="course-catalog-material-list">
              {course.materials.map((material) => {
                const materialUrl = safeMaterialUrl(material.downloadUrl);
                return (
                  <li key={material.id}>
                    <span className="min-w-0">
                      <strong>{material.originalFilename}</strong>
                      <small>
                        {material.mimeType} ·{" "}
                        {formatFileSize(material.sizeBytes)}
                      </small>
                    </span>
                    {materialUrl ? (
                      <a
                        href={materialUrl}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`Открыть материал «${material.originalFilename}»`}
                        className={productButtonClassName("secondary")}
                      >
                        <FileText className="h-4 w-4" aria-hidden="true" />
                        Открыть
                      </a>
                    ) : (
                      <span className="text-sm text-neutral-500">
                        Материал недоступен
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p>В курсе нет отдельных материалов.</p>
          )}
        </SurfaceCard>
      </div>

      {educatorCourse ? (
        <div
          id={workspaceTabPanelId(PUBLISHED_COURSE_TABS_ID, "attestation")}
          role="tabpanel"
          aria-labelledby={workspaceTabId(
            PUBLISHED_COURSE_TABS_ID,
            "attestation",
          )}
          hidden={activeSurface !== "attestation"}
          tabIndex={0}
        >
          {!progress?.complete ? (
            <SurfaceCard
              className="published-course-attestation-lock"
              title={
                <span className="published-course-attestation-lock-title">
                  <LockKeyhole className="h-5 w-5" aria-hidden="true" />
                  Аттестация откроется после курса
                </span>
              }
              description={
                progress
                  ? `Завершите все уроки: сейчас пройдено ${progress.completedLessonCount} из ${progress.totalLessonCount}.`
                  : "Сначала загрузите прогресс курса."
              }
            >
              <Button
                variant="secondary"
                onClick={() => setActiveSurface("lessons")}
              >
                <BookOpen className="h-4 w-4" aria-hidden="true" />
                Вернуться к урокам
              </Button>
            </SurfaceCard>
          ) : (
            <SurfaceCard>
              <CourseAttestationPanel
                attestation={attestation}
                loading={attestationLoading}
                error={attestationError}
                submitting={attestationSubmitting}
                onRetry={() => setAttestationReloadKey((value) => value + 1)}
                onSubmit={(expectedRevisionId, answers) =>
                  void submitAttestation(expectedRevisionId, answers)
                }
              />
            </SurfaceCard>
          )}
        </div>
      ) : null}
    </div>
  );
}
