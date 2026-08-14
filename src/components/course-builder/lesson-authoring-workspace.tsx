"use client";

import Link from "next/link";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ClipboardCheck,
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
import { AppPageHeaderActions } from "@/components/app/page-header-actions";
import { AiLessonPlanDialog } from "@/components/course-builder/ai-lesson-plan-dialog";
import { CourseMaterialsPanel } from "@/components/course-builder/course-materials-panel";
import {
  LESSON_WORKSPACE_TABS,
  formatLessonWorkspaceTitle,
  type LessonAuthoringSurface,
} from "@/components/course-builder/course-workspace-navigation";
import { ComponentPayloadEditor } from "@/components/course-builder/component-payload-editor";
import {
  ComponentPickerPreview,
  componentPickerPresentations,
} from "@/components/course-builder/component-picker-preview";
import {
  CourseComponentRenderer,
  type SignedCourseComponentAssetMap,
} from "@/components/course-builder/component-renderers";
import { courseBuilderRequest } from "@/components/course-builder/course-builder-client";
import { getStudentScreenToggleInput } from "@/components/course-builder/student-slide-placement";
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
  creatableComponentDefinitions,
  getComponentDefinition,
  type CreatableComponentTypeKey,
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

function ComponentEditorDialog({
  component,
  displayPosition,
  assets,
  disabled,
  mutationError,
  runMutation,
  onClose,
}: {
  component: LessonComponent;
  displayPosition: number;
  assets: CourseAsset[];
  disabled: boolean;
  mutationError: string | null;
  runMutation: CourseBuilderMutationRunner;
  onClose: () => void;
}) {
  const definition = getComponentDefinition(component.typeKey);
  const [saveAttempted, setSaveAttempted] = useState(false);

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
      title={`${displayPosition}. ${definition.title}`}
      description="Редактирование компонента: настройте содержимое и отображение."
      onClose={() => {
        if (!disabled) onClose();
      }}
      closeLabel={`Закрыть редактор «${definition.title}»`}
      className="component-editor-dialog"
      panelClassName="component-editor-dialog-panel max-w-3xl"
      bodyClassName="component-editor-dialog-body"
    >
      <ComponentPayloadEditor
        component={component}
        assets={assets}
        disabled={disabled}
        saveError={saveAttempted ? mutationError : null}
        onCancel={onClose}
        onSave={async (input) => {
          setSaveAttempted(true);
          let committed = false;
          const saved = await runMutation("Сохраняем компонент…", async () => {
            await jsonRequest(
              `/api/v2/components/${component.id}`,
              "PATCH",
              input,
            );
            committed = true;
          });
          if (saved || committed) onClose();
        }}
      />
    </DialogShell>
  );
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
  disabled,
  mutationError,
  runMutation,
}: {
  component: LessonComponent;
  displayPosition: number;
  indexInLesson: number;
  componentCount: number;
  lessonComponents: LessonComponent[];
  studentSlides: CourseLesson["studentSlides"];
  assets: CourseAsset[];
  assetMap: SignedCourseComponentAssetMap;
  disabled: boolean;
  mutationError: string | null;
  runMutation: CourseBuilderMutationRunner;
}) {
  const [editing, setEditing] = useState(false);
  const editTriggerRef = useRef<HTMLButtonElement>(null);
  const studentScreenTriggerRef = useRef<HTMLButtonElement>(null);
  const accessibleLabelId = useId();
  const definition = getComponentDefinition(component.typeKey);
  const learnerVisible = component.studentSlideId !== null;
  const currentStudentSlidePosition = studentSlides.find(
    (slide) => slide.id === component.studentSlideId,
  )?.position;
  const studentScreenToggleInput = useMemo(
    () =>
      getStudentScreenToggleInput(
        lessonComponents,
        component.id,
        studentSlides,
      ),
    [component.id, lessonComponents, studentSlides],
  );

  async function toggleStudentScreen(releasePointerFocus: boolean) {
    if (!studentScreenToggleInput) return;
    const saved = await runMutation("Обновляем экран ученика…", () =>
      jsonRequest(
        `/api/v2/components/${component.id}/student-screen`,
        "POST",
        studentScreenToggleInput,
      ),
    );
    if (saved && releasePointerFocus) {
      window.requestAnimationFrame(() =>
        studentScreenTriggerRef.current?.blur(),
      );
    }
  }

  function closeEditor() {
    if (disabled) return;
    setEditing(false);
    window.requestAnimationFrame(() => editTriggerRef.current?.focus());
  }

  return (
    <>
      <article
        className="lesson-component-card group"
        aria-labelledby={accessibleLabelId}
        data-component-type-key={component.typeKey}
      >
        <h3
          id={accessibleLabelId}
          className="lesson-component-card-label sr-only"
        >
          {displayPosition}. {definition.title}
        </h3>
        <div
          className={`lesson-component-card-actions ${
            learnerVisible ? "has-student-screen-component" : ""
          }`}
          role="group"
          aria-label={`Управление компонентом ${displayPosition} «${definition.title}»`}
        >
          <Button
            variant="ghost"
            className="component-card-action"
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
            className="component-card-action"
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
            ref={editTriggerRef}
            variant="ghost"
            className="component-card-action"
            disabled={disabled}
            aria-haspopup="dialog"
            aria-label={`Редактировать «${definition.title}»`}
            title="Редактировать"
            onClick={() => setEditing(true)}
          >
            <Pencil className="h-4 w-4" aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            className="component-card-action component-card-action-danger"
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
          <div className="component-card-student-screen-control">
            <Button
              ref={studentScreenTriggerRef}
              variant="ghost"
              className={`component-card-visibility-action transition ${
                learnerVisible
                  ? "component-card-visibility-action-active bg-sky-100 text-sky-800 hover:bg-sky-200"
                  : "component-card-visibility-action-inactive text-neutral-500"
              }`}
              disabled={disabled || studentScreenToggleInput === null}
              aria-pressed={learnerVisible}
              aria-label={
                learnerVisible
                  ? `Убрать «${definition.title}» с экрана ученика`
                  : `Показать «${definition.title}» на экране ученика`
              }
              title={
                learnerVisible
                  ? currentStudentSlidePosition === undefined
                    ? "Убрать с экрана ученика"
                    : `Убрать со слайда ${currentStudentSlidePosition}`
                  : "Показать на экране ученика"
              }
              onClick={(event) => void toggleStudentScreen(event.detail > 0)}
            >
              <MonitorPlay className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </div>

        <div className="lesson-component-card-content">
          <CourseComponentRenderer
            component={component}
            assets={assetMap}
            mode="teacher"
          />
        </div>
      </article>

      {editing ? (
        <ComponentEditorDialog
          key={component.id}
          component={component}
          displayPosition={displayPosition}
          assets={assets}
          disabled={disabled}
          mutationError={mutationError}
          runMutation={runMutation}
          onClose={closeEditor}
        />
      ) : null}
    </>
  );
}

