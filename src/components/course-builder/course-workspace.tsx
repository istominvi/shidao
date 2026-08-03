"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Eye,
  LoaderCircle,
  Pencil,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import { AppPageHeader } from "@/components/app/page-header";
import { ComponentPayloadEditor } from "@/components/course-builder/component-payload-editor";
import {
  CourseComponentRenderer,
  type SignedCourseComponentAssetMap,
} from "@/components/course-builder/component-renderers";
import {
  courseBuilderRequest,
  loadCourseWorkspace,
} from "@/components/course-builder/course-builder-client";
import { Button, productButtonClassName } from "@/components/ui/button";
import { ROUTES, toCourseStudentPreviewRoute } from "@/lib/auth";
import type {
  CourseAsset,
  CourseLesson,
  CourseWorkspace,
  LessonComponent,
  LessonStep,
} from "@/modules/course-builder/domain";
import {
  componentDefinitions,
  getComponentDefinition,
  type ComponentTypeKey,
} from "@/modules/course-builder/registry/contracts";

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

  return (
    <details className="rounded-3xl border border-neutral-200 bg-white/90 p-5 shadow-sm">
      <summary className="cursor-pointer text-base font-bold text-neutral-950">
        Основные поля Course
      </summary>
      <form
        className="mt-5 grid gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          void runMutation("Сохраняем поля курса…", () =>
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
        }}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Название">
            <input
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
        <div>
          <Button type="submit" disabled={disabled}>
            <Save className="h-4 w-4" aria-hidden="true" />
            Сохранить Course
          </Button>
        </div>
      </form>
    </details>
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

  return (
    <aside className="rounded-3xl border border-neutral-200 bg-white/90 p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-bold text-neutral-950">Lessons</h2>
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
                Lesson {lesson.position}
              </span>
              <span className="mt-1 block text-sm font-bold">
                {lesson.title}
              </span>
            </button>
          );
        })}
      </div>
      <form
        className="mt-4 grid gap-2 border-t border-neutral-200 pt-4"
        onSubmit={(event) => {
          event.preventDefault();
          const title = newLessonTitle.trim();
          if (!title) return;
          void runMutation("Добавляем Lesson…", async () => {
            await jsonRequest(`/api/v2/courses/${courseId}/lessons`, "POST", {
              title,
              summary: "",
            });
            setNewLessonTitle("");
          });
        }}
      >
        <label className="sr-only" htmlFor="new-lesson-title">
          Название нового урока
        </label>
        <input
          id="new-lesson-title"
          className="field-input"
          placeholder="Название нового Lesson"
          value={newLessonTitle}
          onChange={(event) => setNewLessonTitle(event.target.value)}
        />
        <Button type="submit" disabled={disabled || !newLessonTitle.trim()}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Добавить Lesson
        </Button>
      </form>
    </aside>
  );
}

