"use client";

import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  CalendarClock,
  ChevronDown,
  FolderOpen,
  LayoutGrid,
  List,
  LoaderCircle,
  Plus,
  RotateCcw,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  CourseActions,
  CoursePublicationBadges,
} from "@/components/course-builder/course-actions";
import { courseBuilderRequest } from "@/components/course-builder/course-builder-client";
import {
  courseCountLabel,
  DEFAULT_COURSE_CATALOG_FILTERS,
  filterAndSortCourses,
  getCourseCatalogOptions,
  hasActiveCourseCatalogFilters,
  type CourseCatalogFilters,
} from "@/components/course-builder/course-catalog";
import { Button, productButtonClassName } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Input, Select } from "@/components/ui/input";
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
import { ROUTES, toCourseRoute } from "@/lib/auth";
import type { CourseSummary } from "@/modules/course-builder/domain";

type CourseCatalogView = "grid" | "table";

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
          <CoursePublicationBadges publication={course.publication} />
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

function CourseTable({ courses }: { courses: CourseSummary[] }) {
  return (
    <div
      className="overflow-x-auto rounded-[1.25rem] border border-white/80 bg-white/80 shadow-[0_10px_24px_rgba(20,20,20,0.06)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/50"
      role="region"
      aria-label="Таблица курсов"
      tabIndex={0}
    >
      <ProductTable className="min-w-[56rem]">
        <caption className="sr-only">
          Личные курсы: предмет, уровень, наполнение, публикация и дата
          обновления
        </caption>
        <ProductTableHead>
          <ProductTableHeaderRow>
            <ProductTableHeaderCell className="w-[30%]">
              Курс
            </ProductTableHeaderCell>
            <ProductTableHeaderCell className="w-[20%]">
              Предмет и уровень
            </ProductTableHeaderCell>
            <ProductTableHeaderCell className="w-[16%]">
              Программа
            </ProductTableHeaderCell>
            <ProductTableHeaderCell className="w-[16%]">
              Обновлён
            </ProductTableHeaderCell>
            <ProductTableHeaderCell className="w-[18%]">
              <span className="sr-only">Действия</span>
            </ProductTableHeaderCell>
          </ProductTableHeaderRow>
        </ProductTableHead>
        <ProductTableBody>
          {courses.map((course) => (
            <ProductTableRow key={course.id} className="h-16">
              <ProductTablePrimaryCell>
                <Link
                  href={toCourseRoute(course.id)}
                  className="block rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/50"
                >
                  <ProductTableTruncate>{course.title}</ProductTableTruncate>
                  <ProductTableTruncate className="mt-1 text-xs font-normal text-neutral-500">
                    {course.goal}
                  </ProductTableTruncate>
                </Link>
              </ProductTablePrimaryCell>
              <ProductTableCell>
                <ProductTableTruncate>{course.subject}</ProductTableTruncate>
                <ProductTableTruncate className="mt-1 text-xs text-neutral-500">
                  {course.level}
                </ProductTableTruncate>
              </ProductTableCell>
              <ProductTableCell>
                <span className="block font-medium text-neutral-900">
                  {course.lessonCount} из {course.targetLessonCount}
                </span>
                <span className="mt-1 block text-xs text-neutral-500">
                  {courseProgressLabel(course)}
                </span>
              </ProductTableCell>
              <ProductTableCell>
                {formatCompactUpdatedAt(course.updatedAt)}
                <span className="mt-1 flex flex-wrap gap-1">
                  <CoursePublicationBadges publication={course.publication} />
                </span>
              </ProductTableCell>
              <ProductTableActionCell className="text-right">
                <Link
                  href={toCourseRoute(course.id)}
                  className={productTableActionLinkClassName()}
                  aria-label={`Открыть курс «${course.title}»`}
                >
                  Открыть
                </Link>
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
  const [view, setView] = useState<CourseCatalogView>("grid");

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

      <SurfaceCard className="border border-white/80">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-[minmax(16rem,1.4fr)_repeat(3,minmax(10rem,0.7fr))]">
          <label className="block min-w-0">
            <span className="mb-1.5 block text-xs font-semibold text-neutral-700">
              Поиск
            </span>
            <span className="product-search-wrap block min-w-0">
              <Search
                className="product-search-icon h-4 w-4"
                aria-hidden="true"
              />
              <Input
                type="search"
                value={filters.query}
                onChange={(event) => updateFilter("query", event.target.value)}
                className="product-control-search"
                placeholder="Название, предмет, цель…"
                autoComplete="off"
              />
            </span>
          </label>

          <label className="block min-w-0">
            <span className="mb-1.5 block text-xs font-semibold text-neutral-700">
              Предмет
            </span>
            <span className="product-select-wrap block min-w-0">
              <Select
                value={filters.subject}
                onChange={(event) =>
                  updateFilter("subject", event.target.value)
                }
              >
                <option value="all">Все предметы</option>
                {options.subjects.map((subject) => (
                  <option key={subject} value={subject}>
                    {subject}
                  </option>
                ))}
              </Select>
              <ChevronDown
                className="product-select-icon h-4 w-4"
                aria-hidden="true"
              />
            </span>
          </label>

          <label className="block min-w-0">
            <span className="mb-1.5 block text-xs font-semibold text-neutral-700">
              Уровень
            </span>
            <span className="product-select-wrap block min-w-0">
              <Select
                value={filters.level}
                onChange={(event) => updateFilter("level", event.target.value)}
              >
                <option value="all">Все уровни</option>
                {options.levels.map((level) => (
                  <option key={level} value={level}>
                    {level}
                  </option>
                ))}
              </Select>
              <ChevronDown
                className="product-select-icon h-4 w-4"
                aria-hidden="true"
              />
            </span>
          </label>

          <label className="block min-w-0">
            <span className="mb-1.5 block text-xs font-semibold text-neutral-700">
              Наполнение
            </span>
            <span className="product-select-wrap block min-w-0">
              <Select
                value={filters.content}
                onChange={(event) =>
                  updateFilter(
                    "content",
                    event.target.value as CourseCatalogFilters["content"],
                  )
                }
              >
                <option value="all">Любое</option>
                <option value="empty">Пустые</option>
                <option value="with-lessons">С уроками</option>
                <option value="assembled">Собранные</option>
              </Select>
              <ChevronDown
                className="product-select-icon h-4 w-4"
                aria-hidden="true"
              />
            </span>
          </label>
        </div>

        <div className="mt-4 flex flex-col gap-3 border-t border-neutral-200 pt-4 md:flex-row md:items-end md:justify-between">
          <div className="flex min-w-0 flex-wrap items-end gap-3">
            <label className="block min-w-[13rem] flex-1 sm:flex-none">
              <span className="mb-1.5 block text-xs font-semibold text-neutral-700">
                Сортировка
              </span>
              <span className="product-select-wrap block min-w-0">
                <Select
                  value={filters.sort}
                  onChange={(event) =>
                    updateFilter(
                      "sort",
                      event.target.value as CourseCatalogFilters["sort"],
                    )
                  }
                >
                  <option value="updated-desc">Сначала обновлённые</option>
                  <option value="title-asc">По названию</option>
                  <option value="updated-asc">Давно не обновлялись</option>
                </Select>
                <ChevronDown
                  className="product-select-icon h-4 w-4"
                  aria-hidden="true"
                />
              </span>
            </label>

            {hasFilters ? (
              <Button variant="ghost" onClick={resetFilters}>
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                Сбросить фильтры
              </Button>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 md:justify-end">
            <p
              className="text-sm text-neutral-600"
              role="status"
              aria-live="polite"
            >
              {hasFilters
                ? `Результаты: ${courseCountLabel(visibleCourses.length)} из ${courseCountLabel(courses.length)}`
                : courseCountLabel(courses.length)}
            </p>
            <SegmentedControl
              ariaLabel="Вид списка курсов"
              value={view}
              onChange={setView}
              items={[
                { value: "grid", label: "Плитки", icon: LayoutGrid },
                { value: "table", label: "Таблица", icon: List },
              ]}
            />
          </div>
        </div>
      </SurfaceCard>

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
          <CourseTable courses={visibleCourses} />
        </div>
      )}
    </section>
  );
}