function ComponentPickerDialog({
  lessonId,
  assets,
  disabled,
  mutationError,
  runMutation,
  onClose,
}: {
  lessonId: string;
  assets: CourseAsset[];
  disabled: boolean;
  mutationError: string | null;
  runMutation: CourseBuilderMutationRunner;
  onClose: () => void;
}) {
  const [category, setCategory] = useState<ComponentPickerCategory>("text");
  const [selectedTypeKey, setSelectedTypeKey] =
    useState<CreatableComponentTypeKey | null>(null);
  const [saveAttempted, setSaveAttempted] = useState(false);
  const categoryTriggerRef = useRef<HTMLButtonElement>(null);
  const definitions = creatableComponentDefinitions.filter((definition) => {
    return category === "link"
      ? definition.key === "external_link"
      : category === "file"
        ? definition.key === "file"
        : definition.category === category;
  });
  const selectedDefinition = selectedTypeKey
    ? getComponentDefinition(selectedTypeKey)
    : null;
  const draftComponent = useMemo<Pick<
    LessonComponent,
    "typeKey" | "payload" | "placement"
  > | null>(() => {
    if (!selectedDefinition || !selectedTypeKey) return null;
    return {
      typeKey: selectedTypeKey,
      payload: structuredClone(selectedDefinition.defaultPayload),
      placement: structuredClone(selectedDefinition.defaultPlacement),
    };
  }, [selectedDefinition, selectedTypeKey]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape" || disabled) return;
      event.preventDefault();
      onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [disabled, onClose]);

  async function add(input: {
    payload: Record<string, unknown>;
    placement: Record<string, unknown>;
  }) {
    if (!selectedDefinition || !selectedTypeKey) return;
    setSaveAttempted(true);
    let committed = false;
    const saved = await runMutation(
      `Добавляем «${selectedDefinition.title}»…`,
      async () => {
        await jsonRequest<{ component: LessonComponent }>(
          `/api/v2/lessons/${lessonId}/components`,
          "POST",
          { typeKey: selectedTypeKey, ...input },
        );
        committed = true;
      },
    );
    if (saved || committed) onClose();
  }

  function returnToCatalog() {
    if (disabled) return;
    const previousTypeKey = selectedTypeKey;
    setSelectedTypeKey(null);
    setSaveAttempted(false);
    window.requestAnimationFrame(() => {
      const previousCard = previousTypeKey
        ? document.querySelector<HTMLElement>(
            `.component-picker-dialog [data-component-type-key="${previousTypeKey}"]`,
          )
        : null;
      (previousCard ?? categoryTriggerRef.current)?.focus();
    });
  }

  return (
    <DialogShell
      title={
        selectedDefinition
          ? `Новый компонент · ${selectedDefinition.title}`
          : "Компоненты"
      }
      description={
        selectedDefinition
          ? componentPickerPresentations[selectedDefinition.key].description
          : undefined
      }
      onClose={() => {
        if (!disabled) onClose();
      }}
      className={`component-picker-dialog ${
        selectedDefinition ? "component-editor-dialog is-configuring" : ""
      }`}
      panelClassName="component-picker-dialog-panel max-w-4xl"
      bodyClassName="component-picker-dialog-body"
    >
      {selectedDefinition && draftComponent ? (
        <ComponentPayloadEditor
          key={selectedDefinition.key}
          component={draftComponent}
          assets={assets}
          disabled={disabled}
          saveError={saveAttempted ? mutationError : null}
          cancelLabel="Назад к компонентам"
          onCancel={returnToCatalog}
          onSave={add}
        />
      ) : (
        <>
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
                  ref={selected ? categoryTriggerRef : undefined}
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
                aria-label={`Настроить компонент «${definition.title}». ${componentPickerPresentations[definition.key].description}`}
                onClick={() => {
                  setSaveAttempted(false);
                  setSelectedTypeKey(definition.key);
                }}
              >
                <span className="component-picker-card-heading">
                  <span className="component-picker-card-title">
                    {definition.title}
                  </span>
                  <span
                    className="component-picker-card-add"
                    aria-hidden="true"
                  >
                    <Plus className="h-4 w-4" />
                  </span>
                </span>
                <span className="component-picker-card-description">
                  {componentPickerPresentations[definition.key].description}
                </span>
                <ComponentPickerPreview typeKey={definition.key} />
              </button>
            ))}
          </div>
        </>
      )}
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
  disabled,
  mutationError,
  runMutation,
}: {
  course: CourseWorkspace;
  lesson: CourseLesson;
  query: string;
  disabled: boolean;
  mutationError: string | null;
  runMutation: CourseBuilderMutationRunner;
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
          disabled={disabled}
          mutationError={mutationError}
          runMutation={runMutation}
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
              <MonitorPlay
                className="mx-auto h-7 w-7 text-neutral-400"
                aria-hidden="true"
              />
              <h3 className="mt-3 font-black text-neutral-950">
                Экран ученика пока пуст
              </h3>
              <p className="mt-2 max-w-xl text-sm leading-6 text-neutral-600">
                В плане урока нажмите кнопку «Экран ученика» у нужного
                компонента.
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
  const pickerTriggerRef = useRef<HTMLButtonElement>(null);
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
  }

  function deleteLesson() {
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
        metric={`Компонентов: ${lesson.components.length} · слайдов: ${lesson.studentSlides.length} · проведений: ${completedLessonRunCount(runs)}`}
        actions={
          <AppPageHeaderActions
            primary={
              teachingEnabled ? (
                <LessonRunStatusButton
                  runs={runs}
                  disabled={disabled}
                  onClick={() => setLessonRunDialogOpen(true)}
                  variant="primary"
                />
              ) : (
                <Button
                  disabled={disabled}
                  onClick={() => setAiPlannerOpen(true)}
                >
                  <WandSparkles className="h-4 w-4" aria-hidden="true" />
                  Дополнить с ИИ
                </Button>
              )
            }
            overflowLabel={`Другие действия с уроком «${lesson.title}»`}
            overflowDisabled={disabled}
            overflowItems={[
              ...(teachingEnabled
                ? [
                    {
                      id: "ai",
                      label: "Дополнить с ИИ",
                      icon: WandSparkles,
                      onSelect: () => setAiPlannerOpen(true),
                    },
                  ]
                : []),
              {
                id: "settings",
                label: "Настройки урока",
                icon: Pencil,
                onSelect: () => setLessonEditorOpen(true),
              },
              {
                id: "delete",
                label: "Удалить",
                icon: Trash2,
                destructive: true,
                onSelect: deleteLesson,
              },
            ]}
          />
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
                  disabled={disabled}
                  mutationError={mutationError}
                  runMutation={runMutation}
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
          assets={course.attachments}
          disabled={disabled}
          mutationError={mutationError}
          runMutation={runMutation}
          onClose={closePicker}
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
