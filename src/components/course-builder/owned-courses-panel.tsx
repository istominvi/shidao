"use client";

import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  CalendarClock,
  FolderOpen,
  LayoutGrid,
  LoaderCircle,
  Plus,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Table2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  CourseActions,
  CoursePublicationBadges,
} from "@/components/course-builder/course-actions";
import { courseBuilderRequest } from "@/components/course-builder/course-builder-client";
import { CourseFilterMenu } from "@/components/course-builder/course-filter-menu";
import {
  DEFAULT_COURSE_CATALOG_FILTERS,
  filterAndSortCourses,
  getCourseCatalogOptions,
  hasActiveCourseCatalogFilters,
  type CourseCatalogFilters,
} from "@/components/course-builder/course-catalog";
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
  ProductTableSortableHeaderCell,
  ProductTableTruncate,
  nextProductTableSort,
  type ProductTableSortState,
} from "@/components/ui/product-table";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { SurfaceCard } from "@/components/ui/surface-card";
import { ROUTES, toCourseRoute } from "@/lib/auth";
import type { CourseSummary } from "@/modules/course-builder/domain";

type CourseCatalogView = "grid" | "table";
type OwnedCourseSortKey =
  "title" | "subject" | "level" | "lessons" | "publication" | "updated";

type OwnedCoursesPanelProps = {
  onOpenCatalog: () => void;
};

function formatUpdatedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Дата обновления неизвестна";
  return `Обновлён ${new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date)}`;
}

function formatCompactUpdatedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Неизвестно";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function courseProgressLabel(course: CourseSummary) {
  if (course.assembledAt) return "Собран";
  if (course.lessonCount > 0) return "В работе";
  return "Пустой";
}

const courseTableCollator = new Intl.Collator("ru-RU", {
  numeric: true,
  sensitivity: "base",
});

function coursePublicationLabel(course: CourseSummary) {
  if (course.publication?.status !== "published") return "Не опубликован";
  return course.publication.hasUnpublishedChanges
    ? "Есть изменения"
    : "В каталоге";
}

function coursePublicationRank(course: CourseSummary) {
  if (course.publication?.status !== "published") return 0;
  return course.publication.hasUnpublishedChanges ? 2 : 1;
}

function sortOwnedCourses(
  courses: CourseSummary[],
  sort: ProductTableSortState<OwnedCourseSortKey>,
) {
  const direction = sort.direction === "asc" ? 1 : -1;
  return [...courses].sort((left, right) => {
    let difference = 0;
    if (sort.key === "title") {
      difference = courseTableCollator.compare(left.title, right.title);
    } else if (sort.key === "subject") {
      difference = courseTableCollator.compare(left.subject, right.subject);
    } else if (sort.key === "level") {
      difference = courseTableCollator.compare(left.level, right.level);
    } else if (sort.key === "lessons") {
      difference = left.lessonCount - right.lessonCount;
    } else if (sort.key === "publication") {
      difference = coursePublicationRank(left) - coursePublicationRank(right);
    } else {
      difference = Date.parse(left.updatedAt) - Date.parse(right.updatedAt);
    }

    if (difference !== 0) return direction * difference;
    const titleDifference = courseTableCollator.compare(
      left.title,
      right.title,
    );
    if (titleDifference !== 0) return titleDifference;
    return left.id.localeCompare(right.id);
  });
}

function CourseCard({
  course,
  onChanged,
}: {
  course: CourseSummary;
  onChanged: () => void;
}) {
  return (
    <SurfaceCard
      as="article"
      className="flex h-full flex-col border border-white/80"
      title={
        <Link
          href={toCourseRoute(course.id)}
          className="transition hover:text-sky-700 focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/50"
        >
          {course.title}
        </Link>
      }
      description={`${course.subject} · ${course.level}`}
      actions={
        <div className="flex items-center gap-2">
          <CoursePublicationBadges
            publication={course.publication}
            learningAudience={course.learningAudience}
          />
          <CourseActions course={course} onChanged={onChanged} />
        </div>
      }
    >
      <p className="line-clamp-3 text-sm leading-relaxed text-neutral-700">
        {course.goal}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Chip icon={BookOpen} tone="violet">
          Уроков: {course.lessonCount}
        </Chip>
        <Chip icon={CalendarClock} tone="slate">
          План: {course.targetLessonCount}
        </Chip>
        <Chip tone={course.lessonCount > 0 ? "emerald" : "sky"}>
          {courseProgressLabel(course)}
        </Chip>
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-neutral-100 pt-4">
        <p className="text-xs text-neutral-500">
          {formatUpdatedAt(course.updatedAt)}
        </p>
        <Link
          href={toCourseRoute(course.id)}
          className={productButtonClassName("secondary")}
          aria-label={`Открыть курс «${course.title}»`}
        >
          Открыть курс
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    </SurfaceCard>
  );
}

