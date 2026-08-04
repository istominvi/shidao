"use client";

import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  CalendarClock,
  FolderOpen,
  LoaderCircle,
  Plus,
} from "lucide-react";
import { useEffect, useState } from "react";
import { courseBuilderRequest } from "@/components/course-builder/course-builder-client";
import { productButtonClassName } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { SurfaceCard } from "@/components/ui/surface-card";
import { ROUTES, toCourseRoute } from "@/lib/auth";
import type { CourseSummary } from "@/modules/course-builder/domain";

function formatUpdatedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Дата обновления неизвестна";
  return `Обновлён ${new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date)}`;
}

export function CoursesIndex() {
  const [courses, setCourses] = useState<CourseSummary[] | null>(null);
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
            : "Не удалось загрузить список курсов.",
        );
      });
    return () => {
      active = false;
    };
  }, []);

  if (error) {
    return (
      <SurfaceCard className="border border-rose-200 bg-rose-50/80">
        <p className="text-sm font-medium text-rose-800" role="alert">
          {error}
        </p>
      </SurfaceCard>
    );
  }

  if (!courses) {
    return (
      <SurfaceCard className="flex items-center gap-3 border border-neutral-200 bg-white/75">
        <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden="true" />
        <p className="text-sm font-medium text-neutral-700" role="status">
          Загружаем личные курсы из базы…
        </p>
      </SurfaceCard>
    );
  }

  if (courses.length === 0) {
    return (
      <SurfaceCard className="border border-dashed border-neutral-300 bg-white/75 text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-lime-100 text-lime-900">
          <FolderOpen className="h-7 w-7" aria-hidden="true" />
        </div>
        <h2 className="mt-4 text-xl font-bold text-neutral-950">
          Здесь появятся ваши курсы
        </h2>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-neutral-600">
          Создайте первый реальный черновик: он сохранится в базе, а вложения —
          в закрытом файловом хранилище.
        </p>
        <Link
          href={ROUTES.coursesNew}
          className={productButtonClassName("primary", "mt-5 inline-flex")}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Новый курс
        </Link>
      </SurfaceCard>
    );
  }

  return (
    <section className="grid gap-4 lg:grid-cols-2" aria-label="Личные курсы">
      {courses.map((course) => (
        <SurfaceCard
          key={course.id}
          as="article"
          className="flex h-full flex-col border border-white/80"
          title={
            <Link
              href={toCourseRoute(course.id)}
              className="transition hover:text-sky-700"
            >
              {course.title}
            </Link>
          }
          description={`${course.subject} · ${course.level}`}
          actions={<Chip tone="amber">Черновик</Chip>}
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
            {course.assembledAt ? (
              <Chip tone="emerald">Черновик собран</Chip>
            ) : (
              <Chip tone="sky">Пустой курс</Chip>
            )}
          </div>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-neutral-100 pt-4">
            <p className="text-xs text-neutral-500">
              {formatUpdatedAt(course.updatedAt)}
            </p>
            <Link
              href={toCourseRoute(course.id)}
              className={productButtonClassName("secondary")}
            >
              Открыть курс
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </SurfaceCard>
      ))}
    </section>
  );
}
