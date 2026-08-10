"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  FileSearch,
  LoaderCircle,
  Pencil,
  Plus,
  Save,
  Settings,
  Users,
  WandSparkles,
} from "lucide-react";
import { AppPageHeader } from "@/components/app/page-header";
import {
  courseBuilderRequest,
  loadCourseWorkspace,
} from "@/components/course-builder/course-builder-client";
import { AiLessonPlanDialog } from "@/components/course-builder/ai-lesson-plan-dialog";
import { AiCourseAssistantDialog } from "@/components/course-builder/ai-course-assistant-dialog";
import {
  CourseActions,
  CoursePublicationBadges,
} from "@/components/course-builder/course-actions";
import { CourseMaterialsPanel } from "@/components/course-builder/course-materials-panel";
import {
  COURSE_WORKSPACE_TABS,
  createCourseWorkspaceNavigation,
  openCourseWorkspaceLesson,
  reconcileCourseWorkspaceNavigation,
  returnToCourseWorkspace,
  type CourseWorkspaceSurface,
} from "@/components/course-builder/course-workspace-navigation";
import { LessonAuthoringWorkspace } from "@/components/course-builder/lesson-authoring-workspace";
import { CourseAudienceDialog } from "@/components/lesson-runs/course-audience-dialog";
import {
  loadCourseAudience,
  loadCourseHistory,
} from "@/components/lesson-runs/lesson-run-client";
import {
  LessonRunDialog,
  LessonRunStatusButton,
} from "@/components/lesson-runs/lesson-run-dialog";
import { completedLessonRunCount } from "@/components/lesson-runs/lesson-run-format";
import { RunHistoryList } from "@/components/lesson-runs/run-history-list";
import { Button, productButtonClassName } from "@/components/ui/button";
import { DialogShell } from "@/components/ui/dialog-shell";
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

type CourseWorkspaceClientProps = {
  courseId: string;
};

const COURSE_WORKSPACE_TABS_ID = "course-workspace";

const EMPTY_COURSE_AUDIENCE: CourseAudience = {
  directLearners: [],
  groups: [],
  effectiveLearners: [],
};

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
  onSaved,
}: {
  course: CourseWorkspace;
  disabled: boolean;
  runMutation: RunMutation;
  onSaved: () => void;
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

  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        void (async () => {
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
          if (saved) onSaved();
        })();
      }}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Название">
          <input
            autoFocus
            required
            minLength={2}
            className="field-input"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </Field>
        <Field label="Предмет или тема">
          <input
            required
            minLength={2}
            className="field-input"
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
          />
        </Field>
      </div>
      <Field label="Цель курса">
        <textarea
          required
          className="field-input min-h-24 resize-y"
          value={goal}
          onChange={(event) => setGoal(event.target.value)}
        />
      </Field>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Уровень / исходная подготовка">
          <input
            required
            className="field-input"
            value={level}
            onChange={(event) => setLevel(event.target.value)}
          />
        </Field>
        <Field label="Планируемое число уроков">
          <input
            required
            type="number"
            min={1}
            max={60}
            className="field-input"
            value={targetLessonCount}
            onChange={(event) => setTargetLessonCount(event.target.value)}
          />
        </Field>
      </div>
      <Field label="Целевая аудитория">
        <textarea
          className="field-input min-h-20 resize-y"
          value={audienceDescription}
          onChange={(event) => setAudienceDescription(event.target.value)}
        />
      </Field>
      <Field label="Пожелания преподавателя">
        <textarea
          className="field-input min-h-24 resize-y"
          value={teacherPreferences}
          onChange={(event) => setTeacherPreferences(event.target.value)}
        />
      </Field>
      <div className="dialog-shell-actions">
        <Button type="submit" disabled={disabled}>
          <Save className="h-4 w-4" aria-hidden="true" />
          Сохранить настройки
        </Button>
      </div>
    </form>
  );
}

