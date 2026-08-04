"use client";

import Link from "next/link";
import {
  BookOpen,
  FolderOpen,
  GraduationCap,
  LoaderCircle,
  Search,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { courseBuilderRequest } from "@/components/course-builder/course-builder-client";
import { productButtonClassName } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { SurfaceCard } from "@/components/ui/surface-card";
import { toCourseRoute } from "@/lib/auth";
import type { CourseSummary } from "@/modules/course-builder/domain";

function lessonCountLabel(count: number) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return `${count} урок`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return `${count} урока`;
  }
  return `${count} уроков`;
}

export function StudentsWorkspace() {
  const [courses, setCourses] = useState<CourseSummary[] | null>(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
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
            : "Не удалось загрузить курсы без аудитории.",
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
        [course.title, course.subject, course.audienceDescription].some(
          (value) =>
            String(value ?? "")
              .toLocaleLowerCase("ru-RU")
              .includes(normalizedQuery),
        ),
      ),
    [courses, normalizedQuery],
  );

  return (
    <div className="teaching-hub-stack">
      <section className="teaching-stat-grid" aria-label="Состояние аудитории">
        <SurfaceCard as="div" className="teaching-stat-card">
          <span className="teaching-stat-icon teaching-empty-icon-sky">
            <GraduationCap className="h-5 w-5" aria-hidden="true" />
          </span>
          <strong>0</strong>
          <span>учеников</span>
        </SurfaceCard>
        <SurfaceCard as="div" className="teaching-stat-card">
          <span className="teaching-stat-icon teaching-empty-icon-lime">
            <Users className="h-5 w-5" aria-hidden="true" />
          </span>
          <strong>0</strong>
          <span>групп</span>
        </SurfaceCard>
        <SurfaceCard as="div" className="teaching-stat-card">
          <span className="teaching-stat-icon teaching-empty-icon-violet">
            <FolderOpen className="h-5 w-5" aria-hidden="true" />
          </span>
          <strong>{courses?.length ?? "—"}</strong>
          <span>курсов без учеников</span>
        </SurfaceCard>
      </section>

      <SurfaceCard className="teaching-students-empty" as="section">
        <div className="teaching-empty-icon teaching-empty-icon-lime">
          <Users className="h-6 w-6" aria-hidden="true" />
        </div>
        <div>
          <p className="teaching-empty-eyebrow">Учебное пространство</p>
          <h2>Ученики и группы появятся здесь</h2>
          <p>
            Добавление учеников, приглашения и группы ещё не подключены. Данные
            старой версии не показываются как новые учебные профили и не
            назначаются курсам автоматически.
          </p>
        </div>
      </SurfaceCard>

      <section
        className="teaching-hub-section"
        aria-labelledby="audience-title"
      >
        <div className="teaching-section-heading teaching-section-heading-with-search">
          <div>
            <p className="teaching-section-eyebrow">Ваши курсы</p>
            <h2 id="audience-title">Курсы ожидают назначения аудитории</h2>
          </div>
          <label className="teaching-hub-search">
            <Search className="h-4 w-4" aria-hidden="true" />
            <span className="sr-only">Найти курс</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Найти курс"
            />
          </label>
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
                actions={<Chip tone="amber">Ученики не назначены</Chip>}
              >
                <p className="teaching-course-audience">
                  <BookOpen className="h-4 w-4" aria-hidden="true" />
                  <span>{lessonCountLabel(course.lessonCount)}</span>
                </p>
                <p className="teaching-course-goal">
                  {course.audienceDescription ||
                    "Описание предполагаемой аудитории пока не заполнено."}
                </p>
                <Link
                  href={toCourseRoute(course.id)}
                  className={productButtonClassName("secondary", "mt-5")}
                >
                  Открыть курс
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
                : "После создания курса он появится в этом списке."}
            </p>
          </SurfaceCard>
        ) : null}
      </section>
    </div>
  );
}