function CourseTable({
  courses,
  sort,
  onSort,
  onChanged,
}: {
  courses: CourseSummary[];
  sort: ProductTableSortState<OwnedCourseSortKey>;
  onSort: (key: OwnedCourseSortKey) => void;
  onChanged: () => void;
}) {
  return (
    <div
      className="product-table-wrap course-index-table-wrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/50"
      role="region"
      aria-label="Таблица курсов"
      tabIndex={0}
    >
      <ProductTable className="course-index-table course-index-owned-table">
        <caption className="sr-only">
          Личные курсы: предмет, уровень, наполнение, публикация и дата
          обновления
        </caption>
        <colgroup>
          <col className="course-index-table-col-title" />
          <col className="course-index-table-col-subject" />
          <col className="course-index-table-col-level" />
          <col className="course-index-table-col-lessons" />
          <col className="course-index-table-col-publication" />
          <col className="course-index-table-col-updated" />
          <col className="course-index-table-col-actions" />
        </colgroup>
        <ProductTableHead>
          <ProductTableHeaderRow>
            <ProductTableSortableHeaderCell
              direction={sort.key === "title" ? sort.direction : null}
              onSort={() => onSort("title")}
            >
              Курс
            </ProductTableSortableHeaderCell>
            <ProductTableSortableHeaderCell
              direction={sort.key === "subject" ? sort.direction : null}
              onSort={() => onSort("subject")}
            >
              Предмет
            </ProductTableSortableHeaderCell>
            <ProductTableSortableHeaderCell
              direction={sort.key === "level" ? sort.direction : null}
              onSort={() => onSort("level")}
            >
              Уровень
            </ProductTableSortableHeaderCell>
            <ProductTableSortableHeaderCell
              direction={sort.key === "lessons" ? sort.direction : null}
              onSort={() => onSort("lessons")}
            >
              Уроки
            </ProductTableSortableHeaderCell>
            <ProductTableSortableHeaderCell
              direction={sort.key === "publication" ? sort.direction : null}
              onSort={() => onSort("publication")}
            >
              Публикация
            </ProductTableSortableHeaderCell>
            <ProductTableSortableHeaderCell
              direction={sort.key === "updated" ? sort.direction : null}
              onSort={() => onSort("updated")}
            >
              Обновлён
            </ProductTableSortableHeaderCell>
            <ProductTableHeaderCell aria-label="Действия" />
          </ProductTableHeaderRow>
        </ProductTableHead>
        <ProductTableBody>
          {courses.map((course) => (
            <ProductTableRow key={course.id}>
              <ProductTablePrimaryCell className="overflow-hidden">
                <Link
                  href={toCourseRoute(course.id)}
                  className="course-index-table-link"
                  title={`${course.title} — ${course.goal}`}
                >
                  <ProductTableTruncate>{course.title}</ProductTableTruncate>
                </Link>
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
                  title={`${course.lessonCount} из ${course.targetLessonCount} · ${courseProgressLabel(course)}`}
                >
                  {course.lessonCount} из {course.targetLessonCount} ·{" "}
                  {courseProgressLabel(course)}
                </ProductTableTruncate>
              </ProductTableCell>
              <ProductTableCell className="overflow-hidden">
                <ProductTableTruncate title={coursePublicationLabel(course)}>
                  {coursePublicationLabel(course)}
                </ProductTableTruncate>
              </ProductTableCell>
              <ProductTableCell className="overflow-hidden">
                <time
                  className="course-index-table-truncate"
                  dateTime={course.updatedAt}
                  title={formatUpdatedAt(course.updatedAt)}
                >
                  {formatCompactUpdatedAt(course.updatedAt)}
                </time>
              </ProductTableCell>
              <ProductTableActionCell className="course-index-table-action-cell text-right">
                <span className="course-index-table-actions">
                  <CourseActions
                    course={course}
                    onChanged={onChanged}
                    variant="table"
                  />
                </span>
              </ProductTableActionCell>
            </ProductTableRow>
          ))}
        </ProductTableBody>
      </ProductTable>
    </div>
  );
}

