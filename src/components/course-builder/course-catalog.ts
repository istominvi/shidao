import type { CourseSummary } from "@/modules/course-builder/domain";

export type CourseCatalogContentFilter =
  "all" | "empty" | "with-lessons" | "assembled";

export type CourseCatalogSort = "updated-desc" | "updated-asc" | "title-asc";

export type CourseCatalogFilters = {
  query: string;
  subject: string;
  level: string;
  content: CourseCatalogContentFilter;
  sort: CourseCatalogSort;
};

export const DEFAULT_COURSE_CATALOG_FILTERS: CourseCatalogFilters = {
  query: "",
  subject: "all",
  level: "all",
  content: "all",
  sort: "updated-desc",
};

const courseTitleCollator = new Intl.Collator("ru", {
  numeric: true,
  sensitivity: "base",
});

function normalizeSearchValue(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("ru-RU");
}

function matchesContentFilter(
  course: CourseSummary,
  filter: CourseCatalogContentFilter,
) {
  if (filter === "empty") return course.lessonCount === 0;
  if (filter === "with-lessons") return course.lessonCount > 0;
  if (filter === "assembled") return course.assembledAt !== null;
  return true;
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

    return (
      matchesQuery &&
      (filters.subject === "all" || course.subject === filters.subject) &&
      (filters.level === "all" || course.level === filters.level) &&
      matchesContentFilter(course, filters.content)
    );
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

export function getCourseCatalogOptions(courses: CourseSummary[]) {
  const subjects = Array.from(
    new Set(courses.map((course) => course.subject)),
  ).sort(courseTitleCollator.compare);
  const levels = Array.from(
    new Set(courses.map((course) => course.level)),
  ).sort(courseTitleCollator.compare);

  return { subjects, levels };
}

export function hasActiveCourseCatalogFilters(filters: CourseCatalogFilters) {
  return (
    normalizeSearchValue(filters.query).length > 0 ||
    filters.subject !== "all" ||
    filters.level !== "all" ||
    filters.content !== "all"
  );
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
