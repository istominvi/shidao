"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  FileText,
  FolderOpen,
  LoaderCircle,
  Pencil,
  Plus,
  Save,
  Settings,
  WandSparkles,
} from "lucide-react";
import { AppPageHeader } from "@/components/app/page-header";
import {
  courseBuilderRequest,
  loadCourseWorkspace,
} from "@/components/course-builder/course-builder-client";
import {
  LessonAuthoringWorkspace,
  type LessonAuthoringSurface,
} from "@/components/course-builder/lesson-authoring-workspace";
import { Button, productButtonClassName } from "@/components/ui/button";
import { DialogShell } from "@/components/ui/dialog-shell";
import { ROUTES } from "@/lib/auth";
import type {
  CourseLesson,
  CourseWorkspace,
} from "@/modules/course-builder/domain";

type CourseWorkspaceClientProps = {
  courseId: string;
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

function CourseMaterialsDialog({
  course,
  onClose,
}: {
  course: CourseWorkspace;
  onClose: () => void;
}) {
  return (
    <DialogShell
      title="Материалы курса"
      description="Все файлы и изображения, прикреплённые к этому курсу."
      onClose={onClose}
      panelClassName="max-w-3xl"
    >
      <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
        Материалы сохранены в закрытом Storage. Они прикреплены к курсу, но их
        содержимое пока не анализировалось.
      </p>

      {course.attachments.length > 0 ? (
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {course.attachments.map((asset) => (
            <li
              key={asset.id}
              className="flex min-w-0 flex-col rounded-2xl border border-neutral-200 bg-white p-4"
            >
              <div className="flex min-w-0 items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-neutral-100 text-neutral-600">
                  <FileText className="h-4 w-4" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <span className="block truncate font-bold text-neutral-950">
                    {asset.originalFilename}
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-neutral-500">
                    {asset.mimeType} · {Math.ceil(asset.sizeBytes / 1024)} КБ
                  </span>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between gap-3">
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                    asset.status === "ready"
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-amber-100 text-amber-800"
                  }`}
                >
                  {asset.status === "ready" ? "Готово" : "Ожидает загрузки"}
                </span>
                {asset.status === "ready" && asset.signedUrl ? (
                  <a
                    href={asset.signedUrl}
                    target="_blank"
                    rel="noreferrer"
                    className={productButtonClassName(
                      "ghost",
                      "h-9 px-3 text-xs",
                    )}
                  >
                    Открыть
                  </a>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-4 rounded-3xl border border-dashed border-neutral-300 bg-neutral-50 px-6 py-12 text-center">
          <FolderOpen
            className="mx-auto h-7 w-7 text-neutral-400"
            aria-hidden="true"
          />
          <h3 className="mt-3 font-black text-neutral-950">
            Материалов пока нет
          </h3>
          <p className="mt-2 text-sm text-neutral-600">
            Прикреплённые к курсу файлы и изображения появятся здесь.
          </p>
        </div>
      )}
    </DialogShell>
  );
}

function LessonNavigation({
  lessons,
  selectedLessonId,
  disabled,
  onSelect,
  runMutation,
  courseId,
}: {
  lessons: CourseLesson[];
  selectedLessonId: string | null;
  disabled: boolean;
  onSelect: (lessonId: string) => void;
  runMutation: RunMutation;
  courseId: string;
}) {
  const [newLessonTitle, setNewLessonTitle] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submissionFailed, setSubmissionFailed] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

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
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  }

  return (
    <>
      <aside className="rounded-3xl border border-neutral-200 bg-white/90 p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-bold text-neutral-950">Уроки</h2>
          <span className="text-xs font-semibold text-neutral-500">
            {lessons.length}
          </span>
        </div>
        <div className="mt-3 grid gap-2">
          {lessons.map((lesson) => {
            const active = selectedLessonId === lesson.id;
            return (
              <button
                key={lesson.id}
                type="button"
                onClick={() => onSelect(lesson.id)}
                className={`rounded-2xl border px-3 py-3 text-left transition ${
                  active
                    ? "border-neutral-950 bg-neutral-950 text-white"
                    : "border-neutral-200 bg-white text-neutral-800 hover:border-neutral-400"
                }`}
              >
                <span className="block text-xs font-semibold opacity-70">
                  Урок {lesson.position}
                </span>
                <span className="mt-1 block text-sm font-bold">
                  {lesson.title}
                </span>
              </button>
            );
          })}
        </div>
        <div className="mt-4 border-t border-neutral-200 pt-4">
          <button
            ref={triggerRef}
            type="button"
            className={productButtonClassName("primary", "w-full")}
            disabled={disabled}
            onClick={() => {
              setSubmissionFailed(false);
              setDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Добавить урок
          </button>
        </div>
      </aside>

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
                  Автоматическая сборка станет доступна после подключения
                  OpenRouter и выбора модели. Сейчас ИИ не вызывается.
                </p>
                <Button
                  type="button"
                  variant="secondary"
                  className="mt-4 w-full"
                  disabled
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
    </>
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
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
  const [surface, setSurface] = useState<LessonAuthoringSurface>("plan");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [materialsOpen, setMaterialsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyLabel, setBusyLabel] = useState<string | null>(null);
  const settingsTriggerRef = useRef<HTMLButtonElement>(null);
  const materialsTriggerRef = useRef<HTMLButtonElement>(null);
  const mutationInFlightRef = useRef(false);

  const reload = useCallback(async () => {
    const workspace = await loadCourseWorkspace(courseId);
    setCourse(workspace);
    setSelectedLessonId((current) =>
      workspace.lessons.some((lesson) => lesson.id === current)
        ? current
        : (workspace.lessons[0]?.id ?? null),
    );
    return workspace;
  }, [courseId]);

  useEffect(() => {
    let active = true;
    void loadCourseWorkspace(courseId)
      .then((workspace) => {
        if (!active) return;
        setCourse(workspace);
        setSelectedLessonId(workspace.lessons[0]?.id ?? null);
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

  const closeMaterials = useCallback(() => {
    setMaterialsOpen(false);
    window.requestAnimationFrame(() => materialsTriggerRef.current?.focus());
  }, []);

  useEffect(() => {
    if (!settingsOpen && !materialsOpen) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (settingsOpen && !busyLabel) {
        event.preventDefault();
        closeSettings();
      } else if (materialsOpen) {
        event.preventDefault();
        closeMaterials();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [busyLabel, closeMaterials, closeSettings, materialsOpen, settingsOpen]);

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
    course.lessons.find((lesson) => lesson.id === selectedLessonId) ?? null;
  const readyAttachmentCount = course.attachments.filter(
    (asset) => asset.status === "ready",
  ).length;

  return (
    <div className="container app-page-container space-y-6 pb-16">
      <AppPageHeader
        className="course-builder-page-header"
        backHref={ROUTES.courses}
        backLabel="Курсы"
        eyebrow="Редактор курса"
        title={course.title}
        description={`Создано уроков: ${course.lessonCount} из ${course.targetLessonCount} · готовых вложений: ${readyAttachmentCount}`}
        actions={
          <>
            <Button
              ref={materialsTriggerRef}
              variant="secondary"
              onClick={() => setMaterialsOpen(true)}
            >
              <FolderOpen className="h-4 w-4" aria-hidden="true" />
              Материалы курса
              {course.attachments.length > 0 ? (
                <span className="rounded-full bg-neutral-200 px-2 py-0.5 text-[0.7rem] font-black text-neutral-700">
                  {course.attachments.length}
                </span>
              ) : null}
            </Button>
            <Button
              ref={settingsTriggerRef}
              variant="secondary"
              onClick={() => setSettingsOpen(true)}
            >
              <Settings className="h-4 w-4" aria-hidden="true" />
              Настройки
            </Button>
          </>
        }
      />

      <StatusMessage error={error} busyLabel={busyLabel} />

      <div className="grid gap-5 lg:grid-cols-[18rem_minmax(0,1fr)] lg:items-start">
        <LessonNavigation
          lessons={course.lessons}
          selectedLessonId={selectedLessonId}
          disabled={Boolean(busyLabel)}
          onSelect={(lessonId) => setSelectedLessonId(lessonId)}
          runMutation={runMutation}
          courseId={course.id}
        />

        {selectedLesson ? (
          <LessonAuthoringWorkspace
            key={selectedLesson.id}
            course={course}
            lesson={selectedLesson}
            surface={surface}
            onSurfaceChange={setSurface}
            disabled={Boolean(busyLabel)}
            runMutation={runMutation}
          />
        ) : (
          <section className="rounded-3xl border border-dashed border-neutral-300 bg-white/70 px-6 py-16 text-center">
            <h2 className="text-xl font-black text-neutral-950">
              В курсе пока нет уроков
            </h2>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-neutral-600">
              Добавьте первый урок слева. Он сохранится в базе и будет доступен
              после обновления страницы.
            </p>
          </section>
        )}
      </div>

      {settingsOpen ? (
        <CourseSettingsDialog
          course={course}
          disabled={Boolean(busyLabel)}
          runMutation={runMutation}
          onClose={closeSettings}
        />
      ) : null}

      {materialsOpen ? (
        <CourseMaterialsDialog course={course} onClose={closeMaterials} />
      ) : null}
    </div>
  );
}
