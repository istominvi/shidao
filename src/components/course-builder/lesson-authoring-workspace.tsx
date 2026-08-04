"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  BookOpenCheck,
  ClipboardCheck,
  Eye,
  EyeOff,
  FileText,
  Gamepad2,
  Image as ImageIcon,
  Layers3,
  MonitorPlay,
  Pencil,
  Plus,
  Save,
  Trash2,
  Type,
} from "lucide-react";
import { ComponentPayloadEditor } from "@/components/course-builder/component-payload-editor";
import {
  CourseComponentRenderer,
  type SignedCourseComponentAssetMap,
} from "@/components/course-builder/component-renderers";
import { courseBuilderRequest } from "@/components/course-builder/course-builder-client";
import { Button, productButtonClassName } from "@/components/ui/button";
import { DialogShell } from "@/components/ui/dialog-shell";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { toCourseStudentPreviewRoute } from "@/lib/auth";
import type {
  CourseAsset,
  CourseLesson,
  CourseWorkspace,
  LessonComponent,
} from "@/modules/course-builder/domain";
import {
  componentDefinitions,
  getComponentDefinition,
  type ComponentCategory,
  type ComponentTypeKey,
} from "@/modules/course-builder/registry/contracts";

export type CourseBuilderMutationRunner = (
  label: string,
  action: () => Promise<unknown>,
) => Promise<boolean>;

export type LessonAuthoringSurface = "plan" | "student" | "homework";

type LessonAuthoringWorkspaceProps = {
  course: CourseWorkspace;
  lesson: CourseLesson;
  surface: LessonAuthoringSurface;
  onSurfaceChange: (surface: LessonAuthoringSurface) => void;
  disabled: boolean;
  runMutation: CourseBuilderMutationRunner;
};

const SURFACE_ITEMS = [
  { value: "plan", label: "План урока", icon: BookOpenCheck },
  { value: "student", label: "Экран ученика", icon: MonitorPlay },
  { value: "homework", label: "Домашнее задание", icon: ClipboardCheck },
] satisfies Array<{
  value: LessonAuthoringSurface;
  label: string;
  icon: typeof BookOpenCheck;
}>;