export function OwnedCoursesPanel({ onOpenCatalog }: OwnedCoursesPanelProps) {
  const [courses, setCourses] = useState<CourseSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [filters, setFilters] = useState<CourseCatalogFilters>(
    DEFAULT_COURSE_CATALOG_FILTERS,
  );
  const [view, setView] = useState<CourseCatalogView>("table");
  const [tableSort, setTableSort] = useState<
    ProductTableSortState<OwnedCourseSortKey>
  >({
    key: "updated",
    direction: "desc",
  });

  useEffect(() => {
    let active = true;
    void courseBuilderRequest<{ courses: CourseSummary[] }>("/api/v2/courses", {
      cache: "no-store",
    })
      .then((payload) => {
        if (!active) return;
        setCourses(payload.courses);
        setError(null);
      })
      .catch((caught: unknown) => {
        if (!active) return;
        setError(
          caught instanceof Error
            ? caught.message
            : "Не удалось загрузить список курсов.",
        );
      });
    return () => {
      active = false;
    };
  }, [reloadKey]);

  const options = useMemo(
    () => getCourseCatalogOptions(courses ?? []),
    [courses],
  );
  const visibleCourses = useMemo(
    () => filterAndSortCourses(courses ?? [], filters),
    [courses, filters],
  );
  const tableCourses = useMemo(
    () => sortOwnedCourses(visibleCourses, tableSort),
    [tableSort, visibleCourses],
  );
  const hasFilters = hasActiveCourseCatalogFilters(filters);

  function updateFilter<TKey extends keyof CourseCatalogFilters>(
    key: TKey,
    value: CourseCatalogFilters[TKey],
  ) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function resetFilters() {
    setFilters((current) => ({
      ...DEFAULT_COURSE_CATALOG_FILTERS,
      sort: current.sort,
    }));
  }

  function reloadCourses() {
    setReloadKey((current) => current + 1);
  }

  if (error) {
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
            reloadCourses();
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
          Загружаем ваши курсы…
        </p>
      </SurfaceCard>
    );
  }

  if (courses.length === 0) {
    return (
      <SurfaceCard className="course-index-status border border-dashed border-neutral-300 text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-lime-100 text-lime-900">
          <FolderOpen className="h-7 w-7" aria-hidden="true" />
        </div>
        <h2 className="mt-4 text-xl font-bold text-neutral-950">
          У вас пока нет курсов
        </h2>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-neutral-600">
          Создайте курс с нуля или выберите готовый в каталоге.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <Link
            href={ROUTES.coursesNew}
            className={productButtonClassName("primary")}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Создать курс
          </Link>
          <Button variant="secondary" onClick={onOpenCatalog}>
            Открыть каталог
          </Button>
        </div>
      </SurfaceCard>
    );
  }

  return (
    <section aria-labelledby="owned-courses-heading">
      <h2 id="owned-courses-heading" className="sr-only">
        Мои курсы
      </h2>

      <div
        className="compact-page-toolbar course-index-toolbar"
        aria-label="Управление курсами"
      >
        <label className="compact-toolbar-search product-search-wrap">
          <span className="sr-only">Поиск</span>
          <Search className="product-search-icon h-4 w-4" aria-hidden="true" />
          <Input
            type="search"
            value={filters.query}
            onChange={(event) => updateFilter("query", event.target.value)}
            className="product-control-search"
            placeholder="Название, предмет, цель…"
            autoComplete="off"
          />
        </label>

        <div className="compact-toolbar-rail">
          <CourseFilterMenu
            subjects={options.subjects}
            levels={options.levels}
            subject={filters.subject}
            level={filters.level}
            content={filters.content}
            onSubjectChange={(value) => updateFilter("subject", value)}
            onLevelChange={(value) => updateFilter("level", value)}
            onContentChange={(value) => updateFilter("content", value)}
          />

          {hasFilters ? (
            <Button
              variant="ghost"
              className="compact-toolbar-reset"
              aria-label="Сбросить фильтры"
              title="Сбросить фильтры"
              onClick={resetFilters}
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
            </Button>
          ) : null}

          <SegmentedControl
            ariaLabel="Вид списка курсов"
            value={view}
            onChange={setView}
            iconOnly
            items={[
              {
                value: "table",
                label: "Таблица",
                ariaLabel: "Показать таблицей",
                icon: Table2,
              },
              {
                value: "grid",
                label: "Карточки",
                ariaLabel: "Показать карточками",
                icon: LayoutGrid,
              },
            ]}
          />

          <p className="sr-only" role="status" aria-live="polite">
            {hasFilters
              ? "Список курсов отфильтрован."
              : "Показаны все ваши курсы."}
          </p>
        </div>
      </div>

      {visibleCourses.length === 0 ? (
        <SurfaceCard className="mt-4 border border-dashed border-neutral-300 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-neutral-100 text-neutral-700">
            <SlidersHorizontal className="h-6 w-6" aria-hidden="true" />
          </div>
          <h3 className="mt-4 text-xl font-bold text-neutral-950">
            Ничего не найдено
          </h3>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-neutral-600">
            Измените запрос или сбросьте фильтры, чтобы снова увидеть все курсы.
          </p>
          <Button variant="secondary" className="mt-5" onClick={resetFilters}>
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Показать все курсы
          </Button>
        </SurfaceCard>
      ) : view === "grid" ? (
        <div
          className="mt-4 grid gap-4 md:grid-cols-2"
          aria-label="Курсы плитками"
        >
          {visibleCourses.map((course) => (
            <CourseCard
              key={course.id}
              course={course}
              onChanged={reloadCourses}
            />
          ))}
        </div>
      ) : (
        <div className="mt-4">
          <CourseTable
            courses={tableCourses}
            sort={tableSort}
            onSort={(key) =>
              setTableSort((current) => nextProductTableSort(current, key))
            }
            onChanged={reloadCourses}
          />
        </div>
      )}
    </section>
  );
}
