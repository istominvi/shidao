"use client";

import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CalendarDays,
  Clock3,
  LoaderCircle,
  Search,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { courseBuilderRequest } from "@/components/course-builder/course-builder-client";
import { productButtonClassName } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { SurfaceCard } from "@/components/ui/surface-card";
import { toCourseRoute } from "@/lib/auth";
import type { CourseSummary } from "@/modules/course-builder/domain";

const dateFormatter = new Intl.DateTimeFormat("ru-RU", {
  weekday: "long",
  day: "numeric",
  month: "long",
});

function atLocalNoon(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate(), 12);
}

function shiftDate(value: Date, amount: number) {
  const next = atLocalNoon(value);
  next.setDate(next.getDate() + amount);
  return next;
}

function formatSelectedDate(value: Date) {
  const label = dateFormatter.format(value);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function lessonCountLabel(count: number) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return `${count} урок`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return `${count} урока`;
  }
  return `${count} уроков`;
}

export function ScheduleWorkspace() {
  const [courses, setCourses] = useState<CourseSummary[] | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setSelectedDate(atLocalNoon(new Date()));
    void courseBuilderRequest<{ courses: CourseSummary[] }>("/api/v2/courses", {
      cache: "no-store",
    })
      .then((payload) => {
        if (active) setCourses(payload.courses);
      })
      .catch((caught: unknown) => {
        if (!active) return;
        setError(
          caught instanceof Error
            ? caught.message
            : "Не удалось загрузить курсы для планирования.",
        );
      });

    return () => {
      active = false;
    };
  }, []);

  const normalizedQuery = query.trim().toLocaleLowerCase("ru-RU");
  const visibleCourses = useMemo(
    () =>
      (courses ?? []).filter((course) =>
        [course.title, course.subject, course.level].some((value) =>
          String(value ?? "")
            .toLocaleLowerCase("ru-RU")
            .includes(normalizedQuery),
        ),
      ),
    [courses, normalizedQuery],
  );
  const lessonCount = (courses ?? []).reduce(
    (total, course) => total + course.lessonCount,
    0,
  );

  return (
    <div className="teaching-hub-stack">
      <section
        className="teaching-hub-toolbar"
        aria-label="Навигация по расписанию"
      >
        <div className="teaching-date-navigator">
          <button
            type="button"
            aria-label="Предыдущий день"
            onClick={() =>
              setSelectedDate((current) =>
                shiftDate(current ?? atLocalNoon(new Date()), -1),
              )
            }
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          </button>
          <strong aria-live="polite">
            {selectedDate ? formatSelectedDate(selectedDate) : "Сегодня"}
          </strong>
          <button
            type="button"
            aria-label="Следующий день"
            onClick={() =>
              setSelectedDate((current) =>
                shiftDate(current ?? atLocalNoon(new Date()), 1),
              )
            }
          >
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            className="teaching-today-button"
            onClick={() => setSelectedDate(atLocalNoon(new Date()))}
          >
            Сегодня
          </button>
        </div>

        <label className="teaching-hub-search">
          <Search className="h-4 w-4" aria-hidden="true" />
          <span className="sr-only">Найти курс для планирования</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Найти курс"
          />
        </label>
      </section>

      <SurfaceCard className="teaching-schedule-empty" as="section">
        <div className="teaching-empty-icon teaching-empty-icon-sky">
          <CalendarDays className="h-6 w-6" aria-hidden="true" />
        </div>
        <div>
          <p className="teaching-empty-eyebrow">Выбранный день</p>
          <h2>Занятия пока не назначены</h2>
          <p>
            Даты и время занятий ещё не сохраняются. Поэтому в календаре не
            появятся условные события, а ниже показаны только ваши реальные
            курсы и уроки.
          </p>
        </div>
      </SurfaceCard>

      <section
        className="teaching-hub-section"
        aria-labelledby="planning-title"
      >
        <div className="teaching-section-heading">
          <div>
            <p className="teaching-section-eyebrow">Ваши курсы</p>
            <h2 id="planning-title">Готово к будущему планированию</h2>
          </div>
          <Chip icon={Clock3} tone="slate">
            {courses ? lessonCountLabel(lessonCount) : "Загрузка"}
          </Chip>
        </div>

        {error ? (
          <SurfaceCard className="border border-rose-200">
            <p className="text-sm font-medium text-rose-800" role="alert">
              {error}
            </p>
          </SurfaceCard>
        ) : null}

        {!error && !courses ? (
          <SurfaceCard className="flex items-center gap-3 border border-neutral-200">
            <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden="true" />
            <p className="text-sm font-medium text-neutral-700" role="status">
              Загружаем реальные курсы…
            </p>
          </SurfaceCard>
        ) : null}

        {courses && visibleCourses.length > 0 ? (
          <div className="teaching-course-grid">
            {visibleCourses.map((course) => (
              <SurfaceCard
                key={course.id}
                as="article"
                className="teaching-course-card"
                title={course.title}
                description={[course.subject, course.level]
                  .filter(Boolean)
                  .join(" · ")}
                actions={
                  <Chip
                    icon={BookOpen}
                    tone={course.lessonCount ? "violet" : "neutral"}
                  >
                    {lessonCountLabel(course.lessonCount)}
                  </Chip>
                }
              >
                <p className="teaching-course-goal">
                  {course.goal || "Цель курса пока не заполнена."}
                </p>
                <Link
                  href={toCourseRoute(course.id)}
                  className={productButtonClassName("secondary", "mt-5")}
                >
                  Открыть уроки
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </SurfaceCard>
            ))}
          </div>
        ) : null}

        {courses && visibleCourses.length === 0 ? (
          <SurfaceCard className="teaching-filter-empty">
            <Search className="h-6 w-6" aria-hidden="true" />
            <h3>{courses.length ? "Курсы не найдены" : "Пока нет курсов"}</h3>
            <p>
              {courses.length
                ? "Измените запрос, чтобы увидеть другие курсы."
                : "Создайте курс и уроки — они появятся в очереди планирования."}
            </p>
          </SurfaceCard>
        ) : null}
      </section>
    </div>
  );
}