const CATEGORY_ITEMS = [
  {
    value: "text",
    label: "Текст",
    description: "Заголовки, основной текст, сноски и цитаты",
    icon: Type,
  },
  {
    value: "media",
    label: "Изображения",
    description: "Картинки и слайдшоу из материалов курса",
    icon: ImageIcon,
  },
  {
    value: "interactive",
    label: "Игры и активности",
    description: "Опросы и интерактивные задания",
    icon: Gamepad2,
  },
  {
    value: "layout",
    label: "Оформление",
    description: "Разделители и структура плана",
    icon: Layers3,
  },
  {
    value: "attachment",
    label: "Файлы",
    description: "Материалы для скачивания или просмотра",
    icon: FileText,
  },
] as const satisfies ReadonlyArray<{
  value: ComponentCategory;
  label: string;
  description: string;
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
  indexInGroup,
  groupSize,
  assets,
  assetMap,
  initiallyEditing,
  disabled,
  runMutation,
  onInitialEditorConsumed,
}: {
  component: LessonComponent;
  displayPosition: number;
  indexInGroup: number;
  groupSize: number;
  assets: CourseAsset[];
  assetMap: SignedCourseComponentAssetMap;
  initiallyEditing: boolean;
  disabled: boolean;
  runMutation: CourseBuilderMutationRunner;
  onInitialEditorConsumed: () => void;
}) {
  const [editing, setEditing] = useState(initiallyEditing);
  const initialEditorConsumedRef = useRef(false);
  const definition = getComponentDefinition(component.typeKey);
  const learnerVisible = component.visibility === "learner_visible";
  const hoverActionClass =
    "h-9 w-9 border border-neutral-200 bg-white/95 p-0 shadow-sm transition-opacity md:!opacity-0 md:group-hover:!opacity-100 md:group-focus-within:!opacity-100";

  useEffect(() => {
    if (!initiallyEditing || initialEditorConsumedRef.current) return;
    initialEditorConsumedRef.current = true;
    onInitialEditorConsumed();
  }, [initiallyEditing, onInitialEditorConsumed]);

  return (
    <article className="group relative rounded-3xl border border-neutral-200 bg-white p-4 pt-16 shadow-sm transition hover:border-neutral-300 hover:shadow-md md:p-5 md:pt-5">
      <div className="absolute right-3 top-3 z-10 flex max-w-[calc(100%-1.5rem)] flex-wrap justify-end gap-1">
        <Button
          variant="ghost"
          className={hoverActionClass}
          disabled={disabled || indexInGroup === 0}
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
          disabled={disabled || indexInGroup === groupSize - 1}
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
          className={`${hoverActionClass} text-rose-700`}
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
        <Button
          variant="ghost"
          className={`h-9 w-9 border border-neutral-200 bg-white/95 p-0 shadow-sm transition ${
            learnerVisible
              ? "border-sky-200 bg-sky-100 text-sky-800 hover:bg-sky-200"
              : "text-neutral-500 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100"
          }`}
          disabled={disabled}
          aria-pressed={learnerVisible}
          aria-label={
            learnerVisible
              ? `Убрать «${definition.title}» с экрана ученика`
              : `Добавить «${definition.title}» на экран ученика`
          }
          title={
            learnerVisible
              ? "Убрать с экрана ученика"
              : "Добавить на экран ученика"
          }
          onClick={() =>
            void runMutation("Обновляем экран ученика…", () =>
              jsonRequest(`/api/v2/components/${component.id}`, "PATCH", {
                visibility: learnerVisible ? "staff_only" : "learner_visible",
              }),
            )
          }
        >
          {learnerVisible ? (
            <Eye className="h-4 w-4" aria-hidden="true" />
          ) : (
            <EyeOff className="h-4 w-4" aria-hidden="true" />
          )}
        </Button>
      </div>

      <div className="mb-4 border-b border-neutral-100 pb-3 md:pr-48">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-neutral-500">
          {displayPosition}. {definition.title}
        </p>
        <span
          className={`mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${
            learnerVisible
              ? "bg-sky-100 text-sky-800"
              : "bg-neutral-100 text-neutral-600"
          }`}
        >
          {learnerVisible ? (
            <Eye className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          {learnerVisible ? "На экране ученика" : "Только преподавателю"}
        </span>
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
  const [category, setCategory] = useState<ComponentCategory>("text");
  const definitions = componentDefinitions.filter(
    (definition) => definition.category === category,
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
            visibility: "staff_only",
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
      description="Выберите элемент плана. Новый компонент сначала виден только преподавателю."
      onClose={onClose}
      panelClassName="max-w-4xl"
    >
      <div
        className="flex gap-2 overflow-x-auto border-b border-neutral-200 pb-3"
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
              className={`inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl px-3 text-sm font-bold transition ${
                selected
                  ? "bg-neutral-950 text-white"
                  : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
              }`}
              onClick={() => setCategory(item.value)}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {item.label}
            </button>
          );
        })}
      </div>

      <div className="mt-5">
        <div className="mb-4">
          <h3 className="font-black text-neutral-950">
            {CATEGORY_ITEMS.find((item) => item.value === category)?.label}
          </h3>
          <p className="mt-1 text-sm text-neutral-600">
            {
              CATEGORY_ITEMS.find((item) => item.value === category)
                ?.description
            }
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {definitions.map((definition) => (
            <button
              key={definition.key}
              type="button"
              disabled={disabled}
              className="rounded-2xl border border-neutral-200 bg-white p-4 text-left transition hover:border-neutral-950 hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
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
      </div>
    </DialogShell>
  );
}

function LessonPlan({
  course,
  lesson,
  editingComponentId,
  disabled,
  runMutation,
  onEditingComponentConsumed,
}: {
  course: CourseWorkspace;
  lesson: CourseLesson;
  editingComponentId: string | null;
  disabled: boolean;
  runMutation: CourseBuilderMutationRunner;
  onEditingComponentConsumed: () => void;
}) {
  const [title, setTitle] = useState(lesson.title);
  const [summary, setSummary] = useState(lesson.summary);
  const assetMap = useMemo(
    () => assetMapFor(course.attachments),
    [course.attachments],
  );
  const components = lesson.steps.flatMap((step) =>
    step.components.map((component, indexInGroup) => ({
      component,
      indexInGroup,
      groupSize: step.components.length,
    })),
  );
  const populatedLegacyGroupCount = lesson.steps.filter(
    (step) => step.components.length > 0,
  ).length;

  return (
    <div className="grid gap-5">
      <section className="rounded-3xl border border-neutral-200 bg-white/90 p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-violet-700">
              Урок {lesson.position}
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
                  `Удалить урок «${lesson.title}» со всем содержимым?`,
                )
              )
                return;
              void runMutation("Удаляем урок…", () =>
                jsonRequest(`/api/v2/lessons/${lesson.id}`, "DELETE"),
              );
            }}
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            Удалить урок
          </Button>
        </div>

        <form
          className="mt-5 grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end"
          onSubmit={(event) => {
            event.preventDefault();
            void runMutation("Сохраняем урок…", () =>
              jsonRequest(`/api/v2/lessons/${lesson.id}`, "PATCH", {
                title,
                summary,
              }),
            );
          }}
        >
          <label className="block">
            <span className="field-label">Название урока</span>
            <input
              required
              className="field-input"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </label>
          <label className="block">
            <span className="field-label">Комментарий преподавателя</span>
            <input
              className="field-input"
              placeholder="Необязательно"
              value={summary}
              onChange={(event) => setSummary(event.target.value)}
            />
          </label>
          <Button type="submit" disabled={disabled}>
            <Save className="h-4 w-4" aria-hidden="true" />
            Сохранить
          </Button>
        </form>
      </section>

      <section className="grid gap-4" aria-label="Компоненты плана урока">
        {populatedLegacyGroupCount > 1 ? (
          <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
            Этот урок собран предыдущей версией редактора: исходные группы
            сохраняют порядок. Компоненты можно перемещать внутри группы, а
            новые элементы добавляются в конец плана.
          </p>
        ) : null}
        {components.map(({ component, indexInGroup, groupSize }, index) => (
          <ComponentCard
            key={component.id}
            component={component}
            displayPosition={index + 1}
            indexInGroup={indexInGroup}
            groupSize={groupSize}
            assets={course.attachments}
            assetMap={assetMap}
            initiallyEditing={component.id === editingComponentId}
            disabled={disabled}
            runMutation={runMutation}
            onInitialEditorConsumed={onEditingComponentConsumed}
          />
        ))}
        {components.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-neutral-300 bg-white/70 px-6 py-14 text-center">
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
      </section>
    </div>
  );
}

