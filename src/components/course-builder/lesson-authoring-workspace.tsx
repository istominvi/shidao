"use client";

import Link from "next/link";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Check,
  ClipboardCheck,
  Eye,
  EyeOff,
  Gamepad2,
  Image as ImageIcon,
  Layers3,
  Link2,
  MonitorPlay,
  Paperclip,
  Pencil,
  Plus,
  Save,
  Search,
  Trash2,
  Type,
  WandSparkles,
} from "lucide-react";
import { AppPageHeader } from "@/components/app/page-header";
import { AiLessonPlanDialog } from "@/components/course-builder/ai-lesson-plan-dialog";
import { CourseMaterialsPanel } from "@/components/course-builder/course-materials-panel";
import {
  LESSON_WORKSPACE_TABS,
  formatLessonWorkspaceTitle,
  type LessonAuthoringSurface,
} from "@/components/course-builder/course-workspace-navigation";
import { ComponentPayloadEditor } from "@/components/course-builder/component-payload-editor";
import {
  CourseComponentRenderer,
  type SignedCourseComponentAssetMap,
} from "@/components/course-builder/component-renderers";
import { courseBuilderRequest } from "@/components/course-builder/course-builder-client";
import { getStudentSlidePlacementOptions } from "@/components/course-builder/student-slide-placement";
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
import { toCourseStudentPreviewRoute } from "@/lib/auth";
import type {
  CourseAsset,
  CourseLesson,
  CourseWorkspace,
  LessonComponent,
} from "@/modules/course-builder/domain";
import type { LearnerProfile, LessonRun } from "@/modules/lesson-runs/domain";
import {
  componentDefinitions,
  getComponentDefinition,
  type ComponentTypeKey,
} from "@/modules/course-builder/registry/contracts";

export type CourseBuilderMutationRunner = (
  label: string,
  action: () => Promise<unknown>,
) => Promise<boolean>;

const LESSON_WORKSPACE_TABS_ID = "lesson-workspace";

type LessonAuthoringWorkspaceProps = {
  course: CourseWorkspace;
  lesson: CourseLesson;
  surface: LessonAuthoringSurface;
  onSurfaceChange: (surface: LessonAuthoringSurface) => void;
  onBackToCourse: () => void;
  status?: React.ReactNode;
  disabled: boolean;
  mutationError: string | null;
  runMutation: CourseBuilderMutationRunner;
  runs: LessonRun[];
  learners: LearnerProfile[];
};

type ComponentPickerCategory =
  "text" | "media" | "interactive" | "link" | "file";

const CATEGORY_ITEMS = [
  {
    value: "text",
    label: "Текст",
    icon: Type,
  },
  {
    value: "media",
    label: "Медиа",
    icon: ImageIcon,
  },
  {
    value: "interactive",
    label: "Игры и активности",
    icon: Gamepad2,
  },
  {
    value: "link",
    label: "Ссылки",
    icon: Link2,
  },
  {
    value: "file",
    label: "Файлы",
    icon: Paperclip,
  },
] as const satisfies ReadonlyArray<{
  value: ComponentPickerCategory;
  label: string;
  icon: typeof Type;
}>;

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

function assetMapFor(assets: CourseAsset[]) {
  return Object.fromEntries(
    assets.map((asset) => [
      asset.id,
      {
        id: asset.id,
        originalFilename: asset.originalFilename,
        mimeType: asset.mimeType,
        signedUrl: asset.signedUrl,
      },
    ]),
  ) as SignedCourseComponentAssetMap;
}

