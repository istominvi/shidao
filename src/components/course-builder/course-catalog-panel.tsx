"use client";

import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  BookOpen,
  CheckCircle2,
  FileText,
  LayoutGrid,
  LoaderCircle,
  RotateCcw,
  Search,
  Table2,
  UserRound,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { courseBuilderRequest } from "@/components/course-builder/course-builder-client";
import { courseCountLabel } from "@/components/course-builder/course-catalog";
import { CourseFilterMenu } from "@/components/course-builder/course-filter-menu";
import { Button, productButtonClassName } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Input } from "@/components/ui/input";
import {
  ProductTable,
  ProductTableActionCell,
  ProductTableBody,
  ProductTableCell,
  ProductTableHead,
  ProductTableHeaderCell,
  ProductTableHeaderRow,
  ProductTablePrimaryCell,
  ProductTableRow,
  ProductTableTruncate,
} from "@/components/ui/product-table";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { SurfaceCard } from "@/components/ui/surface-card";
import {
  WorkspaceTabs,
  workspaceTabId,
  workspaceTabPanelId,
} from "@/components/ui/workspace-tabs";
import { toCourseRoute } from "@/lib/auth";
import type { CourseAttestationState } from "@/modules/course-attestations/domain";
import type { CourseLearningAudience } from "@/modules/course-builder/learning-audience";
import type {
  CourseCatalogDetail,
  CourseCatalogEntry,
} from "@/modules/course-publications/domain";

type CourseCatalogPanelProps = {
  active: boolean;
  selectedCourseId: string | null;
  onSelectCourse: (courseId: string | null) => void;
  learningAudience: CourseLearningAudience;
  onLearningAudienceChange: (audience: CourseLearningAudience) => void;
};