function ComponentCard({
  component,
  index,
  total,
  assets,
  assetMap,
  disabled,
  runMutation,
}: {
  component: LessonComponent;
  index: number;
  total: number;
  assets: CourseAsset[];
  assetMap: SignedCourseComponentAssetMap;
  disabled: boolean;
  runMutation: RunMutation;
}) {
  const [editing, setEditing] = useState(false);
  const definition = getComponentDefinition(component.typeKey);

  return (
    <article className="rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm md:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-neutral-100 pb-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-neutral-500">
            {component.position}. {definition.title}
          </p>
          <p className="mt-1 font-mono text-xs text-neutral-400">
            {component.typeKey} · schema v{component.schemaVersion}
          </p>
        </div>
        <div className="flex flex-wrap gap-1">
          <Button
            variant="ghost"
            className="h-9 px-3 text-xs"
            disabled={disabled || index === 0}
            aria-label={`Переместить компонент «${definition.title}» выше`}
            onClick={() =>
              void runMutation("Меняем порядок компонентов…", () =>
                jsonRequest(
                  `/api/v2/components/${component.id}/reorder`,
                  "POST",
                  { toPosition: component.position - 1 },
                ),
              )
            }
          >
            <ArrowUp className="h-4 w-4" aria-hidden="true" />
            Выше
          </Button>
          <Button
            variant="ghost"
            className="h-9 px-3 text-xs"
            disabled={disabled || index === total - 1}
            aria-label={`Переместить компонент «${definition.title}» ниже`}
            onClick={() =>
              void runMutation("Меняем порядок компонентов…", () =>
                jsonRequest(
                  `/api/v2/components/${component.id}/reorder`,
                  "POST",
                  { toPosition: component.position + 1 },
                ),
              )
            }
          >
            <ArrowDown className="h-4 w-4" aria-hidden="true" />
            Ниже
          </Button>
          <Button
            variant="ghost"
            className="h-9 px-3 text-xs"
            disabled={disabled}
            onClick={() => setEditing((value) => !value)}
          >
            <Pencil className="h-4 w-4" aria-hidden="true" />
            {editing ? "Закрыть" : "Редактировать"}
          </Button>
          <Button
            variant="ghost"
            className="h-9 px-3 text-xs text-rose-700"
            disabled={disabled}
            onClick={() => {
              if (!window.confirm(`Удалить компонент «${definition.title}»?`))
                return;
              void runMutation("Удаляем компонент…", () =>
                jsonRequest(`/api/v2/components/${component.id}`, "DELETE"),
              );
            }}
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            Удалить
          </Button>
        </div>
      </div>

      {editing ? (
        <ComponentPayloadEditor
          key={`${component.id}:${component.updatedAt}`}
          component={component}
          assets={assets}
          disabled={disabled}
          onCancel={() => setEditing(false)}
          onSave={async (input) => {
            const saved = await runMutation("Сохраняем компонент…", () =>
              jsonRequest(`/api/v2/components/${component.id}`, "PATCH", input),
            );
            if (saved) setEditing(false);
          }}
        />
      ) : (
        <CourseComponentRenderer
          component={component}
          assets={assetMap}
          mode="teacher"
        />
      )}
    </article>
  );
}

function ComponentPalette({
  stepId,
  disabled,
  runMutation,
}: {
  stepId: string;
  disabled: boolean;
  runMutation: RunMutation;
}) {
  async function add(typeKey: ComponentTypeKey) {
    const definition = getComponentDefinition(typeKey);
    await runMutation(`Добавляем «${definition.title}»…`, () =>
      jsonRequest(`/api/v2/steps/${stepId}/components`, "POST", {
        typeKey,
        payload: structuredClone(definition.defaultPayload),
        placement: structuredClone(definition.defaultPlacement),
      }),
    );
  }

  return (
    <section className="rounded-3xl border border-dashed border-neutral-300 bg-neutral-50/80 p-4">
      <h4 className="text-sm font-bold text-neutral-900">
        Добавить learner-visible компонент
      </h4>
      <div
        className="mt-3 flex flex-wrap gap-2"
        aria-label="Палитра компонентов"
      >
        {componentDefinitions.map((definition) => (
          <Button
            key={definition.key}
            variant="secondary"
            className="h-auto min-h-10 py-2 text-xs"
            disabled={disabled}
            onClick={() => void add(definition.key)}
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            {definition.title}
          </Button>
        ))}
      </div>
    </section>
  );
}

