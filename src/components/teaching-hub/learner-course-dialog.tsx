"use client";

import {
  BookOpen,
  LoaderCircle,
  RefreshCw,
  Search,
  UserPlus,
} from "lucide-react";
import { useEffect, useId, useMemo, useState } from "react";
import { loadOwnedCourses } from "@/components/course-builder/course-builder-client";
import {
  loadCourseAudience,
  replaceCourseAudience,
} from "@/components/lesson-runs/lesson-run-client";
import { Button } from "@/components/ui/button";
import { DialogShell } from "@/components/ui/dialog-shell";
import type { CourseSummary } from "@/modules/course-builder/domain";
import type { LearnerProfile } from "@/modules/lesson-runs/domain";

type LearnerCourseDialogProps = {
  learnerProfile: Pick<LearnerProfile, "id" | "displayName">;
  onClose: () => void;
  onAdded: (courseTitle: string) => void;
  disabled?: boolean;
};

function errorMessage(caught: unknown) {
  return caught instanceof Error
    ? caught.message
    : "Не удалось добавить ученика в курс.";
}

export function LearnerCourseDialog({
  learnerProfile,
  onClose,
  onAdded,
  disabled = false,
}: LearnerCourseDialogProps) {
  const [courses, setCourses] = useState<CourseSummary[] | null>(null);
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [loadRevision, setLoadRevision] = useState(0);
  const radioName = useId();
  const controlsDisabled = disabled || busy;

  useEffect(() => {
    let active = true;
    setCourses(null);
    setError(null);
    void loadOwnedCourses()
      .then((items) => {
        if (!active) return;
        const ordered = [...items].sort((left, right) =>
          left.title.localeCompare(right.title, "ru"),
        );
        setCourses(ordered);
        setSelectedCourseId((current) =>
          ordered.some((course) => course.id === current) ? current : "",
        );
      })
      .catch((caught: unknown) => {
        if (!active) return;
        setError(
          caught instanceof Error
            ? caught.message
            : "Не удалось загрузить курсы.",
        );
      });
    return () => {
      active = false;
    };
  }, [loadRevision]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape" || busy) return;
      event.preventDefault();
      onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [busy, onClose]);

  const normalizedQuery = query.trim().toLocaleLowerCase("ru-RU");
  const visibleCourses = useMemo(
    () =>
      (courses ?? []).filter((course) => {
        if (!normalizedQuery) return true;
        return [course.title, course.subject, course.level].some((value) =>
          value.toLocaleLowerCase("ru-RU").includes(normalizedQuery),
        );
      }),
    [courses, normalizedQuery],
  );
  const selectedCourse =
    courses?.find((course) => course.id === selectedCourseId) ?? null;
  const selectedCourseIsVisible = visibleCourses.some(
    (course) => course.id === selectedCourseId,
  );

  function requestClose() {
    if (!busy) onClose();
  }

  async function addToCourse() {
    if (!selectedCourse || !selectedCourseIsVisible || controlsDisabled) return;
    setBusy(true);
    setError(null);
    setStatusMessage(null);
    try {
      const audience = await loadCourseAudience(selectedCourse.id);
      const alreadyDirect = audience.directLearners.some(
        (learner) => learner.id === learnerProfile.id,
      );

      if (alreadyDirect) {
        setStatusMessage(
          `Ученик уже добавлен в курс «${selectedCourse.title}».`,
        );
        return;
      }

      await replaceCourseAudience(selectedCourse.id, {
        directLearnerProfileIds: [
          ...audience.directLearners.map((learner) => learner.id),
          learnerProfile.id,
        ],
        learnerGroupIds: audience.groups.map((group) => group.id),
      });
      setStatusMessage(`Ученик добавлен в курс «${selectedCourse.title}».`);
      onAdded(selectedCourse.title);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <DialogShell
      title="Добавить в курс"
      description={`Выберите курс для ученика «${learnerProfile.displayName}». Уже выбранные ученики и группы курса сохранятся.`}
      onClose={requestClose}
      panelClassName="max-w-2xl"
    >
      {error ? (
        <div
          className="app-alert app-alert-error flex flex-wrap items-center justify-between gap-3"
          role="alert"
        >
          <span>{error}</span>
          {courses === null ? (
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={() => setLoadRevision((current) => current + 1)}
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Повторить
            </Button>
          ) : null}
        </div>
      ) : null}

      {statusMessage ? (
        <p className="app-alert app-alert-info" role="status">
          {statusMessage}
        </p>
      ) : null}

      {!courses && !error ? (
        <p
          className="flex min-h-28 items-center justify-center gap-2 text-sm text-neutral-600"
          role="status"
        >
          <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
          Загружаем курсы…
        </p>
      ) : null}

      {courses ? (
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            void addToCourse();
          }}
        >
          {courses.length > 0 ? (
            <>
              <label className="teaching-hub-search student-directory-search">
                <Search className="h-4 w-4" aria-hidden="true" />
                <span className="sr-only">Найти курс</span>
                <input
                  data-dialog-initial-focus
                  type="search"
                  autoComplete="off"
                  disabled={controlsDisabled}
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setError(null);
                    setStatusMessage(null);
                  }}
                  placeholder="Название, предмет или уровень"
                />
              </label>

              <fieldset className="student-directory-picker">
                <legend className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4" aria-hidden="true" />
                  Курс
                </legend>
                <div className="grid max-h-72 gap-2 overflow-y-auto">
                  {visibleCourses.map((course) => (
                    <label
                      key={course.id}
                      className="flex cursor-pointer items-start gap-3 rounded-xl bg-neutral-50 px-3 py-2.5 text-sm text-neutral-800"
                    >
                      <input
                        type="radio"
                        name={radioName}
                        value={course.id}
                        disabled={controlsDisabled}
                        checked={selectedCourseId === course.id}
                        onChange={() => {
                          setSelectedCourseId(course.id);
                          setError(null);
                          setStatusMessage(null);
                        }}
                      />
                      <span className="min-w-0">
                        <strong className="block truncate text-neutral-950">
                          {course.title}
                        </strong>
                        <span className="mt-0.5 block text-xs text-neutral-500">
                          {[course.subject, course.level]
                            .filter(Boolean)
                            .join(" · ") || "Без предмета и уровня"}
                        </span>
                      </span>
                    </label>
                  ))}
                  {visibleCourses.length === 0 ? (
                    <p className="student-directory-picker-empty py-4 text-center">
                      Курсы не найдены.
                    </p>
                  ) : null}
                </div>
              </fieldset>
            </>
          ) : (
            <p className="student-directory-picker-empty py-6 text-center">
              Курсов пока нет. Сначала создайте курс в разделе «Курсы».
            </p>
          )}

          <div className="dialog-shell-actions">
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={requestClose}
            >
              Отмена
            </Button>
            <Button
              type="submit"
              disabled={
                controlsDisabled || !selectedCourse || !selectedCourseIsVisible
              }
            >
              {busy ? (
                <LoaderCircle
                  className="h-4 w-4 animate-spin"
                  aria-hidden="true"
                />
              ) : (
                <UserPlus className="h-4 w-4" aria-hidden="true" />
              )}
              {busy ? "Добавляем…" : "Добавить в курс"}
            </Button>
          </div>
        </form>
      ) : null}
    </DialogShell>
  );
}
