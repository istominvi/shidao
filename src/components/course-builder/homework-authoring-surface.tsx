"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ArrowDown,
  ArrowUp,
  ClipboardCheck,
  Eye,
  LoaderCircle,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Trash2,
} from "lucide-react";
import { ComponentPayloadEditor } from "@/components/course-builder/component-payload-editor";
import {
  ComponentPickerPreview,
  componentPickerPresentations,
} from "@/components/course-builder/component-picker-preview";
import {
  CourseComponentRenderer,
  type SignedCourseComponentAssetMap,
} from "@/components/course-builder/component-renderers";
import {
  HomeworkAuthoringClientError,
  clearLessonHomework,
  loadLessonHomework,
  replaceLessonHomework,
} from "@/components/course-builder/homework-authoring-client";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { DialogShell } from "@/components/ui/dialog-shell";
import type {
  CourseAsset,
  LessonComponent,
} from "@/modules/course-builder/domain";
import { getComponentDefinition } from "@/modules/course-builder/registry/contracts";
import {
  HOMEWORK_ITEM_LIMIT,
  homeworkItemTypeKeys,
  type HomeworkItemTypeKey,
} from "@/modules/homework-authoring/contracts";
import type {
  LessonHomework,
  LessonHomeworkDraftItem,
} from "@/modules/homework-authoring/domain";

type FailedOperation = "load" | "save" | "clear";

type HomeworkItemDialogProps = {
  item: LessonHomeworkDraftItem | null;
  assets: CourseAsset[];
  onSave: (item: LessonHomeworkDraftItem) => void;
  onClose: () => void;
};

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

function draftItemsFrom(homework: LessonHomework | null) {
  return homework
    ? [...homework.items]
        .sort((left, right) => left.position - right.position)
        .map(({ position: _position, ...item }) => item)
    : [];
}

function readableError(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Не удалось выполнить операцию с домашним заданием.";
}

