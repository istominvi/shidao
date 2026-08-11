"use client";

import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
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
  productTableActionLinkClassName,
} from "@/components/ui/product-table";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { SurfaceCard } from "@/components/ui/surface-card";
import { toCourseRoute } from "@/lib/auth";
import type {
  CourseCatalogDetail,
  CourseCatalogEntry,
} from "@/modules/course-publications/domain";

type CourseCatalogPanelProps = {
  active: boolean;
  selectedCourseId: string | null;
  onSelectCourse: (courseId: string | null) => void;
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

function catalogRequestPath({
  query,
  subject,
  level,
  cursor,
}: {
  query: string;
  subject: string;
  level: string;
  cursor?: string | null;
}) {
  const params = new URLSearchParams({ limit: "50" });
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
      className="product-table-wrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/50"
      role="region"
      aria-label="Таблица курсов каталога"
      tabIndex={0}
    >
      <ProductTable className="min-w-[48rem]">
        <caption className="sr-only">
          Курсы каталога: предмет, уровень, автор и наполнение
        </caption>
        <ProductTableHead>
          <ProductTableHeaderRow>
            <ProductTableHeaderCell className="w-[34%]">
              Курс
            </ProductTableHeaderCell>
            <ProductTableHeaderCell className="w-[24%]">
              Предмет и уровень
            </ProductTableHeaderCell>
            <ProductTableHeaderCell className="w-[18%]">
              Автор
            </ProductTableHeaderCell>
            <ProductTableHeaderCell className="w-[14%]">
              Наполнение
            </ProductTableHeaderCell>
            <ProductTableHeaderCell className="w-[10%]">
              <span className="sr-only">Действия</span>
            </ProductTableHeaderCell>
          </ProductTableHeaderRow>
        </ProductTableHead>
        <ProductTableBody>
          {courses.map((course) => (
            <ProductTableRow key={course.id} className="h-16">
              <ProductTablePrimaryCell>
                <button
                  type="button"
                  className="block w-full rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/50"
                  onClick={() => onOpen(course.id)}
                >
                  <ProductTableTruncate>{course.title}</ProductTableTruncate>
                  <ProductTableTruncate className="mt-1 text-xs font-normal text-neutral-500">
                    {course.goal}
                  </ProductTableTruncate>
                </button>
              </ProductTablePrimaryCell>
              <ProductTableCell>
                <ProductTableTruncate>{course.subject}</ProductTableTruncate>
                <ProductTableTruncate className="mt-1 text-xs text-neutral-500">
                  {course.level}
                </ProductTableTruncate>
              </ProductTableCell>
              <ProductTableCell>
                <ProductTableTruncate>
                  {course.author.isShiDao
                    ? "ShiDao"
                    : course.author.displayName}
                </ProductTableTruncate>
              </ProductTableCell>
              <ProductTableCell>
                <span className="block font-medium text-neutral-900">
                  Уроки: {course.lessonCount}
                </span>
                <span className="mt-1 block text-xs text-neutral-500">
                  Материалы: {course.materialCount}
                </span>
              </ProductTableCell>
              <ProductTableActionCell className="text-right">
                <button
                  type="button"
                  className={productTableActionLinkClassName()}
                  aria-label={`Открыть курс «${course.title}»`}
                  onClick={() => onOpen(course.id)}
                >
                  Открыть
                </button>
              </ProductTableActionCell>
            </ProductTableRow>
          ))}
        </ProductTableBody>
      </ProductTable>
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
          <Chip
            icon={course.author.isShiDao ? undefined : UserRound}
            tone={course.author.isShiDao ? "inverse" : "neutral"}
          >
            {course.author.isShiDao ? "ShiDao" : course.author.displayName}
          </Chip>
        </div>

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
                      {material.mimeType} · {formatFileSize(material.sizeBytes)}
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
          ) : (
            <Button disabled={copyBusy} onClick={() => void copyCourse()}>
              {copyBusy ? "Добавляем…" : "Добавить в мои курсы"}
            </Button>
          )}
        </div>
      </SurfaceCard>
    </article>
  );
}

export function CourseCatalogPanel({
  active,
  selectedCourseId,
  onSelectCourse,
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
  }, [active, debouncedQuery, level, reloadKey, subject]);

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

  if (selectedCourseId) {
    return (
      <CatalogCourseDetailView
        courseId={selectedCourseId}
        onBack={() => onSelectCourse(null)}
      />
    );
  }

  if (error && !courses) {
    return (
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
    );
  }

  if (!courses) {
    return (
      <SurfaceCard className="course-index-status flex items-center gap-3 border border-neutral-200">
        <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden="true" />
        <p className="text-sm font-medium text-neutral-700" role="status">
          Загружаем каталог…
        </p>
      </SurfaceCard>
    );
  }

  return (
    <section aria-labelledby="ready-courses-heading">
      <h2 id="ready-courses-heading" className="sr-only">
        Каталог курсов
      </h2>

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
