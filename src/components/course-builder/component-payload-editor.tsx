"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import type {
  CourseAsset,
  LessonComponent,
} from "@/modules/course-builder/domain";
import {
  getComponentDefinition,
  type ComponentTypeKey,
} from "@/modules/course-builder/registry/contracts";

type ComponentPayloadEditorProps = {
  component: LessonComponent;
  assets: CourseAsset[];
  disabled?: boolean;
  onSave: (input: {
    payload: Record<string, unknown>;
    placement: Record<string, unknown>;
  }) => Promise<void>;
  onCancel: () => void;
};

function stringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function booleanValue(value: unknown, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function objectArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter(
        (item): item is Record<string, unknown> =>
          typeof item === "object" && item !== null,
      )
    : [];
}

function newStableId() {
  return globalThis.crypto.randomUUID();
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

function selectClassName() {
  return "field-input min-h-11 bg-white";
}

function textareaClassName() {
  return "field-input min-h-28 resize-y";
}

function PayloadFields({
  typeKey,
  payload,
  assets,
  onChange,
}: {
  typeKey: ComponentTypeKey;
  payload: Record<string, unknown>;
  assets: CourseAsset[];
  onChange: (payload: Record<string, unknown>) => void;
}) {
  const readyAssets = assets.filter((asset) => asset.status === "ready");
  const imageAssets = readyAssets.filter((asset) =>
    asset.mimeType.startsWith("image/"),
  );

  switch (typeKey) {
    case "heading":
      return (
        <div className="grid gap-4 md:grid-cols-[1fr_9rem]">
          <Field label="Текст заголовка">
            <input
              className="field-input"
              value={stringValue(payload.text)}
              onChange={(event) =>
                onChange({ ...payload, text: event.target.value })
              }
            />
          </Field>
          <Field label="Уровень">
            <select
              className={selectClassName()}
              value={stringValue(payload.level) || "h2"}
              onChange={(event) =>
                onChange({ ...payload, level: event.target.value })
              }
            >
              <option value="h2">H2</option>
              <option value="h3">H3</option>
              <option value="h4">H4</option>
            </select>
          </Field>
        </div>
      );
    case "rich_text":
      return (
        <Field label="Текст (безопасный Markdown)">
          <textarea
            className={textareaClassName()}
            value={stringValue(payload.content)}
            onChange={(event) =>
              onChange({
                ...payload,
                content: event.target.value,
                format: "markdown",
              })
            }
          />
        </Field>
      );
    case "callout":
      return (
        <div className="grid gap-4">
          <div className="grid gap-4 md:grid-cols-[1fr_12rem]">
            <Field label="Заголовок (необязательно)">
              <input
                className="field-input"
                value={stringValue(payload.title)}
                onChange={(event) => {
                  const title = event.target.value;
                  const next = { ...payload };
                  if (title.trim()) next.title = title;
                  else delete next.title;
                  onChange(next);
                }}
              />
            </Field>
            <Field label="Тон">
              <select
                className={selectClassName()}
                value={stringValue(payload.tone) || "info"}
                onChange={(event) =>
                  onChange({ ...payload, tone: event.target.value })
                }
              >
                <option value="neutral">Нейтральный</option>
                <option value="info">Информация</option>
                <option value="success">Успех</option>
                <option value="warning">Важно</option>
              </select>
            </Field>
          </div>
          <Field label="Текст">
            <textarea
              className={textareaClassName()}
              value={stringValue(payload.text)}
              onChange={(event) =>
                onChange({ ...payload, text: event.target.value })
              }
            />
          </Field>
        </div>
      );
    case "quote":
      return (
        <div className="grid gap-4">
          <Field label="Цитата">
            <textarea
              className={textareaClassName()}
              value={stringValue(payload.text)}
              onChange={(event) =>
                onChange({ ...payload, text: event.target.value })
              }
            />
          </Field>
          <Field label="Автор (необязательно)">
            <input
              className="field-input"
              value={stringValue(payload.attribution)}
              onChange={(event) => {
                const attribution = event.target.value;
                const next = { ...payload };
                if (attribution.trim()) next.attribution = attribution;
                else delete next.attribution;
                onChange(next);
              }}
            />
          </Field>
        </div>
      );
    case "divider":
      return (
        <p className="rounded-xl bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
          Разделитель не содержит текста. Его ширину и стиль можно настроить
          ниже.
        </p>
      );
    case "image":
      return (
        <div className="grid gap-4">
          <Field
            label="Изображение"
            hint="Доступны только готовые изображения, прикреплённые к этому курсу."
          >
            <select
              className={selectClassName()}
              value={stringValue(payload.storedFileId)}
              onChange={(event) =>
                onChange({
                  ...payload,
                  storedFileId: event.target.value || null,
                })
              }
            >
              <option value="">Не выбрано</option>
              {imageAssets.map((asset) => (
                <option key={asset.id} value={asset.id}>
                  {asset.originalFilename}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Alt-текст">
            <input
              className="field-input"
              value={stringValue(payload.alt)}
              onChange={(event) =>
                onChange({ ...payload, alt: event.target.value })
              }
            />
          </Field>
          <Field label="Подпись (необязательно)">
            <input
              className="field-input"
              value={stringValue(payload.caption)}
              onChange={(event) => {
                const caption = event.target.value;
                const next = { ...payload };
                if (caption.trim()) next.caption = caption;
                else delete next.caption;
                onChange(next);
              }}
            />
          </Field>
        </div>
      );
    case "slideshow": {
      const slides = objectArray(payload.slides);
      const selectedIds = slides
        .map((slide) => stringValue(slide.storedFileId))
        .filter(Boolean);
      return (
        <div className="grid gap-4">
          <Field
            label="Изображения слайдшоу"
            hint="Выберите несколько изображений с Cmd/Ctrl. Порядок соответствует списку вложений."
          >
            <select
              multiple
              className="field-input min-h-36 bg-white"
              value={selectedIds}
              onChange={(event) => {
                const ids = Array.from(event.target.selectedOptions).map(
                  (option) => option.value,
                );
                const nextSlides = ids.map((storedFileId) => {
                  const existing = slides.find(
                    (slide) => slide.storedFileId === storedFileId,
                  );
                  const asset = imageAssets.find(
                    (item) => item.id === storedFileId,
                  );
                  return (
                    existing ?? {
                      id: newStableId(),
                      storedFileId,
                      alt: asset?.originalFilename ?? "",
                    }
                  );
                });
                onChange({ ...payload, slides: nextSlides });
              }}
            >
              {imageAssets.map((asset) => (
                <option key={asset.id} value={asset.id}>
                  {asset.originalFilename}
                </option>
              ))}
            </select>
          </Field>
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              className="auth-checkbox"
              checked={booleanValue(payload.autoplay)}
              onChange={(event) =>
                onChange({ ...payload, autoplay: event.target.checked })
              }
            />
            Автоматически переключать (в предпросмотре пока ручное управление)
          </label>
        </div>
      );
    }
    case "single_choice_poll": {
      const options = objectArray(payload.options);
      const optionLines = options.map((option) => stringValue(option.label));
      return (
        <div className="grid gap-4">
          <Field label="Вопрос">
            <textarea
              className={textareaClassName()}
              value={stringValue(payload.question)}
              onChange={(event) =>
                onChange({ ...payload, question: event.target.value })
              }
            />
          </Field>
          <Field
            label="Варианты ответа"
            hint="Один непустой вариант на строку, минимум два."
          >
            <textarea
              className={textareaClassName()}
              value={optionLines.join("\n")}
              onChange={(event) => {
                const labels = event.target.value.split("\n");
                onChange({
                  ...payload,
                  options: labels.map((label, index) => ({
                    id: stringValue(options[index]?.id) || newStableId(),
                    label,
                  })),
                });
              }}
            />
          </Field>
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              className="auth-checkbox"
              checked={booleanValue(payload.showResults, true)}
              onChange={(event) =>
                onChange({ ...payload, showResults: event.target.checked })
              }
            />
            Показывать выбранный вариант после ответа
          </label>
        </div>
      );
    }
    case "matching_game": {
      const pairs = objectArray(payload.pairs);
      const pairLines = pairs.map(
        (pair) => `${stringValue(pair.left)} = ${stringValue(pair.right)}`,
      );
      return (
        <div className="grid gap-4">
          <Field label="Инструкция">
            <input
              className="field-input"
              value={stringValue(payload.instruction)}
              onChange={(event) =>
                onChange({ ...payload, instruction: event.target.value })
              }
            />
          </Field>
          <Field
            label="Пары"
            hint="Одна пара на строку в формате «лево = право», минимум две."
          >
            <textarea
              className={textareaClassName()}
              value={pairLines.join("\n")}
              onChange={(event) => {
                const nextPairs = event.target.value
                  .split("\n")
                  .map((line, index) => {
                    const separatorIndex = line.indexOf("=");
                    const left =
                      separatorIndex < 0 ? line : line.slice(0, separatorIndex);
                    const right =
                      separatorIndex < 0 ? "" : line.slice(separatorIndex + 1);
                    return {
                      id: stringValue(pairs[index]?.id) || newStableId(),
                      left: left.trim(),
                      right: right.trim(),
                    };
                  });
                onChange({ ...payload, pairs: nextPairs });
              }}
            />
          </Field>
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              className="auth-checkbox"
              checked={booleanValue(payload.shuffle, true)}
              onChange={(event) =>
                onChange({ ...payload, shuffle: event.target.checked })
              }
            />
            Перемешать правую колонку
          </label>
        </div>
      );
    }
    case "file":
      return (
        <div className="grid gap-4">
          <Field
            label="Файл"
            hint="Файл прикреплён преподавателем и не считается автоматически проанализированным."
          >
            <select
              className={selectClassName()}
              value={stringValue(payload.storedFileId)}
              onChange={(event) => {
                const storedFileId = event.target.value;
                const asset = readyAssets.find(
                  (item) => item.id === storedFileId,
                );
                onChange({
                  ...payload,
                  storedFileId: storedFileId || null,
                  label:
                    stringValue(payload.label) ||
                    asset?.originalFilename ||
                    "Файл",
                });
              }}
            >
              <option value="">Не выбрано</option>
              {readyAssets.map((asset) => (
                <option key={asset.id} value={asset.id}>
                  {asset.originalFilename}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Название ссылки">
            <input
              className="field-input"
              value={stringValue(payload.label)}
              onChange={(event) =>
                onChange({ ...payload, label: event.target.value })
              }
            />
          </Field>
          <Field label="Описание (необязательно)">
            <textarea
              className={textareaClassName()}
              value={stringValue(payload.description)}
              onChange={(event) => {
                const description = event.target.value;
                const next = { ...payload };
                if (description.trim()) next.description = description;
                else delete next.description;
                onChange(next);
              }}
            />
          </Field>
          <Field label="Действие">
            <select
              className={selectClassName()}
              value={stringValue(payload.openMode) || "download"}
              onChange={(event) =>
                onChange({ ...payload, openMode: event.target.value })
              }
            >
              <option value="download">Скачать</option>
              <option value="preview">Открыть в новой вкладке</option>
            </select>
          </Field>
        </div>
      );
  }
}

function PlacementFields({
  typeKey,
  placement,
  onChange,
}: {
  typeKey: ComponentTypeKey;
  placement: Record<string, unknown>;
  onChange: (placement: Record<string, unknown>) => void;
}) {
  return (
    <div className="grid gap-4 border-t border-neutral-200 pt-4 md:grid-cols-2">
      <Field label="Ширина">
        <select
          className={selectClassName()}
          value={stringValue(placement.width) || "content"}
          onChange={(event) =>
            onChange({ ...placement, width: event.target.value })
          }
        >
          <option value="content">Контент</option>
          <option value="wide">Широкая</option>
          <option value="full">На всю ширину</option>
        </select>
      </Field>
      {typeKey === "divider" ? (
        <Field label="Стиль линии">
          <select
            className={selectClassName()}
            value={stringValue(placement.style) || "solid"}
            onChange={(event) =>
              onChange({ ...placement, style: event.target.value })
            }
          >
            <option value="solid">Сплошная</option>
            <option value="dashed">Штриховая</option>
            <option value="dotted">Точечная</option>
          </select>
        </Field>
      ) : null}
      {typeKey === "heading" ||
      typeKey === "rich_text" ||
      typeKey === "quote" ? (
        <Field label="Выравнивание текста">
          <select
            className={selectClassName()}
            value={stringValue(placement.textAlign) || "start"}
            onChange={(event) =>
              onChange({ ...placement, textAlign: event.target.value })
            }
          >
            <option value="start">Слева</option>
            <option value="center">По центру</option>
            <option value="end">Справа</option>
          </select>
        </Field>
      ) : null}
      {typeKey === "callout" ? (
        <Field label="Акцент">
          <select
            className={selectClassName()}
            value={stringValue(placement.emphasis) || "soft"}
            onChange={(event) =>
              onChange({ ...placement, emphasis: event.target.value })
            }
          >
            <option value="soft">Мягкий</option>
            <option value="strong">Сильный</option>
          </select>
        </Field>
      ) : null}
      {typeKey === "image" || typeKey === "slideshow" ? (
        <>
          <Field label="Вписывание">
            <select
              className={selectClassName()}
              value={stringValue(placement.fit) || "contain"}
              onChange={(event) =>
                onChange({ ...placement, fit: event.target.value })
              }
            >
              <option value="contain">Вместить</option>
              <option value="cover">Заполнить</option>
            </select>
          </Field>
          <Field label="Пропорции">
            <select
              className={selectClassName()}
              value={stringValue(placement.aspectRatio) || "auto"}
              onChange={(event) =>
                onChange({ ...placement, aspectRatio: event.target.value })
              }
            >
              <option value="auto">Исходные</option>
              <option value="square">1:1</option>
              <option value="4:3">4:3</option>
              <option value="16:9">16:9</option>
            </select>
          </Field>
        </>
      ) : null}
      {typeKey === "single_choice_poll" || typeKey === "matching_game" ? (
        <label className="flex items-center gap-2 self-end pb-3 text-sm font-semibold">
          <input
            type="checkbox"
            className="auth-checkbox"
            checked={booleanValue(placement.compact)}
            onChange={(event) =>
              onChange({ ...placement, compact: event.target.checked })
            }
          />
          Компактный вид
        </label>
      ) : null}
      {typeKey === "file" ? (
        <Field label="Вид ссылки">
          <select
            className={selectClassName()}
            value={stringValue(placement.display) || "card"}
            onChange={(event) =>
              onChange({ ...placement, display: event.target.value })
            }
          >
            <option value="card">Карточка</option>
            <option value="link">Ссылка</option>
          </select>
        </Field>
      ) : null}
    </div>
  );
}

export function ComponentPayloadEditor({
  component,
  assets,
  disabled,
  onSave,
  onCancel,
}: ComponentPayloadEditorProps) {
  const [payload, setPayload] = useState<Record<string, unknown>>(() => ({
    ...component.payload,
  }));
  const [placement, setPlacement] = useState<Record<string, unknown>>(() => ({
    ...component.placement,
  }));
  const [validationMessage, setValidationMessage] = useState<string | null>(
    null,
  );
  const definition = useMemo(
    () => getComponentDefinition(component.typeKey),
    [component.typeKey],
  );

  async function save() {
    const parsedPayload = definition.payloadSchema.safeParse(payload);
    if (!parsedPayload.success) {
      setValidationMessage(
        parsedPayload.error.issues[0]?.message ??
          "Проверьте содержимое компонента.",
      );
      return;
    }
    const parsedPlacement = definition.placementSchema.safeParse(placement);
    if (!parsedPlacement.success) {
      setValidationMessage(
        parsedPlacement.error.issues[0]?.message ??
          "Проверьте настройки отображения.",
      );
      return;
    }
    setValidationMessage(null);
    await onSave({
      payload: parsedPayload.data as Record<string, unknown>,
      placement: parsedPlacement.data as Record<string, unknown>,
    });
  }

  return (
    <div className="grid gap-4 rounded-2xl border border-sky-200 bg-sky-50/50 p-4">
      <PayloadFields
        typeKey={component.typeKey}
        payload={payload}
        assets={assets}
        onChange={setPayload}
      />
      <PlacementFields
        typeKey={component.typeKey}
        placement={placement}
        onChange={setPlacement}
      />
      {validationMessage ? (
        <p className="text-sm font-medium text-rose-700" role="alert">
          {validationMessage}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button disabled={disabled} onClick={() => void save()}>
          Сохранить компонент
        </Button>
        <Button variant="ghost" disabled={disabled} onClick={onCancel}>
          Отмена
        </Button>
      </div>
    </div>
  );
}
