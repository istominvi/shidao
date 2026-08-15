"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpen,
  CalendarClock,
  FileSearch,
  LoaderCircle,
  MoreVertical,
  Pencil,
  Plus,
  Save,
  Search,
  WandSparkles,
} from "lucide-react";
import { AppPageHeader } from "@/components/app/page-header";
import { useSystemAssistantPageContext } from "@/components/assistant/system-assistant-provider";
import {
  courseBuilderRequest,
  loadCourseWorkspace,
} from "@/components/course-builder/course-builder-client";
import { AiLessonPlanDialog } from "@/components/course-builder/ai-lesson-plan-dialog";
import {
  courseLessonContentUpdatedAt,
  lessonScheduleInfo,
} from "@/components/course-builder/course-lesson-table";
import {
  CourseActions,
  CoursePublicationBadges,
} from "@/components/course-builder/course-actions";
import { CourseMaterialsPanel } from "@/components/course-builder/course-materials-panel";
import { CourseAttestationEditor } from "@/components/course-builder/course-attestation-editor";
import {
  LESSON_WORKSPACE_TABS,
  courseWorkspaceTabs,
  createCourseWorkspaceNavigation,
  openCourseWorkspaceLesson,
  reconcileCourseWorkspaceNavigation,
  returnToCourseWorkspace,
  type CourseWorkspaceSurface,
} from "@/components/course-builder/course-workspace-navigation";
import { LessonAuthoringWorkspace } from "@/components/course-builder/lesson-authoring-workspace";
import { usePageTransition } from "@/components/navigation/page-transition-provider";
import { usePrimaryHeaderSummary } from "@/components/navigation/primary-header-summary-provider";
import { CourseAudienceEditor } from "@/components/lesson-runs/course-audience-dialog";
import {
  loadCourseAudience,
  loadCourseHistory,
} from "@/components/lesson-runs/lesson-run-client";
import { LessonRunDialog } from "@/components/lesson-runs/lesson-run-dialog";
import {
  lessonRunState,
  openLessonRun,
} from "@/components/lesson-runs/lesson-run-format";
import { RunHistoryList } from "@/components/lesson-runs/run-history-list";
import { ActionMenu } from "@/components/ui/action-menu";
import { Button, productButtonClassName } from "@/components/ui/button";
import { DialogShell } from "@/components/ui/dialog-shell";
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
import {
  WorkspaceTabs,
  workspaceTabId,
  workspaceTabPanelId,
} from "@/components/ui/workspace-tabs";
import { ROUTES } from "@/lib/auth";
import type {
  CourseLesson,
  CourseWorkspace,
} from "@/modules/course-builder/domain";
import type {
  CourseAudience,
  LearnerProfile,
  LessonRun,
} from "@/modules/lesson-runs/domain";
import type { SystemAssistantActionResult } from "@/modules/ai/system-assistant-contracts";

type CourseWorkspaceClientProps = {
  courseId: string;
};

const COURSE_WORKSPACE_TABS_ID = "course-workspace";

const EMPTY_COURSE_AUDIENCE: CourseAudience = {
  directLearners: [],
  groups: [],
  effectiveLearners: [],
};

async function loadOwnedCourseProjection(courseId: string) {
  const workspace = await loadCourseWorkspace(courseId);
  if (workspace.learningAudience === "educators") {
    return {
      workspace,
      runs: [] as LessonRun[],
      audience: EMPTY_COURSE_AUDIENCE,
    };
  }
  const [runs, audience] = await Promise.all([
    loadCourseHistory(courseId),
    loadCourseAudience(courseId),
  ]);
  return { workspace, runs, audience };
}

type CourseLessonSortKey =
  "position" | "title" | "plan" | "student" | "schedule" | "updated";

const courseLessonCollator = new Intl.Collator("ru-RU", {
  numeric: true,
  sensitivity: "base",
});

const courseLessonUpdatedFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

function formatCourseLessonUpdatedAt(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Неизвестно"
    : courseLessonUpdatedFormatter.format(date);
}

function learnerVisibleComponentCount(lesson: CourseLesson) {
  return lesson.components.filter(
    (component) =>
      component.visibility === "learner_visible" && component.studentSlideId,
  ).length;
}

function compareCourseLessons(
  left: CourseLesson,
  right: CourseLesson,
  key: CourseLessonSortKey,
  runs: LessonRun[],
  direction: 1 | -1,
) {
  let difference = 0;
  if (key === "position") {
    difference = left.position - right.position;
  } else if (key === "title") {
    difference = courseLessonCollator.compare(left.title, right.title);
  } else if (key === "plan") {
    difference = left.components.length - right.components.length;
  } else if (key === "student") {
    difference = left.studentSlides.length - right.studentSlides.length;
    if (difference === 0) {
      difference =
        learnerVisibleComponentCount(left) -
        learnerVisibleComponentCount(right);
    }
  } else if (key === "schedule") {
    const leftSchedule = lessonScheduleInfo(
      runs.filter((run) => run.lessonId === left.id),
    );
    const rightSchedule = lessonScheduleInfo(
      runs.filter((run) => run.lessonId === right.id),
    );
    difference = leftSchedule.rank - rightSchedule.rank;
    if (
      difference === 0 &&
      leftSchedule.timestamp !== rightSchedule.timestamp
    ) {
      difference = leftSchedule.timestamp - rightSchedule.timestamp;
    }
  } else {
    difference =
      Date.parse(courseLessonContentUpdatedAt(left)) -
      Date.parse(courseLessonContentUpdatedAt(right));
  }

  if (difference !== 0) return direction * difference;
  const positionDifference = left.position - right.position;
  if (positionDifference !== 0) return positionDifference;
  return left.id.localeCompare(right.id);
}

