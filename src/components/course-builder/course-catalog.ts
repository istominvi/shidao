import type { CourseSummary } from "@/modules/course-builder/domain";

export type CourseCatalogSort = "updated-desc" | "updated-asc" | "title-asc";

export type CourseCatalogFilters = {
  query: string;
  sort: CourseCatalogSort;
};

export const DEFAULT_COURSE_CATALOG_FILTERS: CourseCatalogFilters = {
  query: "",
  sort: "updated-desc",
};

const courseTitleCollator = new Intl.Collator("ru", {
  numeric: true,
  sensitivity: "base",
});

function normalizeSearchValue(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("ru-RU");
}

export function filterAndSortCourses(
  courses: CourseSummary[],
  filters: CourseCatalogFilters,
) {
  const normalizedQuery = normalizeSearchValue(filters.query);
  const filtered = courses.filter((course) => {
    const matchesQuery =
      normalizedQuery.length === 0 ||
      [course.title, course.subject, course.level, course.goal].some((value) =>
        normalizeSearchValue(value).includes(normalizedQuery),
      );

    return matchesQuery;
  });

  return filtered.sort((left, right) => {
    if (filters.sort === "title-asc") {
      return (
        courseTitleCollator.compare(left.title, right.title) ||
        left.id.localeCompare(right.id)
      );
    }

    if (filters.sort === "updated-asc") {
      return (
        Date.parse(left.updatedAt) - Date.parse(right.updatedAt) ||
        courseTitleCollator.compare(left.title, right.title) ||
        left.id.localeCompare(right.id)
      );
    }

    return (
      Date.parse(right.updatedAt) - Date.parse(left.updatedAt) ||
      courseTitleCollator.compare(left.title, right.title) ||
      left.id.localeCompare(right.id)
    );
  });
}

export function hasActiveCourseCatalogFilters(filters: CourseCatalogFilters) {
  return normalizeSearchValue(filters.query).length > 0;
}

export function courseCountLabel(count: number) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return `${count} курс`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return `${count} курса`;
  }
  return `${count} курсов`;
}