function formatFileSize(sizeBytes: number) {
  if (sizeBytes < 1024 * 1024) return `${Math.ceil(sizeBytes / 1024)} КБ`;
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} МБ`;
}

type CatalogPage = {
  courses: CourseCatalogEntry[];
  facets: { subjects: string[]; levels: string[] };
  nextCursor: string | null;
};

type CourseCatalogView = "grid" | "table";
type CatalogDetailTab = "overview" | "attestation";

const CATALOG_DETAIL_TABS_ID = "course-catalog-detail";
const CATALOG_DETAIL_TABS = [
  { value: "overview", label: "О курсе" },
  { value: "attestation", label: "Аттестация" },
] as const satisfies ReadonlyArray<{
  value: CatalogDetailTab;
  label: string;
}>;

function CatalogLearningAudienceControl({
  value,
  onChange,
  disabled = false,
}: {
  value: CourseLearningAudience;
  onChange: (value: CourseLearningAudience) => void;
  disabled?: boolean;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <SegmentedControl
        ariaLabel="Направление обучения"
        value={value}
        onChange={onChange}
        disabled={disabled}
        items={[
          { value: "children", label: "Обучение детей" },
          { value: "educators", label: "Обучение педагогов" },
        ]}
      />
    </div>
  );
}

function catalogRequestPath({
  query,
  subject,
  level,
  learningAudience,
  cursor,
}: {
  query: string;
  subject: string;
  level: string;
  learningAudience: CourseLearningAudience;
  cursor?: string | null;
}) {
  const params = new URLSearchParams({ limit: "50" });
  params.set("learningAudience", learningAudience);
  const normalizedQuery = query.trim().replace(/\s+/g, " ");
  if (normalizedQuery) params.set("q", normalizedQuery);
  if (subject !== "all") params.set("subject", subject);
  if (level !== "all") params.set("level", level);
  if (cursor) params.set("cursor", cursor);
  return `/api/v2/course-catalog?${params.toString()}`;
}

function CatalogCourseCard({
  course,
  onOpen,
}: {
  course: CourseCatalogEntry;
  onOpen: () => void;
}) {
  return (
    <SurfaceCard
      as="article"
      className="flex h-full flex-col border border-white/80"
      title={
        <button
          type="button"
          className="text-left transition hover:text-sky-700 focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/50"
          onClick={onOpen}
        >
          {course.title}
        </button>
      }
      description={`${course.subject} · ${course.level}`}
      actions={
        <Chip tone={course.author.isShiDao ? "inverse" : "neutral"}>
          {course.author.isShiDao ? "ShiDao" : course.author.displayName}
        </Chip>
      }
    >
      <p className="line-clamp-3 text-sm leading-relaxed text-neutral-700">
        {course.goal}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Chip icon={BookOpen} tone="violet">
          Уроков: {course.lessonCount}
        </Chip>
        <Chip icon={FileText} tone="slate">
          Материалов: {course.materialCount}
        </Chip>
      </div>
      <div className="mt-5 flex items-center justify-end border-t border-neutral-100 pt-4">
        <Button variant="secondary" onClick={onOpen}>
          Подробнее
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
    </SurfaceCard>
  );
}

function CatalogCourseTable({
  courses,
  onOpen,
}: {
  courses: CourseCatalogEntry[];
  onOpen: (courseId: string) => void;
}) {
  return (
    <div
      className="product-table-wrap course-index-table-wrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/50"
      role="region"
      aria-label="Таблица курсов каталога"
      tabIndex={0}
    >
      <ProductTable className="course-index-table course-index-catalog-table">
        <caption className="sr-only">
          Курсы каталога: предмет, уровень, автор и наполнение
        </caption>
        <colgroup>
          <col className="course-index-table-col-title" />
          <col className="course-index-table-col-subject" />
          <col className="course-index-table-col-level" />
          <col className="course-index-table-col-author" />
          <col className="course-index-table-col-lessons" />
          <col className="course-index-table-col-materials" />
          <col className="course-index-table-col-actions" />
        </colgroup>
        <ProductTableHead>
          <ProductTableHeaderRow>
            <ProductTableHeaderCell>Курс</ProductTableHeaderCell>
            <ProductTableHeaderCell>Предмет</ProductTableHeaderCell>
            <ProductTableHeaderCell>Уровень</ProductTableHeaderCell>
            <ProductTableHeaderCell>Автор</ProductTableHeaderCell>
            <ProductTableHeaderCell>Уроки</ProductTableHeaderCell>
            <ProductTableHeaderCell>Материалы</ProductTableHeaderCell>
            <ProductTableHeaderCell aria-label="Действия" />
          </ProductTableHeaderRow>
        </ProductTableHead>
        <ProductTableBody>
          {courses.map((course) => (
            <ProductTableRow key={course.id}>
              <ProductTablePrimaryCell className="overflow-hidden">
                <button
                  type="button"
                  className="course-index-table-link"
                  title={`${course.title} — ${course.goal}`}
                  onClick={() => onOpen(course.id)}
                >
                  <ProductTableTruncate>{course.title}</ProductTableTruncate>
                </button>
              </ProductTablePrimaryCell>
              <ProductTableCell className="overflow-hidden">
                <ProductTableTruncate title={course.subject}>
                  {course.subject}
                </ProductTableTruncate>
              </ProductTableCell>
              <ProductTableCell className="overflow-hidden">
                <ProductTableTruncate title={course.level}>
                  {course.level}
                </ProductTableTruncate>
              </ProductTableCell>
              <ProductTableCell className="overflow-hidden">
                <ProductTableTruncate
                  title={
                    course.author.isShiDao
                      ? "ShiDao"
                      : course.author.displayName
                  }
                >
                  {course.author.isShiDao
                    ? "ShiDao"
                    : course.author.displayName}
                </ProductTableTruncate>
              </ProductTableCell>
              <ProductTableCell className="overflow-hidden">
                <ProductTableTruncate title={`Уроков: ${course.lessonCount}`}>
                  {course.lessonCount}
                </ProductTableTruncate>
              </ProductTableCell>
              <ProductTableCell className="overflow-hidden">
                <ProductTableTruncate
                  title={`Материалов: ${course.materialCount}`}
                >
                  {course.materialCount}
                </ProductTableTruncate>
              </ProductTableCell>
              <ProductTableActionCell className="course-index-table-action-cell text-right">
                <button
                  type="button"
                  className="course-index-table-open-action"
                  aria-label={`Открыть курс «${course.title}»`}
                  onClick={() => onOpen(course.id)}
                >
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </button>
              </ProductTableActionCell>
            </ProductTableRow>
          ))}
        </ProductTableBody>
      </ProductTable>
    </div>
  );
}

function formatAttestationCompletedAt(value: string) {
  const completedAt = new Date(value);
  if (Number.isNaN(completedAt.getTime())) return value;
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(completedAt);
}

function CourseAttestationPanel({
  attestation,
  loading,
  error,
  submitting,
  onRetry,
  onSubmit,
}: {
  attestation: CourseAttestationState | null;
  loading: boolean;
  error: string | null;
  submitting: boolean;
  onRetry: () => void;
  onSubmit: (
    expectedRevisionId: string,
    answers: Record<string, string>,
  ) => void;
}) {
  const [selectedOptionByQuestionId, setSelectedOptionByQuestionId] = useState<
    Record<string, string>
  >({});

  useEffect(() => {
    if (!attestation || attestation.certified) {
      setSelectedOptionByQuestionId({});
      return;
    }
    const selected = Object.fromEntries(
      attestation.questions.flatMap((question) => {
        const optionId =
          question.selectedOptionId ??
          attestation.attempt?.selectedOptionByQuestionId[question.id];
        return optionId ? [[question.id, optionId]] : [];
      }),
    );
    setSelectedOptionByQuestionId(selected);
  }, [attestation]);

  if (loading && !attestation) {
    return (
      <div className="course-index-status flex items-center gap-3 rounded-2xl border border-neutral-200 bg-neutral-50 p-5">
        <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden="true" />
        <p className="text-sm font-medium text-neutral-700" role="status">
          Загружаем аттестацию…
        </p>
      </div>
    );
  }

  if (error && !attestation) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5">
        <p className="text-sm font-medium text-rose-800" role="alert">
          {error}
        </p>
        <Button variant="secondary" className="mt-4" onClick={onRetry}>
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          Повторить
        </Button>
      </div>
    );
  }

  if (!attestation) return null;

  const allQuestionsAnswered = attestation.questions.every(
    (question) => selectedOptionByQuestionId[question.id],
  );

  return (
    <div className="space-y-5">
      <div>
        <p className="workspace-eyebrow">Итоговая проверка</p>
        <h3 className="mt-1 text-xl font-semibold text-neutral-950">
          {attestation.title}
        </h3>
        {attestation.description ? (
          <p className="mt-2 max-w-3xl whitespace-pre-wrap text-sm leading-relaxed text-neutral-600">
            {attestation.description}
          </p>
        ) : null}
        <p className="mt-2 text-sm text-neutral-600">
          Проходной результат: {attestation.passingScorePercent}%
        </p>
      </div>

      {attestation.certified && attestation.attempt ? (
        <>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
            <div className="flex items-center gap-2 font-semibold">
              <BadgeCheck className="h-5 w-5" aria-hidden="true" />
              Аттестация пройдена
            </div>
            <p className="mt-1 text-sm">
              Результат: {attestation.attempt.scorePercent}% · Завершено{" "}
              {formatAttestationCompletedAt(attestation.attempt.completedAt)}
            </p>
          </div>

          <ol className="space-y-4" aria-label="Разбор аттестации">
            {attestation.questions.map((question, questionIndex) => {
              const selectedOptionId =
                question.selectedOptionId ??
                attestation.attempt?.selectedOptionByQuestionId[question.id];

              return (
                <li
                  key={question.id}
                  className="rounded-2xl border border-neutral-200 bg-neutral-50/80 p-4"
                >
                  <h4 className="font-semibold text-neutral-950">
                    {questionIndex + 1}. {question.prompt}
                  </h4>
                  <ul className="mt-3 space-y-2">
                    {question.options.map((option) => {
                      const selected = option.id === selectedOptionId;
                      const correct = option.id === question.correctOptionId;
                      return (
                        <li
                          key={option.id}
                          className={`flex items-start justify-between gap-3 rounded-xl border px-3 py-2 text-sm ${
                            correct
                              ? "border-emerald-200 bg-emerald-50 text-emerald-950"
                              : selected
                                ? "border-rose-200 bg-rose-50 text-rose-950"
                                : "border-neutral-200 bg-white text-neutral-700"
                          }`}
                        >
                          <span>{option.label}</span>
                          <span className="shrink-0 text-xs font-semibold">
                            {selected && correct
                              ? "Ваш ответ · верно"
                              : selected
                                ? "Ваш ответ"
                                : correct
                                  ? "Правильный ответ"
                                  : null}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                  {question.explanation ? (
                    <p className="mt-3 flex items-start gap-2 text-sm leading-relaxed text-neutral-700">
                      <CheckCircle2
                        className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700"
                        aria-hidden="true"
                      />
                      <span>{question.explanation}</span>
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ol>
        </>
      ) : (
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit(attestation.revisionId, selectedOptionByQuestionId);
          }}
        >
          {attestation.attempt ? (
            <p
              className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
              role="status"
            >
              Предыдущий результат: {attestation.attempt.scorePercent}%. Для
              аттестации нужно {attestation.passingScorePercent}%. Можно пройти
              тест ещё раз.
            </p>
          ) : null}

          {attestation.questions.map((question, questionIndex) => (
            <fieldset
              key={question.id}
              disabled={submitting}
              className="rounded-2xl border border-neutral-200 bg-neutral-50/80 p-4"
            >
              <legend className="px-1 font-semibold text-neutral-950">
                {questionIndex + 1}. {question.prompt}
              </legend>
              <div className="mt-3 space-y-2">
                {question.options.map((option) => (
                  <label
                    key={option.id}
                    className="flex cursor-pointer items-start gap-3 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-800 transition hover:border-neutral-400"
                  >
                    <input
                      type="radio"
                      name={`attestation-${question.id}`}
                      value={option.id}
                      checked={
                        selectedOptionByQuestionId[question.id] === option.id
                      }
                      onChange={() =>
                        setSelectedOptionByQuestionId((current) => ({
                          ...current,
                          [question.id]: option.id,
                        }))
                      }
                      className="mt-0.5 h-4 w-4 accent-neutral-950"
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          ))}

          {error ? (
            <p className="app-alert app-alert-error" role="alert">
              {error}
            </p>
          ) : null}
          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={submitting || !allQuestionsAnswered}
            >
              {submitting ? "Проверяем…" : "Завершить аттестацию"}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

function CatalogCourseDetailView({
  courseId,
  onBack,
}: {
  courseId: string;
  onBack: () => void;
}) {
  const router = useRouter();
  const [course, setCourse] = useState<CourseCatalogDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copyBusy, setCopyBusy] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [activeTab, setActiveTab] = useState<CatalogDetailTab>("overview");
  const [attestation, setAttestation] = useState<CourseAttestationState | null>(
    null,
  );
  const [attestationLoading, setAttestationLoading] = useState(false);
  const [attestationSubmitting, setAttestationSubmitting] = useState(false);
  const [attestationError, setAttestationError] = useState<string | null>(null);
  const [attestationReloadKey, setAttestationReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    setCourse(null);
    setError(null);
    void courseBuilderRequest<{ course: CourseCatalogDetail }>(
      `/api/v2/course-catalog/${encodeURIComponent(courseId)}`,
      { cache: "no-store" },
    )
      .then((payload) => {
        if (active) setCourse(payload.course);
      })
      .catch((caught: unknown) => {
        if (!active) return;
        setError(
          caught instanceof Error
            ? caught.message
            : "Не удалось открыть курс из каталога.",
        );
      });
    return () => {
      active = false;
    };
  }, [courseId, reloadKey]);

  useEffect(() => {
    setActiveTab("overview");
  }, [courseId]);

  useEffect(() => {
    if (course?.learningAudience !== "educators") {
      setAttestation(null);
      setAttestationError(null);
      setAttestationLoading(false);
      return;
    }

    let active = true;
    setAttestationLoading(true);
    setAttestationError(null);
    void courseBuilderRequest<{ attestation: CourseAttestationState }>(
      `/api/v2/course-catalog/${encodeURIComponent(courseId)}/attestation`,
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
  }, [attestationReloadKey, course?.learningAudience, courseId]);

  async function copyCourse() {
    if (copyBusy) return;
    setCopyBusy(true);
    setError(null);
    try {
      const payload = await courseBuilderRequest<{ courseId: string }>(
        `/api/v2/course-catalog/${encodeURIComponent(courseId)}/copy`,
        { method: "POST" },
      );
      router.push(toCourseRoute(payload.courseId));
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Не удалось добавить курс.",
      );
      setCopyBusy(false);
    }
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
      }>(`/api/v2/course-catalog/${encodeURIComponent(courseId)}/attestation`, {
        method: "POST",
        body: JSON.stringify({
          expectedRevisionId,
          selectedOptionByQuestionId,
        }),
      });
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

  if (error && !course) {
    return (
      <SurfaceCard className="course-index-error border border-rose-200">
        <p className="text-sm font-medium text-rose-800" role="alert">
          {error}
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button variant="secondary" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Назад к каталогу
          </Button>
          <Button
            variant="secondary"
            onClick={() => setReloadKey((current) => current + 1)}
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Повторить
          </Button>
        </div>
      </SurfaceCard>
    );
  }

  if (!course) {
    return (
      <SurfaceCard className="course-index-status flex items-center gap-3 border border-neutral-200">
        <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden="true" />
        <p className="text-sm font-medium text-neutral-700" role="status">
          Загружаем курс из каталога…
        </p>
      </SurfaceCard>
    );
  }

  const ownSourceCourseId = course.author.isCurrentUser
    ? course.sourceCourseId
    : null;
  const educatorCourse = course.learningAudience === "educators";

  return (
    <article className="course-catalog-detail">
      <Button variant="ghost" onClick={onBack}>
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Назад к каталогу
      </Button>

      <SurfaceCard className="mt-4 border border-white/80">
        <div className="course-catalog-detail-header">
          <div className="min-w-0">
            <p className="workspace-eyebrow">Готовый курс</p>
            <h2>{course.title}</h2>
            <p>
              {course.subject} · {course.level}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {attestation?.certified ? (
              <Chip icon={BadgeCheck} tone="emerald">
                Аттестован
              </Chip>
            ) : null}
            <Chip
              icon={course.author.isShiDao ? undefined : UserRound}
              tone={course.author.isShiDao ? "inverse" : "neutral"}
            >
              {course.author.isShiDao ? "ShiDao" : course.author.displayName}
            </Chip>
          </div>
        </div>

        {educatorCourse ? (
          <WorkspaceTabs
            idBase={CATALOG_DETAIL_TABS_ID}
            ariaLabel="Разделы курса для педагогов"
            value={activeTab}
            items={CATALOG_DETAIL_TABS}
            onChange={setActiveTab}
            className="mt-5"
          />
        ) : null}

        <div
          id={
            educatorCourse
              ? workspaceTabPanelId(CATALOG_DETAIL_TABS_ID, "overview")
              : undefined
          }
          role={educatorCourse ? "tabpanel" : undefined}
          aria-labelledby={
            educatorCourse
              ? workspaceTabId(CATALOG_DETAIL_TABS_ID, "overview")
              : undefined
          }
          hidden={educatorCourse && activeTab !== "overview"}
          tabIndex={educatorCourse ? 0 : undefined}
        >
          <div className="course-catalog-detail-grid">
            <section>
              <h3>О курсе</h3>
              <p>{course.goal}</p>
            </section>
            <section>
              <h3>Кому подходит</h3>
              <p>{course.audienceDescription || "Аудитория не указана."}</p>
            </section>
          </div>

          <section className="course-catalog-detail-section">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3>Уроки курса</h3>
              <Chip icon={BookOpen} tone="violet">
                {courseCountLabel(course.lessonCount)}
              </Chip>
            </div>
            <ol className="course-catalog-lesson-list">
              {course.lessons.map((lesson) => (
                <li key={`${lesson.position}-${lesson.title}`}>
                  <span>{lesson.position}</span>
                  <div>
                    <strong>{lesson.title}</strong>
                    {lesson.summary ? <p>{lesson.summary}</p> : null}
                    {lesson.estimatedDurationMinutes ? (
                      <small>{lesson.estimatedDurationMinutes} мин</small>
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <section className="course-catalog-detail-section">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3>Материалы</h3>
              <Chip icon={FileText} tone="slate">
                {course.materials.length}
              </Chip>
            </div>
            {course.materials.length > 0 ? (
              <ul className="course-catalog-material-list">
                {course.materials.map((material) => (
                  <li key={material.id}>
                    <span className="min-w-0">
                      <strong>{material.originalFilename}</strong>
                      <small>
                        {material.mimeType} ·{" "}
                        {formatFileSize(material.sizeBytes)}
                      </small>
                    </span>
                    <a
                      href={material.downloadUrl}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`Открыть материал «${material.originalFilename}»`}
                      className={productButtonClassName("ghost")}
                    >
                      Открыть
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-neutral-600">
                В публикации нет прикреплённых материалов.
              </p>
            )}
          </section>

          <div className="course-catalog-detail-actions">
            {error ? (
              <p className="app-alert app-alert-error" role="alert">
                {error}
              </p>
            ) : null}
            <p>
              После добавления появится ваша независимая копия. Уроки можно
              изменить или создать заново.
            </p>
            {ownSourceCourseId ? (
              <Link
                href={toCourseRoute(ownSourceCourseId)}
                className={productButtonClassName("primary")}
              >
                Открыть мой курс
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            ) : educatorCourse && !attestation?.certified ? (
              <div className="flex flex-wrap items-center justify-end gap-3">
                <p className="!flex-none text-sm font-medium text-neutral-700">
                  Сначала пройдите аттестацию
                </p>
                <Button
                  variant="secondary"
                  onClick={() => setActiveTab("attestation")}
                >
                  Перейти к аттестации
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            ) : (
              <Button disabled={copyBusy} onClick={() => void copyCourse()}>
                {copyBusy ? "Добавляем…" : "Добавить в мои курсы"}
              </Button>
            )}
          </div>
        </div>

        {educatorCourse ? (
          <div
            id={workspaceTabPanelId(CATALOG_DETAIL_TABS_ID, "attestation")}
            role="tabpanel"
            aria-labelledby={workspaceTabId(
              CATALOG_DETAIL_TABS_ID,
              "attestation",
            )}
            hidden={activeTab !== "attestation"}
            tabIndex={0}
            className="pt-5"
          >
            <CourseAttestationPanel
              attestation={attestation}
              loading={attestationLoading}
              error={attestationError}
              submitting={attestationSubmitting}
              onRetry={() => setAttestationReloadKey((current) => current + 1)}
              onSubmit={(expectedRevisionId, answers) =>
                void submitAttestation(expectedRevisionId, answers)
              }
            />
          </div>
        ) : null}
      </SurfaceCard>
    </article>
  );
}

export function CourseCatalogPanel({
  active,
  selectedCourseId,
  onSelectCourse,
  learningAudience,
  onLearningAudienceChange,
}: CourseCatalogPanelProps) {
  const [courses, setCourses] = useState<CourseCatalogEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [subject, setSubject] = useState("all");
  const [level, setLevel] = useState("all");
  const [subjects, setSubjects] = useState<string[]>([]);
  const [levels, setLevels] = useState<string[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [view, setView] = useState<CourseCatalogView>("grid");
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const requestContextRef = useRef("");
  requestContextRef.current = JSON.stringify([
    debouncedQuery,
    subject,
    level,
    learningAudience,
    reloadKey,
  ]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setDebouncedQuery(query), 300);
    return () => window.clearTimeout(timeoutId);
  }, [query]);

  useEffect(() => {
    if (!active) return;
    let mounted = true;
    setError(null);
    setNextCursor(null);
    setLoadingCatalog(true);
    setLoadingMore(false);
    void courseBuilderRequest<CatalogPage>(
      catalogRequestPath({
        query: debouncedQuery,
        subject,
        level,
        learningAudience,
      }),
      { cache: "no-store" },
    )
      .then((payload) => {
        if (!mounted) return;
        setCourses(payload.courses);
        setNextCursor(payload.nextCursor);
        setSubjects(payload.facets.subjects);
        setLevels(payload.facets.levels);
        setError(null);
      })
      .catch((caught: unknown) => {
        if (!mounted) return;
        setError(
          caught instanceof Error
            ? caught.message
            : "Не удалось загрузить каталог курсов.",
        );
      })
      .finally(() => {
        if (mounted) setLoadingCatalog(false);
      });
    return () => {
      mounted = false;
    };
  }, [active, debouncedQuery, learningAudience, level, reloadKey, subject]);

  async function loadMoreCourses() {
    if (!nextCursor || loadingMore) return;
    const requestContext = requestContextRef.current;
    setLoadingMore(true);
    setError(null);
    try {
      const payload = await courseBuilderRequest<CatalogPage>(
        catalogRequestPath({
          query: debouncedQuery,
          subject,
          level,
          learningAudience,
          cursor: nextCursor,
        }),
        { cache: "no-store" },
      );
      // A filter or reload may have started a new first-page request while
      // this page was in flight. Never mix results from those two queries.
      if (requestContextRef.current !== requestContext) return;
      setCourses((current) => {
        const byId = new Map(
          (current ?? []).map((course) => [course.id, course]),
        );
        for (const course of payload.courses) byId.set(course.id, course);
        return Array.from(byId.values());
      });
      setSubjects(payload.facets.subjects);
      setLevels(payload.facets.levels);
      setNextCursor(payload.nextCursor);
    } catch (caught) {
      if (requestContextRef.current !== requestContext) return;
      setError(
        caught instanceof Error
          ? caught.message
          : "Не удалось загрузить следующую страницу каталога.",
      );
    } finally {
      if (requestContextRef.current === requestContext) {
        setLoadingMore(false);
      }
    }
  }

  const hasFilters =
    query.trim().length > 0 || subject !== "all" || level !== "all";

  function changeLearningAudience(nextAudience: CourseLearningAudience) {
    if (nextAudience === learningAudience) return;
    setQuery("");
    setDebouncedQuery("");
    setSubject("all");
    setLevel("all");
    setSubjects([]);
    setLevels([]);
    setCourses([]);
    setNextCursor(null);
    setLoadingCatalog(true);
    setLoadingMore(false);
    setError(null);
    onLearningAudienceChange(nextAudience);
  }

  const learningAudienceControl = (
    <CatalogLearningAudienceControl
      value={learningAudience}
      onChange={changeLearningAudience}
      disabled={loadingCatalog && courses === null}
    />
  );

  if (selectedCourseId) {
    return (
      <div>
        {learningAudienceControl}
        <CatalogCourseDetailView
          key={selectedCourseId}
          courseId={selectedCourseId}
          onBack={() => onSelectCourse(null)}
        />
      </div>
    );
  }

  if (error && !courses) {
    return (
      <div>
        {learningAudienceControl}
        <SurfaceCard className="course-index-error border border-rose-200">
          <p className="text-sm font-medium text-rose-800" role="alert">
            {error}
          </p>
          <Button
            variant="secondary"
            className="mt-4"
            onClick={() => {
              setError(null);
              setCourses(null);
              setReloadKey((current) => current + 1);
            }}
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Повторить
          </Button>
        </SurfaceCard>
      </div>
    );
  }

  if (!courses) {
    return (
      <div>
        {learningAudienceControl}
        <SurfaceCard className="course-index-status flex items-center gap-3 border border-neutral-200">
          <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden="true" />
          <p className="text-sm font-medium text-neutral-700" role="status">
            Загружаем каталог…
          </p>
        </SurfaceCard>
      </div>
    );
  }

  return (
    <section aria-labelledby="ready-courses-heading">
      <h2 id="ready-courses-heading" className="sr-only">
        Каталог курсов
      </h2>

      {learningAudienceControl}

      <div
        className="compact-page-toolbar course-catalog-toolbar"
        aria-label="Управление каталогом курсов"
        aria-busy={loadingCatalog}
      >
        <label className="compact-toolbar-search product-search-wrap">
          <span className="sr-only">Поиск</span>
          <Search className="product-search-icon h-4 w-4" aria-hidden="true" />
          <Input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="product-control-search"
            placeholder="Название, предмет или автор…"
            autoComplete="off"
          />
        </label>

        <div className="compact-toolbar-rail">
          <CourseFilterMenu
            subjects={subjects}
            levels={levels}
            subject={subject}
            level={level}
            onSubjectChange={setSubject}
            onLevelChange={setLevel}
            label="Фильтры каталога курсов"
          />

          {hasFilters ? (
            <Button
              variant="ghost"
              className="compact-toolbar-reset"
              aria-label="Сбросить фильтры"
              title="Сбросить фильтры"
              onClick={() => {
                setQuery("");
                setSubject("all");
                setLevel("all");
              }}
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
            </Button>
          ) : null}

          <SegmentedControl
            ariaLabel="Вид каталога курсов"
            value={view}
            onChange={setView}
            iconOnly
            items={[
              {
                value: "grid",
                label: "Карточки",
                ariaLabel: "Показать карточками",
                icon: LayoutGrid,
              },
              {
                value: "table",
                label: "Таблица",
                ariaLabel: "Показать таблицей",
                icon: Table2,
              },
            ]}
          />

          <p className="sr-only" role="status" aria-live="polite">
            {loadingCatalog
              ? "Обновляем каталог курсов."
              : "Список курсов каталога обновлён."}
          </p>
        </div>
      </div>

      {loadingCatalog && courses.length === 0 ? (
        <SurfaceCard className="course-index-status mt-4 flex items-center gap-3 border border-neutral-200">
          <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden="true" />
          <p className="text-sm font-medium text-neutral-700" role="status">
            Ищем подходящие курсы…
          </p>
        </SurfaceCard>
      ) : courses.length === 0 ? (
        <SurfaceCard className="mt-4 border border-dashed border-neutral-300 text-center">
          <BookOpen
            className="mx-auto h-8 w-8 text-neutral-400"
            aria-hidden="true"
          />
          <h3 className="mt-4 text-xl font-bold text-neutral-950">
            {hasFilters ? "Ничего не найдено" : "В каталоге пока нет курсов"}
          </h3>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-neutral-600">
            {hasFilters
              ? "Измените запрос или сбросьте фильтры."
              : "Опубликованные курсы появятся здесь."}
          </p>
          {hasFilters ? (
            <Button
              variant="secondary"
              className="mt-5"
              onClick={() => {
                setQuery("");
                setSubject("all");
                setLevel("all");
              }}
            >
              Показать все курсы
            </Button>
          ) : null}
        </SurfaceCard>
      ) : view === "grid" ? (
        <>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {courses.map((course) => (
              <CatalogCourseCard
                key={course.id}
                course={course}
                onOpen={() => onSelectCourse(course.id)}
              />
            ))}
          </div>
          {error ? (
            <p className="app-alert app-alert-error mt-4" role="alert">
              {error}
            </p>
          ) : null}
          {nextCursor ? (
            <div className="mt-4 flex justify-center">
              <Button
                variant="secondary"
                disabled={loadingMore}
                onClick={() => void loadMoreCourses()}
              >
                {loadingMore ? "Загружаем…" : "Показать ещё"}
              </Button>
            </div>
          ) : null}
        </>
      ) : (
        <>
          <div className="mt-4">
            <CatalogCourseTable
              courses={courses}
              onOpen={(courseId) => onSelectCourse(courseId)}
            />
          </div>
          {error ? (
            <p className="app-alert app-alert-error mt-4" role="alert">
              {error}
            </p>
          ) : null}
          {nextCursor ? (
            <div className="mt-4 flex justify-center">
              <Button
                variant="secondary"
                disabled={loadingMore}
                onClick={() => void loadMoreCourses()}
              >
                {loadingMore ? "Загружаем…" : "Показать ещё"}
              </Button>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