type RunMutation = (
  label: string,
  action: () => Promise<unknown>,
) => Promise<boolean>;

function jsonRequest<T>(
  path: string,
  method: "POST" | "PATCH" | "DELETE",
  body?: unknown,
) {
  return courseBuilderRequest<T>(path, {
    method,
    headers:
      body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="field-label">{label}</span>
      {children}
      {hint ? (
        <span className="mt-1 block text-xs leading-5 text-neutral-500">
          {hint}
        </span>
      ) : null}
    </label>
  );
}

function StatusMessage({
  error,
  busyLabel,
}: {
  error: string | null;
  busyLabel: string | null;
}) {
  if (error) {
    return (
      <div
        className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800"
        role="alert"
      >
        {error}
      </div>
    );
  }
  if (busyLabel) {
    return (
      <div
        className="flex items-center gap-2 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-medium text-sky-900"
        role="status"
      >
        <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
        {busyLabel}
      </div>
    );
  }
  return null;
}

function CourseBasicsForm({
  course,
  disabled,
  runMutation,
}: {
  course: CourseWorkspace;
  disabled: boolean;
  runMutation: RunMutation;
}) {
  const [title, setTitle] = useState(course.title);
  const [subject, setSubject] = useState(course.subject);
  const [goal, setGoal] = useState(course.goal);
  const [level, setLevel] = useState(course.level);
  const [audienceDescription, setAudienceDescription] = useState(
    course.audienceDescription,
  );
  const [targetLessonCount, setTargetLessonCount] = useState(
    String(course.targetLessonCount),
  );
  const [teacherPreferences, setTeacherPreferences] = useState(
    course.teacherPreferences,
  );
  const [saved, setSaved] = useState(false);

  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        void (async () => {
          setSaved(false);
          const saved = await runMutation("Сохраняем настройки курса…", () =>
            jsonRequest(`/api/v2/courses/${course.id}`, "PATCH", {
              title,
              subject,
              goal,
              level,
              audienceDescription,
              targetLessonCount: Number(targetLessonCount),
              teacherPreferences,
            }),
          );
          if (saved) setSaved(true);
        })();
      }}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Название">
          <input
            required
            disabled={disabled}
            minLength={2}
            className="field-input"
            value={title}
            onChange={(event) => {
              setSaved(false);
              setTitle(event.target.value);
            }}
          />
        </Field>
        <Field label="Предмет или тема">
          <input
            required
            disabled={disabled}
            minLength={2}
            className="field-input"
            value={subject}
            onChange={(event) => {
              setSaved(false);
              setSubject(event.target.value);
            }}
          />
        </Field>
      </div>
      <Field label="Цель курса">
        <textarea
          required
          disabled={disabled}
          className="field-input min-h-24 resize-y"
          value={goal}
          onChange={(event) => {
            setSaved(false);
            setGoal(event.target.value);
          }}
        />
      </Field>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Уровень / исходная подготовка">
          <input
            required
            disabled={disabled}
            className="field-input"
            value={level}
            onChange={(event) => {
              setSaved(false);
              setLevel(event.target.value);
            }}
          />
        </Field>
        <Field label="Планируемое число уроков">
          <input
            required
            disabled={disabled}
            type="number"
            min={1}
            max={60}
            className="field-input"
            value={targetLessonCount}
            onChange={(event) => {
              setSaved(false);
              setTargetLessonCount(event.target.value);
            }}
          />
        </Field>
      </div>
      <Field label="Описание целевой аудитории">
        <textarea
          disabled={disabled}
          className="field-input min-h-20 resize-y"
          value={audienceDescription}
          onChange={(event) => {
            setSaved(false);
            setAudienceDescription(event.target.value);
          }}
        />
      </Field>
      <Field label="Пожелания преподавателя">
        <textarea
          disabled={disabled}
          className="field-input min-h-24 resize-y"
          value={teacherPreferences}
          onChange={(event) => {
            setSaved(false);
            setTeacherPreferences(event.target.value);
          }}
        />
      </Field>
      <div className="dialog-shell-actions">
        {saved ? (
          <span className="course-inline-save-status" role="status">
            Настройки сохранены
          </span>
        ) : null}
        <Button type="submit" disabled={disabled}>
          <Save className="h-4 w-4" aria-hidden="true" />
          Сохранить настройки
        </Button>
      </div>
    </form>
  );
}