function StepEditor({
  step,
  assets,
  assetMap,
  disabled,
  runMutation,
}: {
  step: LessonStep;
  assets: CourseAsset[];
  assetMap: SignedCourseComponentAssetMap;
  disabled: boolean;
  runMutation: RunMutation;
}) {
  const [title, setTitle] = useState(step.title);
  const [teacherInstructions, setTeacherInstructions] = useState(
    step.teacherInstructions,
  );
  const [learnerInstruction, setLearnerInstruction] = useState(
    step.learnerInstruction,
  );

  return (
    <section className="rounded-[1.75rem] border border-neutral-200 bg-white/70 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.15em] text-sky-700">
            Шаг {step.position}
          </p>
          <h3 className="mt-1 text-xl font-black text-neutral-950">
            {step.title}
          </h3>
        </div>
        <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-600">
          {step.components.length} компонентов
        </span>
      </div>

      <form
        className="mt-5 grid gap-4 rounded-2xl border border-amber-200 bg-amber-50/70 p-4"
        onSubmit={(event) => {
          event.preventDefault();
          void runMutation("Сохраняем Lesson Step…", () =>
            jsonRequest(`/api/v2/steps/${step.id}`, "PATCH", {
              title,
              teacherInstructions,
              learnerInstruction,
            }),
          );
        }}
      >
        <div className="flex items-center justify-between gap-3">
          <h4 className="font-bold text-amber-950">Teacher Side</h4>
          <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-900">
            Приватно
          </span>
        </div>
        <Field label="Название шага (совпадает на обеих сторонах)">
          <input
            required
            className="field-input"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </Field>
        <Field
          label="Инструкции преподавателю"
          hint="Этот текст никогда не рендерится в Student Screen preview."
        >
          <textarea
            className="field-input min-h-24 resize-y"
            value={teacherInstructions}
            onChange={(event) => setTeacherInstructions(event.target.value)}
          />
        </Field>
        <Field label="Инструкция ученику (необязательно)">
          <textarea
            className="field-input min-h-20 resize-y"
            value={learnerInstruction}
            onChange={(event) => setLearnerInstruction(event.target.value)}
          />
        </Field>
        <div>
          <Button type="submit" disabled={disabled}>
            <Save className="h-4 w-4" aria-hidden="true" />
            Сохранить шаг
          </Button>
        </div>
      </form>

      <div className="mt-5 grid gap-4">
        {step.components.map((component, index) => (
          <ComponentCard
            key={component.id}
            component={component}
            index={index}
            total={step.components.length}
            assets={assets}
            assetMap={assetMap}
            disabled={disabled}
            runMutation={runMutation}
          />
        ))}
        {step.components.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-neutral-300 bg-white px-4 py-8 text-center text-sm text-neutral-600">
            В Student Screen этого шага пока нет компонентов.
          </p>
        ) : null}
        <ComponentPalette
          stepId={step.id}
          disabled={disabled}
          runMutation={runMutation}
        />
      </div>
    </section>
  );
}

function LessonEditor({
  lesson,
  course,
  disabled,
  runMutation,
}: {
  lesson: CourseLesson;
  course: CourseWorkspace;
  disabled: boolean;
  runMutation: RunMutation;
}) {
  const [title, setTitle] = useState(lesson.title);
  const [summary, setSummary] = useState(lesson.summary);
  const [newStepTitle, setNewStepTitle] = useState("");
  const assetMap = useMemo<SignedCourseComponentAssetMap>(
    () =>
      Object.fromEntries(
        course.attachments.map((asset) => [
          asset.id,
          {
            id: asset.id,
            originalFilename: asset.originalFilename,
            mimeType: asset.mimeType,
            signedUrl: asset.signedUrl,
          },
        ]),
      ),
    [course.attachments],
  );

  return (
    <div className="grid gap-5">
      <section className="rounded-3xl border border-neutral-200 bg-white/90 p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-violet-700">
              Lesson {lesson.position}
            </p>
            <h2 className="mt-1 text-2xl font-black text-neutral-950">
              {lesson.title}
            </h2>
          </div>
          <Button
            variant="ghost"
            className="text-rose-700"
            disabled={disabled}
            onClick={() => {
              if (
                !window.confirm(
                  `Удалить Lesson «${lesson.title}» со всеми шагами?`,
                )
              )
                return;
              void runMutation("Удаляем Lesson…", () =>
                jsonRequest(`/api/v2/lessons/${lesson.id}`, "DELETE"),
              );
            }}
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            Удалить Lesson
          </Button>
        </div>
        <form
          className="mt-5 grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end"
          onSubmit={(event) => {
            event.preventDefault();
            void runMutation("Сохраняем Lesson…", () =>
              jsonRequest(`/api/v2/lessons/${lesson.id}`, "PATCH", {
                title,
                summary,
              }),
            );
          }}
        >
          <Field label="Название Lesson">
            <input
              required
              className="field-input"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </Field>
          <Field label="Краткое описание">
            <input
              className="field-input"
              value={summary}
              onChange={(event) => setSummary(event.target.value)}
            />
          </Field>
          <Button type="submit" disabled={disabled}>
            <Save className="h-4 w-4" aria-hidden="true" />
            Сохранить
          </Button>
        </form>
      </section>

      <section className="grid gap-5">
        {lesson.steps.map((step) => (
          <StepEditor
            key={`${step.id}:${step.updatedAt}`}
            step={step}
            assets={course.attachments}
            assetMap={assetMap}
            disabled={disabled}
            runMutation={runMutation}
          />
        ))}
      </section>

      <form
        className="rounded-3xl border border-dashed border-neutral-300 bg-white/70 p-5"
        onSubmit={(event) => {
          event.preventDefault();
          const stepTitle = newStepTitle.trim();
          if (!stepTitle) return;
          void runMutation("Добавляем Lesson Step…", async () => {
            await jsonRequest(`/api/v2/lessons/${lesson.id}/steps`, "POST", {
              title: stepTitle,
              teacherInstructions: "",
              learnerInstruction: "",
            });
            setNewStepTitle("");
          });
        }}
      >
        <h3 className="font-bold text-neutral-950">Новый Lesson Step</h3>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <label className="sr-only" htmlFor="new-step-title">
            Название нового шага
          </label>
          <input
            id="new-step-title"
            className="field-input"
            placeholder="Название шага"
            value={newStepTitle}
            onChange={(event) => setNewStepTitle(event.target.value)}
          />
          <Button
            type="submit"
            className="shrink-0"
            disabled={disabled || !newStepTitle.trim()}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Добавить шаг
          </Button>
        </div>
      </form>
    </div>
  );
}