function CourseSettingsDialog({
  course,
  disabled,
  runMutation,
  onClose,
}: {
  course: CourseWorkspace;
  disabled: boolean;
  runMutation: RunMutation;
  onClose: () => void;
}) {
  return (
    <DialogShell
      title="Настройки курса"
      description="Основные сведения, цель и пожелания преподавателя."
      onClose={onClose}
      panelClassName="max-w-3xl"
    >
      <CourseBasicsForm
        key={course.updatedAt}
        course={course}
        disabled={disabled}
        runMutation={runMutation}
        onSaved={onClose}
      />
    </DialogShell>
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
  courseId,
  focusLessonId,
  onFocusRestored,
}: {
  lessons: CourseLesson[];
  runs: LessonRun[];
  audience: LearnerProfile[];
  disabled: boolean;
  mutationError: string | null;
  onSelect: (lessonId: string) => void;
  runMutation: RunMutation;
  courseId: string;
  focusLessonId: string | null;
  onFocusRestored: () => void;
}) {
  const [newLessonTitle, setNewLessonTitle] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [aiLessonTitle, setAiLessonTitle] = useState<string | null>(null);
  const [submissionFailed, setSubmissionFailed] = useState(false);
  const [scheduledLessonId, setScheduledLessonId] = useState<string | null>(
    null,
  );
  const triggerRef = useRef<HTMLButtonElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const lessonRowRefs = useRef(new Map<string, HTMLButtonElement>());

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
      <section className="workspace-surface">
        <div className="workspace-panel-heading">
          <div>
            <p className="workspace-eyebrow">Структура курса</p>
            <h2 ref={headingRef} tabIndex={-1}>
              Уроки
            </h2>
          </div>
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

        {lessons.length > 0 ? (
          <div className="workspace-lesson-list">
            {lessons.map((lesson) => {
              const lessonRuns = runs.filter(
                (run) => run.lessonId === lesson.id,
              );
              return (
                <div key={lesson.id} className="workspace-lesson-item">
                  <button
                    type="button"
                    ref={(node) => {
                      if (node) lessonRowRefs.current.set(lesson.id, node);
                      else lessonRowRefs.current.delete(lesson.id);
                    }}
                    onClick={() => onSelect(lesson.id)}
                    className="workspace-lesson-row"
                  >
                    <BookOpen
                      className="workspace-lesson-leading-icon"
                      aria-hidden="true"
                    />
                    <span className="workspace-lesson-number">
                      {lesson.position}
                    </span>
                    <span className="workspace-lesson-title">
                      <strong>{lesson.title}</strong>
                      <small>
                        Компонентов: {lesson.components.length} · проведений:{" "}
                        {completedLessonRunCount(lessonRuns)}
                      </small>
                    </span>
                    <ArrowRight
                      className="workspace-lesson-arrow"
                      aria-hidden="true"
                    />
                  </button>
                  <LessonRunStatusButton
                    runs={lessonRuns}
                    disabled={disabled}
                    className="workspace-lesson-schedule"
                    onClick={() => setScheduledLessonId(lesson.id)}
                  />
                </div>
              );
            })}
          </div>
        ) : (
          <div className="workspace-empty-state">
            <BookOpen
              className="mx-auto h-7 w-7 text-neutral-400"
              aria-hidden="true"
            />
            <h3>В курсе пока нет уроков</h3>
            <p>
              Добавьте первый урок — он сохранится в базе как пустой черновик.
            </p>
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

      {scheduledLessonId ? (
        <LessonRunDialog
          lesson={lessons.find((lesson) => lesson.id === scheduledLessonId)!}
          runs={runs.filter((run) => run.lessonId === scheduledLessonId)}
          learners={audience}
          disabled={disabled}
          mutationError={mutationError}
          runMutation={runMutation}
          onClose={() => setScheduledLessonId(null)}
        />
      ) : null}
    </>
  );
}

function CourseDescriptionPanel({ course }: { course: CourseWorkspace }) {
  const details = [
    ["Предмет или тема", course.subject],
    ["Уровень", course.level],
    ["План уроков", String(course.targetLessonCount)],
    ["Целевая аудитория", course.audienceDescription || "Не указана"],
  ] as const;

  return (
    <section className="course-about-section">
      <div className="workspace-panel-heading">
        <div>
          <p className="workspace-eyebrow">Основные сведения</p>
          <h2>Описание курса</h2>
        </div>
      </div>

      <dl className="course-description-grid">
        {details.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
        <div className="course-description-wide">
          <dt>Цель курса</dt>
          <dd>{course.goal}</dd>
        </div>
        <div className="course-description-wide course-description-private">
          <dt>Пожелания преподавателя · только для вас</dt>
          <dd>{course.teacherPreferences || "Пожелания пока не добавлены."}</dd>
        </div>
      </dl>
    </section>
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

function CourseAboutPanel({ course }: { course: CourseWorkspace }) {
  return (
    <section
      className="workspace-surface course-about-panel"
      aria-label="Описание, источники и материалы курса"
      tabIndex={0}
    >
      <CourseDescriptionPanel course={course} />
      <CourseSourcesPanel />
      <div className="course-about-materials">
        <CourseMaterialsPanel course={course} />
      </div>
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

function WorkspaceSkeleton() {
  return (
    <div className="container app-page-container py-12" role="status">
      <div className="flex items-center gap-3 rounded-3xl border border-neutral-200 bg-white/80 p-6 text-neutral-700 shadow-sm">
        <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden="true" />
        Загружаем курс, уроки и компоненты из базы…
      </div>
    </div>
  );
}

export function CourseWorkspaceClient({
  courseId,
}: CourseWorkspaceClientProps) {
  const [course, setCourse] = useState<CourseWorkspace | null>(null);
  const [courseRuns, setCourseRuns] = useState<LessonRun[]>([]);
  const [courseAudience, setCourseAudience] = useState<CourseAudience>(
    EMPTY_COURSE_AUDIENCE,
  );
  const [navigation, setNavigation] = useState(createCourseWorkspaceNavigation);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [audienceOpen, setAudienceOpen] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [returnFocusLessonId, setReturnFocusLessonId] = useState<string | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [busyLabel, setBusyLabel] = useState<string | null>(null);
  const settingsTriggerRef = useRef<HTMLButtonElement>(null);
  const audienceTriggerRef = useRef<HTMLButtonElement>(null);
  const mutationInFlightRef = useRef(false);

  const reload = useCallback(async () => {
    const [workspace, runs, audience] = await Promise.all([
      loadCourseWorkspace(courseId),
      loadCourseHistory(courseId),
      loadCourseAudience(courseId),
    ]);
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
    void Promise.all([
      loadCourseWorkspace(courseId),
      loadCourseHistory(courseId),
      loadCourseAudience(courseId),
    ])
      .then(([workspace, runs, audience]) => {
        if (!active) return;
        setCourse(workspace);
        setCourseRuns(runs);
        setCourseAudience(audience);
        const searchParams = new URL(window.location.href).searchParams;
        const requestedLessonId = searchParams.get("lesson");
        if (searchParams.get("audience") === "1") setAudienceOpen(true);
        if (
          requestedLessonId &&
          workspace.lessons.some((lesson) => lesson.id === requestedLessonId)
        ) {
          setNavigation((current) =>
            openCourseWorkspaceLesson(current, requestedLessonId),
          );
        }
        if (requestedLessonId || searchParams.get("audience") === "1") {
          window.history.replaceState(null, "", window.location.pathname);
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

  const closeSettings = useCallback(() => {
    if (busyLabel) return;
    setSettingsOpen(false);
    window.requestAnimationFrame(() => settingsTriggerRef.current?.focus());
  }, [busyLabel]);

  const closeAudience = useCallback(() => {
    if (busyLabel) return;
    setAudienceOpen(false);
    window.requestAnimationFrame(() => audienceTriggerRef.current?.focus());
  }, [busyLabel]);

  useEffect(() => {
    if (!settingsOpen) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (settingsOpen && !busyLabel) {
        event.preventDefault();
        closeSettings();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [busyLabel, closeSettings, settingsOpen]);

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
    return <WorkspaceSkeleton />;
  }

  const selectedLesson =
    course.lessons.find(
      (lesson) => lesson.id === navigation.selectedLessonId,
    ) ?? null;
  const readyAttachmentCount = course.attachments.filter(
    (asset) => asset.status === "ready",
  ).length;
  const courseTabs = COURSE_WORKSPACE_TABS.map((item) =>
    item.value === "lessons" ? { ...item, count: course.lessons.length } : item,
  );

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
          runs={courseRuns.filter((run) => run.lessonId === selectedLesson.id)}
          learners={courseAudience.effectiveLearners}
        />
      ) : (
        <>
          <AppPageHeader
            back={{ type: "link", href: ROUTES.courses, label: "Курсы" }}
            title={course.title}
            description={`Создано уроков: ${course.lessonCount} из ${course.targetLessonCount} · готовых вложений: ${readyAttachmentCount}`}
            actions={
              <>
                <CoursePublicationBadges publication={course.publication} />
                <Button
                  variant="secondary"
                  onClick={() => setAssistantOpen(true)}
                >
                  <WandSparkles className="h-4 w-4" aria-hidden="true" />
                  ИИ-ассистент
                </Button>
                <Button
                  ref={audienceTriggerRef}
                  variant="secondary"
                  onClick={() => setAudienceOpen(true)}
                >
                  <Users className="h-4 w-4" aria-hidden="true" />
                  Аудитория · {courseAudience.effectiveLearners.length}
                </Button>
                <Button
                  ref={settingsTriggerRef}
                  variant="secondary"
                  onClick={() => setSettingsOpen(true)}
                >
                  <Settings className="h-4 w-4" aria-hidden="true" />
                  Настройки
                </Button>
                <CourseActions course={course} onChanged={reload} />
              </>
            }
          />

          <WorkspaceTabs
            idBase={COURSE_WORKSPACE_TABS_ID}
            ariaLabel="Разделы курса"
            value={navigation.courseSurface}
            items={courseTabs}
            onChange={(courseSurface: CourseWorkspaceSurface) =>
              setNavigation((current) => ({ ...current, courseSurface }))
            }
          />
        </>
      )}

      {!selectedLesson ? (
        <StatusMessage error={error} busyLabel={busyLabel} />
      ) : null}

      {!selectedLesson
        ? COURSE_WORKSPACE_TABS.map((item) => {
            const active = item.value === navigation.courseSurface;

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
                {active && item.value === "lessons" ? (
                  <CourseLessonsPanel
                    lessons={course.lessons}
                    runs={courseRuns}
                    audience={courseAudience.effectiveLearners}
                    disabled={Boolean(busyLabel)}
                    mutationError={error}
                    onSelect={(lessonId) =>
                      setNavigation((current) =>
                        openCourseWorkspaceLesson(current, lessonId),
                      )
                    }
                    runMutation={runMutation}
                    courseId={course.id}
                    focusLessonId={returnFocusLessonId}
                    onFocusRestored={() => setReturnFocusLessonId(null)}
                  />
                ) : null}
                {active && item.value === "about" ? (
                  <CourseAboutPanel course={course} />
                ) : null}
                {active && item.value === "history" ? (
                  <CourseHistoryPanel runs={courseRuns} />
                ) : null}
              </div>
            );
          })
        : null}

      {settingsOpen ? (
        <CourseSettingsDialog
          course={course}
          disabled={Boolean(busyLabel)}
          runMutation={runMutation}
          onClose={closeSettings}
        />
      ) : null}

      {audienceOpen ? (
        <CourseAudienceDialog
          courseId={course.id}
          courseTitle={course.title}
          audience={courseAudience}
          disabled={Boolean(busyLabel)}
          mutationError={error}
          runMutation={runMutation}
          onClose={closeAudience}
        />
      ) : null}

      {assistantOpen ? (
        <AiCourseAssistantDialog
          courseId={course.id}
          courseTitle={course.title}
          lessonId={null}
          onClose={() => setAssistantOpen(false)}
        />
      ) : null}
    </div>
  );
}
