"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, LoaderCircle, RefreshCw } from "lucide-react";
import {
  CourseComponentRenderer,
  type SignedCourseComponentAssetMap,
} from "@/components/course-builder/component-renderers";
import { loadStudentScreenPreview } from "@/components/course-builder/course-builder-client";
import { Button, productButtonClassName } from "@/components/ui/button";
import { toCourseRoute } from "@/lib/auth";
import type { StudentScreenCourse } from "@/modules/course-builder/domain";

type StudentScreenPreviewProps = {
  courseId: string;
  initialLessonId?: string;
};

export function StudentScreenPreview({
  courseId,
  initialLessonId,
}: StudentScreenPreviewProps) {
  const [course, setCourse] = useState<StudentScreenCourse | null>(null);
  const [activeLessonIndex, setActiveLessonIndex] = useState(0);
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void loadStudentScreenPreview(courseId)
      .then((workspace) => {
        if (!active) return;
        setCourse(workspace);
        const requestedIndex = initialLessonId
          ? workspace.lessons.findIndex(
              (lesson) => lesson.id === initialLessonId,
            )
          : -1;
        setActiveLessonIndex(requestedIndex >= 0 ? requestedIndex : 0);
        setActiveSlideIndex(0);
      })
      .catch((caught: unknown) => {
        if (!active) return;
        setError(
          caught instanceof Error
            ? caught.message
            : "Не удалось открыть предпросмотр экрана ученика.",
        );
      });
    return () => {
      active = false;
    };
  }, [courseId, initialLessonId]);

  const lessons = useMemo(() => course?.lessons ?? [], [course]);
  const assetMap = useMemo<SignedCourseComponentAssetMap>(
    () =>
      Object.fromEntries(
        (course?.attachments ?? []).map((asset) => [
          asset.id,
          {
            id: asset.id,
            originalFilename: asset.originalFilename,
            mimeType: asset.mimeType,
            signedUrl: asset.signedUrl,
          },
        ]),
      ),
    [course],
  );

  if (error) {
    return (
      <main className="min-h-screen bg-neutral-100 px-4 py-10">
        <div className="mx-auto max-w-3xl rounded-3xl border border-rose-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-rose-800" role="alert">
            {error}
          </p>
          <Link
            href={toCourseRoute(courseId)}
            className={`${productButtonClassName("secondary")} mt-4`}
          >
            Вернуться в редактор курса
          </Link>
        </div>
      </main>
    );
  }

  if (!course) {
    return (
      <main className="grid min-h-screen place-items-center bg-neutral-100 px-4">
        <div className="flex items-center gap-3 rounded-3xl bg-white px-6 py-5 text-sm font-semibold text-neutral-700 shadow-sm">
          <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden="true" />
          Загружаем экран ученика из сохранённого курса…
        </div>
      </main>
    );
  }

  if (lessons.length === 0) {
    return (
      <main className="grid min-h-screen place-items-center bg-neutral-100 px-4">
        <div className="w-full max-w-3xl rounded-[2rem] border border-neutral-200 bg-white p-8 text-center shadow-sm">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-sky-700">
            Предпросмотр экрана ученика
          </p>
          <h1 className="mt-3 text-2xl font-black text-neutral-950">
            В курсе пока нет уроков
          </h1>
          <p className="mt-2 text-sm leading-6 text-neutral-600">
            Вернитесь в редактор курса и добавьте первый урок.
          </p>
          <Link
            href={toCourseRoute(course.id)}
            className={`${productButtonClassName("primary")} mt-5`}
          >
            Вернуться в редактор курса
          </Link>
        </div>
      </main>
    );
  }

  const safeActiveLessonIndex = Math.min(activeLessonIndex, lessons.length - 1);
  const activeLesson = lessons[safeActiveLessonIndex];
  const slides = [...activeLesson.slides].sort(
    (left, right) => left.position - right.position,
  );
  const safeActiveSlideIndex = Math.min(
    activeSlideIndex,
    Math.max(slides.length - 1, 0),
  );
  const activeSlide = slides[safeActiveSlideIndex];

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#e0f2fe_0%,#f5f3ff_36%,#fafafa_76%)] px-4 py-5 md:px-8 md:py-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-4">
        <header className="rounded-3xl border border-white/80 bg-white/85 p-4 shadow-sm backdrop-blur md:px-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-sky-700">
                Экран ученика · режим предпросмотра
              </p>
              <h1 className="mt-1 text-xl font-black text-neutral-950 md:text-2xl">
                {course.title}
              </h1>
              <p className="mt-1 text-sm text-neutral-600">
                Урок {activeLesson.position}: {activeLesson.title}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                onClick={() => window.location.reload()}
              >
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                Обновить данные
              </Button>
              <Link
                href={toCourseRoute(course.id)}
                className={productButtonClassName("secondary")}
              >
                Вернуться в редактор курса
              </Link>
            </div>
          </div>
        </header>

        <nav
          className="flex gap-2 overflow-x-auto rounded-3xl border border-white/80 bg-white/75 p-3 shadow-sm backdrop-blur"
          aria-label="Уроки в предпросмотре экрана ученика"
        >
          {lessons.map((lesson, index) => (
            <button
              key={lesson.id}
              type="button"
              aria-current={
                index === safeActiveLessonIndex ? "page" : undefined
              }
              onClick={() => {
                setActiveLessonIndex(index);
                setActiveSlideIndex(0);
              }}
              className={`min-w-44 rounded-2xl border px-4 py-3 text-left transition ${
                index === safeActiveLessonIndex
                  ? "border-neutral-950 bg-neutral-950 text-white"
                  : "border-neutral-200 bg-white text-neutral-800 hover:border-neutral-400"
              }`}
            >
              <span className="block text-[0.68rem] font-bold uppercase tracking-[0.12em] opacity-70">
                Урок {lesson.position}
              </span>
              <span className="mt-1 block text-sm font-bold">
                {lesson.title}
              </span>
            </button>
          ))}
        </nav>

        <section className="min-h-[32rem] rounded-[2.25rem] border border-white/90 bg-white p-5 shadow-[0_24px_60px_rgba(15,23,42,0.10)] md:p-10">
          <div className="mx-auto max-w-5xl">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-violet-700">
              Урок {activeLesson.position}
            </p>
            <h2 className="mt-2 text-3xl font-black tracking-tight text-neutral-950 md:text-4xl">
              {activeLesson.title}
            </h2>
          </div>

          <div className="mt-8 grid min-h-80 content-start gap-6">
            {activeSlide ? (
              activeSlide.components.map((component) => (
                <CourseComponentRenderer
                  key={component.id}
                  component={component}
                  assets={assetMap}
                  mode="student"
                />
              ))
            ) : (
              <p className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 px-5 py-10 text-center text-sm text-neutral-600">
                В этом уроке пока нет слайдов экрана ученика.
              </p>
            )}
          </div>
        </section>

        <footer className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-white/80 bg-white/80 p-4 shadow-sm backdrop-blur">
          <Button
            variant="secondary"
            disabled={!activeSlide || safeActiveSlideIndex === 0}
            onClick={() =>
              setActiveSlideIndex(Math.max(0, safeActiveSlideIndex - 1))
            }
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Предыдущий слайд
          </Button>
          <div className="text-center">
            <p
              className="text-sm font-bold text-neutral-700"
              aria-live="polite"
            >
              {activeSlide
                ? `Слайд ${safeActiveSlideIndex + 1} из ${slides.length}`
                : "Нет слайдов"}
            </p>
            <p className="mt-1 text-xs leading-5 text-neutral-500">
              Навигация доступна только в предпросмотре; во время занятия
              экраном управляет преподаватель.
            </p>
          </div>
          <Button
            variant="secondary"
            disabled={
              !activeSlide || safeActiveSlideIndex === slides.length - 1
            }
            onClick={() =>
              setActiveSlideIndex(
                Math.min(slides.length - 1, safeActiveSlideIndex + 1),
              )
            }
          >
            Следующий слайд
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        </footer>
      </div>
    </main>
  );
}