function WorkspaceSkeleton() {
  return (
    <div className="container app-page-container py-12" role="status">
      <div className="flex items-center gap-3 rounded-3xl border border-neutral-200 bg-white/80 p-6 text-neutral-700 shadow-sm">
        <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden="true" />
        Загружаем Course, Lessons и Lesson Steps из базы…
      </div>
    </div>
  );
}

export function CourseWorkspaceClient({
  courseId,
}: CourseWorkspaceClientProps) {
  const [course, setCourse] = useState<CourseWorkspace | null>(null);
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyLabel, setBusyLabel] = useState<string | null>(null);

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
        setBusyLabel(null);
      }
    },
    [reload],
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
        backHref={ROUTES.courses}
        backLabel="Курсы"
        eyebrow="Course workspace"
        title={course.title}
        description={`${course.lessonCount} из ${course.targetLessonCount} Lessons создано · ${readyAttachmentCount} готовых вложений`}
        actions={
          <Link
            href={toCourseStudentPreviewRoute(course.id)}
            className={productButtonClassName("primary")}
          >
            <Eye className="h-4 w-4" aria-hidden="true" />
            Student Screen preview
          </Link>
        }
      />

      <StatusMessage error={error} busyLabel={busyLabel} />

      <CourseBasicsForm
        key={course.updatedAt}
        course={course}
        disabled={Boolean(busyLabel)}
        runMutation={runMutation}
      />

      {course.attachments.length > 0 ? (
        <section className="rounded-3xl border border-neutral-200 bg-white/80 p-5">
          <h2 className="font-bold text-neutral-950">Вложения Course</h2>
          <p className="mt-1 text-sm text-neutral-600">
            Вложения сохранены в private Storage. Они прикреплены, но их
            содержимое не анализировалось.
          </p>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {course.attachments.map((asset) => (
              <li
                key={asset.id}
                className="rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm"
              >
                <span className="block truncate font-semibold">
                  {asset.originalFilename}
                </span>
                <span className="mt-1 block text-xs text-neutral-500">
                  {asset.mimeType} · {Math.ceil(asset.sizeBytes / 1024)} КБ ·{" "}
                  {asset.status}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[18rem_minmax(0,1fr)] lg:items-start">
        <LessonNavigation
          lessons={course.lessons}
          selectedLessonId={selectedLessonId}
          disabled={Boolean(busyLabel)}
          onSelect={setSelectedLessonId}
          runMutation={runMutation}
          courseId={course.id}
        />

        {selectedLesson ? (
          <LessonEditor
            key={selectedLesson.id}
            lesson={selectedLesson}
            course={course}
            disabled={Boolean(busyLabel)}
            runMutation={runMutation}
          />
        ) : (
          <section className="rounded-3xl border border-dashed border-neutral-300 bg-white/70 px-6 py-16 text-center">
            <h2 className="text-xl font-black text-neutral-950">
              В Course пока нет Lessons
            </h2>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-neutral-600">
              Добавьте первый Lesson слева. Lesson хранится как запись в базе, а
              не как отдельная hardcoded React-страница.
            </p>
          </section>
        )}
      </div>
    </div>
  );
}