function CourseLessonsPanel({
  lessons,
  runs,
  audience,
  disabled,
  mutationError,
  onSelect,
  runMutation,
  onScheduleSummaryChanged,
  courseId,
  focusLessonId,
  onFocusRestored,
  teachingEnabled,
}: {
  lessons: CourseLesson[];
  runs: LessonRun[];
  audience: LearnerProfile[];
  disabled: boolean;
  mutationError: string | null;
  onSelect: (lessonId: string) => void;
  runMutation: RunMutation;
  onScheduleSummaryChanged: () => void;
  courseId: string;
  focusLessonId: string | null;
  onFocusRestored: () => void;
  teachingEnabled: boolean;
}) {
  const [newLessonTitle, setNewLessonTitle] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [aiLessonTitle, setAiLessonTitle] = useState<string | null>(null);
  const [submissionFailed, setSubmissionFailed] = useState(false);
  const [scheduledLessonId, setScheduledLessonId] = useState<string | null>(
    null,
  );
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<ProductTableSortState<CourseLessonSortKey>>({
    key: "position",
    direction: "asc",
  });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const lessonRowRefs = useRef(new Map<string, HTMLButtonElement>());
  const normalizedQuery = query.trim().toLocaleLowerCase("ru-RU");
  const visibleLessons = useMemo(() => {
    const matchingLessons = normalizedQuery
      ? lessons.filter((lesson) =>
          `${lesson.position} ${lesson.title} ${lesson.summary}`
            .toLocaleLowerCase("ru-RU")
            .includes(normalizedQuery),
        )
      : lessons;
    const direction = sort.direction === "asc" ? 1 : -1;
    return [...matchingLessons].sort((left, right) =>
      compareCourseLessons(left, right, sort.key, runs, direction),
    );
  }, [lessons, normalizedQuery, runs, sort]);

  useEffect(() => {
    if (!focusLessonId) return;
    const frame = window.requestAnimationFrame(() => {
      const target =
        lessonRowRefs.current.get(focusLessonId) ?? headingRef.current;
      target?.focus();
      target?.scrollIntoView({ block: "nearest" });
      onFocusRestored();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [focusLessonId, onFocusRestored]);

  function closeDialog() {
    if (disabled) return;
    setDialogOpen(false);
    setSubmissionFailed(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  }

  useEffect(() => {
    if (!dialogOpen) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape" || disabled) return;
      event.preventDefault();
      setDialogOpen(false);
      setSubmissionFailed(false);
      window.requestAnimationFrame(() => triggerRef.current?.focus());
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [dialogOpen, disabled]);

  async function createEmptyLesson() {
    const title = newLessonTitle.trim();
    if (!title || disabled) return;

    let createdLessonId: string | null = null;
    setSubmissionFailed(false);
    const saved = await runMutation("Создаём пустой урок…", async () => {
      const response = await jsonRequest<{ lesson: CourseLesson }>(
        `/api/v2/courses/${courseId}/lessons`,
        "POST",
        { title, summary: "" },
      );
      createdLessonId = response.lesson.id;
    });

    if (!saved || !createdLessonId) {
      setSubmissionFailed(true);
      return;
    }
    onSelect(createdLessonId);
    setNewLessonTitle("");
    setDialogOpen(false);
  }

  return (
    <>
      <section
        className="course-lessons-panel"
        aria-labelledby="course-lessons-heading"
      >
        <h2
          ref={headingRef}
          id="course-lessons-heading"
          className="sr-only"
          tabIndex={-1}
        >
          Уроки курса
        </h2>

        <div
          className="compact-page-toolbar course-lessons-toolbar"
          aria-label="Управление уроками"
        >
          <label className="compact-toolbar-search product-search-wrap">
            <span className="sr-only">Поиск уроков</span>
            <Search
              className="product-search-icon h-4 w-4"
              aria-hidden="true"
            />
            <Input
              type="search"
              value={query}
              disabled={disabled || lessons.length === 0}
              onChange={(event) => setQuery(event.target.value)}
              className="product-control-search"
              placeholder="Название или описание урока…"
              autoComplete="off"
            />
          </label>

          <div className="compact-toolbar-rail">
            <Button
              ref={triggerRef}
              type="button"
              disabled={disabled}
              onClick={() => {
                setSubmissionFailed(false);
                setDialogOpen(true);
              }}
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Добавить урок
            </Button>
          </div>
        </div>

        {lessons.length === 0 ? (
          <div className="workspace-empty-state course-lessons-empty">
            <BookOpen
              className="mx-auto h-7 w-7 text-neutral-400"
              aria-hidden="true"
            />
            <h3>В курсе пока нет уроков</h3>
            <p>
              Добавьте первый урок — он сохранится в базе как пустой черновик.
            </p>
          </div>
        ) : visibleLessons.length === 0 ? (
          <div className="workspace-empty-state course-lessons-empty">
            <Search
              className="mx-auto h-7 w-7 text-neutral-400"
              aria-hidden="true"
            />
            <h3>Ничего не найдено</h3>
            <p>Измените запрос или очистите поиск, чтобы увидеть все уроки.</p>
            <Button
              type="button"
              variant="secondary"
              className="mt-4"
              onClick={() => setQuery("")}
            >
              Очистить поиск
            </Button>
          </div>
        ) : (
          <div
            className="product-table-wrap course-index-table-wrap course-lessons-table-wrap"
            role="region"
            aria-label="Таблица уроков курса"
            tabIndex={0}
          >
            <ProductTable className="course-index-table course-lessons-table">
              <caption className="sr-only">
                {teachingEnabled
                  ? "Уроки курса: план, экран ученика, проведение и дата обновления"
                  : "Уроки курса: план, экран слушателя и дата обновления"}
              </caption>
              <colgroup>
                <col className="course-lessons-table-col-position" />
                <col className="course-lessons-table-col-title" />
                <col className="course-lessons-table-col-plan" />
                <col className="course-lessons-table-col-student" />
                {teachingEnabled ? (
                  <col className="course-lessons-table-col-schedule" />
                ) : null}
                <col className="course-lessons-table-col-updated" />
                <col className="course-lessons-table-col-actions" />
              </colgroup>
              <ProductTableHead>
                <ProductTableHeaderRow>
                  <ProductTableSortableHeaderCell
                    direction={sort.key === "position" ? sort.direction : null}
                    onSort={() =>
                      setSort((current) =>
                        nextProductTableSort(current, "position"),
                      )
                    }
                  >
                    №
                  </ProductTableSortableHeaderCell>
                  <ProductTableSortableHeaderCell
                    direction={sort.key === "title" ? sort.direction : null}
                    onSort={() =>
                      setSort((current) =>
                        nextProductTableSort(current, "title"),
                      )
                    }
                  >
                    Урок
                  </ProductTableSortableHeaderCell>
                  <ProductTableSortableHeaderCell
                    direction={sort.key === "plan" ? sort.direction : null}
                    onSort={() =>
                      setSort((current) =>
                        nextProductTableSort(current, "plan"),
                      )
                    }
                  >
                    План
                  </ProductTableSortableHeaderCell>
                  <ProductTableSortableHeaderCell
                    direction={sort.key === "student" ? sort.direction : null}
                    onSort={() =>
                      setSort((current) =>
                        nextProductTableSort(current, "student"),
                      )
                    }
                  >
                    Экран ученика
                  </ProductTableSortableHeaderCell>
                  {teachingEnabled ? (
                    <ProductTableSortableHeaderCell
                      direction={
                        sort.key === "schedule" ? sort.direction : null
                      }
                      onSort={() =>
                        setSort((current) =>
                          nextProductTableSort(current, "schedule"),
                        )
                      }
                    >
                      Проведение
                    </ProductTableSortableHeaderCell>
                  ) : null}
                  <ProductTableSortableHeaderCell
                    direction={sort.key === "updated" ? sort.direction : null}
                    onSort={() =>
                      setSort((current) =>
                        nextProductTableSort(current, "updated"),
                      )
                    }
                  >
                    Обновлён
                  </ProductTableSortableHeaderCell>
                  <ProductTableHeaderCell aria-label="Действия" />
                </ProductTableHeaderRow>
              </ProductTableHead>
              <ProductTableBody>
                {visibleLessons.map((lesson) => {
                  const lessonRuns = runs.filter(
                    (run) => run.lessonId === lesson.id,
                  );
                  const schedule = lessonScheduleInfo(lessonRuns);
                  const currentRun = openLessonRun(lessonRuns);
                  const scheduleActionLabel = currentRun
                    ? lessonRunState(currentRun) === "active"
                      ? "Завершить урок"
                      : lessonRunState(currentRun) === "attention"
                        ? "Отметить результаты"
                        : "Изменить назначение"
                    : "Назначить урок";
                  const visibleComponentCount =
                    learnerVisibleComponentCount(lesson);
                  const studentScreenLabel =
                    lesson.studentSlides.length === 0 &&
                    visibleComponentCount === 0
                      ? "Не настроен"
                      : `${lesson.studentSlides.length} сл. · ${visibleComponentCount} эл.`;
                  const lessonUpdatedAt = courseLessonContentUpdatedAt(lesson);
                  const lessonActionItems = [
                    {
                      id: "open",
                      label: "Открыть урок",
                      icon: BookOpen,
                      onSelect: () => onSelect(lesson.id),
                    },
                    ...(teachingEnabled
                      ? [
                          {
                            id: "schedule",
                            label: scheduleActionLabel,
                            icon: CalendarClock,
                            onSelect: () => setScheduledLessonId(lesson.id),
                          },
                        ]
                      : []),
                  ];
                  return (
                    <ProductTableRow key={lesson.id}>
                      <ProductTableCell>{lesson.position}</ProductTableCell>
                      <ProductTablePrimaryCell className="overflow-hidden">
                        <button
                          type="button"
                          ref={(node) => {
                            if (node)
                              lessonRowRefs.current.set(lesson.id, node);
                            else lessonRowRefs.current.delete(lesson.id);
                          }}
                          className="course-index-table-link course-lessons-table-open"
                          title={lesson.summary || lesson.title}
                          onClick={() => onSelect(lesson.id)}
                        >
                          <ProductTableTruncate>
                            {lesson.title}
                          </ProductTableTruncate>
                        </button>
                      </ProductTablePrimaryCell>
                      <ProductTableCell className="overflow-hidden">
                        <ProductTableTruncate
                          title={`Компонентов: ${lesson.components.length}`}
                        >
                          Компонентов: {lesson.components.length}
                        </ProductTableTruncate>
                      </ProductTableCell>
                      <ProductTableCell className="overflow-hidden">
                        <ProductTableTruncate
                          title={
                            studentScreenLabel === "Не настроен"
                              ? studentScreenLabel
                              : `${lesson.studentSlides.length} слайдов · ${visibleComponentCount} элементов`
                          }
                        >
                          {studentScreenLabel}
                        </ProductTableTruncate>
                      </ProductTableCell>
                      {teachingEnabled ? (
                        <ProductTableCell className="overflow-hidden">
                          <ProductTableTruncate title={schedule.label}>
                            {schedule.label}
                          </ProductTableTruncate>
                        </ProductTableCell>
                      ) : null}
                      <ProductTableCell className="overflow-hidden">
                        <time
                          className="course-index-table-truncate"
                          dateTime={lessonUpdatedAt}
                          title={`Обновлён ${formatCourseLessonUpdatedAt(lessonUpdatedAt)}`}
                        >
                          {formatCourseLessonUpdatedAt(lessonUpdatedAt)}
                        </time>
                      </ProductTableCell>
                      <ProductTableActionCell className="course-index-table-action-cell text-right">
                        <span className="course-index-table-actions">
                          <ActionMenu
                            className="course-index-table-action-menu course-lessons-table-action-menu"
                            label={`Действия с уроком «${lesson.title}»`}
                            triggerIcon={MoreVertical}
                            triggerVariant="ghost"
                            disabled={disabled}
                            portal
                            items={lessonActionItems}
                          />
                        </span>
                      </ProductTableActionCell>
                    </ProductTableRow>
                  );
                })}
              </ProductTableBody>
            </ProductTable>
          </div>
        )}
      </section>

      {dialogOpen ? (
        <DialogShell
          title="Новый урок"
          description="Укажите обязательное название и выберите способ создания."
          onClose={closeDialog}
          panelClassName="max-w-3xl"
        >
          <form
            className="grid gap-5"
            onSubmit={(event) => {
              event.preventDefault();
              void createEmptyLesson();
            }}
          >
            <Field
              label="Название урока"
              hint="Название — обязательная часть урока, а не отдельный компонент."
            >
              <input
                id="new-lesson-title"
                autoFocus
                required
                maxLength={180}
                className="field-input"
                placeholder="Например, Первое знакомство"
                value={newLessonTitle}
                onChange={(event) => {
                  setNewLessonTitle(event.target.value);
                  setSubmissionFailed(false);
                }}
              />
            </Field>

            {submissionFailed ? (
              <p
                className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800"
                role="alert"
              >
                Не удалось создать урок. Проверьте данные и повторите попытку.
              </p>
            ) : null}

            <div className="grid gap-3 md:grid-cols-2">
              <section className="flex flex-col rounded-2xl border border-neutral-950 bg-neutral-950 p-4 text-white">
                <div className="flex items-center gap-2">
                  <Pencil className="h-4 w-4" aria-hidden="true" />
                  <h3 className="font-bold">Собрать вручную</h3>
                </div>
                <p className="mt-2 flex-1 text-sm leading-6 text-neutral-300">
                  Создастся пустой урок. Вы сами добавите нужные компоненты —
                  без ИИ и без списания токенов.
                </p>
                <Button
                  type="submit"
                  variant="secondary"
                  className="mt-4 w-full"
                  disabled={disabled || !newLessonTitle.trim()}
                >
                  {disabled ? "Создаём…" : "Создать пустой урок"}
                </Button>
              </section>

              <section className="flex flex-col rounded-2xl border border-violet-200 bg-violet-50 p-4">
                <div className="flex items-center gap-2 text-violet-950">
                  <WandSparkles className="h-4 w-4" aria-hidden="true" />
                  <h3 className="font-bold">Заполнить с помощью ИИ</h3>
                </div>
                <p className="mt-2 flex-1 text-sm leading-6 text-violet-900/75">
                  ИИ предложит комментарий преподавателя и компоненты урока. Вы
                  увидите план до сохранения.
                </p>
                <Button
                  type="button"
                  variant="secondary"
                  className="mt-4 w-full"
                  disabled={disabled || !newLessonTitle.trim()}
                  onClick={() => {
                    const title = newLessonTitle.trim();
                    if (!title) return;
                    setDialogOpen(false);
                    setAiLessonTitle(title);
                  }}
                >
                  Заполнить с помощью ИИ
                </Button>
              </section>
            </div>

            <div className="dialog-shell-actions">
              <Button
                type="button"
                variant="ghost"
                disabled={disabled}
                onClick={closeDialog}
              >
                Отмена
              </Button>
            </div>
          </form>
        </DialogShell>
      ) : null}

      {aiLessonTitle ? (
        <AiLessonPlanDialog
          courseId={courseId}
          lessonId={null}
          title={aiLessonTitle}
          disabled={disabled}
          runMutation={runMutation}
          onClose={() => {
            setAiLessonTitle(null);
            setDialogOpen(true);
          }}
          onApplied={(lessonId) => {
            setAiLessonTitle(null);
            setNewLessonTitle("");
            onSelect(lessonId);
          }}
        />
      ) : null}

      {teachingEnabled && scheduledLessonId ? (
        <LessonRunDialog
          lesson={lessons.find((lesson) => lesson.id === scheduledLessonId)!}
          runs={runs.filter((run) => run.lessonId === scheduledLessonId)}
          learners={audience}
          disabled={disabled}
          mutationError={mutationError}
          runMutation={runMutation}
          onScheduleSummaryChanged={onScheduleSummaryChanged}
          onClose={() => setScheduledLessonId(null)}
        />
      ) : null}
    </>
  );
}

function CourseSourcesPanel() {
  return (
    <section className="course-about-section course-about-sources">
      <div className="workspace-panel-heading">
        <div>
          <p className="workspace-eyebrow">Основа для подготовки уроков</p>
          <h2>Источники</h2>
        </div>
      </div>
      <div className="workspace-empty-panel">
        <span className="workspace-empty-icon workspace-empty-icon-blue">
          <FileSearch aria-hidden="true" />
        </span>
        <h3>Источники ещё не подключены</h3>
        <p>
          Здесь появятся документы и ссылки после запуска безопасного извлечения
          текста. Прикреплённый файл пока считается материалом, а не изученным
          источником.
        </p>
      </div>
    </section>
  );
}

function CourseAboutPanel({
  course,
  audience,
  disabled,
  mutationError,
  runMutation,
}: {
  course: CourseWorkspace;
  audience: CourseAudience;
  disabled: boolean;
  mutationError: string | null;
  runMutation: RunMutation;
}) {
  const educatorCourse = course.learningAudience === "educators";
  return (
    <section
      className="workspace-surface course-about-panel"
      aria-label={
        educatorCourse
          ? "Настройки и источники курса"
          : "Настройки, аудитория и источники курса"
      }
      tabIndex={0}
    >
      <section className="course-about-section">
        <div className="workspace-panel-heading">
          <div>
            <p className="workspace-eyebrow">Основные сведения</p>
            <h2>Настройки курса</h2>
          </div>
        </div>
        <p className="workspace-surface-note course-about-section-note">
          Эти данные задают основу курса и контекст для подготовки уроков.
        </p>
        <CourseBasicsForm
          key={course.id}
          course={course}
          disabled={disabled}
          runMutation={runMutation}
        />
      </section>

      {!educatorCourse ? (
        <section id="course-audience-section" className="course-about-section">
          <div className="workspace-panel-heading">
            <div>
              <p className="workspace-eyebrow">Фактический состав</p>
              <h2 id="course-audience-heading" tabIndex={-1}>
                Ученики и группы курса
              </h2>
            </div>
          </div>
          <p className="workspace-surface-note course-about-section-note">
            {
              "Выберите группы и отдельных учеников. Каждый профиль учитывается один раз, даже если выбран несколькими способами."
            }
          </p>
          <CourseAudienceEditor
            key={course.id}
            courseId={course.id}
            audience={audience}
            disabled={disabled}
            mutationError={mutationError}
            runMutation={runMutation}
          />
        </section>
      ) : null}

      <CourseSourcesPanel />
    </section>
  );
}

function CourseHistoryPanel({ runs }: { runs: LessonRun[] }) {
  return (
    <RunHistoryList
      runs={runs.filter((run) => Boolean(run.endedAt))}
      showLessonTitle
      emptyTitle="Курс ещё не проводился"
      emptyDescription="Назначьте время любому уроку. После завершения здесь появятся проведения всего курса, отчёты и результаты учеников."
    />
  );
}

export function CourseWorkspaceClient({
  courseId,
}: CourseWorkspaceClientProps) {
  const pageTransition = usePageTransition();
  const { refresh: refreshPrimaryHeaderSummary } = usePrimaryHeaderSummary();
  const [course, setCourse] = useState<CourseWorkspace | null>(null);
  const [courseRuns, setCourseRuns] = useState<LessonRun[]>([]);
  const [courseAudience, setCourseAudience] = useState<CourseAudience>(
    EMPTY_COURSE_AUDIENCE,
  );
  const [navigation, setNavigation] = useState(createCourseWorkspaceNavigation);
  const [mountedCourseSurfaces, setMountedCourseSurfaces] = useState<
    ReadonlySet<CourseWorkspaceSurface>
  >(() => new Set(["lessons"]));
  const [returnFocusLessonId, setReturnFocusLessonId] = useState<string | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [busyLabel, setBusyLabel] = useState<string | null>(null);
  const mutationInFlightRef = useRef(false);

  const reload = useCallback(async () => {
    const { workspace, runs, audience } =
      await loadOwnedCourseProjection(courseId);
    setCourse(workspace);
    setCourseRuns(runs);
    setCourseAudience(audience);
    setNavigation((current) =>
      reconcileCourseWorkspaceNavigation(
        current,
        workspace.lessons.map((lesson) => lesson.id),
      ),
    );
    return workspace;
  }, [courseId]);

  useEffect(() => {
    let active = true;
    void loadOwnedCourseProjection(courseId)
      .then(({ workspace, runs, audience }) => {
        if (!active) return;
        setCourse(workspace);
        setCourseRuns(runs);
        setCourseAudience(audience);
        const searchParams = new URL(window.location.href).searchParams;
        const requestedLessonId = searchParams.get("lesson");
        const availableTabs = courseWorkspaceTabs(
          workspace.learningAudience === "educators",
        );
        const requestedCourseSurface = availableTabs.find(
          (item) => item.value === searchParams.get("tab"),
        )?.value;
        const audienceRequested =
          workspace.learningAudience === "children" &&
          searchParams.get("audience") === "1";
        const validRequestedLesson = Boolean(
          requestedLessonId &&
          workspace.lessons.some((lesson) => lesson.id === requestedLessonId),
        );
        if (requestedLessonId && validRequestedLesson) {
          setNavigation((current) =>
            openCourseWorkspaceLesson(current, requestedLessonId),
          );
        } else if (audienceRequested || requestedCourseSurface) {
          const nextSurface = audienceRequested
            ? "about"
            : (requestedCourseSurface ?? "lessons");
          setNavigation((current) => ({
            ...current,
            courseSurface: nextSurface,
          }));
          setMountedCourseSurfaces((current) =>
            new Set(current).add(nextSurface),
          );
        }
        if (requestedLessonId || audienceRequested) {
          const nextUrl = new URL(window.location.href);
          nextUrl.searchParams.delete("lesson");
          nextUrl.searchParams.delete("audience");
          if (validRequestedLesson) nextUrl.searchParams.delete("tab");
          else if (audienceRequested) nextUrl.searchParams.set("tab", "about");
          window.history.replaceState(
            null,
            "",
            `${nextUrl.pathname}${nextUrl.search}`,
          );
        }
        if (audienceRequested) {
          window.requestAnimationFrame(() => {
            window.requestAnimationFrame(() => {
              const heading = document.getElementById(
                "course-audience-heading",
              );
              heading?.focus({ preventScroll: true });
              heading?.scrollIntoView({ block: "start" });
            });
          });
        }
      })
      .catch((caught: unknown) => {
        if (!active) return;
        setError(
          caught instanceof Error ? caught.message : "Не удалось открыть курс.",
        );
      });
    return () => {
      active = false;
    };
  }, [courseId]);

  const runMutation = useCallback<RunMutation>(
    async (label, action) => {
      if (mutationInFlightRef.current) return false;
      mutationInFlightRef.current = true;
      setBusyLabel(label);
      setError(null);
      try {
        await action();
        await reload();
        return true;
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : "Не удалось сохранить изменение.",
        );
        return false;
      } finally {
        mutationInFlightRef.current = false;
        setBusyLabel(null);
      }
    },
    [reload],
  );

  const selectedLesson =
    course?.lessons.find(
      (lesson) => lesson.id === navigation.selectedLessonId,
    ) ?? null;
  const handleAssistantActionApplied = useCallback(
    async (result: SystemAssistantActionResult) => {
      if (
        result.type === "course.create_draft" ||
        result.courseId !== courseId
      ) {
        return;
      }
      const workspace = await reload();
      if (result.type === "lesson.delete") {
        setNavigation((current) => returnToCourseWorkspace(current));
      } else if (
        workspace.lessons.some((lesson) => lesson.id === result.lessonId)
      ) {
        setNavigation((current) =>
          openCourseWorkspaceLesson(current, result.lessonId),
        );
      }
      const url = new URL(window.location.href);
      url.searchParams.delete("lesson");
      url.searchParams.delete("tab");
      window.history.replaceState(null, "", `${url.pathname}${url.search}`);
    },
    [courseId, reload],
  );
  const educatorCourse = course?.learningAudience === "educators";
  const availableCourseTabs = courseWorkspaceTabs(educatorCourse === true);
  useSystemAssistantPageContext(
    course
      ? {
          surface: selectedLesson ? "lesson" : "course",
          view: selectedLesson
            ? (`lesson_${navigation.lessonSurface}` as const)
            : (`course_${navigation.courseSurface}` as const),
          courseId: course.id,
          lessonId: selectedLesson?.id ?? null,
          label: selectedLesson
            ? `${course.title} · Урок ${selectedLesson.position}. ${selectedLesson.title} · ${LESSON_WORKSPACE_TABS.find((item) => item.value === navigation.lessonSurface)?.label ?? "План"}`
            : `Курс «${course.title}» · ${availableCourseTabs.find((item) => item.value === navigation.courseSurface)?.label ?? "Уроки"}`,
          onActionApplied: handleAssistantActionApplied,
        }
      : null,
  );

  if (!course) {
    if (error) {
      return (
        <div className="container app-page-container py-12">
          <StatusMessage error={error} busyLabel={null} />
          <Link
            href={ROUTES.courses}
            className={`${productButtonClassName("secondary")} mt-4`}
          >
            Вернуться к курсам
          </Link>
        </div>
      );
    }
    return null;
  }

  const readyAttachmentCount = course.attachments.filter(
    (asset) => asset.status === "ready",
  ).length;
  const courseTabs = availableCourseTabs.map((item) => {
    if (item.value === "lessons") {
      return { ...item, count: course.lessons.length };
    }
    if (item.value === "materials") {
      return { ...item, count: course.attachments.length };
    }
    return item;
  });
  const hasPublicationBadges = Boolean(
    course.publication &&
    (educatorCourse
      ? (course.publication.status === "published" &&
          course.publication.approvedRevisionId) ||
        course.publication.reviewStatus ||
        course.publication.hasUnpublishedChanges
      : course.publication.status === "published"),
  );

  function selectCourseSurface(courseSurface: CourseWorkspaceSurface) {
    setMountedCourseSurfaces((current) => new Set(current).add(courseSurface));
    setNavigation((current) => ({ ...current, courseSurface }));
    const url = new URL(window.location.href);
    if (courseSurface === "lessons") url.searchParams.delete("tab");
    else url.searchParams.set("tab", courseSurface);
    window.history.replaceState(null, "", `${url.pathname}${url.search}`);
  }

  function openLesson(lessonId: string) {
    const update = () => {
      const url = new URL(window.location.href);
      url.searchParams.delete("lesson");
      url.searchParams.delete("tab");
      window.history.replaceState(null, "", `${url.pathname}${url.search}`);
      setNavigation((current) => openCourseWorkspaceLesson(current, lessonId));
    };
    if (pageTransition) pageTransition.runUpdate("forward", update);
    else update();
  }

  return (
    <div className="container app-page-container course-workspace-container pb-16">
      {selectedLesson ? (
        <LessonAuthoringWorkspace
          key={selectedLesson.id}
          course={course}
          lesson={selectedLesson}
          surface={navigation.lessonSurface}
          onSurfaceChange={(lessonSurface) =>
            setNavigation((current) => ({ ...current, lessonSurface }))
          }
          onBackToCourse={() => {
            setReturnFocusLessonId(selectedLesson.id);
            setNavigation((current) => returnToCourseWorkspace(current));
          }}
          status={
            error || busyLabel ? (
              <StatusMessage error={error} busyLabel={busyLabel} />
            ) : undefined
          }
          disabled={Boolean(busyLabel)}
          mutationError={error}
          runMutation={runMutation}
          onScheduleSummaryChanged={refreshPrimaryHeaderSummary}
          runs={courseRuns.filter((run) => run.lessonId === selectedLesson.id)}
          learners={courseAudience.effectiveLearners}
        />
      ) : (
        <>
          <AppPageHeader
            back={{ type: "link", href: ROUTES.courses, label: "Курсы" }}
            title={course.title}
            metric={
              educatorCourse
                ? `Уроков: ${course.lessonCount} из ${course.targetLessonCount} · вложений: ${readyAttachmentCount}`
                : `Уроков: ${course.lessonCount} из ${course.targetLessonCount} · учеников: ${courseAudience.effectiveLearners.length} · вложений: ${readyAttachmentCount}`
            }
            meta={
              hasPublicationBadges ? (
                <CoursePublicationBadges
                  publication={course.publication}
                  learningAudience={course.learningAudience}
                />
              ) : null
            }
            actions={<CourseActions course={course} onChanged={reload} />}
          />

          <WorkspaceTabs
            idBase={COURSE_WORKSPACE_TABS_ID}
            ariaLabel="Разделы курса"
            value={navigation.courseSurface}
            items={courseTabs}
            onChange={selectCourseSurface}
          />
        </>
      )}

      {!selectedLesson ? (
        <StatusMessage error={error} busyLabel={busyLabel} />
      ) : null}

      {availableCourseTabs.map((item) => {
        const active =
          !selectedLesson && item.value === navigation.courseSurface;
        const mounted = active || mountedCourseSurfaces.has(item.value);

        return (
          <div
            key={item.value}
            id={workspaceTabPanelId(COURSE_WORKSPACE_TABS_ID, item.value)}
            role="tabpanel"
            aria-labelledby={workspaceTabId(
              COURSE_WORKSPACE_TABS_ID,
              item.value,
            )}
            hidden={!active}
            tabIndex={0}
          >
            {mounted && item.value === "lessons" ? (
              <CourseLessonsPanel
                lessons={course.lessons}
                runs={courseRuns}
                audience={courseAudience.effectiveLearners}
                disabled={Boolean(busyLabel)}
                mutationError={error}
                onSelect={openLesson}
                runMutation={runMutation}
                onScheduleSummaryChanged={refreshPrimaryHeaderSummary}
                courseId={course.id}
                focusLessonId={returnFocusLessonId}
                onFocusRestored={() => setReturnFocusLessonId(null)}
                teachingEnabled={!educatorCourse}
              />
            ) : null}
            {mounted && item.value === "about" ? (
              <CourseAboutPanel
                course={course}
                audience={courseAudience}
                disabled={Boolean(busyLabel)}
                mutationError={error}
                runMutation={runMutation}
              />
            ) : null}
            {mounted && item.value === "materials" ? (
              <CourseMaterialsPanel course={course} onOpenLesson={openLesson} />
            ) : null}
            {mounted && item.value === "history" ? (
              <CourseHistoryPanel runs={courseRuns} />
            ) : null}
            {mounted && item.value === "attestation" ? (
              <CourseAttestationEditor courseId={course.id} />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