function StudentLessonSurface({
  course,
  lesson,
}: {
  course: CourseWorkspace;
  lesson: CourseLesson;
}) {
  const assetMap = useMemo(
    () => assetMapFor(course.attachments),
    [course.attachments],
  );
  const learnerGroups = lesson.steps.map((step) => ({
    id: step.id,
    instruction: step.learnerInstruction.trim(),
    components: step.components.filter(
      (component) => component.visibility === "learner_visible",
    ),
  }));
  const hasLearnerContent = learnerGroups.some(
    (group) => group.instruction || group.components.length > 0,
  );

  return (
    <section className="overflow-hidden rounded-[2rem] border border-sky-100 bg-[radial-gradient(circle_at_top_left,#e0f2fe_0%,#f5f3ff_42%,#ffffff_80%)] shadow-sm">
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

      <div className="grid min-h-[28rem] gap-6 p-5 md:p-8">
        {learnerGroups.map((group) => (
          <div key={group.id} className="grid gap-6">
            {group.instruction ? (
              <p className="max-w-3xl text-base leading-7 text-neutral-600">
                {group.instruction}
              </p>
            ) : null}
            {group.components.map((component) => (
              <CourseComponentRenderer
                key={component.id}
                component={component}
                assets={assetMap}
                mode="student"
              />
            ))}
          </div>
        ))}
        {!hasLearnerContent ? (
          <div className="grid place-items-center rounded-3xl border border-dashed border-neutral-300 bg-white/70 px-6 py-12 text-center">
            <div>
              <EyeOff
                className="mx-auto h-7 w-7 text-neutral-400"
                aria-hidden="true"
              />
              <h3 className="mt-3 font-black text-neutral-950">
                Экран ученика пока пуст
              </h3>
              <p className="mt-2 max-w-xl text-sm leading-6 text-neutral-600">
                В плане урока нажмите значок глаза у нужного компонента — он
                появится здесь после сохранения.
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function HomeworkSurface({ lesson }: { lesson: CourseLesson }) {
  return (
    <section className="rounded-3xl border border-neutral-200 bg-white/90 px-6 py-14 text-center shadow-sm">
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

export function LessonAuthoringWorkspace({
  course,
  lesson,
  surface,
  onSurfaceChange,
  disabled,
  runMutation,
}: LessonAuthoringWorkspaceProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [editingComponentId, setEditingComponentId] = useState<string | null>(
    null,
  );
  const pickerTriggerRef = useRef<HTMLButtonElement>(null);

  function closePicker() {
    if (disabled) return;
    setPickerOpen(false);
    window.requestAnimationFrame(() => pickerTriggerRef.current?.focus());
  }

  return (
    <div className="min-w-0">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-neutral-200 bg-white/80 p-2 shadow-sm">
        <Button
          ref={pickerTriggerRef}
          type="button"
          disabled={disabled}
          onClick={() => {
            onSurfaceChange("plan");
            setPickerOpen(true);
          }}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Компонент
        </Button>
        <SegmentedControl
          ariaLabel="Раздел выбранного урока"
          value={surface}
          onChange={onSurfaceChange}
          items={SURFACE_ITEMS}
          className="max-w-full overflow-x-auto"
        />
      </div>

      {surface === "plan" ? (
        <LessonPlan
          course={course}
          lesson={lesson}
          editingComponentId={editingComponentId}
          disabled={disabled}
          runMutation={runMutation}
          onEditingComponentConsumed={() => setEditingComponentId(null)}
        />
      ) : null}
      {surface === "student" ? (
        <StudentLessonSurface course={course} lesson={lesson} />
      ) : null}
      {surface === "homework" ? <HomeworkSurface lesson={lesson} /> : null}

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
    </div>
  );
}