function HomeworkItemDialog({
  item,
  assets,
  onSave,
  onClose,
}: HomeworkItemDialogProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [selectedTypeKey, setSelectedTypeKey] =
    useState<HomeworkItemTypeKey | null>(item?.typeKey ?? null);
  const definition = selectedTypeKey
    ? getComponentDefinition(selectedTypeKey)
    : null;
  const draftComponent = useMemo<Pick<
    LessonComponent,
    | "typeKey"
    | "payload"
    | "placement"
    | "primaryLearningObjectiveId"
    | "activityRole"
  > | null>(() => {
    if (!definition || !selectedTypeKey) return null;
    return {
      typeKey: selectedTypeKey,
      payload: structuredClone(item?.payload ?? definition.defaultPayload),
      placement: structuredClone(
        item?.placement ?? definition.defaultPlacement,
      ),
      primaryLearningObjectiveId: null,
      activityRole: null,
    };
  }, [definition, item, selectedTypeKey]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (!definition) return;
    const frame = window.requestAnimationFrame(() => {
      editorRef.current
        ?.querySelector<HTMLElement>(
          "input:not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled])",
        )
        ?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [definition]);

  function returnToTypes() {
    if (item) {
      onClose();
      return;
    }
    setSelectedTypeKey(null);
  }

  return (
    <DialogShell
      title={
        definition
          ? `${item ? "Редактировать" : "Новый пункт"} · ${definition.title}`
          : "Добавить пункт"
      }
      description={
        definition
          ? componentPickerPresentations[definition.key].description
          : "Выберите один из безопасных типов содержимого. Ответы и попытки учащихся здесь не создаются."
      }
      onClose={onClose}
      className={`component-picker-dialog homework-item-dialog ${
        definition ? "component-editor-dialog is-configuring" : ""
      }`}
      panelClassName="component-picker-dialog-panel max-w-4xl"
      bodyClassName="component-picker-dialog-body"
    >
      {definition && draftComponent ? (
        <div ref={editorRef} data-homework-item-editor>
          <ComponentPayloadEditor
            key={`${item?.id ?? "new"}:${definition.key}`}
            component={draftComponent}
            assets={assets}
            learningObjectives={[]}
            showPedagogy={false}
            saveLabel="Сохранить пункт"
            cancelLabel={item ? "Отмена" : "Назад к типам"}
            onSave={async ({ payload, placement }) => {
              onSave({
                id: item?.id ?? globalThis.crypto.randomUUID(),
                typeKey: definition.key,
                schemaVersion: definition.version,
                payload,
                placement,
              });
            }}
            onCreateLearningObjective={async () => null}
            onArchiveLearningObjective={async () => null}
            onCancel={returnToTypes}
          />
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {homeworkItemTypeKeys.map((typeKey, index) => {
            const itemDefinition = getComponentDefinition(typeKey);
            const presentation = componentPickerPresentations[typeKey];
            return (
              <button
                key={typeKey}
                type="button"
                autoFocus={index === 0}
                data-dialog-initial-focus={index === 0 ? "true" : undefined}
                data-homework-item-type-key={typeKey}
                className="component-picker-card"
                aria-label={`Настроить пункт «${itemDefinition.title}». ${presentation.description}`}
                onClick={() => setSelectedTypeKey(typeKey)}
              >
                <span className="component-picker-card-heading">
                  <span className="component-picker-card-title">
                    {itemDefinition.title}
                  </span>
                  <span className="component-picker-card-add" aria-hidden>
                    <Plus className="h-4 w-4" />
                  </span>
                </span>
                <span className="component-picker-card-description">
                  {presentation.description}
                </span>
                <ComponentPickerPreview typeKey={typeKey} />
              </button>
            );
          })}
        </div>
      )}
    </DialogShell>
  );
}

type HomeworkAuthoringSurfaceProps = {
  lessonId: string;
  lessonPosition: number;
  assets: CourseAsset[];
  onDirtyChange?: (dirty: boolean) => void;
};

export function HomeworkAuthoringSurface({
  lessonId,
  lessonPosition,
  assets,
  onDirtyChange,
}: HomeworkAuthoringSurfaceProps) {
  const headingId = useId();
  const loadSequenceRef = useRef(0);
  const addItemButtonRef = useRef<HTMLButtonElement>(null);
  const dialogTriggerRef = useRef<HTMLButtonElement | null>(null);
  const [homework, setHomework] = useState<LessonHomework | null>(null);
  const [items, setItems] = useState<LessonHomeworkDraftItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [operation, setOperation] = useState<"save" | "clear" | null>(null);
  const [failedOperation, setFailedOperation] =
    useState<FailedOperation | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dialogItemId, setDialogItemId] = useState<string | "new" | null>(null);
  const assetMap = useMemo(() => assetMapFor(assets), [assets]);
  const disabled = operation !== null;
  const editingItem =
    dialogItemId && dialogItemId !== "new"
      ? (items.find((item) => item.id === dialogItemId) ?? null)
      : null;

  const load = useCallback(async () => {
    const sequence = ++loadSequenceRef.current;
    setLoading(true);
    setError(null);
    setFailedOperation(null);
    try {
      const nextHomework = await loadLessonHomework(lessonId);
      if (sequence !== loadSequenceRef.current) return;
      setHomework(nextHomework);
      setItems(draftItemsFrom(nextHomework));
      setDirty(false);
      setSaved(false);
    } catch (caught) {
      if (sequence !== loadSequenceRef.current) return;
      setError(caught);
      setFailedOperation("load");
    } finally {
      if (sequence === loadSequenceRef.current) setLoading(false);
    }
  }, [lessonId]);

  useEffect(() => {
    void load();
    return () => {
      loadSequenceRef.current += 1;
    };
  }, [load]);

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  useEffect(() => {
    if (!dirty) return;
    function warnBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
    }
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [dirty]);

  function updateItems(nextItems: LessonHomeworkDraftItem[]) {
    setItems(nextItems);
    setDirty(true);
    setSaved(false);
    setError(null);
    setFailedOperation(null);
  }

  function openItemDialog(itemId: string | "new", trigger: HTMLButtonElement) {
    dialogTriggerRef.current = trigger;
    setDialogItemId(itemId);
  }

  function closeItemDialog() {
    const trigger = dialogTriggerRef.current;
    setDialogItemId(null);
    window.requestAnimationFrame(() => {
      (trigger?.isConnected ? trigger : addItemButtonRef.current)?.focus();
    });
  }

  async function saveDraft() {
    if (!dirty || disabled) return;
    setOperation("save");
    setError(null);
    setFailedOperation(null);
    try {
      const nextHomework =
        items.length === 0
          ? homework
            ? await clearLessonHomework(lessonId, {
                expectedRevision: homework.revision,
              })
            : null
          : await replaceLessonHomework(lessonId, {
              expectedRevision: homework?.revision ?? null,
              items,
            });
      setHomework(nextHomework);
      setItems(draftItemsFrom(nextHomework));
      setDirty(false);
      setSaved(true);
    } catch (caught) {
      setError(caught);
      setFailedOperation("save");
    } finally {
      setOperation(null);
    }
  }

  async function clearDraft(skipConfirmation = false) {
    if (disabled || (items.length === 0 && !dirty)) return;
    if (
      !skipConfirmation &&
      !window.confirm(
        "Очистить домашнее задание? Все сохранённые пункты будут удалены.",
      )
    ) {
      return;
    }
    if (!homework) {
      setItems([]);
      setDirty(false);
      setSaved(false);
      setError(null);
      setFailedOperation(null);
      return;
    }
    setOperation("clear");
    setError(null);
    setFailedOperation(null);
    try {
      const nextHomework = await clearLessonHomework(lessonId, {
        expectedRevision: homework.revision,
      });
      setHomework(nextHomework);
      setItems(draftItemsFrom(nextHomework));
      setDirty(false);
      setSaved(true);
    } catch (caught) {
      setError(caught);
      setFailedOperation("clear");
    } finally {
      setOperation(null);
    }
  }

  function reloadCanonical() {
    if (
      dirty &&
      !window.confirm(
        "Загрузить актуальную версию? Несохранённые изменения будут потеряны.",
      )
    ) {
      return;
    }
    void load();
  }

  if (loading) {
    return (
      <div className="workspace-surface flex items-center gap-3" role="status">
        <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden />
        Загружаем домашнее задание…
      </div>
    );
  }

  if (failedOperation === "load") {
    return (
      <Alert tone="error" title="Не удалось загрузить домашнее задание">
        <p>{readableError(error)}</p>
        <Button
          className="mt-3"
          variant="secondary"
          onClick={() => void load()}
        >
          <RefreshCw className="h-4 w-4" aria-hidden />
          Повторить
        </Button>
      </Alert>
    );
  }

  const stale =
    error instanceof HomeworkAuthoringClientError && error.failure === "stale";

  return (
    <section className="grid gap-5" aria-labelledby={headingId}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-violet-700">
            Урок {lessonPosition}
          </p>
          <h2
            id={headingId}
            className="mt-2 text-2xl font-black text-neutral-950"
          >
            Домашнее задание
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-600">
            Один общий черновик для урока. Предпросмотр не создаёт выдачу,
            ответы или учебную историю.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 sm:justify-end">
          <Button
            ref={addItemButtonRef}
            variant="secondary"
            disabled={disabled || items.length >= HOMEWORK_ITEM_LIMIT}
            onClick={(event) => openItemDialog("new", event.currentTarget)}
          >
            <Plus className="h-4 w-4" aria-hidden />
            Добавить пункт
          </Button>
          <Button
            disabled={disabled || !dirty}
            onClick={() => void saveDraft()}
          >
            {operation === "save" ? (
              <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Save className="h-4 w-4" aria-hidden />
            )}
            {operation === "save" ? "Сохраняем…" : "Сохранить"}
          </Button>
          <Button
            variant="ghost"
            disabled={disabled || (items.length === 0 && !dirty)}
            onClick={() => void clearDraft()}
          >
            <Trash2 className="h-4 w-4" aria-hidden />
            Очистить
          </Button>
        </div>
      </div>

      <div className="min-h-6" role="status" aria-live="polite">
        {operation === "save" ? (
          <span className="inline-flex items-center gap-2 text-sm font-medium text-neutral-700">
            <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
            Сохраняем домашнее задание…
          </span>
        ) : operation === "clear" ? (
          <span className="inline-flex items-center gap-2 text-sm font-medium text-neutral-700">
            <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
            Очищаем домашнее задание…
          </span>
        ) : dirty ? (
          <span className="text-sm font-medium text-amber-800">
            Есть несохранённые изменения
          </span>
        ) : saved ? (
          <span className="text-sm font-medium text-emerald-700">
            Изменения сохранены
          </span>
        ) : homework ? (
          <span className="text-sm text-neutral-500">
            Сохранённая версия {homework.revision}
          </span>
        ) : null}
      </div>

      {error ? (
        <Alert
          tone={stale ? "warning" : "error"}
          title={stale ? "Версия устарела" : "Изменения не сохранены"}
        >
          <p>{readableError(error)}</p>
          <Button
            className="mt-3"
            variant="secondary"
            onClick={
              stale
                ? reloadCanonical
                : failedOperation === "clear"
                  ? () => void clearDraft(true)
                  : () => void saveDraft()
            }
          >
            <RefreshCw className="h-4 w-4" aria-hidden />
            {stale
              ? "Загрузить актуальную версию"
              : failedOperation === "clear"
                ? "Повторить очистку"
                : "Повторить сохранение"}
          </Button>
        </Alert>
      ) : null}

      {items.length === 0 ? (
        <div className="workspace-empty-state">
          <ClipboardCheck className="h-8 w-8 text-violet-500" aria-hidden />
          <h3>Домашнее задание пока пусто</h3>
          <p>
            Добавьте инструкцию, изображение, ссылку или файл. Всё можно
            подготовить вручную без ИИ.
          </p>
          <Button
            className="mt-4"
            disabled={disabled}
            onClick={(event) => openItemDialog("new", event.currentTarget)}
          >
            <Plus className="h-4 w-4" aria-hidden />
            Добавить первый пункт
          </Button>
        </div>
      ) : (
        <div className="grid min-w-0 gap-6 lg:grid-cols-2 lg:items-start">
          <section
            className="min-w-0"
            aria-label="Редактор пунктов домашнего задания"
          >
            <ol className="grid gap-4">
              {items.map((item, index) => {
                const definition = getComponentDefinition(item.typeKey);
                const labelId = `${headingId}-item-${item.id}`;
                return (
                  <li key={item.id}>
                    <article
                      className="lesson-component-card group"
                      aria-labelledby={labelId}
                      data-homework-item-id={item.id}
                      data-homework-item-type-key={item.typeKey}
                    >
                      <h3 id={labelId} className="sr-only">
                        {index + 1}. {definition.title}
                      </h3>
                      <div
                        className="lesson-component-card-actions"
                        role="group"
                        aria-label={`Управление пунктом ${index + 1} «${definition.title}»`}
                      >
                        <Button
                          variant="ghost"
                          className="component-card-action"
                          disabled={disabled || index === 0}
                          aria-label={`Переместить «${definition.title}» выше`}
                          onClick={() => {
                            const next = [...items];
                            [next[index - 1], next[index]] = [
                              next[index]!,
                              next[index - 1]!,
                            ];
                            updateItems(next);
                          }}
                        >
                          <ArrowUp className="h-4 w-4" aria-hidden />
                        </Button>
                        <Button
                          variant="ghost"
                          className="component-card-action"
                          disabled={disabled || index === items.length - 1}
                          aria-label={`Переместить «${definition.title}» ниже`}
                          onClick={() => {
                            const next = [...items];
                            [next[index], next[index + 1]] = [
                              next[index + 1]!,
                              next[index]!,
                            ];
                            updateItems(next);
                          }}
                        >
                          <ArrowDown className="h-4 w-4" aria-hidden />
                        </Button>
                        <Button
                          variant="ghost"
                          className="component-card-action"
                          disabled={disabled}
                          aria-haspopup="dialog"
                          aria-label={`Редактировать «${definition.title}»`}
                          onClick={(event) =>
                            openItemDialog(item.id, event.currentTarget)
                          }
                        >
                          <Pencil className="h-4 w-4" aria-hidden />
                        </Button>
                        <Button
                          variant="ghost"
                          className="component-card-action component-card-action-danger"
                          disabled={disabled}
                          aria-label={`Удалить «${definition.title}»`}
                          onClick={() => {
                            if (
                              !window.confirm(
                                `Удалить пункт «${definition.title}»?`,
                              )
                            ) {
                              return;
                            }
                            updateItems(
                              items.filter(
                                (candidate) => candidate.id !== item.id,
                              ),
                            );
                          }}
                        >
                          <Trash2 className="h-4 w-4" aria-hidden />
                        </Button>
                      </div>
                      <div className="lesson-component-card-content">
                        <CourseComponentRenderer
                          component={item}
                          assets={assetMap}
                          mode="teacher"
                          interaction="presentation"
                        />
                      </div>
                    </article>
                  </li>
                );
              })}
            </ol>
          </section>

          <section
            className="min-w-0 rounded-[1.25rem] border border-violet-100 bg-white p-4 shadow-sm sm:p-6 lg:sticky lg:top-4"
            aria-labelledby={`${headingId}-preview`}
          >
            <div className="mb-5 flex items-center gap-2 border-b border-neutral-100 pb-4">
              <Eye className="h-4 w-4 text-violet-600" aria-hidden />
              <h3
                id={`${headingId}-preview`}
                className="font-black text-neutral-950"
              >
                Предпросмотр
              </h3>
              <span className="ml-auto text-xs font-medium text-neutral-500">
                Только чтение
              </span>
            </div>
            <div className="grid min-w-0 gap-5">
              {items.map((item) => (
                <CourseComponentRenderer
                  key={item.id}
                  component={item}
                  assets={assetMap}
                  mode="student"
                  interaction="presentation"
                />
              ))}
            </div>
          </section>
        </div>
      )}

      {dialogItemId ? (
        <HomeworkItemDialog
          key={dialogItemId}
          item={editingItem}
          assets={assets}
          onClose={closeItemDialog}
          onSave={(nextItem) => {
            updateItems(
              editingItem
                ? items.map((item) =>
                    item.id === editingItem.id ? nextItem : item,
                  )
                : [...items, nextItem],
            );
            closeItemDialog();
          }}
        />
      ) : null}
    </section>
  );
}