function ComponentCard({
  component,
  displayPosition,
  indexInLesson,
  componentCount,
  lessonComponents,
  studentSlides,
  assets,
  assetMap,
  initiallyEditing,
  disabled,
  runMutation,
  onInitialEditorConsumed,
}: {
  component: LessonComponent;
  displayPosition: number;
  indexInLesson: number;
  componentCount: number;
  lessonComponents: LessonComponent[];
  studentSlides: CourseLesson["studentSlides"];
  assets: CourseAsset[];
  assetMap: SignedCourseComponentAssetMap;
  initiallyEditing: boolean;
  disabled: boolean;
  runMutation: CourseBuilderMutationRunner;
  onInitialEditorConsumed: () => void;
}) {
  const [editing, setEditing] = useState(initiallyEditing);
  const [studentScreenPopoverOpen, setStudentScreenPopoverOpen] =
    useState(false);
  const initialEditorConsumedRef = useRef(false);
  const studentScreenTriggerRef = useRef<HTMLButtonElement>(null);
  const studentScreenPopoverRef = useRef<HTMLDivElement>(null);
  const studentScreenPopoverId = useId();
  const definition = getComponentDefinition(component.typeKey);
  const learnerVisible = component.studentSlideId !== null;
  const currentStudentSlidePosition = studentSlides.find(
    (slide) => slide.id === component.studentSlideId,
  )?.position;
  const placementOptions = useMemo(
    () =>
      getStudentSlidePlacementOptions(
        lessonComponents,
        component.id,
        studentSlides,
      ),
    [component.id, lessonComponents, studentSlides],
  );
  const hoverActionClass =
    "component-card-action transition-opacity md:!opacity-0 md:group-hover:!opacity-100 md:group-focus-within:!opacity-100";

  useEffect(() => {
    if (!initiallyEditing || initialEditorConsumedRef.current) return;
    initialEditorConsumedRef.current = true;
    onInitialEditorConsumed();
  }, [initiallyEditing, onInitialEditorConsumed]);

  useEffect(() => {
    if (!studentScreenPopoverOpen) return;

    window.requestAnimationFrame(() =>
      studentScreenPopoverRef.current
        ?.querySelector<HTMLButtonElement>("button:not([disabled])")
        ?.focus(),
    );

    function handlePointerDown(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        !studentScreenPopoverRef.current?.contains(event.target) &&
        !studentScreenTriggerRef.current?.contains(event.target)
      ) {
        setStudentScreenPopoverOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setStudentScreenPopoverOpen(false);
      studentScreenTriggerRef.current?.focus();
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [studentScreenPopoverOpen]);

  async function updateStudentScreen(
    input:
      | { mode: "hide" }
      | { mode: "existing"; slideId: string }
      | { mode: "new" },
  ) {
    const saved = await runMutation("Обновляем экран ученика…", () =>
      jsonRequest(
        `/api/v2/components/${component.id}/student-screen`,
        "POST",
        input,
      ),
    );
    if (!saved) return;
    setStudentScreenPopoverOpen(false);
    window.requestAnimationFrame(() =>
      studentScreenTriggerRef.current?.focus(),
    );
  }

  return (
    <article className="lesson-component-card group">
      <div className="absolute right-3 top-3 z-10 flex max-w-[calc(100%-1.5rem)] flex-wrap justify-end gap-1">
        <Button
          variant="ghost"
          className={hoverActionClass}
          disabled={disabled || indexInLesson === 0}
          aria-label={`Переместить «${definition.title}» выше`}
          title="Переместить выше"
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
        </Button>
        <Button
          variant="ghost"
          className={hoverActionClass}
          disabled={disabled || indexInLesson === componentCount - 1}
          aria-label={`Переместить «${definition.title}» ниже`}
          title="Переместить ниже"
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
        </Button>
        <Button
          variant="ghost"
          className={hoverActionClass}
          disabled={disabled}
          aria-label={`${editing ? "Закрыть редактор" : "Редактировать"} «${definition.title}»`}
          title={editing ? "Закрыть редактор" : "Редактировать"}
          onClick={() => setEditing((value) => !value)}
        >
          <Pencil className="h-4 w-4" aria-hidden="true" />
        </Button>
        <Button
          variant="ghost"
          className={`${hoverActionClass} component-card-action-danger`}
          disabled={disabled}
          aria-label={`Удалить «${definition.title}»`}
          title="Удалить"
          onClick={() => {
            if (!window.confirm(`Удалить компонент «${definition.title}»?`))
              return;
            void runMutation("Удаляем компонент…", () =>
              jsonRequest(`/api/v2/components/${component.id}`, "DELETE"),
            );
          }}
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
        </Button>
        <div className="relative">
          <Button
            ref={studentScreenTriggerRef}
            variant="ghost"
            className={`component-card-visibility-action transition ${
              learnerVisible
                ? "component-card-visibility-action-active border-sky-200 bg-sky-100 text-sky-800 hover:bg-sky-200"
                : "component-card-visibility-action-inactive text-neutral-500 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100"
            }`}
            disabled={disabled}
            aria-haspopup="dialog"
            aria-expanded={studentScreenPopoverOpen}
            aria-controls={
              studentScreenPopoverOpen ? studentScreenPopoverId : undefined
            }
            aria-label={
              learnerVisible
                ? currentStudentSlidePosition === undefined
                  ? `«${definition.title}» показывается ученику. Настроить`
                  : `«${definition.title}» показывается на слайде ${currentStudentSlidePosition}. Настроить`
                : `«${definition.title}» не показывается ученику. Настроить`
            }
            title="Настроить экран ученика"
            onClick={() => setStudentScreenPopoverOpen((isOpen) => !isOpen)}
          >
            {learnerVisible ? (
              <Eye className="h-4 w-4" aria-hidden="true" />
            ) : (
              <EyeOff className="h-4 w-4" aria-hidden="true" />
            )}
          </Button>

          {studentScreenPopoverOpen ? (
            <div
              ref={studentScreenPopoverRef}
              id={studentScreenPopoverId}
              role="dialog"
              aria-label={`Слайд для компонента «${definition.title}»`}
              className="absolute right-0 top-11 z-30 w-72 rounded-2xl border border-neutral-200 bg-white p-2 text-left shadow-xl"
            >
              <p className="px-2 pb-2 pt-1 text-xs font-bold uppercase tracking-[0.12em] text-neutral-500">
                Экран ученика
              </p>
              <div className="grid gap-1">
                {placementOptions.existingSlides.map((slide) => {
                  const selected = component.studentSlideId === slide.id;
                  return (
                    <button
                      key={slide.id}
                      type="button"
                      disabled={disabled || selected}
                      aria-pressed={selected}
                      className="flex min-h-10 items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm font-semibold text-neutral-800 transition hover:bg-neutral-100 disabled:cursor-default disabled:bg-sky-50 disabled:text-sky-800"
                      onClick={() =>
                        void updateStudentScreen({
                          mode: "existing",
                          slideId: slide.id,
                        })
                      }
                    >
                      <span>Слайд {slide.position}</span>
                      {selected ? (
                        <Check className="h-4 w-4" aria-hidden="true" />
                      ) : null}
                    </button>
                  );
                })}
                {placementOptions.canCreateNew ? (
                  <button
                    type="button"
                    disabled={disabled}
                    className="flex min-h-10 items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-neutral-800 transition hover:bg-neutral-100"
                    onClick={() => void updateStudentScreen({ mode: "new" })}
                  >
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    Новый слайд
                  </button>
                ) : null}
                {learnerVisible ? (
                  <button
                    type="button"
                    disabled={disabled}
                    className="flex min-h-10 items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-50"
                    onClick={() => void updateStudentScreen({ mode: "hide" })}
                  >
                    <EyeOff className="h-4 w-4" aria-hidden="true" />
                    Убрать с экрана
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="mb-3 md:pr-48">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-neutral-500">
          {displayPosition}. {definition.title}
        </p>
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

function ComponentPickerDialog({
  lessonId,
  disabled,
  runMutation,
  onClose,
  onCreated,
}: {
  lessonId: string;
  disabled: boolean;
  runMutation: CourseBuilderMutationRunner;
  onClose: () => void;
  onCreated: (componentId: string) => void;
}) {
  const [category, setCategory] = useState<ComponentPickerCategory>("text");
  const definitions = componentDefinitions.filter((definition) =>
    category === "link"
      ? definition.key === "external_link"
      : category === "file"
        ? definition.key === "file"
        : definition.category === category,
  );

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape" || disabled) return;
      event.preventDefault();
      onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [disabled, onClose]);

  async function add(typeKey: ComponentTypeKey) {
    const definition = getComponentDefinition(typeKey);
    let createdComponentId: string | null = null;
    const saved = await runMutation(
      `Добавляем «${definition.title}»…`,
      async () => {
        const response = await jsonRequest<{ component: LessonComponent }>(
          `/api/v2/lessons/${lessonId}/components`,
          "POST",
          {
            typeKey,
            payload: structuredClone(definition.defaultPayload),
            placement: structuredClone(definition.defaultPlacement),
          },
        );
        createdComponentId = response.component.id;
      },
    );
    if (saved && createdComponentId) onCreated(createdComponentId);
  }

  return (
    <DialogShell
      title="Компоненты"
      onClose={onClose}
      className="component-picker-dialog"
      panelClassName="component-picker-dialog-panel max-w-4xl"
      bodyClassName="component-picker-dialog-body"
    >
      <div
        className="component-picker-categories"
        role="group"
        aria-label="Категории компонентов"
      >
        {CATEGORY_ITEMS.map((item) => {
          const Icon = item.icon;
          const selected = item.value === category;
          return (
            <button
              key={item.value}
              type="button"
              aria-pressed={selected}
              data-dialog-initial-focus={selected ? "true" : undefined}
              className={`component-picker-category ${
                selected ? "is-active" : ""
              }`}
              onClick={() => setCategory(item.value)}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {item.label}
            </button>
          );
        })}
      </div>

      <div key={category} className="component-picker-dialog-list">
        {definitions.map((definition) => (
          <button
            key={definition.key}
            type="button"
            data-component-type-key={definition.key}
            disabled={disabled}
            className="component-picker-card"
            onClick={() => void add(definition.key)}
          >
            <span className="flex items-center justify-between gap-3">
              <span className="font-bold text-neutral-950">
                {definition.title}
              </span>
              <Plus className="h-4 w-4 text-neutral-500" aria-hidden="true" />
            </span>
            <span className="mt-2 block text-xs leading-5 text-neutral-500">
              Добавить в план и сразу перейти к редактированию
            </span>
          </button>
        ))}
      </div>
    </DialogShell>
  );
}

function LessonEditorDialog({
  lesson,
  disabled,
  runMutation,
  onClose,
}: {
  lesson: CourseLesson;
  disabled: boolean;
  runMutation: CourseBuilderMutationRunner;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(lesson.title);
  const [summary, setSummary] = useState(lesson.summary);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape" || disabled) return;
      event.preventDefault();
      onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [disabled, onClose]);

  return (
    <DialogShell
      title="Редактировать урок"
      description="Название показывается ученику автоматически. Комментарий остаётся только у преподавателя."
      onClose={() => {
        if (!disabled) onClose();
      }}
      panelClassName="max-w-2xl"
    >
      <form
        className="grid gap-5"
        onSubmit={(event) => {
          event.preventDefault();
          const nextTitle = title.trim();
          if (!nextTitle || disabled) return;
          void (async () => {
            const saved = await runMutation("Сохраняем урок…", () =>
              jsonRequest(`/api/v2/lessons/${lesson.id}`, "PATCH", {
                title: nextTitle,
                summary,
              }),
            );
            if (saved) onClose();
          })();
        }}
      >
        <label className="block">
          <span className="field-label">Название урока</span>
          <input
            autoFocus
            required
            maxLength={180}
            className="field-input"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>
        <label className="block">
          <span className="field-label">Комментарий преподавателя</span>
          <textarea
            maxLength={1200}
            className="field-input min-h-28 resize-y"
            placeholder="Необязательно. Ученик этот комментарий не увидит."
            value={summary}
            onChange={(event) => setSummary(event.target.value)}
          />
        </label>
        <div className="dialog-shell-actions">
          <Button
            type="button"
            variant="ghost"
            disabled={disabled}
            onClick={onClose}
          >
            Отмена
          </Button>
          <Button type="submit" disabled={disabled || !title.trim()}>
            <Save className="h-4 w-4" aria-hidden="true" />
            Сохранить
          </Button>
        </div>
      </form>
    </DialogShell>
  );
}

function LessonPlan({
  course,
  lesson,
  query,
  editingComponentId,
  disabled,
  runMutation,
  onEditingComponentConsumed,
}: {
  course: CourseWorkspace;
  lesson: CourseLesson;
  query: string;
  editingComponentId: string | null;
  disabled: boolean;
  runMutation: CourseBuilderMutationRunner;
  onEditingComponentConsumed: () => void;
}) {
  const assetMap = useMemo(
    () => assetMapFor(course.attachments),
    [course.attachments],
  );
  const components = lesson.components;
  const normalizedQuery = query.trim().toLocaleLowerCase("ru-RU");
  const visibleComponents = components
    .map((component, index) => ({ component, index }))
    .filter(({ component }) => {
      if (!normalizedQuery) return true;
      return getComponentDefinition(component.typeKey)
        .title.toLocaleLowerCase("ru-RU")
        .includes(normalizedQuery);
    });

  return (
    <section className="grid gap-4" aria-label="Компоненты плана урока">
      {visibleComponents.map(({ component, index }) => (
        <ComponentCard
          key={component.id}
          component={component}
          displayPosition={index + 1}
          indexInLesson={index}
          componentCount={components.length}
          lessonComponents={components}
          studentSlides={lesson.studentSlides}
          assets={course.attachments}
          assetMap={assetMap}
          initiallyEditing={component.id === editingComponentId}
          disabled={disabled}
          runMutation={runMutation}
          onInitialEditorConsumed={onEditingComponentConsumed}
        />
      ))}
      {components.length === 0 ? (
        <div className="rounded-[1.25rem] border border-dashed border-neutral-300 bg-white/70 px-6 py-14 text-center">
          <Layers3
            className="mx-auto h-7 w-7 text-neutral-400"
            aria-hidden="true"
          />
          <h3 className="mt-3 font-black text-neutral-950">
            План урока пока пуст
          </h3>
          <p className="mt-2 text-sm leading-6 text-neutral-600">
            Нажмите «Компонент» выше и выберите первый элемент плана.
          </p>
        </div>
      ) : null}
      {components.length > 0 && visibleComponents.length === 0 ? (
        <div className="lesson-plan-filter-empty" role="status">
          <Search className="h-7 w-7" aria-hidden="true" />
          <h3>Компоненты не найдены</h3>
          <p>Измените запрос, чтобы снова увидеть элементы плана.</p>
        </div>
      ) : null}
    </section>
  );
}

function StudentLessonSurface({
  course,
  lesson,
}: {
  course: CourseWorkspace;
  lesson: CourseLesson;
}) {
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const assetMap = useMemo(
    () => assetMapFor(course.attachments),
    [course.attachments],
  );
  const slides = useMemo(
    () =>
      [...lesson.studentSlides]
        .sort((left, right) => left.position - right.position)
        .map((slide) => ({
          ...slide,
          components: lesson.components.filter(
            (component) => component.studentSlideId === slide.id,
          ),
        })),
    [lesson.components, lesson.studentSlides],
  );
  const safeActiveSlideIndex = Math.min(
    activeSlideIndex,
    Math.max(slides.length - 1, 0),
  );
  const activeSlide = slides[safeActiveSlideIndex];

  useEffect(() => {
    setActiveSlideIndex(0);
  }, [lesson.id]);

  return (
    <section className="overflow-hidden rounded-[1.25rem] border border-sky-100 bg-[radial-gradient(circle_at_top_left,#e0f2fe_0%,#f5f3ff_42%,#ffffff_80%)] shadow-sm">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-white/80 bg-white/70 p-5 backdrop-blur md:p-7">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-sky-700">
            Экран ученика · Урок {lesson.position}
          </p>
          <h2 className="mt-2 text-2xl font-black text-neutral-950 md:text-3xl">
            {lesson.title}
          </h2>
        </div>
        <Link
          href={`${toCourseStudentPreviewRoute(course.id)}?lesson=${encodeURIComponent(lesson.id)}`}
          className={productButtonClassName("secondary")}
        >
          <MonitorPlay className="h-4 w-4" aria-hidden="true" />
          Открыть на весь экран
        </Link>
      </header>

      <div className="flex min-h-[28rem] flex-col p-5 md:p-8">
        {activeSlide ? (
          <div className="grid flex-1 content-start gap-6">
            {activeSlide.components.map((component) => (
              <CourseComponentRenderer
                key={component.id}
                component={component}
                assets={assetMap}
                mode="student"
              />
            ))}
          </div>
        ) : (
          <div className="grid place-items-center rounded-[1.25rem] border border-dashed border-neutral-300 bg-white/70 px-6 py-12 text-center">
            <div>
              <EyeOff
                className="mx-auto h-7 w-7 text-neutral-400"
                aria-hidden="true"
              />
              <h3 className="mt-3 font-black text-neutral-950">
                Экран ученика пока пуст
              </h3>
              <p className="mt-2 max-w-xl text-sm leading-6 text-neutral-600">
                В плане урока нажмите значок глаза у нужного компонента и
                добавьте его на первый слайд.
              </p>
            </div>
          </div>
        )}

        {activeSlide ? (
          <nav
            className="mt-7 flex flex-wrap items-center justify-between gap-3 border-t border-white/90 pt-5"
            aria-label="Навигация по слайдам в предпросмотре"
          >
            <Button
              variant="secondary"
              disabled={safeActiveSlideIndex === 0}
              onClick={() =>
                setActiveSlideIndex(Math.max(0, safeActiveSlideIndex - 1))
              }
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Предыдущий слайд
            </Button>
            <p
              className="text-sm font-bold text-neutral-600"
              aria-live="polite"
            >
              Слайд {safeActiveSlideIndex + 1} из {slides.length}
            </p>
            <Button
              variant="secondary"
              disabled={safeActiveSlideIndex === slides.length - 1}
              onClick={() =>
                setActiveSlideIndex(
                  Math.min(slides.length - 1, safeActiveSlideIndex + 1),
                )
              }
            >
              Следующий слайд
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Button>
          </nav>
        ) : null}
      </div>
    </section>
  );
}

function HomeworkSurface({ lesson }: { lesson: CourseLesson }) {
  return (
    <section className="rounded-[1.25rem] border border-neutral-200 bg-white/90 px-6 py-14 text-center shadow-sm">
      <ClipboardCheck
        className="mx-auto h-8 w-8 text-violet-500"
        aria-hidden="true"
      />
      <p className="mt-4 text-xs font-bold uppercase tracking-[0.14em] text-violet-700">
        Урок {lesson.position}
      </p>
      <h2 className="mt-2 text-2xl font-black text-neutral-950">
        Домашнее задание
      </h2>
      <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-neutral-600">
        Раздел закреплён за выбранным уроком. Редактор домашнего задания будет
        подключён отдельным срезом; сейчас здесь нет фиктивных данных и ничего
        не сохраняется в обход базы.
      </p>
    </section>
  );
}

function LessonHistorySurface({
  lesson,
  runs,
}: {
  lesson: CourseLesson;
  runs: LessonRun[];
}) {
  return (
    <RunHistoryList
      runs={runs.filter((run) => Boolean(run.endedAt))}
      emptyTitle={`Урок ${lesson.position} ещё не проводился`}
      emptyDescription="Назначьте дату урока. После завершения здесь сохранятся отчёт преподавателя, посещаемость и индивидуальные результаты."
    />
  );
}

export function LessonAuthoringWorkspace({
  course,
  lesson,
  surface,
  onSurfaceChange,
  onBackToCourse,
  status,
  disabled,
  mutationError,
  runMutation,
  runs,
  learners,
}: LessonAuthoringWorkspaceProps) {
  const teachingEnabled = course.learningAudience === "children";
  const [pickerOpen, setPickerOpen] = useState(false);
  const [aiPlannerOpen, setAiPlannerOpen] = useState(false);
  const [lessonEditorOpen, setLessonEditorOpen] = useState(false);
  const [lessonRunDialogOpen, setLessonRunDialogOpen] = useState(false);
  const [componentQuery, setComponentQuery] = useState("");
  const [editingComponentId, setEditingComponentId] = useState<string | null>(
    null,
  );
  const pickerTriggerRef = useRef<HTMLButtonElement>(null);
  const lessonSettingsTriggerRef = useRef<HTMLButtonElement>(null);
  const lessonHeadingRef = useRef<HTMLHeadingElement>(null);
  const availableLessonTabs = LESSON_WORKSPACE_TABS.filter(
    (item) => teachingEnabled || item.value !== "history",
  );
  const lessonTabs = availableLessonTabs.map((item) => ({
    ...item,
    ...(item.value === "history"
      ? { count: completedLessonRunCount(runs) }
      : {}),
  }));

  function closePicker() {
    if (disabled) return;
    setPickerOpen(false);
    window.requestAnimationFrame(() => pickerTriggerRef.current?.focus());
  }

  function closeLessonEditor() {
    if (disabled) return;
    setLessonEditorOpen(false);
    window.requestAnimationFrame(() =>
      lessonSettingsTriggerRef.current?.focus(),
    );
  }

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const heading = lessonHeadingRef.current;
      heading?.closest("header")?.scrollIntoView({ block: "start" });
      heading?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    setComponentQuery("");
  }, [lesson.id]);

  return (
    <div className="min-w-0">
      <AppPageHeader
        headingRef={lessonHeadingRef}
        back={{
          type: "button",
          onClick: onBackToCourse,
          label: course.title,
        }}
        title={formatLessonWorkspaceTitle(lesson.position, lesson.title)}
        description={
          lesson.summary ||
          `Компонентов: ${lesson.components.length} · слайдов экрана ученика: ${lesson.studentSlides.length}`
        }
        actions={
          <>
            {teachingEnabled ? (
              <LessonRunStatusButton
                runs={runs}
                disabled={disabled}
                onClick={() => setLessonRunDialogOpen(true)}
              />
            ) : null}
            <Button
              variant="secondary"
              disabled={disabled}
              onClick={() => setAiPlannerOpen(true)}
            >
              <WandSparkles className="h-4 w-4" aria-hidden="true" />
              Дополнить с ИИ
            </Button>
            <Button
              ref={lessonSettingsTriggerRef}
              variant="secondary"
              disabled={disabled}
              onClick={() => setLessonEditorOpen(true)}
            >
              <Pencil className="h-4 w-4" aria-hidden="true" />
              Настройки урока
            </Button>
            <Button
              variant="ghost"
              className="product-btn-danger"
              disabled={disabled}
              onClick={() => {
                if (
                  !window.confirm(
                    teachingEnabled
                      ? `Удалить урок «${lesson.title}»? План, назначение и история проведений будут удалены. Завершённые индивидуальные результаты сохранятся в учебных профилях.`
                      : `Удалить урок «${lesson.title}» вместе с его компонентами?`,
                  )
                ) {
                  return;
                }
                void (async () => {
                  const deleted = await runMutation("Удаляем урок…", () =>
                    jsonRequest(`/api/v2/lessons/${lesson.id}`, "DELETE"),
                  );
                  if (deleted) onBackToCourse();
                })();
              }}
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              Удалить
            </Button>
          </>
        }
      />

      <WorkspaceTabs
        idBase={LESSON_WORKSPACE_TABS_ID}
        ariaLabel="Разделы урока"
        value={surface}
        onChange={onSurfaceChange}
        items={lessonTabs}
      />

      {status ? <div className="mt-4">{status}</div> : null}

      {availableLessonTabs.map((item) => {
        const active = item.value === surface;

        return (
          <div
            key={item.value}
            className="mt-4"
            id={workspaceTabPanelId(LESSON_WORKSPACE_TABS_ID, item.value)}
            role="tabpanel"
            aria-labelledby={workspaceTabId(
              LESSON_WORKSPACE_TABS_ID,
              item.value,
            )}
            hidden={!active}
            tabIndex={0}
          >
            {active && item.value === "plan" ? (
              <div className="lesson-plan-workspace">
                <div
                  className="lesson-plan-toolbar"
                  aria-label="Управление компонентами плана"
                >
                  {lesson.components.length > 0 ? (
                    <label className="lesson-plan-toolbar-search product-search-wrap">
                      <span className="sr-only">Поиск компонентов</span>
                      <Search
                        className="product-search-icon h-4 w-4"
                        aria-hidden="true"
                      />
                      <input
                        type="search"
                        className="product-control product-control-search"
                        value={componentQuery}
                        onChange={(event) =>
                          setComponentQuery(event.target.value)
                        }
                        placeholder="Найти компонент"
                        autoComplete="off"
                      />
                    </label>
                  ) : null}
                  <div className="lesson-plan-toolbar-actions">
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={disabled}
                      onClick={() => setAiPlannerOpen(true)}
                    >
                      <WandSparkles className="h-4 w-4" aria-hidden="true" />
                      Заполнить с ИИ
                    </Button>
                    <Button
                      ref={pickerTriggerRef}
                      type="button"
                      disabled={disabled}
                      onClick={() => setPickerOpen(true)}
                    >
                      <Plus className="h-4 w-4" aria-hidden="true" />
                      Компонент
                    </Button>
                  </div>
                </div>
                <LessonPlan
                  course={course}
                  lesson={lesson}
                  query={componentQuery}
                  editingComponentId={editingComponentId}
                  disabled={disabled}
                  runMutation={runMutation}
                  onEditingComponentConsumed={() => setEditingComponentId(null)}
                />
              </div>
            ) : null}
            {active && item.value === "student" ? (
              <StudentLessonSurface course={course} lesson={lesson} />
            ) : null}
            {active && item.value === "homework" ? (
              <HomeworkSurface lesson={lesson} />
            ) : null}
            {active && item.value === "materials" ? (
              <CourseMaterialsPanel course={course} context="lesson" />
            ) : null}
            {active && item.value === "history" ? (
              <LessonHistorySurface lesson={lesson} runs={runs} />
            ) : null}
          </div>
        );
      })}

      {lessonEditorOpen ? (
        <LessonEditorDialog
          key={`${lesson.id}:${lesson.updatedAt}`}
          lesson={lesson}
          disabled={disabled}
          runMutation={runMutation}
          onClose={closeLessonEditor}
        />
      ) : null}

      {teachingEnabled && lessonRunDialogOpen ? (
        <LessonRunDialog
          lesson={lesson}
          runs={runs}
          learners={learners}
          disabled={disabled}
          mutationError={mutationError}
          runMutation={runMutation}
          onClose={() => setLessonRunDialogOpen(false)}
        />
      ) : null}

      {pickerOpen ? (
        <ComponentPickerDialog
          lessonId={lesson.id}
          disabled={disabled}
          runMutation={runMutation}
          onClose={closePicker}
          onCreated={(componentId) => {
            setEditingComponentId(componentId);
            setPickerOpen(false);
          }}
        />
      ) : null}

      {aiPlannerOpen ? (
        <AiLessonPlanDialog
          courseId={course.id}
          lessonId={lesson.id}
          title={lesson.title}
          disabled={disabled}
          runMutation={runMutation}
          onClose={() => setAiPlannerOpen(false)}
          onApplied={() => setAiPlannerOpen(false)}
        />
      ) : null}
    </div>
  );
}
